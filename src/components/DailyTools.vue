<script setup lang="ts">
import { computed, ref, watch } from "vue";
import QRCode from "qrcode";
import Icon from "./Icon.vue";
import { copy, downloadBlob, notify } from "../lib/ui";
import { parseColor, parseTimestamp, parseDateInput } from "../lib/transform";
const props = defineProps<{ toolId: string }>();
const qrInput = ref(""),
  qrSize = ref("512"),
  correction = ref<"L" | "M" | "Q" | "H">("M");
const qrUrl = ref(""),
  qrSvg = ref(""),
  qrBusy = ref(false);
const error = ref("");
let qrGeneration = 0;
const colorInput = ref("#16836C");
const color = computed(() => {
  try {
    return { ...parseColor(colorInput.value), error: "" };
  } catch (err) {
    return {
      hex: "",
      rgb: "",
      hsl: "",
      channels: [],
      error: err instanceof Error ? err.message : "颜色无效",
    };
  }
});
const palette = [
  "#16836C",
  "#6788D5",
  "#DC9565",
  "#9E7AC7",
  "#E37C92",
  "#2C3C3A",
  "#E5D9BC",
  "#8CA58A",
];
const dateTab = ref("timestamp");
const timestamp = ref(""),
  unit = ref("seconds"),
  dateInput = ref(""),
  timezone = ref("local");
const dateOutput = ref(""),
  timestampOutput = ref("");
const dateStart = ref(""),
  dateEnd = ref("");
