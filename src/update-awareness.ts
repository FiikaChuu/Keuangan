const validBuild = (value: unknown): value is string =>
  typeof value === 'string' && /^[a-f0-9]{7,40}$/.test(value);

export async function checkBuild(current: string, fetcher: typeof fetch = fetch): Promise<boolean> {
  if (!validBuild(current)) return false;
  try {
    const response = await fetcher('/api/version', { cache: 'no-store', signal: AbortSignal.timeout(10000) });
    if (!response.ok) return false;
    const data: unknown = await response.json();
    const build = data && typeof data === 'object' && 'build' in data ? data.build : null;
    return validBuild(build) && build !== current;
  } catch {
    return false;
  }
}

// Always ask, including non-modal forms (planning, login) and in-flight edits.
// No cache deletion, session changes or automatic reloads are part of updating.
export function requestRefresh(confirm: (message: string) => boolean, reload: () => void) {
  if (confirm('Muat ulang SkyWallet? Perubahan yang belum disimpan akan hilang. Pilih Batal untuk menyimpan atau membatalkan formulir terlebih dahulu. Catatan yang sudah tersimpan tetap ada.')) reload();
}
