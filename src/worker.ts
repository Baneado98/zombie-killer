// worker.ts — Cloudflare Workers entrypoint.
//
// Serves the full HUMAN surface (landing + /api/scan + /api/preview +
// /api/package + NOWPayments checkout) using only the pure logic modules and
// the Workers fetch API — no Express, no Node http. The x402 AGENT surface
// lives on the Vercel deploy (which uses x402-express); discovery manifests
// here point agents there.
//
// We DRAFT letters; the human sends them. The worker holds no private key.

import { scan, RecurringCharge } from "./engine.js";
import { generateLetter, generatePackage, LetterType, Jurisdiction, UserContext } from "./letters.js";
import { LANDING_HTML } from "./landing.js";

interface Env {
  X402_PAYTO?: string;
  X402_PRICE?: string;
  PUBLIC_BASE_URL?: string;
  X402_VERCEL_URL?: string;        // where the x402 /pro surface lives
  NOWPAYMENTS_API_KEY?: string;
  NOWPAYMENTS_BASE?: string;
  INDEX402_HASH?: string;
}

const J = (o: unknown, status = 200) =>
  new Response(JSON.stringify(o), { status, headers: { "content-type": "application/json", "access-control-allow-origin": "*" } });

const NPBASE = (e: Env) => e.NOWPAYMENTS_BASE ?? "https://api.nowpayments.io/v1";

async function npStatus(e: Env, id: string) {
  if (!e.NOWPAYMENTS_API_KEY) throw new Error("Crypto checkout not configured yet (NOWPAYMENTS_API_KEY unset).");
  const r = await fetch(`${NPBASE(e)}/payment/${encodeURIComponent(id)}`, { headers: { "x-api-key": e.NOWPAYMENTS_API_KEY } });
  const j: any = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(`NOWPayments status ${r.status}: ${JSON.stringify(j)}`);
  return j;
}

async function paymentUnlocks(e: Env, id: string): Promise<{ ok: boolean; reason: string }> {
  if (!id) return { ok: false, reason: "no_payment_id" };
  if (!e.NOWPAYMENTS_API_KEY) return { ok: false, reason: "crypto_checkout_not_configured" };
  try {
    const s = await npStatus(e, id);
    const st = String(s.payment_status ?? "").toLowerCase();
    return (["finished", "confirmed", "sending"].includes(st)) ? { ok: true, reason: st } : { ok: false, reason: `payment_status_${st || "unknown"}` };
  } catch { return { ok: false, reason: "verification_error" }; }
}

function userCtxFrom(o: any): UserContext {
  return { fullName: o?.fullName, email: o?.email, accountId: o?.accountId, jurisdiction: o?.jurisdiction as Jurisdiction | undefined };
}

