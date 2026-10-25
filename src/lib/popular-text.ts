export type TextOptions = {
  kind: string;
  input: string;
  second?: string;
  mode?: string;
  path?: string;
};
export function parseJson(text: string) {
  if (text.length > 200000) throw new Error("JSON 最多 200,000 字符");
  try {
    return JSON.parse(text);
  } catch {
    throw new Error("JSON 格式有误，请先检查引号、逗号与括号");
  }
}
export function changeCase(input: string, mode: string) {
  if (mode === "upper") return input.toUpperCase();
  if (mode === "lower") return input.toLowerCase();
  if (mode === "title")
    return input.toLowerCase().replace(/\b[a-z]/g, (s) => s.toUpperCase());
  return input
    .split(/\r?\n/)
    .map((line) => {
      const words =
        line
          .replace(/([A-Z]+)([A-Z][a-z])/g, "$1 $2")
          .replace(/([a-z\d])([A-Z])/g, "$1 $2")
          .match(/[\p{L}\p{N}]+/gu) || [];
      const lower = words.map((w) => w.toLowerCase());
      if (mode === "snake" || mode === "kebab")
        return lower.join(mode === "snake" ? "_" : "-");
      return lower
        .map((w, i) =>
          mode === "pascal" || i ? w[0]!.toUpperCase() + w.slice(1) : w,
        )
        .join("");
    })
    .join("\n");
}
export function unicodeText(input: string, decode: boolean) {
  if (!decode)
    return input
      .split("")
      .map((c) => "\\u" + c.charCodeAt(0).toString(16).padStart(4, "0"))
      .join("");
  return input.replace(
    /\\u\{([0-9a-fA-F]+)\}|\\u([0-9a-fA-F]{4})/g,
    (_, point, unit) => {
      const value = parseInt(point || unit, 16);
      if (value > 0x10ffff || (point && value >= 0xd800 && value <= 0xdfff))
        throw new Error("Unicode 码点超出范围");
      return point ? String.fromCodePoint(value) : String.fromCharCode(value);
    },
  );
}
const morseChars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789.,?!:;'\"-/()@=+";
const morseCodes =
  ".- -... -.-. -.. . ..-. --. .... .. .--- -.- .-.. -- -. --- .--. --.- .-. ... - ..- ...- .-- -..- -.-- --.. ----- .---- ..--- ...-- ....- ..... -.... --... ---.. ----. .-.-.- --..-- ..--.. -.-.-- ---... -.-.-. .----. .-..-. -....- -..-. -.--. -.--.- .--.-. -...- .-.-.".split(
    " ",
  );
