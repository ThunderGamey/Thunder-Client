# Playing together: Friends (open a singleplayer world, join with a code)

Thunder Client stays on Eaglercraft 1.12.2. The Friends feature lets one player open their
singleplayer survival world and lets friends join it with a short code, like Education Edition's
join codes or vanilla "Open to LAN", but across the internet. The world runs in the host's
browser; there is no server to rent.

Source: `thunder/thunder-lan.js` (pulled into `thunder-client.js` by `// @include`).

## How to use it

Host (in a singleplayer world):

1. Press **Esc** and click **Open to Friends** (the pause menu's "Open to LAN" button, which this
   build had greyed out), or press **Right Shift -> Friends -> Open to Friends**.
2. A code appears (for example `x361h`) in the Friends panel and in a small badge at the top of
   the screen. Tell your friends the code. Each world keeps its code: the next time you open the
   same world it has the same code, so friends can remember it. **New code** (Friends panel)
   gives the world a fresh one and the old one stops working.
3. Play normally. While the world is open it does not pause when you open a menu (vanilla LAN
   does the same), so your friends are never frozen.
4. The Friends panel lists who joined through the code; **Remove** sends one friend out with
   "The host removed you from the world."
5. **Stop sharing** (Friends panel) removes everyone with the message "The host stopped sharing
   the world." Save and Quit closes the world for everyone with the game's own "Server closed".

Friends (on Thunder Client, at the title screen):

1. **Right Shift -> Friends**, type the code in **Join a Friend**, press **Join** (or Enter).
2. The game's usual "connecting" screen appears, then you spawn in the host's world.
3. Leave with the pause menu's **Disconnect**, as on any server.

Everyone needs a different player name (Edit Profile on the title screen). A friend using the
host's name, or the name of someone already in, is refused with a message saying so instead of
kicking that player out.

## Play from any network: Thunder's own relay (site owner, once)

The public Eaglercraft relays hand out the join codes, and some networks (school filters,
extensions) block them; then codes cannot work at all. Some networks and managed laptops also
block every browser-to-browser connection, TURN included. Thunder's own relay fixes both: it runs
on the site owner's Cloudflare account (`thunder-relay/`, a Worker with a Durable Object) and is
reached through the site's own address (`/relay`, forwarded by `functions/relay.js`), so wherever
the game loads, the relay can be reached too.

