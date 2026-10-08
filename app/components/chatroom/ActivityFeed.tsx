"use client";

import { type CSSProperties } from "react";
import {
  LuActivity,
  LuGitBranch,
  LuGitCommitVertical,
  LuGitPullRequest,
} from "react-icons/lu";
import type { FeedStatus, Message } from "./types";

// Strip legacy emoji prefixes that were added before the icon system existed.
const legacyActivityEmoji = /^[📦🔵🟣⚪🌱🗑️🤖↑⇄⑂]\s*/u;

function ActivityIcon({ content }: { content: string }) {
  const normalized = content.toLowerCase();
  if (normalized.includes("pull request"))
    return <LuGitPullRequest aria-hidden="true" size={17} strokeWidth={2} />;
  if (normalized.includes("commit") || normalized.includes("pushed"))
    return <LuGitCommitVertical aria-hidden="true" size={17} strokeWidth={2} />;
  if (normalized.includes("branch"))
    return <LuGitBranch aria-hidden="true" size={17} strokeWidth={2} />;
  return <LuActivity aria-hidden="true" size={17} strokeWidth={2} />;
}

type Props = {
  feedStatus: FeedStatus;
  feedBusy: boolean;
  /** All bot (system_message, non-command) messages — used for the count badge. */
  botMessages: Message[];
  /** The last 3 bot messages in reverse order, for the stacked card display. */
  activityStack: Message[];
  onEnable: () => void;
  onDisable: () => void;
};

/**
 * ActivityFeed
 *
 * Left-sidebar panel that shows GitHub activity bot messages in a stacked-card
 * UI. Handles its own enable / disable CTA display based on feedStatus.
 */
export default function ActivityFeed({
  feedStatus,
  feedBusy,
  botMessages,
  activityStack,
  onEnable,
  onDisable,
}: Props) {
  const canEnable =
    feedStatus === "uninitialized" ||
    feedStatus === "disabled" ||
    feedStatus === "failed";

  return (
    <div className="sidebar-section activity-card">
      <div className="activity-title">
        <span>OB</span>
        <div>
          <strong>Activity feed</strong>
          <small>
            {feedStatus === "active"
              ? "GitHub activity for this repository"
              : feedStatus === "pending"
              ? "Verifying the GitHub connection"
              : "Not initialized"}
          </small>
        </div>
      </div>

      {canEnable ? (
        <>
          <p>
            {feedStatus === "failed"
              ? "Initialization did not complete. Check the configuration and try again."
              : "Bring GitHub push, pull request, and branch activity into this workspace."}
          </p>
          <button
            className="feed-action"
            onClick={onEnable}
            disabled={feedBusy}
          >
            {feedBusy
              ? "Initializing…"
              : feedStatus === "failed"
              ? "Try again"
              : "Initialize activity feed"}
          </button>
        </>
      ) : feedStatus === "pending" ? (
        <p className="bot-pending">
          <span className="spinner" /> Confirming the GitHub connection…
        </p>
      ) : feedStatus === "active" ? (
        <>
          <div className="bot-feed">
            <span className="sidebar-label">
              ACTIVITY · {botMessages.length}
            </span>
            {botMessages.length === 0 ? (
              <p className="bot-empty">No activity has arrived yet.</p>
            ) : (
              <div className="bot-stack" aria-live="polite">
                {activityStack.map((message, index) => (
                  <article
                    className="bot-message"
                    key={message.id}
                    style={
                      {
                        "--stack-offset": `${index * 48}px`,
                        "--stack-scale": `${1 - index * 0.06}`,
                        "--stack-opacity": `${1 - index * 0.16}`,
                      } as CSSProperties
                    }
                  >
                    <span className="bot-message-icon" aria-hidden="true">
                      <ActivityIcon content={message.content} />
                    </span>
                    <div className="bot-message-content">
                      <p>{message.content.replace(legacyActivityEmoji, "")}</p>
                      <time>
                        {new Date(message.createdAt).toLocaleString([], {
                          month: "short",
                          day: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </time>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </div>
          <button
            className="disable-feed"
            onClick={onDisable}
            disabled={feedBusy}
          >
            {feedBusy ? "Disabling…" : "Disable activity feed"}
          </button>
        </>
      ) : null}
    </div>
  );
}
