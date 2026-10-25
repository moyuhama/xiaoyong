import { FilesetResolver, ImageSegmenter } from "@mediapipe/tasks-vision";
import type { PortraitMask } from "../lib/id-photo";

self.onmessage = async (
  event: MessageEvent<{ image: ImageBitmap; assetRoot: string }>,
) => {
  let segmenter: ImageSegmenter | undefined;
  const { image, assetRoot } = event.data;
  try {
    const vision = await FilesetResolver.forVisionTasks(
      assetRoot + "vendor/mediapipe/1.1.1",
      true,
    );
    segmenter = await ImageSegmenter.createFromOptions(vision, {
      baseOptions: {
        modelAssetPath: assetRoot + "models/selfie_segmenter.tflite",
        delegate: "CPU",
      },
      canvas: new OffscreenCanvas(image.width, image.height),
      runningMode: "IMAGE",
      outputConfidenceMasks: true,
      outputCategoryMask: false,
    });
    segmenter.segment(image, (result) => {
      const masks = result.confidenceMasks;
      const person = masks?.[masks.length === 1 ? 0 : 1];
      if (!person) throw new Error("没有生成有效的人像蒙版");
      const confidence = person.getAsFloat32Array().slice();
      let count = 0;
      for (const value of confidence) if (value >= 0.5) count++;
      if (count / confidence.length < 0.02)
        throw new Error("没有识别到清晰人像，请换一张正面近照");
      const output: PortraitMask = {
        width: person.width,
        height: person.height,
        confidence,
      };
      self.postMessage({ result: output });
    });
  } catch (error) {
    self.postMessage({
      error:
        error instanceof Error && error.message.startsWith("没有")
          ? error.message
          : "人像处理失败，请检查网络并使用新版浏览器后重试",
    });
  } finally {
    segmenter?.close();
    image.close();
  }
};
