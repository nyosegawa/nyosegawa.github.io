---
title: "Skill Design for Keeping Humans Out of the Agent Workflow Bottleneck"
description: "A design pattern that uses Claude Code Skills to capture the moment an agent is about to ask a human, then combines it with Ralph loops to get close to full autonomy."
date: 2026-02-17
tags: [Claude Code, Skills, Agent, Automation, chrome MCP, Ralph loop]
author: 逆瀬川ちゃん
lang: en
---

Hi there! This is Sakasegawa ([@gyakuse](https://x.com/gyakuse))!

Today I want to talk about the problem of humans becoming the bottleneck in Coding Agent workflows, and how I solved it with a Claude Code Skill.

<!--more-->

## Humans are the bottleneck

In his [2026 coding trends post](https://beyond.addy.ie/2026-trends/), Addy Osmani writes:

> Ralph loops remove human bottlenecks by allowing AI to work autonomously on long-running tasks.

Mathias Biilmann, co-founder of Netlify, makes the same point in his [2026 predictions](https://biilmann.blog/articles/predictions-for-2026/): it's backwards for humans to end up spending all their time reviewing massive amounts of AI-generated code.

You feel this instantly when you actually work with Claude Code. The agent writes code, runs tests, debugs, and keeps moving forward on its own. And then at some point it just stops.

- "Can I push?"
- "Is this design OK?"
- "Tests passed. What's next?"
- "Can you check this in the browser?"

Every one of these is a wait on the human. The agent moves in seconds, but it sits idle for minutes waiting on my reply. Each round trip is a 2-5 minute context switch. Ask ten times and you've burned half an hour of pure human-wait time.

The real issue is that agents are way too conservative about deciding whether to ask a human. They ask before pushing. Before deploying. Before deleting. Before making design calls. Before picking the next step.

But if you think about it, the agent could decide most of these on its own. Whether to push? Run the tests. Whether the UI is right? Take a screenshot and look at it yourself. What's next? Work backwards from the goal.

## A Skill that captures "the moment it wants to ask"

Claude Code [Skills](https://claude.com/blog/skills) have a mechanism where the agent autonomously loads a skill based on context. When the trigger conditions in the SKILL.md description match, the agent pulls the skill in itself.

That was the hook. If you write "the moment it wants to ask a human" into the description as a trigger, the skill gets loaded right when the agent is about to ask, and its body can redirect with a "no, just do it yourself."

Here's the actual description I wrote:

```yaml
description: "Load this skill BEFORE asking the user any question,
  requesting confirmation, seeking approval, asking what to do next,
  or stopping to wait for human input. Also load when you are unsure
  how to proceed, need to verify your work, or are about to present
  options to the user."
```

The key phrase is "BEFORE asking." Load it before the question happens. Once it's loaded, the body of the skill is in the agent's context, carrying the instruction: "don't ask, do it yourself."

## The skill body: just do all of it

The body of the skill is simple. The core fits in four lines.

- Don't ask if you can push. Push.
- Don't ask if you can deploy. Deploy.
- Don't ask what to do next. Figure it out from the goal.
- Don't ask if it's right. Verify it yourself.

The only time it's OK to call a human is for things the agent physically cannot do. SMS verification codes, CAPTCHAs, biometric auth, physical device operations. Things the agent's tools simply can't reach.

git push? Do it. Production deploy? Do it. Delete a file? Do it. Send a Slack message? Do it. Architecture decision? Decide it yourself.

The underlying philosophy is: trust that the agent can do it.

## The self-verification arsenal: chrome MCP

"Verify it yourself" doesn't work if you have no way to verify. The key tool here is the [claude-in-chrome](https://chromewebstore.google.com/detail/claude-in-chrome-mcp-serv/oepamnidilnhaapcgnecpgicnfoeocjf) MCP.

With chrome MCP, the agent can see the browser the same way a human does.

| What you want to do | chrome MCP |
|---|---|
| Check that the UI is right | `read_page` / `computer` for screenshot → read it yourself |
| Check for console errors | `read_console_messages` with a pattern filter |
| Check API responses | `read_network_requests` |
| Fill forms, click buttons | `computer` / `form_input` |

The agent is multimodal, so once it takes a screenshot it can look at the image itself and decide whether the UI is broken. No need to tell a human "please check the browser."

Without chrome MCP, you can fall back on Playwright or curl. With Playwright, `page.screenshot()` captures an image and you read it with the Read tool. With curl, you judge by status code and response body. chrome MCP is the best option, but self-verification still works without it.

## Self-driven continuation

It's not just verification. Deciding what to do next is also the agent's job.

The agent knows the goal. The goal the user stated at the start of the conversation. From there, it has all the information needed to judge where it is now, what's left, and what the next logical step is.

```
1. Look at the goal
2. Assess the current state (what's done, what's left)
3. Decide the next step
4. Do it
```

Once the goal is done, verify the result and report it. If there's a natural follow-up, suggest that too. But don't ask "what should I do next?"

## Complementary to the Ralph loop

"Ralph loop" showed up in the Addy Osmani quote at the top. This is a pattern originating from [snarktank/ralph](https://github.com/snarktank/ralph): an autonomous execution loop that keeps running the agent until every task in a PRD's task list is done. Each iteration starts with a fresh context, and state is carried through git history and a progress.txt. It's a design that routes around context window limits via task splitting and persistent state.

As Matthew Berman points out in his [explainer](https://www.wisdomai.com/insights/matthew_berman/ralph-loop-autonomous-agents-ai-coding-context-window-ffdd1834), the core idea of a Ralph loop is to judge completion by tests, not by the agent. Keep running until the tests pass. Don't wait for human review.

That's where the relationship between the anti-human-bottleneck skill and the Ralph loop comes into focus.

| Layer | Role | Problem it solves |
|---|---|---|
| **Ralph loop** (outer) | Repeat until task done | Context limits, task management |
| **anti-human-bottleneck** (inner) | Keep moving without waiting on a human within each run | Decision stalls, approval waits |

The Ralph loop is the outer loop that "keeps running until done." The skill is the inner principle that "keeps the agent from stopping inside each loop."

With just the Ralph loop, the agent may stop mid-iteration asking "can I push?" With just the skill, you eventually hit the context window wall. Combine them and you get a two-layer structure: an outer loop with state management and repeated execution, and an inner layer of autonomous decision-making and verification.

As Geoffrey Huntley writes in [everything is a ralph loop](https://ghuntley.com/loop/), humans should step into the loop for "identifying and solving problems," not for daily confirmations and approvals. The anti-human-bottleneck skill is exactly about stripping out those daily confirmations so humans only show up when they're actually needed.

## When you do have to call a human

When a human is genuinely needed — typing in an SMS code, say — treat the human as a "high-latency, low-bandwidth tool."

What matters is minimizing cognitive load. Human cognitive bandwidth is finite, and right after a context switch it's especially low. So the call looks like this:

```
Paste the 6-digit code from the SMS.
```

Not like this:

```
The site is requesting phone number verification. How should we proceed?
Do you want to wait, or try a different verification method?
```

When you offer options, offer 2-4, mark the recommended one, and explain in one sentence. No open-ended questions, ever. The ideal human interface is "just pick."

## As a Skill design pattern

What's interesting about this skill is that it's a meta-skill — it changes the agent's _behavior pattern_. That's different in kind from skills that perform specific tasks (repo analysis, blog writing, etc.).

A few design notes.

### description is everything

Whether a skill fires is determined by its description. For it to load right when the agent thinks "maybe I'll ask a question," the description has to accurately describe that internal state.

"before asking the user any question," "when you are unsure how to proceed," "about to present options" — these describe the agent's pre-action state. The trigger isn't user utterance, it's the agent's internal state.

### Keep it in one file

Behavior-principle skills are better undivided. Splitting into `references/` breaks consistency via partial loading. When the agent is deciding "should I push?", the escalation rules, the self-verification means, and the continuation rules all need to be in context at the same moment.

### commands vs skills

Even for the same verification flow, project-specific procedures (start on a specific port, expect specific events, etc.) belong in `.claude/commands/`. Generic behavior principles like "don't ask, do it yourself" belong in `~/.claude/skills/`.

| Location | Purpose | Example |
|---|---|---|
| `.claude/commands/verify.md` | Project-specific verification | Health check on a specific port, monitor specific events |
| `~/.claude/skills/anti-human-bottleneck/` | Generic behavior principle | Self-verification, self-judgment, continuation rules |

These two aren't exclusive, they're complementary. The skill says "verify it yourself." The command says "in this project, here's how you verify."

## Summary

- The bottleneck in agent workflows is the human. Every time the agent asks, you lose minutes.
- Writing "the moment it wants to ask" as a trigger in a Skill description loads the skill before the question happens and redirects to self-resolution.
- chrome MCP for browser verification, tests for functional verification, git diff for code review. Human eyes not required.
- Ralph loop is the outer iteration, this skill is the inner autonomy. Together they get you close to full autonomy.
- Only call a human for things the agent physically can't do (SMS, CAPTCHA, etc.). Even then, minimize cognitive load.

The skill is public: [anti-human-bottleneck](https://github.com/nyosegawa/skills/tree/main/skills/anti-human-bottleneck)

## References

- [Claude Code Skills](https://claude.com/blog/skills)
- [Skills explained: How Skills compares to prompts, Projects, MCP, and subagents](https://claude.com/blog/skills-explained)
- [Best Practices for Claude Code](https://code.claude.com/docs/en/best-practices)
- [claude-in-chrome MCP](https://chromewebstore.google.com/detail/claude-in-chrome-mcp-serv/oepamnidilnhaapcgnecpgicnfoeocjf)
- [Top AI Coding Trends for 2026 – Addy Osmani](https://beyond.addy.ie/2026-trends/)
- [Predictions for 2026 – Mathias Biilmann](https://biilmann.blog/articles/predictions-for-2026/)
- [Why 'Ralph' Agents Are Upending How We Code – Matthew Berman](https://www.wisdomai.com/insights/matthew_berman/ralph-loop-autonomous-agents-ai-coding-context-window-ffdd1834)
- [snarktank/ralph – GitHub](https://github.com/snarktank/ralph)
- [everything is a ralph loop – Geoffrey Huntley](https://ghuntley.com/loop/)
- [Slash commands - Claude Code Docs](https://code.claude.com/docs/en/slash-commands)
