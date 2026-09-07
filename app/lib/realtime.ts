export type RoomSocket = { send: (data: string) => void };

const state = globalThis as typeof globalThis & { __opsbridgeRooms?: Map<string, Set<RoomSocket>> };
const rooms = state.__opsbridgeRooms ?? new Map<string, Set<RoomSocket>>();
state.__opsbridgeRooms = rooms;

export function joinRoom(repoId: string, socket: RoomSocket) { const room = rooms.get(repoId) ?? new Set<RoomSocket>(); room.add(socket); rooms.set(repoId, room); }
export function leaveRoom(repoId: string, socket: RoomSocket) { const room = rooms.get(repoId); if (!room) return; room.delete(socket); if (room.size === 0) rooms.delete(repoId); }
export function broadcastToRoom(repoId: string, event: unknown) { const room = rooms.get(repoId); if (!room) return; const payload = JSON.stringify(event); for (const socket of Array.from(room)) { try { socket.send(payload); } catch { room.delete(socket); } } }
