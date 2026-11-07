import test from 'node:test';
import assert from 'node:assert/strict';
import { readBackup } from '../src/backup';
import { demoStore, balances } from '../src/domain';
test('legacy migration preserves all balances, strips images and versions, and gives rows UUIDs', () => {
  const old = demoStore();
  old.transactions[0].receiptId = 'photo';
  old.transactions[0].version = 8;
  const next = readBackup({
    format: 'skywallet-backup',
    version: 1,
    data: old,
    receipts: [{ data: 'BASE64_IMAGE' }],
  });
  assert.deepEqual(
    Object.values(balances(next)).sort((a, b) => a - b),
    Object.values(balances(old)).sort((a, b) => a - b),
  );
  for (const a of next.accounts) assert.match(a.id, /^[\da-f-]{36}$/);
  for (const t of next.transactions) {
    assert.equal(t.title, t.category);
    assert.equal(t.version, undefined);
    assert.equal(t.receiptId, undefined);
  }
  assert.ok(!JSON.stringify(next).includes('BASE64_IMAGE'));
});
