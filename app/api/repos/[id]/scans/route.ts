import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { decryptAccessToken, getSession } from "../../../../lib/session";
import { getGitHubRepository, getLatestWorkflowRuns } from "../../../../lib/github";

type Params = { params: Promise<{ id: string }> };
const workflowNames = {
  semgrep: "OpsBridge Semgrep Security Scan",
  trivy: "OpsBridge Trivy Security Scan",
} as const;

function status(run: { status: string | null; conclusion: string | null } | undefined) {
  if (!run) return "idle" as const;
  if (run.status === "queued" || run.status === "in_progress") return "running" as const;
  return run.conclusion === "success" ? "completed" as const : "failed" as const;
}

export async function GET(_: Request, { params }: Params) {
  if (!(await getSession(cookies()))) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const repoId = Number(id);
  if (!Number.isSafeInteger(repoId)) return NextResponse.json({ error: "Invalid repository" }, { status: 400 });
  const cookieStore = await cookies();
  const encrypted = cookieStore.get("github_access_token")?.value;
  const token = encrypted ? decryptAccessToken(encrypted) : null;
  if (!token) return NextResponse.json({ error: "GitHub session expired. Please sign in again." }, { status: 401 });

  try {
    const repository = await getGitHubRepository(token, repoId);
    if (!repository) return NextResponse.json({ error: "Repository not found or unavailable." }, { status: 404 });
    const runs = await getLatestWorkflowRuns(token, repository);
    const scans = (Object.entries(workflowNames) as [keyof typeof workflowNames, string][]).map(([key, name]) => {
      const run = runs.find((candidate) => candidate.name === name);
      return {
        key,
        name,
        status: status(run),
        branch: run?.head_branch || null,
        commit: run?.head_sha ? run.head_sha.slice(0, 7) : null,
        updatedAt: run?.updated_at || null,
        url: run?.html_url || null,
      };
    });
    return NextResponse.json({ scans });
  } catch (error) {
    console.error("Failed to load scan status", error);
    return NextResponse.json({ error: "Unable to load scan status from GitHub." }, { status: 502 });
  }
}
