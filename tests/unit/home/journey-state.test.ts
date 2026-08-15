import { describe, expect, it } from "vitest";

import { deriveJourneyState } from "@/features/matching/server/journey-state";

describe("deriveJourneyState", () => {
  it("未完了のインタビューでは次の未回答質問への継続を主操作にする", () => {
    const result = deriveJourneyState({ answeredCount: 7, match: null });
    expect(result.state).toBe("interview");
    expect(result.primaryAction.href).toBe("/interview/8");
  });

  it("20問完了しマッチ未開始なら開始への導線を主操作にする", () => {
    const result = deriveJourneyState({ answeredCount: 20, match: null });
    expect(result.state).toBe("ready_to_match");
    expect(result.primaryAction.href).toBe("/matching");
  });

  it("処理中はmatching状態としレポート導線を主操作にしない", () => {
    const result = deriveJourneyState({ answeredCount: 20, match: { status: "processing" } });
    expect(result.state).toBe("matching");
    expect(result.primaryAction.href).not.toBe("/report");
  });

  it("失敗時は再試行を主操作にする", () => {
    const result = deriveJourneyState({ answeredCount: 20, match: { status: "failed" } });
    expect(result.state).toBe("match_failed");
    expect(result.primaryAction.href).toBe("/matching");
  });

  it("完了かつ未決定ならレポート閲覧を主操作にする", () => {
    const result = deriveJourneyState({ answeredCount: 20, match: { status: "completed" } });
    expect(result.state).toBe("report_ready");
    expect(result.primaryAction.href).toBe("/report");
  });

  it("matchRunIdがあればレポート導線にクエリを付与する", () => {
    const result = deriveJourneyState({
      answeredCount: 20,
      match: { status: "completed", matchRunId: "m1" },
    });
    expect(result.primaryAction.href).toBe("/report?matchRunId=m1");
  });

  it("承諾済みなら開示情報の閲覧を主操作にする", () => {
    const result = deriveJourneyState({
      answeredCount: 20,
      match: { status: "completed", matchRunId: "m1", decision: "accept" },
    });
    expect(result.state).toBe("accepted");
    expect(result.primaryAction.href).toBe("/reveal");
  });

  it("辞退済みなら結果画面への導線を主操作にする", () => {
    const result = deriveJourneyState({
      answeredCount: 20,
      match: { status: "completed", matchRunId: "m1", decision: "decline" },
    });
    expect(result.state).toBe("declined");
    expect(result.primaryAction.href).toBe("/declined");
  });

  it("allowedPathsには常にホームとマイページを含む", () => {
    const result = deriveJourneyState({ answeredCount: 0, match: null });
    expect(result.allowedPaths).toEqual(expect.arrayContaining(["/", "/mypage"]));
  });
});
