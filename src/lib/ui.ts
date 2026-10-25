import { ref } from "vue";
export const toast = ref("");
let toastTimer: ReturnType<typeof setTimeout>;
export function notify(message: string) {
  toast.value = message;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    toast.value = "";
  }, 2600);
}
export async function copy(value: string) {
  if (!value) return notify("还没有可以复制的内容");
  try {
    await navigator.clipboard.writeText(value);
    notify("已复制到剪贴板");
  } catch {
    notify("复制失败，请选中内容后手动复制");
  }
}
export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export function downloadText(text: string, filename: string) {
  if (!text) return notify("还没有可以下载的内容");
  downloadBlob(
    new Blob([text], { type: "text/plain;charset=utf-8" }),
    filename,
  );
}
export function readSetting<T>(key: string, fallback: T): T {
  try {
    const value = localStorage.getItem("xiaoyong-" + key);
    return value ? JSON.parse(value) : fallback;
  } catch {
    return fallback;
  }
}
export function writeSetting(key: string, value: unknown) {
  try {
    localStorage.setItem("xiaoyong-" + key, JSON.stringify(value));
  } catch {
    notify("浏览器未允许保存设置，本次仍可正常使用");
  }
}
export function formatBytes(bytes: number) {
  if (bytes < 1024) return bytes + " B";
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
  return (bytes / 1024 / 1024).toFixed(2) + " MB";
}
