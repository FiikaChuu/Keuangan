# SkyWallet: dari project ini sampai online

Kode ini memakai Next.js, Supabase Auth/Database/Realtime, dan Gemini 2.5 Flash. Database dan kunci akun pribadi Anda belum dipasang di lingkungan pengerjaan. Ikuti urutan ini untuk mengaktifkannya.

## A. Siapkan kode dan Node.js

Gunakan seluruh project versi ini, termasuk `package.json` dan `package-lock.json`. Ini menggantikan versi Vite; jangan menyalin hanya file halaman ke project Vite lama. Simpan cadangan kode/data lama dahulu. Gunakan Node.js 24 LTS.

```bash
npm ci
cp .env.example .env.local
```

Di Windows, salin `.env.example` menjadi `.env.local` melalui File Explorer jika perintah `cp` tidak tersedia. Semua paket, termasuk `@google/genai`, Supabase, Framer Motion, dan font, sudah ada di package.json; tidak perlu memasang paket satu per satu.

File yang sudah dibuat dan harus ikut project:

| Bagian                  | File                                                                                             |
| ----------------------- | ------------------------------------------------------------------------------------------------ |
| Next.js, login, halaman | `app/`, `src/Application.tsx`, `src/supabase.ts`                                                 |
| Database dan keamanan   | `supabase/01-schema.sql`, `supabase/02-allow-users.sql`                                          |
| Sinkronisasi            | `src/finance-client.ts`, `src/use-finance.ts`                                                    |
| API pembaca nota        | `app/api/scan-receipt/route.ts`, `src/scan-contract.ts`, `src/share.ts`                          |
| PWA                     | `public/manifest.json`, ikon, `scripts/sw-template.js`, `scripts/build-sw.mjs`                   |
| Desain dan animasi      | `src/reference-ui.css`, `src/design.tsx`, `public/design/`, `src/motion.tsx`, komponen di `src/` |
| Konfigurasi deploy      | `next.config.ts`, `proxy.ts`, `vercel.json`, `.env.example`                                      |

Anda hanya perlu mengisi `.env.local` dan mengganti dua alamat email pada script whitelist. `public/sw.js` dibuat otomatis saat build.

## B. Buat Supabase

1. Buka https://supabase.com/dashboard, pilih **New project**.
2. Pilih organisasi, nama project, region terdekat, dan kata sandi database yang kuat. Simpan kata sandi di password manager; tidak perlu memasukkannya ke frontend.
3. Tunggu database siap. Gunakan project baru/kosong untuk script ini. Script skema bukan migrasi untuk menimpa database lama.
4. Buka **SQL Editor → New query**. Salin seluruh `supabase/01-schema.sql`, lalu **Run** sekali. Semua tabel, RLS, RPC, trigger saldo, dan publikasi Realtime dibuat dalam satu transaksi.
5. Buka `supabase/02-allow-users.sql`, ganti kedua contoh email dengan email Anda dan pasangan, **huruf kecil**, lalu jalankan di SQL Editor. Jangan mengundang pengguna sebelum whitelist ini dibuat.
6. Di **Database → Publications → supabase_realtime** (atau pengaturan Realtime tabel), periksa `wallets`, `transactions`, `goals`, `plans`, dan `household_members` sudah tercantum. Script sudah menambahkannya ketika publikasi Supabase tersedia.
7. Biarkan schema `private` di luar daftar **Exposed schemas** pada pengaturan Data API.

Kedua email memakai household yang sama. Rekening **Pribadi** hanya terlihat pemiliknya. Rekening **Bersama** terlihat kedua anggota. Transaksi yang menyentuh rekening bersama terlihat kedua anggota; transfer dari rekening pribadi pasangan tidak memberikan akses ke saldo/daftar rekening pribadinya. Hanya pengguna yang berhak atas kedua rekening dapat mengubah transfer tersebut.

## C. Ambil kunci Supabase dan Gemini

Di Supabase buka **Project Settings → API Keys** atau dialog **Connect**. Salin **Project URL** dan **Publishable key** (`sb_publishable_...`). Jika project masih memakai kunci lama, nilai `anon` boleh diisi pada variabel publishable yang sama. Jangan gunakan `service_role` atau `sb_secret_...`.

