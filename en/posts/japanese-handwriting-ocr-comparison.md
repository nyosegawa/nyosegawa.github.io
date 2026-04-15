---
title: "Hunting for an OCR That Can Transcribe Japanese Handwriting: I Tried 23 Models"
description: "Digitizing handwritten notes is painful, so I compared 23 models from Claude, Gemini, GPT through HunyuanOCR and Nemotron OCR v2 across three metrics. Conclusion: Gemini 3.1 Pro wins."
date: 2026-03-17
tags: [OCR, AI, Modal, 手書き, 評価]
author: 逆瀬川ちゃん
lang: en
---

Hi there! This is Sakasegawa-chan ([@gyakuse](https://x.com/gyakuse))!

Today I want to write up a comparison I did, hunting for an OCR that can transcribe Japanese handwritten notes nicely — I went through 23 models head-to-head.

<!--more-->

## Handwritten notes are fun to write, but painful to digitize

I still write handwritten notes all the time. Quick scribbles during meetings, sketching diagrams while organizing ideas, that kind of thing. Thinking while moving your hand is fun, and it expands your thinking in a different way than typing does.

The problem, though, is digitization. Transcribing a notebook into Slack or Notion later is just brutal. Reading my own handwriting is already painful enough — having to retype it on top of that is double the suffering.

I want to automate this with OCR, but Japanese handwritten characters are a pretty hard task for existing OCR models. Printed text is high-accuracy across the board, but the moment it's handwriting, accuracy nosedives. And lately the number of OCR-specialized models has exploded — [HunyuanOCR](https://github.com/Tencent-Hunyuan/HunyuanOCR), [DeepSeek-OCR](https://arxiv.org/abs/2510.18234), [olmOCR-2](https://huggingface.co/allenai/olmOCR-2-7B-1025-FP8), [Chandra](https://github.com/datalab-to/chandra)... I genuinely don't know which one to use. General-purpose VLMs like Claude, Gemini, and GPT are also rapidly getting better at OCR; recent posts on the [LayerX tech blog](https://tech.layerx.co.jp/entry/2025/12/01/161913) and [GENSHI AI's evaluation article](https://genshi.ai/articles/ocr-evaluation) cover this too.

So I figured: let's just try them all and compare.

## How I compared them

To compare properly, you have to decide *how* to measure first. Handwritten notes often have ambiguous reading order (mixed vertical/horizontal writing, arrow references, circled annotations…), so a plain CER (Character Error Rate) score will give you a catastrophic number just because the order is different.

So I used three complementary metrics.

| Metric | In a nutshell | Main use |
|------|---------------|---------|
| Hungarian NLS (primary) | Score by best match per region | Order-agnostic, captures essential accuracy |
| Bag-of-Characters F1 | Compare as character multisets, ignoring order | Pure character recognition accuracy |
| CER | Levenshtein distance over the full text | Overall quality including reading order |

The primary metric, Hungarian NLS, holds the ground truth as a list of regions and finds the best match for each region. Details are in [Appendix: evaluation metric design](#appendix-evaluation-metric-design).

For creating the ground truth, I built my own annotation tool. When you upload an image, a rough preprocessing pass runs (paper detection, deskew, shadow removal) before you get to the annotation screen. The preprocessing logic isn't well validated, so I can't promise its accuracy — it's "better than nothing" tier. Details in [Appendix: image preprocessing](#appendix-image-preprocessing).

This time I evaluated on 6 handwritten note images (small, but I wanted to see the trend first). The evaluation harness code is available at [ocr-comparison](https://github.com/nyosegawa/ocr-comparison).

## The 23 models in the comparison

I compared 10 models accessible via API and 13 OSS models running on a GPU.

For the OSS models, I'm running them on [Modal](https://modal.com), a serverless GPU platform. With a single Python decorator you can use T4, L4, A100, etc., so you can evaluate even without a local GPU.

| Category | Model | License | Notes |
|----------|--------|-----------|------|
| API | Gemini 3.1 Pro Preview | Proprietary | Deep thinking |
| API | Gemini 3 Flash Preview | Proprietary | |
| API | Gemini 3.1 Flash Lite Preview | Proprietary | |
| API | Claude 4.6 Opus | Proprietary | Adaptive thinking |
| API | Claude 4.5 Sonnet | Proprietary | Extended thinking |
| API | GPT-5.4 | Proprietary | Reasoning effort: high |
| API | Google Cloud Vision | Proprietary | |
| API | Azure AI Vision | Proprietary | |
| API | [Mistral OCR](https://docs.mistral.ai/capabilities/document/) | Proprietary | mistral-ocr-latest |
| API | [Qwen VL OCR](https://www.alibabacloud.com/help/en/model-studio/qwen-vl-ocr) | Proprietary | DashScope API |
| Modal (L4) | [HunyuanOCR](https://huggingface.co/tencent/HunyuanOCR) | Apache-2.0 | 1B |
| Modal (L4) | [DeepSeek-OCR](https://huggingface.co/deepseek-ai/DeepSeek-OCR) | MIT | |
| Modal (A100) | [Chandra](https://pypi.org/project/chandra-ocr/) | Apache-2.0 | |
| Modal (L4) | [Nanonets-OCR-s](https://huggingface.co/nanonets/Nanonets-OCR-s) | Apache-2.0 | 4B |
| Modal (L4) | [olmOCR-2](https://huggingface.co/allenai/olmOCR-2-7B-1025-FP8) | Apache-2.0 | 7B FP8 |
| Modal (T4) | [GOT-OCR 2.0](https://huggingface.co/stepfun-ai/GOT-OCR2_0) | Apache-2.0 | |
| Modal (T4) | [PaddleOCR](https://github.com/PaddlePaddle/PaddleOCR) | Apache-2.0 | |
| Modal (T4) | [YomiToku](https://github.com/kotaro-kinoshita/yomitoku) | CC-BY-NC-SA-4.0 | Japanese-specialized |
| Modal (T4) | [GLM-OCR](https://huggingface.co/zai-org/GLM-OCR) | MIT | 0.9B |
| Modal (CPU) | [NDLOCR-Lite](https://github.com/ndl-lab/ndlocr-lite) | CC-BY-4.0 | National Diet Library |
| Modal (A10G) | [NDLOCR v2](https://github.com/ndl-lab/ndlocr_cli) | CC-BY-4.0 | National Diet Library |
| Modal (L4) | [Sarashina2.2-OCR](https://huggingface.co/sbintuitions/sarashina2.2-ocr) | MIT | 3B, Japanese print specialized |
| Modal (L4) | [Nemotron OCR v2](https://huggingface.co/nvidia/nemotron-ocr-v2) | NVIDIA Open Model License | 84M, traditional pipeline |

Of these, DeepSeek-OCR and GOT-OCR 2.0 don't support Japanese, and Nanonets-OCR-s is officially stated to be untrained on handwriting. olmOCR-2 is also officially focused on English PDFs and doesn't claim Japanese support. I see their names in OCR benchmarks frequently though, so I threw them all in just to see. What happened when I unreasonably asked them to handle Japanese is below.

YomiToku is CC-BY-NC-SA-4.0, so be careful for commercial use. The other OSS models are Apache-2.0 or MIT, so they're fine for commercial use.

## Results

Evaluation results on 6 handwritten note images (sorted by Hungarian NLS descending).

| Rank | Model | Category | NLS | BoC-F1 | CER | Avg Time |
|------|--------|----------|-----|--------|-----|----------|
| 1 | Gemini 3.1 Pro Preview | API | 0.924 | 0.929 | 0.205 | 67.9s |
| 2 | Gemini 3 Flash Preview | API | 0.918 | 0.910 | 0.221 | 18.7s |
| 3 | Gemini 3.1 Flash Lite Preview | API | 0.899 | 0.917 | 0.207 | 13.7s |
| 4 | Claude 4.6 Opus | API | 0.897 | 0.896 | 0.225 | 74.9s |
| 5 | Azure AI Vision | API | 0.830 | 0.845 | 0.332 | 4.2s |
| 6 | Google Cloud Vision | API | 0.820 | 0.783 | 0.509 | 2.2s |
| 7 | YomiToku | Modal | 0.770 | 0.768 | 0.400 | 12.0s |
| 8 | GLM-OCR | Modal | 0.738 | 0.792 | 0.387 | 29.7s |
| 9 | Chandra | Modal | 0.734 | 0.780 | 0.361 | 29.2s |
| 10 | olmOCR-2 | Modal | 0.723 | 0.786 | 0.370 | 45.4s |
| 11 | Sarashina2.2-OCR | Modal | 0.718 | 0.727 | 0.450 | 24.7s |
| 12 | GPT-5.4 | API | 0.714 | 0.814 | 0.331 | 123.4s |
| 13 | Qwen VL OCR | API | 0.706 | 0.713 | 0.491 | 17.7s |
| 14 | HunyuanOCR | Modal | 0.698 | 0.754 | 0.367 | 30.3s |
| 15 | Claude 4.5 Sonnet | API | 0.640 | 0.709 | 0.465 | 16.4s |
| 16 | Mistral OCR | API | 0.589 | 0.645 | 0.563 | 7.3s |
| 17 | Nanonets-OCR-s | Modal | 0.557 | 0.597 | 0.615 | 69.1s |
| 18 | DeepSeek-OCR | Modal | 0.446 | 0.530 | 0.671 | 35.4s |
| 19 | Nemotron OCR v2 | Modal | 0.413 | 0.562 | 0.705 | 13.0s |
| 20 | PaddleOCR | Modal | 0.353 | 0.394 | 0.784 | 12.8s |
| 21 | NDLOCR-Lite | Modal | 0.271 | 0.394 | 0.915 | 10.5s |
| 22 | GOT-OCR 2.0 | Modal | 0.194 | 0.250 | 0.888 | 10.2s |
| 23 | NDLOCR v2 | Modal | 0.064 | 0.087 | 0.958 | 28.7s |

Avg Time is the average processing time per image. For Modal models I divided the total batch processing time by the number of images, so note that this includes cold-start time.

### Gemini is strong

The biggest surprise was the consistent strength of the Gemini family. Gemini 3.1 Pro Preview takes #1 with NLS 0.924, and even Flash Lite (the lightest model) hits NLS 0.899 — on par with Claude 4.6 Opus. For Japanese handwriting OCR, Gemini is a head above the rest.

Claude 4.6 Opus comes in 4th at NLS 0.897. That's plenty high, but it's interesting that Claude 4.5 Sonnet drops all the way to 12th (NLS 0.640). Even within the Claude family, there's a big gap between model generations.

### GPT-5.4 is surprisingly low

GPT-5.4 lands at 10th (NLS 0.714) — surprisingly weak among the API models. It's a strong model on English OCR benchmarks, but it struggles with Japanese handwritten notes. BoC-F1 is on the higher side at 0.814 while NLS is 0.714, which suggests it can read the characters themselves but loses points on region matching.

### Among OSS models, YomiToku puts up a fight

Among OSS models, YomiToku (#7, NLS 0.770) is on top. Its Japanese-specialized design pays off. Chandra (#8) also holds its own with NLS 0.734.

PaddleOCR and the NDLOCR family really struggle on handwriting, on the other hand. NDLOCR v2, published by Japan's National Diet Library, is strong on printed-type documents but handwritten notes are out of its wheelhouse.

### The reactions of the "no way they'd handle this" models are interesting

So as I mentioned, I unreasonably threw Japanese handwriting at models that don't support Japanese or aren't trained on handwriting. Each of their reactions was interesting in its own way — let me share.

olmOCR-2 is focused on English PDFs and doesn't claim Japanese support. But when I opened the lid, NLS 0.723 — beating out GPT-5.4 (0.714) and landing at 9th. The base model is Qwen2.5-VL, so its multilingual capability is presumably so high that even after English-focused tuning it can still read Japanese handwriting. The raw power of VLMs is scary. While Chandra needs an A100, olmOCR-2 runs on an L4, so it's also strong on cost-performance.

DeepSeek-OCR doesn't support Japanese, but instead of just erroring out it characteristically "translates" the handwritten Japanese into Chinese and outputs that. "SDKを" becomes "SD卡" (Chinese for "SD card"), "permission mode auto対応" becomes "自动权限模式". It looks at handwritten Japanese it can't read, infers from context, and outputs in its native language — a VLM-specific kind of hallucination.

GOT-OCR 2.0 is an extremely lightweight 580M-parameter model that supports only English and Chinese. The result on Japanese handwriting was NLS 0.194; from the logs, it picks up only digits and a few alphanumerics, producing things like `Cadi g/ Agent Bif f Application y`. For unsupported languages, it acts close to a traditional OCR — grabbing only symbols and numbers.

Nanonets-OCR-s is officially stated to be untrained on handwriting. When I showed it handwritten notes, on a few images it panicked and fell into a generation loop, spitting out thousands of meaningless characters like `> > > > > >` or `1111...`. On one image the character error rate (CER) hit an absurd 2100% (21x). I worked around it by raising repetition_penalty, but it was a moment that exposed the brittleness of VLMs against out-of-distribution inputs.

### Speed vs. accuracy tradeoff

Looking at Avg Time, an interesting trend appears. Google Cloud Vision is 2.2s and Azure AI Vision is 4.2s — dedicated OCR APIs really are fast. Their accuracy at NLS 0.82–0.83 is also good enough that if you prioritize speed, these two are very much viable options.

Gemini 3.1 Flash Lite hits NLS 0.899 in 13.7s. In terms of accuracy/speed balance, this might actually be the best model. Pro takes 67.9s, so Flash Lite is 5x faster, but the accuracy gap is only NLS 0.024.

GPT-5.4 is overwhelmingly slow at 123.4s. With reasoning effort: high it's expected, but spending that long to land at NLS 0.714 isn't a great cost-performance picture.

Among OSS models, YomiToku at 12.0s is one of the fastest *and* tops its bracket on accuracy (NLS 0.770), so it has the trifecta of speed, accuracy, and cost. And note that this includes Modal cold-start time — in an always-on environment it would be even faster.

### Looking at actual outputs

Numbers alone aren't very intuitive, so I've put the actual handwritten note images and each model's output in [Appendix: per-image OCR output samples](#appendix-per-image-ocr-output-samples).

## Conclusion: for transcribing handwritten notes, use Gemini

If accuracy is the top priority, Gemini 3.1 Pro Preview (NLS 0.924, 67.9s) is the best choice right now. NLS 0.924 is at the "mostly readable" level — there are a few read errors, but it's plenty usable for rough digitization.

For practical use, though, Gemini 3.1 Flash Lite Preview (NLS 0.899, 13.7s) might be the better balance. The accuracy gap is just 0.025 and it's 5x faster.

If speed is the priority, Google Cloud Vision (NLS 0.820, 2.2s) and Azure AI Vision (NLS 0.830, 4.2s) become viable. They're less accurate than the top-tier models, but realistic when you want to chew through lots of notes.

If you want to run an OSS model locally, YomiToku (NLS 0.770, 12.0s) hits the trifecta of accuracy, speed, and cost.

One caveat: this evaluation only covers 6 handwritten note images, so the rankings could shift with more images. The evaluation harness is [open source](https://github.com/nyosegawa/ocr-comparison), so trying it on your own notes is the most reliable approach.

## Summary

- I went hunting for OCR models that work on Japanese handwritten notes and compared 23 of them
- Gemini 3.1 Pro Preview (NLS 0.924) achieves the highest accuracy, with Flash Lite essentially matching it
- Among OSS models, YomiToku (NLS 0.770) holds its own
- The evaluation code is published at [ocr-comparison](https://github.com/nyosegawa/ocr-comparison)

## Update (2026-03-17): added GLM-OCR, now 19 models

After publishing, I noticed I'd forgotten [GLM-OCR](https://huggingface.co/zai-org/GLM-OCR), so I added it (the count was 19 at the time, currently 20).

GLM-OCR is an extremely lightweight model: CogViT (0.4B) + GLM-0.5B for a total of 0.9B parameters. It posts a #1 score on [OmniDocBench V1.5](https://arxiv.org/abs/2412.07626). vLLM didn't support the `glm_ocr` architecture yet, so I'm running inference directly through a transformers source build.

The result: NLS 0.738, ranking #8. For a 0.9B model, that's quite impressive. It runs on a T4 GPU, so Modal costs are cheap, and getting nearly the same accuracy as Chandra (NLS 0.734) — which needs an A100 — on a T4 is great cost-performance.

Lining up the OSS model parameter counts: olmOCR-2 at 7B, Nanonets at 4B, HunyuanOCR at 1B, GLM-OCR at 0.9B is the lightweight end. Hitting NLS 0.738 there is genuinely high parameter efficiency.

Looking at the outputs, "比較" sometimes becomes "比较" (Simplified Chinese), and it shows similar Chinese leakage to DeepSeek-OCR. The base GLM model is strong on Chinese, so it apparently outputs Japanese kanji as Simplified Chinese characters at times. On the other hand, mixed-English passages like "Agent skill が Web App を wrap" come through reasonably well — for a 0.9B model, it's putting in serious work.

The results table and model list above have been updated.

## Update (2026-03-18): added Mistral OCR, now 20 models

I added Mistral's dedicated OCR API ([mistral-ocr-latest](https://docs.mistral.ai/capabilities/document/)). I'm using the dedicated OCR endpoint, not the VLM chat API.

Result: NLS 0.589, ranked #14. Below Claude 4.5 Sonnet (0.640), above Nanonets-OCR-s (0.557). As a dedicated OCR API, it lags well behind Google Cloud Vision (0.820) and Azure AI Vision (0.830).

Looking at the outputs, on Japanese handwriting it tends to mix in Traditional Chinese characters. "仕様書の腐敗について" becomes "代理人 → 國際計算機", "リアルタイム対話" becomes "1910914 科法", and so on — similar pattern to DeepSeek-OCR (Simplified Chinese leakage) and GLM-OCR (Simplified Chinese leakage), but Mistral's case is distinctive in that Traditional Chinese comes out. On the English side, things like `Coding Agent`, `SDK`, and `Harmony` are picked up almost accurately.

Average processing time is 7.3s per image, fast for an API model — third behind Google Cloud Vision (2.2s) and Azure (4.2s). However, 503 errors are frequent enough that without retries, 2–4 of the 6 images would sometimes fail.

The results table and model list above have been updated.

## Update (2026-03-18): added Qwen VL OCR, now 21 models

I added [Qwen VL OCR](https://www.alibabacloud.com/help/en/model-studio/qwen-vl-ocr) provided through Alibaba Cloud's DashScope API. It's not a VLM chat API but a dedicated OCR model, called via DashScope's OpenAI-compatible endpoint.

Result: NLS 0.706, ranked #12. Almost level with GPT-5.4 (0.714), and narrowly above HunyuanOCR (0.698).

Looking at outputs, on sample 1 it turns "仕様書の腐敗について" into "仕様書の商談について" and "うまくいかん" into "31Cへ" — it has trouble with cursive Japanese handwriting. On sample 2, however, it largely captures the structure correctly with "Agent skill を Web App に wrap する", and it's reasonably stable on mixed-English passages.

Average processing time is 17.7s per image — comparable to Claude 4.5 Sonnet (16.4s) among API models.

The results table and model list above have been updated.

## Update (2026-03-31): added Sarashina2.2-OCR, now 22 models

I added SB Intuitions' [Sarashina2.2-OCR](https://huggingface.co/sbintuitions/sarashina2.2-ocr). It's a Japanese-specialized VLM OCR model based on SigLIP2 + Sarashina2.2-3B-Instruct, with 3B parameters.

Result: NLS 0.718, ranked #11. Just below olmOCR-2 (0.723) and almost level with GPT-5.4 (0.714).

This model is designed assuming Markdown-structured output. It uses headers (`#`), bold (`**`), and lists (`-`) to reproduce document structure, so it suits use cases where you want to ingest handwritten notes as structured documents. The evaluation metrics here are plain-text-based, so honestly this Markdown output works against it. An evaluation that takes advantage of the structured output might give it a higher score.

By the way, the model card's recommended `repetition_penalty=1.2` triggered a loop on some images where the model endlessly generated a numerical countdown (120→0). Bumping `repetition_penalty=1.3` resolved the loop and stabilized output across all images, with BoC-F1 jumping from 0.623 to 0.727. Generation parameter tuning matters quite a bit for VLM-based OCR models.

The results table and model list above have been updated.

## Update (2026-04-02): added Nemotron OCR v2, now 23 models

I added NVIDIA's [Nemotron OCR v2](https://huggingface.co/nvidia/nemotron-ocr-v2). Of everything compared this round, this is the only non-VLM model. It's a traditional 3-stage pipeline of RegNetX detector + Transformer recognizer + relational model, totaling 84M parameters — the smallest. It runs without a text prompt, just the image.

There are two variants, v2_english and v2_multilingual; v2_multilingual supports English, Chinese, Japanese, Korean, and Russian. Since the model card explicitly mentions Japanese support, I used v2_multilingual. It has a 14,244-character set and does line-level recognition.

Result: NLS 0.413, ranked #19. Below DeepSeek-OCR (0.446), above PaddleOCR (0.353). Even though it claims Japanese support, the design is for printed/typed documents, so handwriting is again out of scope.

Looking at outputs, date patterns (`3/11`, `3/13`, `3/15`) and English words (`Harmony`, `ASR`, `VSR`) come through to a degree, and the detector itself is clearly working. On the other hand, Japanese handwritten characters often come out as Simplified Chinese ("投资家", "绝", etc.) — similar trend to DeepSeek-OCR's Chinese leakage. Since Chinese is part of the multilingual character set, ambiguous handwriting probably gets pushed toward the Chinese side.

Compared to PaddleOCR (NLS 0.353), which uses the same traditional pipeline approach, Nemotron is higher, with BoC-F1 also showing a real character-recognition gap (0.562 vs 0.394). For 84M parameters, this is a notable result — it'd be interesting to also evaluate it on printed-text documents.

The results table and model list above have been updated.

## Appendix: per-image OCR output samples

Here I line up the actual handwritten note images and each model's OCR output. You can clearly see what each model is good and bad at.

### Sample 1: tech notes (short bullet list)

![Sample 1](/img/japanese-handwriting-ocr-comparison/sample1.jpg)

Ground truth:

```
CodingAgent時代のApplication考
麻雀AIをCodingAgentで
VSR → うまくいかん
仕様書の腐敗について
```

#### Gemini family

Gemini 3.1 Pro Preview (NLS=0.890)
```
・ Coding Agent 時代の Application/S
・ 麻雀 AI を Coding Agent で
・ VSR -> 外でいかん
- 仕様書の腐敗について.
```

Gemini 3 Flash Preview (NLS=0.840)
```
Coding Agent 時代の Application/s
麻雀 AI を Coding Agent で
VSR -> 外でかく
仕様書の腐敗について.
```

Gemini 3.1 Flash Lite Preview (NLS=0.865)
```
・CodingAgent時代のApplication/s
・麻雀AIをCodingAgentで
・VSR→外注とか
・仕様書の腐敗について
```

#### Claude family

Claude 4.6 Opus (NLS=0.890)
```
· Coding Agent 時代の Applications
· 麻雀 AI を Coding Agent で
　, USR → みていかん
· 仕様書の腐敗について。
```

Claude 4.5 Sonnet (NLS=0.656)
```
CodingAgent の Applications
麻雀 A I と CodingAgent で
VSR -> 外に出る
仕事, 商談について
```

#### OpenAI

GPT-5.4 (NLS=0.589)
```
CodingAgent with Applications
麻雀 AIと CodingAgentで
VSR -> みじかく
仕事を簡略化って?
```

#### Google Cloud Vision / Azure

Google Cloud Vision (NLS=0.782)
```
Coding Agent mit Application's
麻雀
AI & Coding Agent
VSRろぐかん
仕様の腐敗について
で
```

Azure AI Vision (NLS=0.807)
```
Coding Agent af Applications
麻雀AL CodingAgentで
USR →引くいかん
仕様書の肩題について
```

#### Mistral / Qwen

Mistral OCR (NLS=0.488)
```
Coding Agent with Applications
麻雀 AI & Coding Agent
VSR → 計算機
代理人 → 國際計算機
```

Qwen VL OCR (NLS=0.747)
```
、CodingAgent は代わり Application's
、麻雀 AI と CodingAgent で
、VSR → 31C へ
→ 仕様書の商談について
```

#### OSS models (Modal GPU)

HunyuanOCR (NLS=0.636)
```
CodingAgent 時代の Applications
麻雀 AI と CodingAgent の
VSR → 3 人が 1 人
任務者の腐敗の 2 人
```

Chandra (NLS=0.722)
```
・ Coding Agent の Application/S
・ 麻雀 AI と Coding Agent で
・ VSR -> 31C がん
・ 仕様書の修正についと
```

olmOCR-2 (NLS=0.681)
```
・ CodingAgent 以外の Application/s
・ 麻雀 AI と CodingAgent で
・ VSR → 31C が人
・ 任課者の発表について
```

YomiToku (NLS=0.608)
```
S/mairmoi day 6 yha zuag (aipe).
、麻雀AZをCodingAgutで
VSR →31C、かん
、仕様もの周防について
```

GLM-OCR (NLS=0.690)
```
、Coding Agent 時代のApplication
、麻雀 AIをCoding Agentで
、VSR、トリックが人
、任作きの商談について。
```

Sarashina2.2-OCR (NLS=0.663)
```
CodingAgent refのApplications
- 麻雀AIをCodingAgentで
    - USRスクリプトから
    - 信頼性の評価について.
```

DeepSeek-OCR (NLS=0.468)
```
CodingAgent 应用 Application's
  麻省 A2z CodingAgent
  VSR -> 31C -> 7C
  在线考，有改 -> 7C
```

GOT-OCR 2.0 (NLS=0.220)
```
Cadi g/ Agent Bif f Application y
```

Nemotron OCR v2 (NLS=0.307)
```
•CodigAAgent iitt Appplicatiinns
。
-VSR.-3-346、
-
```

PaddleOCR (NLS=0.000)
```
X
享
E
はトイ
```

NDLOCR v2 (NLS=0.010)
```
Ta
〓
〓〓
〓
```

The "VSR → うまくいかん" line is interesting — almost every model misreads it. Even Gemini Pro produces "外でいかん", GPT-5.4 says "みじかく", HunyuanOCR says "3 人が 1 人", and DeepSeek-OCR even mixes in Chinese. Heavily cursive sections of handwriting really are hard.

On the other hand, "仕様書の腐敗について" is read almost perfectly by the top models, so it's surprising to see GPT-5.4 and Claude 4.5 Sonnet land on completely different content like "仕事を簡略化って?" or "仕事, 商談について".

### Sample 2: tech notes (English mixed in)

![Sample 2](/img/japanese-handwriting-ocr-comparison/sample2.jpg)

Ground truth:

```
permission mode auto対応
作り直すのもありかも
SDKを
比較したい
HarmonyとSDKを渡して
AgentSkillがWebAppをwrapするべきか
webAppがAgentをwrapするべきか
(及びSkill)
```

#### Gemini family

Gemini 3.1 Pro Preview (NLS=0.833)
```
・permission mode auto 化
・作りかたのわかりやすさ
　↳ SDKで
比較したい。
Harmony と SDK を通して。
Agent skill が Web App を wrap するべきか
Web App が Agent を wrap するべき
　(Agent skill)
```

Gemini 3 Flash Preview (NLS=0.823)
```
permission mode auto 以外
作りながら切りだす
↳ SDKを
比較したい…
Harmony と SDK を並べて、
Agent skill が Web App を wrap するべきか
web App が Agent を wrap するべきか
(Agent skill)
```

Gemini 3.1 Flash Lite Preview (NLS=0.811)
```
permission mode auto みたいな
作り方のちがいとか
↓ SDK
比較したい
Harmony と SDK を抜いて
Agent skill が Web App を wrap するのか
Web App が Agent を wrap するのか
(Agent Skill)
```

#### Claude family

Claude 4.6 Opus (NLS=0.833)
```
・permission mode auto対応
・割り方のとりまとめ。
　→ SDKを。
比較したい。
Harmony と SDK を抜いて。
Agent skill が Web App を wrap するのか
Web App が Agent を wrap するのなら
（及びskill）
```

Claude 4.5 Sonnet (NLS=0.633)
```
paralyzion mode auto 4k
/1140/10/24/3'4
⊂ SDK
etkizh...
Harmony と SDK を抜いて
Agent stall & Web App を wrap したい
Web App が Agent を wrap (7/22名
(AgShell)
```

#### OpenAI

GPT-5.4 (NLS=0.624)
```
permission mode auto化
権限まわりとか
↳ SDKを
etc etc...
Harmony と SDK を使って。
Agent skill が Web App を wrap するだけ
Web App が Agent を wrap するなら
(API Shield)
```

#### Google Cloud Vision / Azure

Google Cloud Vision (NLS=0.699)
```
pernission mode
auto kitin
作物ものもありかも
SDKE
ettech...
HarmonyとSDKを渡して、
Agent stall & Web App & wrap 18-246'
Web App 6° Agent & wrap 17-925-
(Ari Skild)
```

Azure AI Vision (NLS=0.669)
```
permission mode auto .
倒なものもありがと
→ SDKE
比較したい、
HarmonyとCDKを渡して、
Ageat full of Web App 2 wrap is it!
Web App t" Agail & wrap 11 22.6
(Anislil)
```

#### Mistral / Qwen

Mistral OCR (NLS=0.519)
```
poralysion mode auto kth
1994/1995/1996
→ SDK
elkcon.
Harmony × SDK × 3kcc
Aged Skill 5 Web App 2 wrap 11 725
Web App 5 Agenc × wrap 11 725
(42 Skill)
```

Qwen VL OCR (NLS=0.665)
```
permission mode auto kit
倒物の skill skill サイズ
SDK
比較して...
Harmony x SDK を使って
Agent skill を Web App に wrap する
Web App で Agent skill を wrap する
(Agentskill)
```

#### OSS models (Modal GPU)

HunyuanOCR (NLS=0.695)
```
・permission mode auto kill
・倒すのがやすい
・＜SDK＞
・比較したい
・HarmonyとCDKを使う
・Agent skill とWeb App をwrap 行う
・Web App とAgent をwrap 行う
・（Agent skill）
```

GLM-OCR (NLS=0.666)
```
permission mode auto talk
徘行の比較式。
→ SDKを。
比较。
HarmonyとSDKを接って。

Agent skill 6 Web Appを wrap 13 でか
Web App 6 Agentを wrap 11 でか
(Agent skill)
```

Chandra (NLS=0.693)
```
permission mode auto kill
例のインテリゲンス
↳ SDK
比較した...
Harmony & SDK と比較して...
Agent Skill は Web App と wrap する
Web App は Agent と wrap する
(AniSkill)
```

olmOCR-2 (NLS=0.767)
```
・permission mode auto
・例物のおります。
　→ SDK
・比較した。
Harmony と SDK を渡して。
Agent Skill が Web App と wrap に渡す
Web App が Agent と wrap に渡す
(外部Skill)
```

YomiToku (NLS=0.626)
```
perallsilon mode auto khi.
1.4/14761.4/13/ .
3/45 m
比較したい.
Marmony と SDKを推して、
Ageal skall 6' Wob App ? wrap li t'b'
Web App bi Ageil e wrap Ti 325
(Azislall)
```

Sarashina2.2-OCR (NLS=0.686)
```
permission mode auto kill
- 1945のctrl + c, | SDKe
接続したい...
HarmonyとSDKを渡して...
Agent skill b→Web App z wrap 1326b
Web app b→Agent e wrap Tl78a (zuiSkill)
```

DeepSeek-OCR (NLS=0.503)
```
permission mode auto 优先
  自动权限模式
   SD卡
   etc...
   Harmony 和 SDK 接口
   Agent shell 6 Web App 2 wrap 11.2.6
   Web App 6 Agent 2 wrap 11.2.6
   (A2shell)
```

GOT-OCR 2.0 (NLS=0.140)
```
per a is ton model eau to Hi
```

Nemotron OCR v2 (NLS=0.299)
```
LokS
etteci..
Harmony - spK   iu .
Appar delllo  wb  Appp  waa p ttttt
web App on Agene   wrap 11 222
by
(AriShidd)
```

PaddleOCR (NLS=0.083)
```
S
i
```

This is handwritten text mixing English and Japanese, with code terminology like `AgentSkillがWebAppをwrapするべきか`. Gemini Pro and Claude Opus get it almost exactly right with "Agent skill が Web App を wrap するべきか".

Lower-tier models turn `wrap` into runs of digits (Google Cloud Vision: `wrap 18-246'`) or end up with completely different sentences (Azure: `Ageat full of Web App 2 wrap is it!`). It's also notable that DeepSeek-OCR outputs Japanese parts in Chinese (`自动权限模式`, `SD卡`).

## Appendix: evaluation metric design

### Hungarian NLS (primary)

For each region in the ground truth, find the line in the predicted text that best matches it and compute Normalized Levenshtein Similarity.

```
Ground-truth regions: ["東京都", "渋谷区", "恵比寿1-2-3"]
Predicted text:        "渋谷区\n東京都\n恵比寿1-2-3"

→ Even with different reading order, you get a high score as long as each region is recognized correctly
```

To handle the case where a VLM concatenates ground-truth regions into one line ("東京都渋谷区") or splits a region ("恵比寿" / "1-2-3"), I also include candidate adjacent-line merges and substring matches.

The name comes from the original Hungarian Algorithm for optimal assignment, but in implementation it's actually greedy matching: for each ground-truth region, take the best score across all predicted lines. By allowing duplicate matches across ground-truth regions, it handles the case where a VLM concatenates multiple regions into a single output.

### Bag-of-Characters F1 (secondary)

A metric inspired by the [CC-OCR](https://arxiv.org/abs/2412.02210) approach. Treat the text as a multiset of characters and compute Precision/Recall/F1, completely ignoring word order and line breaks.

```python
gt_chars  = Counter("東京都渋谷区")  # {'東':1, '京':1, '都':1, '渋':1, '谷':1, '区':1}
pred_chars = Counter("東京都渋谷区恵比寿")
matched = sum((gt_chars & pred_chars).values())  # 6
precision = 6/9, recall = 6/6
```

When VLMs add Markdown formatting or descriptive text, Precision drops, so this is also useful for noise detection.

### CER / NED (tertiary)

The classical metric: concatenate the full text flatly and compute Levenshtein distance. CER is weight-averaged by ground-truth text length.

### Text normalization

All three metrics share a common normalization pipeline.

1. Markdown stripping — remove the `##` headers, `**bold**`, list markers, etc. that VLMs love to add
2. VLM noise removal — remove decorative characters like `・` and `☆`, meta annotations like `(circled)`, and emojis
3. NFKC normalization — unify full-width alphanumerics to half-width
4. Whitespace and punctuation removal (when computing BoC/NED)

Without this normalization, VLM outputs end up unfairly disadvantaged. They're correctly reading the text but lose points just because of the formatting markers — that's not fair. That said, over-aggressive normalization erases differences between models, so I designed the rules carefully to remove only "things clearly outside the OCR target".

## Appendix: image preprocessing

When you upload an image to the annotation tool, the following preprocessing pipeline runs before passing it to the OCR. To be honest, the logic isn't well validated, and there are probably cases where it doesn't work well. It's a rough implementation, "better than nothing" tier.

1. Paper detection / cropping — detect paper regions with OpenCV's Otsu binarization + morphological closing, take the 4 corners with `minAreaRect`, and crop via perspective transform. If the paper area is less than 15% of the image, treat it as detection failure and use the original image
2. Coarse orientation correction (0/90/180/270°) — uses [docTR](https://github.com/mindee/doctr)'s MobileNetV3-based orientation estimator. Skips rotation if confidence is below 0.7
3. Fine deskew — corrects small angles (0.3°–15°) with [jdeskew](https://github.com/phamquiluan/jdeskew)
4. Shadow removal + contrast enhancement — estimate the background with `medianBlur` and divide it out to remove lighting unevenness, then bump contrast with CLAHE

Step 1 (paper detection) in particular can fail when paper-vs-background contrast is low or when paper is creased. It falls back to the original image on failure so nothing breaks, but the OCR ends up receiving an image with extra margins.

## Appendix: running 12 models on Modal

For OSS model evaluation, I'm using [Modal](https://modal.com). It's a serverless GPU platform where you can use T4, L4, A100, etc. with a single Python decorator.

Each model's Modal script follows a unified interface.

```python
@app.function(gpu="L4", image=image, timeout=1800)
def run_ocr(images_b64: list[str]) -> list[str]:
    # Receive base64 images, return a list of OCR result texts
    ...

@app.local_entrypoint()
def main(input: str, output: str):
    from _common import load_input, save_output
    data = load_input(input)
    results = run_ocr.remote(data["images"])
    save_output(output, results)
```

Input is a JSON of base64-encoded images; output is a JSON of OCR texts. As long as you stick to this contract, adding new models is easy. The gotchas (specifying the GPU build of PaddlePaddle, the `libgl1` dependency, CUDA version, etc.) are collected in [AGENTS.md](https://github.com/nyosegawa/ocr-comparison/blob/main/AGENTS.md).

## References

- [ocr-comparison (GitHub)](https://github.com/nyosegawa/ocr-comparison)
- Benchmarks
    - [CC-OCR: A Comprehensive and Challenging OCR Benchmark for Evaluating Large Multimodal Models in Literacy](https://arxiv.org/abs/2412.02210)
    - [OCRBench v2: An Improved Benchmark for Evaluating Large Multimodal Models](https://arxiv.org/abs/2501.00321)
- Models
    - [Mistral OCR](https://docs.mistral.ai/capabilities/document/)
    - [Qwen VL OCR (Alibaba Cloud)](https://www.alibabacloud.com/help/en/model-studio/qwen-vl-ocr)
    - [GLM-OCR (zai-org)](https://huggingface.co/zai-org/GLM-OCR)
    - [Sarashina2.2-OCR (SB Intuitions)](https://huggingface.co/sbintuitions/sarashina2.2-ocr)
    - [Nemotron OCR v2 (NVIDIA)](https://huggingface.co/nvidia/nemotron-ocr-v2)
    - [HunyuanOCR (Tencent)](https://github.com/Tencent-Hunyuan/HunyuanOCR)
    - [DeepSeek-OCR](https://arxiv.org/abs/2510.18234)
    - [GOT-OCR 2.0](https://arxiv.org/abs/2409.01704)
    - [olmOCR-2 (Allen AI)](https://huggingface.co/allenai/olmOCR-2-7B-1025-FP8)
    - [PaddleOCR](https://github.com/PaddlePaddle/PaddleOCR)
    - [YomiToku](https://github.com/kotaro-kinoshita/yomitoku)
    - [NDLOCR (Japan's National Diet Library)](https://github.com/ndl-lab/ndlocr_cli)
- Related articles
    - [The evolution of OCR and a performance review of Japanese-capable models (LayerX)](https://tech.layerx.co.jp/entry/2025/12/01/161913)
    - [OCR accuracy evaluation on medical documents (GENSHI AI)](https://genshi.ai/articles/ocr-evaluation)
    - [8 Top Open-Source OCR Models Compared (Modal Blog)](https://modal.com/blog/8-top-open-source-ocr-models-compared)
- Infrastructure
    - [Modal](https://modal.com)
