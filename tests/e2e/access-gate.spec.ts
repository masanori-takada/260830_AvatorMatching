import { expect, test } from "@playwright/test";

import { ACCESS_CODE } from "./support/access-gate";

// このspecはゲート自体の挙動を検証するため、他specと違い共通フィクスチャ
// (tests/e2e/support/access-gate.tsの`test`)を使わず、素の@playwright/testを使う。
// 各テストが自前でクッキー無しの新規コンテキストを作り、ゲート通過前の状態から検証する。

// 合言葉の値(テスト専用ダミー)は tests/e2e/support/access-gate.ts の
// ACCESS_CODE定数が唯一の定義元。.claude/launch.jsonのavatar-matching-e2e設定
// (env.ACCESS_CODE)にも同じ値を渡してサーバー側で有効化しておく必要がある。
// 環境変数の有無で条件付きスキップはしない(ゲートは検証必須のため)。

test.describe("合言葉ゲート", () => {
  test("クッキーが無い状態でトップへアクセスすると合言葉入力画面になる", async ({ browser }) => {
    const context = await browser.newContext();
    const page = await context.newPage();

    await page.goto("/");

    await expect(page).toHaveURL(/\/access-gate/);
    await expect(page.getByRole("heading", { name: "限定公開デモ" })).toBeVisible();
    await expect(page.getByLabel("合言葉")).toBeVisible();

    await context.close();
  });

  test("間違った合言葉では進めず、エラーが表示される", async ({ browser }) => {
    const context = await browser.newContext();
    const page = await context.newPage();

    await page.goto("/access-gate");
    await page.getByLabel("合言葉").fill("間違った合言葉-not-the-real-one");
    await page.getByRole("button", { name: "進む" }).click();

    await expect(page).toHaveURL(/\/access-gate/);
    await expect(page.getByRole("main").getByRole("alert")).toHaveText(
      "合言葉が違います。もう一度お試しください。",
    );
    // 依然としてアプリ本体へは入れない(トップへ行けばまたゲートへ戻される)。
    await page.goto("/");
    await expect(page).toHaveURL(/\/access-gate/);

    await context.close();
  });

  test("正しい合言葉を入れると元の画面へ進める", async ({ browser }) => {
    const context = await browser.newContext();
    const page = await context.newPage();

    // 「/start」を開こうとしてゲートへ誘導されたケースを模す。
    await page.goto("/start");
    await expect(page).toHaveURL(/\/access-gate/);

    await page.getByLabel("合言葉").fill(ACCESS_CODE);
    await page.getByRole("button", { name: "進む" }).click();

    // 元々開こうとしていた/startへ進める。
    await expect(page).toHaveURL(/\/start$/);
    await expect(page.getByRole("button", { name: "インタビューをはじめる" })).toBeVisible();

    // クッキーが発行されているので、再訪してもゲートへは戻されない。
    await page.goto("/start");
    await expect(page).toHaveURL(/\/start$/);

    await context.close();
  });

  test("静的アセットはゲートされない(合言葉入力画面自体が崩れず表示される)", async ({ browser, request }) => {
    const context = await browser.newContext();
    const page = await context.newPage();

    const responses: number[] = [];
    page.on("response", (response) => {
      if (response.url().includes("/_next/static/")) {
        responses.push(response.status());
      }
    });

    await page.goto("/access-gate");
    await expect(page.getByRole("button", { name: "進む" })).toBeVisible();

    // 少なくとも1つは_next/staticのリソースを読み込めており、かつゲート(=リダイレクト)
    // されていない(200で返っている)ことを確認する。
    expect(responses.length).toBeGreaterThan(0);
    expect(responses.every((status) => status === 200)).toBe(true);

    // favicon.icoのような静的アセットへ直接アクセスしても、ゲート画面へ回されない。
    const faviconResponse = await request.get("/favicon.ico");
    expect(faviconResponse.url()).not.toContain("/access-gate");

    await context.close();
  });
});
