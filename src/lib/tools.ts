export type Category = "text" | "image" | "dev" | "daily";
export interface Tool {
  id: string;
  name: string;
  description: string;
  category: Category;
  icon: string;
  color: string;
  keywords: string;
  badge?: string;
}
export const categories = [
  { id: "all", name: "全部工具", icon: "LayoutGrid" },
  { id: "text", name: "文本处理", icon: "Type" },
  { id: "image", name: "图片工具", icon: "Image" },
  { id: "dev", name: "开发工具", icon: "CodeXml" },
  { id: "daily", name: "生活常用", icon: "Shapes" },
];
export const tools: Tool[] = [
  {
    id: "json",
    name: "JSON 格式化",
    description: "整理杂乱的 JSON，格式化、压缩与校验。",
    category: "dev",
    icon: "Braces",
    color: "green",
    keywords: "json 格式化 格式 校验 压缩 美化",
    badge: "常用",
  },
  {
    id: "image-compress",
    name: "图片压缩",
    description: "让图片轻一点，让清晰多一点。",
    category: "image",
    icon: "ImageDown",
    color: "orange",
    keywords: "图片 压缩照片 压缩图片 缩小 图片压缩 jpg jpeg png webp",
    badge: "常用",
  },
  {
    id: "qrcode",
    name: "二维码生成",
    description: "把链接或文字，变成一张二维码。",
    category: "daily",
    icon: "QrCode",
    color: "purple",
    keywords: "二维码 qr qrcode 链接 网址",
    badge: "常用",
  },
  {
    id: "text-clean",
    name: "文本统计与清理",
    description: "数字数、去空白，文字整理一步到位。",
    category: "text",
    icon: "Type",
    color: "blue",
    keywords: "字数 统计 文本 空白 空行 大小写 清理",
  },
  {
    id: "text-lines",
    name: "去重与排序",
    description: "去掉重复行，给你的列表排个序。",
    category: "text",
    icon: "ListFilter",
    color: "purple",
    keywords: "去重 重复 排序 文本 列表 行",
  },
  {
    id: "text-diff",
    name: "文本差异对比",
    description: "并排放两段文字，找出每一处不同。",
    category: "text",
    icon: "GitCompareArrows",
    color: "orange",
    keywords: "文本 比较 对比 差异 diff",
  },
  {
    id: "encoding",
    name: "编码与解码",
    description: "轻松转换 Base64 与 URL 编码。",
    category: "dev",
    icon: "Binary",
    color: "blue",
    keywords: "base64 url 编码 解码 转码 中文",
  },
  {
    id: "regex",
    name: "正则表达式测试",
    description: "验证你的匹配规则，快速找到结果。",
    category: "dev",
    icon: "Regex",
    color: "green",
    keywords: "正则 表达式 regex 匹配 测试",
  },
  {
    id: "generator",
    name: "UUID 与密码生成",
    description: "生成随机标识和符合规则的密码。",
    category: "dev",
    icon: "Fingerprint",
    color: "purple",
    keywords: "uuid 密码 随机 安全 生成 id",
  },
  {
    id: "image-convert",
    name: "图片尺寸与格式",
    description: "调整大小，转换成你需要的图片格式。",
    category: "image",
    icon: "ScanLine",
    color: "green",
    keywords: "图片 格式 转换 尺寸 缩放 png jpeg jpg webp",
  },
  {
    id: "datetime",
    name: "日期与时间戳",
    description: "时间戳互转，算算两个日期相差多久。",
    category: "daily",
    icon: "CalendarClock",
    color: "blue",
    keywords: "时间戳 日期 时间 timestamp unix 天数 时区",
  },
  {
    id: "color",
    name: "颜色格式转换",
    description: "在 HEX、RGB 和 HSL 之间自由切换。",
    category: "daily",
    icon: "Palette",
    color: "orange",
    keywords: "颜色 色值 取色 hex rgb hsl 调色",
  },
];
export function searchTools(query: string, source = tools) {
  const words = query.toLowerCase().trim().split(/\s+/).filter(Boolean);
  return source.filter((tool) =>
    words.every((word) =>
      (tool.name + " " + tool.description + " " + tool.keywords)
        .toLowerCase()
        .includes(word),
    ),
  );
}
