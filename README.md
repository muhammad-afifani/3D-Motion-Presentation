# Engine & Turbine Emission Lab

Presentasi web 3D interaktif: siklus termodinamika → efisiensi → emisi untuk diesel engine, gas engine, turbin generator, dan turbin kompresor. Spesifikasi lengkap ada di `docs/PROMPT_simulasi_3D.md`, aturan kerja di `CLAUDE.md`.

## Versi online

https://muhammad-afifani.github.io/3D-Motion-Presentation/ (di-deploy otomatis oleh GitHub Actions setiap push ke `main`).

## Pengembangan

```bash
npm install
npm run dev        # server pengembangan di http://localhost:5173/
npm test           # vitest: golden test + tes UI (hanya butuh Node)
npm run build      # bundle untuk GitHub Pages (base /3D-Motion-Presentation/)
```

## Cara presentasi offline

Untuk laptop presentasi tanpa internet. Siapkan sekali saat masih online (`npm install`), lalu:

```bash
npm run build:offline     # bundle dengan path relatif ke folder dist/
npm run preview:offline   # sajikan dist/ di http://localhost:4173/ (tanpa internet)
```

Buka **http://localhost:4173/** di Chrome atau Edge, lalu tekan F11 untuk layar penuh.

Alternatif server statis lain (folder `dist/` hasil `build:offline` bisa disalin ke laptop mana pun):

```bash
npx serve dist                     # perlu paket "serve" sudah terpasang/ter-cache
python3 -m http.server 8080 -d dist   # lalu buka http://localhost:8080/
```

Catatan: membuka `dist/index.html` langsung dengan klik dua kali (`file://`) **tidak** bisa, karena browser memblokir ES module dan Web Worker dari `file://`. Selalu pakai server statis lokal seperti di atas.


## Konten presenter (Scene 10–11)

Teks kartu pengendali emisi (Scene 10) dan penutup (Scene 11) **bukan hasil model**; isinya ada di:

- `content/controls.json`: kartu DLN / lean premix, lean-burn, EGR, water/steam injection, SCR, oxidation catalyst, DPF. Tiap kartu berisi `lowers`, `raises`, `efficiency`, `operation`, `appliesTo` (`diesel` / `gas` / `turbine`), dan `relatedScenes`.
- `content/closing.json`: tiga poin ringkasan (`points`) dan opsi arah diskusi (`options`).

> **Periksa semua teks kartu sebelum dipakai.** Isi awal diambil dari `docs/ALUR_SLIDE_presentasi.md` dan sengaja kualitatif: tanpa angka emisi/termodinamika, tanpa nama vendor, merek, atau tipe. Besaran yang bergantung pada unit ditulis sebagai "perlu data unit".

**Mengedit tanpa build ulang.** Saat build, kedua file disalin ke `dist/content/`. Edit `dist/content/controls.json` atau `dist/content/closing.json` dengan editor teks, simpan, lalu reload halaman di browser (Ctrl+R / Ctrl+Shift+R). Untuk mengubah isi bawaan secara permanen, edit `content/*.json` di repo lalu build ulang.

- JSON yang **rusak atau skemanya salah** tidak membuat aplikasi crash: aplikasi memakai isi bawaan dan menampilkan banner galat yang menyebut nama file dan bidang yang salah.
- Bila file **tidak bisa diambil** (mis. 404), aplikasi memakai isi bawaan tanpa banner.
- Halaman harus dibuka lewat **server statis** (`npm run preview:offline`, `npx serve dist`, `python3 -m http.server -d dist`), bukan dengan membuka `index.html` langsung (`file://`). Di `file://` aplikasi tidak berjalan (ES module dan Web Worker), dan konten tidak bisa di-fetch.

## Mode presenter (tombol P)

Tekan `P` (atau tombol **Presenter** di bilah atas) untuk membuka **jendela kedua** (`presenter.html`) berisi:

- catatan scene aktif (Key message + Notes) dari `content/presenter.json`;
- timer total dan timer per scene (**Start / Pause / Reset**; `Spasi` di jendela presenter). Target durasi per scene (`targetMin`, menit) opsional; angka waktu berubah warna bila target terlewati;
- pratinjau teks scene berikutnya (nomor, judul, key message, catatan pertama);
- tombol **Prev / Next** (atau `←`/`→`) yang memindah scene di jendela utama.

