<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from "vue";
import JSONEditor from "jsoneditor";
import "jsoneditor/dist/jsoneditor.css";
import Icon from "./Icon.vue";
import { processJson, type JsonAction } from "../lib/json-tools";
import { convertYaml } from "../lib/config-tools";
import { jsonTypes } from "../lib/popular-text";
import { copy, downloadText, notify } from "../lib/ui";

const sourceHost = ref<HTMLDivElement>(),
  resultHost = ref<HTMLDivElement>();
const fileInput = ref<HTMLInputElement>();
const source = ref(""),
  output = ref(""),
  error = ref(""),
  status = ref("");
const indent = ref(2),
  realtime = ref(true),
  outerQuotes = ref(false);
const resultMode = ref<"view" | "code">("code"),
  structured = ref(false),
  ready = ref(false);
const treeView = computed(
  () => resultMode.value === "view" && (!ready.value || structured.value),
);
const extra = ref("yaml"),
  filename = ref("formatted.json"),
  sourceName = ref("输入 JSON");
const lastAction = ref<JsonAction | "yaml" | "types">("format");
const chars = computed(() => source.value.length.toLocaleString());
const languages = {
  "zh-CN": {
    collapseAll: "折叠所有字段",
    expandAll: "展开所有字段",
    searchTitle: "搜索字段或值",
    searchNextResultTitle: "下一个结果（Enter）",
    searchPreviousResultTitle: "上一个结果（Shift + Enter）",
  },
};
let inputEditor: JSONEditor | undefined, resultEditor: JSONEditor | undefined;
let delay: ReturnType<typeof setTimeout> | undefined,
  disposed = false,
  importVersion = 0;

function syncResult() {
  if (!resultEditor) return;
  const mode = structured.value ? resultMode.value : "code";
  // A non-JSON text result cannot be parsed while changing to tree mode.
  if (mode === "view" && resultEditor.getMode() !== "view")
    resultEditor.setText(output.value || "null");
  if (resultEditor.getMode() !== mode) resultEditor.setMode(mode);
  if (mode === "view") resultEditor.setText(output.value || "null");
  else resultEditor.setText(output.value);
  resultHost.value
    ?.querySelector("textarea")
    ?.setAttribute("aria-label", "JSON 处理结果");
  if (resultEditor.aceEditor)
    resultEditor.aceEditor.setOptions({
      fontSize: 14,
      wrap: true,
      readOnly: true,
    });
  nextTick(() => resultEditor?.aceEditor?.resize());
}
function resetResult() {
  output.value = "";
  ready.value = false;
  error.value = "";
  status.value = "";
  structured.value = false;
}
function run(action: JsonAction | "yaml" | "types" = "format") {
  clearTimeout(delay);
  resetResult();
  if (!source.value.trim() && action !== "escape" && action !== "unescape")
    return;
  try {
    if (source.value.length > 2_000_000)
      throw new Error("输入请控制在 2,000,000 字符以内");
    output.value =
      action === "yaml"
        ? convertYaml(source.value, false)
        : action === "types"
          ? jsonTypes(JSON.parse(source.value))
          : processJson(source.value, action, indent.value, outerQuotes.value);
    try {
      JSON.parse(output.value);
      structured.value = output.value.length <= 200000;
    } catch {
      structured.value = false;
    }
    if (action === "escape" || action === "yaml" || action === "types")
      structured.value = false;
    lastAction.value = action;
    filename.value =
      action === "yaml"
        ? "result.yaml"
        : action === "types"
          ? "types.ts"
          : action === "escape" || action === "unescape"
            ? "result.txt"
            : action === "minify"
              ? "minified.json"
              : "formatted.json";
    status.value = {
      format: "JSON 校验通过",
      minify: "已压缩",
      escape: "已转义",
      unescape: "已去除转义",
      yaml: "已转换为 YAML",
      types: "已生成 TypeScript 类型",
    }[action];
    ready.value = true;
    syncResult();
  } catch (e) {
    error.value = e instanceof Error ? e.message : "处理失败，请检查 JSON";
  }
}
function changed(value: string) {
  source.value = value;
  resetResult();
  clearTimeout(delay);
  if (realtime.value && value.trim())
    delay = setTimeout(() => run("format"), 300);
}
function setSource(value: string) {
  inputEditor?.updateText(value);
  changed(value);
}
function example() {
  sourceName.value = "输入 JSON";
  setSource(
    '{"name":"小用工具箱","version":1,"tools":[{"name":"时间戳转换","enabled":true},{"name":"JSON 格式化","enabled":true}],"settings":{"language":"zh-CN","theme":"light"}}',
  );
  run("format");
}
async function importFile(event: Event) {
  const input = event.target as HTMLInputElement,
    file = input.files?.[0];
  input.value = "";
  if (!file) return;
  if (file.size > 2 * 1024 * 1024) return notify("文件请控制在 2 MB 以内");
  const version = ++importVersion;
  try {
    const text = new TextDecoder("utf-8", { fatal: true }).decode(
      await file.arrayBuffer(),
    );
    if (disposed || version !== importVersion) return;
    if (text.includes("\0")) throw new Error();
    sourceName.value = file.name;
    setSource(text);
    run("format");
  } catch {
    if (!disposed) notify("无法读取，请选择 UTF-8 文本文件");
  }
}
watch(resultMode, syncResult);
watch(indent, () => {
  if (ready.value && lastAction.value === "format") run("format");
});
watch(outerQuotes, () => {
  if (ready.value && lastAction.value === "escape") run("escape");
});
watch(realtime, (value) => {
  clearTimeout(delay);
  if (value) run("format");
});
onMounted(() => {
  inputEditor = new JSONEditor(sourceHost.value!, {
    mode: "code",
    language: "zh-CN",
    languages,
    mainMenuBar: true,
    statusBar: true,
    enableSort: false,
    enableTransform: false,
    onChangeText: changed,
    onError: (e) => {
      error.value = e.message;
    },
  });
  inputEditor.setText("");
  inputEditor.aceEditor.setOptions({
    fontSize: 14,
    wrap: true,
    showPrintMargin: false,
  });
  sourceHost.value
    ?.querySelector("textarea")
    ?.setAttribute("aria-label", "输入 JSON");
  resultEditor = new JSONEditor(resultHost.value!, {
    mode: "code",
    language: "zh-CN",
    languages,
    mainMenuBar: true,
    navigationBar: true,
    enableSort: false,
    enableTransform: false,
    onEditable: () => false,
    onError: (e) => {
      error.value = e.message;
    },
  });
  syncResult();
});
onUnmounted(() => {
  disposed = true;
  importVersion++;
  clearTimeout(delay);
  inputEditor?.destroy();
  resultEditor?.destroy();
});
</script>

