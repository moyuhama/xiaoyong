# 小用 · 让每件小事更简单

面向日常与开发工作的中文工具箱。70 个工具全部在浏览器本地处理，无需账户、数据库或服务端 API。

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
- 二维码生成（PNG / SVG）、时间戳转换、HEX / RGB / HSL 转换
- 长度 / 重量 / 温度 / 面积 / 体积 / 数据容量换算、百分比计算、随机抽签
- 图片裁剪 / 旋转 / 镜像、单处与平铺文字水印
- 证件照制作：12 种常用规格 / 自定义像素、红白蓝与自定义换底、50%–500% 缩放（滑块、加减按钮、滚轮及键盘）、构图和亮度调整、JPG / PNG 导出（300 DPI）
- PDF 合并与排序、按页码范围提取与重排
- YAML / JSON 互转、JWT 解析、Cron 表达式解析、HTML 字符实体转义与还原
- 文本查找替换、名单与列表的交集 / 差集 / 并集
- 世界时钟与指定时刻对比、倒计时与秒表
- 图片拼接：横向 / 纵向长图、网格拼图、文件排序、间距和背景色
- 图片取色：点击或按原图坐标读取 HEX / RGBA，包含透明度
- ICO 图标制作：16 / 32 / 48 / 64 / 128 / 256 px 多尺寸打包，完整显示或居中裁剪
- 证件照打印排版：12 种照片规格 / 自定义毫米、6 寸相纸 / A4、份数 / 边距 / 间距，导出 300 DPI PNG / JPG 或物理尺寸 PDF
- 图片转 PDF：排序后每图一页，A4 纵向 / 横向与页边距
- PDF 添加页码：指定页面连续编号，跳过封面、起始编号、字号和页脚位置
- SQL 格式化：标准 SQL / MySQL / PostgreSQL / SQLite / SQL Server 方言、关键字大小写与缩进
- 汉字转拼音：声调 / 数字声调 / 无声调 / 首字母，姓氏模式与大小写
- 人民币大写：保留分位与大整数，支持负数及规范千位逗号
- 随机数生成：整数范围、批量不重复抽取、排序与分隔方式

- 图片文字识别：简体中文与英文印刷体，自动段落 / 零散文字，TXT 导出
- 二维码图片识别、CODE128 / CODE39 / EAN13 / EAN8 / UPC 条形码生成（PNG / SVG）
- 图片圆角与边框、灰度 / 复古滤镜、亮度 / 对比度 / 饱和度调整
- PDF 转 PNG / JPG（72 / 150 / 300 DPI、逐页或 ZIP 下载）、PDF 提取文字、PDF 指定页面旋转
- ZIP 打包与解压、文件 SHA 哈希校验、文件与 Base64 / Data URL 互转
- Word（DOCX）正文与表格文字提取、Excel（XLSX）多工作表预览与 CSV 导出
- 简繁体与台湾用词转换、大小写与驼峰 / 下划线等命名转换、摩斯电码、邮箱 / 链接 / IPv4 提取
- Unicode 编解码、ASCII 码表、XML 格式化与 JSON 转换、JavaScript / HTML / CSS 格式化
- JSON 转 TypeScript 类型、JSON 结构对比、JSON 路径查询
- 科学计算器（角度 / 弧度、三角函数、阶乘等）、工作日计算（自定义休息与补班日期）、数据统计（均值 / 中位数 / 方差等）

