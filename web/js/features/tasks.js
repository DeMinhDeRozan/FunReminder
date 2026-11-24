/* Local tasks: create / edit / complete / recurring, due alerts while the app is open.
 * These live in IndexedDB on this device. Cloud reminders made in the chat stay in
 * DynamoDB through the existing API: the two are never copied into each other. */
import { store } from '../storage/localDataManager.js';
import { TASK_CATEGORIES } from '../storage/storageConfig.js';
import { h, iconEl, toast, field, select, section, empty, refreshPanel } from '../core/ui.js';
import { icon } from '../core/icons.js';
import { dayKey, addDays, startOfDay, fmtWhen, fmtDuration, toLocalInput, fromLocalInput, MIN, DAY } from '../core/time.js';
import { playSfx } from '../audio/audioManager.js';

export const CAT_LABEL = { personal: 'Personal', study: 'Study', work: 'Work', health: 'Health', other: 'Other' };
const REPEAT_LABEL = { none: 'No repeat', daily: 'Daily', weekly: 'Weekly', monthly: 'Monthly', custom: 'Custom…' };
const ON_TIME_GRACE = 5 * MIN;
const SNOOZE_MS = 10 * MIN;
const emit = (type, detail) => window.dispatchEvent(new CustomEvent(type, { detail }));
const hour12 = () => !!(window.FR && FR.clock && FR.clock.hour12());

/* ---------- recurrence ---------- */
function step(date, rec) {
    const d = new Date(date);
    const n = rec.freq === 'custom' ? rec.interval : 1;
    const unit = rec.freq === 'custom' ? rec.unit : { daily: 'day', weekly: 'week', monthly: 'month' }[rec.freq];
    if (unit === 'day') d.setDate(d.getDate() + n);
    else if (unit === 'week') d.setDate(d.getDate() + 7 * n);
    else if (unit === 'month') {
        const day = d.getDate();
        d.setDate(1); d.setMonth(d.getMonth() + n);
        d.setDate(Math.min(day, new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate()));   // 31 Jan -> 28/29 Feb
    }
    return d.getTime();
}
/* next due strictly after `after`, skipping missed cycles (no pile-up of copies) */
export function nextOccurrence(task, after = Date.now()) {
    if (!task.recurrence || task.recurrence.freq === 'none' || !task.due) return null;
    let t = task.due, guard = 0;
    do { t = step(t, task.recurrence); } while (t <= after && ++guard < 2000);
    return t;
}
export function repeatText(rec) {
    if (!rec || rec.freq === 'none') return '';
    if (rec.freq !== 'custom') return REPEAT_LABEL[rec.freq];
    return 'Every ' + rec.interval + ' ' + rec.unit + (rec.interval > 1 ? 's' : '');
}

/* ---------- actions ---------- */
export async function addTask(input) {
    const task = await store.saveTask(input);
    playSfx('tap');
    return task;
}

export async function completeTask(id) {
    const task = await store.getTask(id);
    if (!task || task.status === 'done') return null;
    const now = Date.now();
    const completion = await store.addCompletion({
        taskId: task.id, title: task.title, category: task.category,
        completedAt: now, dayKey: dayKey(new Date(now)), hour: new Date(now).getHours(),
        dueAt: task.due || null, onTime: task.due ? now <= task.due + ON_TIME_GRACE : null,
        alerted: !!task.notifiedAt, snoozed: (task.snoozeCount || 0) > 0,
        prev: { due: task.due, notifiedAt: task.notifiedAt, snoozeCount: task.snoozeCount || 0, snoozeUntil: task.snoozeUntil || null }
    });
    const next = nextOccurrence(task, now);
    if (next) {
        // recurring: the SAME task moves to its next date; history keeps the completion
        await store.updateTask(id, { due: next, notifiedAt: null, snoozeUntil: null, snoozeCount: 0, lastCompletedAt: now });
    } else {
        await store.updateTask(id, { status: 'done', completedAt: now, snoozeUntil: null });
    }
    playSfx('complete');
    emit('fr:task-completed', { task, completion, recurring: !!next });
    toast(next ? `Done. Next one ${fmtWhen(next, hour12())}.` : 'Done. Nice one.', {
        iconName: 'check', actions: [{ label: 'Undo', run: () => undoComplete(completion) }]
    });
    return completion;
}

export async function undoComplete(completion) {
    const task = await store.getTask(completion.taskId);
    if (task) {
        const p = completion.prev || {};
        await store.updateTask(task.id, { status: 'open', completedAt: null, due: p.due ?? task.due, notifiedAt: p.notifiedAt ?? null, snoozeCount: p.snoozeCount || 0, snoozeUntil: p.snoozeUntil || null });
    }
    await store.removeCompletion(completion.id);
    playSfx('undo');
}

