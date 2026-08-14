# Task 5: 分離したAiProvider契約とアバター要約 実装レポート

## Status

実装完了。決定論的Mock Provider、profile/matchのZod出力境界、20回答のアバター要約upsert、所有者RLS、動作する完了画面を追加しました。

## RED / GREEN

- Provider RED: unit/contract 3 suitesが`@/lib/ai/provider`と`schemas`のmissing importで失敗することを確認しました。
- completeInterview RED: 統合テストが`@/features/avatar-profile/server/service`のmissing importで失敗することを確認しました。
- DB RED: `2026081300026_avatar_profiles.sql`の`ENOENT`で静的契約が失敗することを確認しました。
- GREEN: Node 24でunit/contract/integration/DB静的契約を実行し、5 files / 8 tests passed、exit 0、16.6秒でした。

## 実装内容

- `AiProvider`をprofile生成とmatch生成の2メソッドで定義し、`getAiProvider()`は`AI_PROVIDER=mock`だけを許可します。未指定・未知の値は例外でfail-closedです。
- Mock profileは同じ入力から常に同じ出力を返し、PIIを含み得ない固定選択式のq01〜q03を明示的に反映します。
- profile出力はsummary 1〜600文字、固定6領域各1〜200文字、追加キー禁止です。候補開示キーは受理しません。
- match出力は8〜20発言、発言内answerRefs一意、全体で3回答以上参照、5軸一意、score範囲、実在turnを指す`evidenceTurnIndex`をZodで強制します。
- `completeInterview()`は`requireUser()`後に本人のq01〜q20が正確に20件あることを検証し、provider出力を再度Zod parseしてからowner upsertします。
- `source_revision`は20回答のrevision合計です。成功結果はsummaryとsourceRevisionだけで、利用者IDや回答本文を返しません。
- 完了画面はServer Actionを呼ぶClient formとなり、生成中状態、失敗、要約、revision合計、冪等な再生成を表示します。
- migration `2026081300026_avatar_profiles.sql`は既存0025と将来003の間で一意です。summary、6 traits、sourceRevision、provider、timestamps/triggerをDB制約でも強制します。
- `avatar_profiles`はownerごとに一意で、SELECT/INSERT/UPDATEすべて本人行だけのRLSです。公開schemaの権限は一旦明示revoke後、authenticatedへ必要最小限をgrantしています。

## 検証結果

| 検証 | 結果 |
| --- | --- |
| Task 5個別 | 5 files / 8 tests、exit 0、16.6秒 |
| 型検査 | Node 24、exit 0、12.4秒 |
| Lint | Node 24、exit 0、17.9秒 |
| production build | 公開ダミー環境変数付きNode 24、exit 0、23.6秒 |
| pgTAP | 4 assertionsを追加。Docker未導入の既知制約により未実行 |
| Playwright | 本Taskでは未実行。runner停止の既知制約あり |

## 変更ファイル

- `src/lib/ai/{types,schemas,provider,mock-provider,index}.ts`
- `src/features/avatar-profile/server/service.ts`
- `src/components/interview/completion-form.tsx`
- `src/app/(journey)/interview/complete/page.tsx`
- `supabase/migrations/2026081300026_avatar_profiles.sql`
- `supabase/tests/database/004_avatar_profiles.test.sql`
- `tests/unit/ai/mock-provider.test.ts`
- `tests/contract/ai-profile.test.ts`
- `tests/contract/ai-match.test.ts`
- `tests/integration/avatar-profile/service.test.ts`
- `tests/unit/config/avatar-profile-db-contract.test.ts`

## 懸念

- pgTAPは契約化済みですが、この環境ではDockerが使えず実DB上のRLS確認は未実行です。
- Bedrock等を追加する場合も`getAiProvider`の明示allow-listと生成後Zod parseを維持する必要があります。

## Solレビュー修正

### RED / GREEN

- 実回答反映、`providerId`、全文字列PII拒否、保存済み回答再検証、同値write skip、条件付きDB upsertを先にテスト化し、5 filesで13 failures / 4 passedを確認しました。
- GREEN: Node 24でTask 5個別を実行し、5 files / 19 tests passed、exit 0、17秒でした。

### 修正内容

