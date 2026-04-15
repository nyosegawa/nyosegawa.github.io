---
title: "I Built a Coding-Agent-Friendly CLI for Every Notion User"
description: "How I built ncli, a CLI that wraps Notion's Remote MCP, and what I learned about CLI design in the age of coding agents."
date: 2026-03-19
tags: [Notion, MCP, CLI, Agent, Claude Code]
author: 逆瀬川ちゃん
lang: en
---

Hi there! This is Sakasegawa-chan ([@gyakuse](https://x.com/gyakuse))!

Today I want to write about [@sakasegawa/ncli](https://www.npmjs.com/package/@sakasegawa/ncli) ([GitHub](https://github.com/nyosegawa/notion-cli)) — a CLI I built that wraps Notion's Remote MCP — and the "CLI design for the agent era" thinking that came out of building it.

<!--more-->

## The official Notion CLI has finally landed

Notion's official CLI, `ntn`, was released. It was announced in Jonathan Clem's [tweet](https://x.com/_clem/status/2033970975222440421), and an Agent Skill ([makenotion/skills](https://github.com/makenotion/skills)) was published alongside it. The CLI repo isn't public as of today (2026/03/19).

> New in the Notion CLI, `ntn`: The whole Notion API! And a skill so that your agents know how to use it.

The long-awaited Notion CLI. I installed it with some excitement, and then felt a little sad after trying it out (T_T)

Right now `ntn` is a thin wrapper over the REST API. Its `ntn api` command just calls `/v1/` endpoints. Auth requires the `NOTION_API_TOKEN` environment variable (an Integration Token), and you have to manually connect each page you want to use. Notion themselves admit it's "alpha-y so auth is a little wonky."

Meanwhile, Notion has a Remote MCP (`https://mcp.notion.com/mcp`) that gives you OAuth access to your entire workspace. And it has a lot of features `ntn` doesn't.

| Feature | Remote MCP | ntn (REST API) |
|---|---|---|
| Authentication | OAuth (whole workspace) | Integration Token (manual connection) |
| AI cross-search (Slack, Drive, etc.) | Yes | No (title search only) |
| Create/update views | Yes | No |
| Page duplication | Yes | Yes (via `template` parameter) |
| Database view query | Yes | No |
| Meeting notes | Yes (create/update) | Yes (read only) |
| Direct block operations | No | Yes |
| File upload | No | Yes |

Remote MCP is clearly the better choice for using Notion to its fullest.

That said, MCP has a context problem — unless you disable the agent's instruction budget entirely, it significantly pollutes the context. The progressive-disclosure approach I described in [MCP Light](/posts/mcp-light/) works for local MCP, but for Remote MCP servers, about the only prescription is to put a proxy in front.

Also, I just really wanted to use it snappily from the command line — so I built one!

## CLI Design in the Agent Era

The key decision I made going into this was: the primary user is the Coding Agent (Claude Code, Codex, etc.). As a side benefit, I also wanted to think about "CLI design in the agent era," and that's how it ended up this way.

Humans are a secondary audience; the optimization axis is the Coding Agent. When a Coding Agent uses this CLI for the first time, the path looks like this.

1. Read `ncli --help` (command list + quick start)
2. Run a command
3. If there's an error, fix based on the hint
4. For complex operations, check `ncli <command> --help`

In practice, the error hints become the real guide. With that in mind, here are four design principles.

### 1. Output in a format that agents can read

Default output auto-detects MCP response JSON text and `pretty-print`s it.
Human-facing decoration (colors, rules, spinners, etc.) is automatically controlled via TTY detection and stripped when piped. Even by default you get JSON, so you can read it without `jq`.

- `--json` is nearly identical to the default, but when MCP returns non-JSON text, it wraps it as `{ "text": "..." }` so the agent's parse never fails
- `--raw` returns the MCP response as-is (including the `isError` flag and content array structure)
- Errors in `--json` mode are also structured as `{ "error", "why", "hint" }`

### 2. Discovery via `--help` + error hints

`--help` uses three-layer progressive disclosure.

- `ncli --help` → all commands + quick start + workflow examples
- `ncli page --help` → sub-command list
- `ncli db create --help` → flags, examples, prerequisites, next steps

But as noted, what agents actually rely on are the error hints. The CLI has a mechanism that pattern-matches MCP errors and attaches tool-specific hints.

| Error pattern | Hint |
|---|---|
| Querying a DB URL | A view URL is needed → fetch or view create |
| page create with a DB ID as parent | data_source_id is needed → obtain via fetch |
| data_source_id required | Run fetch \<db-id\> and look for collection://... |
| rich_text required | Specify comment body via --body |

### 3. Errors are easy to understand: What + Why + Hint

Every error is structured into three elements: what happened, why it happened, and what to do next.

```
Error: notion-create-pages failed
  Why: Could not find page with ID: abc123...
  Hint: If adding to a database, use --parent collection://<ds-id>.
        Run "ncli fetch <db-id>" to get the data_source_id
```

CLI argument parsing errors, MCP `isError` responses, OAuth errors — all unified into this format. Hints are essential so the agent doesn't make the same mistake twice.

### 4. Escape with an Escape Hatch

For tools that are hard to implement in the CLI, or that have complex argument structures, `ncli api` takes over.

```bash
ncli api notion-search '{"query":"test","page_size":5}'
echo '{"query":"test"}' | ncli api notion-search
```

If the CLI commands aren't enough, the agent can fall back to `ncli api`.
Ideally you don't want to expose MCP's internal tool names, but this escape hatch is the one exception. Preventing feature lock-in matters more.

### Patterns to avoid

I also kept track of patterns I consciously avoided while designing this.

| Pattern | Problem |
|---|---|
| Using MCP tool names as the primary CLI interface | You lose CLI DX like noun-verb grouping, tab completion, and validation |
| Dedicated discovery commands (e.g., `tools`) | `--help` is sufficient. Extra commands raise cognitive load |
| Burying important info in sub-command `--help` | Agents don't read it. Error hints reach them better |
| Output only in decorated human-facing formats | Hard to parse when piped |
| Errors with no next step | Agents repeat the same mistake |

I also bundle an Agent Skill ([skills/notion/SKILL.md](https://github.com/nyosegawa/notion-cli/blob/main/skills/notion/SKILL.md)) with this CLI. It captures systematic knowledge that error hints can't fully cover: the Search → Fetch → Act workflow pattern, and how to use different ID types (`page_id` / `data_source_id` / `view_url`). That said, even without the Skill, the CLI alone is usable if you follow `--help` and error hints, so the Skill is strictly a booster. When users define their own workflow Skills, they can just include a one-liner "first run `ncli --help` to understand usage" and they probably don't need to explain this tool itself.

## About the implementation

With the design principles set, let's get to the implementation.

### Architecture

It connects to Remote MCP (`https://mcp.notion.com/mcp`) over Streamable HTTP Transport and translates CLI commands into MCP tool calls.

```
User / Agent
    │
    ▼
CLI (Commander.js)
    │  buildXxxCall() maps CLI args → MCP args
    ▼
withConnection()
    │  MCPConnection.connect() → callTool() → disconnect()
    ▼
MCP SDK (StreamableHTTPClientTransport)
    │  JSON-RPC over HTTPS
    ▼
Remote Notion MCP (https://mcp.notion.com/mcp)
```

Every command is composed of the same three parts.

`buildXxxCall()` is a pure function that turns CLI arguments into an MCP tool name and arguments. Side-effect-free, so it's easy to test.

```typescript
// src/commands/search.ts
export function buildSearchCall(query: string): {
  tool: string;
  args: Record<string, unknown>;
} {
  return { tool: "notion-search", args: { query } };
}
```

`withConnection()` is a helper that manages the MCP connection lifecycle. It does connect → run → disconnect in one shot, and auto-retries on rate limit.

```typescript
// src/mcp/with-connection.ts
export async function withConnection<T>(
  fn: (conn: MCPConnection) => Promise<T>
): Promise<T> {
  const conn = new MCPConnection();
  try {
    await conn.connect();
    return await withRetry(() => fn(conn));
  } finally {
    await conn.disconnect();
  }
}
```

`printOutput()` handles output control for `--json` / `--raw` / default.

Every command ends up following this pattern.

```typescript
const { tool, args } = buildSearchCall(query);
await withConnection(async (conn) => {
  const result = await conn.callTool(tool, args);
  printOutput(result, cmd.optsWithGlobals());
});
```

All commands have a `--data` flag too, so you can pass JSON directly and bypass CLI flags, shipping the payload straight to MCP. That's another kind of escape hatch.

### Authentication: OAuth 2.0 + PKCE

I aimed for zero-config auth. Whether it's the first `ncli search` or an explicit `ncli login`, if you're not authenticated, a browser opens and the OAuth flow starts.

```
ncli search "hello"
  → MCPConnection.connect()
  → UnauthorizedError
  → open OAuth consent screen in browser
  → CallbackServer waits for redirect
  → Token Exchange → save tokens.json (0o600)
  → reconnect and execute
```

Dynamic Client Registration, PKCE (S256), and token refresh are all handled by the MCP SDK. The CLI only manages token persistence. Tokens are saved into the OS-specific config directory via `env-paths`.

| OS | Location |
|---|---|
| macOS | `~/Library/Preferences/ncli/` |
| Linux | `~/.config/ncli/` |
| Windows | `%APPDATA%\ncli\Config\` |

Inside there you find `tokens.json` (access/refresh token, permissions 0o600) and `client.json` (OAuth client registration info).

### Error hint system

When an MCP `isError` response comes back, the CLI pattern-matches the error message with regex and attaches tool-specific hints.

```typescript
// src/mcp/client.ts
const HINT_RULES: HintRule[] = [
  {
    pattern: /could not find page with id/i,
    tool: "notion-create-pages",
    hint: 'If adding to a database, use --parent collection://<ds-id>. '
        + 'Run "ncli fetch <db-id>" to get the data_source_id',
  },
  {
    pattern: /invalid database view url/i,
    hint: 'Use a view URL with ?v= parameter. '
        + 'Run "ncli fetch <db-id>" to find view URLs',
  },
  // ...
];

function mcpErrorToCliError(toolName: string, result): CliError {
  const message = extractMcpErrorMessage(result);
  const rule = HINT_RULES.find(
    r => r.pattern.test(message) && (!r.tool || r.tool === toolName)
  );
  return new CliError(`${toolName} failed`, message, rule?.hint);
}
```

Tool-specific rules match first, and generic rules (`unauthorized`, `rate limit`, etc.) serve as fallbacks. When an agent gets stuck on "page not found," the CLI immediately tells it "run `ncli fetch` to get the `data_source_id`."

### Test strategy

The test strategy prioritizes pure-function tests for `buildXxxCall()`. It verifies that CLI arguments map correctly to MCP arguments.

```typescript
describe("buildPageCreateCall", () => {
  it("maps --title to pages[0].properties.title", () => {
    const result = buildPageCreateCall({ title: "My Page" });
    expect(result.tool).toBe("notion-create-pages");
    const pages = result.args.pages as Record<string, unknown>[];
    expect(pages[0].properties).toEqual({ title: "My Page" });
  });
});
```

I don't do E2E tests against MCP. The pure-function tests verify the CLI → MCP mapping, and I leave MCP's own correctness to Notion. I run build / type-check / lint / tests all through `vitest`.

### Tech stack

I aimed to keep dependencies minimal, but `@modelcontextprotocol/sdk` is ridiculously heavy.

| Library | Role | Size |
|---|---|---|
| `@modelcontextprotocol/sdk` | MCP Client + OAuth | ~4.2 MB |
| `commander` | CLI framework | ~180 KB |
| `env-paths` | OS-specific config directory | ~5 KB |
| `open` | Browser launcher (OAuth) | ~50 KB |

Runs on Node.js >= 18.

## Introducing the Notion CLI

From here, let me walk through actual usage.

### Install

```bash
npm install -g @sakasegawa/ncli
```

This installs the `ncli` command.

### Quick Start

```bash
# Log in (opens browser, first time only)
ncli login

# Search
ncli search "project plan"

# Fetch page
ncli fetch <id>

# Create page
ncli page create --title "New Page" --parent <page-id>

# Update property
ncli page update <id> --prop "Status=Done"
```

### Commands

| Command | Description |
|---|---|
| `ncli login / logout / whoami` | OAuth authentication management |
| `ncli search <query>` | Cross-workspace search |
| `ncli fetch <url-or-id>` | Fetch page or DB |
| `ncli page create / update / move / duplicate` | Page operations |
| `ncli db create / update / query` | Database operations |
| `ncli view create / update` | View operations |
| `ncli comment create / list` | Comment operations |
| `ncli user list / team list` | Users and teams listing |
| `ncli meeting-notes query` | Meeting notes |
| `ncli api <tool> [json]` | Direct MCP call (escape hatch) |

### A representative workflow

The pattern agents use most is Search → Fetch → Act.

```bash
# 1. Search and get IDs
ncli search "Tasks DB" --json

# 2. Fetch DB details (check data_source_id and view URLs)
ncli fetch <db-id> --json

# 3. Add an entry to the DB
ncli page create --parent collection://<ds-id> \
  --title "New task" --prop "Status=Open"
```

The flow from creating a database to adding an entry looks like this.

```bash
# Create DB (define columns with --prop)
ncli db create --title "Tasks" --parent <page-id> \
  --prop "Name:title" --prop "Status:select=Open,Done"

# Get the data_source_id from the response, then add an entry
ncli page create --parent collection://<ds-id> \
  --title "Task 1" --prop "Status=Open"
```

Piping from stdin works too.

```bash
echo "# Meeting Notes" | ncli page create \
  --title "2026-03-18 Weekly" --parent <id> --body -
```

Every command supports `--json` (structured output), `--raw` (raw MCP response), and `--data` (direct JSON input).

## Summary

- By wrapping the Remote MCP in a CLI, you can OAuth into your whole workspace and fully use Notion from both the terminal and agents
- Agent-first design (structured output, What+Why+Hint errors, escape hatches) is also pleasant for humans
- Installable from [npm](https://www.npmjs.com/package/@sakasegawa/ncli). Source is on [GitHub](https://github.com/nyosegawa/notion-cli)
- Please give it a try! I've been using it with Claude and it's pretty handy

## References

- [GitHub: nyosegawa/notion-cli](https://github.com/nyosegawa/notion-cli)
- [npm: @sakasegawa/ncli](https://www.npmjs.com/package/@sakasegawa/ncli)
- [Notion Remote MCP](https://mcp.notion.com/mcp)
- [ntn (official Notion CLI)](https://www.npmjs.com/package/ntn)
- [makenotion/skills](https://github.com/makenotion/skills)
- [MCP Light: slimming down MCP like Agent Skills](/posts/mcp-light/)
- [Model Context Protocol](https://modelcontextprotocol.io/)
