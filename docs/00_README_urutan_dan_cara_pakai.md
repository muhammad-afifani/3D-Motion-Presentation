# Paket M9 — Scene 9, bahasa Inggris, referensi, Explore mode

## Cara pakai

1. Selesaikan dan merge M8b dulu. Paket ini dibangun di atasnya.
2. Salin seluruh folder ke repo: `docs/m9_pack/` (termasuk `seeds/`).
3. Kirim ke Claude Code satu step per sesi, urut. Contoh prompt pembuka:
   > Baca `docs/m9_pack/01_FIX_scene7_scene9.md` dan kerjakan sesuai aturan sesi di CLAUDE.md. Beri rencana singkat dulu dan tunggu persetujuan.
4. Setelah tiap step: baca laporan 5 baris, cek di browser, baru lanjut. Tempel laporan atau rencana ke sini bila ingin saya tinjau.

## Urutan dan model

| Step | Isi | Model |
|---|---|---|
| 01 | Perbaiki Scene 7 (geometri, header, legenda) dan Scene 9 (chart kosong), smoke test | Sonnet 5.5 high |
| 02 | UI full English, gaya tulis, sistem referensi (`references.json`, `basis.js`) | Sonnet 5.5 high; tinjau `basis.js` dengan Opus |
| 03 | Data baku mutu dari file, basis regulasi, chip kepatuhan, halaman Regulations | Opus 5.5 high |
| 04 | `thermo.js`: komposisi bahan bakar, SO₂, O₂ buang dari lambda, tes arah tuas | Opus 5.5 high |
| 05 | Redesain Scene 9 (5 tab) | Opus 5.5 high |
| 06 | Explore mode, glossary, deep link | Sonnet 5.5 high |

Opus 5.5 high untuk semuanya berlebihan. Pekerjaan mekanis (perbaikan bug, terjemahan, navigasi) cukup Sonnet 5.5 high. Pakai Opus untuk perubahan `thermo.js`, isi konten teknis dan regulasi, dan tinjauan rencana. Saya tidak bisa melihat batas pemakaianmu, jadi ini saran berdasarkan jenis pekerjaan.

## Asumsi yang saya ambil (mudah dibalik)

- "Full English" saya artikan: semua teks di layar English. Catatan presenter (`presenter.json`) tetap Indonesia karena itu naskah lisanmu. Nama resmi regulasi tetap Indonesia. Bila maksudmu lain, ubah Step 02, bagian "Keputusan bahasa".
- Dengan UI English, pemisah desimal pindah ke titik. Ini mengubah aturan id-ID di CLAUDE.md; Step 02 mencatatnya.
- Catatan presenter ikut disinkronkan hanya bila kamu mau; tidak dikerjakan di paket ini.

## Temuan yang mempengaruhi argumenmu

1. Basis regulasi: O₂ 15 %, gas kering, 25 °C dan 1 atm, NOx sebagai NO₂. Default aplikasi memakai 0 °C. Beda sekitar 9 % bila tidak dikonversi. Konstanta koreksi O₂ regulasi 21 (model mungkin 20,9).
2. **Tabel turbin gas (Permen LH 13/2009) tidak punya limit CO.** Argumen "jendela operasi CO" pada turbin tidak bisa bersandar pada regulasi ini. Ia harus bersandar pada izin lingkungan atau jaminan OEM. Aplikasi menyediakan isian untuk itu.
3. Tabel mesin di Permen LH 13/2009 digantikan Permen LHK 11/2021. Hanya yang terakhir dipakai untuk mesin.
4. Nilai model (indikatif, terkalibrasi ke literatur, bukan data unit): NOx mesin gas sekitar 316 mg/Nm³ di atas limit 285 (1000–3000 kW) dan 300 (di bawah 1000 kW); diesel sekitar 1373 di bawah 2300; DLN 15 ppm sekitar 28 di bawah 320. Jangan dipresentasikan sebagai hasil ukur.
5. Sulfur solar: untuk SO₂ di bawah 160 / 120 mg/Nm³ (15 % O₂, 25 °C, kering), sulfur sekitar 0,32 / 0,24 % berat, hitungan neraca massa saya.

## Yang harus kamu cek sendiri

- Semua angka limit di `regulations.seed.json` adalah transkripsi dari screenshot-mu. Cocokkan dengan teks resmi, lalu ubah `verified` menjadi `true` per grup.
- Basis (15 % O₂, 25 °C, kering, NO₂) saya baca dari catatan kaki PDF dengan kualitas OCR buruk. Konfirmasi di teks resmi, termasuk tanggal berlaku dan pengecualian (kapasitas, jam operasi, sulfur).
- `references.seed.json`: judul, penulis, tahun, dan penerbit ditulis dari pengetahuan saya, bukan dari buku di tanganmu. Nomor bab, halaman, dan nomor SAE belum diverifikasi (`locatorVerified: false`). Cocokkan dengan buku atau paper sebelum dipakai di slide.
- Konten `emission_formation.seed.json` kualitatif. Periksa arah efek untuk mesin yang kamu operasikan.
- Data lapangan (CEMS, jaminan OEM, profil beban historis, data methane slip) masih perlu darimu. Tanpa itu, semuanya tetap model indikatif.

## Setelah paket ini

Sinkronkan `docs/` final ke Project di claude.ai. Salinan di Project (`ALUR_SLIDE_presentasi.md`, `PROMPT_simulasi_3D.md`) sudah usang. Setelah itu kita bahas alat pengendali emisi gas dan partikulat.
