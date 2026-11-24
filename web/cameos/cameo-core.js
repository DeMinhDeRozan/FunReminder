/* FunReminder · kangaroo cameos — core
 * Lazy-loaded the first time the tamper alarm fires.
 * One shared rig (photo head from kangaroo.png + SVG body), many performances.
 * A performance is a file cameos/<id>.js that calls FRCameos.register({...}).
 * Everything animates with transform / opacity through the Web Animations API,
 * on a pointer-events:none stage, so the chat stays usable the whole time.
 */
(function () {
    'use strict';
    var NS = 'http://www.w3.org/2000/svg';
    var C = window.FRCameos = window.FRCameos || {};
    C.registry = C.registry || {};
    C.version = '1.0.0';
    var BASE = C.base || 'cameos/';
    var busy = false, lastId = null, imgsReady = null;
    try { lastId = sessionStorage.getItem('fr_cameo_last'); } catch (e) {}

    /* ---------- palette shared by all costumes ---------- */
    var P = C.palette = {
        fur: '#937963', furD: '#6E5848', furL: '#D3BC9E', ink: '#2E231C',
        brass: '#D9A441', brassHi: '#F4D48A', brassLo: '#8F631C',
        petrol: '#0F2427', enamel: '#17343B', cream: '#EEE6CE', red: '#C8362B'
    };
    var E = C.ease = {
        io: 'cubic-bezier(.45,0,.55,1)', out: 'cubic-bezier(.2,.8,.3,1)', in: 'cubic-bezier(.6,0,.9,.45)',
        back: 'cubic-bezier(.3,1.7,.5,1)', snap: 'cubic-bezier(.1,.9,.2,1)', lin: 'linear', step: 'steps(1,end)',
        grav: 'cubic-bezier(.4,0,1,1)', rise: 'cubic-bezier(0,0,.6,1)'
    };

    C.register = function (def) { C.registry[def.id] = def; };

    /* ---------- loading ---------- */
    var scriptCache = {};
    function loadScript(src) {
        if (!scriptCache[src]) {
            scriptCache[src] = new Promise(function (res, rej) {
                var s = document.createElement('script');
                s.src = src; s.async = true;
                s.onload = res; s.onerror = function () { delete scriptCache[src]; rej(new Error('load ' + src)); };
                document.head.appendChild(s);
            });
        }
        return scriptCache[src];
    }
    function loadImgs() {
        if (!imgsReady) {
            imgsReady = Promise.all(['roo-head.webp', 'roo-shades.webp'].map(function (f) {
                var im = new Image(); im.src = BASE + f;
                return (im.decode ? im.decode() : new Promise(function (r) { im.onload = r; })).then(function () { return BASE + f; });
            }));
        }
        return imgsReady;
    }

    /* ---------- tiny helpers ---------- */
    function clamp(v, a, b) { return Math.min(b, Math.max(a, v)); }
    function T(x, y, r, sx, sy) {
        return 'translate(' + (x || 0) + 'px,' + (y || 0) + 'px) rotate(' + (r || 0) + 'deg) scale(' +
            (sx == null ? 1 : sx) + ',' + (sy == null ? (sx == null ? 1 : sx) : sy) + ')';
    }
    C.T = T;

    /* ---------- the kangaroo rig ---------- */
    // Local units: ground at y=0, character faces +x, about 380 units tall (bobble-head proportions).
    var HEAD = { x: -76.4, y: -140.6, w: 150, h: 148.6 };
    function stroke(w) { return ' stroke="#33261E" stroke-width="' + (w || 2) + '" stroke-linejoin="round" stroke-linecap="round"'; }

    function legSVG(S, hx, fill, o) {
        return '' +
        '<g transform="translate(' + hx + ',-100)"><g data-j="hip' + S + '">' +
          '<path d="M-19,-11 C-38,10 -30,56 2,63 C30,68 48,49 39,27 C31,4 14,-20 -19,-11 Z" fill="' + fill + '"' + stroke() + '/>' +
          '<path d="M-4,4 C-12,20 -8,40 6,48" fill="none" stroke="rgba(255,255,255,.14)" stroke-width="5" stroke-linecap="round"/>' +
          '<g data-slot="thigh' + S + '">' + (o['thigh' + S] || '') + '</g>' +
          '<g transform="translate(24,46)"><g data-j="knee' + S + '">' +
            '<path d="M-7,-4 C-11,10 -22,30 -25,40 L-14,45 C-9,34 2,14 7,2 Z" fill="' + fill + '"' + stroke() + '/>' +
            '<g data-slot="shin' + S + '">' + (o['shin' + S] || '') + '</g>' +
            '<g transform="translate(-20,41)"><g data-j="ankle' + S + '">' +
              '<path d="M-9,-5 C-16,4 -11,13 -2,13 L64,13 C76,13 78,3 68,-1 C48,-5 20,-8 -9,-5 Z" fill="' + fill + '"' + stroke() + '/>' +
              '<path d="M56,13 l3,-5 M64,12 l3,-5" fill="none"' + stroke(1.6) + '/>' +
              '<g data-slot="foot' + S + '">' + (o['foot' + S] || '') + '</g>' +
              '<circle data-m="foot' + S + '" cx="26" cy="13" r=".8" fill="none"/>' +
            '</g></g>' +
          '</g></g>' +
        '</g></g>';
    }
    function armSVG(S, sx, sy, fill, o) {
        return '' +
        '<g transform="translate(' + sx + ',' + sy + ')"><g data-j="sh' + S + '">' +
          '<path d="M-8,-1 C-13,9 -11,24 -3,32 L4,32 C11,24 13,9 8,-1 C5,-9 -5,-9 -8,-1 Z" fill="' + fill + '"' + stroke() + '/>' +
          '<g data-slot="upper' + S + '">' + (o['upper' + S] || '') + '</g>' +
          '<g transform="translate(0,29)"><g data-j="el' + S + '">' +
            '<path d="M-7.5,-1 C-8.5,10 -6,21 -3,27 L3,27 C6,21 8.5,10 7.5,-1 Z" fill="' + fill + '"' + stroke() + '/>' +
            '<g data-slot="fore' + S + '">' + (o['fore' + S] || '') + '</g>' +
            '<g transform="translate(0,25)"><g data-j="wr' + S + '">' +
              '<g data-slot="prop' + S + '">' + (o['prop' + S] || '') + '</g>' +
              '<g data-j="fist' + S + '">' +
                '<ellipse cx="0" cy="9" rx="11" ry="11.5" fill="' + fill + '"' + stroke() + '/>' +
                '<path d="M-7,15 q3.5,3 7,0 q3.5,3 7,0" fill="none"' + stroke(1.4) + '/>' +
                '<path d="M-6,20 l-1,3 M0,21 l0,3 M6,20 l1,3" stroke="#1E1612" stroke-width="2.4" stroke-linecap="round"/>' +
              '</g>' +
              '<g data-j="finger' + S + '" opacity="0">' +
                '<rect x="-4.6" y="2" width="9.2" height="40" rx="4.6" fill="' + fill + '"' + stroke() + '/>' +
                '<path d="M-2.6,38 l0.6,3.5 M2.6,38 l-0.6,3.5" stroke="#1E1612" stroke-width="2" stroke-linecap="round"/>' +
                '<path d="M-3,30 q3,1.5 6,0" fill="none" stroke="#33261E" stroke-width="1.1"/>' +
                '<ellipse cx="0" cy="9" rx="11" ry="11.5" fill="' + fill + '"' + stroke() + '/>' +
                '<path d="M-7,5 q2.3,-3 4.6,0 M2.4,5 q2.3,-3 4.6,0" fill="none"' + stroke(1.4) + '/>' +
              '</g>' +
              '<g data-slot="grip' + S + '">' + (o['grip' + S] || '') + '</g>' +
              '<circle data-m="hand' + S + '" cx="0" cy="9" r=".8" fill="none"/>' +
            '</g></g>' +
          '</g></g>' +
        '</g></g>';
    }
    function eyeSVG(S, x, y) {
        return '' +
        '<g transform="translate(' + x + ',' + y + ')">' +
          '<ellipse rx="16" ry="12.5" fill="#8E7562"/>' +
          '<g clip-path="url(#frEye' + S + ')">' +
            '<ellipse rx="11.5" ry="9.5" fill="#F5F0E4"/>' +
            '<g data-j="pupil' + S + '"><circle r="4.8" fill="#1B1410"/><circle cx="-1.6" cy="-1.8" r="1.5" fill="#fff"/></g>' +
            '<g data-j="lid' + S + '"><rect x="-14" y="-34" width="28" height="24" fill="#86705E"/>' +
              '<path d="M-12,-10 L12,-10" stroke="' + P.ink + '" stroke-width="2.2" stroke-linecap="round"/></g>' +
          '</g>' +
          '<ellipse rx="11.5" ry="9.5" fill="none" stroke="' + P.ink + '" stroke-width="1.4"/>' +
        '</g>';
    }

    function rigSVG(o, uid) {
        o = o || {};
        var slot = function (name) { return o[name] || ''; };
        var s = '' +
        '<g data-j="root"><g data-j="flip">' +
          // tail (behind everything)
          '<g transform="translate(-24,-88)"><g data-j="tail1">' +
            '<path d="M6,-13 C-24,-15 -49,4 -63,31 L-49,45 C-38,22 -18,11 7,12 Z" fill="url(#frFurD' + uid + ')"' + stroke() + '/>' +
            '<g transform="translate(-56,38)"><g data-j="tail2">' +
              '<path d="M-7,-8 C-27,7 -53,31 -92,48 C-98,51 -97,57 -90,57 C-50,49 -20,27 9,8 Z" fill="url(#frFurD' + uid + ')"' + stroke() + '/>' +
              slot('tail') +
            '</g></g>' +
          '</g></g>' +
          legSVG('B', -14, 'url(#frFurD' + uid + ')', o) +
          '<g transform="translate(0,-100)"><g data-j="body">' +
            armSVG('B', -12, -104, 'url(#frFurD' + uid + ')', o) +
            '<path d="M-31,4 C-42,-30 -42,-72 -31,-98 C-24,-114 -8,-124 5,-124 C20,-124 37,-115 44,-98 C52,-78 49,-48 42,-22 C37,-1 20,10 2,10 C-14,10 -27,10 -31,4 Z" fill="url(#frFur' + uid + ')"' + stroke() + '/>' +
            '<path d="M-16,-112 C-18,-126 -12,-136 4,-137 C20,-136 27,-126 26,-112 Z" fill="url(#frFur' + uid + ')"/>' +
            '<path d="M14,-90 C30,-86 40,-70 40,-44 C40,-20 32,0 16,4 C8,5 4,-4 4,-14 C4,-44 4,-74 14,-90 Z" fill="url(#frBelly' + uid + ')"/>' +
            '<path d="M4,-96 C10,-82 26,-80 42,-92 M8,-52 q8,4 15,0 M8,-36 q8,4 15,0 M9,-20 q7,3 13,0" fill="none" stroke="rgba(60,40,28,.55)" stroke-width="1.8" stroke-linecap="round"/>' +
            '<path d="M-24,-96 C-20,-104 -10,-110 0,-112" fill="none" stroke="rgba(255,255,255,.16)" stroke-width="5" stroke-linecap="round"/>' +
            '<g data-slot="torso">' + slot('torso') + '</g>' +
            '<g transform="translate(4,-121)"><g data-j="head"><g data-j="headS">' +
              '<image href="' + o._head + '" x="' + HEAD.x + '" y="' + HEAD.y + '" width="' + HEAD.w + '" height="' + HEAD.h + '"/>' +
              (o.neck || '') +
              eyeSVG('L', -18, -74) + eyeSVG('R', 19, -75) +
              '<g data-j="blush" opacity="0"><ellipse cx="-36" cy="-44" rx="13" ry="7" fill="#E0564A" opacity=".55"/><ellipse cx="40" cy="-44" rx="13" ry="7" fill="#E0564A" opacity=".55"/></g>' +
              '<g data-j="shades"><image href="' + o._shades + '" x="' + HEAD.x + '" y="' + HEAD.y + '" width="' + HEAD.w + '" height="' + HEAD.h + '"/>' + slot('shades') + '</g>' +
              '<g transform="translate(-18,-95)"><g data-j="browL"><path d="M-13,3 C-6,-4 6,-5 13,-1" fill="none" stroke="#1E1612" stroke-width="5.5" stroke-linecap="round"/></g></g>' +
              '<g transform="translate(19,-96)"><g data-j="browR"><path d="M-13,-1 C-6,-5 6,-4 13,3" fill="none" stroke="#1E1612" stroke-width="5.5" stroke-linecap="round"/></g></g>' +
              '<g data-j="hat">' + slot('hat') + '</g>' +
              slot('face') +
              '<circle data-m="headTop" cx="0" cy="-118" r=".8" fill="none"/>' +
              '<circle data-m="mouth" cx="3" cy="-18" r=".8" fill="none"/>' +
            '</g></g></g>' +
            armSVG('F', 24, -104, 'url(#frFur' + uid + ')', o) +
          '</g></g>' +
          legSVG('F', 8, 'url(#frFur' + uid + ')', o) +
          '<circle data-m="root" cx="0" cy="0" r=".8" fill="none"/>' +
        '</g></g>';
        return s;
    }
    function defsSVG(uid, extra) {
        return '<defs>' +
            '<linearGradient id="frFur' + uid + '" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#AC917A"/><stop offset="1" stop-color="#7C6453"/></linearGradient>' +
            '<linearGradient id="frFurD' + uid + '" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#836A58"/><stop offset="1" stop-color="#56443A"/></linearGradient>' +
            '<linearGradient id="frBelly' + uid + '" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#E6D2B4"/><stop offset="1" stop-color="#BCA283"/></linearGradient>' +
            '<radialGradient id="frShadow' + uid + '"><stop offset="0" stop-color="#000" stop-opacity=".55"/><stop offset="1" stop-color="#000" stop-opacity="0"/></radialGradient>' +
            '<clipPath id="frEyeL"><ellipse rx="11.5" ry="9.5"/></clipPath><clipPath id="frEyeR"><ellipse rx="11.5" ry="9.5"/></clipPath>' +
            (extra || '') + '</defs>';
    }

    /* ---------- stage + context given to a performance ---------- */
    function makeStage() {
        var vw = window.innerWidth, vh = window.innerHeight;
        var Hu = 800, wu = Hu * vw / vh;
        if (wu < 600) { wu = 600; Hu = wu * vh / vw; }       // narrow screens: zoom out so the stunt fits
        var u = Hu / vh;
        var groundPx = clamp(vh * 0.17, 112, 172);
        var stage = document.createElement('div');
        stage.className = 'frc-stage';
        stage.setAttribute('aria-hidden', 'true');
        var svg = document.createElementNS(NS, 'svg');
        svg.setAttribute('viewBox', (-wu / 2) + ' ' + (-(Hu - groundPx * u)) + ' ' + wu + ' ' + Hu);
        svg.setAttribute('preserveAspectRatio', 'xMidYMid meet');
        svg.setAttribute('class', 'frc-svg');
        stage.appendChild(svg);
        document.body.appendChild(stage);
        return { stage: stage, svg: svg, W: wu / 2, top: -(Hu - groundPx * u), u: u };
    }

    function makeCtx(def, imgs, opts) {
        var S = makeStage();
        var D = def.duration;
        var uid = 'u' + Math.random().toString(36).slice(2, 7);
        var anims = [], events = [];
        S.svg.innerHTML = defsSVG(uid, def.defs || '') + '<g class="frc-world"></g>';
        var world = S.svg.lastChild;
        var ctx = {
            D: D, W: S.W, top: S.top, stage: S.stage, svg: S.svg, world: world, P: P, E: E, T: T, uid: uid,
            reduced: !!opts.reduced,
            opts: opts,                       // FR: per-play options (clean mode, line override)
            // FR: the line this play says. opts.lineFor(id, moment) lets the app pick a line
            // for the performance AFTER a random id has been resolved.
            line: opts.line ||
                (typeof opts.lineFor === 'function' ? opts.lineFor(def.id, opts.moment) : null) ||
                def.line,
            add: function (markup, parent) {
                var g = document.createElementNS(NS, 'g');
                g.innerHTML = markup;
                (parent || world).appendChild(g);
                return g;
            },
            q: function (root, j) { return root.querySelector('[data-j="' + j + '"]'); },
            /* keyframes: rows of [ms, x, y, rot, sx, sy, easing] */
            kT: function (node, rows, comp) {
                return push(node, rows.map(function (r) { return { t: r[0], v: { transform: T(r[1], r[2], r[3], r[4], r[5]) }, e: r[6] }; }), comp);
            },
            /* rotation-only joints: rows of [ms, deg, easing] */
            kR: function (node, rows) {
                return push(node, rows.map(function (r) { return { t: r[0], v: { transform: 'rotate(' + r[1] + 'deg)' }, e: r[2] }; }));
            },
            kO: function (node, rows) {
                return push(node, rows.map(function (r) { return { t: r[0], v: { opacity: r[1] }, e: r[2] || E.lin }; }));
            },
            at: function (ms, fn) { events.push({ t: ms, fn: fn }); },
            seek: function (t) { anims.forEach(function (a) { a.currentTime = t; }); },
            /* world-space position of a marker / element at time t (pose sampling) */
            pos: function (node, t) {
                if (t != null) ctx.seek(t);
                var r = node.getBoundingClientRect();
                var pt = S.svg.createSVGPoint(); pt.x = r.left + r.width / 2; pt.y = r.top + r.height / 2;
                return pt.matrixTransform(world.getScreenCTM().inverse());
            },
            sample: function (node, t0, t1, step) {
                var out = [];
                for (var t = t0; t <= t1 + 0.1; t += step) { var p = ctx.pos(node, Math.min(t, t1)); out.push([Math.min(t, t1), p.x, p.y]); }
                return out;
            },
            sfx: makeSfx(opts.audio)
        };
        function push(node, rows, comp) {
            rows.sort(function (a, b) { return a.t - b.t; });
            var kf = rows.map(function (r) {
                var f = { offset: clamp(r.t / D, 0, 1), easing: r.e || E.io };
                for (var k in r.v) f[k] = r.v[k];
                return f;
            });
            if (kf[0].offset > 0) { var f0 = Object.assign({}, kf[0]); f0.offset = 0; kf.unshift(f0); }
            if (kf[kf.length - 1].offset < 1) { var f1 = Object.assign({}, kf[kf.length - 1]); f1.offset = 1; kf.push(f1); }
            var a = node.animate(kf, { duration: D, fill: 'both', composite: comp || 'replace' });
            a.pause(); anims.push(a); return a;
        }

        /* the kangaroo, wearing this performance's outfit */
        ctx.roo = function (outfit) {
            var o = Object.assign({ _head: imgs[0], _shades: imgs[1] }, outfit || {});
            var shadow = ctx.add('<ellipse cx="0" cy="2" rx="78" ry="11" fill="url(#frShadow' + uid + ')"/>');
            var g = ctx.add(rigSVG(o, uid));
            var r = { g: g, shadow: shadow, j: {}, m: {} };
            ctx.roo_last = r;
            g.querySelectorAll('[data-j]').forEach(function (n) { r.j[n.getAttribute('data-j')] = n; });
            g.querySelectorAll('[data-m]').forEach(function (n) { r.m[n.getAttribute('data-m')] = n; });
            return r;
        };
        /* finger on / off for an arm: crisp swap with a tiny pop */
        ctx.hand = function (r, side, rows) {   // rows: [ms, 'fist'|'finger']
            var fist = [], fing = [];
            rows.forEach(function (row) {
                var f = row[1] === 'finger' && !opts.clean;   // FR: clean mode keeps the fist (a shake, not the finger)
                fist.push([row[0], f ? 0 : 1, E.step]); fing.push([row[0], f ? 1 : 0, E.step]);
            });
            ctx.kO(r.j['fist' + side], fist); ctx.kO(r.j['finger' + side], fing);
        };
        /* contact shadow that follows the feet and shrinks with height */
        ctx.autoShadow = function (shadowEl, marker, t0, t1, opt) {
            opt = opt || {};
            var pts = ctx.sample(marker, t0 || 0, t1 || D, 50);
            var lift = opt.lift || 420, base = opt.scale || 1;
            ctx.kT(shadowEl, pts.map(function (p) {
                var h = Math.max(0, -p[2]);
                var s = clamp(1 - h / lift, 0.3, 1) * base;
                return [p[0], p[1], 0, 0, s, s, E.lin];
            }));
            ctx.kO(shadowEl, pts.map(function (p) { return [p[0], clamp(1 - Math.max(0, -p[2]) / (lift * 1.1), 0.25, 1)]; }));
        };
        /* dust puff at (x, y) at time t */
        ctx.dust = function (x, y, t, n, spread, color) {
            n = n || 7; spread = spread || 90;
            for (var i = 0; i < n; i++) {
                var dir = (i % 2 ? 1 : -1), k = (i + 1) / n;
                var rad = 9 + 8 * Math.random();
                var c = ctx.add('<circle r="' + rad + '" fill="' + (color || '#C9B89A') + '"/>');
                var dx = dir * spread * (0.4 + 0.6 * k), dy = -(10 + 26 * Math.random());
                ctx.kT(c, [[t - 1, x, y - 4, 0, 0.2], [t, x, y - 4, 0, 0.5, 0.5, E.out], [t + 380, x + dx, y + dy, 0, 1.7, 1.7, E.out], [t + 700, x + dx * 1.1, y + dy - 10, 0, 2.1]]);
                ctx.kO(c, [[t - 1, 0], [t, 0.75], [t + 700, 0]]);
            }
        };
        /* comic speech bubble, synced to the timeline, anchored to a marker */
        ctx.say = function (text, t, hold, anchor, side) {
            var b = document.createElement('div');
            b.className = 'frc-bubble' + (side === 'left' ? ' left' : '');
            text.split(' ').forEach(function (w, i) {
                var s = document.createElement('span'); s.textContent = w; s.style.setProperty('--i', i);
                b.appendChild(s); b.appendChild(document.createTextNode(' '));
            });
            S.stage.appendChild(b);
            ctx.at(t, function () {
                var r = anchor.getBoundingClientRect();
                var x = r.left + r.width / 2, y = r.top;
                b.style.left = Math.round(clamp(x, 120, window.innerWidth - 120)) + 'px';
                b.style.top = Math.round(Math.max(70, y - 12)) + 'px';
                b.classList.add('show');
                b.animate([{ opacity: 0, transform: 'translate(-50%,-100%) scale(.4) rotate(-6deg)' },
                           { opacity: 1, transform: 'translate(-50%,-100%) scale(1.08) rotate(1.5deg)', offset: .55 },
                           { opacity: 1, transform: 'translate(-50%,-100%) scale(1) rotate(0deg)' }],
                          { duration: ctx.reduced ? 1 : 380, easing: E.out, fill: 'forwards' });
            });
            ctx.at(t + hold, function () {
                b.animate([{ opacity: 1, transform: 'translate(-50%,-100%) scale(1)' }, { opacity: 0, transform: 'translate(-50%,-112%) scale(.9)' }],
                          { duration: 260, easing: E.in, fill: 'forwards' });
            });
            return b;
        };
        ctx._run = function () {
            return new Promise(function (resolve) {
                events.sort(function (a, b) { return a.t - b.t; });
                if (ctx.reduced) {
                    // static pose card: the finger frame + the line, no movement
                    var tp = def.poseAt || D * 0.6;
                    ctx.seek(tp);
                    events.forEach(function (ev) { if (ev.fn && ev.still) ev.fn(); });
                    S.stage.classList.add('still');
                    var bub = S.stage.querySelector('.frc-bubble');
                    if (bub) {
                        var hb = ctx.roo_last && ctx.roo_last.m.headTop;
                        var rr = (hb || S.svg).getBoundingClientRect();
                        bub.style.left = Math.round(clamp(rr.left + rr.width / 2, 120, window.innerWidth - 120)) + 'px';
                        bub.style.top = Math.round(Math.max(70, rr.top - 12)) + 'px';
                        bub.style.transform = 'translate(-50%,-100%)';
                        bub.classList.add('show');
                    }
                    setTimeout(resolve, 2600);
                    return;
                }
                anims.forEach(function (a) { a.currentTime = 0; });
                var t0 = performance.now(), i = 0;
                anims.forEach(function (a) { a.play(); });
                (function tick() {
                    var t = performance.now() - t0;
                    while (i < events.length && events[i].t <= t) { try { events[i].fn(); } catch (e) {} i++; }
                    if (t < D + 60) requestAnimationFrame(tick); else resolve();
                })();
            });
        };
        ctx._destroy = function () {
            anims.forEach(function (a) { try { a.cancel(); } catch (e) {} });
            S.stage.remove();
        };
        return ctx;
    }

    /* ---------- sound bank: tiny WebAudio synths, no files ---------- */
    function makeSfx(getAudio) {
        var A = null;
        try { A = getAudio && getAudio(); } catch (e) {}
        var noop = function () {};
        var names = ['thud', 'bounce', 'boing', 'clang', 'swish', 'squeak', 'whoosh', 'pop', 'hic', 'glug', 'slide', 'crash', 'friction', 'splash', 'rattle', 'clank', 'sting'];
        var bank = {};
        if (!A || !A.ctx || A.ctx.state !== 'running') { names.forEach(function (n) { bank[n] = noop; }); bank.live = false; return bank; }
        var ctx = A.ctx, out = ctx.createGain(); out.gain.value = 0.9; out.connect(A.out);
        var nb = null;
        function noise() {
            if (!nb) { var len = ctx.sampleRate; nb = ctx.createBuffer(1, len, ctx.sampleRate); var d = nb.getChannelData(0); for (var i = 0; i < len; i++) d[i] = Math.random() * 2 - 1; }
            var s = ctx.createBufferSource(); s.buffer = nb; return s;
        }
        function env(g, t, a, peak, dec) {
            g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(peak, t + a); g.gain.exponentialRampToValueAtTime(0.0001, t + a + dec);
        }
        function osc(type, f0, f1, t, dur, peak, a) {
            var o = ctx.createOscillator(), g = ctx.createGain();
            o.type = type; o.frequency.setValueAtTime(f0, t); if (f1) o.frequency.exponentialRampToValueAtTime(f1, t + dur);
            env(g, t, a || 0.004, peak, dur); o.connect(g).connect(out); o.start(t); o.stop(t + dur + 0.05); return o;
        }
        function nz(type, f0, f1, q, t, dur, peak, a) {
            var s = noise(), f = ctx.createBiquadFilter(), g = ctx.createGain();
            f.type = type; f.Q.value = q; f.frequency.setValueAtTime(f0, t); if (f1) f.frequency.exponentialRampToValueAtTime(f1, t + dur);
            env(g, t, a || 0.004, peak, dur); s.connect(f).connect(g).connect(out); s.start(t, Math.random() * 0.5); s.stop(t + dur + 0.05);
        }
        function now() { return ctx.currentTime + 0.01; }
        bank.live = true;
        bank.thud = function (v) { var t = now(); v = v || 1; osc('sine', 130, 42, t, 0.28, 0.9 * v); nz('lowpass', 900, 200, 0.7, t, 0.12, 0.5 * v); };
        bank.bounce = function (v) { var t = now(); v = v || 1; osc('sine', 190, 70, t, 0.14, 0.7 * v); nz('bandpass', 1600, 600, 1.2, t, 0.04, 0.25 * v); };
        bank.boing = function () {
            var t = now(), o = ctx.createOscillator(), g = ctx.createGain(), lfo = ctx.createOscillator(), lg = ctx.createGain();
            o.type = 'triangle'; o.frequency.setValueAtTime(140, t); o.frequency.exponentialRampToValueAtTime(420, t + 0.12); o.frequency.exponentialRampToValueAtTime(180, t + 0.5);
            lfo.frequency.value = 17; lg.gain.value = 40; lfo.connect(lg).connect(o.frequency);
            env(g, t, 0.006, 0.38, 0.55); o.connect(g).connect(out); o.start(t); lfo.start(t); o.stop(t + 0.6); lfo.stop(t + 0.6);
        };
        bank.clang = function (v) {
            var t = now(); v = v || 1;
            [[523, .5, .9], [1187, .3, .7], [1968, .22, .5], [2760, .14, .35], [3510, .1, .25]].forEach(function (p) { osc('sine', p[0], 0, t, p[2], p[1] * v); });
            nz('highpass', 3000, 0, 0.7, t, 0.05, 0.4 * v);
        };
        bank.clank = function () { var t = now(); [[220, .5, .35], [470, .3, .25], [910, .2, .18]].forEach(function (p) { osc('triangle', p[0], 0, t, p[2], p[1]); }); nz('bandpass', 1200, 0, 2, t, 0.08, 0.4); };
        bank.swish = function () { var t = now(); nz('bandpass', 700, 3600, 1.4, t, 0.32, 0.5, 0.05); };
        bank.squeak = function () { var t = now(); osc('triangle', 1900, 2700, t, 0.09, 0.22); osc('triangle', 2600, 1900, t + 0.09, 0.08, 0.18); };
        bank.whoosh = function (d) { var t = now(); d = d || 0.45; nz('bandpass', 260, 1400, 1.1, t, d, 0.45, d * 0.4); };
        bank.pop = function () { var t = now(); osc('sine', 700, 130, t, 0.09, 0.6); };
        bank.hic = function () { var t = now(); osc('triangle', 320, 760, t, 0.07, 0.5); nz('bandpass', 1800, 0, 3, t, 0.04, 0.2); };
        bank.glug = function () { var t = now(); for (var i = 0; i < 3; i++) osc('sine', 260 - i * 30, 110, t + i * 0.16, 0.12, 0.55); };
        bank.slide = function (up) { var t = now(); osc('sine', up === false ? 1300 : 420, up === false ? 380 : 1350, t, 0.38, 0.32, 0.02); };
        bank.crash = function () { var t = now(); nz('lowpass', 2400, 300, 0.6, t, 0.7, 0.8); osc('sine', 90, 35, t, 0.4, 0.8); [[640, .3, .5], [1430, .2, .4], [2210, .15, .3]].forEach(function (p) { osc('sine', p[0], 0, t + 0.05, p[2], p[1]); }); };
        bank.friction = function (d) { var t = now(); d = d || 0.6; nz('bandpass', 1800, 4200, 6, t, d, 0.25, d * 0.6); osc('sawtooth', 820, 1500, t, d, 0.05, d * 0.6); };
        bank.splash = function () { var t = now(); nz('bandpass', 2400, 700, 0.9, t, 0.5, 0.45, 0.02); for (var i = 0; i < 4; i++) osc('sine', 900 + Math.random() * 900, 300, t + 0.05 + i * 0.07, 0.06, 0.15); };
        bank.rattle = function () { var t = now(); for (var i = 0; i < 6; i++) nz('bandpass', 900 + i * 120, 0, 4, t + i * 0.055, 0.05, 0.35 * (1 - i / 7)); };
        bank.sting = function () { var t = now(); [392, 494, 587].forEach(function (f, i) { osc('square', f, 0, t + i * 0.06, 0.22, 0.09); }); };
        return bank;
    }

    /* ---------- public API ---------- */
    C.play = function (opts) {
        opts = opts || {};
        if (busy) return Promise.resolve(false);
        var ids = (opts.ids || C.manifest || ['plumber', 'dunk', 'pirate']).slice();
        var id = opts.id;
        if (!id) {
            var pool = ids.filter(function (x) { return x !== lastId; });
            id = pool[Math.floor(Math.random() * pool.length)] || ids[0];
        }
        busy = true;
        return Promise.all([C.registry[id] ? null : loadScript(BASE + id + '.js'), loadImgs()]).then(function (res) {
            var def = C.registry[id];
            if (!def) throw new Error('cameo not registered: ' + id);
            lastId = id;
            try { sessionStorage.setItem('fr_cameo_last', id); } catch (e) {}
            var ctx = makeCtx(def, res[1], opts);
            def.build(ctx);
            ctx.seek(0);
            return ctx._run().then(function () { ctx._destroy(); });
        }).then(function () { busy = false; return true; }, function (e) { busy = false; console.warn('[cameo]', e); return false; });
    };
    C.isBusy = function () { return busy; };
    C.preload = function (id) { loadImgs(); if (id && !C.registry[id]) loadScript(BASE + id + '.js'); };
    /* dev helper: build a cameo and freeze it at time t (used for screenshots / tuning) */
    C.freeze = function (id, t, opts) {
        opts = opts || {};
        return Promise.all([C.registry[id] ? null : loadScript(BASE + id + '.js'), loadImgs()]).then(function (res) {
            document.querySelectorAll('.frc-stage').forEach(function (n) { n.remove(); });
            var def = C.registry[id], ctx = makeCtx(def, res[1], opts);
            def.build(ctx); ctx.seek(t);
            ctx.events_ = true;
            return ctx;
        });
    };
})();
