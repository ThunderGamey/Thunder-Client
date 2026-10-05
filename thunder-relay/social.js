// Thunder Client friends hub (Right Shift > Friends > Thunder Friends): friends, who is online,
// friend requests, messages and world invites. One Durable Object for everyone ("hub").
// Part of Thunder Client, created and owned by Jayvardhan Ginni (ThunderGamey).
//
// Devices: every Thunder install makes a secret key in the browser (kept in its localStorage).
// A device is known here by a hash of that key (24 hex characters). The key itself is never
// stored. The client opens wss://<site>/social?id=<device id> and says hello with the key; the
// hub checks that the key hashes to that id.
//
// Accounts: nobody uses Thunder Friends without one. An account is a name (3 to 16 letters,
// numbers or _, one account per name, whatever the capitals) and a password, like the logins of
// Eaglercraft servers. The password never reaches the hub: the browser turns it into a key first
// (PBKDF2-SHA256, 100000 rounds, salted with the name) and the hub keeps a salted SHA-256 of that
// key. A device that registers or logs in is linked to the account (table dev) and stays signed
// in until it logs out, or until the password is changed on another device. After 8 wrong
// passwords a name waits 15 minutes, and wrong passwords and new accounts are also limited per
// network address. An account is shown as its name and a 4-digit tag from its id (Steve#0427);
// a device that had Thunder Friends before accounts keeps its friends when it registers (the
// account takes the device's id). There is no password reset (the hub has no email for anyone).
//
// Safety: messages and invites only go between two players who both accepted each other as
// friends. Anyone can send a friend request (by Name#tag or from the Online list); a player who
// was told no cannot ask again for 7 days, and blocking stops requests, messages and seeing each
// other online. Players can leave the Online list. Text is plain text (the client shows it as
// text, never as HTML), at most 300 characters. Every connection is rate limited, and so is every
// network address (new connections and friend requests; the address is kept only as a hash, in
// memory). Only the site's own pages and the offline file can connect (relay.js checks Origin).
// Messages to a friend who is offline wait here (at most 100 per player, 30 days) until they come
// online and are deleted once delivered.
//
// Protocol (JSON text frames; "ping" is answered "pong" without waking the object):
//   client -> hub: hello {key, name, hide, share, s}, then (a device not signed in, told "auth")
//     register {name, pw} | login {name, pw}; signed in: passwd {old, pw} | logout
//     | status {s} | hide {v} | share {v}
//     | online | add {who} | accept {id} | decline {id} | cancel {id} | remove {id} | block {id}
//     | unblock {id} | msg {to, text, id} | invite {to, code} | ack {n}
//   s (what a player is doing): {w: menu | sp | server (server) | join (host: whose world)
//     | host (code, or lock: friends need the code; players: who joined)}
//   hub -> client: auth | welcome | pwok | presence | request | friend | unfriend | reqgone
//     | blocked | online | added | msg | msgout | sent | invite | err
//   a friend (welcome, presence, friend): {id, name, tag, online, s, seen (offline: when they were
//     last online)}

const MAX_FRAME = 4096;          // bytes in one message from a client
const MAX_TEXT = 300;            // characters in a chat message
const MAX_FRIENDS = 300;
const MAX_OUT = 30;              // friend requests one player has waiting
const MAX_IN = 100;              // friend requests waiting for one player
const MAX_MAIL = 100;            // messages waiting for one offline player
const MAIL_DAYS = 30;
const NO_DAYS = 7;               // after a "no", the same player cannot ask again for this long
const MAX_SOCKS = 4;             // open tabs per player
const ONLINE_MAX = 200;
const IP_SPAN = 600000;          // per network address (as a hash, in memory only), per 10 minutes:
const IP_CONNS = 120;            //   new connections
const IP_ADDS = 60;              //   friend requests (a school network is many players on one address)
const IP_REGS = 30;              //   new accounts
const IP_FAILS = 40;             //   wrong passwords
const MAX_FAILS = 8;             // wrong passwords for one name before it waits LOCK_MS
const LOCK_MS = 900000;
const NAME_RE = /^[A-Za-z0-9_]{1,16}$/;
const ACCT_RE = /^[A-Za-z0-9_]{3,16}$/;     // an account's name
const KEY_RE = /^[0-9a-f]{64}$/;
const CODE_RE = /^[a-z0-9]{5,6}$/;
const ID_RE = /^[0-9a-f]{24}$/;
const WHAT = ['menu', 'sp', 'host', 'join', 'server'];

