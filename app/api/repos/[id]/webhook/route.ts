import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getDb } from "../../../../lib/db";
import { decryptAccessToken, getSession } from "../../../../lib/session";
import { createRepositoryWebhook, deleteRepositoryWebhook, getGitHubRepository } from "../../../../lib/github";

type Params = { params: Promise<{ id: string }> };
const events = ["push", "pull_request", "create", "delete", "workflow_run"];

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
  try {
    const rows = await getDb()`SELECT status, github_hook_id AS "hookId", last_error AS "lastError", last_delivery_at AS "lastDeliveryAt" FROM webhook_subscriptions WHERE github_repo_id = ${current.repoId}`;
    return NextResponse.json(rows[0] || { status: "uninitialized" });
  } catch {
    return NextResponse.json({ error: "Unable to load activity-feed status." }, { status: 500 });
  }
}

export async function POST(request: Request, { params }: Params) {
  const current = await context(params);
  if ("error" in current) return current.error;
  if (!process.env.GITHUB_WEBHOOK_SECRET || !process.env.NEXT_PUBLIC_APP_URL)
    return NextResponse.json({ error: "Webhook configuration is incomplete." }, { status: 503 });
  if (current.repository.permissions?.admin !== true)
    return NextResponse.json({ error: "GitHub requires repository admin access to enable the activity feed." }, { status: 403 });
  try {
    const db = getDb();
    const existing = await db`SELECT status, github_hook_id AS "hookId" FROM webhook_subscriptions WHERE github_repo_id = ${current.repoId}`;
    if (existing[0]?.status === "active" || existing[0]?.status === "pending")
      return NextResponse.json({ status: existing[0].status, hookId: existing[0].hookId, alreadyEnabled: true });
    await db`INSERT INTO webhook_subscriptions (github_repo_id, repository_owner, repository_name, status, event_types, created_by_login, last_error, updated_at) VALUES (${current.repoId}, ${current.repository.owner.login}, ${current.repository.name}, 'pending', ${events}, ${current.session.login}, NULL, now()) ON CONFLICT (github_repo_id) DO UPDATE SET github_hook_id = NULL, repository_owner = EXCLUDED.repository_owner, repository_name = EXCLUDED.repository_name, status = 'pending', event_types = EXCLUDED.event_types, created_by_login = EXCLUDED.created_by_login, last_error = NULL, updated_at = now()`;
    const webhookUrl = `${process.env.NEXT_PUBLIC_APP_URL.replace(/\/$/, "")}/api/webhooks/github`;
    const hook = await createRepositoryWebhook(current.token, current.repository, { url: webhookUrl, secret: process.env.GITHUB_WEBHOOK_SECRET, events });
    await db`UPDATE webhook_subscriptions SET github_hook_id = ${hook.id}, updated_at = now() WHERE github_repo_id = ${current.repoId}`;
    return NextResponse.json({ status: "pending", hookId: hook.id }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to enable the activity feed.";
    try { await getDb()`UPDATE webhook_subscriptions SET status = 'failed', last_error = ${message}, updated_at = now() WHERE github_repo_id = ${current.repoId}`; } catch { /* Preserve the original GitHub error. */ }
    return NextResponse.json({ error: message }, { status: 502 });
  }
}

export async function DELETE(_: Request, { params }: Params) {
  const current = await context(params);
  if ("error" in current) return current.error;
  if (current.repository.permissions?.admin !== true)
    return NextResponse.json({ error: "GitHub requires repository admin access to disable the activity feed." }, { status: 403 });
  try {
    const db = getDb();
    const rows = await db`SELECT github_hook_id AS "hookId" FROM webhook_subscriptions WHERE github_repo_id = ${current.repoId}`;
    const hookId = rows[0]?.hookId as number | undefined;
    if (!hookId) return NextResponse.json({ status: "uninitialized" });
    await deleteRepositoryWebhook(current.token, current.repository, hookId);
    await db`UPDATE webhook_subscriptions SET status = 'disabled', updated_at = now() WHERE github_repo_id = ${current.repoId}`;
    return NextResponse.json({ status: "disabled" });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to disable the activity feed." }, { status: 502 });
  }
}
