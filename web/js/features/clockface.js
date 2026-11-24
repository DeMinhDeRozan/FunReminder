/* The clock behind the chat. One face is visible at a time; the choice lives in
 * the 'clock.face' preference and is made in Settings > Clock type.
 *
 * Faces
 *   original  the existing analog dial, hands driven by the inline tickClock
 *   roman     the same dial and hands, Roman numerals instead of ticks
 *   digital   a physical LED panel: bezel, inner bevel, gloss, ghost segments
 *   nixie     warm valve tubes, glass glow and unlit ghost cathodes
 *   rings     three rotating number rings on a brushed disc, read at the marker
 *   bands     three sliding number bands, each framed and labelled
 *   words     a letter grid that lights up the time in words
 *   arcs      three progress arcs with a dot and a label at each leading edge
 *   sundial   a gnomon whose shadow swings and stretches with the time of day
 *
 * The last five are written for this project. Their concepts come from pens I
 * looked at in the browser (rendered output only, no source read or copied):
 *   rings  - "Rotating Clock", Vicio Bonura, codepen.io/VicioBonura/pen/XdYEjR
 *   bands  - "CSS Clock", Michael Hobizal, codepen.io/mikehobizal/pen/RNjREN
 *   words  - "QLOCKTWO, time in words", Niklas Knaack, codepen.io/NiklasKnaack/pen/raBxyvo
 *   nixie  - "Nixie Tube Clock", Rafa, codepen.io/RAFA3L/pen/PoVYoPN
 *   arcs   - mine: the fifth pen was a private /editor/ link and could not be seen
 *
 * Driving: the inline tickClock() calls FR.clockFace.frame(now) every animation
 * frame (it answers whether the dial hands are in use) and FR.clockFace.paint(now)
 * once a second. requestAnimationFrame stops by itself while the tab is hidden,
 * so nothing here runs in the background.
 *
 * Every element class here starts with fr-cf-. The body carries fr-face-<id>,
 * and the two must never share a name: a layer class that also matches the body
 * puts the layer's own width and height on <body> and squashes the whole page.
 */
import { store } from '../storage/localDataManager.js';

const NS = 'http://www.w3.org/2000/svg';
const svg = (tag, attrs = {}, text) => {
    const e = document.createElementNS(NS, tag);
    for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v);
    if (text != null) e.textContent = text;
    return e;
};
const el = (tag, cls, text) => {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
};
const pad = n => String(n).padStart(2, '0');
const hour12 = () => !!(window.FR && FR.clock && FR.clock.hour12());
const hh = d => hour12() ? (d.getHours() % 12 || 12) : d.getHours();
const ampm = d => hour12() ? (d.getHours() < 12 ? 'AM' : 'PM') : '';
/* faces that lay the hours out as a list follow the 12/24h preference too:
 * 24 cells 00..23, or 12 cells 12,1..11. Changing the preference rebuilds them. */
const hourCount = () => hour12() ? 12 : 24;
const hourIndex = d => hour12() ? d.getHours() % 12 : d.getHours();
const hourLabel = i => hour12() ? String(i === 0 ? 12 : i) : pad(i);

/* ---------------------------------------------------------------- digital */
function buildDigital(host) {
    const root = el('div', 'fr-cf fr-cf-digital');
    const screen = el('div', 'fr-cf-screen');
    const read = el('div', 'fr-cf-read');
    ['h1', 'h2', 'c', 'm1', 'm2'].forEach(k => {
        const s = el('span', k === 'c' ? 'fr-cf-colon' : 'fr-cf-dig', k === 'c' ? ':' : '8');
        s.dataset.k = k;
        read.appendChild(s);
    });
    const side = el('div', 'fr-cf-side');
    side.append(el('span', 'fr-cf-secs', '00'), el('span', 'fr-cf-ampm'));
    screen.append(el('div', 'fr-cf-ghost', '88:88'), read, side, el('div', 'fr-cf-gloss'));
    root.append(screen);
    host.appendChild(root);
    return root;
}
function paintDigital(root, d) {
    const t = pad(hh(d)) + pad(d.getMinutes());
    ['h1', 'h2', 'm1', 'm2'].forEach((k, i) => {
        const s = root.querySelector('[data-k="' + k + '"]');
        if (s.textContent === t[i]) return;
        s.textContent = t[i];
        s.classList.remove('tick'); void s.offsetWidth; s.classList.add('tick');
    });
    root.querySelector('.fr-cf-colon').classList.toggle('dim', d.getSeconds() % 2 === 1);
    root.querySelector('.fr-cf-secs').textContent = pad(d.getSeconds());
    root.querySelector('.fr-cf-ampm').textContent = ampm(d);
}

