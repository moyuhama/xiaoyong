import { inspectCron } from "../lib/cron";
self.onmessage = (
  event: MessageEvent<{ expression: string; timezone: string; after: number }>,
) => {
  try {
    self.postMessage({
      result: inspectCron(
        event.data.expression,
        event.data.timezone,
        event.data.after,
      ),
    });
  } catch (err) {
    self.postMessage({
      error:
        "解析失败：" + (err instanceof Error ? err.message : "请检查表达式"),
    });
  }
};
