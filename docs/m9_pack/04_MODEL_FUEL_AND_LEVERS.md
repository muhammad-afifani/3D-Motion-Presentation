# Step 04 — Fuel composition, SO₂, exhaust O₂, and engine levers in `thermo.js`

Model: Opus 5.5 high. Ini satu-satunya step yang mengubah model termodinamika.
Prasyarat: Step 03 selesai.
Aturan sesi: rencana singkat dulu (termasuk hasil inventaris di Tugas 1), tunggu persetujuan, kerjakan, tes, build, lapor 5 baris, berhenti.

## Aturan model (jangan dilanggar)

- Hanya tambah fungsi baru ke `thermo.js` dengan tes golden. Tidak mengubah rumus yang sudah ada. Bila terpaksa, sebutkan alasannya dan perbarui golden lama dengan penjelasan.
- Semua golden lama harus tetap hijau tanpa perubahan angka (`selfTest` tetap `failed: 0`).
- Korelasi emisi berlabel "indicative". Tidak ada klaim "CO meledak di twin-shaft". Part-load tetap memakai fuel split premix tetap.
- Yang tidak dimodelkan tetap kualitatif atau input data lapangan. **Jangan mengarang korelasi CO, UHC, atau PM untuk mesin.**

## Tugas 1 — Inventaris `cylinderSim`

Sebelum menulis kode, laporkan di rencana: tuas mana yang sudah didukung `cylinderSim` dan `derive`: lambda (AFR), rpm, load, timing (injeksi atau busi), intake T, boost, EGR, rasio kompresi. Untuk tuas yang belum ada, usulkan penambahan dengan **default yang menghasilkan hasil identik dengan sekarang**. Tuas yang tidak bisa ditambahkan tanpa mengubah golden → tandai "not available" di UI, jangan dipaksakan.

## Tugas 2 — Fungsi bahan bakar

Tambah, dengan JSDoc, tes golden, dan entri `basis.js` (level `Semi-empirical` untuk yang butuh data, `Ideal` untuk neraca massa):

1. `fuelGasProps(composition)`
   - Input: fraksi mol `{ CH4, C2H6, C3H8, C4H10, N2, CO2, H2S_ppmv, H2 }`. Normalisasi otomatis. Tolak komposisi negatif atau total nol.
   - Output: `MW`, `LHV_MJ_per_kg`, `AFR_stoich_mass`, `CO2_kg_per_kg_fuel`, `CO2_kg_per_GJ_LHV`, `dryFlueV0_Nm3_per_kg` (pada 0 °C dan 25 °C), `airMolPerMolFuel`, `dryFlueMolPerMolFuel`.
   - Dasar: neraca atom C, H, O untuk pembakaran stoikiometri. Data entalpi dan massa molar dari NIST Webbook atau ISO 6976 (ambil nilai dari sumber, catat tabel/versinya di JSDoc). Jangan memakai nilai dari ingatan tanpa sumber.
2. `so2FromFuelSulfur({ fuel: 'oil'|'gas', sulfur, ... }, o2RefPct, TrefC)`
   - Neraca massa: SO₂ = (64,06/32,06) × massa S. Untuk gas, S dari H₂S ppmv. Untuk solar, dari % berat.
   - Output mg/Nm³ kering pada O₂ referensi dan suhu referensi.
   - Berlabel "mass balance"; mengasumsikan semua S menjadi SO₂ (tanpa SO₃ dan sulfat).
3. `exhaustO2FromLambda(lambda, composition)`
   - x_O2,kering = 0,2095·(λ−1)·n_air / (n_dry,st + (λ−1)·n_air), dengan n_air dan n_dry,st dari `fuelGasProps`.
   - Tujuan: menyambungkan lambda mesin (yang disetel) ke O₂ buang (yang dipakai koreksi baku mutu).

Hubungkan ke `derive()` agar Scene 9 bisa memakainya. UI tidak boleh menghitung sendiri.