export async function reopenTask(id) { await store.updateTask(id, { status: 'open', completedAt: null }); }

export async function deleteTask(task) {
    await store.deleteTask(task.id);
    toast('Task deleted.', { iconName: 'trash', actions: [{ label: 'Undo', run: () => store.saveTask(task) }] });
}

export async function snoozeTask(id, ms = SNOOZE_MS) {
    const task = await store.getTask(id);
    if (!task) return;
    const count = (task.snoozeCount || 0) + 1;
    await store.updateTask(id, { snoozeUntil: Date.now() + ms, snoozeCount: count });
    emit('fr:task-snoozed', { task, count });
    toast(`Snoozed for ${Math.round(ms / MIN)} min.` + (count >= 3 ? ' Again? Mate.' : ''), { iconName: 'snooze', timeout: 3000 });
}

/* ---------- grouping for lists + stats ---------- */
export function classify(tasks, now = Date.now()) {
    const endToday = addDays(startOfDay(new Date(now)), 1).getTime();
    const g = { overdue: [], today: [], upcoming: [], someday: [], done: [] };
    for (const t of tasks) {
        if (t.status === 'done') g.done.push(t);
        else if (!t.due) g.someday.push(t);
        else if (t.due < now) g.overdue.push(t);
        else if (t.due < endToday) g.today.push(t);
        else g.upcoming.push(t);
    }
    const byDue = (a, b) => a.due - b.due;
    g.overdue.sort(byDue); g.today.sort(byDue); g.upcoming.sort(byDue);
    g.someday.sort((a, b) => b.createdAt - a.createdAt);
    g.done.sort((a, b) => (b.completedAt || 0) - (a.completedAt || 0));
    return g;
}

/* ---------- due alerts (only while a FunReminder tab is open) ---------- */
let checkerTimer = null, sessionStart = Date.now(), prevSeen = 0;
function needsAlert(t, now) {
    if (t.status !== 'open' || !t.due || t.due > now) return false;
    if (!t.notifiedAt) return true;
    return !!(t.snoozeUntil && t.snoozeUntil <= now && t.notifiedAt < t.snoozeUntil);
}

async function systemNotify(title, body, tag) {
    if (!('Notification' in window) || Notification.permission !== 'granted') return;
    const opts = { body, tag, icon: 'icons/icon-192.png', badge: 'icons/icon-192.png', renotify: true };
    try {
        const reg = navigator.serviceWorker && await navigator.serviceWorker.getRegistration();
        if (reg) return reg.showNotification(title, { ...opts, data: { url: './' } });
        new Notification(title, opts);
    } catch (e) {}
}

function alertTask(t) {
    playSfx('notify');
    try { if (typeof window.flashClock === 'function') window.flashClock(); } catch (e) {}
    toast(h('span', null, h('strong', null, t.title), ' is due' + (t.snoozeCount ? ' (again)' : '') + '.'), {
        timeout: 0, iconName: 'bell',
        actions: [{ label: 'Done', run: () => completeTask(t.id) }, { label: 'Snooze 10m', run: () => snoozeTask(t.id) }]
    });
    if (document.hidden) systemNotify('Task due: ' + t.title, CAT_LABEL[t.category] + ' · local task', 'task-' + t.id);
    emit('fr:task-due', { task: t });
}

export async function checkDue() {
    if (!store.ready) return;
    const now = Date.now();
    const tasks = await store.getTasks();
    const due = tasks.filter(t => needsAlert(t, now));
    if (!due.length) return;
    const live = [], missed = [];
    for (const t of due) {
        const snoozeBack = !!t.notifiedAt;                         // snooze ran out: always alert
        const cameDueThisSession = t.due >= sessionStart - MIN;
        const createdOverdue = t.createdAt >= t.due;               // added already overdue: no alarm
        if (snoozeBack || (cameDueThisSession && !createdOverdue)) live.push(t);
        else if (!createdOverdue && t.createdAt < sessionStart && t.due >= prevSeen) missed.push(t);
        // anything else (overdue long before your last visit) is just marked, silently
    }
    for (const t of due) await store.updateTask(t.id, { notifiedAt: now });
    if (missed.length) {
        playSfx('notify');
        toast(h('span', null, `While you were away, ${missed.length} task${missed.length > 1 ? 's' : ''} came due: `,
            h('strong', null, missed.slice(0, 3).map(t => t.title).join(', ') + (missed.length > 3 ? '…' : ''))), {
            timeout: 0, iconName: 'bell', actions: [{ label: 'Show', run: () => window.FR && FR.openPanel('tasks') }]
        });
    }
    live.forEach(alertTask);
}

