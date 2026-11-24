/* Shared drawing primitives for the scenes.
 * A scene is a 1600x1000 "stage" of small <svg> layers, scaled to cover the
 * screen. Only layers that move get an animation class, and each one is its own
 * composited element, so the static parts are painted once. */
/* deterministic random so a scene looks the same on every visit */
export function rng(seed) {
    let s = seed >>> 0;
    return () => { s = (s + 0x6D2B79F5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
export const W = 1600, H = 1000;

/* a periodic wave band: repeats every `period` so translating by -period loops seamlessly */
export function waveBand(y, amp, period, bottom, phase = 0) {
    let d = `M${-period + phase},${y}`;
    for (let x = -period; x < W + period * 2; x += period) {
        d += ` q${period / 4},${-amp} ${period / 2},0 t${period / 2},0`;
    }
    return d + ` L${W + period * 2},${bottom} L${-period},${bottom} Z`;
}
/* clouds use a gradient id set per scene (see cloudDefs) */
export let CL = 'cl';
export function setCloudId(id) { CL = id; }
export function cloud(x, y, s, o = 0.9) {
    const f = `url(#${CL})`;
    return `<g transform="translate(${x},${y}) scale(${s})" opacity="${o}">` +
        `<ellipse cx="0" cy="0" rx="120" ry="34" fill="${f}"/>` +
        `<ellipse cx="-50" cy="-18" rx="60" ry="38" fill="${f}"/>` +
        `<ellipse cx="30" cy="-30" rx="72" ry="48" fill="${f}"/>` +
        `<ellipse cx="85" cy="-8" rx="50" ry="30" fill="${f}"/></g>`;
}
export function cloudDefs(id, top = '#FFFFFF', bot = '#E8EEF2') {
    return `<linearGradient id="${id}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${top}"/><stop offset="1" stop-color="${bot}"/></linearGradient>`;
}
export function glow(id, color) {
    return `<radialGradient id="${id}"><stop offset="0" stop-color="${color}" stop-opacity=".95"/><stop offset=".25" stop-color="${color}" stop-opacity=".45"/><stop offset="1" stop-color="${color}" stop-opacity="0"/></radialGradient>`;
}

export function L(cls, x, y, w, ht, inner, style = '') {
    return `<svg class="fr-layer ${cls}" style="left:${x}px;top:${y}px;width:${w}px;height:${ht}px;${style}" viewBox="${x} ${y} ${w} ${ht}" preserveAspectRatio="none" xmlns="http://www.w3.org/2000/svg">${inner}</svg>`;
}
export const defs = d => `<defs>${d}</defs>`;

