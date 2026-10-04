#!/usr/bin/env node
/*
 * Thunder Client offline file: the whole client in one HTML file that runs from a folder on the
 * computer (Downloads), for when the website is blocked, and keeps itself up to date from GitHub.
 * Part of Thunder Client, created and owned by Jayvardhan Ginni (ThunderGamey).
 *
 *   node thunder/offline.js [--out <file>]      (default: thunder-offline.html, not committed)
 *
 * It packs the site as it is committed: index-js.html (the page and the Thunder loading screen),
 * thunder_ambient.js, classes.js, assets.epk, lang/en_us.lang, the built-in packs (packs/) and
 * favicon.png. The big files go in as base64 blocks at the end of the page (nothing in them can
 * end a <script> early). A small loader (below) then:
 *   - serves the files the game and Thunder ask for (assets.epk, lang/..., packs/...) from the
 *     file itself, because a page opened from a folder cannot read the files next to it;
 *   - starts the game from the newest copy it has: the one in the file, or an update it
 *     downloaded on an earlier start (kept in this browser's IndexedDB). The game code runs as an
 *     inline script, which is what the game needs to start its singleplayer worker from a file;
 *   - a little after the game is up, reads thunder-version.json from GitHub (raw.githubusercontent
 *     first, then cdn.jsdelivr.net) and, when its number is higher, downloads that classes.js
 *     (checked against its size and SHA-256) and the packs, for the next start;
 *   - falls back to the copy in the file if an update did not start twice.
 * The game itself (index-js.html, classes.js, assets) is not changed; the website keeps working
 * as before. Thunder's relay, its TURN logins and Thunder Friends live on the website: the file
 * tells the game its address (window.thunderSite), and the game uses them wherever the website
 * can be reached (it lets the file in: a page opened from a folder sends Origin "null"). Where
 * it is blocked, joining friends' worlds by code still works through the public Eaglercraft
 * relays.
 */
'use strict';
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ROOT = path.resolve(__dirname, '..');
const args = process.argv.slice(2);
const oi = args.indexOf('--out');
const OUT = path.resolve(ROOT, oi >= 0 && args[oi + 1] ? args[oi + 1] : 'thunder-offline.html');
const REPO = 'ThunderGamey/Thunder-Client';
// (tests: THUNDER_OFFLINE_SOURCES=url,url instead)
const SOURCES = process.env.THUNDER_OFFLINE_SOURCES ? process.env.THUNDER_OFFLINE_SOURCES.split(',') : [
  'https://raw.githubusercontent.com/' + REPO + '/main/',
  'https://cdn.jsdelivr.net/gh/' + REPO + '@main/'
];
// the website (tests: THUNDER_OFFLINE_SITE=url instead)
const SITE = process.env.THUNDER_OFFLINE_SITE || 'https://thunderclient.pages.dev/';
if (!/^https?:\/\/[^/]+\/$/.test(SITE)) throw new Error('offline: the site address must look like https://host/');

function read(f) { return fs.readFileSync(path.resolve(ROOT, f)); }
function sha(b) { return crypto.createHash('sha256').update(b).digest('hex'); }
function once(s, find, rep, what) {
  const n = s.split(find).length - 1;
  if (n !== 1) throw new Error('offline: expected one "' + what + '" in index-js.html, found ' + n);
  return s.replace(find, () => rep);
}

const html0 = read('index-js.html').toString('utf8');
const classes = read('classes.js');
const ambient = read('thunder_ambient.js').toString('utf8');
const ver = JSON.parse(read('thunder-version.json').toString('utf8'));
const stamp = (/classes\.js\?v=([A-Za-z0-9._-]+)/.exec(html0) || [])[1] || '';
if (stamp !== ver.classes || sha(classes) !== ver.sha256) throw new Error('offline: classes.js, index-js.html and thunder-version.json do not match; run node thunder/build.js first');
if (/<\/script/i.test(ambient) || /<!--/.test(ambient)) throw new Error('offline: thunder_ambient.js cannot be inlined as it is');

// the files served from the page itself (paths as the game and Thunder ask for them)
const packsList = JSON.parse(read('packs/packs.json').toString('utf8'));
const files = [
  ['assets.epk', read('assets.epk'), 'application/octet-stream'],
  ['lang/en_us.lang', read('lang/en_us.lang'), 'text/plain'],
  ['packs/packs.json', read('packs/packs.json'), 'application/json']
];
for (const p of packsList.packs) files.push(['packs/' + p.file, read('packs/' + p.file), 'application/zip']);

const EMB = { seq: ver.seq, classes: ver.classes, packs: ver.packs, built: new Date().toISOString().slice(0, 10) };

const LOADER = fs.readFileSync(path.resolve(__dirname, 'offline-loader.js'), 'utf8');
const loader = LOADER
  .replace('__EMB__', JSON.stringify(EMB))
  .replace('__SOURCES__', JSON.stringify(SOURCES))
  .replace('__SITE__', () => JSON.stringify(SITE))
  .replace('__FILES__', JSON.stringify(files.map((f) => ({ path: f[0], type: f[2] }))));

let html = html0;
// the page sounds, inline
html = html.replace(/<script type="text\/javascript" src="thunder_ambient\.js\?v=[A-Za-z0-9._-]+"><\/script>/,
  () => '<script type="text/javascript">\n' + ambient + '\n</script>');
if (/src="thunder_ambient\.js/.test(html)) throw new Error('offline: thunder_ambient.js tag not found');
// the game: started by the loader instead of a script tag
html = html.replace(/<script type="text\/javascript" src="classes\.js\?v=[A-Za-z0-9._-]+" defer><\/script>/,
  () => '<script type="text/javascript">\n' + loader + '\n</script>');
if (/src="classes\.js/.test(html)) throw new Error('offline: classes.js tag not found');
// the launch code: allowed from a folder, and it waits for the loader before starting the game
html = once(html, 'if(window.location.href.indexOf("file:") === 0) {', 'if(false) {', 'file: check');
html = once(html, '\t\t\t\t\tmain();\n', '\t\t\t\t\twindow.__thunderReady(function() { window.eaglercraftXOpts.assetsURI = window.__thunderAssets; main(); });\n', 'main()');
html = once(html, 'href="favicon.png"', 'href="data:image/png;base64,' + read('favicon.png').toString('base64') + '"', 'favicon');
// the packed files, at the end so the loading screen shows while the rest is read
let blocks = '\n<script type="application/octet-stream" id="tc-file-classes.js">' + classes.toString('base64') + '</script>\n';
for (const f of files) blocks += '<script type="application/octet-stream" id="tc-file-' + f[0] + '">' + f[1].toString('base64') + '</script>\n';
html = once(html, '</body>', blocks + '</body>', '</body>');

fs.writeFileSync(OUT, html);
console.log('wrote  ' + path.relative(ROOT, OUT) + '  ' + Buffer.byteLength(html) + ' bytes  (Thunder ' + ver.seq + ', ' + ver.classes + ')');
