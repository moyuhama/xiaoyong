<script setup lang="ts">
import { computed, onUnmounted, ref } from "vue";
import Icon from "./Icon.vue";
import TextEditor from "./TextEditor.vue";
import { copy, downloadText, notify } from "../lib/ui";
const props = withDefaults(
  defineProps<{
    title: string;
    modelValue: string;
    placeholder?: string;
    readonly?: boolean;
    filename?: string;
    count?: string;
    code?: boolean;
    language?: string;
  }>(),
  {
    placeholder: "",
    readonly: false,
    filename: "result.txt",
    count: "",
    code: false,
    language: "",
  },
);
const emit = defineEmits<{ "update:modelValue": [value: string] }>();
const editor = ref<InstanceType<typeof TextEditor>>();
const fileInput = ref<HTMLInputElement>();
const wrap = ref(true),
  canUndo = ref(false),
  canRedo = ref(false);
const lines = computed(() =>
  props.modelValue ? props.modelValue.split("\n").length : 0,
);
const characters = computed(() =>
  Array.from(props.modelValue).length.toLocaleString(),
);
const isJson = computed(
  () =>
    props.language === "json" ||
    /JSON/i.test(props.title) ||
    props.filename.endsWith(".json"),
);
let importVersion = 0;
async function importText(event: Event) {
  const element = event.target as HTMLInputElement;
  const file = element.files?.[0];
  element.value = "";
  if (!file) return;
  if (file.size > 2 * 1024 * 1024) {
    notify("文本文件请控制在 2 MB 以内");
    return;
  }
  const version = ++importVersion;
  try {
    const text = new TextDecoder("utf-8", { fatal: true }).decode(
      await file.arrayBuffer(),
    );
    if (version !== importVersion) return;
    if (text.includes("\0")) throw new Error("binary");
    emit("update:modelValue", text);
    notify("已导入 " + file.name);
  } catch {
    notify("无法读取，请选择 UTF-8 编码的文本文件");
  }
}
onUnmounted(() => {
  importVersion++;
});
</script>
<template>
  <section
    class="editor-panel"
    :class="{ 'output-panel': readonly }"
    :aria-label="title + '编辑区'"
  >
    <div class="panel-heading">
      <h2>{{ title }}</h2>
      <div class="panel-actions">
        <button
          v-if="!readonly"
          class="editor-action"
          :aria-label="'导入' + title"
          @click="fileInput?.click()"
        >
          <Icon name="Upload" :size="15" />导入
        </button>
        <button
          v-if="readonly"
          class="editor-action"
          :aria-label="'复制' + title"
          :disabled="!modelValue"
          @click="copy(modelValue)"
        >
          <Icon name="Copy" :size="15" />复制
        </button>
        <button
          v-if="readonly"
          class="editor-action"
          :aria-label="'下载' + title"
          :disabled="!modelValue"
          @click="downloadText(modelValue, filename)"
        >
          <Icon name="Download" :size="15" />下载
        </button>
      </div>
    </div>
    <div class="editor-controls">
      <span v-if="!readonly" class="editor-history">
        <button
          class="icon-button"
          :aria-label="'撤销' + title"
          :disabled="!canUndo"
          @click="editor?.undo()"
        >
          <Icon name="Undo2" :size="16" />
        </button>
        <button
          class="icon-button"
          :aria-label="'重做' + title"
          :disabled="!canRedo"
          @click="editor?.redo()"
        >
          <Icon name="Redo2" :size="16" />
        </button>
        <button
          class="editor-action"
          :aria-label="'清空' + title"
          :disabled="!modelValue"
          @click="emit('update:modelValue', '')"
        >
          清空
        </button>
      </span>
      <span v-else class="muted">{{
        count || (modelValue ? "结果已生成" : "等待处理")
      }}</span>
      <div class="editor-view-options">
        <button
          class="editor-action"
          :aria-label="'查找' + title"
          @click="editor?.find()"
        >
          <Icon name="Search" :size="15" />查找
        </button>
        <label class="check-label"
          ><input
            v-model="wrap"
            type="checkbox"
            :aria-label="title + '自动换行'"
          />自动换行</label
        >
      </div>
    </div>
    <input
      v-if="!readonly"
      ref="fileInput"
      class="visually-hidden"
      type="file"
      :aria-label="'选择' + title + '文本文件'"
      accept="text/*,.json,.csv,.tsv,.xml,.yaml,.yml,.md,.sql,.js,.ts,.css,.html,.log"
      @change="importText"
    />
    <TextEditor
      ref="editor"
      :model-value="modelValue"
      :label="title"
      :placeholder="placeholder"
      :readonly="readonly"
      :wrap="wrap"
      :code="code"
      :json="isJson"
      @update:model-value="emit('update:modelValue', $event)"
      @history="
        (undo, redo) => {
          canUndo = undo;
          canRedo = redo;
        }
      "
    />
    <div class="editor-footer">
      <span>{{ lines }} 行 · {{ characters }} 字符</span
      ><span>{{ readonly ? "只读结果" : "Ctrl / ⌘ F 查找" }}</span>
    </div>
  </section>
</template>
