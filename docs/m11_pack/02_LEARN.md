# Step 02: halaman Learn dan Glossary dua bahasa

Model: Sonnet 5.5 high.
Prasyarat: Step 01 di-merge.
Aturan sesi: rencana singkat dulu (sketsa tata letak daftar level dan halaman pelajaran), tunggu persetujuan, kerjakan, tes, build, lapor 5 baris, berhenti.

## Tujuan

Orang tanpa latar belakang teknik bisa belajar urut dari Level 0 sampai Level 5 di dalam aplikasi, berpindah ke scene untuk mencoba, lalu kembali ke pelajaran tanpa kehilangan posisi.

## Tugas

### 1. `#/learn`: daftar level
- `learn.landing.learnIntro` di atas.
- Enam kartu level (judul, ringkasan, jumlah pelajaran, total menit dihitung dari data, bilah progres).
- Di dalam tiap level: daftar pelajaran (judul, menit, tanda selesai).
- Tombol "Continue" ke pelajaran pertama yang belum selesai.
- Tautan ke Chart guide (`#/learn/charts`) dengan `learn.landing.chartsIntro`.

### 2. `#/learn/<lessonId>`: halaman pelajaran
Urutan isi:
1. Remah roti: Learn › Level N › judul pelajaran; menit; tujuan (`goal`).
2. Isi (`body`): paragraf. Istilah dari `terms` yang muncul di teks **tidak** perlu ditebalkan otomatis; cukup kotak "Words in this lesson" di samping (layar lebar) atau di bawah (layar sempit).
3. Kotak kata: untuk id di `learn.terms`, pakai `term` dan `definition` dua bahasa. Untuk id di `glossary.json`, pakai istilah English dan definisi English, atau definisi Indonesia dari `learn.glossaryId` saat bahasa ID. Setiap kata bertaut ke Glossary.
4. Kotak "Try it": teks + tombol yang membuka `tryIt.route` dalam mode Explore. Simpan id pelajaran asal; di scene tujuan tampil pil kecil "← Back to lesson" (hilang di mode Present dan saat pindah ke halaman lain).
5. Soal (`checks`): pilihan bisa diklik, langsung menunjukkan benar/salah dan `why`. Tidak ada skor yang disimpan.
6. Sumber (`refs`): `cite`, tautan `url` (tab baru) bila ada, dan tautan ke `#/references/<id>`. Sumber dengan `level: 'intro'` diberi lencana "Start here". Entri `locatorVerified: false` diberi tanda "to verify", sama dengan halaman References.
7. Navigasi: sebelumnya / berikutnya (melintasi level), tombol "Mark as done".

### 3. Progres
- Pelajaran yang selesai disimpan di localStorage (`etel:learnDone`, array id) lewat helper aman. Storage kosong atau melempar → semua belum selesai, tanpa galat.
- Tombol kecil "Reset progress" di `#/learn`.

### 4. Banner draf
- Bila `learn.reviewed === false`, tampilkan `learn.landing.draftBanner` di atas `#/learn`, halaman pelajaran, dan Chart guide. Hilang otomatis saat Ifan mengubahnya menjadi `true`.

### 5. Glossary dua bahasa
- Sakelar EN/ID dari Step 01 berlaku. Saat ID: definisi dari `learn.glossaryId[id].definition`, nama istilah dari `learn.glossaryId[id].term` bila ada (bila tidak, nama asli). Saat EN: tidak berubah.
- Tambah bagian "Basic words" berisi `learn.terms` (dua bahasa), di atas daftar istilah lama, dengan penanda "from Learn".

### 6. Tata letak dan aksesibilitas
- Lebar baris isi ±70 karakter; ukuran huruf isi minimal 17 px di 1366×768.
- Navigasi keyboard penuh (Tab, Enter, panah tidak mengganti scene saat fokus di halaman Learn).
- Tidak ada loop render 3D saat halaman Learn terbuka (sama dengan halaman penuh lain).

### 7. Tes
- Progres: tandai, muat ulang, reset; storage yang melempar.
- Halaman pelajaran: semua 21 pelajaran terbuka lewat alamat langsung tanpa error console (smoke e2e boleh mengambil sampel 5 pelajaran + yang pertama dan terakhir).
- "Back to lesson": dari `#/learn/l3-4` → Try it → Scene 6 → kembali ke `#/learn/l3-4`.
- Glossary ID: setiap id di `glossary.json` punya definisi ID (gagal bila ada yang hilang).

### 8. Dokumen
- CLAUDE.md: status M11 Step 02.

## Larangan
- Tidak menulis ulang isi `learn.json`. Tidak menambah angka model ke halaman Learn.
- Tidak mengubah presenter, `thermo.js`, atau perilaku scene.

## Kriteria selesai
- `npm test`, `npm run build`, `npm run e2e:smoke` hijau; ukuran bundle dilaporkan.
- PR tanpa merge, laporan 5 baris, berhenti.
