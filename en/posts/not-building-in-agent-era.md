---
title: "Slowing Down Development in the Coding Agent Era"
description: "Now that Coding Agents can build anything, deciding what not to build is harder than ever. Some thoughts on individual joy vs. organizational discipline, and on how execution got easy while selection got hard."
date: 2026-03-09
tags: [Coding Agent, Product Management, Organization, Essay]
author: 逆瀬川ちゃん
lang: en
---

Hi there! This is Sakasegawa ([@gyakuse](https://x.com/gyakuse))!

Today I want to write about the difficulty of _not_ building, something I've been thinking about lately.

<!--more-->

## Anyone can ship at warp speed now

As I wrote in a [previous post](https://nyosegawa.com/posts/development-and-organization-in-agent-era/), development in the new era produces speed. It varies by industry, type and size of software, but development velocity is categorically different from before. Things that used to take teams months can take shape in days.

This "I can build anything" feeling is, honestly, incredibly fun. You have an idea, hand it to the agent, and a few hours later there's a working thing. Kick something off before bed and it's ready in the morning. You start wanting to build new things constantly.

Lately though, I've been thinking more about what lives on the underside of that fun.

## Humans can't stand idleness

Humans are bad at idleness.

Doing nothing feels like slacking. Watching everyone else ship hard makes you feel like you should be shipping too.

On your own personal project (especially with no users), that's totally fine. It's fun, actually. Build, break, rebuild — the cycle itself is learning, and it's genuinely joyful.

## The story changes at the org level

But in an organizational context, things get thorny.

When every developer's output is amplified by agents, the org's total feature velocity accelerates to an unprecedented pace. The amount of value a customer can actually absorb doesn't change that fast. You end up with more features but no better customer experience — actually a worse experience as complexity piles on.

Release velocity really has gone up. Per Anthropic's [2026 Agentic Coding Trends Report](https://resources.anthropic.com/2026-agentic-coding-trends-report), merged PRs per engineer went up 67% after adopting Claude Code. You can build, and you can ship. The question is whether what you're shipping at that pace is actually useful to customers.

Adding features diligently is meaningless if it doesn't turn into customer value. Infinite feature addition makes the experience noticeably worse. Settings screens balloon, menus grow complex, first-time users can't figure out what to do. This is not an agent-era phenomenon — feature creep is old.

What's new is that opening the faucet (building features) got easy, but closing the faucet (deciding not to build) hasn't really evolved. Only the water pressure jumped by an order of magnitude, and humans haven't caught up. It feels like we're all collectively walking into the feature creep trap.

This article from [Break a Pencil](https://www.breakapencil.com/post/follow-the-money-part-2-ai-makes-it-worse) put the feeling precisely. I especially like this line:

> When addition is nearly free, subtraction looks like laziness.

## All of this was said four years ago

These conversations have been had plenty of times.

Back in 2022, LayerX's [@mosa_siru](https://x.com/mosa_siru) published an internal deck called "[How fast is development speed?](https://speakerdeck.com/layerx/how-fast-is-the-development-speed)" — I love it so much I re-read it roughly every two months, and it feels especially necessary in the current environment.

What does "fast development" actually mean? The deck's answer is: speed of customer value delivery (outcomes), not speed of feature shipping (outputs). Don't build what won't get used. Every built thing becomes debt and slows future development. Don't build exactly what you were told to. Build what solves the customer's real pain.

So why do we need to reconsider something that was this clearly articulated four years ago?

## The water pressure changed

The reason is simple: the pressure on the faucet changed.

In 2022, building one feature took at least several days to a few weeks of engineering effort. That effort itself acted as a filter. "This feature will take two weeks" naturally triggered a debate about whether it was truly needed. The gravity of effort was a brake on casual feature additions.

In 2026, the same feature comes out in a few hours with an agent. Gravity is gone. "Eh, just build it, it's only a few hours" passes. And when that passes over and over, the product gets fat.

## You can't take back a shipped feature

Here's a risk specific to the agent era.

Agents have gotten pretty good at paying back technical debt. Refactoring, adding tests, migrating off old APIs — these are agent strengths. So "build it first, have the agent fix it later" looks reasonable on the surface.

But a feature that's been shipped and picked up by users creates a different kind of debt from tech debt. Users start depending on it. Delete it and users leave. Change it and confusion ensues. It's not rare to delete something you thought nobody was using, only to find it was critical to a specific segment.

Agents can repay tech debt — probably. But they can't repay _user debt_. Code can be rewritten; user expectations cannot.

Development debt is easier to carry now. Which is exactly why I'm more afraid of the debt that comes after you've shipped. A faucet, once open, takes many times the effort to close.

## Go/No-Go judgment is everything

Since development got so fast, I think the decision of _what to build and what not to build_ has become the whole game.

Ideation has an agent as a sparring partner. Implementation is basically handled by the agent. Even review has been agent-ified — Anthropic released [Code Review](https://claude.com/blog/code-review) today, where multiple agents find logic errors, security vulnerabilities and edge cases in parallel before a human sees it. Classic CI/CD handled mechanical checks (format, tests); this one catches bugs with actual semantic understanding of the code. On the security side, tools like [Claude Code Security](https://www.anthropic.com/news/claude-code-security), [Shannon](https://github.com/KeygraphHQ/shannon) and [Strix](https://github.com/usestrix/strix) automatically detect and verify vulnerabilities, so review layers are being agent-ified across the board. (By the way, Claude Code Security's blog lists cost at $15-25 per review. That is, review is structurally multiples more expensive than implementation. Worth thinking about carefully.)

But most orgs haven't yet automated the decision of _whether to build at all_. (I suspect even that will eventually be automated, but let's stay in the March 2026 frame.) Open the faucet too wide here and no matter how great your pipeline is, what comes out the other end is a pile of features with no customer value.

## Not doing things requires effort

Writing all this out, the thing I keep arriving at is: _not doing things takes effort_.

The cost of doing has dropped dramatically. The cost of deciding not to do has not changed. In fact, deciding not to do when you _could_ has gotten harder. Relatively speaking, the cost of the "no" decision has shot up.

The "ruthless no" from mosa-san's deck takes even more resolve in the agent era. It's genuinely painful. Saying "we're not building this" while everyone else ships is scary. But that courage is precisely the condition for keeping the product lean and delivering real value to users.

While the agent is running in the background, pick only the things that are truly necessary. That picking time is probably the highest-value activity right now. Pure efficiency-chasing ends in a bad experience and a mountain of unused features.

Not what to build, but what _not_ to build. Putting time and effort into that judgment. Precisely because the era is fast, there's meaning in pausing.


## References

- [Follow the Money, Part 2: AI Makes It Worse – Break a Pencil](https://www.breakapencil.com/post/follow-the-money-part-2-ai-makes-it-worse)
- [開発速度が速い #とは（LayerX社内資料）– Speaker Deck](https://speakerdeck.com/layerx/how-fast-is-the-development-speed)
- [新しい時代の開発と組織について – nyosegawa.com](https://nyosegawa.com/posts/development-and-organization-in-agent-era/)
- [2026 Agentic Coding Trends Report – Anthropic](https://resources.anthropic.com/2026-agentic-coding-trends-report)
- [Code Review – Anthropic](https://claude.com/blog/code-review)
- [Code Review Documentation – Claude Code](https://code.claude.com/docs/en/code-review)
- [Claude Code Security – Anthropic](https://www.anthropic.com/news/claude-code-security)
- [Shannon – Keygraph](https://github.com/KeygraphHQ/shannon)
- [Strix](https://github.com/usestrix/strix)
