const CLOUD = location.pathname.startsWith("/north-star/ui");

const MAC_ONLY = /^\/api\/(resume|skill|file|rebuild|intent|review|people)/;

let loginP = null;

function nsLogin(msg) {
    return loginP ||= new Promise(done => {
        const ov = document.createElement("div");
        ov.className = "overlay open";
        ov.style.zIndex = 60;
        ov.innerHTML = `<form class="modal" style="padding:24px;gap:12px;display:flex;flex-direction:column;width:min(380px,100%)">\n      <h2 style="font-family:var(--font-heading);font-size:24px">NORTH STAR</h2>\n      <div class="hint" id="lgMsg">${msg || "log in with your SHEYOU account"}</div>\n      <input class="lg" name="email" type="email" autocomplete="username" placeholder="email" required>\n      <input class="lg" name="password" type="password" autocomplete="current-password" placeholder="password" required>\n      <button class="topbtn primary" style="padding:12px">Log in</button></form>`;
        ov.querySelectorAll(".lg").forEach(i => Object.assign(i.style, {
            padding: "12px 14px",
            border: "1px solid var(--border)",
            borderRadius: "8px",
            fontSize: "15px",
            fontFamily: "var(--font)",
            background: "var(--bg)",
            color: "var(--text)"
        }));
        document.body.appendChild(ov);
        ov.querySelector("form").onsubmit = async e => {
            e.preventDefault();
            const f = new FormData(e.target), m = ov.querySelector("#lgMsg");
            m.textContent = "checking…";
            try {
                const r = await fetch("/north-star/login", {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json"
                    },
                    body: JSON.stringify({
                        email: f.get("email"),
                        password: f.get("password")
                    })
                });
                const j = await r.json().catch(() => ({}));
                if (!r.ok) {
                    m.textContent = j.message || j.error || "wrong email or password";
                    return;
                }
                try {
                    localStorage.setItem("nsSecret", j.secret);
                    if (j.macHost) localStorage.setItem("nsMac", j.macHost);
                } catch {}
                ov.remove();
                loginP = null;
                done(j.secret);
            } catch {
                m.textContent = "could not reach the server";
            }
        };
    });
}

async function nsSecret(reset) {
    if (window.NS_SECRET && !reset) return window.NS_SECRET;
    let k = null;
    try {
        k = reset ? null : localStorage.getItem("nsSecret");
    } catch {}
    return k || nsLogin(reset ? "that login expired — log in again" : null);
}

window.api = async function(path, opts = {}) {
    if (!CLOUD) return fetch(path, opts);
    if (MAC_ONLY.test(path)) return new Response(JSON.stringify({
        ok: false,
        error: "only on the Mac"
    }), {
        status: 403,
        headers: {
            "Content-Type": "application/json"
        }
    });
    const go = key => fetch("/north-star" + path.replace(/^\/api/, ""), {
        ...opts,
        headers: {
            ...opts.headers || {},
            "X-North-Star-Secret": key
        }
    });
    const r = await go(await nsSecret());
    return r.status === 401 && !window.NS_SECRET ? go(await nsSecret(true)) : r;
};

window.MAC_BASE = CLOUD ? String(window.NS_TTS_BASE || "").replace(/\/+$/, "") : "";

window.macUrl = u => CLOUD && window.MAC_BASE && /^\/(?!\/)/.test(String(u || "")) ? window.MAC_BASE + u : u;

const macKnown = CLOUD && !window.MAC_BASE ? api("/api/status").then(r => r.json()).then(j => {
    const d = j && j.voice && j.voice.direct;
    if (d) window.MAC_BASE = String(d).replace(/\/+$/, "");
}).catch(() => {}) : Promise.resolve();

const QS = new URLSearchParams(location.search);

const PUBLIC = true, _qsPublic = QS.get("public") === "1", EMBED = QS.get("embed") === "1", PREVIEW = QS.get("preview") === "1";

const MINI = QS.get("mini") === "1";

const WALL = QS.get("wall") === "1";

if (WALL) document.documentElement.classList.add("wall");

window.NS_PUBLIC = PUBLIC;

async function fetchMapData() {
    if (!PUBLIC) {
        const r = await api("/api/map", {
            cache: "no-store"
        });
        return r.ok ? r.json() : null;
    }
    try {
        const r = await fetch("map.public.json", {
            cache: "no-store"
        });
        if (r.ok) {
            const j = await r.json();
            if (j && j.public) return window.nsLive ? await window.nsLive(j) : j;
        }
    } catch {}
    return null;
    const r = await api("/api/map", {
        cache: "no-store"
    });
    if (!r.ok) return null;
    let workers = [];
    try {
        const h = await api("/api/health", {
            cache: "no-store"
        });
        if (h.ok) workers = (await h.json()).workers || [];
    } catch {}
    return window.nsPublicView(await r.json(), {
        workers: workers
    });
}

const PUBLIC_LINE = "live from a desk in New York";

let HERE = null;

async function fetchHere() {
    if (PUBLIC) return null;
    try {
        const r = await api("/api/location", {
            cache: "no-store"
        });
        if (r.ok) {
            const l = await r.json();
            const at = Date.parse(l && l.at || "") || 0;
            HERE = l && l.lat != null ? {
                at: l.at,
                place: l.place || null,
                lat: l.lat,
                lon: l.lon,
                fresh: Date.now() - at < 12 * 36e5,
                history: (l.history || []).slice(-40)
            } : null;
        }
    } catch {}
    if (DATA) DATA.location = HERE;
    return HERE;
}

const FALLBACK = {
    hub: {
        id: "north-star",
        label: "NORTH STAR",
        why: "What I care about and what I'm building.",
        yesterday: [ "(offline — start server.js for live data)" ],
        today: []
    },
    projects: [],
    health: {},
    ticker: [ "<b>north-star</b> · offline — run: node server.js" ],
    sync: []
};

let DATA = FALLBACK;

let nodes = [], links = [], byId = {}, DETAILS = {};

const SZ = {
    hub: 30,
    project: 20,
    sub: 16,
    owned: 11,
    child: 7,
    minor: 8
};

const FONT = {
    hub: [ 900, 16, "Archivo Black" ],
    project: [ 900, 14, "Archivo Black" ],
    sub: [ 900, 12.5, "Archivo Black" ],
    owned: [ 900, 11, "Archivo Black" ],
    child: [ 500, 11.5, "Inter" ]
};

const fontKey = n => n.type === "hub" ? "hub" : n.type === "project" ? n.sub ? "sub" : "project" : n.owned ? "owned" : "child";

const fontPx = n => FONT[fontKey(n)][1] * (STILL ? 1.3 : isMobile() ? 1.22 : 1);

const fontOf = n => {
    const f = FONT[fontKey(n)];
    return `${n.stage === "plan" ? "italic " : ""}${f[0]} ${fontPx(n)}px ${f[2]}, sans-serif`;
};

const SECTORS = [ "mittens", "path", "portfolio", "fashion", "marketing", "outreach", "job", "northstar", "life-inputs", "susu-map", "devhub" ];

const MINOR_KINDS = new Set([ "routine", "channel", "ptype", "convo" ]);

const DONE_FOLD_MS = 7 * 864e5;

const DONE_C = "#8C8C8C";

const RING = d => d <= 0 ? 0 : 190 + (d - 1) * 120;

const MINOR_W = .5, MINOR_STAGGER = 44;

let TREE_TOP = [], EX = 1, EY = 1, fitK = 1;

const isOverlay = n => n.type === "intent" || n.type === "agent";

const vaOf = n => BORN && isOverlay(n) ? 0 : n.va == null ? 1 : n.va;

let ROOT = null, LEAF = null, PENDING_LEAF = null, PENDING_RING = null, HUBKIDS = [];

let LEAFMAP = false;

let FULL = {
    hub: "north-star",
    e: {}
};

const OPEN_WANT = QS.get("open");

function indexFull(data) {
    const e = {}, hub = data.hub || {}, P = data.projects || [], ids = new Set(P.map(p => p.id));
    e[hub.id] = {
        id: hub.id,
        label: hub.label,
        type: "hub",
        up: null,
        det: hub,
        hasKids: true
    };
    P.forEach(p => {
        const up = p.parent && ids.has(p.parent) && p.parent !== p.id ? p.parent : hub.id;
        e[p.id] = {
            id: p.id,
            label: p.label,
            type: "project",
            sub: up !== hub.id,
            up: up,
            status: p.status,
            stage: p.stage || null,
            planned: p.status === "planned" && p.stage !== "plan",
            find: !!p.find,
            det: p,
            hasKids: !!(p.children || []).length
        };
    });
    P.forEach(p => {
        const up = e[p.id].up;
        if (up !== hub.id && e[up]) e[up].hasKids = true;
        (p.children || []).forEach(c => {
            if (e[c.id]) return;
            const owned = !!(c.why || c.yesterday || c.today || c.kind);
            e[c.id] = {
                id: c.id,
                label: c.label,
                type: "child",
                up: p.id,
                owned: owned,
                kind: c.kind || null,
                status: c.status,
                stage: c.stage || null,
                planned: c.status === "planned" && c.stage !== "plan",
                find: !!c.find,
                det: owned ? {
                    statusLine: c.statusLine || p.statusLine,
                    ...c
                } : null
            };
        });
    });
    FULL = {
        hub: hub.id,
        e: e
    };
}

const canRoot = id => !!(FULL.e[id] && FULL.e[id].type === "project" && FULL.e[id].hasKids);

function rerootData(data, id) {
    const P = data.projects || [], root = P.find(p => p.id === id);
    if (!root) return data;
    const under = new Set([ id ]);
    let grew = true;
    while (grew) {
        grew = false;
        P.forEach(p => {
            if (p.parent && under.has(p.parent) && !under.has(p.id)) {
                under.add(p.id);
                grew = true;
            }
        });
    }
    under.delete(id);
    const projects = P.filter(p => under.has(p.id)).map(p => p.parent === id ? {
        ...p,
        parent: undefined
    } : p);
    const {children: children, parent: parent, ...hub} = root;
    return {
        ...data,
        hub: {
            ...hub,
            id: root.id,
            label: root.label
        },
        hubKids: children || [],
        projects: projects
    };
}

function resolveOpen(id) {
    const e = FULL.e[id];
    if (!e) return;
    if (e.type === "hub") {
        ROOT = null;
        return;
    }
    if (MINI) {
        const rootOf = x => x && x !== FULL.hub && canRoot(x) ? x : null, kids = x => Object.values(FULL.e).filter(k => k.up === x).length;
        let r = rootOf(e.up);
        if (r && kids(r) < 5 && rootOf(FULL.e[r].up)) r = FULL.e[r].up;
        ROOT = r;
        PENDING_RING = id;
        return;
    }
    if (canRoot(id)) {
        ROOT = id;
        return;
    }
    const up = e.up && e.up !== FULL.hub && canRoot(e.up) ? e.up : null;
    ROOT = up;
    if (!(e.type === "child" && !e.owned)) PENDING_LEAF = id;
}

function setRoot(id) {
    if (id === FULL.hub || id && !canRoot(id)) id = null;
    const changed = id !== ROOT;
    setDrawer(false);
    if (DOC) docPane(false);
    if (LEAF) {
        const wasMap = LEAFMAP;
        LEAF = null;
        LEAFMAP = false;
        renderLeafCap();
        if (!wasMap && window.closeFocus) window.closeFocus();
    }
    ROOT = id;
    hoverNode = null;
    dragNode = null;
    panelNode = null;
    if (changed) {
        buildGraph(DATA);
        nodes.forEach(n => {
            if (isOverlay(n) || n.type === "hub") return;
            n.x = n.hx * .12;
            n.y = n.hy * .12;
            n.va = 0;
        });
        userCam = 0;
        fitAll();
        if (SEARCH.q) runSearch(SEARCH.q);
    }
    renderCrumbs();
    syncURL();
}

window.nsSetRoot = setRoot;

function clickDot(n) {
    if (!n) return;
    if (MINI) return miniGo(n.id);
    if (isOverlay(n)) return openPanel(n);
    if (n.type === "hub") return toggleDrawer(n);
    if (n.type === "project" && ((n.kids || []).length || (n.subs || []).length)) return setRoot(n.id);
    if (n.type === "child" && !n.owned) {
        const up = byId[n.up];
        return up && up.type === "hub" ? toggleDrawer(up) : setRoot(n.up);
    }
    openLeaf(n);
}

function openDot(id) {
    const here = byId[id];
    if (here && isOverlay(here)) return openPanel(here);
    const e = FULL.e[id];
    if (!e) return;
    if (e.type === "hub") return setRoot(null);
    if (canRoot(id)) return setRoot(id);
    const up = e.up && e.up !== FULL.hub ? e.up : null;
    if (e.type === "child" && !e.owned) return setRoot(up);
    if (!here) setRoot(up);
    if (byId[id]) openLeaf(byId[id]);
}

window.nsOpen = openDot;

function miniGo(id) {
    for (let w = window.parent, i = 0; w && w !== window && i < 3; w = w.parent, i++) {
        try {
            if (w.nsOpen) return w.nsOpen(id);
        } catch {
            break;
        }
        if (w === w.parent) break;
    }
    const q = new URLSearchParams(location.search);
    q.delete("mini");
    q.set("open", id);
    window.open(location.pathname + "?" + q.toString(), "_blank", "noopener");
}

function leafHasPage(id, opts) {
    if (opts && opts.noGraph) return true;
    const d = DETAILS[id] || FULL.e[id] && FULL.e[id].det || {};
    return hasVisual(d) || d.view === "location" || id === "location" || d.kind === "ptype" || !!d.hasFlow || String(id).startsWith("r:") || !!((DATA.peopleAt || {})[id] || []).length;
}

function openLeaf(n, opts) {
    if (!n) return;
    setDrawer(false);
    if (DOC) docPane(false);
    if (!leafHasPage(n.id, opts)) {
        const e = FULL.e[n.id], up = e && e.up && e.up !== FULL.hub && canRoot(e.up) ? e.up : null;
        if (up !== ROOT) setRoot(up); else if (LEAF && !LEAFMAP && window.closeFocus) window.closeFocus();
        n = byId[n.id];
        if (!n) return;
        LEAF = n.id;
        LEAFMAP = true;
        panelNode = n;
        renderLeafCap();
        renderCrumbs();
        syncURL();
        fitAll();
        return;
    }
    LEAFMAP = false;
    renderLeafCap();
    LEAF = n.id;
    panelNode = n;
    if (window.openFocus) window.openFocus(n, opts);
    renderCrumbs();
    syncURL();
}

function closeLeaf() {
    if (!LEAF) return;
    const wasMap = LEAFMAP;
    LEAF = null;
    LEAFMAP = false;
    panelNode = null;
    if (!wasMap && window.closeFocus) window.closeFocus();
    renderLeafCap();
    renderCrumbs();
    syncURL();
    if (wasMap) fitAll();
}

function renderLeafCap() {
    const el = document.getElementById("leafCap");
    if (!el) return;
    const e = LEAFMAP && FULL.e[LEAF];
    if (!e) {
        el.hidden = true;
        el.innerHTML = "";
        return;
    }
    const d = DETAILS[LEAF] || e.det || {}, txt = s => String(s || "").replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/\s+/g, " ").trim();
    const cut = (s, k) => s.length > k ? s.slice(0, k - 1).replace(/\s+\S*$/, "") + "…" : s;
    const why = txt(d.why || d.caption), sl = txt(d.statusLine);
    const st = e.status === "needs-you" ? "needs-you" : e.status === "working" ? "working" : e.status === "waiting" ? "waiting" : e.status === "queued" ? "queued" : "done";
    el.innerHTML = `<div class="lc-title"><span class="dot ${st}"></span>${esc(e.label)}</div>${why ? `<p>${esc(cut(why, 220))}</p>` : ""}${sl && sl !== why ? `<div class="lc-meta">${esc(cut(sl, 120))}</div>` : ""}`;
    el.hidden = false;
}

const hasVisual = d => !!(d && (d.embed || d.stack || d.paper || d.deadline || d.checklist || d.case || d.image || (d.cases || []).length || (d.images || []).length || (d.docs || []).some(x => x && x.thumb)));

let DOC = null;

const docSrcOf = d => d ? d.embed || d.stack || ((d.docs || []).find(x => x && x.href) || {}).href || null : null;

function docPane(on) {
    const el = document.getElementById("docPane");
    if (!el) return;
    const d = ROOT && FULL.e[ROOT] && FULL.e[ROOT].det, src = on ? docSrcOf(d) : null;
    if (src) {
        const fr = el.querySelector("iframe");
        if (el.dataset.src !== src) {
            el.dataset.src = src;
            fr.src = window.nsEmbedSrc ? window.nsEmbedSrc(src) : macUrl(src);
            if (window.nsWatchEmbed) window.nsWatchEmbed(fr, lead => {
                const c = el.querySelector(".doc-cap");
                if (c && lead && !c.textContent) c.textContent = lead;
            });
        }
        el.querySelector(".doc-title").textContent = FULL.e[ROOT].label || "";
        el.querySelector(".doc-cap").textContent = d.embedCaption || "";
        el.querySelector(".doc-full").href = macUrl(src);
        if (panel.classList.contains("open")) setDrawer(false);
    }
    const was = DOC;
    DOC = src ? ROOT : null;
    el.classList.toggle("open", !!DOC);
    document.body.classList.toggle("doc-open", !!DOC);
    const fab = document.getElementById("docFab");
    if (fab) fab.setAttribute("aria-pressed", DOC ? "true" : "false");
    if (was !== DOC) {
        setGravity();
        userCam = 0;
        fitAll();
    }
}

