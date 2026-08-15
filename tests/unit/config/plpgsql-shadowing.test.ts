import { readdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const migrationsDir = resolve(process.cwd(), "supabase/migrations");
const files = readdirSync(migrationsDir).filter((name) => name.endsWith(".sql"));
const allSql = files.map((file) => readFileSync(resolve(migrationsDir, file), "utf8")).join("\n");

/** スキーマ全体の列名を集める。 */
const columnNames = new Set<string>();
for (const table of allSql.matchAll(/create table [^(]+\(([\s\S]*?)\n\);/g)) {
  for (const line of table[1]!.split("\n")) {
    const column = line.match(
      /^\s{2}([a-z_]+)\s+(?:uuid|text|integer|smallint|boolean|jsonb|timestamptz|public\.)/,
    );
    if (column) columnNames.add(column[1]!);
  }
}

/**
 * plpgsqlの変数名が、同じ関数内で参照するテーブルの列名と同じだと、裸の参照が
 * 42702 (ambiguous_column) になる。`where run.owner_id = owner_id` のように左辺を
 * 修飾しても、右辺の裸の名前は曖昧なまま。
 *
 * 実際にマッチング系4関数とアバター要約の保存がこれで壊れ、インタビュー完了後は
 * 誰も先へ進めない状態だった。pgTAPを実行できない環境でも再発を検出する。
 *
 * 回避手段は2つ。どちらかを満たしていればよい。
 * 1. 変数名を列名と重ならないものにする(current_owner_id など)
 * 2. `#variable_conflict use_variable` を宣言して解釈を確定させる
 */
describe("plpgsqlの変数名が列名と衝突しない", () => {
  it.each(files)("%s の各関数が曖昧な参照を持たない", (file) => {
    const sql = readFileSync(resolve(migrationsDir, file), "utf8");
    const violations: string[] = [];

    for (const body of sql.matchAll(/\$\$([\s\S]*?)\$\$/g)) {
      const source = body[1]!;
      if (source.includes("#variable_conflict")) continue;

      // publicスキーマのテーブルを参照しない関数は、そもそも列名と衝突しない。
      if (!/\b(?:from|into|update|join)\s+public\.[a-z_]+/.test(source)) continue;

      for (const block of source.matchAll(/\bdeclare\b([\s\S]*?)\bbegin\b/g)) {
        for (const variable of block[1]!.matchAll(
          /(?:^|\s)([a-z_]+)\s+(?:uuid|text|integer|smallint|boolean|jsonb|timestamptz|public\.)/g,
        )) {
          const name = variable[1]!;
          if (columnNames.has(name)) violations.push(name);
        }
      }
    }

    expect(
      [...new Set(violations)],
      `列名と同じ変数があり #variable_conflict も無い: ${[...new Set(violations)].join(", ")}`,
    ).toEqual([]);
  });
});
