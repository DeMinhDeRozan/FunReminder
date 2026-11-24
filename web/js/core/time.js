/* Date helpers. Days are bucketed by the LOCAL calendar date at the moment an
 * event happens, and that key is stored on the record. If the device's timezone
 * changes later, old history stays on the day it was earned. */

export const MIN = 60 * 1000, HOUR = 60 * MIN, DAY = 24 * HOUR;

export function dayKey(d = new Date()) {
    const x = d instanceof Date ? d : new Date(d);
    return x.getFullYear() + '-' + String(x.getMonth() + 1).padStart(2, '0') + '-' + String(x.getDate()).padStart(2, '0');
}
export function dayFromKey(key) { const [y, m, d] = key.split('-').map(Number); return new Date(y, m - 1, d); }
export function addDays(d, n) { const x = new Date(d); x.setDate(x.getDate() + n); return x; }
export function startOfDay(d = new Date()) { const x = new Date(d); x.setHours(0, 0, 0, 0); return x; }
/* weeks start on Monday (Australian convention) */
export function startOfWeek(d = new Date()) {
    const x = startOfDay(d); const wd = (x.getDay() + 6) % 7; return addDays(x, -wd);
}
export function lastNDays(n, end = new Date()) {
    const out = []; for (let i = n - 1; i >= 0; i--) out.push(dayKey(addDays(end, -i))); return out;
}

export function fmtDuration(ms) {
    const neg = ms < 0; ms = Math.abs(ms);
    const d = Math.floor(ms / DAY), h = Math.floor(ms % DAY / HOUR), m = Math.floor(ms % HOUR / MIN);
    let s;
    if (d >= 2) s = d + ' days';
    else if (d === 1) s = '1 day' + (h ? ' ' + h + 'h' : '');
    else if (h) s = h + 'h' + (m ? ' ' + m + 'm' : '');
    else s = Math.max(1, m) + ' min';
    return neg ? s + ' ago' : 'in ' + s;
}

/* compact form for small tiles: 25m, 1h 5m */
export function fmtMinShort(min) {
    min = Math.round(min); const h = Math.floor(min / 60), m = min % 60;
    return h ? h + 'h' + (m ? ' ' + m + 'm' : '') : m + 'm';
}
export function fmtMinutes(min) {
    min = Math.round(min);
    const h = Math.floor(min / 60), m = min % 60;
    if (!h) return m + ' min';
    return h + 'h' + (m ? ' ' + m + 'm' : '');
}

/* "Today 6:00 pm", "Tomorrow 9:00", "Fri 28 Nov", ... uses the 12/24h pref */
export function fmtWhen(ts, hour12 = false) {
    const d = new Date(ts), now = new Date();
    const time = d.toLocaleTimeString('en-AU', { hour: 'numeric', minute: '2-digit', hour12 });
    const k = dayKey(d);
    if (k === dayKey(now)) return 'Today ' + time;
    if (k === dayKey(addDays(now, 1))) return 'Tomorrow ' + time;
    if (k === dayKey(addDays(now, -1))) return 'Yesterday ' + time;
    const sameYear = d.getFullYear() === now.getFullYear();
    return d.toLocaleDateString('en-AU', { weekday: 'short', day: 'numeric', month: 'short', year: sameYear ? undefined : 'numeric' }) + ' ' + time;
}

/* value for <input type="datetime-local"> in local time */
export function toLocalInput(ts) {
    if (!ts) return '';
    const d = new Date(ts);
    return dayKey(d) + 'T' + String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
}
export function fromLocalInput(v) {
    if (!v) return null;
    const t = new Date(v).getTime();
    return isFinite(t) ? t : null;
}

export function greetingFor(h) {
    if (h < 5) return 'Up late, legend';
    if (h < 12) return 'Morning';
    if (h < 17) return "G'day";
    if (h < 21) return 'Evening';
    return 'Night, mate';
}
