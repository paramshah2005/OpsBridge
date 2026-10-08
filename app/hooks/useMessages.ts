"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Message } from "../components/chatroom/types";

function isCommandResult(message: Message) {
  if (message.messageType !== "system_message") return false;
  return (
    message.authorLogin === "opsbridge-command" ||
    message.authorLogin === "opsbridge-scan" ||
    message.content.startsWith("/") ||
    message.content.startsWith("Usage:") ||
    message.content.startsWith("Unknown command:") ||
    message.content.startsWith("Command failed:") ||
    message.content.startsWith("Pull request #") ||
    message.content.includes("scan dispatched on ")
  );
}

/**
 * useMessages
 *
 * Manages the repository's chat message list and message submission.
 *
 * - Fetches the full history on mount with a stale-request guard.
 * - Submits chat messages or slash-commands with error handling and loading state (`sending`).
 * - Provides `appendMessage` to insert real-time messages received via WebSocket.
 * - Exposes filtered and memoized subsets (`groupMessages`, `botMessages`, `activityStack`).
 */
export function useMessages(repoId: string) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);

  // Monotonically-increasing counter; persists across renders without causing
  // re-renders. Used to discard responses from superseded fetches.
  const loadIdRef = useRef(0);

  const loadMessages = useCallback(async () => {
    const loadId = ++loadIdRef.current;
    const response = await fetch(`/api/repos/${repoId}/messages`, {
      cache: "no-store",
    });
    if (!response.ok) throw new Error("Chat history could not be loaded.");
    const incoming = (await response.json()) as Message[];
    if (loadId !== loadIdRef.current) return; // stale — discard
    setMessages((current) => {
      const byId = new Map<number, Message>();
      for (const m of current) byId.set(m.id, m);
      for (const m of incoming) byId.set(m.id, m);
      return [...byId.values()].sort((a, b) => {
        const diff = Date.parse(a.createdAt) - Date.parse(b.createdAt);
        return diff || a.id - b.id;
      });
    });
  }, [repoId]);

  /** Insert a single message received via WebSocket or a POST response. */
  const appendMessage = useCallback((message: Message) => {
    setMessages((current) =>
      current.some((m) => m.id === message.id) ? current : [...current, message]
    );
  }, []);

  /**
   * Submit a user message or slash-command.
   * Throws on failure so the caller (e.g. MessageComposer) can display errors inline.
   */
  const submitContent = useCallback(
    async (value: string): Promise<void> => {
      const endpoint = value.startsWith("/") ? "commands" : "messages";
      setSending(true);
      try {
        const response = await fetch(`/api/repos/${repoId}/${endpoint}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ content: value }),
        });
        const message = (await response.json()) as Message & { error?: string };
        if (!response.ok) {
          throw new Error(message.error || "Message could not be sent.");
        }
        appendMessage(message);
        if (message.content?.startsWith("Command failed:")) {
          throw new Error(message.content.replace(/^Command failed:\s*/, ""));
        }
      } finally {
        setSending(false);
      }
    },
    [repoId, appendMessage]
  );

  // Initial load
  useEffect(() => {
    loadMessages()
      .catch((e: Error) => console.error(e.message))
      .finally(() => setLoading(false));
  }, [loadMessages]);

  // Derived memoized message sets
  const botMessages = useMemo(
    () =>
      messages.filter(
        (m) => m.messageType === "system_message" && !isCommandResult(m)
      ),
    [messages]
  );

  const activityStack = useMemo(
    () => botMessages.slice(-3).reverse(),
    [botMessages]
  );

  const groupMessages = useMemo(
    () =>
      messages.filter(
        (m) => m.messageType !== "system_message" || isCommandResult(m)
      ),
    [messages]
  );

  return {
    messages,
    loading,
    sending,
    botMessages,
    activityStack,
    groupMessages,
    loadMessages,
    appendMessage,
    submitContent,
  };
}
