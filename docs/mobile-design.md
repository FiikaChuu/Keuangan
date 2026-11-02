# SkyWallet — seluruh aplikasi dari referensi Framer

Implementasi mengikuti seluruh versi publik [Miracle Startup](https://miracle-startup-935285.framer.app), sesuai konfirmasi pengguna. Tautan editor proyek memerlukan login dan tool Framer tidak tersedia pada sesi pengerjaan, sehingga pengukuran berasal dari halaman publik yang dirender di browser. Desain diterapkan pada aplikasi React SkyWallet, bukan pada proyek editor Framer.

[Galeri 17 layar iPhone](ui-preview.html) berisi screenshot implementasi dengan data contoh pada viewport 393 × 852.

## Cakupan lengkap

| Halaman / alur      | Implementasi                                                                                              |
| ------------------- | --------------------------------------------------------------------------------------------------------- |
| Beranda             | Kartu saldo navy, empat ringkasan, periode, tiga grafik, kategori, dan tiga Sky Insights                  |
| Dompet              | Total dan pembagian saldo, daftar dompet pribadi/bersama, keadaan kosong, akses rencana dan ruang bersama |
| Transaksi           | Pencarian, jenis, filter kategori/rekening/bulan/nominal, urutan, daftar, edit/hapus, CSV                 |
| Laporan             | Tab dalam halaman Transaksi, periode dan jenis, enam nilai aktual, cetak/PDF dan CSV                      |
| Rencana uang        | Cadangan wajib, dana tersedia, alokasi 100%, rincian perhitungan yang dapat dibuka, tujuan tabungan       |
| Ruang bersama       | Saldo terpisah, dompet bersama, pencatatan transfer, tujuan, riwayat                                      |
| Setelan             | Profil lokal, terang/gelap/sistem, cadangan dan pemulihan, reset, preferensi insight pada bagian terakhir |
| Catat               | Tombol awan di seluruh navigasi, unggah bukti dan input manual dalam satu lembar                          |
| Formulir            | Tambah dompet, tujuan, transaksi baru/edit, biaya dan detail tambahan                                     |
| Pemilih             | Kategori, bank/e-wallet, rekening, serta urutan transaksi dalam lembar bertingkat                         |
| Detail & konfirmasi | Detail transaksi, bukti asli, edit, hapus dengan konfirmasi, reset dan pemulihan                          |

## Sistem tampilan

`src/app.css` menjadi satu stylesheet aplikasi. Enam stylesheet lama diganti agar komponen memiliki ukuran dan perilaku yang sama di setiap halaman. `AppNavigation.tsx` menyediakan navigasi bersama, URL halaman, dan pemetaan tautan langsung. Tidak ada kerangka halaman Dompet yang terpisah.

Warna mengikuti Framer: latar hangat `#f9f8f6`, kartu putih, navy `#1d2949`, abu `#697087`, turquoise `#3ed0c2`, hijau, coral, dan amber. Noto Sans 400/500/600 tetap dibundel lokal. Judul 24 px, label 11–13 px, nominal kartu 23–32 px. Rp dan satuan memakai ukuran lebih kecil; nilai jutaan diringkas, sedangkan pembaca layar, detail dan ekspor tetap memakai nilai rupiah utuh.

Lebar mengikuti layar iPhone dengan margin konten 24 px; desktop memakai bingkai aplikasi maksimal 480 px. Kartu menggunakan radius 24 px dan tombol 13–16 px. Semua halaman menggunakan tab Beranda, Dompet, Catat, Transaksi, Setelan. Riwayat dan Laporan menjadi dua tab dalam tujuan Transaksi.

## Adaptasi untuk iPhone

Navigasi tetap di bawah saat konten digulir. Padding konten dan lembar mengikuti safe area. Status bar 9:41 serta indikator Home buatan dari prototipe dihapus; perangkat menampilkan miliknya sendiri. Badge/editor Framer tidak disalin.

Formulir memakai lembar dari bawah pada layar kecil, judul dan tombol tutup tetap terlihat, isi dapat digulir, serta tombol simpan berada di bagian bawah. Dialog bertingkat mempertahankan formulir induk dan fokus. Input memakai 16 px untuk menghindari zoom otomatis Safari. Animasi menghormati preferensi reduced motion. Grafik saldo menerima penunjuk mouse maupun sentuhan.

URL `/dompet`, `/expenses`, `/expenses#laporan`, `/rencana-uang`, `/ruang-bersama`, dan `/settings` membuka halaman yang sesuai. Refresh mempertahankan halaman; tombol kembali browser mengikuti navigasi. Ruang bersama dan rencana memberi akses kembali ke Dompet.

## Data dan validasi

Saldo, catatan, rencana, bukti OCR/PDF, dan cadangan tetap memakai model lokal SkyWallet. Proses redesain tidak mengosongkan data untuk meniru keadaan kosong Framer. Mode demo selalu diberi penanda. Tidak ada koneksi bank, login keluarga, atau sinkronisasi antarperangkat yang disimulasikan.

Perhitungan transfer pokok, biaya admin, cadangan wajib, dan alokasi diuji terpisah dari tampilan. Bukti asli tetap disimpan sebagai byte pada IndexedDB; cadangan lengkap dapat memulihkan bukti. Berkas cadangan lama skySave tetap diterima.

Screenshot galeri memakai Chromium. Pengujian WebKit Linux mengemulasikan ukuran dan sentuhan iPhone; ini bukan pengujian pada iPhone fisik. Keyboard, pemilih foto, dan pemasangan PWA pada perangkat nyata masih bergantung pada Safari/iOS pengguna. Perubahan ini tidak melakukan deployment server atau mengubah proyek Framer.

Verifikasi akhir 2 November 2026: build produksi berhasil; 27 tes logika dan 45 skenario browser lulus pada Chromium desktop, Chromium ukuran iPhone, serta WebKit. Pemeriksaan mencakup seluruh halaman, layar 375/393/430 px dan lanskap, formulir bertingkat, OCR gambar/PDF, saldo, cadangan/pemulihan, pembukaan offline, ekspor, tema, preferensi insight, tautan langsung, refresh, dan tombol kembali. Galeri memperlihatkan 17 halaman/keadaan antarmuka yang sudah dirender.
