<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from "vue";
import Icon from "./Icon.vue";
import EditorPanel from "./EditorPanel.vue";
import { copy, downloadText } from "../lib/ui";
import { worldCities } from "../lib/time-tools";
import {
  readTimestamp,
  readDateTime,
  timestampDetails,
  calendarDays,
  batchTimestamps,
  type TimestampUnit,
} from "../lib/timestamp";

const now = ref(Date.now()),
  paused = ref(false),
  timezone = ref("Asia/Shanghai"),
  tab = ref("convert");
const liveUnit = ref<"seconds" | "milliseconds">("seconds");
const stampZone = ref("Asia/Shanghai"),
  dateZone = ref("Asia/Shanghai"),
  batchZone = ref("Asia/Shanghai");
const outputUnit = ref<"seconds" | "milliseconds">("seconds");
const deviceZone = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
const zone = computed(() =>
  timezone.value === "local" ? deviceZone : timezone.value,
);
const clock = computed(() => timestampDetails(now.value, zone.value));
const zones = [
  { name: "北京时间", zone: "Asia/Shanghai" },
  { name: "UTC", zone: "UTC" },
  { name: "当前设备 · " + deviceZone, zone: "local" },
  ...worldCities.filter((c) => !["Asia/Shanghai", "UTC"].includes(c.zone)),
];
const zoneChoices = Array.from(
  new Set([
    "Asia/Shanghai",
    "UTC",
    deviceZone,
    ...zones.filter((item) => item.zone !== "local").map((item) => item.zone),
    ...Intl.supportedValuesOf("timeZone"),
  ]),
);
const currentValue = computed(() => clock.value[liveUnit.value]);
function fillLive() {
  inputUnit.value = liveUnit.value;
  inputStamp.value = currentValue.value;
  tab.value = "convert";
  convertStamp();
}
let timer: ReturnType<typeof setInterval> | undefined;
function tick() {
  if (!paused.value) now.value = Date.now();
}
function toggleClock() {
  paused.value = !paused.value;
  if (!paused.value) tick();
}
onMounted(() => {
  tick();
  timer = setInterval(tick, 1000);
  document.addEventListener("visibilitychange", tick);
});
onUnmounted(() => {
  clearInterval(timer);
  document.removeEventListener("visibilitychange", tick);
});

const inputStamp = ref(String(Math.floor(now.value / 1000))),
  inputDate = ref(clock.value.dateTime);
const inputUnit = ref<TimestampUnit>("seconds");
type Details = ReturnType<typeof timestampDetails>;
const stampResult = ref<Details | null>(null);
const dateResult = ref<Details | null>(null);
const dateOutput = computed(() => dateResult.value?.[outputUnit.value] || "");
const stampError = ref(""),
  dateError = ref(""),
  resolvedUnit = ref("seconds");
function convertStamp() {
  stampResult.value = null;
  stampError.value = "";
  try {
    const result = readTimestamp(inputStamp.value, inputUnit.value);
    resolvedUnit.value = result.unit;
    stampResult.value = timestampDetails(result.milliseconds, stampZone.value);
  } catch (e) {
    stampError.value = e instanceof Error ? e.message : "转换失败";
  }
}
function convertDate() {
  dateResult.value = null;
  dateError.value = "";
  try {
    dateResult.value = timestampDetails(
      readDateTime(inputDate.value, dateZone.value),
      dateZone.value,
    );
  } catch (e) {
    dateError.value = e instanceof Error ? e.message : "转换失败";
  }
}
function useCurrentStamp() {
  inputStamp.value =
    inputUnit.value === "milliseconds"
      ? clock.value.milliseconds
      : clock.value.seconds;
  convertStamp();
}
function useCurrentDate() {
  inputDate.value = timestampDetails(now.value, dateZone.value).dateTime;
  convertDate();
}
watch(
  [inputStamp, inputUnit],
  () => {
    stampResult.value = null;
    stampError.value = "";
  },
  { flush: "sync" },
);
watch(
  inputDate,
  () => {
    dateResult.value = null;
    dateError.value = "";
  },
  { flush: "sync" },
);
watch(stampZone, () => {
  if (stampResult.value) convertStamp();
});
watch(dateZone, () => {
  if (dateResult.value) convertDate();
});

