// engine.ts — the detection moat.
//
// Input: raw transaction data the user pastes/uploads — a CSV bank export, or
// free-form lines like "2026-05-12  NETFLIX.COM  -12.99". We do NOT need a bank
// API: we parse what the user already has.
//
// Output: a list of recurring charges, each tagged as a known subscription (via
// the merchant catalog) and scored for "zombie" risk — the charges quietly
// draining the account. Plus the total annualized spend and the likely savings.
//
// All deterministic, offline. The value an LLM/agent can't reproduce alone is
// (a) the curated merchant catalog with real cancellation/privacy contacts and
// (b) the cadence/zombie heuristics calibrated on real statement noise.

import { matchMerchant, MerchantInfo } from "./merchants.js";

export interface Txn {
  date: Date;
  rawDesc: string;
  amount: number; // positive = money leaving the account (a charge)
  currency?: string;
}

export type Cadence = "monthly" | "quarterly" | "yearly" | "weekly" | "irregular";

export interface RecurringCharge {
  merchant: string;
  category: string;
  knownSubscription: boolean;
  hardToCancel: boolean;
  cadence: Cadence;
  occurrences: number;
  amountTypical: number;       // representative charge amount
  currency: string;
  firstSeen: string;           // ISO date
  lastSeen: string;            // ISO date
  daysSinceLast: number;
  annualizedCost: number;      // projected yearly spend at current cadence
  zombieScore: number;         // 0-100, higher = more likely a wasted "zombie"
  zombieReasons: string[];
  verdict: "ZOMBIE" | "REVIEW" | "ACTIVE";
  cancelHint?: string;
  privacyContact?: string;
  // identifiers used by the letter generator
  descriptorExample: string;
}

export interface ScanResult {
  generatedAt: string;
  txnCount: number;
  recurringCount: number;
  zombieCount: number;
  currency: string;
  totalAnnualizedRecurring: number;
  estimatedZombieSavings: number; // annualized cost of ZOMBIE-verdict items
  charges: RecurringCharge[];
  notes: string[];
}

// ---------------------------------------------------------------------------
// Parsing
// ---------------------------------------------------------------------------

const CURRENCY_SYMBOL: Record<string, string> = {
  "$": "USD", "€": "EUR", "£": "GBP", "USD": "USD", "EUR": "EUR", "GBP": "GBP",
};

function detectCurrency(s: string): string | undefined {
  for (const [sym, code] of Object.entries(CURRENCY_SYMBOL)) {
    if (s.includes(sym)) return code;
  }
  return undefined;
}

function parseAmount(s: string): number | null {
  // Strip currency symbols, thousands separators; handle both 1.234,56 and 1,234.56.
  let t = s.replace(/[^\d.,\-()]/g, "").trim();
  if (!t) return null;
  const neg = /^\(.*\)$/.test(t) || t.includes("-");
  t = t.replace(/[()]/g, "").replace(/-/g, "");
  // If both separators present, the last one is the decimal separator.
  if (t.includes(",") && t.includes(".")) {
    if (t.lastIndexOf(",") > t.lastIndexOf(".")) t = t.replace(/\./g, "").replace(",", ".");
    else t = t.replace(/,/g, "");
  } else if (t.includes(",")) {
    // Lone comma: decimal if it has exactly 2 trailing digits, else thousands.
    const parts = t.split(",");
    if (parts[parts.length - 1].length === 2) t = t.replace(",", ".");
    else t = t.replace(/,/g, "");
  }
  const n = Number(t);
  if (!isFinite(n)) return null;
  return neg ? -n : n;
}

