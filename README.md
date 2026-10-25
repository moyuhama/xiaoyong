# 小用 · 让每件小事更简单

面向日常与开发工作的中文工具箱。33 个工具全部在浏览器本地处理，无需账户、数据库或服务端 API。

[在线使用](https://moyuhama.github.io/xiaoyong/) · [GitHub 仓库](https://github.com/moyuhama/xiaoyong)

## 开发

需要 Node.js 22.12+ 或 24 LTS。

    npm ci
    npm run dev

验证与构建：

    npm test
    npm run build
    npm run preview

## 工具

- 文本统计与清理、逐行去重排序、文本差异对比、Markdown 预览与导出
- 图片压缩、图片尺寸与格式转换（JPG / PNG / WebP）
- JSON 格式化校验 / 压缩 / 转义 / 去除转义、Base64 / URL 编解码、正则测试、UUID / 密码生成
- CSV / JSON 互转、SHA-256 / SHA-384 / SHA-512 哈希、2–36 进制整数转换、URL 结构与查询参数解析
- 二维码生成（PNG / SVG）、日期与时间戳换算、HEX / RGB / HSL 转换
- 长度 / 重量 / 温度 / 面积 / 体积 / 数据容量换算、百分比计算、随机抽签
- 图片裁剪 / 旋转 / 镜像、单处与平铺文字水印
- 证件照制作：12 种常用规格 / 自定义像素、红白蓝与自定义换底、50%–500% 缩放（滑块、加减按钮、滚轮及键盘）、构图和亮度调整、JPG / PNG 导出（300 DPI）
- PDF 合并与排序、按页码范围提取与重排
- YAML / JSON 互转、JWT 解析、Cron 表达式解析、HTML 字符实体转义与还原
- 文本查找替换、名单与列表的交集 / 差集 / 并集
- 世界时钟与指定时刻对比、倒计时与秒表

支持分类搜索、深色模式、手机布局与键盘搜索（Ctrl / Command + K）。

本轮调研参考 [IT-Tools](https://github.com/CorentinTh/it-tools) 的开发辅助工具分类，以及 [OmniTools](https://github.com/iib0011/omni-tools) 的图片、文档、文本功能覆盖。优先补齐日常图片编辑、PDF 整理和配置调试，保留浏览器静态部署方式；没有复制这两个项目的实现。

## GitHub Pages 部署

1. 将源码推送到 GitHub 仓库的 main 分支。
2. 仓库 Settings → Pages → Build and deployment → Source 选择 GitHub Actions。
3. 推送后 .github/workflows/deploy.yml 自动执行安装、测试、构建和部署。
4. 项目站点地址为 https://<用户名>.github.io/<仓库名>/。

默认工作流适用于项目子路径。若改用根站点或绑定独立域名，将工作流的 BASE_PATH 改为 /。本地验证子路径可运行：

    BASE_PATH=/xiaoyong/ npm run build
    BASE_PATH=/xiaoyong/ npm run preview

使用 Hash 路由，工具链接刷新无需服务端回退规则。此方式适合工具应用，但不利于每个工具的独立搜索引擎收录。

## 数据与边界

- 文本和图片不上传，页面切换后输入不保留。
- localStorage 仅用于保存主题偏好，不记录工具使用历史。
- 不加载第三方字体、统计或广告脚本。托管服务商可能记录常规访问日志。
- 图片限制 20 MB、3,200 万像素；输出尺寸每边不超过 16,384。只承诺静态图片，重新编码不保留 EXIF。JPG 透明背景填白；PNG 无质量调节；压缩后体积可能增加。
- 正则在专用 Worker 内执行，2 秒超时，最多 1,000 个匹配。
- 文本差异对比合计最多 20,000 字符，计算超过 1.5 秒中止。
- JSON 格式化与压缩使用标准 JavaScript 解析；大整数应当写成字符串。转义将输入作为原始文本处理，默认不带外层双引号，可选生成完整 JSON 字符串；去除转义兼容带或不带外层引号，每次只还原一层，保留字符串内部原本需要的反斜杠。最多 2,000,000 字符，结果可继续用作输入。
- 密码使用 Web Crypto 随机数，确保包含所有选择的字符类型。
- 日期差按 UTC 日历日期计算，以免夏令时导致天数偏差。
- Markdown 使用 Worker 解析（2 秒超时、最多 100,000 字符），原始 HTML 作为文本显示，预览与 HTML 导出均经过 DOMPurify 清理；不加载图片或启用链接跳转。
- CSV 第一行为表头，转 JSON 时所有值保留为字符串；支持逗号、分号、制表符、引号与多行字段。最多 2,000,000 字符、10,000 行、1,000 列、200,000 个单元格。JSON 转 CSV 默认对可能被表格识别为公式的文本加单引号，可关闭该选项进行原样转换。
- 进制转换使用 BigInt，最多 4,096 位，支持负数与匹配进制的前缀，不支持小数。
- 单位与百分比结果最多显示 12 位有效数字；变化率要求原值大于 0。数据容量区分十进制 KB 与二进制 KiB，重量使用市斤。
- 抽签去除空白与重复项，使用 Web Crypto 随机数无放回抽样；重新抽取时重置候选池。
- PDF 在 Worker 内处理，最多 20 个文件、合计 50 MB / 500 页，30 秒超时。不支持加密文件与交互表单；只保留页面内容，不保留书签、附件和文档级设置。页面提取按输入顺序排列，重复页码只保留一次。
- YAML 使用 1.2 规范，最多 200,000 字符，Worker 3 秒超时。拒绝重复键、循环别名、非字符串键、非有限数和不能被 JSON 安全表示的大整数；大整数请写成字符串。
- JWT 仅解码 Header、Payload 与时间字段，不验证签名，不能用作登录或可信度判断。
- Cron 支持标准 5 段数字语法及 `* / , -`，按指定时区计算起点之后的 5 次执行时间；日期和星期同时限制时使用“或”规则。这里只解析规则，不执行任务。
- 查找替换按原文匹配，替换内容中的美元符保持原样；输入最多 200,000 字符，结果最多 2,000,000 字符。名单对比去掉空白行和重复项，保留首次出现的拼写与顺序。
- 世界时钟使用 IANA 时区并按所选日期应用夏令时。倒计时最长 24 小时，以目标时刻校准；秒表使用单调时钟，支持暂停和分段记录。离开工具页会结束计时，页面关闭后不提醒。
- 证件照输出每边 100–2000 px，源图处理时最长边缩小到 2048 px。采用 MediaPipe Selfie Segmentation 做人像换底，适合单人正面近照；复杂背景、发丝或衣服边缘可能需要调整，不进行证件合规检测。照片在浏览器内处理，模型在首次换底时加载；失败后可保留原背景继续裁剪。
- 证件照预设均按宽 × 高（mm）以 300 DPI 换算像素：22×32、25×35、33×48、35×45、35×49、35×53、26×32、30×40、35×50、40×50、50×70、51×51。寸照名称可能因地区而异，以具体尺寸为准；预设只设置画布尺寸，不代表满足某个证件的全部要求。尺寸参考包括[常用寸照规格](https://www.idphoto.cn/)、[香港入境事务处](https://www.immd.gov.hk/eng/residents/immigration/traveldoc/photorequirements.html)、[加拿大护照照片要求](https://www.canada.ca/en/immigration-refugees-citizenship/services/canadian-passports/photos.html)。缩放 100% 表示铺满画布；小于 100% 时空余区域填充所选底色（原背景模式使用白色）。
- 人像模型与 WebAssembly 运行时随网站提供（Apache-2.0，见 public/models/NOTICE.txt）；npm 的 predev / prebuild / prepreview 会从锁定的 @mediapipe/tasks-vision 1.1.1 复制所需运行时到忽略目录 public/vendor/mediapipe/。不依赖外部 CDN，详情见 [MediaPipe 官方说明](https://developers.google.com/edge/mediapipe/solutions/vision/image_segmenter)。

## 扩展结构

- src/lib/tools.ts：工具名称、分类、关键词与图标登记
- src/components/*Tools.vue、*Extras.vue：工具界面，按模块加载
- src/lib/transform.ts：可独立验证的文本、编码、颜色、时间与随机函数
- src/lib/data-tools.ts、calculations.ts：CSV、进制、哈希、URL、抽签与数值换算
- src/workers/regex.ts：可中断的正则执行器
- src/workers/markdown.ts、config.ts、cron.ts、pdf.ts：可中断的文档、配置、规则和 PDF 处理
- src/style.css、extra-tools.css、expanded-tools.css：响应式界面和主题
