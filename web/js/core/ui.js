/* Tiny UI kit: element builder, toasts, confirm dialog, panel (sheet) manager.
 * No framework: panels re-render their own body when their data changes. */
import { icon } from './icons.js';

/* h('div', {class:'x', onclick: fn}, child, 'text', ...) */
export function h(tag, attrs, ...kids) {
    const el = document.createElement(tag);
    if (attrs) for (const [k, v] of Object.entries(attrs)) {
        if (v == null || v === false) continue;
        if (k === 'class') el.className = v;
        else if (k === 'html') el.innerHTML = v;
        else if (k === 'dataset') Object.assign(el.dataset, v);
        else if (k === 'style' && typeof v === 'object') Object.assign(el.style, v);
        else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2), v);
        else if (v === true) el.setAttribute(k, '');
        else el.setAttribute(k, v);
    }
    for (const kid of kids.flat()) {
        if (kid == null || kid === false) continue;
        el.appendChild(kid instanceof Node ? kid : document.createTextNode(String(kid)));
    }
    return el;
}
export const iconEl = (name, cls) => { const s = document.createElement('span'); s.className = 'fr-ico'; s.innerHTML = icon(name, cls); return s; };

/* ---------- toasts ---------- */
let toastBox = null;
export function toast(msg, { actions = [], timeout = 4500, tone = '', iconName = '' } = {}) {
    if (!toastBox) {
        toastBox = h('div', { class: 'fr-toasts', role: 'status', 'aria-live': 'polite' });
        document.body.appendChild(toastBox);
    }
    const t = h('div', { class: 'fr-toast ' + tone },
        iconName ? iconEl(iconName) : null,
        h('div', { class: 'fr-toast-msg' }, msg));
    let timer;
    const close = () => {
        clearTimeout(timer);
        t.classList.add('out');
        setTimeout(() => t.remove(), 260);
    };
    actions.forEach(a => t.appendChild(h('button', { class: 'fr-toast-btn', type: 'button', onclick: () => { close(); a.run(); } }, a.label)));
    t.appendChild(h('button', { class: 'fr-toast-x', type: 'button', 'aria-label': 'Dismiss', onclick: close, html: icon('close') }));
    toastBox.appendChild(t);
    while (toastBox.children.length > 4) toastBox.firstChild.remove();
    if (timeout) timer = setTimeout(close, timeout);
    return close;
}

/* ---------- confirm dialog (native <dialog>, keyboard + focus handled by the browser) ---------- */
export function confirmDialog({ title, body = '', confirm = 'Confirm', cancel = 'Cancel', danger = false }) {
    return new Promise(resolve => {
        const d = h('dialog', { class: 'fr-dialog' },
            h('h3', null, title),
            body ? h('p', null, body) : null,
            h('div', { class: 'fr-dialog-actions' },
                h('button', { class: 'fr-btn', type: 'button', value: 'no', onclick: () => d.close('no') }, cancel),
                h('button', { class: 'fr-btn ' + (danger ? 'danger' : 'primary'), type: 'button', onclick: () => d.close('yes') }, confirm)));
        d.addEventListener('close', () => { resolve(d.returnValue === 'yes'); d.remove(); });
        document.body.appendChild(d);
        if (d.showModal) d.showModal(); else resolve(window.confirm(title + '\n' + body));
    });
}

/* ---------- panels ---------- */
const panels = new Map();
let rail, railAnchor = null, sheet, sheetBody, sheetTitle, scrim, current = null, cleanup = null, lastFocus = null;
const wideMQ = window.matchMedia('(min-width: 1200px)');

export function isWide() { return wideMQ.matches; }
export function onWideChange(fn) { wideMQ.addEventListener('change', fn); }

export function registerPanel(def) { panels.set(def.id, def); }

export function mountShell(order) {
    rail = h('nav', { class: 'fr-rail', 'aria-label': 'FunReminder tools' });
    order.forEach(id => {
        const p = panels.get(id);
        // an entry with an action opens its own overlay instead of a panel
        rail.appendChild(h('button', {
            class: 'fr-rail-btn', type: 'button', dataset: { panel: id }, title: p.title,
            'aria-label': p.title, onclick: () => (p.action ? p.action(id) : current === id ? closePanel() : openPanel(id))
        }, iconEl(p.icon), h('span', { class: 'fr-rail-label' }, p.short || p.title)));
    });
    // narrow screens: the rail sits in the chat column under the header
    railAnchor = document.querySelector('.wrapper .header');
    if (railAnchor) railAnchor.insertAdjacentElement('afterend', rail); else document.body.appendChild(rail);

    scrim = h('div', { class: 'fr-scrim', onclick: closePanel });
    sheetTitle = h('h2', { class: 'fr-sheet-title', id: 'frSheetTitle' });
    sheetBody = h('div', { class: 'fr-sheet-body' });
    sheet = h('section', { class: 'fr-sheet', role: 'dialog', 'aria-modal': 'false', 'aria-labelledby': 'frSheetTitle', 'aria-hidden': 'true' },
        h('header', { class: 'fr-sheet-head' }, sheetTitle,
            h('button', { class: 'fr-icon-btn', type: 'button', 'aria-label': 'Close', onclick: closePanel, html: icon('close') })),
        sheetBody);
    document.body.append(scrim, sheet);
    document.addEventListener('keydown', e => {
        if (e.key === 'Escape' && current && !document.querySelector('dialog[open]')) closePanel();
    });
}

