# Proses Paket D (terjemahan EN/ID): berlaku untuk D3 dan seterusnya

Ringkasan cara kerja tiap tahap. Aturan teknis pola `{ en, id }` ada di `src/state/i18n.js` dan `CLAUDE.md`; daftar istilah di `docs/PADANAN_ISTILAH.md`; daftar yang sengaja tetap English di `docs/tetap_inggris.json`.

## 1. Aturan terjemahan

- Kalimat jujur model tidak berubah makna (lihat bagian 3).
- Kalimat pendek, kata kerja aktif, angka dan satuan di depan. Tanpa tanda pisah panjang (em dash).
- Tanpa nama fungsi atau konstanta kode di layar, tanpa nama vendor, merek, atau tipe.
- Basis O₂ dan basis volume selalu di samping angka ppm / mg/Nm³.
- Istilah mengikuti `PADANAN_ISTILAH.md`. Istilah baru yang butuh keputusan dicatat di sana, bukan diputuskan diam-diam di `strings.js`.
- Daftar "Tetap Inggris" terkunci. Perubahan berikutnya hanya koreksi sisi ID. Entri baru (teks atau jalur) hanya bila string tahap itu memang sama di kedua bahasa dan masuk kelompok yang sudah ada; alasan tetap satu per kelompok.
- Angka statis di string ID ditulis gaya Indonesia (`k = 1,4`, `2.200 K`). Angka dari fungsi memakai `fmt()` sehingga ikut bahasa.
- Keputusan istilah yang berlaku: chip `Within` / `Above` / `Not modeled` tetap English di kedua bahasa; "Site data" → "Data lapangan"; "limit" → "batas" (tab Scene 9 "Limits" menjadi "Batas" di D5).

## 2. Review mandiri sebelum PR

Agen terpisah, yang tidak ikut menulis terjemahan, menerima berkas dump pasangan EN|ID tahap itu dan `PADANAN_ISTILAH.md` (tanpa kesimpulan penulis). Ia menandai: makna bergeser, istilah tidak konsisten, kalimat yang terbaca sebagai klaim kepatuhan atau klaim yang tidak didukung model, dan terjemahan janggal. Temuan diperbaiki sebelum PR; yang ditolak dicatat beserta alasannya di laporan.

## 3. Tes kalimat jujur model (sisi ID): `tests/honesty.test.js`

Aturan berbasis frasa di sisi EN, jadi otomatis berlaku untuk kelompok yang dimigrasi tahap berikutnya (kelompok baru cukup masuk `MIGRATED_GROUPS`):

- "indicative" di EN → "indikatif" di ID.
- Basis O₂ dan volume tidak hilang (O₂, "dry" → "kering", °C, ppmvd, mg/Nm³).
- Tanpa "lulus", "patuh", "compliant", "memenuhi baku mutu/batas". Chip tetap `Within` / `Above` / `Not modeled`; judul "Nilai model vs batas (indikatif)".
- Twin-shaft = "bergeser dan menyempit"; single-shaft = "tebing" CO setelah IGV habis; tanpa "meledak".
- Kalibrasi: "literatur" + "bukan data/prediksi"; "vendor" hanya kata umum.
- Sisi ID bersih: tanpa nama fungsi, tanpa em dash, tanpa desimal bertitik di teks statis, angka statis sama dengan sisi EN.

Tiap tahap menambah frasa EN yang relevan bila muncul kalimat jujur model baru (D4: twin/single-shaft, part-load; D5: batas, kebijakan).

## 4. Smoke tampilan

- `langid` (semua scene × 3 viewport × 2 tema, ID): luapan, tumpang tindih, angka HUD format ID.
- `d3` (Scene 1–4 dan tab grafik): teks kanvas direkam dari `fillText` dan dibandingkan ID terhadap EN. Hanya yang bertambah di ID yang gagal (cacat bawaan EN bukan urusan terjemahan). Juga: judul ID → panduan ⓘ yang sama; label 3D dan judul grafik ikut bahasa tanpa muat ulang; footer PNG berbahasa ID; bolak-balik EN ↔ ID saat animasi berjalan tanpa galat konsol atau halaman.
- `d4` (Scene 5–8) memakai kerangka yang sama (`scenesIdFlow`) ditambah: perbandingan teks DOM + kanvas "ganti bahasa" vs "muat langsung ID" (menangkap teks yang membeku di bahasa awal), jaga tinggi grafik ID ≥ EN − 25 px, tumpang tindih panel kontrol, dan Scene 6 (chip, margin, garis batas, isian koma / titik saat bahasa berganti). Tahap berikutnya memakai `scenesIdFlow` dengan daftar scene tahap itu.
- Tick × tick pada kanvas diabaikan dalam perbandingan (bergantung tinggi grafik, bukan panjang teks); tinggi grafik dijaga terpisah.

## 5. Laporan akhir tahap

Lima baris: apa yang dibuat; hasil tes dan ukuran bundle; cara cek di browser; keterbatasan; string tersisa. Ditambah tabel EN | ID berisi 15–20 string paling berisiko (kalimat model, status, batas, kebijakan).
