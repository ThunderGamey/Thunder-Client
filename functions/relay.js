// Thunder Client: /relay on the site, forwarded to Thunder's own relay (Cloudflare Pages Function).
// Part of Thunder Client, created and owned by Jayvardhan Ginni (ThunderGamey).
//
// The relay itself is the thunder-relay Worker (thunder-relay/relay.js). Reaching it through the
// site's own address means that wherever the game loads, the relay can be reached too. Setup
// (once): deploy thunder-relay, then in this Pages project > Settings > Bindings add a Service
// binding named RELAY pointing to it, and deploy again. Without the binding this answers 404 and
// Thunder uses the public Eaglercraft relays, as before. See thunder/NETWORKING.md.

export async function onRequest({ request, env }) {
  if (!env.RELAY) {
    return new Response(JSON.stringify({ relay: false, error: 'the Thunder relay is not set up for this site' }), {
      status: 404,
      headers: { 'content-type': 'application/json', 'cache-control': 'no-store', 'access-control-allow-origin': '*' },
    });
  }
  return env.RELAY.fetch(request);
}
