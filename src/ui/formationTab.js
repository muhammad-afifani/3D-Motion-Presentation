/**
 * formationTab.js — tab Formation Scene 9: satu kartu per parameter untuk equipment aktif, dari
 * content/emission_formation.json (data dibentuk oleh state/formationView.js). Konten kualitatif saja, tanpa angka model.
 * Reaksi dengan subskrip; arah pendorong/efek dengan panah + teks untuk pembaca layar; sumber sebagai tautan
 * #/references/<id> (id yang tidak ada di references.json → "source to verify").
 */
import { STR } from './strings.js';
import { markNote } from '../state/notes.js';

const F = STR.scene9.formationTab;

function h(tag, cls = '', text = '') {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text) e.textContent = text;
  return e;
}

/** Panah arah + label tersembunyi. @param {string} dir */
function dirEl(dir) {
  const s = h('span', `fm-dir fm-dir--${dir}`, F.dirs[dir] ?? dir);
  s.title = F.dirNames[dir] ?? dir;
  s.setAttribute('aria-label', F.dirNames[dir] ?? dir);
  return s;
}

/** Sumber: tautan ke halaman References atau "source to verify". */
function refsEl(refs) {
  const wrap = h('span', 'fm-refs');
  refs.forEach((r, i) => {
    if (i) wrap.append(', ');
    if (r.known) { const a = h('a', 'fm-ref', r.id); a.href = r.href; a.title = r.cite; wrap.append(a); } else wrap.append(h('span', 'bcard__warn', F.sourceToVerify(r.id)));
  });
  return wrap;
}

/** @param {HTMLElement} container */
export function createFormationTab(container) {
  const el = h('div', 'fm-tab');
  container.appendChild(el);
  let key = '';
  return {
    el,
    /**
     * @param {ReturnType<import('../state/formationView.js').formationCards>} v
     * @param {{gasFuel:boolean}} opt gasFuel: tampilkan kalimat komposisi gas
     */
    update(v, { gasFuel = false } = {}) {
      const k = `${v.equipment}|${gasFuel}|${v.cards.map((c) => `${c.param}:${c.modeled}:${c.refs.map((r) => r.known).join('')}`).join(',')}`;
      if (k === key) return;
      key = k;
      el.replaceChildren();
      const head = h('div', 'fm-head');
      head.append(h('h3', 'reg__title', v.label ?? ''), h('p', 'reg__note', F.intro), markNote(h('p', 'reg__note', F.introNote)));
      if (gasFuel) head.append(h('p', 'reg__note fm-comp', STR.scene9.limitsTab.composition));
      el.append(head);
      if (!v.cards.length) { el.append(h('p', 'reg__note', F.empty)); return; }
      const grid = h('div', 'fm-grid');
      for (const c of v.cards) {
        const card = h('article', 'fm-card');
        card.dataset.param = c.param;
        const top = h('div', 'fm-card__top');
        const tag = h('span', `bcard__chip fm-modeled fm-modeled--${c.modeled}`, `${F.modeledLabel}: ${F.modeled[c.modeled] ?? c.modeled}`);
        tag.dataset.tip = F.modeledTip;
        top.append(h('h4', '', c.param), tag);
        card.append(top, h('p', 'fm-summary', c.summary));
        // reaksi (subskrip benar)
        const rx = h('div', 'fm-rx');
        const rn = h('span', 'reg__note');
        for (const t of c.reactionsName) rn.append(t.sub ? h('sub', '', t.t) : document.createTextNode(t.t));
        rx.append(h('b', '', `${F.reactions}: `), rn);
        const ul = h('ul', 'fm-rx__list num');
        for (const tokens of c.reactions) {
          const li = h('li');
          for (const t of tokens) li.append(t.sub ? h('sub', '', t.t) : document.createTextNode(t.t));
          ul.append(li);
        }
        rx.append(ul);
        if (c.rateNote) rx.append(h('p', 'reg__note', c.rateNote));
        card.append(rx);
        // pendorong
        const dr = h('div', 'fm-drivers');
        dr.append(h('b', '', F.drivers));
        const dl = h('ul');
        for (const d of c.drivers) { const li = h('li'); li.append(dirEl(d.direction), ' ', h('span', 'fm-strong', d.label), ` · ${d.why}`); dl.append(li); }
        dr.append(dl);
        card.append(dr);
        // tuas: tabel efek (kolom = gabungan kunci efek di kartu ini)
        if (c.levers.length) {
          const keys = [...new Set(c.levers.flatMap((l) => l.effects.map((x) => x.key)))];
          const lv = h('div', 'fm-levers');
          lv.append(h('b', '', F.levers));
          const t = h('table', 'reg__table fm-lev');
          const thead = h('thead'), trh = h('tr');
          trh.append(h('th', '', F.lever), ...keys.map((x) => h('th', '', F.effects[x] ?? x)));
          thead.append(trh);
          const tb = h('tbody');
          for (const l of c.levers) {
            const tr = h('tr');
            tr.append(h('td', 'fm-strong', l.label));
            for (const x of keys) { const td = h('td'); const e = l.effects.find((y) => y.key === x); if (e) td.append(dirEl(e.dir)); tr.append(td); }
            const tr2 = h('tr', 'fm-lev__why');
            const td2 = h('td');
            td2.colSpan = keys.length + 1;
            td2.append(document.createTextNode(`${l.consequence} `));
            if (l.refs.length) td2.append(refsEl(l.refs));
            tr2.append(td2);
            tb.append(tr, tr2);
          }
          t.append(thead, tb);
          lv.append(t);
          card.append(lv);
        }
        const src = h('p', 'fm-src');
        src.append(h('b', '', `${F.sources}: `), refsEl(c.refs));
        card.append(src);
        grid.append(card);
      }
      el.append(grid);
    },
    dispose() { el.remove(); },
  };
}
