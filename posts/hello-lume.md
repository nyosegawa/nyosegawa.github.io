---
title: "このブログをLumeで作った話"
description: "Deno製SSG Lumeでブログを構築した経緯と、Lumeの特徴・セットアップ方法を紹介します"
date: 2026-02-12
tags: [Lume, Deno, SSG]
author: 逆瀬川ちゃん
---

<small style="color: #7a8a98;">この記事はCoding Agentを使って執筆されています。</small>

こんにちは！逆瀬川ちゃんです！

今日はこのブログを作るのに使ったLumeというSSGについて紹介していきたいと思います。初回投稿なので軽く自己紹介もしつつ。

<!--more-->

## このブログについて

このブログは逆瀬川ちゃんが書く技術ブログです。記事は主にCoding Agentで執筆しています。日々学んだことや気になった技術トピックをまとめていきます。

さて、ブログを始めるにはまずブログ基盤が必要です。世の中にはいろんなSSG（Static Site Generator）があるのですが、今回はLumeを選びました。

## なぜLumeなのか

SSGは選択肢がめちゃくちゃ多いです。ざっと比較するとこんな感じ。

| SSG | 言語 | 特徴 |
|-----|------|------|
| Hugo | Go | ビルドが爆速。テンプレート構文に癖がある |
| Eleventy | Node.js | 柔軟性が高い。設定ファイルがJS |
| Astro | Node.js | Islands Architecture。リッチなUIが得意 |
| Lume | Deno | シンプル。node_modules不要。柔軟 |

HugoやEleventyも良いSSGなのですが、今回Lumeを選んだ理由は以下のとおりです。

- node_modulesが存在しない。Denoのhttpsインポートで必要なものだけ取ってくる
- セットアップが1コマンドで終わる
- テーマが用意されていて、すぐにブログが立ち上がる
- テンプレートエンジンの選択肢が豊富（Markdown、Vento、Nunjucks、JSX、Pugなど）
- クライアントサイドJSを一切生成しない。出力が本当にただの静的HTML

特にnode_modules不要というのはかなり嬉しみがあります。Denoベースなので`deno run`一発で動く。依存管理の苦痛から解放される。

## Lumeのセットアップ

セットアップは本当にシンプルです。Denoがインストールされていれば、以下のコマンドだけでプロジェクトが作れます。

```bash
# Denoのインストール（まだの場合）
curl -fsSL https://deno.land/install.sh | sh

# Lumeプロジェクトの初期化（Simple Blogテーマ付き）
deno run -A https://lume.land/init.ts --theme=simple-blog
```

これだけで以下のファイルが生成されます。

```
project/
├── _config.ts     # Lumeの設定ファイル
├── _data.yml      # サイト全体のメタデータ
├── deno.json      # Denoの設定（タスク定義含む）
├── posts/         # ブログ記事を置くディレクトリ
├── 404.md         # 404ページ
└── favicon.png    # ファビコン
```

`_config.ts`の中身はこれだけです。

```typescript
import lume from "lume/mod.ts";
import blog from "blog/mod.ts";

const site = lume();
site.use(blog());

export default site;
```

たった4行。このシンプルさがLumeの良いところです。テーマが裏で必要なプラグイン（Markdown処理、日付フォーマット、フィード生成、サイト内検索など）を全部セットアップしてくれます。

さて、プロジェクトが作れたら開発サーバーを起動してみましょう。

```bash
deno task serve
```

`http://localhost:3000`にアクセスするとブログが表示されます。ホットリロード付きなので、ファイルを編集すると即座に反映されます。

## 記事の書き方

記事はMarkdownファイルとしてpostsディレクトリに置きます。フロントマターでメタデータを記述するスタイルです。

```markdown
---
title: "記事のタイトル"
description: "記事の説明"
date: 2026-02-12
tags: [Lume, Deno]
author: 逆瀬川ちゃん
---

ここから本文を書いていきます。
```

`<!--more-->`タグを本文中に入れると、その位置までがトップページの抜粋として表示されます。記事一覧で「続きを読む」的な挙動になるので便利です。

## GitHub Pagesへのデプロイ

このブログはGitHub Pagesでホスティングしています。GitHub Actionsでビルドからデプロイまで自動化しているので、記事をpushするだけで公開されます。

ワークフローファイルはこんな感じです。

```yaml
name: Build and deploy
on:
  push:
    branches: [main]

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: denoland/setup-deno@v2
      - run: deno task build
      - uses: actions/upload-pages-artifact@v3
        with:
          path: _site
  deploy:
    needs: build
    runs-on: ubuntu-latest
    environment:
      name: github-pages
    steps:
      - uses: actions/deploy-pages@v4
```

Denoの公式GitHub Actionがあるのでセットアップも楽です。`deno task build`で`_site`ディレクトリに静的ファイルが出力されるので、それをそのままGitHub Pagesにアップロードしているだけです。

## まとめ

- LumeはDeno製のSSGで、node_modules不要・1コマンドセットアップ・クライアントJS零という割り切りが気持ちいい
- Simple Blogテーマを使えば、セットアップからデプロイまで30分もかからない
- 今後このブログでいろいろな技術トピックを書いていくので、よろしくお願いします

## References

- [Lume - Static site generator for Deno](https://lume.land/)
- [lumeland/lume - GitHub](https://github.com/lumeland/lume)
- [Simple Blog Theme - Lume](https://lume.land/theme/simple-blog/)
- [How to build a static site with Lume - Deno Blog](https://deno.com/blog/build-a-static-site-with-lume)
