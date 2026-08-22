import { createRequire } from "node:module";

import { expect, test, type Page } from "./support/access-gate";

import { createAvatarSummary } from "./support/avatar-summary";
import {
  answerChoiceQuestionByKeyboard,
  answerFreeTextQuestionByKeyboard,
  answerInterviewRange,
  completeInterview,
  FIRST_CHOICE_QUESTION_ORDER,
  FIRST_FREE_TEXT_QUESTION_ORDER,
  startInterview,
  TOTAL_INTERVIEW_QUESTIONS,
} from "./support/interview";
import { reachFirstUndecidedReport } from "./support/matching";

// axe-coreは@axe-core/playwrightを追加せず、既にpackage.jsonへ入っているaxe-core本体を
// スクリプトタグとして直接注入して使う(依存を増やさないため)。
const require = createRequire(import.meta.url);
const AXE_CORE_PATH = require.resolve("axe-core/axe.min.js");

type AxeViolation = {
  id: string;
  impact: "minor" | "moderate" | "serious" | "critical" | null;
  help: string;
  nodes: { target: string[] }[];
};

type AxeGlobal = { run: () => Promise<{ violations: AxeViolation[] }> };

/**
 * axe-coreを実行し、impactがcritical/seriousの違反だけを返す。
 * moderate/minorまで0件にするのはデモ規模では現実的でないため閾値をここで絞る(SC-011)。
 */
async function seriousViolations(page: Page): Promise<AxeViolation[]> {
  await page.addScriptTag({ path: AXE_CORE_PATH });
  const violations = await page.evaluate(async () => {
    const axe = (window as unknown as { axe: AxeGlobal }).axe;
    const results = await axe.run();
    return results.violations;
  });
  return violations.filter((violation) => violation.impact === "critical" || violation.impact === "serious");
}

async function expectNoSeriousViolations(page: Page, screenLabel: string): Promise<void> {
  const violations = await seriousViolations(page);
  if (violations.length > 0) {
    const detail = violations
      .map(
        (violation) =>
          `- [${violation.impact}] ${violation.id}: ${violation.help} (${violation.nodes
            .map((node) => node.target.join(" "))
            .join(", ")})`,
      )
      .join("\n");
    throw new Error(`${screenLabel} でcritical/serious違反が検出されました:\n${detail}`);
  }
}

test.describe("accessibility axe (SC-011)", () => {
  test("承諾フローの主要画面でcritical/serious違反が0件になる", async ({ page }) => {
    test.setTimeout(180_000);

    await page.goto("/start");
    await expect(page.getByRole("button", { name: "インタビューをはじめる" })).toBeVisible();
    await expectNoSeriousViolations(page, "/start");

    await page.getByRole("button", { name: "インタビューをはじめる" }).click();
    await expect(page).toHaveURL(/\/interview\/1$/);
    await expectNoSeriousViolations(page, "/interview/1");

    await answerInterviewRange(page, 1, 3);

    await page.goto("/home");
    await expectNoSeriousViolations(page, "/home(進行中)");

    await page.goto("/mypage");
    await expectNoSeriousViolations(page, "/mypage");

    await page.goto("/settings");
    await expectNoSeriousViolations(page, "/settings");

    await page.goto("/privacy");
    await expectNoSeriousViolations(page, "/privacy");

    await page.goto("/faq");
    await expectNoSeriousViolations(page, "/faq");

    await page.goto("/interview/4");
    await answerInterviewRange(page, 4, TOTAL_INTERVIEW_QUESTIONS);
    await expect(page).toHaveURL(/\/matching$/);

    await createAvatarSummary(page);

    await page.goto("/matching");
    // /matchingの完了リンクは候補数を含む「マッチ結果を見る（N人）」表記のため正規表現で判定する
    // (matching-progress.tsx)。個別の相性レポートへは、まず/matchesの候補一覧を経由する。
    await expect(page.getByRole("link", { name: /マッチ結果を見る/u })).toBeVisible({ timeout: 30_000 });
    await expectNoSeriousViolations(page, "/matching(完了)");

    await page.getByRole("link", { name: /マッチ結果を見る/u }).click();
    await expect(page).toHaveURL(/\/matches$/);
    await expectNoSeriousViolations(page, "/matches");

    await page.getByRole("link", { name: /相性 \d+%/u }).first().click();
    await expect(page.getByRole("meter")).toHaveCount(5);
    const reportUrl = page.url();
    await expectNoSeriousViolations(page, "/report");

    await page.goto("/notifications");
    await expectNoSeriousViolations(page, "/notifications");

    await page.goto(reportUrl);
    await page.getByRole("button", { name: "承諾する" }).click();
    await page.getByRole("button", { name: "承諾を確定する" }).click();
    await expect(page).toHaveURL(/\/reveal$/);
    await expectNoSeriousViolations(page, "/reveal");
  });

  test("辞退後の/declinedでcritical/serious違反が0件になる", async ({ page }) => {
    test.setTimeout(120_000);

    await reachFirstUndecidedReport(page);
    await page.getByRole("button", { name: "辞退する" }).click();
    await page.getByRole("button", { name: "辞退を確定する" }).click();
    await expect(page).toHaveURL(/\/declined$/);
    await expectNoSeriousViolations(page, "/declined");
  });
});

