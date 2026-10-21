import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getBranchProtection, getOpenPullRequests, getPullRequest, getPullRequestChecks, getGitHubRepository } from "../../../../lib/github";
import { decryptAccessToken, getSession } from "../../../../lib/session";

type Params = { params: Promise<{ id: string }> };

export async function GET(request: Request, { params }: Params) {
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
    const numberText = new URL(request.url).searchParams.get("number");
    if (numberText === null) {
      const pullRequests = await getOpenPullRequests(token, repository);
      return NextResponse.json({ pullRequests: pullRequests.map((pullRequest) => ({
        number: pullRequest.number,
        title: pullRequest.title,
        url: pullRequest.html_url,
        author: pullRequest.user?.login || "unknown",
        headBranch: pullRequest.head?.ref || "unknown",
        baseBranch: pullRequest.base?.ref || "unknown",
      })) });
    }

    if (!/^\d+$/.test(numberText)) return NextResponse.json({ error: "Invalid pull request number." }, { status: 400 });
    const number = Number(numberText);
    if (!Number.isSafeInteger(number) || number <= 0) return NextResponse.json({ error: "Invalid pull request number." }, { status: 400 });
    const pullRequest = await getPullRequest(token, repository, number);
    if (!pullRequest) return NextResponse.json({ error: `Pull request #${number} was not found or is not accessible.` }, { status: 404 });
    if (!pullRequest.head?.sha || !pullRequest.base?.ref) {
      return NextResponse.json({ error: `GitHub could not resolve the branches for pull request #${number}.` }, { status: 502 });
    }
    const [checks, baseProtected] = await Promise.all([
      getPullRequestChecks(token, repository, pullRequest.head.sha),
      getBranchProtection(token, repository, pullRequest.base.ref),
    ]);
    return NextResponse.json({
      pullRequest: {
        number: pullRequest.number,
        title: pullRequest.title,
        url: pullRequest.html_url,
        headBranch: pullRequest.head.ref || "unknown",
        baseBranch: pullRequest.base.ref,
        mergeable: pullRequest.mergeable,
      },
      checks,
      baseProtected,
    });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to load pull request details." }, { status: 502 });
  }
}
