---
title: "Building a Skill for Making Product Promo Videos with Remotion"
description: "Organizing the lessons from producing the spark-banana promo video into a production Skill that works alongside the official Remotion Skill, with a look at the implementation and day-to-day use."
date: 2026-03-02
tags: [Remotion, Agent Skills, Video Production, Claude Code, spark-banana]
author: 逆瀬川ちゃん
lang: en
---

Hi there! This is Sakasegawa-chan ([@gyakuse](https://x.com/gyakuse))!

Today I want to summarize, using the actual production of [spark-banana](https://nyosegawa.com/posts/spark-banana-introduction/) as an example, what I learned about making product promo videos with Remotion and how I packaged that knowledge into a Skill.

<iframe
  width="100%"
  height="405"
  src="https://www.youtube.com/embed/w0AsZcxdujE"
  title="spark-banana teaser"
  frameborder="0"
  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
  allowfullscreen
></iframe>

[Watch on YouTube](https://www.youtube.com/watch?v=w0AsZcxdujE) / [GitHub](https://github.com/nyosegawa/spark-banana)

<!--more-->

## What mattered most

- Don't film the real app; build the video on top of a mock that recreates the app's state transitions
- Use frame screenshots as evaluation input and run a self-improvement loop with a Coding Agent

The official Remotion Skill serves as the foundation underneath these two points, while the production-side judgment calls are packaged into [`remotion-promo-video-factory`](https://github.com/nyosegawa/skills/blob/main/skills/remotion-promo-video-factory/SKILL.md).

## Background: what was painful

Let me first spell out why an additional Skill was needed. The official Remotion Skill is very useful, but it's primarily knowledge about using Remotion correctly.

In product promo video production, though, the bottlenecks are things like:

- What order should things appear in to communicate the point
- How to standardize the editing decisions that fit everything into around 30 seconds
- How to catch scene transition breakage
- At what granularity to run the fix loop

Knowledge of the Remotion API alone doesn't fill these gaps. You need a design for the production flow.

## Premise: why the screen recording flow is painful

Let me lay this out as a premise. The thing that tripped me up first this time wasn't Remotion, it was the screen-recording-based production flow.

With screen recording, the flow usually goes like this:

1. Operate the real app while recording
2. Re-record if you make a mistake
3. Adjust speed and cut in post
4. Add captions and overlays as separate layers
5. When something feels off in the full view, go back to the source material

The reason this style gets painful is that the starting point for every change ends up being in a different place.

- Operation mistakes mean re-recording source material
- Length adjustments happen on the edit timeline
- Caption fixes happen in the design layer
- Transition breakage is hard to see until the final preview

In other words, fixing one thing tends to ripple into other layers, and the unit of change gets large. Even in a 30-second video, the cost of fixes spikes sharply the closer you get to the end.

When you want to densely synchronize UI operations, explanatory text, and visual effects like we do here, iteration under this flow is heavy. So this time I went with the following approach.

- Don't record the real app
- Recreate the UI used in the video as components
- Control state transitions and timing with `props` and `frame`

In this article I'll call this the reimplementation-based approach.

| Axis | Screen recording based | Reimplementation based |
|---|---|---|
| Implementation target | Recorded footage + edit timeline | React components + Remotion timeline |
| Change unit | Tends to ripple across the whole asset | Only the relevant component needs fixing |
| Timing adjustments | Tends to depend on editing software | Unified via `frame` definitions |
| Quality checking | Breakage noticed late in the process | Verified early via still output |

## What I actually did for the spark-banana video

Here's a short summary of the actual production. The video is 1920x1080 / 30fps / about 28.5 seconds, in three scenes: Opening → Demo → CTA.

<iframe
  width="100%"
  height="405"
  src="https://www.youtube.com/embed/w0AsZcxdujE"
  title="spark-banana teaser"
  frameborder="0"
  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
  allowfullscreen
></iframe>

Scenes are connected with `TransitionSeries`, and the length is computed from props.

```tsx
export const getTeaserDuration = (props) =>
  props.openingFrames + props.demoFrames + props.ctaFrames - props.transitionFrames * 2;
```

The inner timeline of the Demo scene is managed with second-based constants.

```ts
const P1 = 2;
const P2O = 8;
const P2 = 10.5;
const P3O = 15;
const P3 = 16.5;
const FIN = 19.5;
const END = 21;
```

Designing it this way means you can shift entire phases by changing a single constant, which makes editing decisions much faster.

## The biggest win was building the app recreation first

This is the core of the approach. Instead of recording real app screens and turning them into footage, I first built components inside Remotion that recreate the app's behavior.

- `MockBrowser`
- `MockPanel`
- `MockFAB`
- `MockCursor`
- `MockPlanVariants`
- `MockBananaModal`

The important thing is not making them merely look similar, but recreating the state transitions the user is supposed to understand. For this video I prioritized recreating the following.

- What happens when you click where
- The wait time and the transition from processing to done
- What comes to the front when modes switch
- What result you end up with

The advantage of this split is that the scene side can focus purely on timing and visual effects. By just passing UI state through props, you can reuse the same directorial patterns easily. And by limiting the recreation target to state transitions, you can keep the implementation scope small while still keeping the demo convincing.


## Let the Coding Agent self-improve using screenshots

This is the second core point. This time I didn't stop at writing code; I ran an improvement loop using frame screenshots as evaluation input.

The flow is:

1. The Agent modifies code
2. Output the key frames with `npx remotion still ... --frame=N`
3. Look at the screenshots and judge layout breakage or legibility issues
4. The Agent fixes only that delta
5. Repeat until it passes

With this approach, fixes are based on per-frame differences rather than subjective impressions. It's especially effective for:

- Ghosting during cross-fades
- Illegible text
- One-pixel gaps at overlay edges
- Misalignment between click positions and UI reactions

In other words, by inserting observable intermediate artifacts into the production flow, the Agent's fix quality becomes stable.

## The gap the official Skill didn't cover

Concretizing the discussion so far, the gap looks like this.

| Area | What the official Remotion Skill is strong at | What the additional production Skill covers |
|---|---|---|
| Implementation | Correct API usage, basic structure | Shot design, phase constants, standardized directorial granularity |
| Animation | Basics of `spring` / `interpolate` | Criteria for which motion to use in which scene |
| Transitions | How to use `TransitionSeries` | Exit control, procedures to avoid cross-fade breakage |
| Verification | render/studio commands | Self-improvement loop using screenshot evaluation as input |
| Reuse | General Remotion knowledge | Templates for arbitrary app promotion |

In short, the official Skill is the implementation foundation, and the additional Skill is the production operating pattern.

## I packaged these two points as a Skill

What I built is [`remotion-promo-video-factory`](https://github.com/nyosegawa/skills/blob/main/skills/remotion-promo-video-factory/SKILL.md). The goal is to make it easy to reproduce the same production quality on arbitrary app promo videos.

This Skill fixes the following.

- Blueprints per app type
- Shot list templates for a 30-second structure
- When to use which motion primitive
- Frame capture procedures
- Execution order for build / gif / quality check

`SKILL.md` is written in English and decoupled from any specific product name. This makes it easier to apply the spark-banana lessons to other projects.

## How this works together with the official Remotion Skill

The role split is explicit.

1. Before implementation, consult the official Skill to lock in Remotion's constraints and recommendations
2. Do the composition and directorial design following the factory Skill's procedure
3. Return to the official Skill during implementation to eliminate API misuse
4. Polish using the factory Skill's QA checklist

Once you assume this back-and-forth, it becomes easier to get both implementation correctness and production reproducibility at the same time.

## Points that make this applicable to arbitrary app promos

To keep this from being a memo specific to one project, I set it up to branch by app type.

- SaaS UI centered: emphasize before/after, operation flow, CTA
- DevTool centered: emphasize the input → execution → result causation
- API/Backend centered: emphasize data flow visualization over screens
- AI feature centered: emphasize how to show the generation process and comparison results

Even with the same 30 seconds, the subject you should foreground is different. Branching here first saves you from starting from zero each time.

## Small implementation rules that paid off during production

Here are some excerpts of the rules I use during production. Each one is mundane, but they all pay off in reproducibility.

- Unify around `useCurrentFrame()` and don't use CSS animation/transition
- Manage time with `sec()` so it survives fps changes
- When using `TransitionSeries`, add exit control at the end of each scene
- For overlays, verify `inset` edge alignment first
- Load fonts at module scope
- Assume the wrapper behavior of `<Sequence>` and position with absolute coordinates

## Deciding the QA loop first makes iteration faster

Finally, operations. It's faster to work off still outputs than to just watch in Studio.

In practice I stick to this fixed loop:

1. Make a fix
2. Output the key frames as still images
3. Check for breakage in the images
4. Fix only the broken parts
5. Final render

Just keeping this order makes the Agent's fixes get evaluated on the same criteria every time, which reduces late-stage rework.

## Summary

- For app promo videos, there are many scenarios where a mock-based approach that recreates state transitions works better than recording the real app
- Using frame screenshots as evaluation input makes a Coding Agent's self-improvement loop work
- It's practical to use the official Remotion Skill as the implementation foundation and split production judgment into a separate Skill

## Appendix: Minimal set of commands

```bash
# Type check
npx tsc --noEmit

# Build
npm run -s build

# Generate GIF (if configured)
npm run -s build:gif

# Frame capture
npx remotion still SparkBananaTeaser /tmp/frame.png --frame=400

# Final render
npx remotion render SparkBananaTeaser out.mp4
```

## Other Remotion examples

I also made a demo video for hiragana ASR using Remotion.

<iframe
  width="100%"
  height="405"
  src="https://www.youtube.com/embed/2VU2mJ6XHTs"
  title="hiragana-asr demo"
  frameborder="0"
  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
  allowfullscreen
></iframe>

[Watch on YouTube](https://www.youtube.com/watch?v=2VU2mJ6XHTs) / [Article](https://nyosegawa.com/posts/hiragana-asr/)

## References

- [spark-banana introduction](https://nyosegawa.com/posts/spark-banana-introduction/)
- [spark-banana Repository](https://github.com/nyosegawa/spark-banana)
- [remotion-promo-video-factory Skill](https://github.com/nyosegawa/skills/tree/main/skills/remotion-promo-video-factory)
- [Remotion Docs](https://www.remotion.dev/docs)
- [Remotion TransitionSeries](https://www.remotion.dev/docs/transitions/transitionseries)
- [Remotion spring()](https://www.remotion.dev/docs/spring)
- [Remotion interpolate()](https://www.remotion.dev/docs/interpolate)
- [Agent Skills](https://agentskills.io/)
- [Agent Skills Specification](https://agentskills.io/specification)
