---
title: "新しい時代の開発と組織について"
description: "Coding Agentと並走する開発で、1人がdaily 300 commit / 60,000行を出せる時代。人間はどう組織し、どう動くべきかを実体験ベースで考える。"
date: 2026-02-24
tags: [Coding Agent, Claude Code, Organization, Productivity, Team Design]
author: 逆瀬川ちゃん
---

こんにちは！逆瀬川ちゃん ([@gyakuse](https://x.com/gyakuse)) です！

今日はCoding Agentと一緒に開発する時代の「開発の進め方」と「組織のあり方」について、自分の実体験ベースで考えていきたいと思います。

<!--more-->

## いま何が起きているか

Anthropicの[2026 Agentic Coding Trends Report](https://resources.anthropic.com/2026-agentic-coding-trends-report)によると、GitHubのパブリックコミットの4%がすでにClaude Codeによるものです。年末には20%を超えるペースだそうです。Anthropic社内ではエンジニアあたりのマージPR数が67%増加しているとのことです。

自分の環境ではChatGPT Pro ($200/月) とClaude Code Max x20 ($200/月) を併用していて、複数の離れたプロジェクトを回して現在daily 90 commit / 30,000行くらいです。負荷最小になりつつあり、最高速のマイルストーンとしてはdaily 300 commit / 60,000行あたりが見えています。

ただこの数字はcommitの粒度やテストの厚さによって大きく変わります。そしてこれ以上はサービスのrate limitに引っかかるため、物理的な天井があります。問題は速度ではなく、この大量の出力を人間がどう扱うかです。

## スループットの天井を決めるもの

ChatGPT ProとClaude Code Max x20を全力で使ったときの理論上の天井はだいたいこのあたりです。

| 項目 | 値 |
|---|---|
| サブスクリプション | ChatGPT Pro ($200/月) + Claude Max x20 ($200/月) |
| daily commit上限 | 〜300 commit |
| daily line数上限 | 〜60,000 line |
| 制約要因 | 各サービスのrate limit |

これ以上出したければ複数アカウントが必要ですが、各サービスの利用規約とお財布と相談になります。Claude Codeの場合、追加分はAPIキー経由で利用できるため、そちらで上限を拡張する手もあります。

さて、この天井が実際に出るかどうかは別の話です。プロジェクトの「硬さ」が速度を大きく左右します。

## プロジェクトの硬さ

Agentに仕事を振って高速に回せるかどうかは、プロジェクトごとにまったく違います。この違いを「硬さ」と呼んでいます。

硬さは技術的な性質だけでなく、プロジェクトの進行フェーズや組織的な制約にも依存します。

| パラメータ | 柔らかい（速い） | 硬い（遅い） |
|---|---|---|
| フェーズ | グリーンフィールド。自由に作れる | 既存コードベースの改修。影響範囲の把握が必要 |
| 要件の明確さ | 仕様が固まっている。Agent単独で進められる | 要件が曖昧で、人間との対話なしには進められない |
| タスクの分離度 | 1タスクが独立している。並列に振れる | タスク間の依存が密で、直列にしか進められない |
| 検証サイクル | テストやCIで自動検証できる。Agentが自己完結する | 人間が目視やブラウザで確認するしかない。Agentが止まる |
| 承認フロー | 自分の判断でmerge/pushできる | レビュー承認やステークホルダー確認が必要。待ち時間が発生する |
| 外部依存 | 自己完結している | 外部API、他チームのサービス、環境構築の待ちが発生する |

現実にはこれらが複合的に効いてきます。たとえばグリーンフィールドでもステークホルダーとの合意が必要なプロジェクトは硬いですし、既存コードベースでもテストが厚くてタスクが分離されていれば十分速く回せます。

類似した複数プロジェクトなら、1つのSkillとフロー設計を使い回せるのでさらに効率が上がります。ただ完全自動化（人間が一切介入しない）はSkill群やフローを整備しても現在のCoding Agentではリスクが高いです。Agentは確実に進歩していますが、まだアーキテクチャ判断や曖昧な要件の解釈は人間がやるべき領域です。

自分のプロジェクト群でどのパラメータが硬さを支配しているかをあぶり出して、最速ラインがどのあたりかを把握しておくことが大事です。

## 人間がボトルネックになる構造

ここで「なぜ天井まで到達しないのか」を考えると、ほとんどの場合ボトルネックは人間です。

Coding Agentと一緒に開発していると、本質的には大量の入れ替わりをする部下を抱えている状態になります。1つのAgentセッションは1つのタスクで始まり、完了したらコンテキストは消えます。次のタスクでは新しいAgentが起動します。常に新人が入ってきて、指示を受けて、成果物を出して、去っていきます。

このとき人間側に発生するボトルネックは3つです。

- 指示待ち: Agentのタスクが枯渇して止まる。次に何をやらせるか人間が考えないといけない
- 検収待ち: Agentが「できました」と言っているが人間がレビューできていない。成果物がキューに溜まる
- 対応荒れ: Agentからの質問や確認が頻繁に飛んできて、人間がずっと電話対応のような状態になる

3つ目が特に厄介です。人間がずっと対応に荒れていると、かつてのPMのつらみとまったく同じ構造になります。日々の対応に追われて、プロジェクトについて深く考えたりアイデアを検討したりする時間がなくなります。

Agentがアイデアをうまく生み出し、検収まで自律的にやれるようになるまで（残余時間は少ない可能性が高いですが）は、この「考える仕事」は人間がやるしかありません。だからこそ、対応のコストを最小化して考える時間を確保する設計が必要です。

## 認知負荷のコントロール

ボトルネックを回避するために自分が意識しているのは2つの軸です。

1つ目は自動化です。[前回の記事](https://nyosegawa.github.io/posts/claude-code-verify-command/)で書いたanti-human-bottleneckスキルのように、Agentが人間に聞かずに自分で進む設計にします。タスク管理も[Linear連携スキル](https://nyosegawa.github.io/posts/claude-code-linear-task-skill/)で自動化しています。「ずっと電話がかかってくる状態」にしないことが大事です。

2つ目は認知負荷の低い対応アプローチです。対応待ちがあっても他が進むようにします。ここで重要なのがロードタイムという概念です。

人間がプロジェクトを想起し、メモリに展開し、アイデアについて考え出すまでの時間です。これが3秒なのか3分なのかで生産性は桁違いに変わります。検収のロードタイムも同様です。「できました」と言われてからそのプロジェクトの文脈を思い出し、成果物を評価できる状態になるまでの時間です。

これは計測するべきです。そしてロードタイムを短くするための仕組みが必要です。

### ロードタイムを短くする工夫

自分が実践しているのはこのあたりです。

- メモ→アイデア→タスクの対話的進行: 思いついたことをすぐにタスク化してAgentに渡せるフロー
- 納品→検収→リリースの対話的進行: Agentの成果物を最小の認知コストでレビューできるフロー
- リソースの可視化: どのプロジェクトにどれだけのAgent時間を投下しているか、どこが詰まっているかを見えるようにする

特に「メモ→アイデア→タスク」のフローが大事で、Claude CodeのSkillsを使うとこれが自然言語で回せます。「このアイデアをタスクにして」と言うだけでLinearにIssueが作られ、Agentが着手します。人間の側でプロジェクトマネジメントツールを開く必要がありません。

## ドキュメント戦略: 1 file + ADR群

Agentと一緒に開発するとき、ドキュメントは軽ければ軽いほどいいです。

理想は1つのCLAUDE.mdファイルとADR ([Architecture Decision Records](https://adr.github.io/)) 群です。コードの説明的なドキュメント（「このモジュールはこう動く」的なもの）は作るべきではありません。

理由はシンプルで、コードの説明ドキュメントはコードが変わるたびにメンテナンスが必要になるからです。Agentが1日に数百commitするペースでは、ドキュメントの追従がまったく間に合いません。そしてAgentはコードを直接読めるので、コードの説明ドキュメントを経由する必要がそもそもありません。

一方でADRは違います。ADRは「なぜこの設計判断をしたか」を記録するもので、コードの変更とは独立して価値を持ちます。Agentが次のタスクに取り掛かるとき、過去の設計判断の理由がわかることで正しい方向に進められます。ADRはMarkdownで数分で書けますし、[joelparkerhenderson/architecture-decision-record](https://github.com/joelparkerhenderson/architecture-decision-record)のテンプレートを使えば構造も統一できます。

| ドキュメント | Agent時代に必要か | 理由 |
|---|---|---|
| CLAUDE.md | 必須 | Agentの行動指針、固定パラメータ、プロジェクト構造 |
| ADR群 | 必須 | 設計判断の「なぜ」はコード変更と独立して価値がある |
| API仕様書 | 場合による | 外部公開APIなら必要。内部APIはコードから読める |
| コード説明ドキュメント | 不要 | コードの変更速度にメンテが追いつかない。Agentはコードを直接読める |
| Design Doc | 最小限 | 初期の方向性共有には有用。ただし陳腐化が速い |

## チーム設計: アイデアマン・ランナー・レビュアー群

現時点で複数人のdevチームを組むのはむずかしいです。ピザを一人で食べるほうがいい。Agentとのコンテキスト共有は1対1が一番効率的で、複数人が同じリポジトリで同時にAgentを走らせるとコンフリクトと認知コストが爆発します。

Claude Codeには[git worktree対応](https://code.claude.com/docs/en/common-workflows)が入って並列Agentが衝突しなくなりましたし、実験的な[Agent Teams](https://code.claude.com/docs/en/agent-teams)機能ではAgent同士がメッセージをやりとりして協調できるようにもなっています。Anthropicの[Cコンパイラ実験](https://www.anthropic.com/engineering/building-c-compiler)では16並列のAgentが2週間で10万行のコンパイラを書き、Linux kernelのコンパイルに成功しています。

ただ、これは明確に分離可能なタスク（個別のテストケースを通す）があったから並列化が効いた事例です。1リポジトリの全体像を把握して判断するのは、それでも1人の人間が一番速いです。

とはいえ、もしチームを組むとしたら、今この瞬間のAgentの能力を考慮した理想の構成はこうなります。

### アイデアマン

要件定義と方向性を決める役割です。「次に何を作るか」「どういう体験にするか」を考えます。Agentはまだここが弱いです。人間が曖昧な要望から価値のある仕様を引き出す能力は、現時点ではAgentで代替できません。

### ランナー

devブランチを1人で持ち、Agent群と伴走するメインの開発者です。日常的にAgentに指示を出し、成果物を確認し、方向修正します。いまこのポジションが一番必要です。Agentの出力を評価し、正しい方向に導ける技術力と判断力が求められます。

### レビュアー群

ここを厚くします。アーキテクト、UI/UX、セキュリティ、パフォーマンスなど、それぞれの専門観点からAgentの出力をレビューします。硬いレビューは本質的な課題で、Agentの出力が増えれば増えるほどレビューの負荷は上がります。

| ロール | 人数 | 担当 |
|---|---|---|
| アイデアマン | 1 | 要件定義、方向性、優先度判断 |
| ランナー | 1 | devブランチ進行、Agent群との伴走 |
| レビュアー | 3+ | アーキテクト、UI/UX、セキュリティ等の専門レビュー |

レビュアー群を厚くしまくるのが今のAgentの能力を考慮した最適解です。Agentはコードを大量に書けますが、そのコードが全体として正しい方向に向かっているかの判断には人間の専門性が要ります。

ランナーが継続的に必要なのかは正直わかりません。いまは一番必要ですが、Agentの自律性が上がれば不要になる可能性はあります。一方でアイデア注入とレビュアーのフィードバックはあと1年くらいは確実に必要です。2-3年後にどうなっているかはわかりません。

## 完全自動化のリスク

Skill群やフローを整備しても、いまのCoding Agentで完全自動化するのはリスクが高いです。

[VentureBeatの記事](https://venturebeat.com/ai/why-ai-coding-agents-arent-production-ready-brittle-context-windows-broken)が指摘するように、Agentにはまだ文脈の脆さがあります。コンテキストウィンドウは有限で、[Chromaの研究](https://factory.ai/news/context-window-problem)によると130Kトークンあたりからパフォーマンスが急激に劣化します。長時間のセッションで情報を積み重ねると、初期の指示を忘れたり、一貫性が崩れたりします。

だからこそ人間の介入を「ゼロ」にするのではなく、「最小限の認知コストで最大限の効果を出す」設計にするのが現実的です。Coding Agentに振り回されないように、常にいろんなことを考える必要があります。Agentの出力を信頼しつつも検証する。自動化できるところは自動化し、人間にしかできない判断に集中する。これが今のところの最善手です。

## まとめ

- Coding Agentと並走する開発はdaily 300 commit / 60,000行が理論上の天井。現実的にはプロジェクトの「硬さ」と人間の認知負荷がボトルネック
- チーム設計はアイデアマン + ランナー + レビュアー群。レビュアーを厚くするのが現時点の最適解
- ドキュメントは1 file (CLAUDE.md) + ADR群。コード説明ドキュメントは不要。ロードタイムを3秒にするための仕組み設計が認知負荷コントロールの鍵

## References

- [2026 Agentic Coding Trends Report – Anthropic](https://resources.anthropic.com/2026-agentic-coding-trends-report)
- [Claude Code is the Inflection Point – SemiAnalysis](https://newsletter.semianalysis.com/p/claude-code-is-the-inflection-point)
- [Claude Code Skills – Docs](https://code.claude.com/docs/en/skills)
- [Max plan – Claude Pricing](https://claude.com/pricing/max)
- [ChatGPT Pro – OpenAI](https://openai.com/index/introducing-chatgpt-pro/)
- [Architecture Decision Records](https://adr.github.io/)
- [joelparkerhenderson/architecture-decision-record – GitHub](https://github.com/joelparkerhenderson/architecture-decision-record)
- [Why AI coding agents aren't production-ready – VentureBeat](https://venturebeat.com/ai/why-ai-coding-agents-arent-production-ready-brittle-context-windows-broken)
- [The Context Window Problem – Factory.ai](https://factory.ai/news/context-window-problem)
- [Building a C compiler with a team of parallel Claudes – Anthropic](https://www.anthropic.com/engineering/building-c-compiler)
- [Common workflows – Claude Code Docs](https://code.claude.com/docs/en/common-workflows)
