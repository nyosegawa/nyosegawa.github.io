---
title: "Claude Code × MCP × Pluginでプロジェクト管理を自動化する"
description: "Notion/Linear/コードベースに散らばった情報をClaude CodeのMCP連携でLinearに統合した実体験と、その手法をPluginとして汎用化・公開した話"
date: 2026-02-12T14:00:00
tags: [Claude Code, MCP, Plugin, Linear, Notion]
author: 逆瀬川ちゃん
---

こんにちは！逆瀬川 ([@gyakuse](https://x.com/gyakuse)) です！

今日はClaude CodeのMCP連携を使って、NotionとLinearとコードベースに散らばったプロジェクト情報をLinearに一気に統合した話をまとめていきたいと思います。やってみたら結構うまくいったので、その手法をClaude Code Pluginとして汎用化して公開するところまでやりました。

<!--more-->

## 問題: 情報が3箇所に散らばっている

開発プロジェクトを進めていると気づいたら情報がバラバラになりがちです。

- Notion: 設計ドキュメント、仕様、TODO、ミーティングメモ
- Linear: issueとしてのタスク管理
- Git: 実装コード

それぞれ単体では機能しているのだけれど、こういう状況が生まれる。

- Notionに書いた仕様が実装と乖離している（書いてあるが未実装、または実装したがNotionに反映されていない）
- Linearのissueにdescriptionがなく、対応するNotionページを探さないと何のタスクかわからない
- Notionに書いたTODOがLinearにissue化されていない
- issueがフラットに並んでいてプロジェクトでグルーピングされていない

要するにsingle source of truthがない。これを手作業で整理するのは面倒すぎるし、MCPを使えば自動化できるんじゃないかと思って試してみました。

## アプローチ: MCPでNotionもLinearも直接操作する

Model Context Protocol (MCP) はLLMが外部ツールやデータソースにアクセスするためのオープンプロトコルです。定義はそうなのですが、実用的に何が嬉しいかというと「Claude Codeから直接NotionもLinearも操作できる」ということです。

セットアップは2コマンドで終わります。

```bash
# Notion MCP（公式ホスト版）
claude mcp add --transport http notion https://mcp.notion.com/mcp

# Linear MCP
claude mcp add --transport http linear https://mcp.linear.app/mcp
```

追加後にClaude Codeで `/mcp` を実行するとOAuth認証フローが走るので、それぞれのサービスで認可すれば完了。

これでClaude Codeのセッション内から以下が全部できるようになります。

| Notion MCP | Linear MCP |
|---|---|
| ページ検索・取得 | issue一覧・取得・作成・更新 |
| ページ内容の読み取り | プロジェクト作成・管理 |
| ページの更新 | ドキュメント作成 |
| データベースのクエリ | ラベル・マイルストーン管理 |

さて、ツールが揃ったところで実際にやった手順を見ていきましょう。

## 手順: Read → Analyze → Write

### Phase 1: 現状の棚卸し（Read）

最初にやるべきは「今なにがどこにあるか」の全量把握です。ここで重要なのは3つの情報源を並列に取得すること。

```
[並列実行]
├── Notion: ルートページ + 全サブページの内容取得
├── Linear: 全issue + ステータス + メタデータ取得
└── コードベース: ツール定義・主要モジュールの探索（Grep/Glob）
```

Claude Codeではこの3つを同時に走らせられます。Notion MCPで `notion-search` → 各ページを `notion-fetch`、Linear MCPで `list_issues` + `list_projects`、コードベースはGrep/Globで主要な定義を探索。

このフェーズでは何も書き込まない。読み取りだけ。これが大事で、読みながら書き始めると途中で方針が変わったときに手戻りが発生する。

### Phase 2: 差分分析とプラン作成（Analyze）

棚卸しが終わったら差分を洗い出します。具体的には3種類の差分。

1つ目は仕様と実装の差分。Notionに「このツールがある」と書いてあるものがコードに実装されているか。

```
Notionの仕様記載ツール一覧:
  tool_a  →  実装: ✅
  tool_b  →  実装: ✅
  tool_c  →  実装: ❌（未実装 or 別ツールに統合済み）
  ---
コードに実装済みだがNotionに記載なし:
  tool_d  →  仕様: ❌
```

2つ目はNotionのTODOとLinear issueの差分。Notionに書いてあるがLinearにissue化されていないもの。

3つ目はLinear issueの情報不足。issueは存在するがdescriptionが空で何のタスクかわからないもの。

この分析結果をもとに「プロジェクトをN個、ドキュメントをM個、issueをK個作る」という具体的な実行プランを作成します。Claude Codeのplan modeを使うと、プランを承認するまで書き込みが走らないので安全です。

### Phase 3: Linearへの統合（Write）

プランが確定したら実行。やることは4つ。

まずプロジェクトの作成。issueがフラットに並んでいるだけだと見通しが悪いので、関連するissueをグルーピングするプロジェクトを作る。

次にドキュメントの作成。Notionに散在していた設計情報をLinearドキュメントに集約する。これが地味に大事で、issueの背景や技術的な仕様がLinear内で参照できるようになる。ポイントはNotionのコピペではなくコードベースの実装と突合した内容を書くこと。

3つ目に不足issueの作成。Phase 2で見つかった「Notionにあるが Linear にない」タスクをissue化。

4つ目に既存issueの整備。descriptionの追記、プロジェクトへの紐付け、親子関係の設定、優先度の設定を一括で。

最後にNotionのTODOページにLinearプロジェクトへのリンクを追記して、タスク管理はLinearを見てね、という導線を作る。

実際にNotionの15ページ分のドキュメントとTODO、30件のLinear issueを整理してLinearをsingle source of truthにできました。

## この手法をPluginにした

さて、この Read → Analyze → Write の3フェーズはプロジェクトを問わず使える汎用的なパターンです。毎回手作業で同じ指示を出すのは面倒なので、Claude Code Pluginとして汎用化しました。

### Claude Code Pluginとは

Claude Code Pluginは、スラッシュコマンド・サブエージェント・MCPサーバー・Hooksを1つのパッケージにまとめて配布できる仕組みです。2026年現在Public Betaで、すべてのClaude Codeユーザーが利用可能です。

Pluginの構成要素を表にするとこう。

| ディレクトリ | 中身 |
|---|---|
| `.claude-plugin/plugin.json` | プラグインのメタデータ（名前・説明・バージョン） |
| `commands/` | スラッシュコマンド（Markdownファイル） |
| `skills/` | Agent Skills（SKILL.mdファイル） |
| `agents/` | カスタムサブエージェント定義 |
| `hooks/` | イベントハンドラ |
| `.mcp.json` | MCPサーバー設定 |

個人用のカスタマイズなら `.claude/` ディレクトリ直下に置けばいいのですが、Pluginにする利点は3つ。

- チームや他のユーザーに配布できる
- MCPサーバー設定をバンドルできる（これが重要）
- `/plugin install` で1コマンドインストール

### project-migratorの構成

今回作ったプラグインの構成はこうなっています。

```
project-migrator/
├── .claude-plugin/
│   └── plugin.json        # メタデータ
├── .mcp.json              # Notion + Linear MCPをバンドル
├── commands/
│   └── migrate.md         # /project-migrator:migrate コマンド
└── skills/
    └── project-migration/
        ├── SKILL.md        # 移行ワークフローの全手順
        └── references/
            └── mcp-api-notes.md  # MCP APIのハマりポイント集
```

核心は `.mcp.json` と `SKILL.md` の2つです。

`.mcp.json` にNotionとLinearのMCPサーバーをバンドルすることで、プラグインをインストールするだけで両サービスへの接続が自動的にセットアップされる。

```json
{
  "mcpServers": {
    "notion": {
      "type": "http",
      "url": "https://mcp.notion.com/mcp"
    },
    "linear": {
      "type": "http",
      "url": "https://mcp.linear.app/mcp"
    }
  }
}
```

`SKILL.md` に移行ワークフローの全手順を記述することで、Claude Codeが自律的にPhase 1〜3を実行できる。人間がやるのは最初にNotion URLを渡すことと、Phase 2のプランを承認することだけ。

使い方はプロジェクトのルートからClaude Codeを起動して以下を実行するだけ。

```bash
/project-migrator:migrate https://www.notion.so/your-workspace/Your-Page-xxxxxxxxxxxx
```

## Pluginの作り方と公開

ここからはClaude Code Pluginの作り方を見ていきます。今回のproject-migratorを例に。

### Step 1: ディレクトリ構成を作る

```bash
mkdir -p project-migrator/.claude-plugin
mkdir -p project-migrator/commands
mkdir -p project-migrator/skills/project-migration/references
```

注意点として `commands/` や `skills/` は `.claude-plugin/` の外に置くこと。`.claude-plugin/` の中には `plugin.json` だけ。これ間違えると動かない。

### Step 2: plugin.jsonを書く

```json
{
  "name": "project-migrator",
  "description": "Migrate scattered project information into a unified Linear workspace",
  "version": "1.0.0",
  "author": {
    "name": "nyosegawa"
  },
  "repository": "https://github.com/nyosegawa/project-migrator"
}
```

`name` がスラッシュコマンドの名前空間になります。ここで `project-migrator` と指定すると、コマンドは `/project-migrator:migrate` のようにプレフィックスがつく。

### Step 3: スラッシュコマンドを定義する

`commands/migrate.md` を作成。

```markdown
---
description: Migrate project information from Notion to Linear
---

# Project Migration

Migrate the Notion page at the given URL into Linear,
using the current working directory as the codebase.

**Input:** $ARGUMENTS

Use the project-migration skill to execute the migration workflow.

- If `$ARGUMENTS` contains a Notion URL, use it as the migration source
- If `$ARGUMENTS` is empty, ask the user for the Notion page URL
- The current working directory is the codebase to reconcile against
```

`$ARGUMENTS` がユーザーの入力をキャプチャするプレースホルダー。`/project-migrator:migrate https://notion.so/...` と打つと `$ARGUMENTS` にURLが入る。

### Step 4: SKILL.mdを書く

ここが一番ボリュームがある部分です。Claude Codeが自律的にタスクを実行するための手順書を記述する。

フロントマターには `name`、`description`、利用するMCPサーバーの情報を書く。

```yaml
---
name: project-migration
description: Migrate and reconcile scattered project information into a unified Linear workspace.
compatibility: Requires Notion MCP and Linear MCP servers connected.
metadata:
  mcp-server: notion, linear
---
```

本文にはPhase 1〜3の具体的な手順、使用するMCPツール名とパラメータ、フォーマット上の注意点、トラブルシューティングを記述する。Skill vs Commandの違いはここで、Commandはユーザーがスラッシュコマンドとして呼び出すもの、SkillはClaude Codeが文脈に応じて自律的に使うもの。今回はCommandからSkillを呼び出す構成にしています。

### Step 5: MCPサーバーをバンドルする

`.mcp.json` をプラグインルートに置くと、インストール時にMCPサーバー設定が自動登録される。これがPluginの大きな利点で、ユーザーは `claude mcp add` を手動実行する必要がない。

### Step 6: ローカルテスト

```bash
claude --plugin-dir ./project-migrator
```

これでプラグインがロードされた状態でClaude Codeが起動する。`/project-migrator:migrate` が使えるか確認。複数のプラグインを同時にテストしたいなら `--plugin-dir` フラグを複数指定すればよい。

### Step 7: 公開

プラグインはGitHubリポジトリとして公開するのが標準的なパターンです。1プラグイン = 1リポジトリ。

```bash
gh repo create project-migrator --public
git init && git add -A && git commit -m "initial commit"
git remote add origin git@github.com:yourname/project-migrator.git
git push -u origin main
```

他のユーザーは以下でインストールできます。

```bash
# マーケットプレイス経由
/plugin install project-migrator@your-marketplace

# または直接リポジトリ指定（TODO: 公式でサポートされるかは要確認）
claude --plugin-dir /path/to/project-migrator
```

マーケットプレイスを運用するなら、別リポジトリに `.claude-plugin/marketplace.json` を置いてプラグインへの参照を記述する。

```json
{
  "name": "my-marketplace",
  "plugins": [{
    "name": "project-migrator",
    "source": { "source": "github", "repo": "yourname/project-migrator" },
    "version": "1.0.0"
  }]
}
```

## MCP APIのハマりポイント

実際の移行作業で踏んだ地雷と対策をまとめておきます。

### Linear: \nリテラル問題

これが一番厄介でした。Linear MCPの `create_issue` や `update_issue` でdescriptionを渡すとき、文字列リテラルとしての `\n` を含めると改行ではなく `\n` というテキストがそのまま表示されます。

```
❌ description: "## 概要\nこのissueは..." → 「## 概要\nこのissueは...」と表示される
✅ description に実際の改行文字を含める → 正しくMarkdown描画される
```

Claude Codeにdescriptionを書かせるときは「実際の改行文字を使え、リテラルな `\n` は使うな」と明示的に指示する必要があります。SKILL.mdにも太字で警告を書いておきました。

### Linear: Markdownサポート範囲

Linearはかなり豊富なMarkdownをサポートしていますが、いくつか非対応のものがあります。実際にissueを作って検証した結果がこう。

| 要素 | 対応 |
|---|---|
| 見出し・太字・イタリック・取り消し線 | ✅ |
| コードブロック（シンタックスハイライト付き） | ✅ |
| テーブル・リスト・チェックリスト | ✅ |
| Mermaidダイアグラム | ✅ |
| 折りたたみセクション（`>>>` 記法） | ✅ |
| LaTeX / 数式 | ❌ |
| HTMLタグ | ❌ |

折りたたみセクションはHTMLの `<details>/<summary>` ではなく、Linear独自の `>>>` 記法を使います。数式が必要ならコードブロックでプレーンテキスト表記にするか画像にする。

### Linear: バッチAPIがない

issue更新は1件ずつAPIコールするしかありません。30件のissueにプロジェクトを紐付けたいときは30回のAPI呼び出しが発生する。対策としては独立した更新をClaude Codeの並列ツールコール機能で同時実行すること。「この10件のissueに同じprojectIdを設定して」と指示すれば並列で処理してくれます。

### Linear: SSE → HTTP移行

2026年2月時点でLinear MCPのSSEトランスポートが非推奨になりました。エンドポイントを `https://mcp.linear.app/sse` から `https://mcp.linear.app/mcp` に変更する必要があります。

### Notion: matchパラメータの罠

`notion-update-page` の `match` パラメータはページの本文テキストを検索します。ページタイトルではない。これに気づかず「ページタイトルでmatchしよう」として失敗するケースが多い。対策はfetchしてから本文中の見出しテキストでmatchすること。

### Notion: レート制限

Notion APIは約3リクエスト/秒のレート制限があります。サブページが15個あるとき一気にfetchすると制限に引っかかることがある。

## 高速化のコツ

この移行作業をもっと速くやるなら、以下がポイントです。

- Read/Analyze/Writeの3フェーズを厳密に分離する。読みながら書き始めない
- Notionの全ページを最初に一括取得してから分析に入る
- 独立した更新は並列実行する（Claude Codeは複数ツールコールを同時発行できる）
- MCPのAPI仕様（フォーマット制約、必須フィールド、エラーメッセージ）は事前に把握しておく。初回は小さなテストデータで確認
- コードベース分析は軽量にする。仕様の実装確認が目的であって、フルのコードレビューではない

## まとめ

- Claude Code + Notion MCP + Linear MCPで、分散したプロジェクト情報をLinearに統合する作業をほぼ自動化できる
- Read → Analyze → Write の3フェーズ分離が高速化の鍵
- この手法をClaude Code Pluginとして汎用化すると、MCPサーバー設定のバンドルやスラッシュコマンド化で再利用が楽になる
- MCP APIには独自のフォーマット制約があるので、SKILL.mdの `references/` に知見を蓄積しておくと後で助かる

## References

- Claude Code Plugin
    - https://code.claude.com/docs/en/plugins
    - https://claude.com/blog/claude-code-plugins
- MCP
    - https://modelcontextprotocol.io/specification/2025-11-25
    - https://code.claude.com/docs/en/mcp
- Notion MCP
    - https://developers.notion.com/docs/mcp
    - https://www.notion.com/blog/notions-hosted-mcp-server-an-inside-look
- Linear MCP
    - https://linear.app/docs/mcp
    - https://linear.app/changelog/2026-02-05-linear-mcp-for-product-management
- project-migrator（今回作ったPlugin）
    - https://github.com/nyosegawa/project-migrator
