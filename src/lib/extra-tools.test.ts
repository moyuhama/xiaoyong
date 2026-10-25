import { describe, expect, it } from "vitest";
import {
  csvToJson,
  jsonToCsv,
  convertRadix,
  drawNames,
  hashText,
  parseCsv,
  parseUrl,
} from "./data-tools";
import {
  calculatePercentage,
  convertUnit,
  formatNumber,
  readNumber,
} from "./calculations";

describe("CSV 数据完整性", () => {
  it("保留中文、引号、逗号、换行、空值和前导零", () => {
    const records = [
      { 名称: '你好,"世界"', 编号: "001", 备注: "第一行\r\n第二行", 空值: "" },
    ];
    const csv = jsonToCsv(JSON.stringify(records));
    expect(JSON.parse(csvToJson("\uFEFF" + csv + "\r\n"))).toEqual(records);
  });
  it("支持制表符和分号，忽略空白行但保留被引号包裹的空字符串", () => {
    expect(parseCsv('名称;值\r\nA;"1;2"\r\n', ";")).toEqual([
      ["名称", "值"],
      ["A", "1;2"],
    ]);
    expect(JSON.parse(csvToJson("name\tid\n小用\t001", "\t"))).toEqual([
      { name: "小用", id: "001" },
    ]);
    expect(parseCsv('x\n""\n\n')).toEqual([["x"], [""]]);
  });
  it("拒绝残缺引号、重复列名、空列名和列数不匹配", () => {
    for (const value of [
      'name\n"x',
      'name\n"x"tail',
      "name,name\n1,2",
      "name,\n1,2",
      "name,id\none",
      'name\nun"quoted',
    ]) {
      expect(() => csvToJson(value)).toThrow();
    }
  });
  it("按字段并集导出，不把原型属性当作数据", () => {
    const source = '[{"name":"A"},{"id":2,"__proto__":"safe"}]';
    expect(JSON.parse(csvToJson(jsonToCsv(source)))).toEqual([
      { name: "A", id: "", ["__proto__"]: "" },
      { name: "", id: "2", ["__proto__"]: "safe" },
    ]);
  });
  it("可选择公式保护，并对表头做相同处理", () => {
    expect(jsonToCsv('[{"=field":"=1+1","other":" @SUM(A1)"}]')).toBe(
      "'=field,other\r\n'=1+1,' @SUM(A1)",
    );
    expect(jsonToCsv('[{"value":"=1+1"}]', ",", false)).toBe("value\r\n=1+1");
  });
  it("拒绝不受支持的 JSON 结构，明确序列化嵌套值", () => {
    for (const input of ["[]", "{}", "[1]", "[null]", "[{}]", "broken"])
      expect(() => jsonToCsv(input)).toThrow();
    expect(
      JSON.parse(csvToJson(jsonToCsv('[{"nested":{"x":1},"missing":null}]'))),
    ).toEqual([{ nested: '{"x":1}', missing: "" }]);
  });
});
describe("开发工具的精度与编码", () => {
  it("大整数、负数和进制前缀完整往返", () => {
    expect(convertRadix("9007199254740993", 10, 16)).toBe("20000000000001");
    expect(convertRadix("-0x20000000000001", 16, 10)).toBe("-9007199254740993");
    expect(convertRadix("0b101", 2, 8)).toBe("5");
    expect(convertRadix("z", 36, 10)).toBe("35");
    expect(convertRadix("-0", 10, 2)).toBe("0");
    for (const input of ["102", "1.5", "0xFF", "-"])
      expect(() => convertRadix(input, 2, 10)).toThrow();
  });
  it("SHA 摘要符合已知向量，包括空字符串和换行", async () => {
    expect(await hashText("", "SHA-256")).toBe(
      "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
    );
    expect(await hashText("abc", "SHA-256")).toBe(
      "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad",
    );
    expect(await hashText("abc", "SHA-512")).toBe(
      "ddaf35a193617abacc417349ae20413112e6fa4e89a97ea20a9eeee64b55d39a2192992a274fc1a836ba3c23a3feebbd454d4423643ce80e2a9ac94fa54ca49f",
    );
    expect(await hashText("abc", "SHA-384")).toHaveLength(96);
    expect(await hashText("abc\n", "SHA-256")).not.toBe(
      await hashText("abc", "SHA-256"),
    );
  });
  it("URL 保留重复参数，并解码中文、空格和空值", () => {
    const parsed = parseUrl(
      "https://example.com:8080/a?q=%E4%B8%AD%E6%96%87&tag=a+b&tag=c&empty=#part",
    );
    expect(parsed.params).toEqual([
      ["q", "中文"],
      ["tag", "a b"],
      ["tag", "c"],
      ["empty", ""],
    ]);
    expect(parsed.parts).toContainEqual(["端口", "8080"]);
    expect(() => parseUrl("javascript:alert(1)")).toThrow();
    expect(() => parseUrl("example.com")).toThrow();
  });
});
describe("日常计算边界", () => {
  it("区分二进制容量、十进制容量和常用单位", () => {
    expect(convertUnit(1, "length", "in", "cm")).toBe(2.54);
    expect(convertUnit(1, "mass", "jin", "g")).toBe(500);
    expect(convertUnit(1, "data", "mib", "byte")).toBe(1048576);
    expect(convertUnit(1, "data", "mb", "byte")).toBe(1000000);
    expect(convertUnit(1, "volume", "gal", "l")).toBe(3.785411784);
    expect(() => convertUnit(-1, "length", "m", "cm")).toThrow();
  });
  it("处理温度偏移和绝对零度", () => {
    expect(convertUnit(32, "temperature", "f", "c")).toBe(0);
    expect(convertUnit(0, "temperature", "c", "f")).toBe(32);
    expect(convertUnit(273.15, "temperature", "k", "c")).toBe(0);
    expect(convertUnit(100, "temperature", "c", "f")).toBeCloseTo(212);
    expect(convertUnit(-459.67, "temperature", "f", "k")).toBe(0);
    expect(() => convertUnit(-274, "temperature", "c", "k")).toThrow();
  });
  it("计算占比与变化率，拒绝零分母和无意义的变化基数", () => {
    expect(calculatePercentage(200, 15, "portion")).toBe(30);
    expect(calculatePercentage(30, 200, "ratio")).toBe(15);
    expect(calculatePercentage(200, 150, "change")).toBe(-25);
    expect(calculatePercentage(200, 0, "change")).toBe(-100);
    expect(() => calculatePercentage(1, 0, "ratio")).toThrow();
    expect(() => calculatePercentage(-100, 50, "change")).toThrow();
    expect(() => calculatePercentage(0, 50, "change")).toThrow();
  });
  it("支持科学计数法、拒绝空值和无穷大", () => {
    expect(readNumber("1.2e3")).toBe(1200);
    expect(formatNumber(0.1 + 0.2)).toBe("0.3");
    for (const value of ["", "0xFF", "1,000", "Infinity", "1e999"])
      expect(() => readNumber(value)).toThrow();
  });
  it("抽签去除空行和重复项，抽取结果不重复", () => {
    expect(drawNames(" A\nB\nA \n\nC", 3).sort()).toEqual(["A", "B", "C"]);
    expect(drawNames("甲\n乙\n丙\n丁", 2)).toHaveLength(2);
    for (const count of [0, 1.5, 4])
      expect(() => drawNames("A\nB\nC", count)).toThrow();
    expect(() => drawNames(" \n", 1)).toThrow();
  });
});
