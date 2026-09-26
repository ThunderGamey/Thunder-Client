#!/usr/bin/env node
/*
 * Thunder Client build + verifier.
 *
 *   node thunder/build.js                      build classes.js from backups/classes.clean-base.js
 *   node thunder/build.js --base <file>        build on another clean Eaglercraft 1.12 classes.js
 *   node thunder/build.js --out <file>         write somewhere else
 *   node thunder/build.js --check              verify only, do not write
 *
 * What it guarantees before writing anything:
 *   1. The base is a clean Eaglercraft build (no Thunder block in it).
 *   2. Every obfuscated game name the Thunder source uses is declared in its manifest, and every
 *      declared function name maps to the declared Java class.method in THIS base. The mapping is
 *      read from the base's own runtime deobfuscation table (the data Eaglercraft uses to print
 *      readable stack traces), so nothing is guessed.
 *   3. Static fields are checked against the owning class's static initializer, fields against
 *      the method they were read from.
 *   4. Every game function the Thunder source reassigns (a hook) is declared as @hook.
 *   5. The output is the base with exactly one inserted block, and it parses.
 *
 * Needs the `acorn` parser (npm i --no-save acorn). Locally it is also found inside eslint.
 */
'use strict';
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const vm = require('vm');

const ROOT = path.resolve(__dirname, '..');
const args = process.argv.slice(2);
function opt(name, def) { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : def; }
const BASE = path.resolve(ROOT, opt('--base', 'backups/classes.clean-base.js'));
const OUT = path.resolve(ROOT, opt('--out', 'classes.js'));
const SRC = path.resolve(ROOT, opt('--src', 'thunder/thunder-client.js'));
const CHECK_ONLY = args.includes('--check');
const KNOWN_CLEAN_MD5 = 'eb9c9477f8a04f25e4af424c5aaaf6ee';
const MARKER = '/* ========================= THUNDER CLIENT NATIVE';

let acorn;
for (const p of ['acorn', '/opt/node22/lib/node_modules/eslint/node_modules/acorn']) {
  try { acorn = require(p); break; } catch (_) { /* try next */ }
}
if (!acorn) fail('acorn parser not found. Run: npm i --no-save acorn');

function fail(msg) { console.error('BUILD FAILED: ' + msg); process.exit(1); }
function md5(s) { return crypto.createHash('md5').update(s).digest('hex'); }

// ---------------------------------------------------------------------------------------------
// 1. Base
// ---------------------------------------------------------------------------------------------
const base = fs.readFileSync(BASE, 'utf8');
const baseMd5 = md5(base);
console.log('base   ' + path.relative(ROOT, BASE) + '  md5 ' + baseMd5 + (baseMd5 === KNOWN_CLEAN_MD5 ? '  (known clean Eaglercraft 1.12.2 u0 build)' : '  (NOT the known clean build - verifying names against it)'));
if (base.indexOf('THUNDER CLIENT') >= 0) fail('base already contains a Thunder block; use a clean classes.js');
const TAIL = '\n}));\n';
const tailAt = base.lastIndexOf(TAIL);
if (tailAt < 0 || base.slice(tailAt + TAIL.length).trim().indexOf('//# sourceMappingURL') !== 0 && base.slice(tailAt + TAIL.length).trim() !== '') {
  fail('could not find the end of the TeaVM module wrapper ("}));") in the base');
}

