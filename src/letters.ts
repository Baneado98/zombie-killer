// letters.ts — the deliverable the user pays for.
//
// Given a detected recurring charge (+ a few user fields), produce ready-to-send
// text for the user to send THEMSELVES. We never act on the user's behalf, never
// impersonate them, never contact the merchant. We draft; the human sends.
//
// Three letter types:
//   1. cancel        — clear, firm cancellation request (+ stop-future-billing).
//   2. renegotiate   — retention/loyalty-discount script for recurring bills.
//   3. data_deletion — GDPR Art.17 (EU) or CCPA/CPRA (California) erasure request.
//
// The legal hooks are real statute references; we are explicit that this is a
// template, not legal advice, and that the user must fill the bracketed fields.

import { RecurringCharge } from "./engine.js";

export type LetterType = "cancel" | "renegotiate" | "data_deletion";
export type Jurisdiction = "us" | "eu" | "uk" | "ca";

export interface UserContext {
  fullName?: string;
  email?: string;
  accountId?: string;     // account / membership / customer number
  jurisdiction?: Jurisdiction;
}

export interface GeneratedLetter {
  type: LetterType;
  merchant: string;
  subject: string;
  body: string;
  channelHint: string;     // where/how to send it
  legalBasis?: string;
  disclaimer: string;
}

const DISCLAIMER =
  "This is a self-help template, not legal advice. Review and edit the bracketed fields before sending. " +
  "You are sending this yourself from your own account/email — zombie-killer does not contact the company for you.";

function fld(v: string | undefined, placeholder: string): string {
  return v && v.trim() ? v.trim() : `[${placeholder}]`;
}

// ---------------------------------------------------------------------------
// 1. Cancellation
// ---------------------------------------------------------------------------
function cancelLetter(c: RecurringCharge, u: UserContext): GeneratedLetter {
  const name = fld(u.fullName, "your full name");
  const acct = fld(u.accountId, "your account / membership number");
  const email = fld(u.email, "the email on the account");
  const today = new Date().toISOString().slice(0, 10);

  const subject = `Cancellation of my ${c.merchant} subscription — effective immediately`;
  const body =
`Date: ${today}

To: ${c.merchant} Customer Service / Billing

Subject: ${subject}

To whom it may concern,

I am writing to formally cancel my ${c.merchant} subscription and to instruct you to stop all future billing on my account, effective immediately.

Account details:
  • Name on account: ${name}
  • Account / membership number: ${acct}
  • Email / login: ${email}
  • Last charge on file: ${c.amountTypical} ${c.currency} (${c.cadence})

Please:
  1. Cancel the subscription so that it does not renew.
  2. Confirm in writing the cancellation date and that no further charges will be made.
  3. Cancel any stored authorization to charge my payment method (continuous payment authority / recurring mandate).

If any charge is taken after the date of this request, I ask that it be refunded, and I reserve the right to dispute it with my bank/card issuer as an unauthorized recurring charge.

Please reply to this message to confirm.

Regards,
${name}`;

  const channelHint = c.cancelHint
    ? `Send via the official cancellation route: ${c.cancelHint}. If they only offer chat/phone, paste this as your chat message or read it out — and ask for a written/email confirmation.`
    : `Send to the company's billing/support email or in-app cancellation flow. Always request a written confirmation.`;

  return { type: "cancel", merchant: c.merchant, subject, body, channelHint, disclaimer: DISCLAIMER };
}

// ---------------------------------------------------------------------------
// 2. Renegotiation / retention
// ---------------------------------------------------------------------------
function renegotiateLetter(c: RecurringCharge, u: UserContext): GeneratedLetter {
  const name = fld(u.fullName, "your full name");
  const acct = fld(u.accountId, "your account / customer number");

  const subject = `Request to lower my ${c.merchant} rate or I'll be cancelling`;
  const body =
`To: ${c.merchant} Retention / Customer Loyalty

Subject: ${subject}

Hello,

I've been a paying customer (account ${acct}) and I currently pay ${c.amountTypical} ${c.currency} ${c.cadence === "yearly" ? "per year" : "per month"} for this service. I'm reviewing my recurring costs and this one is on the chopping block.

Before I cancel, I'd like to give you the chance to keep me as a customer:

  • Is there a current promotional rate, loyalty discount, or lower-tier plan you can move me to?
  • New customers are often offered a better price than long-standing ones — I'd like to be matched to that rate.
  • If you can bring my cost down to a level I'm comfortable with, I'll happily stay.

If there's nothing you can do, please treat this as notice that I intend to cancel, and tell me the exact steps to do so.

Could you let me know what you can offer?

Thanks,
${name}`;

  const channelHint =
    "Use the retention/loyalty line — usually reached by starting a cancellation, by phone, or by live chat (retention agents have more discount authority than first-line chat). Stay polite but be ready to actually leave; that's where the leverage is. If they offer a discount, get it confirmed in writing.";

  return {
    type: "renegotiate", merchant: c.merchant, subject, body, channelHint,
    disclaimer: "This is a negotiation script, not a guarantee of a discount. " + DISCLAIMER,
  };
}

