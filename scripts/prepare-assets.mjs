import { cp, mkdir, readdir, copyFile } from 'node:fs/promises';
import { join } from 'node:path';

await mkdir('public/ocr/core', { recursive: true });
await mkdir('public/ocr/lang', { recursive: true });
await mkdir('public/pdf', { recursive: true });
await copyFile('node_modules/tesseract.js/dist/worker.min.js', 'public/ocr/worker.min.js');
for (const file of await readdir('node_modules/tesseract.js-core')) {
  if (file.endsWith('.js') || file.endsWith('.wasm')) {
    await copyFile(join('node_modules/tesseract.js-core', file), join('public/ocr/core', file));
  }
}
await cp(
  'node_modules/@tesseract.js-data/eng/4.0.0_best_int/eng.traineddata.gz',
  'public/ocr/lang/eng.traineddata.gz',
);
await copyFile('node_modules/pdfjs-dist/build/pdf.worker.min.mjs', 'public/pdf/pdf.worker.min.mjs');
console.log('Local OCR language, verified npm WASM assets, and PDF worker prepared.');
