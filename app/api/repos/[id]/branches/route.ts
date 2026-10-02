import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getBranches, getGitHubRepository } from "../../../../lib/github";
import { decryptAccessToken, getSession } from "../../../../lib/session";

type Params = { params: Promise<{ id: string }> };

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
    const branches = await getBranches(token, repository);
    return NextResponse.json({ branches, defaultBranch: repository.default_branch || "main" });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to load repository branches." }, { status: 502 });
  }
}
