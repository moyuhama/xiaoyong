export function moneyUppercase(input: string) {
  const raw = input.trim().replace(/^[￥¥]/, "");
  if (!/^-?(?:\d+|\d{1,3}(?:,\d{3})+)(?:\.\d{1,2})?$/.test(raw))
    throw new Error("请输入金额，最多两位小数；千位逗号需按三位分组");
  const [whole = "", decimal = ""] = raw
    .replace(/^-/, "")
    .replace(/,/g, "")
    .split(".");
  const integer = whole.replace(/^0+(?=\d)/, "");
  if (integer.length > 16) throw new Error("整数部分最多 16 位");
  const digits = "零壹贰叁肆伍陆柒捌玖";
  function group(value: string) {
    const text = value.padStart(4, "0");
    let output = "",
      zero = false;
    for (let i = 0; i < 4; i++) {
      const n = Number(text[i]);
      if (!n) {
        if (output) zero = true;
        continue;
      }
      if (zero) output += "零";
      output += digits[n]! + ["仟", "佰", "拾", ""][i]!;
      zero = false;
    }
    return output;
  }
  const groups = integer.match(/\d{1,4}(?=(?:\d{4})*$)/g)!;
  let output = "",
    skipped = false;
  groups.forEach((part, index) => {
    const value = Number(part);
    if (!value) {
      if (output) skipped = true;
      return;
    }
    if (output && (skipped || value < 1000)) output += "零";
    output += group(part) + ["", "万", "亿", "兆"][groups.length - index - 1]!;
    skipped = false;
  });
  const [jiao, fen] = decimal.padEnd(2, "0").split("").map(Number);
  output = (output || "零") + "元";
  if (jiao) output += digits[jiao]! + "角";
  if (fen) {
    if (!jiao && integer !== "0") output += "零";
    output += digits[fen]! + "分";
  } else output += "整";
  return (
    (raw.startsWith("-") && (integer !== "0" || jiao || fen) ? "负" : "") +
    output
  );
}

function randomBelow(limit: number) {
  const bound = Math.floor(4294967296 / limit) * limit;
  const bytes = new Uint32Array(1);
  let value: number;
  do {
    crypto.getRandomValues(bytes);
    value = bytes[0]!;
  } while (value >= bound);
  return value % limit;
}
export function randomNumbers(
  min: number,
  max: number,
  count: number,
  unique: boolean,
) {
  if (
    ![min, max, count].every(Number.isSafeInteger) ||
    min < -1e9 ||
    max > 1e9 ||
    min > max
  )
    throw new Error("范围需为 -10 亿至 10 亿的整数，最小值不能大于最大值");
  if (count < 1 || count > 1000) throw new Error("生成数量需为 1–1000");
  const size = max - min + 1;
  if (unique && count > size)
    throw new Error("不重复时，数量不能超过范围内的整数个数");
  const remapped = new Map<number, number>(),
    result: number[] = [];
  for (let i = 0; i < count; i++) {
    if (!unique) {
      result.push(min + randomBelow(size));
      continue;
    }
    const end = size - i - 1,
      index = randomBelow(end + 1);
    result.push(min + (remapped.get(index) ?? index));
    remapped.set(index, remapped.get(end) ?? end);
    remapped.delete(end);
  }
  return result;
}

export interface TextWorkshopRequest {
  kind: "sql" | "pinyin";
  text: string;
  dialect?: "sql" | "mysql" | "postgresql" | "sqlite" | "transactsql";
  keywordCase?: "upper" | "lower" | "preserve";
  indent?: number;
  tone?: "symbol" | "num" | "none";
  initials?: boolean;
  surname?: boolean;
  uppercase?: boolean;
}
export async function textWorkshop(request: TextWorkshopRequest) {
  if (!request.text.trim()) throw new Error("请先输入内容");
  if (request.text.length > (request.kind === "sql" ? 50000 : 10000))
    throw new Error(
      request.kind === "sql"
        ? "SQL 最多 50,000 字符"
        : "拼音转换最多 10,000 字符",
    );
  if (request.kind === "sql") {
    const { format } = await import("sql-formatter");
    return format(request.text, {
      language: request.dialect || "sql",
      keywordCase: request.keywordCase || "upper",
      tabWidth: request.indent || 2,
    });
  }
  const { pinyin } = await import("pinyin-pro");
  const result = request.text
    .split(/\r?\n/)
    .map((line) =>
      pinyin(line, {
        toneType: request.initials ? "none" : request.tone || "symbol",
        pattern: request.initials ? "first" : "pinyin",
        mode: request.surname ? "surname" : "normal",
        nonZh: "consecutive",
      }),
    )
    .join("\n");
  return request.uppercase ? result.toUpperCase() : result;
}
