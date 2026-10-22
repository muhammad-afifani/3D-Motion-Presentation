# Audit selisih suhu dan suhu mutlak (Pengaturan satuan, tahap U1)

Dasar untuk U2 (HUD, slider, isian, overlay) dan U3 (grafik, tabel). Suhu mutlak memakai offset (`toUnit`); SELISIH dan LAJU per
derajat TIDAK (`toUnitDelta`, `toUnitRate`). Salah memakai offset pada selisih memberi angka seperti −459,67 °F untuk ΔT = 0.
Tes arah (bukan nilai absolut): `tests/units.test.js` ("selisih dan laju suhu"); tes per titik pakai ditambahkan di U2 / U3.

## Selisih dan laju (jalur delta, tanpa offset)

| Tempat | Berkas | Penanganan di U2 / U3 |
|---|---|---|
| Tile HUD "ΔT zona lokal vs φ global" (`dTlocal`) | `src/scenes/combustion.js` (item `dT`), `src/state/deriveFlame.js` | `fqDelta(f.dTlocal, 'temperature')`; satuan label = simbol suhu aktif |
| Overlay campuran diesel "(ΔT +… K)" | `src/scenes/combustion.js` (`O.mixDiesel`), `STR.scene3.overlay.mixDiesel` | `fqDelta`; kalimat menerima teks angka dan simbol |
| Panah ΔT di grafik nyala | `src/charts/flameChart.js` (`S.dT(b.T − a.T)`), `STR.scene3.chart.dT` | selisih dikonversi sebelum diformat |
| Pernyataan "+100 K ≈ ×N" (laju Zeldovich, `noxRateRatio` dengan dT = 100) | `STR.scene4` (judul, pesan kunci, tooltip; 6 tempat) | rasio tetap dihitung untuk 100 K; teks menulis selisih yang SAMA secara fisik (100 K = 180 °F), bukan angka bulat baru |
| Derating "% per °C" (`perDegC`) | `src/scenes/turbine.js` (item `der`, unit `perDegUnit`), `STR.scene5` (pesan, tooltip), `src/state/deriveTurbine.js` | `fqRate(f.perDegC, 'temperature')`; label unit ikut ("%/°F" lebih kecil 1,8×) |
| Rentang beda suhu di kalimat model (kenaikan T, selisih T) | `STR.scene*` | diaudit saat U2; selisih apa pun lewat `fqDelta` |

## Suhu mutlak (dengan offset)

- **Slider dan HUD suhu**: T₁ / T_in, T₃, T_ambient, T_exhaust, T_flame, T_burned, T_dis, T_gas, dst. Nilai di store / frame dalam K, KECUALI
  `gTamb` (ambient turbin) yang disimpan dalam °C. U2: ubah ke K sebelum `toUnit` (`T_K = gTamb + 273.15`) dan sebaliknya saat menulis ke
  store; batas slider juga dikonversi lewat K.
- **Tuas Scene 9 (leverSweep)**: `Tivc` (suhu isap, mutlak, K) dan `Pivc` (boost, mutlak, Pa → `LEVER_AXIS_DISPLAY.Pivc.scale` 1e-5 harus diganti
  fungsi satuan tekanan). Langkah grid SI (10 K, 0,1 bar) tetap; tick sumbu dihitung ulang di satuan tampilan (U3). Tab Levers tidak menulis selisih
  terhadap preset (lencana Preset / Modified tanpa angka), jadi tidak ada jalur delta di sana.
- **Literal suhu di `strings.js` yang menjadi fungsi satuan** (U2 / U3): garis acuan T_in = 300 K (putus-putus) di grafik nyala, 308 K, 1.800 K,
  2.000 K, 2.200 K, 3.000 K (contoh dan rentang), acuan ISO "15 °C" dan "35 °C" (derating), dan label sumbu "[K]". Basis volume "0 °C" /
  "25 °C" (28 tempat) adalah nama basis resmi dan TIDAK berubah dengan satuan suhu.
- **Legenda suhu (`tempToRGB`)**: tetap K sebagai utama (aturan CLAUDE.md); satuan pilihan ditambahkan di sampingnya (U3).

## Besaran lain yang disentuh U2 / U3 (cuplikan untuk perencanaan)

- Tekanan: `toBar` (25 pemakaian), `U.bar`, `LEVER_AXIS_DISPLAY.Pivc`, sumbu P-V / P-θ, slider tekanan hisap / buang (Scene 7).
- Daya: HUD turbin (MW) dan kompresor (MW) → `native: 'MW'`; sumbu "Power [MW]".
- Energi spesifik: HUD head (kJ/kg), q_in; sumbu "Head [kJ/kg]". Entropi / volume spesifik: sumbu T-s dan P-v.
- Panjang / volume: overlay piston (mm, L), sumbu volume silinder.
- Emisi spesifik dan bahan bakar: HUD g/kWh (NOx, CO₂, CO₂e, bsfc), sumbu bar emisi, kolom Scene 8.
- Konsentrasi: tile ppmvd / mg/Nm³ Scene 4 tetap berdampingan (keputusan); sumbu "ppmvd (log)" Scene 6, "NOx [mg/Nm³]" Scene 9 mengikuti pilihan
  (di Scene 9 batas dan garis limit tetap di basis regulasi).