function hex(buf) { return Array.from(new Uint8Array(buf)).map((x) => x.toString(16).padStart(2, '0')).join(''); }
export async function socialId(key) {
  return hex(await crypto.subtle.digest('SHA-256', new TextEncoder().encode('thunder-social:' + key))).slice(0, 24);
}
function tagOf(id) { return String(parseInt(id.slice(0, 8), 16) % 10000).padStart(4, '0'); }
function cleanText(t) {
  return String(t == null ? '' : t).replace(/[\u0000-\u001f\u007f-\u009f\u2028\u2029]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, MAX_TEXT);
}
function cleanStatus(s) {
  if (!s || typeof s !== 'object' || WHAT.indexOf(s.w) < 0) return null;
  const o = { w: s.w };
  if (s.w === 'host') {
    // a world whose host wants friends to need the code: the code is not sent here at all
    if (s.lock === true) o.lock = true;
    else if (CODE_RE.test(String(s.code || ''))) o.code = String(s.code);
    const p = Array.isArray(s.players) ? s.players.filter((n) => typeof n === 'string' && NAME_RE.test(n)).slice(0, 16) : [];
    if (p.length) o.players = p;
  }
  if (s.w === 'join' && NAME_RE.test(String(s.host || ''))) o.host = String(s.host);
  if (s.w === 'server') o.server = String(s.server || '').replace(/[^A-Za-z0-9.:_\-\/]/g, '').slice(0, 80);
  return o;
}
// what is kept of a password: SHA-256 of a random salt and the key the browser made from it
async function pwHash(salt, pw) { return hex(await crypto.subtle.digest('SHA-256', new TextEncoder().encode('thunder-pw:' + salt + ':' + pw))); }
function same(x, y) {
  if (typeof x !== 'string' || typeof y !== 'string' || x.length !== y.length) return false;
  let d = 0;
  for (let i = 0; i < x.length; i++) d |= x.charCodeAt(i) ^ y.charCodeAt(i);
  return d === 0;
}
function msgId(m) { return Number.isFinite(m.id) ? m.id : undefined; }   // the client's number for a message, sent back
function sendTo(ws, obj) { try { ws.send(JSON.stringify(obj)); } catch (e) { /* closed */ } }

export class ThunderSocial {
  constructor(ctx, env) {
    this.ctx = ctx;
    this.env = env;
    this.sql = ctx.storage.sql;
    this.rate = new WeakMap();
    this.ips = new Map();              // address hash -> {t, conns, adds}
    this.schema();
    try { ctx.setWebSocketAutoResponse(new WebSocketRequestResponsePair('ping', 'pong')); } catch (e) { /* older runtime */ }
  }

  schema() {
    const q = (s) => this.sql.exec(s);
    q('CREATE TABLE IF NOT EXISTS acct (id TEXT PRIMARY KEY, name TEXT NOT NULL, lname TEXT NOT NULL, tag TEXT NOT NULL, seen INTEGER NOT NULL, hidden INTEGER NOT NULL DEFAULT 0)');
    q('CREATE INDEX IF NOT EXISTS acct_name ON acct (lname, tag)');
    q('CREATE TABLE IF NOT EXISTS friend (a TEXT NOT NULL, b TEXT NOT NULL, since INTEGER NOT NULL, PRIMARY KEY (a, b))');
    q('CREATE TABLE IF NOT EXISTS req (frm TEXT NOT NULL, too TEXT NOT NULL, at INTEGER NOT NULL, PRIMARY KEY (frm, too))');
    q('CREATE INDEX IF NOT EXISTS req_too ON req (too)');
    q('CREATE TABLE IF NOT EXISTS block (a TEXT NOT NULL, b TEXT NOT NULL, PRIMARY KEY (a, b))');
    q('CREATE TABLE IF NOT EXISTS mail (n INTEGER PRIMARY KEY AUTOINCREMENT, too TEXT NOT NULL, frm TEXT NOT NULL, text TEXT NOT NULL, at INTEGER NOT NULL)');
    q('CREATE INDEX IF NOT EXISTS mail_too ON mail (too)');
    q('CREATE TABLE IF NOT EXISTS nope (frm TEXT NOT NULL, too TEXT NOT NULL, at INTEGER NOT NULL, PRIMARY KEY (frm, too))');
    // accounts: the name (lower case, one account each) and its password; the devices signed in to each
    q('CREATE TABLE IF NOT EXISTS claim (lname TEXT PRIMARY KEY, aid TEXT NOT NULL UNIQUE, name TEXT NOT NULL, salt TEXT NOT NULL, hash TEXT NOT NULL, at INTEGER NOT NULL, fails INTEGER NOT NULL DEFAULT 0, failat INTEGER NOT NULL DEFAULT 0)');
    q('CREATE TABLE IF NOT EXISTS dev (did TEXT PRIMARY KEY, aid TEXT NOT NULL, at INTEGER NOT NULL)');
    q('CREATE INDEX IF NOT EXISTS dev_aid ON dev (aid)');
  }
  rows(s, ...b) { return this.sql.exec(s, ...b).toArray(); }
  one(s, ...b) { const r = this.rows(s, ...b); return r.length ? r[0] : null; }

