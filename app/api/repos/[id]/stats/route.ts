import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { decryptAccessToken, getSession } from "../../../../lib/session";
import { getGitHubRepository } from "../../../../lib/github";

type Params = { params: Promise<{ id: string }> };

async function context(params: Params["params"]) {
  const session = await getSession(cookies());
  if (!session) return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  const { id } = await params;
  const repoId = Number(id);
  if (!Number.isSafeInteger(repoId)) return { error: NextResponse.json({ error: "Invalid repository" }, { status: 400 }) };
  const cookieStore = await cookies();
  const encrypted = cookieStore.get("github_access_token")?.value;
  const token = encrypted ? decryptAccessToken(encrypted) : null;
  if (!token) return { error: NextResponse.json({ error: "GitHub session expired. Please sign in again." }, { status: 401 }) };
  const repository = await getGitHubRepository(token, repoId);
  if (!repository) return { error: NextResponse.json({ error: "Repository not found or unavailable." }, { status: 404 }) };
  return { session, repoId, token, repository };
}

export async function GET(_: Request, { params }: Params) {
  const current = await context(params);
  if ("error" in current) return current.error;

  const owner = current.repository.owner.login;
  const repo = current.repository.name;
  const token = current.token;

  const headers = {
    Authorization: `Bearer ${token}`,
    Accept: "application/vnd.github+json",
    "User-Agent": "OpsBridge",
  };

  const fetchJson = async (url: string) => {
    try {
      const response = await fetch(url, { headers, next: { revalidate: 60 } });
      if (response.status === 202) return null; // GitHub is generating stats in the background
      if (!response.ok) return null;
      return response.json();
    } catch {
      return null;
    }
  };

  const [branches, pulls, codeFrequency, commitActivity, contributors, languages, punchCard] = await Promise.all([
    fetchJson(`https://api.github.com/repos/${owner}/${repo}/branches?per_page=100`),
    fetchJson(`https://api.github.com/repos/${owner}/${repo}/pulls?state=open&per_page=100`),
    fetchJson(`https://api.github.com/repos/${owner}/${repo}/stats/code_frequency`),
    fetchJson(`https://api.github.com/repos/${owner}/${repo}/stats/commit_activity`),
    fetchJson(`https://api.github.com/repos/${owner}/${repo}/contributors?per_page=100`),
    fetchJson(`https://api.github.com/repos/${owner}/${repo}/languages`),
    fetchJson(`https://api.github.com/repos/${owner}/${repo}/stats/punch_card`),
  ]);

  const activeBranches = branches ? branches.length : 0;
  const openPrs = pulls ? pulls.length : 0;
  
  // Code frequency is an array of [timestamp, additions, deletions]
  let recentCodeFrequency = [0, 0, 0];
  if (codeFrequency && codeFrequency.length > 0) {
    for (let i = codeFrequency.length - 1; i >= 0; i--) {
      if (codeFrequency[i][1] > 0 || codeFrequency[i][2] < 0) {
        recentCodeFrequency = codeFrequency[i];
        break;
      }
    }
  }
  const additions = recentCodeFrequency[1];
  const deletions = Math.abs(recentCodeFrequency[2]);

  return NextResponse.json({
    activeBranches,
    openPrs,
    additions,
    deletions,
    contributors: contributors ? contributors.length : 0,
    languages: languages ? Object.keys(languages).slice(0, 3) : [], // Top 3 languages
    // Pass raw data for activity if needed, or summary
    commitActivity: commitActivity || [],
    punchCard: punchCard || [],
  });
}
