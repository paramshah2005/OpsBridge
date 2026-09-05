import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { getSession } from "../../lib/session";
export default async function RepoPreview({
  params,
}: {
  params: { id: string };
}) {
  if (!(await getSession(cookies()))) redirect("/");
  return (
    <main className="app-shell">
      <nav className="topbar app-topbar">
        <a className="brand" href="/repos">
          <span className="brand-mark">✦</span> OpsBridge
        </a>
        <a className="back-link" href="/repos">
          ← All repositories
        </a>
      </nav>
      <section className="coming">
        <p className="eyebrow">
          <span className="pulse" /> WORKSPACE PREVIEW
        </p>
        <h1>
          Repo connected.
          <br />
          <em>Chat arrives in M2.</em>
        </h1>
        <p>
          This repository is ready for the next milestone. The live GitHub repo
          picker is working end to end.
        </p>
        <a className="text-link" href="/repos">
          Return to repositories ↗
        </a>
      </section>
    </main>
  );
}
