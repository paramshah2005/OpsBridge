import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { decryptAccessToken, getSession } from "../../../lib/session";
import ChatRoom from "../../../components/ChatRoom";

export default async function ChatPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const cookieStore = await cookies();
  const session = await getSession(cookieStore);
  if (!session) redirect("/");
  const encryptedToken = cookieStore.get("github_access_token")?.value;
  const token = encryptedToken ? decryptAccessToken(encryptedToken) : null;
  let repoName = `Repository ${id}`;
  if (token) {
    const response = await fetch(`https://api.github.com/repositories/${id}`, { headers: { Authorization: `Bearer ${token}`, Accept: "application/vnd.github+json", "User-Agent": "OpsBridge" }, cache: "no-store" });
    if (response.ok) { const repo = await response.json() as { name?: string }; if (repo.name) repoName = repo.name; }
  }
  return <ChatRoom repoId={id} repoName={repoName} login={session.login} />;
}
