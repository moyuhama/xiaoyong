<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from "vue";
import Icon from "./Icon.vue";
import { worldCities, zonedTime, durationText } from "../lib/time-tools";
import { parseDateInput } from "../lib/transform";
import { copy, notify, downloadText } from "../lib/ui";
const props = defineProps<{ toolId: string }>();
const clockView = ref("table");
const now = ref(Date.now()),
  reference = ref(""),
  fixed = ref(false),
  selected = ref([
    "Asia/Shanghai",
    "Asia/Tokyo",
    "Europe/London",
    "America/New_York",
    "America/Los_Angeles",
    "Australia/Sydney",
  ]),
  addZone = ref("UTC");
const deviceZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
const referenceValue = computed(() => {
  try {
    return {
      value: fixed.value
        ? parseDateInput(reference.value, false).getTime()
        : now.value,
      error: "",
    };
  } catch (err) {
    return {
      value: null,
      error: err instanceof Error ? err.message : "请选择有效时间",
    };
  }
});
const cards = computed(() =>
  referenceValue.value.value === null
    ? []
    : selected.value.map((zone) => ({
        ...worldCities.find((city) => city.zone === zone)!,
        ...zonedTime(referenceValue.value.value!, zone),
      })),
);
const available = computed(() =>
  worldCities.filter((city) => !selected.value.includes(city.zone)),
);
function addCity() {
  if (!selected.value.includes(addZone.value))
    selected.value.push(addZone.value);
  addZone.value = available.value[0]?.zone || "";
}
function setReference() {
  fixed.value = !fixed.value;
  if (fixed.value) {
    const date = new Date();
    reference.value = new Date(
      date.getTime() - date.getTimezoneOffset() * 60000,
    )
      .toISOString()
      .slice(0, 19);
  }
}
const mode = ref("countdown"),
  minutes = ref(5),
  seconds = ref(0),
  status = ref("idle"),
  remaining = ref(300000),
  elapsed = ref(0),
  laps = ref<number[]>([]),
  error = ref("");
let deadline = 0,
  started = 0,
  accumulated = 0,
  interval: ReturnType<typeof setInterval> | undefined;
