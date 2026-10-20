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
 *   9. M11 Step 03: tombol ⓘ di setiap grafik (juga skematik Brayton dan panel Limits) tanpa tumpang tindih di 1366/1920/1280,
 *      ⓘ → panduan → Back to the chart, Present tanpa ⓘ, PNG tanpa ⓘ, indeks 15 panduan, alamat langsung, G/? + Esc.
 *  12. Klik setiap ⓘ di dalam layar (semua scene, Dark/Light, 3 viewport; legenda viewport 3D tidak tertutup overlay) + drag area kosong viewport 3D memutar kamera.
 *  14. D2: galat isian angka di slot tetap (tanpa pergeseran tata letak), jendela presenter + panel presenter ikut EN ↔ ID, kerangka ID (navigasi, Settings, halaman penuh) di 3 viewport × 2 tema.
 *  15. D3: Scene 1–4 ID vs EN: teks kanvas (keluar kotak / bertumpuk yang bertambah), judul ID → panduan ⓘ, label 3D dan PNG ikut bahasa, ganti bahasa tanpa galat.
 *  16. D4: Scene 5–8 ID vs EN (teks kanvas, panduan ⓘ, label 3D, PNG), panel kontrol tanpa tumpang tindih di ID (3 viewport × 2 tema), Scene 6: ganti bahasa saat chip dan garis batas tampil, isian koma / titik.
 *  13. Bahasa ID (Paket D1): semua scene + tab di 3 viewport × 2 tema tanpa luapan (1280: chip, tab Scene 9, header), angka HUD format ID, ganti EN ↔ ID tanpa muat ulang (HUD, Limits, Regulations), isian koma / titik dan pesan galat ID.
 *  11. Settings ⚙ + Hide working notes: panel, penyimpanan, Explore / Present, catatan kerja hilang dan label kejujuran tetap, header 3 viewport tanpa tumpang tindih.
 *  10. Bagian C: bantuan ⓘ (kartu di HUD, slider, navigasi; Glossary / Lesson; Present; PNG; ID) di 3 viewport × 2 tema; tumpang tindih ⓘ semua scene.
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
const TABS = { 2: [null, '4'], 9: ['1', '2', '3', '4', '5'] }; // Scene 2: siklus piston, lalu Brayton (skematik); tab Scene 9: Limits, Formation, Levers, Load window, GHG
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
    // M11 Step 03: tombol ⓘ terlihat (skematik Brayton: di samping tag Basis panel), tidak menutupi judul / tombol skala / tag
    const inSchem = !!root.closest('.cyc-schem');
    const guideEl = inSchem ? document.querySelector('.cyc-guide-slot .chart__guide') : root.querySelector('.chart__guide');
    const shown = (el) => !!el && el.checkVisibility?.() !== false && el.getBoundingClientRect().width > 0;
    out.guide = shown(guideEl) && /How to read this chart|Cara membaca grafik ini/.test(guideEl.dataset.tip ?? '');
    const boxes = [];
    const title = root.querySelector('.chart__title');
    if (!inSchem && shown(title)) {
      const rg = document.createRange(); rg.selectNodeContents(title);
      const q = [...rg.getClientRects()].filter((x) => x.width > 0);
      if (q.length) boxes.push({ n: 'judul', r: { left: Math.min(...q.map((x) => x.left)), right: Math.max(...q.map((x) => x.right)), top: Math.min(...q.map((x) => x.top)), bottom: Math.max(...q.map((x) => x.bottom)) } });
    }
    const cand = inSchem ? [guideEl, document.querySelector('.cyc-level[data-k="level"]')] : [...root.querySelectorAll('.chart__tools > *')];
    for (const el of cand) if (shown(el)) { const r2 = el.getBoundingClientRect(); boxes.push({ n: el.className.split(/\s+/)[0] || el.tagName, r: { left: r2.left, right: r2.right, top: r2.top, bottom: r2.bottom } }); }
    const sc = inSchem ? root.closest('.cyc-view').getBoundingClientRect() : r;
    out.overlap = [];
    for (let a = 0; a < boxes.length; a++) {
      const A = boxes[a].r;
      if (A.right > sc.right + 0.5 || A.left < sc.left - 0.5) out.overlap.push(`${boxes[a].n} keluar kotak grafik`);
      for (let b = a + 1; b < boxes.length; b++) {
        const B = boxes[b].r;
        if (A.left < B.right - 0.5 && B.left < A.right - 0.5 && A.top < B.bottom - 0.5 && B.top < A.bottom - 0.5) out.overlap.push(`${boxes[a].n} × ${boxes[b].n}`);
      }
    }
    out.ok = out.w > 0 && out.h > 0 && out.cssW > 0 && out.cssH > 0 && out.pct >= minFill && out.basis && out.guide && out.overlap.length === 0;
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
  // Bagian C: tombol bantuan ⓘ tidak bertumpuk dengan ⓘ lain, ⓘ grafik, chip Formula, tombol Explore (M), tag Basis; area klik 24 px
  // tidak menimpa angka HUD; titik 18 px tidak menimpa label atau angka sekitarnya; semua di dalam layar
  const helpOverlap = [];
  {
    const shown = (e) => !!e && e.checkVisibility?.() !== false && e.getBoundingClientRect().width > 0;
    const R = (e) => { const b = e.getBoundingClientRect(); return { left: b.left, right: b.right, top: b.top, bottom: b.bottom }; };
    const hit = (a, b, m = 0.5) => a.left < b.right - m && b.left < a.right - m && a.top < b.bottom - m && b.top < a.bottom - m;
    const textRects = (e) => {
      const out = [], w = document.createTreeWalker(e, NodeFilter.SHOW_TEXT);
      for (let n = w.nextNode(); n; n = w.nextNode()) {
        if (!n.textContent.trim() || n.parentElement.closest('.help-btn')) continue;
        const rg = document.createRange(); rg.selectNodeContents(n);
        // teks yang dipotong ellipsis (overflow hidden) hanya dihitung sebatas kotak elemennya
        const pe = n.parentElement, cs = getComputedStyle(pe), clipR = cs.overflowX !== 'visible' ? pe.getBoundingClientRect().right - parseFloat(cs.paddingRight) - parseFloat(cs.borderRightWidth) : null; // ellipsis: sebatas kotak isi
        for (const q of rg.getClientRects()) if (q.width > 0 && q.height > 0) out.push({ left: q.left, right: clipR != null ? Math.min(q.right, clipR) : q.right, top: q.top, bottom: q.bottom });
      }
      return out;
    };
    const dots = [...document.querySelectorAll('.help-btn')].filter(shown).map((b) => ({ b, id: b.dataset.help, dot: R(b.querySelector('.help-btn__dot')), box: R(b) }));
    const others = ['.chart__guide', '.f-toggle', '.present-exit', '.chart__level', '.cyc-level', '.chart__toggle'].flatMap((s) => [...document.querySelectorAll(s)]).filter(shown).map((e) => ({ n: e.className.split(/\s+/)[0], r: R(e) }));
    for (const d of dots) {
      if (d.dot.left < -0.5 || d.dot.top < -0.5 || d.dot.right > window.innerWidth + 0.5 || d.dot.bottom > window.innerHeight + 0.5) helpOverlap.push(`${d.id}: keluar layar`);
      for (const o of others) if (hit(d.dot, o.r)) helpOverlap.push(`${d.id} × ${o.n}`);
      const host = d.b.closest('.hud__item, .ctl, .nav__title, .nav__hint, .temp-legend, .lim-tab th, .asm__head, .cal-panel__head, .bcard__head, .pol-head__state, .pl-reg-wrap, .nox-species');
      // angka HUD: area klik 24 px tidak boleh menimpa angka mana pun
      for (const v of document.querySelectorAll('.hud__value')) if (shown(v)) for (const t of textRects(v)) if (hit(d.box, t, 1)) helpOverlap.push(`${d.id}: area klik menimpa angka HUD`);
      // titik 18 px tidak menimpa teks di sel/kontrol sendiri
      if (host) for (const t of textRects(host)) if (hit(d.dot, t, 2.5)) helpOverlap.push(`${d.id}: titik menimpa teks "${(host.textContent || '').trim().slice(0, 18)}"`);
    }
    for (let a = 0; a < dots.length; a++) for (let b = a + 1; b < dots.length; b++) if (hit(dots[a].dot, dots[b].dot)) helpOverlap.push(`${dots[a].id} × ${dots[b].id}`);
  }
  // bilah atas tidak boleh tumbuh tinggi (pesan kunci membungkus karena tombol terlalu lebar)
  const topbarH = Math.round(document.querySelector('.topbar')?.getBoundingClientRect().height ?? 0);
  const hscroll = document.documentElement.scrollWidth > window.innerWidth + 1;
  return { charts, overflow, topbarH, hscroll, helpOverlap, helpCount: document.querySelectorAll('.help-btn').length };
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

/** PNG RGBA 8-bit tanpa interlace → {w,h,data}; membuka filter baris (0–4). Untuk memeriksa wilayah kecil di ekspor S. */
function decodePng(buf) {
  let off = 8, w = 0, h = 0; const idat = [];
  while (off < buf.length) {
    const len = buf.readUInt32BE(off), type = buf.toString('ascii', off + 4, off + 8), data = buf.subarray(off + 8, off + 8 + len);
    if (type === 'IHDR') { w = data.readUInt32BE(0); h = data.readUInt32BE(4); if (data[8] !== 8 || data[9] !== 6 || data[12] !== 0) throw new Error('PNG bukan RGBA 8-bit tanpa interlace'); }
    if (type === 'IDAT') idat.push(data);
    off += 12 + len;
  }
  const raw = inflateSync(Buffer.concat(idat)), bpp = 4, stride = w * bpp, out = Buffer.alloc(h * stride);
  for (let y = 0; y < h; y++) {
    const f = raw[y * (stride + 1)], src = y * (stride + 1) + 1, dst = y * stride;
    for (let x = 0; x < stride; x++) {
      const a = x >= bpp ? out[dst + x - bpp] : 0, b = y ? out[dst - stride + x] : 0, c = x >= bpp && y ? out[dst - stride + x - bpp] : 0;
      let v = raw[src + x];
      if (f === 1) v += a; else if (f === 2) v += b; else if (f === 3) v += (a + b) >> 1;
      else if (f === 4) { const pp = a + b - c, pa = Math.abs(pp - a), pb = Math.abs(pp - b), pc = Math.abs(pp - c); v += pa <= pb && pa <= pc ? a : pb <= pc ? b : c; }
      out[dst + x] = v & 255;
    }
  }
  return { w, h, data: out };
}
/** Selisih warna terbesar di wilayah (px PNG) terhadap piksel pertamanya; 0 = rata. */
function regionSpread(png, r, k = 2, inset = 2) {
  const x0 = Math.round(r.left * k) + inset, x1 = Math.round(r.right * k) - inset, y0 = Math.round(r.top * k) + inset, y1 = Math.round(r.bottom * k) - inset;
  const at = (x, y) => png.data.subarray((y * png.w + x) * 4, (y * png.w + x) * 4 + 4);
  const base = at(x0, y0); let spread = 0;
  for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) { const p = at(x, y); for (let c = 0; c < 3; c++) spread = Math.max(spread, Math.abs(p[c] - base[c])); }
  return spread;
}

/**
 * M11 Step 03: tombol ⓘ dan Chart guide. Scene 6 → ⓘ pada "NOx & CO vs load" → #/learn/charts/partload → "Back to the chart"
 * → Scene 6; Limits (Scene 9) dan skematik Brayton (Scene 2) sama; ⓘ tidak tampil di Present dan tidak ikut PNG (S);
 * indeks (15 panduan per scene), alamat langsung (tanpa Back), bahasa ID; G / ? / Esc kembali ke scene asal (Scene 6, Scene 3).
 */
