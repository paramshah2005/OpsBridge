"use client";

import { useEffect, useRef, useState } from "react";
import type { Deployment, Message, Scan } from "../components/chatroom/types";

export type ConnectionStatus = "connecting" | "connected" | "offline";

export type SocketHandlers = {
  onMessage?: (message: Message) => void;
  onScan?: (scan: Scan) => void;
  onDeployment?: (deployment: Deployment) => void;
};

/**
 * useRepositorySocket
 *
 * Manages the real-time WebSocket connection for a repository.
 *
 * - Automatically connects on mount and joins the repo channel.
 * - Dispatches incoming messages, security scan updates, and deployment events
 *   to callback handlers without re-establishing connections on re-renders.
 * - Tracks connection status ('connecting' | 'connected' | 'offline').
 */
export function useRepositorySocket(
  repoId: string,
  handlers: SocketHandlers = {}
) {
  const [connection, setConnection] = useState<ConnectionStatus>("connecting");

  // Keep handlers fresh in a ref to prevent reconnecting the socket on every render
  const handlersRef = useRef(handlers);
  useEffect(() => {
    handlersRef.current = handlers;
  }, [handlers]);

  useEffect(() => {
    if (typeof window === "undefined") return;

    setConnection("connecting");
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const socket = new WebSocket(`${protocol}//${window.location.host}/api/ws`);

    socket.onopen = () => {
      setConnection("connected");
      socket.send(JSON.stringify({ type: "join", repoId }));
    };

    socket.onmessage = (event) => {
      try {
        const payload = JSON.parse(event.data) as {
          type?: string;
          message?: Message;
          scan?: Scan;
          deployment?: Deployment;
        };

        if (payload.type === "message" && payload.message) {
          handlersRef.current.onMessage?.(payload.message);
        }
        if (payload.type === "scan_status" && payload.scan) {
          handlersRef.current.onScan?.(payload.scan);
        }
        if (payload.type === "deployment_status" && payload.deployment) {
          handlersRef.current.onDeployment?.(payload.deployment);
        }
      } catch {
        /* Ignore malformed frames */
      }
    };

    socket.onclose = () => setConnection("offline");
    socket.onerror = () => setConnection("offline");

    return () => {
      socket.close();
    };
  }, [repoId]);

  return { connection };
}
