# Minimal, deterministic image for MCP introspection (Glama / Smithery).
# Installs the already-published, pre-built npm package (ships dist/), so there
# is NO in-container TypeScript build that can fail.
FROM node:20-alpine
WORKDIR /app
RUN npm install --omit=dev --no-audit --no-fund subkill-mcp@latest
ENV NODE_ENV=production
# Stdio MCP server. The hub runs this and sends initialize + tools/list.
CMD ["npx", "--no-install", "subkill-mcp"]
