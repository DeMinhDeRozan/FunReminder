/* Clock preferences for the ORIGINAL clock (header digits + big analog dial).
 * The inline tickClock() in index.preview.html asks window.FR.clock for the
 * zoned time and strings; if this module hasn't loaded yet it falls back to
 * its old local-time code. Time always comes from the browser, never a server. */
import { store } from '../storage/localDataManager.js';

const WD = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
const MO = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];

export const COMMON_ZONES = [
    'Australia/Sydney', 'Australia/Melbourne', 'Australia/Brisbane', 'Australia/Adelaide', 'Australia/Perth',
    'Pacific/Auckland', 'Asia/Ho_Chi_Minh', 'Asia/Singapore', 'Asia/Tokyo', 'Asia/Shanghai', 'Asia/Kolkata',
    'Asia/Dubai', 'Europe/London', 'Europe/Paris', 'Europe/Berlin', 'America/New_York', 'America/Chicago',
    'America/Denver', 'America/Los_Angeles', 'UTC'
];
export function allZones() {
    try { if (Intl.supportedValuesOf) return Intl.supportedValuesOf('timeZone'); } catch (e) {}
    return COMMON_ZONES;
}
export function localZone() {
    try { return Intl.DateTimeFormat().resolvedOptions().timeZone || 'Local'; } catch (e) { return 'Local'; }
}
export function isValidZone(tz) {
    try { new Intl.DateTimeFormat('en-US', { timeZone: tz }); return true; } catch (e) { return false; }
}

/* wall-clock offset of a zone at an instant, in ms (e.g. Sydney summer = +11h) */
const fmtCache = new Map();
export function zoneOffset(tz, at = Date.now()) {
    let f = fmtCache.get(tz);
    if (!f) {
        f = new Intl.DateTimeFormat('en-US', { timeZone: tz, hourCycle: 'h23', year: 'numeric', month: 'numeric', day: 'numeric', hour: 'numeric', minute: 'numeric', second: 'numeric' });
        fmtCache.set(tz, f);
    }
    const p = {};
    f.formatToParts(new Date(at)).forEach(x => { p[x.type] = x.value; });
    const asUTC = Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour % 24, +p.minute, +p.second);
    return asUTC - Math.floor(at / 1000) * 1000;
}
/* a Date whose LOCAL getters show the wall time in `tz` */
export function zonedDate(tz, at = Date.now()) {
    const local = -new Date(at).getTimezoneOffset() * 60000;
    return new Date(at + zoneOffset(tz, at) - local);
}

let tz = 'local', shift = 0, shiftAt = 0, hour12 = false, dateStyle = 'short';
let ampmEl = null, tzEl = null;

function load() {
    const want = store.getPreference('clock.timezone');
    tz = want !== 'local' && isValidZone(want) ? want : 'local';
    hour12 = store.getPreference('clock.format') === '12';
    dateStyle = store.getPreference('clock.date');
    shiftAt = 0;
    const b = document.body.classList;
    b.toggle('fr-no-sec', !store.getPreference('clock.seconds'));
    b.toggle('fr-12h', hour12);
    b.remove('fr-dial-off', 'fr-dial-bold');
    const dial = store.getPreference('clock.dial');
    if (dial !== 'subtle') b.add('fr-dial-' + dial);
    b.toggle('fr-clock-large', store.getPreference('clock.size') === 'large');
    if (tzEl) {
        tzEl.textContent = tz === 'local' ? '' : tz.split('/').pop().replace(/_/g, ' ');
        tzEl.hidden = tz === 'local';
    }
    paintNow();
}
/* repaint the header digits right away (the inline ticker only rewrites them when the second changes) */
function paintNow() {
    const hm = document.getElementById('clockHM'), dt = document.getElementById('clockDate');
    if (!hm) return;
    const d = clock.zoned(new Date());
    hm.textContent = clock.hm(d);
    if (dt) dt.textContent = clock.date(d);
    clock.after(d);
}

export const clock = {
    /* shifted "now": recomputes the zone offset once a minute (DST-safe, cheap per frame) */
    zoned(d) {
        if (tz === 'local') return d;
        const t = d.getTime();
        if (!shiftAt || t - shiftAt > 60000 || t < shiftAt) {
            shift = zoneOffset(tz, t) + new Date(t).getTimezoneOffset() * 60000;
            shiftAt = t;
        }
        return new Date(t + shift);
    },
    hm(d) {
        const m = String(d.getMinutes()).padStart(2, '0');
        if (!hour12) return String(d.getHours()).padStart(2, '0') + ':' + m;
        return (d.getHours() % 12 || 12) + ':' + m;
    },
    date(d) {
        if (dateStyle === 'long') return d.toLocaleDateString('en-AU', { weekday: 'long', day: 'numeric', month: 'long' }).toUpperCase();
        if (dateStyle === 'numeric') return String(d.getDate()).padStart(2, '0') + '/' + String(d.getMonth() + 1).padStart(2, '0') + '/' + d.getFullYear();
        return WD[d.getDay()] + ' ' + String(d.getDate()).padStart(2, '0') + ' ' + MO[d.getMonth()];
    },
    after(d) {
        if (ampmEl) ampmEl.textContent = hour12 ? (d.getHours() < 12 ? 'AM' : 'PM') : '';
    },
    hour12() { return hour12; },
    zone() { return tz; }
};

/* world clocks for the Today panel */
export function extraZoneTimes(now = Date.now()) {
    return store.getPreference('clock.extraZones').filter(isValidZone).slice(0, 3).map(z => {
        const d = zonedDate(z, now);
        const here = clock.zoned(new Date(now));            // the main clock's own day
        const diffDay = d.getDate() !== here.getDate() ? (d > here ? 'tomorrow' : 'yesterday') : '';
        return { zone: z, label: z.split('/').pop().replace(/_/g, ' '), time: clock.hm(d) + (hour12 ? (d.getHours() < 12 ? ' am' : ' pm') : ''), day: diffDay };
    });
}

export function initClock() {
    const sec = document.getElementById('clockSec');
    if (sec && !document.getElementById('frAmpm')) {
        ampmEl = document.createElement('span');
        ampmEl.id = 'frAmpm'; ampmEl.className = 'fr-ampm';
        sec.insertAdjacentElement('afterend', ampmEl);
    }
    const date = document.getElementById('clockDate');
    if (date && !document.getElementById('frTz')) {
        tzEl = document.createElement('div');
        tzEl.id = 'frTz'; tzEl.className = 'fr-tz';
        date.insertAdjacentElement('afterend', tzEl);
    }
    load();
    store.addEventListener('pref', e => { if (e.detail.key === '*' || e.detail.key.startsWith('clock.')) load(); });
    return clock;
}
