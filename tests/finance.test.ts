import test from 'node:test';
import assert from 'node:assert/strict';
import {
  allocations,
  balances,
  balanceHistory,
  csv,
  demoStore,
  emptyStore,
  isStore,
  spendingByCategory,
  today,
  totals,
  validateTransaction,
  replaceTransaction,
} from '../src/domain.ts';
import type { Store, Transaction } from '../src/domain.ts';
import { parseReceipt, parseRupiah } from '../src/receipts.ts';

function fixture(): Store {
  return {
    ...emptyStore(),
    accounts: [
      {
        id: 'a',
        name: 'Pribadi',
        provider: 'SeaBank',
        opening: 5000000,
        shared: false,
        color: '#ee752f',
        suffix: '1234',
      },
      {
        id: 'b',
        name: 'Bersama',
        provider: 'Bank Jago',
        opening: 1000000,
        shared: true,
        color: '#e9aa3b',
        suffix: '',
      },
    ],
  };
}
const transaction = (overrides: Partial<Transaction> = {}): Transaction => ({
  id: 'tx',
  kind: 'expense',
  title: 'Makan',
  amount: 50000,
  fee: 0,
  date: today(),
  accountId: 'a',
  category: 'Makanan & minuman',
  source: '',
  note: '',
  ...overrides,
});
test('own and shared transfer conserves total and is not an expense', () => {
  const s = fixture();
  s.transactions.push(
    transaction({ kind: 'transfer', toId: 'b', amount: 500000, category: 'Transfer' }),
  );
  assert.deepEqual(balances(s), { a: 4500000, b: 1500000 });
  assert.deepEqual(totals(s.transactions), { income: 0, expense: 0 });
});
test('transfer fee reduces only source and counts as spending', () => {
  const s = fixture();
  s.transactions.push(
    transaction({ kind: 'transfer', toId: 'b', amount: 500000, fee: 2500, category: 'Transfer' }),
  );
  assert.deepEqual(balances(s), { a: 4497500, b: 1500000 });
  assert.equal(totals(s.transactions).expense, 2500);
  assert.deepEqual(spendingByCategory(s.transactions, ''), [['Biaya transfer', 2500]]);
});
test('cash withdrawal is expenditure with no cash wallet', () => {
  const s = fixture();
  s.transactions.push(transaction({ category: 'Tarik tunai', amount: 200000 }));
  assert.equal(balances(s).a, 4800000);
  assert.equal(totals(s.transactions).expense, 200000);
  assert.equal(s.accounts.length, 2);
});
test('irregular income uses received money and preserves its source', () => {
  const s = fixture();
  const t = transaction({
    kind: 'income',
    amount: 750000,
    category: 'Pemasukan',
    source: 'Komisi klien',
  });
  assert.equal(validateTransaction(t, s), '');
  s.transactions.push(t);
  assert.equal(balances(s).a, 5750000);
  assert.equal(totals(s.transactions).income, 750000);
});
test('plan excludes shared balance and subtracts unpaid obligations once', () => {
  const s = fixture();
  s.plan = { reserve: 2000000, saving: 50, fun: 30, together: 20 };
  const a = allocations(s);
  assert.equal(a.available, 3000000);
  assert.equal(a.saving, 1500000);
  assert.equal(a.fun, 900000);
  assert.equal(a.together, 600000);
  assert.equal(a.personal, 5000000);
});
test('plan cannot allocate negative money', () => {
  const s = fixture();
  s.plan.reserve = 6000000;
  assert.equal(allocations(s).shortfall, 1000000);
  assert.equal(allocations(s).available, 0);
});
test('validation blocks same-account transfer, overdraw, fractions, and future date', () => {
  const s = fixture();
  for (const changes of [
    { kind: 'transfer' as const, toId: 'a' },
    { amount: 6000000 },
    { amount: 1.5 },
    { date: '2099-01-01' },
    { amount: -1 },
    { amount: NaN },
    { date: '2026-02-31' },
    { fee: -1 },
  ])
    assert.notEqual(validateTransaction(transaction(changes), s), '');
});
test('income must have a source and cannot carry a hidden fee', () => {
  const s = fixture();
  assert.notEqual(validateTransaction(transaction({ kind: 'income' }), s), '');
  assert.notEqual(
    validateTransaction(transaction({ kind: 'income', source: 'Freelance', fee: 100 }), s),
    '',
  );
});
test('identical receipt hash or reference cannot deduct twice', () => {
  const s = fixture();
  s.transactions = [transaction({ receiptHash: 'a'.repeat(64), reference: 'REF12345' })];
  assert.notEqual(
    validateTransaction(transaction({ id: 'new', receiptHash: 'a'.repeat(64) }), s),
    '',
  );
  assert.notEqual(validateTransaction(transaction({ id: 'new', reference: 'ref12345' }), s), '');
  assert.equal(validateTransaction(transaction({ id: 'new', reference: 'different' }), s), '');
});
test('empty and example data round-trip through validated storage', () => {
  assert.ok(isStore(emptyStore()));
  assert.ok(isStore(JSON.parse(JSON.stringify(demoStore()))));
  assert.ok(isStore(fixture()));
});
test('malformed backup data is rejected', () => {
  for (const modify of [
    (s: Store) => {
      s.accounts[0].opening = -1;
    },
    (s: Store) => {
      s.accounts.push(s.accounts[0]);
    },
    (s: Store) => {
      s.plan.fun = 90;
    },
    (s: Store) => {
      s.transactions = [transaction({ accountId: 'missing' })];
    },
    (s: Store) => {
      s.transactions = [transaction({ amount: 1.5 })];
    },
    (s: Store) => {
      s.transactions = [transaction({ kind: 'transfer', toId: 'a' })];
    },
  ]) {
    const s = fixture();
    modify(s);
    assert.equal(isStore(s), false);
  }
});
test('deleting a transfer restores both balances', () => {
  const s = fixture();
  const initial = balances(s);
  s.transactions = [transaction({ kind: 'transfer', toId: 'b', fee: 2500 })];
  s.transactions = [];
  assert.deepEqual(balances(s), initial);
});
test('history ends on actual calculated balance', () => {
  const s = fixture();
  s.transactions = [transaction()];
  const points = balanceHistory(s, 7);
  assert.equal(points.length, 7);
  assert.equal(points.at(-1)?.value, 5950000);
  assert.equal(points[0].value, 6000000);
});
test('period totals do not count other months', () => {
  assert.deepEqual(
    totals(
      [
        transaction({ date: '2025-01-01' }),
        transaction({ kind: 'income', date: '2025-02-01', source: 'Freelance' }),
      ],
      '2025-01',
    ),
    { income: 0, expense: 50000 },
  );
});
test('rupiah parsing handles Indonesian and English separator formats', () => {
  for (const s of ['Rp 125.000', '125.000,00', 'IDR 125,000.00', '125000'])
    assert.equal(parseRupiah(s), 125000);
  assert.equal(parseRupiah('rekening123'), undefined);
});
test('receipt parser prefers payment total to balance and account number', () => {
  const p = parseReceipt(
    'SeaBank\nSumber dana: SeaBank\nJumlah transfer Rp 125.000\nSaldo Rp 8.000.000\nNo referensi REF12345\n01/10/2025',
  );
  assert.equal(p.amount, 125000);
  assert.equal(p.provider, 'SeaBank');
  assert.equal(p.reference, 'REF12345');
  assert.equal(p.date, '2025-10-01');
});
test('ambiguous banks never automatically select source', () => {
  const p = parseReceipt('SeaBank\nTransfer ke BCA\nTotal Rp 50.000');
  assert.equal(p.provider, undefined);
  assert.deepEqual(p.candidates, ['SeaBank', 'BCA']);
});
test('ambiguous amount is left for human confirmation', () => {
  assert.equal(
    parseReceipt('Saldo Rp 500.000\nTransfer Rp 50.000\nBiaya Rp 2.500').amount,
    undefined,
  );
});
test('CSV escapes formulas, quotes and newlines', () => {
  const s = fixture();
  const output = csv([transaction({ title: '=SUM(A1)', note: 'a,"b"\nc' })], s.accounts);
  assert.ok(output.includes("'=SUM(A1)"));
  assert.ok(output.includes('"a,""b""\nc"'));
});

