# ALUR SLIDE — Presentasi "Efisiensi, Emisi, dan Baku Mutu pada Penggerak Migas"

Nomor scene sama dengan prompt simulasi 3D. Semua angka di bawah berasal dari `thermo.js` (14 tes lulus) dan **bersifat indikatif**: NOx dikalibrasi ke nilai tipikal literatur (diesel ≈ 11 g/kWh, gas lean-burn ≈ 2,5 g/kWh, DLN = 15 ppm @15% O₂ di titik desain), **bukan data unit**. Ganti dengan data CEMS/OEM sebelum presentasi resmi.

## Ringkasan waktu

| Versi | Durasi | Scene |
|---|---|---|
| Penuh | ±53 menit + tanya jawab | 0–11 |
| Ringkas | ±35 menit | 0, 1, 2, 4, 6, 9, 11 (lewati 3, 5, 7, 8, 10; ringkas lewat satu kalimat) |

Alur cerita: **mesinnya apa → energi jadi kerja dan panas → suhu menentukan emisi → pengendalian emisi mengorbankan sesuatu → jendela operasi tiap mesin berbeda → karena itu baku mutu seragam bermasalah.**

---

## S0 · Pembuka (2 menit)
- **Pesan kunci:** Bahan bakar sama, mesin beda, emisi beda. Kenapa?
- **Visual 3D:** empat kartu penggerak berputar pelan.
- **Interaksi:** hover kartu → ringkasan siklus.
- **Naskah:** "Hari ini kita lihat satu hal: apa yang terjadi di dalam mesin sampai muncul angka di laporan emisi, dan kenapa satu angka batas tidak cocok untuk semua mesin."

## S1 · Piston: dari engkol ke diagram P-V (5 menit)
- **Pesan kunci:** Satu putaran engkol = satu loop di diagram P-V; luas loop = kerja.
- **Visual 3D:** silinder cutaway, warna gas = suhu; titik berjalan di P-V.
- **Rumus:** `V(θ) = Vc + (πB²/4)(l + a − s(θ))`, `s = a·cosθ + √(l² − a² sin²θ)`.
- **Interaksi:** ganti diesel/gas, geser `r`, timing.
- **Angka demo:**
  - Diesel (r=16): Pmax ≈ 116 bar pada ±3,5° setelah TDC, η rem ≈ 44%, BSFC ≈ 192 g/kWh.
  - Gas (r=11): Pmax ≈ 109 bar pada ±16° setelah TDC, η rem ≈ 42%, BSFC ≈ 177 g/kWh.
- **Naskah:** "Garis ini bukan gambar. Titik di grafik dan posisi piston dihitung dari sudut engkol yang sama."

## S2 · Siklus ideal vs real (6 menit)
- **Pesan kunci:** Teori 60–67%, lapangan 42–45%. Selisihnya bukan "kesalahan", tapi fisika.
- **Visual 3D + P-V + T-s sinkron;** toggle Ideal ↔ Real; waterfall rugi.
- **Rumus:** `η_Otto = 1 − 1/r^(k−1)`, `η_Diesel = 1 − (1/r^(k−1))·(r_c^k − 1)/(k(r_c − 1))`.
- **Angka demo:**
  - Otto r=10: **60,2%**; Diesel r=18, r_c=2: **63,2%**; Otto r=18: **68,5%**.
  - Pada r yang sama Otto lebih efisien. Diesel unggul karena r jauh lebih tinggi.
  - Waterfall diesel: 67,0 → 62,3 (k turun) → 58,3 (pembakaran butuh waktu) → 50,6 (rugi panas) → 44,9% (friksi).
  - Waterfall gas: 61,7 → 56,6 → 53,9 → 47,1 → 43,1%.
- **Naskah:** "Tiga langkah pertama adalah fisika gas dan waktu pembakaran. Dua terakhir adalah panas yang lari ke dinding dan gesekan."

