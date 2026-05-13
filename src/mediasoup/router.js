import { config } from "./config.js";
import { createWorkers, getWorker } from "./worker.js";

const rooms = new Map();
await createWorkers();
export async function createRoomWithWorker(roomId) {

  const worker = getWorker();

  const router = await worker.createRouter({
    mediaCodecs: config.mediasoup.router.mediaCodecs,
  });

  return createRoom(roomId, router);
}

export async function createRoom(roomId, router) {
  
  const room = createRoomAux(roomId, router);

  rooms.set(roomId,room);

  console.log(`📡 Room creada desde router: ${roomId}`);

  return room;
}

export function getRoom(roomId) {
  return rooms.get(roomId);
}

export function addPeerToRoom(roomId, socketId) {
  const room = rooms.get(roomId);
  if (!room) return;

    room.peers.set(socketId, {
      id: socketId,
      roomId,
      transports: [],
      producers: [],
      consumers: [],
      
    });
    console.log(`👤 Peer ${socketId} agregado a la sala ${roomId} desde router`);
}

export function getPeersInRoom(roomId) {
  const room = rooms.get(roomId);
  return room ? Array.from(room.peers.values()) : [];
}

export function getOnePeerInRoom(roomId, socketId) {
  const room = rooms.get(roomId);
  return room ? room.peers.get(socketId) : null;
}

export function removePeerFromRoom(roomId, socketId) {
  const room = rooms.get(roomId);
  if (!room) return;

  const peer = room.peers.get(socketId);
  if (!peer) return;

  // 🔴 Cerrar todo correctamente
  peer.transports.forEach(t => t.close());
  peer.producers.forEach(p => p.close());
  peer.consumers.forEach(c => c.close());

  room.peers.delete(socketId);

  console.log(`👋 Peer ${socketId} eliminado de la sala ${roomId}`);
}

export function getAllRooms() {
  return Array.from(rooms.values());
}

export function createRoomAux(roomId, router) {

  return {
    roomId,
    router,
    peers: new Map(),
    createdAt: Date.now(),
    activeProducerId: null
  };
}
