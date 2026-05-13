import React, { useState, useEffect, useRef, useContext } from "react";
import { UserContext } from "../../components/UserContext";
import { getLocalStream, listenForApprovals } from "../../hooks/webrtc-manager";
import AppContext from '../../context/AppContext';
import * as mediasoupClient from "mediasoup-client";
import { getSocket  } from "../../hooks/socket";
import useVideoQuality from "../../hooks/useVideoQuality";
import useVisibility from "../../hooks/useVisibility";

const VideoAdmin = () => {
  const localRef = useRef();
  const remoteRef = useRef();

  const socket = getSocket(apiUrl);

  const { apiUrl } = useContext(AppContext);
  const [isBroadcasting, setIsBroadcasting] = useState(false);
  const localRef = useRef();
  const remoteRef = useRef();
  const quality = useVideoQuality(remoteRef);
  const isVisible = useVisibility(remoteRef);
  const [currentQuality, setCurrentQuality] = useState(null);

  const { email } = useContext(UserContext);
  const [stream, setStream] = useState(false);
  const roomId="main-room";
  const [remote, setRemote] = useState(false);
  const ownerInfo = JSON.parse(localStorage.getItem("ownerInfo"));

  const socketRef = useRef(null);
  const deviceRef = useRef(null);
  const sendTransportRef = useRef(null);
  const recvTransportRef = useRef(null);

  const producersRef = useRef([]);
  const consumersRef = useRef([]);

  const initializedRef = useRef(false); // 🔥 evita doble ejecución (React Strict)
  const rtpCapabilitiesRef = useRef(null);
  const stateRef = useRef("IDLE");

 const encodings = [
  { maxBitrate: 100000, scaleResolutionDownBy: 4 },
  { maxBitrate: 300000, scaleResolutionDownBy: 2 },
  { maxBitrate: 900000, scaleResolutionDownBy: 1 }
];

  const {
    localStream,
    remoteStream,
    startBroadcast,
    stopBroadcast,
  } = useWebRTC({
    socket,
    roomId: "main-room",
    email,
  });

// 8. useEffect correcto (ANTI-CAOS)
  useEffect(() => {
    if (initializedRef.current) return;
    initializedRef.current = true;

    
    const socket = getSocket(apiUrl);
    socketRef.current = socket;

    socketRef.current.on("connect", async () => {
      console.log("🟢 Conectado:", socket.id);
    });

  }, []);

  useEffect(() => {
    if (localRef.current && localStream) {
      localRef.current.srcObject = localStream;
    }
  }, [localStream]);

  useEffect(() => {
    if (remoteRef.current && remoteStream) {
      remoteRef.current.srcObject = remoteStream;
    }
  }, [remoteStream]);

  return (
    <>
      <video ref={localRef} autoPlay playsInline muted />
      <video ref={remoteRef} autoPlay playsInline />

      <button onClick={startBroadcast}>
        Iniciar
      </button>

      <button onClick={stopBroadcast}>
        Detener
      </button>
    </>
  );
};