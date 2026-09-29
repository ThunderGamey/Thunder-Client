// Thunder Client: TURN logins for the Friends feature (Cloudflare Pages Function, served at /turn).
// Part of Thunder Client, created and owned by Jayvardhan Ginni (ThunderGamey).
//
// Friends connect browser to browser (WebRTC). When two computers cannot reach each other
// directly (school Wi-Fi, Wi-Fi that keeps devices apart, some home routers), the connection has
// to go through a TURN relay. Cloudflare runs one (Cloudflare Realtime TURN); this function asks
// it for logins that last a day, so the long-term key never reaches the browser.
//
// Setup (once): Cloudflare dashboard > Realtime > TURN Server > Create, then in this Pages project
// > Settings > Variables and Secrets add TURN_KEY_ID (the key's ID) and TURN_KEY_API_TOKEN (its
// API token, as a secret), and deploy again. Without them this answers 404 and Thunder connects
// without a TURN relay, as before. See thunder/NETWORKING.md.

const JSON_HEADERS = { 'content-type': 'application/json', 'cache-control': 'no-store' };

function reply(body, status) {
  return new Response(JSON.stringify(body), { status: status || 200, headers: JSON_HEADERS });
}

// Browsers do not connect to port 53, so those addresses would only slow the connection down.
function usable(server) {
  const urls = [].concat(server && server.urls || []).filter((u) => !/^(stuns?|turns?):[^?]*:53(\?|$)/i.test(String(u)));
  return urls.length ? Object.assign({}, server, { urls }) : null;
}

export async function onRequestGet({ request, env }) {
  if (!env.TURN_KEY_ID || !env.TURN_KEY_API_TOKEN) {
    return reply({ iceServers: [], error: 'TURN is not set up for this site' }, 404);
  }
  // only for this site's own pages (a browser sends the page it is on as Referer or Origin)
  const self = new URL(request.url).origin;
  const from = request.headers.get('Origin') || request.headers.get('Referer') || '';
  if (from && from !== self && !from.startsWith(self + '/')) {
    return reply({ iceServers: [], error: 'not allowed from ' + from }, 403);
  }
  try {
    const r = await fetch(
      'https://rtc.live.cloudflare.com/v1/turn/keys/' + encodeURIComponent(env.TURN_KEY_ID) + '/credentials/generate-ice-servers',
      {
        method: 'POST',
        headers: { Authorization: 'Bearer ' + env.TURN_KEY_API_TOKEN, 'Content-Type': 'application/json' },
        body: JSON.stringify({ ttl: 86400 }),
      }
    );
    if (!r.ok) return reply({ iceServers: [], error: 'Cloudflare TURN answered ' + r.status }, 502);
    const data = await r.json();
    const list = Array.isArray(data.iceServers) ? data.iceServers : data.iceServers ? [data.iceServers] : [];
    return reply({ iceServers: list.map(usable).filter(Boolean) });
  } catch (e) {
    return reply({ iceServers: [], error: 'could not reach Cloudflare TURN' }, 502);
  }
}
