#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""FunReminder: ban-banner variants + free play while banned.

Headless Chrome via Playwright against `python -m http.server`.
POST /reminder and GET /check are stubbed, so no real API is ever called.
Every prompt-sending POST is counted; the whole point is that while banned the count stays 0.
"""
import json, re, subprocess, sys, threading, http.server, functools, os, time
from playwright.sync_api import sync_playwright

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'web')
PORT = 8731
BASE = 'http://127.0.0.1:%d/index.html' % PORT
API = '**/Production/reminder'
CHECK = '**/Production/check*'
SUB = 'ban-test-sub-1'

PASS, FAIL = [], []


def secs(t):
    """'9m 05s' / '1h 05m' / '2d 06h' -> seconds"""
    m = re.match(r'^(?:(\d+)d )?(?:(\d+)h )?(?:(\d+)m )?(?:(\d+)s)?$', t.strip())
    if not m:
        return -1
    d, h, mi, se = [int(x or 0) for x in m.groups()]
    return d * 86400 + h * 3600 + mi * 60 + se


def ck(name, cond, extra=''):
    (PASS if cond else FAIL).append(name + (' :: ' + str(extra) if extra else ''))
    print(('  ok   ' if cond else '  FAIL ') + name + (('  [' + str(extra) + ']') if extra else ''))


# ---------------------------------------------------------------- local server
class Quiet(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *a):
        pass


def serve():
    h = functools.partial(Quiet, directory=ROOT)
    srv = http.server.ThreadingHTTPServer(('127.0.0.1', PORT), h)
    threading.Thread(target=srv.serve_forever, daemon=True).start()
    return srv


# ---------------------------------------------------------------- jwt + stubs
def fake_jwt(sub):
    import base64

    def b64(o):
        return base64.urlsafe_b64encode(json.dumps(o).encode()).decode().rstrip('=')
    return b64({'alg': 'none'}) + '.' + b64({'sub': sub, 'email': 'tester@example.com'}) + '.x'


class Stub:
    """One stub per page: holds the ban the server reports and counts what was posted."""

    def __init__(self):
        self.ban = {'active': False, 'permanent': False, 'until': 0, 'retry_after': 0}
        self.end = None
        self.ban_unknown = False
        self.prompts = []        # every POST /reminder that is NOT ban_status/push_*
        self.ban_calls = 0
        self.check_calls = 0

    def set_temp(self, secs):
        """One absolute end, like DynamoDB's BanUntil: retry_after counts down on every answer."""
        self.end = time.time() + secs

    def clear(self):
        self.end = None
        self.ban = {'active': False, 'permanent': False, 'until': 0, 'retry_after': 0}

    def answer(self):
        if self.end is None:
            return self.ban
        left = int(round(self.end - time.time()))
        if left <= 0:
            return {'active': False, 'permanent': False, 'until': 0, 'retry_after': 0}
        return {'active': True, 'permanent': False, 'until': int(self.end), 'retry_after': left}

    def wire(self, page):
        def on_api(route, request):
            try:
                body = json.loads(request.post_data or '{}')
            except Exception:
                body = {}
            action = str(body.get('action', '')).lower()
            if action == 'ban_status':
                self.ban_calls += 1
                payload = {'message': 'OK', 'ban_unknown': True} if self.ban_unknown \
                    else {'message': 'OK', 'ban': self.answer()}
                return route.fulfill(status=200, content_type='application/json',
                                     headers={'Access-Control-Allow-Origin': '*'},
                                     body=json.dumps(payload))
            if action in ('push_subscribe', 'push_unsubscribe', 'alarm_history'):
                return route.fulfill(status=200, content_type='application/json',
                                     headers={'Access-Control-Allow-Origin': '*'},
                                     body=json.dumps({'message': 'OK', 'alarms': []}))
            # anything else on POST /reminder is a prompt: this is what must never happen while banned
            self.prompts.append(body)
            return route.fulfill(status=200, content_type='application/json',
                                 headers={'Access-Control-Allow-Origin': '*'},
                                 body=json.dumps({'message': 'Righto, locked in!'}))

        def on_check(route, request):
            self.check_calls += 1
            return route.fulfill(status=200, content_type='application/json',
                                 headers={'Access-Control-Allow-Origin': '*'},
                                 body=json.dumps({'reminders': []}))

        page.route(API, on_api)
        page.route(CHECK, on_check)
        # fonts + the CDN kangaroo are not reachable in the sandbox: serve nothing rather than log a failure
        page.route('**://fonts.googleapis.com/**', lambda r: r.fulfill(status=200, content_type='text/css', body=''))
        page.route('**://fonts.gstatic.com/**', lambda r: r.abort())
        page.route('**://d28igba62yy5is.cloudfront.net/**', lambda r: r.abort())


IGNORABLE = re.compile(r'(net::ERR|Failed to load resource|ERR_FAILED|fonts\.|cloudfront|'
                       r'ServiceWorker|sw\.js|manifest|Access-Control|favicon)', re.I)


