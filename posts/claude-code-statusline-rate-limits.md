---
title: "Claude Codeの使用率がステータスラインに表示できるようになったので表示用のスクリプトを作った話"
description: "Claude Code v2.1.80で追加されたrate_limitsフィールドを使って、5時間/7日間の使用量をステータスラインにかわいく表示する4つのパターンを紹介します"
date: 2026-03-20
tags: [Claude Code, statusline, tips]
author: 逆瀬川ちゃん
oldUrl: /posts/claude-code-statusline/
---

こんにちは！逆瀬川 ([@gyakuse](https://x.com/gyakuse)) です！

Claude Code v2.1.80で待ちに待ったステータスライン用の`rate_limits`フィールドが追加されました。これがないために本当にみんな頑張ってきたのです。本当につらい世界でした。

<!--more-->

## 何が変わったのか

2026年3月19日リリースの[v2.1.80](https://code.claude.com/docs/en/changelog#2-1-80)で、ステータスラインに渡されるJSONに`rate_limits`フィールドが追加されました。

changelogの記載はこうです。

> Added rate_limits field to statusline scripts for displaying Claude.ai rate limit usage (5-hour and 7-day windows with used_percentage and resets_at)

これにより、Claude Codeのサブスクリプションの使用量（5時間ウィンドウと7日間ウィンドウ）をステータスラインにリアルタイムで表示できるようになりました。

## 仕組み

Claude Codeのステータスラインはシンプルな仕組みで動いています。

1. Claude Codeがセッション情報をJSONとしてスクリプトの標準入力に渡す
2. スクリプトが必要なフィールドを取り出して整形する
3. 標準出力に出した文字列がそのままステータスバーに表示される

今回追加された`rate_limits`フィールドはこんな構造です。

```json
{
  "rate_limits": {
    "five_hour": {
      "used_percentage": 42.3,
      "resets_at": 1774036800
    },
    "seven_day": {
      "used_percentage": 85.7,
      "resets_at": 1774580400
    }
  }
}
```

`used_percentage`が使用率、`resets_at`がリセット時刻（Unixタイムスタンプ・秒）です（初版ではISO 8601形式と記載していましたが、実際にはUnixタイムスタンプでした。[yagrabit](https://x.com/yagrabit)さんご指摘ありがとうございます！）。既存の`context_window.used_percentage`（コンテキストウィンドウの使用率）と合わせて表示すれば、残りリソースが一目でわかります。

## 設定方法

Claude Codeを実行し、以下のように指示するだけで導入できます。

```
https://nyosegawa.com/posts/claude-code-statusline-rate-limits/ これを入れたい. Pattern1
```

以下は手動で設定する場合の手順です。`~/.claude/settings.json`に`statusLine`を追加するだけです。

**macOS / Linux:**

```json
{
  "statusLine": {
    "type": "command",
    "command": "~/.claude/statusline.py"
  }
}
```

スクリプトは`chmod +x`で実行権限をつけておく必要があります。

**Windows:**

```json
{
  "statusLine": {
    "type": "command",
    "command": "python ~/.claude/statusline.py"
  }
}
```

Windowsでは`chmod +x`は不要です。代わりに`python`コマンド経由でスクリプトを実行します。[Claude Codeは内部的にGit Bashを使ってコマンドを実行する](https://code.claude.com/docs/en/setup)ため、パスは`~`で指定できます。

> **Note:** Pythonは別途インストールが必要です。

## 5つのビジュアルパターン

せっかくなのでいくつかパターンを作ってみました。すべてのパターンで以下の情報を表示しています。

- ctx: コンテキストウィンドウの使用率
- 5h: 5時間ウィンドウの使用率
- 7d: 7日間ウィンドウの使用率

色はすべてTrueColorグラデーションで、使用率に応じて緑→黄→赤に連続的に変化します。

### Pattern 1: Minimal Dots

カラードットと数値だけのミニマルなスタイルです。

![Pattern 1: Minimal Dots](/img/claude-code-statusline-rate-limits/pattern1.png)

情報密度は低いですがすっきりしていて、ステータスバーのスペースをあまり取りません。

### Pattern 2: Sparkline Gauge

ブロック要素を使ったスパークラインスタイルです。

![Pattern 2: Sparkline Gauge](/img/claude-code-statusline-rate-limits/pattern2.png)

縦方向の高さで使用率を表現するので、横幅が抑えられます。

### Pattern 3: Ring Meter

円グラフ風アイコンを使ったスタイルです。

![Pattern 3: Ring Meter](/img/claude-code-statusline-rate-limits/pattern3.png)

もっともコンパクトなパターンです。5段階の粗い表現ですが、色と組み合わせれば十分実用的です。

### Pattern 4: Fine Bar + Gradient

1%精度の細密プログレスバーです。

![Pattern 4: Fine Bar + Gradient](/img/claude-code-statusline-rate-limits/pattern4.png)

もっとも情報量が多く視覚的にも映えるパターンです。

### Pattern 5: Braille Dots

点字パターンを使ったドットスタイルです。

![Pattern 5: Braille Dots](/img/claude-code-statusline-rate-limits/pattern5.png)

ドットの密度で使用率を表現します。レトロな雰囲気があって個人的にはこれを使っています。

## まとめ

- Claude Code 2.1.80で`rate_limits`フィールドが追加され、5時間/7日間の使用量をステータスラインに表示できるようになった
- ANSIカラーやUnicodeブロック要素を使えばかなり綺麗に表示できる
- スクリプトはAppendixにコピペで使える形で載せているので好きなパターンを選んでください
- Claude Codeを使えばサクッといい感じのスクリプトを出せて、見ながら調節できるので、みんなも自分用のステータスラインをカスタマイズしていきましょう！

## Appendix: スクリプト全文

すべてPythonスクリプトです。

- **macOS / Linux:** `~/.claude/statusline.py`として保存し、`chmod +x`で実行権限を付与してください。
- **Windows:** `~/.claude/statusline.py`として保存してください（実行権限の付与は不要です）。

### Pattern 1: Minimal Dots

```python
#!/usr/bin/env python3
"""Pattern 1: Minimal dots - colored circles with numbers only"""
import json, sys
if sys.platform == 'win32':
    sys.stdout.reconfigure(encoding='utf-8')

data = json.load(sys.stdin)

R = '\033[0m'
DIM = '\033[2m'
BOLD = '\033[1m'

def gradient(pct):
    if pct < 50:
        r = int(pct * 5.1)
        return f'\033[38;2;{r};200;80m'
    else:
        g = int(200 - (pct - 50) * 4)
        return f'\033[38;2;255;{max(g, 0)};60m'

def dot(pct):
    p = round(pct)
    return f'{gradient(pct)}●{R} {BOLD}{p}%{R}'

model = data.get('model', {}).get('display_name', 'Claude')
parts = [f'{BOLD}{model}{R}']

ctx = data.get('context_window', {}).get('used_percentage')
if ctx is not None:
    parts.append(f'ctx {dot(ctx)}')

five = data.get('rate_limits', {}).get('five_hour', {}).get('used_percentage')
if five is not None:
    parts.append(f'5h {dot(five)}')

week = data.get('rate_limits', {}).get('seven_day', {}).get('used_percentage')
if week is not None:
    parts.append(f'7d {dot(week)}')

print(f'  {DIM}·{R}  '.join(parts), end='')
```

### Pattern 2: Sparkline Gauge

```python
#!/usr/bin/env python3
"""Pattern 2: Sparkline gauge - vertical block characters"""
import json, sys
if sys.platform == 'win32':
    sys.stdout.reconfigure(encoding='utf-8')

data = json.load(sys.stdin)

SPARKS = ' ▁▂▃▄▅▆▇█'
R = '\033[0m'
DIM = '\033[2m'

def gradient(pct):
    if pct < 50:
        r = int(pct * 5.1)
        return f'\033[38;2;{r};200;80m'
    else:
        g = int(200 - (pct - 50) * 4)
        return f'\033[38;2;255;{max(g, 0)};60m'

def spark_gauge(pct, width=8):
    pct = min(max(pct, 0), 100)
    level = pct / 100
    gauge = ''
    for i in range(width):
        seg_start = i / width
        seg_end = (i + 1) / width
        if level >= seg_end:
            gauge += SPARKS[8]
        elif level <= seg_start:
            gauge += SPARKS[0]
        else:
            frac = (level - seg_start) / (seg_end - seg_start)
            gauge += SPARKS[int(frac * 8)]
    return gauge

def fmt(label, pct):
    p = round(pct)
    return f'{DIM}{label}{R} {gradient(pct)}{spark_gauge(pct)}{R} {p}%'

model = data.get('model', {}).get('display_name', 'Claude')
parts = [model]

ctx = data.get('context_window', {}).get('used_percentage')
if ctx is not None:
    parts.append(fmt('ctx', ctx))

five = data.get('rate_limits', {}).get('five_hour', {}).get('used_percentage')
if five is not None:
    parts.append(fmt('5h', five))

week = data.get('rate_limits', {}).get('seven_day', {}).get('used_percentage')
if week is not None:
    parts.append(fmt('7d', week))

print(f' {DIM}│{R} '.join(parts), end='')
```

### Pattern 3: Ring Meter

```python
#!/usr/bin/env python3
"""Pattern 3: Ring meter - pie-like circle segments"""
import json, sys
if sys.platform == 'win32':
    sys.stdout.reconfigure(encoding='utf-8')

data = json.load(sys.stdin)

R = '\033[0m'
DIM = '\033[2m'
BOLD = '\033[1m'

RINGS = ['○', '◔', '◑', '◕', '●']

def gradient(pct):
    if pct < 50:
        r = int(pct * 5.1)
        return f'\033[38;2;{r};200;80m'
    else:
        g = int(200 - (pct - 50) * 4)
        return f'\033[38;2;255;{max(g, 0)};60m'

def ring(pct):
    idx = min(int(pct / 25), 4)
    return RINGS[idx]

def fmt(label, pct):
    p = round(pct)
    return f'{DIM}{label}{R} {gradient(pct)}{ring(pct)} {p}%{R}'

model = data.get('model', {}).get('display_name', 'Claude')
parts = [f'{BOLD}{model}{R}']

ctx = data.get('context_window', {}).get('used_percentage')
if ctx is not None:
    parts.append(fmt('ctx', ctx))

five = data.get('rate_limits', {}).get('five_hour', {}).get('used_percentage')
if five is not None:
    parts.append(fmt('5h', five))

week = data.get('rate_limits', {}).get('seven_day', {}).get('used_percentage')
if week is not None:
    parts.append(fmt('7d', week))

print('  '.join(parts), end='')
```

### Pattern 4: Fine Bar + Gradient

```python
#!/usr/bin/env python3
"""Pattern 4: Fine-grained progress bar with true color gradient"""
import json, sys
if sys.platform == 'win32':
    sys.stdout.reconfigure(encoding='utf-8')

data = json.load(sys.stdin)

BLOCKS = ' ▏▎▍▌▋▊▉█'
R = '\033[0m'
DIM = '\033[2m'

def gradient(pct):
    if pct < 50:
        r = int(pct * 5.1)
        return f'\033[38;2;{r};200;80m'
    else:
        g = int(200 - (pct - 50) * 4)
        return f'\033[38;2;255;{max(g,0)};60m'

def bar(pct, width=10):
    pct = min(max(pct, 0), 100)
    filled = pct * width / 100
    full = int(filled)
    frac = int((filled - full) * 8)
    b = '█' * full
    if full < width:
        b += BLOCKS[frac]
        b += '░' * (width - full - 1)
    return b

def fmt(label, pct):
    p = round(pct)
    return f'{label} {gradient(pct)}{bar(pct)} {p}%{R}'

model = data.get('model', {}).get('display_name', 'Claude')
parts = [model]

ctx = data.get('context_window', {}).get('used_percentage')
if ctx is not None:
    parts.append(fmt('ctx', ctx))

five = data.get('rate_limits', {}).get('five_hour', {}).get('used_percentage')
if five is not None:
    parts.append(fmt('5h', five))

week = data.get('rate_limits', {}).get('seven_day', {}).get('used_percentage')
if week is not None:
    parts.append(fmt('7d', week))

print(f'{DIM}│{R}'.join(f' {p} ' for p in parts), end='')
```

### Pattern 5: Braille Dots

```python
#!/usr/bin/env python3
"""Pattern 5: Braille dots - dotted progress bar using braille characters"""
import json, sys
if sys.platform == 'win32':
    sys.stdout.reconfigure(encoding='utf-8')

data = json.load(sys.stdin)

BRAILLE = ' ⣀⣄⣤⣦⣶⣷⣿'
R = '\033[0m'
DIM = '\033[2m'

def gradient(pct):
    if pct < 50:
        r = int(pct * 5.1)
        return f'\033[38;2;{r};200;80m'
    else:
        g = int(200 - (pct - 50) * 4)
        return f'\033[38;2;255;{max(g, 0)};60m'

def braille_bar(pct, width=8):
    pct = min(max(pct, 0), 100)
    level = pct / 100
    bar = ''
    for i in range(width):
        seg_start = i / width
        seg_end = (i + 1) / width
        if level >= seg_end:
            bar += BRAILLE[7]
        elif level <= seg_start:
            bar += BRAILLE[0]
        else:
            frac = (level - seg_start) / (seg_end - seg_start)
            bar += BRAILLE[min(int(frac * 7), 7)]
    return bar

def fmt(label, pct):
    p = round(pct)
    return f'{DIM}{label}{R} {gradient(pct)}{braille_bar(pct)}{R} {p}%'

model = data.get('model', {}).get('display_name', 'Claude')
parts = [model]

ctx = data.get('context_window', {}).get('used_percentage')
if ctx is not None:
    parts.append(fmt('ctx', ctx))

five = data.get('rate_limits', {}).get('five_hour', {}).get('used_percentage')
if five is not None:
    parts.append(fmt('5h', five))

week = data.get('rate_limits', {}).get('seven_day', {}).get('used_percentage')
if week is not None:
    parts.append(fmt('7d', week))

print(f' {DIM}│{R} '.join(parts), end='')
```

## References

- [Claude Code v2.1.80 Changelog](https://code.claude.com/docs/en/changelog#2-1-80)
- [Customize your status line](https://code.claude.com/docs/en/statusline)
