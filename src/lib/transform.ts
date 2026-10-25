export function cleanText(
  value: string,
  options: { trim: boolean; empty: boolean; spaces: boolean; case: string },
) {
  let result = value.replace(/\r\n?/g, "\n");
  if (options.trim)
    result = result
      .split("\n")
      .map((line) => line.trim())
      .join("\n");
  if (options.spaces) result = result.replace(/[ \t]+/g, " ");
  if (options.empty)
    result = result
      .split("\n")
      .filter((line) => line.trim())
      .join("\n");
  if (options.case === "upper") result = result.toUpperCase();
  if (options.case === "lower") result = result.toLowerCase();
  return result;
}
export function processLines(
  value: string,
  dedupe: boolean,
  trim: boolean,
  sort: string,
) {
  if (!value) return "";
  let lines = value.replace(/\r\n?/g, "\n").split("\n");
  if (trim) lines = lines.map((line) => line.trim()).filter(Boolean);
  if (dedupe) lines = [...new Set(lines)];
  if (sort !== "none")
    lines.sort(
      (a, b) =>
        a.localeCompare(b, "zh-CN", { numeric: true }) *
        (sort === "desc" ? -1 : 1),
    );
  return lines.join("\n");
}
export function encodeText(value: string, mode: string, decode: boolean) {
  if (mode === "url")
    return decode ? decodeURIComponent(value) : encodeURIComponent(value);
  if (decode) {
    const bytes = Uint8Array.from(atob(value.replace(/\s/g, "")), (char) =>
      char.charCodeAt(0),
    );
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  }
  const bytes = new TextEncoder().encode(value);
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}
export function randomIndex(max: number) {
  if (max < 1) throw new Error("随机范围不能为空");
  const buffer = new Uint32Array(1);
  const limit = Math.floor(0x100000000 / max) * max;
  do {
    crypto.getRandomValues(buffer);
  } while (buffer[0]! >= limit);
  return buffer[0]! % max;
}
const alphabets: Record<string, string> = {
  lower: "abcdefghijklmnopqrstuvwxyz",
  upper: "ABCDEFGHIJKLMNOPQRSTUVWXYZ",
  number: "0123456789",
  symbol: "!@#$%^&*()-_=+[]{}:;,.?",
};
export function generatePassword(length: number, groups: string[]) {
  if (!groups.length) throw new Error("请至少选择一种字符类型");
  if (!Number.isInteger(length) || length < groups.length || length > 128)
    throw new Error("密码长度需为 4–128 的整数，且不少于所选字符类型数");
  const selected = groups
    .map((key) => alphabets[key])
    .filter((value): value is string => Boolean(value));
  if (!selected.length) throw new Error("字符类型无效");
  const pool = selected.join("");
  const result = selected.map((group) => group[randomIndex(group.length)]!);
  while (result.length < length) result.push(pool[randomIndex(pool.length)]!);
  for (let i = result.length - 1; i > 0; i--) {
    const j = randomIndex(i + 1);
    [result[i], result[j]] = [result[j]!, result[i]!];
  }
  return result.join("");
}
export function parseColor(input: string) {
  const value = input.trim().toLowerCase();
  let rgb: number[];
  if (/^#?[0-9a-f]{3}$/.test(value)) {
    const raw = value.replace("#", "");
    rgb = [...raw].map((char) => parseInt(char + char, 16));
  } else if (/^#?[0-9a-f]{6}$/.test(value)) {
    const raw = value.replace("#", "");
    rgb = [0, 2, 4].map((i) => parseInt(raw.slice(i, i + 2), 16));
  } else {
    const matched = value.match(/^rgb\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*\)$/);
    const hsl = value.match(
      /^hsl\(\s*(-?\d+(?:\.\d+)?)\s*,\s*(\d+(?:\.\d+)?)%\s*,\s*(\d+(?:\.\d+)?)%\s*\)$/,
    );
    if (matched) {
      rgb = matched.slice(1).map(Number);
      if (rgb.some((n) => n > 255))
        throw new Error("RGB 的每个数值需在 0–255 之间");
    } else if (hsl) {
      const h = ((Number(hsl[1]) % 360) + 360) % 360;
      const s = Number(hsl[2]) / 100,
        l = Number(hsl[3]) / 100;
      if (s > 1 || l > 1) throw new Error("饱和度与亮度需在 0–100% 之间");
      const a = s * Math.min(l, 1 - l);
      const channel = (n: number) => {
        const k = (n + h / 30) % 12;
        return Math.round(
          255 * (l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1))),
        );
      };
      rgb = [channel(0), channel(8), channel(4)];
    } else
      throw new Error("请输入 HEX、rgb(22, 131, 108) 或 hsl(167, 71%, 30%)");
  }
  const [r, g, b] = rgb.map((n) => n / 255) as [number, number, number];
  const max = Math.max(r, g, b),
    min = Math.min(r, g, b),
    delta = max - min;
  const l = (max + min) / 2;
  let h = 0,
    s = 0;
  if (delta) {
    s = delta / (1 - Math.abs(2 * l - 1));
    h =
      max === r
        ? ((g - b) / delta) % 6
        : max === g
          ? (b - r) / delta + 2
          : (r - g) / delta + 4;
    h = (h * 60 + 360) % 360;
  }
  return {
    hex:
      "#" +
      rgb
        .map((n) => n.toString(16).padStart(2, "0"))
        .join("")
        .toUpperCase(),
    rgb: "rgb(" + rgb.join(", ") + ")",
    hsl:
      "hsl(" +
      Math.round(h) +
      ", " +
      Math.round(s * 100) +
      "%, " +
      Math.round(l * 100) +
      "%)",
    channels: rgb,
  };
}
export function parseTimestamp(value: string, unit: string) {
  if (!/^-?\d+$/.test(value.trim())) throw new Error("请输入整数时间戳");
  const number = Number(value);
  if (!Number.isSafeInteger(number)) throw new Error("时间戳超出安全整数范围");
  const date = new Date(number * (unit === "seconds" ? 1000 : 1));
  if (Number.isNaN(date.getTime())) throw new Error("时间戳超出可表示范围");
  return date;
}
export function parseDateInput(value: string, utc = false) {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?$/.test(value))
    throw new Error("请填写完整日期和时间");
  const date = new Date(value + (utc ? "Z" : ""));
  if (Number.isNaN(date.getTime())) throw new Error("日期格式无效");
  return date;
}
