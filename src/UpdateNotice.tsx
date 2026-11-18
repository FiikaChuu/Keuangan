import { useEffect, useState } from 'react';
import { RefreshCw } from './MeshIcon';
import { checkBuild, requestRefresh } from './update-awareness';

export const BUILD_ID = process.env.NEXT_PUBLIC_BUILD_ID ?? 'development';
export default function UpdateNotice() {
  const [available, setAvailable] = useState(false);
  useEffect(() => {
    let alive = true, pending = false;
    const check = async () => {
      if (pending || document.visibilityState === 'hidden') return;
      pending = true;
      const different = await checkBuild(BUILD_ID);
      if (alive) setAvailable(different);
      pending = false;
    };
    const workerChanged = () => {
      // First installation claiming this tab is not evidence of an update.
      if (hadController) void check();
      hadController = true;
    };
    let hadController = !!navigator.serviceWorker?.controller;
    void check();
    const interval = window.setInterval(check, 5 * 60 * 1000);
    window.addEventListener('focus', check);
    document.addEventListener('visibilitychange', check);
    navigator.serviceWorker?.addEventListener('controllerchange', workerChanged);
    return () => {
      alive = false;
      clearInterval(interval);
      window.removeEventListener('focus', check);
      document.removeEventListener('visibilitychange', check);
      navigator.serviceWorker?.removeEventListener('controllerchange', workerChanged);
    };
  }, []);
  if (!available) return null;
  return <aside className="update-notice" aria-label="Pembaruan aplikasi">
    <div role="status"><strong>Versi baru tersedia</strong><p>Simpan atau batalkan perubahan sebelum memuat ulang.</p></div>
    <button className="btn secondary small-btn" onClick={() => requestRefresh(message => window.confirm(message), () => window.location.reload())}>
      <RefreshCw size={16} /> Muat ulang
    </button>
  </aside>;
}
