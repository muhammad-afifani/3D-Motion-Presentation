# Step 03 — Regulation data layer (limits from a data file, not from code)

Model: Opus 5.5 high. Isinya menyentuh basis perbandingan (O₂ referensi, volume, NO₂) dan klaim kepatuhan.
Prasyarat: Step 01 dan 02 selesai.
Aturan sesi: rencana singkat dulu, tunggu persetujuan, kerjakan, `npm test`, `npm run build`, lapor 5 baris, berhenti.

## Konteks

Ifan memberi dua tabel baku mutu (screenshot dari database titik pantau) dan tautan PDF-nya. Datanya sudah ditranskripsi ke `docs/m9_pack/seeds/regulations.seed.json`. Status: `transcribed-unverified`. Transkripsi dan basis (O₂ 15 %, 25 °C, kering, NO₂) harus dicek Ifan terhadap teks resmi.

Aturan CLAUDE.md yang berlaku dan harus dijaga: angka baku mutu tidak ditulis di kode. Datang dari file konten yang diisi presenter.

## Temuan penting yang harus tercermin di aplikasi

1. **Basis regulasi berbeda dari default aplikasi.** Regulasi memakai O₂ referensi 15 %, volume gas kering pada 25 °C dan 1 atm, NOx sebagai NO₂. Default aplikasi 0 °C. Tanpa konversi, perbandingan ke limit salah sekitar 9 %.
2. **Tabel turbin gas (Permen LH 13/2009) tidak punya limit CO.** Chart "operating window" turbin tidak boleh menggambar garis limit CO dari regulasi. Garis CO hanya muncul bila presenter mengisi nilai dari izin atau jaminan OEM, dan harus berlabel "permit/OEM value (user input)".
3. **Tabel mesin (Permen LHK 11/2021) menggantikan tabel mesin di Permen LH 13/2009.** Jangan masukkan tabel mesin lama.
4. Faktor koreksi O₂ untuk perbandingan regulasi memakai konstanta **21**: C_ref = C_meas × (21 − O₂ref) / (21 − O₂meas). Model saat ini mungkin memakai 20,9. Pakai 21 untuk jalur regulasi, dan jangan mengubah jalur lain tanpa tes golden baru.
5. Nilai model yang kebetulan melewati limit (indikatif, hasil kalibrasi ke literatur): NOx mesin gas terkalibrasi 168 ppm @15 % O₂ = sekitar 316 mg/Nm³ (25 °C), di atas 285 (1000–3000 kW) dan 300 (di bawah 1000 kW). Mesin diesel 730 ppm ≈ 1373 mg/Nm³, di bawah 2300. DLN 15 ppm ≈ 28 mg/Nm³, jauh di bawah 320. Tampilkan apa adanya. **Jangan menyetel kalibrasi supaya lolos.** Beri catatan: "Calibrated to typical literature values, not site data."

## Tugas

1. **Data.** Salin seed ke `content/regulations.json`. Muat lewat content loader yang ada (runtime-editable, fallback ke bundle). Skema di seed adalah acuan. Tambahkan validasi skema: tipe, `unit` harus `mg/Nm3` atau `%`, `refO2Pct` angka, grup punya `source` yang ada di `sources[]`. Data tidak valid → banner error yang jelas, tidak crash.
2. **Banner status.** Selama `verified: false` pada sebuah grup, tampilkan banner di halaman Regulations dan di Scene 9: "Transcribed from the published tables. Confirm against the official text before quoting." Banner hilang per grup bila `verified: true`.
3. **Fungsi di `thermo.js`** (dengan tes golden dan entri `basis.js`; lihat Step 04 untuk fungsi bahan bakar):
   - `ppmToMgNm3(ppm, molarMass, TrefC)` dan kebalikannya. Volume molar ideal pada 1 atm: V = R·T/P. Pada 0 °C = 22,414 L/mol, pada 25 °C = 24,465 L/mol.
   - `correctToRefO2(c, o2MeasPct, o2RefPct)` dengan konstanta 21.
   - `complianceStatus(value, limit)` → `within` | `above` | `notModeled` (nilai `null` = tidak dimodelkan atau tidak ada limit).
   - Golden (hitung tangan, toleransi 0,5 %): 320 mg/Nm³ NO₂ @25 °C = 170,2 ppm; 285 = 151,6 ppm; 300 = 159,5 ppm. 168 ppm → 315,9 mg/Nm³ @25 °C dan 344,8 mg/Nm³ @0 °C. 730 ppm → 1373 mg/Nm³ @25 °C. 15 ppm → 28,2 mg/Nm³. Faktor (21−15)/21 = 0,2857. Massa molar NO₂ 46,005; CO 28,010.
4. **Penerapan basis otomatis.** Di Scene 9 dan Scene 6, perbandingan ke limit memakai basis grup regulasi (O₂ 15 %, 25 °C, kering, NO₂). Tampilkan indikator "Regulation basis: 15 % O₂, dry, 25 °C, as NO₂". Pengguna boleh override basis tampilan, tapi chip kepatuhan tetap memakai basis regulasi dan indikatornya menyebut itu.
5. **Pemilih.** Tambahkan pemilih equipment (diesel engine / gas engine / gas turbine), kelas kapasitas (dari `capacityClasses`), dan bahan bakar (oil / gas). Pilihan ada di store (bukan state lokal komponen) supaya semua panel membaca satu sumber.
6. **Chip kepatuhan.** Untuk tiap parameter: `Within` / `Above` / `Not modeled`. `Not modeled` bila tidak ada limit di regulasi (mis. CO turbin) atau model tidak menghitungnya (lihat matriks di Step 04). Teks chip tidak boleh menyiratkan lulus uji: tulis "Model value vs limit (indicative)".
7. **Input data lapangan.** Presenter dapat mengetik nilai terukur (CEMS atau uji emisi) per parameter dengan satuannya dan basis O₂-nya. Nilai ini ditampilkan terpisah dari nilai model dengan label "Site data", dan chip kepatuhan dihitung dari nilai yang ada (site data diutamakan, ditandai).
8. **Input CO turbin.** Satu isian "Permit/OEM CO value" untuk turbin, opsional. Bila kosong, garis tidak digambar.
9. **Halaman Regulations.** Tabel lengkap per grup, kelas, dan bahan bakar. Kolom: parameter, limit, unit, metode uji. Tampilkan basis, catatan (`notes`), dan sumber dengan tautan. Catatan pengecualian (kapasitas < 25 MW, sulfur < 0,5 % berat, jam operasi) tampil sebagai teks, **bukan** sebagai logika yang mengubah limit.
10. **Update CLAUDE.md.** Ubah aturan "Angka baku mutu diisi presenter lewat input" menjadi: "Limits live in `content/regulations.json` and are never written in code. Values are transcribed from the published tables and carry a `verified` flag."

## Larangan

- Jangan menulis angka limit di `.js`.
- Jangan menyebut vendor atau tipe turbin.
- Jangan menyatakan "compliant" atau "lulus". Hanya "Within / Above (model, indicative)".
- Jangan memakai limit dari regulasi lain yang tidak ada di seed.

## Kriteria selesai

- Tes golden baru hijau. Tes validasi skema hijau. Tes bahwa tidak ada angka limit tertanam di `src/` (grep sederhana atas 285, 320, 2300, 3400 sebagai literal di luar tes dan fixtures).
- Halaman Regulations terbuka. Banner status terlihat.
- `npm test`, `npm run build` hijau. Laporan 5 baris, berhenti.
