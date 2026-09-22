"use client";
import { useEffect, useMemo, useState } from "react";
type Repo = {
  id: number;
  name: string;
  fullName: string;
  description: string | null;
  private: boolean;
  language: string | null;
  stars: number;
  updatedAt: string;
  defaultBranch: string;
};
type Session = { login: string; name: string | null; avatarUrl: string };
export default function RepoPicker({ session }: { session: Session }) {
  const [repos, setRepos] = useState<Repo[]>([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  useEffect(() => {
    fetch("/api/repos")
      .then(async (r) => {
        if (!r.ok) throw new Error("We couldn't load your repositories.");
        return r.json();
      })
      .then(setRepos)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);
  const filtered = useMemo(
    () =>
      repos.filter((r) =>
        `${r.name} ${r.description || ""}`
          .toLowerCase()
          .includes(query.toLowerCase()),
      ),
    [repos, query],
  );
  return (
    <main className="app-shell">
      <nav className="topbar app-topbar">
        <a className="brand" href="/">
          <span className="brand-mark">✦</span> OpsBridge
        </a>
        <div className="user-menu">
          <img src={session.avatarUrl} alt="" />
          <span>@{session.login}</span>
          <form action="/api/auth/logout" method="post">
            <button className="logout">Sign out</button>
          </form>
        </div>
      </nav>
      <section className="repos-main">
        <div className="section-intro">
          <div>
            <p className="eyebrow dark-eyebrow">
              <span className="pulse" /> REPOSITORY PICKER
            </p>
            <h1>Your repositories.</h1>
            <p className="section-lede">
              Choose a repository to open its workspace.
            </p>
          </div>
          <div className="repo-count">
            <strong>{repos.length}</strong>
            <span>
              repositories
              <br />
              available
            </span>
          </div>
        </div>
        <div className="toolbar">
          <div className="search">
            <span>⌕</span>
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Filter repositories"
            />
          </div>
          <span className="live-label">
            <span className="live-dot" /> Live from GitHub
          </span>
        </div>
        {loading ? (
          <div className="state-card">
            <div className="spinner" />
            Fetching your repositories…
          </div>
        ) : error ? (
          <div className="state-card error-state">
            <strong>Couldn’t load repositories</strong>
            <span>{error}</span>
            <button onClick={() => location.reload()}>Try again</button>
            <a className="text-link" href="/api/auth/logout">Sign in again</a>
          </div>
        ) : filtered.length === 0 ? (
          <div className="state-card">
            <strong>No repositories found</strong>
            <span>Try a different search.</span>
          </div>
        ) : (
          <div className="repo-grid">
            {filtered.map((repo) => (
              <a className="repo-card" href={`/repos/${repo.id}/chat`} key={repo.id}>
                <div className="repo-card-top">
                  <span className="repo-symbol">◈</span>
                  <span className="visibility">
                    {repo.private ? "Private" : "Public"}
                  </span>
                  <span className="card-arrow">↗</span>
                </div>
                <h2>{repo.name}</h2>
                <p>{repo.description || "No description provided."}</p>
                <div className="repo-meta">
                  <span>{repo.language || "Code"}</span>
                  <span>★ {repo.stars}</span>
                  <span>
                    ↻{" "}
                    {new Date(repo.updatedAt).toLocaleDateString(undefined, {
                      month: "short",
                      day: "numeric",
                    })}
                  </span>
                </div>
              </a>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
