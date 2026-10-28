<script setup lang="ts">
import { computed, onUnmounted, ref, shallowRef, watch } from "vue";
import Icon from "./Icon.vue";
import EditorPanel from "./EditorPanel.vue";
import PdfPreview from "./PdfPreview.vue";
const sourcePreview = shallowRef<Blob>();
import { parsePageRange } from "../lib/pdf-tools";
import { newCanvas, canvasBlob } from "../lib/image-layout";
import { downloadBlob, formatBytes } from "../lib/ui";
import type {
  PDFDocumentProxy,
  PDFDocumentLoadingTask,
  RenderTask,
} from "pdfjs-dist";
import workerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";
const props = defineProps<{ toolId: string }>();
const textMode = computed(() => props.toolId === "pdf-text");
const picker = ref<HTMLInputElement>(),
  name = ref(""),
  pageCount = ref(0),
  range = ref(""),
  dpi = ref(150),
  format = ref("png"),
  busy = ref(false),
  reading = ref(false),
  error = ref(""),
  progress = ref(""),
  text = ref("");
const images = shallowRef<{ name: string; blob: Blob; url: string }[]>([]);
let doc: PDFDocumentProxy | undefined,
  loadingTask: PDFDocumentLoadingTask | undefined,
  render: RenderTask | undefined,
  cancelZip: (() => void) | undefined,
  version = 0;
