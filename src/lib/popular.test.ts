import { describe, expect, it } from "vitest";
import {
  changeCase,
  unicodeText,
  morseText,
  extractText,
  queryJson,
  compareJson,
  jsonTypes,
  processPopularText,
} from "./popular-text";
import { calculate, describeNumbers, workingDays } from "./math-tools";
import {
  packFiles,
  unpackFiles,
  inspectZip,
  encodeFile,
  decodeFile,
  rowsToCsv,
  processFile,
} from "./file-utilities";
import { PDFDocument, degrees } from "pdf-lib";
import { processPdf } from "./pdf-tools";
import { zipSync } from "fflate";
import { tools, searchTools } from "./tools";
describe("新增工具分类与搜索", () => {
  it("70 个唯一入口均有名称、分类与模块", () => {
    expect(tools).toHaveLength(70);
    expect(new Set(tools.map((t) => t.id)).size).toBe(70);
    expect(searchTools("OCR").some((t) => t.id === "image-ocr")).toBe(true);
    expect(searchTools("Excel").some((t) => t.id === "xlsx-csv")).toBe(true);
  });
});
describe("常用文本与代码", () => {
  it("命名转换处理缩略词、驼峰与换行", () => {
    expect(changeCase("HTTPServer user_name\nhello-world", "camel")).toBe(
      "httpServerUserName\nhelloWorld",
    );
    expect(changeCase("userName", "snake")).toBe("user_name");
    expect(changeCase("user name", "pascal")).toBe("UserName");
  });
  it("Unicode 往返中文、换行、反斜杠与 emoji", () => {
    const source = "你好 😀\n\\u4f60";
    expect(unicodeText(unicodeText(source, false), true)).toBe(source);
    expect(unicodeText("\\u{1F600}", true)).toBe("😀");
    expect(() => unicodeText("\\u{110000}", true)).toThrow();
  });
  it("摩斯码往返所有支持的字符并拒绝未知字符", () => {
    const source = "ABCDEFGHIJKLMNOPQRSTUVWXYZ 0123456789 .,?!:;'\"-/()@=+";
    expect(morseText(morseText(source, false), true)).toBe(source);
    expect(() => morseText("中文", false)).toThrow();
    expect(morseText("... --- ... / .- -...", true)).toBe("SOS AB");
  });
  it("邮箱和 IP 提取去重并拒绝越界 IP", () => {
    expect(
      extractText("a@example.com a@example.com b@example.org", "email"),
    ).toBe("a@example.com\nb@example.org");
    expect(extractText("192.168.1.1 999.1.1.1 01.2.3.4", "ip")).toBe(
      "192.168.1.1",
    );
  });
  it("JSON 查询支持转义键、通配符、空结果，不能读取继承属性或执行脚本", () => {
    const source = JSON.parse('{"a.b":[{"n":1},{"n":2}],"__proto__":"value"}');
    expect(queryJson(source, '$["a.b"][*].n')).toEqual([1, 2]);
    expect(queryJson(source, "$.constructor")).toEqual([]);
    expect(queryJson(source, "$.__proto__")).toEqual(["value"]);
    expect(() => queryJson(source, "$[?(alert(1))]")).toThrow();
  });
  it("结构比较忽略键顺序并区别 null、删除与数组顺序", () => {
    expect(compareJson({ a: 1, b: null }, { b: null, a: 1 })).toEqual([]);
    const diff = compareJson(
      { a: null, b: 2, list: [1, 2] },
      { a: 0, list: [2, 1], c: true },
    );
    expect(diff.map((d) => [d.path, d.type])).toEqual([
      ["$.a", "修改"],
      ["$.b", "删除"],
      ["$.list[0]", "修改"],
      ["$.list[1]", "修改"],
      ["$.c", "新增"],
    ]);
  });
  it("TypeScript 推断嵌套、联合数组、特殊属性和空数组", () => {
    const output = jsonTypes({ "a-b": null, values: [1, "x"], empty: [] });
    expect(output).toContain('"a-b": null');
    expect(output).toContain("Array<number | string>");
    expect(output).toContain("unknown[]");
  });
  it("简繁与台湾用词转换可用", async () => {
    expect(
      await processPopularText({
        kind: "chinese-convert",
        input: "汉字转换",
        mode: "to-t",
      }),
    ).toBe("漢字轉換");
    expect(
      await processPopularText({
        kind: "chinese-convert",
        input: "軟體",
        mode: "to-cn",
      }),
    ).toBe("软件");
  });
  it("XML 保留属性和文本类型，拒绝 DTD 与损坏 XML", async () => {
    const value = JSON.parse(
      await processPopularText({
        kind: "xml",
        input: '<root id="01"><value>001</value></root>',
        mode: "json",
      }),
    );
    expect(value.root["@_id"]).toBe("01");
    expect(value.root.value).toBe("001");
    await expect(
      processPopularText({
        kind: "xml",
        input: "<!DOCTYPE x><x/>",
        mode: "format",
      }),
    ).rejects.toThrow("DTD");
    await expect(
      processPopularText({ kind: "xml", input: "<a><b></a>", mode: "format" }),
    ).rejects.toThrow();
  });
  it("代码格式化支持三种语言且保留字符串字面量", async () => {
    expect(
      await processPopularText({
        kind: "code-format",
        input: 'const n={name:"Hi"};',
        mode: "javascript",
      }),
    ).toContain('const n = { name: "Hi" };');
    expect(
      await processPopularText({
        kind: "code-format",
        input: ".a{color:red}",
        mode: "css",
      }),
    ).toContain("  color: red;");
    expect(
      await processPopularText({
        kind: "code-format",
        input: "<main><p>你好</p></main>",
        mode: "html",
      }),
    ).toContain("你好");
  });
});
describe("计算与工作日", () => {
  it("计算器遵守乘方、负号、百分数与角度规则", () => {
    expect(calculate("-2^2")).toBe(-4);
    expect(calculate("2^3^2")).toBe(512);
    expect(calculate("2^-2")).toBe(0.25);
    expect(calculate("5! + 200*10%")).toBe(140);
    expect(calculate("sqrt(144)+sin(30)")).toBe(12.5);
    expect(calculate("cos(pi)", false)).toBe(-1);
  });
  it("计算器拒绝执行代码、除零和无效实数结果", () => {
    for (const text of [
      "alert(1)",
      "1/0",
      "sqrt(-1)",
      "2pi",
      "tan(90)",
      "171!",
      "(2+3",
    ])
      expect(() => calculate(text)).toThrow();
  });
  it("统计区分总体与样本方差，中位数支持偶数列表", () => {
    const s = describeNumbers("1,2,3,4");
    expect(s.sum).toBe(10);
    expect(s.median).toBe(2.5);
    expect(s.variance).toBe(1.25);
    expect(s.sampleVariance).toBeCloseTo(5 / 3);
    expect(describeNumbers("-1e2 3.5").min).toBe(-100);
    expect(describeNumbers("1").sampleVariance).toBeNull();
    expect(() => describeNumbers("1 nope")).toThrow();
  });
  it("工作日支持周末、休息与补班以及反向计算", () => {
    expect(workingDays("2026-10-26", "2026-11-01", null, "", "")).toBe(5);
    expect(
      workingDays("2026-10-26", "2026-11-01", null, "2026-10-27", "2026-10-31"),
    ).toBe(5);
    expect(workingDays("2026-10-30", "", 1, "", "")).toBe("2026-11-02");
    expect(workingDays("2026-10-26", "", -1, "", "")).toBe("2026-10-23");
    expect(
      workingDays("2026-10-26", "2026-10-26", null, "", "", false, true),
    ).toBe(0);
    expect(() =>
      workingDays("2026-02-30", "2026-03-01", null, "", ""),
    ).toThrow();
  });
});
describe("文件转换与内容完整性", () => {
  it("ZIP 打包往返中文、空文件、重名文件并验证 CRC", () => {
    const source = [
      { name: "你好.txt", bytes: new TextEncoder().encode("小用") },
      { name: "empty.txt", bytes: new Uint8Array() },
      { name: "你好.txt", bytes: new Uint8Array([0, 255, 128]) },
    ];
    const zip = packFiles(source);
    const decoded = unpackFiles(zip);
    expect(decoded.map((f) => f.name)).toEqual([
      "你好.txt",
      "empty.txt",
      "2-你好.txt",
    ]);
    expect(Array.from(decoded[2]!.bytes)).toEqual([0, 255, 128]);
    const broken = zip.slice();
    const view = new DataView(broken.buffer);
    let central = 0;
    for (let i = 0; i < broken.length - 4; i++)
      if (view.getUint32(i, true) === 0x02014b50) {
        central = i;
        break;
      }
    broken[central + 16] ^= 1;
    expect(() => unpackFiles(broken)).toThrow("校验失败");
  });
  it("拒绝路径穿越、损坏压缩包和超过限制的展开大小", () => {
    expect(() =>
      unpackFiles(zipSync({ "../unsafe.txt": new Uint8Array([1]) })),
    ).toThrow("无效路径");
    expect(() => inspectZip(new Uint8Array([1, 2, 3]))).toThrow("完整");
    const zip = zipSync({ x: new Uint8Array([1]) });
    const view = new DataView(zip.buffer);
    for (let i = 0; i < zip.length - 46; i++)
      if (view.getUint32(i, true) === 0x02014b50) {
        view.setUint32(i + 24, 60 * 1024 * 1024, true);
        break;
      }
    expect(() => unpackFiles(zip)).toThrow("50 MB");
  });
  it("Base64 往返二进制并识别 Data URL，拒绝无效字符", () => {
    const bytes = new Uint8Array([0, 255, 128, 1, 2, 3]);
    expect(decodeFile(encodeFile(bytes)).bytes).toEqual(bytes);
    expect(decodeFile("data:image/png;base64," + encodeFile(bytes)).mime).toBe(
      "image/png",
    );
    expect(() => decodeFile("bad%%%")).toThrow();
  });
  it("CSV 保护公式文本，保留数字、引号、换行和空单元格", () => {
    expect(
      rowsToCsv([["name", "value"], ["=x", -12], ["a,b", 'a"b\nc'], ["only"]]),
    ).toBe('name,value\r\n\'=x,-12\r\n"a,b","a""b\nc"\r\nonly,');
  });
  it("文件哈希使用已知 SHA-256 向量", async () => {
    const result = await processFile({
      kind: "hash",
      files: [{ name: "a.txt", bytes: new TextEncoder().encode("abc") }],
      algorithm: "SHA-256",
    });
    expect(result.text).toBe(
      "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad",
    );
  });
  it("PDF 仅旋转选定页面，保留页序和已有方向", async () => {
    const doc = await PDFDocument.create();
    doc.addPage([200, 300]).setRotation(degrees(90));
    doc.addPage([250, 300]);
    const result = await processPdf({
      operation: "rotate",
      files: [{ name: "a.pdf", bytes: await doc.save() }],
      range: "1",
      rotation: 270,
    });
    const out = await PDFDocument.load(result.bytes!);
    expect(out.getPages().map((p) => p.getRotation().angle)).toEqual([0, 0]);
    expect(out.getPages().map((p) => p.getWidth())).toEqual([200, 250]);
  });
});
