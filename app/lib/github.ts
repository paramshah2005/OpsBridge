export type GitHubRepository = {
  id: number;
  name: string;
  full_name: string;
  owner: { login: string };
  default_branch?: string;
  permissions?: { admin?: boolean; maintain?: boolean; push?: boolean; triage?: boolean; pull?: boolean };
  role_name?: string;
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

export type GitHubPullRequest = {
  number: number;
  title: string;
  html_url: string;
  user?: { login?: string };
  state?: string;
  draft?: boolean;
  merged?: boolean;
  mergeable?: boolean | null;
  mergeable_state?: string;
  head?: { ref?: string; sha?: string };
  base?: { ref?: string };
  commits?: number;
  changed_files?: number;
  additions?: number;
  deletions?: number;
  created_at?: string;
  updated_at?: string;
  merged_at?: string | null;
};

export type GitHubCheckRun = {
  id: number;
  name: string;
  status: string;
  conclusion: string | null;
  html_url: string | null;
};

export type GitHubCommitStatus = {
  id: number;
  context: string;
  state: string;
  target_url: string | null;
  description: string | null;
};

export type GitHubUser = {
  login: string;
  name: string | null;
  html_url: string;
};

export type GitHubCommit = {
  sha: string;
  html_url?: string;
  commit?: { message?: string; author?: { name?: string; date?: string } };
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

export async function getOpenPullRequests(token: string, repository: GitHubRepository) {
  const response = await fetch(`https://api.github.com/repos/${encodeURIComponent(repository.owner.login)}/${encodeURIComponent(repository.name)}/pulls?state=open&per_page=100`, { headers: headers(token), cache: "no-store" });
  if (!response.ok) throw new Error("GitHub could not load pull requests.");
  return (await response.json()) as GitHubPullRequest[];
}

export async function getPullRequest(token: string, repository: GitHubRepository, pullNumber: number) {
  const response = await fetch(`https://api.github.com/repos/${encodeURIComponent(repository.owner.login)}/${encodeURIComponent(repository.name)}/pulls/${pullNumber}`, { headers: headers(token), cache: "no-store" });
  if (response.status === 404) return null;
  if (!response.ok) throw await githubError(response, "GitHub could not load the pull request.");
  return (await response.json()) as GitHubPullRequest;
}

export async function getCommitChecks(token: string, repository: GitHubRepository, ref: string) {
  const baseUrl = `https://api.github.com/repos/${encodeURIComponent(repository.owner.login)}/${encodeURIComponent(repository.name)}/commits/${encodeURIComponent(ref)}`;
  const [checksResponse, statusesResponse] = await Promise.all([
    fetch(`${baseUrl}/check-runs?per_page=100`, { headers: headers(token), cache: "no-store" }),
    fetch(`${baseUrl}/status`, { headers: headers(token), cache: "no-store" }),
  ]);
  if (!checksResponse.ok) throw await githubError(checksResponse, "GitHub could not load check runs.");
  if (!statusesResponse.ok) throw await githubError(statusesResponse, "GitHub could not load commit statuses.");
  const checksData = (await checksResponse.json()) as { check_runs?: GitHubCheckRun[] };
  const statusesData = (await statusesResponse.json()) as { statuses?: GitHubCommitStatus[] };
  return { checkRuns: checksData.check_runs || [], statuses: statusesData.statuses || [] };
}

export async function getAuthenticatedUser(token: string) {
  const response = await fetch("https://api.github.com/user", { headers: headers(token), cache: "no-store" });
  if (!response.ok) throw await githubError(response, "GitHub could not load the authenticated user.");
  return (await response.json()) as GitHubUser;
}

export async function getRecentlyMergedPullRequest(token: string, repository: GitHubRepository) {
  const response = await fetch(`https://api.github.com/repos/${encodeURIComponent(repository.owner.login)}/${encodeURIComponent(repository.name)}/pulls?state=closed&sort=updated&direction=desc&per_page=20`, { headers: headers(token), cache: "no-store" });
  if (!response.ok) throw new Error("GitHub could not load recently merged pull requests.");
  const pullRequests = (await response.json()) as GitHubPullRequest[];
  return pullRequests.find((pullRequest) => pullRequest.merged_at) || null;
}

export async function getContributors(token: string, repository: GitHubRepository) {
  const response = await fetch(`https://api.github.com/repos/${encodeURIComponent(repository.owner.login)}/${encodeURIComponent(repository.name)}/contributors?per_page=5`, { headers: headers(token), cache: "no-store" });
  if (!response.ok) throw new Error("GitHub could not load contributors.");
  const contributors = (await response.json()) as Array<{ login?: string }>;
  return contributors.map((contributor) => contributor.login).filter((login): login is string => Boolean(login));
}

export async function getLatestCommit(token: string, repository: GitHubRepository) {
  const response = await fetch(`https://api.github.com/repos/${encodeURIComponent(repository.owner.login)}/${encodeURIComponent(repository.name)}/commits?sha=${encodeURIComponent(repository.default_branch || "main")}&per_page=1`, { headers: headers(token), cache: "no-store" });
  if (!response.ok) throw new Error("GitHub could not load the latest commit.");
  const commits = (await response.json()) as GitHubCommit[];
  return commits[0] || null;
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

export type GitHubArtifact = { id: number; name: string };

export async function getWorkflowRunArtifacts(token: string, owner: string, repo: string, runId: number) {
  const response = await fetch(`https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/actions/runs/${runId}/artifacts`, { headers: headers(token), cache: "no-store" });
  if (!response.ok) throw await githubError(response, "GitHub could not load workflow run artifacts.");
  const data = (await response.json()) as { artifacts?: GitHubArtifact[] };
  return data.artifacts || [];
}

export async function downloadArtifactText(token: string, owner: string, repo: string, artifactId: number) {
  const response = await fetch(`https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/actions/artifacts/${artifactId}/zip`, { headers: headers(token), cache: "no-store" });
  if (!response.ok) throw await githubError(response, "GitHub could not download the workflow artifact.");
  const buffer = Buffer.from(await response.arrayBuffer());
  const AdmZip = (await import("adm-zip")).default;
  const zip = new AdmZip(buffer);
  const entry = zip.getEntries()[0];
  if (!entry) throw new Error("The workflow artifact archive was empty.");
  return entry.getData().toString("utf8");
}

export async function getBranches(token: string, repository: GitHubRepository) {
  const response = await fetch(`https://api.github.com/repos/${encodeURIComponent(repository.owner.login)}/${encodeURIComponent(repository.name)}/branches?per_page=100`, { headers: headers(token), cache: "no-store" });
  if (!response.ok) throw await githubError(response, "GitHub could not load branches.");
  const branches = (await response.json()) as Array<{ name: string }>;
  return branches.map((branch) => branch.name);
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
    updatedAt: typeof data.updated_at === "string" ? data.updated_at : null,
    watchers: typeof data.watchers_count === "number" ? data.watchers_count : 0,
  };
}
