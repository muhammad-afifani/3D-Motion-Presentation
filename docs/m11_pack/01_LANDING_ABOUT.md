# Step 01: sumber baru, router, landing page (Scene 0), About, sakelar bahasa

Model: **Opus 5.5 high** (desain visual dan hero 3D).
Prasyarat: M10 dan audit docs sudah di-merge.
Aturan sesi: rencana singkat dulu (sertakan sketsa tata letak landing di 1366×768 dan 1920×1080, dan daftar file yang disentuh), tunggu persetujuan, kerjakan, tes, build, lapor 5 baris, berhenti.

## Tujuan

Orang yang membuka aplikasi untuk pertama kali langsung paham apa ini dan harus mulai dari mana. Halaman pertama harus terlihat sangat bagus, tetapi jujur: tidak ada angka hiasan, tidak ada klaim yang tidak didukung model.

## Tugas

### 1. Sumber baru
- Tambahkan 12 entri dari `docs/m11_pack/seeds/references.add.seed.json` ke `content/references.json` (salin apa adanya).
- Tambah tipe `'web'` ke `REFERENCE_TYPES` (`src/state/content.js`), urutan kelompok di halaman References: setelah `report`.
- Field opsional baru: `level` (`'intro'`), `accessed` (tanggal ISO). `validateReferences` menerimanya bila ada; tidak wajib untuk entri lama.
- Halaman References: entri `level: 'intro'` diberi lencana "Start here" dan bisa disaring ("Show: All / Start here"). Tautan `url` dibuka di tab baru.

### 2. `content/learn.json`
- Salin `docs/m11_pack/seeds/learn.seed.json` ke `content/learn.json`. **Jangan menulis ulang isinya.**
- Tambah `learn` ke `CONTENT_FILES` dan buat `validateLearn(j)` di `src/state/content.js`, sejalan dengan validator lain:
  - `version === 1`, `defaultLang ∈ {'en','id'}`, `reviewed` boolean.
  - Setiap teks berupa pasangan `{ en, id }` yang keduanya string tidak kosong.
  - id pelajaran unik; `answer` dalam rentang `options`; `refs` ada di `references.json`; `terms` ada di `learn.terms` atau `glossary.json`; `tryIt.route` lolos `parseHash` (setelah router Tugas 3); `charts[].lessons` ada.
- Fallback bundle: pakai **dynamic import** untuk `learn.json` supaya tidak masuk bundle utama. Laporkan ukuran chunk-nya.
- `build:offline` dan `package:offline` harus ikut membawa `learn.json`.

### 3. Router
Tambah ke `src/state/route.js` (fungsi murni, dengan tes):

| Alamat | Halaman |
|---|---|
| tanpa hash, `#`, `#/` | Landing (Scene 0) |
| `#/about` | About |
| `#/learn` | Daftar level (Step 02; untuk sekarang placeholder sederhana yang membaca judul level dari `learn.json`) |
| `#/learn/<lessonId>` | Pelajaran (Step 02) |
| `#/learn/charts` dan `#/learn/charts/<chartId>` | Chart guide (Step 03) |

- Alamat rusak tetap → null (perilaku lama).
- **Perilaku lama yang dipertahankan:** tautan langsung `#/scene/N[/tab]` dan halaman penuh lama tetap langsung terbuka tanpa melewati landing. Dalam mode Present, alamat tanpa hash membuka Scene 1 (seperti sekarang), bukan landing.
- Navigasi kiri: tambah item paling atas "Start" (Scene 0) dan kelompok "Learn" (Learn, Chart guide, About) di atas daftar halaman lama.
- Panah kiri di Scene 1 tidak pindah ke landing (urutan presentasi 1–11 tidak berubah). Jendela presenter tidak berubah; saat landing terbuka, jendela presenter menampilkan keadaan "Start" tanpa catatan.

### 4. Sakelar bahasa
- **Satu state global** `lang` (`'en' | 'id'`), default `'en'`, disimpan di localStorage dengan kunci `etel:lang` lewat helper aman yang sudah ada (try/catch; storage kosong atau melempar → `'en'`). Tidak ada `learnLang` terpisah. **Diubah saat Step 01 dikerjakan:** kunjungan pertama memakai `learn.defaultLang` (`'id'`), pilihan berikutnya diingat; ditinjau lagi saat paket D. Paket bahasa D memakai state yang sama untuk seluruh aplikasi.
- Sakelar `EN | ID` di **header kanan atas** (di antara "Explore (M)" dan lencana "Model OK", lihat peta posisi di `00_README`). Pada Step 01 sakelar ini mengganti teks Landing, About, Learn, Chart guide, dan Glossary; bagian lain aplikasi tetap English sampai paket D.
- Atribut `lang` pada kontainer halaman mengikuti pilihan (`en` / `id`) untuk pembaca layar.
- `tests/language.test.js`: kecualikan field `id` di `learn.json` dari pemeriksaan kata Indonesia; tambahkan pemeriksaan bahwa semua field `en` di `learn.json` lolos daftar yang sama.

