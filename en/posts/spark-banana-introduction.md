---
title: "Building a Lightning-Fast UI Tweaking Tool with Codex Spark and nanobanana"
description: "I built spark-banana, a tool that combines Codex Spark (gpt-5.3-codex-spark) and nanobanana (Gemini 3) to let you tweak UI in real time from your browser."
date: 2026-02-27
tags: [spark-banana, Codex Spark, nanobanana, Gemini, UI, React]
author: 逆瀬川ちゃん
lang: en
---

Hi there! This is Sakasegawa-chan ([@gyakuse](https://x.com/gyakuse))!

Today I'd like to introduce [spark-banana](https://github.com/nyosegawa/spark-banana), a tool I built for blazing-fast UI tweaking.

<iframe
  width="100%"
  height="405"
  src="https://www.youtube.com/embed/w0AsZcxdujE"
  title="spark-banana demo"
  frameborder="0"
  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
  allowfullscreen
></iframe>

[Watch on YouTube](https://www.youtube.com/watch?v=w0AsZcxdujE)

<!--more-->

## What is spark-banana?

First, check out the video above. It should give you a general feel for it.

In one sentence: it's a tool where you click on a particular part of the UI and give it an instruction, and the code is immediately modified via the [Codex MCP](https://github.com/openai/codex). On top of that, nanobanana generates design proposals from a screenshot of the selected area, and Codex then reflects the chosen design in the implementation. Handy.

It currently supports Vite and Next.js (React).

The overall structure is simple: just a browser-side overlay (`spark-banana`) and a WebSocket server (`spark-bridge`) that relays to Codex.

```text
Browser (overlay)            Bridge server                  Your codebase
┌───────────────────────┐    ┌────────────────────────┐     ┌───────────────┐
│ Select element/region │───▶│ Prompt + queue + MCP   │────▶│ Files updated │
│ Add instruction       │◀───│ Status/progress over WS│     │ (HMR refresh) │
└───────────────────────┘    └────────────────────────┘     └───────────────┘
```

## Setup

### Prerequisites

You need the Codex CLI installed and authenticated.

```bash
npm install -g @openai/codex
codex
```

### Installing the packages

```bash
npm install -D spark-banana spark-bridge
```

### Starting the bridge server

The bridge server handles the relay between Codex and the browser.

```bash
npx spark-bridge
```

This alone brings up the WebSocket server on the default `ws://localhost:3700`. You can also change the model and port via options.

```bash
npx spark-bridge --port 3700 --model gpt-5.3-codex-spark
```

### Integrating into the frontend

On the app side, you just add one overlay component.

For Vite:

```tsx
import { SparkAnnotation } from 'spark-banana';

<SparkAnnotation projectRoot={import.meta.env.VITE_SPARK_PROJECT_ROOT} />
```

Set this in `.env`:

```bash
VITE_SPARK_PROJECT_ROOT=/absolute/path/to/your/project
```

For Next.js:

```tsx
'use client';
import { SparkAnnotation } from 'spark-banana';

export default function Spark() {
  if (process.env.NODE_ENV !== 'development') return null;
  return <SparkAnnotation projectRoot={process.env.NEXT_PUBLIC_SPARK_PROJECT_ROOT} />;
}
```

Set this in `.env.local`:

```bash
NEXT_PUBLIC_SPARK_PROJECT_ROOT=/absolute/path/to/your/project
```

## How to use it

spark-banana has three modes.

### Spark mode

An element-based editing mode. Enable the floating button, click the element you want to edit, type an instruction, and send. Codex Spark (`gpt-5.3-codex-spark`) running on Cerebras applies the fix at blazing speed. It's great for pinpoint tweaks like "change the color of this button" or "tighten this padding."

### Banana mode

A screenshot-based design proposal mode. Select a region to capture it, and nanobanana proposes three design variations with images attached. Pick the one you like and Codex reflects the implementation to match that design. It works well for larger changes like "change the overall vibe of this area."

### Plan mode

A mode where three approaches can be compared side by side. After selecting an element in Spark mode, switch to Plan mode and Codex generates three different implementation proposals for comparison. Useful when you want to think through the design direction.

In any mode, progress logs are visible in real time, and dangerous command executions go through an approval flow for safety.

## Why I built this

There were three motivations.

1. Technical validation of Codex Spark
2. Streamlining the UI improvement flow using nanobanana
3. I wanted to see the future of UI improvement experiences with Agents

### Technical validation of Codex Spark

[Codex Spark](https://openai.com/index/introducing-gpt-5-3-codex-spark/) (gpt-5.3-codex-spark) runs on the Cerebras Wafer-Scale Engine and puts out a staggering 1,000+ tokens/sec. That's 15x the speed of gpt-5.3-codex. But because it's so fast, it exceeds human cognitive bandwidth, which made it hard to know where to actually use it. LLMs running on Cerebras are, in several senses, too fast for humans.

In fact, when Codex Spark first came out it was much hyped, but only a very small number of people were using it in production. Why is it hard?

I think it's not just that it's too fast — the small Context Window is a bigger deal.

| | gpt-5.3-codex | gpt-5.3-codex-spark |
|---|---|---|
| Context Window | 400K | 128K |
| Speed | ~65-70 tok/s | 1,000+ tok/s |
| Multimodal | Yes | Text only |
| SWE-Bench Pro | 75.1% | 72.8% |
| Complex reasoning | Maintains 12+ steps | Accuracy drops at 6-8 steps |

The gap between 128K and 400K is significant, and [if you read codex-rs's implementation](https://zenn.dev/sakasegawa/articles/65895201c59e44#context-window%E3%81%AE%E5%88%B6%E9%99%90) (this info is a bit dated so keep that in mind), Compaction kicks in once you hit 95% of the Context Window. With 128K you hit that ceiling fairly quickly, so for typical use, default Codex is still the safer bet.

But "fast" also means "can have real-time properties." There has to be a good use for it. You could have Spark do real-time interpretation of information, and it'd be interesting if a real-time conversational Agent had Spark under the hood. This time small UI tweaks had been piling up in my workflow lately and I had a feeling "this is it," so I gave it a try. Pinpoint UI fixes don't run into the Context Window ceiling much, and you get to fully enjoy the speed.

Since OpenAI [publishes an MCP for Codex](https://github.com/openai/codex), you can wire it up with peace of mind. There weren't many examples of this kind of integration, though, so I did check with them officially and also [consulted on the Developer Forum](https://community.openai.com/t/building-a-browser-to-codex-bridge-via-codex-mcp-server-tou-clarification-needed/1375345).

### Streamlining the UI improvement flow using nanobanana

OK, so I talked about Spark mode, but UI improvement had another big pain point. An approach I'd been using a lot lately looked like this.

1. Take a screenshot of the current state (a part or the whole thing)
2. Pass the screenshot to nanobanana and have it produce a few proposals
3. Hand the good one to a Coding Agent to apply

Doing this relay by hand is inefficient, so I wanted to automate it.

Banana mode in spark-banana implements this whole flow end-to-end. Internally it uses [nanobanana](https://ai.google.dev/gemini-api/docs/image-generation) (Gemini API) to generate three design variations in parallel, and the chosen design gets handed to Codex for implementation. [Nano Banana 2](https://blog.google/innovation-and-ai/technology/ai/nano-banana-2/) (Gemini 3.1) came out recently, so generation speed and quality are both very good.

One thing to watch out for: the Spark model can't read nanobanana's proposal images. As shown in the table above, Codex Spark is text-only. So Banana mode hands things off to gpt-5.3-codex when applying. There's also the option of inserting an image→text conversion LLM, but I wanted to pass as much information as possible to the implementation model with minimal loss.

### I wanted to see the future of UI improvement experiences with Agents

Lately there's been an explosion of UI-related tools. Making initial mocks has gotten pretty solid. But ongoing improvements are still hard to do intuitively.

Looking ahead, it's very plausible that users receive information in whatever UI/UX they prefer. With real-time video generation models, UI might all melt into moving images, or it might be expressed in other modalities (AR/VR, etc.). But what's the best experience at this moment? Probably something like "you talk to it and it nicely adapts." Speaking alone doesn't convey everything, so it's nice to be able to point with a mouse or finger. In Iron Man, JARVIS and Tony Stark revised UIs / designs through interactive dialogue — I want to deliver that kind of experience.

This time I built it quickly so it doesn't have native voice support, but if you route it through a dictation interface like the [audio-input](https://github.com/nyosegawa/audio-input) I made recently (these kinds of tools have exploded in number lately), it works pretty nicely. Supporting that kind of voice-conversational experience is on the roadmap.

## Closing

I introduced spark-banana today. I'm sure it's still full of bugs, but if you try it and have thoughts, please let me know at [@gyakuse](https://x.com/gyakuse)!

## References

- [spark-banana Repository](https://github.com/nyosegawa/spark-banana)
- [spark-banana (npm)](https://www.npmjs.com/package/spark-banana)
- [spark-bridge (npm)](https://www.npmjs.com/package/spark-bridge)
- [Introducing GPT-5.3-Codex-Spark | OpenAI](https://openai.com/index/introducing-gpt-5-3-codex-spark/)
- [OpenAI GPT-5.3-Codex-Spark | Cerebras](https://www.cerebras.ai/blog/openai-codexspark)
- [Codex 5.3 vs. Codex Spark: Speed vs. Intelligence](https://www.turingcollege.com/blog/codex-5-3-vs-codex-spark-speed-vs-intelligence)
- [Context Window limits, read from a Coding Agent's implementation](https://zenn.dev/sakasegawa/articles/65895201c59e44)
- [Nano Banana 2 | Google](https://blog.google/innovation-and-ai/technology/ai/nano-banana-2/)
- [Gemini API Image Generation (Nano Banana)](https://ai.google.dev/gemini-api/docs/image-generation)
- [audio-input](https://github.com/nyosegawa/audio-input)
