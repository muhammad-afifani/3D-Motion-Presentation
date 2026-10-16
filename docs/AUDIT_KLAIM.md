# Audit klaim di docs/ (setelah M9 dan M10)

Daftar klaim di `docs/` dan `content/presenter.json` yang tidak lagi didukung model atau tidak lagi cocok dengan aplikasi, beserta kalimat pengganti. Patokan: angka dari tes golden (`npm test`) atau frame aplikasi; limit hanya dari `content/regulations.json`; klaim lapangan/literatur dipisahkan dari angka model.

- Nomor baris mengacu ke versi **sebelum audit** (commit `04a461a`, setelah merge M10).
- **Status "diperbaiki"** = sudah diubah di PR audit ini.
- **Status "ubah sendiri"** = ada di `content/presenter.json`. File itu tidak diubah; usulan kalimatnya ada di bagian akhir.
- Aturan kata: "lapangan" hanya untuk data unit. Klaim tipikal/literatur yang belum punya sumber di `content/references.json` diberi penanda **(to be sourced)**. Angka model diberi label "model (indicative)".

## A. Klaim yang tidak didukung model

| # | Lokasi (sebelum audit) | Klaim | Kenapa tidak didukung | Kalimat pengganti | Status |
|---|---|---|---|---|---|
| 1 | ALUR:72; **presenter S6 keyMessage** | "Turbin kompresor tidak pernah punya titik tetap." | Mutlak. Model hanya menunjukkan suhu nyala yang bergeser gradual (±90 K dari 100% ke 50%) dan jendela operasi yang menyempit. | "Pada turbin kompresor, titik operasi bergeser mengikuti beban dan jendela operasinya menyempit." | ALUR diperbaiki; presenter: ubah sendiri |
| 2 | ALUR:88 | Single-shaft: CO "meledak" (tebing). | Model menunjukkan kenaikan tajam setelah IGV habis (11,6 → 158 ppm di 60%), dan UI menyebutnya "cliff". "Meledak" juga kata yang dilarang untuk twin-shaft, jadi rawan tertukar. | "CO naik tajam (tebing / cliff) setelah IGV habis." | diperbaiki |
| 3 | ALUR:122 | "Penalti 3% → CO₂ spesifik gas 577 → 594 g/kWh." | Itu golden `ghgPenalty` pada η 35% (generik), bukan mesin yang tampil di tab GHG. Arti "penalti" juga tidak ditulis. | "Skenario ilustrasi: penalti 3% = modifikasi penurun NOx yang menambah konsumsi bahan bakar 3% pada daya yang sama (η₂ = η/1,03) → CO₂ spesifik gas engine 497 → 512 g/kWh (+3%). Penalti adalah input, bukan hasil model alat tertentu." | diperbaiki |
| 4 | ALUR:34, ALUR:180; PROMPT:100 | "Teori 62–63%, lapangan 42–45%" / "42–45% di lapangan" / "Teori → lapangan … ±40–43%". | "42–45%" tidak berasal dari data unit, jadi bukan angka "lapangan"; angka model berbeda (42,5% / 40,6%). | "Efisiensi rem tipikal mesin besar 42–45% (tipikal/literatur, **to be sourced**). Model (indicative): 42,5% diesel / 40,6% gas." | diperbaiki |
| 5 | ALUR:123; PROMPT:139 | "Angka batas diisi presenter." | Sejak M9 Step 03 limit dibaca dari `content/regulations.json`. Isian presenter hanya override NOx (ditandai "limit: user override") dan nilai permit/OEM untuk CO turbin. | "Limit NOx dari `content/regulations.json`; override presenter opsional dan ditandai; garis CO turbin hanya dari isian permit/OEM (tabel turbin tidak punya limit CO)." | diperbaiki |
| 6 | ALUR:158 | "O₂ acuan 15% untuk turbin." | Basis regulasi kedua grup (turbin dan mesin) di `content/regulations.json` adalah 15% O₂, kering, 25 °C, NOx sebagai NO₂. | "Chip kepatuhan selalu memakai basis regulasi: kedua grup 15% O₂, kering, 25 °C, NOx sebagai NO₂; basis tampilan panel H hanya untuk angka tampilan." | diperbaiki |
| 7 | konteks_awal:66 (draft) | "DLN bekerja sempurna menekan NOx" di base load. | NOx DLN di model dikalibrasi ke 15 ppm @15% O₂ di titik desain (target literatur), jadi bukan bukti "sempurna"; di luar jendela suhu nyala NOx dan CO bergeser. | "Di titik desain, DLN bekerja di jendela suhu nyalanya; di luar jendela itu NOx dan CO bergeser." | baris baru di tabel koreksi; teks draft tidak diubah |
| 8 | konteks_awal:79 (draft) | Menurunkan suhu pembakaran "meroketkan emisi CO dan unburned hydrocarbon". | Hanya sebagian. Di combustor DLN, CO naik bila suhu nyala terlalu rendah. CO mesin dari retard timing tidak dihitung, dan UHC tidak dimodelkan (matriks cakupan Scene 9). | "Menurunkan suhu nyala menekan NOx; di combustor DLN, CO naik bila suhu nyala terlalu rendah (tebing pada single-shaft). CO dan UHC mesin tidak dihitung model." | baris baru di tabel koreksi; teks draft tidak diubah |
| 9 | konteks_awal:91–92 (tabel koreksi) | "model: η rem 44%" dan "(model: 42%)"; "Dipakai sebagai: rentang tipikal / tipikal 38–45%". | Angka model sebelum M10. Rentang 38–45% / 40–45% juga tidak tampil di aplikasi. | "Model (indicative): η rem 42,5% (diesel) / 40,6% (gas); rentang tipikal/literatur ditandai **to be sourced**; layar hanya menampilkan η rem model." | diperbaiki |
| 10 | konteks_awal:94 (tabel koreksi) | "Benar di lapangan." | Tidak ada data unit di balik pernyataan ini. | "Sesuai sebagai pengamatan tipikal (**to be sourced**); model (indicative) juga: η rem gas 40,6% vs diesel 42,5%." | diperbaiki |
| 11 | **presenter S2 keyMessage** | "Efisiensi teoretis jauh di atas efisiensi **lapangan**." | Aplikasi menampilkan efisiensi rem model, bukan data unit. | lihat bagian D | ubah sendiri |

