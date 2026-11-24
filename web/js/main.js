/* FunReminder · app bootstrap (ES module, loaded after the original inline script).
 *
 * Local-first: everything here runs in the browser. The only network calls in
 * the page are the ORIGINAL chat ones (POST /reminder, GET /check, Cognito),
 * which this file does not touch.
 *
 * window.FR is the small bridge the inline script uses (clock, mascot, motion).
 */
import { store } from './storage/localDataManager.js';
import { registerPanel, mountShell, openPanel, closePanel, currentPanel, toast } from './core/ui.js';
import { initClock, clock } from './features/clock.js';
import { initScenes, reducedMotion, sceneById } from './features/scenes.js';
import { initAudio, playSfx } from './audio/audioManager.js';
import { renderTasksPanel, startDueChecker } from './features/tasks.js';
import { initFocus, renderFocusPanel, openFocusMode, closeFocusMode } from './features/focus.js';
import { renderStatsPanel, scheduleEvaluation, evaluate, maybeWeeklyNudge } from './features/stats.js';
import { renderEventsPanel } from './features/countdowns.js';
import { renderSettingsPanel } from './features/settings.js';
import { renderToday, mountTodayColumn, openTodayView } from './features/today.js';
import { initClockFace, clockFace } from './features/clockface.js';
import { initViews } from './features/views.js';
import { initMascot, mascot } from './features/mascot.js';
import { openClockMode, closeClockMode } from './features/clockmode.js';
import { initPwa } from './pwa.js';

const FR = window.FR = window.FR || {};
FR.version = '2.1.0';

// the inline script may already be ticking: give it the clock right away
FR.clock = clock;
FR.clockFace = clockFace;
FR.reducedMotion = reducedMotion;
FR.mascot = mascot;
FR.sceneAmbient = () => {
    const s = sceneById(store.getPreference('scene'));
    if (s.id !== 'lakeside') return s.ambient;
    const h = (clock.zoned(new Date())).getHours();          // the lake sounds different after dark
    return (h >= 6 && h < 19) ? 'meadow' : 'crickets';
};
FR.alarmVolume = () => store.getPreference('sound.alarmVolume');
FR.playSfx = playSfx;   // used by the basketball alarm mode in index.html (respects Settings > Sound)
FR.openPanel = openPanel; FR.closePanel = closePanel; FR.currentPanel = currentPanel;
FR.openFocusMode = openFocusMode; FR.closeFocusMode = closeFocusMode;
FR.openClockMode = openClockMode; FR.closeClockMode = closeClockMode;
FR.store = store;   // handy in the console: await FR.store.getTasks()

async function boot() {
    initScenes();          // visual first, so the page settles quickly
    initClock();
    initClockFace();
    await store.init();
    initAudio();
    initFocus();

    registerPanel({ id: 'today', title: 'Today', icon: 'today', render: renderToday, action: openTodayView });
    registerPanel({ id: 'tasks', title: 'Tasks', icon: 'tasks', render: renderTasksPanel });
    registerPanel({ id: 'focus', title: 'Focus', icon: 'focus', render: renderFocusPanel });
    registerPanel({ id: 'events', title: 'Countdowns', short: 'Events', icon: 'events', render: renderEventsPanel });
    registerPanel({ id: 'stats', title: 'Progress', short: 'Stats', icon: 'stats', render: renderStatsPanel });
    registerPanel({ id: 'settings', title: 'Settings', icon: 'settings', render: renderSettingsPanel });
    registerPanel({ id: 'clock', title: 'Clock mode', short: 'Clock', icon: 'clock', action: openClockMode });
    mountShell(['today', 'tasks', 'focus', 'events', 'stats', 'clock', 'settings']);
    mountTodayColumn();
    initViews();

    initMascot();
    startDueChecker();

    window.addEventListener('fr:task-completed', () => scheduleEvaluation());
    window.addEventListener('fr:focus-completed', () => scheduleEvaluation(800));
    evaluate();                 // catches anything earned while away (e.g. an imported backup)
    maybeWeeklyNudge();

    if (!store.persistent) {
        toast('This browser is blocking local storage, so tasks and settings will only last until you close the tab.', { tone: 'warn', timeout: 10000 });
    }
    document.body.classList.add('fr-ready');
    initPwa();
}

boot().catch(e => {
    // the original chat keeps working even if the new layer fails
    console.error('[FunReminder] new features failed to start:', e);
});