function renderDocFab() {
    const fab = document.getElementById("docFab");
    if (!fab) return;
    const d = ROOT && FULL.e[ROOT] && FULL.e[ROOT].det, src = !STILL && (!LEAF || LEAFMAP) && docSrcOf(d);
    fab.hidden = !src;
    const lc = document.getElementById("leafCap");
    fab.style.bottom = src && LEAFMAP && isMobile() && lc && !lc.hidden ? lc.offsetHeight + 24 + "px" : "";
    if (src) fab.title = d.embedCaption ? "the plan: " + d.embedCaption : "open the plan";
}

const CODE_HOME = "code-northstar", CODE_ALL = "code-architecture-tree";

function codeDotOf(id) {
    if (!id || id === FULL.hub) return FULL.e[CODE_HOME] ? CODE_HOME : null;
    for (let x = id, n = 0; x && n < 12; x = (FULL.e[x] || {}).up, n++) {
        if (x === FULL.hub || x === CODE_ALL || String(x).startsWith("code-")) return null;
        if (FULL.e["code-" + x] && FULL.e["code-" + x].up === x) return "code-" + x;
    }
    return null;
}

const codeSrcOf = id => {
    const e = FULL.e[id];
    return e && e.det && e.det.embed || (id ? `/private/${id}.html` : null);
};

let CODE = null;

function codePane(id, src) {
    const el = document.getElementById("codePane");
    if (!el) return;
    CODE = id || null;
    if (CODE) {
        src = src || codeSrcOf(CODE);
        const fr = el.querySelector("iframe"), host = FULL.e[(FULL.e[CODE] || {}).up];
        const cap = el.querySelector(".doc-cap");
        if (el.dataset.src !== src) {
            el.dataset.src = src;
            cap.dataset.lead = "";
            fr.src = window.nsEmbedSrc ? window.nsEmbedSrc(src) : macUrl(src);
            if (window.nsWatchEmbed) window.nsWatchEmbed(fr, lead => {
                if (lead) {
                    cap.dataset.lead = lead;
                    cap.textContent = lead;
                }
            });
        }
        el.querySelector(".doc-title").textContent = CODE === CODE_ALL ? "CODE ARCHITECTURE TREE" : "CODE ARCHITECTURE" + (host ? " · " + host.label : "");
        cap.textContent = cap.dataset.lead || (CODE === CODE_ALL ? "every tree, how they are built from the code, your checklist" : "tap a branch to unfold it: every if / else, loop, gate, prompt and file line, read from the real code");
        el.querySelector(".doc-full").href = macUrl(src);
        const all = el.querySelector(".code-all");
        all.setAttribute("aria-pressed", CODE === CODE_ALL ? "true" : "false");
        all.textContent = CODE === CODE_ALL ? "this view’s tree" : "all code trees";
        if (panel.classList.contains("open")) setDrawer(false);
    }
    el.classList.toggle("open", !!CODE);
    document.body.classList.toggle("code-open", !!CODE);
    const fab = document.getElementById("codeFab");
    if (fab) fab.setAttribute("aria-pressed", CODE ? "true" : "false");
}

function renderCodeFab() {
    const fab = document.getElementById("codeFab");
    if (!fab) return;
    const id = !STILL && !PUBLIC && (!LEAF || LEAFMAP) ? codeDotOf(ROOT) : null;
    fab.hidden = !id;
    fab.dataset.dot = id || "";
    if (id) {
        const host = FULL.e[(FULL.e[id] || {}).up];
        fab.title = "the code tree" + (host ? ": " + host.label : "") + " -- every if / else, loop, gate and prompt";
    }
}

{
    const f = document.getElementById("codeFab"), p = document.getElementById("codePane");
    if (f) f.onclick = () => CODE ? codePane(null) : codePane(f.dataset.dot);
    if (p) {
        p.querySelector("#codeClose").onclick = () => codePane(null);
        p.querySelector(".code-all").onclick = () => codePane(CODE === CODE_ALL ? f && f.dataset.dot || CODE_HOME : CODE_ALL);
        p.querySelector(".code-dot").onclick = ev => {
            ev.preventDefault();
            codePane(null);
            openDot(CODE_ALL);
        };
    }
}

window.nsOpenCode = id => codePane(id || codeDotOf(ROOT) || CODE_HOME);

window.nsOpenVisual = () => {
    const d = ROOT && FULL.e[ROOT] && FULL.e[ROOT].det;
    if (docSrcOf(d)) return docPane(!DOC);
    if (ROOT && byId[ROOT]) openLeaf(byId[ROOT], {
        noGraph: true
    });
};

function syncURL() {
    if (STILL || !window.history || !history.replaceState) return;
    const q = new URLSearchParams(location.search), id = LEAF || ROOT;
    if (id) q.set("open", id); else q.delete("open");
    const s = q.toString();
    try {
        history.replaceState(history.state, "", location.pathname + (s ? "?" + s : "") + location.hash);
    } catch {}
}

function renderCrumbs() {
    renderDocFab();
    renderCodeFab();
    const el = document.getElementById("nsCrumbs");
    if (!el) return;
    const cur = LEAF || ROOT;
    if (!cur || STILL || !FULL.e[cur]) {
        el.hidden = true;
        el.innerHTML = "";
        document.body.classList.remove("has-crumbs");
        return;
    }
    const chain = [];
    let id = cur, guard = 0;
    while (id && id !== FULL.hub && FULL.e[id] && guard++ < 12) {
        chain.unshift(id);
        id = FULL.e[id].up;
    }
    let items = [ FULL.hub, ...chain ].map(x => ({
        id: x,
        label: FULL.e[x] ? FULL.e[x].label : x
    }));
    if (isMobile() && items.length > 3) items = [ items[0], {
        id: items[items.length - 3].id,
        label: "…"
    }, ...items.slice(-2) ];
    const rd = ROOT && FULL.e[ROOT] && FULL.e[ROOT].det;
    const chip = "";
    el.innerHTML = items.map((c, i) => (i ? '<i aria-hidden="true">›</i>' : "") + (i === items.length - 1 ? `<b aria-current="page">${esc(c.label)}</b>` : `<button type="button" data-go="${esc(c.id)}">${esc(c.label)}</button>`)).join("") + chip;
    el.hidden = false;
    document.body.classList.add("has-crumbs");
}

{
    const cr = document.getElementById("nsCrumbs");
    if (cr) cr.addEventListener("click", e => {
        if (e.target.closest("#crumbPlan")) {
            if (LEAF && LEAF === ROOT) closeLeaf(); else window.nsOpenVisual();
            return;
        }
        const b = e.target.closest("button[data-go]");
        if (!b) return;
        setRoot(b.dataset.go === FULL.hub ? null : b.dataset.go);
    });
}

function buildGraph(full) {
    indexFull(full);
    const want = OPEN_WANT && !FULL.e[OPEN_WANT] && full.aliases && full.aliases[OPEN_WANT] ? full.aliases[OPEN_WANT] : OPEN_WANT;
    if (!buildGraph.opened && full !== FALLBACK && want && FULL.e[want]) {
        buildGraph.opened = true;
        resolveOpen(want);
    }
    if (ROOT && !canRoot(ROOT)) ROOT = null;
    window.NS_ROOT = ROOT;
    renderCrumbs();
    const data = ROOT ? rerootData(full, ROOT) : full;
    nodes = [];
    links = [];
    byId = {};
    DETAILS = {};
    HUBKIDS = [];
    const push = n => {
        nodes.push(n);
        byId[n.id] = n;
        return n;
    };
    const hubN = push({
        id: data.hub.id,
        label: data.hub.label,
        type: "hub",
        depth: 0,
        x: 0,
        y: 0,
        hx: 0,
        hy: 0,
        vx: 0,
        vy: 0,
        r: SZ.hub,
        va: 1,
        vt: 1,
        kids: [],
        subs: []
    });
    DETAILS[data.hub.id] = data.hub;
    const P = data.projects || [], ids = new Set(P.map(p => p.id)), subsOf = {};
    P.forEach(p => {
        if (p.parent && ids.has(p.parent)) (subsOf[p.parent] ||= []).push(p);
    });
    const top = P.filter(p => !p.parent || !ids.has(p.parent));
    const rank = p => {
        const i = SECTORS.indexOf(p.id);
        return i < 0 ? 100 + P.indexOf(p) : i;
    };
    top.sort((a, b) => rank(a) - rank(b));
    const addKid = (p, n, c, depth) => {
        if (byId[c.id]) return;
        const owned = !!(c.why || c.yesterday || c.today || c.kind);
        const k = push({
            id: c.id,
            label: c.label,
            type: "child",
            parent: p.id,
            up: p.id,
            depth: depth + 1,
            owned: owned,
            kind: c.kind || null,
            pin: !!c.pin,
            stage: c.stage || null,
            planned: c.status === "planned" && c.stage !== "plan",
            find: !!c.find,
            live: !!c.live,
            status: p.status === "dormant" || p.parked ? "dormant" : c.status,
            activity: c.activity || null,
            x: 0,
            y: 0,
            vx: 0,
            vy: 0,
            r: owned ? SZ.owned : SZ.child
        });
        k.done = c.stage === "done";
        k.merged = !!c.mergedInto;
        k.doneOld = k.done && (!!c.archived || k.merged || !!c.doneAt && Date.now() - Date.parse(c.doneAt) > DONE_FOLD_MS);
        k.loud = !k.done && (k.status === "needs-you" || k.status === "working" || k.pin || k.live);
        k.fold = !k.loud && (!owned || MINOR_KINDS.has(k.kind) || k.planned || k.doneOld || k.kind === "howto" && !ROOT);
        links.push({
            s: p.id,
            t: c.id
        });
        if (owned) DETAILS[c.id] = {
            statusLine: c.statusLine || p.statusLine,
            ...c
        };
        n.kids.push(k);
    };
    const make = (p, depth, up, seen) => {
        if (seen.has(p.id)) return null;
        seen.add(p.id);
        const n = push({
            id: p.id,
            label: p.label,
            type: "project",
            sub: depth > 1,
            depth: depth,
            up: up,
            status: p.status,
            activity: p.activity || null,
            folder: p.folder,
            done: p.stage === "done",
            stage: p.stage || null,
            planned: p.status === "planned" && p.stage !== "plan",
            find: !!p.find,
            x: 0,
            y: 0,
            vx: 0,
            vy: 0,
            r: depth > 1 ? SZ.sub : SZ.project,
            kids: [],
            subs: []
        });
        links.push({
            s: up,
            t: p.id,
            sub: depth > 1
        });
        DETAILS[p.id] = p;
        (p.children || []).forEach(c => addKid(p, n, c, depth));
        (subsOf[p.id] || []).forEach(q => {
            const s = make(q, depth + 1, p.id, seen);
            if (s) n.subs.push(s);
        });
        return n;
    };
    const seen = new Set;
    TREE_TOP = top.map(p => make(p, 1, data.hub.id, seen)).filter(Boolean);
    (data.hubKids || []).forEach(c => addKid(data.hub, hubN, c, 0));
    HUBKIDS = hubN.kids.slice();
    [ ...data.projects || [], {
        children: data.hubKids || []
    } ].forEach(p => (p.children || []).forEach(c => (c.links || []).forEach(t => {
        if (byId[c.id] && byId[t]) links.push({
            s: c.id,
            t: t,
            cross: true,
            faint: c.kind === "ptype" || c.kind === "howto",
            vision: byId[t].type === "hub"
        });
    })));
    (data.projects || []).forEach(p => (p.links || []).forEach(t => {
        if (byId[p.id] && byId[t]) links.push({
            s: p.id,
            t: t,
            cross: true
        });
    }));
    links = links.map(l => ({
        ...l,
        s: byId[l.s],
        t: byId[l.t]
    })).filter(l => l.s && l.t);
    nodes.forEach(n => {
        n.lw = measure(n);
    });
    layoutHomes();
    nodes.forEach(n => {
        if (isOverlay(n)) return;
        n.vt = n.minor ? 0 : 1;
        n.va = n.vt;
        const at = n.minor ? byId[n.up] : n;
        n.x = at.hx;
        n.y = at.hy;
    });
    if (window.syncOverlay) window.syncOverlay(true);
    for (let i = 0; i < 300; i++) step();
    fitAll();
    if (PENDING_LEAF && byId[PENDING_LEAF]) {
        const id = PENDING_LEAF;
        PENDING_LEAF = null;
        setTimeout(() => {
            if (byId[id]) openLeaf(byId[id]);
        }, 400);
    }
    if (PENDING_RING && byId[PENDING_RING]) {
        LEAF = PENDING_RING;
        LEAFMAP = true;
        panelNode = byId[LEAF];
        PENDING_RING = null;
        fitAll();
    }
}

const weightOf = n => n.type === "project" ? n._w : n.minor ? MINOR_W : 1;

const SPAN = n => n.type === "project" ? n.depth === 1 ? 64 : 58 : n.minor ? 16 : n.owned ? 40 : 32;

function layoutHomes() {
    const hub = nodes[0];
    if (!hub) return;
    const A = avail(), asp = A.h / Math.max(1, A.w);
    const compact = STILL || isMobile() && !ROOT;
    nodes.forEach(n => {
        if (n.type !== "child") return;
        n.minor = n.fold || compact && !n.loud;
        n.r = n.minor ? SZ.minor : n.owned ? SZ.owned : SZ.child;
    });
    const W8 = n => n._w = Math.max(1, n.subs.reduce((s, q) => s + W8(q), 0) + n.kids.reduce((s, k) => s + (k.minor ? MINOR_W : 1), 0));
    const TOP = [ ...HUBKIDS.filter(k => !k.minor), ...HUBKIDS.filter(k => k.minor), ...TREE_TOP ];
    TREE_TOP.forEach(W8);
    const itemsOf = n => n.type === "project" ? [ ...n.kids.filter(k => !k.minor), ...n.kids.filter(k => k.minor), ...n.subs ] : [];
    const NEED = n => {
        const own = SPAN(n) / RING(n.depth);
        const kids = itemsOf(n).reduce((s, q) => s + NEED(q), 0);
        return n._need = Math.max(own, kids);
    };
    TOP.forEach(NEED);
    const split = (items, span) => {
        const N = items.reduce((s, q) => s + q._need, 0) || 1, Wt = items.reduce((s, q) => s + weightOf(q), 0) || 1;
        return span >= N ? items.map(q => q._need + (span - N) * weightOf(q) / Wt) : items.map(q => q._need * span / N);
    };
    const share = split(TOP, Math.PI * 2), tot = Math.PI * 2;
    const big = share.indexOf(Math.max(...share));
    let before = 0;
    for (let i = 0; i < big; i++) before += share[i];
    const centre = 0;
    let a = centre - (before + share[big] / 2) / tot * Math.PI * 2;
    const put = (n, ang, R) => {
        n.ang = ang;
        n.hx = Math.cos(ang) * R * EX;
        n.hy = Math.sin(ang) * R * EY;
    };
    let narrowRun = 0;
    const place = (n, a0, a1) => {
        let R = RING(n.depth);
        if (n.depth === 1) {
            if (a1 - a0 < .42) {
                if (narrowRun++ % 2) R += 62;
            } else narrowRun = 0;
        }
        put(n, (a0 + a1) / 2, R);
        const items = itemsOf(n), sh = split(items, a1 - a0);
        let cur = a0, mi = 0;
        items.forEach((q, i) => {
            const b0 = cur, b1 = cur + sh[i];
            cur = b1;
            if (q.type === "project") return place(q, b0, b1);
            put(q, (b0 + b1) / 2, RING(n.depth + 1) + (q.minor && mi++ % 2 ? MINOR_STAGGER : 0));
        });
    };
    const a00 = a;
    const all = () => {
        a = a00;
        narrowRun = 0;
        TOP.forEach((n, i) => {
            const span = share[i] / tot * Math.PI * 2;
            place(n, a, a + span);
            a += span;
        });
    };
    EX = EY = 1;
    all();
    for (let pass = 0; pass < 4; pass++) {
        let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9;
        nodes.forEach(n => {
            if (isOverlay(n) || n.minor || n.hx == null) return;
            const hw = Math.max(n.r, (n.lw || 0) / 2);
            x0 = Math.min(x0, n.hx - hw);
            x1 = Math.max(x1, n.hx + hw);
            y0 = Math.min(y0, n.hy - n.r);
            y1 = Math.max(y1, n.hy + n.r + fontPx(n) * 1.4);
        });
        const want = A.w / A.h / Math.max(.2, (x1 - x0) / Math.max(1, y1 - y0));
        EX = Math.min(1.6, Math.max(.4, EX * Math.sqrt(want)));
        EY = 1 / EX;
        all();
    }
    nodes.forEach(n => {
        if (isOverlay(n)) return;
        if (n.hx == null) {
            n.hx = n.x;
            n.hy = n.y;
        }
    });
}