export function openPanel(id) {
    const p = panels.get(id);
    if (!p || !p.render) return;
    if (cleanup) { try { cleanup(); } catch (e) {} cleanup = null; }
    if (!current) lastFocus = document.activeElement;
    current = id;
    sheet.dataset.panel = id;
    sheetTitle.textContent = p.title;
    sheetBody.replaceChildren();
    sheetBody.scrollTop = 0;
    cleanup = p.render(sheetBody) || null;
    document.body.classList.add('fr-sheet-open');
    sheet.setAttribute('aria-hidden', 'false');
    rail.querySelectorAll('.fr-rail-btn').forEach(b => b.classList.toggle('active', b.dataset.panel === id));
    rail.querySelectorAll('.fr-rail-btn').forEach(b => b.setAttribute('aria-pressed', b.dataset.panel === id ? 'true' : 'false'));
    // focus a text field if the panel starts with one; never a button, or the
    // first option in a picker looks selected
    requestAnimationFrame(() => {
        const f = sheetBody.querySelector('[autofocus], input[type="text"], input[type="search"], textarea');
        if (f && !matchMedia('(pointer: coarse)').matches) f.focus({ preventScroll: true });
    });
}

export function closePanel() {
    if (!current) return;
    if (cleanup) { try { cleanup(); } catch (e) {} cleanup = null; }
    current = null;
    document.body.classList.remove('fr-sheet-open');
    sheet.setAttribute('aria-hidden', 'true');
    rail.querySelectorAll('.fr-rail-btn').forEach(b => { b.classList.remove('active'); b.setAttribute('aria-pressed', 'false'); });
    if (lastFocus && lastFocus.focus) try { lastFocus.focus({ preventScroll: true }); } catch (e) {}
}

export function currentPanel() { return current; }

/* The rail normally sits in the chat column. When the chat is hidden it has to
 * move out of it, or it goes invisible with its parent (an opacity:0 ancestor
 * hides its children whatever they ask for). Only done where the rail is a
 * fixed, free-floating bar anyway. */
export function dockRail(outside) {
    if (!rail) return;
    if (outside) {
        if (rail.parentElement !== document.body) document.body.appendChild(rail);
    } else if (railAnchor && rail.parentElement !== railAnchor.parentElement) {
        railAnchor.insertAdjacentElement('afterend', rail);
    }
    rail.classList.toggle('floating', !!outside);
}
/* re-render the open panel (called when its data changes) */
export function refreshPanel(id) {
    if (current !== id) return;
    const keepScroll = sheetBody.scrollTop;
    const active = document.activeElement;
    if (active && sheetBody.contains(active) && /INPUT|TEXTAREA|SELECT/.test(active.tagName)) return; // don't wipe a form mid-typing
    if (cleanup) { try { cleanup(); } catch (e) {} }
    sheetBody.replaceChildren();
    cleanup = panels.get(id).render(sheetBody) || null;
    sheetBody.scrollTop = keepScroll;
}

/* small form helpers */
export function field(label, control, hint) {
    return h('label', { class: 'fr-field' }, h('span', { class: 'fr-field-label' }, label), control, hint ? h('span', { class: 'fr-hint' }, hint) : null);
}
export function select(options, value, onchange, attrs = {}) {
    const s = h('select', { class: 'fr-input', ...attrs, onchange: e => onchange(e.target.value) });
    options.forEach(([v, label]) => s.appendChild(h('option', { value: v, selected: String(v) === String(value) }, label)));
    return s;
}
export function toggle(label, checked, onchange, hint) {
    const input = h('input', { type: 'checkbox', role: 'switch', checked, onchange: e => onchange(e.target.checked) });
    return h('label', { class: 'fr-toggle' },
        h('span', { class: 'fr-toggle-text' }, h('span', null, label), hint ? h('span', { class: 'fr-hint' }, hint) : null),
        input, h('span', { class: 'fr-switch', 'aria-hidden': 'true' }));
}
export function section(title, ...kids) {
    return h('section', { class: 'fr-section' }, title ? h('h3', { class: 'fr-section-title' }, title) : null, ...kids);
}
/* replaceChildren that ignores null/false (DOM would print them as text) */
export function fill(el, ...kids) { el.replaceChildren(...kids.flat().filter(k => k != null && k !== false)); return el; }
export function empty(text) { return h('p', { class: 'fr-empty' }, text); }