/* ---------------------------------------------------------------- nixie */
function buildNixie(host) {
    const root = el('div', 'fr-cf fr-cf-nixie');
    const row = el('div', 'fr-cf-tubes');
    ['h1', 'h2', 'sep', 'm1', 'm2', 's1', 's2'].forEach(k => {
        if (k === 'sep') { row.appendChild(el('div', 'fr-cf-dots')); return; }
        const tube = el('div', 'fr-cf-tube' + (k[0] === 's' ? ' small' : '') + (k === 's1' ? ' gap' : ''));
        tube.dataset.k = k;
        const glass = el('div', 'fr-cf-glass');
        const stack = el('div', 'fr-cf-cathodes');
        for (let i = 0; i < 10; i++) stack.appendChild(el('span', 'fr-cf-cat', String(i)));
        glass.append(el('div', 'fr-cf-mesh'), stack, el('div', 'fr-cf-haze'));
        tube.append(glass, el('div', 'fr-cf-socket'));
        row.appendChild(tube);
    });
    row.appendChild(el('span', 'fr-cf-lamp'));
    root.append(row, el('div', 'fr-cf-plinth'));
    host.appendChild(root);
    return root;
}
function paintNixie(root, d) {
    const v = {
        h1: pad(hh(d))[0], h2: pad(hh(d))[1],
        m1: pad(d.getMinutes())[0], m2: pad(d.getMinutes())[1],
        s1: pad(d.getSeconds())[0], s2: pad(d.getSeconds())[1]
    };
    for (const [k, digit] of Object.entries(v)) {
        const tube = root.querySelector('[data-k="' + k + '"]');
        if (!tube || tube.dataset.v === digit) continue;
        tube.dataset.v = digit;
        tube.querySelectorAll('.fr-cf-cat').forEach((c, i) => c.classList.toggle('lit', String(i) === digit));
    }
    root.classList.toggle('pulse', d.getSeconds() % 2 === 0);
    root.querySelector('.fr-cf-lamp').textContent = ampm(d);
}

/* ---------------------------------------------------------------- rings */
const ringSpec = () => [{ k: 'h', n: hourCount(), r: 44, size: 7 }, { k: 'm', n: 60, r: 66, size: 5.4 }, { k: 's', n: 60, r: 86, size: 4.6 }];
function buildRings(host) {
    const root = svg('svg', { class: 'fr-cf fr-cf-rings', viewBox: '0 0 200 200', 'aria-hidden': 'true' });
    root.append(
        svg('circle', { class: 'fr-cf-disc', cx: 100, cy: 100, r: 95 }),
        svg('circle', { class: 'fr-cf-rim', cx: 100, cy: 100, r: 95 }));
    ringSpec().forEach(ring => {
        const g = svg('g', { class: 'fr-cf-ring', 'data-ring': ring.k });
        for (let i = 0; i < ring.n; i++) {
            const a = i / ring.n * 360;
            const t = svg('text', {
                class: 'fr-cf-num', x: 100 + ring.r, y: 100, 'font-size': ring.size,
                'text-anchor': 'middle', 'dominant-baseline': 'central',
                transform: 'rotate(' + a + ' 100 100)'
            }, ring.k === 'h' ? hourLabel(i) : pad(i));
            t.dataset.i = i;
            g.appendChild(t);
        }
        root.appendChild(g);
    });
    root.append(
        svg('rect', { class: 'fr-cf-window', x: 126, y: 92, width: 62, height: 16, rx: 4 }),
        svg('path', { class: 'fr-cf-marker', d: 'M190 100 l6 -5 v10 z' }),
        svg('text', { class: 'fr-cf-ampm-t', x: 157, y: 118, 'text-anchor': 'middle', 'font-size': 6 }, ''));
    host.appendChild(root);
    return root;
}
function paintRings(root, d) {
    const val = {
        h: hourIndex(d) + d.getMinutes() / 60,
        m: d.getMinutes() + d.getSeconds() / 60,
        s: d.getSeconds() + d.getMilliseconds() / 1000
    };
    root.querySelector('.fr-cf-ampm-t').textContent = ampm(d);
    ringSpec().forEach(ring => {
        const g = root.querySelector('[data-ring="' + ring.k + '"]');
        g.setAttribute('transform', 'rotate(' + (-val[ring.k] / ring.n * 360).toFixed(3) + ' 100 100)');
        const cur = Math.floor(val[ring.k]);
        if (g.dataset.cur === String(cur)) return;
        g.dataset.cur = cur;
        g.querySelectorAll('.fr-cf-num').forEach(t => t.classList.toggle('on', +t.dataset.i === cur));
    });
}

