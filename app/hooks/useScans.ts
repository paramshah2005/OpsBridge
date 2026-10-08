"use client";

import { useCallback, useEffect, useState } from "react";
import type { Scan, ScanKey } from "../components/chatroom/types";

const workflowNames: Record<ScanKey, string> = {
  semgrep: "OpsBridge Semgrep Security Scan",
  trivy: "OpsBridge Trivy Security Scan",
};

const emptyScans: Scan[] = (
  Object.entries(workflowNames) as [ScanKey, string][]
).map(([key, name]) => ({
  key,
  name,
  runId: null,
  status: "idle",
  branch: null,
  commit: null,
  updatedAt: null,
  url: null,
}));

function isNewerScan(incoming: Scan, current: Scan): boolean {
  if (incoming.key !== current.key) return false;
  if (incoming.runId !== null && current.runId === incoming.runId) {
    return (
      (Date.parse(incoming.updatedAt || "") || 0) >=
      (Date.parse(current.updatedAt || "") || 0)
    );
  }
  if (incoming.runId !== null && current.runId === null) return true;
  return (
    (Date.parse(incoming.updatedAt || "") || 0) >
    (Date.parse(current.updatedAt || "") || 0)
  );
}

/**
 * useScans
 *
 * Manages the Trivy + Semgrep scan state for a repository.
 *
 * - Fetches the latest scan statuses on mount.
 * - `applyWebSocketScan` is called by the WebSocket handler when a
 *   `scan_status` frame arrives, keeping the sidebar live without polling.
 */
export function useScans(repoId: string) {
  const [scans, setScans] = useState<Scan[]>(emptyScans);

  const applyScan = useCallback((incoming: Scan) => {
    setScans((current) =>
      current.map((scan) => (isNewerScan(incoming, scan) ? incoming : scan))
    );
  }, []);

  const loadScans = useCallback(async () => {
    const response = await fetch(`/api/repos/${repoId}/scans`, {
      cache: "no-store",
    });
    if (!response.ok) return;
    const data = (await response.json()) as { scans?: Scan[] };
    if (data.scans) {
      setScans((current) =>
        current.map((scan) => {
          const incoming = data.scans!.find((c) => c.key === scan.key);
          return incoming && isNewerScan(incoming, scan) ? incoming : scan;
        })
      );
    }
  }, [repoId]);

  // Initial load
  useEffect(() => {
    loadScans().catch(() => undefined);
  }, [loadScans]);

  return { scans, loadScans, applyWebSocketScan: applyScan };
}
