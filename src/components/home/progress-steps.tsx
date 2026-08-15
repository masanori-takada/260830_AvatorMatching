import type { JourneyStateName } from "@/features/matching/server/journey-state";
import styles from "./home.module.css";

// 既存デモの5段階ステップ(登録完了・インタビュー完了・会話中・通知・判断)から、
// 招待コード登録がない初期版向けに4段階へ整理したもの。
const STEP_LABELS = [
  "インタビュー回答",
  "アバターが会話中",
  "相性が高い時に通知",
  "会話ログを読んで判断",
] as const;

function currentStepIndex(state: JourneyStateName): number {
  switch (state) {
    case "interview":
      return 0;
    case "ready_to_match":
    case "matching":
    case "match_failed":
      return 1;
    case "report_ready":
      return 2;
    case "accepted":
    case "declined":
      return 3;
    default:
      return 0;
  }
}

type ProgressStepsProps = {
  state: JourneyStateName;
};

export function ProgressSteps({ state }: ProgressStepsProps) {
  const current = currentStepIndex(state);
  return (
    <ol aria-label="進行状況" className={styles.steps}>
      {STEP_LABELS.map((label, index) => {
        const status = index < current ? "done" : index === current ? "current" : "todo";
        return (
          <li className={styles.step} data-status={status} key={label}>
            <span aria-hidden="true" className={styles.stepMark}>
              {index < current ? "✓" : index + 1}
            </span>
            <span className={styles.stepLabel}>{label}</span>
          </li>
        );
      })}
    </ol>
  );
}
