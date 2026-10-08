"use client";

import { useCallback, useEffect, useState } from "react";
import type { FeedStatus } from "../components/chatroom/types";

export type UseActivityFeedOptions = {
  /** Optional callback to trigger alongside feed status refresh (e.g. reload messages) */
  onPoll?: () => void;
};

/**
 * useActivityFeed
 *
 * Manages webhook subscription state for the GitHub activity feed.
 *
 * - Fetches initial webhook status on mount.
 * - Automatically polls every 15s when the feed is pending or active.
 * - Exposes methods to toggle (POST to enable, DELETE to disable) the webhook feed.
 */
export function useActivityFeed(
  repoId: string,
  options?: UseActivityFeedOptions
) {
  const [feedStatus, setFeedStatus] = useState<FeedStatus>("loading");
  const [feedBusy, setFeedBusy] = useState(false);

  const refreshFeedStatus = useCallback(async () => {
    const response = await fetch(`/api/repos/${repoId}/webhook`, {
      cache: "no-store",
    });
    if (!response.ok) {
      throw new Error("Activity feed status could not be loaded.");
    }
    const data = (await response.json()) as { status: FeedStatus };
    setFeedStatus(data.status);
    return data.status;
  }, [repoId]);

  // Initial load
  useEffect(() => {
    refreshFeedStatus().catch((e: Error) => {
      setFeedStatus("failed");
      console.error(e.message);
    });
  }, [refreshFeedStatus]);

  // Polling when pending or active (every 15 s)
  useEffect(() => {
    if (feedStatus !== "pending" && feedStatus !== "active") return;
    const interval = window.setInterval(() => {
      refreshFeedStatus().catch(() => undefined);
      options?.onPoll?.();
    }, 15_000);
    return () => window.clearInterval(interval);
  }, [feedStatus, refreshFeedStatus, options]);

  const toggleFeed = useCallback(
    async (method: "POST" | "DELETE") => {
      if (feedBusy) return;
      setFeedBusy(true);
      try {
        const response = await fetch(`/api/repos/${repoId}/webhook`, { method });
        const data = (await response.json()) as {
          status?: FeedStatus;
          error?: string;
        };
        if (!response.ok) {
          throw new Error(data.error || "Activity feed could not be updated.");
        }
        setFeedStatus(
          data.status || (method === "POST" ? "pending" : "disabled")
        );
      } catch (e) {
        console.error(
          e instanceof Error ? e.message : "Activity feed could not be updated."
        );
      } finally {
        setFeedBusy(false);
      }
    },
    [repoId, feedBusy]
  );

  return {
    feedStatus,
    feedBusy,
    refreshFeedStatus,
    toggleFeed,
    enableFeed: () => toggleFeed("POST"),
    disableFeed: () => toggleFeed("DELETE"),
  };
}
