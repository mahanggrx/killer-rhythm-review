import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import lateFirstElimination from "../data/samples/late-first-elimination.json";
import validSample from "../data/samples/valid-base-match.json";
import { App } from "./App";

describe("App", () => {
  it("默认展示首追过长样例及其真实分析结果", () => {
    render(<App />);

    expect(screen.getByRole("heading", { name: "杀手节奏复盘反馈系统" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "首次追逐持续较长" })).toBeInTheDocument();
    expect(screen.getByText("78 秒", { selector: ".metric-card__value" })).toBeInTheDocument();
    expect(screen.getByText("原型待验证数值")).toBeInTheDocument();
    expect(screen.queryByLabelText("分析阶段")).not.toBeInTheDocument();
  });

  it("选择样例后重新校验、计算并更新主要反馈", () => {
    render(<App />);

    fireEvent.change(screen.getByLabelText("选择合成样例"), {
      target: { value: "late-first-elimination" },
    });

    expect(screen.getByRole("heading", { name: "首次永久减员形成较晚" })).toBeInTheDocument();
    expect(screen.getByText("1", { selector: ".metric-card__value" })).toBeInTheDocument();
  });

  it("修改阈值后立即使用统一分析入口更新为无明确断点，并可恢复默认", () => {
    render(<App />);
    const threshold = screen.getByLabelText("首次追逐时长阈值");

    fireEvent.change(threshold, { target: { value: "100" } });
    expect(screen.getByRole("heading", { name: "未发现明确主要断点" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /恢复默认值/ }));
    expect(screen.getByRole("heading", { name: "首次追逐持续较长" })).toBeInTheDocument();
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

  it("支持把 JSON 文件拖入上传区域并立即分析", async () => {
    render(<App />);
    const source = JSON.stringify(lateFirstElimination);
    const file = new File([source], "dragged-match.json", {
      type: "application/json",
    });
    Object.defineProperty(file, "text", { value: () => Promise.resolve(source) });
    const dropzone = screen.getByRole("button", { name: /拖动 JSON 文件到这里/ });
    const dataTransfer = { files: [file], types: ["Files"], dropEffect: "none" };

    fireEvent.dragEnter(dropzone, { dataTransfer });
    expect(dropzone).toHaveClass("json-dropzone--active");
    fireEvent.drop(dropzone, { dataTransfer });

    expect(await screen.findByRole("heading", { name: "首次永久减员形成较晚" })).toBeInTheDocument();
    expect(screen.getByText("dragged-match.json", { selector: ".source-status strong" })).toBeInTheDocument();
    expect(dropzone).not.toHaveClass("json-dropzone--active");
  });

  it("拖入非 JSON 文件时给出明确错误且不读取文件", async () => {
    render(<App />);
    const file = new File(["not json"], "notes.txt", { type: "text/plain" });
    const dropzone = screen.getByRole("button", { name: /拖动 JSON 文件到这里/ });

    fireEvent.drop(dropzone, {
      dataTransfer: { files: [file], types: ["Files"], dropEffect: "none" },
    });

    expect(await screen.findByText(/只支持 \.json 格式/)).toBeInTheDocument();
    expect(screen.getByText("样例 01 · 首追过长", { selector: ".source-status strong" })).toBeInTheDocument();
  });

  it("点击时间线节点展示事件详情", async () => {
    render(<App />);
    const chaseButtons = screen.getAllByRole("button", { name: /追逐开始/ });

    fireEvent.click(chaseButtons[0]);

    await waitFor(() => expect(screen.getByText("fc-002")).toBeInTheDocument());
    expect(screen.getByText("追逐 ID")).toBeInTheDocument();
  });

  it("在折叠明细中展示日志语义警告的具体内容", async () => {
    render(<App />);
    const source = {
      ...structuredClone(validSample),
      unsupportedMechanics: ["hook_stage_transfer"],
    };
    const file = new File([JSON.stringify(source)], "warning.json", {
      type: "application/json",
    });
    Object.defineProperty(file, "text", {
      value: () => Promise.resolve(JSON.stringify(source)),
    });

    fireEvent.change(screen.getByLabelText("上传 JSON 文件"), {
      target: { files: [file] },
    });

    expect(await screen.findByText(/日志包含 1 条语义警告/)).toBeInTheDocument();
    fireEvent.click(screen.getByText("完整分析明细"));
    expect(screen.getByText(/UNSUPPORTED_MECHANICS_DECLARED/)).toBeInTheDocument();
    expect(screen.getByText(/hook_stage_transfer|基础规则集之外的机制/)).toBeInTheDocument();
  });

  it("文件读取失败和无效阈值不会让页面崩溃或污染分析配置", async () => {
    render(<App />);
    const threshold = screen.getByLabelText("首次追逐时长阈值");
    fireEvent.change(threshold, { target: { value: "-1" } });
    expect(threshold).toHaveValue(75);
    expect(screen.getByRole("heading", { name: "首次追逐持续较长" })).toBeInTheDocument();

    const file = new File([""], "unreadable.json", { type: "application/json" });
    Object.defineProperty(file, "text", {
      value: () => Promise.reject(new Error("read failed")),
    });
    fireEvent.change(screen.getByLabelText("上传 JSON 文件"), {
      target: { files: [file] },
    });

    expect(await screen.findByRole("heading", { name: "暂时无法导入这份日志" })).toBeInTheDocument();
    expect(screen.getByText(/unreadable.json/)).toBeInTheDocument();
  });

  it("覆盖上传日志、校验分析和修改减员阈值的主流程", async () => {
    render(<App />);
    const source = JSON.stringify(lateFirstElimination);
    const file = new File([source], "late-elimination.json", {
      type: "application/json",
    });
    Object.defineProperty(file, "text", { value: () => Promise.resolve(source) });

    fireEvent.change(screen.getByLabelText("上传 JSON 文件"), {
      target: { files: [file] },
    });

    expect(await screen.findByRole("heading", { name: "首次永久减员形成较晚" })).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("首次减员剩余发电机阈值"), {
      target: { value: "0" },
    });
    expect(screen.getByRole("heading", { name: "未发现明确主要断点" })).toBeInTheDocument();
  });

  it("按指标生成日志、通过回算并立即进入现有分析流程", () => {
    render(<App />);

    fireEvent.click(screen.getByRole("button", { name: /按指标生成日志/ }));
    fireEvent.change(screen.getByLabelText("平均追逐空窗（秒）"), {
      target: { value: "50" },
    });
    fireEvent.change(screen.getByLabelText("首次追逐持续时间（秒）"), {
      target: { value: "20" },
    });
    fireEvent.change(screen.getByLabelText("首次减员时剩余发电机"), {
      target: { value: "3" },
    });
    fireEvent.click(screen.getByRole("button", { name: /生成并分析/ }));

    expect(screen.getByText("已通过日志校验与指标回算")).toBeInTheDocument();
    expect(screen.getByText("自定义合成日志", { selector: ".source-status strong" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "有效接敌空窗较长" })).toBeInTheDocument();
    expect((screen.getByLabelText("生成的 JSON") as HTMLTextAreaElement).value)
      .toContain('"matchId": "synthetic-50-20-3-c2-d20_20-a1-l2-i0-e1"');
  });

  it("填写高级设置后生成并展示全部回算结果", () => {
    render(<App />);

    fireEvent.click(screen.getByRole("button", { name: /按指标生成日志/ }));
    fireEvent.click(screen.getByText("高级设置"));

    expect(screen.getByText(/若在下一次杀手造成即时掉进度、开始回退或封锁前完成/))
      .toBeInTheDocument();
    expect(screen.getByText(/逃生者自行停修不计/)).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("完整追逐次数"), {
      target: { value: "4" },
    });
    fireEvent.change(screen.getByLabelText("平均追逐持续时间（秒）"), {
      target: { value: "40" },
    });
    fireEvent.change(screen.getByLabelText("目标丢失或转火次数"), {
      target: { value: "2" },
    });
    fireEvent.change(screen.getByLabelText("达到 70% 后、掉进度回退封锁前完成的电机数量"), {
      target: { value: "1" },
    });
    fireEvent.change(screen.getByLabelText("进度达到 70% 时生效的掉进度回退封锁次数"), {
      target: { value: "3" },
    });
    fireEvent.change(screen.getByLabelText("最终永久减员数"), {
      target: { value: "2" },
    });
    fireEvent.click(screen.getByRole("button", { name: /生成并分析/ }));

    expect(screen.getByText("已通过日志校验与指标回算")).toBeInTheDocument();
    const verificationLabel = (name: string) => screen.getByText(name, {
      selector: ".generator-verification dt",
    }).parentElement;

    expect(verificationLabel("完整追逐")).toHaveTextContent("4 次");
    expect(verificationLabel("平均追逐时长")).toHaveTextContent("40 秒");
    expect(verificationLabel("目标丢失或转火")).toHaveTextContent("2 次");
    expect(verificationLabel("≥ 70% 后、掉进度／回退／封锁前完成")).toHaveTextContent("1 台");
    expect(verificationLabel("≥ 70% 时生效的掉进度／回退／封锁")).toHaveTextContent("3 次");
    expect(verificationLabel("最终永久减员")).toHaveTextContent("2 人");
  });
});
