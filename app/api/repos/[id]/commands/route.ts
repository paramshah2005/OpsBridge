import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createPullRequest, dispatchWorkflow, getGitHubRepository, getRepositoryStats } from "../../../../lib/github";
import { commandDefinitions, helpText, parseCommand } from "../../../../lib/commands";
import { broadcastToRoom } from "../../../../lib/realtime";
import { decryptAccessToken, getSession } from "../../../../lib/session";
import { getDb } from "../../../../lib/db";

type Params = { params: Promise<{ id: string }> };

async function saveResult(repoId: number, content: string) {
  const rows = await getDb()`INSERT INTO messages (github_repo_id, author_login, content, message_type) VALUES (${repoId}, 'opsbridge-bot', ${content}, 'system_message') RETURNING id, github_repo_id AS "repoId", author_login AS "authorLogin", content, message_type AS "messageType", created_at AS "createdAt"`;
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
  if (!definition) {
    const message = await saveResult(repoId, `Unknown command: /${command.name}. Try /help.`);
    return NextResponse.json(message, { status: 201 });
  }

  const encryptedToken = (await cookies()).get("github_access_token")?.value;
  const token = encryptedToken ? decryptAccessToken(encryptedToken) : null;
  if (!token) return NextResponse.json({ error: "GitHub session expired. Please sign in again." }, { status: 401 });

  try {
    const repository = await getGitHubRepository(token, repoId);
    if (!repository) return NextResponse.json({ error: "Repository not found or unavailable." }, { status: 404 });

    let result = "";
    if (command.name === "help") {
      result = helpText();
    } else if (command.name === "rerun-trivy-scan" || command.name === "rerun-semgrep") {
      const workflow = command.name === "rerun-trivy-scan" ? "opsbridge-trivy.yml" : "opsbridge-semgrep.yml";
      await dispatchWorkflow(token, repository, workflow);
      result = `${workflow.includes("trivy") ? "Trivy" : "Semgrep"} scan dispatched on ${repository.default_branch || "main"}.`;
    } else if (command.name === "raise-pr") {
      if (command.args.length !== 3) {
        result = `Usage: ${definition.usage}`;
      } else {
        const pullRequest = await createPullRequest(token, repository, command.args[0], command.args[1], command.args[2]);
        result = `Pull request #${pullRequest.number} created: ${pullRequest.title}\n${pullRequest.html_url}`;
      }
    } else if (command.name === "status") {
      const stats = await getRepositoryStats(token, repository);
      result = `${stats.name}\n${stats.visibility} · ${stats.language}\n⭐ ${stats.stars} · forks ${stats.forks} · open issues ${stats.openIssues}\nDefault branch: ${stats.defaultBranch}`;
    }

    const message = await saveResult(repoId, result);
    return NextResponse.json(message, { status: 201 });
  } catch (error) {
    const message = await saveResult(repoId, `Command failed: ${error instanceof Error ? error.message : "Unknown error"}`);
    return NextResponse.json(message, { status: 201 });
  }
}
