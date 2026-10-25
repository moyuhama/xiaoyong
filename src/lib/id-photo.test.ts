import { describe, expect, it } from "vitest";
import {
  photoDimensions,
  photoPlacement,
  maskAlpha,
  setPhotoDpi,
} from "./id-photo";

describe("证件照构图和导出参数", () => {
  it("毫米规格按 300 DPI 换算像素，并校验自定义大小", () => {
    expect(photoDimensions("one")).toEqual({ width: 295, height: 413 });
    expect(photoDimensions("two")).toEqual({ width: 413, height: 579 });
    expect(photoDimensions("custom", 600, 800)).toEqual({
      width: 600,
      height: 800,
    });
    for (const width of [0, 99, 2001, NaN, 300.5])
      expect(() => photoDimensions("custom", width, 400)).toThrow();
  });
  it("裁剪始终保持比例，拖动到两端也不会露出空白", () => {
    expect(photoPlacement(800, 600, 300, 400, 1, 0, 0)).toMatchObject({
      height: 400,
      y: 0,
    });
    for (const [iw, ih] of [
      [800, 600],
      [600, 800],
    ]) {
      for (const x of [-1, 0, 1])
        for (const y of [-1, 0, 1]) {
          const p = photoPlacement(iw!, ih!, 295, 413, 5, x, y);
          expect(p.x).toBeLessThanOrEqual(0);
          expect(p.y).toBeLessThanOrEqual(0);
          expect(p.x + p.width).toBeGreaterThanOrEqual(295 - 1e-8);
          expect(p.y + p.height).toBeGreaterThanOrEqual(413 - 1e-8);
          expect(p.width / p.height).toBeCloseTo(iw! / ih!);
        }
    }
  });
  it("缩小后居中留底，并允许将照片移动到边缘", () => {
    const center = photoPlacement(600, 800, 300, 400, 0.5, 0, 0);
    expect(center).toMatchObject({ width: 150, height: 200, x: 75, y: 100 });
    expect(photoPlacement(600, 800, 300, 400, 0.5, -1, -1)).toMatchObject({
      x: 0,
      y: 0,
    });
    const end = photoPlacement(600, 800, 300, 400, 0.5, 1, 1);
    expect(end.x + end.width).toBe(300);
    expect(end.y + end.height).toBe(400);
    for (const invalid of [0.49, 5.01, NaN])
      expect(() => photoPlacement(600, 800, 300, 400, invalid, 0, 0)).toThrow();
  });
  it("横图缩小时能同时裁去左右并保留上下底色", () => {
    for (const offset of [-1, 0, 1]) {
      const pos = photoPlacement(2000, 500, 300, 400, 0.5, offset, offset);
      expect(pos.x).toBeLessThanOrEqual(0);
      expect(pos.x + pos.width).toBeGreaterThanOrEqual(300);
      expect(pos.y).toBeGreaterThanOrEqual(0);
      expect(pos.y + pos.height).toBeLessThanOrEqual(400);
      expect(pos.width / pos.height).toBe(4);
    }
  });
  it("蒙版保留确定人像、去掉背景，并可收紧边缘", () => {
    expect(maskAlpha(0, 50)).toBe(0);
    expect(maskAlpha(1, 50)).toBe(255);
    expect(maskAlpha(0.5, 50)).toBe(128);
    expect(maskAlpha(NaN, 50)).toBe(0);
    expect(maskAlpha(0.5, 90)).toBeLessThan(maskAlpha(0.5, 10));
  });
  it("PNG 写入 300 DPI，重复设置不会叠加 pHYs 块或改变图像数据", () => {
    const original = new Uint8Array(
      Buffer.from(
        "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
        "base64",
      ),
    );
    const result = setPhotoDpi(original, "image/png");
    expect(result.length).toBe(original.length + 21);
    expect(new DataView(result.buffer).getUint32(41)).toBe(11811);
    expect(new DataView(result.buffer).getUint32(45)).toBe(11811);
    expect(result[49]).toBe(1);
    expect(result.subarray(54)).toEqual(original.subarray(33));
    expect(setPhotoDpi(result, "image/png")).toEqual(result);
  });
  it("JPEG 更新已有 JFIF 的单位和密度，保留像素负载", () => {
    const jpeg = new Uint8Array([
      255, 216, 255, 224, 0, 16, 74, 70, 73, 70, 0, 1, 1, 0, 0, 96, 0, 96, 0, 0,
      255, 218, 0, 2, 1, 2, 3, 255, 217,
    ]);
    const result = setPhotoDpi(jpeg, "image/jpeg");
    expect(result.length).toBe(jpeg.length);
    expect(result[13]).toBe(1);
    expect(new DataView(result.buffer).getUint16(14)).toBe(300);
    expect(new DataView(result.buffer).getUint16(16)).toBe(300);
    expect(result.subarray(20)).toEqual(jpeg.subarray(20));
    expect(jpeg[13]).toBe(0);
  });
  it("JPEG 缺少 JFIF 时补充密度标记", () => {
    const jpeg = new Uint8Array([
      255, 216, 255, 218, 0, 2, 11, 22, 33, 255, 217,
    ]);
    const result = setPhotoDpi(jpeg, "image/jpeg");
    expect(result.length).toBe(jpeg.length + 18);
    expect(new DataView(result.buffer).getUint16(14)).toBe(300);
    expect(result.subarray(20)).toEqual(jpeg.subarray(2));
  });
});