async function chartGuideInteraction(browser, url) {
  const fails = [];
  const p = await browser.newPage({ viewport: { width: 1366, height: 768 } });
  await p.addInitScript(() => { try { if (!localStorage.getItem('etel:lang')) localStorage.setItem('etel:lang', 'en'); } catch { /* storage diblokir */ } }); // kunjungan pertama memakai bahasa default learn.json (ID)
  const errs = [];
  p.on('pageerror', (e) => errs.push(`pageerror: ${e.message}`));
  p.on('console', (m) => { if (m.type() === 'error') errs.push(`console: ${m.text()}`); });
  const base = url.replace(/#.*$/, '');
  const hash = () => p.evaluate(() => location.hash);
  const sceneIs = (n) => p.waitForFunction((x) => window.__etelDebug.scene() === x && window.__etelDebug.learnView() == null && window.__etelDebug.page() == null, n, { timeout: 15000 }).then(() => true, () => false);
  const waitHash = (h) => p.waitForFunction((x) => location.hash === x, h, { timeout: 15000 }).then(() => true, () => false);
  await p.goto(`${base}#/scene/6`);
  await p.waitForFunction(() => window.__etelDebug?.scene() === 6 && !window.__etelDebug.loading(), null, { timeout: 30000 });
  await p.waitForTimeout(1200);

  // ── Scene 6: ⓘ → panduan → Back to the chart ──
  const chart = p.locator('.chart', { has: p.getByText('NOx & CO vs load', { exact: true }) });
  const guide = chart.locator('.chart__guide');
  if ((await guide.count()) !== 1) fails.push('Scene 6: grafik "NOx & CO vs load" tidak punya tepat satu tombol ⓘ');
  else {
    const tip = await guide.getAttribute('data-tip');
    if (tip !== 'How to read this chart') fails.push(`ⓘ tooltip "${tip}"`);
    await guide.click();
    if (!(await waitHash('#/learn/charts/partload'))) fails.push(`ⓘ Scene 6: alamat ${await hash()} (harusnya #/learn/charts/partload)`);
    else {
      await p.waitForSelector('.chart-guide .chart-guide__sec', { timeout: 10000 }).catch(() => {});
      const txt = await p.locator('.chart-guide').innerText();
      for (const need of ['NOx & CO vs load', 'Scene 6', 'What it shows', 'Axes', 'How to read it', 'What to look for', 'Common mistakes', 'Words in this chart', 'Related lessons', 'Sources', 'Open the chart', 'Back to the chart']) if (!txt.includes(need)) fails.push(`panduan partload: "${need}" tidak tampil`);
      if (/—/.test(txt)) fails.push('panduan partload: tanda pisah panjang tampil');
      if ((await p.locator('.chart-guide ol.chart-guide__items li').count()) < 1) fails.push('panduan partload: langkah "How to read it" tidak bernomor');
      await p.screenshot({ path: `${SHOTS}/chartguide-partload-dark.png` });
      await p.locator('.chart-guide__back').click();
      if (!(await waitHash('#/scene/6')) || !(await sceneIs(6))) fails.push(`Back to the chart: kembali ke ${await hash()} (harusnya Scene 6)`);
      else if (!(await chart.locator('.chart__guide').isVisible())) fails.push('Back to the chart: grafik Scene 6 tidak tampil lagi');
    }
  }

  // ── PNG (S): wilayah ⓘ rata (tidak dilukis), wilayah tag Basis terlukis (kontrol) ──
  try {
    const rects = await p.evaluate(() => {
      const r = (el) => { const b = el.getBoundingClientRect(); return { left: b.left, right: b.right, top: b.top, bottom: b.bottom }; };
      return { guides: [...document.querySelectorAll('.chart__guide')].filter((e) => e.checkVisibility()).map(r), level: r([...document.querySelectorAll('.chart__level')].find((e) => e.checkVisibility())) };
    });
    await p.evaluate(() => document.activeElement?.blur?.());
    const [dl] = await Promise.all([p.waitForEvent('download', { timeout: 30000 }), p.keyboard.press('s')]);
    const png = decodePng(readFileSync(await dl.path()));
    if (!rects.guides.length) fails.push('PNG Scene 6: tidak ada ⓘ di layar untuk diperiksa');
    rects.guides.forEach((g, i) => { const sp = regionSpread(png, g); if (sp > 8) fails.push(`PNG Scene 6: ⓘ #${i} ikut terlukis (selisih warna ${sp})`); });
    if (regionSpread(png, rects.level) < 30) fails.push('PNG Scene 6: kontrol gagal, tag Basis tidak terlukis di PNG (pemeriksaan tidak valid)');
  } catch (err) { fails.push(`PNG Scene 6: ${String(err.message ?? err).split('\n')[0]}`); }

  // ── Present: ⓘ tersembunyi ──
  await p.keyboard.press('m'); await p.waitForTimeout(400);
  if ((await p.evaluate(() => [...document.querySelectorAll('.chart__guide')].some((e) => e.checkVisibility())))) fails.push('Present: ⓘ masih tampil');
  await p.keyboard.press('m'); await p.waitForTimeout(300);
  if (!(await p.evaluate(() => [...document.querySelectorAll('.chart__guide')].some((e) => e.checkVisibility())))) fails.push('Explore: ⓘ tidak kembali setelah Present');

  // ── G dan ? kembali ke scene asal ──
  await p.keyboard.press('g');
  await p.waitForFunction(() => window.__etelDebug.regulationsOpen(), null, { timeout: 10000 }).catch(() => fails.push('G dari Scene 6: Regulations tidak terbuka'));
  await p.keyboard.press('Escape');
  if (!(await sceneIs(6)) || (await hash()) !== '#/scene/6') fails.push(`G lalu Esc dari Scene 6: kembali ke ${await hash()} (scene ${await p.evaluate(() => window.__etelDebug.scene())}, halaman ${await p.evaluate(() => window.__etelDebug.page())})`);
  await p.evaluate(() => window.__etelDebug.goToScene(3));
  await p.waitForFunction(() => window.__etelDebug.scene() === 3 && !window.__etelDebug.loading(), null, { timeout: 30000 });
  await p.waitForTimeout(500);
  await p.keyboard.press('?');
  await p.waitForFunction(() => window.__etelDebug.referencesOpen(), null, { timeout: 10000 }).catch(() => fails.push('? dari Scene 3: References tidak terbuka'));
  await p.keyboard.press('Escape');
  if (!(await sceneIs(3)) || (await hash()) !== '#/scene/3') fails.push(`? lalu Esc dari Scene 3: kembali ke ${await hash()} (scene ${await p.evaluate(() => window.__etelDebug.scene())}, halaman ${await p.evaluate(() => window.__etelDebug.page())})`);

  // ── Limits (Scene 9) ──
  await p.evaluate(() => window.__etelDebug.goToScene(9));
  await p.waitForFunction(() => window.__etelDebug.scene() === 9 && !window.__etelDebug.loading(), null, { timeout: 30000 });
  await p.waitForTimeout(600);
  await p.keyboard.press('1'); await p.waitForTimeout(400);
  const limGuide = p.locator('.lim-tab__head .chart__guide');
  if ((await limGuide.count()) !== 1) fails.push('Scene 9 Limits: panel tanpa tombol ⓘ');
  else {
    await limGuide.click();
    if (!(await waitHash('#/learn/charts/limits'))) fails.push(`ⓘ Limits: alamat ${await hash()}`);
    else {
      await p.locator('.chart-guide__back').click();
      if (!(await waitHash('#/scene/9/limits')) || !(await sceneIs(9))) fails.push(`Back to the chart (Limits): ${await hash()}`);
    }
  }
  // ── skematik Brayton (Scene 2) ──
  await p.evaluate(() => window.__etelDebug.goToScene(2));
  await p.waitForFunction(() => window.__etelDebug.scene() === 2 && !window.__etelDebug.loading(), null, { timeout: 30000 });
  await p.waitForTimeout(500);
  await p.keyboard.press('4'); await p.waitForTimeout(500);
  const sg = p.locator('.cyc-guide-slot .chart__guide');
  if (!(await sg.isVisible())) fails.push('Scene 2 Brayton: ⓘ skematik tidak tampil');
  else {
    await sg.click();
    if (!(await waitHash('#/learn/charts/brayton-schematic'))) fails.push(`ⓘ skematik: alamat ${await hash()}`);
    else {
      await p.locator('.chart-guide__back').click();
      if (!(await waitHash('#/scene/2')) || !(await sceneIs(2))) fails.push(`Back to the chart (skematik): ${await hash()}`);
    }
  }
  await p.keyboard.press('1');

  // ── indeks dan alamat langsung, EN lalu ID, dua tema ──
  const q = await browser.newPage({ viewport: { width: 1366, height: 768 } });
  await q.addInitScript(() => { try { if (!localStorage.getItem('etel:lang')) localStorage.setItem('etel:lang', 'en'); } catch { /* storage diblokir */ } }); // kunjungan pertama memakai bahasa default learn.json (ID)
  q.on('pageerror', (e) => errs.push(`pageerror: ${e.message}`));
  await q.goto(`${base}#/learn/charts`);
  await q.waitForSelector('.chart-guide__row', { timeout: 30000 }).catch(() => {});
  const rows = await q.locator('.chart-guide__row').count(), groups = await q.locator('.chart-guide__group').count();
  if (rows !== 15 || groups !== 8) fails.push(`indeks Chart guide: ${rows} baris / ${groups} kelompok (harusnya 15 / 8)`);
  const first = await q.locator('.chart-guide__group h3').first().innerText();
  if (!/^Scene 1/.test(first)) fails.push(`indeks Chart guide: kelompok pertama "${first}"`);
  await q.screenshot({ path: `${SHOTS}/chartguide-index-dark.png` });
  await q.goto(`${base}#/learn/charts/pv-ts`);
  await q.waitForSelector('.chart-guide .chart-guide__sec', { timeout: 30000 }).catch(() => {});
  if ((await q.locator('.chart-guide__back').count()) !== 0) fails.push('panduan lewat alamat langsung: "Back to the chart" tampil (tidak ada grafik asal)');
  if (!(await q.locator('.chart-guide__open').isVisible())) fails.push('panduan lewat alamat langsung: "Open the chart" tidak tampil');
  await q.evaluate(() => { try { localStorage.setItem('etel:lang', 'id'); localStorage.setItem('etel:theme', 'light'); } catch { /* storage diblokir */ } });
  await q.reload();
  await q.waitForSelector('.chart-guide .chart-guide__sec', { timeout: 30000 }).catch(() => {});
  const idTxt = await q.locator('.chart-guide').innerText();
  for (const need of ['Yang ditampilkan', 'Sumbu', 'Cara membacanya', 'Buka grafik']) if (!idTxt.includes(need)) fails.push(`panduan (ID): "${need}" tidak tampil`);
  await q.screenshot({ path: `${SHOTS}/chartguide-pv-ts-light-id.png` });
  await q.goto(`${base}#/learn/charts/tidak-ada`);
  await q.waitForSelector('.chart-guide__row', { timeout: 30000 }).catch(() => {});
  if ((await q.locator('.chart-guide__missing').count()) !== 1) fails.push('id panduan tak dikenal: tidak ada pesan, indeks tetap tampil');
  await q.close();
  for (const e of [...new Set(errs)]) fails.push(`Chart guide: ${e}`);
  await p.close();
  return fails;
}

/**
 * Bagian C: bantuan ⓘ. Di 1280 / 1366 / 1920 × Dark / Light: kartu terbuka di satu HUD, satu slider, dan satu kelompok navigasi
 * (di dalam layar, aria-expanded/aria-labelledby, tanda Draft, hanya satu kartu, Esc mengembalikan fokus, klik luar menutup);
 * Read more → Glossary (Esc kembali ke scene) dan Lesson (← Back to the scene); Present menyembunyikan ⓘ dan menutup kartu;
 * ⓘ tidak ikut PNG (S); kartu ID. Tumpang tindih ⓘ diperiksa untuk semua scene di inspect().
 */
async function helpInteraction(browser, url) {
  const fails = [];
  const base = url.replace(/#.*$/, '');
  for (const [w, h] of VIEWPORTS) {
    for (const theme of ['dark', 'light']) {
      const tag = `${w}×${h} ${theme}`;
      const p = await browser.newPage({ viewport: { width: w, height: h } });
      const errs = [];
      p.on('pageerror', (e) => errs.push(`pageerror: ${e.message}`));
      await p.addInitScript(([t]) => { try { localStorage.setItem('etel:lang', 'en'); localStorage.setItem('etel:theme', t); } catch { /* storage diblokir */ } }, [theme]);
      await p.goto(`${base}#/scene/6`);
      await p.waitForFunction(() => window.__etelDebug?.scene() === 6 && !window.__etelDebug.loading(), null, { timeout: 30000 });
      await p.waitForTimeout(1000);
      const openId = () => p.evaluate(() => window.__etelDebug.helpOpen());
      const cardInfo = () => p.evaluate(() => {
        const c = [...document.querySelectorAll('.help-card')].filter((e) => !e.hidden);
        const k = c[0];
        const r = k?.getBoundingClientRect();
        const lab = k && document.getElementById(k.getAttribute('aria-labelledby') ?? '');
        return { visible: c.length, inside: !!r && r.left >= 0 && r.top >= 0 && r.right <= window.innerWidth && r.bottom <= window.innerHeight, label: lab?.textContent ?? '', draft: !!k?.querySelector('.help-card__draft'), role: k?.getAttribute('role'), text: k?.textContent.length ?? 0 };
      });
      const check = async (what, id) => {
        await p.waitForFunction((x) => window.__etelDebug.helpOpen() === x, id, { timeout: 8000 }).catch(() => {});
        const o = await openId();
        if (o !== id) { fails.push(`${tag}: ${what}: kartu ${id} tidak terbuka (terbuka: ${o})`); return false; }
        const c = await cardInfo();
        if (c.visible !== 1) fails.push(`${tag}: ${what}: ${c.visible} kartu terbuka (harusnya satu)`);
        if (!c.inside) fails.push(`${tag}: ${what}: kartu keluar layar`);
        if (c.role !== 'dialog' || c.label.length < 10) fails.push(`${tag}: ${what}: aria-labelledby tidak menunjuk kalimat what`);
        if (!c.draft) fails.push(`${tag}: ${what}: tanda Draft tidak tampil`);
        return true;
      };
      // HUD
      const hud = p.locator('.pl-hud__body .hud__item .help-btn').first();
      await hud.click();
      if (await check('HUD', 'hud.etaThermal')) {
        if ((await hud.getAttribute('aria-expanded')) !== 'true') fails.push(`${tag}: HUD: aria-expanded tidak true`);
        await p.keyboard.press('Escape');
        if ((await openId()) !== null) fails.push(`${tag}: HUD: Esc tidak menutup kartu`);
        if (!(await p.evaluate(() => document.activeElement?.classList.contains('help-btn')))) fails.push(`${tag}: HUD: fokus tidak kembali ke ⓘ setelah Esc`);
        if (await p.evaluate(() => window.__etelDebug.page() != null)) fails.push(`${tag}: HUD: Esc menutup halaman di belakang kartu`);
      }
      // slider, lalu HUD: hanya satu kartu; klik di luar menutup
      await p.locator('.scene__controls .ctl--slider .help-btn').first().click();
      if (await check('slider', 'ctl.load')) {
        await hud.dispatchEvent('click'); // kartu slider bisa menutupi ⓘ HUD: klik lewat peristiwa, bukan penunjuk
        await check('slider → HUD (hanya satu)', 'hud.etaThermal');
        await p.mouse.click(Math.round(w * 0.45), Math.round(h * 0.2));
        await p.waitForTimeout(150);
        if ((await openId()) !== null) fails.push(`${tag}: klik di luar tidak menutup kartu`);
      }
      // navigasi (rail terlipat → buka dulu)
      if (await p.evaluate(() => document.querySelector('.nav')?.classList.contains('is-collapsed'))) await p.locator('.nav__toggle').click();
      await p.waitForTimeout(200);
      await p.locator('[data-help="nav.scenes"]').click();
      if (await check('navigasi', 'nav.scenes')) await p.keyboard.press('Escape');
      // Read more → Glossary, Esc kembali ke scene
      await p.locator('.pl-hud__body .hud__item .help-btn').nth(5).click(); // IGV opening? pastikan kartu dengan tautan
      await p.waitForTimeout(300);
      const gl = p.locator('.help-card .help-card__link[data-term]').first();
      if (await gl.count()) {
        await gl.click();
        await p.waitForFunction(() => window.__etelDebug.glossaryOpen(), null, { timeout: 8000 }).catch(() => fails.push(`${tag}: Read more → Glossary tidak terbuka`));
        await p.keyboard.press('Escape');
        await p.waitForFunction(() => window.__etelDebug.scene() === 6 && window.__etelDebug.page() == null, null, { timeout: 8000 }).catch(() => fails.push(`${tag}: Esc dari Glossary tidak kembali ke Scene 6`));
        if ((await p.evaluate(() => location.hash)) !== '#/scene/6') fails.push(`${tag}: alamat setelah Glossary bukan #/scene/6`);
      } else fails.push(`${tag}: kartu tanpa tautan Glossary (diharapkan pada HUD ke-6)`);
      // Present: ⓘ hilang dan kartu tertutup
      await p.locator('.scene__controls .ctl--slider .help-btn').first().click();
      await p.waitForTimeout(250);
      await p.keyboard.press('m');
      await p.waitForTimeout(400);
      if ((await openId()) !== null) fails.push(`${tag}: Present tidak menutup kartu`);
      if (await p.evaluate(() => [...document.querySelectorAll('.help-btn')].some((e) => e.checkVisibility()))) fails.push(`${tag}: Present: ⓘ masih tampil`);
      await p.keyboard.press('m');
      await p.waitForTimeout(300);
      if (w === 1366) {
        // PNG: area titik ⓘ pada baris label kontrol tidak dilukis; tag Basis (kontrol) terlukis
        try {
          const rects = await p.evaluate(() => {
            const r = (el) => { const b = el.getBoundingClientRect(); return { left: b.left, right: b.right, top: b.top, bottom: b.bottom }; };
            return { dots: [...document.querySelectorAll('.scene__controls .ctl .help-btn__dot')].filter((e) => e.checkVisibility()).map(r), level: r([...document.querySelectorAll('.chart__level')].find((e) => e.checkVisibility())) };
          });
          await p.evaluate(() => document.activeElement?.blur?.());
          const [dl] = await Promise.all([p.waitForEvent('download', { timeout: 30000 }), p.keyboard.press('s')]);
          const png = decodePng(readFileSync(await dl.path()));
          if (!rects.dots.length) fails.push(`${tag}: PNG: tidak ada ⓘ kontrol untuk diperiksa`);
          rects.dots.forEach((d, i) => { const sp = regionSpread(png, d, 2, 3); if (sp > 10) fails.push(`${tag}: PNG: ⓘ kontrol #${i} ikut terlukis (selisih warna ${sp})`); });
          if (regionSpread(png, rects.level) < 30) fails.push(`${tag}: PNG: kontrol gagal, tag Basis tidak terlukis`);
        } catch (err) { fails.push(`${tag}: PNG: ${String(err.message ?? err).split('\n')[0]}`); }
        // Lesson: Read more → pelajaran + "← Back to the scene"
        await p.locator('.pl-hud__body .hud__item .help-btn').nth(7).click(); // Load window
        await p.waitForTimeout(300);
        const lk = p.locator('.help-card a.help-card__link[data-lesson]').first();
        if (await lk.count()) {
          await lk.click();
          await p.waitForFunction(() => /^#\/learn\/l3-4$/.test(location.hash), null, { timeout: 8000 }).catch(() => fails.push(`${tag}: Read more → Lesson: alamat bukan #/learn/l3-4`));
          await p.waitForSelector('.lesson__back', { timeout: 8000 }).catch(() => {});
          if (!(await p.locator('.lesson__back').isVisible().catch(() => false))) fails.push(`${tag}: pelajaran tanpa "← Back to the scene"`);
          else {
            await p.locator('.lesson__back').click();
            await p.waitForFunction(() => window.__etelDebug.scene() === 6 && window.__etelDebug.learnView() == null, null, { timeout: 8000 }).catch(() => fails.push(`${tag}: Back to the scene tidak kembali ke Scene 6`));
          }
        } else fails.push(`${tag}: kartu tanpa tautan Lesson`);
      }
      for (const e of [...new Set(errs)]) fails.push(`${tag}: ${e}`);
      await p.close();
    }
  }
  // kartu berbahasa ID
  const q = await browser.newPage({ viewport: { width: 1366, height: 768 } });
  await q.addInitScript(() => { try { localStorage.setItem('etel:lang', 'id'); } catch { /* storage diblokir */ } });
  await q.goto(`${base}#/scene/6`);
  await q.waitForFunction(() => window.__etelDebug?.scene() === 6 && !window.__etelDebug.loading(), null, { timeout: 30000 });
  await q.waitForTimeout(800);
  await q.locator('.pl-hud__body .hud__item .help-btn').first().click();
  await q.waitForFunction(() => window.__etelDebug.helpOpen() === 'hud.etaThermal', null, { timeout: 8000 }).catch(() => fails.push('kartu ID tidak terbuka'));
  const idTxt = await q.locator('.help-card').innerText();
  if (!/draf/i.test(idTxt) || !/Bagian energi bahan bakar/.test(idTxt)) fails.push(`kartu ID: teks Indonesia / Draf tidak tampil ("${idTxt.slice(0, 50)}")`);
  await q.close();
  return fails;
}

/** Header kanan: tidak ada kotak yang bertumpuk dan semuanya di dalam layar (dijalankan di halaman). */
function headerOverlap() {
  const kids = [...document.querySelectorAll('.topbar__right > *')].filter((e) => e.checkVisibility?.() !== false && e.getBoundingClientRect().width > 0);
  const out = [], nm = (e) => (e.className && typeof e.className === 'string' ? e.className.split(/\s+/)[0] : e.id) || e.tagName.toLowerCase();
  const rs = kids.map((e) => ({ n: nm(e), r: e.getBoundingClientRect() }));
  for (let a = 0; a < rs.length; a++) {
    const A = rs[a].r;
    if (A.right > window.innerWidth + 0.5 || A.left < -0.5) out.push(`${rs[a].n}: keluar layar`);
    for (let b = a + 1; b < rs.length; b++) { const B = rs[b].r; if (A.left < B.right - 0.5 && B.left < A.right - 0.5 && A.top < B.bottom - 0.5 && B.top < A.bottom - 0.5) out.push(`${rs[a].n} × ${rs[b].n}`); }
  }
  const key = document.querySelector('.key-message')?.getBoundingClientRect(), right = document.querySelector('.topbar__right')?.getBoundingClientRect();
  if (key && right && key.width > 0 && key.right > right.left + 0.5) out.push('pesan kunci × header kanan');
  return out;
}

/**
 * Settings ⚙ + "Hide working notes". Di 1280 / 1366 / 1920 × Dark / Light: panel terbuka tanpa menumpuk header, Esc dan klik luar,
 * sakelar menyimpan etel:hideNotes dan bertahan setelah muat ulang, Explore tampil / Present sembunyi secara default, ⚙ hilang di Present.
 * Di 1366: catatan kerja hilang (banner draf, Draft, "to verify", "locator not verified", "from Learn", catatan Formation) sedangkan label
 * kejujuran model tetap terlihat (indicative, tag Basis, basis O₂ dan volume, banner "Transcribed…").
 */
async function settingsInteraction(browser, url) {
  const fails = [];
  const base = url.replace(/#.*$/, '');
  for (const [w, h] of VIEWPORTS) {
    for (const theme of ['dark', 'light']) {
      const tag = `${w}×${h} ${theme}`;
      const p = await browser.newPage({ viewport: { width: w, height: h } });
      const errs = [];
      p.on('pageerror', (e) => errs.push(`pageerror: ${e.message}`));
      await p.addInitScript(([t]) => { try { localStorage.setItem('etel:lang', 'en'); localStorage.setItem('etel:theme', t); } catch { /* storage diblokir */ } }, [theme]);
      const vis = (sel) => p.evaluate((q) => { const e = document.querySelector(q); return !!e && e.checkVisibility?.() !== false && e.getBoundingClientRect().width > 0; }, sel);
      const stored = () => p.evaluate(() => { try { return localStorage.getItem('etel:hideNotes'); } catch { return 'ERR'; } });
      await p.goto(`${base}#/learn`);
      await p.waitForSelector('.learn-page__draft', { timeout: 30000 }).catch(() => fails.push(`${tag}: banner draf Learn tidak tampil di Explore (default)`));
      if (!(await vis('.learn-page__draft'))) fails.push(`${tag}: Explore default: banner draf tersembunyi`);
      const hov = await p.evaluate(headerOverlap);
      for (const o of hov) fails.push(`${tag}: header (Explore): ${o}`);
      // panel
      await p.locator('.settings-btn').click();
      const card = await p.evaluate(() => { const c = document.querySelector('.settings-card'); const r = c.getBoundingClientRect(); return { open: !c.hidden, inside: r.left >= 0 && r.top >= 0 && r.right <= window.innerWidth && r.bottom <= window.innerHeight, exp: document.querySelector('.settings-btn').getAttribute('aria-expanded'), role: c.getAttribute('role'), label: document.getElementById(c.getAttribute('aria-labelledby'))?.textContent, sw: document.querySelector('.set-switch').getAttribute('aria-checked'), hint: c.textContent.includes('press key M') }; });
      if (!card.open || card.exp !== 'true' || card.role !== 'dialog' || card.label !== 'Settings') fails.push(`${tag}: panel Settings tidak terbuka dengan benar (${JSON.stringify(card)})`);
      if (!card.inside) fails.push(`${tag}: panel keluar layar`);
      if (card.sw !== 'false') fails.push(`${tag}: sakelar bawaan Explore harus mati (dapat ${card.sw})`);
      if (!card.hint) fails.push(`${tag}: teks panel tidak menyebut tombol M untuk kembali ke Explore`);
      await p.keyboard.press('Escape');
      if ((await p.evaluate(() => window.__etelDebug.settingsOpen())) || !(await p.evaluate(() => document.activeElement?.classList.contains('settings-btn')))) fails.push(`${tag}: Esc tidak menutup panel / fokus tidak kembali ke ⚙`);
      await p.locator('.settings-btn').click();
      await p.mouse.click(Math.round(w * 0.4), Math.round(h * 0.6));
      if (await p.evaluate(() => window.__etelDebug.settingsOpen())) fails.push(`${tag}: klik di luar tidak menutup panel`);
      // sakelar → tersimpan, banner hilang, bertahan setelah muat ulang
      await p.locator('.settings-btn').click();
      await p.locator('.set-switch').click();
      if ((await stored()) !== 'hide') fails.push(`${tag}: etel:hideNotes tidak tersimpan 'hide' (dapat ${await stored()})`);
      if (await vis('.learn-page__draft')) fails.push(`${tag}: banner draf masih tampil setelah Hide working notes`);
      if (!(await p.evaluate(() => document.body.classList.contains('hide-notes')))) fails.push(`${tag}: body tanpa class hide-notes`);
      await p.reload();
      await p.waitForFunction(() => window.__etelDebug?.learnView?.() === 'learn', null, { timeout: 30000 }).catch(() => {});
      await p.waitForTimeout(500);
      if (await vis('.learn-page__draft')) fails.push(`${tag}: pilihan tidak bertahan setelah muat ulang`);
      // Use the default → tampil lagi di Explore
      await p.locator('.settings-btn').click();
      await p.locator('.set-row__reset').click();
      if ((await stored()) !== null) fails.push(`${tag}: Use the default tidak menghapus kunci`);
      if (!(await vis('.learn-page__draft'))) fails.push(`${tag}: banner draf tidak kembali setelah Use the default`);
      await p.keyboard.press('Escape');
      // Present: ⚙ hilang, header tanpa tumpang tindih (termasuk tombol Explore (M)), catatan tersembunyi secara default
      await p.keyboard.press('m');
      await p.waitForTimeout(500);
      if (await vis('.settings-btn')) fails.push(`${tag}: ⚙ masih tampil di Present`);
      if (!(await vis('.present-exit'))) fails.push(`${tag}: tombol Explore (M) tidak tampil di Present`);
      for (const o of await p.evaluate(headerOverlap)) fails.push(`${tag}: header (Present): ${o}`);
      const nt = await p.evaluate(() => window.__etelDebug.notes());
      if (nt.choice !== null || nt.hide !== true) fails.push(`${tag}: Present default: catatan harus tersembunyi (${JSON.stringify(nt)})`);
      await p.keyboard.press('m');
      await p.waitForTimeout(400);
      if ((await p.evaluate(() => window.__etelDebug.notes())).hide !== false) fails.push(`${tag}: kembali ke Explore: catatan harus tampil lagi`);
      // pilihan eksplisit "show" di Explore berlaku juga di Present
      await p.locator('.settings-btn').click();
      await p.locator('.set-switch').click(); // hide
      await p.locator('.set-switch').click(); // show
      if ((await stored()) !== 'show') fails.push(`${tag}: pilihan 'show' tidak tersimpan`);
      await p.keyboard.press('Escape');
      await p.keyboard.press('m');
      await p.waitForTimeout(300);
      if ((await p.evaluate(() => window.__etelDebug.notes())).hide !== false) fails.push(`${tag}: pilihan 'show' eksplisit tidak berlaku di Present`);
      await p.keyboard.press('m');
      await p.locator('.settings-btn').click();
      await p.locator('.set-row__reset').click();
      await p.keyboard.press('Escape');

      if (w === 1366) {
        // catatan kerja hilang ketika opsi aktif; label kejujuran tetap
        await p.evaluate(() => { try { localStorage.setItem('etel:hideNotes', 'hide'); } catch { /* storage diblokir */ } });
        await p.reload(); // store catatan membaca kunci saat boot
        await p.waitForTimeout(500);
        await p.goto(`${base}#/references`);
        await p.waitForFunction(() => window.__etelDebug?.referencesOpen?.(), null, { timeout: 30000 }).catch(() => {});
        await p.waitForTimeout(300);
        if (await vis('.refs__banner')) fails.push(`${tag}: References: banner "locator not verified" tampil padahal catatan disembunyikan`);
        if (await p.evaluate(() => [...document.querySelectorAll('.bcard__chip--warn')].some((e) => e.checkVisibility() && /not verified/.test(e.textContent)))) fails.push(`${tag}: References: chip "locator not verified" masih tampil`);
        if (await p.evaluate(() => [...document.querySelectorAll('.refs__loc .bcard__chip--ok')].some((e) => !e.checkVisibility()))) fails.push(`${tag}: References: chip "locator checked" tersembunyi (harus tetap tampil)`);
        await p.goto(`${base}#/glossary`);
        await p.waitForFunction(() => window.__etelDebug?.glossaryOpen?.(), null, { timeout: 30000 }).catch(() => {});
        await p.waitForTimeout(500);
        if (await p.evaluate(() => [...document.querySelectorAll('.gl__item--basic .bcard__chip')].some((e) => e.checkVisibility()))) fails.push(`${tag}: Glossary: chip "from Learn" masih tampil`);
        // Regulations: banner "Transcribed…" tetap tampil
        await p.goto(`${base}#/regulations`);
        await p.waitForFunction(() => window.__etelDebug?.regulationsOpen?.(), null, { timeout: 30000 }).catch(() => {});
        await p.waitForTimeout(400);
        if (!(await p.evaluate(() => [...document.querySelectorAll('.refs__banner')].some((e) => e.checkVisibility() && /Transcribed from the published tables/.test(e.textContent))))) fails.push(`${tag}: Regulations: banner "Transcribed…" tersembunyi (label kejujuran harus tetap tampil)`);
        // Scene 4: tag Basis, basis O₂ dan volume, indicative
        await p.goto(`${base}#/scene/4`);
        await p.waitForFunction(() => window.__etelDebug?.scene() === 4 && !window.__etelDebug.loading(), null, { timeout: 30000 });
        await p.waitForTimeout(1200);
        const hon = await p.evaluate(() => {
          const shown = (e) => e.checkVisibility?.() !== false && e.getBoundingClientRect().width > 0;
          const lv = [...document.querySelectorAll('.chart__level')].filter(shown);
          return {
            levels: lv.length, levelOk: lv.every((e) => /^Basis/.test(e.textContent)),
            basis: [...document.querySelectorAll('.hud__sub')].filter(shown).some((e) => /O₂/.test(e.textContent) && /°C/.test(e.textContent)),
            indicative: [...document.querySelectorAll('.hud__label')].filter(shown).some((e) => /indicative/.test(e.textContent)),
            hudBasis: [...document.querySelectorAll('.hud__note .level')].filter(shown).length,
            noteHides: [...document.querySelectorAll('[data-note]')].filter((e) => /indicative|Transcribed from the published tables|O₂|mg\/Nm/.test(e.textContent)).map((e) => e.className),
          };
        });
        if (hon.levels < 1 || !hon.levelOk) fails.push(`${tag}: Scene 4: tag Basis grafik tersembunyi (${hon.levels})`);
        if (!hon.basis) fails.push(`${tag}: Scene 4: basis O₂ / volume di samping angka tersembunyi`);
        if (!hon.indicative) fails.push(`${tag}: Scene 4: label "indicative" tersembunyi`);
        if (hon.hudBasis < 1) fails.push(`${tag}: Scene 4: tag Basis HUD tersembunyi`);
        if (hon.noteHides.length) fails.push(`${tag}: elemen bertanda catatan memuat label kejujuran: ${hon.noteHides.join(', ')}`);
        // Scene 9 Limits: banner Transcribed di header regulasi
        await p.evaluate(() => window.__etelDebug.goToScene(9));
        await p.waitForFunction(() => window.__etelDebug.scene() === 9 && !window.__etelDebug.loading(), null, { timeout: 30000 });
        await p.waitForTimeout(600);
        await p.keyboard.press('1');
        await p.waitForTimeout(500);
        if (!(await p.evaluate(() => [...document.querySelectorAll('.reg__banner')].some((e) => e.checkVisibility?.() !== false && /Transcribed from the published tables/.test(e.textContent))))) fails.push(`${tag}: Scene 9: banner "Transcribed…" tersembunyi`);
        // Scene 6: kartu bantuan tanpa tanda Draft
        await p.evaluate(() => window.__etelDebug.goToScene(6));
        await p.waitForFunction(() => window.__etelDebug.scene() === 6 && !window.__etelDebug.loading(), null, { timeout: 30000 });
        await p.waitForTimeout(800);
        await p.locator('.pl-hud__body .hud__item .help-btn').first().click();
        await p.waitForFunction(() => window.__etelDebug.helpOpen() != null, null, { timeout: 8000 }).catch(() => {});
        if (await vis('.help-card__draft')) fails.push(`${tag}: kartu bantuan: tanda Draft masih tampil`);
        if (!(await p.evaluate(() => { const e = document.querySelector('.pl-reg [data-k="regline"]'); return !!e && e.checkVisibility?.() !== false && /indicative/.test(e.textContent); }))) fails.push(`${tag}: Scene 6: baris regulasi (indicative) tersembunyi`);
        // PNG: panel Settings dan ⚙ tidak ikut
        await p.keyboard.press('Escape');
        await p.locator('.settings-btn').click();
        const gear = await p.evaluate(() => { const r = (e) => { const b = e.getBoundingClientRect(); return { left: b.left, right: b.right, top: b.top, bottom: b.bottom }; }; return { btn: r(document.querySelector('.settings-btn')), card: r(document.querySelector('.settings-card')) }; });
        try {
          await p.evaluate(() => document.activeElement?.blur?.());
          const [dl] = await Promise.all([p.waitForEvent('download', { timeout: 30000 }), p.keyboard.press('s')]);
          const png = decodePng(readFileSync(await dl.path()));
          // ⚙ dan panel diberi data-snap-skip: bagian dalam tombol ⚙ (di atas latar header) tidak dilukis, jadi rata
          const inner = { left: gear.btn.left + 5, right: gear.btn.right - 5, top: gear.btn.top + 5, bottom: gear.btn.bottom - 5 };
          const gearSpread = regionSpread(png, inner, 2, 0);
          if (gearSpread > 10) fails.push(`${tag}: PNG memuat ikon ⚙ (selisih warna ${gearSpread})`);
        } catch (err) { fails.push(`${tag}: PNG Settings: ${String(err.message ?? err).split('\n')[0]}`); }
      }
      for (const e of [...new Set(errs)]) fails.push(`${tag}: ${e}`);
      await p.close();
    }
  }
  // kartu panel berbahasa ID
  const q = await browser.newPage({ viewport: { width: 1366, height: 768 } });
  await q.addInitScript(() => { try { localStorage.setItem('etel:lang', 'id'); } catch { /* storage diblokir */ } });
  await q.goto(`${base}#/scene/6`);
  await q.waitForFunction(() => window.__etelDebug?.scene() === 6 && !window.__etelDebug.loading(), null, { timeout: 30000 });
  await q.locator('.settings-btn').click();
  const idTxt = await q.locator('.settings-card').innerText();
  if (!/Pengaturan/.test(idTxt) || !/Sembunyikan catatan kerja/.test(idTxt) || !/tombol M/.test(idTxt)) fails.push(`panel Settings ID: teks Indonesia tidak tampil ("${idTxt.slice(0, 60)}")`);
  await q.close();
  return fails;
}

/**
 * Klik setiap ⓘ yang berada di dalam layar (daftar diambil dari DOM): semua scene, semua tab Scene 9, Dark dan Light,
 * 1280 / 1366 / 1920. ⓘ bantuan (HUD, kontrol, legenda di viewport 3D, panel, header, navigasi) → kartu terbuka dan Esc menutup;
 * ⓘ grafik (dan panel Limits) → membuka #/learn/charts/<id>. Titik tengah ⓘ harus benar-benar mengenai tombol (tidak tertutup
 * overlay atau elemen lain; pointer-events). Drag di area kosong viewport 3D tetap memutar kamera (kotak overlay pointer-events:none).
 * Bukti sebelum / sesudah: hasil dicetak per kelompok (legenda viewport, HUD, kontrol, header, grafik, panel).
 */
async function helpClickInteraction(browser, url) {
  const fails = [];
  const base = url.replace(/#.*$/, '');
  const summary = new Map();
  const bump = (k, ok) => { const e = summary.get(k) ?? { ok: 0, bad: 0 }; e[ok ? 'ok' : 'bad']++; summary.set(k, e); };
  const kindOf = (id) => (id === 'ui.tempLegend' || id === 'ui.speciesLegend' ? 'legenda viewport 3D' : /^hud\./.test(id) ? 'HUD' : /^ctl\./.test(id) ? 'kontrol' : /^hdr\./.test(id) ? 'header' : /^nav\./.test(id) ? 'navigasi' : id === 'chart' ? 'grafik' : id === 'limits-panel' ? 'panel Limits' : 'panel / lainnya');
  const list = () => document.querySelectorAll('.help-btn, .chart__guide');
  for (const [w, h] of VIEWPORTS) {
    for (const theme of ['dark', 'light']) {
      const tag = `${w}×${h} ${theme}`;
      const p = await browser.newPage({ viewport: { width: w, height: h } });
      const errs = [];
      p.on('pageerror', (e) => errs.push(`pageerror: ${e.message}`));
      await p.addInitScript(([t]) => { try { localStorage.setItem('etel:lang', 'en'); localStorage.setItem('etel:theme', t); } catch { /* storage diblokir */ } }, [theme]);
      await p.goto(`${base}#/scene/1`);
      await p.waitForFunction(() => window.__etelDebug?.scene() === 1 && !window.__etelDebug.loading(), null, { timeout: 30000 });
      for (let n = 1; n <= 11; n++) {
        await goScene(p, n, 500);
        for (const tab of n === 9 ? ['1', '2', '3', '4', '5'] : [null]) {
          if (tab) { await p.keyboard.press(tab); await p.waitForTimeout(350); }
          const where = `${tag} Scene ${n}${tab ? ` tab ${tab}` : ''}`;
          const hash0 = await p.evaluate(() => location.hash);
          const items = await p.evaluate(() => [...document.querySelectorAll('.help-btn, .chart__guide')].filter((e) => e.checkVisibility?.() !== false).map((e, i) => {
            const r = e.getBoundingClientRect();
            return { i, id: e.dataset.help ?? (e.closest('.lim-tab__head') ? 'limits-panel' : 'chart'), cx: r.left + r.width / 2, cy: r.top + r.height / 2, w: r.width, h: r.height, inside: r.left >= 0 && r.top >= 0 && r.right <= window.innerWidth && r.bottom <= window.innerHeight };
          }));
          for (const it of items) {
            if (!it.inside || it.w < 1) continue;
            const kind = kindOf(it.id);
            // titik tengah harus mengenai tombol itu sendiri
            const hit = await p.evaluate(({ i, cx, cy }) => { const e = [...document.querySelectorAll('.help-btn, .chart__guide')].filter((x) => x.checkVisibility?.() !== false)[i]; const t = document.elementFromPoint(cx, cy); return { ok: !!e && (t === e || e.contains(t)), top: t ? `${t.tagName.toLowerCase()}.${String(t.className).split(' ')[0]}` : 'null' }; }, it);
            if (!hit.ok) { fails.push(`${where}: ⓘ ${it.id} tidak bisa diklik (titik tengah mengenai ${hit.top})`); bump(kind, false); continue; }
            await p.mouse.click(it.cx, it.cy);
            if (it.id === 'chart' || it.id === 'limits-panel') {
              const okNav = await p.waitForFunction(() => /^#\/learn\/charts\//.test(location.hash), null, { timeout: 5000 }).then(() => true, () => false);
              if (!okNav) { fails.push(`${where}: ⓘ ${it.id} tidak membuka panduan grafik`); bump(kind, false); continue; }
              bump(kind, true);
              await p.evaluate((hh) => { location.hash = hh; }, hash0);
              await p.waitForFunction((x) => window.__etelDebug.scene() === x && window.__etelDebug.learnView() == null, n, { timeout: 8000 }).catch(() => {});
              await p.waitForTimeout(150);
              continue;
            }
            const opened = await p.evaluate(() => new Promise((res) => requestAnimationFrame(() => res(window.__etelDebug.helpOpen()))));
            if (opened !== it.id) { fails.push(`${where}: ⓘ ${it.id} diklik tetapi kartu tidak terbuka (terbuka: ${opened})`); bump(kind, false); await p.keyboard.press('Escape'); continue; }
            const card = await p.evaluate(() => { const c = document.querySelector('.help-card:not([hidden])'); const r = c?.getBoundingClientRect(); return !!r && r.left >= 0 && r.top >= 0 && r.right <= window.innerWidth && r.bottom <= window.innerHeight; });
            await p.keyboard.press('Escape');
            const closed = (await p.evaluate(() => window.__etelDebug.helpOpen())) === null;
            if (!card || !closed) { fails.push(`${where}: ⓘ ${it.id}: ${!card ? 'kartu keluar layar' : 'Esc tidak menutup'}`); bump(kind, false); continue; }
            bump(kind, true);
          }
        }
      }
      // drag di area kosong viewport 3D memutar kamera (dibekukan agar hanya kamera yang mengubah gambar)
      if (w === 1366 && theme === 'dark') {
        await p.evaluate(() => document.activeElement?.blur?.());
        await p.keyboard.press('f'); // beku (F) tersimpan di store dan berlaku lintas scene; dibatalkan lagi setelah loop
        for (const n of [1, 2, 3, 4, 5, 6, 7, 8]) {
          await goScene(p, n, 700);
          const spot = await p.evaluate(() => {
            const c = document.querySelector('.view3d canvas');
            if (!c || c.checkVisibility?.() === false) return null;
            const r = c.getBoundingClientRect();
            for (const [fx, fy] of [[0.5, 0.5], [0.4, 0.5], [0.6, 0.5], [0.5, 0.35], [0.5, 0.65], [0.3, 0.5], [0.7, 0.5], [0.45, 0.7]]) {
              const x = r.left + r.width * fx, y = r.top + r.height * fy;
              if (document.elementFromPoint(x, y) === c) return { x, y, rect: { x: r.left, y: r.top, width: r.width, height: r.height } };
            }
            return null;
          });
          if (!spot) { fails.push(`${tag} Scene ${n}: tidak ada titik kosong di viewport 3D untuk drag (semua tertutup elemen interaktif)`); bump('drag viewport 3D', false); continue; }
          const shot = () => p.screenshot({ clip: spot.rect });
          const a1 = await shot(); await p.waitForTimeout(250); const a2 = await shot();
          if (Buffer.compare(a1, a2) !== 0) { console.log(`  (drag Scene ${n}: gambar masih bergerak walau dibekukan; dilewati)`); continue; }
          await p.mouse.move(spot.x, spot.y);
          await p.mouse.down();
          for (let k = 1; k <= 8; k++) await p.mouse.move(spot.x + k * 14, spot.y + k * 4);
          await p.mouse.up();
          await p.waitForTimeout(500);
          const b = await shot();
          const moved = Buffer.compare(a2, b) !== 0;
          bump('drag viewport 3D', moved);
          if (!moved) fails.push(`${tag} Scene ${n}: drag di area kosong viewport 3D tidak memutar kamera`);
        }
        await p.evaluate(() => document.activeElement?.blur?.());
        await p.keyboard.press('f');
      }
      for (const e of [...new Set(errs)]) fails.push(`${tag}: ${e}`);
      await p.close();
    }
  }
  console.log('\nKlik ⓘ (daftar dari DOM, semua scene, Dark dan Light, 1280/1366/1920): berhasil / gagal per kelompok');
  for (const [k, v] of [...summary.entries()].sort()) console.log(`  ${k.padEnd(22)} ${String(v.ok).padStart(5)} / ${v.bad}`);
  return fails;
}

/**
 * Paket D1: bahasa ID. Di 1280 / 1366 / 1920 × Dark / Light dengan etel:lang = id: semua scene dan tab Scene 9 tanpa teks
 * meluber, grafik kosong, ⓘ bertumpuk, atau scroll horizontal (pemeriksaan sama dengan smoke utama). Di 1280 juga chip
 * status, tombol tab Scene 9, chip Formula, sakelar header, dan header kanan (tidak tumpang tindih) di setiap keadaan.
 * Angka HUD tidak lagi berformat en-US (titik desimal). Di 1366 Dark: ganti EN → ID tanpa muat ulang (label sakelar tema,
 * chip Formula, angka HUD, tabel Limits, halaman Regulations berganti; tiap angka = versi EN dengan koma/titik ditukar);
 * isian limit menerima "150,5" maupun "150.5"; isian salah → pesan galat berbahasa ID di dalam layar.
 */
async function langIdInteraction(browser, url) {
  const fails = [];
  const base = url.replace(/#.*$/, '');
  const tabsOf = (n) => (n === 9 ? ['1', '2', '3', '4', '5'] : n === 2 ? [null, '4'] : [null]);
  const swap = (t) => t.replace(/[.,]/g, (c) => (c === '.' ? ',' : '.'));
  /** Kotak kecil yang teksnya membesar di ID: teks tidak boleh keluar kotak / terpotong. */
  const tightOverflow = () => {
    const out = [];
    for (const el of document.querySelectorAll('.reg-chip, .seg__btn, .f-toggle, .theme-switch__btn, .lang-switch button, .reg__margin, .scene__controls .ctl__label')) {
      if (el.checkVisibility?.() === false) continue;
      const r = el.getBoundingClientRect();
      if (!r.width || !el.textContent.trim()) continue;
      const rg = document.createRange(); rg.selectNodeContents(el);
      const q = [...rg.getClientRects()].filter((x) => x.width > 0);
      const nm = `${el.className.split(/\s+/)[0]} "${el.textContent.trim().slice(0, 24)}"`;
      if (el.scrollWidth > el.clientWidth + 1 && el.clientWidth > 0) out.push(`${nm}: scrollWidth ${el.scrollWidth} > ${el.clientWidth}`);
      else if (q.some((x) => x.right > r.right + 1.5 || x.left < r.left - 1.5)) out.push(`${nm}: teks keluar kotak`);
      if (r.right > innerWidth + 0.5 || r.left < -0.5) out.push(`${nm}: keluar layar`);
    }
    return out;
  };
  const hudTexts = () => [...document.querySelectorAll('.hud__value .v')].filter((e) => e.checkVisibility?.() !== false).map((e) => e.textContent.trim());
  let states = 0, commaSeen = 0;
  for (const [w, h] of VIEWPORTS) {
    for (const theme of ['dark', 'light']) {
      const tag = `${w}×${h} ${theme} ID`;
      const p = await browser.newPage({ viewport: { width: w, height: h } });
      const errs = [];
      p.on('pageerror', (e) => errs.push(`pageerror: ${e.message}`));
      await p.addInitScript(([t]) => { try { localStorage.setItem('etel:lang', 'id'); localStorage.setItem('etel:theme', t); } catch { /* storage diblokir */ } }, [theme]);
      await p.goto(`${base}#/scene/1`);
      await p.waitForFunction(() => window.__etelDebug?.scene() === 1 && !window.__etelDebug.loading(), null, { timeout: 30000 });
      const sw = await p.evaluate(() => ({ lang: window.__etelDebug.uiLang(), btn: [...document.querySelectorAll('.theme-switch__btn[data-theme]')].map((b) => b.textContent).join('/') }));
      if (sw.lang !== 'id' || sw.btn !== 'Gelap/Terang') fails.push(`${tag}: bahasa ${sw.lang}, sakelar tema "${sw.btn}" (harusnya Gelap/Terang)`);
      for (let n = 1; n <= 11; n++) {
        await goScene(p, n, 400);
        for (const tab of tabsOf(n)) {
          if (tab) { await p.keyboard.press(tab); await p.waitForTimeout(300); }
          const where = `${tag} Scene ${n}${tab ? ` tab ${tab}` : ''}`;
          let res = null;
          for (let t = 0; t <= TIMEOUT_MS; t += POLL_MS) {
            res = await p.evaluate(inspect, { minFill: MIN_FILL_PCT });
            if (res.charts.every((c) => c.ok)) break;
            await p.waitForTimeout(POLL_MS);
          }
          states++;
          if (res.hscroll) fails.push(`${where}: scroll horizontal`);
          for (const c of res.charts) if (!c.ok) fails.push(`${where}: grafik #${c.i} "${c.title}" kosong / tanpa tag / ⓘ (terisi ${c.pct} %${c.overlap?.length ? `, bertumpuk: ${c.overlap.join('; ')}` : ''})`);
          for (const o of res.overflow) fails.push(`${where}: teks meluber di ${o.el}: ${o.reasons[0]}`);
          for (const o of [...new Set(res.helpOverlap)]) fails.push(`${where}: bantuan ⓘ bertumpuk: ${o}`);
          if (res.topbarH > MAX_TOPBAR_PX) fails.push(`${where}: bilah atas ${res.topbarH} px`);
          if (w === 1280 || n === 1) {
            for (const o of await p.evaluate(headerOverlap)) fails.push(`${where}: header tumpang tindih: ${o}`);
            for (const o of await p.evaluate(tightOverflow)) fails.push(`${where}: luapan (1280, ID): ${o}`);
          }
          const nums = await p.evaluate(hudTexts);
          for (const t of nums) if (/\d\.\d{1,2}(?!\d)/.test(t)) fails.push(`${where}: angka HUD masih format en-US "${t}"`);
          commaSeen += nums.filter((t) => /\d,\d/.test(t)).length;
        }
      }
      for (const e of [...new Set(errs)]) fails.push(`${tag}: ${e}`);
      await p.close();
    }
  }
  if (commaSeen < 20) fails.push(`bahasa ID: hanya ${commaSeen} angka HUD berkoma desimal (format ID tidak aktif?)`);

  // ganti bahasa tanpa muat ulang (1366 Dark), isian koma / titik, pesan galat
  const p = await browser.newPage({ viewport: { width: 1366, height: 768 } });
  try {
    const errs = [];
    p.on('pageerror', (e) => errs.push(`pageerror: ${e.message}`));
    await p.addInitScript(() => { try { localStorage.setItem('etel:lang', 'en'); localStorage.setItem('etel:theme', 'dark'); } catch { /* */ } });
    await p.goto(`${base}#/scene/1`);
    await p.waitForFunction(() => window.__etelDebug?.scene() === 1 && !window.__etelDebug.loading(), null, { timeout: 30000 });
    await p.evaluate(() => { window.__noReload = 1; });
    // sakelar header; halaman penuh menutupi header → lewat hook debug (jalur langStore yang sama)
    const toLang = async (l) => {
      if (await p.evaluate(() => window.__etelDebug.page() != null)) await p.evaluate((x) => window.__etelDebug.setLang(x), l);
      else await p.click(`.topbar .lang-switch [data-lang="${l}"]`);
      await p.waitForFunction((x) => window.__etelDebug.uiLang() === x && !window.__etelDebug.loading(), l, { timeout: 15000 });
      await p.waitForTimeout(900); // fade-through pasang ulang scene
    };
    const stable = async (read) => { const a = await p.evaluate(read); await p.waitForTimeout(400); const b = await p.evaluate(read); return a.map((x, i) => (x === b[i] ? x : null)); };
    for (const n of [4, 5, 7]) {
      await goScene(p, n, 900);
      const en = await stable(hudTexts);
      const lab = await p.evaluate(() => ({ theme: document.querySelector('.theme-switch__btn[data-theme]')?.textContent, formula: document.querySelector('.f-toggle__label')?.textContent ?? null }));
      await toLang('id');
      const id = await stable(hudTexts);
      const lab2 = await p.evaluate(() => ({ theme: document.querySelector('.theme-switch__btn[data-theme]')?.textContent, formula: document.querySelector('.f-toggle__label')?.textContent ?? null, scene: window.__etelDebug.scene(), marker: window.__noReload }));
      if (lab2.marker !== 1) fails.push(`ganti bahasa Scene ${n}: halaman dimuat ulang`);
      if (lab2.scene !== n) fails.push(`ganti bahasa Scene ${n}: scene berubah ke ${lab2.scene}`);
      if (lab.theme !== 'Dark' || lab2.theme !== 'Gelap') fails.push(`ganti bahasa Scene ${n}: sakelar tema "${lab.theme}" → "${lab2.theme}"`);
      if (lab.formula != null && (lab.formula !== 'Formula' || lab2.formula !== 'Rumus')) fails.push(`ganti bahasa Scene ${n}: chip Formula "${lab.formula}" → "${lab2.formula}"`);
      if (en.length !== id.length) fails.push(`ganti bahasa Scene ${n}: jumlah angka HUD ${en.length} → ${id.length}`);
      let checked = 0;
      en.forEach((t, i) => { if (t == null || id[i] == null || !/\d[.,]\d/.test(t)) return; checked++; if (id[i] !== swap(t)) fails.push(`ganti bahasa Scene ${n}: HUD "${t}" → "${id[i]}" (harusnya "${swap(t)}")`); });
      if (!checked) fails.push(`ganti bahasa Scene ${n}: tidak ada angka desimal HUD untuk dibandingkan`);
      await toLang('en');
    }
    // tabel Limits (Scene 9 tab 1) dan halaman Regulations: angka ikut bahasa tanpa muat ulang
    await goScene(p, 9, 600);
    await p.keyboard.press('1'); await p.waitForTimeout(600);
    const limCells = () => [...document.querySelectorAll('.lim-tab__main [data-c="lv"], .lim-tab__main [data-c="model"]')].map((e) => e.textContent.trim());
    const l1 = await p.evaluate(limCells); await toLang('id'); const l2 = await p.evaluate(limCells);
    if (!l1.some((t) => /\d/.test(t))) fails.push('tabel Limits: tanpa angka');
    l1.forEach((t, i) => { if (/\d/.test(t) && l2[i] !== swap(t)) fails.push(`tabel Limits: "${t}" → "${l2[i]}" (harusnya "${swap(t)}")`); });
    await p.keyboard.press('g');
    await p.waitForFunction(() => window.__etelDebug.regulationsOpen(), null, { timeout: 5000 }).catch(() => fails.push('Regulations: tidak terbuka (G)'));
    const regCells = () => [...document.querySelectorAll('.regs__group .reg__table td:nth-child(2)')].map((e) => e.textContent.trim());
    const r1 = await p.evaluate(regCells); await toLang('en'); const r2 = await p.evaluate(regCells);
    if (!r1.length) fails.push('Regulations: tabel kosong');
    r1.forEach((t, i) => { if (r2[i] !== swap(t)) fails.push(`Regulations: "${t}" (ID) → "${r2[i]}" (EN)`); });
    if (!r1.some((t) => /\d\.\d{3}/.test(t))) fails.push(`Regulations (ID): tidak ada pemisah ribuan titik (${r1.slice(0, 4).join(', ')})`);
    await p.keyboard.press('Escape');
    // isian: koma dan titik desimal; galat berbahasa ID di dalam layar
    await toLang('id');
    await goScene(p, 6, 600);
    const nox = '.scene--partload [data-lim="nox"], [data-lim="nox"]';
    const typeIn = async (sel, text) => { await p.click(sel, { clickCount: 3 }); await p.keyboard.press('Control+A'); await p.keyboard.press('Backspace'); if (text) await p.keyboard.type(text); await p.keyboard.press('Tab'); await p.waitForTimeout(250); };
    for (const t of ['150,5', '150.5']) {
      await typeIn(nox, t);
      const st = await p.evaluate(() => ({ lim: window.__etelDebug.limits().nox, val: document.querySelector('[data-lim="nox"]').value }));
      if (Math.abs((st.lim ?? 0) - 150.5) > 1e-9 || st.val !== '150,5') fails.push(`isian limit "${t}": tersimpan ${st.lim}, tampil "${st.val}" (harusnya 150.5 / "150,5")`);
    }
    // kasus ambigu mengikuti bahasa: ID "1.500" = 1500 (titik ribuan), "1,500" = 1,5; "0.500" = 0,5
    for (const [t, want, shown] of [['1.500', 1500, '1500'], ['1,500', 1.5, '1,5'], ['0.500', 0.5, '0,5']]) {
      await typeIn(nox, t);
      const st = await p.evaluate(() => ({ lim: window.__etelDebug.limits().nox, val: document.querySelector('[data-lim="nox"]').value }));
      if (Math.abs((st.lim ?? 0) - want) > 1e-9 || st.val !== shown) fails.push(`isian limit ID "${t}": tersimpan ${st.lim}, tampil "${st.val}" (harusnya ${want} / "${shown}")`);
    }
    await typeIn(nox, '150,5'); // nilai sah terakhir sebelum dikosongkan
    await typeIn(nox, '');
    if ((await p.evaluate(() => window.__etelDebug.limits().nox)) !== null) fails.push('isian limit kosong: limit tidak dihapus');
    for (const e of [...new Set(errs)]) fails.push(`ganti bahasa: ${e}`);
  } catch (e) { fails.push(`ganti bahasa / isian: ${e.message.split('\n')[0]}`); }
  await p.close();
  console.log(`\nBahasa ID (D1): ${states} keadaan (scene + tab, 3 viewport × 2 tema), ${commaSeen} angka HUD berkoma desimal`);
  return fails;
}


/**
 * D3: Scene 1–4 dan grafiknya dalam ID dibandingkan dengan EN. Teks kanvas direkam dari fillText (kotak per teks, bingkai
 * terakhir tiap kanvas); yang dihitung: teks keluar kanvas dan teks bertumpuk. Hanya penambahan di ID terhadap EN yang
 * dilaporkan (cacat bawaan EN bukan urusan terjemahan). Juga: judul ID menuju panduan ⓘ yang sama, label 3D ikut bahasa
 * tanpa muat ulang, ganti bahasa saat scene berjalan tanpa galat konsol, dan footer PNG mengikuti bahasa.
 */
async function scenesIdFlow(browser, url, cfg) {
  const fails = [];
  const base = url.replace(/#.*$/, '');
  const REC = () => {
    if (window.__rec) return;
    window.__rec = { on: true, byCanvas: new Map(), all: [] };
    const P = CanvasRenderingContext2D.prototype, ft = P.fillText, st = P.strokeText, cr = P.clearRect, fr = P.fillRect;
    const reset = (ctx) => window.__rec.byCanvas.set(ctx.canvas, []);
    P.clearRect = function (x, y, w, h) { if (w >= this.canvas.width * 0.9 && h >= this.canvas.height * 0.9) reset(this); return cr.call(this, x, y, w, h); };
    P.fillRect = function (x, y, w, h) { if (w >= this.canvas.width * 0.9 && h >= this.canvas.height * 0.9 && this.canvas.isConnected) reset(this); return fr.call(this, x, y, w, h); };
    const note = (ctx, text, x, y) => {
      const R = window.__rec; if (!R.on) return;
      R.all.push(String(text));
      if (!ctx.canvas.isConnected) return;
      const m = ctx.measureText(String(text)), t = ctx.getTransform();
      const k = Math.hypot(t.a, t.b) || 1, rot = Math.abs(t.b) > 0.5;
      let w = m.width * k, h = (m.actualBoundingBoxAscent + m.actualBoundingBoxDescent) * k || 8 * k;
      let X = t.a * x + t.c * y + t.e, Y = t.b * x + t.d * y + t.f;
      if (rot) [w, h] = [h, w];
      const al = ctx.textAlign, bl = ctx.textBaseline;
      const left = rot ? X - w / 2 : al === 'center' ? X - w / 2 : al === 'right' || al === 'end' ? X - w : X;
      const top = rot ? Y - h / 2 : bl === 'top' || bl === 'hanging' ? Y : bl === 'middle' ? Y - h / 2 : Y - h;
      const arr = R.byCanvas.get(ctx.canvas) ?? []; R.byCanvas.set(ctx.canvas, arr);
      arr.push({ text: String(text), l: left, t: top, r: left + w, b: top + h });
    };
    P.fillText = function (text, x, y, mw) { note(this, text, x, y); return ft.call(this, text, x, y, mw); };
    P.strokeText = function (text, x, y, mw) { return st.call(this, text, x, y, mw); };
  };
  const measure = () => {
    const out = [];
    const TICK = /^[\d.,\s⁻⁰¹²³⁴⁵⁶⁷⁸⁹]+$/; // tick × tick bergantung tinggi grafik, bukan panjang teks (tinggi dijaga terpisah)
    for (const [cv, arr] of window.__rec.byCanvas) {
      if (!cv.isConnected || cv.checkVisibility?.() === false || !cv.width) continue;
      let over = 0, ov = 0; const detail = [];
      for (const a of arr) if (a.l < -1 || a.t < -1 || a.r > cv.width + 1 || a.b > cv.height + 1) { over++; detail.push(`keluar "${a.text}"`); }
      for (let i = 0; i < arr.length; i++) for (let j = i + 1; j < arr.length; j++) {
        const a = arr[i], b = arr[j];
        const iw = Math.min(a.r, b.r) - Math.max(a.l, b.l), ih = Math.min(a.b, b.b) - Math.max(a.t, b.t);
        if (iw > 2 && ih > 2 && a.text !== b.text && !(TICK.test(a.text) && TICK.test(b.text))) { ov++; detail.push(`"${a.text}" × "${b.text}" (${iw.toFixed(1)}×${ih.toFixed(1)} px)`); }
      }
      out.push({ key: `${(cv.closest('.chart')?.querySelector('.chart__title')?.textContent ?? cv.className).trim().slice(0, 28)}`, over, ov, n: arr.length, detail, h: Math.round(cv.getBoundingClientRect().height) });
    }
    return out;
  };
  /** Tanda tangan teks scene (DOM + kanvas) tanpa angka: dipakai membandingkan "ganti bahasa" dengan "muat langsung dalam ID". */
  const SIG = () => {
    const strip = (t) => t.replace(/[\d.,+\-−×%·()/:→≈=[\]]+/g, ' ').replace(/\s+/g, ' ').trim();
    const dom = new Set();
    for (const el of document.querySelectorAll('.scene *, .chart *')) {
      if (el.children.length || el.checkVisibility?.() === false || el.closest('.chart__tools')) continue;
      const t = strip(el.textContent ?? ''); if (/[A-Za-zÀ-ÿα-ωΑ-Ω]{2}/.test(t)) dom.add(t);
      for (const a of ['aria-label', 'title']) { const v = strip(el.getAttribute(a) ?? ''); if (/[A-Za-z]{2}/.test(v)) dom.add(`@${v}`); }
    }
    const cv = new Set();
    for (const [c, arr] of window.__rec.byCanvas) if (c.isConnected) for (const a of arr) { const t = strip(a.text); if (/[A-Za-z]{2}/.test(t)) cv.add(t); }
    return { dom: [...dom], cv: [...cv] };
  };
  const probe = async (p, n, tab) => {
    await goScene(p, n, 500);
    if (tab) { await p.keyboard.press(tab); await p.waitForTimeout(400); }
    await p.waitForTimeout(900);
    return p.evaluate(measure);
  };
  const tabsOf = (n) => cfg.tabs[n] ?? [null];
  const sums = (a) => ({ h: a.reduce((s, x) => s + x.h, 0), over: a.reduce((s, x) => s + x.over, 0), ov: a.reduce((s, x) => s + x.ov, 0), n: a.reduce((s, x) => s + x.n, 0) });
  let compared = 0, texts = 0;
  const fresh = {};
  for (const [w, h] of VIEWPORTS) {
    for (const theme of ['dark', 'light']) {
      const res = {};
      for (const lang of ['en', 'id']) {
        const p = await browser.newPage({ viewport: { width: w, height: h } });
        const errs = [];
        p.on('pageerror', (e) => errs.push(`pageerror: ${e.message}`));
        p.on('console', (m) => { if (m.type() === 'error') errs.push(`console: ${m.text()}`); });
        await p.addInitScript(REC);
        await p.addInitScript(([l, t]) => { try { localStorage.setItem('etel:lang', l); localStorage.setItem('etel:theme', t); } catch { /* */ } }, [lang, theme]);
        await p.goto(`${base}#/scene/1`);
        await p.waitForFunction(() => window.__etelDebug?.scene() === 1 && !window.__etelDebug.loading(), null, { timeout: 30000 });
        for (const n of cfg.scenes) for (const tab of tabsOf(n)) {
          const key = `Scene ${n}${tab ? ' Brayton' : ''}`;
          res[`${lang}|${key}`] = await probe(p, n, tab);
          if (lang === 'id' && w === 1366 && theme === 'dark' && !tab) { await p.waitForTimeout(2500); fresh[n] = await p.evaluate(SIG); } // grafik berbasis Worker (sapuan) butuh waktu
          if (lang === 'id') {
            // judul grafik ID → panduan yang sama dengan sisi EN
            const titles = await p.evaluate(() => [...document.querySelectorAll('.chart')].filter((c) => c.checkVisibility?.() !== false).map((c) => c.querySelector('.chart__title')?.textContent?.trim()).filter(Boolean));
            for (const t of titles) if (!(await p.evaluate((x) => window.__etelDebug.guideFor(x), t))) fails.push(`${w}×${h} ${theme} ${key}: judul ID "${t}" tanpa panduan ⓘ`);
            if (tab) { await p.keyboard.press('1'); await p.waitForTimeout(200); }
          } else if (tab) { await p.keyboard.press('1'); await p.waitForTimeout(200); }
        }
        for (const e of [...new Set(errs)]) fails.push(`${w}×${h} ${theme} ${lang}: ${e}`);
        texts += await p.evaluate(() => window.__rec.all.length);
        await p.close();
      }
      for (const k of Object.keys(res).filter((x) => x.startsWith('id|'))) {
        const name = k.slice(3), a = sums(res[`en|${name}`] ?? []), b = sums(res[k]);
        compared++;
        if (b.over > a.over) fails.push(`${w}×${h} ${theme} ${name}: teks kanvas keluar kotak ID ${b.over} > EN ${a.over} (${res[k].filter((x) => x.over).map((x) => `${x.key}: ${x.detail.join('; ')}`).join(', ')})`);
        if (b.ov > a.ov) fails.push(`${w}×${h} ${theme} ${name}: teks kanvas bertumpuk ID ${b.ov} > EN ${a.ov} (${res[k].filter((x) => x.ov).map((x) => `${x.key}: ${x.detail.join('; ')}`).join(', ')} | EN: ${(res[`en|${name}`] ?? []).filter((x) => x.ov).map((x) => x.detail.join('; ')).join(' / ')})`);
        if (cfg.heightGuard && b.h < a.h - 25) fails.push(`${w}×${h} ${theme} ${name}: grafik ID lebih pendek ${a.h - b.h} px dari EN (${b.h} vs ${a.h}); teks panel / HUD melipat lebih banyak`);
        if (b.n === 0) fails.push(`${w}×${h} ${theme} ${name}: tidak ada teks kanvas terekam`);
      }
    }
  }
  if (!texts) fails.push('perekam teks kanvas tidak menangkap apa pun');

  // ganti bahasa saat scene berjalan: label 3D, judul grafik, footer PNG; tanpa galat konsol / halaman, tanpa muat ulang
  const p = await browser.newPage({ viewport: { width: 1366, height: 768 }, acceptDownloads: true });
  try {
    const errs = [];
    p.on('pageerror', (e) => errs.push(`pageerror: ${e.message}`));
    p.on('console', (m) => { if (m.type() === 'error') errs.push(`console: ${m.text()}`); });
    await p.addInitScript(REC);
    await p.addInitScript(() => { try { localStorage.setItem('etel:lang', 'en'); localStorage.setItem('etel:theme', 'dark'); } catch { /* */ } });
    await p.goto(`${base}#/scene/1`);
    await p.waitForFunction(() => window.__etelDebug?.scene() === 1 && !window.__etelDebug.loading(), null, { timeout: 30000 });
    await p.evaluate(() => { window.__noReload = 1; });
    const toLang = async (l) => {
      await p.click(`.topbar .lang-switch [data-lang="${l}"]`);
      await p.waitForFunction((x) => window.__etelDebug.uiLang() === x && !window.__etelDebug.loading(), l, { timeout: 15000 });
      await p.waitForTimeout(1000);
    };
    const labels = () => [...document.querySelectorAll('.label3d')].filter((e) => e.checkVisibility?.() !== false).map((e) => e.textContent.trim()).filter(Boolean);
    const chartTitles = () => [...document.querySelectorAll('.chart .chart__title')].filter((e) => e.checkVisibility?.() !== false).map((e) => e.textContent.trim());
    for (const n of cfg.scenes) {
      await goScene(p, n, 900);
      const l1 = await p.evaluate(labels), c1 = await p.evaluate(chartTitles);
      await toLang('id');
      let c2 = await p.evaluate(chartTitles);
      for (let t = 0; t < 8 && c2.join('|') === c1.join('|'); t++) { await p.waitForTimeout(500); c2 = await p.evaluate(chartTitles); } // fade-through memasang ulang scene
      const l2 = await p.evaluate(labels);
      await p.waitForTimeout(2500);
      const sw = await p.evaluate(SIG);
      if (fresh[n]) {
        const miss = (x, y) => x.filter((t) => !y.includes(t));
        const dd = miss(sw.dom, fresh[n].dom), cc = miss(sw.cv, fresh[n].cv);
        if (dd.length) fails.push(`ganti bahasa Scene ${n}: teks DOM berbeda dari muat langsung ID: ${dd.slice(0, 6).join(' | ')}`);
        if (cc.length) fails.push(`ganti bahasa Scene ${n}: teks kanvas berbeda dari muat langsung ID: ${cc.slice(0, 6).join(' | ')}`);
      }
      if (await p.evaluate(() => window.__noReload) !== 1) fails.push(`ganti bahasa Scene ${n}: halaman dimuat ulang`);
      if (!c1.length || c1.join('|') === c2.join('|')) fails.push(`ganti bahasa Scene ${n}: judul grafik tidak berubah (${c1.join(' / ')})`);
      if (l1.length && l1.join('|') === l2.join('|')) fails.push(`ganti bahasa Scene ${n}: label 3D tidak berubah (${l1.join(' / ')})`);
      if (n === cfg.scenes[0]) {
        await p.evaluate(() => { window.__rec.all.length = 0; document.activeElement?.blur?.(); });
        try {
          await Promise.all([p.waitForEvent('download', { timeout: 30000 }), p.keyboard.press('s')]);
          await p.waitForTimeout(600);
          const foot = await p.evaluate(() => window.__rec.all.filter((t) => /Emission Lab/.test(t)));
          if (!foot.some((t) => /indikatif/.test(t))) fails.push(`PNG (ID): footer tanpa "indikatif" (${foot.join(' | ').slice(0, 120) || 'tidak terekam'})`);
        } catch { fails.push('PNG (ID): ekspor S tidak menghasilkan unduhan'); }
      }
      await toLang('en');
    }
    // beberapa kali bolak-balik saat animasi berjalan
    await goScene(p, cfg.scenes[2], 600);
    for (let i = 0; i < 4; i++) { await toLang(i % 2 ? 'en' : 'id'); }
    for (const e of [...new Set(errs)]) fails.push(`ganti bahasa ${cfg.name}: ${e}`);
  } catch (e) { fails.push(`ganti bahasa ${cfg.name}: ${e.message.split('\n')[0]}`); }
  await p.close();
  console.log(`\n${cfg.name} Scene ${cfg.scenes[0]}–${cfg.scenes.at(-1)} (ID vs EN): ${compared} perbandingan teks kanvas (3 viewport × 2 tema), ${texts} teks kanvas terekam`);
  return fails;
}

const d3Interaction = (browser, url) => scenesIdFlow(browser, url, { name: 'D3', scenes: [1, 2, 3, 4], tabs: { 2: [null, '4'] } });

/**
 * D4: Scene 5–8 (teks kanvas ID vs EN, judul → panduan ⓘ, label 3D, PNG, bolak-balik bahasa) + panel kontrol yang padat
 * tanpa tumpang tindih di ID (3 viewport × 2 tema) + Scene 6: ganti bahasa saat chip dan garis batas tampil (isian koma / titik,
 * label garis batas di kanvas, chip tetap Within / Above / Not modeled).
 */
async function d4Interaction(browser, url) {
  const fails = await scenesIdFlow(browser, url, { name: 'D4', scenes: [5, 6, 7, 8], tabs: {}, heightGuard: true });
  const base = url.replace(/#.*$/, '');
  /** Elemen interaktif di panel kontrol (.scene__controls) yang saling menimpa, selain hubungan induk–anak. */
  const controlOverlap = () => {
    const els = [...document.querySelectorAll('.scene__controls .ctl, .scene__controls .btn, .scene__controls .btn-wrap, .scene__controls .seg, .scene__controls .lim__in, .scene__controls .num-err')]
      .filter((e) => e.checkVisibility?.() !== false && e.getBoundingClientRect().width > 0 && (e.textContent.trim() || e.matches('.lim__in')));
    const out = [];
    for (let i = 0; i < els.length; i++) for (let j = i + 1; j < els.length; j++) {
      const a = els[i], b = els[j];
      if (a.contains(b) || b.contains(a)) continue;
      const r = a.getBoundingClientRect(), q = b.getBoundingClientRect();
      const iw = Math.min(r.right, q.right) - Math.max(r.left, q.left), ih = Math.min(r.bottom, q.bottom) - Math.max(r.top, q.top);
      if (iw > 2 && ih > 2) out.push(`"${a.textContent.trim().slice(0, 22)}" × "${b.textContent.trim().slice(0, 22)}" (${iw.toFixed(0)}×${ih.toFixed(0)} px)`);
    }
    const lab = [...document.querySelectorAll('.scene__controls .ctl__label, .scene__controls .btn')].filter((e) => e.checkVisibility?.() !== false)
      .filter((e) => e.scrollWidth > e.clientWidth + 1 && e.clientWidth > 0).map((e) => `teks terpotong "${e.textContent.trim().slice(0, 28)}" (${e.scrollWidth} > ${e.clientWidth})`);
    return [...out, ...lab];
  };
  let states = 0;
  for (const [w, h] of VIEWPORTS) {
    for (const theme of ['dark', 'light']) {
      const p = await browser.newPage({ viewport: { width: w, height: h } });
      const errs = [];
      p.on('pageerror', (e) => errs.push(`pageerror: ${e.message}`));
      p.on('console', (m) => { if (m.type() === 'error') errs.push(`console: ${m.text()}`); });
      await p.addInitScript(([t]) => { try { localStorage.setItem('etel:lang', 'id'); localStorage.setItem('etel:theme', t); } catch { /* */ } }, [theme]);
      await p.goto(`${base}#/scene/5`);
      await p.waitForFunction(() => window.__etelDebug?.scene() === 5 && !window.__etelDebug.loading(), null, { timeout: 30000 });
      for (const n of [5, 6, 7, 8]) {
        await goScene(p, n, 700);
        states++;
        for (const o of await p.evaluate(controlOverlap)) fails.push(`${w}×${h} ${theme} ID Scene ${n}: panel kontrol: ${o}`);
        const res = await p.evaluate(inspect, { minFill: MIN_FILL_PCT });
        for (const o of res.overflow) fails.push(`${w}×${h} ${theme} ID Scene ${n}: teks meluber di ${o.el}: ${o.reasons[0]}`);
        for (const o of [...new Set(res.helpOverlap)]) fails.push(`${w}×${h} ${theme} ID Scene ${n}: bantuan ⓘ bertumpuk: ${o}`);
        if (res.hscroll) fails.push(`${w}×${h} ${theme} ID Scene ${n}: scroll horizontal`);
      }
      for (const e of [...new Set(errs)]) fails.push(`${w}×${h} ${theme} ID: ${e}`);
      await p.close();
    }
  }

  // Scene 6: chip dan garis batas saat bahasa berganti
  const p = await browser.newPage({ viewport: { width: 1366, height: 768 } });
  try {
    const errs = [];
    p.on('pageerror', (e) => errs.push(`pageerror: ${e.message}`));
    p.on('console', (m) => { if (m.type() === 'error') errs.push(`console: ${m.text()}`); });
    await p.addInitScript(() => {
      window.__ft = [];
      const ft = CanvasRenderingContext2D.prototype.fillText;
      CanvasRenderingContext2D.prototype.fillText = function (t, x, y, m) { window.__ft.push(String(t)); return ft.call(this, t, x, y, m); };
      try { localStorage.setItem('etel:lang', 'en'); localStorage.setItem('etel:theme', 'dark'); } catch { /* */ }
    });
    await p.goto(`${base}#/scene/6`);
    await p.waitForFunction(() => window.__etelDebug?.scene() === 6 && !window.__etelDebug.loading(), null, { timeout: 30000 });
    await p.evaluate(() => { window.__noReload = 1; });
    await p.waitForTimeout(900);
    const typeIn = async (sel, text) => { await p.click(sel, { clickCount: 3 }); await p.keyboard.press('Control+A'); await p.keyboard.press('Backspace'); await p.keyboard.type(text); await p.keyboard.press('Tab'); await p.waitForTimeout(500); };
    await typeIn('[data-lim="co"]', '30.5');
    const regLine = () => p.evaluate(() => document.querySelector('.pl-reg [data-k="regline"]')?.textContent.trim() ?? '');
    const lim = () => p.evaluate(() => ({ co: window.__etelDebug.limits().co, val: document.querySelector('[data-lim="co"]').value }));
    const toLang = async (l) => {
      await p.evaluate(() => { window.__ft.length = 0; });
      await p.click(`.topbar .lang-switch [data-lang="${l}"]`);
      await p.waitForFunction((x) => window.__etelDebug.uiLang() === x && !window.__etelDebug.loading(), l, { timeout: 15000 });
      await p.waitForTimeout(1200);
    };
    let line = await regLine();
    if (!/\b(Within|Above|Not modeled)\b/.test(line) || !/indicative/.test(line) || !/margin [+−-]?\d+\.\d %/.test(line)) fails.push(`Scene 6 EN: baris chip "${line.slice(0, 160)}"`);
    if (!/CO (Within|Above)/.test(line)) fails.push(`Scene 6 EN: CO tanpa chip setelah isian nilai izin/OEM: "${line.slice(0, 160)}"`);
    if ((await lim()).co !== 30.5 || (await lim()).val !== '30.5') fails.push(`Scene 6 EN: isian CO "30.5" → ${JSON.stringify(await lim())}`);
    await toLang('id');
    const ftId = await p.evaluate(() => window.__ft.join('\n'));
    for (const t of ['CO: nilai izin/OEM (isian pengguna)', 'Batas NOx (regulasi)']) if (!ftId.includes(t)) fails.push(`Scene 6 ID: garis batas di kanvas tanpa "${t}"`);
    if (/NOx limit \(regulation\)|permit\/OEM value/.test(ftId)) fails.push('Scene 6 ID: label garis batas masih English di kanvas');
    line = await regLine();
    if (!/\b(Within|Above|Not modeled)\b/.test(line)) fails.push(`Scene 6 ID: chip bukan Within / Above / Not modeled: "${line.slice(0, 160)}"`);
    if (!/indikatif/.test(line) || /indicative/.test(line)) fails.push(`Scene 6 ID: baris chip tanpa "indikatif" / masih English: "${line.slice(0, 160)}"`);
    if (!/margin [+−-]?\d+,\d %/.test(line)) fails.push(`Scene 6 ID: margin tanpa koma desimal: "${line.slice(0, 160)}"`);
    if (/\b(lulus|patuh|compliant)\b/i.test(line)) fails.push(`Scene 6 ID: baris chip terbaca sebagai klaim kepatuhan: "${line.slice(0, 160)}"`);
    if ((await lim()).co !== 30.5 || (await lim()).val !== '30,5') fails.push(`Scene 6 ID: isian CO tampil "${(await lim()).val}" (harusnya "30,5", nilai 30.5)`);
    await typeIn('[data-lim="co"]', '12'); // dekat nilai model CO → margin < 10 %: keterangan ketidakpastian model
    line = await regLine();
    if (!/margin lebih kecil daripada ketidakpastian model/.test(line)) fails.push(`Scene 6 ID: margin kecil tanpa keterangan "margin lebih kecil daripada ketidakpastian model": "${line.slice(0, 200)}"`);
    await typeIn('[data-lim="co"]', '1.500,5');
    if ((await lim()).co !== 1500.5) fails.push(`Scene 6 ID: isian "1.500,5" tersimpan ${(await lim()).co}`);
    await typeIn('[data-lim="co"]', '30,5');
    await toLang('en');
    const ftEn = await p.evaluate(() => window.__ft.join('\n'));
    for (const t of ['CO: permit/OEM value (user input)', 'NOx limit (regulation)']) if (!ftEn.includes(t)) fails.push(`Scene 6 EN: garis batas di kanvas tanpa "${t}"`);
    if ((await lim()).val !== '30.5') fails.push(`Scene 6 EN: isian CO tampil "${(await lim()).val}" (harusnya "30.5")`);
    if (await p.evaluate(() => window.__noReload) !== 1) fails.push('Scene 6: halaman dimuat ulang saat ganti bahasa');
    for (let i = 0; i < 4; i++) await toLang(i % 2 ? 'en' : 'id');
    for (const e of [...new Set(errs)]) fails.push(`Scene 6 ganti bahasa: ${e}`);
  } catch (e) { fails.push(`Scene 6 ganti bahasa: ${e.message.split('\n')[0]}`); }
  await p.close();
  console.log(`\nD4 panel kontrol ID Scene 5–8: ${states} keadaan (3 viewport × 2 tema)`);
  return fails;
}

/**
 * D2: galat isian angka di slot tetap di bawah kotak (ui/numberInput.js). Di 1280 × {EN, ID} × {Dark, Light}, lima tempat isian
 * (limit NOx / CO Scene 6, site data nilai / O₂ dan sulfur di Scene 9 Limits, target Calibration Scene 4, O₂ acuan panel H):
 * ketik nilai salah → pesan muncul dalam bahasa aktif, tidak terpotong (tanpa elipsis), tidak keluar layar, tidak tertutup
 * elemen lain, dan TATA LETAK TIDAK BERGESER (kotak grup, grafik, tabel, panel memiliki ukuran dan posisi yang sama
 * sebelum dan sesudah galat). Nilai yang salah tidak disimpan (aria-invalid).
 */
async function numberErrorsInteraction(browser, url) {
  const fails = [];
  const base = url.replace(/#.*$/, '');
  const MSG = { en: /Not a number|Minimum|Maximum|Must be above/, id: /Bukan angka|Minimal|Maksimal|Harus lebih dari/ };
  const layout = () => [...document.querySelectorAll('.scene__controls, .chart, .lim-tab__main, .lim-tab__cov, .cal-panel, .asm__grid, .reg__table, .ctl--lim, .reg__site')]
    .filter((e) => e.checkVisibility?.() !== false)
    .map((e) => { const r = e.getBoundingClientRect(); return `${e.className.split(' ')[0]}@${Math.round(r.left * 10)},${Math.round(r.top * 10)},${Math.round(r.width * 10)},${Math.round(r.height * 10)}`; }).join('|');
  const slotInfo = (sel) => {
    const input = document.querySelector(sel);
    const id = input.getAttribute('aria-describedby');
    const slot = id ? document.getElementById(id) : input.closest('.num-field')?.querySelector('.num-err');
    if (!slot) return { text: null };
    const r = slot.getBoundingClientRect();
    const was = slot.style.pointerEvents; slot.style.pointerEvents = 'auto';
    const pts = [[r.left + 3, r.top + r.height / 2], [r.left + Math.min(r.width, slot.scrollWidth) - 3, r.top + r.height / 2]];
    const covered = pts.some(([x, y]) => { const t = document.elementFromPoint(x, y); return !(t && (t === slot || slot.contains(t))); });
    slot.style.pointerEvents = was;
    return {
      text: slot.textContent.trim() || null, clipped: slot.scrollWidth > slot.clientWidth + 1, covered,
      inside: r.left >= 0 && r.top >= 0 && r.right <= innerWidth + 0.5 && r.bottom <= innerHeight + 0.5, h: Math.round(r.height), invalid: input.getAttribute('aria-invalid'),
    };
  };
  for (const lang of ['en', 'id']) {
    for (const theme of ['dark', 'light']) {
      const tag = `1280×720 ${lang.toUpperCase()} ${theme}`;
      const p = await browser.newPage({ viewport: { width: 1280, height: 720 } });
      const errs = [];
      p.on('pageerror', (e) => errs.push(`pageerror: ${e.message}`));
      await p.addInitScript(([l, t]) => { try { localStorage.setItem('etel:lang', l); localStorage.setItem('etel:theme', t); } catch { /* storage diblokir */ } }, [lang, theme]);
      await p.goto(`${base}#/scene/6`);
      await p.waitForFunction(() => window.__etelDebug?.scene() === 6 && !window.__etelDebug.loading(), null, { timeout: 30000 });
      await p.waitForTimeout(500);
      const probe = async (what, sel, text, pre) => {
        try {
          if (pre) await pre();
          await p.waitForSelector(sel, { state: 'visible', timeout: 5000 });
          const before = await p.evaluate(layout);
          await p.click(sel, { clickCount: 3 }); await p.keyboard.press('Control+A'); await p.keyboard.press('Backspace'); await p.keyboard.type(text);
          await p.waitForTimeout(100);
          await p.keyboard.press('Tab'); await p.waitForTimeout(250);
          const info = await p.evaluate(slotInfo, sel), after = await p.evaluate(layout);
          if (!info.text || !MSG[lang].test(info.text)) fails.push(`${tag} ${what} "${text}": pesan galat ${lang.toUpperCase()} tidak ada / salah bahasa ("${info.text}")`);
          else {
            if (info.clipped) fails.push(`${tag} ${what}: pesan galat terpotong ("${info.text}")`);
            if (!info.inside) fails.push(`${tag} ${what}: pesan galat keluar layar`);
            if (info.covered) fails.push(`${tag} ${what}: pesan galat tertutup elemen lain`);
            if (info.h > 16) fails.push(`${tag} ${what}: slot galat ${info.h} px (harusnya satu baris tetap 14 px)`);
          }
          if (info.invalid !== 'true') fails.push(`${tag} ${what}: aria-invalid ${info.invalid}`);
          if (before !== after) fails.push(`${tag} ${what}: tata letak bergeser saat galat muncul`);
          // koreksi: nilai sah menghapus galat
          await p.click(sel, { clickCount: 3 }); await p.keyboard.press('Control+A'); await p.keyboard.type(what.includes('O₂') ? '15' : '1'); await p.keyboard.press('Tab'); await p.waitForTimeout(200);
        } catch (e) { fails.push(`${tag} ${what}: ${e.message.split('\n')[0]}`); }
      };
      await probe('limit NOx', '[data-lim="nox"]', 'abc');
      await probe('limit CO', '[data-lim="co"]', '-5');
      await p.evaluate(() => window.__etelDebug.goToScene(9));
      await p.waitForFunction(() => window.__etelDebug.scene() === 9 && !window.__etelDebug.loading());
      await p.keyboard.press('1'); await p.waitForTimeout(700);
      await probe('site data nilai', '.pol-limits [data-f="value"]', 'abc');
      await probe('site data O₂', '.pol-limits [data-f="o2"]', '99');
      await probe('sulfur bahan bakar', '[data-v="sulfur"]', 'x');
      await p.evaluate(() => window.__etelDebug.goToScene(4));
      await p.waitForFunction(() => window.__etelDebug.scene() === 4 && !window.__etelDebug.loading());
      await p.waitForTimeout(500);
      await probe('target Calibration', '[data-in="diesel"]', '0', async () => { await p.evaluate(() => document.activeElement?.blur?.()); await p.keyboard.press('c'); await p.waitForTimeout(400); });
      await p.click('[data-apply="diesel"]').catch(() => {});
      await p.keyboard.press('c'); await p.waitForTimeout(200);
      await probe('O₂ acuan (panel H)', '[data-o2]', '99', async () => { await p.evaluate(() => document.activeElement?.blur?.()); await p.keyboard.press('h'); await p.waitForTimeout(400); });
      await p.keyboard.press('Escape');
      for (const e of [...new Set(errs)]) fails.push(`${tag}: ${e}`);
      await p.close();
    }
  }
  return fails;
}

/**
 * D2: jendela presenter ikut sakelar EN ↔ ID tanpa muat ulang. Jendela presenter (popup) dan panel presenter di halaman
 * (popup diblokir): judul, tombol, label, dan format angka berganti; catatan presenter tetap Indonesia (lang="id", teks
 * tidak berubah); timer tetap jalan. Format angka dicek lewat hook window.__etelPresenter di jendela presenter.
 */
async function presenterLangInteraction(browser, url) {
  const fails = [];
  const base = url.replace(/#.*$/, '');
  const ctx = await browser.newContext({ viewport: { width: 1366, height: 768 }, locale: 'en-US' });
  const pageErrs = [];
  try {
    const page = await ctx.newPage();
    page.on('pageerror', (e) => pageErrs.push(`utama: ${e.message}`));
    await page.addInitScript(() => { try { localStorage.setItem('etel:lang', 'en'); } catch { /* */ } });
    await page.goto(`${base}#/scene/3`);
    await page.waitForFunction(() => window.__etelDebug?.scene() === 3 && !window.__etelDebug.loading(), null, { timeout: 30000 });
    const [popup] = await Promise.all([page.waitForEvent('popup', { timeout: 15000 }), page.keyboard.press('p')]);
    popup.on('pageerror', (e) => pageErrs.push(`presenter: ${e.message}`));
    await popup.waitForLoadState();
    await popup.waitForFunction(() => /Scene 3\b/.test(document.querySelector('[data-v="current"]')?.textContent ?? ''), null, { timeout: 15000 });
    const popState = () => popup.evaluate(() => ({
      eyebrow: document.querySelector('.pres__eyebrow')?.textContent, next: document.querySelector('[data-k="next"]')?.textContent, toggle: document.querySelector('[data-toggle]')?.textContent,
      reset: document.querySelector('[data-reset]')?.textContent, keys: document.querySelector('[data-k="keysHint"]')?.textContent, status: document.querySelector('[data-v="status"]')?.textContent,
      title: document.title, notes: document.querySelector('[data-v="notes"]')?.textContent, keyMsg: document.querySelector('[data-v="key"]')?.textContent,
      notesLang: document.querySelector('[data-v="notes"]')?.lang, mark: window.__presMark, num: window.__etelPresenter?.sample(), numLang: window.__etelPresenter?.numLang(), hscroll: document.documentElement.scrollWidth > innerWidth + 1,
      timer: document.querySelector('[data-v="total"]')?.textContent,
    }));
    await popup.evaluate(() => { window.__presMark = 1; });
    const en = await popState();
    if (en.eyebrow !== 'Presenter' || en.toggle !== 'Start' || en.reset !== 'Reset' || en.next !== 'Next scene') fails.push(`presenter EN: label awal ${JSON.stringify({ e: en.eyebrow, t: en.toggle, r: en.reset, n: en.next })}`);
    if (en.numLang !== 'en' || en.num !== '1,500.5') fails.push(`presenter EN: format angka ${en.numLang} / ${en.num}`);
    if (en.notesLang !== 'id' || !/\b(yang|dan|dengan|untuk|tidak|adalah)\b/.test(en.notes + ' ' + en.keyMsg)) fails.push('presenter EN: catatan presenter tidak berbahasa Indonesia');
    // ganti ke ID di jendela utama (sakelar header)
    await page.bringToFront();
    await page.click('.topbar .lang-switch [data-lang="id"]');
    await page.waitForFunction(() => window.__etelDebug.uiLang() === 'id', null, { timeout: 15000 });
    await popup.waitForFunction(() => document.querySelector('.pres__eyebrow')?.textContent === 'Presenter' && document.querySelector('[data-toggle]')?.textContent === 'Mulai', null, { timeout: 8000 })
      .catch(() => fails.push('presenter: jendela presenter tidak berganti ke ID setelah sakelar (event storage)'));
    const id = await popState();
    if (id.mark !== 1) fails.push('presenter: jendela presenter dimuat ulang saat bahasa berganti');
    if (id.toggle !== 'Mulai' || id.reset !== 'Atur ulang' || id.next !== 'Scene berikutnya' || !/Spasi/.test(id.keys ?? '')) fails.push(`presenter ID: label ${JSON.stringify({ t: id.toggle, r: id.reset, n: id.next, k: id.keys })}`);
    if (id.status !== 'BERJALAN' && id.status !== 'DIJEDA') fails.push(`presenter ID: status "${id.status}"`);
    if (id.numLang !== 'id' || id.num !== '1.500,5') fails.push(`presenter ID: format angka ${id.numLang} / ${id.num} (harusnya id / 1.500,5)`);
    if (!/Presenter/.test(id.title)) fails.push(`presenter ID: judul dokumen "${id.title}"`);
    if (id.notes !== en.notes || id.keyMsg !== en.keyMsg || id.notesLang !== 'id') fails.push('presenter ID: catatan presenter berubah (harusnya tetap Indonesia dan sama)');
    if (id.hscroll) fails.push('presenter ID: scroll horizontal');
    // timer tetap jalan setelah ganti bahasa; kembali ke EN
    await popup.bringToFront();
    await popup.click('[data-toggle]');
    await popup.waitForTimeout(2600);
    const t1 = await popup.evaluate(() => document.querySelector('[data-v="total"]').textContent);
    if (t1 === '00:00') fails.push('presenter ID: timer tidak berjalan setelah ganti bahasa');
    await popup.evaluate(() => document.querySelector('[data-toggle]').click());
    await page.click('.topbar .lang-switch [data-lang="en"]');
    await popup.waitForFunction(() => document.querySelector('[data-reset]')?.textContent === 'Reset' && window.__etelPresenter.numLang() === 'en', null, { timeout: 8000 })
      .catch(() => fails.push('presenter: jendela presenter tidak kembali ke EN'));
    await popup.close().catch(() => {});
    await page.close();

    // panel presenter di halaman (popup diblokir)
    const page2 = await ctx.newPage();
    page2.on('pageerror', (e) => pageErrs.push(`panel: ${e.message}`));
    await page2.addInitScript(() => { try { localStorage.setItem('etel:lang', 'en'); } catch { /* */ } window.open = () => null; });
    await page2.goto(`${base}#/scene/3`);
    await page2.waitForFunction(() => window.__etelDebug?.scene() === 3 && !window.__etelDebug.loading(), null, { timeout: 30000 });
    await page2.keyboard.press('p');
    await page2.waitForSelector('.pres-host .pres', { timeout: 8000 });
    await page2.evaluate(() => { window.__panelMark = 1; });
    const panel = () => page2.evaluate(() => ({
      eyebrow: document.querySelector('.pres-host .pres__eyebrow')?.textContent, close: document.querySelector('.pres-host [data-close]')?.textContent.replace(/\s+/g, ' ').trim(),
      note: document.querySelector('.pres-host [data-k="inPageNote"]')?.textContent, toggle: document.querySelector('.pres-host [data-toggle]')?.textContent, notes: document.querySelector('.pres-host [data-v="notes"]')?.textContent,
      notesLang: document.querySelector('.pres-host [data-v="notes"]')?.lang, mark: window.__panelMark, label: document.querySelector('.pres-host .pres')?.getAttribute('aria-label'),
      box: (() => { const r = document.querySelector('.pres-host')?.getBoundingClientRect(); return r ? r.left >= 0 && r.top >= 0 && r.right <= innerWidth + 1 && r.bottom <= innerHeight + 1 : false; })(), // kotak panel (isi boleh digulir)
    }));
    const pe = await panel();
    await page2.click('.topbar .lang-switch [data-lang="id"]');
    await page2.waitForFunction(() => document.querySelector('.pres-host [data-toggle]')?.textContent === 'Mulai', null, { timeout: 8000 }).catch(() => fails.push('panel presenter: tidak berganti ke ID'));
    const pi = await panel();
    if (pe.toggle !== 'Start' || !/Close/.test(pe.close ?? '')) fails.push(`panel presenter EN: ${JSON.stringify({ t: pe.toggle, c: pe.close })}`);
    if (pi.mark !== 1) fails.push('panel presenter: halaman dimuat ulang');
    if (!/Tutup/.test(pi.close ?? '') || !/menggantikan jendela kedua/.test(pi.note ?? '') || pi.label !== 'Presenter') fails.push(`panel presenter ID: ${JSON.stringify({ c: pi.close, n: pi.note, l: pi.label })}`);
    if (pi.notes !== pe.notes || pi.notesLang !== 'id') fails.push('panel presenter: catatan berubah (harusnya tetap Indonesia)');
    if (!pi.box) fails.push('panel presenter ID: keluar layar');
    await page2.close();
  } catch (e) { fails.push(`presenter bahasa: ${e.message.split('\n')[0]}`); }
  await ctx.close();
  for (const e of [...new Set(pageErrs)]) fails.push(`presenter bahasa: ${e}`);
  return fails;
}

/**
 * D2: kerangka dalam bahasa ID di 1280 / 1366 / 1920 × Dark / Light: navigasi kiri (terbuka dan dilipat), Settings,
 * dan halaman penuh (Regulations, References, Glossary, Emission formation, Assumptions) tanpa label terpotong, teks keluar
 * kotak, scroll horizontal, atau elemen di luar layar. Teks ID lebih panjang 20–30 %: navigasi dan Settings diperiksa khusus.
 */
async function idChromeInteraction(browser, url) {
  const fails = [];
  const base = url.replace(/#.*$/, '');
  /** Teks terpotong (ellipsis / overflow tersembunyi), teks keluar kotak induk, dan elemen di luar layar di dalam `root`. */
  const clipped = (rootSel) => {
    const root = document.querySelector(rootSel);
    if (!root) return [`${rootSel} tidak ada`];
    const out = [];
    const nm = (e) => `${e.tagName.toLowerCase()}.${String(e.className).split(' ')[0]} "${(e.textContent || '').trim().slice(0, 22)}"`;
    for (const el of root.querySelectorAll('*')) {
      if (el.closest('svg, canvas') || el.checkVisibility?.() === false) continue;
      const cs = getComputedStyle(el);
      const r = el.getBoundingClientRect();
      if (!r.width || !r.height) continue;
      if (el.children.length === 0 && el.textContent.trim() && (cs.overflow !== 'visible' || cs.textOverflow === 'ellipsis') && el.scrollWidth > el.clientWidth + 1) out.push(`${nm(el)}: terpotong (${el.scrollWidth} > ${el.clientWidth})`);
      if (r.right > innerWidth + 1 || r.left < -1) out.push(`${nm(el)}: di luar layar (${Math.round(r.left)}–${Math.round(r.right)})`);
      const pr = el.parentElement?.getBoundingClientRect();
      if (el.children.length === 0 && el.textContent.trim() && pr && cs.position !== 'fixed' && cs.position !== 'absolute' && pr.width > 0 && (r.right > pr.right + 2 || r.left < pr.left - 2) && getComputedStyle(el.parentElement).overflow === 'visible' && !el.closest('.nav__body, .refs__box, .asm__box, .settings-card__body')) out.push(`${nm(el)}: keluar kotak induk`);
    }
    return out.slice(0, 6);
  };
  for (const [w, h] of VIEWPORTS) {
    for (const theme of ['dark', 'light']) {
      const tag = `${w}×${h} ID ${theme}`;
      const p = await browser.newPage({ viewport: { width: w, height: h } });
      const errs = [];
      p.on('pageerror', (e) => errs.push(`pageerror: ${e.message}`));
      await p.addInitScript(([t]) => { try { localStorage.setItem('etel:lang', 'id'); localStorage.setItem('etel:theme', t); } catch { /* */ } }, [theme]);
      await p.goto(`${base}#/scene/1`);
      await p.waitForFunction(() => window.__etelDebug?.scene() === 1 && !window.__etelDebug.loading(), null, { timeout: 30000 });
      await p.waitForTimeout(400);
      // navigasi: dilipat (rail) lalu dibentangkan
      for (const mode of ['collapsed', 'expanded']) {
        const isCol = await p.evaluate(() => document.querySelector('.nav')?.classList.contains('is-collapsed'));
        if ((mode === 'collapsed') !== isCol) { await p.click('.nav__toggle'); await p.waitForTimeout(250); }
        for (const o of await p.evaluate(clipped, '.nav')) fails.push(`${tag} navigasi ${mode}: ${o}`);
        const nv = await p.evaluate(() => { const r = document.querySelector('.nav').getBoundingClientRect(); const items = [...document.querySelectorAll('.nav__item')].map((b) => { const q = b.getBoundingClientRect(); return { b: Math.round(q.bottom), h: Math.round(q.height) }; }); return { w: Math.round(r.width), bottom: Math.round(r.bottom), last: items.at(-1)?.b, vh: innerHeight, n: items.length, hs: document.documentElement.scrollWidth > innerWidth + 1 }; });
        if (nv.hs) fails.push(`${tag} navigasi ${mode}: scroll horizontal halaman`);
        if (mode === 'expanded' && nv.w > 260) fails.push(`${tag} navigasi terbuka ${nv.w} px (terlalu lebar untuk teks ID)`);
        // semua item tombol terjangkau (gulir di dalam navigasi diperbolehkan)
        if (nv.n < 20) fails.push(`${tag} navigasi ${mode}: hanya ${nv.n} item`);
        if (mode === 'expanded') { // label scene tidak terpotong
          const cut = await p.evaluate(() => [...document.querySelectorAll('.nav__label')].filter((e) => e.scrollWidth > e.clientWidth + 1).map((e) => e.textContent.trim()));
          if (cut.length) fails.push(`${tag} navigasi terbuka: label terpotong: ${cut.join(' | ')}`);
        }
      }
      await p.click('.nav__toggle'); await p.waitForTimeout(200); // kembali dilipat (bawaan layar kecil)
      // Settings
      await p.click('.settings-btn'); await p.waitForTimeout(300);
      for (const o of await p.evaluate(clipped, '.settings-card')) fails.push(`${tag} Settings: ${o}`);
      const sc = await p.evaluate(() => { const r = document.querySelector('.settings-card').getBoundingClientRect(); return r.left >= 0 && r.top >= 0 && r.right <= innerWidth && r.bottom <= innerHeight; });
      if (!sc) fails.push(`${tag} Settings: panel keluar layar`);
      await p.keyboard.press('Escape'); await p.waitForTimeout(150);
      // halaman penuh
      for (const [hash, sel, name] of [['#/regulations', '.refs--regs', 'Baku mutu'], ['#/references', '.refs:not(.refs--regs):not(.refs--formation):not(.refs--glossary)', 'References'], ['#/glossary', '.refs--glossary', 'Glossary'], ['#/formation', '.refs--formation', 'Emission formation']]) {
        await p.evaluate((x) => { location.hash = x; }, hash);
        await p.waitForSelector(`${sel}:not([hidden])`, { timeout: 8000 }).catch(() => fails.push(`${tag} ${name}: halaman tidak terbuka`));
        await p.waitForTimeout(350);
        const pg = await p.evaluate((s) => { const el = document.querySelector(s); const box = el?.querySelector('.refs__box'); return el && box ? { hs: box.scrollWidth > box.clientWidth + 1, title: el.querySelector('h2')?.textContent, close: el.querySelector('.refs__head .btn:last-child')?.textContent } : null; }, sel);
        if (!pg) { fails.push(`${tag} ${name}: kotak halaman tidak ada`); continue; }
        if (pg.hs) fails.push(`${tag} ${name}: scroll horizontal di dalam halaman`);
        if (pg.close !== 'Tutup') fails.push(`${tag} ${name}: tombol tutup "${pg.close}" (harusnya Tutup)`);
        if (name === 'Baku mutu' && pg.title !== 'Baku mutu') fails.push(`${tag} ${name}: judul "${pg.title}"`);
        for (const o of await p.evaluate(clipped, `${sel} .refs__head`)) fails.push(`${tag} ${name} kepala: ${o}`);
        await p.keyboard.press('Escape'); await p.waitForTimeout(200);
      }
      for (const e of [...new Set(errs)]) fails.push(`${tag}: ${e}`);
      await p.close();
    }
  }
  return fails;
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
    order: [...document.querySelector('.topbar__right').children].filter((el) => !el.matches('.calib-flag, .quality-flag, .help-btn, .settings-btn')).map((el) => el.className.split(' ').find((c) => /present-exit|lang-slot|theme-switch/.test(c)) ?? el.id),
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

  // 0) kunjungan pertama (D1): browser berbahasa English → English (learn.defaultLang tidak dipakai lagi)
  {
    const { p } = await open();
    await p.goto(base);
    await p.waitForFunction(() => window.__etelDebug?.learnView?.() === 'landing', null, { timeout: 30000 });
    const l0 = await p.evaluate(() => ({ lang: window.__etelDebug.uiLang(), host: document.querySelector('.learn-host')?.lang, stored: localStorage.getItem('etel:lang') }));
    if (l0.lang !== 'en' || l0.host !== 'en' || l0.stored !== null) fails.push(`landing: kunjungan pertama browser en-US → ${JSON.stringify(l0)} (harusnya en, tidak disimpan)`);
    await p.close();
  }
  // 1) alamat tanpa hash → landing; kunjungan pertama browser id-ID = id (navigator.language); empat kartu; hero tidak kosong
  {
    const { p, errs } = await open({ locale: 'id-ID' });
    await p.goto(base);
    await p.waitForFunction(() => window.__etelDebug?.learnView?.() === 'landing' && document.querySelectorAll('.lcard').length === 4, null, { timeout: 30000 });
    const st = await p.evaluate(() => ({ lang: window.__etelDebug.lang(), hostLang: document.querySelector('.learn-host')?.lang, scene: window.__etelDebug.scene(), cards: [...document.querySelectorAll('.lcard')].filter((c) => c.checkVisibility() && c.getBoundingClientRect().right <= innerWidth + 1).length, hscroll: document.documentElement.scrollWidth > innerWidth + 1, tag: document.getElementById('scene-tag').textContent, card0: document.querySelector('.lcard__title')?.textContent }));
    if (st.lang !== 'id' || st.hostLang !== 'id') fails.push(`landing: bahasa kunjungan pertama ${st.lang}/${st.hostLang} (harusnya id dari bahasa browser id-ID)`);
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

  // 1) daftar level (kunjungan pertama, browser id-ID = id; D1)
  const { p, errs } = await open({ locale: 'id-ID' });
  await p.goto(`${base}#/learn`);
  await p.waitForFunction(() => window.__etelDebug?.learnView?.() === 'learn' && document.querySelectorAll('.lvl').length === 6, null, { timeout: 30000 }).catch(() => fails.push('learn: daftar level tidak tampil'));
  const list = await p.evaluate(() => ({ lang: document.querySelector('.learn-host').lang, lessons: document.querySelectorAll('.lvl__link').length, banner: !!document.querySelector('.learn-page__draft'), cont: document.querySelector('.learn-page__continue')?.getAttribute('href'), resetDisabled: document.querySelector('.learn-page__reset button')?.disabled, cont0: document.querySelector('.learn-page__continue b')?.textContent, hs: document.documentElement.scrollWidth > innerWidth + 1 }));
  if (list.lang !== 'id') fails.push(`learn: bahasa kunjungan pertama ${list.lang} (browser id-ID)`);
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
    const flows = { numerr: numberErrorsInteraction, presenterlang: presenterLangInteraction, idchrome: idChromeInteraction, langid: langIdInteraction, d3: d3Interaction, d4: d4Interaction, learn: learnInteraction, chartguide: chartGuideInteraction, help: helpInteraction, helpclick: helpClickInteraction, settings: settingsInteraction, landing: landingInteraction, deeplinks: deepLinks, theme: themeInteraction };
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
        const label = `${w}×${h} · Scene ${n}${n === 2 && tab ? ' · Brayton' : tab ? ` · tab ${tab}` : ''}`;
        report.push({ label, charts: res.charts.map((c) => c.pct), overflow: res.overflow.length });
        if (n === 6) s6Heights.push(`${w}×${h}: ${res.charts.map((c) => `${c.cssH} px`).join(' / ')}`);
        if (res.hscroll) failures.push(`${label}: scroll horizontal`);
        for (const c of res.charts) if (!c.ok) failures.push(`${label}: grafik #${c.i} "${c.title}" kosong/0/tanpa tag Basis (canvas ${c.w}×${c.h}, css ${c.cssW}×${c.cssH}, terisi ${c.pct} %, minimum ${MIN_FILL_PCT} %, tag Basis ${c.basis ? 'ada' : 'HILANG'}, ⓘ ${c.guide ? 'ada' : 'HILANG'}${c.overlap?.length ? `, bertumpuk: ${c.overlap.join('; ')}` : ''})`);
        for (const o of res.overflow) failures.push(`${label}: teks meluber di ${o.el}: ${o.reasons[0]}`);
        for (const o of [...new Set(res.helpOverlap)]) failures.push(`${label}: bantuan ⓘ bertumpuk: ${o}`);
        if (n === 1 && !tab) for (const o of await page.evaluate(headerOverlap)) failures.push(`${label}: header tumpang tindih: ${o}`);
        if (n <= 9 && res.helpCount < 5) failures.push(`${label}: hanya ${res.helpCount} tombol bantuan ⓘ`);
        if (res.topbarH > MAX_TOPBAR_PX) failures.push(`${label}: bilah atas ${res.topbarH} px > ${MAX_TOPBAR_PX} px (pesan kunci terlalu banyak baris)`);
        // M11 Step 03: setiap judul grafik yang tampil punya panduan
        for (const c of res.charts) {
          const id = await page.evaluate((t) => window.__etelDebug.guideFor(t), c.title || (n === 2 ? 'Brayton schematic (state markers)' : ''));
          if (!id) failures.push(`${label}: grafik "${c.title}" tanpa panduan di Chart guide`);
        }
        if (SHOT_SCENES.has(n) && (!tab || tab === '1')) await page.screenshot({ path: `${SHOTS}/scene${n}-${w}x${h}.png` });
      }
      if (n === 2) { await page.keyboard.press('1'); await page.waitForTimeout(200); }
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
    if (w === 1366) failures.push(...await chartGuideInteraction(chromium.browser, srv.url));
    if (w === 1366) failures.push(...await helpInteraction(chromium.browser, srv.url));
    if (w === 1366) failures.push(...await settingsInteraction(chromium.browser, srv.url));
    if (w === 1366) failures.push(...await helpClickInteraction(chromium.browser, srv.url));
    if (w === 1366) failures.push(...await langIdInteraction(chromium.browser, srv.url));
    if (w === 1366) failures.push(...await d3Interaction(chromium.browser, srv.url));
    if (w === 1366) failures.push(...await d4Interaction(chromium.browser, srv.url));
    if (w === 1366) failures.push(...await presenterLangInteraction(chromium.browser, srv.url));
    if (w === 1366) failures.push(...await idChromeInteraction(chromium.browser, srv.url));
    if (w === 1280) failures.push(...await numberErrorsInteraction(chromium.browser, srv.url));
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