/* ---------------------------------------------------------------- bands */
const bandSpec = () => [{ k: 'h', n: hourCount(), label: 'HOUR' }, { k: 'm', n: 60, label: 'MINUTE' }, { k: 's', n: 60, label: 'SECOND' }];
function buildBands(host) {
    const root = el('div', 'fr-cf fr-cf-bands');
    bandSpec().forEach(b => {
        const lane = el('div', 'fr-cf-lane');
        lane.dataset.k = b.k;
        const strip = el('div', 'fr-cf-strip');
        for (let i = 0; i < b.n; i++) strip.appendChild(el('span', 'fr-cf-cell', b.k === 'h' ? hourLabel(i) : pad(i)));
        const frame = el('div', 'fr-cf-frame');
        frame.appendChild(el('span', 'fr-cf-frame-label', b.label));
        if (b.k === 'h') frame.appendChild(el('span', 'fr-cf-frame-ampm'));
        lane.append(strip, frame);
        root.appendChild(lane);
    });
    host.appendChild(root);
    return root;
}
function paintBands(root, d) {
    const val = { h: hourIndex(d), m: d.getMinutes(), s: d.getSeconds() };
    const tag = root.querySelector('.fr-cf-frame-ampm');
    if (tag) tag.textContent = ampm(d);
    bandSpec().forEach(b => {
        const lane = root.querySelector('[data-k="' + b.k + '"]');
        const strip = lane.firstChild;
        const v = val[b.k];
        if (strip.dataset.v === String(v)) return;
        const wrapped = strip.dataset.v !== undefined && +strip.dataset.v > v;   // 59 -> 00: jump, don't rewind
        strip.dataset.v = v;
        if (wrapped) strip.classList.add('nojump');
        strip.style.setProperty('--i', v);
        strip.querySelectorAll('.fr-cf-cell').forEach((c, i) => c.classList.toggle('on', i === v));
        if (wrapped) requestAnimationFrame(() => strip.classList.remove('nojump'));
    });
}

