# zombie-killer 🧟

**Find the subscriptions silently draining your bank account — and get the exact letters to cancel them, renegotiate the bill down, or erase your data.**

You paste your bank/card statement (or a list of subscriptions). zombie-killer detects the recurring charges, flags the *zombies* (forgotten, price-crept, free-trials-that-converted, hard-to-cancel), totals your yearly waste, and drafts ready-to-send letters. **You send them.** It never contacts the company, never impersonates you, never acts on your behalf.

Works for people (web app) **and** for AI agents (MCP server + x402 pay-per-call).

## What it does

1. **Detect** — parses raw transaction text (CSV export or free-form lines), groups by merchant via an embedded catalog of ~50 high-frequency subscription services (with real cancellation / privacy contacts), classifies cadence (weekly / monthly / quarterly / yearly), and scores each charge **ZOMBIE / REVIEW / ACTIVE**. One-off purchases (gas, groceries) are *not* flagged.
2. **Draft** — for each charge, three ready-to-send letters:
   - **Cancellation** — firm request to cancel and stop all future billing (kills continuous payment authority).
   - **Renegotiation** — a retention/loyalty-discount script to lower a recurring bill before you cancel.
   - **Data deletion** — a **GDPR Art. 17** (EU/UK) or **CCPA/CPRA §1798.105** (California) erasure request.
3. **Send** — every letter ships with where/how to send it. You send it yourself from your own account.

> Self-help templates, not legal advice. zombie-killer drafts; the human sends.

## Web app

Open the site, paste your statement, hit **Find my zombie subscriptions**. The scan and the verdicts are free. Unlocking the full letter package is a one-time crypto payment (no account, no card).

## MCP server (for AI agents)

```json
{
  "mcpServers": {
    "zombie-killer": { "command": "npx", "args": ["-y", "subkill-mcp"] }
  }
}
```

Tools:
- `scan_subscriptions` — raw data to recurring charges + zombie verdicts + annualized savings.
- `generate_letter` — draft one cancel / renegotiate / data-deletion letter.
- `build_letter_package` — scan + draft the full package in one call.

Or connect over HTTP at `POST /mcp`.

## Pay-per-call (x402)

The `/pro/package` route is gated by [x402](https://x402.org). An agent pays in **USDC on Base** automatically — no sign-up, no API key.

```
GET /pro/package?data=2026-05-12,NETFLIX.COM,-12.99&jurisdiction=eu
```

## HTTP API

| Method | Path | |
|---|---|---|
| POST | `/api/scan` | Free. `{ "data": "..." }` to recurring charges + zombie verdicts + savings. |
| POST | `/api/package` | Paid. Full letter package (unlocked by a confirmed payment). |
| GET | `/pro/package?data=..` | Paid via x402 (agents). |
| POST | `/mcp` | MCP-over-HTTP (free). |
| GET | `/openapi.json`, `/.well-known/x402` | Discovery. |

## Privacy

Your statement is processed in-memory to detect recurring charges and is **not stored**. Don't paste card numbers — they aren't needed.

## License

MIT.
