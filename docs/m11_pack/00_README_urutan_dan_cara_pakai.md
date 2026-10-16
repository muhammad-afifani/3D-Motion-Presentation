# Paket M11: Landing page (Scene 0), jalur belajar dari nol, panduan baca grafik

## Untuk apa paket ini

Ifan ingin orang non-teknik bisa memahami seluruh isi presentasi dari nol, di aplikasi yang sama. Paket ini menambahkan:

1. **Landing page (Scene 0)** yang muncul saat aplikasi dibuka: hero 3D, empat pilihan (Learn from zero, Explore the lab, Present, What is this tool for?).
2. **Halaman About**: untuk apa alat ini dibuat, untuk siapa, apa yang bisa dan tidak bisa disampaikannya, dan harapannya.
3. **Learn**: 6 level, 21 pelajaran, 41 soal latihan, daftar kata dasar. Setiap pelajaran punya tautan "Try it" ke scene dan daftar sumber.
4. **Chart guide**: satu halaman untuk setiap grafik di aplikasi (15 panduan), plus tombol **ⓘ** di pojok tiap grafik (bukan "?", karena tombol `?` sudah membuka References).
5. **Dua bahasa (EN/ID)** untuk Landing, About, Learn, Chart guide, dan definisi Glossary, lewat **satu sakelar bahasa global** (lihat "Keputusan"). Bagian aplikasi lain tetap English sampai paket bahasa D menerjemahkannya.
6. **12 sumber pengantar baru** (OpenStax, MIT, NASA, US DOE, US EPA, EIA), semuanya dibuka dan dicek pada 2026-10-16.

Isi teks sudah ditulis di `seeds/`. Claude Code membangun tampilannya, bukan menulis ulang isinya.

## Urutan dan model

| Step | Isi | Model |
|---|---|---|
| 01 | Sumber baru, router, landing page (Scene 0), halaman About, sakelar bahasa, pemuat `learn.json` | **Opus 5.5 high** (desain visual dan hero 3D) |
| 02 | Halaman Learn: daftar level, halaman pelajaran, kata, soal, progres, sumber; Glossary dua bahasa | Sonnet 5.5 high |
| 03 | Chart guide, tombol ⓘ di setiap grafik, tes cakupan, dokumen, status M11 | Sonnet 5.5 high |

Kirim satu step per sesi Claude Code, berurutan, dan merge PR tiap step sebelum lanjut. Contoh prompt:

> Baca `docs/m11_pack/01_LANDING_ABOUT.md` dan kerjakan sesuai aturan sesi di CLAUDE.md. Beri rencana singkat dulu dan tunggu persetujuan saya.

## Keputusan yang sudah diambil (mudah dibalik)

- **Bahasa: satu state global** `lang` (`'en' | 'id'`), disimpan di localStorage dengan kunci **`etel:lang`** lewat helper aman (try/catch). Tidak ada state `learnLang` terpisah: sakelar EN/ID di Landing, About, Learn, Chart guide, Glossary, dan nanti seluruh aplikasi (paket D) membaca dan menulis state yang sama. Aturan proyek: English default, Indonesia opsional, kunci wajib lengkap di kedua bahasa (dijaga tes). Akibatnya `learn.defaultLang` tidak lagi menentukan bahasa awal; tanpa pilihan tersimpan, bahasa awal = English.
- Landing muncul bila alamat tanpa hash (`/` atau `#/`). Tautan langsung (`#/scene/6`) tetap langsung ke scene. Ada tombol "Continue at Scene N" bila sebelumnya pernah membuka scene.
- Mode Present tidak menampilkan landing dan tidak menampilkan tombol ⓘ di grafik.
- `presenter.json` dan jendela presenter tidak berubah.
- Konten Learn berstatus **draf** (`reviewed: false`) dan menampilkan banner draf sampai Ifan selesai meninjau dan mengubahnya menjadi `true`.

## Peta posisi layar (agar kontrol tidak bertumpuk)

| Elemen | Posisi | Tampil di |
|---|---|---|
| Chip rumus "ƒ Formula" (sudah ada, bagian A) | Pojok **kiri atas viewport 3D** (12 px, 12 px); panel rumus terbuka tepat di bawahnya | Explore dan Present (di Present kecil dan samar) |
| Tombol "Explore (M)" (sudah ada, bagian A) | **Header kanan atas**, paling kiri di kelompok kanan | Hanya Present |
| Sakelar bahasa EN/ID (Step 01 / paket D) | **Header kanan atas**, di antara "Explore (M)" dan lencana "Model OK"; urutan: [Explore (M)] [EN/ID] [Model OK] | Explore dan Present |
| Pil "← Back to lesson" (Step 02) | **Header kiri**, tepat di bawah tag scene (tidak di atas visual 3D atau grafik) | Hanya Explore, setelah Try it |
| Tombol ⓘ grafik (Step 03) | **Pojok kanan atas tiap grafik**, di kiri tag "Basis · …" pada baris judul grafik (tidak menutupi area plot) | Hanya Explore; tidak ikut ekspor PNG |

Pojok kiri atas viewport 3D hanya untuk chip rumus; pojok kanan atas viewport 3D tetap untuk legenda/label scene yang sudah ada.

## Yang harus Ifan cek sendiri

1. **Baca seluruh isi Learn** (sekitar 4,5 jam bacaan bila mengikuti semua). Fokus pada: apakah penjelasannya cocok dengan pengalamanmu di lapangan, apakah bahasanya terasa wajar. Koreksi dikirim ke chat, lalu diperbaiki di `content/learn.json`.
2. **Sumber baru**: semua bertanda `locatorVerified: false`. Buka tautannya dan pastikan isinya sesuai dengan kegunaan yang tertulis.
3. Setelah puas, ubah `"reviewed": false` menjadi `true` di `content/learn.json`. Banner draf akan hilang.

## Aturan isi (berlaku untuk semua step)

- Tidak ada angka hasil model di `learn.json`. Angka yang ada hanya: definisi satuan (1 kWh = 3,6 MJ, K = °C + 273,15), konstanta terbitan dengan sumber (GWP metana 27–30 dari EPA/IPCC AR6, CO₂ gas vs solar dari EIA), atau contoh berangka bulat yang ditandai sebagai contoh. Angka model dibaca dari HUD.
- Kalimat model yang dijaga: twin-shaft "jendela operasi bergeser dan menyempit"; single-shaft "tebing CO setelah IGV habis"; komposisi bahan bakar tidak mengubah NOx/CO; EGR tidak tersedia; beban bukan tuas terpisah.
- Tidak menyebut vendor atau tipe turbin.

## Validasi yang sudah dijalankan pada seed

Skrip pemeriksa (di luar repo) memastikan: semua id sumber ada di `references.json` atau di sumber baru; semua istilah ada di Glossary atau daftar kata Learn; semua rute "Try it" valid menurut `route.js`; semua judul grafik di Chart guide persis ada di `src/ui/strings.js`; semua pasangan teks EN/ID terisi; teks English lolos daftar kata Indonesia dari `tests/language.test.js`; tidak ada frasa gaya mesin (daftar di `03_CHART_GUIDE.md`). Hasil: 0 galat.