export function morseText(input: string, decode: boolean) {
  const map = Object.fromEntries(
    Array.from(morseChars).map((c, i) =>
      decode ? [morseCodes[i], c] : [c, morseCodes[i]],
    ),
  );
  return input
    .split(/\r?\n/)
    .map((line) =>
      decode
        ? line
            .trim()
            .split(/\s*\/\s*/)
            .map((word) =>
              word
                .split(/\s+/)
                .filter(Boolean)
                .map((code) => {
                  if (!map[code]) throw new Error("无法识别摩斯码：" + code);
                  return map[code];
                })
                .join(""),
            )
            .join(" ")
        : line
            .toUpperCase()
            .trim()
            .split(/\s+/)
            .filter(Boolean)
            .map((word) =>
              Array.from(word)
                .map((c) => {
                  if (!map[c]) throw new Error("摩斯码暂不支持字符：" + c);
                  return map[c];
                })
                .join(" "),
            )
            .join(" / "),
    )
    .join("\n");
}
export function extractText(input: string, mode: string) {
  const regex =
    mode === "email"
      ? /[A-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[A-Z0-9](?:[A-Z0-9-]*[A-Z0-9])?(?:\.[A-Z0-9](?:[A-Z0-9-]*[A-Z0-9])?)+/gi
      : mode === "url"
        ? /https?:\/\/[^\s<>"'，。；、）]+/gi
        : /(?<![\d.])(?:\d{1,3}\.){3}\d{1,3}(?![\d.])/g;
  const values = (input.match(regex) || []).filter(
    (v) =>
      mode !== "ip" ||
      v.split(".").every((n) => Number(n) <= 255 && String(Number(n)) === n),
  );
  return [...new Set(values)].join("\n");
}
function keyPath(path: string, key: string) {
  return /^[A-Za-z_$][\w$]*$/.test(key)
    ? path + "." + key
    : path + "[" + JSON.stringify(key) + "]";
}
export function compareJson(left: unknown, right: unknown) {
  const changes: {
    path: string;
    type: string;
    before?: unknown;
    after?: unknown;
  }[] = [];
  function visit(a: any, b: any, path: string, depth: number) {
    if (depth > 64) throw new Error("JSON 嵌套请控制在 64 层以内");
    if (changes.length >= 1000)
      throw new Error("差异超过 1,000 处，请缩小比较范围");
    if (Object.is(a, b)) return;
    if (
      a &&
      b &&
      typeof a === "object" &&
      typeof b === "object" &&
      Array.isArray(a) === Array.isArray(b)
    ) {
      for (const key of new Set([...Object.keys(a), ...Object.keys(b)])) {
        const next = Array.isArray(a)
          ? path + "[" + key + "]"
          : keyPath(path, key);
        if (!Object.hasOwn(a, key))
          changes.push({ path: next, type: "新增", after: b[key] });
        else if (!Object.hasOwn(b, key))
          changes.push({ path: next, type: "删除", before: a[key] });
        else visit(a[key], b[key], next, depth + 1);
        if (changes.length > 1000)
          throw new Error("差异超过 1,000 处，请缩小比较范围");
      }
    } else changes.push({ path, type: "修改", before: a, after: b });
  }
  visit(left, right, "$", 0);
  return changes;
}
export function queryJson(value: unknown, path: string) {
  if (!path.startsWith("$") || path.length > 1000)
    throw new Error("路径需以 $ 开头，最多 1,000 字符");
  let rest = path.slice(1),
    values: any[] = [value];
  while (rest) {
    const match = rest.match(
      /^(?:\.([A-Za-z_$][\w$]*|\*)|\[(\d+|\*|"(?:[^"\\]|\\.)*")\])/,
    );
    if (!match)
      throw new Error(
        '支持 $.name、[0]、["字段"] 和 [*]，不支持递归或脚本表达式',
      );
    const token = match[1] ?? match[2]!;
    rest = rest.slice(match[0].length);
    if (token === "*")
      values = values.flatMap((v) =>
        v && typeof v === "object" ? Object.values(v) : [],
      );
    else {
      const key = token.startsWith('"') ? JSON.parse(token) : token;
      values = values.flatMap((v) =>
        v !== null && typeof v === "object" && Object.hasOwn(v, key)
          ? [v[key]]
          : [],
      );
    }
    if (values.length > 10000)
      throw new Error("匹配结果超过 10,000 项，请缩小路径范围");
  }
  return values;
}
export function jsonTypes(value: unknown) {
  let nodes = 0;
  function type(v: any, depth: number): string {
    if (++nodes > 10000 || depth > 32)
      throw new Error("JSON 过于复杂，请控制在 10,000 个节点、32 层以内");
    if (v === null) return "null";
    if (Array.isArray(v)) {
      const types = [...new Set(v.map((item) => type(item, depth + 1)))];
      return types.length ? "Array<" + types.join(" | ") + ">" : "unknown[]";
    }
    if (typeof v === "object") {
      const space = "  ".repeat(depth + 1),
        end = "  ".repeat(depth);
      return (
        "{\n" +
        Object.keys(v)
          .map(
            (key) =>
              space +
              JSON.stringify(key) +
              ": " +
              type(v[key], depth + 1) +
              ";",
          )
          .join("\n") +
        "\n" +
        end +
        "}"
      );
    }
    return typeof v;
  }
  return "export type Root = " + type(value, 0) + ";\n";
}
export async function processPopularText(
  request: TextOptions,
): Promise<string> {
  const { kind, input, mode = "" } = request;
  if (!input.trim()) throw new Error("请先输入内容");
  if (input.length + (request.second?.length || 0) > 200000)
    throw new Error("输入合计最多 200,000 字符");
  if (kind === "text-case") return changeCase(input, mode);
  if (kind === "unicode") return unicodeText(input, mode === "decode");
  if (kind === "morse") return morseText(input, mode === "decode");
  if (kind === "text-extract")
    return extractText(input, mode) || "未找到匹配项";
  if (kind === "chinese-convert") {
    const { Converter } = await import("opencc-js");
    return Converter(
      mode === "to-cn"
        ? { from: "twp", to: "cn" }
        : { from: "cn", to: mode === "to-tw" ? "twp" : "t" },
    )(input);
  }
  if (kind === "json-types") return jsonTypes(parseJson(input));
  if (kind === "json-query")
    return JSON.stringify(
      queryJson(parseJson(input), request.path || "$"),
      null,
      2,
    );
  if (kind === "json-compare") {
    const changes = compareJson(
      parseJson(input),
      parseJson(request.second || ""),
    );
    return changes.length
      ? JSON.stringify(changes, null, 2)
      : "两个 JSON 的结构与值一致（对象键的顺序忽略，数组顺序保留）";
  }
  if (kind === "xml") {
    if (/<!DOCTYPE|<!ENTITY/i.test(input))
      throw new Error("不支持 DTD 与实体声明，请移除后再处理");
    const { XMLParser, XMLBuilder, XMLValidator } =
      await import("fast-xml-parser");
    const valid = XMLValidator.validate(input);
    if (valid !== true) throw new Error("XML 格式有误：" + valid.err.msg);
    const options = {
      ignoreAttributes: false,
      trimValues: false,
      parseTagValue: false,
      parseAttributeValue: false,
      preserveOrder: mode === "format",
    };
    const data = new XMLParser(options).parse(input);
    return mode === "format"
      ? new XMLBuilder({
          ...options,
          format: true,
          suppressEmptyNode: true,
        }).build(data)
      : JSON.stringify(data, null, 2);
  }
  if (kind === "code-format") {
    if (input.length > 100000) throw new Error("代码最多 100,000 字符");
    const { format } = await import("prettier/standalone");
    if (mode === "html")
      return format(input, {
        parser: "html",
        plugins: [await import("prettier/plugins/html")],
        tabWidth: 2,
      });
    if (mode === "css")
      return format(input, {
        parser: "css",
        plugins: [await import("prettier/plugins/postcss")],
        tabWidth: 2,
      });
    return format(input, {
      parser: "babel",
      plugins: [
        await import("prettier/plugins/babel"),
        await import("prettier/plugins/estree"),
      ],
      tabWidth: 2,
    });
  }
  throw new Error("未知处理方式");
}
