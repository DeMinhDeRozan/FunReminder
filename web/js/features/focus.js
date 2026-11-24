/* Focus / Pomodoro timer.
 * Reliability: the timer stores WHEN it started and how much ran before a pause,
 * then derives the remaining time from Date.now(). Background tabs throttle
 * setInterval, laptops sleep, pages refresh: none of that makes it drift.
 * Limit (honest): a web page can't ring when the browser is fully closed. If the
 * session ended while closed, it is recorded on the next visit with its real end time. */
import { store } from '../storage/localDataManager.js';
import { h, iconEl, toast, section, fill } from '../core/ui.js';
import { icon } from '../core/icons.js';
import { dayKey, fmtMinutes, MIN } from '../core/time.js';
import { playSfx, setAmbient, currentAmbient, AMBIENTS } from '../audio/audioManager.js';

const MODES = { focus: 'Focus', short: 'Short break', long: 'Long break' };
const emit = (type, detail) => window.dispatchEvent(new CustomEvent(type, { detail }));

function presetMs(mode) {
    const m = { focus: 'focus.minutes', short: 'focus.short', long: 'focus.long' }[mode];
    return Math.max(1, Math.min(180, store.getPreference(m))) * MIN;
}
function fresh(mode = 'focus', cycle = 0) {
    return { mode, durationMs: presetMs(mode), startedAt: null, elapsedBefore: 0, running: false, sessionStart: null, cycle, custom: false };
}

/* A corrupted or half-written state must never freeze the timer: anything that
 * doesn't look like a timer is replaced by a clean one. */
function loadState() {
    const clean = fresh();
    const s = store.getState('focus', clean);
    const num = v => typeof v === 'number' && isFinite(v);
    const ok = s && typeof s === 'object' && (s.mode in MODES) &&
        num(s.durationMs) && s.durationMs > 0 && num(s.elapsedBefore) && s.elapsedBefore >= 0 &&
        (s.startedAt == null || num(s.startedAt)) && (s.sessionStart == null || num(s.sessionStart));
    return ok ? s : clean;
}

let S = loadState();
const listeners = new Set();
let endTimer = null, pollTimer = null;

function save() { store.setState('focus', S); listeners.forEach(fn => { try { fn(S); } catch (e) {} }); }
export function elapsed(now = Date.now()) { return S.elapsedBefore + (S.running && S.startedAt ? now - S.startedAt : 0); }
export function remaining(now = Date.now()) { return Math.max(0, S.durationMs - elapsed(now)); }
export function state() { return S; }
export function onTimer(fn) { listeners.add(fn); return () => listeners.delete(fn); }

function armEnd() {
    clearTimeout(endTimer); clearInterval(pollTimer);
    if (!S.running) return;
    endTimer = setTimeout(checkEnd, remaining() + 30);
    pollTimer = setInterval(checkEnd, 1000);     // safety net for throttled timers
}

export function start() {
    if (S.running) return;
    if (remaining() <= 0) S = fresh(S.mode, S.cycle);
    S.running = true; S.startedAt = Date.now();
    if (!S.sessionStart) S.sessionStart = S.startedAt;
    save(); armEnd();
    playSfx(S.mode === 'focus' ? 'focusStart' : 'tap');
}
export function pause() {
    if (!S.running) return;
    S.elapsedBefore = elapsed(); S.running = false; S.startedAt = null;
    save(); armEnd();
}
export function reset() { S = fresh(S.mode, S.cycle); save(); armEnd(); }
export function setMode(mode, minutes) {
    S = fresh(mode, S.cycle);
    if (minutes) { S.durationMs = Math.max(1, Math.min(180, minutes)) * MIN; S.custom = true; }
    save(); armEnd();
}
export function skip() { S = fresh(nextMode(false), S.mode === 'focus' ? S.cycle : S.cycle); save(); armEnd(); }

function nextMode(completedFocus) {
    if (S.mode !== 'focus') return 'focus';
    const every = Math.max(2, store.getPreference('focus.longEvery'));
    return completedFocus && (S.cycle + 1) % every === 0 ? 'long' : 'short';
}

async function checkEnd() {
    if (!S.running || remaining() > 0) return;
    const endedAt = S.startedAt + (S.durationMs - S.elapsedBefore);   // the real end, even if we notice late
    const was = { ...S };
    const late = Date.now() - endedAt > 5000;
    clearTimeout(endTimer); clearInterval(pollTimer);
    if (was.mode === 'focus') {
        const session = { startedAt: was.sessionStart || endedAt - was.durationMs, endedAt, minutes: Math.round(was.durationMs / MIN), dayKey: dayKey(new Date(endedAt)), hour: new Date(endedAt).getHours() };
        try { await store.saveFocusSession(session); } catch (e) { console.warn('[focus] save failed', e); }
        const next = nextMode(true);
        S = fresh(next, was.cycle + 1);
        emit('fr:focus-completed', { session });
        playSfx('focusEnd');
        notify('Focus session done', `${session.minutes} min in the bag. Time for a ${MODES[next].toLowerCase()}.`);
        toast(late ? `A ${session.minutes}-min focus session finished while you were away. Logged.` : `Focus done: ${session.minutes} min. Take a ${MODES[next].toLowerCase()}.`, { iconName: 'focus' });
        if (store.getPreference('focus.autoBreak') && !late) { save(); start(); return; }
    } else {
        S = fresh('focus', was.cycle);
        playSfx('breakEnd');
        notify('Break over', 'Ready for another focus session?');
        if (!late) toast('Break over. Back to it?', { iconName: 'focus', actions: [{ label: 'Start focus', run: start }] });
    }
    save(); armEnd();
}

