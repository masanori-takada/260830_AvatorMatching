import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const migrationPath = resolve(process.cwd(), "supabase/migrations/202608130003_matching.sql");
const pgTapPath = resolve(process.cwd(), "supabase/tests/database/002_match_processing.test.sql");

describe("matching DB契約", () => {
  it("5テーブル・enum・owner RLS・最小権限・Realtimeを定義する", () => {
    const sql = readFileSync(migrationPath, "utf8");
    for (const type of ["match_status", "notification_kind", "compatibility_axis"]) {
      expect(sql).toMatch(new RegExp(`create type public\\.${type}`, "i"));
    }
    for (const table of ["match_runs", "conversation_messages", "compatibility_reports", "compatibility_dimensions", "notifications"]) {
      expect(sql).toMatch(new RegExp(`create table public\\.${table}`, "i"));
      expect(sql).toMatch(new RegExp(`alter table public\\.${table} force row level security`, "i"));
      expect(sql).toMatch(new RegExp(`grant select on table public\\.${table} to authenticated`, "i"));
    }
    expect(sql).toMatch(/attempt_count smallint not null default 0 check \(attempt_count between 0 and 3\)/i);
    expect(sql).toMatch(/unique \(match_run_id, turn_index\)/i);
    expect(sql).toMatch(/unique \(report_id, axis\)/i);
    expect(sql).toMatch(/alter publication supabase_realtime add table public\.match_runs, public\.notifications/i);
    expect(sql).not.toMatch(/candidate_reveals/i);
  });

  it("4 RPCがowner・状態・出力・原子性を検証し実行権限を限定する", () => {
    const sql = readFileSync(migrationPath, "utf8");
    for (const signature of [
      "start_match_run()", "claim_match_run(uuid)",
      "complete_match_run(uuid, jsonb)", "fail_match_run(uuid, text)",
    ]) {
      const escaped = signature.replace(/[().]/g, "\\$&").replace(", ", ",\\s*");
      expect(sql).toMatch(new RegExp(`security definer[\\s\\S]*set search_path = ''`, "i"));
      expect(sql).toMatch(new RegExp(`revoke all on function public\\.${escaped} from public, anon`, "i"));
      expect(sql).toMatch(new RegExp(`grant execute on function public\\.${escaped} to authenticated`, "i"));
    }
    expect(sql).toMatch(/owner_id := public\.lock_current_user_journey\(\)/i);
    expect(sql).toMatch(/source_revision[\s\S]*sum\(answer\.revision\)[\s\S]*STALE_PROFILE/i);
    expect(sql).toMatch(/attempt_count < 3/i);
    expect(sql).toMatch(/run\.attempt_count not between 1 and 3/i);
    expect(sql).toMatch(/jsonb_array_length\(p_payload -> 'messages'\) not between 8 and 20/i);
    expect(sql).toMatch(/jsonb_typeof\(p_payload\) is distinct from 'object'/i);
    expect(sql).toMatch(/jsonb_typeof\(message -> 'answerRefs'\) is distinct from 'array'/i);
    expect(sql).toMatch(/jsonb_array_length\(message -> 'answerRefs'\) < 1/i);
    expect(sql).toMatch(/count\(distinct ref\.value\)[\s\S]*< 3/i);
    expect(sql).toMatch(/count\(distinct dimension ->> 'axis'\) = 5/i);
    expect(sql).toMatch(/interview_answers[\s\S]*answer_refs/i);
    expect(sql).toMatch(/insert into public\.conversation_messages[\s\S]*insert into public\.compatibility_reports[\s\S]*insert into public\.compatibility_dimensions[\s\S]*insert into public\.notifications[\s\S]*status = 'completed'/i);
    expect(sql).toMatch(/where id = p_match_run_id and match_runs\.owner_id = owner_id for update/i);
  });

  it("pgTAPが所有権・stale profile・必須refs・再試行・冪等完了を検証する", () => {
    const sql = readFileSync(pgTapPath, "utf8");
    // plan(N)は実際のアサーション数と一致させる(数値のハードコードは更新漏れで赤コミットを招くため)。
    const planned = Number(sql.match(/select plan\((\d+)\)/i)?.[1]);
    const asserted = sql.match(/^select (?:is|isnt|ok|throws_ok|lives_ok|has_\w+)\b/gim)?.length ?? 0;
    expect(planned).toBe(asserted);
    for (const contract of [
      "他ownerはclaimできない", "他ownerはcompleteできない", "古いプロフィールでは開始しない",
      "answerRefs欠落を拒否する", "answerRefs nullを拒否する", "answerRefs非arrayを拒否する",
      "空answerRefsを拒否する", "検証失敗時は部分書込を残さない", "4回目のclaimを拒否する",
      "complete再実行でも5軸を維持する",
    ]) {
      expect(sql).toContain(contract);
    }
  });
});
