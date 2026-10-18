# ALUR SLIDE — Presentasi "Efisiensi, Emisi, dan Baku Mutu pada Penggerak Migas"

Nomor scene sama dengan aplikasi (Scene 1–11) dan prompt simulasi 3D. Semua **angka model** di bawah berasal dari tes golden (`npm test`; `selfTest` 19 tes) atau dari frame aplikasi, dan **bersifat indikatif**: NOx dikalibrasi ke nilai tipikal literatur (diesel ≈ 11 g/kWh, gas lean-burn ≈ 2,5 g/kWh, DLN = 15 ppm @15% O₂ di titik desain), **bukan data unit**. Ganti dengan data CEMS/OEM sebelum presentasi resmi. Angka berlabel "tipikal/literatur" bukan hasil model; yang belum punya sumber di `content/references.json` ditandai **(to be sourced)**. Kata "lapangan" hanya dipakai untuk data unit.

**Di layar:** seluruh teks UI berbahasa English (judul tiap scene ditulis di bawah sebagai *Judul layar*). Catatan presenter (`content/presenter.json`) tetap Indonesia. Padanan istilah: `docs/PADANAN_ISTILAH.md`.

**Navigasi:** mode **Explore** (default saat dibuka, navigasi di kiri: scene, halaman Regulations, Emission formation, References, Glossary, Assumptions) dan mode **Present** (tombol `M`; navigasi disembunyikan, `←`/`→` dan `Spasi` seperti biasa, jendela presenter `P` tetap sinkron). Setiap scene punya alamat langsung `#/scene/N` (contoh `#/scene/6`); Scene 9 juga per tab, mis. `#/scene/9/levers`. Halaman: `#/regulations`, `#/formation`, `#/references`, `#/glossary`, `#/assumptions`.

**Scene 0 (landing):** tidak dipresentasikan; dipakai untuk belajar mandiri (Learn, Chart guide, About). Present dimulai di Scene 1.

**Baku mutu:** angka limit hanya dari `content/regulations.json` (tabel ditranskripsi dari Permen LH 13/2009 untuk turbin gas dan Permen LHK 11/2021 untuk mesin; selama `verified: false`, banner "Transcribed from the published tables…" tampil). Basis perbandingan kedua grup: **15 % O₂, kering, 25 °C, NOx sebagai NO₂**. Chip "Model value vs limit (indicative)" (`Within` / `Above` / `Not modeled`) selalu memakai basis ini dan menampilkan margin %; bila margin < 10 % muncul keterangan "margin is smaller than model uncertainty". Dokumen ini tidak menyalin angka limit; lihat halaman Regulations.

## Ringkasan waktu

| Versi | Durasi | Scene |
|---|---|---|
| Penuh | ±53 menit + tanya jawab | 1–11 (pembuka lisan di awal Scene 1) |
| Ringkas | ±35 menit | 1, 2, 4, 6, 9, 11 (lewati 3, 5, 7, 8, 10; ringkas lewat satu kalimat) |

Alur cerita: **mesinnya apa → energi jadi kerja dan panas → suhu menentukan emisi → pengendalian emisi mengorbankan sesuatu → jendela operasi tiap mesin berbeda → karena itu baku mutu seragam bermasalah.**

---

## Pembuka lisan (2 menit, di awal Scene 1)
- Tidak ada scene pembuka di aplikasi; catatannya ada di catatan presenter Scene 1 dengan awalan "Pembuka".
- **Pesan kunci:** Bahan bakar sama, mesin beda, emisi beda. Kenapa?
- **Naskah:** "Hari ini kita lihat satu hal: apa yang terjadi di dalam mesin sampai muncul angka di laporan emisi, dan kenapa satu angka batas tidak cocok untuk semua mesin."

## S1 · Piston: dari engkol ke diagram P-V (5 menit) · `#/scene/1`
- *Judul layar:* Piston: from crank to P-V diagram
- **Pesan kunci:** Satu putaran engkol = satu loop di diagram P-V; luas loop = kerja.
- **Visual 3D:** silinder cutaway, warna gas = suhu; titik berjalan di P-V.
- **Rumus:** `V(θ) = Vc + (πB²/4)(l + a − s(θ))`, `s = a·cosθ + √(l² − a² sin²θ)`.
- **Interaksi:** ganti diesel/gas, geser `r`, timing.
- **Angka demo (model, indicative):**
  - Diesel (r=16): Pmax ≈ 112 bar pada ±3,5° setelah TDC, η rem ≈ 42,5%, BSFC ≈ 199 g/kWh.
  - Gas (r=11): Pmax ≈ 105 bar pada ±16° setelah TDC, η rem ≈ 40,6%, BSFC ≈ 185 g/kWh.
  - (M10: cv(T) udara dari polinomial NASA; dulu 116 / 109 bar, η 44 / 42 %. Gas produk tidak dimodelkan, jadi Pmax dan η masih sedikit terlalu tinggi.)
