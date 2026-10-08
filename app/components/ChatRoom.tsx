"use client";

import { useState } from "react";
import RaisePrModal from "./RaisePrModal";
import RepoStats from "./RepoStats";
import ActivityFeed from "./chatroom/ActivityFeed";
import DeploymentPanel from "./chatroom/DeploymentPanel";
import MessageComposer from "./chatroom/MessageComposer";
import MessageList from "./chatroom/MessageList";
import ScanPanel from "./chatroom/ScanPanel";
import { useActivityFeed } from "../hooks/useActivityFeed";
import { useDeployments } from "../hooks/useDeployments";
import { useMessages } from "../hooks/useMessages";
import { useRepositorySocket } from "../hooks/useRepositorySocket";
import { useScans } from "../hooks/useScans";

export default function ChatRoom({
  repoId,
  repoName,
  login,
}: {
  repoId: string;
  repoName: string;
  login: string;
}) {
  const [raisePrOpen, setRaisePrOpen] = useState(false);

  // ── Custom Hooks for State & Data-Fetching ─────────────────────────────────
  const {
    loading,
    sending,
    groupMessages,
    botMessages,
    activityStack,
    loadMessages,
    appendMessage,
    submitContent,
  } = useMessages(repoId);

  const { scans, applyWebSocketScan } = useScans(repoId);

  const { deployments, applyWebSocketDeployment } = useDeployments(repoId);

  const { feedStatus, feedBusy, enableFeed, disableFeed } = useActivityFeed(
    repoId,
    { onPoll: loadMessages }
  );

  const { connection } = useRepositorySocket(repoId, {
    onMessage: appendMessage,
    onScan: applyWebSocketScan,
    onDeployment: applyWebSocketDeployment,
  });

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <main className="chat-shell">
      <RaisePrModal
        repoId={repoId}
        open={raisePrOpen}
        onClose={() => setRaisePrOpen(false)}
        onSubmit={submitContent}
      />

      {/* Top navigation bar */}
      <nav className="topbar chat-topbar">
        <a className="brand" href="/repos">
          <span className="brand-mark">✦</span> OpsBridge
        </a>
        <a className="back-link" href="/repos">
          ← All repositories
        </a>
        <span className="chat-user">@{login}</span>
      </nav>

      <section className="workspace">
        {/* ── Left sidebar ── */}
        <aside className="chat-sidebar">
          <RepoStats repoId={repoId} />
          <ActivityFeed
            feedStatus={feedStatus}
            feedBusy={feedBusy}
            botMessages={botMessages}
            activityStack={activityStack}
            onEnable={enableFeed}
            onDisable={disableFeed}
          />
        </aside>

        {/* ── Centre: chat ── */}
        <section className="chat-main">
          <div className="chat-heading">
            <div>
              <p className="eyebrow dark-eyebrow">
                <span className="live-dot" /> GROUP CHAT
              </p>
              <h1>{repoName}</h1>
              <p>Talk with everyone working in this repository.</p>
            </div>
            <span className="connection">
              <span
                className={`live-dot ${
                  connection === "connected" ? "" : "offline-dot"
                }`}
              />
              {connection === "connected"
                ? "Realtime connected"
                : connection === "connecting"
                ? "Connecting…"
                : "Realtime offline"}
            </span>
          </div>

          <div className="message-panel">
            <MessageList
              messages={groupMessages}
              loading={loading}
              login={login}
            />
          </div>

          <MessageComposer
            sending={sending}
            onSubmit={submitContent}
            onRaisePrOpen={() => setRaisePrOpen(true)}
          />
        </section>

        {/* ── Right sidebar ── */}
        <aside
          className="scan-sidebar"
          aria-label="Security scan and deployment status"
        >
          <ScanPanel scans={scans} />
          <DeploymentPanel deployments={deployments} />
        </aside>
      </section>
    </main>
  );
}
