/* Cameo: "Baller Roo" — show-off slam dunk.
 * Beats: hop-dribble entrance → spin showboat → two gather hops → deep crouch →
 * launch → SLAM (rim bends + springs, net whips, board shakes) → hangs on the rim →
 * drops, lands → turns, finger + "Rejected, mate." → swagger strut exit.
 */
FRCameos.register({
    id: 'dunk',
    line: 'Rejected, mate.',
    duration: 6600,
    poseAt: 4150,
    defs:
        '<linearGradient id="frGold" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#F6D98F"/><stop offset=".5" stop-color="#D9A441"/><stop offset="1" stop-color="#A3721F"/></linearGradient>' +
        '<radialGradient id="frBall" cx=".35" cy=".3" r=".75"><stop offset="0" stop-color="#F3A061"/><stop offset=".55" stop-color="#D2692A"/><stop offset="1" stop-color="#8A3A12"/></radialGradient>' +
        '<linearGradient id="frGlass" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="rgba(230,245,250,.30)"/><stop offset=".45" stop-color="rgba(230,245,250,.10)"/><stop offset=".5" stop-color="rgba(255,255,255,.28)"/><stop offset=".56" stop-color="rgba(230,245,250,.08)"/><stop offset="1" stop-color="rgba(230,245,250,.16)"/></linearGradient>' +
        '<linearGradient id="frPole" x1="0" x2="1"><stop offset="0" stop-color="#1B2F35"/><stop offset=".4" stop-color="#4C6A72"/><stop offset="1" stop-color="#14252A"/></linearGradient>',

    outfit: function () {
        var ink = ' stroke="#1B1712" stroke-width="2" stroke-linejoin="round"';
        var pet = '#0F2427';
        return {
            torso:
                '<path d="M-31,-100 C-29,-114 -19,-120 -13,-121 C-7,-106 13,-106 19,-122 C29,-118 39,-110 43,-98 C49,-70 47,-40 42,-14 C37,4 20,10 2,10 C-14,10 -26,8 -31,2 C-39,-30 -39,-70 -31,-100 Z" fill="url(#frGold)"' + ink + '/>' +
                '<path d="M-13,-121 C-7,-104 13,-104 19,-122" fill="none" stroke="' + pet + '" stroke-width="5"/>' +
                '<path d="M-31,-100 C-27,-86 -27,-70 -33,-58 M43,-98 C36,-86 36,-70 44,-60" fill="none" stroke="' + pet + '" stroke-width="4.5"/>' +
                '<g transform="translate(10,0)"><g data-j="jerseyText"><text x="-1" y="-80" text-anchor="middle" font-family="Big Shoulders Display, Arial Narrow, sans-serif" font-weight="800" font-size="15" fill="' + pet + '" letter-spacing="1">ROOS</text>' +
                '<text x="0" y="-36" text-anchor="middle" font-family="Big Shoulders Display, Arial Narrow, sans-serif" font-weight="900" font-size="40" fill="' + pet + '" stroke="#EEE6CE" stroke-width="2.5" paint-order="stroke">00</text></g></g>' +
                '<path d="M-36,-6 C-12,4 22,4 45,-8 L46,6 C22,16 -12,16 -36,6 Z" fill="' + pet + '"/>',
            thighF: '<path d="M-24,-16 C-44,8 -36,58 0,64 C32,68 52,48 44,24 C36,0 14,-24 -24,-16 Z" fill="url(#frGold)"' + ink + '/><path d="M-30,6 C-28,30 -18,50 0,60" fill="none" stroke="' + pet + '" stroke-width="5"/>',
            thighB: '<path d="M-24,-16 C-44,8 -36,58 0,64 C32,68 52,48 44,24 C36,0 14,-24 -24,-16 Z" fill="#A9802E"' + ink + '/>',
            shinF: '<path d="M-9,-2 C-13,10 -23,28 -27,38 L-12,44 C-7,33 3,14 8,4 Z" fill="#F2EDE2"' + ink + '/><path d="M-10,8 L4,13 M-13,15 L1,20" stroke="' + pet + '" stroke-width="3.5"/>',
            shinB: '<path d="M-9,-2 C-13,10 -23,28 -27,38 L-12,44 C-7,33 3,14 8,4 Z" fill="#C9C3B6"' + ink + '/>',
            footF: '<path d="M-14,-16 C-19,0 -14,15 -2,15 L66,15 C79,15 81,2 70,-3 L36,-6 C22,-8 12,-18 0,-19 Z" fill="#F4F0E8"' + ink + '/><path d="M8,-8 C24,-4 40,-2 56,-2" fill="none" stroke="#D9A441" stroke-width="5" stroke-linecap="round"/><path d="M-6,15 L74,15" stroke="#1B1712" stroke-width="5" stroke-linecap="round"/>',
            footB: '<path d="M-14,-16 C-19,0 -14,15 -2,15 L66,15 C79,15 81,2 70,-3 L36,-6 C22,-8 12,-18 0,-19 Z" fill="#CFC9BD"' + ink + '/><path d="M-6,15 L74,15" stroke="#0E0B08" stroke-width="5" stroke-linecap="round"/>',
            foreF: '<rect x="-9" y="14" width="18" height="11" rx="3" fill="#F2EDE2"' + ink + '/><path d="M-9,19.5 h18" stroke="' + pet + '" stroke-width="2.5"/>',
            hat: '<path d="M-46,-108 C-20,-114 22,-116 48,-110 L47,-99 C22,-105 -20,-103 -45,-97 Z" fill="#F2EDE2"' + ink + '/><path d="M-45,-103 C-20,-109 22,-110 47,-105" fill="none" stroke="' + pet + '" stroke-width="3"/>'
        };
    },

    build: function (ctx) {
        var E = ctx.E, W = ctx.W;
        var RX = W - 150, RY = -335;
        var xA = RX - 430, xB = RX - 340, xC = RX - 250;

        /* ---------- the hoop (back to front: pole, board, rim back, ball, net, rim front) ---------- */
        var hoop = ctx.add(
            '<g data-j="board">' +
              '<rect x="' + (RX + 70) + '" y="-470" width="20" height="470" fill="url(#frPole)" stroke="#0A1416" stroke-width="2"/>' +
              '<path d="M' + (RX + 80) + ',-400 L' + (RX + 40) + ',-400" stroke="url(#frPole)" stroke-width="14"/>' +
              '<rect x="' + (RX + 56) + '" y="-14" width="48" height="14" rx="3" fill="#1B2F35"/>' +
              '<rect x="' + (RX - 78) + '" y="-455" width="156" height="104" rx="4" fill="url(#frGlass)" stroke="#EEE6CE" stroke-width="5"/>' +
              '<rect x="' + (RX - 28) + '" y="-410" width="56" height="44" fill="none" stroke="#D9A441" stroke-width="4"/>' +
              '<rect data-j="flash" x="' + (RX - 78) + '" y="-455" width="156" height="104" rx="4" fill="#fff" opacity="0"/>' +
            '</g>');
        var rimBack = ctx.add('<g data-j="rimB"><path d="M' + (RX - 36) + ',' + RY + ' C' + (RX - 34) + ',' + (RY - 12) + ' ' + (RX + 34) + ',' + (RY - 12) + ' ' + (RX + 36) + ',' + RY + '" fill="none" stroke="#B84E1F" stroke-width="5"/><rect x="' + (RX - 8) + '" y="' + (RY - 16) + '" width="16" height="12" fill="#8A3A12"/></g>');
        var ball = ctx.add('<g data-j="ballPos"><g data-j="ballSpin"><circle r="19" fill="url(#frBall)" stroke="#2A140A" stroke-width="2"/>' +
            '<path d="M-19,0 H19 M0,-19 V19 M-13,-13 C-4,-6 -4,6 -13,13 M13,-13 C4,-6 4,6 13,13" fill="none" stroke="#2A140A" stroke-width="1.6"/></g></g><circle data-m="ball" r="1" fill="none"/>');
        var netPath = '';
        for (var i = 0; i <= 6; i++) {
            var tx = RX - 34 + i * (68 / 6), bx = RX - 20 + i * (40 / 6);
            netPath += 'M' + tx + ',' + (RY + 2) + ' L' + (bx + (i % 2 ? 6 : -6)) + ',' + (RY + 60) + ' ';
        }
        [16, 32, 48].forEach(function (dy) { var w = 34 - dy * 0.24; netPath += 'M' + (RX - w) + ',' + (RY + dy) + ' Q' + RX + ',' + (RY + dy + 7) + ' ' + (RX + w) + ',' + (RY + dy); });
        var rimFront = ctx.add('<g data-j="rimF"><g transform="translate(' + RX + ',' + RY + ')"><g data-j="net"><path transform="translate(' + (-RX) + ',' + (-RY) + ')" d="' + netPath + '" fill="none" stroke="#EEE6CE" stroke-width="2.2" stroke-linecap="round"/></g></g>' +
            '<path d="M' + (RX - 36) + ',' + RY + ' C' + (RX - 34) + ',' + (RY + 12) + ' ' + (RX + 34) + ',' + (RY + 12) + ' ' + (RX + 36) + ',' + RY + '" fill="none" stroke="#E36B2C" stroke-width="6" stroke-linecap="round"/></g>');
        var ballShadow = ctx.add('<ellipse cx="0" cy="2" rx="22" ry="5" fill="url(#frShadow' + ctx.uid + ')"/>');
        var r = ctx.roo(this.outfit());
        var j = r.j;
        var ballEl = ball.querySelector('[data-j="ballSpin"]'), ballM = ball.querySelector('[data-m="ball"]');
        // a second ball in front of the kangaroo, used while it's palmed overhead
        var ballFront = ctx.add(ball.innerHTML.replace('data-m="ball"', 'data-m="ballF"'));
        var ballFEl = ctx.q(ballFront, 'ballSpin');

        /* ---------- joints first (root is added after we know where the hands are) ---------- */
        var hops = [0, 330, 660, 990];
        var bodyRows = [[0, 6]], shF = [[0, -40]], elF = [[0, -30]], hipF = [[0, 0]], kneeF = [[0, 0]], hipB = [[0, 0]], kneeB = [[0, 0]], t1 = [[0, 0]];
        hops.forEach(function (h) {
            shF.push([h + 20, -18, E.out], [h + 200, -46], [h + 330, -56, E.in]);
            hipF.push([h + 40, 22], [h + 200, -14], [h + 320, 10]); kneeF.push([h + 40, -14], [h + 200, 16], [h + 320, -4]);
            hipB.push([h + 40, 26], [h + 200, -10], [h + 320, 12]); kneeB.push([h + 40, -16], [h + 200, 14], [h + 320, -4]);
            t1.push([h + 40, -10], [h + 200, 8], [h + 320, -4]);
        });
        // showboat spin + extra bounce, then gather hops, crouch, launch, slam, hang, drop
        shF.push([1400, -24, E.out], [1560, -50], [1650, -58], [1900, -40], [2050, -30], [2160, 30, E.io], [2300, 10],
            [2520, -128, E.out], [2650, -146], [2700, -100, E.in], [2760, -108], [3100, -112], [3150, -100], [3330, -40, E.out], [3500, -24],
            [3760, 30, E.in], [3870, -110, E.snap], [3960, -94], [4040, -100], [5200, -100], [5350, -30], [5600, -60], [5900, -20], [6200, -60]);
        elF.push([2160, -10], [2520, -6], [2650, -18], [2700, 0, E.in], [3150, -10], [3330, -40], [3760, -70, E.in], [3870, -86, E.snap], [3960, -74], [4040, -80], [5200, -80], [5350, -40]);
        ctx.kR(j.shF, shF); ctx.kR(j.elF, elF);
        ctx.kT(j.wrF, [[0, 0, 0, 0], [3820, 0, 0, 0, 1, 1, E.out], [3890, 0, 0, 8, 1.65, 1.65, E.back], [4000, 0, 0, 0, 1.42], [5200, 0, 0, 0, 1.42], [5350, 0, 0, 0, 1]]);
        ctx.hand(r, 'F', [[0, 'fist'], [3860, 'finger'], [5300, 'fist']]);
        ctx.kR(j.shB, [[0, -20], [1320, -20], [1650, -50], [2160, 40], [2300, 20], [2520, -150], [2700, -60], [3100, -40], [3330, -10],
            [3760, 20], [3900, 50, E.out], [5200, 50], [5350, -30], [5650, 20], [5950, -30], [6250, 20]]);
        ctx.kR(j.elB, [[0, -30], [2160, -20], [2520, -60], [3330, -30], [3760, -40], [3900, -110, E.out], [5200, -110], [5350, -30]]);
        hipF.push([1400, 0], [1650, 8], [1750, -18], [1850, 14], [1950, -18], [2050, 10],
            [2160, -36, E.out], [2250, -40], [2330, 40, E.snap], [2600, 30], [2700, 12], [2820, -22], [2940, 14], [3060, -10], [3150, 0],
            [3300, -10], [3340, -30, E.out], [3500, 0], [5300, 0], [5420, -26], [5560, 18], [5700, -26], [5840, 18], [5980, -26], [6120, 18]);
        kneeF.push([1400, 0], [2160, 60, E.out], [2250, 66], [2330, -18, E.snap], [2600, -6], [2700, 10], [2940, 24], [3150, 8],
            [3340, 46, E.out], [3500, 0], [5300, 0], [5420, 20], [5560, -6], [5700, 20], [5840, -6], [5980, 20]);
        hipB.push([1400, 0], [1650, 10], [1750, -14], [1850, 16], [1950, -14], [2050, 12],
            [2160, -30, E.out], [2250, -34], [2330, 46, E.snap], [2600, 36], [2700, 20], [2820, -10], [2940, 22], [3060, -2], [3150, 4],
            [3340, -26, E.out], [3500, 0], [5300, 0], [5420, 18], [5560, -26], [5700, 18], [5840, -26], [5980, 18], [6120, -26]);
        kneeB.push([1400, 0], [2160, 54, E.out], [2250, 60], [2330, -16, E.snap], [2600, -4], [2940, 30], [3150, 12],
            [3340, 42, E.out], [3500, 0], [5420, -6], [5560, 20], [5700, -6], [5840, 20], [5980, -6]);
        ctx.kR(j.hipF, hipF); ctx.kR(j.kneeF, kneeF); ctx.kR(j.hipB, hipB); ctx.kR(j.kneeB, kneeB);
        ctx.kR(j.ankleF, [[0, 0], [2160, -16], [2330, 34, E.snap], [2600, 24], [3150, 30], [3340, -10], [3500, 0]]);
        ctx.kR(j.ankleB, [[0, 0], [2160, -14], [2330, 38, E.snap], [2600, 26], [3150, 34], [3340, -8], [3500, 0]]);
        t1.push([1400, 0], [2160, 16], [2330, -24, E.snap], [2600, -30], [2700, -10], [2820, 16], [2940, -8], [3060, 6], [3330, 10, E.out], [3500, 0],
            [5300, 0], [5420, -8], [5560, 6], [5700, -8], [5840, 6], [5980, -8]);
        ctx.kR(j.tail1, t1);
        ctx.kR(j.tail2, [[0, 0], [2330, -10], [2600, -26], [2760, 18], [2900, -10], [3040, 6], [3360, 14], [3560, 0], [5400, -10], [5700, 10], [6000, -10]]);
        bodyRows.push([1320, 4], [1400, -6], [1650, 4], [2160, 22, E.out], [2250, 24], [2330, -6, E.snap], [2600, 10], [2700, 26, E.in],
            [2820, -12], [2940, 8], [3060, -4], [3150, 0], [3340, 12, E.out], [3500, 0], [3760, 6], [3870, -6, E.snap], [4000, 0],
            [5300, -8], [5450, -12], [5600, -6], [5750, -12], [5900, -6], [6050, -12]);
        ctx.kR(j.body, bodyRows);
        ctx.kT(j.head, [[0, 0, 0, 0], [1320, 0, 0, 0], [1420, 0, 0, -8], [1560, 0, 0, 6], [1650, 0, 0, 0], [2160, 0, 6, 10], [2330, 0, -6, -8], [2600, 0, 0, -4],
            [2700, 0, 6, 12, 1, 1, E.out], [2820, 0, -4, -8], [2940, 0, 2, 4], [3100, 0, 0, 0], [3340, 0, 10, 6, 1, 1, E.out], [3500, 0, 0, 0],
            [3870, -6, 0, -8], [4100, -6, 0, -4], [4300, -6, 0, -9], [5300, 0, 0, -6], [5450, 0, 4, -10], [5600, 0, 0, -6], [5750, 0, 4, -10], [5900, 0, 0, -6], [6050, 0, 4, -10]]);
        ctx.kT(j.headS, [[0, 0, 0, 0, 1, 1], [2700, 0, 0, 0, 1, 1], [2730, 0, 0, 0, 1.1, 0.9, E.out], [2850, 0, 0, 0, 1, 1], [3340, 0, 0, 0, 1.1, 0.88, E.out], [3480, 0, 0, 0, 1, 1]]);
        ctx.kT(j.shades, [[0, 0, 0], [2700, 0, 0], [2730, 0, 10, 0, 1, 1, E.out], [2900, 0, 0, 0, 1, 1, E.back], [3340, 0, 0], [3370, 0, 12, 0, 1, 1, E.out], [3520, 0, 0, 0, 1, 1, E.back],
            [3780, 0, 0], [3940, 0, 17, -3, 1, 1, E.out], [5200, 0, 17, -3], [5320, 0, 0, 0, 1, 1, E.back]]);
        ctx.kT(j.lidL, [[0, 0, 0], [3900, 0, 0], [3960, 0, 9], [5200, 0, 9], [5300, 0, 0]]);
        ctx.kT(j.lidR, [[0, 0, 0], [3900, 0, 0], [3960, 0, 9], [5200, 0, 9], [5300, 0, 0]]);
        ctx.kT(j.pupilL, [[0, 0, 0], [3900, 0, 0], [3960, -3, 1], [5200, -3, 1]]);
        ctx.kT(j.pupilR, [[0, 0, 0], [3900, 0, 0], [3960, -3, 1], [5200, -3, 1]]);
        ctx.kT(j.browL, [[0, 0, 0], [2160, 0, 3, 12], [2330, 0, -6, -6], [2700, 0, -8, -10], [3100, 0, 0], [3880, 0, -8, -6], [5200, 0, -8, -6], [5300, 0, -3]]);
        ctx.kT(j.browR, [[0, 0, 0], [2160, 0, 3, -12], [2330, 0, -6, 6], [2700, 0, -8, 10], [3100, 0, 0], [3880, 0, -2, 8], [5200, 0, -2, 8], [5300, 0, -3]]);
        ctx.kT(j.flip, [[0, 0, 0, 0, 1, 1], [1400, 0, 0, 0, 1, 1], [1450, 0, 0, 0, 0.06, 1, E.in], [1500, 0, 0, 0, -1, 1, E.out], [1550, 0, 0, 0, 0.06, 1, E.in], [1600, 0, 0, 0, 1, 1, E.out],
            [3540, 0, 0, 0, 1, 1], [3600, 0, 0, 0, 0.06, 1, E.in], [3680, 0, 0, 0, -1.06, 1, E.out], [3740, 0, 0, 0, -1, 1]]);

        // keep the lettering readable whenever he's flipped
        ctx.kT(ctx.q(r.g, 'jerseyText'), [[0, 0, 0, 0, 1, 1], [1475, 0, 0, 0, 1, 1, E.step], [1475, 0, 0, 0, -1, 1], [1575, 0, 0, 0, -1, 1, E.step], [1575, 0, 0, 0, 1, 1],
            [3640, 0, 0, 0, 1, 1, E.step], [3640, 0, 0, 0, -1, 1]]);

        /* ---------- root: hop-dribble in, gather, launch, hang on the rim, drop ---------- */
        // where is the front paw relative to the root while hanging? (root is still identity here)
        var hang = [], grip = { x: RX - 24, y: RY + 4 };
        for (var t = 2700; t <= 3100; t += 40) { var hp = ctx.pos(r.m.handF, t); hang.push([t, grip.x - hp.x, grip.y - hp.y, 0, 1, 1, E.lin]); }
        var rootRows = [];
        hops.forEach(function (h, i) {
            var x0 = -W - 220 + (xA + W + 220) * (i / 4), x1 = -W - 220 + (xA + W + 220) * ((i + 1) / 4);
            rootRows.push([h, x0, 0, 0, 1.08, 0.92], [h + 40, x0 + 6, -4, 0, 0.94, 1.06, E.rise], [h + 170, (x0 + x1) / 2, -52, 0, 1, 1, E.grav], [h + 310, x1 - 4, 0, 0, 1.08, 0.92, E.out]);
        });
        rootRows.push([1320, xA, 0, 0, 1, 1], [1400, xA + 10, 0, 0, 1.05, 0.95], [1650, xA, 0, 0, 1, 1],
            [1700, xA, -4, 0, 0.95, 1.05, E.rise], [1780, (xA + xB) / 2, -44, 0, 1, 1, E.grav], [1860, xB, 0, 0, 1.08, 0.92, E.out],
            [1900, xB, -4, 0, 0.95, 1.05, E.rise], [1980, (xB + xC) / 2, -50, 0, 1, 1, E.grav], [2060, xC, 0, 0, 1.1, 0.9, E.out],
            [2250, xC, 8, 0, 1.18, 0.8, E.io],                                                // deep crouch
            [2330, xC + 20, -40, 0, 0.84, 1.2, E.snap]);                                     // explode
        rootRows.push([2560, (xC + hang[0][1]) / 2 + 30, hang[0][2] - 70, 0, 0.94, 1.06, E.grav]);
        hang.forEach(function (h) { rootRows.push(h); });
        var last = hang[hang.length - 1];
        rootRows.push([3150, last[1] - 4, last[2] + 6, 0, 1, 1, E.grav], [3330, last[1] - 40, 0, 0, 1, 1, E.out],
            [3360, last[1] - 40, 0, 0, 1.26, 0.72, E.out], [3500, last[1] - 40, -8, 0, 0.94, 1.06], [3600, last[1] - 40, 0, 0, 1, 1],
            [3760, last[1] - 40, 4, 0, 1.04, 0.96], [3870, last[1] - 40, -6, 0, 0.96, 1.05, E.snap], [3990, last[1] - 40, 0, 0, 1, 1],
            [4150, last[1] - 40, -6], [4300, last[1] - 40, 0], [4450, last[1] - 40, -6], [4600, last[1] - 40, 0], [5300, last[1] - 40, 0]);
        // swagger strut: slow cocky hops off to the left
        var sx = last[1] - 40, step = (sx + W + 260) / 6;
        for (var k = 0; k < 6; k++) {
            var t0 = 5300 + k * 140 + (k ? 60 * k : 0);
            rootRows.push([t0 + 60, sx - step * k - step * 0.5, -30, 0, 0.97, 1.03, E.rise], [t0 + 150, sx - step * (k + 1), 0, 0, 1.05, 0.95, E.grav]);
        }
        ctx.kT(j.root, rootRows);

        /* ---------- the ball: dribbles, gets palmed, slammed, bounces away ---------- */
        var br = [];
        hops.forEach(function (h) {
            var a = ctx.pos(r.m.handF, h + 20), c = ctx.pos(r.m.handF, h + 330);
            br.push([h + 20, a.x + 4, a.y + 18, 0, 1, 1, E.grav], [h + 175, (a.x + c.x) / 2 + 12, -19, 0, 1.12, 0.86, E.rise], [h + 330, c.x + 4, c.y + 18, 0, 1, 1]);
        });
        var a2 = ctx.pos(r.m.handF, 1400), c2 = ctx.pos(r.m.handF, 1640);
        br.push([1400, a2.x + 4, a2.y + 18, 0, 1, 1, E.grav], [1520, (a2.x + c2.x) / 2, -19, 0, 1.12, 0.86, E.rise], [1640, c2.x + 4, c2.y + 18]);
        for (var tb = 1680; tb <= 2660; tb += 40) { var p = ctx.pos(r.m.handF, tb); br.push([tb, p.x, p.y + 4, 0, 1, 1, E.lin]); }
        br.push([2720, RX, RY - 4, 0, 1, 1, E.in], [2820, RX, RY + 62, 0, 1, 1, E.grav], [3020, RX + 10, -19, 0, 1.15, 0.85, E.rise],
            [3200, RX + 40, -150, 0, 1, 1, E.grav], [3380, RX + 70, -19, 0, 1.1, 0.9, E.rise], [3500, RX + 92, -70, 0, 1, 1, E.grav],
            [3610, RX + 112, -19, 0, 1.05, 0.95, E.rise], [3680, RX + 126, -30, 0, 1, 1, E.grav], [3750, RX + 140, -19], [4600, W + 120, -19, 0, 1, 1, E.out]);
        ctx.kT(ctx.q(ball, 'ballPos'), br); ctx.kT(ballM, br); ctx.kT(ctx.q(ballFront, 'ballPos'), br);
        ctx.kO(ball, [[0, 1], [1700, 1, E.step], [1700, 0], [2720, 0, E.step], [2720, 1]]);
        ctx.kO(ballFront, [[0, 0], [1700, 0, E.step], [1700, 1], [2720, 1, E.step], [2720, 0]]);
        var spin = [[0, 0, E.lin]];
        for (var sp = 300; sp <= 4600; sp += 300) spin.push([sp, sp * 0.9, E.lin]);
        ctx.kR(ballEl, spin); ctx.kR(ballFEl, spin);
        // ball and roo share the same layer; keep the ball's group in sync
        ctx.autoShadow(ballShadow.firstChild, ballM, 0, 4700, { lift: 340, scale: 1 });

        /* ---------- hoop reaction ---------- */
        var dip = [[0, 0, 0, 0, 1, 1], [2700, 0, 0, 0, 1, 1], [2730, 0, 14, 0, 1, 1.9, E.out], [2800, 0, -5, 0, 1, 0.8], [2880, 0, 7, 0, 1, 1.35], [2960, 0, -3, 0, 1, 0.92],
            [3040, 0, 2, 0, 1, 1.12], [3100, 0, 10, 0, 1, 1.5], [3180, 0, -3, 0, 1, 0.86], [3260, 0, 2, 0, 1, 1.1], [3360, 0, 0, 0, 1, 1]];
        // rim tilts around its back attachment: scaleY about the rim line
        [rimFront.firstChild, rimBack.firstChild].forEach(function (g) {
            g.style.transformOrigin = RX + 'px ' + RY + 'px';
            ctx.kT(g, dip);
        });
        ctx.kT(ctx.q(rimFront, 'net'), [[0, 0, 0, 0, 1, 1], [2700, 0, 0, 0, 1, 1], [2760, 0, 0, 0, 1.1, 1.7, E.out], [2860, 0, 0, 8, 0.92, 0.82], [2960, 0, 0, -6, 1.04, 1.22],
            [3060, 0, 0, 4, 0.98, 0.94], [3160, 0, 0, -2, 1, 1.08], [3300, 0, 0, 0, 1, 1]]);
        ctx.kT(hoop.firstChild, [[0, 0, 0], [2700, 0, 0], [2730, 6, 3], [2770, -6, -2], [2810, 5, 2], [2860, -3, 0], [2920, 2, 0], [3000, 0, 0], [3100, 3, 1], [3150, -2, 0], [3220, 0, 0]]);
        ctx.kO(ctx.q(hoop, 'flash'), [[0, 0], [2700, 0], [2720, 0.55], [2900, 0]]);
        // floor shake on the landing
        ctx.kT(ctx.world, [[0, 0, 0], [3330, 0, 0], [3350, 0, 6], [3390, 0, -4], [3430, 0, 3], [3480, 0, 0]]);

        ctx.dust(RX, RY + 4, 2700, 6, 46, '#F4D48A');
        ctx.dust(last[1] - 40, 0, 3360, 9, 120);
        ctx.dust(xC + 10, 0, 2330, 6, 70);
        ctx.autoShadow(r.shadow, r.m.footF, 0, 6600);

        /* ---------- sound + line ---------- */
        hops.forEach(function (h) { ctx.at(h + 175, function () { ctx.sfx.bounce(0.9); }); });
        ctx.at(1520, function () { ctx.sfx.bounce(0.9); });
        ctx.at(1450, function () { ctx.sfx.squeak(); });
        ctx.at(2200, function () { ctx.sfx.squeak(); });
        ctx.at(2330, function () { ctx.sfx.whoosh(0.35); });
        ctx.at(2700, function () { ctx.sfx.clang(1.2); ctx.sfx.rattle(); });
        ctx.at(2760, function () { ctx.sfx.swish(); });
        ctx.at(3020, function () { ctx.sfx.bounce(1); });
        ctx.at(3330, function () { ctx.sfx.thud(1.1); });
        ctx.at(3380, function () { ctx.sfx.bounce(0.7); });
        ctx.at(3610, function () { ctx.sfx.bounce(0.4); });
        ctx.at(3860, function () { ctx.sfx.pop(); ctx.sfx.sting(); });
        ctx.say(ctx.line || this.line, 3880, 1450, r.m.headTop);
    }
});
