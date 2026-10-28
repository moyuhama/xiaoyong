<script setup lang="ts">
import { computed, ref, watch } from "vue";
import Icon from "./Icon.vue";
import EditorPanel from "./EditorPanel.vue";
import {
  calculatePercentage,
  convertUnit,
  formatNumber,
  readNumber,
  unitGroups,
  type PercentageMode,
} from "../lib/calculations";
import { drawNames } from "../lib/data-tools";
import { copy } from "../lib/ui";

const props = defineProps<{ toolId: string }>();
const groupId = ref("length"),
  fromId = ref("m"),
  toId = ref("cm"),
  amount = ref("1");
const group = computed(() =>
  unitGroups.find((item) => item.id === groupId.value)!,
);
watch(groupId, () => {
  fromId.value = group.value.units[0]!.id;
  toId.value = group.value.units[1]!.id;
});
const conversion = computed(() => {
  if (!amount.value.trim()) return { result: "", error: "" };
  try {
    return {
      result: formatNumber(
        convertUnit(
          readNumber(amount.value),
          groupId.value,
          fromId.value,
          toId.value,
        ),
      ),
      error: "",
    };
  } catch (err) {
    return {
      result: "",
      error: err instanceof Error ? err.message : "无法换算",
    };
  }
});
const allUnits = computed(() =>
  group.value.units.map((unit) => {
    try {
      return {
        name: unit.name,
        value: amount.value.trim()
          ? formatNumber(
              convertUnit(
                readNumber(amount.value),
                groupId.value,
                fromId.value,
                unit.id,
              ),
            )
          : "—",
      };
    } catch {
      return { name: unit.name, value: "—" };
    }
  }),
);
function swapUnits() {
  const result = conversion.value.result;
  [fromId.value, toId.value] = [toId.value, fromId.value];
  if (result) amount.value = result;
}
const percentageMode = ref<PercentageMode>("portion"),
  first = ref("200"),
  second = ref("15");
const modes = [
  {
    id: "portion",
    name: "求百分数",
    first: "原数值",
    second: "百分比（%）",
    formula: "结果 = 原数值 × 百分比 ÷ 100",
  },
  {
    id: "ratio",
    name: "求占比",
    first: "部分数值",
    second: "总数值",
    formula: "占比 = 部分数值 ÷ 总数值 × 100%",
  },
  {
    id: "change",
    name: "求变化率",
    first: "原值",
    second: "新值",
    formula: "变化率 =（新值 − 原值）÷ 原值 × 100%",
  },
] as const;
const mode = computed(() =>
  modes.find((item) => item.id === percentageMode.value)!,
);
const percentage = computed(() => {
  if (!first.value.trim() || !second.value.trim())
    return { result: "", error: "" };
  try {
    return {
      result: formatNumber(
        calculatePercentage(
          readNumber(first.value),
          readNumber(second.value),
          percentageMode.value,
        ),
      ),
      error: "",
    };
  } catch (err) {
    return {
      result: "",
      error: err instanceof Error ? err.message : "无法计算",
    };
  }
});
function percentageExample() {
  first.value = percentageMode.value === "ratio" ? "30" : "200";
  second.value =
    percentageMode.value === "portion"
      ? "15"
      : percentageMode.value === "ratio"
        ? "200"
        : "250";
}
const candidates = ref(""),
  count = ref(1),
  drawn = ref<string[]>([]),
  drawError = ref("");
const candidateCount = computed(
  () =>
    new Set(
      candidates.value
        .split(/\r?\n/)
        .map((value) => value.trim())
        .filter(Boolean),
    ).size,
);
function draw() {
  drawError.value = "";
  drawn.value = [];
  try {
    drawn.value = drawNames(candidates.value, count.value);
  } catch (err) {
    drawError.value = err instanceof Error ? err.message : "无法抽取";
  }
}
watch([candidates, count], () => {
  drawn.value = [];
  drawError.value = "";
});
</script>

