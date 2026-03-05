---
title: "Remotionでプロダクト紹介動画を作るためのSkillを作った話"
description: "spark-bananaのプロモ動画制作で得た知見を、Remotion公式Skillと連動する制作Skillに落とし込んだ実装と運用を整理します"
date: 2026-03-02
tags: [Remotion, Agent Skills, Video Production, Claude Code, spark-banana]
author: 逆瀬川ちゃん
---

こんにちは！逆瀬川ちゃん ([@gyakuse](https://x.com/gyakuse)) です！

今日は Remotion でプロダクト紹介動画を作るときの知見を、どう Skill に落とし込んだかを、[spark-banana](https://nyosegawa.github.io/posts/spark-banana-introduction/) の実制作を例にまとめていきたいと思います。

<iframe
  width="100%"
  height="405"
  src="https://www.youtube.com/embed/w0AsZcxdujE"
  title="spark-banana teaser"
  frameborder="0"
  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
  allowfullscreen
></iframe>

[YouTubeで見る](https://www.youtube.com/watch?v=w0AsZcxdujE) / [GitHub](https://github.com/nyosegawa/spark-banana)

<!--more-->

## 大事だったこと

- 実アプリを撮影せず、アプリの状態遷移を再現するmockベースで動画を作ること
- フレームスクショを評価入力にして、Coding Agentが自己改善するループを回すこと

Remotion公式Skillはこの2点を支える土台として使い、制作側の判断は `remotion-promo-video-factory` としてSkill化しました。

## 背景: 何がつらかったか

さて、なぜ追加Skillが必要だったかを先に書きます。Remotion公式Skillはとても有用ですが、主にRemotionを正しく使うための知見です。

一方で、プロダクト紹介動画の制作では次がボトルネックになります。

- どの順番で見せると伝わるか
- 30秒前後に収める編集判断をどう標準化するか
- シーン遷移の破綻をどう潰すか
- 修正ループをどの単位で回すか

ここは Remotion API の知識だけでは埋まりません。制作フローの設計が必要です。

## 前提: なぜ画面録画フローはつらいのか

さて、ここを前提として明示しておきます。今回いちばん最初に詰まったのは、Remotionではなく画面録画ベースの制作フローでした。

画面録画フローでは、だいたい次の流れになります。

1. 実アプリを操作しながら録画する
2. ミスが出たら撮り直す
3. 編集で速度調整やカットを入れる
4. テロップやオーバーレイを別レイヤーで足す
5. 全体を見て違和感が出たらまた素材から戻る

この方式がつらくなる理由は、変更の起点が毎回バラバラになるからです。

- 操作ミスは録画素材の撮り直しになる
- 尺調整は編集タイムライン側で発生する
- テロップ修正はデザインレイヤー側で発生する
- 遷移崩れは最終プレビューまで見えにくい

つまり、1つ直すと他の層に影響が飛びやすく、修正単位が大きくなります。30秒動画でも後半ほど修正コストが急増しやすいです。

今回のように、UI操作と説明テキストと演出を高密度で同期させたい場合は、このフローだと反復が重くなります。そこで今回は次の方式を採用しました。

- 実アプリは録画しない
- 動画内で使う UI をコンポーネントとして再現する
- `props` と `frame` で状態遷移と時間を制御する

この記事ではこの方式を再現実装ベースと呼びます。

| 比較軸 | 画面録画ベース | 再現実装ベース |
|---|---|---|
| 実装対象 | 録画素材 + 編集タイムライン | Reactコンポーネント + Remotionタイムライン |
| 変更単位 | 素材全体に波及しやすい | 該当コンポーネントだけ直せる |
| タイミング調整 | 編集ソフト依存になりやすい | `frame` 定義で一元化できる |
| 品質確認 | 終盤で崩れに気づきやすい | still 出力で早期に確認できる |

## spark-banana動画で実際にやったこと

ここで、今回の実制作を短く整理します。動画は 1920x1080 / 30fps / 約28.5秒で、Opening → Demo → CTA の3シーン構成です。

<iframe
  width="100%"
  height="405"
  src="https://www.youtube.com/embed/w0AsZcxdujE"
  title="spark-banana teaser"
  frameborder="0"
  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
  allowfullscreen
></iframe>

シーンは `TransitionSeries` で接続し、尺は props で計算するようにしました。

```tsx
export const getTeaserDuration = (props) =>
  props.openingFrames + props.demoFrames + props.ctaFrames - props.transitionFrames * 2;
```

さらに Demo の内部タイムラインは、秒定数で管理しています。

```ts
const P1 = 2;
const P2O = 8;
const P2 = 10.5;
const P3O = 15;
const P3 = 16.5;
const FIN = 19.5;
const END = 21;
```

この設計にしておくと、1つの定数変更でフェーズ全体をずらせるので、編集判断が速くなります。

## いちばん効いたのはアプリの再現を先に作ること

ここが今回のコアです。実アプリ画面を録画して素材化するのではなく、Remotion内でアプリ挙動を再現する部品を先に作りました。

- `MockBrowser`
- `MockPanel`
- `MockFAB`
- `MockCursor`
- `MockPlanVariants`
- `MockBananaModal`

大事なのは、見た目だけ似せることではなく、ユーザーが理解すべき状態遷移を再現することです。今回なら次を優先して再現しています。

- どこをクリックしたら何が起きるか
- processing から done までの待ち時間と変化
- モード切替時に何が前面に出るか
- 最終的にどの結果が得られるか

この分割のメリットは、scene 側が時間と演出に専念できることです。UIの状態を props で渡すだけで、同じ演出パターンを再利用しやすくなります。さらに、再現対象を状態遷移に絞ることで、実装すべき範囲を抑えながら説得力を維持できます。


## スクショ駆動でCoding Agentに自己改善させる

さて、もう1つのコアです。今回はコードを書いて終わりではなく、フレームスクショを評価入力にして改善ループを回しました。

流れは次のとおりです。

1. Agent がコード修正する
2. `npx remotion still ... --frame=N` で要所フレームを出力する
3. スクショを見て、レイアウト崩れや可読性不足を判定する
4. Agent がその差分だけを再修正する
5. 合格するまで繰り返す

この方式だと、主観ではなくフレーム単位の差分で直せます。とくに次の問題に効きます。

- クロスフェード中の残像
- テキストの読めなさ
- オーバーレイ端の1px欠け
- クリック位置とUI反応のズレ

つまり、制作フローに観察可能な中間成果物を入れることで、Agentの修正品質が安定します。

## 公式Skillだけでは埋まらなかった差分

さて、ここまでの話を具体化すると、差分は次の表になります。

| 領域 | 公式 Remotion skill が強い点 | 今回追加した制作Skillで補った点 |
|---|---|---|
| 実装 | APIの正しい使い方、構成の基本 | shot設計、フェーズ定数、演出粒度の標準化 |
| アニメーション | `spring` / `interpolate` の基礎 | どの場面でどの動きを使うかの判断基準 |
| 遷移 | `TransitionSeries` の利用方法 | exit制御、クロスフェード破綻の回避手順 |
| 検証 | render/studio コマンド | スクショ評価を入力にした自己改善ループ |
| 再利用 | Remotion一般論 | 任意アプリ紹介向けテンプレート化 |

要するに、公式Skillは実装の土台で、追加Skillは制作運用の型です。

## この2点をSkillにした

作成したのは [`remotion-promo-video-factory`](https://github.com/nyosegawa/skills/blob/main/skills/remotion-promo-video-factory/SKILL.md) です。任意のアプリ紹介動画で、制作品質を再現しやすくすることが目的です。

この Skill では次を固定化しました。

- app type別のblueprint
- 30秒構成のshot listテンプレート
- モーションプリミティブの使い分け
- フレームキャプチャ手順
- build / gif / quality check の実行順

`SKILL.md` は英語ベースで、個別プロダクト名への依存を外しています。これで spark-banana の知見を他案件にも適用しやすくなります。

## Remotion公式Skillとの連動設計

ここは明確に役割分担しています。

1. 実装前に公式Skillを参照して、Remotionの制約と推奨を先に確定する
2. 構成設計と演出設計は factory Skill の手順で進める
3. 実装中に公式Skillへ戻ってAPI誤用を潰す
4. 仕上げは factory Skill のQAチェックリストで潰し込む

この往復を前提にすると、実装の正確性と制作の再現性を同時に取りやすくなります。

## 任意アプリ紹介にも適用できるようにしたポイント

さて、特定案件のメモで終わらせないために、app typeで分岐する方式にしました。

- SaaS UI中心: before/after、操作導線、CTAを重視
- DevTool中心: 入力→実行→結果の因果を重視
- API/Backend中心: 画面よりデータフロー可視化を重視
- AI機能中心: 生成プロセスと比較結果の見せ方を重視

同じ30秒でも、見せるべき主語が違います。ここを最初に分岐させると、毎回ゼロから悩まずに済みます。

## 制作中に効いた細かい実装ルール

ここで実制作のルールを抜粋します。どれも地味ですが、再現性に効きます。

- `useCurrentFrame()` 基準で統一し、CSS animation/transitionを使わない
- `sec()` で秒管理して、fps変更耐性を持たせる
- `TransitionSeries` 使用時は各シーン末尾に exit 制御を入れる
- overlay は `inset` の端ズレを最初に検証する
- フォントロードはモジュールスコープで行う
- `<Sequence>` のラッパー挙動を前提に、配置は絶対座標で設計する

## QAループを先に決めると改善が速くなる

最後に運用です。Studioだけで見て進めるより、still出力を軸にした方が速いです。

実運用は次の固定ループにしています。

1. 修正する
2. 要所フレームを still 出力する
3. 画像で崩れを確認する
4. 崩れた箇所だけ直す
5. 最終renderする

この順序を守るだけで、Agentの修正が毎回同じ基準で評価されるようになり、終盤の手戻りが減ります。

## まとめ

- アプリ紹介動画では、実アプリ録画より状態遷移を再現するmockベースが効く場面が多いです
- フレームスクショを評価入力にすると、Coding Agentの自己改善ループが成立します
- Remotion公式Skillは実装の土台として使い、制作判断は別Skillに切り出すのが実用的です

## Appendix: 実行コマンドの最小セット

```bash
# 型チェック
npx tsc --noEmit

# ビルド
npm run -s build

# GIF生成（用意している場合）
npm run -s build:gif

# フレームキャプチャ
npx remotion still SparkBananaTeaser /tmp/frame.png --frame=400

# 最終レンダリング
npx remotion render SparkBananaTeaser out.mp4
```

## Remotionの他の作例

ひらがなASRのデモ動画もRemotionで作っています。

<iframe
  width="100%"
  height="405"
  src="https://www.youtube.com/embed/2VU2mJ6XHTs"
  title="hiragana-asr demo"
  frameborder="0"
  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
  allowfullscreen
></iframe>

[YouTubeで見る](https://www.youtube.com/watch?v=2VU2mJ6XHTs) / [記事](https://nyosegawa.github.io/posts/hiragana-asr/)

## References

- [spark-banana 紹介記事](https://nyosegawa.github.io/posts/spark-banana-introduction/)
- [spark-banana Repository](https://github.com/nyosegawa/spark-banana)
- [remotion-promo-video-factory Skill](https://github.com/nyosegawa/skills/tree/main/skills/remotion-promo-video-factory)
- [Remotion Docs](https://www.remotion.dev/docs)
- [Remotion TransitionSeries](https://www.remotion.dev/docs/transitions/transitionseries)
- [Remotion spring()](https://www.remotion.dev/docs/spring)
- [Remotion interpolate()](https://www.remotion.dev/docs/interpolate)
- [Agent Skills](https://agentskills.io/)
- [Agent Skills Specification](https://agentskills.io/specification)
