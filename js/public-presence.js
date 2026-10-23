(function() {
    const LOCAL = /^(localhost|127\.0\.0\.1)$/.test(location.hostname);
    const SRC = LOCAL ? [ `http://${location.hostname}:4432/presence` ] : [ "https://susannas-mac-mini.tailc633d2.ts.net:8443/presence", "https://strapi-backend-production-4eb8.up.railway.app/north-star/public/activity" ];
    const DEVICES = [ "glasses", "phone", "tablet", "laptop" ], SEEN = [ "within the hour", "earlier today", "yesterday", "this week" ];
    const TYPES = {
        glasses: "glasses",
        iphone: "iPhone",
        ipad: "iPad",
        phone: "phone",
        "mac-mini": "Mac mini",
        macbook: "MacBook",
        laptop: "laptop"
    };
    const TYPE_ICON = {
        glasses: "glasses",
        iphone: "phone",
        ipad: "tablet",
        phone: "phone",
        "mac-mini": "laptop",
        macbook: "laptop",
        laptop: "laptop"
    };
    const both = a => a.length < 2 ? a.join("") : a.slice(0, -1).join(", ") + " and " + a[a.length - 1];
    const fromWords = p => p && p.talk === "on" && p.devices.length ? "from her " + both(p.devices.map(d => TYPES[d])) : "";
    window.nsTalkLine = () => {
        const p = last;
        if (!p || p.talk !== "on" || p.at != null && Date.now() - p.at > FRESH) return "";
        return "Susanna is talking to Mittens" + (fromWords(p) ? " " + fromWords(p) : "");
    };
    const n99 = v => Number.isInteger(v) && v >= 0 && v < 100 ? v : 0;
    const clean = j => {
        j = j && typeof j === "object" ? "presence" in j ? j.presence : j : null;
        if (!j || typeof j !== "object" || !("talk" in j)) return null;
        const talk = j.talk === "on" ? "on" : "off", at = typeof j.at === "string" ? Date.parse(j.at) : NaN;
        return {
            at: isNaN(at) ? null : at,
            talk: talk,
            device: talk === "on" && DEVICES.includes(j.device) ? j.device : null,
            devices: talk === "on" && Array.isArray(j.devices) ? [ ...new Set(j.devices.filter(d => d in TYPES)) ].slice(0, 4) : talk === "on" && j.device === "glasses" ? [ "glasses" ] : [],
            seen: talk === "off" && SEEN.includes(j.seen) ? j.seen : null,
            working: n99(j.working),
            waiting: n99(j.waiting)
        };
    };
    const ICON = {
        glasses: '<circle cx="4.5" cy="9" r="2.6"/><circle cx="11.5" cy="9" r="2.6"/><path d="M7.1 8.6c.6-.4 1.2-.4 1.8 0M1.9 8.4 1.2 5.5M14.1 8.4l.7-2.9"/>',
        phone: '<rect x="4.5" y="1.75" width="7" height="12.5" rx="1.6"/><path d="M7 12h2"/>',
        tablet: '<rect x="2.75" y="1.75" width="10.5" height="12.5" rx="1.6"/><path d="M7 12h2"/>',
        laptop: '<rect x="3" y="3" width="10" height="7" rx="1"/><path d="M1.5 12.5h13"/>',
        workers: '<circle cx="8" cy="5" r="2.5"/><path d="M3 14c0-2.8 2.2-4.75 5-4.75S13 11.2 13 14"/>',
        mitten: '<path d="M5 14.25V7.5a3 3 0 0 1 6 0v1.25l1.4-1.4a1.2 1.2 0 0 1 1.7 1.7L11 12.2v2.05zM5 12h6"/>'
    };
    const svg = k => `<svg class="ico" viewBox="0 0 16 16" aria-hidden="true">${ICON[k]}</svg>`;
    const FRESH = 10 * 6e4;
    let last = null, lastAt = 0;
    async function read() {
        if (Date.now() - lastAt < 3e4) return last;
        lastAt = Date.now();
        const m = "?m=" + Math.floor(Date.now() / 3e4);
        for (const u of SRC) {
            try {
                const r = await fetch(u + m, {
                    cache: "no-store"
                });
                if (r.ok) {
                    const p = clean(await r.json());
                    if (p) {
                        last = p;
                        break;
                    }
                }
            } catch {}
        }
        return last;
    }
    function draw(p) {
        const box = document.getElementById("healthChips");
        if (!box) return;
        let el = document.getElementById("presenceChip");
        const live = p && (p.at == null || Date.now() - p.at < FRESH);
        if (!live) {
            if (el) el.remove();
            return;
        }
        const on = p.talk === "on";
        const words = on ? "Susanna is talking to Mittens" : "Mittens idle";
        const sub = on ? fromWords(p) || (p.device ? `on ${p.device === "glasses" ? "the glasses" : `a ${p.device}`}` : "now") : p.seen ? `talked ${p.seen}` : "";
        const ico = on ? p.devices.length ? TYPE_ICON[p.devices[0]] : p.device : null;
        const sig = words + "|" + sub + "|" + (ico || "");
        if (!el) {
            el = document.createElement("div");
            el.id = "presenceChip";
            el.className = "agents-ind presence-ind";
            box.prepend(el);
        } else if (el.parentNode === box && box.firstChild !== el) box.prepend(el);
        if (el.dataset.sig === sig) return;
        el.dataset.sig = sig;
        el.classList.toggle("off", !on);
        el.title = `${words}${sub ? " " + sub : ""}`;
        el.setAttribute("aria-label", el.title);
        el.setAttribute("role", "status");
        el.innerHTML = `<span class="pulse" aria-hidden="true"></span>${on && p.devices.length > 1 ? p.devices.map(d => TYPE_ICON[d]).filter((k, i, a) => a.indexOf(k) === i).map(svg).join("") : svg(ico || "mitten")}<span class="lbl">${words}</span>${sub ? `<span class="who">${sub}</span>` : ""}`;
        const first = !window.NS_PRESENCE;
        window.NS_PRESENCE = p;
        if (first && typeof window.renderPublicChrome === "function") try {
            window.renderPublicChrome();
        } catch {}
        if (typeof window.nsPresenceChanged === "function") try {
            window.nsPresenceChanged();
        } catch {}
    }
    function iconWorkers() {
        const a = document.getElementById("agentsChip");
        if (a && document.getElementById("presenceChip") && !a.querySelector(":scope > .ico")) {
            const p = a.querySelector(".pulse");
            if (p) p.insertAdjacentHTML("afterend", svg("workers"));
        }
    }
    const tick = async () => {
        draw(await read());
        iconWorkers();
    };
    const start = () => {
        tick();
        setInterval(tick, 3e4);
    };
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start); else start();
    window.nsPresenceRedraw = () => {
        draw(last);
        iconWorkers();
    };
    new MutationObserver(() => {
        if (last) iconWorkers();
    }).observe(document.getElementById("healthChips") || document.body, {
        childList: true
    });
})();
