<script setup lang="ts">
import { computed, onUnmounted, ref, shallowRef, watch } from "vue";
import Icon from "./Icon.vue";
import { useImages } from "../lib/use-images";
import { newCanvas, canvasBlob } from "../lib/image-layout";
import { downloadBlob, formatBytes } from "../lib/ui";
const props = defineProps<{ toolId: string }>();
const barcode = computed(() => props.toolId === "barcode"),
  round = computed(() => props.toolId === "image-round");
const { images, loading, error: uploadError, add, remove } = useImages(1, 2048);
const picker = ref<HTMLInputElement>(),
  content = ref(""),
  codeType = ref("CODE128"),
  codeHeight = ref(100),
  codeWidth = ref(2),
  label = ref(true),
  format = ref("png");
const radius = ref(12),
  border = ref(0),
  borderColor = ref("#16836c"),
  transparent = ref(true),
  background = ref("#ffffff"),
  brightness = ref(100),
  contrast = ref(100),
  saturation = ref(100),
  effect = ref("normal");
const preview = ref(""),
  busy = ref(false),
  error = ref(""),
  output = shallowRef<Blob>(),
  info = ref("");
let version = 0;
function invalidate() {
  version++;
  output.value = undefined;
  error.value = "";
  info.value = "";
  if (preview.value) URL.revokeObjectURL(preview.value);
  preview.value = "";
}
watch(
  [
    images,
    content,
    codeType,
    codeHeight,
    codeWidth,
    label,
    format,
    radius,
    border,
    borderColor,
    transparent,
    background,
    brightness,
    contrast,
    saturation,
    effect,
  ],
  invalidate,
  { flush: "sync" },
);
onUnmounted(invalidate);
async function select(files: FileList | File[] | null) {
  if (busy.value || loading.value) return;
  invalidate();
  await add(files);
  if (picker.value) picker.value.value = "";
}
async function generate() {
  if (busy.value || loading.value) return;
  invalidate();
  const current = version;
  busy.value = true;
  try {
    let blob: Blob, previewBlob: Blob;
    if (barcode.value) {
      if (!content.value.trim() || content.value.length > 100)
        throw new Error("请输入 1–100 个字符的条码内容");
      if (
        !Number.isInteger(codeHeight.value) ||
        codeHeight.value < 30 ||
        codeHeight.value > 300 ||
        !Number.isInteger(codeWidth.value) ||
        codeWidth.value < 1 ||
        codeWidth.value > 4
      )
        throw new Error("条高需为 30–300，线宽需为 1–4");
      const { default: JsBarcode } = await import("jsbarcode");
      const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
      try {
        JsBarcode(svg, content.value, {
          format: codeType.value,
          width: codeWidth.value,
          height: codeHeight.value,
          displayValue: label.value,
          margin: 20,
          font: "monospace",
        });
      } catch {
        throw new Error(
          "内容不符合所选码制；EAN / UPC 需正确长度与校验位，CODE128 仅支持 ASCII",
        );
      }
      const svgBlob = new Blob([new XMLSerializer().serializeToString(svg)], {
        type: "image/svg+xml",
      });
      previewBlob = svgBlob;
      if (format.value === "svg") blob = svgBlob;
      else {
        const url = URL.createObjectURL(svgBlob),
          image = new Image();
        try {
          image.src = url;
          await image.decode();
          const { canvas, ctx } = newCanvas(image.width, image.height, "#fff");
          ctx.drawImage(image, 0, 0);
          blob = await canvasBlob(canvas);
        } finally {
          URL.revokeObjectURL(url);
        }
      }
      info.value = codeType.value + " · " + content.value;
    } else {
      const image = images.value[0]?.bitmap;
      if (!image) throw new Error("请先选择图片");
      if (
        round.value &&
        (!Number.isFinite(radius.value) ||
          radius.value < 0 ||
          radius.value > 50 ||
          !Number.isInteger(border.value) ||
          border.value < 0 ||
          border.value > 100)
      )
        throw new Error("圆角需为 0–50%，边框需为 0–100 像素");
      if (
        !round.value &&
        (![brightness.value, contrast.value, saturation.value].every(
          Number.isFinite,
        ) ||
          brightness.value < 0 ||
          brightness.value > 200 ||
          contrast.value < 0 ||
          contrast.value > 200 ||
          saturation.value < 0 ||
          saturation.value > 200)
      )
        throw new Error("滤镜参数需为 0–200%");
      const padding = round.value ? border.value : 0,
        { canvas, ctx } = newCanvas(
          image.width + 2 * padding,
          image.height + 2 * padding,
          format.value === "jpg" ? "#fff" : undefined,
        );
      if (round.value) {
        const r = (Math.min(image.width, image.height) * radius.value) / 100;
        if (padding) {
          ctx.fillStyle = borderColor.value;
          ctx.beginPath();
          ctx.roundRect(0, 0, canvas.width, canvas.height, r + padding);
          ctx.fill();
        }
        ctx.save();
        ctx.beginPath();
        ctx.roundRect(padding, padding, image.width, image.height, r);
        ctx.clip();
        if (!transparent.value) {
          ctx.fillStyle = background.value;
          ctx.fillRect(padding, padding, image.width, image.height);
        }
        ctx.drawImage(image, padding, padding);
        ctx.restore();
      } else {
        ctx.filter = `brightness(${brightness.value}%) contrast(${contrast.value}%) saturate(${saturation.value}%) ${effect.value === "gray" ? "grayscale(100%)" : effect.value === "sepia" ? "sepia(100%)" : ""}`;
        ctx.drawImage(image, 0, 0);
        ctx.filter = "none";
      }
      blob = await canvasBlob(
        canvas,
        format.value === "jpg" ? "image/jpeg" : "image/png",
      );
      previewBlob = blob;
      info.value = canvas.width + " × " + canvas.height + " px";
    }
    if (current !== version) return;
    output.value = blob;
    preview.value = URL.createObjectURL(previewBlob);
  } catch (e) {
    if (current === version)
      error.value = e instanceof Error ? e.message : "生成失败";
  } finally {
    busy.value = false;
  }
}
</script>
<template>
  <div class="tool-workspace">
    <input
      ref="picker"
      class="visually-hidden"
      type="file"
      accept="image/png,image/jpeg,image/webp"
      aria-label="选择图片"
      @change="select(($event.target as HTMLInputElement).files)"
    />
    <div class="tool-toolbar">
      <span class="muted">{{
        barcode ? "条形码设置" : images[0]?.name || "选择一张图片"
      }}</span>
      <div class="toolbar-actions">
        <button
          v-if="barcode"
          class="text-button"
          @click="
            content =
              codeType === 'EAN13'
                ? '6901234567892'
                : codeType === 'EAN8'
                  ? '96385074'
                  : codeType === 'UPC'
                    ? '123456789012'
                    : 'XIAOYONG2026'
          "
        >
          填入示例</button
        ><template v-else-if="images.length"
          ><button
            class="text-button"
            :disabled="busy || loading"
            @click="picker?.click()"
          >
            更换图片</button
          ><button
            class="icon-button"
            aria-label="移除图片"
            :disabled="busy || loading"
            @click="remove(0)"
          >
            <Icon name="X" :size="17" /></button
        ></template>
      </div>
    </div>
    <button
      v-if="!barcode && !images.length"
      class="upload-zone"
      :disabled="loading"
      @click="picker?.click()"
      @dragover.prevent
      @drop.prevent="select($event.dataTransfer?.files || null)"
    >
      <span class="upload-illustration"><Icon name="Image" :size="38" /></span>
      <h2>{{ loading ? "正在读取图片…" : "选择要编辑的图片" }}</h2>
      <p>点击选择，或拖拽图片到这里</p>
      <small>JPG、PNG、WebP · 最多 20 MB、3200 万像素</small>
    </button>
    <div v-else class="batch-layout">
      <div class="settings-panel">
        <fieldset class="workshop-controls" :disabled="busy || loading">
          <template v-if="barcode"
            ><div class="mode-buttons">
              <button
                v-for="kind in ['CODE128', 'EAN13', 'EAN8', 'UPC']"
                :key="kind"
                :class="{ active: codeType === kind }"
                @click="codeType = kind"
              >
                {{ kind }}
              </button>
            </div>
            <label class="field-label"
              >条码内容<input
                v-model="content"
                maxlength="100"
                placeholder="输入字母或数字" /></label
            ><label class="field-label"
              >码制<select v-model="codeType">
                <option>CODE128</option>
                <option>CODE39</option>
                <option>EAN13</option>
                <option>EAN8</option>
                <option>UPC</option>
              </select></label
            >
            <div class="two-fields">
              <label class="field-label"
                >条高（px）<input
                  v-model.number="codeHeight"
                  type="number"
                  min="30"
                  max="300" /></label
              ><label class="field-label"
                >线宽（px）<input
                  v-model.number="codeWidth"
                  type="number"
                  min="1"
                  max="4"
              /></label>
            </div>
            <label class="check-label"
              ><input v-model="label" type="checkbox" />显示条码文字</label
            ></template
          >
          <template v-else-if="round"
            ><div class="preset-row">
              <button
                v-for="[value, name] in [
                  [0, '直角'],
                  [12, '小圆角'],
                  [25, '大圆角'],
                  [50, '圆形'],
                ]"
                :key="value"
                class="button secondary"
                @click="radius = Number(value)"
              >
                {{ name }}
              </button>
            </div>
            <label class="field-label"
              >圆角比例 {{ radius }}%<input
                v-model.number="radius"
                type="range"
                min="0"
                max="50" /></label
            ><label class="field-label"
              >边框宽度（px）<input
                v-model.number="border"
                type="number"
                min="0"
                max="100" /></label
            ><label class="field-label"
              >边框颜色<input v-model="borderColor" type="color" /></label
            ><label class="check-label"
              ><input
                v-model="transparent"
                type="checkbox"
              />保留图片透明区域</label
            ><label v-if="!transparent" class="field-label workshop-space"
              >图片底色<input v-model="background" type="color" /></label
          ></template>
          <template v-else
            ><div class="mode-buttons">
              <button
                v-for="[value, name] in [
                  ['normal', '原色'],
                  ['gray', '黑白'],
                  ['sepia', '复古'],
                ]"
                :key="value"
                :class="{ active: effect === value }"
                @click="effect = value!"
              >
                {{ name }}
              </button>
            </div>
            <label class="field-label"
              >效果<select v-model="effect">
                <option value="normal">原色</option>
                <option value="gray">黑白灰度</option>
                <option value="sepia">复古棕色</option>
              </select></label
            ><label class="field-label"
              >亮度 {{ brightness }}%<input
                v-model.number="brightness"
                type="range"
                min="0"
                max="200" /></label
            ><label class="field-label"
              >对比度 {{ contrast }}%<input
                v-model.number="contrast"
                type="range"
                min="0"
                max="200" /></label
            ><label class="field-label"
              >饱和度 {{ saturation }}%<input
                v-model.number="saturation"
                type="range"
                min="0"
                max="200" /></label
            ><button
              class="text-button"
              @click="
                brightness = 100;
                contrast = 100;
                saturation = 100;
                effect = 'normal';
              "
            >
              恢复原色设置
            </button></template
          >
          <label class="field-label workshop-space"
            >输出格式<select v-model="format">
              <option value="png">PNG</option>
              <option v-if="barcode" value="svg">SVG</option>
              <option v-else value="jpg">JPG（空白填白）</option>
            </select></label
          >
        </fieldset>
        <button
          class="button primary full-width workshop-space"
          :disabled="busy || loading"
          @click="generate"
        >
          <Icon
            :name="busy ? 'LoaderCircle' : 'ImageDown'"
            :class="{ spin: busy }"
            :size="17"
          />{{ busy ? "正在生成…" : barcode ? "生成条形码" : "生成图片" }}
        </button>
      </div>
      <div class="batch-preview">
        <div v-if="preview" class="batch-result">
          <p class="muted">{{ info }}</p>
          <div class="image-result-stage">
            <img :src="preview" alt="输出预览" />
          </div>
          <div class="action-row">
            <button
              class="button primary"
              @click="
                output &&
                downloadBlob(
                  output,
                  (barcode ? 'barcode' : round ? 'rounded' : 'filtered') +
                    '.' +
                    format,
                )
              "
            >
              <Icon name="Download" :size="17" />下载{{
                format.toUpperCase()
              }}</button
            ><span class="muted">{{
              output ? formatBytes(output.size) : ""
            }}</span>
          </div>
        </div>
        <div v-else class="preview-placeholder">
          <img v-if="images[0]" :src="images[0].url" alt="原图缩略图" /><Icon
            v-else
            name="ScanLine"
            :size="38"
          />
          <p>设置完成后点击生成</p>
        </div>
      </div>
    </div>
    <p v-if="error || uploadError" class="error-message" role="alert">
      {{ error || uploadError }}
    </p>
    <div class="workspace-footnote">
      <Icon name="Info" :size="15" />{{
        barcode
          ? "生成条形码图案，不分配商品编码。EAN / UPC 会核对校验位；打印后请用设备试扫，避免拉伸或裁掉留白。"
          : "源图最长边超过 2048 px 时会缩小；导出不保留 EXIF。PNG 可保留圆角外部的透明区域，JPG 空白填白。"
      }}
    </div>
  </div>
</template>
