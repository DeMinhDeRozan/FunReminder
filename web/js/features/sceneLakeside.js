/* Scene: Lakeside — ranges, a lake and a lone kangaroo, on a real day/night cycle.
 *
 * The art is flat vector drawn in code (no image files). Nothing here is a
 * picture: every colour is a number this module interpolates from the current
 * hour, so the scene is pink at 6am, blue at noon, orange at 7pm and starlit at
 * midnight, moving through all of it gradually.
 *
 * How the cycle works:
 *   PHASES is a table of palettes at nine times of day. `paletteAt(hour)` finds
 *   the two it sits between and mixes them. `lakesideTick()` runs once a minute,
 *   writes the mixed colours onto the elements marked data-c="<key>", and moves
 *   the sun (or moon) along its arc. One minute of drift is a colour step far
 *   too small to notice, so no CSS transition is needed.
 */
import { W, H, L, defs, rng, glow, cloud, cloudDefs } from './sceneKit.js';

/* sunrise / sunset used for the arc and for swapping sun <-> moon */
const RISE = 6.3, SET = 19.6;

/* [sky1 zenith, sky2 mid, sky3 horizon, glow, disc, ridge1..4 (far->near),
 *  lake, lake highlight, foreground, cloud, star opacity] */
const PHASES = [
    { h: 0,    sky1: '#05091A', sky2: '#0B1534', sky3: '#1A2C55', glow: '#9BAAD2', disc: '#EFEAD4',
      r1: '#223359', r2: '#182542', r3: '#101A31', r4: '#090F1D', lake: '#0B1530', hi: '#24396B', fg: '#04070E', cloud: '#1B2742', star: 1 },
    { h: 5,    sky1: '#0A1030', sky2: '#1C2353', sky3: '#48386C', glow: '#9A86B8', disc: '#F0E6D0',
      r1: '#3A3663', r2: '#2A2A4E', r3: '#1C1D38', r4: '#101025', lake: '#141B3C', hi: '#3B3A6E', fg: '#07070F', cloud: '#2E2C54', star: 0.55 },
    { h: 6.7,  sky1: '#27406F', sky2: '#7B5E8C', sky3: '#E9A073', glow: '#FFCB96', disc: '#FFF0D2',
      r1: '#8A6D86', r2: '#5E4C70', r3: '#3B3354', r4: '#221E36', lake: '#4A4470', hi: '#E0A07E', fg: '#161326', cloud: '#C98A86', star: 0.12 },
    { h: 9,    sky1: '#2E6FB7', sky2: '#7FB2DC', sky3: '#DFE4D8', glow: '#FFF3D4', disc: '#FFFBE8',
      r1: '#9DB4CE', r2: '#7793B4', r3: '#546F94', r4: '#2F4668', lake: '#6C97BE', hi: '#CFE4F2', fg: '#1B2B3F', cloud: '#FFFFFF', star: 0 },
    { h: 13,   sky1: '#2A79C6', sky2: '#86C2E8', sky3: '#DCEAF2', glow: '#FFFAE4', disc: '#FFFFF4',
      r1: '#A8C2D8', r2: '#82A3C2', r3: '#5E7C9F', r4: '#365071', lake: '#78A5CA', hi: '#DCEEF8', fg: '#20324A', cloud: '#FFFFFF', star: 0 },
    { h: 16.5, sky1: '#3576B8', sky2: '#96BFDC', sky3: '#EFDFBE', glow: '#FFEFC4', disc: '#FFF8DC',
      r1: '#B0B9C9', r2: '#8A93AE', r3: '#64708E', r4: '#3B4463', lake: '#7E9CBE', hi: '#E6D9BE', fg: '#242C44', cloud: '#FDF4E4', star: 0 },
    { h: 18.7, sky1: '#2C4F88', sky2: '#C8805F', sky3: '#F4B268', glow: '#FFD79A', disc: '#FFF0C8',
      r1: '#C08A74', r2: '#8E6468', r3: '#5E4356', r4: '#36293C', lake: '#8A6A78', hi: '#F2BB7E', fg: '#1D1628', cloud: '#F3AE8E', star: 0 },
    { h: 19.9, sky1: '#1A2B5C', sky2: '#7D4A72', sky3: '#E6704E', glow: '#FF9A62', disc: '#FFD9A0',
      r1: '#9A5E74', r2: '#6E4560', r3: '#472F49', r4: '#281B30', lake: '#5A3F62', hi: '#D46E58', fg: '#140F20', cloud: '#C46A74', star: 0.1 },
    { h: 21.2, sky1: '#09102C', sky2: '#1C2350', sky3: '#4A3A68', glow: '#A98EB4', disc: '#F2E8D2',
      r1: '#453E68', r2: '#2E2A4C', r3: '#1D1B34', r4: '#101021', lake: '#1B2142', hi: '#453E70', fg: '#06070E', cloud: '#332E52', star: 0.7 }
];
const KEYS = ['sky1', 'sky2', 'sky3', 'glow', 'disc', 'r1', 'r2', 'r3', 'r4', 'lake', 'hi', 'fg', 'cloud'];

