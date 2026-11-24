/* FunReminder · storage config
 * One place that says what lives where. Feature code never touches
 * localStorage / IndexedDB directly: it goes through localDataManager.js.
 *
 *  localStorage  -> small preferences (one JSON blob, key PREFS_KEY)
 *  IndexedDB     -> growing user records (tasks, history, achievements, ...)
 *  DynamoDB      -> cloud reminders only (existing Lambda API, unchanged)
 */

export const DB_NAME = 'funreminder';
export const DB_VERSION = 1;              // bump + add a step in storageMigration.js

/* IndexedDB object stores: keyPath + indexes ([name, keyPath]) */
export const STORES = {
    tasks:         { keyPath: 'id', indexes: [['status', 'status'], ['due', 'due']] },
    completions:   { keyPath: 'id', indexes: [['taskId', 'taskId'], ['dayKey', 'dayKey']] },
    achievements:  { keyPath: 'id', indexes: [] },
    focusSessions: { keyPath: 'id', indexes: [['dayKey', 'dayKey']] },
    countdowns:    { keyPath: 'id', indexes: [] },
    meta:          { keyPath: 'key', indexes: [] }
};

export const PREFS_KEY = 'fr_prefs';
export const PREFS_SCHEMA = 1;            // bump + add a step in migratePrefs()

/* Every preference with its default. Unknown keys are dropped on load,
 * so a typo in feature code can't silently create a new preference. */
export const DEFAULT_PREFS = {
    // appearance
    'scene': 'original',                  // original | beach | desert | grass | night
    'theme': 'dial',                      // dial | contrast
    'motion': 'system',                   // system | reduced (can't force more motion than the device allows)
    'clock.format': '24',                 // 24 | 12
    'clock.seconds': true,
    'clock.date': 'short',                // short | long | numeric
    'clock.timezone': 'local',            // 'local' or an IANA name
    'clock.extraZones': [],               // up to 3 IANA names
    'clock.dial': 'subtle',               // off | subtle | bold
    'clock.face': 'original',             // which clock shows behind the chat (see features/clockface.js)
    'clock.modeDigits': true,             // Clock mode: show its big digital readout, or just the chosen clock
    'clock.size': 'normal',               // normal | large
    // mascot
    'mascot.reactions': true,             // cameos for tamper alarm, snooze nagging, easter eggs
    'mascot.cheeky': true,                // the finger. Off = fist shake instead
    'mascot.celebrations': true,          // kangaroo celebrates achievements
    'mascot.rotation': ['plumber', 'dunk', 'pirate'],
    // sound
    'sound.enabled': true,                // master switch for the new sounds (sfx + ambient)
    'sound.volume': 0.7,                  // 0..1
    'sound.effects': true,
    'sound.ambient': 'off',               // off | auto | ocean | wind | rain | meadow | crickets | brown
    'sound.ambientVolume': 0.35,
    'sound.alarmVolume': 0.8,             // cloud reminder alarm (existing player)
    // productivity
    'focus.minutes': 25,
    'focus.short': 5,
    'focus.long': 15,
    'focus.longEvery': 4,
    'focus.autoBreak': false,
    'focus.dim': true,
    'streaks': true,
    'weeklyReport': true,
    'tasks.defaultCategory': 'personal',
    // layout (remembered across visits)
    'ui.chat': true,                      // chat panel open
    'ui.today': true,                     // Today column open (wide screens)
    // misc
    'onboarded': false,
    'lastSeenAt': 0
};

/* a preference value must have the same shape as its default: arrays stay
 * arrays, plain objects stay plain objects (typeof alone can't tell them apart) */
export function sameShape(def, val) {
    if (Array.isArray(def)) return Array.isArray(val);
    if (def !== null && typeof def === 'object') return val !== null && typeof val === 'object' && !Array.isArray(val);
    return typeof def === typeof val;
}

export const TASK_CATEGORIES = ['personal', 'study', 'work', 'health', 'other'];
export const RECURRENCE = ['none', 'daily', 'weekly', 'monthly', 'custom'];
