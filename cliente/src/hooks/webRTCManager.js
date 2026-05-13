// webrtc/WebRTCManager.js

import * as mediasoupClient from "mediasoup-client";
import { socket } from "./socket";

export default class WebRTCManager {
  constructor({ socket, roomId, email }) {
    this.socket = socket;
    this.roomId = roomId;
    this.email = email;

    this.device = null;

    this.sendTransport = null;
    this.recvTransport = null;

    this.producers = [];
    this.consumers = [];

    this.rtpCapabilities = null;

    this.localStream = null;
    this.remoteStream = new MediaStream();

    this.state = "IDLE";

    this.encodings = [
      { maxBitrate: 100000, scaleResolutionDownBy: 4 },
      { maxBitrate: 300000, scaleResolutionDownBy: 2 },
      { maxBitrate: 900000, scaleResolutionDownBy: 1 }
    ];
  }

  setState = (newState) => {
    console.log(`🧭 Estado: ${this.state} → ${newState}`);
    this.state = newState;
  };

  async init() {
    await this.joinRoom();
    await this.loadDevice();
    this.setupConsumerFlow();
  }

  async setupConsumerFlow() {
    await this.createRecvTransport();
    this.listenForNewProducers();
    await this.consumeExisting();
  };

  async joinRoom() {    
    return new Promise((resolve, reject) => {
      this.socket.emit("join-room", 
        { roomId:this.roomId, 
          userid:this.email 
        }, 
        (data) => { 
          if (!data) {
            reject("Error al unirse a la sala");
            return;
          }
        this.rtpCapabilities = data.rtpCapabilities;
        console.log("✅ Unido a la sala", this.roomId);
        this.setState("JOINED");
        resolve();
        }
      );
    });
  }

  async loadDevice() {
    const device = new mediasoupClient.device();

    await device.load({
      routerRtpCapabilities: this.rtpCapabilities,
    });

    this.device = device;
    this.setState("DEVICE_LOADED");
  }

  async createSendTransport() {
    return new Promise((resolve) => {
      this.socket.emit(
        "createTransport",
        { consumer: false, roomId: this.roomId }, // 🔥 CLAVE
        (params) => {
          const transport = this.device.createSendTransport(params);

          transport.on("connect", ({ dtlsParameters }, callback) => {
            this.socket.emit(
              "connectTransport",
              { transportId: transport.id, dtlsParameters, roomId: this.roomId },
              callback
            );
          });

          transport.on("produce", ({ kind, rtpParameters }, callback) => {
            this.socket.emit(
              "produce",
              {
                transportId: transport.id,
                kind,
                rtpParameters,
                roomId: this.roomId
              },
              ({ id }) => callback({ id })
            );
          });
          this.sendTransport = transport;
          resolve();
        }
      );
      this.setState("SEND_TRANSPORT_READY");
    });
  }

  async createRecvTransport() {}

  async startProducing() {
    if (this.sendTransport) {
      console.warn("⚠️ Ya estás produciendo");
      return;
    }
    try {
      await this.createSendTransport();
      await this.produce();
    } catch (error) {
      console.error("❌ Error iniciando producción:", error);
    }
  }

  async stopProducing() {
    // cerrar producers
    this.producers.forEach(p => p.close());
    this.producers = [];

    // cerrar transport
    if (this.sendTransport) {
      this.sendTransport.close();
      this.sendTransport = null;
    }
    // apagar cámara
    if (this.localStream?.srcObject) {
      this.localStream.srcObject.getTracks().forEach(t => t.stop());
      this.localStream.srcObject = null;
    }

    console.log("🛑 Producción detenida");
  }

    // produce (clave)
  async produce() {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: true,
      audio: true,
    });
    this.localStream.srcObject = stream;

    for (const track of stream.getTracks()) {
      const producer = await this.sendTransport.produce({ 
        track,              
        encodings: this.encodings,          
        codecOptions: {
          videoGoogleStartBitrate: 1000  
        },
        appData: {
          peerId: socketRef.current.id,         
        } 
      });
      this.producers.push(producer);
    }

    console.log("🎥 Produciendo...");
    this.setState("PRODUCING");
  };
    // 7. FLUJO VIEWER

  async setupConsumerFlow() {
    await this.createRecvTransport();
    this.listenForNewProducers();
    await this.consumeExisting();
    
  };
  async setupConsumerFlow () {
    await this.createRecvTransport();
    this.listenForNewProducers();
    await this.consumeExisting();
  };

    // createRecvTransport
  async createRecvTransport() {
    return new Promise((resolve) => {
      this.socket.emit(
        "createTransport",
        { consumer: true, roomId, email}, // 🔥 CLAVE
        (params) => {
          const transport = this.device.createRecvTransport(params);

          transport.on("connect", ({ dtlsParameters }, callback, errback) => {
            this.socket.emit(
              "connectTransport",
              { transportId: transport.id, dtlsParameters, roomId },
              ({ error }) => {
                if (error) {
                  errback(error);
                } else {
                  callback();
                }
              }
            );
          });
          this.recvTransport.current = transport;
          resolve();
        }
      );
      this.setState("RECV_TRANSPORT_READY");
    });
  };

  // consumir existentes
  async consumeExisting() {
    this.producers = await new Promise((resolve) => {
      this.socket.emit("getProducers", { roomId: this.roomId }, resolve);
      console.log("📡 Solicitando productores existentes para la sala", this.roomId);
    });

    if (this.producers === null || this.producers.length === 0) {
      console.log("📡 No hay productores disponibles");
      return;
    }

    for (const producerId of this.producers) {
      console.log("📡 Producers disponibles:", this.producers);
      await consume(producerId);
    }
    
    this.setState("CONSUMING_EXISTING");
  };

  // 🎥 consume
  async consume() {
    const data = await new Promise((resolve) => {
      this.socket.emit(
        "consume",
        {
          producerId,
          rtpCapabilities: this.device.rtpCapabilities,
          roomId:this.roomId,
          email:this.email
        },
        resolve
      );
      
    });

    if (data) {
      console.warn("❌ Productor no encontrado:", producerId);
      return;
    }

    const consumer = await this.recvTransport.consume({
      id: data.id,
      producerId: data.producerId,
      kind: data.kind,
      rtpParameters: data.rtpParameters,
    });
    console.log("🎥 kind:", data.kind);
    console.log("🎥 track:", consumer.track.kind);

    await new Promise((resolve)=>{
      this.socket.emit("resume-consumer", 
        { consumerId: consumer.id }, resolve );
    })

    this.consumers.push(consumer);

    // 🔥 agregar track al stream actual
    this.remoteStream.addTrack(consumer.track);

    this.setState("READY");
  };

    // 🔴 nuevos producers en tiempo real
  async listenForNewProducers() {
    this.socket.on("new-producer", async ({ producerId }) => {
      console.log("🆕 Nuevo producer:", producerId);
      await this.consume(producerId);
    });
  };

  async updateConsumers() {
    if (!this.consumers.length) return;

    this.consumers.forEach((consumer) => {
      if (!isVisible) {
        this.socket.emit("pause-consumer", {
          consumerId: consumer.id,
        });
        return;
      }

      this.socket.emit("resume-consumer", {
        consumerId: consumer.id,
      });

      this.socket.emit("set-quality", {
        consumerId: consumer.id,
        quality,
      });
    });
  };

  async consume(producerId) {}

  async updateConsumers() {}

  close() {}
}







