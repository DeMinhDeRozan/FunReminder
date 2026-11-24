/* Live backgrounds.
 * Each scene is an SVG drawn in code (0 downloads, ~5-20 KB of DOM), animated
 * with CSS transform/opacity only (see .fr-scene rules in css/app.css).
 * Motion stops when reduced motion is on, when the tab is hidden, and in the
 * picker thumbnails. "original" keeps the bedside-clock enamel with no scene. */
import { store } from '../storage/localDataManager.js';
import { W, H, L, defs, rng, glow, cloud, cloudDefs, waveBand, setCloudId } from './sceneKit.js';
import { lakeside, lakesideTick } from './sceneLakeside.js';
import { fireflies } from './sceneFireflies.js';
import { GIF_SCENES } from './sceneGifs.js';

/* ---------------------------------------------------------------- beach */
function beach(p) {
    const r = rng(7), I = n => p + n, U = n => `url(#${p + n})`;
    let glitter = ['', '', ''];
    for (let i = 0; i < 26; i++) {
        const x = 1060 + (r() - 0.5) * 360 * (0.4 + i / 26), y = 590 + i * 6.5 + r() * 6, w = 10 + r() * 34;
        glitter[i % 3] += `<rect x="${x.toFixed(0)}" y="${y.toFixed(0)}" width="${w.toFixed(0)}" height="2" rx="1" fill="#FFF6DC"/>`;
    }
    const fronds = [[-150, 40, 0.95], [-110, -40, 1], [-40, -110, 0.9], [30, -120, 0.85], [100, -50, 1], [150, 30, 0.95], [60, 70, 0.8], [-70, 80, 0.8]]
        .map(([dx, dy, s], i) => {
            const len = 230 * s, ang = Math.atan2(dy, dx), cx = Math.cos(ang), cy = Math.sin(ang);
            const ex = cx * len, ey = cy * len + 60 * s, mx = cx * len * 0.5 - cy * 30, my = cy * len * 0.5 - 40 * s;
            return `<path d="M0,0 Q${mx.toFixed(1)},${my.toFixed(1)} ${ex.toFixed(1)},${ey.toFixed(1)} Q${(mx * 0.9 + 14).toFixed(1)},${(my + 40).toFixed(1)} 0,10 Z" fill="${U('leaf' + (i % 2))}" stroke="#1F3F26" stroke-width="1.2"/>` +
                `<path d="M0,4 Q${mx.toFixed(1)},${(my + 12).toFixed(1)} ${ex.toFixed(1)},${ey.toFixed(1)}" fill="none" stroke="#244A2C" stroke-width="2" opacity=".6"/>`;
        }).join('');
    const clouds1 = cloud(200, 170, 1.1) + cloud(760, 110, 0.8, 0.8) + cloud(1350, 200, 1, 0.85);
    const clouds2 = cloud(480, 300, 0.6, 0.7) + cloud(1100, 360, 0.55, 0.65);
    return [
        L('', 0, 0, W, H, defs(`
 <linearGradient id="${I('sky')}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#6FA6CF"/><stop offset=".55" stop-color="#B9D5E2"/><stop offset="1" stop-color="#F4DCB8"/></linearGradient>
 <linearGradient id="${I('sea')}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#3D7FA3"/><stop offset=".55" stop-color="#3A9DB0"/><stop offset="1" stop-color="#6CC7C4"/></linearGradient>
 <linearGradient id="${I('sand')}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#E7CFA0"/><stop offset="1" stop-color="#D2B07C"/></linearGradient>
 <linearGradient id="${I('trunk')}" x1="0" x2="1"><stop offset="0" stop-color="#6B4E33"/><stop offset=".5" stop-color="#9A7650"/><stop offset="1" stop-color="#5A4029"/></linearGradient>
 <linearGradient id="${I('leaf0')}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#3F7D46"/><stop offset="1" stop-color="#24502C"/></linearGradient>
 <linearGradient id="${I('leaf1')}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#4E9152"/><stop offset="1" stop-color="#2C5E33"/></linearGradient>
 ${glow(I('sun'), '#FFF1CF')} ${cloudDefs(I('cl'))}`) +
            `<rect width="${W}" height="${H}" fill="${U('sky')}"/>
<path d="M0,585 C120,560 260,548 380,566 C430,574 470,585 520,585 Z" fill="#6E9AAE" opacity=".8"/>
<rect y="580" width="${W}" height="420" fill="${U('sea')}"/>`),
        L('fr-breathe', 800, 0, 640, 620, `<circle cx="1120" cy="300" r="320" fill="${U('sun')}"/><circle cx="1120" cy="300" r="56" fill="#FFF8E6"/>`),
        L('fr-drift-slow', 0, 0, W * 2, 300, clouds1 + `<g transform="translate(${W},0)">${clouds1}</g>`),
        L('fr-drift', 0, 220, W * 2, 200, clouds2 + `<g transform="translate(${W},0)">${clouds2}</g>`),
        ...glitter.map((g, i) => L('fr-twinkle k' + i, 860, 585, 420, 190, g)),
        L('fr-wave', -320, 625, W + 640, 220, `<path d="${waveBand(640, 7, 320, 840)}" fill="#3F97AE" opacity=".55"/>`, '--p:-320px;--d:11s'),
        L('fr-wave', -400, 685, W + 800, 160, `<path d="${waveBand(700, 9, 400, 840, 60)}" fill="#46AAB8" opacity=".6"/>`, '--p:-400px;--d:15s'),
        L('fr-wave', -480, 735, W + 960, 90, `<path d="${waveBand(752, 12, 480, 830, 120)}" fill="#5CC0C2" opacity=".75"/><path d="${waveBand(752, 12, 480, 760, 120).replace(/ L.*$/, '')}" fill="none" stroke="#F2FBF8" stroke-width="3" opacity=".7"/>`, '--p:-480px;--d:19s'),
        L('fr-surf', -20, 790, W + 40, 44, `<path d="M-20,812 C200,796 420,820 640,806 C860,792 1080,818 1300,804 C1440,796 1560,808 1640,804 L1640,830 L-20,830 Z" fill="#F4FBF7" opacity=".75"/>`),
        L('', -20, 420, W + 40, 580, `<path d="M-20,816 C260,806 520,826 820,814 C1100,804 1360,822 1640,812 L1640,1000 L-20,1000 Z" fill="#CDB287"/>
<path d="M-20,840 C300,826 640,850 960,836 C1240,826 1460,842 1640,834 L1640,1000 L-20,1000 Z" fill="${U('sand')}"/>
<path d="M-20,872 C360,858 760,880 1160,866 C1400,858 1540,866 1640,864" fill="none" stroke="#F1DDB4" stroke-width="2" opacity=".6"/>
<ellipse cx="1430" cy="1012" rx="170" ry="26" fill="#B79766" opacity=".55"/>
<g transform="translate(1330,430)"><path d="M90,600 C70,450 40,260 0,0 L18,0 C64,250 100,440 128,600 Z" fill="${U('trunk')}"/>
<path d="M10,60 h22 M20,140 h28 M34,230 h30 M48,320 h34 M62,410 h36 M74,500 h40" stroke="#4A3422" stroke-width="3" opacity=".5"/></g>`),
        L('fr-palm', 1060, 180, 540, 420, `<g transform="translate(1330,430)">${fronds}<circle r="12" fill="#5B4127"/></g>`, 'transform-origin:270px 250px')
    ].join('');
}

