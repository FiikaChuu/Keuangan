import { useEffect, useRef, useState, useId } from 'react';
import type { ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, m, useIsPresent, useReducedMotion } from 'framer-motion';
import { DesignIcon, categoryArtwork } from './design';
import { sheetSpring } from './motion';
import { ArrowDownLeft, ArrowUpRight, Cloud, Paperclip, Check } from 'lucide-react';
import type { Account, Store, Transaction } from './domain';
export { BalanceChart, CashflowChart } from './DashboardCharts';
import { providers, money, displayDate, expenseEntryCategories } from './domain';

export function Logo({ small = false }: { small?: boolean }) {
  return (
    <div className={`logo ${small ? 'small' : ''}`}>
      <span className="logo-symbol">
        <Cloud size={26} strokeWidth={2.3} />
        <span />
      </span>
      {!small && (
        <span>
          Sky<span className="logo-save">Wallet</span>
          <span className="logo-dot">.</span>
        </span>
      )}
    </div>
  );
}
export function ProviderMark({
  account,
  large = false,
}: {
  account: Pick<Account, 'provider' | 'color'>;
  large?: boolean;
}) {
  const provider = providers.find((p) => p.name === account.provider);
  return (
    <span
      className={`provider-mark ${large ? 'large' : ''} provider-${account.provider.toLowerCase().replaceAll(' ', '-')}`}
      style={{ background: account.color }}
    >
      {provider?.short ?? account.provider.slice(0, 2)}
    </span>
  );
}

