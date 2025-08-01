declare var self: Worker;

import type {
  MessagePayload,
  MessageType,
  Payment,
  PaymentsSummaryParams,
  ProcessedPayment,
  ProcessorsStatus,
} from "./shared/types";

const PROCESS_BATCH_INTERVAL = Number(Bun.env.PROCESS_BATCH_INTERVAL);
const MAX_BATCH_SIZE = Number(Bun.env.MAX_BATCH_SIZE);

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
    } else if (event.data.type === "GET-PAYMENT-SUMMARY-IN") {
      const paymentsSummary = getPaymentsSummary(event.data.payload as PaymentsSummaryParams);
      self.postMessage({ type: "GET-PAYMENT-SUMMARY-OUT", payload: paymentsSummary });
    } else if (event.data.type === "UPDATE-PROCESSORS-STATUS") {
      processorsStatus = event.data.payload as ProcessorsStatus;
      // console.info("Processors status updated");
    }
  } catch (err) {
    console.error("Worker error:", err);
  }
};

async function processBatch(): Promise<void> {
  try {
    if (paymentBuffer.length === 0) {
      // console.info("There are no payment requests in the buffer");
      return;
    }

    const processorToUse = getProcessorToUse();
    if (!processorToUse) {
      console.warn("Both processors are offline. Skipping batch processing.");
      return;
    }

    const batch = paymentBuffer.splice(0, MAX_BATCH_SIZE);

    const results = await Promise.all(batch.map((p) => attemptPayment(p, processorToUse)));

    results.forEach((r) => (r.ok ? processedPayments.push(r.processedPayment) : paymentBuffer.push(r.payment)));
  } catch (err) {
    console.log("Process batch error:", err);
  }
}

setInterval(processBatch, PROCESS_BATCH_INTERVAL);

function getProcessorToUse(): "default" | "fallback" | null {
  const { default: defaultStatus, fallback: fallbackStatus } = processorsStatus;

  const isDefaultViable = !defaultStatus.failing;
  const isFallbackViable = !fallbackStatus.failing;

  if (!isDefaultViable && !isFallbackViable) {
    return null;
  }

  if (!isDefaultViable && isFallbackViable) {
    return "fallback";
  }

  if (isDefaultViable && !isFallbackViable) {
    return "default";
  }

  const PERFORMANCE_THRESHOLD_PERCENTAGE = 0.3; // 30%

  const defaultIsSignificantlySlower =
    defaultStatus.minResponseTime > fallbackStatus.minResponseTime * (1 + PERFORMANCE_THRESHOLD_PERCENTAGE);

  if (defaultIsSignificantlySlower) {
    return "fallback";
  } else {
    return "default";
  }
}

async function attemptPayment(
  payment: Payment,
  processorToUse: "default" | "fallback"
): Promise<{ ok: true; processedPayment: ProcessedPayment } | { ok: false; payment: Payment }> {
  const url =
    processorToUse === "default" ? Bun.env.PAYMENT_PROCESSOR_URL_DEFAULT : Bun.env.PAYMENT_PROCESSOR_URL_FALLBACK;

  const requestTimestamp = Date.now();

  try {
    const response = await fetch(`${url}/payments`, {
      method: "POST",
      body: JSON.stringify({
        correlationId: payment.correlationId,
        amount: payment.amount,
        requestedAt: new Date(requestTimestamp).toISOString(),
      }),
      headers: {
        "Content-Type": "application/json",
      },
      signal: AbortSignal.timeout(10000),
    });

    if (response.ok) {
      return {
        ok: true,
        processedPayment: {
          amount: payment.amount,
          processedBy: processorToUse,
          timestamp: requestTimestamp,
        },
      };
    }
  } catch (error) {
    console.error(`Error processing payment ${payment.correlationId} with ${processorToUse}:`, error);
  }

  return {
    ok: false,
    payment,
  };
}

function getPaymentsSummary(params: PaymentsSummaryParams) {
  const { from, to } = params;

  const summary = {
    default: { totalRequests: 0, totalAmount: 0 },
    fallback: { totalRequests: 0, totalAmount: 0 },
  };

  for (let i = 0; i < processedPayments.length; i++) {
    const payment = processedPayments[i] as ProcessedPayment;
    const isInDateRange = payment.timestamp >= from && payment.timestamp <= to;
    if (isInDateRange) {
      const processorSummary = summary[payment.processedBy];
      processorSummary.totalRequests++;
      processorSummary.totalAmount += payment.amount;
    }
  }

  summary.default.totalAmount = parseFloat(summary.default.totalAmount.toFixed(2));
  summary.fallback.totalAmount = parseFloat(summary.fallback.totalAmount.toFixed(2));

  return summary;
}
