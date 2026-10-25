# 小用 · 让每件小事更简单

面向日常与开发工作的中文工具箱。12 个工具全部在浏览器本地处理，无需账户、数据库或服务端 API。

## 开发

需要 Node.js 22.12+ 或 24 LTS。

    npm ci
    npm run dev

验证与构建：

    npm test
    npm run build
    npm run preview

## 工具

- 文本统计与清理、逐行去重排序、文本差异对比
- 图片压缩、图片尺寸与格式转换（JPG / PNG / WebP）
- JSON 格式化校验、Base64 / URL 编解码、正则测试、UUID / 密码生成
- 二维码生成（PNG / SVG）、日期与时间戳换算、HEX / RGB / HSL 转换

支持分类搜索、收藏、最近使用、深色模式、手机布局与键盘搜索（Ctrl / Command + K）。

## GitHub Pages 部署

1. 将源码推送到 GitHub 仓库的 main 分支。
2. 仓库 Settings → Pages → Build and deployment → Source 选择 GitHub Actions。
3. 推送后 .github/workflows/deploy.yml 自动执行安装、测试、构建和部署。
4. 项目站点地址为 https://<用户名>.github.io/<仓库名>/。

默认工作流适用于项目子路径。若改用根站点或绑定独立域名，将工作流的 BASE_PATH 改为 /。本地验证子路径可运行：

    BASE_PATH=/gongjuxiang/ npm run build
    BASE_PATH=/gongjuxiang/ npm run preview

使用 Hash 路由，工具链接刷新无需服务端回退规则。此方式适合工具应用，但不利于每个工具的独立搜索引擎收录。

## 数据与边界

- 文本和图片不上传，页面切换后输入不保留。
- localStorage 仅保存工具收藏、最近打开的工具 ID 和主题；可以在「关于与隐私」中清空收藏与记录。
- 不加载第三方字体、统计或广告脚本。托管服务商可能记录常规访问日志。
- 图片限制 20 MB、3,200 万像素；输出尺寸每边不超过 16,384。只承诺静态图片，重新编码不保留 EXIF。JPG 透明背景填白；PNG 无质量调节；压缩后体积可能增加。
- 正则在专用 Worker 内执行，2 秒超时，最多 1,000 个匹配。
- 文本差异对比合计最多 20,000 字符，计算超过 1.5 秒中止。
- JSON 使用标准 JavaScript 解析；大整数应当写成字符串。
- 密码使用 Web Crypto 随机数，确保包含所有选择的字符类型。
- 日期差按 UTC 日历日期计算，以免夏令时导致天数偏差。

## 扩展结构

- src/lib/tools.ts：工具名称、分类、关键词与图标登记
- src/components/*Tools.vue：四类工具界面，按需加载
- src/lib/transform.ts：可独立验证的文本、编码、颜色、时间与随机函数
- src/workers/regex.ts：可中断的正则执行器
- src/style.css：响应式界面和主题
