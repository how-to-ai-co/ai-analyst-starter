import type { Connections, Kpi, Point } from "../types";
import { csvUrl } from "./csv-url";
import { hubspot } from "./hubspot";
import { posthog } from "./posthog";
import { shopify } from "./shopify";
import { stripe } from "./stripe";

/**
 * A source returns the daily history it can see for one KPI. The app reads it fresh every time it
 * builds the dashboard, the report or an answer, so the member never types numbers in.
 *
 * To add a tool: copy stripe.ts, read its narrowest read-only key from `connections`, return points,
 * and register it below with the key it needs. The member saves the key on the Setup page.
 */
export type SourceFn = (kpi: Kpi, connections: Connections, timezone?: string) => Promise<Point[]>;
export type Need = { name: string; label: string; help: string };

export const sources: Record<string, { label: string; fetch?: SourceFn; needs?: Need[] }> = {
  manual: { label: "Typed or uploaded" },
  csv_url: { label: "Spreadsheet link", fetch: csvUrl },
  stripe: {
    label: "Stripe",
    fetch: stripe,
    needs: [{ name: "STRIPE_API_KEY", label: "Stripe restricted key", help: "Stripe dashboard: Developers, API keys, Create restricted key. Give Charges and Customers Read access, nothing else, then copy the key." }],
  },
  shopify: {
    label: "Shopify",
    fetch: shopify,
    needs: [{ name: "SHOPIFY_ADMIN_TOKEN", label: "Shopify Admin API token", help: "Shopify admin: Settings, Apps and sales channels, Develop apps, Create an app, give it read_orders, Install, then copy the Admin API access token." }],
  },
  hubspot: {
    label: "HubSpot",
    fetch: hubspot,
    needs: [{ name: "HUBSPOT_TOKEN", label: "HubSpot private app token", help: "HubSpot: Settings, Integrations, Private apps, Create, give it crm.objects.deals.read, then copy the access token." }],
  },
  posthog: {
    label: "PostHog",
    fetch: posthog,
    needs: [{ name: "POSTHOG_API_KEY", label: "PostHog personal API key", help: "PostHog: your avatar, Settings, Personal API keys, Create, give it Query read access, then copy the key." }],
  },
};

export function sourceLabel(kpi: Kpi) {
  return sources[kpi.source.type]?.label ?? kpi.source.type;
}

/** The keys a member still has to save for the tools their KPIs use. */
export function neededKeys(kpis: Kpi[]): Need[] {
  const seen = new Map<string, Need>();
  for (const k of kpis) for (const n of sources[k.source.type]?.needs ?? []) seen.set(n.name, n);
  return [...seen.values()];
}
