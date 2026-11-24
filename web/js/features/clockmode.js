/* Clock mode: the whole screen becomes a clock, with the live scene behind it.
 *
 * Each digit is a column of numbers that slides so the current one sits in the
 * middle; its neighbours stay faintly visible above and below. It follows the
 * clock settings (12/24h, seconds, timezone) and shows what's next so a phone
 * propped up on the desk is still useful.
 *
 * The big digital readout can be switched off (preference 'clock.modeDigits',
 * the button in the corner, or Settings > Clock). With it off the chosen clock
 * type - dial, nixie, words, sundial, whichever - has the screen to itself,
 * with only the date and the next line underneath it.
 */
import { store } from '../storage/localDataManager.js';
import { h, iconEl } from '../core/ui.js';
import { icon } from '../core/icons.js';
import { fmtWhen, dayKey, DAY } from '../core/time.js';
import { reducedMotion } from './scenes.js';
import { countdownParts } from './countdowns.js';

let overlay = null, timer = null, wakeLock = null, onKey = null, onVis = null, onPref = null;

export const digitsOn = () => store.getPreference('clock.modeDigits') !== false;
export function setDigits(on) { store.setPreference('clock.modeDigits', !!on); }

const clock = () => (window.FR && FR.clock) || null;
const now = () => { const c = clock(); return c ? c.zoned(new Date()) : new Date(); };

function column(range) {
    const stack = h('div', { class: 'fr-cm-stack' },
        ...Array.from({ length: range + 1 }, (_, n) => h('span', { class: 'fr-cm-d' }, String(n))));
    const col = h('div', { class: 'fr-cm-col' }, stack);
    col._set = v => {
        stack.style.transform = `translateY(${-v}em)`;
        [...stack.children].forEach((el, i) => {
            const d = Math.abs(i - v);
            el.className = 'fr-cm-d' + (d === 0 ? ' on' : d === 1 ? ' near' : d === 2 ? ' far' : ' dim');
        });
    };
    return col;
}

async function requestWakeLock() {
    try {
        if ('wakeLock' in navigator && !wakeLock) {
            wakeLock = await navigator.wakeLock.request('screen');
            wakeLock.addEventListener('release', () => { wakeLock = null; });
        }
    } catch (e) { /* battery saver, or not allowed: the clock still works */ }
}

/* the one thing worth knowing while the clock is up */
async function nextLine() {
    if (!store.ready) return '';
    const t = Date.now();
    const [tasks, events] = await Promise.all([store.getTasks(), store.getCountdowns()]);
    const next = tasks.filter(x => x.status === 'open' && x.due).sort((a, b) => a.due - b.due)
        .find(x => x.due > t - DAY);
    if (next) {
        const hour12 = !!(clock() && clock().hour12());
        return (next.due < t ? 'Overdue: ' : 'Next: ') + next.title + ' · ' + fmtWhen(next.due, hour12);
    }
    const ev = events.filter(e => e.at > t).sort((a, b) => a.at - b.at)[0];
    if (ev) {
        const p = countdownParts(ev.at, t, ev.allDay);
        return ev.title + ' · ' + (p.today ? 'today' : p.big + (p.unit ? ' ' + p.unit : '') + ' to go');
    }
    return '';
}