## S3 · Pembakaran, φ, dan suhu nyala (4 menit)
- **Pesan kunci:** Suhu nyala ditentukan campuran. Diesel punya zona panas lokal; gas lean-burn homogen dan lebih dingin.
- **Visual 3D:** nyala berwarna sesuai φ; grafik suhu nyala adiabatik vs φ.
- **Angka demo:** φ=0,5 → ±1530 K (suhu masuk 300 K); φ=1,0 → ±2226 K. Pada campuran sudah dipanaskan oleh kompresi, suhu bertambah ±0,5–0,8 × kenaikan suhu masuk.
- **Naskah:** "Mesin diesel rata-rata miskin bahan bakar, tapi di dalamnya ada kantong yang hampir stoikiometrik. Kantong itulah yang menghasilkan NOx."

## S4 · NOx: kenapa suhu begitu menentukan (5 menit)
- **Pesan kunci:** NOx tidak naik linier dengan suhu, tapi eksponensial.
- **Visual 3D:** gelembung zona terbakar, partikel NOx; grafik log NOx vs suhu nyala.
- **Rumus:** Zeldovich `d[NO]/dt ≈ 6×10¹⁶/√T · e^(−69.090/T) · [O₂]^½ [N₂]`.
- **Angka demo:**
  - Laju pembentukan NO pada 1900 K ≈ **7,1×** laju pada 1800 K.
  - Dalam jendela DLN (terkalibrasi 15 ppm di 1830 K): 1800 K → 8,5 ppm; 1900 K → 52 ppm (≈ **6×**).
  - Artinya **±100 K = ±6–7× NOx**.
- **Naskah:** "Ini sebabnya turbin dan mesin dioperasikan di jendela suhu yang sempit. Naik 100 derajat, NOx bisa enam kali lipat."

## S5 · Turbin gas: Brayton dari dekat (5 menit)
- **Pesan kunci:** Turbin menghabiskan separuh kerjanya untuk memutar kompresornya sendiri; ambient panas langsung memotong daya.
- **Visual 3D:** kompresor aksial (bilah berwarna suhu), combustor, turbin.
- **Rumus:** `η_ideal = 1 − 1/r_p^((k−1)/k)`; `T₂ = T₁[1 + (r_p^((k−1)/k) − 1)/η_c]`.
- **Angka demo (r_p=15, T3=1500 K, η_c 0,87, η_t 0,90, ΔP combustor 4%):**
  - η ideal **53,9%**; η real **37,8%**; heat rate ≈ 9.530 kJ/kWh.
  - T₂ ≈ 675 K, T exhaust ≈ 843 K; back-work ratio ≈ 52%.
  - Ambient 35 °C: daya **−13,5%** (±0,68% per °C di atas 15 °C).
- **Naskah:** "Di hari panas, turbin yang sama menghasilkan daya lebih kecil, dan titik operasi kompresornya bergeser."

## S6 · Part-load: generator vs kompresor (8 menit) — inti argumen
- **Pesan kunci:** Generator punya titik optimum yang tetap. Turbin kompresor tidak pernah punya titik tetap.
- **Visual:** dua turbin berdampingan (single-shaft kiri, twin-shaft kanan); grafik suhu nyala, NOx, CO, η terhadap beban; pita jendela DLN.
- **Angka demo (NOx terkalibrasi 15 ppm @15% O₂ di desain; kalibrasi tiap konfigurasi terpisah):**

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
  - Single-shaft: suhu nyala ditahan IGV sampai ±70% beban, lalu CO "meledak" (tebing). Tanpa IGV, tebing muncul sejak ±90%.
  - Twin-shaft: tidak ada titik tetap. Suhu nyala bergeser terus (±90 K dari 100% ke 50%), NOx turun ±10×, CO naik ±3×, η turun 40% → 31%.
- **Yang TIDAK didukung model (jangan diucapkan sebagai fakta):** "CO meledak di twin-shaft". Model memakai fuel split premix tetap; penjadwalan fuel split/bleed OEM tidak dimodelkan, jadi perilaku nyata twin-shaft bisa lebih baik atau lebih buruk. Kalimat aman: **"jendela operasinya bergeser terus-menerus dan menyempit, sehingga sulit menjaga NOx dan CO rendah bersamaan; besarnya perlu data OEM/CEMS unit."**
- **Naskah:** "Kalau generator dijaga di base load, ia berada di titik terbaiknya. Turbin kompresor mengikuti tekanan sumur dan pipa, jadi titiknya selalu bergerak."

