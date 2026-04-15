---
title: "Introducing MCP Light: A New Approach to Slimming Down MCP Like Agent Skills"
description: "MCP's description field eats up context. MCP Light proposes, implements, and validates an approach that compresses descriptions to a single line and offloads best practices into an Agent Skill."
date: 2026-02-13
tags: [MCP, Agent Skills, Context Engineering, FastMCP]
author: 逆瀬川ちゃん
lang: en
---

Hi there! This is Sakasegawa-chan ([@gyakuse](https://x.com/gyakuse))!

Today I want to walk through MCP's (Model Context Protocol) "bloat" problem, and an approach called "MCP Light" that uses Agent Skills to solve it.

<!--more-->

## MCP's role is Connector

MCP's role is getting clearer. As the "USB-C for AI applications" analogy suggests, MCP is a Connector: a standard protocol that links AI models with external tools and data.

[Over 97 million SDK downloads per month](http://blog.modelcontextprotocol.io/posts/2025-12-09-mcp-joins-agentic-ai-foundation/), over 10,000 public servers. Adopted by OpenAI, Google, and Microsoft, it has become the de facto industry standard. Notion, GitHub, Slack, Salesforce: every SaaS out there is publishing MCP servers that AI agents can use.

But this success as a Connector has produced a new problem.

MCP is bloated.

Just connecting fills up the context window. Tool definitions alone eat tens of thousands of tokens, squeezing the context the model actually needs for real work. There's a [report](https://medium.com/@pekastel/mcp-and-context-windows-lessons-learned-during-development-590e0b047916) (Pablo Castillo, 2025) that connecting a 68-tool MCP server made it impossible to even type "Hello." Claude Code users have shared [stories](https://waleedk.medium.com/the-evolution-of-ai-tool-use-mcp-went-sideways-8ef4b1268126) (Waleed Kadous, 2025) of "half my context was gone at startup."

## Why it's bloated: the structural problem with the description field

Let's look at where this bloat actually comes from. When you connect to MCP from a client, all the tool definitions returned by `list_tools()` get loaded into context. The core of the problem is the `description` field.

```json
{
  "name": "notion-create-pages",
  "description": "Creates one or more Notion pages, with the specified
    properties and content. All pages created with a single call to this
    tool will have the same parent. The parent can be a Notion page
    (\"page_id\") or data source (\"data_source_id\"). If the parent is
    omitted, the pages are created as standalone...
    Date properties: Split into \"date:{property}:start\"...
    Checkbox properties: Use \"__YES__\" / \"__NO__\"...",
  "inputSchema": { "..." }
}
```

Two kinds of information are mixed together here.

Decision information: "Creates a Notion page." This is what you need to decide whether to use the tool at all, and it fits in one line.

Runtime best practices: "Use data_source_id," "fetch first," "use this date format." Information you don't need until the moment you actually call the tool.

The former is a few tokens. The latter is hundreds. The Notion server alone has over 13 tools, and connecting multiple servers easily burns tens of thousands of tokens just in tool definitions, before the user's first message is even read.

MCP's context consumption has three stages:

- Stage 1: tool definition bloat: a structural problem that happens the moment you connect
- Stage 2: tool result accumulation: responses pile up every time a tool is used
- Stage 3: overall conversation bloat: compound accumulation over long sessions

This article focuses on Stage 1. Stages 2 and 3 depend on usage patterns, but Stage 1 is unavoidable the moment you connect.

## Existing mitigations: deferred injection

### Tool Search (Claude Code)

Let's look at current mitigations. Claude Code automatically enables Tool Search once MCP tool definitions consume more than 10% of the context window. Instead of preloading all tools, it discovers and loads only the tools that are actually needed, on demand.

Loading all 100 tools → loading only the 3 you need. A significant improvement, but the descriptions of those 3 loaded tools still arrive verbatim. It can narrow down the tool count, but it can't slim down individual tools.

### PTC / Compaction

PTC (Programmatic Tool Calling) addresses Stage 2, and Compaction (conversation summarization) addresses Stage 3. Neither touches Stage 1's tool-definition bloat.

### There's a gap

| Mitigation | Stage 1 (definition bloat) | Stage 2 (result accumulation) | Stage 3 (conversation bloat) |
| --- | --- | --- | --- |
| Tool Search | △ Reduces count but each one is still fat | - | - |
| PTC | - | ◎ | △ |
| Compaction | - | △ | ◎ |

Nothing directly attacks Stage 1.

## Various improvement proposals

The industry has proposed and implemented various approaches to this problem.

### Meta-tool pattern: discover → execute

The most common approach is to put a "discovery layer" in front of existing MCP servers.

[Klavis Strata](https://www.klavis.ai/) ([YC X25](https://news.ycombinator.com/item?id=45347914)) is the most mature implementation, progressively exposing tools across four stages: `discover_server_categories` → `get_category_actions` → `get_action_details` → `execute_action`. They claim +13.4% pass@1 improvement over the official Notion MCP server.

[meta-mcp-proxy](https://github.com/nullplatform/meta-mcp-proxy) (nullplatform) compresses all MCP servers into two tools, `discover()` and `execute()`, using an in-memory local index to reduce 30 endpoints to 2 tools.

[lazy-mcp](https://github.com/voicetreelab/lazy-mcp) (voicetreelab) implements a similar hierarchical discovery pattern.

The effect is strong, but there's a common cost: the interface diverges from the original MCP server. Instead of `notion.create_page`, you get indirect execution like `execute_tool("notion.create_page", {...})`, and you need 3-4 round trips for discover → select → hydrate → execute.

### Protocol change proposals

[SEP-1576](https://github.com/modelcontextprotocol/modelcontextprotocol/issues/1576) (Huawei) proposes schema deduplication via JSON `$ref` and embedding similarity matching. They analyze that 60% of fields in the GitHub MCP server are duplicates.

[Issue #1978](https://github.com/modelcontextprotocol/modelcontextprotocol/issues/1978) proposes adding a `minimal` flag to `tools/list` and a new method `tools/get_schema` for on-demand retrieval, with an estimated 91% token reduction.

[Discussion #532](https://github.com/orgs/modelcontextprotocol/discussions/532) proposes hierarchical tool management (`tools/categories` + `tools/discover`).

All of these are pointing in the right direction, but none are in the MCP spec yet.

### The closest prior art: MCP Progressive Disclosure (hackathon implementation)

At the MCP 1st Birthday Hackathon (hosted by Anthropic + Gradio), Michael Martin (@AppRushAI) presented [mcp-extension-progressive-disclosure](https://huggingface.co/spaces/MCP-1st-Birthday/mcp-extension-progressive-disclosure/). Since this is the closest prior art to what this article proposes, let's look at it in detail.

The framing is the same: "descriptions mix decision and execution info, so let's separate them." The solution is also a two-stage lazy load, where Stage 1's `tools/list` returns a one-line description and an empty inputSchema.

```json
{
  "name": "aws_ec2_launch_instance",
  "description": "Launches a new AWS EC2 instance with specified configuration.",
  "inputSchema": {"type": "object", "properties": {}}
}
```

When the agent wants to use a tool, Stage 2 fetches the details from an MCP resource endpoint.

```
resource:///tool_descriptions?tools=aws_ec2_launch_instance
→ returns the full schema, usage, and error handling
→ fetched tools are marked as "session-authorized"
```

They claim 96% reduction and the effect is large, but making it work requires explicit system-prompt instructions to the agent: "before using any tool, always fetch the details from the resource."

In other words, this approach requires teaching the agent a new behavior pattern. The other major difference is how it handles inputSchema: the hackathon version empties the schema too and fetches it later, which gives a higher reduction rate, but also forces a resource-fetch step before every tool call.

Where you put the separated information is the fork in the road. The hackathon version put it in MCP resources. MCP Light, as we'll see, puts it in an Agent Skill.

### A common challenge

Many of these approaches require learning a new workflow or changing the client. The meta-tool pattern requires teaching the agent a new behavioral rule: "discover first." The hackathon version requires forcing "fetch the resource before use" in the system prompt. Protocol changes require waiting for spec finalization and every client to catch up.

## MCP Light: a drop-in solution that doesn't touch the spec

### The idea

Taking all of these approaches into account, here's what I thought.

What if we publish a "lightweight version" of the original MCP server as a separate package with the same interface, and ship the best practices we pulled out of the descriptions as an Agent Skill?

We don't change the MCP spec or any client. We don't force a new workflow like meta-tools. Tool names and inputSchemas stay the same. We just build and publish a "Light version of the same MCP server" with descriptions compressed to a single line. Best practices get offloaded into a Skill bundled alongside.

### Two parts

MCP Light has two components.

① Light MCP server: you can still use every feature of the original server. The only difference is that the `description` returned by `list_tools()` is compressed to a single line.

② Best-practices Skill: the best practices we pulled out of the original descriptions are bundled as a Skill (SKILL.md).

```
notion-light/
├── mcp/                              # Light MCP server
│   ├── server.py                     # wraps the original server with FastMCP
│   └── pyproject.toml
│
└── skill/
    └── notion-best-practices/        # best-practices Skill
        └── SKILL.md                  # per-tool usage guide
```

### Why this combination works

The Light version's description looks like this.

```
Create Notion pages in a database or standalone.
See notion-best-practices skill for usage details.
```

The moment Claude tries to use this tool, the [Skill system](https://platform.claude.com/docs/en/agents-and-tools/agent-skills/overview) automatically reads SKILL.md. Remember how Skills work: the Skill's metadata (name, description) is always in context, but the SKILL.md body is only loaded when the Skill is triggered.

In other words, Skills themselves already have Progressive Disclosure built in — "decision info always, execution info only when needed." MCP Light just borrows this. We don't need to build our own lazy-loading mechanism for the guide.

```
Always in context:
  - Light description (1 line)     ← for tool-selection decisions
  - Skill metadata                  ← to decide when to fire the Skill

Loaded when the tool is chosen:
  - SKILL.md body                   ← full best practices
```

### Differences from prior art

| Aspect | Meta-tool pattern | Hackathon version | Protocol changes | MCP Light |
| --- | --- | --- | --- | --- |
| Client changes | No, but workflow changes required | MCP resource support + system prompt changes | Waiting on spec + every client | Zero |
| Tool invocation | `execute_tool("name", {...})` | Direct call, but requires prior resource fetch | Depends on spec | Same as original server |
| inputSchema | As-is | Empty, fetched later | Depends on spec | As-is |
| Round trips | 3-4 | 2 (resource fetch → execute) | Depends on spec | Direct call |
| Where best practices live | Inside meta-tool | MCP resource endpoint | `tools/get_schema` etc. | Agent Skill |
| Agent instructions | "Discover first" | "Fetch resource before use" | Depends on spec | None (Skill auto-fires) |
| Distribution | Often platform-bound | Modifies the server itself | N/A | npm / PyPI package |
| forkability | Hard | Requires server changes | N/A | Fork a Markdown file |
| Migration cost | Learn new workflow | Change system prompt | Wait for spec | Just swap in for the original server |

### Inside the Light MCP server

With [FastMCP](https://github.com/jlowin/fastmcp), the core is only a few dozen lines.

```python
from fastmcp import FastMCP
from fastmcp.server.proxy import ProxyClient

LIGHT_DESCRIPTIONS = {
    "notion-search": (
        "Search Notion workspace and connected sources by semantic query. "
        "See notion-best-practices skill for usage details."
    ),
    "notion-fetch": (
        "Retrieve a Notion page or database by URL or ID. "
        "See notion-best-practices skill for usage details."
    ),
    "notion-create-pages": (
        "Create one or more Notion pages in a database or standalone. "
        "See notion-best-practices skill for usage details."
    ),
    # ...all 13 tools
}

proxy_client = ProxyClient("npx @notionhq/notion-mcp-server")
server = FastMCP.as_proxy(proxy_client, name="notion-light")

for tool in server.list_tools():
    if tool.name in LIGHT_DESCRIPTIONS:
        tool.description = LIGHT_DESCRIPTIONS[tool.name]
```

FastMCP's `as_proxy` wraps the original server wholesale and we just swap out the `description`. inputSchemas and the actual tool execution logic come from the original server unchanged. From the user's perspective, it's a standalone package.

```bash
# Install the Light MCP server
claude mcp add notion-light -- npx notion-light-mcp

# The best-practices Skill is bundled
```

### Compression process: the LLM thinks

Description compression is done by an LLM (Claude), not by a heuristic script. Separating "decision info" and "runtime best practices" requires understanding of meaning.

This compression process itself is also defined as a Skill (mcp-light-generator).

```
mcp-light-generator/
├── SKILL.md              # separation rules and workflow
└── references/
    └── fastmcp-proxy-pattern.md  # FastMCP proxy implementation pattern
```

Say "make a Light version of Notion MCP" and Claude will analyze every tool's description and generate both the Light MCP server and the best-practices Skill.

## Let's try it: Notion MCP server (13 tools)

Here are the results of applying MCP Light to all 13 tools of the official Notion MCP server.

### A concrete compression example

Before (original description, always loaded):

> Creates one or more Notion pages, with the specified properties and content. All pages created with a single call to this tool will have the same parent. The parent can be a Notion page ("page_id") or data source ("data_source_id"). If the parent is omitted, the pages are created as standalone, workspace-level private pages. If you have a database URL, ALWAYS pass it to the "fetch" tool first... (dozens of lines follow)

After (Light version description, always loaded):

> Create one or more Notion pages in a database or standalone. See notion-best-practices skill for usage details.

Best-practices Skill (loaded when the tool is used):

```markdown
## notion-create-pages

Create one or more pages in a single call.

### Choosing the Parent
1. **page_id**: create under a regular page
2. **data_source_id**: create under a data source (collection) (recommended)
3. **database_id**: only valid for single-data-source databases
4. **omitted**: create as a workspace-level private page

### Best Practices
- If you have a database URL, always `fetch` first to get the schema and data source URL
- You can't use `database_id` on multi-data-source databases — use `data_source_id`
...
```

We didn't throw any information away. We only changed when it gets loaded.

### Precise measurement with tiktoken

I started both the original server and the Light version as standalone FastMCP servers and measured the `tools/list` response with tiktoken (cl100k_base).

| Metric | Original | Light | Reduction |
| --- | --- | --- | --- |
| Total description | 1,725 tokens | 285 tokens | 83.5% |
| Total inputSchema | Unchanged | Unchanged | - |
| Entire tool definitions | 3,410 tokens | 1,908 tokens | 44.0% |
| JSON bytes | 18,367 bytes | 11,565 bytes | 37.0% |

Looking at descriptions alone, it's an 83.5% reduction. inputSchema is untouched, so that part doesn't move. For the whole tool definition, it's a 44.0% reduction. That's a 1,502-token savings per session.

The key point is that keeping inputSchema is an intentional design decision. If we emptied the schema like the hackathon version, the reduction would be higher, but every tool call would require an extra resource-fetch round trip. MCP Light compresses only descriptions and leaves inputSchema intact, preserving the "call tools immediately" experience.

## Measuring the effect: opencode in practice

The tiktoken numbers are theoretical. To see how it plays out in a real coding agent, I measured it using [opencode](https://github.com/nicholasgriffintn/opencode), an OSS coding agent. opencode doesn't have lazy-loading features like Tool Search, so all descriptions from connected tools land directly in the context. That makes it an ideal environment for measuring MCP Light's direct effect.

### Test setup

The same 13 tools (Notion MCP), connected to opencode with both the original server and the Light version. Same prompt ("hello") sent, and I compared context consumption at the first response.

### Results

| Metric | Original | Light | Delta |
| --- | --- | --- | --- |
| Context tokens | 16,796 | 15,410 | -1,386 tokens |

The opencode environment showed a 1,386-token reduction, which roughly matches the tiktoken theoretical value (1,502-token reduction). The difference is probably due to opencode's prompt template and tokenizer.

This 1,386 tokens is the result for just one Notion MCP server. In real deployments with multiple connected MCP servers, the savings scale linearly.

## Synergy with Tool Search

The opencode measurement above was in a "no Tool Search" environment. What about environments that do have Tool Search, like Claude Code?

MCP Light and Tool Search are complementary. Tool Search narrows "which tools to load," and MCP Light slims down "the tool definitions themselves that get loaded."

Adding Skills on top makes progressive disclosure three-tiered.

```
Stage 1 (always):   Skill metadata + Light descriptions × all tools
  ↓ Tool Search narrows to the tools you need
Stage 2 (selected): Light descriptions of the tools you'll use (still 1 line)
  ↓ Decision to actually use a tool
Stage 3 (in use):   Skill fires, SKILL.md best practices are loaded
```

Each stage loads only what's needed at that point.

Here's a rough estimate for connecting 100 tools.

```
Tool Search alone:
  Initial load:   100 tools × ~130 tokens = ~13,000 tokens
  In use:         3 tools   × ~130 tokens = ~390 tokens

Tool Search + MCP Light:
  Initial load:   100 tools × ~22 tokens  = ~2,200 tokens
  In use:         3 tools   × ~22 tokens + Skill = ~66 + ~400 tokens
```

Just in the initial load, the gap is over 10,000 tokens.

## Division of labor with Skills

The "best-practices Skill" generated by MCP Light is a different thing from the existing "task Skills."

Best-practices Skill (from MCP Light): tool-specific knowledge. How to use an API, parameter constraints. The MCP server is the legitimate owner.

Task Skill (authored by users or teams): cross-task workflows. Things like "always draft an outline before creating a document."

Without MCP Light, Task Skill authors tended to also write MCP tool best practices into the Skill, causing duplication. MCP Light resolves this duplication under the DRY principle.

## Best practices become forkable

The discussion so far has centered on token reduction, but MCP Light has a side effect that's often overlooked. Best practices land in the users' hands.

With the original MCP server, descriptions are hardcoded by the server author. Users can't touch them. Even if you thought "this instruction is wrong" or "in our environment you should use it this way," you had to either send a PR to the server itself or put up with it.

The moment you offload to a Skill, best practices become a plain Markdown file.

- You can add team-specific conventions: "Our Notion uses this DB structure, so use this `data_source_id`"
- You can fix mistakes yourself: no need to wait for the server author
- You can maintain multiple variants: use different best practices per team or per project
- You can iterate with the community via GitHub: fork, PR, issue. Collective wisdom can polish best practices

In the MCP Light package layout, the Light MCP server (description compression) essentially doesn't need to be forked, but `skill/notion-best-practices/SKILL.md` is explicitly designed to be forked.

The original MCP server's descriptions were "the one correct answer the author decided on." Once they're a Skill, they become a "starting point."

## A proposal for the protocol

MCP Light is a "use-it-today" prescription. Fundamentally, I think progressive disclosure should land in the MCP spec itself.

```
Ideal MCP spec:
  list_tools(detail: "summary")  → name + 1-line summary only
  get_tool(name)                 → full definition of one tool
  list_tools(detail: "full")     → the current full definition (backward compatible)
```

Related proposals exist, such as [SEP-1576](https://github.com/modelcontextprotocol/modelcontextprotocol/issues/1576) (schema deduplication), [Issue #1978](https://github.com/modelcontextprotocol/modelcontextprotocol/issues/1978) (Lazy Tool Hydration), and [SEP-1382](https://github.com/modelcontextprotocol/modelcontextprotocol/issues/1382) (description authoring guidelines), but per-tool progressive disclosure hasn't been accepted. The Light MCP server is a bridge until the protocol catches up.

## Wrap-up

- MCP descriptions mix "decision info" and "execution info," and just connecting eats up context. MCP Light compresses descriptions to a single line and auto-loads best practices from an Agent Skill only when needed
- With the Notion MCP (13 tools) I confirmed an 83.5% reduction in descriptions and a 44.0% reduction across the entire tool definitions (a 1,502-token savings). An opencode measurement showed a 1,386-token reduction in practice
- No spec changes, no client changes. Swap in for the original server, and since best practices are Markdown you're free to fork and customize them

## References

- MCP
    - [Model Context Protocol](https://modelcontextprotocol.io/)
    - [MCP joins the Agentic AI Foundation](http://blog.modelcontextprotocol.io/posts/2025-12-09-mcp-joins-agentic-ai-foundation/)
    - [SEP-1576: Mitigating Token Bloat in MCP](https://github.com/modelcontextprotocol/modelcontextprotocol/issues/1576)
    - [Issue #1978: Lazy Tool Hydration for Large Tool Sets](https://github.com/modelcontextprotocol/modelcontextprotocol/issues/1978)
    - [Discussion #532: Hierarchical Tool Management](https://github.com/orgs/modelcontextprotocol/discussions/532)
    - [SEP-1382: Documentation Best Practices for MCP Tools](https://github.com/modelcontextprotocol/modelcontextprotocol/issues/1382)
- Context Window Problem
    - [MCP and Context Windows: Lessons Learned During Development — Pablo Castillo](https://medium.com/@pekastel/mcp-and-context-windows-lessons-learned-during-development-590e0b047916)
    - [The Evolution of AI Tool Use: MCP Went Sideways — Waleed Kadous](https://waleedk.medium.com/the-evolution-of-ai-tool-use-mcp-went-sideways-8ef4b1268126)
- Improvement approaches
    - [Klavis Strata](https://www.klavis.ai/)
    - [meta-mcp-proxy — nullplatform](https://github.com/nullplatform/meta-mcp-proxy)
    - [lazy-mcp — voicetreelab](https://github.com/voicetreelab/lazy-mcp)
    - [mcp-extension-progressive-disclosure — Michael Martin](https://huggingface.co/spaces/MCP-1st-Birthday/mcp-extension-progressive-disclosure/)
- Tools
    - [FastMCP](https://github.com/jlowin/fastmcp)
    - [Agent Skills — Anthropic](https://platform.claude.com/docs/en/agents-and-tools/agent-skills/overview)
    - [Anthropic Skills Repository](https://github.com/anthropics/skills)
