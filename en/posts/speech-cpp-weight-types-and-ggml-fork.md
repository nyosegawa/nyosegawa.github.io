---
title: "speech.cpp 0.8.4 released: quantized versions of every model, and more"
description: "speech.cpp 0.8.4 adds Q8_0, Q6_K, Q5_K and Q4_K files for nine of its models, all but Silero VAD. I measured how much memory each saves and how much accuracy it costs, model by model; here is how to choose, and what to watch for when you update."
date: 2026-10-12
tags: [speech.cpp, ggml, 量子化, Vulkan, Metal]
author: 逆瀬川ちゃん
lang: en
---

Hi! This is Sakasegawa ([@gyakuse](https://x.com/gyakuse))!

Today I'm writing about the 0.8.4 release of [speech.cpp](https://github.com/nyosegawa/speech.cpp). The biggest change is that almost every model now comes in smaller files that fit on PCs with little memory.

<!--more-->

speech.cpp is an engine that runs speech synthesis, speech recognition and voice activity detection models in C++ ([earlier post](https://nyosegawa.com/en/posts/speech-cpp/)).

0.8.4 brings four changes:

![What changed in 0.8.4](/img/en/speech-cpp-weight-types-and-ggml-fork/changes-overview.png)

The biggest is that you can choose the size of each model's file. A smaller type takes this much less memory:

![Memory by type (parakeet-ja)](/img/en/speech-cpp-weight-types-and-ggml-fork/memory-overview.png)

The speed changes differently by model. Qwen3-ASR and Qwen3-TTS get faster the smaller the type, while FastConformer (ReazonSpeech and the others) and Irodori-TTS stay about the same. Below, the time to recognize one utterance:

![Speed by type (time to recognize one utterance)](/img/en/speech-cpp-weight-types-and-ggml-fork/speed-overview.png)

Both were measured on an Apple M5. This post goes through the accuracy, memory and speed of every model, with numbers.

## What changed in 0.8.4

- Quantized files
    - Nine models, all but Silero VAD, come in Q6_K, Q5_K and Q4_K
    - Models that only had an F16 file also come in Q8_0
    - Qwen3-TTS and Qwen3-ASR also get faster in the smaller types
- ReazonSpeech and parakeet-ja now use their Q8_0 file when named alone
    - The accuracy is almost the same as F16, and the memory is close to half
- Fixed Qwen3-TTS's Q5_K and Q4_K stopping with an error partway through synthesis on Vulkan
- The memory peak while a model loads dropped by about 150 to 320 MB
- On the Mac, a program that embeds `libspeech` no longer has its environment variables changed

## Updating

Run the same command you installed with. On Apple silicon Macs and Linux:

```bash
curl -fsSL https://raw.githubusercontent.com/nyosegawa/speech.cpp/main/install.sh | sh
```

On Windows, in PowerShell:

```powershell
irm https://raw.githubusercontent.com/nyosegawa/speech.cpp/main/install.ps1 | iex
```

ReazonSpeech (`reazonspeech-v2`) and parakeet-ja (`parakeet-tdt_ctc-0.6b-ja`) now use their Q8_0 file instead of F16 when named alone, so the first run after updating downloads the Q8_0 file (0.66 GB). To keep using F16, add `:f16` after the name, as in `reazonspeech-v2:f16`. If you no longer need the F16 file, this removes it:

```bash
speech rm reazonspeech-v2:f16
```

## Using a quantized type

Add a colon and the type after the model's name. The first time, the file is downloaded from Hugging Face.

```bash
speech asr qwen3-asr-1.7b:q6_k meeting.wav
speech tts qwen3-tts-0.6b:q6_k "It will be sunny in Tokyo tomorrow."
speech serve qwen3-tts-1.7b:q4_k qwen3-asr-0.6b silero-vad
```

`speech models` lists the types each model has.

```
qwen3-tts-0.6b                 q8_0  1.21 GB  yes      synthesis    de en es fr it ja ko pt ru zh
qwen3-tts-0.6b:q6_k            q6_k  0.99 GB  no       synthesis    de en es fr it ja ko pt ru zh
qwen3-tts-0.6b:q5_k            q5_k  0.87 GB  no       synthesis    de en es fr it ja ko pt ru zh
qwen3-tts-0.6b:q4_k            q4_k  0.76 GB  no       synthesis    de en es fr it ja ko pt ru zh
```

The number in a type is roughly how many bits each weight takes. The smaller the number, the smaller the file and the memory, and the lower the accuracy. How much lower turned out to differ a lot between models.

## Choosing a type for each model

First, the short version: what to pick when you want to save memory. How far a model goes down with almost no loss of accuracy differs by model:

![How far each model goes down with almost no loss of accuracy](/img/en/speech-cpp-weight-types-and-ggml-fork/how-far.png)

The memory and accuracy of each model are in the chart and the table below. The memory is the peak of one recognition or synthesis.

![Memory with the file up to 0.8.3 and with a smaller type in 0.8.4](/img/en/speech-cpp-weight-types-and-ggml-fork/memory-by-type.png)

| Model | Named alone | To save memory | What changes |
|---|---|---|---|
| parakeet-ja | Q8_0 (0.78 GB) | Q4_K (0.47 GB) | Almost nothing |
| ReazonSpeech | Q8_0 (0.78 GB) | Q4_K (0.47 GB) | Almost nothing |
| parakeet-v3 | F16 (1.37 GB) | Q6_K (0.63 GB) | WER up 0.1 points |
| Qwen3-ASR 0.6B | Q8_0 (1.00 GB) | Q6_K (0.84 GB) | Almost nothing |
| Qwen3-ASR 1.7B | Q8_0 (2.34 GB) | Q6_K (1.85 GB) | Almost nothing |
| Qwen3-TTS 0.6B | Q8_0 (1.37 GB) | Q6_K (1.15 GB) | Almost nothing; Q4_K misreads more |
| Qwen3-TTS 1.7B | Q8_0 (2.44 GB) | Q6_K (1.98 GB) | No difference we could measure |
| Irodori-TTS | F16 (2.03 GB) | Q6_K (1.16 GB) | No difference we could measure |
| Irodori-TTS MF | F16 (2.04 GB) | Q6_K (1.16 GB) | Every quantized type is a little harder to understand |

The rest of this section shows the numbers behind that table. Everything was measured with [speech-bench](https://github.com/nyosegawa/speech-bench) on an Apple M5 with Metal; Appendix E has the details.

### Japanese speech recognition

The CER on the Japanese test set of Common Voice 8.0 (4,483 utterances). The number after the slash is the CER when other spellings of the same words, such as 「行う」 and 「行なう」, count as correct.

| Type | File | Memory | parakeet-ja | ReazonSpeech |
|---|---:|---:|---:|---:|
| F16 | 1.24 GB | 1.37 GB | 7.88% / 2.98% | 12.02% / 7.13% |
| Q8_0 | 0.66 GB | 0.78 GB | 7.93% / 3.00% | 12.05% / 7.15% |
| Q6_K | 0.51 GB | 0.63 GB | 7.88% / 3.00% | 11.98% / 7.12% |
| Q5_K | 0.43 GB | 0.54 GB | 7.79% / 2.97% | 11.99% / 7.14% |
| Q4_K | 0.36 GB | 0.47 GB | 7.94% / 3.01% | 12.16% / 7.23% |

parakeet-ja and ReazonSpeech barely move even at Q4_K, while the memory goes from 1.37 GB to 0.47 GB. If memory is short, Q4_K is a safe pick for both.

| Type | 0.6B file | Memory | Qwen3-ASR 0.6B | 1.7B file | Memory | Qwen3-ASR 1.7B |
|---|---:|---:|---:|---:|---:|---:|
| Q8_0 | 0.84 GB | 1.00 GB | 11.89% / 7.05% | 2.18 GB | 2.34 GB | 9.49% / 4.67% |
| Q6_K | 0.68 GB | 0.84 GB | 12.01% / 7.02% | 1.68 GB | 1.85 GB | 9.52% / 4.72% |
| Q5_K | 0.59 GB | 0.75 GB | 12.49% / 7.57% | 1.41 GB | 1.58 GB | 9.85% / 4.96% |
| Q4_K | 0.51 GB | 0.67 GB | 14.23% / 8.66% | 1.16 GB | 1.32 GB | 11.21% / 5.96% |

Qwen3-ASR stays close to Q8_0 down to Q6_K, and its CER rises at Q5_K and Q4_K. One interesting point: the 1.7B model at Q4_K (1.32 GB) has a lower CER than the 0.6B model at Q8_0 (1.00 GB). If you have another 0.3 GB to spare, the 1.7B model at Q4_K recognizes more accurately than the 0.6B model.

### Recognition in English and other languages

parakeet-v3 (`parakeet-tdt-0.6b-v3`) was measured by WER on 300 English utterances of FLEURS. Its files and memory are about the same as parakeet-ja's.

| Type | WER |
|---|---:|
| F16 | 8.76% |
| Q8_0 | 9.06% |
| Q6_K | 8.87% |
| Q5_K | 9.13% |
| Q4_K | 9.51% |

### Speech synthesis

For synthesis, 20 Japanese sentences were synthesized with three seeds, Qwen3-ASR 1.7B transcribed the audio, and the CER was taken against the original text. Each number is the mean of 60 syntheses. The same type moves by a few points from seed to seed, so a difference of one or two points does not say which type is better.

| Type | 0.6B file | Memory | Qwen3-TTS 0.6B | 1.7B file | Memory | Qwen3-TTS 1.7B |
|---|---:|---:|---:|---:|---:|---:|
| Q8_0 | 1.21 GB | 1.37 GB | 6.14% | 2.29 GB | 2.44 GB | 6.25% |
| Q6_K | 0.99 GB | 1.15 GB | 6.03% | 1.82 GB | 1.98 GB | 4.42% |
| Q5_K | 0.87 GB | 1.03 GB | 7.35% | 1.57 GB | 1.72 GB | 6.02% |
| Q4_K | 0.76 GB | 0.92 GB | 13.60% | 1.33 GB | 1.48 GB | 7.19% |

Only Qwen3-TTS 0.6B at Q4_K more than doubled its CER over Q8_0. To shrink the 0.6B model, stop at Q6_K. That said, from what I heard, every quantized version of Qwen3-TTS tends to come out with flatter intonation. That is hard to put into a score, so it's worth trying them and listening for yourself. The 1.7B model at Q4_K stayed within the seed-to-seed spread on average. Still, when I later listened sentence by sentence, it turned a sentence with English words into entirely different words, so the table above suggests Q6_K.

| Type | MF file | Memory | Irodori-TTS MF | File | Memory | Irodori-TTS |
|---|---:|---:|---:|---:|---:|---:|
| F16 | 1.92 GB | 2.04 GB | 5.92% | 1.91 GB | 2.03 GB | 3.43% |
| Q8_0 | 1.21 GB | 1.33 GB | 8.35% | 1.20 GB | 1.32 GB | 4.09% |
| Q6_K | 1.04 GB | 1.16 GB | 7.35% | 1.03 GB | 1.16 GB | 3.65% |
| Q5_K | 0.95 GB | 1.07 GB | 7.74% | 0.94 GB | 1.07 GB | 4.37% |
| Q4_K | 0.86 GB | 0.99 GB | 7.57% | 0.86 GB | 0.98 GB | 4.54% |

Irodori-TTS (`irodori-tts`) was measured with 16 steps (the default is 40). Down to Q4_K, its difference from F16 stayed within the seed-to-seed spread. Unlike Qwen3-TTS, the quantized versions kept a normal intonation. On the other hand, effects such as the caption's may have weakened. Both Irodori-TTS models keep the codec that decodes the audio in F32 in every type, so their files shrink less than the other models'.

The MF model got worse in every quantized type. Its F16 CER per seed was 5.31 to 6.30%, and the means of the quantized types (7.35 to 8.35%) fall outside that range. MF makes its audio in four steps, so an error made in one step may survive to the end. MF delivers its first audio in about a fifth of the time Irodori-TTS takes with 16 steps, so the choice comes down to memory versus speed.

### The type a name uses alone

The type a model uses when named alone was decided like this:

- A recognition model uses Q8_0 when its CER is within 0.2 points of F16's, with and without other spellings counted as correct
- A synthesis model uses Q8_0 when its mean CER falls within the range of F16's per-seed CERs
- Q6_K, Q5_K and Q4_K are never used, however good their numbers

The third rule is there because a type that does well on this data may still do worse on other recordings or another GPU. If that happened to the type a name uses alone, it would reach everyone who never chose a type. The smaller types are for people who choose them after seeing the numbers above.

With these rules, parakeet-ja and ReazonSpeech changed to Q8_0. parakeet-v3 stays at F16, since its WER rose 0.3 points at Q8_0, and both Irodori-TTS models stay at F16.

## Using Qwen3-TTS's Q5_K and Q4_K on Vulkan

Qwen3-TTS's Q5_K and Q4_K need 0.8.4 on Vulkan. With the Vulkan build of 0.8.3 or earlier, these two files stop partway through synthesis with this error:

```
speech: internal: no token has a finite logit to pick from
```

The cause is in ggml's Vulkan backend: a value in the middle of the computation went past the largest number F16 can hold (65504) and became infinite. 0.8.4 builds on a ggml with a fix; Appendix A explains the cause and the fix. Q8_0 and Q6_K synthesize correctly on 0.8.3 and earlier too.

To carry this fix, speech.cpp now builds on my fork of ggml ([nyosegawa/ggml](https://github.com/nyosegawa/ggml/tree/speech.cpp)) instead of the upstream repository. Appendix C describes how the fork is kept.

## Memory and speed

0.8.4 also lowers the memory peak while a model loads. 0.8.3 read each tensor from the file into a temporary buffer as large as the largest tensor; 0.8.4 reads 16 MB at a time, so the peak drops by that buffer.

| Model (M5, Metal) | 0.8.3 | 0.8.4 |
|---|---:|---:|
| Qwen3-TTS 1.7B Q8_0 | 2758 MB | 2443 MB |
| Qwen3-ASR 0.6B Q8_0 | 1154 MB | 1005 MB |
| Irodori-TTS F16 | 2171 MB | 2030 MB |

On Vulkan the memory also drops after loading. On an RTX 2080, a Qwen3-ASR 1.7B worker waiting for requests went from 2635 MB to 2325 MB; Appendix D explains why.

For the same type, the speed is the same as 0.8.3, and so is the time to load. On the Mac, 0.8.4 computes exactly what 0.8.3 did: the output of all ten models matched 0.8.3 byte for byte.

### Speed by type

The type does change the speed. I measured the time to the first audio and the time to make a second of audio (RTF) for synthesis, and the time from a finished utterance to its text for recognition. The type a name uses alone is 100%. First, the Apple M5:

![Speed by quantized type (Apple M5)](/img/en/speech-cpp-weight-types-and-ggml-fork/speed-by-type.png)

- Qwen3-TTS and Qwen3-ASR get faster the smaller the type
    - At Q4_K, Qwen3-ASR 1.7B recognizes 27% faster, and Qwen3-TTS makes its audio in about 30% less time
    - Qwen3-TTS's first audio already arrives in 0.04 to 0.06 s, and Q4_K changes it by a few milliseconds
- The three FastConformer models (parakeet-ja, ReazonSpeech, parakeet-v3) and Irodori-TTS run at about the same speed in every type

Qwen3-TTS and Qwen3-ASR read all their weights from memory for every token they make, so smaller weights mean less to read and a faster model. FastConformer and Irodori-TTS process many frames in each computation, so the computing takes longer than reading the weights, which is likely why smaller weights do not make them faster.

I measured the same on an RTX 2080 (Vulkan) under Windows:

![Speed by quantized type (RTX 2080)](/img/en/speech-cpp-weight-types-and-ggml-fork/speed-by-type-rtx2080.png)

The pattern is the same as on the M5. At Q4_K, Qwen3-ASR 1.7B recognizes 25% faster and Qwen3-TTS 1.7B makes its audio in 22% less time, while FastConformer and Irodori-TTS stay about the same. This release's fix changed how Vulkan computes Q4_K and Q5_K, and they are still faster than Q8_0. On the RTX 2080, parakeet-ja and ReazonSpeech are also 10 to 20% slower in F16 than in Q8_0, so using Q8_0 when they are named alone pays off in speed too.

### Load time

Smaller types also load faster. I measured it on an Apple M5 with the system's file cache emptied (the first use after starting the computer) and with the file in the cache (later uses).

![Time to load a model](/img/en/speech-cpp-weight-types-and-ggml-fork/load-by-type.png)

- The load time shrinks about in proportion to the file
    - The three FastConformer models load in 0.35 s at F16 and about 0.2 s at Q4_K
    - Qwen3-TTS 1.7B and Qwen3-ASR 1.7B take a little over 0.6 s at Q8_0 with the cache empty, and just under 0.5 s at Q4_K
- With the file in the cache, every model loads in about half the time it takes with the cache empty

The M5's SSD is fast, so every model loads within 0.7 s even with the cache empty. The first run after installing, though, also takes about 15 s to prepare Metal's shaders, once.

## Summary

- In 0.8.4, every model but Silero VAD comes in types from Q8_0 down to Q4_K
- parakeet-ja, ReazonSpeech, Qwen3-ASR and Irodori-TTS barely change down to Q6_K, and parakeet-ja and ReazonSpeech not even at Q4_K
- If you use Qwen3-TTS's Q5_K or Q4_K on Vulkan, update to 0.8.4

## Appendix A: why Q5_K and Q4_K gave NaN on Vulkan

### How it showed up

I found it while running the published files one by one on an RTX 2080 under Windows. Only Qwen3-TTS 0.6B synthesized or failed depending on the type. The same files synthesized fine on the Windows CPU and with Metal on the Mac.

| Qwen3-TTS 0.6B | Vulkan (RTX 2080) |
|---|---|
| Q8_0 | synthesizes |
| Q6_K | synthesizes |
| Q5_K | error |
| Q4_K | error |

ggml's Vulkan backend has environment variables that turn off some ways of computing. Trying them one at a time, synthesis worked only with `GGML_VK_DISABLE_MMVQ` or `GGML_VK_DISABLE_INTEGER_DOT_PRODUCT` set. Both stop the backend from computing matrix products with integer dot products.

### The block sum of q8_1 goes past F16

When ggml's Vulkan backend computes a matrix product with integer dot products, it quantizes the activations that multiply the weights to a format called q8_1. q8_1 groups 32 values and stores 32 int8 values, an F16 scale `d` and an F16 sum `s`. `s` is about the sum of the 32 activations.

![The block sum of q8_1 overflows F16](/img/en/speech-cpp-weight-types-and-ggml-fork/q8-1-overflow.png)

The largest number F16 can hold is 65504, so 32 activations above 2048 in a row make `s` infinite. LLMs are known to produce very large activations in a few channels ([Sun et al., 2024](https://arxiv.org/abs/2402.17762)), and somewhere in Qwen3-TTS they reached this size.

Whether `s` is used depends on the weight type. Q4_K stores a scale `d` and a minimum `m` for every 32 weights and writes a weight as `w = d·q − m` (q an integer from 0 to 15). Writing an activation as `a ≈ d_a·r` (r an int8), the dot product of 32 of them is:

```math
\sum_i w_i a_i \approx d \, d_a \sum_i q_i r_i \; - \; m \, s, \qquad s = d_a \sum_i r_i
```

The first term is an integer dot product, and the second uses `s`. ggml's shader computes Q4_K and Q5_K exactly this way:

```glsl
return ACC_TYPE(float(cache_b.ds.x) * float(cache_a[ib_a].dm.x) * float(q_sum) - float(cache_a[ib_a].dm.y) * float(cache_b.ds.y));
```

[ggml-org/ggml v0.25.3: src/ggml-vulkan/vulkan-shaders/mul_mmq_funcs.glsl](https://github.com/ggml-org/ggml/blob/v0.25.3/src/ggml-vulkan/vulkan-shaders/mul_mmq_funcs.glsl)

`cache_b.ds.y` is `s`. When it is infinite, the result is infinite or NaN. Q8_0 and Q6_K have no minimum, so they have no second term and never read `s`, which is why only those two synthesized. Reading the shaders, eight types use `s`: Q2_0, Q4_0, Q4_1, Q5_0, Q5_1, Q4_K, Q5_K and IQ1_S.

On the CPU, Q4_K quantizes the activations to a different format, Q8_K, which stores its sums as int16 and its scale as F32, so the problem does not arise there.

### The fix

For the eight types that use `s`, the backend no longer computes through q8_1. ggml already does the same for Q6_K on NVIDIA GPUs, and the fix adds these eight types to that condition. Nothing changes for Q8_0 and Q6_K.

A Codex review of the fix found one more problem. Without q8_1, ggml converts the weights back to F16 and computes the product from them. When a matrix product has no precision set, this path sums in F16 and clips results above 65504 to 65504. Qwen3's decoder in speech.cpp sets no precision, so an input whose block sums stay under 65504 but whose products go past it would be clipped after the fix, where it was correct before. So these eight types now sum in F32. The q8_1 path always summed in integers and F32, so the fixed path handles values as large as before.

### Test cases

ggml's tests (`test-backend-ops`) had no case that fails on this problem, so I added two kinds:

- Activations from 2048 to 4096, so that the sum of 32 goes past F16
- Activations from 512 to 1024 and weights from 0.5 to 1, so that the sums fit but the products go past F16

Each runs for Q4_0, Q5_0, Q4_K and Q5_K as a matrix-vector product, a small batch and a large batch. Q4_1 and Q5_1 are left out because the CPU they are compared with also quantizes their activations to q8_1 and returns `-inf` the same way.

| `test-backend-ops -b Vulkan0` (RTX 2080) | Before | After |
|---|---:|---:|
| Added cases | 8 / 24 | 24 / 24 |
| All MUL_MAT cases | 1138 / 1154 | 1154 / 1154 |
| All MUL_MAT_ID cases | 937 / 937 | 937 / 937 |

With the fix, Qwen3-TTS synthesizes at Q5_K and Q4_K too, and its Q8_0 output is byte for byte the same as 0.8.3's.

## Appendix B: why Metal's Tensor API stays off

On M5 and later chips, ggml's Metal backend computes matrix products with Metal 4's Tensor API. When I ported Irodori-TTS, I found that on the M5 this computation writes past the end of its output ([speech.cpp #13](https://github.com/nyosegawa/speech.cpp/issues/13)). It happens when the number of output columns is 64 modulo 128, and turns the codec's 64-frame windows into noise.

So up to 0.8.3, speech.cpp set the environment variable `GGML_METAL_TENSOR_DISABLE` while it prepared the devices. But that changes the environment of any program embedding `libspeech`, and it is not safe while another thread reads the environment. Since I was forking ggml anyway, I tried fixing where it writes and using the Tensor API.

With the write fixed, 3 of speech.cpp's 25 Metal checks failed.

| Check (M5, F32) | Without the Tensor API | With the Tensor API |
|---|---|---|
| Irodori-TTS v4.1-Small, SNR of the synthesized audio against the official implementation | 8.7 to 62.5 dB | 2.3 to 48.3 dB |
| ReazonSpeech, 311 seconds of audio recognized with beam search | the same text as NeMo | a few characters differ |

Two runs of the same build give the same values, so this is not sampling noise. Even the check that runs the DiT once (109 cases) showed the median SNR dropping from 59.1 dB to 52.9 dB, and that difference piled up over 40 sampling steps. The cause is an argument ggml passes to the Tensor API's matrix product:

```cpp
mpp::tensor_ops::matmul2d<
    mpp::tensor_ops::matmul2d_descriptor(
        NRB, NRA, static_cast<int>(dynamic_extent), false, true, true,
        mpp::tensor_ops::matmul2d_descriptor::mode::multiply_accumulate),
    execution_simdgroups<N_MM_SIMD_GROUP_X * N_MM_SIMD_GROUP_Y>> mm;
```

[ggml-org/ggml v0.25.3: src/ggml-metal/kernels/mul_mm.metal](https://github.com/ggml-org/ggml/blob/v0.25.3/src/ggml-metal/kernels/mul_mm.metal)

The sixth argument is `relaxed_precision`, and `true` allows a faster, less precise computation. Setting it to `false` passed all 25 checks, and Irodori-TTS's SNR became 14.0 to 64.8 dB, better than without the Tensor API. But now it was slower.

| M5, median | Without the Tensor API | Tensor API (`relaxed_precision` `false`) |
|---|---:|---:|
| Irodori-TTS MF, to the first audio | 0.251 s | 0.351 s |
| Irodori-TTS 16 steps, to the first audio | 1.239 s | 1.762 s |
| Qwen3-TTS 0.6B, to the first audio | 0.039 s | 0.072 s |
| Qwen3-ASR 0.6B, recognition | 0.123 s | 0.150 s |
| ReazonSpeech, recognition | 0.078 s | 0.107 s |

Every model got 22 to 85% slower. With a choice between less precision and less speed, the Tensor API is off by default. ggml already leaves it off by default on chips before the M5, and the fork extends that to every chip. speech.cpp no longer needs to set the environment variable, and the Mac computes exactly what 0.8.3 did.

## Appendix C: the ggml fork

The fixes in Appendices A and B both change ggml's source. So speech.cpp's submodule now points at the `speech.cpp` branch of [nyosegawa/ggml](https://github.com/nyosegawa/ggml/tree/speech.cpp) ([#111](https://github.com/nyosegawa/speech.cpp/pull/111)).

![The shape of the fork's branch](/img/en/speech-cpp-weight-types-and-ggml-fork/fork-branch.png)

A fork that drifts far from upstream becomes hard to update. To keep that from happening, the fork follows these rules:

- The branch is an upstream ggml tag, plus one commit of test cases, plus one commit for each fix
- Every fix comes with a test case that fails on its bug
- Moving to a new ggml tag starts with only the test-case commit on the new tag
    - A test case that passes without its fix means upstream ggml has fixed the bug, and the fix is dropped

The Windows machine has no C++ compiler, so running CI with `checks=true` now also builds ggml's `test-backend-ops.exe`. Downloading and running it on Windows shows whether a fix is still needed.

## Appendix D: why loading takes less memory

0.8.3 read each GGUF tensor into a `std::vector` and then sent it to the device. That buffer grew to the size of the largest tensor. In the Qwen3 models the largest is the text embedding, 331 MB in Qwen3-TTS and Qwen3-ASR 1.7B. 0.8.4 reads and sends 16 MB at a time ([#105](https://github.com/nyosegawa/speech.cpp/pull/105)).

On Vulkan there is a second saving. ggml's Vulkan backend stages data in a temporary host buffer before writing it to the GPU, and that buffer stays at the size of the largest write until the process ends. Writing a 331 MB tensor at once leaves a 331 MB buffer behind; writing 16 MB at a time leaves 16 MB.

## Appendix E: how it was measured

- Mac: Apple M5, macOS 26.2, Metal
- Windows: Windows 11, NVIDIA GeForce RTX 2080, Vulkan SDK 1.4.357.0
- Accuracy and memory of each type: speech-bench, 2026-10-12, M5
- Synthesis CER: the 20 sentences of speech-bench's `prompts/speak-ja-JP.json`, seeds 1, 2 and 3
    - Qwen3-TTS used the speaker `ono_anna`, and Irodori-TTS a voice file made from one reference recording
    - Transcribed with Qwen3-ASR 1.7B Q8_0
- Speed: synthesis is the median of the same 20 sentences, seed 1, three rounds. Recognition uses Common Voice's 4,479 utterances on the M5 and its first 100 (99 kept) on the RTX 2080; parakeet-v3 uses English FLEURS, 299 utterances on the M5 and 100 on the RTX 2080
- Memory: the peak memory footprint of one synthesis or recognition with `speech` (macOS)
- Q6_K, Q5_K and Q4_K quantize 256 values at a time, so a matrix whose rows are not a multiple of 256 stays Q8_0. That applies to Qwen3-ASR 0.6B's encoder (rows of 896) and to FastConformer's prediction network and joint (640)

## References

- speech.cpp
    - [speech.cpp](https://github.com/nyosegawa/speech.cpp)
    - [v0.8.4](https://github.com/nyosegawa/speech.cpp/releases/tag/v0.8.4)
    - [#105 Load a model's tensors from its file 16 MB at a time](https://github.com/nyosegawa/speech.cpp/pull/105)
    - [#110 Offer every weight type of each model](https://github.com/nyosegawa/speech.cpp/pull/110)
    - [#111 Build on ggml from a fork](https://github.com/nyosegawa/speech.cpp/pull/111)
    - [nyosegawa/ggml speech.cpp branch](https://github.com/nyosegawa/ggml/tree/speech.cpp)
- Models (Hugging Face)
    - [sakasegawa/Qwen3-TTS-12Hz-0.6B-CustomVoice-GGUF](https://huggingface.co/sakasegawa/Qwen3-TTS-12Hz-0.6B-CustomVoice-GGUF)
    - [sakasegawa/Qwen3-ASR-0.6B-GGUF](https://huggingface.co/sakasegawa/Qwen3-ASR-0.6B-GGUF)
    - [sakasegawa/reazonspeech-nemo-v2-GGUF](https://huggingface.co/sakasegawa/reazonspeech-nemo-v2-GGUF)
    - [sakasegawa/Irodori-TTS-v4.1-Small-MF-GGUF](https://huggingface.co/sakasegawa/Irodori-TTS-v4.1-Small-MF-GGUF)
- ggml
    - [ggml-org/ggml](https://github.com/ggml-org/ggml)
    - [Massive Activations in Large Language Models](https://arxiv.org/abs/2402.17762)
    - [ggml-org/llama.cpp #12135: Vulkan: Add DP4A MMQ and Q8_1 quantization shader](https://github.com/ggml-org/llama.cpp/pull/12135)
    - [ggml-org/llama.cpp #30105: vulkan: honor FP32 source precision in MUL_MAT_ID](https://github.com/ggml-org/llama.cpp/pull/30105)
    - [deepbeepmeep/kernels #4: MMQ returns NaN when a 32-activation block sum exceeds 65504 (CUDA)](https://github.com/deepbeepmeep/kernels/issues/4)
- Measurement
    - [speech-bench](https://github.com/nyosegawa/speech-bench)
- Related
    - [speech.cpp](https://nyosegawa.com/en/posts/speech-cpp/)
    - [speech.cpp #13: Metal on Apple M5 corrupts matrix products whose column count is 64 modulo 128](https://github.com/nyosegawa/speech.cpp/issues/13)
