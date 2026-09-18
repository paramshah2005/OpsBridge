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
      } catch (err) {
        setError(true);
      } finally {
        setLoading(false);
      }
    };
    fetchStats();
    
    // Poll every 60 seconds to keep stats fresh
    const interval = setInterval(fetchStats, 60000);
    return () => clearInterval(interval);
  }, [repoId]);

  if (loading) {
    return (
      <div className="repo-stats-container">
        <div className="activity-title" style={{ marginBottom: 16 }}>
          <span>RS</span>
          <div>
            <strong>Repository stats</strong>
            <small>Key metrics for this repository</small>
          </div>
        </div>
        <div className="stats-grid">
          <div className="stat-box skeleton"></div>
          <div className="stat-box skeleton"></div>
          <div className="stat-box skeleton"></div>
        </div>
      </div>
    );
  }

  if (error || !stats) return null;

  return (
    <div className="repo-stats-container">
      <div className="activity-title" style={{ marginBottom: 16 }}>
        <span>RS</span>
        <div>
          <strong>Repository stats</strong>
          <small>Key metrics for this repository</small>
        </div>
      </div>
      
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
              <span key={lang} className="lang-tag">{lang}</span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}