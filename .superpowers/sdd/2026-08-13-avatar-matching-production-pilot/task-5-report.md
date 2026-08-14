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
