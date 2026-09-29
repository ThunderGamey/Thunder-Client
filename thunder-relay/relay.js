// Thunder Client: Thunder's own relay for Friends (a Cloudflare Worker with a Durable Object).
// Part of Thunder Client, created and owned by Jayvardhan Ginni (ThunderGamey).
//
// Join codes from the public Eaglercraft relays stop working on networks that block those relays,
// and some networks and devices (school Wi-Fi, managed laptops) block browser-to-browser
// connections, TURN included. This relay runs on the site owner's own Cloudflare account and is
// reached through the site's own address (/relay, forwarded by functions/relay.js), so wherever the
// game itself loads, the relay can be reached:
//  - signalling: the EaglerSPRelay protocol (version 1) that Thunder already speaks to the public
//    relays: a host registers and gets a code, friends look the code up, and the WebRTC offer,
//    answer and ICE candidates are passed between them. One Durable Object per world code.
//  - tunnel: when the two players still cannot connect directly (not even through TURN), each opens
//    a second WebSocket (?tunnel=) and the Durable Object passes the game's bytes between the two,
//    unchanged. Thunder only falls back to it after the direct connection had its chance.
//
// Deploy (once): Cloudflare dashboard > Workers & Pages > Create > Import a repository > this
// repository, root directory thunder-relay; then in the Pages project > Settings > Bindings add a
// Service binding RELAY -> thunder-relay and deploy the site again. See thunder/NETWORKING.md.
//
// Packets (ids and layouts as in EaglerSPRelay protocol 1, strings are 8-bit characters with a
// 1-byte (s8) or 2-byte big-endian (s16) length):
//   0x00 handshake [type 1=host 2=friend][version 1][code s8]    0x01 ICE servers
//   0x02 new friend [id s8]   0x03 candidates / 0x04 description [id s8][text s16]
//   0x05 friend connected / 0x06 friend failed [id s8]   0xFE friend done [id s8][code][text s16]
//   0xFF error [code][text s16]
// Thunder's own additions:
//   0x20 tunnel [id s8][token s16]: a friend asks for the tunnel (empty id and token); the relay
//        answers both the friend and the host with the friend's id and a one-time token
//   0x22 use the tunnel [id s8][s16]: the host has no WebRTC and asks the friend to use it

const CODE_CHARS = 'abcdefghijkmnpqrstuvwxyz23456789';     // no 0/o or 1/l to mix up
const CODE_LEN = 6;                                         // the public relays use 5
const ID_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
const MAX_FRIENDS = 32;                                     // friends in signalling at once, per world
const MAX_PACKET = 65536;                                   // signalling packets (tunnels pass anything)
const STUN = ['stun:stun.l.google.com:19302', 'stun:stun.cloudflare.com:3478'];

function rand(chars, n) {
  const b = new Uint8Array(n);
  crypto.getRandomValues(b);
  let s = '';
  for (let i = 0; i < n; i++) s += chars[b[i] % chars.length];
  return s;
}

function json(body, status) {
  return new Response(JSON.stringify(body), {
    status: status || 200,
    headers: { 'content-type': 'application/json', 'cache-control': 'no-store' },
  });
}

// Only pages of the site itself (the request came through its /relay) or the sites listed in the
// SITES variable (comma-separated origins) may use the relay. Browsers always send Origin on
// WebSocket connections.
function allowed(request, env) {
  const origin = request.headers.get('Origin');
  if (!origin) return true;
  if (origin === new URL(request.url).origin) return true;
  return String(env.SITES || '').split(',').map((s) => s.trim()).filter(Boolean).includes(origin);
}

