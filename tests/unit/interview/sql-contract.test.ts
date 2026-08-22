import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

import { INTERVIEW_QUESTIONS } from "@/features/interview/domain";

// SQLとTypeScriptに同じ質問リストが二重に存在する(supabase/migrations/ と domain.ts)ため、
// 食い違いを検出できるようこのテストで両者を突き合わせる。
//
// 既存質問(q01〜q20)は 202608130002_interview.sql に元のdisplay_order(1〜20)のまま定義され、
// 202608220001_interview_profile_questions.sql のUPDATE文で+21され22〜41になる。
// 新規質問(q21〜q41)は202608220001側にdisplay_order 1〜21として直接定義される
// (基本プロフィール17問=1〜17、開示意思4問=18〜21)。
// さらに202608220004_gender_matching.sqlのUPDATE文で、q21(display_order=1)を除く
// 全行のdisplay_orderが+1され、q42がdisplay_order=2として挿入される
// (相手に紹介してほしい性別の質問。q21の直後)。
// このテストは3ファイルを読み、実際に適用される最終状態を組み立ててdomain.tsと比較する。

type QuestionRow = [code: string, displayOrder: number, category: string, kind: string, prompt: string, choices: unknown];

// 202608130002側は1行1件、202608220001側は可読性のため2行に分けて書いているため、
// フィールド区切りの空白は改行を含めて許容する(\s*)。
const INSERT_ROW_PATTERN =
  /\('(q\d{2})',\s*(\d+),\s*'([^']+)',\s*'(choice|free_text)',\s*'([^']+)',\s*'(\[[^']*\])',\s*(?:null|\d+),\s*(?:null|\d+)\)[,;]/g;

function parseInsertRows(sql: string): QuestionRow[] {
  return [...sql.matchAll(INSERT_ROW_PATTERN)].map((match) => [
    match[1]!,
    Number(match[2]),
    match[3]!,
    match[4]!,
    match[5]!,
    JSON.parse(match[6]!),
  ]);
}

describe("固定42問のSQL同期契約", () => {
  it("TypeScriptとmigrationが仕様の全42問(既存20問+基本プロフィール17問+開示意思4問+相手の性別希望1問)と一致する", () => {
    const baseSql = readFileSync(
      resolve(process.cwd(), "supabase/migrations/202608130002_interview.sql"),
      "utf8",
    );
    const profileSql = readFileSync(
      resolve(process.cwd(), "supabase/migrations/202608220001_interview_profile_questions.sql"),
      "utf8",
    );
    const genderSql = readFileSync(
      resolve(process.cwd(), "supabase/migrations/202608220004_gender_matching.sql"),
      "utf8",
    );

    // 202608130002側の既存20問には、その後のUPDATEで加算されるオフセットを適用する。
    const offsetMatch = /display_order\s*=\s*display_order\s*\+\s*(\d+)/.exec(profileSql);
    expect(offsetMatch, "既存質問のdisplay_orderをずらすUPDATE文が見つかりません").not.toBeNull();
    const offset = Number(offsetMatch![1]);

    const existingRows = parseInsertRows(baseSql).map(
      ([code, displayOrder, category, kind, prompt, choices]): QuestionRow => [
        code, displayOrder + offset, category, kind, prompt, choices,
      ],
    );
    const newRows = parseInsertRows(profileSql);

    // 202608220004側: display_order>=2の行はすべて+1され、q42がdisplay_order=2として挿入される。
    const genderOffsetMatch = /display_order\s*=\s*display_order\s*\+\s*(\d+)\s*\nwhere display_order >= (\d+)/.exec(genderSql);
    expect(genderOffsetMatch, "q42挿入前にdisplay_orderをずらすUPDATE文が見つかりません").not.toBeNull();
    const genderOffset = Number(genderOffsetMatch![1]);
    const genderOffsetThreshold = Number(genderOffsetMatch![2]);
    const genderNewRows = parseInsertRows(genderSql);
    expect(genderNewRows, "q42のINSERT文が見つかりません").toHaveLength(1);

    const shiftedRows = [...newRows, ...existingRows].map(
      ([code, displayOrder, category, kind, prompt, choices]): QuestionRow =>
        displayOrder >= genderOffsetThreshold
          ? [code, displayOrder + genderOffset, category, kind, prompt, choices]
          : [code, displayOrder, category, kind, prompt, choices],
    );

    const sqlQuestions = [...genderNewRows, ...shiftedRows]
      .slice()
      .sort((left, right) => left[1] - right[1]);

    const domainQuestions = INTERVIEW_QUESTIONS
      .map(({ code, displayOrder, category, kind, prompt, choices }): QuestionRow => [
        code, displayOrder, category, kind, prompt, [...choices],
      ])
      .slice()
      .sort((left, right) => left[1] - right[1]);

    expect(sqlQuestions).toEqual(domainQuestions);
  });
});
