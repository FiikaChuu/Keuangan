// Server-only: API route and local tests only. Never import from a client component.
import { createClient } from '@supabase/supabase-js';
import {
  limitedReauth,
  LifecycleLimitError,
  lifecycleFetch,
  readLifecycleBody,
} from './lifecycle-security';

type Config = { url?: string; key?: string };
export async function resetOwnPersonalData(
  request: Request,
  config: Config,
  factory = createClient,
) {
  const reply = (status: number, code: string, message: string, extra = {}) =>
    Response.json(
      { code, message, ...extra },
      { status, headers: { 'Cache-Control': 'no-store' } },
    );
  if (!config.url || !config.key) return reply(503, 'NOT_CONFIGURED', 'Reset belum dikonfigurasi.');
  const token = request.headers.get('authorization')?.match(/^Bearer ([^\s]+)$/)?.[1];
  if (!token) return reply(401, 'AUTH_REQUIRED', 'Masuk kembali.');
  if (Number(request.headers.get('content-length') ?? 0) > 8192)
    return reply(413, 'INVALID_REQUEST', 'Permintaan terlalu besar.');
  let body: { password: string; confirmation: string; requestId: string; revision: string };
  try {
    const text = await readLifecycleBody(request);
    if (text.length > 8192) return reply(413, 'INVALID_REQUEST', 'Permintaan terlalu besar.');
    body = JSON.parse(text);
    if (
      !body ||
      Object.keys(body).some(
        (k) => !['password', 'confirmation', 'requestId', 'revision'].includes(k),
      ) ||
      body.confirmation !== 'RESET' ||
      typeof body.password !== 'string' ||
      !body.password ||
      body.password.length > 1024 ||
      typeof body.requestId !== 'string' ||
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
        body.requestId,
      ) ||
      typeof body.revision !== 'string' ||
      !/^[0-9a-f]{32}$/.test(body.revision)
    )
      return reply(400, 'INVALID_REQUEST', 'Isi kata sandi dan konfirmasi RESET.');
  } catch {
    return reply(400, 'INVALID_REQUEST', 'Permintaan tidak valid.');
  }
  const options = {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: { fetch: lifecycleFetch },
  };
  const admin = factory(config.url, config.key, options);
  const verifier = factory(config.url, config.key, options);
  let freshToken: string | undefined;
  try {
    const identity = await admin.auth.getUser(token);
    const user = identity.data.user;
    if (identity.error || !user?.email) return reply(401, 'AUTH_REQUIRED', 'Sesi tidak valid.');
    if (user.factors?.some((f) => f.status === 'verified'))
      return reply(403, 'MFA_UNSUPPORTED', 'Reset akun MFA belum didukung.');
    const fresh = await limitedReauth(
      admin,
      verifier,
      { id: user.id, email: user.email },
      body.password,
    );
    freshToken = fresh.data.session?.access_token;
    if (fresh.error || fresh.data.user?.id !== user.id || !freshToken)
      return reply(401, 'REAUTH_FAILED', 'Verifikasi kata sandi gagal.');
    if (fresh.data.user.factors?.some((f) => f.status === 'verified'))
      return reply(403, 'MFA_UNSUPPORTED', 'Reset akun MFA belum didukung.');
    const authorization = await admin.rpc('authorize_personal_reset', {
      p_user_id: user.id,
      p_request_id: body.requestId,
    });
    if (authorization.error || typeof authorization.data !== 'string')
      return reply(409, 'RESET_BLOCKED', 'Reset diblokir atau migrasi belum siap.');
    // Execute with ORIGINAL verified caller JWT, never service role or a client target UUID.
    const caller = factory(config.url, config.key, {
      ...options,
      global: { fetch: lifecycleFetch, headers: { Authorization: `Bearer ${token}` } },
    });
    const result = await caller.rpc('reset_personal_finance', {
      p_request_id: body.requestId,
      p_revision: body.revision,
      p_ticket: authorization.data,
    });
    if (result.error) {
      if (result.error.code === '40001')
        return reply(409, 'STALE_DATA', 'Data berubah. Muat ulang sebelum mencoba lagi.');
      if (result.error.code === '23503')
        return reply(
          409,
          'SHARED_CONNECTION',
          'Dompet pribadi terhubung data bersama/pengguna lain. Tidak ada data direset.',
        );
      if (result.error.code === '42501')
        return reply(
          409,
          'AUTH_STALE_OR_PENDING',
          'Sesi kedaluwarsa atau akun dibekukan. Masuk kembali.',
        );
      return reply(
        503,
        'RESET_UNAVAILABLE',
        'Reset tidak tersedia. Ulangi ID permintaan yang sama.',
      );
    }
    if (result.data?.reset !== true)
      return reply(
        503,
        'RESET_UNAVAILABLE',
        'Status reset belum terkonfirmasi. Ulangi ID permintaan yang sama.',
      );
    return reply(
      200,
      'RESET_COMPLETE',
      'Data pribadi direset; akun dan data bersama tetap utuh. Masuk kembali.',
      { reset: true, replayed: result.data?.replayed === true, requiresSignIn: true },
    );
  } catch (error) {
    if (error instanceof LifecycleLimitError)
      return reply(
        error.status,
        'REAUTH_LIMIT',
        'Verifikasi dibatasi atau tidak tersedia. Coba lagi nanti.',
      );
    return reply(
      503,
      'RESET_UNAVAILABLE',
      'Status belum dapat dipastikan. Ulangi ID permintaan yang sama.',
    );
  } finally {
    // Only revoke the temporary reauth session; do not log out or delete the account.
    if (freshToken) {
      try {
        await admin.auth.admin.signOut(freshToken, 'local');
      } catch {
        /* no secret logging */
      }
    }
  }
}
