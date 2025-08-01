import { type BunRequest } from "bun";
import { checkProcessorsStatus } from "./services/processors-status-checker";

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
        if (Bun.env.INSTANCE_TYPE !== "LEADER") {
          return new Response("Not a leader instance", { status: 421 });
        }

        const url = new URL(req.url);
        const fromStr = url.searchParams.get("from");
        const toStr = url.searchParams.get("to");
        const from = fromStr ? Date.parse(fromStr) : undefined;
        const to = toStr ? Date.parse(toStr) : undefined;

        const getOwnSummary = new Promise<any>((resolve) => {
          const messageHandler = (event: MessageEvent) => {
            if (event.data.type === "GET-PAYMENT-SUMMARY-OUT") {
              worker.removeEventListener("message", messageHandler);
              resolve(event.data.payload);
            }
          };
          worker.addEventListener("message", messageHandler);
          worker.postMessage({ type: "GET-PAYMENT-SUMMARY-IN", payload: { from, to } });
        });

        const getFollowerSummary: Promise<any> = fetch(
          `${Bun.env.PAYMENT_PROXY_FOLLOWER_URL}/internal/payments-summary?from=${fromStr}&to=${toStr}`,
          { signal: AbortSignal.timeout(1000) }
        ).then((res) => (res.ok ? res.json() : null));

        const [ownSummary, followerSummary] = await Promise.all([getOwnSummary, getFollowerSummary]);

        if (!followerSummary) {
          console.warn("Could not retrieve summary from follower. Returning leader data only.");
          return Response.json(ownSummary, { status: 200 });
        }

        const combinedSummary = {
          default: {
            totalRequests: ownSummary.default.totalRequests + followerSummary.default.totalRequests,
            totalAmount: parseFloat((ownSummary.default.totalAmount + followerSummary.default.totalAmount).toFixed(2)),
          },
          fallback: {
            totalRequests: ownSummary.fallback.totalRequests + followerSummary.fallback.totalRequests,
            totalAmount: parseFloat(
              (ownSummary.fallback.totalAmount + followerSummary.fallback.totalAmount).toFixed(2)
            ),
          },
        };

        return Response.json(combinedSummary, { status: 200 });
      },
    },
    "/internal/payments-summary": {
      GET: async (req: BunRequest) => {
        if (Bun.env.INSTANCE_TYPE !== "FOLLOWER") {
          return new Response("Not a follower instance", { status: 421 });
        }

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
    "/processor-status": {
      POST: async (req: BunRequest) => {
        if (Bun.env.INSTANCE_TYPE !== "FOLLOWER") {
          return new Response(null, { status: 421 });
        }
        worker.postMessage({ type: "UPDATE-PROCESSORS-STATUS", payload: await req.json() });
        return new Response(null, { status: 202 });
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

  fetch(`${Bun.env.PAYMENT_PROXY_FOLLOWER_URL}/processor-status`, {
    method: "POST",
    body: JSON.stringify(processorsStatus),
    headers: {
      "Content-Type": "application/json",
    },
    signal: AbortSignal.timeout(500),
  })
    .then((response) => {
      if (!response.ok) {
        console.warn(`Error communicating with follower: ${response.status}`);
      }
    })
    .catch((err) => {
      if (err.name === "AbortError") {
        console.warn("Request to follower timed out.");
      } else {
        console.warn("Failed to communicate with follower instance.");
      }
    });
}

if (Bun.env.INSTANCE_TYPE === "LEADER") {
  updateProcessorsStatus();
  setInterval(updateProcessorsStatus, 10000);
  console.info("This instance type is LEADER, processors status checker started.");
} else {
  console.info("This instance type is not LEADER, processors status checker not started.");
}