/* ---------------------------------------------------------------- desert */
function desert(p) {
    const r = rng(11), I = n => p + n, U = n => `url(#${p + n})`;
    const streaks = ['', '', ''];
    for (let i = 0; i < 21; i++) {
        const y = 650 + r() * 300, x = r() * W, w = 40 + r() * 120;
        streaks[i % 3] += `<rect x="${x.toFixed(0)}" y="${y.toFixed(0)}" width="${w.toFixed(0)}" height="${(1 + r() * 1.5).toFixed(1)}" rx="1" fill="#FFE7C2" opacity="${(0.25 + r() * 0.35).toFixed(2)}"/>`;
    }
    return [
        L('', 0, 0, W, H, defs(`
 <linearGradient id="${I('sky')}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#2E3E63"/><stop offset=".42" stop-color="#9E6A74"/><stop offset=".72" stop-color="#E7A56B"/><stop offset="1" stop-color="#F6C98A"/></linearGradient>
 <linearGradient id="${I('d1')}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#C98756"/><stop offset="1" stop-color="#B07045"/></linearGradient>
 <linearGradient id="${I('d2')}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#E0A066"/><stop offset="1" stop-color="#C7834F"/></linearGradient>
 <linearGradient id="${I('d3')}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#F0BC7E"/><stop offset="1" stop-color="#D99C60"/></linearGradient>
 <linearGradient id="${I('haze')}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#FFD9A0" stop-opacity="0"/><stop offset=".5" stop-color="#FFE0AE" stop-opacity=".55"/><stop offset="1" stop-color="#FFD9A0" stop-opacity="0"/></linearGradient>
 ${glow(I('sun'), '#FFD9A0')}`) +
            `<rect width="${W}" height="${H}" fill="${U('sky')}"/>
<circle cx="480" cy="560" r="82" fill="#FFE3B0"/>
<path d="M0,600 L120,600 L150,540 L250,536 L280,600 L760,600 L790,560 L840,556 L860,600 L1180,600 L1215,520 L1330,515 L1360,600 L1600,600 L1600,640 L0,640 Z" fill="#8E5C5C" opacity=".75"/>`),
        L('fr-breathe', 60, 140, 840, 500, `<circle cx="480" cy="560" r="420" fill="${U('sun')}"/>`),
        L('fr-haze', 0, 560, W, 90, `<rect y="570" width="${W}" height="70" fill="${U('haze')}"/>`),
        L('', 0, 590, W, 410, `<path d="M0,640 C220,600 420,610 640,650 C860,690 1100,600 1340,620 C1460,630 1540,645 1600,650 L1600,1000 L0,1000 Z" fill="${U('d1')}"/>
<path d="M640,650 C860,690 1100,600 1340,620 C1150,650 980,700 820,720 Z" fill="#9C5E3A" opacity=".45"/>
<path d="M-20,760 C200,690 430,680 700,730 C930,772 1150,700 1380,700 C1480,700 1560,712 1620,724 L1620,1000 L-20,1000 Z" fill="${U('d2')}"/>
<path d="M700,730 C930,772 1150,700 1380,700 C1180,742 1000,810 860,830 Z" fill="#A8683F" opacity=".4"/>
<path d="M-20,760 C200,690 430,680 700,730" fill="none" stroke="#FCD6A0" stroke-width="2.5" opacity=".7"/>
<path d="M-20,880 C240,800 520,800 820,850 C1080,893 1340,830 1620,830 L1620,1000 L-20,1000 Z" fill="${U('d3')}"/>
<path d="M820,850 C1080,893 1340,830 1620,830 L1620,900 C1380,880 1100,930 900,940 Z" fill="#C08048" opacity=".35"/>
<path d="M-20,880 C240,800 520,800 820,850" fill="none" stroke="#FFE2B4" stroke-width="3" opacity=".75"/>`),
        ...streaks.map((g, i) => L('fr-gust k' + i, 0, 640, W, 330, g))
    ].join('');
}

