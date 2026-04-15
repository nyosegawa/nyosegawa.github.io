---
title: "Bundling Applications into Agent Skills"
description: "An implementation pattern for packaging a local-running web app inside an Agent Skill. Thinking about a future where the Agent becomes the platform and apps get embedded into it."
date: 2026-03-26
tags: [Agent Skill, Coding Agent, Generative UI, Claude Code, React]
author: 逆瀬川ちゃん
lang: en
---

Hi there! This is Sakasegawa-chan ([@gyakuse](https://x.com/gyakuse))!

Today I built an implementation that bundles an application into an Agent Skill, so I want to walk through what I built and share some thoughts on a future where the Agent becomes the platform.

<iframe
  width="100%"
  height="405"
  src="https://www.youtube.com/embed/vgw8i9-wUbM"
  title="Intro to Skill Apps"
  frameborder="0"
  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
  allowfullscreen
></iframe>

<!--more-->

## The era of applications with Agents inside

Lately, more and more applications are adding Agent features to themselves.

When I use Coding Agents every day, I often think the reverse would be fine too. It feels more natural to have the Agent call applications from its side. You tell the Agent what you want to do, and the Agent opens the app for you when needed. That experience feels more right to me.

## OpenAI Apps SDK and ChatGPT's Apps

The direction of apps being embedded inside a platform has been around for quite a while. OpenAI recently announced [Apps in ChatGPT](https://openai.com/ja-JP/index/introducing-apps-in-chatgpt/), which are third-party apps that run inside ChatGPT.

The same is happening with MCP. The protocol has been extended as [MCP Apps](https://blog.modelcontextprotocol.io/posts/2026-01-26-mcp-apps/), so tools can now return interactive UI components (dashboards, forms, visualizations) instead of plain text. You can use them across multiple clients like Claude, Goose, VS Code Insiders, and ChatGPT.

One thing I notice from living with Coding Agents day to day is that everyone is starting to build their own tailor-made applications for themselves. CRMs, expense trackers — whatever fits their workflow. Hosting is mostly unnecessary, and having it available locally is often enough.

On the other hand, when you end up building lots of personal apps, you hit problems: "I have no idea where anything lives" and "I don't actually keep using what I made." There's a gap between building and continuing to use, and closing that gap matters a lot.

## Thinking about the spec

Several specs for Agents handling UIs are emerging across the industry.

Google has shipped A2UI as a declarative UI protocol. CopilotKit has built AG-UI for event-driven bidirectional communication. And there are approaches like Claude Artifacts or ChatGPT Canvas that just generate and run code directly.

Roughly organizing them:

| Approach | Examples | How it works | Security |
|---|---|---|---|
| Declarative | A2UI, Flutter GenUI | Describe UI components as JSON | Only trusted catalogs |
| Code execution | Artifacts, Canvas | Generate HTML/CSS/JS and execute | Sandbox isolation |
| Streaming UI | Vercel AI SDK | Stream React Server Components | Framework-dependent |
| Template-based | Adaptive Cards | Bind data to predefined templates | Most restrictive |

A2UI [has v0.8 as Stable and v1.0 slated for Q4 2026](https://a2ui.org/). AG-UI has added thread persistence and multi-agent coordination in [CopilotKit v1.50](https://www.copilotkit.ai/blog/copilotkit-v1-50-release-announcement-whats-new-for-agentic-ui-builders). AWS and Oracle have also [announced support for AG-UI](https://aws.amazon.com/about-aws/whats-new/2026/03/amazon-bedrock-agentcore-runtime-ag-ui-protocol/). This space is moving fast.

That said, what I wanted was something simpler. Just bundle a React app into an existing Agent Skill and let the Agent tell it what to show via SSE.

It feels like an evolution that's needed anyway, as more people start using Coding Agents. I wonder if things like Claude Cowork are heading in this direction.

## What I built

So I put together this pattern where an Agent Skill bundles a local web application.
(I'll open-source the repo someday, once my personal Claude Agent SDK / Codex App Server wrapper SDK stabilizes.)

I went deep on Agent Skills in [a previous post](https://nyosegawa.com/posts/skill-creator-and-orchestration-skill/), so I'll skip the basics here.

One caveat: this is just an experiment. You generally shouldn't embed an app like this into a regular Agent Skill (and it won't work anyway). You need an outer scaffold that can talk to the Coding Agent and render views on demand. Without that scaffold, the safe play for a presentation layer is still spinning up an HTML viewer, like skill-creator or agentic-bench from the previous post.

### Architecture

The overall flow is simple.

```
Coding Agent → curl POST /api/app → API Server (SSE) → Frontend (React)
                 { appId, data }       port 5191          port 5190
```

It's really scrappy. The Agent fires a curl command inside its workflow to tell the app what to show, the API Server broadcasts over SSE to the frontend, and the frontend slides in the matching React component from the right panel.

### Self-contained skill packages

Each skill is self-contained with this structure.

```
skills/<skill-name>/
├── SKILL.md          # Agent Skill definition + app metadata
├── apps/<app>/       # React components, hooks, types
├── data/             # Persisted JSON (auto-generated at runtime)
└── references/       # Supplementary docs
```

App info goes into the SKILL.md frontmatter.

```yaml
---
name: recipe-skill
description: >
  Recipe management skill for searching, adding, editing, and deleting recipes.
  Use when the user says "find a recipe", "today's meal plan", "add a dish",
  "search by ingredients", or "recipe management".
  Ships an embedded web app at apps/recipe-manager/.
metadata:
  has-app: true
  app-id: recipe-manager
  app-name: Recipe Manager
  app-icon: "🍳"
  app-entry: apps/recipe-manager/RecipeApp.tsx
---
```

### Auto-discovery

When you add a new skill, you don't have to touch the host code at all. Discovery is automatic via Vite's `import.meta.glob`.

```typescript
// src/skill-registry.ts
// Metadata: eager (synchronous, for header buttons)
const metaModules = import.meta.glob<{ meta: SkillAppMeta }>(
  "../skills/*/apps/*/meta.ts",
  { eager: true },
);

// Components: lazy (code-split)
const componentModules = import.meta.glob<{
  default: ComponentType<SkillAppProps>;
}>("../skills/*/apps/*/*App.tsx");
```

Drop a folder under `skills/` with a meta.ts and an App.tsx, and it's recognized automatically. It works well as a plugin architecture.

![App Directory](/img/skill-with-app/app-directory.png)

![Chat + AppPanel](/img/skill-with-app/chat-with-recipe.png)

### Current skills

As an experiment I built about 13 skills. I ran them in parallel so it only took 10 minutes. Incredible times. They're not deeply polished, of course.

| Skill | Purpose |
|---|---|
| recipe-skill | Recipe management (search, add, ingredient match, cooking mode) |
| expense-skill | Expense tracking (receipt OCR, photo storage, dashboard) |
| weather-skill | Weather display (shows real data fetched by the Agent) |
| crm-skill | Customer management, deal pipeline |
| ats-skill | Hiring management, candidate pipeline |
| project-skill | Project management, task tracking |
| accounting-skill | Accounting, journal entries |
| invoice-skill | Invoices and quotes |
| competitor-skill | Competitive analysis, positioning map |
| seo-skill | SEO analysis, keyword research |
| sns-skill | Social media operations, post management |
| lp-skill | Landing page creation, A/B testing |
| contract-skill | Contract management, risk analysis |

## The Agent-App symbiosis model

These skills are built on the following separation-of-concerns philosophy.

| Responsibility | Agent | App |
|---|---|---|
| Fetch/process data | Web search, API calls, file I/O, inference | Doesn't do it |
| Generate insights | Recommendations, analysis, scoring | Doesn't do it |
| Display | Doesn't do it | Lists, charts, dashboards |
| Interact | Doesn't do it | Approve/reject, edit/delete, filter |

For the recipe skill, the Agent finds a recipe via web search, structures the ingredients and steps into the RecipeDraft format, and sends it to the app with `POST /api/app`. The app renders a clean discovery card with a "Save" button. The human looks at it and decides.

For expense tracking, the Agent reads the receipt image with OCR, extracts amount and date, and hands it to the app. For weather, the Agent fetches the data, decides on outfit advice and whether you'll need an umbrella, and the app displays it as a dashboard.

![Expense dashboard](/img/skill-with-app/expense-tracker.png)

![Weather dashboard](/img/skill-with-app/weather-dashboard.png)

## What Skill Apps are good at (and their limits)

### The upsides

A few things make this feel good.

First, portability. Just copy the skill folder and you can move it to another environment. Put it in a git repo and sharing is easy too.

Second, it's not disposable. Things built with Claude Artifacts or ChatGPT Canvas are handy within that session, but hard to reuse later. Skill Apps live on the filesystem permanently, so you can use them as many times as you want.

No hosting required, which is nice. Everything runs locally.

Also, you can tell the Coding Agent "change the stages of this CRM pipeline" and it happens instantly. The code is right there, so anything goes.

| Aspect | Skill Apps | Cloud SaaS | Artifacts/Canvas |
|---|---|---|---|
| Hosting | Local | Cloud | Platformer |
| Portability | Folder copy | Account-bound | Platform-bound |
| Customization | Edit code directly | Settings screen | Regenerate via prompt |
| Persistence | JSON files | DB-backed | Managed by platformer |
| Multi-device | No | Yes | Yes |

![CRM pipeline](/img/skill-with-app/crm-pipeline.png)

![ATS candidate management](/img/skill-with-app/ats-manager.png)

### The limits

On the flip side, there are plenty of limits.

- No persistence guarantees. Since it's JSON files, backups are on the user
- No multi-device sync. You can't use it from your phone
- Hard to share data with a team, even for things you'd want to use as a team
- Built carelessly, the offline experience is weak
- No testing or CI/CD story yet
- If the user isn't an engineer, the bar for customization is still high

That said, I think services and mechanisms that address these limits will emerge. Managed persistence, testing infrastructure for skills, customization UIs aimed at non-engineers. There's likely business opportunity in this area.

It's also plausible that existing SaaS companies start offering Agent-internal app versions of their services. If a CRM company ships a Skill App version, users can naturally use the CRM inside their Agent, and the vendor can still guarantee backend APIs, persistence, and compliance. A world where web apps and Agent-internal apps coexist.

## The pain of building applications

Even when anyone can build an app, the legal pain doesn't disappear.

Say you built an expense app. There's the question of whether it complies with Japan's Electronic Books Maintenance Act. If you're only storing expense data in JSON files, it's hard to meet the legal requirements (timestamps, searchability, tamper resistance).

If you handle customer or candidate data in CRM or ATS apps, Japan's Personal Information Protection Act comes into play. Accounting skills require care with financial regulations.

Thinking through all of this is genuinely hard. Let's keep at it.

## Marketplace and security

If you want skills to circulate as a public good, you need both a marketplace and security infrastructure.

Here's the real-world problem. Snyk's February 2026 [ToxicSkills](https://snyk.io/blog/toxicskills-malicious-ai-agent-skills-clawhub/) research found some kind of security issue in roughly 36% of free skills on ClawHub. They reported a case where a malicious skill was executed about 3,900 times over six days.

Academic work is catching up too. There's a paper that [analyzed 98,380 skills and identified 157 malicious ones](https://arxiv.org/abs/2602.06547). Attack patterns are diverse: data exfiltration, privilege escalation, prompt injection, and more.

How to build a secure marketplace is an important question. A few directions come to mind.

One is the trusted-component catalog model, which is what A2UI takes. Limit the UI components an agent can use to a pre-vetted catalog. Expressiveness is restricted, but security is high.

Another is a package-manager model like npm or Homebrew. Combine code signing, review processes, and automated scanning. It's not perfect, but it's a system that can run as an ecosystem.

The [AAIF (Agentic AI Foundation)](https://aaif.io/) was formed under the Linux Foundation, with Anthropic, OpenAI, Block, AWS, Microsoft, Google, and others participating. In February 2026, [97 new members joined](https://www.linuxfoundation.org/press/agentic-ai-foundation-welcomes-97-new-members), expanding to 146 organizations. Through standardizing protocols like MCP and A2A, they're working toward a security foundation for the whole ecosystem.

I think this kind of standardization and community maturity will become the foundation for a safe skill marketplace.

## The experience beyond

Finally, a bit about what lies further ahead.

What kind of experiences will we see once the protocol stack being built today (MCP, A2A, AG-UI/A2UI, WebMCP) matures?

The experience where an Agent generates a just-right UI for each person via A2UI is already coming into view. The skill apps I'm manually building with skill-with-app today might be dynamically generated by Agents based on context in the future.

Beyond that, there might be a world where Agents place UIs in AR/VR space. Meta has [released an MCP server](https://developers.meta.com/horizon/documentation/unity/ts-mqdh-mcp/) for Horizon OS. DeepMind's [Genie 3](https://deepmind.google/blog/genie-3-a-new-frontier-for-world-models/) generates 3D worlds from text in real time. Meta's [V-JEPA 2](https://ai.meta.com/research/vjepa/), as a world model, learns from video and enables robot control in unseen environments. Real-time video generation approaches might be another path too.

Personally, I'd love a world where the AI assistant layer sits at the very top, with a field of applications arrayed below, and the Assistant invokes the right app via the Agent at arbitrary moments — utterances, biorhythms, time of day, whatever. That's what I want to build.

## Summary

- The paradigm of "Agent as platform, apps embedded into it" grew naturally out of daily Coding Agent usage, and the implementation turned out to be surprisingly practical
- skill-with-app is a self-contained package of "SKILL.md + apps/ + data/". You can add skills without changing any host code, and it combines portability with reusability
- There are real challenges around persistence, legal regulation, and security, but protocol standardization and ecosystem building are progressing. Including SaaS companies shipping Agent-internal app versions, this kind of experience is likely to spread

## Appendix

## Revisiting what I built (added 2026/03/29)

The post above carried a lot of implicit assumptions and skipped quite a few logical steps. It ended up pretty hard to follow. So here's a cleaner, bullet-form recap of the motivation and what I did.

- What did I build?
    - A mechanism for bundling an application into an Agent Skill
    - Specifically, bundled as a React component
    - There are three parties: a GUI app wrapping the Coding Agent, the Coding Agent itself, and the Skill App. The GUI app is implemented as a wrapper around the Codex App Server
    - The skills are symlinked into `.codex/skills`
    - When you say "show me the contract list", the Agent Skill loads, the workflow runs, and it hands the component and data for rendering the contract-list view to the wrapper GUI via curl
        - The wrapper GUI doesn't have to know about the skill's apps. It just exposes an API that displays a view when hit
- This Skill App approach came out of a few tensions
    - Agents and applications feel distant
        - When you center your life around the Coding Agent, applications are distant in several ways
        - They're experientially distant, and even physically distant. Even local apps feel far away
        - I don't want to open apps manually. I wanted an experience where I only look at one general-purpose app that runs the Coding Agent in the background
    - Making Agent and application too close is also hard
        - Of course there's the idea of switching views based on the shape of the output
            - That's what Manus and others do. If it's a slide, this view. If it's a spreadsheet, that view
            - It's routing based on output shape, which obviously has limits
        - Or the idea of handling every user request in a sub-application as much as possible
            - That's what I was building before
            - The AI Agent holds various applications in its context, and based on user intent it dispatches requests to the application layer
            - For example, for weather it would nicely render in a weather application
            - Here too, where to route and how to keep it coupled with the Agent and extensible were hard
        - So I felt a need for something more extensible
    - We're in an era where individuals build lots of apps, but using them afterward is hard
        - Building a lot is fine, but actually using them is a hassle. Launching them one by one is a pain. It's sad to stop using the apps you built for yourself
        - The era of slow production is over. The era where consumption is the bottleneck is beginning
        - Mass production creates cognitive issues. I often forget which repo has what I built
        - From these dynamics, the motivation to put apps closer to where I already spend my time grows stronger
    - I wanted to think about the next-generation experience
        - Thinking about the future, a UI tailored to each person would be great
        - But generating it from scratch every time is still expensive, and A2UI-style JSON approaches have some customization limits
        - Also, generating completely from zero every time feels a bit off. Some kind of templating is fine
    - Just shipping HTML or a full-package app also feels like a slightly different experience
        - skill-creator and my agentic-bench are exactly this: the idea of spinning up HTML to review the intermediate or final output of an Agent Skill is common
            - But this stays as a viewer
        - Bundling a full-package app is actually interesting and would plug right into existing Coding Agents
            - But this time I took a different approach
- Retelling what I built with these motivations in mind
    - Skill Apps are bundled with the Agent Skill, so they're close, but not too close
    - If you take the Coding Agent wrapper GUI as the user's center of gravity, all operations flow from there
        - You can chat with the Agent, change the UI, have the Coding Agent do research and update data
        - If you add a button to launch apps in the GUI, you can also just use the app standalone
        - When you want to know the weather, you have two choices: say (or type) "tell me the weather", or pick the weather app from the sidebar
    - Modifications are easy too. Just say "I want it to look like this"
- Weaknesses of what I built
    - Lots of weaknesses. Apps are brittle and the idea is still unrefined. MCP Apps and similar are more polished
- One more warning
    - This setup requires you to run Codex App Server, Claude Agent SDK, or any Agent behind the scenes, and have a frontend app ready to display things
    - I don't think people should build "my-own-style" skills like this casually. Extending specs ad hoc leads to sadness. I'm positioning this as an experiment for thinking about the future

## References

- Product
  - [Introducing Apps in ChatGPT](https://openai.com/ja-JP/index/introducing-apps-in-chatgpt/)
  - [MCP Apps - Model Context Protocol Blog](https://blog.modelcontextprotocol.io/posts/2026-01-26-mcp-apps/)
  - [CopilotKit v1.50](https://www.copilotkit.ai/blog/copilotkit-v1-50-release-announcement-whats-new-for-agentic-ui-builders)
  - [Vercel AI SDK 6](https://vercel.com/blog/ai-sdk-6)
- Protocol
  - [A2UI](https://a2ui.org/)
  - [AG-UI Protocol](https://github.com/ag-ui-protocol/ag-ui)
  - [WebMCP](https://webmcp.link/)
  - [AAIF](https://aaif.io/)
  - [AAIF 97 New Members](https://www.linuxfoundation.org/press/agentic-ai-foundation-welcomes-97-new-members)
  - [AWS Bedrock AgentCore AG-UI support](https://aws.amazon.com/about-aws/whats-new/2026/03/amazon-bedrock-agentcore-runtime-ag-ui-protocol/)
- Security
  - [ToxicSkills - Snyk](https://snyk.io/blog/toxicskills-malicious-ai-agent-skills-clawhub/)
  - [Malicious Agent Skills in the Wild](https://arxiv.org/abs/2602.06547)
- Future
  - [Meta Horizon OS MCP Server](https://developers.meta.com/horizon/documentation/unity/ts-mqdh-mcp/)
  - [Genie 3 - Google DeepMind](https://deepmind.google/blog/genie-3-a-new-frontier-for-world-models/)
  - [V-JEPA 2 - Meta AI](https://ai.meta.com/research/vjepa/)
  - [Sora Shutdown - TechCrunch](https://techcrunch.com/2026/03/24/openais-sora-was-the-creepiest-app-on-your-phone-now-its-shutting-down/)
  - [Generative Augmented Reality](https://arxiv.org/abs/2511.16783)
- Implementation
  - [Agent Skill walkthrough](https://nyosegawa.com/posts/skill-creator-and-orchestration-skill/)
