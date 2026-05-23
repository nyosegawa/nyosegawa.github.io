---
title: "Evaluating Antigravity Gemini 3.5 Flash and Cursor Composer 2.5 on HarnessBench"
description: "I added Antigravity / Gemini 3.5 Flash (High), Cursor / Composer 2.5 fast, and Cursor / Composer 2.5 normal to HarnessBench and compare them against the existing 14 conditions."
date: 2026-05-24
tags: [HarnessBench, Coding Agent, Antigravity, Cursor, Gemini, Composer]
author: 逆瀬川ちゃん
lang: en
image: /og/en/harness-bench-antigravity-composer-25.jpg
---

Hi there! This is Sakasegawa-chan ([@gyakuse](https://x.com/gyakuse))!

Today I want to look at a supplemental HarnessBench run for Antigravity / Gemini 3.5 Flash (High) and Cursor / Composer 2.5 fast / normal, compared against the existing Codex / Claude Code / Cursor conditions.

<!--more-->

## What I Evaluated

In the previous [HarnessBench post](/en/posts/harness-bench/), I compared Codex CLI, Claude Code, and Cursor Agent on the same 27 real-repository debugging tasks.

This time I added three supplemental conditions:

| Harness | Model | Effort / mode |
|---|---|---|
| Antigravity CLI | Gemini 3.5 Flash | high |
| Cursor Agent | Composer 2.5 | fast |
| Cursor Agent | Composer 2.5 | normal |

The task set is unchanged: 9 real OSS repositories, with low / mid / high tasks for each repository, for 27 tasks total. A run passes only when both the core and regression hidden tests pass.

The supplemental experiment ID is `antigravity-cursor-composer-2.5-20260522T052522Z`. I merged the results into the same charts and condition table on the [HarnessBench result page](/harness-bench/).

## Results

First, here are the three added conditions by themselves:

| Condition | Pass | Pass rate | Median time | Low | Mid | High | Timeout |
|---|---:|---:|---:|---:|---:|---:|---:|
| Cursor / Composer 2.5 / fast | 19/27 | 70.4% | 7.5 min | 9/9 | 5/9 | 5/9 | 0 |
| Cursor / Composer 2.5 / normal | 18/27 | 66.7% | 8.1 min | 9/9 | 5/9 | 4/9 | 0 |
| Antigravity / Gemini 3.5 Flash / high | 17/27 | 63.0% | 14.3 min | 8/9 | 5/9 | 4/9 | 1 |

When placed next to the existing 14 conditions, the top of the ranking does not change. The strongest observed condition is still Codex / GPT-5.5 / xhigh at 22/27. Cursor / GPT-5.5 medium, Cursor / GPT-5.5 high, Codex / GPT-5.5 medium, and Cursor / Opus 4.7 max follow at 21/27.

Composer 2.5 fast is 19/27. It does not reach the top group, but it ties Codex / GPT-5.5 high and improves over Composer 2 fast, which was 17/27. Composer 2.5 normal is 18/27, the same pass count as Composer 2 normal.

Antigravity / Gemini 3.5 Flash (High) is 17/27. That ties Claude Code / Opus 4.7 max and Cursor / Composer 2 fast, putting it in the lower group among the 17 displayed conditions.

## Position Against Existing Conditions

By pass count, the added conditions sit roughly here:

| Condition | Pass | Median time | Reading |
|---|---:|---:|---|
| Codex / GPT-5.5 / xhigh | 22/27 | 10.2 min | top observed condition |
| Cursor / GPT-5.5 / medium | 21/27 | 4.7 min | strong speed/accuracy balance |
| Cursor / GPT-5.5 / high | 21/27 | 6.2 min | top group |
| Cursor / Opus 4.7 / max | 21/27 | 19.7 min | high pass count, slow |
| Cursor / Composer 2.5 fast | 19/27 | 7.5 min | upper-middle, improved over Composer 2 fast |
| Codex / GPT-5.5 / high | 19/27 | 9.0 min | same pass count as Composer 2.5 fast |
| Cursor / Composer 2.5 normal | 18/27 | 8.1 min | same pass count as Composer 2 normal |
| Cursor / Composer 2 fast | 17/27 | 3.6 min | fast, but lower pass count |
| Antigravity / Gemini 3.5 Flash high | 17/27 | 14.3 min | lower pass count and relatively slow |
| Claude Code / Opus 4.7 max | 17/27 | 15.1 min | same pass count as Antigravity |

With only 27 tasks, I would not overread the difference between 19/27 and 21/27. Still, Composer 2.5 fast looks better than Composer 2 fast on this task set.

Cursor / GPT-5.5 medium remains a very strong point of comparison: 21/27 with a 4.7-minute median. Composer 2.5 fast is 19/27 with a 7.5-minute median, so in this run Cursor / GPT-5.5 medium is better on both pass count and runtime.

## How I Read Composer 2.5

In the official run, Cursor / Composer 2 fast solved 17/27, and Cursor / Composer 2 normal solved 18/27. In this supplemental run, Composer 2.5 fast solved 19/27, while Composer 2.5 normal solved 18/27.

| Condition | Pass | Median time |
|---|---:|---:|
| Cursor / Composer 2 fast | 17/27 | 3.6 min |
| Cursor / Composer 2 normal | 18/27 | 5.3 min |
| Cursor / Composer 2.5 fast | 19/27 | 7.5 min |
| Cursor / Composer 2.5 normal | 18/27 | 8.1 min |

Composer 2.5 fast passed two more tasks than Composer 2 fast, but it was also slower. Composer 2.5 normal matched Composer 2 normal on pass count and was slower.

So my read is: Composer 2.5 fast improved over Composer 2 fast, but it does not replace the strongest Cursor GPT-5.5 conditions in this benchmark. Cursor / GPT-5.5 medium and high still look stronger in this 27-task run.

## Interpretation

My conservative read is:

- Cursor / Composer 2.5 fast reached 19/27, tying Codex / GPT-5.5 high
- Composer 2.5 fast improved over Composer 2 fast by two tasks, while median time increased from 3.6 to 7.5 minutes
- Cursor / Composer 2.5 normal reached 18/27, the same as Composer 2 normal
- Antigravity / Gemini 3.5 Flash (High) reached 17/27, placing it in the lower group among the 17 conditions
- The top remains Codex / GPT-5.5 xhigh at 22/27, followed by Cursor / GPT-5.5 medium/high and Cursor / Opus max at 21/27
- With only 27 tasks, small success-rate differences should be treated as directional rather than definitive

In short, Composer 2.5 fast looks like an improvement over Composer 2 fast, but not a new top-tier condition on HarnessBench. Antigravity / Gemini 3.5 Flash (High) did not show a clear advantage in either pass count or runtime in this run.

## Summary

- I added Antigravity / Gemini 3.5 Flash (High), Cursor / Composer 2.5 fast, and Cursor / Composer 2.5 normal to HarnessBench
- Across the 17 displayed conditions, the top remains Codex / GPT-5.5 / xhigh at 22/27
- Cursor / Composer 2.5 fast reached 19/27, improving over Composer 2 fast but falling short of Cursor GPT-5.5 medium/high
- Cursor / Composer 2.5 normal reached 18/27, matching Composer 2 normal
- Antigravity / Gemini 3.5 Flash (High) reached 17/27, placing it in the lower group in this comparison
- At 27 tasks, the broad groups are more meaningful than fine-grained rankings

## References

- [HarnessBench result page](/harness-bench/)
- [Previous HarnessBench post](/en/posts/harness-bench/)
- [HarnessBench GitHub repository](https://github.com/nyosegawa/harness-bench)
- [Antigravity CLI overview](https://www.antigravity.google/docs/cli-overview)
- [Antigravity CLI getting started](https://www.antigravity.google/docs/cli-getting-started)
