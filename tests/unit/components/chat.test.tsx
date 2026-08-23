import { cleanup, fireEvent, render, screen, act } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { sendChatMessage } = vi.hoisted(() => ({ sendChatMessage: vi.fn() }));
vi.mock("@/features/chat/server/actions", () => ({ sendChatMessage }));

import { ChatView } from "@/components/chat/chat-view";

const connectionId = "11111111-1111-4111-8111-111111111111";

describe("ChatView", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it("候補の固定挨拶を表示し、trim済みowner発言を1.2秒pending後に追加する", async () => {
    sendChatMessage.mockResolvedValue({ ok: true, data: { messageId: "message-2" } });
    render(<ChatView connectionId={connectionId} candidate={{ firstName: "ルナ", photoPath: "/images/demo-candidates/luna.webp", isAiGenerated: true }} messages={[{
      id: "message-1", sender: "candidate", body: "まずは気軽にお話ししませんか？", createdAt: "2026-08-23T00:00:00Z",
    }]} />);

    expect(screen.getByText("まずは気軽にお話ししませんか？")).toBeVisible();
    const composer = screen.getByRole("textbox", { name: "メッセージ" });
    fireEvent.change(composer, { target: { value: "  こんにちは  " } });
    const submit = screen.getByRole("button", { name: "送信" });
    fireEvent.click(submit);
    expect(submit).toBeDisabled();
    expect(sendChatMessage).toHaveBeenCalledWith({ connectionId, text: "こんにちは" });
    await act(async () => { await Promise.resolve(); vi.advanceTimersByTime(1199); });
    expect(screen.queryByText("こんにちは")).not.toBeInTheDocument();
    await act(async () => { vi.advanceTimersByTime(1); });
    expect(screen.getByText("こんにちは")).toBeVisible();
  });

  it("空白だけの送信を拒否し、入力上限を1000文字にする", () => {
    render(<ChatView connectionId={connectionId} candidate={{ firstName: "ルナ", photoPath: null, isAiGenerated: true }} messages={[]} />);
    const composer = screen.getByRole("textbox", { name: "メッセージ" });
    expect(composer).toHaveAttribute("maxLength", "1000");
    fireEvent.change(composer, { target: { value: "   " } });
    fireEvent.click(screen.getByRole("button", { name: "送信" }));
    expect(sendChatMessage).not.toHaveBeenCalled();
    expect(screen.getByRole("alert")).toHaveTextContent("メッセージを入力してください");
  });

  it("同じ描画フレームで二重送信されても永続化要求を1回だけ行う", () => {
    sendChatMessage.mockReturnValue(new Promise(() => undefined));
    render(<ChatView connectionId={connectionId} candidate={{ firstName: "ルナ", photoPath: null, isAiGenerated: true }} messages={[]} />);
    const composer = screen.getByRole("textbox", { name: "メッセージ" });
    fireEvent.change(composer, { target: { value: "二重送信しない" } });
    const form = composer.closest("form");
    expect(form).not.toBeNull();

    act(() => {
      fireEvent.submit(form!);
      fireEvent.submit(form!);
    });

    expect(sendChatMessage).toHaveBeenCalledTimes(1);
  });
});