  // ---- sockets ----
  async fetch(request) {
    if ((request.headers.get('Upgrade') || '').toLowerCase() !== 'websocket') return new Response('websocket only', { status: 426 });
    const claim = new URL(request.url).searchParams.get('id') || '';
    if (!ID_RE.test(claim)) return new Response('bad id', { status: 400 });
    const ip = request.headers.get('CF-Connecting-IP') || '';
    const iph = ip ? hex(await crypto.subtle.digest('SHA-256', new TextEncoder().encode('thunder-ip:' + ip))).slice(0, 16) : '';
    if (iph && !this.ipAllow(iph, 'conns', IP_CONNS)) return new Response('too many connections, try again in a few minutes', { status: 429 });
    const pair = new WebSocketPair();
    this.ctx.acceptWebSocket(pair[1], ['d:' + claim]);
    pair[1].serializeAttachment({ claim, id: null, iph });
    return new Response(null, { status: 101, webSocket: pair[0] });
  }
  // counts per network address; forgotten after IP_SPAN (and whenever the object sleeps)
  ipAllow(iph, k, max) {
    const now = Date.now();
    let e = this.ips.get(iph);
    if (!e || now - e.t > IP_SPAN) {
      if (this.ips.size > 5000) for (const [h, x] of this.ips) if (now - x.t > IP_SPAN) this.ips.delete(h);
      e = { t: now, conns: 0, adds: 0, regs: 0, fails: 0 };
      this.ips.set(iph, e);
    }
    return ++e[k] <= max;
  }
  // the signed-in sockets of an account (its devices and tabs); the index is made once per event
  // and dropped whenever a socket signs in or out
  socks(id, except) {
    if (!this.idx) {
      this.idx = new Map();
      for (const ws of this.ctx.getWebSockets()) {
        const x = ws.deserializeAttachment();
        if (x && x.id) { const l = this.idx.get(x.id); if (l) l.push(ws); else this.idx.set(x.id, [ws]); }
      }
    }
    return (this.idx.get(id) || []).filter((ws) => ws !== except);
  }
  push(id, obj, except) { for (const ws of this.socks(id, except)) sendTo(ws, obj); }
  online(id) { return this.socks(id).length > 0; }
  // what friends see of a player: name, tag, online and (if they share it) what they are doing;
  // offline, when they were last online
  card(id, acct) {
    const a = acct || this.one('SELECT id, name, tag, seen FROM acct WHERE id = ?', id);
    if (!a) return null;
    const s = this.socks(id);
    let st = null;
    for (const ws of s) { const at = ws.deserializeAttachment(); if (at && at.share !== false && at.s) st = at.s; }
    const c = { id, name: a.name, tag: a.tag, online: s.length > 0, s: st };
    if (!c.online && a.seen) c.seen = a.seen;
    return c;
  }
  friendsOf(id) { return this.rows('SELECT b FROM friend WHERE a = ?', id).map((r) => r.b); }
  tellFriends(id) {
    const c = this.card(id);
    if (!c) return;
    for (const f of this.friendsOf(id)) this.push(f, Object.assign({ t: 'presence' }, c));
  }
  isFriend(a, b) { return !!this.one('SELECT 1 AS x FROM friend WHERE a = ? AND b = ?', a, b); }
  blocked(a, b) { return !!this.one('SELECT 1 AS x FROM block WHERE (a = ? AND b = ?) OR (a = ? AND b = ?)', a, b, b, a); }

  allow(ws, t) {
    const now = Date.now();
    let r = this.rate.get(ws);
    if (!r || now - r.t > 10000) { r = { t: now, n: 0, m: 0 }; this.rate.set(ws, r); }
    r.n++;
    if (t === 'msg' || t === 'invite' || t === 'add' || t === 'register' || t === 'login' || t === 'passwd') r.m++;
    if (r.n > 120) { try { ws.close(1008, 'too many messages'); } catch (e) { /* closed */ } return false; }
    return r.n <= 40 && r.m <= 12;
  }

