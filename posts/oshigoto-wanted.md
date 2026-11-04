---
title: "お仕事のご相談について"
description: "AIエージェントの開発、音声認識や音声合成、Coding Agentの環境構築、技術調査などのお仕事のご相談を受け付けています。"
date: 2026-03-27
tags: [お仕事募集]
author: 逆瀬川ちゃん
lang: ja
---

こんにちは！逆瀬川ちゃん ([@gyakuse](https://x.com/gyakuse)) です！

このページでは、お仕事のご相談の連絡先と、わたしにできること、これまでに作ったものをまとめています。

<!--more-->

## お仕事のご相談

開発のご依頼、技術調査、コンサルティング、ちょっとしたご相談まで、お気軽にご連絡ください。お受けできるかどうかは、内容と時期を伺ったうえでお返事します。

### 連絡先・ご依頼方法

以下のフォーマットでお気軽にご連絡ください。

宛先: [nyosegawa@gmail.com](mailto:nyosegawa@gmail.com)

```
件名: お仕事のご相談

・お名前 / 会社名:
・ご依頼内容の概要:
・ご希望の時期:
・ご予算:
・その他:
```

X ([@gyakuse](https://x.com/gyakuse)) のDMでも大丈夫です。

## できること

ざっくり以下のようなことができます。

- AIエージェント・AIアプリケーションの設計と開発
- Coding Agent環境の構築・最適化（Claude Code、Codex、Agent Skills, MCP, Harness）
- 音声対話アプリケーションの開発と、音声認識・音声合成モデルのC++ (ggml) への移植
- 音声認識(ASR)・OCR・構造化データ抽出などのAI/MLパイプライン構築
- 言語モデルのPost-Training(SFT、RLHF等)・ASRモデルのFine-Tuningなどのモデルトレーニング
- プロンプトエンジニアリング・プロンプトインジェクション対策
- 技術調査・リサーチ・ベンチマーク設計と実施
- 企画・要件定義・仕様策定
- 技術記事の執筆
- その他雑用なんでも

最近やっていることは[ブログ](https://nyosegawa.com/)や[Coding Agentなどについて最近書いた/作ったもののまとめ](https://zenn.dev/sakasegawa/articles/cc648c792823ea)や[10個のAIアプリケーションと3個のAIエージェントを1人で開発してみた](https://zenn.dev/sakasegawa/articles/2a7119364775e7)にまとまっています。

## 作ったもの

これまでに作ったものをざっとまとめます。

### 音声AI

- [speech.cpp](https://github.com/nyosegawa/speech.cpp): 音声合成、音声認識、音声区間検出、話者分離をひとつのコマンドで扱えるggml製のエンジン。Metal、Vulkan、CPUで動き、OpenAI互換のサーバーとしても使えます。MITライセンスで公開しています([紹介記事](https://nyosegawa.com/posts/speech-cpp/))
- [ASIST](https://asist-agent.com/): Mac / Windows向けの音声対話アシスタント。話しかけると声で答え、予定やメールをカードで表示し、時間のかかる作業はエージェントに任せます。音声の処理にはspeech.cppを使っています([紹介記事](https://nyosegawa.com/posts/asist-realtime-voice-assistant/))

### AIエージェント

- Task Agent: 20種類以上のツールを持つ汎用エージェント。自動調査、旅行日程作成、スライド生成など
- Computer Agent: Mac/Windows/Linux対応のPC操作自動化エージェント
- RPA Agent: 録画された作業を継続・反復実行する自動化エージェント

### AIアプリケーション (10個)

AI Study、AI Translator(100+言語対応)、AI Video Translator(動画吹替・字幕50言語)、AI Video Edit Assistant、AI Slide Generator、AI Stylist Assistant(バーチャル試着)、AI Chat、AI Search(初期レスポンス250ms以内)、AI Article Assistant、AI Data Analysis Assistantを開発しました。詳しくは[Zennの記事](https://zenn.dev/sakasegawa/articles/2a7119364775e7)をご覧ください。

### Coding Agent周辺

- [spark-banana](https://nyosegawa.com/posts/spark-banana-introduction/): ブラウザUI修正ツール(Codex Spark + Gemini)。npm公開
- [openclaw-defender](https://nyosegawa.com/posts/openclaw-defender/): 3層プロンプトインジェクション防御ライブラリ。npm公開
- [@sakasegawa/ncli](https://nyosegawa.com/posts/notion-cli-for-coding-agent/): Coding Agent向けNotion CLI。npm公開
- [MCP Light](https://nyosegawa.com/posts/mcp-light/): MCPのコンテキスト消費を83.5%削減するパターン
- [Skill Auditor](https://nyosegawa.com/posts/skill-auditor/): Agent Skillのポートフォリオ監査ツール

### AI/ML

- [ひらがなASR](https://nyosegawa.com/posts/hiragana-asr/): wav2vec2 + Dual CTCによるハルシネーションフリー音声認識モデル(315Mパラメータ)。HuggingFace公開
- [日本語手書きOCR 21モデル比較](https://nyosegawa.com/posts/japanese-handwriting-ocr-comparison/): APIモデル・OSSモデルの網羅的ベンチマーク
- [構造化OCR評価](https://nyosegawa.com/posts/structured-ocr-evaluation/): 5つのVLMによる構造化データ抽出ベンチマーク