- **Naskah:** "Garis ini bukan gambar. Titik di grafik dan posisi piston dihitung dari sudut engkol yang sama."

## S2 · Siklus ideal vs real (6 menit) · `#/scene/2`
- *Judul layar:* Ideal vs real cycles
- **Pesan kunci:** Teori 62–63% (batas ideal: Otto untuk gas engine, siklus dual untuk diesel); efisiensi rem tipikal mesin besar 42–45% (tipikal/literatur, **to be sourced**). Model (indicative): η rem 42,5% (diesel) / 40,6% (gas). Selisih teori–rem bukan "kesalahan", tapi fisika.
- **Visual 3D + P-V + T-s sinkron;** toggle Ideal ↔ Real; waterfall rugi.
- **Rumus:** `η_Otto = 1 − 1/r^(k−1)`, `η_Diesel = 1 − (1/r^(k−1))·(r_c^k − 1)/(k(r_c − 1))`.
- **Angka demo (model):**
  - Otto r=10: **60,2%**; Diesel r=18, r_c=2: **63,2%**; Otto r=18: **68,5%**.
  - Pada r yang sama Otto lebih efisien. Diesel unggul karena r jauh lebih tinggi.
  - Waterfall diesel: 63,2 (batas ideal siklus dual dari preset; dulu 67,0 dengan rumus Otto) → 60,4 (k turun, bercampur beda volume-tetap vs dual) → 56,3 (pembakaran butuh waktu) → 48,9 (rugi panas) → 43,3% (friksi).
  - Waterfall gas: 61,7 → 54,6 → 52,0 → 45,4 → 41,4%.
  - (M10: langkah k(T) kini memakai cv(T) NASA; dulu diesel 62,3 → 58,3 → 50,6 → 44,9 dan gas 56,6 → 53,9 → 47,1 → 43,1.)
- **Naskah:** "Tiga langkah pertama adalah fisika gas dan waktu pembakaran. Dua terakhir adalah panas yang lari ke dinding dan gesekan."

## S3 · Pembakaran, φ, dan suhu nyala (4 menit) · `#/scene/3`
- *Judul layar:* Combustion, φ, and flame temperature
- **Pesan kunci:** Suhu nyala ditentukan campuran. Diesel punya zona panas lokal; gas lean-burn homogen dan lebih dingin.
- **Visual 3D:** nyala berwarna sesuai φ; grafik suhu nyala adiabatik vs φ.
- **Angka demo (model):** φ=0,5 → ±1530 K (suhu masuk 300 K); φ=1,0 → ±2226 K. Pada campuran sudah dipanaskan oleh kompresi, suhu bertambah ±0,5–0,8 × kenaikan suhu masuk.
- **Naskah:** "Mesin diesel rata-rata miskin bahan bakar, tapi di dalamnya ada kantong yang hampir stoikiometrik. Kantong itulah yang menghasilkan NOx."

## S4 · NOx: kenapa suhu begitu menentukan (5 menit) · `#/scene/4`
- *Judul layar:* NOx: why temperature matters so much
- **Pesan kunci:** NOx tidak naik linier dengan suhu, tapi eksponensial.
- **Visual 3D:** gelembung zona terbakar, partikel NOx; grafik log NOx vs suhu nyala.
- **Rumus:** Zeldovich `d[NO]/dt ≈ 6×10¹⁶/√T · e^(−69.090/T) · [O₂]^½ [N₂]`.
- **Angka demo (model, indicative):**
  - Laju pembentukan NO pada 1900 K ≈ **7,1×** laju pada 1800 K.
  - Dalam jendela DLN (terkalibrasi 15 ppm di 1830 K): 1800 K → 8,5 ppm; 1900 K → 52 ppm (≈ **6×**).
  - Artinya **±100 K = ±6–7× NOx**.
- **Naskah:** "Ini sebabnya turbin dan mesin dioperasikan di jendela suhu yang sempit. Naik 100 derajat, NOx bisa enam kali lipat."

