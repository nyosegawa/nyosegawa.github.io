---
title: "I Built a Mechanism to Grow AGENTS.md Automatically"
description: "A shell wrapper that makes AGENTS.md sprout automatically when you clone a new repo, then grows alongside the project."
date: 2026-02-15
tags: [Git, AGENTS.md, Claude Code, Coding Agent]
author: 逆瀬川ちゃん
lang: en
---

Hi there! This is Sakasegawa ([@gyakuse](https://x.com/gyakuse))!

Today I want to talk about "I want AGENTS.md to grow on its own." The thing I built is public as [agents-md-generator](https://github.com/nyosegawa/agents-md-generator).

<!--more-->

## Thinking about CLAUDE.md every time hurts

If you use Coding Agents daily, every new repo gives you the same headache: CLAUDE.md (or AGENTS.md).

First, figuring out what to write every time is tiring. What's the build command? How do you run the tests? What are the code conventions? Trying to think this through before any code exists is a fruitless exercise. But leaving it empty means the Coding Agent gropes around blindly, which is inefficient.

There's a deeper problem too. CLAUDE.md starts decaying the moment you write it. As the project evolves, commands change and architecture changes. Humans forget to update CLAUDE.md. Stale instructions poison the agent's context, and you end up in a state where not writing it would have been better.

The ideal is an AGENTS.md that grows on its own once you've planted the seed. Just scaffolding in the early days, then naturally filling out as the code grows.

## What AGENTS.md should be

For context, [AGENTS.md](https://agents.md/) is a configuration file aimed at AI coding agents. It's used in more than 60,000 repos on GitHub and is supported by most major Coding Agents — OpenAI Codex, Google Jules, Cursor, Zed, GitHub Copilot, Gemini CLI, and so on. It's become the de facto standard format, managed by the Linux Foundation-affiliated [Agentic AI Foundation](https://openai.com/index/agentic-ai-foundation/). Claude Code reads CLAUDE.md, but if you symlink AGENTS.md to it, one file covers every tool.

Now, the real question: what should you write in AGENTS.md? This is the important part.

### The fewer instructions, the better

There's a hard cap on how many instructions an LLM can reliably follow. Frontier models sit around 150-200, and the Coding Agent's system prompt already consumes most of those. Whatever you put in AGENTS.md is competing for what's left.

And instruction bloat degrades uniformly. It's not that specific instructions get ignored — overall instruction-following drops. Anthropic's [Claude Code Best Practices](https://code.claude.com/docs/en/best-practices) explicitly warns "if CLAUDE.md gets too long, Claude will ignore half of it," and the [HumanLayer guide](https://www.humanlayer.dev/blog/writing-a-good-claude-md) similarly says "use as few instructions as possible."

So "what not to write" is more important than "what to write." The budget rule of thumb for AGENTS.md is 20-30 lines.

### What to include, what to skip

| Include | Skip |
|---|---|
| Project-specific judgments the agent can't infer from code | Code style rules (leave to the linter) |
| Non-obvious build / test commands | Directory structure descriptions (go stale fast) |
| Critical gotchas and footguns | Generic programming advice |
| Domain-specific terminology | Catch-all sections like "Important Context" |

Catch-all sections are especially dangerous. A section called "Important Context" becomes a trash heap and eats your whole budget in no time.

### A living document, not a config file

This is the most overlooked part. AGENTS.md is not a "write once, done" config file like `.gitignore`. It's a living document that changes with the project.

- Update immediately when a command changes.
- Rewrite the whole thing when architecture changes significantly.
- Delete anything the agent can now infer from the code.

Leaving stale instructions is pure harm. A 6-month-old architecture description in CLAUDE.md means the agent looks in the wrong places and suggests patterns that no longer apply.

## Growing AGENTS.md automatically

Putting it all together, AGENTS.md needs three properties:

1. Minimum scaffolding when the project starts.
2. Structured with the instruction budget in mind.
3. Designed to be grown _and_ pruned.

To make that happen I built [agents-md-generator](https://github.com/nyosegawa/agents-md-generator). The moment you clone an empty repo, AGENTS.md (and a CLAUDE.md symlink) gets auto-generated.

The generated template bakes in a few design choices.

### Core Principles gets an explicit section

```markdown
## Core Principles

- **Do NOT maintain backward compatibility** unless explicitly requested. Break things boldly.
- **Keep this file under 20-30 lines of instructions.** Every line competes for the agent's limited context budget (~150-200 total).
```

"Throw away backward compatibility" and "20-30 line budget" are rules that hold regardless of project phase. Originally I had these as bold floating text without a heading, at the top of the file. But headless floating text is structurally ambiguous to the agent and caused it to hesitate about how to treat it. Now it's explicitly sectioned as `## Core Principles`.

### Placeholders exist to be filled and removed

Project Overview, Commands, Code Conventions, and Architecture are all placed as placeholders. You fill them in with specifics as you go — but crucially, once you fill a section, delete the placeholder comment. The placeholder itself consumes budget.

### Maintenance Notes never get deleted — and we say so explicitly

The one section the template explicitly marks as "don't delete" is Maintenance Notes.

```markdown
## Maintenance Notes

<!-- This section is permanent. Do not delete. -->

**Keep this file lean and current:**

1. **Remove placeholder sections** (sections still containing `[To be determined]` or `[Add your ... here]`) once you fill them in
2. **Review regularly** - stale instructions poison the agent's context
3. **CRITICAL: Keep total under 20-30 lines** - move detailed docs to separate files and reference them
4. **Update commands immediately** when workflows change
5. **Rewrite Architecture section** when major architectural changes occur
6. **Delete anything the agent can infer** from your code
```

This is a reminder to prevent AGENTS.md from being misread as a "config file" and left alone. The important part is the HTML comment `<!-- This section is permanent. Do not delete. -->`. In practice, the agent would apply rules like "Remove placeholder sections" and "Delete anything the agent can infer" to the Maintenance Notes section itself, deleting the whole thing. The HTML comment guards it explicitly, and making "placeholder sections" concrete (sections containing `[To be determined]` or `[Add your ... here]`) prevents this self-referential deletion.

### Protect the file structure with an HTML comment

The template also includes one HTML comment at the very top of the file.

```markdown
# Agent Guidelines

<!-- Do not restructure or delete sections. Update individual values in-place when they change. -->
```

When you let the agent work on the project, it'll sometimes try to "improve" the structure of AGENTS.md itself, which can trigger a major rewrite. Each section has inline HTML comments with update rules, but if the agent rewrites the whole structure, those inline comments go with it. The top-of-file comment is the outer wall that lets the per-section protections actually do their job.

## Implementation: shell wrapper that auto-generates on clone

(Previously I implemented this with a git hook; I switched to a shell wrapper after realizing `post-checkout` doesn't fire when cloning an empty repo — a git specification I'd missed.)

The implementation is simple: define shell wrapper functions for `git()` and `ghq()` that generate AGENTS.md after a clone/get completes.

You source the script from `.bashrc` or `.zshrc`, and that overrides `git` and `ghq` with thin wrapper functions. Internally they call the real command via `command git` / `command ghq`, and after a successful clone the wrapper locates the target directory and runs logic that says "if the repo is empty, generate AGENTS.md." ghq is a Go binary so its internal git calls don't go through the shell function, but the `ghq()` wrapper runs the seed step after ghq itself finishes, so that's fine.

```bash
# Setup (if you use ghq)
ghq get nyosegawa/agents-md-generator

# Add to .zshrc / .bashrc
source "$(ghq root)/github.com/nyosegawa/agents-md-generator/agents-md-seed.sh"
```

From then on, cloning an empty repo auto-generates AGENTS.md and CLAUDE.md (a symlink). Works with ghq too.

```bash
# Normal clone
git clone git@github.com:yourname/new-repo.git
# → AGENTS.md and CLAUDE.md appear

# Same with ghq
ghq get yourname/new-repo
# → same
```

Initially I implemented this combining git's `post-checkout` hook with `init.templateDir`, but I discovered that cloning a repo with zero commits skips checkout entirely, so the hook doesn't fire. Git has no `post-clone` equivalent, so I switched to the shell wrapper approach.

The "empty" check is "fewer than 3 entries at the repo root (excluding `.git`)," so it still generates for a repo that has just a README and LICENSE. For repos with existing code or an existing AGENTS.md, it does nothing. If you want to customize the template, drop a file at `~/.config/agents-md/template.md` or set the `AGENTS_MD_TEMPLATE` environment variable.

## Summary

- AGENTS.md is a living document, not a config file. Stick to a 20-30 line budget, and treat it as something to grow and prune.
- With [agents-md-generator](https://github.com/nyosegawa/agents-md-generator), scaffolding for that growth gets generated the moment you clone.
- Implementation is a shell wrapper around git. One `source` line in `.bashrc` / `.zshrc` and you're done.

## References

- [@kenn - tweet on backward compatibility](https://x.com/kenn/status/2022862500958765227)
- [agents-md-generator (GitHub)](https://github.com/nyosegawa/agents-md-generator)
- [AGENTS.md official site](https://agents.md/)
- [AGENTS.md GitHub repository](https://github.com/agentsmd/agents.md)
- [AGENTS.md Emerges as Open Standard for AI Coding Agents (InfoQ)](https://www.infoq.com/news/2025/08/agents-md/)
- [Best Practices for Claude Code](https://code.claude.com/docs/en/best-practices)
- [Writing a good CLAUDE.md (HumanLayer)](https://www.humanlayer.dev/blog/writing-a-good-claude-md)
- [agents-md-seed.sh (GitHub)](https://github.com/nyosegawa/agents-md-generator/blob/main/agents-md-seed.sh)