const hex = c => [parseInt(c.slice(1, 3), 16), parseInt(c.slice(3, 5), 16), parseInt(c.slice(5, 7), 16)];
const toHex = v => '#' + v.map(n => Math.round(Math.min(255, Math.max(0, n))).toString(16).padStart(2, '0')).join('');
const mixHex = (a, b, t) => toHex(hex(a).map((v, i) => v + (hex(b)[i] - v) * t));

export function paletteAt(hour) {
    const list = PHASES;
    let i = 0;
    while (i < list.length - 1 && hour >= list[i + 1].h) i++;
    const a = list[i];
    const b = list[(i + 1) % list.length];
    const span = (b.h > a.h ? b.h : b.h + 24) - a.h;          // last -> first wraps past midnight
    const t = span <= 0 ? 0 : Math.min(1, Math.max(0, (hour - a.h) / span));
    const out = { star: a.star + (b.star - a.star) * t };
    KEYS.forEach(k => { out[k] = mixHex(a[k], b[k], t); });
    return out;
}

/* where the sun (or moon) sits, 0..1 across its own arc */
export function discAt(hour) {
    const day = hour >= RISE && hour < SET;
    const t = day ? (hour - RISE) / (SET - RISE)
                  : ((hour < RISE ? hour + 24 : hour) - SET) / (24 - SET + RISE);
    return {
        moon: !day,
        x: 170 + t * 1260,
        y: 620 - Math.sin(Math.max(0, Math.min(1, t)) * Math.PI) * (day ? 540 : 460)
    };
}

/* ---------------------------------------------------------------- the art */
function pine(x, base, h, w) {
    let d = '';
    const tiers = 4;
    for (let i = 0; i < tiers; i++) {
        const top = base - h + (h * 0.72) * (i / tiers);
        const half = w * (0.42 + 0.58 * (i + 1) / tiers);
        const bot = base - h * 0.62 + (h * 0.62) * (i + 1) / tiers;
        d += `M${(x - half).toFixed(1)},${bot.toFixed(1)} L${x},${top.toFixed(1)} L${(x + half).toFixed(1)},${bot.toFixed(1)} Z`;
    }
    return `<path d="${d}"/><rect x="${(x - w * 0.07).toFixed(1)}" y="${(base - h * 0.2).toFixed(1)}" width="${(w * 0.14).toFixed(1)}" height="${(h * 0.2).toFixed(1)}"/>`;
}

/* the FunReminder kangaroo, as a silhouette on the near bank.
 * Local origin is the ground under its foot; y is up-negative. */
function rooSilhouette() {
    return '<g transform="translate(950,958) scale(.95)">' +
        // tail: thick at the rump, tapering to the tip on the ground
        '<path d="M18,-66 C12,-44 -4,-24 -28,-12 C-54,0 -86,6 -118,6 C-124,6 -126,-2 -120,-5 C-88,-14 -58,-24 -38,-40 C-24,-51 -14,-64 -8,-78 Z"/>' +
        // hind leg: thigh, shin, long flat foot
        '<path d="M4,-96 C26,-96 42,-76 42,-52 C42,-34 32,-20 18,-18 C2,-16 -10,-30 -12,-52 C-14,-76 -8,-96 4,-96 Z"/>' +
        '<path d="M20,-40 C30,-34 34,-22 30,-12 L6,-8 C2,-22 8,-34 20,-40 Z"/>' +
        '<path d="M4,-18 C-8,-18 -14,-10 -12,-4 C-10,0 -4,2 4,2 L62,2 C72,2 76,-6 70,-11 C58,-19 28,-18 4,-18 Z"/>' +
        // body leaning forward, chest, forearm
        '<path d="M2,-88 C-2,-108 8,-128 26,-136 C40,-142 52,-138 56,-128 C60,-118 54,-108 44,-102 C34,-96 28,-84 26,-70 C24,-56 12,-50 4,-56 C-2,-61 0,-76 2,-88 Z"/>' +
        '<path d="M30,-124 C44,-124 54,-116 54,-106 C54,-98 48,-93 41,-95 C33,-97 26,-106 26,-116 Z"/>' +
        '<path d="M44,-118 C52,-117 59,-111 62,-104 C63,-101 60,-99 57,-101 C51,-105 45,-110 42,-114 Z"/>' +
        // neck, head, short blunt muzzle
        '<path d="M44,-128 C42,-142 50,-154 62,-157 C73,-160 82,-154 84,-145 C88,-143 90,-139 89,-135 C88,-131 83,-130 78,-131 C70,-133 58,-130 50,-126 C46,-124 44,-125 44,-128 Z"/>' +
        // ears
        '<path d="M58,-152 C54,-164 54,-178 58,-188 C60,-193 66,-192 67,-187 C69,-176 68,-162 64,-151 Z"/>' +
        '<path d="M70,-152 C72,-164 78,-176 85,-183 C89,-187 94,-184 92,-179 C88,-168 81,-157 75,-150 Z"/>' +
        '</g>';
}

