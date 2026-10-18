(function(G) {
    const PROMOTE = new Set([ "unique-designs", "robot-skin" ]);
    const INPUTS = "life-inputs";
    const strip = s => String(s == null ? "" : s).replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/\s+/g, " ").trim();
    const clip = (s, n) => {
        s = strip(s);
        return s.length > n ? s.slice(0, n - 1).replace(/[\s,;:.-]+\S*$/, "") + "…" : s;
    };
    const ago = at => {
        const m = (Date.now() - Date.parse(at)) / 6e4;
        if (!(m >= 0)) return "";
        return m < 60 ? `${Math.max(1, Math.round(m))} min` : m < 36 * 60 ? `${Math.round(m / 60)} h` : `${Math.round(m / 1440)} d`;
    };
    const srcOfWhy = w => /gmail/i.test(w || "") ? "from Gmail" : /imessage/i.test(w || "") ? "from iMessage" : /whatsapp/i.test(w || "") ? "from WhatsApp" : /teams/i.test(w || "") ? "from Teams" : /linkedin/i.test(w || "") ? "from LinkedIn" : "from the sync";
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
    const skey = s => strip(s).toLowerCase().replace(/[^a-z0-9]+/g, " ").trim().slice(0, 40);
    function subjects(map) {
        const title = t => /[a-z]/.test(t) ? t : t.toLowerCase().replace(/\b[a-z]/g, c => c.toUpperCase());
        const out = new Map, put = (name, kind, dot) => {
            const k = skey(name);
            if (k.length >= 3 && !out.has(k)) out.set(k, {
                kind: kind,
                name: title(strip(name)),
                dot: dot || null
            });
        };
        const first = n => {
            const w = strip(n).split(/\s+/);
            return w.length > 1 && w[0].length >= 4 ? w[0] : null;
        };
        const walk = ns => {
            for (const n of ns || []) {
                if (!n) continue;
                if (n.kind === "person" || n.kind === "community" || n.kind === "place") {
                    put(n.label, n.kind, n.id);
                    if (n.kind === "person" && first(n.label)) put(first(n.label), "person", n.id);
                }
                walk(n.children);
            }
        };
        walk(map.projects);
        for (const p of Array.isArray(map.people) ? map.people : []) if (p && p.name) {
            put(p.name, "person", null);
            if (first(p.name)) put(first(p.name), "person", null);
        }
        return out;
    }
    const personish = (name, line) => /^[A-Z][a-z]+(?: [A-Z][a-z'-]+){0,2}$/.test(strip(name)) && /\b(she|he|they|her|his|their)\b/i.test(line || "");
    const WORK = /\b(interview|recruit\w*|hiring|offer letter|offer|job|role|application|apply|resume|portfolio|fellows?(hip)?|phd|admissions?|contract|sign|lease|visa|immigration|uscis|opt|tax|irs|8233|w-?8|invoice|payment|pay|bank|rent|bill|refund|insurance|lab|professor|client|founder|investor|unique designs?|hera selene|nurturebox|flossy|a16z|meta|anthropic|deadline|due|routines?|timers?|watchdog|worker|agent)\b/i;
    const SOCIAL = /\b(hang ?outs?|hang out|hanging out|meet ?ups?|get together|brunch|lunch|dinner|drinks|party|knitting|basketball|ping-?pong|game night|concert|movie|picnic|date night|volunteer(ing)? events?)\b/i;
    const EVENTISH = /^(?:(?:go|going|head|heading)\s+(?:to|out|in\s*to|into|over|back to)\b|(?:attend|attending|join|joining)\s+(?:the|a|an|her|his|their)\b|(?:probably|maybe)\s+(?:skip|skipping|go|going|meet|meeting|see)\b)/i;
    const PERSONAL = /\b(friends?|hang|free (over|this|next|on)|when (you are|you're|she is) free|catch up|text (him|her|them) back|reply to (his|her|their) messages|asked (if|when) you|see you|visit|family|mom|dad|sister|brother)\b/i;
    const URGENT = /\b(urgent|asap|emergency|today|tonight|right now)\b/i;
    function dueToday(text, {now: now, due: due} = {}) {
        const t = strip(text), d = new Date(now == null ? Date.now() : now);
        if (URGENT.test(t)) return true;
        const md = d.toLocaleDateString("en-US", {
            timeZone: "America/New_York",
            month: "numeric",
            day: "numeric"
        });
        if (new RegExp("\\b(?:by|due|on|until|before|mon|tue|wed|thu|fri|sat|sun)\\w*,?\\s+" + md.replace("/", "\\/") + "(?![\\d/])", "i").test(t)) return true;
        const ms = due ? Date.parse(due) : NaN;
        return ms > 0 && ms - d.getTime() < 24 * 36e5;
    }
    const AGENT_KINDS = new Set([ "run", "task", "asked", "inbox", "minute", "said" ]);
    function nonAction(text) {
        const t = strip(text);
        return !WORK.test(t) && (SOCIAL.test(t) || EVENTISH.test(t));
    }
    function weekendOpen(now) {
        const d = new Date(now == null ? Date.now() : now), o = {
            timeZone: "America/New_York"
        };
        const wd = d.toLocaleDateString("en-US", {
            ...o,
            weekday: "short"
        }), h = +d.toLocaleTimeString("en-US", {
            ...o,
            hour: "2-digit",
            hour12: false
        }).slice(0, 2);
        return wd === "Sun" || wd === "Sat" && h >= 8;
    }
    function weekendHeld(text, {now: now, urgent: urgent = false, personal: personal = false} = {}) {
        const t = strip(text);
        if (weekendOpen(now) || urgent || URGENT.test(t) || WORK.test(t)) return false;
        return personal || PERSONAL.test(t) || SOCIAL.test(t);
    }
    let PEOPLE = [];
    const ORG = /\b(inc|llc|corp|labs?|university|college|institute|school|company|startup|team|office|professor|prof|dr|founder|ceo|cto|recruit\w*|hr|research\w*|studio|org|foundation|museum|gallery|editor|journal|conference|program)\b/i;
    const HEALTH = /\b(dentist|dental|doctor|clinic|eye exam|optometrist|prescription|foot doctor|podiatr\w*|injury|therapy|therapist|physio|medication|vaccine|blood test)\b/i;
    const CHAT = /\b(imessage|whatsapp|wechat|instagram|discord|texted|sms|dm)\b/i;
    const SOCIAL_REPLY = /\b(reply to|text|call|tell (him|her|them)|asks? (if|when|whether)|wants to (meet|see|hang)|bad person|miss(es)? you|birthday|date|dating|crush|hinge|tinder)\b/i;
    const WORKISH = /\b(access|catalog(ue)?|documents?|files?|drive|portal|account|meeting|playground|model|demo|paper|dataset|data|slides?|deck|draft|review|feedback|intro|referral|zoom|teams|linkedin|gmail|e-?mail)\b/i;
    const TRULY_URGENT = /\b(urgent|asap|emergency|hospital|911|accident|lost|stranded)\b/i;
    const pkey = s => strip(s).toLowerCase();
    function peopleKinds(people) {
        const out = [];
        for (const p of people || []) {
            if (!p || !p.name) continue;
            const rel = p.project === "community" || /\b(friend|family|her people|dating|knitting|street)\b/i.test(p.group || p.relation || "") ? "personal" : "work";
            const w = strip(p.name).split(/\s+/);
            out.push([ pkey(p.name), rel, p.name ]);
            if (w.length > 1 && w[0].length >= 4) out.push([ pkey(w[0]), rel, p.name ]);
        }
        return out;
    }
    const wordIn = (t, k) => k && new RegExp("(^|[^a-z])" + k.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "([^a-z]|$)", "i").test(t);
    function classify(text, o = {}) {
        const t = strip(text), src = o.sources || (o.src ? [ o.src ] : []), P = peopleKinds(o.people || PEOPLE);
        const named = P.filter(([k]) => wordIn(t, k) || o.subject && pkey(o.subject) === k);
        const work = named.find(n => n[1] === "work"), pers = named.find(n => n[1] === "personal");
        if (work) return {
            kind: "work",
            why: `${work[2]} is work (outreach / job)`,
            who: work[2]
        };
        if (src.includes("talk-asks") || o.kind === "asked") return {
            kind: "agent",
            why: "her ask to Mittens / the agents"
        };
        if (/^(run|task|agent)$/.test(o.kind || "") || src.length && src.every(s => s === "run")) return {
            kind: "agent",
            why: "an agent run"
        };
        if (pers && !WORK.test(t) && !ORG.test(t)) return {
            kind: "personal",
            why: `${pers[2]} is personal (friend / family)`,
            who: pers[2]
        };
        if (WORK.test(t) || ORG.test(t) || WORKISH.test(t)) return {
            kind: "work",
            why: "a company, role or work word"
        };
        if (HEALTH.test(t)) return {
            kind: "health",
            why: "health"
        };
        if (SOCIAL.test(t) || PERSONAL.test(t)) return {
            kind: "personal",
            why: "a social / personal thing"
        };
        if (SOCIAL_REPLY.test(t) && (CHAT.test(t) || o.subject && o.subjectKind === "person")) return {
            kind: "personal",
            why: "a social reply on a chat app"
        };
        return {
            kind: "work",
            why: "default"
        };
    }
    const isPersonal = (text, o = {}) => classify(text, o).kind === "personal" && !TRULY_URGENT.test(strip(text));
    function notAction(text, o = {}) {
        return nonAction(text) ? "event" : o.personal && !TRULY_URGENT.test(strip(text)) || isPersonal(text, o) ? "personal" : null;
    }
    const isSubject = (S, name, line) => S.get(skey(name)) || (personish(name, line) ? {
        kind: "person",
        name: strip(name)
    } : null);
    function split(text, n = 84) {
        const t = strip(text);
        for (const sep of [ ": ", " -- ", " — ", " – ", " - ", "; " ]) {
            const i = t.indexOf(sep);
            if (i < 2 || i > (sep === ": " ? 60 : 50)) continue;
            const name = t.slice(0, i).replace(/\s*\([^)]*\)\s*/g, " ").trim(), line = t.slice(i + sep.length).trim();
            if (sep === ": " && /^(review|read|pick|check|decide)$/i.test(name)) {
                const r = split(line, n);
                return {
                    name: clip(`${name}: ${r.name}`, 60),
                    line: r.line
                };
            }
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
    function build({map: map, workers: workers, now: NOW} = {}) {
        map = map || {};
        const X = index(map), P = map.projects || [], SUBJ = subjects(map), held = [];
        if (Array.isArray(map.people) && map.people.length) PEOPLE = map.people;
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
            if (item.src && !item.meta) item.meta = item.src + (item.since && ago(item.since) ? " · " + ago(item.since) : "");
            if (seg === "needs" && item.urgent == null) item.urgent = !AGENT_KINDS.has(item.kind) && dueToday(`${item.name} ${item.line || ""}`, {
                due: item.due
            });
            const gid = groupId || "other";
            if (!segs[seg].has(gid)) segs[seg].set(gid, {
                id: gid,
                label: gid === "minute" ? "GOT A MINUTE" : gid === "review" ? "TO REVIEW" : gid === "asked" ? "YOU ASKED, NOT DONE" : gid === "inbound" ? "FROM OUTSIDE" : gid === "told" ? "MITTENS TOLD YOU" : X.e[gid] ? nice(X.e[gid].label) : String(gid).replace(/-/g, " ").toUpperCase(),
                items: [],
                ...gid === "minute" || gid === "review" ? {
                    minute: true
                } : {},
                ...gid === "review" ? {
                    review: true
                } : {}
            });
            segs[seg].get(gid).items.push(item);
        };
        const groupFor = (id, raw) => id && X.groupOf(id) || (raw ? String(raw).toLowerCase() : "other");
        const S = map.situation || {}, T = S.truth;
        const liveTasks = new Set;
        const tasks = Array.isArray(map.tasks) ? map.tasks : [], taskName = {};
        const taskDot = {};
        for (const t of tasks) {
            taskName[t.id] = t.name;
            if (t.dot) taskDot[t.id] = t.dot;
        }
        const qTask = new Set((Array.isArray(map.questions) ? map.questions : []).map(q => q.task).filter(Boolean));
        for (const w of workers || []) {
            if (w.kind === "task" && qTask.has(w.id)) {
                liveTasks.add(w.id);
                continue;
            }
            let id = w.kind === "task" && taskDot[w.id] || (map.workerAt || {})[w.id] || w.project || null;
            if (id && !X.e[id] && X.e["r:" + w.id]) id = "r:" + w.id;
            if (!id && w.kind === "routine" && X.e["r:" + w.id]) id = "r:" + w.id;
            if (id && !X.e[id]) id = null;
            const mins = w.elapsedSeconds == null ? "" : w.elapsedSeconds < 90 ? `${Math.round(w.elapsedSeconds)}s` : `${Math.round(w.elapsedSeconds / 60)} min`;
            if (w.kind === "task") liveTasks.add(w.id);
            add("working", groupFor(id, "agents"), {
                name: clip(w.kind === "task" && taskName[w.id] || w.label || w.id || "agent", 48),
                line: clip([ w.kind === "task" ? w.id : "", w.now || "working", mins ].filter(Boolean).join(" · "), 70),
                open: id,
                kind: "agent",
                live: true,
                taskId: w.kind === "task" ? w.id : undefined
            });
        }
        const tAgo = t => {
            const s = Date.parse(t.startedAt || t.at || "");
            if (!(s > 0)) return "";
            const m = (Date.now() - s) / 6e4;
            return m < 90 ? `${Math.max(1, Math.round(m))} min` : `${Math.round(m / 60)} h`;
        };
        for (const t of tasks) {
            if (liveTasks.has(t.id) || qTask.has(t.id) || !(t.status === "running" || t.status === "queued")) continue;
            const id = t.dot && X.e[t.dot] ? t.dot : null;
            const waitingNow = t.status === "queued" && (t.waitingOn || t.asleep);
            if (waitingNow) {
                add("waiting", "agents-waiting", {
                    name: clip(t.name, 48),
                    line: clip(`${t.id} · ${String(t.waiting || "waiting").split(" -- ")[0]}`, 80),
                    open: id,
                    kind: "task",
                    taskId: t.id,
                    waitingOn: true,
                    asleep: t.asleep || undefined,
                    src: "voice task",
                    since: t.at || null
                });
                continue;
            }
            add("working", t.status === "queued" ? "queued" : groupFor(id, "agents"), {
                name: clip(t.name, 48),
                line: clip(t.status === "queued" ? `${t.id} · ${t.waiting || "next free slot"}` : `${t.id} · ${t.now || "working"} · ${tAgo(t)}`, 80),
                open: id,
                kind: "task",
                taskId: t.id,
                queued: t.status === "queued",
                src: "voice task",
                since: t.at || null
            });
        }
        for (const x of Object.values(X.e)) {
            const n = x.node;
            if (!n || n.status !== "working" || X.parked(x.id) || X.under(x.id, INPUTS) || x.id === INPUTS) continue;
            if (n.kind === "channel" || n.kind === "person" || n.kind === "community" || n.kind === "place") continue;
            if (n.kind !== "routine" && !String(x.id).startsWith("r:") && nonAction(`${n.label} ${n.statusLine || ""}`) && !WORK.test(n.label)) continue;
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
            const s = split(t.text), id = named1(s, X.find(t.project)), who = isSubject(SUBJ, s.name, s.line);
            {
                const why = notAction(t.text, {
                    now: NOW,
                    subject: who && who.name,
                    subjectKind: who && who.kind
                });
                if (why) {
                    held.push({
                        name: strip(t.text),
                        why: why,
                        src: "inProgress",
                        who: who ? who.name : null
                    });
                    continue;
                }
            }
            if (who && s.line) {
                add("waiting", groupFor(id, t.project), {
                    name: clip(s.line, 60),
                    line: `with ${who.name}`,
                    open: who.dot || id,
                    kind: "progress",
                    subject: who.name,
                    src: "from the sync",
                    since: t.since || null
                });
                continue;
            }
            add("working", groupFor(id, t.project), {
                ...s,
                open: id,
                kind: "progress",
                since: t.since || null
            });
        }
        const people = (Array.isArray(map.people) ? map.people : []).filter(p => p && p.name);
        const lastAt = p => (p.timeline || []).map(t => t && t.at).filter(Boolean).sort().pop() || null;
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
                kind: "person",
                src: "from people",
                since: lastAt(p)
            });
        }
        const needsText = [];
        const truthNeeds = T ? T.needsYou || [] : (S.needs || []).map(n => ({
            project: n.id,
            text: (n.label ? n.label + ": " : "") + n.text
        }));
        for (const t of truthNeeds) {
            if (!t || t.project === "inbox" || t.id === "inbox") continue;
            let s = split(t.text);
            const id = named1(s, X.find(t.project || t.id)), who = isSubject(SUBJ, s.name, "");
            needsText.push(strip(t.text).toLowerCase());
            const why = notAction(t.text, {
                now: NOW,
                subject: who && who.name,
                subjectKind: who && who.kind
            });
            if (why) {
                held.push({
                    name: strip(t.text),
                    why: why,
                    src: "needsYou",
                    who: who ? who.name : null
                });
                continue;
            }
            if (who && s.line) s = {
                name: clip(s.line.charAt(0).toUpperCase() + s.line.slice(1), 70),
                line: `with ${who.name}`
            };
            add("needs", groupFor(id, t.project), {
                ...s,
                open: id,
                kind: "need",
                link: t.link || null,
                src: t.pinned ? "pinned" : srcOfWhy(t.why),
                since: t.since || null
            });
        }
        const named = p => words(p).some(w => needsText.some(t => t.includes(w)));
        for (const p of people.filter(p => p.state === "you" || p.state === "check")) {
            if (named(p)) continue;
            const id = X.find(p.project);
            if (p.project === "community" || notAction(`${p.name} ${p.owes || ""} ${p.line || ""}`, {
                now: NOW
            })) {
                held.push({
                    name: p.name,
                    line: strip(p.owes || p.line || ""),
                    why: "personal",
                    src: "people",
                    who: p.name
                });
                continue;
            }
            const owe = strip(p.owes || p.line || "") || (p.state === "check" ? "check the thread" : "your move");
            add("needs", groupFor(id, p.project), {
                name: clip(/^(your move|check the thread)$/.test(owe) ? `Reply to ${p.name}` : owe.charAt(0).toUpperCase() + owe.slice(1), 70),
                line: `with ${p.name}${p.state === "check" ? " · they replied" : ""}`,
                open: id,
                kind: "person",
                subject: p.name,
                src: "from people",
                since: lastAt(p)
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
        const QS = Array.isArray(map.questions) ? map.questions : null;
        const tById = {};
        for (const t of tasks) tById[t.id] = t;
        const qWhen = at => at ? new Date(at).toLocaleTimeString("en-US", {
            hour: "numeric",
            minute: "2-digit",
            timeZone: "America/New_York"
        }).toLowerCase() : "";
        for (const q of QS || []) {
            const id = q.dot && X.e[q.dot] ? q.dot : X.find(q.project) || null, g = id ? X.groupOf(id) : "asked";
            const base = {
                open: id,
                qid: q.id,
                rid: q.id,
                options: q.options || null,
                need: q.need || "yesno",
                src: q.from ? "asked by " + q.from : "asked",
                since: q.createdAt || null
            };
            const title = clip(q.title, 70), what = clip(q.body || "", 110);
            if (q.status === "open") {
                const snoozed = q.later && Date.parse(q.later) > Date.now();
                add("needs", g || "asked", {
                    ...base,
                    name: title,
                    line: snoozed ? `later -- back at ${qWhen(q.later)}${what ? " · " + what : ""}` : what,
                    kind: "question",
                    status: "open",
                    urgent: !snoozed && dueToday(`${title} ${what}`),
                    later: q.later || undefined
                });
                continue;
            }
            const t = q.task && tById[q.task], ans = clip(q.answer || q.status, 40), told = `you said "${ans}" ${qWhen(q.answeredAt)}`;
            const asker = /^T\d+$/.test(q.from || "") ? tById[q.from] || {
                id: q.from,
                status: "done"
            } : null;
            if (q.task && !t || !q.task && asker && !(asker.status === "running" || asker.status === "queued")) continue;
            if (t && t.status === "queued" && (t.waitingOn || t.asleep)) {
                add("waiting", "agents-waiting", {
                    ...base,
                    name: title,
                    line: clip(`${told} · ${t.id} · ${String(t.waiting || "waiting").split(" -- ")[0]}`, 96),
                    kind: "question",
                    status: "waiting",
                    taskId: t.id,
                    waitingOn: true,
                    asleep: t.asleep || undefined,
                    since: q.answeredAt
                });
                continue;
            }
            if (t && (t.status === "running" || t.status === "queued")) add("working", g || "agents", {
                ...base,
                name: title,
                line: clip(`${told} · ${t.id} ${t.status === "queued" ? "queued" : t.now || "working"}`, 96),
                kind: "question",
                status: t.status === "queued" ? "queued" : "working",
                taskId: t.id,
                queued: t.status === "queued",
                since: q.answeredAt,
                live: liveTasks.has(t.id) || undefined
            }); else if (t && t.status === "stopped") add("needs", "asked", {
                ...base,
                name: title,
                line: clip(`${told} · ${t.id} stopped before it finished`, 96),
                kind: "task",
                taskId: t.id,
                status: "stopped",
                since: t.endedAt || q.answeredAt
            }); else if (t || q.applied || q.status === "dismissed" || !(q.need || q.onYes)) {} else add("working", g || "agents", {
                ...base,
                name: title,
                line: clip(`${told} · ${q.from || "the lane"} picks it up at its next run`, 96),
                kind: "question",
                status: "queued",
                queued: true,
                since: q.answeredAt
            });
        }
        for (const p of QS ? [] : P) {
            const q = (p.asks || []).slice().sort((a, b) => String(b.createdAt || "").localeCompare(String(a.createdAt || "")));
            if (!q.length || X.parked(p.id)) continue;
            add("needs", X.groupOf(p.id), {
                name: `${q.length} question${q.length === 1 ? "" : "s"}`,
                line: clip("newest: " + q[0].title, 76),
                open: p.id,
                kind: "inbox",
                inbox: p.id,
                n: q.length,
                src: q[0].from ? "asked by " + q[0].from : "inbox",
                since: q[0].createdAt || null
            });
        }
        for (const t of map.triage || []) {
            const when = t.at ? new Date(t.at).toLocaleTimeString("en-US", {
                hour: "numeric",
                minute: "2-digit",
                timeZone: "America/New_York"
            }).toLowerCase() : "";
            if (isPersonal(`Reply to ${t.who} (${t.label}) ${t.wants || ""}`, {
                subject: t.who,
                subjectKind: "person"
            })) {
                held.push({
                    name: `Reply to ${t.who}`,
                    line: strip(t.wants || ""),
                    why: "personal",
                    src: "triage",
                    who: t.who
                });
                continue;
            }
            if (t.status === "waiting") {
                add("waiting", "inbound", {
                    name: clip(`${t.who} (${t.label})`, 48),
                    line: clip([ t.wants, t.waitingOn ].filter(Boolean).join(" · "), 96),
                    open: X.e["comms-triage"] ? "comms-triage" : X.e.comms ? "comms" : null,
                    kind: "inbound",
                    triageId: t.id,
                    status: "waiting",
                    src: "from " + t.label,
                    since: t.at || null
                });
                continue;
            }
            const live = t.cls === "urgent" && (Date.now() - Date.parse(t.at || 0) < 12 * 36e5 || dueToday("", {
                due: t.deadline
            }));
            add("needs", "inbound", {
                name: clip(`Reply to ${t.who} (${t.label})`, 56),
                line: clip([ live ? "URGENT" : "", t.wants, t.drafted ? "draft ready" : "", when ].filter(Boolean).join(" · "), 96),
                open: X.e["comms-triage"] ? "comms-triage" : X.e.comms ? "comms" : null,
                kind: "inbound",
                urgent: live,
                triageId: t.id,
                src: "from " + t.label,
                since: t.at || null
            });
        }
        for (const a of (map.asks || []).filter(a => a.status === "open" || a.status === "blocked")) {
            const when = new Date(a.at).toLocaleTimeString("en-US", {
                hour: "numeric",
                minute: "2-digit",
                timeZone: "America/New_York"
            }).toLowerCase();
            add("needs", "asked", {
                name: clip(a.text, 60),
                line: clip(a.status === "blocked" ? `asked ${when} · blocked: ${a.why || "a worker could not do it"}` : `asked ${when} · nobody on it yet${a.raised ? " · Mittens raised it" : ""}`, 90),
                open: "mittens",
                kind: "asked",
                askId: a.id,
                src: "asked in Talk",
                since: a.at
            });
        }
        for (const t of tasks.filter(t => t.status === "stopped" && !qTask.has(t.id))) {
            add("needs", "asked", {
                name: clip(t.name, 60),
                line: clip(`${t.id} · stopped before it finished${t.result ? ": " + t.result : ""}`, 90),
                open: t.dot && X.e[t.dot] ? t.dot : "mittens",
                kind: "task",
                taskId: t.id,
                src: "voice task",
                since: t.endedAt || t.at || null
            });
        }
        for (const x of Object.values(X.e)) {
            const n = x.node;
            if (!n || !String(x.id).startsWith("r:") || n.status !== "needs-you" || X.parked(x.id)) continue;
            const b = (n.blocked || []).map(strip).filter(Boolean);
            add("needs", X.groupOf(x.id), {
                name: nice(n.label),
                line: clip(b.length ? b[0] + (b.length > 1 ? ` (+${b.length - 1} more)` : "") : n.statusLine || "the last run needs a look", 90),
                open: x.id,
                kind: "run",
                src: "routine run",
                since: n.run && n.run.endedAt ? new Date(n.run.endedAt).toISOString() : null
            });
        }
        const runs = (Array.isArray(map.runs) ? map.runs : []).filter(r => !X.e["r:" + r.routine]);
        for (const r of runs.filter(r => /^(blocked|failed|limit)$/.test(r.status))) {
            add("needs", "routines", {
                name: r.routine,
                line: clip(`last run ${r.status}${r.blocked && r.blocked.length ? ": " + r.blocked[0] : r.note ? ": " + r.note : ""}`, 90),
                open: null,
                kind: "run",
                src: "routine run",
                since: r.at
            });
        }
        const later = map.later || null;
        const dueWord = d => {
            const t = Date.parse(d);
            if (!(t > 0)) return "";
            const o = {
                timeZone: "America/New_York"
            };
            const day = new Date(t).toLocaleDateString("en-CA", o), today = (new Date).toLocaleDateString("en-CA", o), tmw = new Date(Date.now() + 864e5).toLocaleDateString("en-CA", o);
            const hm = new Date(t).toLocaleTimeString("en-US", {
                ...o,
                hour: "numeric",
                minute: "2-digit"
            }).replace(":00", "").toLowerCase();
            return "due " + (day === today ? "today" : day === tmw ? "tomorrow" : new Date(t).toLocaleDateString("en-US", {
                ...o,
                weekday: "short"
            })) + " " + hm;
        };
        for (const l of later && later.items || []) {
            const rv = l.review != null ? l.review : /^(review|read)\s*:/i.test(strip(l.text));
            const s = l.title ? {
                name: clip(l.title, 60),
                line: clip(l.sub || "", 84)
            } : split(rv ? strip(l.text).replace(/^(review|read)\s*:\s*/i, "") : l.text, 84);
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
            add("needs", rv ? "review" : "minute", {
                name: s.name,
                line: [ l.due ? dueWord(l.due) : "", `~${l.minutes} min`, WH[l.where] || l.where, l.fit === false ? "not here" : "", s.line ].filter(Boolean).join(" · "),
                open: l.dot && X.e[l.dot] ? l.dot : null,
                kind: "minute",
                urgent: false,
                minutes: l.minutes,
                where: l.where,
                fit: l.fit !== false,
                act: act,
                laterId: l.id,
                ...rv ? {
                    review: true
                } : {},
                ...l.due ? {
                    due: l.due
                } : {},
                why: l.why || "",
                src: l.from === "calendar" ? "from calendar" : l.from === "at-home" ? "from the home list" : "added",
                since: l.addedAt || null
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
        const inReview = new Set((later && later.items || []).filter(l => l.dot && /^review\b/i.test(strip(l.text))).map(l => l.dot));
        for (const x of Object.values(X.e)) {
            const n = x.node;
            if (!n || X.parked(x.id)) continue;
            if (String(x.id).startsWith("ww-")) continue;
            const plan = n.stage === "plan", planned = n.status === "planned";
            if (!plan && !planned) continue;
            if (n.status === "working" || n.status === "needs-you" || n.status === "done" || n.status === "waiting" || n.waitingOn) continue;
            if (inReview.has(x.id)) continue;
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
        for (const t of tasks.filter(t => t.status === "done" && !qTask.has(t.id))) {
            const at = Date.parse(t.endedAt || "");
            if (!(at > now - WEEK)) continue;
            const id = t.dot && X.e[t.dot] ? t.dot : null;
            doneRows.push({
                g: groupFor(id, "agents"),
                it: {
                    name: clip(t.name, 48),
                    line: clip(`${t.id} · finished ${dday(at)}${t.result ? " -- " + t.result : ""}`, 90),
                    open: id,
                    kind: "task",
                    taskId: t.id,
                    at: t.endedAt
                }
            });
        }
        for (const x of Object.values(X.e)) {
            const n = x.node;
            if (!n || !String(x.id).startsWith("r:") || n.status === "needs-you" || !n.run || !n.run.endedAt) continue;
            const at = Number(n.run.endedAt) || Date.parse(n.run.endedAt);
            if (!(at > now - WEEK)) continue;
            doneRows.push({
                g: X.groupOf(x.id),
                it: {
                    name: nice(n.label),
                    line: clip(`ran ${n.run.status || "ok"} ${dday(at)}`, 70),
                    open: x.id,
                    kind: "run",
                    at: new Date(at).toISOString()
                }
            });
        }
        for (const r of runs.filter(r => !/^(blocked|failed|limit)$/.test(r.status) && (r.n > 1 || /^ended/.test(r.status)))) {
            doneRows.push({
                g: "routines",
                it: {
                    name: r.routine,
                    line: clip(`ran ${r.status} ${dday(Date.parse(r.at))}${r.note ? " -- " + r.note : ""}`, 90),
                    open: null,
                    kind: "run",
                    at: r.at
                }
            });
        }
        const RM = map.triageRemoved;
        if (RM && RM.week > 0) {
            const top = (RM.recent || []).slice(0, 3).map(x => `${x.who} (${x.label})`).join(", ");
            doneRows.push({
                g: "inbound",
                it: {
                    name: `Removed unread: ${RM.week} this week`,
                    line: clip(`scam / spam, never read${top ? " · " + top : ""}`, 90),
                    open: X.e["comms-triage"] ? "comms-triage" : X.e.comms ? "comms" : null,
                    kind: "removed",
                    at: (RM.recent || [])[0]?.at || null
                }
            });
        }
        for (const q of QS || []) {
            if (q.status === "open") continue;
            const t = q.task && tById[q.task], asker = /^T\d+$/.test(q.from || "") && !q.task ? tById[q.from] || {
                status: "done"
            } : null;
            const gone = q.task && !t || asker && !(asker.status === "running" || asker.status === "queued");
            if (!gone && (t ? t.status !== "done" : !(q.applied || q.status === "dismissed" || !(q.need || q.onYes)))) continue;
            const at = t && t.endedAt || q.appliedAt || q.answeredAt;
            if (!(Date.parse(at) > now - WEEK)) continue;
            doneRows.push({
                g: "asked",
                it: {
                    name: clip(q.title, 48),
                    line: clip(`${q.status === "dismissed" ? "dismissed" : `you said "${clip(q.answer || "", 30)}"`}${t ? ` · ${t.id} finished` : q.applied ? " · applied" : ""}`, 90),
                    open: q.dot || null,
                    kind: "answered",
                    qid: q.id,
                    rid: q.id,
                    taskId: t ? t.id : undefined,
                    at: at
                }
            });
        }
        const qIds = new Set((QS || []).map(q => q.id));
        for (const m of Array.isArray(map.said) ? map.said : []) {
            if (m.qid && qIds.has(m.qid) || m.task && tById[m.task]) continue;
            const at = Date.parse(m.at || "");
            if (!(at > now - WEEK)) continue;
            if (m.reply && at > now - 12 * 36e5 && !m.retired && !m.repliedAfter) {
                add("needs", "minute", {
                    name: clip(m.text, 60),
                    line: `Mittens asked ${qWhen(m.at)} · reply in chat`,
                    open: null,
                    kind: "said",
                    rid: m.id,
                    urgent: false,
                    minutes: 1,
                    where: "phone",
                    fit: true,
                    act: {
                        kind: "url",
                        target: "mittens://chat",
                        label: "Reply in chat"
                    },
                    src: "Mittens chat",
                    since: m.at
                });
                continue;
            }
            doneRows.push({
                g: "told",
                it: {
                    name: clip(m.text, 60),
                    line: clip(`told you ${qWhen(m.at)}${m.type ? " · " + m.type.replace(/_/g, " ") : ""}`, 70),
                    open: null,
                    kind: "told",
                    rid: m.id,
                    at: m.at
                }
            });
        }
        doneRows.sort((a, b) => String(b.it.at).localeCompare(String(a.it.at))).forEach(r => add("done", r.g, r.it));
        const first = g => Math.min(...g.items.map(i => i.seq));
        const seg = (id, label) => {
            const groups = [ ...segs[id].values() ].sort(id === "planned" ? (a, b) => b.items.length - a.items.length || a.label.localeCompare(b.label) : (a, b) => !!a.minute - !!b.minute || (a.id === "queued") - (b.id === "queued") || first(a) - first(b));
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
            segments: segments,
            subjects: [ ...SUBJ.keys() ],
            held: held
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
        const need = items(N).filter(i => i.kind !== "inbox" && i.urgent), inbox = items(N).filter(i => i.kind === "inbox"), minute = items(N).filter(i => !i.urgent && (i.kind === "minute" || i.kind === "said"));
        const later = items(N).filter(i => !i.urgent && !AGENT_KINDS.has(i.kind) && i.kind !== "minute");
        if (need.length) parts.push(`${need.length} need${need.length === 1 ? "s" : ""} you. Top: ${need.slice(0, top).map(say).join("; ")}.`);
        if (later.length) parts.push(`${later.length} more need you, not today.`);
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
        const urgent = all.filter(i => i.urgent && i.kind !== "inbox"), minute = all.filter(i => !i.urgent && (i.kind === "minute" || i.kind === "said"));
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
        ago: ago,
        subjects: subjects,
        skey: skey,
        nonAction: nonAction,
        weekendHeld: weekendHeld,
        weekendOpen: weekendOpen,
        notAction: notAction,
        dueToday: dueToday,
        classify: classify,
        isPersonal: isPersonal,
        TRULY_URGENT: TRULY_URGENT,
        PROMOTE: [ ...PROMOTE ]
    };
})(typeof globalThis !== "undefined" ? globalThis : window);
