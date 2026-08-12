# AIアバター自動マッチング PoCデモアプリ Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 招待コード登録からAIインタビュー・アバター会話・マッチ通知・相性レポート・実名開示までを一気通貫でクリック操作できる、iPhone実機風フレーム内で完結するiOSアプリ風Webモック(静的サイト)を作る。

**Architecture:** `index.html` / `style.css` / `app.js` の3ファイル構成のSPA。全14画面を `index.html` 内の `<section class="screen" data-screen="...">` として並べ、`is-active` クラスの付け替えで表示を切り替える。状態は単一オブジェクト `state` に集約し `localStorage`(キー `avatarMatchingDemo.v1`)へJSON保存。動的な画面は `renderers[画面名]()` がテンプレートリテラル+`innerHTML` で描画する。外部通信は一切行わない。

**Tech Stack:** プレーンHTML5 / CSS3 / ES2020 JavaScript。依存ライブラリ・ビルドツール・パッケージマネージャ・Webフォント・外部画像CDNは一切使用しない。アイコンは `index.html` 内のインラインSVGスプライト(`<symbol>` + `<use>`)。

## Global Constraints

- 依存ライブラリ・ビルドツール・パッケージマネージャは**一切使わない**。`index.html` をダブルクリックすればローカルでも動くこと。
- **外部通信は一切行わない。** `fetch` / `XMLHttpRequest` / `<form action>` / 外部CDN / Webフォント読み込みを使用しない。
- 自動テストは書かない。各タスクの最後は**ブラウザでの目視確認**で検証する(§8の手動QAチェックリストが最終検証)。
- 色は `style.css` の `:root` に定義したCSSカスタムプロパティのみを参照する。**色のハードコード禁止**(`:root` の定義本体と、`rgba()` の影・オーバーレイのみ例外)。
- ダークモード対応は行わない。`color-scheme: light` を宣言し、OS設定に関わらず明るいトーンを維持する。
- すべての操作要素は `<button>` / `<a>` / `<input>` / `<summary>` を使う。`div` にクリックハンドラを付けない。
- 装飾用SVGには `aria-hidden="true"`、意味を持つアイコンボタンには `aria-label` を付ける。
- 実名「山田 花子(仮名)」は `reveal` 画面以外のどこにも出力しない。
- 想定ブラウザは Chrome / Safari / Edge の最新版。ES2020構文(オプショナルチェーン、`??`)の使用可。IE非対応。
- アニメーションはすべて 200–700ms、`ease-out` 基調。`prefers-reduced-motion: reduce` の場合は無効化する。
- 日本語のみ。多言語対応は行わない。
- `app.js` 全体を IIFE で包み、`window.__demo` のみ公開する。
- コミットメッセージ末尾に `Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>` を含める。

---

## File Structure

| ファイル | 責務 |
|---|---|
| `index.html` | SVGスプライト、端末フレーム、共通シェル(ヘッダー/タブバー/トースト/シート/ローディング)、全14画面の `<section>` |
| `style.css` | カラートークン、ベース、端末枠、共通コンポーネント、各画面のスタイル |
| `app.js` | 固定データ(`QUESTIONS` / `PARTNER` / `NOTIFICATIONS`)、状態管理・永続化、`showScreen`、`renderers`、各画面のイベント |
| `assets/hero.png` | 任意。存在しなくてもアプリは成立する(`<img onerror>` で自身を削除しCSSグラデーション+SVGのみで表示) |

画面一覧(`data-screen` の値、全14件): `invite` / `interview` / `waiting` / `notifications` / `report` / `declined` / `reveal` / `done` / `home` / `privacy` / `faq` / `mypage` / `profile` / `settings`

---

## Task 1: プロジェクト初期化(端末フレーム・カラートークン・SVGスプライト)

**Files:**
- Create: `index.html`
- Create: `style.css`
- Create: `app.js`

**Interfaces:**
- Consumes: なし(最初のタスク)
- Produces:
  - `index.html`: `#viewport`(スクロール領域)、`.phone`(端末枠)、SVGスプライトの `<symbol>` 群、全14画面の空 `<section class="screen" data-screen="...">`
  - `style.css`: `:root` のカラートークン一式、`.card` / `.btn` / `.btn--primary` / `.btn--secondary` / `.btn--danger` / `.btn-link` / `.icon` / `.icon-circle` / `.sr-only` / `.hero-title` / `.screen-title` / `.section-title` / `.card-title` / `.text-body` / `.text-note` / `.badge` / `.empty` / `.field__label` / `.field__input` / `.field__error` / `.chat` / `.bubble`
  - `app.js`: IIFE骨格と `fitPhone()`(`--phone-scale` を更新)
  - 利用可能なアイコンID: `i-logo` `i-bell` `i-doc` `i-home` `i-user` `i-chat` `i-shield` `i-help` `i-gear` `i-check` `i-chevron` `i-calendar` `i-avatar-pair` `i-lock` `i-cellular` `i-wifi` `i-battery`

- [ ] **Step 1: `index.html` を作成する**

`C:\Users\ユーザー\Desktop\Cursor_ClaudeCode\260812_Avatar_Matching_ver2\index.html`:

```html
<!DOCTYPE html>
<html lang="ja">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="light">
<meta name="description" content="AIアバター自動マッチング PoCデモ(モック)">
<title>AIアバター自動マッチング</title>
<link rel="stylesheet" href="style.css">
</head>
<body>

<svg class="svg-sprite" aria-hidden="true" focusable="false" xmlns="http://www.w3.org/2000/svg">
  <symbol id="i-logo" viewBox="0 0 24 24"><circle cx="9" cy="12" r="6"/><circle cx="15" cy="12" r="6"/></symbol>
  <symbol id="i-bell" viewBox="0 0 24 24"><path d="M18 8a6 6 0 1 0-12 0c0 7-3 8-3 8h18s-3-1-3-8"/><path d="M13.7 20a2 2 0 0 1-3.4 0"/></symbol>
  <symbol id="i-doc" viewBox="0 0 24 24"><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5"/><path d="M9 13h6"/><path d="M9 17h4"/></symbol>
  <symbol id="i-home" viewBox="0 0 24 24"><path d="M3 10.5 12 3l9 7.5"/><path d="M5 9.5V20h14V9.5"/></symbol>
  <symbol id="i-user" viewBox="0 0 24 24"><circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 3.6-6.5 8-6.5s8 2.5 8 6.5"/></symbol>
  <symbol id="i-chat" viewBox="0 0 24 24"><path d="M21 12a8 8 0 0 1-8 8H4l2.2-3A8 8 0 1 1 21 12z"/></symbol>
  <symbol id="i-shield" viewBox="0 0 24 24"><path d="M12 3l7 3v6c0 4.5-3 7.7-7 9-4-1.3-7-4.5-7-9V6z"/><path d="M9 12l2 2 4-4"/></symbol>
  <symbol id="i-help" viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M9.5 9.5a2.5 2.5 0 1 1 3.2 2.4c-.7.2-1.2.9-1.2 1.6v.5"/><path d="M12 17.2h.01"/></symbol>
  <symbol id="i-gear" viewBox="0 0 24 24"><circle cx="12" cy="12" r="3"/><path d="M12 3v2.5"/><path d="M12 18.5V21"/><path d="M3 12h2.5"/><path d="M18.5 12H21"/><path d="M5.6 5.6l1.8 1.8"/><path d="M16.6 16.6l1.8 1.8"/><path d="M18.4 5.6l-1.8 1.8"/><path d="M7.4 16.6l-1.8 1.8"/></symbol>
  <symbol id="i-check" viewBox="0 0 24 24"><path d="M4.5 12.5l5 5 10-11"/></symbol>
  <symbol id="i-chevron" viewBox="0 0 24 24"><path d="M9 5l7 7-7 7"/></symbol>
  <symbol id="i-calendar" viewBox="0 0 24 24"><rect x="3.5" y="5" width="17" height="15" rx="2.5"/><path d="M3.5 10h17"/><path d="M8 3v4"/><path d="M16 3v4"/></symbol>
  <symbol id="i-avatar-pair" viewBox="0 0 24 24"><circle cx="8" cy="8.5" r="3.2"/><circle cx="16" cy="8.5" r="3.2"/><path d="M2.5 20c0-3 2.5-4.8 5.5-4.8s5.5 1.8 5.5 4.8"/><path d="M10.5 20c0-3 2.5-4.8 5.5-4.8s5.5 1.8 5.5 4.8"/></symbol>
  <symbol id="i-lock" viewBox="0 0 24 24"><rect x="4.5" y="10" width="15" height="10" rx="2.5"/><path d="M8 10V7.5a4 4 0 0 1 8 0V10"/></symbol>
  <symbol id="i-cellular" viewBox="0 0 24 24"><path d="M3 18v-2.5" stroke-width="2.6"/><path d="M9 18v-5" stroke-width="2.6"/><path d="M15 18v-7.5" stroke-width="2.6"/><path d="M21 18V6" stroke-width="2.6"/></symbol>
  <symbol id="i-wifi" viewBox="0 0 24 24"><path d="M2.5 8.5a14 14 0 0 1 19 0"/><path d="M6 12a9 9 0 0 1 12 0"/><path d="M9.5 15.5a4 4 0 0 1 5 0"/><path d="M12 19h.01"/></symbol>
  <symbol id="i-battery" viewBox="0 0 24 24"><rect x="2" y="8" width="17" height="9" rx="2.5"/><path d="M21.2 11.5v3"/><rect x="4" y="10" width="12" height="5" rx="1" fill="currentColor" stroke="none"/></symbol>
</svg>

<div class="stage">
  <div class="phone">

    <div class="status-bar" aria-hidden="true">
      <span class="status-bar__time">9:41</span>
      <span class="status-bar__icons">
        <svg class="icon" focusable="false"><use href="#i-cellular"></use></svg>
        <svg class="icon" focusable="false"><use href="#i-wifi"></use></svg>
        <svg class="icon" focusable="false"><use href="#i-battery"></use></svg>
      </span>
    </div>

    <main class="viewport" id="viewport">
      <section class="screen" data-screen="invite" tabindex="-1"></section>
      <section class="screen" data-screen="interview" tabindex="-1"></section>
      <section class="screen" data-screen="waiting" tabindex="-1"></section>
      <section class="screen" data-screen="notifications" tabindex="-1"></section>
      <section class="screen" data-screen="report" tabindex="-1"></section>
      <section class="screen" data-screen="declined" tabindex="-1"></section>
      <section class="screen" data-screen="reveal" tabindex="-1"></section>
      <section class="screen" data-screen="done" tabindex="-1"></section>
      <section class="screen" data-screen="home" tabindex="-1"></section>
      <section class="screen" data-screen="privacy" tabindex="-1"></section>
      <section class="screen" data-screen="faq" tabindex="-1"></section>
      <section class="screen" data-screen="mypage" tabindex="-1"></section>
      <section class="screen" data-screen="profile" tabindex="-1"></section>
      <section class="screen" data-screen="settings" tabindex="-1"></section>
    </main>

  </div>
</div>

<script src="app.js"></script>
</body>
</html>
```

- [ ] **Step 2: `style.css` を作成する**

`C:\Users\ユーザー\Desktop\Cursor_ClaudeCode\260812_Avatar_Matching_ver2\style.css`:

```css
/* ==========================================================================
   AIアバター自動マッチング PoC — カラートークン
   ここに定義した変数のみを参照する(色のハードコード禁止)
   ========================================================================== */
:root {
  --bg-app:        #F7F3F4;  /* 端末内の下地 */
  --bg-card:       #FFFFFF;  /* カード */
  --bg-subtle:     #FBF6F8;  /* 淡い面、入力欄 */
  --bg-hero-a:     #F6E7EE;  /* ヒーローグラデ開始 */
  --bg-hero-b:     #EFE6F1;  /* ヒーローグラデ終了 */

  --wine:          #A32B55;  /* 主アクセント(ワインレッド) */
  --wine-deep:     #8A1F45;  /* 押下・強調 */
  --plum:          #7B3F72;  /* 副アクセント(プラム) */
  --pink:          #E9A8C3;  /* 補助ピンク(アイコン円、バー) */
  --pink-soft:     #F7E3EC;  /* 最も淡いピンク(背景円、吹き出し) */

  --text-main:     #2E2A2C;
  --text-sub:      #8A8085;
  --text-onwine:   #FFFFFF;

  --border:        #EFE6EA;
  --shadow-card:   0 2px 10px rgba(80, 40, 60, 0.06);
  --danger:        #C0392B;  /* エラー文、リセットボタン */
  --neutral-bar:   #B8AEB4;  /* 「低いほど良い」軸のバー */

  --radius-card:   18px;
  --radius-btn:    14px;
  --radius-pill:   999px;

  --stage-bg:      #E8E4E6;  /* 端末枠の外側 */
  --track:         #F0EAED;  /* バーのトラック */
  --step-todo:     #F0ECEE;  /* 未達ステップの円 */
  --disabled:      #D8C6CE;  /* 無効ボタン */

  --phone-scale:   1;
}

/* ==========================================================================
   ベース
   ========================================================================== */
*, *::before, *::after { box-sizing: border-box; }

html { color-scheme: light; }

body {
  margin: 0;
  overflow: hidden;
  background: var(--stage-bg);
  color: var(--text-main);
  font-family: -apple-system, BlinkMacSystemFont, "Hiragino Sans",
               "Yu Gothic", "Noto Sans JP", sans-serif;
  font-size: 14px;
  line-height: 1.7;
  letter-spacing: 0.01em;
  -webkit-font-smoothing: antialiased;
}

.svg-sprite { display: none; }

.sr-only {
  position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px;
  overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; border: 0;
}

/* ==========================================================================
   端末枠(フレーム)
   ========================================================================== */
.stage {
  position: fixed;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
}

.phone {
  position: relative;
  width: 375px;
  height: 812px;
  flex: none;
  display: flex;
  flex-direction: column;
  background: var(--bg-app);
  border-radius: 40px;
  box-shadow: 0 12px 44px rgba(80, 40, 60, 0.16);
  overflow: hidden;
  transform: scale(var(--phone-scale));
  transform-origin: center center;
}

.status-bar {
  flex: none;
  height: 44px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 22px;
  font-size: 13px;
  font-weight: 600;
}
.status-bar__icons { display: flex; align-items: center; gap: 6px; }
.status-bar .icon { width: 17px; height: 17px; }

.viewport {
  flex: 1 1 auto;
  overflow-y: auto;
  overflow-x: hidden;
  -webkit-overflow-scrolling: touch;
}

.screen { display: none; padding: 8px 16px 28px; }
.screen.is-active { display: block; }
.screen:focus, [data-autofocus]:focus { outline: none; }
.screen:focus-visible, [data-autofocus]:focus-visible {
  outline: 2px solid var(--wine);
  outline-offset: 3px;
}

/* ==========================================================================
   タイポグラフィ
   ========================================================================== */
.hero-title    { font-size: 26px; font-weight: 700; line-height: 1.35; margin: 0 0 8px; color: var(--wine); }
.screen-title  { font-size: 20px; font-weight: 700; line-height: 1.35; margin: 8px 0 14px; }
.section-title { font-size: 16px; font-weight: 700; line-height: 1.35; margin: 22px 0 10px; }
.section-title--flush { margin: 0 0 8px; }
.card-title    { font-size: 15px; font-weight: 600; line-height: 1.5; margin: 0 0 4px; }
.text-body     { font-size: 14px; margin: 0; }
.text-note     { font-size: 12px; line-height: 1.7; color: var(--text-sub); margin: 8px 0 0; }

/* ==========================================================================
   共通コンポーネント
   ========================================================================== */
.card {
  background: var(--bg-card);
  border: 1px solid var(--border);
  border-radius: var(--radius-card);
  box-shadow: var(--shadow-card);
  padding: 16px;
  margin-bottom: 12px;
}
.card__head { display: flex; align-items: center; justify-content: space-between; gap: 8px; margin-bottom: 8px; }

.empty { text-align: center; }
.empty .icon-circle { margin: 0 auto 10px; }

.btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  min-height: 50px;
  padding: 8px 16px;
  border: 1px solid transparent;
  border-radius: var(--radius-btn);
  font-family: inherit;
  font-size: 15px;
  font-weight: 700;
  letter-spacing: 0.02em;
  cursor: pointer;
  transition: background-color .2s ease-out;
}
.btn + .btn { margin-top: 10px; }
.btn--primary { background: var(--wine); color: var(--text-onwine); }
.btn--primary:active { background: var(--wine-deep); }
.btn--primary:disabled { background: var(--disabled); color: var(--text-onwine); cursor: default; }
.btn--secondary { background: transparent; border-color: var(--wine); color: var(--wine); }
.btn--secondary:active { background: var(--pink-soft); }
.btn--danger { background: transparent; border-color: var(--danger); color: var(--danger); }
.btn-link {
  display: inline-flex; align-items: center; gap: 2px;
  padding: 6px 0; border: 0; background: transparent;
  font-family: inherit; font-size: 13px; font-weight: 600;
  color: var(--wine); cursor: pointer;
}

.badge {
  display: inline-flex; align-items: center;
  padding: 4px 12px;
  border-radius: var(--radius-pill);
  background: var(--pink-soft);
  color: var(--wine);
  font-size: 13px; font-weight: 700;
  white-space: nowrap;
}

.icon {
  width: 24px; height: 24px;
  stroke: currentColor;
  stroke-width: 1.6;
  fill: none;
  stroke-linecap: round;
  stroke-linejoin: round;
  display: block;
}
.icon--lg { width: 32px; height: 32px; }
.icon-circle {
  width: 40px; height: 40px; flex: none;
  border-radius: 50%;
  background: var(--pink-soft);
  color: var(--wine);
  display: flex; align-items: center; justify-content: center;
}
.icon-circle--sm { width: 32px; height: 32px; }
.icon-circle--lg { width: 64px; height: 64px; }

/* 入力欄 */
.field__label { display: block; font-size: 12px; font-weight: 600; color: var(--text-sub); margin: 14px 0 4px; }
.field__input {
  width: 100%;
  min-height: 46px;
  padding: 10px 14px;
  border: 1px solid var(--border);
  border-radius: var(--radius-btn);
  background: var(--bg-subtle);
  font-family: inherit;
  font-size: 15px;
  color: var(--text-main);
}
.field__input::placeholder { color: var(--text-sub); }
.field__input:focus { outline: 2px solid var(--wine); outline-offset: 1px; }
.field__input.is-error { border-color: var(--danger); }
.field__error { font-size: 12px; color: var(--danger); margin: 6px 0 0; }
.field__error[hidden] { display: none; }

/* チャット・吹き出し */
.chat { display: flex; flex-direction: column; gap: 10px; }
.bubble {
  max-width: 78%;
  padding: 10px 14px;
  border-radius: 16px;
  font-size: 14px;
  line-height: 1.7;
  white-space: pre-wrap;
  word-break: break-word;
}
.bubble--ai   { align-self: flex-start; background: var(--pink-soft); color: var(--text-main); border-bottom-left-radius: 6px; }
.bubble--self { align-self: flex-end;   background: var(--wine);      color: var(--text-onwine); border-bottom-right-radius: 6px; }

/* ==========================================================================
   モーション設定
   ========================================================================== */
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.001ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.001ms !important;
  }
}
```

