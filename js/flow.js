if (window.mermaid) mermaid.initialize({
    startOnLoad: false,
    securityLevel: "strict",
    theme: "base",
    themeVariables: {
        fontFamily: "Inter, sans-serif",
        fontSize: "13px",
        primaryColor: "#FFFFFF",
        primaryBorderColor: "#000000",
        primaryTextColor: "#000000",
        lineColor: "#999999",
        secondaryColor: "#F5F5F5",
        tertiaryColor: "#F5F5F5"
    },
    flowchart: {
        htmlLabels: true,
        curve: "basis",
        useMaxWidth: false
    }
});

const FLOW = {};

let flowSeq = 0;

async function fetchFlow(id, fresh) {
    if (!fresh && FLOW[id]) return FLOW[id];
    const r = await api("/api/flow?node=" + encodeURIComponent(id), {
        cache: "no-store"
    });
    const j = await r.json();
    if (!r.ok) throw new Error(j.error || r.status);
    return FLOW[id] = j;
}

window.renderFlowPanel = async function(target, tab) {
    pBody.innerHTML = `<div class="hint">loading…</div>`;
    let f;
    try {
        f = await fetchFlow(target.id);
    } catch (e) {
        pBody.innerHTML = `<div class="card"><p>${esc(e.message)}</p></div>`;
        return;
    }
    if (!panelNode || panelNode.id !== target.id) return;
    if (tab === "flow") return drawFlow(f);
    return drawSkill(f);
};

async function drawFlow(f) {
    const head = f.kind === "skill" ? `<div class="hint">from the <b>## Flow</b> block in ${esc(f.path.replace(/^.*scheduled-tasks\//, "scheduled-tasks/"))} · click the node again for the text</div>` : `<div class="hint">how this project's lanes fit together · map.config.json</div>`;
    if (!f.flow) {
        pBody.innerHTML = head + `<div class="flowbox"><p class="empty">This skill has no <b>## Flow</b> block yet. Open the Skill tab and add one:<br><br>\n      <code>## Flow</code><br><code>\`\`\`mermaid</code><br><code>flowchart TD</code><br><code>&nbsp;&nbsp;A[step] --&gt; B{decision}</code><br><code>\`\`\`</code></p></div>`;
        return;
    }
    pBody.innerHTML = head + `<div class="flowbox" id="flowbox"><div class="hint">drawing…</div></div>`;
    try {
        const {svg: svg} = await mermaid.render("flow" + ++flowSeq, f.flow);
        const box = document.getElementById("flowbox");
        if (box) box.innerHTML = svg;
    } catch (e) {
        const box = document.getElementById("flowbox");
        if (box) box.innerHTML = `<p class="empty">The flow block does not parse: ${esc(String(e.message || e).split("\n")[0])}. Fix it on the Skill tab.</p><pre class="fileview">${esc(f.flow)}</pre>`;
    }
}

function drawSkill(f) {
    if (f.kind !== "skill") {
        pBody.innerHTML = `<div class="card"><p>Projects have no skill text — open one of its routines.</p></div>`;
        return;
    }
    pBody.innerHTML = `\n    <div class="skill-bar">\n      ${f.readOnly ? "" : '<button class="topbtn primary" id="skSave">Save</button>'}\n      <button class="topbtn" id="skReload">Reload</button>\n      <span class="hint" id="skState">${esc(f.path)}</span>\n    </div>\n    <textarea class="skill-edit" id="skText" spellcheck="false"></textarea>\n    ${f.reads.length ? `<div><div class="section-h" style="margin-bottom:6px">Also reads</div><div class="reads">${f.reads.map(p => `<button data-p="${esc(p)}">${esc(p.replace("/Users/susanna/Documents/GitHub/", ""))}</button>`).join("")}</div></div>` : ""}\n    <div id="fileView"></div>`;
    const ta = document.getElementById("skText");
    ta.value = f.text;
    const state = document.getElementById("skState");
    if (f.readOnly) {
        ta.readOnly = true;
        state.textContent = "read-only here — edit skills on the Mac";
    }
    ta.addEventListener("input", () => {
        state.textContent = "unsaved changes";
    });
    document.getElementById("skReload").onclick = async () => {
        const g = await fetchFlow(f.id ? "r:" + f.id : panelNode.id, true);
        drawSkill(g);
    };
    if (!f.readOnly) document.getElementById("skSave").onclick = async () => {
        state.textContent = "saving…";
        const r = await api("/api/skill", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                id: f.id,
                text: ta.value,
                mtime: f.mtime
            })
        });
        const j = await r.json();
        if (!r.ok) {
            state.textContent = "not saved: " + j.error;
            return;
        }
        f.text = ta.value;
        f.mtime = j.mtime;
        delete FLOW["r:" + f.id];
        state.textContent = "saved · previous version kept in north-star/data/skill-history/" + f.id;
        tick(`<b>${f.id}</b> · skill saved — the next run uses it`);
    };
    pBody.querySelectorAll(".reads button").forEach(b => b.onclick = async () => {
        const v = document.getElementById("fileView");
        v.innerHTML = `<div class="hint">loading ${esc(b.dataset.p)}…</div>`;
        const r = await api("/api/file?path=" + encodeURIComponent(b.dataset.p));
        const j = await r.json();
        v.innerHTML = r.ok ? `<div class="section-h" style="margin:6px 0">${esc(j.path)} · read-only</div><pre class="fileview">${esc(j.text)}</pre>` : `<div class="hint">${esc(j.error)}</div>`;
    });
}