const batchInput = ref(""),
  batchDirection = ref<"to-date" | "to-stamp">("to-date"),
  batchUnit = ref<TimestampUnit>("auto");
const batchRows = ref<ReturnType<typeof batchTimestamps>>([]),
  batchError = ref("");
const batchSuccess = computed(
  () => batchRows.value.filter((r) => !r.error).length,
);
const batchOutput = computed(() =>
  batchRows.value
    .map((r) => (r.error ? `第 ${r.line} 行：${r.error}` : r.output))
    .join("\n"),
);
function clearBatch() {
  batchRows.value = [];
  batchError.value = "";
}
watch([batchInput, batchDirection, batchUnit, batchZone], clearBatch, {
  flush: "sync",
});
watch(batchDirection, () => {
  if (batchDirection.value === "to-stamp" && batchUnit.value === "auto")
    batchUnit.value = "seconds";
});
function runBatch() {
  clearBatch();
  try {
    batchRows.value = batchTimestamps(
      batchInput.value,
      batchDirection.value,
      batchUnit.value,
      batchZone.value,
    );
  } catch (e) {
    batchError.value = e instanceof Error ? e.message : "转换失败";
  }
}
function batchExample() {
  batchInput.value =
    batchDirection.value === "to-date"
      ? batchUnit.value === "milliseconds"
        ? "0\n1735689600123\n" + clock.value.milliseconds
        : batchUnit.value === "seconds"
          ? "0\n1735689600\n" + clock.value.seconds
          : "0\n1735689600\n1735689600123"
      : "2025-01-01 08:00:00\n2025-01-01T00:00:00Z\n" +
        timestampDetails(now.value, batchZone.value).dateTime;
}
const dayStart = ref(""),
  dayEnd = ref("");
const dayResult = computed(() => {
  if (!dayStart.value || !dayEnd.value) return { days: null, error: "" };
  try {
    return { days: calendarDays(dayStart.value, dayEnd.value), error: "" };
  } catch (e) {
    return { days: null, error: e instanceof Error ? e.message : "日期无效" };
  }
});
const language = ref("JavaScript");
const snippets = [
  {
    name: "JavaScript",
    code: "const milliseconds = Date.now();\nconst seconds = Math.floor(milliseconds / 1000);\n\n// 秒时间戳 → UTC 日期\nnew Date(seconds * 1000).toISOString();",
    url: "https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Date/now",
  },
  {
    name: "Python",
    code: "import time\nfrom datetime import datetime, timezone\n\nns = time.time_ns()\nseconds = ns // 1_000_000_000\nmilliseconds = ns // 1_000_000\n\n# 秒时间戳 → UTC 日期\ndatetime.fromtimestamp(seconds, timezone.utc).isoformat()",
    url: "https://docs.python.org/3/library/time.html#time.time_ns",
  },
  {
    name: "Java",
    code: "import java.time.Instant;\n\nInstant now = Instant.now();\nlong seconds = now.getEpochSecond();\nlong milliseconds = now.toEpochMilli();\n\n// 秒时间戳 → UTC 日期\nInstant.ofEpochSecond(seconds).toString();",
    url: "https://docs.oracle.com/en/java/javase/21/docs/api/java.base/java/time/Instant.html",
  },
  {
    name: "Go",
    code: 'import "time"\n\nnow := time.Now()\nseconds := now.Unix()\nmilliseconds := now.UnixMilli()\n\n// 秒时间戳 → UTC 日期\ntime.Unix(seconds, 0).UTC().Format(time.RFC3339)',
    url: "https://pkg.go.dev/time#Time.UnixMilli",
  },
];
const snippet = computed(() =>
  snippets.find((s) => s.name === language.value)!,
);
</script>