- [ ] **Step 3: `app.js` を作成する**

`C:\Users\ユーザー\Desktop\Cursor_ClaudeCode\260812_Avatar_Matching_ver2\app.js`:

```js
/* =========================================================================
   AIアバター自動マッチング PoCデモ
   依存ライブラリなし / 外部通信なし
   ========================================================================= */
(function () {
  'use strict';

  /* ===== 端末枠のスケーリング ===== */
  // ビューポートが 375x812 に満たない環境では .phone を縮小して収める
  function fitPhone() {
    var scale = Math.min(
      1,
      (window.innerHeight - 24) / 812,
      (window.innerWidth - 24) / 375
    );
    document.documentElement.style.setProperty('--phone-scale', String(Math.max(0.3, scale)));
  }

  /* ===== 初期化 ===== */
  function init() {
    fitPhone();
    window.addEventListener('resize', fitPhone);
  }

  document.addEventListener('DOMContentLoaded', init);
})();
```

- [ ] **Step 4: ブラウザで目視確認する**

`index.html` をブラウザ(Chrome推奨)で開く。

期待する結果:
- 淡いグレー(`#E8E4E6`)の背景の中央に、角丸40pxの白〜オフホワイトの端末枠(375×812)が表示される
- 端末枠の上部に「9:41」と電波・Wi-Fi・電池アイコンが表示される
- 枠の中身は空(画面は全て `display:none`)
- ページ全体がスクロールしない
- ブラウザウィンドウを縦横に小さくすると、端末枠が縮小して常に全体が収まる
- DevTools の Console にエラーが出ていない
- DevTools の Network タブに外部ホストへのリクエストが1件もない

- [ ] **Step 5: コミットする**

```bash
cd "C:/Users/ユーザー/Desktop/Cursor_ClaudeCode/260812_Avatar_Matching_ver2"
git add index.html style.css app.js
git commit -m "$(cat <<'EOF'
feat: プロジェクト初期化(端末フレーム・カラートークン・SVGスプライト)

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: 固定データ・状態管理・永続化・画面遷移

**Files:**
- Modify: `app.js`(IIFE内を全面的に書き換え)

**Interfaces:**
- Consumes: Task 1 の `index.html`(`#viewport`、`.screen[data-screen]`)、`fitPhone()`
- Produces(以降の全タスクが利用する):
  - `const STORAGE_KEY = 'avatarMatchingDemo.v1'`
  - `const QUESTIONS`: `Array<{ id: string, type: 'choice'|'free', text: string, options?: string[] }>`(6件)
  - `const PARTNER`: `{ anonymousLabel, compatibility, conversation: { timeLabel, turns: Array<{speaker:'self'|'partner', text:string}> }, axes: Array<{key,label,score,invertedGood,comment,quote}>, summary, revealed: {name,company,department,ageRange,message}, slots: Array<{id,label,place}> }`
  - `const NOTIFICATIONS`: `Array<{ id, icon, title, body, time, target }>`(2件)
  - `const STEPS`: `Array<{ label: string, icon: string }>`(5件)
  - `let state`(`INITIAL_STATE` と同形)
  - `function saveState(): void` / `function loadState(): object` / `function resetDemo(): void`
  - `function showScreen(name: string): void`
  - `const renderers`(`renderers[画面名] = function(){}` で登録)
  - `function el(id: string): HTMLElement` / `function esc(v: any): string` / `function clone(o)`
  - `function currentStepIndex(s: object): number`
  - `let waitingTimer` / `function clearWaitingTimer(): void`
  - `data-go="画面名"` 属性を持つ要素のクリックで `showScreen` する共通デリゲート
  - `window.__demo = { reset, showScreen, get state }`

- [ ] **Step 1: `app.js` を全面的に書き換える**

`C:\Users\ユーザー\Desktop\Cursor_ClaudeCode\260812_Avatar_Matching_ver2\app.js` の内容を以下で置き換える。

```js
/* =========================================================================
   AIアバター自動マッチング PoCデモ
   依存ライブラリなし / 外部通信なし
   ========================================================================= */
(function () {
  'use strict';

  /* =======================================================================
     固定データ
     ======================================================================= */

  var STORAGE_KEY = 'avatarMatchingDemo.v1';

  // インタビュー設問(選択式4問+自由記述2問)
  var QUESTIONS = [
    { id: 'q1', type: 'choice', text: '休日の過ごし方に近いのはどちらですか?',
      options: ['外に出かけて人と会う', '家でゆっくり自分の時間', '日によって半々くらい'] },
    { id: 'q2', type: 'choice', text: '初対面の人と話すとき、あなたは?',
      options: ['自分から話しかける方', '相手が話すのを聞く方', '場の空気を見て決める'] },
    { id: 'q3', type: 'free', text: '最近、思わず時間を忘れて夢中になったことは何ですか?' },
    { id: 'q4', type: 'choice', text: '一緒にいて心地よいと感じるのは、どんな人ですか?',
      options: ['笑いのツボが合う人', '価値観や考え方が近い人', '自分にない視点をくれる人'] },
    { id: 'q5', type: 'choice', text: '将来について、今の気持ちに近いのは?',
      options: ['具体的に考えている', 'なんとなく考えている', 'まだこれから考えたい'] },
    { id: 'q6', type: 'free', text: '相手に、これだけは知っておいてほしいことはありますか?' }
  ];

  // NPC(固定の相手候補)
  var PARTNER = {
    anonymousLabel: 'お相手 A さん',
    compatibility: 82,
    conversation: {
      timeLabel: '昨夜 2:14 – 2:17 の会話より抜粋',
      turns: [
        { speaker: 'self',    text: 'こんばんは。夜遅くにすみません。休日は外に出るより、家でゆっくりしている方が多いみたいですね。' },
        { speaker: 'partner', text: 'こんばんは。そうなんです。人と会うのは好きなんですが、週末はいったん静かにしないと次の週が持たなくて。' },
        { speaker: 'self',    text: '分かります。うちの人も同じことを言っていました。ちなみに、最近何かに夢中になったことはありますか。' },
        { speaker: 'partner', text: '短い文章を書くのにハマっています。誰に見せるわけでもないんですけど、書いていると気持ちが整理されて。' },
        { speaker: 'self',    text: 'それ、いいですね。うちの人は写真を撮るのが好きで、たぶん似た感覚だと思います。残しておきたい、みたいな。' },
        { speaker: 'partner', text: '確かに近いかもしれません。あと、笑いのツボが合う人だとすごく楽だなと思います。真面目な話ばかりだと疲れてしまって。' },
        { speaker: 'self',    text: 'そこも重なりそうです。ただ、うちの人は将来のことをかなり具体的に考えているタイプなんですが、そのあたりはどうでしょう。' },
        { speaker: 'partner', text: '正直、私はまだこれから考えたい段階です。焦って決めたくない、という感じでしょうか。' },
        { speaker: 'self',    text: 'なるほど。そこは温度差がありますね。ただ、方向が違うわけではなさそうなので、話しながら合わせていけそうです。' }
      ]
    },
    axes: [
      { key: 'flow', label: '会話の弾み', score: 88, invertedGood: false,
        comment: '沈黙がなく、互いに話題を足し合っていました。',
        quote: '「分かります。ちなみに、最近何かに夢中になったことはありますか。」' },
      { key: 'values', label: '価値観の一致', score: 84, invertedGood: false,
        comment: '休日の過ごし方や、大切にしたい時間の使い方が重なっています。',
        quote: '「週末はいったん静かにしないと次の週が持たなくて。」' },
      { key: 'humor', label: 'ユーモアの相性', score: 79, invertedGood: false,
        comment: '軽さを求める姿勢が一致。実際の笑いの相性は対面での確認が必要です。',
        quote: '「笑いのツボが合う人だとすごく楽だなと思います。」' },
      { key: 'interest', label: '相互関心', score: 86, invertedGood: false,
        comment: '一方的にならず、双方が相手に質問を返していました。',
        quote: '「短い文章を書くのにハマっています。」' },
      { key: 'conflict', label: '不一致の重大度', score: 24, invertedGood: true,
        comment: '将来設計の温度差はありますが、方向性の対立ではありません。',
        quote: '「正直、私はまだこれから考えたい段階です。」' }
    ],
    summary: '価値観と生活リズムの重なりが大きく、会話のテンポも自然でした。相違点はありますが、関係を妨げるほどではありません。',
    revealed: {
      name: '山田 花子(仮名)',
      company: '株式会社カリヤ精機',
      department: '品質保証部',
      ageRange: '30代前半',
      message: '文章を書くのが好きです。よろしくお願いします。'
    },
    slots: [
      { id: 'slot1', label: '9月5日(土) 13:00 – 14:00', place: '刈谷市内 カフェ' },
      { id: 'slot2', label: '9月6日(日) 11:00 – 12:00', place: '刈谷市内 カフェ' },
      { id: 'slot3', label: '9月12日(土) 15:00 – 16:00', place: '刈谷駅前 ラウンジ' }
    ]
  };

  // お知らせ
  var NOTIFICATIONS = [
    { id: 'n1', icon: 'bell', title: '新しいマッチ候補がいます',
      body: '相性基準を満たしたペアが見つかりました。', time: '2時間前', target: 'report' },
    { id: 'n2', icon: 'doc', title: '相性レポートが準備できました',
      body: '会話ログと相性レポートを確認できます。', time: '5時間前', target: 'report' }
  ];

  // 5段階ステップインジケーター
  var STEPS = [
    { label: '登録完了',             icon: 'i-check' },
    { label: 'インタビュー完了',     icon: 'i-chat' },
    { label: 'アバターが会話中',     icon: 'i-avatar-pair' },
    { label: '相性が高い時に通知',   icon: 'i-bell' },
    { label: '会話ログを読んで判断', icon: 'i-doc' }
  ];

  /* =======================================================================
     状態管理と永続化
     ======================================================================= */

  var INITIAL_STATE = {
    version: 1,                 // 保存形式のバージョン。不一致時は初期化
    currentScreen: 'invite',    // 現在表示中の画面名
    inviteCode: '',             // 入力された招待コード(検証はしない)
    registered: false,          // 招待コード登録済みか
    answers: [],                // インタビュー回答 [{ id, question, answer, type }]
    interviewDone: false,       // 全6問の回答完了フラグ
    notified: false,            // マッチ通知が発生済みか
    readNotificationIds: [],    // 既読のお知らせID
    decision: null,             // null | 'accept' | 'decline'
    selectedSlotId: null,       // 選択した面談候補日時のID
    scheduled: false,           // 日程調整を送信済みか
    notificationsEnabled: true  // 設定画面のトグル(表示のみ)
  };

  var state = clone(INITIAL_STATE);
  var waitingTimer = null;

  function clone(obj) {
    return JSON.parse(JSON.stringify(obj));
  }

  // localStorage が使えない環境(プライベートモード等)でも例外でデモを止めない
  function saveState() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (e) {
      /* メモリ上の state のみで動作を継続する */
    }
  }

  function loadState() {
    var raw = null;
    try {
      raw = localStorage.getItem(STORAGE_KEY);
    } catch (e) {
      return clone(INITIAL_STATE);
    }
    if (!raw) { return clone(INITIAL_STATE); }

    var parsed = null;
    try {
      parsed = JSON.parse(raw);
    } catch (e) {
      parsed = null;
    }
    // 破損 / バージョン不一致 → キーを消して初期状態から開始
    if (!parsed || typeof parsed !== 'object' || parsed.version !== INITIAL_STATE.version) {
      try { localStorage.removeItem(STORAGE_KEY); } catch (e2) { /* 無視 */ }
      return clone(INITIAL_STATE);
    }
    // 欠けたキーは初期値で補う
    var next = clone(INITIAL_STATE);
    Object.keys(next).forEach(function (key) {
      if (Object.prototype.hasOwnProperty.call(parsed, key)) { next[key] = parsed[key]; }
    });
    return next;
  }

  function resetDemo() {
    clearWaitingTimer();
    try { localStorage.removeItem(STORAGE_KEY); } catch (e) { /* 無視 */ }
    state = clone(INITIAL_STATE);
    saveState();
    showScreen('invite');
  }

  // ステップインジケーターの状態は state から算出する(重複した状態を持たない)
  function currentStepIndex(s) {
    if (s.decision) { return 4; }       // 会話ログを読んで判断
    if (s.notified) { return 3; }       // 相性が高い時に通知
    if (s.interviewDone) { return 2; }  // アバターが会話中
    if (s.registered) { return 1; }     // インタビュー完了
    return 0;                           // 登録完了
  }

  function clearWaitingTimer() {
    if (waitingTimer !== null) {
      clearTimeout(waitingTimer);
      waitingTimer = null;
    }
  }

  /* =======================================================================
     DOMヘルパー
     ======================================================================= */

  function el(id) { return document.getElementById(id); }

  var ESCAPE_MAP = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
  function esc(value) {
    return String(value).replace(/[&<>"']/g, function (c) { return ESCAPE_MAP[c]; });
  }

  /* =======================================================================
     画面遷移
     ======================================================================= */

  var renderers = {};

  function showScreen(name) {
    // 未登録の状態で後続画面へ入られた場合は招待コード画面へ戻す
    if (!state.registered && name !== 'invite') { name = 'invite'; }

    var target = document.querySelector('.screen[data-screen="' + name + '"]');
    if (!target) { return; }

    // 待機画面から離れるときはタイマーを止める
    if (name !== 'waiting') { clearWaitingTimer(); }

    var screens = document.querySelectorAll('.screen');
    for (var i = 0; i < screens.length; i++) { screens[i].classList.remove('is-active'); }
    target.classList.add('is-active');

    state.currentScreen = name;
    saveState();

    el('viewport').scrollTop = 0;

    if (renderers[name]) { renderers[name](); }

    var head = target.querySelector('[data-autofocus]') || target;
    head.focus({ preventScroll: true });
  }

  /* =======================================================================
     ブラウザ離脱防止ガード(§7.2)
     画面遷移に履歴APIは使わない。戻る/スワイプバックでの離脱のみを防ぐ
     ======================================================================= */

  function installBackGuard() {
    history.pushState(null, '', location.href);
    window.addEventListener('popstate', function () {
      history.pushState(null, '', location.href);
    });
  }

  /* =======================================================================
     端末枠のスケーリング
     ======================================================================= */

  function fitPhone() {
    var scale = Math.min(
      1,
      (window.innerHeight - 24) / 812,
      (window.innerWidth - 24) / 375
    );
    document.documentElement.style.setProperty('--phone-scale', String(Math.max(0.3, scale)));
  }

  /* =======================================================================
     初期化
     ======================================================================= */

  function init() {
    state = loadState();

    fitPhone();
    window.addEventListener('resize', fitPhone);
    installBackGuard();

    // data-go="画面名" を持つ要素は共通で画面遷移する
    document.addEventListener('click', function (event) {
      var trigger = event.target.closest('[data-go]');
      if (trigger) { showScreen(trigger.getAttribute('data-go')); }
    });

    showScreen(state.currentScreen || 'invite');
  }

  // 展示会での緊急操作用
  window.__demo = {
    reset: resetDemo,
    showScreen: showScreen,
    get state() { return state; }
  };

  document.addEventListener('DOMContentLoaded', init);
})();
```

- [ ] **Step 2: ブラウザのコンソールで状態管理を目視確認する**

`index.html` を開き、DevTools の Console で以下を順に実行する。

```js
__demo.state
// 期待: {version: 1, currentScreen: "invite", inviteCode: "", registered: false, answers: [], …}

localStorage.getItem('avatarMatchingDemo.v1')
// 期待: '{"version":1,"currentScreen":"invite", …}' という JSON 文字列

__demo.showScreen('home')
__demo.state.currentScreen
// 期待: "invite" (未登録のため invite に差し戻される)

__demo.state.registered = true; __demo.showScreen('home'); __demo.state.currentScreen
// 期待: "home"

__demo.reset(); __demo.state.currentScreen
// 期待: "invite" (localStorage も初期化されている)
```

- [ ] **Step 3: 破損データからの復帰を目視確認する**

Console で以下を実行し、リロードする。

```js
localStorage.setItem('avatarMatchingDemo.v1', '{壊れたJSON')
location.reload()
```

期待する結果:
- Console にエラーが出ない
- リロード後 `localStorage.getItem('avatarMatchingDemo.v1')` が初期状態のJSONに戻っている

同様に `localStorage.setItem('avatarMatchingDemo.v1', '{"version":99}')` を設定してリロードし、初期状態に戻ることを確認する。

- [ ] **Step 4: 離脱防止ガードを目視確認する**

ブラウザの「戻る」ボタンを数回押す。期待する結果: ページから離脱せず、同じページに留まる。Console にエラーが出ない。

- [ ] **Step 5: コミットする**

```bash
cd "C:/Users/ユーザー/Desktop/Cursor_ClaudeCode/260812_Avatar_Matching_ver2"
git add app.js
git commit -m "$(cat <<'EOF'
feat: 固定データ・状態管理・永続化・画面遷移の基盤を実装

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: 共通シェル(ヘッダー・下部タブバー・トースト・確認シート・ローディング)

**Files:**
- Modify: `index.html`(`.phone` 内に共通シェルの要素を追加)
- Modify: `style.css`(末尾に共通シェルのスタイルを追加)
- Modify: `app.js`(`showScreen` に `updateChrome(name);` を追加、共通シェルのセクションを追加、`init()` に配線を追加)

**Interfaces:**
- Consumes: Task 2 の `el` / `esc` / `state` / `saveState` / `showScreen` / `renderers` / `NOTIFICATIONS` / `clearWaitingTimer` / `init()`
- Produces:
  - `function updateChrome(name: string): void` — ヘッダー・タブバーの表示/非表示とアクティブ状態を更新
  - `function unreadCount(): number` — 未読お知らせ件数
  - `function updateBellBadge(): void` — ベルの未読バッジを更新
  - `function markNotificationRead(id: string): void` — 該当お知らせを既読にしてバッジを更新
  - `function showToast(text: string, onTap: function|null): void` / `function hideToast(): void`
  - `function openSheet(options: { title, message, confirmLabel, danger?, onConfirm })` / `function closeSheet(): void`
  - `function showLoading(text: string): void` / `function hideLoading(): void`
  - DOM id: `appHeader` `bellButton` `bellBadge` `tabBar` `toast` `toastButton` `sheet` `sheetTitle` `sheetMessage` `sheetConfirm` `sheetCancel` `loading` `loadingText`

- [ ] **Step 1: `index.html` に共通シェルの要素を追加する**

`index.html` の `<div class="status-bar" aria-hidden="true">…</div>` ブロックの**直後**(`<main class="viewport" id="viewport">` の直前)に以下を挿入する。

```html
    <header class="app-header" id="appHeader" hidden>
      <div class="app-header__brand">
        <span class="icon-circle icon-circle--sm"><svg class="icon" aria-hidden="true" focusable="false"><use href="#i-logo"></use></svg></span>
        <span class="app-header__title">AIアバター自動マッチング</span>
      </div>
      <button type="button" class="bell" id="bellButton" aria-label="お知らせ">
        <svg class="icon" aria-hidden="true" focusable="false"><use href="#i-bell"></use></svg>
        <span class="bell__badge" id="bellBadge" hidden>0</span>
      </button>
    </header>
