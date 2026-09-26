/*
 * Thunder Pack Doctor - finds and repairs the resource-pack problems that make textures render
 * as the purple/black "missing texture" in this Eaglercraft 1.12 client.
 *
 * Why textures go missing (verified against this client's compiled TextureAtlasSprite.loadSprite
 * and resource manager):
 *   - An atlas texture (textures/blocks, textures/items) that is taller than it is wide is only
 *     accepted as an animation when "<name>.png.mcmeta" with an "animation" section is present in
 *     the same pack. Without it: "broken aspect ratio and not an animation" -> missing texture.
 *     Fire (fire_layer_0/1), lava, water, portal, magma, sea lantern and prismarine are strips.
 *   - Every frame index listed in the .mcmeta must exist in the strip ("invalid frameindex N").
 *   - The file must be called "<name>.png.mcmeta"; "<name>.mcmeta" is never looked at.
 *   - Invalid JSON in a .mcmeta makes the whole texture fail.
 *   - pack_format does not affect loading here. (This client paints the pack red in the list
 *     unless pack_format is 3, and asks for confirmation when selecting unless it is 1.)
 *
 * Works in browsers and Node. No dependencies: the caller supplies raw-deflate helpers
 * (browser: CompressionStream/DecompressionStream, Node: zlib).
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.ThunderPackDoctor = factory();
}(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  // Animated textures of the vanilla 1.12 pack (from assets.epk): frame count + animation section.
  var VANILLA = {"blocks/chain_command_block_back.png":{"frames":4,"animation":{"interpolate":true,"frametime":10}},"blocks/chain_command_block_conditional.png":{"frames":4,"animation":{"interpolate":true,"frametime":10}},"blocks/chain_command_block_front.png":{"frames":4,"animation":{"interpolate":true,"frametime":10}},"blocks/chain_command_block_side.png":{"frames":4,"animation":{"interpolate":true,"frametime":10}},"blocks/command_block_back.png":{"frames":4,"animation":{"interpolate":true,"frametime":10}},"blocks/command_block_conditional.png":{"frames":4,"animation":{"interpolate":true,"frametime":10}},"blocks/command_block_front.png":{"frames":4,"animation":{"interpolate":true,"frametime":10}},"blocks/command_block_side.png":{"frames":4,"animation":{"interpolate":true,"frametime":10}},"blocks/fire_layer_0.png":{"frames":32,"animation":{"frames":[16,17,18,19,20,21,22,23,24,25,26,27,28,29,30,31,0,1,2,3,4,5,6,7,8,9,10,11,12,13,14,15]}},"blocks/fire_layer_1.png":{"frames":32,"animation":{}},"blocks/lava_flow.png":{"frames":16,"animation":{"frametime":3}},"blocks/lava_still.png":{"frames":20,"animation":{"frametime":2,"frames":[0,1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,18,17,16,15,14,13,12,11,10,9,8,7,6,5,4,3,2,1]}},"blocks/magma.png":{"frames":3,"animation":{"frametime":8,"interpolate":true,"frames":[0,1,2]}},"blocks/portal.png":{"frames":32,"animation":{}},"blocks/prismarine_rough.png":{"frames":4,"animation":{"frametime":300,"interpolate":true,"frames":[0,1,0,2,0,3,0,1,2,1,3,1,0,2,1,2,3,2,0,3,1,3]}},"blocks/repeating_command_block_back.png":{"frames":4,"animation":{"interpolate":true,"frametime":10}},"blocks/repeating_command_block_conditional.png":{"frames":4,"animation":{"interpolate":true,"frametime":10}},"blocks/repeating_command_block_front.png":{"frames":4,"animation":{"interpolate":true,"frametime":10}},"blocks/repeating_command_block_side.png":{"frames":4,"animation":{"interpolate":true,"frametime":10}},"blocks/sea_lantern.png":{"frames":5,"animation":{"frametime":5}},"blocks/water_flow.png":{"frames":32,"animation":{}},"blocks/water_still.png":{"frames":32,"animation":{"frametime":2}}};
  var PACK_FORMAT = 3;   // written only when pack.mcmeta has to be recreated (vanilla 1.12 value)

  // ------------------------------------------------------------------ bytes / text helpers
  var utf8d = typeof TextDecoder !== 'undefined' ? new TextDecoder('utf-8') : null;
  var utf8e = typeof TextEncoder !== 'undefined' ? new TextEncoder() : null;
  function decodeText(b) { return utf8d ? utf8d.decode(b) : Buffer.from(b).toString('utf8'); }
  function encodeText(s) { return utf8e ? utf8e.encode(s) : new Uint8Array(Buffer.from(s, 'utf8')); }
  function u16(b, o) { return b[o] | (b[o + 1] << 8); }
  function u32(b, o) { return (b[o] | (b[o + 1] << 8) | (b[o + 2] << 16) | (b[o + 3] << 24)) >>> 0; }
  var CRC_TABLE = (function () {
    var t = new Uint32Array(256);
    for (var n = 0; n < 256; n++) { var c = n; for (var k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; }
    return t;
  })();
  function crc32(b) { var c = 0xFFFFFFFF; for (var i = 0; i < b.length; i++) c = CRC_TABLE[(c ^ b[i]) & 255] ^ (c >>> 8); return (c ^ 0xFFFFFFFF) >>> 0; }

  // ------------------------------------------------------------------ zip read
  // inflateRaw(Uint8Array) -> Promise<Uint8Array>
  function readZip(bytes, inflateRaw) {
    var b = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
    var eocd = -1;
    for (var i = b.length - 22; i >= Math.max(0, b.length - 22 - 65535); i--) {
      if (u32(b, i) === 0x06054b50) { eocd = i; break; }
    }
    if (eocd < 0) return Promise.reject(new Error('Not a zip file (no end-of-central-directory record).'));
    var count = u16(b, eocd + 10), cdOff = u32(b, eocd + 16);
    if (cdOff === 0xFFFFFFFF || count === 0xFFFF) return Promise.reject(new Error('ZIP64 archives are not supported.'));
    var entries = [], p = cdOff;
    for (var e = 0; e < count; e++) {
      if (u32(b, p) !== 0x02014b50) return Promise.reject(new Error('Corrupt zip central directory.'));
      var method = u16(b, p + 10), csize = u32(b, p + 20), nlen = u16(b, p + 28), xlen = u16(b, p + 30), clen = u16(b, p + 32);
      var lho = u32(b, p + 42);
      var name = decodeText(b.subarray(p + 46, p + 46 + nlen));
      p += 46 + nlen + xlen + clen;
      if (name.charAt(name.length - 1) === '/') continue;                 // directory
      if (u32(b, lho) !== 0x04034b50) return Promise.reject(new Error('Corrupt local header for ' + name));
      var start = lho + 30 + u16(b, lho + 26) + u16(b, lho + 28);
      entries.push({ name: name, method: method, raw: b.subarray(start, start + csize) });
    }
    return Promise.all(entries.map(function (en) {
      if (en.method === 0) return Promise.resolve({ name: en.name, data: en.raw });
      if (en.method === 8) return inflateRaw(en.raw).then(function (d) { return { name: en.name, data: d }; });
      return Promise.reject(new Error('Unsupported compression method ' + en.method + ' for ' + en.name));
    }));
  }

  // ------------------------------------------------------------------ zip write
  // deflateRaw optional: Uint8Array -> Promise<Uint8Array>; without it entries are stored.
  function writeZip(files, deflateRaw) {
    return Promise.all(files.map(function (f) {
      var isPng = /\.png$/i.test(f.name);                                 // already compressed
      if (!deflateRaw || isPng || f.data.length < 64) return Promise.resolve({ f: f, method: 0, comp: f.data });
      return deflateRaw(f.data).then(function (c) {
        return c.length < f.data.length ? { f: f, method: 8, comp: c } : { f: f, method: 0, comp: f.data };
      });
    })).then(function (list) {
      var parts = [], central = [], offset = 0;
      list.forEach(function (it) {
        var nameB = encodeText(it.f.name), crc = crc32(it.f.data);
        var lh = new Uint8Array(30), dv = new DataView(lh.buffer);
        dv.setUint32(0, 0x04034b50, true); dv.setUint16(4, 20, true); dv.setUint16(6, 0x0800, true);
        dv.setUint16(8, it.method, true); dv.setUint16(10, 0, true); dv.setUint16(12, 0x21, true);
        dv.setUint32(14, crc, true); dv.setUint32(18, it.comp.length, true); dv.setUint32(22, it.f.data.length, true);
        dv.setUint16(26, nameB.length, true); dv.setUint16(28, 0, true);
        var ch = new Uint8Array(46), cv = new DataView(ch.buffer);
        cv.setUint32(0, 0x02014b50, true); cv.setUint16(4, 20, true); cv.setUint16(6, 20, true); cv.setUint16(8, 0x0800, true);
        cv.setUint16(10, it.method, true); cv.setUint16(12, 0, true); cv.setUint16(14, 0x21, true);
        cv.setUint32(16, crc, true); cv.setUint32(20, it.comp.length, true); cv.setUint32(24, it.f.data.length, true);
        cv.setUint16(28, nameB.length, true); cv.setUint32(42, offset, true);
        parts.push(lh, nameB, it.comp);
        central.push(ch, nameB);
        offset += 30 + nameB.length + it.comp.length;
      });
      var cdSize = central.reduce(function (s, x) { return s + x.length; }, 0);
      var end = new Uint8Array(22), ev = new DataView(end.buffer);
      ev.setUint32(0, 0x06054b50, true); ev.setUint16(8, list.length, true); ev.setUint16(10, list.length, true);
      ev.setUint32(12, cdSize, true); ev.setUint32(16, offset, true);
      var all = parts.concat(central, [end]), total = all.reduce(function (s, x) { return s + x.length; }, 0);
      var out = new Uint8Array(total), o = 0;
      all.forEach(function (x) { out.set(x, o); o += x.length; });
      return out;
    });
  }

  // ------------------------------------------------------------------ analysis + repair
  function pngSize(d) {
    if (d.length < 24 || d[0] !== 0x89 || d[1] !== 0x50 || d[2] !== 0x4E || d[3] !== 0x47) return null;
    var dv = new DataView(d.buffer, d.byteOffset, d.byteLength);
    if (decodeText(d.subarray(12, 16)) !== 'IHDR') return null;
    return { w: dv.getUint32(16), h: dv.getUint32(20) };
  }
  function parseJson(d) {
    var s = decodeText(d).replace(/^﻿/, '');
    try { return { ok: true, value: JSON.parse(s) }; } catch (e) { return { ok: false, error: e.message }; }
  }
  function frameIndex(f) { return typeof f === 'number' ? f : (f && typeof f.index === 'number' ? f.index : -1); }
  function json(v) { return encodeText(JSON.stringify(v, null, 2) + '\n'); }
  function animationFor(rel, frames) {
    var v = VANILLA[rel];
    if (v && v.frames === frames) return { animation: JSON.parse(JSON.stringify(v.animation)), how: 'vanilla timing' };
    var a = {};
    if (v && v.animation.frametime) a.frametime = v.animation.frametime;
    if (v && v.animation.interpolate) a.interpolate = true;
    return { animation: a, how: v ? 'vanilla speed, all ' + frames + ' frames in order' : 'all ' + frames + ' frames in order' };
  }

  /**
   * files: [{name, data: Uint8Array}] -> {files, report: [{level, path, message, fixed}], prefix}
   * level: 'fix' (changed), 'warn' (needs a human), 'info'
   */
  function doctor(files) {
    var report = [], byName = {}, out = files.slice();
    out.forEach(function (f) { byName[f.name] = f; });
    function note(level, path, message) { report.push({ level: level, path: path, message: message }); }
    function put(name, data) {
      if (byName[name]) byName[name].data = data;
      else { var f = { name: name, data: data }; out.push(f); byName[name] = f; }
    }
    function drop(name) { out = out.filter(function (f) { return f.name !== name; }); delete byName[name]; }

    // pack root = folder holding pack.mcmeta (Eaglercraft accepts packs nested in one folder)
    var prefix = null;
    out.forEach(function (f) {
      var m = /^(.*?)pack\.mcmeta$/.exec(f.name);
      if (m && (prefix === null || m[1].length < prefix.length)) prefix = m[1];
    });
    if (prefix === null) {
      note('warn', 'pack.mcmeta', 'No pack.mcmeta found; the game will not list this as a resource pack.');
      prefix = '';
    } else {
      var pm = parseJson(byName[prefix + 'pack.mcmeta'].data);
      if (!pm.ok || !pm.value || typeof pm.value.pack !== 'object') {
        put(prefix + 'pack.mcmeta', json({ pack: { pack_format: PACK_FORMAT, description: 'Repaired by Thunder Pack Doctor' } }));
        note('fix', 'pack.mcmeta', 'Invalid pack.mcmeta (' + (pm.error || 'no "pack" section') + '); rewrote it.');
      } else if (pm.value.pack.pack_format !== 1 && pm.value.pack.pack_format !== 3) {
        note('info', 'pack.mcmeta', 'pack_format ' + pm.value.pack.pack_format + ' is unusual; it does not stop textures loading. Left as is.');
      }
    }

    var texRe = new RegExp('^' + prefix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + 'assets/([^/]+)/textures/((blocks|items)/.+\\.png)$', 'i');
    var checked = 0;
    out.slice().forEach(function (f) {
      var m = texRe.exec(f.name);
      if (!m) return;
      checked++;
      var rel = m[2], metaName = f.name + '.mcmeta';
      var size = pngSize(f.data);
      if (!size) { note('warn', f.name, 'Not a valid PNG; this texture will show as missing.'); return; }
      // "<name>.mcmeta" instead of "<name>.png.mcmeta" is never read by the game
      var wrongMeta = f.name.replace(/\.png$/i, '.mcmeta');
      if (byName[wrongMeta] && !byName[metaName]) {
        put(metaName, byName[wrongMeta].data); drop(wrongMeta);
        note('fix', wrongMeta, 'Renamed to ' + metaName.split('/').pop() + ' (the game only reads "<texture>.png.mcmeta").');
      }
      var w = size.w, h = size.h;
      if (w > h) {
        note('warn', f.name, w + 'x' + h + ' is wider than tall; block/item textures must be square or vertical animation strips, so this one shows as missing. Resize it to ' + h + 'x' + h + '.');
        return;
      }
      if (h === w) {
        if (byName[metaName]) {
          var sq = parseJson(byName[metaName].data);
          if (!sq.ok) { drop(metaName); note('fix', metaName, 'Invalid JSON (' + sq.error + ') on a square texture; removed it.'); }
        }
        return;
      }
      var frames = Math.floor(h / w);
      if (h % w) note('warn', f.name, w + 'x' + h + ': height is not a multiple of the width; the last ' + (h % w) + ' pixel rows are ignored.');
      if (!byName[metaName]) {
        var a = animationFor(rel, frames);
        put(metaName, json({ animation: a.animation }));
        note('fix', metaName, 'Missing. ' + w + 'x' + h + ' is a ' + frames + '-frame animation strip, which the game rejects without this file (purple/black texture). Added it (' + a.how + ').');
        return;
      }
      var parsed = parseJson(byName[metaName].data);
      if (!parsed.ok || !parsed.value || typeof parsed.value !== 'object') {
        var a2 = animationFor(rel, frames);
        put(metaName, json({ animation: a2.animation }));
        note('fix', metaName, 'Invalid JSON (' + (parsed.error || 'not an object') + '); replaced it (' + a2.how + ').');
        return;
      }
      var meta = parsed.value;
      if (!meta.animation || typeof meta.animation !== 'object') {
        meta.animation = animationFor(rel, frames).animation;
        put(metaName, json(meta));
        note('fix', metaName, 'Has no "animation" section, so the ' + frames + '-frame strip was rejected. Added one.');
        return;
      }
      if (Array.isArray(meta.animation.frames)) {
        var bad = meta.animation.frames.filter(function (x) { var i = frameIndex(x); return i < 0 || i >= frames; });
        if (bad.length) {
          meta.animation.frames = meta.animation.frames.filter(function (x) { var i = frameIndex(x); return i >= 0 && i < frames; });
          if (!meta.animation.frames.length) delete meta.animation.frames;
          put(metaName, json(meta));
          note('fix', metaName, bad.length + ' frame index(es) point past the ' + frames + '-frame strip ("invalid frameindex"); removed them.');
        }
      }
    });

    // .mcmeta files whose texture is missing
    out.forEach(function (f) {
      if (/\.png\.mcmeta$/i.test(f.name) && !byName[f.name.slice(0, -7)]) note('info', f.name, 'No matching .png in this pack (harmless).');
    });
    report.unshift({ level: 'info', path: '', message: 'Checked ' + checked + ' block/item textures' + (prefix ? ' (pack root "' + prefix + '")' : '') + '.' });
    return { files: out, report: report, prefix: prefix };
  }

  function repair(bytes, io) {
    return readZip(bytes, io.inflateRaw).then(function (files) {
      var res = doctor(files);
      var changed = res.report.some(function (r) { return r.level === 'fix'; });
      return writeZip(res.files, io.deflateRaw).then(function (zip) {
        return { zip: zip, report: res.report, changed: changed };
      });
    });
  }

  return { readZip: readZip, writeZip: writeZip, doctor: doctor, repair: repair, VANILLA: VANILLA, PACK_FORMAT: PACK_FORMAT };
}));
