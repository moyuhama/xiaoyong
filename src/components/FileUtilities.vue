<script setup lang="ts">
import { computed, ref, shallowRef, watch } from "vue";
import Icon from "./Icon.vue";
import EditorPanel from "./EditorPanel.vue";
import { useWorkerTask } from "../lib/worker-task";
import {
  rowsToCsv,
  type BinaryFile,
  type FileRequest,
  type FileResult,
} from "../lib/file-utilities";
import { copy, downloadBlob, downloadText, formatBytes } from "../lib/ui";
const props = defineProps<{ toolId: string }>();
const picker = ref<HTMLInputElement>(),
  files = shallowRef<(BinaryFile & { type: string })[]>([]),
  loading = ref(false),
  validation = ref("");
const mode = ref("pack"),
  baseMode = ref("encode"),
  dataUrl = ref(true),
  text = ref(""),
  filename = ref("decoded.bin"),
  algorithm = ref("SHA-256"),
  expected = ref(""),
  sheetIndex = ref(0),
  protect = ref(true);
const { result, busy, error, run, cancel } = useWorkerTask<
  FileRequest,
  FileResult
>(
  () =>
    new Worker(new URL("../workers/file-utilities.ts", import.meta.url), {
      type: "module",
    }),
  30000,
);
const working = computed(() => busy.value || loading.value);
const multiple = computed(
  () => props.toolId === "zip" && mode.value === "pack",
);
const decode = computed(
  () => props.toolId === "file-base64" && baseMode.value === "decode",
);
const accept = computed(() =>
  props.toolId === "docx-text"
    ? ".docx"
    : props.toolId === "xlsx-csv"
      ? ".xlsx"
      : props.toolId === "zip" && mode.value === "open"
        ? ".zip"
        : "*",
);
const outputText = computed(() =>
  result.value?.text
    ? props.toolId === "file-base64" && dataUrl.value
      ? "data:" +
        (files.value[0]?.type || "application/octet-stream") +
        ";base64," +
        result.value.text
      : result.value.text
    : "",
);
const sheet = computed(() => result.value?.sheets?.[sheetIndex.value]);
const columns = computed(() =>
  Math.min(
    12,
    Math.max(
      0,
      ...(sheet.value?.rows.slice(0, 30).map((row) => row.length) || []),
    ),
  ),
);
const hashMatch = computed(() =>
  !expected.value.trim() || !result.value?.text
    ? ""
    : expected.value.trim().toLowerCase() === result.value.text
      ? "校验一致"
      : "校验不一致",
);
function invalidate() {
  cancel();
  validation.value = "";
}
watch([mode, baseMode, algorithm, text], () => {
  invalidate();
  if (props.toolId === "zip") files.value = [];
});
async function select(chosen: FileList | File[] | null) {
  if (!chosen?.length || working.value) return;
  invalidate();
  const incoming = Array.from(chosen),
    retained = multiple.value ? files.value : [];
  if (
    (!multiple.value && incoming.length !== 1) ||
    retained.length + incoming.length > 100 ||
    incoming.reduce((n, f) => n + f.size, 0) +
      retained.reduce((n, f) => n + f.bytes.length, 0) >
      50 * 1024 * 1024
  ) {
    validation.value =
      "单文件工具每次选择 1 个；ZIP 打包最多 100 个文件，合计最多 50 MB";
    return;
  }
  if (
    (props.toolId === "docx-text" && !/\.docx$/i.test(incoming[0]!.name)) ||
    (props.toolId === "xlsx-csv" && !/\.xlsx$/i.test(incoming[0]!.name))
  ) {
    validation.value =
      "请选择 " + accept.value + " 文件，不支持旧版二进制格式或加密文档";
    return;
  }
  loading.value = true;
  try {
    files.value = [
      ...retained,
      ...(await Promise.all(
        incoming.map(async (file) => ({
          name: file.name,
          type: file.type,
          bytes: new Uint8Array(await file.arrayBuffer()),
        })),
      )),
    ];
    sheetIndex.value = 0;
  } catch {
    validation.value = "文件读取失败";
  } finally {
    loading.value = false;
    if (picker.value) picker.value.value = "";
  }
}
async function process() {
  validation.value = "";
  sheetIndex.value = 0;
  const kind: FileRequest["kind"] =
    props.toolId === "zip"
      ? mode.value === "pack"
        ? "zip-pack"
        : "zip-open"
      : props.toolId === "file-hash"
        ? "hash"
        : props.toolId === "file-base64"
          ? baseMode.value === "encode"
            ? "encode"
            : "decode"
          : props.toolId === "docx-text"
            ? "docx"
            : "xlsx";
  await run({
    kind,
    files: files.value.map(({ name, bytes }) => ({ name, bytes })),
    text: text.value,
    algorithm: algorithm.value,
  });
}
function downloadResult() {
  if (!result.value?.bytes) return;
  downloadBlob(
    new Blob([result.value.bytes.slice().buffer as ArrayBuffer], {
      type: result.value.mime || "application/zip",
    }),
    props.toolId === "zip"
      ? "xiaoyong-files.zip"
      : filename.value.replace(/[\\/\0]/g, "_") || "decoded.bin",
  );
}
function downloadEntry(file: BinaryFile) {
  downloadBlob(
    new Blob([file.bytes.slice().buffer as ArrayBuffer]),
    file.name.split("/").pop() || "file",
  );
}
function exportSheet() {
  try {
    downloadBlob(
      new Blob(["\uFEFF" + rowsToCsv(sheet.value!.rows, protect.value)], {
        type: "text/csv;charset=utf-8",
      }),
      (sheet.value!.name.replace(/[\\/\0]/g, "_") || "sheet") + ".csv",
    );
  } catch (e) {
    validation.value = e instanceof Error ? e.message : "导出失败";
  }
}
const notes = computed(() =>
  props.toolId === "zip"
    ? "支持普通 ZIP（存储 / Deflate），解压文件最多 20 MB、200 个条目，展开最多 50 MB；不支持加密、分卷、ZIP64、RAR 或 7z。打包重名文件会自动编号。"
    : props.toolId === "file-hash"
      ? "支持 SHA-256 / SHA-384 / SHA-512，文件最多 50 MB。哈希用于比较文件内容是否相同，不验证来源身份。"
      : props.toolId === "file-base64"
        ? "支持原始 Base64 与 Data URL，文件最多 10 MB。解码时填写合适的文件名和扩展名；生成文件不会自动打开。"
        : props.toolId === "docx-text"
          ? "仅支持未加密 .docx，最多 20 MB；提取正文和表格中的文字，不保留图片与排版，不识别扫描图片中的文字。"
          : "仅支持未加密 .xlsx，最多 20 MB、50 张表、合计 200,000 个单元格。导出值，不保留样式；公式使用文件中已保存的结果，不重新计算。日期转换为 ISO 格式。",
);
</script>
<template>
  <div class="tool-workspace">
    <input
      ref="picker"
      class="visually-hidden"
      type="file"
      :accept="accept"
      :multiple="multiple"
      aria-label="选择文件"
      @change="select(($event.target as HTMLInputElement).files)"
    />
    <div class="tool-toolbar">
      <div class="toolbar-options">
        <div v-if="toolId === 'zip'" class="mode-buttons">
          <button
            :disabled="working"
            :class="{ active: mode === 'pack' }"
            @click="mode = 'pack'"
          >
            打包 ZIP</button
          ><button
            :disabled="working"
            :class="{ active: mode === 'open' }"
            @click="mode = 'open'"
          >
            解压 ZIP
          </button>
        </div>
        <div v-if="toolId === 'file-base64'" class="mode-buttons">
          <button
            :disabled="working"
            :class="{ active: baseMode === 'encode' }"
            @click="baseMode = 'encode'"
          >
            文件 → Base64</button
          ><button
            :disabled="working"
            :class="{ active: baseMode === 'decode' }"
            @click="baseMode = 'decode'"
          >
            Base64 → 文件
          </button>
        </div>
        <label v-if="toolId === 'file-hash'" class="inline-label"
          >哈希算法<select v-model="algorithm" :disabled="working">
            <option>SHA-256</option>
            <option>SHA-384</option>
            <option>SHA-512</option>
          </select></label
        ><span
          v-if="!['zip', 'file-hash', 'file-base64'].includes(toolId)"
          class="muted"
          >{{
            toolId === "docx-text" ? "Word 正文提取" : "Excel 工作表导出"
          }}</span
        >
      </div>
      <button
        v-if="files.length && !decode"
        class="text-button"
        :disabled="working"
        @click="picker?.click()"
      >
        {{ multiple ? "继续添加" : "更换文件" }}
      </button>
    </div>
    <div class="file-workbench">
      <aside>
        <template v-if="decode"
          ><EditorPanel
            v-model="text"
            title="Base64 内容"
            placeholder="粘贴 Base64 或 data: 开头的内容"
            code />
          <div class="settings-panel">
            <label class="field-label"
              >下载文件名<input
                v-model="filename"
                placeholder="例如 photo.png、document.pdf"
                maxlength="150"
            /></label></div
        ></template>
        <template v-else
          ><button
            v-if="!files.length"
            class="upload-zone"
            :disabled="working"
            @click="picker?.click()"
            @dragover.prevent
            @drop.prevent="select($event.dataTransfer?.files || null)"
          >
            <span class="upload-illustration"
              ><Icon
                :name="loading ? 'LoaderCircle' : 'Files'"
                :class="{ spin: loading }"
                :size="38"
            /></span>
            <h2>{{ loading ? "正在读取文件…" : "选择要处理的文件" }}</h2>
            <p>点击选择，或拖拽文件到这里</p>
            <small>{{
              accept === "*" ? "按下方说明选择文件" : accept + " 格式"
            }}</small>
          </button>
          <div v-else class="settings-panel">
            <ol class="pdf-file-list">
              <li v-for="(file, i) in files" :key="i">
                <span class="file-order">{{ i + 1 }}</span>
                <div class="pdf-file-name">
                  <strong>{{ file.name }}</strong
                  ><small>{{ formatBytes(file.bytes.length) }}</small>
                </div>
                <button
                  class="icon-button"
                  :disabled="working"
                  :aria-label="'移除 ' + file.name"
                  @click="
                    files = files.filter((_, index) => index !== i);
                    invalidate();
                  "
                >
                  <Icon name="X" :size="17" />
                </button>
              </li>
            </ol>
            <label v-if="toolId === 'file-base64'" class="check-label"
              ><input v-model="dataUrl" type="checkbox" />添加 Data URL
              前缀（包含文件类型）</label
            >
          </div></template
        >
        <div class="action-row">
          <button
            class="button primary"
            :disabled="working || (!decode && !files.length)"
            @click="process"
          >
            <Icon
              :name="working ? 'LoaderCircle' : 'ArrowRight'"
              :class="{ spin: working }"
              :size="17"
            />{{
              working
                ? "处理中…"
                : toolId === "zip"
                  ? mode === "pack"
                    ? "打包 ZIP"
                    : "解压文件"
                  : toolId === "file-hash"
                    ? "计算文件哈希"
                    : toolId === "file-base64"
                      ? decode
                        ? "还原文件"
                        : "生成 Base64"
                      : toolId === "docx-text"
                        ? "提取 Word 文字"
                        : "读取 Excel 表格"
            }}</button
          ><button v-if="busy" class="button secondary" @click="cancel">
            取消
          </button>
        </div>
      </aside>
      <section class="file-results">
        <div v-if="!result" class="preview-placeholder">
          <Icon name="FileOutput" :size="40" />
          <p>{{ working ? "正在处理文件…" : "处理结果" }}</p>
          <small>完成后可在这里预览、复制或下载</small>
        </div>
        <template v-if="result?.bytes"
          ><div class="settings-panel file-output">
            <div>
              <strong>文件已生成</strong
              ><span>{{ formatBytes(result.bytes.length) }}</span>
            </div>
            <button class="button primary" @click="downloadResult">
              下载文件
            </button>
          </div></template
        >
        <template v-if="result?.files"
          ><div class="settings-panel">
            <h2>解压结果 · {{ result.files.length }} 个文件</h2>
            <ol class="pdf-file-list">
              <li v-for="file in result.files" :key="file.name">
                <div class="pdf-file-name">
                  <strong>{{ file.name }}</strong
                  ><small>{{ formatBytes(file.bytes.length) }}</small>
                </div>
                <button
                  class="button secondary"
                  :aria-label="'下载 ' + file.name"
                  @click="downloadEntry(file)"
                >
                  下载
                </button>
              </li>
            </ol>
            <p v-if="!result.files.length" class="muted">压缩包内没有文件</p>
          </div></template
        >
        <template v-if="result?.text"
          ><EditorPanel
            :model-value="outputText"
            title="处理结果"
            readonly
            code
            :filename="toolId === 'file-base64' ? 'base64.txt' : 'result.txt'"
          />
          <div v-if="toolId === 'file-hash'" class="settings-panel">
            <label class="field-label"
              >对比已有哈希（可选）<input
                v-model="expected"
                placeholder="粘贴需要核对的哈希值"
            /></label>
            <p
              v-if="hashMatch"
              :class="
                hashMatch === '校验一致' ? 'success-message' : 'error-message'
              "
              role="status"
            >
              {{ hashMatch }}
            </p>
          </div></template
        >
        <template v-if="result?.sheets"
          ><div class="tool-toolbar">
            <label class="inline-label"
              >工作表<select v-model.number="sheetIndex">
                <option v-for="(entry, i) in result.sheets" :value="i" :key="i">
                  {{ entry.name }}
                </option>
              </select></label
            ><label class="check-label"
              ><input
                v-model="protect"
                type="checkbox"
              />防止文本被识别为公式</label
            ><button
              class="button primary"
              :disabled="!sheet?.rows.length"
              @click="exportSheet"
            >
              下载 CSV
            </button>
          </div>
          <div class="data-table-scroll">
            <table v-if="sheet?.rows.length" class="data-table">
              <thead>
                <tr>
                  <th>行</th>
                  <th v-for="n in columns" :key="n">第 {{ n }} 列</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="(row, i) in sheet.rows.slice(0, 30)" :key="i">
                  <th>{{ i + 1 }}</th>
                  <td v-for="n in columns" :key="n">
                    {{
                      row[n - 1] instanceof Date
                        ? (row[n - 1] as Date).toISOString()
                        : row[n - 1]
                    }}
                  </td>
                </tr>
              </tbody>
            </table>
            <p v-else class="muted settings-panel">空工作表</p>
          </div>
          <div class="workspace-footnote">
            预览前 30 行、12 列；下载包含整张工作表。
          </div></template
        >
      </section>
    </div>
    <p v-if="validation || error" class="error-message" role="alert">
      {{ validation || error }}
    </p>
    <div class="workspace-footnote">
      <Icon name="Info" :size="15" />{{ notes }}
    </div>
  </div>
</template>
