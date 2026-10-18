// Run with: npx tsx tests/connectors.test.ts
import assert from "node:assert/strict";
import { computePace } from "../src/lib/pace";
import { parseSettings } from "../src/lib/settings";
import { hubspotToPoints } from "../src/lib/sources/hubspot";
import { shopifyToPoints } from "../src/lib/sources/shopify";
import { stripeToPoints } from "../src/lib/sources/stripe";

const today = new Date().toISOString().slice(0, 10);
const nowSec = Math.floor(Date.now() / 1000);
const sum = (pts: { value: number }[]) => pts.reduce((a, p) => a + p.value, 0);

// Stripe: captured minus refunded, failed charges ignored, cents to dollars
const charges = [
  { created: nowSec, paid: true, status: "succeeded", amount_captured: 10000, amount_refunded: 2500 },
  { created: nowSec, paid: false, status: "failed", amount_captured: 0, amount_refunded: 0 },
  { created: nowSec - 86400, paid: true, status: "succeeded", amount_captured: 4000, amount_refunded: 0 },
];
assert.equal(sum(stripeToPoints("revenue", charges)), 115);
assert.equal(sum(stripeToPoints("refunds", charges)), 25);
assert.equal(sum(stripeToPoints("new_customers", [{ created: nowSec }, { created: nowSec }])), 2);
assert.ok(stripeToPoints("revenue", charges).length >= 100, "fills empty days with 0");

// Shopify: cancelled and test orders ignored
const orders = [
  { created_at: new Date().toISOString(), current_total_price: "120.50" },
  { created_at: new Date().toISOString(), current_total_price: "80.00", cancelled_at: new Date().toISOString() },
  { created_at: new Date().toISOString(), total_price: "10.00", test: true },
];
assert.equal(sum(shopifyToPoints("sales", orders)), 120.5);
assert.equal(sum(shopifyToPoints("orders", orders)), 1);

// HubSpot
const deals = [
  { properties: { amount: "5000", closedate: new Date().toISOString(), createdate: new Date().toISOString() } },
  { properties: { amount: null, closedate: new Date().toISOString(), createdate: new Date().toISOString() } },
];
assert.equal(sum(hubspotToPoints("won_amount", deals)), 5000);
assert.equal(sum(hubspotToPoints("deals_won", deals)), 2);
assert.equal(hubspotToPoints("open_pipeline", deals)[0].value, 5000);

// Pacing: $1,000 a day against a month target of $1,000 x days in the month
const [y, m] = today.split("-").map(Number);
const daysInMonth = new Date(Date.UTC(y, m, 0)).getUTCDate();
const day = Number(today.slice(8, 10));
const series = Array.from({ length: day }, (_, i) => ({ date: `${today.slice(0, 8)}${String(i + 1).padStart(2, "0")}`, value: 1000 }));
const pace = computePace({ id: "r", name: "Revenue", format: "currency", target: 1000 * daysInMonth, targetPeriod: "month", aggregate: "sum", source: { type: "manual" } }, series, today)!;
assert.equal(pace.status, "on_pace");
assert.equal(Math.round(pace.projected!), 1000 * daysInMonth);
const churn = computePace({ id: "c", name: "Churn", format: "percent", goodWhen: "down", target: 2, targetPeriod: "month", aggregate: "latest", source: { type: "manual" } }, [{ date: today, value: 3 }], today)!;
assert.equal(churn.status, "behind");

// Settings: a target typed as "$50,000" becomes a monthly target; churn reads as its latest value
const parsed = parseSettings({ kpis: [{ name: "Revenue", format: "currency", target: "$50,000" }, { name: "Churn", format: "percent" }] });
assert.ok(parsed.ok);
if (parsed.ok) {
  assert.equal(parsed.settings.kpis[0].target, 50000);
  assert.equal(parsed.settings.kpis[0].targetPeriod, "month");
  assert.equal(parsed.settings.kpis[1].aggregate, "latest");
}
console.log("all connector and pacing tests passed");