export function startDueChecker() {
    sessionStart = Date.now();
    prevSeen = store.getPreference('lastSeenAt') || 0;      // when this browser last had FunReminder open
    clearInterval(checkerTimer);
    checkerTimer = setInterval(checkDue, 15000);
    checkDue();
    document.addEventListener('visibilitychange', () => { if (!document.hidden) checkDue(); });
    // remember when the user was last here, for "while you were away"
    const seen = () => store.setPreference('lastSeenAt', Date.now());
    setInterval(seen, 60000);
    window.addEventListener('pagehide', seen);
    document.addEventListener('visibilitychange', () => { if (document.hidden) seen(); });
}

/* ================================================================ UI */
function catPill(c) { return h('span', { class: 'fr-pill cat-' + c }, CAT_LABEL[c] || c); }

function taskForm(initial, onSubmit, onCancel) {
    const t = initial || {};
    const rec = t.recurrence || { freq: 'none', interval: 2, unit: 'day' };
    const title = h('input', { class: 'fr-input', type: 'text', name: 'title', maxlength: 200, required: true, placeholder: 'Add a task…', value: t.title || '', autocomplete: 'off', 'aria-label': 'Task title' });
    const due = h('input', { class: 'fr-input', type: 'datetime-local', name: 'due', value: toLocalInput(t.due), 'aria-label': 'Due' });
    const cat = select(TASK_CATEGORIES.map(c => [c, CAT_LABEL[c]]), t.category || store.getPreference('tasks.defaultCategory'), () => {}, { 'aria-label': 'Category' });
    const rep = select(Object.entries(REPEAT_LABEL), rec.freq, v => { custom.hidden = v !== 'custom'; }, { 'aria-label': 'Repeat' });
    const n = h('input', { class: 'fr-input fr-num', type: 'number', min: 1, max: 365, value: rec.freq === 'custom' ? rec.interval : 2, 'aria-label': 'Every' });
    const unit = select([['day', 'days'], ['week', 'weeks'], ['month', 'months']], rec.unit || 'day', () => {});
    const custom = h('div', { class: 'fr-inline', hidden: rec.freq !== 'custom' }, h('span', { class: 'fr-hint' }, 'Every'), n, unit);
    const notes = h('textarea', { class: 'fr-input', rows: 2, maxlength: 2000, placeholder: 'Notes (optional)', 'aria-label': 'Notes' }, t.notes || '');
    const more = h('details', { class: 'fr-more', open: !!t.notes }, h('summary', null, 'Notes'), notes);
    const err = h('p', { class: 'fr-error', role: 'alert' });

    const form = h('form', { class: 'fr-task-form', novalidate: true },
        h('div', { class: 'fr-inline grow' }, title, h('button', { class: 'fr-btn primary', type: 'submit' }, initial ? 'Save' : 'Add')),
        h('div', { class: 'fr-grid3' }, field('Due', due), field('Category', cat), field('Repeat', rep)),
        custom, more, err,
        onCancel ? h('div', { class: 'fr-inline end' }, h('button', { class: 'fr-btn', type: 'button', onclick: onCancel }, 'Cancel')) : null);

    form.addEventListener('submit', async e => {
        e.preventDefault();
        err.textContent = '';
        if (!title.value.trim()) { err.textContent = 'Give it a name first.'; title.focus(); return; }
        const freq = rep.value;
        const dueTs = fromLocalInput(due.value);
        if (freq !== 'none' && !dueTs) { err.textContent = 'Repeating tasks need a due date and time.'; due.focus(); return; }
        const data = {
            title: title.value.trim(), due: dueTs, category: cat.value, notes: notes.value.trim(),
            recurrence: { freq, interval: freq === 'custom' ? Math.max(1, +n.value || 1) : 1, unit: freq === 'custom' ? unit.value : 'day' }
        };
        try { await onSubmit(data); } catch (ex) { err.textContent = 'Could not save: ' + ex.message; return; }
        if (!initial) { title.value = ''; notes.value = ''; due.value = ''; rep.value = 'none'; custom.hidden = true; title.focus(); }
    });
    return form;
}

