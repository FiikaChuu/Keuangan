export type Account = {
  id: string;
  name: string;
  provider: string;
  opening: number;
  shared: boolean;
  color: string;
  suffix: string;
};
export type Transaction = {
  id: string;
  kind: 'income' | 'expense' | 'transfer';
  title: string;
  amount: number;
  fee: number;
  date: string;
  accountId: string;
  toId?: string;
  category: string;
  source: string;
  note: string;
  receiptId?: string;
  receiptHash?: string;
  reference?: string;
};
export type Goal = { id: string; name: string; target: number; accountId: string; emoji: string };
export type Plan = { reserve: number; saving: number; fun: number; together: number };
export type Store = {
  version: 1;
  demo: boolean;
  accounts: Account[];
  transactions: Transaction[];
  goals: Goal[];
  plan: Plan;
};
export const STORAGE_KEY = 'skysave.v1';
export const categories = [
  'Makanan & minuman',
  'Belanja',
  'Transportasi',
  'Kuota & internet',
  'Hiburan',
  'Langganan',
  'Kesehatan',
  'Pendidikan',
  'Rumah & tagihan',
  'Pasangan',
  'Tarik tunai',
  'Lainnya',
];
export const categoryColors: Record<string, string> = {
  'Makanan & minuman': '#ef8587',
  Belanja: '#242f50',
  Transportasi: '#87cba7',
  'Kuota & internet': '#e6bb6c',
  Hiburan: '#a59bc8',
  Langganan: '#b8a8c9',
  Kesehatan: '#d9a0a4',
  'Rumah & tagihan': '#74a6a2',
  'Biaya transfer': '#c1c8cf',
};
export const providers = [
  { name: 'SeaBank', color: '#ee752f', short: 'Sea' },
  { name: 'Bank Jago', color: '#e9aa3b', short: 'jago' },
  { name: 'BCA', color: '#1872ba', short: 'BCA' },
  { name: 'Mandiri', color: '#244a7a', short: 'm' },
  { name: 'BRI', color: '#1963a3', short: 'BRI' },
  { name: 'BNI', color: '#e87832', short: 'BNI' },
  { name: 'OVO', color: '#615094', short: 'OVO' },
  { name: 'DANA', color: '#2192d7', short: 'D' },
  { name: 'GoPay', color: '#03a7b6', short: 'go' },
  { name: 'ShopeePay', color: '#ed6239', short: 'S' },
  { name: 'Lainnya', color: '#4a8b77', short: '↗' },
];
export const money = (n: number) =>
  new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    maximumFractionDigits: 0,
  }).format(n);
export const compact = (n: number) =>
  Math.abs(n) >= 1e6
    ? `${(n / 1e6).toLocaleString('id-ID', { maximumFractionDigits: 1 })} jt`
    : `${(n / 1e3).toLocaleString('id-ID', { maximumFractionDigits: 0 })} rb`;
