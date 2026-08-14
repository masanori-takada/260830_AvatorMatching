import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { CompatibilityReport } from "@/components/report/compatibility-report";

const messages = Array.from({ length: 8 }, (_, index) => ({
  id: `message-${index + 1}`,
  turnIndex: index + 1,
  speaker: index % 2 === 0 ? "user_avatar" as const : "candidate_avatar" as const,
  body: `安全な会話 ${index + 1}`,
  answerRefs: [`q${String(index + 1).padStart(2, "0")}`],
}));

const dimensionRows: Array<[string, string, number, string]> = [
  ["conversation_flow", "会話の弾み", 88, "message-1"],
  ["values_alignment", "価値観の一致", 84, "message-2"],
  ["humor_fit", "ユーモアの相性", 79, "message-3"],
  ["mutual_interest", "相互関心", 86, "message-4"],
  ["mismatch_severity", "不一致の重大度", 24, "message-5"],
];
const dimensions = dimensionRows.map(([axis, label, score, evidenceMessageId]) => ({
  axis, label, score, explanation: `${label}の説明`, evidenceMessageId,
}));

describe("CompatibilityReport", () => {
  it("匿名の会話と5軸、方向、回答根拠、引用、総評だけを表示する", () => {
    render(<CompatibilityReport
      candidateAlias="お相手 A さん"
      report={{ overallScore: 82, summary: "落ち着いた対話ができています。", caution: "違いは対話で確認しましょう。" }}
      dimensions={dimensions}
      messages={messages}
    />);

    expect(screen.getAllByRole("meter")).toHaveLength(5);
    expect(screen.getByText("低いほど良い")).toBeVisible();
    expect(screen.getByText("回答 q01 を参照")).toBeVisible();
    expect(screen.getByText("「安全な会話 1」")).toBeVisible();
    expect(screen.getByRole("heading", { name: "総評" })).toBeVisible();
    expect(screen.queryByText(/山田|会社|部署/u)).not.toBeInTheDocument();
  });

  it("存在しない引用発言を拒否する", () => {
    expect(() => render(<CompatibilityReport
      candidateAlias="お相手 A さん"
      report={{ overallScore: 82, summary: "要約", caution: "注意" }}
      dimensions={dimensions.map((item, index) => index === 0 ? { ...item, evidenceMessageId: "missing" } : item)}
      messages={messages}
    />)).toThrow("引用発言");
  });
});
