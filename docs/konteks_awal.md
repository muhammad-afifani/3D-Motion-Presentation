# Konteks Awal — Draft Penjelasan Penggerak dan Argumen Kebijakan

> Sumber: draft penjelasan awal dari pemilik proyek (Ifan). Dokumen ini adalah **konteks dan latar argumen**, bukan spesifikasi teknis.
> - Spesifikasi yang mengikat ada di `docs/PROMPT_simulasi_3D.md`.
> - Angka dan rumus yang berlaku ada di `src/model/thermo.js`.
> - Bila isi dokumen ini berbeda dengan keduanya, **ikuti keduanya**. Perbedaan yang sudah diketahui tercatat di bagian "Catatan koreksi" di bawah.

---

## 1. Piston Engine (Mesin Torak)
### A. Diesel Engine (Bahan Bakar Minyak)

**Siklus Termodinamika:** Siklus Diesel (atau Dual Cycle pada mesin modern).

**P-V & T-S Chart:**

Kompresi udara murni secara isentropik (tekanan & suhu naik drastis).

Penambahan panas (injeksi bahan bakar) pada tekanan konstan (Isobarik).

Ekspansi isentropik (langkah kerja).

Pelepasan panas pada volume konstan (Isokorik).

**Engineering Detail & Efisiensi:** Memiliki rasio kompresi sangat tinggi (15:1 hingga 22:1). Karena rasio kompresi tinggi, efisiensi termalnya sangat baik (bisa mencapai 40-45%). Udara dikompresi hingga sangat panas, lalu solar disemprotkan dan terbakar sendiri (auto-ignition).

**Karakteristik Emisi:** Campuran bahan bakar dan udara di ruang bakar tidak homogen (ada area kaya bahan bakar, ada area miskin).

NOx: Sangat tinggi karena adanya zona suhu puncak lokal yang ekstrem saat pembakaran.

Partikulat (PM/Jelaga): Tinggi, karena butiran minyak yang tidak mendapat cukup oksigen di sekitarnya akan terurai menjadi karbon padat.

### B. Gas Engine (Bahan Bakar Gas Alam)

**Siklus Termodinamika:** Siklus Otto.

**P-V & T-S Chart:**

Kompresi campuran udara-gas secara isentropik.

Penambahan panas (percikan busi) sangat cepat pada volume konstan (Isokorik).

Ekspansi isentropik.

Pelepasan panas isokorik.

**Engineering Detail & Efisiensi:** Gas alam dicampur dengan udara sebelum atau saat masuk silinder, lalu diledakkan oleh spark plug. Rasio kompresi dibatasi (sekitar 9:1 hingga 12:1) untuk menghindari detonasi/ngelitik (knocking). Karena rasio kompresi lebih rendah, efisiensi termalnya sedikit di bawah diesel (sekitar 35-40%).

**Karakteristik Emisi:** Campuran lebih homogen dan gas alam memiliki rasio karbon-hidrogen (C/H) yang rendah.

PM/Jelaga: Hampir nol.

CO2: Lebih rendah dari diesel untuk setiap kW energi yang dihasilkan.

NOx: Tergantung tuning. Mesin Lean-Burn (udara berlebih) bisa menekan NOx sangat rendah, namun jika beban turun, pembakaran bisa tidak stabil dan memicu kenaikan metana yang tidak terbakar (methane slip).

## 2. Turbine Engine (Siklus Brayton)
Semua turbin beroperasi dengan Siklus Brayton. Diagram P-V & T-S nya meliputi: kompresi isentropik, penambahan panas tekanan konstan (di combustor), ekspansi isentropik (di turbin), dan pelepasan panas tekanan konstan (ke atmosfer).

### A. Turbine Engine Generator (Untuk Pembangkit Listrik)

**Konfigurasi Mekanis:** Umumnya Single-Shaft (Poros Tunggal). Kompresor, turbin gas, dan generator listrik berada dalam satu poros kaku.

**Operasional:** Berputar pada kecepatan konstan (misal 3000 RPM untuk sinkronisasi grid 50Hz).

**Efisiensi & Emisi:** Didesain untuk beroperasi pada beban stabil (Base Load 100%). Pada kondisi ini, efisiensi termal maksimal dan sistem Dry Low NOx (DLN) bekerja sempurna menekan NOx. Jika beban listrik turun, aliran bahan bakar dikurangi, suhu ruang bakar turun drastis, sehingga emisi CO tiba-tiba akan melonjak (CO spike).

### B. Turbine Engine Compressor (Mechanical Drive untuk Gas Alam)

**Konfigurasi Mekanis:** Umumnya Twin-Shaft (Poros Ganda). Terdiri dari Gas Generator (kompresor udara + turbin tekanan tinggi) dan Free Power Turbine (turbin tekanan rendah yang terhubung langsung ke kompresor gas alam/beban).

**Operasional:** Memerlukan fleksibilitas tinggi. Kecepatan putaran Free Power Turbine akan terus berubah-ubah secara dinamis menyesuaikan tekanan sumur (suction) dan tekanan pipa (discharge).

**Efisiensi & Emisi:** Karena sering beroperasi pada kecepatan variabel dan sering kali di part-load (beban sebagian) menyesuaikan dinamika produksi gas, turbin ini sulit mempertahankan suhu ruang bakar konstan. Akibatnya, teknologi penurunan emisi (seperti DLN) sering tidak bekerja optimal di luar desain poinnya. Hal ini menyebabkan fluktuasi emisi NOx dan CO yang sulit ditekan secara bersamaan.

