import { describe, expect, it } from "vitest";

import { avatarProfileOutputSchema } from "@/lib/ai/schemas";

describe("AI profile契約", () => {
  it("summary 1〜600文字と6領域だけを受理する", () => {
    const valid = {
      summary: "穏やかな対話を大切にするプロフィールです。",
      traits: {
        leisure: "読書", communication: "傾聴", lifestyle: "安定",
        values: "誠実", relationships: "対話", priorities: "調和",
      },
    };
    expect(avatarProfileOutputSchema.parse(valid)).toEqual(valid);
    expect(() => avatarProfileOutputSchema.parse({ ...valid, fullName: "秘密" })).toThrow();
    expect(() => avatarProfileOutputSchema.parse({ ...valid, summary: "あ".repeat(601) })).toThrow();
  });

  it.each([
    "連絡先 user@example.com", "電話 090-1234-5678", "〒100-0001", "https://example.com",
    "星乃 ルナ（完全架空）", "ルミナス架空企画株式会社（完全架空）",
    "未来対話デザイン室（完全架空）",
  ])("potential PIIを含む全文字列を拒否する: %s", (summary) => {
    expect(() => avatarProfileOutputSchema.parse({
      summary,
      traits: {
        leisure: "読書", communication: "傾聴", lifestyle: "安定",
        values: "誠実", relationships: "対話", priorities: "調和",
      },
    })).toThrow("識別情報");
  });
});
