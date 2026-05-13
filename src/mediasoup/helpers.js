
// Helpers
// export const getPeer = (socketId) => peers.get(socketId);
// export const getAllPeers = () => peers;
// export const addPeer = (socketId, data) => {
//     peers.set(socketId, {
//         id: socketId,
//         transports: [],
//         producers: [],
//         consumers: [],
//         ...data
//     });
// };

// export function createRoomAux(roomId, router) {
//   const room = {
//     roomId,
//     router,
//     peers: new Map(),
//     producers: [],
//     transports: [],
//     consumers: [],
//     createdAt: Date.now()
//   };
//   return room;
// }


export const removePeer = (socketId) => peers.delete(socketId);

export const addTransport = (socketId, transport) => {
    const peer = peers.get(socketId);
    if (peer) {
        peer.transports.push(transport);
    }
};

export const addProducer = (socketId, transport) => {
    const peer = peers.get(socketId);
    if (peer) {
        peer.producers.push(transport);
    }
};

export const addConsumer = (socketId, transport) => {
    const peer = peers.get(socketId);
    if (peer) {
        peer.consumers.push(transport);
    }
};
