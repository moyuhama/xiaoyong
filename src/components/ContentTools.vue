<script setup lang="ts">
import { computed, onUnmounted, ref, watch } from "vue";
import DOMPurify from "dompurify";
import Icon from "./Icon.vue";
import EditorPanel from "./EditorPanel.vue";
import { csvToJson, jsonToCsv } from "../lib/data-tools";
import { copy, downloadText } from "../lib/ui";

const props = defineProps<{ toolId: string }>();
const input = ref(""),
  result = ref(""),
  error = ref("");
const csvMode = ref("to-json"),
  delimiter = ref(","),
  protectFormulas = ref(true);
const previewMode = ref("preview"),
  html = ref(""),
  busy = ref(false);
const outputName = computed(() =>
  csvMode.value === "to-json"
    ? "result.json"
    : delimiter.value === "\t"
      ? "result.tsv"
      : "result.csv",
);
let worker: Worker | undefined;
let timeout: ReturnType<typeof setTimeout> | undefined;
let debounce: ReturnType<typeof setTimeout> | undefined;
function cancelPreview() {
  worker?.terminate();
  worker = undefined;
  clearTimeout(timeout);
  clearTimeout(debounce);
  busy.value = false;
}
function renderMarkdown() {
  cancelPreview();
  html.value = "";
  error.value = "";
  if (!input.value) return;
  if (input.value.length > 100000) {
    error.value = "Markdown 请控制在 100,000 字符以内";
    return;
  }
  busy.value = true;
  debounce = setTimeout(() => {
    worker = new Worker(new URL("../workers/markdown.ts", import.meta.url), {
      type: "module",
    });
    worker.onmessage = (event) => {
      cancelPreview();
      if (event.data.error) {
        error.value = event.data.error;
        return;
      }
      html.value = DOMPurify.sanitize(event.data.html, {
        ALLOWED_TAGS: [
          "p",
          "br",
          "hr",
          "h1",
          "h2",
          "h3",
          "h4",
          "h5",
          "h6",
          "strong",
          "em",
          "del",
          "blockquote",
          "pre",
          "code",
          "ul",
          "ol",
          "li",
          "table",
          "thead",
          "tbody",
          "tr",
          "th",
          "td",
          "a",
          "input",
        ],
        ALLOWED_ATTR: ["type", "checked", "disabled", "start", "align"],
      });
    };
    worker.onerror = () => {
      cancelPreview();
      error.value = "预览未能完成，请重试";
    };
    timeout = setTimeout(() => {
      cancelPreview();
      error.value = "解析超过 2 秒，请缩短内容后重试";
    }, 2000);
    worker.postMessage(input.value);
  }, 200);
}
function convert() {
  result.value = "";
  error.value = "";
  try {
    result.value =
      csvMode.value === "to-json"
        ? csvToJson(input.value, delimiter.value)
        : jsonToCsv(input.value, delimiter.value, protectFormulas.value);
  } catch (err) {
    error.value = err instanceof Error ? err.message : "转换失败，请检查输入";
  }
}
function example() {
  if (props.toolId === "markdown")
    input.value =
      "# 一周计划\n\n把大任务拆成 **小步骤**。\n\n- [x] 整理资料\n- [ ] 完成初稿\n- [ ] 检查结果\n\n## 工具清单\n\n| 工具 | 用途 |\n| --- | --- |\n| Markdown | 整理笔记 |\n| CSV / JSON | 转换数据 |\n\n> 每次专注解决一件事。\n\n~~~js\nconst message = '你好，小用';\nconsole.log(message);\n~~~";
  else if (csvMode.value === "to-json") {
    const d = delimiter.value;
    input.value = [
      "姓名" + d + "城市" + d + "备注",
      "小林" + d + "杭州" + d + '"喜欢咖啡，偶尔喝茶"',
      "小周" + d + "成都" + d + '"第一行\n第二行"',
    ].join("\n");
  } else
    input.value =
      '[\n  {"姓名":"小林","城市":"杭州","数量":3},\n  {"姓名":"小周","城市":"成都","数量":5}\n]';
}
watch([input, csvMode, delimiter, protectFormulas], () => {
  result.value = "";
  error.value = "";
  if (props.toolId === "markdown") renderMarkdown();
});
onUnmounted(cancelPreview);
</script>

