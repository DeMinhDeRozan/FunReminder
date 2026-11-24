/* Show and hide the two big panels, and remember the choice.
 *
 *   chat   the whole .wrapper column. Hidden with opacity + visibility, so
 *          nothing shifts; a dock pill at the corner brings it back.
 *   today  the pinned column on wide screens. A round button docked on the
 *          right edge slides it in and out and stays put in both states.
 *
 * today.js watches the same preference, so these two don't import each other.
 */
import { store } from '../storage/localDataManager.js';
import { h, iconEl, isWide, onWideChange, dockRail } from '../core/ui.js';

const CHAT = 'ui.chat', TODAY = 'ui.today';

export const chatOpen = () => store.getPreference(CHAT) !== false;
export const todayOpen = () => store.getPreference(TODAY) !== false;
export function setChatOpen(on) { store.setPreference(CHAT, !!on); }
export function setTodayOpen(on) { store.setPreference(TODAY, !!on); }

/* the chat's own hide control, in the header next to the other buttons */
export function collapseBtn(label, onClick) {
    return h('button', { class: 'fr-collapse', type: 'button', title: label, 'aria-label': label, onclick: onClick },
        iconEl('collapse'));
}

let dock = null, edge = null;

function paint() {
    const chat = chatOpen(), today = todayOpen();
    document.body.classList.toggle('fr-chat-closed', !chat);
    dockRail(!chat && isWide());              // keep the navigation reachable without the chat
    if (dock) dock.hidden = chat;
    if (edge) {
        const label = today ? 'Hide the Today panel' : 'Show the Today panel';
        edge.classList.toggle('open', today);
        edge.title = label;
        edge.setAttribute('aria-label', label);
        edge.setAttribute('aria-expanded', today ? 'true' : 'false');
    }
}

export function initViews() {
    dock = h('div', { class: 'fr-dock' },
        h('button', { class: 'fr-dock-pill', type: 'button', onclick: () => setChatOpen(true) },
            iconEl('chat'), h('span', null, 'Chat')));
    // "<" to pull the panel in, ">" to push it back out; the icon flips in CSS
    edge = h('button', { class: 'fr-edge', type: 'button', 'aria-controls': 'frToday',
        onclick: () => setTodayOpen(!todayOpen()) }, iconEl('chevron-left'));
    document.body.append(dock, edge);

    const actions = document.querySelector('.wrapper .header .actions');
    if (actions) actions.appendChild(collapseBtn('Hide the chat', () => setChatOpen(false)));

    paint();
    store.addEventListener('pref', e => {
        if (e.detail.key === CHAT || e.detail.key === TODAY || e.detail.key === '*') paint();
    });
    onWideChange(paint);
}