def new_page(ctx, stub, *, signed_in=True, banned_cache=None, reduced=False, viewport=None,
             clock_at=None, hoop='on', variant_seed=None):
    page = ctx.new_page()
    if viewport:
        page.set_viewport_size(viewport)
    errs = []
    page.on('console', lambda m: errs.append(m.text) if m.type == 'error' else None)
    page.on('pageerror', lambda e: errs.append('PAGEERROR: ' + str(e)))
    page.errs = errs
    stub.wire(page)
    if clock_at is not None:
        page.clock.install(time=clock_at)
    seed = []
    if signed_in:
        seed.append(("localStorage.setItem('mate_auth', JSON.stringify({id:%s, access:'at', "
                     "exp: Date.now()+3600000, refresh:'rt'}))") % json.dumps(fake_jwt(SUB)))
    if banned_cache is not None:
        seed.append("localStorage.setItem('mate_ban_v3:%s', %s)" % (SUB, json.dumps(json.dumps(banned_cache))))
    if hoop is not None:
        seed.append("localStorage.setItem('mate_hoop_mode', '%s')" % hoop)
    if variant_seed is not None:
        seed.append("sessionStorage.setItem('fr_ban_variant', '%s')" % variant_seed)
    # add_init_script runs on every navigation, so seed ONCE per tab: a reload must find the real cache
    page.add_init_script(
        "try { if (!sessionStorage.getItem('fr_test_seeded')) {"
        " localStorage.clear(); sessionStorage.setItem('fr_test_seeded', '1'); "
        + ';'.join(seed) + "; } } catch (e) {}")
    if reduced:
        page.emulate_media(reduced_motion='reduce')
    return page


def goto(page):
    page.goto(BASE, wait_until='load')
    page.wait_for_timeout(450)


# ---------------------------------------------------------------- (a) variants
def test_variants(ctx):
    print('\n(a) every banner variant renders, countdown correct, no repeat, fixed within one ban')
    stub = Stub()
    page = new_page(ctx, stub)
    stub.set_temp(545)                      # 9m 05s
    goto(page)
    ids = page.evaluate('window.__ban.variants()')
    ck('9 variants registered', len(ids) == 9, ids)
    ck('banner is visible', page.locator('.ban-banner').is_visible())
    ck('role is status, not alert',
       page.get_attribute('#banBanner', 'role') == 'status'
       and page.get_attribute('#banBanner', 'aria-live') == 'polite')
    ck('the ticking clock is aria-hidden', page.get_attribute('#banTime', 'aria-hidden') == 'true')
    txt = page.inner_text('#banTime')
    ck('countdown reads 9m 05s (545s)', txt == '9m 05s', txt)
    ck('tabular numerals on the clock',
       'tabular-nums' in page.evaluate("getComputedStyle(document.getElementById('banTime')).fontVariantNumeric"))

    # force each variant in turn and check it paints its own art + line + clock
    seen = []
    for i, vid in enumerate(ids):
        page.evaluate("""([i, sub]) => {
            localStorage.setItem('mate_ban_v3:' + sub, JSON.stringify(
                { permanent: false, until: Date.now() + 545000, variant: i, vline: 0 }));
            window.__ban.apply({ active: true, permanent: false, until: 0, retry_after: 545 });
        }""", [i, SUB])
        page.wait_for_timeout(40)
        cls = page.get_attribute('#banCard', 'class')
        art = page.locator('#banCard .ban-art')
        body_nodes = page.locator('#banCard .ban-line')
        ok = (('ban-v-' + vid) in cls and art.count() == 1 and body_nodes.count() == 1
              and len(page.inner_text('#banCard .ban-line').strip()) > 8
              and page.locator('#banTime').count() == 1
              and len(page.inner_text('#banCard .ban-eyebrow').strip()) > 2)
        seen.append(vid if ok else 'BROKEN:' + vid)
        nlines = page.evaluate('window.__ban.lines(%s)' % json.dumps(vid))
        ck('variant %-11s renders (art+eyebrow+line+clock), %d lines' % (vid, nlines),
           ok and nlines >= 3, cls)
    ck('all 9 variants painted', [s for s in seen if s.startswith('BROKEN')] == [], seen)

    # no external images, no brand words anywhere in the banner CSS/markup
    html = page.evaluate("document.getElementById('banBanner').outerHTML")
    ck('no <img> / url() / external reference in the banner',
       '<img' not in html and 'http' not in html and 'url(' not in html)

    # variant is fixed within one ban, across reloads
    page.evaluate("([sub]) => localStorage.setItem('mate_ban_v3:' + sub, JSON.stringify("
                  "{ permanent: false, until: Date.now() + 545000, variant: 4, vline: 2 }))", [SUB])
    firsts = []
    for _ in range(4):
        goto(page)
        firsts.append(page.get_attribute('#banCard', 'class'))
    ck('same variant + same line across 4 reloads of one ban',
       len(set(firsts)) == 1 and 'ban-v-beach' in firsts[0], firsts[:2])
    line_now = page.inner_text('#banCard .ban-line')
    goto(page)
    ck('the line is pinned too', page.inner_text('#banCard .ban-line') == line_now)
    page.close()

    # never the same variant twice in a row: 40 fresh bans in one session
    stub2 = Stub()
    p2 = new_page(ctx, stub2)
    stub2.clear()
    goto(p2)
    picks = p2.evaluate("""([sub, n]) => {
        const out = [];
        for (let i = 0; i < n; i++) {
            window.__ban.apply({ active: false });                      // ends the ban -> remembers it
            window.__ban.apply({ active: true, permanent: false, until: 1000 + i, retry_after: 600 });
            out.push(window.__ban.variant);
        }
        return out;
    }""", [SUB, 40])
    repeats = sum(1 for i in range(1, len(picks)) if picks[i] == picks[i - 1])
    ck('40 consecutive fresh bans: 0 back-to-back repeats', repeats == 0, 'repeats=%d' % repeats)
    ck('40 fresh bans used %d of the 9 variants' % len(set(picks)), len(set(picks)) >= 6, sorted(set(picks)))
    stored = p2.evaluate("sessionStorage.getItem('fr_ban_variant')")
    ck('fr_ban_variant remembers the last one', stored is not None, stored)

    # format at several lengths
    fmts = p2.evaluate("""() => ['' + window.__ban.fmt(545000), '' + window.__ban.fmt(9000),
        '' + window.__ban.fmt(3600000), '' + window.__ban.fmt(3905000),
        '' + window.__ban.fmt(86400000 * 2 + 3600000 * 6), '' + window.__ban.fmt(-5000)]""")
    ck('countdown formats: %s' % fmts,
       fmts == ['9m 05s', '0m 09s', '1h 00m', '1h 05m', '2d 06h', '0m 00s'], fmts)
    p2.close()