```

`index.html` の `</main>` の**直後**(`.phone` を閉じる `</div>` の直前)に以下を挿入する。

```html
    <nav class="tab-bar" id="tabBar" hidden aria-label="メインナビゲーション">
      <button type="button" class="tab" data-tab="home" data-go="home">
        <svg class="icon" aria-hidden="true" focusable="false"><use href="#i-home"></use></svg>
        <span class="tab__label">ホーム</span>
      </button>
      <button type="button" class="tab" data-tab="mypage" data-go="mypage">
        <svg class="icon" aria-hidden="true" focusable="false"><use href="#i-doc"></use></svg>
        <span class="tab__label">マイページ</span>
      </button>
      <button type="button" class="tab" data-tab="messages" data-go="notifications">
        <svg class="icon" aria-hidden="true" focusable="false"><use href="#i-chat"></use></svg>
        <span class="tab__label">メッセージ</span>
      </button>
      <button type="button" class="tab" data-tab="profile" data-go="profile">
        <svg class="icon" aria-hidden="true" focusable="false"><use href="#i-user"></use></svg>
        <span class="tab__label">プロフィール</span>
      </button>
    </nav>

    <div class="toast" id="toast" hidden role="status" aria-live="polite">
      <button type="button" class="toast__btn" id="toastButton">
        <span class="icon-circle icon-circle--sm"><svg class="icon" aria-hidden="true" focusable="false"><use href="#i-bell"></use></svg></span>
        <span class="toast__text"></span>
      </button>
    </div>

    <div class="sheet" id="sheet" hidden>
      <button type="button" class="sheet__backdrop" id="sheetBackdrop" aria-label="閉じる"></button>
      <div class="sheet__panel" role="dialog" aria-modal="true" aria-labelledby="sheetTitle">
        <h2 class="sheet__title" id="sheetTitle" tabindex="-1"></h2>
        <p class="sheet__message" id="sheetMessage"></p>
        <button type="button" class="btn btn--primary" id="sheetConfirm">OK</button>
        <button type="button" class="btn btn--secondary" id="sheetCancel">キャンセル</button>
      </div>
    </div>

    <div class="loading" id="loading" hidden role="status" aria-live="polite">
      <span class="spinner" aria-hidden="true"></span>
      <span class="loading__text" id="loadingText"></span>
    </div>
```

- [ ] **Step 2: `style.css` の末尾に共通シェルのスタイルを追加する**

```css
/* ==========================================================================
   共通シェル(ヘッダー / タブバー / トースト / 確認シート / ローディング)
   ========================================================================== */
.app-header {
  flex: none;
  display: flex; align-items: center; justify-content: space-between; gap: 8px;
  padding: 2px 12px 8px 16px;
  background: var(--bg-app);
}
.app-header[hidden] { display: none; }
.app-header__brand { display: flex; align-items: center; gap: 8px; min-width: 0; }
.app-header__title {
  font-size: 15px; font-weight: 700;
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}

.bell {
  position: relative; flex: none;
  width: 40px; height: 40px;
  display: flex; align-items: center; justify-content: center;
  border: 0; border-radius: 50%;
  background: transparent; color: var(--text-main);
  cursor: pointer;
}
.bell__badge {
  position: absolute; top: 1px; right: 1px;
  min-width: 18px; height: 18px; padding: 0 5px;
  border-radius: var(--radius-pill);
  background: var(--wine); color: var(--text-onwine);
  font-size: 11px; font-weight: 700; line-height: 18px; text-align: center;
}
.bell__badge[hidden] { display: none; }

.tab-bar {
  flex: none;
  display: grid; grid-template-columns: repeat(4, 1fr);
  background: var(--bg-card);
  border-top: 1px solid var(--border);
  padding-bottom: 18px; /* セーフエリア相当の余白 */
}
.tab-bar[hidden] { display: none; }
.tab {
  min-height: 56px;
  display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 2px;
  padding: 8px 0 4px;
  border: 0; background: transparent;
  font-family: inherit; color: var(--text-sub);
  cursor: pointer;
}
.tab__label { font-size: 10px; font-weight: 500; line-height: 1.3; }
.tab.is-active { color: var(--wine); }

.toast { position: absolute; top: 50px; left: 12px; right: 12px; z-index: 30; }
.toast[hidden] { display: none; }
.toast__btn {
  width: 100%;
  display: flex; align-items: center; gap: 10px; text-align: left;
  padding: 12px 14px;
  border: 1px solid var(--border); border-radius: var(--radius-card);
  background: var(--bg-card); color: var(--text-main);
  box-shadow: 0 6px 20px rgba(80, 40, 60, 0.16);
  font-family: inherit; font-size: 14px; font-weight: 600;
  cursor: pointer;
  opacity: 0; transform: translateY(-16px);
  transition: opacity .3s ease-out, transform .3s ease-out;
}
.toast.is-visible .toast__btn { opacity: 1; transform: none; }

.sheet { position: absolute; inset: 0; z-index: 40; display: flex; align-items: flex-end; }
.sheet[hidden] { display: none; }
.sheet__backdrop {
  position: absolute; inset: 0;
  border: 0; padding: 0;
  background: rgba(46, 42, 44, 0.38);
  cursor: pointer;
}
.sheet__panel {
  position: relative; width: 100%;
  padding: 20px 16px 28px;
  background: var(--bg-card);
  border-radius: 20px 20px 0 0;
}
.sheet__title { font-size: 16px; font-weight: 700; line-height: 1.35; margin: 0 0 8px; }
.sheet__message { font-size: 14px; margin: 0 0 16px; }
.sheet__panel .btn--primary.is-danger { background: var(--danger); }

.loading {
  position: absolute; inset: 0; z-index: 50;
  display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 14px;
  padding: 0 32px;
  background: rgba(247, 243, 244, 0.94);
  text-align: center;
}
.loading[hidden] { display: none; }
.loading__text { font-size: 14px; font-weight: 600; }
.spinner {
  width: 36px; height: 36px;
  border-radius: 50%;
  border: 3px solid var(--pink-soft);
  border-top-color: var(--wine);
  animation: spin .8s linear infinite;
}
@keyframes spin { to { transform: rotate(360deg); } }
```

- [ ] **Step 3: `app.js` の `showScreen` に `updateChrome` の呼び出しを追加する**

`showScreen` 内の以下の行を、

```js
    if (renderers[name]) { renderers[name](); }
```

以下に置き換える。

```js
    if (renderers[name]) { renderers[name](); }

    updateChrome(name);
```

- [ ] **Step 4: `app.js` に共通シェルのセクションを追加する**

`/* =======================================================================
     ブラウザ離脱防止ガード(§7.2)` のコメントブロックの**直前**に以下を挿入する。

```js
  /* =======================================================================
     共通シェル(ヘッダー / タブバー / トースト / 確認シート / ローディング)
     ======================================================================= */

  // ヘッダーと下部タブバーを出さない画面(オンボーディングの一本道感を出す)
  var CHROME_HIDDEN_SCREENS = ['invite', 'interview'];

  // 画面名 → アクティブにする下部タブ
  var TAB_FOR_SCREEN = {
    home: 'home',
    mypage: 'mypage',
    notifications: 'messages',
    profile: 'profile'
  };

  function updateChrome(name) {
    var showChrome = state.registered && CHROME_HIDDEN_SCREENS.indexOf(name) === -1;
    el('appHeader').hidden = !showChrome;
    el('tabBar').hidden = !showChrome;

    var activeTab = TAB_FOR_SCREEN[name] || null;
    var tabs = el('tabBar').querySelectorAll('.tab');
    for (var i = 0; i < tabs.length; i++) {
      var isActive = tabs[i].getAttribute('data-tab') === activeTab;
      tabs[i].classList.toggle('is-active', isActive);
      if (isActive) { tabs[i].setAttribute('aria-current', 'page'); }
      else { tabs[i].removeAttribute('aria-current'); }
    }

    updateBellBadge();
  }

  function unreadCount() {
    return NOTIFICATIONS.filter(function (n) {
      return state.readNotificationIds.indexOf(n.id) === -1;
    }).length;
  }

  function updateBellBadge() {
    var count = state.notified ? unreadCount() : 0;
    var badge = el('bellBadge');
    badge.textContent = String(count);
    badge.hidden = count === 0;
    el('bellButton').setAttribute('aria-label', count > 0 ? 'お知らせ 未読' + count + '件' : 'お知らせ');
  }

  function markNotificationRead(id) {
    if (state.readNotificationIds.indexOf(id) === -1) {
      state.readNotificationIds.push(id);
      saveState();
    }
    updateBellBadge();
  }

  /* ----- トースト(通知バナー) ----- */

  var toastTimer = null;

  function showToast(text, onTap) {
    var toast = el('toast');
    var button = el('toastButton');
    button.querySelector('.toast__text').textContent = text;
    toast.hidden = false;
    // hidden 解除の直後にクラスを付けてスライドインさせる
    requestAnimationFrame(function () { toast.classList.add('is-visible'); });
    button.onclick = function () {
      hideToast();
      if (onTap) { onTap(); }
    };
    clearTimeout(toastTimer);
    toastTimer = setTimeout(hideToast, 4000);
  }

  function hideToast() {
    clearTimeout(toastTimer);
    var toast = el('toast');
    toast.classList.remove('is-visible');
    setTimeout(function () { toast.hidden = true; }, 300);
  }

  /* ----- 確認シート(window.confirm は使わない) ----- */

  var sheetOnConfirm = null;

  function openSheet(options) {
    el('sheetTitle').textContent = options.title;
    el('sheetMessage').textContent = options.message;
    var confirmButton = el('sheetConfirm');
    confirmButton.textContent = options.confirmLabel;
    confirmButton.classList.toggle('is-danger', options.danger === true);
    sheetOnConfirm = options.onConfirm || null;
    el('sheet').hidden = false;
    el('sheetTitle').focus({ preventScroll: true });
  }

  function closeSheet() {
    el('sheet').hidden = true;
    sheetOnConfirm = null;
  }

  /* ----- ローディング演出 ----- */

  function showLoading(text) {
    el('loadingText').textContent = text;
    el('loading').hidden = false;
  }

  function hideLoading() {
    el('loading').hidden = true;
  }

  function initShell() {
    el('bellButton').addEventListener('click', function () { showScreen('notifications'); });
    el('sheetCancel').addEventListener('click', closeSheet);
    el('sheetBackdrop').addEventListener('click', closeSheet);
    el('sheetConfirm').addEventListener('click', function () {
      var callback = sheetOnConfirm;
      closeSheet();
      if (callback) { callback(); }
    });
  }
```

- [ ] **Step 5: `app.js` の `init()` に `initShell()` を配線し、`resetDemo` にオーバーレイ消去を追加する**

`init()` 内の以下の行を、

```js
    installBackGuard();
```

以下に置き換える。

```js
    installBackGuard();
    initShell();
