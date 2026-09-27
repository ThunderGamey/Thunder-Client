"""Thunder PvP - a clean PvP look, made to sit on top of Thunder 1.21.11.

Every texture here is built by this script from the 1.21.11 ones (nothing is copied from other
packs):
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

from PIL import Image, ImageDraw


def build(lib, v12, m, base):
    pk = lib.Pack('Thunder PvP', 'Thunder PvP - small totem, low fire, wire crystals')
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
    pk.put_png(T('particle/particles.png'), pa)

    pk.put_png('pack.png', _icon(m))
    return pk


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
