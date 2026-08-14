import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("avatar_profiles DB契約", () => {
  it("所有者RLS・6領域・revision・timestampを強制する", () => {
    const sql = readFileSync(resolve(
      process.cwd(),
      "supabase/migrations/2026081300026_avatar_profiles.sql",
    ), "utf8");

    expect(sql).toMatch(/owner_id uuid not null unique references auth\.users\(id\) on delete cascade/i);
    expect(sql).toMatch(/char_length\(summary\) between 1 and 600/i);
    expect(sql).toMatch(/jsonb_object_length\(traits\) = 6/i);
    for (const key of ["leisure", "communication", "lifestyle", "values", "relationships", "priorities"]) {
      expect(sql).toContain(`traits ? '${key}'`);
    }
    expect(sql).toMatch(/source_revision integer not null check \(source_revision >= 20\)/i);
    expect(sql).toMatch(/created_at timestamptz not null default now\(\)/i);
    expect(sql).toMatch(/updated_at timestamptz not null default now\(\)/i);
    expect(sql).toMatch(/execute function public\.set_updated_at\(\)/i);
    expect(sql).toMatch(/alter table public\.avatar_profiles force row level security/i);
    expect(sql.match(/\(select auth\.uid\(\)\) = owner_id/g)).toHaveLength(4);
    expect(sql).toMatch(/grant select, insert, update on table public\.avatar_profiles to authenticated/i);
    expect(sql).toMatch(/on conflict \(owner_id\) do update[\s\S]*where \(avatar_profiles\.summary,[\s\S]*is distinct from \(excluded\.summary/i);
    expect(sql).toMatch(/grant execute on function public\.upsert_my_avatar_profile/i);
    expect(sql).toMatch(/security invoker/i);
    expect(sql).toMatch(/set search_path = ''/i);
    expect(sql).toMatch(/owner_id uuid := \(select auth\.uid\(\)\)/i);
    expect(sql).toMatch(/revoke all on function public\.upsert_my_avatar_profile[^;]+from public, anon/i);
    expect(sql).toMatch(/grant execute on function public\.upsert_my_avatar_profile[^;]+to authenticated/i);
  });

  it("pgTAPでRPCのanon拒否とauthenticated許可を検証する", () => {
    const sql = readFileSync(resolve(
      process.cwd(),
      "supabase/tests/database/004_avatar_profiles.test.sql",
    ), "utf8");

    expect(sql).toMatch(/select plan\(8\)/i);
    expect(sql).toMatch(/has_function_privilege\(\s*'anon',\s*'public\.upsert_my_avatar_profile\(text,jsonb,integer,text\)',\s*'execute'\s*\)[\s\S]*false/i);
    expect(sql).toMatch(/has_function_privilege\(\s*'authenticated',\s*'public\.upsert_my_avatar_profile\(text,jsonb,integer,text\)',\s*'execute'\s*\)[\s\S]*true/i);
  });
});
