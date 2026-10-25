export const photoSizes = [
  { id: "one", name: "一寸", mmWidth: 25, mmHeight: 35 },
  { id: "two", name: "二寸", mmWidth: 35, mmHeight: 49 },
];
export function photoDimensions(id: string, width = 295, height = 413) {
  const preset = photoSizes.find((size) => size.id === id);
  const result = preset
    ? {
        width: Math.round((preset.mmWidth / 25.4) * 300),
        height: Math.round((preset.mmHeight / 25.4) * 300),
      }
    : { width, height };
  if (
    !Number.isInteger(result.width) ||
    !Number.isInteger(result.height) ||
    result.width < 100 ||
    result.height < 100 ||
    result.width > 2000 ||
    result.height > 2000
  )
    throw new Error("宽高需为 100–2000 之间的整数像素");
  return result;
}
export function photoPlacement(
  iw: number,
  ih: number,
  width: number,
  height: number,
  zoom: number,
  horizontal: number,
  vertical: number,
) {
  if (
    ![iw, ih, width, height, zoom, horizontal, vertical].every(
      Number.isFinite,
    ) ||
    Math.min(iw, ih, width, height) <= 0 ||
    zoom < 1 ||
    zoom > 3
  )
    throw new Error("照片尺寸或缩放比例无效");
  const scale = Math.max(width / iw, height / ih) * zoom;
  const drawnWidth = iw * scale,
    drawnHeight = ih * scale;
  const limitX = Math.max(0, (drawnWidth - width) / 2),
    limitY = Math.max(0, (drawnHeight - height) / 2);
  return {
    width: drawnWidth,
    height: drawnHeight,
    limitX,
    limitY,
    x: -limitX + Math.max(-1, Math.min(1, horizontal)) * limitX,
    y: -limitY + Math.max(-1, Math.min(1, vertical)) * limitY,
  };
}
export function maskAlpha(confidence: number, edge: number) {
  if (!Number.isFinite(confidence)) return 0;
  const center = 0.3 + Math.max(0, Math.min(100, edge)) * 0.004;
  const t = Math.max(0, Math.min(1, (confidence - (center - 0.12)) / 0.24));
  return Math.round(255 * t * t * (3 - 2 * t));
}
function crc32(bytes: Uint8Array) {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit++)
      crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
  }
  return (crc ^ 0xffffffff) >>> 0;
}
// Canvas exports normally contain 96 DPI; replace density metadata for printing.
export function setPhotoDpi(
  bytes: Uint8Array,
  mime: string,
  dpi = 300,
): Uint8Array {
  if (!Number.isInteger(dpi) || dpi < 1 || dpi > 1200)
    throw new Error("无效的分辨率");
  if (mime === "image/png") {
    if (bytes.length < 33 || bytes[0] !== 137 || bytes[1] !== 80)
      throw new Error("无效的 PNG");
    const chunk = new Uint8Array(21),
      view = new DataView(chunk.buffer);
    view.setUint32(0, 9);
    chunk.set([112, 72, 89, 115], 4);
    view.setUint32(8, Math.round(dpi / 0.0254));
    view.setUint32(12, Math.round(dpi / 0.0254));
    chunk[16] = 1;
    view.setUint32(17, crc32(chunk.subarray(4, 17)));
    const pieces = [bytes.subarray(0, 8)];
    let offset = 8;
    while (offset + 12 <= bytes.length) {
      const length = new DataView(
        bytes.buffer,
        bytes.byteOffset + offset,
        4,
      ).getUint32(0);
      const end = offset + length + 12;
      if (end > bytes.length) throw new Error("PNG 数据不完整");
      const type = String.fromCharCode(
        ...bytes.subarray(offset + 4, offset + 8),
      );
      if (type !== "pHYs") pieces.push(bytes.subarray(offset, end));
      if (type === "IHDR") pieces.push(chunk);
      offset = end;
    }
    const result = new Uint8Array(
      pieces.reduce((n, piece) => n + piece.length, 0),
    );
    let cursor = 0;
    for (const piece of pieces) {
      result.set(piece, cursor);
      cursor += piece.length;
    }
    return result;
  }
  if (mime !== "image/jpeg" || bytes[0] !== 255 || bytes[1] !== 216)
    throw new Error("无效的 JPG");
  const result = bytes.slice();
  let offset = 2;
  while (offset + 4 <= result.length && result[offset] === 255) {
    const marker = result[offset + 1];
    if (marker === 218 || marker === 217) break;
    const length = (result[offset + 2]! << 8) | result[offset + 3]!;
    if (length < 2 || offset + 2 + length > result.length)
      throw new Error("JPG 数据不完整");
    if (
      marker === 224 &&
      length >= 16 &&
      String.fromCharCode(...result.subarray(offset + 4, offset + 9)) ===
        "JFIF\0"
    ) {
      result[offset + 11] = 1;
      new DataView(result.buffer).setUint16(offset + 12, dpi);
      new DataView(result.buffer).setUint16(offset + 14, dpi);
      return result;
    }
    offset += length + 2;
  }
  const jfif = new Uint8Array([
    255,
    224,
    0,
    16,
    74,
    70,
    73,
    70,
    0,
    1,
    1,
    1,
    dpi >> 8,
    dpi & 255,
    dpi >> 8,
    dpi & 255,
    0,
    0,
  ]);
  const inserted = new Uint8Array(bytes.length + jfif.length);
  inserted.set(bytes.subarray(0, 2));
  inserted.set(jfif, 2);
  inserted.set(bytes.subarray(2), 20);
  return inserted;
}
export interface PortraitMask {
  width: number;
  height: number;
  confidence: Float32Array;
}
