# @uxuiprinciples/mcp-server

MCP server for UX/UI Principles: 195 research-backed principles with their citations, 12 UX smells with fix recipes and 12 user-flow checklists, in English and Spanish, inside Claude Code, Claude Desktop, Cursor, VS Code, Windsurf or any MCP client.

Free and offline by default: the dataset ships inside the package and the server makes no network call. A Principles Library API key turns on **pro mode**, which adds the full guide bodies, the AI prompts and an interface audit through the uxuiprinciples.com API.

## What is MCP?

[Model Context Protocol (MCP)](https://modelcontextprotocol.io) is an open protocol that lets an AI assistant call external tools. This server speaks MCP over stdio and registers 14 tools.

## Installation

Requires Node.js 18 or newer. `npx -y` fetches the latest version on first run.

### Claude Code

```bash
claude mcp add uxui-principles -- npx -y @uxuiprinciples/mcp-server
```

Add `--scope user` to make it available in every project. Confirm with `claude mcp list`.

### Claude Desktop

Add to `~/Library/Application Support/Claude/claude_desktop_config.json` (macOS) or `%APPDATA%\Claude\claude_desktop_config.json` (Windows), then restart Claude Desktop:

```json
{
  "mcpServers": {
    "uxui-principles": {
      "command": "npx",
      "args": ["-y", "@uxuiprinciples/mcp-server"]
    }
  }
}
```

### Cursor

Add to `.cursor/mcp.json` in the project (or `~/.cursor/mcp.json` for every project), then enable the server in Cursor Settings, MCP:

```json
{
  "mcpServers": {
    "uxui-principles": {
      "command": "npx",
      "args": ["-y", "@uxuiprinciples/mcp-server"]
    }
  }
}
```

### VS Code

Add to `.vscode/mcp.json` in the workspace, then start the server from the MCP panel or let Copilot agent mode start it:

```json
{
  "servers": {
    "uxui-principles": {
      "type": "stdio",
      "command": "npx",
      "args": ["-y", "@uxuiprinciples/mcp-server"]
    }
  }
}
```

### Windsurf

Add to `~/.codeium/windsurf/mcp_config.json`, then refresh the MCP list in Cascade:

```json
{
  "mcpServers": {
    "uxui-principles": {
      "command": "npx",
      "args": ["-y", "@uxuiprinciples/mcp-server"]
    }
  }
}
```

### Global install

```bash
npm install -g @uxuiprinciples/mcp-server
uxui-mcp
```

Point the client at the `uxui-mcp` binary instead of `npx`. Re-run the install to pick up new versions.

## Pro mode (Principles Library key)

The [Principles Library](https://uxuiprinciples.com/en/developers) ($59/year) includes a REST API key. Give it to the server as the `UXUI_API_KEY` environment variable and four tools change:

| Tool | Free mode | Pro mode |
|------|-----------|----------|
| `get_principle` | Metadata, summary, citations, link | The same plus the full guide body in `content` |
| `get_principle_prompts` | Link to the guide | The principle's AI prompts |
| `audit_interface` | Refuses with the key hint | Findings mapped to principles and smells, score, priority fixes |
| `check_requirements` | Refuses with the key hint | Pass or fail per required-state rule, each with its principle and citations |

Everything else keeps running offline. If the API is unreachable, `get_principle` and `get_principle_prompts` fall back to the free answer and report the failure in `proError`; `audit_interface` and `check_requirements` return the error code.

```json
{
  "mcpServers": {
    "uxui-principles": {
      "command": "npx",
      "args": ["-y", "@uxuiprinciples/mcp-server"],
      "env": { "UXUI_API_KEY": "uxui_live_..." }
    }
  }
}
```

For Claude Code: `claude mcp add uxui-principles -e UXUI_API_KEY=uxui_live_... -- npx -y @uxuiprinciples/mcp-server`. The key is read from the environment only and is never logged. Get or rotate yours at [uxuiprinciples.com/account](https://uxuiprinciples.com/en/account). The server's startup line on stderr says `pro mode` or `free mode`, and the `instructions` it hands the client say the same.

## Available tools

### Principles

| Tool | Description |
|------|-------------|
| `get_principle` | One principle by slug: summary, citations (author, title, year, url) and the link to the full guide. Pro: the full guide body |
| `search_principles` | Search by query, part, difficulty, or tags |
| `list_principles` | List all principles or filter by part |
| `get_principle_prompts` | The AI prompts for a principle. Pro: the prompt texts; free: the link to the guide |

### Smells (anti-patterns)

| Tool | Description |
|------|-------------|
| `get_smell` | Get a smell with symptoms and fix recipe |
| `list_smells` | List all smells, optionally by category |
| `detect_smell` | Detect smells from a UI description, written in English or Spanish |
| `suggest_fix` | Get fix suggestions for a UX issue |

### Flows (user journeys)

| Tool | Description |
|------|-------------|
| `get_flow` | Get a flow with pre/post-flight checklists |
| `list_flows` | List all available flows |
| `generate_checklist` | Generate checklist for a flow phase |
| `get_flow_principles` | Get key principles for a flow |

### Pro

| Tool | Description |
|------|-------------|
| `audit_interface` | Audit a described screen (20 to 5,000 characters): findings with severity, remediation and business impact, score, interface type, strengths and the three priority fixes. Needs `UXUI_API_KEY` |
| `check_requirements` | Check a screen given as data (flow, components, actions with `consequential` and `automated` flags, states implemented) against eight required-state rules: confirmation before consequential actions, error, empty and loading states, undo or edit, sources on AI output, recovery after an AI error, consent before automation. Pass, fail or not_applicable per rule with the principle and its citations, plus a markdown summary. Needs `UXUI_API_KEY` |

## Usage examples

```
You: What principle should I follow for form design?

Claude: Let me search for form-related principles...
[Calls search_principles with query="form"]

Based on the UX/UI Principles database, here are the key principles for form design:
1. Progressive Disclosure (D.1.1.01) - Show only essential fields initially
2. Inline Validation - Validate as users type
3. Smart Defaults - Pre-fill common choices
...
```

```
You: My login form has a 60% abandonment rate. Help me fix it.

Claude: Let me detect potential UX issues...
[Calls detect_smell with description="login form high abandonment"]

I detected "Form Graveyard" smell with high confidence. Let me get the fix recipe...
[Calls get_smell with id="form-graveyard"]

Here's my analysis and recommendations:
1. Reduce fields to email + password only
2. Add social login options
3. Use inline validation
...

Let me also get the flow checklist for the form...
[Calls generate_checklist with flow_id="forms" phase="postflight"]
```

With a key:

```
You: Audit this checkout: three steps, no order summary until the last one, the Pay button is disabled with no explanation until every field validates.

Claude: [Calls audit_interface with the description]
Score 58, fair. Two warnings: Visibility of System Status (order summary hidden) and Silent Errors (disabled button without feedback). Priority fix: ...
```

After building a screen:

```
You: Build the settings page: profile form, an AI summary of recent activity, and a danger zone with "Delete account". Then check it.

Claude: [Builds the page, then calls check_requirements with flow "settings", the components, the actions (Delete account flagged consequential) and the states it implemented]
3 of 6 applicable rules fail: undo-or-edit (User Control and Freedom, Nielsen 1994), show-sources (AI Source Citations, Liu et al. 2023), ai-error-recovery (Efficient AI Correction, Amershi et al. 2019). Adding an undo toast, a sources line under the summary and a regenerate control...
```

## Bilingual support

All tools accept `locale: "en" | "es"`. `detect_smell` and `suggest_fix` understand descriptions written in either language whatever the locale:

```
search_principles({ query: "navegación", locale: "es" })
detect_smell({ description: "el formulario es demasiado largo", locale: "es" })
```

## Data included

- **195 principles** across 6 parts, with 500+ bibliographic references returned by `get_principle` (the guides cite 2,400+ academic citations in full)
- **12 UX smells** with fix recipes
- **12 user flows** with checklists
- **Bilingual** (English + Spanish)

## Local development

```bash
git clone https://github.com/joselhurtado/uxuiprinciples-web.git
cd uxuiprinciples-web
npm install
npm run build --workspace=@uxuiprinciples/principles-data
npm run build --workspace=@uxuiprinciples/mcp-server
node packages/mcp-server/dist/index.js
```

`npm run smoke-test --workspace=@uxuiprinciples/mcp-server` packs the build, installs it in a temp project and drives both modes over stdio (pro mode against a local fake of the API). `server.json` next to this README is the MCP Registry manifest; publish with `mcp-publisher publish` after the npm release.

## License

MIT © UX/UI Principles

## Links

- [uxuiprinciples.com](https://uxuiprinciples.com) - Full principles library
- [MCP documentation on the site](https://uxuiprinciples.com/en/docs/mcp)
- [REST API](https://uxuiprinciples.com/en/docs/api) - The same data over HTTPS
- [MCP Documentation](https://modelcontextprotocol.io) - Learn about MCP
