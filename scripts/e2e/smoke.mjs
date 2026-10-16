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
 * Sengaja TIDAK memeriksa isi kartu info kiri Scene 9 (`.pol-card`): isinya akan dirombak.
 * Gagal (exit 1) bila ada grafik kosong, canvas 0, teks meluber, atau galat. Screenshot Scene 7 dan 9 disimpan di
 * scripts/e2e/shots/after/ (tidak di-commit).
 * Jalankan: npm run e2e:smoke   (build + skrip ini; butuh Playwright, lihat lib.mjs)
 * Catatan: tanpa GPU, Chromium memakai SwiftShader (rendering software); uji ini tidak bergantung pada fps.
 */
import { mkdirSync } from 'node:fs';
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
  await p2.waitForFunction(() => window.__etelDebug?.scene() != null, null, { timeout: 30000 });
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
  await p2.waitForFunction(() => window.__etelDebug?.scene() != null, null, { timeout: 30000 });
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
    await p.waitForFunction(() => window.__etelDebug?.scene() != null && !window.__etelDebug.loading(), null, { timeout: 30000 });
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
      if (after.page || after.paused) fails.push(`${hash}: Esc tidak menutup halaman / loop tidak lanjut`);
      if (!/^#\/scene\/\d+/.test(after.hash)) fails.push(`${hash}: setelah ditutup alamat ${after.hash} (harusnya #/scene/N)`);
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
  await page.keyboard.press('m'); await page.waitForTimeout(300);
  if ((await page.evaluate(() => window.__etelDebug.mode())) !== 'explore') fails.push('M: tidak kembali ke Explore');
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
  for (const [w, h] of VIEWPORTS) {
    const page = await chromium.browser.newPage({ viewport: { width: w, height: h } });
    const errs = [];
    page.on('pageerror', (e) => errs.push(`pageerror: ${e.message}`));
    page.on('console', (m) => { if (m.type() === 'error') errs.push(`console: ${m.text()}`); });
    await page.goto(srv.url);
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
    if (w === 1366) failures.push(...await modeInteraction(page));
    if (w === 1366) failures.push(...await deepLinks(chromium.browser, srv.url));
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
