<script setup lang="ts">
import { computed, onUnmounted, ref, shallowRef, watch } from "vue";
import Icon from "./Icon.vue";
import { useImagePaste } from "../lib/use-image-paste";
import { downloadBlob, formatBytes } from "../lib/ui";
import { cropGeometry, type CropRect } from "../lib/image-edit";
const props = defineProps<{ toolId: string }>();
const isCrop = computed(() => props.toolId === "image-crop"),
  picker = ref<HTMLInputElement>(),
  file = shallowRef<File>();
const originalUrl = ref(""),
  resultUrl = ref(""),
  output = shallowRef<Blob>(),
  outputDimensions = ref({ width: 0, height: 0 });
const dimensions = ref({ width: 0, height: 0 }),
  crop = ref<CropRect>({ x: 0, y: 0, width: 1, height: 1 }),
  preset = ref("free"),
  rotation = ref(0),
  flipX = ref(false),
  flipY = ref(false);
const text = ref("示例水印"),
  fontSize = ref(36),
  color = ref("#ffffff"),
  opacity = ref(45),
  pattern = ref("tile"),
  position = ref("bottom-right"),
  angle = ref(-25),
  format = ref("image/png");
const loading = ref(false),
  busy = ref(false),
  error = ref("");
let bitmap: ImageBitmap | undefined,
  loadVersion = 0,
  renderVersion = 0;
const cropError = computed(() => {
  if (!file.value || !isCrop.value) return "";
  try {
    cropGeometry(
      dimensions.value.width,
      dimensions.value.height,
      crop.value,
      rotation.value,
    );
    return "";
  } catch (err) {
    return err instanceof Error ? err.message : "裁剪范围无效";
  }
});
const selectionStyle = computed(() => ({
  left: (100 * crop.value.x) / dimensions.value.width + "%",
  top: (100 * crop.value.y) / dimensions.value.height + "%",
  width: (100 * crop.value.width) / dimensions.value.width + "%",
  height: (100 * crop.value.height) / dimensions.value.height + "%",
}));
function clearOutput() {
  renderVersion++;
  if (resultUrl.value) URL.revokeObjectURL(resultUrl.value);
  resultUrl.value = "";
  output.value = undefined;
}
function dispose() {
  loadVersion++;
  clearOutput();
  bitmap?.close();
  bitmap = undefined;
  if (originalUrl.value) URL.revokeObjectURL(originalUrl.value);
  originalUrl.value = "";
}
async function load(next?: File) {
  if (!next || busy.value || loading.value) return;
  error.value = "";
  if (!["image/png", "image/jpeg", "image/webp"].includes(next.type)) {
    error.value = "请选择 JPG、PNG 或 WebP 静态图片";
    return;
  }
  if (next.size > 20 * 1024 * 1024) {
    error.value = "单张图片请控制在 20 MB 以内";
    return;
  }
  dispose();
  file.value = undefined;
  loading.value = true;
  const current = loadVersion;
  try {
    const decoded = await createImageBitmap(next, {
      imageOrientation: "from-image",
    });
    if (current !== loadVersion) {
      decoded.close();
      return;
    }
    if (
      decoded.width * decoded.height > 32000000 ||
      decoded.width > 16384 ||
      decoded.height > 16384
    ) {
      decoded.close();
      throw new Error("图片最多 3,200 万像素，每边不超过 16,384 像素");
    }
    bitmap = decoded;
    dimensions.value = { width: decoded.width, height: decoded.height };
    crop.value = { x: 0, y: 0, width: decoded.width, height: decoded.height };
    rotation.value = 0;
    flipX.value = false;
    flipY.value = false;
    preset.value = "free";
    fontSize.value = Math.min(
      200,
      Math.max(16, Math.round(decoded.width / 20)),
    );
    file.value = next;
    originalUrl.value = URL.createObjectURL(next);
  } catch (err) {
    if (current === loadVersion)
      error.value = err instanceof Error ? err.message : "图片无法读取";
  } finally {
    if (current === loadVersion) {
      loading.value = false;
      if (picker.value) picker.value.value = "";
    }
  }
}
function applyPreset() {
  if (preset.value === "free") return;
  const ratio =
    preset.value === "original"
      ? dimensions.value.width / dimensions.value.height
      : Number(preset.value);
  let width = dimensions.value.width,
    height = Math.round(width / ratio);
  if (height > dimensions.value.height) {
    height = dimensions.value.height;
    width = Math.round(height * ratio);
  }
  crop.value = {
    x: Math.floor((dimensions.value.width - width) / 2),
    y: Math.floor((dimensions.value.height - height) / 2),
    width: Math.max(1, width),
    height: Math.max(1, height),
  };
}
let drag:
  | {
      clientX: number;
      clientY: number;
      x: number;
      y: number;
      scaleX: number;
      scaleY: number;
    }
  | undefined;
