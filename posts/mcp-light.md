---
title: "MCPをAgent Skillsのように軽量化する新手法、MCP Lightの紹介"
description: "MCPのdescriptionフィールドがコンテキストを圧迫する問題に対し、descriptionを1行に圧縮してベストプラクティスをAgent Skillに外出しする「MCP Light」アプローチを提案・実装・検証します。"
date: 2026-02-13
tags: [MCP, Agent Skills, Context Engineering, FastMCP]
author: 逆瀬川ちゃん
---

こんにちは！逆瀬川ちゃん ([@gyakuse](https://x.com/gyakuse)) です！

今日はMCP（Model Context Protocol）の「太さ」問題と、それをAgent Skillを使って解決する「MCP Light」というアプローチについてまとめていきたいと思います。

<!--more-->

## MCPの役割はConnector

MCP（Model Context Protocol）の役割が明確になってきました。「AIアプリケーションのUSB-C」という比喩が示す通り、MCPはConnector — AIモデルと外部ツール・データを繋ぐ標準プロトコルです。

[月間9,700万以上のSDKダウンロード](http://blog.modelcontextprotocol.io/posts/2025-12-09-mcp-joins-agentic-ai-foundation/)、10,000以上のパブリックサーバー。OpenAI・Google・Microsoftも採用し、事実上の業界標準になりました。Notion、GitHub、Slack、Salesforce…あらゆるSaaSがMCPサーバーを公開し、AIエージェントから使えるようになっています。

ただ、Connectorとしての成功が新たな問題を生んでいます。

MCPは太いです。

接続するだけでコンテキストウィンドウが埋まります。ツール定義だけで数万トークンを食い、モデルが本来の仕事に使えるコンテキストが圧迫されます。68ツールのMCPサーバーを接続しただけで「Hello」すら入力できなくなったという[報告](https://medium.com/@pekastel/mcp-and-context-windows-lessons-learned-during-development-590e0b047916)があります（Pablo Castillo, 2025）。Claude Codeユーザーの間では「起動時に半分のコンテキストが消えていた」という[体験談](https://waleedk.medium.com/the-evolution-of-ai-tool-use-mcp-went-sideways-8ef4b1268126)が共有されています（Waleed Kadous, 2025）。

## なぜ太いのか：descriptionフィールドの構造的問題

さて、この「太さ」がどこから来ているのかを見ていきましょう。MCPをクライアントに接続すると、`list_tools()` が返す全ツール定義がコンテキストに載ります。問題の核心は `description` フィールドです。

```json
{
  "name": "notion-create-pages",
  "description": "Creates one or more Notion pages, with the specified
    properties and content. All pages created with a single call to this
    tool will have the same parent. The parent can be a Notion page
    (\"page_id\") or data source (\"data_source_id\"). If the parent is
    omitted, the pages are created as standalone...
    Date properties: Split into \"date:{property}:start\"...
    Checkbox properties: Use \"__YES__\" / \"__NO__\"...",
  "inputSchema": { "..." }
}
```

ここに2種類の情報が混在しています。

判断用情報 — 「Notionにページを作成する」。ツールを使うかどうかの判断に必要な情報で、1行で済みます。

実行時ベストプラクティス — 「data_source_idを使え」「先にfetchしろ」「日付はこの形式で」。実際にそのツールを使う瞬間まで不要な情報です。

前者は数トークン。後者が数百トークン。Notionサーバーだけで13ツール以上あり、複数サーバーを接続すれば数万トークンがツール定義だけで消えます。ユーザーの最初のメッセージを読む前に、です。

MCPのコンテキスト消費には3段階あります。

- 第1段階：ツール定義の太さ — 接続しただけで発生する構造的問題
- 第2段階：ツール結果の蓄積 — ツールを使うたびにレスポンスが蓄積される
- 第3段階：会話全体の肥大化 — 長時間セッションでの複合的蓄積

本稿は第1段階に焦点を当てます。第2・第3段階は使い方に依存しますが、第1段階は接続しただけで必ず発生するからです。

## 既存の改善：遅延注入の仕組み

### Tool Search（Claude Code）

ここで現時点の改善策を見ていきましょう。Claude Codeは、MCPツール定義がコンテキストウィンドウの10%以上を消費すると自動的にTool Searchを有効化します。全ツールを事前ロードせず、必要なツールだけをオンデマンドで発見・ロードする仕組みです。

100ツール全ロード → 必要な3ツールだけロード。大幅な改善ですが、ロードされた3ツールのdescriptionは全文そのまま入ります。ツール数は絞れますが、個々の太さは変わりません。

### PTC / Compaction

PTC（Programmatic Tool Calling）は第2段階、Compaction（会話要約）は第3段階への対策です。いずれも第1段階のツール定義の太さには効きません。

### 穴がある

| 対策 | 第1段階（定義の太さ） | 第2段階（結果の蓄積） | 第3段階（会話の肥大化） |
| --- | --- | --- | --- |
| Tool Search | △ ツール数は絞れるが1つ1つが太いまま | - | - |
| PTC | - | ◎ | △ |
| Compaction | - | △ | ◎ |

第1段階に直接効く手段がありません。

## さまざまな改善案

この問題に対して、業界全体でさまざまなアプローチが提案・実装されています。

### メタツールパターン：discover → execute

最も多いのが、既存MCPサーバーの前段に「発見層」を入れるアプローチです。

[Klavis Strata](https://www.klavis.ai/)（[YC X25](https://news.ycombinator.com/item?id=45347914)）は最も成熟した実装で、`discover_server_categories` → `get_category_actions` → `get_action_details` → `execute_action` の4段階でツールを段階的に開示します。公式Notion MCPサーバーより+13.4% pass@1向上を主張しています。

[meta-mcp-proxy](https://github.com/nullplatform/meta-mcp-proxy)（nullplatform）は `discover()` と `execute()` の2ツールに全MCPサーバーを圧縮し、ローカルインメモリインデックスで30エンドポイント → 2ツールに削減します。

[lazy-mcp](https://github.com/voicetreelab/lazy-mcp)（voicetreelab）も同様の階層的発見パターンを実装しています。

効果は高いですが、共通の代償があります。元のMCPサーバーとインターフェースが変わります。`notion.create_page` ではなく `execute_tool("notion.create_page", {...})` のような間接実行になり、discover → select → hydrate → execute で3-4ラウンドトリップが必要になります。

### プロトコル変更提案

[SEP-1576](https://github.com/modelcontextprotocol/modelcontextprotocol/issues/1576)（Huawei）はJSON `$ref` によるスキーマ重複排除とembedding類似度マッチングを提案しています。GitHub MCPサーバーの60%のフィールドが重複であると分析しています。

[Issue #1978](https://github.com/modelcontextprotocol/modelcontextprotocol/issues/1978)は `tools/list` への `minimal` フラグ追加と新メソッド `tools/get_schema` によるオンデマンド取得を提案し、91%トークン削減を試算しています。

[Discussion #532](https://github.com/orgs/modelcontextprotocol/discussions/532)は階層的ツール管理（`tools/categories` + `tools/discover`）を提案しています。

いずれも正しい方向ですが、MCP仕様にはまだ入っていません。

### 最も近い先行事例：MCP Progressive Disclosure（ハッカソン実装）

MCP 1st Birthdayハッカソン（Anthropic + Gradio主催）で、Michael Martin（@AppRushAI）が[mcp-extension-progressive-disclosure](https://huggingface.co/spaces/MCP-1st-Birthday/mcp-extension-progressive-disclosure/)を発表しました。本稿の提案に最も近い先行事例なので詳しく見ていきます。

問題の見立ては同じです。「descriptionに判断用と実行用が混在しているから分離しよう」。解決も2段階の遅延ロードで、Stage 1では `tools/list` が1行descriptionと空のinputSchemaを返します。

```json
{
  "name": "aws_ec2_launch_instance",
  "description": "Launches a new AWS EC2 instance with specified configuration.",
  "inputSchema": {"type": "object", "properties": {}}
}
```

エージェントがツールを使いたくなったら、Stage 2でMCPリソースエンドポイントから詳細を取得します。

```
resource:///tool_descriptions?tools=aws_ec2_launch_instance
→ 完全なスキーマ、使い方、エラーハンドリングが返る
→ 取得したツールは「セッション認可済み」としてマーク
```

96%削減を主張しており効果は大きいですが、動作させるにはエージェントのシステムプロンプトに「ツールを使う前に必ずresourceから詳細を取得しろ」と明示する必要があります。

つまりこのアプローチはエージェント側に新しい行動パターンを教える必要があります。もう一つ大きな違いはinputSchemaの扱いです。ハッカソン版はスキーマも空にして後から取得するため削減率は高いですが、ツールを呼ぶ前に必ずresource取得ステップが挟まります。

分離した情報の置き場が、このアプローチの分岐点になります。ハッカソン版はMCPリソースに置きました。本稿のMCP Lightは、後述するようにAgent Skillに置きます。

### 共通の課題

これらのアプローチの多くは、新しいワークフローの学習やクライアント側の変更を要求します。メタツールパターンはエージェントに「まずdiscoverしろ」という新しい行動規範を覚えさせる必要があります。ハッカソン版は「使う前にresourceを取れ」とシステムプロンプトで強制する必要があります。プロトコル変更は仕様策定と全クライアントの対応を待つ必要があります。

## MCP Light：仕様に触らず、ドロップインで解決する

### 発想

さて、これらのアプローチを踏まえた上でこう考えました。

元のMCPサーバーと同じインターフェースの「軽量版」を別パッケージとして公開し、descriptionから外したベストプラクティスはAgent Skillとして同梱すればいいのでは？

既存のMCP仕様もクライアントも変えません。メタツールのような新しいワークフローも強制しません。ツール名もinputSchemaもそのまま。descriptionだけ1行に圧縮した「同じMCPサーバーのLight版」を作って公開します。ベストプラクティスはSkillに外出しして同梱します。

### 2つのパーツ

MCP Lightは2つのパーツからなります。

① Light版MCPサーバー — 元サーバーの全機能をそのまま使えます。違いは `list_tools()` が返す `description` が1行に圧縮されていることです。

② ベストプラクティスSkill — 元のdescriptionから取り除いたベストプラクティスをSkill（SKILL.md）として同梱します。

```
notion-light/
├── mcp/                              # Light版MCPサーバー
│   ├── server.py                     # FastMCPで元サーバーをラップ
│   └── pyproject.toml
│
└── skill/
    └── notion-best-practices/        # ベストプラクティスSkill
        └── SKILL.md                  # ツール別の使い方ガイド
```

### なぜこの組み合わせが効くのか

Light版のdescriptionにはこう書いてあります。

```
Create Notion pages in a database or standalone.
See notion-best-practices skill for usage details.
```

Claudeがこのツールを使おうとした瞬間、[Skillシステム](https://platform.claude.com/docs/en/agents-and-tools/agent-skills/overview)が自動的にSKILL.mdを読みに行きます。Skillの仕組みを思い出してください — Skillのメタデータ（name, description）は常時コンテキストにありますが、SKILL.md本体はSkillが発火した時点で初めて読み込まれます。

つまりSkillそのものが「判断用情報は常時、実行用情報は必要時のみ」というProgressive Disclosureを既に持っています。MCP Lightはこれをそのまま借りるだけです。ガイドの遅延ロード機構を自前で作る必要がありません。

```
常時コンテキストに存在するもの:
  - Light版description（1行）    ← ツール選択の判断用
  - Skillメタデータ               ← Skill発火判定用

ツール使用決定時にロードされるもの:
  - SKILL.md本体                  ← ベストプラクティス全文
```

### 先行事例との差分

| 観点 | メタツールパターン | ハッカソン版 | プロトコル変更案 | MCP Light |
| --- | --- | --- | --- | --- |
| クライアント変更 | 不要だがワークフロー変更が必要 | MCPリソース対応 + システムプロンプト変更 | 仕様策定 + 全クライアント対応待ち | ゼロ |
| ツール呼び出し | `execute_tool("name", {...})` | 直接呼べるが事前にresource取得必須 | 仕様次第 | 元サーバーと同じ |
| inputSchema | そのまま | 空にして後から取得 | 仕様次第 | そのまま |
| ラウンドトリップ | 3-4回 | 2回（resource取得→実行） | 仕様次第 | 直接call |
| ベストプラクティスの置き場 | メタツール内 | MCPリソースエンドポイント | `tools/get_schema`等 | Agent Skill |
| エージェントへの指示 | 「discoverしろ」 | 「使う前にresource取れ」 | 仕様次第 | 不要（Skill自動発火） |
| 配布 | プラットフォーム依存が多い | サーバー自体を改修 | N/A | npm/PyPIパッケージ |
| forkability | 困難 | サーバー改修が必要 | N/A | Markdownをforkするだけ |
| 移行コスト | ワークフロー学習が必要 | システムプロンプト変更が必要 | 仕様待ち | 元サーバーと差し替えるだけ |

### Light版MCPサーバーの中身

[FastMCP](https://github.com/jlowin/fastmcp)を使えばコアは数十行です。

```python
from fastmcp import FastMCP
from fastmcp.server.proxy import ProxyClient

LIGHT_DESCRIPTIONS = {
    "notion-search": (
        "Search Notion workspace and connected sources by semantic query. "
        "See notion-best-practices skill for usage details."
    ),
    "notion-fetch": (
        "Retrieve a Notion page or database by URL or ID. "
        "See notion-best-practices skill for usage details."
    ),
    "notion-create-pages": (
        "Create one or more Notion pages in a database or standalone. "
        "See notion-best-practices skill for usage details."
    ),
    # ...全13ツール分
}

proxy_client = ProxyClient("npx @notionhq/notion-mcp-server")
server = FastMCP.as_proxy(proxy_client, name="notion-light")

for tool in server.list_tools():
    if tool.name in LIGHT_DESCRIPTIONS:
        tool.description = LIGHT_DESCRIPTIONS[tool.name]
```

FastMCPの `as_proxy` で元サーバーを丸ごとラップして、`description` だけ差し替えます。inputSchemaもツールの実行ロジックも元サーバーそのまま。利用者から見れば独立パッケージです。

```bash
# Light版MCPサーバーをインストール
claude mcp add notion-light -- npx notion-light-mcp

# ベストプラクティスSkillは同梱
```

### 圧縮プロセス：LLMが考える

descriptionの圧縮はLLM（Claude）がやります。ヒューリスティックなスクリプトではありません。「判断用情報」と「実行時ベストプラクティス」の分離は意味の理解を要する作業だからです。

この圧縮プロセス自体もSkill（mcp-light-generator）として定義しています。

```
mcp-light-generator/
├── SKILL.md              # 分離ルールとワークフロー
└── references/
    └── fastmcp-proxy-pattern.md  # FastMCPプロキシの実装パターン
```

「Notion MCPのLight版を作って」と言うと、Claudeが全ツールのdescriptionを分析し、Light版MCPサーバーとベストプラクティスSkillの両方を生成します。

## 実際にやってみた：Notion MCPサーバー（13ツール）

ここからは実際にNotion公式MCPサーバーの全13ツールに対してMCP Lightを適用した結果を見ていきます。

### 圧縮の具体例

Before（元のdescription、常時ロード）:

> Creates one or more Notion pages, with the specified properties and content. All pages created with a single call to this tool will have the same parent. The parent can be a Notion page ("page_id") or data source ("data_source_id"). If the parent is omitted, the pages are created as standalone, workspace-level private pages. If you have a database URL, ALWAYS pass it to the "fetch" tool first...（以下数十行）

After（Light版のdescription、常時ロード）:

> Create one or more Notion pages in a database or standalone. See notion-best-practices skill for usage details.

ベストプラクティスSkill（ツール使用時に自動ロード）:

```markdown
## notion-create-pages

1回の呼び出しで1つ以上のページを作成する。

### Parent の選び方
1. **page_id**: 通常のページの下に作成
2. **data_source_id**: データソース（コレクション）の下に作成（推奨）
3. **database_id**: 単一データソースのデータベースでのみ使用可
4. **省略**: ワークスペースレベルのプライベートページとして作成

### ベストプラクティス
- database URL がある場合、必ず先に `fetch` してスキーマとデータソース URL を取得する
- 複数データソースのデータベースでは `database_id` は使えない — `data_source_id` を使う
...
```

情報は捨てていません。「いつロードするか」を変えただけです。

### tiktoken精密計測

元サーバーとLight版の両方をFastMCPのスタンドアロンサーバーとして起動し、`tools/list` レスポンスをtiktoken（cl100k_base）で計測しました。

| 指標 | Original | Light | 削減率 |
| --- | --- | --- | --- |
| description合計 | 1,725 tokens | 285 tokens | 83.5% |
| inputSchema合計 | 不変 | 不変 | - |
| ツール定義全体 | 3,410 tokens | 1,908 tokens | 44.0% |
| JSON bytes | 18,367 bytes | 11,565 bytes | 37.0% |

descriptionだけ見れば83.5%の削減です。inputSchemaは手を付けないのでそこは変わりません。ツール定義全体で見ると44.0%の削減になります。1セッションあたり1,502トークンの節約です。

ポイントは、inputSchemaを残しているのが意図的な設計だということです。ハッカソン版のようにスキーマも空にすれば削減率はもっと上がりますが、その代わりツール呼び出し前に毎回resource取得のラウンドトリップが入ります。MCP Lightはdescriptionだけを圧縮し、inputSchemaはそのまま残すことで「即座にツールを呼べる」という体験を維持しています。

## 効果検証：opencode実測

tiktoken計測は理論値です。実際のCoding Agentでどうなるかを確認するため、OSSのCoding Agent [opencode](https://github.com/nicholasgriffintn/opencode)を使って実測しました。opencode はTool Searchのような遅延ロード機能を持たないため、接続した全ツールのdescriptionがそのままコンテキストに載ります。MCP Lightの効果を直接測るのに最適な環境です。

### 検証環境

同一の13ツール（Notion MCP）を、元サーバー版とLight版のそれぞれでopencode に接続します。同じプロンプト（「こんにちは」）を送信し、最初のレスポンス時点でのコンテキスト消費量を比較しました。

### 結果

| 指標 | Original | Light | 差分 |
| --- | --- | --- | --- |
| Context tokens | 16,796 | 15,410 | -1,386 tokens |

opencode環境では1,386トークンの削減が確認できました。tiktokenの理論値（1,502トークン削減）と概ね一致しています。差分はopencode側のプロンプトテンプレートやトークナイザーの違いによるものでしょう。

この1,386トークンという数字は、Notion MCPサーバー1つだけでの結果です。複数のMCPサーバーを接続する実運用環境では、削減量は線形に増加します。

## Tool Searchとの相乗効果

さて、このopencode実測で見たのは「Tool Searchなし」の環境でした。Claude Codeのように Tool Searchがある環境ではどうなるでしょうか。

MCP LightとTool Searchは補完関係にあります。Tool Searchが「どのツールをロードするか」を絞り、MCP Lightが「ロードされるツール定義自体」を薄くします。

さらにSkillが加わることで、段階的開示が三段階になります。

```
第1段階（常時）:  Skillメタデータ + Light版description × 全ツール
  ↓ Tool Searchが必要なツールを絞り込み
第2段階（選択時）: 使うツールのLight版descriptionが入る（まだ1行）
  ↓ ツールを実際に使う判断
第3段階（使用時）: Skillが発火、SKILL.mdのベストプラクティスがロード
```

各段階で必要な情報だけが入り、それ以外は読み込まれません。

仮に100ツールを接続した場合の試算をしてみます。

```
Tool Search単体:
  初期ロード:  100ツール × ~130 tokens = ~13,000 tokens
  使用時:      3ツール × ~130 tokens  = ~390 tokens

Tool Search + MCP Light:
  初期ロード:  100ツール × ~22 tokens  = ~2,200 tokens
  使用時:      3ツール × ~22 tokens + Skill = ~66 + ~400 tokens
```

初期ロードだけで10,000トークン以上の差が出ます。

## Skillsとの役割分担

MCP Lightが生成する「ベストプラクティスSkill」と、既存の「タスクSkill」は別物です。

ベストプラクティスSkill（MCP Light由来）— ツール固有の知識です。APIの使い方、パラメータの制約。MCPサーバーが正当なオーナーです。

タスクSkill（ユーザーやチームが作成）— タスク横断のワークフロー。「ドキュメントを作るときはまずアウトラインを作れ」等。

MCP Lightがない場合、タスクSkill作者はMCPツールのベストプラクティスをSkill内にも書きがちで重複が起きていました。MCP Lightはこの重複をDRY原則で解消します。

## ベストプラクティスがforkできるようになる

ここまでの議論はトークン削減が中心でしたが、MCP Lightには見落とされがちな副次的効果があります。ベストプラクティスがユーザーの手に渡ります。

元のMCPサーバーでは、descriptionはサーバー作者のハードコードです。ユーザーは触れません。「この指示は間違っている」「うちの環境ではこう使うべき」と思っても、サーバー本体にPRを出すか、我慢するしかありませんでした。

Skillに外出しした瞬間、ベストプラクティスはただのMarkdownファイルになります。

- チーム固有の規約を追加できる — 「うちのNotionはこのDB構造だから `data_source_id` はこれを使え」
- 間違いを自分で直せる — サーバー作者の対応を待たずに修正
- 複数バリエーションを持てる — チームごと、プロジェクトごとに違うベストプラクティスを使い分け
- コミュニティで改善を回せる — GitHubでfork、PR、issue。集合知でベストプラクティスが磨かれる

MCP Lightのパッケージ構成で言えば、Light版MCPサーバー（description圧縮）は基本的にfork不要ですが、`skill/notion-best-practices/SKILL.md` は積極的にforkされることを想定しています。

元のMCPサーバーのdescriptionは「作者が決めた唯一の正解」でした。Skillにした瞬間「出発点」になります。

## プロトコルへの提言

MCP Lightは「今日から使える」処方箋です。本質的にはMCP仕様に段階的開示が入るべきだと考えています。

```
理想的なMCP仕様:
  list_tools(detail: "summary")  → name + 1行summary のみ
  list_tools(detail: "full")     → 今と同じ完全な定義（後方互換）
  get_tool(name)                 → 個別ツールの完全定義
```

[SEP-1576](https://github.com/modelcontextprotocol/modelcontextprotocol/issues/1576)（スキーマ重複排除）、[Issue #1978](https://github.com/modelcontextprotocol/modelcontextprotocol/issues/1978)（Lazy Tool Hydration）、[SEP-1382](https://github.com/modelcontextprotocol/modelcontextprotocol/issues/1382)（description書き方ガイドライン）が関連する提案として存在しますが、個別ツールレベルの段階的開示は未採択です。Light版MCPサーバーは、プロトコルが追いつくまでの橋渡しです。

## まとめ

- MCPのdescriptionには「判断用」と「実行用」の情報が混在しており、接続しただけでコンテキストを圧迫する。MCP Lightはdescriptionを1行に圧縮し、ベストプラクティスをAgent Skillとして使用時だけ自動ロードする
- Notion MCP（13ツール）での検証で、description 83.5%削減、ツール定義全体で44.0%削減（1,502トークン節約）を確認。opencode実測でも1,386トークンの削減を実測
- 仕様変更もクライアント変更も不要。元サーバーと差し替えるだけで、ベストプラクティスはMarkdownなのでfork・カスタマイズも自由

## References

- MCP
    - [Model Context Protocol](https://modelcontextprotocol.io/)
    - [MCP joins the Agentic AI Foundation](http://blog.modelcontextprotocol.io/posts/2025-12-09-mcp-joins-agentic-ai-foundation/)
    - [SEP-1576: Mitigating Token Bloat in MCP](https://github.com/modelcontextprotocol/modelcontextprotocol/issues/1576)
    - [Issue #1978: Lazy Tool Hydration for Large Tool Sets](https://github.com/modelcontextprotocol/modelcontextprotocol/issues/1978)
    - [Discussion #532: Hierarchical Tool Management](https://github.com/orgs/modelcontextprotocol/discussions/532)
    - [SEP-1382: Documentation Best Practices for MCP Tools](https://github.com/modelcontextprotocol/modelcontextprotocol/issues/1382)
- Context Window Problem
    - [MCP and Context Windows: Lessons Learned During Development — Pablo Castillo](https://medium.com/@pekastel/mcp-and-context-windows-lessons-learned-during-development-590e0b047916)
    - [The Evolution of AI Tool Use: MCP Went Sideways — Waleed Kadous](https://waleedk.medium.com/the-evolution-of-ai-tool-use-mcp-went-sideways-8ef4b1268126)
- 改善アプローチ
    - [Klavis Strata](https://www.klavis.ai/)
    - [meta-mcp-proxy — nullplatform](https://github.com/nullplatform/meta-mcp-proxy)
    - [lazy-mcp — voicetreelab](https://github.com/voicetreelab/lazy-mcp)
    - [mcp-extension-progressive-disclosure — Michael Martin](https://huggingface.co/spaces/MCP-1st-Birthday/mcp-extension-progressive-disclosure/)
- Tools
    - [FastMCP](https://github.com/jlowin/fastmcp)
    - [Agent Skills — Anthropic](https://platform.claude.com/docs/en/agents-and-tools/agent-skills/overview)
    - [Anthropic Skills Repository](https://github.com/anthropics/skills)
