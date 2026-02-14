---
title: "Claude Code中心のMac開発環境を整備する - tmux・Ghostty・Discord通知"
description: "Claude Code専用の4ペインtmuxレイアウト、Ghostty + Starshipのターミナル環境、Hooks経由のDiscord通知まで、開発ワークフロー全体を最適化した話"
date: 2026-02-14
tags: [Claude Code, tmux, Ghostty, Starship, Discord, Hooks]
author: 逆瀬川ちゃん
---

こんにちは！逆瀬川ちゃん ([@gyakuse](https://x.com/gyakuse)) です！

今日はClaude Codeを中心にしたMacの開発環境を整備した話をまとめていきたいと思います。tmuxのレイアウト、ターミナルの設定、離席中のDiscord通知まで、一通りやったので全部書いていきます。

<!--more-->

## Claude Codeに最適化された開発環境とは

Claude Codeで開発していると、ターミナルの使い方が従来とだいぶ変わってきます。

従来のターミナル作業は「自分がコマンドを打つ」のが前提でした。エディタを開いて、ビルドコマンドを叩いて、テストを走らせて、という流れですね。Claude Codeの場合は「Claudeがファイルを書いてコマンドを実行する」のがメインになるので、自分の作業は指示出しと承認が中心になります。

そうなると求められる環境もちょっと違ってきます。

- Claude Codeのペインが一番大きく見えてほしい
- サーバーやフロントエンドのログは横に並べて常時監視したい
- 離席中にClaudeが止まったら通知がほしい
- プロジェクトの切り替えをスムーズにしたい

この記事ではこれらを実現するために作った環境を紹介していきます。すべての設定ファイルは[dotfilesリポジトリ](https://github.com/nyosegawa/dotfiles)で公開しています。

## dev-tmux: 4ペイン固定レイアウトの開発環境マネージャー

まず一番大きい仕組みであるdev-tmuxから紹介します。これは「1プロジェクト = 1ウィンドウ = 4ペイン固定」というコンセプトのtmux管理スクリプトです。

### レイアウト

```
┌───────────┬───────┬───────┐
│ 1: Claude │ 3:srv │ 4:fnt │
├───────────┤       │       │
│ 2: free   │       │       │
└───────────┴───────┴───────┘
```

| ペイン | 用途 | 起動タイミング |
|--------|------|---------------|
| 1 (左上) | Claude Code | セッション開始時 |
| 2 (左下) | git操作・自由ターミナル | セッション開始時 |
| 3 (中央) | サーバー (`npm run dev` 等) | Option+R で起動 |
| 4 (右) | フロントエンド等 | Option+R で起動 |

実際の画面はこんな感じです。

![dev-tmuxの4ペインレイアウト](/img/claude-code-tmux-layout.png)

ペイン1が一番広くてここでClaude Codeを動かします。左下のペイン2はgit操作やちょっとしたコマンド実行用。右側のペイン3と4はサーバープロセスやフロントエンドのdev serverを常時表示しておく場所です。

ポイントはペイン3と4が「Option+Rで起動/再起動」という点ですね。Claude Codeが依存パッケージを更新した後にOption+Rを押すだけでサーバーが再起動されるので、開発サーバーの再起動のためにペインを切り替える手間がありません。

### プロジェクト管理

dev-tmuxはプロジェクトごとに設定ファイルを持っています。`~/.config/dev-tmux/<name>.conf` に配置されます。

```bash
PROJECT_DIR="~/src/github.com/nyosegawa/aituber"
PANE1_CMD=""              # 空=手動起動 (Claude Codeを自分で起動する)
PANE2_CMD=""              # 空=手動起動
PANE3_DIR=""              # サブディレクトリ指定 (空=PROJECT_DIR)
PANE3_CMD="npm run dev"   # Option+Rで起動されるコマンド
PANE4_DIR="frontend"
PANE4_CMD="npm run dev"
```

PANE1_CMDを空にしているのは意図的です。Claude Codeは毎回セッションの状態が違うので `--resume` で前回の続きをやりたいときもあれば新規セッションで始めたいときもあります。自動起動にしないほうが柔軟です。

プロジェクトの登録は簡単です。

```bash
cd ~/src/github.com/nyosegawa/aituber
dev add              # カレントディレクトリ名で登録
dev config           # ペイン3,4のコマンドを対話設定
dev                  # 起動
```

### ウィンドウ切り替えでプロジェクトを切り替える

dev-tmuxでは1プロジェクト = 1ウィンドウなので、`Shift+左/右` でプロジェクト間を行き来できます。tmuxのウィンドウ切り替えがそのままプロジェクト切り替えになるわけです。

ステータスバーにはプロジェクト名が並ぶので、今どのプロジェクトにいるかも一目でわかります。

```
 dev  aituber  skills  blog
```

現在のプロジェクトはハイライト表示されます。

### ショートカット一覧

Prefix不要で使えるショートカットをまとめます。

| キー | 操作 |
|------|------|
| マウスクリック | ペイン移動 |
| Shift+左/右 | プロジェクト切り替え |
| Option+C | 現在のペインをクリア |
| Option+D | 全ペインをクリア |
| Option+R | ペイン3,4を再起動 |
| Option+S | ペイン3,4を停止 |

tmuxのPrefixは `Ctrl+]` にしています。デフォルトの `Ctrl+B` はEmacsキーバインドと被るし、`Ctrl+A` もシェルの行頭移動と被ります。`Ctrl+]` ならほぼ何とも干渉しません。

## Ghostty + Starship: ノイズのないターミナル環境

さて、dev-tmuxのOption+キーバインドの話をしましたが、実はこれを動かすにはターミナル側の設定が必要です。

### Ghostty: macOS + tmux に最適化

Ghosttyの設定は3行だけです。

```
macos-option-as-alt = true
copy-on-select = clipboard
shell-integration-features = ssh-terminfo,ssh-env
```

一番重要なのは `macos-option-as-alt = true` です。macOSではOptionキーを押すと特殊文字（`ç`, `∂` 等）が入力される仕様になっています。この設定をtrueにすることで、OptionキーをAlt/Metaとしてtmuxに送信するようになります。これがないとOption+C/D/R/Sが全く動きません。

`copy-on-select = clipboard` はマウスでテキストを選択するだけでクリップボードにコピーされる設定です。tmux上でClaude Codeの出力をコピーするときに便利です。

`shell-integration-features = ssh-terminfo,ssh-env` はSSH先にterminfoを自動転送する機能です。WSLにSSHしたときにGhosttyのterminfo問題が起きないようにしています。

### Starship: 2行のミニマルプロンプト

Claude Codeを使っていると自分でコマンドを打つ頻度が減るので、プロンプトに表示される情報量は最小限でいいと思っています。

```
~/src/github.com/nyosegawa/aituber  main ?1          14:30
❯
```

1行目にフルパスのディレクトリ、Gitブランチ、ステータス、右端に時刻。2行目はプロンプト記号の `❯` だけです。成功なら緑、エラーなら赤になります。

Node.jsやPythonのバージョン表示、クラウドプロバイダの表示、コマンド実行時間の表示はすべて無効化しています。これらはClaude Codeの出力と混ざって邪魔になるだけなので。

```toml
[nodejs]
disabled = true

[python]
disabled = true

[cmd_duration]
disabled = true
```

ディレクトリのフルパス表示だけは維持しています。ghqで管理しているリポジトリは `~/src/github.com/owner/repo` という構造なので、フルパスを見ればどのプロジェクトかすぐわかります。

## Claude Code Hooks → Discord通知

ここまでで「作業中」の環境は整いました。次は「離席中」の問題です。

Claude Codeに長めのタスクを投げて離席することはよくあります。コーヒーを淹れに行ったり、別のことをしていたり。そのときにClaudeが返信を完了したのか、権限の確認を待っているのか、わからないのは困ります。

Claude Codeには[Hooks](https://code.claude.com/docs/en/hooks)というシステムがあって、エージェントのライフサイクルの特定のタイミングでシェルコマンドを実行できます。これを使ってDiscord Webhookに通知を飛ばすようにしました。

### Hooksの仕組み

Hooksは `~/.claude/settings.json` に定義します。イベントが発生すると、Claude Codeがstdinに JSON コンテキストを渡してシェルコマンドを実行してくれます。

今回使うイベントは2つです。

| イベント | 発火タイミング |
|----------|---------------|
| Stop | Claudeが返信を完了したとき |
| Notification | 権限の確認やアイドル状態のとき |

それぞれのイベントでstdinに渡されるJSONには共通フィールドがあります。

| フィールド | 内容 |
|-----------|------|
| `session_id` | セッションID |
| `transcript_path` | 会話ログのJSONLファイルパス |
| `cwd` | 作業ディレクトリ |
| `permission_mode` | 権限モード |
| `hook_event_name` | イベント名 |

Stopイベントには追加で `stop_hook_active`（無限ループ防止用フラグ）が、Notificationイベントには `notification_type` と `message` が含まれます。

### settings.jsonの設定

```json
{
  "env": {
    "CLAUDE_DISCORD_WEBHOOK_URL": "https://discord.com/api/webhooks/..."
  },
  "hooks": {
    "Stop": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "python3 $HOME/.claude/hooks/discord-notify.py",
            "async": true
          }
        ]
      }
    ],
    "Notification": [
      {
        "matcher": "",
        "hooks": [
          {
            "type": "command",
            "command": "python3 $HOME/.claude/hooks/discord-notify.py",
            "async": true
          }
        ]
      }
    ]
  }
}
```

`async: true` にしているのがポイントです。通知の送信はClaude Codeの動作をブロックする必要がないので、バックグラウンドで実行させています。

Webhook URLは `env` で環境変数として定義しています。スクリプト側で `CLAUDE_DISCORD_WEBHOOK_URL` を参照するので、URLの管理がsettings.jsonに集約されます。

### 通知スクリプト

最初はbashで書いていたのですが、transcriptのJSONLパースが辛かったのでPythonに書き換えました。`~/.claude/hooks/discord-notify.py` の全体です。標準ライブラリだけで動きます。

```python
#!/usr/bin/env python3
"""Claude Code → Discord notification via webhook."""

import json
import os
import sys
import urllib.request

WEBHOOK_URL = os.environ.get("CLAUDE_DISCORD_WEBHOOK_URL", "")
if not WEBHOOK_URL:
    sys.exit(0)

data = json.load(sys.stdin)
event = data.get("hook_event_name", "Unknown")
cwd = data.get("cwd", "")
session_id = data.get("session_id", "")[:8]

title = ""
message = ""
color = 5814783


def extract_from_transcript(path: str, role: str, limit: int = 200) -> str:
    """transcript_pathから指定ロールの最後のメッセージを抽出する。"""
    if not path or not os.path.isfile(path):
        return ""
    with open(path, "r") as f:
        lines = f.readlines()
    for line in reversed(lines):
        try:
            entry = json.loads(line)
        except json.JSONDecodeError:
            continue
        if entry.get("type") != role:
            continue
        content = entry.get("message", {}).get("content", "")
        # contentは文字列の場合とブロック配列の場合がある
        if isinstance(content, str):
            text = content
        elif isinstance(content, list):
            texts = []
            for c in content:
                if isinstance(c, str):
                    texts.append(c)
                elif isinstance(c, dict) and c.get("type") == "text" and c.get("text"):
                    texts.append(c["text"])
            text = texts[0] if texts else ""
        else:
            continue
        if text:
            if len(text) > limit:
                return text[:limit] + "..."
            return text
    return ""


# --- Stop: 返信完了 ---
if event == "Stop":
    if data.get("stop_hook_active"):
        sys.exit(0)

    title = "✅ 返信完了"
    color = 3066993  # 緑

    transcript = data.get("transcript_path", "")
    user_msg = extract_from_transcript(transcript, "user", 100)
    assistant_msg = extract_from_transcript(transcript, "assistant", 300)

    parts = []
    if user_msg:
        parts.append(f"> {user_msg}")
    if assistant_msg:
        parts.append(assistant_msg)
    message = "\n\n".join(parts) if parts else "Claudeの返信が完了しました。"

# --- Notification: 権限確認・アイドル ---
elif event == "Notification":
    ntype = data.get("notification_type", "unknown")
    nmsg = data.get("message", "")
    if ntype == "permission_prompt":
        title = "⚠️ 確認待ち"
        color = 15105570  # オレンジ
        message = nmsg or "権限の確認が必要です。"
    elif ntype == "idle_prompt":
        title = "💤 入力待ち"
        color = 9807270  # グレー
        message = nmsg or "Claudeが入力を待っています。"
    else:
        title = "🔔 通知"
        color = 3447003  # 青
        message = nmsg or "通知があります。"

if not title:
    sys.exit(0)

# フッターにcwdとセッションIDを表示
footer_parts = []
if cwd:
    footer_parts.append(f"📁 {cwd}")
if session_id:
    footer_parts.append(f"🔑 {session_id}")
footer = "  |  ".join(footer_parts)

# Discord Webhookに送信
payload = json.dumps({
    "embeds": [{
        "title": title,
        "description": message,
        "color": color,
        **({"footer": {"text": footer}} if footer else {}),
    }]
}).encode()

req = urllib.request.Request(
    WEBHOOK_URL,
    data=payload,
    headers={
        "Content-Type": "application/json",
        "User-Agent": "Claude-Code-Hook/1.0",
    },
    method="POST",
)
try:
    urllib.request.urlopen(req, timeout=10)
except Exception:
    pass
```

いくつかポイントを説明します。

### 自分の指示とClaudeの返信をセットで表示

Stopイベントの `transcript_path` には会話ログのJSONLファイルのパスが入っています。このファイルを逆順に読んで、直近のユーザーメッセージ（`type: "user"`）とassistantの返信（`type: "assistant"`）を抽出しています。

Discordの通知はこういう表示になります。

```
✅ 返信完了

> 1+1は？

2です。

📁 /Users/sakasegawa  |  🔑 74eb9211
```

自分の指示がDiscordの引用ブロック（`>`）で表示され、その下にClaudeの返信が続きます。離席中に通知を見るだけで「何を頼んで」「何が返ってきたか」がわかります。

実際のDiscord通知がこちらです。

![Discord通知の実際の表示](/img/claude-code-discord-notification.png)

transcriptのJSONL形式にはちょっとした注意点があります。ユーザーメッセージの `content` は文字列直接ですが、assistantメッセージの `content` はブロック配列になっています。この差分をPythonで吸収しているので、bashより圧倒的に楽です。

### イベント種別による色分け

Discordのembedには `color` フィールドがあるので、イベントの種類ごとに色を変えています。

| イベント | 色 | 意味 |
|----------|-----|------|
| 返信完了 | 緑 (3066993) | 確認してください |
| 確認待ち | オレンジ (15105570) | すぐ対応が必要です |
| 入力待ち | グレー (9807270) | 次の指示を待っています |

スマホの通知を見たときに色だけで「急いで戻るべきか」「後で見ればいいか」が判断できます。

### フッターでプロジェクトとセッションを識別

複数のプロジェクトでClaude Codeを同時に動かしていることもあるので、フッターに作業ディレクトリとセッションIDを表示しています。

```
📁 /Users/sakasegawa/src/github.com/nyosegawa/aituber  |  🔑 eb5b0174
```

### User-Agentヘッダーの罠

Pythonの `urllib.request` はデフォルトで `User-Agent: Python-urllib/3.x` を送信します。DiscordのWebhook APIはこのUser-Agentを403で弾くので、カスタムUser-Agentを設定する必要があります。bashの `curl` では起きない問題なので、Pythonに移行する際は注意してください。

### 無限ループの防止

Stopイベントにはちょっとした罠があります。Stop hookのスクリプトが完了すると、それ自体がまたStopイベントを発火させる可能性があります。`stop_hook_active` フラグがtrueのときはスクリプトを即座に終了させて無限ループを防いでいます。

## まとめ

- dev-tmuxでClaude Code専用の4ペインレイアウトを固定化し、プロジェクトはウィンドウ単位で切り替えるようにしています。[dotfilesリポジトリ](https://github.com/nyosegawa/dotfiles)で公開しています
- Ghosttyの `macos-option-as-alt = true` とStarshipのミニマルプロンプトで、Claude Code中心のターミナル環境を構築しています
- Claude Code Hooksを使ったDiscord Webhook通知で、離席中もClaudeの状態を把握できるようにしています

## References

- [nyosegawa/dotfiles](https://github.com/nyosegawa/dotfiles) - 本記事のtmux, Ghostty, Starship設定ファイル
- [Hooks reference - Claude Code Docs](https://code.claude.com/docs/en/hooks) - Claude Code Hooks公式リファレンス
- [Automate workflows with hooks - Claude Code Docs](https://code.claude.com/docs/en/hooks-guide) - Hooksのガイド
- [Ghostty](https://ghostty.org/) - Ghosttyターミナル
- [Starship](https://starship.rs/) - Starshipプロンプト
- [Discord Webhook API](https://discord.com/developers/docs/resources/webhook) - Discord Webhook
