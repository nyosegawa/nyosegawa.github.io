---
title: "Building speech.cpp, a Speech Synthesis and Recognition Engine for Voice Conversation"
description: "I built speech.cpp, a ggml-based engine for speech synthesis and recognition. Here is how I check it against the official implementations stage by stage, make it fast enough for conversation, and run it as one executable on Mac, Windows and Linux, with comparisons against other implementations."
date: 2026-10-09
tags: [speech.cpp, ggml, 音声合成, 音声認識, ASIST]
author: 逆瀬川ちゃん
lang: en
---

Hi there! This is Sakasegawa ([@gyakuse](https://x.com/gyakuse))!

Today I'd like to write about speech.cpp, the speech synthesis and recognition engine I've been building for voice conversation.

<!--more-->

## What I built

[speech.cpp](https://github.com/nyosegawa/speech.cpp) is a C++ engine that runs speech synthesis and recognition models on [ggml](https://github.com/ggml-org/ggml). It uses Metal on Mac and Vulkan on Windows and Linux for GPU inference, and can run on the CPU without a GPU.

These are the models it currently supports. I converted their original weights into GGUF files for speech.cpp and uploaded them to Hugging Face.

### Speech synthesis models

| Model | Languages | GGUF files for speech.cpp |
|---|---|---|
| Qwen3-TTS | 10 languages | [0.6B](https://huggingface.co/sakasegawa/Qwen3-TTS-12Hz-0.6B-CustomVoice-GGUF) / [1.7B](https://huggingface.co/sakasegawa/Qwen3-TTS-12Hz-1.7B-CustomVoice-GGUF) |
| Irodori-TTS | Japanese | [v4.1-Small-MF](https://huggingface.co/sakasegawa/Irodori-TTS-v4.1-Small-MF-GGUF) / [v4.1-Small](https://huggingface.co/sakasegawa/Irodori-TTS-v4.1-Small-GGUF) |

Qwen3-TTS offers nine preset voices. Irodori-TTS lets you specify a voice with a recording or a description; MF is a good choice when speed matters.

### Speech recognition models

| Model | Languages | GGUF files for speech.cpp |
|---|---|---|
| Qwen3-ASR | 30 languages | [0.6B](https://huggingface.co/sakasegawa/Qwen3-ASR-0.6B-GGUF) / [1.7B](https://huggingface.co/sakasegawa/Qwen3-ASR-1.7B-GGUF) |
| parakeet-tdt_ctc-0.6b-ja | Japanese | [Download](https://huggingface.co/sakasegawa/parakeet-tdt_ctc-0.6b-ja-GGUF) |
| parakeet-tdt-0.6b-v3 | 25 European languages | [Download](https://huggingface.co/sakasegawa/parakeet-tdt-0.6b-v3-GGUF) |
| ReazonSpeech NeMo v2 | Japanese | [Download](https://huggingface.co/sakasegawa/reazonspeech-nemo-v2-GGUF) |

Qwen3-ASR can take proper nouns and other context in a prompt. For Japanese, parakeet-ja is fast, while ReazonSpeech transcribes with beam search. I compare accuracy and speed later in the article.

### Voice activity detection

| Model | Languages | GGUF files for speech.cpp |
|---|---|---|
| Silero VAD v6.2 | Language-independent | [Download](https://huggingface.co/sakasegawa/silero-vad-GGUF) |

It finds the regions of audio that contain speech, for transcribing long recordings in parts or detecting when someone has finished speaking.

## Try it

### Install

Installation takes one command. On Apple silicon Macs and x86-64 Linux:

```sh
curl -fsSL https://raw.githubusercontent.com/nyosegawa/speech.cpp/main/install.sh | sh
```

On Windows x64, run this in PowerShell (a Vulkan-capable GPU driver is required):

```powershell
irm https://raw.githubusercontent.com/nyosegawa/speech.cpp/main/install.ps1 | iex
```

The Linux releases require a CPU with AVX2, FMA and F16C, and glibc 2.34 or later. Without a Vulkan loader, the installer selects the CPU build. Intel Macs need a build from source. See the [installation guide](https://github.com/nyosegawa/speech.cpp/blob/main/docs/install.md) for the requirements.

Select a model by name. The first time you use it, speech.cpp downloads it from Hugging Face into your OS's cache directory.

### Try it in the browser

The easiest way to get started is to open the demo page:

```sh
speech serve --open
```

![The speech serve demo page](/img/speech-cpp/page.png)

The Speak, Transcribe and Live tabs let you select a model and read text aloud, transcribe a recording or audio file, or transcribe your microphone while you speak.

### Read text aloud

You can also use the command line. Here is Qwen3-TTS reading Japanese:

```sh
speech tts qwen3-tts-0.6b --voice ono_anna --language ja -o out.wav "明日の東京は晴れです。"
```

### Use a voice of your choice

With Irodori-TTS, you can pass a reference WAV file directly to read text in that voice. This example saves the synthesized audio to `out.wav`.

```sh
speech tts irodori-tts-mf \
    --add-voice me=my-voice.wav --voice me \
    -o out.wav "こんにちは。"
```

If you use the same voice repeatedly, you can also create a voice file once with `speech voice`. This avoids encoding the reference audio each time you pass in the WAV file.

```sh
speech voice irodori-tts-mf my-voice.wav my-voice.voice.gguf
speech tts irodori-tts-mf \
    --add-voice me=my-voice.voice.gguf --voice me \
    -o out.wav "こんにちは。"
```

Without reference audio, you can describe the voice in words. This example asks for a low, calm male voice speaking slowly:

```sh
speech tts irodori-tts-mf --voice none \
    --instructions "低く落ち着いた男性の声で、ゆっくりと読み上げてください。" \
    -o out.wav "明日の東京は晴れです。"
```

### Transcribe audio

Qwen3-ASR can take proper nouns in a prompt:

```sh
speech asr parakeet-tdt_ctc-0.6b-ja utterance.wav
speech asr qwen3-asr-1.7b --language ja --prompt "逆瀬川, Codex, Claude" utterance.wav
```

### Transcribe long recordings or a microphone

For long recordings, Silero VAD finds speech regions, which are transcribed separately. With `--live`, speech.cpp transcribes your microphone while you speak.

```sh
speech asr reazonspeech-v2 --vad silero-vad meeting.wav
speech asr reazonspeech-v2 --vad silero-vad --live
```

### Run an HTTP server

The HTTP server accepts requests in the same format as the OpenAI API:

```sh
speech serve irodori-tts-mf --add-voice me=my-voice.voice.gguf
curl http://127.0.0.1:8080/v1/audio/speech -H 'Content-Type: application/json' \
    -d '{"input": "明日の東京は晴れです。", "voice": "me"}' -o out.wav
```

In Python, you can receive PCM as it arrives:

```python
import requests
import wave

with requests.post("http://127.0.0.1:8080/v1/audio/speech",
                   json={"input": "明日の東京は晴れです。", "voice": "me", "response_format": "pcm"},
                   stream=True) as r:
    r.raise_for_status()
    with wave.open("out.wav", "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(int(r.headers["X-Sample-Rate"]))
        for chunk in r.iter_content(chunk_size=None):
            w.writeframes(chunk)
```

### Embed it in an application

The HTTP server or worker is usually enough. To embed it directly, use the C API (from the [C API documentation](https://github.com/nyosegawa/speech.cpp/blob/main/docs/c-api.md)):

```c
speech_model * model = NULL;
speech_request * request = NULL;
if (check(speech_model_load("Irodori-TTS-866M-MF-v4.1-F16.gguf", NULL, &model)) &&
    check(speech_voice_add(model, "bright", "bright-young-woman-10s.voice.gguf")) &&
    check(speech_request_new(model, &request)) &&
    check(speech_request_set_text(request, "明日の東京は晴れです。")) &&
    check(speech_request_set_string(request, SPEECH_OPT_VOICE, "bright")) &&
    check(speech_synthesize(request, on_audio, NULL))) {
    /* on_audio receives the audio as it is generated. */
}
speech_request_free(request);
speech_model_free(model);
```

## Why I built it

I'm building [ASIST](https://nyosegawa.com/en/posts/asist-realtime-voice-assistant/), a voice assistant for the desktop. The hardest part of voice conversation is the wait. In human conversation, the gap between one speaker finishing and the next beginning is around 200 milliseconds ([Stivers et al., 2009](https://www.pnas.org/doi/10.1073/pnas.0903616106)). When an assistant stays silent for a second, I start wondering whether it heard me.

<aside class="promo">
<p class="promo-label">A short commercial break.</p>
<p class="promo-message">I made a desktop assistant! Give it a try if it sounds useful.</p>

[![ASIST: a real-time assistant for Mac and Windows that handles your schedule and email through conversation](/img/speech-cpp/asist-banner.jpg)](https://asist-agent.com/en/)

<p class="promo-links"><a class="promo-button promo-primary" href="https://asist-agent.com/en/">Visit the website</a><a class="promo-button" href="https://github.com/nyosegawa/asist">GitHub</a></p>
</aside>

For Japanese speech, Aratako's Irodori-TTS is wonderful. It reads naturally, and reference audio lets it speak in that voice. But the original implementation is a little slow for real-time conversation.

Windows was particularly painful. My test machine has an RTX 2080 with 8 GB of VRAM, and my attempts to run speech models with Python and CUDA kept running into trouble.

- I couldn't get Qwen3-TTS's official PyTorch package running on Windows.
- The CUDA 13 build of llama.cpp, which I used for recognition, lacked machine code for the RTX 20 series and would not start. The CUDA 12 build worked, but compiling GPU code on its first launch took 28 seconds.

That CUDA and Python setup required an NVIDIA GPU from the RTX 20 series or newer, driver version 580 or later, and several gigabytes of Python environment to distribute.

Each model also ran differently. ASIST used llama.cpp's llama-server for recognition and a worker I wrote for synthesis. llama-server needed two model files, the model and mmproj, a loopback port and its key, and a watchdog to stop it if the app crashed. Its 4,096-token context also meant utterances longer than about 270 seconds failed.

I wanted one engine for both synthesis and recognition, running on the GPU on Mac, Windows and Linux, fast enough for conversation, and producing the same results as the official implementations. First, I will look at how to shorten the wait for speech to begin.

## Speech synthesis: start quickly and keep playing

### Look at the time to first audio

ASIST splits the language model's reply into sentences and starts reading them as they arrive. It sends one sentence at a time to Irodori-TTS, while Qwen3-TTS receives waiting sentences grouped into at most 300 characters. It can synthesize the continuation while earlier audio plays, so the user's initial wait is for the first sentence to begin. I therefore focus on time to first audio, rather than overall speed measured as RTF, the seconds of computation needed per second of audio.

For the measurements, each implementation read the same 20 texts, including backchannels, short replies, longer explanations and Japanese mixed with English words. I used the same voices and seeds where applicable and took the median. The Appendix gives the details.

### How Irodori-TTS works

Irodori-TTS does not emit one token at a time like an LLM. Its Diffusion Transformer (DiT), following [Echo-TTS](https://jordandarefsky.com/blog/2025/echo/), generates codec latents for the whole text at once: 32-dimensional vectors at 25 Hz, representing 48 kHz audio. The codec converts them into a waveform. A separate model predicts the audio duration before generation.

![The Irodori-TTS pipeline](/img/speech-cpp/pipeline.png)

Because the DiT processes the whole text together, it cannot start speaking partway through. In the official implementation, text preparation, duration prediction, every sampler step and all codec decoding finish before audio is returned.

There are two models, differing in how the DiT turns noise into speech.

The original v4.1-Small is trained with [Rectified Flow](https://arxiv.org/abs/2209.03003). It connects noise and speech with straight lines and learns the velocity, how far and in which direction to move, at each point along them. Generation repeatedly predicts that velocity and takes a small step, 40 times. Classifier-free guidance (CFG), which strengthens adherence to text and speaker conditioning, requires three DiT evaluations per step in the first half, making this fairly expensive.

v4.1-Small-MF is distilled from v4.1-Small using [MeanFlow](https://arxiv.org/abs/2505.13447). Instead of the instantaneous velocity, it learns the average velocity over an interval. A large step along the instantaneous velocity can leave a curved trajectory, but its average over the interval can take you to the destination. The student learns the teacher's CFG-guided trajectory, so it needs only one DiT evaluation per step and produces audio in four steps. See [Irodori-TTS's MeanFlow explanation](https://github.com/Aratako/Irodori-TTS/blob/main/docs/meanflow.md).

![How Rectified Flow and MeanFlow take steps](/img/speech-cpp/rf-vs-meanflow.png)

According to the [MF model card](https://huggingface.co/Aratako/Irodori-TTS-v4.1-Small-MF), simply reducing v4.1-Small to four steps drops speaker similarity from 0.75 to 0.38, while MF preserves 0.74 with four steps. Conversation needs speed, so ASIST uses MF.

### Where the official implementation spends its time

I measured the stages of the official MF implementation on M5 with MPS, reading a 33-character Japanese text.

| Stage | WAVE reference | Pre-encoded reference latents |
|---|---|---|
| Reference encoding | 0.92–1.04 s | 0.001–0.005 s |
| Duration prediction | 0.25–0.28 s | 0.22–0.24 s |
| Sampler (4 steps) | 0.62–0.63 s | 0.55–0.60 s |
| Codec decoding | 1.29–1.40 s | 1.30–1.41 s |
| Total | 3.09–3.35 s | 2.07–2.25 s |

Passing a WAVE reference causes it to be encoded again for every request. Passing the already encoded latents removes that second of work and produces exactly the same audio. The largest remaining cost is codec decoding. With MF reducing the sampler to four steps, the codec takes longer than the DiT.

### Ways to make it faster

The breakdown suggests a few approaches. MF already reduces the number of steps, and saved reference latents avoid repeated encoding.

Other people have also written about accelerating Irodori-TTS. [Rosso's article](https://note.com/rosso_blog/n/n3eaee67d2c70) profiles a sentence with v4 on an RTX 3080 and finds that GPU dispatch overhead costs more than the DiT computation itself. Recording the DiT in a CUDA Graph removes that overhead, while rounding predicted durations up to a small set of lengths accommodates different sentence lengths. Generating 5.1 seconds of audio drops from 0.90 to 0.30 seconds, and reducing the sampler to eight steps with Sway Sampling brings it to 0.23 seconds.

On Mac, [osushi_cr's article](https://zenn.dev/yoshitetsu/articles/e616831f96b44a) uses v2 on an M1 Max with MPS. Reducing 40 steps to eight with Sway Sampling, keeping the model loaded and generating the next sentence during playback brings five sentences from 28.77 to 10.58 seconds. They report that bf16 was slower on MPS and moving the codec to the CPU roughly doubled the time.

Both improve how PyTorch is run. For speech.cpp, I also considered other directions because I wanted the same engine to use GPUs on both Mac and Windows.

Eight-bit quantization could reduce the workload. But in my Irodori-TTS test, CER measured by transcribing 20 synthesized texts rose from 2.99% to 3.81%, with audible degradation too.

Another option is leaving PyTorch for another runtime. ONNX Runtime's [CoreML execution provider on Mac](https://onnxruntime.ai/docs/execution-providers/CoreML-ExecutionProvider.html) is a preview and slows down when input shapes change. Its [DirectML execution provider on Windows](https://onnxruntime.ai/docs/execution-providers/DirectML-ExecutionProvider.html) has entered maintenance mode. MLX runs only on Mac. I chose ggml because I wanted GPU support on both Mac and Windows.

[ggml](https://github.com/ggml-org/ggml) is the C/C++ tensor library behind llama.cpp and whisper.cpp. It has Metal, Vulkan, CUDA and CPU backends, and builds computation graphs on each call, so changing text lengths are manageable. It can be linked into the executable, leaving users with no extra runtime to install.

Finally, there is the option of starting playback before all the audio is ready. The DiT cannot stream its work, but once it finishes, the codec can decode and return audio in pieces. Since the codec is more expensive than the DiT with MF, that should cut the initial wait substantially.

### What I did in speech.cpp

I ported MF to ggml, saved reference latents as voice files, and split codec decoding into windows.

Instead of decoding the whole output at once, the codec returns the first 12 frames, or 0.48 seconds of audio, immediately. While those play, it decodes the rest in windows of 24 to 48 frames. Based on the measured speed of previous windows, it chooses the largest window it can finish while the listener still has 0.1 seconds of audio buffered. Slower machines get smaller windows; faster machines get larger ones.

![Decoding codec windows while earlier audio plays](/img/speech-cpp/chunked-decode.png)

The window boundaries must not change the sound. Decoding ten extra frames on either side and discarding that padding produces the same waveform as full decoding. The output is bit-identical at every supported window size, so a fixed seed produces the same audio even when the machine's speed changes the windows. Most of the decoding now overlaps playback instead of adding to the initial wait.

There is another detail specific to conversation. People often start talking while the assistant is still speaking. If cancelling a sentence leaves the sampler running to completion, the next reply has to wait. I added cancellation checks between sampler steps. After cancelling a 120-character text, the time to first audio for the next reply dropped from 881 to 351 milliseconds.

### Streaming Qwen3-TTS one frame at a time

Unlike Irodori-TTS, Qwen3-TTS generates audio tokens one frame at a time, like an LLM. Each frame represents 0.08 seconds of audio and contains tokens from 16 codebooks. The talker, a Qwen3 decoder, emits the first token, and the code predictor fills in the other 15. The codec is causal too, so each completed frame can be decoded and streamed immediately. speech.cpp carries the codec's intermediate state between calls, making frame-by-frame decoding produce almost the same waveform as full decoding. This is the difference from qwentts.cpp that I will compare below.

### Comparing implementations

I compared the same 20 texts on M5 with the same reference voice and seed. Every implementation encoded the reference only once. The speech.cpp names are bold, as are the fastest values within each model. Later tables use the same convention.

| Model | Implementation | First audio (median) | First audio (p90) | RTF | CER |
|---|---|---|---|---|---|
| v4.1-Small-MF | **speech.cpp** (Metal, F16) | **0.25 s** | **0.52 s** | **0.17** | 6.14% |
| v4.1-Small-MF | [mlx-audio](https://github.com/Blaizzy/mlx-audio) (MLX, FP16) | 1.01 s | 2.67 s | 0.17 | 4.48% |
| v4.1-Small-MF | Official implementation (PyTorch, MPS, FP32) | 1.33 s | 3.19 s | 0.21 | 8.62% |
| v4.1-Small, 16 steps | **speech.cpp** (Metal, F16) | **1.24 s** | **3.40 s** | 0.34 | 3.15% |
| v4.1-Small, 16 steps | mlx-audio | 1.84 s | 4.54 s | 0.31 | 1.99% |
| v4.1-Small, 16 steps | Official implementation | 2.69 s | 7.37 s | 0.45 | 3.48% |
| v4-Small, 16 steps | audio.cpp v0.9.0 (codec on Metal) | 1.55 s | 4.26 s | **0.28** | 9.62% |
| v4-Small, 16 steps | audio.cpp v0.9.0 (codec on CPU) | 10.22 s | 30.11 s | 1.77 | 5.31% |
| Qwen3-TTS 0.6B | **speech.cpp** (Metal, Q8_0) | 0.04 s | 0.05 s | 0.31 | 5.80% |
| Qwen3-TTS 1.7B | **speech.cpp** (Metal, Q8_0) | 0.06 s | 0.11 s | 0.42 | 2.99% |

I also measured on Windows with an RTX 2080 and Vulkan. mlx-audio runs only on Mac, and I did not test the official implementation on Windows, so neither appears here.

| Model | Implementation | First audio (median) | First audio (p90) | RTF | CER |
|---|---|---|---|---|---|
| v4.1-Small-MF | **speech.cpp** (Vulkan, F16) | 0.12 s | 0.20 s | 0.07 | 7.13% |
| v4.1-Small, 16 steps | **speech.cpp** (Vulkan, F16) | **0.52 s** | **1.12 s** | **0.13** | 3.15% |
| v4-Small, 16 steps | audio.cpp v0.9.0 (Vulkan) | 1.06 s | 3.01 s | 0.19 | 3.81% |
| Qwen3-TTS 0.6B | **speech.cpp** (Vulkan, Q8_0) | 0.03 s | 0.04 s | 0.27 | 7.96% |
| Qwen3-TTS 1.7B | **speech.cpp** (Vulkan, Q8_0) | 0.04 s | 0.05 s | 0.32 | 2.82% |

The tables measure the time from a synthesis request to the first returned audio, which is not necessarily when the voice begins. Qwen3-TTS 0.6B often generates silence at the beginning of a sentence. Although its first audio chunk arrives in 0.04 seconds, the voice starts roughly half a second later in the median: 0.24–0.48 seconds across four voices, and as much as 1.9 seconds. The official implementation does the same. Reading the same text 20 times with ono_anna gave a median of 0.89 seconds of leading silence. The corresponding figures for 1.7B and Irodori-TTS MF were 0.10 and 0.03 seconds, so their voices begin sooner in conversation.

The official implementation, mlx-audio and audio.cpp return audio only after generating the whole sentence, making their time to first audio equal to the total synthesis time. speech.cpp returns its first decoded window instead. MF's RTF is almost identical to mlx-audio's, 0.174 versus 0.171, so overall throughput is similar; windowed decoding accounts for most of the difference in startup latency. CER is measured by transcribing the synthesized audio with Qwen3-ASR 1.7B. Each implementation generates noise differently, so a single run can vary by several percentage points. audio.cpp does not support MF, so its comparison uses RF with 16 steps.

### Keeping playback continuous

A quick start is not enough if playback then stalls. With streamed chunks, each new chunk must arrive before the previously received audio finishes playing. Smaller initial chunks start sooner but leave less time for the next chunk to arrive.

Other implementations handle this differently. The official Qwen3-TTS implementation sends four frames, 0.32 seconds, from the start ([Qwen3-TTS Technical Report](https://arxiv.org/abs/2601.15621)). This gives more margin against underruns, but the first audio waits for all four frames. [CosyVoice](https://github.com/FunAudioLLM/CosyVoice) increases each chunk by a fixed multiplier that a person selects for the machine's speed. The player can also accumulate more audio before starting, at the cost of extra latency.

speech.cpp's Qwen3-TTS starts small and grows: one frame, one frame, two frames, then four frames at a time.

![Fixed-size chunks compared with speech.cpp](/img/speech-cpp/adaptive-chunks.png)

On both M5 and RTX 2080, generating a frame takes much less than the 0.08 seconds of audio it represents. Starting with a small chunk therefore gives the next chunk time to arrive before the audio runs out. Grouping later frames in fours keeps the number of codec calls close to the original.

I considered adapting the chunk sizes to measured speed. However, changing chunk boundaries also changes waveform values by a tiny, inaudible amount. Choosing boundaries at runtime would make the same seed produce slightly different audio on different runs, so I use a fixed sequence. This describes playing the generated audio as-is, including any leading silence.

I checked continuity by recording when chunks arrived for the same 20 texts and assuming playback began immediately with the first chunk. All 20 texts played without underruns on both M5 and RTX 2080, for Qwen3-TTS 0.6B and 1.7B and Irodori-TTS MF and the 16-step model.

ASIST removes only the nearly silent beginning. Once a sound such as a breath or sigh begins, it preserves everything after it, including pauses. Removing the initial silence also removes time in which later audio could be generated, so the player waits after the first sound arrives until the waiting time plus the received audio duration totals 0.2 seconds. A sentence that already has at least 0.2 seconds buffered while waiting behind the previous sentence starts without an additional delay.

I also ran the same 20 texts in the released ASIST 0.8.0 on M5. With the model already loaded, the median time from synthesis start to the scheduled playback of the voiced portion was 0.40 seconds for Qwen3-TTS 0.6B, 0.25 seconds for 1.7B and 0.26 seconds for Irodori-TTS MF. These values come from the Web Audio playback schedule and exclude speaker and output-device latency.

This makes synthesis fast enough to begin a conversational reply and continue playing it.

### Checking against the official implementation, stage by stage

Moving a model to another runtime changes the order and precision of calculations a little. For synthesis, the voice may change; for recognition, the transcription may change. The trouble is that listening alone may not reveal it. Synthesis starts from noise, so the voice already varies from one run to the next, while recognition differences may appear only once in dozens of examples.

For each model I port to speech.cpp, I compare its intermediate stages against the official implementation.

For Irodori-TTS, for example, I compare text processing, the DiT and decoding like this:

![Comparing each stage against the official implementation](/img/speech-cpp/stage-check.png)

1. Run the official implementation in float32 on the CPU with fixed noise, and save each stage's inputs and outputs.
2. Feed the same saved inputs into each stage of the port.
3. Compare the outputs. For numerical data, use SNR to measure how small the error is relative to the signal; for tokens and strings, check exact equality.

The other models follow the same approach with different stages. Qwen3-TTS is compared using greedy decoding without sampling. Recognition models are compared at the audio feature, encoder and decoder stages.

Starting each stage with the same input makes the first divergence easy to find. In CPU float32, every Irodori-TTS stage agrees with the official implementation at an SNR of at least 86 dB. Greedy Qwen3-TTS produces the same 54 frames, and parakeet and ReazonSpeech produce exactly the same transcripts in all the checks. The tables are in the Appendix.

These comparisons also made some differences in other implementations easier to spot.

- llama.cpp's Qwen3-ASR sometimes transcribed differently from the official implementation. Across ten recordings, tested with automatic and explicit language selection for 20 runs in total, 0.6B differed six times and 1.7B four times. Where the official implementation wrote 「群島や湖では必ずしもヨット」, for example, 1.7B wrote 「軍港や湖ではカマザタ寿司もヨット」. The inputs differ in several small ways: the initial system message is missing, the log-mel features have one extra frame, and the final partial second is padded with zeros whose audio tokens are also passed to the model.
- Streaming Qwen3-TTS in [qwentts.cpp](https://github.com/ServeurpersoCom/qwentts.cpp) introduced a trembling noise that did not occur when the same text was synthesized all at once. Qwen3-TTS's codec generates new audio as a continuation of previous audio. Carrying its intermediate state across chunks therefore makes streamed and full synthesis produce almost the same waveform. speech.cpp does this, and I checked that decoding one frame at a time differs from full decoding by an inaudibly small amount, with an SNR of 133 dB.
- [CrispASR](https://github.com/CrispStrobe/CrispASR)'s ReazonSpeech added 「あっ。」 or 「うん。」 that was not in recordings with silence at their edges, in four of the first ten Common Voice examples. Trimming the silence reduced this to a few of 4,479 examples.
- With [audio.cpp](https://github.com/0xShug0/audio.cpp)'s Irodori-TTS codec on Metal, a distorted copy of the voice appeared 14 dB below the voice itself, and nominally silent regions were raised as well.

These are all differences that are hard to catch by listening alone. Conversely, once each stage is checked against the official implementation, I can change the computations for speed and quickly check that the results still agree. Next comes listening to the user.

## Speech recognition: getting the port right

### Port FastConformer once

The first recognition models I ported were NVIDIA NeMo models. parakeet-tdt_ctc-0.6b-ja for Japanese, parakeet-tdt-0.6b-v3 for 25 European languages, and ReazonSpeech NeMo v2 for Japanese all share the [FastConformer](https://arxiv.org/abs/2305.05084) architecture. They compute log-mel features, reduce the time dimension by a factor of eight with convolutions, run through 24 Conformer layers, then decode tokens.

Their differences are relatively small:

| | parakeet-ja | parakeet-v3 | ReazonSpeech |
|---|---|---|---|
| Mel bins | 80 | 128 | 80 |
| attention | Whole recording | Whole recording | 10.24 s on either side (local attention) |
| Decoder | TDT | TDT | RNN-T beam search |

I therefore ported FastConformer once and made these differences settings in the GGUF file.

The decoding behavior follows NeMo's default `transcribe()`. parakeet-ja also has a CTC head, but NeMo defaults to TDT, and the two produce different text for some utterances, so I ported only TDT. ReazonSpeech uses the model's configured beam search with width four rather than NeMo's greedy decoder, because greedy decoding sometimes drops punctuation or changes words. Greedy is much lighter, though, so it is available on request. Across 4,483 Common Voice examples on M5, it raises CER from 12.03% to 12.50% while reducing median latency from 0.110 to 0.077 seconds.

### Bringing Qwen3-ASR into the engine too

Qwen3-ASR connects an audio encoder to a Qwen3 language model. The language model caches state and emits one token at a time, exactly the work llama.cpp is good at. Initially, I intended to leave Qwen3-ASR in llama.cpp and have speech.cpp handle only FastConformer. There seemed little reason to implement the same thing twice.

But the stage comparisons showed the prompt differences mentioned earlier, with different transcripts in four to six of 20 runs. Utterances longer than about 270 seconds also failed. And keeping llama-server meant ASIST still had a second runtime alongside speech.cpp.

So I changed course and ported Qwen3-ASR too. I had already implemented the Qwen3 decoder for Qwen3-TTS's talker and could reuse it directly. The new work was the audio encoder, whose attention stays within eight-second windows, and prompts matching the official [qwen-asr](https://github.com/QwenLM/Qwen3-ASR) implementation. That includes prefilling the answer with `language Japanese<asr_text>` when Japanese is specified. With those inputs aligned, the transcripts matched the official implementation.

Once the transcripts matched, I wanted to measure recognition accuracy. But in Japanese, measuring "correctness" brings its own difficulty.

## Measuring Japanese transcription while allowing spelling variants

Recognition accuracy is usually measured by character error rate, CER, against a reference transcript. Japanese, however, offers several ways to write the same spoken words. If the reference says 「三十分」 and the transcript says 「30分」, both mean the spoken "thirty minutes," but ordinary CER counts the difference as an error.

| Reference | Transcript | Count as an error? |
|---|---|---|
| 27パーセント | 27% | No (another spelling of the same words) |
| 三十分 | 30分 | No |
| 今日 | きょう | No |
| README | リードミ | No |
| 機会 | 機械 | Yes (homophones with different meanings) |
| 3時半 | 3時30分 | Yes (same meaning, different spoken words) |

As models improve, CER increasingly measures whether they chose the reference's spelling rather than whether they heard the words correctly.

This is not unique to Japanese, and there is research on it:

- [Karita, Sproat and Ishikawa (CAWL 2023)](https://aclanthology.org/2023.cawl-1.8/) expand Japanese references into a lattice of possible spellings before scoring. Human reviewers accepted 95.4% of the variants, and CER dropped by 2.4–3.1 percentage points depending on the task.
- [OIWER (ICASSP 2026)](https://arxiv.org/abs/2603.00941) uses an LLM to identify spelling variants in Indian languages. Error rates fell by 6.3 percentage points on average and aligned better with human judgments.
- [HiKE (EACL Findings 2026)](https://arxiv.org/abs/2509.24613) annotates loanwords in an evaluation set of Korean-English code-switched speech.
- [Kacprzak and Fraś (2026)](https://arxiv.org/abs/2609.21084) report that number normalization alone can move Polish WER by more than two percentage points, exceeding the differences between systems.
- The long-established NIST sclite tool also supports reference alternatives such as `{ a / b / @ }`.

In [speech-bench](https://github.com/nyosegawa/speech-bench), I now report both ordinary CER and CER allowing accepted spelling variants. Each reference sentence is annotated like this:

- Add kana readings to non-kana text: `明日《あした》`, `｜Zoom《ズーム》`.
- List alternative spellings that a reading alone cannot express: `［九《く》時《じ》／9時］`.
- Allow fillers such as "um" to be omitted: `［えーと／えっと／］`.

The transcript is compared with the closest spelling that these annotations permit. The denominator remains the original reference length, so this CER cannot exceed ordinary CER. Homophones with different meanings, such as 機会 (opportunity) and 機械 (machine), remain errors. So do different spoken wordings with the same meaning, such as 3時半 (half past three) and 3時30分 (three thirty).

I published the annotations for the 4,483 Japanese Common Voice 8.0 test examples on Hugging Face as [sakasegawa/common-voice-ja-accepted-spellings](https://huggingface.co/datasets/sakasegawa/common-voice-ja-accepted-spellings), under CC0. The included scoring script produces the same error counts as speech-bench across 17,932 transcripts. The audio and reference text must be obtained from their respective distributors and combined with these annotations.

For example, accepting spelling variants lowers Qwen3-ASR 1.7B's CER on Common Voice from 9.25% to 4.56%. Roughly half of what had counted as errors were spelling differences. The following tables show both metrics.

That gave me a benchmark for accuracy. But the newly ported speech.cpp was slower than llama.cpp.

## Catching up with llama.cpp

On M5, speech.cpp 0.7.0 decoded Qwen3-ASR 0.6B at 123–132 tokens per second, compared with llama.cpp's 158–165. Decoding accounted for 90% of recognition time, so it needed attention.

I made two changes.

First, flash attention. The Qwen3 decoder had computed attention as two matrix multiplications and a softmax. ggml's `ggml_flash_attn_ext` computes these together without storing the full scores, which is faster on the GPU. With Metal on M5, attention for 2,000 cached positions fell from 2.62 to 2.20 milliseconds, and for 8,000 positions from 9.59 to 8.10 milliseconds. On the CPU it was slower, rising from 22.1 to 51.2 milliseconds at 8,000 positions. At model load, I therefore check `ggml_backend_supports_op` and use flash attention only when the GPU backend supports it.

Flash attention divides the work into small blocks and updates softmax incrementally, avoiding a large score matrix in memory ([Dao et al., 2022](https://arxiv.org/abs/2205.14135)). The CUDA library FlashAttention-2 targets RTX 30-series and newer GPUs, but ggml implements the approach in its own Metal and Vulkan shaders, so it also works on an RTX 2080 with Vulkan.

Second, I reused the computation graph between decoder steps. Building a ggml graph takes time, so it need not be rebuilt while its shape stays the same.

M5 decoding then reached 146–158 tokens per second for 0.6B, alongside llama.cpp's 147–157, and 58–63 for 1.7B, alongside 58–62. On RTX 2080, it became 13–25% faster than speech.cpp 0.7.0.

Here are the Japanese Common Voice 8.0 results, 4,483 examples, on Windows with an RTX 2080. VAD trims the silence at both ends. The second error-rate column allows the spelling variants described above. Latency runs from the request to the returned transcript. I also included NVIDIA's [NeMo-Speech.cpp](https://github.com/NVIDIA/NeMo-Speech.cpp), another ggml implementation of FastConformer.

| Model | Implementation | Weights | CER | CER with accepted spellings | Latency (median) | Latency (p90) |
|---|---|---|---|---|---|---|
| Qwen3-ASR 1.7B | **speech.cpp** | Q8_0 | 9.50% | 4.68% | **0.155 s** | **0.286 s** |
| Qwen3-ASR 1.7B | llama.cpp b11246 | Q8_0 | 9.28% | 4.60% | 0.173 s | 0.289 s |
| Qwen3-ASR 0.6B | **speech.cpp** | Q8_0 | 11.90% | 7.04% | **0.087 s** | **0.158 s** |
| Qwen3-ASR 0.6B | llama.cpp b11246 | Q8_0 | 11.80% | 6.94% | 0.105 s | 0.167 s |
| parakeet-tdt_ctc-0.6b-ja | **speech.cpp** | F16 | 7.88% | 2.98% | **0.069 s** | **0.130 s** |
| parakeet-tdt_ctc-0.6b-ja | CrispASR v0.8.38 | Q8_0 | 7.93% | 3.01% | 0.189 s | 0.280 s |
| ReazonSpeech NeMo v2 | **speech.cpp** (beam search) | F16 | 12.03% | 7.14% | 0.157 s | 0.268 s |
| ReazonSpeech NeMo v2 | **speech.cpp** (greedy) | F16 | 12.48% | 7.68% | 0.092 s | 0.149 s |
| ReazonSpeech NeMo v2 | CrispASR v0.8.38 | Q8_0 | 11.72% | 6.79% | 0.196 s | 0.302 s |
| ReazonSpeech NeMo v2 | NeMo-Speech.cpp v0.2.0 (greedy) | F16 | 11.81% | 6.99% | **0.059 s** | **0.101 s** |

Qwen3-ASR's accuracy is close to llama.cpp's, with latency 10% lower for 1.7B and 17% lower for 0.6B. parakeet matches CrispASR's accuracy with one-third of the latency. Some of that difference may come from the weights: speech.cpp uses F16 and CrispASR Q8_0.

For ReazonSpeech, NeMo-Speech.cpp was fastest and slightly more accurate. Even comparing greedy decoders, it was 1.6 times faster than speech.cpp. It was also 1.4 times faster on M5 and faster for parakeet-v3, as shown in the Appendix. I plan to investigate the FastConformer difference for a later release. Although CrispASR's ReazonSpeech sometimes adds 「あっ。」 around silence, in these trimmed recordings it was slightly more accurate than speech.cpp's beam search. Common Voice contains read speech; conversational speech may give different results.

llama.cpp is still a little faster in some M5 cases. Across 4,483 Common Voice examples, median latency was similar, but llama.cpp's p90 was 8% shorter. The difference grows with utterance length: for a 25.5-second Japanese utterance, 0.6B took 0.80 seconds in speech.cpp and 0.75 in llama.cpp. Decoding is now comparable, so the difference lies in the audio encoder and prompt processing. llama.cpp uses Metal 4's tensor API for those matrix multiplications; speech.cpp does not. A bug is the reason, as I'll explain next.

## A bug I found on M5

Just when the Irodori-TTS port seemed finished, one of 64 M5 samples turned into noise in its latter half. In 「暗証番号は4桁で、8264です。」 ("The PIN has four digits: 8264"), the "8264" ending was buried in static. The same text sounded clean on the CPU and RTX 2080.

The cause was ggml's Metal matrix multiplication. On M5 and newer chips, ggml uses Metal 4's tensor API. Its kernel wrote beyond the output only when the number of output columns was 64 modulo 128: 64, 192, 320 and so on. Those writes corrupted an adjacent tensor, changing the result from run to run.

The noisy sample hit exactly that condition. At the time, codec windows contained 48 frames with ten padding frames on either side. The third window of a 114-frame output covered frames 50–114, exactly 64 frames.

ggml's own `test-backend-ops` passed because it lacked this shape. Adding 64-column and 192-column cases made the tensor API fail, while disabling it with `GGML_METAL_TENSOR_DISABLE=1` made them pass ([speech.cpp#13](https://github.com/nyosegawa/speech.cpp/issues/13)).

There is only so much I can do before ggml itself is fixed. After comparing the same 20 texts on M5, I decided the difference was acceptable—or rather, something I had to accept—so speech.cpp disables the tensor API.

| | tensor API | Disabled |
|---|---|---|
| Irodori-TTS MF, First audio (median) | 0.19 s | 0.23 s |
| Irodori-TTS 16 steps, First audio (median) | 0.85 s | 1.12 s |
| Qwen3-TTS 0.6B, First audio (median) | 0.045 s | 0.043 s |
| Irodori-TTS codec, SNR against official implementation | 47.6 dB | 68.0 dB |

MF's first audio became 0.04 seconds slower, but the corruption disappeared and agreement with the official implementation improved. This is also a major factor in the M5 recognition gap discussed earlier. Once a newer ggml passes these shapes, I intend to enable the tensor API again and remeasure.

## Supporting OpenAI Realtime Transcription

So far, I have discussed individual utterances. In practice, I also wanted to transcribe long recordings such as meetings and show text while someone was speaking. Version 0.8.0 adds both.

### Whole recordings can lose sentences

While using the demo page, I noticed entire spoken sentences disappearing. The page sent audio in 20-second pieces. When a piece contained three or four sentences, ReazonSpeech sometimes dropped the first two. Official NeMo dropped the same sentences on the same audio, so this was a model characteristic, not a porting error.

I measured it by joining Japanese FLEURS and Common Voice test utterances with 0.3–1.0-second gaps into recordings lasting several minutes, then transcribing them whole and by speech region. The Appendix explains the construction. A sentence counts as dropped when more than half its characters disappear.

| Model | Whole (321 FLEURS / 600 Common Voice sentences) | By speech region (same sets) |
|---|---|---|
| ReazonSpeech NeMo v2 | 67 / 522 | 4 / 46 |
| parakeet-tdt_ctc-0.6b-ja | 264 / 266 | 0 / 11 |
| Qwen3-ASR 0.6B | 1 / 1 | 0 / 2 |

The two FastConformer models lose many sentences when given several minutes at once. Qwen3-ASR loses very few, and its CER is even slightly better on whole recordings, 9.80% versus 11.44% on FLEURS. I suspect its LLM decoder benefits from the longer context. ReazonSpeech still loses 46 Common Voice sentences when processed by region because short utterances from different speakers sometimes land in one region; that is a feature of this artificially concatenated test.

I ported [Silero VAD](https://github.com/snakers4/silero-vad) to find speech regions, transcribe them separately and join the results. It is a small 1.2 MB model and returns the same sample-level boundaries as the official `get_speech_timestamps`. Regions end after 0.5 seconds of silence, following OpenAI's default `server_vad` setting. Short pauses can still produce regions longer than 20 seconds, so I tested maximum region lengths from eight to 30 seconds and selected ten seconds, which gave the lowest average CER.

The HTTP server enables this with the OpenAI transcription API's `chunking_strategy`. First, start the server with both a recognition model and a VAD model. If the server from the earlier example is still running, stop it with Ctrl+C first.

```sh
speech serve reazonspeech-v2 silero-vad
```

Call it from another terminal using the OpenAI Python SDK:

```python
from openai import OpenAI

client = OpenAI(base_url="http://127.0.0.1:8080/v1", api_key="unused")
with open("meeting.wav", "rb") as f:
    print(client.audio.transcriptions.create(model="reazonspeech-nemo-v2", file=f, chunking_strategy="auto").text)
```

### Showing text while someone speaks

The other addition is live transcription. It follows [OpenAI Realtime transcription](https://developers.openai.com/api/docs/guides/realtime-transcription), so OpenAI clients can use it by changing the endpoint.

During speech, the Realtime API sends text in `delta` events. These can append text but cannot rewrite earlier text. OpenAI's `gpt-live-transcribe` also accumulates deltas and replaces the result with the full `completed` transcript at the end. Each time speech.cpp retranscribes the growing audio, it compares the result with the previous pass and sends only the prefix that agrees in two consecutive passes. Once speech ends, it sends the final transcript in `completed`.

I measured this on an otherwise idle M5 by streaming audio made from six utterances in real time, three times per model.

| | ReazonSpeech NeMo v2 | Qwen3-ASR 0.6B |
|---|---|---|
| Speech-start event (from onset) | 0.25–0.27 s | 0.25–0.27 s |
| First text (from onset) | 0.69–1.32 s | 0.50–1.15 s |
| Final transcript (from offset) | 0.70–0.79 s | 0.72–0.90 s |

About 0.6 seconds of the delay after speech ends comes from waiting to establish 0.5 seconds of silence. Lowering `silence_duration_ms` shortens it but makes breaths more likely to split utterances. The first text arrives later because two transcription passes must agree.

The command-line `--live` option transcribes a microphone in the same way. [miniaudio](https://github.com/mackron/miniaudio) is linked into the executable, so there is no SDL2 or PortAudio installation to manage.

ASIST does not use this particular mechanism. It decides when an utterance ends itself, using its backchannel classifier and [MaAI](https://github.com/MaAI-Kyoto/MaAI)'s turn-ending predictions. It passes its own completed utterances to the speech.cpp worker.

## What bringing everything together gives me

I have discussed synthesis and recognition separately, but putting them in one engine has benefits of its own.

First, there is less to distribute. speech.cpp needs one `speech` executable and one model file. The Mac executable in version 0.8.2 is about 6.7 MB; the Windows executable is 48 MB because it includes Vulkan shaders. Each model, including its codec, fits in one GGUF file. Releases provide macOS Metal, Windows Vulkan, and Linux Vulkan and CPU builds; the installer selects the appropriate one. Neither CUDA nor Python is required.

Startup is quick too. ASIST loads speech models only when the microphone is enabled, so slow loading would leave the user waiting after switching it on.

I measured the time from process launch until the first request could be accepted on M5, with model files already in the OS file cache.

| Implementation | Runtime requirements | Startup to ready |
|---|---|---|
| **speech.cpp** | One executable | **0.4 s** |
| mlx-audio | Python 3.12 and MLX | 2.3–3.1 s |
| audio.cpp | Server executable | 2.0–3.8 s |
| Official implementation | Python 3.10 and PyTorch | 9.0–11.0 s |

Every model is called through the same interfaces.

![The structure of speech.cpp](/img/speech-cpp/overview.png)

There are four ways to use it:

- The `speech` command: `speech tts` reads text, `speech asr` transcribes audio, and `speech voice` creates a voice file from reference audio.
- The HTTP server, `speech serve`: it follows the OpenAI audio APIs, `/v1/audio/speech` and `/v1/audio/transcriptions`, and Realtime transcription at `/v1/realtime`.
- The worker, `speech worker`: it exchanges JSON Lines over standard input and output. This is what ASIST uses.
- The C API, `speech.h`: all three interfaces above are built on it.

ASIST now runs both synthesis and recognition through speech.cpp workers and no longer bundles llama-server.

## What I ended up with

- Nine synthesis and recognition models, plus Silero VAD, run in one ggml-based engine with a single executable on Mac, Windows and Linux.
- While checking each stage against the official implementation, I reduced Irodori-TTS's time to first audio to 0.25 seconds on M5 and made Qwen3-ASR faster than llama.cpp on RTX 2080.
- I chose correctness over speed by disabling the M5 tensor API affected by the bug. FastConformer still trails NeMo-Speech.cpp in speed, which is something to work on next.
- Transcribing long recordings by Silero VAD regions greatly reduces dropped sentences, and live transcription works through an OpenAI-compatible Realtime interface.

## Update: faster FastConformer in 0.8.3 (2026-10-10)

The FastConformer work I mentioned above is now in [speech.cpp 0.8.3](https://github.com/nyosegawa/speech.cpp/releases/tag/v0.8.3). I reduced repeated memory allocation inside the FFT, cached position computations that stay the same across inputs, and reused decoder computation graphs.

Running 0.8.2 and 0.8.3 alternately on the same audio gave these median times to a returned transcript. All models use F16 weights; loading and the first warmup request are excluded.

| Model | M5 (Metal), 0.8.2 → 0.8.3 | RTX 2080 (Vulkan), 0.8.2 → 0.8.3 |
|---|---|---|
| ReazonSpeech NeMo v2, greedy | 72 → 54 ms | 76 → 47 ms |
| parakeet-tdt-0.6b-v3 | 102 → 93 ms | 128 → 82 ms |
| parakeet-tdt_ctc-0.6b-ja | 56 → 52 ms | 85 → 40 ms |

The Japanese timing sample uses the first 100 Common Voice inputs, 99 retained by VAD, repeated three times. English uses 300 FLEURS inputs, 299 retained by VAD, once each. These are different sample counts from the 4,483-input Japanese tables above, so they do not replace those results. ReazonSpeech's default beam search also improved from 104 to 85 ms on M5.

I checked accuracy separately on the complete sets on M5. Compared with the original article's run, ReazonSpeech greedy's CER on the 4,483 Japanese inputs changed from 12.50% to 12.49%, while CER allowing spelling variants stayed at 7.69%. Five of the 4,479 VAD-retained transcripts changed; empty results stayed at four. Parakeet v3's WER on 300 English inputs stayed at 8.76%.

Alternating requests with NeMo-Speech.cpp on the same audio now gives roughly equal speed on Windows. On M5, NeMo-Speech.cpp remains about 3 ms faster for ReazonSpeech and 7 ms faster for Parakeet v3, but disabling its tensor API makes speech.cpp as fast or faster. speech.cpp keeps the tensor API workaround described above. The [PR's measurement report](https://github.com/nyosegawa/speech.cpp/pull/91#issuecomment-6085048115) has the full conditions and p90 values.

The model files have not changed. Updating speech.cpp is enough; existing GGUF files still work.

## Appendix

### Measurement method

For comparisons between inference implementations, I used [speech-bench](https://github.com/nyosegawa/speech-bench), which I also develop. speech.cpp was a 0.8.0 candidate, commit `f5ab84c`, built locally for M5 and by CI for RTX 2080. All implementations were measured on October 8, 2026.

Synthesis was measured on M5 with 32 GB of memory and macOS 26.2, and on Windows 11 with an RTX 2080, 8 GB of VRAM and driver 591.86. The 20 texts in speech-bench's `prompts/speak-ja-JP.json` include backchannels, replies, longer explanations and Japanese mixed with English words. Irodori-TTS used the approximately ten-second `voice-bright-young-woman` reference generated for speech-bench, with seed 1. Qwen3-TTS used the preset ono_anna voice, with a new seed each time. The first text was synthesized once before measurement to exclude first-use GPU overhead. CER was calculated by transcribing the generated audio with Qwen3-ASR 1.7B.

ASIST playback was measured on October 9, 2026, using the released version 0.8.0, which bundles speech.cpp 0.8.2, on the same M5. After one warmup text per model, I played each of the same 20 texts once, with backchannels and bridge phrases disabled. Qwen3-TTS used ono_anna; Irodori-TTS used ASIST's bundled calm-young-woman voice. The conversation API returned the requested text exactly in all 60 cases. Synthesis start was estimated by subtracting the app's reported synthesis time from the time that measurement arrived in the renderer. Voice onset was the first 20 ms window of the scheduled audio with RMS at or above 0.004. Inter-process communication adds measurement error; output-device latency is excluded.

For underrun checks, the speech.cpp worker read the same 20 texts while I recorded chunk arrival times. Assuming playback starts with the first chunk, there is no underrun if every later chunk arrives before all preceding audio finishes playing.

Recognition used the Common Voice 8.0 Japanese test set, 4,483 examples with 93,471 reference characters, in the same order for every implementation on M5 and RTX 2080. silero-vad v4 found the speech boundaries; trimming retained 0.2 seconds on each side. Four examples with no detected speech were excluded. Qwen3-ASR used explicit `ja`, and latency excluded model loading.

Here are the M5 recognition results:

| Model | Implementation | Weights | CER | CER with accepted spellings | Latency (median) | Latency (p90) |
|---|---|---|---|---|---|---|
| Qwen3-ASR 1.7B | **speech.cpp** | Q8_0 | 9.49% | 4.67% | 0.309 s | 0.544 s |
| Qwen3-ASR 1.7B | llama.cpp b11246 | Q8_0 | 9.29% | 4.62% | **0.307 s** | **0.499 s** |
| Qwen3-ASR 0.6B | **speech.cpp** | Q8_0 | 11.89% | 7.05% | **0.132 s** | 0.231 s |
| Qwen3-ASR 0.6B | llama.cpp b11246 | Q8_0 | 11.79% | 6.95% | 0.133 s | **0.212 s** |
| parakeet-tdt_ctc-0.6b-ja | **speech.cpp** | F16 | 7.88% | 2.98% | **0.059 s** | **0.086 s** |
| parakeet-tdt_ctc-0.6b-ja | CrispASR v0.8.38 | Q8_0 | 8.03% | 3.12% | 0.071 s | 0.088 s |
| ReazonSpeech NeMo v2 | **speech.cpp** (beam search) | F16 | 12.03% | 7.13% | 0.110 s | 0.167 s |
| ReazonSpeech NeMo v2 | **speech.cpp** (greedy) | F16 | 12.50% | 7.69% | 0.077 s | 0.104 s |
| ReazonSpeech NeMo v2 | CrispASR v0.8.38 | Q8_0 | 11.79% | 6.88% | 0.074 s | 0.097 s |
| ReazonSpeech NeMo v2 | NeMo-Speech.cpp v0.2.0 (greedy) | F16 | 11.93% | 7.10% | **0.054 s** | **0.075 s** |

Here is parakeet-tdt-0.6b-v3 on 300 English FLEURS utterances:

| Platform | Implementation | Weights | WER | Latency (median) | Latency (p90) |
|---|---|---|---|---|---|
| M5 | **speech.cpp** | F16 | 8.76% | 0.103 s | 0.167 s |
| M5 | NeMo-Speech.cpp v0.2.0 | F16 | 9.06% | **0.085 s** | **0.134 s** |
| RTX 2080 | **speech.cpp** | F16 | 8.78% | 0.152 s | 0.221 s |
| RTX 2080 | NeMo-Speech.cpp v0.2.0 | F16 | 9.06% | **0.094 s** | **0.130 s** |

NeMo-Speech.cpp does not publish F16 weights, so speech-bench used its conversion script to produce F16 files.

The long-recording experiment used speech.cpp's `measure/region_cap_compare.py` on M5 with Metal. It took 321 Japanese FLEURS test sentences, one recording per sentence, and the first 600 Common Voice 8.0 Japanese test recordings, trimmed them with Silero VAD, normalized them to -23 dBFS and joined them with 0.3–1.0-second gaps. Every fourth gap was two to eight seconds long, with -60 dBFS noise in the gaps. The resulting 105.6 minutes were transcribed with Japanese specified. CER used NFKC normalization with punctuation and whitespace removed. Results for each maximum region length follow, as FLEURS / Common Voice:

| Region limit | ReazonSpeech CER | Dropped sentences | parakeet-ja CER | Dropped sentences | Qwen3-ASR 0.6B CER | Dropped sentences |
|---|---|---|---|---|---|---|
| Whole recording | 25.29% / 86.01% | 67 / 522 | 83.39% / 44.87% | 264 / 266 | 9.80% / 14.48% | 1 / 1 |
| No limit | 11.97% / 16.81% | 12 / 42 | 6.39% / 10.82% | 3 / 19 | 10.55% / 14.21% | 0 / 2 |
| 20 s | 11.32% / 16.81% | 10 / 42 | 6.06% / 10.82% | 1 / 19 | 10.65% / 14.21% | 0 / 2 |
| 15 s | 10.90% / 16.96% | 9 / 43 | 5.99% / 10.36% | 2 / 16 | 10.71% / 14.11% | 0 / 2 |
| 10 s | 10.25% / 17.17% | 4 / 46 | 5.75% / 9.97% | 0 / 11 | 11.44% / 14.17% | 0 / 2 |
| 8 s | 10.31% / 17.38% | 2 / 44 | 6.21% / 9.58% | 0 / 8 | 11.63% / 14.28% | 0 / 1 |

Live-transcription latency was measured by joining reference dump audio with silence, converting it to 24 kHz, and streaming it to `/v1/realtime` in real-time 20-millisecond pieces. Speech onset and offset are the edges of the unpadded speech regions.

### Stage-by-stage comparison results

These Irodori-TTS results start each stage from inputs dumped by the official implementation, on Apple M5:

| Stage | CPU, F32 | Metal, F32 |
|---|---|---|
| Text normalization and tokenizer (164 texts) | All match | All match |
| Text conditioning | 118–123 dB | 65–123 dB |
| Speaker conditioning | 111 dB | 51 dB |
| Duration prediction | All match | All match |
| Each DiT step | 95 dB or higher | 46 dB or higher |
| Sampler output (MF) | 86–122 dB | 36–67 dB |
| Codec decoding | 119 dB | 68 dB |
| Windowed versus full decoding | Match | Match |

Metal's SNR is lower because ggml's Metal matrix multiplication rounds inputs to half precision. MF takes only four large steps, so those differences remain in the latents. On Metal, the waveform therefore differs while speaking the same content.

Here is FastConformer, parakeet-tdt_ctc-0.6b-ja, on three Japanese FLEURS utterances lasting 6.36, 10.50 and 25.50 seconds:

| Stage | CPU, F32 | Metal |
|---|---|---|
| Features | 117–127 dB | Same (computed on CPU) |
| Convolutional subsampling | 123 dB | 68–70 dB |
| Encoder output (after 24 layers) | 114–118 dB | 63–64 dB |
| Tokens from official encoder output | Match | Match |
| Transcripts from audio (all stages ported) | All three match | All three match |

### Inside the GGUF file

Each speech.cpp model occupies one GGUF file, including its codec. Names and languages use the standard GGUF metadata keys, so tools that read GGUF can display that information.

| Key | Contents |
|---|---|
| `general.architecture` | Which implementation runs the model: `qwen3-tts`, `irodori-tts`, `fastconformer` or `qwen3-asr` |
| `general.name`, `general.organization`, `general.size_label`, etc. | Model name, publishing organization and parameter count |
| `general.source.url` | The source repository and revision |
| `general.languages` | Supported synthesis or recognition languages, as ISO 639 codes |
| `speech.layout`, `speech.requires` | File layout version and the earliest speech.cpp version that can read it |
| `speech.task`, `speech.sample_rate` | Synthesis or recognition, and the audio sample rate |

Before loading weights, speech.cpp checks that metadata and tensor names, shapes and types are complete. It rejects missing or unexpected entries by name. `speech info` displays this information without loading the weights.

### Reproducing the tensor API bug

Add matrix-multiplication cases with 64 and 192 output columns to ggml's `test-backend-ops` and run them on M5. They fail with incorrect results through the tensor API and pass when `GGML_METAL_TENSOR_DISABLE=1` disables it. Detailed instructions are in [speech.cpp#13](https://github.com/nyosegawa/speech.cpp/issues/13).

## References

- speech.cpp
    - [nyosegawa/speech.cpp](https://github.com/nyosegawa/speech.cpp)
    - [nyosegawa/speech-bench](https://github.com/nyosegawa/speech-bench)
    - [speech.cpp#13: Metal on Apple M5 corrupts matrix products whose column count is 64 modulo 128](https://github.com/nyosegawa/speech.cpp/issues/13)
    - [sakasegawa/common-voice-ja-accepted-spellings](https://huggingface.co/datasets/sakasegawa/common-voice-ja-accepted-spellings)
    - [ggml-org/ggml](https://github.com/ggml-org/ggml)
- Models
    - [Aratako/Irodori-TTS](https://github.com/Aratako/Irodori-TTS)
    - [Aratako/Irodori-TTS-v4.1-Small-MF](https://huggingface.co/Aratako/Irodori-TTS-v4.1-Small-MF)
    - [MeanFlow Distillation (Irodori-TTS docs)](https://github.com/Aratako/Irodori-TTS/blob/main/docs/meanflow.md)
    - [Qwen/Qwen3-TTS-12Hz-0.6B-CustomVoice](https://huggingface.co/Qwen/Qwen3-TTS-12Hz-0.6B-CustomVoice)
    - [Qwen/Qwen3-ASR-1.7B](https://huggingface.co/Qwen/Qwen3-ASR-1.7B)
    - [nvidia/parakeet-tdt_ctc-0.6b-ja](https://huggingface.co/nvidia/parakeet-tdt_ctc-0.6b-ja)
    - [nvidia/parakeet-tdt-0.6b-v3](https://huggingface.co/nvidia/parakeet-tdt-0.6b-v3)
    - [reazon-research/reazonspeech-nemo-v2](https://huggingface.co/reazon-research/reazonspeech-nemo-v2)
    - [snakers4/silero-vad](https://github.com/snakers4/silero-vad)
- OpenAI
    - [Realtime transcription](https://developers.openai.com/api/docs/guides/realtime-transcription)
- Paper
    - [Flow Straight and Fast: Learning to Generate and Transfer Data with Rectified Flow](https://arxiv.org/abs/2209.03003)
    - [Mean Flows for One-step Generative Modeling](https://arxiv.org/abs/2505.13447)
    - [FlashAttention: Fast and Memory-Efficient Exact Attention with IO-Awareness](https://arxiv.org/abs/2205.14135)
    - [Fast Conformer with Linearly Scalable Attention for Efficient Speech Recognition](https://arxiv.org/abs/2305.05084)
    - [Universals and cultural variation in turn-taking in conversation](https://www.pnas.org/doi/10.1073/pnas.0903616106)
    - [Lenient Evaluation of Japanese Speech Recognition: Modeling Naturally Occurring Spelling Inconsistency](https://aclanthology.org/2023.cawl-1.8/)
    - [Towards Orthographically-Informed Evaluation of Speech Recognition Systems for Indian Languages](https://arxiv.org/abs/2603.00941)
    - [HiKE: Hierarchical Evaluation Framework for Korean-English Code-Switching Speech Recognition](https://arxiv.org/abs/2509.24613)
    - [The Hidden Cost of Digits: Number Normalization and WER in ASR Systems](https://arxiv.org/abs/2609.21084)
    - [Echo-TTS](https://jordandarefsky.com/blog/2025/echo/)
    - [Qwen3-TTS Technical Report](https://arxiv.org/abs/2601.15621)
- Other implementations
    - [ggml-org/llama.cpp](https://github.com/ggml-org/llama.cpp)
    - [FunAudioLLM/CosyVoice](https://github.com/FunAudioLLM/CosyVoice)
    - [Blaizzy/mlx-audio](https://github.com/Blaizzy/mlx-audio)
    - [0xShug0/audio.cpp](https://github.com/0xShug0/audio.cpp)
    - [mackron/miniaudio](https://github.com/mackron/miniaudio)
    - [MaAI-Kyoto/MaAI](https://github.com/MaAI-Kyoto/MaAI)
- Articles on accelerating Irodori-TTS
    - [irodori-TTS を速くする方法を理解したい (株式会社Rosso)](https://note.com/rosso_blog/n/n3eaee67d2c70)
    - [AITuber向けに Mac MPS で Irodori-TTS をチューニングして2.72倍高速化 / bf16 では遅くなった (osushi_cr)](https://zenn.dev/yoshitetsu/articles/e616831f96b44a)
- ONNX Runtime
    - [CoreML Execution Provider](https://onnxruntime.ai/docs/execution-providers/CoreML-ExecutionProvider.html)
    - [DirectML Execution Provider](https://onnxruntime.ai/docs/execution-providers/DirectML-ExecutionProvider.html)
