"use client";

import { useCallback, useEffect, useState } from "react";
import type { Deployment } from "../components/chatroom/types";

const DEPLOYMENT_HISTORY_LIMIT = 3;

function latestDeployments(deployments: Deployment[]) {
  return [...deployments]
    .sort((a, b) => Date.parse(b.occurredAt) - Date.parse(a.occurredAt))
    .slice(0, DEPLOYMENT_HISTORY_LIMIT);
}

/**
 * useDeployments
 *
 * Manages the deployment history and polling for a repository.
 *
 * - Fetches initial deployments on mount.
 * - Polls every 15 seconds to keep deployment status up to date.
 * - Provides `applyWebSocketDeployment` to immediately merge deployment events
 *   received over the repository WebSocket.
 */
export function useDeployments(repoId: string) {
  const [deployments, setDeployments] = useState<Deployment[]>([]);

  const applyDeployment = useCallback((incoming: Deployment) => {
    setDeployments((current) => {
      const existing = current.find(
        (item) => item.deploymentId === incoming.deploymentId
      );
      if (
        existing &&
        Date.parse(incoming.occurredAt) < Date.parse(existing.occurredAt)
      ) {
        return current;
      }
      return latestDeployments([
        ...current.filter((item) => item.deploymentId !== incoming.deploymentId),
        incoming,
      ]);
    });
  }, []);

  const mergeDeployments = useCallback((incoming: Deployment[]) => {
    setDeployments((current) => {
      const byId = new Map(current.map((item) => [item.deploymentId, item]));
      for (const deployment of incoming) {
        const existing = byId.get(deployment.deploymentId);
        if (
          !existing ||
          Date.parse(deployment.occurredAt) >= Date.parse(existing.occurredAt)
        ) {
          byId.set(deployment.deploymentId, deployment);
        }
      }
      return latestDeployments([...byId.values()]);
    });
  }, []);

  const loadDeployments = useCallback(async () => {
    const response = await fetch(`/api/repos/${repoId}/deployments`, {
      cache: "no-store",
    });
    if (!response.ok) return;
    const data = (await response.json()) as { deployments?: Deployment[] };
    mergeDeployments(data.deployments || []);
  }, [repoId, mergeDeployments]);

  // Initial fetch
  useEffect(() => {
    loadDeployments().catch(() => undefined);
  }, [loadDeployments]);

  // Polling every 15 s
  useEffect(() => {
    const interval = window.setInterval(
      () => loadDeployments().catch(() => undefined),
      15_000
    );
    return () => window.clearInterval(interval);
  }, [loadDeployments]);

  return {
    deployments,
    loadDeployments,
    applyWebSocketDeployment: applyDeployment,
  };
}
