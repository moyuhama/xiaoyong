<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from "vue";
import { basicSetup } from "codemirror";
import { EditorState, Compartment } from "@codemirror/state";
import {
  EditorView,
  keymap,
  placeholder as editorPlaceholder,
} from "@codemirror/view";
import { indentWithTab, undo, redo } from "@codemirror/commands";
import { HighlightStyle, syntaxHighlighting } from "@codemirror/language";
import { tags } from "@lezer/highlight";
import { json } from "@codemirror/lang-json";
import { javascript } from "@codemirror/lang-javascript";
import { html } from "@codemirror/lang-html";
import { css } from "@codemirror/lang-css";
import { sql } from "@codemirror/lang-sql";
import { xml } from "@codemirror/lang-xml";
import { yaml } from "@codemirror/lang-yaml";
import { markdown } from "@codemirror/lang-markdown";
import { copy, downloadText, notify } from "../lib/ui";
const props = withDefaults(
  defineProps<{
    title: string;
    modelValue: string;
    placeholder?: string;
    readonly?: boolean;
    filename?: string;
    count?: string;
    code?: boolean;
    language?: string;
  }>(),
  {
    placeholder: "",
    readonly: false,
    filename: "result.txt",
    count: "",
    code: false,
    language: "",
  },
);
const emit = defineEmits<{ "update:modelValue": [value: string] }>();
const host = ref<HTMLDivElement>(),
  picker = ref<HTMLInputElement>(),
  expanded = ref(false),
  wrap = ref(true);
const lineCount = computed(() =>
  props.modelValue ? props.modelValue.split("\n").length : 0,
);
const characters = computed(() =>
  Array.from(props.modelValue).length.toLocaleString(),
);
const wrapping = new Compartment(),
  syntax = new Compartment(),
  hints = new Compartment();
let view: EditorView | undefined,
  importing = 0,
  disposed = false;
function language() {
  if (!props.code) return [];
  const name = (
    props.language || props.title + " " + props.filename
  ).toLowerCase();
  if (/json|header|payload/.test(name)) return json();
  if (/yaml|yml/.test(name)) return yaml();
  if (/sql/.test(name)) return sql();
  if (/xml/.test(name)) return xml();
  if (/html/.test(name)) return html();
  if (/css/.test(name)) return css();
  if (/typescript|\.ts\b/.test(name)) return javascript({ typescript: true });
  if (/javascript|\.js\b/.test(name)) return javascript();
  if (/markdown|\.md\b/.test(name)) return markdown();
  return [];
}
function replace(value: string) {
  view?.dispatch({
    changes: { from: 0, to: view.state.doc.length, insert: value },
  });
}
async function openFile(event: Event) {
  const input = event.target as HTMLInputElement,
    file = input.files?.[0];
  input.value = "";
  if (!file) return;
  if (file.size > 2 * 1024 * 1024) return notify("文本文件请控制在 2 MB 以内");
  const version = ++importing;
  try {
    const text = new TextDecoder("utf-8", { fatal: true }).decode(
      await file.arrayBuffer(),
    );
    if (disposed || version !== importing) return;
    if (text.includes("\0")) throw new Error();
    replace(text);
  } catch {
    if (!disposed) notify("请选择 UTF-8 编码的文本文件");
  }
}
function clear() {
  importing++;
  replace("");
  view?.focus();
}
function escape(event: KeyboardEvent) {
  if (event.key === "Escape") expanded.value = false;
}
onMounted(() => {
  view = new EditorView({
    parent: host.value,
    state: EditorState.create({
      doc: props.modelValue,
      extensions: [
        basicSetup,
        syntaxHighlighting(
          HighlightStyle.define([
            { tag: tags.keyword, color: "var(--syntax-keyword)" },
            {
              tag: [tags.string, tags.attributeValue],
              color: "var(--syntax-string)",
            },
            {
              tag: [tags.number, tags.bool, tags.null],
              color: "var(--syntax-number)",
            },
            {
              tag: [tags.propertyName, tags.attributeName, tags.tagName],
              color: "var(--syntax-property)",
            },
            { tag: tags.comment, color: "var(--muted)", fontStyle: "italic" },
            { tag: tags.invalid, color: "var(--danger)" },
          ]),
        ),
        keymap.of([indentWithTab]),
        wrapping.of(EditorView.lineWrapping),
        syntax.of(language()),
        hints.of([
          editorPlaceholder(props.placeholder),
          EditorView.contentAttributes.of({
            "aria-label": props.title,
            spellcheck: "false",
          }),
        ]),
        EditorState.readOnly.of(props.readonly),
        EditorView.editable.of(!props.readonly),
        EditorView.updateListener.of((update) => {
          if (update.docChanged && !props.readonly)
            emit("update:modelValue", update.state.doc.toString());
        }),
        EditorView.theme({
          "&": {
            height: "100%",
            fontSize: "14px",
            backgroundColor: "var(--surface)",
            color: "var(--text)",
          },
          ".cm-scroller": {
            overflow: "auto",
            fontFamily: "'SFMono-Regular', Consolas, monospace",
            lineHeight: "1.75",
          },
          ".cm-content": { padding: "12px 0" },
          ".cm-line": { padding: "0 12px" },
          ".cm-gutters": {
            backgroundColor: "var(--soft-bg)",
            color: "var(--muted)",
            borderRight: "1px solid var(--border)",
          },
          ".cm-activeLine, .cm-activeLineGutter": {
            backgroundColor: "var(--tint)",
          },
          "&.cm-focused": { outline: "none" },
          ".cm-cursor": { borderLeftColor: "var(--text)" },
          ".cm-selectionBackground, &.cm-focused .cm-selectionBackground": {
            backgroundColor: "#16836c30",
          },
          ".cm-panels": {
            backgroundColor: "var(--soft-bg)",
            color: "var(--text)",
          },
          ".cm-search input": {
            backgroundColor: "var(--surface)",
            color: "var(--text)",
            border: "1px solid var(--border)",
          },
          ".cm-placeholder": { color: "var(--muted)" },
        }),
      ],
    }),
  });
  document.addEventListener("keydown", escape);
});
watch(
  () => props.modelValue,
  (value) => {
    if (view && value !== view.state.doc.toString())
      view.dispatch({
        changes: { from: 0, to: view.state.doc.length, insert: value },
      });
  },
);
watch(
  () => [props.language, props.title, props.filename, props.placeholder],
  () =>
    view?.dispatch({
      effects: [
        syntax.reconfigure(language()),
        hints.reconfigure([
          editorPlaceholder(props.placeholder),
          EditorView.contentAttributes.of({
            "aria-label": props.title,
            spellcheck: "false",
          }),
        ]),
      ],
    }),
);
watch(wrap, (value) =>
  view?.dispatch({
    effects: wrapping.reconfigure(value ? EditorView.lineWrapping : []),
  }),
);
watch(expanded, () => nextTick(() => view?.requestMeasure()));
onUnmounted(() => {
  disposed = true;
  importing++;
  view?.destroy();
  document.removeEventListener("keydown", escape);
});
</script>
<template>
  <section
    class="editor-panel work-editor"
    :class="{ 'editor-expanded': expanded }"
    :aria-label="title"
  >
    <div class="panel-heading">
      <h2>{{ title }}</h2>
      <div class="panel-actions">
        <button v-if="!readonly" type="button" @click="picker?.click()">
          打开文件
        </button>
        <button
          v-if="!readonly"
          type="button"
          :disabled="!modelValue"
          @click="clear"
        >
          清空
        </button>
        <button
          type="button"
          :disabled="!modelValue"
          :aria-label="'复制' + title"
          @click="copy(modelValue)"
        >
          复制
        </button>
        <button
          v-if="readonly"
          type="button"
          :disabled="!modelValue"
          :aria-label="'下载' + title"
          @click="downloadText(modelValue, filename)"
        >
          下载
        </button>
      </div>
    </div>
    <div class="editor-commands">
      <div>
        <button v-if="!readonly" @click="view && undo(view)">撤销</button
        ><button v-if="!readonly" @click="view && redo(view)">重做</button
        ><span v-else>只读结果</span>
      </div>
      <div>
        <label><input type="checkbox" v-model="wrap" />自动换行</label
        ><button
          @click="expanded = !expanded"
          :aria-label="(expanded ? '收起' : '放大') + title"
        >
          {{ expanded ? "收起" : "放大" }}
        </button>
      </div>
    </div>
    <input
      ref="picker"
      type="file"
      accept=".txt,.json,.csv,.tsv,.xml,.yaml,.yml,.md,.sql,.js,.ts,.css,.html,.log"
      hidden
      @change="openFile"
    />
    <div ref="host" class="code-editor-host"></div>
    <div class="editor-footer">
      <span>{{ count || `${characters} 字符 · ${lineCount} 行` }}</span
      ><span>Ctrl / ⌘ + F 查找{{ expanded ? " · Esc 收起" : "" }}</span>
    </div>
  </section>
