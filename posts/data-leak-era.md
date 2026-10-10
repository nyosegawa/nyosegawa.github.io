---
title: "個人情報漏洩が日常になってしまった世界でどうしていくべきか"
description: "2026年は大規模な個人情報の漏洩が続いています。いま何が流出しているのか、流出した情報でどんな連絡が届くのか、わたしたちは何をすればいいのかを、グラフと例でまとめます。"
date: 2026-10-10
tags: [セキュリティ, 個人情報, 情報漏洩, フィッシング, ディープフェイク]
author: 逆瀬川ちゃん
---

こんにちは！逆瀬川ちゃん ([@gyakuse](https://x.com/gyakuse)) です！

今日は個人情報がどんどん流出していく時代に、わたしたちは何をすればいいのかを考えていきたいと思います。

<!--more-->

## 今週だけでも

さいきん個人情報の漏洩のニュースが本当に多いです。10月7日から9日にかけては政府機関が相次いで「不正アクセスによる漏洩が続いている」と注意を呼びかけていました。同じ週だけでもスカイチケット(約1,464万件)、ビッグエコー(約872万件)、ブックオフ(最大約643万件)、ローソンID(約216万件)の漏洩が公表されています。これらに登録しているひとはけっこう多そうです。

そこで国内外の漏洩と、流出した情報が悪用された例を集めてみました。

## いまどれくらい流出しているのか

![上場企業の100万件以上の漏洩の件数](/img/data-leak-era/tsr-over-1m.png)

東京商工リサーチの集計を見ると、上場企業の100万件以上の漏洩は2025年が1年で6件でした。2026年は10月5日の時点ですでに10件あります。1,000万件以上の漏洩にいたっては2025年までの14年間で3件だったのに、2026年だけで3件起きています。

上場していない会社も含めてこれまでの大きな漏洩と並べるとこうなります。

![国内の大きな漏洩](/img/data-leak-era/history.png)

青が2026年に公表されたものです。「歴代最大級」と言われたベネッセ(2014年)に近い規模の漏洩が今年はいくつも起きています。

### 何が流出したか

![流出した情報の種類](/img/data-leak-era/datatype.png)

氏名、メールアドレス、電話番号はほとんどの漏洩に入っています。今年は身分証の画像まで流出し始めました。タイムズカーでは運転免許証などの画像が約160万件流出して、金融庁が金融機関に画像での本人確認をやめるよう求めるところまで来ています。

### どこから漏洩したか

![漏洩の原因](/img/data-leak-era/cause.png)

アプリやシステムの弱点、盗まれたパスワード、ランサムウェア、委託先などが並んでいます。どれも利用者の側ではどうしようもないものばかりで、3分の1は原因も公表されていません。

自分がどれだけ気をつけていても、漏洩は止められません。次は、流出した情報がそのあとどう使われるのかを見ていきます。

<aside class="promo">
<p class="promo-label">ここでいったんCMです。</p>
<p class="promo-message">デスクトップ向けのアシスタントを作りました！よかったら使ってみてください。</p>

[![ASIST: 話しかけるだけで、予定もメールも片づく。Mac と Windows で使えるリアルタイムアシスタント](/img/speech-cpp/asist-banner.jpg)](https://asist-agent.com/)

<p class="promo-links"><a class="promo-button promo-primary" href="https://asist-agent.com/">公式サイトを見る</a><a class="promo-button" href="https://github.com/nyosegawa/asist">GitHub</a></p>
</aside>

## 流出したら何が起きるのか

### ばらばらの情報が1人分にまとまる

![犯人が1人分の情報をまとめた例](/img/data-leak-era/profile.png)

1つのサービスから流出するのはその人の情報の一部だけです。ところがメールアドレスや電話番号が同じものをつなげていくと、上のように1人分の詳しい情報がまとまってしまいます。ここから先の例は会社も人物も番号も顔の画像もすべて架空のもので、黄色の部分が流出した情報から分かるところです。

こういう情報を持った相手から次のような連絡が届きます。

### 「漏洩のお詫び」のメール

![漏洩のお詫びを装うメールの例](/img/data-leak-era/mock-apology-mail.png)

プロバイダーのインターリンクを名乗って、こんな感じの偽の「流出のお詫び」メールが実際に送られています。面白いのは(面白くはないんですが)、インターリンク自体は漏洩していないことです。お詫びメールに似せた文面なら、どの会社の名前でも詐欺に使えてしまいます。ちなみにこの秋の大きな漏洩のあとに偽のお詫びメールが届いたという報告はまだありません。

### 予約番号を知っているメッセージ

<img src="/img/data-leak-era/mock-booking.png" alt="ホテルの予約番号を書いた偽のメッセージの例" width="340">

2026年5月にはBooking.comでホテルを予約した人にこんなメッセージがWhatsAppで届いています。氏名も予約番号も宿泊日もすべて正しかったそうです。これはさすがに信じてしまいそうです。

### 「警察」からの電話

<img src="/img/data-leak-era/mock-police-call.png" alt="自分の情報を言い当てる警察を名乗る電話の例" width="340">

ニセ警察詐欺の被害は2025年だけで約1,005億円ありました。トビラシステムズの調査では、本物だと信じた人の54.1%が「相手が自分の情報を知っていたから」と答えています。

### 顔が見えるビデオ通話

<img src="/img/data-leak-era/mock-video-call.png" alt="AIで作った顔の警察官とのビデオ通話の例" width="340">

2025年にはAIで作った顔の「警察官」がビデオ通話に出てくる詐欺グループが逮捕されています。ちなみにこの画像の男性もAIで作った架空の人物です。実在の人に見えないように、この記事の人物はわざと3DCG風にしています。

### 自宅に届く手紙

![補償金の案内を装う手紙の例](/img/data-leak-era/mock-letter.png)

海外では暗号資産ウォレットのLedgerを名乗る偽の手紙が届いています。日本でも2024年に国民生活センターを名乗る電話とハガキがありました。

### どんな手段で来るか

![流出した情報の悪用はどんな手段で来たか](/img/data-leak-era/channels.png)

集めた例を数えてみると、いちばん多いのは電話でメールよりも多くなっていました。

## 顔も声もAIで作れる

![Webサイトの顔の画像1枚からビデオ会議の画面を作る](/img/data-leak-era/face-material.png)

試しに左の画像1枚だけを元にして、ビデオ会議に映っているような右の画像を作ってみたら、約20秒でできました。左の画像は会社の役員紹介ページに載っている写真を想定したもので、どちらもAIで作った架空の人物です。ここではわざと3DCG風にしていますが、写真と見分けがつかないような画像も同じくらいの手間で作れます。

実際に香港では偽の上司や同僚が出てくるビデオ会議で約2,500万ドルが送金されています(2024年)。イタリアでは国防相の声をまねた電話で約100万ユーロが送金されました(2025年)。

## これから増えそうなこと

![犯人がなりすましてAIのサポートに頼む例](/img/data-leak-era/mock-ai-support.png)

AIのサポートがだまされる例も出てきました。Meta AIのサポートをだましてInstagramを乗っ取る手口では、Metaが少なくとも2万225人に通知しています。この場合は本物の利用者には何の知らせも来ないのがつらいところです。

ほかにも自分のAIアシスタントがメールに隠された指示で動かされたり、会話できるAIが一人ひとりに合わせた詐欺電話を大量にかけたりするのは、そう遠くないうちに起きそうだな〜と思っています。

## わたしたちにできること

### 信じるかどうかの決め方を変える

相手が自分の情報を知っていても、顔が見えても、声が家族でも、本物とは限りません。連絡が来たら公式アプリや自分でブックマークしたサイト、カードの裏の電話番号から自分で確かめるのがいちばんです。

届いたリンクや電話番号やQRコードは使わないようにします。「急いで」「誰にも言わないで」「補償が受けられなくなる」と言われたら、いったん手を止めます。警察が電話やビデオ通話でお金の話をすることはありません。職場なら振込先の変更はメール以外の方法で確かめるようにしておくと安心です。

### 私たちがやれること

すぐできることを大事な順に並べるとこうなります。

1. メールとApple・Googleのアカウントにパスキーか2段階認証を設定します
2. パスワードの使い回しをやめます。パスワードマネージャーを使うのが楽です
3. カードと銀行の利用通知をオンにします
4. 携帯電話会社の契約に暗証番号を設定します
5. 家族と合言葉を決めておきます

Meta AIの件で被害に遭ったのも2段階認証をしていないアカウントでした。1と2をやっておくだけでも、流出した情報だけでは乗っ取られにくくなります。

### 漏洩のお知らせが来たら

| 流出したもの | やること |
|---|---|
| パスワード | 同じパスワードを使っているところも全部変える |
| カード番号 | カード会社に連絡する |
| 住所や電話番号 | その会社を名乗る連絡は、まず偽物だと思って扱う |
| 身分証の画像 | 信用情報機関(CICなど)の本人申告制度で、なりすましへの注意を登録する |

### 渡す情報を減らす

使っていないアカウントは消して、任意の項目は入力しないようにしておきます。顔や声の入った動画を誰に公開しているかも、一度見直しておくといいと思います。

## まとめ

- 漏洩はもう個人では防げないので、流出しても困らない準備を先にしておくのがよさそうです
- 知らない相手からの連絡は中身が正しくても、公式サイトや公式アプリで確かめてから動きます

## References

- 政府機関の注意喚起
    - [IPA: 不正アクセスによる漏えい等の事案を踏まえ、速やかに実施すべき対策等について](https://www.ipa.go.jp/security/security-alert/2026/alert20261009.html)
    - [JPCERT/CC: 直近で相次いでいる国内組織における不正アクセスに関する注意喚起](https://www.jpcert.or.jp/at/2026/at260030.html)
    - [個人情報保護委員会: 大規模な漏えい等事案を踏まえた対応について(注意喚起)](https://www.ppc.go.jp/news/careful_information/261007_alert/)
- 統計
    - [東京商工リサーチ: 上場企業「個人情報漏えい」、過去最悪ペース](https://www.tsr-net.co.jp/data/detail/1203305_1527.html)
    - [警察庁: ニセ警察詐欺に注意!](https://www.npa.go.jp/bureau/safetylife/sos47/new-topics/241218/02.html)
    - [警察庁: 令和7年の特殊詐欺の認知・検挙状況等](https://www.npa.go.jp/bureau/safetylife/sos47/assets/img/new-topics/detail/260605/01/01.pdf)
- 漏洩
    - [INTERNET Watch: スカイチケットの個人情報流出](https://internet.watch.impress.co.jp/docs/news/2147116.html)
    - [INTERNET Watch: ビッグエコーの情報漏洩](https://internet.watch.impress.co.jp/docs/news/2147032.html)
    - [タイムズカー: 不正アクセスによる個人情報漏えいについて](https://share.timescar.jp/news/2026/0929/1816.html)
    - [KDDI: ISP事業者向けメールシステムへの不正アクセスについて](https://newsroom.kddi.com/news/assets/2026/kddi_nr_s-73_4619/kddi_nr_s-73_4619_pdf_01.pdf)
- 流出した情報が悪用された例
    - [インターリンク: 弊社からのメールを装ったフィッシングメールについて](https://faq.interlink.or.jp/faq2/View/wcDisplayContent.aspx?id=1424)
    - [J-CAST: Booking.comの予約情報を使ったWhatsAppのメッセージ](https://www.j-cast.com/2026/05/19514827.html?p=all)
    - [ITmedia: 警察官を名乗る詐欺電話の通話録音(トビラシステムズ)](https://www.itmedia.co.jp/news/article/2609/16/2000001559/)
    - [警察庁: 令和8年上半期におけるサイバー空間をめぐる脅威の情勢等について](https://www.npa.go.jp/publications/statistics/cybersecurity/data/R8kami/R08_kami_cyber_jousei.pdf)
    - [The Block: Ledger confirms physical scam letters requesting seed phrase](https://www.theblock.co/post/352479/ledger-confirms-physical-scam-letters-requesting-seed-phrase)
    - [国民生活センター: 国民生活センターをかたる電話に注意](https://www.kokusen.go.jp/news/data/n-20240807_2.html)
    - [Construction Management: Arup victim of multimillion deepfake scam](https://constructionmanagement.co.uk/arup-victim-of-multimillion-deepfake-scam/)
    - [StratNews Global: Italian police freeze cash from AI voice scam](https://stratnewsglobal.com/europe/italian-police-freeze-cash-from-ai-voice-scam-that-targeted-business-leaders)
    - [GIZMODO Japan: MetaのAIサポートアシスタントを悪用したInstagramアカウントの乗っ取り](https://www.gizmodo.jp/article/meta-says-thousands-of-instagram-accounts-were-breached-through-its-ai-support-assistant/)
