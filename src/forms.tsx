import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import {
  UploadCloud,
  ScanLine,
  FileText,
  Check,
  LoaderCircle,
  ArrowRight,
  ShieldCheck,
  Info,
  Plus,
  Paperclip,
  Download,
  Trash2,
  ArrowLeftRight,
} from 'lucide-react';
import type { Store, Transaction, Account, Goal } from './domain';
import { categories, providers, today, money, balances, validateTransaction } from './domain';
import {
  extractReceipt,
  parseReceipt,
  saveReceipt,
  hashFile,
  readReceipt,
  deleteReceipt,
} from './receipts';
import { EmptyState, ProviderMark } from './ui';

type Save = (next: Store) => boolean;
export function TransactionForm({
  store,
  save,
  close,
  mode = 'manual',
  defaults = {},
  onAccount,
}: {
  store: Store;
  save: Save;
  close: () => void;
  mode?: 'manual' | 'receipt';
  defaults?: Partial<Transaction>;
  onAccount: () => void;
}) {
  const [tab, setTab] = useState(mode);
  const [kind, setKind] = useState<Transaction['kind']>(defaults.kind ?? 'expense');
  const [title, setTitle] = useState(defaults.title ?? '');
  const [amount, setAmount] = useState(defaults.amount ? String(defaults.amount) : '');
  const [accountId, setAccountId] = useState(
    defaults.accountId ??
      (mode === 'manual'
        ? (store.accounts.find((a) => !a.shared)?.id ?? store.accounts[0]?.id ?? '')
        : ''),
  );
  const [toId, setToId] = useState(defaults.toId ?? '');
  const [date, setDate] = useState(today());
  const [category, setCategory] = useState('Makanan & minuman');
  const [source, setSource] = useState('');
  const [fee, setFee] = useState('');
  const [note, setNote] = useState('');
  const [reference, setReference] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [hash, setHash] = useState('');
  const [busy, setBusy] = useState(false);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState('');
  const [text, setText] = useState('');
  const [error, setError] = useState('');
  const [hint, setHint] = useState('');
  const [preview, setPreview] = useState('');
  useEffect(() => {
    if (!file || !file.type.startsWith('image/')) {
      setPreview('');
      return;
    }
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);
  async function process(file: File) {
    setError('');
    setText('');
    setHash('');
    setHint('');
    if (!['image/jpeg', 'image/png', 'image/webp', 'application/pdf'].includes(file.type)) {
      setError(
        'Gunakan gambar JPG, PNG, WEBP, atau dokumen PDF. Untuk HEIC, simpan sebagai JPG terlebih dahulu.',
      );
      return;
    }
    if (file.size > 10 * 1024 * 1024 || file.size === 0) {
      setError('Bukti harus berukuran antara 1 byte dan 10 MB.');
      return;
    }
    setBusy(true);
    setStatus('Menyiapkan pembaca bukti…');
    setFile(file);
    try {
      const fingerprint = await hashFile(file);
      if (store.transactions.some((t) => t.receiptHash === fingerprint)) {
        setFile(null);
        throw new Error('Bukti ini sudah tercatat. Buka riwayat untuk melihat transaksinya.');
      }
      setHash(fingerprint);
      const result = await extractReceipt(file, setStatus);
      setText(result);
      const parsed = parseReceipt(result);
      if (parsed.amount) setAmount(String(parsed.amount));
      if (parsed.date) setDate(parsed.date);
      if (parsed.category) setCategory(parsed.category);
      if (parsed.reference) setReference(parsed.reference);
      const accounts = store.accounts.filter((a) => a.provider === parsed.provider);
      if (accounts.length === 1) setAccountId(accounts[0].id);
      else setAccountId('');
      setHint(
        parsed.provider && accounts.length === 1
          ? `Sumber terindikasi ${parsed.provider}. Pastikan rekening dan jenis transaksinya benar.`
          : parsed.candidates.length
            ? `${parsed.candidates.join(', ')} ditemukan pada bukti. Pilih rekening asal secara manual agar tidak tertukar dengan penerima.`
            : 'Rekening asal belum dikenali. Pilih secara manual dan periksa nominalnya.',
      );
      setStatus(
        result.trim()
          ? 'Bukti selesai dibaca. Periksa dan lengkapi hasilnya.'
          : 'Teks belum terbaca. Kamu tetap bisa mengisi detail secara manual.',
      );
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : 'Bukti belum bisa dibaca. Isi detail secara manual atau coba gambar yang lebih jelas.',
      );
      setStatus('');
    } finally {
      setBusy(false);
    }
  }
  async function submit(e: FormEvent) {
    e.preventDefault();
    setError('');
    const tx: Transaction = {
      id: crypto.randomUUID(),
      kind,
      title: title.trim(),
      amount: Number(amount),
      fee: kind === 'income' ? 0 : Number(fee || 0),
      date,
      accountId,
      toId: kind === 'transfer' ? toId : undefined,
      category: kind === 'transfer' ? 'Transfer' : kind === 'income' ? 'Pemasukan' : category,
      source: kind === 'income' ? source.trim() : '',
      note: note.trim(),
      reference: reference.trim() || undefined,
      receiptId: file ? crypto.randomUUID() : undefined,
      receiptHash: file && hash ? hash : undefined,
    };
    const invalid = validateTransaction(tx, store);
    if (invalid) {
      setError(invalid);
      return;
    }
    if (file && !hash) {
      setError('Bukti belum siap. Hapus bukti atau unggah ulang sebelum menyimpan.');
      return;
    }
    setSaving(true);
    try {
      if (file && tx.receiptId) await saveReceipt(tx.receiptId, file);
      if (save({ ...store, transactions: [tx, ...store.transactions] })) close();
      else if (tx.receiptId) await deleteReceipt(tx.receiptId);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Transaksi belum tersimpan. Coba lagi.');
    } finally {
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
    <form onSubmit={submit} className="form-stack">
      <div className="form-tabs">
        <button
          type="button"
          className={tab === 'manual' ? 'active' : ''}
          onClick={() => setTab('manual')}
        >
          <Plus size={16} />
          Input manual
        </button>
        <button
          type="button"
          className={tab === 'receipt' ? 'active' : ''}
          onClick={() => setTab('receipt')}
        >
          <ScanLine size={16} />
          Dari bukti transaksi
        </button>
      </div>
      {tab === 'receipt' && (
        <>
          <label
            className={`upload-zone ${busy ? 'busy' : ''}`}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              const f = e.dataTransfer.files[0];
              if (f && !busy) void process(f);
            }}
          >
            <input
              type="file"
              accept="image/png,image/jpeg,image/webp,application/pdf"
              disabled={busy || saving}
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void process(f);
                e.target.value = '';
              }}
            />
            <span className="upload-symbol">
              {busy ? <LoaderCircle className="spin" size={26} /> : <UploadCloud size={26} />}
            </span>
            <strong>{busy ? status : 'Pilih atau letakkan bukti di sini'}</strong>
            <small>Screenshot, foto, atau PDF · Maks. 10 MB / 5 halaman</small>
            <span className="upload-privacy">
              <ShieldCheck size={12} />
              Dibaca di perangkat, tanpa mengunggah ke server
            </span>
          </label>
          {file && (
            <div className="receipt-preview">
              {preview ? (
                <img src={preview} alt="Pratinjau bukti transaksi" />
              ) : (
                <FileText size={28} />
              )}
              <div>
                <strong>{file.name}</strong>
                <small>{busy ? status : status || 'Bukti terlampir'}</small>
              </div>
              <button
                type="button"
                disabled={busy}
                className="icon-btn"
                aria-label="Hapus lampiran bukti"
                onClick={() => {
                  setFile(null);
                  setHash('');
                  setText('');
                  setHint('');
                  setStatus('');
                }}
              >
                <Trash2 size={17} />
              </button>
            </div>
          )}
          {hint && (
            <div className="info-note">
              <Info size={17} />
              <span>
                {hint} Pembacaan otomatis dapat keliru; konfirmasi semua detail sebelum menyimpan.
              </span>
            </div>
          )}
          {text && (
            <details className="extracted-text">
              <summary>Lihat teks yang terbaca</summary>
              <pre>{text}</pre>
            </details>
          )}
        </>
      )}
      {tab === 'manual' && file && (
        <p className="field-hint">
          <Paperclip size={13} />
          Bukti tetap terlampir. Buka tab bukti untuk menghapusnya.
        </p>
      )}
      <div className="kind-switch" aria-label="Jenis transaksi">
        {(['expense', 'income', 'transfer'] as const).map((k) => (
          <button
            type="button"
            key={k}
            className={kind === k ? 'active' : ''}
            onClick={() => {
              setKind(k);
              setError('');
            }}
          >
            {{ expense: 'Pengeluaran', income: 'Pemasukan', transfer: 'Transfer' }[k]}
          </button>
        ))}
      </div>
      <label>
        Nama transaksi
        <input
          required
          maxLength={100}
          placeholder={
            kind === 'income'
              ? 'Mis. Project desain selesai'
              : kind === 'transfer'
                ? 'Mis. Untuk masa depan kita'
                : 'Mis. Makan siang atau paket data'
          }
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />
      </label>
      <div className="form-grid">
        <label>
          Nominal (Rp)
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
      <label>
        {kind === 'income' ? 'Masuk ke rekening' : 'Dari rekening'}
        <select value={accountId} required onChange={(e) => setAccountId(e.target.value)}>
          <option value="">Pilih rekening</option>
          {store.accounts.map((a) => (
            <option key={a.id} value={a.id}>
              {a.provider} · {a.name}
              {a.shared ? ' (bersama)' : ''} — {money(balances(store)[a.id])}
            </option>
          ))}
        </select>
      </label>
      {kind === 'transfer' ? (
        <>
          <label>
            Ke rekening
            <select value={toId} required onChange={(e) => setToId(e.target.value)}>
              <option value="">Pilih rekening tujuan</option>
              {store.accounts
                .filter((a) => a.id !== accountId)
                .map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.provider} · {a.name}
                    {a.shared ? ' (bersama)' : ''}
                  </option>
                ))}
            </select>
          </label>
          <p className="field-hint">
            <ArrowLeftRight size={14} />
            Transfer ke akun bersama tetap perpindahan saldo. Hanya biaya yang dihitung sebagai
            pengeluaran.
          </p>
        </>
      ) : kind === 'income' ? (
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
      ) : (
        <label>
          Kategori
          <select
            aria-label="Kategori"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
          >
            {categories.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
          {category === 'Tarik tunai' && (
            <small className="field-hint">
              Dihitung sebagai pengeluaran. Tidak menambah dompet tunai.
            </small>
          )}
        </label>
      )}
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
          maxLength={2000}
          rows={2}
          placeholder="Detail kecil yang ingin kamu ingat…"
          value={note}
          onChange={(e) => setNote(e.target.value)}
        />
      </label>
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      <div className="form-footer">
        <p>
          <ShieldCheck size={14} />
          Hanya mengubah catatan skySave, bukan saldo bank.
        </p>
        <button className="btn primary" disabled={busy || saving} type="submit">
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
  const [name, setName] = useState('');
  const [opening, setOpening] = useState('');
  const [suffix, setSuffix] = useState('');
  const [together, setTogether] = useState(shared);
  const [error, setError] = useState('');
  function submit(e: FormEvent) {
    e.preventDefault();
    const amount = Number(opening || 0);
    if (!Number.isSafeInteger(amount) || amount < 0 || amount > 1e12 || !name.trim()) {
      setError('Isi nama rekening dan saldo awal berupa rupiah utuh yang valid.');
      return;
    }
    const p = providers.find((p) => p.name === provider)!;
    const a: Account = {
      id: crypto.randomUUID(),
      name: name.trim(),
      provider,
      opening: amount,
      suffix,
      shared: together,
      color: p.color,
    };
    if (save({ ...store, accounts: [...store.accounts, a] })) close();
  }
  return (
    <form onSubmit={submit} className="form-stack">
      <div className="account-form-visual">
        <ProviderMark
          account={{ provider, color: providers.find((p) => p.name === provider)!.color }}
          large
        />
        <div>
          <strong>Ruang baru untuk uangmu.</strong>
          <span>Tanpa login bank. Tanpa koneksi rekening.</span>
        </div>
      </div>
      <label>
        Bank atau e-wallet
        <select value={provider} onChange={(e) => setProvider(e.target.value)}>
          {providers.map((p) => (
            <option key={p.name}>{p.name}</option>
          ))}
        </select>
      </label>
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
        <input type="checkbox" checked={together} onChange={(e) => setTogether(e.target.checked)} />
        <span>
          <strong>Akun bersama</strong>
          <small>Pisahkan uang bersama dari dana pribadi yang bisa dialokasikan.</small>
        </span>
      </label>
      <div className="info-note">
        <Info size={17} />
        <span>
          Gunakan saldo saat mulai mencatat. Transaksi sebelum saldo awal tidak perlu dimasukkan
          lagi. Akun bersama di versi ini dicatat pada perangkat yang sama.
        </span>
      </div>
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      <button className="btn primary full-width" type="submit">
        Tambahkan dompet
        <ArrowRight size={16} />
      </button>
    </form>
  );
}
export function GoalForm({ store, save, close }: { store: Store; save: Save; close: () => void }) {
  const [name, setName] = useState('');
  const [target, setTarget] = useState('');
  const [accountId, setAccountId] = useState('');
  const [emoji, setEmoji] = useState('🌱');
  const available = store.accounts.filter((a) => !store.goals.some((g) => g.accountId === a.id));
  if (!available.length)
    return (
      <EmptyState
        title="Satu dompet, satu tujuan"
        text="Tambahkan dompet khusus yang belum dipakai untuk tujuan lain agar progres tabungan tidak dihitung dua kali."
      />
    );
  function submit(e: FormEvent) {
    e.preventDefault();
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
      id: crypto.randomUUID(),
      name: name.trim(),
      target: amount,
      accountId,
      emoji,
    };
    if (save({ ...store, goals: [...store.goals, goal] })) close();
  }
  return (
    <form className="form-stack" onSubmit={submit}>
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
      <label>
        Rekening khusus tujuan ini
        <select required value={accountId} onChange={(e) => setAccountId(e.target.value)}>
          <option value="">Pilih dompet</option>
          {available.map((a) => (
            <option key={a.id} value={a.id}>
              {a.provider} · {a.name}
            </option>
          ))}
        </select>
      </label>
      <p className="field-hint">
        Progres mengikuti saldo tercatat pada dompet yang dipilih. Membuat tujuan tidak memindahkan
        uang.
      </p>
      <button className="btn primary" type="submit">
        Mulai wujudkan
        <ArrowRight size={16} />
      </button>
    </form>
  );
}
export function TransactionDetail({
  transaction: t,
  store,
  onDelete,
}: {
  transaction: Transaction;
  store: Store;
  onDelete: () => void;
}) {
  const [url, setUrl] = useState('');
  const [type, setType] = useState('');
  const [error, setError] = useState('');
  useEffect(() => {
    let active = true;
    let objectUrl = '';
    if (t.receiptId)
      readReceipt(t.receiptId)
        .then((blob) => {
          if (!active) return;
          if (!blob) {
            setError(
              'Bukti tidak ditemukan di perangkat ini. Cadangan lama mungkin hanya berisi data transaksi.',
            );
            return;
          }
          objectUrl = URL.createObjectURL(blob);
          setUrl(objectUrl);
          setType(blob.type);
        })
        .catch(() => {
          if (active) setError('Bukti belum bisa dibuka dari penyimpanan perangkat.');
        });
    return () => {
      active = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [t.receiptId]);
  const account = store.accounts.find((a) => a.id === t.accountId)!;
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
          <dd>{t.receiptId ? 'Unggah bukti + konfirmasi' : 'Input manual'}</dd>
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
      {url && (
        <div className="saved-receipt">
          {type.startsWith('image/') && <img src={url} alt={`Bukti ${t.title}`} />}
          <a
            href={url}
            download={`bukti-${t.id}.${type === 'application/pdf' ? 'pdf' : type === 'image/png' ? 'png' : type === 'image/webp' ? 'webp' : 'jpg'}`}
            className="btn secondary"
          >
            <Download size={16} />
            Unduh bukti asli
          </a>
        </div>
      )}
      {error && <p className="form-error">{error}</p>}
      <button className="btn danger subtle" onClick={onDelete}>
        <Trash2 size={16} />
        Hapus transaksi
      </button>
    </div>
  );
}
