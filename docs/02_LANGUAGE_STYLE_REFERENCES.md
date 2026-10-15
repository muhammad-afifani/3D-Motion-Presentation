# Step 02 — English UI, plain tone, and a reference system

Model: Sonnet 5.5 high untuk terjemahan dan perapihan string. Untuk bagian `basis.js` (peta fungsi → sumber) pakai Opus 5.5 high, atau minta Sonnet menyiapkan lalu Opus meninjau.
Prasyarat: Step 01 selesai.
Aturan sesi: rencana singkat dulu, tunggu persetujuan, lalu kerjakan, tes, build, lapor 5 baris, berhenti.

## Keputusan bahasa (jangan ditafsir ulang)

- **Semua teks di layar menjadi bahasa Inggris**: label, tombol, legenda, tooltip, panel asumsi, error, HUD, glosarium.
- **Catatan presenter** (`content/presenter.json`, jendela presenter) tetap bahasa Indonesia, karena itu naskah lisan Ifan.
- **Nama resmi regulasi** tetap dalam bahasa Indonesia (mis. "Permen LHK 11/2021"). Judul lengkapnya ditulis apa adanya dan diberi terjemahan singkat dalam tanda kurung.
- Tidak ada tombol ganti bahasa. Semua string tetap terpusat di `src/ui/strings.js` supaya mudah diubah nanti.
- Pemisah desimal: ikuti locale tampilan English (titik) di seluruh UI. Update `fmt` di `src/ui/` dan tes terkait. Catat perubahan ini di CLAUDE.md.

## Tugas A — Terjemahan

1. Inventaris semua string: `src/ui/strings.js`, `content/*.json` (kecuali presenter), string yang tertanam di `src/scenes/`, `src/charts/`, `src/gfx/`, `index.html`, `presenter.html` (bagian UI-nya saja).
2. Pindahkan string yang masih tertanam ke `strings.js`.
3. Terjemahkan ke English teknik yang lugas. Pakai istilah baku: "firing order", "bore", "stroke", "indicated/brake efficiency", "heat release", "dry low NOx", "part load", "turndown", "surge margin", "operating window".
4. Perluas tes `strings` agar gagal bila ada kata Indonesia umum yang tertinggal di string UI (daftar kata: yang, dan, dengan, untuk, tidak, ada, dari, pada, adalah, atau, ini, itu, sebagai, beban, tekanan, suhu, bahan bakar, emisi, baku mutu, lihat, tampil). Beri allowlist untuk nama regulasi dan isi `presenter.json`.

## Tugas B — Gaya penulisan

Tulis seperti insinyur menjelaskan ke rekan, bukan seperti brosur. Aturan:

- Kalimat pendek, langsung ke inti. Satu gagasan per kalimat.
- Tanpa pembuka basa-basi ("Perlu dicatat bahwa", "It is important to note", "In order to").
- Tanpa rantai hedging ("might potentially possibly"). Pakai satu kata kualifikasi bila perlu, dan hanya bila memang tidak pasti.
- Tanpa kata hiasan: "seamless", "robust", "leverage", "delve", "comprehensive", "cutting-edge".
- Aktif, bukan pasif, bila subjeknya jelas.
- Angka dan satuan di depan, penjelasan di belakang.
- Jangan menjelaskan apa yang sudah terlihat di layar.

Contoh sebelum → sesudah:

| Sebelum (terdengar seperti AI atau terjemahan kaku) | Sesudah |
|---|---|
| "Limit values are not hardcoded in the application but are provided via the content file." | "Limits come from content/regulations.json. Edit that file to change them." |
| "Please be aware that methane slip is not currently taken into account in this calculation." | "Methane slip is not included here. Real CO₂e is higher." |
| "This value is calculated by means of an indicative correlation." | "Indicative correlation, not site data." |
| "Tidak ada limit CO pada tabel ini." (dalam UI English) | "No CO limit in this table." |

Cek akhir: baca ulang semua string di `strings.js` satu per satu dengan aturan di atas.

