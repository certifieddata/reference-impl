// Minimal Decision Ledger client.
//
// A Decision Ledger is an append-only, hash-chained log: each event is anchored
// to its predecessor via `prev_hash`, and `this_hash` covers the canonical bytes
// of the event plus that prev_hash. Any reordering, mutation, or insertion
// breaks the chain and is detectable in O(n) by re-walking it.
//
// Ships with a MemoryLedger (for the demo) and an HttpLedger (for production).
// Both expose the same surface so the example app doesn't care which is wired up.

import { createHash } from "node:crypto";
import type { Article12Event } from "./article12.js";

export interface LedgerEntry {
  event_id: string;
  sequence: number;
  prev_hash: string;
  this_hash: string;
  event: Article12Event;
}

export interface EvidenceBundle {
  decision_id: string;
  entries: LedgerEntry[];
  chain_verified: boolean;
}

export interface Ledger {
  append(event: Article12Event): Promise<LedgerEntry>;
  evidenceBundle(decisionId: string): Promise<EvidenceBundle>;
}

const GENESIS_PREV_HASH = "sha256:" + "0".repeat(64);

function canonicalEntryBytes(event: Article12Event, prevHash: string, sequence: number): Buffer {
  // We sign the event payload alongside its position and predecessor — sequence and
  // prev_hash are part of the chain commitment, not optional metadata.
  return Buffer.from(JSON.stringify({ event, prev_hash: prevHash, sequence }), "utf8");
}

function hashEntry(event: Article12Event, prevHash: string, sequence: number): string {
  const hex = createHash("sha256").update(canonicalEntryBytes(event, prevHash, sequence)).digest("hex");
  return `sha256:${hex}`;
}

export function verifyChain(entries: LedgerEntry[]): boolean {
  let expectedPrev = GENESIS_PREV_HASH;
  let expectedSeq = 0;
  for (const e of entries) {
    if (e.prev_hash !== expectedPrev) return false;
    if (e.sequence !== expectedSeq) return false;
    if (e.this_hash !== hashEntry(e.event, e.prev_hash, e.sequence)) return false;
    expectedPrev = e.this_hash;
    expectedSeq++;
  }
  return true;
}

export class MemoryLedger implements Ledger {
  private entries: LedgerEntry[] = [];

  async append(event: Article12Event): Promise<LedgerEntry> {
    const prev = this.entries.length === 0 ? GENESIS_PREV_HASH : this.entries[this.entries.length - 1].this_hash;
    const sequence = this.entries.length;
    const this_hash = hashEntry(event, prev, sequence);
    const entry: LedgerEntry = {
      event_id: `le_${sequence.toString().padStart(8, "0")}`,
      sequence,
      prev_hash: prev,
      this_hash,
      event,
    };
    this.entries.push(entry);
    return entry;
  }

  async evidenceBundle(decisionId: string): Promise<EvidenceBundle> {
    const idx = this.entries.findIndex((e) => e.event.decision_id === decisionId);
    if (idx < 0) return { decision_id: decisionId, entries: [], chain_verified: false };
    const slice = this.entries.slice(0, idx + 1);
    return { decision_id: decisionId, entries: slice, chain_verified: verifyChain(slice) };
  }
}

export class HttpLedger implements Ledger {
  constructor(private readonly url: string) {}

  async append(event: Article12Event): Promise<LedgerEntry> {
    const res = await fetch(`${this.url.replace(/\/$/, "")}/append`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ event }),
    });
    if (!res.ok) throw new Error(`ledger append failed: HTTP ${res.status}`);
    return res.json() as Promise<LedgerEntry>;
  }

  async evidenceBundle(decisionId: string): Promise<EvidenceBundle> {
    const res = await fetch(`${this.url.replace(/\/$/, "")}/evidence/${encodeURIComponent(decisionId)}`);
    if (!res.ok) throw new Error(`ledger evidence fetch failed: HTTP ${res.status}`);
    const bundle = (await res.json()) as EvidenceBundle;
    return { ...bundle, chain_verified: verifyChain(bundle.entries) };
  }
}

export function makeLedger(opts: { url?: string } = {}): Ledger {
  return opts.url ? new HttpLedger(opts.url) : new MemoryLedger();
}
