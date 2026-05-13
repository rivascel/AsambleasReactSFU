// Import the new functions
import { 
  getAllViewersAndListen,
   listenToRequests,
   setUserIsStreaming
} from "../../src/supabase-client";



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

const approvedViewers = new Set();
export function listenForApprovals(room) {
  return listenToRequests(
    room,
    { componentId: 'VideoGeneral' },
    (request) => {
      if (request?.status === 'approved') {
        approvedViewers.add(request.user_id)
        // console.log("✅ Viewer aprobado:", request.user_id)
      }
    },
  )
};

