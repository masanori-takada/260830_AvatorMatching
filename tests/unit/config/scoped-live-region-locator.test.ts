import { readdirSync, readFileSync, statSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const testsDir = resolve(process.cwd(), "tests");

/** ARIA仕様上のライブリージョンロール。中身が動的に変わり、読み上げ対象になる。 */
const LIVE_REGION_ROLES = ["alert", "status", "log", "alertdialog", "marquee", "timer"];

/** tests配下の *.spec.ts を再帰的に集める。 */
function findSpecFiles(dir: string): string[] {
  const results: string[] = [];
  for (const name of readdirSync(dir)) {
    const full = resolve(dir, name);
    const stat = statSync(full);
    if (stat.isDirectory()) {
      results.push(...findSpecFiles(full));
      continue;
    }
    if (name.endsWith(".spec.ts")) results.push(full);
  }
  return results;
}

const specFiles = findSpecFiles(testsDir);

/**
 * 不具合の再発防止テスト(3度目の発生を受けて追加)。
 *
 * Next.jsはページ遷移直後だけ`<div role="alert" id="__next-route-announcer__">`に
 * 中身を入れる。`page.getByRole("alert")`のように`page`から直接、祖先を絞らずに
 * ライブリージョンロール(alert/status等)を取得すると、アプリ側のalert/statusと
 * ルートアナウンサーの2件にマッチしstrict mode violationで断続的に失敗する。
 *
 * `page.getByRole("main").getByRole("alert")`のように、何らかのロケータを経由して
 * 祖先スコープを絞れば問題ない。このテストは`tests/**\/*.spec.ts`を静的解析し、
 * `page`から直接ライブリージョンロールを取得している箇所が無いことを確認する。
 */
describe("E2E/視覚テストがライブリージョンロールをスコープ無しで取得していない", () => {
  it("少なくとも1つは*.spec.tsが見つかる(テスト自体の前提確認)", () => {
    expect(specFiles.length).toBeGreaterThan(0);
  });

  it.each(specFiles)("%s がpageから直接alert/status等を取得していない", (file) => {
    const source = readFileSync(file, "utf8");
    const violations: string[] = [];

    for (const role of LIVE_REGION_ROLES) {
      // `page`という識別子の直後の`.getByRole("role", ...)`だけを検出する。
      // `page.getByRole("main").getByRole("alert")`のように、別のロケータ経由なら
      // 直前が`page`ではなく`)`になるためマッチしない。
      const pattern = new RegExp(`\\bpage\\s*\\.\\s*getByRole\\(\\s*["']${role}["']`, "g");
      for (const match of source.matchAll(pattern)) {
        violations.push(`${role} (offset ${match.index})`);
      }
    }

    expect(
      violations,
      `${file} がpageから直接ライブリージョンロールを取得している(祖先ロケータでスコープを絞ること): ${violations.join(", ")}`,
    ).toEqual([]);
  });
});
