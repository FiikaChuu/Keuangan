import type { ReactNode } from 'react';
import { Heart, PiggyBank, Wallet } from 'lucide-react';
import type { Account, Store } from './domain';
import { balances } from './domain';
import { MoneyAmount } from './MoneyAmount';
import { EmptyState } from './ui';

export default function WalletPage({
  store,
  onAdd,
  onPlan,
  onTogether,
  accountCard,
}: {
  store: Store;
  onAdd: (shared?: boolean) => void;
  onPlan: () => void;
  onTogether: () => void;
  accountCard: (account: Account, full?: boolean) => ReactNode;
}) {
  const values = balances(store);
  const personal = store.accounts.filter((a) => !a.shared);
  const shared = store.accounts.filter((a) => a.shared);
  const personalTotal = personal.reduce((sum, a) => sum + values[a.id], 0);
  const sharedTotal = shared.reduce((sum, a) => sum + values[a.id], 0);
  return (
    <section className="wallet-page">
      <header className="page-heading">
        <div>
          <h1>Dompet</h1>
          <p>Saldo rekening dan e-walletmu.</p>
        </div>
      </header>
      <button className="btn primary full-width" onClick={() => onAdd()}>
        <Wallet size={18} />
        Tambah dompet
      </button>
      <section className="wallet-summary" aria-label="Saldo dompet">
        <p>Total seluruh dompet</p>
        <strong className="wallet-total">
          <MoneyAmount value={personalTotal + sharedTotal} />
        </strong>
        <div className="wallet-breakdown">
          <div>
            <p>Pribadi</p>
            <strong>
              <MoneyAmount value={personalTotal} />
            </strong>
          </div>
          <div>
            <p>Bersama</p>
            <strong>
              <MoneyAmount value={sharedTotal} />
            </strong>
          </div>
        </div>
      </section>
      <div className="wallet-tools">
        <button onClick={onPlan}>
          <PiggyBank size={19} />
          Rencana uang
        </button>
        <button onClick={onTogether}>
          <Heart size={19} />
          Ruang bersama
        </button>
      </div>
      <div className="section-title">
        <h2>Dompet pribadi</h2>
        <span>{personal.length} dompet</span>
      </div>
      {personal.length ? (
        <div className="wallet-grid">{personal.map((a) => accountCard(a, true))}</div>
      ) : (
        <EmptyState
          icon={<Wallet size={27} />}
          title="Beri setiap rupiah tempatnya"
          text="Mulai dengan rekening yang paling sering kamu gunakan dan masukkan saldo awalnya."
          action={
            <button className="btn primary full-width" onClick={() => onAdd()}>
              <Wallet size={18} />
              Tambah dompet pertama
            </button>
          }
        />
      )}
      {shared.length > 0 && (
        <>
          <div className="section-title">
            <h2>Dompet bersama</h2>
            <button className="text-btn" onClick={() => onAdd(true)}>
              Tambah
            </button>
          </div>
          <div className="wallet-grid">{shared.map((a) => accountCard(a, true))}</div>
        </>
      )}
    </section>
  );
}
