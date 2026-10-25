import { processFile } from "../lib/file-utilities";
self.onmessage = async (event) => {
  try {
    self.postMessage({ result: await processFile(event.data) });
  } catch (error) {
    self.postMessage({
      error: error instanceof Error ? error.message : "文件处理失败",
    });
  }
};
