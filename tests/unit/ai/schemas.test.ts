import { describe, expect, it } from "vitest";

import { assertAnswerRefsAreDisclosed } from "@/lib/ai/schemas";

// matchOutputSchemaのanswerRefsは41問のコードすべてをenumとして許可している
// (静的schemaでは、リクエストごとに変わる「実際に渡した回答」を表現できないため)。
// assertAnswerRefsAreDisclosedは、それを実際に渡した回答コードの集合で動的に絞り込む。
// 開示同意が無いデリケートな回答は最初からAIへ渡していないため、AIがそのコードを
// answerRefsに含めた場合は「渡していない質問を参照した」契約違反として拒否する。

function buildOutput(answerRefsByMessage: readonly string[][]) {
  return {
    messages: answerRefsByMessage.map((answerRefs) => ({ answerRefs })),
  };
}

describe("assertAnswerRefsAreDisclosed", () => {
  it("渡したコードだけを参照する出力は通す(そのまま返す)", () => {
    const output = buildOutput([["q01"], ["q02", "q04"]]);
    const disclosed = new Set(["q01", "q02", "q04"]);

    expect(assertAnswerRefsAreDisclosed(output, disclosed)).toBe(output);
  });

  it("渡していないコードを含む出力は拒否する(デリケートな回答が開示NGでも参照されうる代表例: 年収q28)", () => {
    const output = buildOutput([["q01"], ["q28"]]);
    // q28(年収)はデリケートな回答で、本人・相手のどちらかが開示NGのためAIへ渡していない想定。
    const disclosed = new Set(["q01", "q02"]);

    expect(() => assertAnswerRefsAreDisclosed(output, disclosed)).toThrow(
      "AIへ渡していない質問コード(q28)",
    );
  });

  it("渡した回答が空集合でも、参照が無ければ通す", () => {
    const output = buildOutput([[]]);
    expect(assertAnswerRefsAreDisclosed(output, new Set())).toBe(output);
  });

  it("複数発言のうち1件でも渡していないコードを参照すれば拒否する", () => {
    const output = buildOutput([["q01"], ["q02"], ["q31"]]);
    const disclosed = new Set(["q01", "q02"]);

    expect(() => assertAnswerRefsAreDisclosed(output, disclosed)).toThrow();
  });
});
