export type JsonAction = "format" | "minify" | "escape" | "unescape";

export function processJson(
  source: string,
  action: JsonAction,
  indent: number | string = 2,
  outerQuotes = false,
): string {
  if (!source.length) throw new Error("请先输入需要处理的内容");
  if (source.length > 2000000)
    throw new Error("输入请控制在 2,000,000 字符以内");

  if (action === "escape") {
    const escaped = JSON.stringify(source);
    return outerQuotes ? escaped : escaped.slice(1, -1);
  }
  if (action === "unescape") {
    try {
      const trimmed = source.trim();
      if (trimmed.startsWith('"')) {
        const value: unknown = JSON.parse(trimmed);
        if (typeof value !== "string") throw new Error();
        return value;
      }
      // Also accept escaped fragments pasted without surrounding quotes.
      // Preserve literal line breaks from formatted snippets as string content.
      const body = source.replace(/[\u0000-\u001f]/g, (char) =>
        JSON.stringify(char).slice(1, -1),
      );
      return JSON.parse('"' + body + '"') as string;
    } catch {
      throw new Error(
        "转义内容有误：请输入 JSON 字符串或转义后的文本，检查双引号、反斜杠及 Unicode 转义是否完整。",
      );
    }
  }
  if (!source.trim()) throw new Error("请先输入 JSON 内容");
  try {
    return JSON.stringify(
      JSON.parse(source),
      null,
      action === "minify" ? 0 : indent,
    );
  } catch (err) {
    throw new Error(
      "JSON 格式有误：" + (err instanceof Error ? err.message : "请检查输入"),
    );
  }
}
