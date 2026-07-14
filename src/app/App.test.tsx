import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { App } from "./App";

describe("App", () => {
  it("默认展示首追过长样例及其真实分析结果", () => {
    render(<App />);

    expect(screen.getByRole("heading", { name: /把一局的失速时刻/ })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "首次挂钩形成较晚" })).toBeInTheDocument();
    expect(screen.getByText("88 秒", { selector: ".metric-card__value" })).toBeInTheDocument();
    expect(screen.getByText("原型待验证数值")).toBeInTheDocument();
  });

  it("选择样例后重新校验、计算并更新主要反馈", () => {
    render(<App />);

    fireEvent.change(screen.getByLabelText("选择合成样例"), {
      target: { value: "high-progress-generators-lost" },
    });

    expect(screen.getByRole("heading", { name: "高进度发电机回防不足" })).toBeInTheDocument();
    expect(screen.getByText("2", { selector: ".metric-card__value" })).toBeInTheDocument();
  });

  it("修改阈值后立即使用统一分析入口更新为无明确断点，并可恢复默认", () => {
    render(<App />);
    const threshold = screen.getByLabelText("首次挂钩阈值");

    fireEvent.change(threshold, { target: { value: "100" } });
    expect(screen.getByRole("heading", { name: "未发现明确主要断点" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /恢复默认值/ }));
    expect(screen.getByRole("heading", { name: "首次挂钩形成较晚" })).toBeInTheDocument();
  });

  it("上传非法 JSON 时安全显示解析错误", async () => {
    render(<App />);
    const file = new File(["{ bad json"], "broken.json", { type: "application/json" });
    Object.defineProperty(file, "text", { value: () => Promise.resolve("{ bad json") });

    fireEvent.change(screen.getByLabelText("上传 JSON 文件"), { target: { files: [file] } });

    expect(await screen.findByRole("heading", { name: "暂时无法分析这份日志" })).toBeInTheDocument();
    expect(screen.getByText("JSON 语法错误，无法解析日志")).toBeInTheDocument();
    expect(screen.getByText("broken.json")).toBeInTheDocument();
  });

  it("点击时间线节点展示事件详情", async () => {
    render(<App />);
    const chaseButtons = screen.getAllByRole("button", { name: /追逐开始/ });

    fireEvent.click(chaseButtons[0]);

    await waitFor(() => expect(screen.getByText("fc-003")).toBeInTheDocument());
    expect(screen.getByText("追逐 ID")).toBeInTheDocument();
  });
});
