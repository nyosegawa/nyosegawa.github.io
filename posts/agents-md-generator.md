---
title: "AGENTS.mdを自動で育てる仕組みを作った"
description: "新規リポジトリをcloneしたら勝手にAGENTS.mdが生えてきて、プロジェクトと一緒に育っていく仕組みをgit hookで作った話"
date: 2026-02-15
tags: [Git, AGENTS.md, Claude Code, Coding Agent]
author: 逆瀬川ちゃん
---

こんにちは！逆瀬川 ([@gyakuse](https://x.com/gyakuse)) です！

今日は「AGENTS.mdを自動で育てたい」という話をしていきたいと思います。作ったものは[agents-md-generator](https://github.com/nyosegawa/agents-md-generator)として公開しています。

<!--more-->

## CLAUDE.mdを毎回考えるのがつらい

Coding Agentを日常的に使っていると、新しいリポジトリを作るたびに頭を悩ませるものがあります。CLAUDE.md（あるいはAGENTS.md）です。

何を書くか毎回考えるのがまずつらい。プロジェクトのビルドコマンドは？テストの走らせ方は？コード規約は？まだ何もコードがない段階でこれを考えるのは不毛です。かといって空のまま放置すると、Coding Agentが手探りで動くことになって効率が悪い。

もっと根本的な問題もあります。CLAUDE.mdは書いた瞬間から劣化し始めます。プロジェクトが進めばコマンドは変わるし、アーキテクチャも変わる。でも人間はCLAUDE.mdの更新を忘れます。古くなった指示はエージェントのコンテキストを汚染して、むしろ書かないほうがマシな状態になります。

理想は「最初に種を蒔いたら勝手に育っていく」AGENTS.mdです。プロジェクトの初期は足場だけあればよくて、コードが増えるにつれて自然に中身が充実していくようなもの。

## AGENTS.mdはどうあるべきか

まず前提として、[AGENTS.md](https://agents.md/)はAIコーディングエージェント向けの設定ファイルです。GitHub上で60,000以上のリポジトリに採用されていて、OpenAI Codex、Google Jules、Cursor、Zed、GitHub Copilot、Gemini CLIなど主要なCoding Agentが対応しています。Linux Foundation傘下の[Agentic AI Foundation](https://openai.com/index/agentic-ai-foundation/)が管理する事実上の標準フォーマットです。Claude CodeはCLAUDE.mdを読みますが、AGENTS.mdとシンボリンクを張れば1ファイルで全ツールに対応できます。

さて、このAGENTS.mdに何を書くべきか。ここが一番大事なところです。

### 指示は少なければ少ないほどいい

LLMが確実に従える指示の数には上限があります。フロンティアモデルで150〜200個程度と言われていて、Coding Agentのシステムプロンプトがすでにその多くを消費しています。AGENTS.mdの指示はその残り枠を奪い合うことになります。

しかも指示が増えたときの劣化は均一に起こります。特定の指示だけ無視されるのではなく、全体のinstruction-followingが下がる。[AnthropicのClaude Code Best Practices](https://code.claude.com/docs/en/best-practices)でも「CLAUDE.mdが長すぎるとClaudeは半分を無視する」と指摘されていて、[HumanLayerのガイド](https://www.humanlayer.dev/blog/writing-a-good-claude-md)でも「可能な限り少ない指示にすべき」と書かれています。

つまり「何を書くか」より「何を書かないか」のほうが重要です。AGENTS.mdの指示量バジェットは20〜30行が目安になります。

### 書くべきもの、書くべきでないもの

| 書くべきもの | 書くべきでないもの |
|---|---|
| コードから推測できないプロジェクト固有の判断 | コードスタイルのルール（リンターに任せる） |
| 非自明なビルド・テストコマンド | ディレクトリ構造の説明（すぐ変わる） |
| 重要なgotchaやfootgun | 汎用的なプログラミングのアドバイス |
| ドメイン固有の用語 | 「Important Context」のようなキャッチオールセクション |

とくにキャッチオールセクションは危険です。「Important Context」みたいなセクションを作るとゴミ箱化して、あっという間にバジェットを食い潰します。

### 設定ファイルではなく生きたドキュメント

ここが一番見落とされがちなポイントです。AGENTS.mdは`.gitignore`のような「一度書いたら終わり」の設定ファイルではなく、プロジェクトと一緒に変化し続ける生きたドキュメントです。

- コマンドが変わったらすぐ更新する
- アーキテクチャが大きく変わったら全部書き直す
- エージェントがコードから推測できるようになった情報は消す

古い指示を残しておくのは害しかありません。6ヶ月前のアーキテクチャの説明がCLAUDE.mdに残っていたら、エージェントは間違った場所を探し、間違ったパターンを提案してきます。

## AGENTS.mdを自動で育てる

ここまでの話をまとめると、AGENTS.mdに必要な性質は3つです。

1. プロジェクト開始時に最低限の足場がある
2. 指示量バジェットを意識した構造になっている
3. 育てること・刈り込むことを前提とした設計になっている

これを実現するために[agents-md-generator](https://github.com/nyosegawa/agents-md-generator)を作りました。空リポジトリをcloneした瞬間にAGENTS.md（とCLAUDE.mdシンボリンク）が自動生成されます。

生成されるテンプレートにはいくつかの設計判断を入れています。

### 冒頭の2行が最重要

```markdown
**CRITICAL: Do NOT maintain backward compatibility unless explicitly requested by the user.**

**TARGET: Keep total instructions under 20-30 lines.**
```

テンプレートの最初の2行は「後方互換性を捨てること」と「20-30行バジェット」です。この2つはプロジェクトのフェーズに関係なく常に有効なルールなので、最も目立つ位置に置いています。新規プロジェクトに後方互換性は要らないし、プロジェクトが育った後も大胆なリファクタリングを優先するほうがコードは健全です。

### プレースホルダーは「埋めて消す」ためにある

Project Overview、Commands、Code Conventions、Architectureの各セクションはプレースホルダーとして置いています。ここに具体的な内容を書き込んでいくのですが、重要なのは埋めたらプレースホルダーのコメントを消すこと。プレースホルダー自体がバジェットを消費するからです。

### Maintenance Notesだけは消さない

テンプレート内で唯一「消すな」と位置づけているのがMaintenance Notesセクションです。

```markdown
## Maintenance Notes

**Keep this file lean and current:**

1. **Remove placeholder sections** once you fill them in
2. **Review regularly** - stale instructions poison the agent's context
3. **CRITICAL: Keep total under 20-30 lines**
4. **Update commands immediately** when workflows change
5. **Rewrite Architecture section** when major architectural changes occur
6. **Delete anything the agent can infer** from your code
```

AGENTS.mdが「設定ファイル」と誤解されて放置されるのを防ぐためのリマインダーです。これがないと書きっぱなしになって、気づいたら全部古くなっている。

## 実現方法: git hookでclone時に自動生成

実現方法自体はシンプルで、gitの[post-checkout hook](https://git-scm.com/docs/githooks#_post_checkout)と[template directory](https://git-scm.com/docs/git-init)を組み合わせただけです。

`init.templateDir`を設定すると、`git init`や`git clone`のたびにテンプレートディレクトリの中身が`.git/`にコピーされます。ここにpost-checkout hookを置いておけば、すべての新規リポジトリに自動でhookが適用されます。hookの中身は「空リポジトリならAGENTS.mdを生成する」というだけです。

```bash
# セットアップ（コピペで終わり）
mkdir -p ~/.git-templates/hooks
cp post-checkout ~/.git-templates/hooks/post-checkout
chmod +x ~/.git-templates/hooks/post-checkout
git config --global init.templateDir ~/.git-templates
```

これ以降、空リポジトリをcloneすると自動でAGENTS.mdとCLAUDE.md（シンボリンク）が生成されます。ghqでも動きます。

```bash
# 普通のclone
git clone git@github.com:yourname/new-repo.git
# → AGENTS.md と CLAUDE.md が生えている

# ghqでも同じ
ghq get yourname/new-repo
# → 同様に生成される
```

hookの判定ロジックは「`.git`を除いてルート直下の項目が3個未満なら空とみなす」としているので、READMEとLICENSEだけのリポジトリにも生成されます。既存のコードがあるリポジトリやAGENTS.mdがすでにあるリポジトリでは何もしません。

## まとめ

- AGENTS.mdは設定ファイルではなく生きたドキュメント。20-30行のバジェットを守り、育てて刈り込むことを前提に運用する
- [agents-md-generator](https://github.com/nyosegawa/agents-md-generator)で、cloneした瞬間に育てるための足場が自動生成されるようにした
- 実現方法はgitのtemplate directory + post-checkout hook。シンプル

## References

- [@kenn - 後方互換性についてのツイート](https://x.com/kenn/status/2022862500958765227)
- [agents-md-generator (GitHub)](https://github.com/nyosegawa/agents-md-generator)
- [AGENTS.md 公式サイト](https://agents.md/)
- [AGENTS.md GitHub リポジトリ](https://github.com/agentsmd/agents.md)
- [AGENTS.md Emerges as Open Standard for AI Coding Agents (InfoQ)](https://www.infoq.com/news/2025/08/agents-md/)
- [Best Practices for Claude Code](https://code.claude.com/docs/en/best-practices)
- [Writing a good CLAUDE.md (HumanLayer)](https://www.humanlayer.dev/blog/writing-a-good-claude-md)
- [Git - githooks Documentation](https://git-scm.com/docs/githooks)
- [Git - git-init Documentation (template directory)](https://git-scm.com/docs/git-init)
