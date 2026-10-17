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

## Explore dan Present (tombol M)

Aplikasi punya dua mode. Pilihan terakhir disimpan di browser.

- **Explore** (default saat dibuka): navigasi di kiri berisi Scene 1–11, halaman Regulations, Emission formation, References, Glossary, Assumptions, serta Snapshot, Presenter, dan Present mode. Tombol `«`/`»` melipat navigasi menjadi rail agar scene 3D lebih lebar (di layar < 1600 px mulai dilipat). Di Explore, `←`/`→` hanya mengganti scene bila fokus ada di navigasi (`↑`/`↓` menggeser fokus); di tempat lain panah tidak mengganti scene.
- **Present**: tampilan bersih seperti sebelumnya. Navigasi disembunyikan, `←`/`→` dan `Spasi` bekerja seperti biasa, jendela presenter (`P`) tetap sinkron. Saat masuk Present muncul petunjuk kecil "M: Explore".
- **Alamat langsung** (bisa dibagikan atau dibookmark): `#/scene/N`, `#/scene/9/limits`, `#/scene/9/formation`, `#/scene/9/levers`, `#/scene/9/load-window`, `#/scene/9/ghg`, `#/regulations`, `#/formation`, `#/references`, `#/references/<id>`, `#/glossary`, `#/assumptions`. Contoh: `…/3D-Motion-Presentation/#/scene/9/levers`.
- Halaman penuh menghentikan render 3D selama terbuka; scene tetap terpasang dan lanjut saat halaman ditutup (`Esc` atau Close).
- **Glossary** dibaca dari `content/glossary.json` (bisa diedit di `dist/content/` tanpa build ulang, seperti konten lain). Isinya definisi saja, tanpa angka limit atau faktor; sumber hanya id dari `content/references.json`.

## Cara presentasi offline

Untuk laptop presentasi tanpa internet. Siapkan sekali saat masih online (`npm install`), lalu buat paket:

```bash
npm run package:offline   # → folder release/ (build base ./ + server + skrip start + BACA-SAYA.txt)
```

Salin seluruh folder `release/` ke laptop presentasi (flashdisk/zip), lalu jalankan salah satu:

| Laptop punya | Perintah (di folder `release/`) |
|---|---|
| Node.js ≥ 18 | `node server.mjs --open` (Windows: klik dua kali `start.bat`; macOS/Linux: `sh start.sh`) |
| Python 3 | `python3 server.py --open` (Windows: `py -3 server.py --open`) |
| Hanya Windows PowerShell | `powershell -ExecutionPolicy Bypass -File start.ps1` (**belum diuji di lingkungan pengembangan**) |

Ketiga server menyajikan `app/` di `http://localhost:8080/` (atau port berikutnya) dengan **MIME type eksplisit** (`.js`/`.mjs` sebagai `text/javascript`, `.json`, `.css`, `.html`, `.svg`, `.png`, `.woff2`) dan mengembalikan **404** untuk file yang tidak ada. Server polos (mis. `python -m http.server` biasa) tidak disarankan: di sebagian Windows `.js` bisa tersaji sebagai `text/plain` sehingga ES module dan Web Worker gagal. `start.bat` mencoba Node, lalu Python, lalu PowerShell. Langkah lengkap ada di `release/BACA-SAYA.txt`. **Uji paket di laptop presentasi sebelum hari-H.**