function room(env, code, request, params) {
  const u = new URL('https://room/');
  u.searchParams.set('code', code);
  for (const k of Object.keys(params)) u.searchParams.set(k, params[k]);
  return env.ROOMS.get(env.ROOMS.idFromName(code)).fetch(new Request(u, request));
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname !== '/relay') return json({ error: 'not found' }, 404);
    if (!allowed(request, env)) return json({ error: 'not allowed from ' + request.headers.get('Origin') }, 403);
    if ((request.headers.get('Upgrade') || '').toLowerCase() !== 'websocket') return json({ relay: true, version: 1 });
    const q = url.searchParams;
    if (q.has('host')) {
      // a new world: a free code (the room answers 409 when its code is taken)
      for (let i = 0; i < 8; i++) {
        const r = await room(env, rand(CODE_CHARS, CODE_LEN), request, { role: 'host' });
        if (r.status !== 409) return r;
      }
      return json({ error: 'no free code, try again' }, 503);
    }
    const code = String(q.get('join') || q.get('tunnel') || '').toLowerCase();
    if (!/^[a-z0-9]{1,16}$/.test(code)) return json({ error: 'bad code' }, 400);
    if (q.has('join')) return room(env, code, request, { role: 'join' });
    return room(env, code, request, {
      role: 'tunnel', peer: q.get('peer') || '', token: q.get('token') || '', side: q.get('side') === 'h' ? 'h' : 'f',
    });
  },
};

// ---- packets ----
function a8(b, s) { s = String(s || '').slice(0, 255); b.push(s.length); for (let i = 0; i < s.length; i++) b.push(s.charCodeAt(i) & 255); }
function a16(b, s) { s = String(s || '').slice(0, 65535); b.push((s.length >> 8) & 255, s.length & 255); for (let i = 0; i < s.length; i++) b.push(s.charCodeAt(i) & 255); }
function pkt(id, fill) { const b = [id]; if (fill) fill(b); return new Uint8Array(b).buffer; }
function peerPkt(id, peer, text) { return pkt(id, (b) => { a8(b, peer); a16(b, text); }); }
function idPkt(id, peer) { return pkt(id, (b) => a8(b, peer)); }
function donePkt(peer, code, text) { return pkt(0xFE, (b) => { a8(b, peer); b.push(code & 255); a16(b, text); }); }
function errPkt(code, text) { return pkt(0xFF, (b) => { b.push(code & 255); a16(b, text); }); }
function icePkt() {
  return pkt(0x01, (b) => {
    b.push((STUN.length >> 8) & 255, STUN.length & 255);
    for (const u of STUN) { b.push(0x53); a16(b, u); a8(b, ''); a8(b, ''); }    // 'S' = STUN
  });
}
function readPacket(d) {
  let i = 0;
  const u8 = () => { if (i >= d.length) throw new Error('packet too short'); return d[i++]; };
  const str = (n) => { let s = ''; for (let k = 0; k < n; k++) s += String.fromCharCode(u8()); return s; };
  const p = { id: u8() };
  switch (p.id) {
    case 0x00: p.type = u8(); p.ver = u8(); p.code = str(u8()); break;
    case 0x02: case 0x05: case 0x06: p.peer = str(u8()); break;
    case 0x03: case 0x04: case 0x20: case 0x22: p.peer = str(u8()); p.text = str((u8() << 8) | u8()); break;
    case 0xFE: p.peer = str(u8()); p.code = u8(); p.text = str((u8() << 8) | u8()); break;
    default: p.other = true;
  }
  return p;
}
function send(ws, data) { try { ws.send(data); } catch (e) { /* already closed */ } }
function shut(ws, reason) { try { ws.close(1000, reason || 'bye'); } catch (e) { /* already closed */ } }

// ---- one world (code) ----
// State lives in the sockets' attachments, so the object can hibernate between messages and wake
// up with everything it needs: host {r:'h', code, hs, toks: {friend id: tunnel token}},
// friend {r:'f', code, id, hs, done, tun}, tunnel end {r:'t', peer, side 'h'|'f', live}.
export class ThunderRelay {
  constructor(ctx, env) {
    this.ctx = ctx;
    this.env = env;
    // the host's keepalive, answered without waking the object up
    try { ctx.setWebSocketAutoResponse(new WebSocketRequestResponsePair('ping', 'pong')); } catch (e) { /* older runtime */ }
  }