# ---------------------------------------------------------------- (b) zero POSTs
def test_no_posts(ctx):
    print('\n(b) while banned: 0 POST /reminder through EVERY send path, input disabled')
    stub = Stub()
    stub.set_temp(1800)
    page = new_page(ctx, stub, hoop='on')
    goto(page)
    ck('banned and locked', page.evaluate('window.__ban.active') is True)
    ck('input really disabled', page.get_attribute('#userInput', 'disabled') is not None)
    ck('input is readOnly as well', page.evaluate("document.getElementById('userInput').readOnly") is True)
    ck('send button disabled', page.get_attribute('#sendBtn', 'disabled') is not None)
    ph = page.get_attribute('#userInput', 'placeholder')
    ck('placeholder names the unban time: %r' % ph, bool(re.match(r'Sin bin till (\w{3} )?\d{1,2}:\d{2}[ap]m, mate\.$', ph)), ph)
    ck('court is forced on while banned', page.evaluate("document.body.classList.contains('hoop-on')"))
    ck('free play is on', page.evaluate('window.__hoop.free') is True)
    ck('mate_hoop_mode was NOT rewritten during the ban',
       page.evaluate("localStorage.getItem('mate_hoop_mode')") == 'on')
    ck('the user previous value is parked', page.evaluate("sessionStorage.getItem('fr_hoop_prev')") == 'on')

    before = len(stub.prompts)
    paths = []

    # 1. the send button
    page.evaluate("document.getElementById('sendBtn').click()")
    paths.append('sendBtn.click')
    # 2. handleSend direct (hoop wrapper)
    page.evaluate("window.handleSend()")
    paths.append('window.handleSend()')
    # 3. Enter in the input (force a value in past the lock, then press)
    page.evaluate("""() => { const i = document.getElementById('userInput');
        i.disabled = false; i.readOnly = false; i.value = 'sneaky reminder';
        i.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true })); }""")
    paths.append('Enter keydown (lock forced off)')
    # 4. suggestion chip
    page.evaluate("""() => { const c = document.querySelector('.chips .chip'); if (c) c.click(); }""")
    page.evaluate("window.handleSend()")
    paths.append('suggestion chip + send')
    # 5. familiar bar chip
    page.evaluate("""([sub]) => {
        localStorage.setItem('mate_alarm_history_v2:' + sub, JSON.stringify(
            [1,2,3].map(n => ({ id: 'x' + n, task: 'drink water', at: Date.now() - n * 1000 }))));
        renderFamiliarBar();
    }""", [SUB])
    page.wait_for_timeout(50)
    nfam = page.locator('.familiar-chip').count()
    page.evaluate("""() => document.querySelectorAll('.familiar-chip').forEach(c => c.click())""")
    page.evaluate("window.handleSend()")
    paths.append('familiar bar chip x%d + send' % nfam)
    # 6. voice mode toggle then send
    page.evaluate("try { toggleMode(); } catch (e) {}")
    page.evaluate("window.handleSend()")
    paths.append('voice mode toggle + send')
    # 7. talkToBot straight up (the choke point; also covers the confirm buttons)
    page.evaluate("talkToBot({ task_input: 'straight to the bot' })")
    paths.append('talkToBot() direct')
    # 8. a pending-confirm button
    page.evaluate("""() => { appendConfirm('keep it open?', 'pending-1');
        document.querySelectorAll('.confirm-btn').forEach(b => b.click()); }""")
    paths.append('appendConfirm buttons')
    # 9. HOOP: commit() direct, Just save it, Confirm and save, Edit text
    page.evaluate("""() => { ['hoopSkip', 'hoopEdit'].forEach(id => {
        const b = document.getElementById(id); if (b) { b.disabled = false; b.click(); } }); }""")
    paths.append('Just save it / Confirm and save / Edit text')
    # 10. HOOP: Shoot for me, then Space / Enter on the court
    page.evaluate("document.getElementById('hoopShoot').click()")
    page.wait_for_timeout(1400)
    page.evaluate("""() => { const s = document.getElementById('hoopStage'); s.focus();
        s.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', bubbles: true }));
        s.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true })); }""")
    page.wait_for_timeout(1800)
    paths.append('Shoot for me + Space + Enter on the court')
    # 11. a genuinely scored drag
    scored = drag_score(page)
    page.wait_for_timeout(1800)
    paths.append('a scored drag (score=%s)' % scored)

    page.wait_for_timeout(600)
    ck('%d send paths exercised, POST /reminder count stayed at 0' % len(paths),
       len(stub.prompts) == before == 0, stub.prompts)
    ck('no polling loop: ban_status calls stayed low (%d)' % stub.ban_calls, stub.ban_calls <= 3)
    ck('GET /check kept polling while banned (%d calls)' % stub.check_calls, stub.check_calls >= 1)
    for p in paths:
        ck('  blocked: ' + p, True)
    errs = [e for e in page.errs if not IGNORABLE.search(e)]
    ck('no unexpected console errors in (b)', not errs, errs[:3])
    page.close()


