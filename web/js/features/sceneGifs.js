/* The GIF backgrounds in web/ASCII/.
 *
 * These are pictures, not drawn scenes, so they do not use the SVG stage: scenes.js renders
 * one <img class="fr-photo"> that covers the viewport. Only the chosen one is ever in the DOM,
 * so only that file is fetched, and none of them is precached by the service worker.
 * Each has a small still of its first frame in ASCII/thumbs/, used for the picker card and
 * shown in place of the animation when the person has asked for reduced motion.
 *
 * To add another: drop the GIF in web/ASCII/, make a still with tools/gif_thumbs.py, add a row.
 */
const DIR = 'ASCII/';

/*  id, name, blurb, file, still, ambient bed  */
const FILES = [
    ['bg-ascii-rest-alpine-dawn', 'Alpine dawn', 'First light on the alps', 'ascii-rest-alpine-dawn.gif', 'ascii-rest-alpine-dawn.png', 'wind'],
    ['bg-ascii-rest-amer-fort', 'Amer Fort', 'Hill fort above the lake', 'ascii-rest-amer-fort.gif', 'ascii-rest-amer-fort.png', 'wind'],
    ['bg-ascii-rest-aurora-fjord', 'Aurora fjord', 'Northern lights over the fjord', 'ascii-rest-aurora-fjord.gif', 'ascii-rest-aurora-fjord.png', 'wind'],
    ['bg-ascii-rest-cloud-sea', 'Cloud sea', 'Above a sea of cloud', 'ascii-rest-cloud-sea.gif', 'ascii-rest-cloud-sea.png', 'wind'],
    ['bg-ascii-rest-desert-night', 'Desert night', 'Dunes under the stars', 'ascii-rest-desert-night.gif', 'ascii-rest-desert-night.png', 'wind'],
    ['bg-ascii-rest-earthrise', 'Earthrise', 'Earth over the lunar edge', 'ascii-rest-earthrise.gif', 'ascii-rest-earthrise.png', 'brown'],
    ['bg-ascii-rest-gangaur-ghat', 'Gangaur Ghat', 'Steps down to the water', 'ascii-rest-gangaur-ghat.gif', 'ascii-rest-gangaur-ghat.png', 'ocean'],
    ['bg-ascii-rest-kyoto-dusk', 'Kyoto dusk', 'Pagoda at dusk', 'ascii-rest-kyoto-dusk.gif', 'ascii-rest-kyoto-dusk.png', 'crickets'],
    ['bg-ascii-rest-marine-drive', 'Marine Drive', 'The bay strung with lights', 'ascii-rest-marine-drive.gif', 'ascii-rest-marine-drive.png', 'ocean'],
    ['bg-ascii-rest-misty-forest', 'Misty forest', 'Fog between the trunks', 'ascii-rest-misty-forest.gif', 'ascii-rest-misty-forest.png', 'meadow'],
    ['bg-ascii-rest-night-highway', 'Night highway', 'Tail lights into the dark', 'ascii-rest-night-highway.gif', 'ascii-rest-night-highway.png', 'brown'],
    ['bg-ascii-rest-ocean-sunset', 'Ocean sunset', 'Sun going down over the water', 'ascii-rest-ocean-sunset.gif', 'ascii-rest-ocean-sunset.png', 'ocean'],
    ['bg-ascii-rest-snow-train', 'Snow train', 'A train through the snow', 'ascii-rest-snow-train.gif', 'ascii-rest-snow-train.png', 'brown'],
    ['bg-ascii-rest-tokyo-rain', 'Tokyo rain', 'Neon on a wet street', 'ascii-rest-tokyo-rain.gif', 'ascii-rest-tokyo-rain.png', 'rain'],
    ['bg-ascii-rest-volcano-night', 'Volcano night', 'Lava against the night', 'ascii-rest-volcano-night.gif', 'ascii-rest-volcano-night.png', 'brown'],
    ['bg-aurora-cabin-snowfall', 'Aurora cabin', 'Snow falling on a lit cabin', 'aurora-cabin-snowfall.gif', 'aurora-cabin-snowfall.png', 'wind'],
    ['bg-balloon-valley-sunrise', 'Balloon valley', 'Balloons over the valley', 'balloon-valley-sunrise.gif', 'balloon-valley-sunrise.png', 'meadow'],
    ['bg-campfire-under-stars', 'Campfire', 'A fire under the stars', 'campfire-under-stars.gif', 'campfire-under-stars.png', 'crickets'],
    ['bg-cliff-lighthouse-night', 'Cliff lighthouse', 'A light on the headland', 'cliff-lighthouse-night.gif', 'cliff-lighthouse-night.png', 'ocean'],
    ['bg-cyberpunk-alley', 'Cyberpunk alley', 'Neon down a back alley', 'cyberpunk-alley.gif', 'cyberpunk-alley.png', 'rain'],
    ['bg-fuji-dawn-lake', 'Fuji dawn', 'Fuji across the water', 'fuji-dawn-lake.gif', 'fuji-dawn-lake.png', 'meadow'],
    ['bg-harbour-neon-skyline', 'Harbour neon', 'Neon across the harbour', 'harbour-neon-skyline.gif', 'harbour-neon-skyline.png', 'ocean'],
    ['bg-sea-torii-sunset', 'Sea torii', 'A torii standing in the sea', 'sea-torii-sunset.gif', 'sea-torii-sunset.png', 'ocean'],
    ['bg-stilt-village-sunset', 'Stilt village', 'Houses on stilts at sundown', 'stilt-village-sunset.gif', 'stilt-village-sunset.png', 'ocean'],
    ['bg-taj-mahal-sunset', 'Taj Mahal', 'The Taj at sundown', 'taj-mahal-sunset.gif', 'taj-mahal-sunset.png', 'meadow'],
];

export const GIF_SCENES = FILES.map(([id, name, blurb, file, poster, ambient]) => ({
    id, name, blurb, ambient, tone: 'dark',
    img: DIR + file,
    poster: DIR + 'thumbs/' + poster
}));
