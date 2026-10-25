import { processPopularText } from "../lib/popular-text";
self.onmessage = async (event) => {
  try {
    self.postMessage({ result: await processPopularText(event.data) });
  } catch (error) {
    self.postMessage({
      error: error instanceof Error ? error.message : "处理失败，请检查输入",
    });
  }
};
