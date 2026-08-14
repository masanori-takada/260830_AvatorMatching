import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ActionError } from "@/components/feedback/action-error";
import { LoadingOverlay } from "@/components/feedback/loading-overlay";

describe("ActionError", () => {
  afterEach(cleanup);

  it("失敗理由と再試行操作を伝える", () => {
    const onRetry = vi.fn();

    render(<ActionError message="通信を確認してください。" onRetry={onRetry} />);

    expect(screen.getByRole("alert")).toHaveTextContent(
      "操作を完了できませんでした通信を確認してください。",
    );
    fireEvent.click(screen.getByRole("button", { name: "もう一度試す" }));
    expect(onRetry).toHaveBeenCalledOnce();
  });

  it("再試行できない失敗では操作を表示しない", () => {
    render(<ActionError message="時間をおいて確認してください。" />);

    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });
});

describe("LoadingOverlay", () => {
  beforeEach(() => {
    Object.defineProperties(HTMLDialogElement.prototype, {
      close: {
        configurable: true,
        value(this: HTMLDialogElement) {
          this.removeAttribute("open");
        },
      },
      showModal: {
        configurable: true,
        value(this: HTMLDialogElement) {
          this.setAttribute("open", "");
        },
      },
    });
  });

  afterEach(cleanup);

  it("背面を操作できないbusyなモーダルとして開きフォーカスを保持する", async () => {
    render(<LoadingOverlay label="照合しています" />);

    const dialog = screen.getByRole("dialog", { name: "照合しています" });
    await waitFor(() => expect(dialog).toHaveAttribute("open"));

    expect(dialog).toHaveAttribute("aria-modal", "true");
    expect(dialog).toHaveAttribute("aria-busy", "true");
    expect(dialog).toHaveFocus();
  });

  it("キャンセル操作では閉じない", async () => {
    render(<LoadingOverlay />);

    const dialog = screen.getByRole("dialog", { name: "読み込んでいます" });
    await waitFor(() => expect(dialog).toHaveAttribute("open"));
    const cancelEvent = new Event("cancel", { cancelable: true });
    dialog.dispatchEvent(cancelEvent);

    expect(cancelEvent.defaultPrevented).toBe(true);
    expect(dialog).toHaveAttribute("open");
  });

  it("読み込み中でなければ表示しない", () => {
    render(<LoadingOverlay isLoading={false} />);

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});
