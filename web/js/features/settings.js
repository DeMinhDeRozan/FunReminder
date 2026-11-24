/* Settings. Every switch writes one preference through the data manager;
 * the features listen for 'pref' events and update themselves. */
import { store } from '../storage/localDataManager.js';
import { h, iconEl, toast, confirmDialog, field, select, toggle, section, refreshPanel } from '../core/ui.js';
import { SCENES, sceneThumb } from './scenes.js';
import { allZones, localZone, COMMON_ZONES } from './clock.js';
import { FACES, faceThumb, currentFace, setFace } from './clockface.js';
import { chatOpen, setChatOpen, todayOpen, setTodayOpen } from './views.js';
import { AMBIENTS } from '../audio/audioManager.js';

const P = k => store.getPreference(k);
const set = k => v => store.setPreference(k, v);

function scenePicker() {
    const grid = h('div', { class: 'fr-scenes', role: 'radiogroup', 'aria-label': 'Background' });
    const paint = () => grid.querySelectorAll('.fr-scene-opt').forEach(b => {
        const on = b.dataset.scene === P('scene');
        b.classList.toggle('on', on); b.setAttribute('aria-checked', on ? 'true' : 'false');
    });
    SCENES.forEach(s => {
        const b = h('button', { class: 'fr-scene-opt', type: 'button', role: 'radio', dataset: { scene: s.id }, onclick: () => { store.setPreference('scene', s.id); paint(); } },
            sceneThumb(s.id), h('span', { class: 'fr-scene-name' }, s.name), h('span', { class: 'fr-hint' }, s.blurb));
        grid.appendChild(b);
    });
    paint();
    return h('div', null, grid,
        h('div', { class: 'fr-inline end' }, h('button', { class: 'fr-link', type: 'button', onclick: () => { store.setPreference('scene', 'original'); paint(); } }, 'Restore default')));
}

function zoneSelect(value, onchange, includeLocal) {
    const zones = allZones();
    const opts = (includeLocal ? [['local', 'This device (' + localZone() + ')']] : [['', 'Add a city…']])
        .concat(COMMON_ZONES.map(z => [z, z.replace(/_/g, ' ')]))
        .concat([['—', '──────────']])
        .concat(zones.filter(z => !COMMON_ZONES.includes(z)).map(z => [z, z.replace(/_/g, ' ')]));
    const s = select(opts, value, onchange);
    s.querySelector('option[value="—"]').disabled = true;
    return s;
}

function extraZones() {
    const list = P('clock.extraZones');
    const wrap = h('div', { class: 'fr-zone-edit' });
    list.forEach((z, i) => wrap.appendChild(h('div', { class: 'fr-inline' }, h('span', { class: 'fr-pill' }, z.replace(/_/g, ' ')),
        h('button', { class: 'fr-link', type: 'button', onclick: () => { const n = list.slice(); n.splice(i, 1); store.setPreference('clock.extraZones', n); refreshPanel('settings'); } }, 'Remove'))));
    if (list.length < 3) wrap.appendChild(zoneSelect('', v => { if (v && !list.includes(v)) { store.setPreference('clock.extraZones', list.concat(v)); refreshPanel('settings'); } }, false));
    return field('World clocks', wrap, 'Shown on Today. Up to 3.');
}

/* Clock type: one card per face, with a small preview and the current one lit.
 * Applies straight away (the preference event repaints the clock). */
function clockTypePicker() {
    const grid = h('div', { class: 'fr-cf-picker', role: 'radiogroup', 'aria-label': 'Clock type' });
    const paint = () => grid.querySelectorAll('.fr-cf-opt').forEach(b => {
        const on = b.dataset.frFace === currentFace();
        b.classList.toggle('on', on);
        b.setAttribute('aria-checked', on ? 'true' : 'false');
    });
    FACES.forEach(f => {
        const b = h('button', {
            class: 'fr-cf-opt', type: 'button', role: 'radio', dataset: { frFace: f.id },
            'aria-label': f.name + ' clock: ' + f.blurb,
            onclick: () => { setFace(f.id); paint(); }
        }, faceThumb(f.id), h('b', null, f.name), h('span', null, f.blurb));
        grid.appendChild(b);
    });
    paint();
    return grid;
}

function rotationPicks() {
    const ids = [['plumber', 'Plumber'], ['dunk', 'Baller'], ['pirate', 'Pirate']];
    return h('div', { class: 'fr-chips' }, ...ids.map(([id, label]) => {
        const on = P('mascot.rotation').includes(id);
        return h('button', { class: 'fr-chip' + (on ? ' on' : ''), type: 'button', 'aria-pressed': on ? 'true' : 'false', onclick: () => {
            const cur = P('mascot.rotation');
            const next = cur.includes(id) ? cur.filter(x => x !== id) : cur.concat(id);
            if (!next.length) { toast('Keep at least one, mate.'); return; }
            store.setPreference('mascot.rotation', next); refreshPanel('settings');
        } }, label);
    }));
}

