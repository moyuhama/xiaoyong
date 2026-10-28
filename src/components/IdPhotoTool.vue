<script setup lang="ts">
import { computed, nextTick, onUnmounted, ref, shallowRef, watch } from "vue";
import Icon from "./Icon.vue";
import { downloadBlob, formatBytes } from "../lib/ui";
import { useWorkerTask } from "../lib/worker-task";
import {
  maskAlpha,
  photoDimensions,
  photoPlacement,
  photoSizeGroups,
  photoSizes,
  photoZoom,
  setPhotoDpi,
  type PortraitMask,
} from "../lib/id-photo";

const picker = ref<HTMLInputElement>(),
  preview = ref<HTMLCanvasElement>();
const file = shallowRef<File>(),
  originalSize = ref({ width: 0, height: 0 });
const sourceSize = ref({ width: 0, height: 0 });
const sizeId = ref("one"),
  customWidth = ref(295),
  customHeight = ref(413);
const background = ref("original"),
  customColor = ref("#438edb"),
  edge = ref(50);
const zoom = ref(100),
  horizontal = ref(0),
  vertical = ref(0),
  rotation = ref(0),
  brightness = ref(100);
const format = ref("image/jpeg"),
  quality = ref(92),
  guides = ref(true);
const loading = ref(false),
  preparing = ref(false),
  exporting = ref(false),
  error = ref(""),
  lastExport = ref("");
const mask = shallowRef<PortraitMask>();
const {
  run,
  cancel,
  error: workerError,
} = useWorkerTask<{ image: ImageBitmap; assetRoot: string }, PortraitMask>(
  () =>
    new Worker(new URL("../workers/portrait.ts", import.meta.url), {
      type: "module",
    }),
  60000,
);
let original: ImageBitmap | undefined,
  source: HTMLCanvasElement | undefined,
  cutout: HTMLCanvasElement | undefined,
  version = 0;
const busy = computed(
  () => loading.value || preparing.value || exporting.value,
);
const selectedSize = computed(() =>
  photoSizes.find((size) => size.id === sizeId.value),
);
const dimensions = computed(() => {
  try {
    return {
      value: photoDimensions(
        sizeId.value,
        customWidth.value,
        customHeight.value,
      ),
      error: "",
    };
  } catch (err) {
    return {
      value: null,
      error: err instanceof Error ? err.message : "请检查尺寸",
    };
  }
});
const placement = computed(() => {
  const size = dimensions.value.value;
  return sourceSize.value.width && size
    ? photoPlacement(
        sourceSize.value.width,
        sourceSize.value.height,
        size.width,
        size.height,
        zoom.value / 100,
        horizontal.value / 100,
        vertical.value / 100,
      )
    : null;
});
const frameStyle = computed(() => {
  const size = dimensions.value.value;
  return size
    ? {
        width: Math.min(340, (460 * size.width) / size.height) + "px",
        aspectRatio: size.width + "/" + size.height,
      }
    : {};
});
const outputReady = computed(
  () =>
    !!source &&
    !!dimensions.value.value &&
    !busy.value &&
    (background.value === "original" || !!mask.value),
);
const colors = [
  { id: "original", name: "原背景", color: "" },
  { id: "#ffffff", name: "白底", color: "#ffffff" },
  { id: "#438edb", name: "蓝底", color: "#438edb" },
  { id: "#d84243", name: "红底", color: "#d84243" },
];