// ---------------------------------------------------------------------------------------------
// 2. Decode the base's runtime deobfuscation table: JS function name -> Java class + method
// ---------------------------------------------------------------------------------------------
function decodeNames(src) {
  const m = /\nfunction ([A-Za-z0-9_$]+)\(\)\{return \[\["/.exec(src);
  if (!m) fail('deobfuscation table not found in base');
  const start = m.index + 1;
  // the table function ends right before the next top-level "function " line
  const end = src.indexOf('\nfunction ', start + 10);
  const fnSrc = src.slice(start, end);
  const data = vm.runInNewContext('(' + fnSrc.replace(/^function [A-Za-z0-9_$]+/, 'function') + ')()', {}, { timeout: 20000 });
  const ALPH = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  const T = {}; for (let i = 0; i < 64; i++) T[ALPH.charCodeAt(i)] = i;
  const dec = (s) => { const out = []; let e = 0; while (e < s.length) { let g = 0, h = 0; for (;;) { const k = T[s.charCodeAt(e++)]; g |= (k & 31) << h; if (k <= 31) break; h += 5; } out.push(g); } return out; };
  const parts = data[0], pool = data[1];
  const methods = new Map();           // jsName -> "java.Class.method"
  const byJava = new Map();            // "java.Class.method" -> [jsName...]
  const classes = new Map();           // JS constructor name -> "java.Class"
  for (let k = 2; k < data.length - 2; k += 3) {
    const cls = dec(data[k]).map((i) => parts[i]).join('.');
    classes.set(data[k + 1], cls);
    const m2 = dec(data[k + 2]);
    for (let p = 0; p + 1 < m2.length; p += 2) {
      const js = pool[m2[p]], java = cls + '.' + pool[m2[p + 1]];
      methods.set(js, java);
      if (!byJava.has(java)) byJava.set(java, []);
      byJava.get(java).push(js);
    }
  }
  return { methods, byJava, classes };
}
const names = decodeNames(base);
console.log('names  ' + names.methods.size + ' compiled functions mapped to Java methods');

// Virtual methods: TeaVM binds them onto prototypes through $rt_metadata([...]) records:
// [cls, name|0, (pkg), super, [ifaces], flags, access, inner, clinit, [vname, fn, ...]|0]
function decodeVirtuals(src) {
  const calls = [];
  let pos = 0;
  for (;;) {
    const i = src.indexOf('\n$rt_metadata([', pos);
    if (i < 0) break;
    let k = i + '\n$rt_metadata('.length, depth = 0, q = null;
    const j = k;
    for (;; k++) {
      const ch = src[k];
      if (q) { if (ch === '\\') { k++; continue; } if (ch === q) q = null; continue; }
      if (ch === '"' || ch === "'") q = ch;
      else if (ch === '[') depth++;
      else if (ch === ']') { depth--; if (depth === 0) break; }
    }
    calls.push(src.slice(j, k + 1).replace(/\n/g, ' '));
    pos = k;
  }
  const cache = {};
  const scope = new Proxy({}, {
    has: (t, key) => typeof key === 'string',
    get: (t, key) => {
      if (key === Symbol.unscopables) return undefined;
      if (/^Hz[3-7]$/.test(key)) return (f) => ({ wrap: f.id });
      return cache[key] || (cache[key] = { id: key });
    }
  });
  const supers = new Map(), virt = new Map();   // cls -> super ; cls -> Map(vname -> fn)
  for (const c of calls) {
    const arr = new Function('p', 'with(p){return ' + c + ';}')(scope);
    let i = 0;
    while (i < arr.length) {
      const cls = arr[i++].id; const nm = arr[i++]; if (nm !== 0) i++;
      const sup = arr[i++]; i += 5; const vms = arr[i++];
      supers.set(cls, sup === 0 ? null : sup.id);
      const map = new Map(); virt.set(cls, map);
      if (vms !== 0) for (let v = 0; v < vms.length; v += 2) {
        const fn = vms[v + 1];
        let impl = fn && fn.wrap;
        if (!impl && typeof fn === 'function') { const mm = /return\s+([A-Za-z0-9_$]+)\(this/.exec(String(fn)); impl = mm && mm[1]; }
        (typeof vms[v] === 'string' ? [vms[v]] : vms[v]).forEach((n) => map.set(n, impl || '?'));
      }
    }
  }
  return { supers, virt };
}

function topFunctionBody(src, name) {
  const re = new RegExp('(^|[\\n;}])function ' + name.replace(/\$/g, '\\$') + '\\(');
  const m = re.exec(src);
  if (!m) return null;
  const at = m.index + m[1].length;
  let i = src.indexOf('{', at), depth = 0, q = null;
  for (let p = i; p < src.length; p++) {
    const ch = src[p];
    if (q) { if (ch === '\\') { p++; continue; } if (ch === q) q = null; continue; }
    if (ch === '"' || ch === "'") { q = ch; continue; }
    if (ch === '{') depth++;
    else if (ch === '}') { depth--; if (depth === 0) return src.slice(at, p + 1); }
  }
  return null;
}
function hasTopLevel(src, name) {
  const n = name.replace(/\$/g, '\\$');
  return new RegExp('(^|[\\n;}])function ' + n + '\\(').test(src) || new RegExp('(^|[\\n;])\\s*(var|let) ' + n + '=').test(src) ||
    new RegExp('function\\((\\$rt_globals,)?' + n + '[,)]').test(src.slice(0, 2000));   // TeaVM module wrapper parameters
}

// ---------------------------------------------------------------------------------------------
// 3. Thunder source + manifest
// ---------------------------------------------------------------------------------------------
// A line "// @include name.js" inside thunder-client.js is replaced by that file (same folder), so
// larger subsystems (thunder-shaders.js) can live in their own file but share the client scope.
const includes = [];
const lineMap = [];   // line number in the assembled source -> "file:line"
const thunder = (function assemble() {
  const out = [];
  fs.readFileSync(SRC, 'utf8').split('\n').forEach((line, i) => {
    const inc = /^\s*\/\/ @include ([A-Za-z0-9_.-]+\.js)\s*$/.exec(line);
    if (!inc) { out.push(line); lineMap.push(path.basename(SRC) + ':' + (i + 1)); return; }
    const file = path.join(path.dirname(SRC), inc[1]);
    if (!fs.existsSync(file)) fail('@include ' + inc[1] + ': file not found');
    if (includes.indexOf(inc[1]) >= 0) fail('@include ' + inc[1] + ' appears twice');
    includes.push(inc[1]);
    fs.readFileSync(file, 'utf8').replace(/\n$/, '').split('\n').forEach((l, j) => {
      if (/^\s*\/\/ @include /.test(l)) fail('nested @include in ' + inc[1]);
      out.push(l); lineMap.push(inc[1] + ':' + (j + 1));
    });
  });
  return out.join('\n');
})();
function where(lines) { return lines.map((n) => lineMap[n - 1] || n).join(', '); }
if (thunder.indexOf(MARKER) !== 0) fail('thunder-client.js must start with the Thunder marker comment');
if (/[^\x00-\x7f]/.test(thunder)) fail('thunder-client.js must be ASCII only (use \\u escapes)');
const manifest = new Map();   // name -> {kind, target, extra}
const errors = [];
for (const line of thunder.split('\n')) {
  const m = /^\s*\*?\s*@(hook|use|static|staticset|clinit|class|new|field|virtual|runtime)\s+(\S+)\s+(\S+)(?:\s+(.*))?$/.exec(line);
  if (!m) continue;
  const [, kind, name, target, extra] = m;
  if (kind === 'field' || kind === 'virtual') {
    const key = (kind === 'field' ? '.' : '#') + name;
    if (!manifest.has(key)) manifest.set(key, []);
    manifest.get(key).push({ kind, name, target, extra });
    continue;
  }
  if (manifest.has(name)) errors.push('duplicate manifest entry ' + name);
  manifest.set(name, { kind, name, target, extra });
}
let virtuals = null;

function javaOf(js) { return names.methods.get(js); }
function jsOf(java) { return names.byJava.get(java) || []; }
for (const [name, e] of manifest) {
  if (name[0] === '#') {
    // @virtual vname java.Class javaMethod  -> vname resolves (walking supers) to Class-hierarchy javaMethod
    if (!virtuals) virtuals = decodeVirtuals(base);
    for (const v of e) {
      const want = v.extra && v.extra.split(/\s+/)[0];
      const owners = [];
      for (const [cls, map] of virtuals.virt) if (map.has(v.name)) owners.push([cls, map.get(v.name)]);
      if (!owners.length) { errors.push('@virtual ' + v.name + ' is not bound on any class in this base'); continue; }
      const bad = owners.filter(([, fn]) => { const j = javaOf(fn) || ''; return j.slice(j.lastIndexOf('.') + 1) !== want; });
      const onTarget = owners.some(([, fn]) => (javaOf(fn) || '').indexOf(v.target + '.') === 0);
      if (bad.length) errors.push('@virtual ' + v.name + ' is not always ' + want + ' (e.g. ' + bad.slice(0, 3).map(([c, f]) => c + ':' + (javaOf(f) || f)).join(', ') + ')');
      else if (!onTarget && v.target !== '*') errors.push('@virtual ' + v.name + ' has no implementation in ' + v.target);
    }
    continue;
  }
  if (name[0] === '.') {
    for (const f of e) {
      const js = jsOf(f.target);
      if (!js.length) { errors.push('@field ' + f.name + ': method ' + f.target + ' not in base'); continue; }
      const ok = js.some((j) => { const b = topFunctionBody(base, j); return b && b.indexOf('.' + f.name) >= 0; });
      if (!ok) errors.push('@field ' + f.name + ': not used inside ' + f.target + ' (' + js.join(',') + ')');
    }
    continue;
  }
  if (e.kind === 'hook' || e.kind === 'use') {
    const java = javaOf(name);
    if (java !== e.target) {
      const want = jsOf(e.target);
      errors.push('@' + e.kind + ' ' + name + ' is ' + (java || 'unknown') + ' in this base, expected ' + e.target + (want.length ? ' (this base names it ' + want.join(' / ') + ')' : ''));
    }
  } else if (e.kind === 'static') {
    const clinit = jsOf(e.target + '.<clinit>');
    const ok = clinit.some((j) => { const b = topFunctionBody(base, j); return b && new RegExp('[^A-Za-z0-9_$.]' + name.replace(/\$/g, '\\$') + '=').test(b); });
    if (!ok) errors.push('@static ' + name + ' is not assigned in ' + e.target + '.<clinit>');
  } else if (e.kind === 'staticset') {
    // a static field written by one specific (non-initializer) method, e.g. the WebGL context
    const js = jsOf(e.target);
    if (!js.length) errors.push('@staticset ' + name + ': method ' + e.target + ' not in base');
    else if (!js.some((j) => { const b = topFunctionBody(base, j); return b && new RegExp('[^A-Za-z0-9_$.]' + name.replace(/\$/g, '\\$') + '=(?!=)').test(b); })) {
      errors.push('@staticset ' + name + ' is not assigned in ' + e.target + ' (' + js.join(',') + ')');
    }
    if (!hasTopLevel(base, name)) errors.push('@staticset ' + name + ' is not a top-level variable in base');
  } else if (e.kind === 'clinit') {
    const clinit = jsOf(e.target + '.<clinit>');
    const b = topFunctionBody(base, name);
    if (!b || !clinit.some((j) => b.indexOf(j + '(') >= 0)) errors.push('@clinit ' + name + ' does not run ' + e.target + '.<clinit>');
  } else if (e.kind === 'new') {
    // TeaVM constructor factory: function F(..){var x=new Cls();Init(x,..);return x;}
    const b = topFunctionBody(base, name) || '';
    const mm = /\{var ([a-z$]+)=new ([A-Za-z0-9_$]+)\(\);([A-Za-z0-9_$]+)\(\1[,)]/.exec(b);
    if (!mm) errors.push('@new ' + name + ' is not a constructor factory');
    else if (names.classes.get(mm[2]) !== e.target || javaOf(mm[3]) !== e.target + '.<init>') {
      errors.push('@new ' + name + ' constructs ' + (names.classes.get(mm[2]) || mm[2]) + ' via ' + (javaOf(mm[3]) || mm[3]) + ', expected ' + e.target);
    }
  } else if (e.kind === 'class') {
    if (names.classes.get(name) !== e.target) errors.push('@class ' + name + ' is ' + (names.classes.get(name) || 'unknown') + ' in this base, expected ' + e.target);
  } else if (e.kind === 'runtime') {
    if (!hasTopLevel(base, name)) errors.push('@runtime ' + name + ' not found in base');
  }
}

// ---------------------------------------------------------------------------------------------
// 4. Free-variable analysis of the Thunder source
// ---------------------------------------------------------------------------------------------
const JS_GLOBALS = new Set(('undefined NaN Infinity Object Array String Number Boolean Math JSON Date Error TypeError RegExp ' +
  'isFinite isNaN parseFloat parseInt encodeURIComponent decodeURIComponent Symbol Promise Map Set WeakMap ' +
  'Uint8Array Uint8ClampedArray Int32Array Float32Array ArrayBuffer DataView Function console arguments').split(' '));
let ast;
try { ast = acorn.parse(thunder, { ecmaVersion: 5, sourceType: 'script', locations: true }); }
catch (e) { fail('thunder-client.js is not valid ES5: ' + e.message); }

const used = new Map(), assigned = new Map();
function walk(node, scope) {
  if (!node || typeof node.type !== 'string') return;
  switch (node.type) {
    case 'FunctionDeclaration':
    case 'FunctionExpression': {
      const inner = new Set(['arguments']);
      if (node.type === 'FunctionExpression' && node.id) inner.add(node.id.name);
      node.params.forEach((p) => inner.add(p.name));
      hoist(node.body, inner);
      const s = { vars: inner, parent: scope };
      node.body.body.forEach((st) => walk(st, s));
      return;
    }
    case 'CatchClause': {
      const s = { vars: new Set([node.param.name]), parent: scope };
      walk(node.body, s);
      return;
    }
    case 'VariableDeclarator': walk(node.init, scope); return;
    case 'MemberExpression': walk(node.object, scope); if (node.computed) walk(node.property, scope); return;
    case 'Property': if (node.computed) walk(node.key, scope); walk(node.value, scope); return;
    case 'LabeledStatement': walk(node.body, scope); return;
    case 'BreakStatement': case 'ContinueStatement': return;
    case 'AssignmentExpression':
      if (node.left.type === 'Identifier' && !resolves(node.left.name, scope)) note(assigned, node.left);
      walk(node.left, scope); walk(node.right, scope); return;
    case 'UpdateExpression':
      if (node.argument.type === 'Identifier' && !resolves(node.argument.name, scope)) note(assigned, node.argument);
      walk(node.argument, scope); return;
    case 'Identifier':
      if (!resolves(node.name, scope)) note(used, node);
      return;
  }
  for (const k of Object.keys(node)) {
    if (k === 'type' || k === 'loc' || k === 'start' || k === 'end') continue;
    const v = node[k];
    if (Array.isArray(v)) v.forEach((c) => walk(c, scope));
    else if (v && typeof v.type === 'string') walk(v, scope);
  }
}
function hoist(node, set) {
  if (!node || typeof node.type !== 'string') return;
  if (node.type === 'VariableDeclaration') node.declarations.forEach((d) => set.add(d.id.name));
  if (node.type === 'FunctionDeclaration') { set.add(node.id.name); return; }
  if (node.type === 'FunctionExpression') return;
  for (const k of Object.keys(node)) {
    const v = node[k];
    if (Array.isArray(v)) v.forEach((c) => hoist(c, set));
    else if (v && typeof v.type === 'string') hoist(v, set);
  }
}
function resolves(name, scope) { for (let s = scope; s; s = s.parent) if (s.vars.has(name)) return true; return false; }
function note(map, id) { if (!map.has(id.name)) map.set(id.name, []); map.get(id.name).push(id.loc.start.line); }
const top = new Set(); hoist(ast, top);
if (top.size) errors.push('thunder-client.js must not declare top-level names (wrap code in IIFEs): ' + [...top].join(', '));
ast.body.forEach((st) => walk(st, null));

for (const [name, lines] of used) {
  const decl = manifest.get(name);
  if (decl && !Array.isArray(decl)) continue;
  if (JS_GLOBALS.has(name)) continue;
  errors.push('undeclared global/game name "' + name + '" used at ' + where(lines));
}
const hooks = [];
for (const [name, lines] of assigned) {
  const e = manifest.get(name);
  if (!e || e.kind !== 'hook') errors.push('"' + name + '" is reassigned at ' + where(lines) + ' but is not declared @hook');
  else if (lines.length !== 1) errors.push('@hook ' + name + ' is installed ' + lines.length + ' times (' + where(lines) + '); exactly one wrapper is allowed');
  else hooks.push(name);
}
for (const [name, e] of manifest) {
  if (e.kind === 'hook' && !assigned.has(name)) errors.push('@hook ' + name + ' is declared but never installed');
  if (e.kind === 'hook' || e.kind === 'use') {
    const defs = base.match(new RegExp('(^|[\\n;}])function ' + name.replace(/\$/g, '\\$') + '\\(', 'g'));
    if (!defs || defs.length !== 1) errors.push('@' + e.kind + ' ' + name + ' is defined ' + (defs ? defs.length : 0) + ' times in the base (expected exactly 1)');
  }
}
if (errors.length) { errors.forEach((e) => console.error('  - ' + e)); fail(errors.length + ' verification error(s)'); }

// ---------------------------------------------------------------------------------------------
// 5. Assemble, re-check, write
// ---------------------------------------------------------------------------------------------
const block = thunder.endsWith('\n') ? thunder : thunder + '\n';
const out = base.slice(0, tailAt + 1) + block + base.slice(tailAt + 1);
if (out.slice(0, tailAt + 1) !== base.slice(0, tailAt + 1) || out.slice(tailAt + 1 + block.length) !== base.slice(tailAt + 1)) fail('assembly check failed');
if (out.split(MARKER).length !== 2) fail('output must contain exactly one Thunder block');
try { new vm.Script(out, { filename: 'classes.js' }); } catch (e) { fail('output does not parse: ' + e.message); }

console.log('thunder ' + path.relative(ROOT, SRC) + (includes.length ? ' + ' + includes.join(' + ') : '') + '  ' + block.length + ' bytes, ' + block.split('\n').length + ' lines');
console.log('hooks  ' + hooks.map((h) => h + '=' + (javaOf(h) || '?').replace(/^net\.minecraft\.|^net\.lax1dude\.eaglercraft\./, '')).join('  '));
console.log('uses   ' + [...manifest.values()].filter((e) => e.kind === 'use').length + ' game functions, ' +
  [...manifest.values()].filter((e) => e.kind === 'static' || e.kind === 'staticset').length + ' static fields, ' +
  [...manifest.values()].filter((e) => e.kind === 'class').length + ' classes, ' +
  [...manifest.values()].filter((e) => e.kind === 'new').length + ' constructors, ' +
  [...manifest.keys()].filter((k) => k[0] === '#').length + ' virtual methods, ' +
  [...manifest.keys()].filter((k) => k[0] === '.').length + ' instance fields - all verified');
if (CHECK_ONLY) { console.log('check  OK (nothing written)'); process.exit(0); }
fs.writeFileSync(OUT, out);
const outMd5 = md5(out);
console.log('wrote  ' + path.relative(ROOT, OUT) + '  ' + out.length + ' bytes  md5 ' + outMd5);

// Content-based cache busting: point the JS launcher at this exact classes.js so browsers
// (and the integrated-server worker, which loads the same URL) never run a stale copy.
const launcher = path.resolve(ROOT, 'index-js.html');
if (path.resolve(OUT) === path.resolve(ROOT, 'classes.js') && fs.existsSync(launcher)) {
  const html = fs.readFileSync(launcher, 'utf8');
  const stamped = html.replace(/classes\.js\?v=[A-Za-z0-9._-]+/g, 'classes.js?v=t6-' + outMd5.slice(0, 10));
  if (stamped !== html) { fs.writeFileSync(launcher, stamped); console.log('stamp  index-js.html -> classes.js?v=t6-' + outMd5.slice(0, 10)); }
}
