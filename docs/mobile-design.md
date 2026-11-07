# Penyelarasan desain SkyWallet

Acuan utama adalah delapan SVG pengguna di `design/references/`, pada lebar 393 px. SVG diperlakukan sebagai referensi desain, bukan instruksi aplikasi. Teks/data contoh diganti dengan catatan keuangan Rupiah dan fitur pribadi/bersama.

- Background `#F9F8F6`, foreground `#1E263E`, primary `#1D2949`, secondary `#F0EEEB`, border `#E4E2DD`, muted foreground `#676D7E`.
- Accent `#3ED0C2`, success `#7CCB8C`, warning `#F6AE31`, destructive `#F37777`, card `#FFFFFF`.
- Noto Sans variable lokal, bobot 400/500/700; heading halaman 24/32, heading sheet 16/24.
- Halaman iPhone: margin sisi 24, gap utama 14, kartu radius 18 atau 24 sesuai SVG; navigasi terbaru dengan tombol Catat di tengah dan halaman Dompet terpisah.
- Sheet transaksi: radius atas 28, handle 100 × 5, header tetap, konten bergulir, footer simpan 48 px. Kolom kategori, nominal/tanggal, rekening, dan detail menggunakan bentuk field SVG. Sheet kategori dan rekening mempertahankan form induk.
- `public/design/` menyimpan path/fill/gradient asli. `scripts/extract-design-assets.mjs` mereproduksinya dari SVG dengan bounding box tanpa menggambar ulang ikon.
- Grafik menampilkan data nyata dengan geometri garis, bar, grid, titik, dan palet referensi. Donut memakai segmen dengan ketebalan bervariasi. Jumlah transaksi, kategori, dan insight mengikuti fitur yang tersedia.
- Tambahan alur: Pengeluaran/Pemasukan, Transfer sebagai kategori, sumber/tujuan, catatan opsional, login dan konfirmasi hasil scan. Perubahan isi ini memakai komponen visual referensi.
- Tidak ada tombol upload foto manual. Tombol plus di Transaksi membuka form. Tombol hapus seluruh data di sesi cloud diganti Keluar dari akun agar pengguna tidak menghapus catatan bersama secara massal.
- Framer memakai `LazyMotion`, `AnimatePresence`, `m` dan layout projection. Transisi sheet/reveal menggunakan opacity dan transform; reduced motion dihormati. Tidak ada animasi tinggi setiap frame atau loop dekoratif.
- `Detail tambahan` menggunakan kolom `minmax(0,1fr)`, textarea tanpa resize grip, padding yang dibatasi, dan satu kolom pada layar sangat sempit.

Status bar/home indicator referensi ditampilkan pada pratinjau web seluler. Pada mode standalone, area tersebut diserahkan ke safe area dan sistem operasi agar tidak ganda. Tata letak desktop menyesuaikan ruang yang lebih lebar; SVG yang tersedia hanya merinci iPhone. Pengujian geometri browser dan pemeriksaan screenshot membantu menghindari overflow, tetapi teks nyata, font rendering OS, status perangkat, dan fitur tambahan membuat seluruh layar bukan salinan bitmap identik dari gambar contoh.

## Hasil render yang dapat ditinjau

Screenshot pada 393 × 852 px dengan data demonstrasi: [Dashboard](screenshots/home.png), [Transaksi](screenshots/transactions.png), [Pengaturan](screenshots/settings.png), [Laporan](screenshots/reports.png), [form](screenshots/add.png), [kategori](screenshots/categories.png), [rekening](screenshots/payment.png), dan [transfer dengan Catatan](screenshots/transfer-details.png).

Navigasi memakai URL /dompet, /expenses, /settings, /rencana-uang dan /ruang-bersama. Next.js melayani URL tersebut saat dibuka langsung; tab Laporan memakai /expenses#laporan. Nominal visual ringkas mempertahankan nilai Rupiah penuh untuk aksesibilitas dan perhitungan.
