import { describe, expect, it } from "vitest";
import { processJson } from "./json-tools";

describe("JSON 常用操作", () => {
  it("格式化和压缩保留嵌套内容、字符串中的空白及转义", () => {
    const source =
      '{"name":"小用 👋","text":"a  b\\n第二行","items":[1,true,null]}';
    const formatted = processJson(source, "format", "\t");
    expect(formatted).toContain('\n\t"name"');
    expect(processJson(formatted, "minify")).toBe(source);
    expect(processJson("false", "format")).toBe("false");
    expect(processJson("null", "format")).toBe("null");
  });
  it("带或不带外层引号均能往返还原中文、引号、控制字符和路径", () => {
    const source =
      '  {"name":"小用 👩‍💻","path":"C:\\\\temp\\\\new"}\r\n\t正文 "quoted"\b\f\u0000  ';
    for (const quotes of [false, true]) {
      const escaped = processJson(source, "escape", 2, quotes);
      expect(escaped).not.toContain("\n");
      expect(processJson(escaped, "unescape")).toBe(source);
    }
  });
  it("只还原一层，保留 JSON 值本身需要的反斜杠", () => {
    const original = '{"path":"C:\\\\temp\\\\new","message":"line1\\nline2"}';
    const once = processJson(original, "escape");
    const twice = processJson(once, "escape");
    expect(processJson(twice, "unescape")).toBe(once);
    expect(processJson(once, "unescape")).toBe(original);
    expect(JSON.parse(processJson(once, "unescape")).path).toBe(
      "C:\\temp\\new",
    );
    expect(() => processJson(original, "unescape")).toThrow("转义内容有误");
  });
  it("支持 Unicode 转义、外层空白、空字符串及手动换行的转义片段", () => {
    expect(processJson("\\u4f60\\u597d\\ud83d\\ude00", "unescape")).toBe(
      "你好😀",
    );
    expect(processJson('  "hello\\nworld"  ', "unescape")).toBe("hello\nworld");
    expect(processJson('""', "unescape")).toBe("");
    expect(processJson('{\n  \\"name\\": \\"小用\\"\n}', "unescape")).toBe(
      '{\n  "name": "小用"\n}',
    );
  });
  it("拒绝错误 JSON、不完整转义和超长输入", () => {
    for (const source of ['{"x":}', '{"x":1,}', "{x:1}", " \n "])
      expect(() => processJson(source, "format")).toThrow();
    for (const source of ["\\", "\\x41", "\\u12", '"missing'])
      expect(() => processJson(source, "unescape")).toThrow("转义内容有误");
    expect(() => processJson("", "escape")).toThrow("请先输入");
    expect(() => processJson("x".repeat(2000001), "escape")).toThrow(
      "字符以内",
    );
  });
});
