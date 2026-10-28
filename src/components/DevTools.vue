<script setup lang="ts">
import { computed, onUnmounted, ref, watch } from "vue";
import Icon from "./Icon.vue";
import EditorPanel from "./EditorPanel.vue";
import { encodeText, generatePassword } from "../lib/transform";
import { processJson, type JsonAction } from "../lib/json-tools";
import { copy, downloadText, notify } from "../lib/ui";
const props = defineProps<{ toolId: string }>();
const input = ref(""),
  result = ref(""),
  error = ref("");
const indent = ref("2"),
  encodingMode = ref("base64"),
  decode = ref(false);
const jsonQuotes = ref(false),
  jsonDone = ref(false),
  jsonAction = ref<JsonAction>("format");
const jsonStatus = computed(() => {
  if (jsonAction.value === "escape") return "已完成转义";
  if (jsonAction.value === "unescape")
    return result.value ? "已去除一层转义" : "已还原为空字符串";
  return jsonAction.value === "minify"
    ? "校验通过 · 已压缩"
    : "校验通过 · 已格式化";
});
const jsonFilename = computed(() => {
  if (jsonAction.value === "escape")
    return jsonQuotes.value ? "escaped.json" : "escaped.txt";
  if (jsonAction.value === "unescape") return "unescaped.txt";
  return jsonAction.value === "minify" ? "minified.json" : "formatted.json";
});
const pattern = ref(""),
  flags = ref("g"),
  busy = ref(false);
const matches = ref<{ value: string; index: number; groups: string[] }[]>([]);
const tested = ref(false),
  limited = ref(false);
let worker: Worker | undefined,
  timer: ReturnType<typeof setTimeout> | undefined;
const generatorMode = ref("uuid"),
  count = ref(5),
  length = ref(20);
