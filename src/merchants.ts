// merchants.ts — known recurring-subscription merchant catalog.
//
// Used to (a) normalize messy bank descriptors to a clean merchant name,
// (b) tag a charge as a known subscription service, (c) attach the real
// cancellation / data-deletion contact so the generated letters are usable.
//
// No network calls — this is an embedded catalog so the detector works offline
// and the result is deterministic. Curated from public cancellation pages.

export interface MerchantInfo {
  /** Canonical, human-readable name. */
  name: string;
  /** Category for the report. */
  category: string;
  /** Substrings (lowercased) that appear in raw bank descriptors. */
  match: string[];
  /** Where the user sends a cancellation request (best-effort public info). */
  cancelHint?: string;
  /** Email / portal for GDPR / CCPA data-deletion requests, if public. */
  privacyContact?: string;
  /** True when the service is notorious for hard-to-cancel / dark-pattern flows. */
  hardToCancel?: boolean;
}

// The catalog. Kept intentionally compact but covering the highest-frequency
// recurring charges seen on consumer statements (US + EU).
export const MERCHANTS: MerchantInfo[] = [
  { name: "Netflix", category: "Streaming (video)", match: ["netflix"], cancelHint: "netflix.com/cancelplan", privacyContact: "privacy@netflix.com" },
  { name: "Spotify", category: "Streaming (music)", match: ["spotify"], cancelHint: "spotify.com/account/subscription", privacyContact: "privacy@spotify.com" },
  { name: "Amazon Prime", category: "Membership", match: ["amazon prime", "amzn prime", "prime video", "amazonprime"], cancelHint: "amazon.com → Prime → End Membership", privacyContact: "https://www.amazon.com/privacy" },
  { name: "Disney+", category: "Streaming (video)", match: ["disney plus", "disneyplus", "disney+"], cancelHint: "disneyplus.com → Account → Cancel" },
  { name: "Apple", category: "App Store / Services", match: ["apple.com/bill", "apple services", "itunes", "apple.com"], cancelHint: "Settings → Apple ID → Subscriptions (iOS) or Music app", hardToCancel: true },
  { name: "Google", category: "App / Services", match: ["google *", "google play", "google storage", "youtube premium", "youtubepremium"], cancelHint: "play.google.com/store/account/subscriptions" },
  { name: "Microsoft 365", category: "Software", match: ["microsoft", "msbill", "msft"], cancelHint: "account.microsoft.com/services" },
  { name: "Adobe", category: "Software", match: ["adobe"], cancelHint: "account.adobe.com/plans", hardToCancel: true },
  { name: "HBO Max / Max", category: "Streaming (video)", match: ["hbo", "hbomax", "max.com"], cancelHint: "max.com → Settings → Subscription" },
  { name: "Hulu", category: "Streaming (video)", match: ["hulu"], cancelHint: "hulu.com/account" },
  { name: "YouTube Premium", category: "Streaming", match: ["youtube"], cancelHint: "youtube.com/paid_memberships" },
  { name: "Audible", category: "Audiobooks", match: ["audible"], cancelHint: "audible.com → Account → Cancel membership", hardToCancel: true },
  { name: "LinkedIn Premium", category: "Software", match: ["linkedin"], cancelHint: "linkedin.com/premium → Manage" },
  { name: "Dropbox", category: "Storage", match: ["dropbox"], cancelHint: "dropbox.com/account/plan" },
  { name: "iCloud", category: "Storage", match: ["icloud"], cancelHint: "Settings → Apple ID → iCloud → Manage Storage" },
  { name: "PlayStation Plus", category: "Gaming", match: ["playstation", "sony interactive", "psn"], cancelHint: "Account → Subscriptions" },
  { name: "Xbox Game Pass", category: "Gaming", match: ["xbox", "xbgames"], cancelHint: "account.microsoft.com/services" },
  { name: "Nintendo", category: "Gaming", match: ["nintendo"], cancelHint: "Nintendo Account → Shop menu" },
  { name: "Twitch", category: "Streaming", match: ["twitch"], cancelHint: "twitch.tv → Subscriptions" },
  { name: "Patreon", category: "Creator", match: ["patreon"], cancelHint: "patreon.com → Memberships" },
  { name: "OnlyFans", category: "Creator", match: ["onlyfans", "fenix int"], cancelHint: "onlyfans.com → Subscriptions" },
  { name: "Notion", category: "Software", match: ["notion"], cancelHint: "notion.so → Settings → Plans" },
  { name: "Canva", category: "Software", match: ["canva"], cancelHint: "canva.com → Account → Billing" },
  { name: "ChatGPT / OpenAI", category: "Software (AI)", match: ["openai", "chatgpt"], cancelHint: "chatgpt.com → Settings → Subscription" },
  { name: "Claude / Anthropic", category: "Software (AI)", match: ["anthropic", "claude.ai"], cancelHint: "claude.ai → Settings → Billing" },
  { name: "Grammarly", category: "Software", match: ["grammarly"], cancelHint: "account.grammarly.com → Subscription" },
  { name: "1Password", category: "Software", match: ["1password", "agilebits"], cancelHint: "my.1password.com → Billing" },
  { name: "NordVPN", category: "VPN", match: ["nordvpn", "nord vpn"], cancelHint: "nordaccount.com → Billing", hardToCancel: true },
  { name: "ExpressVPN", category: "VPN", match: ["expressvpn", "express vpn"], cancelHint: "expressvpn.com → My Account" },
  { name: "Surfshark", category: "VPN", match: ["surfshark"], cancelHint: "surfshark.com → Account" },
  { name: "Peloton", category: "Fitness", match: ["peloton"], cancelHint: "Peloton account → Membership" },
  { name: "Planet Fitness", category: "Gym", match: ["planet fit"], cancelHint: "In-club or certified-mail cancellation", hardToCancel: true },
  { name: "Audible", category: "Audiobooks", match: ["audible"], cancelHint: "audible.com → Account" },
  { name: "The New York Times", category: "News", match: ["nytimes", "ny times", "new york times"], cancelHint: "Must call / chat to cancel", hardToCancel: true },
  { name: "Wall Street Journal", category: "News", match: ["wsj", "wall street", "dow jones"], cancelHint: "customercenter.wsj.com", hardToCancel: true },
  { name: "The Economist", category: "News", match: ["economist"], cancelHint: "economist.com → Account" },
  { name: "Medium", category: "News", match: ["medium.com", "medium monthly"], cancelHint: "medium.com → Settings → Membership" },
  { name: "Substack", category: "News", match: ["substack"], cancelHint: "substack.com → Settings → Subscriptions" },
  { name: "DoorDash DashPass", category: "Membership", match: ["doordash", "dashpass"], cancelHint: "DoorDash app → DashPass" },
  { name: "Uber One", category: "Membership", match: ["uber one", "uberone"], cancelHint: "Uber app → Uber One" },
  { name: "Instacart+", category: "Membership", match: ["instacart"], cancelHint: "instacart.com → Account" },
  { name: "Walmart+", category: "Membership", match: ["walmart+", "walmart plus"], cancelHint: "walmart.com → Walmart+" },
  { name: "Calm", category: "Wellness", match: ["calm.com", "calm "], cancelHint: "calm.com → Profile → Manage Subscription" },
  { name: "Headspace", category: "Wellness", match: ["headspace"], cancelHint: "headspace.com → Settings" },
  { name: "Duolingo", category: "Education", match: ["duolingo"], cancelHint: "App store subscription settings" },
  { name: "Coursera", category: "Education", match: ["coursera"], cancelHint: "coursera.org → Subscriptions" },
  { name: "Audible", category: "Audiobooks", match: ["audible"], cancelHint: "audible.com → Account" },
  { name: "Movistar", category: "Telecom (ES)", match: ["movistar", "telefonica"], cancelHint: "1004 / movistar.es área cliente" },
  { name: "Vodafone", category: "Telecom (ES)", match: ["vodafone"], cancelHint: "vodafone.es área cliente" },
  { name: "Orange", category: "Telecom (ES)", match: ["orange "], cancelHint: "orange.es área cliente" },
  { name: "DAZN", category: "Streaming (sport)", match: ["dazn"], cancelHint: "dazn.com → My Account", hardToCancel: true },
];

/** Find the catalog entry whose descriptor substrings match the raw text. */
export function matchMerchant(raw: string): MerchantInfo | undefined {
  const t = raw.toLowerCase();
  // Longest match wins (more specific descriptor).
  let best: MerchantInfo | undefined;
  let bestLen = 0;
  for (const m of MERCHANTS) {
    for (const sub of m.match) {
      if (t.includes(sub) && sub.length > bestLen) { best = m; bestLen = sub.length; }
    }
  }
  return best;
}
