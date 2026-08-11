#!/usr/bin/env python3
"""Recompute the size-adjust fallback numbers at the foot of src/fonts.css.

Browsers match a fallback to a webfont on average character width, so
size-adjust is the ratio of the two xAvgCharWidths; the ascent and descent
overrides are then the webfont's own metrics divided back through that scale
so the line box matches as well as the glyph width. Needs `fonttools`.
"""
import glob, os
from fontTools.ttLib import TTFont

# Published metrics for the two local fallbacks the stacks name.
ARIAL = {"xavg": 0.5285}
COURIER = {"xavg": 0.6000}

for path in sorted(glob.glob("public/fonts/*.woff2")):
    f = TTFont(path)
    upm = f["head"].unitsPerEm
    xavg = f["OS/2"].xAvgCharWidth / upm
    asc, desc = f["hhea"].ascent / upm, abs(f["hhea"].descent) / upm
    ref = COURIER if os.path.basename(path).startswith("plexmono") else ARIAL
    adj = xavg / ref["xavg"]
    print(f"{os.path.basename(path):24} size-adjust: {adj*100:6.2f}%  "
          f"ascent-override: {asc/adj*100:6.2f}%  descent-override: {desc/adj*100:6.2f}%")