let hoverGroup = null, hoverGroupT = 0;

const groupOf = n => !n ? null : n.minor ? n.up : n.type === "project" ? n.id : n.type === "child" ? n.up : null;

function unfolded() {
    const E = new Set, now = performance.now();
    E.all = !STILL && cam.k > fitK * 1.6;
    if (hoverNode && !isOverlay(hoverNode)) {
        hoverGroup = groupOf(hoverNode);
        hoverGroupT = now;
    }
    if (hoverGroup && now - hoverGroupT < 700) E.add(hoverGroup);
    if (panelNode && byId[panelNode.id] === panelNode) E.add(groupOf(panelNode));
    if (LEAFMAP && byId[LEAF]) E.add(groupOf(byId[LEAF]));
    SEARCH.hits.forEach(n => {
        if (byId[n.id] === n) E.add(groupOf(n));
    });
    return E;
}

const showLabel = n => isOverlay(n) || !!n.lab;

let measureCtx = null;

function measure(n) {
    measureCtx ||= document.createElement("canvas").getContext("2d");
    measureCtx.font = fontOf(n);
    return measureCtx.measureText(n.label || "").width;
}

function tierOf(n, home) {
    if (n.type === "hub") return 0;
    if (n.type === "project" && n.status === "dormant" && (STILL || isMobile())) return 4;
    if (n.type === "project") return n.sub ? 2 : 1;
    if (n.kind === "code" && n.depth === 1 && n.up && String(n.id) === "code-" + n.up) return 2;
    if (n.status === "needs-you" || n.status === "working" || n.pin || n.live) return 3;
    if (!home && !STILL && (agentsAt()[n.id] || []).length) return 3;
    return n.minor ? 5 : 4;
}

function labRect(n, pos, x, y) {
    const R0 = n.r + (LEAFMAP && n.id === LEAF ? 9 : 0);
    const w = n.lw || (n.label || "").length * 6, h = fontPx(n) * 1.18, g = n.type === "hub" ? 8 : 5;
    if (pos === "b") return {
        pos: pos,
        al: "center",
        l: x - w / 2,
        r: x + w / 2,
        t: y + R0 + g,
        b: y + R0 + g + h,
        tx: x
    };
    if (pos === "a") {
        const t = y - R0 - g - h - (n.type === "project" ? 5 : 2);
        return {
            pos: pos,
            al: "center",
            l: x - w / 2,
            r: x + w / 2,
            t: t,
            b: t + h,
            tx: x
        };
    }
    if (pos === "R") return {
        pos: pos,
        al: "left",
        l: x + R0 + g,
        r: x + R0 + g + w,
        t: y - h / 2,
        b: y + h / 2,
        tx: x + R0 + g
    };
    return {
        pos: pos,
        al: "right",
        l: x - R0 - g - w,
        r: x - R0 - g,
        t: y - h / 2,
        b: y + h / 2,
        tx: x - R0 - g
    };
}

const hit = (a, b) => a.l < b.r && b.l < a.r && a.t < b.b && b.t < a.b;

function sidesOf(n, x, y) {
    if (n.type === "hub" || n.type === "project") return [ "b", "a", x >= 0 ? "R" : "L", x >= 0 ? "L" : "R" ];
    const c = Math.cos(n.ang || 0), s = Math.sin(n.ang || 0), out = c >= 0 ? "R" : "L", inn = c >= 0 ? "L" : "R";
    if (Math.abs(c) > .42) return [ out, s >= 0 ? "b" : "a", s >= 0 ? "a" : "b", inn ];
    return s >= 0 ? [ "b", out, inn, "a" ] : [ "a", out, inn, "b" ];
}

function capWidth(n) {
    const on = agentsAt()[n.id] || [], a = on[0];
    let w = 0;
    if (a && !PUBLIC) w = Math.min(CAPMAX, `${a.label}${a.now ? " · " + a.now : ""}`.length + (on.length > 1 ? 4 : 0)) * 6.1;
    if (n.live && DATA.location && DATA.location.place) w = Math.max(w, (16 + DATA.location.place.split(",")[0].length) * 5.2);
    return w;
}

function capLines(n) {
    let k = 0;
    if (!PUBLIC && (agentsAt()[n.id] || []).length && !(STILL && n.type === "child")) k++;
    if (n.live && DATA.location && DATA.location.fresh && !STILL) k++;
    return k;
}

function placeLabels(forced, home) {
    const z = home ? 1 : cam.k / (fitK || 1);
    const pos = n => home ? [ n.hx, n.hy ] : [ n.x, n.y ];
    const vis = nodes.filter(n => !isOverlay(n) && (home ? !n.minor : vaOf(n) > .5));
    const obst = [];
    vis.forEach(n => {
        const [x, y] = pos(n), m = n.r + 2;
        obst.push({
            l: x - m,
            r: x + m,
            t: y - m,
            b: y + m,
            id: n.id
        });
        if (!home && n.sat) obst.push({
            ...n.sat,
            id: n.id
        });
    });
    if (!home) nodes.forEach(n => {
        if (isOverlay(n)) {
            const w = (n.label || "").length * 3;
            obst.push({
                l: n.x - Math.max(n.r, w),
                r: n.x + Math.max(n.r, w),
                t: n.y - n.r,
                b: n.y + n.r + 18,
                id: n.id
            });
        }
    });
    const want = vis.map(n => {
        let t = tierOf(n, home);
        if (STILL && t >= 4) t = 99; else if (t === 4 && z < 1.3 && isMobile() && !ROOT) t = 99; else if (t === 5 && z < 1.6) t = 99;
        if (forced && forced.has(n.id)) t = forced.get(n.id);
        return [ t, n ];
    }).filter(([t]) => t < 99).sort((a, b) => a[0] - b[0] || b[1].r - a[1].r);
    const placed = [], out = new Map;
    const area = (a, b) => Math.max(0, Math.min(a.r, b.r) - Math.max(a.l, b.l)) * Math.max(0, Math.min(a.b, b.b) - Math.max(a.t, b.t));
    for (const [t, n] of want) {
        const [x, y] = pos(n), caps = home ? 0 : capLines(n), cw = caps ? capWidth(n) : 0;
        const rect = side => {
            const R = labRect(n, side, x, y);
            if (!caps) return R;
            if (side === "b") {
                R.cap = {
                    l: Math.min(R.l, x - cw / 2),
                    r: Math.max(R.r, x + cw / 2),
                    t: R.b,
                    b: R.b + caps * 13
                };
            } else R.cap = {
                l: x - cw / 2,
                r: x + cw / 2,
                t: y + n.r + 5,
                b: y + n.r + 5 + caps * 13
            };
            return R;
        };
        const sides = sidesOf(n, x, y);
        if (caps) sides.sort((a, b) => (a === "b" ? -1 : 0) - (b === "b" ? -1 : 0));
        let best = null, bestA = 1e12;
        for (const side of sides) {
            const R = rect(side), parts = R.cap ? [ R, R.cap ] : [ R ];
            const A = parts.reduce((s, Q) => s + placed.reduce((u, p) => u + 2 * area(p, Q), 0) + obst.reduce((u, o) => u + (o.id !== n.id ? area(o, Q) : 0), 0), 0);
            if (A < bestA) {
                best = R;
                bestA = A;
            }
            if (!A) break;
        }
        if (bestA > 0 && !(t <= 3)) best = null;
        if (best) {
            placed.push(best);
            if (best.cap) placed.push(best.cap);
            out.set(n, best);
        }
    }
    return out;
}

async function loadData() {
    if (CLOUD) await Promise.race([ macKnown, new Promise(r => setTimeout(r, 3e3)) ]);
    try {
        const d = await (CLOUD ? fetchLive() : fetchMapData());
        if (d) DATA = d;
    } catch {}
    await Promise.race([ fetchHere(), new Promise(r => setTimeout(r, 1500)) ]);
    if (!PUBLIC) {
        if (window.nsPulse && !CLOUD) nsPulse([ "location" ], () => fetchHere(), {
            minGapMs: 15e3,
            fallbackMs: 6e4
        }); else setInterval(fetchHere, 6e4);
    }
    if (DATA.cloud) tick(`<b>north-star</b> · from the Mac ${ago(DATA.cloud.pushedAt)}`);
    buildGraph(DATA);
    renderChrome();
    window.nsReady = true;
    window.nsMapData = () => DATA;
}

function bendOf(l) {
    const mx = (l.s.x + l.t.x) / 2, my = (l.s.y + l.t.y) / 2, len = Math.hypot(l.t.x - l.s.x, l.t.y - l.s.y), m = Math.hypot(mx, my);
    if (m < 1) return [ mx - (l.t.y - l.s.y) * .2, my + (l.t.x - l.s.x) * .2 ];
    return [ mx + mx / m * len * .22, my + my / m * len * .22 ];
}

window.nsLayout = () => {
    const on = n => isOverlay(n) || vaOf(n) > .5;
    return {
        nodes: nodes.filter(on),
        links: links.filter(l => on(l.s) && on(l.t)),
        cam: cam,
        W: W,
        H: H,
        DPR: DPR,
        details: DETAILS,
        fontOf: fontOf,
        fontPx: fontPx,
        showLabel: showLabel,
        bend: bendOf,
        ready: !!window.nsReady
    };
};

const canvas = document.getElementById("map");

const ctx = canvas.getContext("2d");

let W = 0, H = 0, DPR = 1;

let cam = {
    x: 0,
    y: 0,
    k: 1
};

let hoverNode = null, dragNode = null, panning = false, moved = false;

let saver = false;

const isMobile = () => W < 700;

function setGravity() {
    if (!nodes.length) return;
    nodes.forEach(n => {
        if (!isOverlay(n)) n.lw = measure(n);
    });
    layoutHomes();
}

function avail() {
    if (MINI) return {
        top: 10,
        bot: 10,
        side: 8,
        rx: 0,
        w: Math.max(50, W - 16),
        h: Math.max(50, H - 20)
    };
    if (WALL) {
        const cr = document.getElementById("nsCrumbs");
        const top = cr && !cr.hidden ? cr.getBoundingClientRect().bottom + 10 : 16, bot = 130;
        return {
            top: top,
            bot: bot,
            side: 16,
            rx: 0,
            w: Math.max(50, W - 32),
            h: Math.max(50, H - top - bot)
        };
    }
    const bar = document.getElementById("topbar"), tk = document.getElementById("ticker");
    const clock = document.querySelector(".saver-clock .sub"), cap = document.getElementById("stillCap");
    let top = saver ? (clock ? clock.getBoundingClientRect().bottom : 90) + 16 : (bar ? bar.offsetHeight : 60) + 8;
    let bot = saver ? 24 : (tk ? tk.offsetHeight : 34) + 52;
    let side = isMobile() ? 6 : 16;
    const crumbs = document.getElementById("nsCrumbs");
    if (!saver && !STILL && crumbs && !crumbs.hidden) {
        top = Math.max(top, crumbs.getBoundingClientRect().bottom + 10);
        bot = 20;
    }
    const lc = document.getElementById("leafCap");
    if (LEAFMAP && lc && !lc.hidden && !saver && !STILL) bot = Math.max(bot, lc.offsetHeight + 28);
    let rx = 0;
    if (DOC && !saver && !STILL) {
        if (isMobile()) bot = Math.round(H * .58) + 12; else rx = Math.round(W / 2);
    }
    if (STILL) {
        top = H * .27;
        side = 8;
        const ct = cap && cap.offsetHeight ? cap.getBoundingClientRect().top : H * .72;
        bot = H - ct + 8;
    }
    return {
        top: top,
        bot: bot,
        side: side,
        rx: rx,
        w: Math.max(50, W - side * 2 - rx),
        h: Math.max(50, H - top - bot)
    };
}

function resize() {
    DPR = window.devicePixelRatio || 1;
    W = window.innerWidth;
    H = window.innerHeight;
    canvas.width = W * DPR;
    canvas.height = H * DPR;
    canvas.style.width = W + "px";
    canvas.style.height = H + "px";
    setGravity();
    fitAll();
}

window.addEventListener("resize", resize);

let BORN = null;

const unborn = n => {
    if (!BORN || n.type === "hub" || isOverlay(n)) return false;
    for (let k = n, i = 0; k && k.type !== "hub" && i < 8; k = byId[k.up], i++) {
        const c = BORN.created[k.id];
        if (c && c > BORN.day) return true;
    }
    return false;
};

window.nsBorn = (created, day) => {
    BORN = day ? {
        created: created || {},
        day: day
    } : null;
};

window.nsLight = ids => {
    const s = new Set(ids || []);
    SEARCH.q = "";
    SEARCH.hits = Object.values(FULL.e).filter(e => s.has(e.id)).map(e => byId[e.id] || e);
};

function step() {
    const E = unfolded(), AT = agentsAt();
    for (const n of nodes) {
        if (isOverlay(n)) continue;
        const nb = unborn(n);
        n.vt = !nb && (!n.minor || E.all || E.has(n.up) || !STILL && (AT[n.id] || []).length) ? 1 : 0;
        const up = n.minor || nb ? byId[n.up] : null;
        const tx = n.vt || !up ? n.hx : up.x, ty = n.vt || !up ? n.hy : up.y;
        if (n !== dragNode) {
            n.x += (tx - n.x) * .2;
            n.y += (ty - n.y) * .2;
            if (Math.abs(tx - n.x) < .05) n.x = tx;
            if (Math.abs(ty - n.y) < .05) n.y = ty;
        }
        n.va += (n.vt - n.va) * .2;
        if (Math.abs(n.vt - n.va) < .01) n.va = n.vt;
    }
    const OV = nodes.filter(isOverlay);
    if (!OV.length) return;
    for (const a of OV) {
        for (const b of nodes) {
            if (a === b || vaOf(b) < .5) continue;
            let dx = a.x - b.x, dy = a.y - b.y, d2 = dx * dx + dy * dy;
            if (d2 < 1) {
                dx = .7;
                dy = .7;
                d2 = 1;
            }
            const d = Math.sqrt(d2), f = (isOverlay(b) ? 900 : 1600) / d2;
            a.vx += dx / d * f;
            a.vy += dy / d * f;
        }
    }
    links.forEach(l => {
        if (!l.overlay) return;
        const rest = l.rest || 110, dx = l.t.x - l.s.x, dy = l.t.y - l.s.y, d = Math.max(1, Math.hypot(dx, dy)), f = (d - rest) * .02;
        if (isOverlay(l.s)) {
            l.s.vx += dx / d * f;
            l.s.vy += dy / d * f;
        }
        if (isOverlay(l.t)) {
            l.t.vx -= dx / d * f;
            l.t.vy -= dy / d * f;
        }
    });
    OV.forEach(n => {
        n.vx -= n.x * 8e-4;
        n.vy -= n.y * 8e-4;
        if (n === dragNode) {
            n.vx = 0;
            n.vy = 0;
            return;
        }
        n.vx *= .82;
        n.vy *= .82;
        n.x += n.vx;
        n.y += n.vy;
    });
}

function fitAll() {
    if (!nodes.length) return;
    let minX = 1e9, maxX = -1e9, minY = 1e9, maxY = -1e9;
    const grow = (l, r, t, b) => {
        minX = Math.min(minX, l);
        maxX = Math.max(maxX, r);
        minY = Math.min(minY, t);
        maxY = Math.max(maxY, b);
    };
    nodes.forEach(n => {
        if (isOverlay(n) || n.minor) return;
        const m = n.r + 9;
        grow(n.hx - m, n.hx + m, n.hy - m, n.hy + m);
    });
    for (const R of placeLabels(null, true).values()) grow(R.l, R.r, R.t, R.b);
    nodes.forEach(n => {
        if (!isOverlay(n)) return;
        const w = Math.max(n.r, (n.label || "").length * 3.1);
        grow(n.x - w, n.x + w, n.y - n.r, n.y + n.r + 16);
    });
    const A = avail();
    const kx = A.w / (maxX - minX), ky = A.h / (maxY - minY);
    cam.k = Math.min(kx, ky, ROOT ? 1.5 : 2.4);
    fitK = cam.k;
    cam.x = -(minX + maxX) / 2 * cam.k - (A.rx || 0) / 2;
    cam.y = -(minY + maxY) / 2 * cam.k + (A.top - A.bot) / 2;
}

const STILL = new URLSearchParams(location.search).get("still") === "1";

const css = v => getComputedStyle(document.documentElement).getPropertyValue(v).trim();

let t0 = performance.now();

function drawStar(cx, cy, spikes, outerR, innerR) {
    let rot = Math.PI / 2 * 3, x = cx, y = cy;
    const stepA = Math.PI / spikes;
    ctx.beginPath();
    ctx.moveTo(cx, cy - outerR);
    for (let i = 0; i < spikes; i++) {
        x = cx + Math.cos(rot) * outerR;
        y = cy + Math.sin(rot) * outerR;
        ctx.lineTo(x, y);
        rot += stepA;
        x = cx + Math.cos(rot) * innerR;
        y = cy + Math.sin(rot) * innerR;
        ctx.lineTo(x, y);
        rot += stepA;
    }
    ctx.lineTo(cx, cy - outerR);
    ctx.closePath();
}

