import { expect, test } from "./support/access-gate";

import { reachFirstUndecidedReport, reachMatchList } from "./support/matching";

// 承諾後、/revealにはどの候補の架空プロフィールが表示されて「良い」かを判定するための目印。
// (202608220003_fix_start_match_run.sqlで投入される3候補ぶん)
const FICTIONAL_PROFILE_MARKERS = [
  { label: "星乃", markers: ["星乃", "ルミナス架空企画", "未来対話デザイン室"] },
  { label: "天野", markers: ["天野 陽翔", "架空アウトドアリンク"] },
  { label: "柊", markers: ["柊 紬", "架空手芸工房"] },
];

test("承諾前の直URLでは漏洩せず明示承諾後だけ架空プロフィールを開示する", async ({ page }) => {
  await reachFirstUndecidedReport(page);
  const reportUrl = page.url();
  await page.goto("/reveal");
  // 未承諾で/revealへ直接アクセスすると"/"へredirectされるが、認証済みセッションは
  // "/"自体がさらに"/home"へredirectする(src/app/page.tsx)。最終到達先で検証する。
  await expect(page).toHaveURL(/\/home$/);
  await page.goto(reportUrl);
  await page.getByRole("button", { name: "承諾する" }).click();
  await page.getByRole("button", { name: "承諾を確定する" }).click();
  await expect(page).toHaveURL(/\/reveal$/);
  await expect(page.getByText("以下は本デモ用の完全な架空情報です。")).toBeVisible();
});

test("辞退後も候補者情報を開示しない", async ({ page }) => {
  await reachFirstUndecidedReport(page);
  await page.getByRole("button", { name: "辞退する" }).click();
  await page.getByRole("button", { name: "辞退を確定する" }).click();
  await expect(page).toHaveURL(/\/declined$/);
  await expect(page.locator("main")).not.toContainText(
    /星乃|ルミナス架空企画|未来対話デザイン室|天野 陽翔|架空アウトドアリンク|柊 紬|架空手芸工房/u,
  );
  await page.goto("/reveal");
  // 未承諾で/revealへ直接アクセスすると"/"へredirectされるが、認証済みセッションは
  // "/"自体がさらに"/home"へredirectする(src/app/page.tsx)。最終到達先で検証する。
  await expect(page).toHaveURL(/\/home$/);
});

test("1人を承諾すると、他の候補はもう選べなくなる", async ({ page }) => {
  await reachMatchList(page);
  const candidateLinks = page.getByRole("link", { name: /相性 \d+%/u });
  const candidateCount = await candidateLinks.count();
  // 環境には候補者が3人いる(202608220003_fix_start_match_run.sql)。
  expect(candidateCount).toBeGreaterThanOrEqual(2);

  await candidateLinks.first().click();
  await page.getByRole("button", { name: "承諾する" }).click();
  await page.getByRole("button", { name: "承諾を確定する" }).click();
  await expect(page).toHaveURL(/\/reveal$/);

  await page.goto("/matches");
  await expect(page.getByText("他の方を承諾したため、見送りになりました。").first()).toBeVisible();
});

test("承諾済みの候補以外へ直接アクセスしても承諾できない", async ({ page }) => {
  await reachMatchList(page);
  const candidateLinks = page.getByRole("link", { name: /相性 \d+%/u });
  const candidateCount = await candidateLinks.count();
  // 環境には候補者が3人いる(202608220003_fix_start_match_run.sql)。
  expect(candidateCount).toBeGreaterThanOrEqual(2);

  // 承諾する前に、他候補のレポートURL(/report?matchRunId=...)を控えておく。
  // 承諾後は他候補が「見送り」表示になりリンクではなくなるため、URLを取得できなくなる。
  const hrefs = await candidateLinks.evaluateAll((links) =>
    links.map((link) => link.getAttribute("href")),
  );
  const otherReportUrls = hrefs.slice(1).filter((href): href is string => href !== null);
  expect(otherReportUrls.length).toBe(candidateCount - 1);

  // 1人目を承諾する
  await candidateLinks.first().click();
  await page.getByRole("button", { name: "承諾する" }).click();
  await page.getByRole("button", { name: "承諾を確定する" }).click();
  await expect(page).toHaveURL(/\/reveal$/);

  // 控えておいた他候補のレポートURLへ直接アクセスしても、
  // 承諾できず・架空プロフィールの実データも表示されないこと
  for (const url of otherReportUrls) {
    await page.goto(url);
    await expect(page.getByRole("button", { name: "承諾する" })).toHaveCount(0);
    await expect(page.locator("main")).not.toContainText(
      /星乃|ルミナス架空企画|未来対話デザイン室|天野 陽翔|架空アウトドアリンク|柊 紬|架空手芸工房/u,
    );
    await expect(page.getByText("他の方を承諾したため、この候補は選べません。")).toBeVisible();
    await expect(page.getByRole("link", { name: "マッチ結果に戻る" })).toBeVisible();
  }

  // /revealへ直接アクセスしても、承諾していない候補の情報は出ない
  // (承諾した1人の情報だけが見えるのは正しい挙動)
  await page.goto("/reveal");
  await expect(page).toHaveURL(/\/reveal$/);
  const revealText = await page.locator("main").innerText();
  const acceptedProfile = FICTIONAL_PROFILE_MARKERS.find((profile) =>
    profile.markers.some((marker) => revealText.includes(marker)),
  );
  expect(
    acceptedProfile,
    `/revealの表示内容から承諾候補の架空プロフィールを特定できませんでした: ${revealText}`,
  ).toBeDefined();
  for (const profile of FICTIONAL_PROFILE_MARKERS) {
    if (profile === acceptedProfile) continue;
    for (const marker of profile.markers) {
      expect(revealText).not.toContain(marker);
    }
  }
});
