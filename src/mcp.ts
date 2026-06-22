#!/usr/bin/env node
// mcp.ts — stdio entrypoint for the MCP server (npx -y subkill-mcp).
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { buildMcpServer } from "./mcpServer.js";

async function main() {
  const server = buildMcpServer();
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((err) => {
  console.error("zombie-killer MCP fatal:", err);
  process.exit(1);
});
