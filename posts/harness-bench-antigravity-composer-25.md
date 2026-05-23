---
title: "Antigravity Gemini 3.5 FlashとCursor Composer 2.5をHarnessBenchで評価した話"
og_title: "Antigravity Gemini 3.5 Flashと\\nCursor Composer 2.5を\\nHarnessBenchで評価した話"
description: "HarnessBenchの27問でAntigravity / Gemini 3.5 Flash (High)、Cursor / Composer 2.5 fast、Cursor / Composer 2.5 normalを追加評価し、既存14条件と合わせて比較します"
date: 2026-05-24
tags: [HarnessBench, Coding Agent, Antigravity, Cursor, Gemini, Composer]
author: 逆瀬川ちゃん
lang: ja
image: /og/harness-bench-antigravity-composer-25.jpg
---

こんにちは！逆瀬川ちゃん ([@gyakuse](https://x.com/gyakuse)) です！

今日はHarnessBenchでAntigravity / Gemini 3.5 Flash (High) と Cursor / Composer 2.5 fast / normalを追加評価したので、既存のCodex / Claude Code / Cursor条件と合わせて結果を見ていきたいと思います。

<!--more-->

## 何を評価したか

前回は[HarnessBench](/posts/harness-bench/)でCodex CLI、Claude Code、Cursor Agentを同じ27問の実リポジトリデバッグ課題で比較しました。

今回はそこに補助実験として、以下の3条件を追加しました。

| Harness | Model | Effort / mode |
|---|---|---|
| Antigravity CLI | Gemini 3.5 Flash | high |
| Cursor Agent | Composer 2.5 | fast |
| Cursor Agent | Composer 2.5 | normal |

問題セットは前回と同じ27問です。9個のOSSリポジトリに対して、low / mid / highの3問ずつを用意し、hidden testのcore + regressionがすべて通ったらpassとしています。

実験IDは`antigravity-cursor-composer-2.5-20260522T052522Z`です。結果は[HarnessBench result page](/harness-bench/)で既存条件と同じチャート・表に統合しています。

## 結果

まずは追加した3条件だけを抜き出すと、以下です。

| 条件 | Pass | Pass rate | Median time | Low | Mid | High | Timeout |
|---|---:|---:|---:|---:|---:|---:|---:|
| Cursor / Composer 2.5 / fast | 19/27 | 70.4% | 7.5分 | 9/9 | 5/9 | 5/9 | 0 |
| Cursor / Composer 2.5 / normal | 18/27 | 66.7% | 8.1分 | 9/9 | 5/9 | 4/9 | 0 |
| Antigravity / Gemini 3.5 Flash / high | 17/27 | 63.0% | 14.3分 | 8/9 | 5/9 | 4/9 | 1 |

既存14条件と合わせて並べると、上位は変わりません。トップは引き続きCodex / GPT-5.5 / xhighの22/27です。次にCursor / GPT-5.5 medium、Cursor / GPT-5.5 high、Codex / GPT-5.5 medium、Cursor / Opus 4.7 maxが21/27で続きます。

その中でComposer 2.5 fastは19/27です。最上位層には届いていませんが、Codex / GPT-5.5 highと同じ成功数で、Composer 2 fastの17/27からは2問増えました。Composer 2.5 normalは18/27で、Composer 2 normalと同じ成功数でした。

Antigravity / Gemini 3.5 Flash (High)は17/27です。これはClaude Code / Opus 4.7 max、Cursor / Composer 2 fastと同じ成功数で、今回の17条件全体では下位グループに入ります。

## 既存条件と比べた位置

成功数で見ると、追加3条件はこういう位置づけです。

| 条件 | Pass | Median time | 読み方 |
|---|---:|---:|---|
| Codex / GPT-5.5 / xhigh | 22/27 | 10.2分 | 今回の全体トップ |
| Cursor / GPT-5.5 / medium | 21/27 | 4.7分 | 成功率と速度のバランスが強い |
| Cursor / GPT-5.5 / high | 21/27 | 6.2分 | 上位グループ |
| Cursor / Opus 4.7 / max | 21/27 | 19.7分 | 成功数は高いが遅い |
| Cursor / Composer 2.5 fast | 19/27 | 7.5分 | 中位上側、Composer 2 fastより改善 |
| Codex / GPT-5.5 / high | 19/27 | 9.0分 | Composer 2.5 fastと同数 |
| Cursor / Composer 2.5 normal | 18/27 | 8.1分 | Composer 2 normalと同数 |
| Cursor / Composer 2 fast | 17/27 | 3.6分 | 速いが成功数は下がる |
| Antigravity / Gemini 3.5 Flash high | 17/27 | 14.3分 | 成功数は下位、時間も長め |
| Claude Code / Opus 4.7 max | 17/27 | 15.1分 | Antigravityと同数 |

27問なので、19/27と21/27の差を強く言い切るのは危険です。ただ、Composer 2.5 fastは少なくとも「Composer系のfastとしては成功数が伸びた」と見てよさそうです。

一方で、Cursor / GPT-5.5 mediumの21/27・4.7分はかなり強いです。Composer 2.5 fastは19/27・7.5分なので、今回の結果だけを見るなら、純粋な成功率と速度の両方でCursor / GPT-5.5 mediumのほうが良い位置にいます。

## Composer 2.5の読み方

前回の公式runでは、Cursor / Composer 2 fastが17/27、Cursor / Composer 2 normalが18/27でした。今回のComposer 2.5では、fastが19/27、normalが18/27です。

| 条件 | Pass | Median time |
|---|---:|---:|
| Cursor / Composer 2 fast | 17/27 | 3.6分 |
| Cursor / Composer 2 normal | 18/27 | 5.3分 |
| Cursor / Composer 2.5 fast | 19/27 | 7.5分 |
| Cursor / Composer 2.5 normal | 18/27 | 8.1分 |

Composer 2.5 fastは前回のComposer 2 fastより2問多く通しました。一方で、実行時間は伸びています。normalは成功数だけ見るとComposer 2から横ばいですが、時間は同じく伸びました。

ただし、既存条件と横に置くと見え方は少し変わります。Composer 2.5 fastはComposer 2 fastよりは良いですが、Cursor / GPT-5.5 mediumやCursor / GPT-5.5 highには届いていません。つまり「Composer 2.5 fastは改善しているが、今回のHarnessBenchではCursor GPT-5.5系を置き換えるほどではない」という評価になります。

## 今回の読み方

今回の結果をかなり控えめに読むと、以下です。

- Cursor / Composer 2.5 fastは19/27で、Codex / GPT-5.5 highと同数でした
- Cursor / Composer 2.5 fastはComposer 2 fastより2問多く通しましたが、実行時間は3.6分から7.5分に伸びました
- Cursor / Composer 2.5 normalは18/27で、Composer 2 normalと同数でした
- Antigravity / Gemini 3.5 Flash (High)は17/27で、今回の17条件の中では下位グループでした
- 上位はCodex / GPT-5.5 xhighの22/27、Cursor / GPT-5.5 medium/highやCursor / Opus maxの21/27で、ここは変わりませんでした
- 27問なので、成功率の小さな差は統計的に強く読めません

個人的には、Composer 2.5 fastは「Composer 2 fastからは改善したが、既存のCursor GPT-5.5 medium/highがかなり強いので、全体トップ層ではない」という読み方です。Antigravity / Gemini 3.5 Flash (High)は、今回の結果だけ見るとComposer 2 fastやClaude Code / Opus maxと同じ17/27で、成功率・時間のどちらでも目立つ優位はありませんでした。

## まとめ

- HarnessBenchにAntigravity / Gemini 3.5 Flash (High) と Cursor / Composer 2.5 fast / normalを追加評価しました
- 17条件全体のトップは引き続きCodex / GPT-5.5 / xhighの22/27でした
- Cursor / Composer 2.5 fastは19/27で、Composer 2 fastからは改善しましたが、Cursor GPT-5.5 medium/highの21/27には届きませんでした
- Cursor / Composer 2.5 normalは18/27で、Composer 2 normalと同数でした
- Antigravity / Gemini 3.5 Flash (High)は17/27で、今回の比較では下位グループでした
- 27問なので、細かい順位よりも「上位グループ・中位・下位」の大まかな位置として読むのがよさそうです

## References

- [HarnessBench result page](/harness-bench/)
- [前回のHarnessBench記事](/posts/harness-bench/)
- [HarnessBench GitHub repository](https://github.com/nyosegawa/harness-bench)
- [Antigravity CLI overview](https://www.antigravity.google/docs/cli-overview)
- [Antigravity CLI getting started](https://www.antigravity.google/docs/cli-getting-started)