<template>
  <div class="tool-workspace">
    <template v-if="toolId === 'unit-converter'">
      <div class="tool-toolbar">
        <div class="mode-buttons" aria-label="换算类型">
          <button
            v-for="item in unitGroups"
            :key="item.id"
            :class="{ active: groupId === item.id }"
            @click="groupId = item.id"
          >
            {{ item.name }}
          </button>
        </div>
        <button class="text-button" @click="amount = '1'">重置数值</button>
      </div>
      <div class="calculator-panel">
        <label class="field-label"
          >输入数值<input
            v-model="amount"
            inputmode="decimal"
            placeholder="输入数值"
        /></label>
        <div class="unit-selectors">
          <label class="field-label"
            >原单位<select v-model="fromId">
              <option
                v-for="unit in group.units"
                :key="unit.id"
                :value="unit.id"
              >
                {{ unit.name }}
              </option>
            </select></label
          >
          <button
            class="icon-button unit-swap"
            aria-label="交换单位"
            @click="swapUnits"
          >
            <Icon name="Shuffle" :size="20" />
          </button>
          <label class="field-label"
            >目标单位<select v-model="toId">
              <option
                v-for="unit in group.units"
                :key="unit.id"
                :value="unit.id"
              >
                {{ unit.name }}
              </option>
            </select></label
          >
        </div>
        <div v-if="conversion.error" role="alert" class="inline-error">
          {{ conversion.error }}
        </div>
        <div class="calculator-result">
          <span
            >换算结果 ·
            {{ group.units.find((unit) => unit.id === toId)?.name }}</span
          ><strong>{{ conversion.result || "—" }}</strong
          ><button
            class="text-button"
            :disabled="!conversion.result"
            @click="copy(conversion.result)"
          >
            <Icon name="Copy" :size="15" />复制结果
          </button>
        </div>
      </div>
      <div class="unit-overview">
        <button
          v-for="unit in allUnits"
          :key="unit.name"
          :disabled="unit.value === '—'"
          @click="copy(unit.value)"
        >
          <span>{{ unit.name }}</span
          ><strong>{{ unit.value }}</strong
          ><span>点击复制</span>
        </button>
      </div>
      <div class="workspace-footnote">
        <Icon name="Info" :size="15" /><span>{{
          groupId === "data"
            ? "KB、MB、GB 使用 1000 进位；KiB、MiB、GiB 使用 1024 进位。"
            : groupId === "temperature"
              ? "温度不能低于绝对零度：−273.15 °C、−459.67 °F 或 0 K。"
              : groupId === "mass"
                ? "结果最多显示 12 位有效数字；这里的市斤为 500 克。"
                : groupId === "area"
                  ? "结果最多显示 12 位有效数字；1 市亩为 2000/3 平方米。"
                  : "结果最多显示 12 位有效数字。"
        }}</span>
      </div>
    </template>
    <template v-else-if="toolId === 'percentage'">
      <div class="tool-toolbar">
        <div class="segmented">
          <button
            v-for="item in modes"
            :key="item.id"
            :class="{ active: percentageMode === item.id }"
            @click="percentageMode = item.id"
          >
            {{ item.name }}
          </button>
        </div>
        <button class="text-button" @click="percentageExample">填入示例</button>
      </div>
      <div class="calculator-panel">
        <div class="two-fields">
          <label class="field-label"
            >{{ mode.first
            }}<input
              v-model="first"
              inputmode="decimal"
              placeholder="输入数字" /></label
          ><label class="field-label"
            >{{ mode.second
            }}<input
              v-model="second"
              inputmode="decimal"
              placeholder="输入数字"
          /></label>
        </div>
        <p v-if="percentage.error" role="alert" class="inline-error">
          {{ percentage.error }}
        </p>
        <div class="calculator-result">
          <span>{{ mode.name }}结果</span
          ><strong
            >{{ percentage.result || "—"
            }}<small v-if="percentage.result && percentageMode !== 'portion'"
              >%</small
            ></strong
          >
          <p>{{ mode.formula }}</p>
          <button
            class="text-button"
            :disabled="!percentage.result"
            @click="
              copy(
                percentage.result + (percentageMode === 'portion' ? '' : '%'),
              )
            "
          >
            <Icon name="Copy" :size="15" />复制结果
          </button>
        </div>
      </div>
      <div class="workspace-footnote">
        <Icon name="Info" :size="15" />结果最多显示 12
        位有效数字；变化率中的正数表示增加，负数表示减少。
      </div>
    </template>
    <template v-else>
      <div class="tool-toolbar">
        <span class="muted">已识别 {{ candidateCount }} 个不同候选项</span>
        <div class="toolbar-actions">
          <button
            class="text-button"
            @click="candidates = '散步\n读书\n听音乐\n整理房间\n做饭\n看电影'"
          >
            填入示例</button
          ><button
            class="icon-button"
            aria-label="清空名单"
            @click="candidates = ''"
          >
            <Icon name="RotateCcw" :size="17" />
          </button>
        </div>
      </div>
      <div class="action-row">
        <label class="inline-label"
          >抽取数量<input
            v-model.number="count"
            type="number"
            min="1"
            :max="candidateCount || 1"
            class="draw-count" /></label
        ><button class="button primary" @click="draw">
          <Icon name="Shuffle" :size="17" />{{
            drawn.length ? "重新抽取" : "开始抽取"
          }}
        </button>
      </div>
      <div class="editor-grid">
        <EditorPanel
          v-model="candidates"
          title="候选名单"
          placeholder="每行填写一个名字或选项…"
        /><EditorPanel
          :model-value="drawn.join('\n')"
          title="抽取结果"
          placeholder="抽到的选项会显示在这里"
          filename="draw-result.txt"
          readonly
        />
      </div>

      <p v-if="drawError" role="alert" class="error-message">{{ drawError }}</p>
      <div class="workspace-footnote">
        <Icon
          name="Info"
          :size="15"
        />自动去除空行和重复项；每次抽取内部不重复，重新抽取时全部候选项都会参与。
      </div>
    </template>
  </div>
</template>
