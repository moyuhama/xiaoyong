import { PDFDocument, StandardFonts, degrees, rgb } from "pdf-lib";
export interface PdfInput {
  name: string;
  bytes: Uint8Array;
}
export interface PdfRequest {
  operation: "inspect" | "merge" | "extract" | "number" | "rotate";
  files: PdfInput[];
  range?: string;
  rotation?: number;
  numbering?: {
    start: number;
    size: number;
    position: "left" | "center" | "right";
  };
}
export interface PdfResult {
  counts: number[];
  bytes?: Uint8Array;
  pages?: number;
}
export function parsePageRange(value: string, pageCount: number) {
  if (!value.trim()) throw new Error("请填写页码，例如 1-3, 5, 8");
  if (value.length > 5000) throw new Error("页码表达式过长");
  const selected: number[] = [],
    seen = new Set<number>();
  for (const part of value.split(/[,，]/)) {
    const match = part.trim().match(/^(\d+)(?:\s*-\s*(\d+))?$/);
    if (!match) throw new Error("页码格式有误，请使用 1-3, 5, 8 这样的格式");
    const start = Number(match[1]),
      end = Number(match[2] || match[1]);
    if (start < 1 || end < start || end > pageCount)
      throw new Error(
        "页码需在 1–" + pageCount + " 之间，范围起点不能大于终点",
      );
    for (let page = start; page <= end; page++) {
      if (!seen.has(page)) {
        selected.push(page - 1);
        seen.add(page);
      }
    }
  }
  return selected;
}
export async function processPdf(request: PdfRequest): Promise<PdfResult> {
  if (!request.files.length || request.files.length > 20)
    throw new Error("请选择 1–20 个 PDF 文件");
  if (
    request.files.reduce((sum, file) => sum + file.bytes.byteLength, 0) >
    50 * 1024 * 1024
  )
    throw new Error("文件总大小请控制在 50 MB 以内");
  if (
    ["extract", "number", "rotate"].includes(request.operation) &&
    request.files.length !== 1
  )
    throw new Error("此工具每次处理一个文件");
  const docs: PDFDocument[] = [];
  for (const file of request.files) {
    let doc: PDFDocument;
    try {
      doc = await PDFDocument.load(file.bytes, { updateMetadata: false });
    } catch {
      throw new Error("「" + file.name + "」无法读取，请确认文件完整且未加密");
    }
    if (doc.getForm().getFields().length)
      throw new Error("「" + file.name + "」含交互表单，请先导出为普通 PDF");
    docs.push(doc);
  }
  const counts = docs.map((doc) => doc.getPageCount());
  if (
    counts.some((count) => count < 1) ||
    counts.reduce((a, b) => a + b, 0) > 500
  )
    throw new Error("请选择至少含 1 页、合计不超过 500 页的 PDF");
  if (request.operation === "inspect") return { counts };
  const output = await PDFDocument.create();
  for (const doc of docs) {
    const indices =
      request.operation === "extract"
        ? parsePageRange(request.range || "", doc.getPageCount())
        : doc.getPageIndices();
    const pages = await output.copyPages(doc, indices);
    for (const page of pages) output.addPage(page);
  }
  if (request.operation === "rotate") {
    if (![90, 180, 270].includes(request.rotation || 0))
      throw new Error("旋转角度需为 90、180 或 270 度");
    for (const index of parsePageRange(
      request.range || "",
      output.getPageCount(),
    )) {
      const page = output.getPage(index);
      page.setRotation(
        degrees(
          (((page.getRotation().angle + request.rotation!) % 360) + 360) % 360,
        ),
      );
    }
  }
  if (request.operation === "number") {
    const settings = request.numbering;
    if (
      !settings ||
      !Number.isInteger(settings.start) ||
      settings.start < 1 ||
      settings.start > 999999 ||
      !Number.isInteger(settings.size) ||
      settings.size < 8 ||
      settings.size > 32 ||
      !["left", "center", "right"].includes(settings.position)
    )
      throw new Error(
        "起始编号需为 1–999999，字号需为 8–32，位置需为左、中或右",
      );
    const indices = parsePageRange(
      request.range || "",
      output.getPageCount(),
    ).sort((a, b) => a - b);
    const font = await output.embedFont(StandardFonts.Helvetica);
    indices.forEach((index, sequence) => {
      const page = output.getPage(index),
        crop = page.getCropBox(),
        media = page.getMediaBox();
      const left = Math.max(crop.x, media.x),
        bottom = Math.max(crop.y, media.y);
      const width = Math.min(crop.x + crop.width, media.x + media.width) - left,
        height =
          Math.min(crop.y + crop.height, media.y + media.height) - bottom;
      const rotation = ((page.getRotation().angle % 360) + 360) % 360;
      if (![0, 90, 180, 270].includes(rotation))
        throw new Error("第 " + (index + 1) + " 页旋转角度不受支持");
      const displayWidth = rotation % 180 ? height : width,
        displayHeight = rotation % 180 ? width : height;
      const text = String(settings.start + sequence),
        textWidth = font.widthOfTextAtSize(text, settings.size),
        margin = 24;
      if (
        displayWidth < margin * 2 + textWidth ||
        displayHeight < margin * 2 + settings.size
      )
        throw new Error("第 " + (index + 1) + " 页尺寸太小，无法放下页码");
      const x =
          settings.position === "left"
            ? margin
            : settings.position === "right"
              ? displayWidth - margin - textWidth
              : (displayWidth - textWidth) / 2,
        y = margin;
      const position =
        rotation === 90
          ? { x: left + width - y, y: bottom + x }
          : rotation === 180
            ? { x: left + width - x, y: bottom + height - y }
            : rotation === 270
              ? { x: left + y, y: bottom + height - x }
              : { x: left + x, y: bottom + y };
      page.drawText(text, {
        ...position,
        size: settings.size,
        font,
        color: rgb(0.2, 0.2, 0.2),
        rotate: degrees(rotation),
      });
    });
  }
  return { counts, pages: output.getPageCount(), bytes: await output.save() };
}
