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
  ChevronDown,
  ChevronRight,
  Search,
  Bell,
  Settings,
  ShieldCheck,
  ArrowRight,
  Leaf,
  Download,
  X,
  Check,
  Info,
  Target,
  TrendingUp,
  Coffee,
  PiggyBank,
  FileChartColumn,
  Sun,
  Moon,
  Monitor,
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
  allocations,
} from './domain';
import { Logo, ProviderMark, TransactionList, EmptyState, Modal } from './ui';
import { TransactionForm, AccountForm, GoalForm, TransactionDetail } from './forms';
import TransactionsPage from './TransactionsPage';
import Overview from './Dashboard';
import Reports from './Reports';
import WalletPage, { WalletExample, WalletNavigation, WalletStatusBar } from './WalletPage';
import { MoneyAmount } from './MoneyAmount';
import { readInsightPreferences, PREFERENCES_KEY } from './preferences';
import type { InsightPreferences } from './preferences';
import { clearReceipts, deleteReceipt, readReceipt, saveReceipt } from './receipts';

type Page = 'overview' | 'accounts' | 'transactions' | 'plan' | 'together' | 'reports' | 'settings';
type Dialog =
  | {
      type: 'transaction';
      mode?: 'manual' | 'receipt';
      defaults?: Partial<Transaction>;
      editingId?: string;
    }
  | { type: 'account'; shared?: boolean }
  | { type: 'goal' }
  | { type: 'wallet-example' }
  | { type: 'detail'; tx: Transaction }
  | { type: 'confirm'; title: string; text: string; action: () => void }
  | { type: 'notifications' }
  | null;
