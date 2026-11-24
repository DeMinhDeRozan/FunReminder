/* FunReminder · LocalDataManager
 * The only module that knows how data is stored. Everything else calls these
 * methods. Local data lives in THIS browser on THIS device: it is not synced.
 */
import { PREFS_KEY, DEFAULT_PREFS, STORES, TASK_CATEGORIES, RECURRENCE, sameShape } from './storageConfig.js';
import * as ls from './localStorageAdapter.js';
import { openDatabase } from './indexedDBAdapter.js';
import { migratePrefs } from './storageMigration.js';

export const EXPORT_FORMAT = 'funreminder-export';
export const EXPORT_VERSION = 1;

export function newId(prefix = '') {
    const id = (crypto.randomUUID && crypto.randomUUID()) ||
        (Date.now().toString(36) + Math.random().toString(36).slice(2, 10));
    return prefix ? prefix + '_' + id : id;
}

/* ---------- record validation (also used for imports) ---------- */
const isStr = (v, max = 500) => typeof v === 'string' && v.length <= max;
const isTime = v => v === null || (typeof v === 'number' && isFinite(v) && v > 0);
const isDayKey = v => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v);

export const validators = {
    tasks(t) {
        return t && isStr(t.id, 80) && isStr(t.title, 200) && t.title.trim().length > 0 &&
            (t.notes == null || isStr(t.notes, 2000)) &&
            TASK_CATEGORIES.includes(t.category) &&
            isTime(t.due ?? null) && ['open', 'done'].includes(t.status) &&
            t.recurrence && RECURRENCE.includes(t.recurrence.freq) &&
            typeof t.createdAt === 'number' && typeof t.updatedAt === 'number';
    },
    completions(c) {
        return c && isStr(c.id, 120) && isStr(c.taskId, 80) && isStr(c.title, 200) &&
            typeof c.completedAt === 'number' && isDayKey(c.dayKey);
    },
    achievements(a) { return a && isStr(a.id, 60) && typeof a.unlockedAt === 'number'; },
    focusSessions(f) {
        return f && isStr(f.id, 80) && typeof f.startedAt === 'number' && typeof f.endedAt === 'number' &&
            typeof f.minutes === 'number' && f.minutes > 0 && f.minutes <= 600 && isDayKey(f.dayKey);
    },
    countdowns(c) {
        return c && isStr(c.id, 80) && isStr(c.title, 120) && c.title.trim().length > 0 &&
            typeof c.at === 'number' && (c.notes == null || isStr(c.notes, 1000));
    }
};

class LocalDataManager extends EventTarget {
    constructor() {
        super();
        this.ready = false;
        this.persistent = false;
        this.prefsPersistent = ls.persistence() !== 'memory';
        this.prefsStore = ls.persistence();          // 'local' | 'cookie' | 'memory'
        this._prefs = migratePrefs(ls.getJSON(PREFS_KEY)).values;
        this.db = null;
    }

    async init() {
        if (this.ready) return this;
        this.db = await openDatabase();
        this.persistent = this.db.persistent;
        // ask the browser not to evict our data under storage pressure (best effort)
        try { if (navigator.storage && navigator.storage.persist) navigator.storage.persist(); } catch (e) {}
        this.ready = true;
        return this;
    }

    _emit(type, detail) { this.dispatchEvent(new CustomEvent(type, { detail })); }

