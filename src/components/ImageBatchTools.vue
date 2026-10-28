<script setup lang="ts">
import { computed, onUnmounted, ref, shallowRef, watch } from "vue";
import Icon from "./Icon.vue";
import { useImages } from "../lib/use-images";
import {
  canvasBlob,
  contain,
  newCanvas,
  printLayout,
  stitchLayout,
} from "../lib/image-layout";
import { photoSizes, setPhotoDpi } from "../lib/id-photo";
import { downloadBlob, formatBytes } from "../lib/ui";
const props = defineProps<{ toolId: string }>();
const print = computed(() => props.toolId === "photo-print"),
  pdf = computed(() => props.toolId === "images-pdf");
const {
  images,
  loading,
  error: uploadError,
  add,
  remove,
  move,
} = useImages(print.value ? 1 : 12);
const picker = ref<HTMLInputElement>(),
  busy = ref(false),
  error = ref(""),
  preview = ref(""),
  detail = ref("");
const output = shallowRef<Blob>();
const direction = ref("vertical"),
  edge = ref(800),
  gap = ref(12),
  columns = ref(2),
  background = ref("#ffffff"),
  format = ref("png");
const sizeId = ref("one"),
  customWidth = ref(25),
  customHeight = ref(35),
  paper = ref("six"),
  orientation = ref("landscape"),
  margin = ref(5),
  printGap = ref(2),
  copies = ref(0);
const pdfOrientation = ref("portrait"),
  pdfMargin = ref(10);
