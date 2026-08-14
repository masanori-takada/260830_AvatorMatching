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
});
