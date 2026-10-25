export interface CropRect {
  x: number;
  y: number;
  width: number;
  height: number;
}
export function cropGeometry(
  imageWidth: number,
  imageHeight: number,
  crop: CropRect,
  rotation: number,
) {
  if (
    !Object.values(crop).every(Number.isInteger) ||
    crop.x < 0 ||
    crop.y < 0 ||
    crop.width < 1 ||
    crop.height < 1 ||
    crop.x + crop.width > imageWidth ||
    crop.y + crop.height > imageHeight
  )
    throw new Error("裁剪区域需位于图片内，宽高至少为 1 像素");
  if (![0, 90, 180, 270].includes(rotation)) throw new Error("旋转角度无效");
  return rotation % 180
    ? { width: crop.height, height: crop.width }
    : { width: crop.width, height: crop.height };
}
