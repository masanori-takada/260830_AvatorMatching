import { AppShell } from "@/components/app-shell/app-shell";
import styles from "../journey.module.css";

// index.htmlモック(data-screen="faq")の文言をそのまま採用する。
const FAQ_ITEMS = [
  {
    question: "相手は私のことをどこまで知っていますか?",
    answer: "実名・所属は知りません。アバター同士の会話を通じて、話し方や考え方が伝わります。",
  },
  {
    question: "アバターは私に無断で何かを決めますか?",
    answer: "決めません。アバターは会話をするだけで、会うかどうかは必ずご本人が判断します。",
  },
  {
    question: "通知が来ないのですが?",
    answer: "相性の基準を満たしたときだけ通知が届きます。基準に満たない場合は何も起きません。",
  },
  {
    question: "辞退したことは相手に伝わりますか?",
    answer: "伝わりません。",
  },
  {
    question: "会社に利用状況が知られますか?",
    answer: "知られません。人事が個人のマッチ内容を閲覧することはできません。",
  },
] as const;

export default function FaqPage() {
  return (
    <AppShell activeTab="settings" showNavigation>
      <h1 className={styles.title}>よくある質問</h1>

      {FAQ_ITEMS.map((item) => (
        <details className={styles.faqItem} key={item.question}>
          <summary className={styles.faqQuestion}>{item.question}</summary>
          <p className={styles.faqAnswer}>{item.answer}</p>
        </details>
      ))}
    </AppShell>
  );
}