function clearCanvas(canvas?: HTMLCanvasElement) {
  if (canvas) {
    canvas.width = 0;
    canvas.height = 0;
  }
}
function resetPosition() {
  zoom.value = 100;
  horizontal.value = 0;
  vertical.value = 0;
}
function setZoom(value: number) {
  if (busy.value || !Number.isFinite(value)) return;
  zoom.value = Math.max(
    photoZoom.min,
    Math.min(photoZoom.max, Math.round(value)),
  );
  drag = undefined;
}
function zoomWheel(event: WheelEvent) {
  if (busy.value || !event.deltaY) return;
  event.preventDefault();
  const pixels =
    event.deltaY *
    (event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? 300 : 1);
  setZoom(
    zoom.value * Math.exp(-Math.max(-100, Math.min(100, pixels)) * 0.002),
  );
}
function makeSource() {
  if (!original) return;
  clearCanvas(source);
  clearCanvas(cutout);
  cutout = undefined;
  mask.value = undefined;
  source = document.createElement("canvas");
  source.width = rotation.value % 180 ? original.height : original.width;
  source.height = rotation.value % 180 ? original.width : original.height;
  const ctx = source.getContext("2d");
  if (!ctx) throw new Error("无法创建图片画布");
  ctx.translate(source.width / 2, source.height / 2);
  ctx.rotate((rotation.value * Math.PI) / 180);
  ctx.drawImage(original, -original.width / 2, -original.height / 2);
  sourceSize.value = { width: source.width, height: source.height };
  resetPosition();
}
async function load(next?: File) {
  if (!next || busy.value) return;
  if (picker.value) picker.value.value = "";
  error.value = "";
  lastExport.value = "";
  if (!["image/jpeg", "image/png", "image/webp"].includes(next.type)) {
    error.value = "请选择 JPG、PNG 或 WebP 静态照片";
    return;
  }
  if (next.size > 20 * 1024 * 1024) {
    error.value = "照片请控制在 20 MB 以内";
    return;
  }
  cancel();
  const current = ++version;
  loading.value = true;
  let decoded: ImageBitmap | undefined;
  try {
    decoded = await createImageBitmap(next, { imageOrientation: "from-image" });
    if (current !== version) return;
    if (
      decoded.width * decoded.height > 32000000 ||
      Math.max(decoded.width, decoded.height) > 16384
    )
      throw new Error("照片最多 3,200 万像素，每边不超过 16,384 像素");
    const width = decoded.width,
      height = decoded.height;
    const scale = Math.min(1, 2048 / Math.max(width, height));
    const resized = await createImageBitmap(decoded, {
      resizeWidth: Math.max(1, Math.round(width * scale)),
      resizeHeight: Math.max(1, Math.round(height * scale)),
      resizeQuality: "high",
    });
    if (current !== version) {
      resized.close();
      return;
    }
    original?.close();
    original = resized;
    file.value = next;
    originalSize.value = { width, height };
    rotation.value = 0;
    brightness.value = 100;
    makeSource();
    await nextTick();
    renderPreview();
  } catch (err) {
    if (current === version)
      error.value = err instanceof Error ? err.message : "照片无法读取";
  } finally {
    decoded?.close();
    if (current === version) loading.value = false;
  }
  if (current === version && original && background.value !== "original")
    await preparePortrait();
}
async function preparePortrait() {
  if (!source || mask.value || preparing.value) return;
  preparing.value = true;
  error.value = "";
  const current = version;
  let image: ImageBitmap | undefined;
  try {
    const scale = Math.min(1, 1024 / Math.max(source.width, source.height));
    image = await createImageBitmap(source, {
      resizeWidth: Math.round(source.width * scale),
      resizeHeight: Math.round(source.height * scale),
      resizeQuality: "high",
    });
    if (current !== version) return;
    const result = await run({
      image,
      assetRoot: new URL(import.meta.env.BASE_URL, location.origin).href,
    });
    if (current !== version) return;
    if (!result) throw new Error(workerError.value || "人像处理未完成，请重试");
    mask.value = result;
    rebuildCutout();
  } catch (err) {
    if (current === version) {
      background.value = "original";
      error.value =
        (err instanceof Error ? err.message : "换底失败") + "；已保留原背景。";
    }
  } finally {
    image?.close();
    if (current === version) {
      preparing.value = false;
      renderPreview();
    }
  }
}
async function chooseBackground(value: string) {
  if (busy.value) return;
  background.value = value;
  lastExport.value = "";
  if (value !== "original") await preparePortrait();
  renderPreview();
}
function cancelBackground() {
  version++;
  cancel();
  preparing.value = false;
  background.value = "original";
  renderPreview();
}
function rebuildCutout() {
  if (!source || !mask.value) return;
  const { width, height, confidence } = mask.value;
  const matte = document.createElement("canvas");
  matte.width = width;
  matte.height = height;
  const matteContext = matte.getContext("2d")!;
  const pixels = matteContext.createImageData(width, height);
  for (let i = 0; i < confidence.length; i++) {
    pixels.data[i * 4] = 255;
    pixels.data[i * 4 + 1] = 255;
    pixels.data[i * 4 + 2] = 255;
    pixels.data[i * 4 + 3] = maskAlpha(confidence[i]!, edge.value);
  }
  matteContext.putImageData(pixels, 0, 0);
  clearCanvas(cutout);
  cutout = document.createElement("canvas");
  cutout.width = source.width;
  cutout.height = source.height;
  const ctx = cutout.getContext("2d")!;
  ctx.drawImage(source, 0, 0);
  ctx.globalCompositeOperation = "destination-in";
  ctx.drawImage(matte, 0, 0, cutout.width, cutout.height);
  clearCanvas(matte);
  renderPreview();
}
function renderPreview() {
  const size = dimensions.value.value,
    pos = placement.value,
    canvas = preview.value;
  if (!canvas || !size || !pos || !source) return;
  canvas.width = size.width;
  canvas.height = size.height;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle =
    background.value === "original"
      ? "#ffffff"
      : background.value === "custom"
        ? customColor.value
        : background.value;
  ctx.fillRect(0, 0, size.width, size.height);
  ctx.imageSmoothingQuality = "high";
  ctx.filter = "brightness(" + brightness.value + "%)";
  ctx.drawImage(
    background.value !== "original" && cutout ? cutout : source,
    pos.x,
    pos.y,
    pos.width,
    pos.height,
  );
  ctx.filter = "none";
}
async function rotate() {
  if (busy.value) return;
  rotation.value = (rotation.value + 90) % 360;
  lastExport.value = "";
  makeSource();
  await nextTick();
  renderPreview();
  if (background.value !== "original") await preparePortrait();
}
let drag:
  | {
      x: number;
      y: number;
      h: number;
      v: number;
      width: number;
      height: number;
    }
  | undefined;