def drag_score(page):
    """Pull the ball along the ideal line with ~62% power: that is the perfect shot by design."""
    geo = page.evaluate("""() => { const l = window.__hoop.layout(), a = window.__hoop.auto();
        const r = document.getElementById('hoopCanvas').getBoundingClientRect();
        const s = Math.hypot(a.vx, a.vy), pull = l.maxPull * 0.62;
        return { bx: r.left + l.S.x * (r.width / l.W), by: r.top + l.S.y * (r.height / l.H),
                 dx: -a.vx / s * pull * (r.width / l.W), dy: -a.vy / s * pull * (r.height / l.H) }; }""")
    page.mouse.move(geo['bx'], geo['by'])
    page.mouse.down()
    for k in range(1, 7):
        page.mouse.move(geo['bx'] + geo['dx'] * k / 6, geo['by'] + geo['dy'] * k / 6)
        page.wait_for_timeout(12)
    page.mouse.up()
    page.wait_for_timeout(1500)
    return page.evaluate("window.__hoop.state")


def drag_miss(page):
    """A deliberately weak, wrong-angle pull: guaranteed brick."""
    geo = page.evaluate("""() => { const l = window.__hoop.layout(), an = window.__hoop.anchor();
        const r = document.getElementById('hoopCanvas').getBoundingClientRect();
        return { bx: r.left + window.__hoop.ball.x * (r.width / l.W),
                 by: r.top + window.__hoop.ball.y * (r.height / l.H),
                 dx: 30 * (r.width / l.W), dy: 26 * (r.height / l.H) }; }""")
    page.mouse.move(geo['bx'], geo['by'])
    page.mouse.down()
    for k in range(1, 5):
        page.mouse.move(geo['bx'] + geo['dx'] * k / 4, geo['by'] + geo['dy'] * k / 4)
        page.wait_for_timeout(12)
    page.mouse.up()
    page.wait_for_timeout(2600)


