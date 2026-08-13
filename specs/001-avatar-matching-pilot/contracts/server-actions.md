# Server Action Contracts

すべてのActionはサーバー側で現在セッションを検証し、成功時も他利用者の識別子を返さない。

```ts
type ActionErrorCode =
  | "UNAUTHENTICATED"
  | "VALIDATION_ERROR"
  | "STATE_CONFLICT"
  | "NOT_FOUND"
  | "RETRY_LIMIT"
  | "INTERNAL_ERROR";

type ActionResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: { code: ActionErrorCode; message: string; retryable: boolean } };
```

## `startAnonymousJourney()`

- Input: none
- Output: `ActionResult<{ nextPath: "/interview/1" | "/home" }>`
- Creates an anonymous session only when none exists. Repeated calls reuse the session.

## `saveInterviewAnswer(input)`

```ts
type SaveInterviewAnswerInput = {
  questionCode: `q${string}`;
  answer: string;
  expectedRevision: number | null;
};

type SaveInterviewAnswerOutput = {
  revision: number;
  answeredCount: number;
  nextPath: string;
};
```

- Validates question kind and allowed choice or 1〜500 character free text.
- Returns `STATE_CONFLICT` when matching has started or revision is stale.

## `completeInterview()`

- Input: none
- Output: `ActionResult<{ summary: string; sourceRevision: number }>`
- Requires exactly 20 valid answers. Idempotently upserts the mock avatar profile.

## `startMatch()`

- Input: none
- Output: `ActionResult<{ matchRunId: string; status: "queued" }>`
- Requires completed interview and profile. Repeated calls return the existing run.

## `markNotificationRead(input)`

- Input: `{ notificationId: string }`
- Output: `ActionResult<{ readAt: string }>`
- Updates only the current owner's notification.

## `commitDecision(input)`

- Input: `{ matchRunId: string; kind: "accept" | "decline" }`
- Output: `ActionResult<{ kind: "accept" | "decline"; nextPath: "/reveal" | "/declined" }>`
- First decision wins. A conflicting retry returns `STATE_CONFLICT` with the stored decision.

## `resetDemo()`

- Input: `{ confirmation: "RESET" }`
- Output: `ActionResult<{ nextPath: "/start" }>`
- Calls `reset_my_demo()` and removes current-user browser drafts on the client after success.

## Processing Route

`POST /api/match-runs/{id}/process`

- Requires current anonymous session and ownership.
- Returns `202 { status: "processing" }` only if processing continues asynchronously in a future implementation.
- Initial synchronous mock returns `200 { status: "completed" }`.
- Failure returns `409` for state conflict, `422` for invalid provider output, `500` for retryable processing error.
- Response never contains conversation, report, candidate reveal, raw answer, or server error stack.
