import { AppShell } from "@/components/app-shell/app-shell";
import styles from "../journey.module.css";

// index.htmlモック(data-screen="faq")の文言をそのまま採用する。
const FAQ_ITEMS = [
  {
    question: "相手は私のことをどこまで知っていますか?",
    answer: "実名・姓・会社・部署・メールアドレス・電話番号は表示されません。最初の承認後も、下の名前・年齢層・趣味・自己紹介文・写真（AI生成の架空画像）だけが開示されます。",
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
    answer: "伝わりません。最終見送り後は、この候補とのつながりとチャットは閉じ、別の候補を選べます。",
  },
  {
    question: "チャットでは何ができますか?",
    answer: "最終承認が双方で完了した後だけ、候補者の固定挨拶1通と、あなたの1〜1000文字のテキストメッセージで1対1に会話できます。",
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
