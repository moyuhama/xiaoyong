<script setup lang="ts">
import { computed, ref, watch } from "vue";
import EditorPanel from "./EditorPanel.vue";
import { encodeText } from "../lib/transform";
import { copy, downloadText } from "../lib/ui";

type ResultKind = "uri" | "url" | "base64";
const mode = ref<"url" | "base64">("url"),
  input = ref(""),
  decoding = ref(false),
  selected = ref<ResultKind>("uri"),
  message = ref("");
const outputs = ref<
  Partial<Record<ResultKind, { value: string; error: string }>>
>({});
const panels = computed(() =>
  mode.value === "url"
    ? [
        {
          kind: "uri" as const,
          title: "完整 URL 结果",
          method: decoding.value ? "decodeURI" : "encodeURI",
          note: decoding.value
            ? "还原完整 URL；保留 %3F、%26 等已编码的分隔符。"
            : "适合完整网址，保留 : / ? & = # 等 URL 分隔符。",
        },
        {
          kind: "url" as const,
          title: "参数值结果",
          method: decoding.value ? "decodeURIComponent" : "encodeURIComponent",
          note: decoding.value
            ? "还原参数值，同时还原已编码的 URL 分隔符。"
            : "适合单个参数值，同时编码 : / ? & = # 等 URL 分隔符。",
        },
      ]
    : [
        {
          kind: "base64" as const,
          title: "Base64 结果",
          method: decoding.value ? "Base64 解码" : "Base64 编码",
          note: "按 UTF-8 处理文字，支持中文与 emoji。",
        },
      ],
);
const chosen = computed(() => outputs.value[selected.value]);
const filename = computed(
  () => selected.value + (decoding.value ? "-decoded.txt" : "-encoded.txt"),
);

function invalidate() {
  outputs.value = {};
  message.value = "";
}
watch(input, invalidate, { flush: "sync" });
watch(
  mode,
  () => {
    invalidate();
    decoding.value = false;
    selected.value = mode.value === "url" ? "uri" : "base64";
  },
  { flush: "sync" },
);

function run(decode: boolean) {
  invalidate();
  decoding.value = decode;
  if (!input.value) {
    message.value = "请输入需要处理的内容";
    return;
  }
  if (input.value.length > 200000) {
    message.value = "内容请控制在 200,000 字符以内";
    return;
  }
  for (const panel of panels.value) {
    try {
      outputs.value[panel.kind] = {
        value: encodeText(input.value, panel.kind, decode),
        error: "",
      };
    } catch {
      outputs.value[panel.kind] = {
        value: "",
        error: decode
          ? mode.value === "url"
            ? "无法解码：请检查 % 后是否有两位十六进制字符，以及 UTF-8 序列是否完整。"
            : "无法解码：请检查 Base64 内容是否完整，且解码后为 UTF-8 文本。"
          : "无法编码：输入包含不完整的 Unicode 字符。",
      };
    }
  }
}
function swap() {
  if (!chosen.value?.value || chosen.value.error) return;
  const reverse = !decoding.value;
  input.value = chosen.value.value;
  run(reverse);
}
function clear() {
  input.value = "";
  invalidate();
}
function example() {
  input.value =
    mode.value === "url"
      ? "https://example.com/搜索?q=小用 工具箱&tag=中文😀#结果"
      : "你好，小用工具箱 😀";
  run(false);
}
</script>

