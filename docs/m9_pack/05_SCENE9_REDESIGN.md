# Step 05 — Scene 9 redesign: regulated emissions, how they form, what controls them

Model: Opus 5.5 high. Isi konten teknis dan klaim kepatuhan. Bagian layout saja boleh dikerjakan Sonnet, tapi satu sesi lebih aman.
Prasyarat: Step 01–04 selesai.
Aturan sesi: rencana singkat dulu (sertakan sketsa tata letak per tab), tunggu persetujuan, kerjakan, tes, build, lapor 5 baris, berhenti.

## Tujuan Ifan

Dari Scene 9, staf produksi bisa melihat: (1) limit yang berlaku per jenis mesin, kapasitas, dan bahan bakar; (2) bagaimana tiap polutan terbentuk (reaksi); (3) apa yang bisa disetel di mesin dan efeknya ke emisi **dan** ke efisiensi; (4) hubungannya dengan parameter yang diatur regulasi.

## Judul dan struktur

Judul scene: **Regulated emissions: how they form and what controls them.**

Bagian atas: pemilih equipment, kelas kapasitas, bahan bakar (dari store, Step 03). Indikator basis regulasi (O₂ 15 %, kering, 25 °C, as NO₂) dan banner "transcribed, confirm against official text".

Lima tab. Setiap tab harus menggambar konten pada ukuran 1366×768 (tes smoke Step 01 mencakup ini).

### Tab 1 — Limits
- Tabel limit dari `regulations.json` untuk pilihan aktif (parameter, limit, unit, metode uji).
- Di samping: nilai model dan nilai site data per parameter pada basis regulasi, dengan chip `Within / Above / Not modeled` (Step 03).
- Catatan jujur untuk turbin: "No CO limit in this table."
- Matriks cakupan model (Step 04) sebagai tabel kecil: parameter mana yang dihitung, kualitatif, atau input.

### Tab 2 — Formation
Kartu per parameter yang berlaku untuk pilihan aktif, dari `content/emission_formation.json` (salin dari `docs/m9_pack/seeds/emission_formation.seed.json`; muat lewat content loader):
- Ringkasan pembentukan, reaksi (tampilkan dengan subskrip yang benar), nama mekanisme, catatan laju.
- Daftar pendorong (arah naik/turun/campuran + alasan).
- Daftar tuas dengan efek ke NOx, CO, PM, UHC, efisiensi, dan konsekuensinya.
- Sumber: id dari `references.json` dirender sebagai tautan ke halaman References. Id yang tidak ada → "source to verify".
- Tanda "How this is modeled": `calibrated`, `mass-balance`, `semi-empirical`, `qualitative`, `site input`.
- Tidak ada angka baru di kartu. Angka hanya datang dari `frame`.

### Tab 3 — Levers
- Slider untuk tuas yang tersedia (Step 04, Tugas 1): timing, lambda, intake T, beban, EGR bila didukung. Tuas yang tidak ada ditampilkan nonaktif dengan label "not available in this model".
- Panel **Fuel**: slider komposisi gas (CH₄, C₂H₆, C₃H₈, C₄H₁₀+, N₂, CO₂, H₂S ppmv) dan sulfur solar (% berat). Tampilkan MW, LHV, AFR stoikiometri, CO₂ per GJ hasil `fuelGasProps`. Normalisasi otomatis, dengan jumlah mol ditampilkan.
- Chart utama: NOx dalam mg/Nm³ @15 % O₂, 25 °C, kering, as NO₂, terhadap tuas yang digeser, dengan garis limit dari regulasi.
- Chart pendamping: efisiensi (atau g CO₂/kWh) terhadap tuas yang sama, supaya trade-off terlihat di layar yang sama.
- Titik operasi berasal dari satu `frame` (aturan arsitektur).
- Slider di-debounce; `cylinderSim` tetap di Web Worker.

### Tab 4 — Load window
- Panel C lama (jendela operasi beban) dengan garis limit dari regulasi untuk NOx.
- Garis CO hanya bila presenter mengisi "Permit/OEM CO value" (Step 03). Label "permit/OEM value (user input)".
- Jaga kalimat yang didukung model: jendela operasi twin-shaft bergeser dan menyempit; single-shaft menunjukkan tebing CO setelah IGV habis.

### Tab 5 — GHG
- Panel B lama (CO₂ dan CO₂e) ditambah methane slip lewat `co2eWithSlip` (GWP 29,8, AR6, 100 tahun; sumber `ipcc-ar6-wg1-ch7`).
- Tulis jelas: slip tidak termasuk di CO₂ biasa; CO₂e lebih tinggi bila ada slip.

## Perilaku dan aturan

- Semua teks English, nada lugas (Step 02). Tag "Basis" di pojok tiap chart.
- Setiap angka ppm atau mg/Nm³ disertai basis O₂ dan volume.
- Tidak ada perhitungan termodinamika di `scenes/`, `charts/`, `ui/`. Butuh fungsi baru → kembali ke `thermo.js` dengan golden.
- Dispose chart dan listener saat pindah scene atau tab. Chart menggambar ulang saat container ditampilkan (akar bug Step 01).
- Cetak (print) dan ekspor PNG M8 harus tetap bekerja untuk semua tab.

## Larangan

- Tidak menyatakan lulus uji, hanya "Within / Above (model, indicative)".
- Tidak menulis klaim CO/PM mesin sebagai hasil model; keduanya kualitatif atau site input.
- Tidak menyebut vendor atau tipe.
- Tidak menyetel kalibrasi agar gambar terlihat bagus.

## Kriteria selesai

- Lima tab terisi di tiga resolusi; smoke test hijau; screenshot disimpan.
- Tes: jumlah kartu Formation sesuai kombinasi equipment dan parameter di JSON; semua `refs` valid; slider mengubah `frame` dan chart; garis limit berubah saat kelas kapasitas diganti.
- `npm test`, `npm run build` hijau. Laporan 5 baris, berhenti.