  async webSocketMessage(ws, msg) {
    this.idx = null;
    if (typeof msg !== 'string' || msg.length > MAX_FRAME) return this.bye(ws, 'bad message');
    let m;
    try { m = JSON.parse(msg); } catch (e) { return this.bye(ws, 'bad message'); }
    if (!m || typeof m !== 'object' || typeof m.t !== 'string') return;
    const a = ws.deserializeAttachment() || {};
    if (!a.id) {
      if (m.t === 'hello' && !a.did) return this.hello(ws, a, m);
      // a device that said hello but is not signed in: only an account's name and password
      if (a.did && (m.t === 'register' || m.t === 'login')) {
        if (!this.allow(ws, m.t)) return sendTo(ws, { t: 'err', op: 'auth', why: 'Slow down a little.' });
        return m.t === 'register' ? this.register(ws, a, m) : this.login(ws, a, m);
      }
      return this.bye(ws, 'say hello first');
    }
    // (a refused message, invite or request says which one, so the client can mark it)
    if (!this.allow(ws, m.t)) return sendTo(ws, { t: 'err', why: 'Slow down a little.', op: ['msg', 'invite', 'add'].includes(m.t) ? m.t : undefined, to: ID_RE.test(String(m.to || '')) ? m.to : undefined, id: msgId(m) });
    const me = a.id;
    switch (m.t) {
      case 'status': return this.status(ws, a, m);
      case 'name': return;                 // (an account keeps its name)
      case 'passwd': return this.passwd(ws, a, m);
      case 'logout': return this.logout(ws, a);
      case 'hide': return this.setFlag(ws, a, 'hidden', !!m.v);
      case 'share': return this.setFlag(ws, a, 'share', m.v !== false);
      case 'online': return this.onlineList(ws, me);
      case 'add': return this.add(ws, me, m);
      case 'accept': return this.accept(ws, me, String(m.id || ''));
      case 'decline': return this.decline(me, String(m.id || ''));
      case 'cancel': return this.dropReq(me, String(m.id || ''));
      case 'remove': return this.unfriend(me, String(m.id || ''));
      case 'block': return this.block(ws, me, String(m.id || ''));
      case 'unblock': return this.unblock(ws, me, String(m.id || ''));
      case 'msg': return this.message(ws, a, m);
      case 'invite': return this.invite(ws, a, m);
      case 'ack': {
        const n = Number(m.n);
        if (Number.isFinite(n)) this.sql.exec('DELETE FROM mail WHERE too = ? AND n <= ?', me, n);
        return;
      }
      default: return;
    }
  }
  bye(ws, why) { sendTo(ws, { t: 'err', why, fatal: true }); try { ws.close(1008, why); } catch (e) { /* closed */ } }

  async hello(ws, a, m) {
    const key = String(m.key || '');
    if (!KEY_RE.test(key)) return this.bye(ws, 'bad key');
    const did = await socialId(key);
    if (did !== a.claim) return this.bye(ws, 'wrong key');
    a.did = did;
    a.hi = { hide: !!m.hide, share: m.share !== false, s: cleanStatus(m.s) };    // for when it signs in
    const d = this.one('SELECT aid FROM dev WHERE did = ?', did);
    if (d) return this.signIn(ws, a, d.aid);
    // this device's own account was signed out here (a new password, or it logged out): it makes a
    // new device key and logs in again
    if (this.one('SELECT 1 AS x FROM claim WHERE aid = ?', did)) return this.bye(ws, 'signed out');
    this.keep(ws, a);
    const name = String(m.name || ''), ok = ACCT_RE.test(name);
    const taken = ok ? this.one('SELECT name FROM claim WHERE lname = ?', name.toLowerCase()) : null;
    // (old: this device used Thunder Friends before accounts; registering keeps its friends)
    sendTo(ws, { t: 'auth', name: ok ? name : '', taken: !!taken, old: !!this.one('SELECT 1 AS x FROM acct WHERE id = ?', did) });
  }
  keep(ws, a) { this.idx = null; try { ws.serializeAttachment(a); } catch (e) { /* closed */ } }

