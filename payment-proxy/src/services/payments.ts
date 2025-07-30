import { db } from "../db";
import type { Payment } from "../types";

const insertPaymentSql = db.prepare(
  "INSERT INTO payments (correlationId, amount, processedBy) VALUES ($correlationId, $amount, $processedBy)"
);

export function insertPayment(payment: Payment) {
  insertPaymentSql.run({
    $correlationId: payment.correlationId,
    $amount: payment.amount,
    $processedBy: payment.processedBy ?? "default",
  });
}

export function getPaymentsSummary() {
  return db
    .query(
      "SELECT processedBy, COUNT(*) AS totalPagamentos, SUM(amount) AS totalAmount FROM payments GROUP BY processedBy;"
    )
    .get();
}
