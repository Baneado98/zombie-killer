// mcpServer.ts — MCP server exposing zombie-killer as agent tools.
//
// Tools:
//   scan_subscriptions   — parse raw bank/subscription data -> recurring charges
//                          + zombie verdicts + annualized spend.
//   generate_letter      — draft a cancel / renegotiate / data_deletion letter
//                          for one detected charge (free).
//   build_letter_package — draft the full multi-letter package (the paid path
//                          when used over the x402 HTTP surface).

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { scan } from "./engine.js";
import { generateLetter, generatePackage, LetterType, Jurisdiction } from "./letters.js";

const userCtxShape = {
  fullName: z.string().optional(),
  email: z.string().optional(),
  accountId: z.string().optional(),
  jurisdiction: z.enum(["us", "eu", "uk", "ca"]).optional(),
};

export function buildMcpServer(): McpServer {
  const server = new McpServer({ name: "zombie-killer", version: "0.1.0" });

  server.tool(
    "scan_subscriptions",
    "Detect recurring subscriptions and 'zombie' (forgotten / wasteful) charges from raw bank or subscription data. Paste a CSV export or free-form lines (date, description, amount). Returns each recurring charge with a ZOMBIE/REVIEW/ACTIVE verdict, cadence, annualized cost, and the estimated yearly savings from killing the zombies.",
    { data: z.string().describe("Raw transaction text: CSV bank export or lines like '2026-05-12, NETFLIX.COM, -12.99'.") },
    async ({ data }) => {
      const result = scan(data);
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    },
  );

  server.tool(
    "generate_letter",
    "Draft a ready-to-send letter for one recurring charge: a cancellation request, a renegotiation/retention script, or a GDPR/CCPA data-deletion request. You send it yourself; this only drafts it.",
    {
      type: z.enum(["cancel", "renegotiate", "data_deletion"]),
      merchant: z.string().describe("Merchant name as returned by scan_subscriptions."),
      amount: z.number().optional(),
      currency: z.string().optional(),
      cadence: z.enum(["monthly", "quarterly", "yearly", "weekly", "irregular"]).optional(),
      cancelHint: z.string().optional(),
      privacyContact: z.string().optional(),
      ...userCtxShape,
    },
    async (a) => {
      const charge = {
        merchant: a.merchant, category: "Recurring charge", knownSubscription: true,
        hardToCancel: false, cadence: a.cadence ?? "monthly", occurrences: 1,
        amountTypical: a.amount ?? 0, currency: a.currency ?? "USD",
        firstSeen: "", lastSeen: "", daysSinceLast: 0, annualizedCost: 0,
        zombieScore: 0, zombieReasons: [], verdict: "REVIEW" as const,
        cancelHint: a.cancelHint, privacyContact: a.privacyContact, descriptorExample: a.merchant,
      };
      const letter = generateLetter(a.type as LetterType, charge, {
        fullName: a.fullName, email: a.email, accountId: a.accountId,
        jurisdiction: a.jurisdiction as Jurisdiction | undefined,
      });
      return { content: [{ type: "text", text: JSON.stringify(letter, null, 2) }] };
    },
  );

  server.tool(
    "build_letter_package",
    "Scan raw data and build the full action package: for every detected zombie/review charge, draft the cancel + renegotiate + data-deletion letters in one go. The complete deliverable.",
    {
      data: z.string().describe("Raw transaction text."),
      onlyZombies: z.boolean().optional().describe("If true, only build letters for ZOMBIE-verdict charges (default: zombies + review)."),
      types: z.array(z.enum(["cancel", "renegotiate", "data_deletion"])).optional(),
      ...userCtxShape,
    },
    async (a) => {
      const result = scan(a.data);
      const chosen = result.charges.filter((c) =>
        a.onlyZombies ? c.verdict === "ZOMBIE" : c.verdict !== "ACTIVE");
      const pkg = generatePackage(chosen, {
        fullName: a.fullName, email: a.email, accountId: a.accountId,
        jurisdiction: a.jurisdiction as Jurisdiction | undefined,
      }, a.types as LetterType[] | undefined);
      return {
        content: [{
          type: "text",
          text: JSON.stringify({
            summary: {
              zombieCount: result.zombieCount,
              estimatedZombieSavings: result.estimatedZombieSavings,
              currency: result.currency,
              merchantsInPackage: pkg.length,
            },
            package: pkg,
          }, null, 2),
        }],
      };
    },
  );

  return server;
}