- match発言へq01・q02の安全な選択実値と、q04自由文のPII除去後の意味断片を埋め込み、`answerRefs`だけに依存しない根拠にしました。
- Mock出力前にemail、電話、郵便番号、URL、既知の候補開示値を`[非公開]`へ置換し、自由文は80コードポイントへ制限します。
- profile/match両Zod schemaは全階層の文字列を再帰走査し、同じ識別patternが残ればprovider種別を問わずfail-closedに拒否します。strict objectによる候補開示キー禁止も維持します。
- `completeInterview()`は固定`INTERVIEW_QUESTIONS`全20問とのcode対応を確認し、各回答を`parseInterviewAnswer()`へ通します。仕様外choice、Unicode空白だけのfree text、長さ違反ではproviderもDB writeも呼びません。
- `AiProvider.providerId`をreadonly契約にし、Mockは`mock-v1`、DB保存はprovider自身のIDを使用します。
- 既存profileのsummary、traits、sourceRevision、providerIdが同一ならActionはwriteをスキップします。
- 競合時も同値更新を防ぐため、`upsert_my_avatar_profile`をSECURITY INVOKER・空search_path・`auth.uid()`固定で実装しました。`ON CONFLICT`がowner行をロックした後、全保存tupleの`IS DISTINCT FROM`がtrueの場合だけUPDATEするため、同値の並行再試行でも`updated_at`を維持します。
- pgTAPは同値RPCがfalse、差分RPCがtrueを返す2 assertionsを加え、合計6 assertionsです。Docker未導入のため未実行です。

### 修正後ゲート

| 検証 | 結果 |
| --- | --- |
| Task 5個別 | 5 files / 19 tests、exit 0、17秒 |
| 型検査 | Node 24、exit 0、7.4秒 |
| Lint | Node 24、exit 0、11秒 |
| production build | 公開ダミー環境変数付きNode 24、exit 0、20秒 |
| pgTAP / Playwright | 環境制約により未実行 |

## Solレビュー PII境界の構造修正

### RED / GREEN

- RED: `PrivacySafeAiProvider` の境界テストを先に追加し、未実装moduleを解決できずsuiteが失敗することを確認しました。DBの追加静的契約は既存migrationですでに満たされていました。
- GREEN: Node 24でAI unit/contract、avatar profile integration、DB静的契約を実行し、6 files / 26 tests passed、exit 0、20.8秒でした。

### 修正内容

- `getAiProvider()` が返すProviderを共通の`PrivacySafeAiProvider`で包み、canonical質問のうち`free_text`であるq04/q08/q12/q18/q20は、profile/matchのどちらでもdelegateへ渡す前に固定placeholderへ置換します。元の配列は変更しません。
- Provider出力はprofile/matchそれぞれのZod schemaで検証したうえで、元の自由記述からNFKC正規化・空白/記号除去・自己紹介語尾除去で得た識別断片と全文字列を照合します。一致時は保存・返却前にfail-closedします。
- Mockの意味反映根拠は自由記述を使わず、安全なchoiceのq01/q02/q03だけに限定しました。未知の`AI_PROVIDER`は従来どおり拒否します。
- q16はcanonical仕様ではchoiceのため、`山田太郎です`は回答再検証でProvider呼出前に拒否するテストを追加しました。実名・空白/記号混在・email・電話の文脈照合はcanonical free textで検証しています。
- RPC静的契約で`SECURITY INVOKER`、空`search_path`、`auth.uid()`、PUBLIC/anon execute revoke、authenticated execute grantを個別検証します。

### 修正後ゲート

| 検証 | 結果 |
| --- | --- |
| 対象unit / contract / integration | 6 files / 26 tests、exit 0、20.8秒 |
| 型検査 | Node 24、exit 0、7.6秒 |
| Lint | Node 24、exit 0、11.7秒 |
| production build | 公開ダミー環境変数付きNode 24、exit 0、18.6秒 |
| pgTAP / Playwright | 既知のDocker / runner環境制約により未実行 |

## Solレビュー context-aware PII検査への再設計

### RED / GREEN

- RED: blanket 4文字n-gramが一般文「誠実な対話を大切にしています」を誤拒否し、email混在回答の残文にある氏名と、短い空白区切り氏名「李 雷」を見逃す3 failuresを確認しました。
- GREEN: 抽出器個別1 file / 16 tests、既存回帰6 files / 37 testsがNode 24ですべて成功しました。

