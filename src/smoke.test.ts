import { test } from "node:test";
import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { createApp } from "./app.js";
import { verifyChain } from "./ledger.js";

const here = dirname(fileURLToPath(import.meta.url));
const fixturesDir = join(here, "..", "fixtures");

test("app boots when training cert verifies, refuses to boot otherwise", async () => {
  // Happy path
  const { app } = await createApp({
    trainingCert: join(fixturesDir, "training-cert.json"),
    keys: join(fixturesDir, "keys.json"),
  });
  assert.ok(app, "expected app instance");

  // Sad path — using the wrong keys document means the cert key_id is unknown.
  const otherKeys = JSON.stringify({ issuer: "CertifiedData.io", keys: [] });
  const { writeFileSync, mkdtempSync } = await import("node:fs");
  const { tmpdir } = await import("node:os");
  const tmp = mkdtempSync(join(tmpdir(), "cdri-"));
  const badKeysPath = join(tmp, "empty-keys.json");
  writeFileSync(badKeysPath, otherKeys);

  await assert.rejects(
    () => createApp({ trainingCert: join(fixturesDir, "training-cert.json"), keys: badKeysPath }),
    /training data not verified/,
  );
});

test("/decide logs an Article 12 event and /evidence/:id returns a verifiable chain", async () => {
  const { app } = await createApp({
    trainingCert: join(fixturesDir, "training-cert.json"),
    keys: join(fixturesDir, "keys.json"),
  });

  const decideRes = await app.fetch(new Request("http://x/decide", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ income: 80000, debt: 20000 }),
  }));
  assert.equal(decideRes.status, 200);
  const decision = await decideRes.json() as { decision_id: string; approved: boolean; score: number };
  assert.equal(typeof decision.decision_id, "string");
  assert.equal(typeof decision.approved, "boolean");

  const evidenceRes = await app.fetch(new Request(`http://x/evidence/${decision.decision_id}`));
  assert.equal(evidenceRes.status, 200);
  const bundle = await evidenceRes.json() as {
    decision_id: string;
    entries: Array<{ event: { decision_id: string; training_cert_id: string }; this_hash: string }>;
    chain_verified: boolean;
  };
  assert.equal(bundle.decision_id, decision.decision_id);
  assert.equal(bundle.chain_verified, true);
  assert.ok(bundle.entries.length >= 1, "expected at least one ledger entry");
  assert.equal(bundle.entries[bundle.entries.length - 1].event.decision_id, decision.decision_id);
  assert.equal(bundle.entries[0].event.training_cert_id, "ce_2026_credit_model_v3");
  // Re-verify the chain ourselves with the public helper, independent of the app.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  assert.equal(verifyChain(bundle.entries as any), true);
});

test("multiple decisions chain forward (sequence/prev_hash agree)", async () => {
  const { app } = await createApp({
    trainingCert: join(fixturesDir, "training-cert.json"),
    keys: join(fixturesDir, "keys.json"),
  });

  const ids: string[] = [];
  for (const body of [{ income: 50000, debt: 10000 }, { income: 20000, debt: 30000 }, { income: 90000, debt: 5000 }]) {
    const r = await app.fetch(new Request("http://x/decide", {
      method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body),
    }));
    ids.push(((await r.json()) as { decision_id: string }).decision_id);
  }

  const last = await (await app.fetch(new Request(`http://x/evidence/${ids[ids.length - 1]}`))).json() as {
    entries: unknown[]; chain_verified: boolean;
  };
  assert.equal(last.chain_verified, true);
  assert.ok(last.entries.length >= 3);
});
