import { getOwnedDecision } from "@/features/decision/server/queries";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export type MatchRunStatus = "queued" | "processing" | "completed" | "failed";

export type JourneyMatchSnapshot = {
  matchRunId?: string;
  status: MatchRunStatus;
  decision?: "accept" | "decline" | null;
} | null;

export type JourneySnapshot = {
  answeredCount: number;
  match: JourneyMatchSnapshot;
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
};

const TOTAL_QUESTIONS = 20;

// どの状態でも到達できる共通画面。ホーム、マイページ、お知らせ、設定、プライバシー、FAQ。
const COMMON_PATHS = ["/", "/home", "/mypage", "/notifications", "/settings", "/privacy", "/faq"];

function reportHrefFor(matchRunId: string | undefined): string {
  return matchRunId ? `/report?matchRunId=${matchRunId}` : "/report";
}

// 保存済み状態(回答数、マッチ処理の状況、決定)から、ホームの主操作と
// 直接URLで到達してよい画面を導出する。FR-021, FR-022, FR-036 に対応する。
export function deriveJourneyState(snapshot: JourneySnapshot): DerivedJourney {
  const { answeredCount, match } = snapshot;
  const safeCount = Math.min(Math.max(answeredCount, 0), TOTAL_QUESTIONS);

  if (match === null) {
    if (safeCount >= TOTAL_QUESTIONS) {
      return {
        state: "ready_to_match",
        primaryAction: { label: "アバターにまかせる", href: "/matching" },
        allowedPaths: [...COMMON_PATHS, "/matching", "/interview/complete"],
      };
    }

    const nextOrder = safeCount + 1;
    return {
      state: "interview",
      primaryAction: { label: "インタビューを続ける", href: `/interview/${nextOrder}` },
      allowedPaths: [...COMMON_PATHS, `/interview/${nextOrder}`],
    };
  }

  if (match.status === "queued" || match.status === "processing") {
    return {
      state: "matching",
      primaryAction: { label: "進行状況を見る", href: "/matching" },
      allowedPaths: [...COMMON_PATHS, "/matching"],
    };
  }

  if (match.status === "failed") {
    return {
      state: "match_failed",
      primaryAction: { label: "もう一度試す", href: "/matching" },
      allowedPaths: [...COMMON_PATHS, "/matching"],
    };
  }

  // ここに来る時点でmatch.statusは"completed"
  const reportHref = reportHrefFor(match.matchRunId);

  if (match.decision === "accept") {
    return {
      state: "accepted",
      primaryAction: { label: "開示情報を見る", href: "/reveal" },
      allowedPaths: [...COMMON_PATHS, reportHref, "/reveal"],
    };
  }

  if (match.decision === "decline") {
    return {
      state: "declined",
      primaryAction: { label: "結果を見る", href: "/declined" },
      allowedPaths: [...COMMON_PATHS, reportHref, "/declined"],
    };
  }

  return {
    state: "report_ready",
    primaryAction: { label: "相性レポートを見る", href: reportHref },
    allowedPaths: [...COMMON_PATHS, reportHref],
  };
}

// ホームの「現在の状況」に表示する説明文。
export function describeJourneyState(state: JourneyStateName): string {
  switch (state) {
    case "interview":
      return "あなたのアバターが、あなたらしさを学んでいます。20問の質問に回答してください。";
    case "ready_to_match":
      return "20問の回答が完了しました。アバターに会話を任せましょう。";
    case "matching":
      return "あなたのアバターが、候補アバターと会話を進めています。";
    case "match_failed":
      return "会話の生成に失敗しました。回答は保持されているので、もう一度お試しください。";
    case "report_ready":
      return "相性の高いお相手が見つかりました。会話ログと相性レポートを確認できます。";
    case "accepted":
      return "「会ってみたい」を選びました。開示情報をご確認ください。";
    case "declined":
      return "今回は見送りました。相手へは通知されません。";
    default:
      return "";
  }
}

type MatchRunRow = { id: string; status: MatchRunStatus };

// requireUser済みのownerIdから、ホーム表示に必要な現在状態をDBから取得する。
// RLSで自分の行しか見えない前提のうえ、明示的にowner_idも指定して二重に絞り込む。
export async function getJourneySnapshot(userId: string): Promise<JourneySnapshot> {
  const client = await createServerSupabaseClient();
  const [answersResult, matchResult] = await Promise.all([
    client
      .from("interview_answers")
      .select("question_code", { count: "exact", head: true })
      .eq("owner_id", userId),
    client
      .from("match_runs")
      .select("id, status")
      .eq("owner_id", userId)
      .maybeSingle(),
  ]);

  if (answersResult.error) {
    throw answersResult.error;
  }
  if (matchResult.error) {
    throw matchResult.error;
  }

  const answeredCount = answersResult.count ?? 0;
  const matchRun = matchResult.data as MatchRunRow | null;

  if (!matchRun) {
    return { answeredCount, match: null };
  }

  const decision = matchRun.status === "completed"
    ? await getOwnedDecision(matchRun.id)
    : null;

  return {
    answeredCount,
    match: { matchRunId: matchRun.id, status: matchRun.status, decision },
  };
}
