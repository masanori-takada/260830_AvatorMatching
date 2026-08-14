import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { AppShell } from "@/components/app-shell/app-shell";
import { StatusBar } from "@/components/app-shell/status-bar";

describe("AppShell", () => {
  afterEach(cleanup);

  it("登録後の4タブと現在タブを示す", () => {
    render(
      <AppShell activeTab="home" showNavigation>
        本文
      </AppShell>,
    );

    expect(
      screen.getByRole("navigation", { name: "メインナビゲーション" }),
    ).toBeVisible();
    expect(screen.getByRole("link", { name: "ホーム" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    expect(screen.getAllByRole("link")).toHaveLength(4);
  });

  it("ナビゲーションを省略しても本文をmainに表示する", () => {
    render(<AppShell showNavigation={false}>本文</AppShell>);

    expect(screen.getByRole("main")).toHaveTextContent("本文");
    expect(
      screen.queryByRole("navigation", { name: "メインナビゲーション" }),
    ).not.toBeInTheDocument();
  });
});

describe("StatusBar", () => {
  afterEach(cleanup);

  it("装飾的な端末状態を支援技術から隠す", () => {
    const { container } = render(<StatusBar />);

    expect(container.firstElementChild).toHaveAttribute("aria-hidden", "true");
  });
});
