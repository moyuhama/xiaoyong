<script setup lang="ts">
import { computed, nextTick, ref, watch } from "vue";
import EditorPanel from "./EditorPanel.vue";
import Icon from "./Icon.vue";
import { useWorkerTask } from "../lib/worker-task";
import type { TextOptions } from "../lib/popular-text";
import { copy, downloadText } from "../lib/ui";
const props = defineProps<{ toolId: string }>();
const config: Record<
  string,
  { options?: [string, string][]; example: string; note: string; file?: string }
> = {
  "chinese-convert": {
    options: [
      ["to-t", "简体 → 繁体"],
      ["to-cn", "繁体 → 简体"],
      ["to-tw", "简体 → 台湾用词"],
    ],
    example: "软件开发与数据库，鼠标和打印机。",
    note: "按词语转换简繁，台湾模式会调整常见用词；姓名和专有名词请核对。",
  },
  "text-case": {
    options: [
      ["upper", "全部大写"],
      ["lower", "全部小写"],
      ["title", "英文词首大写"],
      ["camel", "camelCase"],
      ["pascal", "PascalCase"],
      ["snake", "snake_case"],
      ["kebab", "kebab-case"],
    ],
    example: "hello world\nHTTPServer user_name",
    note: "支持英文大小写与命名风格；命名转换按行处理，以空格、符号和大小写边界分词。",
  },
  unicode: {
    options: [
      ["encode", "文字 → Unicode 转义"],
      ["decode", "Unicode 转义 → 文字"],
    ],
    example: "你好，小用 😀",
    note: "编码输出 UTF-16 的 \\uXXXX；解码也支持 \\u{1F600}，未转义文字原样保留。",
  },
  morse: {
    options: [
      ["encode", "文字 → 摩斯码"],
      ["decode", "摩斯码 → 文字"],
    ],
    example: "SOS HELLO 2026",
    note: "支持英文字母、数字与常见标点；字母间为空格，单词间用 /，解码输出大写英文。",
  },
  "text-extract": {
    options: [
      ["email", "邮箱地址"],
      ["url", "HTTP / HTTPS 网址"],
      ["ip", "IPv4 地址"],
    ],
    example:
      "联系 hello@example.com，网站 https://example.com/docs\n服务器 192.168.1.10，备用 10.0.0.1",
    note: "提取并去重，保留首次出现顺序；仅检查文本形态，不验证邮箱或网址可用性。",
  },
  xml: {
    options: [
      ["format", "格式化 XML"],
      ["json", "XML → JSON"],
    ],
    example:
      '<users><user id="1"><name>小用</name><active>true</active></user></users>',
    note: "属性在 JSON 中使用 @_ 前缀，文本使用 #text，值保留字符串。排版会调整空白，不支持 DTD。",
    file: "result.xml",
  },
  "code-format": {
    options: [
      ["javascript", "JavaScript"],
      ["html", "HTML"],
      ["css", "CSS"],
    ],
    example:
      'const user={name:"小用",active:true};function greet(name){return `Hello ${name}`;}',
    note: "只整理代码，不运行代码。最多 100,000 字符；JavaScript 不含 TypeScript / JSX，HTML 中的嵌入脚本可能保留原排版。",
    file: "formatted.js",
  },
  "json-types": {
    example:
      '{"name":"小用","enabled":true,"tags":["tools"],"user":{"id":1,"email":null}}',
    note: "从示例数据推断 TypeScript 类型；空数组为 unknown[]，null 保留，不能据此推断可选字段。大整数请写成字符串。",
    file: "types.ts",
  },
  "json-query": {
    example: '{"users":[{"name":"小用","id":1},{"name":"工具箱","id":2}]}',
    note: '支持 $.users[0].name、$.users[*].name、["字段"]；返回匹配值数组，未匹配时为 []。不支持递归、筛选或脚本。',
    file: "matches.json",
  },
  "json-compare": {
    example: '{"name":"小用","version":1,"tags":["image","text"]}',
    note: "忽略对象键顺序，保留数组顺序。结果标注字段路径和新增、删除、修改；最多 1,000 处差异。大整数请写成字符串。",
    file: "changes.json",
  },
};
const selected = computed(() => config[props.toolId]);
const input = ref(""),
  second = ref(""),
  mode = ref(selected.value?.options?.[0]?.[0] || ""),
  path = ref("$.users[*].name"),
  query = ref("");
