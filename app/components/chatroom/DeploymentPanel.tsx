"use client";

import { useState } from "react";
import { FaAws } from "react-icons/fa";
import { SiRender, SiVercel } from "react-icons/si";
import { TbBrandAzure } from "react-icons/tb";
import type { Deployment } from "./types";

type DeploymentProvider = "vercel" | "render" | "aws" | "azure";

const providers: Array<{
  key: DeploymentProvider;
  label: string;
  icon: typeof SiVercel;
}> = [
  { key: "vercel", label: "Vercel", icon: SiVercel },
  { key: "render", label: "Render", icon: SiRender },
  { key: "aws", label: "AWS", icon: FaAws },
  { key: "azure", label: "Azure", icon: TbBrandAzure },
];

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
 * Right-sidebar bottom section. Switches between deployment providers and
 * renders a card per successful Vercel deployment.
 */
export default function DeploymentPanel({ deployments }: Props) {
  const [provider, setProvider] = useState<DeploymentProvider>("vercel");
  const selectedProvider = providers.find((item) => item.key === provider)!;

  return (
    <div className="scan-lower">
      <div className="deployment-panel-heading">
        <span className="sidebar-label">DEPLOYMENTS</span>
        <small>Cloud providers</small>
      </div>

      <div className="deployment-provider-tabs" aria-label="Deployment providers">
        {providers.map((item) => {
          const Icon = item.icon;
          const selected = item.key === provider;
          return (
            <button
              type="button"
              className={`deployment-provider-tab provider-${item.key}`}
              aria-pressed={selected}
              aria-label={selected ? undefined : item.label}
              key={item.key}
              onClick={() => setProvider(item.key)}
            >
              <Icon aria-hidden="true" />
              <span>{item.label}</span>
            </button>
          );
        })}
      </div>

      {provider === "vercel" ? (
        <div className="deployment-provider-content">
          <p className="deployment-provider-caption">Vercel via GitHub Actions</p>
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
      ) : (
        <div className="deployment-coming-soon" role="status">
          <selectedProvider.icon aria-hidden="true" />
          <strong>{selectedProvider.label} support</strong>
          <span>Deployment updates will appear here in the future.</span>
        </div>
      )}
    </div>
  );
}
