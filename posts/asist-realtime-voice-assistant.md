---
title: "デスクトップ向け音声対話アシスタントを作った話"
description: "話しかけると相槌を打ち、答えをカードで返すデスクトップ (Windows / Mac) 向けの音声対話アシスタントASISTを作りました。音声対話で頑張ったところ、開発の進め方、プロモーション動画の作り方をまとめます。"
date: 2026-09-24
tags: [ASIST, Claude Code, Agent Skills, 音声アシスタント]
author: 逆瀬川ちゃん
---

こんにちは！逆瀬川ちゃん ([@gyakuse](https://x.com/gyakuse)) です！

今日はデスクトップ (Windows / Mac) 向けの音声対話アシスタント「[ASIST](https://asist-agent.com/)」を作ったので、その紹介と、作るときに頑張ったところをまとめていきたいと思います。

<!--more-->

## 未来っぽいUIの汎用アシスタントが作りたかった

さいきんパーソナルAIエージェントが増えてきています。代表的なものとしては、dotsやGrok Bot、Muse、Manusあたりでしょうか。
とてもよく作られている反面で、どっちかというとわたしはアニメや映画に出てくるような、複数のパネルがふわ〜っと動くものを欲しい気持ちがあります。でも、21世紀だというのに空中ディスプレイやARグラスは普及はしてません。ひとまずデスクトップアプリケーションとして作ることにしました。

AIアシスタントをつくるうえで、だいじにしたいことを最初にまとめました。

- 未来感があること
- 会話体験が良いこと
- 記憶が確かなこと
- 日常の支援ができること
- PC上の作業であれば接続をすれば何でもできること
- どこからでも使えること
- 拡張性が豊かであること

ASISTの最初のバージョンでは、これらのうち、さいごの2つ以外についてはある程度頑張れたかなと思っています。のこる2つについても、拡張性にかんしては[以前のアイデア](https://nyosegawa.com/posts/skill-with-app/)をもう少し汎用的にしたものを、使う場所についてもうまく対応していく予定です。

## あらためてASISTとは

ASISTはデスクトップ向けの音声対話アシスタントです。話しかけると声で答えて、天気や予定やメールの下書きを会話の横にカードで出します。時間のかかる作業は、承認したあとにcodexかclaudeのCLIへ任せられます。

![ASISTのホーム画面](/img/asist-realtime-voice-assistant/app-home.jpg)

公式サイトは[asist-agent.com](https://asist-agent.com/)です。アプリは[GitHubのReleases](https://github.com/nyosegawa/asist/releases/latest)からダウンロードでき、インストールから初回セットアップまでの手順はドキュメントの[インストール](https://asist-agent.com/docs/start/install/)のページにまとめています。動かすにはApple SiliconのMac (macOS 14以降) かx64のWindows 11と、会話に使うモデルのAPIキー (Anthropic、OpenAI、Google、Cerebrasのどれか1つ) が必要です。ソースコードは[nyosegawa/asist](https://github.com/nyosegawa/asist)でMIT Licenseのオープンソースとして公開しています。

主な機能は以下のとおりです。

- いい感じのテンポで話してくれる
- 必要な情報はカードを開いて見せてくれる (天気、予定、メール、To-Do、為替、地図など16種類のカードがあります)
- タスク、メモ、メール、カレンダーなどはミニアプリとしてアプリケーション上で開くことができます

## 音声対話で頑張ったところ

これは別途詳細記事を書く予定なのですが、音声アシスタントでいちばんしんどいのは待ち時間です。cascadeな構成(ASR→LLM→TTS)だと素朴につくると3秒くらいかかってしまいます。そこで、相槌などを挟んで最初のリアクションまでの時間稼ぎをしています。

![音声処理の流れ](/img/asist-realtime-voice-assistant/voice-pipeline.png)

## 開発について

さいきんはおもにClaude (Opus5.5) で開発していて、Modelの評価などではCodex (Sol-6.1) を使っています。
Coding Agentが一般化してからいろいろな開発環境が流行り、自分も[カンバン形式のAgentセッションマネージャー](https://x.com/nyosegawa/status/2025517872622239840/photo/1)を作り、モバイル対応もして使っていたのですが、そのあいだにClaude/Codexのデスクトップアプリがまともになってきました。普通にやるのがよいです。

また、Agent Skillsは10個程度にして、本当によくやることに絞ってます。
documentはだいたい腐るので、docs/adrに決定事項、issuesにやることを入れています。ADRも腐るので、頑張っていきましょう。

## プロモーション動画を作る

ClaudeでYouTubeとX向けの48秒の紹介動画を作りました。

<iframe
  width="100%"
  height="405"
  src="https://www.youtube.com/embed/fAtpmG9QMcw"
  title="ASIST 紹介動画"
  frameborder="0"
  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
  allowfullscreen
></iframe>

[YouTubeで見る](https://www.youtube.com/watch?v=fAtpmG9QMcw)

構成はシンプルで、HTMLとGSAPで場面を作り、headless Chromeで1/30秒ずつ撮って、ffmpegでまとめます。`npm run promo:video` でいつでも作り直せます。RemotionやHyperFramesのような仕組みはもう使わなくてよくなったので今回は利用していません。

![動画のコマ](/img/asist-realtime-voice-assistant/video-frames.jpg)

場面の切り替えやカードが出てくる時刻は、曲のテンポ (106 BPM) の拍にそろえています。速く動くものが自然ににじんで見えるように、1コマごとに16回撮って平均し、モーションブラーもかけています。

BGMはGeminiのLyria 3.5で3案作り、動画に当てて聞き比べてオルゴールにしました。曲は58秒あるので、和音がよく似ている2か所をつないで途中を飛ばし、48秒に収めています。効果音はCoding Agentがnumpyで書きました。すごい時代です。

## References

- [nyosegawa/asist](https://github.com/nyosegawa/asist)
- [Gemini API: Music generation (Lyria)](https://ai.google.dev/gemini-api/docs/music-generation)
- [OpenAI Images API](https://platform.openai.com/docs/guides/image-generation)