## S7 · Kompresor gas dan hukum affinitas (4 menit)
- **Pesan kunci:** Turbin kompresor mengikuti proses, bukan sebaliknya.
- **Rumus:** `H_p = (Z·R·T₁/m)·(r_p^m − 1)`, `m = (k−1)/(k·η_p)`; `Q ∝ N`, `H ∝ N²`, `P ∝ N³`.
- **Angka demo (suction 20 bar, discharge 60 bar, T₁ 308 K, MW 18, 20 kg/s):** head ≈ **172 kJ/kg**, daya ≈ **4,3 MW**, T discharge ≈ 412 K. Head turun ke 80% → kecepatan ≈ **89%** dari desain; kecepatan 90% → daya tinggal **73%**.
- **Naskah:** "Tekanan sumur turun sedikit, kecepatan power turbine ikut berubah, dan seluruh kondisi di combustor ikut bergeser."

## S8 · Emisi gabungan: diesel vs gas vs turbin (3 menit)
- **Pesan kunci:** Gas lebih bersih per kWh, tetapi methane slip bisa menghapus sebagian keunggulannya.
- **Angka demo:**
  - CO₂ spesifik: gas η 42% ≈ **478 g/kWh**; diesel η 44% ≈ **605 g/kWh** (≈ 21% lebih rendah).
  - NOx tipikal terkalibrasi: diesel ≈ 11 g/kWh; gas lean-burn ≈ 2,6 g/kWh.
  - Methane slip pada η 40%: slip 1% → CO₂e **561 vs 505 g/kWh (+11%)**; slip 3% → **673 (+33%)**.
- **Naskah:** "Satu persen bahan bakar yang lolos tidak terbakar sudah menambah sepersepuluh jejak karbonnya."

## S9 · Trade-off kebijakan: NOx vs CO vs GHG (6 menit)
- **Pesan kunci:** Menekan satu emisi hampir selalu menggeser yang lain.
- **Panel A, retard timing (diesel):**

  | Timing (° ATDC) | NOx (g/kWh) | η rem | CO₂ (g/kWh) |
  |---|---|---|---|
  | −8 | 15,1 | 45% | 593 |
  | −4 | 10,7 | 44% | 605 |
  | 0 | 7,4 | 43% | 623 |
  | +4 | 5,3 | 41% | 645 |

  Dari −4° ke 0°: **NOx −31%, CO₂ +3,0%**. Dari −8° ke +4°: NOx −65%, CO₂ +8,7%. Gas lean-burn, −14° → −6°: NOx 2,57 → 0,74 g/kWh (−71%), CO₂ 478 → 503 (+5,2%). Methane slip tidak dimodelkan, jadi CO₂e sebenarnya lebih tinggi.
- **Panel B, penalti bahan bakar:** penalti 3% → CO₂ spesifik gas 577 → 594 g/kWh (+3%). CO₂ sebanding langsung dengan bahan bakar.
- **Panel C, baku mutu seragam:** garis batas NOx dan CO digambar di grafik part-load kedua mesin; area pelanggaran CO diarsir. Angka batas diisi presenter (basis O₂ dan basis volume wajib ditampilkan).
- **Naskah:** "Kita menyelamatkan kualitas udara lokal dengan membayar karbon. Pertanyaannya bukan siapa benar, tapi apakah satu angka cocok untuk dua mesin dengan jendela operasi berbeda."

## S10 · Perangkat pengendali emisi (3 menit)
- **Pesan kunci:** Setiap pengendali menurunkan satu hal dan membebani hal lain.
- **Isi kartu (teks dari presenter):**
  - DLN / lean premix: menurunkan NOx lewat suhu nyala rendah; jendela sempit, CO naik di part-load.
  - Lean-burn: NOx rendah; risiko misfire dan methane slip pada beban rendah.
  - EGR / water-steam injection: menurunkan suhu puncak; efisiensi dan CO terpengaruh.
  - SCR: memotong NOx setelah pembakaran, memutus trade-off dengan combustor, tapi butuh amonia, ruang, dan suhu exhaust tertentu; menambah backpressure (penalti η kecil, besaran perlu data vendor).
  - Oxidation catalyst: menurunkan CO dan VOC, tidak menurunkan NOx.
  - DPF: untuk partikulat diesel.