<template>
  <div
    class="tool-workspace json-tool"
    @keydown.ctrl.enter.prevent="run('format')"
    @keydown.meta.enter.prevent="run('format')"
  >
    <div class="json-layout-toolbar">
      <div class="segmented" role="group" aria-label="JSON 显示方式">
        <button
          :class="{ active: !treeView }"
          :aria-pressed="!treeView"
          @click="resultMode = 'code'"
        >
          上下双框
        </button>
        <button
          :class="{ active: treeView }"
          :aria-pressed="treeView"
          :disabled="ready && !structured"
          :title="
            ready && !structured
              ? '当前结果不适合树形展示，请切回 JSON 格式化'
              : '展开层级、折叠和搜索字段'
          "
          @click="resultMode = 'view'"
        >
          树结构
        </button>
      </div>
    </div>
    <div class="json-actions" aria-label="JSON 操作">
      <button class="button primary" @click="run('format')">格式化校验</button>
      <button class="button secondary" @click="run('minify')">压缩</button>
      <button class="button secondary" @click="run('escape')">转义</button>
      <button class="button secondary" @click="run('unescape')">
        去除转义
      </button>
      <span class="json-action-divider"></span>
      <label class="json-select"
        >转换为<select v-model="extra">
          <option value="yaml">YAML</option>
          <option value="types">TypeScript</option>
        </select></label
      >
      <button
        class="button secondary"
        @click="run(extra === 'yaml' ? 'yaml' : 'types')"
      >
        转换
      </button>
    </div>
    <div class="json-options">
      <label
        >缩进<select v-model="indent" aria-label="JSON 缩进">
          <option :value="2">2 空格</option>
          <option :value="4">4 空格</option>
        </select></label
      >
      <label><input v-model="realtime" type="checkbox" />实时校验</label>
      <label
        ><input
          v-model="outerQuotes"
          type="checkbox"
        />转义时保留外层引号</label
      >
      <span>Ctrl / ⌘ + Enter 格式化</span>
    </div>
    <p v-if="error" class="json-error" role="alert">{{ error }}</p>
    <div class="json-columns">
      <section class="json-column" aria-label="JSON 输入区">
        <div class="json-panel-head">
          <strong :title="sourceName">{{ sourceName }}</strong>
          <div>
            <button @click="fileInput?.click()">打开文件</button
            ><button @click="example">示例</button
            ><button @click="setSource('')">清空</button>
          </div>
        </div>
        <input
          ref="fileInput"
          type="file"
          accept=".json,.txt,application/json,text/plain"
          hidden
          @change="importFile"
        />
        <div ref="sourceHost" class="json-editor-host"></div>
        <div class="json-panel-foot">
          <span>{{ chars }} 字符</span
          ><button :disabled="!source" @click="copy(source)">复制输入</button>
        </div>
      </section>
      <section class="json-column" aria-label="JSON 结果区">
        <div class="json-panel-head">
          <strong>{{ treeView ? "树结构" : "处理结果" }}</strong>
          <div>
            <button :disabled="!ready" @click="copy(output)">
              <Icon name="Copy" :size="14" />复制</button
            ><button :disabled="!ready" @click="downloadText(output, filename)">
              <Icon name="Download" :size="14" />下载
            </button>
          </div>
        </div>
        <div class="json-result-body" :class="{ 'tree-mode': treeView }">
          <div
            ref="resultHost"
            class="json-editor-host"
            :class="{ 'result-hidden': !ready }"
          ></div>
          <div v-if="!ready" class="json-placeholder">
            <Icon name="Braces" :size="30" /><strong>{{
              error ? "请先修正 JSON 内容" : "在上方输入 JSON"
            }}</strong
            ><span>{{
              error
                ? "错误详情显示在操作栏下方"
                : treeView
                  ? "格式化后可展开层级、折叠和搜索字段"
                  : "格式化后的文本会显示在下方，可复制或下载"
            }}</span
            ><button v-if="!error" class="text-button" @click="example">
              载入示例查看效果
            </button>
          </div>
        </div>
        <div class="json-panel-foot">
          <span role="status">{{ status || "等待输入" }}</span
          ><button :disabled="!ready" @click="setSource(output)">
            结果用作输入
          </button>
        </div>
      </section>
    </div>
  </div>
