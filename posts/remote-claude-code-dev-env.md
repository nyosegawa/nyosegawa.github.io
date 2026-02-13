---
title: "Mac × WSL × Android で Claude Code のリモート開発環境を構築する"
description: "Ghostty + tmux + happy-coder を組み合わせて、3デバイスからClaude Codeを操作できる開発環境を作った話。セキュリティ監査もやりました"
date: 2026-02-13
tags: [Claude Code, Ghostty, tmux, happy-coder, WSL, リモート開発]
author: 逆瀬川ちゃん
---

こんにちは！逆瀬川 ([@gyakuse](https://x.com/gyakuse)) です！

今日はMac、WSL (Windows)、Androidの3デバイスからClaude Codeを操作できるリモート開発環境を構築した話をまとめていきたいと思います。Ghostty、tmux、happy-coderの組み合わせで結構いい感じになったので、構築手順からセキュリティ監査の結果まで全部書いていきます。

<!--more-->

## 課題: 開発環境が1台に閉じている

Claude Codeで開発していると「今のセッションをスマホから確認したい」「別のマシンから続きをやりたい」という場面がよくあります。

具体的にはこういう状況ですね。

- MacでClaude Codeを起動して作業中、外出先からAndroidで承認だけしたい
- WindowsマシンのWSLにGPUがあるのでそちらで重い処理を走らせたいが、操作はMacからやりたい
- ソファでAndroidから「この修正やっておいて」と指示だけ出したい

要するに「開発セッションをデバイスから切り離したい」わけです。Claude CodeはターミナルアプリなのでブラウザのようにURLでアクセスできません。SSH + tmuxでセッション永続化して、モバイルからはhappy-coderで操作する、というのが今回のアプローチです。

さて、この構成を実現するために必要なピースを見ていきましょう。

## 全体アーキテクチャ

最終的な構成はこうなっています。

```
┌─────────────┐     SSH (Tailscale)     ┌──────────────────────┐
│   Mac        │ ──────────────────────→ │   WSL (Windows)      │
│  Ghostty     │                         │  ┌─────────────────┐ │
│              │                         │  │ tmux session     │ │
└─────────────┘                         │  │  └─ Claude Code  │ │
                                         │  └─────────────────┘ │
┌─────────────┐   E2E encrypted relay    │  ┌─────────────────┐ │
│  Android     │ ◄──────────────────────→│  │ happy daemon     │ │
│  Happy App   │                         │  └─────────────────┘ │
└─────────────┘                         └──────────────────────┘
```

ポイントは3つです。

- MacからWSLへはSSH接続。Tailscale経由でLANを越えてもアクセスできます
- WSL上のtmuxでセッションを永続化。SSHが切れてもClaude Codeは走り続けます
- AndroidからはE2E暗号化されたリレーサーバー経由でClaude Codeを操作します

この構成の各パーツを順番に見ていきましょう。

## Ghostty: SSHに強いモダンターミナル

ターミナルエミュレータは[Ghostty](https://ghostty.org/)を使っています。HashiCorp創業者のMitchell HashimotoがZigで書いたGPUアクセラレーションターミナルですね。

Ghosttyを選んだ理由はSSH越しの開発に強いからです。具体的には以下の2点があります。

### OSC 52 クリップボード対応

OSC 52はターミナルのエスケープシーケンスで、リモートマシンのプログラムからローカルのシステムクリップボードにテキストをコピーできるプロトコルです。

これがあると何が嬉しいかというと、SSH先のtmuxでテキストを選択したときにMacのクリップボードにコピーされます。いちいち手動でコピペする必要がありません。GhosttyはOSC 52をネイティブでサポートしているので設定不要で動きます。

### terminfo の自動配布

SSH先にGhosttyのterminfoがないと `missing or unsuitable terminal: xterm-ghostty` というエラーが出ます。自分も最初ハマりました。

Ghostty 1.2.0からSSH統合機能が追加されていて、設定ファイルに以下を書くとSSH接続時にterminfoを自動でリモートに配布してくれます。

```
# ~/.config/ghostty/config
shell-integration-features = ssh-terminfo,ssh-env
```

`ssh-terminfo` がterminfo自動配布、`ssh-env` がTERMのフォールバック設定（terminfoのインストールに失敗したとき `xterm-256color` にフォールバックします）です。

手動でやる場合はMacからterminfoをエクスポートしてリモートに転送します。

```bash
# Mac側
TERMINFO=/Applications/Ghostty.app/Contents/Resources/terminfo \
  infocmp xterm-ghostty > /tmp/ghostty.terminfo
scp /tmp/ghostty.terminfo wsl:/tmp/

# WSL側
tic -x /tmp/ghostty.terminfo
```

これでリモートでも `xterm-ghostty` が使えるようになり、256色はもちろんイタリックやアンダーカールなどのモダンなテキスト装飾も正しく表示されます。

さて、ターミナルが整ったところでセッション永続化の話に移りましょう。

## tmux: セッション永続化とクリップボード連携

tmuxはターミナルマルチプレクサで、SSHが切断されてもセッションを維持してくれます。Claude Codeのように長時間動くプロセスを扱うときには必需品ですね。

### 基本設定

WSL上の `~/.tmux.conf` はこのようになっています。

```bash
# マウス操作を有効化（ペイン選択、リサイズ、スクロール、テキスト選択）
set -g mouse on

# OSC 52 クリップボード連携
set -g set-clipboard on

# モダンなターミナル設定
set -g default-terminal "tmux-256color"
set -ag terminal-overrides ",xterm-ghostty:RGB"
```

それぞれ解説します。

`set -g mouse on` でマウスが使えるようになります。これだけでペインのクリック選択、境界のドラッグリサイズ、スクロールホイール、テキスト選択が全部動きます。

`set -g set-clipboard on` がOSC 52連携です。tmuxのコピーモードでテキストをコピーすると、tmuxバッファに保存されると同時にOSC 52エスケープシーケンスが親ターミナル（Ghostty）にパススルーされて、Macのシステムクリップボードにコピーされます。SSHの先のtmuxの中で選択したテキストがCmd+Vで貼り付けられるのはこれのおかげです。

`default-terminal` は `tmux-256color` を指定します。昔は `screen-256color` を使うことが多かったですが、`tmux-256color` のほうがイタリック体やRGB色などのモダンな機能に対応しているので今はこちらが推奨です。

最後の `terminal-overrides` でGhosttyのRGBカラー（トゥルーカラー）を有効化しています。

### tmux-256color vs screen-256color

この2つの違いは地味に重要なので表にしておきます。

| 項目 | tmux-256color | screen-256color |
|---|---|---|
| イタリック体 | 対応 | 非対応 |
| キーバインド認識 | 多くのキーシーケンスを認識 | 一部非対応 |
| 可搬性 | 最新のncursesが必要 | 古い環境でも動く |
| 推奨度 | モダンな環境では推奨 | レガシー環境向け |

WSLやモダンなLinuxディストリビューションなら `tmux-256color` で問題ありません。古いCentOSなどでは `screen-256color` にフォールバックしてください。

### dev-tmuxスクリプト

WSLの開発セッション管理用にスクリプトを作りました。

```bash
#!/usr/bin/env bash
# ~/bin/dev-tmux: WSL開発環境のtmuxセッションを起動・管理する
set -euo pipefail

SESSION_DEV="dev"

start_session() {
  # happy daemonを起動（Android連携用）
  if command -v happy &>/dev/null; then
    happy daemon start 2>/dev/null || true
  fi
  # tmuxセッションを作成
  if ! tmux has-session -t "$SESSION_DEV" 2>/dev/null; then
    tmux new-session -d -s "$SESSION_DEV" -c "$HOME"
    echo "  [dev] started"
  else
    echo "  [dev] already running"
  fi
}

attach_session() {
  start_session
  tmux attach-session -t "$SESSION_DEV"
}

stop_session() {
  tmux kill-session -t "$SESSION_DEV" 2>/dev/null && echo "  [dev] stopped" || true
  if command -v happy &>/dev/null; then
    happy daemon stop 2>/dev/null || true
  fi
}

status() {
  echo "=== tmux ==="
  tmux ls 2>/dev/null || echo "  no sessions"
  echo "=== happy daemon ==="
  happy daemon status 2>/dev/null || echo "  not running"
}

case "${1:-start}" in
  start)   start_session ;;
  attach)  attach_session ;;
  stop)    stop_session ;;
  status)  status ;;
  *)       echo "Usage: dev-tmux {start|attach|stop|status}" ;;
esac
```

MacからSSHで呼び出す使い方はこうです。

```bash
# セッション開始（SSHしてアタッチ）
ssh wsl -t 'dev-tmux attach'

# ステータス確認だけ
ssh wsl 'dev-tmux status'
```

ここで1つハマりポイントがあります。WSLの `.bashrc` ではPATH設定が `# If not running interactively, don't do anything` の後に書かれていることが多いです。`ssh wsl 'dev-tmux status'` のような非インタラクティブ実行だとPATHが通らず `command not found` になります。対策は `.bashrc` のインタラクティブガードの前にPATHを追加することです。

```bash
# ~/.bashrc（先頭付近、case文の前に追加）
export PATH="$HOME/bin:$PATH"
```

ここまででMacからWSL上のClaude Codeに安定してアクセスできる環境ができました。次はAndroidからのアクセスです。

## happy-coder: スマホからClaude Codeを操る

[happy-coder](https://github.com/slopus/happy) はClaude Codeのモバイル・Webクライアントです。スマホのアプリからClaude Codeのセッションを操作できます。GitHubスター約5.7kのOSSプロジェクトです。

### インストールと接続

```bash
# WSL上でインストール
npm install -g happy-coder

# セッション開始（QRコードが表示される）
happy
```

初回は `happy auth login` で認証します。ターミナルにQRコードが表示されるので、AndroidのHappy Coderアプリでスキャンします。これでペアリング完了です。

### daemonモード

`happy` コマンドを直接叩くとフォアグラウンドで動きますが、daemonモードにするとバックグラウンドで常駐してくれます。

```bash
# daemon起動
happy daemon start

# ステータス確認
happy daemon status

# daemon停止
happy daemon stop
```

daemonが常駐していれば、Androidアプリを開くだけでWSL上のClaude Codeセッションにアクセスできます。tmuxの中で `happy` を動かす必要はなくて、daemonが独立してAndroidからの接続を待ち受けています。

実は `happy` コマンドを実行するだけでdaemonは自動起動します。明示的に `happy daemon start` しなくても裏で立ち上がってくれる親切設計ですね。

### 使い方

Androidアプリからできることはこういう感じです。

- Claude Codeへのメッセージ送信（テキスト入力、音声入力）
- ツール実行の承認・拒否（プッシュ通知でスマホに飛んでくる）
- セッションの切り替え（複数のClaude Codeセッションを管理）
- 作業ディレクトリの指定

外出中にプッシュ通知で「Bash実行の承認が必要です」と飛んでくるので、内容を確認してワンタップで承認。これが意外と便利で、Claude Codeに長い作業をさせつつ移動できる。

### セキュリティ: E2E暗号化の実装

happy-coderはE2E暗号化を実装していて、リレーサーバーはチャット内容を読めない設計になっています。実際にソースコードを監査して確認しました。

暗号化の仕組みはこうなっています。

1. QRコードでデバイス間の公開鍵を帯域外交換（Out-of-Band key exchange）
2. 鍵交換にはtweetnacl（Curve25519 + XSalsa20 + Poly1305）を使用
3. セッションデータはAES-256-GCM（認証付き暗号）で暗号化してから送信
4. リレーサーバーは暗号化されたバイナリをそのまま保存・転送するだけ

QRコードを物理的にスキャンするステップがあるので、ネットワーク上の中間者攻撃（MITM）にも耐性があります。SSH鍵のフィンガープリント確認に近い発想ですね。

認証情報は `~/.happy/agent.key` にJSON形式で保存されます。ファイルパーミッションは0600（所有者のみ読み書き）に設定されているので、マルチユーザー環境でも他のユーザーには読めません。

### セキュリティ: 注意すべき点

ソースコード監査でいくつか気になる点も見つかりました。

| リスク | 内容 |
|---|---|
| Critical | ベンダーAPIキー（OpenAI等）を登録する機能がE2Eではなく、サーバー側で暗号化保存される |
| High | ローカルDaemonのHTTPサーバー（127.0.0.1にバインド）に認証がない |
| High | `DANGEROUSLY_LOG_TO_SERVER_FOR_AI_AUTO_DEBUGGING` 環境変数でデバッグログをサーバー送信する機能が存在 |
| Critical | モバイルアプリから `permissionMode: 'yolo'` を送信でき、Claude Codeの権限承認をバイパスできる |
| High | `customSystemPrompt` / `appendSystemPrompt` がサニタイズなしでClaude CLIに渡される |

とくに権限操作（permissionMode）の問題は設計上の懸念です。モバイルデバイスが侵害された場合、攻撃者がClaude Codeの安全機能をバイパスして任意のコマンドを実行できる可能性があります。

ただし現実的なリスク評価としては以下を考慮する必要があります。

- 攻撃にはペアリング済みのモバイル端末の侵害が前提です（E2E暗号化されているのでネットワーク傍受では攻撃できません）
- リレーサーバーからの制御メッセージ改竄も不可能です（metaフィールドも暗号化ペイロードに含まれています）
- 個人の開発用途で自分のスマホを管理できていれば実質的なリスクは低いです

対策としては以下をおすすめします。

- ベンダーAPIキー登録機能（`happy connect`）は使わないでください。APIキーはローカルの環境変数で管理しましょう
- Androidの端末セキュリティを維持してください（画面ロック、不審なアプリを入れない）
- happy-coderのサーバーをセルフホストしたいなら[Happy Server](https://github.com/slopus/happy)がOSSで公開されています

さて、happy-coderの代替ツールも紹介しておきましょう。

## 代替ツール: hapi

[hapi](https://github.com/tiann/hapi) はhappy-coderの代替として開発されているOSSプロジェクトで、GitHubスター約1.5kです。設計思想が異なるので比較してみましょう。

| 項目 | happy-coder | hapi |
|---|---|---|
| 設計思想 | クラウドホスト・マルチユーザー | ローカルファースト・シングルユーザー |
| 通信の暗号化 | E2E暗号化（リレーサーバー経由） | WireGuard + TLS（直接接続） |
| セキュリティモデル | 信頼できないサーバー前提 | サーバーを自分で管理する前提 |
| デプロイの手軽さ | npmインストール + アプリでQRスキャン | ワンコマンドだがネットワーク設定が必要 |
| 対応AI | Claude Code, Codex, Gemini CLI | Claude Code, Codex, Gemini, OpenCode |
| ライセンス | MIT | AGPL-3.0 |

hapiの特徴はWireGuardベースの直接接続です。リレーサーバーを経由せず、デバイス間でダイレクトにつなぎます。Tailscaleを使っている環境ならハブとして組み合わせることもできます。

一方でhappy-coderのほうがカジュアルに使い始めやすいです。npmでインストールしてQRスキャンするだけで動きます。リレーサーバーに依存しますが、E2E暗号化されているのでサーバーが内容を読めません。

自分はTailscaleを使っているのでhapiとの相性もよさそうですが、今のところhappy-coderで不便がないのでこちらを使い続けています。ネットワーク設定をいじりたくない人にはhappy-coderのほうが手軽でしょう。

## 実践: 実際の開発フロー

ここまでのツールを組み合わせた具体的な開発フローを紹介します。

### Macから開発する場合

```bash
# 1. WSLにSSH接続してtmuxセッションにアタッチ
ssh wsl -t 'dev-tmux attach'

# 2. tmux内でClaude Codeを起動
claude

# 3. 作業が終わったらtmuxをデタッチ（Ctrl+B, D）
# Claude Codeはバックグラウンドで動き続ける

# 4. 後から戻ってきて再アタッチ
ssh wsl -t 'tmux attach -t dev'
```

tmuxのペイン分割を使えば複数のClaude Codeセッションを同時に走らせることもできます。

```bash
# tmux内でペインを水平分割
# Ctrl+B, "

# 新しいペインで別ディレクトリのClaude Codeを起動
cd ~/src/github.com/nyosegawa/another-project
claude
```

### Androidから操作する場合

```
1. Happy Coderアプリを開く
2. WSL上のhappy daemonが自動検出される
3. セッション一覧から操作したいClaude Codeセッションを選択
4. メッセージを送信 or ツール承認
```

よくあるユースケースは「Macで大きなリファクタリングを開始 → 外出 → Androidで進捗確認と承認 → 帰宅後Macから結果確認」という流れです。Claude Codeがツール実行の承認を求めるとプッシュ通知が飛んでくるので、移動中でも作業が止まりません。

### セッション管理のTips

Claude Codeには `--resume` オプションがあるので、中断したセッションを再開できます。

```bash
# 直前のセッションを再開
claude --continue

# 特定のセッションIDで再開
claude --resume <session-id>

# セッション一覧から選択
claude --resume
```

tmuxのセッション永続化とClaude Codeのセッション再開を組み合わせると、SSH接続が切れてもClaude Codeのコンテキストが失われません。

### WSLで開発する理由

「なぜローカルのMacでClaude Codeを動かさないのか」という疑問があるかもしれません。理由は2つあります。

1つ目はGPUです。WindowsマシンにはNVIDIA GPUが載っていて、ローカルLLMやCUDA系のツールを動かすときにWSL経由でGPUを使いたいのです。

2つ目はセッション永続化です。MacのClaude Codeはターミナルを閉じたら終わりますが、WSL上のtmuxなら常に動き続けます。Macをスリープさせてもセッションは生きています。happy daemonもWSL上で常駐しているので、Androidからいつでもアクセスできます。

## Ghostty + tmuxの設定まとめ

最後に設定ファイルをまとめておきます。コピペで使えるように。

### Mac側: Ghosttyの設定

```
# ~/.config/ghostty/config
shell-integration-features = ssh-terminfo,ssh-env
```

### WSL側: tmuxの設定

```bash
# ~/.tmux.conf
set -g mouse on
set -g set-clipboard on
set -g default-terminal "tmux-256color"
set -ag terminal-overrides ",xterm-ghostty:RGB"
```

### WSL側: .bashrcのPATH設定

```bash
# ~/.bashrc（インタラクティブガードの前に追加）
export PATH="$HOME/bin:$PATH"

# If not running interactively, don't do anything
case $- in
    *i*) ;;
      *) return;;
esac
```

### WSL側: happy-coderのセットアップ

```bash
# Node.jsのインストール（fnm推奨）
curl -fsSL https://fnm.vercel.app/install | bash
fnm install --lts

# happy-coderのインストール
npm install -g happy-coder

# 認証
happy auth login

# daemon起動（以降自動起動する）
happy daemon start
```

## まとめ

- Ghostty + tmux + OSC 52 の組み合わせで、SSH越しのクリップボード共有を含むモダンなリモート開発体験が得られます
- happy-coderのE2E暗号化は適切に実装されていますが、APIキー登録機能とpermissionMode操作は設計上の懸念があります。個人利用なら端末管理で十分カバーできます
- 代替のhapiはWireGuardベースで直接接続する設計です。Tailscaleユーザーには特に相性がいいです

## Appendix: happy-coderのセキュリティ監査詳細

本編で触れたセキュリティ上の知見の詳細です。[Gemini 3 Pro](https://deepmind.google/technologies/gemini/)を使ったソースコード全量分析の結果に基づいています。

### E2E暗号化の実装

- 鍵交換: tweetnacl.box（Curve25519 + XSalsa20 + Poly1305）
- データ暗号化: AES-256-GCM（認証付き暗号）
- 鍵交換はQRコード経由の帯域外交換。ネットワーク盗聴での鍵窃取は不可能
- メタデータ（permissionMode, appendSystemPrompt等）もE2Eペイロードに含まれるため、リレーサーバーからの改竄は不可能

### ローカルDaemonの設計

- `127.0.0.1` にバインド（外部ネットワークからはアクセス不可）
- HTTPサーバーに認証なし。同一マシンの他プロセスから `http://127.0.0.1:<port>/spawn-session` で任意ディレクトリにセッション作成可能
- 個人のWSL環境なら実質リスクは低いが、共有マシンでは注意が必要

### インストラクション・インジェクション

- `customSystemPrompt` / `appendSystemPrompt`: モバイルからのメッセージのmetaフィールドに含めると、サニタイズなしでClaude CLIの `--system-prompt` / `--append-system-prompt` 引数に渡される
- `permissionMode`: `'yolo'` を送信すると `--permission-mode bypassPermissions` に変換され、ツール実行時のユーザー承認がスキップされる
- MCPサーバーのインジェクションはできない（metaフィールドからmcpServersを設定するロジックは存在しない）
- Unixシステムでは `spawn` が配列渡しなのでシェルインジェクションは起きない（Windows環境では `shell: true` が使われる箇所があり注意）

### 認証情報の保存

- 保存先: `~/.happy/agent.key`（JSON形式）
- ディレクトリ: パーミッション0700
- ファイル: パーミッション0600
- 秘密鍵はBase64エンコードだが暗号化はされていない（SSH秘密鍵と同じモデル）

## References

- Ghostty
    - [Ghostty公式サイト](https://ghostty.org/)
    - [Ghostty GitHub](https://github.com/ghostty-org/ghostty)
    - [1.2.0リリースノート（SSH統合）](https://ghostty.org/docs/install/release-notes/1-2-0)
    - [Terminfoドキュメント](https://ghostty.org/docs/help/terminfo)
- tmux
    - [tmux GitHub](https://github.com/tmux/tmux)
    - [tmux Clipboard Wiki](https://github.com/tmux/tmux/wiki/Clipboard)
    - [tmux FAQ](https://github.com/tmux/tmux/wiki/FAQ)
- happy-coder
    - [happy-coder GitHub](https://github.com/slopus/happy)
    - [Happy Coder公式サイト](https://happy.engineering/)
- hapi
    - [hapi GitHub](https://github.com/tiann/hapi)
- Claude Code
    - [Claude Code公式ドキュメント](https://code.claude.com/docs/en/headless)
    - [Claude Agent SDK](https://platform.claude.com/docs/en/agent-sdk/overview)
    - [Claude Code GitHub](https://github.com/anthropics/claude-code)
- ネットワーク
    - [Tailscale](https://tailscale.com/)
