// Regenerate the training-data certificate, keys document, and decisions sample.
// Self-contained — does not import from src/ so it can run before the build.

import { generateKeyPairSync, sign, createHash } from "node:crypto";
import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));

function canonicalize(v) {
  if (v === null) return "null";
  if (v === true) return "true";
  if (v === false) return "false";
  if (typeof v === "string") return jsString(v);
  if (typeof v === "number") {
    if (!Number.isFinite(v)) throw new RangeError("non-finite number");
    return Object.is(v, -0) ? "0" : JSON.stringify(v);
  }
  if (Array.isArray(v)) return "[" + v.map(canonicalize).join(",") + "]";
  if (typeof v === "object") {
    const keys = Object.keys(v).filter((k) => v[k] !== undefined).sort();
    return "{" + keys.map((k) => jsString(k) + ":" + canonicalize(v[k])).join(",") + "}";
  }
  throw new TypeError("unsupported value");
}
function jsString(s) {
  let o = '"';
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i);
    if (c === 0x22) o += '\\"';
    else if (c === 0x5c) o += "\\\\";
    else if (c === 0x08) o += "\\b";
    else if (c === 0x09) o += "\\t";
    else if (c === 0x0a) o += "\\n";
    else if (c === 0x0c) o += "\\f";
    else if (c === 0x0d) o += "\\r";
    else if (c < 0x20) o += "\\u" + c.toString(16).padStart(4, "0");
    else o += s[i];
  }
  return o + '"';
}
function rawEd25519PublicKey(publicKey) {
  const der = publicKey.export({ type: "spki", format: "der" });
  return Buffer.from(der.subarray(der.length - 32)).toString("base64");
}

const { privateKey, publicKey } = generateKeyPairSync("ed25519");
const keyId = "ck_2026_credit_training";

const trainingCsv = "income,debt,defaulted\n50000,10000,0\n80000,20000,0\n30000,25000,1\n100000,5000,0\n40000,30000,1\n";
writeFileSync(join(here, "training-data.csv"), trainingCsv);
const datasetHex = createHash("sha256").update(trainingCsv).digest("hex");

const certUnsigned = {
  certification_id: "ce_2026_credit_model_v3",
  timestamp: "2026-01-15T12:00:00Z",
  issuer: "CertifiedData.io",
  dataset_hash: `sha256:${datasetHex}`,
  algorithm: "DP-CTGAN",
  rows: 5,
  columns: 3,
  schema_version: "cert.v1",
  key_id: keyId,
  metadata: { epsilon: 1.0, description: "synthetic credit training data, DP-CTGAN ε=1.0" },
};
const sig = sign(null, Buffer.from(canonicalize(certUnsigned), "utf8"), privateKey);
const cert = { ...certUnsigned, signature: sig.toString("base64") };
writeFileSync(join(here, "training-cert.json"), JSON.stringify(cert, null, 2) + "\n");

const keysDoc = {
  issuer: "CertifiedData.io",
  keys: [
    {
      key_id: keyId,
      public_key: rawEd25519PublicKey(publicKey),
      algorithm: "ed25519",
      created_at: "2026-01-01T00:00:00Z",
      label: "credit-training-fixture",
    },
  ],
};
writeFileSync(join(here, "keys.json"), JSON.stringify(keysDoc, null, 2) + "\n");

// Sample decisions log — what example 03 exports as evidence.
const decisions = [
  { decision_id: "d_demo_001", input: { income: 80000, debt: 20000 }, output: { approved: true, score: 0.6 } },
  { decision_id: "d_demo_002", input: { income: 30000, debt: 25000 }, output: { approved: false, score: 0.05 } },
  { decision_id: "d_demo_003", input: { income: 100000, debt: 5000 }, output: { approved: true, score: 0.95 } },
];
writeFileSync(join(here, "decisions.jsonl"), decisions.map((d) => JSON.stringify(d)).join("\n") + "\n");

console.log("fixtures regenerated:");
console.log("  training-data.csv     —", datasetHex.slice(0, 12) + "…");
console.log("  training-cert.json    —", cert.certification_id);
console.log("  keys.json             —", keyId);
console.log("  decisions.jsonl       —", decisions.length, "sample decisions");
