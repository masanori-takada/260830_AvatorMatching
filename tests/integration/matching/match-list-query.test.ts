import { beforeEach, describe, expect, it, vi } from "vitest";

const { createServerSupabaseClient, requireUser } = vi.hoisted(() => ({
  createServerSupabaseClient: vi.fn(),
  requireUser: vi.fn(),
}));
vi.mock("@/lib/supabase/server", () => ({ createServerSupabaseClient }));
vi.mock("@/features/identity/server/session", () => ({ requireUser }));

import { getOwnedMatchSummaries } from "@/features/matching/server/match-list-query";

describe("getOwnedMatchSummaries", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireUser.mockResolvedValue({ userId: "owner-a" });
  });

  it("承認前の候補一覧に具体的な候補名を返さない", async () => {
    const tables: string[] = [];
    const rows: Record<string, unknown[]> = {
      match_runs: [
        { id: "run-1", candidate_id: "candidate-1", status: "completed" },
        { id: "run-2", candidate_id: "candidate-2", status: "completed" },
      ],
      demo_candidates: [
        { id: "candidate-1", avatar_alias: "ルナ" },
        { id: "candidate-2", avatar_alias: "陽翔" },
      ],
      compatibility_reports: [
        { id: "report-1", match_run_id: "run-1", overall_score: 82, summary: "陽翔とは自然に話せました。" },
      ],
      decisions: [],
      match_connections: [],
      compatibility_dimensions: [
        { report_id: "report-1", axis: "conversation_flow", score: 82 },
      ],
    };
    const from = vi.fn((table: string) => {
      tables.push(table);
      const result = { data: rows[table] ?? [], error: null };
      const query: Record<string, unknown> = {};
      for (const method of ["select", "eq", "in", "order"]) {
        query[method] = vi.fn(() => query);
      }
      query.then = (resolve: (value: typeof result) => unknown, reject: (reason: unknown) => unknown) => (
        Promise.resolve(result).then(resolve, reject)
      );
      return query;
    });
    createServerSupabaseClient.mockResolvedValue({ from });

    const result = await getOwnedMatchSummaries();

    expect(result.summaries.map((summary) => summary.candidateAlias)).toEqual(["候補 1", "候補 2"]);
    expect(tables).not.toContain("demo_candidates");
    expect(JSON.stringify(result)).not.toMatch(/ルナ|陽翔|紬|蒼太|隼人|芽衣/u);
    expect(result.summaries[0]?.summary).toContain("候補アバター");
  });
});
