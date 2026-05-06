// EU AI Act Article 12 reference application.
//
// This service refuses to boot unless its training-data certificate verifies,
// and appends an Article 12 event to the Decision Ledger for every decision.
// See ARTICLE_12_MAPPING.md for the field-by-field map of Article 12 → ledger event.

import { Hono } from "hono";
import { randomUUID } from "node:crypto";
import { verifyCertificate, loadKeys, fetchCert } from "@certifieddata/verify";
import { article12Event } from "./article12.js";
import { makeLedger } from "./ledger.js";

export interface AppOptions {
  trainingCert: string;
  keys: string;
  ledgerUrl?: string;
  modelVersion?: string;
}

export async function createApp(opts: AppOptions): Promise<{ app: Hono; certId: string }> {
  const cert = await fetchCert(opts.trainingCert, { offline: true });
  const keys = await loadKeys({ keysFile: opts.keys, offline: true });
  const verdict = await verifyCertificate(cert, keys);
  if (verdict.verdict !== "VALID") throw new Error(`training data not verified: ${verdict.reason}`);

  const ledger = makeLedger({ url: opts.ledgerUrl });
  const modelVersion = opts.modelVersion ?? "credit-v3.2.1";
  const app = new Hono();

  app.post("/decide", async (c) => {
    const input = await c.req.json<{ income?: number; debt?: number }>();
    const score = scoreCredit(input);
    const decision = { decision_id: randomUUID(), approved: score > 0.6, score };
    await ledger.append(article12Event({
      decision_id: decision.decision_id,
      training_cert_id: cert.certification_id,
      model_version: modelVersion,
      input, output: { approved: decision.approved, score },
      timestamp: new Date().toISOString(),
    }));
    return c.json(decision);
  });

  app.get("/evidence/:id", async (c) => c.json(await ledger.evidenceBundle(c.req.param("id"))));

  return { app, certId: cert.certification_id };
}

function scoreCredit(input: { income?: number; debt?: number }): number {
  return Math.max(0, Math.min(1, ((input.income ?? 0) - (input.debt ?? 0)) / 100000));
}
