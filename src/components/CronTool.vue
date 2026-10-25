<script setup lang="ts">
import { ref, watch } from "vue";
import Icon from "./Icon.vue";
import { useWorkerTask } from "../lib/worker-task";
import { parseDateInput } from "../lib/transform";
import { worldCities, zonedTime } from "../lib/time-tools";
import { copy } from "../lib/ui";
const expression = ref("0 9 * * 1-5"),
  zone = ref("Asia/Shanghai"),
  start = ref(new Date().toISOString().slice(0, 19)),
  validation = ref("");
const { result, busy, error, run, cancel } = useWorkerTask<
  { expression: string; timezone: string; after: number },
  { description: string; dates: string[] }
>(
  () =>
    new Worker(new URL("../workers/cron.ts", import.meta.url), {
      type: "module",
    }),
);
const examples = [
  { name: "每 5 分钟", value: "*/5 * * * *" },
  { name: "每天 9 点", value: "0 9 * * *" },
  { name: "工作日 9 点", value: "0 9 * * 1-5" },
  { name: "每月 1 日", value: "0 0 1 * *" },
];
async function calculate() {
  validation.value = "";
  try {
    await run({
      expression: expression.value,
      timezone: zone.value,
      after: parseDateInput(start.value, true).getTime(),
    });
  } catch (err) {
    validation.value = err instanceof Error ? err.message : "起始时间有误";
  }
}
watch([expression, zone, start], () => {
  cancel();
  validation.value = "";
});
function display(iso: string) {
  const value = zonedTime(Date.parse(iso), zone.value);
  return value.date + " " + value.time + " " + value.weekday;
}
</script>
<template>
  <div class="tool-workspace">
    <div class="tool-toolbar">
      <span class="muted">标准 5 段表达式：分 时 日 月 周</span
      ><button
        class="text-button"
        @click="start = new Date().toISOString().slice(0, 19)"
      >
        使用当前时刻
      </button>
    </div>
    <div class="settings-panel">
      <label class="field-label"
        >Cron 表达式<input
          v-model="expression"
          class="code-input"
          spellcheck="false"
          placeholder="0 9 * * 1-5"
      /></label>
      <div class="preset-row">
        <button
          v-for="item in examples"
          :key="item.value"
          class="button secondary"
          @click="expression = item.value"
        >
          {{ item.name }}
        </button>
      </div>
      <div class="two-fields">
        <label class="field-label"
          >执行时区<select v-model="zone" aria-label="执行时区">
            <option
              v-for="city in worldCities"
              :key="city.zone"
              :value="city.zone"
            >
              {{ city.name }} · {{ city.zone }}
            </option>
          </select></label
        ><label class="field-label"
          >计算起点（UTC）<input v-model="start" type="datetime-local" step="1"
        /></label>
      </div>
      <button class="button primary" :disabled="busy" @click="calculate">
        {{ busy ? "正在计算…" : "解析并计算"
        }}<Icon name="ArrowRight" :size="16" />
      </button>
    </div>
    <p v-if="validation || error" role="alert" class="error-message">
      {{ validation || error }}
    </p>
    <section v-if="result" class="cron-result settings-panel">
      <h2>{{ result.description }}</h2>
      <p class="muted">
        接下来的 {{ result.dates.length }} 次执行时间 · {{ zone }}
      </p>
      <ol class="cron-dates">
        <li v-for="date in result.dates" :key="date">
          <time :datetime="date">{{ display(date) }}</time
          ><button
            class="icon-button"
            :aria-label="'复制执行时间 ' + date"
            @click="copy(display(date))"
          >
            <Icon name="Copy" :size="16" />
          </button>
        </li>
      </ol>
    </section>
    <div class="workspace-footnote">
      <Icon name="Info" :size="15" />星期 0 和 7
      都表示周日。日期与星期同时指定时按“或”匹配；这里只解析规则，不创建定时任务。
    </div>
  </div>
</template>
