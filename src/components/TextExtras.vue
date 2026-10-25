<script setup lang="ts">
import { computed, ref } from "vue";
import EditorPanel from "./EditorPanel.vue";
import Icon from "./Icon.vue";
import {
  compareLists,
  replaceLiteral,
  type ListOperation,
} from "../lib/text-extras";
const props = defineProps<{ toolId: string }>();
const input = ref(""),
  second = ref(""),
  search = ref(""),
  replacement = ref(""),
  ignoreCase = ref(false),
  operation = ref<ListOperation>("intersection");
const result = computed(() => {
  try {
    return {
      data:
        props.toolId === "text-replace"
          ? replaceLiteral(
              input.value,
              search.value,
              replacement.value,
              ignoreCase.value,
            )
          : compareLists(
              input.value,
              second.value,
              operation.value,
              ignoreCase.value,
            ),
      error: "",
    };
  } catch (err) {
    return {
      data: null,
      error: err instanceof Error ? err.message : "处理失败",
    };
  }
});
function example() {
  if (props.toolId === "text-replace") {
    input.value = "Hello，小用。\nHello，新的开始。\nhello，每一天。";
    search.value = "Hello";
    replacement.value = "你好";
  } else {
    input.value = "小林\n小周\n小陈\n小林";
    second.value = "小陈\n小李\n小周";
  }
}
</script>
<template>
  <div class="tool-workspace">
    <div class="tool-toolbar">
      <div class="toolbar-options">
        <label class="check-label"
          ><input v-model="ignoreCase" type="checkbox" />忽略字母大小写</label
        ><label v-if="toolId === 'list-compare'" class="inline-label"
          >对比方式<select v-model="operation" aria-label="对比方式">
            <option value="intersection">两边都有（交集）</option>
            <option value="left">仅在名单 A</option>
            <option value="right">仅在名单 B</option>
            <option value="union">合并去重（并集）</option>
            <option value="difference">仅在其中一边</option>
          </select></label
        >
      </div>
      <div class="toolbar-actions">
        <button class="text-button" @click="example">填入示例</button
        ><button
          class="icon-button"
          aria-label="清空文本"
          @click="
            input = '';
            second = '';
          "
        >
          <Icon name="RotateCcw" :size="17" />
        </button>
      </div>
    </div>
    <div
      v-if="toolId === 'text-replace'"
      class="settings-panel two-fields replace-fields"
    >
      <label class="field-label"
        >查找内容<input v-model="search" placeholder="要查找的原文" /></label
      ><label class="field-label"
        >替换为<input v-model="replacement" placeholder="留空表示删除匹配内容"
      /></label>
    </div>
    <div class="editor-grid">
      <EditorPanel
        v-model="input"
        :title="toolId === 'list-compare' ? '名单 A' : '原始文本'"
        placeholder="每行一项，或粘贴待处理的文本…"
      /><EditorPanel
        v-if="toolId === 'list-compare'"
        v-model="second"
        title="名单 B"
        placeholder="每行填写一项…"
      /><EditorPanel
        v-else
        :model-value="result.data?.text || ''"
        title="替换结果"
        :count="'匹配 ' + (result.data?.count || 0) + ' 处'"
        readonly
      />
    </div>
    <div v-if="toolId === 'list-compare'" class="list-result">
      <EditorPanel
        :model-value="result.data?.text || ''"
        title="对比结果"
        :count="(result.data?.count || 0) + ' 项'"
        filename="list-result.txt"
        readonly
      />
    </div>
    <p v-if="result.error" role="alert" class="error-message">
      {{ result.error }}
    </p>
    <div class="workspace-footnote">
      <Icon name="Info" :size="15" />{{
        toolId === "list-compare"
          ? "自动清理首尾空白、空行和重复项；结果保留原有顺序。"
          : "按普通文本匹配，不使用正则；替换内容中的 $、反斜杠等字符保持原样。"
      }}
    </div>
  </div>
</template>
