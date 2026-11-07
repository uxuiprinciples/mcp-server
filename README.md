# UX/UI Principles MCP server

Source of [`@uxuiprinciples/mcp-server`](https://www.npmjs.com/package/@uxuiprinciples/mcp-server): 195 research-backed UX/UI principles with their citations, 12 UX smells with fix recipes and 12 user-flow checklists, in English and Spanish, for Claude Code, Claude Desktop, Cursor, VS Code, Windsurf or any MCP client.

Install, tools, pro mode and troubleshooting: [packages/mcp-server/README.md](packages/mcp-server/README.md) or [uxuiprinciples.com/en/docs/mcp](https://uxuiprinciples.com/en/docs/mcp).

```bash
claude mcp add uxui-principles -- npx -y @uxuiprinciples/mcp-server
```

## About this repository

This is a read-only mirror. The code is developed in a private monorepo and pushed here by a workflow on every change to the packages and on every release tag (which also cuts a GitHub release here), so pull requests cannot be merged; issues are welcome and get answered. The dataset in `packages/principles-data/src/generated/dataset.ts` is the same public catalogue (metadata, summaries, citations) that ships in the npm package; the full guides and the AI prompts stay in the [Principles Library](https://uxuiprinciples.com/en/developers).

## Run from source

```bash
npm install
npm run build
node packages/mcp-server/dist/index.js
```

`npm run smoke-test` packs the server, installs it in a temp project and drives both modes over stdio. The `Dockerfile` builds the same server for registry checks.

MIT, UX/UI Principles.
