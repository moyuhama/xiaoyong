import { convertYaml } from "../lib/config-tools";
self.onmessage = (event: MessageEvent<{ source: string; toJson: boolean }>) => {
  try {
    self.postMessage({
      result: convertYaml(event.data.source, event.data.toJson),
    });
  } catch (err) {
    self.postMessage({
      error: err instanceof Error ? err.message : "转换失败，请检查输入",
    });
  }
};
