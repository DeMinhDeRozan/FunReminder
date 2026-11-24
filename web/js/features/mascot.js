/* Mascot director: decides WHEN the kangaroo shows up.
 * Reactions are rare on purpose (rate-limited, never on ordinary clicks) and all
 * of them reuse the cameo engine in cameos/ (lazy-loaded, pointer-events: none).
 *
 *  tamper alarm (server flags injection)  -> cheeky cameo matched to the reply's roo_mood
 *  3rd snooze of the same task            -> cheeky cameo
 *  achievement unlocked                   -> "cheer" cameo
 *  first visit                            -> "cheer" cameo with a hello
 *  Konami code / 5 taps on the clock      -> easter eggs
 */
import { store } from '../storage/localDataManager.js';
import { reducedMotion } from './scenes.js';
import { pickLine } from './rooLines.js';

const CHEEKY = ['plumber', 'dunk', 'pirate'];
/* backend roo_mood -> the performance whose line fits */
const MOOD_CAMEO = { extraction: 'plumber', leak: 'plumber', injection: 'dunk', probe: 'dunk', repeat: 'pirate' };
const COOLDOWN_MS = 90 * 1000;
let lastAt = 0;

export const mascot = {
    reactionsOn: () => store.getPreference('mascot.reactions'),
    clean: () => !store.getPreference('mascot.cheeky'),
    rotation() {
        const r = store.getPreference('mascot.rotation').filter(id => CHEEKY.includes(id));
        return r.length ? r : CHEEKY.slice();
    },
    moodToCameo(mood) {
        const id = MOOD_CAMEO[mood];
        return id && mascot.rotation().includes(id) ? id : undefined;   // undefined = random from rotation
    },
    /* the cameo engine calls this once it knows which performer is on */
    lineFor(id, moment) { return pickLine(id, moment); }
};

function play(id, opts = {}) {
    if (typeof window.playCameo !== 'function') return false;
    if (window.FRCameos && FRCameos.isBusy && FRCameos.isBusy()) return false;
    if (document.hidden) return false;
    lastAt = Date.now();
    return window.playCameo(id, opts);
}
function cooled() { return Date.now() - lastAt > COOLDOWN_MS; }

/* moment: which pool the line comes from (see rooLines.js) */
export function celebrate(moment) {
    if (!store.getPreference('mascot.celebrations') || !cooled()) return;
    play('cheer', { moment });
}

export function initMascot() {
    window.addEventListener('fr:achievement', e => {
        const ids = e.detail.achievements.map(a => a.id);
        celebrate(ids.includes('first-task') ? 'firstTask'
            : ids.some(id => id.startsWith('streak-')) ? 'streak'
            : ids.some(id => /-(50|100)$/.test(id)) ? 'milestone' : undefined);
    });
    window.addEventListener('fr:task-snoozed', e => {
        if (e.detail.count === 3 && mascot.reactionsOn() && cooled()) setTimeout(() => play(undefined, { moment: 'snooze' }), 600);
    });

    // first visit: a hello from the roo (once, after the page settles)
    if (!store.getPreference('onboarded')) {
        store.setPreference('onboarded', true);
        if (store.getPreference('mascot.celebrations')) setTimeout(() => play('cheer', { moment: 'hello' }), 2200);
    }

    // easter egg 1: Konami code
    const code = ['ArrowUp', 'ArrowUp', 'ArrowDown', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'ArrowLeft', 'ArrowRight', 'b', 'a'];
    let pos = 0;
    window.addEventListener('keydown', e => {
        const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
        pos = k === code[pos] ? pos + 1 : (k === code[0] ? 1 : 0);
        if (pos === code.length) { pos = 0; if (mascot.reactionsOn()) play(undefined); }
    });

    // easter egg 2: tap the digital clock five times quickly -> the dial does a lap
    const clockEl = document.getElementById('clockMain');
    const face = document.getElementById('clockFace');
    let taps = [];
    if (clockEl && face) {
        clockEl.style.cursor = 'default';
        clockEl.addEventListener('click', () => {
            const now = Date.now();
            taps = taps.filter(t => now - t < 1600); taps.push(now);
            if (taps.length >= 5) {
                taps = [];
                if (reducedMotion()) { if (typeof window.flashClock === 'function') window.flashClock(); return; }
                face.classList.remove('fr-spin'); void face.offsetWidth; face.classList.add('fr-spin');
                setTimeout(() => face.classList.remove('fr-spin'), 1700);
            }
        });
    }
}

/* one line from Roo for the Today panel, built from real numbers */
export function rooLine(s) {
    const h = new Date().getHours();
    if (s.overdue >= 3) return `${s.overdue} tasks overdue. Let's sort that out, mate.`;
    if (s.overdue) return `One thing's overdue. Knock it off and you're golden.`;
    if (s.dueToday) return `${s.dueToday} task${s.dueToday > 1 ? 's' : ''} due today. You've got this.`;
    if (s.completedToday >= 5) return `${s.completedToday} done today. Absolute weapon.`;
    if (s.completedToday) return `${s.completedToday} done today. Keep it rolling.`;
    if (h >= 23 || h < 5) return 'Bit late, innit? Set a reminder and get some sleep.';
    if (!s.tasks.length) return 'Add a task or tell me a reminder in the chat. I never forget.';
    return 'Clean slate. Pick one thing and smash it.';
}