/* ---------------------------------------------------------------- grassfields */
function blade(r, x, base, hMin, hMax, wid, fill) {
    const h = hMin + r() * (hMax - hMin), bend = (r() - 0.35) * h * 0.35, w = wid * (0.6 + r() * 0.8);
    return `<path d="M${(x - w).toFixed(1)},${base.toFixed(1)} Q${(x - w * 0.2 + bend * 0.45).toFixed(1)},${(base - h * 0.55).toFixed(1)} ${(x + bend).toFixed(1)},${(base - h).toFixed(1)} Q${(x + w * 0.3 + bend * 0.45).toFixed(1)},${(base - h * 0.5).toFixed(1)} ${(x + w).toFixed(1)},${base.toFixed(1)} Z" fill="${fill}"/>`;
}
/* blades split into `groups` interleaved layers so neighbours sway out of phase */
function grassLayers(seed, base, count, hMin, hMax, wid, fills, groups, cls, y0) {
    const r = rng(seed);
    const buckets = Array.from({ length: groups }, () => '');
    for (let i = 0; i < count; i++) {
        const x = (i / count) * (W + 60) - 30 + (r() - 0.5) * 18;
        buckets[i % groups] += blade(r, x, base + r() * 14, hMin, hMax, wid, fills[Math.floor(r() * fills.length)]);
    }
    return buckets.map((b, i) => L(cls + ' v' + i, -40, y0, W + 80, H - y0 + 20, b));
}
function grass(p) {
    const r = rng(23), I = n => p + n, U = n => `url(#${p + n})`;
    let flowers = '';
    for (let i = 0; i < 26; i++) {
        const x = r() * W, y = 900 + r() * 80, c = ['#F6E27A', '#FFFFFF', '#F4C26B', '#E9A7C0'][i % 4];
        flowers += `<g transform="translate(${x.toFixed(0)},${y.toFixed(0)})"><path d="M0,0 L0,${(30 + r() * 30).toFixed(0)}" stroke="#4C8A3A" stroke-width="2"/><circle r="${(4 + r() * 3).toFixed(1)}" fill="${c}"/><circle r="1.8" fill="#C98A2E"/></g>`;
    }
    const clouds1 = cloud(520, 150, 1, 0.92) + cloud(1180, 230, 1.2, 0.9) + cloud(1500, 120, 0.7, 0.8);
    const clouds2 = cloud(860, 330, 0.55, 0.75) + cloud(150, 360, 0.5, 0.7);
    return [
        L('', 0, 0, W, H, defs(`
 <linearGradient id="${I('sky')}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#5E9BD2"/><stop offset=".6" stop-color="#AFD3EC"/><stop offset="1" stop-color="#E6F0E2"/></linearGradient>
 <linearGradient id="${I('h1')}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#9CC48F"/><stop offset="1" stop-color="#86B27A"/></linearGradient>
 <linearGradient id="${I('h2')}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#78AE5F"/><stop offset="1" stop-color="#5E9449"/></linearGradient>
 <linearGradient id="${I('h3')}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#5E9C45"/><stop offset="1" stop-color="#3F7430"/></linearGradient>
 <linearGradient id="${I('ray')}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#FFF7D6" stop-opacity=".55"/><stop offset="1" stop-color="#FFF7D6" stop-opacity="0"/></linearGradient>
 ${glow(I('sun'), '#FFF6D2')} ${cloudDefs(I('cl'))}`) +
            `<rect width="${W}" height="${H}" fill="${U('sky')}"/>
<path d="M0,640 C200,590 420,580 640,610 C860,640 1080,570 1320,580 C1450,585 1540,600 1600,610 L1600,1000 L0,1000 Z" fill="${U('h1')}"/>
<g transform="translate(1180,585)"><rect x="-6" y="-40" width="12" height="44" fill="#5B4632"/><circle cx="0" cy="-64" r="38" fill="#4F8A43"/><circle cx="-26" cy="-50" r="26" fill="#467D3B"/><circle cx="24" cy="-48" r="28" fill="#5A9850"/></g>
<path d="M-20,720 C220,670 470,680 720,720 C980,760 1220,690 1620,700 L1620,1000 L-20,1000 Z" fill="${U('h2')}"/>
<path d="M-20,810 C260,770 560,780 860,810 C1140,836 1380,790 1620,796 L1620,1000 L-20,1000 Z" fill="${U('h3')}"/>`),
        L('fr-breathe', 0, 0, 640, 530, `<circle cx="280" cy="170" r="360" fill="${U('sun')}"/><circle cx="280" cy="170" r="48" fill="#FFFBEA"/>`),
        L('fr-rays', 260, 150, 1000, 850, `<path d="M280,170 L900,1000 L640,1000 Z" fill="${U('ray')}"/><path d="M280,170 L1240,1000 L1080,1000 Z" fill="${U('ray')}" opacity=".7"/><path d="M280,170 L520,1000 L400,1000 Z" fill="${U('ray')}" opacity=".6"/>`),
        L('fr-drift-slow', 0, 40, W * 2, 260, clouds1 + `<g transform="translate(${W},0)">${clouds1}</g>`),
        L('fr-drift', 0, 260, W * 2, 160, clouds2 + `<g transform="translate(${W},0)">${clouds2}</g>`),
        ...grassLayers(31, 830, 160, 30, 60, 3, ['#4F8E3C', '#5B9B44', '#477F35'], 2, 'fr-sway far', 750),
        L('', 0, 860, W, 140, flowers),
        ...grassLayers(37, 1006, 150, 90, 190, 6, ['#3E7A2F', '#4A8C37', '#5FA246', '#356C29'], 3, 'fr-sway near', 790)
    ].join('');
}