const CALM = STILL || window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches;

function blueprint(n, t, a) {
    const r = n.r, big = n.type === "project";
    ctx.save();
    ctx.globalAlpha = a;
    ctx.fillStyle = "#FFF";
    ctx.beginPath();
    ctx.arc(n.x, n.y, r, 0, 7);
    ctx.fill();
    ctx.clip();
    const g = big ? 4.2 : 3.4;
    ctx.strokeStyle = "#000";
    ctx.lineWidth = .6;
    ctx.globalAlpha = a * .26;
    ctx.beginPath();
    for (let d = -r; d <= r; d += g) {
        ctx.moveTo(n.x + d, n.y - r);
        ctx.lineTo(n.x + d, n.y + r);
        ctx.moveTo(n.x - r, n.y + d);
        ctx.lineTo(n.x + r, n.y + d);
    }
    ctx.stroke();
    ctx.globalAlpha = a * .55;
    ctx.lineWidth = .8;
    ctx.beginPath();
    ctx.moveTo(n.x - r, n.y);
    ctx.lineTo(n.x + r, n.y);
    ctx.moveTo(n.x, n.y - r);
    ctx.lineTo(n.x, n.y + r);
    ctx.stroke();
    if (!CALM) {
        const ph = ((t * .14 + (n.x + n.y) * .0013) % 1 + 1) % 1, cx = n.x - r * 2 + ph * r * 4;
        const gr = ctx.createLinearGradient(cx - r * .7, n.y - r, cx + r * .7, n.y + r);
        gr.addColorStop(0, "rgba(255,255,255,0)");
        gr.addColorStop(.5, "rgba(255,255,255,0.85)");
        gr.addColorStop(1, "rgba(255,255,255,0)");
        ctx.globalAlpha = a;
        ctx.fillStyle = gr;
        ctx.fillRect(n.x - r, n.y - r, r * 2, r * 2);
    }
    ctx.restore();
    ctx.save();
    ctx.globalAlpha = a;
    ctx.strokeStyle = "#000";
    ctx.setLineDash([]);
    ctx.lineWidth = big ? 1.3 : 1.1;
    ctx.beginPath();
    ctx.arc(n.x, n.y, r, 0, 7);
    ctx.stroke();
    ctx.lineWidth = .8;
    ctx.beginPath();
    ctx.arc(n.x, n.y, r + (big ? 3.4 : 2.8), 0, 7);
    ctx.stroke();
    ctx.restore();
}

const WAIT_C = "#B7791F";

function queueGlyph(n, a) {
    ctx.save();
    ctx.globalAlpha = a;
    ctx.strokeStyle = "rgba(0,0,0,.28)";
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.arc(n.x, n.y, n.r + 4, 0, 7);
    ctx.stroke();
    const s = n.type === "project" ? 1.2 : n.minor ? .75 : 1, cx = n.x + n.r * .72, cy = n.y - n.r * .72, g = 3.4 * s;
    ctx.fillStyle = "#FFF";
    ctx.beginPath();
    ctx.arc(cx, cy, 6.2 * s, 0, 7);
    ctx.fill();
    ctx.fillStyle = "#000";
    for (const k of [ -1, 0, 1 ]) {
        ctx.beginPath();
        ctx.arc(cx + k * g, cy, 1.25 * s, 0, 7);
        ctx.fill();
    }
    ctx.restore();
}

function waitGlyph(n, a) {
    ctx.save();
    ctx.globalAlpha = a;
    ctx.setLineDash([ 3, 3 ]);
    ctx.strokeStyle = WAIT_C;
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.arc(n.x, n.y, n.r + 4, 0, 7);
    ctx.stroke();
    ctx.setLineDash([]);
    const s = n.type === "project" ? 1.2 : n.minor ? .75 : 1, w = 7 * s, h = 9 * s, cx = n.x + n.r * .72, cy = n.y - n.r * .72;
    ctx.fillStyle = "#FFF";
    ctx.beginPath();
    ctx.arc(cx, cy, h * .72, 0, 7);
    ctx.fill();
    ctx.fillStyle = WAIT_C;
    ctx.beginPath();
    ctx.moveTo(cx - w / 2, cy - h / 2);
    ctx.lineTo(cx + w / 2, cy - h / 2);
    ctx.lineTo(cx + w * .08, cy);
    ctx.lineTo(cx + w / 2, cy + h / 2);
    ctx.lineTo(cx - w / 2, cy + h / 2);
    ctx.lineTo(cx - w * .08, cy);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
}

function planGlyph(n) {
    const s = n.type === "project" ? 1.25 : n.minor ? .8 : 1, w = 8 * s, h = 10 * s, f = 3 * s;
    const x = n.x + n.r * .72 - w / 2, y = n.y - n.r * .72 - h / 2;
    ctx.save();
    ctx.setLineDash([]);
    ctx.lineJoin = "round";
    ctx.fillStyle = "#FFF";
    ctx.strokeStyle = "#000";
    ctx.lineWidth = 1.1;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + w - f, y);
    ctx.lineTo(x + w, y + f);
    ctx.lineTo(x + w, y + h);
    ctx.lineTo(x, y + h);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(x + w - f, y);
    ctx.lineTo(x + w - f, y + f);
    ctx.lineTo(x + w, y + f);
    ctx.stroke();
    ctx.lineWidth = .8;
    ctx.beginPath();
    for (let i = 0; i < 3; i++) {
        const ly = y + h * (.45 + i * .18);
        ctx.moveTo(x + 1.8 * s, ly);
        ctx.lineTo(x + w - (i === 2 ? 3.4 : 1.8) * s, ly);
    }
    ctx.stroke();
    ctx.restore();
}

function doneGlyph(n) {
    const s = n.type === "project" ? 1.2 : n.minor ? .75 : 1, cx = n.x + n.r * .72, cy = n.y - n.r * .72, h = 4.6 * s;
    ctx.save();
    ctx.globalAlpha = Math.min(1, ctx.globalAlpha * 2.2);
    ctx.setLineDash([]);
    ctx.fillStyle = "#FFF";
    ctx.beginPath();
    ctx.arc(cx, cy, h * 1.25, 0, 7);
    ctx.fill();
    ctx.strokeStyle = DONE_C;
    ctx.lineWidth = 1.5 * s;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.beginPath();
    ctx.moveTo(cx - h * .8, cy + h * .05);
    ctx.lineTo(cx - h * .2, cy + h * .62);
    ctx.lineTo(cx + h * .85, cy - h * .6);
    ctx.stroke();
    ctx.restore();
}

function labelText(n, color) {
    const L = n.lab;
    if (!L) return;
    ctx.font = fontOf(n);
    ctx.textAlign = L.al;
    ctx.textBaseline = "top";
    ctx.strokeStyle = "rgba(255,255,255,0.9)";
    ctx.lineWidth = 3;
    ctx.lineJoin = "round";
    ctx.strokeText(n.label, n.x + L.dx, n.y + L.dy);
    ctx.fillStyle = color;
    ctx.fillText(n.label, n.x + L.dx, n.y + L.dy);
    const w = ctx.measureText(n.label).width;
    if (Math.abs(w - (n.lw || 0)) > .5) n.lw = w;
}

function satellites(n) {
    const all = n.kids ? n.kids.filter(k => k.minor && vaOf(k) < .5) : [];
    if (!all.length) {
        n.sat = null;
        return;
    }
    const folded = all.filter(k => !k.doneOld), old = all.length - folded.length;
    const side = (n.hx || 0) >= 0 ? 1 : -1, c0 = side > 0 ? .3 : Math.PI - .3, R = n.r + 5.5, shown = Math.min(folded.length, 6);
    const tx = n.x + side * (R + 5), ty = n.y + Math.sin(.3) * R;
    ctx.font = "500 9px JetBrains Mono, monospace";
    ctx.textBaseline = "middle";
    ctx.textAlign = side > 0 ? "left" : "right";
    if (folded.length) {
        const red = folded.some(k => k.status === "needs-you"), wait = !red && folded.some(k => k.status === "waiting");
        ctx.fillStyle = red ? css("--red") || "#D32F2F" : wait ? WAIT_C : "#8C8C8C";
        for (let i = 0; i < shown; i++) {
            const a = c0 + side * (i - (shown - 1) / 2) * .34;
            ctx.beginPath();
            ctx.arc(n.x + Math.cos(a) * R, n.y + Math.sin(a) * R, 1.9, 0, 7);
            ctx.fill();
        }
        ctx.fillStyle = "#8C8C8C";
        ctx.fillText(String(folded.length), tx, ty);
    }
    if (old) {
        const dy = folded.length ? ty + 12 : ty, cx = tx + side * 3.5;
        ctx.save();
        ctx.strokeStyle = DONE_C;
        ctx.lineWidth = 1.2;
        ctx.lineCap = "round";
        ctx.lineJoin = "round";
        ctx.beginPath();
        ctx.moveTo(cx - 3, dy);
        ctx.lineTo(cx - 1, dy + 2.2);
        ctx.lineTo(cx + 3.2, dy - 2.6);
        ctx.stroke();
        ctx.restore();
        ctx.fillStyle = DONE_C;
        ctx.fillText(`${all.every(k => !k.doneOld || k.merged) ? "merged" : "done"} · ${old}`, tx + side * 10, dy);
    }
    const w = old ? 64 : 14;
    n.sat = {
        l: side > 0 ? n.x + n.r : tx - w,
        r: side > 0 ? tx + w : n.x - n.r,
        t: n.y - 4,
        b: n.y + R + 4 + (old && folded.length ? 12 : 0)
    };
}

function draw() {
    const t = (performance.now() - t0) / 1e3;
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    ctx.clearRect(0, 0, W, H);
    ctx.translate(W / 2 + cam.x, H / 2 + cam.y);
    ctx.scale(cam.k, cam.k);
    const focus = hoverNode || LEAFMAP && byId[LEAF] || (panelNode && byId[panelNode.id] === panelNode ? panelNode : null);
    const HITS = SEARCH.hits.filter(n => byId[n.id] === n);
    const searchOn = !hoverNode && HITS.length > 0;
    const lit = hoverNode ? [ hoverNode ] : searchOn ? HITS : focus ? [ focus ] : [];
    const near = new Set;
    lit.forEach(f => {
        near.add(f.id);
        links.forEach(l => {
            if (l.s === f) near.add(l.t.id);
            if (l.t === f) near.add(l.s.id);
        });
    });
    const dimOn = !!hoverNode || searchOn;
    links.forEach(l => {
        const a = Math.min(vaOf(l.s), vaOf(l.t));
        if (a < .02) return;
        const dim = dimOn && !(near.has(l.s.id) && near.has(l.t.id));
        const lt = l.faint && near.has(l.s.id) && near.has(l.t.id) && !!(focus || searchOn);
        ctx.globalAlpha = a;
        ctx.strokeStyle = dim ? "#F0F0F0" : l.overlay ? "#8A8A8A" : l.vision ? "#9A9A9A" : l.faint ? lt ? "#9A9A9A" : "#ECECEC" : l.cross ? "#CFCFCF" : "#DADADA";
        ctx.lineWidth = l.s.type === "hub" ? 1.6 : l.vision ? 1.3 : l.faint ? 1 : 1.1;
        ctx.setLineDash(l.dash || (l.vision ? [ 6, 5 ] : l.faint ? [ 1.5, 4 ] : l.cross ? [ 4, 5 ] : []));
        ctx.beginPath();
        ctx.moveTo(l.s.x, l.s.y);
        if ((l.cross || l.vision || l.faint) && !l.overlay) {
            const [cx, cy] = bendOf(l);
            ctx.quadraticCurveTo(cx, cy, l.t.x, l.t.y);
        } else ctx.lineTo(l.t.x, l.t.y);
        ctx.stroke();
        ctx.setLineDash([]);
    });
    ctx.globalAlpha = 1;
    const LIVEAT = PUBLIC ? {} : agentsAt();
    [ ...nodes.filter(n => !LIVEAT[n.id]), ...nodes.filter(n => LIVEAT[n.id]) ].forEach(n => {
        const va = vaOf(n);
        if (va < .02) return;
        const dim = dimOn && !near.has(n.id);
        ctx.globalAlpha = (dim ? .22 : 1) * va;
        if (n.type === "hub") {
            ctx.fillStyle = "#000";
            ctx.beginPath();
            ctx.arc(n.x, n.y, n.r, 0, 7);
            ctx.fill();
            ctx.fillStyle = "#FFF";
            if (window.NSStar) NSStar.fill(ctx, n.x, n.y, n.r * 1.56); else {
                drawStar(n.x, n.y, 5, n.r * .52, n.r * .22);
                ctx.fill();
            }
        } else if (n.type === "intent" || n.type === "agent") {
            if (n.type === "intent" && /^(done|dismissed|closed)$/.test(n.status || "")) return;
            window.drawOverlayNode(ctx, n, t, dim);
        } else if (n.type === "project" || n.owned) {
            if (n.status === "working" && n.activity === "research") {
                ctx.save();
                ctx.strokeStyle = "#000";
                ctx.lineWidth = 1.4;
                ctx.setLineDash([ 2, 3.5 ]);
                ctx.lineDashOffset = -t * 12;
                ctx.beginPath();
                ctx.arc(n.x, n.y, n.r + 5, 0, 7);
                ctx.stroke();
                ctx.restore();
            } else if (n.status === "working") {
                const p = (Math.sin(t * 2.4 + n.x) + 1) / 2;
                ctx.strokeStyle = `rgba(0,0,0,${.25 * (1 - p)})`;
                ctx.lineWidth = 2;
                ctx.beginPath();
                ctx.arc(n.x, n.y, n.r + 4 + p * 7, 0, 7);
                ctx.stroke();
            }
            const dormant = n.status === "dormant";
            const plan = n.stage === "plan" && !dormant;
            const planned = !plan && (n.planned || n.status === "planned");
            const done = !!n.done && !dormant;
            const a0 = (dim ? .22 : 1) * va;
            ctx.globalAlpha = a0 * (dormant ? .32 : done ? .42 : 1);
            const agentOn = !!LIVEAT[n.id] && !dormant;
            ctx.fillStyle = agentOn ? "#000" : "#FFF";
            ctx.strokeStyle = dormant ? "#BBB" : planned || done ? "#9A9A9A" : "#000";
            ctx.lineWidth = n.type === "project" ? n.sub ? 2 : 2.4 : n.minor ? 1.3 : 1.6;
            if (planned) ctx.lineWidth = n.type === "project" ? 1.7 : 1.3;
            if (plan && !agentOn) blueprint(n, t, a0); else {
                ctx.beginPath();
                ctx.arc(n.x, n.y, n.r, 0, 7);
                ctx.fill();
                ctx.stroke();
            }
            if (n.find) {
                ctx.fillStyle = "#555";
                ctx.font = `700 ${Math.round(n.r * 1.15)}px Inter, sans-serif`;
                ctx.textAlign = "center";
                ctx.textBaseline = "middle";
                ctx.fillText("?", n.x, n.y + .5);
            }
            if (n.kind === "ptype") {
                ctx.fillStyle = "#000";
                for (let k = 0; k < 3; k++) {
                    const a = k * 2.094 - Math.PI / 2 + t * .25;
                    ctx.beginPath();
                    ctx.arc(n.x + Math.cos(a) * n.r * .45, n.y + Math.sin(a) * n.r * .45, 1.5, 0, 7);
                    ctx.fill();
                }
            }
            if (n.kind === "code") {
                const u = n.r * .5;
                ctx.strokeStyle = "#000";
                ctx.lineWidth = 1.1;
                ctx.beginPath();
                ctx.moveTo(n.x - u, n.y);
                ctx.lineTo(n.x - u * .1, n.y);
                ctx.moveTo(n.x - u * .1, n.y - u * .8);
                ctx.lineTo(n.x - u * .1, n.y + u * .8);
                ctx.moveTo(n.x - u * .1, n.y - u * .8);
                ctx.lineTo(n.x + u, n.y - u * .8);
                ctx.moveTo(n.x - u * .1, n.y + u * .8);
                ctx.lineTo(n.x + u, n.y + u * .8);
                ctx.stroke();
            }
            if (n.live && DATA.location && DATA.location.fresh) youAreHere(n, t);
            if (done && n.status !== "working") doneGlyph(n); else if (plan && ![ "working", "needs-you", "waiting" ].includes(n.status)) planGlyph(n); else if (n.status === "waiting" && !dormant) waitGlyph(n, a0); else if (n.status === "queued" && !dormant) queueGlyph(n, a0); else if (n.status && !dormant) {
                const dc = n.status === "working" ? "#000" : n.status === "needs-you" ? css("--red") || "#D32F2F" : n.status === "done" ? "#999" : "#CCC";
                const dr = n.type === "project" ? 5.2 : n.minor ? 3.2 : 4;
                ctx.fillStyle = dc;
                ctx.beginPath();
                ctx.arc(n.x + n.r * .72, n.y - n.r * .72, dr, 0, 7);
                ctx.fill();
                ctx.strokeStyle = "#FFF";
                ctx.lineWidth = 1.6;
                ctx.stroke();
            }
            const owe = n.type === "project" && window.PEOPLE_OWED && window.PEOPLE_OWED[n.id];
            if (owe) {
                const bx = n.x - n.r * .95, by = n.y - n.r * .95, br = 9.5;
                ctx.fillStyle = css("--red") || "#D32F2F";
                ctx.beginPath();
                ctx.arc(bx, by, br, 0, 7);
                ctx.fill();
                ctx.fillStyle = "#FFF";
                ctx.font = "700 11px Inter, sans-serif";
                ctx.textAlign = "center";
                ctx.textBaseline = "middle";
                ctx.fillText(String(owe), bx, by + .5);
            }
        } else {
            if (n.done) ctx.globalAlpha *= .45;
            ctx.fillStyle = LIVEAT[n.id] ? "#000" : dim ? "#E5E5E5" : "#999";
            ctx.beginPath();
            ctx.arc(n.x, n.y, n.r, 0, 7);
            ctx.fill();
            if (n.done && !n.minor) doneGlyph(n);
        }
        if (n.type !== "intent" && n.type !== "agent") {
            ctx.globalAlpha = (dim ? .22 : 1) * va;
            satellites(n);
        }
        ctx.globalAlpha = 1;
    });
    drawFlashes();
    const lf = LEAFMAP && byId[LEAF];
    if (lf && vaOf(lf) > .3) {
        ctx.save();
        ctx.setLineDash([]);
        ctx.strokeStyle = "#000";
        ctx.lineWidth = 2.2;
        ctx.beginPath();
        ctx.arc(lf.x, lf.y, lf.r + 7, 0, 7);
        ctx.stroke();
        if (!CALM) {
            const p = t * .7 % 1;
            ctx.globalAlpha = .35 * (1 - p);
            ctx.lineWidth = 1.4;
            ctx.beginPath();
            ctx.arc(lf.x, lf.y, lf.r + 7 + p * 14, 0, 7);
            ctx.stroke();
        }
        ctx.globalAlpha = 1;
        ctx.fillStyle = "#000";
        ctx.beginPath();
        ctx.arc(lf.x, lf.y, Math.max(3, lf.r * .45), 0, 7);
        ctx.fill();
        ctx.restore();
    }
    const pick0 = SEARCH.hits[SEARCH.sel];
    if (pick0 && byId[pick0.id] === pick0 && !hoverNode && vaOf(pick0) > .3) {
        ctx.save();
        ctx.strokeStyle = "#000";
        ctx.lineWidth = 1.6 / Math.max(.6, cam.k);
        ctx.setLineDash([]);
        ctx.beginPath();
        ctx.arc(pick0.x, pick0.y, pick0.r + 9, 0, 7);
        ctx.stroke();
        ctx.restore();
    }
    const forced = new Map;
    if (dimOn || focus) near.forEach(id => forced.set(id, -1));
    lit.forEach(f => forced.set(f.id, -2));
    if (!dimOn && focus) {
        forced.clear();
        forced.set(focus.id, -2);
    }
    const L = placeLabels(forced, false);
    nodes.forEach(n => {
        if (isOverlay(n)) return;
        const R = L.get(n);
        n.lab = R ? {
            dx: R.tx - n.x,
            dy: R.t - n.y,
            al: R.al,
            pos: R.pos
        } : null;
    });
    nodes.forEach(n => {
        if (isOverlay(n)) return;
        const va = vaOf(n);
        if (va < .02) return;
        const dim = dimOn && !near.has(n.id);
        if (n.lab) {
            const dormant = n.status === "dormant", plan = n.stage === "plan" && !dormant, planned = !plan && (n.planned || n.status === "planned");
            const box = n.type === "project" || n.owned;
            ctx.globalAlpha = (dim ? .22 : 1) * va * (box ? dormant ? .32 : n.done ? .75 : 1 : n.done ? .75 : 1);
            const col = n.type === "hub" ? dim ? "#CCC" : "#000" : n.done && !dim ? "#9A9A9A" : box ? dim || dormant ? "#BBB" : planned ? "#8A8A8A" : plan ? "#2A2A2A" : "#000" : dim ? "#DDD" : "#666";
            labelText(n, col);
            ctx.globalAlpha = 1;
        }
        if (!dim && va > .5) agentCaption(n, t);
        if (!dim && va > .5) herMark(n, t);
    });
}

