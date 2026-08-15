import Link from "next/link";

import { describeJourneyState, type DerivedJourney } from "@/features/matching/server/journey-state";
import styles from "./home.module.css";
import { ProgressSteps } from "./progress-steps";

type StatusCardProps = {
  journey: DerivedJourney;
};

export function StatusCard({ journey }: StatusCardProps) {
  return (
    <section aria-label="現在の状況" className={styles.statusCard}>
      <div className={styles.statusHead}>
        <span aria-hidden="true" className={styles.iconCircle}>
          <svg fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.6} viewBox="0 0 24 24">
            <circle cx="8" cy="8.5" r="3.2" />
            <circle cx="16" cy="8.5" r="3.2" />
            <path d="M2.5 20c0-3 2.5-4.8 5.5-4.8s5.5 1.8 5.5 4.8" />
            <path d="M10.5 20c0-3 2.5-4.8 5.5-4.8s5.5 1.8 5.5 4.8" />
          </svg>
        </span>
        <div>
          <p className={styles.cardTitle}>現在の状況</p>
          <p className={styles.bodyText}>{describeJourneyState(journey.state)}</p>
        </div>
      </div>
      <ProgressSteps state={journey.state} />
      <Link className={styles.statusCta} href={journey.primaryAction.href}>
        {journey.primaryAction.label}
      </Link>
    </section>
  );
}
