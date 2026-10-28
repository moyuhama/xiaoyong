<script setup lang="ts">
import {
  computed,
  defineAsyncComponent,
  onMounted,
  onUnmounted,
  ref,
  watch,
} from "vue";
import Icon from "./components/Icon.vue";
import ToolCard from "./components/ToolCard.vue";
import ToolSearch from "./components/ToolSearch.vue";
import { commonTools, toolGroups, prioritizeTools } from "./lib/catalog";
import { categories, tools, searchTools } from "./lib/tools";
import { toast } from "./lib/ui";

const TextTools = defineAsyncComponent(
  () => import("./components/TextTools.vue"),
);
const DevTools = defineAsyncComponent(
  () => import("./components/DevTools.vue"),
);
const ImageTools = defineAsyncComponent(
  () => import("./components/ImageTools.vue"),
);
const DailyTools = defineAsyncComponent(
  () => import("./components/DailyTools.vue"),
);
const extraModules = {
  timestamp: defineAsyncComponent(
    () => import("./components/TimestampTool.vue"),
  ),
  "popular-text": defineAsyncComponent(
    () => import("./components/PopularTextTools.vue"),
  ),
  math: defineAsyncComponent(() => import("./components/MathTools.vue")),
  files: defineAsyncComponent(() => import("./components/FileUtilities.vue")),
  scan: defineAsyncComponent(() => import("./components/ScanTools.vue")),
  "image-polish": defineAsyncComponent(
    () => import("./components/ImagePolishTools.vue"),
  ),
  "pdf-read": defineAsyncComponent(
    () => import("./components/PdfReadTools.vue"),
  ),
  "image-batch": defineAsyncComponent(
    () => import("./components/ImageBatchTools.vue"),
  ),
  "image-utility": defineAsyncComponent(
    () => import("./components/ImageUtilityTools.vue"),
  ),
  "text-workshop": defineAsyncComponent(
    () => import("./components/TextWorkshop.vue"),
  ),
  "number-tools": defineAsyncComponent(
    () => import("./components/NumberTools.vue"),
  ),
  "id-photo": defineAsyncComponent(
    () => import("./components/IdPhotoTool.vue"),
  ),
  config: defineAsyncComponent(() => import("./components/ConfigTools.vue")),
  cron: defineAsyncComponent(() => import("./components/CronTool.vue")),
  "text-extras": defineAsyncComponent(
    () => import("./components/TextExtras.vue"),
  ),
  picture: defineAsyncComponent(() => import("./components/PictureTools.vue")),
  pdf: defineAsyncComponent(() => import("./components/PdfTools.vue")),
  clock: defineAsyncComponent(() => import("./components/ClockTools.vue")),
  content: defineAsyncComponent(() => import("./components/ContentTools.vue")),
  "developer-extras": defineAsyncComponent(
    () => import("./components/DeveloperExtras.vue"),
  ),
  "everyday-extras": defineAsyncComponent(
    () => import("./components/EverydayExtras.vue"),
  ),
};
const route = ref(location.hash.slice(1) || "/");
const query = ref("");
const searchInput = ref<HTMLInputElement>();
const searchDialog = ref<InstanceType<typeof ToolSearch>>();
const focused = ref(false);
const sidebarTools = computed(() =>
  currentTool.value
    ? prioritizeTools(
        tools.filter((t) => t.category === currentTool.value?.category),
      )
    : commonTools,
);
const mobileOpen = ref(false);
const mobileQuery = window.matchMedia("(max-width: 760px)");
const isMobile = ref(mobileQuery.matches);
function resizeLayout() {
  isMobile.value = mobileQuery.matches;
  if (!isMobile.value) mobileOpen.value = false;
}
function focusMain() {
  document.getElementById("main-content")?.focus();
}
const about = ref<HTMLDialogElement>();
const theme = ref(document.documentElement.dataset.theme || "light");
const currentTool = computed(() =>
  route.value.startsWith("/tool/")
    ? tools.find((tool) => tool.id === route.value.split("/")[2])
    : undefined,
);
const view = computed(() =>
  route.value.startsWith("/category/") ? route.value.split("/")[2] : "all",
);
const isToolRoute = computed(() => route.value.startsWith("/tool/"));
const categoryName = computed(
  () =>
    categories.find((c) => c.id === currentTool.value?.category)?.name || "",
);
const title = computed(
  () => categories.find((c) => c.id === view.value)?.name || "全部工具",
);
const filtered = computed(() => {
  const source =
    view.value === "all"
      ? tools
      : tools.filter((tool) => tool.category === view.value);
  return searchTools(query.value, source);
});
const toolComponent = computed(() => {
  const module = currentTool.value?.module;
  if (module) return extraModules[module];
  const id = currentTool.value?.id;
  if (id?.startsWith("image-")) return ImageTools;
  if (id?.startsWith("text-")) return TextTools;
  if (["json", "encoding", "regex", "generator"].includes(id || ""))
    return DevTools;
  return DailyTools;
});
const repositoryUrl = import.meta.env.VITE_REPOSITORY_URL || "";
function navigate(path: string) {
  location.hash = path;
  mobileOpen.value = false;
  query.value = "";
}
function handleRoute() {
  route.value = location.hash.slice(1) || "/";
  mobileOpen.value = false;
  searchDialog.value?.close();
  window.scrollTo({ top: 0 });
}
function toggleTheme() {
  theme.value = theme.value === "light" ? "dark" : "light";
  document.documentElement.dataset.theme = theme.value;
  try {
    localStorage.setItem("xiaoyong-theme", theme.value);
  } catch {}
}
function focusSearch() {
  mobileOpen.value = false;
  searchDialog.value?.open();
}
function keydown(event: KeyboardEvent) {
  const target = event.target as HTMLElement;
  if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
    event.preventDefault();
    focusSearch();
  }
  if (
    event.key === "/" &&
    !["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName) &&
    !about.value?.open &&
    !target.isContentEditable &&
    !document.querySelector("dialog[open]")
  ) {
    event.preventDefault();
    focusSearch();
  }
  if (event.key === "Escape") mobileOpen.value = false;
}
watch(
  currentTool,
  (tool) => {
    document.title = tool
      ? tool.name + " · 小用工具箱"
      : "小用 · 让每件小事更简单";
  },
  { immediate: true },
);
onMounted(() => {
  mobileQuery.addEventListener("change", resizeLayout);
  window.addEventListener("hashchange", handleRoute);
  window.addEventListener("keydown", keydown);
});
onUnmounted(() => {
  mobileQuery.removeEventListener("change", resizeLayout);
  window.removeEventListener("hashchange", handleRoute);
  window.removeEventListener("keydown", keydown);
});
</script>