const underY = n => n.lab && n.lab.pos === "b" ? n.y + n.lab.dy + fontPx(n) * 1.18 + 1 : n.y + n.r + 6;

let AT = {}, atSig = "", atT = 0;

function agentsAt() {
    if (performance.now() - atT < 400) return AT;
    atT = performance.now();
    if (PUBLIC) {
        const at = DATA.activity && DATA.activity.at || {}, sig = JSON.stringify(at) + Object.keys(byId).length;
        if (sig === atSig) return AT;
        atSig = sig;
        AT = {};
        for (const [id, n] of Object.entries(at)) {
            const k = FULL.e[id] ? id : FULL.hub;
            if (k) (AT[k] ||= []).push(...Array.from({
                length: n
            }, (_, i) => ({
                id: "agent" + i,
                label: "agent"
            })));
        }
        return AT;
    }
    const w = LIVE.workers || [], sig = w.map(x => x.id + x.now).join("|") + Object.keys(byId).length;
    if (sig === atSig) return AT;
    atSig = sig;
    AT = {};
    for (const x of w) {
        let id = (DATA.workerAt || {})[x.id] || x.project || null;
        if (id && !FULL.e[id] && id.startsWith("r:")) id = null;
        if (!id && x.kind === "routine" && FULL.e["r:" + x.id]) id = "r:" + x.id;
        if (!id || !FULL.e[id]) id = FULL.e["ns-talk"] ? "ns-talk" : FULL.hub;
        (AT[id] ||= []).push(x);
    }
    return AT;
}

setInterval(() => {
    atSig = "";
    atT = 0;
}, 1e3);

window.agentsOn = id => agentsAt()[id] || [];

const CAPMAX = 44;

const herOn = id => PUBLIC ? !!(DATA.activity && DATA.activity.her || {})[id] : (DATA.herAt || []).includes(id);

window.herOn = herOn;

function herMark(n, t) {
    if (!herOn(n.id) || STILL && n.type === "child") return;
    const R = n.r + 12 + Math.sin(t * 1.6) * 1.5;
    ctx.save();
    ctx.strokeStyle = "#000";
    ctx.lineWidth = 2.4;
    ctx.globalAlpha = .55 + .35 * Math.sin(t * 1.6);
    ctx.beginPath();
    ctx.arc(n.x, n.y, R, 0, 7);
    ctx.stroke();
    ctx.globalAlpha = 1;
    ctx.font = "600 10px JetBrains Mono, monospace";
    ctx.textAlign = "center";
    ctx.textBaseline = "bottom";
    const y = n.y - R - 4;
    ctx.strokeStyle = "rgba(255,255,255,0.92)";
    ctx.lineWidth = 3;
    ctx.lineJoin = "round";
    ctx.strokeText("SUSANNA", n.x, y);
    ctx.fillStyle = "#000";
    ctx.fillText("SUSANNA", n.x, y);
    ctx.restore();
}

function agentCaption(n, t) {
    const on = agentsAt()[n.id];
    if (!on || !on.length) return;
    if (STILL && n.type === "child") return;
    const R = n.r + 7;
    ctx.save();
    ctx.strokeStyle = "#000";
    ctx.lineWidth = 2.4;
    ctx.beginPath();
    ctx.arc(n.x, n.y, R, t * 2.2, t * 2.2 + 1.4);
    ctx.stroke();
    ctx.lineWidth = 1.2;
    ctx.strokeStyle = "rgba(0,0,0,0.4)";
    ctx.beginPath();
    ctx.arc(n.x, n.y, R, 0, 7);
    ctx.stroke();
    if (PUBLIC) {
        ctx.restore();
        return;
    }
    const a = on[0], txt = `${a.label}${a.now ? " · " + a.now : ""}${on.length > 1 ? `  +${on.length - 1}` : ""}`;
    const cut = txt.length > CAPMAX ? txt.slice(0, CAPMAX - 1) + "…" : txt;
    ctx.font = "500 10px JetBrains Mono, monospace";
    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    const y = underY(n);
    ctx.strokeStyle = "rgba(255,255,255,0.92)";
    ctx.lineWidth = 3;
    ctx.lineJoin = "round";
    ctx.strokeText(cut, n.x, y);
    ctx.fillStyle = "#000";
    ctx.fillText(cut, n.x, y);
    ctx.restore();
}

function youAreHere(n, t) {
    ctx.save();
    for (let k = 0; k < 2; k++) {
        const p = (t * .6 + k * .5) % 1;
        ctx.strokeStyle = `rgba(0,0,0,${.35 * (1 - p)})`;
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.arc(n.x, n.y, n.r + 3 + p * 16, 0, 7);
        ctx.stroke();
    }
    ctx.fillStyle = "#000";
    ctx.beginPath();
    ctx.arc(n.x, n.y, 3, 0, 7);
    ctx.fill();
    const place = DATA.location.place;
    if (place && !STILL) {
        const txt = "you are here · " + place.split(",")[0];
        ctx.font = "italic 500 10px Inter, sans-serif";
        ctx.textAlign = "center";
        ctx.textBaseline = "top";
        const y = underY(n);
        ctx.strokeStyle = "rgba(255,255,255,0.92)";
        ctx.lineWidth = 3;
        ctx.strokeText(txt, n.x, y);
        ctx.fillStyle = "#333";
        ctx.fillText(txt, n.x, y);
    }
    ctx.restore();
}

let userCam = 0;

function loop(t) {
    requestAnimationFrame(loop);
    const idle = !dragNode && Date.now() - lastActive > 2e4;
    if (idle && t - lastFrame < 125) return;
    lastFrame = t || 0;
    step();
    if (!dragNode && Date.now() - userCam > 6e4 && ++fitTick % 30 === 0) fitAll();
    draw();
}

let fitTick = 0, lastFrame = -1e9;

function toWorld(px, py) {
    return {
        x: (px - W / 2 - cam.x) / cam.k,
        y: (py - H / 2 - cam.y) / cam.k
    };
}

function pick(px, py, skip) {
    const p = toWorld(px, py);
    let best = null, bd = 1e9;
    nodes.forEach(n => {
        if (n === skip || vaOf(n) < .5) return;
        const d = Math.hypot(n.x - p.x, n.y - p.y);
        const hit = n.r + (WALL ? 30 : n.type === "child" ? 12 : 8) / cam.k;
        if (d < hit && d < bd) {
            best = n;
            bd = d;
        }
    });
    return best;
}

function pointer(e) {
    const r = canvas.getBoundingClientRect();
    const s = e.touches ? e.touches[0] : e;
    return {
        x: s.clientX - r.left,
        y: s.clientY - r.top
    };
}

let lastP = null, downP = null;

const KMIN = .25, kMax = () => Math.max(2.5, fitK * 4);

function zoomAt(px, py, k) {
    const w = toWorld(px, py);
    cam.k = Math.min(kMax(), Math.max(KMIN, k));
    cam.x = px - W / 2 - w.x * cam.k;
    cam.y = py - H / 2 - w.y * cam.k;
    userCam = Date.now();
}

const PTRS = new Map;

let pinch = null;

const gap2 = () => {
    const [a, b] = [ ...PTRS.values() ];
    return {
        d: Math.max(1, Math.hypot(a.x - b.x, a.y - b.y)),
        x: (a.x + b.x) / 2,
        y: (a.y + b.y) / 2
    };
};

canvas.addEventListener("pointerdown", e => {
    const p = pointer(e);
    PTRS.set(e.pointerId, p);
    canvas.setPointerCapture(e.pointerId);
    if (PTRS.size === 2) {
        const g = gap2();
        pinch = {
            d: g.d,
            k: cam.k,
            x: g.x,
            y: g.y
        };
        dragNode = null;
        panning = false;
        moved = true;
        return;
    }
    moved = false;
    downP = p;
    const n = pick(p.x, p.y);
    if (n) {
        dragNode = n;
    } else {
        panning = true;
    }
    canvas.classList.add("dragging");
    lastP = p;
});

canvas.addEventListener("pointermove", e => {
    const p = pointer(e);
    if (PTRS.has(e.pointerId)) PTRS.set(e.pointerId, p);
    if (pinch && PTRS.size >= 2) {
        const g = gap2();
        cam.x += g.x - pinch.x;
        cam.y += g.y - pinch.y;
        pinch.x = g.x;
        pinch.y = g.y;
        zoomAt(g.x, g.y, pinch.k * g.d / pinch.d);
        return;
    }
    const far = downP && Math.hypot(p.x - downP.x, p.y - downP.y) > 4;
    if (dragNode) {
        if (far || moved) {
            const w = toWorld(p.x, p.y);
            dragNode.x = w.x;
            dragNode.y = w.y;
            moved = true;
        }
        if (WALL && moved) hoverNode = pick(p.x, p.y, dragNode);
    } else if (panning) {
        if (far || moved) {
            cam.x += p.x - lastP.x;
            cam.y += p.y - lastP.y;
            moved = true;
            userCam = Date.now();
        }
    } else if (!WALL) {
        const n = pick(p.x, p.y);
        hoverNode = n;
        canvas.style.cursor = n ? "pointer" : "grab";
    }
    if (moved || !downP || far) lastP = p;
});

function pointerEnd(e) {
    PTRS.delete(e.pointerId);
    if (pinch) {
        if (PTRS.size < 2) pinch = null;
        if (!PTRS.size) {
            dragNode = null;
            panning = false;
            canvas.classList.remove("dragging");
        }
        return;
    }
    canvas.classList.remove("dragging");
    if (e.type === "pointercancel") {
        dragNode = null;
        panning = false;
        downP = null;
        return;
    }
    if (saver) {
        exitSaver();
        dragNode = null;
        panning = false;
        return;
    }
    if (dragNode && !moved) {
        clearSearch();
        clickDot(dragNode);
    } else if (WALL && dragNode && moved && lastP) {
        const t = pick(lastP.x, lastP.y, dragNode);
        hoverNode = null;
        if (t) window.dispatchEvent(new CustomEvent("ns-drop", {
            detail: {
                from: dragNode.id,
                to: t.id,
                fromLabel: dragNode.label,
                toLabel: t.label
            }
        }));
    } else if (panning && !moved) {
        setDrawer(false);
        if (LEAFMAP) closeLeaf();
    }
    dragNode = null;
    panning = false;
    downP = null;
}

canvas.addEventListener("pointerup", pointerEnd);

canvas.addEventListener("pointercancel", pointerEnd);

canvas.addEventListener("pointerleave", e => {
    if (e.pointerType === "mouse" && !dragNode) hoverNode = null;
});

canvas.addEventListener("wheel", e => {
    if (MINI && !e.ctrlKey) return;
    e.preventDefault();
    const p = pointer(e), f = e.ctrlKey ? Math.exp(-e.deltaY * .01) : e.deltaY < 0 ? 1.1 : .9;
    zoomAt(p.x, p.y, cam.k * f);
}, {
    passive: false
});

const SEARCH = {
    q: "",
    hits: [],
    sel: 0,
    all: 0
};

const searchEl = document.getElementById("nsSearch"), hitsEl = document.getElementById("nsHits"), countEl = document.getElementById("nsCount");

const plainLow = x => String(x == null ? "" : x).replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").toLowerCase();

const wordsOf = x => x.split(/[^a-z0-9À-￿]+/).filter(Boolean);

function pathOf(n) {
    const out = [];
    let id = n.id, d = 0;
    while (id && FULL.e[id] && d < 8) {
        const e = FULL.e[id];
        if (e.type === "hub" && out.length) break;
        out.unshift(e.label);
        id = e.up;
        d++;
    }
    return out.length ? out : [ n.label ];
}

function textOf(n) {
    const d = FULL.e[n.id] && FULL.e[n.id].det || DETAILS[n.id] || {};
    return plainLow([ d.why, d.statusLine, d.caption ].filter(Boolean).join(" · "));
}

function scoreToken(n, tok) {
    const L = plainLow(n.label), id = String(n.id).toLowerCase(), T = textOf(n);
    if (L === tok) return 120;
    if (L.startsWith(tok)) return 100;
    if (wordsOf(L).some(w => w.startsWith(tok))) return 85;
    if (L.includes(tok)) return 70;
    if (wordsOf(id).some(w => w.startsWith(tok))) return 55;
    if (id.includes(tok)) return 45;
    if (wordsOf(T).some(w => w.startsWith(tok))) return 30;
    if (T.includes(tok)) return 20;
    return 0;
}

