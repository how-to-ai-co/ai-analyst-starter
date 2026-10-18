import "server-only";
import { secret } from "./deliver";
import { buildViews, history } from "./metrics";
import { changeText, formatValue } from "./format";
import type { State } from "./types";

/**
 * The only things the bot can look up. It cannot run its own queries or open web pages,
 * so every number it gives comes from the same data as the dashboard.
 */
export const tools = [
  {
    name: "list_metrics",
    description: "List every KPI on the dashboard with its latest value, its comparison and whether it is sample data.",
    input_schema: { type: "object", properties: {}, additionalProperties: false },
  },
  {
    name: "get_metric",
    description: "Get the daily history of one KPI between two dates (YYYY-MM-DD). Use the KPI id or name from list_metrics.",
    input_schema: {
      type: "object",
      properties: {
        name: { type: "string", description: "KPI id or name" },
        start_date: { type: "string", description: "YYYY-MM-DD, optional" },
        end_date: { type: "string", description: "YYYY-MM-DD, optional" },
      },
      required: ["name"],
      additionalProperties: false,
    },
  },
] as const;

export async function runTool(state: State, name: string, input: Record<string, unknown>): Promise<unknown> {
  if (name === "list_metrics") {
    const { settings, views } = await buildViews(state);
    return {
      dashboard: settings.name,
      comparison: settings.comparison,
      today: new Date().toISOString().slice(0, 10),
      metrics: views.map((v) => ({
        id: v.id,
        name: v.name,
        latest: formatValue(v.value, v.format, v.currency),
        latestDate: v.series[v.series.length - 1]?.date ?? null,
        change: changeText(v, settings.comparison),
        sample: v.sample,
        stale: v.stale,
        source: v.sourceLabel,
      })),
    };
  }
  if (name === "get_metric") {
    const h = await history(state, String(input.name ?? ""), input.start_date as string | undefined, input.end_date as string | undefined);
    return h ?? { error: "No KPI with that name. Call list_metrics to see the names." };
  }
  return { error: `Unknown tool ${name}` };
}

const SYSTEM = `You are the member's AI analyst. Answer questions about their KPIs in one to three short sentences.
Only use numbers returned by the tools. If a number is sample data, say so. If the data cannot answer the question, say what is missing.
Never guess a number and never give investment, legal or medical advice.`;

export function askReady(state: State) {
  if (secret("ANTHROPIC_API_KEY", state.connections)) return "anthropic" as const;
  if (secret("OPENAI_API_KEY", state.connections)) return "openai" as const;
  return null;
}

/** Answer a question with Anthropic or OpenAI, whichever key the member saved. */
export async function ask(state: State, question: string): Promise<string> {
  const provider = askReady(state);
  if (!provider) throw new Error("Add an Anthropic or OpenAI API key on the Setup page to ask questions here.");
  const q = question.slice(0, 1000);
  return provider === "anthropic" ? askAnthropic(state, q) : askOpenAI(state, q);
}

async function askAnthropic(state: State, question: string): Promise<string> {
  const key = secret("ANTHROPIC_API_KEY", state.connections)!;
  const model = secret("ANTHROPIC_MODEL", state.connections) ?? "claude-haiku-5-5";
  const messages: Array<{ role: string; content: unknown }> = [{ role: "user", content: question }];
  for (let i = 0; i < 5; i++) {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "x-api-key": key, "anthropic-version": "2023-06-01", "content-type": "application/json" },
      body: JSON.stringify({ model, max_tokens: 600, system: SYSTEM, tools, messages }),
    });
    if (!res.ok) throw new Error(`Anthropic said ${res.status}: ${(await res.text()).slice(0, 200)}`);
    const data = await res.json();
    const uses = (data.content as Array<{ type: string; id: string; name: string; input: Record<string, unknown>; text?: string }>).filter((c) => c.type === "tool_use");
    if (uses.length === 0 || data.stop_reason !== "tool_use") {
      return data.content.filter((c: { type: string }) => c.type === "text").map((c: { text: string }) => c.text).join("\n").trim();
    }
    messages.push({ role: "assistant", content: data.content });
    const results = await Promise.all(uses.map(async (u) => ({ type: "tool_result", tool_use_id: u.id, content: JSON.stringify(await runTool(state, u.name, u.input)) })));
    messages.push({ role: "user", content: results });
  }
  return "I couldn't finish that one. Try asking about one KPI at a time.";
}

async function askOpenAI(state: State, question: string): Promise<string> {
  const key = secret("OPENAI_API_KEY", state.connections)!;
  const model = secret("OPENAI_MODEL", state.connections) ?? "gpt-5-mini";
  const oaTools = tools.map((t) => ({ type: "function", function: { name: t.name, description: t.description, parameters: t.input_schema } }));
  const messages: Array<Record<string, unknown>> = [{ role: "system", content: SYSTEM }, { role: "user", content: question }];
  for (let i = 0; i < 5; i++) {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "content-type": "application/json" },
      body: JSON.stringify({ model, tools: oaTools, messages }),
    });
    if (!res.ok) throw new Error(`OpenAI said ${res.status}: ${(await res.text()).slice(0, 200)}`);
    const msg = (await res.json()).choices[0].message;
    if (!msg.tool_calls?.length) return String(msg.content ?? "").trim();
    messages.push(msg);
    for (const call of msg.tool_calls) {
      const out = await runTool(state, call.function.name, JSON.parse(call.function.arguments || "{}"));
      messages.push({ role: "tool", tool_call_id: call.id, content: JSON.stringify(out) });
    }
  }
  return "I couldn't finish that one. Try asking about one KPI at a time.";
}