export function today() {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Jakarta',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}
export function daysAgo(days: number) {
  const d = new Date(`${today()}T12:00:00+07:00`);
  d.setDate(d.getDate() - days);
  return d.toISOString().slice(0, 10);
}
export const displayDate = (date: string, opts?: Intl.DateTimeFormatOptions) =>
  new Intl.DateTimeFormat(
    'id-ID',
    opts ?? { day: 'numeric', month: 'short', year: 'numeric' },
  ).format(new Date(`${date}T12:00:00`));
export function balances(store: Pick<Store, 'accounts' | 'transactions'>) {
  const result: Record<string, number> = Object.fromEntries(
    store.accounts.map((a) => [a.id, a.opening]),
  );
  for (const t of store.transactions) {
    result[t.accountId] += t.kind === 'income' ? t.amount : -(t.amount + t.fee);
    if (t.kind === 'transfer' && t.toId) result[t.toId] += t.amount;
  }
  return result;
}
export function totals(transactions: Transaction[], month?: string) {
  return transactions
    .filter((t) => !month || t.date.startsWith(month))
    .reduce(
      (acc, t) => ({
        income: acc.income + (t.kind === 'income' ? t.amount : 0),
        expense: acc.expense + (t.kind === 'expense' ? t.amount : 0) + t.fee,
      }),
      { income: 0, expense: 0 },
    );
}
export function allocations(store: Store) {
  const b = balances(store);
  const personal = store.accounts.filter((a) => !a.shared).reduce((s, a) => s + b[a.id], 0);
  const available = Math.max(0, personal - store.plan.reserve);
  const saving = Math.floor((available * store.plan.saving) / 100);
  const fun = Math.floor((available * store.plan.fun) / 100);
  return {
    personal,
    available,
    saving,
    fun,
    together: Math.floor((available * store.plan.together) / 100),
    shortfall: Math.max(0, store.plan.reserve - personal),
  };
}
export function spendingByCategory(tx: Transaction[], month: string) {
  const result: Record<string, number> = {};
  tx.filter((t) => t.date.startsWith(month)).forEach((t) => {
    if (t.kind === 'expense') result[t.category] = (result[t.category] ?? 0) + t.amount;
    if (t.fee) result['Biaya transfer'] = (result['Biaya transfer'] ?? 0) + t.fee;
  });
  return Object.entries(result).sort((a, b) => b[1] - a[1]);
}
export function validateTransaction(t: Transaction, store: Store) {
  if (!['income', 'expense', 'transfer'].includes(t.kind)) return 'Jenis transaksi tidak valid.';
  if (!t.title.trim()) return 'Isi nama transaksi terlebih dahulu.';
  if (!Number.isSafeInteger(t.amount) || t.amount <= 0 || t.amount > 1e12)
    return 'Nominal harus berupa rupiah utuh, lebih dari nol, maksimal Rp1 triliun.';
  if (
    !Number.isSafeInteger(t.fee) ||
    t.fee < 0 ||
    t.fee > 1e9 ||
    (t.kind === 'income' && t.fee !== 0)
  )
    return 'Biaya transaksi tidak valid.';
  if (!validDate(t.date) || t.date > today())
    return 'Pilih tanggal transaksi yang valid, paling lambat hari ini.';
  if (!store.accounts.some((a) => a.id === t.accountId)) return 'Pilih rekening sumber yang valid.';
  if (
    t.kind === 'transfer' &&
    (!store.accounts.some((a) => a.id === t.toId) || t.toId === t.accountId)
  )
    return 'Rekening tujuan harus berbeda dari rekening sumber.';
  if (t.kind === 'income' && !t.source.trim())
    return 'Isi asal pemasukan, misalnya freelance atau hadiah.';
  if (t.kind === 'expense' && !categories.includes(t.category))
    return 'Pilih kategori pengeluaran.';
  if (t.kind !== 'income' && t.amount + t.fee > balances(store)[t.accountId])
    return 'Saldo tercatat belum cukup. Periksa rekening sumber atau catat pemasukan yang belum masuk.';
  if (t.receiptHash && store.transactions.some((x) => x.receiptHash === t.receiptHash))
    return 'Bukti ini sudah pernah dicatat. Periksa riwayat agar saldo tidak terhitung dua kali.';
  if (
    t.reference &&
    store.transactions.some(
      (x) =>
        x.reference?.toLowerCase() === t.reference?.toLowerCase() && x.accountId === t.accountId,
    )
  )
    return 'Nomor referensi ini sudah tercatat pada rekening yang sama.';
  return '';
}

export function replaceTransaction(
  store: Store,
  transaction: Transaction,
  editingId?: string,
): { data?: Store; error: string } {
  if (editingId && !store.transactions.some((t) => t.id === editingId))
    return { error: 'Transaksi yang ingin diubah sudah tidak tersedia.' };
  const withoutOriginal = {
    ...store,
    transactions: store.transactions.filter((t) => t.id !== editingId),
  };
  const error = validateTransaction(transaction, withoutOriginal);
  if (error) return { error };
  const data = {
    ...store,
    transactions: editingId
      ? store.transactions.map((t) => (t.id === editingId ? transaction : t))
      : [transaction, ...store.transactions],
  };
  if (Object.values(balances(data)).some((n) => n < 0))
    return {
      error:
        'Perubahan membuat saldo rekening lain negatif. Periksa transaksi yang sudah memakai dana ini.',
    };
  return { data, error: '' };
}
function validDate(s: unknown): s is string {
  return (
    typeof s === 'string' &&
    /^\d{4}-\d{2}-\d{2}$/.test(s) &&
    !Number.isNaN(Date.parse(s)) &&
    new Date(s).toISOString().slice(0, 10) === s
  );
}
const amountValid = (x: unknown, max = 1e12) =>
  typeof x === 'number' && Number.isSafeInteger(x) && x >= 0 && x <= max;
const str = (x: unknown, max = 500) => typeof x === 'string' && x.length <= max;
export function isStore(data: unknown): data is Store {
  if (!data || typeof data !== 'object') return false;
  const d = data as Store;
  if (
    d.version !== 1 ||
    typeof d.demo !== 'boolean' ||
    !Array.isArray(d.accounts) ||
    !Array.isArray(d.transactions) ||
    !Array.isArray(d.goals) ||
    !d.plan
  )
    return false;
  if (d.accounts.length > 100 || d.transactions.length > 50000 || d.goals.length > 100)
    return false;
  const ids = new Set<string>();
  for (const a of d.accounts) {
    if (
      !a ||
      !str(a.id, 100) ||
      ids.has(a.id) ||
      !str(a.name, 60) ||
      !a.name.trim() ||
      !str(a.provider, 60) ||
      !amountValid(a.opening) ||
      typeof a.shared !== 'boolean' ||
      !/^#[\da-f]{6}$/i.test(a.color) ||
      !/^\d{0,4}$/.test(a.suffix)
    )
      return false;
    ids.add(a.id);
  }
  const tids = new Set<string>();
  const hashes = new Set<string>();
  for (const t of d.transactions) {
    if (
      !t ||
      !str(t.id, 100) ||
      tids.has(t.id) ||
      !['income', 'expense', 'transfer'].includes(t.kind) ||
      !str(t.title, 100) ||
      !t.title.trim() ||
      !amountValid(t.amount) ||
      t.amount === 0 ||
      !amountValid(t.fee, 1e9) ||
      !validDate(t.date) ||
      t.date > today() ||
      !ids.has(t.accountId) ||
      !str(t.category) ||
      !str(t.source) ||
      !str(t.note, 2000)
    )
      return false;
    if (t.kind === 'income' && (t.fee !== 0 || !t.source.trim())) return false;
    if (t.kind === 'expense' && !categories.includes(t.category)) return false;
    if (t.kind === 'transfer' && (!ids.has(t.toId ?? '') || t.toId === t.accountId)) return false;
    if (t.receiptId !== undefined && !str(t.receiptId, 100)) return false;
    if (t.reference !== undefined && !str(t.reference, 100)) return false;
    if (
      t.receiptHash !== undefined &&
      (!/^[a-f0-9]{64}$/.test(t.receiptHash) || hashes.has(t.receiptHash))
    )
      return false;
    if (t.receiptHash) hashes.add(t.receiptHash);
    tids.add(t.id);
  }
  const gids = new Set<string>();
  const goalAccounts = new Set<string>();
  for (const g of d.goals) {
    if (
      !g ||
      !str(g.id, 100) ||
      gids.has(g.id) ||
      !str(g.name, 60) ||
      !g.name.trim() ||
      !amountValid(g.target) ||
      g.target === 0 ||
      !ids.has(g.accountId) ||
      goalAccounts.has(g.accountId) ||
      !str(g.emoji, 12)
    )
      return false;
    gids.add(g.id);
    goalAccounts.add(g.accountId);
  }
  return (
    amountValid(d.plan.reserve) &&
    [d.plan.saving, d.plan.fun, d.plan.together].every((n) => amountValid(n, 100)) &&
    d.plan.saving + d.plan.fun + d.plan.together === 100 &&
    Object.values(balances(d)).every((n) => Number.isSafeInteger(n) && n >= 0)
  );
}
export function emptyStore(): Store {
  return {
    version: 1,
    demo: false,
    accounts: [],
    transactions: [],
    goals: [],
    plan: { reserve: 0, saving: 50, fun: 30, together: 20 },
  };
}
export function demoStore(): Store {
  const accounts: Account[] = [
    {
      id: 'sea',
      name: 'Daily essentials',
      provider: 'SeaBank',
      opening: 4850000,
      color: '#ee752f',
      shared: false,
      suffix: '2048',
    },
    {
      id: 'jago',
      name: 'Future me',
      provider: 'Bank Jago',
      opening: 3200000,
      color: '#e9aa3b',
      shared: false,
      suffix: '8891',
    },
    {
      id: 'ovo',
      name: 'Little treats',
      provider: 'OVO',
      opening: 525000,
      color: '#615094',
      shared: false,
      suffix: '0812',
    },
    {
      id: 'dana',
      name: 'On the go',
      provider: 'DANA',
      opening: 375000,
      color: '#2192d7',
      shared: false,
      suffix: '0812',
    },
    {
      id: 'shared',
      name: 'Our little future',
      provider: 'Bank Jago',
      opening: 1650000,
      color: '#e9aa3b',
      shared: true,
      suffix: '1206',
    },
  ];
  const rows: Array<
    [number, Transaction['kind'], string, number, string, string, string, string?]
  > = [
    [
      24,
      'income',
      'Brand identity project',
      2800000,
      'sea',
      'Pemasukan',
      'Freelance · Studio Nusa',
    ],
    [22, 'expense', 'Belanja bulanan', 365000, 'sea', 'Belanja', ''],
    [20, 'transfer', 'A little for our future', 450000, 'sea', 'Transfer', '', 'shared'],
    [18, 'expense', 'Spotify Premium', 54990, 'dana', 'Langganan', ''],
    [16, 'expense', 'Lunch with the team', 85000, 'ovo', 'Makanan & minuman', ''],
    [14, 'income', 'Website landing page', 1750000, 'sea', 'Pemasukan', 'Freelance · Kopi Sore'],
    [11, 'expense', 'Internet rumah', 310000, 'sea', 'Kuota & internet', ''],
    [9, 'expense', 'Weekly groceries', 245000, 'sea', 'Belanja', ''],
    [7, 'transfer', 'Tabungan dana darurat', 1000000, 'sea', 'Transfer', '', 'jago'],
    [5, 'expense', 'Grab to everywhere', 42000, 'dana', 'Transportasi', ''],
    [3, 'income', 'Illustration commission', 650000, 'sea', 'Pemasukan', 'Komisi · Klien pribadi'],
    [2, 'expense', 'Kopi Kenangan', 28000, 'ovo', 'Makanan & minuman', ''],
    [1, 'expense', 'Paket data Telkomsel', 85000, 'sea', 'Kuota & internet', ''],
    [0, 'expense', 'A good lunch', 45000, 'ovo', 'Makanan & minuman', ''],
  ];
  return {
    version: 1,
    demo: true,
    accounts,
    transactions: rows.map((r, i) => ({
      id: `demo-${i}`,
      date: daysAgo(r[0]),
      kind: r[1],
      title: r[2],
      amount: r[3],
      accountId: r[4],
      category: r[5],
      source: r[6],
      toId: r[7],
      fee: 0,
      note: '',
    })),
    goals: [
      { id: 'g1', name: 'Dana darurat', accountId: 'jago', target: 15000000, emoji: '🌱' },
      { id: 'g2', name: 'A home for two', accountId: 'shared', target: 10000000, emoji: '🏡' },
    ],
    plan: { reserve: 2500000, saving: 50, fun: 30, together: 20 },
  };
}
export function balanceHistory(store: Store, count: number) {
  const b = balances(store);
  let value = Object.values(b).reduce((s, n) => s + n, 0);
  const points: { date: string; value: number }[] = [];
  for (let i = 0; i < count; i++) {
    const date = daysAgo(i);
    points.unshift({ date, value });
    for (const t of store.transactions.filter((t) => t.date === date))
      value -= (t.kind === 'income' ? t.amount : t.kind === 'expense' ? -t.amount : 0) - t.fee;
  }
  return points;
}
export function csv(transactions: Transaction[], accounts: Account[]) {
  const cell = (v: string | number) =>
    `"${String(v)
      .replace(/^[=+@\-\t\r]/, "'$&")
      .replaceAll('"', '""')}"`;
  return (
    '\uFEFF' +
    [
      [
        'Tanggal',
        'Jenis',
        'Nama',
        'Nominal (IDR)',
        'Biaya (IDR)',
        'Rekening',
        'Tujuan',
        'Kategori',
        'Asal pemasukan',
        'Catatan',
      ],
      ...transactions.map((t) => [
        t.date,
        t.kind,
        t.title,
        t.amount,
        t.fee,
        accounts.find((a) => a.id === t.accountId)?.name ?? '',
        accounts.find((a) => a.id === t.toId)?.name ?? '',
        t.category,
        t.source,
        t.note,
      ]),
    ]
      .map((row) => row.map(cell).join(','))
      .join('\r\n')
  );
}
