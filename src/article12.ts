// EU AI Act Article 12 event shape.
//
// Article 12 ("Record-keeping") requires high-risk AI systems to log events
// "over the lifetime of the system" (Art. 12(1)) covering at minimum the items
// in Article 12(2)(a–d). This module maps each required item onto a concrete
// JSON field that we append to the Decision Ledger.
//
// This is a reference implementation. The deployer's risk management system
// (Article 9) determines what additional fields are required for a given
// high-risk use case. See ARTICLE_12_MAPPING.md for the full field-by-field map.

import { createHash } from "node:crypto";

export interface Article12Input {
  decision_id: string;
  training_cert_id: string;            // Art. 12(2)(c) — reference database
  model_version: string;
  input: unknown;                      // hashed; raw input is never written to the ledger
  output: unknown;
  timestamp: string;                   // Art. 12(2)(b) — period of use
  reviewer_id?: string;                // Art. 12(2)(d) — natural person involved in verification
}

export interface Article12Event {
  schema_version: "article12.v1";
  decision_id: string;
  timestamp: string;
  training_cert_id: string;
  model_version: string;
  input_hash: string;                  // sha256(JSON(input)) — Art. 12(2)(d)
  output: unknown;
  reviewer_id: string | null;
}

export function article12Event(input: Article12Input): Article12Event {
  const inputHash = createHash("sha256")
    .update(JSON.stringify(input.input))
    .digest("hex");

  return {
    schema_version: "article12.v1",
    decision_id: input.decision_id,
    timestamp: input.timestamp,
    training_cert_id: input.training_cert_id,
    model_version: input.model_version,
    input_hash: `sha256:${inputHash}`,
    output: input.output,
    reviewer_id: input.reviewer_id ?? null,
  };
}
