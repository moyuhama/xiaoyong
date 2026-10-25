<script setup lang="ts">
import { computed, nextTick, onUnmounted, ref, shallowRef, watch } from "vue";
import Icon from "./Icon.vue";
import { useImages } from "../lib/use-images";
import { buildIco, canvasBlob, contain, newCanvas } from "../lib/image-layout";
import { copy, downloadBlob, formatBytes } from "../lib/ui";
const props = defineProps<{ toolId: string }>();
const color = computed(() => props.toolId === "image-color-picker");
const {
  images,
  loading,
  error: uploadError,
  add,
  remove,
} = useImages(1, color.value ? 0 : 2048);
const picker = ref<HTMLInputElement>(),
  sourceCanvas = ref<HTMLCanvasElement>();
const x = ref(0),
  y = ref(0),
  pixel = ref<number[]>([]),
  error = ref(""),
  busy = ref(false);
const sizes = ref([16, 32, 48, 256]),
  fitMode = ref("contain"),
  transparent = ref(true),
  background = ref("#ffffff");
const output = shallowRef<Blob>(),
  preview = ref("");
let version = 0;
const hex = computed(() =>
  pixel.value.length
    ? "#" +
      pixel.value
        .slice(0, pixel.value[3] === 255 ? 3 : 4)
        .map((n) => n.toString(16).padStart(2, "0"))
        .join("")
        .toUpperCase()
    : "",
);
const rgba = computed(() =>
  pixel.value.length
    ? `rgba(${pixel.value[0]}, ${pixel.value[1]}, ${pixel.value[2]}, ${Number((pixel.value[3]! / 255).toFixed(3))})`
    : "",
);
function clear() {
  version++;
  error.value = "";
  output.value = undefined;
  pixel.value = [];
  if (preview.value) URL.revokeObjectURL(preview.value);
  preview.value = "";
}
watch([images, sizes, fitMode, transparent, background], clear, {
  deep: true,
  flush: "sync",
});
watch(images, async () => {
  if (!color.value) return;
  await nextTick();
  const image = images.value[0],
    canvas = sourceCanvas.value;
  if (!image || !canvas) return;
  canvas.width = image.bitmap.width;
  canvas.height = image.bitmap.height;
  canvas
    .getContext("2d", { willReadFrequently: true })!
    .drawImage(image.bitmap, 0, 0);
  x.value = Math.floor(canvas.width / 2);
  y.value = Math.floor(canvas.height / 2);
  sample();
});
onUnmounted(clear);
async function select(files: FileList | File[] | null) {
  if (busy.value || loading.value) return;
  clear();
  await add(files);
  if (picker.value) picker.value.value = "";
}
function sample() {
  const canvas = sourceCanvas.value;
  if (!canvas) return;
  if (
    !Number.isInteger(x.value) ||
    !Number.isInteger(y.value) ||
    x.value < 0 ||
    y.value < 0 ||
    x.value >= canvas.width ||
    y.value >= canvas.height
  ) {
    error.value = "坐标需为图片范围内的整数，从 0 开始";
    pixel.value = [];
    return;
  }
  error.value = "";
  pixel.value = Array.from(
    canvas
      .getContext("2d", { willReadFrequently: true })!
      .getImageData(x.value, y.value, 1, 1).data,
  );
}
watch([x, y], sample);
function pick(event: MouseEvent) {
  const canvas = sourceCanvas.value!;
  const rect = canvas.getBoundingClientRect();
  x.value = Math.max(
    0,
    Math.min(
      canvas.width - 1,
      Math.floor(((event.clientX - rect.left) / rect.width) * canvas.width),
    ),
  );
  y.value = Math.max(
    0,
    Math.min(
      canvas.height - 1,
      Math.floor(((event.clientY - rect.top) / rect.height) * canvas.height),
    ),
  );
  sample();
}
function keyboard(event: KeyboardEvent) {
  const canvas = sourceCanvas.value!;
  if (!["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(event.key))
    return;
  event.preventDefault();
  x.value = Math.max(
    0,
    Math.min(
      canvas.width - 1,
      x.value +
        (event.key === "ArrowRight" ? 1 : event.key === "ArrowLeft" ? -1 : 0),
    ),
  );
  y.value = Math.max(
    0,
    Math.min(
      canvas.height - 1,
      y.value +
        (event.key === "ArrowDown" ? 1 : event.key === "ArrowUp" ? -1 : 0),
    ),
  );
  sample();
}
async function generate() {
  if (!images.value[0] || busy.value) return;
  clear();
  const current = version;
  busy.value = true;
  try {
    if (!sizes.value.length) throw new Error("请至少选择一个图标尺寸");
    const bitmap = images.value[0].bitmap,
      entries = [];
    let previewBlob: Blob | undefined;
    for (const size of [...sizes.value].sort((a, b) => a - b)) {
      const { canvas, ctx } = newCanvas(
        size,
        size,
        transparent.value ? undefined : background.value,
      );
      const fit =
        fitMode.value === "contain"
          ? contain(bitmap.width, bitmap.height, {
              x: 0,
              y: 0,
              width: size,
              height: size,
            })
          : (() => {
              const scale = Math.max(size / bitmap.width, size / bitmap.height);
              return {
                x: (size - bitmap.width * scale) / 2,
                y: (size - bitmap.height * scale) / 2,
                width: bitmap.width * scale,
                height: bitmap.height * scale,
              };
            })();
      ctx.drawImage(bitmap, fit.x, fit.y, fit.width, fit.height);
      const blob = await canvasBlob(canvas);
      entries.push({ size, bytes: new Uint8Array(await blob.arrayBuffer()) });
      previewBlob = blob;
      if (current !== version) return;
    }
    output.value = new Blob([buildIco(entries).buffer as ArrayBuffer], {
      type: "image/x-icon",
    });
    preview.value = URL.createObjectURL(previewBlob!);
  } catch (e) {
    if (current === version)
      error.value = e instanceof Error ? e.message : "图标生成失败";
  } finally {
    busy.value = false;
  }
}
</script>
<template>
  <div class="tool-workspace">
    <input
      ref="picker"
      class="visually-hidden"
      type="file"
      accept="image/jpeg,image/png,image/webp"
      aria-label="选择图片"
      @change="select(($event.target as HTMLInputElement).files)"
    />
    <div class="tool-toolbar">
      <span class="muted">{{
        images[0]
          ? images[0].name + " · " + images[0].width + " × " + images[0].height
          : "选择一张图片"
      }}</span>
      <div v-if="images.length" class="toolbar-actions">
        <button
          class="text-button"
          :disabled="busy || loading"
          @click="picker?.click()"
        >
          更换图片</button
        ><button
          class="icon-button"
          :disabled="busy || loading"
          aria-label="移除图片"
          @click="remove(0)"
        >
          <Icon name="X" :size="17" />
        </button>
      </div>
    </div>
    <button
      v-if="!images.length"
      class="upload-zone"
      :disabled="loading"
      @click="picker?.click()"
      @dragover.prevent
      @drop.prevent="select($event.dataTransfer?.files || null)"
    >
      <span class="upload-illustration"
        ><Icon
          :name="loading ? 'LoaderCircle' : color ? 'Palette' : 'Image'"
          :class="{ spin: loading }"
          :size="38"
      /></span>
      <h2>
        {{
          loading
            ? "正在读取图片…"
            : color
              ? "上传图片，点击取色"
              : "上传图片，制作 ICO 图标"
        }}
      </h2>
      <p>点击选择，或拖拽图片到这里</p>
      <small>JPG、PNG、WebP · 单张 20 MB、3200 万像素以内</small>
    </button>
    <div v-else-if="color" class="color-pick-layout">
      <div class="color-pick-stage">
        <canvas
          ref="sourceCanvas"
          tabindex="0"
          role="img"
          aria-label="点击图片取色，也可用方向键移动取色坐标"
          @click="pick"
          @keydown="keyboard"
        />
      </div>
      <div class="settings-panel">
        <h2>选中颜色</h2>
        <div
          class="picked-swatch"
          :style="{ background: rgba || 'transparent' }"
        ></div>
        <label class="field-label"
          >HEX（透明时含 Alpha）<input :value="hex" readonly /></label
        ><button
          class="button secondary full-width"
          :disabled="!hex"
          @click="copy(hex)"
        >
          <Icon name="Copy" :size="16" />复制 HEX</button
        ><label class="field-label workshop-space"
          >RGBA<input :value="rgba" readonly /></label
        ><button
          class="button secondary full-width"
          :disabled="!rgba"
          @click="copy(rgba)"
        >
          复制 RGBA
        </button>
        <div class="two-fields workshop-space">
          <label class="field-label"
            >X 坐标<input
              v-model.number="x"
              type="number"
              min="0"
              :max="images[0]!.width - 1"
              @change="sample" /></label
          ><label class="field-label"
            >Y 坐标<input
              v-model.number="y"
              type="number"
              min="0"
              :max="images[0]!.height - 1"
              @change="sample"
          /></label>
        </div>
        <p class="muted">点击图片或输入坐标。坐标从左上角的 0, 0 开始。</p>
      </div>
    </div>
    <div v-else class="batch-layout">
      <div class="settings-panel">
        <fieldset class="workshop-controls" :disabled="busy || loading">
          <h2>图标设置</h2>
          <p class="field-label">包含尺寸（可多选）</p>
          <div class="ico-sizes">
            <label
              v-for="size in [16, 32, 48, 64, 128, 256]"
              :key="size"
              class="check-label"
              ><input v-model="sizes" type="checkbox" :value="size" />{{
                size
              }}
              × {{ size }}</label
            >
          </div>
          <label class="field-label workshop-space"
            >图片适配<select v-model="fitMode">
              <option value="contain">完整显示，空白留边</option>
              <option value="cover">居中裁剪，铺满图标</option>
            </select></label
          ><label class="check-label"
            ><input v-model="transparent" type="checkbox" />透明背景</label
          ><label v-if="!transparent" class="field-label workshop-space"
            >背景颜色<input v-model="background" type="color"
          /></label>
        </fieldset>
        <button
          class="button primary full-width workshop-space"
          :disabled="busy || loading"
          @click="generate"
        >
          <Icon
            :name="busy ? 'LoaderCircle' : 'ImageDown'"
            :class="{ spin: busy }"
            :size="17"
          />{{ busy ? "正在生成…" : "生成 ICO 图标" }}
        </button>
      </div>
      <div class="batch-preview">
        <div v-if="preview" class="batch-result">
          <p class="muted">
            最大尺寸预览 · {{ sizes.length }} 个尺寸打包在一个 ICO 文件中
          </p>
          <div class="ico-preview">
            <img :src="preview" alt="ICO 图标预览" />
          </div>
          <div class="action-row">
            <button
              class="button primary"
              @click="output && downloadBlob(output, 'favicon.ico')"
            >
              <Icon name="Download" :size="17" />下载 ICO</button
            ><span class="muted">{{
              output ? formatBytes(output.size) : ""
            }}</span>
          </div>
        </div>
        <div v-else class="preview-placeholder">
          <img :src="images[0]!.url" alt="原图缩略图" />
          <p>选择尺寸并生成图标</p>
        </div>
      </div>
    </div>
    <p v-if="uploadError || error" class="error-message" role="alert">
      {{ uploadError || error }}
    </p>
    <div class="workspace-footnote">
      <Icon name="Info" :size="15" />{{
        color
          ? "读取浏览器解码后的原图像素，透明度以 Alpha 表示；图片色彩配置可能影响显示结果。动画仅读取第一帧。"
          : "导出含多个 PNG 图层的 ICO 文件，适用于现代浏览器的网站图标；透明背景会保留原图透明度。"
      }}
    </div>
  </div>
</template>
