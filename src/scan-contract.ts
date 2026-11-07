import { z } from 'zod';

export const scanCategories = [
  'Makan',
  'Belanja',
  'Pendidikan',
  'Transportasi',
  'Tagihan',
  'Transfer',
  'Lainnya',
] as const;
export const scanResultSchema = z
  .object({
    category: z.enum(scanCategories),
    amount: z.number().int().min(1).max(1_000_000_000_000),
    is_transfer: z.boolean(),
    from_bank: z.string().trim().max(80).nullable(),
    to_bank: z.string().trim().max(80).nullable(),
    notes: z.string().trim().max(500).nullable(),
  })
  .strict()
  .superRefine((value, context) => {
    if (value.is_transfer !== (value.category === 'Transfer'))
      context.addIssue({ code: 'custom', message: 'Jenis dan kategori transfer tidak konsisten.' });
    if (!value.is_transfer && (value.from_bank !== null || value.to_bank !== null))
      context.addIssue({ code: 'custom', message: 'Rekening hanya untuk transfer.' });
  });
export type ScanResult = z.infer<typeof scanResultSchema>;
export const MAX_SCAN_BYTES = 3 * 1024 * 1024;
export function imageMime(bytes: Uint8Array): string | null {
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return 'image/jpeg';
  if ([137, 80, 78, 71, 13, 10, 26, 10].every((v, i) => bytes[i] === v)) return 'image/png';
  if (
    String.fromCharCode(...bytes.slice(0, 4)) === 'RIFF' &&
    String.fromCharCode(...bytes.slice(8, 12)) === 'WEBP'
  )
    return 'image/webp';
  return null;
}