Buka https://aistudio.google.com/apikey, buat API key untuk project Google Anda, dan pastikan model `gemini-2.5-flash` dapat digunakan. Atur batas biaya/kuota di akun Google sesuai kebutuhan. Gemini dan Supabase adalah layanan berbeda; kuncinya tidak sama.

Isi `.env.local`:

```dotenv
NEXT_PUBLIC_SUPABASE_URL=https://PROJECT-ANDA.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_ISI_MILIK_ANDA
GEMINI_API_KEY=ISI_KUNCI_GOOGLE_ANDA
```

Dua variabel `NEXT_PUBLIC_` memang digunakan browser: keamanan data ditentukan RLS dan sesi login. `GEMINI_API_KEY` hanya dibaca route server; jangan beri awalan `NEXT_PUBLIC_`. `.env.local` sudah diabaikan Git. Jangan unggah foto nota atau kunci rahasia ke repository.

## D. Kunci pendaftaran, lalu deploy awal

1. Di **Authentication → Sign In / Providers → Email**, aktifkan login email/password dan matikan **Allow new users to sign up**. Jangan aktifkan anonymous sign-in atau provider sosial yang tidak dipakai. Tetap aktifkan konfirmasi email dan secure email change; atur minimum password 12 karakter pada pengaturan password Supabase agar aturan juga berlaku di server.
2. Aplikasi tidak menyediakan tombol daftar. Selain pengaturan Auth, trigger database menolak pengguna baru yang emailnya tidak ada di whitelist; RLS memeriksa whitelist lagi pada setiap akses.
3. Unggah project ke repository Git Anda. File `.env.local`, `node_modules`, `.next`, dan data cadangan pribadi tidak ikut diunggah.
4. Di https://vercel.com/new, pilih **Import Git Repository**, lalu pilih repository ini. **Framework: Next.js**; Root Directory adalah folder yang berisi `package.json`.
5. Gunakan Install Command `npm ci`, Build Command `npm run build`, dan biarkan Output Directory pada default Next.js. Jangan memakai `dist` atau static export; route Gemini memerlukan serverless runtime.
6. Di **Environment Variables**, tambahkan tiga variabel yang sama seperti bagian C untuk environment **Production**. Jika menggunakan Preview, sebaiknya gunakan project/kunci pengujian terpisah. **Jangan mengatur `SKYWALLET_DEMO=true` untuk produksi.**
7. Klik **Deploy**, tunggu sukses, lalu catat URL HTTPS tetap, misalnya `https://skywallet-anda.vercel.app`. Jika mengubah environment variable, lakukan **Redeploy**; kunci publik dibaca saat build.

## E. Daftarkan dua email dan atur kata sandi

1. Kembali ke Supabase → **Authentication → URL Configuration**. Isi **Site URL** dengan URL produksi Vercel yang tadi didapat.
2. Tambahkan **Redirect URLs** berupa URL produksi tersebut dan `http://localhost:5173` jika ingin menguji lokal. Gunakan URL tepat; jangan mengizinkan seluruh domain Vercel dengan wildcard pada aplikasi pribadi ini.
3. Konfigurasikan pengiriman email di **Authentication → Email / SMTP Settings**. Pengirim bawaan Supabase memiliki pembatasan penerima/rate; gunakan SMTP milik Anda jika undangan untuk kedua email tidak dapat dikirim. Atur Sender dan kredensial hanya di dashboard Supabase.
4. Buka **Authentication → Users → Add user → Invite user**, masukkan email Anda yang sama persis dengan whitelist. Ulangi untuk pasangan.
5. Masing-masing membuka tautan undangan di emailnya. Aplikasi menampilkan **Atur kata sandi**; gunakan kata sandi unik minimal 12 karakter. Setelah itu masuk dengan email/password di perangkat lain.
6. Jangan mengisi password pasangan di source code. Pengguna yang memiliki akses ke dashboard Supabase adalah administrator; dashboard tidak perlu dibagikan kepada pasangan.

Jika perlu mencabut akses, jalankan dari SQL Editor:

```sql
update private.allowed_users
set active = false
where email = 'email-yang-dicabut@example.com';
```

