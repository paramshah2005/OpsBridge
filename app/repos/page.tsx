import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getSession } from "../lib/session";
import RepoPicker from "../components/RepoPicker";

export default async function ReposPage() {
  const session = await getSession(cookies());
  if (!session) redirect("/");
  return <RepoPicker session={session} />;
}
