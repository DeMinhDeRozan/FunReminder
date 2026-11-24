/* Sound for the new features: short effects + optional ambient beds.
 * Everything is synthesised with WebAudio (original sounds, no files to load).
 * Nothing plays before the first user gesture (browser autoplay rules), and
 * ambient never starts by itself: the user turns it on.
 * The original app's alarm / tick / warning sounds keep their own player. */
import { store } from '../storage/localDataManager.js';

let ctx = null, master = null, sfxBus = null, ambBus = null, unlocked = false;
let ambient = null, ambientKind = 'off';
const lastPlayed = new Map();

function ensure() {
    if (ctx) return ctx;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
    master = ctx.createGain(); master.connect(ctx.destination);
    sfxBus = ctx.createGain(); sfxBus.connect(master);
    ambBus = ctx.createGain(); ambBus.gain.value = 0; ambBus.connect(master);
    applyVolumes();
    return ctx;
}
function applyVolumes() {
    if (!ctx) return;
    const on = store.getPreference('sound.enabled');
    const t = ctx.currentTime;
    master.gain.setTargetAtTime(on ? store.getPreference('sound.volume') : 0, t, 0.05);
    sfxBus.gain.setTargetAtTime(store.getPreference('sound.effects') ? 1 : 0, t, 0.05);
    ambBus.gain.setTargetAtTime(ambient ? store.getPreference('sound.ambientVolume') : 0, t, 0.4);
}

/* first click / key unlocks audio for the whole session */
function unlock() {
    if (unlocked) return;
    unlocked = true;
    const c = ensure();
    if (c && c.state === 'suspended') c.resume().catch(() => {});
    if (pendingAmbient) { const k = pendingAmbient; pendingAmbient = null; setAmbient(k); }
}
['pointerdown', 'keydown', 'touchstart'].forEach(ev => window.addEventListener(ev, unlock, { once: false, passive: true, capture: true }));

