// Minimum: log one Article 12 event into a fresh in-memory ledger.
// Run: npm run example:01

import { article12Event } from "../article12.js";
import { MemoryLedger } from "../ledger.js";
import { randomUUID } from "node:crypto";

const ledger = new MemoryLedger();

const entry = await ledger.append(article12Event({
  decision_id: randomUUID(),
  training_cert_id: "ce_2026_credit_model_v3",
  model_version: "credit-v3.2.1",
  input: { income: 80000, debt: 20000 },
  output: { approved: true, score: 0.6 },
  timestamp: new Date().toISOString(),
  reviewer_id: "ops-12",
}));

process.stdout.write(JSON.stringify(entry, null, 2) + "\n");
