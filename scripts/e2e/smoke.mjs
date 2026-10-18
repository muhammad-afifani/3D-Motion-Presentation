/**
 * smoke.mjs — smoke test tampilan: setiap scene (dan setiap tab Scene 9) di 1366×768, 1920×1080, dan 1280×720.
 *   1. Setiap grafik yang tampil (.chart): canvas berukuran > 0 dan terisi ≥ MIN_FILL_PCT % piksel non-latar
 *      (gabungan lapis statis dan dinamis). Grafik yang disembunyikan aplikasi (display: none) dilewati.
 *   2. Tidak ada teks yang meluber dari kontainernya (bilah atas, kartu overlay, HUD, kontrol, judul/caption grafik).
 *   3. Tanpa galat halaman / galat konsol.
 *   4. Scene 9 tab Levers: slider → sapuan Worker (waktu dilaporkan), Preset/Modified, Limits ikut slider; PNG (S) per tab.
 *   5. M9 Step 06: setiap deep link (scene, tab Scene 9, halaman penuh) terbuka di halaman baru tanpa galat dan tanpa
 *      grafik kosong; tanpa scroll horizontal; panah di Explore / Present; jendela presenter ikut saat scene berganti di
 *      Present (juga lewat alamat #/scene/N); tinggi grafik Scene 6 dilaporkan.
 *   6. Bagian B: tema terang di 1366×768 (semua scene/tab, latar viewport varian A, kotak overlay kaca + blur tanpa
 *      latar opak putih, halaman penuh, PNG ikut tema, sakelar tersimpan setelah muat ulang).
 *   8. M11 Step 02: daftar level, 21 pelajaran, soal, progres + Reset di halaman, kata/sumber di atas pelajaran, Try it →
 *      pil "Back to lesson", Glossary dua bahasa, halaman langsung → landing, Learn di Present → Explore, panah.
 *   7. M11 Step 01: landing (tanpa hash), kartu, hero tidak kosong, EN/ID, kualitas Low pada hero, About, Present tanpa
 *      hash → Scene 1, landing minimal bila learn.json gagal; screenshot landing 3 resolusi × 2 tema.
 * Sengaja TIDAK memeriksa isi kartu info kiri Scene 9 (`.pol-card`): isinya akan dirombak.
 * Gagal (exit 1) bila ada grafik kosong, canvas 0, teks meluber, atau galat. Screenshot Scene 7 dan 9 disimpan di
 * scripts/e2e/shots/after/ (tidak di-commit).
 * Jalankan: npm run e2e:smoke   (build + skrip ini; butuh Playwright, lihat lib.mjs)
 * Catatan: tanpa GPU, Chromium memakai SwiftShader (rendering software); uji ini tidak bergantung pada fps.
 */
import { mkdirSync, readFileSync } from 'node:fs';
import { inflateSync } from 'node:zlib';
import { loadPlaywright, startPreview, launchers, goScene } from './lib.mjs';

export const VIEWPORTS = [[1366, 768], [1920, 1080], [1280, 720]];
export const MAX_TOPBAR_PX = 140;           // tinggi bilah atas maksimum (4 baris pesan kunci)
export const MIN_FILL_PCT = 1;            // % piksel non-transparan minimum per grafik (terukur 1,9–63 % pada tampilan normal)
const SHOT_SCENES = new Set([7, 9]);
const TABS = { 9: ['1', '2', '3', '4', '5'] }; // tab Scene 9: Limits, Formation, Levers, Load window, GHG
const SHOTS = 'scripts/e2e/shots/after';
const POLL_MS = 500, TIMEOUT_MS = 9000;    // grafik yang menunggu Worker diberi waktu menggambar

/** Dijalankan di halaman: ukuran + isi tiap grafik, dan teks yang meluber. */
function inspect({ minFill }) {
  // grafik yang disembunyikan aplikasi (display: none di atasnya, mis. skema Brayton saat siklus piston) tidak diuji;
  // grafik yang tampil tetapi berukuran 0 tetap gagal
  const charts = [...document.querySelectorAll('.chart')].filter((root) => root.checkVisibility?.() !== false).map((root, i) => {
    const [stat, dyn] = root.querySelectorAll('canvas');
    const r = root.getBoundingClientRect();
    const out = { i, title: root.querySelector('.chart__title')?.textContent ?? '', w: stat?.width ?? 0, h: stat?.height ?? 0, cssW: Math.round(r.width), cssH: Math.round(r.height), pct: 0 };
    if (stat && stat.width > 0 && stat.height > 0) {
      // piksel terisi di lapis statis ATAU dinamis (sebagian grafik, mis. waterfall, menggambar di lapis dinamis)
      const a = stat.getContext('2d').getImageData(0, 0, stat.width, stat.height).data;
      const b = dyn && dyn.width === stat.width && dyn.height === stat.height ? dyn.getContext('2d').getImageData(0, 0, dyn.width, dyn.height).data : null;
      let n = 0;
      for (let k = 3; k < a.length; k += 4) if (a[k] > 0 || (b && b[k] > 0)) n++;
      out.pct = +(100 * n / (stat.width * stat.height)).toFixed(2);
    }
    out.basis = !!root.querySelector('.chart__level')?.dataset.basis;   // tag Basis terpasang (M9 Step 02)
    out.ok = out.w > 0 && out.h > 0 && out.cssW > 0 && out.cssH > 0 && out.pct >= minFill && out.basis;
    return out;
  });

  const containers = ['.topbar', '.key-message', '.overlay', '.scene__hud .hud__item', '.pl-hud__body > *', '.scene__controls .ctl', '.chart__title', '.chart__caption', '.hud__note']
    .flatMap((sel) => [...document.querySelectorAll(sel)]).filter((el) => !el.closest('.pol-card') && !el.closest('.pres-host') && !el.closest('.debug-overlay'));
  const overflow = [];
  const name = (el) => `${el.tagName.toLowerCase()}${el.className && typeof el.className === 'string' ? `.${el.className.trim().split(/\s+/)[0]}` : ''}`;
  for (const el of new Set(containers)) {
    const cs = getComputedStyle(el);
    if (cs.display === 'none' || cs.visibility === 'hidden') continue;
    const r = el.getBoundingClientRect();
    if (!r.width || !r.height) continue;
    const reasons = [];
    if (el.scrollWidth > el.clientWidth + 1 && el.clientWidth > 0) reasons.push(`scrollWidth ${el.scrollWidth} > clientWidth ${el.clientWidth}`);
    const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
    for (let n = walker.nextNode(); n; n = walker.nextNode()) {
      if (!n.textContent.trim()) continue;
      const pe = n.parentElement;
      if (pe && (getComputedStyle(pe).visibility === 'hidden' || getComputedStyle(pe).display === 'none')) continue;
      const range = document.createRange();
      range.selectNodeContents(n);
      for (const q of range.getClientRects()) {
        if (!q.width) continue;
        if (q.right > r.right + 1.5 || q.left < r.left - 1.5) { reasons.push(`teks "${n.textContent.trim().slice(0, 28)}" keluar kotak (${Math.round(q.left)}–${Math.round(q.right)} vs ${Math.round(r.left)}–${Math.round(r.right)})`); break; }
      }
      if (reasons.length) break;
    }
    if (reasons.length) overflow.push({ el: name(el), reasons });
  }
  // bilah atas tidak boleh tumbuh tinggi (pesan kunci membungkus karena tombol terlalu lebar)
  const topbarH = Math.round(document.querySelector('.topbar')?.getBoundingClientRect().height ?? 0);
  const hscroll = document.documentElement.scrollWidth > window.innerWidth + 1;
  return { charts, overflow, topbarH, hscroll };
}

/** Interaksi Basis (M9 Step 02): tag grafik → kartu Basis → Esc; tombol ? → References → Esc; alamat #/references. */
async function basisInteraction(page, url, browser) {
  const fails = [];
  const vis = (sel) => page.evaluate((s) => { const e = document.querySelector(s); return !!e && !e.hidden && getComputedStyle(e).display !== 'none'; }, sel);
  await goScene(page, 1, 400);
  await page.locator('.chart__level').first().click();
  if (!(await vis('.bcard'))) fails.push('tag Basis: kartu tidak terbuka saat tag grafik diklik');
  else {
    const txt = await page.locator('.bcard__box').innerText();
    if (!/Semi-empirical/.test(txt) || !/Derived from/.test(txt) || !/locator not verified/.test(txt)) fails.push('kartu Basis: level / asal rumus / penanda locator tidak tampil');
    await page.keyboard.press('Escape');
    if (await vis('.bcard')) fails.push('kartu Basis: Esc tidak menutup');
  }
  await page.keyboard.press('?');
  if (!(await vis('.refs'))) fails.push('References: tombol ? tidak membuka halaman');
  else {
    const hash = await page.evaluate(() => location.hash);
    const n = await page.locator('.refs__item').count();
    if (hash !== '#/references') fails.push(`References: alamat ${hash} (harusnya #/references)`);
    if (n < 30) fails.push(`References: hanya ${n} entri tampil`);
    await page.keyboard.press('Escape');
    if (await vis('.refs')) fails.push('References: Esc tidak menutup');
  }
  await page.getByRole('button', { name: /References/ }).first().click();
  if (!(await vis('.refs'))) fails.push('References: tombol di bilah atas tidak membuka halaman');
  await page.keyboard.press('Escape');
  const p2 = await browser.newPage({ viewport: { width: 1366, height: 768 } });
  await p2.goto(`${url.replace(/#.*$/, '')}#/references`);
  await p2.waitForFunction(() => window.__etelDebug?.referencesOpen?.(), null, { timeout: 30000 }).catch(() => {}); // alamat halaman langsung: landing di bawahnya (M11 Step 02)
  if (!(await p2.evaluate(() => window.__etelDebug.referencesOpen()))) fails.push('References: alamat langsung #/references tidak membuka halaman');
  await p2.close();
  return fails;
}

