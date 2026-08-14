import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { describe, expect, it } from "vitest";

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");

describe("テストスクリプト", () => {
  it("E2Eと視覚テストを別々に実行する", () => {
    const packageJson = JSON.parse(
      readFileSync(resolve(projectRoot, "package.json"), "utf8"),
    ) as { scripts: Record<string, string> };

    expect(packageJson.scripts["test:e2e"]).toBe(
      "playwright test --grep-invert @visual --pass-with-no-tests",
    );
    expect(packageJson.scripts["test:visual"]).toBe(
      "playwright test --grep @visual --pass-with-no-tests",
    );
  });
});

describe("公開アセット", () => {
  it.each(["reference.pdf", "demo.gif", "brief.pptx"])(
    "%sをgitの追跡対象から除外する",
    (fileName) => {
      expect(() =>
        execFileSync(
          "git",
          ["check-ignore", "--quiet", `public/app-assets/${fileName}`],
          { cwd: projectRoot },
        ),
      ).not.toThrow();
    },
  );

  it("公開ルールREADMEは追跡対象に保つ", () => {
    expect(() =>
      execFileSync(
        "git",
        ["check-ignore", "--quiet", "public/app-assets/README.md"],
        { cwd: projectRoot },
      ),
    ).toThrow();
  });
});
