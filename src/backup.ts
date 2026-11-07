import { isStore, normalizeCategory } from './domain';
import type { Store, Transaction } from './domain';

// A restore is available only into an empty account. It cannot overwrite newer
// shared data. Legacy local IDs become UUIDs; image attachments are never retained.
export function readBackup(archive: unknown): Store {
  const data = archive as { format?: string; version?: number; data?: unknown };
  if (
    !data ||
    !['skywallet-backup', 'skysave-backup'].includes(data.format ?? '') ||
    data.version !== 1 ||
    !isStore(data.data)
  )
    throw new Error('Berkas bukan cadangan SkyWallet yang valid.');
  const old = data.data;
  if (old.accounts.length + old.transactions.length + old.goals.length > 1999)
    throw new Error(
      'Pemulihan otomatis dibatasi 1.999 catatan per arsip. Gunakan migrasi database untuk arsip yang lebih besar.',
    );
  const ids = new Map(old.accounts.map((a) => [a.id, crypto.randomUUID()]));
  const transactions: Transaction[] = old.transactions.map((t) => {
    if (!ids.has(t.accountId) || (t.toId && !ids.has(t.toId)))
      throw new Error(
        'Arsip berisi transfer ke rekening pribadi anggota lain. Pulihkan melalui pemilik sumber rekening.',
      );
    const category =
      t.kind === 'income'
        ? 'Pemasukan'
        : t.kind === 'transfer'
          ? 'Transfer'
          : normalizeCategory(t.category);
    return {
      id: crypto.randomUUID(),
      kind: t.kind,
      title: category,
      category,
      amount: t.amount,
      fee: t.fee,
      date: t.date,
      accountId: ids.get(t.accountId)!,
      toId: t.toId ? ids.get(t.toId)! : undefined,
      source: t.source,
      note: [t.title !== t.category ? t.title : '', t.note]
        .filter(Boolean)
        .join('\n')
        .slice(0, 2200),
      reference: t.reference,
      receiptHash: t.receiptHash,
    };
  });
  // Resolve dependencies before writing the atomic import, even for unsorted
  // backups containing same-day transfers or income after an expense in the file.
  const values = Object.fromEntries(old.accounts.map((a) => [ids.get(a.id)!, a.opening]));
  const pending = [...transactions].sort((a, b) => a.date.localeCompare(b.date));
  const ordered: Transaction[] = [];
  while (pending.length) {
    const index = pending.findIndex(
      (t) => t.kind === 'income' || values[t.accountId] >= t.amount + t.fee,
    );
    if (index < 0)
      throw new Error('Cadangan memiliki rangkaian saldo negatif yang tidak dapat dipulihkan.');
    const [t] = pending.splice(index, 1);
    values[t.accountId] += t.kind === 'income' ? t.amount : -t.amount - t.fee;
    if (t.kind === 'transfer' && t.toId) values[t.toId] += t.amount;
    ordered.push(t);
  }
  return {
    version: 1,
    demo: false,
    accounts: old.accounts.map((a) => ({
      id: ids.get(a.id)!,
      name: a.name,
      provider: a.provider,
      color: a.color,
      suffix: a.suffix,
      shared: a.shared,
      opening: a.opening,
    })),
    transactions: ordered,
    goals: old.goals.map((g) => ({
      id: crypto.randomUUID(),
      accountId: ids.get(g.accountId)!,
      name: g.name,
      target: g.target,
      emoji: g.emoji,
    })),
    plan: {
      reserve: old.plan.reserve,
      saving: old.plan.saving,
      fun: old.plan.fun,
      together: old.plan.together,
    },
  };
}
