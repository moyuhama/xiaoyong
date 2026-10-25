<script setup lang="ts">
import { computed, onUnmounted, ref, shallowRef, watch } from "vue";
import Icon from "./Icon.vue";
import { useWorkerTask } from "../lib/worker-task";
import type { PdfInput, PdfRequest, PdfResult } from "../lib/pdf-tools";
import { downloadBlob, formatBytes } from "../lib/ui";
const props = defineProps<{ toolId: string }>();
const merge = computed(() => props.toolId === "pdf-merge"),
  picker = ref<HTMLInputElement>();
const files = shallowRef<
  (PdfInput & { size: number; pages: number; id: number })[]
>([]);
const range = ref(""),
  reading = ref(false),
  validation = ref(""),
  output = shallowRef<Blob>(),
  outputPages = ref(0);
const { busy, error, run, cancel } = useWorkerTask<PdfRequest, PdfResult>(
  () =>
    new Worker(new URL("../workers/pdf.ts", import.meta.url), {
      type: "module",
    }),
  30000,
);
const totalPages = computed(() =>
  files.value.reduce((sum, file) => sum + file.pages, 0),
);
const working = computed(() => busy.value || reading.value);
let version = 0,
  sequence = 0;
function invalidate() {
  output.value = undefined;
  outputPages.value = 0;
  validation.value = "";
  cancel();
}
async function addFiles(chosen: FileList | File[] | null) {
  if (!chosen?.length || working.value) return;
  invalidate();
  const incoming = Array.from(chosen);
  if (!merge.value && incoming.length !== 1) {
    validation.value = "页面提取每次请选择一个 PDF";
    return;
  }
  if (
    incoming.some(
      (file) => file.type !== "application/pdf" && !/\.pdf$/i.test(file.name),
    )
  ) {
    validation.value = "请选择 PDF 文件";
    return;
  }
  const retained = merge.value ? files.value : [];
  if (
    retained.length + incoming.length > 20 ||
    retained.reduce((sum, file) => sum + file.size, 0) +
      incoming.reduce((sum, file) => sum + file.size, 0) >
      50 * 1024 * 1024
  ) {
    validation.value = "最多 20 个文件，总大小不超过 50 MB";
    return;
  }
  reading.value = true;
  const current = ++version;
  try {
    const added = await Promise.all(
      incoming.map(async (file) => ({
        name: file.name,
        bytes: new Uint8Array(await file.arrayBuffer()),
        size: file.size,
        pages: 0,
        id: ++sequence,
      })),
    );
    if (current !== version) return;
    const candidates = [...retained, ...added];
    const inspected = await run({
      operation: "inspect",
      files: candidates.map(({ name, bytes }) => ({ name, bytes })),
    });
    if (!inspected || current !== version) return;
    files.value = candidates.map((file, index) => ({
      ...file,
      pages: inspected.counts[index]!,
    }));
    if (!merge.value) range.value = "1-" + files.value[0]!.pages;
  } catch {
    validation.value = "文件读取失败，请重新选择";
  } finally {
    if (current === version) {
      reading.value = false;
      if (picker.value) picker.value.value = "";
    }
  }
}
function remove(index: number) {
  invalidate();
  files.value = files.value.filter((_, i) => i !== index);
}
function move(index: number, direction: number) {
  if (index + direction < 0 || index + direction >= files.value.length) return;
  invalidate();
  const next = [...files.value];
  [next[index], next[index + direction]] = [
    next[index + direction]!,
    next[index]!,
  ];
  files.value = next;
}
async function generate() {
  if (!files.value.length) return;
  invalidate();
  const result = await run({
    operation: merge.value ? "merge" : "extract",
    files: files.value.map(({ name, bytes }) => ({ name, bytes })),
    range: range.value,
  });
  if (result?.bytes) {
    output.value = new Blob([result.bytes.slice().buffer as ArrayBuffer], {
      type: "application/pdf",
    });
    outputPages.value = result.pages!;
  }
}
watch(range, invalidate);
onUnmounted(() => {
  version++;
});
</script>
<template>
  <div class="tool-workspace">
    <input
      ref="picker"
      type="file"
      accept=".pdf,application/pdf"
      :multiple="merge"
      class="visually-hidden"
      aria-label="选择 PDF 文件"
      @change="addFiles(($event.target as HTMLInputElement).files)"
    />
    <div class="tool-toolbar">
      <span class="muted">{{
        files.length
          ? files.length + " 个文件 · " + totalPages + " 页"
          : "选择需要整理的 PDF"
      }}</span
      ><button
        v-if="files.length"
        class="text-button"
        :disabled="working"
        @click="picker?.click()"
      >
        {{ merge ? "继续添加" : "更换文件" }}
      </button>
    </div>
    <button
      v-if="!files.length"
      class="upload-zone"
      :disabled="working"
      @click="picker?.click()"
      @dragover.prevent
      @drop.prevent="addFiles($event.dataTransfer?.files || null)"
    >
      <span class="upload-illustration"
        ><Icon
          :name="working ? 'LoaderCircle' : 'Files'"
          :size="38"
          :class="{ spin: working }"
      /></span>
      <h2>
        {{
          working
            ? "正在读取文件…"
            : merge
              ? "选择要合并的 PDF"
              : "选择要提取的 PDF"
        }}
      </h2>
      <p>点击选择，或拖拽文件到这里</p>
      <small>合计最多 50 MB、500 页；不支持加密文件与交互表单</small>
    </button>
    <div v-else class="settings-panel">
      <ol class="pdf-file-list">
        <li v-for="(file, index) in files" :key="file.id">
          <span class="file-order">{{ index + 1 }}</span>
          <div class="pdf-file-name">
            <strong>{{ file.name }}</strong
            ><small>{{ file.pages }} 页 · {{ formatBytes(file.size) }}</small>
          </div>
          <div class="pdf-file-actions">
            <template v-if="merge"
              ><button
                class="icon-button"
                :aria-label="'上移 ' + file.name"
                :disabled="working || index === 0"
                @click="move(index, -1)"
              >
                <Icon name="ArrowUp" :size="16" /></button
              ><button
                class="icon-button"
                :aria-label="'下移 ' + file.name"
                :disabled="working || index === files.length - 1"
                @click="move(index, 1)"
              >
                <Icon name="ArrowDown" :size="16" /></button></template
            ><button
              class="icon-button"
              :aria-label="'移除 ' + file.name"
              :disabled="working"
              @click="remove(index)"
            >
              <Icon name="X" :size="16" />
            </button>
          </div>
        </li>
      </ol>
      <label v-if="!merge" class="field-label"
        >要提取的页码<input
          v-model="range"
          :disabled="working"
          placeholder="例如 1-3, 5, 8"
      /></label>
      <p v-if="!merge" class="muted range-hint">
        按填写顺序排列；例如 3, 1-2 会把第 3 页放在最前。重复页码仅保留一次。
      </p>
      <button class="button primary" :disabled="working" @click="generate">
        <Icon
          :name="working ? 'LoaderCircle' : 'FileOutput'"
          :size="17"
          :class="{ spin: working }"
        />{{ working ? "正在处理…" : merge ? "合并 PDF" : "提取并生成 PDF" }}
      </button>
      <div v-if="output" class="file-output" role="status">
        <div>
          <strong>已生成 {{ outputPages }} 页 PDF</strong
          ><span>{{ formatBytes(output.size) }}</span>
        </div>
        <button
          class="button primary"
          @click="
            downloadBlob(
              output,
              merge
                ? 'xiaoyong-merged.pdf'
                : files[0]!.name.replace(/\.pdf$/i, '') + '-pages.pdf',
            )
          "
        >
          <Icon name="Download" :size="17" />下载 PDF
        </button>
      </div>
    </div>
    <p v-if="validation || error" role="alert" class="error-message">
      {{ validation || error }}
    </p>
    <div class="workspace-footnote">
      <Icon
        name="Info"
        :size="15"
      />导出保留页面内容；书签、附件和文档级设置不保留。
    </div>
  </div>
</template>
