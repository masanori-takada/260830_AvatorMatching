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

/**
 * `on conflict (列名, ...)` の対象列が、同じ関数内で宣言された変数名と同じだと危険。
 * `#variable_conflict use_variable` を宣言している場合は、対象列が変数として解釈され
 * 「ON CONFLICTの指定に一致する一意制約が無い」42P10 で失敗する
 * (実際に start_match_run() がこれで常に失敗していた。宣言済みの変数
 * `owner_id` と `on conflict (owner_id, candidate_id)` が衝突していた)。
 * 宣言していない場合も、ON CONFLICTの対象列はテーブル別名で修飾できないため
 * 曖昧さを列側の書き方で回避できない。
 *
 * 上のテスト(列名と同じ変数がありuse_variableも無い場合を検出)とは独立に、
 * `#variable_conflict use_variable` の有無に関わらず on conflict 対象列との
 * 衝突を検出する。回避手段は変数名を列名(=on conflictの対象列名)と
 * 重ならないものにすることだけ。
 *
 * `create or replace function` はDB上では後続のマイグレーションが前の定義を
 * 完全に上書きする。本番へ適用済みのファイルは書き換えない運用
 * (このリポジトリの方針)のため、過去のファイルには「後から上書きされて
 * 実害の無くなった」定義がそのまま残り続ける。ファイル単位で見ると誤検知に
 * なるため、関数名ごとにマイグレーション適用順で最後に有効な定義だけを
 * 抽出して検証する(=実際にDBへ反映される挙動と同じ単位で見る)。
 */
describe("on conflictの対象列が同じ関数内の変数名と衝突しない", () => {
  it("マイグレーション適用後の最終的な関数定義でon conflictの対象列が宣言済み変数と衝突しない", () => {
    const finalDefinitions = new Map<string, { file: string; source: string }>();

    for (const file of [...files].sort()) {
      const sql = readFileSync(resolve(migrationsDir, file), "utf8");
      for (const match of sql.matchAll(
        /create (?:or replace )?function public\.([a-z_]+)\s*\([^)]*\)[\s\S]*?\$\$([\s\S]*?)\$\$/gi,
      )) {
        const functionName = match[1]!;
        const source = match[2]!;
        // 同一ファイル内でも複数回定義されうる(このリポジトリでは無いが念のため)。
        // 常に最後に見つかった定義で上書きする。
        finalDefinitions.set(functionName, { file, source });
      }
    }

    const violations: string[] = [];
    for (const [functionName, { file, source }] of finalDefinitions) {
      const declared = new Set<string>();
      for (const block of source.matchAll(/\bdeclare\b([\s\S]*?)\bbegin\b/g)) {
        for (const variable of block[1]!.matchAll(
          /(?:^|\s)([a-z_]+)\s+(?:uuid|text|integer|smallint|boolean|jsonb|timestamptz|public\.)/g,
        )) {
          declared.add(variable[1]!);
        }
      }
      if (declared.size === 0) continue;

      for (const conflict of source.matchAll(/on conflict\s*\(([^)]*)\)/gi)) {
        for (const rawColumn of conflict[1]!.split(",")) {
          const column = rawColumn.trim();
          if (declared.has(column)) {
            violations.push(`${functionName} (${file}): ${column}`);
          }
        }
      }
    }

    expect(
      violations,
      `on conflictの対象列と同じ名前の変数が宣言されている(#variable_conflict use_variableの有無に関わらず危険): ${violations.join(", ")}`,
    ).toEqual([]);
  });
});