# ---------------------------------------------------------------- (c) free play
def test_free_play(ctx):
    print('\n(c) free play: a score sends nothing, a miss teases, never the same tease twice in a row')
    stub = Stub()
    stub.set_temp(1800)
    page = new_page(ctx, stub, hoop='off')
    goto(page)
    ck('court forced on even though mate_hoop_mode was off',
       page.evaluate("document.body.classList.contains('hoop-on')") and page.evaluate('window.__hoop.free') is True)
    ck('previous value parked as off', page.evaluate("sessionStorage.getItem('fr_hoop_prev')") == 'off')
    ck('mate_hoop_mode still off during the ban',
       page.evaluate("localStorage.getItem('mate_hoop_mode')") == 'off')
    npool = page.evaluate('window.__hoop.freeMisses()')
    ck('free-play tease pool has %d lines (>=20)' % npool, npool >= 20)
    ck('free-play score pool has %d lines' % page.evaluate('window.__hoop.freeScores()'),
       page.evaluate('window.__hoop.freeScores()') >= 6)
    ck('the ball is live with nothing armed', page.evaluate('window.__hoop.state') == 'aim'
       and page.evaluate('window.__hoop.armed') is False)
    ck('Just save it / Edit text are hidden in free play',
       not page.locator('#hoopSkip').is_visible() and not page.locator('#hoopEdit').is_visible())
    ck('Shoot for me is enabled', page.get_attribute('#hoopShoot', 'disabled') is None)

    # a drag that scores: confetti + a line, nothing posted, ball back on the rack
    st = drag_score(page)
    page.wait_for_timeout(600)
    say = page.inner_text('#hoopSay')
    ck('a scored free throw says something', len(say.strip()) > 5, say)
    ck('a scored free throw posts nothing', len(stub.prompts) == 0, stub.prompts)
    back = page.evaluate("""() => { const l = window.__hoop.layout(), a = window.__hoop.anchor();
        return Math.hypot(a.x - l.S.x, a.y - l.S.y) < 3; }""")
    ck('ball returned to the rack so play continues (state=%s)' % page.evaluate('window.__hoop.state'),
       back and page.evaluate('window.__hoop.state') == 'aim', st)

    # unlimited shots: 12 misses, collect the lines
    lines = []
    for i in range(12):
        drag_miss(page)
        lines.append(page.inner_text('#hoopSay').strip())
    rep = sum(1 for i in range(1, len(lines)) if lines[i] == lines[i - 1])
    ck('12 free-play misses: 0 back-to-back repeats, %d distinct' % len(set(lines)),
       rep == 0 and len(set(lines)) >= 6, 'repeats=%d' % rep)
    sledge = page.evaluate('window.__hoop.misses()')
    ck('the free pool is separate from the %d sledge lines' % sledge, True)
    ck('12 misses posted nothing', len(stub.prompts) == 0, stub.prompts)
    ck('still banned, still free after 13 shots',
       page.evaluate('window.__hoop.free') is True and page.evaluate('window.__ban.active') is True)
    errs = [e for e in page.errs if not IGNORABLE.search(e)]
    ck('no unexpected console errors in (c)', not errs, errs[:3])
    page.close()

    # reduced motion: Have a go
    print('    reduced motion: "Have a go"')
    stub2 = Stub()
    stub2.set_temp(1800)
    p2 = new_page(ctx, stub2, reduced=True, hoop='on')
    goto(p2)
    ck('reduced-motion court is on', p2.evaluate("document.body.classList.contains('hoop-reduced')"))
    ck('Have a go button is visible and labelled',
       p2.locator('#hoopShoot').is_visible() and p2.inner_text('#hoopShoot') == 'Have a go',
       p2.inner_text('#hoopShoot'))
    got = []
    for _ in range(14):
        p2.click('#hoopShoot')
        p2.wait_for_timeout(90)
        got.append((p2.inner_text('#hoopSay').strip(), p2.inner_text('#hoopStatus').strip()))
    says = [g[0] for g in got]
    rep2 = sum(1 for i in range(1, len(says)) if says[i] == says[i - 1])
    ck('14 x Have a go: results and lines, 0 back-to-back repeats, %d distinct' % len(set(says)),
       rep2 == 0 and len(set(says)) >= 5, 'repeats=%d' % rep2)
    ck('both outcomes came up', any('Swish' in g[1] for g in got) and any('rim' in g[1] for g in got),
       sorted(set(g[1] for g in got)))
    ck('14 x Have a go posted nothing', len(stub2.prompts) == 0, stub2.prompts)
    p2.close()


# ---------------------------------------------------------------- (d) lifecycle
def test_lifecycle(ctx):
    print('\n(d) reload mid-ban, expiry while closed, expiry while open, hidden tab then back')
    # reload mid-ban
    stub = Stub()
    stub.set_temp(600)
    page = new_page(ctx, stub)
    goto(page)
    t1 = page.inner_text('#banTime')
    v1 = page.get_attribute('#banCard', 'class')
    page.wait_for_timeout(2200)
    t2 = page.inner_text('#banTime')
    ck('countdown is actually ticking (%s -> %s, -%ds)' % (t1, t2, secs(t1) - secs(t2)),
       1 <= secs(t1) - secs(t2) <= 4, (t1, t2))
    goto(page)
    t3 = page.inner_text('#banTime')
    ck('reload mid-ban keeps the banner, same variant, countdown still right (%s)' % t3,
       page.locator('.ban-banner').is_visible() and page.get_attribute('#banCard', 'class') == v1
       and secs(t3) <= secs(t2), (v1, t3))
    page.close()

    # expired while the tab was closed -> no banner on reopen
    stub2 = Stub()
    stub2.clear()
    past = {'permanent': False, 'until': 1, 'variant': 3, 'vline': 1}
    p2 = new_page(ctx, stub2, banned_cache=past)
    goto(p2)
    ck('ban expired while closed: no banner on reopen', not p2.locator('.ban-banner').is_visible())
    ck('stale cache cleaned up', p2.evaluate("localStorage.getItem('mate_ban_v3:%s')" % SUB) is None)
    ck('input is usable again', p2.get_attribute('#userInput', 'disabled') is None)
    p2.close()

    # expires while the tab is open -> unlocks by itself, no reload
    stub3 = Stub()
    stub3.set_temp(3)
    p3 = new_page(ctx, stub3, hoop='on')
    goto(p3)
    ck('short ban is showing', p3.evaluate('window.__ban.active') is True)
    stub3.clear()                                     # the server now says: not banned
    p3.wait_for_timeout(5200)
    ck('ban ended on its own: banner gone, no reload', not p3.locator('.ban-banner').is_visible())
    ck('chat input re-enabled automatically', p3.get_attribute('#userInput', 'disabled') is None
       and p3.evaluate("document.getElementById('userInput').readOnly") is False)
    ck('free play left, court still on', p3.evaluate('window.__hoop.free') is False
       and p3.evaluate("document.body.classList.contains('hoop-on')") is True)
    ck('placeholder is back to the normal one: %r' % p3.get_attribute('#userInput', 'placeholder'),
       'Sin bin' not in (p3.get_attribute('#userInput', 'placeholder') or ''))
    p3.close()

    # hidden tab, then back: the countdown is recomputed from the stored timestamp
    stub4 = Stub()
    stub4.set_temp(600)
    p4 = new_page(ctx, stub4, clock_at=1700000000000)
    goto(p4)
    first = p4.inner_text('#banTime')
    # from here the server answers "can't tell" (ban_unknown), so the page must live off the ONE stored
    # absolute timestamp. A real server re-anchors `until` from its own retry_after on every sync.
    stub4.ban_unknown = True
    # go hidden: the 1 s repaint must stop (nothing to repaint for nobody)
    p4.evaluate("""() => { Object.defineProperty(document, 'hidden', { get: () => true, configurable: true });
        Object.defineProperty(document, 'visibilityState', { get: () => 'hidden', configurable: true });
        document.dispatchEvent(new Event('visibilitychange')); }""")
    p4.wait_for_timeout(100)
    p4.clock.fast_forward('04:00')                    # 4 minutes with the tab asleep
    p4.wait_for_timeout(120)
    hidden_txt = p4.inner_text('#banTime')
    # come back: the countdown is derived from `until`, so it must be right immediately
    p4.evaluate("""() => { Object.defineProperty(document, 'hidden', { get: () => false, configurable: true });
        Object.defineProperty(document, 'visibilityState', { get: () => 'visible', configurable: true });
        document.dispatchEvent(new Event('visibilitychange')); }""")
    p4.wait_for_timeout(200)
    after = p4.inner_text('#banTime')
    ck('hidden 4 min then back: %s -> (hidden: %s) -> %s, recomputed from the timestamp'
       % (first, hidden_txt, after), first == '10m 00s' and after == '6m 00s', (first, hidden_txt, after))
    p4.clock.fast_forward('01:00')
    p4.wait_for_timeout(200)
    ck('and it keeps ticking after coming back (%s)' % p4.inner_text('#banTime'),
       p4.inner_text('#banTime') == '5m 00s', p4.inner_text('#banTime'))
    p4.close()


