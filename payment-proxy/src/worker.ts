declare var self: Worker;

import "./db";

import type { Payment } from "./types";
import { insertPayment, getPaymentsSummary } from "./services/payments";
import { checkProcessorsStatus } from "./services/processors-status";

const paymentBuffer: Payment[] = [];
const BATCH_SIZE = 10;
const BATCH_INTERVAL_MS = 100;
const HEALTH_CHECK_INTERVAL_MS = 5000;

self.onmessage = (event: MessageEvent<{ type: string; payload?: Payment | unknown }>) => {
  try {
    if (event.data.type === "payment-request") {
      const paymentRequest = event.data.payload as Payment;
      paymentBuffer.push(paymentRequest);
    } else if (event.data.type === "summary") {
      const result = getPaymentsSummary();
      self.postMessage({ type: "summary", payload: result });
    }
  } catch (err) {
    console.error("Worker error:", err);
  }
};

async function processBatch(): Promise<void> {
  try {
    if (paymentBuffer.length === 0) {
      console.info("There are no payment requests in the buffer");
      return;
    }

    const batch = paymentBuffer.splice(0, BATCH_SIZE);
    await Promise.all(batch.map(insertPayment));
    console.info(`Processados ${batch.length} pagamentos`);
  } catch (err) {
    console.log("Process batch error:", err);
  }
}

// setInterval(processBatch, BATCH_INTERVAL_MS);

if (Bun.env.INSTANCE_TYPE === "PRIMARY") {
  setInterval(checkProcessorsStatus, HEALTH_CHECK_INTERVAL_MS);
  console.info("This instance is primary, service health check started");
} else {
  console.info("This instance is not primary, service health check not started");
}