<template>
  <div class="tool-workspace encoding-workspace">
    <div class="tool-toolbar">
      <div class="segmented" role="group" aria-label="编码类型">
        <button
          :class="{ active: mode === 'url' }"
          :aria-pressed="mode === 'url'"
          @click="mode = 'url'"
        >
          URL 编解码
        </button>
        <button
          :class="{ active: mode === 'base64' }"
          :aria-pressed="mode === 'base64'"
          @click="mode = 'base64'"
        >
          Base64 编解码
        </button>
      </div>
      <button class="text-button" @click="example">填入示例</button>
    </div>

    <div
      class="encoding-input"
      @keydown.ctrl.enter.prevent="run(decoding)"
      @keydown.meta.enter.prevent="run(decoding)"
    >
      <EditorPanel
        v-model="input"
        title="输入内容"
        :placeholder="
          mode === 'url'
            ? '粘贴完整网址、参数值或已编码内容…'
            : '输入文字或 Base64 内容…'
        "
        code
      />
    </div>

    <div
      class="action-row encoding-actions"
      role="group"
      aria-label="编解码操作"
    >
      <button class="button primary" @click="run(false)">
        {{ mode === "url" ? "URL 编码" : "Base64 编码" }}
      </button>
      <button class="button primary" @click="run(true)">
        {{ mode === "url" ? "URL 解码" : "Base64 解码" }}
      </button>
      <button
        class="button secondary"
        :disabled="!chosen?.value || !!chosen.error"
        title="将选定结果放回输入，并反向转换"
        @click="swap"
      >
        交换内容
      </button>
      <button class="button secondary" @click="clear">清空</button>
      <div class="encoding-result-actions">
        <label v-if="mode === 'url'" class="inline-label"
          >操作结果<select
            v-model="selected"
            aria-label="选择复制、下载或交换的结果"
          >
            <option value="uri">完整 URL</option>
            <option value="url">参数值</option>
          </select></label
        >
        <button
          class="button secondary"
          :disabled="!chosen?.value || !!chosen.error"
          @click="copy(chosen!.value)"
        >
          复制结果
        </button>
        <button
          class="button secondary"
          :disabled="!chosen?.value || !!chosen.error"
          @click="downloadText(chosen!.value, filename)"
        >
          下载结果
        </button>
      </div>
    </div>
    <p v-if="message" role="alert" class="error-message">{{ message }}</p>

    <div class="encoding-results">
      <section
        v-for="panel in panels"
        :key="panel.kind"
        class="encoding-result"
      >
        <div class="encoding-explanation">
          <code>{{ panel.method }}</code
          ><span>{{ panel.note }}</span>
        </div>
        <EditorPanel
          :model-value="outputs[panel.kind]?.value || ''"
          :title="panel.title"
          placeholder="点击上方编码或解码按钮生成结果"
          :filename="panel.kind + (decoding ? '-decoded.txt' : '-encoded.txt')"
          readonly
          code
        />
        <p v-if="outputs[panel.kind]?.error" role="alert" class="error-message">
          {{ outputs[panel.kind]?.error }}
        </p>
      </section>
    </div>
    <div class="workspace-footnote">
      {{
        mode === "url"
          ? "URL 编码采用 UTF-8。解码时 + 保留原样，不自动替换为空格。"
          : "Base64 是编码方式，不是加密。"
      }}
      Ctrl / ⌘ + Enter 再次执行当前操作。
    </div>
  </div>
</template>

<style scoped>
.encoding-workspace .encoding-input,
.encoding-workspace .encoding-results {
  display: flex;
  flex-direction: column;
  min-width: 0;
}
.encoding-workspace .encoding-input :deep(.code-editor-host) {
  height: 200px;
  min-height: 120px;
}
.encoding-workspace .encoding-result :deep(.code-editor-host) {
  height: 160px;
  min-height: 100px;
}
.encoding-workspace :deep(.editor-expanded .code-editor-host) {
  height: auto;
  flex: 1;
}
.encoding-workspace .encoding-actions {
  gap: 8px;
  align-items: center;
}
.encoding-result-actions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  margin-left: auto;
}
.encoding-result-actions select {
  max-width: 140px;
}
.encoding-result {
  min-width: 0;
}
.encoding-result + .encoding-result {
  border-top: 1px solid var(--border);
}
.encoding-explanation {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px 16px;
  padding: 14px;
  background: var(--soft-bg);
  border-bottom: 1px solid var(--border);
}
.encoding-explanation code {
  color: var(--primary);
  font-size: 14px;
  font-weight: 600;
}
.encoding-explanation span {
  color: var(--subtle);
  font-size: 12px;
}
@media (max-width: 800px) {
  .encoding-result-actions {
    width: 100%;
    margin: 6px 0 0;
  }
  .encoding-workspace .encoding-input :deep(.code-editor-host) {
    height: 180px;
  }
}
</style>
