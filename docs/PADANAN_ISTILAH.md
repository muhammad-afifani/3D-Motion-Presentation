# Padanan istilah: Indonesia (naskah dan docs) → English (layar)

Tabel ini memetakan istilah Indonesia yang dipakai di catatan presenter (`content/presenter.json`) dan di `docs/` ke label English yang benar-benar tampil di aplikasi. Label diambil apa adanya dari `src/ui/strings.js` atau `content/*.json`; kolom **Sumber** menunjuk kunci tempat label itu pertama ditemukan (`STR.…` = `src/ui/strings.js`). Fungsi teks (`…()`) berarti label muncul di dalam kalimat yang dibentuk dari frame.

- Istilah tanpa padanan ditandai **Tidak ada padanan di UI** (konsep naskah yang tidak punya label di layar). Jangan menuliskannya seolah-olah ada di layar.
- Singkatan English (TDC, IGV, DLN, CEMS, PM, …) dipakai sama di naskah dan di layar; definisinya ada di halaman Glossary (`#/glossary`, `content/glossary.json`).
- Penjaga: `tests/padanan.test.js` gagal bila label English di kolom 4 tidak ada lagi di `strings.js` / `content/`, atau bila istilah Indonesia tidak ditemukan di tempat yang disebut kolom 3. Ubah tabel ini setiap kali label UI atau naskah diganti.
- "presenter S6" = `content/presenter.json` scene 6; "ALUR S6" = `docs/ALUR_SLIDE_presentasi.md` bagian S6; "PROMPT §8" = `docs/PROMPT_simulasi_3D.md` bagian 8.

Jumlah: 75 istilah, 6 tanpa padanan di UI.

## Tetap Inggris (Paket D)

Sejak Paket D, UI punya sisi Indonesia (sakelar EN/ID; `src/state/i18n.js`). Istilah di bawah ini **sengaja sama** di kedua bahasa. Sumber datanya satu berkas, `docs/tetap_inggris.json` (alasan tiap kelompok, penanda terhadap tabel ini); bagian ini dibuat darinya oleh `node scripts/gen-tetap-inggris.mjs` dan dijaga `tests/i18n.test.js`. Pasangan `{ en, id }` yang sisi `id`-nya sama persis dengan `en` hanya lolos bila teksnya ada di berkas itu; selebihnya dianggap terjemahan yang tertinggal. Perubahan setelah daftar dikunci berarti koreksi sisi ID, bukan perubahan struktur.

<!-- tetap-inggris:mulai (dibuat oleh scripts/gen-tetap-inggris.mjs dari docs/tetap_inggris.json; jangan diedit tangan) -->

### Satuan dan simbol satuan

- Alasan: Satuan SI dan simbol teknis ditulis sama di semua bahasa. Angka di sampingnya yang mengikuti bahasa (1.500,5 / 1,500.5).
- Terhadap tabel PADANAN di bawah: tidak diatur tabel ini
- Teks utuh (sisi id sengaja sama dengan en): `bar`, `K`, `%`, `mm`, `L`, `g/kWh`, `kJ/kg`, `kJ/kWh`, `MW`, `°C`, `mg/Nm³`, `ms`, `ATDC`, `rpm visual`, `ppm`, `% O₂`, `–`, `ppmvd`, `100-500 kW`, `500-1000 kW`, `η [%]`, `P [bar]`, `%/°C`, `kg/kmol`, `kg/s`, `m³/s`, `ppmvd (log)`
- Dipakai di dalam kalimat (hanya dicatat): `kW`, `rpm`

### Singkatan, rumus kimia, dan simbol

