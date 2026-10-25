import { copyFile, cp, mkdir, readdir, writeFile } from "node:fs/promises";
const root = new URL("../", import.meta.url),
  destination = new URL("public/vendor/utilities/", root);
await mkdir(destination, { recursive: true });
await mkdir(new URL("ocr/core/", destination), { recursive: true });
await mkdir(new URL("ocr/lang/", destination), { recursive: true });
await copyFile(
  new URL("node_modules/tesseract.js/dist/worker.min.js", root),
  new URL("ocr/worker.min.js", destination),
);
for (const file of await readdir(
  new URL("node_modules/tesseract.js-core/", root),
))
  if (/\.wasm(?:\.js)?$/.test(file))
    await copyFile(
      new URL("node_modules/tesseract.js-core/" + file, root),
      new URL("ocr/core/" + file, destination),
    );
for (const lang of ["chi_sim", "eng"])
  await copyFile(
    new URL(
      `node_modules/@tesseract.js-data/${lang}/4.0.0_best_int/${lang}.traineddata.gz`,
      root,
    ),
    new URL(`ocr/lang/${lang}.traineddata.gz`, destination),
  );
for (const folder of ["cmaps", "standard_fonts", "wasm"])
  await cp(
    new URL("node_modules/pdfjs-dist/" + folder, root),
    new URL("pdf/" + folder, destination),
    { recursive: true },
  );
await copyFile(
  new URL("node_modules/pdfjs-dist/LICENSE", root),
  new URL("pdf/LICENSE.txt", destination),
);
await copyFile(
  new URL("node_modules/tesseract.js/LICENSE.md", root),
  new URL("ocr/LICENSE.txt", destination),
);
await writeFile(
  new URL("NOTICE.txt", destination),
  "Tesseract.js 7.0.0, Tesseract.js-core and tessdata: Apache-2.0.\nPDF.js 6.4.299: Apache-2.0; see pdf/LICENSE.txt and standard_fonts/ licenses.\nSources: https://github.com/naptha/tesseract.js https://github.com/tesseract-ocr/tessdata_best https://github.com/mozilla/pdf.js\n",
);
console.log("Prepared local OCR models and PDF rendering assets.");