## S5 · Turbin gas: Brayton dari dekat (5 menit) · `#/scene/5`
- *Judul layar:* Gas turbine: a closer look at the Brayton cycle
- **Pesan kunci:** Turbin menghabiskan separuh kerjanya untuk memutar kompresornya sendiri; ambient panas langsung memotong daya.
- **Visual 3D:** kompresor aksial (bilah berwarna suhu), combustor, turbin.
- **Rumus:** `η_ideal = 1 − 1/r_p^((k−1)/k)`; `T₂ = T₁[1 + (r_p^((k−1)/k) − 1)/η_c]`.
- **Angka demo (model; r_p=15, T3=1500 K, η_c 0,87, η_t 0,90, ΔP combustor 4%):**
  - η ideal **53,9%**; η real **37,8%**; heat rate ≈ 9.530 kJ/kWh.
  - T₂ ≈ 675 K, T exhaust ≈ 843 K; back-work ratio ≈ 52%.
  - Ambient 35 °C: daya **−13,5%** (±0,68% per °C di atas 15 °C).
  - Turbin memakai cp konstan; mesin memakai cp(T). Keduanya tidak berbasis properti yang sama (catatan di kartu Basis).
- **Naskah:** "Di hari panas, turbin yang sama menghasilkan daya lebih kecil, dan titik operasi kompresornya bergeser."

## S6 · Part-load: generator vs kompresor (8 menit) — inti argumen · `#/scene/6`
- *Judul layar:* Part-load: generator vs compressor drive
- **Pesan kunci:** Generator punya titik optimum yang tetap. Pada turbin kompresor, titik operasi bergeser mengikuti beban dan jendela operasinya menyempit.
- **Visual:** dua turbin berdampingan (single-shaft kiri, twin-shaft kanan); grafik suhu nyala, NOx, CO, η terhadap beban; pita jendela DLN.
- **Baris regulasi (di bawah HUD):** chip NOx dan CO per konfigurasi pada beban saat ini, basis regulasi, dengan margin %. CO turbin "Not modeled" sampai nilai permit/OEM diisi (tabel turbin tidak punya limit CO). Klik → Scene 9 tab Limits; `Esc` atau `←` kembali.
- **Angka demo (model, indicative; NOx terkalibrasi 15 ppm @15% O₂ di desain; kalibrasi tiap konfigurasi terpisah):**

  | Konfigurasi | Beban | Suhu nyala | NOx (ppm) | CO (ppm) | η |
  |---|---|---|---|---|---|
  | Single-shaft, IGV | 100–70% | 1830 K (tetap) | 15 | 11,6 | 38% |
  | Single-shaft, IGV | 60% | 1693 K | 0,9 | **158** | 37% |
  | Single-shaft, IGV | 50% | 1554 K | 0,03 | **556** | 36% |
  | Single-shaft, tanpa IGV | 90% | 1734 K | 2,3 | 70 | 37% |
  | Single-shaft, tanpa IGV | 80% | 1638 K | 0,3 | 349 | 37% |
  | Twin-shaft | 100% | 1883 K | 15 | 6,8 | 40% |
  | Twin-shaft (N_gg 0,77) | 70% | 1829 K | 3,9 | 11,7 | 36% |
  | Twin-shaft (N_gg 0,62) | 50% | 1795 K | 1,5 | 20,5 | 31% |

- **Yang didukung model:**
  - Single-shaft: suhu nyala ditahan IGV sampai ±70% beban, lalu CO naik tajam (tebing / "cliff"). Tanpa IGV, tebing muncul sejak ±90%.
  - Twin-shaft: tidak ada titik tetap. Suhu nyala bergeser terus (±90 K dari 100% ke 50%), NOx turun ±10×, CO naik ±3×, η turun 40% → 31%.
- **Yang TIDAK didukung model (jangan diucapkan sebagai fakta):** "CO meledak di twin-shaft". Model memakai fuel split premix tetap; penjadwalan fuel split/bleed OEM tidak dimodelkan, jadi perilaku nyata twin-shaft bisa lebih baik atau lebih buruk. Kalimat aman: **"jendela operasinya bergeser terus-menerus dan menyempit, sehingga sulit menjaga NOx dan CO rendah bersamaan; besarnya perlu data OEM/CEMS unit."**
- **Naskah:** "Kalau generator dijaga di base load, ia berada di titik terbaiknya. Turbin kompresor mengikuti tekanan sumur dan pipa, jadi titiknya selalu bergerak."

