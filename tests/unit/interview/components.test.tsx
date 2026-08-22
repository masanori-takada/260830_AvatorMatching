import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// TextAnswerがクライアントコンポーネント化されuseRouterを呼ぶため、
// QuestionCardの表示だけを検証するテストでもnext/navigationのモックが必要になる。
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));

import { Progress } from "@/components/interview/progress";
import { QuestionCard } from "@/components/interview/question-card";
import { findInterviewQuestion, TOTAL_QUESTIONS } from "@/features/interview/domain";

const userId = "11111111-1111-1111-1111-111111111111";

describe("インタビュー画面部品", () => {
  beforeEach(() => {
    localStorage.clear();
  });
  afterEach(cleanup);

  it("渡された1問だけを表示する", () => {
    const question = findInterviewQuestion("q01");
    expect(question).toBeDefined();
    render(
      <QuestionCard
        action={vi.fn()}
        expectedRevision={null}
        question={question!}
        userId={userId}
      />,
    );

    expect(screen.getByRole("heading", { name: "休日の過ごし方に最も近いのは？" })).toBeVisible();
    expect(screen.getAllByRole("button")).toHaveLength(3);
    expect(screen.queryByText("自由な時間は誰と過ごすことが多い？")).not.toBeInTheDocument();
  });

  it(`${TOTAL_QUESTIONS}問回答済みの進捗を${TOTAL_QUESTIONS} / ${TOTAL_QUESTIONS}で示す`, () => {
    render(<Progress answeredCount={TOTAL_QUESTIONS} />);

    expect(screen.getByText(`${TOTAL_QUESTIONS} / ${TOTAL_QUESTIONS}`)).toBeVisible();
    expect(screen.getByRole("progressbar")).toHaveAttribute("aria-valuenow", String(TOTAL_QUESTIONS));
    expect(screen.getByRole("progressbar")).toHaveAttribute("aria-valuemax", String(TOTAL_QUESTIONS));
  });

  it("絵文字を含む500文字をサーバーと同じコードポイント単位で扱える", () => {
    const question = findInterviewQuestion("q20");
    expect(question).toBeDefined();
    render(
      <QuestionCard
        action={vi.fn()}
        expectedRevision={null}
        question={question!}
        userId={userId}
      />,
    );

    expect(screen.getByLabelText("回答を入力")).not.toHaveAttribute("maxlength");
    expect(screen.getByText("500文字以内")).toBeVisible();
  });
});
