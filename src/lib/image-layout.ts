export interface Box {
  x: number;
  y: number;
  width: number;
  height: number;
}
export function contain(iw: number, ih: number, box: Box): Box {
  const scale = Math.min(box.width / iw, box.height / ih);
  const width = iw * scale,
    height = ih * scale;
  return {
    x: box.x + (box.width - width) / 2,
    y: box.y + (box.height - height) / 2,
    width,
    height,
  };
}
export function checkCanvas(width: number, height: number) {
  if (
    ![width, height].every(Number.isFinite) ||
    Math.min(width, height) < 1 ||
    Math.max(width, height) > 8192 ||
    width * height > 16_000_000
  )
    throw new Error(
      "输出过大，请减小图片边长或数量（最长边 8192 像素、总计 1600 万像素）",
    );
}
export function stitchLayout(
  images: { width: number; height: number }[],
  mode: string,
  edge: number,
  gap: number,
  columns: number,
) {
  if (
    !images.length ||
    images.length > 12 ||
    images.some(
      (i) => ![i.width, i.height].every((v) => Number.isFinite(v) && v > 0),
    )
  )
    throw new Error("请选择 1–12 张有效图片");
  if (
    !Number.isInteger(edge) ||
    edge < 64 ||
    edge > 2048 ||
    !Number.isInteger(gap) ||
    gap < 0 ||
    gap > 100 ||
    !Number.isInteger(columns) ||
    columns < 1 ||
    columns > 5
  )
    throw new Error("边长需为 64–2048，间距需为 0–100，列数需为 1–5 的整数");
  let width = 0,
    height = 0;
  const boxes: Box[] = [];
  if (mode === "grid") {
    const cols = Math.min(columns, images.length),
      rows = Math.ceil(images.length / cols);
    width = cols * edge + (cols - 1) * gap;
    height = rows * edge + (rows - 1) * gap;
    images.forEach((img, i) =>
      boxes.push(
        contain(img.width, img.height, {
          x: (i % cols) * (edge + gap),
          y: Math.floor(i / cols) * (edge + gap),
          width: edge,
          height: edge,
        }),
      ),
    );
  } else if (mode === "vertical" || mode === "horizontal") {
    for (const img of images) {
      const w =
        mode === "vertical"
          ? edge
          : Math.max(1, Math.round((img.width / img.height) * edge));
      const h =
        mode === "horizontal"
          ? edge
          : Math.max(1, Math.round((img.height / img.width) * edge));
      boxes.push({
        x: mode === "vertical" ? 0 : width,
        y: mode === "horizontal" ? 0 : height,
        width: w,
        height: h,
      });
      if (mode === "vertical") {
        width = w;
        height += h + gap;
      } else {
        width += w + gap;
        height = h;
      }
    }
    if (mode === "vertical") height -= gap;
    else width -= gap;
  } else throw new Error("请选择拼接方向");
  checkCanvas(width, height);
  return { width, height, boxes };
}
export function printLayout(
  paperWidth: number,
  paperHeight: number,
  photoWidth: number,
  photoHeight: number,
  margin: number,
  gap: number,
  copies: number,
) {
  if (
    ![
      paperWidth,
      paperHeight,
      photoWidth,
      photoHeight,
      margin,
      gap,
      copies,
    ].every(Number.isFinite) ||
    Math.min(photoWidth, photoHeight) < 5 ||
    Math.max(photoWidth, photoHeight) > 100 ||
    margin < 0 ||
    margin > 30 ||
    gap < 0 ||
    gap > 20 ||
    !Number.isInteger(copies) ||
    copies < 0 ||
    copies > 100
  )
    throw new Error(
      "照片尺寸需为 5–100 mm，边距 0–30 mm，间距 0–20 mm，份数 0–100",
    );
  const columns = Math.floor(
    (paperWidth - 2 * margin + gap + 1e-8) / (photoWidth + gap),
  );
  const rows = Math.floor(
    (paperHeight - 2 * margin + gap + 1e-8) / (photoHeight + gap),
  );
  if (columns < 1 || rows < 1)
    throw new Error("当前纸张放不下照片，请调整尺寸或边距");
  const capacity = Math.min(columns * rows, 100),
    count = copies || capacity;
  if (count > capacity)
    throw new Error("当前纸张最多排 " + capacity + " 张照片");
  const usedRows = Math.ceil(count / columns),
    usedColumns = Math.min(count, columns);
  const left =
    (paperWidth - usedColumns * photoWidth - (usedColumns - 1) * gap) / 2;
  const top = (paperHeight - usedRows * photoHeight - (usedRows - 1) * gap) / 2;
  return {
    capacity,
    count,
    columns,
    rows,
    boxes: Array.from({ length: count }, (_, i) => ({
      x: left + (i % columns) * (photoWidth + gap),
      y: top + Math.floor(i / columns) * (photoHeight + gap),
      width: photoWidth,
      height: photoHeight,
    })),
  };
}
export function buildIco(entries: { size: number; bytes: Uint8Array }[]) {
  if (
    !entries.length ||
    entries.length > 6 ||
    new Set(entries.map((e) => e.size)).size !== entries.length ||
    entries.some(
      (e) => ![16, 32, 48, 64, 128, 256].includes(e.size) || !e.bytes.length,
    )
  )
    throw new Error("请选择有效且不重复的图标尺寸");
  let offset = 6 + entries.length * 16;
  const result = new Uint8Array(
      offset + entries.reduce((sum, e) => sum + e.bytes.length, 0),
    ),
    view = new DataView(result.buffer);
  view.setUint16(2, 1, true);
  view.setUint16(4, entries.length, true);
  entries.forEach((entry, i) => {
    const start = 6 + i * 16;
    result[start] = result[start + 1] = entry.size === 256 ? 0 : entry.size;
    view.setUint16(start + 4, 1, true);
    view.setUint16(start + 6, 32, true);
    view.setUint32(start + 8, entry.bytes.length, true);
    view.setUint32(start + 12, offset, true);
    result.set(entry.bytes, offset);
    offset += entry.bytes.length;
  });
  return result;
}
export function canvasBlob(canvas: HTMLCanvasElement, mime = "image/png") {
  return new Promise<Blob>((resolve, reject) =>
    canvas.toBlob(
      (blob) =>
        blob
          ? resolve(blob)
          : reject(new Error("图片生成失败，请减小尺寸后重试")),
      mime,
      0.94,
    ),
  );
}
export function newCanvas(width: number, height: number, background?: string) {
  checkCanvas(width, height);
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(width);
  canvas.height = Math.round(height);
  const ctx = canvas.getContext("2d")!;
  ctx.imageSmoothingQuality = "high";
  if (background) {
    ctx.fillStyle = background;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }
  return { canvas, ctx };
}
