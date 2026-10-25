import { randomIndex } from "./transform";

const TEXT_LIMIT = 2_000_000;
function checkText(value: string) {
  if (value.length > TEXT_LIMIT)
    throw new Error("内容请控制在 2,000,000 字符以内");
}
function checkDelimiter(delimiter: string) {
  if (![",", ";", "\t"].includes(delimiter)) throw new Error("分隔符无效");
}
export function parseCsv(source: string, delimiter = ","): string[][] {
  checkText(source);
  checkDelimiter(delimiter);
  const value = source.replace(/^\uFEFF/, "");
  const rows: string[][] = [];
  let cells = 0;
  let row: string[] = [],
    field = "",
    quoted = false,
    closed = false,
    started = false;
  function pushField() {
    if (++cells > 200000) throw new Error("最多支持 200,000 个单元格");
    row.push(field);
    field = "";
    closed = false;
    if (row.length > 1000) throw new Error("每行最多支持 1,000 列");
  }
  function pushRow() {
    if (started || field || row.length) {
      pushField();
      rows.push(row);
      if (rows.length > 10001) throw new Error("最多支持 10,000 行数据");
    }
    row = [];
    field = "";
    closed = false;
    started = false;
  }
  for (let i = 0; i < value.length; i++) {
    const char = value[i]!;
    if (quoted) {
      if (char === '"') {
        if (value[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          quoted = false;
          closed = true;
        }
      } else field += char;
      continue;
    }
    if (char === delimiter) {
      started = true;
      pushField();
    } else if (char === "\n" || char === "\r") {
      pushRow();
      if (char === "\r" && value[i + 1] === "\n") i++;
    } else if (closed) throw new Error("引号结束后应当是分隔符或换行");
    else if (char === '"') {
      if (field)
        throw new Error("字段中的双引号需要放在引号字段中，并写成两个双引号");
      quoted = true;
      started = true;
    } else {
      field += char;
      started = true;
    }
  }
  if (quoted) throw new Error("有未闭合的双引号，请检查 CSV 内容");
  pushRow();
  return rows;
}
export function csvToJson(source: string, delimiter = ",") {
  const [headers, ...rows] = parseCsv(source, delimiter);
  if (!headers) throw new Error("请先输入 CSV 内容");
  if (headers.some((header) => !header.trim()))
    throw new Error("第一行的列名不能为空");
  if (new Set(headers).size !== headers.length)
    throw new Error("第一行存在重复列名");
  return JSON.stringify(
    rows.map((row, index) => {
      if (row.length !== headers.length)
        throw new Error("第 " + (index + 2) + " 行的列数与表头不一致");
      return Object.fromEntries(headers.map((header, i) => [header, row[i]]));
    }),
    null,
    2,
  );
}
export function jsonToCsv(
  source: string,
  delimiter = ",",
  protectFormulas = true,
) {
  checkText(source);
  checkDelimiter(delimiter);
  let records: unknown;
  try {
    records = JSON.parse(source);
  } catch {
    throw new Error("JSON 格式有误，请输入对象组成的数组");
  }
  if (
    !Array.isArray(records) ||
    !records.length ||
    records.some(
      (record) =>
        !record || typeof record !== "object" || Array.isArray(record),
    )
  ) {
    throw new Error("请输入至少包含一个对象的 JSON 数组");
  }
  if (records.length > 10000) throw new Error("最多支持 10,000 行数据");
  const headers = [
    ...new Set(records.flatMap((record) => Object.keys(record))),
  ];
  if (!headers.length || headers.some((header) => !header.trim()))
    throw new Error("对象的字段名不能为空");
  if (headers.length > 1000) throw new Error("最多支持 1,000 列");
  if ((records.length + 1) * headers.length > 200000)
    throw new Error("展开后超过 200,000 个单元格，请减少行数或字段数");
  function cell(value: unknown): string {
    let text =
      value == null
        ? ""
        : typeof value === "object"
          ? JSON.stringify(value)
          : String(value);
    if (
      protectFormulas &&
      typeof value === "string" &&
      /^\s*[=+\-@]/.test(text)
    )
      text = "'" + text;
    return text.includes(delimiter) || /["\r\n]/.test(text)
      ? '"' + text.replace(/"/g, '""') + '"'
      : text;
  }
  return [
    headers.map(cell).join(delimiter),
    ...records.map((record) =>
      headers
        .map((key) => cell(Object.hasOwn(record, key) ? record[key] : ""))
        .join(delimiter),
    ),
  ].join("\r\n");
}
export function convertRadix(source: string, from: number, to: number) {
  if (
    ![from, to].every(
      (base) => Number.isInteger(base) && base >= 2 && base <= 36,
    )
  )
    throw new Error("进制需为 2–36 的整数");
  let value = source.trim().toLowerCase();
  if (!value) throw new Error("请先输入整数");
  if (value.length > 4096) throw new Error("整数长度请控制在 4,096 位以内");
  const negative = value.startsWith("-");
  if (/^[+-]/.test(value)) value = value.slice(1);
  if (
    (from === 16 && value.startsWith("0x")) ||
    (from === 2 && value.startsWith("0b")) ||
    (from === 8 && value.startsWith("0o"))
  )
    value = value.slice(2);
  if (!value) throw new Error("请在符号或前缀后输入数字");
  const digits = "0123456789abcdefghijklmnopqrstuvwxyz";
  let result = 0n;
  for (const char of value) {
    const digit = digits.indexOf(char);
    if (digit < 0 || digit >= from)
      throw new Error("「" + char + "」不是 " + from + " 进制的有效数字");
    result = result * BigInt(from) + BigInt(digit);
  }
  return (negative ? -result : result).toString(to).toUpperCase();
}
export async function hashText(value: string, algorithm: string) {
  checkText(value);
  if (!["SHA-256", "SHA-384", "SHA-512"].includes(algorithm))
    throw new Error("不支持的哈希算法");
  const digest = await crypto.subtle.digest(
    algorithm,
    new TextEncoder().encode(value),
  );
  return Array.from(new Uint8Array(digest), (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");
}
export function parseUrl(value: string) {
  if (value.length > 20000) throw new Error("网址请控制在 20,000 字符以内");
  let url: URL;
  try {
    url = new URL(value.trim());
  } catch {
    throw new Error("请输入包含 http:// 或 https:// 的完整网址");
  }
  if (!["http:", "https:"].includes(url.protocol))
    throw new Error("仅支持 HTTP 和 HTTPS 网址");
  return {
    parts: [
      ["协议", url.protocol],
      ["主机名", url.hostname],
      [
        "端口",
        url.port || (url.protocol === "https:" ? "443（默认）" : "80（默认）"),
      ],
      ["路径", url.pathname],
      ["查询字符串", url.search || "—"],
      ["片段标识", url.hash || "—"],
      ["用户名", url.username || "—"],
      ["密码", url.password || "—"],
    ],
    params: [...url.searchParams.entries()],
  };
}
export function drawNames(source: string, count: number) {
  if (source.length > 100000) throw new Error("名单请控制在 100,000 字符以内");
  const pool = [
    ...new Set(
      source
        .split(/\r?\n/)
        .map((name) => name.trim())
        .filter(Boolean),
    ),
  ];
  if (!pool.length) throw new Error("请先输入候选名单，每行一项");
  if (pool.length > 10000) throw new Error("最多支持 10,000 个候选项");
  if (!Number.isInteger(count) || count < 1 || count > pool.length)
    throw new Error("抽取数量需为 1–" + pool.length + " 的整数");
  for (let i = 0; i < count; i++) {
    const j = i + randomIndex(pool.length - i);
    [pool[i], pool[j]] = [pool[j]!, pool[i]!];
  }
  return pool.slice(0, count);
}
