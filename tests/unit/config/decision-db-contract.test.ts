import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("decision/reveal DB契約", () => {
  it("決定をINSERT-onlyにして承諾後だけ固定列を開示する", () => {
    const sql = readFileSync(resolve(process.cwd(), "supabase/migrations/202608130004_decision_reveal.sql"), "utf8");

    expect(sql).toMatch(/create type public\.decision_kind as enum \('accept', 'decline'\)/i);
    expect(sql).toMatch(/unique\s*\(match_run_id\)/i);
    expect(sql).toMatch(/create policy "decisions_select_own"[\s\S]*for select to authenticated/i);
    expect(sql.match(/create policy\s+"[^"]+"\s+on public\.decisions/gi)).toHaveLength(1);
    expect(sql).toMatch(/security definer set search_path = ''/i);
    expect(sql).toMatch(/status = 'completed'/i);
    expect(sql).toMatch(/decision\.kind = 'accept'/i);
    expect(sql).toMatch(/returns table \(full_name text, company text, department text, bio text\)/i);
    expect(sql).toMatch(/revoke all on table public\.candidate_reveals from public, anon, authenticated/i);
    expect(sql).toMatch(/revoke all on function public\.commit_decision\(uuid, public\.decision_kind\) from public, anon/i);
    expect(sql).toMatch(/grant execute on function public\.get_candidate_reveal\(uuid\) to authenticated/i);
  });
});
