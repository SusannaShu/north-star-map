let INTENTS = [], PEOPLE = {
    people: [],
    byProject: {},
    register: {}
};

window.PEOPLE_OWED = {};

const RED = "#D32F2F";

const gmailUrl = id => `https://mail.google.com/mail/u/0/#all/${id}`;

const liveIntents = () => INTENTS.filter(i => [ "thinking", "proposed", "running" ].includes(i.status) || i.status === "failed" && Date.now() - new Date(i.updatedAt || i.createdAt) < 36e5);

let pollT = null;

async function poll() {
    clearTimeout(pollT);
    if (window.NS_PUBLIC) return;
    try {
        const [a, b] = await Promise.all([ api("/api/intents", {
            cache: "no-store"
        }), api("/api/people", {
            cache: "no-store"
        }) ]);
        if (a.ok) INTENTS = (await a.json()).intents || [];
        if (b.ok) {
            PEOPLE = await b.json();
            window.PEOPLE_OWED = {};
            for (const [p, c] of Object.entries(PEOPLE.byProject || {})) if (c.you + c.check) window.PEOPLE_OWED[p] = c.you + c.check;
        }
    } catch {}
    syncOverlay(false);
    if (panelNode && (panelNode.type === "intent" || panelNode.type === "agent") && byId[panelNode.id]) renderOverlayPanel(byId[panelNode.id], true);
    if (FOCUS && !focusBusy) drawFocus(FOCUS, false);
    const busy = INTENTS.some(i => i.status === "thinking" || (i.agents || []).some(a => a.state === "working" || a.state === "starting"));
    pollT = setTimeout(poll, busy ? 2500 : 12e3);
}

window.syncOverlay = function(fresh) {
    const want = new Map;
    for (const it of liveIntents()) {
        const fits = (it.ceo && it.ceo.fits || [ it.project ]).filter(id => id && byId[id] && byId[id].type !== "intent");
        if (window.NS_ROOT) continue;
        want.set(it.id, {
            id: it.id,
            type: "intent",
            label: it.ceo ? it.ceo.title : "thinking…",
            status: it.status,
            verdict: it.ceo && it.ceo.verdict,
            fits: fits,
            r: 14
        });
        (it.agents || []).forEach(a => want.set(a.id, {
            id: a.id,
            type: "agent",
            label: a.project,
            status: a.state,
            parent: it.id,
            r: 7,
            project: a.project
        }));
    }
    const gone = new Set(nodes.filter(n => (n.type === "intent" || n.type === "agent") && !want.has(n.id)).map(n => n.id));
    if (gone.size) {
        for (let i = nodes.length - 1; i >= 0; i--) if (gone.has(nodes[i].id)) {
            delete byId[nodes[i].id];
            nodes.splice(i, 1);
        }
        for (let i = links.length - 1; i >= 0; i--) if (gone.has(links[i].s.id) || gone.has(links[i].t.id)) links.splice(i, 1);
    }
    for (const w of want.values()) {
        let n = byId[w.id];
        if (!n) {
            const at = byId[w.parent] || byId[w.fits && w.fits[0]] || nodes[0];
            n = {
                ...w,
                x: at.x + (Math.random() - .5) * 6,
                y: at.y + (Math.random() - .5) * 6,
                vx: 0,
                vy: 0,
                born: performance.now()
            };
            nodes.push(n);
            byId[n.id] = n;
        } else Object.assign(n, w);
        for (let i = links.length - 1; i >= 0; i--) if (links[i].s === n && links[i].overlay) links.splice(i, 1);
        if (n.type === "intent") {
            (n.fits.length ? n.fits : [ nodes[0].id ]).forEach((f, k) => links.push({
                s: n,
                t: byId[f],
                overlay: true,
                dash: [ 3, 4 ],
                rest: k ? 190 : 110
            }));
        } else {
            links.push({
                s: n,
                t: byId[n.parent],
                overlay: true,
                rest: 48
            });
            if (byId[n.project]) links.push({
                s: n,
                t: byId[n.project],
                overlay: true,
                dash: [ 2, 6 ],
                rest: 150
            });
        }
    }
};

