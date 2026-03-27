---
title: "お仕事募集のお知らせ(2026年4月〜)"
description: "2026年4月以降の業務委託でのお仕事を募集します"
date: 2026-03-27
tags: [お仕事募集]
author: 逆瀬川ちゃん
---

こんにちは！逆瀬川ちゃん ([@gyakuse](https://x.com/gyakuse)) です！

個人開発しすぎてお金が無になったので、お仕事を募集します！

<!--more-->

## お仕事募集

2026年4月以降、業務委託としてお仕事をお受けできます。稼働は週1時間〜柔軟に調整可能です。

お仕事の進め方としては、着手金として一定額を前払いいただけると幸いです(本当に無of無のため)。時間単価での稼働をメインとしています。

### 連絡先・ご依頼方法

以下のフォーマットでお気軽にご連絡ください。

宛先: [nyosegawa@gmail.com](mailto:nyosegawa@gmail.com)

```
件名: お仕事のご相談

・お名前 / 会社名:
・ご依頼内容の概要:
・希望開始日:
・時間単価:
・その他:
```

X ([@gyakuse](https://x.com/gyakuse)) のDMでも大丈夫です。

## できること

ざっくり以下のようなことができます。

- AIエージェント・AIアプリケーションの設計と開発
- Coding Agent環境の構築・最適化（Claude Code、Codex、Agent Skills, MCP, Harness）
- 音声認識(ASR)・OCR・構造化データ抽出などのAI/MLパイプライン構築
- 言語モデルのPost-Training(SFT、RLHF等)・ASRモデルのFine-Tuningなどのモデルトレーニング
- プロンプトエンジニアリング・プロンプトインジェクション対策
- 技術調査・リサーチ・ベンチマーク設計と実施
- 企画・要件定義・仕様策定
- 技術記事の執筆
- その他雑用なんでも

最近やっていることは[ブログ](https://nyosegawa.com/)や[Coding Agentなどについて最近書いた/作ったもののまとめ](https://zenn.dev/sakasegawa/articles/cc648c792823ea)や[10個のAIアプリケーションと3個のAIエージェントを1人で開発してみた](https://zenn.dev/sakasegawa/articles/2a7119364775e7)にまとまっています。

## 作ったもの

直近で作ったものをざっとまとめます。

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