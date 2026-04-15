---
title: "GPT-5.4 Is Here: Enabling 1M Context in Codex and Comparisons with Other Models"
description: "An overview of GPT-5.4, reading the instructions evolution from Codex's models.json, how to enable the 1M context window, and benchmark and pricing comparisons with Claude and Gemini."
date: 2026-03-06
tags: [GPT-5.4, OpenAI, Codex, LLM]
author: 逆瀬川ちゃん
lang: en
---

Hi there! This is Sakasegawa-chan ([@gyakuse](https://x.com/gyakuse))!

Today I want to cover GPT-5.4, released earlier today by OpenAI: the instructions evolution readable from the Codex repo's source code, how to enable the 1M-context window, and benchmark comparisons with other models.

<!--more-->

## Overview of GPT-5.4

GPT-5.4 is OpenAI's latest frontier model, released on March 6, 2026 (JST). It's available on three platforms: ChatGPT (as GPT-5.4 Thinking), the API, and [Codex](https://github.com/openai/codex).

Positioning-wise, it takes GPT-5.3-Codex's coding capability as a base and significantly enhances knowledge work, computer use, and tool use into a unified model. The [official blog](https://openai.com/index/introducing-gpt-5-4/) introduces it as "our most capable and efficient frontier model for professional work."

Here's a quick rundown of the main new features.

- Computer use: the first general-purpose model with native computer-use capability. 75.0% on OSWorld-Verified (exceeding the human score of 72.4%)
- 1M context: experimental support for up to 1 million tokens of context in the API and Codex
- Tool search: a mechanism to use tools efficiently without loading large tool definitions into context. 47% token usage reduction on the MCP Atlas benchmark. That said, the approach itself was already introduced by Anthropic into the Claude API in November 2025 as the [`defer_loading` parameter and the tool search tool](https://www.anthropic.com/engineering/advanced-tool-use). It's also shipped in Claude Code as [MCP Tool Search](https://code.claude.com/docs/en/mcp), automatically enabled when MCP tool definitions exceed 10% of context. OpenAI caught up with GPT-5.4
- Token efficiency: reasoning tokens significantly reduced compared to GPT-5.2. Since o1, increasing inference-time compute to raise accuracy (test-time compute, [Snell et al., 2024](https://arxiv.org/abs/2408.03314)) has been the main lever for performance gains, but GPT-5.4 raises performance while reducing tokens
- /fast mode: up to 1.5x token speed in Codex. Same model, same intelligence, just faster

### Official OpenAI benchmark results

Here are the main benchmark results the [official blog](https://openai.com/index/introducing-gpt-5-4/) reports.

| Evaluation | GPT-5.4 | GPT-5.4 Pro | GPT-5.3-Codex | GPT-5.2 |
|---|---|---|---|---|
| GDPval (knowledge work) | 83.0% | 82.0% | 70.9% | 70.9% |
| SWE-Bench Pro | 57.7% | - | 56.8% | 55.6% |
| OSWorld-Verified (computer use) | 75.0% | - | 74.0% | 47.3% |
| Toolathlon (tool use) | 54.6% | - | 51.9% | 46.3% |
| BrowseComp (web search) | 82.7% | 89.3% | 77.3% | 65.8% |
| MMMU Pro (visual understanding) | 81.2% | - | - | 79.5% |
| ARC-AGI-2 (abstract reasoning) | 73.3% | 83.3% | - | 52.9% |
| GPQA Diamond | 92.8% | 94.4% | 92.6% | 92.4% |
| Humanity's Last Exam (with tools) | 52.1% | 58.7% | - | 45.5% |
| FrontierMath Tier 1-3 | 47.6% | 50.0% | - | 40.7% |

What really jumps out is OSWorld-Verified. It leaps from GPT-5.2's 47.3% to 75.0%, exceeding human performance (72.4%). Computer-use capability feels like it has arrived at a practical level in one step.

GDPval also jumps significantly from 70.9% to 83.0%. This evaluates whether a model can produce output at the quality of an industry professional on knowledge work across 44 professions (sales decks, accounting spreadsheets, legal analysis, etc.), which is a highly practical metric.

Hallucination reduction is another highlight: the probability that an individual claim is incorrect drops 33% vs. GPT-5.2, and the probability that a response contains any error drops 18%.

## Reading the instructions evolution from models.json

Beyond benchmark numbers, there's a different story to be told. Codex is open source, so reading the model definition file [codex-rs/core/models.json](https://github.com/openai/codex/blob/main/codex-rs/core/models.json) lets you see the design philosophy of the base_instructions (system prompt) passed to each model. I read this every model update, and it's incredibly interesting.

First let's look at the specific diff between GPT-5.4 and GPT-5.3-Codex, then use git log to analyze the change patterns across the entirety of models.json.

### Self-identifying as an "expert engineer"

GPT-5.4's General section adds an introduction that GPT-5.3-Codex doesn't have.

```
As an expert coding agent, your primary focus is writing code, answering questions,
and helping the user complete their task in the current environment. You build context
by examining the codebase first without making assumptions or jumping to conclusions.
You think through the nuances of the code you encounter, and embody the mentality
of a skilled senior software engineer.
```

5.3-Codex lacked this introduction and went straight into concrete rules. "Embody the mentality of a skilled senior software engineer" reads like role prompting. But if you read the whole paragraph, its actual substance is different.

- "Write code, answer questions, help complete the task" → explicit task scope
- "Examine the codebase first without assumptions or leaps" → behavioral constraint
- "Think through the nuances of code" → behavioral constraint
- "Embody the mentality of a skilled senior software engineer" → an anchor that pulls the above three together

In other words, this isn't role prompting that assigns a persona; it's a preamble of behavioral directives. In 5.3-Codex, the structure went straight into bullet-list rules. In 5.4, it starts with a prose preface that frames "what it is and how it should act." As [dbreunig (2026)](https://www.dbreunig.com/2026/02/10/system-prompts-define-the-agent-as-much-as-the-model.html) observes from analyzing the system prompts of six coding agents, the role of the system prompt is to correct biases in the model's training data and define boundaries of behavior. This paragraph plays that role.


### Forcing apply_patch

In GPT-5.3-Codex, the instruction was flexible: "try to use apply_patch for single file edits, but it is fine to explore other options." GPT-5.4 changes it to this.

```
- Always use apply_patch for manual code edits. Do not use cat or any other commands
  when creating or editing files.
```

"Always" and an explicit "Do not use cat" ban. Going through apply_patch ensures reliable diff tracking and change presentation to the user, so this is a tightening meant to make agent behavior more predictable.

### Handling unexpected changes: from panic to calm

GPT-5.3-Codex had this instruction for when unexpected changes are found mid-work.

```
- While you are working, you might notice unexpected changes that you didn't make.
  If this happens, STOP IMMEDIATELY and ask the user how they would like to proceed.
```

GPT-5.4 changes it to a calmer response.

```
- While you are working, you might notice unexpected changes that you didn't make.
  It's likely the user made them, or were autogenerated. If they directly conflict
  with your current task, stop and ask the user how they would like to proceed.
  Otherwise, focus on the task at hand.
```

"STOP IMMEDIATELY" is gone, replaced with "the user probably made them or they were auto-generated; only ask if they directly conflict, otherwise focus on the task at hand." Auto-generated changes from linters and formatters happen constantly during long agent sessions, and stopping every time would grind work to a halt. This reflects real-world operational knowledge.

### Adjusting intermediary update frequency: 20s → 30s

GPT-5.3-Codex had intermediary updates every 20 seconds. GPT-5.4 changes this to every 30 seconds.

```
# 5.3-Codex
- You provide user updates frequently, every 20s.

# 5.4
- You provide user updates frequently, every 30s.
```

In addition, GPT-5.4 adds a new line: "When working for a while, keep updates informative and varied, but stay concise." A tuning in the direction of reducing frequency while raising quality. 20 seconds was probably too many interruptions for the user.

### Modern React pattern guidance

GPT-5.4's Frontend tasks section has an addition that GPT-5.3-Codex doesn't have.

```
- For React code, prefer modern patterns including useEffectEvent, startTransition,
  and useDeferredValue when appropriate if used by the team. Do not add
  useMemo/useCallback by default unless already used; follow the repo's
  React Compiler guidance.
```

Explicit guidance for React Compiler. The instruction not to add useMemo/useCallback by default is written under the assumption that React Compiler auto-optimizes these.

### Forbidding chained bash commands

GPT-5.4 adds the following to parallel tool-call guidance.

```
Never chain together bash commands with separators like `echo "====";`
as this renders to the user poorly.
```

GPT-5.3-Codex didn't have this constraint. A real-world bug fix for when the agent builds command chains like `echo "====" ; cat file.txt ; echo "====="`, which renders poorly in the Codex UI.

### Patterns of instruction changes from git log

We've looked at the 5.3-Codex → 5.4 diff. But is this diff "intentional tuning for the model's characteristics," or "operational knowledge about Codex that happens to be reflected only in the newest model?"

If you go through every commit (25 commits, 2025-12-17 to 2026-03-06) in the models.json [git log](https://github.com/openai/codex/commits/main/codex-rs/core/models.json), the base_instructions changes fall into three patterns.

Pattern 1: infrastructure changes applied to all models at once

For example, the 2026-02-03 commit [`6c069ca3`](https://github.com/openai/codex/commit/6c069ca3b) "Clarify collaboration-mode semantics in prompts to prevent mode confusion" adds exactly the same text to all 9 models from gpt-5 through gpt-5.2-codex.

```
## Collaboration modes

- Mode-specific behavior is provided through developer instructions,
  typically wrapped in `<collaboration_mode>...</collaboration_mode>`.
- Treat the most recent collaboration-mode developer instruction as the active mode.
- A mode changes only when new developer instructions change it;
  user requests or tool descriptions do not change mode by themselves.
- Known mode names are Default and Plan
```

Similarly, the 2026-01-13 commit [`ebbbee70`](https://github.com/openai/codex/commit/ebbbee70c) applies a large sandbox/approvals description deletion to all models at once. These are infrastructure-side changes unrelated to any model's individual characteristics.

Pattern 2: when a new model is added, the newest instructions get applied to it, while older models freeze

If you trace each model's base_instructions length over time, this pattern emerges.

| Model | Characters | Notes |
|---|---|---|
| gpt-5-codex / gpt-5.1-codex / gpt-5.1-codex-mini | 6,621 | Identical across all 3 models |
| gpt-5.1-codex-max / gpt-5.2-codex | 7,563 | Identical across both, +Frontend tasks |
| gpt-5.3-codex | 12,341 | +Personality, +Autonomy, etc., large additions |
| gpt-5.4 | 14,100 | +expert preamble, various tweaks |

gpt-5-codex, gpt-5.1-codex, and gpt-5.1-codex-mini have completely identical instructions in their final state, down to the character. gpt-5.1-codex-max and gpt-5.2-codex are also byte-identical. If any model-specific tuning were happening, at least the model-self-reference parts should differ, but they don't.

Also, since gpt-5.3-codex was added (2026-02-10), the instructions for gpt-5 through gpt-5.2-codex haven't been changed at all. All new knowledge goes only into new models.

Pattern 3: structural evolution in new generations

The `# Personality` section (Values / Interaction Style / Escalation) first introduced in gpt-5.3-codex is identical in gpt-5.4, with no 5.3→5.4 diff in that section. The "expert engineer" preamble mentioned earlier was added at the beginning of `# General`, not `# Personality`.

### Another view from the official docs

Two official docs provide important complementary information.

First, the [GPT-5 Prompting Guide](https://developers.openai.com/cookbook/examples/gpt-5/gpt-5_prompting_guide) treats GPT-5 as a single model controlled by `reasoning_effort` and `verbosity` parameters, without ever mentioning per-version differences. There's no instruction to adjust prompts per model version.

Second, the [Latest Model Guide](https://developers.openai.com/api/docs/guides/latest-model#preambles) has a decisive line.

> GPT-5.4 has a **strong out-of-the-box coding personality**, so teams spend less time on prompt tuning.

In other words, GPT-5.4 already has a coding personality baked in at training time.

And yet in models.json, GPT-5.4 has the longest instructions of any model (14,100 characters). This runs counter to the intuition that "if the out-of-the-box personality is strong, instructions should be short." But this isn't because the model's personality is weak; it's because Codex CLI's operational requirements (autonomy, intermediary updates, frontend tasks, formatting rules, etc.) have been accumulating generation by generation.

### What the diff really is

Putting it all together, the GPT-5.3-Codex → 5.4 diff we saw earlier is a mix of two things.

1. Real-world feedback from Codex CLI: forcing apply_patch, calmer handling of unexpected changes, banning chained bash commands, adjusting the intermediary update interval, etc. These are "environment requirements for the agent," not "the model's personality," applied only to the newest model going forward
2. Calibration to leverage the model's training characteristics: directing GPT-5.4's "strong out-of-the-box coding personality" toward the specific execution environment of Codex CLI. The expert preamble and React Compiler handling fall here

The models.json diff is better understood as calibration to draw out the model's training-imprinted capabilities within the Codex CLI context, not as something that creates the model's personality.

## Enabling the 1M context window in Codex

As we can see in models.json, GPT-5.4's default `context_window` is 272,000 tokens. But experimentally, you can extend it to 1M (1 million).

### How to configure it

There are two ways.

**Method 1: specify it with a CLI flag**

With Codex's `-c` flag, you can set it directly without editing config.toml.

```bash
codex -m gpt-5.4 -c model_context_window=1000000 -c model_auto_compact_token_limit=900000
```

`-c key=value` is a general-purpose flag that overrides any key in `config.toml` from the CLI ([codex-rs/utils/cli/src/config_override.rs](https://github.com/openai/codex/blob/main/codex-rs/utils/cli/src/config_override.rs)). Values are parsed as TOML, and integers are treated as integers. Handy when you want to try out 1M context ad hoc.

**Method 2: write it into config.toml**

For regular use, add this to `~/.codex/config.toml`.

```toml
model = "gpt-5.4"
model_context_window = 1000000
model_auto_compact_token_limit = 900000
```

Here's what these two parameters do.

- `model_context_window`: the model's context window size (in tokens). Default is 272,000. Setting it to 1M keeps up to 1 million tokens of conversation history
- `model_auto_compact_token_limit`: the token count threshold that triggers conversation auto-compaction. Exceeding this causes older conversation to get summarized

### How it works under the hood

Looking at Codex's source code, you can see how these settings get applied.

Here's the override logic in [codex-rs/core/src/models_manager/model_info.rs](https://github.com/openai/codex/blob/main/codex-rs/core/src/models_manager/model_info.rs).

```rust
pub(crate) fn with_config_overrides(mut model: ModelInfo, config: &Config) -> ModelInfo {
    // ...
    if let Some(context_window) = config.model_context_window {
        model.context_window = Some(context_window);
    }
    if let Some(auto_compact_token_limit) = config.model_auto_compact_token_limit {
        model.auto_compact_token_limit = Some(auto_compact_token_limit);
    }
    // ...
}
```

A straightforward design where `config.toml` values flow directly into ModelInfo. In the default GPT-5.4 definition ([codex-rs/core/models.json](https://github.com/openai/codex/blob/main/codex-rs/core/models.json)), `context_window` is 272000 and `auto_compact_token_limit` is unset. When it's unset, 90% of the context window (`context_window * 9 / 10`) is used as the auto-compaction threshold.

So by default, auto-compaction kicks in around 244,800 tokens. When you extend to 1M, it's recommended to set `model_context_window` to 1000000 and explicitly specify the compaction threshold with `model_auto_compact_token_limit`. The example above uses 900,000, but adjust that to your taste.

### A note on cost

An important note here. The [official blog](https://openai.com/index/introducing-gpt-5-4/) says:

> Requests that exceed the standard 272K context window count against usage limits at 2x the normal rate.

Requests exceeding 272K count against usage limits at 2x the normal rate. The amount you can use in the same quota effectively halves, so heavy users will hit limits more easily.

### When to use it

1M context shines in cases like these.

- Cross-cutting refactoring in a large repository where you want to hold the full picture
- Long debug sessions where you don't want conversation history compressed
- Multi-file architecture reviews

Conversely, for regular coding work the default 272K is often plenty. According to the [Latest Model Guide](https://developers.openai.com/api/docs/guides/latest-model), GPT-5.4 is "the first mainline model trained for context compaction in extended agent trajectories." Here, compaction refers to summarizing/compressing prior context when conversations get long, so the model can carry state and reasoning forward with fewer tokens ([Compaction Guide](https://developers.openai.com/api/docs/guides/compaction/)). A design consciously aimed at coding agents like Codex — or rather at general AI agents that make many tool calls — assuming periodic compaction during long sessions.

GPT-5.4 is optimized at training time for recovery from compaction, so letting auto-compact do its thing loses less context than with older models. Extending to 1M is something to consider when auto-compact actually fails to preserve something you needed.

## Comparisons with other models

With the internals of Codex out of the way, let's see how GPT-5.4 stacks up against other frontier models.

### API pricing comparison

Starting with pricing. Cost structure differences directly affect your choice, so this matters.

| Model | Input ($/M tokens) | Cache read ($/M tokens) | Output ($/M tokens) | Source |
|---|---|---|---|---|
| GPT-5.4 (≤272K) | $2.50 | $0.25 | $15.00 | [OpenAI](https://openai.com/api/pricing/) |
| GPT-5.4 (>272K) | $5.00 | $0.50 | $22.50 | [OpenAI](https://openai.com/api/pricing/) |
| GPT-5.4 Pro (≤272K) | $30.00 | - | $180.00 | [OpenAI](https://openai.com/api/pricing/) |
| GPT-5.4 Pro (>272K) | $60.00 | - | $270.00 | [OpenAI](https://openai.com/api/pricing/) |
| GPT-5.2 | $1.75 | $0.175 | $14.00 | [OpenAI](https://openai.com/api/pricing/) |
| Claude Sonnet 4.6 (≤200K) | $3.00 | $0.30 | $15.00 | [Anthropic](https://platform.claude.com/docs/en/about-claude/pricing) |
| Claude Sonnet 4.6 (>200K) | $6.00 | $0.60 | $22.50 | [Anthropic](https://platform.claude.com/docs/en/about-claude/pricing) |
| Claude Opus 4.6 (≤200K) | $5.00 | $0.50 | $25.00 | [Anthropic](https://platform.claude.com/docs/en/about-claude/pricing) |
| Claude Opus 4.6 (>200K) | $10.00 | $1.00 | $37.50 | [Anthropic](https://platform.claude.com/docs/en/about-claude/pricing) |
| Gemini 3.1 Pro (≤200K) | $2.00 | $0.20 | $12.00 | [Google](https://ai.google.dev/gemini-api/docs/pricing) |
| Gemini 3.1 Pro (>200K) | $4.00 | $0.40 | $18.00 | [Google](https://ai.google.dev/gemini-api/docs/pricing) |
| Gemini 2.5 Pro (≤200K) | $1.25 | $0.125 | $10.00 | [Google](https://ai.google.dev/gemini-api/docs/pricing) |
| Gemini 2.5 Pro (>200K) | $2.50 | $0.25 | $15.00 | [Google](https://ai.google.dev/gemini-api/docs/pricing) |

Cache read corresponds to OpenAI's "Cached input," Anthropic's "Cache Hits & Refreshes," and Google's "Context caching" — all at 0.1x the base input rate.

GPT-5.4 is 43% more expensive for input than GPT-5.2 ($1.75 → $2.50). That said, OpenAI claims GPT-5.4's token efficiency is significantly improved over GPT-5.2, so the total tokens required for a given task decrease, and the effective cost can actually be lower in some cases.

Compared to Claude Sonnet 4.6, GPT-5.4 has cheaper input ($2.50 vs. $3.00) and the same output ($15.00). Gemini 2.5 Pro is the cheapest on both input and output, but each model has its own strengths, so cost alone can't decide it.

All three providers charge 2x input and 1.5x output above their long-context thresholds (OpenAI: over 272K, Anthropic and Google: over 200K). Constantly running with 1M context costs roughly 2x normal.

### Cross-benchmark comparison

GPT-5.4 was released today, so third-party apples-to-apples benchmarks aren't fully out yet, but here's a comparison using each vendor's official numbers.

| Evaluation | GPT-5.4 | Claude Opus 4.6 | Gemini 3.1 Pro | Source |
|---|---|---|---|---|
| OSWorld-Verified (computer use) | 75.0% | 72.7% | - | [OpenAI](https://openai.com/index/introducing-gpt-5-4/), [Anthropic](https://www.anthropic.com/news/claude-opus-4-6) |
| SWE-Bench Verified (coding) | - | 80.8% | 80.6% | [Google DeepMind](https://deepmind.google/models/model-cards/gemini-3-1-pro/) |
| SWE-Bench Pro (coding) | 57.7% | - | 54.2% | [OpenAI](https://openai.com/index/introducing-gpt-5-4/), [Google DeepMind](https://deepmind.google/models/model-cards/gemini-3-1-pro/) |
| Terminal-Bench 2.0* | 75.1% | 65.4% | 68.5% | [OpenAI](https://openai.com/index/introducing-gpt-5-4/), [Google DeepMind](https://deepmind.google/models/model-cards/gemini-3-1-pro/) |
| GPQA Diamond (science reasoning) | 92.8% | 91.3% | 94.3% | [OpenAI](https://openai.com/index/introducing-gpt-5-4/), [Google DeepMind](https://deepmind.google/models/model-cards/gemini-3-1-pro/) |
| ARC-AGI-2 (abstract reasoning) | 73.3% | 68.8% | 77.1% | [OpenAI](https://openai.com/index/introducing-gpt-5-4/), [ARC Prize](https://arcprize.org/leaderboard) |
| MMMU Pro (visual understanding) | 81.2% | 73.9% | 80.5% | [OpenAI](https://openai.com/index/introducing-gpt-5-4/), [Google DeepMind](https://deepmind.google/models/model-cards/gemini-3-1-pro/) |
| GDPval-AA (knowledge work) | 83.0% | 1,606 Elo | 1,317 Elo | [OpenAI](https://openai.com/index/introducing-gpt-5-4/), [Google DeepMind](https://deepmind.google/models/model-cards/gemini-3-1-pro/) |
| BrowseComp (web search) | 82.7% | 84.0% | 85.9% | [Google DeepMind](https://deepmind.google/models/model-cards/gemini-3-1-pro/) |
| MCP Atlas (tool integration) | 67.2% | 59.5% | 69.2% | [OpenAI](https://openai.com/index/introducing-gpt-5-4/), [Google DeepMind](https://deepmind.google/models/model-cards/gemini-3-1-pro/) |

*Terminal-Bench 2.0 results use the Terminus-2 harness. GPT-5.4's 75.1% is OpenAI's official score. Scores vary a lot by agent + model combination (e.g., Opus 4.6 scores 74.7% on Terminus-KIRA, Gemini 3.1 Pro + Forge Code scores 78.4%), and GPT-5.3-Codex's 77.3% (Codex CLI) is higher than GPT-5.4's. MMMU Pro and GPQA Diamond are tools-off. GDPval-AA is reported only as a percentage by OpenAI, while Anthropic/Google report Elo.

Caveat: each vendor's official scores use different evaluation conditions (scaffolding, reasoning-effort settings, tool setups, etc.), so this isn't a strict apples-to-apples comparison. It's just for getting a feel of where each model shines.

The pattern is pretty clear.

In computer use, GPT-5.4 leads OSWorld at 75.0%. Terminal-Bench at 75.1% is also strong, but actually lower than GPT-5.3-Codex's 77.3%, and Gemini 3.1 Pro + Forge Code records 78.4%. That said, in agent-style workflows like Codex, the OSWorld gap matters.

In science reasoning and abstract reasoning, Gemini 3.1 Pro is the strongest. GPQA Diamond 94.3% and ARC-AGI-2 77.1% are its lead.

In visual understanding (MMMU Pro, tools-off), Gemini 3.1 Pro 80.5% and GPT-5.4 81.2% beat Opus 4.6's 73.9%. But Opus 4.6 rises to 77.3% with tools, so in tool-integrated practice the gap narrows.

In knowledge work (GDPval), GPT-5.4 takes the top score at 83.0%. It demonstrates its real-world chops in professional tasks (spreadsheets, presentations, legal analysis).

In web search (BrowseComp), Gemini 3.1 Pro leads at 85.9%, but GPT-5.4 Pro (89.3%) is higher still.

In short, there's no "strongest everywhere" model; the best choice depends on the task.

### Picking the right model for coding

Organizing things by practical model selection:

- GPT-5.4: deepest Codex integration. Many unique features like computer use, 1M context, and mid-response steering via the commentary channel. As Terminal-Bench 75.1% suggests, it really shines in long agent sessions and terminal operations
- Claude Opus 4.6: high coding quality, as SWE-Bench Verified 80.8% shows. MMMU Pro 73.9% (77.3% with tools) shows solid visual understanding too. Strong for document-driven code review
- Claude Sonnet 4.6: close to Opus 4.6 performance at about 60% of the cost. A strong choice if you're cost-conscious
- Gemini 3.1 Pro: top on abstract reasoning (ARC-AGI-2 77.1%) and science reasoning (GPQA 94.3%). Competitive API pricing at $2/$12

If you're using Codex, GPT-5.4 is the first choice. If you're using multiple models via APIs, pick based on task characteristics and budget.

## Wrap-up

- GPT-5.4 is a unified frontier model making big strides in computer use (OSWorld 75.0%, beating humans) and knowledge work (GDPval 83.0%)
- Reading the GPT-5.3-Codex → 5.4 diff in Codex's models.json reveals improvements driven by operational feedback: forcing apply_patch, calmer handling of unexpected changes, React Compiler awareness, and more
- The git log analysis shows these diffs aren't things that create the model's personality. They're a mix of accumulated Codex CLI operational knowledge and calibration aligning the model's training traits to its execution environment. Older models (gpt-5-codex through gpt-5.1-codex-mini) share identical instructions, and model-specific tuning mainly happens in the newest generation
- To use 1M context in Codex, run `codex -m gpt-5.4 -c model_context_window=1000000 -c model_auto_compact_token_limit=900000`, or write the equivalent into `config.toml`
- Cross-model comparison shows task-dependent strengths, with no single "best everywhere" model. Computer use and terminal operation → GPT-5.4; coding quality → Claude Opus 4.6; reasoning → Gemini 3.1 Pro

## References

- [Introducing GPT-5.4 | OpenAI](https://openai.com/index/introducing-gpt-5-4/)
- Codex Source
    - [codex-rs/core/models.json](https://github.com/openai/codex/blob/main/codex-rs/core/models.json)
    - [codex-rs/core/src/models_manager/model_info.rs](https://github.com/openai/codex/blob/main/codex-rs/core/src/models_manager/model_info.rs)
    - [codex-rs/core/config.schema.json](https://github.com/openai/codex/blob/main/codex-rs/core/config.schema.json)
    - [codex-rs/utils/cli/src/config_override.rs](https://github.com/openai/codex/blob/main/codex-rs/utils/cli/src/config_override.rs)
- Tool Search
    - [Introducing advanced tool use | Anthropic](https://www.anthropic.com/engineering/advanced-tool-use)
    - [Tool search tool | Claude API Docs](https://platform.claude.com/docs/en/agents-and-tools/tool-use/tool-search-tool)
    - [Claude Code MCP Tool Search | Claude Code Docs](https://code.claude.com/docs/en/mcp)
- Pricing
    - [OpenAI API Pricing](https://openai.com/api/pricing/)
    - [Anthropic API Pricing](https://platform.claude.com/docs/en/about-claude/pricing)
    - [Gemini API Pricing](https://ai.google.dev/gemini-api/docs/pricing)
- Test-Time Compute
    - [Scaling LLM Test-Time Compute Optimally can be More Effective than Scaling Model Parameters | Snell et al. (ICLR 2025 Oral)](https://arxiv.org/abs/2408.03314)
- GPT-5 Prompting & Model Guide
    - [GPT-5 Prompting Guide | OpenAI Cookbook](https://developers.openai.com/cookbook/examples/gpt-5/gpt-5_prompting_guide)
    - [Latest Model Guide - Preambles | OpenAI API Docs](https://developers.openai.com/api/docs/guides/latest-model#preambles)
- System Prompt Analysis
    - [System Prompts Define the Agent as Much as the Model | dbreunig (2026)](https://www.dbreunig.com/2026/02/10/system-prompts-define-the-agent-as-much-as-the-model.html)
- Benchmark
    - [Introducing Claude Opus 4.6 | Anthropic](https://www.anthropic.com/news/claude-opus-4-6)
    - [Gemini 3.1 Pro Model Card | Google DeepMind](https://deepmind.google/models/model-cards/gemini-3-1-pro/)
    - [ARC Prize Leaderboard](https://arcprize.org/leaderboard)
    - [Terminal-Bench 2.0 Leaderboard](https://www.tbench.ai/leaderboard/terminal-bench/2.0)
    - [OpenAI launches GPT-5.4 | TechCrunch](https://techcrunch.com/2026/03/05/openai-launches-gpt-5-4-with-pro-and-thinking-versions/)
