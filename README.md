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

## Pintasan saat presentasi

`→`/`←` pindah scene · `Spasi` Play/Pause · `F` Freeze · `R` Reset · `1`–`4` pilih mesin/siklus · `L` label 3D (Scene 1) · `I` Ideal/Real (Scene 2) · `W` replay waterfall (Scene 2) · `B` Bloom (Scene 3) · `C` panel Calibration (Scene 4, 6) · `1`/`2` strategi IGV / Fuel-only (Scene 6) · `1`/`2`/`3` panel A/B/C (Scene 9) · `H` panel asumsi + basis O₂/volume (semua scene)
