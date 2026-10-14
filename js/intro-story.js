(() => {
    const QS = new URLSearchParams(location.search);
    const MOMENT = QS.get("moment") === "star";
    const RMQ = matchMedia("(prefers-reduced-motion: reduce)");
    const cv = document.getElementById("scene"), ctx = cv.getContext("2d");
    const frame = document.getElementById("live"), slot = document.getElementById("shooting-star-slot");
    const capT = document.querySelector("#cap .t"), capS = document.querySelector("#cap .s"), capEl = document.getElementById("cap");
    const hint = document.getElementById("hint"), replay = document.getElementById("replay");
    const exploreBtn = document.getElementById("explore"), backBtn = document.getElementById("back"), cta = document.getElementById("cta");
    if (MOMENT) {
        document.body.classList.add("moment");
        [ hint, capEl, replay, frame, exploreBtn, backBtn, cta ].forEach(e => e.remove());
    } else if (!frame.getAttribute("src")) frame.src = "./?public=1&embed=1";
    let exploring = false;
    if (!MOMENT) {
        replay.onclick = () => scrollTo({
            top: 0,
            behavior: RMQ.matches ? "auto" : "smooth"
        });
        exploreBtn.onclick = () => {
            exploring = true;
            document.body.classList.add("explore");
            frame.tabIndex = 0;
            backBtn.hidden = false;
            exploreBtn.hidden = true;
        };
        backBtn.onclick = () => {
            exploring = false;
            document.body.classList.remove("explore");
            frame.tabIndex = -1;
            backBtn.hidden = true;
        };
    }
    const STAR = window.NSStar;
    let W = 0, H = 0, DPR = 1;
    const T = {};
    const TOK = [ "paper", "ink", "ink2", "muted", "dim", "edge", "edge2", "sky", "sky2", "sky3", "lit", "screen", "screen-off", "bezel", "wood", "grain" ];
    function tokens() {
        const cs = getComputedStyle(document.documentElement);
        for (const k of TOK) T[k] = cs.getPropertyValue("--" + k).trim();
    }
    function resize() {
        DPR = Math.min(2, devicePixelRatio || 1);
        W = cv.parentNode.clientWidth;
        H = cv.parentNode.clientHeight;
        cv.width = Math.round(W * DPR);
        cv.height = Math.round(H * DPR);
        cv.style.width = W + "px";
        cv.style.height = H + "px";
    }
    addEventListener("resize", resize);
    matchMedia("(prefers-color-scheme: dark)").addEventListener("change", tokens);
    tokens();
    resize();
    const clamp = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x));
    const lerp = (a, b, t) => a + (b - a) * t;
    const seg = (p, a, b) => clamp((p - a) / (b - a));
    const ease = t => t * t * (3 - 2 * t);
    const easeOut = t => 1 - Math.pow(1 - t, 3);
    const hash = n => {
        const x = Math.sin(n * 127.1 + 311.7) * 43758.5453;
        return x - Math.floor(x);
    };
    const toA = c => {
        if (Array.isArray(c)) return c;
        c = String(c).trim();
        if (c.startsWith("rgb")) return c.match(/[\d.]+/g).slice(0, 3).map(Number);
        c = c.replace("#", "");
        if (c.length === 3) c = c.split("").map(x => x + x).join("");
        const v = parseInt(c, 16);
        return [ v >> 16 & 255, v >> 8 & 255, v & 255 ];
    };
    const mixA = (a, b, t) => {
        const A = toA(a), B = toA(b);
        return A.map((v, i) => lerp(v, B[i], t));
    };
    const css = a => `rgb(${a.map(v => Math.round(v)).join(",")})`;
    const mix = (a, b, t) => css(mixA(a, b, t));
    const rgba = (c, a) => {
        const A = toA(c);
        return `rgba(${Math.round(A[0])},${Math.round(A[1])},${Math.round(A[2])},${clamp(a)})`;
    };
    const BEATS = [ .035, .12, .2, .27, .33, .39, .47, .54, .585, .66, .75, .8, .82, .84, .86, .88, .9, 1 ];
    const CHAIN = [ [ "mini", "the Mac mini, and its star" ], [ "wear", "something you wear" ], [ "pendant", "a pendant in steel and glass, a black stone ring" ], [ "skin", "skin" ], [ "muscle", "muscle" ], [ "eye", "Mittens opens its eye" ] ];
    const C0 = .78, C1 = .9, CW = (C1 - C0) / CHAIN.length;
    const CAPS = [ [ 0, .05, "Hello from Susanna's bedroom.", "what I care about and what I'm working on" ], [ .06, .135, "The East River, at sunset.", "" ], [ .145, .215, "Gold, then red.", "" ], [ .225, .3, "Dark. A window, a desk.", "" ], [ .305, .338, "A small computer that never sleeps.", "" ], [ .34, .392, "It thinks, and sends a spark.", "" ], [ .395, .478, "The screen draws North Star.", "" ], [ .482, .552, "Closer.", "" ], [ .555, .6, "This is the live map.", "every dot is something I am building" ], [ .612, .69, "Follow the star.", "" ], [ .702, .778, "What is love?", "my first message to ChatGPT, Dec 10, 2022" ], [ C0 + .002, C1 - .002, "Why I want to build soft robotics.", null ] ];
    const SKY = [ [ 0, "#D7A46A", "#EEC07C", "#FBE0A4" ], [ .08, "#7A86BA", "#E0A0B6", "#F7B486" ], [ .15, "#3D4A8C", "#9763A8", "#EC8882" ], [ .21, "#1E2452", "#4A387A", "#AE5A7A" ], [ .27, "#12162E", "#241C3E", "#4A2C4A" ] ];
    function skyAt(p) {
        let i = 0;
        while (i < SKY.length - 2 && p > SKY[i + 1][0]) i++;
        const A = SKY[i], B = SKY[i + 1], t = ease(seg(p, A[0], B[0])), night = ease(seg(p, .27, .32));
        const N = [ T.sky, T.sky2, T.sky3 ];
        return [ 1, 2, 3 ].map(j => mixA(mixA(A[j], B[j], t), N[j - 1], night));
    }
    const SUN = [ "#FFD66E", "#F7963C", "#D2382A" ];
    function sunAt(p) {
        const s = seg(p, .02, .2);
        const col = s < .5 ? mixA(SUN[0], SUN[1], s * 2) : mixA(SUN[1], SUN[2], s * 2 - 1);
        return {
            x: 798,
            y: lerp(292, 344, ease(s)),
            r: lerp(10.5, 6, s),
            col: col,
            s: s
        };
    }
    const KEYS = [ [ 0, {
        cx: 790,
        cy: 236,
        w: 360,
        h: 224,
        wp: 150,
        cyp: 280
    } ], [ .12, {
        cx: 790,
        cy: 290,
        w: 380,
        h: 238,
        wp: 156,
        cyp: 292
    } ], [ .185, {
        cx: 760,
        cy: 282,
        w: 470,
        h: 292,
        wp: 210,
        cyp: 290
    } ], [ .27, {
        cx: 500,
        cy: 250,
        w: 1260,
        h: 960,
        wp: 960
    } ], [ .31, {
        cx: 200,
        cy: 548,
        w: 520,
        h: 330,
        wp: 400
    } ], [ .385, {
        cx: 395,
        cy: 470,
        w: 760,
        h: 430,
        wp: 560
    } ], [ .45, {
        cx: 515,
        cy: 352,
        w: 430,
        h: 300,
        wp: 380
    } ], [ .48, {
        cx: 515,
        cy: 352,
        w: 430,
        h: 300,
        wp: 380
    } ] ];
    for (const [, k] of KEYS) if (k.cyp == null) k.cyp = k.cy + 40;
    function camAt(p) {
        let i = 0;
        while (i < KEYS.length - 2 && p > KEYS[i + 1][0]) i++;
        const [p0, A] = KEYS[i], [p1, B] = KEYS[i + 1], t = ease(seg(p, p0, p1));
        const portrait = H > W * 1.1;
        const f = k => lerp(A[k], B[k], t), lf = k => Math.exp(lerp(Math.log(A[k]), Math.log(B[k]), t));
        const z = portrait ? W / lf("wp") : Math.min(W / lf("w"), H / lf("h"));
        return {
            cx: f("cx"),
            cy: portrait ? f("cyp") : f("cy"),
            z: z
        };
    }
    const SCREEN = [ 342, 262, 688, 446 ];
    const FACE_B = 438;
    function camFull(p) {
        const c = camAt(Math.min(p, .48));
        if (p <= .48) return c;
        const g = ease(seg(p, .48, .555));
        const fw = SCREEN[2] - SCREEN[0], fh = FACE_B - SCREEN[1];
        const zc = Math.max(W / fw, H / fh) * 1.04;
        return {
            cx: lerp(c.cx, (SCREEN[0] + SCREEN[2]) / 2, g),
            cy: lerp(c.cy, (SCREEN[1] + FACE_B) / 2, g),
            z: Math.exp(lerp(Math.log(c.z), Math.log(zc), g))
        };
    }
    const toS = (cam, x, y) => [ (x - cam.cx) * cam.z + W / 2, (y - cam.cy) * cam.z + H / 2 ];
    function setCam(cam) {
        ctx.setTransform(DPR * cam.z, 0, 0, DPR * cam.z, DPR * (W / 2 - cam.cx * cam.z), DPR * (H / 2 - cam.cy * cam.z));
    }
    const PANES = [ [ 282, -388, 690, 58 ], [ 706, -388, 940, 58 ], [ 292, 112, 940, 455 ] ];
    const CABLE = (() => {
        const pts = [], P = (x, y) => pts.push([ x, y ]);
        const cub = (a, b, c, d, n) => {
            for (let i = 1; i <= n; i++) {
                const t = i / n, u = 1 - t;
                P(u * u * u * a[0] + 3 * u * u * t * b[0] + 3 * u * t * t * c[0] + t * t * t * d[0], u * u * u * a[1] + 3 * u * u * t * b[1] + 3 * u * t * t * c[1] + t * t * t * d[1]);
            }
        };
        P(236, 556);
        cub([ 236, 556 ], [ 262, 540 ], [ 268, 505 ], [ 320, 503 ], 16);
        for (let x = 340; x <= 470; x += 20) P(x, 503);
        cub([ 470, 503 ], [ 505, 503 ], [ 515, 495 ], [ 515, 446 ], 12);
        let L = 0;
        const acc = [ 0 ];
        for (let i = 1; i < pts.length; i++) {
            L += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
            acc.push(L);
        }
        return {
            pts: pts,
            acc: acc,
            L: L,
            at(f) {
                const d = clamp(f) * L;
                let i = 1;
                while (i < acc.length - 1 && acc[i] < d) i++;
                const t = (d - acc[i - 1]) / Math.max(1e-6, acc[i] - acc[i - 1]);
                return [ lerp(pts[i - 1][0], pts[i][0], t), lerp(pts[i - 1][1], pts[i][1], t) ];
            }
        };
    })();
    const rr = (x, y, w, h, r) => {
        ctx.beginPath();
        ctx.roundRect ? ctx.roundRect(x, y, w, h, r) : ctx.rect(x, y, w, h);
    };
    function outside(time, p, u) {
        const [top, mid, hor] = skyAt(p), night = ease(seg(p, .24, .32)), dusk = seg(p, .12, .3);
        const g = ctx.createLinearGradient(0, -420, 0, 332);
        g.addColorStop(0, css(top));
        g.addColorStop(.55, css(mid));
        g.addColorStop(1, css(hor));
        ctx.fillStyle = g;
        ctx.fillRect(250, -420, 720, 900);
        if (night > 0) for (let i = 0; i < 46; i++) {
            const x = 470 + hash(i) * 380, y = -380 + hash(i + 50) * 600;
            if (y > 300) continue;
            const tw = RMQ.matches ? .7 : .45 + .55 * Math.abs(Math.sin(time * (.6 + hash(i + 9)) + i));
            ctx.fillStyle = rgba(T.lit, .65 * tw * night);
            ctx.beginPath();
            ctx.arc(x, y, (hash(i + 3) > .85 ? 1.6 : .9) * u * 1.4, 0, 7);
            ctx.fill();
        }
        const S = sunAt(p), sunA = 1 - seg(p, .19, .24);
        if (sunA > 0) {
            const gl = ctx.createRadialGradient(S.x, S.y, 0, S.x, S.y, S.r * 9);
            gl.addColorStop(0, rgba(S.col, .55 * sunA));
            gl.addColorStop(.3, rgba(S.col, .18 * sunA));
            gl.addColorStop(1, rgba(S.col, 0));
            ctx.fillStyle = gl;
            ctx.fillRect(S.x - S.r * 9, S.y - S.r * 9, S.r * 18, S.r * 18);
            ctx.fillStyle = rgba(S.col, sunA);
            ctx.beginPath();
            ctx.arc(S.x, S.y, S.r, 0, 7);
            ctx.fill();
        }
        const rise = ease(seg(p, .025, .12)), dy = (1 - rise) * 230;
        ctx.save();
        ctx.translate(0, dy);
        const sil = mixA(mixA("#5B4A6A", "#2A2244", dusk), toA(T.sky2), night);
        ctx.fillStyle = css(sil);
        const towers = [ [ 566, 34, 14 ], [ 584, 48, 12 ], [ 600, 26, 18 ], [ 622, 58, 12 ], [ 640, 40, 16 ], [ 660, 30, 20 ], [ 684, 52, 14 ], [ 702, 36, 18 ], [ 724, 64, 12 ], [ 742, 44, 16 ], [ 762, 28, 20 ], [ 814, 50, 14 ], [ 832, 72, 12 ], [ 848, 38, 18 ], [ 870, 46, 14 ], [ 886, 30, 16 ] ];
        for (const [x, h, w] of towers) ctx.fillRect(x, 330 - h * (.55 + .45 * rise), w, h * (.55 + .45 * rise) + 2);
        if (night < 1) for (const [x, h, w] of towers) {
            ctx.fillStyle = rgba(S.col, .35 * (1 - dusk) * (1 - night));
            ctx.fillRect(x + w - 4, 330 - h * (.55 + .45 * rise), 4, h * (.55 + .45 * rise));
        }
        const lit = .25 + .75 * seg(p, .14, .3);
        for (const [x, h] of towers) for (let k = 0; k < h / 10 - 1; k++) if (hash(x + k) > .62) {
            ctx.fillStyle = rgba(T.lit, .55 * lit * dusk);
            ctx.fillRect(x + 3, 330 - h * (.55 + .45 * rise) + 6 + k * 10, 2, 3);
        }
        const wg = ctx.createLinearGradient(0, 330, 0, 470);
        wg.addColorStop(0, css(mixA(hor, "#1A1830", .35)));
        wg.addColorStop(1, css(mixA(mid, "#100E1C", .6)));
        ctx.fillStyle = wg;
        ctx.fillRect(440, 330, 470, 240);
        if (sunA > 0) for (let i = 0; i < 12; i++) {
            const y = 334 + i * 5, w = (14 - i) * 1.6 + (RMQ.matches ? 0 : Math.sin(time * 2 + i) * 2.5);
            ctx.strokeStyle = rgba(S.col, (.7 - i * .05) * sunA);
            ctx.lineWidth = 1.6;
            ctx.beginPath();
            ctx.moveTo(S.x - w, y);
            ctx.lineTo(S.x + w, y);
            ctx.stroke();
        }
        ctx.strokeStyle = rgba(T.lit, .3 * (.4 + .6 * night));
        ctx.lineWidth = u * 1.2;
        for (let i = 0; i < 14; i++) {
            const y = 336 + hash(i + 70) * 52, x = 470 + hash(i + 90) * 330, l = 8 + hash(i) * 26, s = RMQ.matches ? 0 : Math.sin(time + i) * 4;
            ctx.beginPath();
            ctx.moveTo(x + s, y);
            ctx.lineTo(x + l + s, y);
            ctx.stroke();
        }
        ctx.fillStyle = css(mixA("#2A2232", toA(T.sky), night));
        for (let i = 0; i < 9; i++) {
            ctx.beginPath();
            ctx.arc(760 + hash(i + 20) * 90, 404 + hash(i + 30) * 44, 16 + hash(i + 40) * 14, 0, 7);
            ctx.fill();
        }
        ctx.restore();
        const brick = mixA(mixA("#7A4A4E", "#3E2A3A", dusk), toA(T.sky2), night);
        const block = (x0, x1, top) => {
            ctx.fillStyle = css(brick);
            ctx.fillRect(x0, top, x1 - x0, 900);
            for (let x = x0 + 14; x < x1 - 14; x += 34) for (let y = top + 18; y < 470; y += 44) {
                const on = hash(x * 7 + y) > .78;
                ctx.fillStyle = on ? rgba(T.lit, .6 * lit) : css(mixA(brick, [ 0, 0, 0 ], .25));
                ctx.fillRect(x, y, 16, 24);
            }
        };
        block(282, 452, -420);
        block(905, 972, -300);
    }
    const GLINT_EDGES = [ [ 328, 250, 702, 250 ], [ 316, 440, 714, 440 ], [ 318, 566, 782, 566 ], [ 52, 529, 216, 529 ], [ 170, 628, 240, 628 ], [ 342, 262, 520, 262 ] ];
    function glints(p, u) {
        const g = seg(p, .17, .22) * (1 - seg(p, .27, .31));
        if (g <= 0) return;
        const sx = lerp(-100, 1100, seg(p, .17, .31)), col = sunAt(.17).col;
        ctx.lineCap = "round";
        for (const [x0, y0, x1, y1] of GLINT_EDGES) for (let k = 0; k < 24; k++) {
            const a = k / 24, b = (k + 1) / 24, x = lerp(x0, x1, (a + b) / 2), f = Math.exp(-Math.pow((x - sx) / 90, 2));
            if (f < .03) continue;
            ctx.strokeStyle = rgba(col, .85 * g * f);
            ctx.lineWidth = 2.4 * u;
            ctx.beginPath();
            ctx.moveTo(lerp(x0, x1, a), lerp(y0, y1, a));
            ctx.lineTo(lerp(x0, x1, b), lerp(y0, y1, b));
            ctx.stroke();
        }
        ctx.save();
        ctx.beginPath();
        ctx.rect(SCREEN[0], SCREEN[1], SCREEN[2] - SCREEN[0], SCREEN[3] - SCREEN[1]);
        ctx.clip();
        const sh = ctx.createLinearGradient(sx - 120, 262, sx + 40, 446);
        sh.addColorStop(0, rgba(col, 0));
        sh.addColorStop(.5, rgba(col, .28 * g));
        sh.addColorStop(1, rgba(col, 0));
        ctx.fillStyle = sh;
        ctx.fillRect(SCREEN[0], SCREEN[1], SCREEN[2] - SCREEN[0], SCREEN[3] - SCREEN[1]);
        ctx.restore();
    }
    function hologram(p, time, u) {
        const a = seg(p, .4, .44) * (1 - seg(p, .47, .5));
        if (a <= 0 || !STAR) return;
        const fl = RMQ.matches ? 1 : .8 + .2 * Math.sin(time * 9) * Math.sin(time * 2.3);
        ctx.save();
        const cg = ctx.createLinearGradient(0, 252, 0, 120);
        cg.addColorStop(0, rgba(T.lit, .22 * a));
        cg.addColorStop(1, rgba(T.lit, 0));
        ctx.fillStyle = cg;
        ctx.beginPath();
        ctx.moveTo(430, 252);
        ctx.lineTo(600, 252);
        ctx.lineTo(560, 128);
        ctx.lineTo(470, 128);
        ctx.closePath();
        ctx.fill();
        ctx.strokeStyle = rgba(T.lit, .22 * a * fl);
        ctx.lineWidth = u;
        for (let y = 0; y < 120; y += 7) {
            const yy = 250 - (y + (RMQ.matches ? 0 : time * 14)) % 120, f = (250 - yy) / 122;
            ctx.beginPath();
            ctx.moveTo(lerp(430, 470, f), yy);
            ctx.lineTo(lerp(600, 560, f), yy);
            ctx.stroke();
        }
        ctx.strokeStyle = rgba(T.lit, .75 * a * fl);
        STAR.stroke(ctx, 515, 176 + (RMQ.matches ? 0 : Math.sin(time * 1.4) * 3), 64, 1.2 * u);
        ctx.fillStyle = rgba(T.lit, .18 * a * fl);
        STAR.fill(ctx, 515, 176 + (RMQ.matches ? 0 : Math.sin(time * 1.4) * 3), 64);
        ctx.restore();
    }
    function desk(p, time, cam) {
        const u = 1 / cam.z;
        const line = (w = 1.6) => {
            ctx.strokeStyle = T.ink;
            ctx.lineWidth = w * u;
            ctx.lineJoin = "round";
            ctx.lineCap = "round";
        };
        for (const [x0, y0, x1, y1] of PANES) {
            ctx.save();
            ctx.beginPath();
            ctx.rect(x0, y0, x1 - x0, y1 - y0);
            ctx.clip();
            outside(time, p, u);
            ctx.restore();
        }
        const A0 = ctx.globalAlpha, fr = ease(seg(p, .165, .225));
        line(1.8);
        ctx.strokeRect(250, -420, 720, 900);
        ctx.strokeRect(266, -404, 690, 478);
        ctx.strokeRect(276, 96, 680, 375);
        for (const [x0, y0, x1, y1] of PANES) ctx.strokeRect(x0, y0, x1 - x0, y1 - y0);
        ctx.fillStyle = T.paper;
        rr(690, 72, 22, 16, 3);
        ctx.fill();
        ctx.stroke();
        ctx.lineWidth = 4 * u;
        ctx.beginPath();
        ctx.moveTo(701, 84);
        ctx.lineTo(726, 150);
        ctx.stroke();
        line(1.6);
        ctx.fillStyle = T.paper;
        ctx.fillRect(232, 471, 756, 24);
        ctx.strokeRect(232, 471, 756, 24);
        ctx.globalAlpha = A0 * fr;
        ctx.save();
        ctx.translate(120, 225);
        ctx.rotate(-.03);
        line(1.2);
        ctx.fillStyle = T.paper;
        ctx.fillRect(-82, -74, 164, 148);
        ctx.strokeRect(-82, -74, 164, 148);
        ctx.strokeStyle = T.muted;
        ctx.lineWidth = u;
        const sk = [ [ -40, -30 ], [ 10, -44 ], [ 44, -12 ], [ 30, 30 ], [ -22, 36 ], [ -52, 6 ] ];
        sk.forEach(([x, y]) => {
            ctx.beginPath();
            ctx.moveTo(0, 0);
            ctx.lineTo(x, y);
            ctx.stroke();
            ctx.beginPath();
            ctx.arc(x, y, 5, 0, 7);
            ctx.stroke();
        });
        ctx.fillStyle = T.ink;
        if (STAR) STAR.fill(ctx, 0, 0, 20); else {
            ctx.beginPath();
            ctx.arc(0, 0, 6, 0, 7);
            ctx.fill();
        }
        ctx.fillStyle = T.dim;
        ctx.fillRect(-90, -80, 22, 9);
        ctx.fillRect(68, -80, 22, 9);
        ctx.restore();
        line(1.6);
        ctx.beginPath();
        ctx.moveTo(-900, 495);
        ctx.lineTo(1900, 495);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(-900, 700);
        ctx.lineTo(1900, 700);
        ctx.moveTo(-900, 726);
        ctx.lineTo(1900, 726);
        ctx.stroke();
        line(1.2);
        ctx.strokeRect(300, 748, 600, 66);
        ctx.beginPath();
        ctx.moveTo(570, 782);
        ctx.lineTo(630, 782);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(-60, 726);
        ctx.lineTo(-60, 1300);
        ctx.moveTo(1060, 726);
        ctx.lineTo(1060, 1300);
        ctx.stroke();
        line(1.3);
        ctx.beginPath();
        CABLE.pts.forEach(([x, y], i) => i ? ctx.lineTo(x, y) : ctx.moveTo(x, y));
        ctx.stroke();
        const wake = seg(p, .385, .41);
        ctx.fillStyle = T.bezel;
        rr(328, 248, 374, 210, 8);
        ctx.fill();
        line(1.6);
        ctx.stroke();
        ctx.fillStyle = mix(T["screen-off"], T.screen, wake);
        ctx.fillRect(SCREEN[0], SCREEN[1], SCREEN[2] - SCREEN[0], SCREEN[3] - SCREEN[1]);
        if (wake > 0) {
            const sh = ctx.createLinearGradient(342, 262, 688, 446);
            sh.addColorStop(0, "rgba(255,255,255,0.0)");
            sh.addColorStop(.5, `rgba(255,255,255,${.18 * wake})`);
            sh.addColorStop(1, "rgba(255,255,255,0)");
            ctx.fillStyle = sh;
            ctx.fillRect(342, 262, 346, 184);
        }
        ctx.fillStyle = T.wood;
        rr(316, 438, 398, 62, 10);
        ctx.fill();
        line(1.8);
        ctx.stroke();
        ctx.strokeStyle = T.grain;
        ctx.lineWidth = u;
        for (let i = 0; i < 4; i++) {
            const y = 452 + i * 11;
            ctx.beginPath();
            ctx.moveTo(332, y);
            ctx.bezierCurveTo(430, y - 5 + i * 2, 560, y + 6 - i, 698, y - 2);
            ctx.stroke();
        }
        line(1.2);
        ctx.beginPath();
        ctx.moveTo(400, 503);
        ctx.lineTo(630, 503);
        ctx.stroke();
        ctx.fillStyle = T.paper;
        line(1.8);
        ctx.beginPath();
        ctx.moveTo(52, 531);
        ctx.quadraticCurveTo(54, 528, 60, 528);
        ctx.lineTo(210, 528);
        ctx.quadraticCurveTo(216, 528, 218, 531);
        ctx.lineTo(234, 546);
        ctx.lineTo(36, 546);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        rr(34, 546, 202, 44, 9);
        ctx.fill();
        ctx.stroke();
        ctx.strokeStyle = T.dim;
        ctx.lineWidth = u;
        ctx.beginPath();
        ctx.moveTo(50, 598);
        ctx.lineTo(220, 598);
        ctx.stroke();
        const brain = seg(p, .29, .325), still = RMQ.matches;
        const led = still ? p >= .29 ? 1 : .55 : lerp(.35 + .25 * Math.sin(time * 1.3), 1, brain);
        ctx.fillStyle = rgba(T.ink, clamp(led));
        ctx.beginPath();
        ctx.arc(222, 567, 2.8, 0, 7);
        ctx.fill();
        if (p > .285 && p < .39) {
            for (let k = 0; k < 3; k++) {
                const ph = still ? (k + 1) / 4 : (time * .7 + k / 3) % 1;
                ctx.strokeStyle = rgba(T.ink, (1 - ph) * .55 * brain * (1 - seg(p, .37, .39)));
                ctx.lineWidth = 1.4 * u;
                ctx.beginPath();
                ctx.arc(222, 567, 6 + ph * 46, 0, 7);
                ctx.stroke();
            }
        }
        ctx.fillStyle = T.wood;
        line(1.6);
        ctx.beginPath();
        ctx.moveTo(318, 566);
        ctx.lineTo(782, 566);
        ctx.lineTo(804, 648);
        ctx.lineTo(296, 648);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        ctx.strokeStyle = T.muted;
        ctx.lineWidth = .9 * u;
        for (let r = 0; r < 5; r++) {
            const y = 573 + r * 14.5, f = (y - 566) / 82, x0 = lerp(326, 306, f), x1 = lerp(774, 794, f), kw = (x1 - x0 - 40) / 17;
            for (let k = 0; k < 17; k++) {
                const x = x0 + k * kw + (k > 13 ? 22 : 0);
                if (x + kw > x1) break;
                rr(x + 1.5, y, kw - 3, 10, 2);
                ctx.stroke();
            }
        }
        ctx.strokeStyle = T.grain;
        ctx.lineWidth = u;
        for (let i = 0; i < 3; i++) {
            ctx.beginPath();
            ctx.moveTo(300 + i * 2, 652 - i * 2);
            ctx.lineTo(800 - i * 2, 652 - i * 2);
            ctx.stroke();
        }
        ctx.fillStyle = T.wood;
        line(1.6);
        ctx.beginPath();
        ctx.ellipse(206, 652, 40, 27, 0, 0, 7);
        ctx.fill();
        ctx.stroke();
        ctx.lineWidth = u;
        ctx.beginPath();
        ctx.moveTo(206, 626);
        ctx.lineTo(206, 644);
        ctx.stroke();
        ctx.strokeStyle = T.grain;
        ctx.beginPath();
        ctx.ellipse(206, 656, 26, 15, 0, 3.6, 5.8);
        ctx.stroke();
        line(1.2);
        ctx.beginPath();
        ctx.moveTo(864, 478);
        ctx.lineTo(852, 420);
        ctx.moveTo(884, 478);
        ctx.lineTo(898, 432);
        ctx.stroke();
        ctx.fillStyle = T.wood;
        line(1.6);
        ctx.beginPath();
        ctx.moveTo(846, 480);
        ctx.lineTo(848, 552);
        ctx.quadraticCurveTo(875, 562, 902, 552);
        ctx.lineTo(904, 480);
        ctx.fill();
        ctx.stroke();
        ctx.beginPath();
        ctx.ellipse(875, 480, 29, 7, 0, 0, 7);
        ctx.fill();
        ctx.stroke();
        for (let k = 0; k < 3; k++) {
            const y = 498 + k * 17;
            ctx.beginPath();
            ctx.ellipse(866 + k % 2 * 16, y, 4, 7, -.5, 0, 7);
            ctx.stroke();
        }
        ctx.globalAlpha = A0;
        glints(p, u);
        hologram(p, time, u);
        const sp = seg(p, .335, .39);
        if (sp > 0 && sp < 1) {
            for (let j = 10; j >= 0; j--) {
                const [x, y] = CABLE.at(sp - j * .012), a = 1 - j / 11;
                ctx.fillStyle = rgba(T.ink, a * .9);
                ctx.beginPath();
                ctx.arc(x, y, (1.2 + a * 3.2) * u * 1.2, 0, 7);
                ctx.fill();
            }
            const [x, y] = CABLE.at(sp);
            ctx.fillStyle = T.ink;
            if (STAR) STAR.fill(ctx, x, y, 22 * u); else {
                ctx.beginPath();
                ctx.arc(x, y, 6 * u, 0, 7);
                ctx.fill();
            }
        }
    }
    function layout() {
        if (MOMENT) return null;
        try {
            const f = frame.contentWindow;
            if (f && f.nsLayout) {
                const L = f.nsLayout();
                if (L.ready && L.nodes.length > 1) return L;
            }
        } catch {}
        return null;
    }
    const scr = (L, n) => [ L.W / 2 + L.cam.x + n.x * L.cam.k, L.H / 2 + L.cam.y + n.y * L.cam.k ];
    const STANDIN = (() => {
        const nodes = [ {
            id: "hub",
            type: "hub",
            x: 0,
            y: 0,
            r: 30
        } ], links = [];
        for (let i = 0; i < 9; i++) {
            const a = i / 9 * 6.283 - 1.57, n = {
                id: "p" + i,
                type: "project",
                x: Math.cos(a) * 190,
                y: Math.sin(a) * 150,
                r: 20
            };
            nodes.push(n);
            links.push({
                s: nodes[0],
                t: n
            });
            for (let j = 0; j < 2; j++) {
                const b = a + (j - .5) * .3, c = {
                    id: "c" + i + j,
                    type: "child",
                    x: Math.cos(b) * 300,
                    y: Math.sin(b) * 230,
                    r: 7
                };
                nodes.push(c);
                links.push({
                    s: n,
                    t: c
                });
            }
        }
        return nodes && {
            nodes: nodes,
            links: links
        };
    })();
    function standin() {
        const k = Math.min(W / 760, H / 600);
        return {
            ...STANDIN,
            cam: {
                x: 0,
                y: 0,
                k: k
            },
            W: W,
            H: H,
            showLabel: () => false,
            stand: true
        };
    }
    function drawMap(L, tf, k, show = 1, fade = 1, hubOn = 1) {
        const Lk = L.cam.k * k, hub = L.nodes[0], H0 = scr(L, hub);
        const pos = n => tf(scr(L, n));
        let far = 1;
        for (const n of L.nodes) {
            const s = scr(L, n);
            far = Math.max(far, Math.hypot(s[0] - H0[0], s[1] - H0[1]));
        }
        const when = n => {
            const s = scr(L, n);
            return Math.hypot(s[0] - H0[0], s[1] - H0[1]) / far * .85;
        };
        const grow = n => clamp((show - when(n)) * 7);
        const labelA = seg(k, .55, .9);
        ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
        ctx.globalAlpha = fade;
        for (const l of L.links) {
            if (l.overlay || fade <= 0) continue;
            const g = grow(l.t);
            if (g <= 0) continue;
            const [ax, ay] = pos(l.s), [bx, by] = pos(l.t);
            let cx = (ax + bx) / 2, cy = (ay + by) / 2;
            if (L.bend && (l.cross || l.vision || l.faint)) {
                const b = L.bend(l);
                [cx, cy] = tf(scr(L, {
                    x: b[0],
                    y: b[1]
                }));
            }
            ctx.strokeStyle = l.vision ? T.muted : l.faint ? T.edge : l.cross ? T.edge2 : T.edge;
            if (k < .5) ctx.strokeStyle = "#B5B5B5";
            ctx.lineWidth = Math.max(.6, (l.s.type === "hub" ? 1.6 : l.vision ? 1.3 : 1.1) * Lk);
            ctx.setLineDash(l.vision ? [ 6 * Lk, 5 * Lk ] : l.faint ? [ 1.5 * Lk, 4 * Lk ] : l.cross ? [ 4 * Lk, 5 * Lk ] : []);
            ctx.beginPath();
            ctx.moveTo(ax, ay);
            const N = 16;
            for (let i = 1; i <= Math.ceil(N * g); i++) {
                const t = Math.min(g, i / N), u = 1 - t;
                ctx.lineTo(u * u * ax + 2 * u * t * cx + t * t * bx, u * u * ay + 2 * u * t * cy + t * t * by);
            }
            ctx.stroke();
            ctx.setLineDash([]);
        }
        const ink = k < .5 ? "#000" : T.ink, paper = k < .5 ? "#FFF" : T.paper;
        for (const n of L.nodes) {
            if (n.type === "intent" || n.type === "agent") continue;
            const isHub = n === hub;
            let g = isHub ? 1 : easeOut(grow(n));
            if (g <= 0) continue;
            const [x, y] = pos(n), r = Math.max(isHub ? 2.5 : .8, n.r * Lk) * g;
            const planned = n.planned || n.status === "planned" || n.stage === "plan", dormant = n.status === "dormant";
            ctx.globalAlpha = (isHub ? hubOn : fade) * (dormant ? .32 : 1);
            if (ctx.globalAlpha <= 0) continue;
            if (isHub) {
                ctx.fillStyle = "#000";
                ctx.beginPath();
                ctx.arc(x, y, r, 0, 7);
                ctx.fill();
                if (STAR) {
                    ctx.fillStyle = "#FFF";
                    STAR.fill(ctx, x, y, r * 1.56);
                }
            } else if (n.type === "project" || n.owned) {
                ctx.fillStyle = paper;
                ctx.strokeStyle = dormant ? T.dim : planned ? T.muted : ink;
                ctx.lineWidth = Math.max(.7, (n.type === "project" ? planned ? 1.7 : n.sub ? 2 : 2.4 : planned ? 1.3 : 1.6) * Lk);
                ctx.beginPath();
                ctx.arc(x, y, r, 0, 7);
                ctx.fill();
                ctx.stroke();
                if (n.status && !dormant && k > .5) {
                    ctx.fillStyle = n.status === "working" ? T.ink : n.status === "done" ? T.muted : T.dim;
                    ctx.beginPath();
                    ctx.arc(x + r * .72, y - r * .72, (n.type === "project" ? 5.2 : 4) * Lk * g, 0, 7);
                    ctx.fill();
                    ctx.strokeStyle = T.paper;
                    ctx.lineWidth = 1.6 * Lk;
                    ctx.stroke();
                }
            } else {
                ctx.fillStyle = k < .5 ? "#999" : T.muted;
                ctx.beginPath();
                ctx.arc(x, y, r, 0, 7);
                ctx.fill();
            }
            const la = labelA * clamp(g * 1.2 - .2);
            if (la > 0 && L.showLabel(n)) {
                const px = L.fontPx(n) * Lk, lab = n.lab, lx = lab ? x + lab.dx * Lk : x;
                ctx.font = L.fontOf(n).replace(/[\d.]+px/, px.toFixed(2) + "px");
                ctx.textAlign = lab ? lab.al : "center";
                ctx.textBaseline = "top";
                ctx.globalAlpha = la * (isHub ? hubOn : fade) * (dormant ? .32 : 1);
                const ly = lab ? y + lab.dy * Lk : y + r / Math.max(g, .01) + (isHub ? 8 : 6) * Lk;
                ctx.strokeStyle = rgba(T.paper, .9);
                ctx.lineWidth = 3 * Lk;
                ctx.lineJoin = "round";
                ctx.strokeText(n.label, lx, ly);
                ctx.fillStyle = dormant || planned ? T.muted : T.ink;
                ctx.fillText(n.label, lx, ly);
            }
        }
        ctx.globalAlpha = 1;
    }
    function screenMap(L, R, b, show) {
        let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9;
        for (const n of L.nodes) {
            const [x, y] = scr(L, n);
            x0 = Math.min(x0, x);
            x1 = Math.max(x1, x);
            y0 = Math.min(y0, y);
            y1 = Math.max(y1, y);
        }
        const pad = Math.min(R.w, R.h) * .07, kA = Math.min((R.w - pad * 2) / (x1 - x0 || 1), (R.h - pad * 2) / (y1 - y0 || 1));
        const kB = Math.min(R.w / W, R.h / H), Rc = [ R.x + R.w / 2, R.y + R.h / 2 ], Bc = [ (x0 + x1) / 2, (y0 + y1) / 2 ];
        const tf = S => [ lerp(Rc[0] + (S[0] - Bc[0]) * kA, Rc[0] + (S[0] - W / 2) * kB, b), lerp(Rc[1] + (S[1] - Bc[1]) * kA, Rc[1] + (S[1] - H / 2) * kB, b) ];
        drawMap(L, tf, lerp(kA, kB, b), show);
        return tf(scr(L, L.nodes[0]));
    }
    let AS = 1;
    function art(cx, cy, s) {
        AS = s;
        ctx.setTransform(DPR * s, 0, 0, DPR * s, DPR * cx, DPR * cy);
        ctx.lineCap = "round";
        ctx.lineJoin = "round";
    }
    function pen(g, len, build, w = 1.8, col = T.ink) {
        if (g <= 0) return;
        ctx.strokeStyle = col;
        ctx.lineWidth = w / AS;
        if (g < 1) {
            ctx.setLineDash([ len, len + 40 ]);
            ctx.lineDashOffset = len * (1 - g);
        }
        ctx.beginPath();
        build();
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.lineDashOffset = 0;
    }
    const part = (g, i, n) => clamp(g * (n + 1) - i);
    function mittens(g, cx, cy, rx, ry, o, time, opts = {}) {
        const br = RMQ.matches ? 0 : Math.sin(time * 1.5) * .018;
        const RY = ry * (1 + br), top = cy + ry - RY * 2, CY = cy + ry - RY;
        pen(part(g, 0, 4), 6.3 * Math.max(rx, RY) * 1.1, () => ctx.ellipse(cx, CY, rx, RY, 0, 0, Math.PI * 2));
        const on = th => [ cx + rx * Math.cos(th), CY + RY * Math.sin(th) ];
        const ear = (a, b) => {
            const [x0, y0] = on(a), [x1, y1] = on(b), m = (a + b) / 2, [mx, my] = on(m);
            ctx.moveTo(x0, y0);
            ctx.quadraticCurveTo(mx + Math.cos(m) * RY * .5, my + Math.sin(m) * RY * .5, x1, y1);
        };
        pen(part(g, 1, 4), RY * 1.4, () => {
            ear(-2.3, -1.78);
            ear(-1.36, -.84);
        });
        const ex = rx * .34, ey = CY - RY * .12;
        if (o < .08) pen(part(g, 2, 4), rx * .4, () => {
            ctx.moveTo(cx - ex - rx * .1, ey);
            ctx.quadraticCurveTo(cx - ex, ey + rx * .08, cx - ex + rx * .1, ey);
            ctx.moveTo(cx + ex - rx * .1, ey);
            ctx.quadraticCurveTo(cx + ex, ey + rx * .08, cx + ex + rx * .1, ey);
        }); else if (part(g, 2, 4) > 0) {
            ctx.globalAlpha *= 1;
            ctx.strokeStyle = T.ink;
            ctx.lineWidth = 1.8 / AS;
            ctx.fillStyle = T.ink;
            for (const s of [ -1, 1 ]) {
                ctx.beginPath();
                ctx.ellipse(cx + s * ex, ey, rx * .1, rx * .1 * o, 0, 0, 7);
                ctx.stroke();
                ctx.beginPath();
                ctx.arc(cx + s * ex, ey + rx * .01, rx * .045 * o, 0, 7);
                ctx.fill();
            }
        }
        if (opts.feet) pen(part(g, 3, 4), rx, () => {
            for (const s of [ -1, 1 ]) {
                ctx.moveTo(cx + s * rx * .32 - rx * .12, cy + ry + 2);
                ctx.quadraticCurveTo(cx + s * rx * .32, cy + ry - rx * .1, cx + s * rx * .32 + rx * .12, cy + ry + 2);
            }
        });
        if (opts.arms) pen(part(g, 3, 4), rx, () => {
            for (const s of [ -1, 1 ]) {
                ctx.moveTo(cx + s * rx * .96, CY + RY * .05);
                ctx.quadraticCurveTo(cx + s * rx * 1.18, CY + RY * .3, cx + s * rx * 1.04, CY + RY * .48);
            }
        });
    }
    function cuddle(g, time) {
        pen(part(g, 0, 7), 320, () => {
            ctx.moveTo(-150, 102);
            ctx.lineTo(170, 102);
        });
        mittens(part(g, 1, 3) * 1.2, 46, 40, 66, 62, 0, time);
        pen(part(g, 2, 7), 150, () => ctx.arc(-26, -36, 24, 0, Math.PI * 2));
        pen(part(g, 3, 7), 140, () => {
            ctx.moveTo(-40, -58);
            ctx.bezierCurveTo(-70, -52, -78, -10, -70, 26);
        });
        pen(part(g, 3, 7), 70, () => {
            ctx.moveTo(-14, -58);
            ctx.bezierCurveTo(4, -54, 6, -40, 0, -28);
        });
        pen(part(g, 4, 7), 170, () => {
            ctx.moveTo(-50, -16);
            ctx.bezierCurveTo(-84, 6, -96, 60, -84, 100);
        });
        pen(part(g, 5, 7), 200, () => {
            ctx.moveTo(-30, -10);
            ctx.bezierCurveTo(-8, 30, 30, 52, 70, 48);
            ctx.bezierCurveTo(92, 46, 106, 34, 104, 20);
        });
        pen(part(g, 6, 7), 110, () => {
            ctx.moveTo(-84, 100);
            ctx.bezierCurveTo(-60, 92, -36, 90, -18, 96);
        });
    }
    function chainItem(id, g, o, time) {
        const st = STAR, BA = ctx.globalAlpha;
        if (id === "mini") {
            pen(part(g, 0, 3), 520, () => {
                ctx.roundRect ? ctx.roundRect(-100, 20, 200, 56, 16) : ctx.rect(-100, 20, 200, 56);
            });
            pen(part(g, 1, 3), 200, () => {
                ctx.moveTo(-84, 92);
                ctx.lineTo(84, 92);
            }, 1.2, T.muted);
            ctx.fillStyle = T.ink;
            ctx.beginPath();
            ctx.arc(84, 48, 3.2, 0, 7);
            ctx.fill();
            const a = part(g, 2, 3), y = -52 + (RMQ.matches ? 0 : Math.sin(time * 1.2) * 3);
            if (a > 0 && st) {
                ctx.globalAlpha = BA * a;
                ctx.fillStyle = T.ink;
                st.fill(ctx, 0, y, 84 * easeOut(a));
                ctx.globalAlpha = BA;
                pen(a, 60, () => {
                    ctx.setLineDash([ 2 / AS, 5 / AS ]);
                    ctx.moveTo(0, y + 46);
                    ctx.lineTo(0, 14);
                }, 1.2, T.muted);
                ctx.setLineDash([]);
            }
        } else if (id === "wear") {
            pen(part(g, 0, 4), 420, () => {
                ctx.moveTo(-26, -120);
                ctx.lineTo(-24, -54);
                ctx.bezierCurveTo(-60, -36, -118, -24, -140, 40);
                ctx.moveTo(26, -120);
                ctx.lineTo(24, -54);
                ctx.bezierCurveTo(60, -36, 118, -24, 140, 40);
            });
            pen(part(g, 1, 4), 220, () => {
                ctx.moveTo(-34, -48);
                ctx.bezierCurveTo(-26, 0, -8, 14, 0, 14);
                ctx.bezierCurveTo(8, 14, 26, 0, 34, -48);
            }, 1.1, T.ink2);
            pen(part(g, 2, 4), 70, () => ctx.arc(0, 28, 12, 0, Math.PI * 2));
            if (st && part(g, 3, 4) > 0) {
                ctx.globalAlpha = BA * part(g, 3, 4);
                ctx.fillStyle = T.ink;
                st.fill(ctx, 0, 28, 17);
                ctx.globalAlpha = BA;
            }
        } else if (id === "pendant") {
            pen(part(g, 0, 5), 160, () => {
                ctx.moveTo(-60, -130);
                ctx.lineTo(-40, -66);
                ctx.moveTo(-20, -130);
                ctx.lineTo(-40, -66);
            }, 1.1, T.ink2);
            pen(part(g, 1, 5), 420, () => ctx.arc(-40, 0, 64, -Math.PI / 2, Math.PI * 1.5));
            pen(part(g, 1, 5), 360, () => ctx.arc(-40, 0, 54, -Math.PI / 2, Math.PI * 1.5), 1.1, T.ink2);
            pen(part(g, 2, 5), 90, () => ctx.arc(-40, 0, 42, Math.PI * 1.08, Math.PI * 1.42), 2.6, T.muted);
            if (st && part(g, 2, 5) > 0) {
                ctx.globalAlpha = BA * part(g, 2, 5);
                ctx.fillStyle = T.ink;
                st.fill(ctx, -40, 2, 58);
                ctx.globalAlpha = BA;
            }
            pen(part(g, 3, 5), 200, () => ctx.ellipse(96, 50, 34, 30, 0, 0, Math.PI * 2));
            pen(part(g, 3, 5), 170, () => ctx.ellipse(96, 50, 27, 23, 0, 0, Math.PI * 2), 1.1, T.ink2);
            const sa = part(g, 4, 5);
            if (sa > 0) {
                ctx.globalAlpha = BA * sa;
                ctx.fillStyle = T.ink;
                ctx.beginPath();
                ctx.ellipse(96, 16, 19, 13, 0, 0, 7);
                ctx.fill();
                ctx.strokeStyle = T.paper;
                ctx.lineWidth = 1.4 / AS;
                ctx.beginPath();
                ctx.arc(90, 12, 6, 3.6, 4.6);
                ctx.stroke();
                ctx.globalAlpha = BA;
            }
        } else if (id === "skin") {
            for (let i = 0; i < 5; i++) pen(part(g, i, 5), 340, () => {
                for (let x = -140; x <= 140; x += 6) {
                    const y = -40 + i * 22 + Math.sin(x / 34 + i * .8 + (RMQ.matches ? 0 : time * 1.1)) * (8 - i);
                    x === -140 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
                }
            }, i === 0 ? 2 : 1.2, i === 0 ? T.ink : T.ink2);
            if (part(g, 4, 5) > 0) {
                ctx.fillStyle = T.ink;
                for (let k = 0; k < 9; k++) {
                    ctx.globalAlpha = BA * (part(g, 4, 5) * (.4 + .6 * Math.abs(Math.sin((RMQ.matches ? 0 : time) * 1.3 + k))));
                    ctx.beginPath();
                    ctx.arc(-120 + k * 30, 70 + k % 2 * 8, 2.4, 0, 7);
                    ctx.fill();
                }
                ctx.globalAlpha = BA;
            }
        } else if (id === "muscle") {
            const c = RMQ.matches ? 0 : (Math.sin(time * 2) + 1) / 2, sx = 1 - .14 * c, sy = 1 + .18 * c;
            pen(part(g, 0, 3), 120, () => {
                ctx.moveTo(-160, 0);
                ctx.lineTo(-118 * sx, 0);
                ctx.moveTo(160, 0);
                ctx.lineTo(118 * sx, 0);
            });
            for (let i = 0; i < 7; i++) {
                const off = (i - 3) * 9 * sy;
                pen(part(g, 1 + i % 2, 3), 300, () => {
                    ctx.moveTo(-118 * sx, 0);
                    ctx.bezierCurveTo(-60 * sx, off * 2.2, 60 * sx, off * 2.2, 118 * sx, 0);
                }, i === 0 || i === 6 ? 1.8 : 1.1, i === 0 || i === 6 ? T.ink : T.ink2);
            }
        } else if (id === "eye") {
            mittens(g * 1.3, 0, 20, 112, 96, ease(o), time);
        }
    }
    const SCENES = [ "swinging feet", "cooking", "walking", "basketball" ];
    function her(x, y, s, legs, arms) {
        ctx.beginPath();
        ctx.arc(x, y, 5 * s, 0, 7);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(x, y + 5 * s);
        ctx.lineTo(x, y + 24 * s);
        for (const [ax, ay] of arms) {
            ctx.moveTo(x, y + 10 * s);
            ctx.lineTo(x + ax * s, y + ay * s);
        }
        for (const [lx, ly, fx, fy] of legs) {
            ctx.moveTo(x, y + 24 * s);
            ctx.lineTo(x + lx * s, y + ly * s);
            if (fx != null) ctx.lineTo(x + fx * s, y + fy * s);
        }
        ctx.stroke();
    }
    function mit(x, y, s, o = 1) {
        ctx.beginPath();
        ctx.ellipse(x, y, 9 * s, 9 * s, 0, 0, 7);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(x - 7 * s, y - 5 * s);
        ctx.lineTo(x - 5 * s, y - 12 * s);
        ctx.lineTo(x - 1.5 * s, y - 8.6 * s);
        ctx.moveTo(x + 7 * s, y - 5 * s);
        ctx.lineTo(x + 5 * s, y - 12 * s);
        ctx.lineTo(x + 1.5 * s, y - 8.6 * s);
        ctx.stroke();
        ctx.fillStyle = T.ink;
        ctx.beginPath();
        ctx.arc(x - 3 * s, y - 1 * s, 1.1 * s, 0, 7);
        ctx.arc(x + 3 * s, y - 1 * s, 1.1 * s, 0, 7);
        ctx.fill();
    }
    function vignette(i, x0, y0, w, time) {
        const s = w / 100, t = RMQ.matches ? .4 : time, BA = ctx.globalAlpha;
        ctx.save();
        ctx.translate(x0, y0);
        ctx.scale(s, s);
        ctx.lineWidth = 1.3 / s;
        ctx.strokeStyle = T.ink;
        ctx.lineCap = "round";
        ctx.lineJoin = "round";
        if (i === 0) {
            ctx.beginPath();
            ctx.moveTo(14, 46);
            ctx.lineTo(86, 46);
            ctx.moveTo(86, 46);
            ctx.lineTo(86, 70);
            ctx.stroke();
            const a = .45 * Math.sin(t * 3), b = .45 * Math.sin(t * 3 + 1.4);
            her(40, 18, 1, [ [ 12, 27, 12 + Math.sin(a) * 17, 27 + Math.cos(a) * 17 ], [ 10, 28, 10 + Math.sin(b) * 17, 28 + Math.cos(b) * 17 ] ], [ [ 12, 18 ] ]);
            mit(68, 37, 1);
            const c = .5 * Math.sin(t * 3 + .7);
            ctx.beginPath();
            ctx.moveTo(65, 46);
            ctx.lineTo(65 + Math.sin(c) * 9, 46 + Math.cos(c) * 9);
            ctx.moveTo(71, 46);
            ctx.lineTo(71 + Math.sin(-c) * 9, 46 + Math.cos(-c) * 9);
            ctx.stroke();
        } else if (i === 1) {
            ctx.beginPath();
            ctx.moveTo(8, 64);
            ctx.lineTo(92, 64);
            ctx.stroke();
            ctx.beginPath();
            ctx.rect(42, 46, 28, 18);
            ctx.moveTo(38, 48);
            ctx.lineTo(42, 48);
            ctx.moveTo(70, 48);
            ctx.lineTo(74, 48);
            ctx.stroke();
            for (let k = 0; k < 3; k++) {
                const ph = (t * .6 + k / 3) % 1;
                ctx.globalAlpha = BA * (1 - ph);
                ctx.beginPath();
                for (let j = 0; j <= 8; j++) {
                    const yy = 44 - ph * 22 - j * 1.6, xx = 50 + k * 6 + Math.sin(j * .9 + t * 3) * 1.6;
                    j ? ctx.lineTo(xx, yy) : ctx.moveTo(xx, yy);
                }
                ctx.stroke();
            }
            ctx.globalAlpha = BA;
            const sp = [ 52 + Math.cos(t * 3) * 5, 46 + Math.sin(t * 3) * 1.5 ];
            her(24, 18, 1, [ [ -4, 46 ], [ 4, 46 ] ], [ [ sp[0] - 24, sp[1] - 18 ] ]);
            mit(84, 55, .8);
        } else if (i === 2) {
            ctx.beginPath();
            for (let k = 0; k < 8; k++) {
                const x = ((k * 14 - t * 18) % 112 + 112) % 112 - 6;
                ctx.moveTo(x, 66);
                ctx.lineTo(x + 6, 66);
            }
            ctx.stroke();
            const a = .42 * Math.sin(t * 4);
            her(40, 18, 1, [ [ Math.sin(a) * 22, 24 + Math.cos(a) * 22 ], [ -Math.sin(a) * 22, 24 + Math.cos(a) * 22 ] ], [ [ -Math.sin(a) * 10, 22 ], [ 18, 22 ] ]);
            const bob = Math.abs(Math.sin(t * 4)) * 3;
            mit(66, 52 - bob, 1);
            ctx.beginPath();
            ctx.moveTo(61 - Math.sin(a) * 2, 61 - bob);
            ctx.lineTo(60 + Math.sin(a) * 3, 66);
            ctx.moveTo(71 + Math.sin(a) * 2, 61 - bob);
            ctx.lineTo(72 - Math.sin(a) * 3, 66);
            ctx.stroke();
        } else {
            ctx.beginPath();
            ctx.moveTo(8, 66);
            ctx.lineTo(92, 66);
            ctx.moveTo(90, 66);
            ctx.lineTo(90, 12);
            ctx.moveTo(86, 8);
            ctx.lineTo(86, 26);
            ctx.moveTo(74, 22);
            ctx.lineTo(86, 22);
            ctx.moveTo(75, 22);
            ctx.lineTo(77, 30);
            ctx.moveTo(80, 22);
            ctx.lineTo(80, 30);
            ctx.moveTo(85, 22);
            ctx.lineTo(83, 30);
            ctx.stroke();
            const ph = t / 2 % 1;
            let bx, by;
            if (ph < .45) {
                const u = ph / .45;
                bx = lerp(34, 80, u);
                by = lerp(16, 18, u) - Math.sin(Math.PI * u) * 22;
            } else {
                const v = (ph - .45) / .55;
                bx = lerp(80, 36, v);
                by = 60 - Math.abs(Math.sin(Math.PI * v * 2)) * (26 * (1 - v * .5));
            }
            ctx.beginPath();
            ctx.arc(bx, by, 4, 0, 7);
            ctx.stroke();
            const up = ph < .12 || ph > .9;
            her(30, 20, 1, [ [ -4, 46 ], [ 4, 46 ] ], up ? [ [ 4, -8 ], [ 8, -6 ] ] : [ [ 8, 20 ], [ -6, 22 ] ]);
            const j = Math.abs(Math.sin(t * 5)) * 6;
            mit(58, 56 - j, .9);
        }
        ctx.restore();
        ctx.fillStyle = T.ink2;
        ctx.font = '500 10px "JetBrains Mono", monospace';
        ctx.textAlign = "center";
        ctx.textBaseline = "top";
        ctx.fillText(SCENES[i], x0 + w / 2, y0 + w * .76);
    }
    const bez = (P0, P1, P2, P3, t) => {
        const u = 1 - t;
        return [ u * u * u * P0[0] + 3 * u * u * t * P1[0] + 3 * u * t * t * P2[0] + t * t * t * P3[0], u * u * u * P0[1] + 3 * u * u * t * P1[1] + 3 * u * t * t * P2[1] + t * t * t * P3[1] ];
    };
    function drawStreak(path, t, a) {
        const head = bez(...path, t);
        ctx.save();
        ctx.globalAlpha = a;
        ctx.lineCap = "round";
        const N = 34;
        for (let j = N; j >= 1; j--) {
            const t0 = t - j * .009, t1 = t - (j - 1) * .009;
            if (t1 <= 0) continue;
            const A = bez(...path, Math.max(0, t0)), B = bez(...path, t1), f = 1 - j / N;
            ctx.strokeStyle = rgba(T.lit, f * .9);
            ctx.lineWidth = .6 + f * 3.4;
            ctx.beginPath();
            ctx.moveTo(A[0], A[1]);
            ctx.lineTo(B[0], B[1]);
            ctx.stroke();
        }
        const g = ctx.createRadialGradient(head[0], head[1], 0, head[0], head[1], 44);
        g.addColorStop(0, rgba(T.lit, .9));
        g.addColorStop(.25, rgba(T.lit, .35));
        g.addColorStop(1, rgba(T.lit, 0));
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(head[0], head[1], 44, 0, 7);
        ctx.fill();
        ctx.fillStyle = "#FFFFFF";
        if (STAR) STAR.fill(ctx, head[0], head[1], 26);
        ctx.restore();
        return head;
    }
    const SLOT = {
        mode: null,
        el: null,
        anim: null
    };
    (function initSlot() {
        const src = slot.dataset.src || "";
        const type = slot.dataset.type || (src ? /\.json(\?|$)/.test(src) ? "lottie" : /\.(mp4|webm|mov)(\?|$)/.test(src) ? "video" : "img" : slot.children.length ? "inline" : null);
        SLOT.mode = type;
        if (slot.dataset.size) slot.style.setProperty("--size", slot.dataset.size + "px");
        if (type === "video") {
            const v = document.createElement("video");
            v.src = src;
            v.muted = true;
            v.playsInline = true;
            v.preload = "auto";
            slot.appendChild(v);
            SLOT.el = v;
        } else if (type === "img") {
            const i = new Image;
            i.src = src;
            i.alt = "";
            slot.appendChild(i);
        } else if (type === "lottie") {
            const s = document.createElement("script");
            s.src = "https://cdnjs.cloudflare.com/ajax/libs/lottie-web/5.12.2/lottie.min.js";
            s.onload = () => {
                SLOT.anim = window.lottie.loadAnimation({
                    container: slot,
                    renderer: "svg",
                    loop: false,
                    autoplay: false,
                    path: src
                });
            };
            document.head.appendChild(s);
        }
    })();
    function driveSlot(head, angle, t, on) {
        if (!SLOT.mode) return false;
        slot.style.opacity = on ? 1 : 0;
        if (!on) return true;
        slot.style.transform = `translate(${head[0]}px, ${head[1]}px) translate(-50%, -50%)${slot.dataset.rotate === "path" ? ` rotate(${angle}rad)` : ""}`;
        slot.style.setProperty("--t", t.toFixed(4));
        slot.style.setProperty("--angle", angle.toFixed(3) + "rad");
        if (SLOT.el && SLOT.el.duration) SLOT.el.currentTime = t * SLOT.el.duration;
        if (SLOT.anim && SLOT.anim.totalFrames) SLOT.anim.goToAndStop(t * (SLOT.anim.totalFrames - 1), true);
        return true;
    }
    let capKey = "";
    function caption(p) {
        let t = "", s = "", a = 0;
        for (const [a0, a1, txt, sub] of CAPS) if (p >= a0 && p < a1) {
            t = txt;
            s = sub;
            if (sub === null) {
                const i = clamp(Math.floor((p - C0) / CW - .07), 0, CHAIN.length - 1);
                s = CHAIN[i][1];
            }
            a = RMQ.matches ? 1 : Math.min(seg(p, a0, a0 + .008), 1 - seg(p, a1 - .008, a1));
            if (a0 === 0) a = 1 - seg(p, a1 - .008, a1);
            break;
        }
        const key = t + "|" + s;
        if (key !== capKey) {
            capKey = key;
            capT.textContent = t;
            capS.textContent = s || "";
            capT.style.display = t ? "" : "none";
        }
        capEl.style.opacity = a.toFixed(3);
    }
    const t0 = performance.now();
    function progress() {
        if (MOMENT) return 0;
        const max = document.documentElement.scrollHeight - innerHeight;
        let p = max > 0 ? clamp(scrollY / max) : 0;
        if (RMQ.matches) p = BEATS.find(b => b >= p - 1e-6) ?? 1;
        return p;
    }
    const NIGHT = "#08080D";
    function frameDraw() {
        const time = RMQ.matches ? 0 : (performance.now() - t0) / 1e3;
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.globalAlpha = 1;
        ctx.fillStyle = T.paper;
        ctx.fillRect(0, 0, cv.width, cv.height);
        if (MOMENT) return momentDraw(time);
        const p = progress(), Llive = layout(), L = Llive || standin();
        const blur = RMQ.matches ? 0 : 18 * (1 - easeOut(clamp(time / 2.2)));
        cv.style.filter = blur > .2 ? `blur(${blur.toFixed(1)}px)` : "";
        if (p < .565) {
            const cam = camFull(p);
            ctx.save();
            setCam(cam);
            desk(p, time, cam);
            ctx.restore();
            const show = seg(p, .4, .47);
            if (show > 0) {
                const [fx0, fy0] = toS(cam, SCREEN[0], SCREEN[1]), [fx1, fy1] = toS(cam, SCREEN[2], FACE_B);
                const gR = ease(seg(p, .5, .555)), R = {
                    x: lerp(fx0, 0, gR),
                    y: lerp(fy0, 0, gR),
                    w: lerp(fx1 - fx0, W, gR),
                    h: lerp(fy1 - fy0, H, gR)
                };
                ctx.save();
                ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
                ctx.beginPath();
                ctx.rect(fx0, fy0, fx1 - fx0, fy1 - fy0);
                ctx.clip();
                if (gR > 0) {
                    ctx.fillStyle = mix(T.screen, T.paper, gR);
                    ctx.fillRect(fx0, fy0, fx1 - fx0, fy1 - fy0);
                }
                screenMap(L, R, gR, show);
                ctx.restore();
            }
        }
        if (p >= .565 && p < .705) {
            const fade = 1 - seg(p, .6, .625), night = ease(seg(p, .6, .622));
            ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
            if (fade > 0) drawMap(L, S => S, 1, 1, fade, 1 - seg(p, .6, .615));
            ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
            if (night > 0) {
                ctx.fillStyle = rgba(NIGHT, night);
                ctx.fillRect(0, 0, W, H);
            }
            const hub = L.nodes[0], H0 = scr(L, hub), r0 = hub.r * L.cam.k;
            const mv = ease(seg(p, .622, .662)), grow = ease(seg(p, .618, .68));
            const cx = lerp(H0[0], W / 2, mv), cy = lerp(H0[1], H / 2, mv), h = Math.exp(lerp(Math.log(r0 * 1.56), Math.log(Math.min(W, H) * .62), grow));
            ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
            if (night > 0) {
                for (let i = 0; i < 70; i++) {
                    ctx.fillStyle = rgba("#FFFFFF", night * (.25 + .5 * hash(i + 4)) * (RMQ.matches ? 1 : .6 + .4 * Math.sin(time * 1.4 + i)));
                    ctx.beginPath();
                    ctx.arc(hash(i) * W, hash(i + 99) * H, hash(i + 7) > .9 ? 1.4 : .8, 0, 7);
                    ctx.fill();
                }
                const gl = ctx.createRadialGradient(cx, cy, 0, cx, cy, h * .9);
                gl.addColorStop(0, rgba("#FFFFFF", .5 * night));
                gl.addColorStop(.35, rgba("#FFFFFF", .12 * night));
                gl.addColorStop(1, rgba("#FFFFFF", 0));
                ctx.fillStyle = gl;
                ctx.fillRect(cx - h, cy - h, h * 2, h * 2);
                ctx.fillStyle = "#FFFFFF";
                STAR && STAR.fill(ctx, cx, cy, h);
            }
            const wo = ease(seg(p, .668, .69));
            if (wo > 0) {
                const R = lerp(h * .25, Math.hypot(W, H), wo), fl = ctx.createRadialGradient(cx, cy, 0, cx, cy, R);
                fl.addColorStop(0, rgba("#FFFFFF", 1));
                fl.addColorStop(.7, rgba("#FFFFFF", wo));
                fl.addColorStop(1, rgba("#FFFFFF", 0));
                ctx.fillStyle = fl;
                ctx.fillRect(0, 0, W, H);
                const settle = seg(p, .69, .703);
                if (settle > 0) {
                    ctx.fillStyle = rgba(T.paper, settle);
                    ctx.fillRect(0, 0, W, H);
                }
            }
        }
        let ctaA = 0;
        if (p >= .7) {
            const s = clamp(Math.min(W / 440, H / 560), .62, 1.15);
            const endA = seg(p, .9, .935), ay = lerp(H * .42, Math.min(H * .34, H * .5 - 150 * s), ease(endA));
            if (p < .785) {
                const a = 1 - seg(p, .776, .782);
                ctx.globalAlpha = a;
                art(W / 2, ay, s);
                cuddle(seg(p, .7, .745), time);
                ctx.globalAlpha = 1;
            }
            if (p >= C0 && p < C1 + .01) {
                const i = clamp(Math.floor((p - C0) / CW), 0, CHAIN.length - 1), a0 = C0 + i * CW, q = (p - a0) / CW;
                const inA = i ? seg(q, 0, .14) : 1, outA = i === CHAIN.length - 1 ? 1 - seg(p, C1 - .002, C1 + .008) : 1;
                if (i && inA < 1) {
                    ctx.globalAlpha = 1 - inA;
                    art(W / 2, ay, s);
                    chainItem(CHAIN[i - 1][0], 1, 1, time);
                }
                ctx.globalAlpha = Math.min(inA, outA);
                art(W / 2, ay, s);
                chainItem(CHAIN[i][0], seg(q, 0, .5), seg(q, .4, .85), time);
                ctx.globalAlpha = 1;
                ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
                for (let k = 0; k < CHAIN.length; k++) {
                    ctx.fillStyle = k <= i ? T.ink : T.dim;
                    ctx.beginPath();
                    ctx.arc(W / 2 + (k - 2.5) * 14, ay + 150 * s, k === i ? 3.2 : 2.2, 0, 7);
                    ctx.fill();
                }
            }
            if (p >= C1) {
                const up = ease(seg(p, .905, .94)), a = seg(p, .9, .91);
                ctx.globalAlpha = a;
                art(W / 2, ay, s);
                const sway = RMQ.matches ? 0 : Math.sin(time * 1.1) * .025 * up;
                ctx.rotate(sway);
                mittens(1, 0, lerp(30, 6, up), lerp(70, 56, up), lerp(62, 84, up), 1, time, {
                    feet: up > .5,
                    arms: up > .5
                });
                ctx.globalAlpha = 1;
                ctaA = seg(p, .935, .955);
                const strip = seg(p, .95, .975);
                if (strip > 0) {
                    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
                    ctx.globalAlpha = strip;
                    const gap = 12, cw = Math.min(150, (W - 32 - gap * 3) / 4), tw = cw * 4 + gap * 3, x0 = (W - tw) / 2, y0 = H - cw * .76 - 30 - Math.max(16, H * .03);
                    for (let k = 0; k < 4; k++) vignette(k, x0 + k * (cw + gap), y0, cw, time);
                    ctx.globalAlpha = 1;
                }
                cta.style.top = Math.round(ay + 112 * s) + "px";
            }
        }
        cta.style.opacity = ctaA.toFixed(3);
        cta.style.pointerEvents = ctaA > .9 ? "auto" : "none";
        cta.tabIndex = ctaA > .9 ? 0 : -1;
        caption(p);
        if (hint) hint.style.opacity = (1 - seg(p, .004, .03)).toFixed(3);
        const hand = Llive ? seg(p, .548, .562) * (1 - seg(p, .598, .61)) : 0;
        const live = exploring || document.body.classList.contains("explore") ? 1 : hand;
        frame.style.opacity = live.toFixed(3);
        cv.style.opacity = (1 - live).toFixed(3);
        exploreBtn.hidden = exploring || hand < .95;
        replay.hidden = p < .985;
    }
    function momentDraw(time) {
        const cam = camAt(.27);
        cam.z = Math.min(W / 1e3, H / 860);
        cam.cx = 610;
        cam.cy = 110;
        ctx.save();
        setCam(cam);
        desk(.6, time, cam);
        ctx.restore();
        ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
        const cyc = RMQ.matches ? .55 : time % 4.6 / 3.2;
        if (cyc <= 1) {
            const path = [ toS(cam, 300, 250), toS(cam, 380, -320), toS(cam, 900, -360), toS(cam, 1e3, 300) ];
            const head = bez(...path, cyc), nx = bez(...path, Math.min(1, cyc + .01)), ang = Math.atan2(nx[1] - head[1], nx[0] - head[0]);
            if (!driveSlot(head, ang, cyc, true)) drawStreak(path, cyc, 1 - seg(cyc, .85, 1));
        } else driveSlot([ 0, 0 ], 0, 0, false);
    }
    function loop() {
        frameDraw();
        requestAnimationFrame(loop);
    }
    loop();
})();