/* ---------------------------------------------------------------- night */
function night(p) {
    const r = rng(5), I = n => p + n, U = n => `url(#${p + n})`;
    const groups = ['', '', ''];
    for (let i = 0; i < 160; i++) {
        const x = r() * W, y = r() * 620, s = r() < 0.08 ? 1.9 : 0.6 + r() * 0.9;
        groups[i % 3] += `<circle cx="${x.toFixed(0)}" cy="${y.toFixed(0)}" r="${s.toFixed(2)}" fill="#F3EEDD"/>`;
    }
    return [
        L('', 0, 0, W, H, defs(`
 <linearGradient id="${I('sky')}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#040915"/><stop offset=".55" stop-color="#0D1C36"/><stop offset="1" stop-color="#22385C"/></linearGradient>
 <linearGradient id="${I('shoot')}" x1="0" x2="1"><stop offset="0" stop-color="#FFF" stop-opacity="0"/><stop offset="1" stop-color="#FFF" stop-opacity=".9"/></linearGradient>
 ${glow(I('moon'), '#E9E4CF')}`) + `<rect width="${W}" height="${H}" fill="${U('sky')}"/>`),
        ...groups.map((g, i) => L('fr-twinkle k' + i, 0, 0, W, 640, g)),
        L('fr-breathe', 950, 0, 520, 490, `<circle cx="1210" cy="230" r="260" fill="${U('moon')}" opacity=".55"/>`),
        L('', 1150, 170, 120, 120, `<circle cx="1210" cy="230" r="44" fill="#F1ECD9"/><circle cx="1196" cy="222" r="8" fill="#DCD5BE"/><circle cx="1222" cy="244" r="5" fill="#DCD5BE"/>`),
        L('fr-shoot', 200, 60, 700, 360, `<rect x="0" y="0" width="160" height="2" rx="1" fill="${U('shoot')}" transform="translate(300,140) rotate(18)"/>`),
        L('', 0, 530, W, 470, `<path d="M0,700 L140,600 L230,650 L380,540 L520,660 L640,600 L800,690 L960,580 L1120,670 L1260,600 L1420,680 L1600,610 L1600,1000 L0,1000 Z" fill="#1B2C4C"/>
<path d="M0,780 C200,730 420,760 640,740 C900,716 1120,780 1360,750 C1480,736 1560,746 1600,750 L1600,1000 L0,1000 Z" fill="#111D36"/>
<path d="M0,880 C260,850 560,870 860,860 C1160,850 1400,880 1600,870 L1600,1000 L0,1000 Z" fill="#070D1B"/>`)
    ].join('');
}