window.drawOverlayNode = function(ctx, n, t, dim) {
    const grow = n.born ? Math.min(1, (performance.now() - n.born) / 600) : 1;
    const r = n.r * (.4 + .6 * grow);
    ctx.globalAlpha = (dim ? .25 : 1) * grow;
    if (n.type === "intent") {
        const red = n.verdict === "push-back" || n.status === "failed";
        ctx.fillStyle = "#FFF";
        ctx.strokeStyle = red ? RED : "#000";
        ctx.lineWidth = 1.6;
        ctx.setLineDash([ 3, 3.5 ]);
        ctx.lineDashOffset = n.status === "thinking" ? -t * 14 : 0;
        ctx.beginPath();
        ctx.arc(n.x, n.y, r, 0, 7);
        ctx.fill();
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.lineDashOffset = 0;
        if (n.status === "thinking") {
            const p = (Math.sin(t * 3) + 1) / 2;
            ctx.strokeStyle = `rgba(0,0,0,${.18 * (1 - p)})`;
            ctx.beginPath();
            ctx.arc(n.x, n.y, r + 5 + p * 8, 0, 7);
            ctx.stroke();
        }
        ctx.fillStyle = red ? RED : "#000";
        ctx.font = "700 11px Inter, sans-serif";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(n.status === "thinking" ? "…" : n.status === "failed" ? "!" : n.verdict === "build" ? "→" : n.verdict === "push-back" ? "?" : "·", n.x, n.y + .5);
        ctx.font = "italic 600 10.5px Inter, sans-serif";
        ctx.textBaseline = "top";
        ctx.strokeStyle = "#FFF";
        ctx.lineWidth = 4;
        ctx.lineJoin = "round";
        ctx.strokeText(n.label, n.x, n.y + r + 6);
        ctx.fillText(n.label, n.x, n.y + r + 6);
    } else {
        const working = n.status === "working" || n.status === "starting";
        if (working) {
            const p = (Math.sin(t * 3.2 + n.x) + 1) / 2;
            ctx.strokeStyle = `rgba(0,0,0,${.3 * (1 - p)})`;
            ctx.lineWidth = 1.5;
            ctx.beginPath();
            ctx.arc(n.x, n.y, r + 3 + p * 6, 0, 7);
            ctx.stroke();
        }
        ctx.fillStyle = working ? "#000" : "#FFF";
        ctx.strokeStyle = "#000";
        ctx.lineWidth = 1.4;
        ctx.beginPath();
        ctx.arc(n.x, n.y, r, 0, 7);
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = "#555";
        ctx.font = "10px JetBrains Mono, monospace";
        ctx.textAlign = "center";
        ctx.textBaseline = "top";
        ctx.fillText(n.label, n.x, n.y + r + 4);
    }
    ctx.globalAlpha = 1;
};

window.sendIntent = async function(text, project) {
    try {
        const r = await api("/api/intent", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                text: text,
                project: project
            })
        });
        const j = await r.json();
        if (!r.ok) return tick(`<b>north-star</b> · Mittens did not get it: ${esc(j.error)}`);
        INTENTS.push(j);
        syncOverlay(false);
        tick(`<b>${j.id}</b> · Mittens is reading the whole map…`);
        setTimeout(poll, 800);
    } catch (e) {
        tick(`<b>north-star</b> · not sent: ${esc(e.message)}`);
    }
};

window.replyIntent = async function(n, text) {
    const id = n.type === "agent" ? n.parent : n.id;
    const r = await api("/api/intent/reply", {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify({
            id: id,
            text: text
        })
    });
    const j = await r.json();
    if (!r.ok) return tick(`<b>${id}</b> · ${esc(j.error)}`);
    tick(`<b>${id}</b> · Mittens is thinking again`);
    poll();
};