function slider(value, onchange, label) {
    return h('input', { class: 'fr-range', type: 'range', min: 0, max: 100, step: 5, value: Math.round(value * 100), 'aria-label': label,
        oninput: e => onchange(+e.target.value / 100) });
}

async function doExport() {
    const data = await store.exportData();
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const a = h('a', { href: URL.createObjectURL(blob), download: 'funreminder-backup-' + new Date().toISOString().slice(0, 10) + '.json' });
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 4000);
    toast('Backup downloaded.', { iconName: 'download' });
}

function importControl() {
    const input = h('input', { type: 'file', accept: 'application/json,.json', hidden: true });
    input.addEventListener('change', async () => {
        const file = input.files && input.files[0];
        input.value = '';
        if (!file) return;
        if (file.size > 5 * 1024 * 1024) { toast('That file is too big to be a FunReminder backup.', { tone: 'warn' }); return; }
        let obj;
        try { obj = JSON.parse(await file.text()); } catch (e) { toast("Couldn't read that file: it isn't valid JSON.", { tone: 'warn' }); return; }
        const r = store.inspectImport(obj);
        if (!r.ok) { toast(r.errors.join(' '), { tone: 'warn' }); return; }
        const total = Object.values(r.counts).reduce((a, b) => a + b, 0);
        const bad = Object.values(r.invalid).reduce((a, b) => a + b, 0);
        const summary = `${r.counts.tasks} tasks, ${r.counts.completions} history entries, ${r.counts.focusSessions} focus sessions, ${r.counts.countdowns} events, ${r.counts.achievements} achievements` + (bad ? `. ${bad} broken record${bad > 1 ? 's' : ''} will be skipped.` : '.');
        const replace = await confirmDialog({ title: 'Import backup', body: `Found ${total} records: ${summary} Merge keeps everything you have and adds what's new. Replace wipes local records first.`, confirm: 'Merge', cancel: 'More options…' });
        let mode = replace ? 'merge' : null;
        if (!mode) {
            const ok = await confirmDialog({ title: 'Replace local data?', body: 'This deletes the tasks, history, focus sessions, events and achievements in this browser and loads the backup instead. This cannot be undone.', confirm: 'Replace', cancel: 'Cancel', danger: true });
            if (!ok) return;
            mode = 'replace';
        }
        try {
            const res = await store.importData(obj, { mode });
            toast(`Imported: ${res.added} added, ${res.updated} updated, ${res.skipped} unchanged.`, { iconName: 'upload' });
        } catch (e) { toast('Import failed: ' + e.message, { tone: 'warn' }); }
    });
    return h('span', null, input, h('button', { class: 'fr-btn', type: 'button', onclick: () => input.click() }, iconEl('upload'), 'Import'));
}

