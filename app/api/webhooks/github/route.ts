import { NextResponse } from "next/server";
import { getDb } from "../../../lib/db";
import { broadcastToRoom } from "../../../lib/realtime";
import { hasValidWebhookSignature, normalizeWebhookEvent } from "../../../lib/webhooks";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const rawBody = Buffer.from(await request.arrayBuffer());
  if (!hasValidWebhookSignature(rawBody, request.headers.get("x-hub-signature-256")))
    return NextResponse.json({ error: "Invalid webhook signature" }, { status: 401 });
  const deliveryId = request.headers.get("x-github-delivery");
  const eventName = request.headers.get("x-github-event");
  const hookId = Number(request.headers.get("x-github-hook-id"));
  if (!deliveryId || !eventName || !Number.isSafeInteger(hookId))
    return NextResponse.json({ error: "Missing GitHub webhook metadata" }, { status: 400 });
  let payload: Record<string, unknown>;
  try { payload = JSON.parse(rawBody.toString("utf8")) as Record<string, unknown>; }
  catch { return NextResponse.json({ error: "Invalid JSON payload" }, { status: 400 }); }
  const repository = payload.repository as { id?: unknown } | undefined;
  const repoId = typeof repository?.id === "number" ? repository.id : null;
  if (!repoId || !Number.isSafeInteger(repoId)) return NextResponse.json({ error: "Missing repository" }, { status: 400 });

  let eventId: number | null = null;
  try {
    const db = getDb();
    const subscriptions = await db`SELECT id FROM webhook_subscriptions WHERE github_repo_id = ${repoId} AND (github_hook_id = ${hookId} OR (github_hook_id IS NULL AND status = 'pending')) AND status != 'disabled'`;
    if (!subscriptions[0]) return NextResponse.json({ error: "Unknown webhook subscription" }, { status: 404 });
    const normalized = normalizeWebhookEvent(eventName, payload);
    const inserted = await db`INSERT INTO webhook_events (github_delivery_id, github_hook_id, github_repo_id, event_name, action, actor_login, pull_request_number, pull_request_title, branch_name, commit_count, occurred_at, raw_payload, processing_status) VALUES (${deliveryId}, ${hookId}, ${repoId}, ${eventName}, ${normalized.action}, ${normalized.actorLogin}, ${normalized.pullRequestNumber}, ${normalized.pullRequestTitle}, ${normalized.branchName}, ${normalized.commitCount}, ${normalized.occurredAt}, ${JSON.stringify(payload)}::jsonb, 'received') ON CONFLICT (github_delivery_id) DO UPDATE SET github_delivery_id = EXCLUDED.github_delivery_id RETURNING id, processing_status AS "processingStatus"`;
    eventId = inserted[0].id as number;
    if (inserted[0].processingStatus === "processed" || inserted[0].processingStatus === "ignored")
      return NextResponse.json({ ok: true, duplicate: true });
    await db`UPDATE webhook_subscriptions SET github_hook_id = ${hookId}, status = 'active', last_delivery_at = now(), updated_at = now() WHERE github_repo_id = ${repoId}`;
    if (normalized.workflowKey && normalized.workflowStatus) {
      broadcastToRoom(String(repoId), {
        type: "scan_status",
        scan: {
          key: normalized.workflowKey,
          name: normalized.workflowName,
          runId: normalized.workflowRunId,
          status: normalized.workflowStatus,
          branch: normalized.branchName,
          commit: normalized.workflowCommit ? normalized.workflowCommit.slice(0, 7) : null,
          updatedAt: normalized.occurredAt,
          url: normalized.workflowUrl,
        },
      });
    }
    if (!normalized.message) {
      await db`UPDATE webhook_events SET processing_status = 'ignored', processed_at = now(), processing_error = NULL WHERE id = ${eventId}`;
      return NextResponse.json({ ok: true, ignored: true });
    }
    const messages = await db`INSERT INTO messages (github_repo_id, author_login, content, message_type) VALUES (${repoId}, 'opsbridge-bot', ${normalized.message}, 'system_message') RETURNING id, github_repo_id AS "repoId", author_login AS "authorLogin", content, message_type AS "messageType", created_at AS "createdAt"`;
    const message = messages[0];
    await db`UPDATE webhook_events SET processing_status = 'processed', message_id = ${message.id}, processed_at = now(), processing_error = NULL WHERE id = ${eventId}`;
    broadcastToRoom(String(repoId), { type: "message", message });
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Failed to process GitHub webhook", error);
    if (eventId) {
      try { await getDb()`UPDATE webhook_events SET processing_status = 'failed', processing_error = ${error instanceof Error ? error.message : "Unknown processing error"} WHERE id = ${eventId}`; } catch { /* The HTTP failure will make GitHub retry. */ }
    }
    return NextResponse.json({ error: "Webhook processing failed" }, { status: 500 });
  }
}
