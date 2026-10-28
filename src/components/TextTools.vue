<script setup lang="ts">
import { computed, ref } from "vue";
import { diffChars } from "diff";
import Icon from "./Icon.vue";
import EditorPanel from "./EditorPanel.vue";
import { cleanText, processLines } from "../lib/transform";
import { notify } from "../lib/ui";
const props = defineProps<{ toolId: string }>();
const input = ref(""),
  second = ref("");
const trim = ref(true),
  empty = ref(true),
  spaces = ref(false),
  caseMode = ref("none");
const dedupe = ref(true),
  sort = ref("none");
const compared = ref(false);
const diffs = ref<ReturnType<typeof diffChars>>([]);
const output = computed(() =>
  props.toolId === "text-clean"
    ? cleanText(input.value, {
        trim: trim.value,
        empty: empty.value,
        spaces: spaces.value,
        case: caseMode.value,
      })
    : processLines(input.value, dedupe.value, trim.value, sort.value),
);
const stats = computed(() => ({
  chars: Array.from(input.value).length,
  chinese: (input.value.match(/[\u3400-\u9fff]/g) || []).length,
  words: (input.value.match(/[a-zA-Z]+(?:['’-][a-zA-Z]+)*/g) || []).length,
  lines: input.value ? input.value.split(/\r?\n/).length : 0,
}));
function example() {
  if (props.toolId === "text-diff") {
    input.value = "把小事，轻松搞定。\n一个简单好用的工具箱。";
    second.value = "把每件小事，轻松搞定。\n一个简单、免费的工具箱。";
    compared.value = false;
  } else if (props.toolId === "text-lines")
    input.value = "苹果\n香蕉\n苹果\n  橙子  \n香蕉\n西瓜";
  else
    input.value =
      "  你好，小用。  \n\n  Make  it  simple.  \n把时间留给重要的事。";
}
function compare() {
  if (input.value.length + second.value.length > 20000)
    return notify("为保证响应速度，两段文字合计请控制在 20,000 字符以内");
  const result = diffChars(input.value, second.value, { timeout: 1500 });
  if (!result) return notify("文本差异较复杂，请缩短内容后重试");
  diffs.value = result;
  compared.value = true;
}
</script>
<template>
  <div class="tool-workspace">
    <div class="tool-toolbar">
      <div class="toolbar-options">
        <template v-if="toolId === 'text-clean'"
          ><label class="check-label"
            ><input v-model="trim" type="checkbox" />去除首尾空格</label
          ><label class="check-label"
            ><input v-model="empty" type="checkbox" />删除空行</label
          ><label class="check-label"
            ><input v-model="spaces" type="checkbox" />合并连续空格</label
          ><select v-model="caseMode" aria-label="字母大小写">
            <option value="none">保留大小写</option>
            <option value="upper">转为大写</option>
            <option value="lower">转为小写</option>
          </select></template
        ><template v-else-if="toolId === 'text-lines'"
          ><label class="check-label"
            ><input v-model="dedupe" type="checkbox" />去除重复行</label
          ><label class="check-label"
            ><input v-model="trim" type="checkbox" />清理空白和空行</label
          ><select v-model="sort" aria-label="排序方式">
            <option value="none">保持原顺序</option>
            <option value="asc">升序排列</option>
            <option value="desc">降序排列</option>
          </select></template
        ><span v-else class="muted">逐字对比 · 最多 20,000 字符</span>
      </div>
      <div class="toolbar-actions">
        <button class="text-button" @click="example">填入示例</button
        ><button
          class="icon-button"
          aria-label="清空输入"
          @click="
            input = '';
            second = '';
            compared = false;
          "
        >
          <Icon name="RotateCcw" :size="17" />
        </button>
      </div>
    </div>
    <div v-if="toolId === 'text-lines'" class="stats-row">
      <div>
        <strong>{{ stats.lines }}</strong
        ><span>输入行数</span>
      </div>
      <div>
        <strong>{{ output ? output.split("\n").length : 0 }}</strong
        ><span>结果行数</span>
      </div>
      <div>
        <strong>{{
          Math.max(0, stats.lines - (output ? output.split("\n").length : 0))
        }}</strong
        ><span>移除行数</span>
      </div>
    </div>
    <div v-if="toolId === 'text-clean'" class="stats-row">
      <div>
        <strong>{{ stats.chars }}</strong
        ><span>总字符</span>
      </div>
      <div>
        <strong>{{ stats.chinese }}</strong
        ><span>中文字符</span>
      </div>
      <div>
        <strong>{{ stats.words }}</strong
        ><span>英文单词</span>
      </div>
      <div>
        <strong>{{ stats.lines }}</strong
        ><span>文本行数</span>
      </div>
    </div>
    <div v-if="toolId === 'text-diff'" class="action-row">
      <button class="button primary" @click="compare">
        <Icon name="GitCompareArrows" :size="17" />开始对比</button
      ><span class="muted">绿色为新增，红色为删除</span>
    </div>
    <div class="editor-grid">
      <EditorPanel
        v-model="input"
        :title="toolId === 'text-diff' ? '原始文本' : '输入文本'"
        placeholder="在这里粘贴需要处理的文字…"
        @update:model-value="compared = false"
      /><EditorPanel
        v-if="toolId === 'text-diff'"
        v-model="second"
        title="修改后的文本"
        placeholder="在这里粘贴另一段文字…"
        @update:model-value="compared = false"
      /><EditorPanel
        v-else
        :model-value="output"
        title="处理结果"
        placeholder="整理后的文字会显示在这里"
        readonly
      />
    </div>
    <template v-if="toolId === 'text-diff'">
      <section v-if="compared" class="result-box">
        <h3>
          对比结果
          <span
            v-if="!diffs.some((d) => d.added || d.removed)"
            class="success-text"
            >两段文本完全一致</span
          >
        </h3>
        <div class="diff-columns">
          <section>
            <h3>原始文本 · 红色为删除</h3>
            <pre
              class="diff-output"
            ><template v-for="(part,index) in diffs" :key="index"><span v-if="!part.added" :class="{removed:part.removed}">{{part.value}}</span></template></pre>
          </section>
          <section>
            <h3>修改后文本 · 绿色为新增</h3>
            <pre
              class="diff-output"
            ><template v-for="(part,index) in diffs" :key="index"><span v-if="!part.removed" :class="{added:part.added}">{{part.value}}</span></template></pre>
          </section>
        </div>
      </section></template
    >
    <div v-else class="workspace-footnote">
      <Icon name="Info" :size="15" />{{
        toolId === "text-clean"
          ? "字符统计包含空格和换行；英文单词按字母序列统计。"
          : "去重区分大小写；排序采用中文排序规则并识别数字。"
      }}
    </div>
  </div>
</template>