/* ---------------------------------------------------------------- words */
const GRID = [
    'ITBISKHALFZ', 'TWENTYQFIVE', 'QUARTERDTEN', 'PASTVTOWMIN',
    'ONETWOTHREE', 'FOURFIVESIX', 'SEVENEIGHTZ', 'NINETENQWER',
    'TWELVEXYZQW', 'ELEVENQXYZW', "O'CLOCKMATE"
];
/* word -> [row, first column, last column], all 0-based and inclusive */
const WORDS = {
    IT: [0, 0, 1], IS: [0, 3, 4], HALF: [0, 6, 9],
    TWENTY: [1, 0, 5], FIVE_M: [1, 7, 10],
    QUARTER: [2, 0, 6], TEN_M: [2, 8, 10],
    PAST: [3, 0, 3], TO: [3, 5, 6],
    1: [4, 0, 2], 2: [4, 3, 5], 3: [4, 6, 10],
    4: [5, 0, 3], 5: [5, 4, 7], 6: [5, 8, 10],
    7: [6, 0, 4], 8: [6, 5, 9],
    9: [7, 0, 3], 10: [7, 4, 6],
    12: [8, 0, 5], 11: [9, 0, 5],
    OCLOCK: [10, 0, 6], MATE: [10, 7, 10]
};
function buildWords(host) {
    const root = el('div', 'fr-cf fr-cf-words');
    GRID.forEach((row, r) => [...row].forEach((ch, c) => {
        const s = el('span', 'fr-cf-ltr', ch);
        s.dataset.rc = r + ':' + c;
        root.appendChild(s);
    }));
    host.appendChild(root);
    return root;
}
function wordsFor(d) {
    const bucket = Math.floor(d.getMinutes() / 5) * 5;
    let h = d.getHours() % 12 || 12;
    const MIN = {
        5: ['FIVE_M', 'PAST'], 10: ['TEN_M', 'PAST'], 15: ['QUARTER', 'PAST'], 20: ['TWENTY', 'PAST'],
        25: ['TWENTY', 'FIVE_M', 'PAST'], 30: ['HALF', 'PAST'], 35: ['TWENTY', 'FIVE_M', 'TO'],
        40: ['TWENTY', 'TO'], 45: ['QUARTER', 'TO'], 50: ['TEN_M', 'TO'], 55: ['FIVE_M', 'TO']
    };
    const out = ['IT', 'IS'].concat(bucket === 0 ? ['OCLOCK'] : MIN[bucket]);
    if (bucket >= 35) h = (h % 12) + 1;              // "twenty five to <next hour>"
    out.push(String(h), 'MATE');
    return out;
}
function paintWords(root, d) {
    const list = wordsFor(d), key = list.join();
    if (root.dataset.key === key) return;
    root.dataset.key = key;
    const on = new Set();
    list.forEach(w => {
        const spec = WORDS[w];
        if (!spec) return;
        for (let c = spec[1]; c <= spec[2]; c++) on.add(spec[0] + ':' + c);
    });
    root.querySelectorAll('.fr-cf-ltr').forEach(s => s.classList.toggle('on', on.has(s.dataset.rc)));
}

/* ---------------------------------------------------------------- arcs */
const ARCS = [{ k: 'h', r: 86 }, { k: 'm', r: 68 }, { k: 's', r: 50 }];
const TAU = 2 * Math.PI;
function buildArcs(host) {
    const root = svg('svg', { class: 'fr-cf fr-cf-arcs', viewBox: '0 0 200 200', 'aria-hidden': 'true' });
    ARCS.forEach(a => {
        const len = (TAU * a.r).toFixed(2);
        root.append(
            svg('circle', { class: 'fr-cf-track', cx: 100, cy: 100, r: a.r }),
            svg('circle', {
                class: 'fr-cf-prog', 'data-arc': a.k, cx: 100, cy: 100, r: a.r,
                'stroke-dasharray': len, 'stroke-dashoffset': len, transform: 'rotate(-90 100 100)'
            }),
            svg('circle', { class: 'fr-cf-head', 'data-head': a.k, cx: 100, cy: 100 - a.r, r: 3.4 }),
            svg('text', {
                class: 'fr-cf-lab', 'data-lab': a.k, x: 100, y: 100 - a.r + 11,
                'text-anchor': 'middle', 'dominant-baseline': 'central', 'font-size': 8
            }, '00'));
        if (a.k === 'h') root.appendChild(svg('text', {
            class: 'fr-cf-lab small', 'data-lab': 'ampm', x: 100, y: 100 - a.r + 20,
            'text-anchor': 'middle', 'dominant-baseline': 'central', 'font-size': 5.4
        }, ''));
    });
    host.appendChild(root);
    return root;
}
function paintArcs(root, d) {
    const f = {
        h: ((d.getHours() % 12) + d.getMinutes() / 60) / 12,
        m: (d.getMinutes() + d.getSeconds() / 60) / 60,
        s: (d.getSeconds() + d.getMilliseconds() / 1000) / 60
    };
    const txt = { h: pad(hh(d)), m: pad(d.getMinutes()), s: pad(d.getSeconds()) };
    ARCS.forEach(a => {
        const len = TAU * a.r;
        root.querySelector('[data-arc="' + a.k + '"]').setAttribute('stroke-dashoffset', (len * (1 - f[a.k])).toFixed(2));
        const ang = f[a.k] * TAU - Math.PI / 2;
        const head = root.querySelector('[data-head="' + a.k + '"]');
        head.setAttribute('cx', (100 + Math.cos(ang) * a.r).toFixed(2));
        head.setAttribute('cy', (100 + Math.sin(ang) * a.r).toFixed(2));
        const lab = root.querySelector('[data-lab="' + a.k + '"]'), lr = a.r - 12;
        lab.setAttribute('x', (100 + Math.cos(ang) * lr).toFixed(2));
        lab.setAttribute('y', (100 + Math.sin(ang) * lr).toFixed(2));
        if (lab.textContent !== txt[a.k]) lab.textContent = txt[a.k];
        if (a.k === 'h') {
            const ap = root.querySelector('[data-lab="ampm"]');
            ap.setAttribute('x', (100 + Math.cos(ang) * (lr - 8)).toFixed(2));
            ap.setAttribute('y', (100 + Math.sin(ang) * (lr - 8)).toFixed(2));
            if (ap.textContent !== ampm(d)) ap.textContent = ampm(d);
        }
    });
}

