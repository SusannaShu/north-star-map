/* TIME on the public map (2026-10-14, her ask): a day strip along the bottom -- one bar per day,
 * taller the more public dots were worked on that day. Tap a day (or play) and the map lights
 * the dots worked on then; the caption names them and what was created that day. Data: history.json
 * (dates + public ids only, written by loop/public-snapshot/history-v2.mjs).
 * 2026-10-20 11:28 pm, her ask: playback GROWS the map -- a dot made after the chosen day is not drawn
 * (map.js nsBorn), it appears on its day; play starts at the first day so the map builds up.
 * The private map (localhost:4400/?time=1) gets the same strip, its history read from the map itself:
 * a dot is made on its first dated line, worked on every day a dated line names.
 * 2026-10-22 11:17 am, her ask (T1764): "the change of dots too not just update" -- STRUCTURE changes are
 * timeline events: a tick row under the bars marks days a dot was added / moved / renamed / merged / done /
 * retired, and the day's second caption line names them. Local: map.json structureChanges
 * (loop/map-changes.mjs); public: history.json `changes` (public ids only, no renames; ships on her yes).
 * 2026-10-23 9:53 am, her ask (T1915, an ALTERNATIVE, off by default): ?time=condensed merges a run of quiet, alike
 * days (mostly the same few dots, e.g. Nightly content / Publish / Fashion future for weeks) into ONE step with its
 * date range and day count, so playback does not repeat itself; busy days stay one step each. */
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
  .ns-time .ticks{display:flex;gap:2px;height:5px;margin:3px 0 0 30px}.ns-time .ticks i{flex:1;display:flex;justify-content:center}
  .ns-time .ticks i b{width:4px;height:4px;border-radius:50%;background:var(--text,#000);opacity:.75}.ns-time .ticks i.on b{opacity:1;box-shadow:0 0 0 1.5px var(--text,#000)}
  .ns-time .chg{white-space:nowrap;overflow:hidden;text-overflow:ellipsis;min-height:0}
  .ns-time .ends{display:flex;justify-content:space-between;font-size:9.5px;opacity:.8;margin-top:2px}
  @media (max-width:640px){.ns-time{bottom:38px}}`;
  const PLAY = '<svg viewBox="0 0 10 10"><path d="M1 0l9 5-9 5z"/></svg>', STOP = '<svg viewBox="0 0 10 10"><path d="M1 0h3v10H1zM6 0h3v10H6z"/></svg>';
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
  const dayOf = t => new Date(t).toLocaleDateString('en-CA', { timeZone: 'America/New_York' });
  const nice = d => new Date(d + 'T12:00:00Z').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', timeZone: 'UTC' });
  const VERB = { added: 'added', moved: 'moved', renamed: 'renamed', merged: 'merged', done: 'done', archived: 'retired' };
  let H, list = [], sel = -1, timer = null, labels = {}, CH = {};
  const CONDENSED = new URLSearchParams(location.search).get('time') === 'condensed';
  let G = null;   // condensed: last day of a run -> { from, to, n, ids }
  async function boot() {
    const own = !window.NS_PUBLIC && /[?&]time=1(&|$)/.test(location.search);
    if (!own) { try { const r = await fetch('history.json', { cache: 'no-store' }); if (!r.ok) return; H = await r.json(); } catch { return; } }
    for (let w = 0; w < 100 && !window.nsReady; w++) await new Promise(r => setTimeout(r, 100));
    if (own) { const m = window.nsMapData && window.nsMapData(); if (!m) return; H = { created: {}, days: {} };
      for (const n of (m.projects || []).flatMap(p => [p, ...(p.children || [])])) { labels[n.id] = n.label;
        for (const d of new Set(String(n.why || '').match(/\b20\d\d-\d\d-\d\d\b/g) || [])) {
          (H.days[d] ||= []).push(n.id); if (!H.created[n.id] || d < H.created[n.id]) H.created[n.id] = d; } }
      for (const c of m.structureChanges || []) (CH[c.day] ||= []).push(c); }
    else try { const m = await (await fetch('map.public.json', { cache: 'no-store' })).json();
      for (const p of m.projects || []) { labels[p.id] = p.label; for (const c of p.children || []) labels[c.id] = c.label; } } catch {}
    if (!own) for (const [d, rows] of Object.entries(H.changes || {})) CH[d] = rows.map(([id, k, to]) => ({ day: d, id, k, to }));
    for (const [d, rows] of Object.entries(CH)) for (const c of rows) if (c.k === 'added' && (!H.created[c.id] || d < H.created[c.id])) H.created[c.id] = d;
    const today = dayOf(Date.now());
    for (let i = DAYS - 1; i >= 0; i--) list.push(dayOf(Date.parse(today + 'T12:00:00Z') - i * 864e5));
    if (CONDENSED) {
      // a quiet day (<= 8 dots) joins the run before it when it shares at least 40% of its dots with the run (or is
      // empty); a busy day is its own step. The step is keyed by the run's last day.
      const QUIET = 8, runs = []; let run = null;
      for (const d of list) {
        const ids = H.days[d] || [], u = run ? run.ids : null;
        const alike = u && ids.length <= QUIET && run.quiet && (!ids.length || ids.filter(x => u.has(x)).length / new Set([...ids, ...u]).size >= 0.4);
        if (alike) { run.days.push(d); ids.forEach(x => run.ids.add(x)); }
        else { run = { days: [d], ids: new Set(ids), quiet: ids.length <= QUIET }; runs.push(run); }
      }
      G = {}; list = runs.map(r => { const k = r.days[r.days.length - 1]; G[k] = { from: r.days[0], to: k, n: r.days.length, ids: [...r.ids], days: r.days }; return k; });
      const CH2 = {}; for (const k of list) { const rows = G[k].days.flatMap(d => CH[d] || []); if (rows.length) CH2[k] = rows; } CH = CH2;
    }
    const idsOf = d => (G ? G[d].ids : H.days[d] || []);
    const niceOf = d => (G && G[d].n > 1 ? `${nice(G[d].from)} – ${nice(d)} · ${G[d].n} days` : nice(d));
    function d0 (id) { const c = H.created[id]; return G ? list.find(k => c >= G[k].from && c <= G[k].to) : c; }
    const st = document.createElement('style'); st.textContent = css; document.head.appendChild(st);
    const el = document.createElement('div'); el.className = 'ns-time'; el.setAttribute('aria-label', 'What was worked on, day by day');
    const hasCH = Object.keys(CH).length > 0;   // public: no `changes` until her yes (public-flags mapChanges) = the strip looks as before
    const max = Math.max(1, ...list.map(d => idsOf(d).length));
    el.innerHTML = `<div class="row"><button class="play" type="button" aria-label="Play the last ${DAYS} days">${PLAY}</button><div class="bars">${
      list.map((d, i) => { const n = idsOf(d).length; return `<i data-i="${i}" class="${n ? '' : 'empty'}" style="height:${n ? 14 + 86 * Math.sqrt(n / max) : 6}%${G && G[d].n > 1 ? `;flex:${Math.min(4, 1 + G[d].n / 6).toFixed(2)}` : ''}" title="${niceOf(d)} · ${n} dot${n === 1 ? '' : 's'}"></i>`; }).join('')
    }</div></div>${hasCH ? `<div class="ticks">${list.map((d, i) => { const n = (CH[d] || []).length; return `<i data-i="${i}"${G && G[d].n > 1 ? ` style="flex:${Math.min(4, 1 + G[d].n / 6).toFixed(2)}"` : ''}>${n ? `<b title="${niceOf(d)} · ${n} map change${n === 1 ? '' : 's'}"></b>` : ''}</i>`; }).join('')}</div>` : ''}<div class="ends"><span>${nice(G ? G[list[0]].from : list[0])}</span><span>TIME${G ? ' · alike days merged' : ''} · tap a day${hasCH ? ` · <b style="display:inline-block;width:4px;height:4px;border-radius:50%;background:currentColor;vertical-align:middle"></b> map changed` : ''}</span><span>today</span></div><div class="cap"></div><div class="cap chg"></div>`;
    document.body.appendChild(el);
    const bars = el.querySelector('.bars'), ticks = el.querySelector('.ticks') || document.createElement('div'), cap = el.querySelector('.cap'), chg = el.querySelector('.chg'), btn = el.querySelector('.play');
    const pick = i => { sel = i; [...bars.children].forEach((b, k) => b.classList.toggle('on', k === i)); [...ticks.children].forEach((b, k) => b.classList.toggle('on', k === i));
      if (i < 0) { cap.innerHTML = ''; chg.innerHTML = ''; window.nsLight && window.nsLight([]); window.nsBorn && window.nsBorn(null); return; }
      const d = list[i], ids = idsOf(d), born = Object.keys(H.created).filter(id => (G ? d0(id) === d : H.created[id] === d) && labels[id]);
      window.nsBorn && window.nsBorn(H.created, d);   // dots made after d are not on the map yet (condensed: the run's last day)
      const cs = CH[d] || [];
      window.nsLight && window.nsLight([...new Set([...ids, ...cs.map(c => c.id)])]);
      const nm = id => `<a data-id="${esc(id)}">${esc(String(labels[id] || id).replace(/ · \d+$/, ''))}</a>`;
      cap.innerHTML = `<b>${niceOf(d)}</b> · ${ids.length ? `${ids.length} worked on: ${ids.filter(id => labels[id]).slice(0, 8).map(nm).join(', ')}${ids.length > 8 ? ' …' : ''}` : 'quiet day'}`
        + (born.length ? ` · new: ${born.slice(0, 4).map(nm).join(', ')}` : '');
      // structure: "map changed: 3 added (A, B) · C moved to D · E renamed (was F) · G done"
      const by = {}; for (const c of cs) (by[c.k] ||= []).push(c);
      const dot = c => labels[c.id] ? nm(c.id) : esc(c.label || c.id), tgt = id => id ? (labels[id] ? nm(id) : esc(id)) : '';
      const part = k => { const r = by[k]; if (!r) return '';
        if (k === 'moved' || k === 'merged') return r.slice(0, 3).map(c => `${dot(c)} ${k === 'moved' ? 'moved under' : 'merged into'} ${tgt(c.to)}`).join(' · ') + (r.length > 3 ? ` · +${r.length - 3} ${k}` : '');
        if (k === 'renamed') return r.slice(0, 3).map(c => `${dot(c)} renamed${c.from ? ` (was ${esc(c.from)})` : ''}`).join(' · ') + (r.length > 3 ? ` · +${r.length - 3} renamed` : '');
        return `${r.length} ${VERB[k]}: ${r.slice(0, 4).map(dot).join(', ')}${r.length > 4 ? ' …' : ''}`; };
      chg.innerHTML = cs.length ? `<b>map changed</b> · ${['added', 'moved', 'renamed', 'merged', 'done', 'archived'].map(part).filter(Boolean).join(' · ')}` : ''; };
    const stop = () => { clearInterval(timer); timer = null; btn.innerHTML = PLAY; };
    bars.addEventListener('click', e => { const b = e.target.closest('i'); if (!b) return; stop(); const i = +b.dataset.i; pick(i === sel ? -1 : i); });
    ticks.addEventListener('click', e => { const b = e.target.closest('i'); if (!b) return; stop(); const i = +b.dataset.i; pick(i === sel ? -1 : i); });
    el.querySelectorAll('.cap').forEach(c => c.addEventListener('click', e => { const a = e.target.closest('a[data-id]'); if (a && window.nsOpen) { stop(); window.nsOpen(a.dataset.id); } }));
    btn.addEventListener('click', () => { if (timer) return stop(); btn.innerHTML = STOP; let i = 0;   // from the first day, so the map grows
      pick(i); timer = setInterval(() => { i++; if (i >= list.length) { stop(); return pick(-1); } pick(i); }, 800); });
    const q = new URLSearchParams(location.search).get('day'), qi = G ? list.findIndex(k => q >= G[k].from && q <= G[k].to) : list.indexOf(q); if (q && qi >= 0) pick(qi);   // ?day=YYYY-MM-DD links a day
    document.addEventListener('keydown', e => { if (e.key === 'Escape' && sel >= 0) { stop(); pick(-1); } });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})();
