---
title: "Claude CodeのSkillでLinearタスク管理を自動化した話"
description: "Claude Code SkillとLinear MCPを組み合わせて、コーディング中に自然言語でタスクのCRUD操作ができる環境を作った。設計と実装のハマりどころをまとめる。"
date: 2026-02-12
tags: [Claude Code, MCP, Linear, Skills, Task Management]
author: 逆瀬川ちゃん
---

こんにちは！逆瀬川ちゃん ([@gyakuse](https://x.com/gyakuse)) です！

今日はClaude CodeのSkillとLinear MCPを組み合わせて「コーディング中にタスク管理もやってもらう」環境を作った話をまとめていきたいと思います。

<!--more-->

## なぜCoding Agentにタスク管理をさせるのか

個人開発で複数のプロジェクトを並行していると、タスク管理が地味にだるいです。Linearを開いて、プロジェクトを選んで、Issueを作って、ステータスを変えて……。1つ1つは小さい作業なんですが、コードを書いている最中にコンテキストスイッチが発生するのが嫌。

じゃあClaude Codeにやらせればいいじゃん、という話です。

Claude Codeには[MCP (Model Context Protocol)](https://modelcontextprotocol.io) という仕組みがあって、外部サービスのAPIをツールとして呼び出せます。LinearにもMCPサーバーがあるので、Claude CodeからLinearのIssueを直接操作できる。ただMCPはあくまでツール（包丁とかフライパン）を提供するだけで、どう使うかは毎回自分で指示する必要があります。

ここで[Skills](https://claude.com/blog/skills)の出番です。Skillはレシピみたいなもので、「このツールをこの手順で使え」という知識をパッケージ化できます。MCPが「何ができるか」を提供し、Skillが「どうやるか」を教える。この組み合わせが強い。

さて、このMCP + Skillの関係を踏まえて、実際にタスク管理スキルを設計していきましょう。

## スキルの設計

### 作業ディレクトリからプロジェクトを自動判定する

一番こだわったのがこの部分です。複数プロジェクトを扱っているので「タスク作って」と言ったときに、どのプロジェクトに作るかを自動で判定してほしい。

やり方はシンプルで、作業ディレクトリとLinearのプロジェクトをマッピングするテーブルをスキルに埋め込みます。

```markdown
| 作業ディレクトリ | プロジェクト | Project UUID |
|---|---|---|
| `/path/to/project-a` | Project A | `uuid-aaa...` |
| `/path/to/project-b` | Project B | `uuid-bbb...` |
```

Claude Codeは起動時に作業ディレクトリの情報を持っているので、この対応表と突き合わせるだけで判定できます。

ただし作業ディレクトリだけでは判定できないケースもあります。たとえばこのスキルリポジトリ自体で作業しているときは、どのプロジェクトの話をしているのかわからない。そこでコンテキストベースの推定判定も入れました。

```markdown
| キーワード・文脈 | プロジェクト |
|---|---|
| ブログ、記事、SNS | Blog/SNS プロジェクト |
| 作業効率化、ツール改善 | Optimizer プロジェクト |
```

会話の文脈からキーワードを拾ってプロジェクトを推定する。それでも判定できなければユーザーに聞く。この3段階のフォールバックが効いています。

### 固定パラメータをハードコードする

MCP連携スキルを作るときに大事なのが、テスト済みの値をスキルにハードコードしてしまうことです。

自分の場合はLinearのワークスペースにチームが1つしかないので、チーム名は固定です。ステータス名も事前に `list_issue_statuses` で確認して、文字列でそのまま渡せることを検証済み。こういう情報をスキルに書いておくと、毎回チーム一覧を取得するAPIコールが不要になります。

```markdown
## 固定パラメータ（テスト済み）
- チーム: `Sakasegawa` — 常にこれを使う
- ステータス名: 文字列でそのまま渡せる（UUID不要）
  - Backlog / Todo / In Progress / In Review / Done / Canceled
```

### ルールを明確にする

スキルには「やっていいこと」と「やってはいけないこと」を明確に書きます。

- 常に自分にアサインする
- 削除は絶対にしない。完了のみ
- タスクの整理（タイトル変更、ラベル付け等）は自由にやっていい

特に「削除禁止」は重要です。Agentに破壊的な操作をさせたくないので、明示的に禁止しています。逆にタスクの整理はどんどんやってほしいので自由にしている。この粒度の制御がSkillの良いところですね。

## Linear MCP APIのハマりどころ

実際に作ってみると、Linear MCPにはいくつかハマりポイントがありました。これは事前にドキュメントを読むだけではわからなかったやつです。

### UUIDと表示キーとスラッグ、3つのIDがある

Linearには同じリソースに対して3種類の識別子があります。

| 種類 | 例 | 用途 |
|---|---|---|
| UUID | `a1b2c3d4-5678-90ab-cdef-1234567890ab` | API操作の主キー |
| 表示キー | `ENG-123` | 人間が読むID |
| スラッグ | `my-project-a1b2c3d4` | URLの末尾 |

で、MCPのAPIによって受け付けるIDが違います。

- `get_issue`: 表示キーでもUUIDでも動く
- `update_issue`: UUIDじゃないとエラーになることがある
- `list_issues` のprojectフィルタ: Project UUIDを使うのが確実

最初スラッグ（URLの末尾の文字列）をProject IDだと思って渡していたんですが、これはUUIDとは別物でした。`list_projects` で実際のUUIDを取得して、それをスキルにハードコードするのが正解です。

### descriptionの改行はリテラル `\n` ではダメ

Issueのdescriptionに改行を入れるとき、文字列として `\n` を渡してもLinear側で改行にならないことがあります。実際の改行文字を使う必要がある。地味だけどハマるポイントです。

### 折りたたみはLinear独自記法

HTMLの `<details>/<summary>` は使えません。Linearは `>>>` という独自記法で折りたたみを実現しています。Markdownに慣れていると見落としがちです。

これらの知見は全部スキルの `references/` ディレクトリに知見メモとして残しておきました。Progressive Disclosureの考え方で、SKILL.md本体には要点だけ書いて詳細はreferenceに逃がしています。

## 実際の使い心地

スキルができあがると、こんな感じでタスク管理ができます。

コーディング中に「このバグ修正のタスク作っておいて」と言うだけで、作業ディレクトリからプロジェクトを自動判定して、自分にアサインされたIssueがLinearに作成される。ステータスをIn Progressにするかも聞いてくれる。

「今のタスク見せて」でプロジェクトのIssue一覧が出てくるし、「SAK-42完了にして」で Done になる。

地味に嬉しいのが、タスクの整理もやってくれるところです。「このIssueのタイトルもうちょっとわかりやすくして」とか「優先度上げて」みたいな微調整も自然言語でできる。

コンテキストスイッチなしでタスク管理ができるのが思った以上に快適で、[Murphy Randleさんのブログ](https://mrmurphy.dev/freeing-up-flow-with-claude-code-linear-mcp/)でも同じようなことが書かれていましたが、「手でIssueを書くよりClaude Codeに頼んだほうが楽」というのはそのとおりです。

## Skillを作るときのコツ

今回の経験から得たSkill設計のコツをいくつか。

- 実際にMCP APIを叩いてテストしてからスキルを書く。ドキュメントだけでは見えないハマりどころが多い
- テスト済みの値（チーム名、ステータス名、UUIDなど）はスキルにハードコードする。毎回APIで取得するのは無駄
- 破壊的な操作は明示的に禁止する。Agentには安全側に倒した指示を書く
- 知見はreferences/に蓄積する。次にスキルを改善するときの資産になる
- descriptionのトリガーフレーズは日本語と英語の両方を入れる。発火率が上がる

## まとめ

- Claude Code SkillとLinear MCPを組み合わせると、コーディング中に自然言語でタスク管理ができるようになる
- MCP APIにはID体系の罠（UUID/表示キー/スラッグ）があるので、事前にテストして知見をスキルに埋め込むのが大事
- 作業ディレクトリ→プロジェクトの自動判定を入れるとコンテキストスイッチがほぼゼロになって快適

## References

- [Claude Code Skills](https://claude.com/blog/skills)
- [Skills explained: How Skills compares to prompts, Projects, MCP, and subagents](https://claude.com/blog/skills-explained)
- [Equipping Agents for the Real World with Agent Skills](https://www.anthropic.com/engineering/equipping-agents-for-the-real-world-with-agent-skills)
- [Linear MCP Server](https://linear.app/docs/mcp)
- [Linear Integration – Claude](https://linear.app/integrations/claude)
- [Freeing Up Flow With Claude Code & Linear MCP – Murphy Randle](https://mrmurphy.dev/freeing-up-flow-with-claude-code-linear-mcp/)
- [Claude CodeのSkillsを使うついでにMCP・スラッシュコマンド・サブエージェントとの違いを整理してみた](https://zenn.dev/karaage0703/articles/8c1e0434152f35)
- [Claude Code: 公式MCPを補完するSkills設計パターン](https://tech-lab.sios.jp/archives/50214)
