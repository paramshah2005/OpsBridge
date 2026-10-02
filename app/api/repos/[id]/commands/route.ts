import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createPullRequest, dispatchWorkflow, getAuthenticatedUser, getBranches, getCommitChecks, getContributors, getGitHubRepository, getLatestCommit, getLatestWorkflowRuns, getOpenPullRequests, getPullRequest, getRecentlyMergedPullRequest, getRepositoryStats, type GitHubCheckRun, type GitHubCommitStatus, type GitHubRepository } from "../../../../lib/github";
import { commandDefinitions, helpText, parseCommand } from "../../../../lib/commands";
import { broadcastToRoom } from "../../../../lib/realtime";
import { decryptAccessToken, getSession } from "../../../../lib/session";
import { getDb } from "../../../../lib/db";

type Params = { params: Promise<{ id: string }> };
const MESSAGE_LIMIT = 2000;

function pullNumber(args: string[]) {
  if (args.length !== 1 || !/^\d+$/.test(args[0])) return null;
  const value = Number(args[0]);
  return Number.isSafeInteger(value) && value > 0 ? value : null;
}

function repositoryPermission(repository: GitHubRepository) {
  if (repository.role_name) return repository.role_name;
  const permissions = repository.permissions;
  if (permissions?.admin) return "admin";
  if (permissions?.maintain) return "maintain";
  if (permissions?.push) return "write";
  if (permissions?.triage) return "triage";
  if (permissions?.pull) return "read";
  return "unknown";
}

function checkPriority(state: string) {
  if (["failure", "failed", "error", "cancelled", "timed_out", "action_required", "stale"].includes(state)) return 0;
  if (["queued", "in_progress", "pending", "requested", "waiting"].includes(state)) return 1;
  return 2;
}

function checkLabel(check: GitHubCheckRun) {
  return check.status === "completed" ? check.conclusion || "completed" : check.status;
}

function formatChecks(checkRuns: GitHubCheckRun[], statuses: GitHubCommitStatus[]) {
  const entries = [
    ...checkRuns.map((check) => ({ name: check.name, state: checkLabel(check), url: check.html_url })),
    ...statuses.map((status) => ({ name: status.context, state: status.state, url: status.target_url })),
  ].sort((left, right) => checkPriority(left.state) - checkPriority(right.state) || left.name.localeCompare(right.name));
  if (!entries.length) return ["No checks or commit statuses found."];
  return entries.map((entry) => `• ${entry.name}: ${entry.state}${entry.url ? `\n  ${entry.url}` : ""}`);
}

function withinMessageLimit(header: string[], entries: string[]) {
  const lines = [...header];
  let omitted = 0;
  for (let index = 0; index < entries.length; index += 1) {
    const candidate = [...lines, entries[index]].join("\n");
    const remaining = entries.length - index - 1;
    const footer = remaining ? `\n…and ${remaining} more.` : "";
    if (candidate.length + footer.length > MESSAGE_LIMIT) {
      omitted = entries.length - index;
      break;
    }
    lines.push(entries[index]);
  }
  if (omitted) lines.push(`…and ${omitted} more.`);
  return lines.join("\n").slice(0, MESSAGE_LIMIT);
}

async function saveResult(repoId: number, content: string) {
  const rows = await getDb()`INSERT INTO messages (github_repo_id, author_login, content, message_type) VALUES (${repoId}, 'opsbridge-command', ${content}, 'system_message') RETURNING id, github_repo_id AS "repoId", author_login AS "authorLogin", content, message_type AS "messageType", created_at AS "createdAt"`;
  broadcastToRoom(String(repoId), { type: "message", message: rows[0] });
  return rows[0];
}

