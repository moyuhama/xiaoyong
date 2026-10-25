import { describe, expect, it } from "vitest";
import { moneyUppercase, randomNumbers, textWorkshop } from "./more-tools";
import { buildIco, contain, printLayout, stitchLayout } from "./image-layout";
import { processPdf } from "./pdf-tools";
import {
  PDFDocument,
  degrees,
  decodePDFRawStream,
  PDFRawStream,
} from "pdf-lib";

describe("金额和随机数", () => {
  it("金额精确保留分位、大整数和跨组零", () => {
    const cases = {
      "0": "零元整",
      "-0.00": "零元整",
      "0.05": "零元伍分",
      "1001.05": "壹仟零壹元零伍分",
      "1,234,567.89": "壹佰贰拾叁万肆仟伍佰陆拾柒元捌角玖分",
      "100000001": "壹亿零壹元整",
      "100010001": "壹亿零壹万零壹元整",
      "100100000": "壹亿零壹拾万元整",
      "9007199254740993.01":
        "玖仟零柒兆壹仟玖佰玖拾贰亿伍仟肆佰柒拾肆万零玖佰玖拾叁元零壹分",
      "-12.30": "负壹拾贰元叁角整",
    };
    Object.entries(cases).forEach(([input, expected]) =>
      expect(moneyUppercase(input)).toBe(expected),
    );
  });
  it("拒绝不完整金额、无效千位分隔与超出分位", () => {
    for (const input of [
      "",
      "1.",
      "1e5",
      "1,23",
      "1.005",
      "10000000000000000",
      "NaN",
    ])
      expect(() => moneyUppercase(input)).toThrow();
  });
  it("随机抽取覆盖负数、两端和不重复全集", () => {
    expect(randomNumbers(-3, 3, 7, true).sort((a, b) => a - b)).toEqual([
      -3, -2, -1, 0, 1, 2, 3,
    ]);
    expect(randomNumbers(9, 9, 3, false)).toEqual([9, 9, 9]);
    const values = randomNumbers(-1e9, 1e9, 1000, true);
    expect(new Set(values).size).toBe(1000);
    expect(
      values.every(
        (value) => Number.isInteger(value) && value >= -1e9 && value <= 1e9,
      ),
    ).toBe(true);
    for (const args of [
      [2, 1, 1, true],
      [1, 2, 3, true],
      [0, 1, 1001, false],
      [0.1, 1, 1, false],
    ] as const)
      expect(() => randomNumbers(args[0], args[1], args[2], args[3])).toThrow();
  });
});
describe("SQL 和拼音", () => {
  it("SQL 整理关键字但保留字符串和注释内容", async () => {
    const result = await textWorkshop({
      kind: "sql",
      text: "select 'select FROM' as label, id from users where id = 1; -- 保留注释",
      keywordCase: "upper",
      dialect: "mysql",
    });
    expect(result).toContain("SELECT\n");
    expect(result).toContain("'select FROM'");
    expect(result).toContain("-- 保留注释");
    expect(result).toContain("FROM\n  users");
    await expect(
      textWorkshop({ kind: "sql", text: "x".repeat(50001) }),
    ).rejects.toThrow("50,000");
  });
  it("拼音按词语读多音字，保留换行与英文", async () => {
    const result = await textWorkshop({
      kind: "pinyin",
      text: "重庆银行\nhello 123",
      tone: "symbol",
    });
    expect(result).toBe("chóng qìng yín háng\nhello 123");
    expect(
      await textWorkshop({ kind: "pinyin", text: "你好", tone: "num" }),
    ).toBe("ni3 hao3");
    expect(
      await textWorkshop({
        kind: "pinyin",
        text: "你好",
        initials: true,
        uppercase: true,
      }),
    ).toBe("N H");
    await expect(
      textWorkshop({ kind: "pinyin", text: "汉".repeat(10001) }),
    ).rejects.toThrow("10,000");
  });
});
describe("图片排版和文件格式", () => {
  const images = [
    { width: 800, height: 600 },
    { width: 600, height: 800 },
  ];
  it("拼接保留比例与顺序，间距不多算一段", () => {
    const result = stitchLayout(images, "vertical", 600, 10, 2);
    expect(result.width).toBe(600);
    expect(result.height).toBe(1260);
    expect(result.boxes).toEqual([
      { x: 0, y: 0, width: 600, height: 450 },
      { x: 0, y: 460, width: 600, height: 800 },
    ]);
    expect(stitchLayout(images, "horizontal", 600, 10, 2).width).toBe(1260);
    const grid = stitchLayout(images, "grid", 400, 10, 2);
    expect(grid.width).toBe(810);
    expect(grid.height).toBe(400);
    expect(grid.boxes[1]).toEqual({ x: 460, y: 0, width: 300, height: 400 });
    expect(() =>
      stitchLayout(Array(12).fill(images[0]), "vertical", 2048, 10, 2),
    ).toThrow("输出过大");
  });
  it("打印照片保持物理尺寸，数量和边距不溢出纸张", () => {
    const result = printLayout(152.4, 101.6, 25, 35, 5, 2, 0);
    expect(result.count).toBe(10);
    expect(result.columns).toBe(5);
    expect(result.rows).toBe(2);
    result.boxes.forEach((box) => {
      expect(box.width).toBe(25);
      expect(box.height).toBe(35);
      expect(box.x).toBeGreaterThanOrEqual(5);
      expect(box.x + box.width).toBeLessThanOrEqual(147.4);
      expect(box.y + box.height).toBeLessThanOrEqual(96.6);
    });
    expect(printLayout(152.4, 101.6, 25, 35, 5, 2, 4).count).toBe(4);
    expect(() => printLayout(152.4, 101.6, 25, 35, 5, 2, 11)).toThrow(
      "最多排 10",
    );
    expect(() => printLayout(152.4, 101.6, 100, 100, 5, 2, 1)).toThrow(
      "放不下",
    );
    expect(
      contain(100, 200, { x: 10, y: 20, width: 100, height: 100 }),
    ).toEqual({ x: 35, y: 20, width: 50, height: 100 });
  });
  it("ICO 目录包含正确的尺寸、位深和 PNG 数据偏移", () => {
    const bytes = buildIco([
      { size: 16, bytes: new Uint8Array([137, 80, 78, 71]) },
      { size: 256, bytes: new Uint8Array([1, 2, 3]) },
    ]);
    const view = new DataView(bytes.buffer);
    expect(view.getUint16(2, true)).toBe(1);
    expect(view.getUint16(4, true)).toBe(2);
    expect(bytes[6]).toBe(16);
    expect(bytes[22]).toBe(0);
    expect(view.getUint16(12, true)).toBe(32);
    expect(view.getUint32(18, true)).toBe(38);
    expect(view.getUint32(34, true)).toBe(42);
    expect(Array.from(bytes.slice(38))).toEqual([137, 80, 78, 71, 1, 2, 3]);
    expect(() => buildIco([])).toThrow();
  });
});
describe("PDF 页码", () => {
  it("跳过封面后连续编号，保留页面顺序和旋转裁剪框", async () => {
    const doc = await PDFDocument.create();
    [0, 90, 180, 270].forEach((angle) => {
      const page = doc.addPage([400, 500]);
      page.setCropBox(30, 40, 300, 400);
      page.setRotation(degrees(angle));
    });
    const result = await processPdf({
      operation: "number",
      files: [{ name: "rotated.pdf", bytes: await doc.save() }],
      range: "4,2-3",
      numbering: { start: 7, size: 11, position: "center" },
    });
    const output = await PDFDocument.load(result.bytes!);
    expect(output.getPageCount()).toBe(4);
    output.getPages().forEach((page, index) => {
      expect(page.getRotation().angle).toBe(index * 90);
      expect(page.getCropBox()).toEqual({
        x: 30,
        y: 40,
        width: 300,
        height: 400,
      });
      const contents = page.node.Contents();
      if (!index) {
        expect(contents).toBeUndefined();
        return;
      }
      const streamTexts = (contents as any)
        .asArray()
        .map((ref: any) => output.context.lookup(ref))
        .filter((stream: unknown) => stream instanceof PDFRawStream)
        .map((stream: PDFRawStream) =>
          new TextDecoder().decode(decodePDFRawStream(stream).decode()),
        )
        .join("\n");
      expect(streamTexts).toContain(
        `<${(index + 6).toString().charCodeAt(0).toString(16)}> Tj`,
      );
    });
  });
  it("拒绝越界页面与无效编号设置", async () => {
    const doc = await PDFDocument.create();
    doc.addPage();
    const files = [{ name: "a.pdf", bytes: await doc.save() }];
    await expect(
      processPdf({
        operation: "number",
        files,
        range: "2",
        numbering: { start: 1, size: 11, position: "center" },
      }),
    ).rejects.toThrow("页码需在");
    await expect(
      processPdf({
        operation: "number",
        files,
        range: "1",
        numbering: { start: 0, size: 11, position: "center" },
      }),
    ).rejects.toThrow("起始编号");
  });
});
