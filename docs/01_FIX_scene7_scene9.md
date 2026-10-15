# Step 01 — Fix Scene 7 geometry and Scene 9 blank charts

Model: Sonnet 5.5 high cukup.
Prasyarat: M8b sudah selesai dan di-merge (atau kerjakan di branch di atas M8b).
Aturan sesi (CLAUDE.md): beri rencana singkat dulu, tunggu persetujuan, kerjakan, jalankan `npm test` dan `npm run build`, lapor 5 baris, lalu berhenti.

## Konteks

Dua bug yang dilaporkan dari tampilan browser (screenshot Ifan, 1366×768 kira-kira):

1. **Scene 7 (kompresor gas).** Model terpotong. Tiba-tiba ada pipa discharge yang keluar dan tidak tersambung ke volute. Teks header meluber keluar kotak. Label legenda "450" dan "412" saling menimpa.
2. **Scene 9 Panel A kosong.** Kotak chart tidak menggambar apa pun. Dugaan awal: regresi sejak M8 (layout, ResizeObserver, canvas berukuran 0 saat tab/panel disembunyikan lalu ditampilkan).

Jangan menebak penyebabnya. Reproduksi dulu, baru perbaiki.

## Tugas A — Scene 7

1. Reproduksi di 1366×768 dan 1920×1080. Ambil screenshot sebelum perbaikan (simpan di `scripts/e2e/shots/before/`).
2. Cari penyebab. Periksa berurutan:
   - Apakah clipping plane (cut plane) dipakai untuk efek "cutaway" dan ikut memotong pipa/nozzle? Plane harus hanya berlaku untuk casing/volute, bukan pipa.
   - Apakah pipa discharge diposisikan dengan koordinat sendiri, bukan dari titik nozzle volute? Posisi ujung pipa harus diturunkan dari geometri volute (titik keluar tangensial), bukan angka tetap.
   - Apakah kamera `fit` memakai bounding box yang tidak menyertakan pipa, sehingga model terlihat terpotong di tepi layar?
3. Perbaiki:
   - Pipa discharge menyambung tangensial ke nozzle volute tanpa celah. Satu sumber koordinat: fungsi di `src/gfx/` yang mengembalikan `{ nozzleCenter, nozzleDir, nozzleRadius }` dari parameter volute, dipakai oleh volute dan pipa.
   - Cut plane tidak memotong pipa atau flens.
   - Kamera membingkai seluruh rakitan (impeller, volute, pipa suction dan discharge) dengan margin. Hitung dari `Box3` seluruh grup.
   - Header: teks dibungkus (wrap) di dalam kotak, tidak melebihi lebar panel. Pakai `overflow-wrap`, `max-width`, dan ukuran font yang turun di layar sempit.
   - Legenda: label tidak boleh bertumpuk. Atur ulang posisi (tick di dalam batas, minimal jarak vertikal), atau jarangkan tick bila ruang kurang.
4. Tes baru (vitest, tanpa WebGL):
   - Fungsi geometri nozzle: titik awal pipa discharge sama dengan titik keluar nozzle (toleransi 1e-6).
   - Radius pipa sama dengan radius nozzle.
5. Dilarang menambah perhitungan termodinamika. Ini murni perbaikan geometri dan layout.

## Tugas B — Scene 9 Panel A kosong

1. Reproduksi. Buka Scene 9, pindah tab/panel lalu kembali. Cek di console: ukuran canvas, error, dan apakah `frame` terbaru sampai ke chart.
2. Bisect: `git bisect` antara commit terakhir yang masih menggambar Panel A (cek di M7b) dan HEAD. Laporkan commit penyebab.
3. Dugaan yang perlu dicek:
   - Canvas dibuat saat container `display: none` sehingga lebar/tinggi 0. Chart tidak pernah di-resize setelah container tampil.
   - `ResizeObserver` belum terpasang atau terlepas saat dispose scene.
   - Chart menunggu event/state yang sekarang tidak terkirim lagi.
4. Perbaiki di akar masalah (bukan menambah `setTimeout`). Chart harus menggambar ulang saat container berubah ukuran dan saat tab dibuka.
5. Tambah smoke test Playwright di `scripts/e2e/`:
   - Untuk setiap scene dan setiap tab, di 1366×768, 1920×1080, dan 1280×720: setiap canvas chart harus punya ukuran > 0 dan minimal beberapa persen piksel non-latar (hitung dari `getImageData`).
   - Tes gagal bila ada canvas kosong.
6. Tambahkan skrip `npm run e2e:smoke` dan sebutkan di README.

## Kriteria selesai

- Screenshot sesudah perbaikan di `scripts/e2e/shots/after/` untuk Scene 7 dan Scene 9, di tiga resolusi.
- `npm test`, `npm run build`, dan `npm run e2e:smoke` hijau.
- Laporan 5 baris: apa yang diperbaiki, commit penyebab Scene 9, hasil tes, cara cek di browser, keterbatasan. Lalu berhenti. Jangan mulai Step 02.
