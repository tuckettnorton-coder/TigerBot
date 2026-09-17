import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { parseAmount, formatResult } from './calculator.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const FILE = path.join(__dirname, '../commands/Utility/paidAdPrices.json');

const DEFAULTS = {
  premium: 3,
  standard: 2,
  basic: 1,
  scheduled: 1,
  nitroPremium: 12,
  nitroBasic: 4,
  extend3: 1,
  extend7: 2,
};

export function loadPaidAdPrices() {
  try { return { ...DEFAULTS, ...JSON.parse(fs.readFileSync(FILE, 'utf8')) }; }
  catch { return { ...DEFAULTS }; }
}

export function savePaidAdPrices(prices) {
  fs.writeFileSync(FILE, `${JSON.stringify(prices, null, 2)}\n`, 'utf8');
}

function money(value) { return formatResult(Number(value)); }

export function buildPaidAdPriceMessage(prices = loadPaidAdPrices()) {
  return `# 💰 **Tiger Market Advertisement Prices** 💵

Advertise your server, business, or community to members!

🕒 **Every advertisement lasts 5 days by default.**
Want even more exposure? Add pings, giveaways, or extend your advertisement duration!

━━━━━━━━━━━━━━━━━━

# 🛍️ **Advertisement Bundles**

## 💎 **Premium Bundle** — **$${money(prices.premium)}**
Includes:
• @everyone Ping
• Private Advertisement Channel
• Scheduled Posting Time
• **+7 Day Advertisement**

---

## 🚀 **Standard Bundle** — **$${money(prices.standard)}**
Includes:
• <@&1508954719006232806> Ping
• Private Advertisement Channel
• **+3 Day Advertisement**

---

## 📢 **Basic Bundle** — **$${money(prices.basic)}**
Includes:
• @here Ping

━━━━━━━━━━━━━━━━━━

# ➕ **Advertisement Add-ons**

• 🕒 Scheduled Posting Time — **$${money(prices.scheduled)}**
• 📁 Private Advertisement Channel — **Included in Bundles**

━━━━━━━━━━━━━━━━━━

# 🎁 **Giveaway Add-ons**

Boost engagement by adding a giveaway! Members must join your server to participate.

• 💎 Nitro Premium — **$${money(prices.nitroPremium)}**
• 🚀 Nitro Basic — **$${money(prices.nitroBasic)}**

━━━━━━━━━━━━━━━━━━

# ⭐ **Extend Your Advertisement**

Need more exposure?

• **+3 Additional Days** — **$${money(prices.extend3)}**
• **+7 Additional Days** — **$${money(prices.extend7)}**

━━━━━━━━━━━━━━━━━━

# 💳 **Payment Methods**

• PayPal
• Venmo

*(USD Only)*

━━━━━━━━━━━━━━━━━━

# ⚠️ **Rules**

• Giveaways must be claimed within **12 hours**, or they will expire.
• Advertisements that violate **Discord's Terms of Service** will be removed immediately.
• **No refunds** after payment has been received.

━━━━━━━━━━━━━━━━━━

# ❓ **Interested?**

Open an advertisement ticket in **<#1504949441650622575>** to get started!

Thank you for choosing **Tiger Market**! 🐅`;
}

export function parsePaidAdPrice(value, label) {
  const parsed = parseAmount(String(value ?? '').trim().replace(/[$,\s]/g, ''));
  if (parsed === null || !Number.isFinite(parsed) || parsed < 0) throw new Error(`${label} must be a valid price.`);
  return parsed;
}
