import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

// この環境にはDockerが無くpgTAPを実行できないため、SQLファイルを静的に読んで
// 契約(owner分離・原子性・最小権限)を検証する。実行はユーザーがDocker環境で行う。
const migrationPath = resolve(process.cwd(), "supabase/migrations/202608150003_reset.sql");
const pgTapPath = resolve(process.cwd(), "supabase/tests/database/004_reset.test.sql");

describe("reset DB契約", () => {
  it("reset_my_demo_dataがowner単位で完結し実行権限を最小化する", () => {
    const sql = readFileSync(migrationPath, "utf8");

    expect(sql).toMatch(/create or replace function public\.reset_my_demo_data\(\)/i);
    expect(sql).toMatch(/returns void/i);
    expect(sql).toMatch(/security definer set search_path = ''/i);

    // 列名owner_idとの衝突を避けた変数名になっていること(過去のplpgsqlシャドーイング事故対策)。
    expect(sql).toMatch(/current_owner_id uuid := \(select auth\.uid\(\)\)/i);
    expect(sql).not.toMatch(/declare\s+owner_id uuid/i);

    // 認証済みユーザー本人の行だけを削除対象にしていること。
    expect(sql).toMatch(/delete from public\.interview_answers where owner_id = current_owner_id/i);
    expect(sql).toMatch(/delete from public\.avatar_profiles where owner_id = current_owner_id/i);
    expect(sql).toMatch(/delete from public\.match_runs where owner_id = current_owner_id/i);

    // 共有の参照データ(候補・開示情報)には触れないこと。
    expect(sql).not.toMatch(/delete from public\.demo_candidates/i);
    expect(sql).not.toMatch(/delete from public\.candidate_reveals/i);

    // 会話ログ・相性レポート・決定はmatch_run_idがnot nullなので、match_runsの
    // on delete cascadeだけで確実に消える。このファイル内で個別にdeleteしないこと
    // (1関数内で完結する原子的な削除)。
    expect(sql).not.toMatch(/delete from public\.conversation_messages/i);
    expect(sql).not.toMatch(/delete from public\.compatibility_reports/i);
    expect(sql).not.toMatch(/delete from public\.compatibility_dimensions/i);
    expect(sql).not.toMatch(/delete from public\.decisions/i);

    // notifications.match_run_idはnullable(202608130003_matching.sql)なので、
    // match_runsのカスケードだけに頼ると、マッチに紐づかない通知が削除されずに残る
    // 可能性がある(スキーマが強制していない不変条件に依存することになる)。そのため
    // owner_idを条件に明示的にDELETEし、かつmatch_runsの削除より前に実行されている
    // ことを検証する(先に消してもnotifications.match_run_idのFKは崩れないが、
    // 順序を明示してレビュー可能にする)。
    expect(sql).toMatch(/delete from public\.notifications where owner_id = current_owner_id/i);
    const notificationsDeleteIndex = sql.search(/delete from public\.notifications where owner_id = current_owner_id/i);
    const matchRunsDeleteIndex = sql.search(/delete from public\.match_runs where owner_id = current_owner_id/i);
    expect(notificationsDeleteIndex).toBeGreaterThan(-1);
    expect(matchRunsDeleteIndex).toBeGreaterThan(-1);
    expect(notificationsDeleteIndex).toBeLessThan(matchRunsDeleteIndex);

    expect(sql).toMatch(/revoke all on function public\.reset_my_demo_data\(\) from public, anon/i);
    expect(sql).toMatch(/grant execute on function public\.reset_my_demo_data\(\) to authenticated/i);
    expect(sql).not.toMatch(/grant execute on function public\.reset_my_demo_data\(\) to anon/i);
  });

  it("参照先のカスケード削除が実際に定義されている", () => {
    const matchingSql = readFileSync(
      resolve(process.cwd(), "supabase/migrations/202608130003_matching.sql"),
      "utf8",
    );
    const decisionSql = readFileSync(
      resolve(process.cwd(), "supabase/migrations/202608130004_decision_reveal.sql"),
      "utf8",
    );

    for (const table of ["conversation_messages", "compatibility_reports", "notifications"]) {
      expect(matchingSql).toMatch(
        new RegExp(`create table public\\.${table}[\\s\\S]*?references public\\.match_runs\\(id\\) on delete cascade`, "i"),
      );
    }
    expect(decisionSql).toMatch(
      /create table public\.decisions[\s\S]*?references public\.match_runs\(id\) on delete cascade/i,
    );
  });

  it("pgTAPがowner分離とカスケード削除、共有データの温存を検証する", () => {
    const sql = readFileSync(pgTapPath, "utf8");
    // plan(N)は実際のアサーション数と一致させる(数値のハードコードは更新漏れで赤コミットを招くため)。
    const planned = Number(sql.match(/select plan\((\d+)\)/i)?.[1]);
    const asserted = sql.match(/^select (?:is|isnt|ok|throws_ok|lives_ok|has_\w+)\b/gim)?.length ?? 0;
    expect(planned).toBe(asserted);
    expect(asserted).toBeGreaterThan(0);

    for (const contract of [
      "anonはリセットRPCを実行できない",
      "authenticatedはリセットRPCを実行できる",
      "ownerは自分のデモデータをリセットできる",
      "自分の回答が削除される",
      "自分のアバタープロフィールが削除される",
      "自分のmatch_runが削除される",
      "会話ログもカスケード削除される",
      "相性レポートもカスケード削除される",
      "相性の軸別評価もカスケード削除される",
      "決定もカスケード削除される",
      "通知もカスケード削除される",
      "match_run_idがNULLの通知も削除される",
      "削除後の再実行もエラーにならない",
      "別利用者の回答は消えない",
      "別利用者のアバタープロフィールは消えない",
      "別利用者のmatch_runは消えない",
      "別利用者の決定は消えない",
      "別利用者の通知は消えない",
      "共有の候補データは削除されない",
      "共有の開示データは削除されない",
    ]) {
      expect(sql).toContain(contract);
    }
  });
});
