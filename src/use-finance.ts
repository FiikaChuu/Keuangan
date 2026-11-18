import { useCallback, useEffect, useRef, useState } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Store } from './domain';
import { databaseError, readFinance, storeChanges } from './finance-client';

export type RemoteFinance = {
  store: Store;
  status: string;
  email: string;
  save: (before: Store, next: Store) => Promise<void>;
  signOut: () => Promise<void>;
  refresh: () => Promise<void>;
  getRevision: () => string;
  pauseLifecycle: (owner: string) => () => void;
  stopLifecycle: () => void;
  finishLifecycle: () => Promise<void>;
};
export function useFinance(client: SupabaseClient, userId: string) {
  const [store, setStore] = useState<Store>();
  const [error, setError] = useState('');
  const [status, setStatus] = useState('Menyambungkan…');
  const active = useRef(true);
  const paused = useRef(false);
  const lifecycleOwner = useRef<string | null>(null);
  const stopped = useRef(false);
  const disconnect = useRef<() => void>(() => {});
  const pending = useRef<Promise<void> | null>(null);
  const again = useRef(false);
  const writing = useRef(false);
  const realtimeConnected = useRef(false);
  const revision = useRef<string | undefined>(undefined);
  const request = useRef<{ signature: string; id: string } | null>(null);
  const refresh = useCallback(async () => {
    if (paused.current || stopped.current) return;
    if (pending.current) {
      again.current = true;
      return pending.current;
    }
    pending.current = (async () => {
      do {
        again.current = false;
        try {
          const next = await readFinance(client, revision.current);
          if (active.current && !paused.current && !stopped.current) {
            if (next) {
              revision.current = next.revision;
              setStore(next.store);
            }
            setError('');
            setStatus(realtimeConnected.current ? 'Tersinkron langsung' : 'Tersinkron berkala');
          }
        } catch (e) {
          if (active.current && !paused.current && !stopped.current) {
            setStatus('Koneksi terputus');
            setError(e instanceof Error ? e.message : 'Tidak dapat memuat data.');
            if (e instanceof Error && /Akses akun/.test(e.message)) {
              revision.current = undefined;
              setStore(undefined);
            }
          }
        }
      } while (again.current && active.current && !paused.current && !stopped.current);
    })().finally(() => {
      pending.current = null;
    });
    return pending.current;
  }, [client]);
  useEffect(() => {
    active.current = true;
    let debounce: ReturnType<typeof setTimeout>;
    const schedule = () => {
      if (paused.current || stopped.current) return;
      clearTimeout(debounce);
      debounce = setTimeout(() => void refresh(), 100);
    };
    const channel = client.channel(`finance-${userId}`);
    for (const table of ['wallets', 'transactions', 'goals', 'plans', 'household_members'])
      channel.on('postgres_changes', { event: '*', schema: 'public', table }, schedule);
    channel.subscribe((state) => {
      realtimeConnected.current = state === 'SUBSCRIBED';
      if (active.current)
        setStatus(state === 'SUBSCRIBED' ? 'Tersinkron langsung' : 'Menghubungkan ulang…');
      if (state === 'SUBSCRIBED') schedule();
    });
    void client.rpc('bootstrap_finance').then(({ error }) => {
      if (error) {
        if (active.current) setError(databaseError(error));
      } else void refresh();
    });
    const focus = () => {
      if (document.visibilityState === 'visible') schedule();
    };
    const offline = () => setStatus('Offline · perubahan belum dapat disimpan');
    window.addEventListener('online', schedule);
    window.addEventListener('offline', offline);
    document.addEventListener('visibilitychange', focus);
    const poll = setInterval(focus, 30000);
    disconnect.current = () => {
      active.current = false;
      clearTimeout(debounce);
      clearInterval(poll);
      void client.removeChannel(channel);
      window.removeEventListener('online', schedule);
      window.removeEventListener('offline', offline);
      document.removeEventListener('visibilitychange', focus);
    };
    return () => disconnect.current();
  }, [client, userId, refresh]);
  const save = useCallback(
    async (before: Store, next: Store) => {
      if (paused.current || stopped.current)
        throw new Error('Perubahan dikunci selama proses akun.');
      if (writing.current) throw new Error('Penyimpanan masih berlangsung.');
      if (!navigator.onLine)
        throw new Error('Sedang offline. Hubungkan internet lalu simpan kembali.');
      const changes = storeChanges(before, next);
      if (!changes.length) return;
      const signature = JSON.stringify(changes);
      if (request.current?.signature !== signature)
        request.current = { signature, id: crypto.randomUUID() };
      writing.current = true;
      try {
        const { error: failure } = await client.rpc('commit_finance', {
          p_request_id: request.current.id,
          p_changes: changes,
        });
        if (failure) {
          await refresh();
          throw new Error(databaseError(failure));
        }
        request.current = null;
        await refresh();
      } finally {
        writing.current = false;
      }
    },
    [client, refresh],
  );
  const getRevision = () => {
    if (!revision.current) throw new Error('Muat data terbaru sebelum reset.');
    return revision.current;
  };
  const pauseLifecycle = (owner: string) => {
    if (
      writing.current ||
      pending.current ||
      (paused.current && lifecycleOwner.current !== owner) ||
      stopped.current
    )
      throw new Error('Sinkronisasi masih berlangsung. Tunggu lalu coba lagi.');
    paused.current = true;
    lifecycleOwner.current = owner;
    return () => {
      if (!stopped.current) {
        paused.current = false;
        lifecycleOwner.current = null;
      }
    };
  };
  const stopLifecycle = () => {
    stopped.current = true;
    paused.current = true;
    request.current = null;
    again.current = false;
    revision.current = undefined;
    disconnect.current();
    setStore(undefined);
  };
  return { store, error, status, save, refresh, getRevision, pauseLifecycle, stopLifecycle };
}
