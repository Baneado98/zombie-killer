// pay.ts — crypto checkout for HUMAN buyers via NOWPayments (no-KYC for crypto),
// plus a server-side payment verification gate so the paid package can't be
// unlocked by spoofing an id.
//
// Settlement goes straight to the operator wallet configured in the NOWPayments
// account (payout address = the same 0x074c... Base wallet). This server holds
// no keys and never sees the user's funds.
//
// If NOWPAYMENTS_API_KEY is not configured, the crypto-checkout endpoints return
// a clear "not configured yet" error and the x402 /pro path remains the working
// paid surface. Honest degradation (regla 7).

const NP_BASE = process.env.NOWPAYMENTS_BASE ?? "https://api.nowpayments.io/v1";
const NP_KEY = process.env.NOWPAYMENTS_API_KEY ?? "";

export interface CreatePaymentArgs {
  priceUsd: number;
  orderId: string;
  payCurrency?: string; // e.g. "usdcbase", "usdttrc20", "btc"; empty -> let user pick on invoice
  successUrl?: string;
}

/**
 * Create a hosted crypto invoice. We use the /invoice endpoint (hosted page) so
 * the buyer can pick any of 300+ coins and pay from any wallet/exchange — far
 * lower friction than asking a human to push USDC on Base by hand.
 */
export async function createNowPayment(args: CreatePaymentArgs) {
  if (!NP_KEY) {
    throw new Error("Crypto checkout not configured yet (NOWPAYMENTS_API_KEY unset). AI agents can pay now via the x402 endpoint /pro/package. Human crypto checkout goes live once the NOWPayments key is set.");
  }
  const body: Record<string, unknown> = {
    price_amount: args.priceUsd,
    price_currency: "usd",
    order_id: args.orderId,
    order_description: "zombie-killer — full subscription cancel/renegotiate/data-deletion letter package",
    ipn_callback_url: undefined,
    success_url: args.successUrl,
  };
  if (args.payCurrency) body.pay_currency = args.payCurrency;

  const r = await fetch(`${NP_BASE}/invoice`, {
    method: "POST",
    headers: { "x-api-key": NP_KEY, "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const j: any = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(`NOWPayments invoice failed (${r.status}): ${JSON.stringify(j)}`);
  return {
    provider: "nowpayments",
    invoiceId: j.id,
    payUrl: j.invoice_url, // hosted checkout page
    orderId: args.orderId,
    priceUsd: args.priceUsd,
  };
}

export async function getNowPaymentStatus(id: string) {
  if (!id) throw new Error("Query param 'id' (payment/invoice id) is required.");
  if (!NP_KEY) throw new Error("Crypto checkout not configured yet (NOWPAYMENTS_API_KEY unset).");
  const r = await fetch(`${NP_BASE}/payment/${encodeURIComponent(id)}`, {
    headers: { "x-api-key": NP_KEY },
  });
  const j: any = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(`NOWPayments status failed (${r.status}): ${JSON.stringify(j)}`);
  return j;
}

/**
 * Server-side gate: a payment id only unlocks the package if NOWPayments
 * confirms it's finished/confirmed. We never trust a client-supplied "paid:true".
 */
export async function paymentUnlocks(paymentId: string): Promise<{ ok: boolean; reason: string }> {
  if (!paymentId) return { ok: false, reason: "no_payment_id" };
  if (!NP_KEY) return { ok: false, reason: "crypto_checkout_not_configured" };
  try {
    const s = await getNowPaymentStatus(paymentId);
    const status = String(s.payment_status ?? "").toLowerCase();
    if (status === "finished" || status === "confirmed" || status === "sending") {
      return { ok: true, reason: status };
    }
    return { ok: false, reason: `payment_status_${status || "unknown"}` };
  } catch (e: any) {
    return { ok: false, reason: "verification_error" };
  }
}
