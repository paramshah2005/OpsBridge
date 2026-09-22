export type TrivyFinding = { id: string; pkg: string; installed: string; fixed: string | null; severity: "CRITICAL" | "HIGH"; title: string };
export type SemgrepFinding = { path: string; line: number; checkId: string; message: string; severity: string };

const severityRank: Record<string, number> = { CRITICAL: 0, HIGH: 1, ERROR: 0, WARNING: 1, INFO: 2 };

export function parseTrivyFindings(jsonText: string): TrivyFinding[] {
  const data = JSON.parse(jsonText) as { Results?: Array<{ Vulnerabilities?: Array<Record<string, unknown>> }> };
  const findings: TrivyFinding[] = [];
  for (const result of data.Results || []) {
    for (const vulnerability of result.Vulnerabilities || []) {
      const id = typeof vulnerability.VulnerabilityID === "string" ? vulnerability.VulnerabilityID : null;
      const severity = vulnerability.Severity === "CRITICAL" || vulnerability.Severity === "HIGH" ? vulnerability.Severity : null;
      if (!id || !severity) continue;
      findings.push({
        id,
        pkg: typeof vulnerability.PkgName === "string" ? vulnerability.PkgName : "unknown package",
        installed: typeof vulnerability.InstalledVersion === "string" ? vulnerability.InstalledVersion : "unknown",
        fixed: typeof vulnerability.FixedVersion === "string" ? vulnerability.FixedVersion : null,
        severity,
        title: typeof vulnerability.Title === "string" ? vulnerability.Title : "",
      });
    }
  }
  return findings.sort((left, right) => severityRank[left.severity] - severityRank[right.severity]);
}

export function parseSemgrepFindings(jsonText: string): SemgrepFinding[] {
  const data = JSON.parse(jsonText) as { results?: Array<Record<string, unknown>> };
  const findings: SemgrepFinding[] = [];
  for (const item of data.results || []) {
    const path = typeof item.path === "string" ? item.path : null;
    const start = item.start && typeof item.start === "object" ? item.start as Record<string, unknown> : {};
    const extra = item.extra && typeof item.extra === "object" ? item.extra as Record<string, unknown> : {};
    if (!path) continue;
    findings.push({
      path,
      line: typeof start.line === "number" ? start.line : 0,
      checkId: typeof item.check_id === "string" ? item.check_id : "unknown-rule",
      message: typeof extra.message === "string" ? extra.message.replace(/\s+/g, " ").trim() : "",
      severity: typeof extra.severity === "string" ? extra.severity : "ERROR",
    });
  }
  return findings.sort((left, right) => (severityRank[left.severity] ?? 9) - (severityRank[right.severity] ?? 9));
}

const MESSAGE_BUDGET = 1900;

export function formatScanFindingsMessage(kind: "trivy" | "semgrep", findings: TrivyFinding[] | SemgrepFinding[], runUrl: string) {
  const bullets = kind === "trivy"
    ? (findings as TrivyFinding[]).map((finding) => `• [${finding.severity}] ${finding.id} — ${finding.pkg} ${finding.installed} → ${finding.fixed || "no fix available"}${finding.title ? `\n  ${finding.title}` : ""}`)
    : (findings as SemgrepFinding[]).map((finding) => `• [${finding.severity}] ${finding.path}:${finding.line} (${finding.checkId})${finding.message ? `\n  ${finding.message}` : ""}`);

  const counts = findings.reduce<Record<string, number>>((acc, finding) => {
    acc[finding.severity] = (acc[finding.severity] || 0) + 1;
    return acc;
  }, {});
  const summary = Object.entries(counts).map(([severity, count]) => `${count} ${severity}`).join(", ");
  const header = `${kind === "trivy" ? "Trivy" : "Semgrep"} scan results — ${summary} (${findings.length} total)`;

  const lines: string[] = [];
  let used = header.length;
  let shown = 0;
  for (const bullet of bullets) {
    if (used + bullet.length + 1 > MESSAGE_BUDGET) break;
    lines.push(bullet);
    used += bullet.length + 1;
    shown += 1;
  }
  const remaining = findings.length - shown;
  const footer = remaining > 0 ? `…and ${remaining} more — full report: ${runUrl}` : `Full report: ${runUrl}`;

  return [header, ...lines, footer].join("\n");
}
