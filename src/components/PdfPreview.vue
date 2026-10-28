<script setup lang="ts">
import { computed, onUnmounted, ref, shallowRef, watch } from "vue";
import type {
  PDFDocumentProxy,
  PDFDocumentLoadingTask,
  RenderTask,
} from "pdfjs-dist";
import workerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";
const props = withDefaults(
  defineProps<{
    source?: Uint8Array | Blob;
    selected?: number[];
    selectable?: boolean;
  }>(),
  { selectable: false },
);
const emit = defineEmits<{ select: [page: number] }>();
const count = ref(0),
  page = ref(0),
  busy = ref(false),
  error = ref("");
const thumbs = shallowRef<{ number: number; url: string }[]>([]);
const totalGroups = computed(() => Math.ceil(count.value / 6));
let doc: PDFDocumentProxy | undefined,
  task: PDFDocumentLoadingTask | undefined,
  render: RenderTask | undefined,
  version = 0,
  paintVersion = 0;
function release() {
  thumbs.value.forEach((t) => URL.revokeObjectURL(t.url));
  thumbs.value = [];
}
async function paint() {
  const current = ++paintVersion;
  render?.cancel();
  release();
  if (!doc) return;
  busy.value = true;
  try {
    for (
      let i = page.value * 6 + 1;
      i <= Math.min(count.value, page.value * 6 + 6);
      i++
    ) {
      const pdfPage = await doc.getPage(i);
      if (current !== paintVersion) return;
      const initial = pdfPage.getViewport({ scale: 1 }),
        viewport = pdfPage.getViewport({
          scale: Math.min(220 / initial.width, 290 / initial.height),
        });
      const canvas = document.createElement("canvas");
      canvas.width = Math.ceil(viewport.width);
      canvas.height = Math.ceil(viewport.height);
      render = pdfPage.render({ canvas, viewport });
      await render.promise;
      if (current !== paintVersion) return;
      const blob = await new Promise<Blob | null>((resolve) =>
        canvas.toBlob(resolve, "image/png"),
      );
      if (current !== paintVersion) return;
      if (blob)
        thumbs.value = [
          ...thumbs.value,
          { number: i, url: URL.createObjectURL(blob) },
        ];
      pdfPage.cleanup();
    }
  } catch (e) {
    if (
      current === paintVersion &&
      !(e instanceof Error && e.name === "RenderingCancelledException")
    )
      error.value = "预览暂时不可用，仍可处理并下载文件";
  } finally {
    if (current === paintVersion) busy.value = false;
  }
}
watch(
  () => props.source,
  async (source) => {
    const current = ++version;
    ++paintVersion;
    render?.cancel();
    release();
    doc = undefined;
    page.value = 0;
    count.value = 0;
    error.value = "";
    busy.value = !!source;
    const oldTask = task;
    task = undefined;
    void oldTask?.destroy();
    if (!source || current !== version) return;
    try {
      const pdf = await import("pdfjs-dist");
      if (current !== version) return;
      pdf.GlobalWorkerOptions.workerSrc = workerUrl;
      const bytes =
        source instanceof Blob
          ? new Uint8Array(await source.arrayBuffer())
          : source.slice();
      if (current !== version) return;
      const base = new URL(
        import.meta.env.BASE_URL + "vendor/utilities/pdf/",
        location.origin,
      ).href;
      const currentTask = pdf.getDocument({
        data: bytes,
        cMapUrl: base + "cmaps/",
        cMapPacked: true,
        standardFontDataUrl: base + "standard_fonts/",
        wasmUrl: base + "wasm/",
        useSystemFonts: true,
      });
      task = currentTask;
      currentTask.onPassword = () => {
        if (current === version) error.value = "无法预览加密 PDF";
        void currentTask.destroy();
      };
      const loaded = await currentTask.promise;
      if (current !== version) {
        void currentTask.destroy();
        return;
      }
      doc = loaded;
      count.value = doc.numPages;
      await paint();
    } catch {
      if (current === version) {
        error.value = error.value || "预览暂时不可用，仍可处理并下载文件";
        busy.value = false;
      }
    }
  },
  { immediate: true },
);
watch(page, paint);
onUnmounted(() => {
  version++;
  paintVersion++;
  render?.cancel();
  release();
  void task?.destroy();
});
</script>
<template>
  <section class="pdf-preview" aria-label="PDF 页面预览">
    <div class="pdf-preview-heading">
      <strong
        >页面预览 <span v-if="count">· {{ count }} 页</span></strong
      ><span v-if="busy" role="status">载入中…</span>
    </div>
    <p v-if="selectable" class="pdf-preview-help">
      点击页面选择或取消，左侧页码会同步更新。
    </p>
    <div class="pdf-thumbnails">
      <button
        v-for="item in thumbs"
        :key="item.number"
        :class="{ selected: selected?.includes(item.number) }"
        :disabled="!selectable"
        :aria-label="'第 ' + item.number + ' 页'"
        :aria-pressed="selectable ? selected?.includes(item.number) : undefined"
        @click="emit('select', item.number)"
      >
        <img :src="item.url" :alt="'PDF 第 ' + item.number + ' 页'" /><span
          >{{ item.number
          }}<b v-if="selected?.includes(item.number)">已选</b></span
        >
      </button>
    </div>
    <p v-if="error" class="muted">{{ error }}</p>
    <p v-else-if="!source" class="muted">选择文件后预览页面</p>
    <div v-if="totalGroups > 1" class="pdf-preview-pager">
      <button
        class="button secondary"
        :disabled="page === 0 || busy"
        @click="page--"
      >
        上一组</button
      ><span>{{ page + 1 }} / {{ totalGroups }}</span
      ><button
        class="button secondary"
        :disabled="page + 1 >= totalGroups || busy"
        @click="page++"
      >
        下一组
      </button>
    </div>
  </section>
</template>
<style scoped>
.pdf-preview {
  padding: 18px;
  background: var(--soft-bg);
  min-width: 0;
}
.pdf-preview-heading {
  display: flex;
  justify-content: space-between;
  gap: 10px;
  font-size: 13px;
  margin-bottom: 18px;
}
.pdf-preview-heading span,
.pdf-preview-help {
  font-size: 12px;
  color: var(--subtle);
}
.pdf-preview-help {
  margin-bottom: 14px;
}
.pdf-thumbnails {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 14px;
  align-items: start;
}
.pdf-thumbnails button {
  padding: 8px;
  border: 2px solid transparent;
  background: var(--surface);
  border-radius: 5px;
  box-shadow: 0 1px 6px #0001;
  min-width: 0;
}
.pdf-thumbnails button.selected {
  border-color: var(--primary);
}
.pdf-thumbnails button:disabled {
  opacity: 1;
}
.pdf-thumbnails img {
  display: block;
  width: 100%;
  height: 180px;
  object-fit: contain;
}
.pdf-thumbnails span {
  display: flex;
  justify-content: space-between;
  padding: 8px 2px 0;
  font-size: 12px;
}
.pdf-thumbnails b {
  font-weight: 400;
  color: var(--primary);
}
.pdf-preview-pager {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 16px;
  margin-top: 18px;
  font-size: 12px;
}
@media (max-width: 1100px) {
  .pdf-thumbnails {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
@media (max-width: 420px) {
  .pdf-thumbnails img {
    height: 150px;
  }
}
</style>
