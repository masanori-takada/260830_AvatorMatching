# Task 3: 既存デモ忠実なAppShell 実装レポート

## Status

実装完了。320px・desktopのwin32基準PNGを生成済みです。Playwright runnerはこの環境でworker開始前に停止するため、runner経由の視覚テストだけ未実行です。

## RED / GREEN 証拠

- RED: `& .\node_modules\.bin\vitest.cmd run tests/unit/components/app-shell.test.tsx` を昇格実行し、`@/components/app-shell/app-shell` が存在しないため import 解決に失敗することを確認しました。
- GREEN: 同コマンドを実装後に実行し、`tests/unit/components/app-shell.test.tsx` は 2 tests passed、exit 0 になりました。
- テストは4タブ・現在タブの `aria-current="page"`、ナビゲーション非表示時にも `main` が本文を保持することを確認します。
- Review修正のRED: feedback modal、StatusBar、test scripts、公開アセットignoreの対象3ファイルを実行し、7 failed / 6 passedを確認しました。
- Review修正のGREEN: 同じ対象3ファイルが13 tests passedになり、Node 24の全unitは10 files / 26 tests passedになりました。

## 検証結果

| 検証 | 結果 |
| --- | --- |
| Lint | Node 24.19.0で `eslint .` 成功 |
| 型検査 | Node 24.19.0で `tsc --noEmit` 成功 |
| 全単体テスト | Node 24.19.0で `vitest run --pool=forks --maxWorkers=1` — 10 files / 26 tests 成功 |
| 本番build | 標準環境で `next build` 成功。Node 24.19.0では45秒上限で出力前停止 |
| Playwright視覚テスト | runnerは未完了。直接Chromium操作による同一locatorの基準PNG生成は成功 |

視覚テストでは、320pxの横スクロールなし、および1440px幅時の390px・中央配置を実装・アサートしています。基準画像はCSS適用済みproduction serverに対して直接Chromiumを起動し、視覚テストと同じviewport、`[aria-label="アプリ画面"]`、`animations: "disabled"`でlocator screenshotを取得しました。`app-shell-320-win32.png`は320×812、`app-shell-desktop-win32.png`は390×812で、配色・角丸・影・4タブを目視確認しました。

## 変更ファイル

- `src/components/app-shell/app-shell.tsx`
- `src/components/app-shell/app-shell.module.css`
- `src/components/app-shell/bottom-nav.tsx`
- `src/components/app-shell/status-bar.tsx`
- `src/components/feedback/action-error.tsx`
- `src/components/feedback/action-error.module.css`
- `src/components/feedback/loading-overlay.tsx`
- `src/components/feedback/loading-overlay.module.css`
- `src/app/globals.css`
- `src/app/page.tsx`
- `src/app/page.module.css`
- `tests/unit/components/app-shell.test.tsx`
- `tests/visual/app-shell.spec.ts`
- `playwright.config.ts`
- `public/app-assets/README.md`
- `.gitignore`
- `package.json`
- `tests/unit/components/feedback.test.tsx`
- `tests/unit/config/project-contracts.test.ts`
- `tests/visual/app-shell.spec.ts-snapshots/app-shell-320-win32.png`
- `tests/visual/app-shell.spec.ts-snapshots/app-shell-desktop-win32.png`

## セルフレビュー

- 既存デモの色、半径、影、書体、390px端末面、4タブをトークンとCSS Modulesへ忠実に移植しました。
- `main` とラベル付き `nav` を使用し、現在タブは `aria-current="page"`、タップ対象は最小44px、`:focus-visible` と reduced motion を備えています。
- `LoadingOverlay` はnative modal dialogとして開き、ブラウザのmodal inert化、`aria-busy`、focus、cancel抑止を備えています。
- ホーム固有の機能は実装せず、`/` は最小のシェルプレビューだけです。参照PDF/GIF等を`public`へコピーしていません。
- `test:e2e`は`@visual`を除外し、`test:visual`と分離しました。PDF/GIF/Office資料は`.gitignore`でも公開アセットから除外します。

## 懸念・フォローアップ

- Playwright runnerは最小テストでもworker開始前に停止するため、`toHaveScreenshot`自体のpass/failは確認できていません。アプリやvisual assertionの不具合とは断定しません。
- 基準画像は、必須環境変数付きproduction serverを起動後、Node 24からChromiumを直接操作して生成しました。生成手順の要点:

```powershell
$env:NEXT_PUBLIC_SUPABASE_URL = 'https://example.supabase.co'
$env:NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = 'publishable-key'
$env:AI_PROVIDER = 'mock'
& .\node_modules\.bin\next.cmd start --hostname 127.0.0.1 --port 3107
```

続けてChromiumで320×812と1440×900のpageを作り、`page.goto(..., { waitUntil: "domcontentloaded" })`、250ms待機、`page.locator('[aria-label="アプリ画面"]').screenshot({ animations: "disabled" })`の順に2枚を保存しました。

## Playwright runner 診断追記

- Node 22 と Node 24 のいずれでも、最小フィクスチャなしテストを含めて Playwright runner は worker 起動前で停止しました。
- `chromium.launch`、`browser.newPage`、`page.setContent`、`page.screenshot`、`browser.close` の直接操作は成功しました。
- 環境変数付きproduction serverでは、`page.goto('/')`、`[aria-label="アプリ画面"]` の1件取得、bounding box確認、locatorの手動スクリーンショット保存まで成功しました。
- runner停止はテスト本体のmarkerより前でも再現したため、特定のvisual assertionが原因とは断定できません。診断用の `console.log` と `screenshot()`／`toMatchSnapshot()` 置換は除去し、`tests/visual/app-shell.spec.ts` はコミット `1523f2c` 時点の `toHaveScreenshot` 版へ復元しました。