## Tugas C — Infrastruktur referensi

Tujuan: setiap teori, rumus, dan korelasi di aplikasi punya sumber yang bisa dicek. Tidak boleh ada yang dikarang.

1. Salin `docs/m9_pack/seeds/references.seed.json` ke `content/references.json` (struktur sama). Muat lewat content loader yang sudah ada (runtime-editable, fallback ke bundle).
2. **Aturan keras:** hanya id yang ada di `references.json` boleh dikutip di UI. Bila sumber belum ada, UI menampilkan "source to verify", bukan sumber karangan.
3. Entri seed bertanda `locatorVerified: false` (nomor bab, halaman, nomor SAE, dan sejenisnya). Tampilkan penanda "locator not verified" di halaman Referensi sampai Ifan mengubahnya menjadi `true`. Jangan mengubah flag itu sendiri.
4. Buat `src/model/basis.js`: registri yang memetakan setiap fungsi publik di `thermo.js` ke
   `{ level, refs: [id], derivation, assumptions: [] }`.
   - `level` salah satu dari: `Ideal`, `Real`, `Semi-empirical`, `Site data`.
   - `derivation` satu atau dua kalimat: dari konsep apa rumus ini diturunkan (mis. "First law on a control volume; isentropic relations for an ideal gas").
   - Peta awal (periksa terhadap kode, jangan disalin buta):
     - Otto, Diesel, Brayton: Çengel & Boles, Saravanamuttoo.
     - Derating (suhu/ketinggian): Saravanamuttoo, Boyce.
     - Affinity laws dan head kompresor: Dixon & Hall, API 617.
     - Geometri engkol: Heywood bab 2.
     - Wiebe heat release: Ghojel 2010 (tinjauan sejarah dan asal Wiebe).
     - NOx Zeldovich: Zeldovich 1946, Lavoie 1970, Heywood bab 11.
     - DLN dan CO: Lefebvre, Correa 1992.
     - Koreksi O₂: lampiran regulasi, EPA Method 3A dan 19, ISO 11042.
     - F-factor: EPA Method 19.
     - GWP metana: IPCC AR6 WG1 bab 7.
   - Untuk fungsi yang murni empiris atau kalibrasi (`calibrateTo`, `ENGINE_NOX_CALIB`, `coDLN`), tulis jujur: "calibrated to typical literature values, not site data".
5. Tes: setiap fungsi yang diekspor `thermo.js` dan dipakai UI punya entri di `basis.js`. Setiap `refs` menunjuk id yang ada di `references.json`.
6. UI:
   - Tag "Basis" kecil di pojok setiap chart dan di HUD yang menampilkan angka model. Klik membuka kartu: level model, rumus/konsep asal, sumber, asumsi. Ini menggantikan label level model yang sekarang.
   - Halaman **References**: daftar semua sumber, dikelompokkan (buku, jurnal, standar, regulasi, basis data), dengan penanda locator.
   - Panel asumsi (tombol `H`) tetap ada dan memakai data dari `basis.js`.
7. Dilarang mengubah rumus di `thermo.js`. Bila menemukan rumus yang tidak cocok dengan sumbernya, laporkan di akhir dan jangan diperbaiki diam-diam.

## Tugas D — Update CLAUDE.md

- Ganti aturan bahasa: "UI English, speaker notes Indonesian, official regulation names kept in Indonesian."
- Tambah aturan referensi: hanya kutip id dari `content/references.json`; fungsi publik `thermo.js` wajib punya entri `basis.js`.
- Tambah milestone M9 (Step 01–06 pack ini) di daftar status.

## Kriteria selesai

- Tes string hijau; tidak ada kata Indonesia tertinggal di UI.
- Halaman References terbuka dari navigasi; tag Basis muncul di semua chart.
- `npm test` dan `npm run build` hijau.
- Laporan 5 baris, lalu berhenti. Sebutkan rumus yang tampaknya tidak cocok dengan sumbernya, bila ada.
