(function(root) {
    const PUBLIC_FIELDS = [ "why", "caption", "image", "images", "case", "cases", "embed", "embedCaption", "docs", "refs", "paper", "goalStory" ];
    const OVERRIDABLE = [ "label", "statusLine", ...PUBLIC_FIELDS ];
    const BAD_HREF = /^(?:mailto:|file:|https?:\/\/(?:localhost|127\.|0\.0\.0\.0|10\.|192\.168\.|172\.(?:1[6-9]|2\d|3[01])\.|100\.(?:6[4-9]|[7-9]\d|1[01]\d|12[0-7])\.|[^/]*\.ts\.net|[^/]*\.local\b|mail\.google\.|docs\.google\.|drive\.google\.|calendar\.google\.))/i;
    const okHref = h => typeof h === "string" && h.length > 0 && !BAD_HREF.test(h) && !/^javascript:/i.test(h) && (!/^\/(?!\/)/.test(h) || okAsset(h));
    const okAsset = s => typeof s === "string" && /^\/(img|js)\/[\w.\-\/]+$|^\/[\w.\-]+\.(html|pdf|jpg|png|svg)(\?[\w=&.\-]*)?$/.test(s);
    const strip = x => String(x == null ? "" : x).replace(/<[^>]+>/g, "").replace(/&nbsp;/g, " ").replace(/\s+/g, " ").trim();
    const isPub = n => !!n && n.visibility === "public";
    const REPO_URL = /^https:\/\/github\.com\/[\w.-]+\/([\w.-]+)(\/[^\s"<>]*)?$/;
    function nsPublicRepos(list, now) {
        if (!Array.isArray(list) || !list.length) return undefined;
        const t = now || Date.now(), out = [], seen = {};
        let hidden = false;
        for (const r of list) {
            const m = r && r.vis === "public" && typeof r.url === "string" && r.url.match(REPO_URL), fresh = r && t - Date.parse(r.checkedAt) < 3 * 864e5;
            if (m && fresh) {
                if (!seen[m[1]]) {
                    seen[m[1]] = 1;
                    out.push({
                        vis: "public",
                        name: m[1],
                        url: r.url
                    });
                }
            } else hidden = true;
        }
        if (hidden) out.push({
            vis: "private"
        });
        return out;
    }
    const clone = x => x == null ? x : JSON.parse(JSON.stringify(x));
    const pubStatus = s => s === "working" ? "working" : s === "waiting" ? "waiting" : s === "queued" ? "queued" : s === "dormant" ? "dormant" : s === "planned" ? "planned" : s === "done" ? "done" : "idle";
    function sanitize(o) {
        delete o.vision;
        delete o.rehomed;
        delete o.files;
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
    const reEsc = x => String(x).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    function nameRe(names) {
        const multi = names.filter(n => /\s/.test(n)), single = names.filter(n => !/\s/.test(n));
        const parts = [];
        if (multi.length) parts.push(new RegExp("(^|[^\\w])(" + multi.map(reEsc).join("|") + ")(?![\\w])", "gi"));
        if (single.length) parts.push(new RegExp("(^|[^\\w])(" + single.map(reEsc).join("|") + ")(?![\\w])", "g"));
        return parts;
    }
    let nameCache = null, nameKey = "";
    function redact(o, names) {
        const key = names.length + ":" + names[0];
        if (key !== nameKey) {
            nameCache = nameRe(names);
            nameKey = key;
        }
        const res = nameCache, hit = t => res.some(r => {
            r.lastIndex = 0;
            return r.test(String(t || ""));
        });
        const fix = t => res.reduce((x, r) => x.replace(r, "$1someone"), String(t));
        for (const k of [ "label", "why", "caption", "statusLine", "embedCaption" ]) if (typeof o[k] === "string" && hit(o[k])) o[k] = fix(o[k]);
        for (const k of [ "docs", "refs", "cases" ]) if (Array.isArray(o[k])) {
            o[k] = o[k].filter(d => !hit(d.label) && !hit(d.title));
            if (!o[k].length) delete o[k];
        }
        if (o.case && hit(o.case.title)) delete o.case;
        if (o.paper && hit(o.paper.title)) delete o.paper;
        return o;
    }
    const VERD = [ "helped", "no effect", "hurt", "confounded", "unmeasured" ], DAY = /^\d{4}-\d{2}-\d{2}$/;
    function nsPublicStory(s) {
        if (!s || typeof s !== "object") return null;
        const m = s.metric && typeof s.metric === "object" && [ "vision", "repeats", "score", "values" ].includes(s.metric.kind) ? s.metric : null;
        const metric = m ? {
            kind: m.kind,
            label: m.kind === "repeats" ? "repeated complaints and catches, per day" : m.kind === "vision" ? "repeats of the vision, per week" : m.kind === "score" ? "improve-loop score" : "measured result",
            points: (Array.isArray(m.points) ? m.points : []).filter(p => p && DAY.test(p.t) && Number.isFinite(+p.v)).slice(-30).map(p => ({
                t: p.t,
                v: +p.v
            })),
            ...DAY.test(m.partial || "") ? {
                partial: m.partial
            } : {},
            ...typeof m.note === "string" && /^Talk counted from \d\d-\d\d, typed chat from \d\d-\d\d: earlier weeks undercount$/.test(m.note) ? {
                note: m.note
            } : {},
            ...(m.kind === "vision" || m.kind === "repeats") && Array.isArray(m.perPoint) ? {
                perPoint: m.perPoint.slice(0, 12).map(p => ({
                    text: strip(p && p.text).slice(0, 200),
                    weekly: (Array.isArray(p && p.weekly) ? p.weekly : []).slice(-30).map(v => +v || 0)
                }))
            } : {}
        } : null;
        const tries = (Array.isArray(s.tries) ? s.tries : []).filter(t => t && DAY.test(t.d) && VERD.includes(t.v)).slice(-80).map(t => ({
            d: t.d,
            v: t.v
        }));
        const st = s.stage && Number.isInteger(s.stage.at) && s.stage.at >= 0 && s.stage.at < 6 ? {
            at: s.stage.at,
            round: Number.isInteger(s.stage.round) ? s.stage.round : 1
        } : null;
        return metric || tries.length || st ? {
            metric: metric,
            tries: tries,
            stage: st
        } : null;
    }
    root.nsPublicStory = nsPublicStory;
    function nodeOut(n, extra) {
        const o = {
            id: n.id,
            label: n.label,
            status: n.status === "waiting" && !n.liveWork ? "idle" : pubStatus(n.status)
        };
        for (const k of PUBLIC_FIELDS) if (n[k] !== undefined) o[k] = clone(n[k]);
        const pv = n.public && typeof n.public === "object" ? n.public : {};
        for (const k of OVERRIDABLE) if (k in pv) o[k] = clone(pv[k]);
        if (o.goalStory !== undefined) {
            const gs = nsPublicStory(o.goalStory);
            if (gs) o.goalStory = gs; else delete o.goalStory;
        }
        if (n.planned || n.status === "planned") o.planned = true;
        if (n.stage === "plan" || n.stage === "active") o.stage = n.stage;
        if (n.pin) o.pin = true;
        if (n.find) o.find = true;
        if (n.kind === "ptype") {
            o.kind = "ptype";
            o.count = n.count || (n.people || []).length || 0;
        }
        const repos = nsPublicRepos(n.codeRepos);
        if (repos) o.codeRepos = repos;
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
                    c.label = String(c.label || "").replace(/\s*·\s*\d+\s*$/, "");
                    c.caption = ls.length ? `People in ${ls.join(", ").replace(/, ([^,]*)$/, " and $1")} I learn from.` : "People I learn from.";
                    c.why = "People I learn from.";
                    delete c.statusLine;
                    delete c.count;
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
        const kidsOf = {};
        for (const [k, v] of Object.entries(up)) (kidsOf[v] = kidsOf[v] || new Set).add(k);
        const pubOf = id => {
            let q = id, prev = null, d = 0;
            while (q && d < 10) {
                if (ids.has(q)) {
                    if (prev && q !== id) {
                        const k = kidsOf[q];
                        if (k && k.size === 1 && !ids.has(prev)) return hubId;
                    }
                    return q;
                }
                prev = q;
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
        if (Array.isArray(opts.privateNames) && opts.privateNames.length) projects.forEach(p => [ p, ...p.children ].forEach(o => redact(o, opts.privateNames)));
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
    root.nsPublicRepos = nsPublicRepos;
})(typeof window !== "undefined" ? window : globalThis);
