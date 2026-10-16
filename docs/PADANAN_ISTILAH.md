# Padanan istilah: Indonesia (naskah dan docs) → English (layar)

Tabel ini memetakan istilah Indonesia yang dipakai di catatan presenter (`content/presenter.json`) dan di `docs/` ke label English yang benar-benar tampil di aplikasi. Label diambil apa adanya dari `src/ui/strings.js` atau `content/*.json`; kolom **Sumber** menunjuk kunci tempat label itu pertama ditemukan (`STR.…` = `src/ui/strings.js`). Fungsi teks (`…()`) berarti label muncul di dalam kalimat yang dibentuk dari frame.

- Istilah tanpa padanan ditandai **Tidak ada padanan di UI** (konsep naskah yang tidak punya label di layar). Jangan menuliskannya seolah-olah ada di layar.
- Singkatan English (TDC, IGV, DLN, CEMS, PM, …) dipakai sama di naskah dan di layar; definisinya ada di halaman Glossary (`#/glossary`, `content/glossary.json`).
- Penjaga: `tests/padanan.test.js` gagal bila label English di kolom 4 tidak ada lagi di `strings.js` / `content/`, atau bila istilah Indonesia tidak ditemukan di tempat yang disebut kolom 3. Ubah tabel ini setiap kali label UI atau naskah diganti.
- "presenter S6" = `content/presenter.json` scene 6; "ALUR S6" = `docs/ALUR_SLIDE_presentasi.md` bagian S6; "PROMPT §8" = `docs/PROMPT_simulasi_3D.md` bagian 8.

Jumlah: 76 istilah, 7 tanpa padanan di UI.

