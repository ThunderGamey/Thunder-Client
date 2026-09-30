// Thunder Client: /social on the site, forwarded to Thunder's own relay Worker (Cloudflare Pages
// Function). Thunder Friends (the friends list, who is online and messages) talks to it.
// Part of Thunder Client, created and owned by Jayvardhan Ginni (ThunderGamey).
//
// It uses the same Service binding RELAY as /relay (functions/relay.js); the Worker sends /social
// to its friends hub (thunder-relay/social.js). Without the binding this answers 404 and Thunder
// Friends says it is not available on this site. See thunder/NETWORKING.md.

export async function onRequest({ request, env }) {
  if (!env.RELAY) {
    return new Response(JSON.stringify({ social: false, error: 'Thunder Friends is not set up for this site' }), {
      status: 404,
      headers: { 'content-type': 'application/json', 'cache-control': 'no-store' },
    });
  }
  return env.RELAY.fetch(request);
}
