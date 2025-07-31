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
        return new Response(null, { status: 201 });
      },
    },
    "/payments-summary": {
      GET: async (req: BunRequest) => {
        const url = new URL(req.url);
        const fromStr = url.searchParams.get("from") as string;
        const toStr = url.searchParams.get("to") as string;
        const from = Date.parse(fromStr);
        const to = Date.parse(toStr);
        return new Promise<Response>((resolve) => {
          const messageHandler = (event: MessageEvent) => {
            if (event.data.type === "GET-PAYMENT-SUMMARY-OUT") {
              worker.removeEventListener("message", messageHandler);
              resolve(Response.json(event.data.payload, { status: 200 }));
            }
          };
          worker.addEventListener("message", messageHandler);
          worker.postMessage({
            type: "GET-PAYMENT-SUMMARY-IN",
            payload: { from, to },
          });
        });
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
  // Envio pro follower
  console.info("Processors status updated");
}

updateProcessorsStatus();
setInterval(updateProcessorsStatus, 5000);
