// parts-pop.js -- hover / tap any part named on a page: real photo, real size, what the package looks
// like, what it does, where it goes (2026-10-14, her ask; rule in dev-hub/manual/howto/ui-style.md).
// Data: /parts.json (loop/parts-json.mjs, from soft-robot/schedule.json; no prices, no order info).
// Use: <script src="/js/parts-pop.js" data-base="/" defer></script>; pages that render late call
// window.partsPop.scan(rootEl). Elements with data-part="<key>" (thumbnails) get the card too.
//
// DIAGRAMS (2026-10-14 3:20 pm, her ask: "hover/tap any label or shape ... plain-words pop-up"):
// mark a diagram <svg data-pop="<scope>">. Every <text> in it whose words name a part opens that part's
// card; a label listed in the tips table opens a plain-words tip (title + what it is / what it does,
// plus the part card when the tip names one); the smallest shape under a tagged label gets the same
// pop-up. Tips table: window.DIAGRAM_TIPS and/or <script type="application/json" id="diagram-tips">,
// { "<scope>" | "*": { "<label text>": {t: title, d: plain words, part: key} | "part:<key>" | "" } }
// ("" = leave that label alone). Any element can also carry data-tip="words" [data-tip-title]
// [data-part] by hand, or a <title> child (a shape's own <title> becomes its tip). Diagrams drawn later are
// picked up on their own (MutationObserver). Pages with no parts load /js/tips.js instead (same helper,
// no part-name scan of the prose). loop/style-check.mjs flags a diagram (an <svg> with 3+ labels) with no tips.
(function(){
  'use strict';
  const me = document.currentScript;
  const BASE = (me && me.dataset.base) || '/';
  const SKIP = new Set(['SCRIPT','STYLE','TEXTAREA','A','DIALOG','SVG','TITLE','CODE','INPUT','SELECT','OPTION']);
  let P = null, RX = null, KEYOF = {}, card = null, pinned = false, ready = [];
  const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
  const src = u => u ? BASE.replace(/\/$/, '') + u : '';

  const css = `.pp{border-bottom:1.5px dotted currentColor;cursor:help}
.pp:hover,.pp:focus{background:rgba(127,127,127,.16);outline:none}
.dpk{cursor:help}
.dpk:hover,.dpk:focus,.dpk.dpon{opacity:.62;outline:none}
text.dpk{text-decoration:underline dotted;text-underline-offset:2px}
.ppc{position:fixed;z-index:9999;width:min(340px,92vw);max-height:86vh;overflow:auto;background:var(--bg,#fff);color:var(--text,var(--ink,#000));border:1px solid var(--border,var(--line2,#d6d6d6));border-radius:12px;box-shadow:0 10px 30px rgba(0,0,0,.28);font:13px/1.4 Inter,-apple-system,sans-serif}
.ppc .m{width:100%;height:190px;object-fit:contain;background:#fff;display:block;border-radius:12px 12px 0 0}
.ppc .b{padding:10px 12px 12px}
.ppc h4{margin:0 0 6px;font-size:15px;padding-right:30px}
.ppc .sz{font-weight:600;margin:0 0 6px}
.ppc .tip{margin:0}
.ppc .here{margin:0 0 8px;padding:7px 9px;background:var(--card,#f5f5f5);border-radius:8px}
.ppc .here b{font:500 9.5px 'JetBrains Mono',ui-monospace,monospace;color:var(--faint,#999);text-transform:uppercase;letter-spacing:.06em;display:block;margin-bottom:2px}
.ppc .row{display:flex;gap:8px;margin:8px 0 0}
.ppc .row figure{margin:0;flex:1;min-width:0}
.ppc .row img{width:100%;height:92px;object-fit:contain;background:#fff;border:1px solid var(--line,#e5e5e5);border-radius:8px;display:block}
.ppc figcaption{font:500 9.5px 'JetBrains Mono',ui-monospace,monospace;color:var(--faint,#999);text-transform:uppercase;letter-spacing:.06em;margin-top:3px}
.ppc dl{margin:8px 0 0;display:grid;grid-template-columns:auto 1fr;gap:4px 9px}
.ppc dt{font:500 9.5px 'JetBrains Mono',ui-monospace,monospace;color:var(--faint,#999);text-transform:uppercase;letter-spacing:.06em;padding-top:2px}
.ppc dd{margin:0}
.ppc .src{font-size:10.5px;color:var(--faint,#999);margin-top:8px}
.ppc .x{all:unset;cursor:pointer;position:absolute;top:8px;right:8px;width:28px;height:28px;border-radius:50%;background:#000;color:#fff;display:flex;align-items:center;justify-content:center;font:600 15px sans-serif}`;

  // here = what this spot in a diagram is (a plain-words line above the part's own facts)
  function html(k, here){
    const p = P[k]; if (!p) return '';
    const fig = (u, c) => u ? `<figure><img src="${esc(src(u))}" alt="" loading="lazy"><figcaption>${c}</figcaption></figure>` : '';
    const row = fig(p.sizePhoto, 'size') + fig(p.pkgPhoto, 'in the box');
    return `${p.photo ? `<img class="m" src="${esc(src(p.photo))}" alt="${esc(p.name)}">` : ''}<button class="x" type="button" aria-label="Close">&times;</button>
      <div class="b"><h4>${esc(p.name)}</h4>${here ? `<p class="here"><b>here</b>${esc(here)}</p>` : ''}${p.size ? `<p class="sz">${esc(p.size)}</p>` : ''}${row ? `<div class="row">${row}</div>` : ''}
      <dl>${p.pack ? `<dt>look for</dt><dd>${esc(p.pack)}</dd>` : ''}${p.does ? `<dt>does</dt><dd>${esc(p.does)}</dd>` : ''}${p.goes ? `<dt>goes</dt><dd>${esc(p.goes)}</dd>` : ''}</dl>
      ${p.photoFrom ? `<div class="src">photo: ${esc(p.photoFrom)}</div>` : ''}</div>`;
  }
  const tipHtml = (title, body) => `<button class="x" type="button" aria-label="Close">&times;</button><div class="b"><h4>${esc(title)}</h4><p class="tip">${esc(body)}</p></div>`;
  let lit = null;
  function place(el, inner, key, pin){
    if (!card) { card = document.createElement('div'); card.className = 'ppc'; card.setAttribute('role', 'dialog'); document.body.appendChild(card);
      card.addEventListener('mouseleave', () => { if (!pinned) hide(); }); }
    card.innerHTML = inner; card.dataset.k = key; pinned = !!pin;
    card.querySelector('.x').onclick = e => { e.stopPropagation(); hide(); };
    if (lit) lit.classList.remove('dpon'); lit = el.classList && el.classList.contains('dpk') ? el : null; if (lit) lit.classList.add('dpon');
    const r = el.getBoundingClientRect(), W = Math.min(340, innerWidth * .92);
    let x = Math.min(Math.max(8, r.left), innerWidth - W - 8), y = r.bottom + 6;
    card.style.left = x + 'px'; card.style.top = y + 'px'; card.style.display = 'block';
    const h = card.offsetHeight; if (y + h > innerHeight - 8) card.style.top = Math.max(8, r.top - h - 6) + 'px';
  }
  function show(k, el, pin, here){ if (!P || !P[k]) return; place(el, html(k, here), k, pin); }
  // an element with data-tip and/or data-part
  function showEl(el, pin){
    const k = el.dataset.part, tip = el.dataset.tip;
    if (k && P && P[k]) return show(k, el, pin, tip);
    if (tip) place(el, tipHtml(el.dataset.tipTitle || el.textContent.trim() || 'What this is', tip), 'tip:' + tip.slice(0, 40), pin);
  }
  function hide(){ if (card) card.style.display = 'none'; pinned = false; if (lit) { lit.classList.remove('dpon'); lit = null; } }

  function scan(root){
    if (!P) { ready.push(() => scan(root)); return; }
    root = root || document.body;
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, { acceptNode(n){
      for (let e = n.parentElement; e && e !== root.parentElement; e = e.parentElement) {
        if (SKIP.has(e.tagName.toUpperCase()) || e.classList.contains('pp') || e.classList.contains('ppc') || e.hasAttribute('data-part') || e.hasAttribute('data-no-parts')) return NodeFilter.FILTER_REJECT;
      }
      RX.lastIndex = 0; return RX.test(n.nodeValue) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_SKIP; } });
    const nodes = []; while (walker.nextNode()) nodes.push(walker.currentNode);
    const seen = new WeakMap();   // one pop-up link per part per paragraph / list item / cell, not every mention
    for (const n of nodes) {
      const blk = n.parentElement.closest('p,li,td,th,h1,h2,h3,h4,figcaption,section,div') || root;
      if (!seen.has(blk)) seen.set(blk, new Set(blk.querySelectorAll ? [...blk.querySelectorAll('.pp')].map(e => e.dataset.part) : []));
      const got = seen.get(blk);
      const t = n.nodeValue, f = document.createDocumentFragment(); let last = 0, m; RX.lastIndex = 0;
      while ((m = RX.exec(t))) {
        const k = KEYOF[m[2].toLowerCase()]; if (!k || got.has(k)) continue; got.add(k);
        const s = m.index + m[1].length;
        f.appendChild(document.createTextNode(t.slice(last, s)));
        const sp = document.createElement('span'); sp.className = 'pp'; sp.dataset.part = k; sp.tabIndex = 0; sp.textContent = m[2]; f.appendChild(sp);
        last = s + m[2].length;
      }
      f.appendChild(document.createTextNode(t.slice(last))); n.parentNode.replaceChild(f, n);
    }
  }

  /* ---------- diagrams ---------- */
  let jsonTips = null;
  function tipsFor(scope){
    if (jsonTips === null) { const j = document.getElementById('diagram-tips'); try { jsonTips = j ? JSON.parse(j.textContent) : {}; } catch (e) { jsonTips = {}; } }
    const W = window.DIAGRAM_TIPS || {};
    return Object.assign({}, jsonTips['*'] || {}, W['*'] || {}, jsonTips[scope] || {}, W[scope] || {});
  }
  const partOf = lbl => { if (!RX) return null; RX.lastIndex = 0; const m = RX.exec(lbl); return m ? KEYOF[m[2].toLowerCase()] : null; };
  const norm = e => typeof e === 'string' ? (e.startsWith('part:') ? { part: e.slice(5) } : { d: e }) : e;
  function focusable(el){
    if (!el.hasAttribute('tabindex')) el.setAttribute('tabindex', '0');
    el.setAttribute('role', 'button'); el.classList.add('dpk');
    if (!el.getAttribute('aria-label')) el.setAttribute('aria-label', el.dataset.tipTitle || (P && P[el.dataset.part] || {}).name || el.textContent.trim());
  }
  function apply(el, e, lbl, focus){
    if (e.part && P && P[e.part]) el.dataset.part = e.part;
    if (e.d) { el.dataset.tip = e.d; el.dataset.tipTitle = e.t || lbl; }
    if (!el.dataset.part && !el.dataset.tip) return;
    if (focus) focusable(el); else el.classList.add('dpk');
  }
  const SHAPES = 'rect,circle,ellipse,path,polygon,polyline,line';
  function tagSvg(svg){
    if (svg.__pp || !P) return;
    const sr = svg.getBoundingClientRect(); if (!sr.width || !sr.height) return;   // not laid out yet: tried again later
    svg.__pp = 1;
    const T = tipsFor(svg.getAttribute('data-pop') || '');
    const big = sr.width * sr.height * .3;
    const shapes = [...svg.querySelectorAll(SHAPES)].filter(s => !s.closest('defs,marker,pattern,[data-part],[data-tip]') && s.tagName !== 'line')
      .map(s => ({ s, r: s.getBoundingClientRect() })).filter(o => o.r.width > 5 && o.r.height > 5 && o.r.width * o.r.height < big);
    for (const t of svg.querySelectorAll('text')) {
      if (t.closest('[data-part],[data-tip]')) continue;
      const lbl = t.textContent.replace(/\s+/g, ' ').trim(); if (!lbl) continue;
      let e = T[lbl]; if (e === '') continue;
      e = e === undefined ? (partOf(lbl) ? { part: partOf(lbl) } : null) : norm(e);
      if (!e) continue;
      apply(t, e, lbl, true);
      const r = t.getBoundingClientRect(), cx = r.left + r.width / 2, cy = r.top + r.height / 2;
      let best = null;
      for (const o of shapes) if (cx >= o.r.left && cx <= o.r.right && cy >= o.r.top && cy <= o.r.bottom && (!best || o.r.width * o.r.height < best.r.width * best.r.height)) best = o;
      if (best && !best.s.hasAttribute('data-part') && !best.s.hasAttribute('data-tip')) apply(best.s, e, lbl, false);
    }
    // a shape or group with its own <title> child: that title is its tip (and no second, native tooltip)
    for (const ti of svg.querySelectorAll('title')) {
      const el = ti.parentElement; if (!el || el === svg || el.closest('[data-tip],[data-part]')) continue;
      const words = ti.textContent.replace(/\s+/g, ' ').trim(); if (!words) continue;
      const cut = words.match(/^([^:.]{1,40}):\s+(.+)$/);
      el.dataset.tip = cut ? cut[2] : words; el.dataset.tipTitle = cut ? cut[1] : (el.querySelector('text') || {}).textContent || 'What this is';
      ti.remove();
    }
    svg.querySelectorAll('[data-part],[data-tip]').forEach(el => { if (!el.classList.contains('dpk')) focusable(el); });
  }
  function diagrams(root){
    if (!P) { ready.push(() => diagrams(root)); return; }
    (root || document).querySelectorAll('svg[data-pop]').forEach(tagSvg);
  }
  let moT = 0;
  const watch = () => new MutationObserver(() => { clearTimeout(moT); moT = setTimeout(() => diagrams(), 150); }).observe(document.body, { childList: true, subtree: true });
  if (document.body) watch(); else document.addEventListener('DOMContentLoaded', watch);

  // hover = preview, tap/click = pinned (pages may also handle data-part clicks themselves)
  const SEL = '[data-part],[data-tip]';
  const near = t => { if (!t || !t.closest) return null; const s = t.closest('svg[data-pop]'); if (s && !s.__pp) tagSvg(s); return t.closest(SEL); };
  document.addEventListener('mouseover', e => { const el = near(e.target); if (el && !pinned) showEl(el, false); });
  document.addEventListener('mouseout', e => { const el = e.target.closest && e.target.closest(SEL); if (el && !pinned && !(e.relatedTarget && card && card.contains(e.relatedTarget))) hide(); });
  document.addEventListener('focusin', e => { const el = e.target.closest && e.target.closest('.pp,.dpk'); if (el) showEl(el, false); });
  document.addEventListener('click', e => {
    const el = near(e.target);
    if (el && !window.partsPopOwnClick && !(card && card.contains(el))) { e.preventDefault(); e.stopPropagation(); showEl(el, true); return; }
    if (card && !card.contains(e.target)) hide();
  }, true);
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') return hide();
    const el = (e.key === 'Enter' || e.key === ' ') && e.target.closest && e.target.closest('.dpk');
    if (el) { e.preventDefault(); showEl(el, true); }
  });

  fetch(src('/parts.json')).then(r => r.json()).then(j => {
    P = j.parts; const words = [];
    for (const [k, p] of Object.entries(P)) for (const a of (p.aliases || [])) { KEYOF[a.toLowerCase()] = k; words.push(a); }
    words.sort((a, b) => b.length - a.length);
    RX = new RegExp('(^|[^A-Za-z0-9-])(' + words.map(w => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|') + ')(?![A-Za-z0-9])', 'gi');
    window.partsPop.parts = P;
    if (!me || me.dataset.auto !== 'off') scan(document.querySelector('main') || document.body);
    ready.splice(0).forEach(f => f());
    diagrams();
  }).catch(() => { P = {}; RX = /$^/g; window.partsPop.parts = P; ready.splice(0).forEach(f => f()); diagrams(); });   // no parts.json: tips still work
  const st = document.createElement('style'); st.textContent = css; document.head.appendChild(st);
  window.partsPop = { scan, show, showEl, hide, html, diagrams };
})();
