import jsQR from "jsqr";
self.onmessage = (event) => {
  try {
    const { data, width, height } = event.data;
    const result = jsQR(data, width, height, {
      inversionAttempts: "attemptBoth",
    });
    if (!result)
      throw new Error("未识别到二维码，请使用清晰、完整且留有边缘的图片");
    self.postMessage({ result: result.data });
  } catch (error) {
    self.postMessage({
      error: error instanceof Error ? error.message : "识别失败",
    });
  }
};
