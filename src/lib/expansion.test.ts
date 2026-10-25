import { describe, it, expect } from "vitest";
import { convertYaml, htmlEntities, parseJwt } from "./config-tools";
import { replaceLiteral, compareLists } from "./text-extras";
import { inspectCron } from "./cron";
import { parsePageRange, processPdf } from "./pdf-tools";
import { zonedTime, durationText } from "./time-tools";
import { cropGeometry } from "./image-edit";
import { PDFDocument } from "pdf-lib";
describe("配置转换不丢失类型与字符", () => {
  it("YAML 1.2 保留中文和容易混淆的字符串", () => {
    const output = JSON.parse(
      convertYaml(
        'name: 小用\nanswer: no\nflag: true\nempty: null\nitems: [1, "001"]',
        true,
      ),
    );
    expect(output).toEqual({
      name: "小用",
      answer: "no",
      flag: true,
      empty: null,
      items: [1, "001"],
    });
    expect(
      JSON.parse(convertYaml(convertYaml(JSON.stringify(output), false), true)),
    ).toEqual(output);
  });
  it("拒绝重复键、循环别名、非字符串键、超大整数和非有限数", () => {
    for (const text of [
      "x: 1\nx: 2",
      "x: &x [*x]",
      "1: value",
      "x: 9007199254740993",
      "x: 9007199254740993.0",
      "x: .inf",
    ]) {
      expect(() => convertYaml(text, true)).toThrow();
    }
    expect(() => convertYaml('{"x":9007199254740993}', false)).toThrow();
    expect(() => convertYaml('{"x":1e400}', false)).toThrow();
    expect(JSON.parse(convertYaml('x: "9007199254740993"', true))).toEqual({
      x: "9007199254740993",
    });
  });
  it("保留 __proto__ 数据键而不修改原型", () => {
    const result = JSON.parse(
      convertYaml("__proto__: harmless\nconstructor: text", true),
    );
    expect(Object.hasOwn(result, "__proto__")).toBe(true);
    expect(result.__proto__).toBe("harmless");
  });
  it("HTML 实体往返中文、引号、emoji，解码不丢失命名实体", () => {
    const source = '<span title="你好">A&B 👩‍💻</span>';
    expect(htmlEntities(htmlEntities(source, true), false)).toBe(source);
    expect(htmlEntities("&copy; &#x1F600;", false)).toBe("© 😀");
  });
  it("JWT 支持中文 Payload 和 Bearer 前缀，拒绝损坏格式", () => {
    const b64 = (value: unknown) =>
      Buffer.from(JSON.stringify(value)).toString("base64url");
    const token =
      b64({ alg: "none" }) + "." + b64({ name: "小用", exp: 0 }) + ".";
    const parsed = parseJwt("Bearer " + token);
    expect(JSON.parse(parsed.payload).name).toBe("小用");
    expect(parsed.hasSignature).toBe(false);
    expect(parsed.times[0]!.value).toBe("1970-01-01 00:00:00.000 UTC");
    for (const value of ["a.b", "!!!.YWJj.x", b64([]) + "." + b64({}) + "."])
      expect(() => parseJwt(value)).toThrow();
  });
});
describe("文本处理按用户原文执行", () => {
  it("搜索中的正则字符和替换中的美元符保持原样", () => {
    expect(replaceLiteral("a.*$ a.*$", "a.*$", "$&", false)).toEqual({
      text: "$& $&",
      count: 2,
    });
    expect(replaceLiteral("Hello hello HELLO", "hello", "你好", true)).toEqual({
      text: "你好 你好 你好",
      count: 3,
    });
    expect(replaceLiteral("a a", "a", "", false)).toEqual({
      text: " ",
      count: 2,
    });
    expect(() =>
      replaceLiteral("a".repeat(200000), "a", "x".repeat(100), false),
    ).toThrow();
  });
  it("列表去重、交集和差集保留顺序与原文", () => {
    const a = " A \nB\nA\n丙",
      b = "b\nC\n丙";
    expect(compareLists(a, b, "intersection", true).text).toBe("B\n丙");
    expect(compareLists(a, b, "left", true).text).toBe("A");
    expect(compareLists(a, b, "right", true).text).toBe("C");
    expect(compareLists(a, b, "union", true).text).toBe("A\nB\n丙\nC");
    expect(compareLists(a, b, "difference", true).text).toBe("A\nC");
  });
});
describe("Cron、时区和计时格式", () => {
  it("按指定时区跨过周末，下一次执行严格晚于起点", () => {
    const result = inspectCron(
      "0 9 * * 1-5",
      "Asia/Shanghai",
      Date.parse("2024-01-05T01:00:00Z"),
    );
    expect(result.dates).toHaveLength(5);
    expect(result.dates[0]).toBe("2024-01-08T01:00:00.000Z");
    expect(result.description).toContain("09:00");
  });
  it("Cron 日期与星期按或匹配，并拒绝不支持的语法", () => {
    expect(
      inspectCron("0 0 1 * 1", "UTC", Date.parse("2024-01-01T00:00:00Z"))
        .dates[0],
    ).toBe("2024-01-08T00:00:00.000Z");
    for (const text of ["0 0 * * * *", "99 * * * *", "@daily", "0 0 L * *"])
      expect(() => inspectCron(text, "UTC", Date.now())).toThrow();
  });
  it("城市时钟按日期应用夏令时和半小时时区", () => {
    expect(
      zonedTime(Date.parse("2024-01-01T00:00:00Z"), "America/New_York").time,
    ).toBe("19:00:00");
    expect(
      zonedTime(Date.parse("2024-07-01T00:00:00Z"), "America/New_York").time,
    ).toBe("20:00:00");
    expect(
      zonedTime(Date.parse("2024-01-01T00:00:00Z"), "Asia/Kolkata").time,
    ).toBe("05:30:00");
    expect(durationText(90061050, true)).toBe("25:01:01.05");
    expect(durationText(-1)).toBe("00:00:00");
  });
});
describe("PDF 页码和文件处理", () => {
  async function pdf(widths: number[]) {
    const doc = await PDFDocument.create();
    widths.forEach((width) => doc.addPage([width, 300]));
    return await doc.save();
  }
  it("按用户顺序选择页面并去重，拒绝超出范围的页码", () => {
    expect(parsePageRange("4, 1-3, 2", 5)).toEqual([3, 0, 1, 2]);
    for (const value of ["0", "3-1", "6", "1,", "1.5", ""])
      expect(() => parsePageRange(value, 5)).toThrow();
  });
  it("合并保留页序，提取能重排页面并生成可读取 PDF", async () => {
    const a = { name: "a.pdf", bytes: await pdf([210, 220]) },
      b = { name: "b.pdf", bytes: await pdf([310]) };
    const merged = await processPdf({ operation: "merge", files: [b, a] });
    const doc = await PDFDocument.load(merged.bytes!);
    expect(doc.getPages().map((page) => page.getWidth())).toEqual([
      310, 210, 220,
    ]);
    const extracted = await processPdf({
      operation: "extract",
      files: [a],
      range: "2,1",
    });
    expect(
      (await PDFDocument.load(extracted.bytes!))
        .getPages()
        .map((page) => page.getWidth()),
    ).toEqual([220, 210]);
    expect(
      (await processPdf({ operation: "inspect", files: [a, b] })).counts,
    ).toEqual([2, 1]);
  });
  it("拒绝损坏文件和交互表单，避免输出不完整表单", async () => {
    await expect(
      processPdf({
        operation: "inspect",
        files: [{ name: "bad.pdf", bytes: new Uint8Array([1, 2, 3]) }],
      }),
    ).rejects.toThrow("无法读取");
    const form = await PDFDocument.create(),
      page = form.addPage();
    form.getForm().createTextField("name").addToPage(page);
    await expect(
      processPdf({
        operation: "merge",
        files: [{ name: "form.pdf", bytes: await form.save() }],
      }),
    ).rejects.toThrow("交互表单");
  });
});
describe("裁剪尺寸边界", () => {
  it("旋转 90 度交换宽高，拒绝超出图片的区域", () => {
    expect(
      cropGeometry(800, 600, { x: 100, y: 50, width: 400, height: 200 }, 90),
    ).toEqual({ width: 200, height: 400 });
    expect(() =>
      cropGeometry(800, 600, { x: 700, y: 0, width: 200, height: 200 }, 0),
    ).toThrow();
    expect(() =>
      cropGeometry(800, 600, { x: 0, y: 0, width: 0, height: 200 }, 0),
    ).toThrow();
  });
});