const working = computed(() => busy.value || reading.value);
function clear() {
  version++;
  cancelZip?.();
  cancelZip = undefined;
  render?.cancel();
  render = undefined;
  text.value = "";
  images.value.forEach((i) => URL.revokeObjectURL(i.url));
  images.value = [];
  error.value = "";
  progress.value = "";
  busy.value = false;
}
watch([range, dpi, format], clear);
onUnmounted(() => {
  clear();
  void loadingTask?.destroy();
});
async function select(files: FileList | File[] | null) {
  if (!files?.length || working.value) return;
  clear();
  const file = files[0]!;
  if (
    files.length !== 1 ||
    (!/\.pdf$/i.test(file.name) && file.type !== "application/pdf") ||
    file.size > 20 * 1024 * 1024
  ) {
    error.value = "请选择一个 20 MB 以内的 PDF";
    return;
  }
  await loadingTask?.destroy();
  doc = undefined;
  name.value = "";
  sourcePreview.value = undefined;
  pageCount.value = 0;
  reading.value = true;
  const current = version;
  try {
    const pdf = await import("pdfjs-dist");
    if (current !== version) return;
    pdf.GlobalWorkerOptions.workerSrc = workerUrl;
    const base = new URL(
      import.meta.env.BASE_URL + "vendor/utilities/pdf/",
      location.origin,
    ).href;
    const task = pdf.getDocument({
      data: new Uint8Array(await file.arrayBuffer()),
      cMapUrl: base + "cmaps/",
      cMapPacked: true,
      standardFontDataUrl: base + "standard_fonts/",
      wasmUrl: base + "wasm/",
      useSystemFonts: true,
    });
    loadingTask = task;
    task.onPassword = () => {
      error.value = "暂不支持加密 PDF，请先提供未加密文件";
      void task.destroy();
    };
    const loaded = await task.promise;
    if (current !== version) {
      void task.destroy();
      return;
    }
    if (loaded.numPages > 500)
      throw new Error("最多支持 500 页的文件，请先提取需要处理的页面");
    doc = loaded;
    name.value = file.name;
    sourcePreview.value = file;
    pageCount.value = doc.numPages;
    range.value = "1-" + Math.min(doc.numPages, textMode.value ? 100 : 20);
  } catch (e) {
    if (current === version)
      error.value =
        error.value ||
        (e instanceof Error ? "PDF 无法读取：" + e.message : "PDF 无法读取");
  } finally {
    reading.value = false;
    if (picker.value) picker.value.value = "";
  }
}
async function process() {
  if (!doc || working.value) return;
  clear();
  const current = version;
  busy.value = true;
  try {
    const pages = parsePageRange(range.value, pageCount.value);
    if (pages.length > (textMode.value ? 100 : 20))
      throw new Error(
        textMode.value
          ? "每次最多提取 100 页文字"
          : "每次最多导出 20 页图片，请缩小页码范围",
      );
    let combined = "",
      total = 0;
    for (const index of pages) {
      if (current !== version) return;
      progress.value = `正在处理第 ${index + 1} 页`;
      const page = await doc.getPage(index + 1);
      if (current !== version) return;
      if (textMode.value) {
        const content = await page.getTextContent();
        combined +=
          "—— 第 " +
          (index + 1) +
          " 页 ——\n" +
          content.items
            .map((item) =>
              "str" in item ? item.str + (item.hasEOL ? "\n" : " ") : "",
            )
            .join("")
            .trim() +
          "\n\n";
        if (combined.length > 2_000_000)
          throw new Error("文字超过 200 万字符，请减少页面");
      } else {
        const viewport = page.getViewport({ scale: dpi.value / 72 }),
          { canvas, ctx } = newCanvas(
            Math.ceil(viewport.width),
            Math.ceil(viewport.height),
            "#fff",
          );
        render = page.render({ canvas, canvasContext: ctx, viewport });
        await render.promise;
        render = undefined;
        const blob = await canvasBlob(
          canvas,
          format.value === "jpg" ? "image/jpeg" : "image/png",
        );
        total += blob.size;
        if (total > 50 * 1024 * 1024)
          throw new Error("输出图片合计超过 50 MB，请降低清晰度或减少页面");
        if (current !== version) return;
        images.value = [
          ...images.value,
          {
            name:
              "page-" + String(index + 1).padStart(3, "0") + "." + format.value,
            blob,
            url: URL.createObjectURL(blob),
          },
        ];
      }
      page.cleanup();
    }
    if (current === version && textMode.value) text.value = combined.trim();
  } catch (e) {
    if (current === version) {
      images.value.forEach((i) => URL.revokeObjectURL(i.url));
      images.value = [];
      text.value = "";
      error.value = e instanceof Error ? e.message : "处理失败";
    }
  } finally {
    if (current === version) {
      busy.value = false;
      progress.value = "";
    }
  }
}
async function downloadZip() {
  if (!images.value.length || working.value) return;
  const current = version;
  const selected = [...images.value];
  busy.value = true;
  error.value = "";
  try {
    const { zip } = await import("fflate");
    if (current !== version) return;
    const files: Record<string, Uint8Array> = Object.create(null);
    for (const image of selected)
      files[image.name] = new Uint8Array(await image.blob.arrayBuffer());
    if (current !== version) return;
    const bytes = await new Promise<Uint8Array>((resolve, reject) => {
      const terminate = zip(files, { level: 0 }, (error, data) =>
        error ? reject(error) : resolve(data),
      );
      cancelZip = () => {
        terminate();
        reject(new Error("已取消"));
      };
    });
    if (current !== version) return;
    downloadBlob(
      new Blob([bytes.slice().buffer as ArrayBuffer], {
        type: "application/zip",
      }),
      "pdf-images.zip",
    );
  } catch {
    if (current === version) error.value = "图片打包失败，请逐张下载";
  } finally {
    if (current === version) {
      cancelZip = undefined;
      busy.value = false;
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
      accept=".pdf,application/pdf"
      aria-label="选择 PDF 文件"
      @change="select(($event.target as HTMLInputElement).files)"
    />
    <div class="tool-toolbar">
      <span class="muted">{{
        name ? name + " · " + pageCount + " 页" : "选择一个 PDF"
      }}</span
      ><button
        v-if="name"
        class="text-button"
        :disabled="working"
        @click="picker?.click()"
      >
        更换文件
      </button>
    </div>
    <button
      v-if="!name"
      class="upload-zone"
      :disabled="reading"
      @click="picker?.click()"
      @dragover.prevent
      @drop.prevent="select($event.dataTransfer?.files || null)"
    >
      <span class="upload-illustration"
        ><Icon
          :name="reading ? 'LoaderCircle' : 'Files'"
          :class="{ spin: reading }"
          :size="38"
      /></span>
      <h2>{{ reading ? "正在读取…" : "选择 PDF 文件" }}</h2>
      <p>点击选择，或拖拽文件到这里</p>
      <small>未加密 PDF · 最多 20 MB、500 页</small>
    </button>
    <template v-else
      ><div class="file-workbench">
        <div class="settings-panel">
          <label class="field-label"
            >处理页码<input
              v-model="range"
              :disabled="working"
              placeholder="例如 1-3, 5"
          /></label>
          <p class="muted">
            默认选中前 {{ textMode ? 100 : 20 }} 页以内的页面，可修改页码范围。
          </p>
          <div v-if="!textMode" class="two-fields">
            <label class="field-label"
              >清晰度<select v-model.number="dpi" :disabled="working">
                <option :value="72">72 DPI · 预览</option>
                <option :value="150">150 DPI · 标准</option>
                <option :value="300">300 DPI · 高清</option>
              </select></label
            ><label class="field-label"
              >图片格式<select v-model="format" :disabled="working">
                <option value="png">PNG</option>
                <option value="jpg">JPG</option>
              </select></label
            >
          </div>
          <div class="toolbar-options">
            <button class="button primary" :disabled="working" @click="process">
              <Icon
                :name="working ? 'LoaderCircle' : 'FileOutput'"
                :class="{ spin: working }"
                :size="17"
              />{{
                working ? "处理中…" : textMode ? "提取文字" : "转换为图片"
              }}</button
            ><button v-if="busy" class="button secondary" @click="clear">
              取消</button
            ><span v-if="progress" class="muted" role="status">{{
              progress
            }}</span>
          </div>
        </div>
        <section>
          <PdfPreview
            v-if="!text && !images.length"
            :source="sourcePreview"
          /><EditorPanel
            v-if="textMode && text"
            :model-value="text"
            title="提取结果"
            readonly
            filename="pdf-text.txt"
            placeholder="提取的文字会显示在这里"
          /><template v-else-if="images.length"
            ><div class="tool-toolbar">
              <span class="muted">{{ images.length }} 张图片</span
              ><button
                class="button primary"
                :disabled="working"
                @click="downloadZip"
              >
                打包下载 ZIP
              </button>
            </div>
            <div class="pdf-image-grid">
              <article v-for="image in images" :key="image.name">
                <img :src="image.url" :alt="image.name" />
                <p>{{ image.name }} · {{ formatBytes(image.blob.size) }}</p>
                <button
                  class="button secondary"
                  :disabled="working"
                  :aria-label="'下载 ' + image.name"
                  @click="downloadBlob(image.blob, image.name)"
                >
                  下载图片
                </button>
              </article>
            </div></template
          >
        </section>
      </div></template
    >
    <p v-if="error" class="error-message" role="alert">{{ error }}</p>
    <div class="workspace-footnote">
      <Icon name="Info" :size="15" />{{
        textMode
          ? "提取 PDF 的文字层，不执行 OCR；扫描件可能只有页码标记、没有正文。复杂多栏、公式或缺失字体映射的文档可能出现顺序差异或乱码。"
          : "每次最多 20 页、输出合计 50 MB，每页最多 1600 万像素；支持单张下载与 ZIP 打包，较大页面请降低清晰度。"
      }}
    </div>
  </div>
</template>