## S7 · Kompresor gas dan hukum affinitas (4 menit) · `#/scene/7`
- *Judul layar:* Gas compressor and the affinity laws
- **Pesan kunci:** Turbin kompresor mengikuti proses, bukan sebaliknya.
- **Rumus:** `H_p = (Z·R·T₁/m)·(r_p^m − 1)`, `m = (k−1)/(k·η_p)`; `Q ∝ N`, `H ∝ N²`, `P ∝ N³`.
- **Angka demo (model; suction 20 bar, discharge 60 bar, T₁ 308 K, MW 18, 20 kg/s):** head ≈ **172 kJ/kg**, daya ≈ **4,3 MW**, T discharge ≈ 412 K. Head turun ke 80% → kecepatan ≈ **89%** dari desain; kecepatan 90% → daya tinggal **73%**.
- **Rangkaian kompresor → turbin (demo case, ṁ = 20 kg/s; dari model `compressorTrain`):**
  - Titik desain: daya kompresor **4,31 MW** → beban turbin **65,5%**, suhu nyala **1821 K**.
  - Psuc turun ke 18 bar: speed yang dibutuhkan **105,5%**, beban turbin **72,8%**, suhu nyala **1834 K**.
- **Naskah:** "Tekanan sumur turun sedikit, kecepatan power turbine ikut berubah, dan seluruh kondisi di combustor ikut bergeser."

## S8 · Emisi gabungan: diesel vs gas vs turbin (3 menit) · `#/scene/8`
- *Judul layar:* Combined emissions: diesel vs gas vs turbine
- **Pesan kunci:** Gas lebih bersih per kWh, tetapi methane slip bisa menghapus sebagian keunggulannya.
- **Angka demo (model, indicative):**
  - CO₂ spesifik: gas η 40,6 % ≈ **497 g/kWh**; diesel η 42,5 % ≈ **628 g/kWh** (≈ 21% lebih rendah).
  - NOx tipikal terkalibrasi (faktor 0,185, target literatur tetap): diesel ≈ 11,1 g/kWh; gas lean-burn ≈ 2,5 g/kWh.
  - Methane slip pada η 40%: slip 1% → CO₂e **561 vs 505 g/kWh (+11%)**; slip 3% → **673 (+33%)** (GWP 29,8, IPCC AR6, 100 tahun).
- **Naskah:** "Satu persen bahan bakar yang lolos tidak terbakar sudah menambah sepersepuluh jejak karbonnya."

## S9 · Emisi teregulasi: terbentuk dari mana dan apa pengendalinya (6 menit) · `#/scene/9`
- *Judul layar:* Regulated emissions: how they form and what controls them
- **Pesan kunci:** Menekan satu emisi hampir selalu menggeser yang lain; limit bergantung pada equipment, kelas kapasitas, dan bahan bakar.
- **Header (semua tab):** pemilih equipment (Diesel engine / Gas engine / Gas turbine), kelas kapasitas, bahan bakar; basis regulasi; banner "Transcribed…" selama `verified: false`; lencana Preset/Modified dan tombol "Reset to preset" untuk tuas tab Levers.
- **Tab 1 · Limits** (`#/scene/9/limits`): tabel limit dari `content/regulations.json` (parameter, limit, satuan, metode uji) berdampingan dengan nilai model dan isian site data; chip + margin %; alasan selalu tertulis untuk "Not modeled"; matriks cakupan model (6 parameter × 3 equipment). Site data diutamakan dan ditandai. Contoh hasil model (indicative) untuk gas engine: kelas 100–500 dan 500–1000 kW **Within, margin +2,7%**; kelas 1000–3000 kW **Above, margin −2,5%**; keduanya "margin is smaller than model uncertainty". Diesel: Within di semua kelas dengan margin besar.
- **Tab 2 · Formation** (`#/scene/9/formation`, juga halaman `#/formation`): kartu kualitatif per parameter (reaksi, pendorong, tuas, sumber) dari `content/emission_formation.json`; tanpa angka model.
- **Tab 3 · Levers** (`#/scene/9/levers`): lima tuas mesin (timing, φ, intake T, boost, rpm; EGR "not available in this model") dan panel Fuel (komposisi gas, H₂S, sulfur solar). Grafik NOx mg/Nm³ pada basis regulasi vs tuas dengan garis limit, dan η rem vs tuas yang sama; chip di tab Limits mengikuti slider. Komposisi gas tidak mengubah NOx dan CO di model ini. Contoh sapuan retard timing (diesel, model):

  | Timing (° ATDC) | NOx (g/kWh) | η rem | CO₂ (g/kWh) |
  |---|---|---|---|
  | −8 | 15,6 | 43% | 615 |
  | −4 | 11,1 | 42% | 628 |
  | 0 | 7,7 | 41% | 647 |
  | +4 | 5,5 | 40% | 671 |

  Dari −4° ke 0°: **NOx −30%, CO₂ +3,1%**. Dari −8° ke +4°: NOx −65%, CO₂ +9,0%. Gas lean-burn, −14° → −6°: NOx 2,46 → 0,73 g/kWh (−71%), CO₂ 497 → 523 (+5,3%). Methane slip tidak termasuk di sini, jadi CO₂e sebenarnya lebih tinggi.