function runSearch(q) {
    SEARCH.q = q;
    SEARCH.sel = 0;
    const toks = plainLow(q).trim().split(/\s+/).filter(Boolean);
    if (!toks.length) {
        SEARCH.hits = [];
        SEARCH.all = 0;
        return renderHits();
    }
    const typeRank = n => n.type === "hub" ? 0 : n.type === "project" ? n.sub ? 2 : 1 : n.minor ? 4 : 3;
    const scored = [];
    for (const e of Object.values(FULL.e)) {
        const n = byId[e.id] || e;
        let s = 0, ok = true;
        for (const t of toks) {
            const v = scoreToken(n, t);
            if (!v) {
                ok = false;
                break;
            }
            s += v;
        }
        if (ok) scored.push([ s, n ]);
    }
    scored.sort((a, b) => b[0] - a[0] || typeRank(a[1]) - typeRank(b[1]) || String(a[1].label).localeCompare(String(b[1].label)));
    SEARCH.all = scored.length;
    SEARCH.hits = scored.slice(0, 40).map(x => x[1]);
    renderHits();
}

const SVG_PLAN = `<svg width="9" height="10" viewBox="0 0 9 10" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1" stroke-linejoin="round"><path d="M.5.5h5.5l2.5 2.5v6.5h-8z"/><path d="M6 .5v2.5h2.5M2 5.2h5M2 7.2h3.4" stroke-width=".8"/></svg>`;

window.NS_SVG_PLAN = SVG_PLAN;

const SVG_DOT = c => `<svg width="8" height="8" viewBox="0 0 8 8" aria-hidden="true"><circle cx="4" cy="4" r="3.2" ${c}/></svg>`;

function renderHits() {
    const H = SEARCH.hits, on = SEARCH.q.trim().length > 0;
    countEl.hidden = !on;
    countEl.textContent = String(SEARCH.all);
    searchEl.setAttribute("aria-expanded", on && document.activeElement === searchEl ? "true" : "false");
    if (!on || document.activeElement !== searchEl) {
        hitsEl.hidden = true;
        hitsEl.innerHTML = "";
        return;
    }
    const toks = plainLow(SEARCH.q).trim().split(/\s+/).filter(Boolean);
    hitsEl.innerHTML = H.length ? H.slice(0, 12).map((n, i) => {
        const path = pathOf(n), last = path.pop();
        const st = n.status === "needs-you" && !PUBLIC ? 'fill="var(--red)"' : n.status === "working" ? 'fill="currentColor"' : n.status === "waiting" ? 'fill="#B7791F"' : n.status === "queued" ? 'fill="none" stroke="currentColor" stroke-dasharray="1.5 2"' : n.stage === "plan" ? null : n.planned || n.status === "planned" ? 'fill="none" stroke="#9A9A9A"' : 'fill="none" stroke="currentColor"';
        let why = "";
        if (!toks.every(t => plainLow(n.label).includes(t) || String(n.id).toLowerCase().includes(t))) {
            const T = textOf(n), at = T.indexOf(toks.find(t => T.includes(t)) || "");
            if (at >= 0) why = (at > 24 ? "…" : "") + T.slice(Math.max(0, at - 24), at + 60).trim() + "…";
        }
        return `<div class="hit${i === SEARCH.sel ? " on" : ""}" role="option" aria-selected="${i === SEARCH.sel}" data-i="${i}" data-id="${esc(n.id)}">\n      <span class="hit-dot"${st ? "" : ' title="plan made, not acted on"'}>${st ? SVG_DOT(st) : SVG_PLAN}</span><span class="hit-txt"><span class="hit-path">${path.map(x => esc(x) + " <i>›</i> ").join("")}<b>${esc(last)}</b></span>${why ? `<span class="hit-why">${esc(why)}</span>` : ""}</span></div>`;
    }).join("") + (SEARCH.all > 12 ? `<div class="hit-more">${SEARCH.all - 12} more — keep typing</div>` : "") : `<div class="hit-none">nothing on the map called that</div>`;
    hitsEl.hidden = false;
    const cur = hitsEl.querySelector(".hit.on");
    if (cur && cur.scrollIntoView) cur.scrollIntoView({
        block: "nearest"
    });
}

function clearSearch(blur) {
    if (!searchEl) return;
    searchEl.value = "";
    runSearch("");
    if (blur) searchEl.blur();
}

function openHit(i) {
    const n = SEARCH.hits[i == null ? SEARCH.sel : i];
    if (!n) return;
    clearSearch(true);
    openDot(n.id);
}

window.nsSearch = q => {
    searchEl.value = q;
    runSearch(q);
    return SEARCH.hits.map(n => n.id);
};

if (searchEl) {
    searchEl.addEventListener("input", () => runSearch(searchEl.value));
    searchEl.addEventListener("focus", () => {
        if (saver) exitSaver();
        renderHits();
    });
    searchEl.addEventListener("blur", () => setTimeout(renderHits, 150));
    searchEl.addEventListener("keydown", e => {
        const n = Math.min(SEARCH.hits.length, 12);
        if (e.key === "ArrowDown" || e.key === "ArrowUp") {
            e.preventDefault();
            if (!n) return;
            SEARCH.sel = (SEARCH.sel + (e.key === "ArrowDown" ? 1 : -1) + n) % n;
            renderHits();
        } else if (e.key === "Enter") {
            e.preventDefault();
            openHit();
        } else if (e.key === "Escape") {
            e.preventDefault();
            e.stopPropagation();
            clearSearch(true);
        }
    });
    hitsEl.addEventListener("pointerdown", e => {
        const h = e.target.closest(".hit");
        if (!h) return;
        e.preventDefault();
        openHit(+h.dataset.i);
    });
    hitsEl.addEventListener("pointermove", e => {
        const h = e.target.closest(".hit");
        if (h && +h.dataset.i !== SEARCH.sel) {
            SEARCH.sel = +h.dataset.i;
            hitsEl.querySelectorAll(".hit").forEach(x => x.classList.toggle("on", x === h));
        }
    });
    document.addEventListener("keydown", e => {
        if (e.key !== "/" || e.metaKey || e.ctrlKey || e.altKey) return;
        if (e.target.closest && e.target.closest('input,textarea,[contenteditable="true"]')) return;
        e.preventDefault();
        searchEl.focus();
        searchEl.select();
    });
}

const panel = document.getElementById("panel");

const pTitle = document.getElementById("pTitle"), pStatus = document.getElementById("pStatus"), pBody = document.getElementById("pBody");

let panelNode = null;

let panelTab = null;

const hasFlow = t => t.id.startsWith("r:") || !!(DETAILS[t.id] && DETAILS[t.id].hasFlow);

const PW = {
    pw: [ 400, 300 ],
    pww: [ 820, 420 ]
};

const store = {
    get: k => {
        try {
            return localStorage.getItem(k);
        } catch {
            return null;
        }
    },
    set: (k, v) => {
        try {
            localStorage.setItem(k, v);
        } catch {}
    }
};

function applyPW() {
    for (const [k, [def]] of Object.entries(PW)) document.documentElement.style.setProperty("--" + k, (+store.get("ns." + k) || def) + "px");
    syncPanelW();
}

function syncPanelW() {
    const open = panel.classList.contains("open");
    const w = open ? panel.getBoundingClientRect().width + (panel.classList.contains("mini") ? 32 : 0) : 0;
    const mini = panel.classList.contains("mini");
    document.documentElement.style.setProperty("--toph", document.getElementById("topbar").getBoundingClientRect().height + "px");
    document.documentElement.style.setProperty("--pnow", "0px");
    const pbtn = document.getElementById("panelBtn");
    if (pbtn) pbtn.setAttribute("aria-pressed", open ? "true" : "false");
    document.documentElement.style.setProperty("--pcard", "0px");
    document.documentElement.style.setProperty("--minih", (open && panel.classList.contains("mini") ? panel.getBoundingClientRect().height : 34) + "px");
}

function openPanel(n, tab) {
    if (!n) return;
    if (n.type === "intent" || n.type === "agent") {
        panelNode = n;
        panel.classList.remove("wide", "mini");
        setDrawer(true);
        document.getElementById("pTabs").style.display = "none";
        syncPanelW();
        return window.renderOverlayPanel(n);
    }
    if (!tab) return clickDot(n);
    if (tab === "fold") return setDrawer(false);
    const target = n.type === "child" && !n.owned && byId[n.parent] ? byId[n.parent] : n;
    document.getElementById("pTabs").style.display = PUBLIC ? "none" : "";
    panelTab = tab;
    if (panelTab === "skill" && !target.id.startsWith("r:")) panelTab = "status";
    if (panelTab === "flow" && !hasFlow(target)) panelTab = "status";
    panelNode = target;
    const d = DETAILS[target.id];
    if (!d) return;
    pTitle.textContent = target.label;
    pStatus.innerHTML = `<span class="dot ${target.status || ""}"></span><span>${target.status === "queued" && d.queuedLine ? esc(d.queuedLine) + (d.statusLine ? " · " + d.statusLine : "") : d.statusLine || "—"}</span>`;
    document.querySelectorAll("#pTabs .tab").forEach(b => {
        b.classList.toggle("on", b.dataset.tab === panelTab);
        b.disabled = b.dataset.tab === "flow" && !hasFlow(target) || b.dataset.tab === "skill" && !target.id.startsWith("r:");
    });
    panel.classList.remove("mini");
    panel.classList.toggle("wide", panelTab === "flow" || panelTab === "skill");
    setDrawer(true);
    requestAnimationFrame(syncPanelW);
    setTimeout(syncPanelW, 340);
    if (panelTab !== "status") {
        window.renderFlowPanel(target, panelTab);
        return;
    }
    let html = "";
    if (d.asks && d.asks.length) html += `<div class="card"><h4>Needs you — ${d.asks.length} question${d.asks.length > 1 ? "s" : ""}</h4><ul>${d.asks.map(a => `<li class="hot"><b>${esc(a.title)}</b></li>`).join("")}</ul>\n      <div class="ask" style="cursor:pointer" onclick="openInbox('${target.id}')"><svg class="ico" viewBox="0 0 16 16" aria-hidden="true"><path d="M2.5 3.5h11v7h-6l-3 2.5v-2.5h-2z"/></svg> Answer in the inbox</div></div>`;
    if (d.why) html += `<div class="card why"><h4>Why</h4><p>${d.why}</p></div>`;
    if (d.ideas && d.ideas.length) html += `<div class="card"><h4>From Talk</h4><ul>${d.ideas.map(x => `<li><b>${esc(new Date(x.at).toLocaleDateString("en-US", {
        month: "numeric",
        day: "numeric"
    }))}</b> ${esc(x.text)}</li>`).join("")}</ul></div>`;
    if (d.refs && d.refs.length) html += `<div class="card"><h4>Read</h4><ul>${d.refs.map(r => `<li><a href="${esc(macUrl(r.href))}" target="_blank" rel="noopener">${esc(r.label)}</a></li>`).join("")}</ul></div>`; else if (d.portfolio && d.portfolio.onPortfolio === false && target.id !== "portfolio") html += `<div class="card"><h4>Portfolio</h4><p>Not on the portfolio yet${d.portfolio.note ? ` — ${esc(d.portfolio.note)}` : ""}.</p></div>`;
    if (d.yesterday && d.yesterday.length) html += `<div class="card"><h4>${d.kind === "routine" ? "Runs today" : d.kind === "convo" ? "Last said" : "Yesterday"}</h4><ul>${d.yesterday.map(x => `<li>${x}</li>`).join("")}</ul></div>`;
    if (d.today && d.today.length || d.ask) html += `<div class="card"><h4>Today's goal</h4><ul>${(d.today || []).map(x => `<li class="${/you/i.test(x) ? "hot" : ""}">${x}</li>`).join("")}</ul>\n      ${d.ask ? `<div class="ask"><svg class="ico" viewBox="0 0 16 16" aria-hidden="true"><path d="M2.5 3.5h11v7h-6l-3 2.5v-2.5h-2z"/></svg> ${d.ask}</div>` : ""}</div>`;
    if (d.blocked && d.blocked.length) html += `<div class="card"><h4>Blocked — and why</h4><ul>${d.blocked.map(x => `<li class="hot">${x}</li>`).join("")}</ul></div>`;
    if (d.run) {
        const r = d.run, dur = r.endedAt ? Math.round((r.endedAt - r.startedAt) / 6e4) + " min" : "running";
        const when = new Date(r.startedAt).toLocaleString("en-US", {
            weekday: "short",
            hour: "numeric",
            minute: "2-digit"
        });
        const counts = Object.entries(r.counts || {}).map(([k, v]) => `<span class="chip"><b>${v}</b>&nbsp;${k}</span>`).join(" ");
        html += `<div class="card"><h4>Last run</h4><ul>\n      <li><b>${r.status}</b> · ${when} · ${dur} · ${r.toolUses} tool calls${r.model ? " · " + r.model.replace("claude-", "") : ""}</li>\n      ${counts ? `<li>${counts}</li>` : ""}\n      ${r.note ? `<li>${r.note}</li>` : ""}\n      ${r.summary ? `<li style="white-space:pre-wrap">${r.summary.replace(/</g, "&lt;")}</li>` : ""}\n    </ul></div>`;
    }
    if (d.links && d.links.length) html += `<div class="card"><h4>Touches</h4><ul>${d.links.map(l => `<li><b onclick="jumpTo('${l}')" style="cursor:pointer">${byId[l] && byId[l].label || l}</b></li>`).join("")}</ul></div>`;
    if (ROOT && target.id === ROOT && hasVisual(d)) html += `<div class="panel-actions"><button class="topbtn primary" onclick="nsOpenVisual()">${d.embed ? "Open the plan" : "Open its pictures"}</button></div>`;
    const folder = d.folder || target.parent && DETAILS[target.parent] && DETAILS[target.parent].folder;
    if (target.id !== FULL.hub && (folder || d.resume)) {
        html += `<div class="panel-actions">\n      ${folder ? `<button class="topbtn" onclick="location.href='http://localhost:4000/#folder=${folder}'">Open in Dev Hub</button>` : ""}\n      ${d.resume ? `<button class="topbtn primary" onclick="resumeConvo('${d.resume.cliSessionId}','${d.resume.cwd}')">Resume in Terminal</button>` : ""}\n    </div>`;
    }
    pBody.innerHTML = html;
}

const esc = x => String(x == null ? "" : x).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

document.querySelectorAll("#pTabs .tab").forEach(b => b.onclick = () => {
    if (panelNode && !b.disabled) openPanel(panelNode, b.dataset.tab);
});

function closePanel() {
    setDrawer(false);
    panel.classList.remove("wide", "mini");
    panelTab = null;
    closeLeaf();
    panelNode = null;
}

function setDrawer(on) {
    if (on && DOC) docPane(false);
    panel.classList.toggle("open", !!on);
    if (!on) panel.classList.remove("wide");
    syncPanelW();
}

function toggleDrawer(n) {
    if (panel.classList.contains("open") && panelNode && panelNode.id === n.id) return setDrawer(false);
    openPanel(n, hasFlow(n) ? "flow" : "status");
}

window.nsEscape = () => {
    if (CODE) return codePane(null);
    if (DOC) return docPane(false);
    if (panel.classList.contains("open")) return setDrawer(false);
    if (LEAF) return closeLeaf();
    if (ROOT) return setRoot(null);
};

document.getElementById("pFold").onclick = () => {
    if (panelNode) openPanel(panelNode, "fold");
};

(function() {
    const grip = document.getElementById("pGrip");
    let drag = null;
    grip.addEventListener("pointerdown", e => {
        e.preventDefault();
        grip.setPointerCapture(e.pointerId);
        drag = panel.classList.contains("wide") ? "pww" : "pw";
        panel.classList.add("dragging");
    });
    grip.addEventListener("pointermove", e => {
        if (!drag) return;
        const right = panel.classList.contains("mini") ? 16 : 0;
        const w = Math.round(Math.max(PW[drag][1], Math.min(innerWidth - 240, innerWidth - right - e.clientX)));
        document.documentElement.style.setProperty("--" + drag, w + "px");
        store.set("ns." + drag, w);
        syncPanelW();
    });
    const end = () => {
        if (!drag) return;
        drag = null;
        panel.classList.remove("dragging");
        syncPanelW();
        if (window.redrawFocus) window.redrawFocus();
    };
    grip.addEventListener("pointerup", end);
    grip.addEventListener("pointercancel", end);
    grip.addEventListener("dblclick", () => {
        const k = panel.classList.contains("wide") ? "pww" : "pw";
        store.set("ns." + k, "");
        applyPW();
    });
    addEventListener("resize", syncPanelW);
    applyPW();
})();

async function resumeConvo(id, cwd) {
    tick(`<b>north-star</b> · opening Terminal: claude --resume ${id.slice(0, 8)}…`);
    try {
        const r = await api("/api/resume", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                cliSessionId: id,
                cwd: cwd
            })
        });
        const j = await r.json();
        tick(j.ok ? `<b>north-star</b> · resumed in Terminal` : `<b>north-star</b> · could not resume: ${j.error}`);
    } catch (e) {
        tick(`<b>north-star</b> · could not resume: ${e.message}`);
    }
}

document.getElementById("pClose").onclick = () => setDrawer(false);

