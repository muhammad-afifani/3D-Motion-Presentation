# Inventaris string — Step 02 (commit 1)

Sumber: `src/ui/strings.js` (869 → 870 baris), `content/controls.json`, `content/closing.json`.
`content/presenter.json` sengaja tetap Indonesia (catatan presenter).

## Ringkasan perubahan

| Kategori | Perlakuan |
|---|---|
| Kalimat penjelasan, pesan kunci, judul scene, tooltip, caption, toast (± 287 baris Indonesia) | Diterjemahkan ke English teknik, gaya A+B |
| Format angka/tanggal (`src/ui/format.js`) | `id-ID` → `en-US` (titik desimal, koma ribuan) |
| `lang` HTML | `index.html`, `presenter.html` → `en`; blok catatan presenter diberi `lang="id"` |
| Teks developer di layar (nama fungsi, `Sumber: fn()`, nama file, nama konstanta) — 65 baris di luar panel H | Diganti keterangan biasa; informasinya tetap ada (bukan dihapus). Nama fungsi hanya di kartu Basis (commit 3) dan panel H |
| `content/controls.json`, `content/closing.json` | Diterjemahkan; `id`, `relatedScenes`, `appliesTo` tidak berubah |
| `content/presenter.json` | Tidak diubah |

## Kasus teks developer yang diganti (contoh; semua dijaga `tests/language.test.js`)

- Scene 2 caption waterfall: `lossWaterfall(…, {window: 'preset'}): IVC/EVO preset, langkah terakhir = η rem cylinderSim`
  → `Efficiency lost between the ideal limit and brake efficiency, at preset valve timing (IVC to EVO)`.
- Scene 1 HUD (pmax, θ at Pmax, IMEP, indicated η, brake η, BSFC): `Sumber: cylinderSim().…` → keterangan biasa, penjelasan tetap.
- Scene 2 HUD: `Sumber: braytonReal().…` / `cylinderSim().…` → keterangan biasa.
- Scene 4 HUD/kalibrasi: `cylinderSim → NOx_gkWh`, `ENGINE_NOX_CALIB`, `calibrateDLN` → keterangan biasa ("engine calibration factor" dst).
- Scene 5/6/7 sublabel model (`braytonDerated`, `twinShaft`, `loadSweep`, `coDLN`, `gasCompressor`, `compressorTrain`, `twinShaftForLoad`) → label biasa (`Generator model`, `compressor model`, `Scene 6 model`, …).
- Scene 8/9 tooltip (`co2Specific`, `co2eWithSlip`, `retardSweep`, `ghgPenalty`) → keterangan biasa.
- Sumber konten (`Sumber: content/controls.json`) → `Source: content/controls.json` tetap menyebut file karena itu informasi bagi presenter, bukan nama fungsi (dikecualikan eksplisit di tes).

## Tidak diubah (dilaporkan)

- `thermo.js`: nama proses, label waterfall, dan pesan galat masih Indonesia (sumber perhitungan; tidak disentuh di commit ini).
- Konstanta koreksi O₂ model 20,9 vs regulasi 21: teks tampil tetap `20.9`, nilai tidak diubah (Step 03).
- Kalimat kejujuran model dipertahankan maknanya dan dikunci tes: twin-shaft jendela operasi bergeser dan menyempit (tanpa "CO meledak"), single-shaft tebing CO setelah IGV habis, label "indicative", basis O₂/volume di samping angka.
