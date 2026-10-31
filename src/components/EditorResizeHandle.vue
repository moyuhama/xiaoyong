<script setup lang="ts">
import { computed, onUnmounted, ref, watch } from "vue";

const props = withDefaults(
  defineProps<{ target?: HTMLElement; label: string; minHeight?: number }>(),
  { minHeight: 100 },
);
const emit = defineEmits<{ resize: [] }>();
const height = ref(0),
  minimum = ref(props.minHeight),
  dragging = ref(false);
const maximum = 2400;
const value = computed(() => Math.round(height.value));
let observer: ResizeObserver | undefined;
let pointer: number | undefined;
let startY = 0,
  startHeight = 0;

watch(
  () => props.target,
  (target) => {
    observer?.disconnect();
    if (!target) return;
    observer = new ResizeObserver(() => {
      minimum.value = Math.max(
        props.minHeight,
        parseFloat(getComputedStyle(target).minHeight) || 0,
      );
      height.value = target.getBoundingClientRect().height;
      emit("resize");
    });
    observer.observe(target);
  },
  { immediate: true, flush: "post" },
);

function setHeight(next: number) {
  if (!props.target) return;
  props.target.style.height = `${Math.max(minimum.value, Math.min(maximum, next))}px`;
}
function start(event: PointerEvent) {
  if (!props.target || !event.isPrimary || event.button !== 0) return;
  const handle = event.currentTarget as HTMLElement;
  event.preventDefault();
  handle.focus({ preventScroll: true });
  pointer = event.pointerId;
  startY = event.clientY;
  startHeight = props.target.getBoundingClientRect().height;
  handle.setPointerCapture(pointer);
  dragging.value = true;
}
function move(event: PointerEvent) {
  if (event.pointerId === pointer)
    setHeight(startHeight + event.clientY - startY);
}
function stop(event: PointerEvent) {
  if (event.pointerId !== pointer) return;
  pointer = undefined;
  dragging.value = false;
  const handle = event.currentTarget as HTMLElement;
  if (handle.hasPointerCapture(event.pointerId))
    handle.releasePointerCapture(event.pointerId);
}
function keydown(event: KeyboardEvent) {
  const next =
    event.key === "ArrowDown"
      ? height.value + 40
      : event.key === "ArrowUp"
        ? height.value - 40
        : event.key === "Home"
          ? minimum.value
          : event.key === "End"
            ? maximum
            : undefined;
  if (next === undefined) return;
  event.preventDefault();
  setHeight(next);
}
onUnmounted(() => observer?.disconnect());
</script>

<template>
  <div
    class="editor-resize-handle"
    :class="{ dragging }"
    role="separator"
    tabindex="0"
    aria-orientation="horizontal"
    :aria-label="label + '高度'"
    :aria-valuemin="minimum"
    :aria-valuemax="maximum"
    :aria-valuenow="value"
    :aria-valuetext="value + '像素'"
    title="上下拖动调整高度；也可聚焦后按上下方向键"
    @pointerdown="start"
    @pointermove="move"
    @pointerup="stop"
    @pointercancel="stop"
    @lostpointercapture="stop"
    @keydown="keydown"
  >
    <span class="resize-grip" aria-hidden="true"></span>
    <span aria-hidden="true">拖动调整高度</span>
  </div>
</template>

<style scoped>
.editor-resize-handle {
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  gap: 8px;
  min-height: 24px;
  padding: 3px 12px;
  border-top: 1px solid var(--border);
  background: var(--soft-bg);
  color: var(--subtle);
  font-size: 10px;
  line-height: 16px;
  cursor: ns-resize;
  touch-action: none;
  user-select: none;
}
.editor-resize-handle:hover,
.editor-resize-handle.dragging,
.editor-resize-handle:focus-visible {
  background: var(--tint);
  color: var(--primary);
}
.editor-resize-handle:focus-visible {
  outline: 2px solid var(--primary);
  outline-offset: -2px;
}
.resize-grip {
  width: 18px;
  height: 5px;
  border-top: 1px solid currentColor;
  border-bottom: 1px solid currentColor;
}
@media (pointer: coarse) {
  .editor-resize-handle {
    min-height: 32px;
  }
}
</style>
