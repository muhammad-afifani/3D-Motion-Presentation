# Step 06 — Explore mode: use the tool outside present mode

Model: Sonnet 5.5 high cukup (navigasi dan layout). Gunakan Opus hanya untuk meninjau rencana bila perlu.
Prasyarat: Step 01–05 selesai.
Aturan sesi: rencana singkat dulu, tunggu persetujuan, kerjakan, tes, build, lapor 5 baris, berhenti.

## Tujuan

Ifan ingin alat ini berguna juga di luar presentasi: membuka menu dan tampilan lain, membaca referensi, mengutak-atik scene tanpa harus masuk mode present. Mode present tetap ada dan tidak berubah perilakunya.

## Tugas

1. **Dua mode, satu aplikasi.**
   - `Explore` (default saat dibuka): navigasi persisten terlihat, semua halaman dapat dibuka kapan saja, tidak ada urutan paksa.
   - `Present`: tampilan bersih seperti sekarang (navigasi disembunyikan, jendela presenter via BroadcastChannel tetap bekerja).
   - Tombol atau tombol keyboard (mis. `P`) untuk berpindah. Simpan pilihan terakhir di `localStorage` dengan try/catch (bisa kosong atau melempar).
2. **Navigasi Explore.** Sidebar atau bilah atas dengan:
   - Scene 1–11 (judul singkat dalam English).
   - Halaman referensi: Regulations, Emission formation (semua kartu dari Step 05, tanpa harus lewat Scene 9), References, Glossary, Assumptions.
   - Tautan dalam (deep link) lewat hash, mis. `#/scene/9/levers`, `#/regulations`, `#/references`. Muat langsung ke halaman itu saat dibuka.
3. **Glossary.** Halaman baru dari `content/glossary.json` (runtime-editable): singkatan dan istilah (NOx, CO, UHC, PM, CEMS, IGV, DLN, lambda, TDC, dan sejenisnya), satu atau dua kalimat per istilah, English. Bila ada istilah dengan sumber, pakai id dari `references.json`.
4. **Assumptions.** Tombol `H` tetap membuka panel asumsi. Tambahkan halaman Assumptions yang berisi isi yang sama (dari `basis.js`), supaya terbaca di luar overlay.
5. **Konsistensi.**
   - Semua halaman membaca `store`/`frame` yang sama; tidak ada state ganda saat pindah halaman.
   - Dispose scene dan listener saat pindah (aturan CLAUDE.md).
   - Panah kiri/kanan dan ruang tetap berfungsi di Present; di Explore tidak mengubah scene kecuali fokus ada di navigasi.
6. **Layout.** Bekerja di 1366×768, 1920×1080, 1280×720. Navigasi dapat dilipat agar scene 3D punya ruang. Tidak ada scroll horizontal.
7. **Offline.** `build:offline` dan fallback bundle tetap bekerja untuk halaman baru (glossary, references, regulations).
8. **Tes.** Smoke test Playwright (Step 01) diperluas: setiap halaman Explore terbuka lewat deep link, tidak ada error console, tidak ada canvas kosong.
9. **Docs.** Update README (cara memakai Explore dan Present) dan CLAUDE.md (status M9).

## Larangan

- Jangan mengubah perilaku jendela presenter atau naskah (bahasa Indonesia).
- Jangan menambah dependensi besar (router berat). Hash routing sederhana cukup.

## Kriteria selesai

- Semua tes dan smoke hijau; build hijau; ukuran bundle tetap di bawah 1,5 MB gzip (laporkan angkanya).
- Laporan 5 baris, berhenti.
