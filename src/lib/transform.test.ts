import { describe, it, expect } from "vitest";
import {
  cleanText,
  processLines,
  encodeText,
  generatePassword,
  parseColor,
  parseTimestamp,
} from "./transform";
import { searchTools } from "./tools";

describe("文本和编码的实际输入边界", () => {
  it("清理 Windows 换行而不丢失中文", () => {
    expect(
      cleanText("  你好  世界 \r\n\r\n Test ", {
        trim: true,
        empty: true,
        spaces: true,
        case: "lower",
      }),
    ).toBe("你好 世界\ntest");
    expect(processLines("2\r\n10\r\n2\r\n1\r\n", true, true, "asc")).toBe(
      "1\n2\n10",
    );
  });
  it("Base64 完整往返中文和 emoji", () => {
    const input = "你好，世界 👩‍💻 café";
    expect(encodeText(encodeText(input, "base64", false), "base64", true)).toBe(
      input,
    );
    expect(() => encodeText("!!!", "base64", true)).toThrow();
    expect(() => encodeText("%E0%A4%A", "url", true)).toThrow();
  });
  it("组合搜索覆盖中英文关键词", () => {
    expect(searchTools("压缩图片")[0]?.id).toBe("image-compress");
    expect(searchTools("JSON 校验")[0]?.id).toBe("json");
  });
});
describe("颜色、时间和随机生成", () => {
  it("识别颜色并拒绝超出范围的 RGB", () => {
    expect(parseColor("#fff").rgb).toBe("rgb(255, 255, 255)");
    expect(parseColor("hsl(120, 100%, 50%)").hex).toBe("#00FF00");
    expect(parseColor("rgb(22, 131, 108)").hex).toBe("#16836C");
    expect(() => parseColor("rgb(256, 0, 0)")).toThrow();
  });
  it("正确处理秒、毫秒、零和负时间戳", () => {
    expect(parseTimestamp("0", "seconds").toISOString()).toBe(
      "1970-01-01T00:00:00.000Z",
    );
    expect(parseTimestamp("-1", "seconds").getTime()).toBe(-1000);
    expect(parseTimestamp("1234", "milliseconds").getTime()).toBe(1234);
    expect(() => parseTimestamp("1.5", "seconds")).toThrow();
  });
  it("密码包含全部选择的字符类型", () => {
    for (let i = 0; i < 20; i++) {
      const result = generatePassword(20, [
        "lower",
        "upper",
        "number",
        "symbol",
      ]);
      expect(result).toHaveLength(20);
      expect(result).toMatch(/[a-z]/);
      expect(result).toMatch(/[A-Z]/);
      expect(result).toMatch(/[0-9]/);
      expect(result).toMatch(/[^a-zA-Z0-9]/);
    }
    expect(() => generatePassword(20, [])).toThrow();
  });
});
