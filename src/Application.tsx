import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, LazyMotion, MotionConfig } from 'framer-motion';
import type { Session } from '@supabase/supabase-js';
import App from './App';
import { Logo, Modal } from './ui';
import { loadMotionFeatures } from './motion';
import { initialAuthRecovery, supabase } from './supabase';
import { useFinance } from './use-finance';
import { scanImage, takeSharedImage } from './share';
import type { ScanResult } from './scan-contract';

function Login({ recovery, complete }: { recovery: boolean; complete: () => void }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (busy || !supabase) return;
    setBusy(true);
    setMessage('');
    try {
      const { error } = recovery
        ? await supabase.auth.updateUser({ password })
        : await supabase.auth.signInWithPassword({ email: email.trim(), password });
      if (error)
        setMessage(
          recovery
            ? 'Kata sandi belum dapat diperbarui. Gunakan minimal 12 karakter.'
            : 'Email atau kata sandi tidak cocok, atau akun belum diundang.',
        );
      else if (recovery) complete();
    } catch {
      setMessage('Koneksi belum tersedia. Coba lagi.');
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className="auth-page">
      <section className="auth-card">
        <Logo />
        <h1>{recovery ? 'Atur kata sandi' : 'Selamat datang'}</h1>
        <p>
          {recovery
            ? 'Buat kata sandi yang kuat untuk akunmu.'
            : 'Masuk ke ruang keuangan pribadi dan bersama.'}
        </p>
        <form className="form-stack" onSubmit={submit}>
          {!recovery && (
            <label>
              Email
              <input
                type="email"
                autoComplete="username"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </label>
          )}
          <label>
            Kata sandi
            <input
              type="password"
              autoComplete={recovery ? 'new-password' : 'current-password'}
              required
              minLength={recovery ? 12 : 1}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </label>
          <button className="btn primary" disabled={busy}>
            {busy ? 'Memproses…' : recovery ? 'Simpan kata sandi' : 'Masuk'}
          </button>
          {message && (
            <p className="form-error" role="status">
              {message}
            </p>
          )}
        </form>
        {!recovery && (
          <button
            className="text-btn"
            disabled={busy || !email}
            onClick={async () => {
              setBusy(true);
              try {
                await supabase?.auth.resetPasswordForEmail(email.trim(), {
                  redirectTo: location.origin,
                });
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
        )}
        <small>Akses khusus email yang telah diundang.</small>
      </section>
    </main>
  );
}
function Workspace({
  session,
  shared,
  clearShare,
}: {
  session: Session;
  shared: File | null;
  clearShare: () => void;
}) {
  const finance = useFinance(supabase!, session.user.id);
  const [scan, setScan] = useState<{ result: ScanResult; hash: string }>();
  const [scanStatus, setScanStatus] = useState('');
  const scanController = useRef<AbortController | null>(null);
  const [scanError, setScanError] = useState('');
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
    await supabase!.auth.signOut({ scope: 'local' });
    location.replace('/');
  };
  if (!finance.store)
    return (
      <main className="auth-page">
        <section className="auth-card">
          <Logo />
          <h1>{finance.error ? 'Belum terhubung' : 'Menyiapkan akun…'}</h1>
          <p role="status">{finance.error || 'Memuat catatan yang dapat kamu akses.'}</p>
          <button className="btn primary" onClick={() => void finance.refresh()}>
            Coba lagi
          </button>
          <button className="text-btn" onClick={() => void signOut()}>
            Keluar
          </button>
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
        }}
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
            <p role="status">{scanError || scanStatus}</p>
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
        <section className="auth-card">
          <Logo />
          <h1>Hubungkan SkyWallet</h1>
          <p>
            Isi konfigurasi Supabase di .env.local, lalu jalankan ulang aplikasi. Ikuti panduan
            SETUP.md.
          </p>
        </section>
      </main>
    );
  if (session === undefined)
    return (
      <main className="auth-page">
        <p>Memeriksa sesi…</p>
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
      document.documentElement.dataset.theme = localStorage.getItem('skysave.theme') || 'light';
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