export function openClockMode() {
    if (overlay) return;
    if (window.FR) { if (FR.closeFocusMode) FR.closeFocusMode(); if (FR.closePanel) FR.closePanel(); }

    const cols = {
        h1: column(2), h2: column(9),
        m1: column(5), m2: column(9),
        s1: column(5), s2: column(9)
    };
    const sep = () => h('span', { class: 'fr-cm-sep' }, ':');
    const secWrap = h('div', { class: 'fr-cm-group fr-cm-secs' }, sep(), cols.s1, cols.s2);
    const ampm = h('span', { class: 'fr-cm-ampm' });
    const time = h('div', { class: 'fr-cm-time', 'aria-hidden': 'true' },
        h('div', { class: 'fr-cm-group' }, cols.h1, cols.h2),
        h('div', { class: 'fr-cm-group' }, sep(), cols.m1, cols.m2),
        secWrap, ampm);
    const date = h('div', { class: 'fr-cm-date' });
    const next = h('div', { class: 'fr-cm-next' });
    const live = h('div', { class: 'fr-sr-only', role: 'timer', 'aria-live': 'polite' });

    const digitsBtn = h('button', { class: 'fr-icon-btn', type: 'button', onclick: () => setDigits(!digitsOn()) });

    overlay = h('div', { class: 'fr-cm', role: 'dialog', 'aria-modal': 'true', 'aria-label': 'Clock' },
        h('div', { class: 'fr-cm-top' },
            digitsBtn,
            h('button', { class: 'fr-icon-btn', type: 'button', 'aria-label': 'Full screen', title: 'Full screen', html: icon('expand'),
                onclick: () => { if (document.fullscreenElement) document.exitFullscreen(); else if (overlay.requestFullscreen) overlay.requestFullscreen().catch(() => {}); } }),
            h('button', { class: 'fr-btn', type: 'button', onclick: closeClockMode }, iconEl('close'), 'Exit')),
        time, live, date, next);

    /* digits on: the sliding columns own the screen and the clock face stays out
     * of the way. Digits off: the opposite, so the chosen face is unobstructed. */
    const applyDigits = () => {
        const on = digitsOn();
        time.hidden = !on;
        overlay.classList.toggle('bare', !on);
        document.body.classList.toggle('fr-cm-bare', !on);
        digitsBtn.innerHTML = icon(on ? 'face-digital' : 'face-digital-off');
        const label = on ? 'Hide the digital readout' : 'Show the digital readout';
        digitsBtn.title = label;
        digitsBtn.setAttribute('aria-label', label);
        digitsBtn.setAttribute('aria-pressed', on ? 'true' : 'false');
    };

    let lastMin = -1, lastNext = 0;
    const paint = async () => {
        const d = now();
        const c = clock();
        const hour12 = !!(c && c.hour12());
        const hh = hour12 ? (d.getHours() % 12 || 12) : d.getHours();
        const str = String(hh).padStart(2, '0') + String(d.getMinutes()).padStart(2, '0') + String(d.getSeconds()).padStart(2, '0');
        cols.h1._set(+str[0]); cols.h2._set(+str[1]);
        cols.m1._set(+str[2]); cols.m2._set(+str[3]);
        cols.s1._set(+str[4]); cols.s2._set(+str[5]);
        // 12-hour time reads "9:05", not "09:05"
        cols.h1.classList.toggle('blank', hour12 && str[0] === '0');
        ampm.textContent = hour12 ? (d.getHours() < 12 ? 'AM' : 'PM') : '';
        if (d.getMinutes() !== lastMin) {
            lastMin = d.getMinutes();
            date.textContent = c ? c.date(d) : d.toDateString();
            live.textContent = (c ? c.hm(d) : '') + ' ' + ampm.textContent;
            if (Date.now() - lastNext > 30000) { lastNext = Date.now(); nextLine().then(t => { next.textContent = t; next.hidden = !t; }); }
        }
    };
    overlay.classList.toggle('still', reducedMotion());
    secWrap.hidden = !store.getPreference('clock.seconds');
    applyDigits();
    document.body.appendChild(overlay);
    document.body.classList.add('fr-cm-on');
    paint();
    requestAnimationFrame(() => overlay.classList.add('in'));
    timer = setInterval(paint, 250);

    onKey = e => { if (e.key === 'Escape' && !document.fullscreenElement) closeClockMode(); };
    document.addEventListener('keydown', onKey);
    onVis = () => { if (!document.hidden) { requestWakeLock(); paint(); } };
    document.addEventListener('visibilitychange', onVis);
    onPref = e => {
        if (e.detail.key === 'clock.modeDigits' || e.detail.key === '*') applyDigits();
        if (e.detail.key === 'clock.seconds' || e.detail.key === '*') secWrap.hidden = !store.getPreference('clock.seconds');
    };
    store.addEventListener('pref', onPref);
    requestWakeLock();
    if (!matchMedia('(pointer: coarse)').matches) overlay.querySelector('.fr-btn').focus({ preventScroll: true });
}

export function closeClockMode() {
    if (!overlay) return;
    const o = overlay; overlay = null;
    clearInterval(timer); timer = null;
    document.removeEventListener('keydown', onKey);
    document.removeEventListener('visibilitychange', onVis);
    if (onPref) { store.removeEventListener('pref', onPref); onPref = null; }
    if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
    if (wakeLock) { try { wakeLock.release(); } catch (e) {} wakeLock = null; }
    document.body.classList.remove('fr-cm-on', 'fr-cm-bare');
    o.classList.remove('in');
    setTimeout(() => o.remove(), 300);
}

export function clockModeOpen() { return !!overlay; }