## Golden test (hitung tangan, toleransi 0,5 %, dari skrip independen)

Nilai di bawah dihitung dari data molar yang ada di skrip; **ambil ulang nilai LHV molar dari tabel NIST/ISO 6976 dan bandingkan.** Bila selisih > 0,5 % laporkan, jangan diam-diam menyesuaikan.

| Kasus | Hasil |
|---|---|
| CH₄ murni | MW 16,043; LHV sekitar 50,0 MJ/kg; AFR stoikiometri 17,19 kg/kg; CO₂ 2,743 kg/kg; sekitar 54,9 kg CO₂/GJ; V₀ kering 11,90 Nm³/kg (0 °C), 12,99 (25 °C); n_air 9,52 mol; n_dry 8,52 mol |
| Gas A: CH₄ 90, C₂H₆ 5, C₃H₈ 2, N₂ 1, CO₂ 2 (% mol) | MW 17,98; LHV sekitar 46,4 MJ/kg; AFR 15,91; CO₂ 2,643 kg/kg; sekitar 57,0 kg CO₂/GJ; V₀ kering 11,08 Nm³/kg (0 °C) |
| C₃H₈ murni | MW 44,097; CO₂ 2,994 kg/kg; AFR 15,63 |
| Solar, C 86,5 %, H 13 %, S 0,5 % berat, ref 15 % O₂, 25 °C kering | SO₂ sekitar 251 mg/Nm³; V₀ kering sekitar 11,37 Nm³/kg |
| Solar S 0,05 % / 0,10 % | sekitar 25 / 50 mg/Nm³ (15 % O₂, 25 °C) |
| S solar yang menghasilkan 160 / 120 mg/Nm³ pada ref | sekitar 0,32 / 0,24 % berat |
| λ untuk CH₄ murni | λ=1,5 → O₂ kering 7,51 %; λ=1,8 → 9,89 %; λ=2,0 → 11,06 % |

Tambahan: tes properti. Menambah C₂H₆ pada CH₄ menaikkan CO₂ per GJ. Menambah N₂ dan CO₂ inert menurunkan LHV per kg.

## Tugas 3 — Tuas dan tes arah (bukan nilai absolut)

Untuk tuas yang tersedia, tambah **tes arah** pada `cylinderSim`/`derive` (bukan golden nilai):

- Diesel: retard timing → NOx turun, efisiensi turun. Intake T turun → NOx turun. EGR naik → NOx turun (bila tersedia).
- Mesin gas: lambda naik → NOx turun (sisi lean dari puncak). Spark retard → NOx turun, efisiensi turun. Intake T turun → NOx turun.
- Turbin DLN: flame T turun → NOx turun, `coDLN` naik.

Bila tes arah menemukan model berperilaku berlawanan dengan literatur (Heywood), **laporkan**, jangan "disetel" supaya lulus.

## Matriks cakupan model (yang harus tampil di UI Step 05)

| Parameter | Diesel | Gas engine | Turbin DLN |
|---|---|---|---|
| NOx | dihitung (terkalibrasi) | dihitung (terkalibrasi) | dihitung (terkalibrasi) |
| CO | kualitatif + site input | kualitatif + site input | semi-empiris (`coDLN`) |
| PM / opacity | kualitatif + site input | n/a | kualitatif + site input (oil) |
| SO₂ | neraca massa | neraca massa | neraca massa |
| CO₂ | neraca karbon | neraca karbon | neraca karbon |
| UHC / metana slip | n/a | CO₂e saja (`co2eWithSlip`) | kualitatif |

## Kriteria selesai

- Golden baru hijau, golden lama tidak berubah, `selfTest` failed: 0 (jumlah tes naik, laporkan angkanya).
- Setiap fungsi baru punya entri `basis.js` dengan sumber dari `references.json`.
- `npm test`, `npm run build` hijau. Laporan 5 baris, sebut tuas yang "not available" dan temuan arah yang menyimpang, lalu berhenti.