<template>
  <div class="tool-workspace">
    <div class="tool-toolbar">
      <div v-if="toolId === 'markdown'" class="segmented">
        <button
          :class="{ active: previewMode === 'preview' }"
          @click="previewMode = 'preview'"
        >
          预览
        </button>
        <button
          :class="{ active: previewMode === 'html' }"
          @click="previewMode = 'html'"
        >
          HTML 源码
        </button>
      </div>
      <div v-else class="toolbar-options">
        <div class="mode-buttons">
          <button
            :class="{ active: csvMode === 'to-json' }"
            @click="csvMode = 'to-json'"
          >
            CSV → JSON</button
          ><button
            :class="{ active: csvMode === 'to-csv' }"
            @click="csvMode = 'to-csv'"
          >
            JSON → CSV
          </button>
        </div>
        <label class="inline-label"
          >分隔符<select v-model="delimiter">
            <option value=",">逗号 ,</option>
            <option value=";">分号 ;</option>
            <option value="&#9;">制表符 Tab</option>
          </select></label
        >
      </div>
      <div class="toolbar-actions">
        <button class="text-button" @click="example">填入示例</button>
        <button class="icon-button" aria-label="清空输入" @click="input = ''">
          <Icon name="RotateCcw" :size="17" />
        </button>
      </div>
    </div>
    <div v-if="toolId === 'markdown'" class="action-row">
      <button
        class="button secondary"
        :disabled="!input"
        @click="downloadText(input, 'document.md')"
      >
        <Icon name="Download" :size="16" />下载 Markdown
      </button>
      <button
        class="button secondary"
        :disabled="!html || busy"
        @click="
          downloadText(
            '<!doctype html><html lang=&quot;zh-CN&quot;><meta charset=&quot;utf-8&quot;><title>Markdown 文档</title><body>' +
              html +
              '</body></html>',
            'document.html',
          )
        "
      >
        下载 HTML
      </button>
      <button class="text-button" :disabled="!html || busy" @click="copy(html)">
        复制 HTML
      </button>
    </div>
    <div v-else class="action-row">
      <button class="button primary" @click="convert">
        开始转换<Icon name="ArrowRight" :size="16" />
      </button>
      <label v-if="csvMode === 'to-csv'" class="check-label"
        ><input
          v-model="protectFormulas"
          type="checkbox"
        />防止表格执行公式</label
      >
    </div>
    <div class="editor-grid content-editor-grid">
      <EditorPanel
        v-model="input"
        :title="
          toolId === 'markdown'
            ? 'Markdown 内容'
            : csvMode === 'to-json'
              ? 'CSV 内容'
              : 'JSON 内容'
        "
        placeholder="在这里粘贴内容，或先试试示例…"
        code
      />
      <section
        v-if="toolId === 'markdown' && previewMode === 'preview'"
        class="markdown-panel"
      >
        <div class="panel-heading">
          <h2>预览效果</h2>
          <span v-if="busy" role="status" class="muted">正在更新…</span>
        </div>
        <div v-if="html" class="markdown-body" v-html="html"></div>
        <p v-else class="preview-empty">输入 Markdown，预览会自动更新</p>
      </section>
      <EditorPanel
        v-else
        :model-value="toolId === 'markdown' ? html : result"
        :title="toolId === 'markdown' ? 'HTML 源码' : '转换结果'"
        :filename="toolId === 'markdown' ? 'preview.html' : outputName"
        placeholder="转换结果会显示在这里"
        readonly
        code
      />
    </div>
    <div v-if="error" role="alert" class="error-message">{{ error }}</div>

    <div class="workspace-footnote">
      <Icon name="Info" :size="15" />
      <span v-if="toolId === 'markdown'"
        >支持标题、列表、表格和代码块；图片与链接跳转不参与预览。</span
      >
      <span v-else-if="csvMode === 'to-json'"
        >第一行为列名，所有值保留为字符串；支持引号内换行、逗号与双引号。最多
        10,000 行、1,000 列。</span
      >
      <span v-else
        >嵌套对象转为 JSON 文本，空值转为空单元格。公式保护会给 =、+、-、@
        开头的文本加单引号。</span
      >
    </div>
  </div>
</template>
