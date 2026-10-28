<script setup lang="ts">
import { computed, ref, watch } from "vue";
import EditorPanel from "./EditorPanel.vue";
import Icon from "./Icon.vue";
import { useWorkerTask } from "../lib/worker-task";
import type { TextWorkshopRequest } from "../lib/more-tools";
const props = defineProps<{ toolId: string }>();
const sql = computed(() => props.toolId === "sql-format");
const input = ref(""),
  dialect = ref<TextWorkshopRequest["dialect"]>("sql"),
  keywordCase = ref<TextWorkshopRequest["keywordCase"]>("upper"),
  indent = ref(2);
const tone = ref<TextWorkshopRequest["tone"]>("symbol"),
  initials = ref(false),
  surname = ref(false),
  uppercase = ref(false);
const { result, busy, error, run, cancel } = useWorkerTask<
  TextWorkshopRequest,
  string
>(
  () =>
    new Worker(new URL("../workers/text-workshop.ts", import.meta.url), {
      type: "module",
    }),
  10000,
);
watch(
  [input, dialect, keywordCase, indent, tone, initials, surname, uppercase],
  cancel,
);
function example() {
  input.value = sql.value
    ? "select u.id, u.name, count(o.id) as orders from users u left join orders o on o.user_id = u.id where u.active = 1 group by u.id, u.name order by orders desc;"
    : "你好，小用工具箱！\n重庆的银行，音乐与快乐。";
}
function process() {
  void run({
    kind: sql.value ? "sql" : "pinyin",
    text: input.value,
    dialect: dialect.value,
    keywordCase: keywordCase.value,
    indent: indent.value,
    tone: tone.value,
    initials: initials.value,
    surname: surname.value,
    uppercase: uppercase.value,
  });
}
</script>
<template>
  <div class="tool-workspace">
    <div class="tool-toolbar">
      <div class="toolbar-options">
        <template v-if="sql">
          <label class="inline-label"
            >SQL 方言<select v-model="dialect">
              <option value="sql">标准 SQL</option>
              <option value="mysql">MySQL</option>
              <option value="postgresql">PostgreSQL</option>
              <option value="sqlite">SQLite</option>
              <option value="transactsql">SQL Server</option>
            </select></label
          >
          <label class="inline-label"
            >关键字<select v-model="keywordCase">
              <option value="upper">大写</option>
              <option value="lower">小写</option>
              <option value="preserve">保留原样</option>
            </select></label
          >
          <label class="inline-label"
            >缩进<select v-model.number="indent">
              <option :value="2">2 空格</option>
              <option :value="4">4 空格</option>
            </select></label
          >
        </template>
        <template v-else>
          <label class="inline-label"
            >声调<select v-model="tone" :disabled="initials">
              <option value="symbol">声调符号</option>
              <option value="num">数字声调</option>
              <option value="none">不带声调</option>
            </select></label
          >
          <label class="check-label"
            ><input v-model="initials" type="checkbox" />仅首字母</label
          >
          <label class="check-label"
            ><input v-model="surname" type="checkbox" />姓氏读音优先</label
          >
          <label class="check-label"
            ><input v-model="uppercase" type="checkbox" />大写输出</label
          >
        </template>
      </div>
      <div class="toolbar-actions">
        <button class="text-button" @click="example">填入示例</button
        ><button
          class="icon-button"
          aria-label="清空输入"
          @click="
            input = '';
            cancel();
          "
        >
          <Icon name="RotateCcw" :size="17" />
        </button>
      </div>
    </div>
    <div class="action-row">
      <button class="button primary" :disabled="busy" @click="process">
        <Icon
          :name="busy ? 'LoaderCircle' : sql ? 'CodeXml' : 'Type'"
          :class="{ spin: busy }"
          :size="17"
        />{{ busy ? "处理中…" : sql ? "格式化 SQL" : "转换拼音" }}</button
      ><button v-if="busy" class="button secondary" @click="cancel">
        取消
      </button>
    </div>
    <div class="editor-grid">
      <EditorPanel
        v-model="input"
        :title="sql ? '输入 SQL' : '输入汉字'"
        :placeholder="
          sql ? '粘贴 SQL 语句…' : '输入汉字，可保留英文、数字与换行…'
        "
        :code="sql"
        :language="sql ? 'sql' : ''"
      /><EditorPanel
        :model-value="result || ''"
        title="处理结果"
        readonly
        code
        :filename="sql ? 'formatted.sql' : 'pinyin.txt'"
        placeholder="点击上方按钮生成结果"
      />
    </div>

    <p v-if="error" class="error-message" role="alert">{{ error }}</p>
    <div class="workspace-footnote">
      <Icon name="Info" :size="15" />{{
        sql
          ? "仅整理 SQL 排版，不连接数据库或执行语句；格式化成功不代表语句能够执行。最多 50,000 字符。"
          : "保留换行；多音字按词语自动判断，姓名可开启姓氏模式，生僻字和特殊读音请核对。最多 10,000 字符。"
      }}
    </div>
  </div>
</template>
