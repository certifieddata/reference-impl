// Replay the sample decisions log into a fresh ledger and dump a regulator-ready
// evidence bundle for the last decision. Run: npm run example:03

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { randomUUID } from "node:crypto";
import { MemoryLedger, verifyChain } from "../ledger.js";
import { article12Event } from "../article12.js";

const here = dirname(fileURLToPath(import.meta.url));
const fixturesDir = join(here, "..", "..", "fixtures");

const decisions = readFileSync(join(fixturesDir, "decisions.jsonl"), "utf8")
  .trim()
  .split("\n")
  .map((line) => JSON.parse(line) as { decision_id: string; input: unknown; output: unknown });

const ledger = new MemoryLedger();
for (const d of decisions) {
  await ledger.append(article12Event({
    decision_id: d.decision_id,
    training_cert_id: "ce_2026_credit_model_v3",
    model_version: "credit-v3.2.1",
    input: d.input,
    output: d.output,
    timestamp: new Date().toISOString(),
    reviewer_id: randomUUID(),
  }));
}

const last = decisions[decisions.length - 1];
const bundle = await ledger.evidenceBundle(last.decision_id);

process.stdout.write(JSON.stringify({
  bundle,
  re_verified_locally: verifyChain(bundle.entries),
}, null, 2) + "\n");
