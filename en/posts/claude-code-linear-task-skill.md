---
title: "Automating Linear Task Management with a Claude Code Skill"
description: "Combining a Claude Code Skill with the Linear MCP to create an environment where you can CRUD tasks in natural language while coding. Here are the design and implementation gotchas."
date: 2026-02-12T18:00:00
tags: [Claude Code, MCP, Linear, Skills, Task Management]
author: 逆瀬川ちゃん
lang: en
---

Hi there! This is Sakasegawa ([@gyakuse](https://x.com/gyakuse))!

Today I want to talk about combining a Claude Code Skill with the Linear MCP to build an environment where the agent handles task management for you while you're coding.

<!--more-->

## Why let a Coding Agent do task management?

When you're working solo across multiple projects, task management is quietly annoying. Open Linear, pick a project, create an issue, change the status… Each individual action is small, but context-switching while you're writing code is painful.

So — let Claude Code do it.

Claude Code has [MCP (Model Context Protocol)](https://modelcontextprotocol.io), which lets you call external service APIs as tools. Linear has an MCP server, so Claude Code can operate on Linear issues directly. But MCP only provides tools (knives, pans). How to use them is something you have to instruct each time.

This is where [Skills](https://claude.com/blog/skills) come in. A Skill is like a recipe — you package the knowledge of "use this tool this way." MCP provides "what's possible," the Skill teaches "how to do it." The combo is powerful.

With that MCP + Skill relationship in mind, let's actually design a task management skill.

## Skill design

### Auto-detect the project from the working directory

This is the part I cared about most. Since I'm working across multiple projects, when I say "create a task" the skill should auto-detect which project it belongs to.

The approach is simple: embed a mapping table from working directory to Linear project directly in the skill.

```markdown
| Working directory | Project | Project UUID |
|---|---|---|
| `/path/to/project-a` | Project A | `uuid-aaa...` |
| `/path/to/project-b` | Project B | `uuid-bbb...` |
```

Claude Code has the working directory at startup, so matching against this table is enough.

But working directory alone doesn't always determine the project. For example, when I'm working in the skill repository itself, it's not obvious which project the conversation is about. So I also added context-based inference.

```markdown
| Keyword / context | Project |
|---|---|
| blog, article, SNS | Blog/SNS project |
| workflow efficiency, tooling | Optimizer project |
```

Pick up keywords from the conversation context and infer the project. If that still fails, ask the user. This 3-stage fallback works well.

### Hardcode fixed parameters

A key thing when building MCP integration skills: hardcode tested values right into the skill.

In my case my Linear workspace has only one team, so the team name is fixed. I've also verified status names with `list_issue_statuses` ahead of time and confirmed they can be passed as plain strings. Baking that in means no per-call API round-trips just to list teams.

```markdown
## Fixed parameters (tested)
- Team: `Sakasegawa` — always use this
- Status names: pass as strings directly (no UUID needed)
  - Backlog / Todo / In Progress / In Review / Done / Canceled
```

### Make rules explicit

The skill clearly spells out "what you may do" and "what you must not do."

- Always assign tasks to me.
- Never delete. Only complete.
- Organizing tasks (renaming titles, adding labels, etc.) is fair game.

"No deletion" is critical. I don't want the agent doing destructive operations, so I forbid it explicitly. Task organization, on the other hand, I want it doing freely. This granularity is one of the nice things about Skills.

## Linear MCP API gotchas

Once I actually built it, the Linear MCP had a few gotchas. These aren't things you'd catch just reading docs up front.

### Three identifiers: UUID, display key, slug

Linear has three kinds of identifier for the same resource.

| Kind | Example | Use |
|---|---|---|
| UUID | `a1b2c3d4-5678-90ab-cdef-1234567890ab` | Primary key for API operations |
| Display key | `ENG-123` | Human-readable ID |
| Slug | `my-project-a1b2c3d4` | Trailing URL segment |

And different MCP APIs accept different IDs.

- `get_issue`: works with either display key or UUID
- `update_issue`: sometimes errors unless you pass UUID
- `list_issues` project filter: safest to use Project UUID

I initially passed the slug (trailing URL segment) thinking it was the Project ID, but the slug is not the UUID. The correct move is to get the real UUIDs via `list_projects` and hardcode those into the skill.

### Literal `\n` doesn't work in description line breaks

When adding line breaks to an issue description, passing the string `\n` sometimes doesn't render as a line break on the Linear side. You need actual newline characters. Small thing, but easy to trip on.

### Collapsible blocks use Linear-proprietary syntax

HTML `<details>/<summary>` doesn't work. Linear uses its own `>>>` syntax for collapsible blocks. Easy to miss if you're used to Markdown.

I dumped all these findings into the skill's `references/` directory as notes. In the Progressive Disclosure style, SKILL.md holds the essentials and the details live in references.

## What it actually feels like

Once the skill is in place, task management looks like this.

While coding I can say "create a task for this bug fix," and it auto-detects the project from my working directory and creates an issue in Linear assigned to me. It'll also ask whether to move it to In Progress.

"Show me the current tasks" pulls up the project's issue list. "Mark SAK-42 done" moves it to Done.

The small delight is that it'll also reorganize tasks for me. Things like "make this issue's title clearer" or "bump the priority" — all in natural language.

Doing task management without context-switching is way more comfortable than I expected. [Murphy Randle's blog](https://mrmurphy.dev/freeing-up-flow-with-claude-code-linear-mcp/) makes the same point — "asking Claude Code is easier than writing issues by hand" is exactly right.

## Tips for building Skills

A few tips from this exercise.

- Test MCP APIs by hand before writing the skill. Gotchas aren't visible in the docs.
- Hardcode tested values (team name, status names, UUIDs) into the skill. Fetching them every time is waste.
- Forbid destructive operations explicitly. Bias agent instructions to the safe side.
- Accumulate findings in `references/`. It becomes an asset for the next iteration.
- Put trigger phrases in both Japanese and English in the description. It fires more reliably.

## Summary

- Combining a Claude Code Skill with the Linear MCP gets you natural-language task management while coding.
- The Linear MCP API has an ID system trap (UUID / display key / slug), so test up front and bake the findings into the skill.
- Auto-detecting project from working directory nearly eliminates context switches.

## References

- [Claude Code Skills](https://claude.com/blog/skills)
- [Skills explained: How Skills compares to prompts, Projects, MCP, and subagents](https://claude.com/blog/skills-explained)
- [Equipping Agents for the Real World with Agent Skills](https://www.anthropic.com/engineering/equipping-agents-for-the-real-world-with-agent-skills)
- [Linear MCP Server](https://linear.app/docs/mcp)
- [Linear Integration – Claude](https://linear.app/integrations/claude)
- [Freeing Up Flow With Claude Code & Linear MCP – Murphy Randle](https://mrmurphy.dev/freeing-up-flow-with-claude-code-linear-mcp/)
- [Claude CodeのSkillsを使うついでにMCP・スラッシュコマンド・サブエージェントとの違いを整理してみた](https://zenn.dev/karaage0703/articles/8c1e0434152f35)
- [Claude Code: 公式MCPを補完するSkills設計パターン](https://tech-lab.sios.jp/archives/50214)