async function intentAct(id, what, extra) {
    const r = await api("/api/intent/" + what, {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify({
            id: id,
            ...extra || {}
        })
    });
    const j = await r.json();
    tick(r.ok ? `<b>${id}</b> · ${what === "run" ? "agents starting — watch them grow out of the circle" : j.status}` : `<b>${id}</b> · ${esc(j.error)}`);
    if (what === "close" && r.ok) closePanel();
    poll();
}

window.intentAct = intentAct;

window.renderOverlayPanel = function(n, quiet) {
    const it = INTENTS.find(i => i.id === (n.type === "agent" ? n.parent : n.id));
    if (!it) return;
    if (n.type === "agent") {
        const a = (it.agents || []).find(x => x.id === n.id) || {};
        pTitle.textContent = `${a.project} agent`;
        pStatus.innerHTML = `<span class="dot ${a.state === "working" || a.state === "starting" ? "working" : "done"}"></span><span>${esc(a.state)} · ${it.id} ${esc(it.ceo && it.ceo.title)}</span>`;
        pBody.innerHTML = `<div class="card"><h4>Its task</h4><p class="pre">${esc(a.task)}</p></div>\n      ${a.said ? `<div class="card"><h4>Last said ${a.lastAt ? "· " + new Date(a.lastAt).toLocaleTimeString("en-US", {
            hour: "numeric",
            minute: "2-digit"
        }) : ""}</h4><p class="pre">${esc(a.said)}</p></div>` : ""}\n      <div class="panel-actions"><button class="topbtn primary" onclick="resumeConvo('${a.sessionId}','${esc(a.cwd)}')">Open its session</button></div>`;
        return;
    }
    const c = it.ceo;
    pTitle.textContent = c ? c.title : "Thinking…";
    const verdictWord = {
        build: "worth building",
        "push-back": "pushing back",
        defer: "not now",
        note: "noted"
    };
    pStatus.innerHTML = `<span class="dot ${it.status === "thinking" || it.status === "running" ? "working" : it.status === "failed" || c && c.verdict === "push-back" ? "needs-you" : "done"}"></span><span>${it.id} · ${it.status === "thinking" ? "Mittens is reading the whole map" : esc(c ? verdictWord[c.verdict] : it.status)}${it.cost ? ` · $${it.cost.toFixed(2)}` : ""}</span>`;
    let h = "";
    if (it.status === "failed") h += `<div class="card"><h4>Mittens could not finish</h4><p class="pre">${esc(it.error)}</p><div class="panel-actions" style="margin-top:10px"><button class="topbtn" onclick="replyIntent({type:'intent',id:'${it.id}'},'try again')">Try again</button></div></div>`;
    if (c) {
        h += `<div class="card why"><h4>What I think you mean</h4><p>${esc(c.interpretation)}</p></div>`;
        h += `<div class="card ${c.verdict === "push-back" ? "argue" : ""}"><h4>${c.verdict === "push-back" ? "I disagree" : c.verdict === "defer" ? "Not yet" : "Why"}</h4><p>${esc(c.argument)}</p></div>`;
        if (c.fits && c.fits.length) h += `<div class="card"><h4>Fits</h4><div class="reads">${c.fits.map(f => `<button onclick="jumpTo('${f}')">${esc(byId[f] && byId[f].label || f)}</button>`).join("")}</div></div>`;
        const ag = c.plan && c.plan.agents || [];
        if (ag.length) {
            const shape = {
                resume: "continue an existing session",
                new: "one new agent",
                parallel: `${ag.length} agents in parallel`
            }[c.plan.mode] || c.plan.mode;
            h += `<div class="card"><h4>Plan · ${esc(shape)}</h4><ul>${ag.map(a => `<li><b>${esc(a.project)}</b>${a.resumeSessionId ? " · resumes " + esc(a.resumeSessionId.slice(0, 8)) : ""}<details><summary>task</summary><p class="pre">${esc(a.task)}</p></details></li>`).join("")}</ul></div>`;
        }
        if (it.peopleApplied && it.peopleApplied.length) h += `<div class="card"><h4>Updated the people graph</h4><ul>${it.peopleApplied.map(p => `<li>${esc(p)}</li>`).join("")}</ul></div>`;
        if ((it.agents || []).length) h += `<div class="card"><h4>Running</h4><ul>${it.agents.map(a => `<li><b onclick="jumpTo('${a.id}')" style="cursor:pointer">${esc(a.project)}</b> · ${esc(a.state)}${a.said ? ` — ${esc(a.said.slice(0, 120))}` : ""}</li>`).join("")}</ul></div>`;
    }
    if (it.thread.length > 1) h += `<div class="card"><h4>Thread</h4><ul>${it.thread.map(m => `<li class="${m.from === "ceo" ? "" : "hot"}"><b>${m.from === "ceo" ? "Mittens" : m.from === "north-star" ? "Mittens" : "You"}</b> ${esc(m.text)}</li>`).join("")}</ul></div>`;
    const canRun = c && it.status === "proposed" && (c.plan && c.plan.agents || []).length;
    h += `<div class="panel-actions">\n    ${canRun ? `<button class="topbtn primary" onclick="intentAct('${it.id}','run')">${c.verdict === "build" ? "Run it" : "Run anyway"}</button>` : ""}\n    ${it.status === "running" ? `<button class="topbtn" onclick="intentAct('${it.id}','close',{status:'done'})">Mark done</button>` : ""}\n    ${[ "proposed", "failed", "thinking" ].includes(it.status) ? `<button class="topbtn" onclick="intentAct('${it.id}','close',{status:'dismissed'})">Drop it</button>` : ""}\n  </div><div class="hint">type below to argue back — Mittens rethinks with the whole thread</div>`;
    if (quiet && pBody.dataset.sig === h) return;
    pBody.dataset.sig = h;
    pBody.innerHTML = h;
};

