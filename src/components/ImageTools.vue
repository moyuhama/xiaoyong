<script setup lang="ts">
import { computed, onUnmounted, ref, watch } from "vue";
import Icon from "./Icon.vue";
import { downloadBlob, formatBytes, notify } from "../lib/ui";
const props = defineProps<{ toolId: string }>();
const fileInput = ref<HTMLInputElement>();
const file = ref<File>(),
  originalUrl = ref(""),
  resultUrl = ref("");
const dimensions = ref({ width: 0, height: 0 });
const width = ref(0),
  height = ref(0),
  locked = ref(true);
const quality = ref(80),
  format = ref("image/webp");
const busy = ref(false),
  loading = ref(false),
  dragging = ref(false),
  error = ref("");
const output = ref<Blob>(),
  outputName = ref("");
let bitmap: ImageBitmap | undefined,
  generation = 0;
const savings = computed(() =>
  file.value && output.value
    ? Math.round((1 - output.value.size / file.value.size) * 100)
    : 0,
);
function clearOutput() {
  generation++;
  if (resultUrl.value) URL.revokeObjectURL(resultUrl.value);
  resultUrl.value = "";
  output.value = undefined;
}
watch([quality, format, width, height], clearOutput);
function clear() {
  clearOutput();
  if (originalUrl.value) URL.revokeObjectURL(originalUrl.value);
  originalUrl.value = "";
  file.value = undefined;
  bitmap?.close();
  bitmap = undefined;
  error.value = "";
  loading.value = false;
  if (fileInput.value) fileInput.value.value = "";
}
async function loadFile(next?: File) {
  if (!next) return;
  clear();
  error.value = "";
  if (!["image/jpeg", "image/png", "image/webp"].includes(next.type)) {
    error.value = "请选择 JPG、PNG 或 WebP 静态图片";
    return;
  }
  if (next.size > 20 * 1024 * 1024) {
    error.value = "单张图片请控制在 20 MB 以内";
    return;
  }
  const current = ++generation;
  loading.value = true;
  try {
    const decoded = await createImageBitmap(next, {
      imageOrientation: "from-image",
    });
    if (current !== generation) {
      decoded.close();
      return;
    }
    if (decoded.width * decoded.height > 32000000) {
      decoded.close();
      throw new Error("图片像素过大，请使用不超过 3,200 万像素的图片");
    }
    bitmap = decoded;
    dimensions.value = { width: decoded.width, height: decoded.height };
    width.value = decoded.width;
    height.value = decoded.height;
    file.value = next;
    originalUrl.value = URL.createObjectURL(next);
    format.value =
      props.toolId === "image-compress" && next.type === "image/png"
        ? "image/webp"
        : next.type;
  } catch (err) {
    error.value =
      err instanceof Error ? err.message : "图片无法读取，请换一张图片重试";
  } finally {
    loading.value = false;
    if (fileInput.value) fileInput.value.value = "";
  }
}
function resize(side: "width" | "height", value: string) {
  const number = Number(value);
  if (side === "width") {
    width.value = number;
    if (locked.value)
      height.value = Math.max(
        1,
        Math.round((number * dimensions.value.height) / dimensions.value.width),
      );
  } else {
    height.value = number;
    if (locked.value)
      width.value = Math.max(
        1,
        Math.round((number * dimensions.value.width) / dimensions.value.height),
      );
  }
}
async function processImage() {
  if (!bitmap || !file.value || busy.value) return;
  error.value = "";
  const w =
    props.toolId === "image-compress" ? dimensions.value.width : width.value;
  const h =
    props.toolId === "image-compress" ? dimensions.value.height : height.value;
  if (
    ![w, h].every((n) => Number.isInteger(n) && n >= 1 && n <= 16384) ||
    w * h > 32000000
  ) {
    error.value = "尺寸需为 1–16,384 的整数，总像素不能超过 3,200 万";
    return;
  }
  clearOutput();
  const current = generation;
  busy.value = true;
  try {
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("当前浏览器无法创建图片画布");
    if (format.value === "image/jpeg") {
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, w, h);
    }
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(bitmap, 0, 0, w, h);
    const blob = await new Promise<Blob>((resolve, reject) =>
      canvas.toBlob(
        (value) =>
          value
            ? resolve(value)
            : reject(new Error("图片处理失败，请尝试更小尺寸")),
        format.value,
        quality.value / 100,
      ),
    );
    canvas.width = 0;
    canvas.height = 0;
    if (current !== generation) return;
    output.value = blob;
    resultUrl.value = URL.createObjectURL(blob);
    const ext =
      blob.type === "image/jpeg"
        ? "jpg"
        : blob.type === "image/webp"
          ? "webp"
          : "png";
    outputName.value =
      file.value.name.replace(/\.[^.]+$/, "") + "-xiaoyong." + ext;
    if (blob.type !== format.value)
      notify("当前浏览器不支持所选输出格式，已使用 PNG");
  } catch (err) {
    error.value = err instanceof Error ? err.message : "图片处理失败";
  } finally {
    busy.value = false;
  }
}
function drop(event: DragEvent) {
  dragging.value = false;
  const files = event.dataTransfer?.files;
  if (files && files.length > 1) notify("首版每次处理一张图片，已选择第一张");
  loadFile(files?.[0]);
}
onUnmounted(clear);
</script>
<template>
  <div class="tool-workspace image-workspace">
    <input
      ref="fileInput"
      type="file"
      accept="image/jpeg,image/png,image/webp"
      class="visually-hidden"
      aria-label="选择图片文件"
      @change="loadFile(($event.target as HTMLInputElement).files?.[0])"
    />
    <button
      v-if="!file"
      class="upload-zone"
      :class="{ dragging }"
      :disabled="loading"
      @click="fileInput?.click()"
      @dragover.prevent="dragging = true"
      @dragleave.prevent="dragging = false"
      @drop.prevent="drop"
    >
      <span class="upload-illustration"
        ><Icon
          :name="loading ? 'LoaderCircle' : 'Image'"
          :size="37"
          :class="{ spin: loading }" /><span v-if="!loading"
          ><Icon name="Plus" :size="16" /></span
      ></span>
      <h2>{{ loading ? "正在读取图片…" : "把图片放到这里" }}</h2>
      <p>拖拽图片到此处，或<span>点击选择文件</span></p>
      <small>支持 JPG、PNG、WebP 静态图片 · 单张最大 20 MB</small>
    </button>
    <template v-else>
      <div class="tool-toolbar">
        <div class="file-summary">
          <Icon name="FileImage" :size="20" /><strong>{{ file.name }}</strong
          ><span
            >{{ formatBytes(file.size) }} · {{ dimensions.width }} ×
            {{ dimensions.height }}</span
          >
        </div>
        <button
          class="text-button"
          :disabled="busy"
          @click="fileInput?.click()"
        >
          更换图片
        </button>
      </div>
      <div class="image-settings">
        <label class="field-label"
          >输出格式<select v-model="format" :disabled="busy">
            <option value="image/webp">WebP · 更小体积</option>
            <option value="image/jpeg">JPG · 通用格式</option>
            <option value="image/png">PNG · 无损像素输出</option>
          </select></label
        ><template v-if="toolId === 'image-convert'"
          ><label class="field-label"
            >宽度（px）<input
              :value="width"
              type="number"
              min="1"
              max="16384"
              :disabled="busy"
              @input="
                resize('width', ($event.target as HTMLInputElement).value)
              " /></label
          ><label class="field-label"
            >高度（px）<input
              :value="height"
              type="number"
              min="1"
              max="16384"
              :disabled="busy"
              @input="
                resize('height', ($event.target as HTMLInputElement).value)
              " /></label
          ><label class="check-label"
            ><input
              v-model="locked"
              type="checkbox"
              :disabled="busy"
            />锁定比例</label
          ></template
        ><label v-if="format !== 'image/png'" class="field-label quality-slider"
          >图片质量 <span>{{ quality }}%</span
          ><input
            v-model.number="quality"
            type="range"
            min="10"
            max="100"
            :disabled="busy"
        /></label>
      </div>
      <div class="image-comparison">
        <section>
          <div class="panel-heading">
            <h2>原始图片</h2>
            <span class="muted">{{ formatBytes(file.size) }}</span>
          </div>
          <div class="image-preview checkerboard">
            <img :src="originalUrl" alt="原始图片预览" />
          </div>
        </section>
        <section>
          <div class="panel-heading">
            <h2>处理后</h2>
            <span v-if="output" :class="savings > 0 ? 'success-text' : 'muted'"
              >{{ formatBytes(output.size) }} ·
              {{
                savings >= 0
                  ? "减少 " + savings + "%"
                  : "增大 " + Math.abs(savings) + "%"
              }}</span
            >
          </div>
          <div class="image-preview checkerboard">
            <img v-if="resultUrl" :src="resultUrl" alt="处理后图片预览" />
            <div v-else class="panel-placeholder">
              <Icon name="ImageDown" :size="32" />
              <p>处理后的图片会显示在这里</p>
            </div>
          </div>
        </section>
      </div>
      <div class="action-row">
        <button class="button primary" :disabled="busy" @click="processImage">
          <Icon
            :name="busy ? 'LoaderCircle' : 'SlidersHorizontal'"
            :size="17"
            :class="{ spin: busy }"
          />{{
            busy
              ? "正在处理"
              : toolId === "image-compress"
                ? "开始压缩"
                : "转换图片"
          }}</button
        ><button
          class="button secondary"
          :disabled="!output || busy"
          @click="output && downloadBlob(output, outputName)"
        >
          <Icon name="Download" :size="17" />下载图片</button
        ><button class="text-button" :disabled="busy" @click="clear">
          清除图片
        </button>
      </div>
    </template>
    <div v-if="error" role="alert" class="error-message">{{ error }}</div>
    <div class="workspace-footnote">
      <Icon name="Info" :size="15" /><span
        >{{
          toolId === "image-compress"
            ? "压缩效果取决于原图；PNG 质量不可调，建议转为 WebP 或 JPG 以减小体积。"
            : "转换为 JPG 时，透明区域将填充白色。图片重新编码，不保留原始 EXIF 信息。"
        }}
        动图请使用专用工具处理。</span
      >
    </div>
  </div>
</template>
