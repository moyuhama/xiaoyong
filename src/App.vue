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
import { readSetting, writeSetting, toast, notify } from "./lib/ui";

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
const favoriteData = readSetting<unknown>("favorites", []);
const recentData = readSetting<unknown>("recent", []);
const favorites = ref<string[]>(
  Array.isArray(favoriteData)
    ? favoriteData.filter((id) => tools.some((tool) => tool.id === id))
    : [],
);
const recent = ref<string[]>(
  Array.isArray(recentData)
    ? recentData.filter((id) => tools.some((tool) => tool.id === id))
    : [],
);
const theme = ref(document.documentElement.dataset.theme || "light");
const currentTool = computed(() =>
  route.value.startsWith("/tool/")
    ? tools.find((tool) => tool.id === route.value.split("/")[2])
    : undefined,
);
const view = computed(() =>
  route.value === "/favorites"
    ? "favorites"
    : route.value === "/recent"
      ? "recent"
      : route.value.startsWith("/category/")
        ? route.value.split("/")[2]
        : "all",
);
const isToolRoute = computed(() => route.value.startsWith("/tool/"));
const categoryName = computed(
  () =>
    categories.find((c) => c.id === currentTool.value?.category)?.name || "",
);
const title = computed(() =>
  view.value === "favorites"
    ? "我的收藏"
    : view.value === "recent"
      ? "最近使用"
      : categories.find((c) => c.id === view.value)?.name || "全部工具",
);
const filtered = computed(() => {
  let source = tools;
  if (view.value === "favorites")
    source = tools.filter((t) => favorites.value.includes(t.id));
  else if (view.value === "recent")
    source = recent.value
      .map((id) => tools.find((t) => t.id === id)!)
      .filter(Boolean);
  else if (view.value !== "all")
    source = tools.filter((t) => t.category === view.value);
  return searchTools(query.value, source);
});
const toolComponent = computed(() => {
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
function toggleFavorite(id: string) {
  favorites.value = favorites.value.includes(id)
    ? favorites.value.filter((item) => item !== id)
    : [...favorites.value, id];
  writeSetting("favorites", favorites.value);
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
    if (tool) {
      recent.value = [
        tool.id,
        ...recent.value.filter((id) => id !== tool.id),
      ].slice(0, 12);
      writeSetting("recent", recent.value);
    }
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
    <div class="nav-section-label personal-label">
      我的空间 <span>PERSONAL</span>
    </div>
    <nav aria-label="我的空间" class="main-nav">
      <a
        href="#/favorites"
        :class="{ active: view === 'favorites' }"
        @click.prevent="navigate('/favorites')"
        ><Icon name="Star" :size="19" /><span>我的收藏</span
        ><small v-if="favorites.length">{{ favorites.length }}</small></a
      >
      <a
        href="#/recent"
        :class="{ active: view === 'recent' }"
        @click.prevent="navigate('/recent')"
        ><Icon name="Clock3" :size="19" /><span>最近使用</span></a
      >
    </nav>
    <div class="sidebar-bottom">
      <div class="privacy-note">
        <span class="privacy-symbol"
          ><Icon name="ShieldCheck" :size="21" /></span
        ><strong>你的数据，只属于你</strong>
        <p>工具在浏览器本地运行<br />输入内容无需上传服务器</p>
        <span class="tiny-dots">本地处理 <i></i> 即开即用</span>
      </div>
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
        <span class="local-badge"><i></i> 本地运行 · 安心使用</span
        ><span class="top-divider"></span
        ><button
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
            <div class="hero-features">
              <span
                ><Icon name="Check" :size="14" />
                {{ tools.length }} 款精选工具</span
              ><span><Icon name="LockKeyhole" :size="13" /> 隐私优先</span
              ><span><Icon name="Heart" :size="13" /> 免费使用</span>
            </div>
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
          <p>
            {{
              view === "favorites"
                ? "把顺手的工具收好，下次更快找到。"
                : view === "recent"
                  ? "接着上次的事情，继续高效一点。"
                  : "少一点繁琐，多一点得心应手。"
            }}
          </p>
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
          ><button
            v-if="view === 'recent' && recent.length"
            class="text-button"
            @click="
              recent = [];
              writeSetting('recent', []);
              notify('已清空最近使用');
            "
          >
            清空记录
          </button>
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
            <button
              class="favorite-button"
              :class="{ saved: favorites.includes(tool.id) }"
              :aria-label="
                (favorites.includes(tool.id) ? '取消收藏' : '收藏') + tool.name
              "
              :aria-pressed="favorites.includes(tool.id)"
              @click="toggleFavorite(tool.id)"
            >
              <Icon name="Star" :size="17" />
            </button>
          </article>
        </div>
        <div v-else class="empty-state">
          <span class="empty-icon"
            ><Icon
              :name="
                view === 'favorites'
                  ? 'Star'
                  : view === 'recent'
                    ? 'Clock3'
                    : 'Search'
              "
              :size="34"
          /></span>
          <h3>
            {{
              query
                ? "暂时没有找到这个工具"
                : view === "favorites"
                  ? "把喜欢的工具留在这里"
                  : "还没有使用记录"
            }}
          </h3>
          <p>
            {{
              query
                ? "试试更短的关键词，如「图片」「文本」或「JSON」。"
                : view === "favorites"
                  ? "点击工具卡片右上角的星标，就能随时找到它。"
                  : "打开任意工具后，它就会出现在这里。"
            }}
          </p>
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
          <button
            class="button secondary tool-save"
            :class="{ 'is-saved': favorites.includes(currentTool.id) }"
            @click="toggleFavorite(currentTool.id)"
          >
            <Icon name="Star" :size="17" />{{
              favorites.includes(currentTool.id) ? "已收藏" : "收藏工具"
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
        <div class="tool-privacy">
          <Icon name="ShieldCheck" :size="16" /><span
            >所有处理均在你的浏览器内完成，输入内容不会上传。离开工具页面后，输入内容将被清空。</span
          >
        </div>
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
      <div>
        <span><i class="status-dot"></i>全部工具本地运行</span
        ><button @click="about?.showModal()">关于与隐私</button>
      </div>
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
          文本、图片及生成结果都在浏览器内处理，不会由工具发送至服务器。收藏、最近使用的工具名称和主题偏好保存在当前浏览器，不跨设备同步。
        </p>
        <p>
          网站加载需要获取静态资源，托管服务商可能记录常规访问日志。本站不添加广告或第三方统计脚本。
        </p>
      </div>
      <button
        class="button secondary"
        @click="
          favorites = [];
          recent = [];
          writeSetting('favorites', []);
          writeSetting('recent', []);
          notify('已清空收藏与最近使用');
          about?.close();
        "
      >
        <Icon name="Trash2" :size="16" />清空收藏与使用记录</button
      ><small>小用工具箱 · v1.0.0</small>
    </div>
  </dialog>
</template>
