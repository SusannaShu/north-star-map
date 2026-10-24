/* The public map's live layer (2026-10-13, her yes): which public dots have an agent working right
 * now, plus one bare count of all agents working (2026-10-14). Ids only, straight from the Mac mini over Tailscale Funnel
 * (2026-10-14 4:21 pm, her yes; loop/public-activity-serve.mjs, written every minute by loop/public-activity.mjs; no fallback --
 * if the mini is down the live layer shows nothing);
 * read at most once a minute and laid over map.public.json -- a listed dot spins (status working),
 * a planned one stays planned. Nothing else comes from the server. */
(function () {
  const URL = 'https://susannas-mac-mini.tailc633d2.ts.net:8443/activity';
  // T1748 (her 10:10 am 10/22): on her own tailnet devices the Funnel name resolves to 100.x and Chrome's Local Network
  // Access blocks the read (in the portfolio iframe it cannot even ask), so the agents line vanished for her. The
  // Strapi mirror holds the same fail-closed body (filtered again below); read it when the Funnel read fails.
  const MIRROR = 'https://strapi-backend-production-4eb8.up.railway.app/north-star/public/activity';
  // T1992 (her 2:54 pm 10/23): a local copy (the portfolio previews on the Mac mini, 127.0.0.1) reads the same file from
  // loop/public-activity-serve.mjs directly -- the mirror has no worker rows, so the agents panel came up empty there.
  const LOCAL = /^(localhost|127\.0\.0\.1)$/.test(location.hostname) ? `http://${location.hostname}:4432/activity` : null;
  const ID = /^[a-z0-9][a-z0-9-]{0,47}$/;
  const n99 = v => Number.isInteger(v) && v >= 0 && v < 100 ? v : null;
  // the only titles a worker row may carry (same list as loop/public-snapshot/worker-titles.mjs)
  const TITLES = ['Building a feature', 'Fixing a bug', 'Research', 'Planning', 'Design', 'Writing', 'Admin', 'Maintenance', 'Testing', 'Routine check', 'Working on a task'];
  const STATUSES = ['working', 'waiting', 'queued'];
  let last = null, lastAt = 0;
  async function activity() {
    if (Date.now() - lastAt < 60000) return last;
    lastAt = Date.now();
    const m = '?m=' + Math.floor(Date.now() / 60000);
    const read = async u => { const r = await fetch(u + m, { cache: 'no-store' }); if (!r.ok) throw new Error(r.status); return r.json(); };
    try { const j = await (LOCAL ? read(LOCAL).catch(() => read(URL)) : read(URL)).catch(() => read(MIRROR));
      { last = { at: j.at || null, active: (j.active || []).filter(x => ID.test(x)),
        // SUSANNA (T2238): the public dots she is on in Talk right now -- ids only, at most 3
        her: (Array.isArray(j.her) ? j.her : []).filter(x => typeof x === 'string' && ID.test(x)).slice(0, 3), planned: (j.planned || []).filter(x => ID.test(x)),
        count: n99(j.count), queued: n99(j.queued), waiting: n99(j.waiting), asleep: n99(j.asleep),
        labels: (Array.isArray(j.labels) ? j.labels : []).filter(x => typeof x === 'string' && /^[A-Za-z0-9 &+]{1,32}$/.test(x)).slice(0, 8),
        // WORKERS (T710): one fixed public title, a public area label and working / waiting / queued -- nothing else
        workers: (Array.isArray(j.workers) ? j.workers : []).filter(w => w && TITLES.includes(w.title) && STATUSES.includes(w.status)
          && typeof w.area === 'string' && /^[A-Za-z0-9 &+]{1,32}$/.test(w.area)).slice(0, 30).map(w => ({ title: w.title, area: w.area, status: w.status })),
        // OUT OF USAGE (T590): a flag and the reset time in words, nothing else
        paused: j.paused && typeof j.paused === 'object' ? { until: typeof j.paused.until === 'string' && /^[A-Za-z0-9 :]{1,32}$/.test(j.paused.until) ? j.paused.until : null } : null }; } } catch {}
    return last;
  }
  window.nsLive = async function (map) {
    const a = await activity() || { at: null, active: [], planned: [] };   // no feed = nothing works (T2197)
    // Activity older than 10 minutes (the minute job stopped) spins nothing.
    const fresh = a.at && Date.now() - Date.parse(a.at) < 600000;
    const on = new Set(fresh ? a.active : []), plan = new Set(a.planned), at = {}, her = {};
    const ids = new Set(); for (const p of map.projects || []) { ids.add(p.id); (p.children || []).forEach(c => ids.add(c.id)); }
    for (const id of fresh ? a.her || [] : []) if (ids.has(id)) her[id] = 1;
    // ONLY the live feed makes a dot work (T2197, her 9:14-9:23 am 10/24 "that's not the real dots that's working"): a
    // 'working' baked into map.public.json at build time stops the moment its worker is gone from the minute feed.
    const set = n => { if (on.has(n.id)) { n.status = 'working'; at[n.id] = 1; } else if (n.status === 'working') n.status = 'idle'; else if (plan.has(n.id) && !n.stage && n.status === 'idle') n.status = 'planned'; };
    for (const p of map.projects || []) { set(p); (p.children || []).forEach(set); }
    // COUNT (2026-10-14, her yes): the header says how many agents work right now, all of them --
    // a bare number from the relay, never which dots; at least the public dots spinning.
    const n = Object.keys(at).length;
    // QUEUED (2026-10-15 9:19 pm, her yes): the same "N working · M queued" as her private map, plus the
    // public area labels the relay lets out ("Mittens", "Robot Skin") -- counts and labels only.
    map.activity = { working: fresh && a.count != null ? Math.max(a.count, n) : n, queued: fresh ? a.queued || 0 : 0, waiting: fresh ? (a.waiting ?? a.asleep) || 0 : 0, asleep: fresh ? a.asleep || 0 : 0, workers: fresh ? a.workers : [],
      labels: fresh ? a.labels || [] : [], paused: fresh ? a.paused || null : null, at, her };
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
