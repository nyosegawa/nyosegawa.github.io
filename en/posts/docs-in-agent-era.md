---
title: "What I've Been Thinking About Documentation in the Coding Agent Era"
description: "Code has feedback loops, but documentation doesn't. While developing alongside Coding Agents, I've been thinking about how we might reorganize documentation. Here's what I'm trying."
date: 2026-03-17
tags: [AI, Claude Code, Documentation, ADR, Agentic Engineering]
author: 逆瀬川ちゃん
lang: en
---

Hi there! This is Sakasegawa-chan ([@gyakuse](https://x.com/gyakuse))!

Today I want to write about what I've been thinking about documentation in the Coding Agent era. I'm still working through it, so the content is a bit rough around the edges. Bear with me. The right answer differs depending on code size, team size, and so on. Please read this as just one example of my own practice.

<!--more-->

I touched on CLAUDE.md, AGENTS.md, and ADR practices a bit in my earlier posts [Development workflow in the Coding Agent era](/posts/coding-agent-workflow-2026/) and [Claude Code system prompt explainer](https://zenn.dev/sakasegawa/articles/af8ede2e4d7da4), but I'd been wanting to dig into the more fundamental questions: what are docs for in the first place, and what should the docs an Agent reads look like? I don't have fully settled conclusions yet, but let me try to organize what's come into view from recent practice.

## What is documentation actually for?

Before jumping into taxonomies, let me revisit what documentation is for. In software development, documentation has served as a Single Source of Truth so that all the stakeholders can face the same direction. Requirements specs, functional specs, API specs, architecture documents, runbooks. The names and granularity vary per organization and project, but ultimately what documentation does is describe and share correctness-at-a-point-in-time in natural language.

Concretely, docs align the mental model across stakeholders, serve as a baseline for detecting drift from the implementation, and provide a reference for correct behavior. Defining requirements, keeping the trail of decisions, recording external constraints, and onboarding new members — these are all variations on those roles.

But regardless of the role, docs can't keep functioning unless the docs themselves stay accurate. If the baseline has rotted, you can't use it as a baseline. If your reference for correct behavior is wrong, it isn't a reference. So why is documentation prone to rot?

## Why documentation rots easily

Think about code. Code has mechanical feedback loops against rot. When you change it, the compiler complains, tests break, the linter fires, and CI/CD runs. The loop is closed.

Documentation written in natural language has no such mechanism. A spec document is fundamentally a natural-language guarantee of correctness at a particular point in time, and it happens all the time during development that trade-offs cause the spec and the implementation to land in different places. Code has type systems and dependency graphs and other structure, so you can mechanically identify the blast radius of a change. Natural-language docs are context-dependent, and accurately judging which other statements are affected by changing one is extremely hard.

This asymmetry has existed forever, but it feels like the arrival of Coding Agents has made it more visible. The Agent reads docs as Context and acts based on their contents. Rotten documentation doesn't give you an error the way rotten code does. It dies silently and just makes the Agent act worse.

Given this, let me think about what kind of documentation a Coding Agent actually needs.

## What kind of documentation does the Agent want?

Documentation that's easy for an Agent to handle, I feel, has one of two properties: it's deterministically verifiable, or it's immutable. If it's verifiable, you can close the feedback loop. If it's immutable, it can't rot in the first place. On the flip side, anything derivable from code didn't need to be written at all, so what remains as natural-language documentation is only the things that have neither property.

From this angle, existing documentation can probably be reorganized into these four buckets.

| Category | Property | Examples | Treatment |
|------|------|------|------|
| Derivable | Reconstructable from code or tests | API specs, list of type definitions, dependency graphs | Don't write |
| Verifiable | Mechanically decidable as true/false | "response within 200ms", "this field is required" | Move to tests/Linter |
| Immutable records | A decision at a point in time and its rationale | ADRs, postmortems | Keep append-only |
| Irreducible | Can't be reduced to code or tests | External constraints, regulations, the "why" context, organizational judgment | Keep as natural-language docs |

For derivable things, the Agent can walk the code directly, so I don't feel they need to be duplicated in docs. For example, people often write about directory structure, but [research by ETH Zurich and LogicStar.ai](https://arxiv.org/abs/2602.11988v1) found that writing a directory structure overview into CLAUDE.md didn't improve the Agent's file discovery speed.

Verifiable constraints can be moved to tests or the Linter. A "response time within 200ms" written only in the docs, with nothing mechanically checking it, becomes a dead letter. The moment you move it into a test, the feedback loop closes.

Immutable records work well in the [ADR (Architecture Decision Records)](https://adr.github.io/) format. You record a decision at a point in time and don't rewrite it; you supersede it instead. An Agent can mechanically apply the rule "if status is superseded, follow the successor ADR."

And then there's the irreducible knowledge: things that can't be put into tests or the Linter and can't be read off the code. Why (why this choice was made), Why not (why the alternatives were rejected), external constraints (regulations, SLAs), boundaries of intent (this behavior is spec, not a bug, etc.). Especially if Why not is missing, the Agent can regress to a previously-rejected design thinking it's an improvement.

## How to supply the documentation the Agent wants

Now that what to write is narrowed down, the question is where to put it. From the Coding Agent's point of view, a two-layer structure emerges naturally.

### Layer 1: CLAUDE.md / AGENTS.md (always injected)

AGENTS.md in Codex and CLAUDE.md in Claude Code are automatically injected into Context at session start. This functions as the Agent's working memory. Because they're always injected, they consume Context window unconditionally, so you need to keep them as short as possible. The things that belong here are:

- Prohibitions and guardrails
- A summary of the currently active architecture decisions
- Build / test / lint commands

The article [You Don't Need a CLAUDE.md](https://dev.to/byme8/you-dont-need-a-claudemd-jgf) recommends having CLAUDE.md function as an entry point of about 30 lines, with the details distributed under `docs/`. That makes sense from a Context efficiency standpoint. In my own projects I give myself a bit more slack and cap it at 60 lines, but the direction of "shorter is better" is the same.

### Layer 2: docs / docs/adr/ (on-demand reference)

ADRs and documentation groups are long-term memory that the Agent pulls in as needed. You can run an operational cycle where, once `docs` gets bloated, you evaluate ROI and migrate things to `docs/adr`.

The Agent can find the docs it needs via Explore SubAgent or file search, so there's no need to cram everything into CLAUDE.md. Read only what you need, when you need it. This kind of structure seems best for Context efficiency.

## Managing and operating documentation

So far we've talked about what to write and where to put it. How do you keep what you write from rotting? What I'm trying right now is to put a harness on documentation the same way you do on code, to close the feedback loop (imperfectly).

### A harness for documentation

I've built a script called `check-doc-freshness.sh` and have been running it on my projects (I'm actually testing it together with a set of hooks in the [test-docs](https://github.com/nyosegawa/test-docs) repo). It runs the following checks.

1. Line count limit on CLAUDE.md / AGENTS.md (error at 60+ lines, for Context efficiency)
2. Detect broken path references inside CLAUDE.md / AGENTS.md
3. last-validated date check on files under `docs/` and `docs/adr/` (WARNING/ERROR past a threshold)
4. Check whether CLAUDE.md / AGENTS.md references a superseded ADR

Files under `docs/` get a `last-validated` front matter field.

```yaml
---
last-validated: 2026-03-15
phase: current
---
```

Docs with `phase: current` WARN at 3 days and ERROR at 5 days. Docs with `phase: target` (docs that describe a future target state) WARN at 10 days and ERROR at 15 days.

If you bind this script to `git commit` as a Claude Code PreToolUse hook, you can block commits while the documentation is in a rotten state.

```json
{
  "hooks": {
    "PreToolUse": [
      {
        "matcher": "Bash",
        "hooks": [
          {
            "type": "command",
            "command": "bash .claude/hooks/pre-commit-guard.sh"
          }
        ]
      }
    ]
  }
}
```

The matcher is a regex against the tool name (`tool_name`), so we specify `"Bash"`. Whether it's a `git commit` is judged inside the hook script. When you want to block, you need to exit 2 and write to stderr (not stdout — Claude Code uses stderr as feedback to the agent when exit code is 2).

```bash
#!/usr/bin/env bash
input="$(cat)"
command="$(jq -r '.tool_input.command // empty' <<< "$input")"

case "$command" in
  git\ commit*) ;;
  *) exit 0 ;;
esac

if echo "$command" | grep -q -- "--no-verify"; then
  echo "BLOCKED: --no-verify is prohibited" >&2
  exit 2
fi

output=$(bash scripts/check-doc-freshness.sh 2>&1)
if [ $? -ne 0 ]; then
  echo "Doc freshness check failed: $output" >&2
  exit 2
fi
```

Placing it at the same position as a pre-commit hook for code, you get a pseudo-feedback loop where you can't commit once the docs have gotten stale. Prohibiting `--no-verify` at the same spot prevents the Agent from routing around this loop.

That said, this only warns about the possibility of rot based on elapsed time. It can't actually judge whether the docs have rotted (i.e. whether they're making the Agent act worse).

### Periodic audit: docs-auditor

To evaluate whether documentation is actually improving the Agent's behavior, you need to analyze session transcripts (session logs). Using the same approach as [skill-auditor](/posts/skill-auditor/) that I made earlier, I built a documentation counterpart called [docs-auditor](https://github.com/nyosegawa/skills/tree/main/skills/docs-auditor).

docs-auditor does the following.

- Walks session transcripts and detects when each document was read
- Evaluates how the Agent's behavior changed after the read (beneficial / neutral / harmful / unnecessary)
- Since CLAUDE.md / AGENTS.md are always injected, analyze compliance rate per directive instead
- Compute per-doc ROI (behavior improvement / Context occupancy)
- Detect documents that were never referenced

For each document, you get metrics like:

| Metric | Meaning |
|------|------|
| Reference frequency | How often the doc is actually read by the Agent |
| impact_score | (beneficial - harmful) / total_reads |
| content_tokens | Tokens occupied in the Context window |
| ROI | impact_score / (content_tokens / 1000) |

With this, you can distinguish between docs that are read but don't change behavior (the Agent could derive the same info from code) and docs that are neither read nor changing behavior (completely unnecessary).

So operationally, it's a two-tier setup.

1. check-doc-freshness.sh (lightweight, high frequency): a cheap heuristic that warns purely on elapsed time. Runs on every commit via a PreToolUse hook.
2. docs-auditor (heavy, low frequency): evaluates actual behavior improvement and proposes updates or deprecation. Runs periodically.

Right now `last-validated` is updated manually, but ideally it should be updated based on audit results. The healthiest flow would be: `last-validated` gets updated the moment docs-auditor judges that "this document is still working effectively."

## What about documentation for humans?

We've been talking about documentation the Agent reads, but what about human-targeted documentation (onboarding guides, runbooks, user manuals, etc.)?

One idea I'm toying with is to move human-facing docs outside the area the repo can walk. Confluence, Notion, or a separate repo — whatever works. By avoiding a mix with Agent-facing docs, each side can optimize for its own purpose.

There are problems, though. Without a mechanism to automatically update the external docs when the code changes, drift shows up anyway. A flow where a hook prompts you to update docs is conceivable, but doing code changes and documentation updates in parallel is still hard in practice. I'm still experimenting here.

## Summary

- The role of documentation (aligning stakeholders, detecting drift from implementation, being a reference for correct behavior) doesn't change in the Coding Agent era, but without a feedback loop it can't keep functioning
- What's easy for an Agent to deal with is deterministically verifiable or immutable documentation. I'm leaning toward not writing what's derivable from code, and moving verifiable constraints into tests / Linters
- Serve documentation in two layers — CLAUDE.md / AGENTS.md (working memory) and docs/adr/ (long-term memory) — and operate with a two-tier combo of check-doc-freshness.sh and docs-auditor
- I'm experimenting with moving human-facing docs out of the repo, but I'm still wrestling with parts of it

## References

- ADR
    - [Architecture Decision Records (ADR)](https://adr.github.io/)
    - [Master architecture decision records: Best practices for effective decision-making (AWS)](https://aws.amazon.com/blogs/architecture/master-architecture-decision-records-adrs-best-practices-for-effective-decision-making/)
- Documentation & Coding Agents
    - [Do AGENTS.md/CLAUDE.md Files Help Coding Agents? (ETH Zurich / LogicStar.ai)](https://todatabeyond.substack.com/p/do-agentsmdclaudemd-files-help-coding)
    - [You Don't Need a CLAUDE.md](https://dev.to/byme8/you-dont-need-a-claudemd-jgf)
    - [Shifting to Continuous Documentation (InfoQ)](https://www.infoq.com/articles/continuous-documentation/)
- 関連する自分の記事
    - [Coding Agent時代の開発ワークフローについてのまとめ](/posts/coding-agent-workflow-2026/)
    - [Claude Codeのシステムプロンプト解説](https://zenn.dev/sakasegawa/articles/af8ede2e4d7da4)
    - [skill-auditorを作った話](/posts/skill-auditor/)
- Claude Code Hooks
    - [Hooks Guide](https://code.claude.com/docs/hooks-guide)
    - [Hooks Reference](https://code.claude.com/docs/hooks)
- Implementation
    - [docs-auditor (GitHub)](https://github.com/nyosegawa/skills/tree/main/skills/docs-auditor)
    - [test-docs (GitHub)](https://github.com/nyosegawa/test-docs)