- Alasan: Singkatan baku industri dan rumus kimia dipakai sama di naskah dan di layar; definisinya ada di Glossary. Simbol Yunani dan ƒ tidak diterjemahkan.
- Terhadap tabel PADANAN di bawah: sesuai. Baris tabel: singkatan English (TDC, IGV, DLN, CEMS, PM, …) dipakai sama di naskah dan di layar.
- Teks utuh (sisi id sengaja sama dengan en): `NOx`, `CO`, `CO₂`, `CH₄`, `PM`, `ƒ`, `CO₂e`, `SO₂`, `CEMS`, `DLN`, `IGV`, `GWP`, `UHC`, `LHV`, `TDC`, `ATDC / BTDC`, `EGR`, `BSFC`, `Pmax`, `AFR`, `λ (lambda)`, `φ (phi)`, `BDC`, `MEP`, `IVC`, `EVO`, `SOC θ₀`, `η`, `N_GG`, `CO₂ & CO₂e (g/kWh)`, `Slip → CO₂e`, `GWP CH₄`
- Dipakai di dalam kalimat (hanya dicatat): `BDC`, `IVC`, `SCR`, `AR6`, `NO`, `NO₂`, `η`, `φ`, `λ`, `θ`, `P-V`, `T-s`

### Nama tombol keyboard

- Alasan: Huruf pada tombol keyboard sama di semua bahasa. Tombol Space ditulis Spasi di ID (bukan entri daftar ini).
- Terhadap tabel PADANAN di bawah: tidak diatur tabel ini
- Teks utuh (sisi id sengaja sama dengan en): `S`, `P`, `G`, `?`, `H`, `M`, `M: Explore`, `C`

### Nama halaman, mode, dan produk

- Alasan: Nama halaman dan mode sudah menjadi nama produk (Learn, Chart guide, Glossary, References, About, Start, Explore, Presenter, Basis, Assumptions) dan dipakai sama di ID, supaya tombol, tautan, dan naskah presenter menyebut hal yang sama. Nama aplikasi tidak diterjemahkan.
- Terhadap tabel PADANAN di bawah: sesuai. Baris 67 (Explore), 69 (Presenter), 70 (References), 72 (Basis). Present menjadi 'Mode Present' (baris 68); Regulations dan Emission formation DITERJEMAHKAN (Baku mutu, Pembentukan emisi), jadi tidak ada di daftar ini.
- Teks utuh (sisi id sengaja sama dengan en): `Start`, `Learn`, `Chart guide`, `About`, `References`, `Glossary`, `Assumptions`, `Explore`, `Presenter`, `Basis`, `Start here`, `Engine & Turbine Emission Lab`, `Presenter · Engine & Turbine Emission Lab`

### Kode singkat navigasi yang dilipat

- Alasan: Dua huruf di rail navigasi untuk halaman dan alat yang namanya tetap Inggris (Start, Learn, Chart guide, About, References, Glossary, Assumptions, Present, Presenter). Kode untuk halaman yang diterjemahkan berbeda (Bm, Pe, Tl).
- Terhadap tabel PADANAN di bawah: sesuai. Mengikuti kelompok halaman_produk.
- Teks utuh (sisi id sengaja sama dengan en): `St`, `Ln`, `Cg`, `Ab`, `Rf`, `Gl`, `As`, `Pr`, `Pw`

### Token status chip

- Alasan: Keputusan D (a), terkunci: chip Within / Above / Not modeled tetap Inggris di kedua bahasa, seperti tag Basis. Tooltip, alasan, dan kalimat di sekitarnya diterjemahkan. Chip tidak pernah berarti 'lulus' atau 'compliant'. Label 'Site data' TIDAK termasuk: di ID menjadi 'Data lapangan' (keputusan terkunci).
- Terhadap tabel PADANAN di bawah: **MENYIMPANG**. Baris 56 memetakan 'tidak dimodelkan' ke chip Not modeled; di ID chip tetap 'Not modeled' dan kalimat biasa memakai 'tidak dimodelkan'. Within dan Above tidak punya baris di tabel. Baris 58 ('data lapangan / data unit') kini sesuai: label ID 'Data lapangan'.
- Teks utuh (sisi id sengaja sama dengan en): `Within`, `Above`, `Not modeled`

### Istilah lapangan dan teknis tanpa padanan umum