Akses database/API berikutnya ditolak, termasuk token lama. UI akan mendeteksi pencabutan pada pemeriksaan berikutnya; data yang sebelumnya sudah dilihat/disalin pengguna tidak dapat ditarik kembali. Untuk menghentikan sesi login juga, gunakan tindakan ban/sign-out pengguna di Supabase Auth.

## F. Jalankan dan periksa lokal

```bash
npm run dev
```

Buka http://localhost:5173. Setelah mengganti `.env.local`, restart server lokal. Untuk memeriksa hasil produksi:

```bash
npm run typecheck
npm test
npm run build
npm run start -- --port 3000
```

Service Worker diaktifkan hanya pada build produksi. Untuk pratinjau desain dengan data contoh tanpa Supabase, pada terminal macOS/Linux gunakan `SKYWALLET_DEMO=true npm run dev`. Pada PowerShell: `$env:SKYWALLET_DEMO='true'; npm run dev`. Ini mode demonstrasi lokal yang memakai penyimpanan browser, bukan mode produksi; hapus variabel tersebut setelah selesai.

## G. Isi rekening dan uji tiga perangkat

1. Masuk dengan akun Anda di Desktop dan HP 1; masuk dengan akun pasangan di HP 2.
2. Buka **Dompet**, tambahkan rekening Pribadi dan rekening Bersama dengan saldo awal sebenarnya. Pasangan membuat rekening Pribadinya sendiri jika diperlukan. Rekening bersama cukup dibuat sekali oleh salah satu anggota.
3. Buka **Transaksi → + → Pengeluaran**, pilih **Makan**, isi nominal dan rekening. Judul otomatis mengikuti kategori; Catatan boleh kosong.
4. Pilih kategori **Transfer** untuk pemindahan antar rekening milik Anda/bersama. Isi sumber dan tujuan. Nominal manual adalah dana yang diterima tujuan; biaya admin diisi terpisah.
5. Uji transfer kecil pada rekening bersama: sumber berkurang `nominal + biaya`, tujuan bertambah `nominal`. Ketiga perangkat yang berhak melihat rekening itu harus memperbarui data tanpa refresh. Perangkat pasangan tidak boleh menampilkan rekening Pribadi Anda.
6. Uji edit/hapus satu catatan. Penyimpanan ditolak jika saldo akan menjadi negatif, data sudah diubah perangkat lain, atau referensi/bukti sama pada sumber yang sama.
7. Matikan internet sesaat dan coba simpan: aplikasi menolak simpan saat offline. Sambungkan lagi, periksa status sinkronisasi, lalu ulangi melalui formulir yang sama. Jangan membuat catatan baru untuk mengulangi penyimpanan yang belum jelas hasilnya.

Pemeriksaan lokal otomatis sudah mencakup aturan keuangan, schema PostgreSQL, RLS, validasi API, dan UI. Pengujian tiga perangkat dengan Supabase dan Gemini asli tetap perlu Anda lakukan setelah kunci/akun diaktifkan.

## H. Pasang ke layar utama

- **Android (Chrome):** buka URL HTTPS → menu ⋮ → **Install app / Add to Home screen**. Buka aplikasi sekali sampai selesai memuat. Saat membuka foto JPG/PNG/WEBP di galeri/WhatsApp, pilih **Bagikan → SkyWallet**. Dukungan aplikasi penerima bergantung Chrome/Android; pembaruan manifest mungkin memerlukan pemasangan ulang pada instalasi lama.
- **iPhone (Safari):** buka URL HTTPS → tombol Share → **Add to Home Screen → Add**. Buka dari ikon agar tampil standalone. **Safari/iOS belum mendukung penerimaan gambar melalui Web Share Target.** Karena itu SkyWallet PWA tidak akan muncul sebagai penerima foto di Share Sheet iPhone. Login, transaksi manual, dan sinkronisasi tetap bekerja. Alur Share gambar native iPhone memerlukan aplikasi pembungkus dengan Share Extension; manifest web saja tidak dapat menambah dukungan ini.
- **Desktop (Chrome/Edge):** buka URL → ikon Install di address bar atau menu **Install SkyWallet**. Login menggunakan akun Anda.

