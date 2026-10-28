<script setup lang="ts">
import { onMounted, onUnmounted, ref, watch } from "vue";
import { basicSetup } from "codemirror";
import { EditorState, Compartment, Transaction } from "@codemirror/state";
import { EditorView, placeholder } from "@codemirror/view";
import { undo, redo, undoDepth, redoDepth } from "@codemirror/commands";
import { openSearchPanel } from "@codemirror/search";
import { json } from "@codemirror/lang-json";
import { HighlightStyle, syntaxHighlighting } from "@codemirror/language";
import { tags } from "@lezer/highlight";
const props = defineProps<{
  modelValue: string;
  label: string;
  placeholder: string;
  readonly: boolean;
  wrap: boolean;
  code: boolean;
  json: boolean;
}>();
const emit = defineEmits<{
  "update:modelValue": [value: string];
  history: [canUndo: boolean, canRedo: boolean];
}>();
const host = ref<HTMLDivElement>();
const wrapping = new Compartment(),
  language = new Compartment(),
  attributes = new Compartment(),
  hint = new Compartment();
let editor: EditorView | undefined;
const languageExtension = () =>
  props.json && props.modelValue.length < 200000 ? json() : [];
const contentAttributes = () =>
  EditorView.contentAttributes.of({
    "aria-label": props.label,
    "aria-readonly": String(props.readonly),
    "aria-multiline": "true",
    role: "textbox",
    spellcheck: "false",
  });
onMounted(() => {
  editor = new EditorView({
    parent: host.value,
    state: EditorState.create({
      doc: props.modelValue,
      extensions: [
        basicSetup,
        EditorState.readOnly.of(props.readonly),
        syntaxHighlighting(
          HighlightStyle.define([
            { tag: tags.propertyName, color: "var(--syntax-key)" },
            { tag: tags.string, color: "var(--syntax-string)" },
            { tag: tags.number, color: "var(--syntax-number)" },
            { tag: [tags.bool, tags.null], color: "var(--syntax-atom)" },
          ]),
        ),
        wrapping.of(props.wrap ? EditorView.lineWrapping : []),
        language.of(languageExtension()),
        attributes.of(contentAttributes()),
        hint.of(placeholder(props.placeholder)),
        EditorView.updateListener.of((update) => {
          if (update.docChanged)
            emit("update:modelValue", update.state.doc.toString());
          emit(
            "history",
            undoDepth(update.state) > 0,
            redoDepth(update.state) > 0,
          );
        }),
        EditorState.phrases.of({
          Find: "查找",
          Replace: "替换",
          next: "下一个",
          previous: "上一个",
          all: "全部",
          "match case": "区分大小写",
          regexp: "正则",
          "by word": "完整单词",
          replace: "替换",
          "replace all": "替换全部",
          close: "关闭",
          "Fold line": "折叠此行",
          "Unfold line": "展开此行",
        }),
      ],
    }),
  });
});
watch(
  () => props.modelValue,
  (value) => {
    if (editor && editor.state.doc.toString() !== value)
      editor.dispatch({
        changes: { from: 0, to: editor.state.doc.length, insert: value },
        annotations: props.readonly ? Transaction.addToHistory.of(false) : [],
      });
  },
);
watch(
  () => props.wrap,
  (value) =>
    editor?.dispatch({
      effects: wrapping.reconfigure(value ? EditorView.lineWrapping : []),
    }),
);
watch([() => props.json, () => props.modelValue.length >= 200000], () =>
  editor?.dispatch({ effects: language.reconfigure(languageExtension()) }),
);
watch(
  () => props.label,
  () =>
    editor?.dispatch({ effects: attributes.reconfigure(contentAttributes()) }),
);
watch(
  () => props.placeholder,
  (value) => editor?.dispatch({ effects: hint.reconfigure(placeholder(value)) }),
);
onUnmounted(() => editor?.destroy());
defineExpose({
  undo: () => editor && undo(editor),
  redo: () => editor && redo(editor),
  find: () => editor && openSearchPanel(editor),
});
</script>
<template>
  <div
    ref="host"
    class="text-editor"
    :class="{ 'is-code': code, 'is-readonly': readonly }"
  ></div>
</template>
