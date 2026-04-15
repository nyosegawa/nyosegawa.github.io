---
title: "Skillにアプリケーションを組み込んでみる"
description: "Agent Skillにローカルで動くWebアプリを同梱する実装パターン。Agentがプラットフォームとなりアプリが組み込まれる未来について考える。"
date: 2026-03-26
tags: [Agent Skill, Coding Agent, Generative UI, Claude Code, React]
author: 逆瀬川ちゃん
lang: ja
---

こんにちは！逆瀬川ちゃん ([@gyakuse](https://x.com/gyakuse)) です！

今日はAgent Skillにアプリケーションを組み込む実装を作ってみたので、その話と、Agentがプラットフォームになる未来について考えていきたいと思います。

<iframe
  width="100%"
  height="405"
  src="https://www.youtube.com/embed/vgw8i9-wUbM"
  title="Skill Appsの紹介"
  frameborder="0"
  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
  allowfullscreen
></iframe>

<!--more-->

## アプリケーションにAgentが載る時代

さいきんはアプリケーションにAgentの機能が追加されるものが増えています。

Coding Agentを毎日使っていると、逆でもいいんじゃないかな〜とよく思います。Agentの側からアプリケーションを呼び出す方が自然だと感じます。自分がやりたいことをAgentに伝えて、必要に応じてAgentがアプリを開いてくれる。そういう体験の方がしっくりきます。

## OpenAI Apps SDKとChatGPTのApps

このプラットフォームにアプリケーションが組み込まれるみたいな方向性は、だいぶ前からあります。最近でもOpenAIが[Apps in ChatGPT](https://openai.com/ja-JP/index/introducing-apps-in-chatgpt/)を発表していました。ChatGPTの中で動くサードパーティアプリケーションです。

MCPでも[MCP Apps](https://blog.modelcontextprotocol.io/posts/2026-01-26-mcp-apps/)としてプロトコルが拡張され、ツールがプレーンテキストではなくインタラクティブなUIコンポーネント（ダッシュボード、フォーム、ビジュアライゼーション等）を返せるようになっています。Claude、Goose、VS Code Insiders、ChatGPTなど複数のクライアントで利用できます。

さて、Coding Agentと日常的に触れていると観察されるのは、みんながいろんなアプリケーションをそれぞれ自分向けに作るようになってきていることです。CRMも経費管理も、自分の業務に合った形で作ってしまう。ホスティングの必要はほとんどなくて、ローカルにあるだけでも十分なのかもしれません。

一方で、アプリケーションを個人的に大量に作ると「どこに何があるかわからなくなる」「結局自分でも使わない」という課題もあります。作ることと使い続けることの間にはギャップがあって、これをどう埋めるかが重要だと思います。

## 仕様を考えてみる

AgentがUIを扱うための仕様は、業界でいくつか整備されつつあります。

GoogleがA2UIという宣言的なUIプロトコルを出していたり、CopilotKitがAG-UIでイベントベースの双方向通信を作っていたり。Claude ArtifactsやChatGPT Canvasのようにコードを直接生成して実行するアプローチもあります。

ざっくり整理するとこんな感じです。

| アプローチ | 代表例 | 仕組み | セキュリティ |
|-----------|--------|--------|------------|
| 宣言的 | A2UI, Flutter GenUI | JSONでUIコンポーネントを記述 | 信頼済みカタログのみ |
| コード実行型 | Artifacts, Canvas | HTML/CSS/JSを生成して実行 | サンドボックス分離 |
| ストリーミングUI型 | Vercel AI SDK | React Server Componentsをストリーミング | フレームワーク依存 |
| テンプレート型 | Adaptive Cards | 事前定義テンプレートにデータバインド | 最も制限的 |

A2UIは[v0.8がStable、v1.0を2026年Q4に予定](https://a2ui.org/)していて、AG-UIは[CopilotKit v1.50](https://www.copilotkit.ai/blog/copilotkit-v1-50-release-announcement-whats-new-for-agentic-ui-builders)でスレッド永続化やマルチエージェント調整が入っています。AWSやOracleも[AG-UIへの対応を発表](https://aws.amazon.com/about-aws/whats-new/2026/03/amazon-bedrock-agentcore-runtime-ag-ui-protocol/)していて、このあたりは急速に動いている領域です。

ただ、自分がほしかったのはもっとシンプルなものでした。既存のAgent SkillにReactアプリを同梱して、AgentがSSEで表示指示を出すだけ。
これはCoding Agentがもっと多くの人に使う過程でも必要な進化に思えます。Claude Coworkとかはこうなっていくのかな〜みたいな気持ちがあります。

## 実装してみた

ということでAgent Skillにローカルで動くWebアプリケーションを同梱するパターンで作ってみました。
(リポジトリは後日公開できたらします…個人的に作っているClaude Agent SDK/Codex App ServerのWrapper SDKが、安定したら…)

Agent Skillについては[以前の記事](https://nyosegawa.com/posts/skill-creator-and-orchestration-skill/)で詳しく書いているので、ここでは省略します。

なお、これはあくまで実験なので、ふつうに作るAgent Skillにこうしたアプリケーションを組み込むのはあまり推奨されません (というか動きません)。
Coding Agentと疎通し、かつリクエストに応じてViewを表示するための仕組みが外側にないと駄目で、そうしたものがない状態では上記記事のskill-creatorやagentic-benchのようにHTMLビューワを立ち上げてあげるくらいが無難なプレゼンテーション層の作り方かなと思います。

### アーキテクチャ

全体の流れはシンプルです。

```
Coding Agent → curl POST /api/app → API Server (SSE) → Frontend (React)
                 { appId, data }       port 5191          port 5190
```

本当に雑に作っていて、Agentがワークフローの中でcurlコマンドを叩いてアプリの表示を指示し、API ServerがSSEでフロントエンドにブロードキャストし、フロントエンドが該当するReactコンポーネントを右パネルにスライドイン表示します。

### self-containedなスキルパッケージ

各スキルはこういう構造で自己完結しています。

```
skills/<skill-name>/
├── SKILL.md          # Agent Skill定義 + アプリメタデータ
├── apps/<app>/       # Reactコンポーネント、hooks、型
├── data/             # 永続化JSON（実行時自動生成）
└── references/       # 補助ドキュメント
```

SKILL.mdのfrontmatterにアプリ情報を載せます。

```yaml
---
name: recipe-skill
description: >
  レシピの検索・追加・編集・削除を行うレシピ管理スキル。
  ユーザーが「レシピを探して」「今日の献立」「料理を追加」
  「材料から検索」「レシピ管理」と言ったときに使用する。
  apps/recipe-manager/ に埋め込みWebアプリを同梱。
metadata:
  has-app: true
  app-id: recipe-manager
  app-name: レシピ管理
  app-icon: "🍳"
  app-entry: apps/recipe-manager/RecipeApp.tsx
---
```

### 自動発見の仕組み

新しいスキルを追加したとき、ホスト側のコードを一切変更する必要がありません。Viteの`import.meta.glob`で自動発見しています。

```typescript
// src/skill-registry.ts
// メタデータ: eager（同期、ヘッダーボタン用）
const metaModules = import.meta.glob<{ meta: SkillAppMeta }>(
  "../skills/*/apps/*/meta.ts",
  { eager: true },
);

// コンポーネント: lazy（コードスプリット）
const componentModules = import.meta.glob<{
  default: ComponentType<SkillAppProps>;
}>("../skills/*/apps/*/*App.tsx");
```

`skills/`配下にフォルダを追加してmeta.tsとApp.tsxを置けば、それだけで認識されます。プラグインアーキテクチャとしてうまく機能しています。

![App Directory](/img/skill-with-app/app-directory.png)

![Chat + AppPanel](/img/skill-with-app/chat-with-recipe.png)

### 現在のスキル

実験として13個ほどのスキルを作ってみました。並列でやったので10分でできました。すごい時代です。作り込めてはもちろんいません。

| スキル | 用途 |
|--------|------|
| recipe-skill | レシピ管理（検索、追加、食材マッチ、調理モード） |
| expense-skill | 経費管理（レシートOCR、写真保存、ダッシュボード） |
| weather-skill | 天気表示（Agentが取得したリアルデータ表示） |
| crm-skill | 顧客管理、商談パイプライン |
| ats-skill | 採用管理、候補者パイプライン |
| project-skill | プロジェクト管理、タスク管理 |
| accounting-skill | 会計、仕訳管理 |
| invoice-skill | 請求書、見積書管理 |
| competitor-skill | 競合分析、ポジショニングマップ |
| seo-skill | SEO分析、キーワード調査 |
| sns-skill | SNS運用、投稿管理 |
| lp-skill | LP作成、ABテスト |
| contract-skill | 契約書管理、リスク分析 |

## Agent-App共生モデル

さて、これらのスキルを実装は以下のような分離の哲学に基づいています。

| 責務 | Agent | App |
|------|-------|-----|
| データ取得・加工 | Web検索、API呼び出し、ファイルI/O、推論 | しない |
| インサイト生成 | 推奨、分析、スコアリング | しない |
| 見せる | しない | 一覧、グラフ、ダッシュボード |
| 操作させる | しない | 承認/却下、編集/削除、フィルタ |

たとえばレシピスキルだと、Agentがweb検索でレシピを見つけてきて、材料や手順をRecipeDraft形式に構造化して、`POST /api/app`でアプリに送信します。Appは発見カードをきれいに表示して「保存する」ボタンを出す。人間はそれを見て判断する。

経費管理だとAgentがレシートの画像を読み取ってOCR処理し、金額や日付を抽出してAppに渡す。天気だとAgentがデータを取得して服装アドバイスや傘の必要性を判断し、Appがダッシュボードとして表示します。

![経費管理ダッシュボード](/img/skill-with-app/expense-tracker.png)

![天気ダッシュボード](/img/skill-with-app/weather-dashboard.png)

## Skill Appsのうれしみと限界

### うれしいところ

いくつかうれしい点があります。

まず、ポータビリティがあること。スキルフォルダをコピーするだけで別の環境に持っていけます。gitリポジトリとして管理すれば、共有も簡単です。

次に、使い捨てにならないこと。Claude ArtifactsやChatGPT Canvasで作ったものは、そのセッションの中では便利ですが、後から再利用しにくいです。Skill Appsはファイルシステム上に永続的に存在するので、何度でも使えます。

ホスティングが不要なのもいいです。ローカルで完結します。

また、Coding Agentに「このCRMのパイプラインのステージを変えて」と言えばすぐに変更できます。コードが手元にあるので、何でもできます。

| 観点 | Skill Apps | クラウドSaaS | Artifacts/Canvas |
|------|-----------|-------------|-----------------|
| ホスティング | ローカル | クラウド | プラットフォーマー |
| ポータビリティ | フォルダコピー | アカウント依存 | プラットフォーム依存 |
| カスタマイズ | コード直接編集 | 設定画面 | プロンプト再生成 |
| 永続化 | JSONファイル | DB保証 | プラットフォーマー管理 |
| マルチデバイス | なし | あり | あり |

![CRM パイプライン](/img/skill-with-app/crm-pipeline.png)

![ATS 候補者管理](/img/skill-with-app/ats-manager.png)

### 限界

一方で、限界もたくさんあります。

- 永続化の保証がない。JSONファイルベースなので、バックアップもユーザー任せです
- マルチデバイス同期がない。スマホからは使えません
- チームユースしたいものもチームとデータ共有しづらいです
- 雑に作るとオフラインの体験が貧弱です
- テストやCI/CDの仕組みがまだない
- ユーザーが非エンジニアだとカスタマイズのハードルがやっぱり高い

ただ、こうした限界をサポートするサービスや仕組みも出てくるんじゃないかと思います。永続化をマネージドで提供したり、スキルのテスト基盤を整えたり、非エンジニア向けのカスタマイズUIを提供したり。このあたりはビジネスチャンスでもありそうです。

既存のSaaS企業が自社サービスのAgent内App版を提供する流れもあり得ると思います。たとえばCRM企業がSkill App版を出せば、ユーザーはAgent上で自然にCRMを使えるし、企業側はバックエンドAPI・永続化・コンプライアンスを担保できます。WebアプリとAgent内Appが共存する世界です。

## アプリケーションを作ることのつらみ

誰でもアプリケーションが作れるといっても、法的なつらみは消えません。

たとえば経費管理アプリを作ったとして、電子帳簿保存法に準拠しているかという問題があります。JSONファイルで経費データを保存しているだけでは、法的な要件（タイムスタンプ、検索要件、改ざん防止）を満たすのは難しいです。

CRMやATSで顧客情報や候補者情報を扱うなら個人情報保護法が関わりますし、会計スキルは金融関連法規に注意が必要です。

こうした問題を考えると、本当につらいです。みんな頑張っていきましょう。

## マーケットとセキュリティ

スキルを公共財として流通させるなら、マーケットとセキュリティの仕組みが必要です。

ここで現実の問題があります。Snykが2026年2月に発表した[ToxicSkills](https://snyk.io/blog/toxicskills-malicious-ai-agent-skills-clawhub/)研究では、ClawHub上の無料スキルの約36%に何らかのセキュリティ問題が見つかりました。悪意あるスキルが6日間で約3,900回実行された事例も報告されています。

学術研究でも、[98,380個のスキルを分析して157個の悪意あるスキルを特定した](https://arxiv.org/abs/2602.06547)論文が出ています。データ流出、特権昇格、プロンプトインジェクションなど、攻撃パターンは多様です。

セキュアなマーケットをどう作るかは重要な問いだと思います。いくつか方向性を考えています。

一つは信頼済みコンポーネントのカタログ型です。A2UIが採用しているアプローチで、エージェントが使えるUIコンポーネントを事前に検証されたカタログに限定します。表現力は制限されますが、セキュリティは高いです。

もう一つはnpmやHomebrewのようなパッケージマネージャー型です。コードの署名、レビュープロセス、スキャンの自動化を組み合わせる。完全ではないですが、エコシステムとして回る仕組みです。

[AAIF（Agentic AI Foundation）](https://aaif.io/)がLinux Foundation傘下で設立されて、Anthropic、OpenAI、Block、AWS、Microsoft、Google等が参加しています。2026年2月には[97の新メンバーが加入](https://www.linuxfoundation.org/press/agentic-ai-foundation-welcomes-97-new-members)して146組織に拡大しました。MCPやA2Aといったプロトコルの標準化を通じて、エコシステム全体のセキュリティ基盤を整える方向に進んでいます。

こうした標準化の動きとコミュニティの成熟が、安全なスキルマーケットの基盤になっていくんじゃないかと思います。

## その先の体験について

最後に、もう少し先の未来について考えてみます。

いま整備されつつあるプロトコルスタック（MCP、A2A、AG-UI/A2UI、WebMCP）が成熟した先にはどんな体験があるでしょうか。

A2UIでAgentがその人に最適なUIを都度生成するような体験はすでに見えつつあります。いまskill-with-appで手動で作っているスキルアプリが、将来は文脈に応じてAgentが動的に生成するようになるかもしれません。

さらに先には、AR/VR空間でAgentがUIを配置するような世界もあるかもしれません。MetaがHorizon OS向けに[MCPサーバーを公開](https://developers.meta.com/horizon/documentation/unity/ts-mqdh-mcp/)していたり、DeepMindの[Genie 3](https://deepmind.google/blog/genie-3-a-new-frontier-for-world-models/)がテキストからリアルタイムで3D世界を生成したり。Metaの[V-JEPA 2](https://ai.meta.com/research/vjepa/)はワールドモデルとして動画から学習して未知環境でのロボット制御を実現しています。リアルタイム動画生成のようなアプローチも将来的にはあるかもしれません。

個人的にはAIアシスタントの層が一番上にあって、その下にアプリケーション群が並ぶ。そして発話、生体リズム、時間、などの任意のタイミングでAssistantがAgentを介して適切なアプリを呼び出してくれるみたいな世界ができたらいいなあと思っています。そういうものを作りたいのです。

## まとめ

- Agentがプラットフォームとなりアプリが組み込まれるパラダイムは、Coding Agentの日常利用から自然に生まれた発想で、実装してみると意外と実用的でした
- skill-with-appは「SKILL.md + apps/ + data/」のself-containedパッケージで、ホスト側のコード変更なしにスキルを追加でき、ポータビリティと再利用性を両立しています
- 永続化・法規制・セキュリティという現実的な課題はありますが、プロトコルの標準化やエコシステムの整備が進んでいて、SaaS企業によるAgent内App提供なども含めて、この方向の体験は広がっていきそうです

## Appendix

## 改めて、今回の仕組みについて (2026/03/29追記)

今回の記事はちょっと暗黙的な前提を多く置き、着想の仮定も結構すっ飛ばして書いています。そのせいでめちゃくちゃ分かりづらいものになっていました。
かんたんにモチベーション、やったことを箇条書きでまとめます。

- 今回作ったものは何か？
    - Skillにアプリケーションを同梱するような仕組みです
    - 具体的にはReactコンポーネントの形状で梱包します
    - Coding AgentをWrapするGUIアプリケーション、Coding Agent、Skill Appという3者がいて、GUIアプリケーションのほうはCodex App ServerのWrapperとして実装されています
    - 作ったSkillは `.codex/skills` にシンボリックリンクしています
    - 「契約一覧を教えて」と言うと、Agent Skillがloadされ、ワークフローが進み、契約一覧のビューを出すためのコンポーネントとデータをWrapper GUIにcurlで渡します
        - Wrapper GUIのほうはSkillのもつアプリケーションを知らなくて良いです。叩かれたときにビューを表示するAPIだけ生えているのです
- 今回のSkill Appというアプローチは複数の課題感から生まれました
    - Agentとアプリケーションの距離が遠い
        - Coding Agentを中心に腰を据えたとき、アプリケーションは様々な意味で遠いです
        - 体験的に遠く、物理的にも遠いのです。Localのアプリケーションでも距離を感じます
        - わざわざアプリケーションを立ち上げたりしたくないです。Coding Agentを裏側で動かす汎用アプリケーションだけ見ていれば良い、という体験がしたかったのです
    - Agentとアプリケーションを近くしすぎても難しい
        - たとえば出力物の形状によってビューを出し分けるみたいなアイデアももちろんあります
            - Manus等がしているのがそれで、スライドであったらこのビュー、スプレッドシートならこのビューというようにできます
            - 出力物の形状でのルーティングなのでもちろん限界があります
        - あるいはユーザーのリクエストごとにサブアプリケーションで可能な限りの対応をするアイデアもあります
            - 私が以前作っていたものがこれです
            - AI AgentがContextとして様々なアプリケーションを理解していて、ユーザーの意図に応じてアプリケーション層にリクエストを発行するようなものです
            - たとえば天気なら天気アプリケーションでうまく表示というような
            - こちらもどこでルーティングするべきかとAgentとの連動性や拡張の難しさが課題としてありました
        - それゆえ、もっと拡張性の高い仕組みが必要に感じました
    - アプリケーションを個人で大量に作る時代だけど作ったあとに使うのが大変な時代でもある
        - 大量に作ってもいいのですが、使うのがだるいです。いちいち立ち上げるのも面倒です。自分のためのアプリケーションなのに、使わなくなってしまうのは悲しいことです
        - 生産がスローな時代は終わり、消費のスローさが課題になる時代です
        - 大量生産は認知的な問題を引き起こしていて、どのリポジトリで何を作っていたか、ということまでわたしはよく忘れます
        - こういう事情からもっと自分がよく体験する場所の近くに置きたいというモチベーションはやはり現れてきます
    - 次の時代の体験を考えたかった
        - 未来を考えるとユーザーごとに十人十色なUIが提供されると嬉しいです
        - しかし、ユーザーごとに毎回生成するのは現段階ではコストが高く、A2UI的なJSONアプローチの場合はカスタマイズ性に多少難があります
        - それと、全く完全にゼロから毎回作られるのはちょっと違和感があって、テンプレート的なものはあってもよいと考えました
    - 単純にhtmlを同梱したり、フルパッケージのアプリケーションを入れるのもなんか体験が違う感触がある
        - skill-creatorやわたしの作ったagentic-bench等がまさにそうですが、Agent Skillを使った際の作業の結果や中間結果の確認時点でhtmlを立ち上げるアイデアはよくあります
            - ただこれだとただのビューワー止まりです
        - フルパッケージのアプリケーションを入れる場合、これは結構面白くて既存のCoding Agentにそのまま活用できます
            - ただ今回は別のアプローチを取ることにしました
- これらのモチベーションから作ったものを解き直す
    - Skill AppはAgent Skillに同梱されているので近いですが、近すぎません
    - Coding AgentをWrapしたGUIをユーザーの中心座標と捉えるのであれば、そこからすべての操作ができます
        - Agentとチャットしながら操作したり、UIを変えたり、Coding Agentに調査させてデータを更新したりもできます
        - そのGUIアプリケーションにアプリケーションを起動するボタンも用意すれば、アプリケーションだけでも使えます
        - 天気を知りたいとき、二通りが選べるのです。天気を教えてと言う (入力する) か、サイドバーから天気アプリを選ぶか
    - 改変も用意です。こういうふうに表示したいと言うだけです
- 今回作ったものの弱点
    - 今回作ったものは大量の弱点を保有します。アプリケーションは壊れやすく、まだまだ未洗練なアイデアです。MCP Apps等のほうがより洗練されています
- 改めて注意
    - 今回の仕組みはCodex App ServerやClaude Agent SDK, あるいは任意のAgentを裏側で動かし、フロントに表示するアプリケーションを準備しておく必要があります
    - いわゆるオレオレSkillみたいなものをあんまり作るべきとは思いません。仕様を勝手拡張していった先は悲しみに溢れます。今回のは未来を考えるための実験と位置づけています

## References

- Product
  - [Introducing Apps in ChatGPT](https://openai.com/ja-JP/index/introducing-apps-in-chatgpt/)
  - [MCP Apps - Model Context Protocol Blog](https://blog.modelcontextprotocol.io/posts/2026-01-26-mcp-apps/)
  - [CopilotKit v1.50](https://www.copilotkit.ai/blog/copilotkit-v1-50-release-announcement-whats-new-for-agentic-ui-builders)
  - [Vercel AI SDK 6](https://vercel.com/blog/ai-sdk-6)
- Protocol
  - [A2UI](https://a2ui.org/)
  - [AG-UI Protocol](https://github.com/ag-ui-protocol/ag-ui)
  - [WebMCP](https://webmcp.link/)
  - [AAIF](https://aaif.io/)
  - [AAIF 97 New Members](https://www.linuxfoundation.org/press/agentic-ai-foundation-welcomes-97-new-members)
  - [AWS Bedrock AgentCore AG-UI対応](https://aws.amazon.com/about-aws/whats-new/2026/03/amazon-bedrock-agentcore-runtime-ag-ui-protocol/)
- Security
  - [ToxicSkills - Snyk](https://snyk.io/blog/toxicskills-malicious-ai-agent-skills-clawhub/)
  - [Malicious Agent Skills in the Wild](https://arxiv.org/abs/2602.06547)
- Future
  - [Meta Horizon OS MCP Server](https://developers.meta.com/horizon/documentation/unity/ts-mqdh-mcp/)
  - [Genie 3 - Google DeepMind](https://deepmind.google/blog/genie-3-a-new-frontier-for-world-models/)
  - [V-JEPA 2 - Meta AI](https://ai.meta.com/research/vjepa/)
  - [Sora Shutdown - TechCrunch](https://techcrunch.com/2026/03/24/openais-sora-was-the-creepiest-app-on-your-phone-now-its-shutting-down/)
  - [Generative Augmented Reality](https://arxiv.org/abs/2511.16783)
- Implementation
  - [Agent Skill解説記事](https://nyosegawa.com/posts/skill-creator-and-orchestration-skill/)