- Alasan: Istilah yang di lapangan dan di perangkat lunak dipakai dalam bentuk Inggris. Menerjemahkannya membuat peserta mencari kata yang tidak mereka temui di dokumen vendor atau panel kontrol.
- Terhadap tabel PADANAN di bawah: sesuai. Baris 26 (part-load dipakai apa adanya), 39 (head), 41 (methane slip), 33 (derating).
- Teks utuh (sisi id sengaja sama dengan en): `Part-load`, `Renderer`, `Bloom`, `FPS`, `Frame [ms]`, `Thermal NOx`, `Methane slip`, `Lean premix`, `Bloom: Auto`, `Power turbine`, `Derating`
- Dipakai di dalam kalimat (hanya dicatat): `head`, `derating`, `part-load`, `methane slip`, `fuel-only`, `single-shaft`, `twin-shaft`, `lean-burn`, `lean premix`, `premix`, `fuel split`, `suction`, `discharge`, `surge`, `waterfall`, `timing`, `what-if`

### Kata yang kebetulan sama di kedua bahasa

- Alasan: Kata serapan yang ejaannya sama di Inggris dan Indonesia. Bukan terjemahan yang tertinggal.
- Terhadap tabel PADANAN di bawah: tidak diatur tabel ini
- Teks utuh (sisi id sengaja sama dengan en): `Ideal`, `Parameter`, `Model`, `Status`, `Timer`, `Total`, `Scene`, `Gas`, `Real`, `Piston`, `Preset`, `Generator`

### Fungsi pembentuk teks dengan sisi id identik

- Alasan: Teks yang hanya terdiri atas nama tetap, angka, dan satuan (mis. 'Scene 3 · Judul', 'Model OK · 19/19', 'margin +4,2 %'). Tidak ada kata yang bisa diterjemahkan; angkanya sudah mengikuti bahasa lewat format angka.
- Terhadap tabel PADANAN di bawah: sesuai. Mengikuti kelompok halaman_produk dan status_chip.
- Fungsi teks: `common.animSpeedValue`, `app.sceneTag`, `app.docTitle`, `app.toast.bloom`, `app.badge.ok`, `app.badge.fail`, `nav.sceneTip`, `content.item`, `debug.gpu`, `presenter.current`, `presenter.target`, `presenter.nextLine`, `regulation.margin`, `regulation.mg`, `regulation.pct`, `regulation.scene6Row`, `regulation.scene6Item`, `regulation.scene6Margin`, `regulation.page.group`, `charts.flame.dT`, `charts.flame.point`, `scene3.tinValue`, `scene3.bars.sub`, `scene4.tradeoff.point`, `scene4.tradeoff.now`, `scene4.hud.calib.value`, `scene2.hud.tips.etaIdealBrayton`, `scene1.formula.VcVal`, `scene1.ptheta.pmax`, `scene5.speedGen`, `scene5.speedTwin`, `scene6.windowText`, `scene6.hud.speed.single`, `scene6.hud.speed.twin`, `scene6.hud.igv.value`, `scene6.hud.calib.value`, `scene7.hud.ngg.value`, `scene7.affinity.head`, `scene8.charts.sub`, `scene8.charts.subTurbine`, `scene8.hud.slip.value`, `scene8.hud.inc.value`, `scene8.hud.calib.value`

### Nama siklus dan komponen yang berupa nama diri

- Alasan: Nama siklus termodinamika (Otto, Diesel, Dual, Brayton) dan kombinasi yang hanya memuatnya adalah nama diri; menerjemahkannya tidak bermakna. Entri ditambahkan karena string Scene 1–4 memuatnya; kebijakan 'Tetap Inggris' tidak berubah.
- Terhadap tabel PADANAN di bawah: tidak diatur tabel ini
- Teks utuh (sisi id sengaja sama dengan en): `Otto`, `Diesel`, `Dual`, `Brayton`, `Brayton ideal`, `Brayton: ideal → real`

### Rumus dan label matematika tanpa kata

