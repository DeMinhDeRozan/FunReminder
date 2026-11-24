/* Cameo: "Plumber Roo" — Aussie tradie fire-poles down a copper pipe.
 * Beats: pipe clanks in → friction slide (sparks) → squash landing → dizzy shake →
 * wrench bonk → turn, shades down, finger + "Fixed ya leak, mate." → the pipe leaks on him → hops off.
 */
FRCameos.register({
    id: 'plumber',
    line: 'Fixed ya leak, mate.',
    duration: 6300,
    poseAt: 4200,
    defs:
        '<linearGradient id="frCu" x1="0" x2="1"><stop offset="0" stop-color="#6A2F16"/><stop offset=".28" stop-color="#C9733F"/><stop offset=".42" stop-color="#F2AE78"/><stop offset=".62" stop-color="#B4612F"/><stop offset="1" stop-color="#5E2812"/></linearGradient>' +
        '<linearGradient id="frBrassH" x1="0" x2="1"><stop offset="0" stop-color="#7A5214"/><stop offset=".4" stop-color="#F4D48A"/><stop offset="1" stop-color="#8F631C"/></linearGradient>' +
        '<linearGradient id="frSteel" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#EEF2F4"/><stop offset=".5" stop-color="#9AA6AE"/><stop offset="1" stop-color="#5D6970"/></linearGradient>' +
        '<linearGradient id="frDenim" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#34507A"/><stop offset="1" stop-color="#1C2C47"/></linearGradient>',

    outfit: function (P) {
        var ink = ' stroke="#1B1712" stroke-width="2" stroke-linejoin="round"';
        var hv = '#E6EC3A';
        var wrench =
            '<rect x="2" y="3" width="64" height="12" rx="6" fill="url(#frSteel)"' + ink + '/>' +
            '<path d="M60,-6 C72,-10 84,-4 84,8 C84,18 76,24 68,22 L70,14 C76,15 79,11 78,7 C77,2 72,0 66,2 Z" fill="url(#frSteel)"' + ink + '/>' +
            '<rect x="14" y="6" width="34" height="6" rx="3" fill="rgba(0,0,0,.18)"/>';
        return {
            torso:
                // grey work tee
                '<path d="M-33,-58 C-42,-80 -37,-104 -25,-116 C-12,-125 20,-126 32,-117 C45,-107 50,-88 47,-58 Z" fill="#BDB6A7"' + ink + '/>' +
                // overall bib + straps + buckles + pocket
                '<path d="M-27,-78 L38,-80 C42,-50 46,-22 41,-4 C31,10 -20,12 -31,4 C-37,-20 -33,-56 -27,-78 Z" fill="url(#frDenim)"' + ink + '/>' +
                '<path d="M-22,-79 L-28,-121 M32,-81 L24,-124" stroke="#22365A" stroke-width="8" stroke-linecap="round"/>' +
                '<circle cx="-21" cy="-77" r="4.5" fill="url(#frBrassH)"' + ink + '/><circle cx="31" cy="-79" r="4.5" fill="url(#frBrassH)"' + ink + '/>' +
                '<rect x="-4" y="-70" width="26" height="17" rx="2" fill="#2A4268" stroke="#1B1712" stroke-width="1.6"/>' +
                '<path d="M-1,-66 h20" stroke="#8DA2C4" stroke-width="1.2" stroke-dasharray="3 2"/>' +
                '<path d="M1,-70 v-7 M5,-70 v-9" stroke="#E2C25A" stroke-width="2.4" stroke-linecap="round"/>' +
                // tool belt + holstered wrench
                '<path d="M-36,-16 C-10,-7 20,-7 46,-18 L46,-6 C20,4 -10,4 -36,-4 Z" fill="#6B4426"' + ink + '/>' +
                '<rect x="5" y="-14" width="11" height="10" rx="2" fill="url(#frBrassH)" stroke="#1B1712" stroke-width="1.4"/>' +
                '<g transform="translate(-30,-34) rotate(78) scale(.82)"><g data-j="wrenchBelt">' + wrench + '</g></g>' +
                '<path d="M-40,-14 l14,4 l-2,22 l-14,-4 Z" fill="#5A381E"' + ink + '/>',
            upperF: '<path d="M-10,-2 L10,-2 L11,9 L-11,9 Z" fill="#BDB6A7"' + ink + '/>',
            upperB: '<path d="M-10,-2 L10,-2 L11,9 L-11,9 Z" fill="#A69F90"' + ink + '/>',
            thighF: '<path d="M-21,-13 C-41,10 -32,59 2,66 C32,71 51,50 41,26 C33,2 14,-22 -21,-13 Z" fill="url(#frDenim)"' + ink + '/><path d="M-6,0 C-12,24 -6,46 8,56" fill="none" stroke="#8DA2C4" stroke-width="1.2" stroke-dasharray="3 2"/>',
            thighB: '<path d="M-21,-13 C-41,10 -32,59 2,66 C32,71 51,50 41,26 C33,2 14,-22 -21,-13 Z" fill="#1A2942"' + ink + '/>',
            shinF: '<path d="M-10,-6 C-14,10 -25,30 -29,42 L-12,48 C-6,36 4,14 10,2 Z" fill="url(#frDenim)"' + ink + '/><path d="M-21,22 L-6,28 M-24,30 L-9,36" stroke="' + hv + '" stroke-width="5"/><path d="M-22,26 L-7,32" stroke="#E8ECEF" stroke-width="1.6"/>',
            shinB: '<path d="M-10,-6 C-14,10 -25,30 -29,42 L-12,48 C-6,36 4,14 10,2 Z" fill="#1A2942"' + ink + '/><path d="M-21,22 L-6,28 M-24,30 L-9,36" stroke="#B9BD2E" stroke-width="5"/>',
            footF: '<path d="M-12,-14 C-18,0 -13,15 -2,15 L68,15 C80,15 82,2 72,-3 L34,-6 C22,-8 14,-15 4,-17 Z" fill="#4E3626"' + ink + '/><path d="M-6,15 L76,15" stroke="#1E140E" stroke-width="5" stroke-linecap="round"/><path d="M52,-5 C64,-6 74,-3 78,4" fill="none" stroke="#8C7A68" stroke-width="3" stroke-linecap="round"/>',
            footB: '<path d="M-12,-14 C-18,0 -13,15 -2,15 L68,15 C80,15 82,2 72,-3 L34,-6 C22,-8 14,-15 4,-17 Z" fill="#3B291D"' + ink + '/><path d="M-6,15 L76,15" stroke="#140E09" stroke-width="5" stroke-linecap="round"/>',
            propF: '<g data-j="wrenchHand" opacity="0">' + wrench + '</g>',
            hat: '<path d="M-8,-108 q6,-10 14,-2" fill="none" stroke="#E2C25A" stroke-width="3" stroke-linecap="round" opacity="0"/>'
        };
    },

    build: function (ctx) {
        var E = ctx.E, W = ctx.W, top = ctx.top;
        var PX = Math.max(-W + 140, -W * 0.42);            // the pipe, left of centre
        var r = ctx.roo(this.outfit(ctx.P));
        var j = r.j;

        /* ---------- the copper pipe ---------- */
        var pipeLen = -top + 160;
        var rings = '';
        [-170, -340, -510, -680].forEach(function (y) {
            rings += '<rect x="' + (PX - 23) + '" y="' + (y - 9) + '" width="46" height="18" rx="4" fill="url(#frCu)" stroke="#1B1712" stroke-width="2"/>' +
                '<circle cx="' + (PX - 15) + '" cy="' + y + '" r="2.6" fill="url(#frBrassH)"/><circle cx="' + (PX + 15) + '" cy="' + y + '" r="2.6" fill="url(#frBrassH)"/>';
        });
        var pipe = ctx.add(
            '<g data-j="pipe">' +
              '<rect x="' + (PX - 17) + '" y="' + (-pipeLen) + '" width="34" height="' + pipeLen + '" fill="url(#frCu)" stroke="#1B1712" stroke-width="2"/>' +
              '<path d="M' + (PX - 5) + ',' + (-pipeLen) + ' V-14" stroke="rgba(255,236,210,.35)" stroke-width="3"/>' +
              rings +
              // valve wheel
              '<rect x="' + (PX - 40) + '" y="-430" width="24" height="10" fill="url(#frBrassH)" stroke="#1B1712" stroke-width="1.6"/>' +
              '<g transform="translate(' + (PX - 46) + ',-425)"><g data-j="valve"><circle r="15" fill="none" stroke="#C8362B" stroke-width="5"/><path d="M-15,0 H15 M0,-15 V15" stroke="#C8362B" stroke-width="3.5"/><circle r="4" fill="url(#frBrassH)"/></g></g>' +
              // floor flange
              '<rect x="' + (PX - 32) + '" y="-13" width="64" height="13" rx="3" fill="url(#frCu)" stroke="#1B1712" stroke-width="2"/>' +
              '<circle cx="' + (PX - 22) + '" cy="-6.5" r="2.6" fill="#3B2A1C"/><circle cx="' + (PX + 22) + '" cy="-6.5" r="2.6" fill="#3B2A1C"/>' +
            '</g>');
        // put the pipe behind the kangaroo
        ctx.world.insertBefore(pipe, ctx.world.firstChild);
        var pipeShadow = ctx.add('<ellipse cx="' + PX + '" cy="3" rx="46" ry="8" fill="url(#frShadow' + ctx.uid + ')"/>');
        ctx.world.insertBefore(pipeShadow, ctx.world.firstChild);
        var pj = pipe.firstChild;
        ctx.kT(pj, [
            [0, 0, -pipeLen - 200], [380, 0, 0, 0, 1, 1, E.out], [460, 0, -16], [540, 0, 0, 0, 1, 1, E.in], [590, 0, -4], [640, 0, 0],
            [2930, 0, 0], [2960, 7, 0], [3010, -6, 0], [3060, 4, 0], [3110, -2, 0], [3170, 0, 0],
            [4520, 0, 0], [4560, 3, 0], [4600, 0, 0],
            [5350, 0, 0, 0, 1, 1, E.in], [5900, 0, -pipeLen - 260]
        ]);
        ctx.kO(pipeShadow, [[0, 0], [380, 0.9], [5350, 0.9], [5700, 0]]);
        ctx.kR(ctx.q(pipe, 'valve'), [[2930, 0], [3400, 160, E.out], [4300, 160], [4450, 250, E.out]]);
        ctx.dust(PX, 0, 380, 6, 70, '#B79F86');
        ctx.at(380, function () { ctx.sfx.clank(); });

        /* ---------- whole-body path ---------- */
        var X0 = PX + 6, X1 = PX + 118;
        var hidden = top - 430;
        ctx.kT(j.root, [
            [0, X0, hidden], [640, X0, hidden, 0, 1, 1, E.grav],
            [800, X0 + 2, top - 60], [1000, X0 - 2, -260], [1250, X0, 0, 0, 1, 1],        // slide (accelerating)
            [1290, X0, 0, 0, 1.32, 0.62, E.out],                                         // SQUASH
            [1430, X0, -36, 0, 0.84, 1.2, E.in],                                          // stretch rebound
            [1560, X0, 0, 0, 1.12, 0.9, E.out], [1700, X0, 0, 0, 1, 1],
            [2060, X0, 0, 0, 1, 1], [2120, X0, 0, 0, 1.08, 0.92, E.out],                   // hop to working spot
            [2260, (X0 + X1) / 2, -58, 0, 0.94, 1.08, E.in], [2380, X1, 0, 0, 1.1, 0.9, E.out], [2460, X1, 0, 0, 1, 1],
            [2850, X1, 0], [2930, X1 - 6, 0], [3100, X1, 0],
            [3780, X1, 0], [3880, X1, 4, 0, 1.05, 0.95, E.in], [3990, X1, -6, 0, 0.96, 1.06, E.snap], [4100, X1, 0, 0, 1, 1],
            [4250, X1, -5], [4400, X1, 0], [4520, X1 - 8, 0, 0, 1, 1, E.out], [4650, X1, 0],
            [4950, X1, 0, 0, 1, 1], [5080, X1, 6, 0, 1.12, 0.86, E.in],                    // anticipation
            [5260, X1 + 110, -130, 0, 0.9, 1.12, E.rise], [5430, X1 + 210, 0, 0, 1, 1, E.grav],
            [5470, X1 + 210, 0, 0, 1.12, 0.88, E.out], [5560, X1 + 214, 0, 0, 1, 1],
            [5800, X1 + 380, -150, 0, 0.9, 1.1, E.rise], [6100, W + 260, -40, 0, 1, 1, E.grav]
        ]);
        ctx.kT(j.flip, [[0, 0, 0, 0, 1, 1], [2380, 0, 0, 0, 1, 1], [2420, 0, 0, 0, 0.1, 1, E.out], [2470, 0, 0, 0, -1, 1],
            [3420, 0, 0, 0, -1, 1], [3470, 0, 0, 0, 0.08, 1, E.out], [3540, 0, 0, 0, 1.06, 1], [3600, 0, 0, 0, 1, 1]]);

        /* ---------- body lean ---------- */
        ctx.kR(j.body, [[0, -4], [1250, -4], [1290, 10], [1430, -6], [1600, 3], [1700, 0],
            [2650, 0], [2800, -12, E.out], [2930, 14, E.in], [3050, 8], [3200, 0],
            [3880, 4], [3990, -4, E.snap], [4150, 0], [4520, -6, E.out], [4700, 0],
            [5080, 10], [5260, -8], [5430, 6], [5560, 0], [5800, -8]]);

        /* ---------- arms ---------- */
        // front arm: grip pipe → flail → grab wrench → wind-up → BONK → twirl → finger
        ctx.kR(j.shF, [[0, -172], [1250, -172], [1300, -95, E.out], [1420, -150], [1560, -40], [1700, -22],
            [2450, -22], [2560, 34, E.out], [2650, 20], [2840, -158, E.out], [2930, -42, E.in], [3020, -18, E.out], [3150, -60],
            [3320, 30, E.io], [3420, 20], [3700, -10], [3880, 32, E.in], [3990, -110, E.snap], [4080, -94], [4160, -100],
            [4900, -100], [5080, -86], [5800, -100]]);
        ctx.kR(j.elF, [[0, -12], [1250, -12], [1300, -40], [1450, -10], [1700, -18], [2560, -30], [2840, -48], [2930, -6, E.in], [3150, -30],
            [3320, -40], [3700, -30], [3880, -70, E.in], [3990, -86, E.snap], [4080, -74], [4160, -80]]);
        ctx.kT(j.wrF, [[0, 0, 0, 0], [2840, 0, 0, 20], [2930, 0, 0, -10], [3150, 0, 0, 0], [3200, 0, 0, 0], [3360, 0, 0, -360, 1, 1, E.io], [3930, 0, 0, -360, 1, 1, E.out], [4010, 0, 0, -352, 1.6, 1.6, E.back], [4120, 0, 0, -362, 1.42], [4900, 0, 0, -360, 1.42], [5080, 0, 0, -360, 1.3]]);
        ctx.kO(ctx.q(r.g, 'wrenchHand'), [[0, 0], [2560, 0, E.step], [2560, 1], [3380, 1, E.step], [3380, 0]]);
        ctx.kO(ctx.q(r.g, 'wrenchBelt'), [[0, 1], [2560, 1, E.step], [2560, 0], [3380, 0, E.step], [3380, 1]]);
        ctx.hand(r, 'F', [[0, 'fist'], [3950, 'finger'], [6300, 'finger']]);
        // back arm
        ctx.kR(j.shB, [[0, -168], [1250, -168], [1310, -70, E.out], [1440, -130], [1600, -30], [1750, -15],
            [2650, -15], [2800, 20], [2930, -30], [3200, -12], [3880, 10], [3990, -30, E.snap], [4150, 30], [4300, 40], [5080, 30], [5260, -40], [5800, -50]]);
        ctx.kR(j.elB, [[0, -10], [1250, -10], [1300, -50], [1700, -40], [3990, -80], [4150, -95], [5080, -95]]);

        /* ---------- legs + tail ---------- */
        ctx.kR(j.hipF, [[0, -60], [1250, -40], [1290, -8, E.out], [1430, 12], [1560, -6], [1700, 0],
            [2120, -10], [2260, 26], [2380, -8], [2460, 0], [5080, -12], [5260, 34], [5430, -16], [5560, 0], [5800, 34]]);
        ctx.kR(j.kneeF, [[0, 80], [1250, 50], [1290, 30, E.out], [1430, -8], [1560, 12], [1700, 0], [2120, 18], [2260, -10], [2380, 14], [2460, 0],
            [5080, 22], [5260, -14], [5430, 20], [5560, 0], [5800, -14]]);
        ctx.kR(j.ankleF, [[0, -30], [1250, -20], [1290, 0], [1430, 22], [1560, 0], [5260, 26], [5430, 0], [5800, 26]]);
        ctx.kR(j.hipB, [[0, -38], [1250, -30], [1290, -4], [1430, 16], [1560, -4], [1700, 0], [2120, -6], [2260, 30], [2380, -4], [2460, 0],
            [5080, -8], [5260, 38], [5430, -12], [5560, 0], [5800, 38]]);
        ctx.kR(j.kneeB, [[0, 64], [1250, 40], [1290, 26], [1430, -10], [1560, 10], [1700, 0], [5080, 18], [5260, -16], [5430, 16], [5560, 0], [5800, -16]]);
        ctx.kR(j.ankleB, [[0, -20], [1290, 0], [1430, 24], [1560, 0], [5260, 28], [5430, 0], [5800, 28]]);
        ctx.kR(j.tail1, [[0, 34], [1250, 30], [1290, -6, E.out], [1430, 18], [1600, -4], [1750, 0],
            [2120, 6], [2260, -14], [2380, 8], [2460, 0], [2930, -6], [3100, 0], [5080, 8], [5260, -22], [5430, 10], [5560, 0], [5800, -24]]);
        ctx.kR(j.tail2, [[0, 20], [1300, 22], [1450, -12], [1650, 6], [1800, 0], [2300, -10], [2420, 8], [2550, 0],
            [5300, -16], [5470, 14], [5600, 0], [5850, -18]]);

        /* ---------- head + face ---------- */
        ctx.kT(j.head, [[0, 0, 0, 6], [1250, 0, 0, 6], [1290, 0, 12, -4, 1, 1, E.out], [1430, 0, -6, 3], [1600, 0, 0, 0],
            [1760, 0, 0, -11], [1840, 0, 0, 10], [1910, 0, 0, -7], [1980, 0, 0, 4], [2050, 0, 0, 0],
            [2900, 0, 0, -4], [2950, 0, 2, 6, 1, 1, E.out], [3100, 0, 0, 0],
            [3430, 0, 0, -8], [3600, 0, 0, 6], [3700, 0, 0, 4],
            [4000, -6, 0, -9], [4150, -6, 0, -6], [4300, -6, 0, -10], [4450, -6, 0, -6],
            [4520, -8, 4, -10, 1, 1, E.out], [4650, 0, 0, -2], [5000, 0, 0, 0], [5260, 0, -4, -6], [5430, 0, 8, 4], [5560, 0, 0, 0]]);
        ctx.kT(j.headS, [[0, 0, 0, 0, 1, 1], [1290, 0, 0, 0, 1.12, 0.86, E.out], [1430, 0, 0, 0, 0.92, 1.08], [1580, 0, 0, 0, 1, 1],
            [3990, 0, 0, 0, 0.96, 1.05, E.snap], [4100, 0, 0, 0, 1, 1]]);
        ctx.kT(j.shades, [[0, 0, -3], [1250, 0, -3], [1290, 0, 16, 0, 1, 1, E.out], [1700, 0, 16], [1780, 0, 0, 0, 1, 1, E.back],
            [3560, 0, 0], [3760, 0, 17, -4, 1, 1, E.out], [4500, 0, 17, -4], [4540, 0, 24, 8, 1, 1, E.out], [4800, 0, 18, -2]]);
        // dizzy pupils right after the landing, then a sideways look at the user
        var dz = [[1300, 0, 0]];
        for (var i = 0; i <= 8; i++) { var a = i * Math.PI / 2.2; dz.push([1320 + i * 45, Math.cos(a) * 4, Math.sin(a) * 3]); }
        dz.push([1720, 0, 0]);
        ctx.kT(j.pupilL, dz.concat([[3760, 0, 0], [3820, 3, 1], [4520, 3, 1], [4560, 0, 2]]));
        ctx.kT(j.pupilR, dz.map(function (p) { return [p[0], -p[1], p[2]]; }).concat([[3760, 0, 0], [3820, 3, 1], [4520, 3, 1], [4560, 0, 2]]));
        ctx.kT(j.lidL, [[0, 0, 0], [3760, 0, 0], [3820, 0, 8], [4180, 0, 8], [4250, 0, 22], [4340, 0, 8], [4520, 0, 8], [4560, 0, 20], [4800, 0, 14]]);
        ctx.kT(j.lidR, [[0, 0, 0], [3760, 0, 0], [3820, 0, 6], [4520, 0, 6], [4560, 0, 20], [4800, 0, 14]]);
        ctx.kT(j.browL, [[0, 0, -4], [1250, 0, -6], [1300, 0, 2, 10], [1700, 0, 0, 6], [2100, 0, 0], [2850, 0, 3, 12], [2950, 0, -6], [3100, 0, 0],
            [3700, 0, 0], [3800, 0, -7, -8], [4500, 0, -7, -8], [4540, 0, 4, 14], [5000, 0, 2, 10]]);
        ctx.kT(j.browR, [[0, 0, -4], [1250, 0, -6], [1300, 0, 2, -10], [1700, 0, 0, -6], [2100, 0, 0], [2850, 0, 3, -12], [2950, 0, -6], [3100, 0, 0],
            [3700, 0, 0], [3800, 0, 2, -10], [4500, 0, 2, -10], [4540, 0, 4, -14], [5000, 0, 2, -10]]);

        /* ---------- effects ---------- */
        // friction sparks off the gripping paws while sliding
        for (var t = 760; t <= 1200; t += 55) {
            var hp = ctx.pos(r.m.handF, t);
            for (var k = 0; k < 2; k++) {
                var sp = ctx.add('<path d="M0,0 l7,-2" stroke="#FFD27A" stroke-width="2.4" stroke-linecap="round"/>');
                var dx = (k ? 1 : -1) * (24 + Math.random() * 30), dy = -10 - Math.random() * 30;
                ctx.kT(sp, [[t - 1, hp.x, hp.y, 0, 0], [t, hp.x, hp.y, Math.random() * 360, 1], [t + 240, hp.x + dx, hp.y + dy + 30, Math.random() * 360, 0.4, 0.4, E.out]]);
                ctx.kO(sp, [[t - 1, 0], [t, 1], [t + 240, 0]]);
            }
        }
        ctx.dust(X0, 0, 1290, 9, 130);
        // bonk spark at the wrench head
        var hit = ctx.pos(ctx.q(r.g, 'wrenchHand'), 2930);
        var star = ctx.add('<path d="M0,-22 L5,-6 L22,0 L5,6 L0,22 L-5,6 L-22,0 L-5,-6 Z" fill="#FFE7A0" stroke="#1B1712" stroke-width="1.6"/>');
        ctx.kT(star, [[2929, PX + 18, hit.y, 0, 0], [2930, PX + 18, hit.y, 0, 0.3], [3010, PX + 18, hit.y, 20, 1.3, 1.3, E.out], [3160, PX + 18, hit.y, 40, 0.6]]);
        ctx.kO(star, [[2929, 0], [2930, 1], [3100, 1], [3180, 0]]);
        // the leak: a jet from the coupling arcs onto his head
        var head = ctx.pos(r.m.headTop, 4520);
        var sx = PX + 18, sy = -340;
        for (var d = 0; d < 9; d++) {
            var t0 = 4240 + d * 34, t1 = t0 + 280;
            var drop = ctx.add('<ellipse rx="4.5" ry="6" fill="#9ED8F2" stroke="#2C6A86" stroke-width="1.2"/>');
            var mx = (sx + head.x) / 2, my = Math.min(sy, head.y) - 70;
            ctx.kT(drop, [[t0 - 1, sx, sy, 0, 0], [t0, sx, sy, 60, 0.8], [(t0 + t1) / 2, mx, my, 90, 1, 1, E.in], [t1, head.x - 6 + d * 2, head.y + 10, 120, 1.1]]);
            ctx.kO(drop, [[t0 - 1, 0], [t0, 1], [t1, 1], [t1 + 1, 0]]);
        }
        for (var s = 0; s < 6; s++) {                   // splash + drips
            var sd = ctx.add('<ellipse rx="3.5" ry="5" fill="#9ED8F2" stroke="#2C6A86" stroke-width="1"/>');
            var ang = -Math.PI * (0.15 + 0.7 * s / 5), v = 50 + Math.random() * 30;
            ctx.kT(sd, [[4519, head.x, head.y + 6, 0, 0], [4520, head.x, head.y + 6, 0, 1], [4800, head.x + Math.cos(ang) * v, head.y + 6 + Math.sin(ang) * v + 60, 0, 0.6, 0.6, E.grav]]);
            ctx.kO(sd, [[4519, 0], [4520, 1], [4800, 0]]);
        }
        // contact shadow follows the feet
        ctx.autoShadow(r.shadow, r.m.footF, 0, 6300);

        /* ---------- sound + line ---------- */
        ctx.at(700, function () { ctx.sfx.friction(0.55); });
        ctx.at(1260, function () { ctx.sfx.thud(1.1); });
        ctx.at(1300, function () { ctx.sfx.boing(); });
        ctx.at(2380, function () { ctx.sfx.thud(0.4); });
        ctx.at(2930, function () { ctx.sfx.clang(); });
        ctx.at(3940, function () { ctx.sfx.pop(); ctx.sfx.sting(); });
        ctx.at(4240, function () { ctx.sfx.whoosh(0.3); });
        ctx.at(4520, function () { ctx.sfx.splash(); });
        ctx.at(5300, function () { ctx.sfx.slide(true); });
        ctx.at(5430, function () { ctx.sfx.thud(0.5); });
        ctx.say(ctx.line || this.line, 3960, 1500, r.m.headTop);
    }
});
