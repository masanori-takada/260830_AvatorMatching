# Data Model: AIアバター自動マッチング実証パイロット

## 共通規約

- 主キーはUUID、日時はタイムゾーン付きUTCとする。
- 利用者所有データは `owner_id uuid not null references auth.users(id) on delete cascade` を持つ。
- `created_at` と `updated_at` を持ち、更新トリガーで `updated_at` を維持する。
- RLSを有効化し、通常操作は `auth.uid() = owner_id` を満たす行だけを対象とする。
- 架空候補の匿名情報と承諾後開示情報を別テーブルへ分離する。

## Enums

```text
question_kind = choice | free_text
match_status = queued | processing | completed | failed
decision_kind = accept | decline
notification_kind = match_completed | report_ready
compatibility_axis = conversation_flow | values_alignment | humor_fit | mutual_interest | mismatch_severity
```

## Entities

### profiles

| Field | Type | Rules |
|---|---|---|
| id | uuid | PK、`auth.users.id` と同一 |
| created_at | timestamptz | default now |
| updated_at | timestamptz | default now |

匿名ユーザー作成時のトリガーで1件作成する。利用者は自分の行だけ参照でき、削除はリセットRPCが行う。

### interview_questions

| Field | Type | Rules |
|---|---|---|
| code | text | PK、`q01`〜`q20` |
| display_order | smallint | unique、1〜20 |
| category | text | 仕様の6領域 |
| kind | question_kind | not null |
| prompt | text | not null |
| choices | jsonb | choiceは3件、free_textは空配列 |
| min_length | smallint | free_textは1 |
| max_length | smallint | free_textは500 |
| active | boolean | default true |

マイグレーションで固定20問を投入する。authenticatedロールはSELECTのみ可能。

### interview_answers

| Field | Type | Rules |
|---|---|---|
| id | uuid | PK |
| owner_id | uuid | 所有者 |
| question_code | text | FK `interview_questions.code` |
| answer | text | 1〜500文字 |
| revision | integer | 1以上、更新ごとに+1 |
| created_at | timestamptz | default now |
| updated_at | timestamptz | default now |

`unique(owner_id, question_code)`。マッチが `queued` 以降なら更新を拒否する。

### avatar_profiles

| Field | Type | Rules |
|---|---|---|
| id | uuid | PK |
| owner_id | uuid | unique |
| summary | text | 1〜600文字、識別情報を含めない |
| traits | jsonb | 6領域の短い要約 |
| source_revision | integer | 回答revision合計のスナップショット |
| provider | text | `mock-v1` または将来のBedrock識別子 |
| created_at / updated_at | timestamptz | 共通規約 |

### demo_candidates

| Field | Type | Rules |
|---|---|---|
| id | uuid | PK、seedで固定 |
| avatar_alias | text | 承諾前表示名 |
| conversation_profile | jsonb | 匿名会話に必要な架空情報 |
| active | boolean | default true |

利用者はactive行の匿名情報だけSELECTできる。

### candidate_reveals

| Field | Type | Rules |
|---|---|---|
| candidate_id | uuid | PK/FK `demo_candidates.id` |
| full_name | text | 架空名 |
| company | text | 架空企業 |
| department | text | 架空部署 |
| bio | text | 架空紹介、500文字以下 |

直接SELECTポリシーを作らない。承諾確認付きRPCだけが返す。

### match_runs

| Field | Type | Rules |
|---|---|---|
| id | uuid | PK |
| owner_id | uuid | unique、初期版は1利用者1件 |
| candidate_id | uuid | FK `demo_candidates.id` |
| status | match_status | default queued |
| idempotency_key | uuid | unique |
| attempt_count | smallint | default 0、最大3 |
| provider | text | `mock-v1` |
| error_code | text nullable | 許可済み分類だけ |
| queued_at | timestamptz | not null |
| started_at | timestamptz nullable | processing時 |
| completed_at | timestamptz nullable | completed時 |
| failed_at | timestamptz nullable | failed時 |
| updated_at | timestamptz | 共通規約 |

状態遷移: `queued -> processing -> completed`、`processing -> failed`、`failed -> processing`。
`completed` は終端。3回失敗後は再試行を拒否する。

### conversation_messages

| Field | Type | Rules |
|---|---|---|
| id | uuid | PK |
| owner_id | uuid | 所有者 |
| match_run_id | uuid | FK、cascade delete |
| turn_index | smallint | 1以上 |
| speaker | text | `user_avatar` または `candidate_avatar` |
| body | text | 1〜1000文字 |
| answer_refs | text[] | 反映した質問コード |
| created_at | timestamptz | default now |

`unique(match_run_id, turn_index)`。完了RPCからのみ挿入する。

### compatibility_reports

| Field | Type | Rules |
|---|---|---|
| id | uuid | PK |
| owner_id | uuid | 所有者 |
| match_run_id | uuid | unique FK |
| overall_score | smallint | 0〜100 |
| summary | text | 1〜1000文字 |
| caution | text | 1〜500文字 |
| created_at | timestamptz | default now |

### compatibility_dimensions

| Field | Type | Rules |
|---|---|---|
| id | uuid | PK |
| owner_id | uuid | 所有者 |
| report_id | uuid | FK、cascade delete |
| axis | compatibility_axis | 5軸 |
| score | smallint | 0〜100 |
| explanation | text | 1〜500文字 |
| evidence_message_id | uuid | 同じmatchの発言を参照 |
| created_at | timestamptz | default now |

`unique(report_id, axis)`。5軸すべて存在する場合だけmatchをcompletedへできる。

### decisions

| Field | Type | Rules |
|---|---|---|
| id | uuid | PK |
| owner_id | uuid | 所有者 |
| match_run_id | uuid | unique FK |
| kind | decision_kind | accept / decline |
| decided_at | timestamptz | default now |

INSERTのみ許可し、UPDATE/DELETEポリシーを作らない。最初の決定を確定値とする。

### notifications

| Field | Type | Rules |
|---|---|---|
| id | uuid | PK |
| owner_id | uuid | 所有者 |
| match_run_id | uuid nullable | 関連マッチ |
| kind | notification_kind | 種別 |
| title | text | 1〜120文字 |
| body | text | 1〜300文字 |
| read_at | timestamptz nullable | 既読時刻 |
| created_at | timestamptz | default now |

## Database Functions

- `claim_match_run(p_match_run_id uuid)`: 所有者、状態、試行回数を検証してprocessingへ遷移する。
- `complete_match_run(p_match_run_id uuid, p_payload jsonb)`: JSON Schema相当を再検証し、会話、レポート、
  5軸、通知、completedを同一トランザクションで確定する。
- `fail_match_run(p_match_run_id uuid, p_error_code text)`: processingだけをfailedへ遷移する。
- `commit_decision(p_match_run_id uuid, p_kind decision_kind)`: completedかつ所有者の場合だけ1件挿入する。
- `get_candidate_reveal(p_match_run_id uuid)`: 所有者のaccept決定がある場合だけ開示行を返す。
- `reset_my_demo()`: `auth.uid()` に属するデモデータを子から削除し、profilesは残す。

すべて `auth.uid()` を関数内部で取得し、呼び出し側から `owner_id` を受け取らない。

## Client-only Draft

未送信回答は `avatar-matching:draft:<user-id>:<question-code>` をキーに保存する。値は回答本文、更新時刻、
送信試行回数だけを持つ。保存成功後に削除し、リセット時に現在利用者の全draftを削除する。
