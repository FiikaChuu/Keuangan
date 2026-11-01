import { useEffect, useRef, useState } from 'react';
import type { ReactNode, FormEvent } from 'react';
import {
  LayoutDashboard,
  ArrowLeftRight,
  Wallet,
  Sparkles,
  Heart,
  Plus,
  ArrowUpRight,
  ArrowDownLeft,
  ChevronDown,
  ChevronRight,
  Search,
  UploadCloud,
  Bell,
  Settings,
  ShieldCheck,
  ArrowRight,
  Leaf,
  Download,
  SlidersHorizontal,
  X,
  Check,
  Info,
  Target,
  TrendingUp,
  CalendarDays,
  Coffee,
  PiggyBank,
  MoreHorizontal,
  Smartphone,
  RefreshCw,
  Trash2,
  LoaderCircle,
  HardDrive,
} from 'lucide-react';
import type { Store, Transaction, Account, Goal, Plan } from './domain';
import {
  STORAGE_KEY,
  money,
  balances,
  demoStore,
  emptyStore,
  isStore,
  today,
  daysAgo,
  totals,
  allocations,
  spendingByCategory,
  csv,
} from './domain';
import {
  Logo,
  ProviderMark,
  TransactionList,
  BalanceChart,
  SpendingDonut,
  EmptyState,
  Modal,
} from './ui';
import { TransactionForm, AccountForm, GoalForm, TransactionDetail } from './forms';
import { clearReceipts, deleteReceipt, readReceipt, saveReceipt } from './receipts';

type Page = 'overview' | 'accounts' | 'transactions' | 'plan' | 'together';
type Dialog =
  | { type: 'transaction'; mode?: 'manual' | 'receipt'; defaults?: Partial<Transaction> }
  | { type: 'account'; shared?: boolean }
  | { type: 'goal' }
  | { type: 'settings' }
  | { type: 'detail'; tx: Transaction }
  | { type: 'confirm'; title: string; text: string; action: () => void }
  | { type: 'notifications' }
  | null;