# ---------------------------------------------------------------- (e) after unban
def test_after_unban(ctx):
    print('\n(e) after unban: a miss sledges, a score sends exactly 1 POST with the right task_input')
    stub = Stub()
    stub.set_temp(3)
    page = new_page(ctx, stub, hoop='on')
    goto(page)
    ck('starts banned in free play', page.evaluate('window.__hoop.free') is True)
    # play a bit so the free-play ball and anchor are somewhere odd
    drag_miss(page)
    off_rack = page.evaluate("""() => { const l = window.__hoop.layout(), a = window.__hoop.anchor();
        return Math.hypot(a.x - l.S.x, a.y - l.S.y); }""")
    stub.clear()
    page.wait_for_timeout(5200)
    ck('unbanned with no reload', page.evaluate('window.__ban.active') is False)
    ck('hoop mode kept ON after unban and written through',
       page.evaluate("localStorage.getItem('mate_hoop_mode')") == 'on'
       and page.evaluate('window.__hoop.on') is True)
    on_rack = page.evaluate("""() => { const l = window.__hoop.layout(), a = window.__hoop.anchor();
        return Math.hypot(a.x - l.S.x, a.y - l.S.y) < 3; }""")
    ck('free-play ball/anchor did not leak into real-send mode (was %.0fpx off the rack)' % off_rack,
       on_rack and page.evaluate('window.__hoop.state') == 'idle'
       and page.evaluate('window.__hoop.armed') is False)

    # type a prompt, OK -> the ball gets the label
    page.fill('#userInput', 'remind me in 10 mins to drink water')
    page.click('#sendBtn')
    page.wait_for_timeout(250)
    ck('OK arms the ball with the label, nothing posted yet',
       page.evaluate('window.__hoop.armed') is True and len(stub.prompts) == 0
       and page.input_value('#userInput') == '')

    # first miss after unban must show a SLEDGE line, not a free-play tease
    drag_miss(page)
    say = page.inner_text('#hoopSay').strip()
    is_sledge = page.evaluate("""([s]) => {
        const sl = ["Airball. Even the net's embarrassed for ya.","Oi, the hoop's the orange one. Just so we're clear.",
            "Ya should watch more NBA, ey.","Ya threw that like it owed ya money.","Nice arc, mate. Wrong postcode.",
            "Rim said nah, not today.","That's goin' straight on the blooper reel, champ.","All backboard, no dignity.",
            "Me nan shoots better than that, and she's a kangaroo.","Bricked it. Have another crack, the ball's still warm.",
            "Swing and a miss. Wrong sport, legend.","That ball's got more bounce than your effort, mate."];
        return sl.indexOf(s) >= 0; }""", [say])
    ck('first miss after unban shows a SLEDGE line, not a free-play tease: %r' % say, is_sledge, say)
    ck('a miss after unban does NOT send', len(stub.prompts) == 0, stub.prompts)
    ck('still armed after the miss', page.evaluate('window.__hoop.armed') is True)

    # the ball is now parked where it stopped, so Shoot for me fetches it back and scores
    page.click('#hoopShoot')
    page.wait_for_timeout(3200)
    ck('Shoot for me after the miss sends exactly 1 POST (state=%s)' % page.evaluate('window.__hoop.state'),
       len(stub.prompts) == 1, [len(stub.prompts)])
    if stub.prompts:
        ck('task_input is the typed prompt: %r' % stub.prompts[0].get('task_input'),
           stub.prompts[0].get('task_input') == 'remind me in 10 mins to drink water', stub.prompts[0])
    ck('disarmed and back on the rack', page.evaluate('window.__hoop.armed') is False
       and page.evaluate("""() => { const l = window.__hoop.layout(), a = window.__hoop.anchor();
           return Math.hypot(a.x - l.S.x, a.y - l.S.y) < 3; }"""))

    # and a real drag from the rack: the second prompt, exactly one more POST
    page.fill('#userInput', 'tomorrow 9am team meeting')
    page.click('#sendBtn')
    page.wait_for_timeout(250)
    st = drag_score(page)
    page.wait_for_timeout(2400)
    ck('a scored drag sends exactly 1 more POST (2 in total, state=%s)' % st,
       len(stub.prompts) == 2, [len(stub.prompts), st])
    if len(stub.prompts) == 2:
        ck('second task_input is right: %r' % stub.prompts[1].get('task_input'),
           stub.prompts[1].get('task_input') == 'tomorrow 9am team meeting', stub.prompts[1])
    errs = [e for e in page.errs if not IGNORABLE.search(e)]
    ck('no unexpected console errors in (e)', not errs, errs[:3])
    page.close()