时间戳转换已前置到首页，保留原有 `#/tool/datetime` 链接：实时秒 / 毫秒显示、暂停 / 继续、单独复制、双向转换、自动识别单位、北京时间 / UTC / 其他常用时区、批量转换、日期差以及 JavaScript / Python / Java / Go 示例代码。功能方向参考 [Tool.lu 时间戳工具](https://tool.lu/timestamp/)，沿用小用的界面设计。

支持分类搜索、深色模式、手机布局与键盘搜索（Ctrl / Command + K）。

时间戳功能页按 [Tool.lu 时间戳页面](https://tool.lu/timestamp/)的操作结构整理：顶部集中显示当前数值并切换秒 / 毫秒；两组转换表单纵向排列，各自选择时区，结果可直接复制；保留批量转换、日期差与代码示例。

JSON 功能页提供格式化校验、压缩、转义、去除转义，以及 YAML / TypeScript 转换。输入支持打开文件、语法高亮、撤销、重做与 JSON 修复；结果可切换树形 / 文本视图、展开折叠、搜索、复制和下载。编辑及树形查看采用 [JSONEditor](https://github.com/josdejong/jsoneditor)（Apache-2.0），其代码按需加载到 JSON 页面。

前期调研参考 [IT-Tools](https://github.com/CorentinTh/it-tools) 与 [OmniTools](https://github.com/iib0011/omni-tools) 的工具分类。本轮参考 [懒人工具](https://www.lanren-tools.com/) 的图片与 PDF 目录，以及 Tool.lu 的[图片拼图](https://tool.lu/collage/)、[证件照排版](https://tool.lu/imageprint/)、[图片转 PDF](https://tool.lu/image2pdf/)、[SQL](https://tool.lu/sql/)、[ICO](https://tool.lu/favicon/)和[拼音](https://tool.lu/py5bconvert/)工具；通过 [67 工具的数字类页面公开索引](https://www.67tool.com/number/hex-to-binary)核对随机数、金额大写需求（其首页限制自动访问）。参考功能方向，按小用现有界面独立实现，不复制这些网站的页面、品牌或源码。

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
- 时间戳自动模式将不超过 10 位的整数识别为秒、13 位识别为毫秒，其他位数须手动指定。日期严格校验，支持毫秒、Z 和 ±HH:mm 偏移；无偏移时按所选 IANA 时区解析。夏令时跳时与回拨歧义明确报错，可填写偏移消除歧义。支持 0001–9999 年、零与负时间戳；秒输出向下取整。批量最多 1,000 行 / 100,000 字符，逐行报告错误。实时钟使用设备时间，每秒刷新，暂停后填入与复制均取已固定的数值。
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
- 新增批量图片工具一次最多 12 张、合计 50 MB，每张最多 20 MB / 3200 万像素；处理副本最长边缩小到 2048 px。拼接输出最长边 8192 px、总计 1600 万像素。取色读取原图解码像素，不执行此缩小。动画仅处理第一帧。
- 打印排版按 300 DPI 生成，完整显示照片，比例不符时留白；默认 6 寸横向相纸可排 10 张一寸照。PDF 使用实际毫米尺寸，打印需关闭适应页面并选择实际大小。一次最多排 100 张。
- PDF 页码按原页序在选中页面连续添加，保留未选中页面，支持 90 / 180 / 270 度旋转和裁剪框。页码基线距可见页底 24 pt，可能覆盖原有页脚，下载后请核对。
- SQL 与拼音在可中止的 Worker 中执行，10 秒超时，输入分别最多 50,000 / 10,000 字符。SQL 只整理排版，不验证数据库是否能执行；拼音多音字按词语匹配，姓名及生僻字请核对。使用 [sql-formatter](https://github.com/sql-formatter-org/sql-formatter) 15.9.0 和 [pinyin-pro](https://pinyin-pro.cn/) 3.29.5（均 MIT），随构建提供，无外部 API。
- 人民币大写使用十进制文本分组，整数最多 16 位、小数最多 2 位，不经浮点转换或自动四舍五入。随机数范围 -10 亿至 10 亿，每次最多 1000 个，使用 Web Crypto 拒绝采样及无放回抽样。

- OCR 使用 Tesseract.js 7.0.0 与中文、英文语言文件，识别运行在 Worker 内；120 秒超时，处理最长边 3000 px。模型、运行时和语言文件由构建脚本复制至同源静态资源目录，首次使用按需加载，无外部识别 API。识别适合清晰印刷体，手写、竖排和复杂表格需要人工核对。
- PDF 渲染使用 PDF.js 6.4.299，字体、字符映射与 WASM 随站点提供。单文件最多 20 MB / 500 页；一次最多导出 20 页图片（总计 50 MB、单图 1600 万像素）或 100 页文字。文字提取依赖 PDF 的文本层，扫描件需先转图片再 OCR；不支持加密 PDF。
- ZIP 支持存储 / Deflate，输入 20 MB、200 条目、展开 50 MB，检查路径、重复名与 CRC。打包最多 100 个文件、50 MB；不支持 ZIP64、分卷、加密、RAR 或 7z。Office 文档解包也应用同样的大小限制。
- Word 只提取 DOCX 文字，不保留图片与排版；Excel 只处理 XLSX，最多 50 张表、每张 10,000 行 / 500 列、合计 200,000 单元格，使用已保存的公式结果，不重新计算，预览前 30 行与 12 列。导出 CSV 默认防止字符串被识别成公式，日期输出 ISO。
- 新增文本工具在可取消 Worker 内运行，10 秒超时，通常最多 200,000 字符，代码格式化最多 100,000。XML 禁止 DTD / 实体声明，属性使用 `@_`、文本使用 `#text`；JSON 查询只支持属性、数组下标及通配符，不执行脚本或过滤表达式。JSON 数字仍受 JavaScript 精度约束。
- 工作日默认周一至周五，可自行填写休息和补班日期；不内置各地区法定节假日。科学计算器解析限定表达式，不执行 JavaScript；结果受浮点精度限制。统计最多 10,000 个数值，分别给出总体和样本方差。
- 新增依赖包括 Tesseract.js / PDF.js（Apache-2.0）、jsQR（Apache-2.0）、OpenCC-JS（MIT 与 Apache-2.0）、Mammoth（BSD-2-Clause）、JsBarcode / fflate / read-excel-file / Prettier / fast-xml-parser（MIT）。静态 OCR 与 PDF 资源附带上游 LICENSE / NOTICE，详情见 scripts/prepare-utilities.mjs。

## 扩展结构

- src/components/TimestampTool.vue、src/lib/timestamp.ts：时间戳、严格日期解析与时区转换
- src/lib/popular-tools.ts：新增 27 个工具的元数据
- src/lib/popular-text.ts、file-utilities.ts、math-tools.ts：文本、文件和计算逻辑
- scripts/prepare-utilities.mjs：准备同源 OCR 模型与 PDF 渲染资源
- src/lib/tools.ts：工具名称、分类、关键词与图标登记
- src/components/*Tools.vue、*Extras.vue：工具界面，按模块加载
- src/lib/transform.ts：可独立验证的文本、编码、颜色、时间与随机函数
- src/lib/data-tools.ts、calculations.ts：CSV、进制、哈希、URL、抽签与数值换算
- src/workers/regex.ts：可中断的正则执行器
- src/workers/markdown.ts、config.ts、cron.ts、pdf.ts：可中断的文档、配置、规则和 PDF 处理
- src/style.css、extra-tools.css、expanded-tools.css：响应式界面和主题
