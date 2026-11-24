/* Today: the dashboard. Pinned on the right on wide screens, a sheet on phones.
 * The big clock stays where it always was (header + dial); this column adds
 * the day's context around it. */
import { store } from '../storage/localDataManager.js';
import { h, iconEl, isWide, onWideChange, fill, openPanel } from '../core/ui.js';
import { todayOpen, setTodayOpen } from './views.js';
import { greetingFor, fmtWhen, fmtMinShort } from '../core/time.js';
import { computeStats } from './stats.js';
import { completeTask, CAT_LABEL } from './tasks.js';
import { sortEvents, eventCard } from './countdowns.js';
import { extraZoneTimes } from './clock.js';
import { state as focusState, remaining as focusRemaining, onTimer } from './focus.js';
import { rooLine } from './mascot.js';

const hour12 = () => !!(window.FR && FR.clock && FR.clock.hour12());

function upNextItem(t, now) {
    const overdue = t.due && t.due < now;
    return h('li', { class: 'fr-up' + (overdue ? ' overdue' : '') },
        h('button', { class: 'fr-check sm', type: 'button', 'aria-label': 'Complete ' + t.title, onclick: () => completeTask(t.id), html: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>' }),
        h('div', { class: 'fr-up-body' }, h('div', { class: 'fr-up-title' }, t.title),
            h('div', { class: 'fr-hint' }, (overdue ? 'Overdue · ' : '') + (t.due ? fmtWhen(t.due, hour12()) : 'No date') + ' · ' + CAT_LABEL[t.category])));
}

export function renderToday(body) {
    const root = h('div', { class: 'fr-today-inner' });
    body.appendChild(root);
    let alive = true;
    const draw = async () => {
        if (!alive) return;
        const s = await computeStats();
        const now = Date.now();
        const nm = (window.FR && FR.clock) ? FR.clock.zoned(new Date()) : new Date();
        const g = s.groups;
        const upNext = [...g.overdue, ...g.today, ...g.upcoming].slice(0, 5);
        const events = await store.getCountdowns();
        const { upcoming } = sortEvents(events, now);
        const pinned = upcoming.filter(e => e.pinned);
        const showEvents = (pinned.length ? pinned : upcoming).slice(0, 3);
        const zones = extraZoneTimes(now);
        const fs = focusState();
        const streaksOn = store.getPreference('streaks');

        fill(root, 
            h('div', { class: 'fr-greet' },
                h('div', null, h('div', { class: 'fr-greet-hi' }, greetingFor(nm.getHours()) + '.'),
                    h('div', { class: 'fr-hint' }, nm.toLocaleDateString('en-AU', { weekday: 'long', day: 'numeric', month: 'long' }))),
                streaksOn && s.currentStreak ? h('div', { class: 'fr-streak', title: 'Active days in a row' }, iconEl('flame'), h('b', null, s.currentStreak), h('span', null, 'day' + (s.currentStreak > 1 ? 's' : ''))) : null),
            zones.length ? h('div', { class: 'fr-zones' }, ...zones.map(z => h('div', { class: 'fr-zone' }, h('span', null, z.label), h('b', null, z.time), z.day ? h('em', null, z.day) : null))) : null,
            h('div', { class: 'fr-kpis three' },
                h('div', { class: 'fr-kpi' }, h('b', null, s.completedToday), h('span', null, 'done today')),
                h('div', { class: 'fr-kpi' + (s.overdue ? ' tone-red' : '') }, h('b', null, s.overdue + s.dueToday), h('span', null, s.overdue ? 'due / overdue' : 'due today')),
                h('div', { class: 'fr-kpi' }, h('b', null, fmtMinShort(s.focusToday)), h('span', null, 'focus'))),
            h('div', { class: 'fr-card' },
                h('div', { class: 'fr-card-head' }, h('h3', null, 'Up next'),
                    h('button', { class: 'fr-link', type: 'button', onclick: () => FR.openPanel('tasks') }, 'All tasks')),
                upNext.length ? h('ul', { class: 'fr-up-list' }, ...upNext.map(t => upNextItem(t, now)))
                    : h('p', { class: 'fr-empty sm' }, g.someday.length ? `No dated tasks. ${g.someday.length} on the someday list.` : 'Nothing scheduled.'),
                h('button', { class: 'fr-btn ghost full', type: 'button', onclick: () => FR.openPanel('tasks') }, iconEl('plus'), 'Add a task'),
                h('p', { class: 'fr-hint fr-cloud-note' }, iconEl('cloud'), 'Chat reminders are kept in the cloud and ring in the chat.')),
            h('div', { class: 'fr-card fr-focus-card' + (fs.running ? ' running' : '') },
                h('div', { class: 'fr-card-head' }, h('h3', null, 'Focus'), fs.running ? h('span', { class: 'fr-live', 'data-focus-left': '' }, fmtClock(focusRemaining())) : null),
                h('div', { class: 'fr-inline' },
                    h('button', { class: 'fr-btn primary', type: 'button', onclick: () => FR.openFocusMode() }, iconEl('focus'), fs.running ? 'Open timer' : 'Start ' + store.getPreference('focus.minutes') + ' min'),
                    h('button', { class: 'fr-btn ghost', type: 'button', onclick: () => FR.openPanel('focus') }, 'Options'))),
            showEvents.length ? h('div', { class: 'fr-card' },
                h('div', { class: 'fr-card-head' }, h('h3', null, pinned.length ? 'Pinned' : 'Coming up'),
                    h('button', { class: 'fr-link', type: 'button', onclick: () => FR.openPanel('events') }, 'Events')),
                h('ul', { class: 'fr-events' }, ...showEvents.map(e => eventCard(e, now, { compact: true })))) : null,
            h('div', { class: 'fr-roo' },
                h('img', { src: 'kangaroo.png', alt: 'Roo', width: 52, height: 52, loading: 'lazy', class: 'fr-roo-img' }),
                h('p', { class: 'fr-roo-line' }, rooLine(s))));
    };
    const fmtClock = ms => { const t = Math.ceil(ms / 1000); return String(Math.floor(t / 60)).padStart(2, '0') + ':' + String(t % 60).padStart(2, '0'); };
    draw();
    const onChange = () => draw();
    store.addEventListener('change', onChange);
    const onPref = e => { if (/^(clock|streaks|focus)/.test(e.detail.key) || e.detail.key === '*') draw(); };
    store.addEventListener('pref', onPref);
    const offTimer = onTimer(draw);
    const minute = setInterval(draw, 60000);
    const sec = setInterval(() => { const el = root.querySelector('[data-focus-left]'); if (el && focusState().running) el.textContent = fmtClock(focusRemaining()); }, 1000);
    return () => { alive = false; store.removeEventListener('change', onChange); store.removeEventListener('pref', onPref); offTimer(); clearInterval(minute); clearInterval(sec); };
}

/* wide screens: a column on the right. It stays mounted while the screen is
 * wide and slides out when closed (ui.today), so opening and closing it is one
 * smooth move instead of a pop. */
let aside = null, asideCleanup = null;
export function mountTodayColumn() {
    const sync = () => {
        const open = isWide() && todayOpen();
        if (isWide()) {
            if (!aside) {
                aside = h('aside', { class: 'fr-today', id: 'frToday', 'aria-label': 'Today' });
                document.body.appendChild(aside);
                asideCleanup = renderToday(aside);
            }
            aside.classList.toggle('closed', !open);
            aside.setAttribute('aria-hidden', open ? 'false' : 'true');
            if (open && window.FR && FR.currentPanel && FR.currentPanel() === 'today') FR.closePanel();
        } else if (aside) {
            asideCleanup && asideCleanup(); aside.remove(); aside = null;
        }
        document.body.classList.toggle('fr-has-today', open);
    };
    sync();
    onWideChange(sync);
    store.addEventListener('pref', e => { if (e.detail.key === 'ui.today' || e.detail.key === '*') sync(); });
}

/* the rail button: on a wide screen it brings the column back, on a phone it
 * opens the same content as a sheet */
export function openTodayView(id) {
    if (isWide()) { setTodayOpen(true); return; }
    openPanel(id);
}
