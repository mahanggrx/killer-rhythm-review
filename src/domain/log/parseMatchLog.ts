import { normalizeMatchLog } from "./normalizeMatchLog";
import type { MatchLog, ValidationResult } from "./types";
import { validateMatchLog } from "./validateMatchLog";

export function parseMatchLogJson(source: string): ValidationResult<MatchLog> {
  let parsed: unknown;

  try {
    parsed = JSON.parse(source) as unknown;
  } catch {
    return {
      ok: false,
      data: null,
      errors: [
        {
          severity: "error",
          code: "JSON_PARSE_ERROR",
          path: "$",
          message: "JSON 语法错误，无法解析日志",
        },
      ],
      warnings: [],
    };
  }

  const result = validateMatchLog(parsed);

  if (!result.ok || result.data === null) {
    return result;
  }

  return {
    ...result,
    data: normalizeMatchLog(result.data),
  };
}

