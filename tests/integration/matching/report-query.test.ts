import { beforeEach, describe, expect, it, vi } from "vitest";

const { createServerSupabaseClient, requireUser } = vi.hoisted(() => ({
  createServerSupabaseClient: vi.fn(), requireUser: vi.fn(),
}));
vi.mock("@/lib/supabase/server", () => ({ createServerSupabaseClient }));
vi.mock("@/features/identity/server/session", () => ({ requireUser }));

import { getOwnedCompletedReport } from "@/features/matching/server/report-query";

describe("getOwnedCompletedReport", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireUser.mockResolvedValue({ userId: "owner-a" });
  });

  it("承認前レポートを候補マスタの具体名なしで組み立てる", async () => {
    const selects: string[] = [];
    const tables: string[] = [];
    const rows: Record<string, unknown> = {
      match_runs: { id: "run-1", candidate_id: "candidate-1", status: "completed" },
      demo_candidates: { avatar_alias: "お相手 A さん" },
      compatibility_reports: {
        id: "report-1",
        overall_score: 82,
        summary: "陽翔とは自然に話せました。",
        caution: "ルナとの違いは確認しましょう。",
      },
      conversation_messages: Array.from({ length: 8 }, (_, index) => ({
        id: `message-${index + 1}`, turn_index: index + 1,
        speaker: index % 2 === 0 ? "user_avatar" : "candidate_avatar",
        body: index === 0 ? "蒼太の話に共感しました。" : `会話${index + 1}`,
        answer_refs: [`q0${index % 3 + 1}`],
      })),
      compatibility_dimensions: ["conversation_flow", "values_alignment", "humor_fit", "mutual_interest", "mismatch_severity"]
        .map((axis, index) => ({
          axis,
          score: 82,
          explanation: index === 0 ? "紬との会話が根拠です。" : "説明",
          evidence_message_id: `message-${index + 1}`,
        })),
    };
    const from = vi.fn((table: string) => {
      tables.push(table);
      const query = {
        select: vi.fn((columns: string) => { selects.push(columns); return query; }),
        eq: vi.fn(() => query), order: vi.fn(async () => ({ data: rows[table], error: null })),
        single: vi.fn(async () => ({ data: rows[table], error: null })),
      };
      return query;
    });
    createServerSupabaseClient.mockResolvedValue({ from });

    const result = await getOwnedCompletedReport("run-1");
    expect(result.candidateAlias).toBe("候補アバター");
    expect(tables).not.toContain("demo_candidates");
    expect(JSON.stringify(result)).not.toMatch(/ルナ|陽翔|紬|蒼太|隼人|芽衣/u);
    expect(JSON.stringify(result)).toContain("候補アバター");
    expect(JSON.stringify(result)).not.toMatch(/full_name|company|department|candidate_reveals/u);
    expect(selects.join(" ")).not.toMatch(/full_name|company|department|candidate_reveals/u);
  });
});