- Alasan: String yang hanya berisi simbol, subskrip, dan operator (mis. 'T = ', 'x<sub>b</sub>', rumus η dan Zeldovich) tidak punya kata yang bisa diterjemahkan. Entri ditambahkan karena string Scene 1–4 memuatnya; kebijakan 'Tetap Inggris' tidak berubah.
- Terhadap tabel PADANAN di bawah: tidak diatur tabel ini
- Teks utuh (sisi id sengaja sama dengan en): `P`, `T`, `x<sub>b</sub>`, `P<sub>max</sub>`, `w<sub>net</sub>`, `T = `, `P = `, `V = `, `B = `, `a = `, `l = `, `l + a − s = `, `r_p = P_discharge / P_suction.`, `Q ∝ N · H ∝ N² · P ∝ N³`
- Fungsi teks: `scene1.formula.s`, `scene1.formula.V`, `scene1.formula.theta`, `scene1.formula.Vc`, `scene2.formula.otto`, `scene2.formula.diesel`, `scene2.formula.dual`, `scene2.formula.brayton`

<!-- tetap-inggris:selesai -->

| No | Istilah Indonesia | Dipakai di | Label English di UI | Sumber | Catatan |
|---|---|---|---|---|---|
| 1 | putaran engkol / sudut engkol | presenter S1; ALUR S1 | `Crank angle θ` | `STR.common.crankAngle` |  |
| 2 | diagram P-V | presenter S1; ALUR S1 | `P-V diagram` | `STR.charts.pv.title` |  |
| 3 | luas loop (kerja) | presenter S1; ALUR S1 | `gross work` | `STR.charts.pv.caption()` | caption grafik P-V |
| 4 | rasio kompresi | ALUR S1; PROMPT §6 | `Compression ratio` | `STR.assumptions.engine.leverNames.compressionRatio` |  |
| 5 | titik mati atas (TDC) | ALUR S1 | `TDC` | `STR.charts.pv.tdc` | singkatan English dipakai juga di naskah |
| 6 | efisiensi teoretis / batas ideal | presenter S2; ALUR S2 | `Ideal limit` | `STR.scene2.waterfall.steps.idealOtto` | waterfall |
| 7 | efisiensi rem | ALUR S1–S2, S9 | `Brake η` | `STR.scene1.hud.etab.label` |  |
| 8 | rugi panas / panas yang lari ke dinding | presenter S2; ALUR S2 | `Wall heat loss` | `STR.scene2.waterfall.steps.heat` | langkah waterfall |
| 9 | gesekan / friksi | presenter S2; ALUR S2 | `Mechanical friction` | `STR.scene2.waterfall.steps.friction` | langkah waterfall |
| 10 | waktu pembakaran | presenter S2; ALUR S2 | `Finite combustion duration` | `STR.scene2.waterfall.steps.burn` | langkah waterfall |
| 11 | siklus ideal vs real | ALUR S2 | `Ideal vs real cycles` | `STR.nav.scenes.2` | judul Scene 2 |
| 12 | suhu nyala | presenter S3, S4; ALUR S3–S6 | `flame temperature` | `STR.charts.flame.title` |  |
| 13 | campuran | presenter S3; ALUR S3 | `Fuel-air equivalence φ` | `STR.scene9.leversTab.labels.phi` | φ < 1 = miskin |
| 14 | miskin bahan bakar (lean) | presenter S3 | `Gas lean-burn` | `STR.scene4.engines.gas` | label mesin gas |
| 15 | stoikiometrik | presenter S3; ALUR S3 | `stoichiometric` | `STR.charts.flame.stoich` |  |
| 16 | kantong / zona panas lokal | presenter S3 | — | — | **Tidak ada padanan di UI.** konsep naskah; UI menulis local φ di catatan model |
| 17 | eksponensial (NOx vs suhu) | presenter S4; ALUR S4 | `exponentially` | `STR.scene4.message` | pesan kunci Scene 4 |
| 18 | jendela suhu | presenter S4 | — | — | **Tidak ada padanan di UI.** tidak ada label; UI menulis pita "DLN flame T" di Scene 4 |
| 19 | jendela DLN | ALUR S4, S6 | `DLN flame T` | `STR.scene4.arrhenius.bandDln` | pita di grafik Scene 4 |
| 20 | faktor kalibrasi | ALUR S8; PROMPT §11 | `NOx calib` | `STR.scene4.hud.calib.label` | HUD |
| 21 | panel kalibrasi | PROMPT §6 | `Calibration` | `STR.scene4.calib.button` | tombol C |
| 22 | indikatif | ALUR (kepala dokumen); PROMPT §11 | `indicative` | `STR.common.indicative` |  |
| 23 | turbin gas | ALUR S5 | `Gas turbine` | `STR.nav.scenes.5` |  |
| 24 | turbin generator (single-shaft) | presenter S6; ALUR S6 | `Generator (single-shaft)` | `STR.scene4.calib.dlnRows.single` |  |
| 25 | turbin kompresor (twin-shaft) | presenter S6, S7; ALUR S6 | `Compressor drive (twin-shaft)` | `STR.scene4.calib.dlnRows.twin` |  |
| 26 | beban / beban sebagian | ALUR S6 | `Load` | `STR.scene6.load` | part-load dipakai apa adanya |
| 27 | titik optimum | presenter S6 | — | — | **Tidak ada padanan di UI.** klaim naskah; UI tidak memberi label (lihat AUDIT_KLAIM) |
| 28 | titik operasi | presenter S5, S6 | `operating point` | `STR.scene9.leversTab.aux.caption` |  |
| 29 | jendela operasi / jendela beban | presenter S6, S9; ALUR S6, S9 | `Load window` | `STR.scene6.hud.window.label` |  |
| 30 | bergeser dan menyempit | presenter S6; ALUR S6 | `shifts and narrows` | `STR.scene9.C.model` | kalimat kejujuran model |
| 31 | tebing CO | ALUR S6; PROMPT §6 | `cliff` | `STR.scene6.note` | kalimat kejujuran model |
| 32 | tanpa IGV (fuel-only) | ALUR S6 | `Fuel-only` | `STR.scene6.strategies.fuelOnly` | segmen IGV / Fuel-only |
| 33 | ambient panas / derating | presenter S5; ALUR S5 | `Derating` | `STR.scene5.hud.derate.label` |  |
| 34 | daya | presenter S5; ALUR S5 | `Shaft power` | `STR.scene5.hud.power.tip` | tooltip HUD Scene 5 |
| 35 | tekanan sumur (suction) | presenter S6, S7; ALUR S6–S7 | `Suction pressure` | `STR.scene7.Psuc` |  |
| 36 | pipa (discharge) | presenter S6; ALUR S7 | `Discharge pressure` | `STR.scene7.Pdis` |  |
| 37 | kecepatan power turbine / kecepatan poros / putaran poros | presenter S7; ALUR S7 | `Shaft speed` | `STR.scene5.hud.speed.label` | N_PT mengikuti proses |
| 38 | hukum affinitas | ALUR S7 | `affinity laws` | `STR.scene7.title` | judul Scene 7 |
| 39 | head | ALUR S7 | `Head` | `STR.scene7.affinity.head()` |  |
| 40 | emisi gabungan | ALUR S8 | `Combined emissions` | `STR.nav.scenes.8` | judul Scene 8 |
| 41 | methane slip | presenter S8; ALUR S8–S9 | `Methane slip` | `STR.scene8.slip` |  |
| 42 | jejak karbon | presenter S8 | — | — | **Tidak ada padanan di UI.** UI memakai CO₂e |
| 43 | CO₂ setara (CO₂e) | ALUR S8–S9 | `CO₂e` | `STR.scene8.messageNoSlip()` |  |
| 44 | penalti bahan bakar | ALUR S9 | `Fuel penalty` | `STR.scene9.penalty` |  |
| 45 | kualitas udara lokal | presenter S9 | — | — | **Tidak ada padanan di UI.** konsep naskah, tidak ada label |
| 46 | membayar karbon | presenter S9 | — | — | **Tidak ada padanan di UI.** konsep naskah; UI: specific CO₂ rises |
| 47 | partikulat / jelaga | ALUR S10 | `PM` | `STR.scene8.pm.label` | kualitatif, tidak dimodelkan |
| 48 | perangkat pengendali emisi | presenter S10; ALUR S10 | `Emission control devices` | `STR.scene10.title` | judul Scene 10 |
| 49 | penutup | ALUR S11 | `Closing` | `STR.nav.scenes.11` | judul Scene 11 |
| 50 | opsi arah diskusi | presenter S11; ALUR S11 | `Discussion options` | `STR.scene11.optionsTitle` | judul daftar di Scene 11; isi opsi dari content/closing.json |
| 51 | baku mutu | presenter S1, S11; ALUR (kepala dokumen), S9 | `Regulations` | `STR.nav.pages.regulations` | halaman G; di Scene 9 "Limits" |
| 52 | batas / limit | presenter S1, S9; ALUR S9 | `Limit` | `STR.scene9.limitsTab.head[1]` |  |
| 53 | equipment / jenis penggerak | ALUR S9 | `Equipment` | `STR.pages.formation.equipment` |  |
| 54 | kelas kapasitas | ALUR S9 | `Capacity class` | `STR.regulation.capacity` |  |
| 55 | bahan bakar minyak (solar) | ALUR S9 | `Oil` | `STR.regulation.fuels.oil` | pemilih bahan bakar |
| 56 | tidak dimodelkan | ALUR S9 | `Not modeled` | `STR.regulation.status.notModeled` | chip |
| 57 | margin | ALUR S9 | `margin is smaller than model uncertainty` | `STR.regulation.marginSmall` | keterangan margin < 10 % |
| 58 | data lapangan / data unit | ALUR Q&A | `Site data` | `STR.common.level.siteData` |  |
| 59 | nilai izin / OEM | ALUR S6, S9 | `permit/OEM value (user input)` | `STR.regulation.limitSource.permit` |  |
| 60 | basis regulasi | ALUR (kepala dokumen) | `Regulation basis` | `STR.regulation.basis()` |  |
| 61 | koreksi O₂ / O₂ acuan | ALUR cadangan; PROMPT §6 | `Reference O₂` | `STR.assumptions.basis.o2` | panel H |
| 62 | basis volume | ALUR Q&A | `Volume basis` | `STR.assumptions.basis.vol` | panel H |
| 63 | ditranskripsi (belum diverifikasi) | ALUR (kepala dokumen) | `Transcribed from the published tables` | `STR.regulation.banner` | banner |
| 64 | terbentuk dari mana (pembentukan emisi) | ALUR S9 | `Emission formation` | `STR.nav.pages.formation` | halaman #/formation |
| 65 | tuas | ALUR S9 | `Levers` | `STR.scene9.tabs.levers` | tab 3 Scene 9 |
| 66 | komposisi gas | ALUR S9 | `Fuel gas composition` | `STR.scene9.fuelPanel.gasTitle` | panel Fuel |
| 67 | mode Explore | ALUR (navigasi) | `Explore` | `STR.nav.presentTip` |  |
| 68 | mode Present | ALUR (navigasi) | `Present mode` | `STR.nav.present` |  |
| 69 | jendela presenter | ALUR (navigasi) | `Presenter` | `STR.presenter.button` |  |
| 70 | referensi / sumber | ALUR (navigasi) | `References` | `STR.nav.pages.references` |  |
| 71 | asumsi model / panel asumsi | ALUR cadangan | `Model assumptions` | `STR.assumptions.title` | panel H |
| 72 | dasar teori (kartu Basis) | ALUR cadangan | `Basis` | `STR.regulation.page.basisLabel` | tag Basis |
| 73 | jeda / lanjut | PROMPT §8 | `Pause` | `STR.common.pause` |  |
| 74 | bekukan | PROMPT §8 | `Freeze` | `STR.common.freeze` |  |
| 75 | tangkapan layar | PROMPT §8 | `Snapshot` | `STR.snapshot.button` |  |