function taskRow(t, now, onEdit) {
    const overdue = t.status === 'open' && t.due && t.due < now;
    const meta = h('div', { class: 'fr-task-meta' }, catPill(t.category),
        t.due ? h('span', { class: overdue ? 'fr-due overdue' : 'fr-due' }, overdue ? 'Overdue · ' + fmtDuration(t.due - now).replace(' ago', '') : fmtWhen(t.due, hour12())) : null,
        t.recurrence && t.recurrence.freq !== 'none' ? h('span', { class: 'fr-rep' }, iconEl('repeat'), repeatText(t.recurrence)) : null,
        t.snoozeUntil && t.snoozeUntil > now ? h('span', { class: 'fr-rep' }, iconEl('snooze'), 'snoozed') : null);
    const done = t.status === 'done';
    return h('li', { class: 'fr-task' + (done ? ' is-done' : '') + (overdue ? ' is-overdue' : '') },
        h('button', {
            class: 'fr-check', type: 'button', 'aria-label': done ? 'Mark as not done' : 'Complete ' + t.title, html: icon('check'),
            onclick: () => done ? reopenTask(t.id) : completeTask(t.id)
        }),
        h('div', { class: 'fr-task-body' }, h('div', { class: 'fr-task-title' }, t.title), meta,
            t.notes ? h('div', { class: 'fr-task-notes' }, t.notes) : null),
        h('div', { class: 'fr-task-actions' },
            !done ? h('button', { class: 'fr-icon-btn sm', type: 'button', 'aria-label': 'Edit', html: icon('edit'), onclick: () => onEdit(t) }) : null,
            h('button', { class: 'fr-icon-btn sm', type: 'button', 'aria-label': 'Delete', html: icon('trash'), onclick: () => deleteTask(t) })));
}

let view = 'open', editing = null;
export function renderTasksPanel(body) {
    body.appendChild(h('p', { class: 'fr-note' }, iconEl('lock'), 'Local tasks stay in this browser. Reminders you set in the chat are cloud reminders and ring there.'));
    body.appendChild(taskForm(null, addTask));
    const tabs = h('div', { class: 'fr-seg', role: 'tablist' },
        ...[['open', 'To do'], ['done', 'Done']].map(([v, l]) => h('button', {
            class: 'fr-seg-btn' + (view === v ? ' on' : ''), role: 'tab', 'aria-selected': view === v ? 'true' : 'false', type: 'button',
            onclick: () => { view = v; refreshPanel('tasks'); }
        }, l)));
    body.appendChild(tabs);
    const list = h('div', { class: 'fr-task-groups' }, h('p', { class: 'fr-empty' }, 'Loading…'));
    body.appendChild(list);

    const draw = async () => {
        const [tasks, comps] = await Promise.all([store.getTasks(), store.getCompletedTasks()]);
        const now = Date.now(), g = classify(tasks, now);
        list.replaceChildren();
        const onEdit = t => { editing = t.id; draw(); };
        const group = (title, items, cls = '') => {
            if (!items.length) return;
            const ul = h('ul', { class: 'fr-task-list' });
            items.forEach(t => {
                if (editing === t.id) {
                    ul.appendChild(h('li', { class: 'fr-task editing' }, taskForm(t, async data => { await store.updateTask(t.id, { ...data, notifiedAt: data.due !== t.due ? null : t.notifiedAt }); editing = null; }, () => { editing = null; draw(); })));
                } else ul.appendChild(taskRow(t, now, onEdit));
            });
            list.appendChild(section(h('span', { class: cls }, title, h('span', { class: 'fr-count' }, items.length)), ul));
        };
        if (view === 'open') {
            group('Overdue', g.overdue, 'tone-red'); group('Today', g.today); group('Upcoming', g.upcoming); group('Someday', g.someday);
            if (!g.overdue.length && !g.today.length && !g.upcoming.length && !g.someday.length) list.appendChild(empty('Nothing on. Add a task above, or enjoy the quiet.'));
        } else {
            group('Finished tasks', g.done.slice(0, 50));
            const recent = comps.sort((a, b) => b.completedAt - a.completedAt).slice(0, 40);
            if (recent.length) {
                list.appendChild(section('History', h('ul', { class: 'fr-history' }, ...recent.map(c => h('li', null,
                    h('span', { class: 'fr-hist-title' }, c.title), catPill(c.category),
                    h('span', { class: 'fr-hint' }, fmtWhen(c.completedAt, hour12()) + (c.onTime === false ? ' · late' : '')))))));
            }
            if (!g.done.length && !recent.length) list.appendChild(empty('No finished tasks yet.'));
        }
    };
    draw();
    // don't redraw under someone who is typing in the edit form
    const typing = () => { const a = document.activeElement; return editing && a && list.contains(a) && /INPUT|TEXTAREA|SELECT/.test(a.tagName); };
    const onChange = e => { if (['tasks', 'completions', '*'].includes(e.detail.store) && !typing()) draw(); };
    store.addEventListener('change', onChange);
    const tick = setInterval(() => { if (!typing()) draw(); }, 60000);   // overdue labels age
    return () => { store.removeEventListener('change', onChange); clearInterval(tick); editing = null; };
}
