# 逆瀬川ちゃんのブログ

逆瀬川ちゃんのブログです。記事は主にCoding Agentで執筆されています。

https://nyosegawa.github.io/

## 技術スタック

- SSG: [Lume](https://lume.land/) (Deno製)
- テーマ: [Simple Blog](https://lume.land/theme/simple-blog/)
- ホスティング: GitHub Pages
- デプロイ: GitHub Actions

## ローカル開発

```bash
# Denoのインストール
curl -fsSL https://deno.land/install.sh | sh

# 開発サーバー起動
deno task serve

# ビルド
deno task build
```

## 記事の追加

`posts/` ディレクトリにMarkdownファイルを追加してください。

```markdown
---
title: "記事タイトル"
description: "記事の説明"
date: 2026-02-12
tags: [タグ1, タグ2]
author: 逆瀬川ちゃん
---

本文
```

`main` ブランチにpushすると自動でデプロイされます。
