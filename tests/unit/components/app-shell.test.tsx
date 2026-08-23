import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { AppShell } from "@/components/app-shell/app-shell";

describe("AppShell", () => {
  afterEach(cleanup);

  it("登録後の5タブと現在タブを示す", () => {
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
    expect(screen.getAllByRole("link")).toHaveLength(5);
    expect(screen.getByRole("link", { name: "チャット" })).toHaveAttribute("href", "/chat");
  });

  it("ナビゲーションを省略しても本文をmainに表示する", () => {
    render(<AppShell showNavigation={false}>本文</AppShell>);

    expect(screen.getByRole("main")).toHaveTextContent("本文");
    expect(
      screen.queryByRole("navigation", { name: "メインナビゲーション" }),
    ).not.toBeInTheDocument();
  });

  it("ダミーの時刻・ステータスアイコン・上部の空き領域を表示しない", () => {
    render(<AppShell>本文</AppShell>);

    const appScreen = screen.getByRole("region", { name: "アプリ画面" });

    expect(screen.queryByText("9:41")).not.toBeInTheDocument();
    expect(appScreen.querySelector("svg")).not.toBeInTheDocument();
    expect(appScreen.firstElementChild).toBe(screen.getByRole("main"));
  });
});
