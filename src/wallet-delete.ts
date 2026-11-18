import { balances, type Account, type Store } from './domain';
export function walletDeletionReason(store: Store, account: Account): string | null {
  if (account.readOnly) return 'Hanya pemilik dompet yang dapat menghapusnya.';
  if (
    store.transactions.some((t) => t.accountId === account.id || t.toId === account.id) ||
    store.goals.some((g) => g.accountId === account.id)
  )
    return 'Dompet memiliki riwayat transaksi atau tujuan. Penghapusan diblokir untuk melindungi catatan.';
  if (
    account.opening !== 0 ||
    balances({
      ...store,
      accounts: store.accounts.map((a) => (a.id === account.id ? account : a)),
    })[account.id] !== 0
  )
    return 'Hanya dompet kosong tanpa saldo yang dapat dihapus.';
  return null;
}