  signIn(ws, a, aid) {
    const c = this.one('SELECT name FROM claim WHERE aid = ?', aid);
    if (!c) return this.bye(ws, 'signed out');
    const name = c.name, tag = tagOf(aid), now = Date.now(), hi = a.hi || {}, hidden = hi.hide ? 1 : 0;
    this.sql.exec('INSERT INTO acct (id, name, lname, tag, seen, hidden) VALUES (?, ?, ?, ?, ?, ?) ' +
      'ON CONFLICT(id) DO UPDATE SET name = excluded.name, lname = excluded.lname, seen = excluded.seen, hidden = excluded.hidden',
      aid, name, name.toLowerCase(), tag, now, hidden);
    // at most MAX_SOCKS tabs and devices at once: the oldest ones are closed
    const mine = this.socks(aid).sort((p, q) => ((p.deserializeAttachment() || {}).since || 0) - ((q.deserializeAttachment() || {}).since || 0));
    for (let i = 0; i <= mine.length - MAX_SOCKS; i++) this.bye(mine[i], 'opened in another tab');
    const wasOnline = mine.length > 0;
    this.keep(ws, { claim: a.claim, did: a.did, iph: a.iph || '', id: aid, name, tag, hidden: !!hidden, share: hi.share !== false, s: hi.s || null, since: now });
    this.sql.exec('UPDATE dev SET at = ? WHERE did = ?', now, a.did);
    this.sql.exec('DELETE FROM mail WHERE too = ? AND at < ?', aid, now - MAIL_DAYS * 86400000);
    const friends = this.rows('SELECT a.id, a.name, a.tag, a.seen FROM friend f JOIN acct a ON a.id = f.b WHERE f.a = ?', aid).map((r) => this.card(r.id, r));
    const reqIn = this.rows('SELECT a.id, a.name, a.tag, r.at FROM req r JOIN acct a ON a.id = r.frm WHERE r.too = ? ORDER BY r.at', aid);
    const reqOut = this.rows('SELECT a.id, a.name, a.tag, r.at FROM req r JOIN acct a ON a.id = r.too WHERE r.frm = ? ORDER BY r.at', aid);
    const blocked = this.rows('SELECT a.id, a.name, a.tag FROM block b JOIN acct a ON a.id = b.b WHERE b.a = ?', aid);
    const mail = this.rows('SELECT m.n, m.frm AS id, a.name, a.tag, m.text, m.at FROM mail m LEFT JOIN acct a ON a.id = m.frm WHERE m.too = ? ORDER BY m.n LIMIT 200', aid)
      .map((r) => ({ n: r.n, from: { id: r.id, name: r.name || 'Player', tag: r.tag || '0000' }, text: r.text, at: r.at }));
    sendTo(ws, { t: 'welcome', me: { id: aid, name, tag, hidden: !!hidden }, friends, reqIn, reqOut, blocked, mail, now });
    if (!wasOnline || hi.s) this.tellFriends(aid);
  }

