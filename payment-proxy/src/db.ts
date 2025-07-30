import { Database } from "bun:sqlite";

export const db = new Database(":memory:");

db.run(`
  CREATE TABLE IF NOT EXISTS payments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    correlationId TEXT NOT NULL UNIQUE,
    amount REAL NOT NULL,
    processedBy TEXT NOT NULL,
    processedAt DATETIME NOT NULL DEFAULT (datetime('now'))
  );
  
  CREATE INDEX IF NOT EXISTS idxPaymentsProcessedBy ON payments(processedBy);

  CREATE TABLE IF NOT EXISTS serviceStatus (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    defaultFailing INTEGER NOT NULL DEFAULT 0,
    defaultMinResponseTime INTEGER NOT NULL DEFAULT 0,
    fallbackFailing INTEGER NOT NULL DEFAULT 0,
    fallbackMinResponseTime INTEGER NOT NULL DEFAULT 0
  );
`);
