import { useId, useMemo, useRef, useState } from 'react';
import { m, useReducedMotion } from 'framer-motion';
import type { FormEvent } from 'react';
import {
  Check,
  LoaderCircle,
  ArrowRight,
  ShieldCheck,
  Info,
  Plus,
  Trash2,
  ArrowLeftRight,
  Pencil,
  ChevronDown,
} from 'lucide-react';
import type { Store, Transaction, Account, Goal } from './domain';
import {
  normalizeCategory,
  providers,
  today,
  money,
  balances,
  replaceTransaction,
  MAX_NOTE_LENGTH,
} from './domain';
import { AnimatedReveal, sheetSpring } from './motion';
import { EmptyState, CategoryPicker, AccountPicker, ProviderPicker } from './ui';

type Save = (next: Store) => Promise<boolean>;
export function TransactionForm({
  store,
  save,
  close,
  amountIncludesFee = false,
  defaults = {},
  onAccount,
  editingId,
}: {
  store: Store;
  save: Save;
  close: () => void;
  amountIncludesFee?: boolean;
  defaults?: Partial<Transaction>;
  editingId?: string;
  onAccount: () => void;
}) {
  const [newId] = useState(() => crypto.randomUUID());
  const submitting = useRef(false);
  const [flow, setFlow] = useState<'expense' | 'income'>(
    defaults.kind === 'income' ? 'income' : 'expense',
  );
  const [amount, setAmount] = useState(defaults.amount ? String(defaults.amount) : '');
  const [accountId, setAccountId] = useState(
    defaults.accountId ?? store.accounts.find((a) => !a.shared)?.id ?? store.accounts[0]?.id ?? '',
  );
  const [toId, setToId] = useState(defaults.toId ?? '');
  const [date, setDate] = useState(defaults.date ?? today());
  const [category, setCategory] = useState(
    defaults.kind === 'transfer' ? 'Transfer' : normalizeCategory(defaults.category ?? 'Makan'),
  );
  const kind = flow === 'income' ? 'income' : category === 'Transfer' ? 'transfer' : 'expense';
  const transactionCategory = kind === 'income' ? 'Pemasukan' : category;
  const [source, setSource] = useState(defaults.source ?? '');
  const [fee, setFee] = useState(defaults.fee ? String(defaults.fee) : '');
  const [note, setNote] = useState(() => {
    const oldTitle =
      editingId &&
      defaults.title &&
      defaults.title !==
        (defaults.kind === 'income'
          ? 'Pemasukan'
          : defaults.kind === 'transfer'
            ? 'Transfer'
            : defaults.category)
        ? defaults.title
        : '';
    return [oldTitle, defaults.note].filter(Boolean).join('\n\n');
  });
  const [detailsOpen, setDetailsOpen] = useState(
    !!(amountIncludesFee || defaults.fee || note || defaults.reference),
  );
  const detailsId = useId();
  const reducedMotion = useReducedMotion();
  const accountBalances = useMemo(() => balances(store), [store]);
  const destinationAccounts = useMemo(
    () => store.accounts.filter((account) => account.id !== accountId),
    [store.accounts, accountId],
  );
  const [reference, setReference] = useState(defaults.reference ?? '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  async function submit(e: FormEvent) {
    e.preventDefault();
    if (submitting.current) return;
    setError('');
    if (amountIncludesFee && kind === 'transfer' && fee === '') {
      setDetailsOpen(true);
      setError('Konfirmasi biaya admin pada nota. Isi 0 jika tidak ada biaya.');
      return;
    }
    const tx: Transaction = {
      id: editingId ?? newId,
      version: defaults.version,
      kind,
      title: transactionCategory,
      amount: Number(amount) - (amountIncludesFee && kind !== 'income' ? Number(fee || 0) : 0),
      fee: kind === 'income' ? 0 : Number(fee || 0),
      date,
      accountId,
      toId: kind === 'transfer' ? toId : undefined,
      category: transactionCategory,
      source: kind === 'income' ? source.trim() : '',
      note: note.trim(),
      reference: reference.trim() || undefined,
      receiptHash: defaults.receiptHash,
    };
    const result = replaceTransaction(store, tx, editingId);
    if (result.error || !result.data) {
      setError(result.error);
      return;
    }
    submitting.current = true;
    setSaving(true);
    try {
      if (await save(result.data)) close();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Transaksi belum tersimpan. Coba lagi.');
    } finally {
      submitting.current = false;
      setSaving(false);
    }
  }
  if (!store.accounts.length)
    return (
      <EmptyState
        title="Buat dompet pertamamu"
        text="Tambahkan rekening atau e-wallet beserta saldo awalnya sebelum mencatat transaksi."
        action={
          <button className="btn primary" onClick={onAccount}>
            <Plus size={16} />
            Tambah rekening
          </button>
        }
      />
    );
  return (
    <form onSubmit={submit} className="form-stack modal-form">
      <m.div className="modal-form-content" layoutScroll>
        {amountIncludesFee && (
          <p className="info-note">
            Hasil baca nota perlu diperiksa. Total sudah termasuk biaya admin. Untuk transfer, pilih
            hanya rekening milikmu atau akun bersama; pembayaran ke merchant tetap dicatat sesuai
            kategori pengeluarannya.
          </p>
        )}
        <div className="kind-switch" aria-label="Jenis transaksi">
          {(['expense', 'income'] as const).map((k) => (
            <button
              type="button"
              key={k}
              className={flow === k ? 'active' : ''}
              aria-pressed={flow === k}
              onClick={() => {
                setFlow(k);
                setError('');
              }}
            >
              {{ expense: 'Pengeluaran', income: 'Pemasukan' }[k]}
            </button>
          ))}
        </div>
        <AnimatedReveal open={flow === 'expense'}>
          <div className="category-form-field">
            <span className="field-label">Kategori</span>
            <CategoryPicker
              quick
              value={category}
              onChange={(value) => {
                setCategory(value);
                setError('');
              }}
            />
            {category === 'Tarik tunai' && (
              <small className="field-hint">
                Dihitung sebagai pengeluaran. Tidak menambah dompet tunai.
              </small>
            )}
          </div>
        </AnimatedReveal>
        <div className="form-grid">
          <label>
            {amountIncludesFee && kind !== 'income' ? 'Total terdebet (Rp)' : 'Nominal (Rp)'}
            <input
              type="number"
              inputMode="numeric"
              min="1"
              max="1000000000000"
              step="1"
              required
              placeholder="0"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
          </label>
          <label>
            Tanggal
            <input
              type="date"
              required
              max={today()}
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </label>
        </div>
        <div className="form-account-field">
          <span className="field-label">
            {kind === 'income'
              ? 'Masuk ke rekening'
              : kind === 'transfer'
                ? 'Dari bank/akun'
                : 'Dari rekening'}
          </span>
          <AccountPicker
            label={
              kind === 'income'
                ? 'Masuk ke rekening'
                : kind === 'transfer'
                  ? 'Dari bank/akun'
                  : 'Dari rekening'
            }
            accounts={store.accounts}
            values={accountBalances}
            value={accountId}
            onChange={(id) => {
              setAccountId(id);
              if (id === toId) setToId('');
              setError('');
            }}
          />
        </div>
        <AnimatedReveal open={kind === 'transfer'}>
          <div className="transfer-fields">
            <div className="form-account-field">
              <span className="field-label">Ke bank/akun</span>
              <AccountPicker
                label="Ke bank/akun"
                accounts={destinationAccounts}
                values={accountBalances}
                value={toId}
                onChange={(id) => {
                  setToId(id);
                  setError('');
                }}
              />
            </div>
            <p className="field-hint">
              <ArrowLeftRight size={14} />
              Saldo berpindah antar akun pribadi atau bersama. Hanya biaya admin dihitung sebagai
              pengeluaran.
            </p>
          </div>
        </AnimatedReveal>
        <AnimatedReveal open={kind === 'income'}>
          <label>
            Asal pemasukan
            <input
              required
              maxLength={500}
              placeholder="Mis. Freelance · Klien A, komisi, atau hadiah"
              value={source}
              onChange={(e) => setSource(e.target.value)}
            />
            <small className="field-hint">
              Tidak harus rutin. Catat saat uang benar-benar diterima.
            </small>
          </label>
        </AnimatedReveal>
        <m.section
          className="optional-fields"
          layout="position"
          layoutDependency={kind}
          transition={reducedMotion ? { duration: 0 } : sheetSpring}
        >
          <button
            type="button"
            className="optional-fields-toggle"
            aria-expanded={detailsOpen}
            aria-controls={detailsId}
            onClick={() => setDetailsOpen((open) => !open)}
          >
            <span>
              Detail tambahan
              <small>
                {kind === 'income'
                  ? 'Referensi dan catatan · opsional'
                  : 'Biaya, referensi, dan catatan · opsional'}
              </small>
            </span>
            <m.span
              aria-hidden="true"
              animate={{ rotate: detailsOpen ? 180 : 0 }}
              transition={reducedMotion ? { duration: 0 } : sheetSpring}
            >
              <ChevronDown size={18} />
            </m.span>
          </button>
          <AnimatedReveal open={detailsOpen} id={detailsId}>
            <div className="optional-fields-content">
              <div className="form-grid">
                {kind !== 'income' && (
                  <label>
                    Biaya admin (opsional)
                    <input
                      type="number"
                      inputMode="numeric"
                      min="0"
                      max="1000000000"
                      step="1"
                      placeholder="0"
                      value={fee}
                      onChange={(e) => setFee(e.target.value)}
                    />
                  </label>
                )}
                <label>
                  No. referensi (opsional)
                  <input
                    maxLength={100}
                    value={reference}
                    placeholder="Untuk cek duplikat"
                    onChange={(e) => setReference(e.target.value)}
                  />
                </label>
              </div>
              <label>
                Catatan (opsional)
                <textarea
                  maxLength={MAX_NOTE_LENGTH}
                  rows={3}
                  placeholder="Detail kecil yang ingin kamu ingat…"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                />
              </label>
            </div>
          </AnimatedReveal>
        </m.section>
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
      </m.div>
      <div className="form-footer modal-form-actions">
        <p>
          <ShieldCheck size={14} />
          Hanya mengubah catatan SkyWallet, bukan saldo bank.
        </p>
        <button className="btn primary" disabled={saving} type="submit">
          {saving ? <LoaderCircle className="spin" size={16} /> : <Check size={16} />}
          {saving ? 'Menyimpan…' : 'Simpan transaksi'}
        </button>
      </div>
    </form>
  );
}
export function AccountForm({
  store,
  save,
  close,
  shared = false,
}: {
  store: Store;
  save: Save;
  close: () => void;
  shared?: boolean;
}) {
  const [provider, setProvider] = useState('SeaBank');
  const [newId] = useState(() => crypto.randomUUID());
  const submitting = useRef(false);
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState('');
  const [opening, setOpening] = useState('');
  const [suffix, setSuffix] = useState('');
  const [together, setTogether] = useState(shared);
  const [error, setError] = useState('');
  async function submit(e: FormEvent) {
    e.preventDefault();
    if (submitting.current) return;
    const amount = Number(opening || 0);
    if (!Number.isSafeInteger(amount) || amount < 0 || amount > 1e12 || !name.trim()) {
      setError('Isi nama rekening dan saldo awal berupa rupiah utuh yang valid.');
      return;
    }
    const p = providers.find((p) => p.name === provider)!;
    const a: Account = {
      id: newId,
      name: name.trim(),
      provider,
      opening: amount,
      suffix,
      shared: together,
      color: p.color,
    };
    submitting.current = true;
    setSaving(true);
    try {
      if (await save({ ...store, accounts: [...store.accounts, a] })) close();
    } finally {
      submitting.current = false;
      setSaving(false);
    }
  }
  return (
    <form onSubmit={submit} className="form-stack modal-form">
      <div className="modal-form-content">
        <div className="form-account-field">
          <span className="field-label">Bank atau e-wallet</span>
          <ProviderPicker value={provider} onChange={setProvider} />
        </div>
        <label>
          Nama dompet
          <input
            autoComplete="off"
            required
            maxLength={60}
            placeholder="Mis. Kebutuhan harian atau tabungan kita"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </label>
        <div className="form-grid">
          <label>
            Saldo awal (Rp)
            <input
              required
              type="number"
              min="0"
              max="1000000000000"
              step="1"
              inputMode="numeric"
              placeholder="0"
              value={opening}
              onChange={(e) => setOpening(e.target.value)}
            />
          </label>
          <label>
            4 digit terakhir (opsional)
            <input
              maxLength={4}
              inputMode="numeric"
              pattern="[0-9]{0,4}"
              placeholder="2048"
              value={suffix}
              onChange={(e) => setSuffix(e.target.value.replace(/\D/g, ''))}
            />
          </label>
        </div>
        <label className="checkbox-field">
          <input
            type="checkbox"
            checked={together}
            onChange={(e) => setTogether(e.target.checked)}
          />
          <span>
            <strong>Akun bersama</strong>
            <small>Pisahkan uang bersama dari dana pribadi yang bisa dialokasikan.</small>
          </span>
        </label>
        <div className="info-note">
          <Info size={17} />
          <span>
            Gunakan saldo saat mulai mencatat. Transaksi sebelum saldo awal tidak perlu dimasukkan
            lagi. Akun bersama hanya dapat diakses anggota yang diizinkan.
          </span>
        </div>
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
      </div>
      <div className="modal-form-actions">
        <button className="btn primary full-width" type="submit" disabled={saving}>
          Tambahkan dompet
          <ArrowRight size={16} />
        </button>
      </div>
    </form>
  );
}
export function GoalForm({ store, save, close }: { store: Store; save: Save; close: () => void }) {
  const [newId] = useState(() => crypto.randomUUID());
  const submitting = useRef(false);
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState('');
  const [target, setTarget] = useState('');
  const [accountId, setAccountId] = useState('');
  const [emoji, setEmoji] = useState('🌱');
  const [error, setError] = useState('');
  const available = store.accounts.filter((a) => !store.goals.some((g) => g.accountId === a.id));
  if (!available.length)
    return (
      <EmptyState
        title="Satu dompet, satu tujuan"
        text="Tambahkan dompet khusus yang belum dipakai untuk tujuan lain agar progres tabungan tidak dihitung dua kali."
      />
    );
  async function submit(e: FormEvent) {
    e.preventDefault();
    if (submitting.current) return;
    if (!available.some((a) => a.id === accountId)) {
      setError('Pilih rekening khusus tujuan ini terlebih dahulu.');
      return;
    }
    const amount = Number(target);
    if (
      !Number.isSafeInteger(amount) ||
      amount <= 0 ||
      amount > 1e12 ||
      !name.trim() ||
      !available.some((a) => a.id === accountId)
    )
      return;
    const goal: Goal = {
      id: newId,
      name: name.trim(),
      target: amount,
      accountId,
      emoji,
    };
    submitting.current = true;
    setSaving(true);
    try {
      if (await save({ ...store, goals: [...store.goals, goal] })) close();
    } finally {
      submitting.current = false;
      setSaving(false);
    }
  }
  return (
    <form className="form-stack modal-form" onSubmit={submit}>
      <div className="modal-form-content">
        <label>
          Nama tujuan
          <input
            required
            maxLength={60}
            placeholder="Mis. Liburan bareng atau dana darurat"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </label>
        <div className="emoji-picker">
          {['🌱', '🏡', '✈️', '💍', '🎓', '💻'].map((e) => (
            <button
              key={e}
              className={emoji === e ? 'selected' : ''}
              type="button"
              aria-label={`Pilih ikon ${e}`}
              onClick={() => setEmoji(e)}
            >
              {e}
            </button>
          ))}
        </div>
        <label>
          Target tabungan (Rp)
          <input
            type="number"
            required
            min="1"
            max="1000000000000"
            step="1"
            inputMode="numeric"
            value={target}
            onChange={(e) => setTarget(e.target.value)}
          />
        </label>
        <div className="form-account-field">
          <span className="field-label">Rekening khusus tujuan ini</span>
          <AccountPicker
            label="Rekening khusus tujuan ini"
            value={accountId}
            accounts={available}
            values={balances(store)}
            onChange={(value) => {
              setAccountId(value);
              setError('');
            }}
          />
        </div>
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
        <p className="field-hint">
          Progres mengikuti saldo tercatat pada dompet yang dipilih. Membuat tujuan tidak
          memindahkan uang.
        </p>
      </div>
      <div className="modal-form-actions">
        <button className="btn primary" type="submit" disabled={saving}>
          Mulai wujudkan
          <ArrowRight size={16} />
        </button>
      </div>
    </form>
  );
}
export function TransactionDetail({
  transaction: t,
  store,
  onDelete,
  onEdit,
}: {
  transaction: Transaction;
  store: Store;
  onDelete: () => void;
  onEdit: () => void;
}) {
  const account = store.accounts.find((a) => a.id === t.accountId) ?? {
    provider: 'Rekening pribadi',
    name: 'Anggota lain',
  };
  const to = store.accounts.find((a) => a.id === t.toId);
  return (
    <div className="detail-content">
      <div className={`detail-amount ${t.kind}`}>
        <small>
          {{ income: 'Pemasukan', expense: 'Pengeluaran', transfer: 'Perpindahan dana' }[t.kind]}
        </small>
        <strong>
          {t.kind === 'income' ? '+' : t.kind === 'expense' ? '−' : ''}
          {money(t.amount)}
        </strong>
      </div>
      <dl className="detail-list">
        <div>
          <dt>Tanggal</dt>
          <dd>{t.date}</dd>
        </div>
        <div>
          <dt>{t.kind === 'income' ? 'Masuk ke' : 'Dari'}</dt>
          <dd>
            {account.provider} · {account.name}
          </dd>
        </div>
        {to && (
          <div>
            <dt>Tujuan</dt>
            <dd>
              {to.provider} · {to.name}
            </dd>
          </div>
        )}
        <div>
          <dt>Kategori</dt>
          <dd>{t.category}</dd>
        </div>
        {t.source && (
          <div>
            <dt>Asal pemasukan</dt>
            <dd>{t.source}</dd>
          </div>
        )}
        <div>
          <dt>Biaya admin</dt>
          <dd>{money(t.fee)}</dd>
        </div>
        <div>
          <dt>Metode pencatatan</dt>
          <dd>
            {t.receiptHash ? 'Baca nota + konfirmasi (gambar tidak disimpan)' : 'Input manual'}
          </dd>
        </div>
        {t.reference && (
          <div>
            <dt>Referensi</dt>
            <dd>{t.reference}</dd>
          </div>
        )}
        {t.note && (
          <div>
            <dt>Catatan</dt>
            <dd>{t.note}</dd>
          </div>
        )}
      </dl>
      {t.kind === 'transfer' && (
        <div className="info-note">
          <ArrowLeftRight size={17} />
          <span>
            Perpindahan dana tidak dihitung sebagai pemasukan atau pengeluaran. Biaya admin tetap
            mengurangi total saldo.
          </span>
        </div>
      )}
      <div className="detail-actions" hidden={t.editable === false}>
        <button className="btn primary" onClick={onEdit}>
          <Pencil size={17} />
          Edit transaksi
        </button>
        <button className="btn danger" onClick={onDelete}>
          <Trash2 size={16} />
          Hapus transaksi
        </button>
      </div>
    </div>
  );
}
