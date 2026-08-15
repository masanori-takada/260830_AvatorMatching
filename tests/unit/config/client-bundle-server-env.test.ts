import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { describe, expect, it } from "vitest";

const srcDir = resolve(process.cwd(), "src");

/**
 * サーバー専用として扱う環境変数名。クライアントバンドルの到達範囲に
 * これらの識別子が現れてはならない。
 */
const SERVER_ONLY_ENV_NAMES = ["AI_PROVIDER", "GEMINI_API_KEY", "SERVICE_ROLE"];

/** "use client"を先頭付近に持つソースファイルを全て集める。 */
function findClientEntryFiles(dir: string): string[] {
  const results: string[] = [];
  for (const name of readdirSync(dir)) {
    const full = resolve(dir, name);
    const stat = statSync(full);
    if (stat.isDirectory()) {
      results.push(...findClientEntryFiles(full));
      continue;
    }
    if (!/\.(ts|tsx)$/.test(name)) continue;
    const source = readFileSync(full, "utf8");
    // ディレクティブはファイル冒頭(他の文の前)に置かれる決まりなので、先頭付近だけ見る。
    const head = source.slice(0, 200);
    if (/^\s*["']use client["'];?/.test(head)) {
      results.push(full);
    }
  }
  return results;
}

/** importパス(相対 or "@/…")を絶対ファイルパスへ解決する。解決できなければnull。 */
function resolveImport(fromFile: string, importPath: string): string | null {
  if (!importPath.startsWith(".") && !importPath.startsWith("@/")) {
    // node_modules配下のパッケージは辿らない(server-onlyの検出対象外)。
    return null;
  }
  const base = importPath.startsWith("@/")
    ? resolve(srcDir, importPath.slice(2))
    : resolve(dirname(fromFile), importPath);

  const candidates = [
    base,
    `${base}.ts`,
    `${base}.tsx`,
    resolve(base, "index.ts"),
    resolve(base, "index.tsx"),
  ];
  for (const candidate of candidates) {
    if (existsSync(candidate) && statSync(candidate).isFile()) return candidate;
  }
  return null;
}

/** ファイルのimport文からimportパスを抜き出す。 */
function extractImportPaths(source: string): string[] {
  const paths: string[] = [];
  const importRegex = /import\s+(?:[^"'{}]*?from\s+)?["']([^"']+)["']/g;
  for (const match of source.matchAll(importRegex)) {
    paths.push(match[1]!);
  }
  const dynamicImportRegex = /import\(\s*["']([^"']+)["']\s*\)/g;
  for (const match of source.matchAll(dynamicImportRegex)) {
    paths.push(match[1]!);
  }
  return paths;
}

/**
 * クライアントエントリファイル群から到達可能な全ファイルを幅優先探索で集める。
 * "use client"境界を越えてサーバー専用コードに繋がっていないかを確認するため、
 * 別ファイルへのimportは種類を問わず(サーバー専用モジュールも含めて)辿る。
 */
function collectReachableFiles(entryFiles: string[]): Set<string> {
  const visited = new Set<string>();
  const queue = [...entryFiles];
  while (queue.length > 0) {
    const current = queue.pop()!;
    if (visited.has(current)) continue;
    visited.add(current);
    const source = readFileSync(current, "utf8");
    for (const importPath of extractImportPaths(source)) {
      const resolved = resolveImport(current, importPath);
      if (resolved && !visited.has(resolved)) queue.push(resolved);
    }
  }
  return visited;
}

/**
 * 不具合1の再発防止テスト。
 *
 * src/lib/env.tsがmodule scopeでprocess.env全体を検証しており、これが
 * "use client"ファイルからimportグラフを辿ってブラウザバンドルへ混入していた。
 * その結果AI_PROVIDER/GEMINI_API_KEYといったサーバー専用の値がクライアントで
 * undefinedとなり検証エラーで/matchingがクラッシュしていた(実測済み)。
 *
 * ここではソース静的解析で、
 * 1. "use client"ファイルから到達可能なimportグラフの中に、サーバー専用の
 *    環境変数名(AI_PROVIDER / GEMINI_API_KEY / SERVICE_ROLE)への参照が無いこと
 * 2. `process.env`をオブジェクトごと関数へ渡している箇所が無いこと
 *    (Next.jsは`process.env.NEXT_PUBLIC_XXX`という個別の静的参照しかインライン
 *    展開しないため、オブジェクトごと渡すとクライアントでは常にundefinedになる)
 * を検出する。
 */
describe("クライアントバンドルへサーバー専用の環境変数が混入しない", () => {
  const entryFiles = findClientEntryFiles(srcDir);
  const reachableFiles = collectReachableFiles(entryFiles);

  it("少なくとも1つは\"use client\"ファイルが見つかる(テスト自体の前提確認)", () => {
    expect(entryFiles.length).toBeGreaterThan(0);
  });

  it.each([...reachableFiles])("%s にサーバー専用の環境変数名が現れない", (file) => {
    const source = readFileSync(file, "utf8");
    const found = SERVER_ONLY_ENV_NAMES.filter((name) => new RegExp(`\\b${name}\\b`).test(source));
    expect(found, `${file} にサーバー専用の環境変数名が含まれている: ${found.join(", ")}`).toEqual([]);
  });

  it.each([...reachableFiles])("%s がprocess.envをオブジェクトごと渡していない", (file) => {
    const source = readFileSync(file, "utf8");
    // `process.env)` や `process.env,` のように、個別プロパティへ絞らずオブジェクトごと
    // 渡している呼び出しを検出する。`process.env.XXX`のような個別静的参照は許可する。
    const wholesaleUsage = /process\.env\s*(?:[),\]}]|;)/.test(source);
    expect(wholesaleUsage, `${file} がprocess.envをオブジェクトごと参照している`).toBe(false);
  });
});