const { result, busy, error, run, cancel } = useWorkerTask<TextOptions, string>(
  () =>
    new Worker(new URL("../workers/popular-text.ts", import.meta.url), {
      type: "module",
    }),
  10000,
);
watch([input, second, mode, path], cancel);
async function selectMode(value: string) {
  mode.value = value;
  await nextTick();
  if (input.value.trim())
    await run({
      kind: props.toolId,
      input: input.value,
      second: second.value,
      mode: mode.value,
      path: path.value,
    });
}
function example() {
  input.value = selected.value?.example || "";
  if (props.toolId === "json-compare")
    second.value =
      '{"name":"小用","version":2,"tags":["image","pdf"],"active":true}';
  if (props.toolId === "code-format" && mode.value !== "javascript")
    input.value =
      mode.value === "css"
        ? ".box{color:#16836c;padding:12px;margin:0 auto;}"
        : "<main><h1>小用</h1><p>工具箱</p></main>";
  if (props.toolId === "morse" && mode.value === "decode")
    input.value = "... --- ... / .... . .-.. .-.. ---";
  if (props.toolId === "unicode" && mode.value === "decode")
    input.value = "\\u4f60\\u597d \\u{1F600}";
}
const filename = computed(() =>
  props.toolId === "code-format"
    ? "formatted." + (mode.value === "javascript" ? "js" : mode.value)
    : props.toolId === "xml" && mode.value === "json"
      ? "result.json"
      : selected.value?.file || "result.txt",
);
const controlNames = [
  "NUL",
  "SOH",
  "STX",
  "ETX",
  "EOT",
  "ENQ",
  "ACK",
  "BEL",
  "BS",
  "TAB",
  "LF",
  "VT",
  "FF",
  "CR",
  "SO",
  "SI",
  "DLE",
  "DC1",
  "DC2",
  "DC3",
  "DC4",
  "NAK",
  "SYN",
  "ETB",
  "CAN",
  "EM",
  "SUB",
  "ESC",
  "FS",
  "GS",
  "RS",
  "US",
];
const asciiGroup = ref("all");
const asciiRows = computed(() =>
  Array.from({ length: 128 }, (_, code) => ({
    code,
    hex: code.toString(16).toUpperCase().padStart(2, "0"),
    binary: code.toString(2).padStart(8, "0"),
    char:
      code < 32
        ? controlNames[code]!
        : code === 32
          ? "SPACE"
          : code === 127
            ? "DEL"
            : String.fromCharCode(code),
  }))
    .filter(
      (row) =>
        asciiGroup.value === "all" ||
        (asciiGroup.value === "printable"
          ? row.code >= 32 && row.code < 127
          : row.code < 32 || row.code === 127),
    )
    .filter(
      (row) =>
        !query.value.trim() ||
        [String(row.code), "0x" + row.hex, row.char].some((v) =>
          v.toLowerCase().includes(query.value.trim().toLowerCase()),
        ),
    ),
);
function exportAscii() {
  const csv = asciiRows.value
    .map((r) =>
      [r.code, r.hex, r.binary, '"' + r.char.replaceAll('"', '""') + '"'].join(
        ",",
      ),
    )
    .join("\r\n");
  downloadText("\uFEFF十进制,十六进制,二进制,字符\r\n" + csv, "ascii.csv");
}
</script>
<template>
  <div class="tool-workspace">
    <template v-if="toolId === 'ascii'"
      ><div class="tool-toolbar">
        <label class="inline-label"
          >查找字符或码值<input
            v-model="query"
            placeholder="如 A、65、0x41、TAB" /></label
        ><button class="button secondary" @click="exportAscii">下载码表</button>
      </div>
      <div class="tool-toolbar">
        <div class="mode-buttons">
          <button
            v-for="[value, name] in [
              ['all', '全部字符'],
              ['printable', '可打印字符'],
              ['control', '控制字符'],
            ]"
            :key="value"
            :class="{ active: asciiGroup === value }"
            @click="asciiGroup = value!"
          >
            {{ name }}
          </button>
        </div>
        <span class="muted">{{ asciiRows.length }} 项</span>
      </div>
      <div class="data-table-scroll">
        <table class="data-table">
          <thead>
            <tr>
              <th>十进制</th>
              <th>十六进制</th>
              <th>二进制</th>
              <th>字符 / 控制符</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="row in asciiRows" :key="row.code">
              <td>{{ row.code }}</td>
              <td>0x{{ row.hex }}</td>
              <td>{{ row.binary }}</td>
              <td>{{ row.char }}</td>
              <td>
                <button
                  class="text-button"
                  :aria-label="'复制 ' + row.char"
                  @click="copy(row.char)"
                >
                  复制
                </button>
              </td>
            </tr>
          </tbody>
        </table>
        <p v-if="!asciiRows.length" class="muted settings-panel">
          没有匹配字符
        </p>
      </div>
      <div class="workspace-footnote">
        标准 ASCII 共 128 项；控制字符复制其名称，空格显示为 SPACE。
      </div></template
    >
    <template v-else>
      <div class="tool-toolbar">
        <div class="toolbar-options">
          <div
            v-if="selected?.options"
            class="mode-buttons"
            role="group"
            aria-label="处理方式"
          >
            <button
              v-for="[value, label] in selected.options"
              :key="value"
              :class="{ active: mode === value }"
              :aria-pressed="mode === value"
              :disabled="busy"
              @click="selectMode(value)"
            >
              {{ label }}
            </button>
          </div>
          <label v-if="toolId === 'json-query'" class="inline-label"
            >查询路径<input v-model="path" placeholder="$.users[*].name"
          /></label>
        </div>
        <div class="toolbar-actions">
          <button class="text-button" @click="example">填入示例</button
          ><button
            class="icon-button"
            aria-label="清空输入"
            @click="
              input = '';
              second = '';
              cancel();
            "
          >
            <Icon name="RotateCcw" :size="17" />
          </button>
        </div>
      </div>
      <div class="action-row">
        <button
          class="button primary"
          :disabled="busy"
          @click="run({ kind: toolId, input, second, mode, path })"
        >
          <Icon
            :name="busy ? 'LoaderCircle' : 'ArrowRight'"
            :class="{ spin: busy }"
            :size="17"
          />{{
            busy
              ? "处理中…"
              : toolId === "json-compare"
                ? "比较 JSON"
                : toolId === "json-query"
                  ? "查询"
                  : "开始处理"
          }}</button
        ><button
          v-if="result && toolId !== 'json-compare'"
          class="button secondary"
          @click="
            input = result;
            cancel();
          "
        >
          结果用作输入</button
        ><button v-if="busy" class="button secondary" @click="cancel">
          取消
        </button>
      </div>
      <div class="editor-grid">
        <EditorPanel
          v-model="input"
          :title="toolId === 'json-compare' ? '原始 JSON' : '输入内容'"
          :language="
            toolId.startsWith('json-')
              ? 'json'
              : toolId === 'code-format'
                ? mode
                : toolId === 'xml'
                  ? 'xml'
                  : ''
          "
          code
          placeholder="粘贴需要处理的内容…"
        /><EditorPanel
          v-if="toolId === 'json-compare'"
          v-model="second"
          title="对比 JSON"
          code
          placeholder="粘贴另一份 JSON…"
        /><EditorPanel
          v-else
          :model-value="result || ''"
          title="处理结果"
          readonly
          code
          :filename="filename"
          placeholder="结果会显示在这里"
          :language="toolId === 'code-format' ? mode : filename"
        />
      </div>

      <EditorPanel
        v-if="toolId === 'json-compare'"
        :model-value="result || ''"
        title="处理结果"
        readonly
        code
        :filename="filename"
        placeholder="差异会显示在这里"
      />
      <p v-if="error" class="error-message" role="alert">{{ error }}</p>
      <div class="workspace-footnote">
        <Icon name="Info" :size="15" />{{ selected?.note }}
      </div>
    </template>
  </div>
</template>
