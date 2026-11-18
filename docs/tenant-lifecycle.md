# Fondasi siklus akun (lokal, belum diaktifkan produksi)

## Prasyarat rilis manual

- Tinjau dan uji `supabase/04-tenant-lifecycle.sql` pada staging setelah 01 dan 03. File SQL berurutan proyek ini bukan workflow CLI migrations; jangan menjalankan 01 lagi pada database lama.
- Backup database terlebih dahulu. Tidak ada migrasi, konfigurasi Auth, atau penghapusan akun yang dijalankan terhadap produksi dalam perubahan ini.
- Server Next.js memerlukan `NEXT_PUBLIC_SUPABASE_URL` dan **server-only** `SUPABASE_SERVICE_ROLE_KEY`. Jangan gunakan awalan NEXT_PUBLIC untuk service key. Endpoint mengembalikan 503 jika konfigurasi tidak tersedia; belum terbukti bekerja live.
- Setelah persetujuan rilis terpisah: aktifkan signup email, wajibkan konfirmasi email, minimum password 12 karakter, URL redirect yang tepat, SMTP dan rate limit/CAPTCHA Auth yang sesuai. Konfigurasi tidak diubah oleh implementasi lokal ini.
- Pastikan schema private tidak diekspos Data API. Jalankan security advisors pada staging sebelum rilis.

## Batas MVP

Akun baru mendapat UUID household sendiri dalam transaksi insert Auth yang sama. Metadata pengguna tidak menentukan tenant. Household dan allowlist legacy tetap dipertahankan. Ruang “bersama” untuk akun baru masih milik tenant tunggal; undangan/berbagi antar akun baru belum tersedia.

Hapus dompet hanya untuk pemilik, tanpa saldo awal/saldo, tanpa referensi transaksi dari/ke dompet, dan tanpa tujuan. Pemeriksaan database dilakukan sebelum seluruh batch, sehingga batch gabungan tidak dapat menyembunyikan dependensi. Tidak ada cascade riwayat.

Self-delete menerima hanya password dan teks `HAPUS AKUN`; identitas diambil dari `getUser(token)` server. Password diverifikasi ulang melalui Auth pada permintaan yang sama dan UUID harus cocok. Akun dengan wallet, transaksi yang dibuatnya, atau anggota household lain diblokir. OAuth-only/MFA flow khusus belum didukung: verifikasi harus berhasil atau penghapusan ditolak.

Server menandai deletion_pending (gate RLS/RPC server), mencabut sesi global, lalu memanggil admin deleteUser. Global sign-out mencabut refresh token, **bukan** JWT akses yang sudah terbit; gate database memblokir JWT lama. Jika revoke/delete gagal setelah penandaan, akun tetap terkunci dan bisa mengulang permintaan dengan password. Jangan membersihkan pending secara otomatis. Setelah Auth telah dihapus, retry token lama gagal autentikasi; itu bukan respons sukses palsu. Email ditombstone (active=false) untuk mencegah signup ulang mewarisi tenant lama; pemulihan/penggunaan ulang email perlu tinjauan administrator. Household kosong tidak dihapus otomatis.

Keberhasilan API baru dilaporkan setelah Auth admin delete berhasil. Tidak ada secrets di klien, tidak ada target userId dari klien, dan pesan kegagalan tidak membocorkan respons Auth mentah.

## Bukti lokal

`npm test` mencakup PostgreSQL nyata via PGlite untuk tenant legacy, isolasi dua pengguna, metadata bypass, owner check, batch dependensi, retry wallet delete, pending gate/stale JWT, dan izin service-only. Unit endpoint memakai Auth stub: tidak menghapus akun nyata. Uji staging Auth (SMTP, sessions, MFA, storage ownership) tetap diperlukan sebelum rilis.

Referensi: https://supabase.com/docs/reference/javascript/auth-admin-deleteuser ; https://supabase.com/docs/reference/javascript/auth-signout ; https://supabase.com/docs/reference/javascript/auth-signup .
