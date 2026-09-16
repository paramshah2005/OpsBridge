export type GitHubRepository = {
  id: number;
  name: string;
  full_name: string;
  owner: { login: string };
  permissions?: { admin?: boolean };
};

export type GitHubWorkflowRun = {
  id: number;
  name: string | null;
  status: string | null;
  conclusion: string | null;
  head_branch: string | null;
  head_sha: string | null;
  html_url: string | null;
  updated_at: string | null;
};

const headers = (token: string) => ({
  Authorization: `Bearer ${token}`,
  Accept: "application/vnd.github+json",
  "User-Agent": "OpsBridge",
  "X-GitHub-Api-Version": "2022-11-28",
});

export async function getGitHubRepository(token: string, repoId: number) {
  const response = await fetch(`https://api.github.com/repositories/${repoId}`, {
    headers: headers(token),
    cache: "no-store",
  });
  if (!response.ok) return null;
  return (await response.json()) as GitHubRepository;
}

export async function getLatestWorkflowRuns(token: string, repository: GitHubRepository) {
  const response = await fetch(
    `https://api.github.com/repos/${encodeURIComponent(repository.owner.login)}/${encodeURIComponent(repository.name)}/actions/runs?per_page=100`,
    { headers: headers(token), cache: "no-store" },
  );
  if (!response.ok) throw new Error("GitHub could not load workflow runs.");
  const data = (await response.json()) as { workflow_runs?: GitHubWorkflowRun[] };
  return data.workflow_runs || [];
}

export async function createRepositoryWebhook(
  token: string,
  repository: GitHubRepository,
  config: { url: string; secret: string; events: string[] },
) {
  const response = await fetch(
    `https://api.github.com/repos/${encodeURIComponent(repository.owner.login)}/${encodeURIComponent(repository.name)}/hooks`,
    {
      method: "POST",
      headers: { ...headers(token), "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "web",
        active: true,
        events: config.events,
        config: { url: config.url, content_type: "json", secret: config.secret, insecure_ssl: "0" },
      }),
    },
  );
  if (!response.ok) {
    const detail = await response.json().catch(() => null) as { message?: string } | null;
    throw new Error(detail?.message || "GitHub could not create this webhook.");
  }
  return (await response.json()) as { id: number };
}

export async function deleteRepositoryWebhook(token: string, repository: GitHubRepository, hookId: number) {
  const response = await fetch(
    `https://api.github.com/repos/${encodeURIComponent(repository.owner.login)}/${encodeURIComponent(repository.name)}/hooks/${hookId}`,
    { method: "DELETE", headers: headers(token) },
  );
  if (!response.ok && response.status !== 404) throw new Error("GitHub could not remove this webhook.");
}
