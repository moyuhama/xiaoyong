<script setup lang="ts">
import { computed, ref, watch } from "vue";
import EditorPanel from "./EditorPanel.vue";
import Icon from "./Icon.vue";
import { htmlEntities, parseJwt } from "../lib/config-tools";
import { useWorkerTask } from "../lib/worker-task";
const props = defineProps<{ toolId: string }>();
const input = ref(""),
  direction = ref("to-json"),
  entityMode = ref("encode");
const { result, busy, error, run, cancel } = useWorkerTask<
  { source: string; toJson: boolean },
  string
>(
  () =>
    new Worker(new URL("../workers/config.ts", import.meta.url), {
      type: "module",
    }),
);
const entities = computed(() => {
  try {
    return {
      text: htmlEntities(input.value, entityMode.value === "encode"),
      error: "",
    };
  } catch (err) {
    return { text: "", error: err instanceof Error ? err.message : "转换失败" };
  }
});
const jwt = computed(() => {
  if (!input.value.trim()) return { data: null, error: "" };
  try {
    return { data: parseJwt(input.value), error: "" };
  } catch (err) {
    return {
      data: null,
      error: err instanceof Error ? err.message : "解析失败",
    };
  }
});
function example() {
  if (props.toolId === "yaml-json")
    input.value =
      direction.value === "to-json"
        ? "name: 小用\nversion: 1\nenabled: true\ntools:\n  - 图片裁剪\n  - PDF 合并\n"
        : '{"name":"小用","version":1,"enabled":true,"tools":["图片裁剪","PDF 合并"]}';
  else if (props.toolId === "html-entities")
    input.value =
      entityMode.value === "encode"
        ? '<a title="你好">小用 & tools</a>'
        : "&lt;a title=&quot;你好&quot;&gt;小用 &amp; tools&lt;/a&gt;";
  else {
    const base64 = (value: object) =>
      btoa(
        String.fromCharCode(...new TextEncoder().encode(JSON.stringify(value))),
      )
        .replace(/\+/g, "-")
        .replace(/\//g, "_")
        .replace(/=+$/, "");
    input.value =
      base64({ alg: "HS256", typ: "JWT" }) +
      "." +
      base64({
        sub: "demo-user",
        name: "小用",
        iat: 1792886400,
        exp: 1792972800,
      }) +
      ".ZGVtby1zaWduYXR1cmU";
  }
}
watch([input, direction, entityMode], cancel);
</script>
<template>
  <div class="tool-workspace">
    <div class="tool-toolbar">
      <label v-if="toolId === 'yaml-json'" class="inline-label"
        >转换方向<select v-model="direction" aria-label="转换方向">
          <option value="to-json">YAML → JSON</option>
          <option value="to-yaml">JSON → YAML</option>
        </select></label
      >
      <div v-else-if="toolId === 'html-entities'" class="segmented">
        <button
          :class="{ active: entityMode === 'encode' }"
          @click="entityMode = 'encode'"
        >
          转义</button
        ><button
          :class="{ active: entityMode === 'decode' }"
          @click="entityMode = 'decode'"
        >
          还原
        </button>
      </div>
      <span v-else class="muted">JWT 解码</span>
      <div class="toolbar-actions">
        <button class="text-button" @click="example">填入示例</button
        ><button class="icon-button" aria-label="清空输入" @click="input = ''">
          <Icon name="RotateCcw" :size="17" />
        </button>
      </div>
    </div>
    <template v-if="toolId === 'jwt'">
      <div class="settings-panel">
        <label class="field-label"
          >JWT 令牌<textarea
            v-model="input"
            rows="3"
            spellcheck="false"
            placeholder="粘贴完整 JWT，可带 Bearer 前缀"
          ></textarea>
        </label>
        <p class="notice-line">
          <Icon
            name="Info"
            :size="16"
          />仅解码，未验证签名；不能据此判断令牌可信或登录有效。
        </p>
      </div>
      <p v-if="jwt.error" role="alert" class="error-message">{{ jwt.error }}</p>
      <div class="editor-grid">
        <EditorPanel
          :model-value="jwt.data?.header || ''"
          title="Header"
          filename="jwt-header.json"
          readonly
          code
        /><EditorPanel
          :model-value="jwt.data?.payload || ''"
          title="Payload"
          filename="jwt-payload.json"
          readonly
          code
        />
      </div>
      <div v-if="jwt.data?.times.length" class="settings-panel">
        <dl class="detail-list">
          <div v-for="time in jwt.data.times" :key="time.key">
            <dt>{{ time.label }}</dt>
            <dd>{{ time.value }}</dd>
            <span class="muted">{{ time.key }}</span>
          </div>
        </dl>
      </div>
    </template>
    <template v-else>
      <div class="editor-grid">
        <EditorPanel
          v-model="input"
          :title="
            toolId === 'yaml-json'
              ? direction === 'to-json'
                ? 'YAML 内容'
                : 'JSON 内容'
              : '输入文本'
          "
          placeholder="输入内容或先试试示例…"
          code
        /><EditorPanel
          :model-value="toolId === 'yaml-json' ? result || '' : entities.text"
          title="转换结果"
          :filename="
            toolId === 'yaml-json'
              ? direction === 'to-json'
                ? 'result.json'
                : 'result.yaml'
              : 'result.txt'
          "
          readonly
          code
        />
      </div>
      <p
        v-if="toolId === 'yaml-json' ? error : entities.error"
        role="alert"
        class="error-message"
      >
        {{ toolId === "yaml-json" ? error : entities.error }}
      </p>
      <div v-if="toolId === 'yaml-json'" class="action-row">
        <button
          class="button primary"
          :disabled="busy"
          @click="run({ source: input, toJson: direction === 'to-json' })"
        >
          {{ busy ? "正在转换…" : "开始转换"
          }}<Icon name="ArrowRight" :size="16" />
        </button>
      </div>
      <div class="workspace-footnote">
        <Icon name="Info" :size="15" /><span>{{
          toolId === "yaml-json"
            ? "按 YAML 1.2 解析；注释不保留。JSON 不支持循环引用、非字符串键或非有限数值，大整数请加引号。"
            : "按 HTML5 字符实体转换，结果以纯文本展示；还原后不会执行 HTML。"
        }}</span>
      </div>
    </template>
  </div>
</template>
