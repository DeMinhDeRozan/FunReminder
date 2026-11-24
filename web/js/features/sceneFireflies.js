/* Fireflies: a misty forest after dark, with fireflies drifting between the trunks.
 *
 * All art is drawn in code here (no images, no downloads), like the other scenes.
 * The idea — drifting particles whose glow flashes on and off — was seen as a rendered
 * CSS demo ("CSS Background Fireflies", freefrontend). No source was read or copied:
 * the forest, the mist, the moon shafts and the firefly motion are all written from scratch.
 *
 * Motion is CSS only (see .fr-fly* in css/app.css): each firefly is a horizontal drift
 * wrapped around a vertical drift with a different period, so it wanders instead of
 * sliding, and the glow blinks on its own clock.
 */
import { W, H, L, defs, rng, glow } from './sceneKit.js';

/* one tree: a tapered, slightly leaning trunk with a few branches */
function tree(r, x, base, h, w, lean, fill) {
    const top = base - h, tip = x + lean;
    const d = `M${(x - w / 2).toFixed(1)},${base} C${(x - w * 0.46).toFixed(1)},${(base - h * 0.4).toFixed(1)} ${(tip - w * 0.34).toFixed(1)},${(base - h * 0.72).toFixed(1)} ${(tip - w * 0.11).toFixed(1)},${top.toFixed(1)}` +
        ` L${(tip + w * 0.11).toFixed(1)},${top.toFixed(1)} C${(tip + w * 0.34).toFixed(1)},${(base - h * 0.72).toFixed(1)} ${(x + w * 0.46).toFixed(1)},${(base - h * 0.4).toFixed(1)} ${(x + w / 2).toFixed(1)},${base} Z`;
    let br = '';
    const n = 3 + Math.floor(r() * 3);
    for (let i = 0; i < n; i++) {
        const t = 0.42 + 0.52 * (i / n) + r() * 0.06, y = base - h * t;
        const side = r() < 0.5 ? -1 : 1, len = (0.18 + r() * 0.26) * h, rise = (0.45 + r() * 0.5) * len;
        const bx = x + lean * t;
        br += `<path d="M${bx.toFixed(1)},${y.toFixed(1)} Q${(bx + side * len * 0.55).toFixed(1)},${(y - rise * 0.25).toFixed(1)} ${(bx + side * len).toFixed(1)},${(y - rise).toFixed(1)}" fill="none" stroke="${fill}" stroke-width="${(w * 0.16 + 1.4).toFixed(1)}" stroke-linecap="round"/>`;
        if (r() < 0.6) {
            const mx = bx + side * len * 0.6, my = y - rise * 0.45;
            br += `<path d="M${mx.toFixed(1)},${my.toFixed(1)} q${(side * len * 0.2).toFixed(1)},${(-rise * 0.45).toFixed(1)} ${(side * len * 0.34).toFixed(1)},${(-rise * 0.8).toFixed(1)}" fill="none" stroke="${fill}" stroke-width="${(w * 0.09 + 1).toFixed(1)}" stroke-linecap="round"/>`;
        }
    }
    return br + `<path d="${d}" fill="${fill}"/>`;
}

/* a row of trees, far ones thin and pale, near ones fat and black */
function stand(r, count, fill, baseY, hMin, hMax, wMin, wMax, x0, x1) {
    let s = '';
    for (let i = 0; i < count; i++) {
        const x = x0 + (x1 - x0) * ((i + r() * 0.8) / count);
        s += tree(r, x, baseY + r() * 14, hMin + r() * (hMax - hMin), wMin + r() * (wMax - wMin), (r() - 0.5) * 50, fill);
    }
    return s;
}

/* soft mist: wide, very transparent ellipses that drift sideways */
function mist(r, y, n, rx, ry, op, id) {
    let s = '';
    for (let i = 0; i < n; i++) s += `<ellipse cx="${(i * (W / n) + r() * 140).toFixed(0)}" cy="${(y + (r() - 0.5) * 60).toFixed(0)}" rx="${(rx * (0.6 + r() * 0.7)).toFixed(0)}" ry="${(ry * (0.6 + r() * 0.6)).toFixed(0)}" fill="url(#${id})" opacity="${(op * (0.6 + r() * 0.5)).toFixed(2)}"/>`;
    return s;
}