/* ---------- synth building blocks ---------- */
function tone(type, f0, f1, t, dur, peak, attack = 0.005, bus = sfxBus) {
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type; o.frequency.setValueAtTime(f0, t);
    if (f1 && f1 !== f0) o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(peak, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(bus); o.start(t); o.stop(t + dur + 0.05);
}
function bell(f, t, peak = 0.25, decay = 1.2) {
    [[1, 1], [2.01, 0.45], [2.76, 0.25], [5.4, 0.08]].forEach(([m, a]) => tone('sine', f * m, 0, t, decay / Math.sqrt(m), peak * a, 0.003));
}
let noiseBuf = null;
function noiseBuffer() {
    if (noiseBuf) return noiseBuf;
    noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    return noiseBuf;
}
function brownBuffer() {
    const b = ctx.createBuffer(1, ctx.sampleRate * 4, ctx.sampleRate), d = b.getChannelData(0);
    let last = 0;
    for (let i = 0; i < d.length; i++) { last = (last + 0.02 * (Math.random() * 2 - 1)) / 1.02; d[i] = last * 3.5; }
    return b;
}

const EFFECTS = {
    tap(t) { tone('sine', 1200, 700, t, 0.05, 0.08); },
    complete(t) { bell(880, t, 0.18, 0.6); bell(1318.5, t + 0.09, 0.16, 0.8); },
    undo(t) { tone('triangle', 520, 380, t, 0.12, 0.08); },
    notify(t) { bell(1046.5, t, 0.22, 1.4); bell(784, t + 0.22, 0.2, 1.6); },
    achievement(t) { [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => bell(f, t + i * 0.09, 0.15, 1.1)); tone('triangle', 2093, 0, t + 0.36, 0.5, 0.04); },
    focusStart(t) { bell(659.25, t, 0.16, 0.9); },
    focusEnd(t) { [784, 659.25, 784].forEach((f, i) => bell(f, t + i * 0.32, 0.2, 1.4)); },
    breakEnd(t) { bell(523.25, t, 0.18, 1.0); bell(659.25, t + 0.2, 0.18, 1.2); }
};

export function playSfx(name) {
    if (!unlocked || !store.getPreference('sound.enabled') || !store.getPreference('sound.effects')) return;
    const c = ensure(); if (!c || !EFFECTS[name]) return;
    const now = performance.now();
    if (now - (lastPlayed.get(name) || 0) < 150) return;   // no machine-gun stacking
    lastPlayed.set(name, now);
    if (c.state === 'suspended') c.resume().catch(() => {});
    try { EFFECTS[name](c.currentTime + 0.01); } catch (e) {}
}

/* ---------- ambient beds ---------- */
export const AMBIENTS = {
    ocean: 'Ocean waves', wind: 'Desert wind', rain: 'Rain', meadow: 'Meadow birds', crickets: 'Night crickets', brown: 'Soft hum'
};

function buildAmbient(kind) {
    const out = ctx.createGain(); out.gain.value = 1; out.connect(ambBus);
    const nodes = [], timers = [];
    const src = ctx.createBufferSource();
    src.buffer = kind === 'brown' ? brownBuffer() : noiseBuffer(); src.loop = true;
    const f = ctx.createBiquadFilter(), g = ctx.createGain();
    src.connect(f).connect(g).connect(out);
    nodes.push(src, f, g);
    const lfo = (target, freq, depth, base) => {
        const o = ctx.createOscillator(), og = ctx.createGain();
        o.frequency.value = freq; og.gain.value = depth; target.value = base;
        o.connect(og).connect(target); o.start(); nodes.push(o, og);
    };
    if (kind === 'ocean') { f.type = 'lowpass'; lfo(f.frequency, 0.09, 500, 750); lfo(g.gain, 0.09, 0.35, 0.5); }
    else if (kind === 'wind') { f.type = 'bandpass'; f.Q.value = 0.8; lfo(f.frequency, 0.05, 300, 520); lfo(g.gain, 0.07, 0.25, 0.45); }
    else if (kind === 'rain') { f.type = 'highpass'; f.frequency.value = 900; g.gain.value = 0.32; }
    else if (kind === 'brown') { f.type = 'lowpass'; f.frequency.value = 420; g.gain.value = 0.6; }
    else { f.type = 'bandpass'; f.frequency.value = 900; f.Q.value = 0.4; g.gain.value = kind === 'meadow' ? 0.06 : 0.04; }

    // sparse events on top of the bed
    const schedule = (fn, min, max) => {
        const tick = () => { if (!ambient || ambient.kind !== kind) return; try { fn(ctx.currentTime + 0.05); } catch (e) {} timers.push(setTimeout(tick, min + Math.random() * (max - min))); };
        timers.push(setTimeout(tick, min));
    };
    const bus = out;
    if (kind === 'rain') schedule(t => { for (let i = 0; i < 4; i++) tone('sine', 1800 + Math.random() * 2200, 600, t + Math.random() * 0.4, 0.03, 0.02, 0.002, bus); }, 120, 380);
    if (kind === 'meadow') schedule(t => {
        const base = 2400 + Math.random() * 1600, n = 2 + Math.floor(Math.random() * 4);
        for (let i = 0; i < n; i++) tone('sine', base, base * (1.15 + Math.random() * 0.3), t + i * 0.11, 0.08, 0.035, 0.004, bus);
    }, 1800, 6500);
    if (kind === 'crickets') schedule(t => {
        for (let i = 0; i < 3; i++) tone('sine', 4300, 4250, t + i * 0.07, 0.04, 0.025, 0.003, bus);
    }, 600, 1400);
    src.start();
    return { kind, out, nodes, timers };
}

let pendingAmbient = null;
export function setAmbient(kind) {
    if (kind === 'auto') kind = (window.FR && FR.sceneAmbient && FR.sceneAmbient()) || 'brown';
    if (!AMBIENTS[kind]) kind = 'off';
    if (kind === ambientKind && (ambient || kind === 'off')) return;
    if (!unlocked) { pendingAmbient = kind === 'off' ? null : kind; ambientKind = kind; return; }
    const c = ensure(); if (!c) return;
    const old = ambient;
    ambient = null; ambientKind = kind;
    if (old) {
        old.out.gain.setTargetAtTime(0, c.currentTime, 0.3);
        old.timers.forEach(clearTimeout);
        setTimeout(() => old.nodes.forEach(n => { try { n.stop && n.stop(); n.disconnect(); } catch (e) {} }), 1500);
    }
    if (kind !== 'off') ambient = buildAmbient(kind);
    applyVolumes();
}
export function currentAmbient() { return ambient ? ambient.kind : 'off'; }

export function initAudio() {
    store.addEventListener('pref', e => {
        const k = e.detail.key;
        if (k === '*' || k.startsWith('sound.')) applyVolumes();
        if (k === '*' || k === 'sound.ambient' || (k === 'scene' && store.getPreference('sound.ambient') === 'auto')) {
            ambientKind = null; setAmbient(store.getPreference('sound.ambient'));
        }
    });
    // pause ambient in a hidden tab only if the user is not focusing (focus sessions keep their sound)
    setAmbient(store.getPreference('sound.ambient'));
}
