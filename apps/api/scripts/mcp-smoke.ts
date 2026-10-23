/**
 * Starts the MCP server the way an AI assistant would, then lists its tools and calls a few.
 * Run: npm run mcp:smoke -w @leadpilot/api
 */
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

const client = new Client({ name: "leadpilot-smoke-test", version: "0.0.1" });
await client.connect(
  new StdioClientTransport({ command: "npx", args: ["tsx", "--env-file=.env", "src/mcp/server.ts"] }),
);

const text = (r: any) => (r.content?.[0]?.text ?? "") as string;

const { tools } = await client.listTools();
console.log("Tools:", tools.map((t) => t.name).join(", "));

const hot = await client.callTool({ name: "list_leads", arguments: { tier: "HOT", limit: 3 } });
const leads = JSON.parse(text(hot)) as Array<{ id: string; name: string; score: number; email: string | null }>;
console.log("Top HOT leads:", leads.map((l) => `${l.name} (${l.score})`).join(", "));

const kb = await client.callTool({ name: "search_knowledge_base", arguments: { query: "SEO audit price" } });
console.log("KB search first hit:", JSON.parse(text(kb))[0]?.content.slice(0, 70).replace(/\n/g, " "));

const withEmail = leads.find((l) => l.email);
if (withEmail) {
  const draft = await client.callTool({
    name: "send_email",
    arguments: { leadId: withEmail.id, subject: "Following up", body: "Hi! Just checking in about your project." },
  });
  console.log("send_email ->", text(draft).replace(/\s+/g, " "));
}

const bad = await client.callTool({ name: "update_lead_status", arguments: { leadId: "does-not-exist", status: "WON" } });
console.log("update unknown lead ->", text(bad), bad.isError ? "(isError)" : "");

await client.close();
