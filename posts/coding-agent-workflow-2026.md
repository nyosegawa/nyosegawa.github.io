---
title: "Coding Agent時代の開発ワークフローについてのまとめ"
description: "Agentic Engineering時代のプロジェクトワークフロー・実装テクニック・インフラ設計を網羅的にまとめます。前回のHarness Engineering記事の続編です"
date: 2026-03-14
tags: [AI, Claude Code, Codex, Agentic Engineering, Workflow]
author: 逆瀬川ちゃん
---

こんにちは！逆瀬川ちゃん ([@gyakuse](https://x.com/gyakuse)) です！

今日はCoding Agent時代の開発ワークフローについて、みんながやっているものからわたしがやっている手法までまとめて紹介していきたいと思います。

<!--more-->

前回の記事 [Claude Code / Codex ユーザーのための誰でもわかるHarness Engineeringベストプラクティス](/posts/harness-engineering-best-practices-2026/) では、LinterやHooks、テスト戦略といった決定論的ツールでCoding Agentの出力を矯正するHarness Engineeringに特化しました。

今回はその上位にある問い、つまりハーネスは分かったけど全体としてどう開発を進めればいいのか、に答えます。プロジェクトの進め方、Agentとのコーディングテクニック、それを支えるインフラの3つの視点から2026年3月時点の状況を整理し、最後にわたし自身のワークフローも紹介します。

## Agentic Engineeringという大きな潮流

まず、現代のCoding Agentまわりを語るうえで避けて通れない概念から始めます。

2025年2月に[Karpathy](https://x.com/karpathy/status/1886192184808149383)がVibe Codingとして提唱した概念があります。この時点ではCoding Agentに対してノリでコードを書かせるものでしたが、これが1年で構造化されたエンジニアリング手法に成熟し、2026年2月にKarpathy自身がAgentic Engineeringに改名しました。あなたはコードを直接書かない、99%の時間コードを書くエージェントをオーケストレーションし監督として振る舞う([The New Stack](https://thenewstack.io/vibe-coding-is-passe/))、という定義です。

[Addy Osmani](https://addyosmani.com/blog/agentic-engineering/)はAgentic Engineeringを体系化しています。成功している開発者は問題定義と検証戦略に70%、実行に30%という時間配分をしており、従来と逆ですがトータル時間は劇的に短縮されます。また[The Factory Model](https://addyosmani.com/blog/factory-model/)では、ソフトウェアを手作業で一つずつ作るフェーズから、自動アセンブリラインを運営するフェーズへという発想の転換を論じています。

[Simon Willison](https://simonwillison.net/2026/Feb/23/agentic-engineering-patterns/)は実践パターンを体系化していて、Red/Green TDD、Writing Code is Cheap Now、First Run the Tests、Linear Walkthroughs、Hoard Things You Know How to Do(テスト駆動開発、コードを書くコストは激減した、まずテストを走らせろ、コードの逐次読み解き、できることをストックせよ)を挙げています。

前回の記事で扱ったHarness Engineeringは、このAgentic Engineeringの実装基盤です。今回はもう少し引いた視点から、プロジェクト全体をどう進めるかを見ていきます。

さて、Agentic Engineeringを実践するには、まずプロジェクトの進め方を決める必要があります。

## プロジェクトの進め方: 4つのワークフロー

ここではさいきん登場・成熟した代表的な4つのプロジェクトワークフローを紹介します。どれか一つに限定する必要はなく、組み合わせて使うものです。

### Brainstorm → Plan → Execute（Harper Reed式）

[Harper Reed](https://harper.blog/2025/02/16/my-llm-codegen-workflow-atm/)が提唱し、Simon Willisonが紹介したCoding Agent活用ワークフローの原型です。多くの後続手法に影響を与えています。

フローはシンプルで、3段階です。

1. Brainstorm: 対話型LLMに *ask me one question at a time* とプロンプトを投げ、アイデアを反復的に掘り下げて`spec.md`を生成
2. Plan: `spec.md`を推論モデルに渡し、小さなステップに分解した`prompt_plan.md`と`todo.md`を生成
3. Execute: 生成されたプロンプト群をClaude Codeに順番に食わせて実装

個人の新規プロジェクト向きで、チーム開発には向きません(Harper自身が認めています)。ただしいきなりコードを書かないという原則を確立した点で、後続のすべてのワークフローに影響を与えた重要な起点です。

### SDD / AI-DLC（Spec-Driven Development）

2025〜2026年にかけて最も急速に普及したワークフローです。Vibe Codingに対するアンチテーゼとして、仕様書をSource of Truthに据えます。30以上のフレームワークが乱立する活況期にあります。

[Birgitta Boeckeler](https://martinfowler.com/articles/exploring-gen-ai/sdd-3-tools.html)がSDDを3レベルに分類しています。[Thoughtworks Technology Radar](https://www.thoughtworks.com/en-us/radar/techniques/spec-driven-development)はSDDをAssess(評価段階)としています。

| レベル | 説明 | 例 |
|---|---|---|
| Spec-first | 実装前に仕様を作成、完了後は破棄される傾向 | Spec Kit, Kiro |
| Spec-anchored | 仕様を機能進化全体で保持・更新し続ける | Kiro(Design Docs) |
| Spec-as-source | 人間が編集するのは仕様のみ、コードは自動生成で編集禁止 | Tessl |

基本フローはRequirements → Design → Tasks → Implementationです。AWSはこれをチーム・組織レベルに拡張した[AI-DLC](https://aws.amazon.com/blogs/devops/ai-driven-development-life-cycle/)(AI-Driven Development Life Cycle)を提唱しています。Inception(計画) → Construction(開発) → Operations(運用)の3フェーズで構成され、Mob Elaboration(4時間の同期セッションでビジネス意図を詳細要件に変換)やAdaptive Workflow(タスクの複雑さに応じて9ステージから必要なものを自動選択)が特徴です。[aidlc-workflows](https://github.com/awslabs/aidlc-workflows)としてOSSのsteering rulesが公開されています。

ツールは乱立していますが、主要なものを挙げます。

| ツール | Stars | 特徴 |
|---|---|---|
| [GitHub Spec Kit](https://github.com/github/spec-kit) | 76,627 | 事実上の標準。22+エージェント対応 |
| [BMAD-METHOD](https://github.com/bmad-code-org/BMAD-METHOD) | 40,579 | 12+のドメインエキスパート役割によるマルチエージェント方法論 |
| [OpenSpec](https://github.com/Fission-AI/OpenSpec) | 30,399 | イテレーティブなSpec管理。軽量でbrownfieldに強い |
| [GSD](https://github.com/gsd-build/get-shit-done) | 29,635 | メタプロンプティング。Claude Code中心 |
| [cc-sdd](https://github.com/gotalab/cc-sdd) | 2,859 | Kiro互換コマンド。8エージェント・13言語対応 |
| [Kiro](https://kiro.dev/) | SaaS | AWS製IDE。EARS形式の要件定義 + Agent Hooks |

チームでの中〜大規模機能開発に向いています。実装中の細かい承認ではなく各フェーズゲートでのレビューに切り替えることで承認疲れ(Approval Fatigue)を解消できるのが利点です。

一方で課題もあります。仕様がコードと乖離するリスク(マークダウン文書の海に溺れる問題)、小規模バグ修正には過剰であること、重い事前仕様とビッグバンリリースという従来のアンチパターンへの回帰リスクがあること。Thoughtworksは現時点でAssess(評価段階)としています。

### Research → Plan → Implement（構造化協業型）

[Boris Tane](https://boristane.com/blog/how-i-use-claude-code/)(Cloudflare Engineering Lead)が9ヶ月のClaude Code活用から体系化した3フェーズ・ワークフローです。[BlockのRPI方法論](https://engineering.block.xyz/blog/ai-assisted-development-at-block)や[HumanLayerのFIC](https://github.com/humanlayer/advanced-context-engineering-for-coding-agents)と収束しています。

核心ルールはシンプルで、詳細な書面計画を確認・承認するまで一行のコードも書かせません。

1. Research: コードベースの深い読み込み。`deeply`、`intricacies`等の言語で徹底的調査を指示して`research.md`を生成
2. Plan: 詳細な計画文書(コードスニペット・ファイルパス付き)を作成して`plan.md`を生成。テキストエディタでインラインノートを追加するアノテーションサイクルを1〜6回繰り返す
3. Implement: 計画に基づく一括実装。型チェックの継続的実行

各フェーズの区切りでFIC(Frequent Intentional Compaction)を実行するのが大きな特徴です。コンテキスト利用率を40〜60%に保ちます。80〜100%に達してから慌てて圧縮するのではなく、予防的に頻繁に圧縮します。HumanLayerは300k LOCのRustコードベースでこのアプローチにより1日で1週間分の作業を完了したと報告しています。

中規模チーム、品質重視のプロジェクト、既存コードベースへの大きな変更に向いています。

### Superpowers（方法論のエンコーディング）

[obra/superpowers](https://github.com/obra/superpowers)(82,074 stars)はClaude Code Plugin Marketplaceに公式採用されたスキルフレームワーク兼開発方法論です。SDDやTDDといった個別のプラクティスを一つのパイプラインとしてエンコードし、Agentに方法論を強制する点が特徴です。

7段階パイプラインで構成されます。

1. Brainstorming: 要件を対話的に引き出し、ユーザーの承認を得るまでコードに進まない
2. Git Worktrees: 分離された開発ブランチを自動作成、テストのベースラインを確認
3. Planning: 承認された設計をマイクロタスク(各2-5分)に分解。正確なファイルパス・コード仕様・検証基準を明示
4. Execution: タスクごとに新しいSubagentをディスパッチ、2段階レビュー
5. TDD: RED-GREEN-REFACTOR サイクルを厳格に強制
6. Code Review: 計画に対する作業を重大度でカテゴリ化
7. Branch Completion: テストスイート検証、マージ/PR提示

Agentに考えずにコードを書き始めさせないためのガードレールとして機能します。SDDのフローにTDD・コードレビュー・ブランチ管理まで含めたフルサイクル自動化を求める場合に有効です。

### ワークフロー比較と選び方

| 要素 | Harper Reed式 | SDD / AI-DLC | RPI(構造化協業) | Superpowers |
|---|---|---|---|---|
| 主眼 | 詳細Spec生成 | 仕様駆動の実装 | 理解重視→原子的分解 | 方法論の強制 |
| 検証方法 | 人間レビュー | テスト・仕様準拠 | アノテーションサイクル | TDD + コードレビュー |
| 対象規模 | グリーンフィールド | 全般 | 中〜大規模(既存コード) | 全般 |
| ツール依存 | 低 | 高(フレームワーク必須) | 中(ファイル規約のみ) | 高(Plugin必須) |
| チーム | 個人向き | チーム向き | チーム向き | 個人〜チーム |

選び方の指針としては、個人の新規プロジェクトならHarper Reed式、チームで仕様管理が必要ならSDD、既存コードベースへの大きな変更ならRPI、ワークフロー全体を自動化したいならSuperpowersが候補になります。繰り返しですが、一つに限定する必要はありません。

さて、ワークフローを選んだとして、次はAgentとの実際のコーディングで品質をどう担保するかが問題になります。

## Agentとのコーディング: 品質を担保するテクニック

ここからはAgentとのコーディングセッション中にどう指示し、どう品質を担保するかに関するプラクティスです。どのプロジェクトワークフローとも組み合わせて使えます。

### Context Engineering

Agentの出力品質を決定する最も重要なテクニックです。どのモデルを使うか以上に、Agentに何を見せ何を見せないかが結果を左右します。

主要テクニックを整理します。

- Context Packing: タスクに必要なファイル・仕様・制約・既存コードのスタイルをすべてコンテキストに詰め込む。コーディング前のブレインダンプ([Osmani](https://addyosmani.com/blog/ai-coding-workflow/))
- Progressive Disclosure: CLAUDE.md / AGENTS.mdには100トークン程度の概要だけ載せ、必要なタイミングでSkillsやルールファイルを動的にロードする
- ファイルシステムを外部メモリとして使う: 調査結果や中間成果物はファイルに保存し、コンテキストにはパスの軽量参照のみ残す
- Todoリストで注意を管理: `todo.md`の作成・更新で目標をコンテキスト末尾に反復注入し、長いセッションで何をやっていたか忘れる問題に対処
- 失敗状態を消さない: エラートレースと失敗アクションを残す。Agentが同じミスを繰り返すのを防止する

やってはいけないアンチパターンもあります。CLAUDE.mdにFew-shotを大量に入れるとAgentがパターンを模倣し続けて思考停止します。コンテキストウィンドウを埋め尽くしてから作業させると[Context Rot](#context-rot)により性能が劣化します。

### Context Rot

このContext Engineeringの話をすると避けて通れないのがContext Rotです。

[Chroma Research](https://research.trychroma.com/context-rot)と[Morph](https://www.morphllm.com/context-rot)の研究によると、入力コンテキスト長が増加するにつれてLLMの出力品質が測定可能に劣化します。トークン上限のはるか手前から連続的に性能が低下するという厄介な現象です。ただし、2026年3月時点ではClaude(Opus 4.6 / Sonnet 4.6)やCodexが[1Mトークンのコンテキストウィンドウに対応](https://claude.com/blog/1m-context-ga)しており、Opus 4.6はMRCR v2で78.3%と長文検索タスクでフロンティアモデル最高スコアを記録しています。Context Rotが消えたわけではありませんが、実用上の余裕は大きく広がっています。

利用者としての実践的対策はシンプルです。

- セッションを短く保つ。1セッション1タスクを原則とし、フェーズの区切りで新セッションを開始する
- Subagentを積極的に使う。調査・探索を独立コンテキストに委譲し、メインのコンテキストを汚染しない(性能90.2%改善の報告あり)
- compactを恐れない。コンテキストが溜まったら`/compact`や自動compactionに任せる
- 不要なファイルをコンテキストに入れない。念のための大量ファイル読み込みは逆効果

逆に1Mコンテキストを積極活用する選択肢もあります。Codexでは`model_context_window=1000000`の[設定で1Mに拡張可能](/posts/gpt-5-4-codex-1m-context/)です。Claude CodeのMaxプランではOpus 4.6が1Mコンテキストでデフォルト動作します。不要な場合は`CLAUDE_CODE_DISABLE_1M_CONTEXT=1`で[無効化できます](https://code.claude.com/docs/en/model-config#extended-context)。コンテキストを短く保つか長く使うかはタスク特性に応じて判断してください。

### TDD × Coding Agent

Context Rotの対策としてセッションを短く保つ話をしましたが、短いセッションで品質を担保するにはテストが不可欠です。

[Tweag Agentic Coding Handbook](https://tweag.github.io/agentic-coding-handbook/WORKFLOW_TDD/)やOsmaniが体系化したTDD × Coding Agentのパターンは、Red → Green → Refactor サイクルをCoding Agentに強制するテクニックです。Osmaniはテストこそが Agentic EngineeringとVibe Codingを分ける最大の差別化要因だと述べています。

Agentic TDDの典型的な流れはこうなります。

1. `AGENTS.md`と`spec.md`をリポジトリに配置
2. ビジネスルールからTDD計画をマークダウンチェックリストとして生成
3. Red: 失敗するテストを一つ書く
4. Green: テストを通す最小限の実装をAgentに書かせる
5. Refactor: テストを全部グリーンに保ったままロジックをきれいにして、と指示
6. 次のテストへ進む

ツールとしては[tdd-guard](https://github.com/nizos/tdd-guard)(1,811 stars)がClaude CodeのHookとして動作し、テストを飛ばそうとするとブロックして何をすべきか説明してくれます。

核心はテストがプロンプトになるということです。テストという形式でAIに期待する振る舞いを厳密に伝えられます。エージェント生成コードの品質担保の最も信頼性の高い方法であるという共通認識が業界で確立しています。

### マルチエージェント分業

TDDで個々のタスクの品質を保てるようになったら、次は複数タスクの並列化が視野に入ります。

[Anthropic - Building a C compiler with Claude](https://www.anthropic.com/engineering/building-c-compiler)(16並列Agent、10万行Cコンパイラ)が示したように、複雑な機能の開発を複数のAgentに分担させることで設計・実装・レビューを並列化できます。各Agentが独立したコンテキストウィンドウで動くため、Context Pollutionを回避できるのも大きなメリットです。

典型的なエージェント構成はOrchestrator(全体指揮、コードは書かない)、Frontend/Backend/Testing(各ドメイン専門)、Reviewer/Security(品質チェック)です。

各ツールでの実現方法が異なります。

| ツール | 方式 | 特徴 |
|---|---|---|
| Claude Code Subagent | 委譲型。親から独立コンテキストでタスクを処理して結果を返す | 安定機能。1タスク1Subagentの明快なモデル |
| Claude Code Agent Teams | 協調型。チームメイト間の双方向通信、共有タスクリスト | 実験的機能(2026/02〜)。3-5チームメイト推奨 |
| OpenAI Codex | サブエージェントを並列生成。CSVで一括タスク分配も可能 | 実験的機能。各エージェントはworktreeで隔離 |
| Cursor | 最大8エージェント並列。Mission Control で一覧管理 | IDE内でのビジュアル管理が強み |

注意点として、単一の変更に全エージェントが集中する場面では互いの変更を上書きするリスクがあります。Carlini C compilerプロジェクトでもこれが課題になりました。モノレポではルートのAGENTS.mdでリポ構造・共有ルール・境界を定義し、各app/packageに個別のAGENTS.mdでローカル文脈を配置するのが推奨されます。

### Best-of-N 並列戦略

マルチエージェント分業は違うタスクを並列に進めるものですが、同じタスクを並列に試す戦略もあります。LLMの非決定論性をバグではなく特徴として活用するBest-of-N戦略です。

やり方はシンプルで、同じ仕様・プロンプトでN個のAgentを並列に走らせ(各々が独立したgit worktreeで動作)、N個の異なる実装から最良のものを選ぶ、または複数の実装の良い部分を合成します。

各Agentの成功確率が25%なら、4並列で68%(1 - 0.75^4)、8並列で90%になります。API利用料は並列数に比例しますがコスト差としては無視できるレベルです。

Carliniの16並列プロジェクトからの知見として、テストが独立している段階では並列化は自然に機能しますが、単一巨大タスク(Linux kernel全体のコンパイルなど)では全エージェントが同じバグに取り組んで互いの変更を上書きする問題が起きます。テキストファイルベースのタスクロックで排他制御するのが対策でした。

アーキテクチャ判断、アルゴリズム選定、UIデザインなど正解が一つでない問題に有効です。

### AI on AI Review

並列戦略で複数の候補を得たとしても、どれが良いかを判定する目が必要です。ここでAI生成コードを別のAI(あるいは別のモデル)にレビューさせるテクニックが有効になります。

パターンとしては、モデル・ミュージカルチェア(一つのモデルで詰まったら別モデルに投げる)、クロスレビュー(Claude Codeで実装 → GPTでレビュー)、レイヤー分離(実装AgentとレビューAgentをSubagentとして分離)があります。

### 失敗モード・アンチパターン

さて、うまくいかないケースを知ることがAgent活用の成熟度を決めます。成功パターンだけでなく失敗パターンも整理しておきます。

| 失敗モード | 症状 | 対策 |
|---|---|---|
| ハルシネーション | 存在しないAPI・メソッドの呼び出し | 最新ドキュメントを注入、テストで即座に検出 |
| 無限ループ | 同じコマンドの繰り返し | ralph-orchestratorのGutter検知、トークン上限で強制終了 |
| 過剰生成 | 要求していない機能の追加 | スコープを明示的に限定、AGENTS.mdに禁止事項を記載 |
| 偽の完了報告 | テスト失敗にもかかわらず完了を宣言 | PostToolUse Hookでテスト自動実行 |
| Agent Drift | 自信を持って制約を逸脱 | Linter・型チェッカーで機械的に矯正 |
| 確率的カスケード | 各ステップ95%成功 → 5ステップで77% | タスクを小さく分割、各ステップでテスト検証 |

特に注意すべきなのがComprehension Debt(理解負債)です。AI支援を受けた開発者の技能習得が17%低下するという研究結果があります。Osmani自身もテストが通った、ちらりと見てOK、マージした、3日後にどう動いているか説明できなかった、という経験を語っています。生成速度と理解速度のギャップ(5-7倍)がComprehension Debtの根源です。

対策としては、AI生成コードのLinear Walkthrough([Willison](https://simonwillison.net/guides/agentic-engineering-patterns/linear-walkthroughs/))をエージェントに生成させ、人間が読んで理解する時間を確保します。コードの書き手ではなく監督に徹するには、コードを読む能力がむしろ重要になるという逆説があります。

### Agent-Nativeなコード設計

ここまでテクニックの話をしてきましたが、テクニック以前にコードベース自体の設計がAgentの効率を決定的に左右します。

[Factory.ai](https://factory.ai/news/using-linters-to-direct-agents)のリントルール体系や[every.to](https://every.to/guides/agent-native)のAgent-Nativeアーキテクチャガイドから導かれる設計原則を紹介します。

- Grep-able命名: named export強制、一貫したエラー型。エージェントは`grep`、`glob`、`cat`が最も得意な操作であり、検索で見つかる命名が効率を決定的に左右します
- Collocated Tests: テストをソースコード隣接の`__tests__/`に配置。`ComponentName.test.tsx`の一貫した命名で`ls`一回でテストの有無を確認可能にします
- 機能単位モジュール化: 水平スライス(`Services/`, `Controllers/`, `Models/`)ではなく機能単位でファイルを凝集します。ディレクトリのジャンプを最小化するためです
- テストを報酬信号にする: エージェントはテスト合格/不合格で実装の正否を判定します。テストのないコードパスはエージェントにとって品質保証不能です
- API境界の明確化: モジュール間のインターフェース(型定義、API契約)を先に合意しておくことがマルチエージェント並列実行の前提条件になります

Inner Loop(IDE内のcompile-test-debug)とOuter Loop(CI/CDのIssue → PR → マージ)の両方でAgentの役割を定義し、段階的に導入するのが推奨されます。Inner Loopの規律確立 → Outer Loopのガバナンスという順番です。

さて、ここまでコーディングテクニックを見てきましたが、これらを毎回手動で適用するのは非現実的です。ここからは仕組みとインフラの話に入ります。

## 仕組みとインフラ: ワークフローを支える基盤

前章のテクニックを継続的に機能させるための環境設定、ツール構成、自動化パイプラインです。一度セットアップすれば継続的に効きます。前回記事で扱ったHarness Engineeringの実装層にもあたります。

### CLAUDE.md / AGENTS.md の設計

2025年8月にOpenAIがリリースしたAGENTS.mdは、2025年12月に[AAIF(Agentic AI Foundation)](https://www.linuxfoundation.org/press/linux-foundation-announces-the-formation-of-the-agentic-ai-foundation)としてLinux Foundation傘下に移管され、事実上の業界標準となりました。60,000以上のオープンソースプロジェクトで採用済みです。Claude Code、Codex、Cursor、Copilot、Gemini CLI、Windsurf、Aider等が対応しています。

CLAUDE.md、AGENTS.md、SOUL.mdの3つは補完関係にあります。

| ファイル | 役割 | スコープ |
|---|---|---|
| AGENTS.md | ユニバーサルエージェントブリーフ。何をすべきか | 全ツール共通 |
| CLAUDE.md | Claude Code専用のオペレーション指示 | Claude Code固有 |
| SOUL.md | エージェントの人格定義。パーソナリティ | 任意 |

共有コンテキストはAGENTS.mdに、Claude固有の指示はCLAUDE.mdに配置するのが基本です。

設計の収束パターンとして、OpenAIは百科事典ではなく目次として扱えと述べています。サイズは60〜150行が目安で、[HumanLayer](https://www.humanlayer.dev/blog/writing-a-good-claude-md)は60行以下を推奨、[Vercel](https://vercel.com/blog/agents-md-outperforms-skills-in-our-agent-evals)は40KBから8KBに圧縮しても100%パス率を維持しました。CLAUDE.mdにはファイルへのポインタのみ記載し、詳細はサブフォルダのCLAUDE.md / Skills / 外部ドキュメントに分離するProgressive Disclosureが推奨されます。

VercelのNext.js 16での実証は興味深いです。8KBのAGENTS.mdドキュメントインデックスが100%パス率を達成し、Skillsベースのリトリーバル(53%)を47ポイント上回りました。成功要因はパッシブコンテキスト(常時利用可能)がオンデマンドリトリーバルに勝ることです。

### Agent Skills・Pluginsエコシステム

ここでProgressive Disclosureの話が出たので、Agent Skillsについても触れます。

2025年10月に[Anthropic](https://www.anthropic.com/engineering/equipping-agents-for-the-real-world-with-agent-skills)が発表し、12月にオープン標準として公開されたAgent Skillsは、30以上のツールが公式対応する業界標準です。Claude Code / Codex CLI / Gemini CLI / Cursor / GitHub Copilot / Windsurf等で使えます。

3段階ローディングでコンテキスト効率を最適化しています。

| レベル | タイミング | トークンコスト | 内容 |
|---|---|---|---|
| L1: メタデータ | 起動時(常時) | 約100トークン/スキル | YAML frontmatterのname + description |
| L2: 指示書 | スキル発動時 | 5,000トークン未満 | SKILL.md本文 |
| L3: リソース | 必要時のみ | 実質無制限 | scripts/, references/ 等 |

スキルが使用されない場合、98%のトークン削減を実現します。10以上のスキルをインストールしても、発動されたものだけがコンテキストを消費します。

各ツールでの配置場所が異なるので注意が必要です。

| ツール | 配置場所 | 特記事項 |
|---|---|---|
| Claude Code | `.claude/skills/` / `~/.claude/skills/` | Pluginsでバンドル配布可能 |
| Codex CLI | `.agents/skills/` | [openai/skills](https://github.com/openai/skills)(14,139 stars)で公式カタログ提供 |
| Gemini CLI | `.gemini/skills/` / `.agents/skills/` | `activate_skill`ツールで自律発動 |

使い分けの指針として、プロジェクト規約・フレームワーク知識はAGENTS.mdに圧縮して常時ロード、複雑なマルチステップワークフロー(TDD、コードレビュー等)はSkillsでオンデマンドロードが推奨されます。

エコシステムの規模も急拡大しています。[anthropics/skills](https://github.com/anthropics/skills)(92,958 stars)、[obra/superpowers](https://github.com/obra/superpowers)(82,111 stars)、[ComposioHQ/awesome-claude-skills](https://github.com/ComposioHQ/awesome-claude-skills)(43,816 stars)、[SkillsMP](https://skillsmp.com)(71,000以上のスキル)と大規模なエコシステムが形成されています。

Claude Code固有のPluginsはSkills・MCP・Slash Commands・Agentsを単一パッケージにバンドルする仕組みで、公式マーケットプレイス([claude-plugins-official](https://github.com/anthropics/claude-plugins-official)、10,865 stars)に9,000以上のプラグインが存在します。

### Hooks・Linter・決定論的ツール

Agent SkillsとAGENTS.mdでAgentに何をすべきかを伝えたとして、それを守らせるのがHooks・Linter・決定論的ツールです。これは[前回の記事](/posts/harness-engineering-best-practices-2026/)で詳しく扱ったので、ここではポイントだけ触れます。

Claude Code Hooksのイベントは以下の通りです。

| イベント | タイミング |
|---|---|
| PreToolUse | ツール呼び出し前(ブロック可能) |
| PostToolUse | ツール呼び出し後 |
| Stop | Claude応答完了時 |
| SessionEnd | セッション終了時 |
| WorktreeCreate / Remove | Agent Teams のワークツリー操作時 |
| PreCompact / PostCompact | コンテキスト圧縮前後 |

PostToolUse Hookでリント→フォーマット→型チェックを自動実行し、違反をAgentのコンテキストに注入して自己修正を駆動するのが基本パターンです。

[OpenAI](https://openai.com/index/harness-engineering/)はカスタムLinterのエラーメッセージ自体に何が間違いか、なぜこのルールがあるか、具体的な修正手順を含める設計を推奨しています。人間中心のワークフローではうるさいと感じるルールが、エージェントにとっては乗数になります。

[Factory.ai](https://factory.ai/news/using-linters-to-direct-agents)の7カテゴリリントルール体系(Grep-ability、Glob-ability、Architectural Boundaries、Security & Privacy、Testability、Observability、Documentation)も参考になります。

[Nick Tune](https://nick-tune.me/blog/2026-02-28-hook-driven-dev-workflows-with-claude-code/)はHooksをDDDのドメインイベントとして扱い、ワークフローエンジンをAggregateとして設計するパターンを提唱していて面白いです。

### Git Worktreeによる並列実行

マルチエージェント分業やBest-of-N並列戦略を物理的に支えるのがGit Worktreeです。各エージェントが独立したworktreeで作業することでファイル競合なしに同時開発が可能になります。

Claude Codeは2026年2月20日からネイティブサポートしています。

```bash
# worktree隔離でClaude Codeを起動
claude --worktree feature-auth

# tmuxセッションで起動（放置可能）
claude --worktree bugfix-123 --tmux
```

OpenAI Codexのクラウドモードでは各タスクがリポジトリをプリロードした隔離コンテナで実行され、CLIモードでもGit worktreeベースの並列実行が可能です。

注意点として、同じファイルを複数Agentが編集するとマージコンフリクトが発生します。共有インターフェース(API境界・型定義)を先に合意しておくのが前提です。またworktreeはローカルDB・Dockerデーモン・キャッシュを共有するため、DBステートの同時変更でレースコンディションが発生しうることも覚えておいてください。

### MCP vs CLI + Skills

ここでツール連携の方式について整理します。MCPはAgent全般にとって強力な規格ですが、Coding Agentにおいては大半のユースケースでCLI + Skillsが最適解であり、MCPは特定条件下で価値を発揮するというのが現状の知見です。

CLIが好まれる理由は、LLMの訓練データとの親和性(`gh`、`git`等のCLIパターンが重みに刻まれている)とSkillsの軽量さです。[David Cramer](https://cra.mr/mcp-skills-and-agents/)(Sentry CEO)は常時2つのMCP + 約12のSkillsという構成で運用しており、多くのMCPサーバーは存在する必要がないと述べています。

また、最近はこの傾向によりCLIが提供されてこなかったツールも公式が開発し提供するような流れが出てきています。

### オーケストレーションツール群

ここまで個々のツールの話をしてきましたが、これらを束ねてCoding Agentの並列実行・タスク管理・ワークフロー制御を行うオーケストレーションツールも急速に増えています。大きく4タイプに分かれます。

ワークフロー定義型(プロジェクトの進め方を規定する)としては、[everything-claude-code](https://github.com/affaan-m/everything-claude-code)(74,956 stars)や[oh-my-claudecode](https://github.com/Yeachan-Heo/oh-my-claudecode)(9,642 stars)があります。

エージェント管理型(並列実行・タスク割り当てを管理する)としては、[Aperant](https://github.com/AndyMik90/Aperant)(13,265 stars)、[GasTown](https://github.com/steveyegge/gastown)(12,035 stars、Steve Yegge作)、[1code](https://github.com/21st-dev/1code)(5,214 stars)、[agent-orchestrator](https://github.com/ComposioHQ/agent-orchestrator)(4,303 stars)などがあります。

プロセスマルチプレクサ型(複数Agentの起動・監視・切り替え)としては、[Superset IDE](https://github.com/superset-sh/superset)(6,888 stars)、[Claude Squad](https://github.com/smtg-ai/claude-squad)(6,338 stars)、[dmux](https://github.com/standardagents/dmux)(1,086 stars)があります。

ロールベース型(開発フェーズごとに専門化された認知モードを提供する)としては、[gstack](https://github.com/garrytan/gstack)(11,379 stars、Garry Tan作)があります。計画はレビューではない、レビューはシッピングではないという思想のもと、`/plan-ceo-review`(プロダクト思考)、`/plan-eng-review`(技術レビュー)、`/review`(コードレビュー)、`/ship`(リリース)、`/qa`(QAテスト)、`/retro`(振り返り)等の8つの専門スラッシュコマンドをClaude Code向けに提供し、汎用アシスタントを役割特化のモードに切り替えます。

動向として、Coding Agent自体がマルチエージェント機能を内蔵し始めているため、プロセスマルチプレクサ型は長期的にニッチ化する可能性があります。

### 長時間セッション設計

オーケストレーションの話が出たので、複数のコンテキストウィンドウを跨いで一貫した進捗を維持するためのセッション設計パターンも整理します。いずれもコンテキストウィンドウはステートレスに保ち、ファイルシステムとgitを永続ストレージとして使うという原則を共有します。

Ralph Loop([Geoffrey Huntley](https://ghuntley.com/loop/), 2025/06〜)は本質的に1行です。

```bash
while :; do cat PROMPT.md | claude ; done
```

PROMPT.mdに目標仕様を記述し、Claudeが1イテレーション分の作業を実行してコミットします。コンテキストが一杯になるか完了すると終了し、ループが新鮮なコンテキストで次のイテレーションを自動起動します。Context Rotを構造的に回避できます(毎回0%から開始)。2025年12月にAnthropicが公式`ralph-wiggum`プラグインとして統合しました。

発展形として、[ralph-orchestrator](https://github.com/mikeyobrien/ralph-orchestrator)(2,175 stars, Rust実装)はBackpressure Gate(テスト/lint/型チェックが通らないと次に進めない)や70kトークンで警告・80kで強制ローテーションの機能を持っています。[oh-my-claudecode](https://github.com/Yeachan-Heo/oh-my-claudecode)のRalphモードは32専門エージェントとUltrawork並列実行(5+並行)、`.omc/notepad.md`による圧縮不滅の永続メモリを提供します。

Anthropic公式の二重エージェント方式([claude-quickstarts/autonomous-coding](https://github.com/anthropics/claude-quickstarts)、15,264 stars)では、Initializer Agentが`feature_list.json`(200件のフィーチャー + テストケース)を生成し、Coding Agentが`"pending"`を1つ選択 → 実装 → テスト → ステータスを`"passing"`に更新 → コミット → 3秒後に次セッション自動起動、というサイクルで動作します。

セッション間の状態引き継ぎパターンをまとめます。

| 手法 | 用途 | 出典 |
|---|---|---|
| `feature_list.json` | フィーチャー一覧とステータス管理 | Anthropic公式 |
| `progress.md` / `research.md` / `plan.md` | FIC方式の各フェーズ成果物 | HumanLayer |
| `ROTATION-HANDOVER.md` | コンテキスト回転時の構造化引き継ぎ | VNXシステム |
| `.omc/notepad.md` | 圧縮で消えない永続メモリ | oh-my-claudecode |
| git commitメッセージ | 差分の意図と次のアクション | 全パターン共通 |

セッション設計の複雑さのスペクトラムとしては、Ralph bash loop(1行) → /loop(公式) → FIC(手法) → Dual Agent(2エージェント) → oh-my-claudecode(19エージェント)の順に高度化していきます。

### GitHub Agentic Workflows

長時間セッション設計はローカル実行の話でしたが、CI/CDの延長としてCoding Agentを組み込む[GitHub Agentic Workflows](https://github.blog/ai-and-ml/automate-repository-tasks-with-github-agentic-workflows/)(2026年2月テクニカルプレビュー)もあります。

ユースケースとしてはContinuous Triage(新Issue自動要約・ラベル付け)、Continuous Documentation(コード変更に追随するドキュメント更新)、Continuous Test Improvement(カバレッジ評価と高価値テスト追加)、Continuous Quality Hygiene(CI失敗調査と修正PR提案)があります。

ワークフロー定義はMarkdownで、`gh aw compile`でGitHub Actions YAMLに変換されます。safe-outputsでAIの書き込み権限を厳密に制限(読み取り専用アクセスがデフォルト)し、PRは自動マージされない設計です。CI/CDを置き換えるのではなく拡張するものという位置づけです。

### セキュリティの注意点

Coding Agentに広い権限を与えて自律実行させる場合、[OWASP Top 10 for Agentic Applications](https://genai.owasp.org/resource/owasp-top-10-for-agentic-applications-for-2026/)(2025/12)を意識する必要があります。

利用者が気をつけるべきポイントを簡潔にまとめます。

- 権限は最小限に。Claude Codeの`--allowedTools`や`.claude/settings.json`のpermissionsでツール・コマンドの権限を制御する
- MCPサーバーの出所を確認する。サードパーティMCPサーバーはサプライチェーン攻撃のベクターになりうる
- シークレットをコンテキストに入れない。`.env`やcredentialsをAgentに読ませず、MCPサーバー経由で間接アクセスさせる
- Agent生成コードは必ずレビューする。自動マージは避ける
- 破壊的操作にはガードレールを設ける。HooksのPreToolUseで`rm -rf`や`git push --force`等をブロックする

### Symphony: イシュー駆動の自律オーケストレーション

さて、この節の締めくくりとして、最も高い抽象度で動くオーケストレーションを紹介します。

[OpenAI Symphony](https://github.com/openai/symphony)(Experimental / Engineering Preview)はエージェントではなくこなすべき仕事(Issue)を管理する、というコンセプトで、イシュートラッカーを介してタスクを管理するフェーズへと抽象度を引き上げるものです。

主な仕組みとしては、Linearなどのカンバンボードを常時ポーリングしてTodoのチケットを検知すると自律的にIn Progressへ移し、検証を終えるとHuman Reviewへ移行させます。タスクごとに独立したワークスペースを自動生成しCodexを投入する物理的なワークスペース分離、`WORKFLOW.md`によるポリシーのコード化、OTP(Elixir)ベースの自己回復とリトライ、複数SSHワーカーへのリモート分散実行といった機能を備えています。

ただしこれはあくまで実験的プロトタイプです。デフォルトでは強力なガードレールなしで稼働するため、前回記事で紹介したHarness Engineering(決定論的テスト、Linter、CIによる自動検証)がコードベースに整備されていることが導入の絶対条件となります。

さて、業界の動向を一通り見てきました。最後にわたしが実際にどうやっているかを紹介します。

## わたしのワークフロー

ここまでさまざまなワークフローを紹介してきましたが、わたしが開発をするときはどれか一つを採用するのではなく、さまざまなパターンを使い分けています。

### アイデアドリブン開発

Linearにアイデアを投入すると自動的に開発が進む、というワークフローです。

![アイデアドリブン開発のボード](/img/coding-agent-workflows-2026/idea-driven-board.png)

かなりSymphonyに似ています。だいたいみんなこういうものを作っている気がします。

認知負債を最小に進行するにはどうすればいいか、というところから出発しました。

1. ユーザーがアイデアを投下する
2. Agentが自動的に仕様にする
3. ユーザーが仕様をレビューする
4. Agentが実装する
5. ユーザーが検収する

という流れです。ユーザーはAgentが困ったときにしか対応せず、レビューも容易にできるように工夫しています。

Agent - 人間の協働で困るのは人間側がAgent側からの通知を常に見なければならないことだと思っていて、これは開発時に電話等の受け取り対応をしなければならない現場に似ています。集中は可能な限り削ぐべきではないという思想のもと、sessionが止まっているかをPatrol Agentが巡回し、必要な行動をユーザーに定期的にまとめて通知する仕組みにしています。ユーザーはSlack / Discordのチャットを見て、そのときにまとめて対応すればいいわけです。

### 自動開発

これは実験的ですが、プランベースの自動開発もしています。開発ドキュメントを徹底的に準備し、ハーネスやフィードバックループを設定後、tasks.jsonlにTaskを記述し、自動的にClaude Codeを実行させています。Claude CodeはタスクごとにPlanモードで検討 → 自動承認 → 実装という流れです。commitフックでCodexによるreviewが自動的に走ります。

先日もこれで8時間の自動ランが行われました。

### 開発前にしていること

アイデアドリブン開発でも自動開発でも最初の準備が非常に重要なのでやっていることを簡単に挙げます。

- まずアイデアをすべてContext Packingする
    - 脳内の思考、思いつき、とにかく全部書き出す
    - AgentやLLMとの対話の前にこれを徹底的に書き出すことが大事だと感じています
    - 対話によって企画書や仕様書はうまく作れるが、つらっとした企画書は面白みが残りづらいです
- Agentと対話しながらアイデアを深堀りする
    - これはLocalのAgentと一緒にやったほうがいい
    - できればリポジトリを作っておく
    - researchディレクトリ以下に調査、ideaディレクトリ以下にアイデア、と完全に分離させて深堀りする(research以下に設計が残らないようにする)
    - 作らせたresearch、ideaを徹底的に読み込んで、違和感を全部伝えて直していく(ここでノイズが残ったままだと後続の作業が簡単に破綻する)
- アイデアを仕様にする
    - docsやdocs/adrに変換していく
- リファレンスを構造化して配置
    - ライセンスを考慮しつつ参照させるべきドキュメント群などを配置する
    - 特定のライブラリに依存したソフトウェアを開発する場合、ライブラリなどをここに配置する
- ガードレールと自動フィードバックを仕込む
    - PostToolUseなどでのlint情報の注入などを仕込む(こうしたharnessはCoding Agentに適切な実装をするように強制する)
    - WebApp開発等の場合、tsx等を編集したときに `Note: 大きな変更の際はvisual-checkスキルで確認してください` と注入するようにしている(ただし大きな変更とはなにかをAgentに託す形になるので推奨されない。変更行数等を見てしきい値で発火してスクリーンショット等をフルパスでContextに返すのがいいかもしれないと感じています)
- docs、docs/adr、CLAUDE.md、AGENTS.mdを適切に保つ仕組みを入れる
    - Lefthookのpre-commitで発動する自動的なガードレールで以下を検証
        - AGENTS.mdが60行を超えていないか
        - AGENTS.md / CLAUDE.md 内のパスが実在するか(壊れたポインタ検出)
        - docs/ と ADR の `last-validated` 日付が古すぎないか(3日で警告、5日でエラー)
            - これは開発初期のため
            - こういう機構があることでドキュメントの腐敗対策ができます。ドキュメントが存在するべきかしないべきかは別の問題としておきましょう
        - docs/ / AGENTS.md / CLAUDE.md が superseded な ADR を参照していないか
    - エラーがあった場合、修正専用のSubAgentをspawnして対処しろ、という警告が出る

焦らず、いろんなパターンで試行錯誤してみるのも面白いと思います。そうすることで、Coding Agentの振る舞いにたいする理解も深まっていきます。

## まとめ

- 2026年はAgentic Engineeringが確立し、プロジェクトワークフロー(SDD、RPI等)・実装テクニック(Context Engineering、TDD)・インフラ(AGENTS.md、Skills、Hooks)の3層で開発を設計する時代になってきました
- フィードバックループを決定論的に閉じる、人間は構造化されたポイントで介入する、セッションを短く保つことなどはとても大事だと思います
- より自動化されたフローについて考えるのも面白いかもしれません

## References

### Agentic Engineering
- [Karpathy - Vibe Coding / Agentic Engineering](https://x.com/karpathy/status/1886192184808149383)
- [The New Stack - Vibe Coding is Passé](https://thenewstack.io/vibe-coding-is-passe/)
- [Addy Osmani - Agentic Engineering](https://addyosmani.com/blog/agentic-engineering/)
- [Addy Osmani - The Factory Model](https://addyosmani.com/blog/factory-model/)
- [Simon Willison - Agentic Engineering Patterns](https://simonwillison.net/2026/Feb/23/agentic-engineering-patterns/)

### プロジェクトワークフロー
- [Harper Reed - My LLM codegen workflow atm](https://harper.blog/2025/02/16/my-llm-codegen-workflow-atm/)
- [GitHub Spec Kit](https://github.com/github/spec-kit)
- [Martin Fowler - Understanding SDD](https://martinfowler.com/articles/exploring-gen-ai/sdd-3-tools.html)
- [AWS - AI-Driven Development Life Cycle](https://aws.amazon.com/blogs/devops/ai-driven-development-life-cycle/)
- [awslabs/aidlc-workflows](https://github.com/awslabs/aidlc-workflows)
- [Thoughtworks - SDD Technology Radar](https://www.thoughtworks.com/en-us/radar/techniques/spec-driven-development)
- [Boris Tane - How I Use Claude Code](https://boristane.com/blog/how-i-use-claude-code/)
- [Block - AI-Assisted Development at Block](https://engineering.block.xyz/blog/ai-assisted-development-at-block)
- [HumanLayer - Advanced Context Engineering](https://github.com/humanlayer/advanced-context-engineering-for-coding-agents)
- [obra/superpowers](https://github.com/obra/superpowers)
- [arXiv - Spec-Driven Development Paper](https://arxiv.org/abs/2602.00180)

### 実装テクニック
- [Anthropic - Effective context engineering for AI agents](https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents)
- [Chroma Research - Context Rot](https://research.trychroma.com/context-rot)
- [Morph - What Is Context Rot?](https://www.morphllm.com/context-rot)
- [Tweag Agentic Coding Handbook - TDD](https://tweag.github.io/agentic-coding-handbook/WORKFLOW_TDD/)
- [nizos/tdd-guard](https://github.com/nizos/tdd-guard)
- [Anthropic - Building a C compiler with Claude](https://www.anthropic.com/engineering/building-c-compiler)
- [Addy Osmani - The 80% Problem](https://addyo.substack.com/p/the-80-problem-in-agentic-coding)
- [Addy Osmani - My LLM coding workflow going into 2026](https://addyosmani.com/blog/ai-coding-workflow/)
- [Martin Fowler - Humans and Agents in Software Engineering Loops](https://martinfowler.com/articles/exploring-gen-ai/humans-and-agents.html)
- [every.to - Agent-native Architectures](https://every.to/guides/agent-native)
- [GitHub Blog - How to write a great agents.md](https://github.blog/ai-and-ml/github-copilot/how-to-write-a-great-agents-md-lessons-from-over-2500-repositories/)

### インフラ・仕組み
- [OpenAI - Harness engineering](https://openai.com/index/harness-engineering/)
- [HumanLayer - Writing a Good CLAUDE.md](https://www.humanlayer.dev/blog/writing-a-good-claude-md)
- [Vercel - AGENTS.md Outperforms Skills](https://vercel.com/blog/agents-md-outperforms-skills-in-our-agent-evals)
- [Anthropic - Agent Skills](https://www.anthropic.com/engineering/equipping-agents-for-the-real-world-with-agent-skills)
- [anthropics/skills](https://github.com/anthropics/skills)
- [Claude Code Hooks Guide](https://code.claude.com/docs/en/hooks-guide)
- [Factory.ai - Using Linters to Direct Agents](https://factory.ai/news/using-linters-to-direct-agents)
- [Nick Tune - Hook-driven dev workflows](https://nick-tune.me/blog/2026-02-28-hook-driven-dev-workflows-with-claude-code/)
- [ScaleKit - MCP vs CLI Benchmarking](https://www.scalekit.com/blog/mcp-vs-cli-use)
- [David Cramer - MCP, Skills, and Agents](https://cra.mr/mcp-skills-and-agents/)
- [Context7](https://github.com/upstash/context7)

### セッション設計・オーケストレーション
- [Geoffrey Huntley - Everything is a Ralph Loop](https://ghuntley.com/loop/)
- [HumanLayer - Brief History of Ralph](https://www.humanlayer.dev/blog/brief-history-of-ralph)
- [ralph-orchestrator](https://github.com/mikeyobrien/ralph-orchestrator)
- [oh-my-claudecode](https://github.com/Yeachan-Heo/oh-my-claudecode)
- [anthropics/claude-quickstarts](https://github.com/anthropics/claude-quickstarts)
- [VNX Context Rotation](https://vincentvandeth.nl/blog/context-rot-claude-code-automatic-rotation)
- [GitHub Blog - Agentic Workflows](https://github.blog/ai-and-ml/automate-repository-tasks-with-github-agentic-workflows/)
- [gh-aw](https://github.com/github/gh-aw)
- [OpenAI Symphony](https://github.com/openai/symphony)
- [garrytan/gstack](https://github.com/garrytan/gstack)

### セキュリティ・コスト
- [OWASP Top 10 for Agentic Applications](https://genai.owasp.org/resource/owasp-top-10-for-agentic-applications-for-2026/)
- [Claude Code Costs Docs](https://code.claude.com/docs/en/costs)
- [claudefa.st - Model Selection](https://claudefa.st/blog/models/model-selection)
- [DORA Report 2025](https://www.faros.ai/blog/key-takeaways-from-the-dora-report-2025)
- [Linux Foundation - AAIF](https://www.linuxfoundation.org/press/linux-foundation-announces-the-formation-of-the-agentic-ai-foundation)