```

`resetDemo()` の冒頭2行を、

```js
  function resetDemo() {
    clearWaitingTimer();
```

以下に置き換える。

```js
  function resetDemo() {
    clearWaitingTimer();
    hideToast();
    closeSheet();
    hideLoading();
```

- [ ] **Step 6: ヘッダーとタブバーをブラウザで目視確認する**

`index.html` を開き、DevTools の Console で以下を実行する。

```js
__demo.state.registered = true; __demo.showScreen('home')
```

期待する結果:
- 端末枠の上部にロゴ+「AIアバター自動マッチング」+ベルアイコンのヘッダーが表示される
- 端末枠の下部に4つのタブ(ホーム/マイページ/メッセージ/プロフィール)が表示され、「ホーム」がワインレッドでアクティブ表示になっている
- タブ「メッセージ」をクリック → お知らせ画面(中身は空)へ遷移し、「メッセージ」タブがアクティブになる
- タブ「プロフィール」「マイページ」も同様にアクティブが切り替わる

続けて Console で以下を実行する。

```js
__demo.state.notified = true; __demo.showScreen('home')
```

期待する結果: ベルアイコンの右上にワインレッドの「2」バッジが表示される。ベルをクリックするとお知らせ画面へ遷移する。

続けて `__demo.showScreen('invite')` を実行する。期待する結果: ヘッダーとタブバーが両方とも消える。

- [ ] **Step 7: トースト・確認シート・ローディングを目視確認する**

これらは IIFE 内の関数のため Console から直接呼べない。DOM を手動操作して見た目を確認する。Console で以下を実行する。

```js
document.getElementById('toast').hidden = false;
document.querySelector('#toastButton .toast__text').textContent = '新しいマッチ候補がいます';
document.getElementById('toast').classList.add('is-visible');
```

期待する結果: 端末枠の上部に白いカード型のバナーが表示される(スライドイン演出の実動作は Task 6 で確認する)。

```js
document.getElementById('sheetTitle').textContent = '辞退の確認';
document.getElementById('sheetMessage').textContent = '辞退すると、このお相手の情報は表示されなくなります。よろしいですか?';
document.getElementById('sheetConfirm').textContent = '辞退する';
document.getElementById('sheet').hidden = false;
```

期待する結果: 画面下部からシートが現れ、背後が半透明の暗幕になる。「キャンセル」または暗幕のクリックで閉じる。

```js
document.getElementById('loadingText').textContent = 'お相手も「会う」を選んでいます';
document.getElementById('loading').hidden = false;
```

期待する結果: 画面全体が淡い下地で覆われ、ワインレッドのスピナーが回転し、テキストが表示される。確認後 `document.getElementById('loading').hidden = true;` で閉じる。

最後にリロードして Console にエラーが出ていないことを確認する。

- [ ] **Step 8: コミットする**

```bash
cd "C:/Users/ユーザー/Desktop/Cursor_ClaudeCode/260812_Avatar_Matching_ver2"
git add index.html style.css app.js
git commit -m "feat: 共通シェル(ヘッダー・タブバー・トースト・確認シート・ローディング)を実装

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 4: 招待コード入力画面 (`invite`)

**Files:**
- Modify: `index.html`(`<section class="screen" data-screen="invite" tabindex="-1"></section>` を置き換え)
- Modify: `style.css`(末尾に招待コード画面のスタイルを追加)
- Modify: `app.js`(`renderers.invite` と `initInviteScreen()` を追加、`init()` に配線)

**Interfaces:**
- Consumes: Task 2 の `el` / `state` / `saveState` / `showScreen` / `renderers` / `init()`
- Produces: `function initInviteScreen(): void`、`renderers.invite`、DOM id: `inviteInput` `inviteError` `inviteSubmit`

- [ ] **Step 1: `index.html` の `invite` セクションを置き換える**

`<section class="screen" data-screen="invite" tabindex="-1"></section>` を以下で置き換える。

```html
      <section class="screen screen--invite" data-screen="invite" tabindex="-1">
        <div class="invite__brand">
          <span class="icon-circle icon-circle--lg"><svg class="icon icon--lg" aria-hidden="true" focusable="false"><use href="#i-logo"></use></svg></span>
          <h1 class="invite__service" data-autofocus tabindex="-1">AIアバター自動マッチング</h1>
          <p class="invite__catch">AIが代わりに会っている。</p>
        </div>

        <div class="card">
          <p class="text-body">勤務先から配布された招待コードを入力してください。実名や所属は、相手とお互いがOKするまで誰にも表示されません。</p>
          <label class="field__label" for="inviteInput">招待コード</label>
          <input class="field__input" id="inviteInput" type="text" placeholder="例: KARIYA-2026"
                 autocomplete="off" autocapitalize="off" spellcheck="false" aria-describedby="inviteError">
          <p class="field__error" id="inviteError" role="alert" hidden>招待コードを入力してください</p>
          <button type="button" class="btn btn--primary invite__submit" id="inviteSubmit">登録する</button>
        </div>

        <p class="text-note">※本アプリはデモ用です。入力内容はお使いの端末内にのみ保存され、外部には送信されません。</p>
      </section>
```

- [ ] **Step 2: `style.css` の末尾に招待コード画面のスタイルを追加する**

```css
/* ==========================================================================
   [1] 招待コード入力画面
   ========================================================================== */
.screen--invite { padding-top: 48px; }
.invite__brand { text-align: center; margin-bottom: 28px; }
.invite__brand .icon-circle { margin: 0 auto 14px; }
.invite__service { font-size: 18px; font-weight: 700; line-height: 1.35; margin: 0 0 6px; }
.invite__catch { font-size: 26px; font-weight: 700; line-height: 1.35; margin: 0; color: var(--wine); }
.invite__submit { margin-top: 18px; }
```

- [ ] **Step 3: `app.js` に招待コード画面のセクションを追加する**

`/* =======================================================================
     ブラウザ離脱防止ガード(§7.2)` のコメントブロックの**直前**に以下を挿入する。

```js
  /* =======================================================================
     [1] 招待コード入力画面
     ======================================================================= */

  renderers.invite = function () {
    var input = el('inviteInput');
    input.value = state.inviteCode || '';
    input.classList.remove('is-error');
    el('inviteError').hidden = true;
  };

  function submitInviteCode() {
    var input = el('inviteInput');
    var value = input.value.trim();

    // 唯一のバリデーション: 空欄または空白のみは通さない
    if (value === '') {
      el('inviteError').hidden = false;
      input.classList.add('is-error');
      input.focus();
      return;
    }

    // 空欄でなければ、どんな文字列でも通す(形式・長さ・大文字小文字の検証は行わない)
    state.inviteCode = value;
    state.registered = true;
    saveState();
    showScreen('interview');
  }

  function initInviteScreen() {
    var input = el('inviteInput');

    input.addEventListener('input', function () {
      el('inviteError').hidden = true;
      input.classList.remove('is-error');
    });

    input.addEventListener('keydown', function (event) {
      if (event.key === 'Enter') { submitInviteCode(); }
    });

    el('inviteSubmit').addEventListener('click', submitInviteCode);
  }
```

- [ ] **Step 4: `app.js` の `init()` に `initInviteScreen()` を配線する**

`init()` 内の以下の行を、

```js
    initShell();
```

以下に置き換える。

```js
    initShell();
    initInviteScreen();
```

- [ ] **Step 5: ブラウザで目視確認する**

Console で `__demo.reset()` を実行してから確認する。

期待する結果:
- 端末枠の上部中央に、淡いピンクの円に囲まれた「重なった2つの円」のロゴ、「AIアバター自動マッチング」、ワインレッドの大きな「AIが代わりに会っている。」が表示される
- 白いカードの中に説明文、「招待コード」ラベル、`例: KARIYA-2026` のプレースホルダを持つ入力欄、「登録する」ボタンがある
- カードの下に「※本アプリはデモ用です。…」の12px灰色テキストがある
- ヘッダーと下部タブバーが表示されていない
- **空欄のまま「登録する」** → 入力欄の枠が赤くなり、下に赤字で「招待コードを入力してください」が出て、画面は遷移しない
- **何か1文字入力する** → エラー文が消え、枠の赤が取れる
- **`TEST` と入力して「登録する」** → 空の AIインタビュー画面へ遷移する(中身は Task 5 で実装)
- Console で `__demo.state.inviteCode` が `"TEST"`、`__demo.state.registered` が `true`
- 入力欄にフォーカスして Enter キーでも登録できる
- Tab キーで 入力欄 → 「登録する」 とフォーカスが移動し、Enter で実行できる

- [ ] **Step 6: コミットする**

```bash
cd "C:/Users/ユーザー/Desktop/Cursor_ClaudeCode/260812_Avatar_Matching_ver2"
git add index.html style.css app.js
git commit -m "feat: 招待コード入力画面を実装

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 5: AIインタビュー画面 (`interview`)

**Files:**
- Modify: `index.html`(`<section class="screen" data-screen="interview" tabindex="-1"></section>` を置き換え)
- Modify: `style.css`(末尾にインタビュー画面のスタイルを追加)
- Modify: `app.js`(インタビュー画面のセクションを追加、`init()` に配線)

**Interfaces:**
- Consumes: Task 2 の `el` / `esc` / `state` / `saveState` / `showScreen` / `renderers` / `QUESTIONS` / `init()`
- Produces:
  - `renderers.interview`
  - `function initInterviewScreen(): void`
  - `function bubbleHTML(side: 'ai'|'self', text: string): string` — 吹き出し1つのHTML。Task 8 の会話ログでは使わず、別途 `logBubbleHTML` を定義する
  - `function scrollViewportToBottom(): void`
  - DOM id: `interviewProgress` `interviewProgressBar` `interviewChat` `interviewInput` `interviewText` `interviewSend` `interviewActions` `interviewFinish`

- [ ] **Step 1: `index.html` の `interview` セクションを置き換える**

`<section class="screen" data-screen="interview" tabindex="-1"></section>` を以下で置き換える。

```html
      <section class="screen screen--interview" data-screen="interview" tabindex="-1">
        <div class="interview__head">
          <h1 class="screen-title interview__title" data-autofocus tabindex="-1">AIインタビュー</h1>
          <span class="interview__progress" id="interviewProgress">1 / 6</span>
        </div>
        <div class="progress"><div class="progress__fill" id="interviewProgressBar" style="width:0%"></div></div>

        <div class="chat interview__chat" id="interviewChat"></div>

        <div class="interview__input" id="interviewInput" hidden>
          <label class="sr-only" for="interviewText">回答を入力</label>
          <input class="field__input" id="interviewText" type="text" placeholder="回答を入力してください"
                 autocomplete="off" spellcheck="false">
          <button type="button" class="interview__send" id="interviewSend" disabled>送信</button>
        </div>

        <div class="interview__actions" id="interviewActions" hidden>
          <button type="button" class="btn btn--primary" id="interviewFinish">アバターにまかせる</button>
        </div>
      </section>
```

- [ ] **Step 2: `style.css` の末尾にインタビュー画面のスタイルを追加する**

```css
/* ==========================================================================
   [2] AIインタビュー画面
   ========================================================================== */
.interview__head { display: flex; align-items: baseline; justify-content: space-between; gap: 8px; }
.interview__title { margin-bottom: 6px; }
.interview__progress { font-size: 13px; font-weight: 700; color: var(--wine); white-space: nowrap; }

.progress { height: 6px; border-radius: var(--radius-pill); background: var(--track); overflow: hidden; }
.progress__fill {
  height: 100%;
  border-radius: var(--radius-pill);
  background: linear-gradient(90deg, var(--wine), var(--pink));
  transition: width .4s ease-out;
}

.interview__chat { margin-top: 18px; }

.choices { display: flex; flex-direction: column; gap: 8px; align-self: stretch; margin-top: 2px; }
.choice {
  width: 100%;
  padding: 12px 14px;
  border: 1px solid var(--wine);
  border-radius: var(--radius-btn);
  background: var(--bg-card);
  color: var(--wine);
  font-family: inherit; font-size: 14px; font-weight: 600;
  text-align: left;
  cursor: pointer;
}
.choice:active { background: var(--pink-soft); }

.bubble--typing { display: flex; gap: 4px; align-items: center; min-height: 40px; }
.bubble--typing span {
  width: 6px; height: 6px; border-radius: 50%;
  background: var(--wine);
  opacity: .4;
  animation: typing 1.2s ease-in-out infinite;
}
.bubble--typing span:nth-child(2) { animation-delay: .2s; }
.bubble--typing span:nth-child(3) { animation-delay: .4s; }
@keyframes typing { 0%, 100% { opacity: .25; } 50% { opacity: 1; } }

.interview__input { display: flex; gap: 8px; align-items: center; margin-top: 16px; }
.interview__input[hidden] { display: none; }
.interview__input .field__input { flex: 1 1 auto; min-width: 0; }
.interview__send {
  flex: none;
  min-height: 46px; padding: 0 18px;
  border: 0; border-radius: var(--radius-btn);
  background: var(--wine); color: var(--text-onwine);
  font-family: inherit; font-size: 14px; font-weight: 700;
  cursor: pointer;
}
.interview__send:disabled { background: var(--disabled); cursor: default; }

.interview__actions { margin-top: 18px; }
.interview__actions[hidden] { display: none; }
```

- [ ] **Step 3: `app.js` にインタビュー画面のセクションを追加する**

`/* =======================================================================
     ブラウザ離脱防止ガード(§7.2)` のコメントブロックの**直前**に以下を挿入する。

```js
  /* =======================================================================
     [2] AIインタビュー画面
     ======================================================================= */

  var INTERVIEW_INTRO = 'はじめまして。あなたのAIアバターです。これから6つだけ質問させてください。あなたの答え方や考え方を学んで、私があなたの代わりに相手と話します。';
  var INTERVIEW_OUTRO = 'ありがとうございます。あなたのことが分かってきました。あとは私にまかせて、ゆっくり休んでください。';

  var interviewTimer = null;

  function bubbleHTML(side, text) {
    return '<div class="bubble bubble--' + side + '">' + esc(text) + '</div>';
  }

  function scrollViewportToBottom() {
    var viewport = el('viewport');
    viewport.scrollTop = viewport.scrollHeight;
  }

  renderers.interview = function () {
    clearTimeout(interviewTimer);

    var answered = state.answers.length;
    var question = QUESTIONS[answered] || null;

    // 導入メッセージ → 回答済みの履歴 → 現在の質問(または締めのメッセージ)
    var html = bubbleHTML('ai', INTERVIEW_INTRO);
    state.answers.forEach(function (item) {
      html += bubbleHTML('ai', item.question);
      html += bubbleHTML('self', item.answer);
    });

    if (question) {
      html += bubbleHTML('ai', question.text);
      if (question.type === 'choice') {
        html += '<div class="choices">' + question.options.map(function (option, index) {
          return '<button type="button" class="choice" data-option="' + index + '">' + esc(option) + '</button>';
        }).join('') + '</div>';
      }
    } else {
      html += bubbleHTML('ai', INTERVIEW_OUTRO);
    }

    el('interviewChat').innerHTML = html;

    el('interviewProgress').textContent =
      (question ? answered + 1 : QUESTIONS.length) + ' / ' + QUESTIONS.length;
    el('interviewProgressBar').style.width =
      Math.round((answered / QUESTIONS.length) * 100) + '%';

    var textInput = el('interviewText');
    textInput.value = '';
    el('interviewSend').disabled = true;

    // 自由記述の設問のときだけ入力欄を出す。全問回答後だけ完了ボタンを出す
    el('interviewInput').hidden = !(question && question.type === 'free');
    el('interviewActions').hidden = question !== null;

    scrollViewportToBottom();
  };

  function submitInterviewAnswer(answer) {
    var index = state.answers.length;
    var question = QUESTIONS[index];
    if (!question) { return; }

    state.answers.push({
      id: question.id,
      question: question.text,
      answer: answer,
      type: question.type
    });
    saveState();

    // 自分の吹き出しを即時追加し、タイピング演出をはさんでから次の質問を描画する
    var chat = el('interviewChat');
    var choices = chat.querySelector('.choices');
    if (choices) { choices.remove(); }
    chat.insertAdjacentHTML('beforeend', bubbleHTML('self', answer));
    chat.insertAdjacentHTML('beforeend',
      '<div class="bubble bubble--ai bubble--typing"><span></span><span></span><span></span></div>');
    el('interviewInput').hidden = true;
    scrollViewportToBottom();

    interviewTimer = setTimeout(function () { renderers.interview(); }, 600);
  }

  function initInterviewScreen() {
    el('interviewChat').addEventListener('click', function (event) {
      var button = event.target.closest('.choice');
      if (!button) { return; }
      var question = QUESTIONS[state.answers.length];
      if (!question || question.type !== 'choice') { return; }
      submitInterviewAnswer(question.options[Number(button.getAttribute('data-option'))]);
    });

    var textInput = el('interviewText');

    textInput.addEventListener('input', function () {
      // 空欄(空白のみ)では送信できない
      el('interviewSend').disabled = textInput.value.trim() === '';
    });

    textInput.addEventListener('keydown', function (event) {
      if (event.key === 'Enter' && textInput.value.trim() !== '') {
        submitInterviewAnswer(textInput.value.trim());
      }
    });

    el('interviewSend').addEventListener('click', function () {
      var value = textInput.value.trim();
      if (value !== '') { submitInterviewAnswer(value); }
    });

    el('interviewFinish').addEventListener('click', function () {
      state.interviewDone = true;
      saveState();
      showScreen('waiting');
    });
  }
```

- [ ] **Step 4: `app.js` の `init()` に `initInterviewScreen()` を配線する**

`init()` 内の以下の行を、

```js
    initInviteScreen();
```

以下に置き換える。

```js
    initInviteScreen();
    initInterviewScreen();
```

- [ ] **Step 5: ブラウザで目視確認する**

Console で `__demo.reset()` を実行し、招待コードに `TEST` を入れて「登録する」。

期待する結果:
- ヘッダーが「AIインタビュー」、右に「1 / 6」、その下にピンク〜ワインレッドの進捗バー(幅0%)
- 左寄せ・淡いピンク背景の吹き出しで導入メッセージ「はじめまして。あなたのAIアバターです。これから6つだけ質問させてください。あなたの答え方や考え方を学んで、私があなたの代わりに相手と話します。」が出る
- その下に質問1「休日の過ごし方に近いのはどちらですか?」の吹き出しと、3つの選択肢ボタン(外に出かけて人と会う / 家でゆっくり自分の時間 / 日によって半々くらい)
- 下部タブバー・ヘッダーが表示されていない
- 選択肢をタップ → 選択肢ボタンが消え、右寄せ・ワインレッド背景・白文字の吹き出しとして履歴に追加され、「…」のタイピング演出の約0.6秒後に質問2が出る。進捗が「2 / 6」、バーが約17%に伸びる
- 質問3(自由記述「最近、思わず時間を忘れて夢中になったことは何ですか?」)では画面下部に入力欄+「送信」ボタンが出る。**空欄では送信ボタンがグレーで押せない**。半角スペースだけ入れても押せない
- 入力して送信 → 履歴に追加され、質問4へ進む
- 質問6まで回答すると、締めのメッセージ「ありがとうございます。あなたのことが分かってきました。あとは私にまかせて、ゆっくり休んでください。」と「アバターにまかせる」ボタンが出て、進捗が「6 / 6」、バーが100%になる
- 新しい質問が出るたびに最下部までスクロールする
- 「アバターにまかせる」→ 空の待機画面へ遷移し、下部タブバーとヘッダーが表示される(中身は Task 6 で実装)

- [ ] **Step 6: 途中リロードからの再開を目視確認する**

`__demo.reset()` → 登録 → 質問を3問だけ回答した状態で、ブラウザをリロードする。

期待する結果: インタビュー画面が復元され、導入メッセージ+回答済み3問の履歴が積み上がった状態で、質問4から続けられる。Console にエラーが出ない。

- [ ] **Step 7: コミットする**

```bash
cd "C:/Users/ユーザー/Desktop/Cursor_ClaudeCode/260812_Avatar_Matching_ver2"
git add index.html style.css app.js
git commit -m "feat: AIインタビュー画面(全6問・タイピング演出・途中再開)を実装

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 6: アバター会話中(待機)画面 (`waiting`)

**Files:**
- Modify: `index.html`(`<section class="screen" data-screen="waiting" tabindex="-1"></section>` を置き換え)
- Modify: `style.css`(末尾にヒーローカード・ステップインジケーター・待機画面のスタイルを追加)
- Modify: `app.js`(待機画面のセクションを追加)

**Interfaces:**
- Consumes: Task 2 の `el` / `esc` / `state` / `saveState` / `showScreen` / `renderers` / `STEPS` / `currentStepIndex` / `waitingTimer` / `clearWaitingTimer`、Task 3 の `showToast` / `updateBellBadge`
- Produces:
  - `function heroCardHTML(withHotspot: boolean): string` — ヒーローカードのHTML(Task 10 のホーム画面でも使う)
  - `function stepsHTML(): string` — 5段階ステップインジケーターのHTML(Task 10 のホーム画面でも使う)
  - `function startWaitingTimer(): void` / `function completeWaiting(): void`
  - `renderers.waiting`
  - DOM id: `waitingBody` `waitingHotspot`(ヒーロー内の隠し長押し領域) `waitingToNotifications`

- [ ] **Step 1: `index.html` の `waiting` セクションを置き換える**

`<section class="screen" data-screen="waiting" tabindex="-1"></section>` を以下で置き換える。

```html
      <section class="screen" data-screen="waiting" tabindex="-1">
        <div id="waitingBody"></div>
      </section>
```

- [ ] **Step 2: `style.css` の末尾にヒーロー・ステップ・待機画面のスタイルを追加する**

```css
/* ==========================================================================
   ヒーローカード / ステップインジケーター / 現在の状況カード
   (待機画面とホーム画面で共有)
   ========================================================================== */
.hero {
  position: relative;
  display: flex; align-items: center; gap: 8px;
  padding: 18px 16px;
  margin-bottom: 12px;
  border: 1px solid var(--border);
  border-radius: var(--radius-card);
  background: linear-gradient(135deg, var(--bg-hero-a), var(--bg-hero-b));
  box-shadow: var(--shadow-card);
  overflow: hidden;
}
.hero__text { flex: 1 1 auto; min-width: 0; }
.hero__lead { font-size: 13px; line-height: 1.7; margin: 0; }
.hero__art {
  position: relative; flex: none;
  width: 96px; height: 96px;
  display: flex; align-items: center; justify-content: center;
}
.hero__img { max-width: 100%; max-height: 100%; }
.hero__icon { width: 64px; height: 64px; color: var(--plum); }
.hero__art.has-img .hero__icon { display: none; }
/* 展示会用の隠しショートカット領域。視覚的な変化は出さない */
.hero__hotspot { position: absolute; right: 0; bottom: 0; width: 56px; height: 44px; }

.status-card__head { display: flex; align-items: flex-start; gap: 12px; }
.status-card__pulse { animation: pulse 2s ease-out infinite; }
@keyframes pulse {
  0%, 100% { box-shadow: 0 0 0 0 rgba(163, 43, 85, 0.18); }
  50%      { box-shadow: 0 0 0 10px rgba(163, 43, 85, 0); }
}

.steps { list-style: none; display: flex; margin: 18px 0 0; padding: 0; }
.step {
  position: relative; flex: 1 1 0;
  display: flex; flex-direction: column; align-items: center; gap: 6px;
  text-align: center;
}
.step::before {
  content: "";
  position: absolute; top: 22px; left: -50%; right: 50%;
  border-top: 1px dotted var(--text-sub);
}
.step:first-child::before { display: none; }
.step--done::before, .step--current::before { border-top: 1px solid var(--wine); }
.step__mark {
  position: relative; z-index: 1;
  width: 44px; height: 44px;
  display: flex; align-items: center; justify-content: center;
  border-radius: 50%;
  background: var(--step-todo); color: var(--text-sub);
}
.step--done .step__mark    { background: var(--pink); color: var(--text-onwine); }
.step--current .step__mark { background: var(--wine); color: var(--text-onwine); }
.step__label { font-size: 10px; line-height: 1.3; color: var(--text-sub); }
.step--current .step__label { color: var(--wine); font-weight: 700; }
```

- [ ] **Step 3: `app.js` に待機画面のセクションを追加する**

`/* =======================================================================
     ブラウザ離脱防止ガード(§7.2)` のコメントブロックの**直前**に以下を挿入する。

```js
  /* =======================================================================
     ヒーローカード / ステップインジケーター(待機画面とホーム画面で共有)
     ======================================================================= */

  // withHotspot: true のとき、右下に隠しショートカット領域を含める(待機画面のみ)
  function heroCardHTML(withHotspot) {
    return '' +
      '<div class="hero">' +
        '<div class="hero__text">' +
          '<h1 class="hero-title" data-autofocus tabindex="-1">AIが代わりに会っている。</h1>' +
          '<p class="hero__lead">あなたのAIアバターが相手のアバターと会話し、相性を確かめています。</p>' +
        '</div>' +
        '<div class="hero__art">' +
          '<img class="hero__img" src="assets/hero.png" alt="" ' +
               'onload="this.parentNode.classList.add(\'has-img\')" onerror="this.remove()">' +
          '<svg class="icon hero__icon" aria-hidden="true" focusable="false"><use href="#i-avatar-pair"></use></svg>' +
        '</div>' +
        (withHotspot ? '<span class="hero__hotspot" id="waitingHotspot" aria-hidden="true"></span>' : '') +
      '</div>';
  }

  function stepsHTML() {
    var current = currentStepIndex(state);
    return '<ol class="steps">' + STEPS.map(function (step, index) {
      var status = index < current ? 'done' : (index === current ? 'current' : 'todo');
      var iconId = index < current ? 'i-check' : step.icon;
      return '<li class="step step--' + status + '">' +
               '<span class="step__mark"><svg class="icon" aria-hidden="true" focusable="false"><use href="#' + iconId + '"></use></svg></span>' +
               '<span class="step__label">' + esc(step.label) + '</span>' +
             '</li>';
    }).join('') + '</ol>';
  }

  /* =======================================================================
     [3] アバター会話中(待機)画面
     ======================================================================= */

  function startWaitingTimer() {
    clearWaitingTimer();
    waitingTimer = setTimeout(completeWaiting, 6000);
  }

  function completeWaiting() {
    clearWaitingTimer();
    if (state.notified) { return; }

    state.notified = true;
    saveState();

    if (state.currentScreen === 'waiting') { renderers.waiting(); }
    updateBellBadge();
    showToast('新しいマッチ候補がいます', function () { showScreen('report'); });
  }

  // 展示会での事故防止として、ヒーローカード右下の目立たない領域の長押し(700ms)で
  // 待機を即座に完了させる。対象領域を絞って誤発火を防ぐ
  function attachWaitingShortcut() {
    var hotspot = el('waitingHotspot');
    if (!hotspot) { return; }

    var pressTimer = null;
    function startPress() {
      clearTimeout(pressTimer);
      pressTimer = setTimeout(completeWaiting, 700);
    }
    function cancelPress() { clearTimeout(pressTimer); }

    hotspot.addEventListener('pointerdown', startPress);
    hotspot.addEventListener('pointerup', cancelPress);
    hotspot.addEventListener('pointerleave', cancelPress);
    hotspot.addEventListener('pointercancel', cancelPress);
  }

  renderers.waiting = function () {
    el('waitingBody').innerHTML =
      heroCardHTML(true) +
      '<div class="card status-card">' +
        '<div class="status-card__head">' +
          '<span class="icon-circle status-card__pulse"><svg class="icon" aria-hidden="true" focusable="false"><use href="#i-avatar-pair"></use></svg></span>' +
          '<div>' +
            '<p class="card-title">アバターが会話中です</p>' +
            '<p class="text-body">あなたのアバターが、複数の候補アバターと会話を進めています。</p>' +
          '</div>' +
        '</div>' +
        stepsHTML() +
      '</div>' +
      '<p class="text-note">相性の基準を満たしたときだけ通知が届きます。基準に満たない場合は、何も起きません。</p>' +
      (state.notified
        ? '<button type="button" class="btn btn--primary waiting__cta" id="waitingToNotifications">お知らせを見る</button>'
        : '');

    if (state.notified) {
      el('waitingToNotifications').addEventListener('click', function () { showScreen('notifications'); });
    }

    attachWaitingShortcut();

    // 通知済みなら演出を再生せず、通知済みの表示状態で描画するだけにする
    if (!state.notified) { startWaitingTimer(); }
  };
```

- [ ] **Step 4: `style.css` の末尾に待機画面のCTAスタイルを追加する**

```css
/* ==========================================================================
   [3] アバター会話中(待機)画面
   ========================================================================== */
.waiting__cta { margin-top: 16px; }
```

- [ ] **Step 5: ブラウザで待機と自動通知を目視確認する**

`__demo.reset()` → 招待コード `TEST` で登録 → 全6問を回答 → 「アバターにまかせる」。

期待する結果:
- ピンク〜プラムのグラデーションのヒーローカードに「AIが代わりに会っている。」(ワインレッド26px)と「あなたのAIアバターが相手のアバターと会話し、相性を確かめています。」、右側に2人並んだ線画アイコン
- 白いカードに「アバターが会話中です」「あなたのアバターが、複数の候補アバターと会話を進めています。」、左のアイコン円が2秒周期で淡く明滅する
- 5段階のステップインジケーター。1「登録完了」と2「インタビュー完了」がピンク塗り+白チェック、3「アバターが会話中」がワインレッド塗り+ラベルもワインレッドの太字、4「相性が高い時に通知」と5「会話ログを読んで判断」がグレー。1→3の接続線が実線、3→4と4→5が点線
- その下に「相性の基準を満たしたときだけ通知が届きます。基準に満たない場合は、何も起きません。」
- **約6秒後**、画面上部に白いバナー「新しいマッチ候補がいます」がスライドインする。ヘッダーのベルに「2」のバッジが付く。ステップ4「相性が高い時に通知」が現在ステップ(ワインレッド)に変わる。画面下部に「お知らせを見る」ボタンが現れる
- バナーは約4秒後に自動的に消える
- 「お知らせを見る」→ 空のお知らせ一覧画面へ遷移する(中身は Task 7 で実装)

- [ ] **Step 6: 通知バナーのタップと再訪時の挙動を目視確認する**

`__demo.reset()` からもう一度待機画面まで進め、通知バナーが出たら**バナーをクリック**する。期待する結果: バナーが消え、`report` 画面(空)へ遷移する。

続けてホームタブ→メッセージタブなど他画面へ移動してから、Console で `__demo.showScreen('waiting')` を実行する。期待する結果: 通知バナーは再生されず、「お知らせを見る」ボタンが出た通知済みの状態で描画される。

- [ ] **Step 7: リロード再開とタイマー解除を目視確認する**

`__demo.reset()` から待機画面に入り、通知が来る前(6秒以内)にリロードする。期待する結果: 待機画面が復元され、改めて約6秒後に通知バナーが出る。

次に、`__demo.reset()` から待機画面に入り、6秒経つ前に下部タブの「マイページ」をクリックする。10秒ほど待つ。期待する結果: 通知バナーが出ない(タイマーが解除されている)。Console で `__demo.state.notified` が `false`。

- [ ] **Step 8: 長押しショートカットと誤発火防止を目視確認する**

`__demo.reset()` から待機画面に入り、ヒーローカードの**右下の角**(2人アイコンの右下あたり、幅56px×高さ44px)をマウスで押し続ける。

期待する結果: 約0.7秒で通知バナーが出る(6秒待たずに完了する)。

続けて `__demo.reset()` から待機画面に入り、以下を行う。

- 説明文「あなたのAIアバターが相手のアバターと会話し、相性を確かめています。」の上を1秒以上押し続ける → **通知は出ない**
- 「相性の基準を満たしたときだけ通知が届きます。」の付近を押しながら上下にドラッグ(スクロール) → **通知は出ない**
- ヒーロー右下を押した状態のまま指/カーソルを領域外へ動かして離す → **通知は出ない**

- [ ] **Step 9: コミットする**

```bash
cd "C:/Users/ユーザー/Desktop/Cursor_ClaudeCode/260812_Avatar_Matching_ver2"
git add index.html style.css app.js
git commit -m "feat: 待機画面(6秒タイマー・通知演出・長押しショートカット)を実装

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 7: お知らせ一覧画面 (`notifications`)

**Files:**
- Modify: `index.html`(`<section class="screen" data-screen="notifications" tabindex="-1"></section>` を置き換え)
- Modify: `style.css`(末尾にお知らせ一覧のスタイルを追加)
- Modify: `app.js`(お知らせ一覧画面のセクションを追加、`init()` に配線)

**Interfaces:**
- Consumes: Task 2 の `el` / `esc` / `state` / `showScreen` / `renderers` / `NOTIFICATIONS` / `init()`、Task 3 の `markNotificationRead`
- Produces: `renderers.notifications`、`function initNotificationsScreen(): void`、DOM id: `notificationsBody`、CSSクラス `.notice` 系(Task 10 のホーム画面のお知らせカードでも `.notice__time` `.notice__chevron` を再利用する)

- [ ] **Step 1: `index.html` の `notifications` セクションを置き換える**

`<section class="screen" data-screen="notifications" tabindex="-1"></section>` を以下で置き換える。

```html
      <section class="screen" data-screen="notifications" tabindex="-1">
        <h1 class="screen-title" data-autofocus tabindex="-1">お知らせ</h1>
        <div id="notificationsBody"></div>
      </section>
```

- [ ] **Step 2: `style.css` の末尾にお知らせ一覧のスタイルを追加する**

```css
/* ==========================================================================
   [4] お知らせ一覧画面
   ========================================================================== */
.notice {
  width: 100%;
  display: flex; align-items: flex-start; gap: 12px;
  text-align: left;
  font-family: inherit; color: var(--text-main);
  cursor: pointer;
}
.notice__body { flex: 1 1 auto; min-width: 0; display: block; }
.notice__title {
  display: flex; align-items: center; gap: 6px;
  font-size: 15px; font-weight: 600; line-height: 1.5;
}
.notice__dot { width: 8px; height: 8px; border-radius: 50%; background: var(--wine); flex: none; }
.notice__text { display: block; font-size: 14px; line-height: 1.7; }
.notice__time { display: block; font-size: 12px; color: var(--text-sub); }
.notice__chevron { flex: none; width: 20px; height: 20px; color: var(--text-sub); align-self: center; }
.notice.is-unread { border-color: var(--pink); }
```

- [ ] **Step 3: `app.js` にお知らせ一覧画面のセクションを追加する**

`/* =======================================================================
     ブラウザ離脱防止ガード(§7.2)` のコメントブロックの**直前**に以下を挿入する。

```js
  /* =======================================================================
     [4] お知らせ一覧画面
     ======================================================================= */

  renderers.notifications = function () {
    var body = el('notificationsBody');

    // 未通知のときはリストの代わりに空状態を出す(例外を投げない)
    if (!state.notified) {
      body.innerHTML =
        '<div class="card empty">' +
          '<span class="icon-circle"><svg class="icon" aria-hidden="true" focusable="false"><use href="#i-bell"></use></svg></span>' +
          '<p class="text-body">まだお知らせはありません。アバターが会話を続けています。</p>' +
        '</div>';
      return;
    }

    body.innerHTML = NOTIFICATIONS.map(function (item) {
      var unread = state.readNotificationIds.indexOf(item.id) === -1;
      return '<button type="button" class="card notice' + (unread ? ' is-unread' : '') + '" data-notification="' + item.id + '">' +
               '<span class="icon-circle"><svg class="icon" aria-hidden="true" focusable="false"><use href="#i-' + item.icon + '"></use></svg></span>' +
               '<span class="notice__body">' +
                 '<span class="notice__title">' +
                   (unread ? '<span class="notice__dot" aria-hidden="true"></span><span class="sr-only">未読</span>' : '') +
                   esc(item.title) +
                 '</span>' +
                 '<span class="notice__text">' + esc(item.body) + '</span>' +
                 '<span class="notice__time">' + esc(item.time) + '</span>' +
               '</span>' +
               '<svg class="icon notice__chevron" aria-hidden="true" focusable="false"><use href="#i-chevron"></use></svg>' +
             '</button>';
    }).join('');
  };

  function initNotificationsScreen() {
    el('notificationsBody').addEventListener('click', function (event) {
      var button = event.target.closest('[data-notification]');
      if (!button) { return; }
      // デモの単純化のため、どちらのカードも遷移先は report
      markNotificationRead(button.getAttribute('data-notification'));
      showScreen('report');
    });
  }
```

- [ ] **Step 4: `app.js` の `init()` に `initNotificationsScreen()` を配線する**

`init()` 内の以下の行を、

```js
    initInterviewScreen();
```

以下に置き換える。

```js
    initInterviewScreen();
    initNotificationsScreen();
```

- [ ] **Step 5: ブラウザで目視確認する**

`__demo.reset()` → 登録 → 全6問回答 → 待機画面で通知を受ける(ヒーロー右下の長押しで短縮してよい)→「お知らせを見る」。

期待する結果:
- 「お知らせ」というタイトルの下に2件のカードが並ぶ
  1. ベルアイコン+「新しいマッチ候補がいます」/「相性基準を満たしたペアが見つかりました。」/「2時間前」
  2. 書類アイコン+「相性レポートが準備できました」/「会話ログと相性レポートを確認できます。」/「5時間前」
- 各カードの右端に右向きシェブロン。未読の2件はタイトル左にワインレッドの小さなドットがあり、カードの枠がピンク寄り
- ヘッダーのベルバッジが「2」
- 1件目をタップ → `report` 画面(空)へ遷移する。戻って(下部タブ「メッセージ」)確認すると、1件目のドットが消え、ベルバッジが「1」になっている
- 2件目もタップすると、ベルバッジが消える
- 下部タブ「メッセージ」がアクティブ表示になっている

続けて Console で以下を実行する。

```js
__demo.state.notified = false; __demo.showScreen('notifications')
```

期待する結果: リストの代わりに、中央寄せの「まだお知らせはありません。アバターが会話を続けています。」の空状態カードが表示される。ベルバッジは非表示。

- [ ] **Step 6: コミットする**

```bash
cd "C:/Users/ユーザー/Desktop/Cursor_ClaudeCode/260812_Avatar_Matching_ver2"
git add index.html style.css app.js
git commit -m "feat: お知らせ一覧画面(未読管理・空状態)を実装

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 8: 会話ログ・相性レポート画面 (`report`) と辞退完了画面 (`declined`)

**Files:**
- Modify: `index.html`(`report` と `declined` の2つの `<section>` を置き換え)
- Modify: `style.css`(末尾にレポート画面・辞退画面のスタイルを追加)
- Modify: `app.js`(レポート画面のセクションを追加、`init()` に配線)

**Interfaces:**
- Consumes: Task 2 の `el` / `esc` / `state` / `saveState` / `showScreen` / `renderers` / `PARTNER` / `init()`、Task 3 の `openSheet` / `showLoading` / `hideLoading`
- Produces:
  - `renderers.report`
  - `function initReportScreen(): void`
  - `function logBubbleHTML(turn: {speaker, text}): string`
  - `function partnerHeaderHTML(): string` / `function conversationHTML(): string` / `function axesHTML(): string` / `function summaryHTML(): string` / `function decisionHTML(): string` / `function animateBars(): void` / `function acceptMatch(): void`
  - DOM id: `reportBody` `reportAccept` `reportDecline` `declinedReopen`

- [ ] **Step 1: `index.html` の `report` と `declined` セクションを置き換える**

`<section class="screen" data-screen="report" tabindex="-1"></section>` を以下で置き換える。

```html
      <section class="screen" data-screen="report" tabindex="-1">
        <div id="reportBody"></div>
      </section>
```

`<section class="screen" data-screen="declined" tabindex="-1"></section>` を以下で置き換える。

```html
      <section class="screen" data-screen="declined" tabindex="-1">
        <h1 class="screen-title" data-autofocus tabindex="-1">辞退しました</h1>
        <div class="card">
          <p class="text-body">辞退しました。相手には通知されません。アバターは引き続き会話を続けます。</p>
        </div>
        <button type="button" class="btn btn--primary" data-go="home">ホームに戻る</button>
        <p class="declined__demo"><button type="button" class="btn-link" id="declinedReopen">デモ用: もう一度レポートを見る</button></p>
      </section>
```

- [ ] **Step 2: `style.css` の末尾にレポート画面・辞退画面のスタイルを追加する**

```css
/* ==========================================================================
   [5] 会話ログ・相性レポート画面 / 辞退完了画面
   ========================================================================== */
.partner__row { display: flex; align-items: center; gap: 12px; }
.partner__meta { flex: 1 1 auto; min-width: 0; }
.partner__name { font-size: 18px; font-weight: 700; line-height: 1.35; margin: 0; }
.partner__sub { font-size: 12px; color: var(--text-sub); margin: 2px 0 0; }

.log__title { margin: 0 0 10px; font-size: 14px; color: var(--text-sub); }
.chat--log { gap: 8px; }
.bubble__who { display: block; font-size: 11px; font-weight: 700; opacity: .75; margin-bottom: 2px; }

.axis__head { display: flex; align-items: baseline; justify-content: space-between; gap: 8px; margin-bottom: 8px; }
.axis__label { font-size: 15px; font-weight: 600; }
.axis__hint {
  display: inline-block; margin-left: 6px; padding: 1px 8px;
  border-radius: var(--radius-pill);
  background: var(--track); color: var(--text-sub);
  font-size: 11px; font-weight: 500;
}
.axis__score { font-size: 18px; font-weight: 700; color: var(--wine); }
.axis__comment { margin-top: 10px; }
.axis__quote {
  margin: 8px 0 0;
  font-size: 12px; font-style: italic; line-height: 1.7;
  color: var(--text-sub);
}

.bar { height: 8px; border-radius: var(--radius-pill); background: var(--track); overflow: hidden; }
.bar__fill {
  height: 100%; width: 0;
  border-radius: var(--radius-pill);
  background: linear-gradient(90deg, var(--wine), var(--pink));
  transition: width .7s ease-out;
}
.bar__fill--neutral { background: var(--neutral-bar); }

.decision__note { margin: 0 0 12px; }
.declined__demo { text-align: center; margin: 10px 0 0; }
```

- [ ] **Step 3: `app.js` にレポート画面のセクションを追加する**

`/* =======================================================================
     ブラウザ離脱防止ガード(§7.2)` のコメントブロックの**直前**に以下を挿入する。

```js
  /* =======================================================================
     [5] 会話ログ・相性レポート画面
     ======================================================================= */

  function partnerHeaderHTML() {
    return '' +
      '<div class="card partner">' +
        '<div class="partner__row">' +
          '<span class="icon-circle icon-circle--lg"><svg class="icon icon--lg" aria-hidden="true" focusable="false"><use href="#i-user"></use></svg></span>' +
          '<div class="partner__meta">' +
            '<h1 class="partner__name" data-autofocus tabindex="-1">' + esc(PARTNER.anonymousLabel) + '</h1>' +
            '<p class="partner__sub">実名・所属は非表示です</p>' +
          '</div>' +
          '<span class="badge">相性 ' + PARTNER.compatibility + '%</span>' +
        '</div>' +
        '<p class="text-note">※お互いが「会う」を選ぶまで、実名・所属は表示されません。</p>' +
      '</div>';
  }

  function logBubbleHTML(turn) {
    var isSelf = turn.speaker === 'self';
    return '<div class="bubble bubble--' + (isSelf ? 'self' : 'ai') + '">' +
             '<span class="bubble__who">' + (isSelf ? 'あなたのアバター' : 'お相手のアバター') + '</span>' +
             esc(turn.text) +
           '</div>';
  }

  function conversationHTML() {
    return '' +
      '<div class="card log">' +
        '<h2 class="section-title log__title">' + esc(PARTNER.conversation.timeLabel) + '</h2>' +
        '<div class="chat chat--log">' + PARTNER.conversation.turns.map(logBubbleHTML).join('') + '</div>' +
        '<p class="text-note">これは、あなたが寝ている間にAIアバター同士が交わした会話です。</p>' +
      '</div>';
  }

  function axesHTML() {
    return '<h2 class="section-title">相性レポート</h2>' + PARTNER.axes.map(function (axis) {
      return '<div class="card axis">' +
               '<div class="axis__head">' +
                 '<span class="axis__label">' + esc(axis.label) +
                   (axis.invertedGood ? '<span class="axis__hint">低いほど良い</span>' : '') +
                 '</span>' +
                 '<span class="axis__score">' + axis.score + '</span>' +
               '</div>' +
               '<div class="bar" role="img" aria-label="' + esc(axis.label) + ' ' + axis.score + ' / 100">' +
                 '<div class="bar__fill' + (axis.invertedGood ? ' bar__fill--neutral' : '') + '" data-score="' + axis.score + '"></div>' +
               '</div>' +
               '<p class="text-body axis__comment">' + esc(axis.comment) + '</p>' +
               '<p class="axis__quote">' + esc(axis.quote) + '</p>' +
             '</div>';
    }).join('');
  }

  function summaryHTML() {
    return '<div class="card">' +
             '<h2 class="section-title section-title--flush">総評</h2>' +
             '<p class="text-body">' + esc(PARTNER.summary) + '</p>' +
           '</div>';
  }

  function decisionHTML() {
    if (state.decision === 'accept') {
      return '<div class="card decision">' +
               '<p class="card-title">あなたは「会う」を選択済みです</p>' +
               '<button type="button" class="btn btn--primary" data-go="reveal">開示情報を見る</button>' +
             '</div>';
    }
    return '<div class="card decision">' +
             '<p class="text-note decision__note">あなたの判断は相手には通知されません。両者が「会う」を選んだ場合のみ、お互いに開示されます。</p>' +
             '<button type="button" class="btn btn--primary" id="reportAccept">会う</button>' +
             '<button type="button" class="btn btn--secondary" id="reportDecline">今回は辞退する</button>' +
           '</div>';
  }

  // 表示時に width を 0 から目標値へトランジションさせる
  function animateBars() {
    var fills = el('reportBody').querySelectorAll('.bar__fill');
    requestAnimationFrame(function () {
      for (var i = 0; i < fills.length; i++) {
        fills[i].style.width = fills[i].getAttribute('data-score') + '%';
      }
    });
  }

  function acceptMatch() {
    state.decision = 'accept';
    saveState();
    showLoading('お相手も「会う」を選んでいます');
    setTimeout(function () {
      hideLoading();
      showScreen('reveal');
    }, 800);
  }

  function declineMatch() {
    openSheet({
      title: '辞退の確認',
      message: '辞退すると、このお相手の情報は表示されなくなります。よろしいですか?',
      confirmLabel: '辞退する',
      danger: true,
      onConfirm: function () {
        state.decision = 'decline';
        saveState();
        showScreen('declined');
      }
    });
  }

  renderers.report = function () {
    var body = el('reportBody');

    // 未通知でこの画面に来た場合は空状態を出す(例外を投げない)
    if (!state.notified) {
      body.innerHTML =
        '<h1 class="screen-title" data-autofocus tabindex="-1">相性レポート</h1>' +
        '<div class="card empty">' +
          '<p class="text-body">まだレポートはありません。アバターが会話を続けています。</p>' +
          '<button type="button" class="btn btn--secondary" data-go="home">ホームに戻る</button>' +
        '</div>';
      return;
    }

    body.innerHTML =
      partnerHeaderHTML() +
      conversationHTML() +
      axesHTML() +
      summaryHTML() +
      decisionHTML();

    var accept = el('reportAccept');
    if (accept) { accept.addEventListener('click', acceptMatch); }
    var decline = el('reportDecline');
    if (decline) { decline.addEventListener('click', declineMatch); }

    animateBars();
  };

  function initReportScreen() {
    el('declinedReopen').addEventListener('click', function () {
      // デモ復帰用: 判断を取り消してレポートへ戻る
      state.decision = null;
      saveState();
      showScreen('report');
    });
  }
```

- [ ] **Step 4: `style.css` の空状態カード内のボタンに余白を足す**

`style.css` 末尾に以下を追加する。

```css
.empty .btn { margin-top: 14px; }
```

- [ ] **Step 5: `app.js` の `init()` に `initReportScreen()` を配線する**

`init()` 内の以下の行を、

```js
    initNotificationsScreen();
```

以下に置き換える。

```js
    initNotificationsScreen();
    initReportScreen();
```

- [ ] **Step 6: レポート画面の表示をブラウザで目視確認する**

`__demo.reset()` → 登録 → 全6問回答 → 待機(長押しで短縮可)→ お知らせカードをタップ。

期待する結果(上から順に):
- 大きなアイコン円+「お相手 A さん」+「実名・所属は非表示です」+ 右に淡ピンクの「相性 82%」バッジ。その下に「※お互いが『会う』を選ぶまで、実名・所属は表示されません。」
- 会話ログのカード。見出し「昨夜 2:14 – 2:17 の会話より抜粋」、9つの吹き出しが左右交互(あなたのアバター=右・ワインレッド・白文字、お相手のアバター=左・淡ピンク)。各吹き出しの上に小さく話者名。最後に「これは、あなたが寝ている間にAIアバター同士が交わした会話です。」
- 「相性レポート」見出しの下に5枚のカード
  - 会話の弾み 88 /「沈黙がなく、互いに話題を足し合っていました。」/ 斜体の引用「分かります。ちなみに、最近何かに夢中になったことはありますか。」
  - 価値観の一致 84 /「休日の過ごし方や、大切にしたい時間の使い方が重なっています。」
  - ユーモアの相性 79 /「軽さを求める姿勢が一致。実際の笑いの相性は対面での確認が必要です。」
  - 相互関心 86 /「一方的にならず、双方が相手に質問を返していました。」
  - 不一致の重大度 24 / ラベル横に「低いほど良い」のグレーのピル / バーがグレー単色 /「将来設計の温度差はありますが、方向性の対立ではありません。」
- 5本のバーが表示時に 0 から目標値まで約0.7秒で伸びる(画面に入り直すたびに再生される)
- 「総評」カードに「価値観と生活リズムの重なりが大きく、会話のテンポも自然でした。相違点はありますが、関係を妨げるほどではありません。」
- 判断カードに注記「あなたの判断は相手には通知されません。両者が『会う』を選んだ場合のみ、お互いに開示されます。」+ ワインレッド塗りの「会う」+ 枠線のみの「今回は辞退する」
- 画面のどこにも「山田 花子」が出ていない(Ctrl+F で確認)

- [ ] **Step 7: 「会う」の分岐を目視確認する**

「会う」をタップする。

期待する結果: 「お相手も『会う』を選んでいます」のローディングが約0.8秒表示された後、`reveal` 画面(空)へ遷移する(中身は Task 9 で実装)。

下部タブ「ホーム」→ Console で `__demo.showScreen('report')` を実行する。期待する結果: 判断ボタンの代わりに「あなたは『会う』を選択済みです」+「開示情報を見る」ボタンが表示される。

- [ ] **Step 8: 「辞退する」の分岐を目視確認する**

Console で `__demo.state.decision = null` を実行し、`__demo.showScreen('report')` でレポートへ戻る。「今回は辞退する」をタップする。

期待する結果:
- 画面下部からシートが現れ、「辞退の確認」「辞退すると、このお相手の情報は表示されなくなります。よろしいですか?」+ 赤い「辞退する」+「キャンセル」。`window.confirm` のブラウザ標準ダイアログではない
- 「キャンセル」または暗幕タップ → シートが閉じ、レポート画面に留まる
- もう一度「今回は辞退する」→「辞退する」を確定 → 辞退完了画面が表示され、「辞退しました。相手には通知されません。アバターは引き続き会話を続けます。」「ホームに戻る」「デモ用: もう一度レポートを見る」がある
- 「デモ用: もう一度レポートを見る」→ レポート画面に戻り、「会う」「今回は辞退する」の判断ボタンが再び表示される。Console で `__demo.state.decision` が `null`

- [ ] **Step 9: 未通知時の空状態を目視確認する**

Console で以下を実行する。

```js
__demo.state.notified = false; __demo.state.decision = null; __demo.showScreen('report')
```

期待する結果: 「相性レポート」の見出しと「まだレポートはありません。アバターが会話を続けています。」+「ホームに戻る」ボタンが表示され、Console にエラーが出ない。

- [ ] **Step 10: コミットする**

```bash
cd "C:/Users/ユーザー/Desktop/Cursor_ClaudeCode/260812_Avatar_Matching_ver2"
git add index.html style.css app.js
git commit -m "feat: 会話ログ・相性レポート画面と辞退完了画面を実装

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 9: 実名開示画面 (`reveal`) と完了画面 (`done`)

**Files:**
- Modify: `index.html`(`reveal` と `done` の2つの `<section>` を置き換え)
- Modify: `style.css`(末尾に開示画面・完了画面のスタイルを追加)
- Modify: `app.js`(実名開示画面のセクションを追加)

**Interfaces:**
- Consumes: Task 2 の `el` / `esc` / `state` / `saveState` / `showScreen` / `renderers` / `PARTNER`
- Produces: `renderers.reveal`、DOM id: `revealBody` `revealCard` `revealSchedule`

- [ ] **Step 1: `index.html` の `reveal` と `done` セクションを置き換える**

`<section class="screen" data-screen="reveal" tabindex="-1"></section>` を以下で置き換える。

```html
      <section class="screen" data-screen="reveal" tabindex="-1">
        <div id="revealBody"></div>
      </section>
```

`<section class="screen" data-screen="done" tabindex="-1"></section>` を以下で置き換える。

```html
      <section class="screen" data-screen="done" tabindex="-1">
        <div class="card done-card">
          <span class="icon-circle icon-circle--lg"><svg class="icon icon--lg" aria-hidden="true" focusable="false"><use href="#i-check"></use></svg></span>
          <h1 class="screen-title" data-autofocus tabindex="-1">日程を送信しました</h1>
          <p class="text-body">日程を送信しました。当日の会場・時間は追ってお知らせします。</p>
        </div>
        <button type="button" class="btn btn--primary" data-go="home">ホームに戻る</button>
      </section>
```

- [ ] **Step 2: `style.css` の末尾に開示画面・完了画面のスタイルを追加する**

```css
/* ==========================================================================
   [6] 実名開示画面 / 完了画面
   ========================================================================== */
.reveal-card {
  text-align: center;
  opacity: 0;
  transform: translateY(16px);
  transition: opacity .6s ease-out, transform .6s ease-out;
}
.reveal-card.is-shown { opacity: 1; transform: none; }
.reveal-card .icon-circle { margin: 0 auto 14px; }

.reveal-list { margin: 0; text-align: left; }
.reveal-row {
  display: flex; gap: 12px;
  padding: 10px 0;
  border-top: 1px solid var(--border);
}
.reveal-row:first-child { border-top: 0; }
.reveal-row dt { flex: none; width: 56px; font-size: 12px; font-weight: 600; color: var(--text-sub); }
.reveal-row dd { flex: 1 1 auto; margin: 0; font-size: 14px; font-weight: 600; }

.slot {
  width: 100%;
  display: flex; align-items: center; gap: 12px;
  text-align: left;
  font-family: inherit; color: var(--text-main);
  cursor: pointer;
}
.slot__body { flex: 1 1 auto; min-width: 0; display: block; }
.slot__label { display: block; font-size: 15px; font-weight: 600; line-height: 1.5; }
.slot__place { display: block; font-size: 12px; color: var(--text-sub); }
.slot.is-selected { border-color: var(--wine); background: var(--pink-soft); }
.slot.is-selected .icon-circle { background: var(--wine); color: var(--text-onwine); }

.reveal__cta { margin-top: 4px; }

.done-card { text-align: center; padding: 32px 16px; margin-top: 40px; }
.done-card .icon-circle { margin: 0 auto 14px; background: var(--wine); color: var(--text-onwine); }
```

- [ ] **Step 3: `app.js` に実名開示画面のセクションを追加する**

`/* =======================================================================
     ブラウザ離脱防止ガード(§7.2)` のコメントブロックの**直前**に以下を挿入する。

```js
  /* =======================================================================
     [6] 実名開示画面
     ======================================================================= */

  renderers.reveal = function () {
    var body = el('revealBody');

    // 「会う」を選ぶ前にこの画面へ来た場合は空状態を出す(例外を投げない)
    if (state.decision !== 'accept') {
      body.innerHTML =
        '<h1 class="screen-title" data-autofocus tabindex="-1">開示情報</h1>' +
        '<div class="card empty">' +
          '<p class="text-body">まだ開示できる情報はありません。相性レポートで「会う」を選ぶと表示されます。</p>' +
          '<button type="button" class="btn btn--secondary" data-go="home">ホームに戻る</button>' +
        '</div>';
      return;
    }

    var revealed = PARTNER.revealed;

    body.innerHTML =
      '<h1 class="screen-title" data-autofocus tabindex="-1">お互いが「会う」を選びました</h1>' +
      '<div class="card reveal-card" id="revealCard">' +
        '<span class="icon-circle icon-circle--lg"><svg class="icon icon--lg" aria-hidden="true" focusable="false"><use href="#i-user"></use></svg></span>' +
        '<dl class="reveal-list">' +
          '<div class="reveal-row"><dt>氏名</dt><dd>' + esc(revealed.name) + '</dd></div>' +
          '<div class="reveal-row"><dt>所属</dt><dd>' + esc(revealed.company) + ' / ' + esc(revealed.department) + '</dd></div>' +
          '<div class="reveal-row"><dt>年代</dt><dd>' + esc(revealed.ageRange) + '</dd></div>' +
          '<div class="reveal-row"><dt>一言</dt><dd>' + esc(revealed.message) + '</dd></div>' +
        '</dl>' +
      '</div>' +
      '<h2 class="section-title">面談候補日時</h2>' +
      PARTNER.slots.map(function (slot) {
        var selected = state.selectedSlotId === slot.id;
        return '<button type="button" class="card slot' + (selected ? ' is-selected' : '') + '" ' +
                 'data-slot="' + slot.id + '" aria-pressed="' + (selected ? 'true' : 'false') + '">' +
                 '<span class="icon-circle"><svg class="icon" aria-hidden="true" focusable="false"><use href="#i-calendar"></use></svg></span>' +
                 '<span class="slot__body">' +
                   '<span class="slot__label">' + esc(slot.label) + '</span>' +
                   '<span class="slot__place">' + esc(slot.place) + '</span>' +
                 '</span>' +
               '</button>';
      }).join('') +
      '<button type="button" class="btn btn--primary reveal__cta" id="revealSchedule"' +
        (state.selectedSlotId ? '' : ' disabled') + '>この日時で調整する</button>' +
      '<p class="text-note">開示された情報は、お二人以外には共有されません。人事・運営がこの内容を閲覧することはありません。</p>';

    // 下からフェードイン+わずかにスライドアップ(約600ms)
    requestAnimationFrame(function () { el('revealCard').classList.add('is-shown'); });

    var slotButtons = body.querySelectorAll('[data-slot]');
    for (var i = 0; i < slotButtons.length; i++) {
      slotButtons[i].addEventListener('click', function (event) {
        var button = event.currentTarget;
        state.selectedSlotId = button.getAttribute('data-slot');
        saveState();
        // 開示カードの演出を再生し直さないよう、選択状態だけを差し替える
        for (var j = 0; j < slotButtons.length; j++) {
          var isSelected = slotButtons[j].getAttribute('data-slot') === state.selectedSlotId;
          slotButtons[j].classList.toggle('is-selected', isSelected);
          slotButtons[j].setAttribute('aria-pressed', isSelected ? 'true' : 'false');
        }
        el('revealSchedule').disabled = false;
      });
    }

    el('revealSchedule').addEventListener('click', function () {
      if (!state.selectedSlotId) { return; }
      state.scheduled = true;
      saveState();
      showScreen('done');
    });
  };
```

- [ ] **Step 4: ブラウザで目視確認する**

`__demo.reset()` → 登録 → 全6問回答 → 待機(長押しで短縮可)→ お知らせ → レポート →「会う」。

期待する結果:
- 見出し「お互いが『会う』を選びました」
- 開示カードが下からフェードイン+わずかにスライドアップして現れる(約0.6秒)
- 開示カードに「氏名: 山田 花子(仮名)」「所属: 株式会社カリヤ精機 / 品質保証部」「年代: 30代前半」「一言: 文章を書くのが好きです。よろしくお願いします。」
- 「面談候補日時」の下に3枚のカード
  - 9月5日(土) 13:00 – 14:00 / 刈谷市内 カフェ
  - 9月6日(日) 11:00 – 12:00 / 刈谷市内 カフェ
  - 9月12日(土) 15:00 – 16:00 / 刈谷駅前 ラウンジ
- 未選択の状態では「この日時で調整する」がグレーで押せない
- 日時カードをタップ → 枠がワインレッド、背景が淡ピンク、アイコン円がワインレッド塗りになり、「この日時で調整する」が有効になる。別のカードをタップすると選択が移動する(同時に選ばれない)。**このとき開示カードのフェードイン演出は再生されない**
- 「この日時で調整する」→ 完了画面へ遷移し、ワインレッドの丸いチェックアイコン+「日程を送信しました」+「日程を送信しました。当日の会場・時間は追ってお知らせします。」+「ホームに戻る」
- 「ホームに戻る」→ ホーム画面(空)へ遷移する(中身は Task 10 で実装)
- 開示画面の最下部に「開示された情報は、お二人以外には共有されません。人事・運営がこの内容を閲覧することはありません。」

- [ ] **Step 5: 未承諾時の空状態と復元を目視確認する**

Console で以下を実行する。

```js
__demo.state.decision = null; __demo.showScreen('reveal')
```

期待する結果: 「開示情報」の見出しと「まだ開示できる情報はありません。相性レポートで『会う』を選ぶと表示されます。」+「ホームに戻る」が表示され、Console にエラーが出ない。

続けて「会う」を選び直して日時を選択した状態でリロードする。期待する結果: 開示画面が復元され、選んだ日時が選択状態のまま、「この日時で調整する」が有効になっている。

- [ ] **Step 6: コミットする**

```bash
cd "C:/Users/ユーザー/Desktop/Cursor_ClaudeCode/260812_Avatar_Matching_ver2"
git add index.html style.css app.js
git commit -m "feat: 実名開示画面(面談候補日時の選択)と完了画面を実装

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 10: ホーム画面 (`home`)

**Files:**
- Modify: `index.html`(`<section class="screen" data-screen="home" tabindex="-1"></section>` を置き換え)
- Modify: `style.css`(末尾にホーム画面のスタイルを追加)
- Modify: `app.js`(ホーム画面のセクションを追加)

**Interfaces:**
- Consumes: Task 2 の `el` / `esc` / `state` / `showScreen` / `renderers` / `NOTIFICATIONS`、Task 3 の `markNotificationRead`、Task 6 の `heroCardHTML(withHotspot)` / `stepsHTML()`
- Produces: `renderers.home`、`const HOME_MENU`、`function statusText(): string` / `function statusActionLabel(): string` / `function statusTargetScreen(): string` / `function homeNoticeCardHTML(): string` / `function menuGridHTML(): string`、DOM id: `homeBody` `homeStatusGo`

- [ ] **Step 1: `index.html` の `home` セクションを置き換える**

`<section class="screen" data-screen="home" tabindex="-1"></section>` を以下で置き換える。

```html
      <section class="screen" data-screen="home" tabindex="-1">
        <div id="homeBody"></div>
      </section>
```

- [ ] **Step 2: `style.css` の末尾にホーム画面のスタイルを追加する**

```css
/* ==========================================================================
   [H] ホーム画面
   ========================================================================== */
.home__status-cta { margin-top: 16px; min-height: 44px; font-size: 14px; }

.notice-row {
  width: 100%;
  display: flex; align-items: center; gap: 12px;
  padding: 10px 0;
  border: 0; border-top: 1px solid var(--border);
  background: transparent;
  text-align: left;
  font-family: inherit; color: var(--text-main);
  cursor: pointer;
}
.notice-row:first-of-type { border-top: 0; }
.notice-row__body { flex: 1 1 auto; min-width: 0; display: block; }

.menu-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; margin-bottom: 12px; }
.menu-item {
  display: flex; flex-direction: column; align-items: center; gap: 6px;
  padding: 12px 4px;
  border: 1px solid var(--border); border-radius: var(--radius-card);
  background: var(--bg-card);
  box-shadow: var(--shadow-card);
  font-family: inherit; color: var(--text-main);
  cursor: pointer;
}
.menu-item__label { font-size: 10px; font-weight: 600; line-height: 1.3; text-align: center; }

.banner {
  width: 100%;
  display: flex; align-items: flex-start; gap: 12px;
  text-align: left;
  font-family: inherit; color: var(--text-main);
  background: var(--bg-subtle);
  cursor: pointer;
}
.banner__body { flex: 1 1 auto; min-width: 0; display: block; }
.banner__body .card-title { display: block; }
.banner__body .text-body { display: block; font-size: 13px; }
```

- [ ] **Step 3: `app.js` にホーム画面のセクションを追加する**

`/* =======================================================================
     ブラウザ離脱防止ガード(§7.2)` のコメントブロックの**直前**に以下を挿入する。

```js
  /* =======================================================================
     [H] ホーム画面
     ======================================================================= */

  // メニューグリッド(4列 横1行)
  var HOME_MENU = [
    { icon: 'i-doc',    label: '会話ログ・相性レポート', target: 'report' },
    { icon: 'i-shield', label: 'プライバシーについて',   target: 'privacy' },
    { icon: 'i-help',   label: 'よくある質問',           target: 'faq' },
    { icon: 'i-gear',   label: '設定',                   target: 'settings' }
  ];

  function statusText() {
    if (state.decision === 'accept') { return 'お相手と面談日程を調整できます。'; }
    if (state.decision === 'decline') { return '辞退しました。アバターは引き続き会話を続けています。'; }
    if (state.notified) { return '相性の高いお相手が見つかりました。会話ログと相性レポートを確認できます。'; }
    return 'あなたのアバターが、複数の候補アバターと会話を進めています。';
  }

  function statusActionLabel() {
    return state.notified ? '相性レポートを見る' : '進行状況を見る';
  }

  function statusTargetScreen() {
    return state.notified ? 'report' : 'waiting';
  }

  function homeNoticeCardHTML() {
    var rows = state.notified
      ? NOTIFICATIONS.slice(0, 2).map(function (item) {
          return '<button type="button" class="notice-row" data-home-notification="' + item.id + '">' +
                   '<span class="icon-circle"><svg class="icon" aria-hidden="true" focusable="false"><use href="#i-' + item.icon + '"></use></svg></span>' +
                   '<span class="notice-row__body">' +
                     '<span class="card-title">' + esc(item.title) + '</span>' +
                     '<span class="notice__time">' + esc(item.time) + '</span>' +
                   '</span>' +
                   '<svg class="icon notice__chevron" aria-hidden="true" focusable="false"><use href="#i-chevron"></use></svg>' +
                 '</button>';
        }).join('')
      : '<p class="text-body">まだお知らせはありません。</p>';

    return '<div class="card">' +
             '<div class="card__head">' +
               '<h2 class="section-title section-title--flush">お知らせ</h2>' +
               '<button type="button" class="btn-link" data-go="notifications">すべて見る &gt;</button>' +
             '</div>' +
             rows +
           '</div>';
  }

  function menuGridHTML() {
    return '<div class="menu-grid">' + HOME_MENU.map(function (item) {
      return '<button type="button" class="menu-item" data-go="' + item.target + '">' +
               '<span class="icon-circle"><svg class="icon" aria-hidden="true" focusable="false"><use href="#' + item.icon + '"></use></svg></span>' +
               '<span class="menu-item__label">' + esc(item.label) + '</span>' +
             '</button>';
    }).join('') + '</div>';
  }

  renderers.home = function () {
    var body = el('homeBody');

    body.innerHTML =
      heroCardHTML(false) +
      '<div class="card status-card">' +
        '<div class="status-card__head">' +
          '<span class="icon-circle"><svg class="icon" aria-hidden="true" focusable="false"><use href="#i-avatar-pair"></use></svg></span>' +
          '<div>' +
            '<p class="card-title">現在の状況</p>' +
            '<p class="text-body">' + esc(statusText()) + '</p>' +
          '</div>' +
        '</div>' +
        stepsHTML() +
        '<button type="button" class="btn btn--secondary home__status-cta" id="homeStatusGo">' + esc(statusActionLabel()) + '</button>' +
      '</div>' +
      homeNoticeCardHTML() +
      menuGridHTML() +
      '<button type="button" class="card banner" data-go="privacy">' +
        '<span class="icon-circle"><svg class="icon" aria-hidden="true" focusable="false"><use href="#i-lock"></use></svg></span>' +
        '<span class="banner__body">' +
          '<span class="card-title">安心・匿名の設計</span>' +
          '<span class="text-body">実名や所属は、あなたとお相手がOKした後にのみ開示されます。人事や運営がマッチ内容を見ることはできません。</span>' +
        '</span>' +
      '</button>';

    el('homeStatusGo').addEventListener('click', function () {
      showScreen(statusTargetScreen());
    });

    var noticeRows = body.querySelectorAll('[data-home-notification]');
    for (var i = 0; i < noticeRows.length; i++) {
      noticeRows[i].addEventListener('click', function (event) {
        markNotificationRead(event.currentTarget.getAttribute('data-home-notification'));
        showScreen('report');
      });
    }
  };
```

- [ ] **Step 4: ブラウザで目視確認する**

`__demo.reset()` → 登録 → 全6問回答 → 待機 → 通知 → お知らせ → レポート →「会う」→ 日時選択 →「この日時で調整する」→「ホームに戻る」。

期待する結果(上から順に、提供イメージとほぼ同じ構成・配色):
1. ヘッダー: ロゴ+「AIアバター自動マッチング」+ ベル
2. ヒーローカード: 淡ピンク〜プラムのグラデーション、「AIが代わりに会っている。」+ 説明文 + 2人の線画アイコン
3. 「現在の状況」カード: 「お相手と面談日程を調整できます。」+ 5段階ステップインジケーター(5番目「会話ログを読んで判断」が現在ステップ、1〜4が完了)+「相性レポートを見る」ボタン
4. 「お知らせ」カード: 右上に「すべて見る >」、その下に2件の行(タイトル+相対時刻+シェブロン)
5. メニューグリッド: **4列 横1行**で「会話ログ・相性レポート」「プライバシーについて」「よくある質問」「設定」
6. 「安心・匿名の設計」バナー(淡い面):「実名や所属は、あなたとお相手がOKした後にのみ開示されます。人事や運営がマッチ内容を見ることはできません。」
- 下部タブバーの「ホーム」がアクティブ
- 画面のどこにも「山田 花子」が出ていない

- [ ] **Step 5: ホームの遷移をすべて目視確認する**

以下を1つずつクリックして確認する。

- 「相性レポートを見る」→ `report` 画面
- 「すべて見る >」→ お知らせ一覧
- お知らせ行 → `report` 画面へ遷移し、該当のお知らせが既読になる(ベルバッジが減る)
- メニュー「会話ログ・相性レポート」→ `report`
- メニュー「プライバシーについて」→ `privacy`(空。Task 11 で実装)
- メニュー「よくある質問」→ `faq`(空。Task 11 で実装)
- メニュー「設定」→ `settings`(空。Task 12 で実装)
- 「安心・匿名の設計」バナー → `privacy`

- [ ] **Step 6: ステップインジケーターの進捗反映を目視確認する**

Console で以下を順に実行し、そのつどホーム画面のステップ表示を確認する。

```js
__demo.state.decision = null; __demo.state.notified = false; __demo.state.interviewDone = false; __demo.showScreen('home')
// 期待: 「インタビュー完了」(index 1)が現在ステップ。「進行状況を見る」ボタン

__demo.state.interviewDone = true; __demo.showScreen('home')
// 期待: 「アバターが会話中」(index 2)が現在ステップ

__demo.state.notified = true; __demo.showScreen('home')
// 期待: 「相性が高い時に通知」(index 3)が現在ステップ。ボタンが「相性レポートを見る」

__demo.state.decision = 'accept'; __demo.showScreen('home')
// 期待: 「会話ログを読んで判断」(index 4)が現在ステップ
```

- [ ] **Step 7: コミットする**

```bash
cd "C:/Users/ユーザー/Desktop/Cursor_ClaudeCode/260812_Avatar_Matching_ver2"
git add index.html style.css app.js
git commit -m "feat: ホーム画面(ヒーロー・現在の状況・お知らせ・メニュー・匿名バナー)を実装

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 11: プライバシー説明画面 (`privacy`) とよくある質問画面 (`faq`)

**Files:**
- Modify: `index.html`(`privacy` と `faq` の2つの `<section>` を置き換え)
- Modify: `style.css`(末尾に説明画面・FAQのスタイルを追加)

**Interfaces:**
- Consumes: Task 1 の `.card` / `.screen-title` / `.section-title` / `.text-body`、Task 2 の `data-go` 共通デリゲート
- Produces: 静的マークアップのみ(JavaScriptの追加なし)。アコーディオンは `<details>` / `<summary>` のネイティブ挙動を使う

- [ ] **Step 1: `index.html` の `privacy` セクションを置き換える**

`<section class="screen" data-screen="privacy" tabindex="-1"></section>` を以下で置き換える。

```html
      <section class="screen" data-screen="privacy" tabindex="-1">
        <h1 class="screen-title" data-autofocus tabindex="-1">プライバシーについて</h1>

        <div class="card doc">
          <h2 class="doc__heading">匿名性は前提条件です</h2>
          <p class="text-body">実名・所属はアプリのどこにも表示されません。両者が「会う」を選んだ後にのみ、お互いにだけ開示されます。</p>
        </div>

        <div class="card doc">
          <h2 class="doc__heading">人事も運営者も見られません</h2>
          <p class="text-body">誰と会話しているか、どんなマッチが成立したかを、勤務先の人事や運営者が閲覧することはできません。</p>
        </div>

        <div class="card doc">
          <h2 class="doc__heading">断っても伝わりません</h2>
          <p class="text-body">辞退した事実は相手に通知されません。「断られた」という体験が発生しない設計です。</p>
        </div>

        <div class="card doc">
          <h2 class="doc__heading">あなたの回答の使われ方</h2>
          <p class="text-body">インタビューの回答は、あなたのAIアバターがあなたらしく振る舞うためにのみ使われます。</p>
        </div>

        <div class="card doc">
          <h2 class="doc__heading">このデモについて</h2>
          <p class="text-body">本アプリはデモ用のモックです。入力内容はお使いのブラウザ内(localStorage)にのみ保存され、外部サーバーへ送信されることは一切ありません。「設定」から全て削除できます。</p>
        </div>

        <button type="button" class="btn btn--secondary" data-go="settings">設定を開く</button>
      </section>
```

- [ ] **Step 2: `index.html` の `faq` セクションを置き換える**

`<section class="screen" data-screen="faq" tabindex="-1"></section>` を以下で置き換える。

```html
      <section class="screen" data-screen="faq" tabindex="-1">
        <h1 class="screen-title" data-autofocus tabindex="-1">よくある質問</h1>

        <details class="card faq">
          <summary class="faq__q">相手は私のことをどこまで知っていますか?</summary>
          <p class="text-body faq__a">実名・所属は知りません。アバター同士の会話を通じて、話し方や考え方が伝わります。</p>
        </details>

        <details class="card faq">
          <summary class="faq__q">アバターは私に無断で何かを決めますか?</summary>
          <p class="text-body faq__a">決めません。アバターは会話をするだけで、会うかどうかは必ずご本人が判断します。</p>
        </details>

        <details class="card faq">
          <summary class="faq__q">通知が来ないのですが?</summary>
          <p class="text-body faq__a">相性の基準を満たしたときだけ通知が届きます。基準に満たない場合は何も起きません。</p>
        </details>

        <details class="card faq">
          <summary class="faq__q">辞退したことは相手に伝わりますか?</summary>
          <p class="text-body faq__a">伝わりません。</p>
        </details>

        <details class="card faq">
          <summary class="faq__q">会社に利用状況が知られますか?</summary>
          <p class="text-body faq__a">知られません。人事が個人のマッチ内容を閲覧することはできません。</p>
        </details>
      </section>
```

- [ ] **Step 3: `style.css` の末尾に説明画面・FAQのスタイルを追加する**

```css
/* ==========================================================================
   [P] プライバシー説明画面 / [F] よくある質問画面
   ========================================================================== */
.doc__heading { font-size: 15px; font-weight: 700; line-height: 1.5; margin: 0 0 6px; color: var(--wine); }

.faq { padding: 0; }
.faq__q {
  display: flex; align-items: center; justify-content: space-between; gap: 10px;
  padding: 14px 16px;
  font-size: 15px; font-weight: 600; line-height: 1.5;
  cursor: pointer;
  list-style: none;
}
.faq__q::-webkit-details-marker { display: none; }
.faq__q::after {
  content: "";
  flex: none;
  width: 9px; height: 9px;
  border-right: 2px solid var(--wine);
  border-bottom: 2px solid var(--wine);
  transform: rotate(45deg) translateY(-2px);
  transition: transform .2s ease-out;
}
.faq[open] .faq__q::after { transform: rotate(-135deg) translateY(-2px); }
.faq__a { padding: 0 16px 16px; margin: 0; }
```

- [ ] **Step 4: ブラウザで目視確認する**

ホーム画面から「安心・匿名の設計」バナー、およびメニュー「プライバシーについて」をクリックする。

期待する結果:
- 「プライバシーについて」の見出しの下に、ワインレッドの小見出しを持つカードが5枚
  1. 匿名性は前提条件です
  2. 人事も運営者も見られません
  3. 断っても伝わりません
  4. あなたの回答の使われ方
  5. このデモについて
- 最下部に「設定を開く」ボタンがあり、クリックすると設定画面へ遷移する(中身は Task 12 で実装)

ホームのメニュー「よくある質問」をクリックする。

期待する結果:
- 5件の質問がカードとして並び、各カードの右端に下向きの矢印(シェブロン)
- 質問をクリックすると回答が開き、矢印が上向きに回転する。もう一度クリックすると閉じる
- 5件とも開閉する
- Tab キーで質問間を移動でき、Enter / Space で開閉できる
- 質問文と回答文が §4 [F] の5問と一致している

- [ ] **Step 5: コミットする**

```bash
cd "C:/Users/ユーザー/Desktop/Cursor_ClaudeCode/260812_Avatar_Matching_ver2"
git add index.html style.css
git commit -m "feat: プライバシー説明画面とよくある質問画面(アコーディオン)を実装

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 12: マイページ (`mypage`) / プロフィール (`profile`) / 設定 (`settings`)

**Files:**
- Modify: `index.html`(`mypage` / `profile` / `settings` の3つの `<section>` を置き換え)
- Modify: `style.css`(末尾にマイページ・プロフィール・設定のスタイルを追加)
- Modify: `app.js`(マイページ・設定のセクションを追加、`init()` に配線)

**Interfaces:**
- Consumes: Task 2 の `el` / `esc` / `state` / `saveState` / `renderers` / `STEPS` / `currentStepIndex` / `resetDemo` / `init()`、Task 3 の `openSheet`
- Produces: `renderers.mypage` / `renderers.settings`、`function initSettingsScreen(): void`、DOM id: `mypageBody` `settingsNotify` `settingsReset`

- [ ] **Step 1: `index.html` の `mypage` セクションを置き換える**

`<section class="screen" data-screen="mypage" tabindex="-1"></section>` を以下で置き換える。

```html
      <section class="screen" data-screen="mypage" tabindex="-1">
        <h1 class="screen-title" data-autofocus tabindex="-1">マイページ</h1>
        <div id="mypageBody"></div>
      </section>
```

- [ ] **Step 2: `index.html` の `profile` セクションを置き換える**

`<section class="screen" data-screen="profile" tabindex="-1"></section>` を以下で置き換える。

```html
      <section class="screen" data-screen="profile" tabindex="-1">
        <h1 class="screen-title" data-autofocus tabindex="-1">プロフィール</h1>

        <div class="card profile-card">
          <span class="icon-circle icon-circle--lg"><svg class="icon icon--lg" aria-hidden="true" focusable="false"><use href="#i-user"></use></svg></span>
          <p class="profile-card__id">匿名ID: KRY-4821</p>
          <p class="profile-card__company">登録企業: 参加企業A</p>
        </div>

        <div class="card">
          <p class="text-body">実名・所属は登録されていますが、アプリ上には表示されません。</p>
          <p class="text-note">お互いが「会う」を選んだときにのみ、お二人の間だけで開示されます。</p>
        </div>

        <button type="button" class="btn btn--secondary" data-go="privacy">プライバシーについて</button>
      </section>
```

- [ ] **Step 3: `index.html` の `settings` セクションを置き換える**

`<section class="screen" data-screen="settings" tabindex="-1"></section>` を以下で置き換える。

```html
      <section class="screen" data-screen="settings" tabindex="-1">
        <h1 class="screen-title" data-autofocus tabindex="-1">設定</h1>

        <div class="card">
          <div class="row-toggle">
            <label class="row-toggle__label" for="settingsNotify">通知を受け取る</label>
            <input type="checkbox" class="row-toggle__input" id="settingsNotify" role="switch">
          </div>
          <p class="text-note">※デモでは表示のみで、通知の挙動は変わりません。</p>
        </div>

        <div class="card list">
          <button type="button" class="list__item" data-go="privacy">
            <span>プライバシーについて</span>
            <svg class="icon notice__chevron" aria-hidden="true" focusable="false"><use href="#i-chevron"></use></svg>
          </button>
          <button type="button" class="list__item" data-go="faq">
            <span>よくある質問</span>
            <svg class="icon notice__chevron" aria-hidden="true" focusable="false"><use href="#i-chevron"></use></svg>
          </button>
        </div>

        <button type="button" class="btn btn--danger" id="settingsReset">デモをリセット</button>
        <p class="text-note">保存された進行状況をすべて削除し、招待コード入力画面から再開します。展示会で次のデモを始める前に実行してください。</p>
      </section>
```

- [ ] **Step 4: `style.css` の末尾にマイページ・プロフィール・設定のスタイルを追加する**

```css
/* ==========================================================================
   [M] マイページ / [R] プロフィール / [S] 設定
   ========================================================================== */
.qa__q { font-size: 13px; font-weight: 600; color: var(--text-sub); margin: 0 0 6px; }
.qa__a { font-size: 15px; font-weight: 600; margin: 0; }

.profile-card { text-align: center; }
.profile-card .icon-circle { margin: 0 auto 12px; }
.profile-card__id { font-size: 18px; font-weight: 700; margin: 0; }
.profile-card__company { font-size: 13px; color: var(--text-sub); margin: 4px 0 0; }

.row-toggle { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
.row-toggle__label { font-size: 15px; font-weight: 600; }
.row-toggle__input {
  appearance: none; -webkit-appearance: none;
  position: relative; flex: none;
  width: 50px; height: 30px;
  border-radius: var(--radius-pill);
  background: var(--track);
  cursor: pointer;
  transition: background-color .2s ease-out;
}
.row-toggle__input::after {
  content: "";
  position: absolute; top: 3px; left: 3px;
  width: 24px; height: 24px;
  border-radius: 50%;
  background: var(--bg-card);
  box-shadow: 0 1px 3px rgba(80, 40, 60, 0.2);
  transition: transform .2s ease-out;
}
.row-toggle__input:checked { background: var(--wine); }
.row-toggle__input:checked::after { transform: translateX(20px); }

.list { padding: 0; }
.list__item {
  width: 100%;
  display: flex; align-items: center; justify-content: space-between; gap: 10px;
  padding: 14px 16px;
  border: 0; border-top: 1px solid var(--border);
  background: transparent;
  font-family: inherit; font-size: 15px; font-weight: 600; color: var(--text-main);
  text-align: left;
  cursor: pointer;
}
.list__item:first-child { border-top: 0; }
```

- [ ] **Step 5: `app.js` にマイページ・設定のセクションを追加する**

`/* =======================================================================
     ブラウザ離脱防止ガード(§7.2)` のコメントブロックの**直前**に以下を挿入する。

```js
  /* =======================================================================
     [M] マイページ / [S] 設定
     ======================================================================= */

  renderers.mypage = function () {
    var stepLabel = STEPS[currentStepIndex(state)].label;

    var answersHTML = state.answers.length === 0
      ? '<div class="card"><p class="text-body">まだ回答がありません。</p></div>'
      : state.answers.map(function (item) {
          return '<div class="card qa">' +
                   '<p class="qa__q">' + esc(item.question) + '</p>' +
                   '<p class="qa__a">' + esc(item.answer) + '</p>' +
                 '</div>';
        }).join('');

    el('mypageBody').innerHTML =
      '<div class="card">' +
        '<p class="card-title">現在のステップ</p>' +
        '<p class="text-body">' + esc(stepLabel) + '</p>' +
      '</div>' +
      '<h2 class="section-title">インタビューの回答</h2>' +
      answersHTML;
  };

  renderers.settings = function () {
    el('settingsNotify').checked = state.notificationsEnabled === true;
  };

  function initSettingsScreen() {
    el('settingsNotify').addEventListener('change', function (event) {
      // 見た目のみ。state には保存するが挙動には影響しない
      state.notificationsEnabled = event.target.checked;
      saveState();
    });

    el('settingsReset').addEventListener('click', function () {
      openSheet({
        title: 'デモをリセット',
        message: '保存されたデモの進行状況をすべて削除して、最初からやり直します。よろしいですか?',
        confirmLabel: 'リセットする',
        danger: true,
        onConfirm: resetDemo
      });
    });
  }
```

- [ ] **Step 6: `app.js` の `init()` に `initSettingsScreen()` を配線する**

`init()` 内の以下の行を、

```js
    initReportScreen();
```

以下に置き換える。

```js
    initReportScreen();
    initSettingsScreen();
```

- [ ] **Step 7: マイページとプロフィールをブラウザで目視確認する**

`__demo.reset()` から通しで進めて登録・全6問回答を済ませ、下部タブ「マイページ」をクリックする。

期待する結果:
- 「現在のステップ」カードに、そのときの進捗に対応するラベル(例:「アバターが会話中」)が表示される
- 「インタビューの回答」見出しの下に、自分が答えた6件が「質問(小さい灰色)/ 回答(太字)」のカードで並ぶ
- 「回答を見直す」等の編集手段が存在しない(表示のみ)
- 下部タブ「マイページ」がアクティブ

下部タブ「プロフィール」をクリックする。

期待する結果:
- 大きなアイコン円+「匿名ID: KRY-4821」+「登録企業: 参加企業A」
- 「実名・所属は登録されていますが、アプリ上には表示されません。」
- 実名(山田 花子)がどこにも表示されていない
- 「プライバシーについて」ボタンからプライバシー画面へ遷移する

- [ ] **Step 8: 設定画面とデモのリセットを目視確認する**

ホームのメニュー「設定」をクリックする。

期待する結果:
- 「通知を受け取る」のトグルが**オン**(ワインレッド)になっている。クリックするとオフ(グレー)に切り替わる。他の画面へ移動して戻ってきても状態が保持されている。リロードしても保持されている
- 「プライバシーについて」「よくある質問」のリンク行があり、それぞれ対応画面へ遷移する
- 赤枠の「デモをリセット」ボタン
- 「デモをリセット」をクリック → シートで「デモをリセット」「保存されたデモの進行状況をすべて削除して、最初からやり直します。よろしいですか?」+ 赤い「リセットする」+「キャンセル」
- 「キャンセル」→ 設定画面に留まる
- 「リセットする」→ 招待コード入力画面に戻り、**ヘッダーと下部タブバーが消える**
- Console で `localStorage.getItem('avatarMatchingDemo.v1')` が初期状態のJSON(`registered:false`)になっている
- リロードしても招待コード入力画面のままである
- リセット後、もう一度最初から通しで実行できる

- [ ] **Step 9: 待機中のリセットでタイマーが止まることを確認する**

`__demo.reset()` → 登録 → 全6問回答 → 待機画面に入る → 6秒経つ前に下部タブから「設定」へ移動 →「デモをリセット」→「リセットする」。そのまま15秒待つ。

期待する結果: 通知バナーが一切出ない。招待コード入力画面のまま。Console にエラーが出ない。

- [ ] **Step 10: コミットする**

```bash
cd "C:/Users/ユーザー/Desktop/Cursor_ClaudeCode/260812_Avatar_Matching_ver2"
git add index.html style.css app.js
git commit -m "feat: マイページ・プロフィール・設定(デモをリセット)を実装

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 13: アクセシビリティ・モーション・フォールバックの仕上げ

**Files:**
- Modify: `style.css`(末尾にフォーカスリングとコントラスト調整を追加)
- Modify: `app.js`(`prefers-reduced-motion` 時のバー・フェード即時適用)

**Interfaces:**
- Consumes: Task 8 の `animateBars()`、Task 9 の `renderers.reveal`、Task 1 の `@media (prefers-reduced-motion: reduce)` ブロック
- Produces: `function prefersReducedMotion(): boolean`

- [ ] **Step 1: `style.css` の末尾にフォーカスリングとコントラスト調整を追加する**

```css
/* ==========================================================================
   仕上げ: フォーカスリング / コントラスト
   ========================================================================== */
.btn:focus-visible,
.btn-link:focus-visible,
.choice:focus-visible,
.interview__send:focus-visible,
.tab:focus-visible,
.bell:focus-visible,
.notice:focus-visible,
.notice-row:focus-visible,
.menu-item:focus-visible,
.banner:focus-visible,
.slot:focus-visible,
.list__item:focus-visible,
.faq__q:focus-visible,
.row-toggle__input:focus-visible,
.sheet__backdrop:focus-visible {
  outline: 2px solid var(--wine);
  outline-offset: 2px;
}

/* --text-sub (#8A8085) は白背景でコントラスト比 4.5:1 以上を満たすが、
   淡ピンク面(--pink-soft / --bg-subtle)の上では本文色を使う */
.banner .text-body,
.bubble--ai { color: var(--text-main); }
```

- [ ] **Step 2: `app.js` に `prefersReducedMotion()` を追加し、バーのアニメーションを分岐させる**

`app.js` の `function animateBars() { … }` 全体を以下で置き換える。

```js
  function prefersReducedMotion() {
    return window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }

  // 表示時に width を 0 から目標値へトランジションさせる。
  // reduce 指定時は最終状態を即座に適用する
  function animateBars() {
    var fills = el('reportBody').querySelectorAll('.bar__fill');

    function apply() {
      for (var i = 0; i < fills.length; i++) {
        fills[i].style.width = fills[i].getAttribute('data-score') + '%';
      }
    }

    if (prefersReducedMotion()) { apply(); return; }
    requestAnimationFrame(apply);
  }
```

- [ ] **Step 3: `app.js` の開示カードのフェードインを reduce 対応にする**

`renderers.reveal` 内の以下の行を、

```js
    // 下からフェードイン+わずかにスライドアップ(約600ms)
    requestAnimationFrame(function () { el('revealCard').classList.add('is-shown'); });
```

以下に置き換える。

```js
    // 下からフェードイン+わずかにスライドアップ(約600ms)。
    // reduce 指定時は最終状態を即座に適用する
    if (prefersReducedMotion()) {
      el('revealCard').classList.add('is-shown');
    } else {
      requestAnimationFrame(function () { el('revealCard').classList.add('is-shown'); });
    }
```

- [ ] **Step 4: キーボード操作を目視確認する**

`__demo.reset()` から通しで進めながら、各画面でマウスを使わず Tab キーのみで操作する。

期待する結果:
- 招待コード画面: Tab で 入力欄 → 「登録する」。Enter で登録できる
- インタビュー画面: Tab で選択肢ボタンを順に移動でき、Enter で回答できる。自由記述では 入力欄 → 「送信」
- 待機画面: Tab で「お知らせを見る」に到達し、Enter で遷移できる
- レポート画面: Tab で「会う」「今回は辞退する」に到達し、Enter で実行できる。確認シートが開いたら Tab で「辞退する」「キャンセル」に到達できる
- 開示画面: Tab で3つの日時カードと「この日時で調整する」に到達し、Enter / Space で選択・実行できる
- FAQ: Tab で質問に到達し、Enter / Space で開閉できる
- 下部タブバー・ヘッダーのベル: Tab で到達し、Enter で遷移できる
- フォーカスが当たっている要素にワインレッドの輪郭が出る
- 画面遷移するたび、新しい画面の見出し(またはセクション)にフォーカスが移る

- [ ] **Step 5: モーション設定とフォールバックを目視確認する**

DevTools の「Rendering」パネルで `Emulate CSS media feature prefers-reduced-motion` を `reduce` にする。

期待する結果:
- レポート画面を開くと、5本のバーがアニメーションせず最初から目標値の幅で表示される
- 開示画面を開くと、開示カードがフェードインせず最初から表示される
- 待機画面のパルスアニメーションが動かない
- 通知バナーがスライドせずに表示される

DevTools の「Rendering」パネルで `Emulate CSS media feature prefers-color-scheme` を `dark` にする。

期待する結果: 配色が変わらず、明るいトーンのまま表示される。

`assets/hero.png` は用意しない(または一時的にファイル名を変える)。

期待する結果: ホーム画面・待機画面のヒーローカードで、画像要素が消えてグラデーション+2人の線画アイコンだけが表示され、レイアウトが崩れない。DevTools の Network タブに `hero.png` の 404 が出るのは想定内(外部ホストへの通信ではない)。

- [ ] **Step 6: 端末枠のスケーリングを目視確認する**

ブラウザウィンドウの幅を 375px 未満、高さを 812px 未満まで縮める。

期待する結果: 端末枠全体が縮小して常に画面に収まり、レイアウトが崩れない。ページ全体のスクロールバーが出ない。

- [ ] **Step 7: コミットする**

```bash
cd "C:/Users/ユーザー/Desktop/Cursor_ClaudeCode/260812_Avatar_Matching_ver2"
git add style.css app.js
git commit -m "feat: フォーカスリング・reduced-motion対応・ヒーロー画像フォールバックを仕上げ

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 14: 手動QAチェックリストの実施

**Files:**
- Modify: 実施中に不具合が見つかった場合のみ `index.html` / `style.css` / `app.js`

**Interfaces:**
- Consumes: Task 1〜13 のすべて
- Produces: なし(検証のみ)

設計書 §8 の全項目を上から順に実施する。1項目でも失敗したら、その場で原因を直してから続行する(修正した場合は該当箇所を Step 5 のコミットに含める)。

- [ ] **Step 1: 初回フロー(通し確認)を実施する**

ブラウザで `index.html` を開き、Console で `__demo.reset()` を実行してから開始する。

- [ ] `index.html` をブラウザで開くと、招待コード入力画面が375px枠の中に表示される
- [ ] 招待コード空欄で「登録する」→ エラー文が表示され、遷移しない
- [ ] 何か入力すると、エラー文が消える
- [ ] 適当な文字列(例: `TEST`)で「登録する」→ AIインタビュー画面へ遷移する
- [ ] 画面1・2では下部タブバーが表示されていない
- [ ] インタビューの導入メッセージが表示される
- [ ] 選択式の設問で選択肢をタップ → 自分の吹き出しとして履歴に追加され、次の質問が表示される
- [ ] 自由記述の設問で、空欄のままでは送信ボタンが押せない
- [ ] 自由記述に入力して送信 → 履歴に追加され、次の質問へ進む
- [ ] 全6問を回答すると、締めのメッセージと「アバターにまかせる」ボタンが出る
- [ ] 「アバターにまかせる」→ 待機画面へ遷移し、下部タブバーが表示される
- [ ] 待機画面のステップインジケーターで「アバターが会話中」が現在ステップになっている
- [ ] 約6秒後、通知バナーが自動でスライドインする
- [ ] 通知後、ベルアイコンに未読バッジが付く
- [ ] 「お知らせを見る」→ お知らせ一覧に2件のカードが表示される
- [ ] お知らせカードをタップ → 会話ログ・相性レポート画面へ遷移する
- [ ] レポート画面に「お相手 A さん」と表示され、実名が一切表示されていない
- [ ] 会話ログが左右に振り分けられて9ターン表示される
- [ ] 5軸のバーが 0 からアニメーションして目標値まで伸びる
- [ ] 「不一致の重大度」だけバーの色が異なり、「低いほど良い」の注記がある
- [ ] 各軸に会話ログからの引用が添えられている
- [ ] 「会う」→ 短いローディング演出の後、実名開示画面へ遷移する
- [ ] 開示カードがフェードイン+スライドアップで現れる
- [ ] 「山田 花子(仮名)」「株式会社カリヤ精機 / 品質保証部」が表示される
- [ ] 面談候補日時が3つ表示され、未選択では「この日時で調整する」が押せない
- [ ] 日時を選択 → 選択状態が視覚的に分かり、ボタンが有効になる
- [ ] 「この日時で調整する」→ 完了画面が表示される
- [ ] 「ホームに戻る」→ ホーム画面へ遷移する

- [ ] **Step 2: 分岐・補助画面を確認する**

- [ ] レポートで「辞退する」→ 確認シートが出る(`window.confirm` ではない)
- [ ] 確認シートでキャンセル → レポート画面に留まる
- [ ] 確認シートで確定 → 辞退完了画面が表示される
- [ ] 辞退完了画面のデモ用リンクからレポート画面に戻れる
- [ ] ホーム画面が提供イメージ(`ホームイメージ画像.png`)とほぼ同じ構成・配色で表示される
- [ ] ホームのステップインジケーターが現在の進捗を正しく反映している
- [ ] ホームのメニュー4つ(会話ログ/プライバシー/FAQ/設定)がすべて対応画面へ遷移する
- [ ] 「安心・匿名の設計」バナーからプライバシー画面へ遷移する
- [ ] プライバシー画面に匿名性の5項目が表示される
- [ ] FAQのアコーディオンが開閉する
- [ ] マイページに自分のインタビュー回答が一覧表示される
- [ ] プロフィールに匿名IDが表示され、実名が表示されていない
- [ ] 下部タブ4つがすべて動作し、アクティブ状態が正しく切り替わる
- [ ] 下部タブ「メッセージ」がお知らせ一覧を開く

- [ ] **Step 3: 永続化・リセットを確認する**

- [ ] インタビューの途中でリロード → 回答済みの履歴が残り、続きから再開できる
- [ ] 待機画面でリロード → 待機が再開し、通知が届く
- [ ] レポート閲覧後にリロード → レポート画面が復元される
- [ ] 「会う」選択後にリロード → 判断ボタンではなく「選択済み」表示になる
- [ ] 設定 → 「デモをリセット」→ 確認シートが出る
- [ ] リセット確定 → 招待コード入力画面に戻り、下部タブバーが消える
- [ ] リセット後にリロード → 招待コード入力画面のままである(状態が消えている)
- [ ] リセット後、最初から通しでもう一度実行できる(展示会での反復)

- [ ] **Step 4: 表示・非機能を確認する**

- [ ] 開発者ツールのNetworkタブで、外部への通信が1件も発生していない(`assets/hero.png` の 404 は同一オリジンのため対象外)
- [ ] Consoleにエラーが出ていない(全14画面を巡回して確認)
- [ ] ブラウザ幅を 375px 未満に狭めても、枠が縮小されて崩れない
- [ ] 実名「山田 花子」が、実名開示画面(および完了画面)以外のどこにも表示されていない
- [ ] すべてのボタンがキーボードのTab移動+Enterで操作できる
- [ ] OSをダークモードにしても、明るいトーンのまま表示される
- [ ] 3分以内に、招待コード入力から実名開示まで通しでデモできる(ストップウォッチで実測)
- [ ] ブラウザの「戻る」操作(またはトラックパッドのスワイプバック)を行っても、アプリのページから離脱しない
- [ ] 待機画面で、説明文付近を通常にタップ・スクロールしても待機完了ショートカットが誤発火しない

- [ ] **Step 5: 修正があればコミットする**

QA で修正を行った場合のみ実行する。修正が無ければこのステップはスキップする。

```bash
cd "C:/Users/ユーザー/Desktop/Cursor_ClaudeCode/260812_Avatar_Matching_ver2"
git add index.html style.css app.js
git commit -m "fix: 手動QAで見つかった不具合を修正

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

- [ ] **Step 6: 実装完了をユーザーに報告する**

以下を伝える。

- §8 の手動QAチェックリストを全項目実施し、すべて満たしたこと
- コード一式(`index.html` / `style.css` / `app.js`)がリポジトリのルート直下に配置され、コミット済みであること
- GitHub へのpushと GitHub Pages の有効化は**ユーザー自身が実施する**こと。手順は設計書 `docs/superpowers/specs/2026-08-12-avatar-matching-poc-webapp-design.md` の §9.2 に記載があること
- デモ運用上の注意(設計書 §9.3): デモ前に「設定 → デモをリセット」を実行すること、待機は6秒だがヒーローカード右下の長押しで即座に完了できること、進行状況はブラウザごとに保存されること

---
