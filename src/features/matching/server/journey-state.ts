import { TOTAL_QUESTIONS } from "@/features/interview/domain";
import type { ConnectionState } from "@/features/connection/server/queries";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export type MatchRunStatus = "queued" | "processing" | "completed" | "failed";

// 1利用者が最大3件のmatch_runsを同時に持つため、状態導出は単一runではなく
// runの配列から行う。空配列は「マッチ未開始」を表す(旧shapeのmatch===nullに相当)。
export type MatchRunSnapshot = {
  matchRunId: string;
  status: MatchRunStatus;
  decision: "accept" | "decline" | null;
  connectionState?: ConnectionState | null;
};

export type JourneySnapshot = {
  answeredCount: number;
  matches: MatchRunSnapshot[];
};

// ホームで表示する現在地。既存デモの5段階ステップ(登録・インタビュー・会話中・通知・判断)を
// 招待コード登録なしの初期版に合わせて並べ替えたもの。
export type JourneyStateName =
  | "interview"
  | "ready_to_match"
  | "matching"
  | "match_failed"
  | "report_ready"
  | "accepted"
  | "declined";

export type PrimaryAction = { label: string; href: string };

export type DerivedJourney = {
  state: JourneyStateName;
  primaryAction: PrimaryAction;
  allowedPaths: string[];
  connectionState?: ConnectionState | null;
};

// どの状態でも到達できる共通画面。ホーム、マイページ、お知らせ、設定、プライバシー、FAQ。
const COMMON_PATHS = ["/", "/home", "/mypage", "/notifications", "/settings", "/privacy", "/faq"];

function reportHrefFor(matchRunId: string | undefined): string {
  return matchRunId ? `/report?matchRunId=${matchRunId}` : "/report";
}

// 保存済み状態(回答数、複数マッチの状況、決定)から、ホームの主操作と
// 直接URLで到達してよい画面を導出する。FR-021, FR-022, FR-036 に対応する。
export function deriveJourneyState(snapshot: JourneySnapshot): DerivedJourney {
  const { answeredCount, matches } = snapshot;
  const safeCount = Math.min(Math.max(answeredCount, 0), TOTAL_QUESTIONS);

  if (matches.length === 0) {
    if (safeCount >= TOTAL_QUESTIONS) {
      return {
        state: "ready_to_match",
        primaryAction: { label: "アバターにまかせる", href: "/matching" },
        allowedPaths: [...COMMON_PATHS, "/matching"],
      };
    }

    const nextOrder = safeCount + 1;
    return {
      state: "interview",
      primaryAction: { label: "インタビューを続ける", href: `/interview/${nextOrder}` },
      allowedPaths: [...COMMON_PATHS, `/interview/${nextOrder}`],
    };
  }

  const pending = matches.some((run) => run.status === "queued" || run.status === "processing");
  if (pending) {
    return {
      state: "matching",
      primaryAction: { label: "進行状況を見る", href: "/matching" },
      allowedPaths: [...COMMON_PATHS, "/matching"],
    };
  }

  const completed = matches.filter((run) => run.status === "completed");
  if (completed.length === 0) {
    // 全件が失敗した場合だけ「全滅」の失敗表示にする。
    return {
      state: "match_failed",
      primaryAction: { label: "もう一度試す", href: "/matching" },
      allowedPaths: [...COMMON_PATHS, "/matching"],
    };
  }

  const reportPaths = completed.map((run) => reportHrefFor(run.matchRunId));
  const accepted = completed.find((run) => (
    run.connectionState !== undefined
      ? run.connectionState === "profile_revealed"
        || run.connectionState === "contact_pending"
        || run.connectionState === "connected"
      : run.decision === "accept"
  ));

  if (accepted) {
    const connected = accepted.connectionState === "connected";
    const revealPath = `/reveal?matchRunId=${encodeURIComponent(accepted.matchRunId)}`;
    return {
      state: "accepted",
      primaryAction: { label: connected ? "チャットを開く" : "開示情報を見る", href: connected ? "/chat" : revealPath },
      allowedPaths: [...COMMON_PATHS, "/matches", ...reportPaths, revealPath, ...(connected ? ["/chat"] : [])],
      connectionState: accepted.connectionState,
    };
  }

  const allDeclined = completed.every((run) => (
    run.connectionState === "closed" || run.decision === "decline"
  ));
  if (allDeclined) {
    return {
      state: "declined",
      primaryAction: { label: "結果を見る", href: "/declined" },
      allowedPaths: [...COMMON_PATHS, "/matches", ...reportPaths, "/declined"],
    };
  }

  return {
    state: "report_ready",
    primaryAction: { label: "マッチ結果を見る", href: "/matches" },
    allowedPaths: [...COMMON_PATHS, "/matches", ...reportPaths],
  };
}

