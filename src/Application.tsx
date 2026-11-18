import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, LazyMotion, MotionConfig } from 'framer-motion';
import type { Session } from '@supabase/supabase-js';
import { ArrowRight, LoaderCircle, NotebookPen, ReceiptText, Users } from 'lucide-react';
import App from './App';
import { accountLifecycleEnabled, lifecyclePreviewMessage } from './lifecycle-preview';
import { AccountDeletion } from './AccountDeletion';
import { emptyStore } from './domain';
import { Logo, Modal } from './ui';
import { loadMotionFeatures } from './motion';
import { initialAuthRecovery, supabase } from './supabase';
import { useFinance } from './use-finance';
import { scanImage, takeSharedImage } from './share';
import type { ScanResult } from './scan-contract';

function Login({ recovery, complete }: { recovery: boolean; complete: () => void }) {
  const [signup, setSignup] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if ((signup || recovery) && !accountLifecycleEnabled) { setMessage(lifecyclePreviewMessage); return; }
    if (busy || !supabase) return;
    setBusy(true);
    setMessage('');
    try {
      if (signup && !recovery) {
        await supabase.auth.signUp({ email: email.trim(), password, options: { emailRedirectTo: location.origin } });
        setMessage('Jika pendaftaran dapat diproses, periksa email untuk konfirmasi. Akun yang sudah terdaftar dapat masuk atau memulihkan kata sandi.');
        return;
      }
      const { error } = recovery
        ? await supabase.auth.updateUser({ password })
        : await supabase.auth.signInWithPassword({ email: email.trim(), password });
      if (error)
        setMessage(
          recovery
            ? 'Kata sandi belum dapat diperbarui. Gunakan minimal 12 karakter.'
            : 'Email atau kata sandi tidak cocok, atau email belum dikonfirmasi.',
        );
      else if (recovery) complete();
    } catch {
      setMessage('Koneksi belum tersedia. Coba lagi.');
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className="auth-page auth-layout">
      <section className="auth-intro" aria-labelledby="auth-intro-title">
        <Logo />
        <div className="auth-wallet-symbol" aria-hidden="true">
          <span />
          <NotebookPen size={38} strokeWidth={1.4} />
        </div>
        <div className="auth-intro-copy">
          <h2 id="auth-intro-title">Ruang untuk catatan dan rencana.</h2>
          <p>Catat uang sehari-hari, pisahkan dana bersama, dan ikuti tujuan tabunganmu.</p>
        </div>
        <ul className="auth-features" aria-label="Fitur SkyWallet">
          <li>
            <NotebookPen size={22} strokeWidth={1.6} aria-hidden="true" />
            <div>
              <strong>Catatan pribadi</strong>
              <p>Pemasukan dan pengeluaran di setiap rekening.</p>
            </div>
          </li>
          <li>
            <Users size={22} strokeWidth={1.6} aria-hidden="true" />
            <div>
              <strong>Ruang bersama</strong>
              <p>Catatan dana bersama untuk anggota yang diizinkan.</p>
            </div>
          </li>
          <li>
            <ReceiptText size={22} strokeWidth={1.6} aria-hidden="true" />
            <div>
              <strong>Nota jadi catatan</strong>
              <p>Baca nota, periksa hasilnya, lalu simpan transaksi.</p>
            </div>
          </li>
        </ul>
      </section>
      <section className="auth-form-panel" aria-labelledby="auth-form-title">
        <header className="auth-form-heading">
          <h1 id="auth-form-title">{recovery ? 'Atur kata sandi' : signup ? 'Buat akun SkyWallet' : 'Masuk ke SkyWallet'}</h1>
          <p>
            {recovery
              ? 'Buat kata sandi baru untuk melanjutkan ke catatanmu.'
              : 'Masuk atau buat akun. Akun baru memiliki ruang terisolasi; berbagi antar akun baru belum tersedia.'}
          </p>
        </header>
        <form className="form-stack" onSubmit={submit} aria-busy={busy}>
          {!recovery && (
            <label htmlFor="auth-email">
              Email
              <input
                id="auth-email"
                name="email"
                type="email"
                autoComplete="username"
                placeholder="nama@contoh.com"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </label>
          )}
          <label htmlFor="auth-password">
            {recovery ? 'Kata sandi baru' : 'Kata sandi'}
            <input
              id="auth-password"
              name="password"
              type="password"
              autoComplete={recovery || signup ? 'new-password' : 'current-password'}
              aria-describedby={recovery ? 'auth-password-hint' : undefined}
              required
              minLength={recovery || signup ? 12 : 1}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            {recovery && (
              <small className="field-hint" id="auth-password-hint">
                Gunakan minimal 12 karakter.
              </small>
            )}
          </label>
          <button className="btn primary" type="submit" disabled={busy}>
            <span>{busy ? 'Memproses…' : recovery ? 'Simpan kata sandi' : signup ? 'Daftar' : 'Masuk'}</span>
            {busy ? (
              <LoaderCircle className="spin" size={18} aria-hidden="true" />
            ) : (
              <ArrowRight size={18} aria-hidden="true" />
            )}
          </button>
          {message && (
            <p className="auth-feedback info-note" role="status" aria-atomic="true">
              {message}
            </p>
          )}
        </form>
        {!recovery && (
          <div className="auth-recovery">
            <button className="text-btn" type="button" disabled={busy} onClick={() => { setSignup(!signup); setMessage(''); }}>{signup ? 'Sudah punya akun? Masuk' : 'Buat akun baru'}</button>
            <button
              className="text-btn"
              type="button"
              disabled={busy || !email}
              aria-describedby="auth-recovery-hint"
              onClick={async () => {
                setBusy(true);
                try {
                  if (!supabase) throw new Error('Auth unavailable');
                  const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
                    redirectTo: location.origin,
                  });
                  if (error) {
                    setMessage(
                      error.status === 429
                        ? 'Batas pengiriman email tercapai. Tunggu beberapa saat lalu coba lagi.'
                        : 'Tautan pemulihan belum terkirim. Coba lagi nanti.',
                    );
                    return;
                  }
                  setMessage(
                    'Jika email diizinkan, tautan pemulihan akan dikirim. Periksa kotak masuk.',
                  );
                } catch {
                  setMessage('Koneksi belum tersedia. Coba lagi.');
                } finally {
                  setBusy(false);
                }
              }}
            >
              Lupa kata sandi?
            </button>
            <p className="field-hint" id="auth-recovery-hint">
              Isi email di atas untuk meminta tautan pemulihan.
            </p>
          </div>
        )}
        <p className="auth-access-note">Akses khusus email yang telah diundang.</p>
      </section>
    </main>
  );
}
function Workspace({
  session,
  shared,
  clearShare,
  onReceipt,
}: {
  session: Session;
  shared: File | null;
  clearShare: () => void;
  onReceipt: (file: File) => void;
}) {
  const finance = useFinance(supabase!, session.user.id);
  const [scan, setScan] = useState<{ result: ScanResult; hash: string }>();
  const [scanStatus, setScanStatus] = useState('');
  const scanController = useRef<AbortController | null>(null);
  const [scanError, setScanError] = useState('');
  const [lifecycleFinished, setLifecycleFinished] = useState(false);
  const [logoutError, setLogoutError] = useState('');
  useEffect(() => {
    if (!shared) return;
    const controller = new AbortController();
    scanController.current = controller;
    setScanStatus('Membaca nominal, kategori, dan rekening…');
    setScanError('');
    void scanImage(shared, session.access_token, controller.signal)
      .then(setScan)
      .catch((error) => {
        if (!controller.signal.aborted) setScanError(error.message);
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          clearShare();
          setScanStatus('');
        }
      });
    return () => controller.abort();
  }, [shared, session.access_token]);
  const signOut = async () => {
    const { error } = await supabase!.auth.signOut({ scope: 'local' });
    if (error) throw new Error('Sesi lokal belum ditutup. Coba keluar kembali.');
    location.replace('/');
  };
  const stopLifecycle = () => {
    scanController.current?.abort(); clearShare(); setScan(undefined);
    finance.stopLifecycle(); setLifecycleFinished(true);
  };
  if (lifecycleFinished) return <main className="auth-page"><section className="auth-card auth-state-card">
    <Logo /><h1>Proses akun dikonfirmasi server</h1>
    <p role="status">Catatan dan perubahan tertunda telah ditutup. Tunggu satu detik sebelum masuk kembali.</p>
    <button className="btn primary" onClick={() => void signOut().catch(() => setLogoutError('Sesi lokal belum ditutup. Coba keluar kembali.'))}>Keluar dan masuk kembali</button>
    {logoutError && <p role="alert">{logoutError}</p>}
  </section></main>;
  if (!finance.store)
    return (
      <main className="auth-page">
        <section className="auth-card auth-state-card" aria-labelledby="workspace-status-title">
          <Logo />
          {!finance.error && (
            <LoaderCircle className="spin auth-state-icon" size={28} aria-hidden="true" />
          )}
          <div aria-busy={!finance.error}>
            <h1 id="workspace-status-title">
              {finance.error ? 'Catatan belum dapat dimuat' : 'Menyiapkan akun…'}
            </h1>
            <p role="status" aria-atomic="true">
              {finance.error || 'Memuat catatan yang dapat kamu akses.'}
            </p>
          </div>
          {finance.error && (
            <p className="field-hint">
              Periksa koneksi, lalu coba muat ulang. Kamu juga dapat keluar untuk masuk kembali.
            </p>
          )}
          {finance.error && <AccountDeletion remote={{
            store: emptyStore(), status: finance.error, email: session.user.email ?? '',
            save: finance.save, signOut, refresh: finance.refresh,
            getRevision: finance.getRevision, pauseLifecycle: finance.pauseLifecycle,
            stopLifecycle,
            finishLifecycle: async () => {
              const { error } = await supabase!.auth.signOut({ scope: 'local' });
              if (error) throw new Error('Sesi lokal belum ditutup. Coba keluar kembali.');
              location.replace('/');
            },
          }} />}
          <div className="auth-state-actions">
            <button className="btn primary" onClick={() => void finance.refresh()}>
              Coba lagi
            </button>
            <button className="text-btn" onClick={() => void signOut()}>
              Keluar
            </button>
          </div>
        </section>
      </main>
    );
  return (
    <>
      <App
        remote={{
          store: finance.store,
          status: finance.error || finance.status,
          email: session.user.email ?? '',
          save: finance.save,
          signOut,
          refresh: finance.refresh,
          getRevision: finance.getRevision,
          pauseLifecycle: finance.pauseLifecycle,
          stopLifecycle,
          finishLifecycle: async () => {
            scanController.current?.abort(); clearShare(); setScan(undefined);
            const { error } = await supabase!.auth.signOut({ scope: 'local' });
            if (error) throw new Error('Sesi lokal belum ditutup. Coba keluar kembali.');
            location.replace('/');
          },
        }}
        onReceipt={onReceipt}
        incomingScan={scan}
        onScanUsed={() => setScan(undefined)}
      />
      <AnimatePresence>
        {(scanStatus || scanError) && (
          <Modal
            key="scanner"
            title={scanError ? 'Nota belum terbaca' : 'Membaca nota'}
            onClose={() => {
              scanController.current?.abort();
              clearShare();
              setScanStatus('');
              setScanError('');
            }}
          >
            <div className="scan-status" aria-busy={!!scanStatus && !scanError}>
              {!scanError && <LoaderCircle className="spin" size={22} aria-hidden="true" />}
              <p role="status" aria-atomic="true">
                {scanError || scanStatus}
              </p>
            </div>
            {scanError && (
              <p className="field-hint">
                Coba unggah foto yang lebih jelas, atau catat transaksi secara manual.
              </p>
            )}
            <p className="field-hint">
              Gambar diproses sementara oleh Gemini dan tidak disimpan oleh aplikasi. Periksa hasil
              sebelum menyimpan.
            </p>
            {scanError && (
              <button className="btn primary" onClick={() => setScanError('')}>
                Tutup
              </button>
            )}
          </Modal>
        )}
      </AnimatePresence>
    </>
  );
}
function Authenticated() {
  const [session, setSession] = useState<Session | null>();
  const [recovery, setRecovery] = useState(initialAuthRecovery);
  const [shared, setShared] = useState<File | null>(null);
  const [shareError, setShareError] = useState('');
  useEffect(() => {
    if (!supabase) return;
    void supabase.auth
      .getSession()
      .then(({ data }) => setSession(data.session))
      .catch(() => setSession(null));
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, current) => {
      setSession(current);
      if (event === 'PASSWORD_RECOVERY') setRecovery(true);
    });
    return () => subscription.unsubscribe();
  }, []);
  useEffect(() => {
    void takeSharedImage()
      .then(setShared)
      .catch((e) => setShareError(e.message));
  }, []);
  if (!supabase)
    return (
      <main className="auth-page">
        <section className="auth-card auth-state-card" aria-labelledby="setup-title">
          <Logo />
          <h1 id="setup-title">Hubungkan SkyWallet</h1>
          <p role="status">
            Konfigurasi layanan belum tersedia. Isi konfigurasi Supabase di <code>.env.local</code>,
            lalu jalankan ulang aplikasi sesuai panduan <code>SETUP.md</code>.
          </p>
        </section>
      </main>
    );
  if (session === undefined)
    return (
      <main className="auth-page">
        <section className="auth-card auth-state-card" aria-busy="true">
          <Logo />
          <LoaderCircle className="spin auth-state-icon" size={28} aria-hidden="true" />
          <h1>Memeriksa sesi…</h1>
          <p role="status">Menyiapkan akses ke catatanmu.</p>
        </section>
      </main>
    );
  return (
    <>
      {session && !recovery ? (
        <Workspace
          key={session.user.id}
          session={session}
          shared={shared}
          clearShare={() => setShared(null)}
          onReceipt={setShared}
        />
      ) : (
        <Login recovery={recovery && !!session} complete={() => setRecovery(false)} />
      )}
      {shareError && (
        <div className="toast" role="alert">
          <span>{shareError}</span>
          <button onClick={() => setShareError('')}>Tutup</button>
        </div>
      )}
    </>
  );
}
export default function Application({ demo = false }: { demo?: boolean }) {
  useEffect(() => {
    try {
      document.documentElement.dataset.theme = 'dark';
      document
        .querySelectorAll('meta[name="theme-color"]')
        .forEach((meta) => meta.setAttribute('content', '#080808'));
    } catch {
      /* default theme */
    }
    // Previous releases persisted receipt photos; remove that obsolete image store.
    if ('indexedDB' in window) indexedDB.deleteDatabase('skysave-receipts');
    if ('serviceWorker' in navigator && process.env.NODE_ENV === 'production')
      void navigator.serviceWorker.register('/sw.js');
  }, []);
  return (
    <LazyMotion features={loadMotionFeatures} strict>
      <MotionConfig reducedMotion="user">{demo ? <App /> : <Authenticated />}</MotionConfig>
    </LazyMotion>
  );
}
