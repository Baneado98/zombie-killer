// server.ts — zombie-killer HTTP server.
//
// HUMAN surface (a real web app):
//   GET  /                          -> landing + the interactive tool (paste data, see zombies)
//   POST /api/scan                  -> FREE. Parse data -> recurring charges + zombie verdicts
//                                      + total annual spend + savings. (The hook: free value.)
//   POST /api/package               -> PAID. Full letter package (cancel+renegotiate+GDPR).
//                                      Unlocked by a NOWPayments payment id, OR by x402.
//   GET  /api/pay/nowpayments       -> create a crypto checkout (if NOWPAYMENTS_API_KEY set)
//   GET  /api/pay/status?id=        -> poll a NOWPayments payment status
//
// AGENT surface (x402, machine-to-machine):
//   POST /mcp                       -> MCP-over-HTTP (free tools)
//   GET  /pro/package?data=..       -> PAID per call via x402 (USDC on Base) -> full package
//   GET  /openapi.json, /.well-known/x402  -> discovery
//
// We DRAFT letters; the human sends them. We never contact merchants or
// impersonate anyone. The server holds NO private key.

import express, { Request, Response, NextFunction } from "express";
import { paymentMiddleware, Network } from "x402-express";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { scan, RecurringCharge } from "./engine.js";
import { generatePackage, generateLetter, LetterType, Jurisdiction, UserContext } from "./letters.js";
import { buildMcpServer } from "./mcpServer.js";
import { LANDING_HTML } from "./landing.js";
import { createNowPayment, getNowPaymentStatus, paymentUnlocks } from "./pay.js";

const PORT = Number(process.env.PORT ?? 8080);
const BASE_URL = process.env.PUBLIC_BASE_URL ?? "https://zombie-killer.vercel.app";

const PAYTO = (process.env.X402_PAYTO ?? "0x074cFCfDf4509333a8d8dC0f90D18Ef276481c21") as `0x${string}`;
const NETWORK = (process.env.X402_NETWORK ?? "base") as Network;
const PRICE = process.env.X402_PRICE ?? "$0.50";
const FACILITATOR_URL = process.env.X402_FACILITATOR_URL;
const PAYMENTS_ENABLED = process.env.X402_ENABLED !== "false";
const MAX_AMOUNT = String(Math.round(Number(PRICE.replace("$", "") || "0.5") * 1e6));

const app = express();
app.disable("x-powered-by");

const landing = {
  name: "zombie-killer",
  description:
    "Find the zombie subscriptions silently draining your bank account, and get ready-to-send letters to cancel them, renegotiate the bill down, or wipe your data (GDPR/CCPA). You paste your statement; we detect the recurring charges and draft the letters. You send them.",
  endpoints: {
    "POST /api/scan": "Free. Paste bank/subscription data; get recurring charges + zombie verdicts + yearly savings.",
    "POST /api/package": "Paid. Full letter package: cancel + renegotiate + data-deletion for each charge.",
    "GET /pro/package?data=..": "Pay-per-call (x402, USDC on Base) — full package for AI agents.",
    "POST /mcp": "MCP-over-HTTP (free). Tools: scan_subscriptions, generate_letter, build_letter_package.",
  },
  repo: "https://github.com/Baneado98/zombie-killer",
};

app.get("/", (req, res) => {
  res.setHeader("Cache-Control", "no-store, max-age=0");
  if (String(req.headers.accept ?? "").includes("application/json")) return res.json(landing);
  res.type("html").send(LANDING_HTML(BASE_URL, PRICE));
});
app.get(["/api", "/index"], (_req, res) => res.json(landing));
app.get("/health", (_req, res) => res.json({ ok: true }));

// 402 Index domain-ownership proof.
app.get("/.well-known/402index-verify.txt", (_req, res) =>
  res.type("text/plain").send(process.env.INDEX402_HASH ?? "pending"));