function startDrag(event: PointerEvent) {
  if (busy.value || !preview.value) return;
  const rect = preview.value.getBoundingClientRect();
  preview.value.setPointerCapture(event.pointerId);
  drag = {
    x: event.clientX,
    y: event.clientY,
    h: horizontal.value,
    v: vertical.value,
    width: rect.width,
    height: rect.height,
  };
}
function moveDrag(event: PointerEvent) {
  const pos = placement.value,
    size = dimensions.value.value;
  if (!drag || !pos || !size) return;
  if (pos.limitX)
    horizontal.value = Math.round(
      Math.max(
        -100,
        Math.min(
          100,
          drag.h +
            ((((event.clientX - drag.x) / drag.width) * size.width) /
              pos.limitX) *
              100,
        ),
      ),
    );
  if (pos.limitY)
    vertical.value = Math.round(
      Math.max(
        -100,
        Math.min(
          100,
          drag.v +
            ((((event.clientY - drag.y) / drag.height) * size.height) /
              pos.limitY) *
              100,
        ),
      ),
    );
}
function moveKey(event: KeyboardEvent) {
  if (busy.value) return;
  if (["+", "=", "-", "0"].includes(event.key)) {
    event.preventDefault();
    if (event.key === "0") resetPosition();
    else
      setZoom(
        zoom.value + (event.key === "-" ? -photoZoom.step : photoZoom.step),
      );
    return;
  }
  if (!event.key.startsWith("Arrow")) return;
  event.preventDefault();
  if (event.key === "ArrowLeft")
    horizontal.value = Math.max(-100, horizontal.value - 2);
  if (event.key === "ArrowRight")
    horizontal.value = Math.min(100, horizontal.value + 2);
  if (event.key === "ArrowUp")
    vertical.value = Math.max(-100, vertical.value - 2);
  if (event.key === "ArrowDown")
    vertical.value = Math.min(100, vertical.value + 2);
}
async function download() {
  if (!outputReady.value || !preview.value || !file.value) return;
  exporting.value = true;
  error.value = "";
  const current = version;
  try {
    renderPreview();
    const blob = await new Promise<Blob>((resolve, reject) =>
      preview.value!.toBlob(
        (blob) => (blob ? resolve(blob) : reject(new Error("照片导出失败"))),
        format.value,
        quality.value / 100,
      ),
    );
    const bytes = setPhotoDpi(
      new Uint8Array(await blob.arrayBuffer()),
      format.value,
    );
    if (current !== version) return;
    const output = new Blob([bytes.slice().buffer as ArrayBuffer], {
      type: format.value,
    });
    const size = dimensions.value.value!;
    downloadBlob(
      output,
      file.value.name.replace(/\.[^.]+$/, "") +
        "-证件照-" +
        size.width +
        "x" +
        size.height +
        (format.value === "image/jpeg" ? ".jpg" : ".png"),
    );
    lastExport.value =
      formatBytes(output.size) +
      " · " +
      size.width +
      " × " +
      size.height +
      " px · 300 DPI";
  } catch (err) {
    if (current === version)
      error.value = err instanceof Error ? err.message : "照片导出失败，请重试";
  } finally {
    if (current === version) exporting.value = false;
  }
}
watch(edge, () => {
  lastExport.value = "";
  rebuildCutout();
});
watch([sizeId, customWidth, customHeight], resetPosition);
watch(
  [
    dimensions,
    zoom,
    horizontal,
    vertical,
    brightness,
    background,
    customColor,
    format,
    quality,
  ],
  () => {
    lastExport.value = "";
    renderPreview();
  },
  { flush: "post" },
);
onUnmounted(() => {
  version++;
  original?.close();
  clearCanvas(source);
  clearCanvas(cutout);
});
</script>
<template>
  <div class="tool-workspace id-photo-workspace">
    <input
      ref="picker"
      class="visually-hidden"
      type="file"
      accept="image/jpeg,image/png,image/webp"
      aria-label="选择人像照片"
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
          :name="loading ? 'LoaderCircle' : 'ContactRound'"
          :size="38"
          :class="{ spin: loading }"
      /></span>
      <h2>{{ loading ? "正在读取照片…" : "选择正面人像照片" }}</h2>
      <p>选择单人、正面、光线均匀的照片，拖入或点击上传</p>
      <small>JPG、PNG、WebP · 单张最大 20 MB</small>
    </button>
    <template v-else>
      <div class="tool-toolbar">
        <div class="file-summary">
          <Icon name="FileImage" :size="20" /><strong>{{ file.name }}</strong
          ><span>{{ originalSize.width }} × {{ originalSize.height }}</span>
        </div>
        <button class="text-button" :disabled="busy" @click="picker?.click()">
          更换照片
        </button>
      </div>
      <div class="id-photo-layout">
        <div class="id-photo-controls">
          <fieldset :disabled="busy">
            <legend>照片规格</legend>
            <div class="mode-buttons id-size-shortcuts">
              <button
                v-for="size in photoSizes.filter((s) => s.group === '通用寸照')"
                :key="size.id"
                :class="{ active: sizeId === size.id }"
                @click="sizeId = size.id"
              >
                {{ size.name }}
              </button>
            </div>
            <label class="field-label"
              >输出尺寸<select v-model="sizeId" aria-label="证件照尺寸">
                <optgroup
                  v-for="group in photoSizeGroups"
                  :key="group"
                  :label="group"
                >
                  <option
                    v-for="size in photoSizes.filter(
                      (size) => size.group === group,
                    )"
                    :key="size.id"
                    :value="size.id"
                  >
                    {{ size.mmWidth }} × {{ size.mmHeight }} mm{{
                      size.name ? " · " + size.name : ""
                    }}
                  </option>
                </optgroup>
                <option value="custom">自定义像素</option>
              </select></label
            >
            <div v-if="sizeId === 'custom'" class="two-fields">
              <label class="field-label"
                >宽度（px）<input
                  v-model.number="customWidth"
                  type="number"
                  min="100"
                  max="2000" /></label
              ><label class="field-label"
                >高度（px）<input
                  v-model.number="customHeight"
                  type="number"
                  min="100"
                  max="2000"
              /></label>
            </div>
            <p class="id-spec-note" v-if="dimensions.value">
              {{ dimensions.value.width }} × {{ dimensions.value.height }} px ·
              300 DPI
            </p>
            <p class="id-spec-note">
              共 {{ photoSizes.length }} 种规格，尺寸均为宽 ×
              高；名称有差异时请以毫米尺寸为准。
            </p>
          </fieldset>
          <fieldset :disabled="busy">
            <legend>背景颜色</legend>
            <div class="id-color-options">
              <button
                v-for="color in colors"
                :key="color.id"
                class="id-color-button"
                :class="{ active: background === color.id }"
                :aria-pressed="background === color.id"
                @click="chooseBackground(color.id)"
              >
                <span
                  :style="{ background: color.color }"
                  :class="{ 'id-original-swatch': !color.color }"
                />{{ color.name }}</button
              ><button
                class="id-color-button"
                :class="{ active: background === 'custom' }"
                :aria-pressed="background === 'custom'"
                @click="chooseBackground('custom')"
              >
                <span :style="{ background: customColor }" />自定义
              </button>
            </div>
            <label v-if="background === 'custom'" class="field-label"
              >自定义底色<input v-model="customColor" type="color"
            /></label>
            <template v-if="mask && background !== 'original'"
              ><label class="field-label"
                >边缘收紧 {{ edge
                }}<input
                  v-model.number="edge"
                  type="range"
                  min="0"
                  max="100"
                  aria-label="边缘收紧"
              /></label>
              <p class="id-spec-note">增大数值可减少边缘背景残留</p></template
            >
          </fieldset>
          <fieldset :disabled="busy">
            <legend>
              调整构图
              <button
                class="text-button"
                :disabled="busy"
                @click="resetPosition"
              >
                居中重置
              </button>
            </legend>
            <label class="field-label"
              >缩放 {{ zoom }}%<input
                v-model.number="zoom"
                type="range"
                :min="photoZoom.min"
                :max="photoZoom.max"
                aria-label="照片缩放"
            /></label>
            <label class="field-label"
              >左右位置<input
                v-model.number="horizontal"
                type="range"
                min="-100"
                max="100"
                aria-label="左右位置"
                :disabled="!placement?.limitX"
            /></label>
            <label class="field-label"
              >上下位置<input
                v-model.number="vertical"
                type="range"
                min="-100"
                max="100"
                aria-label="上下位置"
                :disabled="!placement?.limitY"
            /></label>
            <label class="field-label"
              >亮度 {{ brightness }}%<input
                v-model.number="brightness"
                type="range"
                min="80"
                max="120"
                aria-label="照片亮度"
            /></label>
            <div class="id-compose-actions">
              <button class="button secondary" @click="rotate">
                <Icon name="RotateCw" :size="15" />旋转 90°</button
              ><label class="check-label"
                ><input v-model="guides" type="checkbox" />构图辅助线</label
              >
            </div>
          </fieldset>
        </div>
        <section class="id-photo-result">
          <div class="id-preview-heading">
            <h2>成品预览</h2>
            <span v-if="selectedSize"
              >{{ selectedSize.mmWidth }} × {{ selectedSize.mmHeight }} mm</span
            >
          </div>
          <div class="id-photo-preview-area">
            <div
              v-if="dimensions.value"
              class="id-photo-frame"
              :style="frameStyle"
            >
              <canvas
                ref="preview"
                tabindex="0"
                aria-label="证件照预览，拖动或方向键调整位置，滚轮或加减键缩放"
                @pointerdown="startDrag"
                @pointermove="moveDrag"
                @pointerup="drag = undefined"
                @pointercancel="drag = undefined"
                @lostpointercapture="drag = undefined"
                @keydown="moveKey"
                @wheel="zoomWheel"
              />
              <div v-if="guides" class="id-photo-guides" aria-hidden="true">
                <i /><i /><i /><i />
              </div>
              <div v-if="preparing" class="id-photo-processing" role="status">
                <Icon name="LoaderCircle" :size="26" class="spin" /><strong
                  >正在识别人像…</strong
                ><span>首次使用需加载处理资源</span
                ><button class="button secondary" @click="cancelBackground">
                  取消换底
                </button>
              </div>
            </div>
            <p v-else class="preview-empty">请先填写有效的输出尺寸</p>
          </div>
          <div class="id-zoom-toolbar" role="group" aria-label="照片缩放控制">
            <button
              class="button secondary"
              aria-label="缩小照片"
              :disabled="busy || zoom <= photoZoom.min"
              @click="setZoom(zoom - photoZoom.step)"
            >
              <Icon name="Minus" :size="16" />缩小
            </button>
            <output aria-label="当前缩放比例">{{ zoom }}%</output>
            <button
              class="button secondary"
              aria-label="放大照片"
              :disabled="busy || zoom >= photoZoom.max"
              @click="setZoom(zoom + photoZoom.step)"
            >
              <Icon name="Plus" :size="16" />放大
            </button>
            <button class="text-button" :disabled="busy" @click="resetPosition">
              铺满重置
            </button>
          </div>
          <p class="id-preview-hint">
            拖动调整位置，滚轮或按钮缩放 · {{ photoZoom.min }}%–{{
              photoZoom.max
            }}%<br />
            <template v-if="zoom < 100"
              >空余区域填充{{
                background === "original" ? "白色" : "所选底色"
              }}；</template
            >辅助线不会出现在导出图片中
          </p>
          <div class="id-export-settings">
            <label class="field-label"
              >导出格式<select
                v-model="format"
                aria-label="证件照导出格式"
                :disabled="busy"
              >
                <option value="image/jpeg">JPG</option>
                <option value="image/png">PNG</option>
              </select></label
            >
            <label v-if="format === 'image/jpeg'" class="field-label"
              >图片质量 {{ quality }}%<input
                v-model.number="quality"
                type="range"
                min="50"
                max="100"
                aria-label="证件照图片质量"
                :disabled="busy"
            /></label>
          </div>
          <button
            class="button primary id-download"
            :disabled="!outputReady"
            @click="download"
          >
            <Icon
              :name="exporting ? 'LoaderCircle' : 'Download'"
              :size="17"
              :class="{ spin: exporting }"
            />{{ exporting ? "正在导出…" : "下载证件照" }}
          </button>
          <p v-if="lastExport" class="id-export-result" role="status">
            已导出 · {{ lastExport }}
          </p>
        </section>
      </div>
    </template>
    <p v-if="error || dimensions.error" class="error-message" role="alert">
      {{ error || dimensions.error }}
    </p>
    <div class="workspace-footnote">
      <Icon
        name="Info"
        :size="15"
      />尺寸、底色及头部比例请按接收方要求调整；自动换底后请检查发丝和衣服边缘。
    </div>
  </div>
</template>
