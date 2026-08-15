import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const { getOwnedCompletedReport, getOwnedDecision } = vi.hoisted(() => ({
  getOwnedCompletedReport: vi.fn(), getOwnedDecision: vi.fn(),
}));
vi.mock("@/features/matching/server/report-query", () => ({ getOwnedCompletedReport }));
vi.mock("@/features/decision/server/queries", () => ({ getOwnedDecision }));
vi.mock("@/components/report/compatibility-report", () => ({ CompatibilityReport: () => null }));

import ReportPage from "@/app/(journey)/report/page";

describe("ReportPage decision導線", () => {
  afterEach(() => { cleanup(); vi.clearAllMocks(); });

  it.each([
    ["accept", "/reveal", "承諾済みの開示情報を見る"],
    ["decline", "/declined", "辞退済みの結果を見る"],
  ] as const)("既存%s決定へ明示リンクを出す", async (kind, href, label) => {
    getOwnedCompletedReport.mockResolvedValue({});
    getOwnedDecision.mockResolvedValue(kind);
    render(await ReportPage({ searchParams: Promise.resolve({ matchRunId: "11111111-1111-4111-8111-111111111111" }) }));
    expect(screen.getByRole("link", { name: label })).toHaveAttribute("href", href);
  });
});