// ホームの「現在の状況」に表示する説明文。
export function describeJourneyState(
  state: JourneyStateName,
  connectionState?: ConnectionState | null,
): string {
  switch (state) {
    case "interview":
      return `あなたのアバターが、あなたらしさを学んでいます。${TOTAL_QUESTIONS}問の質問に回答してください。`;
    case "ready_to_match":
      return `${TOTAL_QUESTIONS}問の回答が完了しました。アバターに会話を任せましょう。`;
    case "matching":
      return "あなたのアバターが、複数の候補アバターと同時に会話を進めています。";
    case "match_failed":
      return "会話の生成に失敗しました。回答は保持されているので、もう一度お試しください。";
    case "report_ready":
      return "相性の高いお相手候補が見つかりました。マッチ結果から会話ログと相性レポートを確認できます。";
    case "accepted":
      return connectionState === "connected"
        ? "最終承認が完了しました。チャットでお相手との会話を始められます。"
        : "「会ってみたい」を選びました。開示情報をご確認ください。";
    case "declined":
      return "今回は見送りました。相手へは通知されません。";
    default:
      return "";
  }
}

type MatchRunRow = { id: string; status: MatchRunStatus };
type DecisionRow = { match_run_id: string; kind: "accept" | "decline" };
type ConnectionRow = { match_run_id: string; state: ConnectionState };
// requireUser済みのownerIdから、ホーム表示に必要な現在状態(最大3件のmatch_runsと
// それぞれの決定)をDBから取得する。RLSで自分の行しか見えない前提のうえ、
// 明示的にowner_idも指定して二重に絞り込む。
export async function getJourneySnapshot(userId: string): Promise<JourneySnapshot> {
  const client = await createServerSupabaseClient();
  const [answersResult, matchResult, connectionsResult] = await Promise.all([
    client
      .from("interview_answers")
      .select("question_code", { count: "exact", head: true })
      .eq("owner_id", userId),
    client
      .from("match_runs")
      .select("id, status")
      .eq("owner_id", userId)
      .order("candidate_id"),
    client
      .from("match_connections")
      .select("match_run_id, state")
      .eq("owner_id", userId),
  ]);

  if (answersResult.error) {
    throw answersResult.error;
  }
  if (matchResult.error) {
    throw matchResult.error;
  }
  if (connectionsResult.error) {
    throw connectionsResult.error;
  }
  const answeredCount = answersResult.count ?? 0;
  const runs = (matchResult.data ?? []) as MatchRunRow[];
  const connectionByRunId = new Map(
    ((connectionsResult.data ?? []) as ConnectionRow[]).map((row) => [row.match_run_id, row.state]),
  );

  if (runs.length === 0) {
    return { answeredCount, matches: [] };
  }

  const completedRunIds = runs.filter((run) => run.status === "completed").map((run) => run.id);
  const decisionByRunId = new Map<string, "accept" | "decline">();
  if (completedRunIds.length > 0) {
    const { data: decisions, error: decisionsError } = await client
      .from("decisions")
      .select("match_run_id, kind")
      .eq("owner_id", userId)
      .in("match_run_id", completedRunIds);
    if (decisionsError) throw decisionsError;
    for (const decision of (decisions ?? []) as DecisionRow[]) {
      decisionByRunId.set(decision.match_run_id, decision.kind);
    }
  }

  return {
    answeredCount,
    matches: runs.map((run) => ({
      matchRunId: run.id,
      status: run.status,
      decision: decisionByRunId.get(run.id) ?? null,
      connectionState: connectionByRunId.get(run.id) ?? null,
    })),
  };
}
