import { runTool, tools } from "@/lib/ask";
import { mcpToken, passcode, safeEqual } from "@/lib/auth";
import { loadState } from "@/lib/store";

/**
 * The analyst as a connector for Claude or ChatGPT (an MCP server over HTTP).
 * The secret is part of the URL because connector settings cannot always send headers.
 * It only exposes the two read-only tools the bot uses, so the AI can look up numbers and nothing else.
 */
export const dynamic = "force-dynamic";

type Rpc = { jsonrpc: "2.0"; id?: string | number | null; method: string; params?: Record<string, unknown> };

export async function POST(req: Request, ctx: { params: Promise<{ token: string }> }) {
  const { token } = await ctx.params;
  if (!passcode() || !safeEqual(token, mcpToken())) return new Response("Not found", { status: 404 });

  const body = await req.json().catch(() => null);
  if (!body) return rpcError(null, -32700, "Parse error");
  const calls: Rpc[] = Array.isArray(body) ? body : [body];
  const out = (await Promise.all(calls.map(handle))).filter((r) => r !== null);
  if (out.length === 0) return new Response(null, { status: 202 });
  return Response.json(Array.isArray(body) ? out : out[0], { headers: { "Cache-Control": "no-store" } });
}

export async function GET() {
  return new Response("Method not allowed", { status: 405, headers: { Allow: "POST" } });
}

async function handle(msg: Rpc): Promise<object | null> {
  const id = msg.id ?? null;
  if (msg.id === undefined) return null; // notifications need no reply
  switch (msg.method) {
    case "initialize":
      return ok(id, {
        protocolVersion: typeof msg.params?.protocolVersion === "string" ? msg.params.protocolVersion : "2025-06-18",
        capabilities: { tools: {} },
        serverInfo: { name: "ai-analyst", version: "1.0.0" },
        instructions: "Look up the member's KPIs. Call list_metrics first, then get_metric for history. Only use numbers these tools return.",
      });
    case "ping":
      return ok(id, {});
    case "tools/list":
      return ok(id, { tools: tools.map((t) => ({ name: t.name, description: t.description, inputSchema: t.input_schema, annotations: { readOnlyHint: true } })) });
    case "tools/call": {
      const name = String(msg.params?.name ?? "");
      if (!tools.some((t) => t.name === name)) return err(id, -32602, `Unknown tool ${name}`);
      try {
        const result = await runTool(await loadState(), name, (msg.params?.arguments as Record<string, unknown>) ?? {});
        return ok(id, { content: [{ type: "text", text: JSON.stringify(result) }], isError: false });
      } catch (e) {
        return ok(id, { content: [{ type: "text", text: (e as Error).message }], isError: true });
      }
    }
    default:
      return err(id, -32601, `Method not found: ${msg.method}`);
  }
}

const ok = (id: unknown, result: unknown) => ({ jsonrpc: "2.0", id, result });
const err = (id: unknown, code: number, message: string) => ({ jsonrpc: "2.0", id, error: { code, message } });
const rpcError = (id: unknown, code: number, message: string) => Response.json(err(id, code, message), { status: 400 });
