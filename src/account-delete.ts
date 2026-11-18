// Server-only module: imported exclusively by the API route and local tests.
import { createClient } from '@supabase/supabase-js';
import {
  limitedReauth,
  LifecycleLimitError,
  lifecycleFetch,
  readLifecycleBody,
} from './lifecycle-security';

type Config = { url?: string; key?: string };
export async function deleteOwnAccount(request: Request, config: Config, factory = createClient) {
  const reply = (status: number, message: string) =>
    Response.json(
      { message, ...(status === 200 ? { deleted: true } : {}) },
      { status, headers: { 'Cache-Control': 'no-store' } },
    );
  if (!config.url || !config.key)
    return reply(
      503,
      'Penghapusan belum dikonfigurasi. Administrator perlu menyiapkan SUPABASE_SERVICE_ROLE_KEY dan migrasi 04 di server.',
    );
  const token = request.headers.get('authorization')?.match(/^Bearer ([^\s]+)$/)?.[1];
  if (!token) return reply(401, 'Masuk kembali sebelum menghapus akun.');
  if (Number(request.headers.get('content-length') ?? 0) > 8192)
    return reply(413, 'Permintaan terlalu besar.');
  let body: { confirmation?: string; password?: string };
  try {
    const text = await readLifecycleBody(request);
    if (text.length > 8192) return reply(413, 'Permintaan terlalu besar.');
    body = JSON.parse(text);
    if (
      !body ||
      Object.keys(body).some((k) => !['confirmation', 'password'].includes(k)) ||
      body.confirmation !== 'HAPUS AKUN' ||
      typeof body.password !== 'string' ||
      !body.password ||
      body.password.length > 1024
    )
      return reply(400, 'Isi kata sandi dan konfirmasi HAPUS AKUN.');
  } catch {
    return reply(400, 'Permintaan tidak valid.');
  }
  const admin = factory(config.url, config.key, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: { fetch: lifecycleFetch },
  });
  // Separate ephemeral client: reauthentication must not overwrite admin identity.
  const verifier = factory(config.url, config.key, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: { fetch: lifecycleFetch },
  });
  try {
    const identity = await admin.auth.getUser(token);
    const user = identity.data.user;
    if (identity.error || !user?.email) return reply(401, 'Sesi tidak valid. Masuk kembali.');
    if (user.factors?.some((factor) => factor.status === 'verified'))
      return reply(
        403,
        'Penghapusan mandiri akun MFA belum didukung. Hubungi administrator; akun tidak dihapus.',
      );
    const fresh = await limitedReauth(
      admin,
      verifier,
      { id: user.id, email: user.email },
      body.password!,
    );
    if (fresh.error || fresh.data.user?.id !== user.id || !fresh.data.session)
      return reply(401, 'Verifikasi kata sandi gagal.');
    // Password is verified by Auth on this request, never by JWT timestamps or metadata.
    const prepared = await admin.rpc('prepare_self_delete', { p_user_id: user.id });
    if (prepared.error) {
      await admin.auth.admin.signOut(fresh.data.session.access_token, 'local');
      return reply(
        409,
        'Akun masih memiliki dompet, riwayat, atau keanggotaan bersama, atau migrasi belum siap. Penghapusan diblokir.',
      );
    }
    // Global revokes refresh tokens, NOT existing access JWTs; DB pending gate blocks those.
    const revoked = await admin.auth.admin.signOut(fresh.data.session.access_token, 'global');
    if (revoked.error)
      return reply(
        503,
        'Akses akun dibekukan, tetapi sesi belum dapat dicabut. Ulangi penghapusan dengan kata sandi yang sama.',
      );
    const deleted = await admin.auth.admin.deleteUser(user.id, false);
    if (deleted.error)
      return reply(
        503,
        'Akses akun dibekukan; penghapusan Auth belum selesai. Ulangi atau hubungi administrator. Riwayat tidak dihapus otomatis.',
      );
    return reply(200, 'Akun telah dihapus.');
  } catch (error) {
    if (error instanceof LifecycleLimitError)
      return reply(error.status, 'Verifikasi dibatasi atau tidak tersedia. Coba lagi nanti.');
    return reply(
      503,
      'Penghapusan belum selesai. Coba kembali; jangan anggap akun sudah terhapus.',
    );
  }
}
