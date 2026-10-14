"use client";

import { useEffect, useRef } from "react";
import type { Message } from "./types";

type Props = {
  messages: Message[];
  loading: boolean;
  login: string;
};

/**
 * MessageList
 *
 * Renders the scrollable list of group-chat messages (user messages and
 * command results). Handles the auto-scroll-to-bottom effect internally so
 * the parent never needs to manage a ref.
 */
export default function MessageList({ messages, loading, login }: Props) {
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const panel = endRef.current?.parentElement;
    if (!panel) return;

    const reduceMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;
    panel.scrollTo({
      top: panel.scrollHeight,
      behavior: reduceMotion ? "auto" : "smooth",
    });
  }, [messages]);

  if (loading) {
    return (
      <div className="message-loading" role="status">
        <span className="chat-sr-only">Loading chat history</span>
        {[0, 1, 2].map((item) => (
          <div className="message-skeleton" key={item} aria-hidden="true">
            <i />
            <span>
              <b />
              <b />
            </span>
          </div>
        ))}
      </div>
    );
  }

  if (messages.length === 0) {
    return (
      <div className="chat-state">
        <span className="empty-symbol">#</span>
        <strong>No group messages yet</strong>
        <span>Start the conversation for this repository.</span>
      </div>
    );
  }

  return (
    <>
      {messages.map((message) => {
        const isSelf = message.authorLogin === login;
        return (
          <article
            className={`message ${isSelf ? "message-self" : ""}`}
            key={message.id}
          >
            <div className="message-avatar">
              {message.authorLogin[0]?.toUpperCase()}
            </div>
            <div>
              <div className="message-meta">
                <strong>@{message.authorLogin}</strong>
                <time>
                  {new Date(message.createdAt).toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </time>
              </div>
              <p>{message.content}</p>
            </div>
          </article>
        );
      })}
      <div ref={endRef} />
    </>
  );
}