const dateDifference = computed(() => {
  if (!dateStart.value || !dateEnd.value) return null;
  const start = Date.parse(dateStart.value + "T00:00:00Z"),
    end = Date.parse(dateEnd.value + "T00:00:00Z");
  if (!Number.isFinite(start) || !Number.isFinite(end)) return null;
  return (end - start) / 86400000;
});
function qrExample() {
  qrInput.value = "https://example.com";
}
async function makeQr() {
  error.value = "";
  qrUrl.value = "";
  qrSvg.value = "";
  if (!qrInput.value.trim()) {
    error.value = "请先输入文字或链接";
    return;
  }
  if (qrInput.value.length > 2000) {
    error.value = "内容请控制在 2,000 字符以内";
    return;
  }
  const current = ++qrGeneration;
  qrBusy.value = true;
  try {
    const options = {
      errorCorrectionLevel: correction.value,
      width: Number(qrSize.value),
      margin: 4,
      color: { dark: "#203D36", light: "#FFFFFFFF" },
    };
    const [url, svg] = await Promise.all([
      QRCode.toDataURL(qrInput.value, options),
      QRCode.toString(qrInput.value, { ...options, type: "svg" }),
    ]);
    if (current === qrGeneration) {
      qrUrl.value = url;
      qrSvg.value = svg;
    }
  } catch {
    error.value = "内容超过二维码容量，请减少文字或降低纠错级别";
  } finally {
    qrBusy.value = false;
  }
}
function downloadQr(svg = false) {
  if (svg)
    downloadBlob(
      new Blob([qrSvg.value], { type: "image/svg+xml" }),
      "xiaoyong-qrcode.svg",
    );
  else {
    const bytes = Uint8Array.from(atob(qrUrl.value.split(",")[1]!), (char) =>
      char.charCodeAt(0),
    );
    downloadBlob(
      new Blob([bytes], { type: "image/png" }),
      "xiaoyong-qrcode.png",
    );
  }
}
function useNow() {
  const now = new Date();
  timestamp.value = String(
    unit.value === "seconds" ? Math.floor(now.getTime() / 1000) : now.getTime(),
  );
  const offset = timezone.value === "utc" ? 0 : now.getTimezoneOffset() * 60000;
  dateInput.value = new Date(now.getTime() - offset).toISOString().slice(0, 19);
  error.value = "";
}
function convertTimestamp() {
  error.value = "";
  dateOutput.value = "";
  try {
    const date = parseTimestamp(timestamp.value, unit.value);
    dateOutput.value =
      timezone.value === "utc"
        ? date.toISOString().replace("T", " ").replace("Z", " UTC")
        : date.toLocaleString("zh-CN", { hour12: false }) + "（本地时区）";
  } catch (err) {
    error.value = err instanceof Error ? err.message : "转换失败";
  }
}
function convertDate() {
  error.value = "";
  timestampOutput.value = "";
  try {
    const date = parseDateInput(dateInput.value, timezone.value === "utc");
    timestampOutput.value = String(
      unit.value === "seconds"
        ? Math.floor(date.getTime() / 1000)
        : date.getTime(),
    );
  } catch (err) {
    error.value = err instanceof Error ? err.message : "转换失败";
  }
}
watch([qrInput, qrSize, correction], () => {
  qrGeneration++;
  qrUrl.value = "";
  qrSvg.value = "";
  error.value = "";
});
watch([timestamp, dateInput, timezone, unit], () => {
  dateOutput.value = "";
  timestampOutput.value = "";
  error.value = "";
});
</script>
<template>
  <div class="tool-workspace">
    <template v-if="toolId === 'qrcode'">
      <div class="tool-toolbar">
        <span class="muted">文字、网址，都能变成二维码</span
        ><button class="text-button" @click="qrExample">填入示例</button>
      </div>
      <div class="qr-grid">
        <div class="settings-panel qr-settings">
          <label class="field-label"
            >二维码内容<textarea
              v-model="qrInput"
              rows="6"
              maxlength="2000"
              placeholder="输入网址或文字，例如 https://example.com"
            ></textarea>
          </label>
          <div class="two-fields">
            <label class="field-label"
              >图片尺寸<select v-model="qrSize">
                <option value="256">256 × 256</option>
                <option value="512">512 × 512</option>
                <option value="1024">1024 × 1024</option>
              </select></label
            ><label class="field-label"
              >纠错级别<select v-model="correction">
                <option value="L">L · 7%</option>
                <option value="M">M · 15%（推荐）</option>
                <option value="Q">Q · 25%</option>
                <option value="H">H · 30%</option>
              </select></label
            >
          </div>
          <button class="button primary" :disabled="qrBusy" @click="makeQr">
            <Icon name="QrCode" :size="17" />{{
              qrBusy ? "正在生成" : "生成二维码"
            }}
          </button>
        </div>
        <div class="qr-preview">
          <div class="qr-paper">
            <img v-if="qrUrl" :src="qrUrl" alt="生成的二维码" />
            <div v-else class="qr-placeholder">
              <Icon name="QrCode" :size="72" :stroke-width="1" />
              <p>你的二维码会出现在这里</p>
            </div>
          </div>
          <div class="qr-downloads">
            <button
              class="button secondary"
              :disabled="!qrUrl"
              @click="downloadQr()"
            >
              <Icon name="Download" :size="16" />PNG</button
            ><button
              class="button secondary"
              :disabled="!qrSvg"
              @click="downloadQr(true)"
            >
              <Icon name="Download" :size="16" />SVG
            </button>
          </div>
        </div>
      </div>
      <div class="workspace-footnote">
        <Icon
          name="Info"
          :size="15"
        />生成的是静态二维码，不设置过期时间；网址能否访问取决于对应网站。
      </div>
    </template>
    <template v-else-if="toolId === 'color'">
      <div class="tool-toolbar">
        <span class="muted">一种颜色，三种表达</span
        ><button class="text-button" @click="colorInput = '#16836C'">
          重置颜色
        </button>
      </div>
      <div class="color-grid">
        <div
          class="color-preview"
          :style="{ backgroundColor: color.hex || 'var(--soft-bg)' }"
        >
          <span>{{ color.hex || "等待有效颜色" }}</span
          ><label class="color-picker-button"
            ><Icon name="Palette" :size="17" />打开取色器<input
              type="color"
              :value="color.hex || '#16836C'"
              aria-label="选择颜色"
              @input="colorInput = ($event.target as HTMLInputElement).value"
          /></label>
        </div>
        <div class="settings-panel">
          <label class="field-label"
            >输入颜色值<input
              v-model="colorInput"
              placeholder="#16836C / rgb(...) / hsl(...)"
              spellcheck="false"
          /></label>
          <p v-if="color.error" role="alert" class="inline-error">
            {{ color.error }}
          </p>
          <div class="color-results">
            <div v-for="key in ['hex', 'rgb', 'hsl'] as const" :key="key">
              <span>{{ key.toUpperCase() }}</span
              ><code>{{ color[key] || "—" }}</code
              ><button
                class="icon-button"
                :aria-label="'复制 ' + key.toUpperCase()"
                :disabled="!color[key]"
                @click="copy(color[key])"
              >
                <Icon name="Copy" :size="17" />
              </button>
            </div>
          </div>
          <div class="field-label palette-label">试试这些颜色</div>
          <div class="palette">
            <button
              v-for="hex in palette"
              :key="hex"
              :style="{ backgroundColor: hex }"
              :aria-label="'选择颜色 ' + hex"
              @click="colorInput = hex"
            >
              <Icon v-if="color.hex === hex" name="Check" :size="17" />
            </button>
          </div>
        </div>
      </div>
    </template>
    <template v-else-if="toolId === 'datetime'">
      <div class="tool-toolbar">
        <div class="segmented">
          <button
            :class="{ active: dateTab === 'timestamp' }"
            @click="
              dateTab = 'timestamp';
              error = '';
            "
          >
            时间戳转换</button
          ><button
            :class="{ active: dateTab === 'difference' }"
            @click="
              dateTab = 'difference';
              error = '';
            "
          >
            日期差计算
          </button>
        </div>
        <button
          v-if="dateTab === 'timestamp'"
          class="text-button"
          @click="useNow"
        >
          填入当前时间
        </button>
      </div>
      <template v-if="dateTab === 'timestamp'"
        ><div class="date-options">
          <label class="inline-label"
            >单位<select v-model="unit">
              <option value="seconds">秒（Unix）</option>
              <option value="milliseconds">毫秒</option>
            </select></label
          ><label class="inline-label"
            >时区<select v-model="timezone">
              <option value="local">当前设备时区</option>
              <option value="utc">UTC</option>
            </select></label
          >
        </div>
        <div class="date-grid">
          <section class="settings-panel">
            <h2>时间戳 → 日期</h2>
            <label class="field-label"
              >时间戳<input
                v-model="timestamp"
                placeholder="例如 1735689600"
                inputmode="numeric" /></label
            ><button class="button primary" @click="convertTimestamp">
              转换为日期<Icon name="ArrowRight" :size="16" />
            </button>
            <div class="conversion-output">
              <span>{{ dateOutput || "转换结果" }}</span
              ><button
                class="icon-button"
                aria-label="复制日期结果"
                :disabled="!dateOutput"
                @click="copy(dateOutput)"
              >
                <Icon name="Copy" :size="16" />
              </button>
            </div>
          </section>
          <section class="settings-panel">
            <h2>日期 → 时间戳</h2>
            <label class="field-label"
              >日期和时间<input
                v-model="dateInput"
                type="datetime-local"
                step="1" /></label
            ><button class="button primary" @click="convertDate">
              转换为时间戳<Icon name="ArrowRight" :size="16" />
            </button>
            <div class="conversion-output">
              <span>{{ timestampOutput || "转换结果" }}</span
              ><button
                class="icon-button"
                aria-label="复制时间戳结果"
                :disabled="!timestampOutput"
                @click="copy(timestampOutput)"
              >
                <Icon name="Copy" :size="16" />
              </button>
            </div>
          </section>
        </div>
        <div class="workspace-footnote">
          <Icon name="Info" :size="15" />本地时区：{{
            Intl.DateTimeFormat().resolvedOptions().timeZone
          }}。时间戳表示绝对时刻，时区影响日期的显示与解析。
        </div></template
      >
      <div v-else class="date-difference">
        <div class="two-fields">
          <label class="field-label"
            >开始日期<input v-model="dateStart" type="date" /></label
          ><label class="field-label"
            >结束日期<input v-model="dateEnd" type="date"
          /></label>
        </div>
        <div class="difference-result">
          <span>两个日期相差</span
          ><strong
            >{{ dateDifference === null ? "—" : Math.abs(dateDifference)
            }}<small>天</small></strong
          >
          <p>
            {{
              dateDifference === null
                ? "选择两个日期，自动计算相差天数"
                : dateDifference < 0
                  ? "结束日期早于开始日期"
                  : dateDifference === 0
                    ? "这两个日期是同一天"
                    : "按日历日期计算，不包含开始当天"
            }}
          </p>
        </div>
      </div>
    </template>
    <div v-if="error" role="alert" class="error-message">{{ error }}</div>
  </div>
</template>