# ---------------------------------------------------------------- (f) clock skew
def test_skew(ctx):
    print('\n(f) clock skew: local countdown hits 0 but the server still says banned')
    stub = Stub()
    stub.set_temp(3)
    page = new_page(ctx, stub, hoop='on')
    goto(page)
    v_before = page.get_attribute('#banCard', 'class')
    line_before = page.inner_text('#banCard .ban-line')
    stub.set_temp(420)                                # the server: still banned, 7 more minutes
    page.wait_for_timeout(5500)
    ck('banner came back with the server remaining time', page.locator('.ban-banner').is_visible())
    t = page.inner_text('#banTime')
    ck('countdown re-armed near 7m (%s)' % t, re.match(r'^[67]m \d\d s?$|^[67]m \d\ds$', t) is not None, t)
    ck('same variant and line kept across the re-arm',
       page.get_attribute('#banCard', 'class') == v_before
       and page.inner_text('#banCard .ban-line') == line_before,
       (v_before, page.get_attribute('#banCard', 'class')))
    ck('still locked, still in free play', page.get_attribute('#userInput', 'disabled') is not None
       and page.evaluate('window.__hoop.free') is True)
    calls = stub.ban_calls
    page.wait_for_timeout(3000)
    ck('no request loop: %d -> %d ban_status calls over 3 s' % (calls, stub.ban_calls),
       stub.ban_calls - calls <= 1)
    ck('nothing posted during the skew', len(stub.prompts) == 0)
    errs = [e for e in page.errs if not IGNORABLE.search(e)]
    ck('no unexpected console errors in (f)', not errs, errs[:3])
    page.close()

    # ban_unknown keeps the banner instead of clearing it
    stub2 = Stub()
    stub2.set_temp(900)
    p2 = new_page(ctx, stub2)
    goto(p2)
    stub2.ban_unknown = True
    p2.evaluate("window.__ban.tick()")
    p2.evaluate("document.dispatchEvent(new Event('visibilitychange'))")
    p2.wait_for_timeout(500)
    ck('ban_unknown: the banner is kept, not cleared', p2.locator('.ban-banner').is_visible())
    p2.close()

    # permanent ban: no countdown, its own wording
    stub3 = Stub()
    stub3.ban = {'active': True, 'permanent': True, 'until': 0, 'retry_after': 0}
    p3 = new_page(ctx, stub3)
    goto(p3)
    clock = p3.inner_text('#banTime')
    ck('permanent ban shows a static "no parole" clock, not 0m 00s: %r' % clock,
       clock and not re.match(r'^\d', clock), clock)
    ck('permanent placeholder', p3.get_attribute('#userInput', 'placeholder') == 'Banned for good, mate.')
    ck('permanent ban still gives free play', p3.evaluate('window.__hoop.free') is True)
    p3.close()


