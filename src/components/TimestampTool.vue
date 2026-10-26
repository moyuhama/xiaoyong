<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from "vue";
import Icon from "./Icon.vue";
import EditorPanel from "./EditorPanel.vue";
import { copy } from "../lib/ui";
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
const inputUnit = ref<TimestampUnit>("auto");
type Details = ReturnType<typeof timestampDetails>;
const stampResult = ref<Details | null>(
  timestampDetails(Math.floor(now.value / 1000) * 1000, zone.value),
);
const dateResult = ref<Details | null>(clock.value);
const stampError = ref(""),
  dateError = ref(""),
  resolvedUnit = ref("seconds");
function convertStamp() {
  stampResult.value = null;
  stampError.value = "";
  try {
    const result = readTimestamp(inputStamp.value, inputUnit.value);
    resolvedUnit.value = result.unit;
    stampResult.value = timestampDetails(result.milliseconds, zone.value);
  } catch (e) {
    stampError.value = e instanceof Error ? e.message : "转换失败";
  }
}
function convertDate() {
  dateResult.value = null;
  dateError.value = "";
  try {
    dateResult.value = timestampDetails(
      readDateTime(inputDate.value, zone.value),
      zone.value,
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
  inputDate.value = clock.value.dateTime;
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
watch(zone, () => {
  if (inputStamp.value.trim()) convertStamp();
  if (inputDate.value.trim()) convertDate();
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
watch([batchInput, batchDirection, batchUnit, zone], clearBatch, {
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
      zone.value,
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
      : "2025-01-01 08:00:00\n2025-01-01T00:00:00Z\n" + clock.value.dateTime;
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
    <section class="timestamp-live" aria-label="当前时间戳">
      <div class="timestamp-live-heading">
        <h2>
          <span class="timestamp-dot" :class="{ paused }"></span>当前时间戳
        </h2>
        <div class="timestamp-live-actions">
          <span>{{ paused ? "已暂停 · 数值已固定" : "实时 · 每秒更新" }}</span>
          <button class="button secondary" @click="toggleClock">
            <Icon :name="paused ? 'Play' : 'Pause'" :size="14" />{{
              paused ? "继续" : "暂停"
            }}
          </button>
        </div>
      </div>
      <div class="timestamp-clock-grid">
        <div class="timestamp-clock-card">
          <label for="current-seconds">Unix 时间戳 · 秒</label>
          <input
            id="current-seconds"
            :value="clock.seconds"
            readonly
            aria-label="当前秒级时间戳"
          />
          <button
            class="text-button"
            @click="copy(clock.seconds)"
            aria-label="复制当前秒级时间戳"
          >
            <Icon name="Copy" :size="14" />复制秒
          </button>
        </div>
        <div class="timestamp-clock-card">
          <label for="current-milliseconds">时间戳 · 毫秒</label>
          <input
            id="current-milliseconds"
            :value="clock.milliseconds"
            readonly
            aria-label="当前毫秒级时间戳"
          />
          <button
            class="text-button"
            @click="copy(clock.milliseconds)"
            aria-label="复制当前毫秒级时间戳"
          >
            <Icon name="Copy" :size="14" />复制毫秒
          </button>
        </div>
      </div>
      <div class="timestamp-clock-date">
        <time :datetime="clock.iso">{{ clock.date }} {{ clock.time }}</time>
        <span>{{ clock.offset }}</span>
        <button
          class="icon-button"
          aria-label="复制当前日期时间"
          @click="copy(clock.dateTime)"
        >
          <Icon name="Copy" :size="15" />
        </button>
      </div>
      <div class="timestamp-zone-row">
        <label class="inline-label"
          >时区<select v-model="timezone">
            <option v-for="item in zones" :key="item.zone" :value="item.zone">
              {{ item.name }}
            </option>
          </select></label
        >
        <span class="muted">{{ zone }} · 时区改变日期显示，时间戳不变</span>
      </div>
    </section>

    <div class="tool-toolbar timestamp-tabs">
      <div class="segmented" aria-label="时间工具功能">
        <button
          v-for="item in [
            ['convert', '双向转换'],
            ['batch', '批量转换'],
            ['difference', '日期差计算'],
            ['code', '代码示例'],
          ]"
          :key="item[0]"
          :class="{ active: tab === item[0] }"
          :aria-pressed="tab === item[0]"
          @click="tab = item[0]!"
        >
          {{ item[1] }}
        </button>
      </div>
    </div>

    <div v-if="tab === 'convert'" class="timestamp-converters">
      <section class="timestamp-converter" aria-label="时间戳转日期">
        <div class="timestamp-section-heading">
          <h2>时间戳 → 日期时间</h2>
          <button class="text-button" @click="useCurrentStamp">
            填入当前时间戳
          </button>
        </div>
        <form @submit.prevent="convertStamp">
          <label class="field-label"
            >时间戳<input
              v-model="inputStamp"
              placeholder="粘贴秒或毫秒时间戳"
              inputmode="numeric"
              autocomplete="off"
              maxlength="30"
          /></label>
          <label class="field-label"
            >输入单位<select v-model="inputUnit">
              <option value="auto">自动识别 · 秒 / 毫秒</option>
              <option value="seconds">秒（s）</option>
              <option value="milliseconds">毫秒（ms）</option>
            </select></label
          >
          <div class="timestamp-form-actions">
            <button class="button primary" type="submit">
              转换为日期<Icon name="ArrowRight" :size="15" /></button
            ><button
              type="button"
              class="text-button"
              @click="inputStamp = ''"
              aria-label="清空时间戳"
            >
              清空
            </button>
          </div>
        </form>
        <p v-if="stampError" role="alert" class="error-message">
          {{ stampError }}
        </p>
        <div
          v-if="stampResult"
          class="timestamp-result"
          aria-label="日期转换结果"
        >
          <div class="timestamp-result-heading">
            <span
              >{{ inputUnit === "auto" ? "已识别为" : "按"
              }}{{ resolvedUnit === "seconds" ? "秒" : "毫秒" }}</span
            ><span>{{ stampResult.offset }}</span>
          </div>
          <label class="field-label"
            >所选时区日期<span class="timestamp-copy-value"
              ><input
                :value="stampResult.dateTime"
                aria-label="所选时区日期"
                readonly /><button
                class="icon-button"
                aria-label="复制日期结果"
                @click="copy(stampResult.dateTime)"
              >
                <Icon name="Copy" :size="15" /></button></span
          ></label>
          <label class="field-label"
            >UTC · ISO 8601<span class="timestamp-copy-value"
              ><input
                :value="stampResult.iso"
                aria-label="UTC ISO 日期结果"
                readonly /><button
                class="icon-button"
                aria-label="复制 ISO 日期结果"
                @click="copy(stampResult.iso)"
              >
                <Icon name="Copy" :size="15" /></button></span
          ></label>
        </div>
        <p v-else-if="!stampError" class="timestamp-empty">
          输入时间戳，点击转换或按 Enter
        </p>
      </section>
      <section class="timestamp-converter" aria-label="日期转时间戳">
        <div class="timestamp-section-heading">
          <h2>日期时间 → 时间戳</h2>
          <button class="text-button" @click="useCurrentDate">
            填入当前日期时间
          </button>
        </div>
        <form @submit.prevent="convertDate">
          <label class="field-label"
            >日期和时间<input
              v-model="inputDate"
              placeholder="2026-10-27 12:00:00.123"
              autocomplete="off"
              maxlength="60"
          /></label>
          <p class="timestamp-input-help">
            支持粘贴日期、毫秒或 ISO 格式。未带时区时按 {{ zone }} 解释；Z /
            +08:00 等明确偏移优先。
          </p>
          <div class="timestamp-form-actions">
            <button class="button primary" type="submit">
              转换为时间戳<Icon name="ArrowRight" :size="15" /></button
            ><button
              type="button"
              class="text-button"
              @click="inputDate = ''"
              aria-label="清空日期时间"
            >
              清空
            </button>
          </div>
        </form>
        <p v-if="dateError" role="alert" class="error-message">
          {{ dateError }}
        </p>
        <div
          v-if="dateResult"
          class="timestamp-result"
          aria-label="时间戳转换结果"
        >
          <div class="timestamp-result-heading">
            <span>同时输出两种单位</span>
          </div>
          <label class="field-label"
            >秒时间戳<span class="timestamp-copy-value"
              ><input
                :value="dateResult.seconds"
                aria-label="秒时间戳结果"
                readonly /><button
                class="icon-button"
                aria-label="复制秒时间戳结果"
                @click="copy(dateResult.seconds)"
              >
                <Icon name="Copy" :size="15" /></button></span
          ></label>
          <label class="field-label"
            >毫秒时间戳<span class="timestamp-copy-value"
              ><input
                :value="dateResult.milliseconds"
                aria-label="毫秒时间戳结果"
                readonly /><button
                class="icon-button"
                aria-label="复制毫秒时间戳结果"
                @click="copy(dateResult.milliseconds)"
              >
                <Icon name="Copy" :size="15" /></button></span
          ></label>
        </div>
        <p v-else-if="!dateError" class="timestamp-empty">
          输入日期时间，点击转换或按 Enter
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
      <div class="action-row">
        <button class="button primary" @click="runBatch">
          批量转换<Icon name="ArrowRight" :size="15" /></button
        ><button class="button secondary" @click="batchInput = ''">
          清空输入</button
        ><span v-if="batchRows.length" class="muted" role="status"
          >成功 {{ batchSuccess }} 条 · 失败
          {{ batchRows.length - batchSuccess }} 条</span
        >
      </div>
      <p v-if="batchError" role="alert" class="error-message">
        {{ batchError }}
      </p>
      <div class="workspace-footnote">
        空行跳过；错误标明原始行号，其余行继续转换。结果顺序与输入一致。
      </div>
    </template>

    <div v-else-if="tab === 'difference'" class="date-difference">
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

    <section v-else class="timestamp-code" aria-label="获取当前时间戳的代码">
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
