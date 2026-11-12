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
    const EMBED_HEAD = () => !window.NS_EMBED_HEAD_OFF;
    const embedSrc = u => {
        u = macUrl(u);
        if (!EMBED_HEAD() || !u) return u;
        const i = u.indexOf("#"), h = i < 0 ? "" : u.slice(i), b = i < 0 ? u : u.slice(0, i);
        return b + (b.includes("?") ? "&" : "?") + "embed=1" + h;
    };
    function keepRicherLead(lead) {
        const sub = focusEl.querySelector(".vw-sub");
        lead = String(lead || "").replace(/\s+/g, " ").trim();
        if (!lead) return;
        if (!sub) {
            const head = focusEl.querySelector(".vw-head .vw-title");
            if (head) head.insertAdjacentHTML("afterend", `<div class="vw-sub">${esc(clip(lead, 420))}</div>`);
            return;
        }
        if (lead.length > sub.textContent.trim().length) {
            sub.textContent = clip(lead, 420);
            sub.title = lead;
        }
    }
    function hideEmbedHead(fr, onLead) {
        if (!EMBED_HEAD()) return;
        if (!onLead) onLead = lead => {
            if (fr.dataset.head) keepRicherLead(lead);
        };
        fr._nsLead = onLead;
        const go = () => {
            let r = null;
            try {
                if (window.nsEmbedHead && fr.contentDocument) r = window.nsEmbedHead(fr.contentDocument);
            } catch {}
            if (r) fr._nsLead(r.lead);
        };
        if (!fr._nsWired) {
            fr._nsWired = 1;
            fr.addEventListener("load", go);
        }
        let n = 0;
        const t = setInterval(() => {
            let doc = null;
            try {
                doc = fr.contentDocument;
            } catch {
                clearInterval(t);
                return;
            }
            if (++n > 80 || !fr.isConnected) return clearInterval(t);
            if (doc && doc.readyState !== "loading" && /[?&]embed=1/.test(doc.URL || "")) {
                clearInterval(t);
                go();
            }
        }, 60);
    }
    window.addEventListener("message", e => {
        const m = e.data;
        if (!m || m.ns !== "embed-head" || !EMBED_HEAD()) return;
        const fr = [ ...document.querySelectorAll("iframe") ].find(f => f.contentWindow === e.source);
        if (fr && fr._nsLead) fr._nsLead(m.lead);
    });
    window.nsEmbedSrc = embedSrc;
    window.nsWatchEmbed = hideEmbedHead;
    const mins = s => s == null ? "" : s < 90 ? `${Math.round(s)}s` : s < 5400 ? `${Math.round(s / 60)} min` : `${(s / 3600).toFixed(1)} h`;
    window.renderView = function(target, opts) {
        const id = target.id, n = byId[id] || target, d = DETAILS[id] || {};
        VIEW = id;
        const parts = [];
        if (d.progress && d.progress.wgh && !window.NS_PUBLIC) parts.push(wghBlock(d.progress.wgh));
        {
            const st = !window.NS_PUBLIC ? d.progress && d.progress.story : d.goalStory || n.goalStory;
            if (st) parts.unshift(storyBlock(st, !!window.NS_PUBLIC, window.NS_PUBLIC ? firstSentence(d.why || n.why || "") : null));
        }
        parts.push(`<div id="vwAgents">${agentStrip(id)}</div>`);
        const hero = [];
        (d.cases || (d.case ? [ d.case ] : [])).forEach(c => hero.push(caseCard(c)));
        if (d.paper) hero.push(paperCard(d.paper, id));
        (d.docs || []).filter(x => x.thumb).forEach(x => hero.push(docCard(x)));
        const imgs = [ ...d.image && !(d.images || []).includes(d.image) && !(d.case && d.case.image === d.image) ? [ d.image ] : [], ...d.images || [] ];
        imgs.forEach(src => hero.push(imgCard(src)));
        if (d.view === "location" || id === "location") parts.push(locationBlock());
        if (d.kind === "ptype") parts.push(clusterBlock(d));
        if (d.progress && !window.NS_PUBLIC) parts.push(progressBlock(d.progress));
        if (Array.isArray(d.vision) && d.vision.length && !window.NS_PUBLIC) parts.push(`<div class="vw-pg-row" style="margin-bottom:10px"><div class="vw-cap">vision</div>${d.vision.map(v => `<div style="color:var(--text);font-size:13px;line-height:1.45">${esc(v.text || "")}</div>`).join("")}</div>`);
        if (Array.isArray(d.files) && d.files.length && !window.NS_PUBLIC) parts.push(filesBlock(d.files));
        if (d.deadline || d.checklist) parts.push(deadlineBlock(d));
        if (hero.length) parts.push(`<div class="vw-cards">${hero.join("")}</div>`);
        const linked = (DATA.peopleAt || {})[id] || [];
        if (linked.length) parts.push(peopleRow(linked));
        if (d.embed) parts.push(`<div class="vw-block"><div class="vw-cap">${esc(d.embedCaption || (id === "skin-build" || id === "robot-skin" ? "the layer stack, part by part" : "the page"))} · <a href="${esc(macUrl(d.embed))}" target="_blank">open full ↗</a></div>\n    <iframe class="vw-embed" data-head="1" src="${esc(embedSrc(d.embed))}" loading="lazy" title="${esc(n.label)}"></iframe></div>`);
        if (d.stack) parts.push(`<div class="vw-block"><div class="vw-cap">stack &amp; how it works · <a href="${esc(macUrl(d.stack))}" target="_blank">open full ↗</a></div>\n    <iframe class="vw-embed" src="${esc(embedSrc(d.stack))}" loading="lazy" title="stack"></iframe></div>`);
        const graph = opts && opts.noGraph ? "" : subgraph(id);
        if (graph) parts.push(graph);
        if (d.hasFlow || id.startsWith("r:")) parts.push(`<div class="vw-block"><div class="vw-cap">flow</div><div class="vw-flow" id="vwFlow"><div class="hint">drawing…</div></div></div>`);
        const tl = timeline(id, d);
        if (tl) parts.push(tl);
        const refs = (d.refs || []).filter(r => r && r.href);
        if (refs.length) parts.push(`<div class="vw-links">${refs.map(r => `<a href="${esc(macUrl(r.href))}" target="_blank" rel="noopener">↗ ${esc(clip(r.label, 46))}</a>`).join("")}</div>`);
        {
            const repos = window.nsRepoRow ? window.nsRepoRow(id) : "";
            if (repos) parts.push(`<div class="vw-links vw-repos">${repos}</div>`);
        }
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
    const FILE_KIND = {
        workflow: "workflow",
        scenario: "scenario",
        skill: "how-to",
        rule: "rule"
    };
    const fileGlyph = (k, x, y) => k === "rule" ? `<path d="M${x} ${y - 7}L${x + 7} ${y}L${x} ${y + 7}L${x - 7} ${y}Z" fill="none" stroke="var(--text)" stroke-width="1.4"/>` : k === "workflow" ? `<circle cx="${x - 6}" cy="${y}" r="2.6" fill="var(--text)"/><circle cx="${x + 6}" cy="${y}" r="2.6" fill="var(--text)"/><path d="M${x - 3} ${y}H${x + 3}" stroke="var(--text)" stroke-width="1.4"/>` : k === "scenario" ? `<circle cx="${x}" cy="${y}" r="6.5" fill="none" stroke="var(--text)" stroke-width="1.4"/><circle cx="${x}" cy="${y}" r="2" fill="var(--text)"/>` : `<rect x="${x - 6}" y="${y - 6}" width="12" height="12" rx="2" fill="none" stroke="var(--text)" stroke-width="1.4"/>`;
    const SRC_WORD = {
        udmail: "company mail",
        teams: "Teams",
        items: "its tasks",
        chat: "chat",
        thread: "chat",
        gmail: "Gmail",
        slack: "Slack",
        imessage: "iMessage",
        whatsapp: "WhatsApp",
        wechat: "WeChat",
        icloudmail: "iCloud mail"
    };
    function fileCard(f) {
        const W = 300, H = 58, y = 34, end = f.second ? clip(f.homeLabel || f.home, 18).toLowerCase() : clip(f.lives || f.where, 18);
        const rule = f.kind === "rule", inCode = rule && f.inCode;
        const endMark = rule ? inCode ? `<circle cx="${W - 12}" cy="${y}" r="5" fill="var(--text)"/>` : `<circle cx="${W - 12}" cy="${y}" r="5" fill="none" stroke="#B7791F" stroke-width="1.6"/>` : `<rect x="${W - 17}" y="${y - 5}" width="10" height="10" rx="1.5" fill="none" stroke="var(--text-secondary)" stroke-width="1.2"/>`;
        const dash = f.second ? ' stroke-dasharray="4 3"' : "", ax = Math.max(W / 2 + 26, W - 30 - end.length * 6.4);
        const tip = `${FILE_KIND[f.kind] || f.kind}: ${f.label} -- from ${SRC_WORD[f.from] || f.from}, lives in ${f.where === "company mini" ? "the company Mac mini " : ""}${f.path || ""}${f.second ? " (its home is " + (f.homeLabel || f.home) + "; used here too)" : ""}${rule ? inCode ? " -- held in code" : " -- not in code yet" : ""}`;
        return `<svg class="vw-file" viewBox="0 0 ${W} ${H}" width="100%" role="img" aria-label="${esc(tip)}"><title>${esc(tip)}</title>\n    <rect x="0.5" y="0.5" width="${W - 1}" height="${H - 1}" rx="7" fill="var(--bg-card, #fff)" stroke="var(--border)"${dash}/>\n    <text x="12" y="17" font-size="12" font-weight="600" fill="var(--text)" font-family="var(--font-heading, inherit)">${esc(clip(f.label, 34))}</text>\n    <text x="12" y="${y + 4}" font-size="10.5" fill="var(--text-secondary)" font-family="var(--font-mono, monospace)">${esc(SRC_WORD[f.from] || f.from)}</text>\n    <path d="M${Math.min(W / 2 - 24, Math.max(86, 18 + String(SRC_WORD[f.from] || f.from).length * 6.5))} ${y}H${W / 2 - 14}" stroke="var(--text-secondary)" stroke-width="1"${dash}/><path d="M${W / 2 - 18} ${y - 3}L${W / 2 - 14} ${y}L${W / 2 - 18} ${y + 3}" fill="none" stroke="var(--text-secondary)"/>\n    ${fileGlyph(f.kind, W / 2, y)}\n    <path d="M${W / 2 + 14} ${y}H${ax}" stroke="var(--text-secondary)" stroke-width="1"${dash}/><path d="M${ax - 4} ${y - 3}L${ax} ${y}L${ax - 4} ${y + 3}" fill="none" stroke="var(--text-secondary)"/>\n    <text x="${W - 24}" y="${y + 4}" font-size="10.5" text-anchor="end" fill="var(--text-secondary)" font-family="var(--font-mono, monospace)">${esc(end)}</text>\n    ${endMark}</svg>`;
    }
    function filesBlock(files) {
        const own = files.filter(f => !f.second), kinds = [ "workflow", "scenario", "skill", "rule" ], n = k => own.filter(f => f.kind === k).length;
        const total = own.length || 1, BW = 300;
        let x = 0;
        const bar = own.length ? kinds.filter(n).map(k => {
            const w = Math.max(18, BW * n(k) / total), g = `<g><rect x="${x}" y="0" width="${w - 2}" height="18" rx="3" fill="${k === "rule" && own.some(f => f.kind === "rule" && !f.inCode) ? "none" : "var(--text)"}" stroke="var(--text)"/>\n    <text x="${x + 6}" y="13" font-size="10.5" fill="${k === "rule" && own.some(f => f.kind === "rule" && !f.inCode) ? "var(--text)" : "var(--bg, #fff)"}" font-family="var(--font-mono, monospace)">${n(k)} ${FILE_KIND[k]}</text></g>`;
            x += w;
            return g;
        }).join("") : "";
        const sorted = [ ...own.sort((a, b) => kinds.indexOf(a.kind) - kinds.indexOf(b.kind)), ...files.filter(f => f.second) ];
        return `<div class="vw-block vw-files"><div class="vw-cap">files · from -> what -> where it lives</div>\n    ${bar ? `<svg viewBox="0 0 ${Math.max(BW, x)} 18" width="100%" style="max-width:420px;display:block;margin:4px 0 8px" role="img" aria-label="files by kind">${bar}</svg>` : ""}\n    <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:6px">${sorted.map(fileCard).join("")}</div></div>`;
    }
    function progressBlock(p) {
        const row = (cap, body, meta) => `<div class="vw-pg-row" style="margin-bottom:10px"><div class="vw-cap">${cap}</div>\n    <div style="color:var(--text);font-size:13px;line-height:1.45">${body}</div>${meta ? `<div class="vw-meta">${meta}</div>` : ""}</div>`;
        const out = [];
        if (p.top) out.push(row("hangs from · the top goal", `Mittens is reliable: “${esc(clip(p.top.goal, 160))}”`, [ p.top.measure ? esc(p.top.measure) : "", "from " + esc(clip(p.top.source || "", 90)) ].filter(Boolean).join(" · ")));
        if (p.serves) out.push(row("serves · " + esc(p.serves.life), `<a href="${esc(p.serves.page)}" target="_blank" style="text-decoration:underline">${esc(p.serves.branch)}</a>`, "her Odyssey plan · guiding page"));
        if (p.record) out.push(recordRow(p.record, row));
        if (p.goal) out.push(row("goal" + (p.deadline ? ` · by ${esc(p.deadline)}` : ""), `“${esc(p.goal)}”`, [ p.why ? "why: " + esc(clip(p.why, 160)) : "", "from " + esc(clip(p.goalSource || "", 90)) ].filter(Boolean).join(" · ")));
        if (p.goal && (p.who || p.measure || p.stage || p.loop)) {
            const ST = [ "plan", "research", "design", "prototype", "experiment", "measure" ], AL = {
                implement: "prototype",
                learn: "measure"
            };
            const L = p.loop, cur = L?.stages?.length ? L.stages[L.stages.length - 1] : null, stage = cur?.stage || AL[p.stage] || p.stage, at = ST.indexOf(stage);
            const done = new Set((L?.stages || []).filter(x => x.done && x.round === (cur?.round || 1)).map(x => x.stage));
            const chip = (s, i) => {
                const d = done.has(s), c = i === at;
                return `<span style="font-size:11px;padding:2px 6px;border:1px solid ${c || d ? "var(--text)" : "var(--text-dim)"};${d ? "background:var(--text);color:var(--bg);" : `color:${c ? "var(--text)" : "var(--text-muted)"};`}${c ? "font-weight:600" : ""}">${s}</span>`;
            };
            const strip = `<div style="display:flex;gap:4px;flex-wrap:wrap;margin:2px 0 4px">${ST.map(chip).join("")}</div>`;
            const sc = p.score ? `<div style="margin:2px 0">score ${p.score.score}/100 <span class="vw-meta">loop ${p.score.parts.loop} · evidence ${p.score.parts.evidence} · fresh ${p.score.parts.fresh} · record ${p.score.parts.record}${p.score.trend?.length > 1 ? " · last days " + p.score.trend.join(" ") : ""}</span></div>` : "";
            const needs = L?.needs ? `<div>this stage must produce: ${esc(clip(L.needs, 160))}</div>` : "";
            const trail = (L?.stages || []).filter(x => x.done).slice(-4).map(x => `<div class="vw-meta">r${x.round} ${esc(x.stage)} · ${esc(x.at)}: ${esc(clip(x.evidence || "", 140))} [${esc(clip(x.ref || "", 40))}]</div>`).join("");
            out.push(row("improve loop" + (cur ? ` · round ${cur.round}` : "") + (at < 0 ? " · stage not set" : ""), strip + sc + needs + (p.measure ? `<div>measure: ${esc(clip(p.measure, 200))}</div>` : "") + trail, p.who ? "for " + esc(clip(p.who, 120)) : ""));
        }
        if ((p.questions || []).length) out.push(row("open · by who can move it", questionCols(p.questions), "from the goal record · agents start on research and data by themselves"));
        if (p.summary) out.push(row(`where it is · ${esc(p.summaryDay || "")}`, esc(p.summary), p.sources ? `${p.sources} source${p.sources > 1 ? "s" : ""} · built by code from tasks, notes and the activity log` : ""));
        if ((p.next || []).length) out.push(row("next", p.next.map(s => `<div>– ${esc(clip(s, 160))}</div>`).join("")));
        return out.length ? `<div class="vw-block vw-progress" style="margin:4px 0 14px">${out.join("")}</div>` : "";
    }
    window.nsGoalBar = function(g, w) {
        if (!g) return "";
        const pct = g.grade == null ? null : Math.round(g.grade * 100);
        return `<div style="display:flex;align-items:center;gap:8px;margin:4px 0"><div style="flex:1;height:6px;border:1px solid var(--text-dim);position:relative;${pct == null ? "border-style:dashed" : ""}">${pct == null ? "" : `<div style="position:absolute;left:0;top:0;bottom:0;width:${Math.max(pct, 1)}%;background:var(--text)"></div>`}</div><span class="vw-meta" style="white-space:nowrap">${pct == null ? g.value == null ? "not measured yet" : "no number target" : pct + "%"}</span></div>`;
    };
    window.nsWghBlock = w => wghBlock(w);
    window.nsGlance = function(o) {
        const g = o.goal, pct = g && g.grade != null ? Math.round(g.grade * 100) : null, R = 25, C = 2 * Math.PI * R;
        const gTip = g ? `${g.metric || "goal"} -- target ${g.target || "not set"}${g.value != null ? ", now " + g.value + (g.unit ? " " + g.unit : "") : ", not measured yet"}${o.goalFrom ? " (the goal of " + o.goalFrom + ", which this dot serves)" : ""}` : "no goal with a number on this dot yet";
        const ring = `<svg class="gl-ring" data-point data-visual viewBox="0 0 64 64" width="64" height="64" role="img" aria-label="${esc(gTip)}"><title>${esc(gTip)}</title>\n    <circle cx="32" cy="32" r="${R}" fill="none" stroke="var(--border)" stroke-width="6"${pct == null ? ' stroke-dasharray="3 5"' : ""}/>\n    ${pct == null ? "" : `<circle cx="32" cy="32" r="${R}" fill="none" stroke="var(--text)" stroke-width="6" stroke-linecap="butt" stroke-dasharray="${(C * Math.max(pct, 1) / 100).toFixed(1)} ${C.toFixed(1)}" transform="rotate(-90 32 32)"/>`}\n    <text x="32" y="37" text-anchor="middle" font-size="${pct == null ? 18 : 15}" font-weight="700" fill="${pct == null ? "var(--text-muted)" : "var(--text)"}" font-family="var(--font-heading, inherit)">${pct == null ? "–" : pct + "%"}</text></svg>`;
        const tgt = g ? String(g.target || "").replace(/^at (?:most|least)\s*/i, "") : "";
        const nums = !g ? '<span class="gl-none">no goal number yet</span>' : g.value != null ? `<b>${esc(String(g.value))}</b><svg viewBox="0 0 22 10" width="22" height="10" aria-hidden="true"><path d="M1 5H19M15 1.5L19 5L15 8.5" fill="none" stroke="var(--text-muted)" stroke-width="1.4"/></svg><b class="gl-t">${esc(tgt || "?")}</b>` : `<span class="gl-none">not measured</span><svg viewBox="0 0 22 10" width="22" height="10" aria-hidden="true"><path d="M1 5H19M15 1.5L19 5L15 8.5" fill="none" stroke="var(--text-muted)" stroke-width="1.4"/></svg><b class="gl-t">${esc(tgt || "?")}</b>`;
        const unit = g ? clip(g.unit || g.metric || "", 30) : "";
        const head = `<div class="gl-goal" title="${esc(gTip)}">${ring}<div class="gl-goalnum" data-point><div class="gl-now">${nums}</div>${unit ? `<div class="gl-unit">${esc(unit)}${o.goalFrom ? " · " + esc(clip(o.goalFrom, 18)) : ""}</div>` : ""}</div></div>`;
        const tile = t => `<button type="button" class="gl-tile${t.n > 0 && t.tone ? " " + t.tone : ""}" data-point data-visual data-gl="${esc(t.k)}" title="${esc(t.tip || t.label)}"><b>${t.n == null ? "–" : t.n}</b><span>${esc(t.label)}</span></button>`;
        const tiles = `<div class="gl-tiles">${(o.nums || []).map(tile).join("")}</div>`;
        const P = [ [ "why", o.parts && o.parts.why ], [ "goal", o.parts && o.parts.goal ], [ "how", o.parts && o.parts.how ] ];
        const pips = `<svg class="gl-pips" data-point data-visual viewBox="0 0 300 30" width="100%" role="img" aria-label="why, goal, how: ${P.filter(x => x[1]).length} of 3 are this dot's own"><title>${esc(P.map(([k, v]) => k + (v ? ": its own" : ": missing")).join(" · "))}</title>\n    <path d="M30 10H270" stroke="var(--border)" stroke-width="1.4"/>\n    ${P.map(([k, v], i) => {
            const x = 30 + i * 120;
            return `<g data-gl="wgh" style="cursor:pointer"><title>${esc(k + (v ? " -- " + clip(v, 200) : ": not found for this dot yet"))}</title><circle cx="${x}" cy="10" r="6" fill="${v ? "var(--text)" : "var(--bg, #fff)"}" stroke="${v ? "var(--text)" : "var(--text-muted)"}" stroke-width="1.5"${v ? "" : ' stroke-dasharray="2.5 2.5"'}/><text x="${x}" y="28" text-anchor="middle" font-size="10" letter-spacing=".8" fill="${v ? "var(--text)" : "var(--text-muted)"}" font-family="var(--mono, monospace)">${k.toUpperCase()}</text></g>`;
        }).join("")}</svg>`;
        let track = "";
        if (o.stage && o.stage.at >= 0) {
            const ST = [ "plan", "research", "design", "prototype", "experiment", "measure" ], st = o.stage;
            track = `<svg class="gl-track" data-point data-visual viewBox="0 0 300 30" width="100%" role="img" aria-label="improve loop${st.round ? " round " + st.round : ""}: at ${ST[st.at]}"><title>${esc("improve loop" + (st.round ? " round " + st.round : "") + ": at " + ST[st.at] + (st.needs ? " -- this stage must produce: " + st.needs : ""))}</title>\n      <path d="M20 10H280" stroke="var(--border)" stroke-width="1.4"/><path d="M20 10H${20 + st.at * 52}" stroke="var(--text)" stroke-width="1.4"/>\n      ${ST.map((s, i) => {
                const x = 20 + i * 52, d = i < st.at || (st.done || []).includes(s), c = i === st.at;
                return `<circle cx="${x}" cy="10" r="${c ? 6 : 4}" fill="${d && !c ? "var(--text)" : "var(--bg, #fff)"}" stroke="${d || c ? "var(--text)" : "var(--text-dim, #bbb)"}" stroke-width="${c ? 2.4 : 1.4}"/>${c ? `<text x="${Math.min(Math.max(x, 28), 272)}" y="28" text-anchor="middle" font-size="10" font-weight="700" fill="var(--text)" font-family="var(--mono, monospace)">${s}</text>` : ""}`;
            }).join("")}</svg>`;
        }
        return `<div class="gl" data-glance>${head}${tiles}${pips}${track}</div>`;
    };
    window.nsFilesBlock = f => filesBlock(f);
    const STORY_ST = [ "plan", "research", "design", "prototype", "experiment", "measure" ];
    function storyBlock(s, pub, goalText) {
        if (!s) return "";
        const m = s.metric, W = 300, rows = [];
        const cap = (k, extra) => `<div class="vw-cap" style="font-weight:600;letter-spacing:.08em;margin:0 0 3px">${k}${extra ? ` <span style="font-weight:400;letter-spacing:0;text-transform:none">· ${extra}</span>` : ""}</div>`;
        const g = pub ? goalText : s.goal;
        if (g) rows.push(`<div data-story="goal">${cap("GOAL")}<div style="color:var(--text);font-size:14px;font-weight:600;line-height:1.35" title="${esc(pub ? "" : s.goalSource || "")}">${esc(clip(g, 200))}</div></div>`);
        if (m && (m.points || []).length) {
            const P = m.points, H = 64, top = 8, bot = 18, max = Math.max(1, ...P.map(p => +p.v || 0)), min = m.kind === "vision" ? 0 : Math.min(...P.map(p => +p.v || 0));
            const x = i => P.length < 2 ? W / 2 : 6 + i * (W - 48) / (P.length - 1), y = v => top + (H - top - bot) * (1 - ((+v || 0) - min) / (max - min || 1));
            const solidN = m.partial && P.at(-1).t === m.partial ? P.length - 1 : P.length;
            const path = arr => arr.map((p, i) => `${i ? "L" : "M"}${x(p.i).toFixed(1)} ${y(p.v).toFixed(1)}`).join("");
            const pts = P.map((p, i) => ({
                ...p,
                i: i
            }));
            const last = P.at(-1), tip = p => `${p.t}: ${p.v}${m.unit ? " " + m.unit : ""}`;
            rows.push(`<div data-story="metric">${cap("METRIC", esc(clip(m.label, 70)))}<svg viewBox="0 0 ${W} ${H}" width="100%" role="img" aria-label="${esc(m.label + ": " + P.map(tip).join(", "))}" data-visual>\n      <path d="M6 ${H - bot}H${W - 42}" stroke="var(--border)" stroke-width="1"/>\n      <path d="${path(pts.slice(0, solidN))}" fill="none" stroke="var(--text)" stroke-width="1.8"/>\n      ${solidN < P.length && P.length > 1 ? `<path d="${path(pts.slice(solidN - 1))}" fill="none" stroke="var(--text)" stroke-width="1.8" stroke-dasharray="3 3"/>` : ""}\n      ${pts.map(p => `<circle cx="${x(p.i).toFixed(1)}" cy="${y(p.v).toFixed(1)}" r="2.6" fill="var(--text)"><title>${esc(tip(p))}${m.partial === p.t ? " (week still running)" : ""}</title></circle>`).join("")}\n      <text x="${W - 36}" y="${(y(last.v) + 5).toFixed(1)}" font-size="15" font-weight="700" fill="var(--text)" font-family="var(--font-heading, inherit)">${esc(String(last.v))}</text>\n      <text x="6" y="${H - 4}" font-size="9" fill="var(--text-muted)" font-family="var(--mono, monospace)">${esc(String(P[0].t).slice(5))}</text>\n      <text x="${W - 42}" y="${H - 4}" text-anchor="end" font-size="9" fill="var(--text-muted)" font-family="var(--mono, monospace)">${esc(String(last.t).slice(5))}${m.partial === last.t ? " (so far)" : ""}</text></svg>\n      ${m.note ? `<div class="vw-meta" style="margin:1px 0 2px">${esc(m.note)}</div>` : ""}\n      ${(m.perPoint || []).length ? `<div style="margin-top:4px">${m.perPoint.map(pp => {
                const mx = Math.max(1, ...pp.weekly);
                const lastN = pp.weekly.at(-1);
                return `<div style="display:flex;align-items:center;gap:8px;margin:2px 0" title="${esc(pp.text + (pp.carriedBy && pp.carriedBy.length ? " -- carried by " + pp.carriedBy.join(", ") : pub ? "" : " -- no code carries it yet"))}">\n          <svg viewBox="0 0 ${pp.weekly.length * 7} 16" width="${pp.weekly.length * 7}" height="16" aria-hidden="true">${pp.weekly.map((n, i) => `<rect x="${i * 7}" y="${16 - Math.max(n ? 1.5 : 0, 16 * n / mx)}" width="5" height="${Math.max(n ? 1.5 : 0, 16 * n / mx)}" fill="${i === pp.weekly.length - 1 ? "var(--text)" : "var(--text-muted)"}"/>`).join("")}</svg>\n          <b style="width:22px;text-align:right;font-size:12px">${lastN}</b><span style="font-size:12px;line-height:1.3;color:var(--text)">${esc(clip(pp.text, 78))}</span></div>`;
            }).join("")}</div>` : ""}</div>`);
        } else rows.push(`<div data-story="metric">${cap("METRIC")}<span class="vw-meta">no series measured yet</span></div>`);
        const T = s.tries || [], day = t => pub ? t.d : String(t.at).slice(0, 10), verdict = t => pub ? t.v : t.verdict;
        if (T.length) {
            const end = Date.now(), start = end - 30 * 864e5, X = t => 6 + (W - 12) * Math.min(1, Math.max(0, (Date.parse(day(t) + "T12:00:00Z") - start) / (end - start)));
            const stack = {}, over = {}, mark = t => {
                const d = day(t), k = stack[d] = (stack[d] || 0) + 1, cx = X(t).toFixed(1), cy = 36 - (k - 1) * 5, v = verdict(t);
                const tip = esc(`${d} · ${v}${pub ? "" : " -- " + clip(t.tried, 160) + (t.data ? " => " + clip(t.data, 140) : "") + (t.task ? " (" + t.task + ")" : "")}`);
                if (cy < 6) {
                    over[d] = (over[d] || 0) + 1;
                    return "";
                }
                return `<g><title>${tip}</title>${v === "helped" ? `<circle cx="${cx}" cy="${cy}" r="2.4" fill="var(--text)"/>` : v === "no effect" ? `<circle cx="${cx}" cy="${cy}" r="2.2" fill="none" stroke="var(--text)" stroke-width="1.2"/>` : v === "hurt" ? `<path d="M${cx - 3} ${cy - 3}l6 6m0 -6l-6 6" stroke="var(--red, #c00)" stroke-width="1.6"/>` : v === "confounded" ? `<path d="M${cx} ${cy - 3}a3 3 0 0 0 0 6z" fill="var(--text)"/><circle cx="${cx}" cy="${cy}" r="3" fill="none" stroke="var(--text)" stroke-width="1"/>` : `<circle cx="${cx}" cy="${cy}" r="1.8" fill="var(--text-muted)"/>`}</g>`;
            };
            const tally = [ "helped", "no effect", "hurt", "confounded", "unmeasured" ].map(v => [ v, T.filter(t => verdict(t) === v).length ]).filter(a => a[1]);
            rows.push(`<div data-story="tried">${cap("TRIED", `${T.length} in 30 days · ${tally.map(([v, n]) => `${n} ${v === "unmeasured" ? "not measured" : v}`).join(" · ")}`)}<svg viewBox="0 0 ${W} 48" width="100%" role="img" aria-label="${esc(T.length + " tries in 30 days: " + tally.map(a => a[1] + " " + a[0]).join(", "))}" data-visual>\n      <path d="M6 40H${W - 6}" stroke="var(--border)" stroke-width="1"/>${T.map(mark).join("")}${Object.entries(over).map(([d, n]) => `<text x="${(X({
                d: d,
                at: d
            }) - 4).toFixed(1)}" y="6" text-anchor="end" font-size="9" fill="var(--text-muted)" font-family="var(--mono, monospace)">+${n}</text>`).join("")}\n      <text x="6" y="48" font-size="9" fill="var(--text-muted)" font-family="var(--mono, monospace)">30 days ago</text><text x="${W - 6}" y="48" text-anchor="end" font-size="9" fill="var(--text-muted)" font-family="var(--mono, monospace)">today</text></svg>\n      ${pub ? "" : (() => {
                const lastT = T.at(-1);
                return `<div class="vw-meta" style="margin-top:2px">last: ${esc(clip(lastT.tried, 120))} -- ${esc(lastT.verdict === "unmeasured" ? "not measured yet" : lastT.verdict)}</div>`;
            })()}</div>`);
        } else rows.push(`<div data-story="tried">${cap("TRIED")}<span class="vw-meta">nothing tried in the last 30 days</span></div>`);
        const st = s.stage, arrow = '<svg viewBox="0 0 16 10" width="16" height="10" aria-hidden="true" style="flex:0 0 16px;margin-top:4px"><path d="M1 5H13M9 1.5L13 5L9 8.5" fill="none" stroke="var(--text)" stroke-width="1.5"/></svg>';
        const nextRows = pub ? st ? [ `improve loop${st.round ? " round " + st.round : ""}: ${STORY_ST[st.at]} now, then ${STORY_ST[(st.at + 1) % 6]}` ] : [] : (s.next || []).slice(0, 2);
        if (!pub && st) nextRows.unshift(`loop${st.round ? " round " + st.round : ""} at ${STORY_ST[st.at]}${st.needs ? " -- must produce: " + st.needs : ""}`);
        if (nextRows.length) rows.push(`<div data-story="next">${cap("NEXT")}${nextRows.map(n => `<div style="display:flex;gap:6px;font-size:12.5px;line-height:1.35;color:var(--text);margin:2px 0">${arrow}<span>${esc(clip(n, 170))}</span></div>`).join("")}</div>`);
        return `<div class="vw-block vw-story" data-story-block style="margin:4px 0 14px;padding:10px 12px;border:1px solid var(--border);display:flex;flex-direction:column;gap:10px">${rows.join("")}</div>`;
    }
    window.nsStoryBlock = (s, pub, g) => storyBlock(s, pub, g);
    function wghBlock(w) {
        const src = x => `<div class="vw-meta">${esc(clip(x || "", 160))}</div>`;
        const sec = (cap, body) => `<div style="margin-bottom:10px"><div class="vw-cap" style="font-weight:600;letter-spacing:.08em">${cap}</div><div style="color:var(--text);font-size:13px;line-height:1.45">${body}</div></div>`;
        const up = w.inheritedFrom ? ` · serves <a data-jump="${esc(w.inheritedFrom)}" style="text-decoration:underline;cursor:pointer">${esc(w.inheritedFrom)}</a>` : "";
        const why = w.why ? `“${esc(clip(w.why.text, 260))}”${src((w.why.date ? w.why.date + " · " : "") + w.why.source)}` : `<span class="vw-meta">not found in her own words yet${up}</span>`;
        const g = w.goal;
        const goal = g ? `${esc(clip(g.metric, 160))}<div>${g.target ? "target " + esc(g.target) : ""}${g.value != null ? ` · now ${esc(String(g.value))}${g.start != null && g.start !== g.value ? " (from " + esc(String(g.start)) + ")" : ""}` : ""}${g.unit && g.value != null ? " " + esc(clip(g.unit, 60)) : ""}</div>${window.nsGoalBar(g)}${src(g.source)}${g.wired === "no" || g.missing ? src("not wired: " + (g.missing || "no reader yet")) : ""}` : `<span class="vw-meta">no measure of its own yet${up}</span>`;
        const h = w.how;
        const how = h ? (h.steps || []).map(x => `<div style="margin:2px 0">– ${esc(clip(x.text, 170))}${src(x.source)}</div>`).join("") + ((h.design || []).length ? `<div style="margin-top:4px">design: ${h.design.map(x => esc(clip(x.text, 80))).join(" · ")}</div>${src(h.design.map(x => x.source).join(" · "))}` : "") + `<div class="vw-meta">${esc(h.state || "")}</div>` : '<span class="vw-meta">no researched plan yet -- the overseer adds sourced methods on its next attempt</span>';
        return `<div class="vw-block vw-wgh" style="margin:4px 0 14px;padding:10px 12px;border:1px solid var(--border)">${sec("WHY", why)}${sec("GOAL", goal)}${sec("HOW", how)}<div class="vw-meta">${w.parts} of 3 parts its own · core/goals/wgh.mjs</div></div>`;
    }
    function recordRow(r, row) {
        const g = r.goal, ih = r.inherited, src = x => `<span class="vw-meta">${esc(clip(x || "", 140))}</span>`;
        const body = g ? `“${esc(clip(g.text, 220))}”<div>${src((g.date ? g.date + " · " : "") + g.source)}</div>` : ih ? `serves <a data-jump="${esc(ih.from)}" style="text-decoration:underline;cursor:pointer">${esc(ih.label || ih.from)}</a>: “${esc(clip(ih.text, 180))}”<div>${src(ih.source)}</div>` : r.state === "held (personal)" ? "personal dot: its goal is pieced together only inside a personal task" : `no goal found in her words yet${r.searched ? `<div>${src("searched: " + r.searched.join("; "))}</div>` : ""}`;
        const more = (r.more || []).map(l => `<div style="margin:2px 0">– ${esc(clip(l.text, 160))} ${src(l.source)}</div>`).join("");
        const b = r.baseline, m = r.metric ? `<div>measure: ${esc(clip(r.metric, 160))}${r.target ? " · target " + esc(r.target) : ""}${b ? ` · today ${b.value ?? "-"} ${esc(clip(b.unit || "", 60))}` : ""}</div><div>${src([ r.metricFrom, b?.source ].filter(Boolean).join(" · "))}</div>` : '<div class="vw-meta">no outcome metric named yet</div>';
        const tn = +String(r.target || "").replace(/[^0-9.]/g, ""), bv = b && Number.isFinite(+b.value) && b.value !== null ? +b.value : null;
        const up = /at least/.test(r.target || ""), pct = bv == null || !/\d/.test(r.target || "") ? null : up ? tn > 0 ? Math.min(1, bv / tn) : 1 : bv <= tn ? 1 : Math.max(.04, tn / bv);
        const bar = pct == null ? "" : `<div style="display:flex;align-items:center;gap:8px;margin:4px 0"><div style="flex:1;height:6px;border:1px solid var(--text-dim);position:relative"><div style="position:absolute;left:0;top:0;bottom:0;width:${Math.round(pct * 100)}%;background:var(--text)"></div></div><span class="vw-meta">${bv} → ${esc(r.target)}</span></div>`;
        const a = r.attempt, at = a ? `<div>last attempt: ${esc(a.method || "-")}${a.decision ? " · " + esc(a.decision) : ""}${a.task ? " · " + esc(a.task) : ""}${a.at ? " · " + esc(String(a.at).slice(0, 10)) : ""} · ${a.attempts} attempt${a.attempts === 1 ? "" : "s"}${a.pivots ? ", " + a.pivots + " pivot" + (a.pivots === 1 ? "" : "s") : ""}${a.stalled ? ' <b style="color:var(--red)">stalled</b>' : ""}</div>` : '<div class="vw-meta">no overseer attempt yet</div>';
        const flag = r.state === "unknown" || a?.stalled ? '<span style="display:inline-block;width:7px;height:7px;border-radius:50%;background:var(--red);margin-right:5px"></span>' : "";
        return row(`${flag}goal record · ${esc(r.state)}${r.client ? " · from client evidence" : ""}`, body + more + m + bar + at, r.serves ? `serves her Odyssey plan · ${esc(r.serves.life)} · ${esc(r.serves.branch)}` : "");
    }
    function questionCols(qs) {
        const COLS = [ [ "research", "research" ], [ "data", "needs data" ], [ "her", "needs you" ] ];
        const col = ([k, cap]) => {
            const xs = qs.filter(q => q.kind === k);
            return `<div style="flex:1 1 0;min-width:0"><div class="vw-meta" style="margin-bottom:4px;font-weight:600">${cap} · ${xs.length}</div>${xs.length ? xs.slice(0, 4).map(q => `<div style="font-size:12px;line-height:1.4;margin-bottom:5px"${q.why ? ` title="${esc(clip(q.why, 200))}"` : ""}>– ${esc(clip(q.text, 110))}${q.ref ? ` <span class="vw-meta">${esc(clip(q.ref, 24))}</span>` : ""}</div>`).join("") + (xs.length > 4 ? `<div class="vw-meta">+${xs.length - 4} more</div>` : "") : '<div class="vw-meta">none open</div>'}</div>`;
        };
        return `<div class="vw-qcols" style="display:flex;gap:12px;flex-wrap:wrap">${COLS.map(col).join("")}</div>`;
    }
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
        focusEl.querySelectorAll("iframe.vw-embed").forEach(f => hideEmbedHead(f));
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