const navItems = [
  { id: 'overview' as const, label: 'Ringkasan', short: 'Beranda', icon: LayoutDashboard },
  { id: 'transactions' as const, label: 'Transaksi', short: 'Riwayat', icon: ArrowLeftRight },
  { id: 'accounts' as const, label: 'Dompet saya', short: 'Dompet', icon: Wallet },
  { id: 'plan' as const, label: 'Rencana uang', short: 'Rencana', icon: Sparkles },
  { id: 'together' as const, label: 'Ruang bersama', short: 'Bersama', icon: Heart },
];
function loadStore(): { data: Store; error: string } {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { data: demoStore(), error: '' };
    const parsed: unknown = JSON.parse(raw);
    if (!isStore(parsed)) throw Error();
    return { data: parsed, error: '' };
  } catch {
    return {
      data: emptyStore(),
      error:
        'Data tersimpan tidak dapat dibaca. Unduh salinan pemulihan melalui Pengaturan sebelum memulai ulang.',
    };
  }
}
function download(content: BlobPart, type: string, name: string) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export default function App() {
  const [initial] = useState(loadStore);
  const [store, setStore] = useState(initial.data);
  const [recoveryError, setRecoveryError] = useState(initial.error);
  const [page, setPage] = useState<Page>('overview');
  const [dialog, setDialog] = useState<Dialog>(null);
  const [toast, setToast] = useState('');
  const [search, setSearch] = useState('');
  const toastTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  function notify(message: string) {
    setToast(message);
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(''), 4500);
  }
  useEffect(() => () => clearTimeout(toastTimer.current), []);
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' });
  }, [page]);
  function save(next: Store, allowRecovery = false) {
    if (recoveryError && !allowRecovery) {
      notify('Pulihkan atau mulai ulang data melalui Pengaturan terlebih dahulu.');
      return false;
    }
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      setStore(next);
      setRecoveryError('');
      notify('Tersimpan. Satu langkah lebih teratur.');
      return true;
    } catch {
      notify(
        'Belum tersimpan. Penyimpanan browser penuh atau tidak tersedia. Ekspor cadangan terlebih dahulu.',
      );
      return false;
    }
  }
  const close = () => setDialog(null);
  const b = balances(store);
  const total = Object.values(b).reduce((s, n) => s + n, 0);
  function startOwn() {
    setDialog({
      type: 'confirm',
      title: store.demo ? 'Mulai cerita uangmu?' : 'Hapus data dan mulai ulang?',
      text: store.demo
        ? 'Data contoh akan diganti dengan ruang kosong untuk rekening dan transaksi milikmu. Tidak ada rekening bank yang dihubungkan.'
        : 'Semua catatan, rencana, tujuan, dan bukti tersimpan akan dihapus dari skySave pada browser ini. Unduh cadangan lengkap terlebih dahulu. Tindakan ini tidak bisa dibatalkan.',
      action: () => {
        if (save(emptyStore(), true)) {
          void clearReceipts().catch(() =>
            notify(
              'Catatan sudah direset, tetapi bukti lama belum berhasil dihapus dari perangkat.',
            ),
          );
          setPage('accounts');
          setDialog({ type: 'account' });
        }
      },
    });
  }
  function openTransfer(toId: string, amount?: number) {
    const source = store.accounts
      .filter((a) => !a.shared && a.id !== toId)
      .sort((a, c) => b[c.id] - b[a.id])[0];
    if (!source) {
      notify('Tambahkan rekening sumber pribadi yang berbeda terlebih dahulu.');
      return;
    }
    setDialog({
      type: 'transaction',
      defaults: { kind: 'transfer', toId, accountId: source.id, amount, title: 'Untuk masa depan' },
    });
  }
  async function removeTransaction(t: Transaction) {
    const next = { ...store, transactions: store.transactions.filter((x) => x.id !== t.id) };
    if (Object.values(balances(next)).some((n) => n < 0)) {
      close();
      notify(
        'Transaksi ini sudah digunakan untuk pengeluaran berikutnya. Hapus transaksi terkait terlebih dahulu agar saldo tidak negatif.',
      );
      return;
    }
    if (save(next)) {
      close();
      if (t.receiptId)
        try {
          await deleteReceipt(t.receiptId);
        } catch {
          notify('Transaksi terhapus, tetapi lampiran belum terhapus dari perangkat.');
        }
    }
  }
  const goalCard = (g: Goal) => {
    const current = b[g.accountId];
    const progress = Math.min(100, (current / g.target) * 100);
    const account = store.accounts.find((a) => a.id === g.accountId)!;
    return (
      <div className="goal-card" key={g.id}>
        <div className="goal-top">
          <span className="goal-emoji">{g.emoji}</span>
          <button
            className="icon-btn small-icon"
            aria-label={`Hapus tujuan ${g.name}`}
            onClick={() =>
              setDialog({
                type: 'confirm',
                title: 'Hapus tujuan ini?',
                text: 'Saldo rekening dan riwayat transaksi tetap tersimpan. Hanya target tabungan ini yang dihapus.',
                action: () => {
                  if (save({ ...store, goals: store.goals.filter((x) => x.id !== g.id) })) close();
                },
              })
            }
          >
            <X size={15} />
          </button>
        </div>
        <h3>{g.name}</h3>
        <p>
          {account.provider} · {account.name}
        </p>
        <div className="goal-amount">
          <strong>{money(current)}</strong>
          <span>dari {money(g.target)}</span>
        </div>
        <div className="progress-track">
          <span style={{ width: `${progress}%` }} />
        </div>
        <div className="goal-bottom">
          <span>{Math.floor(progress)}% terwujud</span>
          <button className="text-btn" onClick={() => openTransfer(g.accountId)}>
            Tambah dana
            <Plus size={13} />
          </button>
        </div>
      </div>
    );
  };
  const accountCard = (a: Account, full = false) => (
    <button
      key={a.id}
      className={`wallet-card ${full ? 'wallet-full' : ''}`}
      onClick={() => {
        setSearch(a.id);
        setPage('transactions');
      }}
    >
      <div className="wallet-card-top">
        <ProviderMark account={a} />
        <span>
          {a.shared ? (
            <Heart size={15} />
          ) : a.suffix ? (
            `•• ${a.suffix}`
          ) : (
            <ArrowUpRight size={16} />
          )}
        </span>
      </div>
      <div className="wallet-name">
        <strong>{a.provider}</strong>
        <span>{a.name}</span>
      </div>
      <div className="wallet-balance">
        <strong>{money(b[a.id])}</strong>
        <ArrowUpRight size={15} />
      </div>
      {full && (
        <span className="wallet-type">
          {a.shared ? 'Dompet bersama' : 'Dompet pribadi'}
          <span>
            Lihat riwayat
            <ChevronRight size={12} />
          </span>
        </span>
      )}
    </button>
  );
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <a
          href="#"
          className="brand-link"
          aria-label="skySave beranda"
          onClick={(e) => {
            e.preventDefault();
            setPage('overview');
          }}
        >
          <Logo />
        </a>
        <div className="workspace-label">YOUR PERSONAL SPACE</div>
        <nav aria-label="Navigasi utama">
          {navItems.map((n) => (
            <button
              key={n.id}
              aria-label={n.label}
              className={`nav-item ${page === n.id ? 'active' : ''}`}
              onClick={() => {
                setPage(n.id);
                setSearch('');
              }}
            >
              <n.icon size={19} strokeWidth={1.7} />
              <span>{n.label}</span>
              {page === n.id && <span className="nav-active-dot" />}
              {n.id === 'together' && <span className="new-label">FOR TWO</span>}
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="sidebar-note">
            <span className="note-illustration">
              <Leaf size={27} strokeWidth={1.3} />
              <span>✦</span>
            </span>
            <h3>
              Small steps.
              <br />
              Brighter future.
            </h3>
            <p>
              Mulai dari sedikit,
              <br />
              tumbuh jadi berarti.
            </p>
            <button onClick={() => setPage('plan')}>
              Buat rencanamu
              <ArrowUpRight size={15} />
            </button>
          </div>
          <button className="nav-item settings-nav" onClick={() => setDialog({ type: 'settings' })}>
            <Settings size={19} strokeWidth={1.7} />
            Pengaturan
          </button>
          <button className="profile" onClick={() => setDialog({ type: 'settings' })}>
            <span className="avatar">
              S<span />
            </span>
            <span>
              <strong>Ruang pribadimu</strong>
              <small>
                <span className="status-dot" />
                Tersimpan di perangkat
              </small>
            </span>
            <ChevronDown size={14} />
          </button>
        </div>
      </aside>
      <div className="main-shell">
        <header className="topbar">
          <div className="topbar-breadcrumb">
            <span className="breadcrumb-mark">
              <LayoutDashboard size={14} />
            </span>
            Ruang pribadi<span>/</span>
            <strong>{navItems.find((n) => n.id === page)?.label}</strong>
          </div>
          <div className="topbar-actions">
            <button className="local-badge" onClick={() => setDialog({ type: 'settings' })}>
              <ShieldCheck size={13} />
              <span>Private by design</span>
            </button>
            <button
              className="icon-btn search-top"
              aria-label="Cari transaksi"
              onClick={() => {
                setPage('transactions');
                setSearch('');
                setTimeout(() => document.getElementById('transaction-search')?.focus(), 80);
              }}
            >
              <Search size={19} />
            </button>
            <button
              className="icon-btn notification-btn"
              aria-label="Lihat insight keuangan"
              onClick={() => setDialog({ type: 'notifications' })}
            >
              <Bell size={19} />
              <i />
            </button>
            <button
              className="top-avatar"
              aria-label="Buka pengaturan"
              onClick={() => setDialog({ type: 'settings' })}
            >
              S
            </button>
          </div>
          <div className="mobile-brand">
            <Logo />
          </div>
        </header>
        <main>
          {store.demo && (
            <div className="demo-banner">
              <span>
                <span className="demo-dot" />
                Kamu sedang menjelajahi <strong>data contoh</strong>.
              </span>
              <button onClick={startOwn}>
                Mulai dengan data saya
                <ArrowRight size={13} />
              </button>
            </div>
          )}
          {recoveryError && (
            <div className="recovery-banner" role="alert">
              {recoveryError}
              <button className="text-btn" onClick={() => setDialog({ type: 'settings' })}>
                Buka pengaturan
                <ArrowRight size={14} />
              </button>
            </div>
          )}
          {page === 'overview' && (
            <Overview
              store={store}
              total={total}
              onAdd={() => setDialog({ type: 'transaction' })}
              onUpload={() => setDialog({ type: 'transaction', mode: 'receipt' })}
              go={setPage}
              detail={(t) => setDialog({ type: 'detail', tx: t })}
              accountCard={accountCard}
              onAccount={() => setDialog({ type: 'account' })}
            />
          )}
          {page === 'accounts' && (
            <>
              <PageHeading
                eyebrow="A PLACE FOR EVERY RUPIAH"
                title="Uangmu, di satu tempat."
                description="Rekening berbeda. Satu pandangan yang lebih jelas."
                action={
                  <button className="btn primary" onClick={() => setDialog({ type: 'account' })}>
                    <Plus size={17} />
                    Tambah dompet
                  </button>
                }
              />
              <div className="account-summary">
                <div>
                  <span>Total seluruh dompet</span>
                  <strong>{money(total)}</strong>
                </div>
                <div>
                  <span>Pribadi</span>
                  <strong>
                    {money(
                      store.accounts.filter((a) => !a.shared).reduce((s, a) => s + b[a.id], 0),
                    )}
                  </strong>
                </div>
                <div>
                  <span>Bersama</span>
                  <strong>
                    {money(store.accounts.filter((a) => a.shared).reduce((s, a) => s + b[a.id], 0))}
                  </strong>
                </div>
              </div>
              <div className="section-title">
                <h2>
                  Dompet pribadi
                  <span className="count-badge">
                    {store.accounts.filter((a) => !a.shared).length}
                  </span>
                </h2>
                <span className="muted-label">Bank & e-wallet</span>
              </div>
              {store.accounts.some((a) => !a.shared) ? (
                <div className="wallet-grid">
                  {store.accounts.filter((a) => !a.shared).map((a) => accountCard(a, true))}
                  <button className="add-wallet" onClick={() => setDialog({ type: 'account' })}>
                    <span>
                      <Plus size={22} />
                    </span>
                    Dompet baru
                  </button>
                </div>
              ) : (
                <EmptyState
                  icon={<Wallet size={28} />}
                  title="Beri setiap rupiah tempatnya"
                  text="Mulai dengan rekening yang paling sering kamu gunakan dan masukkan saldo awalnya."
                  action={
                    <button className="btn primary" onClick={() => setDialog({ type: 'account' })}>
                      <Plus size={16} />
                      Tambah dompet pertama
                    </button>
                  }
                />
              )}
              <div className="section-title spaced">
                <h2>
                  Dompet bersama
                  <Heart size={17} />
                </h2>
                <button
                  className="text-btn"
                  onClick={() => setDialog({ type: 'account', shared: true })}
                >
                  Tambah akun bersama
                  <Plus size={14} />
                </button>
              </div>
              <div className="wallet-grid">
                {store.accounts.filter((a) => a.shared).map((a) => accountCard(a, true))}
              </div>
              <div className="privacy-strip">
                <ShieldCheck size={20} />
                <div>
                  <strong>Catatanmu. Kendalimu.</strong>
                  <p>
                    Saldo mengikuti transaksi yang kamu catat, bukan saldo langsung dari bank. Tidak
                    ada akun bank yang dihubungkan. Penarikan tunai dicatat sebagai pengeluaran.
                  </p>
                </div>
              </div>
            </>
          )}
          {page === 'transactions' && (
            <Transactions
              store={store}
              search={search}
              setSearch={setSearch}
              detail={(t) => setDialog({ type: 'detail', tx: t })}
              onAdd={() => setDialog({ type: 'transaction' })}
              onUpload={() => setDialog({ type: 'transaction', mode: 'receipt' })}
            />
          )}
          {page === 'plan' && (
            <Planning
              store={store}
              save={save}
              goals={store.goals.map(goalCard)}
              onGoal={() => setDialog({ type: 'goal' })}
              onTransfer={openTransfer}
            />
          )}
          {page === 'together' && (
            <>
              <PageHeading
                eyebrow="BETTER, TOGETHER"
                title="Untuk cerita kita."
                description="Mimpi bersama, dimulai dari langkah kecil hari ini."
                action={
                  <button
                    className="btn primary"
                    onClick={() => setDialog({ type: 'account', shared: true })}
                  >
                    <Plus size={16} />
                    Akun bersama
                  </button>
                }
              />
              <div className="together-hero">
                <div>
                  <span className="light-pill">
                    <Heart size={13} />A little for us
                  </span>
                  <h2>
                    Tumbuh sendiri.
                    <br />
                    Melangkah bersama.
                  </h2>
                  <p>
                    Ruang khusus untuk uang dan tujuan kalian.
                    <br />
                    Terpisah dari kebutuhan pribadi, tetap dalam kendali.
                  </p>
                  <div className="together-total">
                    <small>Total dana bersama</small>
                    <strong>
                      {money(
                        store.accounts.filter((a) => a.shared).reduce((s, a) => s + b[a.id], 0),
                      )}
                    </strong>
                  </div>
                </div>
                <div className="together-art" aria-hidden="true">
                  <div className="art-orbit orbit-one" />
                  <div className="art-orbit orbit-two" />
                  <span className="heart-one">
                    <Heart size={62} strokeWidth={1.1} />
                  </span>
                  <span className="heart-two">
                    <Heart size={42} strokeWidth={1.2} />
                  </span>
                  <span className="art-star">✧</span>
                  <span className="art-text">
                    a future worth
                    <br />
                    saving for.
                  </span>
                </div>
              </div>
              <div className="info-note together-info">
                <Info size={17} />
                <span>
                  Akun bersama saat ini adalah catatan di perangkatmu, belum akses multi-pengguna.
                  Transfer dari rekening pribadi ke akun bersama tidak dihitung sebagai pengeluaran.
                </span>
              </div>
              <div className="section-title spaced">
                <h2>Dompet kita</h2>
                <span className="muted-label">
                  {store.accounts.filter((a) => a.shared).length} akun bersama
                </span>
              </div>
              {store.accounts.some((a) => a.shared) ? (
                <div className="wallet-grid shared-wallets">
                  {store.accounts
                    .filter((a) => a.shared)
                    .map((a) => (
                      <div className="shared-wallet-wrap" key={a.id}>
                        {accountCard(a, true)}
                        <button className="btn secondary" onClick={() => openTransfer(a.id)}>
                          <Plus size={15} />
                          Catat penambahan dana
                        </button>
                      </div>
                    ))}
                </div>
              ) : (
                <EmptyState
                  icon={<Heart size={28} />}
                  title="Satu ruang untuk berdua"
                  text="Tambahkan rekening bersama, lalu catat perpindahan dana dari rekening pribadimu."
                  action={
                    <button
                      className="btn primary"
                      onClick={() => setDialog({ type: 'account', shared: true })}
                    >
                      Buat dompet bersama
                      <Plus size={16} />
                    </button>
                  }
                />
              )}
              <div className="section-title spaced">
                <h2>Mimpi kita</h2>
                <button className="text-btn" onClick={() => setDialog({ type: 'goal' })}>
                  Tujuan baru
                  <Plus size={14} />
                </button>
              </div>
              <div className="goals-grid">
                {store.goals
                  .filter((g) => store.accounts.find((a) => a.id === g.accountId)?.shared)
                  .map(goalCard)}
              </div>
              <section className="panel shared-history">
                <div className="panel-heading">
                  <h2>Perjalanan dana bersama</h2>
                  <ArrowLeftRight size={17} />
                </div>
                <TransactionList
                  store={store}
                  transactions={store.transactions
                    .filter((t) =>
                      store.accounts.some(
                        (a) => a.shared && (a.id === t.accountId || a.id === t.toId),
                      ),
                    )
                    .sort((a, c) => c.date.localeCompare(a.date))}
                  onSelect={(t) => setDialog({ type: 'detail', tx: t })}
                />
              </section>
            </>
          )}
          <footer className="page-footer">
            <span>
              <Logo small />
              Made for a little more peace of mind.
            </span>
            <span>
              <ShieldCheck size={12} />
              Disimpan lokal · Cadangkan secara berkala
            </span>
          </footer>
        </main>
      </div>
      <nav className="mobile-nav" aria-label="Navigasi mobile">
        {navItems.map((n) => (
          <button
            key={n.id}
            className={page === n.id ? 'active' : ''}
            onClick={() => {
              setPage(n.id);
              setSearch('');
            }}
          >
            <n.icon size={20} strokeWidth={page === n.id ? 2.2 : 1.6} />
            <span>{n.short}</span>
          </button>
        ))}
      </nav>
      {toast && (
        <div className="toast" role="status">
          <Check size={17} />
          <span>{toast}</span>
          <button aria-label="Tutup pesan" onClick={() => setToast('')}>
            <X size={15} />
          </button>
        </div>
      )}
      {dialog?.type === 'transaction' && (
        <Modal
          title="Catat langkah kecilmu."
          subtitle="Satu transaksi, satu gambaran yang lebih jelas."
          wide
          onClose={close}
        >
          <TransactionForm
            store={store}
            save={save}
            close={close}
            mode={dialog.mode}
            defaults={dialog.defaults}
            onAccount={() => setDialog({ type: 'account' })}
          />
        </Modal>
      )}
      {dialog?.type === 'account' && (
        <Modal
          title={dialog.shared ? 'Dompet untuk berdua.' : 'Kenalan dengan dompet baru.'}
          subtitle="Tambahkan catatan rekening, bukan koneksi bank."
          onClose={close}
        >
          <AccountForm store={store} save={save} close={close} shared={dialog.shared} />
        </Modal>
      )}
      {dialog?.type === 'goal' && (
        <Modal
          title="Ada mimpi yang ingin dicapai?"
          subtitle="Beri nama, tentukan target, dan mulai perlahan."
          onClose={close}
        >
          <GoalForm store={store} save={save} close={close} />
        </Modal>
      )}
      {dialog?.type === 'detail' && (
        <Modal title={dialog.tx.title} onClose={close}>
          <TransactionDetail
            transaction={dialog.tx}
            store={store}
            onDelete={() => {
              const t = dialog.tx;
              setDialog({
                type: 'confirm',
                title: 'Hapus catatan transaksi?',
                text: 'Transaksi dan bukti terkait akan dihapus dari skySave. Saldo tercatat akan dihitung ulang. Tindakan ini tidak memengaruhi rekening bank.',
                action: () => {
                  void removeTransaction(t);
                },
              });
            }}
          />
        </Modal>
      )}
      {dialog?.type === 'confirm' && (
        <Modal title={dialog.title} onClose={close}>
          <div className="confirmation">
            <p>{dialog.text}</p>
            <div>
              <button className="btn secondary" onClick={close}>
                Batal
              </button>
              <button className="btn primary" onClick={dialog.action}>
                Ya, lanjutkan
                <ArrowRight size={15} />
              </button>
            </div>
          </div>
        </Modal>
      )}
      {dialog?.type === 'settings' && (
        <Modal
          title="Ruangmu, aturanmu."
          subtitle="Kelola data dan kenyamanan skySave."
          onClose={close}
        >
          <SettingsPanel
            store={store}
            save={(s) => save(s, true)}
            startOwn={startOwn}
            notify={notify}
            recovery={!!recoveryError}
          />
        </Modal>
      )}
      {dialog?.type === 'notifications' && (
        <Modal
          title="A little money check-in."
          subtitle="Insight dari catatanmu, tanpa menebak penghasilan berikutnya."
          onClose={close}
        >
          <div className="insight-list">
            <div>
              <span className="insight-icon">
                <Sparkles size={20} />
              </span>
              <section>
                <h3>
                  {allocations(store).shortfall
                    ? 'Dahulukan kebutuhan wajib'
                    : 'Ada ruang untuk masa depan'}
                </h3>
                <p>
                  {allocations(store).shortfall
                    ? `Dana pribadi kurang ${money(allocations(store).shortfall)} dari cadangan kebutuhan yang kamu atur.`
                    : `${money(allocations(store).available)} dana pribadi tersisa setelah cadangan kebutuhan wajib. Atur alokasinya di Rencana uang.`}
                </p>
              </section>
            </div>
            <div>
              <span className="insight-icon">
                <ShieldCheck size={20} />
              </span>
              <section>
                <h3>Uangmu tetap dalam kendalimu</h3>
                <p>
                  Tidak ada koneksi ke bank. Periksa kecocokan saldo dengan rekening asli secara
                  berkala dan catat biaya admin atau bunga yang belum masuk.
                </p>
              </section>
            </div>
            <div>
              <span className="insight-icon">
                <HardDrive size={20} />
              </span>
              <section>
                <h3>Jangan lupa cadangan</h3>
                <p>
                  Data tersimpan pada browser ini. Unduh cadangan lewat Pengaturan sebelum berganti
                  perangkat atau membersihkan browser.
                </p>
              </section>
            </div>
          </div>
          <button
            className="btn primary full-width"
            onClick={() => {
              close();
              setPage('plan');
            }}
          >
            Lihat rencana uang
            <ArrowRight size={16} />
          </button>
        </Modal>
      )}
    </div>
  );
}

function PageHeading({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow: string;
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="page-heading">
      <div>
        <span className="eyebrow">{eyebrow}</span>
        <h1>{title}</h1>
        <p>{description}</p>
      </div>
      {action && <div className="heading-actions">{action}</div>}
    </div>
  );
}

function Overview({
  store,
  total,
  onAdd,
  onUpload,
  go,
  detail,
  accountCard,
  onAccount,
}: {
  store: Store;
  total: number;
  onAdd: () => void;
  onUpload: () => void;
  go: (p: Page) => void;
  detail: (t: Transaction) => void;
  accountCard: (a: Account) => ReactNode;
  onAccount: () => void;
}) {
  const [days, setDays] = useState(30);
  const [visible, setVisible] = useState(true);
  const tx = store.transactions.filter((t) => t.date >= daysAgo(days - 1) && t.date <= today());
  const summary = totals(tx);
  const allocation = allocations(store);
  const recent = [...store.transactions].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 5);
  return (
    <>
      <PageHeading
        eyebrow="A LITTLE CLARITY, EVERY DAY"
        title="Lebih tenang, lebih terencana."
        description="Kenali uangmu hari ini. Siapkan cerita baik untuk nanti."
        action={
          <>
            <button className="btn secondary" onClick={onUpload}>
              <ScanIcon />
              Unggah bukti
            </button>
            <button className="btn primary" onClick={onAdd}>
              <Plus size={17} />
              Catat transaksi
            </button>
          </>
        }
      />
      <div className="overview-period">
        <span>
          <span className="status-dot" />
          Your money, in balance.
        </span>
        <label>
          <CalendarDays size={13} />
          <select
            aria-label="Periode ringkasan"
            value={days}
            onChange={(e) => setDays(Number(e.target.value))}
          >
            <option value="30">30 hari terakhir</option>
            <option value="7">7 hari terakhir</option>
          </select>
          <ChevronDown size={12} />
        </label>
      </div>
      <div className="summary-grid">
        <section className="total-card">
          <div className="total-decoration" aria-hidden="true">
            <span />
            <span />
            <span />
          </div>
          <div className="total-card-top">
            <span>
              <Wallet size={15} />
              Total saldo tercatat
            </span>
            <button
              aria-label={visible ? 'Sembunyikan saldo' : 'Tampilkan saldo'}
              onClick={() => setVisible(!visible)}
            >
              <MoreHorizontal size={19} />
            </button>
          </div>
          <strong className="total-amount">{visible ? money(total) : 'Rp ••••••••'}</strong>
          <div className="total-card-bottom">
            <span>
              <span className="light-dot" />
              {store.accounts.length} dompet, satu cerita
            </span>
            <span className="total-mini-logo">
              <CloudIcon />
            </span>
          </div>
        </section>
        <section className="stat-card">
          <div className="stat-top">
            <span className="stat-icon income">
              <ArrowDownLeft size={19} />
            </span>
            <span>Pemasukan</span>
            <ArrowUpRight size={16} />
          </div>
          <strong>{money(summary.income)}</strong>
          <div className="stat-bottom">
            <span className="stat-tag income">
              {tx.filter((t) => t.kind === 'income').length} pemasukan
            </span>
            <span>Diterima {days} hari ini</span>
          </div>
          <div className="stat-spark income" aria-hidden="true">
            <svg viewBox="0 0 130 36">
              <path d="M0 30 L15 26 L28 29 L44 17 L59 22 L75 12 L90 17 L107 5 L120 9 L130 1" />
            </svg>
          </div>
        </section>
        <section className="stat-card">
          <div className="stat-top">
            <span className="stat-icon expense">
              <ArrowUpRight size={19} />
            </span>
            <span>Pengeluaran</span>
            <ArrowUpRight size={16} />
          </div>
          <strong>{money(summary.expense)}</strong>
          <div className="stat-bottom">
            <span className="stat-tag expense">
              {tx.filter((t) => t.kind === 'expense').length} pengeluaran
            </span>
            <span>Termasuk biaya admin</span>
          </div>
          <div className="stat-spark expense" aria-hidden="true">
            <svg viewBox="0 0 130 36">
              <path d="M0 29 L15 24 L28 28 L44 20 L59 25 L75 10 L90 16 L107 9 L120 12 L130 3" />
            </svg>
          </div>
        </section>
      </div>
      <div className="middle-grid">
        <section className="panel balance-panel">
          <div className="panel-heading">
            <div>
              <h2>Perjalanan saldomu</h2>
              <p>Langkah kecil yang membentuk gambaran besar.</p>
            </div>
            <span className="chart-legend">
              <i />
              Total saldo
            </span>
          </div>
          <BalanceChart store={store} days={days} />
        </section>
        <section className="smart-card">
          <div className="smart-card-top">
            <span className="smart-icon">
              <Sparkles size={17} />
            </span>
            <span>SKY INSIGHT</span>
            <span className="ai-badge">FOR YOU</span>
          </div>
          <h2>
            Setiap rupiah
            <br />
            punya tujuan.
          </h2>
          <p>
            {allocation.shortfall
              ? 'Tenang, mulai dari kebutuhan wajib. Kita atur langkah berikutnya bersama.'
              : 'Pemasukan boleh berubah. Rencana baik tetap bisa dibuat.'}
          </p>
          <div className="smart-amount">
            <small>
              {allocation.shortfall ? 'Kekurangan cadangan wajib' : 'Dana yang bisa kamu atur'}
            </small>
            <strong>{money(allocation.shortfall || allocation.available)}</strong>
          </div>
          <button onClick={() => go('plan')}>
            Atur rencana uangmu
            <ArrowUpRight size={17} />
          </button>
          <svg
            className="smart-card-flower"
            aria-hidden="true"
            width="180"
            height="180"
            viewBox="0 0 180 180"
          >
            <g stroke="currentColor" strokeWidth="19" strokeLinecap="round">
              <path d="M90 23v134M23 90h134M43 43l94 94M43 137l94-94" />
            </g>
          </svg>
        </section>
      </div>
      <section className="wallets-section">
        <div className="section-title">
          <h2>
            Dompet kamu<span className="count-badge">{store.accounts.length}</span>
          </h2>
          <button className="text-btn" onClick={() => go('accounts')}>
            Lihat semua
            <ArrowRight size={14} />
          </button>
        </div>
        {store.accounts.length ? (
          <div className="wallet-strip">
            {store.accounts
              .filter((a) => !a.shared)
              .slice(0, 4)
              .map((a) => accountCard(a))}
            <button
              className="add-wallet compact-add"
              aria-label="Tambah dompet"
              onClick={onAccount}
            >
              <Plus size={21} />
            </button>
          </div>
        ) : (
          <EmptyState
            title="Selamat datang di ruang barumu"
            text="Tambahkan rekening pertama untuk mulai mengenali keuanganmu."
            action={
              <button className="btn primary" onClick={onAccount}>
                <Plus size={16} />
                Tambah dompet
              </button>
            }
          />
        )}
      </section>
      <div className="bottom-grid">
        <section className="panel recent-panel">
          <div className="panel-heading">
            <div>
              <h2>Jejak transaksi</h2>
              <p>Setiap cerita uang, tercatat rapi.</p>
            </div>
            <button className="text-btn" onClick={() => go('transactions')}>
              Lihat semua
              <ArrowRight size={13} />
            </button>
          </div>
          <TransactionList store={store} transactions={recent} onSelect={detail} compact />
        </section>
        <section className="panel spending-panel">
          <div className="panel-heading">
            <h2>Uangnya ke mana?</h2>
            <span className="muted-label">{days} hari</span>
          </div>
          <SpendingDonut entries={spendingByCategory(tx, '')} />
        </section>
      </div>
      <div className="daily-note">
        <span>✧</span>
        <p>“Menabung bukan tentang seberapa banyak. Tapi tentang mulai, dan terus melangkah.”</p>
        <span className="daily-note-label">A GENTLE REMINDER</span>
      </div>
    </>
  );
}
function ScanIcon() {
  return <UploadCloud size={17} strokeWidth={1.7} />;
}
function CloudIcon() {
  return (
    <svg width="32" height="22" viewBox="0 0 32 22" fill="none" aria-hidden="true">
      <path
        d="M7 18a5 5 0 0 1-1-10 9 9 0 0 1 17-1 6 6 0 1 1 1 11H7Z"
        stroke="currentColor"
        strokeWidth="1.3"
      />
      <path d="M12 13h8m-4-4v8" stroke="currentColor" strokeWidth="1.3" />
    </svg>
  );
}

