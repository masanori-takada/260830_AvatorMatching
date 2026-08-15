import { AppShell } from "@/components/app-shell/app-shell";
import { submitAccessCode } from "@/features/access-gate/server/actions";

import styles from "./page.module.css";

type AccessGatePageProps = {
  searchParams: Promise<{ next?: string; error?: string }>;
};

/**
 * 合言葉ゲートの入力画面(限定公開)。
 *
 * src/proxy.tsが、ゲート未通過のアクセスをこの画面へ誘導する。フォームは通常の
 * サーバーアクション(submitAccessCode)へPOSTするだけの素朴な作りで、Enterキーでの
 * 送信判定にクライアント側のkeydownハンドラを使わない。これによりIME変換確定の
 * Enterで誤って送信してしまう不具合(コミットa7e708dで修正した招待コード欄の再発)を
 * そもそも起こさない。
 */
export default async function AccessGatePage({ searchParams }: AccessGatePageProps) {
  const query = await searchParams;
  const next = typeof query.next === "string" ? query.next : "/";

  return (
    <AppShell>
      <section className={styles.gate}>
        <h1 className={styles.title}>限定公開デモ</h1>
        <p className={styles.copy}>このデモは限定公開です。お渡しした合言葉を入力してください。</p>
        {query.error ? (
          <p className={styles.error} role="alert">
            合言葉が違います。もう一度お試しください。
          </p>
        ) : null}
        <form action={submitAccessCode} className={styles.form}>
          <input name="next" type="hidden" value={next} />
          <label className={styles.label} htmlFor="access-gate-code">
            合言葉
          </label>
          <input
            autoComplete="off"
            className={styles.input}
            id="access-gate-code"
            name="code"
            required
            type="text"
          />
          <button className={styles.submit} type="submit">
            進む
          </button>
        </form>
      </section>
    </AppShell>
  );
}
