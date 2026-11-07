import test from 'node:test';
import assert from 'node:assert/strict';
import { scanResultSchema, imageMime } from '../src/scan-contract.ts';
import { defaultsFromScan } from '../src/share.ts';
import { balances, emptyStore } from '../src/domain.ts';
const valid = {
  category: 'Transfer',
  amount: 102500,
  is_transfer: true,
  from_bank: 'BCA',
  to_bank: 'Bank Mandiri',
  notes: 'Biaya admin Rp2.500',
};
test('scan output accepts only the exact schema, integer rupiah and consistent transfer state', () => {
  assert.equal(scanResultSchema.safeParse(valid).success, true);
  for (const extra of [
    { amount: -1 },
    { amount: NaN },
    { amount: 0.5 },
    { amount: 1e15 },
    { category: 'Food' },
    { is_transfer: false },
    { evil: '<script>' },
  ])
    assert.equal(scanResultSchema.safeParse({ ...valid, ...extra }).success, false);
});
test('sniffing rejects SVG, HTML, PDFs and mismatched non-images', () => {
  for (const data of ['<svg>', '<script>', '%PDF', 'hello'])
    assert.equal(imageMime(new TextEncoder().encode(data)), null);
  assert.equal(imageMime(new Uint8Array([255, 216, 255, 1])), 'image/jpeg');
});
test('bank detection selects only unique accounts; same bank never guesses between wallets', () => {
  const accounts = [
    {
      id: 'a',
      provider: 'BCA',
      name: 'A',
      shared: false,
      opening: 200000,
      color: '#1D2949',
      suffix: '',
    },
    {
      id: 'b',
      provider: 'Mandiri',
      name: 'B',
      shared: true,
      opening: 0,
      color: '#1D2949',
      suffix: '',
    },
  ];
  assert.equal(defaultsFromScan(scanResultSchema.parse(valid), 'abc', accounts).toId, 'b');
  assert.equal(
    defaultsFromScan(scanResultSchema.parse(valid), 'abc', [
      ...accounts,
      { ...accounts[0], id: 'c' },
    ]).accountId,
    '',
  );
  const defaults = defaultsFromScan(scanResultSchema.parse(valid), 'abc', accounts);
  const saved = {
    ...defaults,
    id: 't',
    title: 'Transfer',
    kind: 'transfer' as const,
    category: 'Transfer',
    amount: 100000,
    fee: 2500,
    date: '2026-01-01',
    accountId: 'a',
    toId: 'b',
    source: '',
    note: '',
  };
  assert.deepEqual(balances({ ...emptyStore(), accounts, transactions: [saved] }), {
    a: 97500,
    b: 100000,
  });
});