export function lakeside(p) {
    const r = rng(41), I = n => p + n, U = n => `url(#${p + n})`;
    const C = k => ` data-c="${k}"`;

    /* stars: three layers that twinkle out of phase */
    const stars = ['', '', ''];
    for (let i = 0; i < 150; i++) {
        const x = r() * W, y = r() * 560, s = r() < 0.07 ? 1.9 : 0.5 + r() * 0.9;
        stars[i % 3] += `<circle cx="${x.toFixed(0)}" cy="${y.toFixed(0)}" r="${s.toFixed(2)}" fill="#F4EFDF"/>`;
    }
    /* lake shimmer: short horizontal dashes, brighter near the far shore */
    let shimmer = ['', '', ''];
    for (let i = 0; i < 34; i++) {
        const y = 712 + i * 7.5 + r() * 5, w = 24 + r() * 130, x = 120 + r() * (W - 300);
        shimmer[i % 3] += `<rect x="${x.toFixed(0)}" y="${y.toFixed(0)}" width="${w.toFixed(0)}" height="2" rx="1"${C('hi')} opacity="${(0.5 - i / 90).toFixed(2)}"/>`;
    }
    /* pine stands on the near bank */
    let pinesL = '', pinesR = '';
    for (let i = 0; i < 8; i++) {                       // left stand
        const x = 26 + i * 76 + r() * 24, h = 150 + r() * 180;
        pinesL += pine(x, 1000 - r() * 20, h, 34 + r() * 16);
    }
    for (let i = 0; i < 5; i++) {                       // right stand; the gap between is the roo's
        const x = W - 44 - i * 86 - r() * 22, h = 140 + r() * 190;
        pinesR += pine(x, 1000 - r() * 18, h, 32 + r() * 16);
    }
    const clouds1 = cloud(300, 180, 0.9, 0.5) + cloud(1040, 140, 1.1, 0.42) + cloud(1480, 230, 0.7, 0.4);
    const clouds2 = cloud(680, 300, 0.5, 0.3) + cloud(1300, 350, 0.55, 0.26);

    return [
        /* sky + still water + the ranges */
        L('', 0, 0, W, H, defs(`
 <linearGradient id="${I('sky')}" x1="0" y1="0" x2="0" y2="1">
   <stop offset="0" stop-color="#05091A"${C('sky1')}/><stop offset=".55" stop-color="#0B1534"${C('sky2')}/><stop offset="1" stop-color="#1A2C55"${C('sky3')}/>
 </linearGradient>
 <linearGradient id="${I('lk')}" x1="0" y1="0" x2="0" y2="1">
   <stop offset="0" stop-color="#1A2C55"${C('sky3')}/><stop offset=".22" stop-color="#0B1530"${C('lake')}/><stop offset="1" stop-color="#0B1530"${C('lake')}/>
 </linearGradient>
 ${glow(I('gl'), '#9BAAD2')} ${cloudDefs(I('cl'))}`) +
            `<rect width="${W}" height="${H}" fill="${U('sky')}"/>`),

        L('fr-twinkle k0', 0, 0, W, 580, stars[0], 'opacity:0'),
        L('fr-twinkle k1', 0, 0, W, 580, stars[1], 'opacity:0'),
        L('fr-twinkle k2', 0, 0, W, 580, stars[2], 'opacity:0'),

        /* sun / moon: one layer moved by transform, so no repaint */
        L('fr-disc', -260, -260, 520, 520,
            `<g transform="translate(0,0)"><circle r="250" fill="${U('gl')}"/>` +
            `<circle r="46" fill="#EFEAD4"${C('disc')}/>` +
            `<g data-moon opacity="0" fill="#000" fill-opacity=".12"><circle cx="-14" cy="-10" r="9"/><circle cx="12" cy="9" r="6"/><circle cx="6" cy="-18" r="4.5"/></g></g>`),

        L('fr-drift-slow', 0, 60, W * 2, 300, clouds1 + `<g transform="translate(${W},0)">${clouds1}</g>`),
        L('fr-drift', 0, 240, W * 2, 220, clouds2 + `<g transform="translate(${W},0)">${clouds2}</g>`),

        /* ranges, far to near */
        L('', 0, 420, W, 320,
            `<path d="M-20,700 L120,566 L210,612 L330,520 L430,600 L540,548 L660,628 L760,580 L900,660 L1010,596 L1140,668 L1270,604 L1400,672 L1620,588 L1620,700 Z" fill="#223359"${C('r1')}/>`),
        L('', 0, 480, W, 280,
            `<path d="M-20,706 L170,600 L280,648 L420,566 L560,654 L700,596 L840,676 L980,620 L1120,690 L1300,616 L1460,686 L1620,628 L1620,706 Z" fill="#182542"${C('r2')}/>` +
            `<path d="M420,566 L470,598 L390,614 Z" fill="#FFFFFF" opacity=".10"/><path d="M1300,616 L1340,642 L1272,654 Z" fill="#FFFFFF" opacity=".08"/>`),
        L('', 0, 560, W, 200,
            `<path d="M-20,712 L140,660 L300,700 L480,648 L660,706 L840,664 L1020,712 L1200,662 L1380,710 L1620,666 L1620,712 Z" fill="#101A31"${C('r3')}/>`),

        /* the lake */
        L('', 0, 700, W, 300, `<rect y="700" width="${W}" height="300" fill="${U('lk')}"/>`),
        /* reflection column under the sun/moon */
        L('fr-reflect', -90, 700, 180, 260,
            `<g><ellipse cx="0" cy="724" rx="54" ry="10"${C('hi')} opacity=".85"/>` +
            `<ellipse cx="0" cy="760" rx="38" ry="7"${C('hi')} opacity=".6"/>` +
            `<ellipse cx="0" cy="800" rx="46" ry="6"${C('hi')} opacity=".4"/>` +
            `<ellipse cx="0" cy="846" rx="30" ry="5"${C('hi')} opacity=".28"/>` +
            `<ellipse cx="0" cy="900" rx="38" ry="5"${C('hi')} opacity=".18"/></g>`),
        ...shimmer.map((g, i) => L('fr-shimmer s' + i, 0, 700, W, 270, g)),

        /* near bank: rock, pines, kangaroo */
        L('', 0, 820, W, 180,
            `<path d="M-20,1000 L-20,900 C180,872 420,918 640,944 C900,974 1180,930 1620,886 L1620,1000 Z" fill="#090F1D"${C('r4')}/>`),
        L('', 0, 700, W, 300,
            `<g fill="#04070E"${C('fg')}>` +
            `<path d="M1150,1000 C1156,952 1196,920 1262,912 C1322,905 1370,926 1392,962 C1402,978 1408,990 1410,1000 Z"/>` +
            rooSilhouette() + pinesL + pinesR +
            `</g>`)
    ].join('');
}

