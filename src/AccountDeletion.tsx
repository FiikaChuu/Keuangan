import { useRef, useState } from 'react';
import { supabase } from './supabase';
import { accountLifecycleEnabled, lifecyclePreviewMessage } from './lifecycle-preview';
import { Modal } from './ui';
import type { RemoteFinance } from './use-finance';
import { sendLifecycle, type ResetAttempt } from './lifecycle-client';
export function AccountDeletion({ remote }: { remote?: RemoteFinance }) {
  return <LifecycleAction kind="delete" remote={remote} />;
}
export function PersonalReset({ remote }: { remote?: RemoteFinance }) {
  return <LifecycleAction kind="reset" remote={remote} />;
}
function LifecycleAction({ kind, remote }: { kind: 'reset' | 'delete'; remote?: RemoteFinance }) {
  const reset = kind === 'reset',
    title = reset ? 'Reset data pribadi' : 'Hapus akun permanen',
    phrase = reset ? 'RESET' : 'HAPUS AKUN';
  const [open, setOpen] = useState(false),
    [password, setPassword] = useState(''),
    [confirmation, setConfirmation] = useState(''),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState(''),
    [completed, setCompleted] = useState(false);
  const uncertain = useRef(false),
    owner = useRef(crypto.randomUUID());
  const inFlight = useRef(false),
    attempt = useRef<ResetAttempt | undefined>(undefined);
  const close = () => {
    if (inFlight.current || completed || uncertain.current) return;
    setOpen(false);
    setPassword('');
    setConfirmation('');
    setMessage('');
  };
  return (
    <section className="settings-section settings-danger">
      <h3>{title}</h3>
      {!accountLifecycleEnabled && <span className="lifecycle-status">Belum tersedia di preview</span>}
      <p>
        {reset
          ? 'Hapus dompet pribadi, transaksi dan tujuan terkait, serta rencana pribadi. Login, kata sandi, dan seluruh data bersama tetap. Koneksi ke data bersama membatalkan seluruh reset.'
          : 'Hanya akun tanpa dompet, riwayat, dan anggota bersama yang dapat dihapus. Tidak ada riwayat keuangan yang dihapus otomatis.'}
      </p>
      <button
        className="settings-action"
        type="button"
        disabled={accountLifecycleEnabled && !supabase}
        onClick={() => setOpen(true)}
      >
        {accountLifecycleEnabled ? title : `Lihat informasi ${reset ? 'reset' : 'penghapusan'}`}
      </button>
      {open && (
        <Modal title={title} onClose={close}>
          <p>
            Cadangkan dahulu.{' '}
            {reset
              ? 'Reset tidak menghapus identitas akun.'
              : 'Penghapusan identitas akun bersifat permanen, bukan reset pribadi.'}
          </p>
          {!accountLifecycleEnabled && <p role="status" className="info-note">{lifecyclePreviewMessage}</p>}
          {!accountLifecycleEnabled && <button className="btn secondary" onClick={close}>Tutup</button>}
          <form
            className="form-stack"
            aria-busy={busy}
            onSubmit={async (e) => {
              e.preventDefault();
              if (!accountLifecycleEnabled || !remote) { setMessage(lifecyclePreviewMessage); return; }
              if (
                inFlight.current ||
                confirmation !== phrase ||
                !password ||
                !supabase ||
                completed
              )
                return;
              inFlight.current = true;
              setBusy(true);
              setMessage('');
              let release: (() => void) | undefined;
              try {
                release = remote.pauseLifecycle(owner.current);
                if (reset && !attempt.current)
                  attempt.current = {
                    requestId: crypto.randomUUID(),
                    revision: remote.getRevision(),
                  };
                const { data, error } = await supabase.auth.getSession();
                if (error || !data.session) throw new Error('Masuk kembali sebelum melanjutkan.');
                uncertain.current = true;
                const outcome = await sendLifecycle(
                  kind,
                  data.session.access_token,
                  password,
                  confirmation,
                  attempt.current,
                );
                uncertain.current = outcome.uncertain;
                if (!outcome.complete) {
                  if (!outcome.uncertain && reset) attempt.current = undefined;
                  setMessage(
                    outcome.result.message || 'Status belum pasti. Ulangi permintaan yang sama.',
                  );
                  if (outcome.result.code === 'STALE_DATA') {
                    setConfirmation('');
                    release?.();
                    release = undefined;
                    await remote.refresh();
                  }
                  return;
                }
                remote.stopLifecycle();
                release = undefined;
                setCompleted(true);
                setMessage(
                  reset
                    ? 'Reset dikonfirmasi. Tunggu satu detik sebelum masuk kembali.'
                    : 'Penghapusan akun dikonfirmasi.',
                );
                await remote.finishLifecycle();
              } catch (error) {
                setMessage(
                  error instanceof Error
                    ? error.message
                    : 'Status belum pasti. Ulangi permintaan yang sama.',
                );
              } finally {
                if (!uncertain.current) release?.();
                setPassword('');
                inFlight.current = false;
                setBusy(false);
              }
            }}
          >
            {!completed && accountLifecycleEnabled && (
              <>
                <label>
                  Kata sandi untuk verifikasi ulang
                  <input
                    type="password"
                    autoComplete="current-password"
                    required
                    value={password}
                    disabled={busy}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                </label>
                <label>
                  Ketik {phrase}
                  <input
                    autoComplete="off"
                    required
                    value={confirmation}
                    disabled={busy}
                    onChange={(e) => setConfirmation(e.target.value)}
                  />
                </label>
                <button
                  className="btn primary"
                  type="submit"
                  disabled={!accountLifecycleEnabled || busy || confirmation !== phrase || !password}
                >
                  {busy ? 'Memproses…' : title}
                </button>
                <button
                  className="text-btn"
                  type="button"
                  disabled={busy || uncertain.current}
                  onClick={close}
                >
                  Batal
                </button>
              </>
            )}
            {completed && (
              <button
                className="btn primary"
                type="button"
                onClick={() =>
                  void remote?.finishLifecycle()
                    .catch(() => setMessage('Sesi lokal belum ditutup. Coba keluar kembali.'))
                }
              >
                Keluar dan masuk kembali
              </button>
            )}
            {message && (
              <p role="status" className="info-note">
                {message}
              </p>
            )}
          </form>
        </Modal>
      )}
    </section>
  );
}
