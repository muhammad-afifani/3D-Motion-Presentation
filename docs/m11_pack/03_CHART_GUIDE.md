# Step 03: Chart guide dan tombol "?" di setiap grafik

Model: Sonnet 5.5 high.
Prasyarat: Step 02 di-merge.
Aturan sesi: rencana singkat dulu, tunggu persetujuan, kerjakan, tes, build, lapor 5 baris, berhenti.

## Tujuan

Siapa pun yang melihat grafik di scene bisa menekan "?" dan langsung membaca cara membacanya, lalu kembali ke grafik itu.

## Tugas

### 1. `#/learn/charts`: indeks
- `learn.landing.chartsIntro` di atas.
- Daftar 15 panduan dikelompokkan per scene (Scene 1, 2, 3, 4, 6, 7, 8, 9). Setiap baris: judul grafik (English, sama dengan layar), scene, tag tingkat model bila tersedia dari chart.

### 2. `#/learn/charts/<chartId>`: halaman panduan
Bagian, sesuai field di `learn.charts[]`:
1. Judul grafik (dari `titles`, English apa adanya) + "Scene N" yang bertaut ke `route`.
2. "What it shows" (`shows`), "Axes" (`axes`).
3. "How to read it" (`read`, daftar bernomor).
4. "What to look for" (`lookFor`), "Common mistakes" (`mistakes`).
5. Kata (`terms`, kotak yang sama dengan Step 02), pelajaran terkait (`lessons`), sumber (`refs`).
6. Tombol "Open the chart" ke `route`; bila datang dari tombol "?", tombol "← Back to the chart".

### 3. Tombol "?" di grafik
- Setiap grafik yang judulnya cocok dengan salah satu `titles` di `learn.charts` mendapat tombol "?" kecil di pojok (berdekatan dengan tag model/Basis, tidak menutupi data). Judul yang diakhiri "…" di seed adalah awalan (judul waterfall dibentuk oleh fungsi).
- Tooltip: "How to read this chart".
- Tersembunyi di mode Present dan **tidak ikut** dalam ekspor PNG (S).
- Pencocokan dilakukan di satu tempat (mis. `src/state/chartGuide.js`, fungsi murni `guideIdForTitle(title)`), bukan tersebar di tiap scene.

### 4. Tes cakupan
- `guideIdForTitle` untuk semua judul di seed → id yang benar.
- Tes cakupan: kumpulkan semua judul grafik yang dibuat scene (dari `STR` yang dipakai `createXYChart`, `createMultiLineChart`, `createBarChart`, `createCycleChart`, `createPVChart`, `createLineChart`, `createWaterfall`, `createFlameChart`, `createBraytonSchematic`). Setiap judul harus punya panduan; bila ada grafik tanpa panduan, tes gagal dan menyebut judulnya. Daftar pengecualian eksplisit diperbolehkan (mis. panel kalibrasi), dan harus disebut di laporan.
- Smoke e2e: buka Scene 6, klik "?" pada grafik NOx & CO vs load → `#/learn/charts/partload` → "Back to the chart" → Scene 6.
- Ekspor PNG Scene 6 tidak memuat tombol "?".

### 5. Gaya bahasa
Teks baru yang ditulis Claude Code (label tombol, tooltip, keadaan kosong) mengikuti gaya Step 02 M9: kalimat pendek, kata kerja aktif, tanpa frasa berikut: "delve", "unlock", "journey", "seamless", "in today's", "it's not just", "game-changer", "robust", "leverage", "empower", "dive into", "landscape", "embark", dan tanda pisah panjang (—). Untuk teks ID: tanpa "menyelami", "mari kita", "di era", "tidak hanya … tetapi juga".

### 6. Dokumen dan status
- README: cara memakai Learn dan Chart guide (Indonesia, singkat).
- CLAUDE.md: M11 selesai, alamat baru, aturan "konten Learn tidak berisi angka model" ditambahkan ke bagian aturan model.
- `docs/ALUR_SLIDE_presentasi.md`: satu baris "Scene 0 (landing) tidak dipresentasikan; dipakai untuk belajar mandiri".

## Larangan
- Tidak menulis ulang isi `learn.json`. Bila ada panduan yang tidak cocok dengan grafik nyata (sumbu, warna, garis), **laporkan** dengan detail; Ifan dan reviewer yang memutuskan perbaikannya.
- Tidak mengubah grafik selain menambah tombol "?".

## Kriteria selesai
- `npm test`, `npm run build`, `npm run e2e:smoke` hijau; ukuran bundle dilaporkan (< 1,5 MB gzip).
- PR tanpa merge, laporan 5 baris (sebut grafik yang dikecualikan dan ketidakcocokan yang ditemukan), berhenti.