### 修正内容

- 全4文字n-gramを撤去し、`extractSensitiveFragments()`が明示された識別候補だけを抽出する設計へ変更しました。自由記述rawをdelegateへ渡さない主防御は維持しています。
- email・電話・URL・郵便番号などは既存専用patternで除去して出力Zodへ委譲し、残った文の検査を継続します。回答全体をskipしないため、emailと混在した氏名も検出します。
- 「名前/氏名/会社/勤務先/所属/部署/住所/連絡先」ラベル後の値、日本語の名乗り表現直前の値、3〜8漢字または区切り付き2〜8文字相当の単独氏名候補を抽出します。
- 候補と出力はNFKC化し、Unicode空白・句読点・中黒等の記号を除去して比較します。会社・所属・住所、通常/表記崩し/NFKCの氏名をテストしました。
- 一般文と短い一般語「読書」は一致しても拒否しない誤検知回帰を追加しました。pgTAP/migrationは変更していません。

### 再設計後ゲート

| 検証 | 結果 |
| --- | --- |
| 個別 / 回帰テスト | 1 file / 16 tests、6 files / 37 tests、exit 0 |
| 型検査 | Node 24、exit 0、7.1秒 |
| Lint | Node 24、exit 0、10.7秒 |
| production build | 公開ダミー環境変数付きNode 24、exit 0、17.8秒 |
| pgTAP / Playwright | 本修正では未実行（既知のDocker / runner環境制約） |

## Solレビュー bare名乗り境界の最小修正

- RED: 句点付きの「山田 太郎です。」「山田・太郎です。」が漏洩し、「対話です」「読書です」が氏名として誤検出される4 failuresを確認しました。
- GREEN: bare `です` patternで漢字列中のUnicode空白・中黒を許容し、NFKCとseparator除去後の候補が3〜8コードポイントの場合だけ氏名fragmentへ採用しました。
- privacy個別1 file / 20 tests、Task 5回帰6 files / 41 testsが成功しました。label、名乗り、短いstandaloneの既存挙動も維持しています。
- Node 24の型検査（6.6秒）、Lint（10.2秒）、公開ダミー環境変数付きproduction build（17.5秒）はすべてexit 0でした。
- DB/pgTAP/Playwrightは変更対象外のため未実行です。

## Solレビュー PII部分一致の最終修正

### RED / GREEN

- RED: 文中の実名部分だけを出力する3ケース（通常表記、空白/中黒混在、NFKC表記）が既存の全文一致検査を通過することを、各ケース独立fixtureで確認しました。pgTAP権限契約は`plan(6)`のため静的テストが失敗しました。
- GREEN: Node 24で対象2 files / 12 tests、回帰範囲6 files / 31 testsがすべて成功しました。

### 修正内容と方針

- 自由記述をNFKC正規化し、Unicode空白・句読点・記号を除去したコードポイント列から連続4文字n-gramを生成します。出力の全文字列も同じ正規化を行い、1件でも部分一致すればfail-closedします。
- email・電話など既存の定型PII patternに該当する入力はn-gramへ混ぜず、出力Zodの専用patternへ委譲します。これによりemailの`user`とmachine enumの`user_avatar`のような偽陽性を防ぎます。
- 4文字未満の自由文はn-gramを生成しません。raw入力をProviderへ渡さない一次防御と既存PII patternは維持しつつ、「読書」など短い一般語の偶然一致で出力全体を拒否しない方針をテストしました。
- pgTAPを8 assertionsへ同期し、`public.upsert_my_avatar_profile(text,jsonb,integer,text)`についてanonのEXECUTEがfalse、authenticatedがtrueであることを追加しました。

### 最終ゲート

| 検証 | 結果 |
| --- | --- |
| 対象 / 回帰テスト | 2 files / 12 tests、6 files / 31 tests、exit 0 |
| 型検査 | Node 24、exit 0、9秒 |
| Lint | Node 24、exit 0、31.9秒 |
| production build | 公開ダミー環境変数付きNode 24、exit 0、19.3秒 |
| pgTAP / Playwright | 既知のDocker / runner環境制約により未実行 |
