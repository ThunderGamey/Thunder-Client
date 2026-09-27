"""Thunder PvP - a clean PvP look, made to sit on top of Thunder 1.21.11.
Part of Thunder Client, created and owned by Jayvardhan Ginni (ThunderGamey).

Every texture here is built by this script from the 1.21.11 ones (nothing is copied from other
packs):
  - plain armor: worn armor in one flat colour per piece with a darker edge on every face, and
    matching flat armor icons (diamond, iron, gold and netherite)
  - flat swords and tools: one tone per material with a dark outline and a light top edge (wood to
    netherite, and the spears)
  - animated: the totem glows light blue and flashes, three small pearls go round the ender pearl,
    a light band sweeps over the golden apple
  - calmer blocks: grass, dirt, stone, cobblestone, planks, sand, gravel, wool and more with
    less noise
  - small clean crit and sharpness particles
  - hotbar: separate dark slots with gaps, light grey selected slot, matching off-hand slot
  - end crystals: wireframe glass cages around a bright pink core
  - obsidian: dark and smooth, cobweb: bright white, glass: clear (frame only)
  - fire: low flames (world, burning mobs and the first-person overlay)
  - totem of undying: smaller in the hotbar, in the hand and when it pops
  - shield: a little lower and smaller in first person
  - no pumpkin blur, no vignette, smaller explosions and potion swirls, no sweep or
    damage-heart particles, shorter grass and ferns
"""
import colorsys
import io
import json
import math

from PIL import Image, ImageDraw


