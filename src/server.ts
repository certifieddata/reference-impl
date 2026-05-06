// HTTP entry point. Boots the app and listens.
// `npm start` → reads TRAINING_CERT, TRAINING_KEYS, LEDGER_URL from env.

import { serve } from "@hono/node-server";
import { createApp } from "./app.js";

const port = Number(process.env.PORT ?? 3000);
const { app, certId } = await createApp({
  trainingCert: process.env.TRAINING_CERT ?? "fixtures/training-cert.json",
  keys: process.env.TRAINING_KEYS ?? "fixtures/keys.json",
  ledgerUrl: process.env.LEDGER_URL,
  modelVersion: process.env.MODEL_VERSION,
});

serve({ fetch: app.fetch, port }, (info) => {
  process.stdout.write(`reference-impl listening on :${info.port} — training_cert ${certId}\n`);
});