{
    const f = document.getElementById("docFab"), c = document.getElementById("docClose");
    if (f) f.onclick = () => window.nsOpenVisual();
    if (c) c.onclick = () => docPane(false);
}

{
    const pb = document.getElementById("panelBtn");
    if (pb) pb.onclick = () => {
        if (panel.classList.contains("open")) return setDrawer(false);
        const t = LEAF && byId[LEAF] || nodes[0];
        if (t) openPanel(t, hasFlow(t) ? "flow" : "status");
    };
}

async function sendMsg() {
    const inp = document.getElementById("pInput");
    const v = inp.value.trim();
    if (!v) return;
    if (panelNode && (panelNode.type === "intent" || panelNode.type === "agent")) {
        inp.value = "";
        return window.replyIntent(panelNode, v);
    }
    const project = panelNode ? panelNode.parent || panelNode.id : "northstar";
    window.sendIntent(v, project);
    try {
        const r = await api("/api/inbox/note", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                project: project,
                text: v
            })
        });
        const j = await r.json();
        tick(r.ok ? `<b>${project}</b> · saved as ${j.id} — the next ${project} run reads it` : `<b>${project}</b> · not saved: ${esc(j.error)}`);
        if (r.ok) inp.value = "";
    } catch (e) {
        tick(`<b>${project}</b> · not saved: ${esc(e.message)}`);
    }
}

document.getElementById("pSend").onclick = sendMsg;

document.getElementById("pInput").addEventListener("keydown", e => {
    if (e.key === "Enter") sendMsg();
});

const overlay = document.getElementById("overlay");

function openSync() {
    const d = new Date;
    document.getElementById("syncSub").textContent = d.toLocaleDateString("en-US", {
        weekday: "long",
        month: "short",
        day: "numeric"
    }) + ` · ${situationLine()}`;
    document.getElementById("syncBody").innerHTML = (DATA.sync || []).map(([id, txt], i) => `<div class="sync-item"><div class="n">${i + 1}</div><p onclick="jumpTo('${id}')">${txt}</p></div>`).join("");
    overlay.classList.add("open");
}

window.jumpTo = id => {
    overlay.classList.remove("open");
    openDot(id);
};

document.getElementById("syncBtn").onclick = openSync;

overlay.addEventListener("click", e => {
    if (e.target === overlay) overlay.classList.remove("open");
});

const tickerEl = document.getElementById("ticker");

let tickI = 0;

function tick(html) {
    tickerEl.innerHTML = html;
}

function ago(t) {
    const m = Math.round((Date.now() - new Date(t)) / 6e4);
    return m < 1 ? "just now" : m < 90 ? `${m} min ago` : `${Math.round(m / 60)} h ago — is the Mac asleep?`;
}

setInterval(() => {
    const T = DATA.ticker || [];
    if (!saver && T.length) tick(T[tickI++ % T.length]);
}, 5e3);

let HEALTH = {}, LIVE = {
    working: null,
    workers: []
};

function workerNames(workers, n) {
    const w = workers || [];
    if (!w.length) return "";
    return w.slice(0, n).map(x => x.label).filter(Boolean).join(" · ") + (w.length > n ? ` +${w.length - n}` : "");
}

async function renderChrome() {
    if (PUBLIC) return renderPublicChrome();
    try {
        const r = await api("/api/health", {
            cache: "no-store"
        });
        if (r.ok) HEALTH = await r.json();
    } catch {}
    const h = {
        ...DATA.health || {},
        ...HEALTH
    };
    const workers = h.workers || [];
    const working = h.agentsWorking ?? (DATA.projects || []).filter(p => p.status === "working").length;
    const names = workerNames(workers.filter(x => !x.company), 2);
    setAgentsInd(working, names, true);
    setUdInd(h.udMini);
    LIVE = {
        working: working,
        workers: workers,
        udMini: h.udMini || null
    };
    if (panelNode && panelNode.id === "__situation" && panel.classList.contains("open")) openSituationPanel();
    if (panelNode && panelNode.id === "__agents" && panel.classList.contains("open")) openAgentsPanel();
    if ((DATA.ticker || []).length) tick(DATA.ticker[0]);
    const b = document.getElementById("inboxBadge");
    const n = DATA.inboxOpen || 0;
    b.textContent = n;
    b.hidden = !n;
    const mb = document.getElementById("moreBadge");
    if (mb) {
        mb.hidden = !n;
        mb.title = n ? `${n} in the inbox` : "";
    }
    const mbtn = document.getElementById("moreBtn");
    if (mbtn) mbtn.setAttribute("aria-label", n ? `Menu, ${n} in the inbox` : "Menu");
}

function setAgentsInd(n, names, clickable, queued) {
    const box = document.getElementById("healthChips");
    if (!box) return;
    const sig = n + "|" + (names || "") + "|" + (clickable ? 1 : 0) + "|" + (queued || "");
    if (box.dataset.sig === sig) return;
    box.dataset.sig = sig;
    box.querySelectorAll(".agents-ind:not(.presence-ind):not(.ud-ind)").forEach(el => el.remove());
    if (!n && !queued) return;
    const el = document.createElement(clickable ? "button" : "div");
    el.className = "agents-ind";
    el.id = "agentsChip";
    const label = `${n} agent${n === 1 ? "" : "s"} working` + (queued ? ` · ${queued}` : "");
    el.title = clickable ? names ? `${label}: ${names} -- see which agent is doing what` : `${label} -- see which agent is doing what` : label;
    el.setAttribute("aria-label", clickable ? `${label}, show them` : label);
    el.innerHTML = `<span class="pulse" aria-hidden="true"></span><b>${n}</b><span class="lbl">${names ? "working" : `agent${n === 1 ? "" : "s"} working`}${queued ? ` · ${esc(queued)}` : ""}</span>${names ? `<span class="who">${esc(names)}</span>` : ""}`;
    if (clickable) el.onclick = PUBLIC ? openPublicAgentsPanel : openAgentsPanel;
    const ud = box.querySelector(".ud-ind");
    ud ? box.insertBefore(el, ud) : box.appendChild(el);
}

const UD_ICO = '<svg class="ico" viewBox="0 0 16 16" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.3"><rect x="2.5" y="4.5" width="11" height="7" rx="1.5"/><path d="M6 13.5h4M8 11.5v2"/></svg>';

function udLine(u) {
    if (!u) return "";
    if (u.line) return u.line;
    const state = !u.up ? "not reachable" : !u.loggedIn ? "Claude signed out" : `${u.used}/${u.cap} running`;
    return [ state, u.queued ? `${u.queued} queued` : "", u.memFreePct != null && u.up ? `${u.memFreePct}% memory free` : "" ].filter(Boolean).join(" · ");
}

function setUdInd(u) {
    const box = document.getElementById("healthChips");
    if (!box || PUBLIC) return;
    const sig = u ? JSON.stringify([ u.up, u.loggedIn, u.state, u.used, u.cap, u.queued, u.stalled, u.memFreePct, (u.jobs || []).map(j => j.title + j.status).join("|") ]) : "";
    let el = box.querySelector(".ud-ind");
    if (!u) {
        if (el) el.remove();
        return;
    }
    if (el && el.dataset.sig === sig) return;
    if (!el) {
        el = document.createElement("button");
        el.className = "agents-ind ud-ind";
        el.id = "udChip";
        el.onclick = openAgentsPanel;
        box.appendChild(el);
    }
    el.dataset.sig = sig;
    const line = udLine(u), names = (u.jobs || []).filter(j => j.status === "running").map(j => j.title).join(" · ");
    el.classList.toggle("down", !u.up || !u.loggedIn);
    el.classList.toggle("stalled", u.state === "stalled");
    const word = u.state === "stalled" ? `${u.stalled} stalled` : u.state === "idle" ? "idle" : u.queued ? `${u.queued} queued` : "";
    el.title = `UD mini (company Mac mini, company Claude): ${line}${names ? " -- " + names : ""}. Separate from your agents.`;
    el.setAttribute("aria-label", `UD mini, ${line}, show`);
    el.innerHTML = `${UD_ICO}<span class="lbl">UD mini</span><b>${u.up && u.loggedIn ? `${u.used}/${u.cap}` : "off"}</b>${word ? `<span class="st${u.state === "stalled" ? " st-stalled" : ""}">${esc(word)}</span>` : ""}${names ? `<span class="who">${esc(names)}</span>` : ""}`;
}

function renderPublicChrome() {
    const a = DATA.activity || {}, n = a.working || 0, labels = (a.labels || []).join(", ");
    const wt = a.waiting ?? a.asleep ?? (window.NS_PRESENCE || {}).waiting;
    const rest = [ wt ? `${wt} waiting` : "", a.queued ? `${a.queued} queued` : "" ].filter(Boolean).join(" · ");
    LIVE = {
        working: n,
        workers: Array.from({
            length: n
        }, (_, i) => ({
            id: "agent" + i,
            label: "agent"
        }))
    };
    const pw = a.workers || [];
    setAgentsInd(n, labels, pw.length > 0 || n > 0 || !!rest, rest);
    if (panelNode && panelNode.id === "__agents" && panel.classList.contains("open")) openPublicAgentsPanel();
    DATA.ticker = [ `<b>north star</b> · ${PUBLIC_LINE}`, `<b>${n}</b> working${rest ? " · " + rest : ""} right now${labels ? " · " + esc(labels) : ""}`, ...DATA.generatedAt ? [ `<b>map</b> · rebuilt ${ago(DATA.generatedAt).replace(/ — .*$/, "")}` ] : [] ];
    const talkLine = typeof window.nsTalkLine === "function" ? window.nsTalkLine() : "";
    if (talkLine) DATA.ticker.unshift(`<b>live</b> · ${esc(talkLine)}`);
    if (a.paused) DATA.ticker.unshift(`<b>out of usage</b>${a.paused.until ? " until " + esc(a.paused.until) : ""} · most agents paused, requests wait in the queue`);
    tick(DATA.ticker[0]);
    const lg = document.getElementById("legendGap");
    if (lg) lg.hidden = true;
}

function openAgentsPanel() {
    const w = (LIVE.workers || []).filter(x => !x.company), u = LIVE.udMini;
    panelNode = {
        id: "__agents",
        parent: "northstar"
    };
    panel.classList.remove("wide", "mini");
    panel.classList.add("open");
    document.getElementById("pTabs").style.display = "none";
    syncPanelW();
    document.getElementById("pTitle").textContent = "Agents working";
    document.getElementById("pStatus").innerHTML = `<span class="dot"></span><span>${w.length ? w.length + " running" : "none running"}</span>`;
    const kind = k => ({
        task: "voice task",
        routine: "routine",
        conversation: "chat",
        session: "chat"
    }[k] || k || "agent");
    const mins = s => s == null ? "" : s < 90 ? `${Math.round(s)}s` : s < 5400 ? `${Math.round(s / 60)} min` : `${(s / 3600).toFixed(1)} h`;
    document.getElementById("pBody").innerHTML = w.length ? w.map(x => `\n    <div class="agent-row" style="cursor:pointer" onclick="jumpToWorker('${esc(x.id)}')">\n      <div class="agent-top"><b>${esc(x.label || x.id || "agent")}</b><span class="agent-kind">${esc(kind(x.kind))}${x.elapsedSeconds != null ? ` · ${mins(x.elapsedSeconds)}` : ""}</span></div>\n      <div class="agent-now">${esc(x.now || "working")}</div>\n    </div>`).join("") : '<div class="agent-empty">Nothing is running right now.</div>';
    if (u) document.getElementById("pBody").innerHTML += `<div class="ud-sec"><div class="ud-h">${UD_ICO}UD MINI · company Claude${u.plan ? ` (${esc(u.plan)})` : ""}</div>\n    <div class="agent-now">${esc(udLine(u))}${u.why ? " · " + esc(u.why) : ""}</div>\n    ${(u.jobs || []).map(j => `<div class="agent-row" style="cursor:pointer" onclick="jumpToWorker('${esc(j.id)}')">\n      <div class="agent-top"><b>${esc(j.title || j.id)}</b><span class="agent-kind">${esc(j.id)} · ${j.status === "queued" ? "queued" : esc(mins(j.elapsedSeconds)) + (j.stalled ? ` · stalled, no output ${esc(mins(j.idleSeconds))}` : "")}</span></div>\n      <div class="agent-now">${esc(j.now || "")}${j.dot ? " · " + esc(j.dot) : ""}</div></div>`).join("") || '<div class="agent-empty">Nothing running on the UD mini.</div>'}</div>`;
}

window.openAgentsPanel = openAgentsPanel;

function openPublicAgentsPanel() {
    const a = DATA.activity || {}, w = a.workers || [];
    panelNode = {
        id: "__agents",
        parent: "northstar"
    };
    panel.classList.remove("wide", "mini");
    panel.classList.add("open");
    document.getElementById("pTabs").style.display = "none";
    syncPanelW();
    document.getElementById("pTitle").textContent = "What the agents are building";
    const cnt = s => w.length ? w.filter(x => x.status === s).length : {
        working: a.working || 0,
        waiting: a.waiting || 0,
        queued: a.queued || 0
    }[s];
    document.getElementById("pStatus").innerHTML = `<span class="dot"></span><span>${[ `${cnt("working")} working`, cnt("waiting") ? `${cnt("waiting")} waiting` : "", cnt("queued") ? `${cnt("queued")} queued` : "" ].filter(Boolean).join(" · ")}</span>`;
    const PRIV = "Private project";
    const areas = new Map;
    for (const x of w) {
        const k = x.area || PRIV;
        const g = areas.get(k) || {
            titles: new Set,
            working: 0,
            waiting: 0,
            queued: 0
        };
        g.titles.add(x.title);
        g[x.status] = (g[x.status] || 0) + 1;
        areas.set(k, g);
    }
    if (!w.length) {
        const on = Object.keys(a.at || {}).filter(id => FULL.e[id] && id !== "private-work");
        for (const l of a.labels || []) areas.set(l, {
            titles: new Set,
            working: 1,
            waiting: 0,
            queued: 0,
            approx: true
        });
        for (const id of on) if (![ ...areas.keys() ].some(k => nodeFor(k) === id)) areas.set(FULL.e[id].label, {
            titles: new Set,
            working: 1,
            waiting: 0,
            queued: 0,
            approx: true
        });
        const rest = (a.working || 0) - areas.size;
        if (rest > 0) areas.set(PRIV, {
            titles: new Set,
            working: rest,
            waiting: 0,
            queued: 0
        });
    }
    const order = [ ...areas.entries() ].sort((p, q) => (p[0] === PRIV) - (q[0] === PRIV) || q[1].working - p[1].working || q[1].waiting - p[1].waiting);
    const state = g => g.approx ? "working now" : [ g.working ? `${g.working} working` : "", g.waiting ? `${g.waiting} waiting` : "", g.queued ? `${g.queued} queued` : "" ].filter(Boolean).join(" · ");
    const row = ([k, g]) => {
        const id = k === PRIV ? FULL.e["private-work"] ? "private-work" : null : nodeFor(k);
        const name = k === PRIV ? "Private projects" : id && FULL.e[id] ? FULL.e[id].label : k;
        return `<div class="agent-row"${id ? ` style="cursor:pointer" onclick="jumpTo('${esc(id)}')"` : ""}>\n      <div class="agent-top"><b>${esc(name)}</b><span class="agent-kind">${esc(state(g))}</span></div>\n      ${g.titles.size ? `<div class="agent-now">${esc([ ...g.titles ].join(", "))}</div>` : ""}</div>`;
    };
    const talk = typeof window.nsTalkLine === "function" ? window.nsTalkLine() : "";
    window.nsPresenceChanged = () => {
        try {
            renderPublicChrome();
        } catch {}
    };
    document.getElementById("pBody").innerHTML = (talk ? `<div class="agent-row agent-talk"><div class="agent-top"><b>${esc(talk)}</b></div></div>` : "") + (order.length ? order.map(row).join("") + '<div class="agent-empty" style="margin-top:14px">Tap a project to see it on the map. Kinds of work only; private projects stay private.</div>' : '<div class="agent-empty">Nothing is running right now.</div>');
}

window.jumpToWorker = wid => {
    const at = agentsAt();
    for (const [id, ws] of Object.entries(at)) if (ws.some(w => String(w.id) === wid) && FULL.e[id]) return jumpTo(id);
};

function nodeFor(project) {
    if (!project) return null;
    const k = String(project).toLowerCase();
    if (FULL.e[k]) return k;
    const hit = Object.values(FULL.e).find(n => n.label && (n.label.toLowerCase() === k || n.label.toLowerCase().replace(/ hub$| map$/, "") === k));
    return hit ? hit.id : null;
}

