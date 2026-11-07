# SkyWallet

Aplikasi pencatat keuangan pribadi dan bersama: Next.js + React + TypeScript, Supabase Auth/PostgreSQL/Realtime, Gemini 2.5 Flash, serta PWA. Panduan pemasangan lengkap tersedia di **[SETUP.md](SETUP.md)**.

```bash
npm ci
cp .env.example .env.local
# Isi env dan jalankan SQL Supabase mengikuti SETUP.md.
npm run dev
```

## Alur utama

- Pengeluaran memiliki kategori Makan, Belanja, Pendidikan, Transportasi, Tagihan, Transfer, dan Lainnya. Transfer memunculkan rekening sumber/tujuan; tidak ada tab utama Transfer atau input nama transaksi.
- Judul selalu kategori; Catatan opsional. Pemasukan memiliki asal dana. Saldo pribadi dan bersama dipisahkan, termasuk alokasi tabungan.
- RPC `commit_finance` memvalidasi akses, versi data, idempotency key, dan saldo. Trigger ledger menerapkan perubahan bersih pada kedua rekening dalam transaksi database yang sama. Tidak ada update saldo langsung dari frontend.
- RLS membatasi baca; mutasi hanya melalui RPC tervalidasi. Whitelist email diperiksa saat signup, saat query/RPC, dan sebelum pemakaian Gemini. Secret Gemini hanya berada di server.
- Supabase adalah sumber data produksi. Realtime disertai pemeriksaan versi ringan, pemulihan saat online/fokus, dan penolakan konflik edit. Financial data berada di memori browser selama sesi; sesi Auth dan preferensi tampilan dapat tersimpan lokal.
- Share Target menerima satu JPG/PNG/WEBP maksimal 3 MB pada PWA/browser yang mendukungnya. Gambar hanya sementara di memori; API memakai official `@google/genai`, model `gemini-2.5-flash`, `responseSchema`, dan validasi runtime Zod. Output tidak pernah disimpan otomatis. Tidak ada Tesseract, PDF worker, atau penyimpanan foto.
- Hash berkas dan referensi mendeteksi duplikat pada rekening sumber; request ID melindungi retry dan tombol simpan terlindung dari klik ganda. Screenshot berbeda dari pembayaran yang sama tetap perlu diperiksa pengguna.
- Laporan, pencarian/filter, ekspor CSV/print, cadangan teks, rekening, tujuan tabungan, dan rencana dana memakai data pengguna.

## Visual dan perangkat

Noto Sans dimuat lokal. Token warna dan ukuran iPhone berasal dari SVG di `design/references/`; ikon/dekorasi asli diekstrak ke `public/design/`. `src/reference-ui.css` menyelaraskan tampilan. `LazyMotion` memisahkan fitur Framer Motion; transisi menggunakan transform/opacity, layout projection, dan preferensi reduced motion. Lihat [catatan desain](docs/mobile-design.md).

Android Chrome mendukung Web Share Target setelah pemasangan PWA. Safari/iPhone mendukung instalasi standalone, login, dan sinkronisasi, tetapi **belum mendukung penerimaan gambar melalui Web Share Target**. Detail batas dukungan dan langkah instalasi ada di SETUP.md.

## Validasi

```bash
npm run typecheck
npm test
npm run build
npm run test:e2e
```

Browser tests menggunakan build produksi dengan `SKYWALLET_DEMO=true` khusus server pengujian. Ini menguji UI dan PWA tanpa mengakses akun finansial sungguhan. Mode normal tidak memuat demo atau menyimpan transaksi ke localStorage. `npm test` menjalankan PostgreSQL nyata dalam PGlite untuk schema/RLS/ledger, serta mocked provider HTTP untuk validasi route dan SDK Gemini. Itu bukan bukti koneksi ke Supabase/Gemini milik Anda; lakukan uji tiga perangkat setelah konfigurasi.

Playwright memakai Chromium sistem di `/usr/bin/chromium` dan WebKit Playwright. Atur `CHROMIUM_PATH` jika berbeda; pasang WebKit dan dependensi OS dengan `npx playwright install --with-deps webkit` pada mesin pengujian. Untuk Chromium saja: `npm run test:e2e -- --project=desktop --project=iphone-size`. Emulasi WebKit tidak menggantikan pemeriksaan iPhone fisik.

## Struktur

| Lokasi                                        | Tanggung jawab                                        |
| --------------------------------------------- | ----------------------------------------------------- |
| `app/`                                        | Entry Next.js, metadata iOS, route API serverless     |
| `src/Application.tsx`                         | Login, undangan/pemulihan password, proses Share      |
| `src/finance-client.ts`, `src/use-finance.ts` | RPC, snapshot, konflik, idempotensi dan sinkronisasi  |
| `supabase/`                                   | SQL schema, RLS, RPC, whitelist, pengukuran kapasitas |
| `src/domain.ts`, `src/analytics.ts`           | Model keuangan dan perhitungan                        |
| `src/share.ts`, `src/scan-contract.ts`        | Hasil scanner, pemetaan bank dan validasi             |
| `src/backup.ts`                               | Pemulihan arsip teks ke akun kosong                   |
| `src/App.tsx`, `src/forms.tsx`, `src/ui.tsx`  | Layar, formulir, dialog dan picker                    |
| `public/design/`, `design/references/`        | Ornamen asli dan referensi SVG                        |
| `scripts/`                                    | Build Service Worker dan ekstraksi aset desain        |
| `tests/`                                      | Logika, database, API dan browser                     |

Deploy sebagai **Next.js di Vercel**, bukan sebagai static `dist`. File `vercel.json`, header keamanan, dan CSP ada dalam project. Tidak ada deployment atau akun cloud sungguhan yang dibuat dalam pengerjaan ini.

Saldo merupakan catatan aplikasi, bukan akses/mutasi ke bank. Foto dikirim ke Google selama pemindaian; aplikasi tidak menyimpannya, sedangkan retensi pihak Google mengikuti ketentuan layanan akun Anda. Kapasitas 500 MB tidak identik dengan 200 byte/baris: ukur menggunakan script kapasitas, termasuk indeks dan metadata layanan.