</template>
<style scoped>
.work-editor {
  min-height: 0;
  position: relative;
  background: var(--surface);
}
.work-editor .panel-heading {
  height: auto;
  min-height: 48px;
  padding: 10px 14px;
  flex-wrap: wrap;
  gap: 8px;
  background: var(--soft-bg);
}
.work-editor .panel-heading h2 {
  font-size: 13px;
  margin: 0;
}
.work-editor .panel-actions {
  gap: 12px;
  flex-wrap: wrap;
}
.work-editor button {
  font-size: 12px;
  color: var(--primary);
  padding: 3px 0;
  cursor: pointer;
}
.work-editor button:disabled {
  opacity: 0.4;
  cursor: default;
}
.editor-commands {
  display: flex;
  justify-content: space-between;
  gap: 10px;
  padding: 7px 14px;
  border-bottom: 1px solid var(--border);
  font-size: 11px;
  color: var(--subtle);
}
.editor-commands > div {
  display: flex;
  align-items: center;
  gap: 14px;
}
.editor-commands label {
  display: flex;
  align-items: center;
  gap: 5px;
}
.editor-commands input {
  accent-color: var(--primary);
}
.code-editor-host {
  height: 380px;
  min-height: 180px;
  overflow: hidden;
  resize: vertical;
}
.editor-footer {
  padding: 9px 14px;
  font-size: 11px;
}
.editor-expanded {
  position: fixed;
  inset: 18px;
  z-index: 1000;
  border: 1px solid var(--border);
  border-radius: 8px;
  box-shadow: 0 0 0 100vmax #0007;
  overflow: hidden;
}
.editor-expanded .code-editor-host {
  height: auto;
  flex: 1;
  resize: none;
}
@media (max-width: 700px) {
  .code-editor-host {
    height: 280px;
  }
  .editor-expanded {
    inset: 8px;
  }
  .editor-footer {
    font-size: 10px;
  }
  .work-editor .panel-actions {
    gap: 10px;
  }
}
</style>
