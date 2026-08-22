import { readdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const migrationsDir = resolve(process.cwd(), "supabase/migrations");
const files = [...readdirSync(migrationsDir).filter((name) => name.endsWith(".sql"))].sort();

/**
 * 利用者ごとのデータを保持するテーブル。これらのいずれかを参照する外部キーに
 * on delete cascadeが無いと、上流の行(match_runsなど)を削除したときに参照が
 * 壊れて23503 (foreign_key_violation) になる。
 *
 * 実際に compatibility_dimensions.evidence_message_id (→ conversation_messages) で
 * これが起き、会話とレポートが完成した利用者だけがリセットに失敗した
 * (202608220005_fix_reset_fk.sql参照)。E2Eのリセットテストは数問回答した直後に
 * リセットしており、この経路を通っていなかったため検出できなかった。
 * pgTAPも実行できない環境があるため、マイグレーションを静的に読んで再発を検出する。
 *
 * demo_candidates(候補者マスタ)とinterview_questions(設問マスタ)は複数利用者が
 * 共有する参照データで、利用者ごとのリセットで消してはいけない。そのためこれらを
 * 参照する外部キーは対象外にする(on delete cascadeが無いのはむしろ正しい)。
 */
const USER_DATA_TABLES = new Set([
  "match_runs",
  "conversation_messages",
  "compatibility_reports",
  "compatibility_dimensions",
  "interview_answers",
  "avatar_profiles",
  "decisions",
  "notifications",
]);

type FkDefinition = {
  table: string;
  column: string;
  refTable: string;
  cascade: boolean;
  file: string;
};

/**
 * `create table public.<table> (...)` 内のインライン列制約から外部キーを収集する。
 * 例: `evidence_message_id uuid not null references public.conversation_messages(id),`
 */
function collectInlineForeignKeys(sql: string, file: string): FkDefinition[] {
  const results: FkDefinition[] = [];
  for (const tableMatch of sql.matchAll(/create table public\.([a-z_]+)\s*\(([\s\S]*?)\n\);/g)) {
    const table = tableMatch[1]!;
    const body = tableMatch[2]!;
    for (const line of body.split("\n")) {
      const columnMatch = line.match(
        /^\s*([a-z_]+)\s+uuid\b[\s\S]*?references public\.([a-z_]+)\(([a-z_]+)\)(\s+on delete cascade)?/,
      );
      if (!columnMatch) continue;
      results.push({
        table,
        column: columnMatch[1]!,
        refTable: columnMatch[2]!,
        cascade: Boolean(columnMatch[4]),
        file,
      });
    }
  }
  return results;
}

/**
 * `alter table public.<table> add constraint <name> foreign key (<column>)
 * references public.<refTable>(...) [on delete cascade]` 形式の再定義を収集する。
 * 202608220005_fix_reset_fk.sqlのように、既存の制約をdrop constraintしてから
 * add constraintし直す修正パッチはこの形式になる。
 */
function collectAlterForeignKeys(sql: string, file: string): FkDefinition[] {
  const results: FkDefinition[] = [];
  for (const match of sql.matchAll(
    /alter table public\.([a-z_]+)\s+add constraint\s+[a-z_]+\s+foreign key\s*\(([a-z_]+)\)\s+references public\.([a-z_]+)\(([a-z_]+)\)(\s*on delete cascade)?/gi,
  )) {
    results.push({
      table: match[1]!,
      column: match[2]!,
      refTable: match[3]!,
      cascade: Boolean(match[5]),
      file,
    });
  }
  return results;
}

describe("利用者データを参照する外部キーにon delete cascadeが付いている", () => {
  it("マイグレーション適用順で最終的に有効な外部キー定義でcascadeが揃っている", () => {
    // (table, column) をキーに、マイグレーションの適用順(ファイル名の日付プレフィックス順)で
    // 最後に見つかった定義で上書きする。202608220005_fix_reset_fk.sqlのようにdrop→add
    // し直す修正が後続のファイルにあれば、それが最終的にDBへ反映される定義になる。
    // `create or replace function`はDB上で後続の定義が前の定義を完全に上書きするため
    // 関数単位でファイル横断的に最終定義を見るplpgsql-shadowing.test.tsと同じ考え方。
    const finalFks = new Map<string, FkDefinition>();

    for (const file of files) {
      const sql = readFileSync(resolve(migrationsDir, file), "utf8");
      const fks = [...collectInlineForeignKeys(sql, file), ...collectAlterForeignKeys(sql, file)];
      for (const fk of fks) {
        finalFks.set(`${fk.table}.${fk.column}`, fk);
      }
    }

    const checked: string[] = [];
    const violations: string[] = [];
    for (const fk of finalFks.values()) {
      // 共有の参照データ(demo_candidates・interview_questionsなど)を参照するFKは対象外。
      if (!USER_DATA_TABLES.has(fk.refTable)) continue;
      checked.push(`${fk.table}.${fk.column} -> ${fk.refTable}`);
      if (!fk.cascade) {
        violations.push(
          `${fk.table}.${fk.column} が public.${fk.refTable} を参照しているが on delete cascade が無い(${fk.file})`,
        );
      }
    }

    // このテスト自体が何も検査せず素通りしていないことを保証する(検出ロジックの骨抜き防止)。
    expect(checked.length).toBeGreaterThan(0);
    expect(violations).toEqual([]);
  });

  it("共有の参照データ(demo_candidates・interview_questions)は検査対象から明示的に除外されている", () => {
    // USER_DATA_TABLESに紛れ込んでいないことを保証する(除外漏れの誤混入防止)。
    expect(USER_DATA_TABLES.has("demo_candidates")).toBe(false);
    expect(USER_DATA_TABLES.has("interview_questions")).toBe(false);
  });
});
