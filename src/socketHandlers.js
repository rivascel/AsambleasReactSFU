

    export function registerSocketHandlers(socket, io) {

        // ===============CONEXION VIDEO ===================================
        // Manejar eventos de WebRTC (señalización)
        socket.on("offer", data => {
            const { to, offer } = data;
            io.to(to).emit("offer", { from: socket.id, offer });
        });

        socket.on("answer", data => {
            const { to, answer } = data;
            io.to(to).emit("answer", { from: socket.id, answer });
        });

        socket.on("ice-candidate", data => {
            const { to, candidate } = data;
            io.to(to).emit("ice-candidate", { from: socket.id, candidate });
        });

        // Notificar a otros usuarios sobre nuevas conexiones
        socket.on("join-room", roomId => {
            socket.join(roomId);
            socket.to(roomId).emit("user-connected", socket.id);
        });

        socket.on("broadCasting",   (email)   => {
            console.log("Administrador transmitiendo:", administrador);
            // Enviar mensaje a todos los clientes conectados   
            io.emit("admin-connected", email );
        });

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
       
        // 🔹 Unirse a sala (crear o unirse)
          // Cuando un usuario se une a una sala

        // 🔹 Unirse a la sala
        socket.on("join-room", async ({ roomId, userId }, callback) => {
            console.log("📥 joinRoom:", socket.id, "sala:", roomId, "userId", userId);

            console.log("📡 Evento desde:", socket.id);
            
            let room = getRoom(roomId); //busca en router.js
            if (!room) {
                room = await createRoomWithWorker(roomId); // lo crea usando router.js
                console.log("🏠 Sala creada:", roomId);
            }

            addPeerToRoom(roomId, socket.id); //lo agrega a la sala usando router.js

            socket.join(roomId);
            socket.roomId = roomId;
            socket.userId = userId; //aca es donde guarda el socket

            // ✅ Verificar que el peer se guardó correctamente
            const savedPeer = getOnePeerInRoom(roomId, socket.id);
            console.log("✅ Peer guardado:", socket.id, "en sala:", savedPeer?.roomId);

            // Devolver las capacidades del router para que el cliente cargue su device
            callback({
                rtpCapabilities: room.router.rtpCapabilities
            });
        });

        // 🔹 Crear transport (WebRTC)
        socket.on("createTransport", async ({ consumer, roomId }, callback) => {
            const room = getRoom(roomId);
            const peer = getOnePeerInRoom(roomId, socket.id);

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

                // 🔥 CLAVE: distinguir tipo
                transport.appData = { consumer };

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
            const peer = getOnePeerInRoom(roomId, socket.id);

            if (!peer) return callback?.({ error: "Peer no encontrado" });

            const transport = peer.transports.find(t => t.id === transportId);

            if (!transport) {
                console.error("❌ Transport no encontrado:", transportId);
                return callback?.({ error: "Transport no encontrado" });
            }

            try {
                await transport.connect({ dtlsParameters });
                callback?.({ success: true });
            } catch (error) {
                console.error("❌ Error en connectTransport:", error);
                callback?.({ error: error.message });
            }
        });

        // 🔹 Producir (Enviar stream al SFU)
        socket.on("produce", async ({ transportId, kind, rtpParameters, roomId }, callback) => {
            const room = getRoom(roomId);
            const peer = getOnePeerInRoom(roomId, socket.id);
            
            

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

            try {
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

            } catch (error) {
                console.error("❌ Error en consume:", error);
                callback?.(null);
            }
            });

        socket.on("getProducers", { roomId }, (callback) => {
            const room = getRoom(roomId);
            const peer = getOnePeerInRoom(roomId, socket.id);


            if (!room || !peer) {
                console.warn("❌ No hay producers o peers en la sala");
                return callback(null);
            }

            // 🔥 Fuente única: room.producers
            const producers = Array.from(room.peers.values())
                .flatMap(p => p.producers)
                .find(p => p.id === room.activeProducerId) // solo el activo
                
            console.log("📡 getProducers:", producers);

            callback(producers);
        });


        // 🔹 Reanudar consumo
        socket.on("resume", async ({ consumerId }, callback) => {
            const peer = getOnePeerInRoom(socket.roomId, socket.id);
            const consumer = peer?.consumers.find(c => c.id === consumerId);

            if (consumer) {
                await consumer.resume();
                callback?.({ success: true });
            }
        });

        // 🔹 Obtener productores existentes (para usuarios que entran tarde)

        // 🔹 Desconexión
        socket.on("disconnect", ({ roomId, socketId }) => {

            removePeerFromRoom(roomId, socketId); //lo elimina de la sala usando router.js
            socket.to(peer.roomId).emit("peer-left", { peerId: socket.id });
            
        });
    // });
    };