export function fireflies(p) {
    const r = rng(23), I = n => p + n, U = n => `url(#${p + n})`;

    /* fireflies: x-drift > y-drift > blink, each with its own period and offset */
    let flies = '';
    for (let i = 0; i < 28; i++) {
        const near = i % 5 === 0;                                  // a few close ones, bigger and softer
        const x = 40 + r() * (W - 80), y = (i % 3 === 0) ? 620 + r() * 300 : 300 + r() * 560;
        const rad = near ? 7 + r() * 3 : 3.2 + r() * 2.2;
        const ax = (34 + r() * 90).toFixed(0), ay = (22 + r() * 58).toFixed(0);
        const d1 = (13 + r() * 16).toFixed(1), d2 = (9 + r() * 13).toFixed(1), d3 = (2.4 + r() * 3.4).toFixed(1);
        const o1 = (-r() * 20).toFixed(1), o2 = (-r() * 20).toFixed(1), o3 = (-r() * 6).toFixed(1);
        flies += `<g class="fr-fly" style="--ax:${ax}px;--d1:${d1}s;--o1:${o1}s">` +
            `<g class="fr-fly-y" style="--ay:${ay}px;--d2:${d2}s;--o2:${o2}s">` +
            `<g class="fr-fly-b" style="--d3:${d3}s;--o3:${o3}s" transform="translate(${x.toFixed(0)},${y.toFixed(0)})">` +
            `<circle r="${(rad * (near ? 11 : 9)).toFixed(1)}" fill="${U('fg')}"/>` +
            `<circle r="${rad.toFixed(1)}" fill="${U('fc')}"/>` +
            `<circle r="${(rad * 0.45).toFixed(1)}" fill="#FFFDE8"/>` +
            `</g></g></g>`;
    }

    /* moonlight: narrow shafts fanning out of the moon, down through the branches */
    const MX = 1180, MY = 150;
    const shafts = [[1.78, 0.030], [1.92, 0.018], [2.04, 0.040], [2.20, 0.016], [2.34, 0.028], [2.52, 0.014]]
        .map(([a, half], i) => {
            const len = 1750;
            const p1 = [MX + Math.cos(a - half) * len, MY + Math.sin(a - half) * len];
            const p2 = [MX + Math.cos(a + half) * len, MY + Math.sin(a + half) * len];
            return `<path d="M${MX},${MY} L${p1[0].toFixed(0)},${p1[1].toFixed(0)} L${p2[0].toFixed(0)},${p2[1].toFixed(0)} Z" fill="${U('shaft')}" opacity="${(0.85 - i * 0.09).toFixed(2)}"/>`;
        }).join('');

    /* the crowns overhead: ragged dark masses hanging into the top of the frame */
    const crown = (() => {
        let s = '';
        for (let i = 0; i < 120; i++) {
            const x = -60 + r() * (W + 120), y = -70 + r() * 165, rx = 26 + r() * 86, ry = 16 + r() * 52;
            s += `<ellipse cx="${x.toFixed(0)}" cy="${y.toFixed(0)}" rx="${rx.toFixed(0)}" ry="${ry.toFixed(0)}" fill="#01080A"/>`;
        }
        for (let i = 0; i < 34; i++) {                       // twigs hanging down out of the crowns
            const x = r() * W, y = 60 + r() * 120, len = 60 + r() * 190, lean = (r() - 0.5) * 90;
            s += `<path d="M${x.toFixed(0)},${y.toFixed(0)} q${(lean * 0.3).toFixed(0)},${(len * 0.55).toFixed(0)} ${lean.toFixed(0)},${len.toFixed(0)}" fill="none" stroke="#040F11" stroke-width="${(2 + r() * 4).toFixed(1)}" stroke-linecap="round"/>`;
        }
        return s;
    })();

    return [
        /* sky, moon, ground */
        L('', 0, 0, W, H, defs(`
 <linearGradient id="${I('sky')}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#030A10"/><stop offset=".38" stop-color="#07171C"/><stop offset=".72" stop-color="#0A2127"/><stop offset="1" stop-color="#061216"/></linearGradient>
 <linearGradient id="${I('gnd')}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#0A1F1C"/><stop offset="1" stop-color="#03090A"/></linearGradient>
 <linearGradient id="${I('shaft')}" gradientUnits="userSpaceOnUse" x1="1180" y1="150" x2="620" y2="1000"><stop offset="0" stop-color="#DFF3EA" stop-opacity=".26"/><stop offset=".28" stop-color="#AEDCCE" stop-opacity=".09"/><stop offset=".7" stop-color="#8FC8BC" stop-opacity=".025"/><stop offset="1" stop-color="#8FC8BC" stop-opacity="0"/></linearGradient>
 <linearGradient id="${I('band')}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#9FC9C2" stop-opacity="0"/><stop offset=".45" stop-color="#A8D2CA" stop-opacity=".17"/><stop offset="1" stop-color="#9FC9C2" stop-opacity="0"/></linearGradient>
 <radialGradient id="${I('mist')}"><stop offset="0" stop-color="#9FC9C2" stop-opacity=".30"/><stop offset="1" stop-color="#9FC9C2" stop-opacity="0"/></radialGradient>
 <radialGradient id="${I('fg')}"><stop offset="0" stop-color="#F2FFB0" stop-opacity=".8"/><stop offset=".3" stop-color="#D4F76E" stop-opacity=".26"/><stop offset="1" stop-color="#9BE564" stop-opacity="0"/></radialGradient>
 <radialGradient id="${I('fc')}"><stop offset="0" stop-color="#FFFCE0"/><stop offset=".6" stop-color="#E9FB8A"/><stop offset="1" stop-color="#B6E85E"/></radialGradient>
 ${glow(I('moon'), '#CFE8DE')}`) +
            `<rect width="${W}" height="${H}" fill="${U('sky')}"/>
<circle cx="1180" cy="150" r="340" fill="${U('moon')}" opacity=".7"/>
<circle cx="1180" cy="150" r="150" fill="${U('moon')}" opacity=".5"/>
<circle cx="1180" cy="150" r="44" fill="#EFF7F0"/>
<circle cx="1168" cy="138" r="11" fill="#D8E7DC" opacity=".55"/>
<circle cx="1193" cy="162" r="7" fill="#D8E7DC" opacity=".45"/>
<circle cx="1190" cy="134" r="5" fill="#D8E7DC" opacity=".4"/>
<rect y="760" width="${W}" height="240" fill="${U('gnd')}"/>`),

        /* far stand, lost in the mist */
        L('', 0, 300, W, 560, stand(r, 34, '#163C42', 820, 290, 470, 9, 20, -40, W + 40), 'opacity:.5'),
        L('', 0, 560, W, 300, `<rect y="600" width="${W}" height="260" fill="${U('band')}"/>`),
        L('fr-drift-slow', 0, 520, W * 2, 320, mist(r, 660, 7, 240, 54, 0.85, I('mist')) + `<g transform="translate(${W},0)">${mist(rng(23), 660, 7, 240, 54, 0.85, I('mist'))}</g>`),

        /* mid stand */
        L('', 0, 180, W, 700, stand(r, 15, '#0C2228', 850, 430, 640, 18, 40, -60, W + 60), 'opacity:.9'),
        L('fr-rays', 0, 0, W, H, shafts, 'mix-blend-mode:screen'),
        L('fr-drift', 0, 600, W * 2, 300, mist(r, 740, 6, 300, 46, 1, I('mist')) + `<g transform="translate(${W},0)">${mist(rng(41), 740, 6, 300, 46, 1, I('mist'))}</g>`),

        /* the fireflies live between the mid and near trees */
        L('', 0, 0, W, H, flies),

        L('', 0, -60, W, 300, crown),
        /* near trunks at the edges, almost black, framing the view */
        L('', -80, 0, 520, H, tree(r, 40, 1010, 980, 86, 26, '#040C0E') + tree(r, 290, 1010, 700, 48, -18, '#061114'), ''),
        L('', W - 440, 0, 520, H, tree(r, W - 60, 1010, 920, 74, -22, '#040C0E') + tree(r, W - 300, 1010, 640, 44, 16, '#061114'), ''),

        /* undergrowth */
        L('', 0, 700, W, 300, (() => {
            let s = `<path d="M-20,948 C180,930 300,962 470,944 C560,934 640,950 700,944 L700,1000 L-20,1000 Z" fill="#061513"/>` +
                `<path d="M120,906 C260,894 420,912 560,902 C600,899 640,904 664,906 L660,926 C600,924 520,934 430,936 C300,938 200,928 118,926 Z" fill="#0A201C"/>`;
            for (let i = 0; i < 130; i++) {
                const x = r() * W, b = 860 + r() * 140, h = 16 + r() * 62, lean = (r() - 0.5) * 30;
                const near = b > 940;
                s += `<path d="M${x.toFixed(0)},${b.toFixed(0)} q${(lean * 0.4).toFixed(1)},${(-h * 0.6).toFixed(1)} ${lean.toFixed(1)},${(-h).toFixed(1)}" fill="none" stroke="${near ? '#04100F' : '#0C2420'}" stroke-width="${(2 + r() * 3.4).toFixed(1)}" stroke-linecap="round"/>`;
            }
            return s;
        })())
    ].join('');
}