    /* ================= preferences (localStorage) ================= */
    getPreference(key) {
        return key in this._prefs ? this._prefs[key] : DEFAULT_PREFS[key];
    }
    getPreferences() { return { ...this._prefs }; }
    setPreference(key, value) {
        if (!(key in DEFAULT_PREFS)) { console.warn('[prefs] unknown key', key); return false; }
        if (!sameShape(DEFAULT_PREFS[key], value)) { console.warn('[prefs] wrong type for', key); return false; }
        const old = this._prefs[key];
        this._prefs[key] = value;
        ls.setJSON(PREFS_KEY, { schema: 1, values: this._prefs });
        if (JSON.stringify(old) !== JSON.stringify(value)) this._emit('pref', { key, value, old });
        return true;
    }
    resetPreferences() {
        const keep = { onboarded: this._prefs.onboarded, lastSeenAt: this._prefs.lastSeenAt };
        this._prefs = { ...DEFAULT_PREFS, ...keep };
        ls.setJSON(PREFS_KEY, { schema: 1, values: this._prefs });
        this._emit('pref', { key: '*' });
    }
    /* small runtime state that must survive a refresh (e.g. the running focus timer).
     * A stored value of the wrong shape (hand-edited, half-written, from an older
     * version) is thrown away rather than handed back. */
    getState(key, fallback = null) {
        const v = ls.getJSON('fr_state_' + key, fallback);
        if (fallback != null && !sameShape(fallback, v)) return fallback;
        return v;
    }
    setState(key, value) { if (value == null) ls.remove('fr_state_' + key); else ls.setJSON('fr_state_' + key, value); }

    /* read-only access to keys owned by the original chat app (e.g. mate_warn_sound) */
    getLegacy(key) { return ls.getRaw(key); }
    setLegacy(key, value) { return ls.setRaw(key, value); }

    /* ================= generic record helpers ================= */
    async _all(store) { return this.db.getAll(store); }
    async _put(store, rec) {
        if (!validators[store] || validators[store](rec)) {
            await this.db.put(store, rec);
            this._emit('change', { store, id: rec.id || rec.key, rec });
            return rec;
        }
        throw new Error('invalid ' + store + ' record');
    }

    /* ================= tasks ================= */
    async getTasks() { return this._all('tasks'); }
    async getTask(id) { return this.db.get('tasks', id); }
    async saveTask(input) {
        const now = Date.now();
        const task = {
            id: input.id || newId('t'),
            title: String(input.title || '').trim().slice(0, 200),
            notes: input.notes ? String(input.notes).slice(0, 2000) : '',
            category: TASK_CATEGORIES.includes(input.category) ? input.category : 'other',
            due: input.due || null,
            recurrence: input.recurrence && RECURRENCE.includes(input.recurrence.freq)
                ? { freq: input.recurrence.freq, interval: Math.max(1, Math.min(365, input.recurrence.interval | 0 || 1)), unit: input.recurrence.unit || 'day' }
                : { freq: 'none', interval: 1, unit: 'day' },
            status: input.status === 'done' ? 'done' : 'open',
            createdAt: input.createdAt || now,
            updatedAt: now,
            completedAt: input.completedAt || null,
            notifiedAt: input.notifiedAt || null,
            snoozeUntil: input.snoozeUntil || null,
            snoozeCount: input.snoozeCount || 0
        };
        return this._put('tasks', task);
    }
    async updateTask(id, changes) {
        const cur = await this.getTask(id);
        if (!cur) throw new Error('task not found: ' + id);
        const next = { ...cur, ...changes, id: cur.id, createdAt: cur.createdAt, updatedAt: Date.now() };
        return this._put('tasks', next);
    }
    async deleteTask(id) {
        await this.db.delete('tasks', id);
        this._emit('change', { store: 'tasks', id, deleted: true });
    }

    /* ================= completion history ================= */
    async getCompletedTasks() { return this._all('completions'); }
    async addCompletion(rec) { return this._put('completions', { id: rec.id || newId('c'), ...rec }); }
    async removeCompletion(id) {
        await this.db.delete('completions', id);
        this._emit('change', { store: 'completions', id, deleted: true });
    }

    /* ================= achievements ================= */
    async getAchievements() { return this._all('achievements'); }
    /* returns false if it was already unlocked: unlocks never duplicate */
    async saveAchievement(a) {
        const existing = await this.db.get('achievements', a.id);
        if (existing) return false;
        await this._put('achievements', { id: a.id, unlockedAt: a.unlockedAt || Date.now() });
        return true;
    }

    /* ================= focus sessions ================= */
    async getFocusSessions() { return this._all('focusSessions'); }
    async saveFocusSession(s) {
        // stable id from the start time: saving the same session twice (e.g. after a
        // refresh during completion) overwrites instead of duplicating
        return this._put('focusSessions', { id: s.id || 'f_' + s.startedAt, ...s });
    }