export async function POST(request: Request, { params }: Params) {
  const session = await getSession(cookies());
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const repoId = Number(id);
  if (!Number.isSafeInteger(repoId)) return NextResponse.json({ error: "Invalid repository" }, { status: 400 });
  const body = await request.json().catch(() => null) as { content?: unknown } | null;
  const content = typeof body?.content === "string" ? body.content.trim() : "";
  const command = parseCommand(content);
  if (!command) return NextResponse.json({ error: "This endpoint only accepts chat commands." }, { status: 400 });
  const definition = commandDefinitions.find((item) => item.name === command.name);
  if (!definition) return NextResponse.json(await saveResult(repoId, `Unknown command: /${command.name}. Try /help.`), { status: 201 });
  const encryptedToken = (await cookies()).get("github_access_token")?.value;
  const token = encryptedToken ? decryptAccessToken(encryptedToken) : null;
  if (!token) return NextResponse.json({ error: "GitHub session expired. Please sign in again." }, { status: 401 });

  try {
    const repository = await getGitHubRepository(token, repoId);
    if (!repository) return NextResponse.json({ error: "Repository not found or unavailable." }, { status: 404 });
    let result = "";
    if (command.name === "help") result = helpText();
    else if (command.name === "rerun-trivy-scan" || command.name === "rerun-semgrep") {
      const workflow = command.name === "rerun-trivy-scan" ? "opsbridge-trivy.yml" : "opsbridge-semgrep.yml";
      await dispatchWorkflow(token, repository, workflow);
      result = `${workflow.includes("trivy") ? "Trivy" : "Semgrep"} scan dispatched on ${repository.default_branch || "main"}.`;
    } else if (command.name === "raise-pr") {
      if (command.args.length !== 3) result = `Usage: ${definition.usage}`;
      else {
        const pullRequest = await createPullRequest(token, repository, command.args[0], command.args[1], command.args[2]);
        result = `Pull request #${pullRequest.number} created: ${pullRequest.title}\n${pullRequest.html_url}`;
      }
    } else if (command.name === "branch") {
      const branches = await getBranches(token, repository);
      result = branches.length ? `Branches (${branches.length}):\n${branches.map((branch) => `• ${branch}${branch === (repository.default_branch || "main") ? " (default)" : ""}`).join("\n")}` : "No branches found.";
    } else if (command.name === "prs") {
      if (command.args.length !== 0) result = `Usage: ${definition.usage}`;
      else {
        const pullRequests = (await getOpenPullRequests(token, repository))
          .sort((left, right) => (Date.parse(right.updated_at || "") || 0) - (Date.parse(left.updated_at || "") || 0));
        if (!pullRequests.length) result = "No open pull requests.";
        else {
          const shown = pullRequests.slice(0, 10);
          const lines = shown.map((pullRequest) => [
            `• #${pullRequest.number} ${pullRequest.title}`,
            `  @${pullRequest.user?.login || "unknown"} · ${pullRequest.head?.ref || "unknown"} → ${pullRequest.base?.ref || "unknown"}`,
            `  ${pullRequest.html_url}`,
          ].join("\n"));
          if (pullRequests.length > shown.length) lines.push(`…and ${pullRequests.length - shown.length} more open pull request${pullRequests.length - shown.length === 1 ? "" : "s"}.`);
          result = withinMessageLimit([`Open pull requests (${pullRequests.length})`], lines);
        }
      }
    } else if (command.name === "pr") {
      const number = pullNumber(command.args);
      if (!number) result = `Usage: ${definition.usage}`;
      else {
        const pullRequest = await getPullRequest(token, repository, number);
        if (!pullRequest) result = `Pull request #${number} was not found or is not accessible.`;
        else {
          const state = pullRequest.merged || pullRequest.merged_at ? "merged" : pullRequest.draft ? "draft" : pullRequest.state || "unknown";
          result = [
            `Pull request #${pullRequest.number}: ${pullRequest.title}`,
            `State: ${state} · author: @${pullRequest.user?.login || "unknown"}`,
            `Branches: ${pullRequest.head?.ref || "unknown"} → ${pullRequest.base?.ref || "unknown"}`,
            `Commits: ${pullRequest.commits ?? "unknown"} · files changed: ${pullRequest.changed_files ?? "unknown"}`,
            `Changes: +${pullRequest.additions ?? "unknown"} / -${pullRequest.deletions ?? "unknown"}`,
            `Updated: ${pullRequest.updated_at ? new Date(pullRequest.updated_at).toLocaleString() : "unknown"}`,
            pullRequest.html_url,
          ].join("\n");
        }
      }
    } else if (command.name === "checks") {
      const number = pullNumber(command.args);
      if (!number) result = `Usage: ${definition.usage}`;
      else {
        const pullRequest = await getPullRequest(token, repository, number);
        if (!pullRequest) result = `Pull request #${number} was not found or is not accessible.`;
        else if (!pullRequest.head?.sha) result = `Checks for pull request #${number} are unavailable because its head commit could not be resolved.`;
        else {
          const checks = await getCommitChecks(token, repository, pullRequest.head.sha);
          result = withinMessageLimit(
            [`Checks for PR #${number}: ${pullRequest.title}`, `Commit: ${pullRequest.head.sha.slice(0, 7)}`],
            formatChecks(checks.checkRuns, checks.statuses),
          );
        }
      }
    } else if (command.name === "whoami") {
      if (command.args.length !== 0) result = `Usage: ${definition.usage}`;
      else {
        const user = await getAuthenticatedUser(token);
        result = [
          `${user.name || user.login} (@${user.login})`,
          user.html_url,
          `Repository: ${repository.full_name}`,
          `Permission: ${repositoryPermission(repository)}`,
        ].join("\n");
      }
    } else if (command.name === "status") {
      const [stats, pullRequests, latestCommit, recentlyMerged, contributors, workflowRuns, feedRows] = await Promise.all([
        getRepositoryStats(token, repository),
        getOpenPullRequests(token, repository),
        getLatestCommit(token, repository),
        getRecentlyMergedPullRequest(token, repository),
        getContributors(token, repository),
        getLatestWorkflowRuns(token, repository),
        getDb()`SELECT status, last_delivery_at AS "lastDeliveryAt" FROM webhook_subscriptions WHERE github_repo_id = ${repoId}`,
      ]);
      const workflowStatus = (name: string) => {
        const run = workflowRuns.filter((candidate) => candidate.name === name).sort((left, right) => (Date.parse(right.updated_at || "") || 0) - (Date.parse(left.updated_at || "") || 0))[0];
        if (!run) return "no runs";
        if (run.status === "queued" || run.status === "in_progress") return "running";
        return run.conclusion || run.status || "unknown";
      };
      const feed = feedRows[0];
      const commitMessage = latestCommit?.commit?.message?.split("\n")[0] || "No commits found";
      const commitAuthor = latestCommit?.commit?.author?.name || "Unknown author";
      const commitDate = latestCommit?.commit?.author?.date ? new Date(latestCommit.commit.author.date).toLocaleString() : "unknown time";
      const latestWorkflow = workflowRuns.slice().sort((left, right) => (Date.parse(right.updated_at || "") || 0) - (Date.parse(left.updated_at || "") || 0))[0];
      result = [
        `${stats.name}`,
        `Repository: ${stats.visibility} · ${stats.language} · default branch: ${stats.defaultBranch}`,
        `⭐ ${stats.stars} · forks ${stats.forks} · watchers ${stats.watchers} · open issues ${stats.openIssues}`,
        `Updated: ${stats.updatedAt ? new Date(stats.updatedAt).toLocaleString() : "unknown"}`,
        "",
        `Open PRs: ${pullRequests.length}`,
        `Recently merged: ${recentlyMerged ? `PR #${recentlyMerged.number} — ${recentlyMerged.title}` : "none"}`,
        `Latest commit: ${commitMessage} (${commitAuthor}, ${commitDate})`,
        `Contributors: ${contributors.length ? contributors.map((contributor) => `@${contributor}`).join(", ") : "none"}`,
        "",
        `Latest workflow: ${latestWorkflow?.name || "none"} · ${latestWorkflow ? workflowStatus(latestWorkflow.name || "") : "no runs"}`,
        `Trivy: ${workflowStatus("OpsBridge Trivy Security Scan")}`,
        `Semgrep: ${workflowStatus("OpsBridge Semgrep Security Scan")}`,
        `Activity feed: ${feed?.status || "not initialized"}${feed?.lastDeliveryAt ? ` · last delivery ${new Date(feed.lastDeliveryAt).toLocaleString()}` : ""}`,
      ].join("\n");
    }
    return NextResponse.json(await saveResult(repoId, result), { status: 201 });
  } catch (error) {
    return NextResponse.json(await saveResult(repoId, `Command failed: ${error instanceof Error ? error.message : "Unknown error"}`), { status: 201 });
  }
}
