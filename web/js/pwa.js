/* PWA bits: service worker registration + "update ready" prompt.
 * The same sw.js also handles Web Push for cloud reminders, so registering it
 * here is harmless: it is the same registration the chat code uses. */
import { toast } from './core/ui.js';

export function initPwa() {
    if (!('serviceWorker' in navigator) || location.protocol === 'file:') return;
    // don't fight a dev server's hot reload
    if (/^(localhost|127\.0\.0\.1)$/.test(location.hostname) && !new URLSearchParams(location.search).has('sw')) return;

    let reloading = false;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
        if (reloading) return;
        reloading = true;
        location.reload();
    });

    navigator.serviceWorker.register('sw.js').then(reg => {
        const offer = worker => toast('A new version of FunReminder is ready.', {
            timeout: 0, iconName: 'download',
            actions: [{ label: 'Reload', run: () => worker.postMessage({ type: 'SKIP_WAITING' }) }]
        });
        if (reg.waiting && navigator.serviceWorker.controller) offer(reg.waiting);
        reg.addEventListener('updatefound', () => {
            const w = reg.installing;
            if (!w) return;
            w.addEventListener('statechange', () => {
                if (w.state === 'installed' && navigator.serviceWorker.controller) offer(w);
            });
        });
        // check for a new version when the user comes back to the tab
        document.addEventListener('visibilitychange', () => { if (!document.hidden) reg.update().catch(() => {}); });
    }).catch(e => console.warn('[pwa] service worker not registered:', e && e.message));
}
