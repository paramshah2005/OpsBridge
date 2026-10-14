"use client";
import { JetBrains_Mono } from "next/font/google";
import { useEffect, useMemo, useState } from "react";
import {
  FiArrowUpRight,
  FiGlobe,
  FiLock,
  FiLogOut,
  FiRefreshCw,
  FiSearch,
} from "react-icons/fi";
import styles from "./RepoPicker.module.css";

const jetBrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

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

  const clearSearch = () => setQuery("");

  return (
    <main className={`${styles.shell} ${jetBrainsMono.className}`}>
      <header className={styles.header}>
        <a className={styles.wordmark} href="/" aria-label="OpsBridge home">
          OPSBRIDGE<span>.</span>
        </a>
        <p className={styles.headerContext}>
          <span>01</span> / Repository control plane
        </p>
        <div className={styles.userMenu}>
          <img src={session.avatarUrl} alt="" width="34" height="34" />
          <div>
            <small>Connected as</small>
            <strong>@{session.login}</strong>
          </div>
          <form action="/api/auth/logout" method="post">
            <button className={styles.logout} aria-label="Sign out of OpsBridge">
              <span>Sign out</span>
              <FiLogOut aria-hidden="true" />
            </button>
          </form>
        </div>
      </header>

      <section className={styles.workspace} aria-labelledby="repositories-title">
        <aside className={styles.intro}>
          <div>
            <p className={styles.sectionLabel}>01 / REPOSITORIES</p>
            <h1 id="repositories-title">Your repositories.</h1>
            <p className={styles.lede}>
              Choose a repository to open its live workspace.
            </p>
          </div>
          <div className={styles.repoCount} aria-live="polite">
            <strong>{loading ? "—" : String(repos.length).padStart(2, "0")}</strong>
            <span>
              repositories
              <br />
              available
            </span>
          </div>
        </aside>

        <div className={styles.directory} aria-busy={loading}>
          <div className={styles.toolbar}>
            <label className={styles.search} htmlFor="repository-search">
              <FiSearch aria-hidden="true" />
            <input
                id="repository-search"
                type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
                placeholder="Filter by name or description"
                autoComplete="off"
              />
            </label>
            <div className={styles.resultStatus} aria-live="polite">
              <span className={styles.liveDot} aria-hidden="true" />
              {loading
                ? "SYNCING WITH GITHUB"
                : query
                  ? `${filtered.length} OF ${repos.length} SHOWN`
                  : "LIVE FROM GITHUB"}
            </div>
          </div>

          {loading ? (
            <div className={styles.loadingState} role="status">
              <span className={styles.srOnly}>Fetching your repositories</span>
              {[0, 1, 2].map((item) => (
                <div className={styles.skeletonRow} key={item} aria-hidden="true">
                  <span />
                  <div><i /><i /></div>
                  <div><i /><i /></div>
                </div>
              ))}
            </div>
          ) : error ? (
            <div className={styles.statePanel} role="alert">
              <p>ERR / REPOSITORY SYNC</p>
              <h2>Couldn&apos;t load repositories.</h2>
              <span>{error}</span>
              <div className={styles.stateActions}>
                <button type="button" onClick={() => window.location.reload()}>
                  <FiRefreshCw aria-hidden="true" /> Try again
                </button>
                <a href="/api/auth/logout">Sign in again</a>
              </div>
            </div>
          ) : filtered.length === 0 ? (
            <div className={styles.statePanel}>
              <p>00 / NO RESULTS</p>
              <h2>{query ? "No matching repositories." : "No repositories available."}</h2>
              <span>
                {query
                  ? `Nothing matches “${query}”. Clear the filter to see every repository.`
                  : "Make sure the GitHub app has access to at least one repository."}
              </span>
              {query ? (
                <div className={styles.stateActions}>
                  <button type="button" onClick={clearSearch}>Clear filter</button>
                </div>
              ) : null}
            </div>
          ) : (
            <div className={styles.repoList}>
              <div className={styles.listHeader} aria-hidden="true">
                <span>INDEX</span>
                <span>REPOSITORY</span>
                <span>DETAILS</span>
                <span>OPEN</span>
              </div>
              {filtered.map((repo, index) => (
                <a className={styles.repoRow} href={`/repos/${repo.id}/chat`} key={repo.id}>
                  <span className={styles.rowIndex}>{String(index + 1).padStart(2, "0")}</span>
                  <div className={styles.repoIdentity}>
                    <span className={styles.visibility}>
                      {repo.private ? <FiLock aria-hidden="true" /> : <FiGlobe aria-hidden="true" />}
                      {repo.private ? "Private" : "Public"}
                    </span>
                    <h2>{repo.name}</h2>
                    <p>{repo.description || "No description provided."}</p>
                  </div>
                  <dl className={styles.repoMeta}>
                    <div>
                      <dt>Language</dt>
                      <dd>{repo.language || "Code"}</dd>
                    </div>
                    <div>
                      <dt>Stars</dt>
                      <dd>{repo.stars}</dd>
                    </div>
                    <div>
                      <dt>Updated</dt>
                      <dd>
                        {new Date(repo.updatedAt).toLocaleDateString(undefined, {
                          month: "short",
                          day: "numeric",
                        })}
                      </dd>
                    </div>
                  </dl>
                  <span className={styles.openArrow} aria-hidden="true">
                    <FiArrowUpRight />
                  </span>
                </a>
              ))}
            </div>
          )}
        </div>
      </section>
    </main>
  );
}
