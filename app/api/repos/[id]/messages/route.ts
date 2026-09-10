import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getSession } from "../../../../lib/session";
import { getDb } from "../../../../lib/db";
import { broadcastToRoom } from "../../../../lib/realtime";

type Params = { params: Promise<{ id: string }> };

export async function GET(request: Request, { params }: Params) {
  if (!(await getSession(cookies()))) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const repoId = Number(id);
  if (!Number.isSafeInteger(repoId)) return NextResponse.json({ error: "Invalid repository" }, { status: 400 });
  try {
    const db = getDb();
    const rows = await db`SELECT id, github_repo_id AS "repoId", author_login AS "authorLogin", content, message_type AS "messageType", created_at AS "createdAt" FROM messages WHERE github_repo_id = ${repoId} ORDER BY created_at ASC LIMIT 200`;
    return NextResponse.json(rows);
  } catch (error) { console.error("Failed to load messages", error); return NextResponse.json({ error: "Unable to load chat history" }, { status: 500 }); }
}

export async function POST(request: Request, { params }: Params) {
  const session = await getSession(cookies());
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const repoId = Number(id);
  if (!Number.isSafeInteger(repoId)) return NextResponse.json({ error: "Invalid repository" }, { status: 400 });
  const body = await request.json().catch(() => null) as { content?: unknown } | null;
  const content = typeof body?.content === "string" ? body.content.trim() : "";
  if (!content || content.length > 2000) return NextResponse.json({ error: "Message must be between 1 and 2000 characters" }, { status: 400 });
  try {
    const db = getDb();
    const rows = await db`INSERT INTO messages (github_repo_id, author_login, content) VALUES (${repoId}, ${session.login}, ${content}) RETURNING id, github_repo_id AS "repoId", author_login AS "authorLogin", content, message_type AS "messageType", created_at AS "createdAt"`;
    broadcastToRoom(String(repoId), { type: "message", message: rows[0] });
    return NextResponse.json(rows[0], { status: 201 });
  } catch (error) { console.error("Failed to save message", error); return NextResponse.json({ error: "Unable to save message. Check your Neon schema and DATABASE_URL." }, { status: 500 }); }
}
