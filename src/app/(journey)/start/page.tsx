import { redirect } from "next/navigation";

import { AppShell } from "@/components/app-shell/app-shell";
import styles from "@/components/interview/interview.module.css";
import { startAnonymousJourney } from "@/features/identity/server/actions";

type StartPageProps = {
  searchParams: Promise<{ error?: string | string[] }>;
};

export default async function StartPage({ searchParams }: StartPageProps) {
  const query = await searchParams;
  async function start() {
    "use server";
    const result = await startAnonymousJourney();
    if (result.ok) {
      redirect(result.data.nextPath);
    }
    redirect("/start?error=1");
  }

  return (
    <AppShell>
      <section className={styles.start}>
        <h1 className={styles.title}>AIインタビュー</h1>
        <p className={styles.copy}>20問の質問から、あなたらしさをアバターに伝えます。</p>
        {query.error ? (
          <p className={styles.error} role="alert">
            インタビューを開始できませんでした。時間をおいて、もう一度お試しください。
          </p>
        ) : null}
        <form action={start}>
          <button className={styles.startButton} type="submit">インタビューをはじめる</button>
        </form>
      </section>
    </AppShell>
  );
}