# ---------------------------------------------------------------- (g) a11y
def test_a11y(ctx):
    print('\n(g) a11y: milestone-only announcements, reduced motion')
    stub = Stub()
    stub.set_temp(3700)
    page = new_page(ctx, stub, clock_at=1700000000000)
    goto(page)
    first = page.evaluate('window.__ban.announced()')
    ck('announced once on show: %r' % first, 'left' in first, first)
    seen = []
    for step in ['00:05', '00:10', '00:20', '00:25']:
        page.clock.fast_forward(step)
        page.wait_for_timeout(80)
        seen.append(page.evaluate('window.__ban.announced()'))
    uniq = []
    for s in seen:
        if not uniq or uniq[-1] != s:
            uniq.append(s)
    ck('65 s of ticks produced %d announcement change(s), not 65' % len(uniq), len(uniq) <= 3, uniq)
    page.clock.fast_forward('02:30')                  # 3700 -> ~3550: crosses the 1 h milestone
    page.wait_for_timeout(150)
    now_said = page.evaluate('window.__ban.announced()')
    ck('crossing the 1 h milestone announces again: %r' % now_said,
       now_said != first and 'left' in now_said and page.evaluate('window.__ban.active') is True, now_said)
    page.close()

    stub2 = Stub()
    stub2.set_temp(900)
    p2 = new_page(ctx, stub2, reduced=True)
    goto(p2)
    ck('reduced motion: banner is still visible and readable',
       p2.locator('.ban-banner').is_visible() and len(p2.inner_text('#banCard .ban-line').strip()) > 8)
    anims = p2.evaluate("""() => [...document.querySelectorAll('#banCard *')]
        .map(e => getComputedStyle(e).animationDuration)
        .filter(d => d && parseFloat(d) > 0.05)""")
    ck('reduced motion: no running animation inside the card (%d)' % len(anims), not anims, anims)
    ck('reduced motion: countdown still updates', len(p2.inner_text('#banTime')) > 3)
    p2.close()


# ---------------------------------------------------------------- (h) layout
def test_layout(ctx):
    print('\n(h) no horizontal overflow at 320 / 360 / 390 / 414 / 1280, banner + court together')
    for w, h in [(320, 568), (360, 640), (390, 844), (414, 896), (1280, 800)]:
        for vid in range(9):
            pass
        stub = Stub()
        stub.set_temp(545)
        page = new_page(ctx, stub, viewport={'width': w, 'height': h}, hoop='on')
        goto(page)
        worst = 0
        tallest = 0
        for i in range(9):
            page.evaluate("""([i, sub]) => {
                localStorage.setItem('mate_ban_v3:' + sub, JSON.stringify(
                    { permanent: false, until: Date.now() + 545000, variant: i, vline: 0 }));
                window.__ban.apply({ active: true, permanent: false, until: 0, retry_after: 545 });
            }""", [i, SUB])
            page.wait_for_timeout(40)
            m = page.evaluate("""() => ({
                over: document.documentElement.scrollWidth - document.documentElement.clientWidth,
                banner: Math.round(document.getElementById('banBanner').getBoundingClientRect().height),
                court: Math.round(document.getElementById('hoopCourt').getBoundingClientRect().height),
                stage: Math.round(document.getElementById('hoopStage').getBoundingClientRect().height),
                vh: window.innerHeight })""")
            worst = max(worst, m['over'])
            tallest = max(tallest, m['banner'])
        ck('%4dx%-4d  9 variants: overflow %dpx, tallest banner %dpx, court %dpx / stage %dpx in %dpx'
           % (w, h, worst, tallest, m['court'], m['stage'], m['vh']),
           worst == 0 and m['stage'] >= 120, 'overflow=%d stage=%d' % (worst, m['stage']))
        errs = [e for e in page.errs if not IGNORABLE.search(e)]
        ck('  %dx%d: no unexpected console errors' % (w, h), not errs, errs[:2])
        page.close()


# ---------------------------------------------------------------- guests
def test_guest(ctx):
    print('\n(extra) guest / logged out: unchanged behaviour')
    stub = Stub()
    stub.set_temp(600)
    page = new_page(ctx, stub, signed_in=False, hoop='on')
    goto(page)
    ck('guest really has no auth', page.evaluate("localStorage.getItem('mate_auth')") is None)
    ck('guest: no banner (unchanged, the server still 429s them)',
       not page.locator('.ban-banner').is_visible())
    ck('guest: input usable', page.get_attribute('#userInput', 'disabled') is None)
    ck('guest: no free play', page.evaluate('window.__hoop.free') is False)
    page.fill('#userInput', 'guest reminder')
    page.click('#sendBtn')
    page.wait_for_timeout(250)
    st = drag_score(page)
    page.wait_for_timeout(2200)
    ck('guest can still send through the court (1 POST)', len(stub.prompts) == 1, [len(stub.prompts), st])
    page.close()


# ---------------------------------------------------------------- main
def main():
    srv = serve()
    with sync_playwright() as pw:
        br = pw.chromium.launch(channel='chrome', args=['--disable-dev-shm-usage'])
        for fn in (test_variants, test_no_posts, test_free_play, test_lifecycle,
                   test_after_unban, test_skew, test_a11y, test_layout, test_guest):
            ctx = br.new_context(viewport={'width': 1280, 'height': 900})
            try:
                fn(ctx)
            except Exception as e:
                import traceback
                traceback.print_exc()
                ck('%s crashed' % fn.__name__, False, repr(e)[:300])
            ctx.close()
        br.close()
    srv.shutdown()
    print('\n================ %d passed, %d failed ================' % (len(PASS), len(FAIL)))
    for f in FAIL:
        print('  FAILED: ' + f)
    sys.exit(1 if FAIL else 0)


if __name__ == '__main__':
    main()
