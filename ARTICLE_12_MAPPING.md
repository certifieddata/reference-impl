# EU AI Act Article 12 → ledger event mapping

This document maps each requirement in **Article 12 ("Record-keeping")** of the EU AI Act onto a concrete field in the Decision Ledger event shape that this reference implementation emits.

> **This is a reference implementation, not legal advice.** Final Article 12 compliance is determined by the deployer's risk management system per Article 9 of the EU AI Act. The mapping below is one defensible interpretation, not the only one.

## Article 12(1) — Logging obligation

> *High-risk AI systems shall technically allow for the automatic recording of events ('logs') over the lifetime of the system.*

| Article 12 requirement | Ledger event field | Notes |
|---|---|---|
| Recording of events ('logs') over the lifetime of the system | `entries[]` append-only | Every `POST /decide` produces one entry. The ledger is hash-chained: tampering with any entry is detectable in O(n). |
| Tamper evidence | `prev_hash`, `this_hash` | `this_hash = sha256(canonicalize({event, prev_hash, sequence}))`. Any reorder, mutation, or insertion breaks the chain. The `verifyChain()` helper in `src/ledger.ts` re-walks and confirms. |

## Article 12(2)(a) — Period of use

> *Logs shall record at least: the period of each use of the system.*

| Article 12 requirement | Ledger event field | Notes |
|---|---|---|
| Period of each use of the system | `event.timestamp` | ISO-8601 UTC, recorded at decision time. If your inference takes non-trivial time, record `started_at`/`ended_at` as well. |

## Article 12(2)(b) — Reference database checked against

> *Logs shall record at least: the reference database against which input data has been checked by the system.*

| Article 12 requirement | Ledger event field | Notes |
|---|---|---|
| Reference database against which input data has been checked | `event.training_cert_id` | The CertifiedData.io certification ID that bound the training dataset to the deployed model. The dataset itself is not stored in the ledger — its hash is bound into the cert, and the cert is verified at startup. |
| Dataset integrity | (transitively) `cert.dataset_hash` | Stored on the `cert.v1` document, not on the ledger entry; re-verifiable any time with `certifieddata-verify`. |

## Article 12(2)(c) — Input data leading to a match

> *Logs shall record at least: the input data for which the search has led to a match.*

| Article 12 requirement | Ledger event field | Notes |
|---|---|---|
| Input data leading to a match | `event.input_hash` | `sha256(JSON(input))`. The raw input is **not** written to the ledger to limit GDPR/PII exposure; the hash binds the decision to a specific input without retaining the input itself. If the deployer's risk management requires retaining inputs, store them in a separate, access-controlled store and add `input_storage_ref` to the event. |

## Article 12(2)(d) — Identification of natural persons involved in verification

> *Logs shall record at least: the identification of the natural persons involved in the verification of the results.*

| Article 12 requirement | Ledger event field | Notes |
|---|---|---|
| Identification of natural persons involved in verification | `event.reviewer_id` | Optional. Null for fully-automated decisions. Set by the human-in-the-loop reviewer when the system routes a decision to them. The deployer's identity-management system maps `reviewer_id` back to a real person under controlled conditions. |

## Beyond Article 12

These fields are not required by Article 12 but are emitted to support broader EU AI Act obligations:

| Field | Why |
|---|---|
| `event.model_version` | Article 14 (human oversight) and Article 15 (accuracy) require knowing which model produced a given output. |
| `event.output` | Article 13 (transparency) and Article 14 require explainability of outputs to affected persons. |
| `event.schema_version` | Schema evolution. Pinned to `article12.v1` for this release. |

## What's deliberately not in the ledger

- **Raw inputs.** Hashed only — see Article 12(2)(c) above.
- **Model weights.** Bound to the training cert, not the ledger.
- **Training data rows.** Bound to the training cert by hash, not the ledger.
- **PII about the affected person.** The deployer's data-protection regime (GDPR Article 32, AI Act Recital 60) governs this. We default to "log nothing personal" and let the deployer add fields under their controllership.

## Verifying the chain

Anyone with access to an evidence bundle can verify the chain locally without trusting the ledger backend:

```ts
import { verifyChain } from "@certifieddata/reference-impl";
const ok = verifyChain(bundle.entries);  // boolean
```

The reference implementation re-runs `verifyChain` on every `evidence/:id` response and exposes the result as `chain_verified` so consumers don't have to.