Di mesin pengembangan juga bisa: `npm run build:offline` lalu `npm run preview:offline` (http://localhost:4173/).

Catatan: membuka `index.html` langsung dengan klik dua kali (`file://`) **tidak** bisa, karena browser memblokir ES module dan Web Worker dari `file://`. Selalu pakai server lokal seperti di atas.

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

Tekan `S` (atau tombol **Snapshot**) untuk mengunduh PNG tampilan scene saat ini: canvas 3D, grafik, HUD, judul, pesan kunci, caption, dan basis emisi, pada **resolusi 2×**, mengikuti **tema aktif** (Dark atau Light). Nama berkas: `etel-scene-NN-YYYYMMDD-HHMM.png`; footer gambar memuat judul scene, waktu, dan pengingat bahwa angka emisi indikatif. Panel H, panel presenter, dan toast tidak ikut.

- Tidak ada dependensi tambahan: 3D dan grafik digambar ulang sesaat pada skala 2×, lalu teks halaman dilukis ke gambar. Font dan posisi teks bisa sedikit berbeda dari layar.
- Bila teks halaman gagal digabung, yang disimpan hanya canvas (3D + grafik) dan muncul pesan yang menjelaskannya.
- Untuk cetak: pilih Light di header, lalu tekan `S`.

## Tema Dark / Light

Sakelar **Dark | Light** ada di header kanan (urutan: Explore (M) · tempat sakelar EN/ID · Dark/Light · Model OK). Pilihan disimpan di browser (kunci `etel:theme`). Tanpa pilihan tersimpan, aplikasi selalu mulai dengan **Dark** dan tidak mengikuti setelan terang/gelap sistem operasi, supaya tampilan di proyektor tidak berubah karena setelan laptop.

- Light: latar krem/abu hangat, teks abu gelap, kontras teks ≥ 4,5:1 dan garis grafik ≥ 3:1 (WCAG AA; dijaga `tests/theme.test.js`).
- Viewport 3D tetap berlatar abu arang di kedua tema, jadi nyala, bloom, dan skala suhu tetap terbaca. Label 3D dan kartu di atasnya mengikuti tema.
- Warna spesies: hue sama; di Light sedikit lebih gelap. Partikel 3D dan legendanya selalu memakai palet gelap. Skala suhu dan legenda K tidak berubah.
- Jendela presenter mengikuti tema hanya bila penyimpanan browser terbaca; bila diblokir, tetap Dark.

## Pengaturan tersimpan

Browser mengingat: batas NOx/CO dan satuannya, basis O₂/volume, opsi Scene 11 yang disembunyikan, Quality dan Bloom, dan scene terakhir (hanya sebagai scene awal saat halaman dibuka; `R` mengembalikannya ke Scene 1). **Faktor kalibrasi tidak disimpan**: selalu mulai dari default; bila diubah, bilah atas menampilkan "Custom calibration (session only)". Hapus semuanya dengan **Reset saved settings** di panel `H`. Bila penyimpanan browser diblokir (mis. mode privat), aplikasi tetap berjalan normal tanpa mengingat apa pun.

## Kualitas tampilan dan performa

- **Quality** (Auto / High / Low, tombol `Q`) dan **Bloom** (Auto / On / Off, tombol `B`) berlaku di seluruh scene; atur juga di panel `H` bagian **Display**. Keduanya disimpan di browser.
- **Auto** menurunkan kualitas bertahap bila fps rendah (bloom mati → pixel ratio 1,0 + partikel ×0,6 → pixel ratio 0,75 + partikel ×0,3) dan menaikkannya lagi bila fps pulih, dengan jeda agar tidak berkedip. Saat kualitas diturunkan, bilah atas menampilkan **Quality reduced (Auto)** (klik untuk membuka pengaturan).
- Penurunan kualitas **hanya memengaruhi visual** (pixel ratio, bloom, jumlah partikel); angka HUD dan grafik tidak berubah.
- `Shift+D` membuka **overlay debug**: fps, ms/frame, draw calls, triangles, geometries, textures, programs, pixel ratio, bloom, tier kualitas. Bila GPU terdeteksi sebagai rendering software (SwiftShader/llvmpipe), overlay menandai bahwa fps bukan fps GPU.

## Uji browser otomatis (opsional, untuk pengembang)

Skrip Playwright terpisah (Playwright **bukan** dependensi proyek dan tidak dijalankan di CI). Pasang sekali: `npm i --no-save playwright && npx playwright install chromium` (atau pakai Playwright global; bisa juga `PLAYWRIGHT_MODULE=/path/ke/playwright/index.mjs`).

```bash
npm run e2e        # build + uji dispose: siklus scene 1→11→1 ×3; listener, ResizeObserver, Worker,
                   # konteks WebGL, subscriber store kembali ke baseline; renderer menyisakan 0 geometry/texture
npm run e2e:smoke  # build + smoke test tampilan: tiap scene (dan tiap tab Scene 9) di 1366×768, 1920×1080,
                   # 1280×720; tiap grafik yang tampil harus berukuran > 0 dan terisi ≥ 1 % piksel, tanpa teks
                   # meluber dan tanpa galat konsol. Gagal (exit 1) bila ada yang kosong/meluber. Screenshot
                   # Scene 7 dan 9 disimpan di scripts/e2e/shots/after/ (di-.gitignore, tidak di-commit)
npm run e2e:perf   # build + tabel per scene: fps, draw calls, triangles, geometries, textures
                   # (E2E_QUALITY=auto|high|low, E2E_SECONDS=4)
```

Tanpa GPU, Chromium memakai SwiftShader (rendering software): angka fps dari `e2e:perf` di lingkungan itu bukan fps GPU; draw calls/triangles/geometries/textures tetap bermakna. Firefox dan WebKit akan ikut diuji bila browsernya terpasang di Playwright, tetapi sejauh ini belum pernah dijalankan (browsernya tidak tersedia di lingkungan pengembangan).

## Daftar cek lintas browser (manual, sebelum presentasi)

**Pengujian otomatis baru dilakukan di Chromium; Firefox dan WebKit (Safari) belum diuji.** Periksa manual di browser yang akan dipakai:

| Cek | Chrome | Edge | Firefox | Safari (macOS) |
|---|---|---|---|---|
| Lencana "Model OK" hijau, Scene 1–11 terbuka dengan `→`/`←` | ☐ | ☐ | ☐ | ☐ |
| Tampilan 3D muncul (WebGL2), animasi berjalan, Scene 3 nyala + bloom | ☐ | ☐ | ☐ | ☐ |
| Scene 1/4: angka HUD muncul setelah slider digeser (Web Worker) | ☐ | ☐ | ☐ | ☐ |
| `P`: jendela presenter terbuka dan sinkron (izinkan pop-up untuk situs) | ☐ | ☐ | ☐ | ☐ |
| `S`: PNG terunduh dan teks HUD terbaca | ☐ | ☐ | ☐ | ☐ |
| Reload: batas NOx/CO dan scene terakhir diingat (`localStorage`) | ☐ | ☐ | ☐ | ☐ |
| `Shift+D`: fps wajar di laptop presentasi; `Q` mengganti Quality | ☐ | ☐ | ☐ | ☐ |
| Paket offline dari `release/` berjalan tanpa internet | ☐ | ☐ | ☐ | ☐ |

Catatan: Safari membutuhkan versi dengan WebGL2 (Safari 15+); di mode privat Safari, `localStorage` bisa ditolak (aplikasi tetap berjalan tanpa mengingat pengaturan).

## Pintasan saat presentasi

`→`/`←` pindah scene (Present; di Explore saat fokus di navigasi) · `M` Explore/Present · `Spasi` Play/Pause · `F` Freeze · `R` Reset · `P` jendela presenter · `G` Regulations · `?` References · `S` snapshot PNG · `Q` Quality · `B` Bloom (semua scene) · `K` laser pointer · `Shift+K` spotlight (`Esc` mematikan) · `Shift+D` overlay debug · `1`–`4` pilih mesin/siklus · `L` label 3D (Scene 1) · `I` Ideal/Real (Scene 2) · `W` replay waterfall (Scene 2) · `C` panel Calibration (Scene 4, 6; tombol Collapse melipatnya ke samping) · `1`/`2` strategi IGV / Fuel-only (Scene 6) · `1`–`5` tab Limits/Formation/Levers/Load window/GHG (Scene 9) · `E` edit opsi (Scene 11) · `H` panel asumsi + basis O₂/volume + Reset saved settings (semua scene)

**Animation speed** (0,1×–2×, 1× = 20 rpm visual) adalah satu kontrol bersama di semua scene beranimasi (Scene 1–8); hanya kecepatan tampilan, bukan putaran mesin di model.