const groups = ref(["lower", "upper", "number", "symbol"]);
const encoded = computed(() => {
  if (!input.value) return { result: "", error: "" };
  try {
    return {
      result: encodeText(input.value, encodingMode.value, decode.value),
      error: "",
    };
  } catch {
    return {
      result: "",
      error: "无法解码，请检查编码内容是否完整，以及是否为有效 UTF-8 文本。",
    };
  }
});
function runJson(action: JsonAction) {
  error.value = "";
  result.value = "";
  jsonDone.value = false;
  jsonAction.value = action;
  try {
    result.value = processJson(
      input.value,
      action,
      indent.value === "tab" ? "\t" : Number(indent.value),
      jsonQuotes.value,
    );
    jsonDone.value = true;
  } catch (err) {
    error.value = err instanceof Error ? err.message : "处理失败，请检查输入";
  }
}
function useJsonResult() {
  input.value = result.value;
  result.value = "";
  error.value = "";
  jsonDone.value = false;
}
function example() {
  error.value = "";
  result.value = "";
  jsonDone.value = false;
  if (props.toolId === "json")
    input.value =
      '{"name":"小用工具箱","version":1,"features":["格式化","压缩","转义"],"simple":true}';
  if (props.toolId === "encoding")
    input.value = decode.value
      ? encodingMode.value === "base64"
        ? "5L2g5aW977yM5bCP55So44CC"
        : "%E4%BD%A0%E5%A5%BD"
      : "你好，小用。";
  if (props.toolId === "regex") {
    pattern.value = "[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\\.[A-Za-z]{2,}";
    flags.value = "g";
    input.value = "联系 hello@example.com，或发送到 support@xiaoyong.dev。";
    tested.value = false;
  }
}
function cancelRegex() {
  worker?.terminate();
  worker = undefined;
  clearTimeout(timer);
  busy.value = false;
}
function runRegex() {
  cancelRegex();
  error.value = "";
  matches.value = [];
  tested.value = false;
  if (!pattern.value) {
    error.value = "请先输入正则表达式（不含两侧斜杠）";
    return;
  }
  if (input.value.length > 100000) {
    error.value = "测试文本请控制在 100,000 字符以内";
    return;
  }
  busy.value = true;
  worker = new Worker(new URL("../workers/regex.ts", import.meta.url), {
    type: "module",
  });
  worker.onmessage = (event) => {
    cancelRegex();
    if (event.data.error) {
      error.value = "表达式有误：" + event.data.error;
      return;
    }
    matches.value = event.data.matches;
    limited.value = event.data.limited;
    tested.value = true;
  };
  worker.onerror = () => {
    cancelRegex();
    error.value = "测试未能完成，请检查表达式后重试";
  };
  timer = setTimeout(() => {
    cancelRegex();
    error.value = "匹配超过 2 秒，已停止。请简化表达式，避免过多重复或回溯。";
  }, 2000);
  worker.postMessage({
    pattern: pattern.value,
    flags: flags.value,
    text: input.value,
  });
}
function generate() {
  error.value = "";
  if (!Number.isInteger(count.value) || count.value < 1 || count.value > 100) {
    error.value = "生成数量需为 1–100 的整数";
    return;
  }
  try {
    result.value = Array.from({ length: count.value }, () =>
      generatorMode.value === "uuid"
        ? crypto.randomUUID()
        : generatePassword(length.value, groups.value),
    ).join("\n");
  } catch (err) {
    error.value = err instanceof Error ? err.message : "无法生成，请检查选项";
  }
}
watch([input, jsonQuotes], () => {
  if (props.toolId === "json") {
    result.value = "";
    error.value = "";
    jsonDone.value = false;
  }
});
watch(indent, () => {
  if (
    props.toolId === "json" &&
    jsonDone.value &&
    jsonAction.value === "format"
  )
    runJson("format");
});
watch(
  [generatorMode, length, count, groups],
  () => {
    if (props.toolId === "generator") {
      result.value = "";
      error.value = "";
    }
  },
  { deep: true },
);
watch([pattern, flags, input], () => {
  if (props.toolId === "regex") {
    cancelRegex();
    tested.value = false;
    matches.value = [];
    error.value = "";
  }
});
onUnmounted(cancelRegex);
</script>
<template>
  <div
    class="tool-workspace"
    :class="{ 'json-workspace': toolId === 'json' }"
    @keydown.ctrl.enter.prevent="toolId === 'json' && runJson('format')"
    @keydown.meta.enter.prevent="toolId === 'json' && runJson('format')"
  >
    <template v-if="toolId === 'generator'">
      <div class="tool-toolbar">
        <div class="segmented">
          <button
            :class="{ active: generatorMode === 'uuid' }"
            @click="generatorMode = 'uuid'"
          >
            UUID v4</button
          ><button
            :class="{ active: generatorMode === 'password' }"
            @click="generatorMode = 'password'"
          >
            随机密码
          </button>
        </div>
        <span class="muted">使用浏览器加密随机数生成</span>
      </div>
      <div class="generator-grid">
        <div class="settings-panel">
          <h2>生成设置</h2>
          <label class="field-label"
            >生成数量<input
              v-model.number="count"
              type="number"
              min="1"
              max="100" /></label
          ><template v-if="generatorMode === 'password'"
            ><label class="field-label"
              >密码长度 <span>{{ length }} 位</span
              ><input v-model.number="length" type="range" min="8" max="64"
            /></label>
            <div class="field-label">字符类型</div>
            <div class="checkbox-grid">
              <label class="check-label"
                ><input
                  v-model="groups"
                  value="lower"
                  type="checkbox"
                />小写字母 a–z</label
              ><label class="check-label"
                ><input
                  v-model="groups"
                  value="upper"
                  type="checkbox"
                />大写字母 A–Z</label
              ><label class="check-label"
                ><input v-model="groups" value="number" type="checkbox" />数字
                0–9</label
              ><label class="check-label"
                ><input
                  v-model="groups"
                  value="symbol"
                  type="checkbox"
                />特殊符号 !@#</label
              >
            </div></template
          >
          <div v-else class="hint-box">
            UUID v4 是随机生成的唯一标识符，适用于数据库标识、测试数据等场景。
          </div>
          <button class="button primary full-width" @click="generate">
            <Icon name="Sparkles" :size="17" />生成{{
              generatorMode === "uuid" ? " UUID" : "密码"
            }}
          </button>
        </div>
        <EditorPanel
          :model-value="result"
          title="生成结果"
          placeholder="点击左侧按钮，生成结果会显示在这里"
          readonly
          code
          :filename="generatorMode === 'uuid' ? 'uuid.txt' : 'passwords.txt'"
        />
      </div>
    </template>
    <template v-else-if="toolId === 'regex'">
      <div class="tool-toolbar">
        <span class="muted">JavaScript 正则语法</span>
        <div class="toolbar-actions">
          <button class="text-button" @click="example">填入示例</button
          ><button
            class="icon-button"
            aria-label="清空正则测试"
            @click="
              input = '';
              pattern = '';
              error = '';
              tested = false;
            "
          >
            <Icon name="RotateCcw" :size="17" />
          </button>
        </div>
      </div>
      <div class="regex-settings">
        <label class="field-label regex-pattern"
          >表达式
          <div class="regex-input">
            <span>/</span
            ><input
              v-model="pattern"
              aria-label="正则表达式"
              placeholder="输入匹配规则，不含两侧斜杠"
              spellcheck="false"
            /><span>/</span>
          </div></label
        ><label class="field-label flags-input"
          >修饰符<input
            v-model="flags"
            placeholder="gim"
            aria-label="正则修饰符"
            spellcheck="false" /></label
        ><button class="button primary" :disabled="busy" @click="runRegex">
          <Icon
            :name="busy ? 'LoaderCircle' : 'Regex'"
            :class="{ spin: busy }"
            :size="17"
          />{{ busy ? "匹配中" : "测试匹配" }}
        </button>
      </div>
      <div class="editor-grid">
        <EditorPanel
          v-model="input"
          title="测试文本"
          placeholder="输入要匹配的文本…"
          code
        />
        <section class="editor-panel">
          <div class="panel-heading">
            <h2>匹配结果</h2>
            <span class="muted">{{
              tested ? matches.length + " 个匹配" : "等待测试"
            }}</span>
          </div>
          <div class="match-list">
            <div v-if="!tested" class="panel-placeholder">
              点击「测试匹配」查看结果
            </div>
            <p v-else-if="!matches.length" class="panel-placeholder">
              没有找到匹配内容，请调整表达式后重试。
            </p>
            <div v-for="(match, i) in matches" :key="i" class="match-item">
              <span class="match-index">{{ i + 1 }}</span>
              <div>
                <code>{{ match.value || "（空匹配）" }}</code
                ><small
                  >位置 {{ match.index
                  }}<template v-if="match.groups.length">
                    · 捕获组：{{ JSON.stringify(match.groups) }}</template
                  ></small
                >
              </div>
              <button
                class="icon-button"
                aria-label="复制此匹配"
                @click="copy(match.value)"
              >
                <Icon name="Copy" :size="14" />
              </button>
            </div>
            <p v-if="limited" class="muted">仅显示前 1,000 个匹配。</p>
          </div>
        </section>
      </div>
      <div class="workspace-footnote">
        <Icon name="Info" :size="15" />g 全局匹配 · i 忽略大小写 · m 多行模式 ·
        s 点号匹配换行。耗时超过 2 秒自动停止。
      </div>
    </template>
    <template v-else>
      <div v-if="toolId !== 'json'" class="tool-toolbar">
        <div class="toolbar-options">
          <div class="segmented">
            <button
              :class="{ active: encodingMode === 'base64' }"
              @click="encodingMode = 'base64'"
            >
              Base64</button
            ><button
              :class="{ active: encodingMode === 'url' }"
              @click="encodingMode = 'url'"
            >
              URL
            </button>
          </div>
          <select v-model="decode" aria-label="编码操作">
            <option :value="false">编码</option>
            <option :value="true">解码</option>
          </select>
        </div>
        <div class="toolbar-actions">
          <button class="text-button" @click="example">填入示例</button
          ><button
            class="icon-button"
            aria-label="清空输入"
            @click="
              input = '';
              result = '';
              error = '';
              jsonDone = false;
            "
          >
            <Icon name="RotateCcw" :size="17" />
          </button>
        </div>
      </div>
      <div v-if="toolId === 'json'" class="json-commandbar">
        <div class="json-primary-actions">
          <button
            class="button primary"
            title="Ctrl / ⌘ + Enter"
            @click="runJson('format')"
          >
            <Icon name="Braces" :size="17" />格式化校验
          </button>
          <button class="button secondary" @click="runJson('minify')">
            压缩
          </button>
          <button class="button secondary" @click="runJson('escape')">
            转义
          </button>
          <button class="button secondary" @click="runJson('unescape')">
            去除转义
          </button>
        </div>
        <div class="json-secondary-actions">
          <label class="inline-label"
            >缩进<select v-model="indent" aria-label="JSON 缩进">
              <option value="2">2 空格</option>
              <option value="4">4 空格</option>
              <option value="tab">Tab</option>
            </select></label
          ><button class="text-button" @click="example">填入示例</button>
        </div>
      </div>
      <div v-if="toolId === 'json' && error" role="alert" class="error-message">
        {{ error }}
      </div>
      <div class="editor-grid">
        <EditorPanel
          v-model="input"
          :title="toolId === 'json' ? '输入 JSON' : '输入内容'"
          :placeholder="
            toolId === 'json'
              ? '在这里粘贴 JSON 或转义文本，或点击「填入示例」…'
              : '输入需要处理的文字…'
          "
          code
        /><EditorPanel
          :model-value="toolId === 'encoding' ? encoded.result : result"
          title="处理结果"
          :placeholder="
            toolId === 'json'
              ? '选择上方操作，处理结果会显示在这里'
              : '编码或解码后的结果会实时显示'
          "
          readonly
          code
          :filename="toolId === 'json' ? jsonFilename : 'encoded.txt'"
        />
      </div>
      <div v-if="toolId === 'json' && jsonDone" class="action-row">
        <span class="success-text" role="status"
          ><Icon name="Check" :size="15" />{{ jsonStatus }}</span
        >
        <button class="text-button" :disabled="!result" @click="useJsonResult">
          结果用作输入
        </button>
      </div>
      <div v-if="toolId !== 'json'" class="workspace-footnote">
        <Icon name="Info" :size="15" />支持中文与 emoji。URL 模式按 URI
        组件转换；Base64 是编码方式，不是加密。
      </div>
      <details v-if="toolId === 'json'" class="workspace-help">
        <summary>
          转义选项与使用说明 <span>Ctrl / ⌘ + Enter 格式化</span>
        </summary>
        <div>
          <label class="check-label"
            ><input
              v-model="jsonQuotes"
              type="checkbox"
            />转义时保留外层双引号</label
          >
          <p>
            点击行号旁的箭头可折叠
            JSON。查找支持正则表达式；去除转义每次还原一层。大整数编号请使用字符串，避免标准
            JSON 解析损失精度。
          </p>
        </div>
      </details>
    </template>
    <div
      v-if="
        toolId !== 'json' && (error || (toolId === 'encoding' && encoded.error))
      "
      role="alert"
      class="error-message"
    >
      {{ error || encoded.error }}
    </div>
  </div>
</template>