  host(except) {
    for (const ws of this.ctx.getWebSockets('h')) if (ws !== except) return ws;
    return null;
  }

  friend(id) {
    const f = this.ctx.getWebSockets('f:' + id);
    return f.length ? f[0] : null;
  }

  async fetch(request) {
    if ((request.headers.get('Upgrade') || '').toLowerCase() !== 'websocket') return new Response('websocket only', { status: 426 });
    const q = new URL(request.url).searchParams;
    const role = q.get('role'), code = q.get('code') || '';
    let att, tags;
    if (role === 'host') {
      if (this.host()) return new Response('code taken', { status: 409 });
      att = { r: 'h', code, hs: 0, toks: {} };
      tags = ['h'];
    } else if (role === 'join') {
      if (this.ctx.getWebSockets('f').length >= MAX_FRIENDS) return new Response('too many friends connecting', { status: 429 });
      att = { r: 'f', code, id: rand(ID_CHARS, 16), hs: 0, done: 0, tun: 0 };
      tags = ['f', 'f:' + att.id];
    } else if (role === 'tunnel') {
      const peer = q.get('peer') || '', token = q.get('token') || '', side = q.get('side') === 'h' ? 'h' : 'f';
      const h = this.host();
      const ha = h && h.deserializeAttachment();
      if (!peer || !token || !ha || !ha.toks || ha.toks[peer] !== token) return new Response('no such tunnel', { status: 403 });
      if (this.ctx.getWebSockets('t:' + peer).some((ws) => (ws.deserializeAttachment() || {}).side === side)) {
        return new Response('this end of the tunnel is taken', { status: 409 });
      }
      att = { r: 't', peer, side, live: 0 };
      tags = ['t:' + peer];
    } else {
      return new Response('bad role', { status: 400 });
    }
    const pair = new WebSocketPair();
    this.ctx.acceptWebSocket(pair[1], tags);
    pair[1].serializeAttachment(att);
    return new Response(null, { status: 101, webSocket: pair[0] });
  }

  async webSocketMessage(ws, msg) {
    const a = ws.deserializeAttachment();
    if (!a) return;
    if (a.r === 't') return this.fromTunnel(ws, a, msg);
    if (typeof msg === 'string') return;                    // keepalive text
    if (msg.byteLength > MAX_PACKET) return this.refuse(ws, 2, 'packet too large');
    let p;
    try { p = readPacket(new Uint8Array(msg)); } catch (e) { return this.refuse(ws, 2, 'invalid packet'); }
    if (p.other) return;
    if (a.r === 'h') return this.fromHost(ws, a, p);
    return this.fromFriend(ws, a, p);
  }

  refuse(ws, code, text) {
    send(ws, errPkt(code, text));
    shut(ws, text);
  }

  fromHost(ws, a, p) {
    if (!a.hs) {
      if (p.id !== 0x00 || p.type !== 1) return this.refuse(ws, 3, 'expected the host handshake');
      if (p.ver !== 1) return this.refuse(ws, 1, 'protocol version not supported');
      a.hs = 1;
      ws.serializeAttachment(a);
      send(ws, pkt(0x00, (b) => { b.push(1, 1); a8(b, a.code); }));
      send(ws, icePkt());
      return;
    }
    const f = p.peer ? this.friend(p.peer) : null;
    if (!f) return;
    switch (p.id) {
      case 0x03: case 0x04: send(f, peerPkt(p.id, p.peer, p.text)); return;
      case 0x22: send(f, peerPkt(0x22, p.peer, '')); return;
      case 0xFE: {
        const fa = f.deserializeAttachment();
        if (fa) { fa.done = 1; f.serializeAttachment(fa); }
        send(f, donePkt(p.peer, p.code, p.text));
        shut(f, 'removed by the host');
        return;
      }
      default:
    }
  }

