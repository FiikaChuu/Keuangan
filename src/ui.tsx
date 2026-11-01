import { useEffect, useRef, useState } from 'react';
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
} from 'lucide-react';
import type { Account, Store, Transaction } from './domain';
import { providers, money, compact, displayDate, balanceHistory, categoryColors } from './domain';

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
        aria-labelledby="dialog-title"
      >
        <div className="modal-heading">
          <div>
            <span className="eyebrow">A LITTLE MORE ORGANIZED</span>
            <h2 id="dialog-title">{title}</h2>
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
}: {
  store: Store;
  transactions: Transaction[];
  onSelect: (t: Transaction) => void;
  compact?: boolean;
}) {
  if (!transactions.length)
    return (
      <EmptyState
        title="Cerita uangmu dimulai di sini"
        text="Catat pemasukan atau pengeluaran pertamamu. Sedikit demi sedikit, semuanya jadi lebih jelas."
      />
    );
  return (
    <div className={`transaction-list ${isCompact ? 'compact' : ''}`}>
      <div className="transaction-columns">
        <span>Transaksi</span>
        <span>Rekening</span>
        <span>Tanggal</span>
        <span>Nominal</span>
      </div>
      {transactions.map((t) => {
        const a = store.accounts.find((a) => a.id === t.accountId)!;
        const to = store.accounts.find((a) => a.id === t.toId);
        return (
          <button className="transaction-row" key={t.id} onClick={() => onSelect(t)}>
            <span className={`transaction-category ${t.kind}`}>
              <CategoryIcon
                category={
                  t.kind === 'income'
                    ? 'Pemasukan'
                    : t.kind === 'transfer'
                      ? 'Transfer'
                      : t.category
                }
              />
            </span>
            <span className="transaction-title">
              <strong>
                {t.title}
                {t.receiptId && <Paperclip size={11} />}
              </strong>
              <small>
                {t.kind === 'income'
                  ? t.source
                  : t.kind === 'transfer'
                    ? `Ke ${to?.name ?? 'rekening lain'}`
                    : t.category}
              </small>
            </span>
            <span className="transaction-account">
              <span className="account-dot" style={{ background: a.color }} />
              {a.provider}
            </span>
            <span className="transaction-date">
              {displayDate(t.date, { day: 'numeric', month: 'short' })}
            </span>
            <span className={`transaction-amount ${t.kind}`}>
              <strong>
                {t.kind === 'income' ? '+' : t.kind === 'transfer' ? '' : '−'}
                {money(t.amount)}
              </strong>
              {t.fee > 0 && <small>Biaya {money(t.fee)}</small>}
              <span className="mobile-tx-meta">
                {a.provider} · {displayDate(t.date, { day: 'numeric', month: 'short' })}
              </span>
            </span>
          </button>
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
