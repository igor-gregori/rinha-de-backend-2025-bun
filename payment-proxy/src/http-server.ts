import { type BunRequest } from "bun";

const worker = new Worker(new URL("worker.ts", import.meta.url).href);

worker.addEventListener("open", () => {
  console.log("Worker is ready");
});

Bun.serve({
  port: 3000,
  routes: {
    "/healthcheck": new Response("OK"),
    "/payments": {
      POST: async (req: BunRequest) => {
        const paymentRequest = await req.json();
        worker.postMessage({ type: "paymentRequest", payload: paymentRequest });
        return Response.json("Ok", { status: 201 });
      },
    },
    "/payments-summary": {
      GET: async (req: BunRequest) => {
        return new Promise<Response>((resolve) => {
          worker.onmessage = (event: MessageEvent) => {
            if (event.data.type === "summary") {
              resolve(Response.json(event.data.payload, { status: 200 }));
            }
          };
          worker.postMessage({ type: "summary" });
        });
      },
    },
  },
  fetch() {
    return new Response("Not Found", { status: 404 });
  },
});

console.info("HTTP listening on 3000");
