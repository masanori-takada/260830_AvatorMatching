import { existsSync, readdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const migrationsDir = resolve(process.cwd(), "supabase/migrations");

function readConsentMigration(): string {
  const files = readdirSync(migrationsDir).filter((file) => file.endsWith("_two_stage_consent_chat.sql"));
  expect(files, "二段階承認migrationが1件だけ存在する").toHaveLength(1);
  const path = resolve(migrationsDir, files[0]!);
  expect(existsSync(path)).toBe(true);
  return readFileSync(path, "utf8");
}

describe("二段階承認・チャットDB契約", () => {
  it("接続状態と所有者ごとのアクティブフローを定義する", () => {
    const sql = readConsentMigration();

    expect(sql).toMatch(/create type public\.match_connection_state as enum \(\s*'profile_pending',\s*'profile_revealed',\s*'contact_pending',\s*'connected',\s*'closed'\s*\)/i);
    expect(sql).toMatch(/create table public\.match_connections[\s\S]*?owner_id uuid not null references auth\.users\(id\) on delete cascade/i);
    expect(sql).toMatch(/match_run_id uuid not null(?: unique)? references public\.match_runs\(id\) on delete cascade/i);
    expect(sql).toMatch(/create unique index match_connections_one_active_owner_uidx[\s\S]*?where state in \('profile_pending', 'profile_revealed', 'contact_pending', 'connected'\)/i);
    expect(sql).toMatch(/drop index if exists public\.decisions_owner_accept_uidx/i);
  });

  it("チャットを接続所有者だけに公開し、候補者の直接INSERTを許可しない", () => {
    const sql = readConsentMigration();

    expect(sql).toMatch(/create table public\.chat_messages[\s\S]*?connection_id uuid not null references public\.match_connections\(id\) on delete cascade/i);
    expect(sql).toMatch(/sender text not null check \(sender in \('owner', 'candidate'\)\)/i);
    expect(sql).toMatch(/body text not null check \(char_length\(body\) between 1 and 1000\)/i);
    expect(sql).toMatch(/alter table public\.chat_messages enable row level security[\s\S]*?alter table public\.chat_messages force row level security/i);
    expect(sql).toMatch(/create policy "chat_messages_select_own"[\s\S]*?using \(\(select auth\.uid\(\)\) = owner_id\)/i);
    expect(sql).toMatch(/revoke all on table public\.chat_messages from public, anon, authenticated/i);
    expect(sql).toMatch(/grant select on table public\.chat_messages to authenticated/i);
    expect(sql).toMatch(/revoke all on function public\.send_chat_message\(uuid, text\) from public, anon/i);
  });

  it("開示RPCの戻り値を許可された6項目へ限定する", () => {
    const sql = readConsentMigration();

    expect(sql).toMatch(/returns table \(\s*first_name text,\s*age_range text,\s*interests text\[\],\s*bio text,\s*photo_path text,\s*is_ai_generated boolean\s*\)/i);
    expect(sql).toMatch(/state in \('profile_revealed', 'contact_pending', 'connected'\)/i);
    expect(sql).toMatch(/revoke all on table public\.candidate_reveals from public, anon, authenticated/i);
    expect(sql).toMatch(/grant execute on function public\.get_candidate_reveal\(uuid\) to authenticated/i);
    expect(sql).not.toMatch(/returns table \([^)]*full_name/i);
  });

  it("最終承認と送信RPCをSECURITY DEFINER・所有者検証付きで公開する", () => {
    const sql = readConsentMigration();

    for (const functionName of ["commit_contact_decision", "send_chat_message"]) {
      expect(sql).toMatch(new RegExp(`create or replace function public\\.${functionName}\\([\\s\\S]*?security definer set search_path = ''`, "i"));
      expect(sql).toMatch(new RegExp(`create or replace function public\\.${functionName}[\\s\\S]*?auth\\.uid\\(\\)`, "i"));
      expect(sql).toMatch(new RegExp(`revoke all on function public\\.${functionName}`, "i"));
      expect(sql).toMatch(new RegExp(`grant execute on function public\\.${functionName}.*authenticated`, "i"));
    }

    expect(sql).toMatch(/create or replace function public\.commit_contact_decision\(\s*p_connection_id uuid,\s*p_kind public\.decision_kind\s*\)[\s\S]*?returns table \(\s*state public\.match_connection_state,\s*connection_id uuid\s*\)/i);
    expect(sql).toMatch(/create or replace function public\.send_chat_message\([\s\S]*?\)[\s\S]*?returns uuid/i);
    expect(sql).toContain("contact_ready");
  });

  it("最終判断NULLを副作用より前に専用エラーで拒否する", () => {
    const sql = readConsentMigration();
    const contactDecisionFunction = sql.match(
      /create or replace function public\.commit_contact_decision[\s\S]*?\n\$\$;/i,
    )?.[0];

    expect(contactDecisionFunction).toBeDefined();
    expect(contactDecisionFunction).toMatch(
      /if p_kind is null then\s+raise exception 'INVALID_CONTACT_DECISION';\s+end if;[\s\S]*?select \* into selected_connection/i,
    );
  });

  it("送信RPCは改行・タブ・Unicode空白だけの本文も空として拒否する", () => {
    const sql = readConsentMigration();
    const sendMessageFunction = sql.match(
      /create or replace function public\.send_chat_message[\s\S]*?\n\$\$;/i,
    )?.[0];

    expect(sendMessageFunction).toBeDefined();
    expect(sendMessageFunction).toMatch(/whitespace_chars text :=[\s\S]*?chr\(160\)[\s\S]*?chr\(8239\)[\s\S]*?chr\(12288\)/i);
    expect(sendMessageFunction).toMatch(/trimmed_text text := btrim\(coalesce\(p_text, ''\), whitespace_chars\)/i);
  });

  it("承認前通知から候補の具体名を除き、既存通知も匿名化する", () => {
    const sql = readConsentMigration();

    expect(sql).toMatch(/create trigger notifications_anonymize_before_reveal\s+before insert or update on public\.notifications/i);
    expect(sql).toMatch(/if new\.kind = 'match_completed' then[\s\S]*?new\.title := '候補アバターとの会話が完了しました'/i);
    expect(sql).toMatch(/elsif new\.kind = 'report_ready' then[\s\S]*?new\.title := '候補アバターの相性レポートができました'/i);
    expect(sql).toMatch(/update public\.notifications\s+set title = case kind[\s\S]*?where kind in \('match_completed', 'report_ready'\)/i);
  });

  it("既存と将来の承認前AI表示列を6候補名だけ匿名化する", () => {
    const sql = readConsentMigration();

    for (const name of ["ルナ", "陽翔", "紬", "蒼太", "隼人", "芽衣"]) {
      expect(sql).toContain(`replace(result, '${name}', '候補アバター')`);
    }
    expect(sql).toMatch(/update public\.conversation_messages\s+set body = public\.anonymize_pre_consent_text\(body\)\s+where body ~ '\(ルナ\|陽翔\|紬\|蒼太\|隼人\|芽衣\)'/i);
    expect(sql).toMatch(/update public\.compatibility_reports\s+set summary = public\.anonymize_pre_consent_text\(summary\),\s*caution = public\.anonymize_pre_consent_text\(caution\)/i);
    expect(sql).toMatch(/update public\.compatibility_dimensions\s+set explanation = public\.anonymize_pre_consent_text\(explanation\)/i);
    expect(sql).toMatch(/create trigger conversation_messages_anonymize_before_reveal\s+before insert or update on public\.conversation_messages/i);
    expect(sql).toMatch(/create trigger compatibility_reports_anonymize_before_reveal\s+before insert or update on public\.compatibility_reports/i);
    expect(sql).toMatch(/create trigger compatibility_dimensions_anonymize_before_reveal\s+before insert or update on public\.compatibility_dimensions/i);
  });

  it("既存の承諾を保全し、resetで接続・発言・通知をowner単位に消す", () => {
    const sql = readConsentMigration();

    expect(sql).toMatch(/create function public\.backfill_accepted_match_connections\(\)[\s\S]*?insert into public\.match_connections[\s\S]*?from public\.decisions[\s\S]*?decision\.kind = 'accept'[\s\S]*?on conflict \(match_run_id\) do nothing/i);
    expect(sql).toMatch(/revoke all on function public\.backfill_accepted_match_connections\(\) from public, anon, authenticated/i);
    expect(sql).toMatch(/select public\.backfill_accepted_match_connections\(\)/i);
    expect(sql).toMatch(/create or replace function public\.reset_my_demo_data\(\)[\s\S]*?delete from public\.chat_messages where owner_id = current_owner_id[\s\S]*?delete from public\.match_connections where owner_id = current_owner_id[\s\S]*?delete from public\.notifications where owner_id = current_owner_id/i);
    expect(sql).not.toMatch(/delete from public\.demo_candidates/i);
    expect(sql).not.toMatch(/delete from public\.candidate_reveals/i);
  });

  it("6候補に安定した画像パスと完全な架空表示フラグを設定する", () => {
    const sql = readConsentMigration();
    const expectedIds = [
      "00000000-0000-4000-8000-000000000001",
      "00000000-0000-4000-8000-000000000002",
      "00000000-0000-4000-8000-000000000003",
      "00000000-0000-4000-8000-000000000004",
      "00000000-0000-4000-8000-000000000005",
      "00000000-0000-4000-8000-000000000006",
    ];

    expect(sql.match(/'\/images\/demo-candidates\/[^']+\.webp'/g)).toHaveLength(6);
    for (const id of expectedIds) {
      expect(sql).toContain(id);
    }
    expect(sql).toMatch(/is_ai_generated boolean not null default true/i);
    expect(sql).toMatch(/is_ai_generated = true/i);
  });
});
