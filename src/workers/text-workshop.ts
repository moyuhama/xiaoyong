import { textWorkshop, type TextWorkshopRequest } from "../lib/more-tools";
self.onmessage = async (event: MessageEvent<TextWorkshopRequest>) => {
  try {
    self.postMessage({ result: await textWorkshop(event.data) });
  } catch (error) {
    self.postMessage({
      error: error instanceof Error ? error.message : "处理失败，请检查内容",
    });
  }
};
