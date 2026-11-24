/* Small key/value store with guard rails. One module, used by localDataManager
 * only: feature code never calls this directly.
 *
 * Order of preference:
 *   1. localStorage  - the normal case, survives restarts, no size worry here
 *   2. cookie        - when localStorage is blocked but cookies work; 1 year,
 *                      Path=/, SameSite=Lax (+ Secure on https). Cookies cap at
 *                      ~4KB per cookie, so anything bigger stays in memory.
 *   3. memory        - private mode with everything blocked, or a file:// page
 *                      (cookies are rejected there). Lasts for the tab only.
 *
 * Nothing in here throws: a blocked store or malformed JSON returns the fallback.
 */

const memory = new Map();
let lsOK = null, cookieOK = null;

const COOKIE_MAX = 3800;              // bytes left for the value once name + attributes are counted
const COOKIE_MAX_AGE = 31536000;      // 1 year, in seconds

export function isAvailable() {
    if (lsOK !== null) return lsOK;
    try {
        const k = '__fr_probe__';
        window.localStorage.setItem(k, '1');
        window.localStorage.removeItem(k);
        lsOK = true;
    } catch (e) {
        lsOK = false;
    }
    return lsOK;
}

/* ---------- cookies (fallback only) ---------- */
function cookiesUsable() {
    if (cookieOK !== null) return cookieOK;
    cookieOK = false;
    try {
        // file:// pages can't hold cookies at all, so don't pretend they can
        if (location.protocol === 'file:' || navigator.cookieEnabled === false) return cookieOK;
        document.cookie = '__fr_probe__=1; Path=/; SameSite=Lax';
        cookieOK = /(?:^|;\s*)__fr_probe__=1/.test(document.cookie);
        document.cookie = '__fr_probe__=; Path=/; Max-Age=0; SameSite=Lax';
    } catch (e) {}
    return cookieOK;
}

function cookieGet(key) {
    if (!cookiesUsable()) return null;
    try {
        const hit = document.cookie.split('; ').find(c => c.slice(0, key.length + 1) === key + '=');
        return hit ? decodeURIComponent(hit.slice(key.length + 1)) : null;
    } catch (e) { return null; }
}

function cookieSet(key, value) {
    if (!cookiesUsable()) return false;
    const enc = encodeURIComponent(value);
    if (enc.length + key.length > COOKIE_MAX) return false;        // too big for a cookie
    try {
        const secure = location.protocol === 'https:' ? '; Secure' : '';
        document.cookie = key + '=' + enc + '; Path=/; Max-Age=' + COOKIE_MAX_AGE + '; SameSite=Lax' + secure;
        return cookieGet(key) === value;                           // a rejected cookie fails quietly
    } catch (e) { return false; }
}

function cookieRemove(key) {
    if (!cookiesUsable()) return;
    try { document.cookie = key + '=; Path=/; Max-Age=0; SameSite=Lax'; } catch (e) {}
}

/* 'local' | 'cookie' | 'memory' - what the next write will actually use */
export function persistence() {
    if (isAvailable()) return 'local';
    if (cookiesUsable()) return 'cookie';
    return 'memory';
}

/* ---------- raw get/set/remove ---------- */
export function getRaw(key) {
    if (isAvailable()) {
        try {
            const v = window.localStorage.getItem(key);
            if (v != null) return v;
        } catch (e) {}
    }
    const c = cookieGet(key);                 // written before localStorage came back
    if (c != null) return c;
    return memory.has(key) ? memory.get(key) : null;
}

export function setRaw(key, value) {
    const str = String(value);
    if (isAvailable()) {
        try { window.localStorage.setItem(key, str); memory.delete(key); return true; }
        catch (e) {}                          // quota exceeded: fall through
    }
    if (cookieSet(key, str)) { memory.delete(key); return true; }
    memory.set(key, str);
    return false;
}

export function remove(key) {
    memory.delete(key);
    cookieRemove(key);
    if (!isAvailable()) return;
    try { window.localStorage.removeItem(key); } catch (e) {}
}

/* ---------- JSON helpers: a broken value returns the fallback instead of throwing ---------- */
export function getJSON(key, fallback = null) {
    const raw = getRaw(key);
    if (raw == null) return fallback;
    try {
        const v = JSON.parse(raw);
        return v === undefined ? fallback : v;
    } catch (e) {
        console.warn('[storage] malformed JSON in', key, '- using defaults');
        return fallback;
    }
}

export function setJSON(key, value) {
    return setRaw(key, JSON.stringify(value));
}
