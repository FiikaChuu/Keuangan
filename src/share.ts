import { MAX_SCAN_BYTES, scanResultSchema } from './scan-contract';
import type { ScanResult } from './scan-contract';
import type { Account, Transaction } from './domain';

export async function takeSharedImage(): Promise<File | null> {
  const url = new URL(location.href);
  if (url.searchParams.has('share_error')) {
    url.searchParams.delete('share_error');
    history.replaceState(null, '', url.pathname + url.search + url.hash);
    throw new Error('Bagikan satu foto JPG, PNG, atau WEBP berukuran maksimal 3 MB.');
  }
  const id = url.searchParams.get('share');
  if (!id) return null;
  url.searchParams.delete('share');
  history.replaceState(null, '', url.pathname + url.search + url.hash);
  const registration = await navigator.serviceWorker.ready;
  const worker = navigator.serviceWorker.controller ?? registration.active;
  if (!worker) throw new Error('Bagikan ulang gambar setelah aplikasi selesai terpasang.');
  return new Promise((resolve, reject) => {
    const channel = new MessageChannel();
    const timeout = setTimeout(() => {
      channel.port1.close();
      reject(new Error('Gambar sudah kedaluwarsa. Silakan bagikan ulang.'));
    }, 5000);
    channel.port1.onmessage = ({ data }) => {
      clearTimeout(timeout);
      channel.port1.close();
      if (!data?.bytes) {
        reject(new Error('Gambar sementara sudah dilepas. Silakan bagikan ulang.'));
        return;
      }
      resolve(new File([data.bytes], 'nota', { type: data.type }));
    };
    worker.postMessage({ type: 'TAKE_SHARE', id }, [channel.port2]);
  });
}
export async function scanImage(
  file: File,
  token: string,
  signal: AbortSignal,
): Promise<{ result: ScanResult; hash: string }> {
  if (file.size > MAX_SCAN_BYTES || file.size === 0)
    throw new Error('Bagikan JPG, PNG, atau WEBP berukuran maksimal 3 MB.');
  const bytes = await file.arrayBuffer();
  const hash = [...new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))]
    .map((v) => v.toString(16).padStart(2, '0'))
    .join('');
  new Uint8Array(bytes).fill(0);
  const response = await fetch('/api/scan-receipt', {
    method: 'POST',
    body: file,
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': file.type },
    cache: 'no-store',
    signal,
  });
  const json = await response.json();
  if (!response.ok) throw new Error(json.error || 'Nota belum dapat dibaca.');
  return { result: scanResultSchema.parse(json), hash };
}
function providerKey(name: string) {
  return name
    .toLowerCase()
    .replace(/^bank\s+/, '')
    .replace(/[ .-]/g, '');
}
export function defaultsFromScan(
  result: ScanResult,
  hash: string,
  accounts: Account[],
): Partial<Transaction> {
  function unique(name: string | null) {
    const matches = name
      ? accounts.filter((a) => providerKey(a.provider) === providerKey(name))
      : [];
    return matches.length === 1 ? matches[0].id : '';
  }
  const accountId = result.is_transfer ? unique(result.from_bank) : '';
  const destination = unique(result.to_bank);
  return {
    kind: result.is_transfer ? 'transfer' : 'expense',
    title: result.category,
    category: result.category,
    amount: result.amount,
    accountId,
    toId: destination !== accountId ? destination : '',
    note: result.notes ?? '',
    receiptHash: hash,
  };
}
