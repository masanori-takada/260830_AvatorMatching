import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// TextAnswerはuseAnswerSubmit経由でサーバーアクションとルーターへ依存するため、
// コンポーネント単体テストではどちらもモックし、配線の挙動だけを検証する。
const { saveInterviewAnswer, push } = vi.hoisted(() => ({
  saveInterviewAnswer: vi.fn(),
  push: vi.fn(),
}));
vi.mock("@/features/interview/server/actions", () => ({ saveInterviewAnswer }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));

import { TextAnswer } from "@/components/interview/text-answer";
import { INTERVIEW_QUESTIONS } from "@/features/interview/domain";

const q04 = INTERVIEW_QUESTIONS.find((candidate) => candidate.code === "q04");
if (!q04 || q04.kind !== "free_text") {
  throw new Error("q04は自由記述の質問である前提のテストです。");
}
const question = q04;
const userId = "11111111-1111-1111-1111-111111111111";
const draftKey = `avatar-matching:draft:${userId}:q04`;

describe("TextAnswer(自由記述の配線)", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });
  afterEach(cleanup);

  it("マウント時に端末へ一時保存された下書きを復元する", () => {
    localStorage.setItem(draftKey, "書きかけの回答");

    render(<TextAnswer expectedRevision={null} question={question} userId={userId} />);

    expect(screen.getByLabelText("回答を入力")).toHaveValue("書きかけの回答");
  });

  it("送信に失敗すると未保存の表示と再送手段を示し、下書きを端末へ残す", async () => {
    saveInterviewAnswer.mockResolvedValue({
      ok: false,
      error: {
        code: "INTERNAL_ERROR",
        message: "回答を保存できませんでした。もう一度お試しください。",
        retryable: true,
      },
    });

    render(<TextAnswer expectedRevision={null} question={question} userId={userId} />);
    fireEvent.change(screen.getByLabelText("回答を入力"), { target: { value: "途中まで書いた回答" } });
    fireEvent.click(screen.getByRole("button", { name: "送信" }));

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("未保存");
    expect(screen.getByRole("button", { name: "再送する" })).toBeInTheDocument();
    expect(localStorage.getItem(draftKey)).toBe("途中まで書いた回答");
    expect(push).not.toHaveBeenCalled();
  });

  it("再送ボタンで再度送信でき、成功すると下書きが消えて次の質問へ進む", async () => {
    saveInterviewAnswer
      .mockResolvedValueOnce({
        ok: false,
        error: {
          code: "INTERNAL_ERROR",
          message: "回答を保存できませんでした。もう一度お試しください。",
          retryable: true,
        },
      })
      .mockResolvedValueOnce({
        ok: true,
        data: { revision: 2, answeredCount: 4, nextPath: "/interview/5" },
      });

    render(<TextAnswer expectedRevision={1} question={question} userId={userId} />);
    fireEvent.change(screen.getByLabelText("回答を入力"), { target: { value: "夢中になったこと" } });
    fireEvent.click(screen.getByRole("button", { name: "送信" }));
    await screen.findByRole("button", { name: "再送する" });

    fireEvent.click(screen.getByRole("button", { name: "再送する" }));

    await waitFor(() => expect(push).toHaveBeenCalledWith("/interview/5"));
    expect(localStorage.getItem(draftKey)).toBeNull();
  });

  it("送信中はボタンを無効化し二重送信を防ぐ", async () => {
    let resolveSave: (value: unknown) => void = () => {};
    saveInterviewAnswer.mockReturnValue(
      new Promise((resolve) => {
        resolveSave = resolve;
      }),
    );

    render(<TextAnswer expectedRevision={null} question={question} userId={userId} />);
    fireEvent.change(screen.getByLabelText("回答を入力"), { target: { value: "送信中の回答" } });
    fireEvent.click(screen.getByRole("button", { name: "送信" }));

    expect(screen.getByRole("button", { name: "送信" })).toBeDisabled();
    expect(saveInterviewAnswer).toHaveBeenCalledTimes(1);

    resolveSave({ ok: true, data: { revision: 1, answeredCount: 4, nextPath: "/interview/5" } });
    await waitFor(() => expect(push).toHaveBeenCalledWith("/interview/5"));
  });
});
