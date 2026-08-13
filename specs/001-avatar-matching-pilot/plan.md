# Implementation Plan: AIアバター自動マッチング実証パイロット

**Branch**: `001-avatar-matching-pilot` | **Date**: 2026-08-13 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/001-avatar-matching-pilot/spec.md`

## Summary

既存PoCの見た目と遷移を忠実に継承し、匿名開始、固定20問、デモ候補とのモックアバター会話、
5軸相性レポート、承諾・辞退、承諾後開示をNext.jsとSupabaseで一気通貫に実装する。利用者所有
データはRLSで分離し、候補開示は承諾済みの場合だけ成功するデータベース関数を通す。AI処理は
共通契約の背後に置き、初期版の決定論的モックを後からAmazon Bedrockへ交換できるようにする。

## Technical Context

**Language/Version**: Node.js 24 LTS、TypeScript 5.9.3

**Primary Dependencies**: Next.js 16.3.0、React 19.2.8、`@supabase/supabase-js` 2.112.3、
`@supabase/ssr` 0.12.4、Zod 4.4.3

**Storage**: Supabase Postgres、Supabase Auth（匿名認証）、Supabase Realtime、ブラウザ一時保存

**Testing**: Vitest 4.1.10、Testing Library 16.3.2、Playwright 1.62.1、axe-core 4.13.0、
Supabase CLI 2.114.0 / pgTAP

**Target Platform**: 現行のChrome、Safari、Edge。幅320px以上のスマートフォンを主対象とし、
PCではスマートフォン相当幅を中央表示する。

**Project Type**: 単一のフルスタックWebアプリケーション

**Performance Goals**: 通常画面の主コンテンツを標準回線で2秒以内に表示する。モック会話処理は
操作開始から10秒以内、失敗・タイムアウトは30秒以内に結果を表示する。

**Constraints**: 実名・メール・電話番号を収集しない。承諾前開示0件、他利用者アクセス0件。
回答本文をログへ出さない。既存デモの主要画面構造を維持する。

**Scale/Scope**: 実証パイロット100匿名利用者程度、固定20問、デモ候補1人、15画面、
1利用者1マッチ、モックAIを対象とする。

## Constitution Check

*GATE: Phase 0前およびPhase 1後に確認済み。全項目PASS。*

| 原則 | 判定 | 設計上の担保 |
|---|---|---|
| 匿名性と段階的開示 | PASS | 全所有テーブルのRLS、開示RPC、承諾前レスポンス契約、RLSテスト |
| 動く縦切り | PASS | 認証・実ユーザー探索を除外し、開始から開示までを1本で完成 |
| テスト可能な契約 | PASS | AI JSON Schema、Server Action契約、SQL状態遷移、4層テスト |
| 既存デモ忠実性 | PASS | 参照画像・GIFの視覚チェックリスト、CSSトークン、同じ画面順 |
| 交換可能・観測可能 | PASS | `AiProvider`、処理状態、失敗分類、本文を含まない構造化ログ |
| 技術・セキュリティ制約 | PASS | Next.js App Router、Supabase、RLS、マイグレーション管理 |
| モデル分担と品質ゲート | PASS | 計画は5.6 sol、実装は5.6 Terra、レビューは5.6 sol |

Phase 1後も新たな違反はない。service roleを通常処理で使わず、開示と一括確定は所有者検証付きの
限定RPCで行うため、匿名性原則に適合する。

## Project Structure

### Documentation (this feature)

```text
specs/001-avatar-matching-pilot/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   ├── ai-profile.schema.json
│   ├── ai-match.schema.json
│   ├── server-actions.md
│   └── database-rpcs.md
└── tasks.md
```

### Source Code (repository root)

```text
src/
├── app/
│   ├── (journey)/
│   │   ├── start/page.tsx
│   │   ├── interview/[order]/page.tsx
│   │   ├── interview/complete/page.tsx
│   │   ├── home/page.tsx
│   │   ├── matching/page.tsx
│   │   ├── notifications/page.tsx
│   │   ├── report/page.tsx
│   │   ├── reveal/page.tsx
│   │   ├── declined/page.tsx
│   │   ├── mypage/page.tsx
│   │   ├── privacy/page.tsx
│   │   ├── faq/page.tsx
│   │   └── settings/page.tsx
│   ├── api/match-runs/[id]/process/route.ts
│   ├── layout.tsx
│   ├── page.tsx
│   └── globals.css
├── components/
│   ├── app-shell/
│   ├── interview/
│   ├── home/
│   ├── report/
│   └── feedback/
├── features/
│   ├── identity/
│   ├── interview/
│   ├── avatar-profile/
│   ├── matching/
│   ├── compatibility/
│   ├── decision/
│   └── notifications/
├── lib/
│   ├── ai/
│   ├── supabase/
│   ├── env.ts
│   ├── logger.ts
│   └── result.ts
└── proxy.ts

supabase/
├── config.toml
├── migrations/
├── seed.sql
└── tests/database/

tests/
├── unit/
├── integration/
├── e2e/
└── visual/

public/
└── app-assets/
```

**Structure Decision**: リポジトリ直下をNext.jsプロジェクトとし、既存の `index.html`、`app.js`、
`style.css`、PDF、PNG、GIFは参照資料として保持する。新しい実装は `src/` に閉じ、公開してよい
アセットだけを `public/app-assets/` に置く。事業資料PDFと参照GIFを `public/` へコピーしない。

## Complexity Tracking

憲章違反はなく、追加の複雑性例外はない。