const inboxOverlay = document.getElementById("inboxOverlay");

const label = id => {
    const n = (DATA.projects || []).find(p => p.id === id);
    return n ? n.label : id;
};

window.openInbox = async function(project) {
    const body = document.getElementById("inboxBody");
    body.innerHTML = `<div class="hint">loading…</div>`;
    inboxOverlay.classList.add("open");
    const j = await (await api("/api/inbox", {
        cache: "no-store"
    })).json();
    const items = (j.items || []).slice().reverse();
    const dg = j.digest, groupOf = {};
    (dg?.groups || []).forEach(g => g.items.forEach(x => {
        groupOf[x.id] = g.id;
    }));
    const chart = dg ? (() => {
        const max = Math.max(...dg.groups.map(g => g.count), 1);
        return `<div class="digest"><div class="digest-h"><b>${dg.open}</b> open · ${dg.byAge.map(([l, n]) => `${n} ${l}`).join(" · ")}</div>\n      ${dg.groups.map(g => `<button class="dg-row${g.who === "agents" || g.who === "nobody" ? " dg-agents" : ""}" data-g="${g.id}" title="${esc(g.note)}">\n        <span class="dg-label">${esc(g.label)}</span><span class="dg-bar"><i style="width:${(g.count / max * 100).toFixed(1)}%"></i></span><span class="dg-n">${g.count}</span></button>\n        <div class="dg-note">${esc(g.note)}${g.oldestDays ? ` · oldest ${g.oldestDays}d` : ""}</div>`).join("")}\n      <div class="dg-filter" id="dgFilter" hidden></div></div>`;
    })() : "";
    const open = (j.items || []).filter(i => i.kind === "ask" && i.status === "open").sort((a, b) => (b.project === project) - (a.project === project));
    const waiting = items.filter(i => i.status === "answered" && !i.applied);
    const done = items.filter(i => i.status === "answered" && i.applied).slice(0, 8);
    const card = i => `<div class="ask-item" data-id="${i.id}">\n      <div class="meta">${i.id} · ${esc(label(i.project))} · from ${esc(i.from)}${i.seen > 1 ? ` · asked ${i.seen}×` : ""}${(i.rows || []).length ? ` · rows ${esc(i.rows.join(", "))}` : ""}</div>\n      <h5>${esc(i.title)}</h5>${i.body ? `<p>${esc(i.body)}</p>` : ""}\n      <textarea placeholder="Your answer…"></textarea>\n      <div class="row"><button class="topbtn primary" data-act="answer">Answer</button><button class="topbtn" data-act="dismiss">Not needed</button></div>\n    </div>`;
    const small = (i, what) => `<div class="ask-item done"><div class="meta">${i.id} · ${esc(label(i.project))} · ${what}</div>\n      <h5>${esc(i.kind === "note" ? "You told the agents" : i.title)}</h5><p>${esc(i.answer || "")}${i.appliedNote ? ` — <i>${esc(i.appliedNote)}</i>` : ""}</p></div>`;
    body.innerHTML = chart + (open.length ? open.map(card).join("") : `<p class="hint">Nothing needs you right now.</p>`) + (waiting.length ? `<div class="section-h">Answered — the lane picks these up on its next run</div>` + waiting.map(i => small(i, "waiting for the lane")).join("") : "") + (done.length ? `<div class="section-h">Applied</div>` + done.map(i => small(i, "applied by " + (i.appliedBy || "lane"))).join("") : "");
    body.querySelectorAll(".dg-row").forEach(b => b.onclick = () => {
        const g = b.dataset.g, on = b.classList.toggle("on");
        body.querySelectorAll(".dg-row").forEach(x => {
            if (x !== b) x.classList.remove("on");
        });
        body.querySelectorAll(".ask-item[data-id]").forEach(el => {
            el.hidden = on && groupOf[el.dataset.id] !== g;
        });
    });
    body.querySelectorAll(".ask-item[data-id] button").forEach(btn => btn.onclick = async () => {
        const el = btn.closest(".ask-item"), id = el.dataset.id, act = btn.dataset.act;
        const text = el.querySelector("textarea").value.trim();
        if (act === "answer" && !text) {
            el.querySelector("textarea").focus();
            return;
        }
        const r = await api("/api/inbox/" + act, {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                id: id,
                text: text
            })
        });
        if (r.ok) {
            tick(`<b>inbox</b> · ${id} ${act === "answer" ? "answered" : "dismissed"}`);
            DATA.inboxOpen = Math.max(0, (DATA.inboxOpen || 1) - 1);
            renderChrome();
            el.classList.add("done");
            el.innerHTML = `<div class="meta">${id} · ${act === "answer" ? "saved" : "dismissed"}</div>\n        <h5>${esc(el.querySelector("h5").textContent)}</h5>\n        ${act === "answer" ? `<p><b>Your answer:</b> ${esc(text)}</p><p class="hint">The next run of this lane reads it and writes it where it belongs.</p>` : ""}`;
        } else {
            const j = await r.json().catch(() => ({}));
            btn.insertAdjacentHTML("afterend", `<span class="hint">not saved: ${esc(j.error || r.status)}</span>`);
        }
    });
};

document.getElementById("inboxBtn").onclick = () => openInbox();

inboxOverlay.addEventListener("click", e => {
    if (e.target === inboxOverlay) inboxOverlay.classList.remove("open");
});
