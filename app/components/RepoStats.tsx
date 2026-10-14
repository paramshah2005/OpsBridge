"use client";
import { useEffect, useState } from "react";

type Stats = {
  activeBranches: number;
  openPrs: number;
  additions: number;
  deletions: number;
  statsPending: boolean;
  contributors: number;
  languages: string[];
};

function StatsHeader() {
  return (
    <div className="activity-title repo-stats-title">
      <span>RS</span>
      <div>
        <strong>Repository stats</strong>
        <small>Key metrics for this repository</small>
      </div>
    </div>
  );
}

export default function RepoStats({ repoId }: { repoId: string }) {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const response = await fetch(`/api/repos/${repoId}/stats`);
        if (!response.ok) throw new Error();
        const data = await response.json();
        setStats(data);
        setError(false);
      } catch {
        setError(true);
      } finally {
        setLoading(false);
      }
    };
    void fetchStats();
    const interval = window.setInterval(fetchStats, 60_000);
    return () => window.clearInterval(interval);
  }, [repoId]);

  if (loading) {
    return (
      <div className="repo-stats-container">
        <StatsHeader />
        <div className="stats-grid">
          <div className="stat-box skeleton" />
          <div className="stat-box skeleton" />
          <div className="stat-box skeleton" />
        </div>
      </div>
    );
  }

  if (error || !stats) {
    return (
      <div className="repo-stats-container repo-stats-error" role="status">
        <span className="sidebar-label">REPOSITORY STATS</span>
        <strong>Stats unavailable</strong>
        <small>The next refresh will retry automatically.</small>
      </div>
    );
  }

  return (
    <div className="repo-stats-container">
      <StatsHeader />
      <div className="stats-grid">
        <div className="stat-box">
          <span className="stat-value">{stats.activeBranches}</span>
          <span className="stat-label">Branches</span>
        </div>
        <div className="stat-box">
          <span className="stat-value">{stats.openPrs}</span>
          <span className="stat-label">Open PRs</span>
        </div>
        <div className="stat-box">
          <span className="stat-value">{stats.contributors}</span>
          <span className="stat-label">Contributors</span>
        </div>
      </div>
      <div className="stat-row">
        <span className="stat-label">Weekly Activity</span>
        {stats.statsPending ? (
          <span className="stats-generating">Stats generating…</span>
        ) : (
          <div className="code-freq">
            <span className="additions">+{stats.additions || 0}</span>
            <span className="deletions">-{stats.deletions || 0}</span>
          </div>
        )}
      </div>

      {stats.languages && stats.languages.length > 0 && (
        <div className="stat-row">
          <span className="stat-label">Top Languages</span>
          <div className="lang-tags">
            {stats.languages.map((lang) => (
              <span key={lang} className="lang-tag">
                {lang}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