// ---- x402 discovery --------------------------------------------------------
app.get("/openapi.json", (_req, res) => {
  const payInfo = {
    price: { currency: "USD", mode: "fixed", amount: Number(PRICE.replace("$", "")) || 0.5 },
    protocols: [{ x402: { scheme: "exact", network: "base", asset: "USDC", payTo: PAYTO, maxAmountRequired: MAX_AMOUNT } }],
  };
  res.json({
    openapi: "3.1.0",
    info: {
      title: "zombie-killer",
      version: "0.1.0",
      description: "Detect zombie subscriptions from bank data and generate cancel / renegotiate / GDPR-CCPA deletion letters. Pay-per-call via x402 (USDC on Base).",
      contact: { email: "saraelkabir97@gmail.com" },
    },
    servers: [{ url: BASE_URL }],
    paths: {
      "/pro/package": {
        get: {
          summary: "Scan raw bank data and return the full cancel/renegotiate/data-deletion letter package (pay-per-call).",
          operationId: "proPackage",
          "x-payment-info": payInfo,
          parameters: [
            { name: "data", in: "query", required: true, schema: { type: "string" }, description: "Raw transaction text (CSV or free-form lines)." },
            { name: "fullName", in: "query", required: false, schema: { type: "string" } },
            { name: "email", in: "query", required: false, schema: { type: "string" } },
            { name: "accountId", in: "query", required: false, schema: { type: "string" } },
            { name: "jurisdiction", in: "query", required: false, schema: { type: "string" }, description: "us|eu|uk|ca" },
          ],
          responses: { "200": { description: "Letter package (JSON)." }, "402": { description: "Payment required (x402)." } },
        },
      },
    },
  });
});

function x402Manifest() {
  return {
    x402Version: 1,
    name: "zombie-killer",
    description: "Detect zombie subscriptions from raw bank data and generate ready-to-send cancel / renegotiate / GDPR-CCPA data-deletion letters. The human sends them.",
    category: "personal-finance",
    repository: "https://github.com/Baneado98/zombie-killer",
    mcp: { npx: "subkill-mcp", http: `${BASE_URL}/mcp` },
    accepts: [
      {
        method: "GET", path: "/pro/package",
        resource: `${BASE_URL}/pro/package?data=2026-05-12,NETFLIX.COM,-12.99`,
        price: { amount: PRICE.replace("$", ""), currency: "USD", asset: "USDC", network: "base" },
        payTo: PAYTO, scheme: "exact",
        description: "Full cancel/renegotiate/data-deletion letter package for the detected subscriptions.",
      },
    ],
  };
}
app.get("/.well-known/x402", (_req, res) => res.json(x402Manifest()));
app.get("/.well-known/x402-listing", (_req, res) => res.json(x402Manifest()));

// ---- MCP-over-HTTP (free) — before json+x402 ------------------------------
app.post("/mcp", async (req: Request, res: Response) => {
  try {
    const server = buildMcpServer();
    const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });
    res.on("close", () => { transport.close(); server.close(); });
    await server.connect(transport);
    await transport.handleRequest(req, res);
  } catch (err: any) {
    if (!res.headersSent) res.status(500).json({ jsonrpc: "2.0", error: { code: -32603, message: String(err?.message ?? err) }, id: null });
  }
});
app.get("/mcp", (_req, res) => res.status(405).json({ error: "Use POST for MCP." }));

app.use(express.json({ limit: "1mb" }));

// ---- free-tier rate limiter (in-memory, per IP) ---------------------------
const WINDOW_MS = 60 * 60 * 1000;
const FREE_LIMIT = 40;
const hits = new Map<string, { count: number; resetAt: number }>();
function rateLimit(req: Request, res: Response, next: NextFunction) {
  const ip = (req.headers["x-forwarded-for"]?.toString().split(",")[0].trim()) || req.ip || "unknown";
  const now = Date.now();
  const rec = hits.get(ip);
  if (!rec || now > rec.resetAt) { hits.set(ip, { count: 1, resetAt: now + WINDOW_MS }); return next(); }
  rec.count++;
  if (rec.count > FREE_LIMIT) {
    res.setHeader("Retry-After", Math.ceil((rec.resetAt - now) / 1000).toString());
    return res.status(429).json({ error: "Free-tier rate limit reached.", limit: FREE_LIMIT, window: "1h" });
  }
  next();
}
setInterval(() => { const now = Date.now(); for (const [k, v] of hits) if (now > v.resetAt) hits.delete(k); }, WINDOW_MS).unref();

// ---- FREE: scan ------------------------------------------------------------
app.post("/api/scan", rateLimit, (req: Request, res: Response) => {
  const data = String(req.body?.data ?? "");
  if (!data.trim()) return res.status(400).json({ error: "Body field 'data' (your transaction text) is required." });
  try {
    res.json(scan(data));
  } catch (e: any) { res.status(400).json({ error: String(e?.message ?? e) }); }
});

// ---- FREE: single-letter preview (teaser; one cancel letter, no personal data) ----
app.post("/api/preview", rateLimit, (req: Request, res: Response) => {
  const b = req.body ?? {};
  const charge: RecurringCharge = {
    merchant: String(b.merchant ?? "this service"), category: "Recurring charge",
    knownSubscription: true, hardToCancel: false, cadence: b.cadence ?? "monthly",
    occurrences: 1, amountTypical: Number(b.amount ?? 0), currency: String(b.currency ?? "USD"),
    firstSeen: "", lastSeen: "", daysSinceLast: 0, annualizedCost: 0,
    zombieScore: 0, zombieReasons: [], verdict: "REVIEW",
    cancelHint: b.cancelHint, privacyContact: b.privacyContact, descriptorExample: String(b.merchant ?? ""),
  };
  res.json(generateLetter("cancel", charge, {}));
});