function Transactions({
  store,
  search,
  setSearch,
  detail,
  onAdd,
  onUpload,
}: {
  store: Store;
  search: string;
  setSearch: (v: string) => void;
  detail: (t: Transaction) => void;
  onAdd: () => void;
  onUpload: () => void;
}) {
  const [kind, setKind] = useState('all');
  const [month, setMonth] = useState('');
  const [account, setAccount] = useState('');
  const isAccountSearch = store.accounts.some((a) => a.id === search);
  const filtered = store.transactions
    .filter((t) => {
      const a = store.accounts.find((a) => a.id === t.accountId);
      const to = store.accounts.find((a) => a.id === t.toId);
      return (
        (kind === 'all' || t.kind === kind) &&
        (!month || t.date.startsWith(month)) &&
        (!account || t.accountId === account || t.toId === account) &&
        (isAccountSearch
          ? t.accountId === search || t.toId === search
          : `${t.title} ${t.category} ${t.source} ${t.note} ${t.reference ?? ''} ${a?.provider} ${a?.name} ${to?.name ?? ''}`
              .toLowerCase()
              .includes(search.toLowerCase()))
      );
    })
    .sort((a, b) => b.date.localeCompare(a.date));
  const sum = totals(filtered);
  return (
    <>
      <PageHeading
        eyebrow="YOUR MONEY, YOUR STORY"
        title="Semua jejak, satu cerita."
        description="Pemasukan, pengeluaran, dan perpindahan dana yang tercatat."
        action={
          <>
            <button className="btn secondary" onClick={onUpload}>
              <ScanIcon />
              Unggah bukti
            </button>
            <button className="btn primary" onClick={onAdd}>
              <Plus size={17} />
              Catat transaksi
            </button>
          </>
        }
      />
      <div className="transaction-summary">
        <div>
          <span>Pemasukan terfilter</span>
          <strong className="positive">+{money(sum.income)}</strong>
        </div>
        <div>
          <span>Pengeluaran terfilter</span>
          <strong>{money(sum.expense)}</strong>
        </div>
        <div>
          <span>Transaksi ditemukan</span>
          <strong>
            {filtered.length}
            <small> transaksi</small>
          </strong>
        </div>
      </div>
      <section className="panel ledger-panel">
        <div className="ledger-tools">
          <div className="search-field">
            <Search size={17} />
            <input
              id="transaction-search"
              aria-label="Cari nama, kategori, atau sumber transaksi"
              placeholder="Cari cerita uangmu…"
              value={isAccountSearch ? '' : search}
              onChange={(e) => setSearch(e.target.value)}
            />
            {search && (
              <button aria-label="Hapus pencarian" onClick={() => setSearch('')}>
                <X size={15} />
              </button>
            )}
          </div>
          <button
            className="btn secondary small-btn"
            onClick={() =>
              download(
                csv(filtered, store.accounts),
                'text/csv;charset=utf-8',
                `skysave-transaksi-${today()}.csv`,
              )
            }
          >
            <Download size={15} />
            Ekspor CSV
          </button>
        </div>
        <div className="ledger-filters">
          <div className="filter-tabs">
            {[
              ['all', 'Semua'],
              ['expense', 'Pengeluaran'],
              ['income', 'Pemasukan'],
              ['transfer', 'Transfer'],
            ].map(([value, label]) => (
              <button
                key={value}
                className={kind === value ? 'active' : ''}
                onClick={() => setKind(value)}
              >
                {label}
              </button>
            ))}
          </div>
          <div className="filter-inputs">
            <label>
              <SlidersHorizontal size={14} />
              <select
                aria-label="Filter rekening"
                value={isAccountSearch ? search : account}
                onChange={(e) => {
                  setAccount(e.target.value);
                  if (isAccountSearch) setSearch('');
                }}
              >
                <option value="">Semua rekening</option>
                {store.accounts.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.provider} · {a.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <CalendarDays size={14} />
              <input
                aria-label="Filter bulan"
                type="month"
                value={month}
                max={today().slice(0, 7)}
                onChange={(e) => setMonth(e.target.value)}
              />
              {month && (
                <button aria-label="Hapus filter bulan" onClick={() => setMonth('')}>
                  <X size={12} />
                </button>
              )}
            </label>
          </div>
        </div>
        <TransactionList store={store} transactions={filtered} onSelect={detail} />
        <div className="ledger-footer">
          <span>{filtered.length} transaksi · Nominal dalam rupiah</span>
          <span>
            <ShieldCheck size={12} />
            Transfer antar akun tidak menambah pengeluaran.
          </span>
        </div>
      </section>
    </>
  );
}

function Planning({
  store,
  save,
  goals,
  onGoal,
  onTransfer,
}: {
  store: Store;
  save: (s: Store) => boolean;
  goals: ReactNode[];
  onGoal: () => void;
  onTransfer: (id: string, amount?: number) => void;
}) {
  const [plan, setPlan] = useState<Plan>(store.plan);
  const [reserve, setReserve] = useState(String(store.plan.reserve));
  const [error, setError] = useState('');
  const changed =
    JSON.stringify({ ...plan, reserve: Number(reserve) }) !== JSON.stringify(store.plan);
  const preview = allocations({ ...store, plan: { ...plan, reserve: Number(reserve) || 0 } });
  function percent(key: 'saving' | 'fun' | 'together', value: number) {
    const rest = (['saving', 'fun', 'together'] as const).filter((k) => k !== key);
    const prior = plan[rest[0]] + plan[rest[1]];
    const first = Math.round((100 - value) * (prior ? plan[rest[0]] / prior : 0.5));
    setPlan({ ...plan, [key]: value, [rest[0]]: first, [rest[1]]: 100 - value - first });
  }
  function submit(e: FormEvent) {
    e.preventDefault();
    if (!Number.isSafeInteger(Number(reserve)) || Number(reserve) < 0 || Number(reserve) > 1e12) {
      setError('Cadangan kebutuhan harus berupa rupiah utuh yang valid.');
      return;
    }
    setError('');
    save({ ...store, plan: { ...plan, reserve: Number(reserve) } });
  }
  const rows = [
    {
      key: 'saving' as const,
      name: 'Untuk future you',
      subtitle: 'Tabungan & dana darurat',
      icon: PiggyBank,
      color: '#24765d',
      amount: preview.saving,
      account: store.accounts.find(
        (a) => !a.shared && store.goals.some((g) => g.accountId === a.id),
      ),
    },
    {
      key: 'fun' as const,
      name: 'Enjoy a little',
      subtitle: 'Jajan, hiburan, hal yang kamu suka',
      icon: Coffee,
      color: '#ba8554',
      amount: preview.fun,
      account: undefined,
    },
    {
      key: 'together' as const,
      name: 'A little for us',
      subtitle: 'Alokasi ke akun bersama',
      icon: Heart,
      color: '#a1819b',
      amount: preview.together,
      account: store.accounts.find((a) => a.shared),
    },
  ];
  return (
    <>
      <PageHeading
        eyebrow="MAKE ROOM FOR WHAT MATTERS"
        title="Pemasukan berubah. Tujuan tetap."
        description="Rencana fleksibel dari uang yang sudah ada, bukan penghasilan yang belum pasti."
        action={
          <button className="btn secondary" onClick={onGoal}>
            <Target size={17} />
            Tujuan baru
          </button>
        }
      />
      <div className="planning-layout">
        <form className="panel plan-editor" onSubmit={submit}>
          <div className="panel-heading">
            <div>
              <h2>Bagi dengan lebih mindful.</h2>
              <p>Atur prioritasmu. Kita bantu hitung sisanya.</p>
            </div>
            <Sparkles size={20} />
          </div>
          <div className="reserve-field">
            <label htmlFor="reserve">Kebutuhan wajib yang belum dibayar</label>
            <p>
              Sisihkan untuk tagihan dan kebutuhan mendatang. Jangan masukkan pengeluaran yang sudah
              dicatat.
            </p>
            <div className="currency-input">
              <span>Rp</span>
              <input
                id="reserve"
                type="number"
                min="0"
                max="1000000000000"
                step="1"
                inputMode="numeric"
                required
                value={reserve}
                onChange={(e) => setReserve(e.target.value)}
              />
            </div>
          </div>
          <div className="available-strip">
            <span>Dana pribadi yang bisa dialokasikan</span>
            <strong>{money(preview.available)}</strong>
          </div>
          {rows.map((row) => (
            <div className="allocation-row" key={row.key}>
              <div className="allocation-heading">
                <span
                  className="allocation-icon"
                  style={{ color: row.color, background: `${row.color}13` }}
                >
                  <row.icon size={22} strokeWidth={1.6} />
                </span>
                <div>
                  <h3>{row.name}</h3>
                  <p>{row.subtitle}</p>
                </div>
                <strong>
                  {plan[row.key]}
                  <small>%</small>
                </strong>
              </div>
              <input
                className="allocation-slider"
                aria-label={`Persentase ${row.name}`}
                type="range"
                min="0"
                max="100"
                step="1"
                value={plan[row.key]}
                onChange={(e) => percent(row.key, Number(e.target.value))}
                style={{ accentColor: row.color }}
              />
              <div className="allocation-footer">
                <span>
                  {row.account
                    ? `Saran tempat: ${row.account.provider} · ${row.account.name}`
                    : row.key === 'fun'
                      ? 'Batas rencana, bukan pengeluaran otomatis'
                      : 'Pilih dompet khusus sesuai tujuanmu'}
                </span>
                <strong>{money(row.amount)}</strong>
              </div>
              {row.account && row.amount > 0 && (
                <button
                  type="button"
                  className="text-btn allocation-transfer"
                  onClick={() => {
                    if (changed) {
                      setError('Simpan rencana terlebih dahulu sebelum mencatat perpindahan dana.');
                      return;
                    }
                    onTransfer(row.account!.id, row.amount);
                  }}
                >
                  Catat perpindahan
                  <ArrowUpRight size={13} />
                </button>
              )}
            </div>
          ))}
          {error && (
            <p className="form-error" role="alert">
              {error}
            </p>
          )}
          <div className="plan-save">
            <span>
              <Check size={14} />
              Total alokasi {plan.saving + plan.fun + plan.together}%
            </span>
            <button className="btn primary" type="submit" disabled={!changed}>
              Simpan rencana
              <Check size={16} />
            </button>
          </div>
        </form>
        <aside className="plan-explanation">
          <div className="panel calculation-card">
            <span className="soft-icon">
              <TrendingUp size={23} />
            </span>
            <h2>Kenali ruang gerakmu.</h2>
            <p>Uang bersama sudah dipisahkan, supaya rencana pribadi tetap realistis.</p>
            <dl>
              <div>
                <dt>Saldo pribadi</dt>
                <dd>{money(preview.personal)}</dd>
              </div>
              <div>
                <dt>Cadangan wajib</dt>
                <dd>−{money(Number(reserve) || 0)}</dd>
              </div>
              <div className="calc-total">
                <dt>Siap dialokasikan</dt>
                <dd>{money(preview.available)}</dd>
              </div>
            </dl>
            {preview.shortfall > 0 && (
              <div className="form-error">
                Dana belum cukup untuk cadangan wajib. Kekurangan {money(preview.shortfall)}.
                Dahulukan kebutuhan ini sebelum belanja opsional.
              </div>
            )}
            <div className="info-note">
              <Info size={16} />
              <span>
                Persentase dihitung dari dana yang tersisa setelah cadangan wajib. Ini rencana atas
                saldo saat ini, bukan proyeksi pemasukan bulanan.
              </span>
            </div>
          </div>
          <div className="gentle-card">
            <Leaf size={25} strokeWidth={1.4} />
            <h3>Kamu yang pegang kendali.</h3>
            <p>
              Saran penempatan memakai dompet milikmu, tanpa menjanjikan bunga atau hasil. Rencana
              tidak mengunci atau memindahkan uang. Transfer nyata tetap kamu lakukan sendiri.
            </p>
          </div>
        </aside>
      </div>
      <div className="section-title spaced">
        <h2>Little goals, big meaning.</h2>
        <button className="text-btn" onClick={onGoal}>
          Tambah tujuan
          <Plus size={15} />
        </button>
      </div>
      {goals.length ? (
        <div className="goals-grid">{goals}</div>
      ) : (
        <EmptyState
          icon={<Target size={28} />}
          title="Apa yang ingin kamu wujudkan?"
          text="Mulai dari dana darurat, laptop baru, atau liburan. Satu dompet khusus untuk satu tujuan."
          action={
            <button className="btn primary" onClick={onGoal}>
              Buat tujuan pertama
              <Plus size={15} />
            </button>
          }
        />
      )}
    </>
  );
}

type ReceiptBackup = { id: string; type: string; data: string };
function SettingsPanel({
  store,
  save,
  startOwn,
  notify,
  recovery,
}: {
  store: Store;
  save: (s: Store) => boolean;
  startOwn: () => void;
  notify: (s: string) => void;
  recovery: boolean;
}) {
  const [busy, setBusy] = useState(false);
  const [imported, setImported] = useState<{ data: Store; receipts: ReceiptBackup[] } | null>(null);
  const [error, setError] = useState('');
  const [missing, setMissing] = useState(0);
  async function backup() {
    setBusy(true);
    setError('');
    try {
      if (recovery) {
        download(
          localStorage.getItem(STORAGE_KEY) ?? '',
          'application/json',
          `skysave-pemulihan-${today()}.json`,
        );
        return;
      }
      const receipts: ReceiptBackup[] = [];
      let absent = 0;
      for (const t of store.transactions)
        if (t.receiptId) {
          const blob = await readReceipt(t.receiptId);
          if (blob) {
            const base64 = await new Promise<string>((resolve, reject) => {
              const reader = new FileReader();
              reader.onload = () => resolve((reader.result as string).split(',')[1]);
              reader.onerror = () => reject(Error('Bukti gagal dicadangkan.'));
              reader.readAsDataURL(blob);
            });
            receipts.push({ id: t.receiptId, type: blob.type, data: base64 });
          } else absent++;
        }
      download(
        JSON.stringify(
          {
            format: 'skysave-backup',
            version: 1,
            exportedAt: new Date().toISOString(),
            data: store,
            receipts,
          },
          null,
          2,
        ),
        'application/json',
        `skysave-cadangan-${today()}.json`,
      );
      notify(
        absent
          ? `Cadangan diunduh. ${absent} bukti tidak ditemukan pada perangkat ini.`
          : 'Cadangan lengkap dengan bukti berhasil diunduh. Simpan di tempat yang aman.',
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Cadangan belum berhasil dibuat.');
    } finally {
      setBusy(false);
    }
  }
  async function selectImport(file: File) {
    setError('');
    setImported(null);
    try {
      if (file.size > 70 * 1024 * 1024) throw Error('Maksimal ukuran cadangan 70 MB.');
      const archive = JSON.parse(await file.text());
      if (
        archive.format !== 'skysave-backup' ||
        archive.version !== 1 ||
        !isStore(archive.data) ||
        !Array.isArray(archive.receipts)
      )
        throw Error('Berkas bukan cadangan skySave yang valid.');
      const receiptIds = new Set(
        archive.data.transactions.map((t: Transaction) => t.receiptId).filter(Boolean),
      );
      const seen = new Set();
      for (const r of archive.receipts) {
        if (
          !r ||
          typeof r.id !== 'string' ||
          !receiptIds.has(r.id) ||
          seen.has(r.id) ||
          !['image/png', 'image/jpeg', 'image/webp', 'application/pdf'].includes(r.type) ||
          typeof r.data !== 'string' ||
          r.data.length > 14 * 1024 * 1024 ||
          !/^[A-Za-z0-9+/]*={0,2}$/.test(r.data)
        )
          throw Error('Lampiran dalam cadangan tidak valid.');
        seen.add(r.id);
      }
      setMissing(receiptIds.size - seen.size);
      setImported(archive);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Cadangan tidak dapat dibaca.');
    }
  }
  async function restore() {
    if (!imported) return;
    setBusy(true);
    setError('');
    const created: string[] = [];
    let committed = false;
    try {
      // Use fresh IDs so a failed localStorage write cannot replace an existing receipt.
      const receiptMap = new Map<string, string>();
      for (const r of imported.receipts) {
        const id = crypto.randomUUID();
        receiptMap.set(r.id, id);
        const bytes = Uint8Array.from(atob(r.data), (c) => c.charCodeAt(0));
        await saveReceipt(id, new Blob([bytes], { type: r.type }));
        created.push(id);
      }
      const next = {
        ...imported.data,
        transactions: imported.data.transactions.map((t) => ({
          ...t,
          receiptId: t.receiptId ? (receiptMap.get(t.receiptId) ?? crypto.randomUUID()) : undefined,
        })),
      };
      if (save(next)) {
        committed = true;
        setImported(null);
        notify('Cadangan dipulihkan. Saldo dihitung kembali dari catatanmu.');
        for (const t of store.transactions) if (t.receiptId) await deleteReceipt(t.receiptId);
      }
    } catch (e) {
      setError(
        committed
          ? 'Cadangan sudah dipulihkan, tetapi sebagian bukti lama belum berhasil dibersihkan.'
          : e instanceof Error
            ? e.message
            : 'Cadangan belum berhasil dipulihkan. Data lama tetap tersedia.',
      );
    } finally {
      if (!committed) await Promise.allSettled(created.map((id) => deleteReceipt(id)));
      setBusy(false);
    }
  }
  return (
    <div className="settings-content">
      <div className="settings-privacy">
        <ShieldCheck size={25} />
        <div>
          <h3>Private by design.</h3>
          <p>
            Tanpa koneksi bank dan tanpa server penyimpan data. Catatan serta bukti berada pada
            browser ini. Belum ada sinkronisasi antarperangkat atau login keluarga.
          </p>
        </div>
      </div>
      <div className="settings-section">
        <h3>Data & cadangan</h3>
        <p>
          Data bisa hilang jika browser dibersihkan. Cadangan berisi informasi keuangan dan bukti;
          simpan secara pribadi.
        </p>
        <button
          className="settings-action"
          onClick={() => {
            void backup();
          }}
          disabled={busy}
        >
          <Download size={19} />
          <span>
            <strong>{recovery ? 'Unduh data untuk pemulihan' : 'Unduh cadangan lengkap'}</strong>
            <small>Rekening, transaksi, rencana, tujuan, dan bukti</small>
          </span>
          {busy ? <LoaderCircle className="spin" size={16} /> : <ChevronRight size={16} />}
        </button>
        <label className={`settings-action file-action ${busy ? 'disabled' : ''}`}>
          <input
            type="file"
            accept="application/json,.json"
            disabled={busy}
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void selectImport(f);
              e.target.value = '';
            }}
          />
          <RefreshCw size={19} />
          <span>
            <strong>Pulihkan dari cadangan</strong>
            <small>Pilih berkas JSON ekspor skySave</small>
          </span>
          <ChevronRight size={16} />
        </label>
        {imported && (
          <div className="import-confirm">
            <strong>
              Pulihkan {imported.data.transactions.length} transaksi dan{' '}
              {imported.data.accounts.length} rekening?
            </strong>
            <p>
              Ini mengganti catatan saat ini. Unduh cadangan data sekarang terlebih dahulu.
              {missing > 0 ? ` ${missing} bukti asli tidak tersedia dalam cadangan ini.` : ''}
            </p>
            <div>
              <button
                className="btn secondary small-btn"
                disabled={busy}
                onClick={() => setImported(null)}
              >
                Batal
              </button>
              <button
                className="btn primary small-btn"
                disabled={busy}
                onClick={() => {
                  void restore();
                }}
              >
                Ganti & pulihkan
              </button>
            </div>
          </div>
        )}
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
      </div>
      <div className="settings-section">
        <h3>skySave di iPhone</h3>
        <div className="iphone-tip">
          <Smartphone size={30} strokeWidth={1.5} />
          <p>
            Buka melalui Safari pada alamat HTTPS aplikasi yang sudah diterbitkan. Pilih{' '}
            <strong>Bagikan → Tambah ke Layar Utama</strong>. Membuka aplikasi di perangkat lain
            belum menyinkronkan data.
          </p>
        </div>
      </div>
      <div className="settings-section">
        <h3>Ruang baru</h3>
        <button className="settings-action reset-action" disabled={busy} onClick={startOwn}>
          <Trash2 size={18} />
          <span>
            <strong>
              {store.demo ? 'Mulai dengan data sendiri' : 'Hapus data dan mulai ulang'}
            </strong>
            <small>Memerlukan konfirmasi. Cadangkan terlebih dahulu.</small>
          </span>
          <ChevronRight size={16} />
        </button>
      </div>
      <div className="settings-version">
        <Logo />
        <span>v0.1 · Made for your peace of mind.</span>
      </div>
    </div>
  );
}