    /* ================= countdown events ================= */
    async getCountdowns() { return this._all('countdowns'); }
    async saveCountdown(input) {
        const now = Date.now();
        return this._put('countdowns', {
            id: input.id || newId('e'),
            title: String(input.title || '').trim().slice(0, 120),
            notes: input.notes ? String(input.notes).slice(0, 1000) : '',
            at: input.at,
            allDay: !!input.allDay,
            pinned: !!input.pinned,
            createdAt: input.createdAt || now,
            updatedAt: now
        });
    }
    async deleteCountdown(id) {
        await this.db.delete('countdowns', id);
        this._emit('change', { store: 'countdowns', id, deleted: true });
    }

    /* ================= small key/value meta ================= */
    async getMeta(key, fallback = null) { const r = await this.db.get('meta', key); return r ? r.value : fallback; }
    async setMeta(key, value) { await this.db.put('meta', { key, value }); }

    /* ================= export / import ================= */
    async exportData() {
        const out = {
            format: EXPORT_FORMAT, version: EXPORT_VERSION, exportedAt: new Date().toISOString(),
            note: 'FunReminder local data (this browser only). Cloud reminders are not included.',
            preferences: this.getPreferences(), data: {}
        };
        for (const store of ['tasks', 'completions', 'achievements', 'focusSessions', 'countdowns']) {
            out.data[store] = await this._all(store);
        }
        return out;
    }

    /* Check a file before touching anything. Returns a report the UI shows. */
    inspectImport(obj) {
        const report = { ok: false, errors: [], counts: {}, invalid: {}, prefs: 0 };
        if (!obj || obj.format !== EXPORT_FORMAT) { report.errors.push('Not a FunReminder export file.'); return report; }
        if (typeof obj.version !== 'number' || obj.version > EXPORT_VERSION) {
            report.errors.push('This file comes from a newer version of FunReminder.'); return report;
        }
        const data = obj.data && typeof obj.data === 'object' ? obj.data : {};
        for (const store of Object.keys(validators)) {
            const list = Array.isArray(data[store]) ? data[store] : [];
            const good = list.filter(r => { try { return validators[store](r); } catch (e) { return false; } });
            report.counts[store] = good.length;
            report.invalid[store] = list.length - good.length;
        }
        if (obj.preferences && typeof obj.preferences === 'object') {
            report.prefs = Object.keys(obj.preferences).filter(k => k in DEFAULT_PREFS).length;
        }
        report.ok = true;
        return report;
    }

    /* mode 'merge': add missing records, keep whichever copy was updated last.
     * mode 'replace': wipe local records first (the UI confirms this). */
    async importData(obj, { mode = 'merge', includePrefs = true } = {}) {
        const report = this.inspectImport(obj);
        if (!report.ok) throw new Error(report.errors.join(' '));
        const result = { added: 0, updated: 0, skipped: 0 };
        for (const store of Object.keys(validators)) {
            const incoming = (obj.data[store] || []).filter(r => { try { return validators[store](r); } catch (e) { return false; } });
            if (mode === 'replace') await this.db.clear(store);
            const current = new Map((await this._all(store)).map(r => [r.id, r]));
            const toWrite = [];
            for (const rec of incoming) {
                const cur = current.get(rec.id);
                if (!cur) { toWrite.push(rec); result.added++; }
                else if ((rec.updatedAt || rec.unlockedAt || 0) > (cur.updatedAt || cur.unlockedAt || 0)) { toWrite.push(rec); result.updated++; }
                else result.skipped++;
            }
            if (toWrite.length) await this.db.putMany(store, toWrite);
        }
        if (includePrefs && obj.preferences) {
            const merged = migratePrefs({ values: { ...this._prefs, ...obj.preferences } }).values;
            Object.keys(merged).forEach(k => { if (k !== 'onboarded' && k !== 'lastSeenAt') this.setPreference(k, merged[k]); });
        }
        this._emit('change', { store: '*' });
        return result;
    }

    async clearLocalData() {
        for (const store of Object.keys(STORES)) await this.db.clear(store);
        this._emit('change', { store: '*' });
    }
}

export const store = new LocalDataManager();