<template>
  <div class="tool-workspace timestamp-workspace">
    <section class="unix-live" aria-label="当前时间戳">
      <div class="unix-live-value">
        <span>当前时间戳</span>
        <div>
          <button
            class="unix-number"
            title="填入转换输入"
            @click="fillLive"
            aria-label="将当前时间戳填入转换输入"
          >
            {{ currentValue }}</button
          ><span class="unix-unit">{{
            liveUnit === "seconds" ? "秒" : "毫秒"
          }}</span>
        </div>
        <time :datetime="clock.iso"
          >{{ clock.date }} {{ clock.time }} · 北京时间</time
        >
      </div>
      <div class="unix-live-buttons">
        <button
          class="button secondary"
          @click="
            liveUnit = liveUnit === 'seconds' ? 'milliseconds' : 'seconds'
          "
        >
          切换单位
        </button>
        <button class="button secondary" @click="copy(currentValue)">
          <Icon name="Copy" :size="15" />复制
        </button>
        <button
          class="button secondary"
          :aria-pressed="paused"
          @click="toggleClock"
        >
          <Icon :name="paused ? 'Play' : 'Pause'" :size="15" />{{
            paused ? "继续" : "暂停"
          }}
        </button>
      </div>
    </section>
    <div class="unix-tabs" role="tablist" aria-label="时间戳操作">
      <button
        v-for="item in [
          ['convert', '单个转换'],
          ['batch', '批量转换'],
        ]"
        :key="item[0]"
        role="tab"
        :aria-selected="tab === item[0]"
        :class="{ active: tab === item[0] }"
        @click="tab = item[0]!"
      >
        {{ item[1] }}
      </button>
    </div>
    <div v-if="tab === 'convert'" class="unix-convert">
      <section class="unix-section" aria-label="时间戳转日期时间">
        <h2><Icon name="Timer" :size="18" />时间戳转日期时间</h2>
        <form class="unix-form unix-stamp-form" @submit.prevent="convertStamp">
          <label class="unix-field"
            >时间戳<input
              v-model="inputStamp"
              placeholder="输入时间戳"
              inputmode="numeric"
              autocomplete="off"
              maxlength="30"
              aria-label="待转换时间戳"
          /></label>
          <label class="unix-field"
            >单位<select v-model="inputUnit" aria-label="输入时间戳单位">
              <option value="seconds">秒（s）</option>
              <option value="milliseconds">毫秒（ms）</option>
              <option value="auto">自动识别</option>
            </select></label
          >
          <label class="unix-field"
            >时区<select v-model="stampZone" aria-label="时间戳转换时区">
              <option v-for="item in zoneChoices" :key="item" :value="item">
                {{ item }}
              </option>
            </select></label
          >
          <button
            type="button"
            class="button secondary"
            @click="useCurrentStamp"
          >
            填入当前
          </button>
          <button type="submit" class="button primary">转换</button>
        </form>
        <p v-if="stampError" class="error-message" role="alert">
          {{ stampError }}
        </p>
        <label class="unix-result-label" for="unix-date-result"
          >转换结果
          <span v-if="stampResult"
            >{{ stampResult.offset
            }}{{
              inputUnit === "auto"
                ? " · 已识别为" + (resolvedUnit === "seconds" ? "秒" : "毫秒")
                : ""
            }}</span
          ></label
        >
        <div class="unix-result-row">
          <input
            id="unix-date-result"
            :value="stampResult?.dateTime || ''"
            readonly
            placeholder="转换结果"
            aria-label="日期转换结果"
          />
          <button
            class="button secondary"
            :disabled="!stampResult"
            @click="stampResult && copy(stampResult.dateTime)"
            aria-label="复制日期转换结果"
          >
            <Icon name="Copy" :size="15" />复制
          </button>
        </div>
        <details v-if="stampResult" class="unix-extra-result">
          <summary>查看 UTC / ISO 8601</summary>
          <div class="unix-result-row">
            <input
              :value="stampResult.iso"
              aria-label="UTC ISO 日期结果"
              readonly
            /><button class="button secondary" @click="copy(stampResult.iso)">
              复制 ISO
            </button>
          </div>
        </details>
      </section>
      <section class="unix-section" aria-label="日期时间转时间戳">
        <h2><Icon name="CalendarDays" :size="18" />日期时间转时间戳</h2>
        <form class="unix-form unix-date-form" @submit.prevent="convertDate">
          <label class="unix-field"
            >日期时间<input
              v-model="inputDate"
              placeholder="YYYY-MM-DD HH:mm:ss"
              autocomplete="off"
              maxlength="60"
              aria-label="待转换日期时间"
          /></label>
          <label class="unix-field"
            >时区<select v-model="dateZone" aria-label="日期转换时区">
              <option v-for="item in zoneChoices" :key="item" :value="item">
                {{ item }}
              </option>
            </select></label
          >
          <button
            type="button"
            class="button secondary"
            @click="useCurrentDate"
          >
            填入当前
          </button>
          <button type="submit" class="button primary">转换</button>
        </form>
        <p v-if="dateError" class="error-message" role="alert">
          {{ dateError }}
        </p>
        <label class="unix-result-label" for="unix-stamp-result"
          >转换结果</label
        >
        <div class="unix-result-row unix-stamp-result">
          <input
            id="unix-stamp-result"
            :value="dateOutput"
            readonly
            placeholder="转换结果"
            aria-label="时间戳转换结果"
          />
          <select v-model="outputUnit" aria-label="输出时间戳单位">
            <option value="seconds">秒（s）</option>
            <option value="milliseconds">毫秒（ms）</option>
          </select>
          <button
            class="button secondary"
            :disabled="!dateResult"
            @click="copy(dateOutput)"
            aria-label="复制时间戳转换结果"
          >
            <Icon name="Copy" :size="15" />复制
          </button>
        </div>
        <p class="unix-help">
          支持毫秒、ISO 8601
          和带时区的日期。未指定偏移时，按上面选择的时区转换。
        </p>
      </section>
    </div>

    <template v-else-if="tab === 'batch'">
      <div class="tool-toolbar timestamp-batch-options">
        <div class="toolbar-options">
          <label class="inline-label"
            >转换方向<select v-model="batchDirection">
              <option value="to-date">时间戳 → 日期</option>
              <option value="to-stamp">日期 → 时间戳</option>
            </select></label
          ><label class="inline-label"
            >{{ batchDirection === "to-date" ? "时间戳单位" : "输出单位"
            }}<select v-model="batchUnit">
              <option v-if="batchDirection === 'to-date'" value="auto">
                自动识别
              </option>
              <option value="seconds">秒</option>
              <option value="milliseconds">毫秒</option>
            </select></label
          >
        </div>
        <button class="text-button" @click="batchExample">填入示例</button>
      </div>
      <div class="unix-batch-actions">
        <label class="unix-field"
          >时区<select v-model="batchZone" aria-label="批量转换时区">
            <option v-for="item in zoneChoices" :key="item" :value="item">
              {{ item }}
            </option>
          </select></label
        >
        <button class="button primary" @click="runBatch">开始转换</button>
        <button class="button secondary" @click="batchInput = ''">清空</button>
        <button
          class="button secondary"
          :disabled="!batchRows.length"
          @click="copy(batchOutput)"
        >
          复制结果
        </button>
        <button
          class="button secondary"
          :disabled="!batchRows.length"
          @click="downloadText(batchOutput, 'timestamps.txt')"
        >
          下载结果
        </button>
      </div>
      <div class="editor-grid">
        <EditorPanel
          v-model="batchInput"
          title="批量输入"
          placeholder="每行一条，最多 1,000 行；支持混合秒与毫秒自动识别"
          code
        /><EditorPanel
          :model-value="batchOutput"
          title="批量转换结果"
          readonly
          code
          filename="timestamps.txt"
        />
      </div>
      <p v-if="batchRows.length" class="unix-batch-status" role="status">
        成功 {{ batchSuccess }} 条 · 失败
        {{ batchRows.length - batchSuccess }} 条
      </p>
      <p v-if="batchError" role="alert" class="error-message">
        {{ batchError }}
      </p>
      <div class="workspace-footnote">
        空行跳过；错误标明原始行号，其余行继续转换。结果顺序与输入一致。
      </div>
    </template>

    <div class="unix-secondary-tabs" aria-label="其他时间工具">
      <button
        class="text-button"
        @click="tab = tab === 'difference' ? 'convert' : 'difference'"
      >
        日期差计算</button
      ><button
        class="text-button"
        @click="tab = tab === 'code' ? 'convert' : 'code'"
      >
        获取时间戳代码
      </button>
    </div>

    <div v-if="tab === 'difference'" class="date-difference">
      <div class="two-fields">
        <label class="field-label"
          >开始日期<input v-model="dayStart" type="date" /></label
        ><label class="field-label"
          >结束日期<input v-model="dayEnd" type="date"
        /></label>
      </div>
      <div class="difference-result">
        <span>两个日期相差</span
        ><strong
          >{{ dayResult.days === null ? "—" : Math.abs(dayResult.days)
          }}<small>天</small></strong
        >
        <p>
          {{
            dayResult.days === null
              ? "选择两个日期，自动计算相差天数"
              : dayResult.days < 0
                ? "结束日期早于开始日期"
                : dayResult.days === 0
                  ? "这两个日期是同一天"
                  : "按日历日期计算，不包含开始当天"
          }}
        </p>
      </div>
      <p v-if="dayResult.error" class="error-message" role="alert">
        {{ dayResult.error }}
      </p>
    </div>

    <section
      v-else-if="tab === 'code'"
      class="timestamp-code"
      aria-label="获取当前时间戳的代码"
    >
      <div class="timestamp-section-heading">
        <label class="inline-label"
          >编程语言<select v-model="language">
            <option v-for="item in snippets" :key="item.name">
              {{ item.name }}
            </option>
          </select></label
        ><button class="button secondary" @click="copy(snippet.code)">
          <Icon name="Copy" :size="15" />复制代码
        </button>
      </div>
      <pre><code>{{ snippet.code }}</code></pre>
      <a :href="snippet.url" target="_blank" rel="noopener noreferrer"
        >查看 {{ language }} 官方说明 ↗</a
      >
    </section>
    <details class="timestamp-notes">
      <summary>时间戳与转换说明</summary>
      <p>
        Unix 时间戳从 1970-01-01 00:00:00 UTC 起计时。1 秒 = 1,000 毫秒；1970
        年之前可用负数表示。
      </p>
      <p>
        自动模式将不超过 10 位的整数按秒、13
        位按毫秒处理；其他位数请手动指定单位。秒输出向下取整，毫秒输出保留完整精度。
      </p>
      <p>
        实时数字来自设备时钟。暂停后，“填入当前”使用已固定的数值；继续后恢复实时时间。转换采用所选时区的历史规则，夏令时造成的不存在或重复时间会明确提示。
      </p>
    </details>
  </div>
