import { describe, it, expect, vi } from "vitest";
import {
  readTimestamp,
  readDateTime,
  timestampDetails,
  calendarDays,
  batchTimestamps,
} from "./timestamp";
import { tools, searchTools } from "./tools";

describe("时间戳入口和单位", () => {
  it("保留原有链接，首页前置，搜索中英文均能找到", () => {
    expect(tools[0]?.id).toBe("datetime");
    expect(tools.find((t) => t.id === "datetime")?.name).toBe("时间戳转换");
    for (const query of ["时间戳", "timestamp", "unix", "日期差"])
      expect(searchTools(query)[0]?.id).toBe("datetime");
  });
  it("自动识别常见秒、毫秒、零和负时间戳", () => {
    expect(readTimestamp("1735689600")).toEqual({
      milliseconds: 1735689600000,
      unit: "seconds",
    });
    expect(readTimestamp("1735689600123")).toEqual({
      milliseconds: 1735689600123,
      unit: "milliseconds",
    });
    expect(readTimestamp("0").milliseconds).toBe(0);
    expect(readTimestamp("-1").milliseconds).toBe(-1000);
    expect(readTimestamp("-1", "milliseconds").milliseconds).toBe(-1);
  });
  it("不猜测有歧义的位数，允许手动指定历史毫秒", () => {
    expect(() => readTimestamp("10000000000")).toThrow(/手动/);
    expect(() => readTimestamp("999999999999")).toThrow(/手动/);
    expect(readTimestamp("999999999999", "milliseconds").milliseconds).toBe(
      999999999999,
    );
    for (const value of ["", "1.2", "abc", "Infinity", "999999999999999999999"])
      expect(() => readTimestamp(value)).toThrow();
  });
});
describe("日期、精度与时区", () => {
  it("不同运行环境的零时区名称统一为 UTC", () => {
    const original = Intl.DateTimeFormat.prototype.formatToParts;
    const spy = vi.spyOn(Intl.DateTimeFormat.prototype, "formatToParts");
    try {
      for (const name of ["GMT", "GMT+00:00", "GMT-00:00"]) {
        spy.mockImplementation(function (this: Intl.DateTimeFormat, date) {
          return original.call(this, date).map((part) =>
            part.type === "timeZoneName" ? { ...part, value: name } : part,
          );
        });
        expect(timestampDetails(0, "UTC").offset).toBe("UTC");
      }
    } finally {
      spy.mockRestore();
    }
  });
  it("北京时间与 UTC 互转保留毫秒", () => {
    const ms = readDateTime("2025-01-01 08:00:00.123", "Asia/Shanghai");
    expect(ms).toBe(1735689600123);
    expect(timestampDetails(ms, "UTC")).toMatchObject({
      dateTime: "2025-01-01 00:00:00.123",
      seconds: "1735689600",
      milliseconds: "1735689600123",
      iso: "2025-01-01T00:00:00.123Z",
    });
    expect(timestampDetails(ms, "Asia/Shanghai").offset).toBe("UTC+08:00");
  });
  it("显式时区优先，并接受日期、斜线和分钟精度", () => {
    for (const text of [
      "2025-01-01T00:00:00Z",
      "2025-01-01 08:00:00+08:00",
      "2024-12-31 19:00:00-05:00",
    ])
      expect(readDateTime(text, "Asia/Tokyo")).toBe(1735689600000);
    expect(readDateTime("2025/01/01 00:00", "UTC")).toBe(1735689600000);
    expect(readDateTime("2025-01-01", "UTC")).toBe(1735689600000);
    expect(readDateTime("2025-01-01 05:30:00", "Asia/Kolkata")).toBe(
      1735689600000,
    );
  });
  it("严格校验闰日、月份和时间，不自动滚动成下个月", () => {
    expect(readDateTime("2024-02-29 00:00:00", "UTC")).toBe(
      Date.UTC(2024, 1, 29),
    );
    for (const value of [
      "2025-02-29",
      "2025-04-31",
      "2025-13-01",
      "2025-00-01",
      "2025-01-00",
      "2025-01-01 24:00",
      "2025-01-01 00:60",
      "2025-01-01 00:00:60",
      "2025-01-01 00:00:00+14:01",
      "0000-01-01",
    ])
      expect(() => readDateTime(value, "UTC")).toThrow();
  });
  it("纽约夏令时跳时和回拨明确提示，偏移可消除歧义", () => {
    expect(() =>
      readDateTime("2026-03-08 02:30:00", "America/New_York"),
    ).toThrow(/不存在/);
    expect(() =>
      readDateTime("2026-11-01 01:30:00", "America/New_York"),
    ).toThrow(/两次/);
    const early = readDateTime("2026-11-01 01:30:00-04:00", "America/New_York");
    const late = readDateTime("2026-11-01 01:30:00-05:00", "America/New_York");
    expect(late - early).toBe(3600000);
    expect(timestampDetails(early, "America/New_York").dateTime).toBe(
      "2026-11-01 01:30:00.000",
    );
  });
  it("负毫秒和早期年份不会损失精度或被改成 1900 年", () => {
    expect(timestampDetails(-1, "UTC")).toMatchObject({
      dateTime: "1969-12-31 23:59:59.999",
      seconds: "-1",
      milliseconds: "-1",
    });
    const ms = readDateTime("0099-01-01 00:00:00", "UTC");
    expect(timestampDetails(ms, "UTC").dateTime).toBe(
      "0099-01-01 00:00:00.000",
    );
  });
  it("多个时区与历史日期可精确往返", () => {
    for (const zone of [
      "Asia/Shanghai",
      "Asia/Kolkata",
      "America/New_York",
      "Europe/London",
      "Australia/Sydney",
      "Pacific/Auckland",
    ])
      for (const iso of [
        "1969-01-02T10:11:12.345Z",
        "1988-07-10T10:11:12.001Z",
        "2026-01-12T10:11:12.999Z",
        "2026-08-12T10:11:12.456Z",
      ]) {
        const ms = Date.parse(iso);
        expect(readDateTime(timestampDetails(ms, zone).dateTime, zone)).toBe(
          ms,
        );
      }
  });
});
describe("批量转换与日期差", () => {
  it("混合单位逐行转换，失败保留行号，其余结果不丢失", () => {
    const rows = batchTimestamps(
      "0\n\nwrong\n1735689600123\n-1",
      "to-date",
      "auto",
      "UTC",
    );
    expect(rows.map((r) => r.line)).toEqual([1, 3, 4, 5]);
    expect(rows[0]?.output).toBe("1970-01-01 00:00:00.000 UTC");
    expect(rows[1]?.error).not.toBe("");
    expect(rows[2]?.output).toBe("2025-01-01 00:00:00.123 UTC");
    expect(rows[3]?.output).toBe("1969-12-31 23:59:59.000 UTC");
  });
  it("日期批量输出毫秒并限制大批量输入", () => {
    expect(
      batchTimestamps(
        "2025-01-01T00:00:00.123Z",
        "to-stamp",
        "milliseconds",
        "Asia/Shanghai",
      )[0]?.output,
    ).toBe("1735689600123");
    expect(() =>
      batchTimestamps("0\n".repeat(1001), "to-date", "auto", "UTC"),
    ).toThrow(/1,000/);
    expect(() => batchTimestamps(" ", "to-date", "auto", "UTC")).toThrow();
  });
  it("日期差按日历日计算，包括闰日和反向区间", () => {
    expect(calendarDays("2024-02-28", "2024-03-01")).toBe(2);
    expect(calendarDays("2026-03-07", "2026-03-09")).toBe(2);
    expect(calendarDays("2026-10-30", "2026-10-26")).toBe(-4);
    expect(() => calendarDays("2025-02-29", "2025-03-01")).toThrow();
  });
});
