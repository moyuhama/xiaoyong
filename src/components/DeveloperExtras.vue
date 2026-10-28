<script setup lang="ts">
import { computed, onUnmounted, ref, watch } from "vue";
import Icon from "./Icon.vue";
import EditorPanel from "./EditorPanel.vue";
import { convertRadix, hashText, parseUrl } from "../lib/data-tools";
import { copy, downloadText } from "../lib/ui";
const props = defineProps<{ toolId: string }>();
const input = ref(""),
  algorithm = ref("SHA-256"),
  digest = ref(""),
  error = ref(""),
  busy = ref(false);
const fromBase = ref(10),
  toBase = ref(16);
const bases = Array.from({ length: 35 }, (_, i) => i + 2);
let generation = 0;
const radix = computed(() => {
  if (!input.value.trim()) return { result: "", error: "" };
  try {
    return {
      result: convertRadix(input.value, fromBase.value, toBase.value),
      error: "",
    };
  } catch (err) {
    return {
      result: "",
      error: err instanceof Error ? err.message : "无法转换",
    };
  }
});
const parsedUrl = computed(() => {
  if (!input.value.trim()) return { data: null, error: "" };
  try {
    return { data: parseUrl(input.value), error: "" };
  } catch (err) {
    return {
      data: null,
      error: err instanceof Error ? err.message : "无法解析",
    };
  }
});
async function calculateHash() {
  const current = ++generation;
  busy.value = true;
  digest.value = "";
  error.value = "";
  try {
    const result = await hashText(input.value, algorithm.value);
    if (current === generation) digest.value = result;
  } catch (err) {
    if (current === generation)
      error.value = err instanceof Error ? err.message : "无法计算哈希，请重试";
  } finally {
    if (current === generation) busy.value = false;
  }
}
const commonBases = computed(() =>
  [2, 8, 10, 16].map((base) => {
    try {
      return {
        base,
        value: input.value.trim()
          ? convertRadix(input.value, fromBase.value, base)
          : "",
      };
    } catch {
      return { base, value: "" };
    }
  }),
);
function swapBases() {
  const result = radix.value.result;
  [fromBase.value, toBase.value] = [toBase.value, fromBase.value];
  if (result) input.value = result;
}
function example() {
  if (props.toolId === "hash") input.value = "Hello, 小用!";
  else if (props.toolId === "radix") {
    fromBase.value = 10;
    toBase.value = 16;
    input.value = "9007199254740993";
  } else
    input.value =
      "https://example.com:8080/search?q=%E5%B7%A5%E5%85%B7&tag=vue&tag=typescript#results";
}
watch([input, algorithm], () => {
  generation++;
  digest.value = "";
  error.value = "";
  busy.value = false;
});
onUnmounted(() => {
  generation++;
});
</script>

