// parts-pop.js -- hover / tap any part named on a page: real photo, real size, what the package looks
// like, what it does, where it goes (2026-10-14, her ask; rule in dev-hub/manual/howto/ui-style.md).
// Data: /parts.json (loop/parts-json.mjs, from soft-robot/schedule.json; no prices, no order info).
// Use: <script src="/js/parts-pop.js" data-base="/" defer></script>; pages that render late call
// window.partsPop.scan(rootEl). Elements with data-part="<key>" (thumbnails) get the card too.
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
.ppc{position:fixed;z-index:9999;width:min(340px,92vw);max-height:86vh;overflow:auto;background:var(--bg,#fff);color:var(--ink,#000);border:1px solid var(--line2,#d6d6d6);border-radius:12px;box-shadow:0 10px 30px rgba(0,0,0,.28);font:13px/1.4 Inter,-apple-system,sans-serif}
.ppc .m{width:100%;height:190px;object-fit:contain;background:#fff;display:block;border-radius:12px 12px 0 0}
.ppc .b{padding:10px 12px 12px}
.ppc h4{margin:0 0 6px;font-size:15px}
.ppc .sz{font-weight:600;margin:0 0 6px}
.ppc .row{display:flex;gap:8px;margin:8px 0 0}
.ppc .row figure{margin:0;flex:1;min-width:0}
.ppc .row img{width:100%;height:92px;object-fit:contain;background:#fff;border:1px solid var(--line,#e5e5e5);border-radius:8px;display:block}
.ppc figcaption{font:500 9.5px 'JetBrains Mono',ui-monospace,monospace;color:var(--faint,#999);text-transform:uppercase;letter-spacing:.06em;margin-top:3px}
.ppc dl{margin:8px 0 0;display:grid;grid-template-columns:auto 1fr;gap:4px 9px}
.ppc dt{font:500 9.5px 'JetBrains Mono',ui-monospace,monospace;color:var(--faint,#999);text-transform:uppercase;letter-spacing:.06em;padding-top:2px}
.ppc dd{margin:0}
.ppc .src{font-size:10.5px;color:var(--faint,#999);margin-top:8px}
.ppc .x{all:unset;cursor:pointer;position:absolute;top:8px;right:8px;width:28px;height:28px;border-radius:50%;background:#000;color:#fff;display:flex;align-items:center;justify-content:center;font:600 15px sans-serif}`;

  function html(k){
    const p = P[k]; if (!p) return '';
    const fig = (u, c) => u ? `<figure><img src="${esc(src(u))}" alt="" loading="lazy"><figcaption>${c}</figcaption></figure>` : '';
    const row = fig(p.sizePhoto, 'size') + fig(p.pkgPhoto, 'in the box');
    return `${p.photo ? `<img class="m" src="${esc(src(p.photo))}" alt="${esc(p.name)}">` : ''}<button class="x" type="button" aria-label="Close">&times;</button>
      <div class="b"><h4>${esc(p.name)}</h4>${p.size ? `<p class="sz">${esc(p.size)}</p>` : ''}${row ? `<div class="row">${row}</div>` : ''}
      <dl>${p.pack ? `<dt>look for</dt><dd>${esc(p.pack)}</dd>` : ''}${p.does ? `<dt>does</dt><dd>${esc(p.does)}</dd>` : ''}${p.goes ? `<dt>goes</dt><dd>${esc(p.goes)}</dd>` : ''}</dl>
      ${p.photoFrom ? `<div class="src">photo: ${esc(p.photoFrom)}</div>` : ''}</div>`;
  }
  function show(k, el, pin){
    if (!P || !P[k]) return;
    if (!card) { card = document.createElement('div'); card.className = 'ppc'; card.setAttribute('role', 'dialog'); document.body.appendChild(card);
      card.addEventListener('mouseleave', () => { if (!pinned) hide(); }); }
    card.innerHTML = html(k); card.dataset.k = k; pinned = !!pin;
    card.querySelector('.x').onclick = e => { e.stopPropagation(); hide(); };
    const r = el.getBoundingClientRect(), W = Math.min(340, innerWidth * .92);
    let x = Math.min(Math.max(8, r.left), innerWidth - W - 8), y = r.bottom + 6;
    card.style.left = x + 'px'; card.style.top = y + 'px'; card.style.display = 'block';
    const h = card.offsetHeight; if (y + h > innerHeight - 8) card.style.top = Math.max(8, r.top - h - 6) + 'px';
  }
  function hide(){ if (card) card.style.display = 'none'; pinned = false; }

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

  // hover = preview, tap/click = pinned (pages may also handle data-part clicks themselves)
  document.addEventListener('mouseover', e => { const el = e.target.closest && e.target.closest('[data-part]'); if (el && !pinned) show(el.dataset.part, el, false); });
  document.addEventListener('mouseout', e => { const el = e.target.closest && e.target.closest('[data-part]'); if (el && !pinned && !(e.relatedTarget && card && card.contains(e.relatedTarget))) hide(); });
  document.addEventListener('focusin', e => { const el = e.target.closest && e.target.closest('.pp'); if (el) show(el.dataset.part, el, false); });
  document.addEventListener('click', e => {
    const el = e.target.closest && e.target.closest('[data-part]');
    if (el && !window.partsPopOwnClick) { e.preventDefault(); e.stopPropagation(); show(el.dataset.part, el, true); return; }
    if (card && !card.contains(e.target)) hide();
  }, true);
  document.addEventListener('keydown', e => { if (e.key === 'Escape') hide(); });

  fetch(src('/parts.json')).then(r => r.json()).then(j => {
    P = j.parts; const words = [];
    for (const [k, p] of Object.entries(P)) for (const a of (p.aliases || [])) { KEYOF[a.toLowerCase()] = k; words.push(a); }
    words.sort((a, b) => b.length - a.length);
    RX = new RegExp('(^|[^A-Za-z0-9-])(' + words.map(w => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|') + ')(?![A-Za-z0-9])', 'gi');
    window.partsPop.parts = P;
    if (!me || me.dataset.auto !== 'off') scan(document.querySelector('main') || document.body);
    ready.splice(0).forEach(f => f());
  }).catch(() => {});
  const st = document.createElement('style'); st.textContent = css; document.head.appendChild(st);
  window.partsPop = { scan, show, hide, html };
})();
