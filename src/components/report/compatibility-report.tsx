import { ConversationLog, type ConversationMessage } from "./conversation-log";
import styles from "./report.module.css";
import { ScoreBar } from "./score-bar";

const AXES: Record<string, { label: string; inverted?: boolean }> = {
  conversation_flow: { label: "会話の弾み" },
  values_alignment: { label: "価値観の一致" },
  humor_fit: { label: "ユーモアの相性" },
  mutual_interest: { label: "相互関心" },
  mismatch_severity: { label: "不一致の重大度", inverted: true },
};

export type CompatibilityDimension = {
  axis: string;
  score: number;
  explanation: string;
  evidenceMessageId: string;
};

type Props = {
  candidateAlias: string;
  report: { overallScore: number; summary: string; caution: string };
  dimensions: CompatibilityDimension[];
  messages: ConversationMessage[];
};

export function CompatibilityReport({ candidateAlias, report, dimensions, messages }: Props) {
  const messageById = new Map(messages.map((message) => [message.id, message]));
  for (const dimension of dimensions) {
    if (!messageById.has(dimension.evidenceMessageId)) throw new Error("引用発言が存在しません。");
  }

  return (
    <div className={styles.stack}>
      <section className={`${styles.card} ${styles.partner}`}>
        <div aria-hidden="true" className={styles.avatar}>A</div>
        <div className={styles.partnerMeta}>
          <h1 className={styles.title}>{candidateAlias}</h1>
          <p className={styles.note}>実名・所属は非表示です</p>
        </div>
        <span className={styles.badge}>相性 {report.overallScore}%</span>
      </section>

      <ConversationLog messages={messages} />

      <section aria-labelledby="report-title">
        <h2 className={styles.sectionTitle} id="report-title">相性レポート</h2>
        <div className={styles.stack}>
          {dimensions.map((dimension) => {
            const metadata = AXES[dimension.axis];
            const evidence = messageById.get(dimension.evidenceMessageId)!;
            return (
              <article className={styles.card} key={dimension.axis}>
                <div className={styles.axisHead}>
                  <h3 className={styles.axisLabel}>{metadata?.label ?? dimension.axis}</h3>
                  {metadata?.inverted ? <span className={styles.hint}>低いほど良い</span> : null}
                  <strong className={styles.score}>{dimension.score}</strong>
                </div>
                <ScoreBar inverted={metadata?.inverted} label={metadata?.label ?? dimension.axis} score={dimension.score} />
                <p className={styles.explanation}>{dimension.explanation}</p>
                <blockquote className={styles.quote}>「{evidence.body}」</blockquote>
              </article>
            );
          })}
        </div>
      </section>

      <section className={styles.card}>
        <h2 className={styles.sectionTitle}>総評</h2>
        <p className={styles.explanation}>{report.summary}</p>
        <p className={styles.caution}>{report.caution}</p>
      </section>
    </div>
  );
}