function configured() {
  if (
    !Number.isInteger(minutes.value) ||
    !Number.isInteger(seconds.value) ||
    minutes.value < 0 ||
    minutes.value > 1440 ||
    seconds.value < 0 ||
    seconds.value > 59
  )
    throw new Error("分钟需为 0–1440 的整数，秒数需为 0–59 的整数");
  const value = (minutes.value * 60 + seconds.value) * 1000;
  if (value < 1000 || value > 86400000)
    throw new Error("倒计时需在 1 秒到 24 小时之间");
  return value;
}
function reset() {
  status.value = "idle";
  elapsed.value = 0;
  accumulated = 0;
  laps.value = [];
  error.value = "";
  try {
    remaining.value = configured();
  } catch {
    remaining.value = 0;
  }
}
function tick() {
  now.value = Date.now();
  if (status.value !== "running") return;
  if (mode.value === "countdown") {
    remaining.value = Math.max(0, deadline - Date.now());
    if (remaining.value === 0) {
      status.value = "done";
      notify("倒计时结束");
    }
  } else elapsed.value = accumulated + performance.now() - started;
}
function toggle() {
  error.value = "";
  if (status.value === "running") {
    tick();
    if (status.value === "running") {
      status.value = "paused";
      accumulated = elapsed.value;
    }
    return;
  }
  try {
    if (mode.value === "countdown") {
      if (status.value !== "paused") remaining.value = configured();
      deadline = Date.now() + remaining.value;
    } else started = performance.now();
    status.value = "running";
  } catch (err) {
    error.value = err instanceof Error ? err.message : "请检查时间";
  }
}
function lap() {
  tick();
  if (laps.value.length < 100) laps.value.unshift(elapsed.value);
}
watch([minutes, seconds], () => {
  if (status.value === "idle" || status.value === "done") reset();
});
watch(mode, reset);
onMounted(() => {
  interval = setInterval(
    props.toolId === "world-clock"
      ? () => {
          now.value = Date.now();
        }
      : tick,
    props.toolId === "world-clock" ? 1000 : 50,
  );
});
onUnmounted(() => clearInterval(interval));
</script>
<template>
  <div class="tool-workspace">
    <template v-if="toolId === 'world-clock'">
      <div class="tool-toolbar">
        <span class="muted">{{
          fixed ? "指定时刻" : "当前时间 · 每秒更新"
        }}</span
        ><button class="text-button" @click="setReference">
          {{ fixed ? "返回实时" : "指定对比时刻" }}
        </button>
      </div>
      <div class="settings-panel clock-settings">
        <label v-if="fixed" class="field-label"
          >参考时间（{{ deviceZone }}）<input
            v-model="reference"
            type="datetime-local"
            step="1"
        /></label>
        <div class="toolbar-options">
          <label class="inline-label"
            >添加城市<select
              v-model="addZone"
              aria-label="添加城市"
              :disabled="!available.length"
            >
              <option
                v-for="city in available"
                :key="city.zone"
                :value="city.zone"
              >
                {{ city.name }}
              </option>
            </select></label
          ><button
            class="button secondary"
            :disabled="!available.length || !addZone"
            @click="addCity"
          >
            <Icon name="Plus" :size="16" />添加
          </button>
        </div>
      </div>
      <p v-if="referenceValue.error" role="alert" class="error-message">
        {{ referenceValue.error }}
      </p>
      <div class="tool-toolbar">
        <div class="mode-buttons">
          <button
            :class="{ active: clockView === 'table' }"
            @click="clockView = 'table'"
          >
            时区对照表</button
          ><button
            :class="{ active: clockView === 'cards' }"
            @click="clockView = 'cards'"
          >
            时钟卡片
          </button>
        </div>
        <button
          class="text-button"
          :disabled="!cards.length"
          @click="
            copy(
              cards
                .map(
                  (c) => c.name + ' ' + c.date + ' ' + c.time + ' ' + c.offset,
                )
                .join('\n'),
            )
          "
        >
          复制全部时间
        </button>
      </div>
      <div v-if="clockView === 'table'" class="clock-compare-table">
        <table>
          <thead>
            <tr>
              <th>城市</th>
              <th>时间</th>
              <th>日期</th>
              <th>时区偏移</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="city in cards" :key="city.zone">
              <td>{{ city.name }}</td>
              <td>
                <strong>{{ city.time }}</strong>
              </td>
              <td>{{ city.date }} {{ city.weekday }}</td>
              <td>{{ city.offset }}</td>
              <td>
                <button
                  class="text-button"
                  @click="copy(city.date + ' ' + city.time + ' ' + city.zone)"
                >
                  复制</button
                ><button
                  class="text-button"
                  :aria-label="'移除城市 ' + city.name"
                  @click="
                    selected = selected.filter((z) => z !== city.zone);
                    addZone = available[0]?.zone || '';
                  "
                >
                  移除
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <div v-else class="world-clock-grid">
        <article v-for="city in cards" :key="city.zone" class="city-clock">
          <div class="city-heading">
            <h2>{{ city.name }}</h2>
            <button
              class="icon-button"
              :aria-label="'移除城市 ' + city.name"
              @click="
                selected = selected.filter((zone) => zone !== city.zone);
                addZone = available[0]?.zone || '';
              "
            >
              <Icon name="X" :size="15" />
            </button>
          </div>
          <strong>{{ city.time }}</strong>
          <p>{{ city.date }} · {{ city.weekday }}</p>
          <div class="city-footer">
            <span>{{ city.offset }}</span
            ><button
              class="icon-button"
              :aria-label="'复制 ' + city.name + ' 时间'"
              @click="copy(city.date + ' ' + city.time + ' ' + city.zone)"
            >
              <Icon name="Copy" :size="15" />
            </button>
          </div>
        </article>
      </div>
      <p v-if="!selected.length" class="preview-empty">
        从上方选择一个城市，开始对比时间
      </p>
      <div class="workspace-footnote">
        <Icon name="Info" :size="15" />时区偏移按对应日期计算，包含夏令时变化。
      </div>
    </template>
    <template v-else>
      <div class="tool-toolbar">
        <div class="segmented">
          <button
            :class="{ active: mode === 'countdown' }"
            @click="mode = 'countdown'"
          >
            倒计时</button
          ><button
            :class="{ active: mode === 'stopwatch' }"
            @click="mode = 'stopwatch'"
          >
            秒表
          </button>
        </div>
        <span class="muted">切换模式会重置计时</span>
      </div>
      <div class="timer-panel">
        <template v-if="mode === 'countdown'"
          ><div class="two-fields">
            <label class="field-label"
              >分钟<input
                v-model.number="minutes"
                type="number"
                min="0"
                max="1440"
                :disabled="
                  status === 'running' || status === 'paused'
                " /></label
            ><label class="field-label"
              >秒<input
                v-model.number="seconds"
                type="number"
                min="0"
                max="59"
                :disabled="status === 'running' || status === 'paused'"
            /></label>
          </div>
          <div class="preset-row">
            <button
              v-for="value in [1, 3, 5, 10, 15, 25, 30, 60]"
              :key="value"
              class="button secondary"
              :disabled="status === 'running' || status === 'paused'"
              @click="
                minutes = value;
                seconds = 0;
              "
            >
              {{ value }} 分钟
            </button>
          </div></template
        >
        <div class="timer-display" :class="{ finished: status === 'done' }">
          {{
            mode === "countdown"
              ? durationText(Math.ceil(remaining / 1000) * 1000)
              : durationText(elapsed, true)
          }}
        </div>
        <p class="timer-status" role="status">
          {{
            status === "done"
              ? "时间到"
              : status === "paused"
                ? "已暂停"
                : status === "running"
                  ? "计时中"
                  : "准备就绪"
          }}
        </p>
        <div class="timer-actions">
          <button class="button primary" @click="toggle">
            {{
              status === "running"
                ? "暂停"
                : status === "paused"
                  ? "继续"
                  : status === "done"
                    ? "再来一次"
                    : "开始"
            }}</button
          ><button class="button secondary" @click="reset">重置</button
          ><button
            v-if="mode === 'stopwatch'"
            class="button secondary"
            :disabled="status !== 'running' || laps.length >= 100"
            @click="lap"
          >
            记一圈
          </button>
        </div>
        <p v-if="error" role="alert" class="inline-error">{{ error }}</p>
        <button
          v-if="laps.length"
          class="text-button"
          @click="
            downloadText(
              laps
                .map(
                  (value, index) =>
                    '第 ' +
                    (laps.length - index) +
                    ' 圈：' +
                    durationText(value, true),
                )
                .join('\n'),
              'laps.txt',
            )
          "
        >
          导出计圈记录
        </button>
        <ol v-if="laps.length" class="lap-list">
          <li v-for="(value, index) in laps" :key="laps.length - index">
            <span>第 {{ laps.length - index }} 圈</span
            ><code>{{ durationText(value, true) }}</code>
          </li>
        </ol>
      </div>
      <div class="workspace-footnote">
        <Icon
          name="Info"
          :size="15"
        />离开或关闭此页面会结束计时；倒计时到点后在页面内提示。
      </div>
    </template>
  </div>
</template>
