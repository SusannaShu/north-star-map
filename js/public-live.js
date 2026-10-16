/* The public map's live layer (2026-10-13, her yes): which public dots have an agent working right
 * now, plus one bare count of all agents working (2026-10-14). Ids only, straight from the Mac mini over Tailscale Funnel
 * (2026-10-14 4:21 pm, her yes; loop/public-activity-serve.mjs, written every minute by loop/public-activity.mjs; no fallback --
 * if the mini is down the live layer shows nothing);
 * read at most once a minute and laid over map.public.json -- a listed dot spins (status working),
 * a planned one stays planned. Nothing else comes from the server. */
(function () {
  const URL = 'https://susannas-mac-mini.tailc633d2.ts.net:8443/activity';
  const ID = /^[a-z0-9][a-z0-9-]{0,47}$/;
  const n99 = v => Number.isInteger(v) && v >= 0 && v < 100 ? v : null;
  let last = null, lastAt = 0;
  async function activity() {
    if (Date.now() - lastAt < 60000) return last;
    lastAt = Date.now();
    try { const r = await fetch(URL + '?m=' + Math.floor(Date.now() / 60000), { cache: 'no-store' });
      if (r.ok) { const j = await r.json(); last = { at: j.at || null, active: (j.active || []).filter(x => ID.test(x)), planned: (j.planned || []).filter(x => ID.test(x)),
        count: n99(j.count), queued: n99(j.queued), asleep: n99(j.asleep),
        labels: (Array.isArray(j.labels) ? j.labels : []).filter(x => typeof x === 'string' && /^[A-Za-z0-9 &+]{1,32}$/.test(x)).slice(0, 8) }; } } catch {}
    return last;
  }
  window.nsLive = async function (map) {
    const a = await activity(); if (!a) return map;
    // Activity older than 10 minutes (the minute job stopped) spins nothing.
    const fresh = a.at && Date.now() - Date.parse(a.at) < 600000;
    const on = new Set(fresh ? a.active : []), plan = new Set(a.planned), at = {};
    const set = n => { if (on.has(n.id)) { n.status = 'working'; at[n.id] = 1; } else if (plan.has(n.id) && !n.stage && n.status === 'idle') n.status = 'planned'; };
    for (const p of map.projects || []) { set(p); (p.children || []).forEach(set); }
    // COUNT (2026-10-14, her yes): the header says how many agents work right now, all of them --
    // a bare number from the relay, never which dots; at least the public dots spinning.
    const n = Object.keys(at).length;
    // QUEUED (2026-10-15 9:19 pm, her yes): the same "N working · M queued" as her private map, plus the
    // public area labels the relay lets out ("Mittens", "Robot Skin") -- counts and labels only.
    map.activity = { working: fresh && a.count != null ? Math.max(a.count, n) : n, queued: fresh ? a.queued || 0 : 0, asleep: fresh ? a.asleep || 0 : 0,
      labels: fresh ? a.labels || [] : [], at };
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