function parseDate(s: string): Date | null {
  const t = s.trim();
  // ISO yyyy-mm-dd or yyyy/mm/dd
  let m = t.match(/(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/);
  if (m) return mk(+m[1], +m[2], +m[3]);
  // dd/mm/yyyy or mm/dd/yyyy — prefer dd/mm if first > 12 (European bank exports)
  m = t.match(/(\d{1,2})[-/.](\d{1,2})[-/.](\d{2,4})/);
  if (m) {
    let a = +m[1], b = +m[2];
    const y = m[3].length === 2 ? 2000 + +m[3] : +m[3];
    if (a > 12 && b <= 12) return mk(y, b, a);     // dd/mm
    if (b > 12 && a <= 12) return mk(y, a, b);     // mm/dd
    return mk(y, b, a);                            // ambiguous: assume dd/mm (most exports we target)
  }
  const d = new Date(t);
  return isNaN(+d) ? null : d;
}

function mk(y: number, mo: number, d: number): Date | null {
  const dt = new Date(Date.UTC(y, mo - 1, d));
  return isNaN(+dt) ? null : dt;
}

/** Split a line into fields, respecting simple quoting. Picks ONE delimiter:
 *  tab or ';' take priority over ',' (European exports use ';' because the
 *  values themselves contain comma decimals — splitting on ',' would shatter them). */
function splitFields(line: string): string[] {
  const delim = line.includes("\t") ? "\t" : line.includes(";") ? ";" : ",";
  const out: string[] = [];
  let cur = "", q = false;
  for (const ch of line) {
    if (ch === '"') { q = !q; continue; }
    if (!q && ch === delim) { out.push(cur); cur = ""; continue; }
    cur += ch;
  }
  out.push(cur);
  return out.map((s) => s.trim());
}

/**
 * Parse arbitrary transaction text. Tries CSV columns first; falls back to
 * "find a date, find an amount, the rest is the descriptor" per line.
 */
export function parseTransactions(input: string): { txns: Txn[]; notes: string[] } {
  const notes: string[] = [];
  const lines = input.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const txns: Txn[] = [];

  for (const line of lines) {
    // skip obvious header rows
    if (/\b(date|description|amount|merchant|fecha|importe|concepto)\b/i.test(line) &&
        !/\d/.test(line.replace(/\b(19|20)\d{2}\b/, ""))) {
      continue;
    }
    const fields = splitFields(line);
    let date: Date | null = null;
    let amount: number | null = null;
    let descParts: string[] = [];

    if (fields.length >= 2) {
      for (const f of fields) {
        if (!date) { const d = parseDate(f); if (d) { date = d; continue; } }
      }
      // amount = the numeric field that looks most like money (has decimals or sign)
      let amtField = "";
      for (const f of fields) {
        if (/[\d].*[.,]\d{2}\b/.test(f) || /^[-(]?\s*[$€£]?\s*\d/.test(f)) {
          const a = parseAmount(f);
          if (a !== null && Math.abs(a) > 0) { amount = a; amtField = f; }
        }
      }
      descParts = fields.filter((f) => f && f !== amtField && !parseDate(f));
    }

    if (date === null || amount === null) {
      // free-form fallback
      const dm = line.match(/\d{4}[-/.]\d{1,2}[-/.]\d{1,2}|\d{1,2}[-/.]\d{1,2}[-/.]\d{2,4}/);
      if (dm) date = parseDate(dm[0]);
      const am = line.match(/[-(]?\s*[$€£]?\s*\d[\d.,]*\d/g);
      if (am) {
        for (const cand of am) { const a = parseAmount(cand); if (a !== null && Math.abs(a) >= 0.5) amount = a; }
      }
      descParts = [line.replace(dm?.[0] ?? "", "").replace(/[-(]?\s*[$€£]?\s*\d[\d.,]*\d/g, "").trim()];
    }

    if (date && amount !== null && Math.abs(amount) >= 0.5) {
      const desc = descParts.join(" ").replace(/\s+/g, " ").trim();
      if (desc.length >= 2) {
        txns.push({
          date,
          rawDesc: desc,
          amount: Math.abs(amount), // we care about charges; sign conventions vary by bank
          currency: detectCurrency(line),
        });
      }
    }
  }

  if (txns.length === 0) notes.push("No transactions could be parsed. Expected lines with a date and an amount, e.g. '2026-05-12, NETFLIX.COM, -12.99'.");
  return { txns, notes };
}

// ---------------------------------------------------------------------------
// Recurrence + zombie detection
// ---------------------------------------------------------------------------

function median(xs: number[]): number {
  if (!xs.length) return 0;
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

function classifyCadence(gapsDays: number[]): Cadence {
  if (gapsDays.length === 0) return "irregular";
  const g = median(gapsDays);
  if (g >= 5 && g <= 9) return "weekly";
  if (g >= 24 && g <= 38) return "monthly";
  if (g >= 80 && g <= 100) return "quarterly";
  if (g >= 330 && g <= 400) return "yearly";
  return "irregular";
}

function annualMultiplier(c: Cadence): number {
  switch (c) {
    case "weekly": return 52;
    case "monthly": return 12;
    case "quarterly": return 4;
    case "yearly": return 1;
    default: return 0;
  }
}

/** Group transactions into merchant buckets using catalog + normalized descriptor. */
function bucketKey(t: Txn): { key: string; info?: MerchantInfo; label: string } {
  const info = matchMerchant(t.rawDesc);
  if (info) return { key: "M:" + info.name, info, label: info.name };
  // normalize: drop trailing store ids / dates / locations
  const norm = t.rawDesc
    .toLowerCase()
    .replace(/\b\d{2,}\b/g, " ")
    .replace(/[^a-z0-9 ]/g, " ")
    .replace(/\b(payment|recurring|subscription|sub|autopay|pos|card|purchase|dd|ach|sepa|pmt)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .split(" ").slice(0, 3).join(" ");
  return { key: "N:" + norm, label: titleCase(norm || t.rawDesc) };
}

function titleCase(s: string): string {
  return s.replace(/\w\S*/g, (w) => w.charAt(0).toUpperCase() + w.slice(1));
}

const DAY = 86400000;

export function detectRecurring(txns: Txn[], opts?: { today?: Date }): ScanResult {
  const today = opts?.today ?? new Date();
  const buckets = new Map<string, { info?: MerchantInfo; label: string; items: Txn[] }>();

  for (const t of txns) {
    const { key, info, label } = bucketKey(t);
    if (!buckets.has(key)) buckets.set(key, { info, label, items: [] });
    buckets.get(key)!.items.push(t);
  }

  const currencyCounts: Record<string, number> = {};
  for (const t of txns) { const c = t.currency ?? "USD"; currencyCounts[c] = (currencyCounts[c] ?? 0) + 1; }
  const reportCurrency = Object.entries(currencyCounts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? "USD";

  const charges: RecurringCharge[] = [];

  for (const [, b] of buckets) {
    const items = b.items.sort((a, c) => +a.date - +c.date);
    // Recurring requires >=2 charges of similar amount OR a known subscription seen once.
    const amounts = items.map((i) => i.amount);
    const typ = median(amounts);
    const similar = items.filter((i) => Math.abs(i.amount - typ) <= Math.max(0.5, typ * 0.25));

    const isKnown = !!b.info;
    if (similar.length < 2 && !isKnown) continue; // not enough evidence of a recurring sub

    const dates = similar.length >= 2 ? similar.map((i) => i.date) : items.map((i) => i.date);
    const gaps: number[] = [];
    for (let i = 1; i < dates.length; i++) gaps.push((+dates[i] - +dates[i - 1]) / DAY);
    let cadence = classifyCadence(gaps);
    // A known subscription seen once: infer cadence from the amount. A small
    // lone charge is most likely monthly; a large one (>$40) is most likely an
    // annual plan (assuming monthly would wildly overstate the yearly cost).
    if (cadence === "irregular" && isKnown && items.length === 1) {
      cadence = typ > 40 ? "yearly" : "monthly";
    }

    const occ = Math.max(similar.length, items.length);
    const firstSeen = dates[0];
    const lastSeen = dates[dates.length - 1];
    const daysSinceLast = Math.round((+today - +lastSeen) / DAY);
    const mult = annualMultiplier(cadence);
    const annualized = mult > 0 ? typ * mult : typ * 12 * 0; // irregular -> not annualized
    const annualizedCost = mult > 0 ? +(typ * mult).toFixed(2) : +(typ).toFixed(2);

    // ---- zombie scoring -------------------------------------------------
    const reasons: string[] = [];
    let score = 0;

    // 1. Stale: charged recently but the cadence window has clearly lapsed = still paying.
    //    Conversely, a known sub still being charged with NO sign of use is the classic zombie.
    if (cadence === "monthly" && daysSinceLast <= 35) {
      // it's live; zombie risk comes from "set and forgotten", price creep, hard-to-cancel
      score += 25; reasons.push("Active recurring charge that's easy to forget");
    }
    if (cadence === "yearly") { score += 30; reasons.push("Annual charge — easy to forget you ever signed up"); }

    // 2. Price creep: charges trending up across occurrences. A >3% rise (or any
    //    rise of at least 0.50 in the currency unit) is a silent increase worth flagging.
    if (similar.length >= 2) {
      const firstAmt = similar[0].amount, lastAmt = similar[similar.length - 1].amount;
      if (lastAmt > firstAmt && (lastAmt - firstAmt >= 0.5 || lastAmt > firstAmt * 1.03)) {
        score += 20; reasons.push(`Price rose from ${firstAmt.toFixed(2)} to ${lastAmt.toFixed(2)} — silent increase`);
      }
    }

    // 3. Free-trial-then-charge pattern: first charge much later / a 0 or tiny first amount.
    if (items.length >= 2 && items[0].amount <= 1 && items[1].amount > 1) {
      score += 25; reasons.push("Looks like a free trial that converted to paid");
    }

    // 4. Hard-to-cancel services are higher zombie value (people give up).
    if (b.info?.hardToCancel) { score += 20; reasons.push("Known for hard-to-cancel / dark-pattern flows"); }

    // 5. Small "below the radar" amounts are the ones people never notice.
    if (typ > 0 && typ <= 15) { score += 10; reasons.push("Small amount that slips under the radar"); }

    // 6. Long-running: many occurrences over a long span = deeply entrenched.
    if (occ >= 6) { score += 10; reasons.push(`${occ} charges over time — a long-standing drain`); }

    score = Math.min(100, score);

    let verdict: RecurringCharge["verdict"];
    if (score >= 55) verdict = "ZOMBIE";
    else if (score >= 30) verdict = "REVIEW";
    else verdict = "ACTIVE";

    charges.push({
      merchant: b.label,
      category: b.info?.category ?? "Recurring charge",
      knownSubscription: isKnown,
      hardToCancel: !!b.info?.hardToCancel,
      cadence,
      occurrences: occ,
      amountTypical: +typ.toFixed(2),
      currency: reportCurrency,
      firstSeen: firstSeen.toISOString().slice(0, 10),
      lastSeen: lastSeen.toISOString().slice(0, 10),
      daysSinceLast,
      annualizedCost,
      zombieScore: score,
      zombieReasons: reasons,
      verdict,
      cancelHint: b.info?.cancelHint,
      privacyContact: b.info?.privacyContact,
      descriptorExample: items[0].rawDesc,
    });
  }

  // Sort: zombies first, then by annualized cost desc.
  charges.sort((a, b) => {
    const order = { ZOMBIE: 0, REVIEW: 1, ACTIVE: 2 };
    if (order[a.verdict] !== order[b.verdict]) return order[a.verdict] - order[b.verdict];
    return b.annualizedCost - a.annualizedCost;
  });

  const totalAnnual = +charges.reduce((s, c) => s + c.annualizedCost, 0).toFixed(2);
  const zombieSavings = +charges.filter((c) => c.verdict === "ZOMBIE").reduce((s, c) => s + c.annualizedCost, 0).toFixed(2);

  return {
    generatedAt: new Date().toISOString(),
    txnCount: txns.length,
    recurringCount: charges.length,
    zombieCount: charges.filter((c) => c.verdict === "ZOMBIE").length,
    currency: reportCurrency,
    totalAnnualizedRecurring: totalAnnual,
    estimatedZombieSavings: zombieSavings,
    charges,
    notes: [],
  };
}

/** End-to-end: raw text -> scan result. */
export function scan(input: string, opts?: { today?: Date }): ScanResult {
  const { txns, notes } = parseTransactions(input);
  const result = detectRecurring(txns, opts);
  result.notes = notes;
  return result;
}