  // a new account with this device's name and password (the account takes the device's id)
  async register(ws, a, m) {
    const name = String(m.name || ''), lname = name.toLowerCase(), pw = String(m.pw || '');
    const err = (why) => sendTo(ws, { t: 'err', op: 'auth', why });
    if (!ACCT_RE.test(name)) return err('A name is 3 to 16 letters, numbers or _.');
    if (!KEY_RE.test(pw)) return err('That password did not arrive right. Try again.');
    if (this.one('SELECT 1 AS x FROM claim WHERE lname = ?', lname)) return err(name + ' is taken. If it is yours, log in.');
    if (a.iph && !this.ipAllow(a.iph, 'regs', IP_REGS)) return err('Too many new accounts from your network. Try again later.');
    const salt = hex(crypto.getRandomValues(new Uint8Array(16))), hash = await pwHash(salt, pw), now = Date.now();
    // (checked again after the wait: another device may have taken the name, or this one signed in)
    if ((ws.deserializeAttachment() || {}).id) return;
    if (this.one('SELECT 1 AS x FROM claim WHERE lname = ?', lname)) return err(name + ' is taken. If it is yours, log in.');
    if (this.one('SELECT 1 AS x FROM claim WHERE aid = ?', a.did)) return this.bye(ws, 'signed out');
    this.sql.exec('INSERT INTO claim (lname, aid, name, salt, hash, at) VALUES (?, ?, ?, ?, ?, ?)', lname, a.did, name, salt, hash, now);
    this.sql.exec('INSERT OR REPLACE INTO dev (did, aid, at) VALUES (?, ?, ?)', a.did, a.did, now);
    return this.signIn(ws, a, a.did);
  }
  // an account's name and password: this device is signed in to it from now on
  async login(ws, a, m) {
    const lname = String(m.name || '').toLowerCase(), pw = String(m.pw || '');
    const err = (why) => sendTo(ws, { t: 'err', op: 'auth', why });
    if (!ACCT_RE.test(lname) || !KEY_RE.test(pw)) return err('Wrong name or password.');
    const c = this.one('SELECT * FROM claim WHERE lname = ?', lname);
    if (!c) return err('No account is called ' + String(m.name) + '.');
    const now = Date.now(), left = LOCK_MS - (now - c.failat);
    if (c.fails >= MAX_FAILS && left > 0) return err('Too many wrong passwords for ' + c.name + '. Try again in ' + Math.ceil(left / 60000) + ' min.');
    if (a.iph) { const e = this.ips.get(a.iph); if (e && Date.now() - e.t <= IP_SPAN && e.fails >= IP_FAILS) return err('Too many wrong passwords from your network. Try again in a few minutes.'); }
    const h = await pwHash(c.salt, pw);
    if ((ws.deserializeAttachment() || {}).id) return;
    const c2 = this.one('SELECT * FROM claim WHERE lname = ?', lname);
    if (!c2 || !same(h, c2.hash)) {
      if (!c2) return err('Wrong name or password.');
      const f = (now - c2.failat < LOCK_MS ? c2.fails : 0) + 1;
      this.sql.exec('UPDATE claim SET fails = ?, failat = ? WHERE lname = ?', f, now, lname);
      if (a.iph) this.ipAllow(a.iph, 'fails', IP_FAILS);
      return err('Wrong password for ' + c2.name + '.' + (f >= MAX_FAILS - 3 && f < MAX_FAILS ? ' ' + (MAX_FAILS - f) + ' more tries before a 15-minute wait.' : f >= MAX_FAILS ? ' Try again in 15 min.' : ''));
    }
    this.sql.exec('UPDATE claim SET fails = 0, failat = 0 WHERE lname = ?', lname);
    this.sql.exec('INSERT OR REPLACE INTO dev (did, aid, at) VALUES (?, ?, ?)', a.did, c2.aid, now);
    return this.signIn(ws, a, c2.aid);
  }
  // a new password (with the old one): every other device of the account is signed out
  async passwd(ws, a, m) {
    const old = String(m.old || ''), pw = String(m.pw || '');
    const err = (why) => sendTo(ws, { t: 'err', op: 'passwd', why });
    if (!KEY_RE.test(old) || !KEY_RE.test(pw)) return err('That password did not arrive right. Try again.');
    const c = this.one('SELECT * FROM claim WHERE aid = ?', a.id);
    if (!c) return this.bye(ws, 'signed out');
    const now = Date.now(), left = LOCK_MS - (now - c.failat);
    if (c.fails >= MAX_FAILS && left > 0) return err('Too many wrong passwords. Try again in ' + Math.ceil(left / 60000) + ' min.');
    const h = await pwHash(c.salt, old), salt = hex(crypto.getRandomValues(new Uint8Array(16))), hash = await pwHash(salt, pw);
    const c2 = this.one('SELECT * FROM claim WHERE aid = ?', a.id);
    if (!c2) return this.bye(ws, 'signed out');
    if (!same(h, c2.hash)) {
      const f = (now - c2.failat < LOCK_MS ? c2.fails : 0) + 1;
      this.sql.exec('UPDATE claim SET fails = ?, failat = ? WHERE aid = ?', f, now, a.id);
      return err('The old password is wrong.');
    }
    this.sql.exec('UPDATE claim SET salt = ?, hash = ?, fails = 0, failat = 0 WHERE aid = ?', salt, hash, a.id);
    this.sql.exec('DELETE FROM dev WHERE aid = ? AND did <> ?', a.id, a.did);
    for (const s of this.socks(a.id)) { const x = s.deserializeAttachment() || {}; if (x.did !== a.did) this.bye(s, 'signed out'); }
    sendTo(ws, { t: 'pwok' });
  }
  // this device (all its tabs) signs out of the account
  logout(ws, a) {
    this.sql.exec('DELETE FROM dev WHERE did = ?', a.did);
    for (const s of this.socks(a.id)) { const x = s.deserializeAttachment() || {}; if (x.did === a.did) this.bye(s, 'logged out'); }
  }

  status(ws, a, m) {
    const s = cleanStatus(m.s);
    if (JSON.stringify(s) === JSON.stringify(a.s || null)) return;
    a.s = s;
    this.keep(ws, a);
    if (a.share !== false) this.tellFriends(a.id);
  }
  setFlag(ws, a, k, v) {
    for (const s of this.socks(a.id)) { const x = s.deserializeAttachment(); x[k] = v; this.keep(s, x); }
    if (k === 'hidden') this.sql.exec('UPDATE acct SET hidden = ? WHERE id = ?', v ? 1 : 0, a.id);
    if (k === 'share') this.tellFriends(a.id);
  }

  onlineList(ws, me) {
    const seen = new Set(), list = [];
    const friends = new Set(this.friendsOf(me));
    const out = new Set(this.rows('SELECT too FROM req WHERE frm = ?', me).map((r) => r.too));
    const inc = new Set(this.rows('SELECT frm FROM req WHERE too = ?', me).map((r) => r.frm));
    const blk = new Set(this.rows('SELECT b FROM block WHERE a = ? UNION SELECT a FROM block WHERE b = ?', me, me).map((r) => r.b));
    let total = 0;
    for (const s of this.ctx.getWebSockets()) {
      const x = s.deserializeAttachment();
      if (!x || !x.id || seen.has(x.id)) continue;
      seen.add(x.id);
      if (x.id === me) continue;
      total++;
      if (x.hidden || blk.has(x.id) || list.length >= ONLINE_MAX) continue;
      list.push({ id: x.id, name: x.name, tag: x.tag, friend: friends.has(x.id), req: out.has(x.id) ? 'out' : inc.has(x.id) ? 'in' : null });
    }
    list.sort((p, q) => (q.friend - p.friend) || p.name.localeCompare(q.name));
    sendTo(ws, { t: 'online', list, total });
  }

