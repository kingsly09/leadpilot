/**
 * LeadPilot MCP server (stdio). Lets a team member's AI assistant (e.g. Claude Desktop)
 * work with LeadPilot through the same tools and permission rules as the chatbot.
 *
 * It acts as the user named in MCP_USER_EMAIL, so that user's role applies:
 * VIEWER can only read, AGENT only sees their own leads, and emails always need approval.
 *
 * stdout carries the MCP protocol, so this process must only log to stderr.
 */
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { env } from "../env.js";
import { db } from "../lib/db.js";
import { runTool, toolsFor, type Actor } from "../tools/registry.js";

if (!env.MCP_USER_EMAIL) {
  console.error("Set MCP_USER_EMAIL in .env to the LeadPilot user this MCP server should act as.");
  process.exit(1);
}
const user = await db.user.findUnique({ where: { email: env.MCP_USER_EMAIL } });
if (!user) {
  console.error(`No LeadPilot user with email ${env.MCP_USER_EMAIL}`);
  process.exit(1);
}
const actor: Actor = { type: "user", userId: user.id, role: user.role };

const server = new McpServer({ name: "leadpilot", version: "0.1.0" });

for (const def of toolsFor("mcp")) {
  server.registerTool(
    def.name,
    {
      description: def.description,
      inputSchema: def.input.shape,
      annotations: { readOnlyHint: def.risk === "read" },
    },
    async (args: unknown) => {
      try {
        const result = await runTool(def, args, actor);
        return { content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }] };
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return { content: [{ type: "text" as const, text: `Error: ${message}` }], isError: true };
      }
    },
  );
}

await server.connect(new StdioServerTransport());
console.error(`LeadPilot MCP server ready (acting as ${user.email}, role ${user.role})`);
