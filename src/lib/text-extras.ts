export function replaceLiteral(
  input: string,
  search: string,
  replacement: string,
  ignoreCase: boolean,
) {
  if (
    input.length > 200000 ||
    search.length > 1000 ||
    replacement.length > 10000
  )
    throw new Error(
      "原文最多 200,000 字符，查找词最多 1,000 字符，替换内容最多 10,000 字符",
    );
  if (!search) return { text: input, count: 0 };
  const pattern = new RegExp(
    search.replace(/[.*+?^\${}()|[\]\\]/g, "\\$&"),
    ignoreCase ? "giu" : "gu",
  );
  const count = Array.from(input.matchAll(pattern)).length;
  if (input.length + count * (replacement.length - search.length) > 2000000)
    throw new Error("替换结果超过 2,000,000 字符，请缩短替换内容");
  return { text: input.replace(pattern, () => replacement), count };
}
export type ListOperation =
  "intersection" | "union" | "left" | "right" | "difference";
export function compareLists(
  a: string,
  b: string,
  operation: ListOperation,
  ignoreCase: boolean,
) {
  if (a.length + b.length > 1000000)
    throw new Error("两份列表合计请控制在 1,000,000 字符以内");
  const key = (text: string) => (ignoreCase ? text.toLowerCase() : text);
  function entries(text: string) {
    const map = new Map<string, string>();
    for (const line of text.split(/\r?\n/)) {
      const value = line.trim();
      if (value && !map.has(key(value))) map.set(key(value), value);
    }
    return map;
  }
  const left = entries(a),
    right = entries(b),
    combined = new Map([...right, ...left]);
  const ordered = [...new Set([...left.keys(), ...right.keys()])];
  const selected = ordered.filter(
    (k) =>
      operation === "union" ||
      (operation === "intersection"
        ? left.has(k) && right.has(k)
        : operation === "left"
          ? left.has(k) && !right.has(k)
          : operation === "right"
            ? right.has(k) && !left.has(k)
            : left.has(k) !== right.has(k)),
  );
  return {
    text: selected.map((k) => combined.get(k)).join("\n"),
    left: left.size,
    right: right.size,
    count: selected.length,
  };
}
