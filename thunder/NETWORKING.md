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
  `wss://relay.lax1dude.net/`, `wss://relay.shhnowisnottheti.me/`.
- **WebRTC data channel** ("lan", reliable and ordered) directly between the two browsers, using
  the STUN/TURN servers the relay hands out.
- **Host:** each friend's data channel is bridged to a player channel on the host's server
  Worker. Bytes pass through unchanged both ways; the Worker already frames and compresses them.
- **Friend:** the game's own singleplayer connecting screen and login run as usual; the local
  player's channel is carried over the data channel instead of to a local Worker. Packets from
  the host are unframed, inflated (zlib, `DecompressionStream`) and handed to the game in order.

Game functions it wraps (each wrapper falls through to the original; all names are checked by
`build.js` against the base's own deobfuscation table): `ClientPlatformSingleplayer.sendPacket`
(friend's outgoing packets), `SingleplayerServerController.setPaused` and
`GuiScreen.doesGuiPauseGame` (no pause while hosting), `SingleplayerServerController.killWorker`
(the connecting screen's Cancel ends a join instead of killing the local world Worker) and
`GuiIngameMenu.initGui`/`actionPerformed` (the pause menu button). Steps that must run on the
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

Not tested: the public internet relays and real home/school networks (no internet access from
the test machine). The relay protocol, codes and messages are the ones the official relay uses,
so the public relays behave the same, but NAT/firewall behaviour depends on each network.

## Limits

- Everyone must be on Thunder Client (this build). Other Eaglercraft 1.12 clients have no join
  support, and EaglercraftX 1.8 clients speak a different game version.
- The public relays are run by the Eaglercraft community, not by Thunder. If all of them are
  down, sharing cannot start; a self-hosted EaglerSPRelay can be set in
  `localStorage.thunderLanRelays` (see above).
- Some networks (many school and work Wi-Fi networks) block direct browser-to-browser
  connections. Then the join fails after about 20 seconds with a message saying so; the TURN
  servers the relay provides help on some of those networks, not all.
- The host's browser runs the world, so the host's computer speed and upload bandwidth set the
  limit. A few friends is fine; a large group is not what this is for.
- Friends already in keep playing if the relay connection drops; new friends need the host to
  press **Reopen** for a new code.
- The integrated server has no `/kick` (vanilla LAN does not either); use **Remove** in the host's
  Friends panel.
