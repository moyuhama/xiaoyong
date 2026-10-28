<script setup lang="ts">
import { computed, nextTick, ref, watch } from "vue";
import { categories, searchTools } from "../lib/tools";
import { commonTools } from "../lib/catalog";
import Icon from "./Icon.vue";
const emit = defineEmits<{ choose: [id: string] }>();
const dialog = ref<HTMLDialogElement>();
const input = ref<HTMLInputElement>();
const query = ref("");
const selected = ref(0);
const matches = computed(() =>
  query.value.trim() ? searchTools(query.value) : commonTools,
);
watch(query, () => {
  selected.value = 0;
});
async function open() {
  if (dialog.value?.open) {
    dialog.value.close();
    return;
  }
  query.value = "";
  selected.value = 0;
  dialog.value?.showModal();
  await nextTick();
  input.value?.focus();
}
function close() {
  dialog.value?.close();
}
function choose(id?: string) {
  if (!id) return;
  close();
  emit("choose", id);
}
async function move(direction: number) {
  if (!matches.value.length) return;
  selected.value =
    (selected.value + direction + matches.value.length) % matches.value.length;
  await nextTick();
  dialog.value
    ?.querySelector('[aria-selected="true"]')
    ?.scrollIntoView({ block: "nearest" });
}
defineExpose({ open, close });
</script>
<template>
  <dialog
    ref="dialog"
    class="tool-search-dialog"
    aria-label="搜索全部工具"
    @click="$event.target === dialog && close()"
  >
    <div class="command-search">
      <Icon name="Search" :size="22" />
      <input
        ref="input"
        v-model="query"
        role="combobox"
        aria-label="搜索全部工具"
        aria-controls="tool-search-results"
        aria-expanded="true"
        aria-autocomplete="list"
        :aria-activedescendant="
          matches.length ? 'tool-search-' + selected : undefined
        "
        placeholder="搜索工具名称或用途…"
        @keydown.down.prevent="move(1)"
        @keydown.up.prevent="move(-1)"
        @keydown.enter.prevent="choose(matches[selected]?.id)"
      />
      <button class="icon-button" aria-label="关闭搜索" @click="close">
        <Icon name="X" :size="19" />
      </button>
    </div>
    <div class="command-caption">
      {{ query.trim() ? `找到 ${matches.length} 个工具` : "常用工具" }}
    </div>
    <div
      id="tool-search-results"
      class="command-results"
      role="listbox"
      aria-label="搜索结果"
    >
      <button
        v-for="(tool, index) in matches"
        :id="'tool-search-' + index"
        :key="tool.id"
        role="option"
        :aria-selected="selected === index"
        tabindex="-1"
        @click="choose(tool.id)"
        @pointermove="selected = index"
      >
        <span class="tool-icon" :class="tool.color"
          ><Icon :name="tool.icon" :size="21"
        /></span>
        <span
          ><strong>{{ tool.name }}</strong
          ><small>{{ tool.description }}</small></span
        >
        <span class="command-category">{{
          categories.find((c) => c.id === tool.category)?.name
        }}</span>
        <Icon name="ArrowRight" :size="16" />
      </button>
      <div v-if="!matches.length" class="command-empty">
        没有找到相关工具，试试「图片」「JSON」或「时间」。
      </div>
    </div>
    <div class="command-footer">
      <span>↑ ↓ 选择 · Enter 打开</span><span>Esc 关闭，继续当前操作</span>
    </div>
  </dialog>
</template>
