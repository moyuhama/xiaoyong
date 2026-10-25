import { Cron } from "croner";
import cronstrue from "cronstrue";
import "cronstrue/locales/zh_CN";
export function inspectCron(
  expression: string,
  timezone: string,
  after: number,
) {
  const source = expression.trim().replace(/\s+/g, " ");
  if (
    source.length > 200 ||
    source.split(" ").length !== 5 ||
    !/^[\d*,/\- ]+$/.test(source)
  )
    throw new Error(
      "请输入标准 5 段 Cron：分 时 日 月 周；支持数字、*、,、-、/",
    );
  if (!Number.isFinite(after)) throw new Error("起始时间无效");
  new Intl.DateTimeFormat("zh-CN", { timeZone: timezone }).format();
  const job = new Cron(source, {
    timezone,
    paused: true,
    domAndDow: false,
    mode: "5-part",
  });
  try {
    const dates = job
      .nextRuns(5, new Date(after))
      .map((date) => date.toISOString());
    if (!dates.length) throw new Error("此规则没有可用的后续执行时间");
    return {
      description: cronstrue.toString(source, {
        locale: "zh_CN",
        use24HourTimeFormat: true,
        dayOfWeekStartIndexZero: true,
      }),
      dates,
    };
  } finally {
    job.stop();
  }
}