test.describe("keyboard operation (FR-038)", () => {
  test("選択式・自由記述の回答をキーボードだけで送信できる", async ({ page }) => {
    await page.goto("/start");
    await page.keyboard.press("Tab");
    await expect(page.getByRole("button", { name: "インタビューをはじめる" })).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(/\/interview\/1$/);

    // 最初の選択式質問まではマウス操作で進め(表示順は質問構成で変わりうるため固定しない)、
    // その質問をTab→Enterのキーボード操作だけで送信できることを検証する。
    await answerInterviewRange(page, 1, FIRST_CHOICE_QUESTION_ORDER - 1);
    await answerChoiceQuestionByKeyboard(page, FIRST_CHOICE_QUESTION_ORDER);
    await expect(page).toHaveURL(new RegExp(`/interview/${FIRST_CHOICE_QUESTION_ORDER + 1}$`));

    // 最初の自由記述質問まではマウス操作で進め、その質問を入力→Tab→Enterの
    // キーボード操作だけで送信できることを検証する。
    await answerInterviewRange(page, FIRST_CHOICE_QUESTION_ORDER + 1, FIRST_FREE_TEXT_QUESTION_ORDER - 1);
    await answerFreeTextQuestionByKeyboard(page, FIRST_FREE_TEXT_QUESTION_ORDER, "キーボードのみで入力した回答です");
    await expect(page).toHaveURL(new RegExp(`/interview/${FIRST_FREE_TEXT_QUESTION_ORDER + 1}$`));
  });

  test("設定のリセット確認ダイアログをキーボードだけで開閉できる", async ({ page }) => {
    await startInterview(page);
    await page.goto("/settings");

    const resetButton = page.getByRole("button", { name: "デモをリセット" });
    // Tabキーだけでリセットボタンへ到達できることを確認する(キーボードトラップが無いことの検証も兼ねる)
    let reached = false;
    for (let i = 0; i < 10; i += 1) {
      await page.keyboard.press("Tab");
      if (await resetButton.evaluate((element) => element === document.activeElement)) {
        reached = true;
        break;
      }
    }
    expect(reached).toBe(true);

    await page.keyboard.press("Enter");
    const dialog = page.getByRole("dialog", { name: "デモをリセット" });
    await expect(dialog).toBeVisible();
    // ダイアログを開くと確定ボタンへ自動でフォーカスが移る(reset-control.tsxのuseEffect)
    await expect(dialog.getByRole("button", { name: "リセットする" })).toBeFocused();

    // Escape(dialogのcancelイベント)でキャンセルできる。実際のリセットは実行しない
    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();
  });
});

test.describe("visible focus", () => {
  test("フォーカス時に可視のアウトラインが表示される", async ({ page }) => {
    await page.goto("/start");
    const button = page.getByRole("button", { name: "インタビューをはじめる" });

    const before = await button.evaluate((element) => getComputedStyle(element).outlineStyle);
    await page.keyboard.press("Tab");
    await expect(button).toBeFocused();
    const after = await button.evaluate((element) => getComputedStyle(element).outlineStyle);

    expect(before).toBe("none");
    expect(after).not.toBe("none");
  });
});

test.describe("reduced motion", () => {
  test("prefers-reduced-motion: reduce のとき意味を保ったままアニメーションが省略される", async ({ page }) => {
    test.setTimeout(120_000);
    await page.emulateMedia({ reducedMotion: "reduce" });

    await page.goto("/start");
    const matches = await page.evaluate(() => window.matchMedia("(prefers-reduced-motion: reduce)").matches);
    expect(matches).toBe(true);

    await completeInterview(page);
    await createAvatarSummary(page);
    await page.goto("/matching");

    // 処理中の脈動アイコン(matching-progress.module.cssの.pulse)が存在する場合、
    // 通常値の"1.8s"から変化していること(アニメーションが実質無効化されたこと)を確認する。
    // モック処理は高速に完了しうるため、既に完了して"マッチ結果を見る"リンクへ
    // 切り替わっている場合もある。どちらの状態でも情報が失われず表示され続けることが重要。
    const pulse = page.locator('[class*="pulse"]');
    if ((await pulse.count()) > 0) {
      const duration = await pulse.first().evaluate((element) => getComputedStyle(element).animationDuration);
      expect(duration).not.toBe("1.8s");
    }

    await expect(
      page
        .getByRole("heading", { name: "アバターが会話中です" })
        .or(page.getByRole("link", { name: /マッチ結果を見る/u })),
    ).toBeVisible({ timeout: 30_000 });
  });
});