const working = computed(() => busy.value || loading.value);
let version = 0;
function invalidate() {
  version++;
  error.value = "";
  output.value = undefined;
  detail.value = "";
  if (preview.value) URL.revokeObjectURL(preview.value);
  preview.value = "";
}
watch(
  [
    images,
    direction,
    edge,
    gap,
    columns,
    background,
    format,
    sizeId,
    customWidth,
    customHeight,
    paper,
    orientation,
    margin,
    printGap,
    copies,
    pdfOrientation,
    pdfMargin,
  ],
  invalidate,
  { flush: "sync" },
);
onUnmounted(invalidate);
async function select(files: FileList | File[] | null) {
  if (working.value) return;
  invalidate();
  await add(files);
  if (picker.value) picker.value.value = "";
}
function paperSize() {
  const sides = paper.value === "six" ? [101.6, 152.4] : [210, 297];
  return orientation.value === "landscape"
    ? [sides[1]!, sides[0]!]
    : [sides[0]!, sides[1]!];
}
const printInfo = computed(() => {
  if (!print.value) return "";
  try {
    const [pw, ph] = paperSize(),
      photo = photoSizes.find((size) => size.id === sizeId.value);
    const layout = printLayout(
      pw!,
      ph!,
      photo?.mmWidth ?? customWidth.value,
      photo?.mmHeight ?? customHeight.value,
      margin.value,
      printGap.value,
      copies.value,
    );
    return `${pw} × ${ph} mm · 最多 ${layout.capacity} 张 · 本次 ${layout.count} 张`;
  } catch (e) {
    return e instanceof Error ? e.message : "请检查排版设置";
  }
});
async function canvasPdf(
  canvases: HTMLCanvasElement[],
  widthMm: number,
  heightMm: number,
  current: number,
) {
  const { PDFDocument } = await import("pdf-lib");
  const doc = await PDFDocument.create();
  for (const canvas of canvases) {
    if (current !== version) return;
    const image = await doc.embedPng(
      await (await canvasBlob(canvas)).arrayBuffer(),
    );
    const width = (widthMm / 25.4) * 72,
      height = (heightMm / 25.4) * 72;
    doc
      .addPage([width, height])
      .drawImage(image, { x: 0, y: 0, width, height });
  }
  return new Blob([(await doc.save()).slice().buffer as ArrayBuffer], {
    type: "application/pdf",
  });
}
async function generate() {
  if (!images.value.length || working.value) return;
  invalidate();
  const current = version;
  busy.value = true;
  try {
    let canvas: HTMLCanvasElement,
      blob: Blob | undefined,
      description = "";
    if (pdf.value) {
      if (
        !Number.isFinite(pdfMargin.value) ||
        pdfMargin.value < 0 ||
        pdfMargin.value > 40
      )
        throw new Error("页边距需为 0–40 mm");
      const { PDFDocument } = await import("pdf-lib");
      const doc = await PDFDocument.create(),
        widthMm = pdfOrientation.value === "portrait" ? 210 : 297,
        heightMm = pdfOrientation.value === "portrait" ? 297 : 210;
      const pw = (widthMm / 25.4) * 72,
        ph = (heightMm / 25.4) * 72,
        padding = (pdfMargin.value / 25.4) * 72;
      let first: HTMLCanvasElement | undefined;
      for (const image of images.value) {
        if (current !== version) return;
        const rendered = newCanvas(image.bitmap.width, image.bitmap.height);
        rendered.ctx.drawImage(image.bitmap, 0, 0);
        const embedded = await doc.embedPng(
          await (await canvasBlob(rendered.canvas)).arrayBuffer(),
        );
        const fit = contain(image.bitmap.width, image.bitmap.height, {
          x: padding,
          y: padding,
          width: pw - 2 * padding,
          height: ph - 2 * padding,
        });
        doc.addPage([pw, ph]).drawImage(embedded, {
          x: fit.x,
          y: ph - fit.y - fit.height,
          width: fit.width,
          height: fit.height,
        });
        if (!first) {
          const previewPage = newCanvas(
            Math.round(pw * 1.5),
            Math.round(ph * 1.5),
            "#ffffff",
          );
          previewPage.ctx.drawImage(
            image.bitmap,
            fit.x * 1.5,
            fit.y * 1.5,
            fit.width * 1.5,
            fit.height * 1.5,
          );
          first = previewPage.canvas;
        }
      }
      canvas = first!;
      blob = new Blob([(await doc.save()).slice().buffer as ArrayBuffer], {
        type: "application/pdf",
      });
      description = `${images.value.length} 页 · A4 ${pdfOrientation.value === "portrait" ? "纵向" : "横向"} · 预览第 1 页`;
    } else if (print.value) {
      const [pw, ph] = paperSize(),
        photo = photoSizes.find((size) => size.id === sizeId.value),
        factor = 300 / 25.4;
      const layout = printLayout(
        pw!,
        ph!,
        photo?.mmWidth ?? customWidth.value,
        photo?.mmHeight ?? customHeight.value,
        margin.value,
        printGap.value,
        copies.value,
      );
      const rendered = newCanvas(
          Math.round(pw! * factor),
          Math.round(ph! * factor),
          "#ffffff",
        ),
        image = images.value[0]!;
      for (const box of layout.boxes) {
        const fit = contain(image.bitmap.width, image.bitmap.height, {
          x: box.x * factor,
          y: box.y * factor,
          width: box.width * factor,
          height: box.height * factor,
        });
        rendered.ctx.drawImage(
          image.bitmap,
          fit.x,
          fit.y,
          fit.width,
          fit.height,
        );
      }
      canvas = rendered.canvas;
      if (format.value === "pdf")
        blob = await canvasPdf([canvas], pw!, ph!, current);
      else {
        const mime = format.value === "jpg" ? "image/jpeg" : "image/png";
        const imageBlob = await canvasBlob(canvas, mime);
        blob = new Blob(
          [
            setPhotoDpi(
              new Uint8Array(await imageBlob.arrayBuffer()),
              mime,
            ).slice().buffer as ArrayBuffer,
          ],
          { type: mime },
        );
      }
      description = `${layout.count} 张 · ${pw} × ${ph} mm · 300 DPI`;
    } else {
      const layout = stitchLayout(
        images.value.map((i) => i.bitmap),
        direction.value,
        edge.value,
        gap.value,
        columns.value,
      );
      const rendered = newCanvas(layout.width, layout.height, background.value);
      layout.boxes.forEach((box, i) =>
        rendered.ctx.drawImage(
          images.value[i]!.bitmap,
          box.x,
          box.y,
          box.width,
          box.height,
        ),
      );
      canvas = rendered.canvas;
      blob = await canvasBlob(
        canvas,
        format.value === "jpg" ? "image/jpeg" : "image/png",
      );
      description = `${canvas.width} × ${canvas.height} px · ${images.value.length} 张图片`;
    }
    const previewBlob = await canvasBlob(canvas);
    if (current !== version) return;
    output.value = blob;
    preview.value = URL.createObjectURL(previewBlob);
    detail.value = description;
  } catch (e) {
    if (current === version)
      error.value =
        e instanceof Error ? e.message : "生成失败，请调整设置后重试";
  } finally {
    busy.value = false;
  }
}
function download() {
  if (output.value)
    downloadBlob(
      output.value,
      (pdf.value ? "images" : print.value ? "photo-print" : "stitched") +
        "." +
        (pdf.value ? "pdf" : format.value),
    );
}
</script>
<template>
  <div class="tool-workspace">
    <input
      ref="picker"
      class="visually-hidden"
      type="file"
      accept="image/jpeg,image/png,image/webp"
      :multiple="!print"
      aria-label="选择图片"
      @change="select(($event.target as HTMLInputElement).files)"
    />
    <div class="tool-toolbar">
      <span class="muted">{{
        images.length
          ? images.length + " 张图片"
          : print
            ? "选择已制作好的证件照"
            : "选择图片，按顺序排列"
      }}</span
      ><button
        v-if="images.length"
        class="text-button"
        :disabled="working"
        @click="picker?.click()"
      >
        {{ print ? "更换图片" : "继续添加" }}
      </button>
    </div>
    <button
      v-if="!images.length"
      class="upload-zone"
      :disabled="working"
      @click="picker?.click()"
      @dragover.prevent
      @drop.prevent="select($event.dataTransfer?.files || null)"
    >
      <span class="upload-illustration"
        ><Icon
          :name="loading ? 'LoaderCircle' : 'FileImage'"
          :class="{ spin: loading }"
          :size="38"
      /></span>
      <h2>
        {{
          loading
            ? "正在读取图片…"
            : print
              ? "选择一张证件照"
              : "选择要处理的图片"
        }}
      </h2>
      <p>点击选择，或拖拽图片到这里</p>
      <small
        >JPG、PNG、WebP · 单张 20 MB ·
        {{ print ? "一次 1 张" : "最多 12 张，合计 50 MB" }}</small
      >
    </button>
    <template v-else>
      <div class="batch-layout">
        <div class="settings-panel batch-settings">
          <h2>
            {{
              print ? "照片与纸张" : pdf ? "图片顺序与纸张" : "图片顺序与布局"
            }}
          </h2>
          <ol class="pdf-file-list">
            <li v-for="(image, index) in images" :key="image.id">
              <img :src="image.url" alt="" class="batch-thumb" />
              <div class="pdf-file-name">
                <strong>{{ image.name }}</strong
                ><small>{{ image.width }} × {{ image.height }}</small>
              </div>
              <div class="pdf-file-actions">
                <template v-if="!print"
                  ><button
                    class="icon-button"
                    :aria-label="'上移 ' + image.name"
                    :disabled="working || index === 0"
                    @click="move(index, -1)"
                  >
                    <Icon name="ArrowUp" :size="15" /></button
                  ><button
                    class="icon-button"
                    :aria-label="'下移 ' + image.name"
                    :disabled="working || index === images.length - 1"
                    @click="move(index, 1)"
                  >
                    <Icon name="ArrowDown" :size="15" /></button></template
                ><button
                  class="icon-button"
                  :aria-label="'移除 ' + image.name"
                  :disabled="working"
                  @click="remove(index)"
                >
                  <Icon name="X" :size="15" />
                </button>
              </div>
            </li>
          </ol>
          <fieldset class="workshop-controls" :disabled="working">
            <template v-if="!print && !pdf">
              <label class="field-label"
                >拼接方式<select v-model="direction">
                  <option value="vertical">纵向长图</option>
                  <option value="horizontal">横向长图</option>
                  <option value="grid">网格拼图</option>
                </select></label
              >
              <div class="two-fields">
                <label class="field-label"
                  >{{
                    direction === "vertical"
                      ? "统一宽度"
                      : direction === "horizontal"
                        ? "统一高度"
                        : "单格边长"
                  }}（px）<input
                    v-model.number="edge"
                    type="number"
                    min="64"
                    max="2048" /></label
                ><label class="field-label"
                  >图片间距（px）<input
                    v-model.number="gap"
                    type="number"
                    min="0"
                    max="100"
                /></label>
              </div>
              <label v-if="direction === 'grid'" class="field-label"
                >列数<input
                  v-model.number="columns"
                  type="number"
                  min="1"
                  max="5"
              /></label>
              <label class="field-label"
                >背景颜色<input v-model="background" type="color"
              /></label>
            </template>
            <template v-if="print">
              <label class="field-label"
                >照片尺寸<select v-model="sizeId">
                  <option
                    v-for="size in photoSizes"
                    :key="size.id"
                    :value="size.id"
                  >
                    {{ size.name ? size.name + " · " : "" }}{{ size.mmWidth }} ×
                    {{ size.mmHeight }} mm
                  </option>
                  <option value="custom">自定义尺寸</option>
                </select></label
              >
              <div v-if="sizeId === 'custom'" class="two-fields">
                <label class="field-label"
                  >照片宽（mm）<input
                    v-model.number="customWidth"
                    type="number"
                    min="5"
                    max="100"
                    step="0.1" /></label
                ><label class="field-label"
                  >照片高（mm）<input
                    v-model.number="customHeight"
                    type="number"
                    min="5"
                    max="100"
                    step="0.1"
                /></label>
              </div>
              <div class="two-fields">
                <label class="field-label"
                  >纸张<select v-model="paper">
                    <option value="six">6 寸相纸</option>
                    <option value="a4">A4</option>
                  </select></label
                ><label class="field-label"
                  >纸张方向<select v-model="orientation">
                    <option value="landscape">横向</option>
                    <option value="portrait">纵向</option>
                  </select></label
                >
              </div>
              <div class="two-fields">
                <label class="field-label"
                  >页边距（mm）<input
                    v-model.number="margin"
                    type="number"
                    min="0"
                    max="30"
                    step="0.5" /></label
                ><label class="field-label"
                  >照片间距（mm）<input
                    v-model.number="printGap"
                    type="number"
                    min="0"
                    max="20"
                    step="0.5"
                /></label>
              </div>
              <label class="field-label"
                >照片份数（0 为排满）<input
                  v-model.number="copies"
                  type="number"
                  min="0"
                  max="100"
              /></label>
              <p class="muted">{{ printInfo }}</p>
            </template>
            <template v-if="pdf"
              ><label class="field-label"
                >A4 纸张方向<select v-model="pdfOrientation">
                  <option value="portrait">纵向</option>
                  <option value="landscape">横向</option>
                </select></label
              ><label class="field-label"
                >页边距（mm）<input
                  v-model.number="pdfMargin"
                  type="number"
                  min="0"
                  max="40"
                  step="1" /></label
            ></template>
            <label v-if="!pdf" class="field-label"
              >输出格式<select v-model="format">
                <option value="png">PNG</option>
                <option value="jpg">JPG</option>
                <option v-if="print" value="pdf">PDF（按纸张尺寸打印）</option>
              </select></label
            >
          </fieldset>
          <button
            class="button primary full-width workshop-space"
            :disabled="working"
            @click="generate"
          >
            <Icon
              :name="working ? 'LoaderCircle' : 'FileOutput'"
              :class="{ spin: working }"
              :size="17"
            />{{
              working
                ? "正在生成…"
                : pdf
                  ? "生成 PDF"
                  : print
                    ? "生成打印排版"
                    : "生成拼图"
            }}
          </button>
        </div>
        <div class="batch-preview">
          <div v-if="preview" class="batch-result">
            <p class="muted">{{ detail }}</p>
            <div class="image-result-stage">
              <img :src="preview" :alt="pdf ? 'PDF 第 1 页预览' : '输出预览'" />
            </div>
            <div class="action-row">
              <button class="button primary" @click="download">
                <Icon name="Download" :size="17" />{{
                  pdf || format === "pdf" ? "下载 PDF" : "下载图片"
                }}</button
              ><span class="muted">{{
                output ? formatBytes(output.size) : ""
              }}</span>
            </div>
          </div>
          <div v-else class="batch-source-preview">
            <h2>已选图片 · {{ images.length }} 张</h2>
            <p>
              按左侧顺序生成{{ pdf ? " PDF" : print ? "打印排版" : "拼接图" }}
            </p>
            <div class="image-source-grid">
              <figure v-for="(image, index) in images" :key="image.id">
                <img :src="image.url" :alt="image.name" />
                <figcaption>{{ index + 1 }}. {{ image.name }}</figcaption>
              </figure>
            </div>
          </div>
        </div>
      </div>
    </template>
    <p v-if="uploadError || error" class="error-message" role="alert">
      {{ uploadError || error }}
    </p>
    <div class="workspace-footnote">
      <Icon name="Info" :size="15" /><span
        >{{
          print
            ? "照片按比例完整放入，比例不符时留白；需要裁剪可先使用证件照制作。打印时选择「实际大小 / 100%」，关闭适应纸张。"
            : pdf
              ? "每张图片独占一页，按列表顺序生成，保持比例并完整放入 A4 页面。"
              : "长图按统一边长缩放，网格完整显示图片并用背景色留白。"
        }}
        图片最长边超过 2048 像素时会缩小后处理；动画仅使用第一帧。</span
      >
    </div>
  </div>
</template>
