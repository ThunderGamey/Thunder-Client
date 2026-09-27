#!/usr/bin/env python3
"""Build Thunder's two built-in resource packs for Eaglercraft 1.12.2 (pack_format 3).

    python3 thunder/packs/build_packs.py [--cache DIR] [--out DIR] [--check]

Writes packs/Thunder-1.21.11.zip, packs/Thunder-PvP.zip and packs/packs.json (their names and
content hashes; Thunder adds both packs to the game's pack list and updates them when the hash
changes, see thunder/thunder-packs.js).

Thunder 1.21.11 - the textures of Minecraft Java 1.21.11 under the 1.12 names and in the 1.12
layouts: blocks, items, mobs whose 1.12 model still matches, armor, chests (re-mapped to the 1.12
chest model), GUI sheets rebuilt from the 1.21 sprites, particles, sky, map, paintings,
colormaps and overlays. Whatever 1.21.11 has no counterpart for, or draws with a different
model (cows, pigs, horses, villagers, bats, ...), keeps the game's own 1.12 texture.

Thunder PvP - a clean PvP look made to sit on top of Thunder 1.21.11 (see pvp.py).

Inputs: the game's own assets.epk (read only; it gives the 1.12 layouts) and the 1.21.11 textures,
downloaded once from github.com/InventivetalentDev/minecraft-assets (branch 1.21.11) into the
cache folder. Needs Python 3.8+ and Pillow.
"""
import argparse
import hashlib
import io
import json
import os
import struct
import sys
import time
import urllib.request
import zipfile
import zlib

from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(os.path.dirname(HERE))
sys.path.insert(0, HERE)
import names  # noqa: E402
import pvp  # noqa: E402

SRC = 'https://raw.githubusercontent.com/InventivetalentDev/minecraft-assets/1.21.11/assets/minecraft/'
MC = 'assets/minecraft/'
WATER_TINT = (0x3F, 0x76, 0xE4)  # default water colour since 1.13; 1.21 water textures are grey
LOG = []


def log(msg):
    LOG.append(msg)


# ---------------------------------------------------------------------------------------------
# Inputs

def read_epk(path):
    """Files of an Eaglercraft EPK v2 package (gzip body)."""
    d = open(path, 'rb').read()
    if d[:8] != b'EAGPKG$$':
        raise SystemExit(path + ' is not an EPK')
    p = 8
    for _ in range(2):
        n = d[p]; p += 1 + n
    n = struct.unpack('>H', d[p:p + 2])[0]; p += 2 + n
    p += 8 + 4
    if chr(d[p]) != 'G':
        raise SystemExit('only gzip EPKs are supported')
    body = zlib.decompressobj(16 + zlib.MAX_WBITS).decompress(d[p + 1:])
    files, q = {}, 0
    while True:
        t = body[q:q + 4]; q += 4
        if t == b'END$':
            return files
        n = body[q]; q += 1
        name = body[q:q + n].decode(); q += n
        ln = struct.unpack('>I', body[q:q + 4])[0]; q += 4
        if t == b'HEAD':
            q += ln + 1
        elif t == b'FILE':
            files[name] = body[q + 4:q + ln - 1]
            q += ln + 1
        else:
            raise SystemExit('bad EPK entry %r' % t)


class Vanilla12:
    def __init__(self, epk):
        self.files = {k[len(MC):]: v for k, v in read_epk(epk).items() if k.startswith(MC)}

    def has(self, p):
        return p in self.files

    def raw(self, p):
        return self.files[p]

    def img(self, p):
        return Image.open(io.BytesIO(self.files[p])).convert('RGBA')

    def names(self, folder, ext='.png'):
        pre = folder.rstrip('/') + '/'
        return sorted(k[len(pre):-len(ext)] for k in self.files
                      if k.startswith(pre) and k.endswith(ext) and '/' not in k[len(pre):])


class Mc121:
    """1.21.11 textures, fetched from the minecraft-assets mirror into a local cache."""

    def __init__(self, cache):
        self.cache = cache
        os.makedirs(cache, exist_ok=True)
        lp = os.path.join(cache, 'list.json')
        if os.path.exists(lp):
            self.list = set(json.load(open(lp)))
        else:
            self.list = set(self._walk('textures'))
            json.dump(sorted(self.list), open(lp, 'w'))

    def _get(self, url):
        for t in range(5):
            try:
                with urllib.request.urlopen(url, timeout=60) as r:
                    return r.read()
            except Exception as e:  # network hiccup: back off and retry
                if t == 4:
                    raise SystemExit('download failed: %s (%s)' % (url, e))
                time.sleep(2 ** t)

    def _walk(self, d):
        j = json.loads(self._get(SRC + d + '/_list.json'))
        out = [d + '/' + f for f in j.get('files', [])]
        for sub in j.get('directories', []):
            out += self._walk(d + '/' + sub)
        return out

    def has(self, p):
        return p in self.list

    def raw(self, p):
        if p not in self.list:
            raise KeyError(p)
        f = os.path.join(self.cache, p)
        if not os.path.exists(f):
            os.makedirs(os.path.dirname(f), exist_ok=True)
            data = self._get(SRC + p)
            open(f, 'wb').write(data)
        return open(f, 'rb').read()

    def img(self, p):
        return Image.open(io.BytesIO(self.raw(p))).convert('RGBA')

    def sprite(self, p):
        return self.img('textures/gui/sprites/' + p + '.png')


# ---------------------------------------------------------------------------------------------
# Output

def png_bytes(img):
    b = io.BytesIO()
    img.save(b, 'PNG', optimize=True)
    return b.getvalue()


