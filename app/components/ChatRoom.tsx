"use client";

import { FormEvent, useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { LuActivity, LuGitBranch, LuGitCommitVertical, LuGitPullRequest } from "react-icons/lu";

type Message = { id: number; authorLogin: string; content: string; createdAt: string; messageType?: "user_message" | "system_message" };
type FeedStatus = "loading" | "uninitialized" | "pending" | "active" | "failed" | "disabled";
const legacyActivityEmoji = /^[📦🔵🟣⚪🌱🗑️🤖↑⇄⑂]\s*/u;

function ActivityIcon({ content }: { content: string }) {
  const normalized = content.toLowerCase();
  if (normalized.includes("pull request")) return <LuGitPullRequest aria-hidden="true" size={17} strokeWidth={2} />;
  if (normalized.includes("commit") || normalized.includes("pushed")) return <LuGitCommitVertical aria-hidden="true" size={17} strokeWidth={2} />;
  if (normalized.includes("branch")) return <LuGitBranch aria-hidden="true" size={17} strokeWidth={2} />;
  return <LuActivity aria-hidden="true" size={17} strokeWidth={2} />;
}

export default function ChatRoom({ repoId, repoName, login }: { repoId: string; repoName: string; login: string }) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [content, setContent] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [connection, setConnection] = useState<"connecting" | "connected" | "offline">("connecting");
  const [feedStatus, setFeedStatus] = useState<FeedStatus>("loading");
  const [feedBusy, setFeedBusy] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);
  const botMessages = useMemo(() => messages.filter((message) => message.messageType === "system_message"), [messages]);
  const activityStack = useMemo(() => botMessages.slice(-3).reverse(), [botMessages]);
  const groupMessages = useMemo(() => messages.filter((message) => message.messageType !== "system_message"), [messages]);

  const loadMessages = useCallback(async () => {
    const response = await fetch(`/api/repos/${repoId}/messages`, { cache: "no-store" });
    if (!response.ok) throw new Error("Chat history could not be loaded.");
    setMessages(await response.json());
  }, [repoId]);

  useEffect(() => { loadMessages().catch((e) => setError(e.message)).finally(() => setLoading(false)); }, [loadMessages]);
  const refreshFeedStatus = useCallback(async () => {
    const response = await fetch(`/api/repos/${repoId}/webhook`, { cache: "no-store" });
    if (!response.ok) throw new Error("Activity feed status could not be loaded.");
    const data = await response.json() as { status: FeedStatus };
    setFeedStatus(data.status);
    return data.status;
  }, [repoId]);

  useEffect(() => {
    refreshFeedStatus().catch((e: Error) => { setFeedStatus("failed"); setError(e.message); });
  }, [refreshFeedStatus]);

  useEffect(() => {
    if (feedStatus !== "pending" && feedStatus !== "active") return;
    const interval = window.setInterval(() => {
      refreshFeedStatus().catch(() => undefined);
      loadMessages().catch(() => undefined);
    }, 15_000);
    return () => window.clearInterval(interval);
  }, [feedStatus, loadMessages, refreshFeedStatus]);
  useEffect(() => {
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const socket = new WebSocket(`${protocol}//${window.location.host}/api/ws`);
    socket.onopen = () => { setConnection("connected"); socket.send(JSON.stringify({ type: "join", repoId })); };
    socket.onmessage = (event) => {
      try {
        const payload = JSON.parse(event.data) as { type?: string; message?: Message };
        if (payload.type === "message" && payload.message) setMessages((current) => current.some((message) => message.id === payload.message!.id) ? current : [...current, payload.message!]);
      } catch { /* Ignore malformed frames. */ }
    };
    socket.onclose = () => setConnection("offline"); socket.onerror = () => setConnection("offline");
    return () => socket.close();
  }, [repoId]);
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  async function setFeed(method: "POST" | "DELETE") {
    if (feedBusy) return;
    setFeedBusy(true); setError("");
    try {
      const response = await fetch(`/api/repos/${repoId}/webhook`, { method });
      const data = await response.json() as { status?: FeedStatus; error?: string };
      if (!response.ok) throw new Error(data.error || "Activity feed could not be updated.");
      setFeedStatus(data.status || (method === "POST" ? "pending" : "disabled"));
    } catch (e) { setError(e instanceof Error ? e.message : "Activity feed could not be updated."); }
    finally { setFeedBusy(false); }
  }

  async function send(event: FormEvent) {
    event.preventDefault(); const value = content.trim(); if (!value || sending) return;
    setSending(true); setError("");
    try {
      const response = await fetch(`/api/repos/${repoId}/messages`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ content: value }) });
      const message = await response.json(); if (!response.ok) throw new Error(message.error || "Message could not be sent.");
      setMessages((current) => current.some((item) => item.id === message.id) ? current : [...current, message]); setContent("");
    } catch (e) { setError(e instanceof Error ? e.message : "Message could not be sent."); }
    finally { setSending(false); }
  }

  const canEnable = feedStatus === "uninitialized" || feedStatus === "disabled" || feedStatus === "failed";
  return <main className="chat-shell"><nav className="topbar chat-topbar"><a className="brand" href="/repos"><span className="brand-mark">✦</span> OpsBridge</a><a className="back-link" href="/repos">← All repositories</a><span className="chat-user">@{login}</span></nav><section className="workspace"><aside className="chat-sidebar"><div className="sidebar-repo"><span className="sidebar-kicker">REPOSITORY WORKSPACE</span><strong>{repoName}</strong></div><div className="sidebar-section"><span className="sidebar-label">CONVERSATIONS</span><div className="channel active"><span>#</span><div><strong>Group chat</strong><small>{groupMessages.length} messages</small></div></div></div><div className="sidebar-section activity-card"><div className="activity-title"><span>OB</span><div><strong>Activity feed</strong><small>{feedStatus === "active" ? "GitHub activity for this repository" : feedStatus === "pending" ? "Verifying the GitHub connection" : "Not initialized"}</small></div></div>{canEnable ? <><p>{feedStatus === "failed" ? "Initialization did not complete. Check the configuration and try again." : "Bring GitHub push, pull request, and branch activity into this workspace."}</p><button className="feed-action" onClick={() => setFeed("POST")} disabled={feedBusy}>{feedBusy ? "Initializing…" : feedStatus === "failed" ? "Try again" : "Initialize activity feed"}</button></> : feedStatus === "pending" ? <p className="bot-pending"><span className="spinner" /> Confirming the GitHub connection…</p> : feedStatus === "active" ? <><div className="bot-feed"><span className="sidebar-label">ACTIVITY · {botMessages.length}</span>{botMessages.length === 0 ? <p className="bot-empty">No activity has arrived yet.</p> : <div className="bot-stack" aria-live="polite">{activityStack.map((message, index) => <article className="bot-message" key={message.id} style={{ "--stack-offset": `${index * 48}px`, "--stack-scale": `${1 - index * 0.06}`, "--stack-opacity": `${1 - index * 0.16}` } as CSSProperties}><span className="bot-message-icon" aria-hidden="true"><ActivityIcon content={message.content} /></span><div className="bot-message-content"><p>{message.content.replace(legacyActivityEmoji, "")}</p><time>{new Date(message.createdAt).toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}</time></div></article>)}</div>}</div><button className="disable-feed" onClick={() => setFeed("DELETE")} disabled={feedBusy}>{feedBusy ? "Disabling…" : "Disable activity feed"}</button></> : null}</div></aside><section className="chat-main"><div className="chat-heading"><div><p className="eyebrow dark-eyebrow"><span className="live-dot" /> GROUP CHAT</p><h1>{repoName}</h1><p>Talk with everyone working in this repository.</p></div><span className="connection"><span className={`live-dot ${connection === "connected" ? "" : "offline-dot"}`} /> {connection === "connected" ? "Realtime connected" : connection === "connecting" ? "Connecting…" : "Realtime offline"}</span></div><div className="message-panel">{loading ? <div className="chat-state">Loading chat history…</div> : groupMessages.length === 0 ? <div className="chat-state"><span className="empty-symbol">#</span><strong>No group messages yet</strong><span>Start the conversation for this repository.</span></div> : groupMessages.map((message) => <article className="message" key={message.id}><div className="message-avatar">{message.authorLogin[0]?.toUpperCase()}</div><div><div className="message-meta"><strong>@{message.authorLogin}</strong><time>{new Date(message.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</time></div><p>{message.content}</p></div></article>)}<div ref={endRef} /></div>{error && <p className="chat-error">{error}</p>}<form className="composer" onSubmit={send}><input value={content} onChange={(e) => setContent(e.target.value)} placeholder="Write a message…" maxLength={2000} disabled={sending} /><button type="submit" disabled={!content.trim() || sending}>{sending ? "Sending…" : "Send ↗"}</button></form><p className="chat-note">Group chat messages are stored in Neon and delivered over WebSocket.</p></section></section></main>;
}
