/* The public map's live layer (2026-10-13, her yes): which public dots have an agent working right
 * now. Ids only, from the North Star relay (written every minute by loop/public-activity.mjs);
 * read at most once a minute and laid over map.public.json -- a listed dot spins (status working),
 * a planned one stays planned. Nothing else comes from the server. */
(function () {
  const URL = 'https://strapi-backend-production-4eb8.up.railway.app/north-star/public/activity';
  const ID = /^[a-z0-9][a-z0-9-]{0,47}$/;
  let last = null, lastAt = 0;
  async function activity() {
    if (Date.now() - lastAt < 60000) return last;
    lastAt = Date.now();
    try { const r = await fetch(URL + '?m=' + Math.floor(Date.now() / 60000), { cache: 'no-store' });
      if (r.ok) { const j = await r.json(); last = { at: j.at || null, active: (j.active || []).filter(x => ID.test(x)), planned: (j.planned || []).filter(x => ID.test(x)) }; } } catch {}
    return last;
  }
  window.nsLive = async function (map) {
    const a = await activity(); if (!a) return map;
    // A relay that has not heard from the Mac for 10 minutes spins nothing.
    const fresh = a.at && Date.now() - Date.parse(a.at) < 600000;
    const on = new Set(fresh ? a.active : []), plan = new Set(a.planned), at = {};
    const set = n => { if (on.has(n.id)) { n.status = 'working'; at[n.id] = 1; } else if (plan.has(n.id) && !n.stage && n.status === 'idle') n.status = 'planned'; };
    for (const p of map.projects || []) { set(p); (p.children || []).forEach(set); }
    map.activity = { working: Object.keys(at).length, at };
    return map;
  };
})();

/* Embedded load progress (T230 2026-10-14): when the map sits in her portfolio's North Star tab, tell the
 * parent page how far loading has got, so it shows a real progress line instead of a blank wait.
 * Stages only, no data: boot (scripts ran), data (map.public.json in), drawn (the map is on screen). */
(function () {
  if (window.parent === window) return;
  const post = (stage, pct) => { try { window.parent.postMessage({ type: 'ns-map-progress', stage, pct }, '*'); } catch {} };
  post('boot', 0.45);
  const live = window.nsLive;
  if (live) window.nsLive = async function (map) { post('data', 0.8); return live(map); };
  const done = () => { const t = document.getElementById('ticker'); return t && !/loading map/.test(t.textContent); };
  const watch = () => {
    if (done()) return post('drawn', 1);
    const t = document.getElementById('ticker');
    if (!t) return setTimeout(watch, 100);
    const mo = new MutationObserver(() => { if (done()) { mo.disconnect(); post('drawn', 1); } });
    mo.observe(t, { childList: true, characterData: true, subtree: true });
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', watch); else watch();
})();
