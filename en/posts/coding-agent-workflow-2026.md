---
title: "A Survey of Development Workflows in the Coding Agent Era"
description: "A comprehensive look at project workflows, implementation techniques, and infrastructure design for the Agentic Engineering era. A follow-up to the previous Harness Engineering article."
date: 2026-03-14
tags: [AI, Claude Code, Codex, Agentic Engineering, Workflow]
author: 逆瀬川ちゃん
lang: en
---

Hi there! This is Sakasegawa-chan ([@gyakuse](https://x.com/gyakuse))!

Today I want to walk through development workflows in the Coding Agent era, covering both the popular practices and the approaches I personally use.

<!--more-->

In the previous article, [Harness Engineering Best Practices for Claude Code / Codex Users, Explained Plainly](/posts/harness-engineering-best-practices-2026/), I focused on Harness Engineering: using deterministic tools like linters, hooks, and test strategy to keep a Coding Agent's output on the rails.

This time I want to answer the next level up: okay, we know what harness is, but how should we run the whole development effort? I'll organize the state of the world as of March 2026 from three angles: how to run projects, techniques for coding with agents, and the infrastructure that supports those. At the end I'll also share my own workflow.

## The big current: Agentic Engineering

Let me start with a concept you can't really avoid when talking about modern Coding Agents.

In February 2025 [Karpathy](https://x.com/karpathy/status/1886192184808149383) proposed Vibe Coding. At that point it was basically "let a Coding Agent write code on vibes", but over the course of a year it matured into a structured engineering methodology, and in February 2026 Karpathy renamed it to Agentic Engineering. The definition is: you don't write code directly, and 99% of your time is spent orchestrating and supervising the agents who do ([The New Stack](https://thenewstack.io/vibe-coding-is-passe/)).

[Addy Osmani](https://addyosmani.com/blog/agentic-engineering/) has been systematizing Agentic Engineering. Successful developers spend 70% of their time on problem definition and verification strategy, and only 30% on execution (the opposite of the traditional split), but total time drops dramatically. In [The Factory Model](https://addyosmani.com/blog/factory-model/) he argues for a mindset shift: from a phase of crafting software by hand, one piece at a time, to a phase of operating an automated assembly line.

[Simon Willison](https://simonwillison.net/2026/Feb/23/agentic-engineering-patterns/) has codified the practical patterns. He lists Red/Green TDD, Writing Code is Cheap Now, First Run the Tests, Linear Walkthroughs, and Hoard Things You Know How to Do.

The Harness Engineering covered in the previous article is the implementation foundation for this Agentic Engineering. This time I want to zoom out a bit and look at how you drive the whole project.

So, to practice Agentic Engineering, you first need to pick a way to run the project.

## How to run projects: four workflows

Here I want to introduce four representative project workflows that have emerged and matured recently. You don't have to commit to just one, they're meant to be combined.

### Brainstorm → Plan → Execute (Harper Reed style)

This is the prototype Coding Agent workflow [Harper Reed](https://harper.blog/2025/02/16/my-llm-codegen-workflow-atm/) proposed and Simon Willison popularized. It's influenced many subsequent methodologies.

The flow is simple and has three stages.

1. Brainstorm: prompt a conversational LLM with *ask me one question at a time*, iteratively dig into the idea, and produce a `spec.md`
2. Plan: pass the `spec.md` to a reasoning model, break it into small steps, and produce `prompt_plan.md` and `todo.md`
3. Execute: feed the generated prompts to Claude Code in order and implement

This is best suited to greenfield personal projects, not team development (Harper acknowledges this himself). Still, it's an important starting point because it established the principle of "don't jump straight to code", which shaped every workflow that followed.

### SDD / AI-DLC (Spec-Driven Development)

This is the workflow that spread fastest between 2025 and 2026. As an antithesis to Vibe Coding, it puts the spec at the source of truth. We're in a boom phase with 30+ competing frameworks.

[Birgitta Boeckeler](https://martinfowler.com/articles/exploring-gen-ai/sdd-3-tools.html) classifies SDD into three levels. The [Thoughtworks Technology Radar](https://www.thoughtworks.com/en-us/radar/techniques/spec-driven-development) rates SDD as Assess.

| Level | Description | Examples |
|---|---|---|
| Spec-first | Spec created before implementation, often discarded after completion | Spec Kit, Kiro |
| Spec-anchored | Spec is kept and updated through the full feature evolution | Kiro (Design Docs) |
| Spec-as-source | Humans only edit the spec; code is generated and never edited | Tessl |

The basic flow is Requirements → Design → Tasks → Implementation. AWS extended this to the team and org scale with [AI-DLC](https://aws.amazon.com/blogs/devops/ai-driven-development-life-cycle/) (AI-Driven Development Life Cycle). It has three phases: Inception (planning) → Construction (development) → Operations, with distinctive pieces like Mob Elaboration (a 4-hour synchronous session that converts business intent into detailed requirements) and Adaptive Workflow (automatically picking stages from a 9-stage menu based on task complexity). The OSS steering rules are public as [aidlc-workflows](https://github.com/awslabs/aidlc-workflows).

There's a proliferation of tools, but here are the notable ones.

| Tool | Stars | Notes |
|---|---|---|
| [GitHub Spec Kit](https://github.com/github/spec-kit) | 76,627 | De facto standard. Supports 22+ agents |
| [BMAD-METHOD](https://github.com/bmad-code-org/BMAD-METHOD) | 40,579 | Multi-agent methodology with 12+ domain-expert roles |
| [OpenSpec](https://github.com/Fission-AI/OpenSpec) | 30,399 | Iterative spec management. Lightweight, strong on brownfield |
| [GSD](https://github.com/gsd-build/get-shit-done) | 29,635 | Meta-prompting. Claude Code centric |
| [cc-sdd](https://github.com/gotalab/cc-sdd) | 2,859 | Kiro-compatible commands. 8 agents, 13 languages |
| [Kiro](https://kiro.dev/) | SaaS | AWS's IDE. EARS-format requirements + Agent Hooks |

Good fit for medium to large team feature development. A key benefit is swapping out micro-approvals during implementation for phase-gate reviews, which fixes approval fatigue.

It also has problems. The spec can drift from the code (the "drowning in a sea of markdown" problem), it's overkill for small bug fixes, and it carries a risk of regression to the old anti-patterns of heavy upfront specs plus big-bang releases. Thoughtworks still rates it as Assess.

### Research → Plan → Implement (structured collaboration)

This is a three-phase workflow [Boris Tane](https://boristane.com/blog/how-i-use-claude-code/) (Cloudflare Engineering Lead) systematized from 9 months of Claude Code use. It converges with [Block's RPI methodology](https://engineering.block.xyz/blog/ai-assisted-development-at-block) and [HumanLayer's FIC](https://github.com/humanlayer/advanced-context-engineering-for-coding-agents).

The core rule is simple: don't let the agent write a single line of code until you've reviewed and approved a detailed written plan.

1. Research: deep reading of the codebase. Use language like `deeply` and `intricacies` to push for thorough investigation, producing `research.md`
2. Plan: create a detailed plan document with code snippets and file paths, producing `plan.md`. Run 1-6 annotation cycles of adding inline notes in a text editor
3. Implement: batch implementation based on the plan, with type-checking running continuously

A big distinguishing feature is running FIC (Frequent Intentional Compaction) at each phase boundary. Keep context utilization at 40-60%. Instead of panic-compacting when you hit 80-100%, compact preventively and often. HumanLayer reports that, on a 300k-LOC Rust codebase, this approach let them complete a week's worth of work in a single day.

Good fit for mid-size teams, quality-focused projects, and large changes to existing codebases.

### Superpowers (encoding methodology)

[obra/superpowers](https://github.com/obra/superpowers) (82,074 stars) is a skill framework and development methodology that got officially adopted into the Claude Code Plugin Marketplace. Its distinguishing feature is that it encodes individual practices like SDD and TDD into a single pipeline and forces the methodology onto the agent.

It's a 7-stage pipeline.

1. Brainstorming: pull requirements interactively. Don't move to code until the user approves
2. Git Worktrees: automatically create isolated development branches and check the test baseline
3. Planning: break approved designs into microtasks (2-5 minutes each), specifying exact file paths, code specs, and validation criteria
4. Execution: dispatch a new subagent per task, with a two-stage review
5. TDD: strictly enforce the RED-GREEN-REFACTOR cycle
6. Code Review: categorize work against the plan by severity
7. Branch Completion: validate the test suite, present a merge/PR

It functions as a guardrail to stop the agent from diving into code without thinking. It's a good fit if you want full-cycle automation that layers TDD, code review, and branch management on top of an SDD-style flow.

### Workflow comparison and how to choose

| Aspect | Harper Reed | SDD / AI-DLC | RPI | Superpowers |
|---|---|---|---|---|
| Focus | Detailed spec generation | Spec-driven impl | Understanding → atomic breakdown | Forced methodology |
| Verification | Human review | Tests, spec conformance | Annotation cycles | TDD + code review |
| Target scale | Greenfield | General | Mid to large (existing code) | General |
| Tool dependency | Low | High (framework required) | Medium (file conventions only) | High (plugin required) |
| Team | Solo | Team | Team | Solo to team |

As a rough guide, pick Harper Reed for greenfield solo projects, SDD for teams that need spec management, RPI for large changes to existing codebases, and Superpowers if you want to automate the whole workflow. Again, you don't have to limit yourself to one.

Okay, so you've picked a workflow. The next question is how to maintain quality during actual coding sessions with the agent.

## Coding with agents: techniques for maintaining quality

From here, let's talk about practices for how to instruct the agent and how to maintain quality during coding sessions. These combine with any of the project workflows above.

### Context Engineering

This is the single most important technique for agent output quality. More than which model you pick, what you show and what you hide from the agent is what determines the result.

The main techniques:

- Context Packing: cram everything the task needs into the context: files, specs, constraints, existing code style. Do a brain dump before coding ([Osmani](https://addyosmani.com/blog/ai-coding-workflow/))
- Progressive Disclosure: put only a 100-token summary in CLAUDE.md / AGENTS.md, and load Skills or rule files dynamically when needed
- Use the filesystem as external memory: save research results and intermediate artifacts to files, keeping only lightweight path references in context
- Manage attention with a todo list: create and update `todo.md` to re-inject goals at the end of the context repeatedly, which counters the "forgot what I was doing" problem in long sessions
- Don't erase failure states: leave error traces and failed actions visible. This prevents the agent from repeating the same mistake

There are anti-patterns too. Loading CLAUDE.md with tons of few-shot examples makes the agent keep imitating patterns and stop thinking. Filling up the context window before you even start working degrades performance due to [Context Rot](#context-rot).

### Context Rot

You can't talk about Context Engineering without running into Context Rot.

Research from [Chroma Research](https://research.trychroma.com/context-rot) and [Morph](https://www.morphllm.com/context-rot) shows that LLM output quality degrades measurably as input context length grows. It's an annoying phenomenon: performance drops continuously long before you hit the token limit. That said, as of March 2026, Claude (Opus 4.6 / Sonnet 4.6) and Codex [support a 1M token context window](https://claude.com/blog/1m-context-ga), and Opus 4.6 hit 78.3% on MRCR v2, the top score among frontier models for long-context retrieval. Context Rot hasn't disappeared, but the practical headroom has expanded significantly.

Practical advice is straightforward.

- Keep sessions short. Treat "one session, one task" as the rule, and start a new session at each phase boundary
- Use subagents aggressively. Delegate research and exploration to isolated contexts so the main context doesn't get polluted (reports show up to 90.2% performance improvement)
- Don't fear compaction. When context piles up, just run `/compact` or let auto-compaction handle it
- Don't load unnecessary files into context. "Just in case" bulk file loading backfires

Conversely, you can actively leverage the 1M context. In Codex, you can [extend to 1M](/posts/gpt-5-4-codex-1m-context/) with the `model_context_window=1000000` setting. On the Claude Code Max plan, Opus 4.6 runs with a 1M context by default. If you don't want that, [disable it](https://code.claude.com/docs/en/model-config#extended-context) with `CLAUDE_CODE_DISABLE_1M_CONTEXT=1`. Whether to keep sessions short or go long depends on the task.

### TDD × Coding Agent

As part of the Context Rot discussion we said to keep sessions short, but to maintain quality in short sessions, tests are indispensable.

The patterns codified in [Tweag's Agentic Coding Handbook](https://tweag.github.io/agentic-coding-handbook/WORKFLOW_TDD/) and by Osmani for TDD × Coding Agent force a Red → Green → Refactor cycle onto the agent. Osmani argues tests are the biggest single differentiator between Agentic Engineering and Vibe Coding.

A typical Agentic TDD flow looks like this.

1. Place `AGENTS.md` and `spec.md` in the repo
2. Generate a TDD plan as a markdown checklist from business rules
3. Red: write one failing test
4. Green: have the agent write the minimum implementation that passes the test
5. Refactor: tell it to clean up the logic while keeping all tests green
6. Move to the next test

On tooling, [tdd-guard](https://github.com/nizos/tdd-guard) (1,811 stars) runs as a Claude Code hook, blocks attempts to skip tests, and explains what to do instead.

The key idea is that tests become the prompt. The test form lets you precisely convey the behavior you expect from the AI. The industry consensus is that this is the most reliable way to ensure quality of agent-generated code.

### Multi-agent division of labor

Once TDD gives you per-task quality, parallelizing across multiple tasks comes into view.

As [Anthropic - Building a C compiler with Claude](https://www.anthropic.com/engineering/building-c-compiler) (16 parallel agents, 100k-line C compiler) showed, complex feature development can parallelize design, implementation, and review across multiple agents. Each agent runs with an independent context window, which avoids context pollution.

A typical agent team is Orchestrator (directs, doesn't write code), Frontend / Backend / Testing (domain specialists), and Reviewer / Security (quality checks).

Each tool implements this differently.

| Tool | Style | Notes |
|---|---|---|
| Claude Code Subagent | Delegation style. Runs with independent context from the parent and returns results | Stable feature. Clean "one task, one subagent" model |
| Claude Code Agent Teams | Coordination style. Two-way communication and shared task list | Experimental (from 2026/02). 3-5 teammates recommended |
| OpenAI Codex | Spawns subagents in parallel. Batch task distribution via CSV possible | Experimental. Each agent isolated in a worktree |
| Cursor | Up to 8 agents in parallel. Mission Control for at-a-glance management | Strength is visual management inside the IDE |

Watch out: when all agents focus on a single change, they risk overwriting each other. The Carlini C compiler project hit this too. In monorepos, a root AGENTS.md should define repo structure, shared rules, and boundaries, with per-app/package AGENTS.md files carrying local context.

### Best-of-N parallel strategy

Multi-agent division runs different tasks in parallel; another strategy runs the same task in parallel. Best-of-N uses LLM nondeterminism as a feature, not a bug.

It's simple: run N agents in parallel on the same spec and prompt (each in its own git worktree), and either pick the best of the N implementations or compose good parts of several.

If each agent has a 25% success rate, four in parallel gives 68% (1 - 0.75^4), eight gives 90%. API cost scales linearly with parallelism, but the absolute cost delta is negligible.

From Carlini's 16-parallel project, a known insight: when tests are independent, parallelization works naturally, but on a single huge task (like compiling the whole Linux kernel), all agents work on the same bug and overwrite each other's changes. The mitigation is mutual exclusion via a text-file-based task lock.

Effective for problems where there isn't a single right answer: architectural decisions, algorithm selection, UI design.

### AI on AI review

Even with multiple candidates from parallel strategies, you need a way to judge which is better. That's where having another AI (or another model) review AI-generated code comes in.

Patterns include model musical chairs (switch models when one gets stuck), cross-review (implement in Claude Code, review in GPT), and layer separation (keep the implementation agent and review agent as separate subagents).

### Failure modes and anti-patterns

Knowing the cases that don't work well is what defines maturity in agent usage. Let me organize both success patterns and failure patterns.

| Failure mode | Symptom | Mitigation |
|---|---|---|
| Hallucination | Calls to APIs or methods that don't exist | Inject up-to-date docs, catch via tests |
| Infinite loop | Same command repeated | ralph-orchestrator's gutter detection, force-terminate via token limit |
| Over-generation | Adds features you didn't ask for | Explicitly limit scope, write prohibitions in AGENTS.md |
| False completion | Declares done even with failing tests | Auto-run tests via PostToolUse hook |
| Agent drift | Confidently violates constraints | Mechanically correct via linters and type checkers |
| Probabilistic cascade | Each step 95% succeeds → 77% over 5 steps | Split tasks smaller, verify each step with tests |

Pay special attention to Comprehension Debt. Research shows developers using AI assistance experience a 17% drop in skill acquisition. Osmani himself describes the experience: "tests passed, glanced over it, merged, three days later I couldn't explain how it works." The 5-7x gap between generation speed and comprehension speed is the root cause of Comprehension Debt.

The countermeasure: have the agent generate a Linear Walkthrough ([Willison](https://simonwillison.net/guides/agentic-engineering-patterns/linear-walkthroughs/)) of the AI-generated code, and reserve time for a human to actually read and understand it. There's an ironic twist here: to stop being the code writer and become the supervisor, reading skill becomes more important, not less.

### Agent-native code design

We've talked about techniques. But before techniques, the design of the codebase itself decisively shapes agent efficiency.

Here are design principles from [Factory.ai's lint rule taxonomy](https://factory.ai/news/using-linters-to-direct-agents) and [every.to's Agent-native architecture guide](https://every.to/guides/agent-native).

- Grep-able naming: enforce named exports, consistent error types. Agents are best at `grep`, `glob`, `cat`, and naming that's searchable is a decisive efficiency factor
- Collocated tests: put tests next to source in `__tests__/`. A consistent `ComponentName.test.tsx` naming lets a single `ls` confirm whether tests exist
- Feature-level modularization: cohere files by feature, not horizontal slice (`Services/`, `Controllers/`, `Models/`). Minimizes directory jumping
- Tests as reward signals: agents judge implementation correctness by tests passing/failing. Code paths without tests are quality-unassured from the agent's perspective
- Clear API boundaries: agreeing interfaces (type definitions, API contracts) between modules upfront is a prerequisite for multi-agent parallel execution

Define the agent's role in both the Inner Loop (compile-test-debug inside the IDE) and the Outer Loop (CI/CD issue → PR → merge), and roll them out incrementally. The recommended order is: establish Inner Loop discipline, then move to Outer Loop governance.

Okay, we've seen the coding techniques. Applying them manually every time isn't realistic. From here let's talk about systems and infrastructure.

## Systems and infrastructure: the foundation for workflows

Environment setup, tool composition, and automation pipelines that make the techniques from the previous section work continuously. Once you set these up, they keep paying off. This is also the implementation layer for Harness Engineering from the previous article.

### Designing CLAUDE.md / AGENTS.md

AGENTS.md, released by OpenAI in August 2025, was transferred to Linux Foundation ([AAIF](https://www.linuxfoundation.org/press/linux-foundation-announces-the-formation-of-the-agentic-ai-foundation)) in December 2025 and became the de facto industry standard. It's adopted in 60,000+ open-source projects. Claude Code, Codex, Cursor, Copilot, Gemini CLI, Windsurf, Aider, and others support it.

CLAUDE.md, AGENTS.md, and SOUL.md are complementary.

| File | Role | Scope |
|---|---|---|
| AGENTS.md | Universal agent brief. What to do | Tool-agnostic |
| CLAUDE.md | Claude Code specific operational instructions | Claude Code specific |
| SOUL.md | Agent personality definition | Optional |

Put shared context in AGENTS.md and Claude-specific instructions in CLAUDE.md.

As a converged design pattern, OpenAI says to treat these as a table of contents, not an encyclopedia. Target size is 60-150 lines. [HumanLayer](https://www.humanlayer.dev/blog/writing-a-good-claude-md) recommends 60 lines or fewer, and [Vercel](https://vercel.com/blog/agents-md-outperforms-skills-in-our-agent-evals) compressed 40KB to 8KB while maintaining a 100% pass rate. The recommended pattern is Progressive Disclosure: put only file pointers in CLAUDE.md, and split details into subfolder CLAUDE.mds, skills, or external docs.

Vercel's Next.js 16 case study is interesting. An 8KB AGENTS.md document index achieved a 100% pass rate, 47 points higher than skills-based retrieval (53%). The reason: passive context (always available) beats on-demand retrieval.

### Agent Skills and the plugins ecosystem

Since Progressive Disclosure came up, let me mention Agent Skills.

Announced by [Anthropic](https://www.anthropic.com/engineering/equipping-agents-for-the-real-world-with-agent-skills) in October 2025 and released as an open standard in December, Agent Skills are an industry standard with 30+ tools officially supporting them. They work in Claude Code / Codex CLI / Gemini CLI / Cursor / GitHub Copilot / Windsurf, etc.

Context efficiency is optimized via three-level loading.

| Level | When loaded | Token cost | Content |
|---|---|---|---|
| L1: Metadata | At startup (always) | ~100 tokens/skill | YAML frontmatter's name + description |
| L2: Instructions | When skill activates | Under 5,000 tokens | SKILL.md body |
| L3: Resources | Only on demand | Effectively unlimited | scripts/, references/, etc. |

When a skill isn't used, you get 98% token reduction. Even installing 10+ skills, only the activated ones consume context.

Note the placement differs per tool.

| Tool | Location | Notes |
|---|---|---|
| Claude Code | `.claude/skills/` / `~/.claude/skills/` | Can be bundled for distribution as Plugins |
| Codex CLI | `.agents/skills/` | Official catalog at [openai/skills](https://github.com/openai/skills) (14,139 stars) |
| Gemini CLI | `.gemini/skills/` / `.agents/skills/` | `activate_skill` tool for autonomous activation |

As a usage guide: compress project conventions and framework knowledge into AGENTS.md for constant loading, and put complex multi-step workflows (TDD, code review, etc.) into skills for on-demand loading.

The ecosystem is scaling fast. [anthropics/skills](https://github.com/anthropics/skills) (92,958 stars), [obra/superpowers](https://github.com/obra/superpowers) (82,111 stars), [ComposioHQ/awesome-claude-skills](https://github.com/ComposioHQ/awesome-claude-skills) (43,816 stars), and [SkillsMP](https://skillsmp.com) (71,000+ skills) form a large ecosystem.

Claude Code's own Plugins bundle Skills, MCP, Slash Commands, and Agents into a single package. The official marketplace ([claude-plugins-official](https://github.com/anthropics/claude-plugins-official), 10,865 stars) hosts 9,000+ plugins.

### Hooks, linters, and deterministic tools

Suppose Agent Skills and AGENTS.md tell the agent what to do. The thing that makes it actually do that is hooks, linters, and deterministic tools. I covered this in detail in the [previous article](/posts/harness-engineering-best-practices-2026/), so here I'll just hit the highlights.

Claude Code Hooks events are as follows.

| Event | Timing |
|---|---|
| PreToolUse | Before a tool call (can block) |
| PostToolUse | After a tool call |
| Stop | When Claude's response completes |
| SessionEnd | When a session ends |
| WorktreeCreate / Remove | When Agent Teams worktrees are created / removed |
| PreCompact / PostCompact | Before / after context compaction |

The basic pattern: run lint → format → typecheck automatically in the PostToolUse hook, inject violations into the agent's context, and drive self-correction.

[OpenAI](https://openai.com/index/harness-engineering/) recommends that custom linters' error messages themselves include what's wrong, why the rule exists, and the specific fix steps. Rules that feel noisy in a human-centric workflow become multipliers for agents.

[Factory.ai's seven-category lint rule taxonomy](https://factory.ai/news/using-linters-to-direct-agents) (Grep-ability, Glob-ability, Architectural Boundaries, Security & Privacy, Testability, Observability, Documentation) is another good reference.

[Nick Tune](https://nick-tune.me/blog/2026-02-28-hook-driven-dev-workflows-with-claude-code/) has an interesting pattern: treat hooks as DDD domain events and design the workflow engine as an aggregate.

### Parallel execution with Git Worktree

The physical foundation for multi-agent division and Best-of-N parallel strategies is Git worktree. Each agent working in an independent worktree enables simultaneous development without file conflicts.

Claude Code has supported this natively since 2026-02-20.

```bash
# Launch Claude Code isolated in a worktree
claude --worktree feature-auth

# Launch in a tmux session (can leave it running)
claude --worktree bugfix-123 --tmux
```

In OpenAI Codex's cloud mode, each task runs in an isolated container with the repo preloaded; in CLI mode, Git-worktree-based parallel execution is available too.

Watch out: if multiple agents edit the same file, you get merge conflicts. Agreeing on shared interfaces (API boundaries, type definitions) upfront is a prerequisite. Also note that worktrees share local DBs, Docker daemons, and caches, so you can get race conditions from simultaneous DB state changes.

### MCP vs CLI + Skills

Let me organize the tool-integration question. MCP is a powerful spec for agents in general, but for Coding Agents the current knowledge is that CLI + Skills is optimal for most use cases, and MCP delivers value under specific conditions.

CLI is preferred because of affinity with LLM training data (`gh`, `git` CLI patterns are baked into weights) and because skills are lightweight. [David Cramer](https://cra.mr/mcp-skills-and-agents/) (Sentry CEO) runs with 2 MCPs always-on plus ~12 skills, and argues most MCP servers don't need to exist.

Because of this trend, there's also a recent pattern of tools that didn't have a CLI getting one built officially by the vendor.

### Orchestration tool landscape

We've covered individual tools. Tools that bundle these and provide parallel execution, task management, and workflow control for Coding Agents are multiplying rapidly too. They split into four types.

Workflow-definition type (defines how the project is run): [everything-claude-code](https://github.com/affaan-m/everything-claude-code) (74,956 stars) and [oh-my-claudecode](https://github.com/Yeachan-Heo/oh-my-claudecode) (9,642 stars).

Agent-management type (parallel execution and task assignment): [Aperant](https://github.com/AndyMik90/Aperant) (13,265 stars), [GasTown](https://github.com/steveyegge/gastown) (12,035 stars, by Steve Yegge), [1code](https://github.com/21st-dev/1code) (5,214 stars), and [agent-orchestrator](https://github.com/ComposioHQ/agent-orchestrator) (4,303 stars).

Process-multiplexer type (launching, monitoring, and switching multiple agents): [Superset IDE](https://github.com/superset-sh/superset) (6,888 stars), [Claude Squad](https://github.com/smtg-ai/claude-squad) (6,338 stars), and [dmux](https://github.com/standardagents/dmux) (1,086 stars).

Role-based type (specialized cognitive modes per development phase): [gstack](https://github.com/garrytan/gstack) (11,379 stars, by Garry Tan). Under the motto "planning is not reviewing, reviewing is not shipping", it offers 8 specialized slash commands for Claude Code (`/plan-ceo-review` for product thinking, `/plan-eng-review` for tech review, `/review` for code review, `/ship` for release, `/qa` for QA testing, `/retro` for retrospectives, etc.), switching a general-purpose assistant into role-specialized modes.

Trend: Coding Agents themselves are starting to bundle multi-agent features, so the process-multiplexer type may become niche over time.

### Long-session design

Since orchestration came up, let me organize the patterns for maintaining consistent progress across multiple context windows. All of them share the principle: keep the context window stateless, use the filesystem and git as persistent storage.

Ralph Loop ([Geoffrey Huntley](https://ghuntley.com/loop/), from 2025/06) is essentially one line.

```bash
while :; do cat PROMPT.md | claude ; done
```

Put your goal spec in `PROMPT.md`; Claude does one iteration of work and commits. When the context fills up or the work finishes, it exits, and the loop auto-starts the next iteration with a fresh context. You structurally avoid Context Rot (every time starts at 0%). Anthropic integrated it as the official `ralph-wiggum` plugin in December 2025.

As an extension, [ralph-orchestrator](https://github.com/mikeyobrien/ralph-orchestrator) (2,175 stars, Rust implementation) adds a Backpressure Gate (can't advance without tests/lint/typecheck passing) and features like warnings at 70k tokens and forced rotation at 80k tokens. [oh-my-claudecode](https://github.com/Yeachan-Heo/oh-my-claudecode)'s Ralph mode offers 32 specialized agents, ultrawork parallel execution (5+ concurrent), and compaction-proof persistent memory via `.omc/notepad.md`.

The Anthropic official dual-agent approach ([claude-quickstarts/autonomous-coding](https://github.com/anthropics/claude-quickstarts), 15,264 stars): an Initializer Agent generates `feature_list.json` (200 features + test cases), and a Coding Agent picks one `"pending"` → implements → tests → updates status to `"passing"` → commits → auto-starts the next session 3 seconds later.

Patterns for passing state between sessions:

| Approach | Use | Source |
|---|---|---|
| `feature_list.json` | Feature list and status management | Anthropic official |
| `progress.md` / `research.md` / `plan.md` | Per-phase artifacts of FIC | HumanLayer |
| `ROTATION-HANDOVER.md` | Structured handover at context rotation | VNX system |
| `.omc/notepad.md` | Persistent memory that compaction can't erase | oh-my-claudecode |
| Git commit messages | Intent of the diff and next action | All patterns |

A complexity spectrum for session design: Ralph bash loop (1 line) → /loop (official) → FIC (method) → Dual Agent (2 agents) → oh-my-claudecode (19 agents), in order of increasing sophistication.

### GitHub Agentic Workflows

Long-session design was about local execution. For incorporating Coding Agents as an extension of CI/CD, there's [GitHub Agentic Workflows](https://github.blog/ai-and-ml/automate-repository-tasks-with-github-agentic-workflows/) (technical preview, February 2026).

Use cases: Continuous Triage (auto-summarize and label new issues), Continuous Documentation (docs that track code changes), Continuous Test Improvement (coverage evaluation and adding high-value tests), Continuous Quality Hygiene (investigating CI failures and proposing fix PRs).

Workflow definitions are in Markdown and compiled to GitHub Actions YAML via `gh aw compile`. safe-outputs strictly restrict the AI's write permissions (read-only access by default), and PRs are not auto-merged. The positioning is: extend CI/CD, don't replace it.

### Security notes

When you give a Coding Agent broad permissions to run autonomously, you need to be aware of [OWASP Top 10 for Agentic Applications](https://genai.owasp.org/resource/owasp-top-10-for-agentic-applications-for-2026/) (2025/12).

Quick summary of what users should watch for:

- Keep permissions minimal. Control tool/command permissions with Claude Code's `--allowedTools` or `.claude/settings.json` permissions
- Verify the provenance of MCP servers. Third-party MCP servers can be a supply-chain attack vector
- Don't put secrets in context. Don't let agents read `.env` or credentials; access them indirectly via MCP servers
- Always review agent-generated code. Avoid auto-merge
- Put guardrails on destructive operations. Block things like `rm -rf` or `git push --force` via Hooks' PreToolUse

### Symphony: issue-driven autonomous orchestration

As a closer for this section, let me introduce the orchestration that operates at the highest abstraction level.

[OpenAI Symphony](https://github.com/openai/symphony) (Experimental / Engineering Preview) has the concept "manage the work that needs doing (issues), not the agents". It raises abstraction to "manage tasks via an issue tracker".

It polls kanban boards like Linear continuously, detects Todo tickets, autonomously moves them to In Progress, and on validation completion moves them to Human Review. It offers physical workspace isolation (auto-generating an independent workspace per task and deploying Codex), policy-as-code via `WORKFLOW.md`, OTP (Elixir) based self-healing and retry, and remote distributed execution to multiple SSH workers.

That said, this is still an experimental prototype. It operates by default without strong guardrails, so the absolute prerequisite for adoption is having Harness Engineering (deterministic tests, linters, CI-based auto-verification from the previous article) properly in place in your codebase.

Alright, that's a tour of the industry. Finally, let me share how I actually do it.

## My own workflow

Across all the workflows above, when I develop something I don't pick just one; I mix patterns as needed.

### Idea-driven development

A workflow where you drop an idea into Linear and development proceeds automatically.

![Idea-driven development board](/img/coding-agent-workflows-2026/idea-driven-board.png)

Pretty similar to Symphony. I get the sense most people are building something like this.

It started from the question: how do I make progress with minimum cognitive debt?

1. User drops an idea
2. Agent turns it into a spec automatically
3. User reviews the spec
4. Agent implements
5. User accepts delivery

That's the flow. The user only gets involved when the agent gets stuck, and reviews are designed to be easy.

The pain point of agent-human collaboration is the human having to constantly watch for agent notifications. It's similar to having to handle phone calls while trying to develop: concentration should not be carved up more than necessary. So a Patrol Agent periodically checks whether sessions have stalled, and batches up notifications to the user at regular intervals. The user watches Slack / Discord and handles things in bursts.

### Automated development

This one's experimental: plan-based automated development. I prepare exhaustive development docs, set up the harness and feedback loop, write tasks into `tasks.jsonl`, and let Claude Code execute automatically. Per task, Claude Code runs Plan mode → auto-approve → implement. A Codex review runs automatically via commit hook.

I recently had an 8-hour automated run go through on this setup.

### What I do before development

Whether idea-driven or fully automated, the initial preparation matters a lot. Quick list of what I do.

- First, context-pack every idea
    - Thoughts in my head, sparks of ideas, literally all of it, write it out
    - Before talking to any agent or LLM, this exhaustive dump is what matters
    - Dialogue produces clean proposal docs and specs, but polished proposals tend to lose the interesting parts
- Dig into the idea via dialogue with an agent
    - Better to do this with a local agent
    - Ideally, create a repository for it
    - Fully separate `research` directory for investigations and `idea` directory for ideas (don't let designs leak into research/)
    - Thoroughly read the generated research and ideas, raise every bit of friction, fix it all (if noise remains at this stage, downstream work breaks easily)
- Convert ideas into specs
    - Transform into `docs` or `docs/adr`
- Structure and place references
    - Place the doc sets you want referenced, with license in mind
    - When developing software that depends on a specific library, the library docs go here too
- Set up guardrails and automatic feedback
    - Set up lint injection via PostToolUse and similar (this harness forces the Coding Agent toward correct implementations)
    - For web app development, I inject `Note: for large changes, please verify with the visual-check skill` when tsx files are edited (this leaves "what counts as large" to the agent, so it's not really recommended; a better approach might be to threshold on changed-line-count and auto-return screenshots to context via a full path)
- Install mechanisms to keep `docs`, `docs/adr`, CLAUDE.md, AGENTS.md healthy
    - Automatic guardrails via Lefthook pre-commit that verify:
        - AGENTS.md doesn't exceed 60 lines
        - Paths inside AGENTS.md / CLAUDE.md actually exist (broken pointer detection)
        - `last-validated` dates in docs/ and ADR aren't too old (warn at 3 days, error at 5 days)
            - This is for the early development period
            - Mechanisms like this give you defense against doc rot. Whether docs should exist in the first place is a separate problem; let's set that aside
        - docs/ / AGENTS.md / CLAUDE.md don't reference superseded ADRs
    - On error, you get a warning that spawns a fix-only subagent to handle it

Don't rush it; experimenting with different patterns is genuinely fun. As you do, your understanding of Coding Agent behavior deepens too.

## Summary

- In 2026 Agentic Engineering is established, and you design development across three layers: project workflows (SDD, RPI, etc.), implementation techniques (Context Engineering, TDD), and infrastructure (AGENTS.md, Skills, Hooks)
- Closing the feedback loop deterministically, inserting humans at structured points, and keeping sessions short are the things that really matter
- Thinking about even more automated flows might be interesting too

## References

### Agentic Engineering
- [Karpathy - Vibe Coding / Agentic Engineering](https://x.com/karpathy/status/1886192184808149383)
- [The New Stack - Vibe Coding is Passé](https://thenewstack.io/vibe-coding-is-passe/)
- [Addy Osmani - Agentic Engineering](https://addyosmani.com/blog/agentic-engineering/)
- [Addy Osmani - The Factory Model](https://addyosmani.com/blog/factory-model/)
- [Simon Willison - Agentic Engineering Patterns](https://simonwillison.net/2026/Feb/23/agentic-engineering-patterns/)

### Project workflows
- [Harper Reed - My LLM codegen workflow atm](https://harper.blog/2025/02/16/my-llm-codegen-workflow-atm/)
- [GitHub Spec Kit](https://github.com/github/spec-kit)
- [Martin Fowler - Understanding SDD](https://martinfowler.com/articles/exploring-gen-ai/sdd-3-tools.html)
- [AWS - AI-Driven Development Life Cycle](https://aws.amazon.com/blogs/devops/ai-driven-development-life-cycle/)
- [awslabs/aidlc-workflows](https://github.com/awslabs/aidlc-workflows)
- [Thoughtworks - SDD Technology Radar](https://www.thoughtworks.com/en-us/radar/techniques/spec-driven-development)
- [Boris Tane - How I Use Claude Code](https://boristane.com/blog/how-i-use-claude-code/)
- [Block - AI-Assisted Development at Block](https://engineering.block.xyz/blog/ai-assisted-development-at-block)
- [HumanLayer - Advanced Context Engineering](https://github.com/humanlayer/advanced-context-engineering-for-coding-agents)
- [obra/superpowers](https://github.com/obra/superpowers)
- [arXiv - Spec-Driven Development Paper](https://arxiv.org/abs/2602.00180)

### Implementation techniques
- [Anthropic - Effective context engineering for AI agents](https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents)
- [Chroma Research - Context Rot](https://research.trychroma.com/context-rot)
- [Morph - What Is Context Rot?](https://www.morphllm.com/context-rot)
- [Tweag Agentic Coding Handbook - TDD](https://tweag.github.io/agentic-coding-handbook/WORKFLOW_TDD/)
- [nizos/tdd-guard](https://github.com/nizos/tdd-guard)
- [Anthropic - Building a C compiler with Claude](https://www.anthropic.com/engineering/building-c-compiler)
- [Addy Osmani - The 80% Problem](https://addyo.substack.com/p/the-80-problem-in-agentic-coding)
- [Addy Osmani - My LLM coding workflow going into 2026](https://addyosmani.com/blog/ai-coding-workflow/)
- [Martin Fowler - Humans and Agents in Software Engineering Loops](https://martinfowler.com/articles/exploring-gen-ai/humans-and-agents.html)
- [every.to - Agent-native Architectures](https://every.to/guides/agent-native)
- [GitHub Blog - How to write a great agents.md](https://github.blog/ai-and-ml/github-copilot/how-to-write-a-great-agents-md-lessons-from-over-2500-repositories/)

### Infrastructure and systems
- [OpenAI - Harness engineering](https://openai.com/index/harness-engineering/)
- [HumanLayer - Writing a Good CLAUDE.md](https://www.humanlayer.dev/blog/writing-a-good-claude-md)
- [Vercel - AGENTS.md Outperforms Skills](https://vercel.com/blog/agents-md-outperforms-skills-in-our-agent-evals)
- [Anthropic - Agent Skills](https://www.anthropic.com/engineering/equipping-agents-for-the-real-world-with-agent-skills)
- [anthropics/skills](https://github.com/anthropics/skills)
- [Claude Code Hooks Guide](https://code.claude.com/docs/en/hooks-guide)
- [Factory.ai - Using Linters to Direct Agents](https://factory.ai/news/using-linters-to-direct-agents)
- [Nick Tune - Hook-driven dev workflows](https://nick-tune.me/blog/2026-02-28-hook-driven-dev-workflows-with-claude-code/)
- [ScaleKit - MCP vs CLI Benchmarking](https://www.scalekit.com/blog/mcp-vs-cli-use)
- [David Cramer - MCP, Skills, and Agents](https://cra.mr/mcp-skills-and-agents/)
- [Context7](https://github.com/upstash/context7)

### Session design and orchestration
- [Geoffrey Huntley - Everything is a Ralph Loop](https://ghuntley.com/loop/)
- [HumanLayer - Brief History of Ralph](https://www.humanlayer.dev/blog/brief-history-of-ralph)
- [ralph-orchestrator](https://github.com/mikeyobrien/ralph-orchestrator)
- [oh-my-claudecode](https://github.com/Yeachan-Heo/oh-my-claudecode)
- [anthropics/claude-quickstarts](https://github.com/anthropics/claude-quickstarts)
- [VNX Context Rotation](https://vincentvandeth.nl/blog/context-rot-claude-code-automatic-rotation)
- [GitHub Blog - Agentic Workflows](https://github.blog/ai-and-ml/automate-repository-tasks-with-github-agentic-workflows/)
- [gh-aw](https://github.com/github/gh-aw)
- [OpenAI Symphony](https://github.com/openai/symphony)
- [garrytan/gstack](https://github.com/garrytan/gstack)

### Security and cost
- [OWASP Top 10 for Agentic Applications](https://genai.owasp.org/resource/owasp-top-10-for-agentic-applications-for-2026/)
- [Claude Code Costs Docs](https://code.claude.com/docs/en/costs)
- [claudefa.st - Model Selection](https://claudefa.st/blog/models/model-selection)
- [DORA Report 2025](https://www.faros.ai/blog/key-takeaways-from-the-dora-report-2025)
- [Linux Foundation - AAIF](https://www.linuxfoundation.org/press/linux-foundation-announces-the-formation-of-the-agentic-ai-foundation)
