import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { commitDecision, push } = vi.hoisted(() => ({ commitDecision: vi.fn(), push: vi.fn() }));
vi.mock("@/features/decision/server/actions", () => ({ commitDecision }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));

import { DecisionDialog } from "@/components/feedback/decision-dialog";

describe("DecisionDialog", () => {
  beforeEach(() => {
    Object.defineProperties(HTMLDialogElement.prototype, {
      close: { configurable: true, value(this: HTMLDialogElement) { this.removeAttribute("open"); } },
      showModal: { configurable: true, value(this: HTMLDialogElement) { this.setAttribute("open", ""); } },
    });
    vi.clearAllMocks();
  });
  afterEach(cleanup);

  it("承諾を明示確認し確認ボタンへfocusして成功後だけ遷移する", async () => {
    commitDecision.mockResolvedValue({ ok: true, data: { kind: "accept", nextPath: "/reveal" } });
    render(<DecisionDialog matchRunId="11111111-1111-4111-8111-111111111111" />);
    fireEvent.click(screen.getByRole("button", { name: "承諾する" }));
    const confirm = screen.getByRole("button", { name: "承諾を確定する" });
    await waitFor(() => expect(confirm).toHaveFocus());
    fireEvent.click(confirm);
    await waitFor(() => expect(push).toHaveBeenCalledWith("/reveal"));
  });

  it("cancelで決定せずdialogを閉じる", async () => {
    render(<DecisionDialog matchRunId="11111111-1111-4111-8111-111111111111" />);
    fireEvent.click(screen.getByRole("button", { name: "辞退する" }));
    const dialog = screen.getByRole("dialog", { name: "辞退を確認" });
    dialog.dispatchEvent(new Event("cancel", { bubbles: true, cancelable: true }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(commitDecision).not.toHaveBeenCalled();
  });

  it("別tabで承諾済みなら辞退送信の競合後も保存済みのrevealへ遷移する", async () => {
    commitDecision.mockResolvedValue({
      ok: false,
      error: {
        code: "STATE_CONFLICT",
        message: "すでに承諾が確定しています。",
        retryable: false,
        details: { storedDecision: "accept", nextPath: "/reveal" },
      },
    });
    render(<DecisionDialog matchRunId="11111111-1111-4111-8111-111111111111" />);
    fireEvent.click(screen.getByRole("button", { name: "辞退する" }));
    fireEvent.click(screen.getByRole("button", { name: "辞退を確定する" }));
    await waitFor(() => expect(push).toHaveBeenCalledWith("/reveal"));
  });
});