const focusEl = document.getElementById("focus");

let FOCUS = null, focusBusy = false;

const STATE = {
    you: {
        color: RED,
        word: "your move",
        order: 0
    },
    check: {
        color: RED,
        word: "did you answer?",
        order: 1,
        ring: true
    },
    working: {
        color: "#000",
        word: "happening now",
        order: 2,
        pulse: true
    },
    scheduled: {
        color: "#000",
        word: "scheduled",
        order: 3
    },
    next: {
        color: "#000",
        word: "next step",
        order: 4,
        ring: true
    },
    them: {
        color: "#999",
        word: "waiting on them",
        order: 5
    },
    idle: {
        color: "#BBB",
        word: "quiet",
        order: 6,
        ring: true
    },
    done: {
        color: "#CCC",
        word: "done",
        order: 7
    }
};

const plain = x => String(x == null ? "" : x).replace(/<[^>]+>/g, "").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/\s+/g, " ").trim();

const clip = (x, n) => {
    x = plain(x);
    return x.length > n ? x.slice(0, n - 1) + "…" : x;
};

window.openFocus = function(target, opts) {
    FOCUS = target.id;
    if (window.renderView) window.renderView(target, opts);
    if (!window.NS_PUBLIC) drawFocus(FOCUS, true);
};

window.closeFocus = function() {
    FOCUS = null;
    focusEl.classList.remove("open");
};

window.redrawFocus = () => {
    if (FOCUS && !window.NS_PUBLIC) drawFocus(FOCUS, false);
};

