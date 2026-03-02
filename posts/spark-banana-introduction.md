---
title: "Codex Sparkとnanobananaを使ってUIを爆速で修正するツールを作った話"
description: "Codex Spark (gpt-5.3-codex-spark) とnanobanana (Gemini 3) を組み合わせて、ブラウザからUIをリアルタイムに修正するツール spark-banana を作りました"
date: 2026-02-27
tags: [spark-banana, Codex Spark, nanobanana, Gemini, UI, React]
author: 逆瀬川ちゃん
---

こんにちは！逆瀬川ちゃん ([@gyakuse](https://x.com/gyakuse)) です！

きょうは [spark-banana](https://github.com/nyosegawa/spark-banana) というUI爆速改造ツールを作ったので紹介していきたいと思います。

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

## spark-bananaとは？

まずは上の動画をご覧ください。だいたい雰囲気がわかるかなと思います。

ひとことで言うと、UIの特定の部分をクリックして指示を出すだけで [Codex MCP](https://github.com/openai/codex) を経由してコードが即座に修正されるツールです。さらにnanobananaで選択領域のスクリーンショットからデザイン提案を生成して、そこからCodexで実装を反映してくれます。べんり。

現在はViteとNext.js (React) に対応しています。

全体の構成はシンプルで、ブラウザ側のオーバーレイ (`spark-banana`) と、Codexへの中継をやるWebSocketサーバー (`spark-bridge`) の2つだけです。

```text
Browser (overlay)            Bridge server                  Your codebase
┌───────────────────────┐    ┌────────────────────────┐     ┌───────────────┐
│ Select element/region │───▶│ Prompt + queue + MCP   │────▶│ Files updated │
│ Add instruction       │◀───│ Status/progress over WS│     │ (HMR refresh) │
└───────────────────────┘    └────────────────────────┘     └───────────────┘
```

## 導入方法

### 前提条件

Codex CLIがインストール・認証済みである必要があります。

```bash
npm install -g @openai/codex
codex
```

### パッケージのインストール

```bash
npm install -D spark-banana spark-bridge
```

### bridgeサーバーの立ち上げ

bridgeサーバーはCodexとブラウザの中継を担当します。

```bash
npx spark-bridge
```

これだけでデフォルト `ws://localhost:3700` でWebSocketサーバーが立ち上がります。オプションでモデルやポートも変更できます。

```bash
npx spark-bridge --port 3700 --model gpt-5.3-codex-spark
```

### フロントエンドへの組み込み

アプリ側にはオーバーレイコンポーネントを1つ追加するだけです。

Viteの場合:

```tsx
import { SparkAnnotation } from 'spark-banana';

<SparkAnnotation projectRoot={import.meta.env.VITE_SPARK_PROJECT_ROOT} />
```

`.env` に以下を設定します。

```bash
VITE_SPARK_PROJECT_ROOT=/absolute/path/to/your/project
```

Next.jsの場合:

```tsx
'use client';
import { SparkAnnotation } from 'spark-banana';

export default function Spark() {
  if (process.env.NODE_ENV !== 'development') return null;
  return <SparkAnnotation projectRoot={process.env.NEXT_PUBLIC_SPARK_PROJECT_ROOT} />;
}
```

`.env.local` に以下を設定します。

```bash
NEXT_PUBLIC_SPARK_PROJECT_ROOT=/absolute/path/to/your/project
```

## 使い方

spark-bananaには3つのモードがあります。

### Spark mode

要素ベースの修正モードです。フローティングボタンを有効にして、修正したい要素をクリック、指示を入力して送信するだけです。Cerebras上で動いているCodex Spark (`gpt-5.3-codex-spark`) が爆速に修正を適用してくれます。「このボタンの色を変えたい」「この余白を詰めたい」みたいなピンポイント修正に向いています。

### Banana mode

スクリーンショットベースのデザイン提案モードです。領域を選択してキャプチャすると、nanobanana が3つのデザインバリエーションを画像つきで提案してくれます。気に入ったデザインを選ぶと、そのデザインにマッチするようにCodexが実装を反映します。「この領域全体の雰囲気を変えたい」みたいな大きめの修正に向いています。

### Plan mode

3つのアプローチを並べて比較できるモードです。Spark modeで要素を選択したあとPlanモードに切り替えると、3つの異なる実装案をCodexに生成させて比較できます。「デザインの方向性を検討したい」ときに便利です。

いずれのモードでも進捗ログがリアルタイムで見えますし、危ないコマンド実行には承認フローが入るので安心です。

## なぜこれを作ったか

モチベーションは3つありました。

1. Codex Sparkの技術検証
2. nanobananaを駆使したUI改善フローの効率化
3. Agentを使ったUI改修体験の未来を見たい

### Codex Sparkの技術検証

[Codex Spark](https://openai.com/index/introducing-gpt-5-3-codex-spark/) (gpt-5.3-codex-spark) はCerebras Wafer-Scale Engine上で動いていて、1,000+ tokens/secという驚異的な速度が出ます。gpt-5.3-codexの15倍速です。しかしあまりに速すぎるがゆえに人間の認知能力を超えてしまっていて、使い所が難しいという問題がありました。Cerebrasで動くLLMは人類にはいろんな意味ではやすぎるのです。

じっさいCodex Sparkが出た当初は持て囃されましたが、こう実用に乗せている、というひとはごく僅かに見受けられました。なぜ難しいのでしょうか。

それはただはやすぎるだけではなく、Context Windowが小さいというところが大きいのではないかと思います。

| | gpt-5.3-codex | gpt-5.3-codex-spark |
|---|---|---|
| Context Window | 400K | 128K |
| 速度 | ~65-70 tok/s | 1,000+ tok/s |
| マルチモーダル | 対応 | テキストのみ |
| SWE-Bench Pro | 75.1% | 72.8% |
| 複雑な推論 | 12+ステップ維持 | 6-8ステップで精度低下 |

128Kと400Kの差は大きく、[codex-rsの実装を読み解くと](https://zenn.dev/sakasegawa/articles/65895201c59e44#context-window%E3%81%AE%E5%88%B6%E9%99%90) (これはちょっと前の情報なので注意が必要ですが)、Context Windowの95%を利用したタイミングでCompactionが走ります。128Kだとわりとすぐにその壁に到達してしまうので、ふつうの使い方だとやはりデフォルトCodexが無難です。

しかし「はやい」というのは「リアルタイム性を持てる」ということです。なにか使えるはずです。リアルタイムな情報の解釈をSparkにやらせてもいいですし、リアルタイム対話Agentの裏側がSparkだったらおもしろそうです。今回はちょうどUIの細々とした修正がさいきん増えてきて「これだ」みたいな感触があったので、やってみました。UIのピンポイント修正ならContext Windowの制約も問題になりにくいですし、速さの恩恵を最大限受けられます。

CodexはOpenAIが[MCPを公開](https://github.com/openai/codex)してくれているので、安心して繋ぎこむことができます。ただ、あんまりこういう事例がなかったので一応公式に問い合わせたり、[Developer Forumで相談](https://community.openai.com/t/building-a-browser-to-codex-bridge-via-codex-mcp-server-tou-clarification-needed/1375345)したりしていました。

### nanobananaを駆使したUI改善フローの効率化

さて、Spark modeの話をしましたが、UIの改善にはもうひとつの大きな課題がありました。さいきんわたしがよくやっていたアプローチとして以下のようなものがあります。

1. 現状のスクショを撮る (特定の部分 or 全体)
2. nanobananaにスクショを渡して何個か案を出してもらう
3. 良い案をCoding Agentに渡して修正してもらう

バケツリレーを人間がやるのは非効率なので、これを自動化したかったのです。

spark-bananaのBanana modeはまさにこのフローを一気通貫で実現します。内部的には [nanobanana](https://ai.google.dev/gemini-api/docs/image-generation) (Gemini API) を使って3つのデザインバリエーションを並列生成し、選んだデザインをCodexに渡して実装させます。先日 [Nano Banana 2](https://blog.google/innovation-and-ai/technology/ai/nano-banana-2/) (Gemini 3.1) が出たタイミングなので、生成速度も品質も非常によくなっています。

ここで気をつけるべきことがあります。nanobananaの修正案画像はSparkモデルでは読めません。さきほど表で示したとおりCodex Sparkはテキストモーダルのみだからです。そのためBanana modeの適用時にはgpt-5.3-codexに渡す仕様になっています。画像→テキスト変換LLMを挟む手もありますが、できるだけ情報損失なく実装モデルに渡したいモチベーションがありました。

### Agentを使ったUI改修体験の未来を見たい

さいきんはいろんなUI系のツールが増えてきています。最初のモックづくりはだいぶいい感じになりました。しかし進行中の改善はまだ直感的に操作が難しいです。

将来を考えるとユーザーサイドが好きなUIUXで情報を受け取るような状況が大いにありえます。リアルタイム動画生成モデルによってUIはすべて映像に溶け込むかもしれませんし、ほかの表現 (AR/VRなど) かもしれません。でも現時点での一番良い体験はどこかと考えると、たぶん喋りながらいい感じに変わってくれるような感じなのでしょう。喋るだけだと伝わらないので、マウスや指で指定してあげるとよいです。アイアンマンにおいてJARVISとトニースタークが対話的にUI/設計を改修していましたが、そういう体験を届けたいのです。

今回はパパっと作ったためネイティブには音声対応はしていませんが、わたしがさいきん作った [audio-input](https://github.com/nyosegawa/audio-input) みたいなディクテーションインターフェイス (こういうツールはさいきん大量に増えています) を介せば、まあまあいい感じにやれます。今後の改修予定として、そういう音声対話的な体験に対応していくつもりです。

## おわりに

今回はspark-bananaというツールを紹介しました。まだまだバグばかりだと思いますが、よかったら使ってみて感想を [@gyakuse](https://x.com/gyakuse) まで教えてください！

## References

- [spark-banana Repository](https://github.com/nyosegawa/spark-banana)
- [spark-banana (npm)](https://www.npmjs.com/package/spark-banana)
- [spark-bridge (npm)](https://www.npmjs.com/package/spark-bridge)
- [Introducing GPT-5.3-Codex-Spark | OpenAI](https://openai.com/index/introducing-gpt-5-3-codex-spark/)
- [OpenAI GPT-5.3-Codex-Spark | Cerebras](https://www.cerebras.ai/blog/openai-codexspark)
- [Codex 5.3 vs. Codex Spark: Speed vs. Intelligence](https://www.turingcollege.com/blog/codex-5-3-vs-codex-spark-speed-vs-intelligence)
- [Coding Agentの実装から考えるContext Windowの制限](https://zenn.dev/sakasegawa/articles/65895201c59e44)
- [Nano Banana 2 | Google](https://blog.google/innovation-and-ai/technology/ai/nano-banana-2/)
- [Gemini API Image Generation (Nano Banana)](https://ai.google.dev/gemini-api/docs/image-generation)
- [audio-input](https://github.com/nyosegawa/audio-input)
