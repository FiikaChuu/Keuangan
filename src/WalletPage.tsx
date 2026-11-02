import type { ReactNode } from 'react';
import {
  ArrowLeftRight,
  Heart,
  House,
  Settings,
  Signal,
  UploadCloud,
  Wallet,
  Wifi,
} from 'lucide-react';
import type { Account, Store } from './domain';
import { balances, money } from './domain';
import { MoneyAmount } from './MoneyAmount';

// Framer's newer Lucide outline; license: assets/icons/LUCIDE-LICENSE.txt.
function WalletPiggyBank() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path
        transform="translate(5 3)"
        d="M6 14H9V16C9 16.552 9.448 17 10 17H12C12.552 17 13 16.552 13 16V13C13.944 12.686 14.686 11.944 15 11H16C16.552 11 17 10.552 17 10V8C17 7.448 16.552 7 16 7H15C15 5.426 14.259 3.944 13 3V0C11.741 0 10.555 0.593 9.8 1.6L9.5 2H6C2.686 2 0 4.686 0 8V9C0 10.574 0.741 12.056 2 13V16C2 16.552 2.448 17 3 17H5C5.552 17 6 16.552 6 16Z"
      />
      <path d="M16 10h.01M2 8v1a2 2 0 0 0 2 2h1" />
    </svg>
  );
}

/** The phone chrome belongs to the supplied Framer mockup, so it is decorative. */
export function WalletStatusBar() {
  return (
    <div className="framer-wallet-status" aria-hidden="true">
      <span>9:41</span>
      <div>
        <Signal size={17} />
        <Wifi size={17} />
        <span className="framer-wallet-battery" />
      </div>
    </div>
  );
}

export function WalletNavigation({
  go,
  onUpload,
}: {
  go: (page: 'overview' | 'accounts' | 'transactions' | 'settings') => void;
  onUpload: () => void;
}) {
  return (
    <nav className="framer-wallet-nav" aria-label="Navigasi mobile">
      <div className="framer-wallet-nav-items">
        <button aria-label="Ringkasan" onClick={() => go('overview')}>
          <House size={22} />
          <span>Beranda</span>
        </button>
        <button aria-label="Dompet saya" aria-current="page" onClick={() => go('accounts')}>
          <Wallet size={22} />
          <span>Dompet</span>
        </button>
        <button className="framer-wallet-capture" aria-label="Catat transaksi" onClick={onUpload}>
          <span className="framer-wallet-cloud">
            <UploadCloud size={28} />
          </span>
          <span>Catat</span>
        </button>
        <button aria-label="Transaksi" onClick={() => go('transactions')}>
          <ArrowLeftRight size={22} />
          <span>Transaksi</span>
        </button>
        <button aria-label="Pengaturan" onClick={() => go('settings')}>
          <Settings size={22} />
          <span>Setelan</span>
        </button>
      </div>
      <span className="framer-wallet-home" aria-hidden="true" />
    </nav>
  );
}

export default function WalletPage({
  store,
  onAdd,
  onPlan,
  onTogether,
  onExample,
  accountCard,
}: {
  store: Store;
  onAdd: (shared?: boolean) => void;
  onPlan: () => void;
  onTogether: () => void;
  onExample: () => void;
  accountCard: (account: Account, full?: boolean) => ReactNode;
}) {
  const values = balances(store);
  const personal = store.accounts.filter((a) => !a.shared);
  const shared = store.accounts.filter((a) => a.shared);
  const personalTotal = personal.reduce((sum, a) => sum + values[a.id], 0);
  const sharedTotal = shared.reduce((sum, a) => sum + values[a.id], 0);
  return (
    <section className="framer-wallet-page" aria-labelledby="wallet-page-title">
      <header className="framer-wallet-heading">
        <h1 id="wallet-page-title">Dompet</h1>
        <p>Saldo rekening dan e-walletmu.</p>
        {store.demo && <span className="framer-wallet-demo">Data contoh</span>}
      </header>
      <button className="framer-wallet-button" onClick={() => onAdd()}>
        <Wallet size={18} />
        Tambah dompet
      </button>
      <section className="framer-wallet-summary" aria-label="Saldo dompet">
        <p>Total seluruh dompet</p>
        <strong className="framer-wallet-total" title={money(personalTotal + sharedTotal)}>
          {money(personalTotal + sharedTotal)}
        </strong>
        <div className="framer-wallet-breakdown">
          <div>
            <p>Pribadi</p>
            <strong title={money(personalTotal)}>{money(personalTotal)}</strong>
          </div>
          <div>
            <p>Bersama</p>
            <strong title={money(sharedTotal)}>{money(sharedTotal)}</strong>
          </div>
        </div>
      </section>
      <div className="wallet-tools framer-wallet-tools">
        <button onClick={onPlan}>
          <WalletPiggyBank />
          <span>Rencana uang</span>
        </button>
        <button onClick={onTogether}>
          <Heart size={18} />
          <span>Ruang bersama</span>
        </button>
      </div>
      <h2>Dompet pribadi</h2>
      <p className="framer-wallet-count">
        {personal.length} dompet&nbsp; • &nbsp;Bank &amp; e-wallet
      </p>
      {personal.length ? (
        <div className="framer-wallet-list">{personal.map((a) => accountCard(a, true))}</div>
      ) : (
        <div className="framer-wallet-empty">
          <span className="framer-wallet-illustration">
            <Wallet size={27} />
          </span>
          <h2>Beri setiap rupiah tempatnya</h2>
          <p>Mulai dengan rekening yang paling sering kamu gunakan dan masukkan saldo awalnya.</p>
          <button className="framer-wallet-button" onClick={() => onAdd()}>
            <Wallet size={18} />
            Tambah dompet pertama
          </button>
        </div>
      )}
      <button className="framer-wallet-button framer-wallet-example" onClick={onExample}>
        <Wallet size={18} />
        Lihat contoh detail dompet
      </button>
      {shared.length > 0 && (
        <>
          <h2>Dompet bersama</h2>
          <div className="framer-wallet-list">{shared.map((a) => accountCard(a, true))}</div>
        </>
      )}
    </section>
  );
}

/** This read-only example never adds a wallet or alters the user's balance. */
export function WalletExample() {
  return (
    <div className="framer-wallet-example-detail">
      <span className="framer-wallet-illustration">
        <Wallet size={27} />
      </span>
      <h3>Dompet harian</h3>
      <p>Contoh rekening pribadi</p>
      <strong>
        <MoneyAmount value={500000} />
      </strong>
      <p>Ini hanya contoh. Saldo dan transaksi dompetmu tidak berubah.</p>
    </div>
  );
}
