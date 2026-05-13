//una funcion que se esta exportando para ser usada en otro
//archivo, y crea el servidor socket.io en tiempo real

import { normalizeModuleId } from "vite/module-runner";
import { createRoomWithWorker  } from "./mediasoup/router.js";
import { createRoom, getRoom , addPeerToRoom, getOnePeerInRoom, getPeersInRoom, removePeerFromRoom } from "./mediasoup/router.js";
import { createWebRtcTransport } from "./mediasoup/transport.js";
import { Server } from "socket.io";
// import { registerSocketHandlers } from ".   /socketHandlers.js";

export default (httpServer) => {
    const io = new Server(httpServer, {
        cors: {
            origin: 'https://localhost:5173',
            methods: ['GET', 'POST'],
            credentials: true
        }
    });

    let connectedUsers = [];
    const ADMIN_EMAIL = "admin";
    let administrador = "";
    let userIdentifier;
    const transports = new Map();

    // Configuración de Socket.IO con CORS
    io.on("connection", socket => {

        const cookieString = socket.handshake.headers.cookie || ""; 

        const getCookie = (name) => {  
            const value = `; ${cookieString}`;
            const parts = value.split(`; ${name}=`);
            if (parts.length === 2) return parts.pop().split(';').shift();
            return null;
        };

        const sessionCookie = getCookie('session');

        if (sessionCookie) {
            try {
            // 1. Decodificar caracteres especiales (como %22 para comillas)
            const decodedSession = decodeURIComponent(sessionCookie);
            // 2. Parsear el string JSON a objeto JS
            const sessionData = JSON.parse(decodedSession);
            
            // Usamos el email como identificador en la lista
            userIdentifier = sessionData.email;

            // console.log("🔐 Socket autenticado:", socket.id, userIdentifier);

            if (!userIdentifier) return;

            if (userIdentifier && !connectedUsers.includes(userIdentifier)) {
                connectedUsers.push(userIdentifier);
                // io.emit("updateConnectedUsers", connectedUsers);
                console.log("lista de conectados",connectedUsers)
            }
            } catch (e) {
                console.error("Error al parsear la cookie session en Socket:", e.message);
            }
            console.log("Usuarios conectados actualmente:", connectedUsers);
        }

        if (userIdentifier != '') {
    
            socket.emit("updatedUser", userIdentifier );

            // Manejar la desconexión
            socket.on("disconnect", () => {
                connectedUsers = connectedUsers.filter(id => id !== userIdentifier);
                console.log("Usuario desconectado:", userIdentifier);
                io.emit("updateConnectedUsers", connectedUsers); // ⬅️ importante
                console.log("lista de conectados", connectedUsers);
            });

            socket.on("wordUser", ({ user, action}) =>{
                if (!global.currentAskUsers){ //si no hay usuarios solicitando, array en blanco
                    global.currentAskUsers = []
                }
                if (action === 'add'){
                    if(!global.currentAskUsers.includes(user)){
                        global.currentAskUsers.push(user)
                    }
                
                }else if (action === 'remove'){
                    global.currentAskUsers = global.currentAskUsers.filter(u => u !== user);
                }

                io.emit("wordUser", global.currentAskUsers);
                console.log("wordUser:", global.currentAskUsers);
            });
            
            // ================= ENVIO DEL DECISION A CLIENTES ===================
            socket.on("send-decision", text => {
                socket.broadcast.emit("receive-decision", text );
            });
            
            // ================= ENVIO DE VOTOS A CLIENTES =================
            //enviar el mensaje y el usuario
            socket.on("message", (data) => {
                socket.broadcast.emit("message", data);
            });

            // ===================== ACTUALIZAR USE EFFECT SOLICITUDES REALIZADAS =======
            socket.on("request-update", (userId, roomId, status, timeStamp) => {
                socket.broadcast.emit("request-update", (userId, roomId, status, timeStamp));
            });

            socket.on("request-update-cancel", (userId, status, timeStamp) => {
                socket.broadcast.emit("request-update", (userId, status, timeStamp));
            });

            // ===================== ENVIA APROBACION PARA EMITIR =======
            socket.on("approve", (userId) => {
                socket.broadcast.emit("approve", (userId));
            });

            //============== ENVIA SOLICITUD PARA UNIRSE AL STREAM
            socket.on("admin-ready", () =>{
                console.log("transmisión del admin");
                socket.broadcast.emit("stream-ready");
            });

            socket.on("user-ready", (userId, roomId) =>{
                console.log("transmisión del user",userId, roomId);
                socket.broadcast.emit("stream-ready-user",userId, roomId);
            });

            socket.on("request-stream", ({ userId, roomId }) =>{
                socket.broadcast.emit("listen-user",{ userId, roomId });
            });

            socket.on("approval-notification", ({ userId, roomId }) =>{
                console.log("notificación de aprobación para unirse al stream",userId, roomId);
                socket.broadcast.emit("approved", { userId, roomId });
            });

            socket.on("cancel-notification", ({ userId, roomId }) =>{
                console.log("notificación de cancelacion para unirse al stream",userId, roomId);
                socket.broadcast.emit("canceled", { userId, roomId });
            });
        };

        registerSocketHandlers(socket,io);
    });

    function registerSocketHandlers(socket, io) {

        // ================= ENVIO DEL CRONOMETRO A CLIENTES ===================
        // Escuchar el inicio del cronómetro
        socket.on('start-cronometer', ({ time })  => {

            io.emit('start-cronometer', { 
                time 

            });
            console.log("cronometro iniciado", time);
        });

        // Escuchar las actualizaciones del cronómetro
        socket.on('update-cronometer', data => {
            io.emit('update-cronometer', data);
        });

        socket.on('end-cronometer', () => {
            io.emit('end-cronometer');
        });

        socket.on('ocultar', data => {
            socket.broadcast.emit('ocultar', data);
        });

        socket.on('signal', data => {
            // Retransmitir señal a todos excepto al emisor
            socket.broadcast.emit('signal', data);
            });

        socket.on('send-votes', data => {
            socket.broadcast.emit('send-votes', data);
            });

        socket.on("disconnect", () => {
            console.log("🔴 Usuario desconectado:", socket.id);
        });
        
        //===========SFU==============
       
        // 🔹 Unirse a la sala
        socket.on("join-room", async ({ roomId, userId:email }, callback) => {
            console.log("📥 joinRoom:", socket.id, "sala:", roomId /*, "userId", userId*/);

            console.log("📡 Evento desde:", socket.id);
            
            let room = getRoom(roomId); //busca en router.js
            if (!room) {
                room = await createRoomWithWorker(roomId); // lo crea usando router.js
                console.log("🏠 Sala creada:", roomId);
            }

            addPeerToRoom(roomId, socket.id); //lo agrega a la sala usando router.js

            socket.join(roomId);
            socket.roomId = roomId;
            // socket.userId = userId; //aca es donde guarda el socket

            // ✅ Verificar que el peer se guardó correctamente
            const savedPeer = getOnePeerInRoom(roomId, socket.id);
            console.log("✅ Peer guardado:", socket.id, savedPeer?.roomId);

            // Devolver las capacidades del router para que el cliente cargue su device
            callback({
                rtpCapabilities: room.router.rtpCapabilities
            });
        });

        // 🔹 Crear transport (WebRTC)
        socket.on("createTransport", async ({ consumer, roomId }, callback) => {
            const room = await getRoom(roomId);
            const peer = await getOnePeerInRoom(roomId, socket.id);

            if (!peer) {
                console.error("❌ Peer no existe");
                return callback({ error: "Peer no registrado" });
            }

            if (!room) {
                console.error("❌ Sala no existe");
                return callback({ error: "Sala no existe" });
            }

            try {
                const transport = await createWebRtcTransport(room.router);

                // ¡CRUCIAL! Guarda el transport en una estructura accesible
                transports.set(transport.id, transport);

                // Opcional: Guardar info extra para limpieza posterior
                transport.on("routerclose", () => transports.delete(transport.id));
                transport.on("close", () => transports.delete(transport.id));

                // 🔥 CLAVE: distinguir tipo
                transport.appData = { consumer };

                // 🔥 AQUÍ VA
                transport.on("close", () => {
                    console.log(`🚛 Transport para usuario ${peer.id} en transport.id: ${transport.id}`);

                    // limpiar peer
                    peer.transports = peer.transports.filter(t => t.id !== transport.id);

                    // cerrar todo lo asociado
                    peer.producers.forEach(p => p.close());
                    peer.consumers.forEach(c => c.close());
                });

                peer.transports.push(transport);

                console.log(
                `🚀 Transport creado: ${transport.id} | consumer: ${consumer}`
                );

                callback({
                    id: transport.id,
                    iceParameters: transport.iceParameters,
                    iceCandidates: transport.iceCandidates,
                    dtlsParameters: transport.dtlsParameters,
                });
            } catch (error) {
                console.error("❌ Error creando transport:", error);
                callback({ error: error.message });
            }
            });

        // 🔹 Conectar transport
        socket.on("connectTransport", async ({ transportId, dtlsParameters, roomId }, callback) => { //se agrega roomId y userId para buscar el peer correcto
            
            console.log("📡 connectTransport:", transportId);
            
            const peer = await getOnePeerInRoom(roomId, socket.id);

            if (!peer) return callback?.({ error: "Peer no encontrado" });

            // 🔍 BUSCAR: Obtenemos el objeto usando el ID que viene del cliente
            // const transport = transports.get(transportId);

            const transport = peer.transports.find(t => t.id === transportId);

            if (!transport) {
                console.error("❌ Transport no encontrado:", transportId);
                return callback?.({ error: "Transport no encontrado" });
            }

            try {
                console.log(
                    "Conectando transport:",
                    transport.id
                    );

                await transport.connect({ dtlsParameters });
                console.log("✅ Transport conectado backend:",transport.id);
                callback?.({ connected: true });
                    
                console.log(
                    "✅ Backend transport conectado:",
                    transport.id
                );

                   // Servidor
                transport.on("dtlsstatechange", (dtlsState) => {
                    console.log("DTLS state:", dtlsState);
                });
                transport.on("icestatechange", (iceState) => {
                    console.log("ICE state:", iceState);
                });

            } catch (error) {
                console.error("❌ Error en connectTransport:", error);
                callback?.({ error: error.message });
            }

           
        });

        // 🔹 Producir (Enviar stream al SFU)
        socket.on("produce", async ({ transportId, kind, rtpParameters, roomId }, callback) => {
            const room = await getRoom(roomId);
            const peer = await getOnePeerInRoom(roomId, socket.id);

            if (!room || !peer) return callback({ error: "Room or peer  not found" });

            // 🔥 SOLO UN PRODUCER
            if (room.activeProducerId && room.activeProducerId !== socket.id) {
                return callback({ error: "Ya hay un productor activo" });
            }

            const transport = peer.transports.find(t => t.id === transportId);

            try {
                const producer = await transport.produce({
                kind,
                rtpParameters,
                appData: { peerId: socket.id, },
                });

                peer.producers.push(producer);
                room.activeProducerId = socket.id;

                console.log("🎥 Producer creado:", producer.id);

                callback({ id: producer.id });

                // 🔥 Notificar a otros
                socket.to(peer.roomId).emit("new-producer", {
                    producerId: producer.id,
                    peerId: socket.id,
                    kind: producer.kind,
                    
                });
                console.log("📢 Emitiendo a:", peer.roomId);

                producer.on("close", () => {
                    room.activeProducerId = null;
                    socket.to(roomId).emit("producer-closed");
                });
                
            } catch (error) {
                console.error("❌ Error en produce:", error);
                callback?.({ error: error.message });
            }
        });

        // 🔹 Consumir (Recibir stream del SFU)
        socket.on("consume", async ({ producerId, rtpCapabilities, roomId }, callback) => {
            const room = getRoom(roomId);
            const peer = getOnePeerInRoom(socket.roomId, socket.id);

            if (!room ||!peer) return callback(null);

            const router = room.router;

            const producer = Array.from(room.peers.values())
                .flatMap(p => p.producers)
                .find(p => p.id === producerId);

            if (!producer) {
                console.error("❌ Productor no encontrado:", producerId);
                return callback?.(null);
            }

            if (!router.canConsume({ producerId, rtpCapabilities })) {
                console.error("❌ No se puede consumir");
                return callback?.(null);
            }

            // 🔥 Buscar transport de consumo
            const transport = peer.transports.find(t => t.appData?.consumer);

            if (!transport) {
                console.error("❌ No hay transport de consumo");
                return callback?.(null);
            }

            const consumer = await transport.consume({
                producerId,
                rtpCapabilities,
                paused: false,
            });

            if (!peer.consumers) peer.consumers = [];
            peer.consumers.push(consumer);

            console.log("📺 Consumer creado:", consumer.id);

            callback({
                id: consumer.id,
                producerId,
                kind: consumer.kind,
                rtpParameters: consumer.rtpParameters,
            });

            consumer.on("close", () => {
                peer.consumers = peer.consumers.filter(c => c.id !== consumer.id);
                socket.to(roomId).emit("consumer-closed");
            });
        });
        
        // 🔹 Obtener productores existentes (para usuarios que entran tarde)
        socket.on("getProducers", (data, callback) => {
            const { roomId } = data; //extraemos roomId del objeto data
            const room = getRoom(roomId);
            if (!room) return callback?.([]);

            // 🔥 Fuente única: room.producers
            if (room.activeProducerId) {
                console.log("room.activeProducerId", room.activeProducerId);
                const producers = Array.from(room.peers.values())
                    .flatMap(p => p.producers)
                    .find(p => p.id === room.activeProducerId) // solo el activo
                    console.log("productores", producers);
                    callback(producers);
                } else { 
                    console.log("no hay productores");
                    callback(null);
                }
        });

        // 🔹 Reanudar consumo
        socket.on("resume-consumer", async ({ consumerId }, callback) => {
            
            console.log("▶️ Resume solicitado:", consumerId);
            const peer = getOnePeerInRoom(socket.roomId, socket.id);
            
            console.log("👤 Peer:", !!peer);
            const consumer = peer?.consumers.find(c => c.id === consumerId);
            
            console.log("📺 Consumer encontrado:", !!consumer);

            if (consumer) {
                await consumer.resume();

                console.log("✅ Consumer resumido");
                callback?.({ success: true });
            }
        });

        socket.on("set-quality", async ({ consumerId, quality }) => {
            const peer = getOnePeerInRoom(socket.roomId, socket.id);

            const consumer = peer.consumers.find(c => c.id === consumerId);

            const map = { low: 0, mid: 1, high: 2 };

            await consumer.setPreferredLayers({
                spatialLayer: map[quality],
                temporalLayer: 2,
            });
        });

        socket.on("pause-consumer", async ({ consumerId }) => {
            const peer = getOnePeerInRoom(socket.roomId, socket.id);
            const consumer = peer.consumers.find(c => c.id === consumerId);

            await consumer.pause();
        });

        //reconect
        socket.on("connect", () => {
            console.log("🟢 Reconectado");
        
            if (wasConnectedBefore) {
                rejoinRoom();
            }
        });

        // 🔹 Desconexión
        socket.on("disconnect", ({ roomId, socketId }) => {
            console.log("❌ Socket desconectado:", socket.id);

            const room = getRoom(socket.roomId);
            const peer = getOnePeerInRoom(socket.roomId, socket.id);

            if (!peer) return;

            // 🔴 NO borres todo inmediatamente
            // espera unos segundos por reconexión

            setTimeout(() => {
                const stillPeer = getOnePeerInRoom(socket.roomId, socket.id);    

                if (!stillPeer) return;
                console.log("⏳ Verificando reconexión de:", socket.id);

                removePeerFromRoom(roomId, socketId); //lo elimina de la sala usando router.js
                socket.to(peer.roomId).emit("peer-left", { peerId: socket.id });

            }, 5000); // ventana de reconexion

            
        });
    // });
    };
}