export const SCENES = [
    { id: 'original', name: 'Original', blurb: 'Bedside clock at night', ambient: 'brown', draw: null, tone: 'dark' },
    { id: 'lakeside', name: 'Lakeside', blurb: 'Ranges and a lake, from dawn to midnight', ambient: 'crickets', draw: lakeside, tick: lakesideTick, tone: 'auto' },
    { id: 'beach', name: 'Beach', blurb: 'Waves, palms, morning sun', ambient: 'ocean', draw: beach, tone: 'light' },
    { id: 'desert', name: 'Desert', blurb: 'Dunes at golden hour', ambient: 'wind', draw: desert, tone: 'light' },
    { id: 'grass', name: 'Grassfields', blurb: 'Wind through the meadow', ambient: 'meadow', draw: grass, tone: 'light' },
    { id: 'night', name: 'Night sky', blurb: 'Stars over the ranges', ambient: 'crickets', draw: night, tone: 'dark' },
    { id: 'fireflies', name: 'Fireflies', blurb: 'Mist, moonlight and fireflies', ambient: 'crickets', draw: fireflies, tone: 'dark' },
    ...GIF_SCENES              // the GIFs in web/ASCII/ (pictures, not drawn scenes: see sceneGifs.js)
];
export const sceneById = id => SCENES.find(s => s.id === id) || SCENES[0];

let layer = null, currentId = null;

/* small = this is a picker thumbnail, so a scene may draw a cheaper version of itself */
function renderScene(s, prefix, small) {
    if (s.img) {
        // the still stands in for the animation in the picker and whenever motion is reduced;
        // it is also the <img> background, so something is on screen while a big GIF loads
        const still = small || reducedMotion();
        return `<img class="fr-photo" src="${still ? s.poster : s.img}" alt="" decoding="async" draggable="false"` +
            (small ? ' loading="lazy"' : ` style="background-image:url(${s.poster})"`) + '>';
    }
    setCloudId(prefix + 'cl');
    return `<div class="fr-stage">${s.draw(prefix, small)}</div>`;
}
/* the stage is 1600x1000 "units"; --u = px per unit so it covers the screen */
function fit() {
    if (!layer) return;
    layer.style.setProperty('--u', Math.max(innerWidth / W, innerHeight / H).toFixed(4));
}

