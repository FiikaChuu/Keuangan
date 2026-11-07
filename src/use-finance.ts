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
};
export function useFinance(client: SupabaseClient, userId: string) {
  const [store, setStore] = useState<Store>();
  const [error, setError] = useState('');
  const [status, setStatus] = useState('Menyambungkan…');
  const active = useRef(true);
  const pending = useRef<Promise<void> | null>(null);
  const again = useRef(false);
  const writing = useRef(false);
  const realtimeConnected = useRef(false);
  const revision = useRef<string | undefined>(undefined);
  const request = useRef<{ signature: string; id: string } | null>(null);
  const refresh = useCallback(async () => {
    if (pending.current) {
      again.current = true;
      return pending.current;
    }
    pending.current = (async () => {
      do {
        again.current = false;
        try {
          const next = await readFinance(client, revision.current);
          if (active.current) {
            if (next) {
              revision.current = next.revision;
              setStore(next.store);
            }
            setError('');
            setStatus(realtimeConnected.current ? 'Tersinkron langsung' : 'Tersinkron berkala');
          }
        } catch (e) {
          if (active.current) {
            setStatus('Koneksi terputus');
            setError(e instanceof Error ? e.message : 'Tidak dapat memuat data.');
            if (e instanceof Error && /Akses akun/.test(e.message)) {
              revision.current = undefined;
              setStore(undefined);
            }
          }
        }
      } while (again.current && active.current);
    })().finally(() => {
      pending.current = null;
    });
    return pending.current;
  }, [client]);
  useEffect(() => {
    active.current = true;
    let debounce: ReturnType<typeof setTimeout>;
    const schedule = () => {
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
    return () => {
      active.current = false;
      clearTimeout(debounce);
      clearInterval(poll);
      void client.removeChannel(channel);
      window.removeEventListener('online', schedule);
      window.removeEventListener('offline', offline);
      document.removeEventListener('visibilitychange', focus);
    };
  }, [client, userId, refresh]);
  const save = useCallback(
    async (before: Store, next: Store) => {
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
  return { store, error, status, save, refresh };
}
