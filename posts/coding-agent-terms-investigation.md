---
title: "各Coding Agentで取得されたデータがモデルの学習に使われるか調査してみた"
description: "Copilot, Codex, Claude Code, Antigravity, Cursor, Devin, Kiro, WindSurf, Kimi Codeの規約を読み、コードが学習に使われるかどうかを調べました"
date: 2026-03-21
tags: [Coding Agent, Privacy, 利用規約]
author: 逆瀬川ちゃん
---

こんにちは！逆瀬川 ([@gyakuse](https://x.com/gyakuse)) です！

Cursorをひさびさに使おうと思ったのですが、[Composer2がKimiベースである](https://x.com/Kimi_Moonshot/status/2035074972943831491)ため、Cursorって本当にZDR(ゼロデータ保持)なんだっけ、と思い調べてたら他のCoding Agentも調べることになってました（？）学習に貢献したいというモチベーションのある方にとっては、実は学習されないことがわかるかもしれませんし、学習に貢献したくない方にとっては、学習されうるリスクを排除するのに役立つと思います。Kimi Codeが結構すごくて、メール連絡しない限り派手に学習してくれます。学習に貢献したい場合は、めちゃよいです。ちなみにAPI利用でもKimi (Moonshot AI) はモデルの学習へ利用されます。迫力があってすごい。

<!--more-->

## 調査の対象

以下の製品の利用規約・プライバシーポリシーを対象に調査しました。

| ツール | 開発元 |
|---|---|
| GitHub Copilot | GitHub (Microsoft) |
| Codex | OpenAI |
| Claude Code | Anthropic |
| Antigravity | Google |
| Cursor | Anysphere |
| Devin | Cognition AI |
| Kiro | Amazon (AWS) |
| WindSurf | Cognition AI |
| Kimi Code | Moonshot AI |

OpenCode は取り上げませんが、たとえば[OpenCode Zen](https://opencode.ai/docs/ja/zen/)の場合、MiniMax M2.5 Free, Big Pickleなどのモデルは明示的に学習に利用されるとあります。基本的に無料のModelはこうなっている場合が多いです。

>Big Pickle: 無料期間中、収集されたデータはモデルの改善に使用される場合があります。
>MiniMax M2.5 Free: 無料期間中、収集されたデータはモデルの改善に使用される場合があります。

## 調査の結果

結果を一覧にするとこうなります。

| ツール | 学習への利用 | オプトアウト | データ保持 |
|---|---|---|---|
| GitHub Copilot | されない | 不要 | ゼロ（IDE）/ 28日（CLI） |
| Codex | 選択可能 | あり | 30日 |
| Claude Code | 選択可能 | あり | 30日（OFF時）/ 5年（ON時） |
| Antigravity | ？ | ？ | 削除依頼まで保持 |
| Cursor | 選択可能 | あり | Privacy Mode ON時ゼロ |
| Devin | 選択可能 | あり | 明記なし |
| Kiro | 選択可能 | あり | 明記なし |
| WindSurf | 選択可能 | あり | 明記なし |
| Kimi Code | される | あり（メール連絡） | 明記なし |

AntigravityはGoogle WorkspaceまたはGCP経由のアクセスの場合はオプトアウトされます。後述しますが個人アカウントでの場合、少し厄介です。
以下ではそれぞれのオプトアウト方法と規約に何が書いてあるのか見ていきます。

## 各種規約などについて

### GitHub Copilot

#### オプトアウト設定方法

![オプトアウト方法](/img/coding-agent-terms-investigation/copilot.png)

設定不要です

- 全プランで学習に使用されておらず、[オプトイン設定はロック状態](https://docs.github.com/en/copilot/how-tos/manage-your-account/manage-policies)で有効化できません
- 製品改善のための利用を拒否する場合は `Allow GitHub to use my data for product improvements` を OFF にしましょう

#### 規約

[Product Specific Terms (March 2026)](https://assets.ctfassets.net/8aevphvgewt8/1Y0gmEkMnAs8W6N4ai2R1g/694c0ae359902dc0700454333ad15c44/GitHub_Copilot_Product_Specific_Terms_-_2026_03_05_-_FINAL.pdf)（Business/Enterprise向け、2026年3月5日以降は[GitHub Generative AI Services Terms](https://github.com/customer-terms)に移行）では以下のような記載になっています。

> "GitHub Copilot sends an encrypted Prompt from you to GitHub to provide Suggestions to you. Except as detailed below, Prompts are transmitted only to generate Suggestions in real-time, are deleted once Suggestions are generated, and are not used for any other purpose."（GitHub Copilotは暗号化されたプロンプトをGitHubに送信し、提案を提供します。以下に詳述する場合を除き、プロンプトはリアルタイムで提案を生成するためだけに送信され、提案が生成されると削除され、他の目的には使用されません。）

個人プランについては[GitHub Docs](https://docs.github.com/en/copilot/how-tos/manage-your-account/manage-policies)に以下の記載があります。

> "By default, GitHub, its affiliates, and third parties will not use your data, including prompts, suggestions, and code snippets, for AI model training. This setting cannot be enabled."（デフォルトでは、GitHub、その関連会社、およびサードパーティは、プロンプト、提案、コードスニペットを含むあなたのデータをAIモデルの学習に使用しません。この設定は有効化できません。）

IDEでの利用はゼロ保持ですが、CLI経由だと28日間プロンプトが保持されます。

### Codex

#### オプトアウト設定方法

![オプトアウト方法](/img/coding-agent-terms-investigation/chatgpt.png)

https://chatgpt.com/#settings/DataControls

- API Key認証: 学習利用はデフォルトOFF
- Subscription (ChatGPTログイン): ChatGPTのポリシーが適用。[ChatGPT Settings > Data Controls](https://chatgpt.com/#settings/DataControls) から変更

#### 規約

API Key認証の場合は[Data controls in the OpenAI platform](https://developers.openai.com/api/docs/guides/your-data)が適用されます。

> "Your data is your data. As of March 1, 2023, data sent to the OpenAI API is not used to train or improve OpenAI models (unless you explicitly opt in to share data with us)."（あなたのデータはあなたのものです。2023年3月1日以降、OpenAI APIに送信されたデータはOpenAIモデルの学習や改善には使用されません（明示的にデータ共有をオプトインした場合を除く）。）

データ保持は安全性モニタリング目的で30日間です。CLIはApache-2.0ライセンスの[オープンソース](https://github.com/openai/codex)となっており、送信内容を自分で監査できます。

### Claude Code

#### オプトアウト設定方法

![オプトアウト方法](/img/coding-agent-terms-investigation/claude.png)

https://claude.ai/settings/data-privacy-controls > `Claudeの改善にご協力ください` を OFF

#### 規約

[データ利用ポリシー](https://code.claude.com/docs/en/data-usage)の記載は以下のようになっています。

> "We give you the choice to allow your data to be used to improve future Claude models. We will train new models using data from Free, Pro, and Max accounts when this setting is on (including when you use Claude Code from these accounts)."（将来のClaudeモデルの改善にデータを使用するかどうかを選択できます。この設定がONの場合、Free、Pro、Maxアカウントのデータを使用して新しいモデルを学習します（これらのアカウントからClaude Codeを使用する場合を含む）。）

データ保持期間はON/OFFで異なります。

> "Users who allow data use for model improvement: 5-year retention period to support model development and safety improvements. Users who don't allow data use for model improvement: 30-day retention period."（モデル改善のためのデータ利用を許可したユーザー：モデル開発と安全性向上のため5年間保持。許可しないユーザー：30日間保持。）

### Antigravity

#### オプトアウト設定方法

![オプトアウト方法](/img/coding-agent-terms-investigation/antigravity.png)

右上の歯車アイコン > Open Antigravity User Settings > `Enable Telemetry` をOFF

ただし学習利用を防げるかは[不明確](https://discuss.ai.google.dev/t/antigravity-data-training-opt-out/125236)です。Google WorkspaceまたはGCP経由のアクセスでは収集されません。

#### 規約

[利用規約](https://antigravity.google/terms)では以下のような記載になっています。

> "We use Interactions to evaluate, develop, and improve Google and Alphabet research, products, services and machine learning technologies."（私たちはインタラクションを、GoogleおよびAlphabetの研究、製品、サービス、機械学習技術の評価、開発、改善に使用します。）

> "if you are accessing the Service via Google Workspace or the Google Cloud Platform, we will not collect your prompts, content, or model responses."（Google WorkspaceまたはGoogle Cloud Platform経由でサービスにアクセスしている場合、プロンプト、コンテンツ、モデルの応答を収集しません。）

データ保持については、削除依頼をしない限り保持されると読める記載があります。

> "interaction data will be used according to the agreement unless and until you request deletion."（インタラクションデータは、削除を要求しない限り、契約に従って使用されます。）

### Cursor

#### オプトアウト設定方法

![オプトアウト方法](/img/coding-agent-terms-investigation/cursor.png)

Settings > Privacy から `Privacy Mode` を選択

- Privacy Mode: 学習に使われない。Background Agentなどの機能も利用可能
- Privacy Mode (Legacy): 学習に使われず、コードも保存されない。ただしBackground Agentなどの一部機能が使えない

#### 規約

[Data Use Overview](https://cursor.com/data-use)では以下のような記載になっています。

> "If you choose to turn off 'Privacy Mode': we may use and store codebase data, prompts, editor actions, code snippets, and other code data and actions to improve our AI features and train our models."（「Privacy Mode」をOFFにした場合、コードベースデータ、プロンプト、エディタ操作、コードスニペット、その他のコードデータおよび操作を、AI機能の改善やモデルの学習に使用・保存する場合があります。）

Privacy ModeをONにするとゼロデータ保持になります。

> "If you enable 'Privacy Mode' in Cursor's settings: zero data retention will be enabled for our model providers. (...) None of your code will ever be trained on by us or any third-party."（Cursorの設定で「Privacy Mode」を有効にすると、モデルプロバイダーに対してゼロデータ保持が有効になります。（中略）あなたのコードが私たちやサードパーティによって学習に使用されることは一切ありません。）

なお自分のAPIキーを設定していてもリクエストはCursorのAWSバックエンドを経由します。[Security Page](https://cursor.com/security)では以下のような記載になっています。

> "Note that the requests always hit our infrastructure on AWS even if you have configured your own API key"（自分のAPIキーを設定していても、リクエストは常にAWS上の当社インフラを経由します。）

### Devin

#### オプトアウト設定方法

![オプトアウト方法](/img/coding-agent-terms-investigation/devin.png)

https://app.devin.ai/org/{team-name}/settings/general で `Make Devin smarter` を OFF

- 評価時の利用も OFF にしたい場合は `Evaluate Devin` を OFF にしてください
- モデルの学習用途と評価用途で分けて表示されている点が面白いです

#### 規約

[Terms of Service](https://cognition.ai/terms-of-service)では以下のような記載になっています。

> "Any Customer Data that you submit, upload, or otherwise post to the Services will not be used for model training purposes unless you opt-in."（お客様が送信、アップロード、またはサービスに投稿した顧客データは、オプトインしない限り、モデルの学習目的には使用されません。）

ただし[プライバシーポリシー](https://cognition.ai/privacy-policy)には別の記載があります。

> "depending on the terms that apply to your use of the Services, using User Content to train, fine tune and improve the models that power our Services"（サービスの利用に適用される規約に応じて、ユーザーコンテンツを当社サービスを支えるモデルの学習、ファインチューニング、改善に使用します。）

「depending on the terms」でTOSに委ねる形式ですが、読み方によっては曖昧さが残ります。

### Kiro

#### オプトアウト設定方法

![オプトアウト方法](/img/coding-agent-terms-investigation/kiro.png)

Settings > Data Sharing And Prompt Logging > 「Content Collection For Service Improvement」をOFF

- 学習への利用を拒否したい場合はこれをOFFにします
- `Usage Analytics And Performance Metrics` は利用状況の送信で、別の設定です

#### 規約

[FAQ](https://kiro.dev/faq/)では以下のような記載になっています。

> "We may use certain content from Kiro Free Tier and Kiro individual subscribers...for service improvement"（Kiro Free Tierおよび個人サブスクライバーの一部のコンテンツを、サービス改善のために使用する場合があります。）

> "We do not use content from Kiro Pro, Pro+, or Power users that access Kiro through AWS IAM Identity Center or external identity provider"（AWS IAM Identity Centerまたは外部IDプロバイダー経由でKiroにアクセスするKiro Pro、Pro+、Powerユーザーのコンテンツは使用しません。）

ただしこのFAQ上の約束とAWS Service Terms Section 50.3の間に乖離があるという[指摘](https://github.com/kirodotdev/Kiro/issues/2206)があります。法的規約ではデータ使用の権利を留保しています。

### WindSurf

#### オプトアウト設定方法

![オプトアウト方法](/img/coding-agent-terms-investigation/windsurf.png)

- https://windsurf.com/settings > `Disable Telemetry` を ON

#### 規約

[利用規約](https://windsurf.com/terms-of-service-individual)では以下のような記載になっています。

> "We may use your Autocomplete User Content to improve our discriminative machine learning models"（オートコンプリートのユーザーコンテンツを、識別型機械学習モデルの改善に使用する場合があります。）

> "We may use your Chat User Content to improve the generative and discriminative machine learning models we use."（チャットのユーザーコンテンツを、当社が使用する生成型および識別型機械学習モデルの改善に使用する場合があります。）

WindSurf（旧Codeium）は2025年7月にCognition AIに買収されており、windsurf.comと[cognition.ai](https://cognition.ai/privacy-policy)の2つのプライバシーポリシーが並存しています。cognition.ai側にも学習利用の記載があります。

> "customize your experience with our Services and otherwise improve our Services including...using User Content to train, fine tune and improve the models that power our Services"（サービス体験のカスタマイズやサービスの改善のために（中略）ユーザーコンテンツを当社サービスを支えるモデルの学習、ファインチューニング、改善に使用します。）

### Kimi Code

#### オプトアウト設定方法

membership@moonshot.ai にメールで連絡

#### 規約

[プライバシーポリシー](https://www.kimi.com/user/agreement/userPrivacy?version=v2)では以下のような記載になっています。

> "User Content: This includes prompts, audio, images, videos, files, and any content you input or generate while using our products and services. We process this information to provide and improve the Services, including training and optimizing our models."（ユーザーコンテンツ：プロンプト、音声、画像、動画、ファイル、および当社の製品・サービスの利用中に入力または生成したすべてのコンテンツを含みます。この情報を、モデルの学習・最適化を含むサービスの提供・改善のために処理します。）

[利用規約](https://www.kimi.com/user/agreement/modelUse?version=v2) Section 3にはオプトアウトについて以下の記載があります。

> "You may opt out of allowing your Content to be used for model improvement and research purposes by contacting us at membership@moonshot.ai."（membership@moonshot.ai に連絡することで、コンテンツがモデル改善および研究目的に使用されることをオプトアウトできます。）

## まとめ

- 規約間の整合性に問題があるケース（DevinのTOS vs プライバシーポリシー、Kiroのドキュメント vs AWS Service Terms、WindSurfの二重ポリシー）が複数あるので、ドキュメントだけでなく法的規約も確認した方がよいです
- 学習に利用された場合、モデルの発展に貢献できます

## Appendix: 各ツールの公式規約リンク

| ツール | 利用規約 | プライバシーポリシー |
|---|---|---|
| GitHub Copilot | [Product Specific Terms](https://github.com/customer-terms/github-copilot-product-specific-terms) | [Trust Center FAQ](https://copilot.github.trust.page/faq) |
| Codex | [Service Terms](https://openai.com/policies/service-terms/) | [Privacy Policy](https://openai.com/policies/row-privacy-policy/) |
| Claude Code | [Legal and Compliance](https://code.claude.com/docs/en/legal-and-compliance) | [Privacy Center](https://privacy.claude.com) |
| Antigravity | [Antigravity Terms](https://antigravity.google/terms) | [Google Privacy](https://policies.google.com/privacy) |
| Cursor | [Data Use Overview](https://cursor.com/data-use) | [Privacy Policy](https://cursor.com/privacy) |
| Devin | [Terms of Service](https://cognition.ai/terms-of-service) | [Privacy Policy](https://cognition.ai/privacy-policy) |
| Kiro | [Data Protection](https://kiro.dev/docs/privacy-and-security/data-protection/) | [Privacy and Security](https://kiro.dev/docs/privacy-and-security/) |
| WindSurf | [TOS (Individual)](https://windsurf.com/terms-of-service-individual) | [Privacy Policy](https://windsurf.com/privacy-policy) |
| Kimi Code ([Moonshot AI](https://www.moonshot.ai/) / [Kimi](https://kimi.com/)) | [Terms of Service](https://www.kimi.com/user/agreement/modelUse?version=v2) | [Privacy Policy](https://www.kimi.com/user/agreement/userPrivacy?version=v2) |

## References

- [GitHub Copilot Product Specific Terms (March 2026)](https://assets.ctfassets.net/8aevphvgewt8/1Y0gmEkMnAs8W6N4ai2R1g/694c0ae359902dc0700454333ad15c44/GitHub_Copilot_Product_Specific_Terms_-_2026_03_05_-_FINAL.pdf)
- [OpenAI: Your Data](https://developers.openai.com/api/docs/guides/your-data)
- [Codex Security](https://developers.openai.com/codex/security)
- [Updates to Consumer Terms and Privacy Policy - Anthropic](https://www.anthropic.com/news/updates-to-our-consumer-terms)
- [Claude Code Data Usage](https://code.claude.com/docs/en/data-usage)
- [Claude flips the privacy default - Smith Stephen](https://www.smithstephen.com/p/claude-flips-the-privacy-default)
- [Antigravity Terms](https://antigravity.google/terms)
- [Cursor Data Use Overview](https://cursor.com/data-use)
- [Cursor Security Page](https://cursor.com/security)
- [Cognition AI Terms of Service](https://cognition.ai/terms-of-service)
- [Cognition AI Privacy Policy](https://cognition.ai/privacy-policy)
- [Kiro FAQ](https://kiro.dev/faq/)
- [Kiro Data Protection](https://kiro.dev/docs/privacy-and-security/data-protection/)
- [WindSurf Terms of Service (Individual)](https://windsurf.com/terms-of-service-individual)
- [JP Caparas, "Kimi K2.5 is brilliant, but think twice about using Kimi.com"](https://generativeai.pub/kimi-k2-5-is-brilliant-but-think-twice-about-using-kimi-com-157cbb26f9a3)

---

*本記事は2026年3月21日時点の公開情報に基づいています。各ツールの規約は変更される可能性があります。*
