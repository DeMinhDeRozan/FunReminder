/* Schema migrations.
 * IndexedDB: each version step only ADDS stores/indexes, so old records survive.
 * Prefs: fill defaults, drop unknown keys, coerce types, never throw.
 *
 * Preferences live in ONE versioned blob: { schema: <n>, values: {...} }.
 * Renaming a preference goes in RENAMES, so a stored value moves to its new
 * name instead of being dropped (which would reset that setting). Task history,
 * completions and focus sessions - everything streaks are counted from - live in
 * IndexedDB and are never touched here. */
import { STORES, DEFAULT_PREFS, PREFS_SCHEMA, sameShape } from './storageConfig.js';

/* step N upgrades a database from version N-1 to N */
const DB_STEPS = {
    1(db) {
        for (const [name, def] of Object.entries(STORES)) {
            if (db.objectStoreNames.contains(name)) continue;
            const store = db.createObjectStore(name, { keyPath: def.keyPath });
            def.indexes.forEach(([idx, path]) => store.createIndex(idx, path, { unique: false }));
        }
    }
    // 2(db, tx) { tx.objectStore('tasks').createIndex('category', 'category'); }
};

export function upgradeDatabase(db, oldVersion, newVersion, tx) {
    for (let v = oldVersion + 1; v <= newVersion; v++) {
        if (DB_STEPS[v]) DB_STEPS[v](db, tx);
    }
}


/* old preference name -> current name (applied before defaults are filled) */
export const RENAMES = {
    // 'clock.24h': 'clock.format',
};

export function migratePrefs(stored) {
    const out = { ...DEFAULT_PREFS };
    const raw = stored && typeof stored === 'object' && stored.values && typeof stored.values === 'object'
        ? stored.values : {};
    const values = { ...raw };
    for (const [from, to] of Object.entries(RENAMES)) {
        if (from in values && !(to in values)) values[to] = values[from];
    }
    for (const key of Object.keys(DEFAULT_PREFS)) {
        if (key in values && sameShape(DEFAULT_PREFS[key], values[key])) out[key] = values[key];
    }
    return { schema: PREFS_SCHEMA, values: out };
}