  fromFriend(ws, a, p) {
    const h = this.host();
    const ha = h && h.deserializeAttachment();
    if (!a.hs) {
      if (p.id !== 0x00 || p.type !== 2) return this.refuse(ws, 3, 'expected the client handshake');
      if (p.ver !== 1) return this.refuse(ws, 1, 'protocol version not supported');
      if (!h || !ha || !ha.hs || String(p.code).toLowerCase() !== a.code) return this.refuse(ws, 5, 'Invalid code, no LAN world found!');
      a.hs = 1;
      ws.serializeAttachment(a);
      send(ws, pkt(0x00, (b) => { b.push(2, 1); a8(b, a.code); }));
      send(ws, icePkt());
      send(h, idPkt(0x02, a.id));
      return;
    }
    if (!h || !ha) return this.refuse(ws, 6, 'the world was closed');
    switch (p.id) {
      case 0x03: case 0x04:
        send(h, peerPkt(p.id, a.id, p.text));
        return;
      case 0x05: case 0x06:
        send(h, idPkt(p.id, a.id));
        a.done = 1;
        ws.serializeAttachment(a);
        send(ws, donePkt(a.id, p.id === 0x05 ? 0 : 1, p.id === 0x05 ? 'Successful connection' : 'Failed connection'));
        shut(ws, 'signalling done');
        return;
      case 0x20: {
        // the tunnel: a one-time token for this friend, sent to both ends. The host's attachment
        // holds the tokens not used yet (a few at most: each is removed when its tunnel opens).
        const token = rand(ID_CHARS, 20);
        const toks = ha.toks || {};
        const keys = Object.keys(toks);
        while (keys.length >= 16) delete toks[keys.shift()];
        toks[a.id] = token;
        ha.toks = toks;
        h.serializeAttachment(ha);
        a.tun = 1;
        ws.serializeAttachment(a);
        send(h, peerPkt(0x20, a.id, token));
        send(ws, peerPkt(0x20, a.id, token));
        return;
      }
      default:
    }
  }

  // Tunnel ends say "hello" once open; when both ends have, both get "ready" and from then on
  // every binary message goes to the other end unchanged.
  fromTunnel(ws, a, msg) {
    const ends = this.ctx.getWebSockets('t:' + a.peer);
    if (typeof msg === 'string') {
      if (msg !== 'hello' || a.live) return;
      a.live = 1;
      ws.serializeAttachment(a);
      const live = ends.filter((e) => (e.deserializeAttachment() || {}).live);
      if (live.length === 2) {
        const h = this.host();
        const ha = h && h.deserializeAttachment();
        if (ha && ha.toks && ha.toks[a.peer]) { delete ha.toks[a.peer]; h.serializeAttachment(ha); }
        for (const e of live) send(e, 'ready');
      }
      return;
    }
    for (const e of ends) if (e !== ws) send(e, msg);
  }

  async webSocketClose(ws) { this.gone(ws); }

  async webSocketError(ws) { this.gone(ws); }

  gone(ws) {
    const a = ws.deserializeAttachment();
    if (!a || a.gone) return;
    a.gone = 1;
    try { ws.serializeAttachment(a); } catch (e) { /* closed */ }
    if (a.r === 'h') {
      // the world is closed to new friends; friends already playing through a tunnel keep playing
      for (const f of this.ctx.getWebSockets('f')) { send(f, errPkt(6, 'the world was closed')); shut(f, 'the world was closed'); }
    } else if (a.r === 'f') {
      const h = this.host(ws);
      if (h && a.hs && !a.done && !a.tun) send(h, donePkt(a.id, 2, 'Client disconnected'));
    } else if (a.r === 't') {
      for (const e of this.ctx.getWebSockets('t:' + a.peer)) if (e !== ws) shut(e, 'the other end left');
    }
    shut(ws);
  }
}