function nodeRows(id) {
    const t = byId[id], d = DETAILS[id] || {}, rows = [];
    (d.asks || []).forEach(q => rows.push({
        kind: "ask",
        group: "questions for you",
        state: "you",
        name: clip(q.title, 70),
        line: q.from ? `from ${q.from}` : "",
        next: "answer in the inbox",
        id: q.id
    }));
    if (d.ask) rows.push({
        kind: "text",
        group: "questions for you",
        state: "you",
        name: clip(d.ask, 80),
        line: ""
    });
    (d.blocked || []).forEach(x => rows.push({
        kind: "text",
        group: "blocked",
        state: "check",
        name: clip(x, 60),
        line: ""
    }));
    const kids = nodes.filter(n => n.parent === id && n.type !== "intent" && n.type !== "agent");
    kids.forEach(k => {
        const kd = DETAILS[k.id] || {};
        const st = k.status === "needs-you" ? "you" : k.status === "working" ? "working" : "idle";
        const grp = st === "you" ? "needs a look" : st === "working" ? "happening now" : k.kind === "routine" || k.id.startsWith("r:") ? "routines" : "parts";
        const why = (kd.blocked || [])[0] || kd.run && kd.run.note || kd.statusLine || k.statusLine || "";
        rows.push({
            kind: "node",
            group: grp,
            state: st,
            name: k.label,
            line: clip(why, 70),
            id: k.id
        });
    });
    if (d.run && !kids.length) {
        const r = d.run;
        rows.push({
            kind: "text",
            group: "last run",
            state: r.status === "running" ? "working" : /fail/.test(r.status) ? "check" : "done",
            name: r.status,
            line: clip([ r.note, Object.entries(r.counts || {}).map(([k, v]) => `${v} ${k}`).join(" · ") ].filter(Boolean).join(" — "), 80)
        });
    }
    (d.today || []).forEach(x => rows.push({
        kind: "text",
        group: "next",
        state: "next",
        name: clip(x, 80),
        line: ""
    }));
    INTENTS.filter(i => i.status === "proposed" && (i.ceo && i.ceo.fits || [ i.project ]).includes(id)).forEach(i => rows.push({
        kind: "node",
        group: "next",
        state: "next",
        name: clip(i.ceo ? i.ceo.title : i.text, 60),
        line: clip(i.ceo && i.ceo.verdict, 40),
        id: i.id
    }));
    if (!rows.length && d.yesterday) d.yesterday.slice(0, 3).forEach(x => rows.push({
        kind: "text",
        group: "lately",
        state: "done",
        name: clip(x, 80),
        line: ""
    }));
    return rows;
}

