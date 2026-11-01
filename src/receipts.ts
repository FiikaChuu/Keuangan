import { providers, today } from './domain.ts';

function database(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('skysave-receipts', 1);
    request.onupgradeneeded = () => request.result.createObjectStore('files');
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(new Error('Penyimpanan bukti tidak tersedia pada browser ini.'));
  });
}
export async function saveReceipt(id: string, file: Blob) {
  const db = await database();
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction('files', 'readwrite');
      tx.objectStore('files').put(file, id);
      tx.oncomplete = () => resolve();
      tx.onerror = () =>
        reject(new Error('Bukti gagal disimpan. Periksa ruang penyimpanan perangkat.'));
      tx.onabort = () => reject(new Error('Penyimpanan bukti dibatalkan.'));
    });
  } finally {
    db.close();
  }
}
export async function readReceipt(id: string): Promise<Blob | undefined> {
  const db = await database();
  try {
    return await new Promise((resolve, reject) => {
      const r = db.transaction('files').objectStore('files').get(id);
      r.onsuccess = () => resolve(r.result);
      r.onerror = () => reject(new Error('Bukti tidak dapat dibuka.'));
    });
  } finally {
    db.close();
  }
}
export async function deleteReceipt(id: string) {
  const db = await database();
  try {
    await new Promise<void>((resolve, reject) => {
      const t = db.transaction('files', 'readwrite');
      t.objectStore('files').delete(id);
      t.oncomplete = () => resolve();
      t.onerror = () => reject(new Error('Bukti gagal dihapus.'));
    });
  } finally {
    db.close();
  }
}
export async function clearReceipts() {
  const db = await database();
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction('files', 'readwrite');
      tx.objectStore('files').clear();
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(new Error('Bukti lama belum berhasil dihapus dari perangkat.'));
    });
  } finally {
    db.close();
  }
}
export async function hashFile(file: File) {
  return [...new Uint8Array(await crypto.subtle.digest('SHA-256', await file.arrayBuffer()))]
    .map((x) => x.toString(16).padStart(2, '0'))
    .join('');
}
export function parseRupiah(input: string): number | undefined {
  const clean = input
    .replace(/(?:rp|idr)\.?/gi, '')
    .replace(/\s/g, '')
    .trim();
  if (!/^\d[\d.,]*$/.test(clean)) return undefined;
  let number = clean;
  if (/[,\.]\d{2}$/.test(number)) number = number.slice(0, -3);
  number = number.replace(/[.,]/g, '');
  const n = Number(number);
  return Number.isSafeInteger(n) && n > 0 && n <= 1e12 ? n : undefined;
}
export function parseReceipt(text: string) {
  const lines = text
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);
  let amount: number | undefined;
  // Prefer explicit totals, never infer the biggest number (which could be a balance or account number).
  const priority = lines.findIndex((l) =>
    /total (?:pembayaran|bayar|transaksi)|jumlah (?:transfer|bayar)|nominal (?:transfer|transaksi)|^total\b/i.test(
      l,
    ),
  );
  if (priority >= 0) {
    const candidate =
      lines[priority].match(/(?:rp\.?|idr)\s*([\d.,]+)/i)?.[1] ??
      lines[priority].match(/\d[\d.,]*[.,]\d{3}(?:[.,]\d{2})?/)?.[0];
    amount = candidate ? parseRupiah(candidate) : undefined;
    if (!amount) amount = parseRupiah(lines[priority + 1] ?? '');
  }
  if (!amount) {
    const candidates = [...text.matchAll(/(?:rp\.?|idr)\s*(\d[\d.,]*)/gi)]
      .map((m) => parseRupiah(m[1]))
      .filter((n): n is number => n !== undefined);
    if (candidates.length === 1) amount = candidates[0];
  }
  const matches = providers.filter(
    (p) =>
      p.name !== 'Lainnya' && new RegExp(p.name.replace('Bank ', '(?:Bank )?'), 'i').test(text),
  );
  const sourceLine = lines.findIndex((l) =>
    /sumber dana|rekening (?:asal|sumber)|dari rekening|dibayar (?:dari|dengan)/i.test(l),
  );
  const explicit =
    sourceLine >= 0
      ? matches.find((p) =>
          new RegExp(p.name.replace('Bank ', '(?:Bank )?'), 'i').test(
            lines.slice(sourceLine, sourceLine + 3).join(' '),
          ),
        )?.name
      : undefined;
  const reference = text.match(
    /(?:no\.?\s*(?:referensi|ref|transaksi)|reference|transaction id)\s*[:#]?\s*([A-Z0-9-]{5,80})/i,
  )?.[1];
  let date: string | undefined;
  const numeric = text.match(/\b(\d{2})[/-](\d{2})[/-](\d{4})\b/);
  if (numeric) date = `${numeric[3]}-${numeric[2]}-${numeric[1]}`;
  const named = text.match(
    /\b(\d{1,2})\s+(jan\w*|feb\w*|mar\w*|apr\w*|mei|may|jun\w*|jul\w*|agu\w*|aug\w*|sep\w*|okt\w*|oct\w*|nov\w*|des\w*|dec\w*)\s+(\d{4})\b/i,
  );
  if (!date && named) {
    const aliases: Record<string, string> = {
      jan: '01',
      feb: '02',
      mar: '03',
      apr: '04',
      mei: '05',
      may: '05',
      jun: '06',
      jul: '07',
      agu: '08',
      aug: '08',
      sep: '09',
      okt: '10',
      oct: '10',
      nov: '11',
      des: '12',
      dec: '12',
    };
    date = `${named[3]}-${aliases[named[2].toLowerCase().slice(0, 3)]}-${named[1].padStart(2, '0')}`;
  }
  if (
    date &&
    (Number.isNaN(Date.parse(date)) ||
      new Date(date).toISOString().slice(0, 10) !== date ||
      date > today())
  )
    date = undefined;
  const category = /kopi|coffee|resto|makan|food|lunch|cafe/i.test(text)
    ? 'Makanan & minuman'
    : /telkomsel|paket data|kuota|indosat|internet/i.test(text)
      ? 'Kuota & internet'
      : /grab|gojek|transport/i.test(text)
        ? 'Transportasi'
        : undefined;
  return {
    amount,
    date,
    reference,
    provider: explicit,
    candidates: matches.map((p) => p.name),
    category,
  };
}
export async function extractReceipt(
  file: File,
  progress: (status: string) => void,
): Promise<string> {
  let worker: Awaited<ReturnType<(typeof import('tesseract.js'))['createWorker']>> | undefined;
  const recognize = async (image: File | HTMLCanvasElement) => {
    if (!worker) {
      const { createWorker } = await import('tesseract.js');
      worker = await createWorker('eng', 1, {
        workerPath: '/ocr/worker.min.js',
        corePath: '/ocr/core',
        langPath: '/ocr/lang',
        workerBlobURL: false,
        logger: (m) => {
          if (m.status === 'recognizing text')
            progress(`Membaca bukti… ${Math.round(m.progress * 100)}%`);
        },
      });
    }
    return (await worker.recognize(image)).data.text;
  };
  try {
    if (file.type !== 'application/pdf') return await recognize(file);
    progress('Membuka dokumen PDF…');
    const pdfjs = await import('pdfjs-dist');
    pdfjs.GlobalWorkerOptions.workerSrc = '/pdf/pdf.worker.min.mjs';
    const document = await pdfjs.getDocument({ data: await file.arrayBuffer() }).promise;
    try {
      if (document.numPages > 5)
        throw new Error('Maksimal 5 halaman per bukti. Pisahkan PDF sebelum mengunggah.');
      const results: string[] = [];
      for (let i = 1; i <= document.numPages; i++) {
        progress(`Membaca halaman ${i} dari ${document.numPages}…`);
        const page = await document.getPage(i);
        const text = (await page.getTextContent()).items
          .map((item) => ('str' in item ? item.str + (item.hasEOL ? '\n' : ' ') : ''))
          .join('');
        if (text.trim().length > 30) results.push(text);
        else {
          const base = page.getViewport({ scale: 1 });
          const canvas = window.document.createElement('canvas');
          const viewport = page.getViewport({
            scale: Math.min(2, 2000 / Math.max(base.width, base.height)),
          });
          canvas.width = viewport.width;
          canvas.height = viewport.height;
          await page.render({ canvas, viewport }).promise;
          results.push(await recognize(canvas));
          canvas.width = 0;
          canvas.height = 0;
        }
      }
      return results.join('\n');
    } finally {
      await document.destroy();
    }
  } finally {
    if (worker) await worker.terminate();
  }
}