  // an account by id, by its name (one account per name) or by Name#1234
  find(who) {
    who = String(who || '').trim();
    let c = null;
    if (ID_RE.test(who)) c = this.one('SELECT aid, name FROM claim WHERE aid = ?', who);
    else {
      const mm = /^([A-Za-z0-9_]{1,16})\s*(?:#\s*(\d{4}))?$/.exec(who);
      if (mm) {
        c = this.one('SELECT aid, name FROM claim WHERE lname = ?', mm[1].toLowerCase());
        if (c && mm[2] && tagOf(c.aid) !== mm[2]) c = null;
      }
    }
    return c ? { id: c.aid, name: c.name, tag: tagOf(c.aid) } : null;
  }
  add(ws, me, m) {
    const t = this.find(m.who);
    const err = (why) => sendTo(ws, { t: 'err', why, op: 'add' });
    if (!t) return err('No Thunder player is called ' + cleanText(m.who).slice(0, 30) + '.');
    if (t.id === me) return err('That is you.');
    if (this.isFriend(me, t.id)) return err(t.name + ' is already your friend.');
    if (this.blocked(me, t.id)) return err('You cannot add ' + t.name + '.');
    const now = Date.now();
    // they already asked you: you are friends now
    if (this.one('SELECT 1 AS x FROM req WHERE frm = ? AND too = ?', t.id, me)) return this.accept(ws, me, t.id);
    if (this.one('SELECT 1 AS x FROM req WHERE frm = ? AND too = ?', me, t.id)) return err('You already asked ' + t.name + '.');
    if (this.one('SELECT 1 AS x FROM nope WHERE frm = ? AND too = ? AND at > ?', me, t.id, now - NO_DAYS * 86400000)) return err(t.name + ' said no to your last request. You can ask again in a few days.');
    if (this.one('SELECT COUNT(*) AS c FROM req WHERE frm = ?', me).c >= MAX_OUT) return err('You have too many requests waiting. Cancel some first.');
    if (this.one('SELECT COUNT(*) AS c FROM req WHERE too = ?', t.id).c >= MAX_IN) return err(t.name + ' has too many requests waiting.');
    if (this.one('SELECT COUNT(*) AS c FROM friend WHERE a = ?', me).c >= MAX_FRIENDS) return err('You have the most friends Thunder allows.');
    const iph = (ws.deserializeAttachment() || {}).iph;
    if (iph && !this.ipAllow(iph, 'adds', IP_ADDS)) return err('Too many friend requests from your network. Try again in a few minutes.');
    this.sql.exec('INSERT INTO req (frm, too, at) VALUES (?, ?, ?)', me, t.id, now);
    const mine = this.one('SELECT id, name, tag FROM acct WHERE id = ?', me);
    this.push(t.id, { t: 'request', from: { id: me, name: mine.name, tag: mine.tag, at: now } });
    this.push(me, { t: 'added', to: { id: t.id, name: t.name, tag: t.tag, at: now } });
  }
  accept(ws, me, id) {
    if (!ID_RE.test(id) || !this.one('SELECT 1 AS x FROM req WHERE frm = ? AND too = ?', id, me)) return;
    if (this.one('SELECT COUNT(*) AS c FROM friend WHERE a = ?', me).c >= MAX_FRIENDS) return sendTo(ws, { t: 'err', why: 'You have the most friends Thunder allows.' });
    const now = Date.now();
    this.sql.exec('DELETE FROM req WHERE (frm = ? AND too = ?) OR (frm = ? AND too = ?)', id, me, me, id);
    this.sql.exec('DELETE FROM nope WHERE (frm = ? AND too = ?) OR (frm = ? AND too = ?)', id, me, me, id);
    this.sql.exec('INSERT OR IGNORE INTO friend (a, b, since) VALUES (?, ?, ?)', me, id, now);
    this.sql.exec('INSERT OR IGNORE INTO friend (a, b, since) VALUES (?, ?, ?)', id, me, now);
    this.push(me, { t: 'friend', f: this.card(id) });
    this.push(id, { t: 'friend', f: this.card(me) });
  }
  // "no" to a request: they cannot ask again for NO_DAYS
  decline(me, id) {
    if (!ID_RE.test(id) || !this.one('SELECT 1 AS x FROM req WHERE frm = ? AND too = ?', id, me)) return;
    this.sql.exec('INSERT OR REPLACE INTO nope (frm, too, at) VALUES (?, ?, ?)', id, me, Date.now());
    this.sql.exec('DELETE FROM nope WHERE at < ?', Date.now() - NO_DAYS * 86400000);
    this.dropReq(id, me);
  }
  // (both tell the other side only when there was something to take back)
  dropReq(frm, too) {
    if (!ID_RE.test(frm) || !ID_RE.test(too)) return;
    if (!this.one('SELECT 1 AS x FROM req WHERE frm = ? AND too = ?', frm, too)) return;
    this.sql.exec('DELETE FROM req WHERE frm = ? AND too = ?', frm, too);
    this.push(frm, { t: 'reqgone', id: too });
    this.push(too, { t: 'reqgone', id: frm });
  }
  unfriend(me, id) {
    if (!ID_RE.test(id) || !this.isFriend(me, id)) return;
    this.sql.exec('DELETE FROM friend WHERE (a = ? AND b = ?) OR (a = ? AND b = ?)', me, id, id, me);
    this.push(me, { t: 'unfriend', id });
    this.push(id, { t: 'unfriend', id: me });
  }
  block(ws, me, id) {
    if (!ID_RE.test(id) || id === me) return;
    const t = this.one('SELECT id, name, tag FROM acct WHERE id = ?', id);
    if (!t) return;
    this.unfriend(me, id);
    this.dropReq(me, id);
    this.dropReq(id, me);
    this.sql.exec('DELETE FROM mail WHERE too = ? AND frm = ?', me, id);
    this.sql.exec('INSERT OR IGNORE INTO block (a, b) VALUES (?, ?)', me, id);
    this.push(me, { t: 'blocked', who: t, on: true });
  }
  unblock(ws, me, id) {
    if (!ID_RE.test(id)) return;
    this.sql.exec('DELETE FROM block WHERE a = ? AND b = ?', me, id);
    this.push(me, { t: 'blocked', who: { id }, on: false });
  }
  message(ws, a, m) {
    const to = String(m.to || ''), text = cleanText(m.text);
    const err = (why) => sendTo(ws, { t: 'err', why, op: 'msg', to, id: msgId(m) });
    if (!ID_RE.test(to) || !text) return;
    if (!this.isFriend(a.id, to)) return err('You can only message friends.');
    const at = Date.now(), from = { id: a.id, name: a.name, tag: a.tag };
    let stored = false;
    if (this.online(to)) this.push(to, { t: 'msg', from, text, at });
    else {
      this.sql.exec('INSERT INTO mail (too, frm, text, at) VALUES (?, ?, ?, ?)', to, a.id, text, at);
      const c = this.one('SELECT COUNT(*) AS c FROM mail WHERE too = ?', to).c;
      if (c > MAX_MAIL) this.sql.exec('DELETE FROM mail WHERE n IN (SELECT n FROM mail WHERE too = ? ORDER BY n LIMIT ?)', to, c - MAX_MAIL);
      stored = true;
    }
    this.push(a.id, { t: 'msgout', to, text, at }, ws);
    sendTo(ws, { t: 'sent', to, text, at, stored, id: msgId(m) });
  }
  invite(ws, a, m) {
    const to = String(m.to || '');
    const err = (why) => sendTo(ws, { t: 'err', why, op: 'invite', to });
    if (!ID_RE.test(to)) return;
    if (!this.isFriend(a.id, to)) return err('You can only invite friends.');
    // the invite carries the code (a world whose friends need the code never sends it in its status)
    const code = CODE_RE.test(String(m.code || '')) ? String(m.code) : (a.s && a.s.code);
    if (!a.s || a.s.w !== 'host' || !code) return err('Open your world to friends first.');
    if (!this.online(to)) return err('They are offline.');
    this.push(to, { t: 'invite', from: { id: a.id, name: a.name, tag: a.tag }, code, at: Date.now() });
    sendTo(ws, { t: 'sent', to, invite: true, at: Date.now() });
  }

  async webSocketClose(ws) { this.gone(ws); }
  async webSocketError(ws) { this.gone(ws); }
  gone(ws) {
    this.idx = null;
    const a = ws.deserializeAttachment();
    if (!a || !a.id || a.gone) return;
    const id = a.id;
    a.gone = 1;
    a.id = null;                         // no longer counts as signed in
    this.keep(ws, a);
    this.sql.exec('UPDATE acct SET seen = ? WHERE id = ?', Date.now(), id);
    this.tellFriends(id);
    try { ws.close(1000, 'bye'); } catch (e) { /* closed */ }
  }
}
