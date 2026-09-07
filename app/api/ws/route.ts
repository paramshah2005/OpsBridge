import { experimental_upgradeWebSocket, type WebSocketData } from "@vercel/functions";
import { joinRoom, leaveRoom, type RoomSocket } from "../../lib/realtime";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function GET() {
  return experimental_upgradeWebSocket((ws) => {
    let repoId: string | null = null;
    const socket = ws as unknown as RoomSocket;
    const cleanup = () => { if (repoId) leaveRoom(repoId, socket); };

    ws.on("message", (data: WebSocketData) => {
      try {
        const event = JSON.parse(data.toString()) as { type?: string; repoId?: string };
        if (event.type !== "join" || !event.repoId) return;
        if (repoId) leaveRoom(repoId, socket);
        repoId = event.repoId;
        joinRoom(repoId, socket);
        ws.send(JSON.stringify({ type: "ready", repoId }));
      } catch { /* Ignore malformed frames. */ }
    });
    ws.on("close", cleanup);
    ws.on("error", cleanup);
  });
}