def build(lib, v12, m, base):
    pk = lib.Pack('Thunder PvP', 'Thunder PvP - plain gear, glowing totem, orbiting pearls')
    T = pk.tex

    def b121(path):
        """An image from the finished Thunder 1.21.11 pack (so both packs match)."""
        return Image.open(io.BytesIO(base.files[T(path)])).convert('RGBA')

    def meta121(path):
        return base.files.get(T(path) + '.mcmeta')

    # Hotbar -----------------------------------------------------------------------------------
    wd = b121('gui/widgets.png')
    lib.clear(wd, (0, 0, 182, 22))
    lib.clear(wd, (0, 22, 82, 46))
    d = ImageDraw.Draw(wd)
    slot_fill, slot_edge = (20, 21, 24, 205), (62, 64, 70, 240)
    for i in range(9):
        _box(d, 20 * i + 2, 2, 18, slot_fill, slot_edge)
    _box(d, 3, 25, 18, (190, 192, 196, 150), (236, 238, 240, 245))     # selection (24x22 at 0,22)
    _box(d, 24 + 2, 22 + 3, 18, slot_fill, slot_edge)                  # off-hand, left side
    _box(d, 53 + 9, 22 + 3, 18, slot_fill, slot_edge)                  # off-hand, right side
    pk.put_png(T('gui/widgets.png'), wd)

    # End crystal: wire cage + pink core (sheet is 128x64, twice the 64x32 model layout) ---------
    cr = b121('entity/endercrystal/endercrystal.png')
    s = cr.size[0] // 64
    cage = (178, 192, 204, 255)
    for (x0, y0, w, h) in _box_faces(0, 0, 8, 8, 8):
        x0, y0, w, h = x0 * s, y0 * s, w * s, h * s
        lib.clear(cr, (x0, y0, x0 + w, y0 + h))
        e = ImageDraw.Draw(cr)
        e.rectangle((x0, y0, x0 + w - 1, y0 + h - 1), outline=cage)
    px = cr.load()
    for y in range(0, 16 * s):
        for x in range(32 * s, 64 * s):
            r, g, b, a = px[x, y]
            if a:
                lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255
                rr, gg, bb = colorsys.hsv_to_rgb(0.86, 0.62 - 0.25 * lum, 0.62 + 0.38 * min(1, lum * 1.4))
                px[x, y] = (int(rr * 255), int(gg * 255), int(bb * 255), 255)
    pk.put_png(T('entity/endercrystal/endercrystal.png'), cr)

    # Obsidian, cobweb, glass --------------------------------------------------------------------
    ob = b121('blocks/obsidian.png')
    lums = [0.299 * p[0] + 0.587 * p[1] + 0.114 * p[2] for p in _pixels(ob)]
    lo, hi = min(lums), max(lums)
    op = ob.load()
    for y in range(ob.size[1]):
        for x in range(ob.size[0]):
            r, g, b, a = op[x, y]
            t = ((0.299 * r + 0.587 * g + 0.114 * b) - lo) / max(1, hi - lo)
            t = t * t * (3 - 2 * t)                      # smoothstep: calmer, rounder blobs
            op[x, y] = (int(9 + 52 * t), int(8 + 45 * t), int(16 + 78 * t), 255)
    pk.put_png(T('blocks/obsidian.png'), ob)
    web = b121('blocks/web.png')
    wp = web.load()
    for y in range(web.size[1]):
        for x in range(web.size[0]):
            if wp[x, y][3]:
                wp[x, y] = (244, 244, 244, 255)
    pk.put_png(T('blocks/web.png'), web)
    gl = b121('blocks/glass.png')
    lib.clear(gl, (1, 1, gl.size[0] - 1, gl.size[1] - 1))
    pk.put_png(T('blocks/glass.png'), gl)

    # Low fire -----------------------------------------------------------------------------------
    for n in ('fire_layer_0', 'fire_layer_1'):
        pk.put_png(T('blocks/%s.png' % n), _squash_frames(b121('blocks/%s.png' % n), 0.55))
        meta = meta121('blocks/%s.png' % n)
        if meta:   # an animated texture needs its .mcmeta in the same pack
            pk.put(T('blocks/%s.png.mcmeta' % n), meta)

    # Shorter grass and ferns (stay inside the bottom of the block)
    for n in ('tallgrass', 'fern'):
        pk.put_png(T('blocks/%s.png' % n), _squash_frames(b121('blocks/%s.png' % n), 0.6))

    # Totem and shield models --------------------------------------------------------------------
    pk.put_json(MODEL + 'totem.json', {
        'parent': 'item/generated',
        'textures': {'layer0': 'items/totem'},
        'display': {
            'gui': {'rotation': [0, 0, 0], 'translation': [0, 0, 0], 'scale': [0.72, 0.72, 0.72]},
            # vanilla hand positions at half the size; 1.12 mirrors the left hand itself, so both
            # hands get the same numbers (as vanilla item/generated does)
            'firstperson_righthand': {'rotation': [0, -90, 25], 'translation': [1.13, 3.2, 1.13],
                                      'scale': [0.26, 0.26, 0.26]},
            'firstperson_lefthand': {'rotation': [0, -90, 25], 'translation': [1.13, 3.2, 1.13],
                                     'scale': [0.26, 0.26, 0.26]},
            'thirdperson_righthand': {'rotation': [0, 0, 0], 'translation': [0, 3, 1], 'scale': [0.34, 0.34, 0.34]},
            'thirdperson_lefthand': {'rotation': [0, 0, 0], 'translation': [0, 3, 1], 'scale': [0.34, 0.34, 0.34]},
            'fixed': {'rotation': [0, 180, 0], 'translation': [0, 0, 0], 'scale': [0.5, 0.5, 0.5]},
        },
    })
    for n, dy in (('shield', -3), ('shield_blocking', -2)):
        mdl = json.loads(v12.raw('models/item/%s.json' % n))
        for hand in ('firstperson_righthand', 'firstperson_lefthand'):
            t = mdl['display'][hand]
            t['translation'][1] += dy
            t['scale'] = [1.05, 1.05, 1.05]
        pk.put_json(MODEL + '%s.json' % n, mdl)

    # Overlays and particles ---------------------------------------------------------------------
    pk.put_png(T('misc/vignette.png'), Image.new('RGBA', (16, 16), (0, 0, 0, 255)))   # black = no darkening
    pk.put_png(T('misc/pumpkinblur.png'), _clean_pumpkin())
    ex = b121('entity/explosion.png')
    small = Image.new('RGBA', ex.size, (0, 0, 0, 0))
    for i in range(16):
        f = ex.crop((i % 4 * 32, i // 4 * 32, i % 4 * 32 + 32, i // 4 * 32 + 32)).resize((20, 20), Image.NEAREST)
        small.paste(f, (i % 4 * 32 + 6, i // 4 * 32 + 6))
    pk.put_png(T('entity/explosion.png'), small)
    pk.put_png(T('entity/sweep.png'), Image.new('RGBA', (128, 32), (0, 0, 0, 0)))
    pa = b121('particle/particles.png')
    lib.clear(pa, (67 % 16 * 8, 67 // 16 * 8, 67 % 16 * 8 + 8, 67 // 16 * 8 + 8))   # damage hearts
    for idx in range(128, 152):         # potion swirls (effect and spell rows): half size, centred
        if idx % 16 < 8:
            x, y = idx % 16 * 8, idx // 16 * 8
            cell = pa.crop((x, y, x + 8, y + 8)).resize((4, 4), Image.NEAREST)
            lib.clear(pa, (x, y, x + 8, y + 8))
            pa.paste(cell, (x + 2, y + 2))
    for idx, shape in ((65, _CRIT), (66, _MAGIC_CRIT)):   # crit and sharpness hits: small and clean
        x, y = idx % 16 * 8, idx // 16 * 8
        lib.clear(pa, (x, y, x + 8, y + 8))
        for j, row in enumerate(shape):
            for i, ch in enumerate(row):
                if ch != '.':
                    pa.putpixel((x + i, y + j), (255, 255, 255, 255) if ch == '#' else (205, 205, 205, 255))
    pk.put_png(T('particle/particles.png'), pa)

    # Plain armor, flat swords and tools --------------------------------------------------------
    # (netherite and the spears are the newer items of Thunder 1.21.11, under items/thunder/)
    for mat, icons in (('diamond', 'items/'), ('iron', 'items/'), ('gold', 'items/'), ('netherite', 'items/thunder/')):
        for layer in (1, 2):
            n = 'models/armor/%s_layer_%d.png' % (mat, layer)
            pk.put_png(T(n), _flat_armor(b121(n)))
        for piece in ('helmet', 'chestplate', 'leggings', 'boots'):
            n = '%s%s_%s.png' % (icons, mat, piece)
            pk.put_png(T(n), _flat_item(b121(n), 2))
    for mat in ('wood', 'stone', 'iron', 'gold', 'diamond', 'netherite'):
        for tool in ('sword', 'axe', 'pickaxe', 'shovel', 'hoe'):
            n = ('items/thunder/%s_%s.png' if mat == 'netherite' else 'items/%s_%s.png') % (mat, tool)
            pk.put_png(T(n), _flat_item(b121(n), 3))
    for mat in ('wooden', 'stone', 'copper', 'iron', 'golden', 'diamond', 'netherite'):
        for n in ('items/thunder/%s_spear.png' % mat, 'items/thunder/%s_spear_in_hand.png' % mat):
            if T(n) in base.files:
                pk.put_png(T(n), _flat_item(b121(n), 3))
    pk.put_png(T('items/snowball.png'), _flat_item(b121('items/snowball.png'), 2))

    # Animated items: glowing totem, pearl with pearls going round it, shining golden apple -------
    for n, frames, meta in (('totem', *_totem_frames(b121('items/totem.png'))),
                            ('ender_pearl', *_pearl_frames(_flat_item(b121('items/ender_pearl.png'), 3))),
                            ('apple_golden', *_shine_frames(_flat_item(b121('items/apple_golden.png'), 3)))):
        pk.put_png(T('items/%s.png' % n), frames)
        pk.put(T('items/%s.png.mcmeta' % n), json.dumps({'animation': meta}, sort_keys=True).encode())

    # Calmer blocks: fewer tones, single stray pixels removed ----------------------------------------
    for n in _CLEAN_BLOCKS:
        if meta121('blocks/%s.png' % n) is None and T('blocks/%s.png' % n) in base.files:
            pk.put_png(T('blocks/%s.png' % n), _clean(b121('blocks/%s.png' % n), 4))

    pk.put_png('pack.png', _icon(m))
    return pk


_CRIT = ['........', '...#....', '...#....', '.##+##..', '...#....', '...#....', '........', '........']
_MAGIC_CRIT = ['........', '........', '..+.+...', '...#....', '..+.+...', '........', '........', '........']
_CLEAN_BLOCKS = (['dirt', 'grass_side', 'grass_top', 'stone', 'cobblestone', 'sand', 'gravel', 'end_stone', 'netherrack',
                  'sandstone_normal', 'sandstone_top', 'sandstone_bottom', 'snow', 'brick', 'stonebrick', 'clay',
                  'hardened_clay', 'log_oak', 'log_spruce', 'log_birch']
                 + ['planks_%s' % w for w in ('oak', 'spruce', 'birch', 'jungle', 'acacia', 'big_oak')]
                 + ['wool_colored_%s' % c for c in ('white', 'orange', 'magenta', 'light_blue', 'yellow', 'lime', 'pink', 'gray',
                                                    'silver', 'cyan', 'purple', 'blue', 'brown', 'green', 'red', 'black')])
_N4 = ((1, 0), (-1, 0), (0, 1), (0, -1))


def _lum(c):
    return 0.299 * c[0] + 0.587 * c[1] + 0.114 * c[2]


def _shade(c, f):
    """Darker (f < 1) or lighter (f > 1) version of a colour, same hue."""
    h, l, s = colorsys.rgb_to_hls(*(v / 255 for v in c[:3]))
    l = l * f if f < 1 else l + (1 - l) * (f - 1)
    return tuple(int(round(v * 255)) for v in colorsys.hls_to_rgb(h, max(0.0, min(1.0, l)), s))


def _palette(colors, k):
    """k representative colours (median cut + k-means) and each input colour's group."""
    s = Image.new('RGB', (len(colors), 1))
    s.putdata(colors)
    q = s.quantize(colors=k, method=Image.Quantize.MEDIANCUT, kmeans=6)
    return q.getpalette()[:3 * k], _pixels(q)


def _clean(im, k):
    """Fewer tones (k colours from the texture itself) and no single stray pixels."""
    w, h = im.size
    px = im.load()
    solid = [(x, y) for y in range(h) for x in range(w) if px[x, y][3] >= 128]
    if not solid:
        return im
    pal, grp = _palette([px[p][:3] for p in solid], k)
    idx = dict(zip(solid, grp))
    out = im.copy()
    op = out.load()
    for (x, y), g in idx.items():
        nb = [idx[(x + dx, y + dy)] for dx, dy in _N4 if (x + dx, y + dy) in idx]
        if len(nb) >= 3 and g not in nb:
            g = max(set(nb), key=nb.count)
        op[x, y] = (pal[3 * g], pal[3 * g + 1], pal[3 * g + 2], px[x, y][3])
    return out


def _flat_item(im, k, dark=0.42, light=1.28):
    """Plain item: one tone per material (k groups), dark outline, light rim on the top-left."""
    w, h = im.size
    px = im.load()

    def solid(x, y):
        return 0 <= x < w and 0 <= y < h and px[x, y][3] >= 128
    edge = {(x, y) for y in range(h) for x in range(w) if solid(x, y) and any(not solid(x + dx, y + dy) for dx, dy in _N4)}
    inner = [(x, y) for y in range(h) for x in range(w) if solid(x, y) and (x, y) not in edge]
    if not inner:
        return im
    _, grp = _palette([px[p][:3] for p in inner], k)
    gof = dict(zip(inner, grp))
    base = {}
    for g in set(grp):
        members = sorted((px[p][:3] for p in inner if gof[p] == g), key=_lum)
        base[g] = members[len(members) // 2]
    out = Image.new('RGBA', (w, h), (0, 0, 0, 0))
    op = out.load()
    for (x, y) in inner:
        c = base[gof[(x, y)]]
        if (x - 1, y) in edge or (x, y - 1) in edge:
            c = _shade(c, light)
        op[x, y] = c + (255,)
    for (x, y) in edge:
        nb = [gof[(x + dx, y + dy)] for dx, dy in _N4 + ((1, 1), (-1, -1), (1, -1), (-1, 1)) if (x + dx, y + dy) in gof]
        c = base[max(set(nb), key=nb.count)] if nb else px[x, y][:3]
        op[x, y] = _shade(c, dark) + (255,)
    return out


def _strip(frames):
    """Frames stacked top to bottom, the layout of an animated texture."""
    w, h = frames[0].size
    out = Image.new('RGBA', (w, h * len(frames)), (0, 0, 0, 0))
    for i, f in enumerate(frames):
        out.paste(f, (0, i * h))
    return out


def _mix(c, t, a):
    return tuple(int(round(c[i] + (t[i] - c[i]) * a)) for i in range(3))


_GLOW = (125, 225, 255)      # light blue


def _totem_frames(src):
    """Totem at twice the detail with a light-blue glow around it that pulses, and a short flash
    of light blue over the totem at the brightest moment (16 frames, 1.6 s)."""
    body = src.crop(src.getbbox())
    body = body.resize((body.width * 2, body.height * 2), Image.NEAREST)
    base = Image.new('RGBA', (32, 32), (0, 0, 0, 0))
    base.paste(body, ((32 - body.width) // 2, (32 - body.height) // 2))
    bp = base.load()
    solid = {(x, y) for y in range(32) for x in range(32) if bp[x, y][3] >= 128}

    def ring(inner):
        return {(x + dx, y + dy) for (x, y) in inner for dx in (-1, 0, 1) for dy in (-1, 0, 1)
                if 0 <= x + dx < 32 and 0 <= y + dy < 32} - inner
    r1 = ring(solid)
    r2 = ring(solid | r1)
    frames = []
    n = 16
    for i in range(n):
        pulse = 0.5 - 0.5 * math.cos(2 * math.pi * i / n)
        f = base.copy()
        fp = f.load()
        flash = pulse ** 4 * 0.45
        for (x, y) in solid:
            c = fp[x, y]
            fp[x, y] = _mix(c, _GLOW, flash) + (c[3],)
        for (x, y) in r1:
            fp[x, y] = _GLOW + (int(70 + 170 * pulse),)
        for (x, y) in r2:
            fp[x, y] = _GLOW + (int(20 + 90 * pulse),)
        frames.append(f)
    return _strip(frames), {'frametime': 2}


def _pearl_frames(src):
    """The pearl in the middle with three small copies of it going round it on a tilted ring
    (in front of it on the lower half, behind it on the upper half), and a short flash every
    second turn (24 frames, 2.4 s)."""
    body = src.crop(src.getbbox())
    big = body.resize((body.width * 3, body.height * 3), Image.NEAREST)
    small = body.resize((15, 15), Image.LANCZOS)
    sp = small.load()
    for y in range(15):                      # keep the small pearls crisp: no half-see-through edge
        for x in range(15):
            c = sp[x, y]
            sp[x, y] = c[:3] + ((255,) if c[3] >= 110 else (0,))
    behind = small.copy()
    bhp = behind.load()
    for y in range(15):
        for x in range(15):
            c = bhp[x, y]
            if c[3]:
                bhp[x, y] = _shade(c[:3], 0.62) + (255,)
    frames = []
    n = 24
    for i in range(n):
        f = Image.new('RGBA', (64, 64), (0, 0, 0, 0))
        spots = []
        for k in range(3):
            a = 2 * math.pi * (k / 3 + i / (n / 2) / 3)      # a third of a turn every 12 frames
            spots.append((math.sin(a), 32 + 24 * math.cos(a), 32 + 11 * math.sin(a)))
        for sn, x, y in spots:
            if sn < 0:
                f.alpha_composite(behind, (int(round(x)) - 7, int(round(y)) - 7))
        mid = big
        if i in (0, 1):
            mid = big.copy()
            mp = mid.load()
            for y in range(mid.height):
                for x in range(mid.width):
                    c = mp[x, y]
                    if c[3]:
                        mp[x, y] = _mix(c, (150, 255, 225), 0.3 if i == 0 else 0.15) + (c[3],)
        f.alpha_composite(mid, ((64 - mid.width) // 2, (64 - mid.height) // 2))
        for sn, x, y in spots:
            if sn >= 0:
                f.alpha_composite(small, (int(round(x)) - 7, int(round(y)) - 7))
        frames.append(f)
    return _strip(frames), {'frametime': 2}


def _shine_frames(src):
    """A light band that sweeps over the item, then a pause (20 frames, 2 s)."""
    w, h = src.size
    frames = []
    for i in range(20):
        f = src.copy()
        if i < 10:
            pos = -3 + i * (w + h + 6) / 9.0
            fp = f.load()
            for y in range(h):
                for x in range(w):
                    c = fp[x, y]
                    d = abs(x + y - pos)
                    if c[3] >= 128 and d < 2.5:
                        fp[x, y] = _mix(c, (255, 255, 235), 0.6 if d < 1 else 0.3) + (c[3],)
        frames.append(f)
    return _strip(frames), {'frametime': 2}


# armor model boxes (u, v, w, h, d) on the 64x32 sheet: head, head overlay, body, arm, leg
_ARMOR_BOXES = [(0, 0, 8, 8, 8), (32, 0, 8, 8, 8), (16, 16, 8, 12, 4), (40, 16, 4, 12, 4), (0, 16, 4, 12, 4)]


def _flat_armor(im, dark=0.55):
    """Plain worn armor: every painted face in the armor's main colour with a darker 1-texel edge."""
    w, h = im.size
    s = max(1, w // 64)
    px = im.load()
    cols = sorted((px[x, y][:3] for y in range(h) for x in range(w) if px[x, y][3] >= 128), key=_lum)
    if not cols:
        return im
    base = cols[len(cols) * 6 // 10]
    out = im.copy()
    op = out.load()
    for (u, v, bw, bh, bd) in _ARMOR_BOXES:
        for (fx, fy, fw, fh) in _box_faces(u, v, bw, bh, bd):
            x0, y0, x1, y1 = fx * s, fy * s, (fx + fw) * s, (fy + fh) * s

            def solid(a, b):
                return x0 <= a < x1 and y0 <= b < y1 and px[a, b][3] >= 128
            for y in range(y0, y1):
                for x in range(x0, x1):
                    if px[x, y][3] >= 128:
                        rim = any(not solid(x + dx * s, y + dy * s) for dx, dy in _N4)
                        op[x, y] = (_shade(base, dark) if rim else base) + (255,)
    return out


MODEL = 'assets/minecraft/models/item/'


def _pixels(img):
    return list(img.getdata()) if not hasattr(img, 'get_flattened_data') else list(img.get_flattened_data())


def _box(d, x, y, size, fill, edge):
    """Rounded slot box, size x size, 1px edge."""
    x1, y1 = x + size - 1, y + size - 1
    d.rectangle((x, y, x1, y1), fill=fill, outline=edge)
    for cx, cy in ((x, y), (x1, y), (x, y1), (x1, y1)):
        d.point((cx, cy), fill=(0, 0, 0, 0))


def _box_faces(u, v, w, h, dd):
    """Texture rectangles (x, y, w, h) of the six faces of a model box."""
    return [(u + dd, v, w, dd), (u + dd + w, v, w, dd),
            (u, v + dd, dd, h), (u + dd, v + dd, w, h), (u + dd + w, v + dd, dd, h), (u + dd + w + dd, v + dd, w, h)]


def _squash_frames(img, k):
    """Scale every square animation frame to k of its height, standing on the bottom edge."""
    w = img.size[0]
    out = Image.new('RGBA', img.size, (0, 0, 0, 0))
    nh = max(1, round(w * k))
    for f in range(img.size[1] // w):
        fr = img.crop((0, f * w, w, f * w + w)).resize((w, nh), Image.BOX)
        a = fr.getchannel('A').point(lambda v: 255 if v >= 110 else 0)
        fr.putalpha(a)
        out.paste(fr, (0, f * w + w - nh))
    return out


def _clean_pumpkin():
    """Almost clear pumpkin view: only a thin warm edge so you still know it is on."""
    n = 256
    out = Image.new('RGBA', (n, n), (0, 0, 0, 0))
    p = out.load()
    for y in range(n):
        for x in range(n):
            e = min(x, y, n - 1 - x, n - 1 - y) / (n * 0.06)
            if e < 1:
                p[x, y] = (70, 34, 6, int(170 * (1 - e) ** 2))
    return out


def _icon(m):
    """Pack icon: diamond sword and a small totem on a Thunder-blue tile."""
    n = 128
    out = Image.new('RGBA', (n, n), (0, 0, 0, 0))
    d = ImageDraw.Draw(out)
    for y in range(n):
        t = y / (n - 1)
        d.line((0, y, n - 1, y), fill=(int(14 - 8 * t), int(26 - 14 * t), int(42 - 24 * t), 255))
    d.rectangle((0, 0, n - 1, n - 1), outline=(64, 184, 240, 255), width=3)
    sword = m.img('textures/item/diamond_sword.png').resize((96, 96), Image.NEAREST)
    out.alpha_composite(sword, (8, 8))
    totem = m.img('textures/item/totem_of_undying.png').resize((48, 48), Image.NEAREST)
    out.alpha_composite(totem, (74, 74))
    return out