class Pack:
    def __init__(self, name, description):
        self.name = name
        self.files = {}
        self.put_json('pack.mcmeta', {'pack': {'pack_format': 3, 'description': description}})

    def put(self, path, data):
        self.files[path] = data

    def put_png(self, path, img):
        self.files[path] = png_bytes(img)

    def put_json(self, path, obj):
        self.files[path] = (json.dumps(obj, indent=2) + '\n').encode()

    def tex(self, path):
        return MC + 'textures/' + path

    def write(self, out):
        """Deterministic zip, every entry stored (PNGs are compressed already), so the browser
        installer can unpack it without an inflater."""
        os.makedirs(os.path.dirname(out), exist_ok=True)
        tmp = out + '.tmp'
        with zipfile.ZipFile(tmp, 'w', zipfile.ZIP_STORED) as z:
            for path in sorted(self.files):
                zi = zipfile.ZipInfo(path, date_time=(2026, 1, 1, 0, 0, 0))
                zi.compress_type = zipfile.ZIP_STORED
                zi.external_attr = 0o644 << 16
                z.writestr(zi, self.files[path])
        os.replace(tmp, out)
        return os.path.getsize(out)


# ---------------------------------------------------------------------------------------------
# Image helpers

def tint(img, rgb):
    r, g, b, a = img.split()
    r = r.point(lambda v: v * rgb[0] // 255)
    g = g.point(lambda v: v * rgb[1] // 255)
    b = b.point(lambda v: v * rgb[2] // 255)
    return Image.merge('RGBA', (r, g, b, a))


def clear(img, box):
    img.paste((0, 0, 0, 0), box)


def put(atlas, sprite, x, y, w=None, h=None, check=None):
    """Replace the atlas region at (x, y) (w x h, default the sprite size) with the sprite,
    clearing whatever was there. With check, log how far the old region was from the sprite."""
    w = w or sprite.size[0]
    h = h or sprite.size[1]
    sp = sprite.crop((0, 0, min(w, sprite.size[0]), min(h, sprite.size[1])))
    if check:
        old = atlas.crop((x, y, x + sp.size[0], y + sp.size[1]))
        log('%-6.1f %s @%d,%d' % (diff(old, sp), check, x, y))
    clear(atlas, (x, y, x + w, y + h))
    atlas.paste(sp, (x, y))


def diff(a, b):
    """Mean absolute difference of two same-size RGBA images, colour weighted by alpha (0..255)."""
    pa, pb = a.load(), b.load()
    tot, n = 0, a.size[0] * a.size[1]
    for yy in range(a.size[1]):
        for xx in range(a.size[0]):
            r1, g1, b1, a1 = pa[xx, yy]
            r2, g2, b2, a2 = pb[xx, yy]
            tot += (abs(r1 * a1 - r2 * a2) + abs(g1 * a1 - g2 * a2) + abs(b1 * a1 - b2 * a2)) / 765 + abs(a1 - a2)
    return tot / (2 * n) if n else 0


def nine_slice(src, w, h, border):
    """1.20.2+ nine-slice scaling (edges and centre tiled), for sprites stored with gui scaling."""
    sw, sh = src.size
    out = Image.new('RGBA', (w, h), (0, 0, 0, 0))

    def tile(part, tw, th, x0, y0):
        if tw <= 0 or th <= 0 or part.size[0] <= 0 or part.size[1] <= 0:
            return
        for yy in range(0, th, part.size[1]):
            for xx in range(0, tw, part.size[0]):
                c = part.crop((0, 0, min(part.size[0], tw - xx), min(part.size[1], th - yy)))
                out.paste(c, (x0 + xx, y0 + yy))
    b = border
    cols = [(0, b, 0, b), (b, sw - b, b, w - b), (sw - b, sw, w - b, w)]
    rows = [(0, b, 0, b), (b, sh - b, b, h - b), (sh - b, sh, h - b, h)]
    for sx0, sx1, dx0, dx1 in cols:
        for sy0, sy1, dy0, dy1 in rows:
            tile(src.crop((sx0, sy0, sx1, sy1)), dx1 - dx0, dy1 - dy0, dx0, dy0)
    return out


def alpha_mask(img):
    """1.12 banner/shield patterns are masks read from the red channel on opaque black."""
    a = img.getchannel('A')
    return Image.merge('RGBA', (a, a, a, Image.new('L', img.size, 255)))


def fill_holes(new, old):
    """Where the 1.21 texture is empty but the 1.12 one is not, keep the 1.12 pixels (regions the
    1.12 model still draws that 1.21 no longer uses)."""
    if old.size != new.size:
        old = old.resize(new.size, Image.NEAREST)
    out = new.copy()
    po, pn, pd = old.load(), new.load(), out.load()
    for y in range(new.size[1]):
        for x in range(new.size[0]):
            if pn[x, y][3] == 0 and po[x, y][3] > 0:
                pd[x, y] = po[x, y]
    return out


def same_layout(old, new):
    """True when a 1.21 texture has the 1.12 layout: same shape (or an exact 2x HD copy) and
    mostly the same painted area."""
    w, h = old.size
    if new.size != old.size:
        if new.size != (w * 2, h * 2):
            return False
        new = new.resize(old.size, Image.NEAREST)
    ma = old.getchannel('A').point(lambda v: 255 if v else 0)
    mb = new.getchannel('A').point(lambda v: 255 if v else 0)
    a = ma.histogram()[255]
    b = mb.histogram()[255]
    both = Image.composite(mb, Image.new('L', old.size, 0), ma).histogram()[255]
    union = a + b - both
    return union == 0 or both / union >= 0.8


# ---------------------------------------------------------------------------------------------
# Chests: 1.15 changed how chest models are drawn (1.12 flips the model upside down and back to
# front), so the same texture sheet maps to different faces. Re-map every texel through world space.

def _faces(u, v, w, h, d, mn):
    x, y, z = mn
    X, Y, Z = x + w, y + h, z + d
    p0, p1, p2, p3 = (X, y, z), (X, Y, z), (x, Y, z), (x, y, Z)
    p4, p5, p6, p7 = (X, y, Z), (X, Y, Z), (x, Y, Z), (x, y, z)
    # (u1, v1, u2, v2, vertices); vertex 0 -> (u2, v1), 1 -> (u1, v1), 2 -> (u1, v2), 3 -> (u2, v2)
    return [
        (u + d + w, v + d, u + d + w + d, v + d + h, (p4, p0, p1, p5)),   # +x
        (u, v + d, u + d, v + d + h, (p7, p3, p6, p2)),                   # -x
        (u + d, v, u + d + w, v + d, (p4, p3, p7, p0)),                   # -y
        (u + d + w, v + d, u + d + w + w, v, (p1, p2, p6, p5)),           # +y
        (u + d, v + d, u + d + w, v + d + h, (p0, p7, p2, p1)),           # -z
        (u + d + w + d, v + d, u + d + w + d + w, v + d + h, (p3, p4, p5, p6)),  # +z
    ]


def _sub(a, b):
    return (a[0] - b[0], a[1] - b[1], a[2] - b[2])


def _dot(a, b):
    return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]


def remap_boxes(size, boxes12, sources):
    """boxes12: [(part, u, v, w, h, d, min, to_world)] of the 1.12 model; sources: [(image, boxes21)]
    with the 1.21 boxes in the same form. Every 1.12 texel is taken from the texel of the same part
    (lid, lock, bottom) that sits at the same place in the world. Returns the 1.12 sheet."""
    out = Image.new('RGBA', size, (0, 0, 0, 0))
    po = out.load()
    targets = {}
    for img, boxes in sources:
        pix = img.load()
        for (part, u, v, w, h, d, mn, tw) in boxes:
            for f in _faces(u, v, w, h, d, mn):
                targets.setdefault(part, []).append((pix, f, [tw(p) for p in f[4]]))
    for (part, u, v, w, h, d, mn, tw) in boxes12:
        for (u1, v1, u2, v2, verts) in _faces(u, v, w, h, d, mn):
            V0, V1, V2 = verts[0], verts[1], verts[2]
            for ty in range(int(min(v1, v2)), int(max(v1, v2))):
                for tx in range(int(min(u1, u2)), int(max(u1, u2))):
                    a = (tx + 0.5 - u1) / (u2 - u1)
                    b = (ty + 0.5 - v1) / (v2 - v1)
                    p = tuple(V1[i] + a * (V0[i] - V1[i]) + b * (V2[i] - V1[i]) for i in range(3))
                    px = _find(targets[part], tw(p))
                    if px is not None:
                        po[tx, ty] = px
    return out


def _find(faces, wp):
    """Colour of the texel at world point wp on one of the given faces (None when off all of them)."""
    for pix, (u1, v1, u2, v2, _), vw in faces:
        ea, eb = _sub(vw[0], vw[1]), _sub(vw[2], vw[1])
        n = (ea[1] * eb[2] - ea[2] * eb[1], ea[2] * eb[0] - ea[0] * eb[2], ea[0] * eb[1] - ea[1] * eb[0])
        rel = _sub(wp, vw[1])
        if abs(_dot(rel, n)) > 1e-6:
            continue
        a = _dot(rel, ea) / _dot(ea, ea)
        b = _dot(rel, eb) / _dot(eb, eb)
        if -1e-6 <= a <= 1 + 1e-6 and -1e-6 <= b <= 1 + 1e-6:
            # texel centres map to texel centres, so int() of the coordinate is the texel
            x = min(max(int(u1 + a * (u2 - u1)), int(min(u1, u2))), int(max(u1, u2)) - 1)
            y = min(max(int(v1 + b * (v2 - v1)), int(min(v1, v2))), int(max(v1, v2)) - 1)
            return pix[x, y]
    return None


def w12(p):   # 1.12 TileEntityChestRenderer: scale(1, -1, -1) after moving up one block
    return (p[0], 16 - p[1], 16 - p[2])


def w21(p):
    return p


def w21_east(p):
    return (p[0] + 16, p[1], p[2])


CHEST12 = [('lid', 0, 0, 14, 5, 14, (1, 2, 1), w12), ('lock', 0, 0, 2, 4, 1, (7, 5, 0), w12),
           ('bottom', 0, 19, 14, 10, 14, (1, 6, 1), w12)]
CHEST21 = [('lid', 0, 0, 14, 5, 14, (1, 9, 1), w21), ('lock', 0, 0, 2, 4, 1, (7, 7, 15), w21),
           ('bottom', 0, 19, 14, 10, 14, (1, 0, 1), w21)]
LARGE12 = [('lid', 0, 0, 30, 5, 14, (1, 2, 1), w12), ('lock', 0, 0, 2, 4, 1, (15, 5, 0), w12),
           ('bottom', 0, 19, 30, 10, 14, (1, 6, 1), w12)]
# double chests in 1.21 are two halves: the west block uses *_right, the east block *_left
RIGHT21 = [('lid', 0, 0, 15, 5, 14, (1, 9, 1), w21), ('lock', 0, 0, 1, 4, 1, (15, 7, 15), w21),
           ('bottom', 0, 19, 15, 10, 14, (1, 0, 1), w21)]
LEFT21 = [('lid', 0, 0, 15, 5, 14, (0, 9, 1), w21_east), ('lock', 0, 0, 1, 4, 1, (0, 7, 15), w21_east),
          ('bottom', 0, 19, 15, 10, 14, (0, 0, 1), w21_east)]


# ---------------------------------------------------------------------------------------------
# Thunder 1.21.11

ENTITY_SAME = [
    'armorstand/wood', 'banner_base', 'beacon_beam', 'bear/polarbear', 'blaze', 'cat/black', 'cat/ocelot',
    'cat/red', 'cat/siamese', 'creeper/creeper', 'creeper/creeper_armor', 'enchanting_table_book',
    'end_gateway_beam', 'end_portal', 'enderdragon/dragon_eyes', 'enderdragon/dragon_fireball',
    'enderman/enderman', 'enderman/enderman_eyes', 'endermite', 'experience_orb', 'ghast/ghast',
    'ghast/ghast_shooting', 'guardian_beam', 'guardian_elder', 'illager/evoker', 'illager/vindicator',
    'lead_knot', 'llama/spit', 'parrot/parrot_blue', 'parrot/parrot_green', 'parrot/parrot_grey',
    'parrot/parrot_red_blue', 'parrot/parrot_yellow_blue', 'rabbit/black', 'rabbit/brown', 'rabbit/caerbannog',
    'rabbit/gold', 'rabbit/salt', 'rabbit/toast', 'rabbit/white', 'rabbit/white_splotched', 'sheep/sheep',
    'shield_base', 'shield_base_nopattern', 'shulker/spark', 'silverfish', 'skeleton/skeleton', 'skeleton/stray',
    'skeleton/stray_overlay', 'skeleton/wither_skeleton', 'slime/slime', 'spider/cave_spider', 'spider/spider',
    'spider_eyes', 'witch', 'wither/wither_armor', 'wolf/wolf', 'wolf/wolf_angry', 'wolf/wolf_tame',
    'zombie/husk', 'zombie/zombie',
]
ENTITY_RENAMED = {
    'alex': 'player/slim/alex', 'steve': 'player/wide/steve', 'chicken': 'chicken/temperate_chicken',
    'elytra': 'equipment/wings/elytra', 'endercrystal/endercrystal': 'end_crystal/end_crystal',
    'endercrystal/endercrystal_beam': 'end_crystal/end_crystal_beam', 'illager/fangs': 'illager/evoker_fangs',
    'illager/illusionist': 'illager/illusioner', 'iron_golem': 'iron_golem/iron_golem', 'sign': 'signs/oak',
    'snowman': 'snow_golem', 'squid': 'squid/squid', 'sheep/sheep_fur': 'sheep/sheep_wool',
    'llama/llama_brown': 'llama/brown', 'llama/llama_creamy': 'llama/creamy', 'llama/llama_gray': 'llama/gray',
    'llama/llama_white': 'llama/white',
}
# 1.21 trimmed faces the model never shows; the drawn parts line up with 1.12
ENTITY_TRIMMED = ['guardian', 'wither/wither', 'wither/wither_invulnerable', 'wolf/wolf_collar']
ENTITY_FILL = {'enderdragon/dragon': 'enderdragon/dragon', 'enderdragon/dragon_exploding': 'enderdragon/dragon_exploding',
               'minecart': 'minecart'}
BOATS = {'oak': 'oak', 'spruce': 'spruce', 'birch': 'birch', 'jungle': 'jungle', 'acacia': 'acacia',
         'darkoak': 'dark_oak'}
ARMOR = {'leather': 'leather', 'chainmail': 'chainmail', 'iron': 'iron', 'gold': 'gold', 'diamond': 'diamond'}

MOON = ['full_moon', 'waning_gibbous', 'third_quarter', 'waning_crescent', 'new_moon', 'waxing_crescent',
        'first_quarter', 'waxing_gibbous']
MAP_ICONS = ['player', 'frame', 'red_marker', 'blue_marker', 'target_x', 'target_point', 'player_off_map',
             'player_off_limits', 'woodland_mansion', 'ocean_monument']
PAINTINGS = [('kebab', 0, 0), ('aztec', 16, 0), ('alban', 32, 0), ('aztec2', 48, 0), ('bomb', 64, 0),
             ('plant', 80, 0), ('wasteland', 96, 0), ('pool', 0, 32), ('courbet', 32, 32), ('sea', 64, 32),
             ('sunset', 96, 32), ('creebet', 128, 32), ('wanderer', 0, 64), ('graham', 16, 64), ('match', 0, 128),
             ('bust', 32, 128), ('stage', 64, 128), ('void', 96, 128), ('skull_and_roses', 128, 128),
             ('wither', 160, 128), ('fighters', 0, 96), ('pointer', 0, 192), ('pigscene', 64, 192),
             ('burning_skull', 128, 192), ('skeleton', 192, 64), ('donkey_kong', 192, 112), ('back', 192, 0)]
# Potion.setIconIndex in 1.12 (index = x + 8 * y), icons at (18 * (i % 8), 198 + 18 * (i // 8)) of inventory.png
EFFECT_ICONS = {'speed': 0, 'slowness': 1, 'haste': 2, 'mining_fatigue': 3, 'strength': 4, 'weakness': 5,
                'poison': 6, 'regeneration': 7, 'invisibility': 8, 'hunger': 9, 'jump_boost': 10, 'nausea': 11,
                'night_vision': 12, 'blindness': 13, 'resistance': 14, 'fire_resistance': 15,
                'water_breathing': 16, 'wither': 17, 'absorption': 18, 'levitation': 19, 'glowing': 20,
                'luck': 21, 'unluck': 22, 'health_boost': 23}
# particles.png cell index -> 1.21 particle sprite
PARTICLES = {}
for _i in range(8):
    PARTICLES[_i] = 'generic_%d' % _i
    PARTICLES[128 + _i] = 'effect_%d' % _i
    PARTICLES[144 + _i] = 'spell_%d' % _i
    PARTICLES[160 + _i] = 'spark_%d' % _i
    PARTICLES[176 + _i] = 'glitter_%d' % _i
for _i in range(4):
    PARTICLES[19 + _i] = 'splash_%d' % _i
for _i in range(26):
    PARTICLES[225 + _i] = 'sga_' + chr(97 + _i)
PARTICLES.update({32: 'bubble', 48: 'flame', 49: 'lava', 64: 'note', 65: 'critical_hit', 66: 'enchanted_hit',
                  67: 'damage', 80: 'heart', 81: 'angry', 82: 'glint', 112: 'drip_fall', 113: 'drip_hang',
                  114: 'drip_land'})


def build_121(v12, m):
    pk = Pack('Thunder 1.21.11', 'Minecraft 1.21.11 textures for Thunder Client')
    T = pk.tex

    def copy(dst, src, fn=None):
        if fn is None:
            pk.put(T(dst), m.raw('textures/' + src))
        else:
            pk.put_png(T(dst), fn(m.img('textures/' + src)))
        if m.has('textures/' + src + '.mcmeta'):
            pk.put(T(dst) + '.mcmeta', m.raw('textures/' + src + '.mcmeta'))

    # Blocks and items
    for n in v12.names('textures/blocks'):
        src = 'block/' + names.block_name(n) + '.png'
        if not m.has('textures/' + src):
            log('keep 1.12 block ' + n)
            continue
        fn = (lambda im: tint(im, WATER_TINT)) if n.startswith('water_') else None
        copy('blocks/' + n + '.png', src, fn)
    for n in v12.names('textures/items'):
        src = 'item/' + names.item_name(n) + '.png'
        if n.startswith('empty_armor_slot_'):
            src = 'gui/sprites/container/slot/' + n[len('empty_armor_slot_'):] + '.png'
        if not m.has('textures/' + src):
            log('keep 1.12 item ' + n)
            continue
        copy('items/' + n + '.png', src)

    # Entities
    def entity(n12, n21, fn=None, check=True):
        old = v12.img('textures/entity/' + n12 + '.png')
        new = m.img('textures/entity/' + n21 + '.png')
        if check and not same_layout(old, new):
            log('keep 1.12 entity %s (1.21 layout differs)' % n12)
            return
        if fn:
            pk.put_png(T('entity/' + n12 + '.png'), fn(new, old))
        else:
            pk.put(T('entity/' + n12 + '.png'), m.raw('textures/entity/' + n21 + '.png'))

    for n in ENTITY_SAME:
        entity(n, n)
    for a, b in ENTITY_RENAMED.items():
        entity(a, b)
    for n in ENTITY_TRIMMED:
        entity(n, n, check=False)
    for a, b in ENTITY_FILL.items():
        entity(a, b, fill_holes)
    for c in names.COLORS:
        entity('bed/' + c, 'bed/' + names.color(c))
        entity('shulker/shulker_' + c, 'shulker/shulker_' + names.color(c))
        entity('llama/decor/decor_' + c, 'equipment/llama_body/' + names.color(c))
    for a, b in BOATS.items():
        entity('boat/boat_' + a, 'boat/' + b)
    for kind in ('banner', 'shield'):
        for n in v12.names('textures/entity/' + kind):
            if m.has('textures/entity/%s/%s.png' % (kind, n)):
                entity(kind + '/' + n, kind + '/' + n, lambda new, old: alpha_mask(new), check=False)
    for a, b in ARMOR.items():
        pk.put(T('models/armor/%s_layer_1.png' % a), m.raw('textures/entity/equipment/humanoid/%s.png' % b))
        pk.put(T('models/armor/%s_layer_2.png' % a), m.raw('textures/entity/equipment/humanoid_leggings/%s.png' % b))
    pk.put(T('models/armor/leather_layer_1_overlay.png'), m.raw('textures/entity/equipment/humanoid/leather_overlay.png'))
    pk.put(T('models/armor/leather_layer_2_overlay.png'),
           m.raw('textures/entity/equipment/humanoid_leggings/leather_overlay.png'))
    for kind in ('normal', 'trapped', 'christmas'):
        single = m.img('textures/entity/chest/%s.png' % kind)
        pk.put_png(T('entity/chest/%s.png' % kind), remap_boxes((64, 64), CHEST12, [(single, CHEST21)]))
        right = m.img('textures/entity/chest/%s_right.png' % kind)
        left = m.img('textures/entity/chest/%s_left.png' % kind)
        pk.put_png(T('entity/chest/%s_double.png' % kind),
                   remap_boxes((128, 64), LARGE12, [(right, RIGHT21), (left, LEFT21)]))
    pk.put_png(T('entity/chest/ender.png'), remap_boxes((64, 64), CHEST12, [(m.img('textures/entity/chest/ender.png'), CHEST21)]))

    # Explosion and sweep sheets from the 1.21 particle frames
    ex = Image.new('RGBA', (128, 128), (0, 0, 0, 0))
    for i in range(16):
        ex.paste(m.img('textures/particle/explosion_%d.png' % i).resize((32, 32), Image.NEAREST), (i % 4 * 32, i // 4 * 32))
    pk.put_png(T('entity/explosion.png'), ex)
    sw = Image.new('RGBA', (128, 32), (0, 0, 0, 0))
    # 1.12 shows frames at (col 0, row 0), (1, 0), (2, 1), (3, 1) over the particle's life
    for col in range(4):
        for row in range(2):
            f = m.img('textures/particle/sweep_%d.png' % min(7, col * 2 + row)).resize((32, 16), Image.NEAREST)
            sw.paste(f, (col * 32, row * 16))
    pk.put_png(T('entity/sweep.png'), sw)

    build_gui_121(pk, v12, m)

    # Particles
    pa = v12.img('textures/particle/particles.png')
    for idx, name in sorted(PARTICLES.items()):
        put(pa, m.img('textures/particle/%s.png' % name).resize((8, 8), Image.NEAREST), idx % 16 * 8, idx // 16 * 8,
            check='particle ' + name)
    put(pa, m.img('textures/entity/fishing_hook.png').resize((8, 8), Image.NEAREST), 8, 16, check='fishing hook')
    pk.put_png(T('particle/particles.png'), pa)

    # Sky, overlays, map, paintings, colours
    for n in ('clouds', 'rain', 'snow', 'end_sky'):
        copy('environment/%s.png' % n, 'environment/%s.png' % n)
    copy('environment/sun.png', 'environment/celestial/sun.png')
    moon = Image.new('RGBA', (128, 64), (0, 0, 0, 0))
    for i, n in enumerate(MOON):
        moon.paste(m.img('textures/environment/celestial/moon/%s.png' % n), (i % 4 * 32, i // 4 * 32))
    pk.put_png(T('environment/moon_phases.png'), moon)
    copy('misc/enchanted_item_glint.png', 'misc/enchanted_glint_item.png')
    for n in ('pumpkinblur', 'vignette', 'shadow', 'underwater', 'forcefield', 'unknown_pack', 'unknown_server'):
        copy('misc/%s.png' % n, 'misc/%s.png' % n)
    copy('map/map_background.png', 'map/map_background.png')
    icons = v12.img('textures/map/map_icons.png')
    for i, n in enumerate(MAP_ICONS):
        put(icons, m.img('textures/map/decorations/%s.png' % n), i % 4 * 8, i // 4 * 8, check='map ' + n)
    pk.put_png(T('map/map_icons.png'), icons)
    art = v12.img('textures/painting/paintings_kristoffer_zetterstrand.png')
    for n, x, y in PAINTINGS:
        put(art, m.img('textures/painting/%s.png' % n), x, y, check='painting ' + n)
    pk.put_png(T('painting/paintings_kristoffer_zetterstrand.png'), art)
    copy('colormap/grass.png', 'colormap/grass.png')
    copy('colormap/foliage.png', 'colormap/foliage.png')
    pk.put_png('pack.png', pack_icon_121(m))
    return pk


def build_gui_121(pk, v12, m):
    T = pk.tex
    S = m.sprite

    def sheet(p):
        return v12.img('textures/gui/' + p)

    def base(p, w, h, src=None):
        """1.12 sheet p with its (0, 0, w, h) panel replaced by the 1.21 one."""
        img = sheet(p)
        new = m.img('textures/gui/' + (src or p))
        put(img, new.crop((0, 0, w, h)), 0, 0, check='panel ' + p)
        return img

    # widgets.png
    wd = sheet('widgets.png')
    put(wd, S('hud/hotbar'), 0, 0, check='hotbar')
    put(wd, S('hud/hotbar_selection'), 0, 22, 24, 22, check='hotbar selection')
    put(wd, S('hud/hotbar_offhand_left'), 24, 22, check='offhand left')
    put(wd, S('hud/hotbar_offhand_right'), 53, 22, check='offhand right')
    for i, n in enumerate(('button_disabled', 'button', 'button_highlighted')):
        put(wd, S('widget/' + n), 0, 46 + 20 * i, check='button ' + n)
    for i, n in enumerate(('button', 'button_highlighted')):
        b = S('widget/' + n)
        small = Image.new('RGBA', (20, 20), (0, 0, 0, 0))
        small.paste(b.crop((0, 0, 10, 20)), (0, 0))
        small.paste(b.crop((190, 0, 200, 20)), (10, 0))
        small.alpha_composite(S('icon/language'), (2, 2))
        put(wd, small, 0, 106 + 20 * i, check='language button')
    for col, lock in enumerate(('locked', 'unlocked')):
        for row, st in enumerate(('', '_highlighted', '_disabled')):
            put(wd, S('widget/%s_button%s' % (lock, st)), col * 20, 146 + row * 20, check='lock ' + lock + st)
    pk.put_png(T('gui/widgets.png'), wd)

    # icons.png
    ic = sheet('icons.png')
    put(ic, S('hud/crosshair'), 0, 0, 16, 16, check='crosshair')
    for row, hc in ((0, ''), (45, 'hardcore_')):
        put(ic, S('hud/heart/container' + ('_hardcore' if hc else '')), 16, row, check='heart container')
        put(ic, S('hud/heart/container' + ('_hardcore' if hc else '') + '_blinking'), 25, row, check='heart container blink')
        for base_x, kind in ((52, ''), (88, 'poisoned_'), (124, 'withered_')):
            put(ic, S('hud/heart/%s%sfull' % (kind, hc)), base_x, row, check='heart ' + kind + 'full')
            put(ic, S('hud/heart/%s%shalf' % (kind, hc)), base_x + 9, row, check='heart ' + kind + 'half')
            put(ic, S('hud/heart/%s%sfull_blinking' % (kind, hc)), base_x + 18, row, check='heart ' + kind + 'full blink')
            put(ic, S('hud/heart/%s%shalf_blinking' % (kind, hc)), base_x + 27, row, check='heart ' + kind + 'half blink')
        put(ic, S('hud/heart/absorbing_%sfull' % hc), 160, row, check='heart absorbing full')
        put(ic, S('hud/heart/absorbing_%shalf' % hc), 169, row, check='heart absorbing half')
    for i, n in enumerate(('armor_empty', 'armor_half', 'armor_full')):
        put(ic, S('hud/' + n), 16 + 9 * i, 9, check=n)
    put(ic, S('hud/heart/vehicle_container'), 52, 9, check='vehicle container')
    put(ic, S('hud/heart/vehicle_full'), 88, 9, check='vehicle full')
    put(ic, S('hud/heart/vehicle_half'), 97, 9, check='vehicle half')
    put(ic, S('hud/air'), 16, 18, check='air')
    put(ic, S('hud/air_bursting'), 25, 18, check='air bursting')
    for n, x in (('food_empty', 16), ('food_empty_hunger', 133), ('food_full', 52), ('food_half', 61),
                 ('food_full_hunger', 88), ('food_half_hunger', 97)):
        put(ic, S('hud/' + n), x, 27, check=n)
    put(ic, S('hud/experience_bar_background'), 0, 64, check='xp background')
    put(ic, S('hud/experience_bar_progress'), 0, 69, check='xp progress')
    put(ic, S('hud/jump_bar_background'), 0, 84, check='jump background')
    put(ic, S('hud/jump_bar_progress'), 0, 89, check='jump progress')
    put(ic, S('hud/hotbar_attack_indicator_background'), 0, 94, check='hotbar attack background')
    put(ic, S('hud/hotbar_attack_indicator_progress'), 18, 94, check='hotbar attack progress')
    put(ic, S('hud/crosshair_attack_indicator_background'), 36, 94, check='crosshair attack background')
    put(ic, S('hud/crosshair_attack_indicator_progress'), 52, 94, check='crosshair attack progress')
    put(ic, S('hud/crosshair_attack_indicator_full'), 68, 94, check='crosshair attack full')
    for j, n in enumerate(('ping_5', 'ping_4', 'ping_3', 'ping_2', 'ping_1', 'ping_unknown')):
        put(ic, S('icon/' + n), 0, 176 + 8 * j, check=n)
    for j in range(5):
        put(ic, S('server_list/pinging_%d' % (j + 1)), 10, 176 + 8 * j, check='pinging %d' % (j + 1))
    pk.put_png(T('gui/icons.png'), ic)

    # bars.png (boss bars)
    bars = sheet('bars.png')
    for i, c in enumerate(('pink', 'blue', 'red', 'green', 'yellow', 'purple', 'white')):
        put(bars, S('boss_bar/%s_background' % c), 0, i * 10, check='boss ' + c)
        put(bars, S('boss_bar/%s_progress' % c), 0, i * 10 + 5, check='boss ' + c + ' progress')
    for i, n in enumerate(('6', '10', '12', '20')):
        put(bars, S('boss_bar/notched_%s_background' % n), 0, 80 + i * 10, check='notched ' + n)
        put(bars, S('boss_bar/notched_%s_progress' % n), 0, 85 + i * 10, check='notched ' + n + ' progress')
    pk.put_png(T('gui/bars.png'), bars)

    # Containers
    inv = base('container/inventory.png', 176, 166)
    put(inv, S('recipe_book/button'), 178, 0, check='recipe button')
    put(inv, S('recipe_book/button_highlighted'), 178, 19, check='recipe button hover')
    put(inv, nine_slice(S('container/inventory/effect_background'), 140, 32, 4), 0, 166, check='effect panel')
    put(inv, S('hud/effect_background'), 141, 166, check='hud effect')
    put(inv, S('hud/effect_background_ambient'), 165, 166, check='hud effect ambient')
    for n, i in EFFECT_ICONS.items():
        put(inv, m.img('textures/mob_effect/%s.png' % n), i % 8 * 18, 198 + i // 8 * 18, check='effect ' + n)
    pk.put_png(T('gui/container/inventory.png'), inv)

    ct = base('container/crafting_table.png', 176, 166)
    put(ct, S('recipe_book/button'), 0, 168, check='craft recipe button')
    put(ct, S('recipe_book/button_highlighted'), 0, 187, check='craft recipe button hover')
    pk.put_png(T('gui/container/crafting_table.png'), ct)

    fu = base('container/furnace.png', 176, 166)
    put(fu, S('container/furnace/lit_progress'), 176, 0, check='furnace flame')
    put(fu, S('container/furnace/burn_progress'), 176, 14, 24, 17, check='furnace arrow')
    pk.put_png(T('gui/container/furnace.png'), fu)

    br = base('container/brewing_stand.png', 176, 166)
    put(br, S('container/brewing_stand/brew_progress'), 176, 0, check='brew arrow')
    put(br, S('container/brewing_stand/bubbles'), 185, 0, check='brew bubbles')
    put(br, S('container/brewing_stand/fuel_length'), 176, 29, check='brew fuel')
    pk.put_png(T('gui/container/brewing_stand.png'), br)

    en = base('container/enchanting_table.png', 176, 166)
    put(en, S('container/enchanting_table/enchantment_slot'), 0, 166, check='enchant slot')
    put(en, S('container/enchanting_table/enchantment_slot_disabled'), 0, 185, check='enchant slot disabled')
    put(en, S('container/enchanting_table/enchantment_slot_highlighted'), 0, 204, check='enchant slot hover')
    for i in range(3):
        put(en, S('container/enchanting_table/level_%d' % (i + 1)), 16 * i, 223, check='enchant level')
        put(en, S('container/enchanting_table/level_%d_disabled' % (i + 1)), 16 * i, 239, check='enchant level off')
    pk.put_png(T('gui/container/enchanting_table.png'), en)

    an = base('container/anvil.png', 176, 166)
    put(an, S('container/anvil/text_field'), 0, 166, check='anvil field')
    put(an, S('container/anvil/text_field_disabled'), 0, 182, check='anvil field disabled')
    put(an, S('container/anvil/error'), 176, 0, check='anvil error')
    pk.put_png(T('gui/container/anvil.png'), an)

    be = base('container/beacon.png', 230, 219)
    for i, n in enumerate(('button', 'button_selected', 'button_disabled', 'button_highlighted')):
        put(be, S('container/beacon/' + n), 22 * i, 219, check='beacon ' + n)
    put(be, S('container/beacon/confirm'), 90, 220, check='beacon confirm')
    put(be, S('container/beacon/cancel'), 112, 220, check='beacon cancel')
    pk.put_png(T('gui/container/beacon.png'), be)

    ho = base('container/horse.png', 176, 166)
    put(ho, S('container/horse/chest_slots'), 0, 166, check='horse chest slots')
    slot = m.img('textures/gui/container/inventory.png').crop((7, 83, 25, 101))
    for x, n in ((0, 'horse_armor'), (18, 'saddle'), (36, 'llama_armor')):
        s = slot.copy()
        s.alpha_composite(S('container/slot/' + n), (1, 1))
        put(ho, s, x, 220, check='horse slot ' + n)
    pk.put_png(T('gui/container/horse.png'), ho)

    for n in ('generic_54', 'dispenser', 'hopper', 'shulker_box'):
        p = 'container/%s.png' % n
        pk.put_png(T('gui/' + p), base(p, 176, 222 if n == 'generic_54' else (133 if n == 'hopper' else 166)))
    for n in ('tab_items', 'tab_inventory', 'tab_item_search'):
        p = 'container/creative_inventory/%s.png' % n
        pk.put_png(T('gui/' + p), base(p, 195, 136))

    bk = base('book.png', 192, 192)
    put(bk, S('widget/page_forward'), 0, 192, check='page forward')
    put(bk, S('widget/page_forward_highlighted'), 23, 192, check='page forward hover')
    put(bk, S('widget/page_backward'), 0, 205, check='page backward')
    put(bk, S('widget/page_backward_highlighted'), 23, 205, check='page backward hover')
    pk.put_png(T('gui/book.png'), bk)

    rb = sheet('recipe_book.png')
    put(rb, m.img('textures/gui/recipe_book.png').crop((1, 1, 148, 167)), 1, 1, check='recipe panel')
    put(rb, S('recipe_book/filter_disabled'), 152, 41, check='filter off')
    put(rb, S('recipe_book/filter_enabled'), 180, 41, check='filter on')
    put(rb, S('recipe_book/filter_disabled_highlighted'), 152, 59, check='filter off hover')
    put(rb, S('recipe_book/filter_enabled_highlighted'), 180, 59, check='filter on hover')
    put(rb, S('recipe_book/tab'), 153, 2, check='recipe tab')
    put(rb, S('recipe_book/tab_selected'), 188, 2, check='recipe tab selected')
    put(rb, S('recipe_book/page_forward'), 1, 208, check='recipe page forward')
    put(rb, S('recipe_book/page_forward_highlighted'), 1, 226, check='recipe page forward hover')
    put(rb, S('recipe_book/page_backward'), 14, 208, check='recipe page back')
    put(rb, S('recipe_book/page_backward_highlighted'), 14, 226, check='recipe page back hover')
    put(rb, S('recipe_book/slot_craftable'), 29, 206, check='slot craftable')
    put(rb, S('recipe_book/slot_uncraftable'), 54, 206, check='slot uncraftable')
    put(rb, S('recipe_book/slot_many_craftable'), 29, 231, check='slot many craftable')
    put(rb, S('recipe_book/slot_many_uncraftable'), 54, 231, check='slot many uncraftable')
    put(rb, S('recipe_book/crafting_overlay'), 152, 78, check='overlay craftable')
    put(rb, S('recipe_book/crafting_overlay_disabled'), 178, 78, check='overlay uncraftable')
    put(rb, S('recipe_book/crafting_overlay_highlighted'), 152, 104, check='overlay craftable hover')
    put(rb, S('recipe_book/crafting_overlay_disabled_highlighted'), 178, 104, check='overlay uncraftable hover')
    put(rb, S('recipe_book/overlay_recipe'), 82, 208, check='overlay background')
    pk.put_png(T('gui/recipe_book.png'), rb)

    to = sheet('toasts.png')
    for i, n in enumerate(('advancement', 'recipe', 'system', 'tutorial')):
        put(to, S('toast/' + n), 0, 32 * i, check='toast ' + n)
    for n, c, r in (('movement_keys', 0, 0), ('mouse', 1, 0), ('tree', 2, 0), ('recipe_book', 0, 1),
                    ('wooden_planks', 1, 1)):
        put(to, S('toast/' + n), 176 + 20 * c, 20 * r, check='toast icon ' + n)
    pk.put_png(T('gui/toasts.png'), to)

    rp = sheet('resource_packs.png')
    for x, n in ((0, 'select'), (32, 'unselect'), (64, 'move_down'), (96, 'move_up')):
        put(rp, S('transferable_list/' + n), x, 0, check='pack ' + n)
        put(rp, S('transferable_list/%s_highlighted' % n), x, 32, check='pack ' + n + ' hover')
    pk.put_png(T('gui/resource_packs.png'), rp)
    ss = sheet('server_selection.png')
    for x, n in ((0, 'join'), (64, 'move_down'), (96, 'move_up')):
        put(ss, S('server_list/' + n), x, 0, check='server ' + n)
        put(ss, S('server_list/%s_highlighted' % n), x, 32, check='server ' + n + ' hover')
    pk.put_png(T('gui/server_selection.png'), ss)
    ws = sheet('world_selection.png')
    for x, n in ((0, 'join'), (32, 'marked_join'), (64, 'warning'), (96, 'error')):
        put(ws, S('world_list/' + n), x, 0, check='world ' + n)
        put(ws, S('world_list/%s_highlighted' % n), x, 32, check='world ' + n + ' hover')
    pk.put_png(T('gui/world_selection.png'), ws)

    pk.put_png(T('gui/advancements/window.png'), base('advancements/window.png', 252, 140))
    for n in ('adventure', 'end', 'husbandry', 'nether', 'stone'):
        pk.put(T('gui/advancements/backgrounds/%s.png' % n), m.raw('textures/gui/advancements/backgrounds/%s.png' % n))
    pk.put(T('gui/demo_background.png'), m.raw('textures/gui/demo_background.png'))


def pack_icon_121(m):
    """Isometric 1.21.11 grass block, 128x128."""
    green = (0x79, 0xC0, 0x5A)
    top = tint(m.img('textures/block/grass_block_top.png'), green).load()
    side_img = m.img('textures/block/grass_block_side.png')
    side_img.alpha_composite(tint(m.img('textures/block/grass_block_side_overlay.png'), green))
    side = side_img.load()
    out = Image.new('RGBA', (128, 128), (0, 0, 0, 0))
    po = out.load()
    for Y in range(128):
        for X in range(128):
            x, y = (X + 0.5) / 4 - 16, (Y + 0.5) / 4
            a, b = y + x / 2, y - x / 2          # top face: screen (a - b, (a + b) / 2)
            if 0 <= a < 16 and 0 <= b < 16:
                po[X, Y] = top[int(a), int(b)]
                continue
            if -16 <= x < 0:                     # left face
                u, v, shade = x + 16, y - 16 - x / 2, 0.8
            elif 0 <= x < 16:                    # right face
                u, v, shade = x, y - 16 + x / 2, 0.6
            else:
                continue
            if 0 <= v < 16:
                c = side[int(u), int(v)]
                po[X, Y] = (int(c[0] * shade), int(c[1] * shade), int(c[2] * shade), c[3])
    return out


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--cache', default=os.path.join(os.path.expanduser('~'), '.cache', 'thunder-packs', '1.21.11'))
    ap.add_argument('--out', default=os.path.join(ROOT, 'packs'))
    ap.add_argument('--check', action='store_true', help='print the placement check log')
    args = ap.parse_args()
    v12 = Vanilla12(os.path.join(ROOT, 'assets.epk'))
    m = Mc121(args.cache)
    p121 = build_121(v12, m)
    ppvp = pvp.build(sys.modules[__name__], v12, m, p121)
    listing = []
    for pk, fn, folder in ((p121, 'Thunder-1.21.11.zip', 'Thunder-1_21_11'), (ppvp, 'Thunder-PvP.zip', 'Thunder-PvP')):
        path = os.path.join(args.out, fn)
        size = pk.write(path)
        digest = hashlib.sha256(open(path, 'rb').read()).hexdigest()[:16]
        listing.append({'file': fn, 'folder': folder, 'name': pk.name, 'version': digest, 'size': size})
        print('%-22s %4d files %8d bytes  %s' % (fn, len(pk.files), size, digest))
    # read by thunder-packs.js: a pack whose version changed is updated in place for players who have it
    with open(os.path.join(args.out, 'packs.json'), 'w') as f:
        f.write(json.dumps({'packs': listing}, indent=2) + '\n')
    if args.check:
        print('\n'.join(LOG))


if __name__ == '__main__':
    main()
