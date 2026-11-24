/* Productivity stats, streaks, achievements, weekly report.
 * Everything is computed from real local records (completions + focus sessions).
 * Nothing is estimated and nothing goes to the server.
 *
 * Active day: a calendar day (device's local date when it happened) on which you
 * completed at least one task OR finished at least one focus session.
 * Streak: consecutive active days ending today, or ending yesterday if today
 * isn't active yet (so the streak doesn't "break" at midnight or on refresh). */
import { store } from '../storage/localDataManager.js';
import { h, iconEl, toast, section, empty, fill } from '../core/ui.js';
import { dayKey, dayFromKey, addDays, startOfWeek, lastNDays, fmtMinutes } from '../core/time.js';
import { classify } from './tasks.js';
import { playSfx } from '../audio/audioManager.js';

const emit = (type, detail) => window.dispatchEvent(new CustomEvent(type, { detail }));

export async function computeStats(now = new Date()) {
    const [tasks, comps, sessions, unlocked] = await Promise.all([
        store.getTasks(), store.getCompletedTasks(), store.getFocusSessions(), store.getAchievements()]);
    const today = dayKey(now), wk0 = dayKey(startOfWeek(now));
    const g = classify(tasks, now.getTime());

    const perDayTasks = {}, perDayFocus = {};
    comps.forEach(c => { perDayTasks[c.dayKey] = (perDayTasks[c.dayKey] || 0) + 1; });
    sessions.forEach(s => { perDayFocus[s.dayKey] = (perDayFocus[s.dayKey] || 0) + s.minutes; });
    const active = new Set([...Object.keys(perDayTasks), ...Object.keys(perDayFocus)]);

    // streaks
    let current = 0;
    let cursor = active.has(today) ? now : addDays(now, -1);
    while (active.has(dayKey(cursor))) { current++; cursor = addDays(cursor, -1); }
    let longest = 0, run = 0, prev = null;
    [...active].sort().forEach(k => {
        run = prev && dayKey(addDays(dayFromKey(prev), 1)) === k ? run + 1 : 1;
        longest = Math.max(longest, run); prev = k;
    });

    // perfect week: a finished Mon-Sun week with >= 5 dated tasks, all done on time, none left open
    let perfectWeek = false;
    const weeks = {};
    comps.filter(c => c.dueAt).forEach(c => { const w = dayKey(startOfWeek(new Date(c.dueAt))); (weeks[w] = weeks[w] || []).push(c); });
    for (const [w, list] of Object.entries(weeks)) {
        const start = dayFromKey(w).getTime(), end = addDays(dayFromKey(w), 7).getTime();
        if (end > now.getTime() || list.length < 5) continue;
        const openInWeek = tasks.some(t => t.status === 'open' && t.due && t.due >= start && t.due < end);
        if (!openInWeek && list.every(c => c.onTime)) { perfectWeek = true; break; }
    }

    const last7 = lastNDays(7, now);
    const weeksBack = [3, 2, 1, 0].map(i => {
        const s = addDays(startOfWeek(now), -7 * i);
        const keys = lastNDays(7, addDays(s, 6));
        return { label: i === 0 ? 'This wk' : s.toLocaleDateString('en-AU', { day: 'numeric', month: 'short' }), tasks: keys.reduce((a, k) => a + (perDayTasks[k] || 0), 0), focus: keys.reduce((a, k) => a + (perDayFocus[k] || 0), 0) };
    });
    const weekKeys = lastNDays(7, addDays(startOfWeek(now), 6)).filter(k => k <= today);

    return {
        now, tasks, comps, sessions, unlocked: new Map(unlocked.map(a => [a.id, a])),
        completedToday: perDayTasks[today] || 0,
        completedWeek: weekKeys.reduce((a, k) => a + (perDayTasks[k] || 0), 0),
        completed7: last7.reduce((a, k) => a + (perDayTasks[k] || 0), 0),
        completedTotal: comps.length,
        open: g.overdue.length + g.today.length + g.upcoming.length + g.someday.length,
        overdue: g.overdue.length, dueToday: g.today.length, groups: g,
        focusToday: perDayFocus[today] || 0,
        focusWeek: weekKeys.reduce((a, k) => a + (perDayFocus[k] || 0), 0),
        focus7: last7.reduce((a, k) => a + (perDayFocus[k] || 0), 0),
        focusTotal: sessions.reduce((a, s) => a + s.minutes, 0),
        sessionsTotal: sessions.length,
        currentStreak: current, longestStreak: longest,
        maxInDay: Math.max(0, ...Object.values(perDayTasks)),
        earlyBird: comps.some(c => c.hour >= 4 && c.hour < 8),
        nightOwl: comps.some(c => c.hour >= 23 || c.hour < 4),
        noSnooze: comps.filter(c => c.alerted && !c.snoozed).length,
        perfectWeek, wk0,
        last7: last7.map(k => ({ key: k, label: dayFromKey(k).toLocaleDateString('en-AU', { weekday: 'short' }), tasks: perDayTasks[k] || 0, focus: perDayFocus[k] || 0 })),
        weeks: weeksBack
    };
}

