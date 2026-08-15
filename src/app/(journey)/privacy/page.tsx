import Link from "next/link";

import { AppShell } from "@/components/app-shell/app-shell";
import styles from "../journey.module.css";

// index.htmlモック(data-screen="privacy")の文言・構成をそのまま採用する。
// ただし「このデモについて」カードのみ、実装の実態(回答はSupabaseへ保存される)に
// 合わせて書き換えている。モックの原文は「ブラウザ内(localStorage)にのみ保存」と
// 説明しているが、本実装では回答をサーバー側DBに保存するため、その説明のままでは
// 虚偽表示になる(FR-030準拠)。
export default function PrivacyPage() {
  return (
    <AppShell activeTab="settings" showNavigation>
      <h1 className={styles.title}>プライバシーについて</h1>

      <section className={styles.docCard}>
        <h2 className={styles.docHeading}>匿名性は前提条件です</h2>
        <p className={styles.docBody}>実名・所属はアプリのどこにも表示されません。両者が「会う」を選んだ後にのみ、お互いにだけ開示されます。</p>
      </section>

      <section className={styles.docCard}>
        <h2 className={styles.docHeading}>人事も運営者も見られません</h2>
        <p className={styles.docBody}>誰と会話しているか、どんなマッチが成立したかを、勤務先の人事や運営者が閲覧することはできません。</p>
      </section>

      <section className={styles.docCard}>
        <h2 className={styles.docHeading}>断っても伝わりません</h2>
        <p className={styles.docBody}>辞退した事実は相手に通知されません。「断られた」という体験が発生しない設計です。</p>
      </section>

      <section className={styles.docCard}>
        <h2 className={styles.docHeading}>あなたの回答の使われ方</h2>
        <p className={styles.docBody}>インタビューの回答は、あなたのAIアバターがあなたらしく振る舞うためにのみ使われます。</p>
      </section>

      <section className={styles.docCard}>
        <h2 className={styles.docHeading}>このデモについて</h2>
        <p className={styles.docBody}>
          本アプリはデモ用のモックです。回答は匿名IDに紐づけてサーバーに保存され、実名・メールアドレス・電話番号は収集しません。
          設定からいつでも自分のデータを削除できます。
        </p>
      </section>

      <Link className={styles.linkButton} href="/settings">設定を開く</Link>
    </AppShell>
  );
}
