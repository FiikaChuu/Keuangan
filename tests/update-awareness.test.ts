import { test } from 'node:test';
import assert from 'node:assert/strict';
import { checkBuild, requestRefresh } from '../src/update-awareness';
test('only a valid different build announces an update', async () => {
  const get = (build: unknown) => async () => new Response(JSON.stringify({ build }));
  assert.equal(await checkBuild('abc1234', get('abc1234')), false);
  assert.equal(await checkBuild('abc1234', get('def5678')), true);
  assert.equal(await checkBuild('abc1234', get('<html>')), false);
  assert.equal(await checkBuild('development', get('def5678')), false);
});
test('offline, bad JSON, and unsuccessful responses never announce', async () => {
  assert.equal(await checkBuild('abc1234', async () => { throw Error('offline'); }), false);
  assert.equal(await checkBuild('abc1234', async () => new Response('invalid')), false);
  assert.equal(await checkBuild('abc1234', async () => new Response('{}', { status: 503 })), false);
});
test('refresh requires consent to loss of unsaved changes; cancel preserves forms', () => {
  let reloads = 0;
  requestRefresh(() => false, () => reloads++);
  assert.equal(reloads, 0);
  requestRefresh(message => { assert.match(message, /belum disimpan akan hilang/); return true; }, () => reloads++);
  assert.equal(reloads, 1);
});
