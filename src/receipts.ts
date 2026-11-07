import { providers, today } from './domain.ts';

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
