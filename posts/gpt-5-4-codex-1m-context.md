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

ポジショニングとしてはGPT-5.3-Codexのコーディング能力をベースに、知識ワーク・コンピュータ操作・ツール利用を大幅に強化した統合モデルです。[公式ブログ](https://openai.com/index/introducing-gpt-5-4/)では「our most capable and efficient frontier model for professional work」（プロフェッショナルワークのための最も能力が高く効率的なフロンティアモデル）と紹介されています。

主要な新機能をざっくり整理するとこうなります。

- コンピュータ操作: 汎用モデルとして初めてネイティブなcomputer-use能力を搭載。OSWorld-Verifiedで75.0%（人間の72.4%を超える）
- 1Mコンテキスト: APIとCodexで最大100万トークンのコンテキストウィンドウを実験的にサポート
- ツール検索: tool searchという仕組みで大量のツール定義をコンテキストに入れずに効率的にツールを使える。MCP Atlasベンチマークでトークン使用量47%削減。ただしこのアプローチ自体はAnthropicが2025年11月に[`defer_loading`パラメータとtool search tool](https://www.anthropic.com/engineering/advanced-tool-use)としてClaude APIに導入済みです。Claude Codeでも[MCP Tool Search](https://code.claude.com/docs/en/mcp)として本番実装されており、MCPツール定義がコンテキストの10%を超えると自動的に有効化されます。OpenAIがGPT-5.4で追いついた形です
- トークン効率: GPT-5.2と比較してreasoningトークンが大幅に減少。o1以降、推論時の計算量を増やすことで精度を上げるtest-time compute ([Snell et al., 2024](https://arxiv.org/abs/2408.03314)) が性能向上の主要な手段だったが、GPT-5.4はトークンを減らしつつ性能を上げている
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

さて、ベンチマーク結果だけでは見えない話があります。CodexはOSSなので、モデル定義ファイル [codex-rs/core/models.json](https://github.com/openai/codex/blob/main/codex-rs/core/models.json) を読むと、各モデルに渡されるbase_instructions（システムプロンプト）の設計思想がわかります。自分はモデル更新のたびに読んでいますが、めちゃくちゃ面白いです。

まずはGPT-5.4とGPT-5.3-Codexの具体的な差分を見ていき、その後でgit logを使ってmodels.json全体の変更パターンを分析します。

### 「エキスパートエンジニア」としての自己認識

GPT-5.4のGeneralセクションにはGPT-5.3-Codexにない導入文が追加されています。

```
As an expert coding agent, your primary focus is writing code, answering questions,
and helping the user complete their task in the current environment. You build context
by examining the codebase first without making assumptions or jumping to conclusions.
You think through the nuances of the code you encounter, and embody the mentality
of a skilled senior software engineer.
```

（エキスパートコーディングエージェントとして、あなたの主な仕事はコードを書き、質問に答え、現在の環境でユーザーのタスク完了を助けることです。まず仮定や飛躍なしにコードベースを調べてコンテキストを構築します。遭遇するコードの微妙なニュアンスを考え抜き、熟練したシニアソフトウェアエンジニアのメンタリティを体現します。）

5.3-Codexにはこの導入文がなく、いきなり具体的なルールから始まっていました。「skilled senior software engineer」のメンタリティを体現せよ、という一文はロールプロンプティングのように見えます。しかし、段落全体を読むとその実態は異なります。

- 「コードを書き、質問に答え、タスク完了を助ける」→ タスクスコープの明示
- 「仮定や飛躍なしにまずコードベースを調べよ」→ 行動制約
- 「コードのニュアンスを考え抜け」→ 行動制約
- 「skilled senior software engineerのメンタリティを体現せよ」→ 上3つをまとめるアンカー

つまりこれはペルソナを付与するロールプロンプティングではなく、行動指示のプリアンブルです。5.3-Codexでは箇条書きルールにいきなり入っていた構成を、5.4では「何をする存在で、どう振る舞うか」を散文で前置きする構成に変えています。[dbreunig (2026)](https://www.dbreunig.com/2026/02/10/system-prompts-define-the-agent-as-much-as-the-model.html)が6つのコーディングエージェントのsystem promptを分析して指摘しているように、system promptの役割はモデルの訓練データバイアスを補正し、行動の境界を定義することです。この段落もその機能を果たしています。


### apply_patchの強制化

GPT-5.3-Codexでは「try to use apply_patch for single file edits, but it is fine to explore other options」（単一ファイルの編集にはapply_patchを使ってみてください。ただし他の方法を探っても構いません）と柔軟な指示でした。GPT-5.4ではこう変わっています。

```
- Always use apply_patch for manual code edits. Do not use cat or any other commands
  when creating or editing files.
```

（手動のコード編集には常にapply_patchを使用すること。ファイルの作成や編集にcatやその他のコマンドを使用しないこと。）

「always」で「Do not use cat」と明示的に禁止しています。apply_patchを経由したほうがdiffのトラッキングやユーザーへの変更提示が確実にできるため、エージェントの挙動を予測可能にするための厳格化です。

### 予期しない変更への対応: パニック→冷静に

GPT-5.3-Codexでは作業中に予期しない変更を見つけた場合の指示がこうでした。

```
- While you are working, you might notice unexpected changes that you didn't make.
  If this happens, STOP IMMEDIATELY and ask the user how they would like to proceed.
```

（作業中に、自分が行っていない予期しない変更に気づくかもしれません。その場合は直ちに作業を停止し、どう進めたいかユーザーに確認してください。）

GPT-5.4ではより冷静な対応に変更されています。

```
- While you are working, you might notice unexpected changes that you didn't make.
  It's likely the user made them, or were autogenerated. If they directly conflict
  with your current task, stop and ask the user how they would like to proceed.
  Otherwise, focus on the task at hand.
```

（作業中に、自分が行っていない予期しない変更に気づくかもしれません。おそらくユーザーが行ったか、自動生成されたものでしょう。現在のタスクと直接衝突する場合は作業を停止してユーザーに確認してください。そうでなければ、手元のタスクに集中してください。）

「STOP IMMEDIATELY」（直ちに停止）が消え、「ユーザーが作った変更か自動生成かもしれない。直接衝突する場合だけ聞け、それ以外は手元の作業に集中せよ」という指示になっています。長時間のエージェントセッションではlinterやformatterによる自動変更が頻繁に起きるので、いちいち止まっていたら作業が進まないという実運用の知見が反映されています。

### intermediary updatesの頻度調整: 20秒→30秒

GPT-5.3-Codexでは中間アップデートの頻度が20秒ごとでしたが、GPT-5.4では30秒ごとに変更されています。

```
# 5.3-Codex
- You provide user updates frequently, every 20s.

# 5.4
- You provide user updates frequently, every 30s.
```

（5.3-Codex: ユーザーへの更新を頻繁に、20秒ごとに提供する。）
（5.4: ユーザーへの更新を頻繁に、30秒ごとに提供する。）

加えてGPT-5.4には「When working for a while, keep updates informative and varied, but stay concise.」（しばらく作業が続く場合は、更新を情報量豊かで変化に富んだものにしつつ、簡潔に保つこと。）という一文が追加されています。更新頻度を下げつつ品質を上げる方向の調整です。20秒だとユーザーへの割り込みが多すぎたのでしょう。

### Reactコードのモダンパターン指示

GPT-5.4のFrontend tasksセクションにはGPT-5.3-Codexにない指示が追加されています。

```
- For React code, prefer modern patterns including useEffectEvent, startTransition,
  and useDeferredValue when appropriate if used by the team. Do not add
  useMemo/useCallback by default unless already used; follow the repo's
  React Compiler guidance.
```

（Reactコードには、チームが使用している場合、useEffectEvent、startTransition、useDeferredValueなどのモダンパターンを適切に使用すること。既に使われていない限り、デフォルトでuseMemo/useCallbackを追加しないこと。リポジトリのReact Compilerガイダンスに従うこと。）

React Compilerへの対応を明示的に指示しています。useMemo/useCallbackをデフォルトで追加しないという指示は、React Compilerがこれらを自動最適化する前提で書かれています。

### bashコマンドチェーンの禁止

GPT-5.4では並列ツール呼び出しの指示に以下が追加されています。

```
Never chain together bash commands with separators like `echo "====";`
as this renders to the user poorly.
```

（`echo "====";` のようなセパレータでbashコマンドを連鎖させないこと。ユーザーへの表示が崩れるため。）

GPT-5.3-Codexにはこの制約がありませんでした。エージェントが`echo "====" ; cat file.txt ; echo "====="`のようなコマンドチェーンを組み立てると、Codex UIでの表示が崩れるという実運用上のバグフィックスです。

### git logから見るinstructionsの変更パターン

ここまでGPT-5.3-Codex→5.4の差分を見てきました。ではこれらの差分は「モデルの特性に合わせた意図的なチューニング」なのでしょうか、それとも「Codexの運用知見が最新モデルにだけ反映された結果」なのでしょうか。

models.jsonの[git log](https://github.com/openai/codex/commits/main/codex-rs/core/models.json)を全コミット（25件、2025-12-17〜2026-03-06）調べると、base_instructionsの変更は大きく3つのパターンに分類できます。

パターン1: インフラ変更の全モデル一括適用

例えば2026-02-03のコミット [`6c069ca3`](https://github.com/openai/codex/commit/6c069ca3b) "Clarify collaboration-mode semantics in prompts to prevent mode confusion" では、gpt-5からgpt-5.2-codexまで全9モデルに完全に同一のテキストが追加されました。

```
## Collaboration modes

- Mode-specific behavior is provided through developer instructions,
  typically wrapped in `<collaboration_mode>...</collaboration_mode>`.
- Treat the most recent collaboration-mode developer instruction as the active mode.
- A mode changes only when new developer instructions change it;
  user requests or tool descriptions do not change mode by themselves.
- Known mode names are Default and Plan
```

同様に2026-01-13のコミット [`ebbbee70`](https://github.com/openai/codex/commit/ebbbee70c) では、sandbox/approvals説明の大幅削除が全モデルに一括適用されています。これらはモデルの個性とは無関係なインフラ側の変更です。

パターン2: 新モデル追加時に最新版instructionsを適用、古いモデルはフリーズ

各モデルのbase_instructions長の推移を追うと、このパターンが浮かび上がります。

| モデル | 文字数 | 備考 |
|---|---|---|
| gpt-5-codex / gpt-5.1-codex / gpt-5.1-codex-mini | 6,621 | 3モデルで完全に同一 |
| gpt-5.1-codex-max / gpt-5.2-codex | 7,563 | 2モデルで完全に同一、+Frontend tasks |
| gpt-5.3-codex | 12,341 | +Personality, +Autonomy等を大幅追加 |
| gpt-5.4 | 14,100 | +expertプリアンブル, 各種微調整 |

gpt-5-codex、gpt-5.1-codex、gpt-5.1-codex-miniは最終状態で1文字も違わない完全に同一のinstructionsです。gpt-5.1-codex-maxとgpt-5.2-codexも同様に完全一致です。モデルごとの個別チューニングが行われていれば、少なくともモデル名の自己言及部分は異なるはずですが、実際にはそうなっていません。

さらに、gpt-5.3-codex追加（2026-02-10）以降、gpt-5〜gpt-5.2-codexのinstructionsは一切変更されていません。新しい知見はすべて新モデルにだけ適用されています。

パターン3: 新世代での構造的な進化

gpt-5.3-codexで初めて導入された`# Personality`セクション（Values / Interaction Style / Escalation）はgpt-5.4でもそのまま同一で、このセクション自体には5.3→5.4の差分がありません。前述の「エキスパートエンジニア」プリアンブルは`# Personality`セクションではなく`# General`セクションの冒頭に追加されたものです。

### 公式ドキュメントが示すもう一つの視点

この分析を補完する重要な情報が2つの公式ドキュメントにあります。

まず[GPT-5 Prompting Guide](https://developers.openai.com/cookbook/examples/gpt-5/gpt-5_prompting_guide)は、GPT-5をモデルバージョン間の差分には一切言及せず、`reasoning_effort`と`verbosity`のパラメータで制御する単一モデルとして扱っています。モデルバージョンごとにプロンプトを変えろという指示はありません。

次に[Latest Model Guide](https://developers.openai.com/api/docs/guides/latest-model#preambles)には決定的な一文があります。

> GPT-5.4 has a **strong out-of-the-box coding personality**, so teams spend less time on prompt tuning.
>
>（GPT-5.4はすぐに使えるコーディングパーソナリティが強く組み込まれているため、チームはプロンプトチューニングに費やす時間が少なくて済む。）

つまりGPT-5.4は訓練段階ですでにコーディング向けの性格が組み込まれています。

にもかかわらず、models.jsonではGPT-5.4のinstructionsが全モデル中最長（14,100文字）です。「out-of-the-boxで性格が強いならinstructionsは短くていいはず」という直感に反しますが、これはモデルの性格が弱いから長いのではなく、Codex CLI側の運用要件（autonomy、intermediary updates、frontend tasks、formatting rules等）が世代を追うごとに積み重なっているためです。

### 差分の本質

以上を総合すると、前述のGPT-5.3-Codex→5.4の差分は、次の2つが混在しています。

1. Codex CLIの実運用フィードバック: apply_patchの強制化、予期しない変更への冷静な対応、bashコマンドチェーン禁止、intermediary updates間隔の調整など。これらは「モデルの性格」ではなく「エージェント環境の要件」であり、最新モデルにだけ前方適用されている
2. モデルの訓練特性を活かすキャリブレーション: GPT-5.4の「strong out-of-the-box coding personality」をCodex CLIという具体的な実行環境に合わせて方向づけるもの。expertプリアンブルやReact Compiler対応がこれに該当する

models.jsonの差分は「モデルの性格を作り出すもの」ではなく、訓練で組み込まれたモデルの能力をCodex CLIの文脈で最大限引き出すためのキャリブレーションと捉えるのがより正確です。

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

`config.toml`の値が直接ModelInfoに反映される素直な設計です。デフォルトのGPT-5.4の定義（[codex-rs/core/models.json](https://github.com/openai/codex/blob/main/codex-rs/core/models.json)）では`context_window: 272000`で、`auto_compact_token_limit`は未設定です。auto_compact_token_limitが未設定の場合はコンテキストウィンドウの90%（`context_window * 9 / 10`）が自動圧縮の閾値として使われます。

つまりデフォルトだとおよそ244,800トークンで自動圧縮が走ります。1Mに拡張するときは`model_context_window`を1000000にして、`model_auto_compact_token_limit`で明示的に圧縮閾値を指定するのが推奨です。上の例では900,000にしていますが、これはお好みで調整してください。

### コストに関する注意

ここで重要な注意点があります。[公式ブログ](https://openai.com/index/introducing-gpt-5-4/)にこう書かれています。

> Requests that exceed the standard 272K context window count against usage limits at 2x the normal rate.
>
> （標準の272Kコンテキストウィンドウを超えるリクエストは、通常の2倍のレートで使用量制限にカウントされます。）

272Kを超えるリクエストは使用量制限（rate limit）に対して通常の2倍のレートで消費されます。同じ制限枠の中で使える量が実質半分になるので、大量に使う場合は制限に当たりやすくなります。

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

| モデル | 入力 ($/M tokens) | キャッシュ読取 ($/M tokens) | 出力 ($/M tokens) | ソース |
|---|---|---|---|---|
| GPT-5.4 (≤272K) | $2.50 | $0.25 | $15.00 | [OpenAI](https://openai.com/api/pricing/) |
| GPT-5.4 (>272K) | $5.00 | $0.50 | $22.50 | [OpenAI](https://openai.com/api/pricing/) |
| GPT-5.4 Pro (≤272K) | $30.00 | - | $180.00 | [OpenAI](https://openai.com/api/pricing/) |
| GPT-5.4 Pro (>272K) | $60.00 | - | $270.00 | [OpenAI](https://openai.com/api/pricing/) |
| GPT-5.2 | $1.75 | $0.175 | $14.00 | [OpenAI](https://openai.com/api/pricing/) |
| Claude Sonnet 4.6 (≤200K) | $3.00 | $0.30 | $15.00 | [Anthropic](https://platform.claude.com/docs/en/about-claude/pricing) |
| Claude Sonnet 4.6 (>200K) | $6.00 | $0.60 | $22.50 | [Anthropic](https://platform.claude.com/docs/en/about-claude/pricing) |
| Claude Opus 4.6 (≤200K) | $5.00 | $0.50 | $25.00 | [Anthropic](https://platform.claude.com/docs/en/about-claude/pricing) |
| Claude Opus 4.6 (>200K) | $10.00 | $1.00 | $37.50 | [Anthropic](https://platform.claude.com/docs/en/about-claude/pricing) |
| Gemini 3.1 Pro (≤200K) | $2.00 | $0.20 | $12.00 | [Google](https://ai.google.dev/gemini-api/docs/pricing) |
| Gemini 3.1 Pro (>200K) | $4.00 | $0.40 | $18.00 | [Google](https://ai.google.dev/gemini-api/docs/pricing) |
| Gemini 2.5 Pro (≤200K) | $1.25 | $0.125 | $10.00 | [Google](https://ai.google.dev/gemini-api/docs/pricing) |
| Gemini 2.5 Pro (>200K) | $2.50 | $0.25 | $15.00 | [Google](https://ai.google.dev/gemini-api/docs/pricing) |

キャッシュ読取はOpenAIの「Cached input」、Anthropicの「Cache Hits & Refreshes」、Googleの「Context caching」に対応し、いずれもベース入力単価の0.1倍です。

GPT-5.4はGPT-5.2より入力が43%高くなっています（$1.75→$2.50）。ただしOpenAIはGPT-5.4のトークン効率がGPT-5.2より大幅に改善されていると主張しており、同じタスクに必要な総トークン数が減るため実質コストは下がるケースもあるとのことです。

Claude Sonnet 4.6と比較すると入力はGPT-5.4が安く（$2.50 vs $3.00）、出力は同額（$15.00）です。Gemini 2.5 Proは入出力ともに最安ですが、各モデルの得意分野が異なるのでコストだけでは判断できません。

なお3社とも長コンテキスト利用時は入力2倍・出力1.5倍の課金が設定されています（OpenAI: 272K超、Anthropic・Google: 200K超）。1Mコンテキストを常用すると通常の2倍近いコストがかかります。

### ベンチマーク横断比較

GPT-5.4は本日リリースされたばかりなのでサードパーティの統一条件ベンチマークはまだ出揃っていませんが、各社公式発表のスコアを並べるとこうなります。

| 評価項目 | GPT-5.4 | Claude Opus 4.6 | Gemini 3.1 Pro | ソース |
|---|---|---|---|---|
| OSWorld-Verified（コンピュータ操作） | 75.0% | 72.7% | - | [OpenAI](https://openai.com/index/introducing-gpt-5-4/), [Anthropic](https://www.anthropic.com/news/claude-opus-4-6) |
| SWE-Bench Verified（コーディング） | - | 80.8% | 80.6% | [Google DeepMind](https://deepmind.google/models/model-cards/gemini-3-1-pro/) |
| SWE-Bench Pro（コーディング） | 57.7% | - | 54.2% | [OpenAI](https://openai.com/index/introducing-gpt-5-4/), [Google DeepMind](https://deepmind.google/models/model-cards/gemini-3-1-pro/) |
| Terminal-Bench 2.0* | 75.1% | 65.4% | 68.5% | [OpenAI](https://openai.com/index/introducing-gpt-5-4/), [Google DeepMind](https://deepmind.google/models/model-cards/gemini-3-1-pro/) |
| GPQA Diamond（科学推論） | 92.8% | 91.3% | 94.3% | [OpenAI](https://openai.com/index/introducing-gpt-5-4/), [Google DeepMind](https://deepmind.google/models/model-cards/gemini-3-1-pro/) |
| ARC-AGI-2（抽象推論） | 73.3% | 68.8% | 77.1% | [OpenAI](https://openai.com/index/introducing-gpt-5-4/), [ARC Prize](https://arcprize.org/leaderboard) |
| MMMU Pro（視覚理解） | 81.2% | 73.9% | 80.5% | [OpenAI](https://openai.com/index/introducing-gpt-5-4/), [Google DeepMind](https://deepmind.google/models/model-cards/gemini-3-1-pro/) |
| GDPval-AA（知識ワーク） | 83.0% | 1,606 Elo | 1,317 Elo | [OpenAI](https://openai.com/index/introducing-gpt-5-4/), [Google DeepMind](https://deepmind.google/models/model-cards/gemini-3-1-pro/) |
| BrowseComp（ウェブ検索） | 82.7% | 84.0% | 85.9% | [Google DeepMind](https://deepmind.google/models/model-cards/gemini-3-1-pro/) |
| MCP Atlas（ツール連携） | 67.2% | 59.5% | 69.2% | [OpenAI](https://openai.com/index/introducing-gpt-5-4/), [Google DeepMind](https://deepmind.google/models/model-cards/gemini-3-1-pro/) |

*Terminal-Bench 2.0はTerminus-2ハーネスでの結果。GPT-5.4の75.1%はOpenAI公式値。agent+modelの組み合わせでスコアは大きく変動し（例: Opus 4.6はTerminus-KIRAで74.7%、Gemini 3.1 Pro+Forge Codeで78.4%）、GPT-5.3-Codexの77.3%（Codex CLI）はGPT-5.4より高い。MMMU ProとGPQA Diamondはtools無しの条件。GDPval-AAはOpenAIのみパーセンテージ、Anthropic/GoogleはEloで報告。

注意: 各社公式のスコアは評価条件（scaffolding、reasoning effort設定、ツール構成等）が異なるため、厳密なapples-to-apples比較ではありません。あくまで各モデルの得意領域の傾向を把握するためのものです。

この表から見えてくるパターンは明確です。

コンピュータ操作ではGPT-5.4がOSWorld 75.0%でトップです。Terminal-Bench 75.1%も高いですが、実はGPT-5.3-Codexの77.3%より低く、さらにGemini 3.1 Pro+Forge Codeエージェントは78.4%を記録しています。ただしCodexのようなエージェント型ワークフローではOSWorldの差が効いてきます。

科学推論と抽象推論ではGemini 3.1 Proが強いです。GPQA Diamond 94.3%、ARC-AGI-2 77.1%でリードしています。

視覚理解（MMMU Pro、tools無し）ではGemini 3.1 Pro 80.5%、GPT-5.4 81.2%がOpus 4.6の73.9%を上回っています。ただしOpus 4.6はtools有りで77.3%まで伸びるため、ツール連携込みの実務ではこの差は縮まります。

知識ワーク（GDPval）ではGPT-5.4が83.0%で最高スコアです。プロフェッショナルの実務タスク（スプレッドシート、プレゼン、法的分析）での実力を示しています。

ウェブ検索（BrowseComp）はGemini 3.1 Proが85.9%でトップですが、GPT-5.4 Pro（89.3%）はさらに上です。

つまり「全方面で最強」なモデルは存在せず、タスクの性質で最適解が変わります。

### コーディング用途での選び方

実務でのモデル選択の観点で整理します。

- GPT-5.4: Codexとの統合が最も深い。computer-use、1Mコンテキスト、commentaryチャネルによるmid-response steeringなど独自機能が多い。特にTerminal-Bench 75.1%が示すように長時間のエージェントセッションやターミナル操作で真価を発揮する
- Claude Opus 4.6: SWE-Bench Verified 80.8%が示す通りコーディング品質が高い。MMMU Pro 73.9%（tools有り77.3%）で視覚理解も堅実。ドキュメント駆動のコードレビューに強い
- Claude Sonnet 4.6: Opus 4.6の約60%のコストで近い性能。コスパ重視なら有力な選択肢
- Gemini 3.1 Pro: 抽象推論（ARC-AGI-2 77.1%）と科学推論（GPQA 94.3%）がトップ。APIコストも$2/$12と競争力がある

Codexを使っているならGPT-5.4がファーストチョイスですが、API経由で複数モデルを使い分ける場合はタスク特性と予算で選ぶのがよいでしょう。

## まとめ

- GPT-5.4はコンピュータ操作（OSWorld 75.0%で人間超え）と知識ワーク（GDPval 83.0%）で大幅な進化を遂げた統合フロンティアモデル
- Codexのmodels.jsonでGPT-5.3-Codex→5.4のinstructions差分を読むと、apply_patchの強制化、予期しない変更への冷静な対応、React Compiler対応など実運用フィードバックに基づく改善が見える
- git log分析により、これらの差分はモデルの性格を作り出すものではなく、Codex CLIの運用知見の蓄積と、モデルの訓練特性を実行環境に合わせるキャリブレーションの混合であることがわかった。古いモデル間（gpt-5-codex〜gpt-5.1-codex-mini）は完全に同一のinstructionsを共有しており、モデル個別のチューニングは主に最新世代で行われている
- Codexで1Mコンテキストを使うには`codex -m gpt-5.4 -c model_context_window=1000000 -c model_auto_compact_token_limit=900000`か、`config.toml`に同等の設定を書く
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
- Test-Time Compute
    - [Scaling LLM Test-Time Compute Optimally can be More Effective than Scaling Model Parameters | Snell et al. (ICLR 2025 Oral)](https://arxiv.org/abs/2408.03314)
- GPT-5 Prompting & Model Guide
    - [GPT-5 Prompting Guide | OpenAI Cookbook](https://developers.openai.com/cookbook/examples/gpt-5/gpt-5_prompting_guide)
    - [Latest Model Guide - Preambles | OpenAI API Docs](https://developers.openai.com/api/docs/guides/latest-model#preambles)
- System Prompt Analysis
    - [System Prompts Define the Agent as Much as the Model | dbreunig (2026)](https://www.dbreunig.com/2026/02/10/system-prompts-define-the-agent-as-much-as-the-model.html)
- Benchmark
    - [Introducing Claude Opus 4.6 | Anthropic](https://www.anthropic.com/news/claude-opus-4-6)
    - [Gemini 3.1 Pro Model Card | Google DeepMind](https://deepmind.google/models/model-cards/gemini-3-1-pro/)
    - [ARC Prize Leaderboard](https://arcprize.org/leaderboard)
    - [Terminal-Bench 2.0 Leaderboard](https://www.tbench.ai/leaderboard/terminal-bench/2.0)
    - [OpenAI launches GPT-5.4 | TechCrunch](https://techcrunch.com/2026/03/05/openai-launches-gpt-5-4-with-pro-and-thinking-versions/)