/* ---------------------------------------------------------------- sundial */
function buildSundial(host) {
    const root = svg('svg', { class: 'fr-cf fr-cf-sundial', viewBox: '0 0 200 200', 'aria-hidden': 'true' });
    root.append(
        svg('path', { class: 'fr-cf-plate', d: 'M14 128 A 86 86 0 0 1 186 128 Z' }),
        svg('line', { class: 'fr-cf-baseline', x1: 14, y1: 128, x2: 186, y2: 128 }));
    for (let hr = 6; hr <= 18; hr++) {
        const ang = (-90 + (hr - 6) / 12 * 180) * Math.PI / 180;
        const major = hr % 3 === 0, r1 = major ? 62 : 70, r2 = 80;
        const g = svg('g', { class: 'fr-cf-mark' + (major ? ' major' : '') });
        g.appendChild(svg('line', {
            x1: (100 - Math.sin(ang) * r1).toFixed(2), y1: (128 - Math.cos(ang) * r1).toFixed(2),
            x2: (100 - Math.sin(ang) * r2).toFixed(2), y2: (128 - Math.cos(ang) * r2).toFixed(2)
        }));
        if (major) g.appendChild(svg({
        }.x ? 'text' : 'text', {
            x: (100 - Math.sin(ang) * 52).toFixed(2), y: (128 - Math.cos(ang) * 52).toFixed(2),
            'text-anchor': 'middle', 'dominant-baseline': 'central', 'font-size': 9
        }, hr === 12 ? '12' : (hr % 12 || 12) + (hr < 12 ? 'a' : 'p')));
        root.appendChild(g);
    }
    root.append(
        svg('circle', { class: 'fr-cf-glow', cx: 100, cy: 40, r: 16 }),
        svg('circle', { class: 'fr-cf-sun', cx: 100, cy: 40, r: 6.5 }),
        svg('path', { class: 'fr-cf-shadow', d: 'M0 0' }),
        svg('path', { class: 'fr-cf-gnomon', d: 'M94 128 L100 92 L106 128 Z' }),
        svg('circle', { class: 'fr-cf-pin', cx: 100, cy: 128, r: 2.6 }));
    host.appendChild(root);
    return root;
}
function paintSundial(root, d) {
    const t = d.getHours() + d.getMinutes() / 60 + d.getSeconds() / 3600;
    const day = t >= 6 && t <= 18;
    const frac = day ? (t - 6) / 12 : ((t < 6 ? t + 6 : t - 18) / 12);
    const alt = Math.sin(Math.max(0, Math.min(1, frac)) * Math.PI);
    const deg = -90 + frac * 180, rad = deg * Math.PI / 180;
    const lx = 100 + Math.sin(rad) * 76, ly = 128 - Math.cos(rad) * 76;
    const sun = root.querySelector('.fr-cf-sun'), glow = root.querySelector('.fr-cf-glow');
    sun.setAttribute('cx', lx.toFixed(2)); sun.setAttribute('cy', ly.toFixed(2));
    glow.setAttribute('cx', lx.toFixed(2)); glow.setAttribute('cy', ly.toFixed(2));
    sun.classList.toggle('night', !day); glow.classList.toggle('night', !day);
    const len = 16 + 74 * (1 - alt), sa = (deg + 180) * Math.PI / 180;
    const tipX = 100 + Math.sin(sa) * len, tipY = 128 - Math.cos(sa) * len * 0.42;
    const spread = 5.5 + 4 * (1 - alt);
    const shadow = root.querySelector('.fr-cf-shadow');
    shadow.setAttribute('d', 'M' + (100 - spread).toFixed(2) + ' 128 L' + tipX.toFixed(2) + ' ' + tipY.toFixed(2) + ' L' + (100 + spread).toFixed(2) + ' 128 Z');
    shadow.style.opacity = (day ? 0.5 + 0.34 * alt : 0.2 + 0.14 * alt).toFixed(3);
}