- **Tab 4 · Load window** (`#/scene/9/load-window`): kurva NOx dan CO Scene 6 untuk kedua konfigurasi; garis limit NOx dari file regulasi (atau override presenter, ditandai "limit: user override"); garis CO hanya bila nilai permit/OEM diisi; jendela beban tiap konfigurasi. Kalimat model: single-shaft "cliff" CO setelah IGV habis; twin-shaft jendela operasi bergeser dan menyempit.
- **Tab 5 · GHG** (`#/scene/9/ghg`): CO₂ spesifik vs penalti bahan bakar untuk tiga mesin, dan CO₂e dengan methane slip (garis putus-putus, mesin gas). **Skenario ilustrasi:** penalti 3% = modifikasi penurun NOx yang menambah konsumsi bahan bakar 3% pada daya yang sama (η₂ = η/1,03) → CO₂ spesifik gas engine **497 → 512 g/kWh (+3%)**. Penalti adalah input, bukan hasil model alat penurun NOx tertentu. Methane slip tidak ada di CO₂ biasa; CO₂e memakai GWP 29,8 (IPCC AR6, 100 tahun).
- **Naskah:** "Kita menyelamatkan kualitas udara lokal dengan membayar karbon. Pertanyaannya bukan siapa benar, tapi apakah satu angka cocok untuk dua mesin dengan jendela operasi berbeda."

## S10 · Perangkat pengendali emisi (3 menit) · `#/scene/10`
- *Judul layar:* Emission control devices
- **Pesan kunci:** Setiap pengendali menurunkan satu hal dan membebani hal lain.
- **Isi kartu (teks dari `content/controls.json`, English di layar; bukan hasil model):**
  - DLN / lean premix: menurunkan NOx lewat suhu nyala rendah; jendela sempit, CO naik di part-load.
  - Lean-burn: NOx rendah; risiko misfire dan methane slip pada beban rendah.
  - EGR / water-steam injection: menurunkan suhu puncak; efisiensi dan CO terpengaruh.
  - SCR: memotong NOx setelah pembakaran, memutus trade-off dengan combustor, tapi butuh amonia, ruang, dan suhu exhaust tertentu; menambah backpressure (penalti η kecil, besaran perlu data vendor).
  - Oxidation catalyst: menurunkan CO dan VOC, tidak menurunkan NOx.
  - DPF: untuk partikulat diesel.
- **Naskah:** "Tidak ada pengendali gratis. Yang kita bandingkan adalah apa yang kita korbankan."

## S11 · Penutup (2 menit) · `#/scene/11`
- *Judul layar:* Closing
- **Tiga poin (dari `content/closing.json`):** (1) suhu nyala menentukan NOx secara eksponensial; (2) tiap mesin punya jendela operasi sendiri, dan jendela turbin kompresor bergerak mengikuti proses; (3) baku mutu yang efektif perlu memperhitungkan tipe mesin, rentang beban, dan dampak GHG.
- **Opsi arah diskusi (pilih sesuai audiens, jangan semuanya):**
  1. Baku mutu dibedakan menurut tipe penggerak (generator vs mechanical drive).
  2. Batas dengan rentang beban yang berlaku (bukan hanya base load) dan basis rata-rata waktu.
  3. Evaluasi NOx dan GHG bersama sebagai satu inventaris.
  4. Pemantauan kontinu (CEMS) di unit variabel untuk membangun data.
- **Naskah:** "Usulannya bukan melonggarkan, tapi mengukur dengan cara yang sesuai cara mesin itu bekerja."

---

## Anticipated Q&A

