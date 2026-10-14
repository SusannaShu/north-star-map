/* TIME on the public map (2026-10-14, her ask): a day strip along the bottom -- one bar per day,
 * taller the more public dots were worked on that day. Tap a day (or play) and the map lights
 * the dots worked on then; the caption names them and what was created that day. Data: history.json
 * (dates + public ids only, written by loop/public-snapshot/history-v2.mjs). */
(function () {
  const DAYS = 45;
  const css = `.ns-time{position:fixed;left:50%;transform:translateX(-50%);bottom:40px;z-index:16;width:min(620px,calc(100vw - 32px));
    font:10.5px var(--mono,ui-monospace,monospace);color:var(--text-muted,#888);background:var(--bg-glass,rgba(255,255,255,.8));backdrop-filter:blur(10px);
    border:1px solid var(--border,#e5e5e5);border-radius:12px;padding:8px 10px 6px;transition:opacity .4s}
  body.saver .ns-time,body.still .ns-time,body:has(.panel.open) .ns-time{opacity:0;pointer-events:none}
  .ns-time .row{display:flex;align-items:center;gap:8px}
  .ns-time button.play{flex:none;width:22px;height:22px;border:1px solid var(--border,#ddd);border-radius:50%;background:none;color:inherit;cursor:pointer;display:grid;place-items:center;padding:0}
  .ns-time button.play svg{width:9px;height:9px;fill:currentColor}
  .ns-time .bars{flex:1;display:flex;align-items:flex-end;gap:2px;height:30px;cursor:pointer}
  .ns-time .bars i{flex:1;background:var(--text-muted,#999);opacity:.45;border-radius:1.5px;min-height:2px}
  .ns-time .bars i.empty{opacity:.15}.ns-time .bars i.on{opacity:1;background:var(--text,#000)}
  .ns-time .cap{margin-top:5px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;min-height:14px}
  .ns-time .cap b{color:var(--text,#000);font-weight:600}.ns-time .cap a{color:inherit;cursor:pointer;text-decoration:underline dotted;text-underline-offset:2px}
  .ns-time .ends{display:flex;justify-content:space-between;font-size:9.5px;opacity:.8;margin-top:2px}
  @media (max-width:640px){.ns-time{bottom:38px}}`;
  const PLAY = '<svg viewBox="0 0 10 10"><path d="M1 0l9 5-9 5z"/></svg>', STOP = '<svg viewBox="0 0 10 10"><path d="M1 0h3v10H1zM6 0h3v10H6z"/></svg>';
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
  const dayOf = t => new Date(t).toLocaleDateString('en-CA', { timeZone: 'America/New_York' });
  const nice = d => new Date(d + 'T12:00:00Z').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', timeZone: 'UTC' });
  let H, list = [], sel = -1, timer = null, labels = {};
  async function boot() {
    try { const r = await fetch('history.json', { cache: 'no-store' }); if (!r.ok) return; H = await r.json(); } catch { return; }
    for (let w = 0; w < 100 && !window.nsReady; w++) await new Promise(r => setTimeout(r, 100));
    try { const m = await (await fetch('map.public.json', { cache: 'no-store' })).json();
      for (const p of m.projects || []) { labels[p.id] = p.label; for (const c of p.children || []) labels[c.id] = c.label; } } catch {}
    const today = dayOf(Date.now());
    for (let i = DAYS - 1; i >= 0; i--) list.push(dayOf(Date.parse(today + 'T12:00:00Z') - i * 864e5));
    const st = document.createElement('style'); st.textContent = css; document.head.appendChild(st);
    const el = document.createElement('div'); el.className = 'ns-time'; el.setAttribute('aria-label', 'What was worked on, day by day');
    const max = Math.max(1, ...list.map(d => (H.days[d] || []).length));
    el.innerHTML = `<div class="row"><button class="play" type="button" aria-label="Play the last ${DAYS} days">${PLAY}</button><div class="bars">${
      list.map((d, i) => { const n = (H.days[d] || []).length; return `<i data-i="${i}" class="${n ? '' : 'empty'}" style="height:${n ? 14 + 86 * Math.sqrt(n / max) : 6}%" title="${nice(d)} · ${n} dot${n === 1 ? '' : 's'}"></i>`; }).join('')
    }</div></div><div class="ends"><span>${nice(list[0])}</span><span>TIME · tap a day</span><span>today</span></div><div class="cap"></div>`;
    document.body.appendChild(el);
    const bars = el.querySelector('.bars'), cap = el.querySelector('.cap'), btn = el.querySelector('.play');
    const pick = i => { sel = i; [...bars.children].forEach((b, k) => b.classList.toggle('on', k === i));
      if (i < 0) { cap.innerHTML = ''; window.nsLight && window.nsLight([]); return; }
      const d = list[i], ids = H.days[d] || [], born = Object.keys(H.created).filter(id => H.created[id] === d && labels[id]);
      window.nsLight && window.nsLight(ids);
      const nm = id => `<a data-id="${esc(id)}">${esc(String(labels[id] || id).replace(/ · \d+$/, ''))}</a>`;
      cap.innerHTML = `<b>${nice(d)}</b> · ${ids.length ? `${ids.length} worked on: ${ids.filter(id => labels[id]).slice(0, 8).map(nm).join(', ')}${ids.length > 8 ? ' …' : ''}` : 'quiet day'}`
        + (born.length ? ` · new: ${born.slice(0, 4).map(nm).join(', ')}` : ''); };
    const stop = () => { clearInterval(timer); timer = null; btn.innerHTML = PLAY; };
    bars.addEventListener('click', e => { const b = e.target.closest('i'); if (!b) return; stop(); const i = +b.dataset.i; pick(i === sel ? -1 : i); });
    cap.addEventListener('click', e => { const a = e.target.closest('a[data-id]'); if (a && window.nsOpen) { stop(); window.nsOpen(a.dataset.id); } });
    btn.addEventListener('click', () => { if (timer) return stop(); btn.innerHTML = STOP; let i = list.findIndex(d => (H.days[d] || []).length); if (i < 0) i = 0;
      pick(i); timer = setInterval(() => { i++; if (i >= list.length) { stop(); return pick(-1); } pick(i); }, 900); });
    const q = new URLSearchParams(location.search).get('day'), qi = list.indexOf(q); if (qi >= 0) pick(qi);   // ?day=YYYY-MM-DD links a day
    document.addEventListener('keydown', e => { if (e.key === 'Escape' && sel >= 0) { stop(); pick(-1); } });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})();
