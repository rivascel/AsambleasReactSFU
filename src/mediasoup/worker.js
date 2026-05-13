import mediasoup from "mediasoup";
import os from "os";
import { config } from "./config.js";

// let worker;
const workers = [];
let nextWorkerIndex = 0;

export async function createWorkers() {
  const numCores = os.cpus().length;

  for (let i = 0; i < numCores; i++) {
    const worker = await mediasoup.createWorker({
      rtcMinPort: config.mediasoup.worker.rtcMinPort,
      rtcMaxPort: config.mediasoup.worker.rtcMaxPort,
    });

    worker.on("died", () => {
      console.error("💀 Worker murió, reinicia el proceso");
      process.exit(1);
    });

    workers.push({
      worker, 
      routers: [],
      load: 0
    });
    console.log(`🧵 Worker ${i} creado`);
  }
}

export function getWorker() {
  const worker = workers[nextWorkerIndex];
  nextWorkerIndex = (nextWorkerIndex + 1) % workers.length;
  return worker;
}