/* ---------- achievements ---------- */
const bool = v => [v ? 1 : 0, 1];
export const ACHIEVEMENTS = [
    { id: 'first-task', name: 'First Task', desc: 'Complete your first task.', p: s => [s.completedTotal, 1] },
    { id: 'tasks-10', name: 'Getting Going', desc: 'Complete 10 tasks.', p: s => [s.completedTotal, 10] },
    { id: 'tasks-50', name: 'Half Century', desc: 'Complete 50 tasks.', p: s => [s.completedTotal, 50] },
    { id: 'tasks-100', name: 'The Ton', desc: 'Complete 100 tasks.', p: s => [s.completedTotal, 100] },
    { id: 'five-a-day', name: 'Five in One Day', desc: 'Complete 5 tasks in a single day.', p: s => [s.maxInDay, 5] },
    { id: 'streak-3', name: '3-Day Streak', desc: 'Be active 3 days in a row.', streak: true, p: s => [s.longestStreak, 3] },
    { id: 'streak-7', name: '7-Day Streak', desc: 'Be active 7 days in a row.', streak: true, p: s => [s.longestStreak, 7] },
    { id: 'streak-30', name: '30-Day Streak', desc: 'Be active 30 days in a row.', streak: true, p: s => [s.longestStreak, 30] },
    { id: 'perfect-week', name: 'Perfect Week', desc: 'Finish a Mon–Sun week with 5+ dated tasks, all on time, none left open.', p: s => bool(s.perfectWeek) },
    { id: 'early-bird', name: 'Early Bird', desc: 'Complete a task between 4 and 8 am.', p: s => bool(s.earlyBird) },
    { id: 'night-owl', name: 'Night Owl', desc: 'Complete a task between 11 pm and 4 am.', p: s => bool(s.nightOwl) },
    { id: 'focus-first', name: 'In the Zone', desc: 'Finish your first focus session.', p: s => [s.sessionsTotal, 1] },
    { id: 'focus-master', name: 'Focus Master', desc: 'Finish 25 focus sessions.', p: s => [s.sessionsTotal, 25] },
    { id: 'no-snooze', name: 'No Snooze Challenge', desc: 'Complete 10 tasks after their alert without hitting snooze.', p: s => [s.noSnooze, 10] }
];

let evalTimer = null, evaluating = false;
export function scheduleEvaluation(delay = 5500) {
    // wait out the Undo window, so an undone completion never earns a badge
    clearTimeout(evalTimer);
    evalTimer = setTimeout(evaluate, delay);
}
export async function evaluate({ silent = false } = {}) {
    if (evaluating) return; evaluating = true;
    try {
        const s = await computeStats();
        const streaksOn = store.getPreference('streaks');
        const fresh = [];
        for (const a of ACHIEVEMENTS) {
            if (s.unlocked.has(a.id) || (a.streak && !streaksOn)) continue;
            const [v, target] = a.p(s);
            if (v >= target && await store.saveAchievement({ id: a.id })) fresh.push(a);
        }
        if (fresh.length && !silent) {
            playSfx('achievement');
            toast(h('span', null, 'Achievement unlocked: ', h('strong', null, fresh.map(a => a.name).join(', '))), {
                iconName: 'trophy', timeout: 7000, actions: [{ label: 'See', run: () => window.FR && FR.openPanel('stats') }]
            });
            emit('fr:achievement', { achievements: fresh });
        }
        return fresh;
    } finally { evaluating = false; }
}

/* ---------- weekly report (rules over real numbers, no AI call) ---------- */
export function weeklyReport(s) {
    const lines = [];
    const n = s.completed7, f = s.focus7;
    if (n >= 20) lines.push(`You're on fire! You completed ${n} tasks this week.`);
    else if (n >= 8) lines.push(`Solid week: ${n} tasks done.`);
    else if (n >= 1) lines.push(`${n} task${n > 1 ? 's' : ''} done this week. Every one counts.`);
    else lines.push('No tasks ticked off in the last 7 days. Fresh start?');
    if (f >= 300) lines.push(`You focused for ${fmtMinutes(f)}. Not bad, mate.`);
    else if (f >= 60) lines.push(`${fmtMinutes(f)} of focus time. Keep stacking them.`);
    else if (f > 0) lines.push(`${fmtMinutes(f)} of focus. Small wins add up.`);
    else lines.push('No focus sessions yet. Try one 25-minute block.');
    if (s.overdue > 0) lines.push(`${s.overdue === 1 ? 'One task is' : s.overdue + ' tasks are'} still overdue. Let's sort that out.`);
    else if (s.open > 0) lines.push('Nothing overdue. Legend.');
    if (store.getPreference('streaks') && s.currentStreak >= 3) lines.push(`${s.currentStreak}-day streak going. Don't break it now.`);
    const best = [...s.last7].sort((a, b) => b.tasks - a.tasks)[0];
    if (best && best.tasks >= 2) lines.push(`Best day: ${dayFromKey(best.key).toLocaleDateString('en-AU', { weekday: 'long' })} (${best.tasks} tasks).`);
    return lines;
}

