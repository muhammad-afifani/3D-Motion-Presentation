/**
 * unitsnapLib.mjs — snapshot TEKS per scene (HUD, kontrol/slider termasuk min / max / step, overlay, pesan kunci, tooltip) dan
 * pembandingnya. Dipakai scripts/e2e/unitsnap.mjs (CLI) dan alur smoke `unitsnap`. Browser nyata, 1366×768, Dark; sudut engkol
 * dikunci (slider θ → 90°) supaya nilai tidak bergantung waktu.
 */
export const SNAP_TABS = { 2: [null, '4'], 9: ['1', '2', '3', '4', '5'] };
export const SELECTORS = ['#key-message', '.scene__hud', '.scene__controls', '.overlay', '.pl-hud__body', '.hud__note', '.pol-hud'];

/** Dijalankan di halaman. */
export function collectInPage(sels) {
  const out = {};
  const seen = new Set();
  for (const sel of sels) {
    const list = [];
    for (const el of document.querySelectorAll(sel)) {
      if (seen.has(el) || el.closest('.pres-host') || el.closest('.debug-overlay')) continue;
      seen.add(el);
      const tips = [...el.querySelectorAll('[data-tip]')].map((t) => t.dataset.tip);
      if (el.dataset.tip) tips.unshift(el.dataset.tip);
      const ranges = [...el.querySelectorAll('input[type=range]')].map((i) => `${i.min}|${i.max}|${i.step}|${i.value}`);
      const selects = [...el.querySelectorAll('select')].map((s) => [...s.options].map((o) => o.textContent).join('/'));
      list.push({ text: el.innerText.replace(/[ \t]+\n/g, '\n').trim(), tips, ranges, selects });
    }
    if (list.length) out[sel] = list;
  }
  return out;
}

/** Kunci sudut engkol ke 90° lewat slider θ (menjeda animasi). */
export function lockTheta() {
  for (const inp of document.querySelectorAll('.ctl--slider')) {
    const lab = inp.querySelector('label')?.textContent ?? '';
    if (/Crank angle|Sudut engkol/.test(lab)) { const i = inp.querySelector('input'); i.value = '90'; i.dispatchEvent(new Event('input', { bubbles: true })); }
  }
}

/** Satu keadaan scene (setelah scene siap): kunci θ lalu kumpulkan teks. */
export async function snapScene(p) {
  await p.evaluate(lockTheta);
  await p.waitForTimeout(700);
  return p.evaluate(collectInPage, SELECTORS);
}

/**
 * Semua scene 1–11 (+ tab) untuk bahasa tertentu pada satu halaman yang sudah dibuka di #/scene/1.
 * @returns {Promise<Record<string, any>>} kunci "S<n>[.<tab>]|<lang>"
 */
export async function snapAllScenes(p, lang) {
  const snap = {};
  for (let n = 1; n <= 11; n++) {
    await p.evaluate((k) => window.__etelDebug.goToScene(k), n);
    await p.waitForFunction((k) => window.__etelDebug.scene() === k && !window.__etelDebug.loading(), n, { timeout: 30000 });
    for (const tab of SNAP_TABS[n] ?? [null]) {
      if (tab) await p.keyboard.press(tab);
      await p.waitForTimeout(900);
      snap[`S${n}${tab ? `.${tab}` : ''}|${lang}`] = await snapScene(p);
    }
    if (n === 2) { await p.keyboard.press('1'); await p.waitForTimeout(200); }
  }
  return snap;
}

/** Bandingkan dua snapshot; kembalikan daftar beda (kosong = identik). */
export function diffSnapshots(gold, snap, limit = 200) {
  const diffs = [];
  for (const k of new Set([...Object.keys(gold), ...Object.keys(snap)])) {
    const a = JSON.stringify(gold[k] ?? null, null, 1).split('\n'), b = JSON.stringify(snap[k] ?? null, null, 1).split('\n');
    const lim = Math.max(a.length, b.length);
    for (let i = 0; i < lim; i++) if (a[i] !== b[i]) { diffs.push(`${k}: golden ${a[i]?.trim().slice(0, 140)}  ≠  kini ${b[i]?.trim().slice(0, 140)}`); if (diffs.length >= limit) return diffs; }
  }
  return diffs;
}

/**
 * Ambil snapshot semua scene untuk EN dan ID. init = fungsi untuk addInitScript (menerima [lang, ...extra]).
 * @param {any} browser @param {string} base alamat tanpa hash @param {{langs?:string[], flag?:boolean, choice?:string|null}} [o]
 */
export async function snapshotAll(browser, base, { langs = ['en', 'id'], flag = false, choice = null } = {}) {
  const snap = {};
  for (const lang of langs) {
    const ctx = await browser.newContext({ viewport: { width: 1366, height: 768 } });
    const p = await ctx.newPage();
    const errs = [];
    p.on('pageerror', (e) => errs.push(e.message));
    await p.addInitScript(([l, flagOn, ch]) => {
      try {
        localStorage.setItem('etel:lang', l); localStorage.setItem('etel:theme', 'dark');
        if (flagOn) localStorage.setItem('etel:unitsUi', '1');
        if (ch) localStorage.setItem('etel:units', ch);
      } catch { /* */ }
    }, [lang, flag || !!choice, choice]);
    await p.goto(`${base}#/scene/1`);
    await p.waitForFunction(() => window.__etelDebug?.scene() != null, null, { timeout: 30000 });
    Object.assign(snap, await snapAllScenes(p, lang));
    await ctx.close();
    if (errs.length) snap[`errors|${lang}`] = [...new Set(errs)];
  }
  return snap;
}
