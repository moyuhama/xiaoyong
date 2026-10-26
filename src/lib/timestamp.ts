export type TimestampUnit = "auto" | "seconds" | "milliseconds";
const formatters = new Map<string, Intl.DateTimeFormat>();
function formatter(zone: string) {
  let value = formatters.get(zone);
  if (!value) {
    value = new Intl.DateTimeFormat("en-CA", {
      timeZone: zone,
      calendar: "iso8601",
      numberingSystem: "latn",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      era: "short",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hourCycle: "h23",
      timeZoneName: "longOffset",
    });
    formatters.set(zone, value);
  }
  return value;
}
const pad = (n: number, size = 2) => String(n).padStart(size, "0");
function dateParts(value: number, zone: string) {
  const parts = formatter(zone).formatToParts(value);
  const get = (name: string) => parts.find((p) => p.type === name)?.value || "";
  const year = Number(get("year"));
  return {
    year: get("era") === "BC" ? 1 - year : year,
    month: Number(get("month")),
    day: Number(get("day")),
    hour: Number(get("hour")),
    minute: Number(get("minute")),
    second: Number(get("second")),
    millisecond: ((value % 1000) + 1000) % 1000,
    offset: get("timeZoneName")
      .replace("GMT", "UTC")
      .replace(/^UTC[+-]00:00$/, "UTC"),
  };
}
type DateParts = ReturnType<typeof dateParts>;
function wallValue(
  p: Pick<
    DateParts,
    "year" | "month" | "day" | "hour" | "minute" | "second" | "millisecond"
  >,
) {
  const date = new Date(0);
  date.setUTCFullYear(p.year, p.month - 1, p.day);
  date.setUTCHours(p.hour, p.minute, p.second, p.millisecond);
  return date.getTime();
}
function inRange(value: number) {
  const year = new Date(value).getUTCFullYear();
  if (
    !Number.isSafeInteger(value) ||
    !Number.isFinite(year) ||
    year < 1 ||
    year > 9999
  )
    throw new Error("日期超出支持范围（0001–9999 年）");
  return value;
}
export function readTimestamp(input: string, unit: TimestampUnit = "auto") {
  const value = input.trim();
  if (!/^-?\d+$/.test(value) || value.length > 17)
    throw new Error("请输入整数时间戳，不要包含日期、空格或小数");
  let resolved: Exclude<TimestampUnit, "auto">;
  if (unit === "auto") {
    const digits = value.replace(/^-/, "").length;
    if (digits <= 10) resolved = "seconds";
    else if (digits === 13) resolved = "milliseconds";
    else throw new Error("这个位数无法可靠识别，请手动选择秒或毫秒");
  } else resolved = unit;
  const number = Number(value);
  if (!Number.isSafeInteger(number)) throw new Error("时间戳超出安全整数范围");
  return {
    milliseconds: inRange(number * (resolved === "seconds" ? 1000 : 1)),
    unit: resolved,
  };
}
export function timestampDetails(milliseconds: number, zone: string) {
  inRange(milliseconds);
  const p = dateParts(milliseconds, zone);
  if (p.year < 1 || p.year > 9999) throw new Error("此时区的日期超出支持范围");
  const date = `${pad(p.year, 4)}-${pad(p.month)}-${pad(p.day)}`;
  const time = `${pad(p.hour)}:${pad(p.minute)}:${pad(p.second)}`;
  return {
    date,
    time,
    dateTime: `${date} ${time}.${pad(p.millisecond, 3)}`,
    offset: p.offset,
    iso: new Date(milliseconds).toISOString(),
    seconds: String(Math.floor(milliseconds / 1000)),
    milliseconds: String(milliseconds),
  };
}
export function readDateTime(input: string, zone: string) {
  const match = input
    .trim()
    .match(
      /^(\d{4})[-/](\d{2})[-/](\d{2})(?:[ T](\d{2}):(\d{2})(?::(\d{2})(?:\.(\d{1,3}))?)?)?(Z|[+-]\d{2}:\d{2})?$/i,
    );
  if (!match)
    throw new Error("请输入 YYYY-MM-DD HH:mm:ss，可带毫秒、Z 或 +08:00");
  const p = {
    year: Number(match[1]),
    month: Number(match[2]),
    day: Number(match[3]),
    hour: Number(match[4] || 0),
    minute: Number(match[5] || 0),
    second: Number(match[6] || 0),
    millisecond: Number((match[7] || "0").padEnd(3, "0")),
  };
  const wall = wallValue(p),
    date = new Date(wall);
  if (
    p.year < 1 ||
    p.year > 9999 ||
    p.month < 1 ||
    p.month > 12 ||
    p.day < 1 ||
    p.hour > 23 ||
    p.minute > 59 ||
    p.second > 59 ||
    date.getUTCFullYear() !== p.year ||
    date.getUTCMonth() + 1 !== p.month ||
    date.getUTCDate() !== p.day
  )
    throw new Error("日期或时间无效，请检查月份、天数及小时");
  if (match[8]) {
    const offset = match[8].toUpperCase();
    if (offset === "Z") return inRange(wall);
    const hours = Number(offset.slice(1, 3)),
      minutes = Number(offset.slice(4));
    if (hours > 14 || minutes > 59 || (hours === 14 && minutes !== 0))
      throw new Error("UTC 偏移应在 -14:00 至 +14:00 之间");
    return inRange(
      wall - (offset[0] === "+" ? 1 : -1) * (hours * 60 + minutes) * 60000,
    );
  }
  // Offsets on either side of the requested date reveal both sides of a DST transition.
  const candidates = new Set<number>();
  for (const hours of [-48, -24, 0, 24, 48]) {
    const probe = wall + hours * 3600000;
    const offset = wallValue(dateParts(probe, zone)) - probe;
    const candidate = wall - offset;
    if (wallValue(dateParts(candidate, zone)) === wall)
      candidates.add(candidate);
  }
  if (!candidates.size)
    throw new Error(
      "该时间在所选时区不存在（夏令时跳时），请换一个时间或明确 UTC 偏移",
    );
  if (candidates.size > 1)
    throw new Error(
      "该时间在所选时区出现两次（夏令时回拨），请附加明确偏移，如 -04:00 或 -05:00",
    );
  return inRange([...candidates][0]!);
}
export function calendarDays(start: string, end: string) {
  if (![start, end].every((v) => /^\d{4}-\d{2}-\d{2}$/.test(v)))
    throw new Error("请选择完整的开始和结束日期");
  return (readDateTime(end, "UTC") - readDateTime(start, "UTC")) / 86400000;
}
export function batchTimestamps(
  input: string,
  direction: "to-date" | "to-stamp",
  unit: TimestampUnit,
  zone: string,
) {
  const lines = input.replace(/\r\n?/g, "\n").split("\n");
  if (!input.trim()) throw new Error("请先输入要转换的内容，每行一条");
  if (input.length > 100000 || lines.length > 1000)
    throw new Error("每次最多 1,000 行、100,000 字符");
  return lines.flatMap((value, index) => {
    if (!value.trim()) return [];
    try {
      const ms =
        direction === "to-date"
          ? readTimestamp(value, unit).milliseconds
          : readDateTime(value, zone);
      const result = timestampDetails(ms, zone);
      return [
        {
          line: index + 1,
          input: value.trim(),
          output:
            direction === "to-date"
              ? result.dateTime + " " + result.offset
              : unit === "milliseconds"
                ? result.milliseconds
                : result.seconds,
          error: "",
        },
      ];
    } catch (e) {
      return [
        {
          line: index + 1,
          input: value.trim(),
          output: "",
          error: e instanceof Error ? e.message : "转换失败",
        },
      ];
    }
  });
}
