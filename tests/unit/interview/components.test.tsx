import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { Progress } from "@/components/interview/progress";
import { QuestionCard } from "@/components/interview/question-card";
import { INTERVIEW_QUESTIONS } from "@/features/interview/domain";

describe("インタビュー画面部品", () => {
  it("渡された1問だけを表示する", () => {
    render(<QuestionCard action={vi.fn()} question={INTERVIEW_QUESTIONS[0]!} />);

    expect(screen.getByRole("heading", { name: "休日の過ごし方に最も近いのは？" })).toBeVisible();
    expect(screen.getAllByRole("button")).toHaveLength(3);
    expect(screen.queryByText("自由な時間は誰と過ごすことが多い？")).not.toBeInTheDocument();
  });

  it("20問回答済みの進捗を20 / 20で示す", () => {
    render(<Progress answeredCount={20} />);

    expect(screen.getByText("20 / 20")).toBeVisible();
    expect(screen.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "20");
    expect(screen.getByRole("progressbar")).toHaveAttribute("aria-valuemax", "20");
  });
});
