# Task 3: 既存デモ忠実なAppShell 実装レポート

## Status

実装完了。視覚スナップショットの生成のみ、Playwright実行が60秒を超えてタイムアウトしたため未完了です。

## RED / GREEN 証拠

- RED: `& .\node_modules\.bin\vitest.cmd run tests/unit/components/app-shell.test.tsx` を昇格実行し、`@/components/app-shell/app-shell` が存在しないため import 解決に失敗することを確認しました。
- GREEN: 同コマンドを実装後に実行し、`tests/unit/components/app-shell.test.tsx` は 2 tests passed、exit 0 になりました。
- テストは4タブ・現在タブの `aria-current="page"`、ナビゲーション非表示時にも `main` が本文を保持することを確認します。

## 検証結果

| 検証 | 結果 |
| --- | --- |
| Lint | `& .\node_modules\.bin\eslint.cmd .` 成功 |
| 型検査 | `& .\node_modules\.bin\tsc.cmd --noEmit` 成功 |
| 全単体テスト | `& .\node_modules\.bin\vitest.cmd run` — 8 files / 15 tests 成功 |
| 本番build | `& .\node_modules\.bin\next.cmd build` 成功 |
| Playwright視覚テスト | 未完了。Chromium導入後に `& .\node_modules\.bin\playwright.cmd test tests/visual/app-shell.spec.ts --update-snapshots` を実行したが60秒超でタイムアウト |

視覚テストでは、320pxの横スクロールなし、および1440px幅時の390px・中央配置を実装・アサートしています。ブラウザ未導入時のエラーは解消済みですが、既存の3000番開発サーバーに公開環境変数がなくZodエラーを返していました。環境変数つきのローカルサーバーでHTTP 200を確認後も、スクリーンショット実行が完了しませんでした。途中で生成された画像は開発サーバーのオーバーレイを含むため、基準画像としてコミットしていません。

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

## セルフレビュー

- 既存デモの色、半径、影、書体、390px端末面、4タブをトークンとCSS Modulesへ忠実に移植しました。
- `main` とラベル付き `nav` を使用し、現在タブは `aria-current="page"`、タップ対象は最小44px、`:focus-visible` と reduced motion を備えています。
- `LoadingOverlay` が端末面を基準に重なるよう、端末面を相対配置にしています。
- ホーム固有の機能は実装せず、`/` は最小のシェルプレビューだけです。参照PDF/GIF等を`public`へコピーしていません。

## 懸念・フォローアップ

- Playwrightの基準スクリーンショットは未作成です。必須環境変数を設定してNextを起動したうえで、視覚テストのタイムアウト原因を解消し、`--update-snapshots` を再実行してください。
- 視覚テスト用サーバーの起動例:

```powershell
$env:NEXT_PUBLIC_SUPABASE_URL = 'https://example.supabase.co'
$env:NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = 'publishable-key'
$env:AI_PROVIDER = 'mock'
& .\node_modules\.bin\next.cmd dev --hostname 127.0.0.1 --port 3000
```

## Playwright runner 診断追記

- Node 22 と Node 24 のいずれでも、最小フィクスチャなしテストを含めて Playwright runner は worker 起動前で停止しました。
- `chromium.launch`、`browser.newPage`、`page.setContent`、`page.screenshot`、`browser.close` の直接操作は成功しました。
- 環境変数付きproduction serverでは、`page.goto('/')`、`[aria-label="アプリ画面"]` の1件取得、bounding box確認、locatorの手動スクリーンショット保存まで成功しました。
- 停止はrunner内の視覚アサーション実行経路に限定されます。診断用の `console.log` と `screenshot()`／`toMatchSnapshot()` 置換は除去し、`tests/visual/app-shell.spec.ts` はコミット `1523f2c` 時点の `toHaveScreenshot` 版へ復元しました。