<template>
  <div class="tool-workspace">
    <div class="tool-toolbar">
      <div class="toolbar-options">
        <label v-if="toolId === 'hash'" class="inline-label"
          >算法<select v-model="algorithm">
            <option>SHA-256</option>
            <option>SHA-384</option>
            <option>SHA-512</option>
          </select></label
        >
        <template v-else-if="toolId === 'radix'">
          <label class="inline-label"
            >原进制<select v-model.number="fromBase">
              <option v-for="base in bases" :key="base" :value="base">
                {{ base }} 进制
              </option>
            </select></label
          >
          <button class="icon-button" aria-label="交换进制" @click="swapBases">
            <Icon name="ArrowRight" :size="17" />
          </button>
          <label class="inline-label"
            >目标进制<select v-model.number="toBase">
              <option v-for="base in bases" :key="base" :value="base">
                {{ base }} 进制
              </option>
            </select></label
          >
        </template>
        <span v-else class="muted">网址结构与查询参数</span>
      </div>
      <div class="toolbar-actions">
        <button class="text-button" @click="example">填入示例</button
        ><button class="icon-button" aria-label="清空输入" @click="input = ''">
          <Icon name="RotateCcw" :size="17" />
        </button>
      </div>
    </div>
    <template v-if="toolId !== 'url-parser'">
      <div v-if="toolId === 'hash'" class="action-row">
        <button class="button primary" :disabled="busy" @click="calculateHash">
          <Icon name="Hash" :size="17" />{{
            busy ? "正在计算…" : "计算哈希"
          }}</button
        ><span class="muted">空文本也可以计算</span>
      </div>
      <div class="editor-grid">
        <EditorPanel
          v-model="input"
          :title="toolId === 'hash' ? '输入文本' : '待转换整数'"
          :placeholder="
            toolId === 'hash'
              ? '输入需要计算哈希的文字，也可以保持为空'
              : '输入整数，支持负数和对应进制的前缀'
          "
          code
        />
        <section v-if="toolId === 'radix'" class="radix-results">
          <h2>常用进制结果</h2>
          <div v-for="item in commonBases" :key="item.base">
            <label>{{ item.base }} 进制</label
            ><code>{{ item.value || "—" }}</code
            ><button
              class="text-button"
              :disabled="!item.value"
              @click="copy(item.value)"
            >
              复制
            </button>
          </div>
          <div>
            <label>{{ toBase }} 进制（所选）</label
            ><code>{{ radix.result || "—" }}</code
            ><button
              class="text-button"
              :disabled="!radix.result"
              @click="copy(radix.result)"
            >
              复制
            </button>
          </div>
        </section>
        <EditorPanel
          v-else
          :model-value="digest"
          :title="toolId === 'hash' ? '哈希结果' : '转换结果'"
          filename="result.txt"
          readonly
          code
        />
      </div>
      <div
        v-if="error || (toolId === 'radix' && radix.error)"
        role="alert"
        class="error-message"
      >
        {{ error || radix.error }}
      </div>

      <div class="workspace-footnote">
        <Icon name="Info" :size="15" /><span>{{
          toolId === "hash"
            ? "按 UTF-8 编码计算，空格和换行也参与计算；输出十六进制摘要。"
            : "支持 2–36 进制整数，保留大整数精度；不支持小数。可使用匹配进制的 0b、0o、0x 前缀。"
        }}</span>
      </div>
    </template>
    <template v-else>
      <div class="settings-panel">
        <label class="field-label"
          >完整网址<textarea
            v-model="input"
            rows="3"
            maxlength="20000"
            placeholder="https://example.com/search?q=hello"
            spellcheck="false"
          ></textarea>
        </label>
        <p v-if="parsedUrl.error" role="alert" class="inline-error">
          {{ parsedUrl.error }}
        </p>
      </div>
      <div v-if="parsedUrl.data" class="url-results">
        <section>
          <h2>网址结构</h2>
          <dl class="detail-list">
            <div v-for="[label, value] in parsedUrl.data.parts" :key="label">
              <dt>{{ label }}</dt>
              <dd>{{ value }}</dd>
              <button
                class="icon-button"
                :aria-label="'复制' + label"
                :disabled="value === '—'"
                @click="copy(value!)"
              >
                <Icon name="Copy" :size="15" />
              </button>
            </div>
          </dl>
        </section>
        <section>
          <h2>
            查询参数
            <span class="muted">{{ parsedUrl.data.params.length }} 项</span>
          </h2>
          <div v-if="parsedUrl.data.params.length" class="table-scroll">
            <table class="data-table">
              <thead>
                <tr>
                  <th>参数名</th>
                  <th>解码后的值</th>
                  <th>操作</th>
                </tr>
              </thead>
              <tbody>
                <tr
                  v-for="([key, value], index) in parsedUrl.data.params"
                  :key="index"
                >
                  <td>{{ key || "（空参数名）" }}</td>
                  <td>{{ value || "（空值）" }}</td>
                  <td>
                    <button
                      class="icon-button"
                      :aria-label="
                        '复制参数 ' + key + ' 第 ' + (index + 1) + ' 项'
                      "
                      :disabled="!value"
                      @click="copy(value)"
                    >
                      <Icon name="Copy" :size="15" />
                    </button>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
          <p v-else class="muted">此网址没有查询参数</p>
          <button
            class="text-button"
            @click="
              downloadText(
                JSON.stringify(
                  parsedUrl.data.params.map(([name, value]) => ({
                    name,
                    value,
                  })),
                  null,
                  2,
                ),
                'url-parameters.json',
              )
            "
          >
            下载参数 JSON
          </button>
        </section>
      </div>
      <div v-else-if="!parsedUrl.error" class="preview-empty">
        输入完整网址，自动拆解各个部分
      </div>
      <div class="workspace-footnote">
        <Icon name="Info" :size="15" />重复参数逐项保留；查询参数中的 +
        按空格解码。
      </div>
    </template>
  </div>
</template>
