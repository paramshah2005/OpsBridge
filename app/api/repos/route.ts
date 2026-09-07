import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { decryptAccessToken, getSession } from "../../lib/session";

export async function GET() {
  if (!(await getSession(cookies())))
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const encryptedToken = cookies().get("github_access_token")?.value;
  const token = encryptedToken ? decryptAccessToken(encryptedToken) : null;
  if (!token)
    return NextResponse.json(
      { error: "GitHub token missing" },
      { status: 401 },
    );
  const response = await fetch(
    "https://api.github.com/user/repos?sort=updated&per_page=100&affiliation=owner",
    {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.github+json",
        "User-Agent": "OpsBridge",
      },
      next: { revalidate: 60 },
    },
  );
  if (!response.ok) {
    const errorResponse = NextResponse.json(
      { error: response.status === 401 ? "Your GitHub session expired. Please sign in again." : "Unable to load repositories from GitHub" },
      { status: response.status },
    );
    if (response.status === 401) { errorResponse.cookies.delete("opsbridge_session"); errorResponse.cookies.delete("github_access_token"); }
    return errorResponse;
  }
  const repos = await response.json();
  return NextResponse.json(
    repos.map((repo: Record<string, unknown>) => ({
      id: repo.id,
      name: repo.name,
      fullName: repo.full_name,
      description: repo.description,
      private: repo.private,
      language: repo.language,
      stars: repo.stargazers_count,
      updatedAt: repo.updated_at,
      defaultBranch: repo.default_branch,
    })),
    { headers: { "Cache-Control": "private, max-age=60" } },
  );
}
