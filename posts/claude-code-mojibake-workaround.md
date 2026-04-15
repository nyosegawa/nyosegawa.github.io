---
title: "【解決済？】Claude Codeの文字化け問題の簡易的対応方法"
description: "Claude CodeのWrite/Editで日本語が文字化け(U+FFFD)する問題に対して、hooksで暫定的に防ぐ方法を紹介します"
date: 2026-04-07
tags: [Claude Code, Unicode, Claude Code Hooks, 文字化け]
author: 逆瀬川ちゃん
lang: ja
---

こんにちは！逆瀬川ちゃん ([@gyakuse](https://x.com/gyakuse)) です！

今日はClaude Codeの最新バージョンで日本語を書いていると発生する文字化け問題と、hooksを使った簡易的な対応方法についてまとめていきたいと思います。

**2026-04-08 追記**: Claude Code v2.1.94で本問題が修正されたとの[Changelog](https://code.claude.com/docs/en/changelog#2-1-94)が出ましたが、[完全には治っていないという報告](https://x.com/o_sio/status/2041695321802338495)もあります。引き続きhook対策を入れておくのがおすすめです。また、hookを`PreToolUse`から`PostToolUse`に戻しました。PostToolUseのほうが書き込み済みの壊れた箇所だけを修復すればよく、修復のためのtokenコストが小さいためです。

<!--more-->

## 起きていること

Claude Codeで日本語を含むコードやドキュメントを書いていると、`Write`や`Edit`ツールでファイルに書き込まれた内容に `�`（U+FFFD、Unicode Replacement Character）が混入することがあります。

具体的にはこんな感じです。

- `タスクワー��ー` ← 「タスクワーカー」のはず
- `プラ���トフォーム` ← 「プラットフォーム」のはず
- `ア��セス` ← 「アクセス」のはず

マルチバイト文字のバイト列が途中でちぎれて、壊れた部分がReplacement Characterに置き換わっています。CJK文字（日本語・中国語・韓国語）で特に起きやすいです。

原因はClaude Code内部のSSEストリーミングデコーダーにあると考えられています。Anthropic SDKの`TextDecoder.decode()`が`{ stream: true }`なしで呼ばれているため、SSEチャンク境界でマルチバイト文字のバイト列がちぎれると、不完全なバイトがU+FFFDに置き換わります。[GitHub Issue #43746](https://github.com/anthropics/claude-code/issues/43746)で根本原因の特定と再現コードの報告がされています。

ユーザー側の設定で根本的に防ぐことはできません；；

とはいえ、修正が来るまでの間に成果物が壊れるのは困るのでClaude Codeのhooks機能を使って書き込み直後にU+FFFDを検出したら弾くという暫定対策を入れてみます。

## hooksで文字化けを弾く

Claude Codeにはhooksという仕組みがあって、ツール実行の前後にシェルスクリプトを差し込めます。今回は`PostToolUse`フックを使って、`Write`/`Edit`/`MultiEdit`がファイルに書き込んだ**後に**ファイル内容をチェックし、U+FFFDが含まれていたらClaudeに修復を促します。

### なぜPostToolUseなのか

`PreToolUse`（書き込み前に阻止）と`PostToolUse`（書き込み後に検出）のどちらでも対策できますが、`PostToolUse`のほうが**修復のためのtokenコストが小さい**です。PreToolUseで阻止すると、Claudeはファイル全体を書き直そうとしますが、PostToolUseなら書き込み済みの壊れた箇所だけをEditで修復すればよいためです。

### hookスクリプトを用意する

まずスクリプトを作ります。

```bash
#!/bin/bash
# ~/.claude/hooks/check-mojibake.sh
# PostToolUse: Write/Edit/MultiEdit で書き込まれたファイルにU+FFFDが含まれていたら修復を促す

INPUT=$(cat)

# tool_input から対象ファイルパスを取得
FILE_PATH=$(echo "$INPUT" | jq -r '.tool_input.file_path')

if [ -f "$FILE_PATH" ] && grep -q $'\xef\xbf\xbd' "$FILE_PATH"; then
  echo "U+FFFD detected in $FILE_PATH. Fix the corrupted characters." >&2
  grep -n $'\xef\xbf\xbd' "$FILE_PATH" | head -5 >&2
  exit 2
fi
```

ポイントは`exit 2`です。Claude Codeのhooksでは終了コード2が失敗として扱い、stderrの内容をClaudeにフィードバックするという意味になります。PostToolUseで`exit 2`を返すと、Claudeは壊れた箇所を検出して正しい文字にEditで修復しようとしてくれます。

`$'\xef\xbf\xbd'`はU+FFFDのUTF-8バイト列です。grepでこれを検出しています。`jq`でtool inputから`file_path`を取り出し、書き込み後の実ファイルを直接チェックしています。

### settings.jsonに登録する

`~/.claude/settings.json`にhookを登録します。

```json
{
  "hooks": {
    "PostToolUse": [
      {
        "matcher": "Write|Edit|MultiEdit",
        "hooks": [
          {
            "type": "command",
            "command": "bash ~/.claude/hooks/check-mojibake.sh"
          }
        ]
      }
    ]
  }
}
```

`matcher`に`Write|Edit|MultiEdit`を指定することで、ファイル書き込み系のツールすべてに対してhookが走ります。

### セットアップ手順まとめ

コピペで使えるようにしておきます。

```bash
# ディレクトリ作成
mkdir -p ~/.claude/hooks

# hookスクリプトを作成
cat << 'SCRIPT' > ~/.claude/hooks/check-mojibake.sh
#!/bin/bash
# PostToolUse: Write/Edit/MultiEdit で書き込まれたファイルにU+FFFDが含まれていたら修復を促す

INPUT=$(cat)

# tool_input から対象ファイルパスを取得
FILE_PATH=$(echo "$INPUT" | jq -r '.tool_input.file_path')

if [ -f "$FILE_PATH" ] && grep -q $'\xef\xbf\xbd' "$FILE_PATH"; then
  echo "U+FFFD detected in $FILE_PATH. Fix the corrupted characters." >&2
  grep -n $'\xef\xbf\xbd' "$FILE_PATH" | head -5 >&2
  exit 2
fi
SCRIPT

chmod +x ~/.claude/hooks/check-mojibake.sh
```

settings.jsonは既存の設定があればそこに`hooks`キーを追加してください。

## この対策でカバーできること・できないこと

この方法はあくまで暫定的なものです。カバー範囲を理解しておきましょう。

| ケース | カバーできるか |
|---|---|
| Write/Edit/MultiEditでファイルに書かれた文字化け | できる |
| Claudeの応答テキスト自体の文字化け | できない |
| 外部検索結果やOCR結果に含まれるU+FFFD | できない |
| 既に壊れた既存ファイルを読むだけのケース | できない |

ファイル書き込み経路の文字化けは実ファイルを壊してしまうので最もダメージが大きいです。この対策はそこをピンポイントで防ぎます。一方、Claudeの応答テキスト自体が壊れるケース（「でき��した」のような表示崩れ）はhookでは防げません。

## アップデートを待つ

今回の対策は一時的な回避策です。根本原因はAnthropic SDKのSSEデコーダーにある`TextDecoder`の`{ stream: true }`欠落で、ユーザー側で完全に防ぐことはできません。

[GitHub Issue #43746](https://github.com/anthropics/claude-code/issues/43746)で根本原因の特定・再現手順・修正パッチの提案まで報告されています。同じ問題に遭遇している方はissueにリアクションを付けましょう。。関連issueとして[#44463](https://github.com/anthropics/claude-code/issues/44463)や[#43858](https://github.com/anthropics/claude-code/issues/43858)にも報告が集まっています。

hookによる対策はそれまでの間、Write等が壊れるのを防ぐためのものだと思ってください。

## まとめ

- Claude Codeの`Write`/`Edit`で日本語が文字化けする問題は、`PostToolUse` hookでU+FFFDを検出して修復を促すことで暫定的に防げます
- ただし応答テキスト自体の文字化けなどhookではカバーできないケースもあります
- 根本的にはClaude Codeのアップデートでの修正を待ちましょう（[#43746](https://github.com/anthropics/claude-code/issues/43746)で原因特定・修正提案済み）

## References

- Claude Code
    - [Claude Code Hooks ドキュメント](https://docs.anthropic.com/en/docs/claude-code/hooks)
    - [Claude Code GitHub](https://github.com/anthropics/claude-code)
- 関連Issue
    - [#43746 Silent U+FFFD corruption in CJK model output due to TextDecoder missing `{ stream: true }` in SSE line decoder](https://github.com/anthropics/claude-code/issues/43746)
    - [#44463 Japanese characters occasionally corrupted in output (file writes and terminal)](https://github.com/anthropics/claude-code/issues/44463)
    - [#43858 Japanese (CJK) characters occasionally corrupted in model output (mojibake)](https://github.com/anthropics/claude-code/issues/43858)
    - [#40396 Korean (CJK) characters corrupted to U+FFFD in Claude Code responses](https://github.com/anthropics/claude-code/issues/40396)