<template>
  <a class="skip-link" href="#main-content" @click.prevent="focusMain"
    >跳到主要内容</a
  >
  <div
    v-if="mobileOpen"
    class="sidebar-scrim"
    @click="mobileOpen = false"
  ></div>
  <aside
    class="sidebar"
    :inert="isMobile && !mobileOpen"
    :class="{ 'is-open': mobileOpen }"
  >
    <button
      class="icon-button sidebar-close mobile-menu"
      aria-label="关闭菜单"
      @click="mobileOpen = false"
    >
      <Icon name="X" :size="19" />
    </button>
    <a href="#/" class="brand" @click.prevent="navigate('/')">
      <span class="brand-mark"
        ><Icon name="BriefcaseBusiness" :size="25"
      /></span>
      <span
        ><strong>小用<span class="brand-dot">.</span></strong
        ><small>日常与开发工具箱</small></span
      >
    </a>
    <button class="sidebar-search" @click="focusSearch">
      <Icon name="Search" :size="17" /><span>搜索工具</span><kbd>⌘ K</kbd>
    </button>
    <div class="nav-section-label">工具分类</div>
    <nav aria-label="工具分类" class="main-nav">
      <a
        v-for="category in categories"
        :key="category.id"
        :href="category.id === 'all' ? '#/' : '#/category/' + category.id"
        :class="{
          active: currentTool
            ? currentTool.category === category.id
            : view === category.id,
        }"
        :aria-current="
          !isToolRoute && view === category.id ? 'page' : undefined
        "
        @click.prevent="
          navigate(category.id === 'all' ? '/' : '/category/' + category.id)
        "
      >
        <Icon :name="category.icon" :size="19" /><span>{{ category.name }}</span
        ><small>{{
          category.id === "all"
            ? tools.length
            : tools.filter((t) => t.category === category.id).length
        }}</small>
      </a>
    </nav>
    <div class="sidebar-tool-section">
      <div class="nav-section-label">
        {{ currentTool ? categoryName : "常用工具" }}
      </div>
      <nav class="sidebar-tools" aria-label="快捷工具">
        <a
          v-for="tool in sidebarTools"
          :key="tool.id"
          :href="'#/tool/' + tool.id"
          :class="{ active: currentTool?.id === tool.id }"
          :aria-current="currentTool?.id === tool.id ? 'page' : undefined"
          @click.prevent="navigate('/tool/' + tool.id)"
          ><Icon :name="tool.icon" :size="16" />{{ tool.name }}</a
        >
      </nav>
    </div>
    <div class="sidebar-bottom">
      <button class="sidebar-about" @click="about?.showModal()">
        <Icon name="CircleHelp" :size="17" />关于小用<span>v1.0</span>
      </button>
    </div>
  </aside>

  <div
    class="main-shell"
    :inert="isMobile && mobileOpen"
    :class="{ 'focus-mode': focused && isToolRoute }"
  >
    <header class="topbar">
      <div class="breadcrumb">
        <button
          class="icon-button mobile-menu"
          aria-label="打开菜单"
          @click="mobileOpen = true"
        >
          <Icon name="Menu" /></button
        ><Icon name="LayoutGrid" :size="17" /><button @click="navigate('/')">
          工具箱</button
        ><Icon name="ChevronRight" :size="14" /><span>{{
          currentTool ? categoryName : title
        }}</span
        ><template v-if="currentTool"
          ><Icon name="ChevronRight" :size="14" /><span
            class="breadcrumb-tool"
            >{{ currentTool.name }}</span
          ></template
        >
      </div>
      <button class="top-search" @click="focusSearch">
        <Icon name="Search" :size="17" /><span>搜索全部工具</span><kbd>⌘ K</kbd>
      </button>
      <div class="top-actions">
        <button
          class="icon-button"
          aria-label="搜索工具（Ctrl 或 Command + K）"
          @click="focusSearch"
        >
          <Icon name="Search" :size="19" /></button
        ><button
          class="icon-button"
          :aria-label="theme === 'light' ? '切换深色模式' : '切换浅色模式'"
          @click="toggleTheme"
        >
          <Icon :name="theme === 'light' ? 'Moon' : 'Sun'" :size="19" /></button
        ><a
          v-if="repositoryUrl"
          class="icon-button github-link"
          :href="repositoryUrl"
          target="_blank"
          rel="noopener noreferrer"
          aria-label="查看 GitHub 源码"
          ><Icon name="CodeXml" :size="20"
        /></a>
      </div>
    </header>
    <main id="main-content" tabindex="-1" :class="{ 'tool-page': isToolRoute }">
      <template v-if="!isToolRoute">
        <section class="catalog-intro">
          <div>
            <span class="catalog-kicker"
              >小用工具箱 <span>/ {{ tools.length }} TOOLS</span></span
            >
            <h1>{{ view === "all" ? "需要什么工具？" : title }}</h1>
            <p>
              {{
                view === "all"
                  ? "图片、文档、文本与开发，按需找到，打开即用。"
                  : "选择工具，开始处理。"
              }}
            </p>
          </div>
          <div class="search-box catalog-search">
            <Icon name="Search" :size="21" /><input
              ref="searchInput"
              v-model="query"
              type="search"
              aria-label="搜索工具"
              placeholder="搜索名称或用途，如 压缩、JSON…"
              @keydown.enter="
                filtered[0] && navigate('/tool/' + filtered[0].id)
              "
            /><button
              v-if="query"
              class="icon-button"
              aria-label="清空搜索"
              @click="query = ''"
            >
              <Icon name="X" :size="17" /></button
            ><kbd v-else>Enter</kbd>
          </div>
        </section>
        <nav class="catalog-category-bar" aria-label="筛选分类">
          <button
            v-for="category in categories"
            :key="category.id"
            :class="{ selected: view === category.id }"
            :aria-pressed="view === category.id"
            @click="
              navigate(category.id === 'all' ? '/' : '/category/' + category.id)
            "
          >
            <Icon :name="category.icon" :size="16" />{{ category.name
            }}<small>{{
              category.id === "all"
                ? tools.length
                : tools.filter((t) => t.category === category.id).length
            }}</small>
          </button>
        </nav>
        <template v-if="!query.trim() && view === 'all'">
          <section class="catalog-section common-section" aria-label="常用工具">
            <div class="catalog-section-heading">
              <h2><Icon name="Zap" :size="19" />常用工具</h2>
              <span>快速开始</span>
            </div>
            <div class="common-grid">
              <ToolCard
                v-for="tool in commonTools"
                :key="tool.id"
                :tool="tool"
                compact
                @open="navigate('/tool/' + $event)"
              />
            </div>
          </section>
          <section
            v-for="group in toolGroups"
            :key="group.id"
            class="catalog-section"
          >
            <div class="catalog-section-heading">
              <h2>
                <Icon :name="group.icon" :size="19" />{{ group.name
                }}<small>{{ group.tools.length }}</small>
              </h2>
              <a
                :href="'#/category/' + group.id"
                @click.prevent="navigate('/category/' + group.id)"
                >查看分类<Icon name="ChevronRight" :size="15"
              /></a>
            </div>
            <div class="catalog-grid">
              <ToolCard
                v-for="tool in group.tools"
                :key="tool.id"
                :tool="tool"
                @open="navigate('/tool/' + $event)"
              />
            </div>
          </section>
        </template>
        <section v-else-if="filtered.length" class="catalog-section">
          <div class="catalog-section-heading">
            <h2>{{ query.trim() ? "搜索结果" : title }}</h2>
            <span>{{ filtered.length }} 个工具</span>
          </div>
          <div class="catalog-grid">
            <ToolCard
              v-for="tool in filtered"
              :key="tool.id"
              :tool="tool"
              @open="navigate('/tool/' + $event)"
            />
          </div>
        </section>
        <div v-else class="empty-state">
          <span class="empty-icon"><Icon name="Search" :size="34" /></span>
          <h3>暂时没有找到这个工具</h3>
          <p>试试更短的关键词，如「图片」「文本」或「JSON」。</p>
          <button class="button secondary" @click="navigate('/')">
            浏览全部工具<Icon name="ArrowRight" :size="16" />
          </button>
        </div>
      </template>
      <template v-else-if="currentTool">
        <div class="tool-heading">
          <span class="tool-icon large" :class="currentTool.color"
            ><Icon :name="currentTool.icon" :size="25"
          /></span>
          <div class="tool-heading-copy">
            <h1>{{ currentTool.name }}</h1>
            <p>{{ currentTool.description }}</p>
          </div>
          <button
            class="button secondary focus-toggle"
            :aria-pressed="focused"
            @click="focused = !focused"
          >
            <Icon :name="focused ? 'Minimize2' : 'Maximize2'" :size="16" />{{
              focused ? "退出宽屏" : "宽屏模式"
            }}
          </button>
        </div>
        <Suspense
          ><component
            :is="toolComponent"
            :key="currentTool.id"
            :tool-id="currentTool.id"
          /><template #fallback
            ><div class="loading-state">
              <Icon name="LoaderCircle" class="spin" />正在准备工具…
            </div></template
          ></Suspense
        >
        <p class="tool-note">关闭或切换工具前，请复制或下载需要保留的结果。</p>
        <section class="related-section">
          <h2>相关工具</h2>
          <div class="related-tools">
            <a
              v-for="tool in tools
                .filter(
                  (t) =>
                    t.id !== currentTool?.id &&
                    t.category === currentTool?.category,
                )
                .slice(0, 3)"
              :key="tool.id"
              :href="'#/tool/' + tool.id"
              ><span class="mini-tool-icon" :class="tool.color"
                ><Icon :name="tool.icon" :size="18" /></span
              ><span>{{ tool.name }}</span
              ><Icon name="ArrowUpRight" :size="16"
            /></a>
          </div>
        </section>
      </template>
      <div v-else class="empty-state">
        <h1>这个工具暂时不存在</h1>
        <p>可能是链接有误，回到工具箱看看吧。</p>
        <button class="button primary" @click="navigate('/')">
          返回工具箱
        </button>
      </div>
    </main>
    <footer class="footer">
      <span>小用<span class="footer-dot">.</span> <i>日常与开发工具箱</i></span>
      <button @click="about?.showModal()">关于与隐私</button>
    </footer>
  </div>
  <ToolSearch ref="searchDialog" @choose="navigate('/tool/' + $event)" />
  <Transition name="toast"
    ><div v-if="toast" role="status" class="toast-message">
      <Icon name="Check" :size="17" />{{ toast }}
    </div></Transition
  >
  <dialog
    ref="about"
    class="about-dialog"
    @click="$event.target === about && about?.close()"
  >
    <div class="dialog-content">
      <button
        class="icon-button dialog-close"
        aria-label="关闭关于弹窗"
        @click="about?.close()"
      >
        <Icon name="X" /></button
      ><span class="brand-mark"
        ><Icon name="BriefcaseBusiness" :size="27"
      /></span>
      <h2>小用，让每件小事更简单。</h2>
      <p>一个面向日常使用与开发工作的轻量工具箱。无需账户，打开即用。</p>
      <div class="about-detail">
        <h3><Icon name="ShieldCheck" :size="18" /> 关于你的数据</h3>
        <p>
          文本、图片及生成结果都在浏览器内处理，不会由工具发送至服务器。浏览器仅保存主题偏好。
        </p>
        <p>
          网站加载需要获取静态资源，托管服务商可能记录常规访问日志。本站不添加广告或第三方统计脚本。
        </p>
      </div>
      <small>小用工具箱 · v1.0.0</small>
    </div>
  </dialog>
</template>
