import type { SupabaseClient } from '@supabase/supabase-js';
import type { Store, Account, Transaction, Goal, Plan } from './domain';
import { normalizeCategory } from './domain';

type Row = Record<string, unknown>;
export type Change = {
  type: string;
  id?: string;
  version?: number;
  data?: Record<string, unknown>;
};
const integer = (value: unknown) => {
  const n = Number(value);
  if (!Number.isSafeInteger(n)) throw new Error('Nominal dari server melewati batas angka aman.');
  return n;
};
export function decodeSnapshot(raw: Record<string, unknown>): Store {
  if (raw.allowed !== true) throw new Error('Akses akun dicabut atau email belum dikonfirmasi.');
  const wallets = (raw.wallets ?? []) as Row[];
  const ids = new Set(wallets.map((w) => w.id));
  const accounts: Account[] = wallets.map((w) => ({
    id: String(w.id),
    name: String(w.name),
    provider: String(w.provider),
    color: String(w.color),
    suffix: String(w.suffix),
    opening: integer(w.opening_balance),
    shared: w.household_id !== null,
    version: integer(w.version),
  }));
  const transactions: Transaction[] = ((raw.transactions ?? []) as Row[]).map((t) => ({
    id: String(t.id),
    kind: t.kind as Transaction['kind'],
    category: String(t.category),
    title: String(t.category),
    amount: integer(t.amount),
    fee: ids.has(t.from_wallet_id) ? integer(t.fee) : 0,
    date: String(t.date),
    accountId: String(t.from_wallet_id),
    toId: t.to_wallet_id ? String(t.to_wallet_id) : undefined,
    source: String(t.source ?? ''),
    note: String(t.catatan ?? ''),
    reference: t.reference ? String(t.reference) : undefined,
    receiptHash: t.receipt_hash ? String(t.receipt_hash).replace(/^\\x/, '') : undefined,
    version: integer(t.version),
    editable: ids.has(t.from_wallet_id) && (!t.to_wallet_id || ids.has(t.to_wallet_id)),
  }));
  const goals: Goal[] = ((raw.goals ?? []) as Row[]).map((g) => ({
    id: String(g.id),
    name: String(g.name),
    target: integer(g.target),
    accountId: String(g.wallet_id),
    emoji: String(g.emoji),
    version: integer(g.version),
  }));
  const p = raw.plan as Row;
  if (!p) throw new Error('Rencana akun belum disiapkan. Masuk ulang untuk mencoba lagi.');
  const plan: Plan = {
    reserve: integer(p.reserve),
    saving: integer(p.saving),
    fun: integer(p.fun),
    together: integer(p.together),
    version: integer(p.version),
  };
  return { version: 1, demo: false, accounts, transactions, goals, plan };
}
const pick = (object: object, keys: string[]) =>
  Object.fromEntries(keys.map((key) => [key, (object as Row)[key]]));
const walletKeys = ['name', 'provider', 'color', 'suffix', 'opening', 'shared'];
const txKeys = [
  'kind',
  'category',
  'amount',
  'fee',
  'date',
  'accountId',
  'toId',
  'source',
  'note',
  'reference',
  'receiptHash',
];
const goalKeys = ['name', 'target', 'accountId', 'emoji'];
const planKeys = ['reserve', 'saving', 'fun', 'together'];
export function storeChanges(before: Store, after: Store): Change[] {
  const removed: Change[] = [],
    added: Change[] = [];
  function diff<T extends { id: string; version?: number }>(
    kind: string,
    old: T[],
    next: T[],
    keys: string[],
  ) {
    const previousById = new Map(old.map((item) => [item.id, item]));
    const nextIds = new Set(next.map((item) => item.id));
    for (const item of old)
      if (!nextIds.has(item.id))
        removed.push({ type: `${kind}.delete`, id: item.id, version: item.version });
    for (const item of next) {
      const previous = previousById.get(item.id);
      if (!previous || JSON.stringify(pick(item, keys)) !== JSON.stringify(pick(previous, keys))) {
        const data = pick(item, keys);
        if (kind === 'transaction') data.category = normalizeCategory(String(data.category));
        added.push({
          type: `${kind}.put`,
          id: item.id,
          version: previous ? (item.version ?? previous.version) : undefined,
          data,
        });
      }
    }
  }
  diff('wallet', before.accounts, after.accounts, walletKeys);
  diff('transaction', before.transactions, after.transactions, txKeys);
  diff('goal', before.goals, after.goals, goalKeys);
  if (JSON.stringify(pick(before.plan, planKeys)) !== JSON.stringify(pick(after.plan, planKeys)))
    added.push({
      type: 'plan.put',
      version: after.plan.version ?? before.plan.version,
      data: pick(after.plan, planKeys),
    });
  const order = [
    'goal.delete',
    'transaction.delete',
    'wallet.delete',
    'wallet.put',
    'transaction.put',
    'goal.put',
    'plan.put',
  ];
  return [...removed, ...added].sort((a, b) => order.indexOf(a.type) - order.indexOf(b.type));
}
export function databaseError(error: { code?: string; message: string }) {
  if (error.code === '23505')
    return 'Catatan, bukti, atau referensi yang sama sudah tersimpan. Periksa riwayat.';
  if (error.code === '40001')
    return 'Data berubah di perangkat lain. Tutup form, periksa data terbaru, lalu coba lagi.';
  if (error.code === '42501') return 'Akun atau rekening ini tidak dapat kamu akses.';
  if (['23514', '22P02', '22003', '23502', '22023', '23503'].includes(error.code ?? ''))
    return 'Periksa nominal, saldo, tanggal, dan rekening. Perubahan dibatalkan seluruhnya.';
  return 'Perubahan belum terkonfirmasi. Periksa koneksi dan coba lagi; jangan membuat catatan baru yang sama.';
}
export async function readFinance(client: SupabaseClient, revision?: string) {
  if (revision) {
    const { data, error } = await client.rpc('finance_revision');
    if (error) throw new Error(databaseError(error));
    if (data.allowed !== true) throw new Error('Akses akun dicabut atau email belum dikonfirmasi.');
    if (data.revision === revision) return null;
  }
  const { data, error } = await client.rpc('finance_snapshot');
  if (error) throw new Error(databaseError(error));
  return { store: decodeSnapshot(data), revision: String(data.revision) };
}