## B. Klaim yang tidak lagi cocok dengan aplikasi (struktur, bahasa, angka)

| # | Lokasi (sebelum audit) | Isi lama | Keadaan sekarang | Status |
|---|---|---|---|---|
| 12 | ALUR:3 | "14 tes lulus" | `selfTest` 19 tes + suite golden `npm test` | diperbaiki |
| 13 | ALUR:16 | S0 sebagai scene | Tidak ada scene pembuka; catatannya di presenter Scene 1 ("Pembuka") | diperbaiki |
| 14 | ALUR:112–123; PROMPT:135–139 | Scene 9 panel A / B / C, judul "Trade-off kebijakan" | Scene 9 lima tab: Limits, Formation, Levers, Load window, GHG; judul layar "Regulated emissions: how they form and what controls them" | diperbaiki |
| 15 | PROMPT:21, 229 | Pesan kunci dan tooltip berbahasa Indonesia | Seluruh teks layar English; Indonesia hanya catatan presenter dan nama resmi regulasi | diperbaiki |
| 16 | PROMPT:43 | Struktur folder `intro.js` dan lainnya | Struktur nyata (11 modul scene, `state/route.js`, `mode.js`, halaman penuh, `content/*.json`) | diperbaiki |
| 17 | konteks_awal:100 | "Scene 9 panel C" | Scene 9 tab Load window | diperbaiki |
| 18 | **presenter S9 keyMessage / notes** | Hanya menggambarkan trade-off (panel lama) | Scene 9 kini dimulai dari Limits dan Formation | ubah sendiri (opsional; maknanya masih didukung) |

## C. Klaim yang dicari tetapi tidak ditemukan di docs/

| Klaim | Hasil |
|---|---|
| "Gas engine di atas limit di semua kelas" | Tidak ada di `docs/` maupun `presenter.json`. Hanya pernah ada sebagai nama tes, dan sudah diperbaiki di M10. Hasil model sekarang (indicative): kelas 100–500 dan 500–1000 kW Within (margin +2,7%), kelas 1000–3000 kW Above (margin −2,5%); keduanya "margin is smaller than model uncertainty". |
| "CO meledak di twin-shaft" | Hanya muncul di ALUR S6 dan Q&A sebagai contoh kalimat yang **tidak** didukung model (pemakaian benar). Tidak ada di `presenter.json`. |

## D. content/presenter.json — baris yang perlu Anda ubah sendiri

File ini tidak diubah oleh audit. Usulan kalimat (Indonesia, naskah lisan):

| Scene | Bidang | Teks sekarang | Usulan pengganti |
|---|---|---|---|
| 2 | `keyMessage` | "Efisiensi teoretis jauh di atas efisiensi lapangan. Selisihnya bukan kesalahan, tetapi fisika." | "Efisiensi teoretis jauh di atas efisiensi rem yang dihitung model. Selisihnya bukan kesalahan, tetapi fisika." |
| 6 | `keyMessage` | "Generator punya titik optimum yang tetap. Turbin kompresor tidak pernah punya titik tetap." | "Generator punya titik optimum yang tetap. Pada turbin kompresor, titik operasi bergeser mengikuti beban dan jendela operasinya menyempit." |
| 9 | `keyMessage` | "Menekan satu emisi hampir selalu menggeser yang lain." | "Limit bergantung pada jenis mesin, kelas kapasitas, dan bahan bakar. Menekan satu emisi hampir selalu menggeser yang lain." |
| 9 | `notes[0]` | "Kita menyelamatkan kualitas udara lokal dengan membayar karbon. Pertanyaannya bukan siapa benar, tetapi apakah satu angka cocok untuk dua mesin dengan jendela operasi berbeda." | Pertahankan (masih didukung tab Levers, GHG, dan Load window). |
| 9 | `notes` (tambahan) | — | "Mulai dari tab Limits: limit berasal dari tabel regulasi; chip adalah nilai model terhadap limit (indikatif), bukan hasil uji. Bila margin di bawah 10 %, katakan bahwa selisihnya lebih kecil dari ketidakpastian model." |
| 9 | `notes` (tambahan) | — | "Di tab Levers, retard timing menurunkan NOx tetapi menaikkan CO₂. Komposisi gas tidak mengubah NOx dan CO di model ini." |
| 9 | `notes` (tambahan) | — | "Di tab GHG, penalti bahan bakar 3 % adalah skenario ilustrasi: konsumsi bahan bakar naik 3 % pada daya yang sama. Ini bukan hasil alat penurun NOx tertentu." |

Catatan: catatan presenter di Scene 4 dan Scene 8 sudah meminta presenter menyebut angka hanya dari HUD/grafik. Tambahan di atas mengikuti aturan yang sama (tanpa angka baru).
