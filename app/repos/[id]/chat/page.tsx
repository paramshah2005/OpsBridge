import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getSession } from "../../../lib/session";
import ChatRoom from "../../../components/ChatRoom";

export default async function ChatPage({ params }: { params: { id: string } }) {
  const session = await getSession(cookies());
  if (!session) redirect("/");
  return (
    <ChatRoom
      repoId={params.id}
      repoName={`Repository ${params.id}`}
      login={session.login}
    />
  );
}
