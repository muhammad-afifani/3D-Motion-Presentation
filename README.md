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

## Pintasan saat presentasi

`→`/`←` pindah scene · `Spasi` Play/Pause · `F` Freeze · `R` Reset · `1`–`4` pilih mesin/siklus · `L` label 3D (Scene 1) · `I` Ideal/Real (Scene 2) · `W` replay waterfall (Scene 2) · `B` Bloom (Scene 3) · `C` panel Calibration (Scene 4, 6) · `1`/`2` strategi IGV / Fuel-only (Scene 6) · `1`/`2`/`3` panel A/B/C (Scene 9) · `H` panel asumsi + basis O₂/volume (semua scene)
