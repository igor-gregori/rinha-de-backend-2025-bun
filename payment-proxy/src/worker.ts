declare var self: Worker;

import { Database } from "bun:sqlite";
const db = new Database(":memory:");

db.run(`
  CREATE TABLE payments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    correlationId TEXT NOT NULL UNIQUE,
    amount REAL NOT NULL,
    processedBy TEXT NOT NULL,
    processedAt DATETIME NOT NULL DEFAULT (datetime('now'))
  );
`);

db.run(`
  CREATE INDEX idx_payments_processed_by
  ON payments(processedBy);
`);

console.log("Payments table and index created in memory (worker)");

type Payment = {
  correlationId: string;
  amount: number;
  processedBy?: string;
};

const insertPayment = db.prepare(
  "INSERT INTO payments (correlationId, amount, processedBy) VALUES ($correlationId, $amount, $processedBy)"
);

self.onmessage = (event: MessageEvent<{ type: string; payload?: any }>) => {
  try {
    if (event.data.type === "insert") {
      const payment: Payment = event.data.payload;
      insertPayment.run({
        $correlationId: payment.correlationId,
        $amount: payment.amount,
        $processedBy: "default",
      });
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
    self.postMessage({ type: "error", payload: err });
  }
};
