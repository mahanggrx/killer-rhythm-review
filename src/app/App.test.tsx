import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import lateFirstElimination from "../data/samples/late-first-elimination.json";
import validSample from "../data/samples/valid-base-match.json";
import { App } from "./App";

describe("App", () => {
  it("默认展示Late First Chase样例及其真实分析结果", () => {
    render(<App />);

    expect(screen.getByRole("heading", { name: "Killer Match Review" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Late First Chase" })).toBeInTheDocument();
    expect(screen.getByText("50 s", { selector: ".metric-card__value" })).toBeInTheDocument();
    expect(screen.getByText("Unvalidated Prototype Thresholds")).toBeInTheDocument();
    expect(screen.queryByLabelText("分析阶段")).not.toBeInTheDocument();
  });

  it("选择样例后重新校验、计算并更新主要反馈", () => {
    render(<App />);

    fireEvent.change(screen.getByLabelText("Select Sample Match"), {
      target: { value: "late-first-elimination" },
    });

    expect(screen.getByRole("heading", { name: "Late First Elimination" })).toBeInTheDocument();
    expect(screen.getByText("1", { selector: ".metric-card__value" })).toBeInTheDocument();
  });

  it("修改阈值后立即使用统一分析入口更新为无明确断点，并可恢复默认", () => {
    render(<App />);
    const threshold = screen.getByLabelText("First-chase threshold");

    fireEvent.change(threshold, { target: { value: "100" } });
    expect(screen.getByRole("heading", { name: "No Clear Pacing Issue" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /Reset Defaults/ }));
    expect(screen.getByRole("heading", { name: "Late First Chase" })).toBeInTheDocument();
  });

  it("上传非法 JSON 时安全显示解析错误", async () => {
    render(<App />);
    const file = new File(["{ bad json"], "broken.json", { type: "application/json" });
    Object.defineProperty(file, "text", { value: () => Promise.resolve("{ bad json") });

    fireEvent.change(screen.getByLabelText("Upload JSON file"), { target: { files: [file] } });

    expect(await screen.findByRole("heading", { name: "Unable to Analyze This Log" })).toBeInTheDocument();
    expect(screen.getByText("JSON syntax error; unable to parse the match log")).toBeInTheDocument();
    expect(screen.getByText("broken.json")).toBeInTheDocument();
  });

  it("支持把 JSON 文件拖入上传区域并立即分析", async () => {
    render(<App />);
    const source = JSON.stringify(lateFirstElimination);
    const file = new File([source], "dragged-match.json", {
      type: "application/json",
    });
    Object.defineProperty(file, "text", { value: () => Promise.resolve(source) });
    const dropzone = screen.getByRole("button", { name: /Drop a JSON file here/ });
    const dataTransfer = { files: [file], types: ["Files"], dropEffect: "none" };

    fireEvent.dragEnter(dropzone, { dataTransfer });
    expect(dropzone).toHaveClass("json-dropzone--active");
    fireEvent.drop(dropzone, { dataTransfer });

    expect(await screen.findByRole("heading", { name: "Late First Elimination" })).toBeInTheDocument();
    expect(screen.getByText("dragged-match.json", { selector: ".source-status strong" })).toBeInTheDocument();
    expect(dropzone).not.toHaveClass("json-dropzone--active");
  });

  it("拖入非 JSON 文件时给出明确错误且不读取文件", async () => {
    render(<App />);
    const file = new File(["not json"], "notes.txt", { type: "text/plain" });
    const dropzone = screen.getByRole("button", { name: /Drop a JSON file here/ });

    fireEvent.drop(dropzone, {
      dataTransfer: { files: [file], types: ["Files"], dropEffect: "none" },
    });

    expect(await screen.findByText(/Please select a \.json file/)).toBeInTheDocument();
    expect(screen.getByText("Sample 01 · Late First Chase", { selector: ".source-status strong" })).toBeInTheDocument();
  });

  it("点击时间线节点展示事件详情", async () => {
    render(<App />);
    const chaseButtons = screen.getAllByRole("button", { name: /Chase Started/ });

    fireEvent.click(chaseButtons[0]);

    await waitFor(() => expect(screen.getByText("fs-004")).toBeInTheDocument());
    expect(screen.getByText("Chase ID")).toBeInTheDocument();
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

    fireEvent.change(screen.getByLabelText("Upload JSON file"), {
      target: { files: [file] },
    });

    expect(await screen.findByText(/1 log warning/)).toBeInTheDocument();
    fireEvent.click(screen.getByText("Analysis Details"));
    expect(screen.getByText(/UNSUPPORTED_MECHANICS_DECLARED/)).toBeInTheDocument();
    expect(screen.getByText(/hook_stage_transfer|outside the supported base ruleset/)).toBeInTheDocument();
  });

  it("文件读取失败和无效阈值不会让页面崩溃或污染分析配置", async () => {
    render(<App />);
    const threshold = screen.getByLabelText("First-chase threshold");
    fireEvent.change(threshold, { target: { value: "-1" } });
    expect(threshold).toHaveValue(30);
    expect(screen.getByRole("heading", { name: "Late First Chase" })).toBeInTheDocument();

    const file = new File([""], "unreadable.json", { type: "application/json" });
    Object.defineProperty(file, "text", {
      value: () => Promise.reject(new Error("read failed")),
    });
    fireEvent.change(screen.getByLabelText("Upload JSON file"), {
      target: { files: [file] },
    });

    expect(await screen.findByRole("heading", { name: "Unable to Import This File" })).toBeInTheDocument();
    expect(screen.getByText(/unreadable.json/)).toBeInTheDocument();
  });

  it("覆盖上传日志、校验分析和修改减员阈值的主流程", async () => {
    render(<App />);
    const source = JSON.stringify(lateFirstElimination);
    const file = new File([source], "late-elimination.json", {
      type: "application/json",
    });
    Object.defineProperty(file, "text", { value: () => Promise.resolve(source) });

    fireEvent.change(screen.getByLabelText("Upload JSON file"), {
      target: { files: [file] },
    });

    expect(await screen.findByRole("heading", { name: "Late First Elimination" })).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Remaining generators threshold"), {
      target: { value: "0" },
    });
    expect(screen.getByRole("heading", { name: "No Clear Pacing Issue" })).toBeInTheDocument();
  });

  it("Build a Synthetic Log、通过回算并立即进入现有分析流程", () => {
    render(<App />);

    fireEvent.click(screen.getByRole("button", { name: /Build a Synthetic Log/ }));
    fireEvent.change(screen.getByLabelText("Time to First Chase (sec)"), {
      target: { value: "20" },
    });
    fireEvent.change(screen.getByLabelText("Average Chase Duration (sec)"), {
      target: { value: "60" },
    });
    fireEvent.change(screen.getByLabelText("Generators Left at First Elimination"), {
      target: { value: "3" },
    });
    fireEvent.click(screen.getByRole("button", { name: /Generate & Analyze/ }));

    expect(screen.getByText("Log Validated & Metrics Recalculated")).toBeInTheDocument();
    expect(screen.getByText("Custom Synthetic Log", { selector: ".source-status strong" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Long Average Chase" })).toBeInTheDocument();
    expect((screen.getByLabelText("Generated JSON") as HTMLTextAreaElement).value)
      .toContain('"matchId": "synthetic-f20-avg60-3-c2-d60_60-a1-l2-i0-e1"');
  });

  it("填写Advanced Settings后生成并展示全部回算结果", () => {
    render(<App />);

    fireEvent.click(screen.getByRole("button", { name: /Build a Synthetic Log/ }));
    fireEvent.click(screen.getByText("Advanced Settings"));

    expect(screen.getByText(/Interference requires an actual progress loss, regression, or block/))
      .toBeInTheDocument();
    expect(screen.getByText(/Survivors stopping repairs does not count/)).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Completed Chase Count"), {
      target: { value: "4" },
    });
    fireEvent.change(screen.getByLabelText("First Chase Duration (sec)"), {
      target: { value: "40" },
    });
    fireEvent.change(screen.getByLabelText("Lost or Switched Chases"), {
      target: { value: "2" },
    });
    fireEvent.change(screen.getByLabelText("Generators completed at 70% without interference"), {
      target: { value: "1" },
    });
    fireEvent.change(screen.getByLabelText("Killer interference actions at ≥ 70%"), {
      target: { value: "3" },
    });
    fireEvent.change(screen.getByLabelText("Total Eliminations"), {
      target: { value: "2" },
    });
    fireEvent.click(screen.getByRole("button", { name: /Generate & Analyze/ }));

    expect(screen.getByText("Log Validated & Metrics Recalculated")).toBeInTheDocument();
    const verificationLabel = (name: string) => screen.getByText(name, {
      selector: ".generator-verification dt",
    }).parentElement;

    expect(verificationLabel("Completed Chases")).toHaveTextContent("4 chases");
    expect(verificationLabel("Average Chase")).toHaveTextContent("30 sec");
    expect(verificationLabel("First Chase Duration")).toHaveTextContent("40 sec");
    expect(verificationLabel("Lost/Switched Chases")).toHaveTextContent("2 chases");
    expect(verificationLabel("Generators completed at ≥ 70% without interference")).toHaveTextContent("1 generator(s)");
    expect(verificationLabel("Interference actions at ≥ 70%")).toHaveTextContent("3 action(s)");
    expect(verificationLabel("Total Eliminations")).toHaveTextContent("2 Survivors");
  });
});