function buildPackage(data: string, onlyZombies: boolean, types: LetterType[] | undefined, user: UserContext) {
  const result = scan(data);
  const chosen = result.charges.filter((c) => onlyZombies ? c.verdict === "ZOMBIE" : c.verdict !== "ACTIVE");
  const pkg = generatePackage(chosen, user, types);
  return {
    summary: {
      zombieCount: result.zombieCount, estimatedZombieSavings: result.estimatedZombieSavings,
      totalAnnualizedRecurring: result.totalAnnualizedRecurring, currency: result.currency, merchantsInPackage: pkg.length,
    },
    package: pkg,
  };
}

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    const url = new URL(req.url);
    const path = url.pathname;
    const BASE = env.PUBLIC_BASE_URL ?? `${url.protocol}//${url.host}`;
    const PRICE = env.X402_PRICE ?? "$0.50";
    const PAYTO = env.X402_PAYTO ?? "0x074cFCfDf4509333a8d8dC0f90D18Ef276481c21";
    const XURL = env.X402_VERCEL_URL ?? "https://zombie-killer.vercel.app";

    if (req.method === "OPTIONS")
      return new Response(null, { headers: { "access-control-allow-origin": "*", "access-control-allow-methods": "GET,POST,OPTIONS", "access-control-allow-headers": "content-type" } });

    // ---- landing -----------------------------------------------------------
    if (path === "/" || path === "") {
      if (String(req.headers.get("accept") ?? "").includes("application/json"))
        return J({ name: "zombie-killer", description: "Detect zombie subscriptions + draft cancel/renegotiate/GDPR-CCPA letters.", repo: "https://github.com/Baneado98/zombie-killer" });
      return new Response(LANDING_HTML(BASE, PRICE), { headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" } });
    }
    if (path === "/health") return J({ ok: true });
    if (path === "/.well-known/402index-verify.txt")
      return new Response(env.INDEX402_HASH ?? "pending", { headers: { "content-type": "text/plain" } });

    // ---- x402 discovery (points agents to the Vercel /pro surface) ---------
    if (path === "/openapi.json") {
      const amount = Number(PRICE.replace("$", "")) || 0.5;
      const payInfo = { price: { currency: "USD", mode: "fixed", amount }, protocols: [{ x402: { scheme: "exact", network: "base", asset: "USDC", payTo: PAYTO, maxAmountRequired: String(Math.round(amount * 1e6)) } }] };
      return J({
        openapi: "3.1.0",
        info: { title: "zombie-killer", version: "0.1.0", description: "Detect zombie subscriptions and draft cancel/renegotiate/GDPR-CCPA letters. Pay-per-call via x402 (USDC on Base).", contact: { email: "saraelkabir97@gmail.com" } },
        servers: [{ url: XURL }],
        paths: { "/pro/package": { get: { summary: "Full letter package (pay-per-call).", operationId: "proPackage", "x-payment-info": payInfo, responses: { "200": { description: "OK" }, "402": { description: "Payment required" } } } } },
      });
    }
    if (path === "/.well-known/x402" || path === "/.well-known/x402-listing") {
      return J({
        x402Version: 1, name: "zombie-killer",
        description: "Detect zombie subscriptions and draft cancel/renegotiate/GDPR-CCPA data-deletion letters. The human sends them.",
        category: "personal-finance", repository: "https://github.com/Baneado98/zombie-killer",
        mcp: { npx: "subkill-mcp", http: `${XURL}/mcp` },
        accepts: [{ method: "GET", path: "/pro/package", resource: `${XURL}/pro/package?data=2026-05-12,NETFLIX.COM,-12.99`, price: { amount: PRICE.replace("$", ""), currency: "USD", asset: "USDC", network: "base" }, payTo: PAYTO, scheme: "exact", description: "Full cancel/renegotiate/data-deletion letter package." }],
      });
    }

    // ---- FREE scan ---------------------------------------------------------
    if (path === "/api/scan" && req.method === "POST") {
      const body: any = await req.json().catch(() => ({}));
      const data = String(body?.data ?? "");
      if (!data.trim()) return J({ error: "Body field 'data' is required." }, 400);
      try { return J(scan(data)); } catch (e: any) { return J({ error: String(e?.message ?? e) }, 400); }
    }

    // ---- FREE single-letter preview ---------------------------------------
    if (path === "/api/preview" && req.method === "POST") {
      const b: any = await req.json().catch(() => ({}));
      const charge: RecurringCharge = {
        merchant: String(b.merchant ?? "this service"), category: "Recurring charge", knownSubscription: true,
        hardToCancel: false, cadence: b.cadence ?? "monthly", occurrences: 1, amountTypical: Number(b.amount ?? 0),
        currency: String(b.currency ?? "USD"), firstSeen: "", lastSeen: "", daysSinceLast: 0, annualizedCost: 0,
        zombieScore: 0, zombieReasons: [], verdict: "REVIEW", cancelHint: b.cancelHint, privacyContact: b.privacyContact, descriptorExample: String(b.merchant ?? ""),
      };
      return J(generateLetter("cancel", charge, {}));
    }

    // ---- PAID package (unlocked by confirmed NOWPayments id) ---------------
    if (path === "/api/package" && req.method === "POST") {
      const b: any = await req.json().catch(() => ({}));
      const data = String(b?.data ?? "");
      if (!data.trim()) return J({ error: "Body field 'data' is required." }, 400);
      const u = await paymentUnlocks(env, String(b?.paymentId ?? ""));
      if (!u.ok) return J({ error: "Payment required to unlock the letter package.", reason: u.reason, howToPay: { crypto: `${BASE}/api/pay/nowpayments`, x402: `${XURL}/pro/package` } }, 402);
      try { return J(buildPackage(data, !!b?.onlyZombies, b?.types, userCtxFrom(b))); } catch (e: any) { return J({ error: String(e?.message ?? e) }, 400); }
    }

    // ---- NOWPayments checkout ---------------------------------------------
    if (path === "/api/pay/nowpayments") {
      if (!env.NOWPAYMENTS_API_KEY)
        return J({ error: "Crypto checkout unavailable", detail: "Crypto checkout not configured yet (NOWPAYMENTS_API_KEY unset). AI agents can pay now via the x402 endpoint. Human checkout goes live once the NOWPayments key is set." }, 503);
      try {
        const amount = Number(PRICE.replace("$", "")) || 0.5;
        const r = await fetch(`${NPBASE(env)}/invoice`, {
          method: "POST", headers: { "x-api-key": env.NOWPAYMENTS_API_KEY, "content-type": "application/json" },
          body: JSON.stringify({ price_amount: amount, price_currency: "usd", order_id: url.searchParams.get("order") ?? `zk-${Date.now()}`, order_description: "zombie-killer — full subscription action letter package", success_url: `${BASE}/?paid=1` }),
        });
        const j: any = await r.json().catch(() => ({}));
        if (!r.ok) return J({ error: "Crypto checkout unavailable", detail: JSON.stringify(j) }, 503);
        return J({ provider: "nowpayments", invoiceId: j.id, payUrl: j.invoice_url, priceUsd: amount });
      } catch (e: any) { return J({ error: "Crypto checkout unavailable", detail: String(e?.message ?? e) }, 503); }
    }
    if (path === "/api/pay/status") {
      try { return J(await npStatus(env, url.searchParams.get("id") ?? "")); } catch (e: any) { return J({ error: String(e?.message ?? e) }, 400); }
    }

    return J({ error: "Not found. See GET / for the app." }, 404);
  },
};