| Pertanyaan | Jawaban singkat |
|---|---|
| "Angka ini data unit kita?" | Bukan. Tren dari fisika; level NOx dikalibrasi ke nilai tipikal literatur. Kami siap menggantinya dengan data CEMS/OEM unit (isian site data di Scene 9 tab Limits diutamakan dan ditandai). |
| "Kenapa tidak pasang SCR saja?" | SCR menyelesaikan NOx tetapi bukan CO, menambah backpressure, amonia, ruang, dan butuh suhu exhaust yang cocok. Pertanyaannya biaya dan kelayakan per unit. |
| "Apakah trade-off NOx–CO selalu berlaku?" | Berlaku untuk pengendalian di dalam combustor (via suhu nyala). Pengolahan gas buang (katalis) memutusnya, dengan biaya dan ruang. |
| "Kenapa diesel NOx tinggi padahal efisien?" | Efisiensi tinggi datang dari rasio kompresi tinggi dan campuran miskin, tetapi pembakaran tidak homogen menciptakan zona stoikiometrik panas. |
| "Kenapa twin-shaft tidak tampil CO meledak di model?" | Model memakai fuel split tetap dan suhu nyala turun gradual. Perilaku nyata tergantung penjadwalan OEM; kami tidak mengklaim "ledakan", hanya pergeseran jendela. |
| "Apakah gas engine melampaui baku mutu?" | Model (indicative): kelas 100–500 dan 500–1000 kW Within dengan margin +2,7%; kelas 1000–3000 kW Above, margin −2,5%. Kedua margin lebih kecil dari ketidakpastian model, jadi jawabannya perlu data CEMS atau uji cerobong. |
| "Methane slip dihitung?" | Sebagai input (0–3%). Tidak diprediksi oleh model pembakaran. |
| "Basis volume dan O₂ pakai apa?" | Chip kepatuhan selalu memakai basis regulasi dari `content/regulations.json`: kedua grup 15 % O₂, kering, 25 °C, NOx sebagai NO₂. Basis tampilan di panel `H` (mis. 0 °C) hanya untuk angka tampilan; basisnya selalu tertulis di samping tiap angka. |

## Data yang perlu dikumpulkan sebelum presentasi

1. Verifikasi tabel baku mutu di `content/regulations.json` terhadap teks resmi (nilai NOx/CO/SO₂/PM per kategori, **O₂ acuan**, **basis volume**, metode uji, rata-rata waktu), lalu setel `verified: true` per grup.
2. Spesifikasi unit contoh: rasio tekanan, TIT atau rating ISO, ketersediaan IGV, konfigurasi DLN (tanpa menyebut vendor di slide).
3. Data CEMS atau uji cerobong per beban untuk minimal satu generator dan satu kompresor (dapat diisi sebagai site data di Scene 9 tab Limits).
4. Distribusi beban historis (histogram % waktu per beban) — generator vs kompresor. Ini bukti paling kuat untuk S6 dan S9.
5. Komposisi gas (fraksi mol, H₂S) dan sulfur solar untuk panel Fuel; suhu ambient site.
6. Data methane slip (bila ada) untuk gas engine.

## Cadangan (backup slide)

- Derivasi η Otto/Diesel; fungsi Wiebe; Zeldovich langkah demi langkah.
- Koreksi O₂ dan konversi satuan. Contoh: 25 ppm NOx @15% O₂ → ≈ **51 mg/Nm³** (basis 0 °C, faktor 2,05 mg/Nm³ per ppm; basis 25 °C faktor 1,88, ≈ 47 mg/Nm³ — basis regulasi).
- Asumsi model dan faktor kalibrasi (panel `H` atau halaman `#/assumptions`); dasar teori tiap fungsi (kartu Basis, halaman `#/references`).

## Angka kunci yang perlu diingat presenter

| Angka | Nilai |
|---|---|
| Otto r=10 / Diesel r=18 | 60,2% / 63,2% |
| Teori → efisiensi rem (piston) | 62–63% → model (indicative) 42,5% diesel / 40,6% gas; tipikal/literatur 42–45% (to be sourced) |
| Brayton ideal → real (r_p 15) | 53,9% → 37,8% |
| Derating ambient | ±0,68% per °C |
| +100 K suhu nyala | NOx ×6–7 |
| Retard 4° (diesel) | NOx −30%, CO₂ +3% |
| Methane slip 1% / 3% | CO₂e +11% / +33% |
| Gas vs diesel CO₂ spesifik | ±21% lebih rendah (497 vs 628 g/kWh) |
| Penalti bahan bakar 3% (skenario ilustrasi) | CO₂ spesifik gas engine 497 → 512 g/kWh |
