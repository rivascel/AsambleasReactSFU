// webrtc/useWebRTC.js

import { useEffect, useRef, useState } from "react";
import WebRTCManager from "./WebRTCManager";

export default function useWebRTC({
  socket,
  roomId,
  email,
}) 

{
  const managerRef = useRef(null);

  const [localStream, setLocalStream] = useState(null);
  const [remoteStream, setRemoteStream] = useState(null);

  useEffect(() => {
    if (!socket) return;

    const manager = new WebRTCManager({
      socket,
      roomId,
      email,
    });

    managerRef.current = manager;

    manager.init().then(() => {
      setRemoteStream(manager.remoteStream);
    });

    return () => {
      manager.close();
    };
  }, []);

  const startBroadcast = async () => {
    await managerRef.current.startProducing();

    setLocalStream(managerRef.current.localStream);
  };

  const stopBroadcast = async () => {
    await managerRef.current.stopProducing();

    setLocalStream(null);
  };

  return {
    localStream,
    remoteStream,
    startBroadcast,
    stopBroadcast,
  };
}