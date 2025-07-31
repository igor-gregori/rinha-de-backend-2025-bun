import { type BunRequest } from "bun";
import { checkProcessorsStatus } from "./services/processors-status";

// Worker
const worker = new Worker(new URL("worker.ts", import.meta.url).href);

worker.addEventListener("open", () => {
  console.info("Worker is ready");
});

// HTTP Server
Bun.serve({
  port: 3000,
  routes: {
    "/healthcheck": new Response("OK"),
    "/payments": {
      POST: async (req: BunRequest) => {
        const paymentRequest = await req.json();
        worker.postMessage({ type: "CREATE-PAYMENT-REQUEST", payload: paymentRequest });
        return Response.json(null, { status: 201 });
      },
    },
    "/payments-summary": {
      GET: async (req: BunRequest) => {
        return new Promise<Response>((resolve) => {
          worker.onmessage = (event: MessageEvent) => {
            if (event.data.type === "GET-PAYMENT-SUMMARY") {
              resolve(Response.json(event.data.payload, { status: 200 }));
            }
          };
          worker.postMessage({ type: "summary" });
        });
      },
    },
    "/processors-status": {
      GET: async () => {
        return Response.json(processorsStatus, { status: 200 });
      },
    },
  },
  fetch() {
    return new Response(null, { status: 404 });
  },
});

console.info("HTTP listening on 3000");

// Processors status checker
let processorsStatus = {
  default: {
    failing: false,
    minResponseTime: 0,
  },
  fallback: {
    failing: false,
    minResponseTime: 0,
  },
};

async function updateProcessorsStatus() {
  processorsStatus = await checkProcessorsStatus();
  worker.postMessage({ type: "UPDATE-PROCESSORS-STATUS", payload: processorsStatus });
  console.info("Processors status updated");
}

if (Bun.env.INSTANCE_TYPE === "PRIMARY") {
  updateProcessorsStatus();
  setInterval(updateProcessorsStatus, 5000);
  console.info("This instance is primary, service status check started");
} else {
  console.info("This instance is not primary, service status check not started");
}
