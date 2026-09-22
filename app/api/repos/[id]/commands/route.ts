import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createPullRequest, dispatchWorkflow, getBranches, getContributors, getGitHubRepository, getLatestCommit, getLatestWorkflowRuns, getOpenPullRequests, getRecentlyMergedPullRequest, getRepositoryStats } from "../../../../lib/github";
import { commandDefinitions, helpText, parseCommand } from "../../../../lib/commands";
import { broadcastToRoom } from "../../../../lib/realtime";
import { decryptAccessToken, getSession } from "../../../../lib/session";
import { getDb } from "../../../../lib/db";

type Params = { params: Promise<{ id: string }> };

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
