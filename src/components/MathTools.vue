<script setup lang="ts">
import { computed, ref, watch } from "vue";
import EditorPanel from "./EditorPanel.vue";
import Icon from "./Icon.vue";
import { copy, downloadText } from "../lib/ui";
import { calculate, describeNumbers, workingDays } from "../lib/math-tools";
const props = defineProps<{ toolId: string }>();
const expression = ref(""),
  degree = ref("degree"),
  input = ref(""),
  result = ref(""),
  error = ref("");
const mode = ref("count"),
  start = ref(""),
  end = ref(""),
  offset = ref(5),
  holidays = ref(""),
  makeup = ref(""),
  includeStart = ref(true),
  includeEnd = ref(true);
watch(
  [
    expression,
    degree,
    input,
    mode,
    start,
    end,
    offset,
    holidays,
    makeup,
    includeStart,
    includeEnd,
  ],
  () => {
    result.value = "";
    error.value = "";
  },
);
const metrics = computed(() =>
  result.value
    .split("\n")
    .filter(Boolean)
    .map((line) => line.split("：")),
);
function process() {
  result.value = "";
  error.value = "";
  try {
    if (props.toolId === "calculator")
      result.value = String(
        calculate(expression.value, degree.value === "degree"),
      );
    else if (props.toolId === "statistics") {
      const s = describeNumbers(input.value),
        format = (n: number | null) =>
          n === null ? "至少需要 2 个数" : Number(n.toPrecision(14)).toString();
      result.value = Object.entries({
        数量: s.count,
        总和: s.sum,
        平均数: s.mean,
        中位数: s.median,
        最小值: s.min,
        最大值: s.max,
        总体方差: s.variance,
        样本方差: s.sampleVariance,
        总体标准差: s.std,
      })
        .map(([key, value]) => key + "：" + format(value))
        .join("\n");
    } else
      result.value =
        String(
          workingDays(
            start.value,
            end.value,
            mode.value === "add" ? offset.value : null,
            holidays.value,
            makeup.value,
            includeStart.value,
            includeEnd.value,
          ),
        ) + (mode.value === "count" ? " 个工作日" : "");
  } catch (e) {
    error.value = e instanceof Error ? e.message : "请检查输入";
  }
}
function example() {
  if (props.toolId === "calculator")
    expression.value = "sqrt(144) + 2^3 + sin(30)";
  else if (props.toolId === "statistics") input.value = "10, 20, 20, 30, 40";
  else {
    start.value = "2026-10-26";
    end.value = "2026-10-30";
  }
}
</script>
<template>
  <div class="tool-workspace">
    <div class="tool-toolbar">
      <span class="muted">{{
        toolId === "calculator"
          ? "算式计算"
          : toolId === "statistics"
            ? "数列统计"
            : "工作日规则"
      }}</span
      ><button class="text-button" @click="example">填入示例</button>
    </div>
    <div class="action-row">
      <button class="button primary" @click="process">
        <Icon name="ArrowRight" :size="17" />计算
      </button>
    </div>
    <div v-if="toolId === 'statistics'" class="editor-grid">
      <EditorPanel
        v-model="input"
        title="输入数据"
        placeholder="输入数字，用空格、逗号或换行分隔"
        code
      />
      <section class="result-metrics">
        <article v-for="[label, value] in metrics" :key="label">
          <span>{{ label }}</span
          ><strong>{{ value }}</strong>
        </article>
        <p v-if="!result" class="muted">
          输入数据后点击「计算」，查看各项统计指标。
        </p>
        <div v-else class="toolbar-actions">
          <button class="button secondary" @click="copy(result)">
            复制统计</button
          ><button
            class="button secondary"
            @click="downloadText(result, 'statistics.txt')"
          >
            下载
          </button>
        </div>
      </section>
    </div>
    <div v-else class="generator-grid">
      <div class="settings-panel">
        <template v-if="toolId === 'calculator'"
          ><label class="field-label"
            >算式<input
              v-model="expression"
              maxlength="500"
              placeholder="例如 (12 + 8) * 3 / 2"
              @keyup.enter="process" /></label
          ><label class="field-label"
            >角度单位<select v-model="degree">
              <option value="degree">角度（DEG）</option>
              <option value="radian">弧度（RAD）</option>
            </select></label
          >
          <div class="calculator-keys">
            <button
              v-for="key in [
                'sin(',
                'cos(',
                'tan(',
                'sqrt(',
                'ln(',
                'log(',
                'abs(',
                '!',
                '7',
                '8',
                '9',
                '/',
                '4',
                '5',
                '6',
                '*',
                '1',
                '2',
                '3',
                '-',
                '0',
                '.',
                '(',
                ')',
                'pi',
                '^',
                '%',
                '+',
              ]"
              :key="key"
              class="button secondary"
              @click="expression += key"
            >
              {{ key }}</button
            ><button
              class="button secondary"
              @click="expression = expression.slice(0, -1)"
            >
              退格</button
            ><button class="button secondary" @click="expression = ''">
              清空</button
            ><button class="button primary" @click="process">=</button>
          </div></template
        >
        <template v-else
          ><label class="field-label"
            >计算方式<select v-model="mode">
              <option value="count">统计日期区间的工作日</option>
              <option value="add">日期增减工作日</option>
            </select></label
          ><label class="field-label"
            >开始日期<input
              v-model="start"
              type="date"
              min="1900-01-01"
              max="2100-12-31" /></label
          ><label v-if="mode === 'count'" class="field-label"
            >结束日期<input
              v-model="end"
              type="date"
              min="1900-01-01"
              max="2100-12-31" /></label
          ><label v-else class="field-label"
            >增减天数（负数向前）<input
              v-model.number="offset"
              type="number"
              min="-10000"
              max="10000"
          /></label>
          <div v-if="mode === 'count'" class="toolbar-options">
            <label class="check-label"
              ><input
                v-model="includeStart"
                type="checkbox"
              />包含开始当天</label
            ><label class="check-label"
              ><input v-model="includeEnd" type="checkbox" />包含结束当天</label
            >
          </div>
          <label class="field-label workshop-space"
            >自定义休息日期<textarea
              v-model="holidays"
              rows="3"
              placeholder="每行一个日期，例如 2026-10-01"
            /></label
          ><label class="field-label"
            >自定义补班日期<textarea
              v-model="makeup"
              rows="3"
              placeholder="每行一个日期，例如 2026-10-10"
            /></label
        ></template>
      </div>
      <section class="calculation-output">
        <h2>计算结果</h2>
        <output>{{ result || "—" }}</output
        ><button
          class="button secondary"
          :disabled="!result"
          @click="copy(result)"
        >
          复制结果
        </button>
      </section>
    </div>

    <p v-if="error" class="error-message" role="alert">{{ error }}</p>
    <div class="workspace-footnote">
      <Icon name="Info" :size="15" /><span>{{
        toolId === "calculator"
          ? "支持 + − * / ^、阶乘 !、百分数 %、pi、e，以及 sqrt / abs / sin / cos / tan / ln / log / round / floor / ceil。结果显示约 14 位有效数字。"
          : toolId === "statistics"
            ? "最多 10,000 个数；按数值计算，支持负数、小数与科学计数法。总体方差除以 n，样本方差除以 n−1。"
            : "默认周一至周五为工作日，不自动包含法定节假日与调休；可自行补充。增减时不计开始当天，增减 0 天返回开始日期。"
      }}</span>
    </div>
  </div>
</template>
