import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const { getOwnedCompletedReport, getOwnedDecision, getOwnedAcceptedMatchRunId, getOwnedConnectionState } = vi.hoisted(() => ({
  getOwnedCompletedReport: vi.fn(), getOwnedDecision: vi.fn(), getOwnedAcceptedMatchRunId: vi.fn(), getOwnedConnectionState: vi.fn(),
}));
vi.mock("@/features/matching/server/report-query", () => ({ getOwnedCompletedReport }));
vi.mock("@/features/decision/server/queries", () => ({ getOwnedDecision, getOwnedAcceptedMatchRunId, getOwnedConnectionState }));
vi.mock("@/components/report/compatibility-report", () => ({ CompatibilityReport: () => null }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));

import ReportPage from "@/app/(journey)/report/page";

const matchRunId = "11111111-1111-4111-8111-111111111111";

describe("ReportPage decision導線", () => {
  afterEach(() => { cleanup(); vi.clearAllMocks(); });

  it.each([
    ["accept", `/reveal?matchRunId=${matchRunId}`, "承諾済みの開示情報を見る"],
    ["decline", "/declined", "辞退済みの結果を見る"],
  ] as const)("既存%s決定へ明示リンクを出す", async (kind, href, label) => {
    getOwnedCompletedReport.mockResolvedValue({});
    getOwnedDecision.mockResolvedValue(kind);
    getOwnedAcceptedMatchRunId.mockResolvedValue(null);
    getOwnedConnectionState.mockResolvedValue(kind === "accept" ? "profile_revealed" : null);
    render(await ReportPage({ searchParams: Promise.resolve({ matchRunId }) }));
    expect(screen.getByRole("link", { name: label })).toHaveAttribute("href", href);
  });

  it("未決定なら承諾・辞退のダイアログを出す", async () => {
    getOwnedCompletedReport.mockResolvedValue({});
    getOwnedDecision.mockResolvedValue(null);
    getOwnedAcceptedMatchRunId.mockResolvedValue(null);
    getOwnedConnectionState.mockResolvedValue(null);
    render(await ReportPage({ searchParams: Promise.resolve({ matchRunId }) }));
    expect(screen.getByRole("button", { name: "プロフィール開示を希望" })).toBeVisible();
  });

  it("別候補をすでに承諾していれば、この候補は選べないことを示す", async () => {
    getOwnedCompletedReport.mockResolvedValue({});
    getOwnedDecision.mockResolvedValue(null);
    getOwnedAcceptedMatchRunId.mockResolvedValue("22222222-2222-4222-8222-222222222222");
    getOwnedConnectionState.mockResolvedValue(null);
    render(await ReportPage({ searchParams: Promise.resolve({ matchRunId }) }));
    expect(screen.queryByRole("button", { name: "プロフィール開示を希望" })).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "マッチ結果に戻る" })).toHaveAttribute("href", "/matches");
  });
});
