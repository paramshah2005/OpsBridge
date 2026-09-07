"use client";

import { FormEvent, useCallback, useEffect, useRef, useState } from "react";

type Message = { id: number; authorLogin: string; content: string; createdAt: string };

export default function ChatRoom({ repoId, repoName, login }: { repoId: string; repoName: string; login: string }) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [content, setContent] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [connection, setConnection] = useState<"connecting" | "connected" | "offline">("connecting");
  const endRef = useRef<HTMLDivElement>(null);

  const loadMessages = useCallback(async () => {
    const response = await fetch(`/api/repos/${repoId}/messages`, { cache: "no-store" });
    if (!response.ok) throw new Error("Chat history could not be loaded.");
    setMessages(await response.json());
  }, [repoId]);

  useEffect(() => {
    loadMessages().catch((e) => setError(e.message)).finally(() => setLoading(false));
  }, [loadMessages]);

  useEffect(() => {
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const socket = new WebSocket(`${protocol}//${window.location.host}/api/ws`);
    socket.onopen = () => { setConnection("connected"); socket.send(JSON.stringify({ type: "join", repoId })); };
    socket.onmessage = (event) => {
      try {
        const payload = JSON.parse(event.data) as { type?: string; message?: Message };
        if (payload.type !== "message" || !payload.message) return;
        setMessages((current) => current.some((message) => message.id === payload.message!.id) ? current : [...current, payload.message!]);
      } catch { /* Ignore malformed socket frames. */ }
    };
    socket.onclose = () => setConnection("offline");
    socket.onerror = () => setConnection("offline");
    return () => socket.close();
  }, [repoId]);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  async function send(event: FormEvent) {
    event.preventDefault();
    const value = content.trim();
    if (!value || sending) return;
    setSending(true); setError("");
    try {
      const response = await fetch(`/api/repos/${repoId}/messages`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ content: value }) });
      const message = await response.json();
      if (!response.ok) throw new Error(message.error || "Message could not be sent.");
      setMessages((current) => current.some((item) => item.id === message.id) ? current : [...current, message]);
      setContent("");
    } catch (e) { setError(e instanceof Error ? e.message : "Message could not be sent."); }
    finally { setSending(false); }
  }

  return <main className="chat-shell"><nav className="topbar chat-topbar"><a className="brand" href="/repos"><span className="brand-mark">✦</span> OpsBridge</a><a className="back-link" href="/repos">← All repositories</a><span className="chat-user">@{login}</span></nav><section className="chat-main"><div className="chat-heading"><div><p className="eyebrow dark-eyebrow"><span className="live-dot" /> REPOSITORY CHAT</p><h1>{repoName}</h1><p>Private workspace · M2 chat shell</p></div><span className="connection"><span className={`live-dot ${connection === "connected" ? "" : "offline-dot"}`} /> {connection === "connected" ? "Realtime connected" : connection === "connecting" ? "Connecting…" : "Realtime offline"}</span></div><div className="message-panel">{loading ? <div className="chat-state">Loading chat history…</div> : messages.length === 0 ? <div className="chat-state"><span className="empty-symbol">✦</span><strong>No messages yet</strong><span>Start the conversation for this repository.</span></div> : messages.map((message) => <article className="message" key={message.id}><div className="message-avatar">{message.authorLogin[0]?.toUpperCase()}</div><div><div className="message-meta"><strong>@{message.authorLogin}</strong><time>{new Date(message.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</time></div><p>{message.content}</p></div></article>)}<div ref={endRef} /></div>{error && <p className="chat-error">{error}</p>}<form className="composer" onSubmit={send}><input value={content} onChange={(e) => setContent(e.target.value)} placeholder="Write a message…" maxLength={2000} disabled={sending} /><button type="submit" disabled={!content.trim() || sending}>{sending ? "Sending…" : "Send ↗"}</button></form><p className="chat-note">Messages are stored permanently in Neon and delivered over WebSocket.</p></section></main>;
}
