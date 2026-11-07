# Builds and runs the UX/UI Principles MCP server over stdio.
# Used by Glama's automated checks; end users install from npm instead:
#   npx -y @uxuiprinciples/mcp-server
FROM node:22-alpine AS build
WORKDIR /app
COPY package.json ./
COPY packages/principles-data/package.json packages/principles-data/
COPY packages/mcp-server/package.json packages/mcp-server/
RUN npm install --no-audit --no-fund
COPY . .
RUN npm run build

FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /app/package.json ./
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/packages/principles-data/package.json packages/principles-data/
COPY --from=build /app/packages/principles-data/dist packages/principles-data/dist
COPY --from=build /app/packages/mcp-server/package.json packages/mcp-server/
COPY --from=build /app/packages/mcp-server/dist packages/mcp-server/dist
# Optional: UXUI_API_KEY (Principles Library key) turns on pro mode.
ENTRYPOINT ["node", "packages/mcp-server/dist/index.js"]
