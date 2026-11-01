import { useEffect, useRef, useState, useId } from 'react';
import type { ReactNode } from 'react';
import {
  ArrowDownLeft,
  ArrowUpRight,
  ArrowLeftRight,
  Utensils,
  ShoppingBag,
  Car,
  Wifi,
  Music2,
  Heart,
  BookOpen,
  Home,
  MoreHorizontal,
  Banknote,
  X,
  Cloud,
  Paperclip,
  Pencil,
  Trash2,
  ChevronDown,
  Check,
} from 'lucide-react';
import type { Account, Store, Transaction } from './domain';
import {
  providers,
  money,
  compact,
  displayDate,
  balanceHistory,
  categoryColors,
  categories,
  totals,
  daysAgo,
} from './domain';

export function Logo({ small = false }: { small?: boolean }) {
  return (
    <div className={`logo ${small ? 'small' : ''}`}>
      <span className="logo-symbol">
        <Cloud size={26} strokeWidth={2.3} />
        <span />
      </span>
      {!small && (
        <span>
          sky<span className="logo-save">Save</span>
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
export function CategoryIcon({ category, size = 19 }: { category: string; size?: number }) {
  const Icon =
    (
      {
        'Makanan & minuman': Utensils,
        Belanja: ShoppingBag,
        Transportasi: Car,
        'Kuota & internet': Wifi,
        Hiburan: Music2,
        Langganan: Music2,
        Kesehatan: Heart,
        Pendidikan: BookOpen,
        'Rumah & tagihan': Home,
        Pasangan: Heart,
        'Tarik tunai': Banknote,
        Transfer: ArrowLeftRight,
        Pemasukan: ArrowDownLeft,
      } as Record<string, typeof Utensils>
    )[category] ?? MoreHorizontal;
  return <Icon size={size} strokeWidth={1.7} />;
}
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
  const titleId = useId();
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  useEffect(() => {
    const before = document.activeElement as HTMLElement | null;
    const old = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const timeout = window.setTimeout(
      () =>
        ref.current
          ?.querySelector<HTMLElement>('input, select, button, textarea, [tabindex="0"]')
          ?.focus(),
      50,
    );
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
      document.body.style.overflow = old;
      document.removeEventListener('keydown', onKey);
      before?.focus();
    };
  }, []);
  return (
    <div
      className="modal-overlay"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className={`modal ${wide ? 'wide' : ''}`}
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
      >
        <div className="sheet-handle" aria-hidden="true" />
        <div className="modal-heading">
          <div>
            <h2 id={titleId}>{title}</h2>
            {subtitle && <p>{subtitle}</p>}
          </div>
          <button className="icon-btn" aria-label="Tutup dialog" onClick={onClose}>
            <X size={20} />
          </button>
        </div>
        {children}
      </div>
    </div>
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
        const a = store.accounts.find((a) => a.id === t.accountId)!;
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
                      : t.category}
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
            {(onEdit || onDelete) && (
              <div className="transaction-actions">
                {onEdit && (
                  <button aria-label={`Edit ${t.title}`} onClick={() => onEdit(t)}>
                    <Pencil size={17} />
                  </button>
                )}
                {onDelete && (
                  <button
                    aria-label={`Hapus ${t.title}`}
                    className="delete-transaction"
                    onClick={() => onDelete(t)}
                  >
                    <Trash2 size={17} />
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
export function BalanceChart({ store, days }: { store: Store; days: number }) {
  const [hover, setHover] = useState<number | null>(null);
  const points = balanceHistory(store, days);
  const max = Math.max(...points.map((p) => p.value), 1000000) * 1.08;
  const min = Math.max(0, Math.min(...points.map((p) => p.value)) * 0.78);
  const coords = points.map((p, i) => [
    48 + (i / (points.length - 1)) * 650,
    175 - ((p.value - min) / (max - min || 1)) * 145,
  ]);
  const path = coords.reduce(
    (s, p, i) =>
      i === 0
        ? `M ${p[0]},${p[1]}`
        : `${s} C ${coords[i - 1][0] + 12},${coords[i - 1][1]} ${p[0] - 12},${p[1]} ${p[0]},${p[1]}`,
    '',
  );
  const hoverIndex = hover ?? points.length - 1;
  return (
    <div className="chart-container">
      <div className="chart-current">
        <span>
          {hover !== null ? displayDate(points[hoverIndex].date) : 'Total saldo saat ini'}
        </span>
        <strong>{money(points[hoverIndex].value)}</strong>
      </div>
      <svg
        viewBox="0 0 720 216"
        role="img"
        aria-label={`Grafik total saldo ${days} hari terakhir, dari ${money(points[0].value)} ke ${money(points.at(-1)!.value)}`}
        onMouseLeave={() => setHover(null)}
      >
        <defs>
          <linearGradient id="chartFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#42997b" stopOpacity="0.18" />
            <stop offset="100%" stopColor="#42997b" stopOpacity="0.005" />
          </linearGradient>
        </defs>
        {[0, 1, 2, 3].map((i) => (
          <g key={i}>
            <line
              x1="48"
              x2="698"
              y1={30 + i * 48}
              y2={30 + i * 48}
              stroke="#e9eeeb"
              strokeDasharray="3 5"
            />
            <text x="0" y={34 + i * 48} fill="#9ba7a1" fontSize="10">
              {compact(max - (i * (max - min)) / 3)}
            </text>
          </g>
        ))}
        <path d={`${path} L 698,178 L 48,178 Z`} fill="url(#chartFill)" />
        <path d={path} fill="none" stroke="#32866a" strokeWidth="2.8" />
        {coords.map((p, i) => (
          <rect
            key={i}
            x={p[0] - 12}
            y="10"
            width="24"
            height="175"
            fill="transparent"
            onMouseEnter={() => setHover(i)}
          />
        ))}
        <circle
          cx={coords[hoverIndex][0]}
          cy={coords[hoverIndex][1]}
          r="5"
          fill="#32866a"
          stroke="white"
          strokeWidth="3"
        />
        {[
          0,
          Math.floor((days - 1) / 4),
          Math.floor((days - 1) / 2),
          Math.floor(((days - 1) * 3) / 4),
          days - 1,
        ].map((i) => (
          <text
            key={i}
            x={coords[i][0]}
            y="207"
            textAnchor={i === days - 1 ? 'end' : i === 0 ? 'start' : 'middle'}
            fill="#9ba7a1"
            fontSize="10"
          >
            {displayDate(points[i].date, { day: 'numeric', month: 'short' })}
          </text>
        ))}
      </svg>
    </div>
  );
}
export function SpendingDonut({ entries }: { entries: [string, number][] }) {
  const total = entries.reduce((sum, [, n]) => sum + n, 0);
  const top = entries.slice(0, 3);
  const rest = entries.slice(3).reduce((s, [, n]) => s + n, 0);
  if (rest) top.push(['Lainnya', rest]);
  let accumulated = 0;
  return (
    <>
      <div className="donut">
        <svg
          viewBox="0 0 180 180"
          role="img"
          aria-label={`Pengeluaran periode ini ${money(total)}`}
        >
          <circle cx="90" cy="90" r="66" stroke="#edf1ee" strokeWidth="22" fill="none" />
          {top.map(([name, value]) => {
            const offset = accumulated;
            accumulated += (value / total) * 100;
            return (
              <circle
                key={name}
                cx="90"
                cy="90"
                r="66"
                fill="none"
                stroke={categoryColors[name] ?? '#d9ddd5'}
                strokeWidth="22"
                strokeDasharray={`${Math.max(0, (value / total) * 414.69 - 5)} 414.69`}
                strokeDashoffset={(-offset / 100) * 414.69}
                transform="rotate(-90 90 90)"
              />
            );
          })}
        </svg>
        <span>
          <small>Total pengeluaran</small>
          <strong>{money(total)}</strong>
        </span>
      </div>
      <div className="spending-legend">
        {top.length ? (
          top.map(([name, value]) => (
            <div key={name}>
              <span>
                <i style={{ background: categoryColors[name] ?? '#d9ddd5' }} />
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

const categoryEmoji: Record<string, string> = {
  'Makanan & minuman': '🍜',
  Belanja: '🛍️',
  Transportasi: '🚕',
  'Kuota & internet': '📱',
  Hiburan: '🎬',
  Langganan: '🎧',
  Kesehatan: '💊',
  Pendidikan: '📚',
  'Rumah & tagihan': '🏡',
  Pasangan: '💜',
  'Tarik tunai': '🏧',
  Lainnya: '✨',
};
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
    <div className="category-picker">
      {quick && (
        <div className="quick-categories" aria-label="Kategori cepat">
          {categories.slice(0, 4).map((c) => (
            <button
              type="button"
              key={c}
              aria-pressed={value === c}
              className={value === c ? 'selected' : ''}
              onClick={() => onChange(c)}
            >
              <span>{categoryEmoji[c]}</span>
              <small>
                {
                  (
                    {
                      'Makanan & minuman': 'Makanan',
                      Belanja: 'Belanja',
                      Transportasi: 'Transport',
                      'Kuota & internet': 'Kuota',
                    } as Record<string, string>
                  )[c]
                }
              </small>
            </button>
          ))}
        </div>
      )}
      <button
        className="category-picker-trigger"
        type="button"
        aria-label={allowAll ? 'Filter kategori' : 'Pilih kategori'}
        aria-haspopup="dialog"
        onClick={() => setOpen(true)}
      >
        <span>
          {value ? (
            <>
              <span>{categoryEmoji[value]}</span>
              {value}
            </>
          ) : (
            'Semua kategori'
          )}
        </span>
        <ChevronDown size={18} />
      </button>
      {open && (
        <Modal
          title="Pilih kategori"
          subtitle="Temukan tempat yang pas untuk pengeluaranmu."
          onClose={() => setOpen(false)}
        >
          <div className="category-options" role="listbox" aria-label="Kategori">
            {[...(allowAll ? [''] : []), ...categories].map((c) => (
              <button
                key={c}
                role="option"
                type="button"
                aria-selected={c === value}
                className={c === value ? 'selected' : ''}
                onClick={() => {
                  onChange(c);
                  setOpen(false);
                }}
              >
                <span className="category-option-emoji">{categoryEmoji[c] ?? '🗂️'}</span>
                <span>{c || 'Semua kategori'}</span>
                {c === value && <Check size={21} />}
              </button>
            ))}
          </div>
        </Modal>
      )}
    </div>
  );
}

export function CashflowChart({
  transactions,
  days,
}: {
  transactions: Transaction[];
  days: number;
}) {
  const count = days <= 7 ? 7 : 6;
  const buckets = Array.from({ length: count }, (_, i) => {
    const from = daysAgo(days - 1 - Math.floor((i * days) / count));
    const to = daysAgo(days - 1 - Math.floor(((i + 1) * days) / count - 1));
    return { date: from, ...totals(transactions.filter((t) => t.date >= from && t.date <= to)) };
  });
  const max = Math.max(100000, ...buckets.flatMap((b) => [b.income, b.expense])) * 1.12;
  return (
    <div className="cashflow-chart">
      <div className="cashflow-legend">
        <span>
          <i />
          Pemasukan
        </span>
        <span>
          <i />
          Pengeluaran
        </span>
      </div>
      <svg
        viewBox="0 0 720 250"
        role="img"
        aria-label={`Grafik pemasukan dan pengeluaran ${days} hari terakhir`}
      >
        {[0, 1, 2, 3].map((i) => (
          <g key={i}>
            <line
              x1="48"
              x2="700"
              y1={25 + i * 57}
              y2={25 + i * 57}
              stroke="var(--line)"
              strokeDasharray="3 5"
            />
            <text x="0" y={29 + i * 57} fontSize="11" fill="var(--muted)">
              {compact(max * (1 - i / 3))}
            </text>
          </g>
        ))}
        {buckets.map((b, i) => {
          const x = 70 + i * (620 / count);
          return (
            <g key={b.date}>
              <rect
                x={x}
                y={196 - (b.income / max) * 171}
                width="22"
                height={(b.income / max) * 171}
                rx="8"
                fill="#83cda2"
              >
                <title>
                  Pemasukan {displayDate(b.date)}: {money(b.income)}
                </title>
              </rect>
              <rect
                x={x + 27}
                y={196 - (b.expense / max) * 171}
                width="22"
                height={(b.expense / max) * 171}
                rx="8"
                fill="#f58b8c"
              >
                <title>
                  Pengeluaran {displayDate(b.date)}: {money(b.expense)}
                </title>
              </rect>
              <text x={x + 24} y="231" textAnchor="middle" fontSize="11" fill="var(--muted)">
                {displayDate(b.date, { day: 'numeric', month: 'short' })}
              </text>
            </g>
          );
        })}
      </svg>
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
