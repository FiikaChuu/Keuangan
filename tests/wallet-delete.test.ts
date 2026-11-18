import test from 'node:test';
import assert from 'node:assert/strict';
import { walletDeletionReason } from '../src/wallet-delete';
import { emptyStore } from '../src/domain';
test('wallet deletion blocks dependencies, non-owner and nonzero balance', () => {
  const store = emptyStore();
  const a = {
    id: 'a',
    name: 'A',
    provider: 'Tunai',
    shared: false,
    opening: 0,
    color: '#123456',
    suffix: '',
  };
  store.accounts = [a];
  assert.equal(walletDeletionReason(store, a), null);
  assert.match(
    walletDeletionReason(
      { ...store, goals: [{ id: 'g', accountId: 'a', name: 'G', target: 1, emoji: 'x' }] },
      a,
    )!,
    /tujuan/,
  );
  assert.match(walletDeletionReason(store, { ...a, opening: 10 })!, /saldo/);
  assert.match(walletDeletionReason(store, { ...a, readOnly: true })!, /pemilik/);
});
