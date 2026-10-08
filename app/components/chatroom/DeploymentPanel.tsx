import type { Deployment } from "./types";

function deploymentTime(value: string): string {
  const seconds = Math.max(
    0,
    Math.floor((Date.now() - Date.parse(value)) / 1000)
  );
  if (seconds < 60) return "just now";
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}

function DeploymentCard({ deployment }: { deployment: Deployment }) {
  return (
    <article className="deployment-card">
      <div className="deployment-heading">
        <div>
          <strong>{deployment.environment}</strong>
          <small>{deployment.ref || deployment.repository}</small>
        </div>
        <span className="deployment-status">Success</span>
      </div>
      <div className="deployment-meta">
        <span>
          {deployment.commitSha
            ? `#${deployment.commitSha.slice(0, 7)}`
            : "No commit"}
        </span>
        <time>{deploymentTime(deployment.occurredAt)}</time>
        {deployment.targetUrl && (
          <a href={deployment.targetUrl} target="_blank" rel="noreferrer">
            Open ↗
          </a>
        )}
      </div>
    </article>
  );
}

type Props = {
  deployments: Deployment[];
};

/**
 * DeploymentPanel
 *
 * Right-sidebar bottom section. Renders a card per successful Vercel
 * deployment. Stateless — receives deployment list from ChatRoom.
 */
export default function DeploymentPanel({ deployments }: Props) {
  return (
    <div className="scan-lower">
      <div className="deployment-panel-heading">
        <span className="sidebar-label">DEPLOYMENTS</span>
        <small>Vercel via GitHub Actions</small>
      </div>
      {deployments.length === 0 ? (
        <p className="deployment-empty">
          No successful deployments received yet.
        </p>
      ) : (
        <div className="deployment-list">
          {deployments.map((deployment) => (
            <DeploymentCard
              key={deployment.deploymentId}
              deployment={deployment}
            />
          ))}
        </div>
      )}
    </div>
  );
}
