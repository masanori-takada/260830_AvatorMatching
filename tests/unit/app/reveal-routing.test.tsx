import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const { getOwnedCompletedReport, getOwnedDecision, getOwnedAcceptedMatchRunId, getOwnedConnectionState } = vi.hoisted(() => ({
  getOwnedCompletedReport: vi.fn(),
  getOwnedDecision: vi.fn(),
  getOwnedAcceptedMatchRunId: vi.fn(),
  getOwnedConnectionState: vi.fn(),
}));
vi.mock("@/features/matching/server/report-query", () => ({ getOwnedCompletedReport }));
vi.mock("@/features/decision/server/queries", () => ({ getOwnedDecision, getOwnedAcceptedMatchRunId, getOwnedConnectionState }));
vi.mock("@/components/report/compatibility-report", () => ({ CompatibilityReport: () => null }));
vi.mock("@/components/feedback/decision-dialog", () => ({ DecisionDialog: () => <button>プロフィール開示を希望</button> }));

import ReportPage from "@/app/(journey)/report/page";

const matchRunId = "11111111-1111-4111-8111-111111111111";

describe("ReportPageの候補別承認導線", () => {
  afterEach(() => { cleanup(); vi.clearAllMocks(); });

  it("プロフィール開示済みの候補だけをmatchRunId付きrevealへ送る", async () => {
    getOwnedCompletedReport.mockResolvedValue({});
    getOwnedDecision.mockResolvedValue("accept");
    getOwnedAcceptedMatchRunId.mockResolvedValue(matchRunId);
    getOwnedConnectionState.mockResolvedValue("profile_revealed");
    render(await ReportPage({ searchParams: Promise.resolve({ matchRunId }) }));
    expect(screen.getByRole("link", { name: "承諾済みの開示情報を見る" })).toHaveAttribute("href", `/reveal?matchRunId=${matchRunId}`);
  });

  it("最終見送り後は別候補を選ぶ導線を表示する", async () => {
    getOwnedCompletedReport.mockResolvedValue({});
    getOwnedDecision.mockResolvedValue("accept");
    getOwnedAcceptedMatchRunId.mockResolvedValue(null);
    getOwnedConnectionState.mockResolvedValue("closed");
    render(await ReportPage({ searchParams: Promise.resolve({ matchRunId }) }));
    expect(screen.getByText("今回は見送りました。別の候補を選べます。")).toBeVisible();
    expect(screen.getByRole("link", { name: "別の候補を選ぶ" })).toHaveAttribute("href", "/matches");
  });

  it("connected済みの候補はchatへ送る", async () => {
    getOwnedCompletedReport.mockResolvedValue({});
    getOwnedDecision.mockResolvedValue("accept");
    getOwnedAcceptedMatchRunId.mockResolvedValue(matchRunId);
    getOwnedConnectionState.mockResolvedValue("connected");
    render(await ReportPage({ searchParams: Promise.resolve({ matchRunId }) }));
    expect(screen.getByRole("link", { name: "チャットを開く" })).toHaveAttribute("href", "/chat");
  });

  it("profile_pendingでは安全な開示情報への導線を出さない", async () => {
    getOwnedCompletedReport.mockResolvedValue({});
    getOwnedDecision.mockResolvedValue("accept");
    getOwnedAcceptedMatchRunId.mockResolvedValue(matchRunId);
    getOwnedConnectionState.mockResolvedValue("profile_pending");
    render(await ReportPage({ searchParams: Promise.resolve({ matchRunId }) }));
    expect(screen.queryByRole("link", { name: "承諾済みの開示情報を見る" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "チャットを開く" })).not.toBeInTheDocument();
  });
});
