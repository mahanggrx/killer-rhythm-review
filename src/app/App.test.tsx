import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { App } from "./App";

describe("App", () => {
  it("显示系统名称", () => {
    render(<App />);

    expect(
      screen.getByRole("heading", { name: "杀手节奏复盘反馈系统" }),
    ).toBeInTheDocument();
  });
});