function userCtxFrom(o: any): UserContext {
  return {
    fullName: o?.fullName, email: o?.email, accountId: o?.accountId,
    jurisdiction: o?.jurisdiction as Jurisdiction | undefined,
  };
}

function buildPackageFromData(data: string, onlyZombies: boolean, types: LetterType[] | undefined, user: UserContext) {
  const result = scan(data);
  const chosen = result.charges.filter((c) => onlyZombies ? c.verdict === "ZOMBIE" : c.verdict !== "ACTIVE");
  const pkg = generatePackage(chosen, user, types);
  return {
    summary: {
      zombieCount: result.zombieCount,
      estimatedZombieSavings: result.estimatedZombieSavings,
      totalAnnualizedRecurring: result.totalAnnualizedRecurring,
      currency: result.currency,
      merchantsInPackage: pkg.length,
    },
    package: pkg,
  };
}

// ---- PAID (human, crypto via NOWPayments): package -------------------------
app.post("/api/package", rateLimit, async (req: Request, res: Response) => {
  const data = String(req.body?.data ?? "");
  const paymentId = String(req.body?.paymentId ?? req.query.paymentId ?? "");
  if (!data.trim()) return res.status(400).json({ error: "Body field 'data' is required." });

  const unlocked = await paymentUnlocks(paymentId);
  if (!unlocked.ok) {
    return res.status(402).json({
      error: "Payment required to unlock the letter package.",
      reason: unlocked.reason,
      howToPay: {
        crypto: `${BASE_URL}/api/pay/nowpayments`,
        x402: `${BASE_URL}/pro/package (for AI agents, USDC on Base)`,
      },
    });
  }
  try {
    res.json(buildPackageFromData(data, !!req.body?.onlyZombies, req.body?.types, userCtxFrom(req.body)));
  } catch (e: any) { res.status(400).json({ error: String(e?.message ?? e) }); }
});

// ---- NOWPayments crypto checkout (human) ----------------------------------
app.get("/api/pay/nowpayments", async (req: Request, res: Response) => {
  try {
    res.json(await createNowPayment({
      priceUsd: Number(PRICE.replace("$", "")) || 0.5,
      orderId: String(req.query.order ?? `zk-${Date.now()}`),
      payCurrency: String(req.query.currency ?? ""),
      successUrl: `${BASE_URL}/?paid=1`,
    }));
  } catch (e: any) { res.status(503).json({ error: "Crypto checkout unavailable", detail: String(e?.message ?? e) }); }
});
app.get("/api/pay/status", async (req: Request, res: Response) => {
  try { res.json(await getNowPaymentStatus(String(req.query.id ?? ""))); }
  catch (e: any) { res.status(400).json({ error: String(e?.message ?? e) }); }
});

// ---- x402 paid routes ------------------------------------------------------
if (PAYMENTS_ENABLED) {
  const facilitator = FACILITATOR_URL ? { url: FACILITATOR_URL as `${string}://${string}` } : undefined;
  app.use(paymentMiddleware(
    PAYTO,
    { "GET /pro/package": { price: PRICE, network: NETWORK, config: { description: "zombie-killer: full cancel/renegotiate/data-deletion letter package." } } },
    facilitator,
  ));
}

app.get("/pro/package", (req: Request, res: Response) => {
  const data = String(req.query.data ?? "");
  if (!data.trim()) return res.status(400).json({ error: "Query param 'data' is required." });
  try {
    res.json(buildPackageFromData(data, String(req.query.onlyZombies ?? "") === "true", undefined, userCtxFrom(req.query)));
  } catch (e: any) { res.status(400).json({ error: String(e?.message ?? e) }); }
});

app.use((_req, res) => res.status(404).json({ error: "Not found. See GET / for the endpoint list." }));
app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
  if (!res.headersSent) res.status(500).json({ error: "Internal error", detail: String(err?.message ?? err) });
});

export { app };
export default app;

const isDirectRun = process.argv[1] && import.meta.url === `file://${process.argv[1].replace(/\\/g, "/")}`;
if (isDirectRun || process.env.FORCE_LISTEN === "true") {
  app.listen(PORT, () => {
    console.error(`zombie-killer HTTP on :${PORT} (payments ${PAYMENTS_ENABLED ? "ON" : "OFF"}, network=${NETWORK}, payTo=${PAYTO}, price=${PRICE})`);
  });
}