/* ------------------------------------------------- the cycle, once a minute */
export function lakesideTick(root, date) {
    let m = root._frCycle;
    if (!m) {
        m = root._frCycle = { byKey: {} };
        root.querySelectorAll('[data-c]').forEach(el => {
            const k = el.getAttribute('data-c');
            (m.byKey[k] = m.byKey[k] || []).push(el);
        });
        m.stars = [...root.querySelectorAll('.fr-twinkle')];
        m.glowStops = [...root.querySelectorAll('radialGradient stop')];
        m.disc = root.querySelector('.fr-disc > g');
        m.halo = m.disc && m.disc.firstElementChild;
        m.moon = root.querySelector('[data-moon]');
        m.reflect = root.querySelector('.fr-reflect');
    }
    const h = date.getHours() + date.getMinutes() / 60 + date.getSeconds() / 3600;
    const pal = paletteAt(h);
    const pos = discAt(h);

    for (const k of KEYS) {
        const els = m.byKey[k];
        if (!els) continue;
        for (const el of els) {
            if (el.tagName === 'stop') el.setAttribute('stop-color', pal[k]);
            else el.setAttribute('fill', pal[k]);
        }
    }
    m.glowStops.forEach(st => st.setAttribute('stop-color', pal.glow));
    m.stars.forEach(el => { el.style.opacity = pal.star.toFixed(3); });

    if (m.disc) {
        m.disc.setAttribute('transform', `translate(${pos.x.toFixed(1)},${pos.y.toFixed(1)})`);
        // the lower it sits, the bigger and softer its halo
        const low = Math.min(1, Math.max(0, (pos.y - 100) / 520));
        if (m.halo) m.halo.setAttribute('transform', `scale(${(0.7 + low * 0.6).toFixed(3)})`);
    }
    if (m.moon) m.moon.setAttribute('opacity', pos.moon ? '1' : '0');
    if (m.reflect) {
        // the reflection only shows while the sun/moon is low enough to catch the water
        const vis = pos.y > 260 ? 1 : Math.max(0, (pos.y - 60) / 200);
        m.reflect.style.opacity = vis.toFixed(2);
        m.reflect.style.transform = `translateX(${pos.x.toFixed(1)}px)`;
    }
    return pal;
}
