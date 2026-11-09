# Keuangan

Aplikasi pencatat keuangan pribadi yang sederhana. Transaksi dicatat lewat halaman web, disimpan di Google Sheet, dan laporan ringkasan dikirim otomatis ke email setiap tanggal 25.

## Fitur

- Catat pemasukan dan pengeluaran (tanggal, kategori, nominal, catatan) dari HP atau komputer
- Ringkasan periode berjalan: pemasukan, pengeluaran, dan saldo
- Daftar 10 transaksi terakhir
- Laporan email otomatis setiap tanggal 25: total pemasukan, pengeluaran, saldo, dan pengeluaran per kategori
- Tampilan mengikuti mode terang atau gelap perangkat
- Gratis: tanpa server dan tanpa database berbayar

## Cara kerja

```
Halaman web (GitHub Pages)
        │  kirim dan ambil data (dilindungi kata sandi)
        ▼
Google Apps Script (web app)
        │
        ▼
Google Sheet (tab "Transaksi")
        │  trigger bulanan, tanggal 25
        ▼
Email laporan (Gmail)
```

## Teknologi

- HTML, CSS, dan JavaScript (satu file: `index.html`)
- Google Apps Script
- Google Sheets
- GitHub Pages

## Isi repo

| File | Fungsi |
| --- | --- |
| `index.html` | Halaman web untuk mencatat transaksi dan melihat ringkasan |

Kode backend (Google Apps Script) tidak disimpan di repo ini karena berisi kata sandi pribadi. Kode itu dipasang langsung di Apps Script milik pemilik Sheet.

## Pemasangan

1. **Siapkan Google Sheet.** Buat Sheet baru, buka **Ekstensi > Apps Script**, lalu tempel kode backend. Ganti nilai `TOKEN` dengan kata sandi panjang dan acak (minimal 16 karakter).
2. **Atur zona waktu.** Di **Project Settings**, ubah zona waktu ke `Asia/Jakarta`.
3. **Jalankan `setup` sekali.** Fungsi ini membuat tab "Transaksi" dan jadwal laporan tanggal 25 pukul 08.00. Setujui izin akses saat diminta.
4. **Deploy sebagai web app.** Pilih **Deploy > New deployment > Web app**, dengan *Execute as*: Me dan *Who has access*: Anyone. Salin URL web app.
5. **Hubungkan halaman web.** Di `index.html`, isi konstanta `API_URL` dengan URL web app tadi.
6. **Aktifkan GitHub Pages.** Di **Settings > Pages**, pilih **Deploy from a branch**, branch `main`, folder `/ (root)`, lalu **Save**.
7. **Isi kata sandi di halaman.** Buka halaman webnya, masuk ke **Pengaturan**, isi kata sandi yang sama dengan `TOKEN`, lalu simpan. Kata sandi hanya tersimpan di browser.

## Cara memakai

1. Buka halaman web, pilih jenis transaksi, isi nominal, tanggal, kategori, dan catatan, lalu klik **Simpan transaksi**.
2. Transaksi langsung muncul di daftar dan di tab "Transaksi" pada Google Sheet.
3. Kalau salah input, perbaiki atau hapus barisnya langsung di Google Sheet.
4. Setiap tanggal 25, laporan masuk ke email akun Google pemilik Sheet.
5. Untuk mencoba laporan kapan saja, jalankan fungsi `sendMonthlyReport` dari editor Apps Script.

## Periode laporan

Satu periode berjalan dari tanggal 26 bulan sebelumnya sampai tanggal 25, sesuai jadwal pengiriman laporan. Transaksi tanggal 26 ke atas masuk ke periode berikutnya.

## Keamanan

- Repo dan halaman ini publik, tetapi data hanya bisa dibaca atau ditulis dengan kata sandi (`TOKEN`).
- Jangan menaruh kata sandi asli di repo atau membagikannya.
- Setiap kali kode backend diubah, buat versi deployment baru (**Deploy > Manage deployments > Edit > New version**).

## Rencana pengembangan

- [ ] Laporan lewat Telegram
- [ ] Grafik pengeluaran per kategori
- [ ] Pilihan periode laporan per bulan kalender
