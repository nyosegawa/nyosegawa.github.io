---
title: "spark-banana入門: ブラウザからそのままUI修正をCodexに渡す"
description: "spark-banana と spark-bridge を使って、UIの気になる箇所をブラウザ上から直接修正フローに乗せる方法をまとめます"
date: 2026-02-27
tags: [spark-banana, spark-bridge, Codex MCP, UI, React]
author: 逆瀬川ちゃん
---

こんにちは！逆瀬川ちゃん ([@gyakuse](https://x.com/gyakuse)) です！

今日は [spark-banana](https://github.com/nyosegawa/spark-banana) について、何が嬉しいのかと、最短で使い始める手順をまとめていきたいと思います。

<iframe
  width="100%"
  height="405"
  src="https://www.youtube.com/embed/w0AsZcxdujE"
  title="spark-banana demo"
  frameborder="0"
  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
  allowfullscreen
></iframe>

[YouTubeで見る](https://www.youtube.com/watch?v=w0AsZcxdujE)

<!--more-->

## spark-bananaって何？

一言でいうと、ローカル開発中のUI修正をブラウザから直接AIエージェントに渡すためのオーバーレイです。

よくある「気になる見た目を口頭で説明して、ファイルを探して、手で直す」という流れを、次のように短くできます。

- ブラウザで要素をクリック
- 修正指示をその場で入力
- `spark-bridge` が Codex MCP に中継
- 変更が反映される

この「見えている場所から修正を起こせる」体験が、いちばんの価値です。

## 全体構成

構成はシンプルです。

- `spark-banana`（overlay）: ブラウザUI
- `spark-bridge`（bridge）: WebSocketサーバーとCodex中継

```text
Browser (overlay)            Bridge server                  Your codebase
┌───────────────────────┐    ┌────────────────────────┐     ┌───────────────┐
│ Select element/region │───▶│ Prompt + queue + MCP   │────▶│ Files updated │
│ Add instruction       │◀───│ Status/progress over WS│     │ (HMR refresh) │
└───────────────────────┘    └────────────────────────┘     └───────────────┘
```

ここで重要なのは、overlayとbridgeが分離されていることです。アプリ側は `SparkAnnotation` を差し込むだけで、重い処理は bridge 側に逃がせます。

## 最短セットアップ

まずインストールします。

```bash
npm install -D spark-banana spark-bridge
```

次に bridge を起動します。

```bash
npx spark-bridge
```

デフォルトは `ws://localhost:3700` です。

アプリ側には overlay を追加します。

```tsx
import { SparkAnnotation } from 'spark-banana';

<SparkAnnotation projectRoot={import.meta.env.VITE_SPARK_PROJECT_ROOT} />
```

`projectRoot` は明示するのがおすすめです。Vite なら `.env` に次を置けばOKです。

```bash
VITE_SPARK_PROJECT_ROOT=/absolute/path/to/your/project
```

Next.js なら `.env.local` で次を使います。

```bash
NEXT_PUBLIC_SPARK_PROJECT_ROOT=/absolute/path/to/your/project
```

## 2つのモード

spark-banana には大きく2モードあります。

- Spark mode: 要素ベースで修正依頼
- Banana mode: スクリーンショットベースで提案を作ってから適用

「このボタンだけ直したい」は Spark、
「この領域全体をデザインごと寄せたい」は Banana、という使い分けがしやすいです。

## 実運用で効くポイント

紹介記事なので、実際に使って効いたポイントも先に書きます。

- 進捗ログが見えるので、裏で何が走っているかを追いやすい
- 承認フローがあるので、危ないコマンド実行を止められる
- 再接続時の進行中メッセージにも追従しやすくなっている
- i18nが最初から入っていて、チーム利用しやすい

特にUI作業は「見た目の認識ズレ」がコストになりがちなので、対象要素を起点にできる設計はかなり効きます。

## どんな人に向いているか

- フロントの細かい修正が多い人
- 「ここをこうしたい」をコードに落とすまでの往復を減らしたい人
- Codex連携をUI起点で回したい人

逆に、完全自動で放置したい用途よりは、画面を見ながら小刻みに指示を出すワークフローに向いています。

## まとめ

- spark-banana は「ブラウザ上の対象要素から修正を始める」ための道具です
- 導入は `spark-banana` + `spark-bridge` の2パッケージでシンプルです
- Spark / Banana の2モードで、ピンポイント修正と領域ベース修正を使い分けできます

## References

- [spark-banana Repository](https://github.com/nyosegawa/spark-banana)
- [spark-banana (npm)](https://www.npmjs.com/package/spark-banana)
- [spark-bridge (npm)](https://www.npmjs.com/package/spark-bridge)
