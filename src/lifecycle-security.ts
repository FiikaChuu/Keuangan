// Server-only helpers. Identity MUST come from auth.getUser, never request/IP metadata.
import type { SupabaseClient } from '@supabase/supabase-js';
export const lifecycleFetch: typeof fetch = (input, init) =>
  fetch(input, {
    ...init,
    signal: init?.signal
      ? AbortSignal.any([init.signal, AbortSignal.timeout(10_000)])
      : AbortSignal.timeout(10_000),
  });
export class LifecycleLimitError extends Error {
  constructor(public status: number) {
    super('Reauthentication unavailable');
  }
}
export async function limitedReauth(
  admin: SupabaseClient,
  verifier: SupabaseClient,
  user: { id: string; email: string },
  password: string,
) {
  const acquired = await admin.rpc('acquire_lifecycle_reauth', { p_user_id: user.id });
  if (acquired.error) throw new LifecycleLimitError(503);
  if (acquired.data === null) throw new LifecycleLimitError(429);
  if (typeof acquired.data !== 'string' || !/^[0-9a-f-]{36}$/i.test(acquired.data))
    throw new LifecycleLimitError(503);
  try {
    return await verifier.auth.signInWithPassword({ email: user.email, password });
  } finally {
    // Failure leaves the DB lease closed until expiry; budget never refunded.
    try {
      await admin.rpc('release_lifecycle_reauth', { p_user_id: user.id, p_lease: acquired.data });
    } catch {
      /* fail closed */
    }
  }
}
export async function readLifecycleBody(request: Request): Promise<string> {
  const reader = request.body?.getReader();
  if (!reader) throw new Error('Missing body');
  const chunks: Uint8Array[] = [];
  let bytes = 0;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const expired = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      reject(new Error('Body timeout'));
      void reader.cancel();
    }, 3000);
  });
  try {
    for (;;) {
      const result = await Promise.race([reader.read(), expired]);
      if (result.done) break;
      bytes += result.value.byteLength;
      if (bytes > 8192) {
        await reader.cancel();
        throw new Error('Body too large');
      }
      chunks.push(result.value);
    }
    const joined = new Uint8Array(bytes);
    let offset = 0;
    for (const chunk of chunks) {
      joined.set(chunk, offset);
      offset += chunk.length;
    }
    return new TextDecoder('utf-8', { fatal: true }).decode(joined);
  } finally {
    clearTimeout(timer);
    reader.releaseLock();
  }
}