- **Naskah:** "Tidak ada pengendali gratis. Yang kita bandingkan adalah apa yang kita korbankan."

## S11 · Penutup (2 menit)
- **Tiga poin:** (1) suhu nyala menentukan NOx secara eksponensial; (2) tiap mesin punya jendela operasi sendiri, dan jendela turbin kompresor bergerak mengikuti proses; (3) baku mutu yang efektif perlu memperhitungkan tipe mesin, rentang beban, dan dampak GHG.
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
| "Angka ini data unit kita?" | Bukan. Tren dari fisika; level NOx dikalibrasi ke nilai tipikal literatur. Kami siap menggantinya dengan data CEMS/OEM unit. |
| "Kenapa tidak pasang SCR saja?" | SCR menyelesaikan NOx tetapi bukan CO, menambah backpressure, amonia, ruang, dan butuh suhu exhaust yang cocok. Pertanyaannya biaya dan kelayakan per unit. |
| "Apakah trade-off NOx–CO selalu berlaku?" | Berlaku untuk pengendalian di dalam combustor (via suhu nyala). Pengolahan gas buang (katalis) memutusnya, dengan biaya dan ruang. |
| "Kenapa diesel NOx tinggi padahal efisien?" | Efisiensi tinggi datang dari rasio kompresi tinggi dan campuran miskin, tetapi pembakaran tidak homogen menciptakan zona stoikiometrik panas. |
| "Kenapa twin-shaft tidak tampil CO meledak di model?" | Model memakai fuel split tetap dan suhu nyala turun gradual. Perilaku nyata tergantung penjadwalan OEM; kami tidak mengklaim "ledakan", hanya pergeseran jendela. |
| "Methane slip dihitung?" | Sebagai input (0–3%). Tidak diprediksi oleh model pembakaran. |
| "Basis volume dan O₂ pakai apa?" | Bergantung peraturan yang berlaku; ditampilkan di samping tiap angka (Nm³ pada 0 °C atau 25 °C, O₂ acuan 15% untuk turbin). |

## Data yang perlu dikumpulkan sebelum presentasi

1. Peraturan baku mutu yang berlaku: nomor, nilai NOx/CO per kategori, **O₂ acuan**, **basis volume (0 °C / 25 °C)**, rata-rata waktu.
2. Spesifikasi unit contoh: rasio tekanan, TIT atau rating ISO, ketersediaan IGV, konfigurasi DLN (tanpa menyebut vendor di slide).
3. Data CEMS atau uji cerobong per beban untuk minimal satu generator dan satu kompresor.
4. Distribusi beban historis (histogram % waktu per beban) — generator vs kompresor. Ini bukti paling kuat untuk S6 dan S9.
5. Komposisi gas (LHV, MW) dan suhu ambient site.
6. Data methane slip (bila ada) untuk gas engine.

## Cadangan (backup slide)

- Derivasi η Otto/Diesel; fungsi Wiebe; Zeldovich langkah demi langkah.
- Koreksi O₂ dan konversi satuan. Contoh: 25 ppm NOx @15% O₂ → ≈ **51 mg/Nm³** (basis 0 °C, faktor 2,05 mg/Nm³ per ppm; basis 25 °C faktor 1,88).
- Asumsi model dan faktor kalibrasi (panel `H` aplikasi).

## Angka kunci yang perlu diingat presenter

| Angka | Nilai |
|---|---|
| Otto r=10 / Diesel r=18 | 60,2% / 63,2% |
| Teori → lapangan (piston) | ±60–67% → ±42–45% |
| Brayton ideal → real (r_p 15) | 53,9% → 37,8% |
| Derating ambient | ±0,68% per °C |
| +100 K suhu nyala | NOx ×6–7 |
| Retard 4° (diesel) | NOx −31%, CO₂ +3% |
| Methane slip 1% / 3% | CO₂e +11% / +33% |
| Gas vs diesel CO₂ spesifik | ±21% lebih rendah (478 vs 605 g/kWh) |
