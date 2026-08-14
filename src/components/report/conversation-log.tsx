import styles from "./report.module.css";

export type ConversationMessage = {
  id: string;
  turnIndex: number;
  speaker: "user_avatar" | "candidate_avatar";
  body: string;
  answerRefs: string[];
};

export function ConversationLog({ messages }: { messages: ConversationMessage[] }) {
  return (
    <section aria-labelledby="conversation-title" className={styles.card}>
      <h2 className={styles.subtleTitle} id="conversation-title">アバター同士の会話</h2>
      <ol className={styles.conversation}>
        {messages.map((message) => (
          <li className={message.speaker === "user_avatar" ? styles.selfTurn : styles.partnerTurn} key={message.id}>
            <p className={styles.speaker}>{message.speaker === "user_avatar" ? "あなたのアバター" : "お相手のアバター"}</p>
            <p className={styles.body}>{message.body}</p>
            <p className={styles.refs}>回答 {message.answerRefs.join("、")} を参照</p>
          </li>
        ))}
      </ol>
      <p className={styles.note}>これはAIアバター同士が交わした匿名の会話です。</p>
    </section>
  );
}
