import { onUnmounted, ref, shallowRef } from "vue";
export function useWorkerTask<Input, Result>(
  create: () => Worker,
  timeoutMs = 3000,
) {
  const result = shallowRef<Result>(),
    busy = ref(false),
    error = ref("");
  let worker: Worker | undefined,
    timer: ReturnType<typeof setTimeout> | undefined;
  let settle: ((value: Result | undefined) => void) | undefined;
  let generation = 0;
  function cleanup() {
    worker?.terminate();
    worker = undefined;
    clearTimeout(timer);
    busy.value = false;
  }
  function cancel() {
    generation++;
    cleanup();
    settle?.(undefined);
    settle = undefined;
    result.value = undefined;
    error.value = "";
  }
  function run(input: Input): Promise<Result | undefined> {
    cancel();
    busy.value = true;
    const current = generation;
    return new Promise((resolve) => {
      settle = resolve;
      function finish(value?: Result, message = "") {
        if (current !== generation) return;
        cleanup();
        result.value = value;
        error.value = message;
        settle = undefined;
        resolve(value);
      }
      try {
        worker = create();
        worker.onmessage = (event) =>
          event.data.error
            ? finish(undefined, event.data.error)
            : finish(event.data.result);
        worker.onerror = () =>
          finish(undefined, "处理未能完成，请检查输入后重试");
        timer = setTimeout(
          () => finish(undefined, "处理超时，请缩小内容或文件后重试"),
          timeoutMs,
        );
        worker.postMessage(input);
      } catch {
        finish(undefined, "无法开始处理，请重试");
      }
    });
  }
  onUnmounted(cancel);
  return { result, busy, error, run, cancel };
}
