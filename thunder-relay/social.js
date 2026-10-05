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
// account takes the device's id). The hub has no email for anyone, so a forgotten password is reset
// with a recovery code: the browser makes a random code, shows it to the player once and sends only
// a key made from it, which the hub keeps like a password (salted SHA-256), one per account. The
// name, the code and a new password set the new password, sign every other device out, sign this
// one in and use the code up; wrong codes count like wrong passwords.
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
// Parties: a player makes a party and, as its leader, invites friends (at most 8 players; an invite
// stays open 15 minutes, and waits for a friend who is offline). Members have a party chat, see
// each other, and get "pwarp" when the leader opens a world, joins one or goes to a server, so
// their game can follow. Leaving hands the lead to the next member; the last one ends the party.
//
// Thunder cosmetics: an account picks a cape and wings (ids of Thunder's own designs) and says its
// in-game name; any signed-in Thunder player asks for the cosmetics of the players around them by
// in-game name (at most 64 at a time) and draws them. Only accounts that picked something are kept,
// and only the ids and the in-game name are given out (never the account).
//
// Settings that follow an account: a signed-in device sends the settings it changed as
// [key, value, when] (key like "s.zoomKey", value a string of at most 12000 characters); per key
// the newest is kept (a time more than a minute ahead of the hub's clock counts as now), at most
// 800 keys and 400 KB per account. A device gets them all in welcome, and a change from one device
// is sent to the account's other open devices; one that is older than what is kept goes back to
// the sender. Only the account itself ever gets them.
//
// Protocol (JSON text frames; "ping" is answered "pong" without waking the object):
//   client -> hub: hello {key, name, hide, share, s}, then (a device not signed in, told "auth")
//     register {name, pw} | login {name, pw} | recover {name, code, pw}; signed in: passwd {old, pw}
//     | recovery {code} (a new recovery code: recok {at} to all the account's devices) | logout
//     | cosm {name, cape, wings} | cosmq {names} (answered cosma {set: [[name, cape, wings]]})
//     | owner {proof} (owner account: prove the owner key to gain powers; owned {ok}) | ban {id, reason} | unban {id}
//     | bans (owner: answered banlist {bans}) | pnew | pinv {to} | pacc {pid} | pdec {pid} | pleave | pkick {id} | pmsg {text}
//     | pwarp {w: host | join (code) | server (server) | menu}
//   party (to members: party {id, leader, members, invites, warp}, id null when out of it)
//     | pinvited {pid, from, members, at} | pmsg {from, text, at} | pwarp {from, w, code | server, at}
//     | status {s} | hide {v} | share {v}
//     | online | add {who} | accept {id} | decline {id} | cancel {id} | remove {id} | block {id}
//     | unblock {id} | msg {to, text, id} | invite {to, code} | ack {n} | sync {set: [[key, value, when]]}
//     | syncget (the account's settings again: syncall {sync})
//   s (what a player is doing): {w: menu | sp | server (server) | join (host: whose world)
//     | host (code, or lock: friends need the code; players: who joined)}
//   hub -> client: auth | welcome (with sync: [[key, value, when]]) | pwok | presence | request
//     | friend | unfriend | reqgone | blocked | online | added | msg | msgout | sent | invite
//     | sync {set} | syncall {sync} | err
//   a friend (welcome, presence, friend): {id, name, tag, online, s, seen (offline: when they were
//     last online)}