Kedua jendela sinkron lewat `BroadcastChannel`, yang **hanya bekerja antarhalaman pada origin yang sama** (skema + host + port). Buka jendela presenter dari jendela utama (tombol `P`) dan pastikan keduanya berasal dari **server yang sama** (mis. sama-sama `http://localhost:4173/…`). Jendela dari server lain, port lain, atau `file://` tidak akan tersambung. Bila jendela presenter menunggu terus, tekan **Reconnect**.

Seret jendela presenter ke layar laptop, dan jendela utama ke proyektor (F11 untuk layar penuh). `P` lagi saat jendela sudah terbuka hanya memfokuskannya.

Bila **pop-up diblokir** browser (atau `BroadcastChannel` tidak tersedia), muncul pesan, lalu **panel presenter di dalam halaman** dibuka sebagai pengganti (isi sama; `P` atau Close untuk menutup). Untuk memakai jendela terpisah, izinkan pop-up untuk situs ini lalu tekan `P` lagi.

**Catatan presenter** ada di `content/presenter.json` (`scenes[]`: `number`, `keyMessage`, `notes[]`, `targetMin` opsional). Isi awal diambil dari "Naskah" dan "Pesan kunci" di `docs/ALUR_SLIDE_presentasi.md`, **tanpa angka model**; Scene 0 (Pembuka) digabung ke catatan Scene 1. Presenter bebas menambah angka sendiri. Cara edit sama dengan konten Scene 10–11: ubah `dist/content/presenter.json`, simpan, reload (jendela presenter juga); JSON rusak → isi bawaan + banner galat; file tidak ada → isi bawaan tanpa banner.

## Snapshot PNG (tombol S)

Tekan `S` (atau tombol **Snapshot**) untuk mengunduh PNG tampilan scene saat ini: canvas 3D, grafik, HUD, judul, pesan kunci, caption, dan basis emisi, pada **resolusi 2×** dengan **tema gelap**. Nama berkas: `etel-scene-NN-YYYYMMDD-HHMM.png`; footer gambar memuat judul scene, waktu, dan pengingat bahwa angka emisi indikatif. Panel H, panel presenter, dan toast tidak ikut.

- Tidak ada dependensi tambahan: 3D dan grafik digambar ulang sesaat pada skala 2×, lalu teks halaman dilukis ke gambar. Font dan posisi teks bisa sedikit berbeda dari layar.
- Bila teks halaman gagal digabung, yang disimpan hanya canvas (3D + grafik) dan muncul pesan yang menjelaskannya.
- Ekspor tema terang (untuk cetak) direncanakan di M8b.

## Pengaturan tersimpan

Browser mengingat: batas NOx/CO dan satuannya, basis O₂/volume, opsi Scene 11 yang disembunyikan, dan scene terakhir (hanya sebagai scene awal saat halaman dibuka; `R` mengembalikannya ke Scene 1). **Faktor kalibrasi tidak disimpan**: selalu mulai dari default; bila diubah, bilah atas menampilkan "Custom calibration (session only)". Hapus semuanya dengan **Reset saved settings** di panel `H`. Bila penyimpanan browser diblokir (mis. mode privat), aplikasi tetap berjalan normal tanpa mengingat apa pun.

## Pintasan saat presentasi

`→`/`←` pindah scene · `Spasi` Play/Pause · `F` Freeze · `R` Reset · `P` mode presenter · `S` snapshot PNG · `1`–`4` pilih mesin/siklus · `L` label 3D (Scene 1) · `I` Ideal/Real (Scene 2) · `W` replay waterfall (Scene 2) · `B` Bloom (Scene 3) · `C` panel Calibration (Scene 4, 6; tombol Collapse melipatnya ke samping) · `1`/`2` strategi IGV / Fuel-only (Scene 6) · `1`/`2`/`3` panel A/B/C (Scene 9) · `E` edit opsi (Scene 11) · `H` panel asumsi + basis O₂/volume + Reset saved settings (semua scene)

**Animation speed** (0,1×–2×, 1× = 20 rpm visual) adalah satu kontrol bersama di semua scene beranimasi (Scene 1–8); hanya kecepatan tampilan, bukan putaran mesin di model.
