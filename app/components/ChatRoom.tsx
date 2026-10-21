"use client";

import { JetBrains_Mono } from "next/font/google";
import { useEffect, useState } from "react";
import { FiArrowLeft } from "react-icons/fi";
import RaisePrModal from "./RaisePrModal";
import MergePrModal from "./MergePrModal";
import DeletePrModal from "./DeletePrModal";
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

const jetBrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

function isMessagePanelGesture(event: Event) {
  return event
    .composedPath()
    .some(
      (target) =>
        target instanceof Element && target.classList.contains("message-panel")
    );
}

function useAutoHidingNavigation() {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const updateVisibility = (delta: number) => {
      if (Math.abs(delta) > 3) setVisible(delta < 0);
    };

    const handleWheel = (event: WheelEvent) => {
      if (!isMessagePanelGesture(event)) updateVisibility(event.deltaY);
    };

    let touchStartY = 0;
    let touchStartedInMessages = false;

    const handleTouchStart = (event: TouchEvent) => {
      touchStartY = event.touches[0]?.clientY ?? 0;
      touchStartedInMessages = isMessagePanelGesture(event);
    };

    const handleTouchMove = (event: TouchEvent) => {
      const currentY = event.touches[0]?.clientY ?? touchStartY;
      if (!touchStartedInMessages) updateVisibility(touchStartY - currentY);
      touchStartY = currentY;
    };

    const handleTouchEnd = () => {
      touchStartedInMessages = false;
    };

    window.addEventListener("wheel", handleWheel, { passive: true });
    window.addEventListener("touchstart", handleTouchStart, { passive: true });
    window.addEventListener("touchmove", handleTouchMove, { passive: true });
    window.addEventListener("touchend", handleTouchEnd, { passive: true });
    window.addEventListener("touchcancel", handleTouchEnd, { passive: true });

    return () => {
      window.removeEventListener("wheel", handleWheel);
      window.removeEventListener("touchstart", handleTouchStart);
      window.removeEventListener("touchmove", handleTouchMove);
      window.removeEventListener("touchend", handleTouchEnd);
      window.removeEventListener("touchcancel", handleTouchEnd);
    };
  }, []);

  return { visible, reveal: () => setVisible(true) };
}

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
  const [mergePrOpen, setMergePrOpen] = useState(false);
  const [deletePrOpen, setDeletePrOpen] = useState(false);
  const navigation = useAutoHidingNavigation();

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
    <main
      className={`chat-shell ${jetBrainsMono.className}${
        navigation.visible ? "" : " nav-collapsed"
      }`}
    >
      <RaisePrModal
        repoId={repoId}
        open={raisePrOpen}
        onClose={() => setRaisePrOpen(false)}
        onSubmit={submitContent}
      />
      <MergePrModal
        repoId={repoId}
        open={mergePrOpen}
        onClose={() => setMergePrOpen(false)}
        onSubmit={submitContent}
      />
      <DeletePrModal
        repoId={repoId}
        open={deletePrOpen}
        onClose={() => setDeletePrOpen(false)}
        onSubmit={submitContent}
      />

      <header
        className={navigation.visible ? "chat-topbar" : "chat-topbar nav-hidden"}
        onFocus={navigation.reveal}
      >
        <a className="chat-wordmark" href="/repos" aria-label="OpsBridge repositories">
          OPSBRIDGE<span>.</span>
        </a>
        <a className="chat-breadcrumb" href="/repos">
          <FiArrowLeft aria-hidden="true" />
          <span>All repositories</span>
        </a>
        <div className="chat-session">
          <small>Repository workspace</small>
          <strong>@{login}</strong>
        </div>
      </header>

      <section className="workspace">
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

        <section className="chat-main">
          <div className="chat-heading">
            <div>
              <p className="chat-section-label">02 / GROUP CHAT</p>
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
            onMergeOpen={() => setMergePrOpen(true)}
            onDeletePrOpen={() => setDeletePrOpen(true)}
          />
        </section>

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