async function notify(title, body) {
    if (!document.hidden || !('Notification' in window) || Notification.permission !== 'granted') return;
    try {
        const reg = navigator.serviceWorker && await navigator.serviceWorker.getRegistration();
        if (reg) reg.showNotification(title, { body, tag: 'fr-focus', icon: 'icons/icon-192.png', data: { url: './' } });
        else new Notification(title, { body, tag: 'fr-focus' });
    } catch (e) {}
}

export function initFocus() {
    // a stale state from an older preset is fine; a running one resumes / completes
    if (S.running) { armEnd(); checkEnd(); }
    document.addEventListener('visibilitychange', () => { if (!document.hidden) checkEnd(); });
    store.addEventListener('pref', e => {
        if (!S.running && S.elapsedBefore === 0 && !S.custom && (e.detail.key.startsWith('focus.') || e.detail.key === '*')) { S.durationMs = presetMs(S.mode); save(); }
    });
}

/* ================================================================ UI */
const pad = n => String(n).padStart(2, '0');
function fmt(ms) { const s = Math.ceil(ms / 1000); return pad(Math.floor(s / 60)) + ':' + pad(s % 60); }

function timerView({ big = false } = {}) {
    const R = 120, C = 2 * Math.PI * R;
    const ring = h('div', { class: 'fr-ring', html:
        `<svg viewBox="0 0 280 280" aria-hidden="true"><circle cx="140" cy="140" r="${R}" class="track"/><circle cx="140" cy="140" r="${R}" class="bar" stroke-dasharray="${C.toFixed(1)}" transform="rotate(-90 140 140)"/></svg>` });
    const bar = ring.querySelector('.bar');
    const time = h('div', { class: 'fr-timer-time', role: 'timer', 'aria-live': 'off' });
    const label = h('div', { class: 'fr-timer-mode' });
    ring.appendChild(h('div', { class: 'fr-ring-center' }, label, time));

    const playBtn = h('button', { class: 'fr-btn primary round lg', type: 'button', onclick: () => (S.running ? pause() : start()) });
    const controls = h('div', { class: 'fr-timer-controls' },
        h('button', { class: 'fr-icon-btn', type: 'button', 'aria-label': 'Reset', title: 'Reset', html: icon('reset'), onclick: reset }),
        playBtn,
        h('button', { class: 'fr-icon-btn', type: 'button', 'aria-label': 'Skip to next session', title: 'Skip', html: icon('skip'), onclick: skip }));

    const chips = h('div', { class: 'fr-seg' }, ...Object.keys(MODES).map(m => h('button', {
        class: 'fr-seg-btn', type: 'button', dataset: { mode: m }, onclick: () => setMode(m)
    }, MODES[m] + ' ' + Math.round(presetMs(m) / MIN))));
    const customIn = h('input', { class: 'fr-input fr-num', type: 'number', min: 1, max: 180, placeholder: 'min', 'aria-label': 'Custom minutes' });
    const custom = h('form', { class: 'fr-inline', onsubmit: e => { e.preventDefault(); const v = +customIn.value; if (v >= 1 && v <= 180) { setMode('focus', v); customIn.value = ''; } } },
        h('span', { class: 'fr-hint' }, 'Custom focus'), customIn, h('button', { class: 'fr-btn', type: 'submit' }, 'Set'));

    const root = h('div', { class: 'fr-timer' + (big ? ' big' : '') }, ring, controls, chips, custom);
    let raf = 0, lastText = '';
    const paint = () => {
        const rem = remaining(), frac = 1 - rem / S.durationMs;
        const txt = fmt(rem);
        if (txt !== lastText) { time.textContent = txt; lastText = txt; }
        bar.style.strokeDashoffset = (C * (1 - frac)).toFixed(1);
        label.textContent = (S.custom ? 'Custom focus' : MODES[S.mode]) + (S.running ? '' : rem < S.durationMs ? ' · paused' : '');
        playBtn.innerHTML = icon(S.running ? 'pause' : 'play') + '<span>' + (S.running ? 'Pause' : rem < S.durationMs ? 'Resume' : 'Start') + '</span>';
        root.dataset.mode = S.mode;
        chips.querySelectorAll('button').forEach(b => b.classList.toggle('on', b.dataset.mode === S.mode && !S.custom));
    };
    // repaint once a second while running; no work at all while paused
    const loop = () => { paint(); raf = S.running ? setTimeout(loop, 1000 - (Date.now() % 1000) + 5) : 0; };
    const off = onTimer(() => { clearTimeout(raf); loop(); });
    loop();
    root._cleanup = () => { off(); clearTimeout(raf); };
    return root;
}

