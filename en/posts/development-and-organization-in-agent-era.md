---
title: "Development and Organization in a New Era"
description: "In an era where one person can ship 300 commits / 60,000 lines a day alongside a Coding Agent, how should we organize and operate? Some thoughts from direct experience."
date: 2026-02-24
tags: [Coding Agent, Claude Code, Organization, Productivity, Team Design]
author: 逆瀬川ちゃん
lang: en
---

Hi there! This is Sakasegawa ([@gyakuse](https://x.com/gyakuse))!

Today I want to think through "how development works" and "what organizations should look like" in an era where you're developing alongside a Coding Agent, based on my own experience.

<!--more-->

## What's happening right now

According to Anthropic's [2026 Agentic Coding Trends Report](https://resources.anthropic.com/2026-agentic-coding-trends-report), 4% of public commits on GitHub are already being authored by Claude Code. That's on pace to exceed 20% by the end of the year. Inside Anthropic, merged PRs per engineer have gone up by 67%.

In my own setup I'm running ChatGPT Pro ($200/month) together with Claude Code Max x20 ($200/month), rotating through several disparate projects, and I'm currently around 90 commits / 30,000 lines per day. It's starting to feel like my workload is minimizing, and the "max throughput" milestone I see on the horizon is around 300 commits / 60,000 lines per day.

These numbers vary a lot with commit granularity and test coverage, of course. And beyond this you start hitting service rate limits, which is a hard physical ceiling. The real question isn't speed. It's how humans handle that volume of output.

## What caps throughput

With ChatGPT Pro and Claude Code Max x20 running full throttle, the theoretical ceiling sits around here.

| Item | Value |
|---|---|
| Subscriptions | ChatGPT Pro ($200/mo) + Claude Max x20 ($200/mo) |
| Daily commit ceiling | ~300 commits |
| Daily line ceiling | ~60,000 lines |
| Limiting factor | Service rate limits |

If you want to push higher, you need multiple accounts, and that's a conversation with each service's terms of service and with your wallet. For Claude Code specifically, you can extend the ceiling via API keys for the overflow.

Now, whether you actually _reach_ that ceiling is a different matter. "Project hardness" massively affects speed.

## Project hardness

How fast you can hand work to an agent varies wildly by project. I call that variance "hardness."

Hardness isn't just a technical property. It also depends on the project's phase and organizational constraints.

| Parameter | Soft (fast) | Hard (slow) |
|---|---|---|
| Phase | Greenfield. Build freely. | Modifying an existing codebase. Need to understand blast radius. |
| Spec clarity | Spec is solid. Agent can run alone. | Spec is vague. Needs human dialogue to move. |
| Task separation | Tasks are independent. Can fan out in parallel. | Tasks are tightly coupled. Must go serial. |
| Verification cycle | Tests / CI auto-verify. Agent is self-contained. | Humans have to eyeball it or click through a browser. Agent stalls. |
| Approval flow | You can merge / push at your own discretion. | Reviews and stakeholder sign-off required. Waits accrue. |
| External dependencies | Self-contained. | External APIs, other teams' services, waits on environment setup. |

In reality these compound. A greenfield project that needs stakeholder alignment is hard; an existing codebase with thick tests and well-separated tasks is fast enough.

If you have multiple similar projects, you can reuse a single Skill and flow design across them, which multiplies efficiency. That said, full automation (zero human intervention) is still risky with today's Coding Agents, even if you've built out the Skills and flows. Agents are definitely improving, but architecture decisions and interpreting vague requirements are still human territory.

What matters is surfacing which parameters dominate hardness across your own portfolio, so you know where the fastest line actually is.

## The structure of the human bottleneck

Ask "why don't we hit the ceiling?" and the answer is almost always: humans are the bottleneck.

When you develop with a Coding Agent, you're fundamentally managing a rotating stream of short-term direct reports. Each agent session starts on one task; when it's done, its context disappears. The next task starts with a new agent. New hire, brief, deliver, gone. Forever.

Three kinds of bottleneck show up on the human side.

- **Waiting for instructions**: the agent's task queue runs dry and it stops. The human has to think up what's next.
- **Waiting for sign-off**: the agent says "done" but the human hasn't reviewed. Deliverables pile up in a queue.
- **Interrupt storm**: the agent keeps firing off questions and confirmations, and the human basically ends up on a 24/7 phone shift.

The third one is the worst. If you're constantly in interrupt-handling mode, you fall into the classic PM misery — eaten by daily response work, with no time left to think deeply about the project or evaluate ideas.

Until agents can reliably generate and sign off on ideas autonomously (and that window may not be long), "thinking work" is still ours. That's exactly why the design goal has to be: minimize response cost, protect thinking time.

## Controlling cognitive load

Two axes I keep in mind to avoid bottlenecks.

First: automation. Like the anti-human-bottleneck skill I wrote about in my [previous post](https://nyosegawa.com/posts/claude-code-verify-command/), I design for the agent to keep going without asking. Task management is also automated through my [Linear integration skill](https://nyosegawa.com/posts/claude-code-linear-task-skill/). The key is not being on a permanent phone shift.

Second: low-cognitive-load response patterns. Even when something needs a response, make sure other things keep moving. The key concept here is load time.

That's the time it takes a human to recall a project, page it into memory, and start thinking about an idea. Whether that's 3 seconds or 3 minutes changes productivity by orders of magnitude. The same is true of sign-off load time — the time from hearing "it's done" to being able to actually evaluate the deliverable in the context of the project.

You should measure this. And you need mechanisms that compress it.

### How I compress load time

Some things I actually do:

- **Conversational memo → idea → task progression**: a flow where anything that pops into my head becomes a task and gets handed to an agent immediately.
- **Conversational delivery → sign-off → release progression**: a flow where I can review agent deliverables at minimum cognitive cost.
- **Resource visibility**: visibility into which project is eating which chunk of agent time, and where things are stuck.

The "memo → idea → task" flow is especially important, and Claude Code Skills let me run it in natural language. Saying "turn this idea into a task" creates an issue in Linear and an agent picks it up. I never have to open a PM tool myself.

## Documentation strategy: one file + ADRs

When you develop with an agent, the lighter your docs, the better.

The ideal is a single CLAUDE.md plus a set of ADRs ([Architecture Decision Records](https://adr.github.io/)). You should not be writing descriptive documentation about the code ("this module does X and Y…").

The reason is simple: descriptive docs go stale every time the code changes. At a pace of hundreds of commits per day, there is no way doc maintenance keeps up. And agents can read the code directly, so there's no reason to route through descriptive docs to begin with.

ADRs are different. ADRs record _why_ a design decision was made, and they hold value independently of code changes. When the agent picks up the next task, knowing the reasoning behind past decisions helps it move in the right direction. ADRs are Markdown, you can write one in a few minutes, and using the [joelparkerhenderson/architecture-decision-record](https://github.com/joelparkerhenderson/architecture-decision-record) template keeps the structure consistent.

| Document | Needed in the agent era? | Why |
|---|---|---|
| CLAUDE.md | Yes | Agent behavior, fixed parameters, project structure |
| ADRs | Yes | The "why" of design decisions is independent of code churn |
| API spec | Depends | Needed for public APIs. Internal APIs can be read from code. |
| Descriptive code docs | No | Maintenance can't keep up; agents can read code directly. |
| Design docs | Minimal | Useful for early direction-sharing. Goes stale fast. |

## Team design: Idea person, Runner, Reviewers

Right now it's hard to build a multi-person dev team. Better to eat the pizza yourself. Context sharing with an agent is most efficient as 1:1, and multiple people running agents against the same repo at the same time makes conflicts and cognitive cost explode.

Claude Code now has [git worktree support](https://code.claude.com/docs/en/common-workflows) so parallel agents don't collide, and the experimental [Agent Teams](https://code.claude.com/docs/en/agent-teams) feature lets agents message each other and coordinate. Anthropic's [C compiler experiment](https://www.anthropic.com/engineering/building-c-compiler) had 16 parallel agents produce a 100,000-line compiler in two weeks that successfully built the Linux kernel.

But that was a case where the tasks were cleanly separable (pass individual test cases). That's why parallelism worked. Grasping a whole repo and making judgment calls is still fastest done by one human.

Still, if you had to build a team given the capabilities of today's agents, the ideal composition would be:

### Idea person

Owns requirements and direction. Decides "what to build next" and "what the experience should feel like." Agents are still weak here. Extracting a valuable spec from a vague request is not something current agents can replace.

### Runner

The main developer who owns the dev branch solo and runs alongside a pack of agents. Gives daily direction to the agents, reviews output, and course-corrects. This is the position that matters most right now. You need the technical depth and judgment to evaluate agent output and steer it in the right direction.

### Reviewers

Stack this layer thick. Architect, UI/UX, security, performance — reviewing agent output from each specialty. Hard review is the essential bottleneck, and as agent output grows, the review load grows with it.

| Role | Count | Responsibility |
|---|---|---|
| Idea person | 1 | Requirements, direction, priority |
| Runner | 1 | Dev branch progression, running with agents |
| Reviewer | 3+ | Architect, UI/UX, security etc. specialty review |

Loading up on reviewers is the optimum given current agent capabilities. Agents can write tons of code, but judging whether that code is actually heading in the right direction as a whole requires human specialty.

Whether the Runner role is permanently needed, I genuinely don't know. It's the most needed right now, but as agents become more autonomous the role could disappear. On the other hand, idea injection and reviewer feedback are almost certainly needed for another year or so. What happens in 2-3 years is anyone's guess.

## The risk of full automation

Even with Skills and flows built out, full automation with today's Coding Agents is risky.

As [this VentureBeat article](https://venturebeat.com/ai/why-ai-coding-agents-arent-production-ready-brittle-context-windows-broken) points out, agents still have context brittleness. Context windows are finite, and [Chroma's research](https://factory.ai/news/context-window-problem) shows performance degrading sharply past roughly 130K tokens. Stack information over long sessions and the agent forgets early instructions or loses consistency.

So the realistic design isn't "zero human intervention." It's "minimum cognitive cost, maximum impact." To avoid being yanked around by your Coding Agent, you have to keep thinking about a lot of things. Trust agent output, but verify. Automate what can be automated. Focus on the judgments only humans can make. That's the best play available right now.

## Summary

- Developing alongside Coding Agents has a theoretical ceiling of ~300 commits / 60,000 lines per day. In practice, project "hardness" and human cognitive load are the bottleneck.
- Team design: Idea person + Runner + stacked Reviewers. Going heavy on reviewers is the current optimum.
- Docs: one file (CLAUDE.md) + ADRs. Descriptive code docs are unnecessary. The key to cognitive-load control is building systems that make load time 3 seconds.

## References

- [2026 Agentic Coding Trends Report – Anthropic](https://resources.anthropic.com/2026-agentic-coding-trends-report)
- [Claude Code is the Inflection Point – SemiAnalysis](https://newsletter.semianalysis.com/p/claude-code-is-the-inflection-point)
- [Claude Code Skills – Docs](https://code.claude.com/docs/en/skills)
- [Max plan – Claude Pricing](https://claude.com/pricing/max)
- [ChatGPT Pro – OpenAI](https://openai.com/index/introducing-chatgpt-pro/)
- [Architecture Decision Records](https://adr.github.io/)
- [joelparkerhenderson/architecture-decision-record – GitHub](https://github.com/joelparkerhenderson/architecture-decision-record)
- [Why AI coding agents aren't production-ready – VentureBeat](https://venturebeat.com/ai/why-ai-coding-agents-arent-production-ready-brittle-context-windows-broken)
- [The Context Window Problem – Factory.ai](https://factory.ai/news/context-window-problem)
- [Building a C compiler with a team of parallel Claudes – Anthropic](https://www.anthropic.com/engineering/building-c-compiler)
- [Common workflows – Claude Code Docs](https://code.claude.com/docs/en/common-workflows)
