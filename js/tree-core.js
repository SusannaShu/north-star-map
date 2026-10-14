(function(G) {
    const PROMOTE = new Set([ "unique-designs", "robot-skin" ]);
    const INPUTS = "life-inputs";
    const strip = s => String(s == null ? "" : s).replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/\s+/g, " ").trim();
    const clip = (s, n) => {
        s = strip(s);
        return s.length > n ? s.slice(0, n - 1).replace(/[\s,;:.-]+\S*$/, "") + "…" : s;
    };
    const nice = l => {
        const t = strip(l), u = t.replace(/ (HUB|MAP)$/i, "");
        return u.length > 4 ? u : t;
    };
    function index(map) {
        const hub = map.hub && map.hub.id || "north-star", e = {}, P = map.projects || [];
        const ids = new Set(P.map(p => p.id));
        e[hub] = {
            id: hub,
            label: map.hub && map.hub.label || "NORTH STAR",
            up: null
        };
        P.forEach(p => {
            e[p.id] = {
                id: p.id,
                label: p.label,
                up: p.parent && ids.has(p.parent) && p.parent !== p.id ? p.parent : hub,
                node: p,
                parked: !!p.parked
            };
        });
        P.forEach(p => (p.children || []).forEach(c => {
            if (!e[c.id]) e[c.id] = {
                id: c.id,
                label: c.label,
                up: p.id,
                node: c,
                child: true
            };
        }));
        const chain = id => {
            const out = [];
            let x = e[id], g = 0;
            while (x && x.id !== hub && g++ < 14) {
                out.push(x);
                x = e[x.up];
            }
            return out;
        };
        const parked = id => chain(id).some(x => x.parked);
        const under = (id, top) => chain(id).some(x => x.id === top);
        const groupOf = id => {
            const c = chain(id);
            if (!c.length) return null;
            const pr = c.find(x => PROMOTE.has(x.id));
            return (pr || c[c.length - 1]).id;
        };
        const find = raw => {
            if (!raw) return null;
            const k = String(raw).toLowerCase();
            if (e[k]) return k;
            const hit = Object.values(e).find(n => n.label && (n.label.toLowerCase() === k || nice(n.label).toLowerCase() === k));
            return hit ? hit.id : null;
        };
        return {
            hub: hub,
            e: e,
            groupOf: groupOf,
            parked: parked,
            under: under,
            find: find
        };
    }
    function split(text, n = 84) {
        const t = strip(text);
        for (const sep of [ ": ", " — ", " – ", " - ", "; " ]) {
            const i = t.indexOf(sep);
            if (i < 2 || i > (sep === ": " ? 60 : 50)) continue;
            const name = t.slice(0, i).replace(/\s*\([^)]*\)\s*/g, " ").trim(), line = t.slice(i + sep.length).trim();
            if (name && line && !/^(https?|\d+)$/i.test(name)) return {
                name: clip(name, 48),
                line: clip(line, n)
            };
        }
        const m = /^(.{4,48}?) \(([^)]*)\)\s*(.*)$/.exec(t);
        if (m && m[3]) return {
            name: m[1],
            line: clip(m[3], n)
        };
        return {
            name: clip(t, n),
            line: ""
        };
    }
    function build({map: map, workers: workers} = {}) {
        map = map || {};
        const X = index(map), P = map.projects || [];
        const segs = {
            working: new Map,
            waiting: new Map,
            needs: new Map,
            planned: new Map,
            done: new Map
        };
        const seen = {
            working: new Set,
            waiting: new Set,
            needs: new Set,
            planned: new Set,
            done: new Set
        };
        let seq = 0;
        const add = (seg, groupId, item) => {
            const key = (item.name + "|" + item.line).toLowerCase();
            if (seen[seg].has(key)) return;
            seen[seg].add(key);
            item.seq = seq++;
            if (seg === "needs" && item.urgent == null) item.urgent = true;
            const gid = groupId || "other";
            if (!segs[seg].has(gid)) segs[seg].set(gid, {
                id: gid,
                label: gid === "minute" ? "GOT A MINUTE" : X.e[gid] ? nice(X.e[gid].label) : String(gid).replace(/-/g, " ").toUpperCase(),
                items: [],
                ...gid === "minute" ? {
                    minute: true
                } : {}
            });
            segs[seg].get(gid).items.push(item);
        };
        const groupFor = (id, raw) => id && X.groupOf(id) || (raw ? String(raw).toLowerCase() : "other");
        const S = map.situation || {}, T = S.truth;
        for (const w of workers || []) {
            let id = (map.workerAt || {})[w.id] || w.project || null;
            if (id && !X.e[id] && X.e["r:" + w.id]) id = "r:" + w.id;
            if (!id && w.kind === "routine" && X.e["r:" + w.id]) id = "r:" + w.id;
            if (id && !X.e[id]) id = null;
            const mins = w.elapsedSeconds == null ? "" : w.elapsedSeconds < 90 ? `${Math.round(w.elapsedSeconds)}s` : `${Math.round(w.elapsedSeconds / 60)} min`;
            add("working", groupFor(id, "agents"), {
                name: clip(w.label || w.id || "agent", 48),
                line: clip([ w.now || "working", mins ].filter(Boolean).join(" · "), 70),
                open: id,
                kind: "agent",
                live: true
            });
        }
        for (const x of Object.values(X.e)) {
            const n = x.node;
            if (!n || n.status !== "working" || X.parked(x.id) || X.under(x.id, INPUTS) || x.id === INPUTS) continue;
            if (n.kind === "channel") continue;
            add("working", X.groupOf(x.id), {
                name: nice(n.label),
                line: clip(n.statusLine || "", 70),
                open: x.id,
                kind: "dot"
            });
        }
        const named1 = (s, id) => {
            const d = X.find(s.name);
            return d && d !== X.hub ? d : id;
        };
        for (const t of T && T.inProgress || []) {
            const s = split(t.text), id = named1(s, X.find(t.project));
            add("working", groupFor(id, t.project), {
                ...s,
                open: id,
                kind: "progress"
            });
        }
        const people = (Array.isArray(map.people) ? map.people : []).filter(p => p && p.name);
        const words = p => strip(p.name + " " + (p.org || "")).toLowerCase().split(/[^a-zÀ-ɏ]+/).filter(w => w.length > 3 && !/^(staff|labs?|team|university|the)$/.test(w));
        const progText = (T && T.inProgress || []).map(t => strip(t.text).toLowerCase());
        const due = p => p.nextDue || "9999";
        for (const p of people.filter(p => p.state === "them").sort((a, b) => due(a).localeCompare(due(b)))) {
            if (words(p).some(w => progText.some(t => t.includes(w)))) continue;
            const id = X.find(p.project);
            add("waiting", groupFor(id, p.project), {
                name: p.name,
                line: clip(p.line || "waiting on them", 64),
                open: id,
                kind: "person"
            });
        }
        const needsText = [];
        const truthNeeds = T ? T.needsYou || [] : (S.needs || []).map(n => ({
            project: n.id,
            text: (n.label ? n.label + ": " : "") + n.text
        }));
        for (const t of truthNeeds) {
            if (!t || t.project === "inbox" || t.id === "inbox") continue;
            const s = split(t.text), id = named1(s, X.find(t.project || t.id));
            needsText.push(strip(t.text).toLowerCase());
            add("needs", groupFor(id, t.project), {
                ...s,
                open: id,
                kind: "need",
                link: t.link || null
            });
        }
        const named = p => words(p).some(w => needsText.some(t => t.includes(w)));
        for (const p of people.filter(p => p.state === "you" || p.state === "check")) {
            if (named(p)) continue;
            const id = X.find(p.project);
            add("needs", groupFor(id, p.project), {
                name: p.name,
                line: clip(p.owes || p.line || (p.state === "check" ? "check the thread" : "your move"), 70),
                open: id,
                kind: "person"
            });
        }
        for (const x of Object.values(X.e)) {
            const n = x.node;
            if (!n || n.status !== "needs-you" || X.parked(x.id) || String(x.id).startsWith("r:")) continue;
            if (x.child ? !(n.kind === "channel" || n.ask || n.statusLine) : !n.ask) continue;
            add("needs", X.groupOf(x.id), {
                name: nice(n.label),
                line: clip(n.ask || n.statusLine || "needs a look", 70),
                open: x.id,
                kind: "dot"
            });
        }
        for (const p of P) {
            const q = (p.asks || []).slice().sort((a, b) => String(b.createdAt || "").localeCompare(String(a.createdAt || "")));
            if (!q.length || X.parked(p.id)) continue;
            add("needs", X.groupOf(p.id), {
                name: `${q.length} question${q.length === 1 ? "" : "s"}`,
                line: clip("newest: " + q[0].title, 76),
                open: p.id,
                kind: "inbox",
                inbox: p.id,
                n: q.length
            });
        }
        const later = map.later || null;
        for (const l of later && later.items || []) {
            const s = split(l.text, 84);
            const act = l.action || {
                kind: l.dot ? "dot" : "none",
                target: l.dot || null,
                label: l.dot ? "Open the dot" : "Mark done"
            };
            const WH = {
                home: "at home",
                mac: "at a Mac",
                phone: "on your phone",
                anywhere: "anywhere"
            };
            add("needs", "minute", {
                name: s.name,
                line: [ `~${l.minutes} min`, WH[l.where] || l.where, l.fit === false ? "not here" : "", s.line ].filter(Boolean).join(" · "),
                open: l.dot && X.e[l.dot] ? l.dot : null,
                kind: "minute",
                urgent: false,
                minutes: l.minutes,
                where: l.where,
                fit: l.fit !== false,
                act: act,
                laterId: l.id,
                why: l.why || ""
            });
        }
        for (const x of Object.values(X.e)) {
            const n = x.node;
            if (!n || X.parked(x.id)) continue;
            if (!(n.waitingOn || n.status === "waiting") || n.status === "working" || n.status === "needs-you") continue;
            if (n.kind === "ptype") continue;
            add("waiting", X.groupOf(x.id), {
                name: nice(n.label),
                line: clip(n.waitingOn ? "waiting on " + n.waitingOn : n.statusLine || "waiting on someone else", 70),
                open: x.id,
                kind: "wait"
            });
        }
        for (const x of Object.values(X.e)) {
            const n = x.node;
            if (!n || X.parked(x.id)) continue;
            const plan = n.stage === "plan", planned = n.status === "planned";
            if (!plan && !planned) continue;
            if (n.status === "working" || n.status === "needs-you" || n.status === "done" || n.status === "waiting" || n.waitingOn) continue;
            add("planned", X.groupOf(x.id), {
                name: nice(n.label),
                line: clip(n.statusLine || n.why || "", 70),
                open: x.id,
                kind: plan ? "plan" : "planned"
            });
        }
        const WEEK = 7 * 864e5, now = Date.now();
        const dday = at => {
            const d = new Date(at);
            return isNaN(d) ? "" : d.toLocaleDateString("en-US", {
                weekday: "short",
                month: "numeric",
                day: "numeric"
            });
        };
        const doneRows = [];
        for (const x of Object.values(X.e)) {
            const n = x.node;
            if (!n || n.stage !== "done") continue;
            const at = Date.parse(n.doneAt || "");
            if (!(at > now - WEEK)) continue;
            doneRows.push({
                g: X.groupOf(x.id),
                it: {
                    name: nice(n.label),
                    line: clip("done " + dday(at) + (n.statusLine ? " -- " + strip(n.statusLine).replace(/^done( \S+)?( · )?/, "") : ""), 70).replace(/ -- $/, ""),
                    open: x.id,
                    kind: "done",
                    at: n.doneAt
                }
            });
        }
        for (const d of map.doneWeek || []) {
            const at = Date.parse(d.at || "");
            if (!(at > now - WEEK)) continue;
            const id = X.find(d.project);
            doneRows.push({
                g: groupFor(id, d.project),
                it: {
                    name: clip(d.name, 48),
                    line: clip(`${d.line || "closed"} ${dday(at)}`, 70),
                    open: id,
                    kind: d.kind === "answered" ? "answered" : "closed",
                    at: d.at
                }
            });
        }
        doneRows.sort((a, b) => String(b.it.at).localeCompare(String(a.it.at))).forEach(r => add("done", r.g, r.it));
        const first = g => Math.min(...g.items.map(i => i.seq));
        const seg = (id, label) => {
            const groups = [ ...segs[id].values() ].sort(id === "planned" ? (a, b) => b.items.length - a.items.length || a.label.localeCompare(b.label) : (a, b) => !!a.minute - !!b.minute || first(a) - first(b));
            groups.forEach(g => g.items.sort((a, b) => (a.kind === "inbox") - (b.kind === "inbox") || a.seq - b.seq));
            return {
                id: id,
                label: label,
                count: groups.reduce((s, g) => s + g.items.length, 0),
                groups: groups
            };
        };
        const segments = [ seg("needs", "NEEDS YOU"), seg("planned", "PLANNED, NOT ACTED ON"), seg("working", "WORKING"), seg("waiting", "WAITING ON THEM"), seg("done", "DONE THIS WEEK") ];
        const by = id => segments.find(x => x.id === id);
        return {
            at: (new Date).toISOString(),
            situationAt: T ? T.generatedAt : null,
            verified: !!T,
            inboxOpen: map.inboxOpen || 0,
            counts: {
                working: by("working").count,
                waiting: by("waiting").count,
                needs: by("needs").count,
                planned: by("planned").count,
                done: by("done").count,
                urgent: by("needs").groups.reduce((n, g) => n + g.items.filter(i => i.urgent && i.kind !== "inbox").length, 0),
                minute: later && later.count || 0,
                minuteMinutes: later && later.minutes || 0
            },
            mode: later && later.mode || "unknown",
            modeLine: later && later.line || "",
            segments: segments
        };
    }
    function spoken(tree, {top: top = 3} = {}) {
        const by = id => tree.segments.find(x => x.id === id), W = by("working"), Wt = by("waiting"), N = by("needs"), Pl = by("planned");
        const items = s => s.groups.flatMap(g => g.items.map(i => ({
            ...i,
            group: g.label
        }))).sort((a, b) => a.seq - b.seq);
        const title = s => s.split(" ").map(w => w.charAt(0) + w.slice(1).toLowerCase()).join(" ");
        const say = i => `${i.name}${i.line ? " -- " + clip(i.line, 60) : ""} (${title(i.group)})`;
        const parts = [];
        const live = items(W).filter(i => i.live), moving = items(W).filter(i => !i.live), waiting = items(Wt).filter(i => i.kind === "person"), waitDots = items(Wt).filter(i => i.kind !== "person");
        parts.push(live.length ? `${live.length} agent${live.length === 1 ? "" : "s"} running now: ${live.slice(0, 2).map(i => i.name).join(", ")}.` : "No agents running right now.");
        if (moving.length) parts.push(`In motion: ${moving.slice(0, top).map(say).join("; ")}${moving.length > top ? `; and ${moving.length - top} more` : ""}.`);
        if (waitDots.length) parts.push(`Waiting on others: ${waitDots.slice(0, 3).map(i => `${i.name.charAt(0) + i.name.slice(1).toLowerCase()} -- ${i.line}`).join("; ")}.`);
        if (waiting.length) parts.push(`Waiting on ${waiting.length} ${waiting.length === 1 ? "person" : "people"} to reply (${waiting.slice(0, 3).map(i => i.name).join(", ")}${waiting.length > 3 ? ", ..." : ""}).`);
        const need = items(N).filter(i => i.kind !== "inbox" && i.urgent), inbox = items(N).filter(i => i.kind === "inbox"), minute = items(N).filter(i => !i.urgent);
        if (need.length) parts.push(`${need.length} need${need.length === 1 ? "s" : ""} you. Top: ${need.slice(0, top).map(say).join("; ")}.`);
        if (minute.length) parts.push(`${minute.length} can wait for a spare minute (about ${minute.reduce((s, i) => s + (i.minutes || 0), 0)} min in all)${minute[0].fit ? `, quickest fit now: ${minute[0].name} (~${minute[0].minutes} min)` : ""}.`);
        const q = inbox.reduce((s, i) => s + (i.n || 0), 0);
        if (q) parts.push(`${q} questions in the inbox, most in ${title(inbox.slice().sort((a, b) => b.n - a.n)[0].group)}.`);
        if (Pl.count) parts.push(`${Pl.count} planned and not acted on, the biggest pile in ${title(Pl.groups[0].label)} (${Pl.groups[0].items.length}).`);
        const D = by("done"), day = d => new Date(d).toLocaleDateString("en-CA");
        const today = D ? items(D).filter(i => i.at && day(i.at) === day(Date.now())) : [];
        if (today.length) parts.push(`Done today: ${today.slice(0, top).map(i => i.name.charAt(0) + i.name.slice(1).toLowerCase()).join(", ")}${today.length > top ? `, and ${today.length - top} more` : ""}.`);
        return parts.join(" ");
    }
    function openNow(tree, {n: n = 2} = {}) {
        const by = id => tree.segments.find(x => x.id === id), N = by("needs"), Pl = by("planned");
        const all = N.groups.flatMap(g => g.items.map(i => ({
            ...i,
            group: g.label
        }))).sort((a, b) => a.seq - b.seq);
        const urgent = all.filter(i => i.urgent && i.kind !== "inbox"), minute = all.filter(i => !i.urgent);
        const pick = [ urgent[0], minute.find(i => i.fit) || urgent[1] ].filter(Boolean).slice(0, n);
        const title = s => s.split(" ").map(w => w.charAt(0) + w.slice(1).toLowerCase()).join(" ");
        const one = i => i.urgent ? `${i.name}${i.line ? " -- " + clip(i.line, 60) : ""} (${title(i.group)})` : `${i.name}, about ${i.minutes} minute${i.minutes === 1 ? "" : "s"}${i.act && i.act.kind !== "none" ? " -- I can open it now" : ""}`;
        const say = `${urgent.length} urgent, ${minute.length} for a spare minute, ${Pl.count} planned and not started.` + (pick.length ? ` Top: ${pick.map(one).join("; then ")}.` : " Nothing is waiting on you.");
        return {
            say: say,
            top: pick.map(i => ({
                name: i.name,
                line: i.line,
                urgent: !!i.urgent,
                minutes: i.minutes || null,
                open: i.open || null,
                act: i.act || null,
                laterId: i.laterId || null
            })),
            counts: {
                urgent: urgent.length,
                minute: minute.length,
                planned: Pl.count
            }
        };
    }
    G.NSTree = {
        build: build,
        spoken: spoken,
        openNow: openNow,
        split: split,
        PROMOTE: [ ...PROMOTE ]
    };
})(typeof globalThis !== "undefined" ? globalThis : window);
