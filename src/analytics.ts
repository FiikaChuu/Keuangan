import type { Store, Transaction } from './domain.ts';
import {
  allocations,
  balances,
  daysAgo,
  money,
  spendingByCategory,
  today,
  totals,
} from './domain.ts';

export const dashboardPeriods = [
  { days: 7, label: 'Mingguan' },
  { days: 30, label: 'Bulanan' },
  { days: 365, label: 'Tahunan' },
] as const;

export function reportRange(period: 'week' | 'month' | 'year', date: string) {
  const parsed = new Date(`${date}T12:00:00Z`);
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(date) ||
    Number.isNaN(parsed.getTime()) ||
    parsed.toISOString().slice(0, 10) !== date ||
    date > today()
  )
    return { start: '', end: '', error: 'Pilih tanggal yang valid, paling lambat hari ini.' };
  if (period === 'week') parsed.setUTCDate(parsed.getUTCDate() - 6);
  const start =
    period === 'month'
      ? `${date.slice(0, 7)}-01`
      : period === 'year'
        ? `${date.slice(0, 4)}-01-01`
        : parsed.toISOString().slice(0, 10);
  return { start, end: date, error: '' };
}

export function periodTransactions(transactions: Transaction[], days: number) {
  return transactions.filter((t) => t.date >= daysAgo(days - 1) && t.date <= today());
}

export function cashflowBuckets(transactions: Transaction[], days: number) {
  const count = days <= 7 ? 7 : 6;
  let cumulative = 0;
  return Array.from({ length: count }, (_, index) => {
    const start = daysAgo(days - 1 - Math.floor((index * days) / count));
    const end = daysAgo(days - Math.floor(((index + 1) * days) / count));
    const sum = totals(transactions.filter((t) => t.date >= start && t.date <= end));
    const net = sum.income - sum.expense;
    cumulative += net;
    return { start, end, ...sum, net, cumulative };
  });
}

export type MoneyInsight = {
  id: 'allocation' | 'spending' | 'together';
  tone: 'accent' | 'warning' | 'success';
  label: string;
  context: string;
  title: string;
  body: string;
};

export function moneyInsights(store: Store, days: number): MoneyInsight[] {
  const tx = periodTransactions(store.transactions, days);
  const sum = totals(tx);
  const plan = allocations(store);
  const spending = spendingByCategory(tx, '');
  const top = spending[0];
  const accountBalances = balances(store);
  const shared = store.accounts
    .filter((a) => a.shared)
    .reduce((s, a) => s + accountBalances[a.id], 0);
  return [
    {
      id: 'allocation',
      tone: plan.shortfall ? 'warning' : 'accent',
      label: 'Rencana',
      context: 'Dana pribadi',
      title: 'Rencana dana pribadi',
      body: plan.shortfall
        ? `Dana pribadi kurang ${money(plan.shortfall)} dari cadangan wajibmu. Penuhi cadangan sebelum menambah belanja opsional.`
        : `${money(plan.available)} tersedia setelah cadangan wajib. Alokasi tabungan ${store.plan.saving}%: ${money(plan.saving)}.`,
    },
    {
      id: 'spending',
      tone: 'accent',
      label: 'Pola',
      context: 'Pengeluaran',
      title: 'Belanja paling besar',
      body: top
        ? `${top[0]} menjadi pengeluaran terbesar: ${money(top[1])}, atau ${Math.round((top[1] / sum.expense) * 100)}% dari total ${days} hari terakhir.`
        : 'Catat transaksi atau bagikan nota untuk melihat pengeluaran per kategori.',
    },
    {
      id: 'together',
      tone: 'success',
      label: 'Ringkasan',
      context: 'Akun bersama',
      title: 'Saldo akun bersama',
      body: `Saldo akun bersama ${money(shared)}. Dana ini dipisahkan dari rencana dana pribadimu.`,
    },
  ];
}
