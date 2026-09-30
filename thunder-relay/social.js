// Thunder Client friends hub (Right Shift > Friends > Thunder Friends): friends, who is online,
// friend requests, messages and world invites. One Durable Object for everyone ("hub").
// Part of Thunder Client, created and owned by Jayvardhan Ginni (ThunderGamey).
//
// Accounts: every Thunder install makes a secret key in the browser (kept in its localStorage).
// A player is known here by a hash of that key (id, 24 hex characters), shown as their
// Eaglercraft name and a 4-digit tag from the id, like ThunderGamey#0427. The key itself is never
// stored. The client opens wss://<site>/social?id=<id> and says hello with the key; the hub checks
// that the key hashes to that id.
//
// Safety: messages and invites only go between two players who both accepted each other as
// friends. Anyone can send a friend request (by Name#tag or from the Online list); a player who
// was told no cannot ask again for 7 days, and blocking stops requests, messages and seeing each
// other online. Players can leave the Online list. Text is plain text (the client shows it as
// text, never as HTML), at most 300 characters. Every connection is rate limited, and so is every
// network address (new connections and friend requests; the address is kept only as a hash, in
// memory). Only the site's own pages can connect (relay.js checks Origin). Messages to a friend
// who is offline wait here (at most 100 per player, 30 days) until they come online and are
// deleted once delivered.
//
// Protocol (JSON text frames; "ping" is answered "pong" without waking the object):
//   client -> hub: hello {key, name, hide, share} | status {s} | name {name} | hide {v} | share {v}
//     | online | add {who} | accept {id} | decline {id} | cancel {id} | remove {id} | block {id}
//     | unblock {id} | msg {to, text} | invite {to} | ack {n}
//   hub -> client: welcome | presence | request | friend | unfriend | reqgone | blocked | online
//     | added | msg | msgout | sent | invite | err

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
const NAME_RE = /^[A-Za-z0-9_]{1,16}$/;
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
function cleanName(n) { n = String(n || ''); return NAME_RE.test(n) ? n : 'Player'; }
function cleanStatus(s) {
  if (!s || typeof s !== 'object' || WHAT.indexOf(s.w) < 0) return null;
  const o = { w: s.w };
  if (s.w === 'host' && /^[a-z0-9]{5,6}$/.test(String(s.code || ''))) o.code = String(s.code);
  if (s.w === 'server') o.server = String(s.server || '').replace(/[^A-Za-z0-9.:_\-\/]/g, '').slice(0, 80);
  return o;
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
    this.ctx.acceptWebSocket(pair[1], ['u:' + claim]);
    pair[1].serializeAttachment({ claim, id: null, iph });
    return new Response(null, { status: 101, webSocket: pair[0] });
  }
  // counts per network address; forgotten after IP_SPAN (and whenever the object sleeps)
  ipAllow(iph, k, max) {
    const now = Date.now();
    let e = this.ips.get(iph);
    if (!e || now - e.t > IP_SPAN) {
      if (this.ips.size > 5000) for (const [h, x] of this.ips) if (now - x.t > IP_SPAN) this.ips.delete(h);
      e = { t: now, conns: 0, adds: 0 };
      this.ips.set(iph, e);
    }
    return ++e[k] <= max;
  }
  // the signed-in sockets of a player
  socks(id, except) {
    return this.ctx.getWebSockets('u:' + id).filter((ws) => ws !== except && (ws.deserializeAttachment() || {}).id === id);
  }
  push(id, obj, except) { for (const ws of this.socks(id, except)) sendTo(ws, obj); }
  online(id) { return this.socks(id).length > 0; }
  // what friends see of a player: name, tag, online and (if they share it) what they are doing
  card(id, acct) {
    const a = acct || this.one('SELECT id, name, tag FROM acct WHERE id = ?', id);
    if (!a) return null;
    const s = this.socks(id);
    let st = null;
    for (const ws of s) { const at = ws.deserializeAttachment(); if (at && at.share !== false && at.s) st = at.s; }
    return { id, name: a.name, tag: a.tag, online: s.length > 0, s: st };
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
    if (t === 'msg' || t === 'invite' || t === 'add') r.m++;
    if (r.n > 120) { try { ws.close(1008, 'too many messages'); } catch (e) { /* closed */ } return false; }
    return r.n <= 40 && r.m <= 12;
  }

  async webSocketMessage(ws, msg) {
    if (typeof msg !== 'string' || msg.length > MAX_FRAME) return this.bye(ws, 'bad message');
    let m;
    try { m = JSON.parse(msg); } catch (e) { return this.bye(ws, 'bad message'); }
    if (!m || typeof m !== 'object' || typeof m.t !== 'string') return;
    const a = ws.deserializeAttachment() || {};
    if (!a.id) {
      if (m.t === 'hello') return this.hello(ws, a, m);
      return this.bye(ws, 'say hello first');
    }
    // (a refused message, invite or request says which one, so the client can mark it)
    if (!this.allow(ws, m.t)) return sendTo(ws, { t: 'err', why: 'Slow down a little.', op: ['msg', 'invite', 'add'].includes(m.t) ? m.t : undefined, to: ID_RE.test(String(m.to || '')) ? m.to : undefined, id: msgId(m) });
    const me = a.id;
    switch (m.t) {
      case 'status': return this.status(ws, a, m);
      case 'name': return this.rename(ws, a, m);
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
    if (!/^[0-9a-f]{64}$/.test(key)) return this.bye(ws, 'bad key');
    const id = await socialId(key);
    if (id !== a.claim) return this.bye(ws, 'wrong key');
    const name = cleanName(m.name), tag = tagOf(id), now = Date.now(), hidden = m.hide ? 1 : 0;
    this.sql.exec('INSERT INTO acct (id, name, lname, tag, seen, hidden) VALUES (?, ?, ?, ?, ?, ?) ' +
      'ON CONFLICT(id) DO UPDATE SET name = excluded.name, lname = excluded.lname, seen = excluded.seen, hidden = excluded.hidden',
      id, name, name.toLowerCase(), tag, now, hidden);
    // at most MAX_SOCKS tabs: the oldest ones are closed
    const mine = this.socks(id);
    for (let i = 0; i <= mine.length - MAX_SOCKS; i++) this.bye(mine[i], 'opened in another tab');
    const wasOnline = mine.length > 0;
    ws.serializeAttachment({ claim: a.claim, iph: a.iph || '', id, name, tag, hidden: !!hidden, share: m.share !== false, s: cleanStatus(m.s) });
    this.sql.exec('DELETE FROM mail WHERE too = ? AND at < ?', id, now - MAIL_DAYS * 86400000);
    const friends = this.rows('SELECT a.id, a.name, a.tag FROM friend f JOIN acct a ON a.id = f.b WHERE f.a = ?', id).map((r) => this.card(r.id, r));
    const reqIn = this.rows('SELECT a.id, a.name, a.tag, r.at FROM req r JOIN acct a ON a.id = r.frm WHERE r.too = ? ORDER BY r.at', id);
    const reqOut = this.rows('SELECT a.id, a.name, a.tag, r.at FROM req r JOIN acct a ON a.id = r.too WHERE r.frm = ? ORDER BY r.at', id);
    const blocked = this.rows('SELECT a.id, a.name, a.tag FROM block b JOIN acct a ON a.id = b.b WHERE b.a = ?', id);
    const mail = this.rows('SELECT m.n, m.frm AS id, a.name, a.tag, m.text, m.at FROM mail m LEFT JOIN acct a ON a.id = m.frm WHERE m.too = ? ORDER BY m.n LIMIT 200', id)
      .map((r) => ({ n: r.n, from: { id: r.id, name: r.name || 'Player', tag: r.tag || '0000' }, text: r.text, at: r.at }));
    sendTo(ws, { t: 'welcome', me: { id, name, tag, hidden: !!hidden }, friends, reqIn, reqOut, blocked, mail, now });
    if (!wasOnline || m.s) this.tellFriends(id);
  }

  status(ws, a, m) {
    const s = cleanStatus(m.s);
    if (JSON.stringify(s) === JSON.stringify(a.s || null)) return;
    a.s = s;
    ws.serializeAttachment(a);
    if (a.share !== false) this.tellFriends(a.id);
  }
  rename(ws, a, m) {
    const name = cleanName(m.name);
    if (name === a.name) return;
    this.sql.exec('UPDATE acct SET name = ?, lname = ? WHERE id = ?', name, name.toLowerCase(), a.id);
    for (const s of this.socks(a.id)) { const x = s.deserializeAttachment(); x.name = name; s.serializeAttachment(x); }
    this.tellFriends(a.id);
  }
  setFlag(ws, a, k, v) {
    for (const s of this.socks(a.id)) { const x = s.deserializeAttachment(); x[k] = v; s.serializeAttachment(x); }
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

  // a player by id, or by Name#1234 (or by a name only when exactly one online player has it)
  find(who) {
    who = String(who || '').trim();
    if (ID_RE.test(who)) return this.one('SELECT id, name, tag FROM acct WHERE id = ?', who);
    const mm = /^([A-Za-z0-9_]{1,16})\s*#\s*(\d{4})$/.exec(who);
    if (mm) return this.one('SELECT id, name, tag FROM acct WHERE lname = ? AND tag = ? ORDER BY seen DESC LIMIT 1', mm[1].toLowerCase(), mm[2]);
    if (!NAME_RE.test(who)) return null;
    const hits = new Map();
    for (const s of this.ctx.getWebSockets()) {
      const x = s.deserializeAttachment();
      if (x && x.id && !x.hidden && x.name.toLowerCase() === who.toLowerCase()) hits.set(x.id, { id: x.id, name: x.name, tag: x.tag });
    }
    return hits.size === 1 ? hits.values().next().value : (hits.size > 1 ? { many: true } : null);
  }
  add(ws, me, m) {
    const t = this.find(m.who);
    const err = (why) => sendTo(ws, { t: 'err', why, op: 'add' });
    if (!t) return err('No Thunder player called ' + cleanText(m.who).slice(0, 30) + '. Use their name and tag, like Steve#1234.');
    if (t.many) return err('More than one player is called that. Use their name and tag, like Steve#1234.');
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
    if (!a.s || a.s.w !== 'host' || !a.s.code) return err('Open your world to friends first.');
    if (!this.online(to)) return err('They are offline.');
    this.push(to, { t: 'invite', from: { id: a.id, name: a.name, tag: a.tag }, code: a.s.code, at: Date.now() });
    sendTo(ws, { t: 'sent', to, invite: true, at: Date.now() });
  }

  async webSocketClose(ws) { this.gone(ws); }
  async webSocketError(ws) { this.gone(ws); }
  gone(ws) {
    const a = ws.deserializeAttachment();
    if (!a || !a.id || a.gone) return;
    a.gone = 1;
    a.id = null;                         // no longer counts as signed in
    try { ws.serializeAttachment(a); } catch (e) { /* closed */ }
    const id = a.claim;
    this.sql.exec('UPDATE acct SET seen = ? WHERE id = ?', Date.now(), id);
    this.tellFriends(id);
    try { ws.close(1000, 'bye'); } catch (e) { /* closed */ }
  }
}
