/* What the kangaroo says.
 * One pool per performer, plus pools for specific moments: the backend's
 * roo_mood (why the tamper alarm fired) picks the pool that actually fits,
 * so a prompt-leak attempt gets plumbing jokes and a third attempt gets the
 * pirate telling you to give it a rest.
 *
 * These pools are the only source of lines. The backend keeps its own matching
 * pools in private/lambda/deminh17/lambda_function.py (*_REPLIES).
 * Keep them short: the speech bubble is one big line.
 */

export const LINES = {
    plumber: {
        default: ['Fixed ya leak, mate.', 'No leaks on my watch.', "That pipe's sealed, legend.", 'Nothin’ spillin’ today.', 'Tighten that up, will ya.', 'Leak-proof, mate.'],
        extraction: ['Me prompt’s not leakin’.', 'Sealed tight, mate.', 'Nothin’ drippin’ outta me.', 'That tap stays shut.'],
        snooze: ['Snoozin’ again? Classic.', 'That alarm’s not the leak.']
    },
    dunk: {
        default: ['Rejected, mate.', 'Get that outta here!', 'Not in my house.', 'Denied, legend.', 'Swat. Next.', 'Too easy, mate.'],
        injection: ['Blocked, mate.', 'Off the backboard!', 'Nice shot. Denied.', 'Not today, legend.'],
        probe: ['No gap in this D.', 'Ya scoutin’ me? Cute.', 'Front door’s locked, mate.'],
        snooze: ['Snooze again, lose again.', 'Get up, legend!']
    },
    pirate: {
        default: ['Savvy? Nah.', 'Arr, that’s a no.', 'Not me treasure, mate.', 'Walk the plank, ya galah.', 'Try again, matey. Still no.', 'Ya persistent. Still wrong.'],
        repeat: ['Again? Give it a rest.', 'Same trick, same no.', 'Third time’s no charm, matey.', 'Still no. Still me ship.'],
        snooze: ['Snooze be a cursed habit.', 'Up ya get, ya scallywag.']
    },
    cheer: {
        default: ['Ripper, mate!', 'Too easy!', 'You beauty!', 'Legend!', 'Bonzer effort!', "That's the stuff!", 'Onya, mate!'],
        hello: ["G'day! I'm Roo.", "G'day, legend."],
        firstTask: ['First one, legend!', 'And we’re off!'],
        streak: ['Don’t break it now!', 'Streak’s lookin’ tidy.'],
        milestone: ['Look at you go!', 'Bloody oath!']
    }
};

/* the pool for this performer right now: the moment's lines if there are any,
 * otherwise the performer's usual ones */
export function poolFor(id, moment) {
    const def = LINES[id] || {};
    return (moment && def[moment] && def[moment].length) ? def[moment] : (def.default || []);
}

/* never the same line twice in a row for the same performer */
export function pickLine(id, moment) {
    const pool = poolFor(id, moment);
    if (!pool.length) return undefined;
    const key = 'fr_line_' + id;
    let last = null;
    try { last = sessionStorage.getItem(key); } catch (e) {}
    const choices = pool.filter(l => l !== last);
    const line = (choices.length ? choices : pool)[Math.floor(Math.random() * (choices.length || pool.length))];
    try { sessionStorage.setItem(key, line); } catch (e) {}
    return line;
}