function drawFocus(pid, animate) {
    const t = byId[pid];
    if (!t) return closeFocus();
    const people = PEOPLE.people.filter(p => p.project === pid && (p.state !== "done" || focusEl.dataset.showDone === "1")).map(p => ({
        kind: "person",
        group: p.group || "other",
        state: p.state,
        name: p.name,
        line: p.line,
        next: p.next,
        id: p.id
    }));
    const host = document.getElementById("vwSketch");
    let rows = [ ...people, ...nodeRows(pid) ];
    if (host) {
        rows = rows.filter(r => r.kind === "person" || [ "you", "check", "working" ].includes(r.state));
        if (!rows.length) {
            host.innerHTML = "";
            return;
        }
    }
    const groups = {};
    rows.sort((a, b) => STATE[a.state].order - STATE[b.state].order).forEach(p => (groups[p.group] ||= []).push(p));
    const G = Object.entries(groups).sort((a, b) => Math.min(...a[1].map(p => STATE[p.state].order)) - Math.min(...b[1].map(p => STATE[p.state].order)));
    const CAP = 6;
    G.forEach(g => {
        const ps = g[1];
        if (ps.length > CAP + 1) {
            const rest = ps.splice(CAP), asks = rest.every(r => r.kind === "ask");
            ps.push({
                kind: asks ? "ask" : "more",
                group: g[0],
                state: "idle",
                name: `+${rest.length} more`,
                line: asks ? "all of them are in the inbox" : "open Status for the full list",
                id: "more"
            });
        }
    });
    const reg = pid === "outreach" ? (PEOPLE.register || {}).sentNoReply : 0;
    const c = PEOPLE.byProject[pid] || {};
    const label = t.label || pid;
    const ROW = 40, GAP = 34, top = 112;
    let y = top;
    const placed = [];
    G.forEach(([g, ps]) => {
        const y0 = y;
        ps.forEach(p => {
            placed.push({
                p: p,
                y: y
            });
            y += ROW + (p.next && (p.state === "you" || p.state === "check") ? 8 : 0);
        });
        placed.push({
            group: g,
            y: (y0 + y - ROW) / 2,
            y0: y0,
            y1: y - ROW
        });
        y += GAP;
    });
    if (reg) {
        placed.push({
            reg: reg,
            y: y
        });
        y += ROW;
    }
    const H = Math.max(y + 20, 300), rootY = Math.max(top, (top + y - GAP - ROW) / 2);
    const short = label.replace(/ HUB$/, "");
    const narrow = innerWidth < 640;
    const X0 = narrow ? 4 : 36, XB = narrow ? X0 + short.length * 11 + 14 : Math.max(180, X0 + short.length * 11 + 30), XG = XB + (narrow ? 34 : 100), XP = XG + (narrow ? 26 : 70);
    const curve = (x1, y1, x2, y2) => `M${x1},${y1} C${(x1 + x2) / 2},${y1} ${(x1 + x2) / 2},${y2} ${x2},${y2}`;
    let paths = "", texts = "", k = 0;
    const d = () => animate ? ` style="animation-delay:${k++ * 45}ms"` : "";
    if (placed.length) paths += `<path class="ink" pathLength="1" d="M${X0 + short.length * 11 + 10},${rootY} L${XB},${rootY}"${d()}/>`;
    placed.filter(q => q.group).forEach(q => {
        paths += `<path class="ink" pathLength="1" d="${curve(XB, rootY, XG, q.y)}"${d()}/>`;
        texts += `<text class="grp" x="${XP + 8}" y="${q.y0 - 21}">${esc(q.group)}</text>`;
    });
    placed.forEach(q => {
        if (q.group) return;
        const gq = q.reg ? null : placed.find(x => x.group && q.y >= x.y0 && q.y <= x.y1);
        const from = gq ? gq : {
            y: rootY
        }, fx = gq ? XG : XB;
        if (q.reg) {
            paths += `<path class="ink faint" pathLength="1" stroke-dasharray="2 5" d="${curve(XB, rootY, XP - 10, q.y)}"${d()}/>`;
            texts += `<text x="${XP + 8}" y="${q.y + 4}"><tspan class="who faint">${q.reg} more</tspan><tspan dx="10" class="line faint">sent, no reply yet — the register holds them</tspan></text>`;
            return;
        }
        const s = STATE[q.p.state] || STATE.idle, off = q.p.state === "done" || q.p.state === "idle";
        paths += `<path class="ink${off ? " faint" : ""}" pathLength="1" d="${curve(fx, from.y, XP - 10, q.y)}"${d()}/>`;
        texts += `<g class="row" data-k="${q.p.kind}" data-id="${esc(q.p.id || "")}">\n      <circle cx="${XP - 4}" cy="${q.y}" r="4.5" fill="${s.ring ? "#FFF" : s.color}" stroke="${s.color}" stroke-width="1.6">${s.pulse ? '<animate attributeName="opacity" values="1;.25;1" dur="1.6s" repeatCount="indefinite"/>' : ""}</circle>\n      <text x="${XP + 8}" y="${q.y + 4}"><tspan class="who${off ? " off" : ""}">${esc(q.p.name)}</tspan>${q.p.line ? `<tspan dx="8" class="line${q.p.state === "them" || off ? " wait" : ""}">— ${esc(q.p.line)}</tspan>` : ""}</text>\n      ${q.p.next && (q.p.state === "you" || q.p.state === "check") ? `<text x="${XP + 8}" y="${q.y + 19}" class="next">→ ${esc(q.p.next)}</text>` : ""}\n    </g>`;
    });
    texts += `<text class="root" x="${X0}" y="${rootY + 6}">${esc(short)}</text>`;
    const W = Math.round(XP + 24 + Math.max(200, ...placed.filter(q => q.p).map(q => q.p.name.length * 8.2 + (q.p.line ? q.p.line.length * 7 + 20 : 0))));
    const owed = people.filter(p => p.state === "you" || p.state === "check").length + rows.filter(r => r.kind !== "person" && (r.state === "you" || r.state === "check")).length;
    const happening = rows.filter(r => r.state === "working").length, nexts = rows.filter(r => r.state === "next").length;
    const sub = people.length ? `${c.scheduled || 0} scheduled · ${c.them || 0} waiting on them${reg ? ` · ${reg} sent, no reply` : ""} · ${happening} happening · ${nexts} next · click a row` : `${happening} happening · ${nexts} next step${nexts === 1 ? "" : "s"}${rows.length ? " · click a row" : " · nothing open here"}`;
    const sketch = `\n    <div class="focus-head">\n      <div class="big"><b class="${owed ? "red" : ""}">${owed}</b> waiting on you</div>\n      <div class="sub">${sub}</div>\n    </div>\n    <svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" style="max-width:none" class="${animate ? "draw" : ""}">${paths}${texts}</svg>`;
    if (host) {
        if (host.dataset.sig !== sketch || animate) {
            host.dataset.sig = sketch;
            host.innerHTML = sketch;
        }
    } else focusEl.innerHTML = sketch + `<div class="focus-pop" id="focusPop" hidden></div>`;
    focusEl.classList.add("open");
    (host || focusEl).querySelectorAll("g.row[data-id]").forEach(g => g.onclick = e => {
        const k = g.dataset.k, id = g.dataset.id;
        if (!id) return;
        if (k === "person") return personPop(id, e);
        if (k === "ask") return window.openInbox && window.openInbox(pid);
        if (k === "more") return openPanel(byId[pid], "status");
        if (byId[id]) return jumpTo(id);
    });
}

