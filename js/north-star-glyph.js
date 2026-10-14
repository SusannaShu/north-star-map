(function(root) {
    const D = "M0 -44L3.06 -1.39L14.85 -8.85L7.39 2.94L32 6L7.39 9.06L14.85 20.85L3.06 13.39L0 44L-3.06 13.39L-14.85 20.85L-7.39 9.06L-32 6L-7.39 2.94L-14.85 -8.85L-3.06 -1.39Z";
    const CY = 6;
    const pts = D.replace("Z", "").split(/(?=[ML])/).map(s => s.slice(1).trim().split(/\s+/).map(Number));
    const lit = [], shade = [], C = [ 0, CY ], LIGHT = [ -.6, -.8 ];
    const tri = (a, b, c) => `M${a[0]} ${a[1]}L${b[0]} ${b[1]}L${c[0]} ${c[1]}Z`;
    for (let i = 0; i < pts.length; i++) {
        const a = pts[i], b = pts[(i + 1) % pts.length];
        const mx = (a[0] + b[0]) / 2, my = (a[1] + b[1]) / 2 - CY;
        (mx * LIGHT[0] + my * LIGHT[1] > 0 ? lit : shade).push(tri(a, b, C));
    }
    const D_LIT = lit.join(""), D_SHADE = shade.join("");
    const P = {};
    const path = k => P[k] || (P[k] = typeof Path2D === "function" ? new Path2D(k === "lit" ? D_LIT : k === "shade" ? D_SHADE : D) : null);
    const at = (ctx, cx, cy, h, rot) => {
        const k = h / 88;
        ctx.save();
        ctx.translate(cx, cy);
        if (rot) ctx.rotate(rot);
        ctx.scale(k, k);
        return k;
    };
    function fill(ctx, cx, cy, h, rot) {
        at(ctx, cx, cy, h, rot);
        const p = path("d");
        if (p) ctx.fill(p); else {
            ctx.beginPath();
            pts.forEach((q, i) => i ? ctx.lineTo(q[0], q[1]) : ctx.moveTo(q[0], q[1]));
            ctx.closePath();
            ctx.fill();
        }
        ctx.restore();
    }
    function facet(ctx, cx, cy, h, litStyle, shadeStyle, rot) {
        at(ctx, cx, cy, h, rot);
        const a = path("lit"), b = path("shade");
        if (a && b) {
            ctx.fillStyle = litStyle;
            ctx.fill(a);
            ctx.fillStyle = shadeStyle;
            ctx.fill(b);
        }
        ctx.restore();
    }
    function stroke(ctx, cx, cy, h, lw) {
        const k = at(ctx, cx, cy, h);
        ctx.lineWidth = lw / k;
        ctx.lineJoin = "miter";
        const p = path("d");
        if (p) ctx.stroke(p);
        ctx.restore();
    }
    const svg = (size, fillCol, shadeCol) => `<svg width="${size}" height="${size}" viewBox="-44 -44 88 88" aria-hidden="true">${shadeCol ? `<path d="${D_LIT}" fill="${fillCol || "currentColor"}"/><path d="${D_SHADE}" fill="${shadeCol}"/>` : `<path d="${D}" fill="${fillCol || "currentColor"}"/>`}</svg>`;
    root.NSStar = {
        d: D,
        dLit: D_LIT,
        dShade: D_SHADE,
        fill: fill,
        facet: facet,
        stroke: stroke,
        svg: svg,
        W: 64,
        H: 88,
        CY: CY
    };
})(typeof window !== "undefined" ? window : globalThis);
