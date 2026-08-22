import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const migrationPath = resolve(
  process.cwd(),
  "supabase/migrations/20260822161327_remove_avatar_profile_dependency.sql",
);

describe("アバター要約廃止のDB契約", () => {
  it("start_match_runは全回答だけで最大3件を作り、要約を参照しない", () => {
    const sql = readFileSync(migrationPath, "utf8");
    const startMatch = sql.match(
      /create or replace function public\.start_match_run\(\)[\s\S]*?grant execute on function public\.start_match_run\(\) to authenticated;/i,
    )?.[0];

    expect(startMatch).toBeDefined();
    expect(startMatch).toMatch(/answer_count <> 42/i);
    expect(startMatch).toMatch(/limit 3/i);
    expect(startMatch).not.toMatch(/avatar_profiles|PROFILE_NOT_FOUND|STALE_PROFILE/i);
  });

  it("旧要約RPCとテーブルを削除する", () => {
    const sql = readFileSync(migrationPath, "utf8");
    expect(sql).toMatch(/drop function if exists public\.get_avatar_profile_status\(\)/i);
    expect(sql).toMatch(/drop function if exists public\.upsert_my_avatar_profile/i);
    expect(sql).toMatch(/drop table if exists public\.avatar_profiles/i);
  });
});
