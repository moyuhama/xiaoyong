import { onMounted, onUnmounted } from "vue";

export function useImagePaste(
  load: (file: File) => void,
  enabled: () => boolean,
) {
  function paste(event: ClipboardEvent) {
    const target = event.target;
    if (!enabled() || document.querySelector("dialog[open]")) return;
    // Keep normal text editing and explicit clipboard actions untouched.
    if (
      target instanceof HTMLElement &&
      (target.isContentEditable ||
        /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName))
    )
      return;
    const file = Array.from(event.clipboardData?.files || []).find((file) =>
      file.type.startsWith("image/"),
    );
    if (!file) return;
    event.preventDefault();
    load(file);
  }
  onMounted(() => window.addEventListener("paste", paste));
  onUnmounted(() => window.removeEventListener("paste", paste));
}
