---
title: "日本語の手書きメモを書き起こせるOCRを探すために19モデルを片っ端から試した話"
description: "手書きメモの電子化がつらいので、Claude, Gemini, GPTからHunyuanOCR, GLM-OCRまで19モデルを3指標で比較しました。結論: Gemini 3.1 Proが最強です"
date: 2026-03-17
tags: [OCR, AI, Modal, 手書き, 評価]
author: 逆瀬川ちゃん
---

こんにちは！逆瀬川ちゃん ([@gyakuse](https://x.com/gyakuse)) です！

今日は日本語の手書きメモをいい感じに書き起こしてくれるOCRを探して、19モデルを片っ端から比較してみた話をまとめていきたいと思います。

<!--more-->

## 手書きメモは楽しいが電子化がつらい

わたしはいまだに手書きメモをよく書きます。打ち合わせの最中にさっと書いたり、アイデアを整理するときにペンで図を描いたり。手を動かしながら考えるのはとても楽しいし、タイピングとは違う思考の広がり方があります。

ただ問題は電子化です。ノートに書いたメモをあとからSlackやNotionに転記するのがとにかくつらい。自分の字を自分で読み返す作業がすでにつらいのに、それを打ち直すのは二重苦です。

OCRで自動化したいのですが、日本語の手書き文字って既存のOCRモデルにとってはかなり難しいタスクです。活字ならどのモデルでも高精度ですが、手書きとなると精度がガクッと落ちます。しかも最近はOCR専用モデルが爆発的に増えていて、[HunyuanOCR](https://github.com/Tencent-Hunyuan/HunyuanOCR)、[DeepSeek-OCR](https://arxiv.org/abs/2510.18234)、[olmOCR-2](https://huggingface.co/allenai/olmOCR-2-7B-1025-FP8)、[Chandra](https://github.com/datalab-to/chandra)...とどれを使えばいいのかわかりません。Claude、Gemini、GPTのような汎用VLMもOCR能力が急速に上がっていて、[LayerXのテックブログ](https://tech.layerx.co.jp/entry/2025/12/01/161913)や[GENSHI AIの検証記事](https://genshi.ai/articles/ocr-evaluation)でも取り上げられています。

じゃあ全部試して比べてみようか、ということでやってみました。

## 比較のしかた

ちゃんと比較するには「どう測るか」を先に決める必要があります。手書きメモは読み順が曖昧なケースが多い(縦書き横書き混在、矢印参照、囲み文字...)ので、単純なCER(Character Error Rate)だけだと読み順が違うだけで壊滅的なスコアになります。

そこで3つの相補的な指標を使いました。

| 指標 | ざっくり言うと | 主な用途 |
|------|---------------|---------|
| Hungarian NLS (primary) | 各領域のベストマッチで採点 | 読み順に依存しない本質的な精度 |
| Bag-of-Characters F1 | 文字の集合で比較、語順無視 | 純粋な文字認識精度 |
| CER | 全文のLevenshtein距離 | 読み順を含む総合品質 |

主指標のHungarian NLSは、正解データを領域単位で持っておいて領域ごとにベストマッチを探す方式です。詳しくは[Appendix: 評価指標の設計](#appendix-評価指標の設計)に書いています。

正解データの作成にはアノテーションツールも自作しました。画像をアップロードすると雑な前処理(紙面検出・傾き補正・影除去)が走ってからアノテーション画面に進みます。前処理のロジックはちゃんと検証できていないので精度は保証しませんが、ないよりはマシ程度のものです。詳しくは[Appendix: 画像前処理](#appendix-画像前処理)に書いています。

今回は手書きメモ画像6枚で評価しています(少ないですがまずは傾向を見たかった)。評価基盤のコードは [ocr-comparison](https://github.com/nyosegawa/ocr-comparison) で公開しています。

## 比較対象の19モデル

APIで呼べるモデル8つと、GPU上で動かすOSSモデル11個を比較しました。

OSSモデルは[Modal](https://modal.com)というサーバーレスGPUプラットフォームで動かしています。T4、L4、A100などのGPUをPythonのデコレータ一つで使えるので、ローカルにGPUがなくても評価できます。

| カテゴリ | モデル | ライセンス | 備考 |
|----------|--------|-----------|------|
| API | Gemini 3.1 Pro Preview | Proprietary | Deep thinking |
| API | Gemini 3 Flash Preview | Proprietary | |
| API | Gemini 3.1 Flash Lite Preview | Proprietary | |
| API | Claude 4.6 Opus | Proprietary | Adaptive thinking |
| API | Claude 4.5 Sonnet | Proprietary | Extended thinking |
| API | GPT-5.4 | Proprietary | Reasoning effort: high |
| API | Google Cloud Vision | Proprietary | |
| API | Azure AI Vision | Proprietary | |
| Modal (L4) | [HunyuanOCR](https://huggingface.co/tencent/HunyuanOCR) | Apache-2.0 | 1B |
| Modal (L4) | [DeepSeek-OCR](https://huggingface.co/deepseek-ai/DeepSeek-OCR) | MIT | |
| Modal (A100) | [Chandra](https://pypi.org/project/chandra-ocr/) | Apache-2.0 | |
| Modal (L4) | [Nanonets-OCR-s](https://huggingface.co/nanonets/Nanonets-OCR-s) | Apache-2.0 | 4B |
| Modal (L4) | [olmOCR-2](https://huggingface.co/allenai/olmOCR-2-7B-1025-FP8) | Apache-2.0 | 7B FP8 |
| Modal (T4) | [GOT-OCR 2.0](https://huggingface.co/stepfun-ai/GOT-OCR2_0) | Apache-2.0 | |
| Modal (T4) | [PaddleOCR](https://github.com/PaddlePaddle/PaddleOCR) | Apache-2.0 | |
| Modal (T4) | [YomiToku](https://github.com/kotaro-kinoshita/yomitoku) | CC-BY-NC-SA-4.0 | 日本語特化 |
| Modal (T4) | [GLM-OCR](https://huggingface.co/zai-org/GLM-OCR) | MIT | 0.9B |
| Modal (CPU) | [NDLOCR-Lite](https://github.com/ndl-lab/ndlocr-lite) | CC-BY-4.0 | 国立国会図書館 |
| Modal (A10G) | [NDLOCR v2](https://github.com/ndl-lab/ndlocr_cli) | CC-BY-4.0 | 国立国会図書館 |

このうちDeepSeek-OCR、GOT-OCR 2.0は日本語非対応、Nanonets-OCR-sは公式が手書き未学習と明言しているモデルです。olmOCR-2も公式には英語PDFフォーカスで日本語サポートを明記していません。OCRベンチマークで名前を見かけることが多いので一応全部入れてみました。無茶振りした結果がどうなったかは後述します。

YomiTokuはCC-BY-NC-SA-4.0なので商用利用には注意が必要です。それ以外のOSSモデルはApache-2.0かMITなので商用でも使えます。

## 結果

手書きメモ6枚に対する評価結果です(Hungarian NLS降順)。

| Rank | モデル | カテゴリ | NLS | BoC-F1 | CER | Avg Time |
|------|--------|----------|-----|--------|-----|----------|
| 1 | Gemini 3.1 Pro Preview | API | 0.924 | 0.929 | 0.205 | 67.9s |
| 2 | Gemini 3 Flash Preview | API | 0.918 | 0.910 | 0.221 | 18.7s |
| 3 | Gemini 3.1 Flash Lite Preview | API | 0.899 | 0.917 | 0.207 | 13.7s |
| 4 | Claude 4.6 Opus | API | 0.897 | 0.896 | 0.225 | 74.9s |
| 5 | Azure AI Vision | API | 0.830 | 0.845 | 0.332 | 4.2s |
| 6 | Google Cloud Vision | API | 0.820 | 0.783 | 0.509 | 2.2s |
| 7 | YomiToku | Modal | 0.770 | 0.768 | 0.400 | 12.0s |
| 8 | GLM-OCR | Modal | 0.738 | 0.792 | 0.387 | 29.7s |
| 9 | Chandra | Modal | 0.734 | 0.780 | 0.361 | 29.2s |
| 10 | olmOCR-2 | Modal | 0.723 | 0.786 | 0.370 | 45.4s |
| 11 | GPT-5.4 | API | 0.714 | 0.814 | 0.331 | 123.4s |
| 12 | HunyuanOCR | Modal | 0.698 | 0.754 | 0.367 | 30.3s |
| 13 | Claude 4.5 Sonnet | API | 0.640 | 0.709 | 0.465 | 16.4s |
| 14 | Nanonets-OCR-s | Modal | 0.557 | 0.597 | 0.615 | 69.1s |
| 15 | DeepSeek-OCR | Modal | 0.446 | 0.530 | 0.671 | 35.4s |
| 16 | PaddleOCR | Modal | 0.353 | 0.394 | 0.784 | 12.8s |
| 17 | NDLOCR-Lite | Modal | 0.271 | 0.394 | 0.915 | 10.5s |
| 18 | GOT-OCR 2.0 | Modal | 0.194 | 0.250 | 0.888 | 10.2s |
| 19 | NDLOCR v2 | Modal | 0.064 | 0.087 | 0.958 | 28.7s |

Avg Timeは1画像あたりの平均処理時間です。Modalモデルはバッチ処理の合計時間を画像数で割っているので、コールドスタートを含む点に注意してください。

### Geminiが強い

一番驚いたのはGemini系の安定した強さです。Gemini 3.1 Pro PreviewがNLS 0.924で1位、しかもFlash Lite(最軽量モデル)ですらNLS 0.899でClaude 4.6 Opusと同等レベルです。日本語手書きOCRに関してはGeminiが頭一つ抜けています。

Claude 4.6 Opusは4位でNLS 0.897。十分に高いのですが、Claude 4.5 Sonnetが12位(NLS 0.640)とかなり落ちるのは興味深いです。同じClaude系でもモデルの世代で大きな差があります。

### GPT-5.4は意外と低い

GPT-5.4は10位(NLS 0.714)で、APIモデルの中では意外と振るいません。英語のOCRベンチマークでは強いモデルですが、日本語の手書きメモという条件では苦戦しています。BoC-F1が0.814と高めなのに対してNLSが0.714なので、文字自体は読めているけど領域のマッチングでスコアを落としている可能性があります。

### OSSモデルではYomiTokuが健闘

OSSモデルの中ではYomiToku(7位, NLS 0.770)が最上位です。日本語特化の設計が効いています。Chandra(8位)もNLS 0.734で健闘しています。

一方でPaddleOCR、NDLOCR系は手書き文字がかなり厳しいです。NDLOCR v2は国立国会図書館が公開しているモデルで活字の印刷文書には強いのですが、手書きメモは守備範囲外のようです。

### 無茶振りしたモデルたちの反応が面白い

さて、前述のとおり日本語非対応や手書き未学習のモデルにも無茶振りしてみたわけですが、それぞれの反応が面白かったので紹介します。

olmOCR-2は英語PDFフォーカスのモデルで日本語サポートは明記されていません。ところが蓋を開けてみるとNLS 0.723でGPT-5.4(0.714)を超えて9位にランクインしました。ベースモデルがQwen2.5-VLなので、その多言語能力が高すぎるせいか英語特化のチューニングをされていても日本語の手書きを読めてしまうようです。VLMの地力の恐ろしさを感じます。A100が必要なChandraに対してolmOCR-2はL4で動くので、コスパでも優秀です。

DeepSeek-OCRは日本語非対応なのですが、単にエラーを出すのではなく日本語の手書き文字を中国語に「翻訳」して出力してくるのが特徴的でした。「SDKを」が「SD卡」(SDカードの中国語)になり、「permission mode auto対応」が「自动权限模式」になります。分からない日本語の手書き文字を見て文脈から推測し、母国語で出力してしまうというVLM特有のハルシネーションです。

GOT-OCR 2.0は580Mと超軽量なモデルで、英語・中国語のみ対応です。日本語の手書きメモを見せた結果はNLS 0.194で、ログを見ると数字やごく一部の英数字だけを拾って `Cadi g/ Agent Bif f Application y` のような出力になっています。非対応言語に対しては記号や数字だけ拾おうとする、従来型OCRに近い挙動です。

Nanonets-OCR-sは公式が手書きは未学習と明言しているモデルです。手書きメモを見せた結果、一部の画像でパニックを起こして `> > > > > >` や `1111...` といった無意味な文字を数千文字にわたって出力し続ける生成ループに陥りました。この画像では文字エラー率(CER)が2100%(21倍)という異常値を叩き出しています。repetition_penaltyを上げて対処しましたが、未学習の入力に対するVLMの脆さが見えた瞬間でした。

### 速度と精度のトレードオフ

Avg Timeを見ると面白い傾向が見えます。Google Cloud Visionが2.2s、Azure AI Visionが4.2sと専用OCR APIはやはり速いです。精度もNLS 0.82〜0.83あるので、速度重視ならこの2つは十分選択肢に入ります。

Gemini 3.1 Flash Liteは13.7sでNLS 0.899。精度と速度のバランスが一番いいのは実はこのモデルかもしれません。Proは67.9sかかるのでFlash Liteの5倍遅いですが、精度の差はNLS 0.024しかありません。

GPT-5.4は123.4sで圧倒的に遅いです。reasoning effort: highで推論させているので仕方ないのですが、それだけ時間をかけてNLS 0.714というのはコスパが悪いです。

OSSモデルではYomiTokuが12.0sで最速クラスかつ精度も最上位(NLS 0.770)なので、速度・精度・コストの三拍子が揃っています。ただしModalのコールドスタートを含む時間なので、常時起動している環境ならもっと速いはずです。

### 実際の出力を見てみる

数字だけだとピンとこないので、実際の手書きメモ画像と各モデルの出力を[Appendix: 画像別OCR出力例](#appendix-画像別ocr出力例)に全部載せています。

## 結論: 手書きメモの書き起こしにはGemini

精度最優先ならGemini 3.1 Pro Preview(NLS 0.924, 67.9s)が現時点で最良の選択です。NLS 0.924は「だいたい読めている」水準で、多少の読み間違いはあるもののざっくり電子化するには十分使えます。

ただし実用を考えると、Gemini 3.1 Flash Lite Preview(NLS 0.899, 13.7s)のほうがバランスがいいかもしれません。精度差わずか0.025で5倍速いです。

速度重視ならGoogle Cloud Vision(NLS 0.820, 2.2s)やAzure AI Vision(NLS 0.830, 4.2s)が選択肢に入ります。精度は上位モデルに劣りますが、大量のメモを一気に処理したいケースでは現実的です。

OSSモデルで手元で動かしたい場合はYomiToku(NLS 0.770, 12.0s)が精度・速度・コストの三拍子揃っています。

ただし注意点として、今回の評価は手書きメモ6枚と少数なので、画像数を増やすとランキングが変動する可能性は十分あります。評価基盤は[公開している](https://github.com/nyosegawa/ocr-comparison)ので、自分のメモで試してみるのが一番確実です。

## まとめ

- 日本語手書きメモのOCRに使えるモデルを探して19モデルを比較しました
- Gemini 3.1 Pro Preview (NLS 0.924) が最高精度で、Flash Liteでもほぼ同等です
- OSSではYomiToku (NLS 0.770) が健闘しています
- 評価コードは [ocr-comparison](https://github.com/nyosegawa/ocr-comparison) で公開しています

## 追記 (2026-03-17): GLM-OCRを追加して19モデルに

記事公開後に[GLM-OCR](https://huggingface.co/zai-org/GLM-OCR)を入れ忘れていたことに気づいたので追加しました。

GLM-OCRはCogViT (0.4B) + GLM-0.5Bの合計0.9Bパラメータという超軽量モデルで、[OmniDocBench V1.5](https://arxiv.org/abs/2412.07626)で1位のスコアを記録しています。vLLMでは`glm_ocr`アーキテクチャがまだ未サポートだったので、transformersのソースビルドで直接推論しています。

結果はNLS 0.738で8位にランクインしました。0.9Bでこの精度はかなり優秀です。T4 GPUで動くのでModalのコストも安く、A100が必要なChandra(NLS 0.734)とほぼ同じ精度をT4で出せるのはコスパが光ります。

OSSモデルのパラメータ数を並べるとolmOCR-2が7B、Nanonetsが4B、HunyuanOCRが1Bで、GLM-OCRの0.9Bは最軽量クラスです。それでNLS 0.738はパラメータ効率がかなり高いと言えます。

出力を見ると「比較」が「比较」(簡体字)になっていたり、DeepSeek-OCRと似た中国語リークが出ています。ベースモデルのGLMが中国語に強いので、日本語の漢字を簡体字で出力してしまうケースがあるようです。一方で「Agent skill が Web App を wrap」のような英語混在部分はそこそこ読めていて、0.9Bにしては頑張っています。

上の結果テーブルとモデル一覧は更新済みです。

## Appendix: 画像別OCR出力例

実際の手書きメモ画像と各モデルのOCR出力を並べて見てみます。モデルごとの得意・不得意がよくわかります。

### サンプル1: 技術メモ(短い箇条書き)

![サンプル1](/img/japanese-handwriting-ocr-comparison/sample1.jpg)

正解テキスト:

```
CodingAgent時代のApplication考
麻雀AIをCodingAgentで
VSR → うまくいかん
仕様書の腐敗について
```

#### Gemini系

Gemini 3.1 Pro Preview (NLS=0.890)
```
・ Coding Agent 時代の Application/S
・ 麻雀 AI を Coding Agent で
・ VSR -> 外でいかん
- 仕様書の腐敗について.
```

Gemini 3 Flash Preview (NLS=0.840)
```
Coding Agent 時代の Application/s
麻雀 AI を Coding Agent で
VSR -> 外でかく
仕様書の腐敗について.
```

Gemini 3.1 Flash Lite Preview (NLS=0.865)
```
・CodingAgent時代のApplication/s
・麻雀AIをCodingAgentで
・VSR→外注とか
・仕様書の腐敗について
```

#### Claude系

Claude 4.6 Opus (NLS=0.890)
```
· Coding Agent 時代の Applications
· 麻雀 AI を Coding Agent で
　, USR → みていかん
· 仕様書の腐敗について。
```

Claude 4.5 Sonnet (NLS=0.656)
```
CodingAgent の Applications
麻雀 A I と CodingAgent で
VSR -> 外に出る
仕事, 商談について
```

#### OpenAI

GPT-5.4 (NLS=0.589)
```
CodingAgent with Applications
麻雀 AIと CodingAgentで
VSR -> みじかく
仕事を簡略化って?
```

#### Google Cloud Vision / Azure

Google Cloud Vision (NLS=0.782)
```
Coding Agent mit Application's
麻雀
AI & Coding Agent
VSRろぐかん
仕様の腐敗について
で
```

Azure AI Vision (NLS=0.807)
```
Coding Agent af Applications
麻雀AL CodingAgentで
USR →引くいかん
仕様書の肩題について
```

#### OSSモデル(Modal GPU)

HunyuanOCR (NLS=0.636)
```
CodingAgent 時代の Applications
麻雀 AI と CodingAgent の
VSR → 3 人が 1 人
任務者の腐敗の 2 人
```

Chandra (NLS=0.722)
```
・ Coding Agent の Application/S
・ 麻雀 AI と Coding Agent で
・ VSR -> 31C がん
・ 仕様書の修正についと
```

olmOCR-2 (NLS=0.681)
```
・ CodingAgent 以外の Application/s
・ 麻雀 AI と CodingAgent で
・ VSR → 31C が人
・ 任課者の発表について
```

YomiToku (NLS=0.608)
```
S/mairmoi day 6 yha zuag (aipe).
、麻雀AZをCodingAgutで
VSR →31C、かん
、仕様もの周防について
```

GLM-OCR (NLS=0.690)
```
、Coding Agent 時代のApplication
、麻雀 AIをCoding Agentで
、VSR、トリックが人
、任作きの商談について。
```

DeepSeek-OCR (NLS=0.468)
```
CodingAgent 应用 Application's
  麻省 A2z CodingAgent
  VSR -> 31C -> 7C
  在线考，有改 -> 7C
```

GOT-OCR 2.0 (NLS=0.220)
```
Cadi g/ Agent Bif f Application y
```

PaddleOCR (NLS=0.000)
```
X
享
E
はトイ
```

NDLOCR v2 (NLS=0.010)
```
Ta
〓
〓〓
〓
```

「VSR → うまくいかん」の部分が面白くて、ほぼ全モデルが読み間違えています。Gemini Proですら「外でいかん」になるし、GPT-5.4は「みじかく」、HunyuanOCRは「3 人が 1 人」、DeepSeek-OCRに至っては中国語が混入しています。手書き文字のくずし方が激しい部分はやはり難しいです。

一方で「仕様書の腐敗について」は上位モデルはほぼ正確に読めていて、GPT-5.4やClaude 4.5 Sonnetが「仕事を簡略化って?」「仕事, 商談について」と全然違う内容になっているのは意外です。

### サンプル2: 技術メモ(英語混在)

![サンプル2](/img/japanese-handwriting-ocr-comparison/sample2.jpg)

正解テキスト:

```
permission mode auto対応
作り直すのもありかも
SDKを
比較したい
HarmonyとSDKを渡して
AgentSkillがWebAppをwrapするべきか
webAppがAgentをwrapするべきか
(及びSkill)
```

#### Gemini系

Gemini 3.1 Pro Preview (NLS=0.833)
```
・permission mode auto 化
・作りかたのわかりやすさ
　↳ SDKで
比較したい。
Harmony と SDK を通して。
Agent skill が Web App を wrap するべきか
Web App が Agent を wrap するべき
　(Agent skill)
```

Gemini 3 Flash Preview (NLS=0.823)
```
permission mode auto 以外
作りながら切りだす
↳ SDKを
比較したい…
Harmony と SDK を並べて、
Agent skill が Web App を wrap するべきか
web App が Agent を wrap するべきか
(Agent skill)
```

Gemini 3.1 Flash Lite Preview (NLS=0.811)
```
permission mode auto みたいな
作り方のちがいとか
↓ SDK
比較したい
Harmony と SDK を抜いて
Agent skill が Web App を wrap するのか
Web App が Agent を wrap するのか
(Agent Skill)
```

#### Claude系

Claude 4.6 Opus (NLS=0.833)
```
・permission mode auto対応
・割り方のとりまとめ。
　→ SDKを。
比較したい。
Harmony と SDK を抜いて。
Agent skill が Web App を wrap するのか
Web App が Agent を wrap するのなら
（及びskill）
```

Claude 4.5 Sonnet (NLS=0.633)
```
paralyzion mode auto 4k
/1140/10/24/3'4
⊂ SDK
etkizh...
Harmony と SDK を抜いて
Agent stall & Web App を wrap したい
Web App が Agent を wrap (7/22名
(AgShell)
```

#### OpenAI

GPT-5.4 (NLS=0.624)
```
permission mode auto化
権限まわりとか
↳ SDKを
etc etc...
Harmony と SDK を使って。
Agent skill が Web App を wrap するだけ
Web App が Agent を wrap するなら
(API Shield)
```

#### Google Cloud Vision / Azure

Google Cloud Vision (NLS=0.699)
```
pernission mode
auto kitin
作物ものもありかも
SDKE
ettech...
HarmonyとSDKを渡して、
Agent stall & Web App & wrap 18-246'
Web App 6° Agent & wrap 17-925-
(Ari Skild)
```

Azure AI Vision (NLS=0.669)
```
permission mode auto .
倒なものもありがと
→ SDKE
比較したい、
HarmonyとCDKを渡して、
Ageat full of Web App 2 wrap is it!
Web App t" Agail & wrap 11 22.6
(Anislil)
```

#### OSSモデル(Modal GPU)

HunyuanOCR (NLS=0.695)
```
・permission mode auto kill
・倒すのがやすい
・＜SDK＞
・比較したい
・HarmonyとCDKを使う
・Agent skill とWeb App をwrap 行う
・Web App とAgent をwrap 行う
・（Agent skill）
```

GLM-OCR (NLS=0.666)
```
permission mode auto talk
徘行の比較式。
→ SDKを。
比较。
HarmonyとSDKを接って。

Agent skill 6 Web Appを wrap 13 でか
Web App 6 Agentを wrap 11 でか
(Agent skill)
```

Chandra (NLS=0.693)
```
permission mode auto kill
例のインテリゲンス
↳ SDK
比較した...
Harmony & SDK と比較して...
Agent Skill は Web App と wrap する
Web App は Agent と wrap する
(AniSkill)
```

olmOCR-2 (NLS=0.767)
```
・permission mode auto
・例物のおります。
　→ SDK
・比較した。
Harmony と SDK を渡して。
Agent Skill が Web App と wrap に渡す
Web App が Agent と wrap に渡す
(外部Skill)
```

YomiToku (NLS=0.626)
```
perallsilon mode auto khi.
1.4/14761.4/13/ .
3/45 m
比較したい.
Marmony と SDKを推して、
Ageal skall 6' Wob App ? wrap li t'b'
Web App bi Ageil e wrap Ti 325
(Azislall)
```

DeepSeek-OCR (NLS=0.503)
```
permission mode auto 优先
  自动权限模式
   SD卡
   etc...
   Harmony 和 SDK 接口
   Agent shell 6 Web App 2 wrap 11.2.6
   Web App 6 Agent 2 wrap 11.2.6
   (A2shell)
```

GOT-OCR 2.0 (NLS=0.140)
```
per a is ton model eau to Hi
```

PaddleOCR (NLS=0.083)
```
S
i
```

英語と日本語が混在していて、`AgentSkillがWebAppをwrapするべきか`のようなコード用語交じりの手書きテキストです。Gemini ProとClaude Opusは「Agent skill が Web App を wrap するべきか」とほぼ正確に読めています。

下位モデルでは`wrap`が数字の羅列になったり(Google Cloud Vision: `wrap 18-246'`)、まったく別の文になったり(Azure: `Ageat full of Web App 2 wrap is it!`)しています。DeepSeek-OCRが日本語部分を中国語で出力しているのも特徴的です(`自动权限模式`、`SD卡`)。

## Appendix: 評価指標の設計

### Hungarian NLS (primary)

正解データの各領域に対して、予測テキストの中から最もマッチする行を見つけてNormalized Levenshtein Similarityを計算します。

```
正解領域: ["東京都", "渋谷区", "恵比寿1-2-3"]
予測テキスト: "渋谷区\n東京都\n恵比寿1-2-3"

→ 読み順が違っても各領域が正しく認識されていれば高スコア
```

VLMが正解領域を結合して出力するケース(「東京都渋谷区」のように1行にまとめる)や、逆に正解領域を分割するケース(「恵比寿」「1-2-3」に分ける)にも対応するため、隣接行のマージ候補と部分文字列マッチも組み込んでいます。

名前の由来は本来のHungarian Algorithmによる最適割当ですが、実装上は各正解領域に対して全予測行の中からベストスコアを取るGreedyマッチングです。正解領域間の重複マッチを許容することで、VLMが複数領域を結合して出力するケースに対応しています。

### Bag-of-Characters F1 (secondary)

[CC-OCR](https://arxiv.org/abs/2412.02210)のアプローチを参考にした指標です。テキストを文字の多重集合(multiset)として扱い、語順・改行を完全に無視してPrecision/Recall/F1を計算します。

```python
gt_chars  = Counter("東京都渋谷区")  # {'東':1, '京':1, '都':1, '渋':1, '谷':1, '区':1}
pred_chars = Counter("東京都渋谷区恵比寿")
matched = sum((gt_chars & pred_chars).values())  # 6
precision = 6/9, recall = 6/6
```

VLMがマークダウン記法や説明文を付け足す場合にPrecisionが下がるので、ノイズ検出にも使えます。

### CER / NED (tertiary)

全文をフラットに連結してLevenshtein距離を計算する古典的な指標です。CERは正解テキストの長さで重み付け集計しています。

### テキスト正規化

3つの指標すべてで共通の正規化パイプラインを通します。

1. Markdownストリップ — VLMが付けがちな`##`見出し、`**太字**`、リスト記号等を除去
2. VLMノイズ除去 — `・`や`☆`などの装飾文字、`（丸で囲まれている）`のようなメタ記述、絵文字を除去
3. NFKC正規化 — 全角英数字を半角に統一
4. 空白・句読点の除去(BoC/NED計算時)

この正規化がないとVLMの出力がめちゃくちゃ不利になります。マークダウン記法を付けてくる時点で「テキストは正しく読めている」のに、記法のせいでスコアが下がるのは不公平なので。ただし過剰な正規化はモデル間の差を消してしまうので、「明らかにOCR対象外の記号」だけを除去するよう慎重にルールを設計しています。

## Appendix: 画像前処理

アノテーションツールに画像をアップロードすると、OCRに渡す前に以下の前処理パイプラインが走ります。正直なところロジックの検証は甘いので、うまく効かないケースもあると思います。ないよりマシ程度の雑な実装です。

1. 紙面検出・切り出し — OpenCVのOtsu二値化 + モルフォロジー閉操作で紙面領域を検出し、`minAreaRect`で4点を取って透視変換で切り出します。紙面が画像面積の15%未満なら検出失敗として元画像をそのまま使います
2. 粗い向き補正(0/90/180/270°) — [docTR](https://github.com/mindee/doctr)のMobileNetV3ベースの向き推定器を使っています。confidence 0.7未満なら回転しません
3. 細かい傾き補正 — [jdeskew](https://github.com/phamquiluan/jdeskew)で微小角度(0.3°〜15°)の傾きを補正します
4. 影除去 + コントラスト強調 — `medianBlur`で背景推定して除算で照明ムラを除去し、CLAHEでコントラストを上げます

とくに1の紙面検出は、背景と紙のコントラストが低いケースや紙が折れ曲がっているケースで失敗することがあります。失敗しても元画像にフォールバックするので壊れはしませんが、余白が多い状態でOCRに渡されることになります。

## Appendix: Modalで19モデルを動かす

OSSモデルの評価には[Modal](https://modal.com)を使っています。サーバーレスGPUプラットフォームで、T4、L4、A100などのGPUをPythonのデコレータ一つで使えます。

各モデルのModalスクリプトは統一的なインターフェースに従います。

```python
@app.function(gpu="L4", image=image, timeout=1800)
def run_ocr(images_b64: list[str]) -> list[str]:
    # base64画像を受け取り、OCR結果のテキストリストを返す
    ...

@app.local_entrypoint()
def main(input: str, output: str):
    from _common import load_input, save_output
    data = load_input(input)
    results = run_ocr.remote(data["images"])
    save_output(output, results)
```

入力はbase64エンコードした画像のJSON、出力はOCRテキストのJSON。この規約を守れば新しいモデルの追加が簡単です。ハマりどころ(PaddlePaddleのGPU版指定、`libgl1`依存、CUDAバージョン等)は[AGENTS.md](https://github.com/nyosegawa/ocr-comparison/blob/main/AGENTS.md)にまとめてあります。

## References

- [ocr-comparison (GitHub)](https://github.com/nyosegawa/ocr-comparison)
- ベンチマーク
    - [CC-OCR: A Comprehensive and Challenging OCR Benchmark for Evaluating Large Multimodal Models in Literacy](https://arxiv.org/abs/2412.02210)
    - [OCRBench v2: An Improved Benchmark for Evaluating Large Multimodal Models](https://arxiv.org/abs/2501.00321)
- モデル
    - [GLM-OCR (zai-org)](https://huggingface.co/zai-org/GLM-OCR)
    - [HunyuanOCR (Tencent)](https://github.com/Tencent-Hunyuan/HunyuanOCR)
    - [DeepSeek-OCR](https://arxiv.org/abs/2510.18234)
    - [GOT-OCR 2.0](https://arxiv.org/abs/2409.01704)
    - [olmOCR-2 (Allen AI)](https://huggingface.co/allenai/olmOCR-2-7B-1025-FP8)
    - [PaddleOCR](https://github.com/PaddlePaddle/PaddleOCR)
    - [YomiToku](https://github.com/kotaro-kinoshita/yomitoku)
    - [NDLOCR (国立国会図書館)](https://github.com/ndl-lab/ndlocr_cli)
- 関連記事
    - [OCR技術の変遷と日本語対応モデルの性能検証 (LayerX)](https://tech.layerx.co.jp/entry/2025/12/01/161913)
    - [医療文書に対するOCR精度検証 (GENSHI AI)](https://genshi.ai/articles/ocr-evaluation)
    - [8 Top Open-Source OCR Models Compared (Modal Blog)](https://modal.com/blog/8-top-open-source-ocr-models-compared)
- インフラ
    - [Modal](https://modal.com)
