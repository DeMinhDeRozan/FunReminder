/* Cameo: "Ripper!" — the celebration (no rude gestures).
 * Used for achievements and the first-visit hello.
 * Beats: three hops in from the right → lands, turns to us → fist pump → big jump
 * with both arms up while confetti rains → wink + line → hops back off to the right.
 */
FRCameos.register({
    id: 'cheer',
    line: 'Ripper, mate!',
    duration: 4600,
    poseAt: 2000,

    outfit: function () {
        var ink = ' stroke="#1E1612" stroke-width="2" stroke-linejoin="round"';
        return {
            // a brass "FR" medal on a ribbon: the only costume piece, so the roo stays himself
            torso:
                '<path d="M-6,-112 L6,-70 L18,-112" fill="none" stroke="#B0302A" stroke-width="7" stroke-linejoin="round"/>' +
                '<circle cx="6" cy="-60" r="13" fill="#D9A441"' + ink + '/>' +
                '<circle cx="6" cy="-60" r="8.5" fill="none" stroke="#8F631C" stroke-width="1.6"/>' +
                '<text x="6" y="-56" text-anchor="middle" font-family="Big Shoulders Display, Arial Narrow, sans-serif" font-weight="900" font-size="11" fill="#261804">FR</text>'
        };
    },

    build: function (ctx) {
        var E = ctx.E, W = ctx.W;
        var r = ctx.roo(this.outfit());
        var j = r.j;
        var S = W + 240, X1 = W * 0.3;
        var A = S - (S - X1) * 0.45, D = ctx.D;

        /* ---------- path: three hops in, a jump on the spot, three hops out ---------- */
        ctx.kT(j.root, [
            [0, S, 0], [180, S - (S - A) * 0.5, -96, 0, 1, 1, E.rise], [380, A, 0, 0, 1.1, 0.88, E.grav], [460, A, 0, 0, 1, 1, E.out],
            [640, A - (A - X1) * 0.5, -84, 0, 1, 1, E.rise], [840, X1, 0, 0, 1.12, 0.86, E.grav], [960, X1, 0, 0, 1, 1, E.out],
            [1620, X1, 0, 0, 1, 1], [1720, X1, 0, 0, 1.1, 0.86, E.out],                     // crouch
            [1960, X1, -150, 0, 0.95, 1.08, E.rise], [2200, X1, 0, 0, 1.12, 0.86, E.grav],  // big jump
            [2320, X1, 0, 0, 1, 1, E.out],
            [3300, X1, 0], [3380, X1, 0, 0, 1.08, 0.9, E.out],
            [3560, X1 + (A - X1) * 0.6, -90, 0, 1, 1, E.rise], [3760, A + 40, 0, 0, 1.08, 0.9, E.grav],
            [3940, A + (S - A) * 0.45, -100, 0, 1, 1, E.rise], [4160, S - 60, 0, 0, 1.06, 0.92, E.grav],
            [4380, S + 160, -80, 0, 1, 1, E.rise], [D, S + 260, -40]
        ]);
        ctx.autoShadow(r.shadow, r.m.footF, 0, D);

        /* ---------- facing: arrives looking left, turns to us, leaves to the right ---------- */
        ctx.kT(j.flip, [[0, 0, 0, 0, -1, 1], [980, 0, 0, 0, -1, 1], [1040, 0, 0, 0, 0.06, 1, E.in], [1120, 0, 0, 0, 1.08, 1, E.out], [1180, 0, 0, 0, 1, 1]]);

        /* ---------- body + head bounce ---------- */
        ctx.kR(j.body, [[0, -8], [180, 4], [380, -10], [640, 4], [840, -10], [1000, 0], [1300, 4], [1620, -6], [1960, 6], [2200, -8], [2400, 2], [3300, 0], [3560, 6], [3760, -8], [3940, 6], [4160, -8], [4380, 6]]);
        ctx.kT(j.head, [[0, 0, 0, -6], [380, 0, 4, 6], [840, 0, 4, 6], [1100, 0, 0, -4], [1350, 0, -4, 8, 1, 1, E.out], [1500, 0, 0, -2],
            [1960, 0, -8, -10, 1, 1, E.out], [2200, 0, 6, 6], [2500, 0, 0, -6], [2800, 0, 0, 4], [3300, 0, 0, 0]]);
        ctx.kT(j.headS, [[0, 0, 0, 0, 1, 1], [380, 0, 0, 0, 1.08, 0.92, E.out], [480, 0, 0, 0, 1, 1], [840, 0, 0, 0, 1.08, 0.92, E.out], [960, 0, 0, 0, 1, 1],
            [2200, 0, 0, 0, 1.1, 0.9, E.out], [2330, 0, 0, 0, 1, 1]]);

        /* ---------- arms: fist pump, then both arms up for the jump ---------- */
        ctx.kR(j.shF, [[0, -40], [380, -20], [840, -20], [1180, -30], [1340, -150, E.back], [1460, -110], [1580, -160, E.back],
            [1720, -120], [1960, -172, E.out], [2300, -168], [2600, -150], [2900, -40, E.io], [3300, -30], [3560, -50], [3760, -20], [4160, -20], [4380, -50]]);
        ctx.kR(j.elF, [[0, -30], [1180, -40], [1340, -70], [1460, -95], [1580, -50], [1720, -80], [1960, -12], [2600, -18], [2900, -40]]);
        ctx.kT(j.wrF, [[0, 0, 0, 0, 1], [1320, 0, 0, 0, 1], [1360, 0, 0, -10, 1.35, 1.35, E.back], [1460, 0, 0, 0, 1.2], [1600, 0, 0, -10, 1.4, 1.4, E.back],
            [1960, 0, 0, 0, 1.3], [2600, 0, 0, 0, 1.3], [2900, 0, 0, 0, 1]]);
        ctx.kR(j.shB, [[0, -20], [1180, -20], [1620, -40], [1960, -165, E.out], [2300, -160], [2600, -140], [2900, -30, E.io], [4380, -40]]);
        ctx.kR(j.elB, [[0, -30], [1620, -40], [1960, -10], [2600, -20], [2900, -40]]);

        /* ---------- legs: tuck on each hop, extend on landing ---------- */
        var hopT = [[0, 0], [180, 1], [380, 0], [640, 1], [840, 0], [1620, -1], [1960, 1], [2200, 0], [3380, -1], [3560, 1], [3760, 0], [3940, 1], [4160, 0], [4380, 1]];
        var hip = [], knee = [], ankle = [];
        hopT.forEach(function (p) {
            var t = p[0], s = p[1];
            hip.push([t, s === 1 ? 18 : s === -1 ? -24 : -6]);
            knee.push([t, s === 1 ? -6 : s === -1 ? 34 : 10]);
            ankle.push([t, s === 1 ? 26 : 0]);
        });
        ctx.kR(j.hipF, hip); ctx.kR(j.hipB, hip.map(function (p) { return [p[0], p[1] + 6]; }));
        ctx.kR(j.kneeF, knee); ctx.kR(j.kneeB, knee);
        ctx.kR(j.ankleF, ankle); ctx.kR(j.ankleB, ankle);
        ctx.kR(j.tail1, [[0, -6], [180, 14], [380, -12], [640, 14], [840, -12], [1620, -20], [1960, 20], [2200, -16], [2500, 4], [3560, 14], [3760, -12], [3940, 14], [4160, -12]]);
        ctx.kR(j.tail2, [[0, 0], [380, 16], [840, 16], [1960, -18], [2200, 20], [2500, 0], [3760, 16], [4160, 16]]);

        /* ---------- face: blush, raised brows, shades dip + wink ---------- */
        ctx.kO(j.blush, [[0, 0], [1300, 0], [1500, 0.9], [3200, 0.9], [3500, 0]]);
        ctx.kT(j.browL, [[0, 0, 0], [1300, 0, 0], [1450, 0, -9, -6, 1, 1, E.back], [3100, 0, -9, -6], [3300, 0, 0, 0]]);
        ctx.kT(j.browR, [[0, 0, 0], [1300, 0, 0], [1450, 0, -9, 6, 1, 1, E.back], [3100, 0, -9, 6], [3300, 0, 0, 0]]);
        ctx.kT(j.shades, [[0, 0, 0], [2350, 0, 0], [2450, 0, 16, -4, 1, 1, E.out], [3000, 0, 16, -4], [3150, 0, 0, 0, 1, 1, E.back]]);
        ctx.kT(j.lidL, [[0, 0, 0], [2560, 0, 0], [2620, 0, 21, 0, 1, 1, E.snap], [2860, 0, 21], [2920, 0, 0]]);
        ctx.kT(j.pupilL, [[0, 0, 0], [1200, 3, 2], [3000, 3, 2], [3200, 0, 0]]);
        ctx.kT(j.pupilR, [[0, 0, 0], [1200, -3, 2], [3000, -3, 2], [3200, 0, 0]]);

        /* ---------- confetti over the jump ---------- */
        var cols = ['#D9A441', '#F4D48A', '#EEE6CE', '#C8362B', '#5FB7B0', '#7FD39A'];
        var top = ctx.top;
        for (var i = 0; i < 46; i++) {
            var x0 = X1 + (Math.random() - 0.5) * 120, y0 = -260;
            var x1 = X1 + (Math.random() - 0.5) * W * 1.1, y1 = top + 40 + Math.random() * 160;
            var x2 = x1 + (Math.random() - 0.5) * 140, y2 = -10 + Math.random() * 20;
            var t0 = 1900 + Math.random() * 120, rot = Math.random() * 720 - 360;
            var c = ctx.add('<rect x="-5" y="-3" width="10" height="6" rx="1.5" fill="' + cols[i % cols.length] + '"/>');
            ctx.kT(c, [[t0 - 1, x0, y0, 0, 0.2], [t0, x0, y0, 0, 1], [t0 + 420, x1, y1, rot * 0.3, 1, 1, E.out], [t0 + 2200, x2, y2, rot, 1, 0.4, E.in]]);
            ctx.kO(c, [[t0 - 1, 0], [t0, 1], [t0 + 1900, 1], [t0 + 2300, 0]]);
        }

        /* ---------- sound + line ---------- */
        [380, 840].forEach(function (t) { ctx.at(t, function () { ctx.sfx.bounce(0.7); }); });
        ctx.at(1340, function () { ctx.sfx.swish(); });
        ctx.at(1960, function () { ctx.sfx.pop(); ctx.sfx.sting(); });
        ctx.at(2200, function () { ctx.sfx.thud(0.6); });
        [3760, 4160].forEach(function (t) { ctx.at(t, function () { ctx.sfx.bounce(0.6); }); });
        ctx.say(ctx.line || this.line, 1450, 1900, r.m.headTop);
    }
});
