import { readdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

import { DB_ERROR_CODES } from "@/lib/db-error-codes";

const migrationsDir = resolve(process.cwd(), "supabase/migrations");
const files = readdirSync(migrationsDir).filter((name) => name.endsWith(".sql"));
const allSql = files.map((file) => readFileSync(resolve(migrationsDir, file), "utf8")).join("\n");

/**
 * `src/lib/db-error-codes.ts` のDB_ERROR_CODESは、SQL側(supabase/migrations/)が
 * `raise exception '<識別子>'` として実際に投げている識別子と一致していなければならない。
 *
 * 食い違うと、TS側にログへ出したい識別子を追加し忘れたまま「原因不明」に落ちたり、
 * 逆にSQL側で使われなくなった識別子がTS側に残り続けたりする(本チケットの発端になった
 * 「P0001としか出ない=どの raise exception か判別できない」状態の再発防止)。
 *
 * DECISION_CONFLICT のように動的な値を後ろへ付与する識別子(`'DECISION_CONFLICT:%', kind`)は
 * 固定の識別子一覧との単純一致では扱えないため、この正規表現には含まれず、意図的に対象外。
 * (decision/server/actions.tsで専用の正規表現により、accept/declineという既知の値だけを
 * 安全に取り出している。)
 */
describe("DB例外識別子のSQL/TS契約", () => {
  it("supabase/migrations/*.sqlのraise exception識別子とDB_ERROR_CODESが一致する", () => {
    const foundInSql = new Set<string>();
    for (const match of allSql.matchAll(/raise exception '([A-Z_]+)'/g)) {
      foundInSql.add(match[1]!);
    }

    const registered = new Set(DB_ERROR_CODES);

    const missingFromRegistry = [...foundInSql].filter((code) => !registered.has(code as (typeof DB_ERROR_CODES)[number]));
    const staleInRegistry = [...registered].filter((code) => !foundInSql.has(code));

    expect(
      missingFromRegistry,
      `SQLでraise exceptionされているが src/lib/db-error-codes.ts のDB_ERROR_CODESに無い識別子: ${missingFromRegistry.join(", ")}`,
    ).toEqual([]);
    expect(
      staleInRegistry,
      `DB_ERROR_CODESにあるが、どのmigrationのraise exceptionにも存在しない識別子(削除漏れの可能性): ${staleInRegistry.join(", ")}`,
    ).toEqual([]);
  });
});