function startDrag(event: PointerEvent) {
  if (busy.value || cropError.value) return;
  const target = event.currentTarget as HTMLElement,
    rect = target.parentElement!.getBoundingClientRect();
  target.setPointerCapture(event.pointerId);
  drag = {
    clientX: event.clientX,
    clientY: event.clientY,
    x: crop.value.x,
    y: crop.value.y,
    scaleX: dimensions.value.width / rect.width,
    scaleY: dimensions.value.height / rect.height,
  };
}
function moveDrag(event: PointerEvent) {
  if (!drag) return;
  crop.value.x = Math.max(
    0,
    Math.min(
      dimensions.value.width - crop.value.width,
      Math.round(drag.x + (event.clientX - drag.clientX) * drag.scaleX),
    ),
  );
  crop.value.y = Math.max(
    0,
    Math.min(
      dimensions.value.height - crop.value.height,
      Math.round(drag.y + (event.clientY - drag.clientY) * drag.scaleY),
    ),
  );
}
function changeCrop(key: keyof CropRect, value: string) {
  preset.value = "free";
  crop.value = { ...crop.value, [key]: Number(value) };
}
function watermark(ctx: CanvasRenderingContext2D, w: number, h: number) {
  if (!text.value.trim()) throw new Error("请先输入水印文字");
  if (text.value.length > 80) throw new Error("水印文字最多 80 个字符");
  if (
    !Number.isFinite(fontSize.value) ||
    fontSize.value < 12 ||
    fontSize.value > 400
  )
    throw new Error("字号需在 12–400 像素之间");
  const effectiveSize =
    pattern.value === "single"
      ? Math.min(fontSize.value, h * 0.8)
      : fontSize.value;
  ctx.font = "600 " + effectiveSize + "px system-ui, sans-serif";
  ctx.fillStyle = color.value;
  ctx.globalAlpha = opacity.value / 100;
  ctx.textBaseline = "middle";
  ctx.textAlign = "center";
  if (pattern.value === "tile") {
    const diagonal = Math.hypot(w, h),
      gap = Math.max(fontSize.value * 4, Math.sqrt((w * h) / 400));
    const stepX = Math.max(
      ctx.measureText(text.value).width + fontSize.value * 2,
      gap,
    );
    ctx.translate(w / 2, h / 2);
    ctx.rotate((angle.value * Math.PI) / 180);
    for (let y = -diagonal; y <= diagonal; y += gap)
      for (let x = -diagonal; x <= diagonal; x += stepX)
        ctx.fillText(text.value, x, y);
  } else {
    const margin = Math.min(
        Math.max(12, Math.min(w, h) * 0.04),
        Math.min(w, h) * 0.1,
      ),
      maxWidth = Math.max(1, w - 2 * margin),
      textWidth = Math.min(ctx.measureText(text.value).width, maxWidth);
    const x = position.value.includes("left")
      ? margin + textWidth / 2
      : position.value.includes("right")
        ? w - margin - textWidth / 2
        : w / 2;
    const y = position.value.includes("top")
      ? margin + effectiveSize / 2
      : position.value.includes("bottom")
        ? h - margin - effectiveSize / 2
        : h / 2;
    ctx.fillText(
      text.value,
      x,
      Math.max(effectiveSize / 2, Math.min(h - effectiveSize / 2, y)),
      maxWidth,
    );
  }
}
async function generate() {
  if (!bitmap || !file.value || busy.value) return;
  error.value = "";
  clearOutput();
  const current = renderVersion;
  busy.value = true;
  const canvas = document.createElement("canvas");
  try {
    const size = isCrop.value
      ? cropGeometry(
          dimensions.value.width,
          dimensions.value.height,
          crop.value,
          rotation.value,
        )
      : dimensions.value;
    canvas.width = size.width;
    canvas.height = size.height;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("无法创建图片画布");
    if (format.value === "image/jpeg") {
      ctx.fillStyle = "#fff";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }
    if (isCrop.value) {
      ctx.translate(size.width / 2, size.height / 2);
      ctx.rotate((rotation.value * Math.PI) / 180);
      ctx.scale(flipX.value ? -1 : 1, flipY.value ? -1 : 1);
      ctx.drawImage(
        bitmap,
        crop.value.x,
        crop.value.y,
        crop.value.width,
        crop.value.height,
        -crop.value.width / 2,
        -crop.value.height / 2,
        crop.value.width,
        crop.value.height,
      );
    } else {
      ctx.drawImage(bitmap, 0, 0);
      watermark(ctx, size.width, size.height);
    }
    const blob = await new Promise<Blob>((resolve, reject) =>
      canvas.toBlob(
        (value) => (value ? resolve(value) : reject(new Error("图片生成失败"))),
        format.value,
        0.92,
      ),
    );
    if (current !== renderVersion) return;
    output.value = blob;
    outputDimensions.value = size;
    resultUrl.value = URL.createObjectURL(blob);
  } catch (err) {
    if (current === renderVersion)
      error.value = err instanceof Error ? err.message : "图片处理失败";
  } finally {
    canvas.width = 0;
    canvas.height = 0;
    busy.value = false;
  }
}
function download() {
  if (!output.value || !file.value) return;
  const ext =
    output.value.type === "image/jpeg"
      ? "jpg"
      : output.value.type === "image/webp"
        ? "webp"
        : "png";
  downloadBlob(
    output.value,
    file.value.name.replace(/\.[^.]+$/, "") +
      (isCrop.value ? "-crop." : "-watermark.") +
      ext,
  );
}
watch(
  [
    crop,
    rotation,
    flipX,
    flipY,
    text,
    fontSize,
    color,
    opacity,
    pattern,
    position,
    angle,
    format,
  ],
  clearOutput,
  { deep: true },
);
onUnmounted(dispose);
useImagePaste(load, () => !busy.value && !loading.value);
</script>
<template>
  <div class="tool-workspace">
    <input
      ref="picker"
      type="file"
      accept="image/png,image/jpeg,image/webp"
      class="visually-hidden"
      aria-label="选择图片文件"
      @change="load(($event.target as HTMLInputElement).files?.[0])"
    />
    <button
      v-if="!file"
      class="upload-zone"
      :disabled="loading"
      @click="picker?.click()"
      @dragover.prevent
      @drop.prevent="load($event.dataTransfer?.files[0])"
    >
      <span class="upload-illustration"
        ><Icon
          :name="loading ? 'LoaderCircle' : 'Image'"
          :size="38"
          :class="{ spin: loading }"
      /></span>
      <h2>{{ loading ? "正在读取图片…" : "选择要处理的图片" }}</h2>
      <p>点击选择，或拖拽图片到这里</p>
      <small>JPG、PNG、WebP 静态图片 · 单张最大 20 MB</small>
    </button>
    <template v-else>
      <div class="tool-toolbar">
        <div class="file-summary">
          <Icon name="FileImage" :size="20" /><strong>{{ file.name }}</strong
          ><span>{{ dimensions.width }} × {{ dimensions.height }}</span>
        </div>
        <button class="text-button" :disabled="busy" @click="picker?.click()">
          更换图片
        </button>
      </div>
      <div class="picture-controls">
        <template v-if="isCrop">
          <label class="field-label"
            >裁剪预设<select
              v-model="preset"
              :disabled="busy"
              aria-label="裁剪预设"
              @change="applyPreset"
            >
              <option value="free">自定义</option>
              <option value="original">原图比例</option>
              <option value="1">正方形 1:1</option>
              <option :value="String(4 / 3)">4:3</option>
              <option :value="String(16 / 9)">16:9</option>
              <option :value="String(9 / 16)">9:16</option>
            </select></label
          >
          <label
            v-for="field in [
              { key: 'x', name: '左侧 X' },
              { key: 'y', name: '顶部 Y' },
              { key: 'width', name: '裁剪宽度' },
              { key: 'height', name: '裁剪高度' },
            ] as const"
            :key="field.key"
            class="field-label"
            >{{ field.name }}（px）<input
              :value="crop[field.key]"
              type="number"
              :min="field.key === 'x' || field.key === 'y' ? 0 : 1"
              :disabled="busy"
              @input="
                changeCrop(field.key, ($event.target as HTMLInputElement).value)
              "
          /></label>
          <label class="field-label"
            >旋转<select
              v-model.number="rotation"
              aria-label="旋转角度"
              :disabled="busy"
            >
              <option :value="0">不旋转</option>
              <option :value="90">顺时针 90°</option>
              <option :value="180">180°</option>
              <option :value="270">逆时针 90°</option>
            </select></label
          >
          <div class="flip-options">
            <label class="check-label"
              ><input
                v-model="flipX"
                type="checkbox"
                :disabled="busy"
              />左右镜像</label
            ><label class="check-label"
              ><input
                v-model="flipY"
                type="checkbox"
                :disabled="busy"
              />上下镜像</label
            >
          </div>
        </template>
        <template v-else>
          <label class="field-label watermark-text"
            >水印文字<input v-model="text" maxlength="80" :disabled="busy"
          /></label>
          <label class="field-label"
            >布局<select
              v-model="pattern"
              :disabled="busy"
              aria-label="水印布局"
            >
              <option value="tile">平铺</option>
              <option value="single">单处水印</option>
            </select></label
          >
          <label class="field-label"
            >字号（px）<input
              v-model.number="fontSize"
              type="number"
              min="12"
              max="400"
              :disabled="busy"
          /></label>
          <label class="field-label"
            >颜色<input v-model="color" type="color" :disabled="busy"
          /></label>
          <label class="field-label"
            >透明度 {{ opacity }}%<input
              v-model.number="opacity"
              type="range"
              min="10"
              max="100"
              :disabled="busy"
          /></label>
          <label v-if="pattern === 'tile'" class="field-label"
            >倾斜 {{ angle }}°<input
              v-model.number="angle"
              type="range"
              min="-45"
              max="45"
              :disabled="busy"
          /></label>
          <label v-else class="field-label"
            >水印位置<select
              v-model="position"
              :disabled="busy"
              aria-label="水印位置"
            >
              <option value="bottom-right">右下</option>
              <option value="bottom-left">左下</option>
              <option value="center">居中</option>
              <option value="top-left">左上</option>
              <option value="top-right">右上</option>
            </select></label
          >
        </template>
        <label class="field-label"
          >输出格式<select
            v-model="format"
            :disabled="busy"
            aria-label="输出格式"
          >
            <option value="image/png">PNG</option>
            <option value="image/jpeg">JPG</option>
            <option value="image/webp">WebP</option>
          </select></label
        >
      </div>
      <div class="action-row">
        <button
          class="button primary"
          :disabled="busy || !!cropError"
          @click="generate"
        >
          {{ busy ? "正在生成…" : "生成图片"
          }}<Icon name="ArrowRight" :size="16" /></button
        ><button class="button secondary" :disabled="!output" @click="download">
          <Icon name="Download" :size="16" />下载图片
        </button>
      </div>
      <div class="picture-previews">
        <section>
          <h2>{{ isCrop ? "原图与裁剪区域" : "原图" }}</h2>
          <div
            v-if="isCrop"
            class="crop-stage"
            :style="{
              aspectRatio: dimensions.width + '/' + dimensions.height,
              maxWidth:
                Math.min(700, (420 * dimensions.width) / dimensions.height) +
                'px',
            }"
          >
            <img :src="originalUrl" alt="待裁剪图片" draggable="false" />
            <div
              v-if="!cropError"
              class="crop-selection"
              :style="selectionStyle"
              @pointerdown="startDrag"
              @pointermove="moveDrag"
              @pointerup="drag = undefined"
              @pointercancel="drag = undefined"
              @lostpointercapture="drag = undefined"
            >
              <span>拖动选区</span>
            </div>
          </div>
          <img
            v-else
            class="picture-preview-image"
            :src="originalUrl"
            alt="原图"
          />
        </section>
        <section>
          <h2>
            输出预览<span v-if="output" class="muted"
              >{{ outputDimensions.width }} × {{ outputDimensions.height }} ·
              {{ formatBytes(output.size) }}</span
            >
          </h2>
          <img
            v-if="resultUrl"
            class="picture-preview-image"
            :src="resultUrl"
            alt="处理后的图片"
          />
          <div v-else class="picture-placeholder">
            <Icon :name="isCrop ? 'Crop' : 'Stamp'" :size="42" />
            <p>点击“生成图片”查看结果</p>
          </div>
        </section>
      </div>
    </template>
    <p v-if="error || cropError" role="alert" class="error-message">
      {{ error || cropError }}
    </p>
    <div class="workspace-footnote">
      <Icon name="Info" :size="15" />输出为静态图片，不保留 EXIF；JPG
      的透明区域会填充为白色。
    </div>
  </div>
</template>