/* ---------------------------------------------------------------- registry */
const THUMB = {
    original: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3.2 2.2"/>',
    roman: '<circle cx="12" cy="12" r="9"/><path d="M10.6 6.4h2.8M12 6.4v2.2M8.3 15.8l1 1.8 1-1.8M14.2 15.8v2.2M16 15.8v2.2M15.1 15.8v2.2"/>',
    digital: '<rect x="2.5" y="6.5" width="19" height="11" rx="2.5"/><path d="M6 10v4M9.4 10v4M12 11v.1M12 14.3v.1M14.6 10v4M18 10v4"/>',
    nixie: '<rect x="6.5" y="3.5" width="11" height="13.5" rx="5.5"/><path d="M9.5 19h5M8 21h8M10.2 8.4h3.6M12 8.4v4.8M10.2 13.2h3.6"/>',
    rings: '<circle cx="12" cy="12" r="9.2"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2.8"/><path d="M21.2 12h-1.6M18 12h-1.6"/>',
    bands: '<rect x="2" y="5" width="20" height="4" rx="1"/><rect x="2" y="15" width="20" height="4" rx="1"/><rect x="7.5" y="9.5" width="6" height="5" rx="1.4"/>',
    words: '<path d="M4 6h5M11 6h3M17 6h3M4 10h3M9 10h11M4 14h8M14 14h6M4 18h4M10 18h5"/>',
    arcs: '<path d="M12 3.2a8.8 8.8 0 0 1 8.4 6.1"/><path d="M12 6.4a5.6 5.6 0 0 1 5 3.1"/><path d="M12 9.6a2.4 2.4 0 0 1 2.2 1.5"/><circle cx="20.4" cy="9.3" r="1.2" fill="currentColor" stroke="none"/>',
    sundial: '<path d="M3 17h18"/><path d="M10 17L12 8l2 9z"/><path d="M14 17l5.5 2.4"/><circle cx="6.5" cy="8.5" r="2"/>'
};
export const FACES = [
    { id: 'original', name: 'Dial', blurb: 'The enamel dial', hands: true },
    { id: 'roman', name: 'Roman', blurb: 'Numerals on the dial', hands: true },
    { id: 'digital', name: 'Digital', blurb: 'A lit LED panel', build: buildDigital, paint: paintDigital },
    { id: 'nixie', name: 'Nixie', blurb: 'Valve tubes aglow', build: buildNixie, paint: paintNixie },
    { id: 'rings', name: 'Rings', blurb: 'Rotating number rings', build: buildRings, paint: paintRings, smooth: true },
    { id: 'bands', name: 'Bands', blurb: 'Sliding number bands', build: buildBands, paint: paintBands },
    { id: 'words', name: 'Words', blurb: 'The time, spelled out', build: buildWords, paint: paintWords },
    { id: 'arcs', name: 'Arcs', blurb: 'Three running arcs', build: buildArcs, paint: paintArcs, smooth: true },
    { id: 'sundial', name: 'Sundial', blurb: 'A shadow on a plate', build: buildSundial, paint: paintSundial }
];
const BY_ID = new Map(FACES.map(f => [f.id, f]));

