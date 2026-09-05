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
          <span className="pulse" /> REPOSITORY WORKSPACE
        </p>
        <h1>
          Ready to talk
          <br />
          <em>about your repo.</em>
        </h1>
        <p>
          Your persistent repository chat is ready. Messages are stored in Neon
          and scoped to this repository.
        </p>
        <a className="github-button" href={`/repos/${params.id}/chat`}>
          Open chatroom <span className="arrow">↗</span>
        </a>
      </section>
    </main>
  );
}
