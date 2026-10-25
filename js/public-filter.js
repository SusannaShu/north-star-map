(function(root) {
    const PUBLIC_FIELDS = [ "why", "caption", "image", "images", "case", "cases", "embed", "embedCaption", "docs", "refs", "paper" ];
    const OVERRIDABLE = [ "label", "statusLine", ...PUBLIC_FIELDS ];
    const BAD_HREF = /^(?:mailto:|file:|https?:\/\/(?:localhost|127\.|0\.0\.0\.0|10\.|192\.168\.|172\.(?:1[6-9]|2\d|3[01])\.|[^/]*\.ts\.net|[^/]*\.local\b|mail\.google\.|docs\.google\.|drive\.google\.|calendar\.google\.))/i;
    const okHref = h => typeof h === "string" && h.length > 0 && !BAD_HREF.test(h) && !/^javascript:/i.test(h) && (!/^\/(?!\/)/.test(h) || okAsset(h));
    const okAsset = s => typeof s === "string" && /^\/(img|js)\/[\w.\-\/]+$|^\/[\w.\-]+\.(html|pdf|jpg|png|svg)(\?[\w=&.\-]*)?$/.test(s);
    const strip = x => String(x == null ? "" : x).replace(/<[^>]+>/g, "").replace(/&nbsp;/g, " ").replace(/\s+/g, " ").trim();
    const isPub = n => !!n && n.visibility === "public";
    const clone = x => x == null ? x : JSON.parse(JSON.stringify(x));
    const pubStatus = s => s === "working" ? "working" : s === "waiting" ? "waiting" : s === "queued" ? "queued" : s === "dormant" ? "dormant" : s === "planned" ? "planned" : s === "done" ? "done" : "idle";
    function sanitize(o) {
        if (o.why != null) o.why = strip(o.why);
        if (o.caption != null) o.caption = strip(o.caption);
        if (o.statusLine != null) o.statusLine = strip(o.statusLine);
        if (o.label != null) o.label = strip(o.label);
        if (o.image != null && !okAsset(o.image)) delete o.image;
        if (Array.isArray(o.images)) {
            o.images = o.images.filter(okAsset);
            if (!o.images.length) delete o.images;
        }
        const card = c => {
            if (!c || typeof c !== "object") return null;
            const k = {
                title: strip(c.title || "")
            };
            if (okAsset(c.image)) k.image = c.image;
            if (okHref(c.href)) k.href = c.href;
            return k.image || k.href ? k : null;
        };
        if (o.case) {
            o.case = card(o.case);
            if (!o.case) delete o.case;
        }
        if (Array.isArray(o.cases)) {
            o.cases = o.cases.map(card).filter(Boolean);
            if (!o.cases.length) delete o.cases;
        }
        if (o.embed != null && !(typeof o.embed === "string" && o.embed.startsWith("/") && okAsset(o.embed.split("#")[0]))) delete o.embed;
        if (Array.isArray(o.docs)) {
            o.docs = o.docs.filter(d => d && okHref(d.href)).map(d => ({
                label: strip(d.label),
                href: d.href,
                ...okAsset(d.thumb) ? {
                    thumb: d.thumb
                } : {}
            }));
            if (!o.docs.length) delete o.docs;
        }
        if (Array.isArray(o.refs)) {
            o.refs = o.refs.filter(r => r && okHref(r.href)).map(r => ({
                label: strip(r.label),
                href: r.href
            }));
            if (!o.refs.length) delete o.refs;
        }
        if (o.paper) o.paper = {
            title: strip(o.paper.title),
            ...o.paper.venue ? {
                venue: strip(o.paper.venue)
            } : {}
        };
        for (const k of Object.keys(o)) if (o[k] === null || o[k] === undefined || o[k] === "") delete o[k];
        return o;
    }
    function nodeOut(n, extra) {
        const o = {
            id: n.id,
            label: n.label,
            status: n.status === "waiting" && !n.liveWork ? "idle" : pubStatus(n.status)
        };
        for (const k of PUBLIC_FIELDS) if (n[k] !== undefined) o[k] = clone(n[k]);
        const pv = n.public && typeof n.public === "object" ? n.public : {};
        for (const k of OVERRIDABLE) if (k in pv) o[k] = clone(pv[k]);
        if (n.planned || n.status === "planned") o.planned = true;
        if (n.stage === "plan" || n.stage === "active") o.stage = n.stage;
        if (n.pin) o.pin = true;
        if (n.find) o.find = true;
        if (n.kind === "ptype") {
            o.kind = "ptype";
            o.count = n.count || (n.people || []).length || 0;
        }
        o.visibility = "public";
        return sanitize(Object.assign(o, extra || {}));
    }
    function nsPublicView(map, opts) {
        opts = opts || {};
        const m = map || {};
        const P = m.projects || [];
        const byId = {};
        P.forEach(p => byId[p.id] = p);
        const chainPub = p => {
            let q = p, d = 0;
            while (q && d < 8) {
                if (!isPub(q)) return false;
                if (!q.parent) return true;
                q = byId[q.parent];
                d++;
            }
            return false;
        };
        const projects = [];
        for (const p of P) {
            if (!chainPub(p)) continue;
            const kids = (p.children || []).filter(isPub).map(c => nodeOut(c, Array.isArray(c.links) ? {
                links: c.links.slice()
            } : null));
            projects.push(nodeOut(p, {
                ...p.parent ? {
                    parent: p.parent
                } : {},
                parked: !!p.parked,
                children: kids,
                ...Array.isArray(p.links) ? {
                    links: p.links.slice()
                } : {}
            }));
        }
        const ids = new Set([ m.hub && m.hub.id, ...projects.map(p => p.id), ...projects.flatMap(p => p.children.map(c => c.id)) ].filter(Boolean));
        const label = {};
        projects.forEach(p => {
            label[p.id] = p.label;
            p.children.forEach(c => label[c.id] = c.label);
        });
        const fixLinks = o => {
            if (o.links) {
                o.links = o.links.filter(t => ids.has(t));
                if (!o.links.length) delete o.links;
            }
        };
        projects.forEach(p => {
            fixLinks(p);
            p.children.forEach(c => {
                fixLinks(c);
                if (c.kind === "ptype") {
                    const ls = (c.links || []).map(t => String(label[t] || "").toLowerCase()).filter(Boolean);
                    c.label = String(c.label || "").replace(/\s*·\s*\d+\s*$/, "") + ` · ${c.count}`;
                    c.caption = ls.length ? `People in ${ls.join(", ").replace(/, ([^,]*)$/, " and $1")} I learn from.` : "People I learn from.";
                    c.why = `${c.count} people`;
                    delete c.statusLine;
                }
            });
        });
        const workers = opts.workers || [];
        const at = {};
        const hubId = m.hub && m.hub.id || "north-star";
        const up = {};
        for (const p of P) {
            if (p.parent) up[p.id] = p.parent;
            for (const c of p.children || []) if (!up[c.id]) up[c.id] = p.id;
        }
        const pubOf = id => {
            let q = id, d = 0;
            while (q && d < 10) {
                if (ids.has(q)) return q;
                q = up[q];
                d++;
            }
            return hubId;
        };
        for (const w of workers) {
            const where = (m.workerAt || {})[w.id] || w.project || null;
            const id = where ? pubOf(where) : hubId;
            at[id] = (at[id] || 0) + 1;
        }
        const rank = s => s === "working" ? 3 : s === "waiting" ? 2 : s === "queued" ? 1 : 0;
        const lift = {};
        for (const p of P) for (const n of [ p, ...p.children || [] ]) {
            if (ids.has(n.id) || !n.liveWork) continue;
            const s = n.liveWork.working ? "working" : n.status === "queued" ? "queued" : "waiting", to = pubOf(n.id);
            if (to !== hubId && rank(s) > rank(lift[to])) lift[to] = s;
        }
        projects.forEach(p => [ p, ...p.children ].forEach(o => {
            const s = lift[o.id];
            if (s && rank(s) > rank(o.status) && o.status !== "done") o.status = s;
        }));
        const alias = {};
        for (const p of P) {
            if (p.public && p.public.id) alias[p.id] = p.public.id;
            for (const c of p.children || []) if (c.public && c.public.id) alias[c.id] = c.public.id;
        }
        if (Object.keys(alias).length) {
            const A = id => alias[id] || id;
            projects.forEach(p => {
                p.id = A(p.id);
                if (p.parent) p.parent = A(p.parent);
                if (p.links) p.links = p.links.map(A);
                p.children.forEach(c => {
                    c.id = A(c.id);
                    if (c.links) c.links = c.links.map(A);
                });
            });
            for (const k of Object.keys(at)) if (alias[k]) {
                at[alias[k]] = (at[alias[k]] || 0) + at[k];
                delete at[k];
            }
        }
        const hub = m.hub || {
            id: hubId,
            label: "NORTH STAR"
        };
        const pv = hub.public || {};
        return {
            public: true,
            generatedAt: m.generatedAt || null,
            hub: sanitize({
                id: hub.id,
                label: pv.label || hub.label,
                why: "why" in pv ? pv.why : hub.why,
                yesterday: [],
                today: []
            }),
            projects: projects,
            activity: {
                working: workers.length,
                at: at
            },
            ticker: [],
            sync: [],
            health: {},
            peopleTypes: [],
            people: []
        };
    }
    root.nsPublicView = nsPublicView;
})(typeof window !== "undefined" ? window : globalThis);
