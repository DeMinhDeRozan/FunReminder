/* Countdowns to personal events (birthdays, exams, holidays...). Local only. */
import { store } from '../storage/localDataManager.js';
import { h, iconEl, toast, field, section, empty, fill } from '../core/ui.js';
import { icon } from '../core/icons.js';
import { DAY, HOUR, MIN, startOfDay, dayKey } from '../core/time.js';

export function countdownParts(at, now = Date.now(), allDay = false) {
    if (allDay) {
        const days = Math.round((startOfDay(new Date(at)) - startOfDay(new Date(now))) / DAY);
        if (days === 0) return { big: 'Today', unit: '', past: false, today: true };
        return { big: Math.abs(days), unit: Math.abs(days) === 1 ? 'day' : 'days', past: days < 0 };
    }
    const ms = at - now, a = Math.abs(ms);
    if (a >= 2 * DAY) return { big: Math.floor(a / DAY), unit: 'days', past: ms < 0 };
    if (a >= HOUR) return { big: Math.floor(a / HOUR) + 'h ' + Math.floor(a % HOUR / MIN) + 'm', unit: '', past: ms < 0 };
    return { big: Math.max(1, Math.ceil(a / MIN)), unit: 'min', past: ms < 0 };
}
export function sortEvents(list, now = Date.now()) {
    const keyEnd = e => e.allDay ? startOfDay(new Date(e.at)).getTime() + DAY : e.at;
    const upcoming = list.filter(e => keyEnd(e) > now).sort((a, b) => a.at - b.at);
    const past = list.filter(e => keyEnd(e) <= now).sort((a, b) => b.at - a.at);
    return { upcoming, past };
}

export function eventCard(e, now, { compact = false, onEdit } = {}) {
    const p = countdownParts(e.at, now, e.allDay);
    const when = new Date(e.at).toLocaleDateString('en-AU', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' }) +
        (e.allDay ? '' : ' · ' + new Date(e.at).toLocaleTimeString('en-AU', { hour: 'numeric', minute: '2-digit', hour12: !!(window.FR && FR.clock && FR.clock.hour12()) }));
    return h('li', { class: 'fr-event' + (p.past ? ' past' : '') + (p.today ? ' today' : '') + (compact ? ' compact' : '') },
        h('div', { class: 'fr-event-count' }, h('b', null, p.big), p.unit ? h('span', null, p.unit + (p.past ? ' ago' : '')) : null),
        h('div', { class: 'fr-event-body' }, h('div', { class: 'fr-event-title' }, e.title), h('div', { class: 'fr-hint' }, when),
            !compact && e.notes ? h('div', { class: 'fr-task-notes' }, e.notes) : null),
        compact ? null : h('div', { class: 'fr-task-actions' },
            h('button', { class: 'fr-icon-btn sm' + (e.pinned ? ' on' : ''), type: 'button', 'aria-label': e.pinned ? 'Unpin from Today' : 'Pin to Today', 'aria-pressed': e.pinned ? 'true' : 'false', title: e.pinned ? 'Pinned to Today' : 'Pin to Today', html: icon('pin'),
                onclick: () => store.saveCountdown({ ...e, pinned: !e.pinned }) }),
            h('button', { class: 'fr-icon-btn sm', type: 'button', 'aria-label': 'Edit', html: icon('edit'), onclick: () => onEdit(e) }),
            h('button', { class: 'fr-icon-btn sm', type: 'button', 'aria-label': 'Delete', html: icon('trash'), onclick: async () => {
                await store.deleteCountdown(e.id);
                toast('Event deleted.', { iconName: 'trash', actions: [{ label: 'Undo', run: () => store.saveCountdown(e) }] });
            } })));
}

function eventForm(initial, done) {
    const e = initial || {};
    const d0 = e.at ? new Date(e.at) : null;
    const title = h('input', { class: 'fr-input', type: 'text', maxlength: 120, placeholder: 'Birthday, exam, holiday…', value: e.title || '', 'aria-label': 'Event name', autocomplete: 'off' });
    const date = h('input', { class: 'fr-input', type: 'date', value: d0 ? dayKey(d0) : '', 'aria-label': 'Date' });
    const time = h('input', { class: 'fr-input', type: 'time', value: d0 && !e.allDay ? String(d0.getHours()).padStart(2, '0') + ':' + String(d0.getMinutes()).padStart(2, '0') : '', 'aria-label': 'Time (optional)' });
    const notes = h('input', { class: 'fr-input', type: 'text', maxlength: 1000, placeholder: 'Note (optional)', value: e.notes || '' });
    const pin = h('input', { type: 'checkbox', checked: !!e.pinned });
    const err = h('p', { class: 'fr-error', role: 'alert' });
    const form = h('form', { class: 'fr-task-form', novalidate: true },
        h('div', { class: 'fr-inline grow' }, title, h('button', { class: 'fr-btn primary', type: 'submit' }, initial ? 'Save' : 'Add')),
        h('div', { class: 'fr-grid3' }, field('Date', date), field('Time', time, 'Leave empty for all day'), field('Note', notes)),
        h('label', { class: 'fr-check-line' }, pin, 'Pin to Today'),
        err,
        initial ? h('div', { class: 'fr-inline end' }, h('button', { class: 'fr-btn', type: 'button', onclick: () => done(null) }, 'Cancel')) : null);
    form.addEventListener('submit', async ev => {
        ev.preventDefault();
        err.textContent = '';
        if (!title.value.trim()) { err.textContent = 'Name the event.'; title.focus(); return; }
        if (!date.value) { err.textContent = 'Pick a date.'; date.focus(); return; }
        const allDay = !time.value;
        const at = new Date(date.value + 'T' + (time.value || '00:00')).getTime();
        if (!isFinite(at)) { err.textContent = 'That date looks off.'; return; }
        try { await store.saveCountdown({ ...e, title: title.value, at, allDay, notes: notes.value.trim(), pinned: pin.checked }); }
        catch (ex) { err.textContent = 'Could not save: ' + ex.message; return; }
        if (!initial) { title.value = ''; date.value = ''; time.value = ''; notes.value = ''; pin.checked = false; }
        done && done(true);
    });
    return form;
}

export function renderEventsPanel(body) {
    let editing = null;
    body.appendChild(eventForm(null, null));
    const list = h('div');
    body.appendChild(list);
    const draw = async () => {
        const all = await store.getCountdowns(), now = Date.now();
        const { upcoming, past } = sortEvents(all, now);
        const onEdit = e => { editing = e.id; draw(); };
        const ul = items => h('ul', { class: 'fr-events' }, ...items.map(e => editing === e.id
            ? h('li', { class: 'fr-event editing' }, eventForm(e, () => { editing = null; draw(); }))
            : eventCard(e, now, { onEdit })));
        fill(list, 
            upcoming.length ? section('Coming up', ul(upcoming)) : empty('No events yet. Add a birthday, exam or holiday above.'),
            past.length ? section('Past', ul(past.slice(0, 20))) : null);
    };
    draw();
    const typing = () => { const a = document.activeElement; return editing && a && list.contains(a) && /INPUT|TEXTAREA|SELECT/.test(a.tagName); };
    const onChange = e => { if (['countdowns', '*'].includes(e.detail.store) && !typing()) draw(); };
    store.addEventListener('change', onChange);
    const t = setInterval(() => { if (!typing()) draw(); }, 60000);
    return () => { store.removeEventListener('change', onChange); clearInterval(t); };
}
