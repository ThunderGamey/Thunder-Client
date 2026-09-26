#!/usr/bin/env node
/*
 * node thunder/pack-doctor-cli.js <pack.zip> [fixed.zip]
 * Prints what is wrong with a resource pack and, if a second path is given, writes the repaired
 * pack there. Same logic as thunder-pack-doctor.html.
 */
'use strict';
const fs = require('fs');
const zlib = require('zlib');
const doctor = require('./pack-doctor.js');

const [input, output] = process.argv.slice(2);
if (!input) { console.error('usage: node thunder/pack-doctor-cli.js <pack.zip> [fixed.zip]'); process.exit(2); }
const io = {
  inflateRaw: (b) => Promise.resolve(new Uint8Array(zlib.inflateRawSync(b))),
  deflateRaw: (b) => Promise.resolve(new Uint8Array(zlib.deflateRawSync(b, { level: 9 })))
};
doctor.repair(new Uint8Array(fs.readFileSync(input)), io).then((res) => {
  const tag = { fix: 'FIXED', warn: 'CHECK', info: 'info ' };
  for (const r of res.report) console.log(tag[r.level] + '  ' + (r.path ? r.path + ': ' : '') + r.message);
  if (output) {
    fs.writeFileSync(output, res.zip);
    console.log('\nwrote ' + output + ' (' + res.zip.length + ' bytes)' + (res.changed ? '' : ' - nothing needed fixing'));
  }
}).catch((e) => { console.error('error: ' + e.message); process.exit(1); });
