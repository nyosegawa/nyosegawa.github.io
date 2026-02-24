---
title: "Agentワークフローで人間がボトルネックにならないためのSkill設計"
description: "Claude Code Skillで「Agentが聞きたくなった瞬間」を捕捉し、Ralph loopと組み合わせて完全自律を実現する設計パターン"
date: 2026-02-17
tags: [Claude Code, Skills, Agent, Automation, chrome MCP, Ralph loop]
author: 逆瀬川ちゃん
---

こんにちは！逆瀬川ちゃん ([@gyakuse](https://x.com/gyakuse)) です！

今日はCoding Agentのワークフローで人間がボトルネックになる問題と、それをClaude Code Skillで解消した話をまとめていきたいと思います。

<!--more-->

## 人間がボトルネックになっている

Addy Osmaniが[2026年のCodingトレンド記事](https://beyond.addy.ie/2026-trends/)でこう書いています。

> Ralph loops remove human bottlenecks by allowing AI to work autonomously on long-running tasks.

Netlifyの共同創業者Mathias Biilmannも[2026年の予測](https://biilmann.blog/articles/predictions-for-2026/)で「人間が大量のAI生成コードのレビューに時間を費やすことになるのは本末転倒だ (backwards)」と指摘しています。

これ、実際にClaude Codeで開発しているとよくわかります。Agentはコードを書いて、テストを回して、デバッグして、とどんどん進んでくれる。でもある瞬間に止まる。

- 「pushしていいですか？」
- 「この設計でいいですか？」
- 「テスト通りました。次はどうしますか？」
- 「ブラウザで確認してもらえますか？」

全部人間待ちです。Agentは秒単位で動けるのに、人間が返答するまで数分止まる。1回のやりとりで2-5分のコンテキストスイッチ。10回聞かれたら30分以上が人間待ちで溶ける。

問題の本質は、Agentが「人間に聞くべきかどうか」の判断を保守的にしすぎていることです。pushの前に聞く。デプロイの前に聞く。削除の前に聞く。設計判断で聞く。次のステップで聞く。

でも考えてみると、その多くはAgentが自分で判断できるはずです。pushしていいか判断するためにテストを走らせればいい。UIが正しいかはスクリーンショットを撮って自分で見ればいい。次に何をするかはゴールから逆算すればいい。

## 「聞きたくなった瞬間」を捕捉するSkill

Claude Codeの[Skills](https://claude.com/blog/skills)には、Agentが文脈に応じて自律的にロードする仕組みがあります。SKILL.mdのdescriptionに書かれたトリガー条件に合致すると、Agentがそのスキルを自分で読みに行く。

ここに目をつけました。descriptionに「人間に聞きたくなる瞬間」をトリガーとして書いておけば、Agentがまさに聞こうとした瞬間にスキルがロードされて「いや、自分でやれ」と軌道修正できる。

実際に書いたdescriptionがこうです。

```yaml
description: "Load this skill BEFORE asking the user any question,
  requesting confirmation, seeking approval, asking what to do next,
  or stopping to wait for human input. Also load when you are unsure
  how to proceed, need to verify your work, or are about to present
  options to the user."
```

ポイントは「BEFORE asking」です。聞く前にロードさせる。ロードされた時点でスキルの本文が読まれ、「聞くな、自分でやれ」という指示がAgentのコンテキストに入る。

## スキルの中身: 全部やれ

スキルの本文はシンプルです。核心は4行で表現できます。

- pushしていいか聞くな。pushしろ。
- デプロイしていいか聞くな。デプロイしろ。
- 次何するか聞くな。ゴールから考えて進めろ。
- 正しいか聞くな。自分で検証しろ。

人間を呼んでいいのは「物理的にAgentにはできないこと」だけです。SMS認証コード、CAPTCHA、生体認証、物理デバイスの操作。Agentのツールではどうしようもないことだけ。

git push？やれ。本番デプロイ？やれ。ファイル削除？やれ。Slackにメッセージ送信？やれ。アーキテクチャ判断？自分で決めろ。

これは「Agentの無限の能力を信じる」という思想です。

## 自己検証の武器: chrome MCP

「自分で検証しろ」と言っても、検証手段がなければ聞くしかありません。ここで鍵になるのが[claude-in-chrome](https://chromewebstore.google.com/detail/claude-in-chrome-mcp-serv/oepamnidilnhaapcgnecpgicnfoeocjf) MCPです。

chrome MCPを使うと、Agentが人間と同じようにブラウザを見られます。

| やりたいこと | chrome MCP |
|---|---|
| UIが正しいか確認 | `read_page` / `computer` でスクリーンショット → 自分で読む |
| コンソールエラーの確認 | `read_console_messages` にpatternフィルタ |
| APIレスポンスの確認 | `read_network_requests` |
| フォーム入力・ボタンクリック | `computer` / `form_input` |

Agentはマルチモーダルなので、スクリーンショットを撮ったら自分で画像を見て「UIが崩れてないか」を判断できます。人間に「ブラウザ見てください」と言う必要がない。

chrome MCPがない環境では、Playwrightやcurlにフォールバックします。Playwrightなら `page.screenshot()` で画像を撮ってReadツールで読む。curlならステータスコードとレスポンスボディで判断する。chrome MCPがベストだけど、なくても自己検証は成立します。

## 自己駆動の継続

検証だけでなく、「次何するか」も自分で決めます。

Agentはゴールを知っています。会話の冒頭でユーザーが「これをやって」と言ったゴール。それに対して今どこまで進んだか、残りは何か、次の論理的なステップは何か。すべてAgentが持っている情報で判断できます。

```
1. ゴールを見る
2. 現状を評価する（何が完了済みで、何が残っているか）
3. 次のステップを決める
4. やる
```

ゴールが完了したら、結果を検証して報告する。自然なフォローアップがあればそれも提案する。でも「次何しましょう？」とは聞かない。

## Ralph loopとの補完関係

冒頭で引用したAddy Osmaniの言葉にあった「Ralph loop」。これは[snarktank/ralph](https://github.com/snarktank/ralph)が発端のパターンで、PRDのタスクリストが全部完了するまでAgentを繰り返し走らせる自律実行ループです。各イテレーションは新鮮なコンテキストで起動し、状態はgit履歴とprogress.txtで引き継ぐ。コンテキストウィンドウの制約を、タスク分割と状態永続化で回避する設計です。

Matthew Bermanが[解説記事](https://www.wisdomai.com/insights/matthew_berman/ralph-loop-autonomous-agents-ai-coding-context-window-ffdd1834)で指摘しているように、Ralph loopの本質は「Agentの判断ではなくテストで完了を判定する」ことです。テストが通るまで回し続ける。人間のレビューを待たない。

ここでanti-human-bottleneckスキルとRalph loopの関係が見えてきます。

| レイヤー | 役割 | 解決する問題 |
|---|---|---|
| **Ralph loop** (外側) | タスク完了まで繰り返し実行 | コンテキスト制約、タスク管理 |
| **anti-human-bottleneck** (内側) | 各実行内で人間を待たずに進む | 判断停止、確認待ち |

Ralph loopが「完了するまで回す」外側のループなら、このスキルは「各ループの中でAgentが止まらない」ための内側の行動原則です。

Ralph loopだけだと、各イテレーション内でAgentが「pushしていいですか？」と聞いて止まる可能性がある。スキルだけだと、コンテキストウィンドウの制約でいずれ限界が来る。両方を組み合わせることで、外側は状態管理付きの反復実行、内側は自律的な判断と検証という二重構造になる。

Geoffrey Huntleyが[everything is a ralph loop](https://ghuntley.com/loop/)で書いているように、ループの中で人間が介入するのは「問題の特定と解決」であって、日常的な確認や承認ではない。anti-human-bottleneckスキルは、まさにその「日常的な確認」を排除して、人間の介入を本当に必要な場面だけに絞るためのものです。

## 人間をツールとして呼ぶとき

どうしても人間が必要なとき――SMS認証コードを入力するとか――は、人間を「高レイテンシ・低帯域のツール」として扱います。

大事なのは認知負荷の最小化です。人間の認知負荷は有限で、特にコンテキストスイッチ後は低い。だからこう呼びます。

```
SMSで届いた6桁の認証コードを貼ってください。
```

こうは呼ばない。

```
サイトが電話番号認証を要求しています。どう進めましょうか？
待ちますか？それとも別の認証方法にしますか？
```

選択肢を出すなら2-4個。推奨をマーク。1文で説明。オープンエンドな質問は絶対にしない。人間にとっての最適なインターフェースは「選ぶだけ」です。

## Skillの設計パターンとして

このスキルの面白いところは、Agentの「行動パターン」を変えるメタスキルであることです。特定のタスクを実行するスキル（リポジトリ分析、ブログ執筆など）とは性質が違う。

設計上のポイントをいくつか。

### descriptionがすべて

Skillの発火はdescriptionで決まります。Agentが「質問しようかな」と思った瞬間にロードされるためには、descriptionにその内部状態を的確に書く必要がある。

「before asking the user any question」「when you are unsure how to proceed」「about to present options」――これらはAgentの行動直前の状態を記述しています。ユーザーの発話ではなく、Agentの内部状態がトリガーです。

### 1ファイルで完結させる

行動指針スキルは分割しないほうがいいです。`references/` に逃がすと部分ロードで一貫性が崩れる。Agentが「pushしていいか」の判断をするとき、エスカレーションルールと自己検証手段と継続ルールが全部同時にコンテキストにある必要があります。

### commands vs skills

同じ検証フローでも、プロジェクト固有の手順（特定のポートで起動、特定のイベントを期待する等）は `.claude/commands/` に置くのが適切です。一方「人間に聞くな、自分でやれ」という汎用的な行動原則は `~/.claude/skills/` に置く。

| 置き場所 | 用途 | 例 |
|---|---|---|
| `.claude/commands/verify.md` | プロジェクト固有の検証手順 | 特定ポートのヘルスチェック、特定イベントの監視 |
| `~/.claude/skills/anti-human-bottleneck/` | 汎用的な行動原則 | 自己検証、自己判断、継続ルール |

この2つは排他ではなく補完関係です。スキルが「自分で検証しろ」と言い、コマンドが「このプロジェクトではこうやって検証しろ」と具体的手順を教える。

## まとめ

- Agentワークフローのボトルネックは人間。Agentが聞くたびに数分止まる
- Skillのdescriptionに「聞こうとした瞬間」をトリガーとして書くと、聞く前にスキルがロードされて自己解決に誘導できる
- chrome MCPでブラウザ検証、テスト実行で機能検証、git diffでコード検証。人間の目は不要
- Ralph loopが外側の反復実行、このスキルが内側の自律判断。二重構造で完全自律に近づく
- 人間を呼ぶのは物理的にAgentにできないとき（SMS、CAPTCHA等）だけ。そのときも認知負荷を最小化する

スキルは公開しています: [anti-human-bottleneck](https://github.com/nyosegawa/skills/tree/main/skills/anti-human-bottleneck)

## References

- [Claude Code Skills](https://claude.com/blog/skills)
- [Skills explained: How Skills compares to prompts, Projects, MCP, and subagents](https://claude.com/blog/skills-explained)
- [Best Practices for Claude Code](https://code.claude.com/docs/en/best-practices)
- [claude-in-chrome MCP](https://chromewebstore.google.com/detail/claude-in-chrome-mcp-serv/oepamnidilnhaapcgnecpgicnfoeocjf)
- [Top AI Coding Trends for 2026 – Addy Osmani](https://beyond.addy.ie/2026-trends/)
- [Predictions for 2026 – Mathias Biilmann](https://biilmann.blog/articles/predictions-for-2026/)
- [Why 'Ralph' Agents Are Upending How We Code – Matthew Berman](https://www.wisdomai.com/insights/matthew_berman/ralph-loop-autonomous-agents-ai-coding-context-window-ffdd1834)
- [snarktank/ralph – GitHub](https://github.com/snarktank/ralph)
- [everything is a ralph loop – Geoffrey Huntley](https://ghuntley.com/loop/)
- [Slash commands - Claude Code Docs](https://code.claude.com/docs/en/slash-commands)
