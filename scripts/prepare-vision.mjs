import { copyFile, mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const root = new URL("../", import.meta.url);
const destination = new URL("public/vendor/mediapipe/1.1.1/", root);
await mkdir(destination, { recursive: true });
for (const filename of [
  "vision_wasm_module_internal.js",
  "vision_wasm_module_internal.wasm",
]) {
  await copyFile(
    new URL("node_modules/@mediapipe/tasks-vision/wasm/" + filename, root),
    new URL(filename, destination),
  );
}
await copyFile(
  new URL("public/models/LICENSE-APACHE-2.0.txt", root),
  new URL("LICENSE.txt", destination),
);
console.log("Prepared local portrait runtime:", fileURLToPath(destination));
