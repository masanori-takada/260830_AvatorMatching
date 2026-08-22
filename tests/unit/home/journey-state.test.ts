import { describe, expect, it } from "vitest";

import { TOTAL_QUESTIONS } from "@/features/interview/domain";
import { deriveJourneyState } from "@/features/matching/server/journey-state";

describe("deriveJourneyState", () => {
  it("未完了のインタビューでは次の未回答質問への継続を主操作にする", () => {
    const result = deriveJourneyState({ answeredCount: 7, matches: [] });
    expect(result.state).toBe("interview");
    expect(result.primaryAction.href).toBe("/interview/8");
  });

  it("全問完了しマッチ未開始なら開始への導線を主操作にする", () => {
    const result = deriveJourneyState({ answeredCount: TOTAL_QUESTIONS, matches: [] });
    expect(result.state).toBe("ready_to_match");
    expect(result.primaryAction.href).toBe("/matching");
  });

  it("1件でも処理中ならmatching状態としレポート導線を主操作にしない", () => {
    const result = deriveJourneyState({
      answeredCount: TOTAL_QUESTIONS,
      matches: [
        { matchRunId: "m1", status: "completed", decision: null },
        { matchRunId: "m2", status: "processing", decision: null },
        { matchRunId: "m3", status: "queued", decision: null },
      ],
    });
    expect(result.state).toBe("matching");
    expect(result.primaryAction.href).toBe("/matching");
  });

  it("全滅した場合だけ失敗状態として再試行を主操作にする", () => {
    const result = deriveJourneyState({
      answeredCount: TOTAL_QUESTIONS,
      matches: [
        { matchRunId: "m1", status: "failed", decision: null },
        { matchRunId: "m2", status: "failed", decision: null },
        { matchRunId: "m3", status: "failed", decision: null },
      ],
    });
    expect(result.state).toBe("match_failed");
    expect(result.primaryAction.href).toBe("/matching");
  });

  it("一部が失敗しても完了が1件でもあればmatch_failedにしない", () => {
    const result = deriveJourneyState({
      answeredCount: TOTAL_QUESTIONS,
      matches: [
        { matchRunId: "m1", status: "completed", decision: null },
        { matchRunId: "m2", status: "failed", decision: null },
        { matchRunId: "m3", status: "failed", decision: null },
      ],
    });
    expect(result.state).not.toBe("match_failed");
  });

  it("完了が1件以上あり未決定ならマッチ結果一覧を主操作にする", () => {
    const result = deriveJourneyState({
      answeredCount: TOTAL_QUESTIONS,
      matches: [
        { matchRunId: "m1", status: "completed", decision: null },
        { matchRunId: "m2", status: "completed", decision: null },
        { matchRunId: "m3", status: "completed", decision: null },
      ],
    });
    expect(result.state).toBe("report_ready");
    expect(result.primaryAction.href).toBe("/matches");
  });

  it("いずれか1件を承諾済みなら開示情報の閲覧を主操作にする", () => {
    const result = deriveJourneyState({
      answeredCount: TOTAL_QUESTIONS,
      matches: [
        { matchRunId: "m1", status: "completed", decision: "decline" },
        { matchRunId: "m2", status: "completed", decision: "accept" },
        { matchRunId: "m3", status: "completed", decision: null },
      ],
    });
    expect(result.state).toBe("accepted");
    expect(result.primaryAction.href).toBe("/reveal");
  });

  it("完了した全件を辞退済みなら結果画面への導線を主操作にする", () => {
    const result = deriveJourneyState({
      answeredCount: TOTAL_QUESTIONS,
      matches: [
        { matchRunId: "m1", status: "completed", decision: "decline" },
        { matchRunId: "m2", status: "completed", decision: "decline" },
      ],
    });
    expect(result.state).toBe("declined");
    expect(result.primaryAction.href).toBe("/declined");
  });

  it("完了した候補が1人だけ(3人未満)でも同じ導出ロジックが適用される", () => {
    const result = deriveJourneyState({
      answeredCount: TOTAL_QUESTIONS,
      matches: [{ matchRunId: "m1", status: "completed", decision: null }],
    });
    expect(result.state).toBe("report_ready");
  });

  it("allowedPathsには常にホームとマイページを含む", () => {
    const result = deriveJourneyState({ answeredCount: 0, matches: [] });
    expect(result.allowedPaths).toEqual(expect.arrayContaining(["/", "/mypage"]));
  });

  it("完了済みrunのレポートパスをallowedPathsに含める", () => {
    const result = deriveJourneyState({
      answeredCount: TOTAL_QUESTIONS,
      matches: [
        { matchRunId: "m1", status: "completed", decision: null },
        { matchRunId: "m2", status: "completed", decision: null },
      ],
    });
    expect(result.allowedPaths).toEqual(expect.arrayContaining([
      "/matches", "/report?matchRunId=m1", "/report?matchRunId=m2",
    ]));
  });
});
