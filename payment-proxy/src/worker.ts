declare var self: Worker;

import { Database } from "bun:sqlite";
const db = new Database(":memory:");

db.run(`
  CREATE TABLE IF NOT EXISTS payments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    correlationId TEXT NOT NULL UNIQUE,
    amount REAL NOT NULL,
    processedBy TEXT NOT NULL,
    processedAt DATETIME NOT NULL DEFAULT (datetime('now'))
  );

  CREATE INDEX IF NOT EXISTS idxPaymentsProcessedBy ON payments(processedBy);

  CREATE TABLE IF NOT EXISTS serviceHealth (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    defaultFailing INTEGER NOT NULL DEFAULT 0,
    defaultMinResponseTime INTEGER NOT NULL DEFAULT 0,
    fallbackFailing INTEGER NOT NULL DEFAULT 0,
    fallbackMinResponseTime INTEGER NOT NULL DEFAULT 0
  );
`);

console.info("Payments table and index created in memory (worker)");

type Payment = {
  correlationId: string;
  amount: number;
  processedBy?: string;
};

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
      const result = db
        .query(
          "SELECT processedBy, COUNT(*) AS totalPagamentos, SUM(amount) AS totalAmount FROM payments GROUP BY processedBy;"
        )
        .get();
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
    const results = await Promise.all(batch.map((payment) => {}));

    console.log(results);

    console.info(`Processados ${batch.length} pagamentos`);
  } catch (err) {
    console.log("Process batck error:", err);
  }
}

// setInterval(processBatch, BATCH_INTERVAL_MS);

// const insertPaymentSql = db.prepare(
//   "INSERT INTO payments (correlationId, amount, processedBy) VALUES ($correlationId, $amount, $processedBy)"
// );

// function insertPayment(payment: Payment) {
//   insertPaymentSql.run({
//     $correlationId: payment.correlationId,
//     $amount: payment.amount,
//     $processedBy: "default",
//   });
// }

async function checkServiceHealth(): Promise<void> {
  const [defaultResponse, fallbackResponse] = await Promise.allSettled([
    fetch(`${process.env.PAYMENT_PROCESSOR_URL_DEFAULT}/payments/service-health`),
    fetch(`${process.env.PAYMENT_PROCESSOR_URL_FALLBACK}/payments/service-health`),
  ]);

  let defaultFailing = true;
  let defaultMinResponseTime = 0;
  let fallbackFailing = true;
  let fallbackMinResponseTime = 0;

  if (defaultResponse.status === "fulfilled" && defaultResponse.value.ok) {
    const body = (await defaultResponse.value.json()) as { failing: boolean; minResponseTime: number };
    defaultFailing = body.failing;
    defaultMinResponseTime = body.minResponseTime ?? 0;
  }

  if (fallbackResponse.status === "fulfilled" && fallbackResponse.value.ok) {
    const body = (await fallbackResponse.value.json()) as { failing: boolean; minResponseTime: number };
    fallbackFailing = body.failing;
    fallbackMinResponseTime = body.minResponseTime ?? 0;
  }

  const updateServiceHealthSql = db.prepare(
    "UPDATE serviceHealth SET defaultFailing = $defaultFailing, defaultMinResponseTime = $defaultMinResponseTime, fallbackFailing = $fallbackFailing, fallbackMinResponseTime = $fallbackMinResponseTime WHERE id = 1"
  );

  updateServiceHealthSql.run({
    $defaultFailing: defaultFailing,
    $defaultMinResponseTime: defaultMinResponseTime,
    $fallbackFailing: fallbackFailing,
    $fallbackMinResponseTime: fallbackMinResponseTime,
  });

  console.info("Services health status updated");
}

if (Bun.env.INSTANCE_TYPE === "PRIMARY") {
  setInterval(checkServiceHealth, HEALTH_CHECK_INTERVAL_MS);
  console.info("This instance is primary, service health check started");
} else {
  console.info("This instance is not primary, service health check not started");
}
