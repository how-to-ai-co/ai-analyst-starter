import type { Connections, Kpi, Point } from "../types";
import { bucket, dayOf, getJson, sinceDate } from "./util";

/**
 * Stripe. Needs a restricted key with read access to Charges and Customers, saved as STRIPE_API_KEY.
 * source: { "type": "stripe", "metric": "revenue" | "new_customers" | "refunds" }
 * Revenue is money collected per day (captured minus refunded), in the account's currency.
 */
export async function stripe(kpi: Kpi, connections: Connections, timezone = "UTC"): Promise<Point[]> {
  const key = connections.STRIPE_API_KEY || process.env.STRIPE_API_KEY;
  if (!key) throw new Error("Save your Stripe key (STRIPE_API_KEY) on Setup");
  const metric = String((kpi.source as { metric?: string }).metric ?? "revenue");
  const since = Math.floor(sinceDate().getTime() / 1000);
  const resource = metric === "new_customers" ? "customers" : "charges";
  const items: unknown[] = [];
  let after: string | undefined;
  for (let page = 0; page < 30; page++) {
    const url = `https://api.stripe.com/v1/${resource}?limit=100&created[gte]=${since}${after ? `&starting_after=${after}` : ""}`;
    const { data } = await getJson(url, { headers: { Authorization: `Bearer ${key}` } }, "Stripe");
    items.push(...data.data);
    if (!data.has_more || data.data.length === 0) break;
    after = data.data[data.data.length - 1].id;
  }
  return stripeToPoints(metric, items as StripeObject[], timezone);
}

type StripeObject = { created: number; paid?: boolean; status?: string; amount_captured?: number; amount_refunded?: number };

export function stripeToPoints(metric: string, items: StripeObject[], timezone = "UTC"): Point[] {
  const start = dayOf(sinceDate(), timezone);
  if (metric === "new_customers") return bucket(items.map((c) => ({ day: dayOf(c.created * 1000, timezone), value: 1 })), start);
  const ok = items.filter((c) => c.paid && c.status === "succeeded");
  if (metric === "refunds") return bucket(ok.map((c) => ({ day: dayOf(c.created * 1000, timezone), value: (c.amount_refunded ?? 0) / 100 })), start);
  return bucket(ok.map((c) => ({ day: dayOf(c.created * 1000, timezone), value: ((c.amount_captured ?? 0) - (c.amount_refunded ?? 0)) / 100 })), start);
}