- **Codes** come from it (6 characters, for example `k7m2qx`; the public relays' codes have 5).
  The public relays stay as the fallback when it is off. A world keeps its code: the first time a
  world is opened, the game makes a code and a secret key for it (kept in the browser's
  localStorage, `thunderWorldCodes_v1`, per world as the waypoints tell worlds apart) and asks the
  relay for that code with `?host=code&key=key`. The code's room keeps only a hash of the key and
  gives the code to no other world (a new world asking for a random code never lands on it); the
  same key opening it again takes over from an old connection (a reload). If the code is in use
  by another world, the relay hands out a new one and the game keeps that instead. A claim unused
  for 180 days is released. **New code** rolls a new code and key. The public relays choose their
  own codes, so a kept code only works through Thunder's relay.
- **The game itself** goes through it when two players cannot connect directly: a friend's game
  first tries a direct connection (and the TURN relay, if it is on), and after 10 seconds without
  one, or right away in a browser without WebRTC, both games open a WebSocket to the relay and it
  passes their packets between them. The friend's Friends panel then says "through the Thunder
  relay".

Set it up once:

1. Cloudflare dashboard -> **Workers & Pages** -> **Create application** -> **Import a
   repository** (connect GitHub if asked) -> pick this repository. On **Set up your
   application**:
   - **Project name**: `thunder-relay` (the name in `thunder-relay/wrangler.toml`)
   - **Build command**: leave empty; **Deploy command**: `npx wrangler deploy` (the default)
   - **Enable Preview builds**: off (only `main` is deployed)
   - **Advanced settings** -> **Path**: `/thunder-relay`
   - **API token**: leave it on **Create new token** (Cloudflare makes its own build token)

   Then **Deploy**. Cloudflare deploys it again by itself whenever `main` changes. If the build
   log ends with "root directory not found", the Path is misspelled: fix it under the Worker's
   **Settings** -> **Build**, then start a new build (**Deployments** -> **Retry build**, or any
   push to `main`); a build that already failed stays failed.
2. **Workers & Pages** -> the Pages project that serves the site (`thunderclient`) -> **Settings**
   -> **Bindings** -> **Add** -> **Service binding**: variable name `RELAY`, service
   `thunder-relay`. Save.
3. **Deployments** -> the latest one -> **Retry deployment** (bindings apply to new deployments;
   any push to `main` deploys the site again too).
4. Check: `https://thunderclient.pages.dev/relay` shows `{"relay":true,"version":1}` (before
   step 2 it shows `"relay":false`). In the game, **Right Shift -> Friends -> Connection test**
   should say "Thunder relay: works".

Everyone playing has to reload the page once, so their game knows about the relay (an older copy
of the page only looks on the public relays and will not find a 6-character code).

Cost: the Workers Free plan includes Durable Objects (in 2025: 100,000 requests a day, where 20
WebSocket messages count as one request, and 13,000 GB-s of running time a day). A code and a
connection set-up take a handful of requests. A game that goes through the relay uses more: Thunder
packs the game's packets into at most about 50 messages a second each way, so the free allowance
covers several hours of relayed play a day across all players, and direct or TURN connections use
none of it. On the free plan going over the allowance costs nothing: the relay just stops until the
next day (UTC), and codes come from the public relays meanwhile. Check Cloudflare's current
Workers pricing before relying on these numbers.

## Faster connections from other networks: the TURN relay (site owner, once)

Two tabs on one computer always connect. Two computers often cannot reach each other directly:
school and work Wi-Fi, Wi-Fi that keeps devices apart, and home routers without "NAT loopback"
block it (this is why Friends worked in two tabs on one Mac or one laptop, but not between
computers). Those connections have to go through a TURN relay. The public Eaglercraft relays
only hand out an old free TURN login (openrelay.metered.ca) that no longer works, so Thunder
brings its own: the site asks Cloudflare's TURN service for a login (`functions/turn.js`, a
Cloudflare Pages Function served at `/turn`) and every Friends connection uses it when a direct
path fails. Until it is switched on, `/turn` answers "TURN is not set up for this site" and
Friends works exactly as before.

1. In the Cloudflare dashboard of the account that hosts the site: **Realtime** (called Calls in
   older dashboards) -> **TURN Server** -> **Create**. Keep the page open: it shows the key's
   **Turn Token ID** and its **API Token** (the API token is shown once).
2. **Workers & Pages** -> the Pages project that serves the site (for `thunderclient.pages.dev`,
   the project named `thunderclient`) -> **Settings** -> **Variables and Secrets** -> add, for
   Production:
   - `TURN_KEY_ID` = the Turn Token ID (type Text)
   - `TURN_KEY_API_TOKEN` = the API Token (type **Secret**)
3. Deploy again (Deployments -> the latest one -> Retry deployment, or push any commit). The
   function only runs when the project is connected to this GitHub repository (Settings ->
   Builds shows the repository and the `main` branch); a project made by dragging files into the
   dashboard does not run `functions/`.
4. Check: open `https://thunderclient.pages.dev/turn`. Before step 1-3 it shows
   `{"iceServers":[],"error":"TURN is not set up for this site"}` (the function is there); after
   them it lists `turn:turn.cloudflare.com` addresses. If it shows the game's page instead, the
   project is not deploying `functions/` (see step 3). In the game, **Right Shift -> Friends ->
   Connection test** should say "TURN relay: works".

The API token never reaches the browser: the page only gets logins that stop working after 24
hours. Only connections that cannot go directly use the relay. Cloudflare has offered a free
monthly TURN allowance (1,000 GB a month in 2025) and bills beyond it; check the current prices on
Cloudflare's Realtime pricing page, and the usage in the dashboard. Cloudflare's own guide to TURN
keys: https://developers.cloudflare.com/realtime/turn/

Everyone can check their own network with **Right Shift -> Friends -> Connection test**: whether
the relays answer (school filters sometimes block them, and then codes cannot work at all),
whether the browser can reach the internet directly (STUN), and whether the TURN relay works
there.

## How it works

