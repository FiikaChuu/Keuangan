import { useRef, useState, type ReactNode } from 'react';
import { Wallet } from 'lucide-react';
import type { Account, Store } from './domain';
import { balances } from './domain';
import { MoneyAmount } from './MoneyAmount';
import { EmptyState } from './ui';
import { WalletTexture, WalletGlyph } from './WalletArt';

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
  const rail = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(0);
  return (
    <section className="wallet-page">
      <header className="page-heading">
        <div>
          <h1>Dompet</h1>
          <p>Saldo rekening dan e-walletmu.</p>
        </div>
      </header>
      <div className="wallet-overview-band">
        {store.accounts.length > 0 && (
          <div className="wallet-carousel">
            <div
              className="wallet-carousel-rail"
              ref={rail}
              aria-label="Kartu dompet"
              onScroll={() => {
                const node = rail.current;
                if (node) setActive(Math.round(node.scrollLeft / (node.clientWidth + 16)));
              }}
            >
              {store.accounts.map((a, index) => (
                <section
                  key={a.id}
                  className="wallet-command wallet-slide"
                  aria-label={`Dompet ${index + 1}: ${a.name}`}
                >
                  <WalletTexture />
                  <div className="wallet-switch">
                    <WalletGlyph name={a.id} size={20} />
                    <strong>{a.name}</strong>
                  </div>
                  <div className="balance-label">Saldo dompet</div>
                  <strong className="figma-balance-amount">
                    <MoneyAmount value={values[a.id]} />
                  </strong>
                  <div className="orb-controls">
                    <span>
                      {a.provider}
                      {a.suffix ? ` •• ${a.suffix}` : ''}
                    </span>
                    <span>{a.shared ? 'Bersama' : 'Pribadi'}</span>
                  </div>
                </section>
              ))}
            </div>
            <div className="wallet-carousel-bars" aria-label="Pilih kartu dompet">
              {store.accounts.map((a, index) => (
                <button
                  key={a.id}
                  aria-label={`Lihat dompet ${index + 1}: ${a.name}`}
                  aria-current={
                    Math.min(active, store.accounts.length - 1) === index ? 'true' : undefined
                  }
                  onClick={() =>
                    rail.current?.scrollTo({
                      left: index * (rail.current.clientWidth + 16),
                      behavior: 'smooth',
                    })
                  }
                />
              ))}
            </div>
          </div>
        )}
        <button className="wallet-add-action" onClick={() => onAdd()}>
          <span>+</span>Tambah dompet
        </button>
      </div>
      <div className="wallet-tools">
        <button onClick={onPlan}>
          <WalletGlyph name="category-saving" size={22} />
          Rencana uang
        </button>
        <button onClick={onTogether}>
          <WalletGlyph name="category-together" size={22} />
          Ruang bersama
        </button>
      </div>
      <div className="section-title">
        <h2>Dompet pribadi</h2>
        <span>{personal.length} dompet</span>
      </div>
      {personal.length ? (
        <div className="wallet-grid">
          {personal.map((a) => (
            <div key={a.id}>
              {accountCard(a, true)}

            </div>
          ))}
        </div>
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
          <div className="wallet-grid">
            {shared.map((a) => (
              <div key={a.id}>
                {accountCard(a, true)}

              </div>
            ))}
          </div>
        </>
      )}
    </section>
  );
}