Web Share Target bukan sinkronisasi bank: aplikasi mencatat saldo, tidak mengirim uang dari rekening bank sungguhan.

## I. Cara membaca nota dan mengonfirmasi hasil

Bagikan **satu gambar maksimal 3 MB**, format JPG, PNG, atau WEBP. HEIC dan PDF belum diterima; ekspor sebagai JPG/PNG terlebih dahulu. Tidak ada tombol upload foto manual di kanan atas.

API memverifikasi sesi dan whitelist, menerapkan batas **5 scan/menit, 30/jam, 80/hari per pengguna**, lalu mengirim gambar sementara ke Gemini. Hasil berupa kategori, total Rupiah, status transfer, bank sumber/tujuan, dan ringkasan Catatan. Tidak ada gambar/Base64 disimpan di Supabase, IndexedDB, atau cache aplikasi. Yang disimpan setelah konfirmasi hanyalah transaksi dan hash SHA-256 berkas untuk pemeriksaan duplikat.

Untuk hasil OCR, **Total terdebet** sudah termasuk biaya admin. Contoh total Rp102.500 dengan admin Rp2.500 menghasilkan transfer pokok Rp100.000: sumber turun Rp102.500, tujuan naik Rp100.000. Isi `0` jika tidak ada biaya. Pemilihan bank otomatis hanya terjadi jika bank terdeteksi dengan jelas dan ada tepat satu rekening yang cocok. Jika ada dua rekening bank yang sama, pilih sendiri.

Periksa nominal dan rekening sebelum menyimpan. Transfer ke merchant/orang di luar daftar rekening Anda perlu dicatat sebagai pengeluaran kategori yang sesuai, bukan dibuat sebagai saldo rekening milik Anda. Gambar/bukti samar atau output model yang tidak valid ditolak. Gambar tidak menjadi instruksi untuk model maupun kode.

Gambar dikirim ke layanan Google untuk dianalisis. Ketentuan pemrosesan/retensi Google mengikuti produk dan akun API Anda; aplikasi ini tidak menjamin penghapusan di infrastruktur Google. Periksa ketentuan API yang digunakan untuk dokumen keuangan. Jika Service Worker dihentikan sistem sebelum gambar diambil, gambar sementara hilang dan perlu dibagikan ulang.

## J. Cadangan, kapasitas, dan pemeliharaan

- Unduh cadangan JSON melalui **Pengaturan → Unduh cadangan lengkap** secara berkala. Arsip hanya berisi teks; simpan pribadi. Pemulihan cloud hanya tersedia ke akun kosong, maksimal 1.999 rekening/transaksi/tujuan per arsip dan ukuran 2 MB, agar data bersama yang lebih baru tidak tertimpa. Pemulihan membuat ID baru dan tidak memulihkan gambar lama.
- Jalankan `supabase/03-capacity.sql` untuk mengukur pemakaian database. 500 MB mencakup indeks, Auth, overhead baris, dan data lain. Ukuran nyata tidak selalu 200 byte/transaksi, sehingga tidak ada jaminan jutaan transaksi pasti muat. Dengan 20 transaksi/hari, setahun sekitar 7.300 transaksi; tanpa gambar, kebutuhan dua pengguna biasanya jauh lebih kecil daripada kuota tersebut. Ukur penggunaan, khususnya jika Catatan panjang.
- Realtime memberi sinyal perubahan; frontend memuat snapshot konsisten saat versi berubah. Pemeriksaan 30 detik hanya mengambil hash versi kecil bila data tetap sama. Riwayat tetap dimuat ke memori saat ada perubahan; untuk volume ratusan ribu/jutaan catatan, perlu paginasi/agregasi server sebelum skala tersebut digunakan.
- Service Worker hanya menyimpan aset aplikasi. Catatan cloud tidak dicache ke disk; mode offline tidak mengantrekan mutasi keuangan.
- Periksa kuota dan status project Supabase serta Google/Vercel. Paket gratis dapat memiliki batas pemakaian atau penghentian project tidak aktif.
- Perubahan skema berikutnya sebaiknya memakai file migrasi baru; jangan menjalankan ulang script pembuatan tabel atau menghapus database yang sudah terisi.
