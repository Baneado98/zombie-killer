// engine.test.ts — calibration tests. The quality bar: detect real recurring
// charges, flag genuine zombies, and DON'T cry wolf on one-off purchases.
// Run: npm test

import { scan, parseTransactions } from "./engine.js";
import { generateLetter, generatePackage } from "./letters.js";
import { matchMerchant } from "./merchants.js";

let pass = 0, fail = 0;
function check(name: string, cond: boolean, detail?: string) {
  if (cond) { pass++; console.log(`  ok  ${name}`); }
  else { fail++; console.error(`FAIL  ${name}${detail ? " — " + detail : ""}`); }
}

// ---- parsing --------------------------------------------------------------
const csv = `Date,Description,Amount
2026-05-12,NETFLIX.COM,-12.99
2026-04-12,NETFLIX.COM,-12.99
2026-03-12,NETFLIX.COM,-11.99`;
const p = parseTransactions(csv);
check("parses 3 txns from CSV with header", p.txns.length === 3, `got ${p.txns.length}`);
check("header row skipped", p.txns.every(t => t.amount === 12.99 || t.amount === 11.99));

const euro = parseTransactions(`12/05/2026; ADOBE CREATIVE CLOUD; -59,99 €`);
check("parses EU date + comma-decimal + euro", euro.txns.length === 1 && Math.abs(euro.txns[0].amount - 59.99) < 0.01,
  JSON.stringify(euro.txns[0]));

const freeform = parseTransactions(`2026-05-19  SPOTIFY P0A1B2  -9.99`);
check("parses free-form line", freeform.txns.length === 1 && Math.abs(freeform.txns[0].amount - 9.99) < 0.01);

// ---- merchant catalog -----------------------------------------------------
check("matches Netflix descriptor", matchMerchant("NETFLIX.COM 12.99")?.name === "Netflix");
check("matches Adobe descriptor", matchMerchant("ADOBE *CREATIVE CLOUD")?.name === "Adobe");
check("Adobe flagged hard-to-cancel", matchMerchant("ADOBE")?.hardToCancel === true);
check("unknown descriptor returns undefined", matchMerchant("LOCAL CAFE 14 MAIN ST") === undefined);

// ---- recurrence + zombie detection ----------------------------------------
const data = `2026-05-12, NETFLIX.COM, -12.99
2026-04-12, NETFLIX.COM, -12.99
2026-03-12, NETFLIX.COM, -11.99
2026-05-03, ADOBE *CREATIVE CLOUD, -59.99
2026-04-03, ADOBE *CREATIVE CLOUD, -59.99
2026-03-03, ADOBE *CREATIVE CLOUD, -59.99
2026-05-19, SPOTIFY P0A1B2, -9.99
2026-04-19, SPOTIFY P0A1B2, -9.99
2026-03-19, SPOTIFY P0A1B2, -9.99
2026-02-28, NORDVPN, -71.76
2026-05-06, AUDIBLE*MEMBERSHIP, -14.95
2026-04-06, AUDIBLE*MEMBERSHIP, -14.95
2026-04-15, AMAZON MARKETPLACE, -34.20
2026-05-21, SHELL GAS STATION, -52.10
2026-05-22, TRADER JOES, -88.40`;

const r = scan(data, { today: new Date("2026-05-25") });
const byName = (n: string) => r.charges.find(c => c.merchant === n);

check("detects Netflix as recurring monthly", byName("Netflix")?.cadence === "monthly");
check("detects Adobe recurring", !!byName("Adobe"));
check("detects Spotify recurring", !!byName("Spotify"));
check("Netflix price-creep noted (11.99 -> 12.99)",
  (byName("Netflix")?.zombieReasons.some(x => /rose/i.test(x))) === true,
  JSON.stringify(byName("Netflix")?.zombieReasons));

// One-off purchases must NOT be flagged as recurring subscriptions.
check("does NOT flag one-off Shell gas as recurring", !byName("Shell Gas Station") && !r.charges.some(c => /shell/i.test(c.merchant)));
check("does NOT flag one-off Trader Joes", !r.charges.some(c => /trader/i.test(c.merchant)));
check("does NOT flag one-off Amazon Marketplace as a subscription", !r.charges.some(c => /marketplace/i.test(c.merchant)));

check("Adobe is ZOMBIE or REVIEW (hard-to-cancel + recurring)", ["ZOMBIE", "REVIEW"].includes(byName("Adobe")?.verdict ?? ""), byName("Adobe")?.verdict);
check("has at least one ZOMBIE verdict", r.zombieCount >= 1, `zombieCount=${r.zombieCount}`);
check("annualized savings > 0", r.estimatedZombieSavings > 0, `${r.estimatedZombieSavings}`);
check("total annualized recurring is sane (>100, <2500)", r.totalAnnualizedRecurring > 100 && r.totalAnnualizedRecurring < 2500, `${r.totalAnnualizedRecurring}`);
check("NordVPN treated as yearly (not monthly x12)", byName("NordVPN")?.cadence === "yearly", byName("NordVPN")?.cadence);

// NordVPN: single annual-sized charge, known hard-to-cancel -> still surfaced.
check("NordVPN surfaced (known sub seen once)", !!byName("NordVPN"));

// ---- letters --------------------------------------------------------------
const nf = byName("Netflix")!;
const cancel = generateLetter("cancel", nf, { fullName: "Jane Doe", email: "jane@example.com", accountId: "ACC-123" });
check("cancel letter includes merchant + name", cancel.body.includes("Netflix") && cancel.body.includes("Jane Doe"));
check("cancel letter mentions stop future billing", /future billing|recurring/i.test(cancel.body));

const reneg = generateLetter("renegotiate", nf, { fullName: "Jane Doe" });
check("renegotiate is a retention script", /loyalty|discount|retention|lower/i.test(reneg.body));

const gdprEu = generateLetter("data_deletion", nf, { jurisdiction: "eu", fullName: "Jane Doe", email: "jane@example.com" });
check("EU deletion cites GDPR Article 17", /Article 17/.test(gdprEu.body) && /GDPR/.test(gdprEu.body));
const ccpa = generateLetter("data_deletion", nf, { jurisdiction: "ca", fullName: "Jane Doe" });
check("CA deletion cites CCPA §1798.105", /1798\.105/.test(ccpa.body) && /CCPA/i.test(ccpa.legalBasis ?? ""));

const pkg = generatePackage(r.charges.filter(c => c.verdict !== "ACTIVE"), { fullName: "Jane Doe" });
check("package builds 3 letters per merchant", pkg.length > 0 && pkg.every(m => m.letters.length === 3), `${pkg.length} merchants`);
check("every letter has a disclaimer", pkg.every(m => m.letters.every(l => l.disclaimer.length > 0)));

// ---- empty / garbage input -------------------------------------------------
const empty = scan("not a transaction\njust some words");
check("garbage input -> 0 recurring + a note", empty.recurringCount === 0 && empty.notes.length > 0);

console.log(`\n${pass} passed, ${fail} failed`);
if (fail > 0) process.exit(1);
