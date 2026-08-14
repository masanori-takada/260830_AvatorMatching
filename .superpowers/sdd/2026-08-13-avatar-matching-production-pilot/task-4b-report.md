# Task 4b: T006 固定架空候補 実装レポート

## Status

T006の残件だった固定架空候補1件を実装しました。既存の質問migrationやTask 4コードは変更していません。

## RED / GREEN

- RED: `tests/unit/config/reference-candidate-contract.test.ts` を先に追加し、候補migrationの`ENOENT`とseed未定義により3 tests failedを確認しました。
- GREEN: Node 24で同テストを実行し、1 file / 3 tests passed、exit 0、6.3秒でした。
- テストはactive匿名面の公開、開示面の直接SELECT禁止、固定UUID、匿名JSONの識別キー不在、完全架空表記、bio 500文字以下、2 UPSERTを検証します。

## 実装

- migration versionは既存`202608130002`と将来`202608130003`の間で一意な`2026081300025_reference_candidate.sql`です。
- `demo_candidates`は固定UUID、匿名表示名、JSON objectの会話プロフィール、activeフラグを保持します。
- authenticatedはactive行だけSELECTできます。anonと両roleの書込み権限はありません。
- `candidate_reveals`は氏名・企業・部署・500文字以下の紹介を保持しますが、anon/authenticatedへの直接grantもRLS policyもありません。
- 将来の承諾確認付き`SECURITY DEFINER` RPCだけが開示できる設計とし、そのRPCには空の`search_path`と`auth.uid()`による所有者検証が必須であることをSQLコメントに記録しました。
- seedは匿名面と開示面を別UPSERTし、再実行しても固定1件へ収束します。
- `conversation_profile`は興味、会話スタイル、価値観、休日スタイルだけです。氏名、企業、部署、連絡先、住所、生年月日、場所のキーをDB制約でも禁止します。
- 開示値はすべて「完全架空」と明記し、bioにも実在人物・団体と無関係であることを記載しました。

## 検証結果

| 検証 | 結果 |
| --- | --- |
| 静的SQL契約 | 1 file / 3 tests、exit 0、6.3秒 |
| 型検査 | Node 24、exit 0、7.2秒 |
| Lint | Node 24、exit 0、10.2秒 |
| production build | 公開ダミー環境変数付きNode 24、exit 0、16.5秒 |
| pgTAP | 6 assertionsを追加。Docker未導入の既知制約により未実行 |

## 変更ファイル

- `supabase/migrations/2026081300025_reference_candidate.sql`
- `supabase/seed.sql`
- `supabase/tests/database/003_reference_candidate.test.sql`
- `tests/unit/config/reference-candidate-contract.test.ts`
- `.superpowers/sdd/2026-08-13-avatar-matching-production-pilot/task-4b-report.md`

## 懸念

- 実DB上のRLSと権限はpgTAPで契約化済みですが、この環境ではDockerが使えないため実行確認が残っています。
- 将来の開示RPC実装時も、`candidate_reveals`への直接SELECT grant/policyを追加しないでください。

## Solレビュー修正: 共通timestamp規約

- RED: 両テーブルの`created_at` / `updated_at`とtriggerを要求する静的契約を追加し、`created_at`欠落で1 test failedを確認しました。
- GREEN: `demo_candidates`と`candidate_reveals`へ`created_at timestamptz not null default now()`、`updated_at timestamptz not null default now()`を追加しました。
- 両テーブルのbefore update triggerは、foundationで定義済みの`public.set_updated_at()`を再利用します。
- pgTAPへ4列と2 triggerの6 assertionsを追加し、合計12 assertionsにしました。Docker未導入のため実DB実行は未実施です。
- 修正後ゲート: 静的契約1 file / 4 tests、型検査、Lint、公開ダミー環境変数付きproduction buildはすべてexit 0でした。

## SolレビューMinor修正: seed状態冪等性

- RED: 同値UPSERTに`IS DISTINCT FROM`条件を要求し、条件欠落で1 test failedを確認しました。
- 両`ON CONFLICT DO UPDATE`は、更新対象列tupleが`excluded` tupleと異なる場合だけUPDATEします。同値seed再実行ではtriggerが発火せず、`updated_at`を維持します。
- GREEN: 静的契約1 file / 4 tests、型検査、Lint、公開ダミー環境変数付きproduction buildはすべてexit 0でした。
