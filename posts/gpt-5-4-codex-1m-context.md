---
title: "GPT-5.4が来た: Codexで1Mコンテキストを有効にする方法と他モデルとの比較"
description: "GPT-5.4の概要、Codexのmodels.jsonから読み解くinstructionsの進化、1Mコンテキストウィンドウの有効化方法、そしてClaude/Geminiとのベンチマーク・価格比較をまとめました"
date: 2026-03-06
tags: [GPT-5.4, OpenAI, Codex, LLM]
author: 逆瀬川ちゃん
---

こんにちは！逆瀬川 ([@gyakuse](https://x.com/gyakuse)) ちゃんです

今日はOpenAIから本日リリースされたGPT-5.4について、Codexリポジトリのソースコードから読み取れるinstructionsの進化、1Mコンテキストウィンドウの有効化方法、そして他モデルとのベンチマーク比較をまとめていきたいと思います。

<!--more-->

## GPT-5.4の概要

GPT-5.4は2026年3月6日（日本時間）にリリースされたOpenAIの最新フロンティアモデルです。ChatGPT（GPT-5.4 Thinking として）、API、[Codex](https://github.com/openai/codex)の3つのプラットフォームで利用できます。

ポジショニングとしてはGPT-5.3-Codexのコーディング能力をベースに、知識ワーク・コンピュータ操作・ツール利用を大幅に強化した統合モデルです。[公式ブログ](https://openai.com/index/introducing-gpt-5-4/)では「our most capable and efficient frontier model for professional work」と紹介されています。

主要な新機能をざっくり整理するとこうなります。

- コンピュータ操作: 汎用モデルとして初めてネイティブなcomputer-use能力を搭載。OSWorld-Verifiedで75.0%（人間の72.4%を超える）
- 1Mコンテキスト: APIとCodexで最大100万トークンのコンテキストウィンドウを実験的にサポート
- ツール検索: tool searchという仕組みで大量のツール定義をコンテキストに入れずに効率的にツールを使える。MCP Atlasベンチマークでトークン使用量47%削減。ただしこのアプローチ自体はAnthropicが2025年10月に[`defer_loading`パラメータとtool search tool](https://www.anthropic.com/engineering/advanced-tool-use)としてClaude APIに導入済みです。Claude Codeでも[MCP Tool Search](https://code.claude.com/docs/en/mcp)として本番実装されており、MCPツール定義がコンテキストの10%を超えると自動的に有効化されます。OpenAIがGPT-5.4で追いついた形です
- トークン効率: GPT-5.2と比較してreasoningトークンが大幅に減少し、同じ問題をより少ないトークンで解ける
- /fastモード: Codexで最大1.5倍のトークン速度。同じモデル、同じ知性で速度だけ上がる

### OpenAI公式ベンチマーク結果

[公式ブログ](https://openai.com/index/introducing-gpt-5-4/)が発表している主要ベンチマーク結果を表にします。

| 評価項目 | GPT-5.4 | GPT-5.4 Pro | GPT-5.3-Codex | GPT-5.2 |
|---|---|---|---|---|
| GDPval（知識ワーク） | 83.0% | 82.0% | 70.9% | 70.9% |
| SWE-Bench Pro | 57.7% | - | 56.8% | 55.6% |
| OSWorld-Verified（コンピュータ操作） | 75.0% | - | 74.0% | 47.3% |
| Toolathlon（ツール使用） | 54.6% | - | 51.9% | 46.3% |
| BrowseComp（ウェブ検索） | 82.7% | 89.3% | 77.3% | 65.8% |
| MMMU Pro（視覚理解） | 81.2% | - | - | 79.5% |
| ARC-AGI-2（抽象推論） | 73.3% | 83.3% | - | 52.9% |
| GPQA Diamond | 92.8% | 94.4% | 92.6% | 92.4% |
| Humanity's Last Exam（ツールあり） | 52.1% | 58.7% | - | 45.5% |
| FrontierMath Tier 1-3 | 47.6% | 50.0% | - | 40.7% |

特に目を引くのはOSWorld-Verifiedです。GPT-5.2の47.3%から75.0%に跳ね上がっていて、人間のパフォーマンス（72.4%）を超えています。コンピュータ操作能力が一気に実用レベルに到達した感があります。

GDPvalも70.9%から83.0%へと大幅に向上しています。これは44の職種にわたるプロフェッショナルの知識ワーク（営業資料、会計スプレッドシート、法的分析など）で業界プロフェッショナルと同等以上の品質を出せるかという評価で、かなり実務寄りの指標です。

ハルシネーション低減も注目ポイントで、個々の主張が誤りである確率がGPT-5.2比で33%減少、レスポンス全体にエラーが含まれる確率は18%減少しています。

## models.jsonから読み解くinstructionsの進化

さて、ベンチマーク結果だけでは見えない話があります。CodexはOSSなので、モデル定義ファイル [codex-rs/core/models.json](https://github.com/openai/codex/blob/main/codex-rs/core/models.json) を読むと、各モデルに渡されるbase_instructions（システムプロンプト）の設計思想がわかります。自分はモデル更新のたびに読んでいますが、めちゃくちゃ面白いです。GPT-5.4とGPT-5.3-Codexは構造が非常に似ていますが、微妙な差分にCodex開発チームの意図が透けて見えます。

### 「エキスパートエンジニア」としての自己認識

GPT-5.4のGeneralセクションにはGPT-5.3-Codexにない導入文が追加されています。

```
As an expert coding agent, your primary focus is writing code, answering questions,
and helping the user complete their task in the current environment. You build context
by examining the codebase first without making assumptions or jumping to conclusions.
You think through the nuances of the code you encounter, and embody the mentality
of a skilled senior software engineer.
```

「skilled senior software engineer」のメンタリティを体現せよ、という明示的な指示です。5.3-Codexにはこの導入文がなく、いきなり具体的なルールから始まっていました。

ところで、こうしたロールプロンプティングの効果は研究上は決着がついていません。初期にはKong et al.が[12のベンチマークでrole-play promptingがzero-shot推論を改善する](https://arxiv.org/abs/2308.07702)と報告しましたが（NAACL 2024）、Zheng et al.は[162のペルソナ×4モデル×2,410のファクト問題で、ペルソナ追加は効果なし〜微減](https://arxiv.org/abs/2311.10054v3)という逆の結論を出しています（2024年10月更新）。つまり汎用的な「あなたは○○の専門家です」は、少なくともfactualタスクでは効かないというのが現時点での知見です。

では、なぜCodex開発チームはこれを入れたのか。ここがポイントで、エージェントのsystem promptにおけるロール定義は、ベンチマークスコアを上げるためのペルソナ付与とは目的が異なります。[dbreunig (2026)](https://www.dbreunig.com/2026/02/10/system-prompts-define-the-agent-as-much-as-the-model.html)が6つのコーディングエージェントのsystem promptを分析して指摘しているように、system promptの役割は**モデルの訓練データバイアスを補正し、行動の境界を定義すること**です。コメント過多の抑制、ツール呼び出しの並列化、スコープの限定——これらは「賢くなれ」ではなく「こう振る舞え」という制約です。「skilled senior software engineer」も同様に、過剰に親切な説明やコメントを生成しがちなモデルのデフォルト挙動を「実務寄りのエンジニアリング判断」にキャリブレーションする意図と読むのが妥当でしょう。

### apply_patchの強制化

GPT-5.3-Codexでは「try to use apply_patch for single file edits, but it is fine to explore other options」と柔軟な指示でした。GPT-5.4ではこう変わっています。

```
- Always use apply_patch for manual code edits. Do not use cat or any other commands
  when creating or editing files.
```

「always」で「Do not use cat」と明示的に禁止しています。apply_patchを経由したほうがdiffのトラッキングやユーザーへの変更提示が確実にできるため、エージェントの挙動を予測可能にするための厳格化です。

### 予期しない変更への対応: パニック→冷静に

GPT-5.3-Codexでは作業中に予期しない変更を見つけた場合の指示がこうでした。

```
- While you are working, you might notice unexpected changes that you didn't make.
  If this happens, STOP IMMEDIATELY and ask the user how they would like to proceed.
```

GPT-5.4ではより冷静な対応に変更されています。

```
- While you are working, you might notice unexpected changes that you didn't make.
  It's likely the user made them, or were autogenerated. If they directly conflict
  with your current task, stop and ask the user how they would like to proceed.
  Otherwise, focus on the task at hand.
```

「STOP IMMEDIATELY」が消え、「ユーザーが作った変更か自動生成かもしれない。直接衝突する場合だけ聞け、それ以外は手元の作業に集中せよ」という指示になっています。長時間のエージェントセッションではlinterやformatterによる自動変更が頻繁に起きるので、いちいち止まっていたら作業が進まないという実運用の知見が反映されています。

### intermediary updatesの頻度調整: 20秒→30秒

GPT-5.3-Codexでは中間アップデートの頻度が20秒ごとでしたが、GPT-5.4では30秒ごとに変更されています。

```
# 5.3-Codex
- You provide user updates frequently, every 20s.

# 5.4
- You provide user updates frequently, every 30s.
```

加えてGPT-5.4には「When working for a while, keep updates informative and varied, but stay concise.」という一文が追加されています。更新頻度を下げつつ品質を上げる方向の調整です。20秒だとユーザーへの割り込みが多すぎたのでしょう。

### Reactコードのモダンパターン指示

GPT-5.4のFrontend tasksセクションにはGPT-5.3-Codexにない指示が追加されています。

```
- For React code, prefer modern patterns including useEffectEvent, startTransition,
  and useDeferredValue when appropriate if used by the team. Do not add
  useMemo/useCallback by default unless already used; follow the repo's
  React Compiler guidance.
```

React Compilerへの対応を明示的に指示しています。useMemo/useCallbackをデフォルトで追加しないという指示は、React Compilerがこれらを自動最適化する前提で書かれています。

### bashコマンドチェーンの禁止

GPT-5.4では並列ツール呼び出しの指示に以下が追加されています。

```
Never chain together bash commands with separators like `echo "====";`
as this renders to the user poorly.
```

GPT-5.3-Codexにはこの制約がありませんでした。エージェントが`echo "====" ; cat file.txt ; echo "====="`のようなコマンドチェーンを組み立てると、Codex UIでの表示が崩れるという実運用上のバグフィックスです。

## Codexで1Mコンテキストウィンドウを有効にする

このmodels.jsonを見るとわかる通り、GPT-5.4の`context_window`はデフォルトで272,000トークンです。ですが実験的に1M（100万トークン）まで拡張できます。

### 設定方法

2つの方法があります。

**方法1: CLIフラグで直接指定する**

Codexの`-c`フラグを使えば、config.tomlを編集せずにその場で設定できます。

```bash
codex -m gpt-5.4 -c model_context_window=1000000 -c model_auto_compact_token_limit=900000
```

`-c key=value`は`config.toml`の任意のキーをCLIからオーバーライドできる汎用フラグです（[codex-rs/utils/cli/src/config_override.rs](https://github.com/openai/codex/blob/main/codex-rs/utils/cli/src/config_override.rs)）。値はTOMLとしてパースされ、整数はそのまま整数として扱われます。試しに1Mコンテキストを使ってみたいときにはこちらが手軽です。

**方法2: config.tomlに書く**

常用するなら `~/.codex/config.toml` に以下を追記します。

```toml
model = "gpt-5.4"
model_context_window = 1000000
model_auto_compact_token_limit = 900000
```

この2つのパラメータの役割を説明します。

- `model_context_window`: モデルのコンテキストウィンドウサイズ（トークン数）。デフォルトは272,000。1Mに設定することで100万トークンまで会話履歴を保持できる
- `model_auto_compact_token_limit`: 会話履歴の自動圧縮（auto-compact）が発動するトークン数の閾値。この値を超えると古い会話がサマリに圧縮される

### 仕組みの解説

Codexのソースコードを見ると、この設定がどう反映されるかがわかります。

[codex-rs/core/src/models_manager/model_info.rs](https://github.com/openai/codex/blob/main/codex-rs/core/src/models_manager/model_info.rs)のoverride処理がこうなっています。

```rust
pub(crate) fn with_config_overrides(mut model: ModelInfo, config: &Config) -> ModelInfo {
    // ...
    if let Some(context_window) = config.model_context_window {
        model.context_window = Some(context_window);
    }
    if let Some(auto_compact_token_limit) = config.model_auto_compact_token_limit {
        model.auto_compact_token_limit = Some(auto_compact_token_limit);
    }
    // ...
}
```

`config.toml`の値が直接ModelInfoに反映される素直な設計です。デフォルトのGPT-5.4の定義（[codex-rs/core/models.json](https://github.com/openai/codex/blob/main/codex-rs/core/models.json)）では`context_window: 272000`で、`auto_compact_token_limit`は未設定です。auto_compact_token_limitが未設定の場合はコンテキストウィンドウの95%（`effective_context_window_percent: 95`）が実効的な上限として使われます。

つまりデフォルトだとおよそ258,400トークンで自動圧縮が走ります。1Mに拡張するときは`model_context_window`を1000000にして、`model_auto_compact_token_limit`で明示的に圧縮閾値を指定するのが推奨です。上の例では900,000にしていますが、これはお好みで調整してください。

### コストに関する注意

ここで重要な注意点があります。[公式ブログ](https://openai.com/index/introducing-gpt-5-4/)にこう書かれています。

> Requests that exceed the standard 272K context window count against usage limits at 2x the normal rate.

272Kを超えるリクエストは通常の2倍のレートで課金されます。つまり1Mコンテキストをフルに使うと、272K以降の部分は入力$5.00/M tokens、出力$30.00/M tokensになります。巨大なコードベースを一気に食わせたいときには便利ですが、コストには気をつけましょう。

### どういうケースで使うか

1Mコンテキストが活きるのは以下のようなケースです。

- 大規模リポジトリの横断的なリファクタリングで全体像を把握したい
- 長時間のデバッグセッションで会話履歴を圧縮させたくない
- 複数ファイルにまたがるアーキテクチャレビュー

逆に通常のコーディング作業であればデフォルトの272Kで十分なケースが多いはずです。auto-compactは優秀なので、よほど「圧縮で文脈が失われて困る」という体験がない限りはデフォルトのままでいいと思います。

## 他モデルとの比較

さて、Codex内部の設計を見てきたところで、GPT-5.4が他のフロンティアモデルとどう並ぶかを見ていきましょう。

### API価格比較

まずは価格から。コスト構造の違いは選択に直結するので大事です。

| モデル | 入力 ($/M tokens) | キャッシュ入力 ($/M tokens) | 出力 ($/M tokens) | ソース |
|---|---|---|---|---|
| GPT-5.4 | $2.50 | $0.25 | $15.00 | [OpenAI](https://openai.com/index/introducing-gpt-5-4/) |
| GPT-5.4 Pro | $30.00 | - | $180.00 | [OpenAI](https://openai.com/index/introducing-gpt-5-4/) |
| GPT-5.2 | $1.75 | $0.175 | $14.00 | [OpenAI](https://openai.com/index/introducing-gpt-5-4/) |
| Claude Sonnet 4.6 | $3.00 | - | $15.00 | [Anthropic](https://platform.claude.com/docs/en/about-claude/pricing) |
| Claude Opus 4.6 | $5.00 | - | $25.00 | [Anthropic](https://platform.claude.com/docs/en/about-claude/pricing) |
| Gemini 2.5 Pro | $1.25 | - | $10.00 | [Google](https://ai.google.dev/gemini-api/docs/pricing) |

GPT-5.4はGPT-5.2より入力が43%高くなっています（$1.75→$2.50）。ただしOpenAIはGPT-5.4のトークン効率がGPT-5.2より大幅に改善されていると主張しており、同じタスクに必要な総トークン数が減るため実質コストは下がるケースもあるとのことです。

Claude Sonnet 4.6と比較すると入力はGPT-5.4が安く（$2.50 vs $3.00）、出力は同額（$15.00）です。Gemini 2.5 Proは入出力ともに最安ですが、各モデルの得意分野が異なるのでコストだけでは判断できません。

なお各モデルとも200K超のコンテキスト利用時は2倍課金が一般的になっています。1Mコンテキストを使う場合はどのモデルでもコスト増を覚悟する必要があります。

### ベンチマーク横断比較

GPT-5.4は本日リリースされたばかりなのでサードパーティの統一条件ベンチマークはまだ出揃っていませんが、各社公式発表のスコアを並べるとこうなります。

| 評価項目 | GPT-5.4 | Claude Opus 4.6 | Gemini 3.1 Pro | ソース |
|---|---|---|---|---|
| OSWorld-Verified（コンピュータ操作） | 75.0% | 72.7% | - | [OpenAI](https://openai.com/index/introducing-gpt-5-4/), [Vellum](https://www.vellum.ai/blog/claude-opus-4-6-benchmarks) |
| SWE-Bench Verified（コーディング） | - | 80.8% | 80.6% | [Digital Applied](https://www.digitalapplied.com/blog/gpt-5-4-vs-opus-4-6-vs-gemini-3-1-pro-best-frontier-model) |
| SWE-Bench Pro（コーディング） | 57.7% | - | 54.2% | [OpenAI](https://openai.com/index/introducing-gpt-5-4/), [Digital Applied](https://www.digitalapplied.com/blog/gpt-5-4-vs-opus-4-6-vs-gemini-3-1-pro-best-frontier-model) |
| Terminal-Bench 2.0 | 75.1% | 65.4% | 68.5% | [Digital Applied](https://www.digitalapplied.com/blog/gpt-5-4-vs-opus-4-6-vs-gemini-3-1-pro-best-frontier-model) |
| GPQA Diamond（科学推論） | 92.8% | 91.3% | 94.3% | [OpenAI](https://openai.com/index/introducing-gpt-5-4/), [Creati AI](https://creati.ai/ai-news/2026-02-20/google-gemini-3-1-pro-release-beats-gpt-5-2-claude-benchmarks/) |
| ARC-AGI-2（抽象推論） | 73.3% | 68.8% | 77.1% | [OpenAI](https://openai.com/index/introducing-gpt-5-4/), [ARC Prize](https://arcprize.org/leaderboard) |
| MMMU Pro（視覚理解） | 81.2% | 85.1% | 80.5% | [OpenAI](https://openai.com/index/introducing-gpt-5-4/), [Digital Applied](https://www.digitalapplied.com/blog/gpt-5-4-vs-opus-4-6-vs-gemini-3-1-pro-best-frontier-model) |
| GDPval（知識ワーク） | 83.0% | 78.0% | - | [OpenAI](https://openai.com/index/introducing-gpt-5-4/), [Digital Applied](https://www.digitalapplied.com/blog/gpt-5-4-vs-opus-4-6-vs-gemini-3-1-pro-best-frontier-model) |
| BrowseComp（ウェブ検索） | 82.7% | 84.0% | 85.9% | [Digital Applied](https://www.digitalapplied.com/blog/gpt-5-4-vs-opus-4-6-vs-gemini-3-1-pro-best-frontier-model) |
| MCP Atlas（ツール連携） | 67.2% | - | 69.2% | [OpenAI](https://openai.com/index/introducing-gpt-5-4/), [Digital Applied](https://www.digitalapplied.com/blog/gpt-5-4-vs-opus-4-6-vs-gemini-3-1-pro-best-frontier-model) |

注意: 各社公式のスコアは評価条件（scaffolding、reasoning effort設定、ツール構成等）が異なるため、厳密なapples-to-apples比較ではありません。あくまで各モデルの得意領域の傾向を把握するためのものです。

この表から見えてくるパターンは明確です。

コンピュータ操作とターミナル操作はGPT-5.4が最強です。OSWorld 75.0%、Terminal-Bench 75.1%ともにトップ。Codexのようなエージェント型ワークフローではこの差が効いてきます。

科学推論と抽象推論ではGemini 3.1 Proが強いです。GPQA Diamond 94.3%、ARC-AGI-2 77.1%でリードしています。

視覚理解ではClaude Opus 4.6がMMMU Pro 85.1%でトップです。ドキュメントパースやUI解析を重視する場合はOpus 4.6に分があります。

知識ワーク（GDPval）ではGPT-5.4が83.0%で最高スコアです。プロフェッショナルの実務タスク（スプレッドシート、プレゼン、法的分析）での実力を示しています。

ウェブ検索（BrowseComp）はGemini 3.1 Proが85.9%でトップですが、GPT-5.4 Pro（89.3%）はさらに上です。

つまり「全方面で最強」なモデルは存在せず、タスクの性質で最適解が変わります。

### コーディング用途での選び方

実務でのモデル選択の観点で整理します。

- GPT-5.4: Codexとの統合が最も深い。computer-use、1Mコンテキスト、commentaryチャネルによるmid-response steeringなど独自機能が多い。特にTerminal-Bench 75.1%が示すように長時間のエージェントセッションやターミナル操作で真価を発揮する
- Claude Opus 4.6: SWE-Bench Verified 80.8%が示す通りコーディング品質が高い。MMMU Pro 85.1%で視覚理解もトップクラス。ドキュメント駆動のコードレビューに強い
- Claude Sonnet 4.6: Opus 4.6の約60%のコストで近い性能。コスパ重視なら有力な選択肢
- Gemini 3.1 Pro: 抽象推論（ARC-AGI-2 77.1%）と科学推論（GPQA 94.3%）がトップ。APIコストも$2/$12と競争力がある

Codexを使っているならGPT-5.4がファーストチョイスですが、API経由で複数モデルを使い分ける場合はタスク特性と予算で選ぶのがよいでしょう。

## まとめ

- GPT-5.4はコンピュータ操作（OSWorld 75.0%で人間超え）と知識ワーク（GDPval 83.0%）で大幅な進化を遂げた統合フロンティアモデル
- Codexのmodels.jsonでGPT-5.3-Codex→5.4のinstructions差分を読むと、apply_patchの強制化、予期しない変更への冷静な対応、React Compiler対応など実運用フィードバックに基づく改善が見える
- Codexで1Mコンテキストを使うには`codex -m gpt-5.4 -c model_context_window=1000000 -c model_auto_compact_token_limit=900000`か、`config.toml`に同等の設定を書く。272K超は2倍課金
- 他モデルとの比較ではタスクによって得手不得手があり、全方面最強ではない。コンピュータ操作・ターミナル操作ならGPT-5.4、コーディング品質ならClaude Opus 4.6、推論ならGemini 3.1 Pro

## References

- [Introducing GPT-5.4 | OpenAI](https://openai.com/index/introducing-gpt-5-4/)
- Codex Source
    - [codex-rs/core/models.json](https://github.com/openai/codex/blob/main/codex-rs/core/models.json)
    - [codex-rs/core/src/models_manager/model_info.rs](https://github.com/openai/codex/blob/main/codex-rs/core/src/models_manager/model_info.rs)
    - [codex-rs/core/config.schema.json](https://github.com/openai/codex/blob/main/codex-rs/core/config.schema.json)
    - [codex-rs/utils/cli/src/config_override.rs](https://github.com/openai/codex/blob/main/codex-rs/utils/cli/src/config_override.rs)
- Tool Search
    - [Introducing advanced tool use | Anthropic](https://www.anthropic.com/engineering/advanced-tool-use)
    - [Tool search tool | Claude API Docs](https://platform.claude.com/docs/en/agents-and-tools/tool-use/tool-search-tool)
    - [Claude Code MCP Tool Search | Claude Code Docs](https://code.claude.com/docs/en/mcp)
- Pricing
    - [OpenAI API Pricing](https://openai.com/api/pricing/)
    - [Anthropic API Pricing](https://platform.claude.com/docs/en/about-claude/pricing)
    - [Gemini API Pricing](https://ai.google.dev/gemini-api/docs/pricing)
- Role Prompting Research
    - [Better Zero-Shot Reasoning with Role-Play Prompting | Kong et al. (NAACL 2024)](https://arxiv.org/abs/2308.07702)
    - [When "A Helpful Assistant" Is Not Really Helpful | Zheng et al. (2024)](https://arxiv.org/abs/2311.10054v3)
    - [System Prompts Define the Agent as Much as the Model | dbreunig (2026)](https://www.dbreunig.com/2026/02/10/system-prompts-define-the-agent-as-much-as-the-model.html)
- Benchmark
    - [GPT-5.4 vs Opus 4.6 vs Gemini 3.1 Pro | Digital Applied](https://www.digitalapplied.com/blog/gpt-5-4-vs-opus-4-6-vs-gemini-3-1-pro-best-frontier-model)
    - [Claude Opus 4.6 Benchmarks | Vellum](https://www.vellum.ai/blog/claude-opus-4-6-benchmarks)
    - [ARC Prize Leaderboard](https://arcprize.org/leaderboard)
    - [Google Releases Gemini 3.1 Pro | Creati AI](https://creati.ai/ai-news/2026-02-20/google-gemini-3-1-pro-release-beats-gpt-5-2-claude-benchmarks/)
    - [OpenAI launches GPT-5.4 | TechCrunch](https://techcrunch.com/2026/03/05/openai-launches-gpt-5-4-with-pro-and-thinking-versions/)
    - [SWE-Bench Pro Leaderboard | SEAL by Scale AI](https://scale.com/leaderboard/swe_bench_pro_public)