## Argumen Kebijakan: Pengetatan Baku Mutu Emisi (Trade-off Termodinamika)
Dalam konteks operasional fasilitas migas, pengetatan baku mutu emisi (stringent emission limits misal untuk PermenLHK) sering kali berbenturan dengan hukum termodinamika dan operasional lapangan:

NOx vs CO Trade-off: Menurunkan suhu pembakaran (dengan menunda timing atau lean burn) untuk menekan baku mutu NOx akan membuat pembakaran tidak sempurna, yang meroketkan emisi CO dan unburned hydrocarbon (VOCs).

GHG Penalty: Modifikasi mesin untuk memenuhi baku mutu NOx lokal sering kali menurunkan fuel efficiency. Mesin menjadi lebih boros bahan bakar. Akibatnya, inventarisasi Gas Rumah Kaca (GRK/CO2) absolut secara fasilitas justru meningkat drastis. Menyelamatkan kualitas udara lokal, namun mengorbankan target emisi karbon global (EVEREST/KPI dekarbonisasi).

Realitas Operasional: Turbin kompresor tidak bisa dipaksa berlari konstan di base-load seperti pembangkit listrik. Menuntut baku mutu emisi yang sama untuk turbin generator dan turbin kompresor adalah cacat secara mechanical engineering.

---

## Catatan koreksi dan batas klaim (dari verifikasi dengan `thermo.js`)

| Pernyataan di draft | Status | Dipakai di aplikasi sebagai |
|---|---|---|
| Efisiensi diesel 40–45% | Sesuai sebagai rentang tipikal/literatur (**to be sourced**). Model (indicative): η rem 42,5% (setelah M10) | Tidak ditampilkan sebagai rentang; layar hanya menampilkan η rem model |
| Efisiensi gas engine 35–40% | Mungkin konservatif: gas lean-burn besar modern disebut bisa 42–45% (tipikal/literatur, **to be sourced**). Model (indicative): η rem 40,6% (setelah M10) | Tidak ditampilkan sebagai rentang; layar hanya menampilkan η rem model |
| Rasio kompresi gas 9–12:1 | Sesuai | r = 11 pada preset |
| "Efisiensi gas sedikit di bawah diesel" | Sesuai sebagai pengamatan tipikal (**to be sourced**); model (indicative) juga: η rem gas 40,6% vs diesel 42,5%. Pada rasio kompresi yang sama Otto ideal justru lebih efisien (r=18: 68,5% vs Diesel 63,2%); diesel unggul karena r jauh lebih tinggi | Satu slide khusus (Scene 2) |
| NOx diesel "sangat tinggi" karena zona suhu lokal | Sesuai; dimodelkan lewat `phiLocal` | Scene 3–4 |
| CO₂ gas lebih rendah dari diesel per kW | Sesuai (model: 497 vs 628 g/kWh, ≈ 21% lebih rendah), tetapi methane slip dapat mengurangi keunggulan ini (slip 1% → +11% CO₂e; 3% → +33%) | Scene 8 |
| Turbin generator: beban turun → suhu ruang bakar turun → CO melonjak | Didukung model untuk single-shaft: suhu nyala ditahan IGV sampai ±70% beban, setelah itu CO naik tajam (12 → 158 ppm di 60%) | Scene 6 |
| Turbin kompresor: DLN tidak optimal di luar titik desain, NOx dan CO sulit ditekan bersamaan | Didukung secara **kualitatif**: jendela operasi bergeser terus-menerus (suhu nyala turun ±90 K dari 100% ke 50% beban, η 40% → 31%). Model **tidak** menunjukkan lonjakan CO seperti single-shaft | Scene 6, dengan kalimat "jendela bergeser dan menyempit" |
| "Inventarisasi GRK absolut meningkat drastis" | Arahnya benar (CO₂ sebanding dengan bahan bakar), besarnya sedang. Retard 4° pada diesel: NOx −30%, CO₂ +3%. Kata "drastis" tidak didukung angka model | Scene 9, dengan angka |
| "Cacat secara mechanical engineering" menuntut baku mutu sama | Argumen kebijakan, bukan hasil model. Dalam presentasi dirumuskan sebagai "satu angka, dua mesin dengan jendela operasi berbeda" | Scene 9 tab Load window (dulu panel C) |
| Turbin generator di base load: "DLN bekerja sempurna menekan NOx" | Tidak didukung sebagai "sempurna". Model: NOx DLN dikalibrasi ke 15 ppm @15% O₂ di titik desain (target literatur, bukan bukti kinerja); di luar jendela suhu nyala NOx dan CO bergeser | Scene 6, sebagai "jendela operasi" |
| "Menurunkan suhu pembakaran … meroketkan emisi CO dan unburned hydrocarbon (VOC)" | Sebagian. Di combustor DLN, CO naik bila suhu nyala terlalu rendah (tebing pada single-shaft setelah IGV habis). Untuk mesin, model tidak menghitung CO dari retard timing; UHC tidak dimodelkan (lihat matriks cakupan Scene 9). Kata "meroket" tidak didukung angka model | Scene 6 (turbin); Scene 9 tab Limits (cakupan model) |

Daftar lengkap klaim yang tidak lagi didukung model, beserta kalimat pengganti: `docs/AUDIT_KLAIM.md`.

Hal yang **tidak** ada di draft dan perlu data dari pemilik proyek: verifikasi tabel baku mutu di `content/regulations.json` terhadap teks resmi (nilai dan nomornya sudah ditranskripsi, `verified: false`), data CEMS/uji cerobong per beban, distribusi beban historis generator vs kompresor, dan data methane slip. Lihat daftar lengkap di `docs/ALUR_SLIDE_presentasi.md` bagian "Data yang perlu dikumpulkan".