export async function maybeWeeklyNudge() {
    if (!store.getPreference('weeklyReport')) return;
    const s = await computeStats();
    const last = await store.getMeta('weeklyNudge');
    if (last === s.wk0) return;
    const hadActivity = s.comps.some(c => c.dayKey < s.wk0) || s.sessions.some(x => x.dayKey < s.wk0);
    await store.setMeta('weeklyNudge', s.wk0);
    if (hadActivity && last) toast('New week, mate. Your weekly report is ready.', { iconName: 'stats', timeout: 8000, actions: [{ label: 'Show', run: () => FR.openPanel('stats') }] });
}

/* ---------- UI ---------- */
function bars(data, key, fmtVal, label) {
    const max = Math.max(1, ...data.map(d => d[key]));
    return h('figure', { class: 'fr-chart', 'aria-label': label },
        h('figcaption', null, label),
        h('div', { class: 'fr-bars' }, ...data.map(d => h('div', { class: 'fr-bar', title: d.label + ': ' + fmtVal(d[key]) },
            h('span', { class: 'fr-bar-val' }, d[key] ? fmtVal(d[key]) : ''),
            h('span', { class: 'fr-bar-fill', style: { height: (d[key] / max * 100).toFixed(1) + '%' } }),
            h('span', { class: 'fr-bar-label' }, d.label)))));
}
const kpi = (v, l, tone = '') => h('div', { class: 'fr-kpi ' + tone }, h('b', null, v), h('span', null, l));

export function renderStatsPanel(body) {
    const root = h('div', null, h('p', { class: 'fr-empty' }, 'Crunching numbers…'));
    body.appendChild(root);
    const draw = async () => {
        const s = await computeStats();
        const streaksOn = store.getPreference('streaks');
        const report = weeklyReport(s);
        const ach = ACHIEVEMENTS.filter(a => streaksOn || !a.streak);
        const got = ach.filter(a => s.unlocked.has(a.id)).length;
        fill(root, 
            h('div', { class: 'fr-kpis' },
                kpi(s.completedToday, 'done today'), kpi(s.completedWeek, 'done this week'),
                kpi(s.open, 'open tasks'), kpi(s.overdue, 'overdue', s.overdue ? 'tone-red' : ''),
                kpi(fmtMinutes(s.focusToday), 'focus today'), kpi(fmtMinutes(s.focusTotal), 'focus all-time'),
                streaksOn ? kpi(s.currentStreak + 'd', 'current streak', 'tone-brass') : null,
                streaksOn ? kpi(s.longestStreak + 'd', 'best streak') : null),
            section('Weekly report', h('div', { class: 'fr-report' }, h('img', { src: 'kangaroo.png', alt: '', class: 'fr-report-roo', width: 44, height: 44 }),
                h('ul', null, ...report.map(l => h('li', null, l)))), h('p', { class: 'fr-hint' }, 'Last 7 days, from your local data.')),
            section('Last 7 days', h('div', { class: 'fr-charts' },
                bars(s.last7, 'tasks', v => String(v), 'Tasks completed'),
                bars(s.last7, 'focus', v => v + 'm', 'Focus minutes'))),
            section('Trend', bars(s.weeks, 'tasks', v => String(v), 'Tasks per week')),
            section(h('span', null, 'Achievements ', h('span', { class: 'fr-count' }, got + '/' + ach.length)),
                h('ul', { class: 'fr-ach' }, ...ach.map(a => {
                    const [v, t] = a.p(s), done = s.unlocked.has(a.id), pct = Math.min(100, v / t * 100);
                    return h('li', { class: 'fr-ach-item' + (done ? ' got' : '') },
                        h('span', { class: 'fr-ach-ico' }, iconEl(done ? 'trophy' : 'lock')),
                        h('div', null, h('b', null, a.name), h('span', { class: 'fr-hint' }, a.desc),
                            done ? h('span', { class: 'fr-hint' }, 'Unlocked ' + new Date(s.unlocked.get(a.id).unlockedAt).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' }))
                                : h('div', { class: 'fr-meter', role: 'progressbar', 'aria-valuemin': 0, 'aria-valuemax': t, 'aria-valuenow': Math.min(v, t) },
                                    h('span', { style: { width: pct + '%' } }), h('em', null, t > 1 ? Math.min(v, t) + ' / ' + t : 'Not yet'))));
                }))),
            !s.comps.length && !s.sessions.length ? empty('Complete a task or a focus session and your stats start here.') : null);
    };
    draw();
    const onChange = () => draw();
    store.addEventListener('change', onChange);
    return () => store.removeEventListener('change', onChange);
}
