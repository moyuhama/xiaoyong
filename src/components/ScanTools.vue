<script setup lang="ts">
import { computed, onUnmounted, ref, watch } from "vue";
import Icon from "./Icon.vue";
import EditorPanel from "./EditorPanel.vue";
import { useImages } from "../lib/use-images";
import { useWorkerTask } from "../lib/worker-task";
import { newCanvas } from "../lib/image-layout";
import type { Worker as OcrWorker, PSM } from "tesseract.js";
const props = defineProps<{ toolId: string }>();
const ocr = computed(() => props.toolId === "image-ocr");
const {
  images,
  loading,
  error: uploadError,
  add,
  remove,
} = useImages(1, ocr.value ? 3000 : 2048);
const picker = ref<HTMLInputElement>(),
  language = ref("chi_sim+eng"),
  layout = ref("3"),
  text = ref(""),
  error = ref(""),
  ocrBusy = ref(false),
  progress = ref("");
const qr = useWorkerTask<
  { data: Uint8ClampedArray; width: number; height: number },
  string
>(
  () =>
    new Worker(new URL("../workers/qr-reader.ts", import.meta.url), {
      type: "module",
    }),
  15000,
);
const working = computed(() => loading.value || ocrBusy.value || qr.busy.value);
let version = 0,
  worker: OcrWorker | undefined,
  timer: ReturnType<typeof setTimeout> | undefined;
function cancel() {
  version++;
  clearTimeout(timer);
  if (worker) void worker.terminate();
  worker = undefined;
  ocrBusy.value = false;
  progress.value = "";
  qr.cancel();
}
function invalidate() {
  cancel();
  text.value = "";
  error.value = "";
}
watch([images, language, layout], invalidate);
onUnmounted(cancel);
async function select(files: FileList | File[] | null) {
  if (working.value) return;
  invalidate();
  await add(files);
  if (picker.value) picker.value.value = "";
}
async function recognize() {
  if (!images.value[0] || working.value) return;
  invalidate();
  const current = version;
  const image = images.value[0]!.bitmap,
    { canvas, ctx } = newCanvas(image.width, image.height, "#ffffff");
  ctx.drawImage(image, 0, 0);
  if (!ocr.value) {
    const result = await qr.run({
      data: ctx.getImageData(0, 0, canvas.width, canvas.height).data,
      width: canvas.width,
      height: canvas.height,
    });
    if (current === version && result !== undefined) text.value = result;
    return;
  }
  ocrBusy.value = true;
  progress.value = "准备识别模型…";
  timer = setTimeout(() => {
    if (current === version) {
      cancel();
      error.value = "识别超时，请裁剪文字区域或减小图片后重试";
    }
  }, 120000);
  try {
    const { createWorker } = await import("tesseract.js");
    if (current !== version) return;
    const base = new URL(
      import.meta.env.BASE_URL + "vendor/utilities/ocr/",
      location.origin,
    ).href;
    const created = await createWorker(language.value, 1, {
      workerPath: base + "worker.min.js",
      corePath: base + "core",
      langPath: base + "lang",
      cacheMethod: "none",
      logger: (message) => {
        if (current === version)
          progress.value =
            message.status === "recognizing text"
              ? "正在识别 " + Math.round(message.progress * 100) + "%"
              : "加载模型与语言数据…";
      },
    });
    if (current !== version) {
      void created.terminate();
      return;
    }
    worker = created;
    await created.setParameters({
      tessedit_pageseg_mode: layout.value as PSM,
      preserve_interword_spaces: "1",
    });
    const result = await created.recognize(canvas);
    if (current === version) {
      text.value = result.data.text.trim();
      if (!text.value) error.value = "未识别到文字，请使用清晰的印刷体图片";
    }
  } catch (e) {
    if (current === version)
      error.value =
        e instanceof Error ? "识别未完成：" + e.message : "识别失败，请重试";
  } finally {
    if (current === version) {
      clearTimeout(timer);
      if (worker) void worker.terminate();
      worker = undefined;
      ocrBusy.value = false;
      progress.value = "";
    }
  }
}
</script>
<template>
  <div class="tool-workspace">
    <input
      ref="picker"
      class="visually-hidden"
      type="file"
      accept="image/png,image/jpeg,image/webp"
      aria-label="选择图片"
      @change="select(($event.target as HTMLInputElement).files)"
    />
    <div class="tool-toolbar">
      <div class="toolbar-options">
        <template v-if="ocr"
          ><label class="inline-label"
            >语言<select v-model="language" :disabled="working">
              <option value="chi_sim+eng">简体中文 + 英文</option>
              <option value="eng">英文</option>
            </select></label
          ><label class="inline-label"
            >排版<select v-model="layout" :disabled="working">
              <option value="3">自动识别段落</option>
              <option value="11">零散文字</option>
            </select></label
          ></template
        ><span v-else class="muted">上传二维码图片，提取文字或链接</span>
      </div>
      <button
        v-if="images.length"
        class="text-button"
        :disabled="working"
        @click="picker?.click()"
      >
        更换图片
      </button>
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
          :name="loading ? 'LoaderCircle' : ocr ? 'FileText' : 'QrCode'"
          :class="{ spin: loading }"
          :size="38"
      /></span>
      <h2>
        {{
          loading ? "正在读取…" : ocr ? "选择包含文字的图片" : "选择二维码图片"
        }}
      </h2>
      <p>点击选择，或拖拽图片到这里</p>
      <small>JPG、PNG、WebP · 最多 20 MB、3200 万像素</small>
    </button>
    <template v-else
      ><div class="editor-grid">
        <div class="scan-preview">
          <img :src="images[0]!.url" alt="待识别图片缩略图" />
          <p>
            {{ images[0]!.name }} · {{ images[0]!.width }} ×
            {{ images[0]!.height }}
          </p>
          <button class="text-button" :disabled="working" @click="remove(0)">
            移除图片
          </button>
        </div>
        <EditorPanel
          :model-value="text"
          title="识别结果"
          readonly
          filename="recognized.txt"
          placeholder="识别后的文字会显示在这里"
        />
      </div>
      <div class="action-row">
        <button class="button primary" :disabled="working" @click="recognize">
          <Icon
            :name="working ? 'LoaderCircle' : 'ScanLine'"
            :class="{ spin: working }"
            :size="17"
          />{{ working ? "识别中…" : "开始识别" }}</button
        ><button
          v-if="ocrBusy || qr.busy.value"
          class="button secondary"
          @click="cancel"
        >
          取消</button
        ><span v-if="progress" class="muted" role="status">{{ progress }}</span>
      </div></template
    >
    <p
      v-if="uploadError || error || qr.error.value"
      class="error-message"
      role="alert"
    >
      {{ uploadError || error || qr.error.value }}
    </p>
    <div class="workspace-footnote">
      <Icon name="Info" :size="15" />{{
        ocr
          ? "首次识别需加载模型和语言文件；识别在浏览器内完成。适合清晰印刷体，手写、竖排、复杂表格或模糊文字请核对。最长边超过 3000 px 会缩小处理。"
          : "支持常见二维码，每张提取一个；只显示识别内容，不自动访问链接。模糊、遮挡或艺术二维码可能无法识别。"
      }}
    </div>
  </div>
</template>
