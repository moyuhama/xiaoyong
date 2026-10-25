<script setup lang="ts">
import {
  computed,
  defineAsyncComponent,
  nextTick,
  onMounted,
  onUnmounted,
  ref,
  watch,
} from "vue";
import Icon from "./components/Icon.vue";
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
  window.scrollTo({ top: 0 });
}
function toggleTheme() {
  theme.value = theme.value === "light" ? "dark" : "light";
  document.documentElement.dataset.theme = theme.value;
  try {
    localStorage.setItem("xiaoyong-theme", theme.value);
  } catch {}
}
async function focusSearch() {
  if (isToolRoute.value) {
    navigate("/");
    handleRoute();
  }
  await nextTick();
  searchInput.value?.focus();
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
    !about.value?.open
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
    <a href="#/" class="brand" @click.prevent="navigate('/')">
      <span class="brand-mark"
        ><Icon name="BriefcaseBusiness" :size="25"
      /></span>
      <span
        ><strong>小用<span class="brand-dot">.</span></strong
        ><small>让每件小事更简单</small></span
      >
    </a>
    <div class="nav-section-label">工作台 <span>WORKSPACE</span></div>
    <nav aria-label="工具分类" class="main-nav">
      <a
        v-for="category in categories"
        :key="category.id"
        :href="category.id === 'all' ? '#/' : '#/category/' + category.id"
        :class="{ active: !isToolRoute && view === category.id }"
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
    <div class="sidebar-bottom">
      <button class="sidebar-about" @click="about?.showModal()">
        <Icon name="CircleHelp" :size="17" />关于小用<span>v1.0</span>
      </button>
    </div>
  </aside>

  <div class="main-shell">
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
    <main id="main-content" tabindex="-1">
      <template v-if="!isToolRoute">
        <section v-if="view === 'all'" class="hero">
          <div class="hero-copy">
            <span class="eyebrow"><span></span> 小工具，大帮手</span>
            <h1>
              把小事，<span>轻松搞定。</span
              ><svg viewBox="0 0 220 12" aria-hidden="true">
                <path d="M3 8 Q110 -1 216 6" />
              </svg>
            </h1>
            <p>
              从日常琐事到开发细节，顺手的工具都在这里。<br
                class="hero-break"
              />无需安装，即开即用，把时间留给更重要的事。
            </p>
          </div>
          <div class="hero-art" aria-hidden="true">
            <div class="art-orbit orbit-one"></div>
            <div class="art-orbit orbit-two"></div>
            <span class="art-spark spark-one">✳</span
            ><span class="art-dot"></span>
            <div class="art-tile art-code">
              <span>{ }</span><small>make it simple</small>
            </div>
            <div class="art-tile art-text">
              <span>Aa<span>.</span></span>
              <div class="art-lines"><i></i><i></i></div>
            </div>
            <div class="art-tile art-image">
              <Icon name="Image" :size="40" :stroke-width="1.4" /><span
                class="image-sun"
              ></span>
            </div>
            <div class="art-tile art-color"><i></i><i></i><i></i></div>
            <span class="art-spark spark-two">✧</span>
          </div>
        </section>
        <section v-else class="collection-heading">
          <span class="eyebrow">你的效率工作台</span>
          <h1>{{ title }}</h1>
          <p>少一点繁琐，多一点得心应手。</p>
        </section>
        <div class="search-box">
          <Icon name="Search" :size="21" /><input
            ref="searchInput"
            v-model="query"
            type="search"
            aria-label="搜索工具"
            placeholder="搜索你需要的工具，比如「图片压缩」"
          /><button
            v-if="query"
            class="icon-button"
            aria-label="清空搜索"
            @click="query = ''"
          >
            <Icon name="X" :size="17" /></button
          ><kbd v-else>⌘ K</kbd>
        </div>
        <div class="catalog-toolbar">
          <div class="category-tabs" aria-label="筛选分类">
            <button
              v-for="category in categories"
              :key="category.id"
              :class="{ selected: view === category.id }"
              @click="
                navigate(
                  category.id === 'all' ? '/' : '/category/' + category.id,
                )
              "
            >
              {{ category.name }}
            </button>
          </div>
          <span class="catalog-count">{{ filtered.length }} 个工具</span>
        </div>
        <div class="section-title">
          <h2>
            {{ query ? "搜索结果" : title
            }}<span v-if="view === 'all' && !query"
              >为每一个小需求，找到好帮手</span
            >
          </h2>
          <span v-if="view === 'all' && !query" class="section-hint"
            ><Icon name="Sparkles" :size="14" /> 持续打磨中</span
          >
        </div>
        <div v-if="filtered.length" class="tool-grid">
          <article
            v-for="(tool, index) in filtered"
            :key="tool.id"
            class="tool-card"
            :style="{ '--card-delay': Math.min(index, 5) * 35 + 'ms' }"
          >
            <a
              class="tool-card-link"
              :href="'#/tool/' + tool.id"
              @click.prevent="navigate('/tool/' + tool.id)"
              ><span class="tool-icon" :class="tool.color"
                ><Icon :name="tool.icon" :size="25"
              /></span>
              <h3>
                {{ tool.name
                }}<span v-if="tool.badge" class="tool-badge">{{
                  tool.badge
                }}</span>
              </h3>
              <p>{{ tool.description }}</p>
              <div class="card-bottom">
                <span>{{
                  categories.find((c) => c.id === tool.category)?.name
                }}</span
                ><Icon name="ArrowUpRight" :size="17" /></div
            ></a>
          </article>
        </div>
        <div v-else class="empty-state">
          <span class="empty-icon"><Icon name="Search" :size="34" /></span>
          <h3>暂时没有找到这个工具</h3>
          <p>试试更短的关键词，如「图片」「文本」或「JSON」。</p>
          <button class="button secondary" @click="navigate('/')">
            浏览全部工具<Icon name="ArrowRight" :size="16" />
          </button>
        </div>
        <div class="bottom-note">
          <span><Icon name="Leaf" :size="15" /> 简单一点，高效一点。</span>
          <p>工具会持续更新，陪你把每件小事做好。</p>
        </div>
      </template>
      <template v-else-if="currentTool">
        <button class="back-button" @click="navigate('/')">
          <Icon name="ArrowLeft" :size="17" />返回工具箱
        </button>
        <div class="tool-heading">
          <span class="tool-icon large" :class="currentTool.color"
            ><Icon :name="currentTool.icon" :size="30"
          /></span>
          <div>
            <span class="eyebrow">{{ categoryName }}</span>
            <h1>{{ currentTool.name }}</h1>
            <p>{{ currentTool.description }}</p>
          </div>
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
        <p class="tool-note">离开工具页面后，输入内容将被清空。</p>
        <section class="related-section">
          <h2>也许你还用得上</h2>
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
      <span
        >小用<span class="footer-dot">.</span> <i>用心做好每一个小工具</i></span
      >
      <button @click="about?.showModal()">关于与隐私</button>
    </footer>
  </div>
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
