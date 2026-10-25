import { unzipSync, zipSync, strFromU8 } from "fflate";
export interface BinaryFile {
  name: string;
  bytes: Uint8Array;
}
const LIMIT = 50 * 1024 * 1024;
function crc32(bytes: Uint8Array) {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit++)
      crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
  }
  return (crc ^ 0xffffffff) >>> 0;
}
export function inspectZip(bytes: Uint8Array) {
  if (bytes.length > 20 * 1024 * 1024) throw new Error("压缩文件最多 20 MB");
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let end = -1;
  for (let p = bytes.length - 22; p >= Math.max(0, bytes.length - 65557); p--)
    if (
      view.getUint32(p, true) === 0x06054b50 &&
      p + 22 + view.getUint16(p + 20, true) === bytes.length
    ) {
      end = p;
      break;
    }
  if (end < 0) throw new Error("文件不是完整的 ZIP / DOCX / XLSX");
  const count = view.getUint16(end + 10, true),
    start = view.getUint32(end + 16, true),
    size = view.getUint32(end + 12, true);
  if (
    view.getUint16(end + 4, true) ||
    view.getUint16(end + 6, true) ||
    count !== view.getUint16(end + 8, true) ||
    count > 200 ||
    start + size > end
  )
    throw new Error("不支持分卷、ZIP64 或超过 200 个条目的压缩文件");
  const entries: { name: string; size: number; crc: number }[] = [];
  let cursor = start,
    total = 0;
  for (let i = 0; i < count; i++) {
    if (cursor + 46 > end || view.getUint32(cursor, true) !== 0x02014b50)
      throw new Error("ZIP 目录损坏");
    const flags = view.getUint16(cursor + 8, true),
      method = view.getUint16(cursor + 10, true),
      unpacked = view.getUint32(cursor + 24, true),
      nameLength = view.getUint16(cursor + 28, true),
      extra = view.getUint16(cursor + 30, true),
      comment = view.getUint16(cursor + 32, true);
    if (flags & 1 || ![0, 8].includes(method))
      throw new Error("暂不支持加密 ZIP 或该压缩算法");
    if (
      cursor + 46 + nameLength + extra + comment > end ||
      view.getUint32(cursor + 42, true) >= start
    )
      throw new Error("ZIP 目录损坏");
    total += unpacked;
    if (total > LIMIT) throw new Error("解压后合计最多 50 MB");
    const name = strFromU8(
      bytes.slice(cursor + 46, cursor + 46 + nameLength),
      !(flags & 2048),
    );
    if (!name || /(^[\/]|^[A-Za-z]:|(^|[\\/])\.\.([\\/]|$)|\0)/.test(name))
      throw new Error("压缩包包含无效路径");
    if (entries.some((e) => e.name === name))
      throw new Error("压缩包包含同名条目，请先整理文件");
    entries.push({
      name,
      size: unpacked,
      crc: view.getUint32(cursor + 16, true),
    });
    cursor += 46 + nameLength + extra + comment;
  }
  return entries;
}
export function unpackFiles(bytes: Uint8Array): BinaryFile[] {
  const entries = inspectZip(bytes),
    data = unzipSync(bytes),
    files: BinaryFile[] = [];
  for (const entry of entries) {
    const value = data[entry.name];
    if (!value || value.length !== entry.size || crc32(value) !== entry.crc)
      throw new Error("压缩文件校验失败：" + entry.name);
    if (!entry.name.endsWith("/"))
      files.push({ name: entry.name, bytes: value });
  }
  return files;
}
export function packFiles(files: BinaryFile[]) {
  if (
    !files.length ||
    files.length > 100 ||
    files.reduce((sum, f) => sum + f.bytes.length, 0) > LIMIT
  )
    throw new Error("请选择 1–100 个文件，合计最多 50 MB");
  const entries: Record<string, Uint8Array> = Object.create(null);
  for (const file of files) {
    const basename = file.name.replace(/[\\/\0]/g, "_") || "file";
    let name = basename,
      index = 2;
    while (Object.hasOwn(entries, name)) name = `${index++}-${basename}`;
    entries[name] = file.bytes;
  }
  return zipSync(entries, { level: 6 });
}
export function encodeFile(bytes: Uint8Array) {
  if (bytes.length > 10 * 1024 * 1024)
    throw new Error("Base64 转换文件最多 10 MB");
  let binary = "";
  for (let i = 0; i < bytes.length; i += 8192)
    binary += String.fromCharCode(...bytes.subarray(i, i + 8192));
  return btoa(binary);
}
export function decodeFile(text: string) {
  let raw = text.trim(),
    mime = "application/octet-stream";
  const data = raw.match(/^data:([^;,]*)(?:;[^,;]*)*;base64,([\s\S]*)$/i);
  if (raw.startsWith("data:") && !data)
    throw new Error("Data URL 必须使用 Base64 编码");
  if (data) {
    mime = data[1] || mime;
    raw = data[2]!;
  }
  raw = raw.replace(/\s/g, "");
  if (
    !raw ||
    raw.length > 14_000_000 ||
    !/^[A-Za-z0-9+/]*={0,2}$/.test(raw) ||
    raw.length % 4 === 1
  )
    throw new Error("Base64 无效或超过 10 MB 文件限制");
  let decoded: string;
  try {
    decoded = atob(raw);
  } catch {
    throw new Error("Base64 编码无效");
  }
  const bytes = Uint8Array.from(decoded, (c) => c.charCodeAt(0));
  if (bytes.length > 10 * 1024 * 1024) throw new Error("解码文件最多 10 MB");
  return { bytes, mime };
}
export function rowsToCsv(rows: unknown[][], protect = true) {
  if (
    rows.length > 10000 ||
    rows.some((row) => row.length > 500) ||
    rows.reduce((n, row) => n + row.length, 0) > 200000
  )
    throw new Error("每张工作表最多 10,000 行、500 列、200,000 个单元格");
  const columns = Math.max(0, ...rows.map((row) => row.length));
  return rows
    .map((row) =>
      Array.from({ length: columns }, (_, i) => {
        const value = row[i];
        let text =
          value == null
            ? ""
            : value instanceof Date
              ? value.toISOString().replace(/T00:00:00\.000Z$/, "")
              : String(value);
        if (protect && typeof value === "string" && /^\s*[=+\-@]/.test(text))
          text = "'" + text;
        return /[",\r\n]/.test(text)
          ? '"' + text.replace(/"/g, '""') + '"'
          : text;
      }).join(","),
    )
    .join("\r\n");
}
export type FileRequest = {
  kind:
    "zip-pack" | "zip-open" | "hash" | "encode" | "decode" | "docx" | "xlsx";
  files?: BinaryFile[];
  text?: string;
  algorithm?: string;
};
export type FileResult = {
  files?: BinaryFile[];
  bytes?: Uint8Array;
  text?: string;
  mime?: string;
  sheets?: { name: string; rows: unknown[][] }[];
};
export async function processFile(request: FileRequest): Promise<FileResult> {
  const files = request.files || [];
  if (request.kind === "decode") return decodeFile(request.text || "");
  if (!files.length) throw new Error("请先选择文件");
  if (request.kind === "zip-pack") return { bytes: packFiles(files) };
  const bytes = files[0]!.bytes;
  if (bytes.length > LIMIT) throw new Error("文件最多 50 MB");
  if (request.kind === "zip-open") return { files: unpackFiles(bytes) };
  if (request.kind === "encode") return { text: encodeFile(bytes) };
  if (request.kind === "hash") {
    if (!["SHA-256", "SHA-384", "SHA-512"].includes(request.algorithm || ""))
      throw new Error("不支持的哈希算法");
    return {
      text: Array.from(
        new Uint8Array(
          await crypto.subtle.digest(
            request.algorithm!,
            bytes.slice().buffer as ArrayBuffer,
          ),
        ),
        (n) => n.toString(16).padStart(2, "0"),
      ).join(""),
    };
  }
  // Validate the ZIP envelope and expanded size before handing Office files to their readers.
  unpackFiles(bytes);
  if (request.kind === "docx") {
    const mammoth = await import("mammoth");
    const result = await mammoth.extractRawText({
      arrayBuffer: bytes.slice().buffer as ArrayBuffer,
    });
    if (result.value.length > 2_000_000)
      throw new Error("提取文字超过 200 万字符");
    return { text: result.value || "文档中没有可提取的正文文字" };
  }
  const { default: read } = await import("read-excel-file/web-worker");
  const sheets = await read<number | string>(
    bytes.slice().buffer as ArrayBuffer,
    {
      parseNumber: (value) => {
        const n = Number(value);
        return Number.isFinite(n) &&
          (!Number.isInteger(n) || Number.isSafeInteger(n))
          ? n
          : value;
      },
    },
  );
  if (sheets.length > 50) throw new Error("最多支持 50 张工作表");
  let cells = 0;
  return {
    sheets: sheets.map((sheet) => {
      cells += sheet.data.reduce((sum, row) => sum + row.length, 0);
      if (
        cells > 200000 ||
        sheet.data.length > 10000 ||
        sheet.data.some((row) => row.length > 500)
      )
        throw new Error(
          "工作簿最多 200,000 个单元格，每表最多 10,000 行、500 列",
        );
      return { name: sheet.sheet, rows: sheet.data };
    }),
  };
}
