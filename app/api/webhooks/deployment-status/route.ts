import { NextResponse } from "next/server";
import { getDb } from "../../../lib/db";
import { broadcastToRoom } from "../../../lib/realtime";

export const runtime = "nodejs";

type DeploymentPayload = {
  event_type?: unknown;
  repository?: unknown;
  environment?: unknown;
  target_url?: unknown;
  deployment_id?: unknown;
  commit_sha?: unknown;
  ref?: unknown;
};

function stringValue(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

export async function POST(request: Request) {
  let payload: DeploymentPayload;
  try { payload = await request.json() as DeploymentPayload; }
  catch { return NextResponse.json({ error: "Invalid JSON payload" }, { status: 400 }); }

  const eventType = stringValue(payload.event_type);
  const repositoryName = stringValue(payload.repository);
  const deploymentId = stringValue(payload.deployment_id);
  const environment = stringValue(payload.environment) || "preview";
  const targetUrl = stringValue(payload.target_url);
  const commitSha = stringValue(payload.commit_sha);
  const refName = stringValue(payload.ref);
  if (eventType !== "deployment.success" || !repositoryName || !deploymentId)
    return NextResponse.json({ error: "Missing or invalid deployment fields" }, { status: 400 });

  const separator = repositoryName.indexOf("/");
  if (separator <= 0 || separator === repositoryName.length - 1)
    return NextResponse.json({ error: "Invalid repository name" }, { status: 400 });
  const owner = repositoryName.slice(0, separator);
  const name = repositoryName.slice(separator + 1);

  try {
    const db = getDb();
    const subscriptions = await db`SELECT github_repo_id AS "repoId" FROM webhook_subscriptions WHERE repository_owner = ${owner} AND repository_name = ${name} AND status != 'disabled'`;
    if (!subscriptions[0]) return NextResponse.json({ error: "Repository is not connected" }, { status: 404 });
    const repoId = subscriptions[0].repoId as number;
    const inserted = await db`INSERT INTO deployment_status_events (github_repo_id, deployment_id, status, repository_name, environment, target_url, commit_sha, ref_name, raw_payload) VALUES (${repoId}, ${deploymentId}, 'success', ${repositoryName}, ${environment}, ${targetUrl}, ${commitSha}, ${refName}, ${JSON.stringify(payload)}::jsonb) ON CONFLICT (github_repo_id, deployment_id) DO NOTHING RETURNING id`;
    if (!inserted[0]) return NextResponse.json({ ok: true, duplicate: true });

    const messageContent = `Vercel deployment succeeded\n${environment}${refName ? `\nBranch: ${refName}` : ""}${commitSha ? `\nCommit: ${commitSha.slice(0, 7)}` : ""}${targetUrl ? `\n${targetUrl}` : ""}`;
    const messages = await db`INSERT INTO messages (github_repo_id, author_login, content, message_type) VALUES (${repoId}, 'opsbridge-deploy', ${messageContent}, 'system_message') RETURNING id, github_repo_id AS "repoId", author_login AS "authorLogin", content, message_type AS "messageType", created_at AS "createdAt"`;
    const message = messages[0];
    await db`UPDATE deployment_status_events SET message_id = ${message.id} WHERE id = ${inserted[0].id}`;
    const occurredAt = new Date().toISOString();
    const deployment = { id: inserted[0].id, deploymentId, status: "success", repository: repositoryName, environment, targetUrl, commitSha, ref: refName, occurredAt };
    broadcastToRoom(String(repoId), { type: "deployment_status", deployment });
    broadcastToRoom(String(repoId), { type: "message", message });
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Failed to process deployment status", error);
    return NextResponse.json({ error: "Deployment status processing failed" }, { status: 500 });
  }
}
