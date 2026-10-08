import type { Scan } from "./types";

function ScanCard({ scan }: { scan: Scan }) {
  return (
    <article className={`scan-card scan-${scan.status}`}>
      <div className="scan-card-heading">
        <span className="scan-symbol">{scan.key === "semgrep" ? "S" : "T"}</span>
        <div>
          <strong>{scan.key === "semgrep" ? "Semgrep" : "Trivy"}</strong>
          <small>Security scan</small>
        </div>
        <span className="scan-status">{scan.status}</span>
      </div>
      <div className="scan-meta">
        <span>{scan.branch || "No run yet"}</span>
        <span>{scan.commit ? `#${scan.commit}` : "—"}</span>
      </div>
    </article>
  );
}

type Props = {
  scans: Scan[];
};

/**
 * ScanPanel
 *
 * Right-sidebar top section. Renders one ScanCard per security scanner
 * (Trivy + Semgrep). Stateless — receives current scan state from ChatRoom.
 */
export default function ScanPanel({ scans }: Props) {
  return (
    <div className="scan-upper">
      <div className="scan-panel-heading">
        <span className="sidebar-label">SECURITY SCANS</span>
        <small>GitHub Actions</small>
      </div>
      <div className="scan-list">
        {scans.map((scan) => (
          <ScanCard key={scan.key} scan={scan} />
        ))}
      </div>
    </div>
  );
}