const primaryNavItems = [
  { id: 'overview' as const, label: 'Ringkasan', short: 'Beranda', icon: LayoutDashboard },
  { id: 'accounts' as const, label: 'Dompet saya', short: 'Dompet', icon: Wallet },
  { id: 'transactions' as const, label: 'Transaksi', short: 'Transaksi', icon: ArrowLeftRight },
  { id: 'reports' as const, label: 'Laporan', short: 'Laporan', icon: FileChartColumn },
  { id: 'settings' as const, label: 'Pengaturan', short: 'Setelan', icon: Settings },
];
const navItems = [
  ...primaryNavItems,
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
  const [preferences, setPreferences] = useState(readInsightPreferences);
  function changePreferences(value: InsightPreferences) {
    try {
      localStorage.setItem(PREFERENCES_KEY, JSON.stringify(value));
      setPreferences(value);
    } catch {
      notify('Preferensi belum tersimpan. Periksa penyimpanan browser.');
    }
  }
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
      notify('Perubahan tersimpan.');
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
        : 'Semua catatan, rencana, tujuan, dan bukti tersimpan akan dihapus dari SkyWallet pada browser ini. Unduh cadangan lengkap terlebih dahulu. Tindakan ini tidak bisa dibatalkan.',
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
  function askDelete(t: Transaction) {
    setDialog({
      type: 'confirm',
      title: 'Hapus catatan transaksi?',
      text: 'Transaksi dan bukti terkait akan dihapus dari SkyWallet. Saldo tercatat akan dihitung ulang. Tindakan ini tidak memengaruhi rekening bank.',
      action: () => {
        void removeTransaction(t);
      },
    });
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
          <strong>
            <MoneyAmount value={current} />
          </strong>
          <span>
            dari <MoneyAmount value={g.target} />
          </span>
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
        <strong>
          <MoneyAmount value={b[a.id]} />
        </strong>
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
    <div className="app-shell" data-page={page}>
      <aside className="sidebar">
        <a
          href="#"
          className="brand-link"
          aria-label="SkyWallet beranda"
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
          <button className="nav-item settings-nav" onClick={() => setPage('settings')}>
            <Settings size={19} strokeWidth={1.7} />
            Pengaturan
          </button>
          <button className="profile" onClick={() => setPage('settings')}>
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
        {page === 'accounts' && <WalletStatusBar />}
        <header className="topbar">
          <div className="topbar-breadcrumb">
            <span className="breadcrumb-mark">
              <LayoutDashboard size={14} />
            </span>
            Ruang pribadi<span>/</span>
            <strong>{navItems.find((n) => n.id === page)?.label}</strong>
          </div>
          <div className="topbar-actions">
            <button className="local-badge" onClick={() => setPage('settings')}>
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
              onClick={() => setPage('settings')}
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
              <button className="text-btn" onClick={() => setPage('settings')}>
                Buka pengaturan
                <ArrowRight size={14} />
              </button>
            </div>
          )}
          {(page === 'plan' || page === 'together') && (
            <button className="secondary-page-back" onClick={() => setPage('accounts')}>
              <ChevronRight size={17} />
              <span>Kembali ke dompet</span>
            </button>
          )}
          {page === 'overview' && (
            <Overview
              store={store}
              total={total}
              onUpload={() => setDialog({ type: 'transaction', mode: 'receipt' })}
              go={setPage}
              detail={(t) => setDialog({ type: 'detail', tx: t })}
              accountCard={accountCard}
              onAccount={() => setDialog({ type: 'account' })}
              onReport={() => setPage('reports')}
              onStartOwn={startOwn}
              preferences={preferences}
            />
          )}
          {page === 'accounts' && (
            <WalletPage
              store={store}
              onAdd={(shared) => setDialog({ type: 'account', shared })}
              onPlan={() => setPage('plan')}
              onTogether={() => setPage('together')}
              onExample={() => setDialog({ type: 'wallet-example' })}
              accountCard={accountCard}
            />
          )}
          {page === 'transactions' && (
            <TransactionsPage
              store={store}
              search={search}
              setSearch={setSearch}
              detail={(t) => setDialog({ type: 'detail', tx: t })}
              onUpload={() => setDialog({ type: 'transaction', mode: 'receipt' })}
              onEdit={(tx) => setDialog({ type: 'transaction', defaults: tx, editingId: tx.id })}
              onDelete={askDelete}
              onReport={() => setPage('reports')}
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
                title="Ruang bersama"
                description="Saldo dan tujuan akun bersama."
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
                <div className="together-total">
                  <small>Total dana bersama</small>
                  <strong>
                    <MoneyAmount
                      value={store.accounts
                        .filter((a) => a.shared)
                        .reduce((sum, a) => sum + b[a.id], 0)}
                    />
                  </strong>
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
          {page === 'reports' && (
            <section className="reports-page">
              <PageHeading
                eyebrow=""
                title="Laporan"
                description="Ringkasan keuangan yang bisa kamu simpan."
              />
              <Reports store={store} />
            </section>
          )}
          {page === 'settings' && (
            <section className="settings-page">
              <PageHeading
                eyebrow=""
                title="Pengaturan"
                description="Tampilan dan preferensi aplikasi."
              />
              <SettingsPanel
                store={store}
                save={(s) => save(s, true)}
                startOwn={startOwn}
                notify={notify}
                recovery={!!recoveryError}
                preferences={preferences}
                onPreferences={changePreferences}
              />
            </section>
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
      {page === 'accounts' && (
        <WalletNavigation
          go={(next) => {
            setPage(next);
            setSearch('');
          }}
          onUpload={() => setDialog({ type: 'transaction', mode: 'receipt' })}
        />
      )}
      <nav className="mobile-nav" aria-label="Navigasi mobile">
        {primaryNavItems.map((n) => (
          <button
            key={n.id}
            aria-label={n.label}
            aria-current={page === n.id ? 'page' : undefined}
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
      {dialog?.type === 'wallet-example' && (
        <Modal title="Contoh detail dompet" onClose={close}>
          <WalletExample />
        </Modal>
      )}
      {dialog?.type === 'transaction' && (
        <Modal title={dialog.editingId ? 'Ubah transaksi' : 'Catat transaksi'} wide onClose={close}>
          <TransactionForm
            key={dialog.editingId ?? 'new'}
            editingId={dialog.editingId}
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
          title={dialog.shared ? 'Tambah akun bersama' : 'Tambah dompet'}
          subtitle="Tambahkan catatan rekening, bukan koneksi bank."
          onClose={close}
        >
          <AccountForm store={store} save={save} close={close} shared={dialog.shared} />
        </Modal>
      )}
      {dialog?.type === 'goal' && (
        <Modal
          title="Tujuan tabungan"
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
            onEdit={() =>
              setDialog({ type: 'transaction', defaults: dialog.tx, editingId: dialog.tx.id })
            }
            onDelete={() => {
              const t = dialog.tx;
              setDialog({
                type: 'confirm',
                title: 'Hapus catatan transaksi?',
                text: 'Transaksi dan bukti terkait akan dihapus dari SkyWallet. Saldo tercatat akan dihitung ulang. Tindakan ini tidak memengaruhi rekening bank.',
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
      {dialog?.type === 'notifications' && (
        <Modal
          title="Ringkasan keuangan"
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
      name: 'Tabungan',
      subtitle: 'Tabungan & dana darurat',
      icon: PiggyBank,
      color: '#53aa8d',
      amount: preview.saving,
      account: store.accounts.find(
        (a) => !a.shared && store.goals.some((g) => g.accountId === a.id),
      ),
    },
    {
      key: 'fun' as const,
      name: 'Pribadi',
      subtitle: 'Jajan, hiburan, hal yang kamu suka',
      icon: Coffee,
      color: '#d4a05c',
      amount: preview.fun,
      account: undefined,
    },
    {
      key: 'together' as const,
      name: 'Akun bersama',
      subtitle: 'Alokasi ke akun bersama',
      icon: Heart,
      color: '#9694bf',
      amount: preview.together,
      account: store.accounts.find((a) => a.shared),
    },
  ];
  return (
    <>
      <PageHeading
        eyebrow="MAKE ROOM FOR WHAT MATTERS"
        title="Rencana uang"
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
              <h2>Alokasi dana</h2>
              <p>Atur pembagian setelah cadangan wajib.</p>
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
            <strong>
              <MoneyAmount value={preview.available} />
            </strong>
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
                <strong>
                  <MoneyAmount value={row.amount} />
                </strong>
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
                <dd>
                  <MoneyAmount value={preview.personal} />
                </dd>
              </div>
              <div>
                <dt>Cadangan wajib</dt>
                <dd>
                  <MoneyAmount value={-(Number(reserve) || 0)} />
                </dd>
              </div>
              <div className="calc-total">
                <dt>Siap dialokasikan</dt>
                <dd>
                  <MoneyAmount value={preview.available} />
                </dd>
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
        <h2>Tujuan tabungan</h2>
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
  preferences,
  onPreferences,
}: {
  store: Store;
  save: (s: Store) => boolean;
  startOwn: () => void;
  notify: (s: string) => void;
  recovery: boolean;
  preferences: InsightPreferences;
  onPreferences: (value: InsightPreferences) => void;
}) {
  const [theme, setTheme] = useState(document.documentElement.dataset.theme ?? 'light');
  function chooseTheme(value: string) {
    setTheme(value);
    document.documentElement.dataset.theme = value;
    try {
      localStorage.setItem('skysave.theme', value);
    } catch {
      notify('Tema diterapkan untuk sesi ini. Preferensi belum bisa disimpan.');
    }
  }
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
          `skywallet-pemulihan-${today()}.json`,
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
            format: 'skywallet-backup',
            version: 1,
            exportedAt: new Date().toISOString(),
            data: store,
            receipts,
          },
          null,
          2,
        ),
        'application/json',
        `skywallet-cadangan-${today()}.json`,
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
        !['skywallet-backup', 'skysave-backup'].includes(archive.format) ||
        archive.version !== 1 ||
        !isStore(archive.data) ||
        !Array.isArray(archive.receipts)
      )
        throw Error('Berkas bukan cadangan SkyWallet yang valid.');
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
      <section className="settings-local-profile">
        <span>S</span>
        <div>
          <h2>Ruang pribadi</h2>
          <p>Tersimpan di perangkat ini</p>
        </div>
      </section>
      <section className="appearance-settings">
        <h3>Tampilan yang nyaman untukmu</h3>
        <p>Pilih suasana SkyWallet sesuai harimu.</p>
        <div className="theme-options">
          {[
            { id: 'light', label: 'Terang', icon: Sun },
            { id: 'dark', label: 'Gelap', icon: Moon },
            { id: 'system', label: 'Sistem', icon: Monitor },
          ].map((t) => (
            <button
              key={t.id}
              aria-pressed={theme === t.id}
              className={theme === t.id ? 'selected' : ''}
              onClick={() => chooseTheme(t.id)}
            >
              <t.icon size={22} />
              <span>{t.label}</span>
              {theme === t.id && <Check size={14} />}
            </button>
          ))}
        </div>
      </section>
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
            <small>Pilih berkas JSON ekspor SkyWallet</small>
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
      <div className="settings-section settings-danger">
        <h3>HAPUS DATA</h3>
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
      <section className="settings-section insight-preferences">
        <h3>
          <Bell size={18} />
          INFORMASI DI APLIKASI
        </h3>
        <p>Atur informasi yang ditampilkan di dashboard saat SkyWallet dibuka.</p>
        {(
          [
            { id: 'allocation', label: 'Rencana dana pribadi' },
            { id: 'spending', label: 'Belanja paling besar' },
            { id: 'together', label: 'Saldo akun bersama' },
          ] as const
        ).map((item) => (
          <div key={item.id}>
            <span>{item.label}</span>
            <button
              type="button"
              role="switch"
              aria-label={item.label}
              aria-checked={preferences[item.id]}
              onClick={() => onPreferences({ ...preferences, [item.id]: !preferences[item.id] })}
            >
              <i />
            </button>
          </div>
        ))}
      </section>

      <div className="settings-version">
        <Logo />
        <span>v0.1 · Data pada perangkat ini</span>
      </div>
    </div>
  );
}
