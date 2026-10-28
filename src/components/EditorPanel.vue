<script setup lang="ts">
import Icon from "./Icon.vue";
import { copy, downloadText } from "../lib/ui";
withDefaults(
  defineProps<{
    title: string;
    modelValue: string;
    placeholder?: string;
    readonly?: boolean;
    filename?: string;
    count?: string;
    code?: boolean;
  }>(),
  {
    placeholder: "",
    readonly: false,
    filename: "result.txt",
    count: "",
    code: false,
  },
);
defineEmits<{ "update:modelValue": [value: string] }>();
</script>
<template>
  <section class="editor-panel">
    <div class="panel-heading">
      <h2>{{ title }}</h2>
      <div class="panel-actions">
        <span v-if="count" class="muted">{{ count }}</span
        ><button
          v-if="readonly"
          class="icon-button"
          :aria-label="'复制' + title"
          :disabled="!modelValue"
          @click="copy(modelValue)"
        >
          <Icon name="Copy" :size="16" /></button
        ><button
          v-if="readonly"
          class="icon-button"
          :aria-label="'下载' + title"
          :disabled="!modelValue"
          @click="downloadText(modelValue, filename)"
        >
          <Icon name="Download" :size="16" />
        </button>
      </div>
    </div>
    <textarea
      :value="modelValue"
      :aria-label="title"
      :readonly="readonly"
      :placeholder="placeholder"
      :class="{ 'code-input': code }"
      spellcheck="false"
      @input="
        $emit('update:modelValue', ($event.target as HTMLTextAreaElement).value)
      "
    ></textarea>
    <div class="editor-footer">
      <span>{{
        modelValue
          ? Array.from(modelValue).length.toLocaleString() + " 字符"
          : "等待输入"
      }}</span
      ><span v-if="!readonly">支持直接粘贴</span>
    </div>
  </section>
</template>
