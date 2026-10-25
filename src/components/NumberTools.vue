<script setup lang="ts">
import { computed, ref, watch } from "vue";
import EditorPanel from "./EditorPanel.vue";
import Icon from "./Icon.vue";
import { moneyUppercase, randomNumbers } from "../lib/more-tools";
const props = defineProps<{ toolId: string }>();
const money = computed(() => props.toolId === "money-uppercase");
const amount = ref(""),
  min = ref(1),
  max = ref(100),
  count = ref(10),
  unique = ref(true),
  sort = ref("none"),
  separator = ref("line");
const result = ref(""),
  error = ref("");
watch([amount, min, max, count, unique, sort, separator], () => {
  result.value = "";
  error.value = "";
});
function generate() {
  result.value = "";
  error.value = "";
  try {
    if (money.value) result.value = moneyUppercase(amount.value);
    else {
      const values = randomNumbers(
        min.value,
        max.value,
        count.value,
        unique.value,
      );
      if (sort.value !== "none")
        values.sort((a, b) => (sort.value === "asc" ? a - b : b - a));
      result.value = values.join(separator.value === "line" ? "\n" : ", ");
    }
  } catch (e) {
    error.value = e instanceof Error ? e.message : "请检查输入";
  }
}
</script>
<template>
  <div class="tool-workspace">
    <div class="generator-grid">
      <div class="settings-panel">
        <h2>{{ money ? "输入金额" : "生成设置" }}</h2>
        <template v-if="money"
          ><label class="field-label"
            >金额（元）<input
              v-model="amount"
              inputmode="decimal"
              maxlength="30"
              placeholder="例如 1001.05" /></label
          ><button class="text-button" @click="amount = '1234567.89'">
            填入示例
          </button></template
        >
        <template v-else>
          <div class="two-fields">
            <label class="field-label"
              >最小值<input
                v-model.number="min"
                type="number"
                min="-1000000000"
                max="1000000000" /></label
            ><label class="field-label"
              >最大值<input
                v-model.number="max"
                type="number"
                min="-1000000000"
                max="1000000000"
            /></label>
          </div>
          <label class="field-label"
            >生成数量<input
              v-model.number="count"
              type="number"
              min="1"
              max="1000"
          /></label>
          <label class="check-label"
            ><input v-model="unique" type="checkbox" />数字不重复</label
          >
          <label class="field-label workshop-space"
            >排列方式<select v-model="sort">
              <option value="none">随机顺序</option>
              <option value="asc">从小到大</option>
              <option value="desc">从大到小</option>
            </select></label
          >
          <label class="field-label"
            >分隔方式<select v-model="separator">
              <option value="line">每行一个</option>
              <option value="comma">逗号分隔</option>
            </select></label
          >
        </template>
        <button
          class="button primary full-width workshop-space"
          @click="generate"
        >
          <Icon :name="money ? 'Type' : 'Shuffle'" :size="17" />{{
            money ? "转换为人民币大写" : "生成随机数"
          }}
        </button>
      </div>
      <EditorPanel
        :model-value="result"
        title="处理结果"
        readonly
        :filename="money ? 'money-uppercase.txt' : 'random-numbers.txt'"
        placeholder="结果会显示在这里"
      />
    </div>
    <p v-if="error" class="error-message" role="alert">{{ error }}</p>
    <div class="workspace-footnote">
      <Icon name="Info" :size="15" />{{
        money
          ? "支持负数和规范的千位逗号，整数最多 16 位，小数最多 2 位；超出分位会提示，不自动四舍五入。"
          : "包含范围两端，支持负整数，每次最多 1,000 个；重新生成会使用新的一组随机数。"
      }}
    </div>
  </div>
</template>