The server half of Eaglercraft's shared-world system is already in this build: the integrated
server (in its Web Worker) accepts extra player channels (IPC packet `0x0C`) and speaks
EaglercraftX's LAN framing on them. The browser half was never compiled in, and that is what
`thunder-lan.js` adds:

- **Relay (signalling).** EaglerSPRelay protocol version 1 over WebSocket. The host
  registers and gets the join code; a friend looks the code up; the relay passes the WebRTC
  offer/answer and ICE candidates between them. Relays are tried in order: the site's own
  Thunder relay (`/relay`, when the site has it; see above), then the list in
  `localStorage.thunderLanRelays` (JSON list, for a self-hosted relay), else
  the `relays` in the launcher's `eaglercraftXOpts`, else `wss://relay.deev.is/`,
  `wss://relay.lax1dude.net/`, `wss://relay.shhnowisnottheti.me/`. A relay drops a connection
  whose handshake comes more than 500 ms after it opened, and a heavy game frame can hold the page
  that long (a slow computer loading chunks just after entering a world), so the relay socket
  runs in a small Worker that sends the handshake the moment the connection opens (on the page
  if a Worker cannot start).
- **WebRTC data channel** ("lan", reliable and ordered) between the two browsers. Connection
  servers: Thunder's own STUN servers (Google, Cloudflare), the relay's list, and the site's TURN
  logins from `/turn` (see above) or a JSON list of `RTCIceServer` entries in
  `localStorage.thunderLanIce` (for trying another TURN server). If no path works, the message
  says why: no TURN relay on either side, a TURN relay the network blocks, or a network that
  blocks browser-to-browser connections. When connected, the friend's Friends panel says whether
  it went directly or through the TURN relay.
- **Tunnel (Thunder relay only).** When a friend's direct connection has not opened 10 seconds
  after the offer (or cannot start: no WebRTC on either side), the friend asks the relay for a
  tunnel (packet `0x20`); the relay answers both games with the friend's id and a one-time token,
  both open a WebSocket to `/relay?tunnel=` and, once the relay has paired the two, it passes
  their bytes through unchanged. To the rest of Thunder a tunnel looks like the data channel it
  replaces. Messages sent within 20 ms travel together (a 4-byte length before each), which keeps
  the relay's message count, and so Cloudflare's count, low. The relay itself
  (`thunder-relay/relay.js`) is one Durable Object per world code, holding everything in the
  WebSockets' attachments so it can sleep between messages; it only accepts the site's own pages
  (the `Origin` header), and a tunnel only with a token it handed out.
- **Host:** each friend's data channel is bridged to a player channel on the host's server
  Worker. Bytes pass through unchanged both ways; the Worker already frames and compresses them.
- **Friend:** the game's own singleplayer connecting screen and login run as usual; the local
  player's channel is carried over the data channel instead of to a local Worker. Packets from
  the host are unframed, inflated (zlib, `DecompressionStream`) and handed to the game in order.