</template>

<style scoped>
.json-tool {
  overflow: hidden;
  border-radius: 10px;
}
.json-layout-toolbar {
  display: flex;
  padding: 12px 16px;
  border-bottom: 1px solid var(--border);
  background: var(--soft-bg);
}
.json-actions {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
  padding: 16px;
  border-bottom: 1px solid var(--border);
}
.json-actions .button {
  font-size: 13px;
  min-height: 38px;
  padding: 8px 14px;
}
.json-action-divider {
  height: 24px;
  border-left: 1px solid var(--border);
  margin: 0 4px;
}
.json-select {
  display: flex;
  align-items: center;
  gap: 7px;
  font-size: 13px;
  color: var(--subtle);
}
.json-select select,
.json-options select {
  padding: 7px 10px;
  border: 1px solid var(--border);
  background: var(--surface);
  border-radius: 5px;
  font-size: 13px;
  color: var(--text);
}
.json-options {
  display: flex;
  align-items: center;
  gap: 20px;
  flex-wrap: wrap;
  padding: 10px 16px;
  font-size: 12px;
  color: var(--subtle);
  border-bottom: 1px solid var(--border);
}
.json-options label {
  display: flex;
  align-items: center;
  gap: 7px;
}
.json-options input {
  accent-color: var(--primary);
}
.json-options > span {
  margin-left: auto;
}
.json-columns {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
}
.json-column {
  min-width: 0;
}
.json-column + .json-column {
  border-top: 1px solid var(--border);
}
.json-panel-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  min-height: 46px;
  padding: 8px 12px;
  background: var(--code-bg);
  border-bottom: 1px solid var(--border);
  font-size: 13px;
}
.json-panel-head strong {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 13px;
}
.json-panel-head > div {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-shrink: 0;
}
.json-panel-head button,
.json-panel-foot button {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  border: 0;
  background: transparent;
  padding: 4px 0;
  font-size: 12px;
  color: var(--primary);
  cursor: pointer;
  white-space: nowrap;
}
.json-panel-head button:disabled,
.json-panel-foot button:disabled {
  opacity: 0.4;
  cursor: default;
}
.json-editor-host {
  height: 280px;
  min-width: 0;
}
.tree-mode .json-editor-host {
  height: 440px;
}
.json-editor-host :deep(div.jsoneditor) {
  border: 0;
}
.json-editor-host :deep(.jsoneditor-menu) {
  background: var(--tint);
  border-bottom-color: var(--border);
}
.json-editor-host :deep(.jsoneditor-menu > button) {
  filter: brightness(0.45);
}
.json-editor-host :deep(.jsoneditor-search input) {
  color: var(--text);
  background: var(--surface);
}
.json-editor-host :deep(.jsoneditor-menu a.jsoneditor-poweredBy) {
  color: var(--subtle);
}
.json-editor-host :deep(.ace-jsoneditor),
.json-editor-host :deep(div.jsoneditor-tree),
.json-editor-host :deep(.ace-jsoneditor .ace_scroller) {
  background: var(--surface);
  color: var(--text);
}
.json-editor-host :deep(.ace-jsoneditor .ace_gutter) {
  background: var(--code-bg);
  color: var(--subtle);
}
.json-editor-host :deep(.jsoneditor-field),
.json-editor-host :deep(.jsoneditor-readonly),
.json-editor-host :deep(.jsoneditor-value),
.json-editor-host :deep(.jsoneditor-separator) {
  color: var(--text);
}
.json-editor-host :deep(.jsoneditor-string),
.json-editor-host :deep(.ace-jsoneditor .ace_string) {
  color: var(--primary);
}
.json-editor-host :deep(.jsoneditor-number),
.json-editor-host :deep(.ace-jsoneditor .ace_numeric) {
  color: #b87542;
}
.json-editor-host :deep(.jsoneditor-boolean),
.json-editor-host :deep(.jsoneditor-null),
.json-editor-host :deep(.ace-jsoneditor .ace_constant.ace_language) {
  color: #a577bd;
}
.json-editor-host :deep(.ace-jsoneditor .ace_variable) {
  color: var(--text);
}
.json-editor-host :deep(.ace-jsoneditor .ace_cursor) {
  color: var(--text);
}
.json-editor-host :deep(.ace-jsoneditor .ace_marker-layer .ace_active-line) {
  background: var(--soft-bg);
}
.json-editor-host :deep(.ace-jsoneditor .ace_gutter-active-line) {
  background: var(--tint);
}
.json-editor-host :deep(.jsoneditor-search .jsoneditor-frame) {
  background: var(--surface);
}
:global([data-theme="dark"] .json-tool .jsoneditor-menu > button) {
  filter: none;
}
:global([data-theme="dark"] .json-tool .jsoneditor-tree button) {
  filter: invert(0.8);
}
.json-editor-host :deep(.jsoneditor-navigation-bar),
.json-editor-host :deep(.jsoneditor-statusbar) {
  background: var(--code-bg);
  border-color: var(--border);
}
.json-editor-host :deep(.jsoneditor-tree) {
  font-size: 14px;
}
.json-editor-host :deep(.jsoneditor-field),
.json-editor-host :deep(.jsoneditor-value) {
  font-size: 14px;
}
.json-result-body {
  position: relative;
}
.result-hidden {
  visibility: hidden;
}
.json-placeholder {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-direction: column;
  gap: 12px;
  color: var(--subtle);
  font-size: 12px;
  padding: 20px;
  text-align: center;
}
.json-placeholder strong {
  font-size: 14px;
  color: var(--text);
  font-weight: 500;
}
.json-placeholder svg {
  color: var(--primary);
}
.json-panel-foot {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 12px;
  border-top: 1px solid var(--border);
  color: var(--subtle);
  font-size: 12px;
}
.json-error {
  padding: 12px 16px;
  margin: 0;
  color: var(--danger);
  background: var(--danger-bg);
  border-bottom: 1px solid var(--border);
  font-size: 13px;
  overflow-wrap: anywhere;
}
@media (max-width: 900px) {
  .json-editor-host {
    height: 260px;
  }
  .tree-mode .json-editor-host {
    height: 360px;
  }
  .json-options {
    gap: 12px;
  }
  .json-options > span {
    display: none;
  }
}
@media (max-width: 480px) {
  .json-actions {
    padding: 12px;
    gap: 6px;
  }
  .json-actions .button {
    padding: 8px 10px;
  }
  .json-action-divider {
    display: none;
  }
  .json-panel-head {
    gap: 6px;
  }
  .json-panel-head > div {
    gap: 8px;
  }
  .json-options {
    padding: 10px 12px;
  }
}
</style>