export function reducedMotion() {
    // the app can ask for LESS motion than the device, never more (accessibility setting wins)
    if (store.getPreference('motion') === 'reduced') return true;
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

function applyMotion() {
    const still = reducedMotion();
    document.body.classList.toggle('fr-still', still);
    // a picture scene has no CSS animation to pause: swap the GIF for its still, or back
    const s = sceneById(currentId || store.getPreference('scene'));
    if (s.img && currentId) { currentId = null; applyScene(s.id); }
}

/* scenes that change with the time of day get a tick once a minute */
let cycleTimer = null;
function stopCycle() { clearInterval(cycleTimer); cycleTimer = null; }
function startCycle(scene, root) {
    stopCycle();
    if (!scene.tick) return;
    const run = () => {
        // the same wall clock the header shows, so a chosen timezone lights the right sky
        const now = (window.FR && FR.clock) ? FR.clock.zoned(new Date()) : new Date();
        try { scene.tick(root, now); } catch (e) { console.warn('[scene] cycle failed', e); }
    };
    run();
    cycleTimer = setInterval(run, 60000);
    document.addEventListener('visibilitychange', () => { if (!document.hidden) run(); });
}
/* the picker preview shows the scene as it looks right now */
export function tickThumb(scene, root) { if (scene.tick) try { scene.tick(root, new Date()); } catch (e) {} }

export function applyScene(id) {
    const s = sceneById(id);
    if (s.id === currentId) return;
    currentId = s.id;
    const b = document.body.classList;
    SCENES.forEach(x => b.remove('fr-scene-' + x.id));
    b.add('fr-scene-' + s.id);
    b.toggle('fr-has-scene', !!(s.draw || s.img));
    if (!s.draw && !s.img) { stopCycle(); layer.replaceChildren(); layer.hidden = true; return; }
    layer.hidden = false;
    const next = document.createElement('div');
    next.className = 'fr-scene-art';
    next.innerHTML = renderScene(s, 'fr' + s.id + '-');
    layer.appendChild(next);
    startCycle(s, next);
    // cross-fade: the old scene fades out underneath, then is removed
    requestAnimationFrame(() => next.classList.add('in'));
    const old = [...layer.children].filter(c => c !== next);
    setTimeout(() => old.forEach(o => o.remove()), 900);
}

/* a static mini render for the picker */
export function sceneThumb(id) {
    const s = sceneById(id);
    const el = document.createElement('div');
    el.className = 'fr-scene-thumb fr-scene-thumb-' + s.id;
    // the stage is 1600 units wide: scale it to exactly fill this thumbnail
    const fitThumb = () => { const w = el.clientWidth; if (w) el.style.setProperty('--u', (w / W).toFixed(5)); };
    if (window.ResizeObserver) new ResizeObserver(fitThumb).observe(el); else setTimeout(fitThumb, 0);
    if (s.draw || s.img) { el.innerHTML = renderScene(s, 'frt' + s.id + '-', true); tickThumb(s, el); }
    else el.innerHTML = '<svg viewBox="0 0 200 200"><circle cx="100" cy="100" r="80" fill="none" stroke="#EEE7D2" stroke-opacity=".35" stroke-width="2"/><line x1="100" y1="100" x2="100" y2="50" stroke="#EEE7D2" stroke-opacity=".5" stroke-width="4" stroke-linecap="round"/><line x1="100" y1="100" x2="135" y2="112" stroke="#EEE7D2" stroke-opacity=".5" stroke-width="3" stroke-linecap="round"/><line x1="100" y1="110" x2="100" y2="35" stroke="#D9A441" stroke-width="1.5"/></svg>';
    return el;
}

export function initScenes() {
    layer = document.createElement('div');
    layer.className = 'fr-scene';
    layer.setAttribute('aria-hidden', 'true');
    document.body.prepend(layer);
    fit();
    let rt = 0;
    window.addEventListener('resize', () => { cancelAnimationFrame(rt); rt = requestAnimationFrame(fit); });
    applyMotion();
    applyScene(store.getPreference('scene'));
    window.matchMedia('(prefers-reduced-motion: reduce)').addEventListener('change', applyMotion);
    // nothing animates in a hidden tab
    document.addEventListener('visibilitychange', () => document.body.classList.toggle('fr-hidden-tab', document.hidden));
    store.addEventListener('pref', e => {
        const k = e.detail.key;
        if (k === 'scene' || k === '*') applyScene(store.getPreference('scene'));
        if (k === 'clock.timezone') { const art = layer.querySelector('.fr-scene-art'); if (art) tickThumb(sceneById(store.getPreference('scene')), art); }
        if (k === 'motion' || k === '*') applyMotion();
        if (k === 'theme' || k === '*') document.body.classList.toggle('fr-contrast', store.getPreference('theme') === 'contrast');
    });
    document.body.classList.toggle('fr-contrast', store.getPreference('theme') === 'contrast');
}
