declare var self: Worker;

import type { MessagePayload, MessageType, Payment, ProcessedPayment, ProcessorsStatus } from "./shared/types";

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

const paymentBuffer: Payment[] = [];
const processedPayments: ProcessedPayment[] = [];

self.onmessage = (event: MessageEvent<{ type: MessageType; payload?: MessagePayload }>) => {
  try {
    if (event.data.type === "CREATE-PAYMENT-REQUEST") {
      const paymentRequest = event.data.payload as Payment;
      paymentBuffer.push(paymentRequest);
    } else if (event.data.type === "GET-PAYMENT-SUMMARY") {
      // const result = getPaymentsSummary();
      self.postMessage({ type: "summary", payload: null });
    } else if (event.data.type === "UPDATE-PROCESSORS-STATUS") {
      processorsStatus = event.data.payload as ProcessorsStatus;
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

    let processorToUse = getProcessorToUse();

    const batch = paymentBuffer.splice(0, 10);
    // await Promise.all(batch.map(insertPayment));
    // console.info(`Processados ${batch.length} pagamentos`);
  } catch (err) {
    console.log("Process batch error:", err);
  }
}

setInterval(processBatch, 1500);

async function getProcessorToUse(): Promise<"DEFAULT" | "FALLBACK"> {
  // Implementar aqui, anotações no notepad
}
