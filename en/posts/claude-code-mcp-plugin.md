---
title: "Automating Project Management with Claude Code × MCP × Plugins"
description: "A hands-on story of consolidating project information scattered across Notion, Linear, and the codebase into Linear using Claude Code's MCP integration — and how I generalized the technique as a Claude Code Plugin."
date: 2026-02-12T14:00:00
tags: [Claude Code, MCP, Plugin, Linear, Notion]
author: 逆瀬川ちゃん
lang: en
---

Hi there! This is Sakasegawa ([@gyakuse](https://x.com/gyakuse))!

Today I want to share how I used Claude Code's MCP integration to consolidate project information scattered across Notion, Linear, and the codebase into Linear in a single pass. It worked out pretty well, so I went a step further and generalized the technique as a Claude Code Plugin and published it.

<!--more-->

## The problem: information scattered across three places

When you're running a development project, information tends to end up fragmented before you realize it.

- Notion: design docs, specs, TODOs, meeting notes
- Linear: task management as issues
- Git: implementation code

Each works fine on its own, but this is the situation that emerges.

- The spec written in Notion drifts from the implementation (written but not implemented, or implemented but not reflected in Notion)
- A Linear issue has no description, so you have to find the corresponding Notion page to know what the task is
- TODOs written in Notion were never turned into Linear issues
- Issues sit flat without any project grouping

In short, there's no single source of truth. Cleaning this up manually is way too tedious, and I figured MCP should be able to automate it, so I gave it a shot.

## Approach: operate Notion and Linear directly via MCP

Model Context Protocol (MCP) is an open protocol for letting LLMs access external tools and data sources. That's the definition, but practically what it gives you is: "I can operate both Notion and Linear directly from inside Claude Code."

Setup is two commands.

```bash
# Notion MCP (official hosted)
claude mcp add --transport http notion https://mcp.notion.com/mcp

# Linear MCP
claude mcp add --transport http linear https://mcp.linear.app/mcp
```

After adding, run `/mcp` in Claude Code and an OAuth flow will kick off — authorize each service and you're done.

Now all of this is possible from within a Claude Code session.

| Notion MCP | Linear MCP |
|---|---|
| Search and fetch pages | List, fetch, create, and update issues |
| Read page contents | Create and manage projects |
| Update pages | Create documents |
| Query databases | Manage labels and milestones |

With the tools in place, let's look at the actual steps I took.

## The procedure: Read → Analyze → Write

### Phase 1: Inventory the current state (Read)

The first thing to do is a full inventory of "what is where right now." The important part here is pulling from all three sources in parallel.

```
[Parallel execution]
├── Notion: fetch root page + all sub-page contents
├── Linear: fetch all issues + statuses + metadata
└── Codebase: explore tool definitions and main modules (Grep/Glob)
```

Claude Code can run these three simultaneously. Notion MCP's `notion-search` → `notion-fetch` for each page, Linear MCP's `list_issues` + `list_projects`, and Grep/Glob for core definitions in the codebase.

In this phase, don't write anything — read only. This matters, because once you start writing while still reading, if the plan shifts mid-way you end up with rework.

### Phase 2: Diff analysis and plan creation (Analyze)

Once the inventory is done, enumerate the diffs. Concretely, three kinds of diffs.

First, the spec-vs-implementation diff. Is a tool that Notion says "exists" actually implemented in code?

```
Tools listed in the Notion spec:
  tool_a  →  Implemented: Yes
  tool_b  →  Implemented: Yes
  tool_c  →  Implemented: No (not implemented, or merged into another tool)
  ---
Implemented in code but not in Notion:
  tool_d  →  Spec: No
```

Second, the diff between Notion TODOs and Linear issues. Things written in Notion that were never turned into Linear issues.

Third, information gaps in Linear issues. Issues that exist but have no description, so you can't tell what the task is.

Based on this analysis, you write a concrete execution plan: "create N projects, M documents, and K issues." Using Claude Code's plan mode is safer because writes don't run until you approve the plan.

### Phase 3: Consolidating into Linear (Write)

Once the plan is confirmed, execute. Four things to do.

First, create projects. Flat issues are hard to navigate, so create projects that group related issues together.

Next, create documents. Centralize the design information that was scattered across Notion into Linear Docs. This is quietly important — now the background and technical specs for issues can be referenced inside Linear. The key is that this isn't a Notion copy-paste: write content that's been reconciled against what's actually in the codebase.

Third, create missing issues. Turn the "in Notion but not in Linear" tasks from Phase 2 into issues.

Fourth, clean up existing issues. Add descriptions, link to projects, set parent/child relationships, and set priorities in a single pass.

Finally, add a link to the Linear project in the Notion TODO page so there's a signpost that says "task management is now in Linear."

I actually managed to consolidate 15 pages of Notion docs and TODOs plus 30 Linear issues into Linear as the single source of truth.

## I turned this technique into a Plugin

This Read → Analyze → Write three-phase flow is a generic pattern you can reuse across projects. Manually giving the same instructions every time is tedious, so I generalized it as a Claude Code Plugin.

### What is a Claude Code Plugin

Claude Code Plugins are a mechanism for bundling slash commands, sub-agents, MCP servers, and hooks into one package and distributing it. As of 2026 it's in Public Beta and available to all Claude Code users.

Plugin components in a table.

| Directory | Contents |
|---|---|
| `.claude-plugin/plugin.json` | Plugin metadata (name, description, version) |
| `commands/` | Slash commands (Markdown files) |
| `skills/` | Agent Skills (SKILL.md files) |
| `agents/` | Custom sub-agent definitions |
| `hooks/` | Event handlers |
| `.mcp.json` | MCP server configuration |

For personal customization you can just drop files into the `.claude/` directory. But turning it into a Plugin has three benefits.

- You can distribute it to your team or other users
- You can bundle MCP server configuration (this is huge)
- One-command install via `/plugin install`

### Structure of project-migrator

Here's the structure of the plugin I built.

```
project-migrator/
├── .claude-plugin/
│   └── plugin.json        # metadata
├── .mcp.json              # bundles Notion + Linear MCP
├── commands/
│   └── migrate.md         # /project-migrator:migrate command
└── skills/
    └── project-migration/
        ├── SKILL.md        # full migration workflow
        └── references/
            └── mcp-api-notes.md  # gotchas collected for MCP APIs
```

The core is two files: `.mcp.json` and `SKILL.md`.

By bundling Notion and Linear MCP servers into `.mcp.json`, installing the plugin automatically sets up connections to both services.

```json
{
  "mcpServers": {
    "notion": {
      "type": "http",
      "url": "https://mcp.notion.com/mcp"
    },
    "linear": {
      "type": "http",
      "url": "https://mcp.linear.app/mcp"
    }
  }
}
```

By writing the full migration workflow into `SKILL.md`, Claude Code can autonomously execute Phases 1-3. The only things a human has to do are pass the initial Notion URL and approve the Phase 2 plan.

Usage is just launching Claude Code from the project root and running:

```bash
/project-migrator:migrate https://www.notion.so/your-workspace/Your-Page-xxxxxxxxxxxx
```

## How to build and publish a Plugin

From here, let me walk through how to build a Claude Code Plugin, using project-migrator as the example.

### Step 1: Create the directory layout

```bash
mkdir -p project-migrator/.claude-plugin
mkdir -p project-migrator/commands
mkdir -p project-migrator/skills/project-migration/references
```

Careful: put `commands/` and `skills/` outside `.claude-plugin/`. Only `plugin.json` lives inside `.claude-plugin/`. Getting this wrong will silently break things.

### Step 2: Write plugin.json

```json
{
  "name": "project-migrator",
  "description": "Migrate scattered project information into a unified Linear workspace",
  "version": "1.0.0",
  "author": {
    "name": "nyosegawa"
  },
  "repository": "https://github.com/nyosegawa/project-migrator"
}
```

The `name` becomes the namespace for slash commands. With `project-migrator`, the command gets a prefix: `/project-migrator:migrate`.

### Step 3: Define the slash command

Create `commands/migrate.md`.

```markdown
---
description: Migrate project information from Notion to Linear
---

# Project Migration

Migrate the Notion page at the given URL into Linear,
using the current working directory as the codebase.

**Input:** $ARGUMENTS

Use the project-migration skill to execute the migration workflow.

- If `$ARGUMENTS` contains a Notion URL, use it as the migration source
- If `$ARGUMENTS` is empty, ask the user for the Notion page URL
- The current working directory is the codebase to reconcile against
```

`$ARGUMENTS` is the placeholder that captures the user's input. When you type `/project-migrator:migrate https://notion.so/...`, the URL goes into `$ARGUMENTS`.

### Step 4: Write SKILL.md

This is the largest chunk. It's the playbook Claude Code follows to autonomously execute the task.

In the frontmatter, write `name`, `description`, and info about the MCP servers used.

```yaml
---
name: project-migration
description: Migrate and reconcile scattered project information into a unified Linear workspace.
compatibility: Requires Notion MCP and Linear MCP servers connected.
metadata:
  mcp-server: notion, linear
---
```

In the body, write the concrete Phase 1-3 steps, the MCP tool names and parameters to use, formatting gotchas, and troubleshooting. The difference between Skill and Command is this: a Command is something the user explicitly invokes as a slash command; a Skill is something Claude Code uses autonomously based on context. Here, a Command calls a Skill.

### Step 5: Bundle MCP servers

Put `.mcp.json` at the plugin root and its MCP server configuration is auto-registered on install. This is a huge benefit of Plugins — users don't need to run `claude mcp add` manually.

### Step 6: Local testing

```bash
claude --plugin-dir ./project-migrator
```

This starts Claude Code with the plugin loaded. Confirm that `/project-migrator:migrate` works. To test multiple plugins at once, pass `--plugin-dir` multiple times.

### Step 7: Publish

The standard pattern is to publish a plugin as a GitHub repository. One plugin = one repo.

```bash
gh repo create project-migrator --public
git init && git add -A && git commit -m "initial commit"
git remote add origin git@github.com:yourname/project-migrator.git
git push -u origin main
```

Others can then install with:

```bash
# Via a marketplace
/plugin install project-migrator@your-marketplace

# Or point at the repo directly (TODO: confirm official support)
claude --plugin-dir /path/to/project-migrator
```

If you operate a marketplace, put a `.claude-plugin/marketplace.json` in a separate repo referencing each plugin.

```json
{
  "name": "my-marketplace",
  "plugins": [{
    "name": "project-migrator",
    "source": { "source": "github", "repo": "yourname/project-migrator" },
    "version": "1.0.0"
  }]
}
```

## MCP API Gotchas

Here are the landmines I stepped on during the actual migration, and how to work around them.

### Linear: the literal \n problem

This was the trickiest. When you pass a description to Linear MCP's `create_issue` or `update_issue`, if the string contains a literal `\n`, it's displayed as the text `\n` rather than an actual newline.

```
Bad:  description: "## Overview\nThis issue..."  → renders literally as "## Overview\nThis issue..."
Good: description contains actual newline characters → renders correctly as Markdown
```

When you have Claude Code write descriptions, you have to explicitly tell it "use real newline characters, not literal `\n`." I also put a bolded warning about this in SKILL.md.

### Linear: what Markdown is supported

Linear supports a pretty rich Markdown set, but a few things aren't supported. Here's what I verified by actually creating issues.

| Element | Supported |
|---|---|
| Headings, bold, italic, strikethrough | Yes |
| Code blocks (with syntax highlighting) | Yes |
| Tables, lists, checklists | Yes |
| Mermaid diagrams | Yes |
| Collapsible sections (`>>>` syntax) | Yes |
| LaTeX / math | No |
| HTML tags | No |

Collapsible sections use Linear's own `>>>` syntax, not HTML `<details>/<summary>`. If you need math, either use a code block in plain text, or use an image.

### Linear: no batch API

Issue updates go one at a time. To link 30 issues to a project, you make 30 API calls. The workaround is to use Claude Code's parallel tool-call feature to fire independent updates simultaneously. Say "set the same projectId on these 10 issues" and it handles them in parallel.

### Linear: SSE → HTTP migration

As of February 2026, Linear MCP's SSE transport was deprecated. You need to change the endpoint from `https://mcp.linear.app/sse` to `https://mcp.linear.app/mcp`.

### Notion: the match parameter trap

The `match` parameter of `notion-update-page` searches the page body text, not the page title. People often miss this and try to "match by page title," which fails. The fix is to fetch first, then match by heading text within the body.

### Notion: rate limits

The Notion API has a rate limit of around 3 requests/second. When you have 15 sub-pages and fetch them all at once, you can hit the limit.

## Tips for speeding this up

If you want to run this migration faster, here are the key points.

- Strictly separate the Read/Analyze/Write phases. Don't start writing while still reading
- Pull all Notion pages in one big batch at the start, then move to analysis
- Run independent updates in parallel (Claude Code can dispatch multiple tool calls at once)
- Learn the MCP API spec up front (format constraints, required fields, error messages). For the first try, verify with small test data
- Keep codebase analysis lightweight. The goal is to confirm spec vs. implementation, not a full code review

## Summary

- With Claude Code + Notion MCP + Linear MCP, you can almost fully automate the work of consolidating distributed project information into Linear
- Strictly separating Read → Analyze → Write is the key to speed
- Generalizing the technique as a Claude Code Plugin makes reuse easy via bundled MCP server configuration and slash commands
- MCP APIs have their own format quirks, so accumulating knowledge in SKILL.md's `references/` pays off later

## References

- Claude Code Plugin
    - https://code.claude.com/docs/en/plugins
    - https://claude.com/blog/claude-code-plugins
- MCP
    - https://modelcontextprotocol.io/specification/2025-11-25
    - https://code.claude.com/docs/en/mcp
- Notion MCP
    - https://developers.notion.com/docs/mcp
    - https://www.notion.com/blog/notions-hosted-mcp-server-an-inside-look
- Linear MCP
    - https://linear.app/docs/mcp
    - https://linear.app/changelog/2026-02-05-linear-mcp-for-product-management
- project-migrator (the plugin I built)
    - https://github.com/nyosegawa/project-migrator
