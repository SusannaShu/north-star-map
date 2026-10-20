(function() {
    const focusEl = document.getElementById("focus");
    const SVGNS = "http://www.w3.org/2000/svg";
    let VIEW = null, seq = 0;
    const clip = (x, n) => {
        x = String(x == null ? "" : x).replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();
        return x.length > n ? x.slice(0, n - 1).replace(/\s+\S*$/, "") + "…" : x;
    };
    const firstSentence = x => clip(String(x || "").replace(/<[^>]+>/g, "").split(/(?<=[.!?])\s/)[0], 140);
    const hash = s => {
        let h = 2166136261;
        for (const c of String(s)) {
            h ^= c.charCodeAt(0);
            h = Math.imul(h, 16777619);
        }
        return h >>> 0;
    };
    const rnd = seed => () => {
        seed = seed * 1664525 + 1013904223 >>> 0;
        return seed / 4294967296;
    };
    const ST = s => typeof STATE !== "undefined" && STATE[s] || {
        color: "#BBB",
        word: s || "",
        ring: true
    };
    const kidsOf = id => nodes.filter(n => n.parent === id || DETAILS[n.id] && DETAILS[n.id].parent === id && n.type === "project").filter(n => n.type !== "intent" && n.type !== "agent");
    const statusDot = st => st === "needs-you" ? "needs-you" : st === "working" ? "working" : st === "planned" ? "planned" : st === "dormant" ? "dormant" : "done";
    const mins = s => s == null ? "" : s < 90 ? `${Math.round(s)}s` : s < 5400 ? `${Math.round(s / 60)} min` : `${(s / 3600).toFixed(1)} h`;
    window.renderView = function(target, opts) {
        const id = target.id, n = byId[id] || target, d = DETAILS[id] || {};
        VIEW = id;
        const parts = [];
        parts.push(`<div id="vwAgents">${agentStrip(id)}</div>`);
        const hero = [];
        (d.cases || (d.case ? [ d.case ] : [])).forEach(c => hero.push(caseCard(c)));
        if (d.paper) hero.push(paperCard(d.paper, id));
        (d.docs || []).filter(x => x.thumb).forEach(x => hero.push(docCard(x)));
        const imgs = [ ...d.image && !(d.images || []).includes(d.image) && !(d.case && d.case.image === d.image) ? [ d.image ] : [], ...d.images || [] ];
        imgs.forEach(src => hero.push(imgCard(src)));
        if (d.view === "location" || id === "location") parts.push(locationBlock());
        if (d.kind === "ptype") parts.push(clusterBlock(d));
        if (d.deadline || d.checklist) parts.push(deadlineBlock(d));
        if (hero.length) parts.push(`<div class="vw-cards">${hero.join("")}</div>`);
        const linked = (DATA.peopleAt || {})[id] || [];
        if (linked.length) parts.push(peopleRow(linked));
        if (d.embed) parts.push(`<div class="vw-block"><div class="vw-cap">${esc(d.embedCaption || (id === "skin-build" || id === "robot-skin" ? "the layer stack, part by part" : "the page"))} · <a href="${esc(macUrl(d.embed))}" target="_blank">open full ↗</a></div>\n    <iframe class="vw-embed" src="${esc(macUrl(d.embed))}" loading="lazy" title="${esc(n.label)}"></iframe></div>`);
        if (d.stack) parts.push(`<div class="vw-block"><div class="vw-cap">stack &amp; how it works · <a href="${esc(macUrl(d.stack))}" target="_blank">open full ↗</a></div>\n    <iframe class="vw-embed" src="${esc(macUrl(d.stack))}" loading="lazy" title="stack"></iframe></div>`);
        const graph = opts && opts.noGraph ? "" : subgraph(id);
        if (graph) parts.push(graph);
        if (d.hasFlow || id.startsWith("r:")) parts.push(`<div class="vw-block"><div class="vw-cap">flow</div><div class="vw-flow" id="vwFlow"><div class="hint">drawing…</div></div></div>`);
        const tl = timeline(id, d);
        if (tl) parts.push(tl);
        const refs = (d.refs || []).filter(r => r && r.href);
        if (refs.length) parts.push(`<div class="vw-links">${refs.map(r => `<a href="${esc(macUrl(r.href))}" target="_blank" rel="noopener">↗ ${esc(clip(r.label, 46))}</a>`).join("")}</div>`);
        const pp = paperRail(id);
        if (pp) parts.push(pp);
        const cap = d.caption || firstSentence(d.why || d.statusLine || "");
        const isPlan = (n.stage || d.stage) === "plan" && n.status !== "dormant";
        const sl = d.statusLine && d.statusLine !== cap ? d.statusLine : "";
        focusEl.innerHTML = `\n    <div class="vw">\n      <div class="vw-head">\n        <div class="vw-title">${isPlan ? `<span class="plan-ico">${window.NS_SVG_PLAN || ""}</span>` : `<span class="dot ${statusDot(n.status)}"></span>`}${esc(n.label || id)}${isPlan ? '<span class="stage-chip" title="a plan page exists; nothing has been executed yet">plan · not started</span>' : ""}</div>\n        ${cap ? `<div class="vw-sub">${esc(cap)}</div>` : ""}\n        ${sl ? `<div class="vw-meta">${esc(clip(sl, 90))}</div>` : ""}\n      </div>\n      ${parts.join("")}\n    </div>\n    <div id="vwSketch"></div>\n    <div class="focus-pop" id="focusPop" hidden></div>`;
        focusEl.classList.add("open");
        focusEl.scrollTop = 0;
        wire(id, d);
    };
    function wire(id, d) {
        focusEl.querySelectorAll("[data-jump]").forEach(el => el.onclick = e => {
            e.stopPropagation();
            const j = el.dataset.jump;
            if (byId[j]) jumpTo(j);
        });
        focusEl.querySelectorAll("[data-person]").forEach(el => el.onclick = e => {
            e.stopPropagation();
            personAt(el.dataset.person, el.dataset.reg, e);
        });
        if (d.hasFlow || id.startsWith("r:")) drawFlowInto(id);
        if (d.view === "location" || id === "location") mountMap();
    }
    function workersFor(id) {
        const own = (window.agentsOn ? window.agentsOn(id) : []).slice();
        kidsOf(id).forEach(k => (window.agentsOn ? window.agentsOn(k.id) : []).forEach(w => own.push({
            ...w,
            on: k.label
        })));
        return own;
    }
    function agentStrip(id) {
        const w = workersFor(id);
        if (!w.length) return "";
        if (window.NS_PUBLIC) return `<div class="vw-agents"><div class="vw-agent"><span class="vw-pulse"></span><b>${w.length} agent${w.length > 1 ? "s" : ""} working here</b></div></div>`;
        return `<div class="vw-agents">${w.map(x => `<div class="vw-agent"><span class="vw-pulse"></span>\n    <b>${esc(clip(x.label || x.id, 40))}</b>${x.on ? `<i>on ${esc(x.on)}</i>` : ""}<span class="vw-now">${esc(clip(x.now || "working", 90))}</span>\n    <span class="vw-el">${mins(x.elapsedSeconds != null ? x.elapsedSeconds : x.since ? (Date.now() - Date.parse(x.since)) / 1e3 : null)}</span></div>`).join("")}</div>`;
    }
    setInterval(() => {
        if (!VIEW || !focusEl.classList.contains("open")) return;
        const el = document.getElementById("vwAgents");
        if (!el) return;
        const h = agentStrip(VIEW);
        if (el.dataset.sig !== h) {
            el.dataset.sig = h;
            el.innerHTML = h;
        }
    }, 2e3);
    const onErr = `onerror="this.closest('.vw-card').classList.add('noimg')"`;
    function caseCard(c) {
        if (!c.href) return `<div class="vw-card case"><img src="${esc(macUrl(c.image))}" alt="" loading="lazy" ${onErr}><span class="vw-ct">${esc(c.title || "case study")}</span></div>`;
        return `<a class="vw-card case" href="${esc(c.href)}" target="_blank" rel="noopener">\n    <img src="${esc(macUrl(c.image))}" alt="" loading="lazy" ${onErr}><span class="vw-tag">portfolio ↗</span><span class="vw-ct">${esc(c.title || "case study")}</span></a>`;
    }
    function imgCard(src) {
        return `<a class="vw-card" href="${esc(macUrl(src))}" target="_blank" rel="noopener"><img src="${esc(macUrl(src))}" alt="" loading="lazy" ${onErr}></a>`;
    }
    function docCard(x) {
        return `<a class="vw-card doc" href="${esc(macUrl(x.href))}" target="_blank" rel="noopener"><img src="${esc(macUrl(x.thumb))}" alt="" loading="lazy" ${onErr}>\n    <span class="vw-tag">PDF</span><span class="vw-ct">${esc(x.label)}</span></a>`;
    }
    function paperCard(p, id) {
        const R = rnd(hash(id));
        let fib = "";
        for (let k = 0; k < 7; k++) {
            const y = 30 + k * 13, a = 4 + R() * 5, ph = R() * 6;
            let dd = `M14,${y}`;
            for (let x = 14; x <= 226; x += 6) dd += ` L${x},${(y + Math.sin(x / 14 + ph) * a).toFixed(1)}`;
            fib += `<path d="${dd}" fill="none" stroke="#000" stroke-width="${k % 3 ? 1 : 2.2}" stroke-linecap="round" opacity="${k % 3 ? .35 : .9}">\n      <animate attributeName="stroke-dashoffset" from="0" to="-24" dur="${2 + k * .3}s" repeatCount="indefinite"/></path>`;
        }
        return `<div class="vw-card paper"><svg viewBox="0 0 240 130" class="vw-fibers">${fib.replace(/<path /g, '<path stroke-dasharray="10 2" ')}</svg>\n    <span class="vw-tag">${esc(p.venue || "paper")}</span><span class="vw-ct">${esc(p.title)}</span><span class="vw-cs">${esc(clip(p.authors || "", 60))}</span></div>`;
    }
    const TRIAL_WORD = {
        on: "IN USE",
        testing: "TESTING",
        off: "TRIED · OFF"
    };
    function paperTile(r) {
        const big = r.number ? clip(r.number.replace(/percentage points?/i, "pts").replace(/\s*(end-to-end|on |across |with |balanced|accuracy).*$/i, ""), 22) : clip(r.venue || "paper", 22);
        return `<a class="vw-pp" href="${esc(r.link)}" target="_blank" rel="noopener">\n    <div class="vw-pp-pic"><span class="vw-pp-who">${esc(clip(r.lab || r.venue || "", 34))}</span>${r.trial ? `<span class="vw-pp-st ${esc(r.trial.state)}">${TRIAL_WORD[r.trial.state] || ""}</span>` : ""}<b>${esc(big)}</b></div>\n    <div class="vw-pp-body"><h4>${esc(clip(r.title, 90))}</h4>${r.number ? `<p>${esc(clip(r.number, 110))}</p>` : ""}\n    <div class="vw-pp-for"><i>FOR YOU</i>${esc(clip(r.means, 200))}</div>\n    ${r.trial ? `<div class="vw-pp-for"><i>TRIED</i>${esc(clip(r.trial.line, 160))}</div>` : ""}\n    <div class="vw-pp-src">${esc(clip(r.venue || "", 24))}${r.date ? " · " + esc(r.date) : ""} ↗</div></div></a>`;
    }
    function paperRail(id) {
        const P = !window.NS_PUBLIC && DATA && DATA.papers;
        if (!P) return "";
        const own = (P.byDot || {})[id] || [], sys = id === "context-graph" ? P.system || [] : [];
        let h = "";
        if (sys.length) h += `<div class="vw-block"><div class="vw-cap">use in our system · ${sys.filter(r => r.trial && r.trial.state === "on").length} in use · <a href="/research-watch.html" target="_blank">research watch ↗</a></div>\n    <div class="vw-pps">${sys.map(paperTile).join("")}</div></div>`;
        const rest = own.filter(r => !sys.some(x => x.id === r.id));
        if (rest.length) h += `<div class="vw-block"><div class="vw-cap">papers for this dot · ${rest.length}</div><div class="vw-pps">${rest.map(paperTile).join("")}</div></div>`;
        return h;
    }
    function placeholder(id, n) {
        const R = rnd(hash(id));
        let g = "";
        const planned = n.planned || n.status === "planned";
        for (let k = 0; k < 4; k++) g += `<circle cx="120" cy="80" r="${18 + k * 15}" fill="none" stroke="#000" stroke-width="1" stroke-dasharray="${1 + k + " " + (3 + k * 2)}" opacity="${.5 - k * .1}">\n    <animateTransform attributeName="transform" type="rotate" from="0 120 80" to="${k % 2 ? -360 : 360} 120 80" dur="${40 + k * 18}s" repeatCount="indefinite"/></circle>`;
        for (let k = 0; k < 9; k++) {
            const a = R() * 6.283, r = 18 + R() * 62;
            g += `<circle cx="${(120 + Math.cos(a) * r).toFixed(1)}" cy="${(80 + Math.sin(a) * r * .8).toFixed(1)}" r="${(1.5 + R() * 3).toFixed(1)}" fill="${R() > .7 ? "#000" : "#BBB"}"/>`;
        }
        g += `<circle cx="120" cy="80" r="7" fill="${planned ? "#FFF" : "#000"}" stroke="${planned ? "#9A9A9A" : "#000"}" stroke-width="1.4"/>`;
        return `<div class="vw-card ph"><svg viewBox="0 0 240 160">${g}</svg>${planned ? '<span class="vw-tag">planned</span>' : ""}<span class="vw-ct">${esc(n.label || id)}</span></div>`;
    }
    function deadlineBlock(d) {
        const items = d.checklist || [], done = items.filter(x => x[1]).length, frac = items.length ? done / items.length : 0;
        const days = d.deadline ? Math.ceil((new Date(d.deadline + "T23:59:59") - Date.now()) / 864e5) : null;
        const C = 2 * Math.PI * 52;
        const dots = items.map((x, i) => {
            const a = -Math.PI / 2 + (i + .5) / items.length * Math.PI * 2, cx = 80 + Math.cos(a) * 70, cy = 80 + Math.sin(a) * 70;
            return `<circle cx="${cx.toFixed(1)}" cy="${cy.toFixed(1)}" r="5" fill="${x[1] ? "#000" : "#FFF"}" stroke="#000" stroke-width="1.4"><title>${esc(x[0])}</title></circle>`;
        }).join("");
        const legend = items.map(x => `<li class="${x[1] ? "on" : ""}">${esc(x[0])}</li>`).join("");
        return `<div class="vw-block vw-dead"><svg viewBox="0 0 160 160" class="vw-ring">\n      <circle cx="80" cy="80" r="52" fill="none" stroke="#EEE" stroke-width="9"/>\n      <circle cx="80" cy="80" r="52" fill="none" stroke="#000" stroke-width="9" stroke-linecap="round" stroke-dasharray="${(C * frac).toFixed(1)} ${C.toFixed(1)}" transform="rotate(-90 80 80)">\n        <animate attributeName="stroke-dasharray" from="0 ${C.toFixed(1)}" to="${(C * frac).toFixed(1)} ${C.toFixed(1)}" dur=".9s" fill="freeze"/></circle>\n      ${dots}\n      <text x="80" y="80" text-anchor="middle" class="vw-big">${days != null ? days : done}</text>\n      <text x="80" y="98" text-anchor="middle" class="vw-small">${days != null ? "days left" : "done"}</text>\n    </svg>\n    <div><div class="vw-cap">${done}/${items.length} done${d.deadline ? " · due " + esc(d.deadline) : ""}</div><ul class="vw-check">${legend}</ul></div></div>`;
    }
    function subgraph(id) {
        const me = byId[id];
        if (!me) return "";
        const kids = id === nodes[0].id ? nodes.filter(n => n.type === "project" && !n.sub) : kidsOf(id);
        const cross = [];
        links.forEach(l => {
            if (!(l.cross || l.vision)) return;
            const o = l.s.id === id ? l.t : l.t.id === id ? l.s : null;
            if (o && !kids.includes(o) && !cross.includes(o)) cross.push(o);
        });
        const parent = me.parent ? byId[me.parent] : DETAILS[id] && DETAILS[id].parent ? byId[DETAILS[id].parent] : null;
        if (parent && !cross.includes(parent)) cross.unshift(parent);
        if (!kids.length && cross.length < 2) return "";
        const deep = innerWidth >= 640 && kids.some(k => kidsOf(k.id).length);
        const W = Math.max(300, Math.min(760, (focusEl.clientWidth || 700) - 40)), H = kids.length > 8 || deep ? 380 : 290, cx = W / 2, cy = H / 2;
        const r1 = Math.min(W * .3, H * .36), r2 = Math.min(W * .46, H * .47);
        let edges = "", dots = "", k = 0;
        const node = (n, x, y, small) => {
            const st = n.status, planned = n.planned || st === "planned", r = small ? 6 : n.type === "project" ? 11 : 8;
            const fill = st === "working" ? "#000" : st === "dormant" ? "#EEE" : "#FFF", stroke = st === "dormant" ? "#BBB" : planned ? "#9A9A9A" : "#000";
            const lab = clip(n.label, 26), anchor = x < cx - 8 ? "end" : x > cx + 8 ? "start" : "middle", lx = anchor === "end" ? x - r - 5 : anchor === "start" ? x + r + 5 : x;
            const ly = anchor === "middle" ? y < cy ? y - r - 6 : y + r + 13 : y + 4;
            const delay = k++ * 40;
            return `<g class="vw-n" data-jump="${esc(n.id)}" style="animation-delay:${delay}ms">\n      <circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${r}" fill="${fill}" stroke="${stroke}" stroke-width="${small ? 1.1 : planned ? 1.2 : 1.6}">${st === "working" ? '<animate attributeName="opacity" values="1;.35;1" dur="1.6s" repeatCount="indefinite"/>' : ""}</circle>\n      ${st === "needs-you" ? `<circle cx="${(x + r * .75).toFixed(1)}" cy="${(y - r * .75).toFixed(1)}" r="3.4" fill="#D32F2F" stroke="#FFF" stroke-width="1.2"/>` : ""}\n      ${n.find ? `<text x="${x.toFixed(1)}" y="${(y + 3.5).toFixed(1)}" text-anchor="middle" class="vw-q">?</text>` : ""}\n      <text x="${lx.toFixed(1)}" y="${ly.toFixed(1)}" text-anchor="${anchor}" class="${small ? "vw-l2" : "vw-l1"}">${esc(lab)}</text></g>`;
        };
        kids.forEach((n, i) => {
            const a = -Math.PI / 2 + i / kids.length * Math.PI * 2 + (kids.length === 2 ? Math.PI / 2 : 0), x = cx + Math.cos(a) * r1, y = cy + Math.sin(a) * r1 * .8;
            edges += `<path d="M${cx},${cy} L${x.toFixed(1)},${y.toFixed(1)}" class="vw-e"/>`;
            if (agentsHere(n.id)) edges += `<circle r="2.6" fill="#000"><animateMotion dur="1.6s" repeatCount="indefinite" path="M${cx},${cy} L${x.toFixed(1)},${y.toFixed(1)}"/></circle>`;
            dots += node(n, x, y, false);
            const gk = id === nodes[0].id || W < 520 ? [] : kidsOf(n.id).slice(0, 7);
            gk.forEach((g, j) => {
                const ga = a + (j - (gk.length - 1) / 2) * (.34 / Math.max(1, kids.length / 5)), gr = r1 + Math.min(70, r2 - r1 + 18);
                const gx = cx + Math.cos(ga) * gr, gy = cy + Math.sin(ga) * gr * .8;
                edges += `<path d="M${x.toFixed(1)},${y.toFixed(1)} L${gx.toFixed(1)},${gy.toFixed(1)}" class="vw-e"/>`;
                dots += node(g, gx, gy, true);
            });
        });
        cross.slice(0, 10).forEach((n, i, A) => {
            const a = -Math.PI / 2 + (i + (kids.length ? .5 : 0)) / A.length * Math.PI * 2, rr = kids.length ? r2 : r1 * 1.2, x = cx + Math.cos(a) * rr, y = cy + Math.sin(a) * rr * .85;
            edges += `<path d="M${cx},${cy} L${x.toFixed(1)},${y.toFixed(1)}" class="vw-e x"/>`;
            dots += node(n, x, y, true);
        });
        const st = me.status, planned = me.planned || st === "planned";
        const center = `<circle cx="${cx}" cy="${cy}" r="16" fill="${me.type === "hub" || st === "working" ? "#000" : "#FFF"}" stroke="${planned ? "#9A9A9A" : "#000"}" stroke-width="${planned ? 1.6 : 2.2}"/>`;
        return `<div class="vw-block"><div class="vw-cap">${kids.length ? `${kids.length} part${kids.length > 1 ? "s" : ""}` : ""}${kids.length && cross.length ? " · " : ""}${cross.length ? "touches " + cross.length : ""}</div>\n    <svg class="vw-graph" viewBox="0 0 ${W} ${H}" width="100%">${edges}${center}${dots}</svg></div>`;
    }
    const agentsHere = id => (window.agentsOn ? window.agentsOn(id) : []).length > 0;
    async function drawFlowInto(id) {
        const box = () => document.getElementById("vwFlow");
        try {
            const f = await fetchFlow(id);
            if (VIEW !== id || !box()) return;
            if (!f.flow) {
                box().innerHTML = `<div class="hint">no flow drawn yet — add a ## Flow block (Skill tab)</div>`;
                return;
            }
            const {svg: svg} = await (await nsMermaid()).render("vwflow" + ++seq, f.flow);
            if (VIEW === id && box()) box().innerHTML = svg;
        } catch (e) {
            if (box()) box().innerHTML = `<div class="hint">flow unavailable here</div>`;
        }
    }
    function timeline(id, d) {
        const runs = [];
        const take = (r, label) => {
            if (r && r.startedAt) runs.push({
                t: r.startedAt,
                s: r.status,
                label: label
            });
        };
        if (d.run) take(d.run, d.label || id);
        kidsOf(id).forEach(k => {
            const kd = DETAILS[k.id] || {};
            take(kd.run, k.label);
        });
        if (!runs.length) return "";
        const day0 = new Date;
        day0.setHours(0, 0, 0, 0);
        const W = 640, x = t => 16 + Math.max(0, Math.min(1, (t - day0) / 864e5)) * (W - 32);
        const now = x(Date.now());
        let marks = "";
        for (let h = 0; h <= 24; h += 6) marks += `<line x1="${x(+day0 + h * 36e5)}" x2="${x(+day0 + h * 36e5)}" y1="34" y2="40" stroke="#CCC"/><text x="${x(+day0 + h * 36e5)}" y="54" text-anchor="middle" class="vw-l2">${h === 24 ? "" : (h % 12 || 12) + (h < 12 ? "a" : "p")}</text>`;
        const dots = runs.filter(r => r.t >= +day0 - 6 * 36e5).map(r => {
            const bad = /limit|fail/.test(r.s), live = r.s === "running";
            return `<circle cx="${x(r.t).toFixed(1)}" cy="37" r="${live ? 5.5 : 4.5}" fill="${bad ? "#D32F2F" : live ? "#000" : "#FFF"}" stroke="${bad ? "#D32F2F" : "#000"}" stroke-width="1.4"><title>${esc(r.label)} · ${esc(r.s)}</title>${live ? '<animate attributeName="r" values="4.5;7;4.5" dur="1.4s" repeatCount="indefinite"/>' : ""}</circle>`;
        }).join("");
        return `<div class="vw-block"><div class="vw-cap">runs today · ${runs.length}</div><svg class="vw-tl" viewBox="0 0 ${W} 60" width="100%">\n    <line x1="16" x2="${W - 16}" y1="37" y2="37" stroke="#DDD"/>${marks}<line x1="${now}" x2="${now}" y1="22" y2="44" stroke="#000" stroke-dasharray="2 2"/>${dots}</svg></div>`;
    }
    function personRec(id) {
        return (typeof PEOPLE !== "undefined" && PEOPLE.people || []).find(p => p.id === id) || (DATA.people || []).find(p => p.id === id);
    }
    function peopleRow(ids) {
        const ps = ids.map(personRec).filter(Boolean);
        if (!ps.length) return "";
        return `<div class="vw-block"><div class="vw-cap">people on this</div><div class="vw-people">${ps.map(p => {
            const s = ST(p.state), ini = String(p.name || "?").split(/\s+/).map(w => w[0]).slice(0, 2).join("");
            return `<button class="vw-person" data-person="${esc(p.id)}"><span class="vw-av" style="border-color:${s.color};${s.ring ? "" : `background:${s.color};color:#FFF`}">${esc(ini)}</span><b>${esc(p.name)}</b><i>${esc(clip(p.org || "", 28))}</i></button>`;
        }).join("")}</div></div>`;
    }
    function clusterBlock(d) {
        if (!d.people && d.count != null) return anonCluster(d);
        const ps = (d.people || []).slice().sort((a, b) => ST(a.state).order - ST(b.state).order);
        const W = Math.max(300, Math.min(760, (focusEl.clientWidth || 700) - 40)), H = Math.max(300, Math.min(520, 160 + ps.length * 7)), cx = W / 2, cy = H / 2;
        const named = innerWidth < 640 ? 10 : 18;
        let g = `<circle cx="${cx}" cy="${cy}" r="14" fill="#FFF" stroke="#000" stroke-width="2"/>`;
        for (let k = 0; k < 3; k++) {
            const a = k * 2.094 - Math.PI / 2;
            g += `<circle cx="${(cx + Math.cos(a) * 6).toFixed(1)}" cy="${(cy + Math.sin(a) * 6).toFixed(1)}" r="2" fill="#000"/>`;
        }
        ps.forEach((p, i) => {
            const a = i * 2.39996, r = 34 + Math.sqrt(i + 1) * Math.min(W, H) * .085, x = cx + Math.cos(a) * r * (W / H > 1.3 ? 1.35 : 1), y = cy + Math.sin(a) * r * .82;
            if (x < 8 || x > W - 8 || y < 8 || y > H - 8) return;
            const s = ST(p.state);
            g += `<g class="vw-n" data-person="${esc(p.id || "")}" data-reg="${esc(i)}" style="animation-delay:${i * 18}ms">\n      <line x1="${cx}" y1="${cy}" x2="${x.toFixed(1)}" y2="${y.toFixed(1)}" stroke="#F0F0F0"/>\n      <circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="5" fill="${s.ring ? "#FFF" : s.color}" stroke="${s.color}" stroke-width="1.5"><title>${esc(p.name)} · ${esc(p.org)} · ${esc(s.word)}</title></circle>\n      ${i < named ? `<text x="${(x + 8).toFixed(1)}" y="${(y + 3.5).toFixed(1)}" class="vw-l2">${esc(clip(p.name, 22))}</text>` : ""}</g>`;
        });
        const by = {};
        ps.forEach(p => {
            by[p.state] = (by[p.state] || 0) + 1;
        });
        const legend = Object.entries(by).sort((a, b) => ST(a[0]).order - ST(b[0]).order).map(([k, v]) => {
            const s = ST(k);
            return `<span><i style="border-color:${s.color};${s.ring ? "" : "background:" + s.color}"></i>${v} ${esc(s.word)}</span>`;
        }).join("");
        const feeds = (d.links || []).map(l => `<button data-jump="${esc(l)}">${esc(byId[l] && byId[l].label || l)}</button>`).join("");
        CLUSTER = ps;
        return `<div class="vw-block"><div class="vw-legend">${legend}</div><svg class="vw-graph" viewBox="0 0 ${W} ${H}" width="100%">${g}</svg>\n    ${feeds ? `<div class="vw-feeds"><span>feeds</span>${feeds}</div>` : ""}</div>`;
    }
    let CLUSTER = [];
    function anonCluster(d) {
        const n = Math.min(d.count || 0, 160), W = Math.max(300, Math.min(760, (focusEl.clientWidth || 700) - 40)), H = Math.max(240, Math.min(440, 140 + n * 5)), cx = W / 2, cy = H / 2;
        let g = `<circle cx="${cx}" cy="${cy}" r="14" fill="#FFF" stroke="#000" stroke-width="2"/>`;
        for (let k = 0; k < 3; k++) {
            const a = k * 2.094 - Math.PI / 2;
            g += `<circle cx="${(cx + Math.cos(a) * 6).toFixed(1)}" cy="${(cy + Math.sin(a) * 6).toFixed(1)}" r="2" fill="#000"/>`;
        }
        for (let i = 0; i < n; i++) {
            const a = i * 2.39996, r = 30 + Math.sqrt(i + 1) * Math.min(W, H) * .075, x = cx + Math.cos(a) * r * (W / H > 1.3 ? 1.35 : 1), y = cy + Math.sin(a) * r * .82;
            if (x < 8 || x > W - 8 || y < 8 || y > H - 8) continue;
            g += `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="4.5" fill="#FFF" stroke="#000" stroke-width="1.3" style="animation:vwIn .5s ease both;animation-delay:${i * 14}ms"/>`;
        }
        const feeds = (d.links || []).map(l => `<button data-jump="${esc(l)}">${esc(byId[l] && byId[l].label || l)}</button>`).join("");
        return `<div class="vw-block"><div class="vw-cap">${d.count} people</div><svg class="vw-graph" viewBox="0 0 ${W} ${H}" width="100%">${g}</svg>\n    ${feeds ? `<div class="vw-feeds"><span>feeds</span>${feeds}</div>` : ""}</div>`;
    }
    function personAt(pid, i, e) {
        if (pid && window.personPop) {
            const known = personRec(pid);
            if (known) return window.personPop(pid, e);
        }
        const p = CLUSTER[+i];
        if (!p) return;
        const pop = document.getElementById("focusPop");
        if (!pop) return;
        const s = ST(p.state);
        pop.className = "focus-pop";
        pop.innerHTML = `<h5>${esc(p.name)}${p.org ? ` <span>· ${esc(p.org)}</span>` : ""}</h5><div class="hint">${esc(s.word)}${p.reg ? " · " + esc(p.reg) : ""}</div>${p.line ? `<p>${esc(clip(p.line, 140))}</p>` : ""}\n    <div class="row"><a class="topbtn" href="http://localhost:4100/people.html" target="_blank">outreach hub ↗</a></div>`;
        const box = focusEl.getBoundingClientRect();
        pop.style.left = Math.min(e.clientX - box.left + 10, Math.max(8, box.width - 340)) + "px";
        pop.style.top = Math.max(8, e.clientY - box.top + focusEl.scrollTop + 12) + "px";
        pop.hidden = false;
    }
    const hhmm = t => t ? new Date(t).toLocaleTimeString("en-US", {
        hour: "numeric",
        minute: "2-digit"
    }).replace(":00", "").replace(" ", "").toLowerCase() : "";
    function locationBlock() {
        const L = DATA.location, has = L && L.lat != null;
        if (!has && window.NS_PUBLIC) return `<div class="vw-cards">${placeholder("location", {
            label: "LOCATION",
            planned: true
        })}</div><div class="vw-cap">waiting for the phone to report where you are</div>`;
        const when = has && L.at ? new Date(L.at).toLocaleTimeString("en-US", {
            hour: "numeric",
            minute: "2-digit"
        }) : "";
        return `<div class="vw-block"><div class="vw-cap">${has ? `you are here · ${esc(L.place || "")}${when ? " · " + esc(when) : ""}${L.fresh ? "" : " · stale"}` : "where you are: waiting for the phone"}<span id="vwTodayCap"></span></div>\n    <div class="vw-map" id="vwMap"></div><div id="vwStops" class="vw-stops"></div></div>`;
    }
    async function todayStops() {
        if (window.NS_PUBLIC) return null;
        try {
            const r = await api("/api/today", {
                cache: "no-store"
            });
            if (r.ok) return await r.json();
        } catch {}
        try {
            const r = await api("/api/status", {
                cache: "no-store"
            });
            if (r.ok) {
                const j = await r.json();
                return j && j.today || null;
            }
        } catch {}
        return null;
    }
    function mountMap() {
        const el = document.getElementById("vwMap");
        if (!el) return;
        const mine = VIEW;
        drawMap(el, null);
        todayStops().then(t => {
            if (VIEW !== mine || !document.getElementById("vwMap")) return;
            drawMap(el, t);
            stopsStrip(t);
        });
    }
    function drawMap(el, T) {
        const L = DATA.location, has = L && L.lat != null;
        const stops = (T && T.stops || []).filter(s => s.n && s.lat != null);
        if (!has && !stops.length) {
            el.style.height = "0px";
            el.style.border = "none";
            return;
        }
        el.style.height = "";
        el.style.border = "";
        const W = el.clientWidth || 600, H = stops.length ? 380 : 300, PAD = 44;
        const tx0 = lon => (lon + 180) / 360 * 256, ty0 = lat => {
            const r = lat * Math.PI / 180;
            return (1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2 * 256;
        };
        const pts = [ ...has ? [ [ L.lat, L.lon ] ] : [], ...stops.map(s => [ s.lat, s.lon ]) ];
        const xs = pts.map(p => tx0(p[1])), ys = pts.map(p => ty0(p[0]));
        const spanX = Math.max(...xs) - Math.min(...xs), spanY = Math.max(...ys) - Math.min(...ys);
        let Z = 16;
        while (Z > 10 && (spanX * 2 ** Z > W - 2 * PAD || spanY * 2 ** Z > H - 2 * PAD)) Z--;
        if (pts.length === 1) Z = 14;
        const tx = lon => tx0(lon) * 2 ** Z, ty = lat => ty0(lat) * 2 ** Z;
        const cx = (Math.max(...xs) + Math.min(...xs)) / 2 * 2 ** Z, cy = (Math.max(...ys) + Math.min(...ys)) / 2 * 2 ** Z;
        const x0 = cx - W / 2, y0 = cy - H / 2, X = lon => (tx(lon) - x0).toFixed(1), Y = lat => (ty(lat) - y0).toFixed(1);
        let tiles = "";
        for (let a = Math.floor(x0 / 256); a <= Math.floor((x0 + W) / 256); a++) for (let b = Math.floor(y0 / 256); b <= Math.floor((y0 + H) / 256); b++) tiles += `<img src="https://tile.openstreetmap.org/${Z}/${a}/${b}.png" style="left:${(a * 256 - x0).toFixed(0)}px;top:${(b * 256 - y0).toFixed(0)}px" alt="" onerror="this.remove()">`;
        const today = (new Date).toLocaleDateString("en-CA");
        const hist = has ? (L.history || []).filter(h => h.lat != null && (!stops.length || String(h.at).slice(0, 10) >= today)) : [];
        const trail = hist.length > 1 ? `<polyline points="${hist.map(h => `${X(h.lon)},${Y(h.lat)}`).join(" ")}" fill="none" stroke="#000" stroke-width="1.6" stroke-dasharray="3 3"/>` : "";
        let route = "";
        for (let i = 1; i < stops.length; i++) {
            const a = stops[i - 1], b = stops[i];
            if (a.lat === b.lat && a.lon === b.lon) continue;
            route += `<line x1="${X(a.lon)}" y1="${Y(a.lat)}" x2="${X(b.lon)}" y2="${Y(b.lat)}" stroke="#000" stroke-width="2" stroke-opacity="${b.state === "past" ? .25 : .8}"/>`;
        }
        const groups = [];
        for (const s of stops) {
            const g = groups.find(g => Math.abs(g.lat - s.lat) < 1e-4 && Math.abs(g.lon - s.lon) < 1e-4);
            g ? g.items.push(s) : groups.push({
                lat: s.lat,
                lon: s.lon,
                items: [ s ]
            });
        }
        const taken = groups.map(g => {
            const x = +X(g.lon), y = +Y(g.lat);
            return [ x - 13, y - 13, x + 13, y + 13 ];
        });
        const hits = q => taken.some(t => q[0] < t[2] && q[2] > t[0] && q[1] < t[3] && q[3] > t[1]);
        const dots = groups.map(g => {
            const x = +X(g.lon), y = +Y(g.lat), allPast = g.items.every(s => s.state === "past"), hot = g.items.some(s => s.state === "next" || s.state === "now");
            const num = g.items.map(s => s.n).join("·"), r = num.length > 2 ? 13 : 11;
            const label = g.items.map(s => `${s.n} ${hhmm(s.start)} ${clip(s.title.replace(/^return\s+/i, "Return ").split(/[:(\-–]/)[0].trim(), 24)}`).join("  /  ");
            const lw = Math.min(280, label.length * 6 + 10);
            let lx = x + r + 4, ly = y - 8;
            const tries = [];
            for (const dy of [ 0, -20, 20, -40, 40, -60, 60 ]) {
                tries.push([ x + r + 4, y - 8 + dy ]);
                tries.push([ x - r - 4 - lw, y - 8 + dy ]);
            }
            for (const [tx_, ty_] of tries) {
                if (tx_ < 2 || tx_ + lw > W - 2 || ty_ < 2 || ty_ + 16 > H - 2) continue;
                if (!hits([ tx_, ty_, tx_ + lw, ty_ + 16 ])) {
                    lx = tx_;
                    ly = ty_;
                    break;
                }
            }
            taken.push([ lx, ly, lx + lw, ly + 16 ]);
            const lead = Math.abs(ly - (y - 8)) > 1 ? `<line x1="${x}" y1="${y}" x2="${lx < x ? lx + lw : lx}" y2="${ly + 8}" stroke="#000" stroke-width=".8"/>` : "";
            return `<g data-stop="${g.items[0].n}" opacity="${allPast ? .45 : 1}">${lead}\n      ${hot ? `<circle cx="${x}" cy="${y}" r="${r}" fill="none" stroke="#000" stroke-width="1.4"><animate attributeName="r" values="${r};${r + 14}" dur="2s" repeatCount="indefinite"/><animate attributeName="opacity" values=".7;0" dur="2s" repeatCount="indefinite"/></circle>` : ""}\n      <circle cx="${x}" cy="${y}" r="${r}" fill="${allPast ? "#FFF" : "#000"}" stroke="${allPast ? "#000" : "#FFF"}" stroke-width="2"/>\n      <text x="${x}" y="${y + 3.6}" text-anchor="middle" font-family="var(--mono)" font-size="${num.length > 2 ? 9 : 10.5}" font-weight="700" fill="${allPast ? "#000" : "#FFF"}">${esc(num)}</text>\n      <rect x="${lx}" y="${ly}" width="${lw}" height="16" rx="4" fill="#FFF" fill-opacity=".92" stroke="#000" stroke-opacity=".15"/>\n      <text x="${lx + 5}" y="${ly + 11.5}" font-family="var(--mono)" font-size="10" fill="#000" font-weight="${hot ? 700 : 400}">${esc(label)}</text></g>`;
        }).join("");
        const me = has ? `<circle cx="${X(L.lon)}" cy="${Y(L.lat)}" r="8" fill="none" stroke="#000" stroke-width="1.4"><animate attributeName="r" values="8;30" dur="2s" repeatCount="indefinite"/><animate attributeName="opacity" values=".8;0" dur="2s" repeatCount="indefinite"/></circle>\n    <circle cx="${X(L.lon)}" cy="${Y(L.lat)}" r="6" fill="#000" stroke="#FFF" stroke-width="2"/>` : "";
        el.style.height = H + "px";
        el.innerHTML = `${tiles}<svg viewBox="0 0 ${W} ${H}">${trail}${route}${dots}${me}</svg>`;
    }
    function stopsStrip(T) {
        const box = document.getElementById("vwStops"), cap = document.getElementById("vwTodayCap");
        if (!box) return;
        const stops = T && T.stops || [];
        if (cap) cap.textContent = stops.length ? ` · today ${stops.filter(s => s.n).length} stops` : "";
        if (!stops.length) {
            box.innerHTML = T && T.calendarError ? `<div class="vw-cap">calendar unreachable: ${esc(T.calendarError)}</div>` : "";
            return;
        }
        box.innerHTML = stops.map(s => `<a class="vw-stop ${s.state}" ${s.lat != null ? `href="https://maps.apple.com/?daddr=${s.lat},${s.lon}&dirflg=w" target="_blank"` : ""} title="${esc(s.location || "")}${s.note ? " — " + esc(s.note) : ""}">\n      <b>${s.n || "–"}</b><span>${esc(hhmm(s.start))}${s.end ? "–" + esc(hhmm(s.end)) : ""}</span><em>${esc(clip(s.title, 48))}</em>${s.unplaced ? "<i>place not found</i>" : ""}</a>`).join("");
    }
})();