// ---------------------------------------------------------------------------
// 3. Data deletion (GDPR Art.17 / CCPA-CPRA)
// ---------------------------------------------------------------------------
function dataDeletionLetter(c: RecurringCharge, u: UserContext): GeneratedLetter {
  const name = fld(u.fullName, "your full name");
  const email = fld(u.email, "the email associated with your account");
  const acct = fld(u.accountId, "your account number, if any");
  const jur = u.jurisdiction ?? "eu";

  let legalBasis: string;
  let rights: string;
  if (jur === "us" || jur === "ca") {
    legalBasis = "California Consumer Privacy Act (CCPA), as amended by the CPRA — Cal. Civ. Code §1798.105 (right to delete) and §1798.120 (right to opt out of sale/sharing).";
    rights =
`  • Delete the personal information you have collected about me (§1798.105).
  • Tell me the categories of personal information you collected and disclosed (§1798.110 / §1798.115).
  • Stop selling or sharing my personal information (§1798.120), and apply this to any service providers.`;
  } else if (jur === "uk") {
    legalBasis = "UK GDPR and the Data Protection Act 2018 — Article 17 (right to erasure) and Article 15 (right of access).";
    rights =
`  • Erase the personal data you hold about me (Article 17).
  • Confirm what personal data you process about me and your lawful basis (Article 15).
  • Stop any direct-marketing processing (Article 21).`;
  } else {
    legalBasis = "EU General Data Protection Regulation (GDPR) — Article 17 (right to erasure / 'right to be forgotten') and Article 15 (right of access).";
    rights =
`  • Erase all personal data you hold about me (Article 17).
  • Confirm what personal data you process, the purposes, and your lawful basis (Article 15).
  • Object to any further processing for direct marketing (Article 21).`;
  }

  const subject = `Request to delete my personal data — ${c.merchant} (${jur === "us" || jur === "ca" ? "CCPA/CPRA" : "GDPR Art. 17"})`;
  const body =
`To: ${c.merchant} — Data Protection Officer / Privacy Team${c.privacyContact ? ` (${c.privacyContact})` : ""}

Subject: ${subject}

To whom it may concern,

I am exercising my data-protection rights under ${legalBasis}

My details so you can identify my records:
  • Name: ${name}
  • Account email: ${email}
  • Account / customer number: ${acct}

I request that you:
${rights}

Please:
  1. Action this request and confirm completion in writing.
  2. Pass it to any processors or third parties with whom you have shared my data.
  3. Respond within the statutory time limit (one month under GDPR; 45 days under CCPA, extendable once with notice).

If you cannot fully comply, please explain the specific legal exemption you are relying on. I retain the right to complain to the relevant supervisory authority (e.g. my national Data Protection Authority, or the California Privacy Protection Agency).

Regards,
${name}`;

  const channelHint = c.privacyContact
    ? `Send to the privacy contact: ${c.privacyContact}. Send from ${email === "[the email associated with your account]" ? "the email on your account" : email} so they can verify it's you.`
    : `Send to the company's privacy@ / dpo@ address or their "privacy request" web form. Send from the email on your account so they can verify your identity.`;

  return { type: "data_deletion", merchant: c.merchant, subject, body, channelHint, legalBasis, disclaimer: DISCLAIMER };
}

// ---------------------------------------------------------------------------

export function generateLetter(type: LetterType, c: RecurringCharge, u: UserContext = {}): GeneratedLetter {
  switch (type) {
    case "cancel": return cancelLetter(c, u);
    case "renegotiate": return renegotiateLetter(c, u);
    case "data_deletion": return dataDeletionLetter(c, u);
    default: throw new Error(`Unknown letter type: ${type}`);
  }
}

/** Build the full paid "package": all three letters for every chosen charge. */
export function generatePackage(
  charges: RecurringCharge[],
  u: UserContext = {},
  types: LetterType[] = ["cancel", "renegotiate", "data_deletion"],
): { merchant: string; letters: GeneratedLetter[] }[] {
  return charges.map((c) => ({
    merchant: c.merchant,
    letters: types.map((t) => generateLetter(t, c, u)),
  }));
}