export function currentFace() {
    const v = store.getPreference('clock.face');
    return BY_ID.has(v) ? v : 'original';
}
export function setFace(id) { if (BY_ID.has(id)) store.setPreference('clock.face', id); }

/* the little preview drawn next to each option in Settings */
export function faceThumb(id) {
    const s = document.createElementNS(NS, 'svg');
    s.setAttribute('class', 'fr-cf-thumb');
    s.setAttribute('viewBox', '0 0 24 24');
    s.setAttribute('fill', 'none');
    s.setAttribute('stroke', 'currentColor');
    s.setAttribute('stroke-width', '1.6');
    s.setAttribute('stroke-linecap', 'round');
    s.setAttribute('stroke-linejoin', 'round');
    s.setAttribute('aria-hidden', 'true');
    s.innerHTML = THUMB[id] || '';
    return s;
}

let host = null, face = 'original';
const layers = new Map();
const clockNow = () => (window.FR && FR.clock) ? FR.clock.zoned(new Date()) : new Date();

/* a face's DOM is built the first time it is picked, not on load */
function layerFor(id) {
    const def = BY_ID.get(id);
    if (!def || !def.build || !host) return null;
    if (!layers.has(id)) layers.set(id, def.build(host));
    return layers.get(id);
}

function apply() {
    face = currentFace();
    const b = document.body.classList;
    FACES.forEach(f => b.toggle('fr-face-' + f.id, f.id === face));
    const node = layerFor(face);
    const def = BY_ID.get(face);
    if (node && def.paint) def.paint(node, clockNow());
    layers.forEach((n, id) => n.classList.toggle('on', id === face));
    document.querySelectorAll('[data-fr-face]').forEach(btn => {
        const on = btn.dataset.frFace === face;
        btn.classList.toggle('on', on);
        btn.setAttribute('aria-checked', on ? 'true' : 'false');
    });
}

/* throw the built layers away so the next apply() makes them again */
function rebuild() {
    layers.forEach(node => node.remove());
    layers.clear();
    apply();
}

export const clockFace = {
    /* every animation frame; answers whether the inline code should move the hands */
    frame(now) {
        const def = BY_ID.get(face);
        if (def && def.smooth) {
            const n = layers.get(face);
            if (n) def.paint(n, now);
        }
        return !!(def && def.hands);
    },
    /* once a second */
    paint(now) {
        const def = BY_ID.get(face);
        if (!def || !def.paint || def.smooth) return;
        const n = layers.get(face);
        if (n) def.paint(n, now);
    },
    hands() { const d = BY_ID.get(face); return !!(d && d.hands); },
    current: currentFace,
    set: setFace
};

export function initClockFace() {
    host = document.getElementById('clockFace');
    if (!host) return clockFace;
    const dial = host.querySelector('.clock-svg');
    if (dial && !document.getElementById('frRomanNums')) {
        const g = svg('g', { id: 'frRomanNums', 'font-family': 'Georgia, "Times New Roman", serif' });
        ['XII', 'I', 'II', 'III', 'IIII', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI'].forEach((txt, i) => {
            const a = (i * 30 - 90) * Math.PI / 180;
            g.appendChild(svg('text', {
                x: (100 + Math.cos(a) * 80).toFixed(2), y: (100 + Math.sin(a) * 80).toFixed(2),
                'text-anchor': 'middle', 'dominant-baseline': 'central',
                'font-size': i % 3 === 0 ? 15 : 11.5, fill: 'currentColor', stroke: 'none',
                opacity: i % 3 === 0 ? 1 : .72
            }, txt));
        });
        dial.appendChild(g);
    }
    apply();
    store.addEventListener('pref', e => {
        const k = e.detail.key;
        // 24h <-> 12h changes what the hour-list faces are made of, not just what they say
        if (k === 'clock.format' || k === '*') { rebuild(); return; }
        if (k === 'clock.face') apply();
        else if (k.startsWith('clock.')) clockFace.paint(clockNow());
    });
    return clockFace;
}