| No | Istilah Indonesia | Dipakai di | Label English di UI | Sumber | Catatan |
|---|---|---|---|---|---|
| 1 | putaran engkol / sudut engkol | presenter S1; ALUR S1 | `Crank angle θ` | `STR.common.crankAngle` |  |
| 2 | diagram P-V | presenter S1; ALUR S1 | `P-V diagram` | `STR.charts.pv.title` |  |
| 3 | luas loop (kerja) | presenter S1; ALUR S1 | `gross work` | `STR.charts.pv.caption()` | caption grafik P-V |
| 4 | rasio kompresi | ALUR S1; PROMPT §6 | `Compression ratio` | `STR.assumptions.engine.leverNames.compressionRatio` |  |
| 5 | titik mati atas (TDC) | ALUR S1 | `TDC` | `STR.charts.pv.tdc` | singkatan English dipakai juga di naskah |
| 6 | efisiensi teoretis / batas ideal | presenter S2; ALUR S2 | `Ideal limit` | `STR.scene2.waterfall.steps.idealOtto` | waterfall |
| 7 | efisiensi lapangan | presenter S2 | — | — | **Tidak ada padanan di UI.** UI hanya menampilkan efisiensi model (Brake η); "lapangan" = data unit, tidak ada di model |
| 8 | efisiensi rem | ALUR S1–S2, S9 | `Brake η` | `STR.scene1.hud.etab.label` |  |
| 9 | rugi panas / panas yang lari ke dinding | presenter S2; ALUR S2 | `Wall heat loss` | `STR.scene2.waterfall.steps.heat` | langkah waterfall |
| 10 | gesekan / friksi | presenter S2; ALUR S2 | `Mechanical friction` | `STR.scene2.waterfall.steps.friction` | langkah waterfall |
| 11 | waktu pembakaran | presenter S2; ALUR S2 | `Finite combustion duration` | `STR.scene2.waterfall.steps.burn` | langkah waterfall |
| 12 | siklus ideal vs real | ALUR S2 | `Ideal vs real cycles` | `STR.nav.scenes.2` | judul Scene 2 |
| 13 | suhu nyala | presenter S3, S4; ALUR S3–S6 | `flame temperature` | `STR.charts.flame.title` |  |
| 14 | campuran | presenter S3; ALUR S3 | `Fuel-air equivalence φ` | `STR.scene9.leversTab.labels.phi` | φ < 1 = miskin |
| 15 | miskin bahan bakar (lean) | presenter S3 | `Gas lean-burn` | `STR.scene4.engines.gas` | label mesin gas |
| 16 | stoikiometrik | presenter S3; ALUR S3 | `stoichiometric` | `STR.charts.flame.stoich` |  |
| 17 | kantong / zona panas lokal | presenter S3 | — | — | **Tidak ada padanan di UI.** konsep naskah; UI menulis local φ di catatan model |
| 18 | eksponensial (NOx vs suhu) | presenter S4; ALUR S4 | `exponentially` | `STR.scene4.message` | pesan kunci Scene 4 |
| 19 | jendela suhu | presenter S4 | — | — | **Tidak ada padanan di UI.** tidak ada label; UI menulis pita "DLN flame T" di Scene 4 |
| 20 | jendela DLN | ALUR S4, S6 | `DLN flame T` | `STR.scene4.arrhenius.bandDln` | pita di grafik Scene 4 |
| 21 | faktor kalibrasi | ALUR S8; PROMPT §11 | `NOx calib` | `STR.scene4.hud.calib.label` | HUD |
| 22 | panel kalibrasi | PROMPT §6 | `Calibration` | `STR.scene4.calib.button` | tombol C |
| 23 | indikatif | ALUR (kepala dokumen); PROMPT §11 | `indicative` | `STR.common.indicative` |  |
| 24 | turbin gas | ALUR S5 | `Gas turbine` | `STR.nav.scenes.5` |  |
| 25 | turbin generator (single-shaft) | presenter S6; ALUR S6 | `Generator (single-shaft)` | `STR.scene4.calib.dlnRows.single` |  |
| 26 | turbin kompresor (twin-shaft) | presenter S6, S7; ALUR S6 | `Compressor drive (twin-shaft)` | `STR.scene4.calib.dlnRows.twin` |  |
| 27 | beban / beban sebagian | ALUR S6 | `Load` | `STR.scene6.load` | part-load dipakai apa adanya |
| 28 | titik optimum | presenter S6 | — | — | **Tidak ada padanan di UI.** klaim naskah; UI tidak memberi label (lihat AUDIT_KLAIM) |
| 29 | titik operasi | presenter S5, S6 | `operating point` | `STR.scene9.leversTab.aux.caption` |  |
| 30 | jendela operasi / jendela beban | presenter S6, S9; ALUR S6, S9 | `Load window` | `STR.scene6.hud.window.label` |  |
| 31 | bergeser dan menyempit | presenter S6; ALUR S6 | `shifts and narrows` | `STR.scene9.C.model` | kalimat kejujuran model |
| 32 | tebing CO | ALUR S6; PROMPT §6 | `cliff` | `STR.scene6.note` | kalimat kejujuran model |
| 33 | tanpa IGV (fuel-only) | ALUR S6 | `Fuel-only` | `STR.scene6.strategies.fuelOnly` | segmen IGV / Fuel-only |
| 34 | ambient panas / derating | presenter S5; ALUR S5 | `Derating` | `STR.scene5.hud.derate.label` |  |
| 35 | daya | presenter S5; ALUR S5 | `Shaft power` | `STR.scene5.hud.power.tip` | tooltip HUD Scene 5 |
| 36 | tekanan sumur (suction) | presenter S6, S7; ALUR S6–S7 | `Suction pressure` | `STR.scene7.Psuc` |  |
| 37 | pipa (discharge) | presenter S6; ALUR S7 | `Discharge pressure` | `STR.scene7.Pdis` |  |
| 38 | kecepatan power turbine | presenter S7; ALUR S7 | `Shaft speed` | `STR.scene5.hud.speed.label` | N_PT mengikuti proses |
| 39 | hukum affinitas | ALUR S7 | `affinity laws` | `STR.scene7.title` | judul Scene 7 |
| 40 | head | ALUR S7 | `Head` | `STR.scene7.affinity.head()` |  |
| 41 | emisi gabungan | ALUR S8 | `Combined emissions` | `STR.nav.scenes.8` | judul Scene 8 |
| 42 | methane slip | presenter S8; ALUR S8–S9 | `Methane slip` | `STR.scene8.slip` |  |
| 43 | jejak karbon | presenter S8 | — | — | **Tidak ada padanan di UI.** UI memakai CO₂e |
| 44 | CO₂ setara (CO₂e) | ALUR S8–S9 | `CO₂e` | `STR.scene8.messageNoSlip()` |  |
| 45 | penalti bahan bakar | ALUR S9 | `Fuel penalty` | `STR.scene9.penalty` |  |
| 46 | kualitas udara lokal | presenter S9 | — | — | **Tidak ada padanan di UI.** konsep naskah, tidak ada label |
| 47 | membayar karbon | presenter S9 | — | — | **Tidak ada padanan di UI.** konsep naskah; UI: specific CO₂ rises |
| 48 | partikulat / jelaga | ALUR S10 | `PM` | `STR.scene8.pm.label` | kualitatif, tidak dimodelkan |
| 49 | perangkat pengendali emisi | presenter S10; ALUR S10 | `Emission control devices` | `STR.scene10.title` | judul Scene 10 |
| 50 | penutup | ALUR S11 | `Closing` | `STR.nav.scenes.11` | judul Scene 11 |
| 51 | opsi arah diskusi | presenter S11; ALUR S11 | `Discussion options` | `STR.scene11.optionsTitle` | judul daftar di Scene 11; isi opsi dari content/closing.json |
| 52 | baku mutu | presenter S1, S11; ALUR (kepala dokumen), S9 | `Regulations` | `STR.nav.pages.regulations` | halaman G; di Scene 9 "Limits" |
| 53 | batas / limit | presenter S1, S9; ALUR S9 | `Limit` | `STR.scene9.limitsTab.head[1]` |  |
| 54 | equipment / jenis penggerak | ALUR S9 | `Equipment` | `STR.pages.formation.equipment` |  |
| 55 | kelas kapasitas | ALUR S9 | `Capacity class` | `STR.regulation.capacity` |  |
| 56 | bahan bakar minyak (solar) | ALUR S9 | `Oil` | `STR.regulation.fuels.oil` | pemilih bahan bakar |
| 57 | tidak dimodelkan | ALUR S9 | `Not modeled` | `STR.regulation.status.notModeled` | chip |
| 58 | margin | ALUR S9 | `margin is smaller than model uncertainty` | `STR.regulation.marginSmall` | keterangan margin < 10 % |
| 59 | data lapangan / data unit | ALUR Q&A | `Site data` | `STR.common.level.siteData` |  |
| 60 | nilai izin / OEM | ALUR S6, S9 | `permit/OEM value (user input)` | `STR.regulation.limitSource.permit` |  |
| 61 | basis regulasi | ALUR (kepala dokumen) | `Regulation basis` | `STR.regulation.basis()` |  |
| 62 | koreksi O₂ / O₂ acuan | ALUR cadangan; PROMPT §6 | `Reference O₂` | `STR.assumptions.basis.o2` | panel H |
| 63 | basis volume | ALUR Q&A | `Volume basis` | `STR.assumptions.basis.vol` | panel H |
| 64 | ditranskripsi (belum diverifikasi) | ALUR (kepala dokumen) | `Transcribed from the published tables` | `STR.regulation.banner` | banner |
| 65 | terbentuk dari mana (pembentukan emisi) | ALUR S9 | `Emission formation` | `STR.nav.pages.formation` | halaman #/formation |
| 66 | tuas | ALUR S9 | `Levers` | `STR.scene9.tabs.levers` | tab 3 Scene 9 |
| 67 | komposisi gas | ALUR S9 | `Fuel gas composition` | `STR.scene9.fuelPanel.gasTitle` | panel Fuel |
| 68 | mode Explore | ALUR (navigasi) | `Explore` | `STR.nav.presentTip` |  |
| 69 | mode Present | ALUR (navigasi) | `Present mode` | `STR.nav.present` |  |
| 70 | jendela presenter | ALUR (navigasi) | `Presenter` | `STR.presenter.button` |  |
| 71 | referensi / sumber | ALUR (navigasi) | `References` | `STR.nav.pages.references` |  |
| 72 | asumsi model / panel asumsi | ALUR cadangan | `Model assumptions` | `STR.assumptions.title` | panel H |
| 73 | dasar teori (kartu Basis) | ALUR cadangan | `Basis` | `STR.regulation.page.basisLabel` | tag Basis |
| 74 | jeda / lanjut | PROMPT §8 | `Pause` | `STR.common.pause` |  |
| 75 | bekukan | PROMPT §8 | `Freeze` | `STR.common.freeze` |  |
| 76 | tangkapan layar | PROMPT §8 | `Snapshot` | `STR.snapshot.button` |  |
