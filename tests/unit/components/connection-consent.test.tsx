import { cleanup, fireEvent, render, screen, act } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { commitContactDecision, push } = vi.hoisted(() => ({
  commitContactDecision: vi.fn(),
  push: vi.fn(),
}));
vi.mock("@/features/connection/server/actions", () => ({ commitContactDecision }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));

import { ContactDecision } from "@/components/connection/contact-decision";

const connectionId = "11111111-1111-4111-8111-111111111111";

describe("ContactDecision", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    Object.defineProperties(HTMLDialogElement.prototype, {
      close: { configurable: true, value(this: HTMLDialogElement) { this.removeAttribute("open"); } },
      showModal: { configurable: true, value(this: HTMLDialogElement) { this.setAttribute("open", ""); } },
    });
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it("連絡希望を押した瞬間にdisabledになり、1.2秒とAction完了後だけchatへ遷移する", async () => {
    let resolveAction: ((value: unknown) => void) | undefined;
    commitContactDecision.mockReturnValue(new Promise((resolve) => { resolveAction = resolve; }));
    render(<ContactDecision connectionId={connectionId} />);

    fireEvent.click(screen.getByRole("button", { name: "連絡を希望する" }));
    const confirm = screen.getByRole("button", { name: "連絡を希望する" });
    fireEvent.click(confirm);
    expect(confirm).toBeDisabled();
    expect(confirm).toHaveAttribute("aria-busy", "true");

    resolveAction?.({ ok: true, data: { state: "connected", connectionId } });
    await act(async () => { await Promise.resolve(); });
    await act(async () => { vi.advanceTimersByTime(1199); });
    expect(push).not.toHaveBeenCalled();
    await act(async () => { vi.advanceTimersByTime(1); });
    expect(push).toHaveBeenCalledWith("/chat");
  });

  it("最終見送り成功後はmatchesへ戻り、失敗時は操作を再開できる", async () => {
    commitContactDecision.mockResolvedValueOnce({ ok: true, data: { state: "closed", connectionId: null } });
    render(<ContactDecision connectionId={connectionId} />);

    fireEvent.click(screen.getByRole("button", { name: "今回は見送る" }));
    fireEvent.click(screen.getByRole("button", { name: "今回は見送る", hidden: true }));
    await act(async () => { await Promise.resolve(); vi.advanceTimersByTime(1200); });
    expect(push).toHaveBeenCalledWith("/matches");

    cleanup();
    commitContactDecision.mockResolvedValueOnce({ ok: false, error: { code: "INTERNAL_ERROR", message: "一時的なエラー", retryable: true } });
    render(<ContactDecision connectionId={connectionId} />);
    fireEvent.click(screen.getByRole("button", { name: "連絡を希望する" }));
    fireEvent.click(screen.getByRole("button", { name: "連絡を希望する" }));
    await act(async () => { await Promise.resolve(); vi.advanceTimersByTime(1200); });
    expect(screen.getByRole("alert")).toHaveTextContent("一時的なエラー");
    expect(screen.getByRole("button", { name: "連絡を希望する" })).not.toBeDisabled();
  });
});
