export type GitHubRepository = {
  id: number;
  name: string;
  full_name: string;
  owner: { login: string };
  default_branch?: string;
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

async function githubError(response: Response, fallback: string) {
  const detail = await response.json().catch(() => null) as { message?: string } | null;
  return new Error(detail?.message || fallback);
}

export async function dispatchWorkflow(token: string, repository: GitHubRepository, workflowFile: string, ref = repository.default_branch || "main") {
  const response = await fetch(`https://api.github.com/repos/${encodeURIComponent(repository.owner.login)}/${encodeURIComponent(repository.name)}/actions/workflows/${encodeURIComponent(workflowFile)}/dispatches`, {
    method: "POST",
    headers: { ...headers(token), "Content-Type": "application/json" },
    body: JSON.stringify({ ref }),
  });
  if (!response.ok) throw await githubError(response, `GitHub could not dispatch ${workflowFile}.`);
}

export async function createPullRequest(token: string, repository: GitHubRepository, head: string, base: string, title: string) {
  const response = await fetch(`https://api.github.com/repos/${encodeURIComponent(repository.owner.login)}/${encodeURIComponent(repository.name)}/pulls`, {
    method: "POST",
    headers: { ...headers(token), "Content-Type": "application/json" },
    body: JSON.stringify({ head, base, title }),
  });
  if (!response.ok) throw await githubError(response, "GitHub could not create the pull request.");
  return (await response.json()) as { number: number; html_url: string; title: string };
}

export async function getRepositoryStats(token: string, repository: GitHubRepository) {
  const response = await fetch(`https://api.github.com/repos/${encodeURIComponent(repository.owner.login)}/${encodeURIComponent(repository.name)}`, { headers: headers(token), cache: "no-store" });
  if (!response.ok) throw await githubError(response, "GitHub could not load repository status.");
  const data = await response.json() as Record<string, unknown>;
  return {
    name: typeof data.full_name === "string" ? data.full_name : repository.full_name,
    defaultBranch: typeof data.default_branch === "string" ? data.default_branch : repository.default_branch || "main",
    visibility: data.private === true ? "private" : "public",
    stars: typeof data.stargazers_count === "number" ? data.stargazers_count : 0,
    forks: typeof data.forks_count === "number" ? data.forks_count : 0,
    openIssues: typeof data.open_issues_count === "number" ? data.open_issues_count : 0,
    language: typeof data.language === "string" ? data.language : "Not specified",
  };
}