test('editing an expense recalculates balance without counting its receipt twice', () => {
  const s = fixture();
  const original = transaction({
    receiptId: 'proof',
    receiptHash: 'a'.repeat(64),
    reference: 'REF123',
  });
  s.transactions = [original];
  const result = replaceTransaction(s, { ...original, amount: 125000 }, original.id);
  assert.equal(result.error, '');
  assert.equal(balances(result.data!).a, 4875000);
  assert.equal(result.data!.transactions.length, 1);
  assert.equal(result.data!.transactions[0].receiptId, 'proof');
});
test('editing a transfer checks both the sending and receiving balance', () => {
  const s = fixture();
  s.transactions = [
    transaction({
      id: 'transfer',
      kind: 'transfer',
      amount: 500000,
      toId: 'b',
      category: 'Transfer',
    }),
    transaction({ id: 'spent', accountId: 'b', amount: 1400000 }),
  ];
  const result = replaceTransaction(s, { ...s.transactions[0], amount: 100000 }, 'transfer');
  assert.match(result.error, /saldo rekening lain negatif/);
  assert.equal(result.data, undefined);
});
test('an edited record still cannot reuse another record’s proof or reference', () => {
  const s = fixture();
  s.transactions = [
    transaction({ id: 'one', receiptHash: 'b'.repeat(64), reference: 'FIRST' }),
    transaction({ id: 'two', reference: 'SECOND' }),
  ];
  assert.notEqual(
    replaceTransaction(s, { ...s.transactions[1], receiptHash: 'b'.repeat(64) }, 'two').error,
    '',
  );
  assert.notEqual(
    replaceTransaction(s, { ...s.transactions[1], reference: 'FIRST' }, 'two').error,
    '',
  );
});
test('editing a missing transaction does not create an unintended new record', () => {
  const result = replaceTransaction(fixture(), transaction(), 'deleted');
  assert.match(result.error, /sudah tidak tersedia/);
  assert.equal(result.data, undefined);
});
