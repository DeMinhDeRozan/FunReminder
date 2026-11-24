/* Cameo: "Captain Roo" — an original drunken pirate.
 * Beats: staggers in, hiccups → swig (glug) → shakes the empty bottle, lobs it (offscreen smash) →
 * trips: windmills, hat flies off → catches it, flicks it back onto his head → turns,
 * wobbly finger + "Savvy? Nah." → stumbles off, faceplants offscreen, the hat flutters back in.
 */
FRCameos.register({
    id: 'pirate',
    line: 'Savvy? Nah.',
    duration: 6900,
    poseAt: 4250,
    defs:
        '<linearGradient id="frCoat" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#9B3A28"/><stop offset="1" stop-color="#5A1C14"/></linearGradient>' +
        '<linearGradient id="frGlassG" x1="0" x2="1"><stop offset="0" stop-color="#1E3A22"/><stop offset=".35" stop-color="#4F8A57"/><stop offset=".5" stop-color="#9CD3A0"/><stop offset=".62" stop-color="#3C7044"/><stop offset="1" stop-color="#16301A"/></linearGradient>' +
        '<linearGradient id="frHatG" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#4A3122"/><stop offset="1" stop-color="#22150D"/></linearGradient>',

    hatMarkup: function () {
        var ink = ' stroke="#140D08" stroke-width="2" stroke-linejoin="round"';
        return '' +
            '<path d="M-34,-6 C-30,-36 34,-38 38,-6 Z" fill="url(#frHatG)"' + ink + '/>' +
            '<path d="M18,-28 C34,-56 58,-58 70,-50 C56,-46 44,-36 30,-20 Z" fill="#E9E2CF"' + ink + '/>' +
            '<path d="M24,-26 C38,-44 52,-50 64,-50" fill="none" stroke="#B9AE95" stroke-width="1.4"/>' +
            '<path d="M-60,2 C-46,-20 -22,6 2,-16 C26,6 48,-20 64,2 C50,16 22,8 2,14 C-18,8 -46,16 -60,2 Z" fill="url(#frHatG)"' + ink + '/>' +
            '<path d="M-56,2 C-44,-14 -22,10 2,-11 C26,10 46,-14 60,2" fill="none" stroke="#D9A441" stroke-width="2.4"/>' +
            '<circle cx="2" cy="-4" r="5" fill="#D9A441" stroke="#140D08" stroke-width="1.5"/>';
    },
    bottleMarkup: function () {
        var ink = ' stroke="#0E1A10" stroke-width="2" stroke-linejoin="round"';
        return '' +
            '<rect x="-4" y="-2" width="8" height="7" rx="2" fill="#B98A56"' + ink + '/>' +
            '<path d="M-5,5 L-5,18 C-12,22 -12,28 -12,32 L-12,62 C-12,68 12,68 12,62 L12,32 C12,28 12,22 5,18 L5,5 Z" fill="url(#frGlassG)"' + ink + '/>' +
            '<rect x="-10" y="36" width="20" height="16" rx="2" fill="#E9E2CF" stroke="#0E1A10" stroke-width="1.4"/>' +
            '<text x="0" y="48.5" text-anchor="middle" font-family="Big Shoulders Display, Arial Narrow, sans-serif" font-weight="900" font-size="11" fill="#5A1C14">XXX</text>';
    },

    outfit: function () {
        var ink = ' stroke="#140D08" stroke-width="2" stroke-linejoin="round"';
        var gold = '#D9A441';
        return {
            torso:
                // coat tails, shirt + ruffle, open lapels, sash, belt, buttons
                '<path d="M-36,-20 C-44,10 -40,40 -30,58 L-6,52 C-10,30 -10,8 -8,-6 Z" fill="#5A1C14"' + ink + '/>' +
                '<path d="M-31,-92 C-40,-70 -40,-30 -34,2 C-20,12 22,12 42,0 C48,-30 48,-70 40,-96 C30,-116 14,-124 4,-124 C-10,-124 -24,-114 -31,-92 Z" fill="url(#frCoat)"' + ink + '/>' +
                '<path d="M2,-118 C-4,-90 -2,-40 8,4 L30,4 C34,-40 34,-90 22,-120 Z" fill="#EDE6D2"' + ink + '/>' +
                '<path d="M4,-118 q5,6 0,10 q6,5 0,10 q6,5 1,10 M20,-119 q-5,6 0,10 q-6,5 0,10 q-5,5 -1,10" fill="none" stroke="#B9AE95" stroke-width="2.2" stroke-linecap="round"/>' +
                '<path d="M2,-118 C-8,-96 -6,-70 0,-56 L-10,-60 C-16,-80 -12,-104 2,-118 Z M22,-120 C36,-98 38,-74 34,-58 L42,-62 C46,-84 40,-106 22,-120 Z" fill="#7A2A1E"' + ink + '/>' +
                '<path d="M-36,-24 C-10,-14 22,-14 46,-26 L46,-10 C22,0 -10,0 -36,-8 Z" fill="#B0302A"' + ink + '/>' +
                '<path d="M-28,-14 C-34,4 -30,18 -22,26 L-14,22 C-18,10 -20,0 -18,-10 Z" fill="#B0302A"' + ink + '/>' +
                '<rect x="10" y="-24" width="14" height="13" rx="2" fill="' + gold + '" stroke="#140D08" stroke-width="1.6"/>' +
                '<circle cx="-4" cy="-78" r="3.2" fill="' + gold + '"/><circle cx="-4" cy="-62" r="3.2" fill="' + gold + '"/><circle cx="38" cy="-78" r="3.2" fill="' + gold + '"/><circle cx="38" cy="-62" r="3.2" fill="' + gold + '"/>',
            upperF: '<path d="M-10,-4 C-14,10 -12,24 -5,33 L6,33 C13,24 14,10 10,-4 Z" fill="url(#frCoat)"' + ink + '/>',
            upperB: '<path d="M-10,-4 C-14,10 -12,24 -5,33 L6,33 C13,24 14,10 10,-4 Z" fill="#5A1C14"' + ink + '/>',
            foreF: '<path d="M-9,-2 L9,-2 L9,16 L-9,16 Z" fill="url(#frCoat)"' + ink + '/><path d="M-11,12 L11,12 L10,22 L-10,22 Z" fill="' + gold + '" stroke="#140D08" stroke-width="1.6"/>',
            foreB: '<path d="M-9,-2 L9,-2 L9,16 L-9,16 Z" fill="#5A1C14"' + ink + '/><path d="M-11,12 L11,12 L10,22 L-10,22 Z" fill="#A9802E" stroke="#140D08" stroke-width="1.6"/>',
            thighF: '<path d="M-21,-13 C-41,10 -32,59 2,66 C32,71 51,50 41,26 C33,2 14,-22 -21,-13 Z" fill="#3B2A1E"' + ink + '/>',
            thighB: '<path d="M-21,-13 C-41,10 -32,59 2,66 C32,71 51,50 41,26 C33,2 14,-22 -21,-13 Z" fill="#2A1D14"' + ink + '/>',
            shinF: '<path d="M-10,-6 C-14,10 -25,30 -29,42 L-12,48 C-6,36 4,14 10,2 Z" fill="#1E1611"' + ink + '/><path d="M-14,-10 L14,-2 L10,12 L-16,6 Z" fill="#6B4426"' + ink + '/>',
            shinB: '<path d="M-10,-6 C-14,10 -25,30 -29,42 L-12,48 C-6,36 4,14 10,2 Z" fill="#140E0A"' + ink + '/><path d="M-14,-10 L14,-2 L10,12 L-16,6 Z" fill="#4E311C"' + ink + '/>',
            footF: '<path d="M-12,-14 C-18,0 -13,15 -2,15 L70,15 C82,15 82,0 70,-4 L34,-6 C22,-8 14,-15 4,-17 Z" fill="#1E1611"' + ink + '/><path d="M40,-4 C54,-6 66,-4 74,2" fill="none" stroke="#5B4A3C" stroke-width="2.4"/><rect x="20" y="-8" width="10" height="8" fill="#D9A441" stroke="#140D08" stroke-width="1.4"/>',
            footB: '<path d="M-12,-14 C-18,0 -13,15 -2,15 L70,15 C82,15 82,0 70,-4 L34,-6 C22,-8 14,-15 4,-17 Z" fill="#140E0A"' + ink + '/>',
            propF: '<g data-j="bottleHand" transform="translate(0,4)">' + this.bottleMarkup() + '</g>',
            shades: '<path d="M-40,-84 L40,-104" stroke="#120D0A" stroke-width="3" stroke-linecap="round"/>' +
                    '<ellipse cx="-18" cy="-74" rx="17" ry="14" fill="#120D0A" stroke="#000" stroke-width="1.5"/>' +
                    '<path d="M-28,-80 l20,12 M-28,-68 l20,-12" stroke="#2D241D" stroke-width="1.4"/>',
            hat: '<g transform="translate(2,-104) rotate(-6)">' + this.hatMarkup() + '<circle data-m="hatC" cx="0" cy="-6" r=".8" fill="none"/></g>'
        };
    },

    build: function (ctx) {
        var self = this, E = ctx.E, W = ctx.W;
        var r = ctx.roo(this.outfit());
        var j = r.j;
        var S = W + 240, X1 = W * 0.34;
        var hatC = r.g.querySelector('[data-m="hatC"]');

        /* ---------- facing: enters looking left, turns to us later ---------- */
        ctx.kT(j.flip, [[0, 0, 0, 0, -1, 1], [3700, 0, 0, 0, -1, 1], [3760, 0, 0, 0, 0.06, 1, E.in], [3840, 0, 0, 0, 1.08, 1, E.out], [3900, 0, 0, 0, 1, 1]]);
        ctx.kO(j.blush, [[0, 0.7], [1500, 0.7], [1700, 1]]);

        /* ---------- body sway: never quite upright ---------- */
        ctx.kR(j.body, [[0, -10], [250, 8], [400, -4], [650, 12], [780, -6], [900, -14, E.out], [1020, 4], [1250, -8], [1350, -14],
            [1700, -18], [1850, 6], [1950, -6], [2050, 8, E.snap], [2250, -12, E.out], [2350, 6],
            [2450, 34, E.out], [2600, 26], [2750, 40], [2900, 22], [3000, -14], [3100, 6], [3200, -4], [3350, 4], [3450, -2],
            [3600, 6, E.out], [3700, 0], [3900, -6], [4150, 6], [4400, -6], [4600, -12, E.out], [4800, 6], [5050, -6], [5300, 6],
            [5450, -4], [5600, 10], [5780, -8], [5950, 14], [6080, 72, E.in], [6400, 82]]);
        ctx.kT(j.head, [[0, 0, 0, 8], [300, 0, 0, -10], [450, 0, 0, 6], [700, 0, 0, -12], [900, 0, -10, 10, 1, 1, E.out], [1050, 0, 0, -6], [1250, 0, 0, 8],
            [1350, 0, -4, -22], [1700, 0, -4, -24], [1850, 0, 0, 8], [1950, 0, 0, -6], [2050, 0, 0, 4], [2250, 0, -12, 14, 1, 1, E.out], [2380, 0, 0, 0],
            [2450, 0, 6, -18, 1, 1, E.out], [2700, 0, 0, 18], [2900, 0, 0, -12], [3100, 0, 0, 8], [3300, 0, 0, -4], [3500, 0, 0, 0], [3620, 0, 8, 0, 1, 1, E.out], [3720, 0, 0, 0],
            [3780, 0, 0, -8], [3960, -6, 0, -10], [4200, -6, 0, 2], [4450, -6, 0, -12], [4600, -6, -10, 8, 1, 1, E.out], [4800, -6, 0, -8], [5100, -6, 0, 3],
            [5450, 0, 0, -10], [5700, 0, 0, 10], [5950, 0, 0, -14], [6080, 0, 0, 20]]);
        ctx.kT(j.headS, [[0, 0, 0, 0, 1, 1], [900, 0, 0, 0, 0.94, 1.08, E.out], [1000, 0, 0, 0, 1, 1], [2250, 0, 0, 0, 0.92, 1.1, E.out], [2380, 0, 0, 0, 1, 1],
            [3600, 0, 0, 0, 1, 1], [3630, 0, 0, 0, 1.1, 0.86, E.out], [3760, 0, 0, 0, 1, 1], [4600, 0, 0, 0, 0.94, 1.08], [4700, 0, 0, 0, 1, 1]]);

        /* ---------- arms: swig, lob the bottle, windmill, catch + flick the hat, wobbly finger ---------- */
        var O = -720;   // after two full windmill turns, keep angles continuous
        ctx.kR(j.shF, [[0, -40], [400, -20], [700, -50], [1000, -30], [1200, -40],
            [1350, -150, E.out], [1700, -156], [1850, -60], [1950, 40, E.io], [2050, -176, E.snap], [2150, -130], [2300, -40],
            [2400, -40, E.lin], [2700, -400, E.lin], [3000, -760, E.out], [3150, O - 110, E.out], [3300, O - 84], [3360, O - 160, E.snap], [3460, O - 30],
            [3820, O + 30, E.in], [3950, O - 110, E.snap], [4060, O - 96], [4200, O - 102], [4450, O - 120], [4700, O - 98], [4950, O - 118], [5200, O - 100],
            [5420, O - 30], [5950, O - 40], [6080, O - 160, E.out]]);
        ctx.kR(j.elF, [[0, -30], [1200, -30], [1350, -105, E.out], [1700, -110], [1850, -40], [2050, -10], [2300, -30], [3000, -20],
            [3150, -40], [3360, -10], [3460, -30], [3820, -70, E.in], [3950, -86, E.snap], [4060, -76], [4200, -82], [4450, -70], [4700, -88], [5200, -80], [5420, -30]]);
        ctx.kT(j.wrF, [[0, 0, 0, 0], [1350, 0, 0, 100], [1700, 0, 0, 112], [1850, 0, 0, 0], [3890, 0, 0, 0, 1, 1, E.out], [3970, 0, 0, 10, 1.65, 1.65, E.back],
            [4080, 0, 0, -6, 1.42], [4450, 0, 0, 8, 1.42], [4700, 0, 0, -8, 1.42], [5200, 0, 0, 4, 1.42], [5420, 0, 0, 0, 1]]);
        ctx.hand(r, 'F', [[0, 'fist'], [3930, 'finger'], [5420, 'fist']]);
        ctx.kO(ctx.q(r.g, 'bottleHand'), [[0, 1], [2050, 1, E.step], [2050, 0]]);
        ctx.kR(j.shB, [[0, -20], [300, 10], [650, -30], [900, 30], [1200, -10], [1600, 20], [2050, -20],
            [2400, -20, E.lin], [2700, 340, E.lin], [3000, 700, E.out], [3200, 700], [3600, 690], [3900, 730], [4600, 760, E.out], [4800, 720], [5450, 690], [5800, 740], [6080, 560, E.out]]);
        ctx.kR(j.elB, [[0, -20], [900, -60], [1200, -20], [2400, -10], [3000, -30], [4600, -90], [4800, -40]]);

        /* ---------- legs: shuffling, crossing, a trip ---------- */
        var steps = [0, 250, 400, 650, 780, 1020, 1250, 1950, 2250];
        var hipF = [], hipB = [], kneeF = [], kneeB = [];
        steps.forEach(function (t, i) {
            var f = i % 2 === 0;
            hipF.push([t, f ? -26 : 16]); hipB.push([t, f ? 18 : -24]);
            kneeF.push([t, f ? 22 : 4]); kneeB.push([t, f ? 4 : 22]);
        });
        hipF.push([2350, 0], [2450, 34, E.out], [2600, 40], [2750, 30], [2900, -10], [3000, 6], [3100, -4], [3300, 0],
            [3820, 4], [3950, -6], [5450, 0], [5600, -26], [5780, 16], [5950, -30], [6080, 40]);
        kneeF.push([2350, 0], [2450, 20], [2750, 30], [2900, 4], [3000, 0], [5600, 22], [5780, 4], [5950, 26], [6080, 10]);
        hipB.push([2350, 0], [2450, -50, E.out], [2600, -62], [2750, -40], [2900, 10, E.in], [3000, -6], [3100, 2], [3300, 0],
            [5450, 0], [5600, 18], [5780, -26], [5950, 16], [6080, -40]);
        kneeB.push([2350, 0], [2450, 60], [2600, 74], [2750, 50], [2900, 6], [3000, 0], [5600, 4], [5780, 22], [5950, 4], [6080, 50]);
        ctx.kR(j.hipF, hipF); ctx.kR(j.hipB, hipB); ctx.kR(j.kneeF, kneeF); ctx.kR(j.kneeB, kneeB);
        ctx.kR(j.ankleF, [[0, 0], [2450, 20], [2900, 0], [6080, 20]]);
        ctx.kR(j.ankleB, [[0, 0], [2450, -10], [2600, -24], [2900, 0]]);
        ctx.kR(j.tail1, [[0, 6], [400, -8], [780, 10], [1020, -6], [1350, 10], [1850, -6], [2450, -40, E.out], [2750, -20], [2900, 14], [3100, -4], [3300, 4],
            [4600, -10], [4800, 6], [5600, -8], [5950, 10], [6080, -46]]);
        ctx.kR(j.tail2, [[0, 0], [500, 14], [900, -10], [1300, 10], [2450, -20], [2600, 24], [2800, -16], [3000, 10], [3300, 0], [4700, 8], [5800, -14], [6080, 30]]);

        /* ---------- face ---------- */
        ctx.kT(j.shades, [[0, 0, 0], [1350, 0, 0], [1420, 0, 7, 6, 1, 1, E.out], [1850, 0, 0, 0, 1, 1, E.back],
            [2440, 0, 0], [2480, 0, 15, -4, 1, 1, E.out], [3100, 0, 15, 4], [3200, 0, 0, 0, 1, 1, E.back],
            [3880, 0, 0], [4000, 0, 17, 5, 1, 1, E.out], [5300, 0, 17, 5], [5420, 0, 0, 0, 1, 1, E.back],
            [6060, 0, 0], [6090, 0, 18, 10, 1, 1, E.out]]);
        ctx.kT(j.lidL, [[0, 0, 0], [2440, 0, 0], [2480, 0, -4], [3100, 0, -4], [3200, 0, 0], [3880, 0, 0], [4000, 0, 12], [4400, 0, 12], [4450, 0, 20], [4520, 0, 12], [5300, 0, 12]]);
        ctx.kT(j.lidR, [[0, 0, 0], [2440, 0, 0], [2480, 0, -4], [3100, 0, -4], [3200, 0, 0], [3880, 0, 0], [4000, 0, 9], [5300, 0, 9]]);
        ctx.kT(j.pupilL, [[0, 0, 0], [2480, 0, 0, 0, 0.7], [3100, 0, 0, 0, 0.7], [3200, 0, 0, 0, 1], [3980, 3, 1, 0, 1], [5300, 3, 1]]);
        ctx.kT(j.pupilR, [[0, 0, 0], [2480, 0, 0, 0, 0.7], [3100, 0, 0, 0, 0.7], [3200, 0, 0, 0, 1], [3980, -3, 2, 0, 1], [5300, -3, 2]]);
        ctx.kT(j.browL, [[0, 0, -2, 8], [900, 0, -8, -4], [1100, 0, 0, 8], [1350, 0, -6, -6], [1850, 0, 0, 10], [2480, 0, -9, -12], [3100, 0, -9, -12],
            [3200, 0, -6, -6], [3400, 0, 0, 8], [3950, 0, -8, -8], [5300, 0, -8, -8]]);
        ctx.kT(j.browR, [[0, 0, 2, 6], [900, 0, -8, 4], [1100, 0, 2, 6], [1350, 0, -6, 6], [1850, 0, 2, 8], [2480, 0, -9, 12], [3100, 0, -9, 12],
            [3200, 0, -6, 6], [3400, 0, 2, 6], [3950, 0, 3, 10], [5300, 0, 3, 10]]);

        /* ---------- root path ---------- */
        var fr = [0, 0.3, 0.38, 0.62, 0.7, 0.76, 0.8, 1], tt = [0, 250, 400, 650, 780, 900, 1020, 1250];
        var yy = [0, -12, 0, -12, 0, -22, 0, 0];
        var rows = fr.map(function (f, i) { return [tt[i], S + (X1 - S) * f, yy[i], 0, i === 5 ? 0.94 : 1, i === 5 ? 1.08 : 1, i % 2 ? E.out : E.io]; });
        rows.push([1350, X1, 0], [1950, X1 - 10, 0], [2050, X1 - 6, -4], [2250, X1 - 12, -18, 0, 0.92, 1.1, E.out], [2350, X1 - 12, 0, 0, 1, 1],
            [2450, X1 - 50, -6, 0, 1, 1, E.out], [2600, X1 - 66, -14], [2750, X1 - 74, -4], [2900, X1 - 78, 0, 0, 1.06, 0.94, E.out], [3000, X1 - 66, 0, 0, 1, 1],
            [3600, X1 - 66, 0], [4600, X1 - 66, -14, 0, 0.94, 1.08, E.out], [4700, X1 - 66, 0, 0, 1, 1],
            [5450, X1 - 66, 0], [5600, X1, -10], [5780, X1 + 50, 0], [5950, X1 + 150, -12], [6080, X1 + 200, 0, 0, 1, 1, E.in], [6300, W + 160, 60, 0, 1, 1, E.in], [6500, W + 320, 90]);
        ctx.kT(j.root, rows);

        /* ---------- the hat: flies off, caught, flicked back on; later flutters back in ---------- */
        var wHat = ctx.add('<g data-j="wHat">' + this.hatMarkup() + '</g>');
        var wHatG = wHat.firstChild;
        var p0 = ctx.pos(hatC, 2450), pc = ctx.pos(r.m.handF, 3150), ph = ctx.pos(hatC, 3600);
        var hr = [[2450, p0.x, p0.y, 30, -1, 1, E.lin], [2460, p0.x, p0.y, 30, -1, 1, E.rise], [2800, p0.x + 40, p0.y - 230, -220, -1, 1, E.grav], [3150, pc.x, pc.y - 12, -360, 1, 1, E.lin]];
        for (var t = 3190; t <= 3350; t += 40) { var hp = ctx.pos(r.m.handF, t); hr.push([t, hp.x, hp.y - 12, -360, 1, 1, E.lin]); }
        var hs = ctx.pos(r.m.handF, 3360);
        hr.push([3360, hs.x, hs.y - 12, -360, 1, 1, E.rise], [3480, (hs.x + ph.x) / 2, Math.min(hs.y, ph.y) - 110, -540, 1, 1, E.grav], [3600, ph.x, ph.y, -720, 1, 1]);
        var p2 = ctx.pos(hatC, 6080);
        var land = Math.min(W - 70, p2.x);
        hr.push([6080, p2.x, p2.y, -720 + 40, 1, 1, E.rise], [6350, p2.x - 30, p2.y - 160, -900, 1, 1, E.grav], [6700, land, -12, -1080 - 12, 1, 1, E.out], [6900, land, -12, -1092]);
        ctx.kT(wHatG, hr);
        ctx.kO(wHat, [[0, 0], [2450, 0, E.step], [2450, 1], [3600, 1, E.step], [3600, 0], [6080, 0, E.step], [6080, 1]]);
        ctx.kO(j.hat, [[0, 1], [2450, 1, E.step], [2450, 0], [3600, 0, E.step], [3600, 1], [6080, 1, E.step], [6080, 0]]);

        /* ---------- the bottle: lobbed over his shoulder ---------- */
        var wb = ctx.add('<g>' + this.bottleMarkup() + '</g>');
        var b0 = ctx.pos(r.m.handF, 2050);
        ctx.kT(wb.firstChild ? wb : wb, [[2050, b0.x, b0.y, 180, 1, 1, E.rise], [2400, b0.x + 260, b0.y - 240, 520, 1, 1, E.grav], [2750, b0.x + 520, 120, 900]]);
        ctx.kO(wb, [[0, 0], [2050, 0, E.step], [2050, 1], [2750, 1, E.step], [2750, 0]]);

        /* ---------- hiccups ---------- */
        [[900, 'hic!'], [2250, 'HIC!'], [4600, 'hic']].forEach(function (h) {
            var m = ctx.pos(r.m.mouth, h[0]);
            var g = ctx.add('<text text-anchor="middle" font-family="Big Shoulders Display, Arial Narrow, sans-serif" font-weight="900" font-size="30" fill="#EEE6CE" stroke="#182628" stroke-width="5" paint-order="stroke">' + h[1] + '</text>');
            ctx.kT(g, [[h[0], m.x, m.y, -8, 0.4], [h[0] + 120, m.x + 30, m.y - 40, 6, 1.15, 1.15, E.back], [h[0] + 700, m.x + 50, m.y - 110, -4, 1]]);
            ctx.kO(g, [[h[0] - 1, 0], [h[0], 1], [h[0] + 500, 1], [h[0] + 700, 0]]);
            ctx.at(h[0], function () { ctx.sfx.hic(); });
        });

        ctx.dust(X1 - 78, 0, 2900, 6, 80);
        ctx.autoShadow(r.shadow, r.m.footF, 0, 6900);

        /* ---------- sound + line ---------- */
        ctx.at(1380, function () { ctx.sfx.glug(); });
        ctx.at(2050, function () { ctx.sfx.whoosh(0.3); });
        ctx.at(2700, function () { ctx.sfx.crash(); });
        ctx.at(2450, function () { ctx.sfx.slide(true); ctx.sfx.whoosh(0.5); });
        ctx.at(2900, function () { ctx.sfx.thud(0.6); });
        ctx.at(3150, function () { ctx.sfx.pop(); });
        ctx.at(3600, function () { ctx.sfx.boing(); });
        ctx.at(3930, function () { ctx.sfx.pop(); ctx.sfx.sting(); });
        ctx.at(6300, function () { ctx.sfx.crash(); });
        ctx.at(6700, function () { ctx.sfx.thud(0.3); });
        ctx.say(ctx.line || this.line, 3950, 1500, r.m.headTop);
    }
});