Game functions it wraps (each wrapper falls through to the original; all names are checked by
`build.js` against the base's own deobfuscation table): `ClientPlatformSingleplayer.sendPacket`
(friend's outgoing packets), `SingleplayerServerController.setPaused` and
`GuiScreen.doesGuiPauseGame` (no pause while hosting), `SingleplayerServerController.killWorker`
(the connecting screen's Cancel ends a join instead of killing the local world Worker),
`GuiIngameMenu.initGui`/`actionPerformed` (the pause menu button) and
`ServerNotificationManager.runTick`. That last one: a friend leaving the world (the host stopped
sharing, removed them or closed the world) is handled inside the game's own tick, where the
singleplayer connection tears the world down on the spot and destroys the connection's
notification manager; the same tick then ran that manager's 2.5-second timer on it, which crashed
the friend's game whenever the timer happened to be due in that tick (one leave in three in the
slow test browser). A destroyed manager now just returns. Before a
friend's login, the game session's name is copied from the profile (`EaglerProfile.setName`):
Quick Start skips the start-up Edit Profile screen that normally does this, and a friend who
joined first thing logged in with the random start-up name instead of their own. Steps that must run on the
game thread (such as opening the connecting screen) go through the shared runner in
`thunder-client.js`, which runs them from `RateLimitTracker.tick` once per frame.

## What was tested

Three separate Chromium browsers (host, two friends) on this build, through the official
EaglerSPRelay 0.1a running locally (`localStorage.thunderLanRelays = '["ws://127.0.0.1:6699/"]'`;
the public relays are not reachable from the test machine). Every step used the real game and
real mouse/keyboard input unless noted.

| Scenario | Result |
|---|---|
| Esc -> **Open to Friends** in the pause menu | world opens, relay assigns a code (e.g. `zr2tz`), Friends panel and top badge show it; the pause-menu button then reads `Friends: <code>` |
| Friend types the code in Right Shift -> Friends -> Join | connecting screen, then spawns next to the host; host log `YeeishYeer3756[channel:...] logged in`, chat "joined the game"; each sees the other (name tag, armor, held items) |
| Friend chats while the host has the pause menu open | the host receives it: neither the server nor the host's client paused |
| Friend -> pause menu -> **Disconnect** | friend lands on the Multiplayer screen; host log "left the game" |
| Host clicks **Remove** next to a friend | friend: "Connection Lost - The host removed you from the world." |
| Host clicks **Stop sharing** | friend: "Connection Lost - The host stopped sharing the world." |
| Host **Save and Quit** with a friend in | friend: the game's own "Connection Lost - Server closed"; the host's world saves normally; the host can re-enter and share again |
| Friend uses the host's name | friend: "Failed to connect - The host of this world is also called ...", the host stays in |
| Second friend uses the first friend's name | refused with "Someone called ... is already in this world", the first friend keeps playing |
| Wrong code / code of a world no longer shared / code typed in capitals | "no open world has the code ..."; capitals are retried in lower case automatically |
| Host answers too late (test held the first offer 12 s; the relay allows 10 s) | the friend retries automatically and joins on the second attempt |
| The join screen's own **Cancel Task** | back to the title screen, join ended, host drops the half-joined friend; the friend's own singleplayer still works (created and entered a new world afterwards) |
| Rest of Thunder on the same build | shader self-test 263/263 programs, GL error 0; HUD, Hand Item Size, Hitboxes, menu unchanged; no page errors in any browser |

Second round (TURN relay, Connection test and fixes), same setup, two Chromium browsers, plus a
local TURN server (node-turn) handed out through a test `/turn`. "TURN only" means both browsers
were forced to use relay paths only, as on a network where direct connections are impossible.

| Scenario | Result |
|---|---|
| No TURN on the site (`/turn` 404), normal join | joins as before ("connected directly"); TURN state "none" |
| TURN only, through the site's TURN relay | joins; both sides report "through the TURN relay"; chat goes through |
| TURN only, no TURN on the site | fails after 20 s with "...often need a TURN relay, and this site has none set up yet" (before: three relay time-outs, 30 s, "did not answer in time") |
| TURN only, the site's TURN server unreachable | fails after 20 s with "The TURN relay could not be reached from either network..." |
| The site's TURN unreachable, normal join | joins directly in 8 s: a dead TURN server does not slow joining down |
| `/turn` answers garbage (misconfigured) | "this site's TURN relay did not answer (error)"; the Connection test card says the same |
| Connection test card | "Relays: 1 of 1 answered. Internet (STUN): yes. TURN relay: works. ..." |
| Open to Friends right after entering the world (failed 2 of 3 times before in this slow test browser: handshake too late) | opens every time; the relay logs the handshake 1 ms after the connection opened |
| No Worker in the browser / a Worker that fails to start | the relay socket runs on the page instead; hosting and joining work |
| A friend joins first thing after opening the page | logs in with their profile name (before: a random start-up name such as "YeegYee0908") |
| Friend's profile name = the host's name | refused with "The host of this world is also called ..." |
| Host stops sharing (3 times), removes the friend, saves and quits, and the host's tab closes, with the friend's notification timer forced due on every tick | the friend always lands on "Connection Lost" with the reason; no crash (before: the friend's game crashed once in three stops, "Cannot read properties of null (reading 'g')" in `ServerNotificationManager.runTick`) |
| Friend keeps their own pause menu open for 40 s | stays in the world; chat afterwards reaches the host |
| Browser without `DecompressionStream` | Join says the browser is too old instead of failing later |
| `functions/turn.js` in Node with Cloudflare's API mocked | not set up -> 404; set up -> Cloudflare's list with port 53 removed, key sent only as the Bearer token, 24 h logins; other sites -> 403; Cloudflare error -> 502 |

Third round (Thunder's own relay). The relay Worker (`thunder-relay/`) and the site (`functions/`)
ran in Cloudflare's own runtime (wrangler 4, workerd): the Worker with its Durable Object under
`wrangler dev`, the site under `wrangler pages dev` with the Service binding `RELAY`, exactly as
deployed. Two Chromium browsers, as before.

| Scenario | Result |
|---|---|
| Relay protocol, from Node (24 checks) | host gets a 6-character code and the STUN list; unknown code -> error 5; code typed in capitals works; offer, answer and candidates pass both ways with the friend's id; 0x05 -> host told, friend closed; tunnel token to both ends; wrong or reused token -> 403; tunnel passes bytes unchanged both ways (200 KB in one message too); keepalive answered; host leaving -> friends still signalling get "the world was closed", tunnels keep working; one tunnel end closing closes the other; other sites -> 403 |
| Host opens, friend joins through the Thunder relay | code `nz6g75` from the relay, friend joins, connection direct |
| No direct path possible (both browsers limited to TURN, no TURN server) | after 10 s the friend asks for the tunnel and joins through it (16 s in all); chat both ways; the host's list says "(through the Thunder relay)" |
| Through the tunnel: host stops sharing / removes the friend / friend disconnects / host saves and quits | "The host stopped sharing the world." / "The host removed you from the world." / host sees "left the game" / "The host closed the world."; no crash, no page errors |
| Friend's browser without WebRTC | straight to the tunnel, joined in 2 s |
| Host's browser without WebRTC | the host asks the friend to use the tunnel (0x22), joined in 2 s |
| Public relays unreachable | the code comes from the Thunder relay and the friend joins |
| Site without the relay (no binding) | `/relay` answers `"relay":false`, both games use the public relay (5-character code) and join; the Connection test says "Thunder relay: not set up on this site" |
| Worker reached directly from another origin, or the site from another origin | 403; through the site's own pages: accepted |
| Connection test with the relay on | "Thunder relay: works. ... Friends can join from any network where this page loads" |

Not tested: the public internet relays, Cloudflare's hosted services themselves (TURN, and the
relay running on Cloudflare rather than in its local runtime) and real home/school networks (no
internet access from the test machine). The relay protocol, codes and messages are the ones the
official relay uses, so the public relays behave the same; the TURN relay behaves like the local
one, and Cloudflare runs the Thunder relay on the same runtime it was tested on here. What a
network lets through still depends on each network.

## Limits

- Everyone must be on Thunder Client (this build). Other Eaglercraft 1.12 clients have no join
  support, and EaglercraftX 1.8 clients speak a different game version.
- With the Thunder relay on, playing needs only what the game itself needs: the page loads, and
  its WebSockets to the same site work (a network that blocks those blocks nearly every web game).
  A friend on a network where no direct connection works waits about 10 seconds before the game
  goes through the relay, and a game through the relay is as fast as the two connections to
  Cloudflare, usually a little slower than a direct one.
- Without the Thunder relay, codes come from the public relays, run by the Eaglercraft community.
  If all of them are down or blocked, sharing cannot start; a self-hosted EaglerSPRelay can be set
  in `localStorage.thunderLanRelays` (see above). And some networks (many school and work Wi-Fi
  networks) block direct browser-to-browser connections: with the TURN relay on, friends connect
  through it; without it, or on a network that blocks it too, the join fails after about 20
  seconds with a message saying which.
- The Thunder relay and the TURN relay run within Cloudflare's free allowances (see above); past
  them, relayed games stop until the next day on the free plan.
- The host's browser runs the world, so the host's computer speed and upload bandwidth set the
  limit. A few friends is fine; a large group is not what this is for.
- Friends already in keep playing if the relay connection drops; new friends need the host to
  press **Reopen** for a new code.
- The integrated server has no `/kick` (vanilla LAN does not either); use **Remove** in the host's
  Friends panel.