async function focusStats() {
    const sessions = await store.getFocusSessions();
    const today = dayKey();
    const weekAgo = Date.now() - 7 * 24 * 3600 * 1000;
    return {
        todayCount: sessions.filter(s => s.dayKey === today).length,
        todayMin: sessions.filter(s => s.dayKey === today).reduce((a, s) => a + s.minutes, 0),
        weekMin: sessions.filter(s => s.endedAt >= weekAgo).reduce((a, s) => a + s.minutes, 0),
        total: sessions.length,
        totalMin: sessions.reduce((a, s) => a + s.minutes, 0)
    };
}

function ambientPicker() {
    const sel = h('select', { class: 'fr-input', 'aria-label': 'Ambient sound', onchange: e => store.setPreference('sound.ambient', e.target.value) },
        h('option', { value: 'off' }, 'Ambient: off'), h('option', { value: 'auto' }, 'Ambient: match scene'),
        ...Object.entries(AMBIENTS).map(([k, v]) => h('option', { value: k }, v)));
    sel.value = store.getPreference('sound.ambient');
    return sel;
}

export function renderFocusPanel(body) {
    const tv = timerView();
    const stats = h('div', { class: 'fr-kpis three' });
    const drawStats = async () => {
        const s = await focusStats();
        fill(stats, 
            h('div', { class: 'fr-kpi' }, h('b', null, s.todayCount), h('span', null, 'sessions today')),
            h('div', { class: 'fr-kpi' }, h('b', null, fmtMinutes(s.todayMin)), h('span', null, 'focus today')),
            h('div', { class: 'fr-kpi' }, h('b', null, fmtMinutes(s.weekMin)), h('span', null, 'last 7 days')));
    };
    drawStats();
    const onDone = () => drawStats();
    window.addEventListener('fr:focus-completed', onDone);
    body.append(tv,
        h('div', { class: 'fr-inline center wrap' },
            h('button', { class: 'fr-btn primary', type: 'button', onclick: openFocusMode }, iconEl('expand'), 'Focus mode'),
            ambientPicker()),
        section('Your focus', stats),
        h('p', { class: 'fr-note' }, 'The timer keeps time even if this tab sleeps or reloads. It can only ring while FunReminder is open in a tab.'));
    return () => { tv._cleanup(); window.removeEventListener('fr:focus-completed', onDone); };
}

/* ---------- full-screen focus mode ---------- */
let overlay = null;
export function openFocusMode() {
    if (overlay) return;
    if (window.FR && FR.closePanel) FR.closePanel();
    const tv = timerView({ big: true });
    const exit = () => closeFocusMode();
    const fsBtn = h('button', { class: 'fr-icon-btn', type: 'button', 'aria-label': 'Full screen', title: 'Full screen', html: icon('expand'),
        onclick: () => { if (document.fullscreenElement) document.exitFullscreen(); else if (overlay.requestFullscreen) overlay.requestFullscreen().catch(() => {}); } });
    overlay = h('div', { class: 'fr-focus', role: 'dialog', 'aria-modal': 'true', 'aria-label': 'Focus mode' },
        h('div', { class: 'fr-focus-top' }, ambientPicker(), fsBtn,
            h('button', { class: 'fr-btn', type: 'button', onclick: exit }, iconEl('close'), 'Exit')),
        tv,
        h('p', { class: 'fr-focus-quote' }, pickQuote()));
    overlay._cleanup = tv._cleanup;
    overlay._key = e => { if (e.key === 'Escape' && !document.fullscreenElement) exit(); };
    document.addEventListener('keydown', overlay._key);
    document.body.appendChild(overlay);
    document.body.classList.toggle('fr-focus-dim', store.getPreference('focus.dim'));
    document.body.classList.add('fr-focus-on');
    requestAnimationFrame(() => overlay.classList.add('in'));
    overlay.querySelector('.fr-btn.primary').focus();
}
export function closeFocusMode() {
    if (!overlay) return;
    const o = overlay; overlay = null;
    if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
    document.removeEventListener('keydown', o._key);
    o._cleanup();
    document.body.classList.remove('fr-focus-on', 'fr-focus-dim');
    o.classList.remove('in');
    setTimeout(() => o.remove(), 300);
}
const QUOTES = ['One thing at a time, mate.', "Phone down. Kangaroo's watching.", 'Small steps. Big hops.', 'Do the hard bit first.', 'You got this, legend.'];
function pickQuote() { return QUOTES[Math.floor(Math.random() * QUOTES.length)]; }
export { currentAmbient };
