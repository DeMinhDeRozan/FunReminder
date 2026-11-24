/* Promise wrapper around IndexedDB, plus an in-memory twin with the same API.
 * If IndexedDB can't open (old browser, private mode, blocked), the app keeps
 * working for this session and the UI says data won't be kept. */
import { DB_NAME, DB_VERSION, STORES } from './storageConfig.js';
import { upgradeDatabase } from './storageMigration.js';

function req(r) {
    return new Promise((resolve, reject) => {
        r.onsuccess = () => resolve(r.result);
        r.onerror = () => reject(r.error);
    });
}

class IDBAdapter {
    constructor(db) { this.db = db; this.persistent = true; }
    _store(name, mode = 'readonly') { return this.db.transaction(name, mode).objectStore(name); }
    getAll(store) { return req(this._store(store).getAll()); }
    get(store, key) { return req(this._store(store).get(key)); }
    put(store, value) { return req(this._store(store, 'readwrite').put(value)).then(() => value); }
    delete(store, key) { return req(this._store(store, 'readwrite').delete(key)); }
    clear(store) { return req(this._store(store, 'readwrite').clear()); }
    getAllByIndex(store, index, value) { return req(this._store(store).index(index).getAll(value)); }
    /* several writes in ONE transaction: all succeed or none do */
    putMany(store, values) {
        return new Promise((resolve, reject) => {
            const tx = this.db.transaction(store, 'readwrite');
            const s = tx.objectStore(store);
            values.forEach(v => s.put(v));
            tx.oncomplete = () => resolve(values);
            tx.onerror = () => reject(tx.error);
            tx.onabort = () => reject(tx.error || new Error('transaction aborted'));
        });
    }
}

class MemoryAdapter {
    constructor() {
        this.persistent = false;
        this.data = {};
        Object.keys(STORES).forEach(n => { this.data[n] = new Map(); });
    }
    _key(store, v) { return v[STORES[store].keyPath]; }
    _clone(v) { return v == null ? v : JSON.parse(JSON.stringify(v)); }
    async getAll(store) { return [...this.data[store].values()].map(this._clone); }
    async get(store, key) { return this._clone(this.data[store].get(key)); }
    async put(store, value) { this.data[store].set(this._key(store, value), this._clone(value)); return value; }
    async delete(store, key) { this.data[store].delete(key); }
    async clear(store) { this.data[store].clear(); }
    async getAllByIndex(store, index, value) {
        const path = STORES[store].indexes.find(i => i[0] === index)[1];
        return (await this.getAll(store)).filter(r => r[path] === value);
    }
    async putMany(store, values) { values.forEach(v => this.data[store].set(this._key(store, v), this._clone(v))); return values; }
}

export async function openDatabase({ timeoutMs = 4000 } = {}) {
    if (!('indexedDB' in window)) return new MemoryAdapter();
    try {
        const db = await new Promise((resolve, reject) => {
            const r = indexedDB.open(DB_NAME, DB_VERSION);
            const timer = setTimeout(() => reject(new Error('IndexedDB open timed out')), timeoutMs);
            r.onupgradeneeded = (ev) => upgradeDatabase(r.result, ev.oldVersion, ev.newVersion, r.transaction);
            r.onsuccess = () => { clearTimeout(timer); resolve(r.result); };
            r.onerror = () => { clearTimeout(timer); reject(r.error); };
            r.onblocked = () => console.warn('[storage] upgrade blocked by another open tab');
        });
        // another tab upgraded the schema: close so it can proceed, reload to pick it up
        db.onversionchange = () => { db.close(); };
        return new IDBAdapter(db);
    } catch (e) {
        console.warn('[storage] IndexedDB unavailable, using memory:', e && e.message);
        return new MemoryAdapter();
    }
}
