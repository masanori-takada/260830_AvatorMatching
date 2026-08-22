import Link from "next/link";
import { redirect } from "next/navigation";

import { AppShell } from "@/components/app-shell/app-shell";
import {
  getOwnedMatchSummaries,
  type CompatibilityAxis,
  type MatchSummary,
} from "@/features/matching/server/match-list-query";
import styles from "./matches.module.css";

// 一覧・比較表の両方で軸ラベルを揃えるため、src/components/report/compatibility-report.tsx
// と同じ軸ラベルをここでも定義する(表示専用の定数なので複製の実害は小さい)。
const AXIS_LABELS: Record<CompatibilityAxis, string> = {
  conversation_flow: "会話の弾み",
  values_alignment: "価値観の一致",
  humor_fit: "ユーモアの相性",
  mutual_interest: "相互関心",
  mismatch_severity: "不一致の重大度",
};
const AXIS_ORDER: CompatibilityAxis[] = [
  "conversation_flow", "values_alignment", "humor_fit", "mutual_interest", "mismatch_severity",
];
// 「不一致の重大度」だけは数値が低いほど良い軸。レポート画面(compatibility-report.tsx)と
// 同様に、他の軸と見た目を区別して誤読を防ぐ(不具合3対応)。
const INVERTED_AXES = new Set<CompatibilityAxis>(["mismatch_severity"]);

// 「自分のアバターが複数の相手と勝手に会話してきてくれた」という体験の到達点。
// 完了した候補を並べ、それぞれの相性スコアと総評から気になる相手を選べるようにする。
export default async function MatchesPage() {
  const { summaries, acceptedMatchRunId } = await getOwnedMatchSummaries();
  const hasCompleted = summaries.some((match) => match.status === "completed");
  if (summaries.length === 0 || !hasCompleted) {
    redirect("/matching");
  }

  const completedMatches = summaries.filter((match) => match.status === "completed");

  return (
    <AppShell activeTab="home" showNavigation>
      <h1 className={styles.title}>マッチ結果</h1>
      <p className={styles.lead}>
        あなたのアバターが{summaries.length}人の候補アバターと会話してきました。気になるお相手を選んで、会話ログと相性レポートを確認してください。
      </p>
      {completedMatches.length >= 2 ? <ComparisonTable matches={completedMatches} /> : null}
      <ul className={styles.list}>
        {summaries.map((match) => (
          <li key={match.matchRunId}>
            <MatchCard acceptedElsewhere={acceptedMatchRunId !== null && acceptedMatchRunId !== match.matchRunId} match={match} />
          </li>
        ))}
      </ul>
    </AppShell>
  );
}

// 相性スコアだけでなく、5つの軸それぞれで何が違うのかを一目で比較できるようにする表
// (不具合3対応)。横スクロール可能にして、候補が3人並んでも画面幅からはみ出さないようにする。
function ComparisonTable({ matches }: { matches: MatchSummary[] }) {
  return (
    <div className={styles.compareWrap}>
      <table className={styles.compareTable}>
        <thead>
          <tr>
            <th className={styles.compareAxisHead} scope="col">軸</th>
            {matches.map((match) => (
              <th className={styles.compareCandidateHead} key={match.matchRunId} scope="col">
                {match.candidateAlias}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          <tr>
            <th className={styles.compareAxisHead} scope="row">総合相性</th>
            {matches.map((match) => (
              <td className={styles.compareScore} key={match.matchRunId}>
                {match.overallScore !== null ? `${match.overallScore}%` : "—"}
              </td>
            ))}
          </tr>
          {AXIS_ORDER.map((axis) => (
            <tr key={axis}>
              <th className={styles.compareAxisHead} scope="row">
                {AXIS_LABELS[axis]}
                {INVERTED_AXES.has(axis) ? <span className={styles.axisHint}>低いほど良い</span> : null}
              </th>
              {matches.map((match) => {
                const dimension = match.dimensions.find((d) => d.axis === axis);
                return (
                  <td className={styles.compareScore} key={match.matchRunId}>
                    {dimension ? dimension.score : "—"}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function MatchCard({ match, acceptedElsewhere }: { match: MatchSummary; acceptedElsewhere: boolean }) {
  if (match.status !== "completed") {
    return (
      <div className={`${styles.card} ${styles.pending}`}>
        <span aria-hidden="true" className={styles.avatar}>A</span>
        <div className={styles.body}>
          <p className={styles.name}>{match.status === "failed" ? "会話に失敗した候補" : "会話中の候補"}</p>
          <p className={styles.note}>
            {match.status === "failed" ? "この候補との会話は完了しませんでした。" : "もうすぐ会話が終わります。"}
          </p>
        </div>
      </div>
    );
  }

  if (acceptedElsewhere) {
    return (
      <div className={`${styles.card} ${styles.disabled}`}>
        <span aria-hidden="true" className={styles.avatar}>A</span>
        <div className={styles.body}>
          <p className={styles.name}>{match.candidateAlias}</p>
          <p className={styles.note}>他の方を承諾したため、見送りになりました。</p>
        </div>
      </div>
    );
  }

  const decisionLabel = match.decision === "accept" ? "承諾済み" : match.decision === "decline" ? "辞退済み" : null;

  return (
    <Link className={styles.card} href={`/report?matchRunId=${match.matchRunId}`}>
      <span aria-hidden="true" className={styles.avatar}>A</span>
      <div className={styles.body}>
        <div className={styles.headRow}>
          <p className={styles.name}>{match.candidateAlias}</p>
          <span className={styles.badge}>相性 {match.overallScore}%</span>
        </div>
        {match.summary ? <p className={styles.summary}>{match.summary}</p> : null}
        {decisionLabel ? <p className={styles.note}>{decisionLabel}</p> : null}
      </div>
    </Link>
  );
}
