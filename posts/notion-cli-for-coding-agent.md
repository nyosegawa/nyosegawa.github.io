---
title: "全Notion利用者のための、Coding Agentに対応したCLIを作った話"
description: "全Notion利用者のための、Coding Agentに対応したCLIを作った話"
date: 2026-03-19
tags: [Notion, MCP, CLI, Agent, Claude Code]
author: 逆瀬川ちゃん
---

こんにちは！逆瀬川ちゃん ([@gyakuse](https://x.com/gyakuse)) です！

今日はNotion Remote MCPをCLIでラップした [@sakasegawa/notion-cli](https://www.npmjs.com/package/@sakasegawa/notion-cli)（[GitHub](https://github.com/nyosegawa/notion-cli)）を作った話と、その過程で考えた「Agent時代のCLI設計」についてまとめていきたいと思います。

<!--more-->

## 公式のNotion CLIがついにリリース

Notion公式CLI `ntn` がリリースされました。Jonathan Clem氏の[ツイート](https://x.com/_clem/status/2033970975222440421)で発表されたもので、Agent向けのSkill（[makenotion/skills](https://github.com/makenotion/skills)）も同時公開されています。CLIのリポジトリは現在(2026/03/19)時点ではまだ公開されていません。

> New in the Notion CLI, `ntn`: The whole Notion API! And a skill so that your agents know how to use it.

待望のNotion CLIです。ワクワクしながらインストールしたのですが、使ってみると少し悲しくなりました(T_T)

`ntn` は現状では REST API の薄いラッパーです。`ntn api` コマンドで `/v1/` エンドポイントを叩くだけです。認証も `NOTION_API_TOKEN` 環境変数（Integration Token）が必要で、使いたいページを手動で接続する必要があります。公式も "alpha-y so auth is a little wonky" と認めています。

一方、NotionはRemote MCP (`https://mcp.notion.com/mcp`) を公開していて、こちらはOAuthでワークスペース全体にアクセスできます。しかも `ntn` にはない機能がたくさんあります。

| 機能 | Remote MCP | ntn (REST API) |
|---|---|---|
| 認証 | OAuth（全ワークスペース） | Integration Token（手動接続） |
| AI横断検索（Slack, Drive等） | あり | なし（タイトル検索のみ） |
| ビュー作成・更新 | あり | なし |
| ページ複製 | あり | なし |
| データベースビュークエリ | あり | なし |
| ミーティングノート | あり | なし |
| ブロック直接操作 | なし | あり |
| ファイルアップロード | なし | あり |

Remote MCPのほうが明らかにNotionをフル活用するのに向いているのです。

ただ、MCPはContextの問題が大きく、そもそもAgentの命令予算をdisableにしない限り大きく汚染するのが厄介です。以前書いた[MCP Light](/posts/mcp-light/)のような段階的開示アプローチはローカルMCPには有効ですが、Remote MCPサーバーにはプロキシを通すくらいしか処方箋がありません。

てかCLIでサクサク使いたい〜、という気持ちが強かったので作りました！

## Agent時代のCLI設計を考えてみる

このCLIを設計するにあたって決めたことは、主なユーザーをCoding Agent（Claude Code, Codexなど）にするということです。ついでにAgent時代のCLI設計を考えたいな〜という気持ちからこうなりました。

人間も利用対象としつつ、最適化の軸はCoding Agentを対象とします。Coding Agentが初めてこのCLIを使うときの導線はこうなります。

1. `notion --help` を読む（コマンド一覧 + Quick start）
2. 実行する
3. エラーが出たらHintに従って修正する
4. 複雑な操作のときだけ `notion <command> --help` を確認する

エラーのHintが実質的なガイドになります。これを踏まえて4つの設計原則を立ててみます。

### 1. 出力はAgentが読みやすい形式にする

デフォルト出力はMCPレスポンスのJSONテキストを自動検出して `pretty-print` します。
人間向けの装飾（色、罫線、スピナー等）はTTY検出で自動制御し、パイプ時は除去されます。デフォルトでもJSONが返るので `jq` なしで読めます。

- `--json` はデフォルトとほぼ同じですが、MCPが非JSONテキストを返した場合も `{ "text": "..." }` でJSONに包んで返します。Agentがパース失敗しない保証です
- `--raw` はMCPレスポンスをそのまま返します（`isError` フラグやcontent配列構造も含む）
- エラーも `--json` 時は `{ "error", "why", "hint" }` のJSON構造化出力

### 2. ディスカバリは `--help` + エラーヒントとする

`--help` は3レイヤーの段階的開示になっています。

- `notion --help` → 全コマンド一覧 + Quick start + ワークフロー例
- `notion page --help` → サブコマンド一覧
- `notion db create --help` → フラグ・例・前提条件・次のステップ

ただし前述の通りAgentが実際に頼るのはエラーヒントのほうです。MCPエラーをパターンマッチしてツール固有のヒントを付与する仕組みを入れています。

| エラーパターン | ヒント |
|---|---|
| DB URLでquery | view URLが必要 → fetchかview create |
| page createでDB IDをparentに | data_source_idが必要 → fetchで取得 |
| data_source_idがRequired | fetch \<db-id\>で collection://... を探す |
| rich_textがRequired | --bodyでコメント内容を指定 |

### 3. エラーは What + Why + Hint でわかりやすく

すべてのエラーを「何が起きたか」「なぜ起きたか」「次に何をすべきか」の3要素で構造化します。

```
Error: notion-create-pages failed
  Why: Could not find page with ID: abc123...
  Hint: If adding to a database, use --parent collection://<ds-id>.
        Run "notion fetch <db-id>" to get the data_source_id
```

CLI引数パースエラー、MCP `isError` レスポンス、OAuthエラー、すべてこの形式に統一しています。Agentが同じミスを繰り返さないためにはHintが不可欠です。

### 4. Escape Hatchで逃げよう

CLIで実装がたいへんなツールや複雑な引数構造には `notion api` で対応します。

```bash
notion api notion-search '{"query":"test","page_size":5}'
echo '{"query":"test"}' | notion api notion-search
```

AgentはCLIコマンドが不十分なら `notion api` にフォールバックできます。
MCP内部のツール名を露出するのは本来避けたいですが、このescape hatchだけは例外です。機能ロックインを防ぐことのほうが重要だからです。

### 避けるべきパターン

設計時に意識的に避けたパターンもまとめておきます。

| パターン | 問題 |
|---|---|
| MCPツール名をCLIの主要インターフェースにする | noun-verbグルーピングやタブ補完、バリデーションなどCLIのDXが失われる |
| 専用ディスカバリコマンド（`tools`等） | `--help` で十分。余分なコマンドは認知負荷 |
| サブコマンドの `--help` に重要情報を隠す | Agentは読まない。エラーヒントのほうが届く |
| 人間向けの装飾表示のみ | パイプ時にパースしにくい |
| エラーで何をすべきかがない | Agentは同じミスを繰り返す |

このCLIにもAgent Skill（[skills/notion/SKILL.md](https://github.com/nyosegawa/notion-cli/blob/main/skills/notion/SKILL.md)）を同梱しています。Search → Fetch → Act のワークフローパターンやID種別（`page_id` / `data_source_id` / `view_url`）の使い分けなど、エラーヒントだけではカバーしきれない体系的なノウハウを入れています。ただしSkillなしでもCLI単体で `--help` とエラーヒントに従えば使えるようにしているので、Skillはあくまでブースターという扱いです。各自が独自のワークフローを定義するようなSkillを作るときも、「まず `notion --help` して使い方を理解してね」という一行を入れればこのツール自体の使い方は教えなくてもだいたいなんとかなる気がします。

## 実装について

さて、設計原則が決まったところで実装の話に移ります。

### アーキテクチャ

Remote MCP (`https://mcp.notion.com/mcp`) にStreamable HTTP Transportで接続し、CLIコマンドをMCPツール呼び出しに変換する構成です。

```
ユーザー / Agent
    │
    ▼
CLI (Commander.js)
    │  buildXxxCall() でCLI引数→MCP引数マッピング
    ▼
withConnection()
    │  MCPConnection.connect() → callTool() → disconnect()
    ▼
MCP SDK (StreamableHTTPClientTransport)
    │  JSON-RPC over HTTPS
    ▼
Remote Notion MCP (https://mcp.notion.com/mcp)
```

全コマンドが同じ3つのパーツで構成されています。

`buildXxxCall()` は純粋関数で、CLI引数をMCPツール名と引数に変換します。副作用がないのでテストしやすいです。

```typescript
// src/commands/search.ts
export function buildSearchCall(query: string): {
  tool: string;
  args: Record<string, unknown>;
} {
  return { tool: "notion-search", args: { query } };
}
```

`withConnection()` はMCP接続のライフサイクルを管理するヘルパーです。接続→実行→切断を一括で行い、Rate Limit時は自動リトライします。

```typescript
// src/mcp/with-connection.ts
export async function withConnection<T>(
  fn: (conn: MCPConnection) => Promise<T>
): Promise<T> {
  const conn = new MCPConnection();
  try {
    await conn.connect();
    return await withRetry(() => fn(conn));
  } finally {
    await conn.disconnect();
  }
}
```

`printOutput()` は `--json` / `--raw` / デフォルトの出力制御です。

コマンドの実装は毎回このパターンになります。

```typescript
const { tool, args } = buildSearchCall(query);
await withConnection(async (conn) => {
  const result = await conn.callTool(tool, args);
  printOutput(result, cmd.optsWithGlobals());
});
```

`--data` フラグを全コマンドに持たせていて、JSONを直接渡せばCLIフラグをバイパスしてMCPに投げられるようにしています。これもescape hatchの一種です。

### 認証: OAuth 2.0 + PKCE

認証はゼロコンフィグを目指しました。初回の `notion search` でも `notion login` でも、未認証ならブラウザが開いてOAuthフローが始まります。

```
notion search "hello"
  → MCPConnection.connect()
  → UnauthorizedError
  → ブラウザでOAuth同意画面を開く
  → CallbackServerでリダイレクト待ち
  → Token Exchange → tokens.json保存 (0o600)
  → 再接続して実行
```

Dynamic Client Registration、PKCE (S256)、トークンリフレッシュはMCP SDKが面倒を見てくれます。CLIが管理するのはトークンの永続化だけです。トークンは `env-paths` でOS別の設定ディレクトリに保存されます。

| OS | 保存先 |
|---|---|
| macOS | `~/Library/Preferences/notion-cli/` |
| Linux | `~/.config/notion-cli/` |
| Windows | `%APPDATA%\notion-cli\Config\` |

この中に `tokens.json`（access/refresh token、パーミッション 0o600）と `client.json`（OAuthクライアント登録情報）が入ります。

### エラーヒントシステム

MCPの `isError` レスポンスを受け取ったら、エラーメッセージを正規表現でパターンマッチしてツール固有のヒントを付与します。

```typescript
// src/mcp/client.ts
const HINT_RULES: HintRule[] = [
  {
    pattern: /could not find page with id/i,
    tool: "notion-create-pages",
    hint: 'If adding to a database, use --parent collection://<ds-id>. '
        + 'Run "notion fetch <db-id>" to get the data_source_id',
  },
  {
    pattern: /invalid database view url/i,
    hint: 'Use a view URL with ?v= parameter. '
        + 'Run "notion fetch <db-id>" to find view URLs',
  },
  // ...
];

function mcpErrorToCliError(toolName: string, result): CliError {
  const message = extractMcpErrorMessage(result);
  const rule = HINT_RULES.find(
    r => r.pattern.test(message) && (!r.tool || r.tool === toolName)
  );
  return new CliError(`${toolName} failed`, message, rule?.hint);
}
```

ツール固有のルールが先にマッチし、汎用ルール（`unauthorized`、`rate limit` 等）がフォールバックになります。Agentが「ページが見つからない」で詰まったとき「`notion fetch` で `data_source_id` を取得しろ」と即座に教えてくれる仕組みです。

### テスト戦略

テストは `buildXxxCall()` の純粋関数テストを優先しています。CLI引数がMCP引数に正しくマッピングされることの検証です。

```typescript
describe("buildPageCreateCall", () => {
  it("maps --title to pages[0].properties.title", () => {
    const result = buildPageCreateCall({ title: "My Page" });
    expect(result.tool).toBe("notion-create-pages");
    const pages = result.args.pages as Record<string, unknown>[];
    expect(pages[0].properties).toEqual({ title: "My Page" });
  });
});
```

MCP接続のE2Eテストはしていません。純粋関数テストでCLI→MCPのマッピングを検証し、MCP自体の正しさはNotionに任せる方針です。`vitest` でビルド・型チェック・lint・テストを一括で回しています。

### 技術スタック

依存は最小限に抑えるのを目標つぃましたが、`@modelcontextprotocol/sdk` がクソでかいです。

| ライブラリ | 役割 | サイズ |
|---|---|---|
| `@modelcontextprotocol/sdk` | MCP Client + OAuth | ~4.2 MB |
| `commander` | CLIフレームワーク | ~180 KB |
| `env-paths` | OS別設定ディレクトリ | ~5 KB |
| `open` | ブラウザ起動（OAuth） | ~50 KB |

Node.js >= 18で動きます。

## Notion CLIの紹介

さて、ここからは実際の使い方を紹介していこうと思います。

### インストール

```bash
npm install -g @sakasegawa/notion-cli
```

これで `notion` コマンドが入ります。`ntn` とバッティングしてない！

### Quick Start

```bash
# ログイン（ブラウザが開く、初回のみ）
notion login

# 検索
notion search "project plan"

# ページ取得
notion fetch <id>

# ページ作成
notion page create --title "New Page" --parent <page-id>

# プロパティ更新
notion page update <id> --prop "Status=Done"
```

### コマンド一覧

| コマンド | 説明 |
|---|---|
| `notion login / logout / whoami` | OAuth認証管理 |
| `notion search <query>` | ワークスペース横断検索 |
| `notion fetch <url-or-id>` | ページ・DB取得 |
| `notion page create / update / move / duplicate` | ページ操作 |
| `notion db create / update / query` | データベース操作 |
| `notion view create / update` | ビュー操作 |
| `notion comment create / list` | コメント操作 |
| `notion user list / team list` | ユーザー・チーム一覧 |
| `notion meeting-notes query` | ミーティングノート |
| `notion api <tool> [json]` | MCP直接呼び出し（escape hatch） |

### 代表的なワークフロー

Agentが一番よく使うパターンは Search → Fetch → Act です。

```bash
# 1. 検索してIDを取得
notion search "Tasks DB" --json

# 2. DBの詳細を取得（data_source_idとビューURLを確認）
notion fetch <db-id> --json

# 3. DBにエントリを追加
notion page create --parent collection://<ds-id> \
  --title "新しいタスク" --prop "Status=Open"
```

データベースの作成からエントリ追加までの流れはこうなります。

```bash
# DB作成（--propでカラム定義）
notion db create --title "Tasks" --parent <page-id> \
  --prop "Name:title" --prop "Status:select=Open,Done"

# レスポンスからdata_source_idを取得して、エントリ追加
notion page create --parent collection://<ds-id> \
  --title "Task 1" --prop "Status=Open"
```

stdinからのパイプも対応しています。

```bash
echo "# Meeting Notes" | notion page create \
  --title "2026-03-18 Weekly" --parent <id> --body -
```

全コマンドで `--json`（構造化出力）と `--raw`（MCP生レスポンス）と `--data`（JSON直接指定）が使えます。

## まとめ

- Remote MCPをCLIでラップすることで、OAuthで全ワークスペースにアクセスしつつターミナルとエージェントの両方からNotionをフル活用できるようになりました
- Agent-first設計（構造化出力、What+Why+Hintエラー、escape hatch）は人間にとっても使いやすいです
- [npm](https://www.npmjs.com/package/@sakasegawa/notion-cli)からインストールできます。[GitHub](https://github.com/nyosegawa/notion-cli)でソースも公開しています
- よかったら使ってみてください！自分もClaudeに使わせていますが、結構便利です

## References

- [GitHub: nyosegawa/notion-cli](https://github.com/nyosegawa/notion-cli)
- [npm: @sakasegawa/notion-cli](https://www.npmjs.com/package/@sakasegawa/notion-cli)
- [Notion Remote MCP](https://mcp.notion.com/mcp)
- [ntn (Notion公式CLI)](https://www.npmjs.com/package/ntn)
- [makenotion/skills](https://github.com/makenotion/skills)
- [MCP Light: MCPをAgent Skillsのように軽量化する](/posts/mcp-light/)
- [Model Context Protocol](https://modelcontextprotocol.io/)
