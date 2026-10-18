import type { Connections, Kpi, Point } from "../types";
import { bucket, dayOf, getJson, sinceDate } from "./util";

/**
 * HubSpot. Needs a private app access token with crm.objects.deals.read, saved as HUBSPOT_TOKEN.
 * source: { "type": "hubspot", "metric": "won_amount" | "deals_won" | "new_deals" | "open_pipeline" }
 * open_pipeline is the value of open deals right now, so it starts with today's number and builds history from there.
 */
export async function hubspot(kpi: Kpi, connections: Connections, timezone = "UTC"): Promise<Point[]> {
  const token = connections.HUBSPOT_TOKEN || process.env.HUBSPOT_TOKEN;
  if (!token) throw new Error("Save your HubSpot private app token (HUBSPOT_TOKEN) on Setup");
  const metric = String((kpi.source as { metric?: string }).metric ?? "won_amount");
  const since = String(sinceDate().getTime());
  const filters =
    metric === "new_deals"
      ? [{ propertyName: "createdate", operator: "GTE", value: since }]
      : metric === "open_pipeline"
        ? [{ propertyName: "hs_is_closed", operator: "EQ", value: "false" }]
        : [
            { propertyName: "hs_is_closed_won", operator: "EQ", value: "true" },
            { propertyName: "closedate", operator: "GTE", value: since },
          ];
  const deals: HubspotDeal[] = [];
  let after: string | undefined;
  for (let page = 0; page < 30; page++) {
    const { data } = await getJson(
      "https://api.hubapi.com/crm/v3/objects/deals/search",
      {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ filterGroups: [{ filters }], properties: ["amount", "closedate", "createdate"], limit: 100, after }),
      },
      "HubSpot",
    );
    deals.push(...data.results);
    after = data.paging?.next?.after;
    if (!after) break;
  }
  return hubspotToPoints(metric, deals, timezone);
}

type HubspotDeal = { properties: { amount?: string | null; closedate?: string | null; createdate?: string | null } };

export function hubspotToPoints(metric: string, deals: HubspotDeal[], timezone = "UTC"): Point[] {
  const amount = (d: HubspotDeal) => Number(d.properties.amount ?? 0) || 0;
  const start = dayOf(sinceDate(), timezone);
  if (metric === "open_pipeline") return [{ date: dayOf(new Date(), timezone), value: Math.round(deals.reduce((a, d) => a + amount(d), 0)) }];
  if (metric === "new_deals") return bucket(deals.filter((d) => d.properties.createdate).map((d) => ({ day: dayOf(d.properties.createdate!, timezone), value: 1 })), start);
  const won = deals.filter((d) => d.properties.closedate);
  if (metric === "deals_won") return bucket(won.map((d) => ({ day: dayOf(d.properties.closedate!, timezone), value: 1 })), start);
  return bucket(won.map((d) => ({ day: dayOf(d.properties.closedate!, timezone), value: amount(d) })), start);
}
