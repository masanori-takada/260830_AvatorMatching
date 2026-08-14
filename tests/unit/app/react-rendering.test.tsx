import { render, screen } from "@testing-library/react";
import { expect, it } from "vitest";

it("React要素をDOMへ描画できる", () => {
  render(<p>DOM描画確認</p>);

  expect(screen.getByText("DOM描画確認")).toBeInTheDocument();
});
