"use client";

import { FormEvent, useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { LuActivity, LuGitBranch, LuGitCommitVertical, LuGitPullRequest } from "react-icons/lu";
import { commandDefinitions } from "../lib/commands";
import RepoStats from "./RepoStats";

type Message = { id: number; authorLogin: string; content: string; createdAt: string; messageType?: "user_message" | "system_message" };
type FeedStatus = "loading" | "uninitialized" | "pending" | "active" | "failed" | "disabled";
type ScanStatus = "idle" | "running" | "completed" | "failed";
type ScanKey = "semgrep" | "trivy";
type Scan = { key: ScanKey; name: string; runId: number | null; status: ScanStatus; branch: string | null; commit: string | null; updatedAt: string | null; url: string | null };
type Deployment = { id: number; deploymentId: string; status: "success"; repository: string; environment: string; targetUrl: string | null; commitSha: string | null; ref: string | null; occurredAt: string };

const workflowNames: Record<ScanKey, string> = { semgrep: "OpsBridge Semgrep Security Scan", trivy: "OpsBridge Trivy Security Scan" };
const emptyScans: Scan[] = (Object.entries(workflowNames) as [ScanKey, string][]).map(([key, name]) => ({ key, name, runId: null, status: "idle", branch: null, commit: null, updatedAt: null, url: null }));
const legacyActivityEmoji = /^[📦🔵🟣⚪🌱🗑️🤖↑⇄⑂]\s*/u;

function isCommandResult(message: Message) {
  if (message.messageType !== "system_message") return false;
  return message.authorLogin === "opsbridge-command"
    || message.content.startsWith("/")
    || message.content.startsWith("Usage:")
    || message.content.startsWith("Unknown command:")
    || message.content.startsWith("Command failed:")
    || message.content.startsWith("Pull request #")
    || message.content.includes("scan dispatched on ");
}

function ActivityIcon({ content }: { content: string }) {
  const normalized = content.toLowerCase();
  if (normalized.includes("pull request")) return <LuGitPullRequest aria-hidden="true" size={17} strokeWidth={2} />;
  if (normalized.includes("commit") || normalized.includes("pushed")) return <LuGitCommitVertical aria-hidden="true" size={17} strokeWidth={2} />;
  if (normalized.includes("branch")) return <LuGitBranch aria-hidden="true" size={17} strokeWidth={2} />;
  return <LuActivity aria-hidden="true" size={17} strokeWidth={2} />;
}

function ScanCard({ scan }: { scan: Scan }) {
  return <article className={`scan-card scan-${scan.status}`}><div className="scan-card-heading"><span className="scan-symbol">{scan.key === "semgrep" ? "S" : "T"}</span><div><strong>{scan.key === "semgrep" ? "Semgrep" : "Trivy"}</strong><small>Security scan</small></div><span className="scan-status">{scan.status}</span></div><div className="scan-meta"><span>{scan.branch || "No run yet"}</span><span>{scan.commit ? `#${scan.commit}` : "—"}</span></div></article>;
}

function deploymentTime(value: string) {
  const seconds = Math.max(0, Math.floor((Date.now() - Date.parse(value)) / 1000));
  if (seconds < 60) return "just now";
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}

function DeploymentCard({ deployment }: { deployment: Deployment }) {
  return <article className="deployment-card"><div className="deployment-heading"><div><strong>{deployment.environment}</strong><small>{deployment.ref || deployment.repository}</small></div><span className="deployment-status">Success</span></div><div className="deployment-meta"><span>{deployment.commitSha ? `#${deployment.commitSha.slice(0, 7)}` : "No commit"}</span><time>{deploymentTime(deployment.occurredAt)}</time>{deployment.targetUrl && <a href={deployment.targetUrl} target="_blank" rel="noreferrer">Open ↗</a>}</div></article>;
}

export default function ChatRoom({ repoId, repoName, login }: { repoId: string; repoName: string; login: string }) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [scans, setScans] = useState<Scan[]>(emptyScans);
  const [deployments, setDeployments] = useState<Deployment[]>([]);
  const [content, setContent] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [connection, setConnection] = useState<"connecting" | "connected" | "offline">("connecting");
  const [feedStatus, setFeedStatus] = useState<FeedStatus>("loading");
  const [feedBusy, setFeedBusy] = useState(false);
  const [commandMenuOpen, setCommandMenuOpen] = useState(false);
  const [commandIndex, setCommandIndex] = useState(0);
  const endRef = useRef<HTMLDivElement>(null);
  const messageLoadId = useRef(0);
  const botMessages = useMemo(() => messages.filter((message) => message.messageType === "system_message" && !isCommandResult(message)), [messages]);
  const activityStack = useMemo(() => botMessages.slice(-3).reverse(), [botMessages]);
  const groupMessages = useMemo(() => messages.filter((message) => message.messageType !== "system_message" || isCommandResult(message)), [messages]);

  function mergeDeployment(incoming: Deployment) {
    setDeployments((current) => {
      const existing = current.find((item) => item.deploymentId === incoming.deploymentId);
      if (existing && Date.parse(incoming.occurredAt) < Date.parse(existing.occurredAt)) return current;
      return [...current.filter((item) => item.deploymentId !== incoming.deploymentId), incoming]
        .sort((left, right) => Date.parse(right.occurredAt) - Date.parse(left.occurredAt))
        .slice(0, 3);
    });
  }

  function mergeDeployments(incoming: Deployment[]) {
    setDeployments((current) => {
      const byId = new Map(current.map((item) => [item.deploymentId, item]));
      for (const deployment of incoming) {
        const existing = byId.get(deployment.deploymentId);
        if (!existing || Date.parse(deployment.occurredAt) >= Date.parse(existing.occurredAt)) byId.set(deployment.deploymentId, deployment);
      }
      return [...byId.values()].sort((left, right) => Date.parse(right.occurredAt) - Date.parse(left.occurredAt)).slice(0, 3);
    });
  }

  function isNewerScan(incoming: Scan, current: Scan) {
    if (incoming.key !== current.key) return false;
    if (incoming.runId !== null && current.runId === incoming.runId) {
      return (Date.parse(incoming.updatedAt || "") || 0) >= (Date.parse(current.updatedAt || "") || 0);
    }
    if (incoming.runId !== null && current.runId === null) return true;
    return (Date.parse(incoming.updatedAt || "") || 0) > (Date.parse(current.updatedAt || "") || 0);
  }

  const loadMessages = useCallback(async () => {
    const loadId = ++messageLoadId.current;
    const response = await fetch(`/api/repos/${repoId}/messages`, { cache: "no-store" });
    if (!response.ok) throw new Error("Chat history could not be loaded.");
    const incoming = await response.json() as Message[];
    if (loadId !== messageLoadId.current) return;
    setMessages((current) => {
      const byId = new Map<number, Message>();
      for (const message of current) byId.set(message.id, message);
      for (const message of incoming) byId.set(message.id, message);
      return [...byId.values()].sort((left, right) => {
        const timeDifference = Date.parse(left.createdAt) - Date.parse(right.createdAt);
        return timeDifference || left.id - right.id;
      });
    });
  }, [repoId]);
  const loadScans = useCallback(async () => { const response = await fetch(`/api/repos/${repoId}/scans`, { cache: "no-store" }); if (!response.ok) return; const data = await response.json() as { scans?: Scan[] }; if (data.scans) setScans((current) => current.map((scan) => { const incoming = data.scans!.find((candidate) => candidate.key === scan.key); return incoming && isNewerScan(incoming, scan) ? incoming : scan; })); }, [repoId]);
  const loadDeployments = useCallback(async () => { const response = await fetch(`/api/repos/${repoId}/deployments`, { cache: "no-store" }); if (!response.ok) return; const data = await response.json() as { deployments?: Deployment[] }; mergeDeployments(data.deployments || []); }, [repoId]);
  useEffect(() => { loadMessages().catch((e) => setError(e.message)).finally(() => setLoading(false)); }, [loadMessages]);
  useEffect(() => { loadScans().catch(() => undefined); }, [loadScans]);
  useEffect(() => { loadDeployments().catch(() => undefined); }, [loadDeployments]);
  useEffect(() => { const interval = window.setInterval(() => { loadDeployments().catch(() => undefined); }, 15_000); return () => window.clearInterval(interval); }, [loadDeployments]);

  const refreshFeedStatus = useCallback(async () => { const response = await fetch(`/api/repos/${repoId}/webhook`, { cache: "no-store" }); if (!response.ok) throw new Error("Activity feed status could not be loaded."); const data = await response.json() as { status: FeedStatus }; setFeedStatus(data.status); return data.status; }, [repoId]);
  useEffect(() => { refreshFeedStatus().catch((e: Error) => { setFeedStatus("failed"); setError(e.message); }); }, [refreshFeedStatus]);
  useEffect(() => { if (feedStatus !== "pending" && feedStatus !== "active") return; const interval = window.setInterval(() => { refreshFeedStatus().catch(() => undefined); loadMessages().catch(() => undefined); }, 15_000); return () => window.clearInterval(interval); }, [feedStatus, loadMessages, refreshFeedStatus]);

  useEffect(() => {
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const socket = new WebSocket(`${protocol}//${window.location.host}/api/ws`);
    socket.onopen = () => { setConnection("connected"); socket.send(JSON.stringify({ type: "join", repoId })); };
    socket.onmessage = (event) => { try { const payload = JSON.parse(event.data) as { type?: string; message?: Message; scan?: Scan; deployment?: Deployment }; if (payload.type === "message" && payload.message) setMessages((current) => current.some((message) => message.id === payload.message!.id) ? current : [...current, payload.message!]); if (payload.type === "scan_status" && payload.scan) setScans((current) => current.map((scan) => isNewerScan(payload.scan!, scan) ? payload.scan! : scan)); if (payload.type === "deployment_status" && payload.deployment) mergeDeployment(payload.deployment); } catch { /* Ignore malformed frames. */ } };
    socket.onclose = () => setConnection("offline"); socket.onerror = () => setConnection("offline");
    return () => socket.close();
  }, [repoId]);
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  async function setFeed(method: "POST" | "DELETE") { if (feedBusy) return; setFeedBusy(true); setError(""); try { const response = await fetch(`/api/repos/${repoId}/webhook`, { method }); const data = await response.json() as { status?: FeedStatus; error?: string }; if (!response.ok) throw new Error(data.error || "Activity feed could not be updated."); setFeedStatus(data.status || (method === "POST" ? "pending" : "disabled")); } catch (e) { setError(e instanceof Error ? e.message : "Activity feed could not be updated."); } finally { setFeedBusy(false); } }
  async function send(event: FormEvent) { event.preventDefault(); const value = content.trim(); if (!value || sending) return; setSending(true); setError(""); try { const endpoint = value.startsWith("/") ? "commands" : "messages"; const response = await fetch(`/api/repos/${repoId}/${endpoint}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ content: value }) }); const message = await response.json(); if (!response.ok) throw new Error(message.error || "Message could not be sent."); setMessages((current) => current.some((item) => item.id === message.id) ? current : [...current, message]); setContent(""); setCommandMenuOpen(false); } catch (e) { setError(e instanceof Error ? e.message : "Message could not be sent."); } finally { setSending(false); } }

  const commandQuery = content.startsWith("/") ? content.slice(1).split(/\s/)[0].toLowerCase() : "";
  const commandMatches = commandDefinitions.filter((command) => command.name.startsWith(commandQuery));
  function selectCommand(name: string) { const command = commandDefinitions.find((item) => item.name === name); if (!command) return; setContent(`${command.usage} `); setCommandMenuOpen(false); }

  const canEnable = feedStatus === "uninitialized" || feedStatus === "disabled" || feedStatus === "failed";
  return <main className="chat-shell"><nav className="topbar chat-topbar"><a className="brand" href="/repos"><span className="brand-mark">✦</span> OpsBridge</a><a className="back-link" href="/repos">← All repositories</a><span className="chat-user">@{login}</span></nav><section className="workspace"><aside className="chat-sidebar"><RepoStats repoId={repoId} /><div className="sidebar-section activity-card"><div className="activity-title"><span>OB</span><div><strong>Activity feed</strong><small>{feedStatus === "active" ? "GitHub activity for this repository" : feedStatus === "pending" ? "Verifying the GitHub connection" : "Not initialized"}</small></div></div>{canEnable ? <><p>{feedStatus === "failed" ? "Initialization did not complete. Check the configuration and try again." : "Bring GitHub push, pull request, and branch activity into this workspace."}</p><button className="feed-action" onClick={() => setFeed("POST")} disabled={feedBusy}>{feedBusy ? "Initializing…" : feedStatus === "failed" ? "Try again" : "Initialize activity feed"}</button></> : feedStatus === "pending" ? <p className="bot-pending"><span className="spinner" /> Confirming the GitHub connection…</p> : feedStatus === "active" ? <><div className="bot-feed"><span className="sidebar-label">ACTIVITY · {botMessages.length}</span>{botMessages.length === 0 ? <p className="bot-empty">No activity has arrived yet.</p> : <div className="bot-stack" aria-live="polite">{activityStack.map((message, index) => <article className="bot-message" key={message.id} style={{ "--stack-offset": `${index * 48}px`, "--stack-scale": `${1 - index * 0.06}`, "--stack-opacity": `${1 - index * 0.16}` } as CSSProperties}><span className="bot-message-icon" aria-hidden="true"><ActivityIcon content={message.content} /></span><div className="bot-message-content"><p>{message.content.replace(legacyActivityEmoji, "")}</p><time>{new Date(message.createdAt).toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}</time></div></article>)}</div>}</div><button className="disable-feed" onClick={() => setFeed("DELETE")} disabled={feedBusy}>{feedBusy ? "Disabling…" : "Disable activity feed"}</button></> : null}</div></aside><section className="chat-main"><div className="chat-heading"><div><p className="eyebrow dark-eyebrow"><span className="live-dot" /> GROUP CHAT</p><h1>{repoName}</h1><p>Talk with everyone working in this repository.</p></div><span className="connection"><span className={`live-dot ${connection === "connected" ? "" : "offline-dot"}`} /> {connection === "connected" ? "Realtime connected" : connection === "connecting" ? "Connecting…" : "Realtime offline"}</span></div><div className="message-panel">{loading ? <div className="chat-state">Loading chat history…</div> : groupMessages.length === 0 ? <div className="chat-state"><span className="empty-symbol">#</span><strong>No group messages yet</strong><span>Start the conversation for this repository.</span></div> : groupMessages.map((message) => {
  const isSelf = message.authorLogin === login;
  return <article className={`message ${isSelf ? "message-self" : ""}`} key={message.id}><div className="message-avatar">{message.authorLogin[0]?.toUpperCase()}</div><div><div className="message-meta"><strong>@{message.authorLogin}</strong><time>{new Date(message.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</time></div><p>{message.content}</p></div></article>;
})}<div ref={endRef} /></div>{error && <p className="chat-error">{error}</p>}<form className="composer" style={{ position: "relative" }} onSubmit={send}>{commandMenuOpen && commandMatches.length > 0 && <div role="listbox" style={{ position: "absolute", bottom: "calc(100% + 8px)", left: 0, right: 74, background: "#fff", border: "1px solid #ccd3ca", zIndex: 3 }}>{commandMatches.map((command, index) => <button type="button" key={command.name} onMouseDown={(event) => { event.preventDefault(); selectCommand(command.name); }} style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 4, width: "100%", padding: "11px 14px", border: 0, borderBottom: "1px solid #edf0ea", background: index === commandIndex ? "#eff4e8" : "#fff", color: "#263025", textAlign: "left", cursor: "pointer" }}><strong style={{ font: "12px DM Mono" }}>{command.usage}</strong><span style={{ font: "11px DM Sans", color: "#798279" }}>{command.description}</span></button>)}</div>}<input value={content} onChange={(e) => { const value = e.target.value; setContent(value); setCommandMenuOpen(value.startsWith("/") && !value.includes(" ")); setCommandIndex(0); }} onKeyDown={(event) => { if (!commandMenuOpen || commandMatches.length === 0) return; if (event.key === "ArrowDown") { event.preventDefault(); setCommandIndex((index) => (index + 1) % commandMatches.length); } else if (event.key === "ArrowUp") { event.preventDefault(); setCommandIndex((index) => (index - 1 + commandMatches.length) % commandMatches.length); } else if (event.key === "Enter" && commandMatches[commandIndex]) { event.preventDefault(); selectCommand(commandMatches[commandIndex].name); } else if (event.key === "Escape") setCommandMenuOpen(false); }} placeholder="Write a message…" maxLength={2000} disabled={sending} /><button type="submit" disabled={!content.trim() || sending}>{sending ? "Sending…" : "Send ↗"}</button></form></section><aside className="scan-sidebar" aria-label="Security scan and deployment status"><div className="scan-upper"><div className="scan-panel-heading"><span className="sidebar-label">SECURITY SCANS</span><small>GitHub Actions</small></div><div className="scan-list">{scans.map((scan) => <ScanCard key={scan.key} scan={scan} />)}</div></div><div className="scan-lower"><div className="deployment-panel-heading"><span className="sidebar-label">DEPLOYMENTS</span><small>Vercel via GitHub Actions</small></div>{deployments.length === 0 ? <p className="deployment-empty">No successful deployments received yet.</p> : <div className="deployment-list">{deployments.map((deployment) => <DeploymentCard key={deployment.deploymentId} deployment={deployment} />)}</div>}</div></aside></section></main>;
}
