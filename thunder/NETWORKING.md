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
   the screen. Tell your friends the code.
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

## Friends on other networks: switch on the TURN relay (site owner, once)

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

- **Relay (signalling only).** EaglerSPRelay protocol version 1 over WebSocket. The host
  registers and gets the join code; a friend looks the code up; the relay passes the WebRTC
  offer/answer and ICE candidates between them. It never sees game traffic. Relays are tried in
  order: the list in `localStorage.thunderLanRelays` (JSON list, for a self-hosted relay), else
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

Not tested: the public internet relays, Cloudflare's real TURN service and real home/school
networks (no internet access from the test machine). The relay protocol, codes and messages are
the ones the official relay uses, so the public relays behave the same, and the TURN relay
behaves like the local one, but what a network lets through depends on each network.

## Limits

- Everyone must be on Thunder Client (this build). Other Eaglercraft 1.12 clients have no join
  support, and EaglercraftX 1.8 clients speak a different game version.
- The public relays are run by the Eaglercraft community, not by Thunder. If all of them are
  down, sharing cannot start; a self-hosted EaglerSPRelay can be set in
  `localStorage.thunderLanRelays` (see above).
- Some networks (many school and work Wi-Fi networks) block direct browser-to-browser
  connections. With the site's TURN relay switched on (see above) friends connect through it;
  without it, or on a network that blocks the TURN relay too, the join fails after about 20
  seconds with a message saying which. Networks that block the Eaglercraft relays themselves
  cannot use codes at all (the Connection test shows it).
- The host's browser runs the world, so the host's computer speed and upload bandwidth set the
  limit. A few friends is fine; a large group is not what this is for.
- Friends already in keep playing if the relay connection drops; new friends need the host to
  press **Reopen** for a new code.
- The integrated server has no `/kick` (vanilla LAN does not either); use **Remove** in the host's
  Friends panel.
