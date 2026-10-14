(function() {
    const H = document.documentElement;
    if (H.classList.contains("public") || /[?&]public=1(&|$)/.test(location.search) || window.NS_PUBLIC) return;
    if (!window.NSTree) return;
    const PAGE = document.body && document.body.dataset.treePage === "1";
    const KEY = "ns.tree.open";
    const store = {
        get(k) {
            try {
                return sessionStorage.getItem(k);
            } catch {
                return null;
            }
        },
        set(k, v) {
            try {
                sessionStorage.setItem(k, v);
            } catch {}
        }
    };
    const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, c => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;"
    }[c]));
    const isPhone = () => innerWidth < 700;
    const ICON = {
        tree: '<svg viewBox="0 0 18 16" aria-hidden="true"><circle cx="3" cy="8" r="1.9"/><path d="M5 8h2.5M7.5 3.2v9.6M7.5 3.2h3M7.5 8h3M7.5 12.8h3"/><circle cx="12.6" cy="3.2" r="1.3"/><circle cx="12.6" cy="8" r="1.3"/><circle cx="12.6" cy="12.8" r="1.3"/></svg>',
        min: '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M10 3.5 5.5 8l4.5 4.5"/></svg>',
        page: '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M9.5 2.5h4v4M13.5 2.5 8 8M6.5 3.5h-3v9h9v-3"/></svg>',
        map: '<svg viewBox="-44 -44 88 88" aria-hidden="true"><path d="M0 -44L3.06 -1.39L14.85 -8.85L7.39 2.94L32 6L7.39 9.06L14.85 20.85L3.06 13.39L0 44L-3.06 13.39L-14.85 20.85L-7.39 9.06L-32 6L-7.39 2.94L-14.85 -8.85L-3.06 -1.39Z"/></svg>'
    };
    const CSS = `\n  :root { --nt-line:#C9C9C9; --nt-red:var(--red, #D32F2F); --nt-ink:var(--text, #000); --nt-mut:var(--text-muted, #999); --nt-sec:var(--text-secondary, #555); --nt-bg:var(--bg, #FFF); --nt-card:var(--bg-card, #F5F5F5); --nt-bd:var(--border, #E5E5E5); }\n  /* The chip lives IN the topbar, just left of the details-panel button (her 10/13 feedback: floating at the top left\n     it covered a dot page's title). Map views: tree glyph + counts; a dot's own content page (#focus open): glyph only. */\n  .nt-chip { flex:0 0 auto; display:flex; align-items:center; gap:9px; height:33px; padding:0 10px; position:relative;\n    border:1px solid var(--nt-bd); border-radius:999px; background:var(--nt-bg); cursor:pointer;\n    font-family:var(--mono, 'JetBrains Mono', monospace); font-size:11px; color:var(--nt-sec); transition:border-color .15s; }\n  .chips:empty + .nt-chip { margin-left:auto; }\n  .nt-chip:hover, .nt-chip:focus-visible, .nt-chip[aria-expanded="true"] { border-color:var(--nt-ink); outline:none; }\n  .nt-chip[aria-expanded="true"] { background:var(--nt-card); }\n  .nt-chip > svg { width:17px; height:15px; fill:none; stroke:var(--nt-ink); stroke-width:1.3; stroke-linecap:round; flex-shrink:0; }\n  .nt-chip > svg circle { fill:var(--nt-bg); }\n  .nt-chip .nt-c { display:flex; align-items:center; gap:5px; white-space:nowrap; }\n  .nt-chip .nt-c b { font-family:var(--font-heading, 'Archivo Black', sans-serif); font-size:12px; font-weight:400; color:var(--nt-ink); }\n  .nt-chip .nt-c.needs b { color:var(--nt-red); }\n  .nt-chip .nt-c em { font-style:normal; }\n  .nt-chip.icon { width:33px; padding:0; justify-content:center; border-radius:8px; }\n  .nt-chip.icon .nt-c { display:none; }\n  .nt-chip .nt-badge { position:absolute; top:-3px; right:-3px; width:9px; height:9px; border-radius:50%; background:var(--nt-red); border:2px solid var(--nt-bg); display:none; }\n  .nt-chip.icon .nt-badge.on { display:block; }\n  body.saver .nt-panel, body.still .nt-panel { opacity:0 !important; pointer-events:none !important; }\n  .nt-panel { position:fixed; left:0; top:var(--toph, 57px); bottom:0; width:min(400px, 100vw); z-index:28; background:var(--nt-bg); border-right:1px solid var(--nt-bd);\n    display:flex; flex-direction:column; transform:translateX(-102%); transition:transform .3s cubic-bezier(.4,0,.2,1); box-shadow:24px 0 48px rgba(0,0,0,.06); }\n  body.nt-open .nt-panel { transform:none; }\n  .nt-head { display:flex; align-items:center; gap:8px; padding:14px 14px 10px 18px; border-bottom:1px solid var(--nt-bd); }\n  .nt-head > div { flex:1; min-width:0; }\n  .nt-title { font-family:var(--font-heading, 'Archivo Black', sans-serif); font-size:17px; letter-spacing:-.3px; color:var(--nt-ink); }\n  .nt-sub { font-family:var(--mono, monospace); font-size:10.5px; color:var(--nt-mut); margin-top:3px; }\n  .nt-btn { width:32px; height:32px; flex-shrink:0; display:flex; align-items:center; justify-content:center; border:1px solid var(--nt-bd); border-radius:8px; background:var(--nt-bg); color:var(--nt-ink); cursor:pointer; padding:0; text-decoration:none; }\n  .nt-btn:hover, .nt-btn:focus-visible { border-color:var(--nt-ink); outline:none; }\n  .nt-btn svg { width:15px; height:15px; fill:none; stroke:currentColor; stroke-width:1.5; stroke-linecap:round; stroke-linejoin:round; }\n  .nt-body { flex:1; overflow-y:auto; padding:12px 16px 28px 18px; -webkit-overflow-scrolling:touch; }\n  /* Push the map's own left-hand pieces out from under the open dock (desktop). */\n  @media (min-width:700px) {\n    body.nt-open .crumbs { left:416px; }\n    body.nt-open .leaf-cap { left:416px; }\n    body.nt-open #focus.open { left:400px; }\n    body.nt-open .askbar { left:calc(50% + 200px); width:min(560px, calc(100vw - 448px)); }\n    body.nt-open .legend { opacity:0; pointer-events:none; }\n  }\n  @media (max-width:1000px) { .nt-chip .nt-c em { display:none; } }\n  @media (max-width:699px) { .nt-chip .nt-c.working, .nt-chip .nt-c.waiting, .nt-chip .nt-c.planned { display:none; } .nt-chip { gap:6px; padding:0 9px; } }\n\n  /* ── The tree: a label, a thin grey bracket, its children (her drawing) ── */\n  .nt-tree { font-family:var(--font, Inter, -apple-system, sans-serif); color:var(--nt-ink); }\n  .nt-n { display:flex; align-items:center; }\n  .nt-l { flex:0 0 auto; position:relative; padding-right:18px; }\n  .nt-l::after { content:''; position:absolute; right:0; top:50%; width:14px; border-top:1px solid var(--nt-line); }\n  .nt-k { flex:1 1 auto; min-width:0; display:flex; flex-direction:column; }\n  .nt-e { position:relative; padding:3px 0 3px 16px; }\n  .nt-e::before { content:''; position:absolute; left:0; top:0; bottom:0; width:11px; border-left:1px solid var(--nt-line); }\n  .nt-e::after { content:''; position:absolute; left:0; top:50%; width:11px; border-top:1px solid var(--nt-line); }\n  .nt-e:first-child::before { top:50%; border-top:1px solid var(--nt-line); border-top-left-radius:9px; }\n  .nt-e:last-child::before { bottom:50%; border-bottom:1px solid var(--nt-line); border-bottom-left-radius:9px; }\n  .nt-e:first-child::after, .nt-e:last-child::after { display:none; }\n  .nt-e:only-child::before { display:none; }\n  .nt-e:only-child::after { display:block; }\n  /* Stacked (the dock, and the page on a phone): the segment name sits above its groups. */\n  .nt-n.v { display:block; margin-bottom:14px; }\n  .nt-n.v > .nt-l { padding:0 0 6px; }\n  .nt-n.v > .nt-l::after { display:none; }\n  .nt-n.v > .nt-k { margin-left:5px; }\n  .nt-n.v > .nt-k > .nt-e:first-child::before { top:-6px; border-top:0; border-radius:0; }\n  .nt-n.v > .nt-k > .nt-e:first-child::after { display:block; }\n  .nt-n.v > .nt-k > .nt-e:only-child::before { display:block; bottom:50%; border-bottom:1px solid var(--nt-line); border-bottom-left-radius:9px; }\n  .nt-n.v > .nt-k > .nt-e:only-child::after { display:none; }\n  .nt-s { display:flex; align-items:center; gap:7px; font-family:var(--font-heading, 'Archivo Black', sans-serif); font-size:13px; letter-spacing:-.1px; white-space:nowrap; }\n  .nt-s b { font-family:var(--mono, monospace); font-size:11px; font-weight:500; color:var(--nt-mut); }\n  .nt-s.needs, .nt-s.needs b { color:var(--nt-red); }\n  .nt-gl { display:block; width:92px; font-family:var(--font-heading, 'Archivo Black', sans-serif); font-size:11px; line-height:1.2; letter-spacing:-.1px; word-break:break-word; }\n  .nt-gl b { display:block; font-family:var(--mono, monospace); font-size:9.5px; font-weight:400; color:var(--nt-mut); margin-top:2px; }\n  .nt-gl[data-open] { cursor:pointer; } .nt-gl[data-open]:hover { text-decoration:underline; text-underline-offset:3px; }\n  .nt-i { display:flex; align-items:flex-start; gap:7px; width:100%; padding:2px 4px; border:0; border-radius:6px; background:none; text-align:left; cursor:pointer; font:inherit; color:inherit; }\n  .nt-i:hover, .nt-i:focus-visible { background:var(--nt-card); outline:none; }\n  .nt-i .nt-t { font-size:12.5px; line-height:1.38; color:var(--nt-sec); min-width:0; overflow-wrap:anywhere; }\n  .nt-i .nt-t b { color:var(--nt-ink); font-weight:600; }\n  .nt-panel .nt-i .nt-t { display:-webkit-box; -webkit-line-clamp:2; -webkit-box-orient:vertical; overflow:hidden; }\n  .nt-more { border:0; background:none; padding:2px 4px; font-family:var(--mono, monospace); font-size:10.5px; color:var(--nt-mut); cursor:pointer; text-align:left; }\n  .nt-more:hover { color:var(--nt-ink); text-decoration:underline; }\n  .nt-none { font-size:12px; color:var(--nt-mut); padding:2px 4px; }\n  .nt-d { flex-shrink:0; width:7px; height:7px; margin-top:5px; border-radius:50%; background:var(--nt-ink); }\n  .nt-d.live { animation:ntPulse 1.6s infinite; }\n  /* Waiting on them (2026-10-13): a muted-amber hourglass, the same mark the map draws at a waiting dot's shoulder. */\n  .nt-d.wait { width:7px; height:9px; margin-top:4px; border-radius:0; background:var(--nt-wait, #B7791F); clip-path:polygon(0 0, 100% 0, 58% 50%, 100% 100%, 0 100%, 42% 50%); }\n  .nt-chip .nt-c.waiting b { color:var(--nt-wait, #B7791F); }\n  .nt-d.need { background:var(--nt-red); }\n  .nt-d.inbox { background:var(--nt-bg); border:1.5px solid var(--nt-red); }\n  .nt-d.planned { background:var(--nt-bg); border:1.2px solid #9A9A9A; }\n  /* Done this week (2026-10-13): a small grey check; the segment opens collapsed. */\n  .nt-d.done { width:8px; height:4.5px; margin-top:5px; border-radius:0; background:none; border-left:1.6px solid var(--nt-mut); border-bottom:1.6px solid var(--nt-mut); transform:rotate(-45deg); }\n  .nt-tog { border:0; background:none; padding:0; cursor:pointer; color:inherit; display:flex; align-items:center; gap:7px; }\n  .nt-tog.nt-s { font-family:var(--font-heading, 'Archivo Black', sans-serif); font-size:13px; letter-spacing:-.1px; color:var(--nt-sec); }\n  body[data-tree-page="1"] .nt-tog.nt-s { font-size:16px; }\n  .nt-tog svg { width:10px; height:10px; fill:none; stroke:currentColor; stroke-width:1.6; transition:transform .15s; } .nt-tog[aria-expanded="true"] svg { transform:rotate(90deg); }\n  .nt-chip .nt-c.done b { color:var(--nt-sec); }\n  .nt-d.plan { border-radius:1px; background:repeating-linear-gradient(0deg, transparent 0 2px, rgba(0,0,0,.3) 2px 2.6px), repeating-linear-gradient(90deg, transparent 0 2px, rgba(0,0,0,.3) 2px 2.6px), #FFF; border:1px solid #000; }\n  @keyframes ntPulse { 0%,100% { opacity:1 } 50% { opacity:.25 } }\n  /* The page: everything wider */\n  body[data-tree-page="1"] .nt-gl { width:150px; font-size:12.5px; }\n  body[data-tree-page="1"] .nt-s { font-size:16px; }\n  body[data-tree-page="1"] .nt-i .nt-t { font-size:13.5px; }\n  body[data-tree-page="1"] .nt-n.seg { margin:10px 0; }\n  body[data-tree-page="1"] .nt-n.seg > .nt-l { min-width:200px; }\n  @media (max-width:699px) { body[data-tree-page="1"] .nt-gl { width:88px; font-size:11px; } body[data-tree-page="1"] .nt-i .nt-t { font-size:12.5px; } }\n  `;
    const st = document.createElement("style");
    st.textContent = CSS;
    document.head.appendChild(st);
    const get = p => window.api ? window.api(p, {
        cache: "no-store"
    }) : fetch(p, {
        cache: "no-store"
    });
    let mapData = null, workers = [], health = 0;
    async function load(force) {
        let shared = null, live = null;
        try {
            if (typeof DATA !== "undefined" && DATA && DATA.generatedAt && Array.isArray(DATA.projects)) shared = DATA;
        } catch {}
        try {
            if (typeof LIVE !== "undefined" && LIVE && Array.isArray(LIVE.workers)) live = LIVE.workers;
        } catch {}
        if (shared) mapData = shared; else if (force || !mapData || Date.now() - (load.t || 0) > 25e3) {
            try {
                const r = await get("/api/map");
                if (r.ok) {
                    mapData = await r.json();
                    load.t = Date.now();
                }
            } catch {}
        }
        if (live) workers = live; else if (force || Date.now() - health > 2e4) {
            try {
                const r = await get("/api/health");
                if (r.ok) {
                    workers = (await r.json()).workers || [];
                    health = Date.now();
                }
            } catch {}
        }
        return mapData;
    }
    const expanded = new Set;
    const dotCls = i => i.kind === "agent" ? "live" : i.seg === "done" ? "done" : i.seg === "waiting" ? "wait" : i.kind === "inbox" ? "inbox" : i.seg === "needs" ? "need" : i.kind === "plan" ? "plan" : i.kind === "planned" ? "planned" : "";
    const branch = (label, kids, cls = "") => `<div class="nt-n ${cls}"><div class="nt-l">${label}</div><div class="nt-k">${kids.map(k => `<div class="nt-e">${k}</div>`).join("")}</div></div>`;
    const item = (seg, i) => `<button type="button" class="nt-i" data-open="${esc(i.open || "")}"${i.inbox ? ` data-inbox="${esc(i.inbox)}"` : ""} title="${esc(i.name + (i.line ? " -- " + i.line : ""))}"><span class="nt-d ${dotCls({
        ...i,
        seg: seg
    })}"></span><span class="nt-t"><b>${esc(i.name)}</b>${i.line ? ` — ${esc(i.line)}` : ""}</span></button>`;
    const SEGDOT = {
        working: '<span class="nt-d live" style="margin:0"></span>',
        waiting: '<span class="nt-d wait" style="margin:0"></span>',
        needs: '<span class="nt-d need" style="margin:0"></span>',
        planned: '<span class="nt-d plan" style="margin:0"></span>',
        done: '<span class="nt-d done" style="margin:0 1px 3px"></span>'
    };
    const EMPTY = {
        working: "nothing running right now",
        waiting: "nobody else owes you a move",
        needs: "nothing is waiting on you",
        planned: "no plans waiting",
        done: "nothing closed this week"
    };
    const CHEV = '<svg viewBox="0 0 10 10" aria-hidden="true"><path d="M3.5 1.8 6.7 5 3.5 8.2"/></svg>';
    function segHtml(s, stacked, cap) {
        const isDone = s.id === "done", open = !isDone || expanded.has("seg:done");
        const label = isDone ? `<button type="button" class="nt-tog nt-s done" data-more="seg:done" aria-expanded="${open}" title="${open ? "Fold" : "Show"} what got done this week">${CHEV}${SEGDOT.done}${esc(s.label)} <b>${s.count}</b></button>` : `<span class="nt-s ${s.id}">${SEGDOT[s.id]}${esc(s.label)} <b>${s.count}</b></span>`;
        if (!open) return `<div class="nt-n seg${stacked ? " v" : ""}"><div class="nt-l">${label}</div></div>`;
        const groups = s.groups.map(g => {
            const key = s.id + ":" + g.id, all = expanded.has(key), shown = all ? g.items : g.items.slice(0, cap);
            const kids = shown.map(i => item(s.id, i));
            if (g.items.length > cap) kids.push(`<button type="button" class="nt-more" data-more="${esc(key)}">${all ? "show fewer" : `+${g.items.length - cap} more`}</button>`);
            return branch(`<span class="nt-gl"${g.id && g.id !== "other" ? ` data-open="${esc(g.id)}"` : ""}>${esc(g.label)}<b>${g.items.length}</b></span>`, kids);
        });
        return branch(label, groups.length ? groups : [ `<div class="nt-none">${EMPTY[s.id]}</div>` ], "seg" + (stacked ? " v" : ""));
    }
    function treeHtml(tree, {stacked: stacked, cap: cap}) {
        const segs = tree.segments.map(s => segHtml(s, stacked, cap));
        return `<div class="nt-tree">${segs.join("")}</div>`;
    }
    const clock = d => d.toLocaleTimeString("en-US", {
        hour: "numeric",
        minute: "2-digit"
    });
    function subLine(tree) {
        const s = tree.situationAt ? `read ${clock(new Date(tree.situationAt))} from your mail + chats` : "not reconciled with your mail yet";
        return `${s} · agents live`;
    }
    function onClick(e) {
        const more = e.target.closest("[data-more]");
        if (more) {
            const k = more.dataset.more;
            expanded.has(k) ? expanded.delete(k) : expanded.add(k);
            render(true);
            return;
        }
        const el = e.target.closest("[data-open]");
        if (!el) return;
        const id = el.dataset.open, inbox = el.dataset.inbox;
        if (PAGE) {
            const url = "./?open=" + encodeURIComponent(inbox || id || "");
            const w = window.open(id || inbox ? url : "./", "ns-map");
            if (w) w.focus();
            return;
        }
        if (inbox && window.openInbox) window.openInbox(inbox); else if (id && window.nsOpen) window.nsOpen(id);
        if (isPhone()) setOpen(false);
    }
    let chip, panel, body, sig = "";
    function mountDock() {
        chip = document.createElement("button");
        chip.type = "button";
        chip.className = "nt-chip";
        chip.id = "ntChip";
        chip.setAttribute("aria-label", "Action tree");
        chip.title = "The action tree: what is working, waiting on others, needs you, planned";
        chip.onclick = () => setOpen(!document.body.classList.contains("nt-open"));
        panel = document.createElement("aside");
        panel.className = "nt-panel";
        panel.id = "ntPanel";
        panel.setAttribute("aria-label", "Action tree");
        panel.innerHTML = `<div class="nt-head"><div><div class="nt-title">ACTION TREE</div><div class="nt-sub" id="ntSub"></div></div>\n      <a class="nt-btn" href="tree.html" target="_blank" rel="noopener" title="Open the tree on its own page" aria-label="Open the tree on its own page">${ICON.page}</a>\n      <button type="button" class="nt-btn" id="ntMin" title="Minimize" aria-label="Minimize the action tree">${ICON.min}</button></div><div class="nt-body" id="ntBody"></div>`;
        const pb = document.getElementById("panelBtn"), bar = pb && pb.parentNode;
        if (bar) bar.insertBefore(chip, pb); else document.body.appendChild(chip);
        document.body.appendChild(panel);
        const fo = document.getElementById("focus");
        const mode = () => chip.classList.toggle("icon", !!(fo && fo.classList.contains("open")));
        if (fo) new MutationObserver(mode).observe(fo, {
            attributes: true,
            attributeFilter: [ "class" ]
        });
        mode();
        body = panel.querySelector("#ntBody");
        panel.querySelector("#ntMin").onclick = () => setOpen(false);
        panel.addEventListener("click", onClick);
        panel.addEventListener("keydown", e => {
            if (e.key === "Escape") {
                e.stopPropagation();
                setOpen(false);
                chip.focus();
            }
        });
        setOpen(store.get(KEY) === "1" && !isPhone(), true);
    }
    function setOpen(on, quiet) {
        document.body.classList.toggle("nt-open", !!on);
        panel.setAttribute("aria-hidden", on ? "false" : "true");
        chip.setAttribute("aria-expanded", on ? "true" : "false");
        if (!quiet) store.set(KEY, on ? "1" : "0");
        if (on) render(true);
    }
    async function render(force) {
        const m = await load(false);
        if (!m) return;
        const tree = NSTree.build({
            map: m,
            workers: workers
        });
        window.NS_TREE = tree;
        const s = JSON.stringify([ tree.counts, tree.segments.map(x => x.groups.map(g => g.items.map(i => i.name + i.line))) ]) + [ ...expanded ].join();
        if (!force && s === sig) return;
        sig = s;
        if (PAGE) return renderPage(tree);
        const c = tree.counts;
        chip.innerHTML = `${ICON.tree}<span class="nt-c working"><span class="nt-d live" style="margin:0"></span><b>${c.working}</b><em>working</em></span><span class="nt-c waiting"><span class="nt-d wait" style="margin:0"></span><b>${c.waiting}</b><em>waiting</em></span><span class="nt-c needs"><span class="nt-d need" style="margin:0"></span><b>${c.needs}</b><em>need you</em></span><span class="nt-c planned"><span class="nt-d plan" style="margin:0"></span><b>${c.planned}</b><em>planned</em></span>${expanded.has("seg:done") ? `<span class="nt-c done"><span class="nt-d done" style="margin:0 1px 3px"></span><b>${c.done || 0}</b><em>done</em></span>` : ""}<span class="nt-badge${c.needs ? " on" : ""}"></span>`;
        chip.title = `Action tree: ${c.working} working, ${c.waiting} waiting on others, ${c.needs} need you, ${c.planned} planned, not acted on${c.done ? `, ${c.done} done this week` : ""}`;
        if (document.body.classList.contains("nt-open")) {
            const y = body.scrollTop;
            panel.querySelector("#ntSub").textContent = subLine(tree);
            body.innerHTML = treeHtml(tree, {
                stacked: true,
                cap: 4
            });
            body.scrollTop = y;
        }
    }
    function renderPage(tree) {
        const el = document.getElementById("ntPage");
        if (!el) return;
        const sub = document.getElementById("ntPageSub");
        if (sub) sub.textContent = subLine(tree);
        const phone = isPhone();
        el.innerHTML = treeHtml(tree, {
            stacked: phone,
            cap: phone ? 4 : 6
        });
    }
    if (PAGE) {
        const el = document.getElementById("ntPage");
        if (el) el.addEventListener("click", onClick);
        let w = innerWidth;
        addEventListener("resize", () => {
            if (innerWidth < 700 !== w < 700) {
                w = innerWidth;
                render(true);
            }
        });
    } else mountDock();
    render(true);
    setInterval(() => render(false), PAGE ? 3e4 : 1e4);
})();