function personRecord(id) {
    const api = (PEOPLE.people || []).find(x => x.id === id);
    const map = (DATA && DATA.people || []).find(x => x.id === id || api && x.name === api.name);
    if (!api && !map) return null;
    const p = {
        ...map || {},
        ...api || {}
    };
    p.conversation = api && api.conversation && api.conversation.length ? api.conversation : map && map.timeline || [];
    p.channels = p.channels || [];
    return p;
}

const DIR = {
    out: {
        m: "↑",
        w: "you"
    },
    in: {
        m: "↓",
        w: "them"
    },
    met: {
        m: "●",
        w: "met"
    },
    note: {
        m: "·",
        w: "noted"
    }
};

const convDate = at => {
    const d = new Date(at);
    return isNaN(d) ? "" : d.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric"
    });
};

function personPop(id, e) {
    const p = personRecord(id);
    if (!p) return;
    const pop = document.getElementById("focusPop");
    focusBusy = true;
    const reg = p.source === "register";
    const conv = (p.conversation || []).slice().sort((a, b) => String(a.at).localeCompare(String(b.at)));
    const due = p.nextDue ? ` <b>· ${esc(String(p.nextDue).slice(0, 10))}</b>` : "";
    const next = p.nextAction || p.next;
    pop.className = "focus-pop wide";
    pop.innerHTML = `<h5>${esc(p.name)}${p.org ? ` <span>· ${esc(p.org)}</span>` : ""}</h5>\n    <div class="hint">${esc(STATE[p.state] ? STATE[p.state].word : p.state || "")}${p.channels.length ? " · " + p.channels.map(esc).join(" · ") : ""}${p.updatedAt ? " · updated " + convDate(p.updatedAt) : ""}</div>\n    ${p.line ? `<p>${esc(p.line)}</p>` : ""}\n    ${conv.length ? `<div class="conv"><h6>what happened</h6>${conv.map(c => `\n      <div class="conv-row"><span class="d">${esc(convDate(c.at))}</span><span class="m ${esc(c.dir || "note")}">${(DIR[c.dir] || DIR.note).m}</span>\n      <span class="t">${c.link ? `<a href="${esc(c.link)}" target="_blank">${esc(c.what)}</a>` : esc(c.what)}<i>${esc(c.channel || "")}</i></span></div>`).join("")}</div>` : `<p class="hint">No dated conversation on file yet — the register has no reply and no chat thread matches this name.</p>`}\n    ${p.theySuggested ? `<div class="conv"><h6>they suggested</h6><p>${esc(p.theySuggested)}</p></div>` : ""}\n    ${next ? `<div class="conv"><h6>next</h6><p class="nextline">${esc(next)}${due}</p></div>` : ""}\n    ${p.owes ? `<div class="conv"><h6>you owe</h6><p>${esc(p.owes)}</p></div>` : ""}\n    ${""}\n    ${(p.briefs || []).length ? `<div class="conv"><h6>briefs read for this</h6>${p.briefs.map(b => `<div class="conv-row"><span class="t">${esc(b.title)}<i>${esc(String(b.path || "").split("/").pop())}</i></span></div>`).join("")}</div>` : ""}\n    <div class="hint">from ${esc((p.sources || [ p.source || "?" ]).join(" + "))}${(p.registerIds || []).length ? " · " + p.registerIds.map(esc).join(", ") : ""}</div>\n    <div class="row">\n      ${p.threadId ? `<a class="topbtn" target="_blank" href="${gmailUrl(p.threadId)}">Open thread</a>` : ""}\n      <button class="topbtn" data-s="them">I replied</button>\n      <button class="topbtn" data-s="you">My move</button>\n      <button class="topbtn" data-s="done">Done</button>\n    </div>`;
    const box = focusEl.getBoundingClientRect();
    pop.style.left = Math.min(e.clientX - box.left + 10, Math.max(8, box.width - 440)) + "px";
    pop.style.top = Math.max(8, Math.min(e.clientY - box.top + 14, box.height - 120)) + focusEl.scrollTop + "px";
    pop.hidden = false;
    pop.querySelectorAll("button[data-s]").forEach(b => b.onclick = async () => {
        const line = b.dataset.s === "them" ? `you replied ${(new Date).toLocaleDateString("en-US", {
            month: "numeric",
            day: "numeric"
        })}` : undefined;
        const r = await api("/api/people", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                name: p.name,
                project: p.project,
                group: p.group,
                org: p.org,
                state: b.dataset.s,
                line: line || (reg ? p.line : undefined)
            })
        });
        tick(r.ok ? `<b>${esc(p.name)}</b> · ${STATE[b.dataset.s].word}` : `<b>${esc(p.name)}</b> · not saved`);
        focusBusy = false;
        pop.hidden = true;
        poll();
    });
}

window.personPop = personPop;

document.addEventListener("pointerdown", e => {
    const pop = document.getElementById("focusPop");
    if (pop && !pop.hidden && !pop.contains(e.target) && !e.target.closest("g.row") && !e.target.closest("[data-person]")) {
        pop.hidden = true;
        focusBusy = false;
    }
});

document.addEventListener("keydown", e => {
    if (e.key === "Escape") (window.nsEscape || closePanel)();
});

const askBox = document.getElementById("askBox");

askBox.addEventListener("keydown", e => {
    if (e.key === "Enter" && askBox.value.trim()) {
        sendIntent(askBox.value.trim(), null);
        askBox.value = "";
    }
});

document.getElementById("reviewBtn").onclick = async () => {
    const r = await api("/api/review", {
        method: "POST"
    });
    tick(r.ok ? "<b>north-star</b> · Mittens is looking over the whole map for a next move" : "<b>north-star</b> · review only runs on the Mac");
    setTimeout(poll, 1500);
};

poll();
