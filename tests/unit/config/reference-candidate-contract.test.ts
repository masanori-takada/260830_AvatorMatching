import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const migrationPath = resolve(
  process.cwd(),
  "supabase/migrations/2026081300025_reference_candidate.sql",
);
const seedPath = resolve(process.cwd(), "supabase/seed.sql");

describe("架空候補のDB契約", () => {
  it("両テーブルが共通timestampとupdated_at triggerを持つ", () => {
    const sql = readFileSync(migrationPath, "utf8");

    for (const table of ["demo_candidates", "candidate_reveals"]) {
      const definition = sql.match(
        new RegExp(`create table public\\.${table} \\(([\\s\\S]*?)\\n\\);`, "i"),
      )?.[1];
      expect(definition).toMatch(/created_at timestamptz not null default now\(\)/i);
      expect(definition).toMatch(/updated_at timestamptz not null default now\(\)/i);
      expect(sql).toMatch(new RegExp(
        `create trigger ${table}_set_updated_at[\\s\\S]*?before update on public\\.${table}[\\s\\S]*?execute function public\\.set_updated_at\\(\\)`,
        "i",
      ));
    }
  });

  it("activeな匿名プロフィールだけをauthenticatedへ公開する", () => {
    const sql = readFileSync(migrationPath, "utf8");

    expect(sql).toMatch(/alter table public\.demo_candidates enable row level security/i);
    expect(sql).toMatch(/alter table public\.demo_candidates force row level security/i);
    expect(sql).toMatch(/for select\s+to authenticated\s+using \(active\)/i);
    expect(sql).toMatch(/grant select on table public\.demo_candidates to authenticated/i);
    expect(sql).not.toMatch(/grant select on table public\.demo_candidates to anon/i);
  });

  it("候補者の開示情報を直接SELECTできない", () => {
    const sql = readFileSync(migrationPath, "utf8");

    expect(sql).toMatch(/alter table public\.candidate_reveals enable row level security/i);
    expect(sql).toMatch(/alter table public\.candidate_reveals force row level security/i);
    expect(sql).toMatch(/revoke all on table public\.candidate_reveals from anon, authenticated/i);
    expect(sql).not.toMatch(
      /grant\s+select\s+on\s+(?:table\s+)?public\.candidate_reveals/i,
    );
    expect(sql).not.toMatch(/create policy[^;]+on public\.candidate_reveals/i);
  });

  it("固定1件を識別情報なしの匿名面と完全架空の開示面へ冪等投入する", () => {
    const seed = readFileSync(seedPath, "utf8");
    const profileSource = seed.match(/\$profile\$([\s\S]*?)\$profile\$\s*::jsonb/)?.[1];

    expect(profileSource).toBeDefined();
    const profile = JSON.parse(profileSource!);
    expect(Object.keys(profile)).toEqual([
      "interests",
      "conversation_style",
      "values",
      "weekend_style",
    ]);
    expect(JSON.stringify(profile)).not.toMatch(
      /full_name|company|department|email|phone|address|birth|location/i,
    );
    expect(seed.match(/on conflict/gi)).toHaveLength(2);
    expect(seed).toMatch(
      /where \(demo_candidates\.avatar_alias, demo_candidates\.conversation_profile, demo_candidates\.active\)\s+is distinct from \(excluded\.avatar_alias, excluded\.conversation_profile, excluded\.active\)/i,
    );
    expect(seed).toMatch(
      /where \(candidate_reveals\.full_name, candidate_reveals\.company, candidate_reveals\.department, candidate_reveals\.bio\)\s+is distinct from \(excluded\.full_name, excluded\.company, excluded\.department, excluded\.bio\)/i,
    );
    expect(seed.match(/00000000-0000-4000-8000-000000000001/g)).toHaveLength(2);
    expect(seed).toContain("星乃 ルナ（完全架空）");
    expect(seed).toContain("ルミナス架空企画株式会社（完全架空）");
    expect(seed).toContain("未来対話デザイン室（完全架空）");
    expect(seed).toContain("実在の人物・団体とは関係ありません");
    const bio = seed.match(
      /'未来対話デザイン室（完全架空）',\s*'([^']+)'\s*\)/,
    )?.[1];
    expect(bio).toBeDefined();
    expect(Array.from(bio!).length).toBeLessThanOrEqual(500);
  });
});
