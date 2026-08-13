# Database RPC Contracts

全RPCは `auth.uid()` を内部で取得し、引数として所有者IDを受け取らない。`security definer` を使う関数は
`search_path = public, pg_temp` を固定し、公開実行権限を取り消してauthenticatedだけへ付与する。

## `claim_match_run(uuid) -> match_status`

- Owns the row: otherwise `P0002 MATCH_NOT_FOUND`.
- Allowed from `queued` or `failed` with `attempt_count < 3`.
- Sets status `processing`, increments attempt, clears error, sets started time.
- Repeated call while processing returns current `processing`; completed returns `completed`.

## `complete_match_run(uuid, jsonb) -> void`

- Requires owner and current status `processing`.
- Validates 8〜20 ordered messages, five unique axes, 0〜100 scores, and valid evidence turns.
- Replaces any non-published prior generated rows for the run.
- Inserts messages, report, dimensions, two notifications, then marks run completed in one transaction.

## `fail_match_run(uuid, text) -> void`

- Requires owner and current status `processing`.
- Accepts only `PROVIDER_ERROR`, `INVALID_OUTPUT`, `TIMEOUT`, `INTERNAL_ERROR`.
- Sets status failed and failed timestamp; never stores exception text or prompt content.

## `commit_decision(uuid, decision_kind) -> decisions`

- Requires owner and completed run.
- Inserts once. Same-value retries return existing row; opposite value raises `DECISION_CONFLICT`.
- No update or delete path is exposed.

## `get_candidate_reveal(uuid) -> table(...)`

- Requires owner, completed run, and an `accept` decision.
- Returns exactly one row: `full_name`, `company`, `department`, `bio`.
- Decline, undecided, foreign ownership, or missing run returns zero rows.

## `reset_my_demo() -> void`

- Deletes notifications, decisions, dimensions, reports, messages, runs, avatar profile, and answers owned by caller.
- Keeps the auth user and profile so the session can immediately restart.
- Runs in a transaction; another user's rows are never selected.