</template>

<style scoped>
.timestamp-workspace {
  padding: 18px;
  border-radius: 14px;
  color: var(--text);
}
.unix-live {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 20px;
  background: var(--code-bg);
  border: 1px solid var(--border);
  border-radius: 12px;
  padding: 14px 18px;
}
.unix-live-value > span {
  font-size: 12px;
  color: var(--muted);
}
.unix-live-value > div {
  display: flex;
  align-items: center;
  gap: 10px;
}
.unix-number {
  border: 0;
  padding: 2px 0;
  background: transparent;
  color: var(--text);
  font:
    700 clamp(23px, 2.5vw, 30px)/1.4 ui-monospace,
    monospace;
  font-variant-numeric: tabular-nums;
  cursor: pointer;
}
.unix-unit {
  color: var(--primary);
  background: var(--tint);
  font-size: 12px;
  border-radius: 4px;
  padding: 2px 6px;
}
.unix-live time {
  color: var(--subtle);
  font-size: 12px;
  font-variant-numeric: tabular-nums;
}
.unix-live-buttons {
  display: flex;
  gap: 8px;
}
.timestamp-workspace .button {
  min-height: 40px;
  font-size: 13px;
  padding: 8px 14px;
  white-space: nowrap;
  gap: 7px;
  border-radius: 8px;
}
.unix-tabs {
  display: flex;
  background: var(--code-bg);
  padding: 4px;
  border-radius: 9px;
  margin-top: 14px;
}
.unix-tabs button {
  flex: 1;
  border: 1px solid transparent;
  border-radius: 7px;
  padding: 9px 12px;
  background: transparent;
  color: var(--subtle);
  font-size: 14px;
  cursor: pointer;
}
.unix-tabs button.active {
  background: var(--surface);
  color: var(--text);
  border-color: var(--border);
  box-shadow: 0 1px 3px #00000009;
}
.unix-section {
  padding: 22px 0;
}
.unix-section + .unix-section {
  border-top: 1px solid var(--border);
}
.unix-section h2 {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 15px;
  margin: 0 0 22px;
  font-weight: 600;
}
.unix-section h2 svg {
  color: var(--primary);
}
.unix-form {
  display: grid;
  gap: 10px;
  align-items: end;
}
.unix-stamp-form {
  grid-template-columns:
    minmax(140px, 1fr) 120px minmax(150px, 200px)
    auto auto;
}
.unix-date-form {
  grid-template-columns: minmax(200px, 1fr) minmax(150px, 200px) auto auto;
}
.unix-field {
  display: flex;
  flex-direction: column;
  gap: 8px;
  min-width: 0;
  font-size: 12px;
  color: var(--subtle);
}
.unix-field input,
.unix-field select,
.unix-result-row input,
.unix-result-row select {
  width: 100%;
  min-width: 0;
  height: 40px;
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 8px 12px;
  font:
    14px/1.5 ui-monospace,
    monospace;
  color: var(--text);
  background: var(--surface);
}
.unix-field select,
.unix-result-row select {
  font-family: inherit;
}
.unix-result-label {
  display: flex;
  justify-content: space-between;
  font-size: 12px;
  color: var(--subtle);
  margin: 13px 0 8px;
}
.unix-result-label span {
  color: var(--primary);
}
.unix-result-row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 10px;
}
.unix-stamp-result {
  grid-template-columns: minmax(0, 1fr) 130px auto;
}
.unix-result-row input {
  background: var(--surface);
}
.unix-extra-result {
  margin-top: 12px;
  color: var(--subtle);
  font-size: 12px;
}
.unix-extra-result summary {
  cursor: pointer;
  margin-bottom: 8px;
}
.unix-help {
  font-size: 12px;
  color: var(--subtle);
  margin: 12px 0 0;
  line-height: 1.6;
}
.unix-secondary-tabs {
  display: flex;
  gap: 24px;
  padding: 8px 0 14px;
}
.unix-secondary-tabs button {
  font-size: 13px;
}
.unix-batch-actions {
  display: flex;
  align-items: flex-end;
  gap: 10px;
  padding: 16px 0;
  flex-wrap: wrap;
}
.unix-batch-actions .unix-field {
  flex: 1;
  min-width: 180px;
  max-width: 280px;
}
.unix-batch-status {
  font-size: 13px;
  color: var(--primary);
  padding: 12px 0;
}
.timestamp-workspace .timestamp-batch-options {
  padding: 18px 0 12px;
}
.timestamp-workspace .timestamp-notes {
  padding: 16px 0 0;
}
.timestamp-workspace .timestamp-notes p {
  font-size: 12px;
}
@media (max-width: 1100px) {
  .unix-stamp-form {
    grid-template-columns: minmax(140px, 1fr) 110px minmax(140px, 180px);
  }
  .unix-date-form {
    grid-template-columns: minmax(180px, 1fr) minmax(140px, 180px);
  }
  .unix-form > button {
    grid-row: 2;
  }
}
@media (max-width: 600px) {
  .timestamp-workspace {
    padding: 14px;
  }
  .unix-live {
    align-items: flex-start;
    flex-direction: column;
    gap: 12px;
    padding: 14px;
  }
  .unix-live-buttons {
    width: 100%;
  }
  .unix-live-buttons button {
    flex: 1;
  }
  .unix-form {
    grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
  }
  .unix-form .unix-field:first-child {
    grid-column: 1 / -1;
  }
  .unix-form > button {
    grid-row: auto;
  }
  .unix-date-form .unix-field:nth-child(2) {
    grid-column: 1 / -1;
  }
  .unix-result-row {
    gap: 8px;
  }
  .unix-stamp-result {
    grid-template-columns: minmax(0, 1fr) 120px;
  }
  .unix-stamp-result button {
    grid-column: 1 / -1;
  }
  .unix-section h2 {
    margin-bottom: 18px;
  }
}
</style>