export function renderSettingsPanel(body) {
    const warnOn = store.getLegacy('mate_warn_sound') !== 'off';
    body.append(
        section('Appearance',
            field('Background', scenePicker()),
            field('Motion', select([['system', 'Follow my device'], ['reduced', 'Reduced (still scenes, no shake)']], P('motion'), set('motion')),
                'Reduced motion freezes the scenes and swaps the kangaroo stunts for a still card.'),
            field('Theme', select([['dial', 'Enamel dial (default)'], ['contrast', 'High contrast']], P('theme'), set('theme')))),
        section('Clock',
            field('Clock type', clockTypePicker(), 'Shown behind the chat. The choice is kept for next time.'),
            h('div', { class: 'fr-grid2' },
                field('Format', select([['24', '24-hour'], ['12', '12-hour']], P('clock.format'), set('clock.format'))),
                field('Date', select([['short', 'TUE 24 NOV'], ['long', 'TUESDAY, 24 NOVEMBER'], ['numeric', '24/11/2026']], P('clock.date'), set('clock.date'))),
                field('Its strength', select([['subtle', 'Subtle'], ['bold', 'Bold'], ['off', 'Hidden']], P('clock.dial'), set('clock.dial'))),
                field('Clock size', select([['normal', 'Normal'], ['large', 'Large']], P('clock.size'), set('clock.size')))),
            toggle('Show seconds', P('clock.seconds'), set('clock.seconds')),
            field('Time zone', zoneSelect(P('clock.timezone'), set('clock.timezone'), true), 'The clock only. Reminders keep using your device time.'),
            extraZones(),
            toggle('Digital readout in Clock mode', P('clock.modeDigits'), set('clock.modeDigits'),
                'Off: Clock mode shows only the clock type you picked above. Also switchable from the corner button in Clock mode.'),
            h('button', { class: 'fr-btn full', type: 'button', onclick: () => window.FR.openClockMode() }, iconEl('clock'), 'Open clock mode'),
            h('p', { class: 'fr-hint' }, 'The whole screen becomes a clock over your background. Esc to come back.')),
        section('Layout',
            toggle('Show the chat', chatOpen(), setChatOpen, 'Off leaves the background and the dock. The dock brings it back.'),
            toggle('Show the Today column', todayOpen(), setTodayOpen, 'Wide screens only. On phones Today is a panel in the rail.')),
        section('Kangaroo',
            toggle('Cheeky reactions', P('mascot.reactions'), set('mascot.reactions'), 'Stunts when someone tries to mess with the bot, or snoozes 3 times.'),
            toggle('Rude gesture', P('mascot.cheeky'), set('mascot.cheeky'), 'Off: Roo shakes a fist instead of the finger.'),
            toggle('Celebrations', P('mascot.celebrations'), set('mascot.celebrations'), 'Roo celebrates achievements.'),
            field('Performers', rotationPicks())),
        section('Sound',
            toggle('Sound effects and ambience', P('sound.enabled'), set('sound.enabled'), 'Task, focus and achievement sounds. Reminder alarms are separate.'),
            field('Volume', slider(P('sound.volume'), set('sound.volume'), 'Volume')),
            toggle('Effects', P('sound.effects'), set('sound.effects')),
            h('div', { class: 'fr-grid2' },
                field('Ambient', select([['off', 'Off'], ['auto', 'Match the scene'], ...Object.entries(AMBIENTS)], P('sound.ambient'), set('sound.ambient'))),
                field('Ambient volume', slider(P('sound.ambientVolume'), set('sound.ambientVolume'), 'Ambient volume'))),
            field('Reminder alarm volume', slider(P('sound.alarmVolume'), set('sound.alarmVolume'), 'Alarm volume'), 'The voice/bell that plays when a chat reminder goes off.'),
            toggle('Tamper alarm sound', warnOn, v => { if (typeof window.toggleWarnSound === 'function' && v !== (store.getLegacy('mate_warn_sound') !== 'off')) window.toggleWarnSound(); })),
        section('Productivity',
            h('div', { class: 'fr-grid2' },
                field('Focus (min)', h('input', { class: 'fr-input', type: 'number', min: 1, max: 180, value: P('focus.minutes'), onchange: e => store.setPreference('focus.minutes', clampInt(e.target.value, 1, 180, 25)) })),
                field('Short break (min)', h('input', { class: 'fr-input', type: 'number', min: 1, max: 60, value: P('focus.short'), onchange: e => store.setPreference('focus.short', clampInt(e.target.value, 1, 60, 5)) })),
                field('Long break (min)', h('input', { class: 'fr-input', type: 'number', min: 1, max: 90, value: P('focus.long'), onchange: e => store.setPreference('focus.long', clampInt(e.target.value, 1, 90, 15)) })),
                field('Long break every', select([[2, '2 sessions'], [3, '3 sessions'], [4, '4 sessions'], [5, '5 sessions'], [6, '6 sessions']], P('focus.longEvery'), v => store.setPreference('focus.longEvery', +v)))),
            toggle('Start breaks automatically', P('focus.autoBreak'), set('focus.autoBreak')),
            toggle('Dim the background in focus mode', P('focus.dim'), set('focus.dim')),
            toggle('Streaks', P('streaks'), set('streaks'), 'Off hides streak counters and streak achievements.'),
            toggle('Weekly report reminder', P('weeklyReport'), set('weeklyReport'))),
        section('Your data',
            h('p', { class: 'fr-note' }, iconEl('lock'), 'Tasks, history, focus sessions, events, achievements and settings are stored in this browser on this device only. They are not synced and not sent to the server. Clearing browser data deletes them, so export a backup now and then.'),
            store.prefsStore === 'cookie' ? h('p', { class: 'fr-note' }, iconEl('lock'), 'This browser blocks local storage, so your settings are being kept in a cookie instead (1 year, this site only). Tasks still need local storage.') : null,
            !store.persistent ? h('p', { class: 'fr-note warn' }, 'This browser blocked local storage, so changes only last until you close the tab.') : null,
            h('div', { class: 'fr-inline wrap' },
                h('button', { class: 'fr-btn', type: 'button', onclick: doExport }, iconEl('download'), 'Export'),
                importControl()),
            h('div', { class: 'fr-inline wrap' },
                h('button', { class: 'fr-btn', type: 'button', onclick: async () => {
                    if (await confirmDialog({ title: 'Reset preferences?', body: 'Background, clock, sound and other settings go back to defaults. Your tasks and history stay.', confirm: 'Reset' })) {
                        store.resetPreferences(); refreshPanel('settings'); toast('Preferences reset.');
                    } } }, 'Reset preferences'),
                h('button', { class: 'fr-btn danger', type: 'button', onclick: async () => {
                    if (await confirmDialog({ title: 'Delete all local data?', body: 'This permanently deletes local tasks, history, focus sessions, events and achievements from this browser. Chat history and cloud reminders are not affected. Export a backup first if you might want them back.', confirm: 'Delete everything', danger: true })) {
                        await store.clearLocalData(); toast('Local data deleted.');
                    } } }, 'Clear local data')),
            h('p', { class: 'fr-hint' }, 'Chat history has its own Clear button in the chat header. Cloud reminders are managed by chatting with the bot.')));
}
function clampInt(v, lo, hi, d) { v = Math.round(+v); return isFinite(v) ? Math.min(hi, Math.max(lo, v)) : d; }
