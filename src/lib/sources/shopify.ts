import type { Connections, Kpi, Point } from "../types";
import { bucket, dayOf, getJson, sinceDate } from "./util";

/**
 * Shopify. Needs a custom app's Admin API access token with read_orders, saved as SHOPIFY_ADMIN_TOKEN,
 * and the store address in the source.
 * source: { "type": "shopify", "store": "mystore.myshopify.com", "metric": "sales" | "orders" }
 * Shopify only returns the last 60 days of orders unless the app also has read_all_orders.
 */
export async function shopify(kpi: Kpi, connections: Connections, timezone = "UTC"): Promise<Point[]> {
  const token = connections.SHOPIFY_ADMIN_TOKEN || process.env.SHOPIFY_ADMIN_TOKEN;
  if (!token) throw new Error("Save your Shopify Admin API token (SHOPIFY_ADMIN_TOKEN) on Setup");
  const src = kpi.source as { store?: string; metric?: string };
  const store = String(src.store ?? connections.SHOPIFY_STORE ?? "").replace(/^https?:\/\//, "").replace(/\/.*$/, "");
  if (!/^[a-z0-9-]+\.myshopify\.com$/i.test(store)) throw new Error('Add your store address, like "mystore.myshopify.com", to this KPI\'s settings');
  const version = connections.SHOPIFY_API_VERSION || "2026-07";
  let url: string | null = `https://${store}/admin/api/${version}/orders.json?status=any&limit=250&created_at_min=${sinceDate().toISOString()}&fields=created_at,current_total_price,total_price,cancelled_at,test`;
  const orders: ShopifyOrder[] = [];
  for (let page = 0; url && page < 40; page++) {
    const { data, headers }: { data: { orders: ShopifyOrder[] }; headers: Headers } = await getJson(url, { headers: { "X-Shopify-Access-Token": token } }, "Shopify");
    orders.push(...data.orders);
    const next = (headers.get("link") ?? "").match(/<([^>]+)>;\s*rel="next"/);
    url = next ? next[1] : null;
  }
  return shopifyToPoints(String(src.metric ?? "sales"), orders, timezone);
}

type ShopifyOrder = { created_at: string; current_total_price?: string; total_price?: string; cancelled_at?: string | null; test?: boolean };

export function shopifyToPoints(metric: string, orders: ShopifyOrder[], timezone = "UTC"): Point[] {
  const real = orders.filter((o) => !o.cancelled_at && !o.test);
  const start = dayOf(sinceDate(), timezone);
  if (metric === "orders") return bucket(real.map((o) => ({ day: dayOf(o.created_at, timezone), value: 1 })), start);
  return bucket(real.map((o) => ({ day: dayOf(o.created_at, timezone), value: Number(o.current_total_price ?? o.total_price ?? 0) })), start);
}
