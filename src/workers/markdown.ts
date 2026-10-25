import { Marked } from "marked";
function escapeHtml(text: string) {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;");
}
const marked = new Marked({
  renderer: {
    html: ({ text }) => escapeHtml(text),
    image: ({ text }) => "[图片：" + escapeHtml(text || "无描述") + "]",
  },
});
self.onmessage = (event: MessageEvent<string>) => {
  try {
    self.postMessage({
      html: marked.parse(event.data, { async: false, gfm: true }),
    });
  } catch {
    self.postMessage({ error: "无法解析这段 Markdown，请检查内容后重试" });
  }
};
