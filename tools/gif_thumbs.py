#!/usr/bin/env python3
"""Make the picker stills for the GIF backgrounds.

    python3 tools/gif_thumbs.py web/ASCII web/ASCII/thumbs

One small PNG per GIF, from its first frame. The picker shows these instead of the GIFs,
so 26 animations do not run at once, and they stand in for the animation under reduced motion.
Needs Pillow:  pip install pillow
"""
import sys, os
from PIL import Image

WIDTH = 400          # the cards are ~190 px wide, so this covers 2x screens

def main(src, dst):
    os.makedirs(dst, exist_ok=True)
    total = 0
    for name in sorted(os.listdir(src)):
        if not name.lower().endswith('.gif'):
            continue
        stem = os.path.splitext(name)[0].replace(' ', '-').replace('(', '').replace(')', '')
        out = os.path.join(dst, stem + '.png')
        with Image.open(os.path.join(src, name)) as im:
            im.seek(0)
            rgb = im.convert('RGB')
            rgb = rgb.resize((WIDTH, round(im.height * WIDTH / im.width)), Image.BOX)
            rgb.quantize(colors=96, method=Image.MEDIANCUT).save(out, optimize=True)
        total += os.path.getsize(out)
        print(f'{out}  {os.path.getsize(out) / 1024:.1f} KB')
    print(f'{total / 1024:.0f} KB total')

if __name__ == '__main__':
    main(sys.argv[1], sys.argv[2])
