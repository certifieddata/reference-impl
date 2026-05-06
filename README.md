# reference-impl

[![CI](https://github.com/certifieddata/reference-impl/actions/workflows/ci.yml/badge.svg)](https://github.com/certifieddata/reference-impl/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![Use this template](https://img.shields.io/badge/use%20this-template-181717?logo=github)](https://github.com/certifieddata/reference-impl/generate)

> Reference implementation: a high-risk AI system logging EU AI Act Article 12 evidence with CertifiedData.io's Decision Ledger.

A ~30-line credit-scoring service that:

1. **Refuses to boot** unless its training-data certificate verifies via [`@certifieddata/verify`](https://github.com/certifieddata/verify).
2. **Appends an Article 12 event** to a hash-chained Decision Ledger for every decision.
3. **Exports a regulator-ready evidence bundle** for any decision via `/evidence/:id`.

## Quickstart

```bash
git clone https://github.com/certifieddata/reference-impl.git
cd reference-impl
docker compose up
```

Then in another terminal:

```bash
curl -X POST localhost:3000/decide \
  -H 'content-type: application/json' \
  -d '{"income": 80000, "debt": 20000}'
# → {"decision_id":"...","approved":true,"score":0.6}

curl localhost:3000/evidence/<decision_id>
# → {"decision_id":"...","entries":[...],"chain_verified":true}
```

## What this proves

- Training data was **certified** as synthetic before it touched the model — the service literally refuses to start otherwise.
- **Every decision** is hash-chained, tamper-evident, and linked back to the training certificate.
- A **regulator can replay** any decision from the evidence bundle and re-verify the chain locally.

## The 50-line app

[`src/app.ts`](src/app.ts) is the entire example. Imports and comments aside, it is 33 lines of meaningful code:

```ts
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
```

Drop `mockModel` for your real inference, point `LEDGER_URL` at a production Decision Ledger, and you have an Article 12-compliant logging surface.

## Article 12 mapping

Every field in the ledger event maps explicitly to a paragraph in EU AI Act Article 12. See [ARTICLE_12_MAPPING.md](ARTICLE_12_MAPPING.md) for the full table.

## Run it locally

```bash
npm install
npm run fixtures        # regenerate signed training cert + keys
npm run build
npm test                # 3 smoke tests
npm start               # serve on :3000

# Or with Docker:
docker compose up
```

The fixtures include a real Ed25519 keypair and a real signed `cert.v1`. They are committed so reviewers can verify the verifier without trusting any pre-built artifact.

## Examples

```bash
npm run example:01      # log one Article 12 event
npm run example:02      # verify the training-data certificate
npm run example:03      # export an evidence bundle and re-verify the chain
```

## Use this as a template

```bash
gh repo create my-org/my-credit-scoring-service \
  --template certifieddata/reference-impl \
  --public
```

Then replace `scoreCredit` with your real model inference and replace the `MemoryLedger` URL with your production Decision Ledger.

## What this is not

- **Not a certified compliance product.** Do not deploy this and tell a regulator your obligations are met.
- **Not legal advice.** Final Article 12 compliance is determined by the deployer's risk management system per Article 9 of the EU AI Act.
- **Not a substitute for Article 9 risk management documentation.** This implementation handles the recording obligation, not the risk-assessment obligation.

## Related projects

- [`@certifieddata/verify`](https://github.com/certifieddata/verify) — the audit-friendly CLI/SDK this app imports
- [`@certifieddata/pii-scan`](https://github.com/certifieddata/pii-scan) — scan datasets for PII before certifying them

## License

MIT — see [LICENSE](LICENSE).