### 5. Landing page (Scene 0)
Isi teks dari `learn.landing`. Arah desain:

- **Hero penuh layar** dengan rig 3D prosedural yang sudah ada (mis. piston terpotong dengan nyala, berganti perlahan ke turbin), kamera mengorbit pelan, latar gelap, bloom mengikuti setelan kualitas global. Gerak rig berbasis waktu (animasi hias); landing **tidak menampilkan angka model apa pun**. Bila nanti ada angka di landing, angka itu wajib dari `derive()`.
- Di atas hero: `kicker`, judul besar, `tagline`. Tipografi memakai font yang sudah ada di aplikasi (offline, tanpa Google Fonts).
- Empat kartu dari `learn.landing.cards`, dengan ikon sederhana buatan sendiri (SVG inline). Kartu Learn menampilkan jumlah level, jumlah pelajaran, dan total menit yang **dihitung dari `learn.json`**, bukan ditulis tangan.
- Kartu Present: masuk mode Present di Scene 1.
- Tombol "Continue at Scene N" bila ada scene tersimpan (`readSaved`).
- Baris tautan kecil: References, Glossary, Regulations, Assumptions.
- Pita legenda warna spesies (NOx oranye, CO merah-magenta, CO₂ abu-biru, CH₄ hijau, PM abu gelap) dari konstanta warna yang sudah ada, sebagai hiasan yang sekaligus konsisten dengan scene.
- Kalimat `honesty` tampil di bawah, ukuran kecil tetapi terbaca.
- `prefers-reduced-motion`: hero berhenti (satu frame diam). WebGL tidak tersedia: gradien statis + teks, tanpa galat.
- Loop render hero berhenti saat tab tersembunyi atau saat pindah halaman; dispose geometri, material, dan listener saat keluar (aturan CLAUDE.md).
- Tata letak: 1280×720, 1366×768, 1920×1080 tanpa scroll horizontal; di bawah 768 px kartu menumpuk satu kolom. Kontras teks memenuhi WCAG AA. Semua kartu bisa difokus dan dibuka dengan keyboard.

### 6. Halaman About
- Dari `learn.about`: judul dan enam bagian. Tata letak satu kolom yang nyaman dibaca (lebar baris ±70 karakter), dengan daftar isi kecil di samping pada layar lebar.
- Di akhir: tautan ke Learn, References, dan Assumptions.

### 7. Tes
- `tests/route.test.js` (atau file router yang sudah ada): semua alamat baru, alamat lama tidak berubah, Present tanpa hash → Scene 1.
- `tests/learn.test.js`: `validateLearn` lolos untuk seed; contoh rusak ditolak (pasangan kosong, ref tak dikenal, rute rusak, answer di luar rentang).
- Persistensi state `lang` (`etel:lang`) dengan storage yang melempar.
- Smoke e2e: `#/` → canvas hero tidak kosong, empat kartu terlihat, tidak ada error console; `#/about` terbuka; sakelar ID/EN mengganti teks; mode Present + alamat tanpa hash → Scene 1.

### 8. Dokumen
- README: bagian singkat "Landing, About, Learn" (Indonesia).
- CLAUDE.md: tambah baris M11 di status milestone (Step 01 selesai) dan alamat baru di bagian arsitektur.

## Larangan
- Tidak menulis ulang isi `learn.json`. Bila ada teks yang tidak cocok dengan aplikasi (misalnya kontrol yang disebut tidak ada), **laporkan** di laporan; jangan diperbaiki diam-diam.
- Tidak menambah dependensi baru. Tidak ada aset berhak cipta, font eksternal, atau CDN saat runtime.
- Tidak ada angka hiasan (penghitung animasi, statistik palsu).
- Tidak mengubah `presenter.json`, perilaku jendela presenter, atau `thermo.js`.

## Kriteria selesai
- `npm test`, `npm run build`, `npm run e2e:smoke` hijau. Ukuran bundle utama dan chunk `learn.json` dilaporkan; total tetap < 1,5 MB gzip.
- Screenshot landing di tiga resolusi disimpan di folder smoke yang sudah ada.
- PR tanpa merge, laporan 5 baris, berhenti.
