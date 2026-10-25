import { onUnmounted, ref, shallowRef } from "vue";
import { canvasBlob } from "./image-layout";
export interface LoadedImage {
  id: number;
  name: string;
  size: number;
  width: number;
  height: number;
  bitmap: ImageBitmap;
  url: string;
}
export function useImages(maxCount = 12, maxEdge = 2048) {
  const images = shallowRef<LoadedImage[]>([]),
    loading = ref(false),
    error = ref("");
  let generation = 0,
    sequence = 0;
  function release(image: LoadedImage) {
    image.bitmap.close();
    URL.revokeObjectURL(image.url);
  }
  async function add(chosen: FileList | File[] | null) {
    if (!chosen?.length || loading.value) return;
    error.value = "";
    const incoming = Array.from(chosen),
      retained = maxCount === 1 ? [] : images.value;
    if (retained.length + incoming.length > maxCount) {
      error.value = "最多选择 " + maxCount + " 张图片";
      return;
    }
    if (
      incoming.some(
        (file) =>
          !["image/jpeg", "image/png", "image/webp"].includes(file.type),
      )
    ) {
      error.value = "请选择 JPG、PNG 或 WebP 图片";
      return;
    }
    if (
      incoming.some((file) => file.size > 20 * 1024 * 1024) ||
      [...retained, ...incoming].reduce((sum, f) => sum + f.size, 0) >
        50 * 1024 * 1024
    ) {
      error.value = "每张最多 20 MB，合计最多 50 MB";
      return;
    }
    const current = ++generation,
      added: LoadedImage[] = [];
    loading.value = true;
    try {
      for (const file of incoming) {
        let bitmap = await createImageBitmap(file);
        let url = "";
        try {
          const width = bitmap.width,
            height = bitmap.height;
          if (width * height > 32_000_000 || Math.max(width, height) > 16384)
            throw new Error(
              "「" +
                file.name +
                "」过大，请控制在 3200 万像素、最长边 16384 以内",
            );
          if (maxEdge && Math.max(width, height) > maxEdge) {
            const reduced = await createImageBitmap(bitmap, {
              resizeWidth: Math.max(
                1,
                Math.round((width * maxEdge) / Math.max(width, height)),
              ),
              resizeHeight: Math.max(
                1,
                Math.round((height * maxEdge) / Math.max(width, height)),
              ),
              resizeQuality: "high",
            });
            bitmap.close();
            bitmap = reduced;
          }
          const thumb = document.createElement("canvas"),
            scale = Math.min(1, 200 / Math.max(width, height));
          thumb.width = Math.max(1, Math.round(width * scale));
          thumb.height = Math.max(1, Math.round(height * scale));
          thumb
            .getContext("2d")!
            .drawImage(bitmap, 0, 0, thumb.width, thumb.height);
          url = URL.createObjectURL(await canvasBlob(thumb));
          if (current !== generation) {
            bitmap.close();
            URL.revokeObjectURL(url);
            break;
          }
          added.push({
            id: ++sequence,
            name: file.name,
            size: file.size,
            width,
            height,
            bitmap,
            url,
          });
        } catch (e) {
          bitmap.close();
          if (url) URL.revokeObjectURL(url);
          throw e;
        }
      }
      if (current !== generation) {
        added.forEach(release);
        return;
      }
      if (maxCount === 1) images.value.forEach(release);
      images.value = [...retained, ...added];
    } catch (e) {
      added.forEach(release);
      if (current === generation)
        error.value = e instanceof Error ? e.message : "图片读取失败";
    } finally {
      if (current === generation) loading.value = false;
    }
  }
  function remove(index: number) {
    const image = images.value[index];
    if (image) release(image);
    images.value = images.value.filter((_, i) => i !== index);
  }
  function move(index: number, direction: number) {
    if (index + direction < 0 || index + direction >= images.value.length)
      return;
    const next = [...images.value];
    [next[index], next[index + direction]] = [
      next[index + direction]!,
      next[index]!,
    ];
    images.value = next;
  }
  onUnmounted(() => {
    generation++;
    images.value.forEach(release);
  });
  return { images, loading, error, add, remove, move };
}
