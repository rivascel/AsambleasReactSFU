// Import the new functions
import {
  //... other imports
  getActiveAdmin,
  registerViewer, // Import the existing viewer registration function
  sendSignal,
  setUserIsStreaming
 
} from "../../src/supabase-client";


const API_URL = import.meta.env.VITE_API_URL;


const peerConnections={};
// let localStream;
let remoteStream;
let candidateQueue = [];
const appliedAnswers = new Set();

let configuration=null;


let device;
    let consumerTransport;  // Para recibir streams
    let producerTransport;  // Para enviar streams (NUEVO)
    let localStream = null; // Stream local del viewer
    let isProducing = false;

// Obtener stream local (cámara/micrófono)
export async function getLocalStream(localVideoElement){
  try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: true
      });
      
      localVideoElement.srcObject = stream;
      
      // Opcional: mostrar preview local
      if (localVideoElement?.current) {
        localVideoElement.current.srcObject = stream;
      }
      
      return stream;
    } catch (error) {
      console.error("❌ Error accediendo a medios:", error);
      return null;
    }

}

  // Función para iniciar transmisión (enviar video/audio)
// Es mejor usar variables locales o referencias que no contaminen el objeto window
let videoProducer = null;
let audioProducer = null;