/** Regulasi (M9 Step 03): G → halaman Regulations (+ banner verified:false), Esc; tombol cepat mati saat mengetik;
 *  chip Scene 9 dan Scene 6; alamat langsung #/regulations. */
async function regulationInteraction(page, url, browser) {
  const fails = [];
  const vis = (sel) => page.evaluate((s) => { const e = document.querySelector(s); return !!e && !e.hidden && getComputedStyle(e).display !== 'none'; }, sel);
  await goScene(page, 9, 600);
  await page.keyboard.press('g');
  if (!(await vis('.refs--regs'))) fails.push('Regulations: tombol G tidak membuka halaman');
  else {
    const txt = await page.locator('.refs--regs .refs__box').innerText();
    if (!/Transcribed from the published tables/.test(txt)) fails.push('Regulations: banner verified:false tidak tampil');
    if ((await page.locator('.refs--regs table').count()) < 5) fails.push('Regulations: tabel limit kurang dari 5');
    if ((await page.evaluate(() => location.hash)) !== '#/regulations') fails.push('Regulations: alamat bukan #/regulations');
    await page.keyboard.press('Escape');
    if (await vis('.refs--regs')) fails.push('Regulations: Esc tidak menutup');
  }
  // tab Formation: jumlah kartu = jumlah parameter equipment aktif; tautan sumber → References (#/references/<id>)
  await page.keyboard.press('2'); await page.waitForTimeout(400);
  const nCards = await page.locator('.fm-card').count();
  if (nCards < 5) fails.push(`Scene 9 Formation: hanya ${nCards} kartu`);
  if ((await page.locator('.fm-rx__list sub').count()) < 1) fails.push('Scene 9 Formation: reaksi tanpa subskrip');
  await page.locator('.fm-card .fm-ref').first().click();
  await page.waitForTimeout(400);
  if (!(await vis('.refs:not(.refs--regs)'))) fails.push('Formation: tautan sumber tidak membuka References');
  else {
    if (!/^#\/references\/[\w-]+$/.test(await page.evaluate(() => location.hash))) fails.push('Formation: alamat tautan bukan #/references/<id>');
    if ((await page.locator('.refs__item.is-target').count()) !== 1) fails.push('Formation: sumber tujuan tidak disorot');
    await page.keyboard.press('Escape');
  }
  await page.keyboard.press('1'); await page.waitForTimeout(300); // tab Limits
  if ((await page.locator('.pol-limits .reg-chip').count()) < 1) fails.push('Scene 9: chip kepatuhan tidak ada di tab Limits');
  if (!/Transcribed from the published tables/.test(await page.locator('.pol-head').innerText())) fails.push('Scene 9: banner verified:false tidak tampil di header');
  if (!(await page.evaluate(() => { const b = document.querySelector('.pol-limits .lim-tab'); return !!b && b.getBoundingClientRect().bottom <= document.querySelector('.pol-wide').getBoundingClientRect().bottom + 1; }))) fails.push('Scene 9: tab Limits masih perlu digulir');
  if ((await page.locator('.cov-table tbody tr').count()) < 6) fails.push('Scene 9: matriks cakupan tidak lengkap');
  // mengetik di kolom site data: G, H, ? tidak boleh membuka panel
  const input = page.locator('.pol-limits .reg__site input').first();
  await input.scrollIntoViewIfNeeded();
  await input.click();
  for (const k of ['g', 'h', '?', 's']) await page.keyboard.press(k);
  if (await vis('.refs--regs')) fails.push('Tombol cepat: G aktif saat fokus di kolom isian');
  if (await vis('.asm')) fails.push('Tombol cepat: H aktif saat fokus di kolom isian');
  if (await vis('.refs:not(.refs--regs)')) fails.push('Tombol cepat: ? aktif saat fokus di kolom isian');
  await input.fill('');
  await page.evaluate(() => document.activeElement?.blur?.());
  await goScene(page, 6, 800);
  if ((await page.locator('.overlay--reg').count()) > 0) fails.push('Scene 6: overlay regulasi masih menutupi tampilan 3D');
  const line = await page.locator('.pl-reg').innerText();
  if (!/\(indicative\)/.test(line)) fails.push('Scene 6: baris regulasi tanpa "(indicative)"');
  // klik → Scene 9 tab Limits; Esc kembali ke Scene 6; lalu sekali lagi dengan ←
  for (const key of ['Escape', 'ArrowLeft']) {
    await page.locator('.pl-reg').click();
    await page.waitForFunction(() => window.__etelDebug.scene() === 9 && !window.__etelDebug.loading(), null, { timeout: 15000 });
    await page.waitForTimeout(500);
    if (!(await vis('.pol-limits .lim-tab'))) fails.push('Scene 6 → 9: tab Limits tidak terbuka');
    if (!(await page.locator('.pol-head__back .btn').isVisible())) fails.push('Scene 9: tombol kembali tidak tampil');
    await page.keyboard.press(key);
    await page.waitForFunction(() => window.__etelDebug.scene() === 6 && !window.__etelDebug.loading(), null, { timeout: 15000 }).catch(() => fails.push(`Scene 9: ${key} tidak kembali ke Scene 6`));
    await page.waitForTimeout(500);
  }
  const p2 = await browser.newPage({ viewport: { width: 1366, height: 768 } });
  await p2.goto(`${url.replace(/#.*$/, '')}#/regulations`);
  await p2.waitForFunction(() => window.__etelDebug?.regulationsOpen?.(), null, { timeout: 30000 }).catch(() => {}); // landing di bawah halaman (M11 Step 02)
  if (!(await p2.evaluate(() => window.__etelDebug.regulationsOpen()))) fails.push('Regulations: alamat langsung #/regulations tidak membuka halaman');
  await p2.close();
  return fails;
}

/** Tab Levers (M9 Step 05b): slider → sapuan baru di Worker (setelah debounce); waktu hitung dari HUD; lencana
 *  Preset/Modified + Reset to preset; tab Limits mengikuti slider; komposisi gas tidak mengubah NOx. */
async function leversInteraction(page) {
  const fails = [], times = [];
  const caption = () => page.locator('.pl-emis .chart__caption').innerText();
  const hud = (id) => page.locator('.scene__hud .hud__item').nth(id).locator('.v').innerText();
  const limitsNox = async () => {
    await page.keyboard.press('1'); await page.waitForTimeout(300);
    const v = await page.locator('.pol-limits tbody tr').filter({ hasText: 'NOx' }).first().locator('[data-c="model"]').innerText();
    await page.keyboard.press('3'); await page.waitForTimeout(300);
    return v;
  };
  const setRange = (sel, v) => page.locator(sel).evaluate((n, val) => { n.value = val; n.dispatchEvent(new Event('input', { bubbles: true })); }, v);
  await goScene(page, 9, 600);
  await page.locator('.pol-head .reg__pick .seg__btn').first().click(); // header = Diesel engine (interaksi sebelumnya bisa meninggalkan turbin)
  await page.keyboard.press('3'); await page.waitForTimeout(600);
  if ((await page.locator('.pol-badge').innerText()) !== 'Preset') fails.push('Levers: lencana awal bukan "Preset"');
  if (!/not available in this model/.test(await page.locator('.lev-egr').innerText())) fails.push('Levers: EGR tanpa "not available in this model"');
  if (!/Sweeping fuel-air equivalence or boost also changes engine load\./.test(await page.locator('.lev-tab').innerText())) fails.push('Levers: kalimat beban hilang');
  if (!/Calibrated to typical literature level, not site data/.test(await caption())) fails.push('Levers: caption kalibrasi hilang');
  const nox0 = await limitsNox();
  for (const [axis, v] of [['Tivc', '340'], ['N', '1150'], ['phi', '0.6'], ['theta0', '0'], ['Pivc', '220000']]) {
    const t0 = Date.now();
    await setRange(`.lev-sliders [data-axis="${axis}"] input`, v);
    await page.waitForTimeout(40);
    try {
      await page.waitForFunction(() => !/Computing/.test(document.querySelector('.pl-emis .chart__caption')?.textContent ?? ''), null, { timeout: 15000 });
      times.push({ axis, ms: Number((await hud(7)).replace(/,/g, '')), wallMs: Date.now() - t0 });
    } catch { fails.push(`Levers: sapuan ${axis} tidak selesai dalam 15 s`); }
  }
  if ((await page.locator('.pol-badge').innerText()) !== 'Modified') fails.push('Levers: lencana tidak berubah ke "Modified"');
  const nox1 = await limitsNox();
  if (nox1 === nox0) fails.push(`Levers: tab Limits tidak mengikuti slider (NOx tetap ${nox0})`);
  const noxHud = await hud(0);
  await page.locator('.lev-sub .seg__btn').nth(1).click(); await page.waitForTimeout(200);
  const props0 = await page.locator('.lev-pane--fuel [data-v="props"]').innerText();
  await setRange('.lev-sliders--fuel .ctl--slider:nth-child(2) input', '10'); await page.waitForTimeout(400);
  if ((await page.locator('.lev-pane--fuel [data-v="props"]').innerText()) === props0) fails.push('Levers Fuel: sifat bahan bakar tidak berubah dengan komposisi');
  if ((await hud(0)) !== noxHud) fails.push('Levers Fuel: NOx berubah karena komposisi');
  await page.locator('.lev-sub .seg__btn').nth(0).click();
  await page.locator('.pol-head__state .btn').click(); await page.waitForTimeout(600);
  if ((await page.locator('.pol-badge').innerText()) !== 'Preset') fails.push('Levers: Reset to preset tidak mengembalikan lencana "Preset"');
  return { fails, times };
}

/** Ekspor PNG (S) di setiap tab Scene 9: unduhan .png muncul. */
async function snapshotPerTab(page) {
  const fails = [];
  await goScene(page, 9, 600);
  for (const tab of TABS[9]) {
    await page.keyboard.press(tab); await page.waitForTimeout(500);
    await page.evaluate(() => document.activeElement?.blur?.());
    try {
      const [dl] = await Promise.all([page.waitForEvent('download', { timeout: 30000 }), page.keyboard.press('s')]);
      if (!/\.png$/.test(dl.suggestedFilename())) fails.push(`PNG tab ${tab}: nama berkas ${dl.suggestedFilename()}`);
    } catch { fails.push(`PNG tab ${tab}: ekspor S tidak menghasilkan unduhan`); }
    await page.waitForTimeout(400);
  }
  return fails;
}

/** Pojok kiri-atas PNG (piksel 0,0) tanpa dependensi: IHDR + IDAT → inflate; piksel pertama tidak terpengaruh filter. */
function pngCornerLum(buf) {
  let off = 8, w = 0, colorType = 6; const idat = [];
  while (off < buf.length) {
    const len = buf.readUInt32BE(off), type = buf.toString('ascii', off + 4, off + 8), data = buf.subarray(off + 8, off + 8 + len);
    if (type === 'IHDR') { w = data.readUInt32BE(0); colorType = data[9]; }
    if (type === 'IDAT') idat.push(data);
    off += 12 + len;
  }
  const raw = inflateSync(Buffer.concat(idat));
  const [r, g, b] = [raw[1], raw[2], raw[3]];
  void w; void colorType;
  return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
}

/**
 * Bagian B: tema terang. Sakelar di header (urutan, aria), tersimpan di etel:theme dan bertahan setelah muat ulang;
 * semua scene + tab Scene 9 tanpa grafik kosong / teks meluber di tema terang; latar viewport varian A; kotak overlay
 * kaca tembus pandang + blur; token grafik
 * ikut tema (skema di atas viewport ikut tone viewport); halaman penuh berlatar terang; PNG (S) mengikuti tema aktif.
 */
async function themeInteraction(browser, url) {
  const fails = [];
  const p = await browser.newPage({ viewport: { width: 1366, height: 768 }, acceptDownloads: true });
  const errs = [];
  p.on('pageerror', (e) => errs.push(e.message));
  p.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
  const base = url.replace(/#.*$/, '');
  await p.goto(`${base}#/scene/1`);
  await p.waitForFunction(() => window.__etelDebug?.scene() === 1 && !window.__etelDebug.loading(), null, { timeout: 30000 });
  const png = async (label) => {
    await p.evaluate(() => document.activeElement?.blur?.());
    try {
      const [dl] = await Promise.all([p.waitForEvent('download', { timeout: 30000 }), p.keyboard.press('s')]);
      const path = await dl.path();
      return pngCornerLum(readFileSync(path));
    } catch (e) { fails.push(`tema: PNG ${label} gagal (${e.message.slice(0, 60)})`); return null; }
  };
  const st0 = await p.evaluate(() => ({
    theme: document.documentElement.dataset.theme,
    order: [...document.querySelector('.topbar__right').children].filter((el) => !el.matches('.calib-flag, .quality-flag')).map((el) => el.className.split(' ').find((c) => /present-exit|lang-slot|theme-switch/.test(c)) ?? el.id),
    pressed: [...document.querySelectorAll('.theme-switch:not(.lang-switch) .theme-switch__btn')].map((b) => `${b.dataset.theme}:${b.getAttribute('aria-checked')}`).join(','),
  }));
  if (st0.theme !== 'dark') fails.push(`tema: tanpa pilihan tersimpan harus Dark (dapat ${st0.theme})`);
  if (st0.order.join('|') !== 'present-exit|lang-slot|theme-switch|model-badge') fails.push(`tema: urutan header kanan ${st0.order.join(' | ')}`);
  if (st0.pressed !== 'dark:true,light:false') fails.push(`tema: aria-checked awal ${st0.pressed}`);
  const darkPng = await png('Dark');
  if (darkPng != null && darkPng > 0.15) fails.push(`tema: PNG Dark terlalu terang (luminans pojok ${darkPng.toFixed(2)})`);

  await p.click('.theme-switch__btn[data-theme="light"]');
  await p.waitForTimeout(300);
  await p.reload();
  await p.waitForFunction(() => window.__etelDebug?.scene() === 1 && !window.__etelDebug.loading(), null, { timeout: 30000 });
  const st1 = await p.evaluate(() => ({ theme: document.documentElement.dataset.theme, stored: localStorage.getItem('etel:theme'), pressed: document.querySelector('.theme-switch:not(.lang-switch) .theme-switch__btn.is-on')?.dataset.theme }));
  if (st1.theme !== 'light' || st1.stored !== 'light' || st1.pressed !== 'light') fails.push(`tema: Light tidak bertahan setelah muat ulang (${JSON.stringify(st1)})`);

  for (let n = 1; n <= 11; n++) {
    await goScene(p, n, 400);
    for (const tab of TABS[n] ?? [null]) {
      if (tab) { await p.keyboard.press(tab); await p.waitForTimeout(300); }
      let res = null;
      for (let t = 0; t <= TIMEOUT_MS; t += POLL_MS) { res = await p.evaluate(inspect, { minFill: MIN_FILL_PCT }); if (res.charts.every((c) => c.ok)) break; await p.waitForTimeout(POLL_MS); }
      const label = `Light 1366×768 · Scene ${n}${tab ? ` · tab ${tab}` : ''}`;
      report.push({ label, charts: res.charts.map((c) => c.pct), overflow: res.overflow.length });
      for (const c of res.charts) if (!c.ok) fails.push(`${label}: grafik #${c.i} "${c.title}" kosong (terisi ${c.pct} %)`);
      for (const o of res.overflow) fails.push(`${label}: teks meluber di ${o.el}: ${o.reasons[0]}`);
      if (res.hscroll) fails.push(`${label}: scroll horizontal`);
      // viewport 3D tema terang = varian A (abu-krem terang): warna gradasi latar berluminans terkode gamma 0,68–0,90
      // (#c2bcae ≈ 0,74 … #d8d3c6 ≈ 0,83). Kotak di atas viewport: tidak ada latar opak putih (alpha > 0,6 dan terang),
      // dan setiap kotak berlatar memakai backdrop-filter blur (panel Calibration yang di-dock dikecualikan).
      const vp = await p.evaluate(() => {
        const v = [...document.querySelectorAll('.scene__view, .cyc-view, .fl-view, .gt-view, .pl-view:not(.pol-card):not(.pol-levers)')].find((x) => x.checkVisibility());
        if (!v) return null;
        const rgba = (c) => { const m = (c.match(/[\d.]+/g) ?? []).map(Number); return { l: (0.2126 * m[0] + 0.7152 * m[1] + 0.0722 * m[2]) / 255, a: m.length > 3 ? m[3] : 1 }; };
        const lums = (getComputedStyle(v).backgroundImage.match(/rgba?\([^)]+\)/g) ?? []).map((c) => rgba(c).l);
        const boxes = [];
        for (const el of v.querySelectorAll('*')) {
          if (el.closest('.cal-panel, canvas') || !el.checkVisibility()) continue;
          const cs = getComputedStyle(el), r = el.getBoundingClientRect();
          if (!cs.backgroundColor || cs.backgroundColor === 'rgba(0, 0, 0, 0)' || r.width < 24 || r.height < 14) continue;
          const c = rgba(cs.backgroundColor);
          const name = `${el.tagName.toLowerCase()}.${String(el.className).trim().split(/\s+/)[0]}`;
          if (c.a > 0.6 && c.l > 0.5) boxes.push(`${name}: latar opak terang ${cs.backgroundColor}`);
          else if (!/blur\(/.test(cs.backdropFilter)) boxes.push(`${name}: tanpa backdrop-filter blur`);
        }
        return { lums, boxes };
      });
      if (vp && (!vp.lums.length || vp.lums.some((l) => l < 0.68 || l > 0.9))) fails.push(`${label}: latar viewport bukan varian A (luminans ${vp.lums.map((l) => l.toFixed(2)).join(', ')})`);
      for (const b of vp?.boxes ?? []) fails.push(`${label}: ${b}`);
    }
  }
  // token grafik: panel ikut tema; skema Brayton di atas viewport terang (.vp-scope) juga memakai token terang
  await goScene(p, 2, 300);
  const tok = await p.evaluate(() => ({ chart: getComputedStyle(document.querySelector('.cyc-pv .chart')).getPropertyValue('--c-text').trim(), vp: getComputedStyle(document.querySelector('.vp-scope')).getPropertyValue('--c-text').trim() }));
  if (tok.chart !== '#4f4a41' || tok.vp !== '#4f4a41') fails.push(`tema: token grafik ${JSON.stringify(tok)}`);
  const lightPng = await png('Light');
  if (lightPng != null && lightPng < 0.6) fails.push(`tema: PNG Light tidak mengikuti tema (luminans pojok ${lightPng.toFixed(2)})`);
  // halaman penuh berlatar terang
  for (const page of ['regulations', 'formation', 'references', 'glossary', 'assumptions']) {
    await p.goto(`${base}#/${page}`);
    await p.waitForFunction((pg) => window.__etelDebug?.page() === pg, page, { timeout: 30000 });
    await p.waitForTimeout(300);
    const bg = await p.evaluate(() => { const b = document.querySelector('.refs:not([hidden]) .refs__box, .asm:not([hidden]) .asm__box'); return b ? getComputedStyle(b).backgroundColor : null; });
    if (bg !== 'rgb(246, 241, 230)') fails.push(`tema: halaman ${page} berlatar ${bg}`);
  }
  for (const e of [...new Set(errs)]) fails.push(`tema: galat ${e}`);
  await p.close();
  return fails;
}

/**
 * M11 Step 01: landing (#/ dan tanpa hash), About, sakelar EN/ID, kualitas adaptif hero, Present tanpa hash → Scene 1,
 * dan landing minimal bila learn.json gagal dimuat. Screenshot landing di tiga resolusi (Dark dan Light).
 */
async function landingInteraction(browser, url) {
  const fails = [];
  const base = url.replace(/#.*$/, '');
  const benign = (t) => /Failed to load resource|net::ERR_/.test(t);
  const open = async (opts = {}, init = null) => {
    const p = await browser.newPage({ viewport: { width: 1366, height: 768 }, ...opts });
    const errs = [];
    p.on('pageerror', (e) => errs.push(`pageerror: ${e.message}`));
    p.on('console', (m) => { if (m.type() === 'error' && !benign(m.text())) errs.push(`console: ${m.text()}`); });
    if (init) await p.addInitScript(init.fn, init.arg);
    return { p, errs };
  };
  const heroPixels = (p) => p.evaluate(() => {
    const c = document.querySelector('.landing__stage canvas');
    if (!c || !c.width) return 0;
    const t = document.createElement('canvas'); t.width = 120; t.height = 80;
    const ctx = t.getContext('2d'); ctx.drawImage(c, 0, 0, 120, 80);
    const d = ctx.getImageData(0, 0, 120, 80).data; let n = 0;
    for (let i = 3; i < d.length; i += 4) if (d[i] > 0) n++;
    return 100 * n / (120 * 80);
  });

  // 1) alamat tanpa hash → landing; kunjungan pertama = bahasa default learn.json (id); empat kartu; hero tidak kosong
  {
    const { p, errs } = await open();
    await p.goto(base);
    await p.waitForFunction(() => window.__etelDebug?.learnView?.() === 'landing' && document.querySelectorAll('.lcard').length === 4, null, { timeout: 30000 });
    const st = await p.evaluate(() => ({ lang: window.__etelDebug.lang(), hostLang: document.querySelector('.learn-host')?.lang, scene: window.__etelDebug.scene(), cards: [...document.querySelectorAll('.lcard')].filter((c) => c.checkVisibility() && c.getBoundingClientRect().right <= innerWidth + 1).length, hscroll: document.documentElement.scrollWidth > innerWidth + 1, tag: document.getElementById('scene-tag').textContent, card0: document.querySelector('.lcard__title')?.textContent }));
    if (st.lang !== 'id' || st.hostLang !== 'id') fails.push(`landing: bahasa kunjungan pertama ${st.lang}/${st.hostLang} (harusnya id dari learn.defaultLang)`);
    if (st.cards !== 4) fails.push(`landing: ${st.cards} kartu terlihat (harusnya 4)`);
    if (st.scene !== null) fails.push(`landing: scene ${st.scene} sudah dipasang di belakang landing`);
    if (st.hscroll) fails.push('landing: scroll horizontal');
    try { await p.waitForFunction(() => window.__etelDebug.hero()?.ready, null, { timeout: 20000 }); } catch { fails.push('landing: hero 3D tidak siap'); }
    await p.waitForTimeout(800);
    const px = await heroPixels(p);
    if (!(px > 1)) fails.push(`landing: canvas hero kosong (${px.toFixed(2)} % piksel terisi)`);
    // EN ↔ ID mengganti teks; pilihan diingat (etel:lang) setelah muat ulang
    await p.click('.lang-switch [data-lang="en"]');
    await p.waitForTimeout(200);
    const en = await p.evaluate(() => ({ card0: document.querySelector('.lcard__title')?.textContent, stored: localStorage.getItem('etel:lang'), lang: document.querySelector('.learn-host').lang }));
    if (en.card0 === st.card0 || en.lang !== 'en' || en.stored !== 'en') fails.push(`landing: sakelar EN tidak mengganti teks (${st.card0} → ${en.card0}, lang ${en.lang}, tersimpan ${en.stored})`);
    await p.reload();
    await p.waitForFunction(() => window.__etelDebug?.learnView?.() === 'landing' && document.querySelectorAll('.lcard').length === 4, null, { timeout: 30000 });
    if (await p.evaluate(() => window.__etelDebug.lang()) !== 'en') fails.push('landing: pilihan EN tidak diingat setelah muat ulang');
    // kualitas adaptif: Low = tanpa bloom, partikel dikurangi; High = partikel penuh
    await p.waitForFunction(() => window.__etelDebug.hero()?.ready, null, { timeout: 20000 }).catch(() => {});
    // (rendering software bisa > 1 s per frame pada tier penuh: tunggu sampai frame berikutnya selesai)
    await p.evaluate(() => window.__etelDebug.setQuality('high'));
    await p.waitForFunction(() => window.__etelDebug.hero()?.particles > 0 && window.__etelDebug.quality().tier === 0, null, { timeout: 15000 }).catch(() => {});
    await p.waitForTimeout(1500);
    const high = await p.evaluate(() => window.__etelDebug.hero());
    await p.evaluate(() => window.__etelDebug.setQuality('low'));
    await p.waitForFunction((n) => window.__etelDebug.hero()?.particles < n, high?.particles ?? 0, { timeout: 15000 }).catch(() => {});
    const low = await p.evaluate(() => window.__etelDebug.hero());
    await p.evaluate(() => window.__etelDebug.setQuality('auto'));
    if (!low || low.bloom !== false || !(low.particles < high?.particles)) fails.push(`landing: kualitas Low tidak dipatuhi hero (low ${JSON.stringify(low)}, high ${JSON.stringify(high)})`);
    // About terbuka dari kartu
    await p.click('.lcard[data-card="about"]');
    await p.waitForFunction(() => window.__etelDebug.learnView() === 'about', null, { timeout: 10000 }).catch(() => fails.push('landing: kartu About tidak membuka #/about'));
    const ab = await p.evaluate(() => ({ title: document.querySelector('.reading__title')?.textContent ?? '', secs: document.querySelectorAll('.reading__sec').length, hash: location.hash }));
    if (!ab.title || ab.secs !== 6 || ab.hash !== '#/about') fails.push(`about: ${JSON.stringify(ab)}`);
    // kartu Explore → Scene 1, landing tertutup
    await p.goto(`${base}#/`);
    await p.waitForFunction(() => window.__etelDebug.learnView() === 'landing', null, { timeout: 10000 });
    await p.click('.lcard[data-card="explore"]');
    await p.waitForFunction(() => window.__etelDebug.scene() === 1 && window.__etelDebug.learnView() === null, null, { timeout: 30000 }).catch(() => fails.push('landing: kartu Explore tidak membuka Scene 1'));
    for (const e of [...new Set(errs)]) fails.push(`landing: ${e}`);
    await p.close();
  }
  // 2) mode Present + alamat tanpa hash → Scene 1 (bukan landing)
  {
    const { p, errs } = await open({}, { fn: () => { try { localStorage.setItem('etel:mode', 'present'); } catch {} }, arg: null });
    await p.goto(base);
    await p.waitForFunction(() => window.__etelDebug?.scene() === 1, null, { timeout: 30000 }).catch(() => {});
    const st = await p.evaluate(() => ({ scene: window.__etelDebug.scene(), view: window.__etelDebug.learnView(), mode: window.__etelDebug.mode() }));
    if (st.scene !== 1 || st.view !== null || st.mode !== 'present') fails.push(`Present tanpa hash: ${JSON.stringify(st)} (harusnya Scene 1)`);
    for (const e of [...new Set(errs)]) fails.push(`Present tanpa hash: ${e}`);
    await p.close();
  }
  // 3) learn.json dan chunk fallback gagal dimuat → landing minimal English, tanpa layar kosong dan tanpa galat tak tertangani
  {
    const { p, errs } = await open();
    await p.route('**/content/learn.json', (r) => r.abort());
    await p.route(/assets\/learn-[^/]*\.js/, (r) => r.abort());
    await p.goto(base);
    await p.waitForFunction(() => document.querySelector('.landing__title'), null, { timeout: 30000 }).catch(() => {});
    const st = await p.evaluate(() => ({ title: document.querySelector('.landing__title')?.textContent ?? '', cards: [...document.querySelectorAll('.lcard')].map((c) => c.dataset.card), lang: window.__etelDebug?.lang() }));
    if (!st.title || st.cards.join(',') !== 'explore,present,about') fails.push(`landing minimal: ${JSON.stringify(st)}`);
    for (const e of [...new Set(errs)]) fails.push(`landing minimal: ${e}`);
    await p.close();
  }
  // 4) screenshot landing: tiga resolusi × dua tema
  for (const [w, h] of VIEWPORTS) for (const theme of ['dark', 'light']) {
    const { p, errs } = await open({ viewport: { width: w, height: h } }, { fn: (t) => { try { localStorage.setItem('etel:theme', t); } catch {} }, arg: theme });
    await p.goto(base);
    await p.waitForFunction(() => window.__etelDebug?.hero?.()?.ready && document.querySelectorAll('.lcard').length === 4, null, { timeout: 30000 }).catch(() => fails.push(`landing ${w}×${h} ${theme}: hero/kartu tidak siap`));
    await p.waitForTimeout(600);
    const hs = await p.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1);
    if (hs) fails.push(`landing ${w}×${h} ${theme}: scroll horizontal`);
    await p.screenshot({ path: `${SHOTS}/landing-${w}x${h}-${theme}.png` });
    for (const e of [...new Set(errs)]) fails.push(`landing ${w}×${h} ${theme}: ${e}`);
    await p.close();
  }
  return fails;
}

/**
 * M11 Step 02: daftar level, 21 halaman pelajaran, soal, progres (tersimpan, Reset di dalam halaman), kata → Glossary
 * dan sumber → References di atas pelajaran (Close/Esc kembali), Try it → pil "Back to lesson", Glossary dua bahasa,
 * alamat halaman langsung → Close ke landing, Learn di Present → Explore, panah di navigasi tidak memuat scene di
 * belakang halaman Learn, dan tata letak (tanpa scroll horizontal) di 3 resolusi × 2 tema. Satu halaman dipakai ulang
 * untuk semua alur 2D (tanpa 3D, cepat); hanya Try it memuat satu scene.
 */
async function learnInteraction(browser, url) {
  const fails = [];
  const base = url.replace(/#.*$/, '');
  const LEARN = JSON.parse(readFileSync('content/learn.json', 'utf8'));
  const ids = LEARN.levels.flatMap((l) => l.lessons.map((x) => x.id));
  const benign = (t) => /Failed to load resource|net::ERR_/.test(t);
  const open = async (opts = {}, init = null) => {
    const p = await browser.newPage({ viewport: { width: 1366, height: 768 }, ...opts });
    const errs = [];
    p.on('pageerror', (e) => errs.push(`pageerror: ${e.message}`));
    p.on('console', (m) => { if (m.type() === 'error' && !benign(m.text())) errs.push(`console: ${m.text()}`); });
    p.on('dialog', (d) => { errs.push(`dialog browser: ${d.message()}`); d.dismiss().catch(() => {}); });
    if (init) await p.addInitScript(init.fn, init.arg);
    return { p, errs };
  };
  const st = (p) => p.evaluate(() => ({ view: window.__etelDebug.learnView(), id: window.__etelDebug.learnViewId(), scene: window.__etelDebug.scene(), page: window.__etelDebug.page(), hash: location.hash, pill: window.__etelDebug.backPill(), mode: window.__etelDebug.mode(), glossary: window.__etelDebug.glossaryOpen(), lang: window.__etelDebug.lang() }));
  const go = async (p, hash) => { await p.evaluate((h) => { location.hash = h; }, hash); await p.waitForTimeout(120); };

  // 1) daftar level (kunjungan pertama = bahasa learn.defaultLang)
  const { p, errs } = await open();
  await p.goto(`${base}#/learn`);
  await p.waitForFunction(() => window.__etelDebug?.learnView?.() === 'learn' && document.querySelectorAll('.lvl').length === 6, null, { timeout: 30000 }).catch(() => fails.push('learn: daftar level tidak tampil'));
  const list = await p.evaluate(() => ({ lang: document.querySelector('.learn-host').lang, lessons: document.querySelectorAll('.lvl__link').length, banner: !!document.querySelector('.learn-page__draft'), cont: document.querySelector('.learn-page__continue')?.getAttribute('href'), resetDisabled: document.querySelector('.learn-page__reset button')?.disabled, cont0: document.querySelector('.learn-page__continue b')?.textContent, hs: document.documentElement.scrollWidth > innerWidth + 1 }));
  if (list.lang !== LEARN.defaultLang) fails.push(`learn: bahasa kunjungan pertama ${list.lang}`);
  if (list.lessons !== 21 || !list.banner || list.cont !== '#/learn/l0-1' || !list.resetDisabled || list.hs) fails.push(`learn: daftar ${JSON.stringify(list)}`);
  await p.click('.lang-switch [data-lang="en"]'); await p.waitForTimeout(200);
  if ((await p.evaluate(() => document.querySelector('.learn-page__continue b')?.textContent)) === list.cont0) fails.push('learn: sakelar EN tidak mengganti label');

  // 2) 21 pelajaran terbuka lewat alamat langsung, tanpa galat console, tanpa scroll horizontal
  for (const id of ids) {
    await go(p, `#/learn/${id}`);
    const r = await p.evaluate(() => ({ view: window.__etelDebug.learnView(), id: window.__etelDebug.learnViewId(), h: document.querySelector('.lesson-page h2')?.textContent ?? '', quiz: document.querySelectorAll('.quiz__q').length, tryit: !!document.querySelector('.tryit__go'), hs: document.documentElement.scrollWidth > innerWidth + 1, body: document.querySelectorAll('.lesson__p').length }));
    if (r.view !== 'learn' || r.id !== id || !r.h || !r.quiz || !r.tryit || !r.body || r.hs) fails.push(`pelajaran ${id}: ${JSON.stringify(r)}`);
  }
  await go(p, '#/learn/nope');
  if (!(await p.evaluate(() => !!document.querySelector('.reading__note')))) fails.push('pelajaran tak dikenal: tanpa pesan');

  // 3) soal: langsung benar/salah + alasan, tanpa skor tersimpan; baris isi ≥ 17 px
  await go(p, '#/learn/l3-4');
  const keysBefore = await p.evaluate(() => Object.keys(localStorage).sort().join(','));
  const q0 = LEARN.levels[3].lessons[3].checks[0];
  await p.locator('.quiz__q').first().locator('.quiz__opt').nth(q0.answer).click();
  const right = await p.evaluate(() => document.querySelector('.quiz__fb')?.textContent ?? '');
  const wrongIdx = q0.options.findIndex((_, i) => i !== q0.answer);
  await p.locator('.quiz__q').first().locator('.quiz__opt').nth(wrongIdx).click();
  const wrong = await p.evaluate(() => ({ t: document.querySelector('.quiz__fb')?.textContent ?? '', w: !!document.querySelector('.quiz__opt.is-wrong'), fs: parseFloat(getComputedStyle(document.querySelector('.lesson__p')).fontSize), width: Math.round(document.querySelector('.lesson__p').getBoundingClientRect().width) }));
  if (!/✓/.test(right) || !/✗/.test(wrong.t) || !wrong.w || !/Why|Mengapa/.test(right)) fails.push(`soal: umpan balik ${JSON.stringify({ right, wrong })}`);
  if (wrong.fs < 17) fails.push(`pelajaran: ukuran huruf isi ${wrong.fs} px < 17`);
  if ((await p.evaluate(() => Object.keys(localStorage).sort().join(','))) !== keysBefore) fails.push('soal: menyimpan sesuatu di localStorage');

  // 4) progres: tandai → muat ulang → tersimpan; Reset di dalam halaman (konfirmasi, bukan dialog browser)
  await p.click('.lesson__done');
  if ((await p.evaluate(() => localStorage.getItem('etel:learnDone'))) !== '["l3-4"]') fails.push('progres: etel:learnDone tidak tersimpan');
  await p.reload();
  await p.waitForFunction(() => window.__etelDebug?.learnView?.() === 'learn', null, { timeout: 30000 });
  await go(p, '#/learn');
  const prog = await p.evaluate(() => ({ done: document.querySelectorAll('.lvl__lesson.is-done').length, stats: document.querySelector('.learn-page__stats')?.textContent ?? '', cont: document.querySelector('.learn-page__continue')?.getAttribute('href') }));
  if (prog.done !== 1 || !/1/.test(prog.stats) || prog.cont !== '#/learn/l0-1') fails.push(`progres: setelah muat ulang ${JSON.stringify(prog)}`);
  await p.click('.learn-page__reset button');
  const ask = await p.evaluate(() => ({ yes: !!document.querySelector('.learn-page__reset-yes'), group: !!document.querySelector('.learn-page__reset[role="group"]') }));
  if (!ask.yes || !ask.group) fails.push('reset: tanpa konfirmasi di dalam halaman');
  await p.locator('.learn-page__reset button').last().click(); // Cancel
  if ((await p.evaluate(() => localStorage.getItem('etel:learnDone'))) !== '["l3-4"]') fails.push('reset: Cancel menghapus progres');
  await p.click('.learn-page__reset button'); await p.click('.learn-page__reset-yes'); await p.waitForTimeout(150);
  const after = await p.evaluate(() => ({ stored: localStorage.getItem('etel:learnDone'), done: document.querySelectorAll('.lvl__lesson.is-done').length, status: document.querySelector('.learn-page__status')?.textContent ?? '' }));
  if (after.stored !== null || after.done !== 0 || !after.status) fails.push(`reset: ${JSON.stringify(after)}`);

  // 5) kata → Glossary dan sumber → References dibuka DI ATAS pelajaran; Esc kembali ke pelajaran yang sama
  await go(p, '#/learn/l3-4');
  await p.locator('.wordbox__link').first().click(); await p.waitForTimeout(300);
  let s = await st(p);
  const hl = await p.evaluate(() => ({ target: !!document.querySelector('.gl__item.is-target, .gl__item--basic.is-target'), box: document.querySelector('.refs--glossary .refs__box')?.scrollTop }));
  if (!s.glossary || s.page !== 'glossary' || !hl.target) fails.push(`kata → Glossary: ${JSON.stringify({ s, hl })}`);
  await p.keyboard.press('Escape'); await p.waitForTimeout(250);
  s = await st(p);
  if (s.page === 'glossary' || s.hash !== '#/learn/l3-4' || s.id !== 'l3-4') fails.push(`Glossary Esc: ${JSON.stringify(s)} (harusnya kembali ke #/learn/l3-4)`);
  await p.locator('.srcs__refs').first().click(); await p.waitForTimeout(300);
  s = await st(p);
  if (s.page !== 'references') fails.push(`sumber → References: ${JSON.stringify(s)}`);
  await p.keyboard.press('Escape'); await p.waitForTimeout(250);
  s = await st(p);
  if (s.page === 'references' || s.hash !== '#/learn/l3-4') fails.push(`References Esc: ${JSON.stringify(s)}`);
  // tautan sumber luar dibuka di tab baru
  const ext = await p.evaluate(() => [...document.querySelectorAll('.srcs__url')].map((a) => `${a.target}|${a.rel}`));
  if (ext.some((x) => x !== '_blank|noopener noreferrer')) fails.push(`sumber: tautan luar tidak aman ${ext}`);

  // 6) panah ←/→ saat fokus di navigasi tidak memuat scene di belakang halaman Learn
  await p.locator('.nav [data-scene="3"]').focus();
  await p.keyboard.press('ArrowRight'); await p.waitForTimeout(700);
  s = await st(p);
  if (s.scene !== null || s.view !== 'learn') fails.push(`panah di navigasi saat Learn terbuka: ${JSON.stringify(s)}`);

  // 7) Try it → scene → pil "Back to lesson" (header kiri di bawah tag scene) → kembali ke pelajaran yang sama
  await go(p, '#/learn/l3-4');
  await p.click('.tryit__go');
  await p.waitForFunction(() => window.__etelDebug.scene() === 6 && !window.__etelDebug.loading(), null, { timeout: 30000 }).catch(() => fails.push('Try it: Scene 6 tidak terbuka'));
  await p.waitForTimeout(400);
  const pill = await p.evaluate(() => {
    const el = document.querySelector('.back-pill'), tag = document.getElementById('scene-tag'), chip = document.querySelector('.f-toggle');
    const r = el?.getBoundingClientRect(), t = tag.getBoundingClientRect(), c = chip?.getBoundingClientRect(), x = document.querySelector('.present-exit')?.getBoundingClientRect();
    const hit = (a, b) => !!a && !!b && a.width > 0 && b.width > 0 && a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
    return { vis: !!el && !el.hidden && r.width > 0, below: r ? r.top >= t.bottom - 1 : false, inLeft: r ? r.left >= document.querySelector('.topbar__left').getBoundingClientRect().left - 1 && r.right <= document.querySelector('.topbar__left').getBoundingClientRect().right + 1 : false, overlapChip: hit(r, c), overlapExit: hit(r, x), href: el?.getAttribute('href'), txt: el?.textContent, topbarH: Math.round(document.querySelector('.topbar').getBoundingClientRect().height) };
  });
  if (!pill.vis || pill.href !== '#/learn/l3-4' || !pill.below || !pill.inLeft || pill.overlapChip || pill.overlapExit) fails.push(`Back to lesson: ${JSON.stringify(pill)}`);
  if (pill.topbarH > MAX_TOPBAR_PX) fails.push(`Back to lesson: bilah atas ${pill.topbarH} px > ${MAX_TOPBAR_PX}`);
  await p.click('.back-pill'); await p.waitForTimeout(250);
  s = await st(p);
  if (s.hash !== '#/learn/l3-4' || s.view !== 'learn' || s.id !== 'l3-4' || s.pill !== null) fails.push(`Back to lesson → ${JSON.stringify(s)}`);
  // pil hilang di Present dan saat pindah scene
  await p.click('.tryit__go');
  await p.waitForFunction(() => window.__etelDebug.scene() === 6 && window.__etelDebug.backPill(), null, { timeout: 15000 }).catch(() => fails.push('Try it (kedua): pil tidak muncul'));
  await p.evaluate(() => document.activeElement?.blur?.());
  await p.keyboard.press('m'); await p.waitForTimeout(250);
  if ((await st(p)).pill !== null) fails.push('Back to lesson masih tampil di Present');
  await p.keyboard.press('m'); await p.waitForTimeout(250);
  await p.locator('.nav [data-scene="2"]').click();
  await p.waitForFunction(() => window.__etelDebug.scene() === 2 && !window.__etelDebug.loading(), null, { timeout: 30000 }).catch(() => {});
  if ((await st(p)).pill !== null) fails.push('Back to lesson masih tampil setelah pindah scene');

  // 8) Glossary dua bahasa: Basic words + definisi ID dari learn.glossaryId; EN tidak berubah
  await go(p, '#/glossary'); await p.waitForTimeout(300);
  const gl = (lang) => p.evaluate(() => ({ basic: document.querySelectorAll('.gl__item--basic').length, from: document.querySelector('.gl__item--basic .bcard__chip')?.textContent ?? '', first: document.querySelector('.gl__item:not(.gl__item--basic) .gl__def')?.textContent ?? '', id: document.querySelector('.gl__item:not(.gl__item--basic)')?.id ?? '', hs: document.documentElement.scrollWidth > innerWidth + 1 }));
  await p.click('.refs--glossary .lang-switch [data-lang="id"]'); await p.waitForTimeout(300); // header tertutup halaman: sakelar ada di kepala Glossary
  const gid = await gl('id');
  const gtermId = gid.id.replace(/^term-/, '');
  if (gid.basic !== LEARN.terms.length || gid.from !== 'dari Learn' || gid.first !== LEARN.glossaryId[gtermId].definition) fails.push(`Glossary ID: ${JSON.stringify({ ...gid, want: LEARN.glossaryId[gtermId]?.definition?.slice(0, 40) })}`);
  await p.click('.refs--glossary .lang-switch [data-lang="en"]'); await p.waitForTimeout(300);
  const gen = await gl('en');
  if (gen.from !== 'from Learn' || gen.first === gid.first) fails.push(`Glossary EN: ${JSON.stringify(gen)}`);
  await p.keyboard.press('Escape'); await p.waitForTimeout(200);
  for (const e of [...new Set(errs)]) fails.push(`learn: ${e}`);

  // 9) tata letak: tanpa scroll horizontal di 3 resolusi × 2 tema; screenshot daftar dan pelajaran
  for (const [w, h, theme] of [[1366, 768, 'dark'], [1920, 1080, 'dark'], [1280, 720, 'dark'], [1366, 768, 'light'], [1920, 1080, 'light'], [1280, 720, 'light']]) {
    await p.setViewportSize({ width: w, height: h });
    await p.evaluate((t) => { document.documentElement.dataset.theme = t; }, theme);
    for (const [name, hash] of [['learn', '#/learn'], ['lesson', '#/learn/l3-4']]) {
      await go(p, hash); await p.waitForTimeout(150);
      const hs = await p.evaluate(() => ({ page: document.documentElement.scrollWidth > innerWidth + 1, host: document.querySelector('.learn-host').scrollWidth > document.querySelector('.learn-host').clientWidth + 1 }));
      if (hs.page || hs.host) fails.push(`${name} ${w}×${h} ${theme}: scroll horizontal ${JSON.stringify(hs)}`);
      if (theme === 'dark' || w === 1366) await p.screenshot({ path: `${SHOTS}/${name}-${w}x${h}-${theme}.png` });
    }
  }
  await p.close();

  // 10) alamat halaman langsung → Close / Esc kembali ke landing (tidak buntu); Learn di Present → Explore
  {
    const { p: q, errs: e2 } = await open();
    await q.goto(`${base}#/regulations`);
    await q.waitForFunction(() => window.__etelDebug?.page?.() === 'regulations', null, { timeout: 30000 }).catch(() => fails.push('alamat halaman langsung: tidak terbuka'));
    await q.keyboard.press('Escape'); await q.waitForTimeout(300);
    const a = await st(q);
    if (a.page !== 'landing' || a.hash !== '#/' || a.view !== 'landing') fails.push(`halaman langsung → Esc: ${JSON.stringify(a)} (harusnya landing)`);
    for (const e of [...new Set(e2)]) fails.push(`halaman langsung: ${e}`);
    await q.close();
  }
  {
    const { p: q, errs: e3 } = await open({}, { fn: () => { try { localStorage.setItem('etel:mode', 'present'); } catch {} }, arg: null });
    await q.goto(`${base}#/learn/l2-1`);
    await q.waitForFunction(() => window.__etelDebug?.learnView?.() === 'learn', null, { timeout: 30000 }).catch(() => {});
    const a = await st(q);
    const navShown = await q.evaluate(() => !document.querySelector('.nav')?.hidden);
    if (a.mode !== 'explore' || !navShown || a.id !== 'l2-1') fails.push(`Learn di Present: ${JSON.stringify({ ...a, navShown })} (harusnya Explore)`);
    for (const e of [...new Set(e3)]) fails.push(`Learn di Present: ${e}`);
    await q.close();
  }
  return fails;
}

/** Deep link (M9 Step 06): alamat → keadaan yang diharapkan. Setiap alamat dibuka di halaman (konteks) baru. */
const DEEP_LINKS = [
  ['#/scene/1', { scene: 1 }], ['#/scene/6', { scene: 6 }], ['#/scene/9/limits', { scene: 9, tab: 'limits' }], ['#/scene/9/formation', { scene: 9, tab: 'formation' }],
  ['#/scene/9/levers', { scene: 9, tab: 'levers' }], ['#/scene/9/load-window', { scene: 9, tab: 'C' }], ['#/scene/9/ghg', { scene: 9, tab: 'B' }],
  ['#/regulations', { page: 'regulations' }], ['#/formation', { page: 'formation' }], ['#/references', { page: 'references' }],
  ['#/references/ipcc-ar6-wg1-ch7', { page: 'references', target: true }], ['#/glossary', { page: 'glossary' }], ['#/assumptions', { page: 'assumptions' }],
];
async function deepLinks(browser, url) {
  const fails = [];
  const base = url.replace(/#.*$/, '');
  for (const [hash, want] of DEEP_LINKS) {
    const p = await browser.newPage({ viewport: { width: 1366, height: 768 } });
    const errs = [];
    p.on('pageerror', (e) => errs.push(e.message));
    p.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
    await p.goto(`${base}${hash}`);
    await p.waitForFunction(() => (window.__etelDebug?.scene() != null || window.__etelDebug?.page?.() != null) && !window.__etelDebug.loading(), null, { timeout: 30000 });
    await p.waitForTimeout(600);
    const st = await p.evaluate(() => ({ scene: window.__etelDebug.scene(), page: window.__etelDebug.page(), paused: window.__etelDebug.paused(), mode: window.__etelDebug.mode(), hash: location.hash, tab: document.querySelector('.scene--policy')?.dataset.tab ?? null, nav: !document.querySelector('.nav')?.hidden }));
    if (st.mode !== 'explore' || !st.nav) fails.push(`${hash}: bukan mode Explore dengan navigasi (mode ${st.mode})`);
    if (want.scene) {
      if (st.scene !== want.scene) fails.push(`${hash}: scene ${st.scene} (harusnya ${want.scene})`);
      if (want.tab && st.tab !== want.tab) fails.push(`${hash}: tab ${st.tab} (harusnya ${want.tab})`);
      if (st.hash !== hash) fails.push(`${hash}: alamat berubah jadi ${st.hash}`);
      let res = null;
      for (let t = 0; t <= TIMEOUT_MS; t += POLL_MS) { res = await p.evaluate(inspect, { minFill: MIN_FILL_PCT }); if (res.charts.every((c) => c.ok)) break; await p.waitForTimeout(POLL_MS); }
      for (const c of res.charts) if (!c.ok) fails.push(`${hash}: grafik "${c.title}" kosong (terisi ${c.pct} %)`);
      if (res.hscroll) fails.push(`${hash}: scroll horizontal`);
    } else {
      if (st.page !== want.page) fails.push(`${hash}: halaman ${st.page} (harusnya ${want.page})`);
      if (!st.paused) fails.push(`${hash}: loop render tidak berhenti saat halaman penuh terbuka`);
      if (want.target && (await p.locator('.refs__item.is-target').count()) !== 1) fails.push(`${hash}: sumber tujuan tidak disorot`);
      await p.keyboard.press('Escape'); await p.waitForTimeout(300);
      const after = await p.evaluate(() => ({ page: window.__etelDebug.page(), paused: window.__etelDebug.paused(), hash: location.hash }));
      if (after.page !== 'landing') fails.push(`${hash}: Esc tidak menutup halaman (halaman ${after.page})`);
      // M11 Step 02: halaman yang dibuka langsung lewat alamat → Close kembali ke landing (tidak buntu)
      if (after.hash !== '#/') fails.push(`${hash}: setelah ditutup alamat ${after.hash} (harusnya #/ = landing)`);
    }
    for (const e of [...new Set(errs)]) fails.push(`${hash}: galat ${e}`);
    await p.close();
  }
  return fails;
}

/** Explore / Present (M9 Step 06): panah, petunjuk "M: Explore", dan jendela presenter ikut saat scene berganti. */
async function modeInteraction(page) {
  const fails = [];
  const scene = () => page.evaluate(() => window.__etelDebug.scene());
  const waitScene = (n) => page.waitForFunction((x) => window.__etelDebug.scene() === x && !window.__etelDebug.loading(), n, { timeout: 15000 }).then(() => true, () => false);
  await goScene(page, 3, 500);
  await page.evaluate(() => document.activeElement?.blur?.());
  await page.keyboard.press('ArrowRight'); await page.waitForTimeout(700);
  if ((await scene()) !== 3) fails.push('Explore: panah mengganti scene padahal fokus tidak di navigasi');
  await page.locator('.nav [data-scene="3"]').focus();
  await page.keyboard.press('ArrowRight');
  if (!(await waitScene(4))) fails.push('Explore: panah di navigasi tidak mengganti scene');
  await page.waitForTimeout(300);
  if ((await page.evaluate(() => location.hash)) !== '#/scene/4') fails.push('Explore: alamat tidak mengikuti scene');
  if (!(await page.evaluate(() => document.activeElement?.dataset?.scene === '4'))) fails.push('Explore: fokus tidak ikut ke scene baru di navigasi');
  await page.keyboard.press('m'); await page.waitForTimeout(300);
  const pr = await page.evaluate(() => ({ mode: window.__etelDebug.mode(), nav: !!document.querySelector('.nav')?.hidden, hint: document.getElementById('mode-hint')?.textContent, on: document.getElementById('mode-hint')?.classList.contains('is-on') }));
  if (pr.mode !== 'present' || !pr.nav) fails.push('Present: navigasi tidak tersembunyi');
  if (pr.hint !== 'M: Explore' || !pr.on) fails.push('Present: petunjuk "M: Explore" tidak tampil');
  const exitVisible = await page.locator('.present-exit').isVisible();
  if (!exitVisible) fails.push('Present: tombol "Explore (M)" tidak terlihat');
  else {
    // tombol terbaca: teks tidak terpotong dan kontras dari token tema
    const ok = await page.evaluate(() => { const b = document.querySelector('.present-exit'); return b.scrollWidth <= b.clientWidth + 1 && /Explore/.test(b.textContent); });
    if (!ok) fails.push('Present: tombol "Explore (M)" terpotong');
  }
  if (!(await page.locator('.f-toggle').first().isVisible().catch(() => false)) && [1, 2, 3, 4, 7].includes(await scene())) fails.push('Present: chip rumus tidak tampil');
  await page.keyboard.press('ArrowRight');
  if (!(await waitScene(5))) fails.push('Present: panah tidak mengganti scene');
  // jendela presenter (BroadcastChannel) ikut berpindah: lewat panah dan lewat alamat #/scene/N
  let popup = null;
  try {
    [popup] = await Promise.all([page.waitForEvent('popup', { timeout: 15000 }), page.keyboard.press('p')]);
    await popup.waitForLoadState();
    const popScene = (n) => popup.waitForFunction((x) => new RegExp(`Scene ${x}\\b`).test(document.querySelector('[data-v="current"]')?.textContent ?? ''), n, { timeout: 15000 }).then(() => true, () => false);
    if (!(await popScene(5))) fails.push('Presenter: jendela presenter tidak menampilkan scene aktif');
    await page.bringToFront();
    await page.keyboard.press('ArrowRight');
    await waitScene(6);
    if (!(await popScene(6))) fails.push('Presenter: jendela presenter tidak ikut saat scene berganti di Present');
    await page.evaluate(() => { location.hash = '#/scene/8'; });
    await waitScene(8);
    if (!(await popScene(8))) fails.push('Presenter: jendela presenter tidak ikut saat scene berganti lewat alamat');
  } catch { fails.push('Presenter: jendela presenter tidak terbuka (P)'); }
  await popup?.close().catch(() => {});
  await page.bringToFront();
  await page.keyboard.press('m'); await page.waitForTimeout(300);
  if ((await page.evaluate(() => window.__etelDebug.mode())) !== 'explore') fails.push('M: tidak kembali ke Explore');
  // tombol "Explore (M)": masuk Present lagi lalu klik tombolnya
  await page.keyboard.press('m'); await page.waitForTimeout(300);
  await page.locator('.present-exit').click(); await page.waitForTimeout(300);
  const back = await page.evaluate(() => ({ mode: window.__etelDebug.mode(), nav: !document.querySelector('.nav')?.hidden, exitHidden: document.querySelector('.present-exit')?.hidden }));
  if (back.mode !== 'explore' || !back.nav) fails.push('Tombol "Explore (M)" tidak mengembalikan navigasi');
  if (!back.exitHidden) fails.push('Tombol "Explore (M)" masih tampil di Explore');
  return fails;
}

/** Bagian A: panel rumus terlipat secara default di scene ber-rumus; chip kecil (< 3 % area 3D); buka/tutup global. */
const FORMULA_SCENES = [1, 2, 3, 4, 7];
async function formulaInteraction(page) {
  const fails = [];
  const state = () => page.evaluate(() => {
    const b = document.querySelector('.f-toggle'), p = document.querySelector('.overlay--formula');
    if (!b || !p) return null;
    const view = b.parentElement.getBoundingClientRect(), r = b.getBoundingClientRect();
    return { expanded: b.getAttribute('aria-expanded'), panelShown: getComputedStyle(p).display !== 'none', area: (r.width * r.height) / (view.width * view.height) * 100, snapSkip: b.hasAttribute('data-snap-skip') };
  });
  for (const n of FORMULA_SCENES) {
    await goScene(page, n, 500);
    const st = await state();
    if (!st) { fails.push(`Scene ${n}: chip rumus tidak ada`); continue; }
    if (st.expanded !== 'false' || st.panelShown) fails.push(`Scene ${n}: rumus tidak terlipat secara default`);
    if (st.area >= 3) fails.push(`Scene ${n}: chip rumus menutupi ${st.area.toFixed(1)} % area 3D`);
    if (!st.snapSkip) fails.push(`Scene ${n}: chip rumus ikut ekspor PNG`);
  }
  await goScene(page, 1, 400);
  await page.locator('.f-toggle').click(); await page.waitForTimeout(200);
  let st = await state();
  if (st?.expanded !== 'true' || !st.panelShown) fails.push('Scene 1: klik chip tidak membuka panel rumus');
  await goScene(page, 4, 500);
  st = await state();
  if (st?.expanded !== 'true' || !st.panelShown) fails.push('Pilihan rumus terbuka tidak bertahan saat pindah scene');
  await page.locator('.f-toggle').focus(); await page.keyboard.press('Enter'); await page.waitForTimeout(200);
  st = await state();
  if (st?.expanded !== 'false' || st.panelShown) fails.push('Scene 4: Enter pada chip tidak melipat panel rumus');
  return fails;
}

const pw = await loadPlaywright();
const srv = await startPreview(Number(process.env.E2E_PORT ?? 4185));
mkdirSync(SHOTS, { recursive: true });
const failures = [];
const report = [];
let leverTimes = [];
const s6Heights = [];
let browsers = [];
try {
  browsers = await launchers(pw);
  const chromium = browsers.find((x) => x.name === 'chromium' && x.browser);
  if (!chromium) throw new Error('Chromium tidak tersedia');
  // E2E_ONLY=learn,landing,deeplinks: hanya alur halaman tersebut (iterasi cepat); tanpa variabel = smoke penuh
  const only = process.env.E2E_ONLY ? new Set(process.env.E2E_ONLY.split(',')) : null;
  if (only) {
    const flows = { learn: learnInteraction, landing: landingInteraction, deeplinks: deepLinks, theme: themeInteraction };
    for (const k of only) if (flows[k]) failures.push(...await flows[k](chromium.browser, srv.url));
  }
  for (const [w, h] of only ? [] : VIEWPORTS) {
    const page = await chromium.browser.newPage({ viewport: { width: w, height: h } });
    const errs = [];
    page.on('pageerror', (e) => errs.push(`pageerror: ${e.message}`));
    page.on('console', (m) => { if (m.type() === 'error') errs.push(`console: ${m.text()}`); });
    await page.goto(`${srv.url}#/scene/1`);
    await page.waitForFunction(() => window.__etelDebug?.scene() != null, null, { timeout: 30000 });
    for (let n = 1; n <= 11; n++) {
      await goScene(page, n, 400);
      for (const tab of TABS[n] ?? [null]) {
        if (tab) { await page.keyboard.press(tab); await page.waitForTimeout(300); }
        // tunggu sampai semua grafik terisi (Worker bisa lambat di software rendering), maksimal TIMEOUT_MS
        let res = null;
        for (let t = 0; t <= TIMEOUT_MS; t += POLL_MS) {
          res = await page.evaluate(inspect, { minFill: MIN_FILL_PCT });
          if (res.charts.every((c) => c.ok)) break;
          await page.waitForTimeout(POLL_MS);
        }
        const label = `${w}×${h} · Scene ${n}${tab ? ` · tab ${tab}` : ''}`;
        report.push({ label, charts: res.charts.map((c) => c.pct), overflow: res.overflow.length });
        if (n === 6) s6Heights.push(`${w}×${h}: ${res.charts.map((c) => `${c.cssH} px`).join(' / ')}`);
        if (res.hscroll) failures.push(`${label}: scroll horizontal`);
        for (const c of res.charts) if (!c.ok) failures.push(`${label}: grafik #${c.i} "${c.title}" kosong/0/tanpa tag Basis (canvas ${c.w}×${c.h}, css ${c.cssW}×${c.cssH}, terisi ${c.pct} %, minimum ${MIN_FILL_PCT} %, tag Basis ${c.basis ? 'ada' : 'HILANG'})`);
        for (const o of res.overflow) failures.push(`${label}: teks meluber di ${o.el}: ${o.reasons[0]}`);
        if (res.topbarH > MAX_TOPBAR_PX) failures.push(`${label}: bilah atas ${res.topbarH} px > ${MAX_TOPBAR_PX} px (pesan kunci terlalu banyak baris)`);
        if (SHOT_SCENES.has(n) && (!tab || tab === '1')) await page.screenshot({ path: `${SHOTS}/scene${n}-${w}x${h}.png` });
      }
    }
    if (w === 1366) failures.push(...await basisInteraction(page, srv.url, chromium.browser));
    if (w === 1366) failures.push(...await regulationInteraction(page, srv.url, chromium.browser));
    if (w === 1366) { const r = await leversInteraction(page); failures.push(...r.fails); leverTimes = r.times; }
    if (w === 1366) failures.push(...await snapshotPerTab(page));
    if (w === 1366) failures.push(...await formulaInteraction(page));
    if (w === 1366) failures.push(...await modeInteraction(page));
    if (w === 1366) failures.push(...await themeInteraction(chromium.browser, srv.url));
    if (w === 1366) failures.push(...await deepLinks(chromium.browser, srv.url));
    if (w === 1366) failures.push(...await landingInteraction(chromium.browser, srv.url));
    if (w === 1366) failures.push(...await learnInteraction(chromium.browser, srv.url));
    for (const e of [...new Set(errs)]) failures.push(`${w}×${h}: ${e}`);
    await page.close();
  }
} finally {
  srv.stop();
  for (const b of browsers) await b.browser?.close().catch(() => {}); // tanpa ini proses menggantung setelah selesai
}

console.log('\nSmoke test tampilan (Chromium, rendering software bila tanpa GPU)\n');
for (const r of report) console.log(`${r.label.padEnd(30)} grafik: ${r.charts.length ? r.charts.map((p) => `${p}%`).join(' ') : '–'}${r.overflow ? `  · meluber: ${r.overflow}` : ''}`);
if (s6Heights.length) console.log(`\nScene 6 · tinggi grafik (NOx & CO / pendamping): ${s6Heights.join(' · ')}`);
if (leverTimes.length) {
  console.log('\nScene 9 Levers · waktu sapuan per perubahan slider (Worker, setelah debounce):');
  for (const t of leverTimes) console.log(`  ${t.axis.padEnd(7)} hitung ${t.ms} ms · total sejak slider ${t.wallMs} ms`);
}
if (failures.length) {
  console.log(`\nGAGAL (${failures.length}):`);
  for (const f of failures) console.log(`  - ${f}`);
  process.exit(1);
}
console.log(`\nLULUS: ${report.length} keadaan, semua grafik berukuran > 0 dan terisi ≥ ${MIN_FILL_PCT} %, tanpa teks meluber. Screenshot Scene 7 dan 9: ${SHOTS}/`);
