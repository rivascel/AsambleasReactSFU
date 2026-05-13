export const config = {
  mediasoup: {
    worker: {
      rtcMinPort: 40000,
      rtcMaxPort: 49999,
    },
    router: {
      mediaCodecs: [
        {
          kind: "audio",
          mimeType: "audio/opus",
          clockRate: 48000,
          channels: 2,
        },
        {
          kind: "video",
          mimeType: "video/VP8",
          clockRate: 90000,
        },
      ],
    },
    webRtcTransport: {
      listenIps: [
        {
          ip: "127.0.0.1",
          // ip: "0.0.0.0",
          // announcedIp: '192.168.55.47', // luego pones tu IP pública
          announcedIp: '127.0.0.1',
          // announcedIp: undefined, // Si no tienes IP pública o estás detrás de NAT, deja esto como undefined
        },
      ],
      enableUdp: true,
      enableTcp: true,
      preferUdp: true,
    },
  },
};