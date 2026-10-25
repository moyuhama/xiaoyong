import { processPdf, type PdfRequest } from "../lib/pdf-tools";
self.onmessage = async (event: MessageEvent<PdfRequest>) => {
  try {
    const result = await processPdf(event.data);
    self.postMessage({ result });
  } catch (err) {
    self.postMessage({
      error: err instanceof Error ? err.message : "PDF 处理失败",
    });
  }
};