function situation() {
    const s = DATA.situation || {}, T = s.truth;
    const review = (s.review || []).map(r => ({
        id: r.id,
        label: "North Star public",
        text: r.text,
        review: true
    }));
    if (T) {
        const nm = (id, raw) => (id && FULL.e[id] ? FULL.e[id].label : String(raw || "")).replace(/ HUB$| MAP$/, "").toLowerCase().replace(/^./, c => c.toUpperCase());
        const needs = (T.needsYou || []).map(x => {
            const id = nodeFor(x.project);
            return {
                id: id || "inbox",
                label: nm(id, x.project),
                text: x.text,
                why: x.why
            };
        });
        const prog = (T.inProgress || []).map(x => {
            const id = nodeFor(x.project);
            return {
                id: id,
                label: nm(id, x.project),
                text: x.text
            };
        });
        return {
            verified: true,
            at: T.generatedAt,
            summary: T.summary || "",
            today: T.summary || "",
            needs: [ ...needs, ...review ],
            progress: prog
        };
    }
    let needs = s.needs;
    if (!needs) needs = (DATA.projects || []).filter(p => p.status === "needs-you").map(p => ({
        id: p.id,
        label: p.label.replace(/ HUB$/, ""),
        text: p.ask || "needs a look"
    }));
    return {
        verified: false,
        today: s.today || "",
        needs: [ ...needs, ...review ],
        progress: []
    };
}

function workingSentence() {
    const w = LIVE.workers || [], n = LIVE.working ?? w.length;
    if (!n) return "No agents running right now.";
    const names = workerNames(w, 2);
    return `${n} agent${n === 1 ? "" : "s"} working${names ? `: ${names}` : ""}.`;
}

function situationLine() {
    if (PUBLIC) return `${workingSentence().replace(/:.*$/, ".")} ${PUBLIC_LINE[0].toUpperCase() + PUBLIC_LINE.slice(1)}.`;
    const s = situation();
    return s.verified ? [ s.summary, workingSentence() ].filter(Boolean).join(" ") : [ workingSentence(), s.today, "(unverified)" ].filter(Boolean).join(" ");
}

const plainText = x => String(x == null ? "" : x).replace(/<[^>]+>/g, "");

function needsHtml(list, max) {
    const rv = list.filter(n => n.review), rest = list.filter(n => !n.review);
    list = [ ...rest.slice(0, Math.max(0, max - rv.length)), ...rv, ...rest.slice(Math.max(0, max - rv.length)) ];
    const rows = list.slice(0, max).map(n => `<li class="${n.review ? "rv" : ""}" data-id="${esc(n.id || "")}"><b>${esc(n.label)}</b> — ${esc(plainText(n.text))}</li>`);
    if (list.length > max) {
        const more = list.slice(max), names = [ ...new Set(more.map(n => n.label)) ];
        rows.push(`<li class="more">and ${more.length} more — ${names.map(esc).join(", ")}</li>`);
    }
    return rows.join("");
}

const clipTxt = (x, n) => {
    x = plainText(x);
    return x.length > n ? x.slice(0, n - 1).replace(/\s+\S*$/, "") + "…" : x;
};

function progressHtml(s, max) {
    if (!s.progress || !s.progress.length) return "";
    return `<div class="sit-prog"><span>in progress</span> ${s.progress.slice(0, max).map(p => `<b>${esc(p.label)}</b> ${esc(clipTxt(p.text, 60))}`).join(" · ")}</div>`;
}

document.addEventListener("click", e => {
    const li = e.target.closest && e.target.closest(".sit-needs li[data-id]");
    if (!li || saver) return;
    const id = li.dataset.id;
    if (FULL.e[id]) {
        e.stopPropagation();
        openDot(id);
    }
});

function openSituationPanel() {
    const s = situation();
    panelNode = {
        id: "__situation",
        parent: "northstar"
    };
    panel.classList.remove("wide", "mini");
    panel.classList.add("open");
    document.getElementById("pTabs").style.display = "none";
    syncPanelW();
    document.getElementById("pTitle").textContent = "What is going on";
    document.getElementById("pStatus").innerHTML = `<span class="dot ${LIVE.working || 0 ? "working" : ""}"></span><span>${esc(workingSentence())}</span>`;
    const go = n => n.id && n.id !== "inbox" && FULL.e[n.id] ? `onclick="jumpTo('${n.id}')"` : 'onclick="openInbox()"';
    document.getElementById("pBody").innerHTML = `\n    <div class="card why"><h4>${s.verified ? "Today · read from your messages " + esc(new Date(s.at).toLocaleTimeString("en-US", {
        hour: "numeric",
        minute: "2-digit"
    })) : "Today · unverified, derived from the hubs"}</h4><p>${esc(situationLine())}</p></div>\n    ${s.needs.length ? `<div class="card"><h4>Needs you</h4><ul>${s.needs.map(n => `<li class="hot"><b ${go(n)} style="cursor:pointer">${esc(n.label)}</b> — ${esc(plainText(n.text))}</li>`).join("")}</ul></div>` : '<div class="agent-empty">Nothing is waiting on you.</div>'}\n    ${s.progress.length ? `<div class="card"><h4>In progress</h4><ul>${s.progress.map(n => `<li><b ${n.id ? `onclick="jumpTo('${n.id}')"` : ""} style="cursor:pointer">${esc(n.label)}</b> — ${esc(plainText(n.text))}</li>`).join("")}</ul></div>` : ""}`;
}

window.openSituationPanel = openSituationPanel;

const saverBtn = document.getElementById("saverBtn");

function enterSaver() {
    saver = true;
    document.body.classList.add("saver");
    closePanel();
    overlay.classList.remove("open");
    setGravity();
    fitAll();
}

function exitSaver() {
    saver = false;
    document.body.classList.remove("saver");
    lastActive = Date.now();
    setGravity();
    fitAll();
}

saverBtn.onclick = () => saver ? exitSaver() : enterSaver();

setInterval(() => {
    const d = new Date;
    document.getElementById("saverTime").textContent = d.toLocaleTimeString("en-US", {
        hour: "numeric",
        minute: "2-digit"
    });
    if (!saver || STILL) return;
    const el = document.getElementById("saverSub"), s = situation();
    const full = `<div class="sit-line">${esc(situationLine())}</div>${s.needs.length ? `<ul class="sit-needs">${needsHtml(s.needs, isMobile() ? 8 : 4)}</ul>` : ""}${progressHtml(s, 2)}`;
    const chip = `<button class="sit-chip" id="sitMore" title="what needs you"><svg viewBox="0 0 16 16" aria-hidden="true"><path d="M2 9.5 3.6 3h8.8L14 9.5V13H2z"/><path d="M2 9.5h3.5l1 1.5h3l1-1.5H14"/></svg>${s.needs.length ? `<b>${s.needs.length}</b> need you` : "all clear"}</button>`;
    const html = PUBLIC ? `<div class="sit-line">${esc(situationLine())}</div>` : `${chip}<div class="sit-full">${full}</div><div class="sit-wake">tap to wake</div>`;
    if (el.dataset.sig !== html) {
        el.dataset.sig = html;
        const open = el.classList.contains("sit-open");
        el.innerHTML = html;
        el.classList.toggle("sit-open", open);
        fitAll();
        const m = document.getElementById("sitMore");
        if (m) m.onclick = e => {
            e.stopPropagation();
            el.classList.toggle("sit-open");
            lastActive = Date.now();
            setTimeout(fitAll, 30);
        };
    }
}, 1e3);

let lastActive = Date.now();

const poke = () => {
    lastActive = Date.now();
};

[ "pointermove", "pointerdown", "keydown", "wheel", "touchstart", "touchmove", "scroll" ].forEach(ev => window.addEventListener(ev, poke, {
    capture: true,
    passive: true
}));

const reading = () => !!(ROOT || LEAF || DOC || CODE || [ "panel", "overlay", "focus", "docPane", "inboxOverlay", "voiceOv" ].some(id => {
    const el = document.getElementById(id);
    return el && el.classList.contains("open");
}));

setInterval(() => {
    if (!saver && !PUBLIC && !WALL && !document.hidden && !reading() && Date.now() - lastActive > (isMobile() ? 6e4 : 18e4)) enterSaver();
}, 1e4);

if (PUBLIC) {
    document.body.classList.add("public");
    if (EMBED) document.body.classList.add("embed");
    let framed = false;
    try {
        framed = window.self !== window.top;
    } catch {
        framed = true;
    }
    if (framed) document.body.classList.add("framed");
    document.getElementById("pTabs").style.display = "none";
    const ex = document.getElementById("pubExit");
    if (ex && PREVIEW && !EMBED) ex.hidden = false;
    addEventListener("load", () => [ "inboxBtn", "reviewBtn", "syncBtn", "talkBtn", "pubBtn", "legendNeeds", "inboxOverlay", "overlay", "voiceOv", "askBox" ].forEach(id => {
        const el = document.getElementById(id);
        if (el) (id === "askBox" ? el.parentNode : el).remove();
    }));
    document.querySelectorAll(".panel-chat").forEach(el => el.remove());
}

{
    const pb = document.getElementById("pubBtn");
    if (pb) pb.onclick = () => {
        location.href = location.pathname + "?public=1&preview=1";
    };
}

resize();

buildGraph(FALLBACK);

loadData();

const FLASH = {}, FLASH_MS = 4200;

let MAP_V = null, mapBusy = false, mapAgain = null, esLive = false;

const liveBase = () => CLOUD ? window.MAC_BASE || "" : "";

const dotSig = d => JSON.stringify([ d.label, d.status, d.stage, d.statusLine, d.why, d.waitingOn, d.parent, (d.children || []).map(c => c.id).join(",") ]);

function dotSigs(data) {
    const o = {};
    (data.projects || []).forEach(p => {
        o[p.id] = dotSig(p);
    });
    (data.projects || []).forEach(p => (p.children || []).forEach(c => {
        if (!(c.id in o)) o[c.id] = dotSig(c);
    }));
    return o;
}

async function fetchLive() {
    if (CLOUD && window.MAC_BASE && !PUBLIC) {
        try {
            const r = await fetch(window.MAC_BASE + "/api/map", {
                cache: "no-store",
                signal: AbortSignal.timeout ? AbortSignal.timeout(5e3) : undefined
            });
            if (r.ok) return r.json();
        } catch {}
    }
    return fetchMapData();
}

function applyMap(d, hinted) {
    const before = DATA === FALLBACK ? null : dotSigs(DATA), after = dotSigs(d);
    const pos = {};
    nodes.forEach(n => pos[n.id] = {
        x: n.x,
        y: n.y,
        va: n.va
    });
    const keep = Date.now() - userCam < 6e4 ? {
        ...cam
    } : null;
    d.location = HERE;
    DATA = d;
    buildGraph(DATA);
    nodes.forEach(n => {
        if (pos[n.id]) Object.assign(n, pos[n.id]);
    });
    renderChrome();
    if (keep) Object.assign(cam, keep);
    if (d.v) MAP_V = d.v;
    if (SEARCH.q) runSearch(SEARCH.q);
    if (LEAFMAP) renderLeafCap();
    if (!before) return;
    const ids = new Set((hinted || []).filter(id => FULL.e[id]));
    Object.keys(after).forEach(id => {
        if (before[id] !== after[id] && !String(id).startsWith("r:")) ids.add(id);
    });
    if (!ids.size) return;
    const now = Date.now();
    ids.forEach(id => {
        FLASH[id] = now;
    });
    const names = [ ...ids ].map(id => FULL.e[id] && FULL.e[id].label).filter(Boolean);
    if (names.length) tick(`<b>updated</b> · ${names.slice(0, 3).map(esc).join(", ")}${names.length > 3 ? ` +${names.length - 3}` : ""}`);
    window.dispatchEvent(new CustomEvent("ns:map", {
        detail: {
            changed: [ ...ids ]
        }
    }));
}

window.nsFlashed = () => Object.keys(FLASH);

window.nsNearest = (px, py) => {
    const w = toWorld(px, py);
    let best = null, bd = 1e9;
    nodes.forEach(n => {
        if (vaOf(n) < .5 || isOverlay(n)) return;
        const d = Math.hypot(n.x - w.x, n.y - w.y);
        if (d < bd) {
            bd = d;
            best = n;
        }
    });
    return best ? {
        id: best.id,
        label: best.label,
        px: Math.round(bd * cam.k)
    } : null;
};

async function refreshMap(ev) {
    if (mapBusy) {
        mapAgain = ev || {};
        return;
    }
    mapBusy = true;
    try {
        const d = await fetchLive();
        if (d) {
            applyMap(d, ev && ev.changed);
            if (ev && ev.v) MAP_V = ev.v;
        }
    } catch {}
    mapBusy = false;
    if (mapAgain) {
        const e = mapAgain;
        mapAgain = null;
        refreshMap(e);
    }
}

function onVersion(s) {
    if (!s || !s.v) return;
    if (MAP_V === null) MAP_V = DATA.v || null;
    if (MAP_V === null) {
        MAP_V = s.v;
        return;
    }
    if (s.v !== MAP_V) {
        MAP_V = s.v;
        refreshMap(s);
    }
}

function flashTarget(id) {
    let x = id, g = 0;
    while (x && g++ < 8) {
        const n = byId[x];
        if (n && vaOf(n) > .5) return n;
        x = FULL.e[x] && FULL.e[x].up;
    }
    return null;
}

function drawFlashes() {
    const now = Date.now(), seen = new Set;
    for (const id in FLASH) {
        const age = now - FLASH[id];
        if (age > FLASH_MS) {
            delete FLASH[id];
            continue;
        }
        const n = flashTarget(id);
        if (!n || seen.has(n.id)) continue;
        seen.add(n.id);
        const p = age / FLASH_MS, q = p * 3 % 1;
        ctx.globalAlpha = .85 * (1 - p);
        ctx.fillStyle = "rgba(255,196,0,0.28)";
        ctx.beginPath();
        ctx.arc(n.x, n.y, n.r + 6, 0, 7);
        ctx.fill();
        ctx.globalAlpha = .9 * (1 - p) * (1 - q);
        ctx.strokeStyle = "#F2A900";
        ctx.lineWidth = 2.6;
        ctx.beginPath();
        ctx.arc(n.x, n.y, n.r + 4 + q * 18, 0, 7);
        ctx.stroke();
    }
    ctx.globalAlpha = 1;
}

let noVerRoute = false;

async function pollVersion() {
    const base = liveBase();
    if (CLOUD && !base) return false;
    if (!noVerRoute) try {
        const r = await fetch(base + "/api/map/version", {
            cache: "no-store"
        });
        if (r.ok) {
            onVersion(await r.json());
            return true;
        }
        if (r.status === 404) noVerRoute = true;
    } catch {}
    if (!CLOUD) {
        try {
            const r = await fetch("map-version.json", {
                cache: "no-store"
            });
            if (r.ok) {
                onVersion(await r.json());
                return true;
            }
        } catch {}
    }
    return false;
}

function liveConnect() {
    if (STILL) return;
    const base = liveBase();
    if (window.EventSource && !(CLOUD && !base) && !PUBLIC) {
        try {
            const h = {
                onopen: () => {
                    esLive = true;
                },
                onmessage: d => {
                    esLive = true;
                    try {
                        onVersion(JSON.parse(d));
                    } catch {}
                },
                onerror: () => {
                    esLive = false;
                }
            };
            if (window.nsStream) window.nsStream(base + "/api/map/events", h); else {
                const es = new EventSource(base + "/api/map/events");
                es.onopen = h.onopen;
                es.onmessage = e => h.onmessage(e.data);
                es.onerror = h.onerror;
            }
        } catch {}
    }
    let last = Date.now();
    setInterval(async () => {
        const live = esLive || await pollVersion();
        const gap = live ? 6e4 : 2e4;
        if (Date.now() - last > gap) {
            last = Date.now();
            refreshMap();
        }
    }, 3e3);
}

liveConnect();

if (new URLSearchParams(location.search).get("screensaver") === "1") enterSaver();

function stillCaption() {
    const el = document.getElementById("stillCap");
    if (!el) return;
    const s = situation();
    const html = `<div class="sit-line">${esc(clipTxt(situationLine(), 170))}</div>${s.needs.length ? `<ul class="sit-needs">${needsHtml(s.needs, 3)}</ul>` : '<div class="sit-line">Nothing is waiting on you.</div>'}`;
    if (el.dataset.sig !== html) {
        el.dataset.sig = html;
        el.innerHTML = html;
    }
}

if (STILL) {
    document.body.classList.add("still");
    enterSaver();
    stillCaption();
    setGravity();
    setInterval(() => {
        stillCaption();
        fitAll();
    }, 1e3);
}

loop();

(function selfUpdate() {
    if (PUBLIC || CLOUD) return;
    let sig = null;
    const sigOf = t => {
        let h = 0;
        for (let i = 0; i < t.length; i++) h = h * 31 + t.charCodeAt(i) | 0;
        return t.length + ":" + h;
    };
    const quiet = () => Date.now() - lastActive > 12e4 && (!window.nsVoice || !window.nsVoice.isOpen()) && !panelNode && !LEAFMAP;
    async function check() {
        let next = 3e5;
        try {
            const s = sigOf(await (await fetch(location.pathname, {
                cache: "no-store"
            })).text());
            if (sig && s !== sig) {
                if (quiet()) return location.reload();
                next = 3e4;
            } else sig = s;
        } catch {}
        setTimeout(check, next);
    }
    setTimeout(check, 5e3);
})();