export function ProviderPicker({
  value,
  onChange,
}: {
  value: string;
  onChange: (provider: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const selected = providers.find((provider) => provider.name === value);
  return (
    <div className="provider-picker">
      <button
        type="button"
        className="account-picker-trigger provider-picker-trigger"
        aria-label="Bank atau e-wallet"
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => setOpen(true)}
      >
        {selected && <ProviderMark account={{ provider: selected.name, color: selected.color }} />}
        <span>{value || 'Pilih bank atau e-wallet'}</span>
        <DesignIcon name="chevron" />
      </button>
      <AnimatePresence>
        {open && (
          <Modal title="Pilih bank atau e-wallet" onClose={() => setOpen(false)}>
            <div
              className="category-options provider-options"
              role="listbox"
              aria-label="Bank atau e-wallet"
            >
              {providers.map((provider) => (
                <button
                  type="button"
                  key={provider.name}
                  role="option"
                  aria-label={provider.name}
                  aria-selected={provider.name === value}
                  className={provider.name === value ? 'selected' : ''}
                  onClick={() => {
                    onChange(provider.name);
                    setOpen(false);
                  }}
                >
                  <ProviderMark account={{ provider: provider.name, color: provider.color }} />
                  <span>{provider.name}</span>
                  {provider.name === value && <DesignIcon name="check" />}
                </button>
              ))}
            </div>
          </Modal>
        )}
      </AnimatePresence>
    </div>
  );
}

export function AccountPicker({
  accounts,
  values,
  value,
  onChange,
  label,
  allowAll = false,
}: {
  accounts: Account[];
  values: Record<string, number>;
  value: string;
  onChange: (id: string) => void;
  label: string;
  allowAll?: boolean;
  quick?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const selected = accounts.find((a) => a.id === value);
  return (
    <div className="account-picker">
      <button
        type="button"
        className="account-picker-trigger"
        aria-label={label}
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => setOpen(true)}
      >
        <span>
          {selected
            ? `${selected.provider} · ${selected.name}`
            : allowAll
              ? 'Semua rekening'
              : 'Pilih rekening'}
        </span>
        <DesignIcon name="chevron" />
      </button>
      <AnimatePresence>
        {open && (
          <Modal
            title={label}

            onClose={() => setOpen(false)}
          >
            <div className="account-options" role="listbox" aria-label={label}>
              {allowAll && (
                <button
                  type="button"
                  role="option"
                  aria-selected={!value}
                  className={!value ? 'selected' : ''}
                  onClick={() => {
                    onChange('');
                    setOpen(false);
                  }}
                >
                  <span>Semua rekening</span>
                  {!value && <Check size={21} className="account-option-check" />}
                </button>
              )}
              {accounts.map((a) => (
                <button
                  key={a.id}
                  type="button"
                  role="option"
                  aria-selected={value === a.id}
                  className={value === a.id ? 'selected' : ''}
                  onClick={() => {
                    onChange(a.id);
                    setOpen(false);
                  }}
                >
                  <ProviderMark account={a} />
                  <span>
                    <strong>
                      {a.provider} · {a.name}
                    </strong>
                    <small>
                      {money(values[a.id])}
                      {a.shared ? ' · Bersama' : ''}
                      {a.suffix ? ` · ••${a.suffix}` : ''}
                    </small>
                  </span>
                  {value === a.id && <DesignIcon name="check" />}
                </button>
              ))}
              {!accounts.length && (
                <EmptyState
                  title="Belum ada rekening lain"
                  text="Tambahkan rekening tujuan dari halaman Dompet terlebih dahulu."
                />
              )}
            </div>
          </Modal>
        )}
      </AnimatePresence>
    </div>
  );
}
export function CategoryIcon({ category, size = 24 }: { category: string; size?: number }) {
  return (
    <DesignIcon
      name={
        category === 'Makan' || category === 'Makanan & minuman'
          ? 'ledger-food'
          : (categoryArtwork[category] ?? 'category-other')
      }
      size={size}
    />
  );
}
let openModals = 0;
let previousBodyOverflow = '';

export function Modal({
  title,
  subtitle,
  children,
  onClose,
  wide = false,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
  onClose: () => void;
  wide?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const reducedMotion = useReducedMotion();
  const isPresent = useIsPresent();
  const titleId = useId();
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  useEffect(() => {
    const before = document.activeElement as HTMLElement | null;
    if (openModals++ === 0) previousBodyOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const timeout = window.setTimeout(() => {
      const sheet = ref.current;
      // Do not interrupt a user who already started typing while the sheet opens.
      // On mobile WebKit moving focus during numeric input can cancel the edit.
      if (!sheet || sheet.contains(document.activeElement)) return;
      sheet
        .querySelector<HTMLElement>('button, input, select, textarea, [tabindex="0"]')
        ?.focus({ preventScroll: true });
    }, 50);
    const onKey = (e: KeyboardEvent) => {
      const dialogs = document.querySelectorAll('[aria-modal="true"]');
      if (dialogs[dialogs.length - 1] !== ref.current) return;
      if (e.key === 'Escape') closeRef.current();
      if (e.key === 'Tab') {
        const elements = Array.from(
          ref.current?.querySelectorAll<HTMLElement>(
            'button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), a[href], [tabindex="0"]',
          ) ?? [],
        ).filter((x) => x.offsetParent !== null);
        const first = elements[0],
          last = elements[elements.length - 1];
        if (!first) return;
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener('keydown', onKey);
    return () => {
      clearTimeout(timeout);
      if (--openModals === 0) document.body.style.overflow = previousBodyOverflow;
      document.removeEventListener('keydown', onKey);
      if (before?.isConnected) before.focus({ preventScroll: true });
    };
  }, []);
  return createPortal(
    <m.div
      className="modal-overlay"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: reducedMotion ? 0 : 0.18 }}
      inert={!isPresent}
      aria-hidden={!isPresent || undefined}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <m.div
        className={`modal ${wide ? 'wide' : ''}`}
        initial={{ y: reducedMotion ? 0 : 32 }}
        animate={{ y: 0 }}
        exit={{ y: reducedMotion ? 0 : 24 }}
        transition={reducedMotion ? { duration: 0 } : sheetSpring}
        ref={ref}
        role="dialog"
        aria-modal={isPresent ? true : undefined}
        aria-labelledby={titleId}
      >
        <div className="sheet-handle" aria-hidden="true" />
        <div className="modal-heading">
          <div>
            <h2 id={titleId}>{title}</h2>
            {subtitle && <p>{subtitle}</p>}
          </div>
          <button className="icon-btn" aria-label="Tutup dialog" onClick={onClose}>
            <DesignIcon name="close" />
          </button>
        </div>
        <div className="modal-body">{children}</div>
      </m.div>
    </m.div>,
    document.body,
  );
}
export function EmptyState({
  icon = <Cloud size={28} />,
  title,
  text,
  action,
}: {
  icon?: ReactNode;
  title: string;
  text: string;
  action?: ReactNode;
}) {
  return (
    <div className="empty-state">
      <span className="empty-icon">{icon}</span>
      <h3>{title}</h3>
      <p>{text}</p>
      {action}
    </div>
  );
}
export function TransactionList({
  store,
  transactions,
  onSelect,
  compact: isCompact = false,
  onEdit,
  onDelete,
}: {
  store: Store;
  transactions: Transaction[];
  onSelect: (t: Transaction) => void;
  compact?: boolean;
  onEdit?: (t: Transaction) => void;
  onDelete?: (t: Transaction) => void;
}) {
  if (!transactions.length)
    return (
      <EmptyState
        title="Belum ada transaksi di sini"
        text="Coba ubah filter, atau catat transaksi pertamamu. Setiap langkah kecil berarti."
      />
    );
  return (
    <div className={`transaction-list ${isCompact ? 'compact' : 'card-list'}`}>
      {transactions.map((t) => {
        const a = store.accounts.find((a) => a.id === t.accountId) ?? {
          provider: 'Akun pribadi anggota',
          name: '',
          color: '#676D7E',
        };
        const to = store.accounts.find((a) => a.id === t.toId);
        const category =
          t.kind === 'income' ? 'Pemasukan' : t.kind === 'transfer' ? 'Transfer' : t.category;
        return (
          <article className={`transaction-card ${t.kind}`} key={t.id}>
            <button
              className="transaction-main"
              aria-label={`Lihat transaksi ${t.title}, ${money(t.amount)}`}
              onClick={() => onSelect(t)}
            >
              <span className={`transaction-category ${t.kind}`}>
                <CategoryIcon category={category} size={23} />
              </span>
              <span className="transaction-copy">
                <span className="transaction-title">
                  <strong>{t.title}</strong>
                  {t.receiptId && <Paperclip size={13} />}
                </span>
                <span className="transaction-description">
                  {displayDate(t.date, { day: 'numeric', month: 'short' })}
                  <i />
                  {t.kind === 'income'
                    ? t.source
                    : t.kind === 'transfer'
                      ? `Ke ${to?.name ?? 'rekening lain'}`
                      : a.provider}
                </span>
                <span className="transaction-provider">
                  <span className="account-dot" style={{ background: a.color }} />
                  {a.provider}
                  {!isCompact && a.name !== a.provider && ` · ${a.name}`}
                </span>
              </span>
              <span className={`transaction-amount ${t.kind}`}>
                <strong>
                  {t.kind === 'income' ? '+' : t.kind === 'expense' ? '−' : ''}
                  {money(t.amount)}
                </strong>
                {isCompact ? (
                  <small>{category}</small>
                ) : (
                  <span className={`kind-badge ${t.kind}`}>
                    {t.kind === 'income'
                      ? 'Uang masuk'
                      : t.kind === 'transfer'
                        ? 'Pindah dana'
                        : 'Uang keluar'}
                  </span>
                )}
                {t.fee > 0 && <small>Biaya {money(t.fee)}</small>}
              </span>
            </button>
            {t.editable !== false && (onEdit || onDelete) && (
              <div className="transaction-actions">
                {onEdit && (
                  <button aria-label={`Edit ${t.title}`} onClick={() => onEdit(t)}>
                    <DesignIcon name="edit" />
                  </button>
                )}
                {onDelete && (
                  <button
                    aria-label={`Hapus ${t.title}`}
                    className="delete-transaction"
                    onClick={() => onDelete(t)}
                  >
                    <DesignIcon name="delete" />
                  </button>
                )}
              </div>
            )}
          </article>
        );
      })}
    </div>
  );
}
export function SpendingDonut({
  entries,
  compactCenter = false,
}: {
  entries: [string, number][];
  compactCenter?: boolean;
}) {
  const total = entries.reduce((sum, [, n]) => sum + n, 0);
  const top = entries.slice(0, entries.length > 5 ? 4 : 5);
  const rest = entries.slice(top.length).reduce((s, [, n]) => s + n, 0);
  if (rest) top.push(['Lainnya', rest]);
  const colors = ['#1D2949', '#F37777', '#F6AE31', '#7CCB8C', '#3ED0C2'];
  let accumulated = 135;
  return (
    <>
      <div className="donut">
        <svg
          viewBox="0 0 180 180"
          role="img"
          aria-label={`Pengeluaran periode ini ${money(total)}`}
        >
          {!top.length && (
            <circle cx="90" cy="90" r="66" stroke="var(--soft)" strokeWidth="22" fill="none" />
          )}
          {top.map(([name, value], index) => {
            const start = accumulated + 1;
            accumulated += (value / total) * 360;
            const end = accumulated - 1;
            const outer = [78, 70, 76, 66, 62][index];
            const point = (angle: number, radius: number) =>
              [
                90 + Math.cos((angle * Math.PI) / 180) * radius,
                90 + Math.sin((angle * Math.PI) / 180) * radius,
              ].join(',');
            const large = end - start > 180 ? 1 : 0;
            return (
              <path
                key={name}
                d={`M ${point(start, outer)} A ${outer} ${outer} 0 ${large} 1 ${point(end, outer)} L ${point(end, 44)} A 44 44 0 ${large} 0 ${point(start, 44)} Z`}
                fill={colors[index]}
              >
                <title>
                  {name}: {money(value)}
                </title>
              </path>
            );
          })}
        </svg>
        <span>
          <small>Total pengeluaran</small>
          <strong title={money(total)}>
            {compactCenter && total >= 1e6
              ? `Rp ${new Intl.NumberFormat('id-ID', { notation: 'compact', maximumFractionDigits: 2 }).format(total)}`
              : money(total)}
          </strong>
        </span>
      </div>
      <div className="spending-legend">
        {top.length ? (
          top.map(([name, value], index) => (
            <div key={name}>
              <span>
                <i style={{ background: colors[index] }} />
                {name}
              </span>
              <strong>{Math.round((value / total) * 100)}%</strong>
            </div>
          ))
        ) : (
          <p>Belum ada pengeluaran di periode ini.</p>
        )}
      </div>
    </>
  );
}
export function TrendIcon({ incoming = false }: { incoming?: boolean }) {
  return incoming ? <ArrowDownLeft size={18} /> : <ArrowUpRight size={18} />;
}

export function CategoryPicker({
  value,
  onChange,
  allowAll = false,
  quick = false,
}: {
  value: string;
  onChange: (value: string) => void;
  allowAll?: boolean;
  quick?: boolean;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className={`category-picker ${quick ? 'with-quick' : ''}`}>
      {quick && (
        <div className="quick-categories" aria-label="Kategori cepat">
          {['Makan', 'Transportasi', 'Tagihan', 'Belanja', 'Transfer'].map((c) => (
            <button
              type="button"
              key={c}
              aria-pressed={value === c}
              className={value === c ? 'selected' : ''}
              onClick={() => onChange(c)}
            >
              <DesignIcon name={categoryArtwork[c]} />
              <small>{c}</small>
            </button>
          ))}
        </div>
      )}
      <button
        className="category-picker-trigger"
        type="button"
        aria-label={allowAll ? 'Filter kategori' : 'Pilih kategori'}
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => setOpen(true)}
      >
        <span>
          {value ? (
            <>
              <DesignIcon name={categoryArtwork[value] ?? 'category-other'} />
              {value}
            </>
          ) : (
            'Semua kategori'
          )}
        </span>
        <DesignIcon name="chevron" />
      </button>
      <AnimatePresence>
        {open && (
          <Modal
            title="Pilih kategori"

            onClose={() => setOpen(false)}
          >
            <div className="category-options" role="listbox" aria-label="Kategori">
              {[...(allowAll ? [''] : []), ...expenseEntryCategories].map((c) => (
                <button
                  key={c}
                  role="option"
                  aria-label={c || 'Semua kategori'}
                  type="button"
                  aria-selected={c === value}
                  className={c === value ? 'selected' : ''}
                  onClick={() => {
                    onChange(c);
                    setOpen(false);
                  }}
                >
                  <span className="category-option-emoji" aria-hidden="true">
                    <DesignIcon name={categoryArtwork[c] ?? 'category-other'} />
                  </span>
                  <span>{c || 'Semua kategori'}</span>
                  {c === value && <DesignIcon name="check" />}
                </button>
              ))}
            </div>
          </Modal>
        )}
      </AnimatePresence>
    </div>
  );
}

export function downloadFile(content: BlobPart, type: string, name: string) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