const MAX_FRAME = 4096;          // bytes in one message from a client
const MAX_SYNC_FRAME = 16384;    // ...a sync message (a device sends its changed settings a few at a time)
const SYNC_VAL = 12000;          // characters in one synced setting
const SYNC_KEYS = 800;           // synced settings per account
const SYNC_BYTES = 400000;       // all of an account's synced settings together
const SYNC_KEY_RE = /^[a-z]\.[A-Za-z0-9_.:@,\/\-]{1,160}$/;
const COSM_RE = /^[a-z0-9]{1,24}$/;   // a cosmetic's id ("none": nothing)
const COSM_ASK = 64;                  // in-game names in one question
const OWNER_NAME = 'thundergamey_';   // reserved: only the owner key claims it, and it carries owner powers
const OWNER_COSM = new Set(['owner']); // cosmetic ids only the owner may wear
function isOwnerName(lname) { return String(lname || '').toLowerCase() === OWNER_NAME; }
const PARTY_MAX = 8;                  // players in a party
const PINV_MS = 15 * 60000;           // how long a party invite stays open
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
    // recovery codes: what is kept of the key the browser made from the code, one per account
    q('CREATE TABLE IF NOT EXISTS recov (aid TEXT PRIMARY KEY, salt TEXT NOT NULL, hash TEXT NOT NULL, at INTEGER NOT NULL)');
    // cosmetics: an account's cape and wings, and the in-game name they are shown on
    q('CREATE TABLE IF NOT EXISTS cosm (aid TEXT PRIMARY KEY, lname TEXT NOT NULL, cape TEXT NOT NULL, wings TEXT NOT NULL, at INTEGER NOT NULL)');
    q('CREATE INDEX IF NOT EXISTS cosm_name ON cosm (lname)');
    // parties: who leads (and where the leader went last), who is in one (one party each), open invites
    q('CREATE TABLE IF NOT EXISTS party (pid TEXT PRIMARY KEY, leader TEXT NOT NULL, at INTEGER NOT NULL, warp TEXT)');
    q('CREATE TABLE IF NOT EXISTS pmem (aid TEXT PRIMARY KEY, pid TEXT NOT NULL, at INTEGER NOT NULL)');
    q('CREATE INDEX IF NOT EXISTS pmem_pid ON pmem (pid)');
    q('CREATE TABLE IF NOT EXISTS pinv (pid TEXT NOT NULL, aid TEXT NOT NULL, frm TEXT NOT NULL, at INTEGER NOT NULL, PRIMARY KEY (pid, aid))');
    q('CREATE INDEX IF NOT EXISTS pinv_aid ON pinv (aid)');
    // settings that follow an account: key, value and when it was changed
    q('CREATE TABLE IF NOT EXISTS sync (aid TEXT NOT NULL, k TEXT NOT NULL, v TEXT NOT NULL, at INTEGER NOT NULL, PRIMARY KEY (aid, k))');
    // bans the owner set: what is an account id or a device id; both are added when an account is banned
    q('CREATE TABLE IF NOT EXISTS ban (what TEXT PRIMARY KEY, kind TEXT NOT NULL, reason TEXT NOT NULL, whoby TEXT, at INTEGER NOT NULL)');
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
    if (isOwnerName(a.name)) c.owner = true;
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
  // the owner key is a Worker secret (OWNER_KEY). A device proves it with SHA-256 of
  // "thunder-owner:" + the key (made in the browser, so the key itself never leaves it). With no
  // secret set, the reserved name cannot be claimed at all, so nobody can take it.
  async ownerProofOK(proof) {
    const key = this.env && this.env.OWNER_KEY;
    if (!key || typeof proof !== 'string' || !KEY_RE.test(proof)) return false;
    const want = hex(await crypto.subtle.digest('SHA-256', new TextEncoder().encode('thunder-owner:' + key)));
    return same(proof, want);
  }
  isOwnerAid(aid) { const c = this.one('SELECT name FROM claim WHERE aid = ?', aid); return !!(c && isOwnerName(c.name)); }
  // why a device or account is banned (the reason), or null
  banReason(did, aid) {
    const r = this.one('SELECT reason FROM ban WHERE what = ? OR what = ?', did || '-', aid || '-');
    return r ? r.reason : null;
  }
  banBye(ws, reason) { sendTo(ws, { t: 'err', why: 'banned', reason: String(reason || ''), fatal: true }); try { ws.close(1008, 'banned'); } catch (e) { /* closed */ } }

  allow(ws, t) {
    const now = Date.now();
    let r = this.rate.get(ws);
    if (!r || now - r.t > 10000) { r = { t: now, n: 0, m: 0 }; this.rate.set(ws, r); }
    r.n++;
    if (t === 'msg' || t === 'invite' || t === 'add' || t === 'register' || t === 'login' || t === 'passwd' || t === 'recover' || t === 'recovery' || t === 'pmsg' || t === 'pinv') r.m++;
    if (r.n > 120) { try { ws.close(1008, 'too many messages'); } catch (e) { /* closed */ } return false; }
    return r.n <= 40 && r.m <= 12;
  }

  async webSocketMessage(ws, msg) {
    this.idx = null;
    if (typeof msg !== 'string' || msg.length > (msg.startsWith('{"t":"sync"') ? MAX_SYNC_FRAME : MAX_FRAME)) return this.bye(ws, 'bad message');
    let m;
    try { m = JSON.parse(msg); } catch (e) { return this.bye(ws, 'bad message'); }
    if (!m || typeof m !== 'object' || typeof m.t !== 'string') return;
    const a = ws.deserializeAttachment() || {};
    if (!a.id) {
      if (m.t === 'hello' && !a.did) return this.hello(ws, a, m);
      // a device that said hello but is not signed in: only an account's name and password
      if (a.did && (m.t === 'register' || m.t === 'login' || m.t === 'recover')) {
        if (!this.allow(ws, m.t)) return sendTo(ws, { t: 'err', op: 'auth', why: 'Slow down a little.' });
        return m.t === 'register' ? this.register(ws, a, m) : m.t === 'login' ? this.login(ws, a, m) : this.recover(ws, a, m);
      }
      return this.bye(ws, 'say hello first');
    }
    // (a refused message, invite or request says which one, so the client can mark it)
    if (!this.allow(ws, m.t)) return sendTo(ws, { t: 'err', why: 'Slow down a little.', op: ['msg', 'invite', 'add'].includes(m.t) ? m.t : m.t === 'pmsg' || m.t === 'pinv' ? 'party' : undefined, to: ID_RE.test(String(m.to || '')) ? m.to : undefined, id: msgId(m) });
    const me = a.id;
    switch (m.t) {
      case 'status': return this.status(ws, a, m);
      case 'name': return;                 // (an account keeps its name)
      case 'passwd': return this.passwd(ws, a, m);
      case 'recovery': return this.setRecovery(ws, a, m);
      case 'owner': return this.ownerPowers(ws, a, m);
      case 'ban': return this.doBan(ws, a, m);
      case 'unban': return this.doUnban(ws, a, m);
      case 'bans': return this.sendBans(ws, a);
      case 'cosm': return this.setCosm(a, m);
      case 'cosmq': return this.askCosm(ws, m);
      case 'pnew': return this.pNew(me);
      case 'pinv': return this.pInvite(ws, a, m);
      case 'pacc': return this.pAccept(ws, me, String(m.pid || ''));
      case 'pdec': return this.pDecline(me, String(m.pid || ''));
      case 'pleave': return this.pLeave(me, 'left');
      case 'pkick': return this.pKick(ws, me, String(m.id || ''));
      case 'pmsg': return this.pMsg(ws, a, m);
      case 'pwarp': return this.pWarp(a, m);
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
      case 'sync': return this.sync(ws, a, m);
      case 'syncget': return sendTo(ws, { t: 'syncall', sync: this.syncOf(me) });
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
    const bn0 = this.banReason(did, null);
    if (bn0) return this.banBye(ws, bn0);
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

  signIn(ws, a, aid, owner) {
    const c = this.one('SELECT name FROM claim WHERE aid = ?', aid);
    if (!c) return this.bye(ws, 'signed out');
    const bn = this.banReason(a.did, aid);
    if (bn) return this.banBye(ws, bn);
    const name = c.name, tag = tagOf(aid), now = Date.now(), hi = a.hi || {}, hidden = hi.hide ? 1 : 0;
    const own = !!owner && isOwnerName(name);
    this.sql.exec('INSERT INTO acct (id, name, lname, tag, seen, hidden) VALUES (?, ?, ?, ?, ?, ?) ' +
      'ON CONFLICT(id) DO UPDATE SET name = excluded.name, lname = excluded.lname, seen = excluded.seen, hidden = excluded.hidden',
      aid, name, name.toLowerCase(), tag, now, hidden);
    // at most MAX_SOCKS tabs and devices at once: the oldest ones are closed
    const mine = this.socks(aid).sort((p, q) => ((p.deserializeAttachment() || {}).since || 0) - ((q.deserializeAttachment() || {}).since || 0));
    for (let i = 0; i <= mine.length - MAX_SOCKS; i++) this.bye(mine[i], 'opened in another tab');
    const wasOnline = mine.length > 0;
    this.keep(ws, { claim: a.claim, did: a.did, iph: a.iph || '', id: aid, name, tag, hidden: !!hidden, owner: own, share: hi.share !== false, s: hi.s || null, since: now });
    this.sql.exec('UPDATE dev SET at = ? WHERE did = ?', now, a.did);
    this.sql.exec('DELETE FROM mail WHERE too = ? AND at < ?', aid, now - MAIL_DAYS * 86400000);
    const friends = this.rows('SELECT a.id, a.name, a.tag, a.seen FROM friend f JOIN acct a ON a.id = f.b WHERE f.a = ?', aid).map((r) => this.card(r.id, r));
    const reqIn = this.rows('SELECT a.id, a.name, a.tag, r.at FROM req r JOIN acct a ON a.id = r.frm WHERE r.too = ? ORDER BY r.at', aid);
    const reqOut = this.rows('SELECT a.id, a.name, a.tag, r.at FROM req r JOIN acct a ON a.id = r.too WHERE r.frm = ? ORDER BY r.at', aid);
    const blocked = this.rows('SELECT a.id, a.name, a.tag FROM block b JOIN acct a ON a.id = b.b WHERE b.a = ?', aid);
    const mail = this.rows('SELECT m.n, m.frm AS id, a.name, a.tag, m.text, m.at FROM mail m LEFT JOIN acct a ON a.id = m.frm WHERE m.too = ? ORDER BY m.n LIMIT 200', aid)
      .map((r) => ({ n: r.n, from: { id: r.id, name: r.name || 'Player', tag: r.tag || '0000' }, text: r.text, at: r.at }));
    const rec = this.one('SELECT at FROM recov WHERE aid = ?', aid);
    sendTo(ws, { t: 'welcome', me: { id: aid, name, tag, hidden: !!hidden, owner: own, rec: rec ? rec.at : 0 }, friends, reqIn, reqOut, blocked, mail, sync: this.syncOf(aid), now });
    if (own) this.sendBans(ws, { owner: true });
    if (!wasOnline || hi.s) this.tellFriends(aid);
    const pid = this.partyOf(aid);
    if (pid) { if (wasOnline) sendTo(ws, this.partyState(pid)); else this.tellParty(pid); }
    for (const inv of this.rows('SELECT pid, frm, at FROM pinv WHERE aid = ? AND at > ?', aid, now - PINV_MS)) this.sendInvite(ws, inv.pid, inv.frm, inv.at);
  }

  syncOf(aid) { return this.rows('SELECT k, v, at FROM sync WHERE aid = ?', aid).map((r) => [r.k, r.v, r.at]); }
  // settings this device changed: per key the newest is kept and sent to the account's other open
  // devices; a key where the hub has something newer gets that back
  sync(ws, a, m) {
    const set = Array.isArray(m.set) ? m.set.slice(0, 300) : [];
    const now = Date.now(), took = [], back = [];
    const have = this.one('SELECT COUNT(*) AS n, COALESCE(SUM(LENGTH(v)), 0) AS b FROM sync WHERE aid = ?', a.id);
    let n = have ? have.n : 0, bytes = have ? have.b : 0, full = false;
    for (const it of set) {
      if (!Array.isArray(it) || it.length !== 3) continue;
      const k = it[0], v = it[1];
      let at = Number(it[2]);
      if (typeof k !== 'string' || !SYNC_KEY_RE.test(k) || typeof v !== 'string' || v.length > SYNC_VAL || !Number.isFinite(at) || at <= 0) continue;
      at = Math.floor(at > now + 60000 ? now : at);      // (a device whose clock is ahead)
      const cur = this.one('SELECT v, at FROM sync WHERE aid = ? AND k = ?', a.id, k);
      if (cur && cur.at >= at) { if (cur.v !== v) back.push([k, cur.v, cur.at]); continue; }
      const nn = n + (cur ? 0 : 1), nb = bytes - (cur ? cur.v.length : 0) + v.length;
      if (nn > SYNC_KEYS || nb > SYNC_BYTES) { full = true; continue; }
      this.sql.exec('INSERT INTO sync (aid, k, v, at) VALUES (?, ?, ?, ?) ON CONFLICT(aid, k) DO UPDATE SET v = excluded.v, at = excluded.at', a.id, k, v, at);
      n = nn; bytes = nb;
      took.push([k, v, at]);
    }
    if (took.length) this.push(a.id, { t: 'sync', set: took }, ws);
    if (back.length) sendTo(ws, { t: 'sync', set: back });
    if (full) sendTo(ws, { t: 'err', op: 'sync', why: 'Your account has no room for more settings (800 or 400 KB); the newest changes stay on this device.' });
  }

  // a new account with this device's name and password (the account takes the device's id)
  async register(ws, a, m) {
    const name = String(m.name || ''), lname = name.toLowerCase(), pw = String(m.pw || '');
    const err = (why) => sendTo(ws, { t: 'err', op: 'auth', why });
    if (!ACCT_RE.test(name)) return err('A name is 3 to 16 letters, numbers or _.');
    if (!KEY_RE.test(pw)) return err('That password did not arrive right. Try again.');
    const ownReg = isOwnerName(lname);
    if (ownReg && !(await this.ownerProofOK(m.owner))) return err('That name is reserved.');
    if (this.one('SELECT 1 AS x FROM claim WHERE lname = ?', lname)) return err(name + ' is taken. If it is yours, log in.');
    if (a.iph && !this.ipAllow(a.iph, 'regs', IP_REGS)) return err('Too many new accounts from your network. Try again later.');
    const salt = hex(crypto.getRandomValues(new Uint8Array(16))), hash = await pwHash(salt, pw), now = Date.now();
    // (checked again after the wait: another device may have taken the name, or this one signed in)
    if ((ws.deserializeAttachment() || {}).id) return;
    if (this.one('SELECT 1 AS x FROM claim WHERE lname = ?', lname)) return err(name + ' is taken. If it is yours, log in.');
    if (this.one('SELECT 1 AS x FROM claim WHERE aid = ?', a.did)) return this.bye(ws, 'signed out');
    this.sql.exec('INSERT INTO claim (lname, aid, name, salt, hash, at) VALUES (?, ?, ?, ?, ?, ?)', lname, a.did, name, salt, hash, now);
    this.sql.exec('INSERT OR REPLACE INTO dev (did, aid, at) VALUES (?, ?, ?)', a.did, a.did, now);
    return this.signIn(ws, a, a.did, ownReg);
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
  // ---- owner powers (only the owner account, after proving the owner key this session) ----
  // The owner key is a Worker secret; a device proves it so it can ban and wear owner cosmetics.
  // Proving it does not store the key anywhere: it grants this socket powers until it closes.
  async ownerPowers(ws, a, m) {
    if (!isOwnerName(a.name)) return;                 // only the reserved owner account
    if (!(await this.ownerProofOK(m.proof))) return sendTo(ws, { t: 'owned', ok: false });
    const x = ws.deserializeAttachment() || a;
    x.owner = true;
    this.keep(ws, x);
    sendTo(ws, { t: 'owned', ok: true });
    this.sendBans(ws, { owner: true });
  }
  // ban an account (and its devices): it cannot use Thunder Friends until unbanned
  doBan(ws, a, m) {
    if (!a.owner) return sendTo(ws, { t: 'err', op: 'owner', why: 'Only the owner can ban players.' });
    const id = String(m.id || '');
    if (!ID_RE.test(id)) return;
    if (id === a.id || this.isOwnerAid(id)) return sendTo(ws, { t: 'err', op: 'owner', why: 'You cannot ban the owner.' });
    const reason = cleanText(m.reason) || 'No reason given', now = Date.now();
    this.sql.exec('INSERT OR REPLACE INTO ban (what, kind, reason, whoby, at) VALUES (?, ?, ?, ?, ?)', id, 'acct', reason, a.id, now);
    // a device whose id equals the account id is already covered by the 'acct' row (its what is
    // that id); only the account's other devices need their own 'dev' rows
    for (const r of this.rows('SELECT did FROM dev WHERE aid = ?', id)) if (r.did !== id) this.sql.exec('INSERT OR REPLACE INTO ban (what, kind, reason, whoby, at) VALUES (?, ?, ?, ?, ?)', r.did, 'dev', reason, a.id, now);
    for (const s of this.socks(id)) this.banBye(s, reason);
    this.sendBans(ws, a);
  }
  doUnban(ws, a, m) {
    if (!a.owner) return sendTo(ws, { t: 'err', op: 'owner', why: 'Only the owner can do that.' });
    const id = String(m.id || '');
    if (!ID_RE.test(id)) return;
    this.sql.exec('DELETE FROM ban WHERE what = ?', id);
    for (const r of this.rows('SELECT did FROM dev WHERE aid = ?', id)) this.sql.exec('DELETE FROM ban WHERE what = ?', r.did);
    this.sendBans(ws, a);
  }
  sendBans(ws, a) {
    if (!a || !a.owner) return;
    const bans = this.rows("SELECT b.what AS id, b.reason, b.at, c.name FROM ban b LEFT JOIN claim c ON c.aid = b.what WHERE b.kind = 'acct' ORDER BY b.at DESC LIMIT 200")
      .map((r) => ({ id: r.id, name: r.name || 'Player', reason: r.reason, at: r.at }));
    sendTo(ws, { t: 'banlist', bans });
  }
  // this account's cosmetics and the in-game name they are on (nothing picked: forgotten)
  setCosm(a, m) {
    const name = String(m.name || ''), cape = String(m.cape || 'none'), wings = String(m.wings || 'none');
    if (!NAME_RE.test(name) || !COSM_RE.test(cape) || !COSM_RE.test(wings)) return;
    if ((OWNER_COSM.has(cape) || OWNER_COSM.has(wings)) && !a.owner) return;   // owner-only designs
    if (cape === 'none' && wings === 'none') { this.sql.exec('DELETE FROM cosm WHERE aid = ?', a.id); return; }
    this.sql.exec('INSERT OR REPLACE INTO cosm (aid, lname, cape, wings, at) VALUES (?, ?, ?, ?, ?)', a.id, name.toLowerCase(), cape, wings, Date.now());
  }
  // the cosmetics on these in-game names (the newest account that is on a name, when several are)
  askCosm(ws, m) {
    const names = Array.isArray(m.names) ? m.names.slice(0, COSM_ASK) : [], set = [], seen = new Set();
    for (const n of names) {
      if (typeof n !== 'string' || !NAME_RE.test(n)) continue;
      const l = n.toLowerCase();
      if (seen.has(l)) continue;
      seen.add(l);
      const r = this.one('SELECT cape, wings FROM cosm WHERE lname = ? ORDER BY at DESC LIMIT 1', l);
      if (r) set.push([l, r.cape, r.wings]);
    }
    sendTo(ws, { t: 'cosma', set, asked: [...seen] });
  }
  // ---- parties ----
  partyOf(aid) { const r = this.one('SELECT pid FROM pmem WHERE aid = ?', aid); return r ? r.pid : null; }
  // members need not be friends of each other, so they see only roughly what the others are doing
  // (no world codes or server addresses); where the leader went last is for all of them
  partyState(pid) {
    const p = this.one('SELECT pid, leader, warp FROM party WHERE pid = ?', pid);
    if (!p) return { t: 'party', id: null };
    const members = this.rows('SELECT a.id, a.name, a.tag, a.seen FROM pmem m JOIN acct a ON a.id = m.aid WHERE m.pid = ? ORDER BY m.at', pid).map((r) => {
      const c = this.card(r.id, r);
      c.s = c.s ? { w: c.s.w } : null;
      return c;
    });
    const invites = this.rows('SELECT a.id, a.name, a.tag FROM pinv i JOIN acct a ON a.id = i.aid WHERE i.pid = ? AND i.at > ?', pid, Date.now() - PINV_MS);
    let warp = null;
    try { warp = p.warp ? JSON.parse(p.warp) : null; } catch (e) { warp = null; }
    return { t: 'party', id: pid, leader: p.leader, members, invites, warp };
  }
  tellParty(pid) {
    const st = this.partyState(pid);
    for (const r of this.rows('SELECT aid FROM pmem WHERE pid = ?', pid)) this.push(r.aid, st);
  }
  sendInvite(ws, pid, frm, at) {
    const f = this.one('SELECT id, name, tag FROM acct WHERE id = ?', frm);
    if (!f || !this.one('SELECT 1 AS x FROM party WHERE pid = ?', pid)) return;
    const members = this.rows('SELECT a.name FROM pmem m JOIN acct a ON a.id = m.aid WHERE m.pid = ? ORDER BY m.at', pid).map((r) => r.name);
    const out = { t: 'pinvited', pid, from: { id: f.id, name: f.name, tag: f.tag }, members, at };
    if (ws) sendTo(ws, out); else return out;
  }
  pNew(me) {
    let pid = this.partyOf(me);
    if (!pid) {
      pid = hex(crypto.getRandomValues(new Uint8Array(8)));
      const now = Date.now();
      this.sql.exec('INSERT INTO party (pid, leader, at) VALUES (?, ?, ?)', pid, me, now);
      this.sql.exec('INSERT INTO pmem (aid, pid, at) VALUES (?, ?, ?)', me, pid, now);
    }
    this.tellParty(pid);
  }
  // the leader invites a friend
  pInvite(ws, a, m) {
    const me = a.id, to = String(m.to || ''), err = (why) => sendTo(ws, { t: 'err', op: 'party', why });
    const pid = this.partyOf(me);
    if (!pid) return err('Make a party first.');
    const p = this.one('SELECT leader FROM party WHERE pid = ?', pid);
    if (!p || p.leader !== me) return err('Only the party leader invites players.');
    if (!ID_RE.test(to) || to === me || !this.isFriend(me, to) || this.blocked(me, to)) return err('You can invite your friends.');
    if (this.partyOf(to) === pid) return err('They are in the party already.');
    if (this.one('SELECT COUNT(*) AS n FROM pmem WHERE pid = ?', pid).n >= PARTY_MAX) return err('A party has at most ' + PARTY_MAX + ' players.');
    const now = Date.now();
    this.sql.exec('DELETE FROM pinv WHERE at < ?', now - PINV_MS);
    this.sql.exec('INSERT OR REPLACE INTO pinv (pid, aid, frm, at) VALUES (?, ?, ?, ?)', pid, to, me, now);
    const out = this.sendInvite(null, pid, me, now);
    if (out) this.push(to, out);
    this.tellParty(pid);
  }
  pAccept(ws, me, pid) {
    const err = (why) => sendTo(ws, { t: 'err', op: 'party', why });
    const inv = this.one('SELECT at FROM pinv WHERE pid = ? AND aid = ?', pid, me);
    if (!inv || Date.now() - inv.at > PINV_MS || !this.one('SELECT 1 AS x FROM party WHERE pid = ?', pid)) {
      this.sql.exec('DELETE FROM pinv WHERE pid = ? AND aid = ?', pid, me);
      return err('That party invite is no longer open.');
    }
    if (this.one('SELECT COUNT(*) AS n FROM pmem WHERE pid = ?', pid).n >= PARTY_MAX) return err('That party is full.');
    const old = this.partyOf(me);
    if (old && old !== pid) this.pLeave(me, 'left');
    this.sql.exec('DELETE FROM pinv WHERE pid = ? AND aid = ?', pid, me);
    this.sql.exec('INSERT OR REPLACE INTO pmem (aid, pid, at) VALUES (?, ?, ?)', me, pid, Date.now());
    this.tellParty(pid);
  }
  pDecline(me, pid) {
    if (!this.one('SELECT 1 AS x FROM pinv WHERE pid = ? AND aid = ?', pid, me)) return;
    this.sql.exec('DELETE FROM pinv WHERE pid = ? AND aid = ?', pid, me);
    if (this.one('SELECT 1 AS x FROM party WHERE pid = ?', pid)) this.tellParty(pid);
  }
  // out of the party (left or removed); the lead goes to the member who joined first after
  pLeave(me, why) {
    const pid = this.partyOf(me);
    if (!pid) return;
    const p = this.one('SELECT leader FROM party WHERE pid = ?', pid);
    this.sql.exec('DELETE FROM pmem WHERE aid = ?', me);
    const next = this.one('SELECT aid FROM pmem WHERE pid = ? ORDER BY at LIMIT 1', pid);
    if (!next) { this.sql.exec('DELETE FROM party WHERE pid = ?', pid); this.sql.exec('DELETE FROM pinv WHERE pid = ?', pid); }
    else if (p && p.leader === me) this.sql.exec('UPDATE party SET leader = ?, warp = NULL WHERE pid = ?', next.aid, pid);
    this.push(me, { t: 'party', id: null, why });
    if (next) this.tellParty(pid);
  }
  pKick(ws, me, id) {
    const pid = this.partyOf(me), p = pid ? this.one('SELECT leader FROM party WHERE pid = ?', pid) : null;
    if (!p || p.leader !== me) return sendTo(ws, { t: 'err', op: 'party', why: 'Only the party leader removes players.' });
    if (!ID_RE.test(id) || id === me || this.partyOf(id) !== pid) return;
    this.pLeave(id, 'removed');
  }
  pMsg(ws, a, m) {
    const pid = this.partyOf(a.id);
    if (!pid) return sendTo(ws, { t: 'err', op: 'party', why: 'You are not in a party.' });
    const text = cleanText(m.text);
    if (!text) return;
    const out = { t: 'pmsg', from: { id: a.id, name: a.name, tag: a.tag }, text, at: Date.now() };
    for (const r of this.rows('SELECT aid FROM pmem WHERE pid = ?', pid)) if (r.aid === a.id || !this.blocked(r.aid, a.id)) this.push(r.aid, out, ws);
  }
  // where the leader went (a world by its code, or a server; "menu": back out of it): the members'
  // games follow
  pWarp(a, m) {
    const pid = this.partyOf(a.id), p = pid ? this.one('SELECT leader FROM party WHERE pid = ?', pid) : null;
    if (!p || p.leader !== a.id) return;
    const at = Date.now();
    let to = null;
    if ((m.w === 'host' || m.w === 'join') && CODE_RE.test(String(m.code || ''))) to = { w: m.w, code: String(m.code), at };
    else if (m.w === 'server') {
      const sv = String(m.server || '').replace(/[^A-Za-z0-9.:_\-\/]/g, '').slice(0, 80);
      if (sv) to = { w: 'server', server: sv, at };
    } else if (m.w === 'menu') to = { w: 'menu', at };
    if (!to) return;
    this.sql.exec('UPDATE party SET warp = ? WHERE pid = ?', to.w === 'menu' ? null : JSON.stringify(to), pid);
    const out = Object.assign({ t: 'pwarp', from: { id: a.id, name: a.name, tag: a.tag } }, to);
    for (const r of this.rows('SELECT aid FROM pmem WHERE pid = ?', pid)) if (r.aid !== a.id) this.push(r.aid, out);
  }

  // a new recovery code for the account (an older one stops working)
  async setRecovery(ws, a, m) {
    const code = String(m.code || '');
    if (!KEY_RE.test(code)) return sendTo(ws, { t: 'err', op: 'recovery', why: 'That code did not arrive right. Try again.' });
    const salt = hex(crypto.getRandomValues(new Uint8Array(16))), hash = await pwHash(salt, code), now = Date.now();
    if (!this.one('SELECT 1 AS x FROM claim WHERE aid = ?', a.id)) return this.bye(ws, 'signed out');
    this.sql.exec('INSERT OR REPLACE INTO recov (aid, salt, hash, at) VALUES (?, ?, ?, ?)', a.id, salt, hash, now);
    this.push(a.id, { t: 'recok', at: now });
  }
  // a forgotten password: the name, the account's recovery code and a new password. The code is
  // used up, every device of the account is signed out, and this one is signed in
  async recover(ws, a, m) {
    const lname = String(m.name || '').toLowerCase(), code = String(m.code || ''), pw = String(m.pw || '');
    const err = (why) => sendTo(ws, { t: 'err', op: 'auth', why });
    if (!ACCT_RE.test(lname) || !KEY_RE.test(code) || !KEY_RE.test(pw)) return err('Wrong name or recovery code.');
    const c = this.one('SELECT * FROM claim WHERE lname = ?', lname);
    if (!c) return err('No account is called ' + String(m.name) + '.');
    const now = Date.now(), left = LOCK_MS - (now - c.failat);
    if (c.fails >= MAX_FAILS && left > 0) return err('Too many wrong tries for ' + c.name + '. Try again in ' + Math.ceil(left / 60000) + ' min.');
    if (a.iph) { const e = this.ips.get(a.iph); if (e && now - e.t <= IP_SPAN && e.fails >= IP_FAILS) return err('Too many wrong tries from your network. Try again in a few minutes.'); }
    const r = this.one('SELECT * FROM recov WHERE aid = ?', c.aid);
    if (!r) return err(c.name + ' has no recovery code, so its password cannot be reset.');
    const h = await pwHash(r.salt, code), salt = hex(crypto.getRandomValues(new Uint8Array(16))), hash = await pwHash(salt, pw);
    // (checked again after the wait)
    if ((ws.deserializeAttachment() || {}).id) return;
    const c2 = this.one('SELECT * FROM claim WHERE lname = ?', lname), r2 = c2 ? this.one('SELECT * FROM recov WHERE aid = ?', c2.aid) : null;
    if (!c2) return err('Wrong name or recovery code.');
    if (!r2 || !same(h, r2.hash)) {
      const f = (now - c2.failat < LOCK_MS ? c2.fails : 0) + 1;
      this.sql.exec('UPDATE claim SET fails = ?, failat = ? WHERE lname = ?', f, now, lname);
      if (a.iph) this.ipAllow(a.iph, 'fails', IP_FAILS);
      return err('That recovery code is not right for ' + c2.name + '.' + (f >= MAX_FAILS - 3 && f < MAX_FAILS ? ' ' + (MAX_FAILS - f) + ' more tries before a 15-minute wait.' : f >= MAX_FAILS ? ' Try again in 15 min.' : ''));
    }
    this.sql.exec('UPDATE claim SET salt = ?, hash = ?, fails = 0, failat = 0 WHERE lname = ?', salt, hash, lname);
    this.sql.exec('DELETE FROM recov WHERE aid = ?', c2.aid);
    this.sql.exec('DELETE FROM dev WHERE aid = ?', c2.aid);
    for (const s of this.socks(c2.aid)) this.bye(s, 'signed out');
    this.sql.exec('INSERT OR REPLACE INTO dev (did, aid, at) VALUES (?, ?, ?)', a.did, c2.aid, now);
    return this.signIn(ws, a, c2.aid);
  }
  // this device (all its tabs) signs out of the account
  logout(ws, a) {
    this.sql.exec('DELETE FROM dev WHERE did = ?', a.did);
    for (const s of this.socks(a.id)) { const x = s.deserializeAttachment() || {}; if (x.did === a.did) this.bye(s, 'logged out'); }
  }

  status(ws, a, m) {
    const s = cleanStatus(m.s), was = a.s ? a.s.w : null;
    if (JSON.stringify(s) === JSON.stringify(a.s || null)) return;
    a.s = s;
    this.keep(ws, a);
    if (a.share !== false) this.tellFriends(a.id);
    const pid = (s ? s.w : null) !== was && a.share !== false ? this.partyOf(a.id) : null;
    if (pid) this.tellParty(pid);
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
      list.push({ id: x.id, name: x.name, tag: x.tag, owner: isOwnerName(x.name) || undefined, friend: friends.has(x.id), req: out.has(x.id) ? 'out' : inc.has(x.id) ? 'in' : null });
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
    // the owner can message any Thunder player (for support); everyone else, only friends
    if (!a.owner && !this.isFriend(a.id, to)) return err('You can only message friends.');
    if (a.owner && !this.one('SELECT 1 AS x FROM acct WHERE id = ?', to)) return err('No such player.');
    const at = Date.now(), from = { id: a.id, name: a.name, tag: a.tag, owner: a.owner || undefined };
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
    const pid = this.partyOf(id);
    if (pid && !this.online(id)) this.tellParty(pid);
    try { ws.close(1000, 'bye'); } catch (e) { /* closed */ }
  }
}
