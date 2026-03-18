---
title: "Coding Agent時代のドキュメントについて考えていること"
description: "コードにはフィードバックループがあるのにドキュメントにはない。Coding Agentと一緒に開発するなかで、ドキュメントをどう整理できそうか考えたことと、試していることをまとめます"
date: 2026-03-17
tags: [AI, Claude Code, Documentation, ADR, Agentic Engineering]
author: 逆瀬川ちゃん
---

こんにちは！逆瀬川ちゃん ([@gyakuse](https://x.com/gyakuse)) です！

今日はCoding Agent時代のドキュメントについて、最近考えていることを書いていきたいと思います。悩み中なので、荒れた内容になっていますが、ご容赦を。コード規模、チーム規模などなどによって、正解は異なるものだと思います。あくまで私の実践の一例として読んでくれれば幸いです。

<!--more-->

以前書いた[Coding Agent時代の開発ワークフロー](/posts/coding-agent-workflow-2026/)や[Claude Codeのシステムプロンプト解説記事](https://zenn.dev/sakasegawa/articles/af8ede2e4d7da4)でCLAUDE.mdやAGENTS.md、ADRの運用について少し触れましたが、そもそもドキュメントって何のために書くんだっけ、Agentが読むドキュメントはどうあるべきなんだっけ、というところをもう少し掘り下げて考えたいなと思っていました。まだ結論が固まっているわけではないのですが、最近の実践から見えてきたことをまとめてみます。

## そもそもドキュメントの役割ってなんだっけ

いきなり分類の話をする前に、そもそもドキュメントの役割を振り返っておきます。ソフトウェア開発においてドキュメントは、関係者全員が同じ方向を向くためのSingle Source of Truthとして機能してきました。要件定義書、機能仕様書、API仕様、アーキテクチャ文書、運用手順書。呼び方や粒度は組織やプロジェクトごとに違いますが、結局のところドキュメントがやっていることは、ある時点での正しさを自然言語で記述して共有することです。

要件を定義する、判断の経緯を残す、外部制約を記録する、新メンバーがキャッチアップする。どれもある時点での正しさを記述して共有するという行為のバリエーションです。

ただ、どの役割であってもドキュメント自体が正確であり続けなければ機能しません。基準線が腐っていたら基準線として使えないし、正しい挙動の拠り所が間違っていたら拠り所にならない。ではなぜドキュメントは腐りやすいのか。

## なんでドキュメントって更新がつらいのか

コードについて考えてみます。コードには腐敗に対する機械的なフィードバックループがあります。変更すればコンパイラが怒り、テストが壊れ、Linterが反応し、CI/CDが回ります。ループが閉じている状態です。

一方で自然言語で書かれたドキュメントにはそのような仕組みがありません。仕様書は本質的に特定の時点での自然言語による正しさの担保であって、開発が進むなかでトレードオフによって仕様と実装が異なる着地になることは頻繁に起きます。コードには型システムや依存関係グラフといった構造があるので変更の影響範囲を機械的に特定できますが、自然言語のドキュメントは文脈依存的で、ある記述の変更が他のどの記述に影響するかを正確に判断するのは極めて難しいです。

この非対称性は以前からある問題ですが、Coding Agentの登場でより顕在化しているように感じます。AgentはドキュメントをContextとして読み、その内容に基づいて行動します。腐ったドキュメントは腐ったコードと違ってエラーを出してくれません。静かに死に、Agentの行動を悪化させるだけです。

こうした背景を踏まえて、じゃあCoding Agentにとってどういうドキュメントが必要なのか、というところを考えてみます。

## Agentが欲しいドキュメントはどういうものか

Agentが扱いやすいドキュメントには、決定論的に検証可能であること、あるいは不変であることのいずれかの性質があると感じています。検証可能であればフィードバックループを閉じられるし、不変であればそもそも腐敗しません。

この観点で既存のドキュメント群を分類してみると、以下の4つに整理できそうです。

| 分類 | 性質 | 例 | 扱い |
|------|------|------|------|
| 導出可能 | コードやテストから再構成できる | API仕様、型定義一覧、依存関係図 | 書かない |
| 検証可能 | 機械的にtrue/falseを判定できる | 「レスポンスは200ms以内」「このフィールドは必須」 | テスト/Linterに移す |
| 不変の記録 | ある時点の決定とその理由 | ADR、ポストモーテム | Append-onlyで保持 |
| 還元不能 | コードにもテストにも落とせない | 外部制約、法規制、Whyの文脈、組織的判断 | 自然言語ドキュメントとして維持 |

導出可能なものについては、Agentはコードを直接走査できるので、ドキュメントに二重化する必要はないと感じています。たとえばディレクトリ構造などについて書くことが多いですが、[ETH ZurichとLogicStar.aiの研究](https://arxiv.org/abs/2602.11988v1)でも、ディレクトリ構造の概要をCLAUDE.mdに書いてもAgentのファイル発見速度は向上しなかったという結果が出ています。

検証可能な制約はテストやLinterに移せると良さそうです。レスポンスタイムは200ms以内、がドキュメントに書いてあっても誰も機械的にチェックしていなければ形骸化します。テストに移した瞬間にフィードバックループが閉じます。

不変の記録は[ADR（Architecture Decision Records）](https://adr.github.io/)の形式が相性が良いです。ある時点での決定を記録し、内容を書き換えず置換する。Statusがsupersededなら後続ADRに従う、という判断がAgentにも機械的にできます。

そして還元不能な知識、つまりテストにもLinterにも落とせずコードからも読み取れないものがあります。Why（なぜこの選択をしたか）、Why not（なぜ他の選択肢を採らなかったか）、外部制約（法規制やSLA）、意図の境界（この振る舞いはバグではなく仕様、とか）。とくにWhy notが記録されていないと、Agentが改善のつもりで過去に却下された設計に回帰するリスクがあります。

## Agentが欲しいドキュメントをどのように提供するか

さて、何を書くかが絞られたところでどこに置くかです。Coding Agentの視点で考えると、二層構造が自然に見えてきます。

### Layer 1: CLAUDE.md / AGENTS.md（常時注入）

CodexではAGENTS.mdが、Claude CodeではCLAUDE.mdがセッション開始時に自動的にContextに注入されます。これはAgentの作業記憶として機能します。常に注入されるということはContext windowを常に消費するので、極力簡潔に保つ必要があります。ここに置くのが良さそうなのは以下のようなものです。

- 禁止事項・ガードレール
- アクティブなアーキテクチャ判断の要約
- ビルド・テスト・Lintコマンド

[You Don't Need a CLAUDE.md](https://dev.to/byme8/you-dont-need-a-claudemd-jgf)の記事では約30行のエントリーポイントとしてCLAUDE.mdを機能させ、詳細はdocs/以下に分散する構成を推奨しています。これはContext効率の観点から合理的です。

### Layer 2: docs / docs/adr/（オンデマンド参照）

ADRやドキュメント群はAgentが必要に応じて参照しに行く長期記憶です。docsが肥大化したらROI評価でdocs/adrに移行する、という運用サイクルも回せます。

AgentはExplore SubAgentやファイル検索で必要なドキュメントを見つけられるので、全てをCLAUDE.mdに詰め込む必要はなさそうです。必要なときに必要なものだけ読む。こういう構成がContext効率としては良いのではないかと考えています。

## ドキュメントの管理・運用

ここまでで何を書くかとどこに置くかの話をしてきましたが、書いたドキュメントが腐らないようにするにはどうするか。わたしがいま試しているのは、ドキュメントにもコードと同じようにharnessをかける、というアプローチです。

### ドキュメント向けのharness

自分のプロジェクトで `check-doc-freshness.sh` というスクリプトを作って運用しています（[test-docs](https://github.com/nyosegawa/test-docs)リポジトリで実際にhook群と合わせて検証しています）。以下のチェックを行います。

1. CLAUDE.md/AGENTS.mdの行数制限（60行以上でエラー。Context効率のため）
2. CLAUDE.md/AGENTS.md内の壊れたパス参照の検出
3. docs/とdocs/adr/のlast-validated日付チェック（閾値超えでWARNING/ERROR）
4. CLAUDE.md/AGENTS.mdがsuperseded ADRを参照していないかチェック

docs/以下のファイルにはlast-validatedというフロントマターフィールドを入れています。

```yaml
---
last-validated: 2026-03-15
phase: current
---
```

phaseがcurrentのドキュメントは3日でWARNING、5日でERROR。phaseがtarget（将来の目標状態を記述したドキュメント）は10日でWARNING、15日でERRORです。

このスクリプトをClaude CodeのPreToolUse hookとしてgit commitにバインドすると、ドキュメントが腐敗した状態でのコミットをブロックできます。

```json
{
  "hooks": {
    "PreToolUse": [
      {
        "matcher": "Bash",
        "hooks": [
          {
            "type": "command",
            "command": "bash .claude/hooks/pre-commit-guard.sh"
          }
        ]
      }
    ]
  }
}
```

matcherはツール名（`tool_name`）に対する正規表現マッチなので`"Bash"`を指定します。git commitかどうかの判別はhookスクリプト側で行います。ブロック時はexit 2 + stderrにメッセージを書く必要があります（stdoutではなくstderr。exit 2のときClaude Codeはstderrをエージェントへのフィードバックとして使います）。

```bash
#!/usr/bin/env bash
input="$(cat)"
command="$(jq -r '.tool_input.command // empty' <<< "$input")"

case "$command" in
  git\ commit*) ;;
  *) exit 0 ;;
esac

if echo "$command" | grep -q -- "--no-verify"; then
  echo "BLOCKED: --no-verify is prohibited" >&2
  exit 2
fi

output=$(bash scripts/check-doc-freshness.sh 2>&1)
if [ $? -ne 0 ]; then
  echo "Doc freshness check failed: $output" >&2
  exit 2
fi
```

コードのpre-commit hookと同じ位置づけで、ドキュメントが古くなったらコミットできないというフィードバックループが閉じます。`--no-verify` の禁止もここに入れておくと、Agentがフィードバックループを迂回するのを防げます。

ただしこれは腐敗しているかもしれないというシグナルを時間経過で出しているだけです。実際に腐敗しているか（＝Agentの行動を悪化させているか）は判定できません。

### 定期的なaudit: docs-auditor

ドキュメントが実際にAgentの行動を改善しているかどうかを評価するには、セッションtranscript（session log）の分析が必要です。以前作った[skill-auditor](/posts/skill-auditor/)と同じアプローチで、ドキュメント版の監査ツール[docs-auditor](https://github.com/nyosegawa/skills/tree/main/skills/docs-auditor)を作りました。

docs-auditorは以下を行います。

- セッションtranscriptを走査して、各ドキュメントがいつ読まれたかを検出
- 読まれた後のAgentの行動変化を評価（beneficial / neutral / harmful / unnecessary）
- CLAUDE.md/AGENTS.mdは常時注入されるため、代わりにdirective（命令的記述）ごとの遵守率を分析
- per-docのROI（行動改善度 / Context占有率）を算出
- 一度も参照されなかったドキュメントを検出

ドキュメントごとに以下のような指標が取れます。

| 指標 | 意味 |
|------|------|
| 参照頻度 | そのドキュメントが実際にAgentに読まれる頻度 |
| impact_score | (beneficial - harmful) / total_reads |
| content_tokens | Context window内での占有トークン数 |
| ROI | impact_score / (content_tokens / 1000) |

これによって、読まれているが行動を変えていないドキュメント（＝Agentがコードから同じ情報を導出できている）と、読まれておらず行動も変えていないドキュメント（＝完全に不要）を区別できます。

つまり運用としては二段構えです。

1. check-doc-freshness.sh（軽量・高頻度）: 時間経過だけで警告を出す安価なヒューリスティック。PreToolUse hookで毎コミット
2. docs-auditor（重量・低頻度）: 実際の行動改善度を評価し、ドキュメントの更新や廃止を提案。定期的に実行

理想的にはlast-validatedの更新自体がauditの結果に基づくべきで、このドキュメントはまだ有効に機能していると判定されたときにlast-validatedが更新される、という流れが最も健全だと思っています。

## 人間のためのドキュメントはどうするか

ここまではAgentが読むドキュメントの話をしてきましたが、人間向けのドキュメント（オンボーディングガイド、運用手順書、ユーザーマニュアルなど）はどうしたらいいのでしょうか。

ひとつのアイデアとして、人間向けドキュメントはリポジトリの走査可能範囲の外に出すという選択肢があると思っています。ConfluenceでもNotionでもいいと思いますし、別のリポジトリで管理でもよいかもしれません。ただし最新であることが担保されないため、つらみもあります。何らかのhookをもとにドキュメントを更新するようなフローも考えられますが、同時並行して更新してくれないのはだるいですね。結局同じリポジトリに入れて頑張る、みたいなのもやっぱりありなのかなあと悩みが尽きません。

## まとめ

- ドキュメントの役割（イメージを揃える、乖離の基準線、正しい挙動の拠り所）はCoding Agent時代でも変わらないが、フィードバックループがないと機能し続けられない
- Agentにとって扱いやすいのは、決定論的に検証可能か不変なドキュメント。コードから導出可能なものは書かず、検証可能な制約はテスト/Linterに移す方向で試している
- CLAUDE.md/AGENTS.md（作業記憶）とdocs/adr/（長期記憶）の二層構造で提供し、check-doc-freshness.shとdocs-auditorの二段構えで管理・運用する
- 人間向けドキュメントはリポジトリの外に出す方向で試しているが、まだ悩んでいるところもある

## References

- ADR
    - [Architecture Decision Records (ADR)](https://adr.github.io/)
    - [Master architecture decision records: Best practices for effective decision-making (AWS)](https://aws.amazon.com/blogs/architecture/master-architecture-decision-records-adrs-best-practices-for-effective-decision-making/)
- Documentation & Coding Agents
    - [Do AGENTS.md/CLAUDE.md Files Help Coding Agents? (ETH Zurich / LogicStar.ai)](https://todatabeyond.substack.com/p/do-agentsmdclaudemd-files-help-coding)
    - [You Don't Need a CLAUDE.md](https://dev.to/byme8/you-dont-need-a-claudemd-jgf)
    - [Shifting to Continuous Documentation (InfoQ)](https://www.infoq.com/articles/continuous-documentation/)
- 関連する自分の記事
    - [Coding Agent時代の開発ワークフローについてのまとめ](/posts/coding-agent-workflow-2026/)
    - [Claude Codeのシステムプロンプト解説](https://zenn.dev/sakasegawa/articles/af8ede2e4d7da4)
    - [skill-auditorを作った話](/posts/skill-auditor/)
- Claude Code Hooks
    - [Hooks Guide](https://code.claude.com/docs/hooks-guide)
    - [Hooks Reference](https://code.claude.com/docs/hooks)
- 実装
    - [docs-auditor (GitHub)](https://github.com/nyosegawa/skills/tree/main/skills/docs-auditor)
    - [test-docs (GitHub)](https://github.com/nyosegawa/test-docs)
