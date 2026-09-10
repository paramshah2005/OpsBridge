import { createHmac, timingSafeEqual } from "crypto";

type Payload = Record<string, unknown>;
export type NormalizedWebhookEvent = {
  action: string | null; actorLogin: string | null; pullRequestNumber: number | null;
  pullRequestTitle: string | null; branchName: string | null; commitCount: number | null;
  occurredAt: string | null; message: string | null;
};

function text(value: unknown) { return typeof value === "string" ? value : null; }
function number(value: unknown) { return typeof value === "number" && Number.isSafeInteger(value) ? value : null; }
function object(value: unknown) { return value && typeof value === "object" ? value as Payload : {}; }

export function hasValidWebhookSignature(rawBody: Buffer, signature: string | null) {
  const secret = process.env.GITHUB_WEBHOOK_SECRET;
  if (!secret || !signature?.startsWith("sha256=")) return false;
  const expected = `sha256=${createHmac("sha256", secret).update(rawBody).digest("hex")}`;
  const supplied = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expected);
  return supplied.length === expectedBuffer.length && timingSafeEqual(supplied, expectedBuffer);
}

export function normalizeWebhookEvent(eventName: string, payload: Payload): NormalizedWebhookEvent {
  const action = text(payload.action);
  const sender = object(payload.sender);
  const actorLogin = text(sender.login);
  const repository = object(payload.repository);
  const occurredAt = text(repository.updated_at) || text(payload.created_at);
  const pullRequest = object(payload.pull_request);
  const prNumber = number(payload.number);
  const prTitle = text(pullRequest.title);

  if (eventName === "pull_request" && action === "opened" && prNumber && actorLogin)
    return { action, actorLogin, pullRequestNumber: prNumber, pullRequestTitle: prTitle, branchName: null, commitCount: null, occurredAt, message: `Pull request #${prNumber} opened by @${actorLogin}${prTitle ? `: “${prTitle}”` : ""}` };
  if (eventName === "pull_request" && action === "closed" && prNumber) {
    const merged = pullRequest.merged === true;
    return { action, actorLogin, pullRequestNumber: prNumber, pullRequestTitle: prTitle, branchName: null, commitCount: null, occurredAt, message: merged ? `Pull request #${prNumber} merged${prTitle ? `: “${prTitle}”` : ""}` : `Pull request #${prNumber} closed without merging${prTitle ? `: “${prTitle}”` : ""}` };
  }
  if (eventName === "push") {
    const ref = text(payload.ref)?.replace(/^refs\/heads\//, "") || null;
    const commits = Array.isArray(payload.commits) ? payload.commits.length : 0;
    return { action, actorLogin: text(object(payload.pusher).name) || actorLogin, pullRequestNumber: null, pullRequestTitle: null, branchName: ref, commitCount: commits, occurredAt, message: `${commits} new commit${commits === 1 ? "" : "s"} pushed to ${ref || "a branch"}${actorLogin ? ` by @${actorLogin}` : ""}` };
  }
  if ((eventName === "create" || eventName === "delete") && text(payload.ref_type) === "branch") {
    const branchName = text(payload.ref);
    return { action, actorLogin, pullRequestNumber: null, pullRequestTitle: null, branchName, commitCount: null, occurredAt, message: `Branch ${branchName || ""} ${eventName === "create" ? "created" : "deleted"}${actorLogin ? ` by @${actorLogin}` : ""}` };
  }
  return { action, actorLogin, pullRequestNumber: prNumber, pullRequestTitle: prTitle, branchName: null, commitCount: null, occurredAt, message: null };
}
