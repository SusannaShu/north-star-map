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
        const STOPW = new Set([ "the", "and", "for", "with", "your", "from", "into", "of", "to", "a", "an", "in", "on", "my", "her" ]);
        const ltoks = l => strip(l).toLowerCase().replace(/[^a-z0-9]+/g, " ").split(" ").filter(w => w && !STOPW.has(w) && (w.length > 2 || /\d/.test(w)));
        const cand = Object.values(e).filter(x => x.node && !String(x.id).startsWith("r:") && !parked(x.id) && !/^(person|place|community)$/.test(x.node.kind || "") && !chain(x.id).some(c => /(^|-)people$/.test(c.id)) && !/^ww-/.test(x.id) && x.node.stage !== "done" && x.node.status !== "done").map(x => ({
            x: x,
            t: [ ...new Set(ltoks(x.label)) ],
            depth: chain(x.id).length
        }));
        const ldf = new Map;
        for (const c of cand) for (const w of c.t) ldf.set(w, (ldf.get(w) || 0) + 1);
        const rareW = w => (ldf.get(w) || 0) <= 3;
        const said = (seq, t) => {
            for (let i = 0; i + t.length <= seq.length; i++) if (t.every((w, j) => seq[i + j] === w)) return true;
            return false;
        };
        const specific = (text, fallback, link) => {
            const seq = ltoks(text), have = new Set(seq);
            let best = null;
            for (const c of cand) {
                const linked = link && c.x.node.embed && String(link).includes(c.x.node.embed);
                if (!linked && (!c.t.length || c.depth < 2 || !said(seq, ltoks(c.x.label)) || !c.t.some(rareW))) continue;
                const s = (linked ? 100 : 0) + c.t.length * 10 + c.depth;
                if (!best || s > best.s) best = {
                    ...c,
                    s: s
                };
            }
            if (!best) return {
                id: fallback,
                also: []
            };
            const fd = fallback && e[fallback] ? chain(fallback).length : 0;
            if (fallback && !under(best.x.id, fallback) && fd > 1) return {
                id: fallback,
                also: []
            };
            if (fallback === best.x.id || fallback && under(fallback, best.x.id)) return {
                id: fallback,
                also: []
            };
            const rare = best.t.filter(rareW);
            const also = cand.filter(c => c.x.id !== best.x.id && c.x.up === best.x.up && c.t.some(w => rare.includes(w) && have.has(w))).map(c => c.x.id).slice(0, 2);
            return {
                id: best.x.id,
                also: also
            };
        };
        return {
            hub: hub,
            e: e,
            groupOf: groupOf,
            parked: parked,
            under: under,
            find: find,
            specific: specific
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
    function dueToday(text, {now: now, due: due, since: since} = {}) {
        const t = strip(text), d = new Date(now == null ? Date.now() : now);
        const md = d.toLocaleDateString("en-US", {
            timeZone: "America/New_York",
            month: "numeric",
            day: "numeric"
        });
        const said = since ? new Date(since).toLocaleDateString("en-US", {
            timeZone: "America/New_York",
            month: "numeric",
            day: "numeric"
        }) : md;
        if (said === md && URGENT.test(t)) return true;
        if (new RegExp("\\b(?:by|due|on|until|before|mon|tue|wed|thu|fri|sat|sun)\\w*,?\\s+" + md.replace("/", "\\/") + "(?![\\d/])", "i").test(t)) return true;
        const ms = due ? Date.parse(due) : NaN;
        return ms > 0 && ms - d.getTime() < 24 * 36e5;
    }
    const AGENT_KINDS = new Set([ "run", "task", "asked", "inbox", "minute", "said" ]);
    function nonAction(text) {
        const t = strip(text);
        return !WORK.test(t) && (SOCIAL.test(t) || EVENTISH.test(t));
    }
    function weekendOpen(now, day) {
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
        const hd = day !== undefined ? day : typeof G.NS_HOLD_DAY === "function" ? G.NS_HOLD_DAY() : G.NS_HOLD_DAY;
        if (hd === "sun") return wd === "Sun";
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
    let DOC_OFF = null;
    const DOC_WORD = /\b(dr\.?\s+[a-z]+|doctor'?s?|physician|podiatrist|dermatologist|gyn\w*|pcp|gp|md)\b/i;
    const DOC_NOTE = /\b(notes? (to|for)|questions? (to|for)|ask (dr\b|the doc|my doc|her doc|at|about)|to ask\b|bring up|mention (to|at)|tell (dr|the doc|my doc)|(at|for|to) (my|your|her|the) next (visit|appointment|appt|blood test|check-?up|physical|labs?)|next time (i|you|she) (see|visit))/i;
    const DOC_ACTION = /\b(book|booking|schedule|reschedul\w*|cancel\w*|confirm (the|my|her) (appointment|visit)|intake|forms?\b|fill (in|out)|pay|bill|copay|refill|pharmacy|pick ?up|leave (now|by)|call (the|her|dr|to book)|referral (form|letter) (due|by))\b/i;
    const DOC_SERIOUS = /\b(severe|serious|worse|worsening|getting worse|can'?t (walk|breathe|stand|sleep|bear weight)|chest pain|fever|numb\w*|bleeding|infect\w*|emergency|urgent|asap|hospital|911|faint\w*|pass(ed)? out|new fracture|swollen and hot|suicid\w*|self-?harm|kill (my|her)self)\b/i;
    const doctorNames = () => (PEOPLE || []).filter(p => p && p.name && /\bdoctor|dentist|podiatr|physician\b/i.test(`${p.group || ""} ${p.relation || ""}`)).map(p => p.name);
    function doctorsOn(o = {}) {
        if (o.on !== undefined) return !!o.on;
        const g = typeof G.NS_DOCTOR_NOTES_OFF === "function" ? G.NS_DOCTOR_NOTES_OFF() : G.NS_DOCTOR_NOTES_OFF;
        return g !== undefined ? !!g : !!DOC_OFF;
    }
    function doctorNote(text, o = {}) {
        const t = strip(text);
        if (!t) return null;
        const names = o.doctors || doctorNames(), named = names.find(n => strip(n).split(/\s+/).some(w => w.length >= 4 && wordIn(t, w.toLowerCase())));
        if (!named && !DOC_WORD.test(t)) return null;
        if (!DOC_NOTE.test(t) || DOC_ACTION.test(t.replace(DOC_NOTE, " "))) return null;
        return {
            doctor: named || null,
            serious: DOC_SERIOUS.test(t)
        };
    }
    function doctorHeld(text, o = {}) {
        if (!doctorsOn(o)) return null;
        const d = doctorNote(text, o);
        return d && !d.serious ? "doctor-note" : null;
    }
    function notAction(text, o = {}) {
        return doctorHeld(text, o) || (nonAction(text) ? "event" : o.personal && !TRULY_URGENT.test(strip(text)) || isPersonal(text, o) ? "personal" : null);
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
    const AGENT_DOTS = new Set([ "comms-fresh" ]);
    const PARKED_WISH = /\b(first salary|after (?:my |her |the )?(?:first )?(?:paycheck|salary)|considering buying|nothing bought|parked idea)\b/i;
    const canon = s => strip(s).toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/h/g, "").replace(/[^a-z0-9]+/g, " ").trim();
    function fold(segs, {SUBJ: SUBJ, X: X, held: held, QS: QS = []}) {
        const qBody = new Map(QS.map(q => [ q.id, q.body || "" ]));
        const ORDER = [ "needs", "waiting", "planned" ], rows = [];
        for (const seg of ORDER) for (const g of segs[seg].values()) for (const it of g.items) rows.push({
            seg: seg,
            g: g,
            it: it
        });
        const persons = [];
        for (const [, v] of SUBJ) if (v.kind === "person") {
            const c = canon(v.name);
            if (c.length >= 4 && !/^(mom|dad|team|staff|susanna|susu)( |$)/.test(c)) persons.push({
                c: c,
                re: new RegExp("(^| )" + c.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "( |$)"),
                full: c.split(" ").length
            });
        }
        for (const x of Object.values(X.e)) {
            if (!x.node || !x.up || !/(^|-)people$/.test(x.up) && !/-p-/.test(x.id)) continue;
            const c = canon(strip(x.label).replace(/\s*\(.*$/, "")).split(" ")[0];
            if (c && c.length >= 4 && !persons.some(p => p.c === c)) persons.push({
                c: c,
                re: new RegExp("(^| )" + c + "( |$)"),
                full: 1
            });
        }
        const whoOf = it => it.kind === "inbound" ? strip(it.name).replace(/^Reply to /, "").replace(/\s*\(.*$/, "") : null;
        for (const r of rows) {
            const w = whoOf(r.it);
            const c = w && canon(w);
            if (c && c.length >= 4 && c.includes(" ") && !persons.some(p => p.c === c)) persons.push({
                c: c,
                re: new RegExp("(^| )" + c.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "( |$)"),
                full: c.split(" ").length
            });
        }
        persons.sort((a, b) => b.full - a.full || b.c.length - a.c.length);
        const firstPerson = text => {
            const t = " " + canon(text) + " ";
            let best = null, at = Infinity;
            for (const p of persons) {
                const m = p.re.exec(t);
                if (m && (m.index < at || m.index === at && p.full > 1 && best && !best.full)) {
                    at = m.index;
                    best = {
                        first: p.c.split(" ")[0],
                        full: p.full > 1 ? p.c : null
                    };
                }
            }
            return best;
        };
        const openQ = new Set(rows.filter(r => r.it.qid && r.it.status === "open").map(r => r.it.qid));
        const batchOf = new Map, firstListed = new Map;
        for (const r of rows) if (r.it.qid && /^still open\?/i.test(r.it.name || "")) {
            const body = String(qBody.get(r.it.qid) || r.it.line || "");
            for (const m of body.matchAll(/(?:^|\s)\d+\.\s+([^.(]{8,60})/g)) {
                const b = canon(m[1]).slice(0, 24);
                batchOf.set(b, r.it.qid);
                if (!firstListed.has(r.it.qid)) firstListed.set(r.it.qid, b);
            }
        }
        const labels = rows.filter(r => r.it.kind === "wait" || r.it.kind === "plan" || r.it.kind === "planned" || r.it.kind === "dot").map(r => ({
            r: r,
            l: strip(r.it.name)
        })).filter(x => x.l.length >= 6 && x.l === x.l.toUpperCase());
        const keysOf = r => {
            const it = r.it, k = [], text = `${it.name || ""} ${it.line || ""}`;
            if (it.taskId || it.live || it.kind === "task" || it.kind === "agent") return k;
            if (it.qid) k.push("q:" + it.qid);
            for (const m of text.matchAll(/\b(Q\d{3,5})\b/g)) if (openQ.has(m[1])) k.push("q:" + m[1]);
            if (it.kind === "idea" && it.line === "a pick waits on its card" && it.card) k.push("q:" + it.card);
            if (it.kind === "wait" && /^waiting on /.test(it.line || "")) k.push("w:" + canon(it.line.replace(/^waiting on /, "")).slice(0, 40));
            if (it.kind === "wait") for (const x of labels) if (x.r !== r && (it.line || "").includes(x.l)) k.push("d:" + x.l);
            if (labels.some(x => x.r === r)) k.push("d:" + strip(it.name));
            const subj = it.subject || whoOf(it);
            const who = subj ? {
                first: canon(subj).split(" ")[0],
                full: canon(subj).includes(" ") ? canon(subj) : null
            } : firstPerson(text);
            if (who) {
                if (who.full) k.push("p:" + who.full);
                k.push("p:" + who.first + "|" + r.g.id);
                if (it.kind === "person" || subj || it.kind === "wait" && canon(it.name).startsWith(who.first)) k.push("pf:" + who.first);
            }
            if (it.qid && it.src && /^asked by /.test(it.src) && it.since) k.push("b:" + it.src + "|" + (it.open || "") + "|" + Math.floor(Date.parse(it.since) / 9e5));
            const c = canon(it.name).slice(0, 24);
            for (const [b, q] of batchOf) if (c && (c.startsWith(b) || b.startsWith(c)) && firstListed.get(q) === b) k.push("q:" + q);
            return k;
        };
        const par = rows.map((_, i) => i), find = i => {
            while (par[i] !== i) i = par[i] = par[par[i]];
            return i;
        };
        const owner = new Map;
        rows.forEach((r, i) => {
            for (const key of keysOf(r)) {
                if (owner.has(key)) par[find(i)] = find(owner.get(key)); else owner.set(key, i);
            }
        });
        const wordsOf = r => new Set(canon(`${r.it.name || ""} ${r.it.line || ""}`).split(" ").filter(w => w.length >= 6));
        const W = rows.map(wordsOf), df = new Map;
        for (const ws of W) for (const w of ws) df.set(w, (df.get(w) || 0) + 1);
        rows.forEach((a, i) => {
            if (!(a.it.kind === "need" || a.it.kind === "wait")) return;
            rows.forEach((b, j) => {
                if (b.it.kind !== "question" || b.it.status !== "open") return;
                let n = 0;
                for (const w of W[i]) if (df.get(w) <= 3 && W[j].has(w)) n++;
                if (n >= 2) par[find(i)] = find(j);
            });
        });
        const groups = new Map;
        rows.forEach((r, i) => {
            const g = find(i);
            if (!groups.has(g)) groups.set(g, []);
            groups.get(g).push(r);
        });
        const t = r => Date.parse(r.it.since || "") || Infinity;
        for (const members of groups.values()) {
            if (members.length < 2) continue;
            members.sort((a, b) => ORDER.indexOf(a.seg) - ORDER.indexOf(b.seg) || !!b.it.options - !!a.it.options || (b.it.status === "open") - (a.it.status === "open") || t(a) - t(b));
            const head = members[0], rest = members.slice(1);
            head.it.merged = rest.map(r => ({
                name: r.it.name,
                line: r.it.line,
                kind: r.it.kind,
                qid: r.it.qid,
                triageId: r.it.triageId,
                askId: r.it.askId,
                laterId: r.it.laterId,
                ideaId: r.it.ideaId,
                open: r.it.open,
                since: r.it.since,
                seg: r.seg
            }));
            const oldest = members.reduce((a, b) => t(b) < t(a) ? b : a);
            if (oldest.it.since && t(oldest) < t(head)) head.it.firstSince = oldest.it.since;
            head.it.line = clip(`${head.it.line || ""}${head.it.line ? " · " : ""}+${rest.length} on this`, 110);
            for (const r of rest) {
                r.g.items.splice(r.g.items.indexOf(r.it), 1);
                held.push({
                    name: strip(r.it.name),
                    why: "merged",
                    into: head.it.name,
                    src: r.it.src || r.it.kind
                });
            }
        }
        for (const seg of ORDER) for (const [id, g] of [ ...segs[seg] ]) if (!g.items.length) segs[seg].delete(id);
    }
    const TRIG = [ {
        id: "time",
        label: "TIME"
    }, {
        id: "event",
        label: "EVENT"
    }, {
        id: "place",
        label: "PLACE"
    }, {
        id: "worker",
        label: "WORKER"
    }, {
        id: "weather",
        label: "WEATHER"
    }, {
        id: "message",
        label: "MESSAGE"
    } ];
    const WEATHER_RE = /\b(weather|forecast|rain(s|y|ing)?|drizzle|snow(s|ing)?|sunny|sun (is )?out|the sun comes out|uv( index)?|cloud(y|s)?|clear sky|warm(er)?|cold(er)?|wind(y)?|temperature|degrees|storm)\b/i;
    const MESSAGE_RE = /\b(repl(y|ies|ied)|writes? back|wrote back|answers?|responds?|texts? (me|back|you)|emails? (me|back|you)|messages? (me|back|you)|gets? back to)\b/i;
    const TRIG_SET = new Set(TRIG.map(t => t.id));
    const you = s => String(s || "").replace(/\bI'm\b/g, "you're").replace(/\bI am\b/g, "you are").replace(/\bI've\b/g, "you've").replace(/\bI\b/g, "you").replace(/\bmy\b/gi, "your").replace(/\bme\b/g, "you").replace(/\bmyself\b/g, "yourself");
    const herYour = s => String(s || "").replace(/\bher\b/g, "your").replace(/\bshe is\b/g, "you are").replace(/\bshe\b/g, "you").replace(/\bSusanna\b/g, "you");
    const plainWait = s => clip(herYour(String(s || "").replace(/ · \+\d+ on this$/, "")).split(" -- ")[0].replace(/^(device check(?: parked)?:\s*|waiting (for|on)\s+|waits for\s+)/i, "").replace(/\s*\((then|and then)[^)]*\)?\s*$/i, "").replace(/\s*\(then .*$/i, ""), 80);
    const replies = who => `${who} ${/ [a-z]+s$/.test(who) ? "reply" : "replies"}`;
    const DEVICE_RE = /^device check\b|\bwaits for her next use\b/i;
    const CH = {
        email: "email",
        imessage: "iMessage",
        teams: "Teams",
        wechat: "WeChat",
        whatsapp: "WhatsApp",
        linkedin: "LinkedIn",
        instagram: "Instagram",
        sms: "text",
        discord: "Discord"
    };
    function trigOfSpec(spec) {
        const parts = String(spec || "").split(";").map(p => p.trim()).filter(Boolean);
        for (const p of parts) {
            const m = /^(\w+)\s*:\s*(.+)$/.exec(p);
            if (!m) continue;
            const k = m[1].toLowerCase(), v = m[2].trim();
            if (k === "at") return {
                kind: "time",
                line: "at a set time",
                at: v
            };
            if (k === "when") return trigOfWords(v) || {
                kind: "event",
                line: you(v)
            };
            if (k === "reply") return {
                kind: "message",
                line: `${v} replies`
            };
            if (k === "event") return {
                kind: "time",
                line: `when that calendar event ${/start/.test(v) ? "starts" : "ends"}`
            };
            if (k === "items") {
                const ids = v.split(",").map(s => s.trim()).filter(Boolean);
                if (ids.length && ids.every(i => /^T\d+$/.test(i))) return {
                    kind: "worker",
                    line: `after ${ids.join(", ")} finish${ids.length > 1 ? "" : "es"}`,
                    on: ids
                };
                return {
                    kind: "event",
                    line: `when ${ids.length} linked item${ids.length > 1 ? "s are" : " is"} done`
                };
            }
        }
        return null;
    }
    function trigOfWords(s) {
        const t = strip(s);
        if (!t) return null;
        if (/\b(when|once|after|till|until) (i|she|you) (get|gets|come|comes|am|is|are|'m) (back )?home\b|\bat home\b|\bwhen (i|she|you) (arrive|arrives|get|gets) (to|at) /i.test(t)) {
            const pl = /\b(?:arrive|arrives|get|gets) (?:to|at) ([^,.;()]+)/i.exec(t);
            return {
                kind: "place",
                line: pl && !/^home$/i.test(pl[1].trim()) ? `when you get to ${clip(pl[1], 40)}` : "when you get home"
            };
        }
        const T = /\b(T\d{3,5})\b/.exec(t);
        if (T && /\b(finish|finishes|finished|done|ends?|ended|complete[sd]?|lands?|clock(?:s|ed)? off)\b/i.test(t)) return {
            kind: "worker",
            line: `after ${T[1]} finishes`,
            on: [ T[1] ]
        };
        if (/\b(get|got|gets) paid\b|\bpay ?day\b|\bpaycheck\b|\bsalary\b/i.test(t)) return {
            kind: "event",
            line: "when you get paid"
        };
        if (WEATHER_RE.test(t) && !/\b(watch|every|whenever|always)\b/i.test(t)) return {
            kind: "weather",
            line: you(herYour(clip(t.replace(/^(waiting (for|on)|wait (till|until))\s+/i, ""), 80)))
        };
        if (MESSAGE_RE.test(t) && /(^|\s)[A-Z][a-z]+/.test(t.replace(/^(When|Once|After|Till|Until|Waiting)\b/, ""))) return {
            kind: "message",
            line: you(herYour(clip(t.replace(/^(waiting (for|on)|wait (till|until))\s+/i, "").replace(/\s*\((then|and then)\b.*$/i, ""), 80)))
        };
        return null;
    }
    function triggerOf(x) {
        x = x || {};
        if (x.trigger && TRIG_SET.has(x.trigger.kind)) {
            const r = x.trigger.kind === "event" && x.trigger.via !== "device" ? trigOfWords(x.trigger.line) : null;
            return r && /^(message|weather)$/.test(r.kind) ? {
                ...x.trigger,
                ...r
            } : {
                ...x.trigger,
                line: herYour(x.trigger.line) || plainWait(x.line)
            };
        }
        if (x.later) return {
            kind: "time",
            line: "you said later",
            at: x.later
        };
        if (x.asleep || x.wakesAt) return {
            kind: "time",
            line: "its wake time",
            at: x.wakesAt || null
        };
        if (x.waitFor) {
            const s = trigOfSpec(typeof x.waitFor === "string" ? x.waitFor : x.waitFor.spec);
            if (s) return s;
        }
        const w = x.wait || x.ledger && x.ledger.wait || null;
        if (w) {
            if (w.trigger) {
                const s = trigOfSpec(w.trigger);
                if (s) return /^until /.test(w.on || "") && s.kind === "time" ? {
                    ...s,
                    line: you(String(w.on).replace(/^until\s+/, "on "))
                } : s;
            }
            if (/^reach$/i.test(w.on || "")) return {
                kind: "event",
                line: "you hear the answer"
            };
            if (w.on && !/^(her|susanna|you)$/i.test(w.on)) {
                const ch = /\((\w+),\s*since/i.exec(w.why || "");
                return {
                    kind: "message",
                    line: `${replies(w.on)}${ch && CH[ch[1].toLowerCase()] ? " on " + CH[ch[1].toLowerCase()] : ""}`
                };
            }
        }
        const said = strip(x.blocker || x.line || "");
        const wn = /^Waiting on ([^:]{2,40}):/.exec(strip(x.name || ""));
        if (wn && !/^(her|you|susanna)\b/i.test(wn[1])) return {
            kind: "message",
            line: replies(wn[1].trim())
        };
        const words = trigOfWords(said);
        if (words) return words;
        if (DEVICE_RE.test(said)) return {
            kind: "event",
            line: /her next use/i.test(said) ? "your next use of the phone or glasses" : "your iPhone is free"
        };
        const on = /^(?:T\d+ · (?:in progress, blocked: )?)?waiting on (.+?)(?:[:,(]| · |$)/i.exec(said);
        if (on) {
            const who = on[1].trim();
            if (/^(her|your|susanna)\b/i.test(who)) return {
                kind: "event",
                line: you(who.replace(/^her\b/i, "your").replace(/^susanna\b/i, "you")).replace(/^your yes\b.*/i, "your yes")
            };
            if (/^reach\b/i.test(who)) return {
                kind: "event",
                line: "you hear the answer"
            };
            if (/^until\b/i.test(who)) return {
                kind: "time",
                line: you(who.replace(/^until\s+/i, "on "))
            };
            const rep = /^([^:]{2,40}): reply to\b/i.exec(on[1] + said.slice(said.indexOf(on[1]) + on[1].length));
            if (rep) return {
                kind: "message",
                line: replies(rep[1].trim())
            };
            if (/^[A-Z0-9&' .-]{4,}$/.test(who) && /[A-Z]{3}/.test(who) && x.kind !== "person") return {
                kind: "event",
                line: `when ${clip(who, 40)} is done`
            };
            if (/^[A-Z0-9][\w.&'-]*( [\w.&'-]+){0,3}$/.test(who) || x.kind === "person") return {
                kind: "message",
                line: replies(clip(who, 40))
            };
        }
        if (x.kind === "person" && x.name) return {
            kind: "message",
            line: replies(clip(x.name, 40))
        };
        if (x.taskId && x.waitingOn && said) return trigOfWords(said.replace(/^T\d+ · (in progress, blocked: )?/, "")) || {
            kind: "event",
            line: plainWait(said.replace(/^T\d+ · (in progress, blocked: )?/, "").replace(/^you said "[^"]*" [^·]*· T\d+ · /, "")),
            via: "check"
        };
        if (x.kind === "inbound") return {
            kind: "message",
            line: clip(said || "their next message", 80)
        };
        return {
            kind: "event",
            line: clip(plainWait(said) || "something to happen", 80),
            flag: true
        };
    }
    const fires = at => {
        const t = Date.parse(at || "");
        if (!t) return "";
        const d = new Date(t), o = {
            timeZone: "America/New_York"
        };
        const day = d.toLocaleDateString("en-US", {
            ...o,
            weekday: "short",
            month: "numeric",
            day: "numeric"
        }).replace(",", ""), tm = d.toLocaleTimeString("en-US", {
            ...o,
            hour: "numeric",
            minute: "2-digit"
        }).toLowerCase().replace(":00", "");
        return `fires ${day}${t - Date.now() > 30 * 864e5 ? d.getFullYear() !== (new Date).getFullYear() ? " " + d.getFullYear() : "" : ", " + tm}`;
    };
    function byTrigger(rows) {
        const g = new Map(TRIG.map(t => [ t.id, {
            id: "trig-" + t.id,
            trig: t.id,
            label: t.label,
            items: []
        } ]));
        for (const r of rows || []) {
            const t = r.trig || (r.trig = triggerOf(r));
            if (t.kind === "time" && t.at && !t.fires) t.fires = fires(t.at);
            g.get(t.kind).items.push(r);
        }
        g.get("time").items.sort((a, b) => (Date.parse(a.trig.at || "") || 9e15) - (Date.parse(b.trig.at || "") || 9e15));
        return [ ...g.values() ].filter(x => x.items.length);
    }
    const CO = "company", CO_LABEL = "UNIQUE DESIGNS -- COMPANY MAC MINI";
    function build({map: map, workers: workers, now: NOW} = {}) {
        map = map || {};
        const X = index(map), P = map.projects || [], SUBJ = subjects(map), held = [];
        if (Array.isArray(map.people) && map.people.length) PEOPLE = map.people;
        if (typeof map.doctorNotesOff === "boolean") DOC_OFF = map.doctorNotesOff;
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
        const HID = new Set(Array.isArray(map.clerkHidden) ? map.clerkHidden : []);
        const WCL = map.workClaims && typeof map.workClaims === "object" ? map.workClaims : {};
        const needKey = t => "need:" + String(t || "").toLowerCase().replace(/<[^>]+>/g, " ").replace(/[^a-z0-9]+/g, " ").trim().slice(0, 48).trim();
        const claimOf = item => {
            for (const r of [ item.qid, item.laterId, item.askId, item.item, item.needKey ]) {
                const c = r && WCL[String(r)];
                if (!c) continue;
                const t = (Array.isArray(map.tasks) ? map.tasks : []).find(x => x.id === c.task);
                if (!t || t.status === "running" || t.status === "queued") return c;
            }
            return null;
        };
        const add = (seg, groupId, item) => {
            if (HID.size && [ item.open, item.qid, item.askId, item.laterId, item.task, item.item ].some(r => r && HID.has(String(r)))) return;
            if (seg === "needs") {
                const c = claimOf(item);
                if (c) {
                    seg = "working";
                    groupId = groupId === "minute" || groupId === "review" || groupId === "asked" ? item.open && X.e[item.open] ? X.groupOf(item.open) : "agents" : groupId;
                    item = {
                        ...item,
                        line: clip(`${c.task} on it${item.line ? " · " + item.line : ""}`, 110),
                        status: "working",
                        taskId: c.task,
                        claimed: true,
                        urgent: false
                    };
                }
            }
            const key = (item.name + "|" + item.line).toLowerCase();
            if (seen[seg].has(key)) return;
            seen[seg].add(key);
            item.seq = seq++;
            if (item.src && !item.meta) item.meta = item.src + (item.since && ago(item.since) ? " · " + ago(item.since) : "");
            if (seg === "needs" && item.urgent == null) item.urgent = !AGENT_KINDS.has(item.kind) && dueToday(`${item.name} ${item.line || ""}`, {
                due: item.due,
                since: item.since
            });
            const gid = groupId || "other";
            if (!segs[seg].has(gid)) segs[seg].set(gid, {
                id: gid,
                label: gid === "minute" ? "GOT A MINUTE" : gid === "review" ? "TO REVIEW" : gid === "asked" ? "YOU ASKED, NOT DONE" : gid === "inbound" ? "FROM OUTSIDE" : gid === "told" ? "MITTENS TOLD YOU" : gid === CO ? CO_LABEL : X.e[gid] ? nice(X.e[gid].label) : String(gid).replace(/-/g, " ").toUpperCase(),
                items: [],
                ...gid === "minute" || gid === "review" ? {
                    minute: true
                } : {},
                ...gid === "review" ? {
                    review: true
                } : {},
                ...gid === CO ? {
                    company: true
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
            if (w.kind === "task" && qTask.has(w.id) && !w.company) {
                liveTasks.add(w.id);
                continue;
            }
            if (w.company) {
                liveTasks.add(w.id);
                const m = w.elapsedSeconds == null ? "" : w.elapsedSeconds < 90 ? `${Math.round(w.elapsedSeconds)}s` : `${Math.round(w.elapsedSeconds / 60)} min`;
                add("working", CO, {
                    name: clip(taskName[w.id] || w.label || w.id, 48),
                    line: clip([ w.id, "running", w.now || "working", m ].filter(Boolean).join(" · "), 90),
                    open: taskDot[w.id] && X.e[taskDot[w.id]] ? taskDot[w.id] : null,
                    kind: "task",
                    taskId: w.id,
                    company: true,
                    status: "working",
                    src: "company Mac mini",
                    since: w.since || null
                });
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
        for (const t of [ ...tasks ].sort((a, b) => (Date.parse(b.at || "") || 0) - (Date.parse(a.at || "") || 0))) {
            if (liveTasks.has(t.id) || qTask.has(t.id) && !t.company || !(t.status === "running" || t.status === "queued" || t.company && t.status === "stopped")) continue;
            const id = t.dot && X.e[t.dot] ? t.dot : null;
            if (t.company) {
                const st = t.status === "stopped" ? "stopped -- the company queue re-runs it" : t.status === "running" ? `running · ${t.now || "working"} · ${tAgo(t)}` : t.waitingOn || t.asleep ? `waiting: ${String(t.waiting || "waiting").split(" -- ")[0]}` : `queued: ${String(t.waiting || "next company slot").split(" -- ")[0]}`;
                add("working", CO, {
                    name: clip(t.name, 48),
                    line: clip(`${t.id} · ${st}${t.report && t.status !== "queued" ? " · last: " + t.report : ""}`, 110),
                    open: id,
                    kind: "task",
                    taskId: t.id,
                    company: true,
                    queued: t.status === "queued",
                    status: t.status === "queued" ? "queued" : t.status,
                    src: "company Mac mini",
                    since: t.at || null
                });
                continue;
            }
            const waitingNow = t.status === "queued" && (t.waitingOn || t.asleep);
            if (waitingNow) {
                add("waiting", groupFor(id, "agents-waiting"), {
                    name: clip(t.name, 48),
                    line: clip(`${t.id} · ${t.startedAt ? "in progress, blocked: " : ""}${String(t.waiting || "waiting").split(" -- ")[0].replace(/^waiting for /, "")}`, 110),
                    open: id,
                    kind: "task",
                    taskId: t.id,
                    waitingOn: true,
                    inProgress: !!t.startedAt,
                    blocker: String(t.waiting || "").split(" -- ")[0] || undefined,
                    asleep: t.asleep || undefined,
                    wakesAt: t.wakesAt || undefined,
                    trigger: t.trigger || undefined,
                    src: "voice task",
                    since: t.at || null
                });
                continue;
            }
            add("working", groupFor(id, t.status === "queued" ? "queued" : "agents"), {
                name: clip(t.name, 48),
                line: clip(t.status === "queued" ? `${t.id} · queued: ${t.waiting || "next free slot"}` : `${t.id} · ${t.now || "working"} · ${tAgo(t)}`, 80),
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
        const pin = (text, id, link) => {
            const r = X.specific(strip(text), id, link);
            return [ r.id, r.also.length ? {
                also: r.also
            } : {} ];
        };
        for (const t of T && T.inProgress || []) {
            const s = split(t.text), [id, also] = pin(t.text, named1(split(t.text), X.find(t.project))), who = isSubject(SUBJ, s.name, s.line);
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
                ...also,
                kind: "progress",
                since: t.since || null
            });
        }
        const people = (Array.isArray(map.people) ? map.people : []).filter(p => p && p.name);
        const lastAt = p => (p.timeline || []).map(t => t && t.at).filter(Boolean).sort().pop() || null;
        const words = p => strip(p.name + " " + (p.org || "")).toLowerCase().split(/[^a-zÀ-ɏ]+/).filter(w => w.length > 3 && !/^(staff|labs?|team|university|the)$/.test(w));
        const progText = (T && T.inProgress || []).map(t => strip(t.text).toLowerCase());
        const due = p => p.nextDue || "9999";
        for (const p of people.filter(p => p.state === "them" || !p.state && p.project === "community").sort((a, b) => due(a).localeCompare(due(b)))) {
            if (words(p).some(w => progText.some(t => t.includes(w)))) continue;
            if (p.project === "community" || !p.state) {
                held.push({
                    name: p.name,
                    line: strip(p.line || ""),
                    why: "personal",
                    src: "people",
                    who: p.name
                });
                continue;
            }
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
            const [id, also] = pin(t.text, named1(s, X.find(t.project || t.id)), t.link), who = isSubject(SUBJ, s.name, "");
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
                ...also,
                kind: "need",
                needKey: needKey(t.text),
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
            if (AGENT_DOTS.has(x.id)) continue;
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
                if (snoozed) {
                    add("waiting", g || "asked", {
                        ...base,
                        name: title,
                        line: clip(`you said later -- back at ${qWhen(q.later)}${what ? " · " + what : ""}`, 110),
                        kind: "question",
                        status: "waiting",
                        waitingOn: true,
                        later: q.later
                    });
                    continue;
                }
                add("needs", g || "asked", {
                    ...base,
                    name: title,
                    line: what,
                    kind: "question",
                    status: "open",
                    urgent: dueToday(`${title} ${what}`, {
                        since: q.createdAt
                    })
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
                add("waiting", g || "agents-waiting", {
                    ...base,
                    name: title,
                    line: clip(`${told} · ${t.id} · ${String(t.waiting || "waiting").split(" -- ")[0]}`, 96),
                    kind: "question",
                    status: "waiting",
                    taskId: t.id,
                    waitingOn: true,
                    asleep: t.asleep || undefined,
                    wakesAt: t.wakesAt || undefined,
                    trigger: t.trigger || undefined,
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
                name: clip(t.noReply ? `${t.who} alert (${t.label})` : `Reply to ${t.who} (${t.label})`, 56),
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
        for (const t of tasks.filter(t => t.status === "stopped" && !qTask.has(t.id) && !t.company)) {
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
            const [ldot, lalso] = l.dot && X.e[l.dot] ? pin(`${l.title || ""} ${l.text || ""}`, l.dot) : [ null, {} ];
            const act = l.action || {
                kind: ldot ? "dot" : "none",
                target: ldot,
                label: ldot ? "Open the dot" : "Mark done"
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
                open: ldot,
                ...lalso,
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
            if (n.supersededBy) continue;
            if (PARKED_WISH.test(n.waitingOn || "")) {
                held.push({
                    name: nice(n.label),
                    line: strip(n.waitingOn),
                    why: "parked",
                    src: "dot",
                    open: x.id
                });
                continue;
            }
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
            if (n.supersededBy) continue;
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
        for (const d of map.ideaPlans || []) {
            const at = X.e[d.dot] ? d.dot : null;
            {
                const why = PARKED_WISH.test(d.title) ? "parked" : notAction(d.title, {
                    now: NOW
                });
                if (why) {
                    held.push({
                        name: d.title,
                        why: why,
                        src: "idea",
                        ideaId: d.id
                    });
                    continue;
                }
            }
            add("planned", at ? X.groupOf(at) : "mittens", {
                name: clip(d.title, 60),
                line: d.card ? "a pick waits on its card" : "planned, not started",
                src: "your idea",
                open: at,
                kind: "idea",
                card: d.card || undefined,
                said: "idea:" + d.id,
                ideaId: d.id,
                thread: d.thread || null,
                since: d.at
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
            if (t.company) {
                doneRows.push({
                    g: CO,
                    it: {
                        name: clip(t.name, 48),
                        line: clip(`${t.id} · finished ${dday(at)}${t.report || t.result ? " -- " + (t.report || t.result) : ""}`, 140),
                        open: id,
                        kind: "task",
                        taskId: t.id,
                        company: true,
                        at: t.endedAt
                    }
                });
                continue;
            }
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
            if (m.unseen) {
                add("needs", "minute", {
                    name: clip(m.text, 60),
                    line: `not seen yet · sent ${qWhen(m.at)}`,
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
                        label: "Open in chat"
                    },
                    src: "Mittens chat",
                    since: m.at
                });
                continue;
            }
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
        fold(segs, {
            SUBJ: SUBJ,
            X: X,
            held: held,
            QS: Array.isArray(map.questions) ? map.questions : []
        });
        const W0 = [ ...segs.waiting.values() ].flatMap(g => g.items.map(it => (it.area = it.area || g.label, 
        it)));
        const refs = new Set(W0.flatMap(it => [ it.taskId, it.qid, it.rid, it.ref, it.open ].filter(Boolean).map(String)));
        for (const w of Array.isArray(map.waits) ? map.waits : []) {
            if (!w || !w.title || w.ref && refs.has(String(w.ref)) || w.task && refs.has(String(w.task))) continue;
            if (HID.size && w.ref && HID.has(String(w.ref))) continue;
            W0.push({
                name: clip(w.title, 60),
                line: w.line || "",
                open: w.dot || null,
                kind: "wait",
                rid: w.ref || undefined,
                ref: w.ref || undefined,
                trigger: w.trigger,
                area: w.dot && X.groupOf(w.dot) && X.e[X.groupOf(w.dot)] ? nice(X.e[X.groupOf(w.dot)].label) : w.area || "",
                src: w.src || "wait",
                since: w.since || null,
                seq: seq++
            });
        }
        segs.waiting = new Map(byTrigger(W0).map(g => [ g.id, g ]));
        for (const g of segs.waiting.values()) for (const it of g.items) {
            const t = it.trig;
            it.trigLine = t.line;
            it.trigAt = t.at || null;
            if (t.fires) it.fires = t.fires;
            if (t.flag) it.trigFlag = true;
        }
        const first = g => Math.min(...g.items.map(i => i.seq));
        const seg = (id, label) => {
            const groups = id === "waiting" ? [ ...segs[id].values() ] : [ ...segs[id].values() ].sort(id === "planned" ? (a, b) => b.items.length - a.items.length || a.label.localeCompare(b.label) : (a, b) => !!a.minute - !!b.minute || (a.id === "queued") - (b.id === "queued") || first(a) - first(b));
            if (id !== "waiting") groups.forEach(g => g.items.sort((a, b) => (a.kind === "inbox") - (b.kind === "inbox") || a.seq - b.seq));
            if (id !== "waiting") groups.sort((a, b) => (a.id === CO) - (b.id === CO));
            return {
                id: id,
                label: label,
                count: groups.reduce((s, g) => s + g.items.filter(i => !i.company).length, 0),
                company: groups.reduce((s, g) => s + g.items.filter(i => i.company).length, 0),
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
                company: by("working").company,
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
            held: held,
            watches: Array.isArray(map.watches) ? map.watches : []
        };
    }
    function spoken(tree, {top: top = 3} = {}) {
        const by = id => tree.segments.find(x => x.id === id), W = by("working"), Wt = by("waiting"), N = by("needs"), Pl = by("planned");
        const items = s => s.groups.flatMap(g => g.items.filter(i => !i.company).map(i => ({
            ...i,
            group: g.label
        }))).sort((a, b) => a.seq - b.seq);
        const title = s => s.split(" ").map(w => w.charAt(0) + w.slice(1).toLowerCase()).join(" ");
        const say = i => `${i.name}${i.line ? " -- " + clip(i.line, 60) : ""} (${title(i.group)})`;
        const parts = [];
        const live = items(W).filter(i => i.live), moving = items(W).filter(i => !i.live), waiting = items(Wt).filter(i => i.kind === "person"), waitDots = items(Wt).filter(i => i.kind !== "person");
        const need = items(N).filter(i => i.kind !== "inbox" && i.urgent), inbox = items(N).filter(i => i.kind === "inbox"), minute = items(N).filter(i => !i.urgent && (i.kind === "minute" || i.kind === "said"));
        const later = items(N).filter(i => !i.urgent && !AGENT_KINDS.has(i.kind) && i.kind !== "minute");
        if (need.length) parts.push(`${need.length} need${need.length === 1 ? "s" : ""} you. Top: ${need.slice(0, top).map(say).join("; ")}.`);
        if (later.length) parts.push(`${later.length} more need you, not today.`);
        parts.push(live.length ? `${live.length} agent${live.length === 1 ? "" : "s"} running now: ${live.slice(0, 2).map(i => i.name).join(", ")}.` : "No agents running right now.");
        if (moving.length) parts.push(`In motion: ${moving.slice(0, top).map(say).join("; ")}${moving.length > top ? `; and ${moving.length - top} more` : ""}.`);
        if (minute.length) parts.push(`${minute.length} can wait for a spare minute (about ${minute.reduce((s, i) => s + (i.minutes || 0), 0)} min in all)${minute[0].fit ? `, quickest fit now: ${minute[0].name} (~${minute[0].minutes} min)` : ""}.`);
        const q = inbox.reduce((s, i) => s + (i.n || 0), 0);
        if (q) parts.push(`${q} questions in the inbox, most in ${title(inbox.slice().sort((a, b) => b.n - a.n)[0].group)}.`);
        if (Pl.count) parts.push(`${Pl.count} planned and not acted on, the biggest pile in ${title(Pl.groups[0].label)} (${Pl.groups[0].items.length}).`);
        if (waitDots.length) parts.push(`Waiting on others: ${waitDots.slice(0, 3).map(i => `${i.name.charAt(0) + i.name.slice(1).toLowerCase()} -- ${i.line}`).join("; ")}.`);
        if (waiting.length) parts.push(`Waiting on ${waiting.length} ${waiting.length === 1 ? "person" : "people"} to reply (${waiting.slice(0, 3).map(i => i.name).join(", ")}${waiting.length > 3 ? ", ..." : ""}).`);
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
                laterId: i.laterId || null,
                review: !!i.review
            })),
            counts: {
                urgent: urgent.length,
                minute: minute.length,
                planned: Pl.count
            }
        };
    }
    G.NSTree = {
        triggerOf: triggerOf,
        byTrigger: byTrigger,
        fires: fires,
        TRIG: TRIG,
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
        doctorNote: doctorNote,
        doctorHeld: doctorHeld,
        dueToday: dueToday,
        classify: classify,
        isPersonal: isPersonal,
        TRULY_URGENT: TRULY_URGENT,
        PROMOTE: [ ...PROMOTE ]
    };
})(typeof globalThis !== "undefined" ? globalThis : window);
