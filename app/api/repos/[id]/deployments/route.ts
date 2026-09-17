import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getDb } from "../../../../lib/db";
import { decryptAccessToken, getSession } from "../../../../lib/session";
import { getGitHubRepository } from "../../../../lib/github";

export const runtime = "nodejs";
type Params = { params: Promise<{ id: string }> };

async function repositoryId(params: Params["params"]) {
  const session = await getSession(cookies());
  if (!session) return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  const repoId = Number((await params).id);
  if (!Number.isSafeInteger(repoId)) return { error: NextResponse.json({ error: "Invalid repository" }, { status: 400 }) };
  const cookieStore = await cookies();
  const encrypted = cookieStore.get("github_access_token")?.value;
  const token = encrypted ? decryptAccessToken(encrypted) : null;
  if (!token) return { error: NextResponse.json({ error: "GitHub session expired. Please sign in again." }, { status: 401 }) };
  if (!await getGitHubRepository(token, repoId)) return { error: NextResponse.json({ error: "Repository not found or unavailable." }, { status: 404 }) };
  return { repoId };
}

export async function GET(_: Request, { params }: Params) {
  const current = await repositoryId(params);
  if ("error" in current) return current.error;
  try {
    const rows = await getDb()`SELECT id, deployment_id AS "deploymentId", status, repository_name AS repository, environment, target_url AS "targetUrl", commit_sha AS "commitSha", ref_name AS ref, occurred_at AS "occurredAt" FROM deployment_status_events WHERE github_repo_id = ${current.repoId} ORDER BY occurred_at DESC LIMIT 3`;
    return NextResponse.json({ deployments: rows });
  } catch (error) {
    console.error("Failed to load deployment statuses", error);
    return NextResponse.json({ error: "Unable to load deployment history." }, { status: 500 });
  }
}
