import { parseDocument, stringify } from "yaml";
import { encode, decode } from "html-entities";
export function convertYaml(source: string, toJson: boolean) {
  if (!source.trim()) throw new Error("请先输入配置内容");
  if (source.length > 200000)
    throw new Error("配置内容请控制在 200,000 字符以内");
  if (!toJson) {
    let value: unknown;
    try {
      value = JSON.parse(source);
    } catch {
      throw new Error("JSON 格式有误，请检查逗号、引号与括号");
    }
    JSON.stringify(value, (_key, item) => {
      if (
        typeof item === "number" &&
        (!Number.isFinite(item) ||
          (Number.isInteger(item) && !Number.isSafeInteger(item)))
      )
        throw new Error("数值超出安全范围，请加引号以保留精度");
      return item;
    });
    return stringify(value, { lineWidth: 0 });
  }
  const doc = parseDocument(source, {
    version: "1.2",
    uniqueKeys: true,
    intAsBigInt: true,
  });
  if (doc.errors.length || doc.warnings.length)
    throw new Error(
      "YAML 格式有误：" + (doc.errors[0]?.message || doc.warnings[0]?.message),
    );
  const value = doc.toJS({ maxAliasCount: 50, mapAsMap: true });
  const seen = new Set<object>();
  let nodes = 0;
  function normalize(item: any, depth = 0): any {
    if (++nodes > 200000 || depth > 100)
      throw new Error("配置展开后过大或嵌套过深");
    if (typeof item === "bigint") {
      if (
        item > BigInt(Number.MAX_SAFE_INTEGER) ||
        item < BigInt(Number.MIN_SAFE_INTEGER)
      )
        throw new Error("存在超出安全范围的整数，请给该数值加引号以保留精度");
      return Number(item);
    }
    if (typeof item === "number" && !Number.isFinite(item))
      throw new Error("JSON 不支持 NaN 或 Infinity");
    if (
      typeof item === "number" &&
      Number.isInteger(item) &&
      !Number.isSafeInteger(item)
    )
      throw new Error("数值超出安全范围，请加引号以保留精度");
    if (!item || typeof item !== "object") return item;
    if (seen.has(item)) throw new Error("JSON 不支持循环引用");
    seen.add(item);
    let output: unknown;
    if (item instanceof Map) {
      output = Object.fromEntries(
        [...item.entries()].map(([key, val]) => {
          if (typeof key !== "string")
            throw new Error("JSON 的对象键必须是字符串，请给 YAML 的键加引号");
          return [key, normalize(val, depth + 1)];
        }),
      );
    } else if (Array.isArray(item))
      output = item.map((val) => normalize(val, depth + 1));
    else throw new Error("配置包含无法转换为 JSON 的数据类型");
    seen.delete(item);
    return output;
  }
  return JSON.stringify(normalize(value), null, 2);
}
export function htmlEntities(source: string, toEncoded: boolean) {
  if (source.length > 200000) throw new Error("文本请控制在 200,000 字符以内");
  return toEncoded
    ? encode(source, { mode: "specialChars", level: "html5" })
    : decode(source, { level: "html5", scope: "body" });
}
export function parseJwt(source: string) {
  const text = source.trim().replace(/^Bearer\s+/i, "");
  if (text.length > 100000) throw new Error("令牌请控制在 100,000 字符以内");
  const parts = text.split(".");
  if (
    parts.length !== 3 ||
    !parts[0] ||
    !parts[1] ||
    parts.some((part) => !/^[A-Za-z0-9_-]*$/.test(part))
  )
    throw new Error("请输入由三段 Base64URL 内容组成的 JWT");
  function readPart(part: string) {
    try {
      const bytes = Uint8Array.from(
        atob(part.replace(/-/g, "+").replace(/_/g, "/")),
        (char) => char.charCodeAt(0),
      );
      const value = JSON.parse(
        new TextDecoder("utf-8", { fatal: true }).decode(bytes),
      );
      if (!value || typeof value !== "object" || Array.isArray(value))
        throw new Error();
      return value as Record<string, unknown>;
    } catch {
      throw new Error("Header 或 Payload 不是有效的 UTF-8 JSON 对象");
    }
  }
  const header = readPart(parts[0]!),
    payload = readPart(parts[1]!);
  const times = ["iat", "nbf", "exp"]
    .filter((key) => key in payload)
    .map((key) => {
      const value = payload[key],
        date =
          typeof value === "number" ? new Date(value * 1000) : new Date(NaN);
      return {
        key,
        label: (
          { iat: "签发时间", nbf: "生效时间", exp: "过期时间" } as Record<
            string,
            string
          >
        )[key],
        value: Number.isFinite(date.getTime())
          ? date.toISOString().replace("T", " ").replace("Z", " UTC")
          : "不是有效的秒级时间戳",
      };
    });
  return {
    header: JSON.stringify(header, null, 2),
    payload: JSON.stringify(payload, null, 2),
    times,
    hasSignature: !!parts[2],
  };
}
