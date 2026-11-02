# SkyWallet — adaptasi UI iPhone

Implementasi mengikuti delapan ekspor React dan gambar referensi yang diberikan pengguna: dashboard, daftar transaksi, filter, pemilih kategori, tambah transaksi, pemilih rekening, laporan, dan pengaturan. Ekspor tersebut menjadi acuan visual; komponen prototipe yang berulang disusun ulang agar dapat dipakai dengan data SkyWallet. Ini bukan hasil pengambilan langsung dari Figma API.

## Tampilan

- Poppins lokal, latar `#f9f8f6`, navy `#1d2949`, kartu putih, kontrol abu hangat, aksen turquoise, hijau, coral, dan amber sesuai referensi.
- Lebar acuan 393 px, jarak tepi 24 px, kartu membulat, grafik pada kartu terpisah, lembar pilihan dari bawah, dan lima tab navigasi.
- Navigasi: Beranda, Dompet, Transaksi, Laporan, Setelan. Rencana uang dan ruang bersama tersedia dari Dompet dan tautan insight.
- Dashboard mobile berisi saldo, empat ringkasan, tiga grafik, diagram kategori, dan tiga insight penting: rencana dana pribadi, belanja paling besar, serta saldo akun bersama. Rincian dompet dan transaksi berada pada tab masing-masing.
- Urutan transaksi memakai tombol dan lembar pilihan SkyWallet: terbaru, terlama, atau nominal terbesar, dengan penanda pilihan aktif.
- Safe area iPhone, tinggi layar dinamis, konten formulir yang bisa digulir dengan judul/X dan tombol simpan tetap terlihat, serta fokus dan penutupan dialog bertingkat. Tampilan menggunakan status bar dan indikator Home milik perangkat.
- Ikon SVG yang hanya disebut dalam ekspor tanpa berkas aslinya digantikan ikon lokal Lucide atau emoji kategori. Tidak memerlukan pemuatan aset Figma.

## Penyesuaian isi

| Bagian referensi               | Isi SkyWallet                                                                               |
| ------------------------------ | ------------------------------------------------------------------------------------------- |
| Saldo dan empat ringkasan      | Saldo semua akun, pemasukan, pengeluaran, alokasi tabungan, dana bersama                    |
| Income/expense, tren, kategori | Data transaksi nyata, pilihan 7/30/365 hari, transfer pokok tidak masuk arus bersih         |
| Paid/unpaid dan cash/card      | Jenis transaksi dan rekening bank/e-wallet, kategori, sumber pemasukan, biaya, bukti        |
| Pemilih metode pembayaran      | Pilihan rekening milik pengguna beserta saldo tercatat dan penanda bersama                  |
| Upah per jam dan jam kerja     | Pemasukan tidak tetap, cadangan wajib, alokasi dana tersedia                                |
| Report content                 | Semua/pemasukan/pengeluaran/transfer, tanggal valid, enam ringkasan dan ekspor terfilter    |
| Profil contoh dan notifikasi   | Profil lokal; tema dan cadangan tetap tersedia; tiga sakelar insight di bagian paling bawah |
| Delete account                 | Reset catatan lokal dengan konfirmasi; fitur cadangan tetap tersedia                        |

Perhitungan insight bersifat lokal dan dijelaskan dari catatan. Tidak memprediksi penghasilan tidak tetap, tidak menjanjikan hasil tabungan atau bunga bank, dan tidak memindahkan uang. Saldo bersama tetap terpisah dari alokasi pribadi. Penarikan tunai adalah pengeluaran.

## Verifikasi dan batasnya

Pengujian otomatis mencakup perhitungan keuangan, kalender laporan, unggah gambar/PDF dengan OCR lokal, pemilihan rekening, edit/hapus, cadangan berisi bukti asli, pemulihan, pembukaan offline, tema, preferensi insight, serta tata letak 375/393/430 px dan lanskap 852 px. Browser yang digunakan: Chromium desktop, Chromium ukuran iPhone, dan WebKit dengan emulasi sentuh iPhone.

Pengujian WebKit mengungkap kegagalan serialisasi Blob/File ke IndexedDB. Bukti sekarang disimpan sebagai byte asli dan tipe berkas; pembacaan Blob dari versi sebelumnya tetap didukung. Uji cadangan membandingkan kembali seluruh byte gambar asli setelah ekspor, kemudian memulihkan dan membuka buktinya.

Verifikasi pada 2 November 2026: build produksi berhasil; 26 tes logika lulus; 42 skenario browser telah diverifikasi pada ketiga proyek. Pemeriksaan mencakup tiga kartu insight dan preferensinya, pilihan bank dan urutan transaksi, pemulihan cadangan lama, serta posisi judul/X dan tombol simpan yang tetap saat isi formulir digulir. Pemeriksaan tambahan berhasil membuat tujuan tabungan melalui pemilih rekening, memfilter akun OVO, dan mengembalikan filter ke semua rekening.

Setelan menampilkan profil lokal, tema, data/cadangan, reset, lalu informasi di aplikasi pada bagian terakhir. Kartu informasi pencatatan, penyimpanan lokal, dan panduan iPhone disembunyikan dari UI; fungsi penyimpanan, pencadangan, serta PWA tetap tersedia. Nama aplikasi, logo teks, manifest, judul halaman, dan berkas ekspor memakai SkyWallet. Kunci penyimpanan lama dipertahankan; pemulihan menerima cadangan SkyWallet serta skySave.

WebKit Linux bukan perangkat iPhone fisik. Keyboard iOS, pemilih foto/file, Share, perilaku penyimpanan Safari/PWA, dan pemasangan ke layar utama masih perlu diperiksa di iPhone yang akan dipakai. Data dan bukti tetap lokal di browser; sinkronisasi antarperangkat dan login keluarga belum tersedia.

Perubahan ini tidak menerbitkan ulang environment atau melakukan deployment.
