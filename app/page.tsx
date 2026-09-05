import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getSession } from "./lib/session";
import Login from "./components/Login";

export default async function Home() {
  const session = await getSession(cookies());
  if (session) redirect("/repos");
  return <Login />;
}
