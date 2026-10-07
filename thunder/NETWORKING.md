# Playing together: Friends (open a singleplayer world, join with a code) and Thunder Friends

Thunder Client stays on Eaglercraft 1.12.2. The Friends feature lets one player open their
singleplayer survival world and lets friends join it with a short code, like Education Edition's
join codes or vanilla "Open to LAN", but across the internet. The world runs in the host's
browser; there is no server to rent. Thunder Friends adds a friends list across Thunder Client,
chat with in-game pop-ups, and joining friends' worlds from the list.

Source: `thunder/thunder-lan.js` and `thunder/thunder-social.js` (pulled into `thunder-client.js`
by `// @include`); the relay and the friends hub: `thunder-relay/`.

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

## Always open: a computer that keeps one world open

For a computer that is left on for friends (an old laptop, for example): the world opens by
itself and stays open, so friends can join with its code whenever they like.

Switch it on in the world: **Right Shift -> Friends -> Open to Friends -> Always open this world**
(it is shared right away). From then on, on this computer:

- **When Thunder starts**, a banner at the top counts down 10 seconds ("Always open: opening ...
  for friends", with **Open now** and **Not now**), then the world loads and is shared with its
  code. A freshly started browser first shows the game's own "press any key to enable sound"
  screen: the game starts after one key press or click, and Always open takes it from there.
- **If the relay connection drops**, the world is shared again after 5 seconds (then 10, 20, up to
  a minute apart while it keeps failing), with the same code. Friends already in keep playing. A
  connection that silently stops working (the relay no longer answers the keepalive for 100
  seconds) counts as dropped too.
- **If the world stops with nobody at the computer** (no key, click or mouse movement for 15
  seconds: the server crashed, for example), it is loaded and shared again after the countdown,
  at most 3 times in half an hour; then Always open stops and says so.
- **If you leave the world yourself** (Save and Quit), or play another world or a server, it stays
  closed until nobody has touched the computer for 5 minutes, or Thunder starts again.
  **Stop sharing** switches Always open off. The Friends panel always shows what it is doing.
- If the world is gone (deleted or renamed), Always open stops with a message saying so.

While the world is open, Thunder asks the browser to keep the screen on (Screen Wake Lock) and
keeps a WebRTC data channel open inside the page: Chrome slows the timers of a tab that has been
hidden for 5 minutes to one wake-up a minute unless the page uses WebRTC, and that would slow
the host's own game down. To leave the computer running:

1. Keep the tab open and on screen (its own window is best). The screen stays on while it is.
2. Plug the computer in. If the tab may get hidden or minimized, also set the computer to never
   sleep while plugged in (the screen lock does not apply to a hidden tab).
3. Chrome or Edge: **Settings -> Performance**, add the site to the sites that are always kept
   active, so the browser never puts the tab to sleep.
4. After a restart: open the site (the browser can be set to open it when it starts) and press a
   key once.

Kept in the browser (`localStorage.thunderAlwaysOpen_v1`: the world's folder and name), one world
per browser.

## Thunder Friends: friends list, chat and invites

Everyone on Thunder Client can add each other as friends, see what their friends are playing,
chat with them from anywhere in the game, and join the worlds they open. It runs on the same
Thunder relay (see below): nothing else to set up.

- **Your account**: a name and a password, like the logins of Eaglercraft servers. The first time,
  **Right Shift -> Friends -> Thunder Friends** asks you to make one (your profile name is
  offered; each name can have only one account, whatever the capitals), or to **Log in** to
  yours. Nobody can use Thunder Friends without an account, so nobody can use your name or write
  as you. A device stays logged in until you **Log out** (**Account** in the card), and you can
  log in on any other device, with all your friends there. **Account** also changes the password
  (the old one is needed), which logs out all your other devices. After 8 wrong passwords a name
  waits 15 minutes. Thunder has no email for anyone, so a forgotten password is reset with a
  **recovery code**: **Account -> Make a recovery code** shows 20 letters and numbers once (copy
  them or **Save as file**; a new code replaces the old one), and **Log in -> Forgot your
  password?** takes your name, the code and a new password. That logs out all your other devices
  and uses the code up (make a new one). Wrong codes count like wrong passwords. Until an account
  has a code, the friends list reminds you to make one.
  Players from before accounts choose a password once and keep their friends.
- **You** are `Name#1234`: your account's name and a 4-digit tag that never changes.
  **Right Shift -> Friends -> Thunder Friends** shows it with a Copy button.
- **Add a friend**: type their name and **Add** (or **Add** next to them in **On Thunder
  now**, the list of everyone on Thunder right now). They get a pop-up with **Accept**; requests
  also wait in their **Requests**. **No** turns one down (that player cannot ask again for 7 days);
  **Block** (click twice) stops them for good.
- **The friends list** shows who is online and what they are doing: in the menus, playing
  singleplayer, has a world open (with its code, or "code needed", and how many are playing), in
  a friend's world (whose, when they joined it through Thunder Friends; "In your world" when it
  is yours), or on a server (and which). Offline friends show when they were last online ("Last
  online 2 hours ago", from the hub's clock, so a computer whose clock is off still shows it
  right); they are listed after the online ones, the most recently online first. A friend's chat
  shows who is playing in their world ("Playing: Steve, Alex, you"). A friend with a world open
  has **Join**; with your own world open, **Invite** sends a friend a pop-up with **Join**. The
  Singleplayer and Multiplayer screens also list friends' open worlds at the top left, next to the
  screen's title, with who is playing and **Join** (two at most; with more, **See** opens the list).
- **Join a friend's server**: a friend on a server ("On play.zelz.net") has **Join** in their chat,
  and the Multiplayer screen lists the servers friends are on at the top left ("Sam and Alex on
  play.zelz.net" **Join**, friends on the same server on one line). **Join** connects to that
  server the way the Multiplayer screen does when it is picked from its list (the screen opens
  first if another one is up, so leaving the server lands there); from a world, it asks you to
  leave it first. The address is the one the friend's game connected to (`ws://` or `wss://`
  included; one from an older Thunder without it is `wss://`).
- **One-click Join, or the code** (a switch on the **Open to Friends** card, and in **Thunder
  Friends settings**): on, friends join your world with one click. Off, they see that it is open
  (and who is playing), but **Join** asks for the code you give them: the code is not sent to the
  friends hub at all. An **Invite** still lets that friend in with one click. Joining from Thunder
  Friends says "Joining ..." and, when it fails, why (a pop-up, and under the code box).
- **Chat**: pick a friend and type, **Enter** sends. **O** opens the chat from a world or the title
  screen (change the key in **Thunder Friends settings**). A message to a friend who is offline
  waits for them (up to 100 messages, 30 days) and says "sent while they were offline". One that
  was refused (sent too fast, or not connected) says "not sent", and one whose connection closed
  before the hub answered says "may not have been sent".
- **Pop-ups** at the top right, over the game and the Right Shift menu: messages, friend requests,
  invites and friends coming online (once in 5 minutes per friend, so a friend whose connection
  drops and comes back is not news). In a world they say which key opens the chat.
- **Share a waypoint**: **Share** on a waypoint (Right Shift -> Utility -> Waypoints) sends it to a
  friend as a message they can read (`Waypoint: Base | 120, 64, -300 | the Overworld | <server or
  world>`); Thunder shows **Add** in their pop-up and under the message, which puts it in their
  waypoints for that server or world.
- **More** (in a chat): **Remove friend** or **Block** (click twice). Blocked players cannot ask you
  or see you online; **Blocked** in the list has **Unblock**.
- **Party** (the card after the chat): **Make a party**, then invite friends (they get a pop-up
  with **Join party**; an invite to a friend who is offline waits for 15 minutes). Up to 8 players.
  Where the leader goes, everyone follows: when the leader opens their world to friends, joins a
  friend's world or goes to a server, each member's game goes there too (at once from the menus;
  from inside a world after you leave it, with a pop-up saying where). **Follow the leader** turns
  that off (a pop-up with **Join** instead). Party members get the world's code like an Invite,
  even when friends need the code. The card has the members, where the leader is (with **Join**),
  the party chat, **Leave**, and for the leader **Invite** and **Remove**. When the leader leaves,
  the member who joined next leads.
- **Owner** (the reserved **ThunderGamey_** account only): an owner badge shows by the owner's
  name everywhere. Owner tools turn on with the owner key (the thunder-relay Worker's `OWNER_KEY`
  secret; set it in the Worker's settings). The key becomes a proof in the browser and is never
  stored. With tools on, the owner can **ban** a player and their devices from Thunder Friends with
  a reason (they are kicked and cannot reconnect until unbanned), **unban**, wear the owner-only
  cosmetic, and message any player. The name cannot be registered by anyone without the key, so it
  is always reserved. Not built, by design: no forcing into others' worlds, no remote wipe or
  disabling of a client, no silent changing of others' settings.
- **Voice Chat** (on by default): in a world opened through Thunder's relay, everyone can talk.
  You hear the others at once; hold **V** to talk (the first time, the browser asks for your
  microphone; **Use my microphone** in the card does the same), or turn on **Always on**. Your
  microphone sends only while you talk and stops when you leave the world. **Proximity** (on):
  players sound from where they stand and fade out by 40 blocks. The card lists who is in the
  voice chat, whether their voice connected (a network that blocks direct connections needs this
  site's TURN server for voice), with **Mute**, and the volume. Voices go straight between the
  games: Thunder's relay only introduces them.
- **Thunder Friends settings**: the card's switch (off = you are offline to everyone), **Show me in
  On Thunder now**, **Show friends what I am playing** (and your open world: its code and who is
  in it), the pop-ups, one-click Join, and the chat key.
- **Settings Sync** (on by default): your settings follow your account. Sign in on another
  computer and Thunder's settings (every module, option and key), the HUD layout, the Auto GG
  text, waypoints on servers, the server list and the game's own options that are about you (key
  bindings, mouse sensitivity, FOV, sounds, chat, skin layers, main hand, auto-jump) are the same
  there; a change on one computer reaches the others that are open within a few seconds. Shaders,
  See-through Leaves, the title screen quality and the game's video options (render distance,
  graphics, VSync, GUI scale, language, resource packs) stay per computer. The first time a
  computer signs in to an account, the account's settings replace the ones there (what the
  account does not have yet is added to it); after that, per setting, the newest change wins,
  also for changes made while offline. The card shows when it last synced.

The password never leaves the browser: it is turned into a key first (PBKDF2-SHA256, 100000
rounds, salted with the account's name), and the hub keeps only a salted SHA-256 of that key. Each
browser is a device with its own secret key (`localStorage.thunderSocial_v1`; the hub keeps only a
hash of it), linked to the account it logged in to. Chats are kept in this browser, per account
(`thunderSocialChats_v1:<account>`: the last 60 lines with each of the 40 most recent friends), and
logging out removes that account's chats from the browser. The hub keeps names, tags, password
hashes, which devices are logged in, friends, requests and blocks; messages only until they are
delivered.
Messages and invites only go between friends, as plain text of at most 300 characters, and every
connection and network address is rate limited (addresses as a hash, in memory only).

## Play from any network: Thunder's own relay (site owner, once)

The public Eaglercraft relays hand out the join codes, and some networks (school filters,
extensions) block them; then codes cannot work at all. Some networks and managed laptops also
block every browser-to-browser connection, TURN included. Thunder's own relay fixes both: it runs
on the site owner's Cloudflare account (`thunder-relay/`, a Worker with a Durable Object). The
client connects to it directly at its Worker address (baked into `thunder-lan.js` as `RELAY_HOME`,
`https://thunder-relay.thundergamey.workers.dev/`), so it works without any Pages service binding:
the offline file (Origin `null`) is always let in, and the website is let in once its origin is in
the Worker's `SITES` variable.

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
2. Let the website in: the Worker (`thunder-relay`) -> **Settings** -> **Variables and Secrets**
   -> add `SITES` (type Text) = your site's origin, for example `https://thunderclient.pages.dev`
   (no trailing slash; list several comma-separated). The offline file needs nothing here - a page
   opened from a folder sends Origin `null`, which the relay always allows. Save; the Worker
   redeploys on its own (or **Deployments** -> **Retry**).
3. Check: open `https://thunder-relay.thundergamey.workers.dev/relay` - it shows
   `{"relay":true,"version":1}`, and `/social` answers `{"social":true,"version":1}`. In the game,
   **Right Shift -> Friends -> Connection test** should say "Thunder relay: works". The same Worker
   carries Thunder Friends too (a second Durable Object, `ThunderSocial`), so nothing else to set up.

The older way still works if you prefer it: a `RELAY` **Service binding** on the Pages project (the
client then reaches the relay at the site's own `/relay`, `functions/relay.js`), which needs no
`SITES`. The direct Worker address is the default now and does not need the binding.

Everyone playing has to reload the page once (or re-open the offline file), so their game uses the
relay (an older copy only looks on the public relays and will not find a 6-character code).

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

## The offline file

The offline file (`thunder-offline.html`, see the main README) is a page opened from a folder, so
it has no site of its own to find `/relay`, `/turn` and `/social` on. It uses the website's: its
loader tells the game the address (`window.thunderSite`, `https://thunderclient.pages.dev/`), and
a file downloaded before that existed uses the same address once it has updated itself. So wherever
thunderclient.pages.dev can be reached (at home, for example) the file has everything the website
has: codes from the Thunder relay, the game through it when two players cannot connect directly,
the TURN relay, and Thunder Friends. The file is its own device for Thunder Friends: log in once
with your account's name and password. Messages in the file that used to say "this site" name the
website instead ("TURN relay: not set up on thunderclient.pages.dev").

Where the website is blocked (some school networks), the file works as before: codes come from the
public Eaglercraft relays (a host is on one as soon as the Thunder relay fails, at most about 10
seconds when the network gives no answer at all), and Thunder Friends says
"thunderclient.pages.dev could not be reached" and tries again after 15 seconds, a minute, 5
minutes and then every 10 minutes, and right away when the network comes back or the Thunder
Friends card is opened (never twice within 10 seconds). A file that loses the website while it is
open (carried from home to school) notices within seconds and waits the same way; the website
itself retries a dropped connection within a minute, as before.

A page opened from a folder sends `Origin: null`, so the website lets that in: the relay Worker
(`/relay`, `/social`) and `/turn` accept `null` besides the site itself (and the `SITES` list), and
their JSON answers carry `Access-Control-Allow-Origin: *` so the file can read them. This adds
nothing a program could not already do: programs that send no `Origin` at all were always let in.
A page from another site (any other `Origin`) is still refused.

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
  if a Worker cannot start). On Thunder's relay the host sends a keepalive (`ping`) every 25
  seconds, which Cloudflare answers (`pong`) without waking the relay; once it has answered, 100
  seconds without an answer count as a closed connection (a network that went away without
  closing it), so the host can share again.
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
- **Voice chat (Thunder relay only).** Each game in a world opened through the relay joins the
  world's voice chat in the same Durable Object: `/relay?voice=<code>` (only while that world is
  open there; at most 16 games) takes text messages: `{t:'hi', name}`, answered `{t:'room', you,
  list: [{id, name}], ice}` (the others get `{t:'join', id, name}`), and `{t:'sig', to, d}`, passed
  on as `{t:'sig', from, d}` (an offer or answer with its candidates; at most 16 KB a message and
  120 messages a minute); `{t:'leave', id}` when someone goes. The audio is WebRTC between the
  games (directly, or through the site's TURN server), so the relay only ever sees who is there.
- **Thunder Friends hub** (`thunder-relay/social.js`): one Durable Object for everyone, reached at
  `/social` like the relay, holding accounts (id, name, tag, the password's salted hash), the
  devices logged in to each, friends, requests, blocks and waiting messages in its SQLite storage.
  Each game keeps one WebSocket to it (`?id=` the device id; the first message says hello with the
  device key, which must hash to that id). A device not logged in gets `auth` and can then only
  `register` or `login` (with the key the browser made from the password); a logged-in one is
  signed in to its account at once. A new password (`passwd`, with the old one) unlinks the
  account's other devices, and `logout` unlinks this one. A recovery code is sent as a key made
  from it (`recovery`; kept like a password, one per account, `recok` to all its devices);
  `recover` (name, that key, a new password) from a device that is not signed in sets the
  password, unlinks every device of the account, signs this one in and deletes the code; a device whose own account it left
  makes a new device key. The hub sleeps between messages
  (keepalives are answered by Cloudflare) and tells friends about changes: online, offline, what
  you are doing. What you are doing is `{w}`: menu, sp, server (and which), join (and
  whose world), or host with the code (or `lock` when friends need the code: then no code at all)
  and `players`, the names in your world (from each friend's login; at most 16, checked by the
  hub like every name). An invite carries the code itself. The game connects once its first menu is up (it uses a stand-in name
  before it has read the saved profile), and again after 2 s, 5 s, ... up to a minute when the
  connection drops. A keepalive left unanswered for 30 s means the connection died without closing
  (a network change, a laptop waking up), so the game drops it and connects again, and so does a
  sign-in the hub has not answered within 20 s. Only the site's own pages may connect (`Origin`).
  Thunder Cosmetics use it too: `cosm {name, cape, wings}` keeps an account's picks with its
  in-game name (nothing picked: forgotten), and `cosmq {names}` (at most 64 in-game names) is
  answered `cosma {set: [[name, cape, wings]], asked}` with only the ids, never the account.
  Owner tools use it too: a signed-in ThunderGamey_ sends `owner {proof}` (the SHA-256 of
  "thunder-owner:"+the owner key, so the key never leaves the browser) and gets `owned {ok}`; the
  hub checks the proof against its `OWNER_KEY` secret. With powers, `ban {id, reason}` bans an
  account and its devices (they are refused at connect with the reason) and `unban {id}` lifts it,
  both answered with `banlist {bans}`. The reserved name is also refused at `register` without the
  proof, so nobody else can take it. Cards, the online list and messages from the owner carry
  `owner: true` for the badge.
  Parties use it too: `pnew` makes a party (the maker leads), `pinv {to}` (leader, friends only,
  at most 8 players; kept 15 minutes, given again when the friend signs in) reaches the friend as
  `pinvited {pid, from, members}`, `pacc`/`pdec {pid}` answer it, `pleave`, `pkick {id}` (leader),
  `pmsg {text}` (to the other members, cleaned like messages) and `pwarp {w: host|join + code,
  server + address, or menu}` (leader only: where the members' games go; the hub keeps the last
  one for members who join later). Every change sends `party {id, leader, members, invites,
  warp}` to each member; members see each other's status only as `{w}` (no codes or servers,
  as members need not be friends), and `id: null` (with `why`: left, removed) to someone who is
  out of it. Parties are kept by the hub (one per player) until the last member leaves.
  Settings Sync uses the same connection: `welcome` carries the account's settings as
  `[key, value, when]` (keys like `s.zoomKey`, `g.key_key.jump`, `h.fps`, `w.mp:<server>@0`,
  `x.servers`), a device sends what it changed as `sync {set}` (frames of up to 16 KB; values of at
  most 12000 characters), and the hub keeps the newest per key (a time more than a minute ahead
  of its clock counts as now; at most 800 keys and 400 KB per account), sends it to the account's
  other open devices, and sends back what it has that is newer. `syncget` asks for all of them
  again (`syncall`). Only the account itself gets its settings. The browser keeps, per key, only
  when it last changed and a short hash (`localStorage.thunderSync_v1`).
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
`GuiIngameMenu.initGui`/`actionPerformed` (the pause menu button; Save and Quit also tells
Always open the player left on purpose), `Minecraft.launchIntegratedServer` (notes which world
is running, by its folder, for Always open; Always open calls it to load its world, after
`SingleplayerServerController.startIntegratedServerWorker` when the game's server Worker has not
started yet, as the Singleplayer button does) and
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

Fourth round (Always open), same setup as the third: the relay and the site in Cloudflare's local
runtime, the host in one Chromium browser and a friend in another.

| Scenario | Result |
|---|---|
| Switch on in the world (card switch) | shared at once with the world's kept code (`iq2vyy`); the setting is saved |
| Page reloaded (as after a restart), one key press for the game's sound screen, then hands off | title screen, 10-second countdown banner, the game's server Worker is started, the world loads and is shared with the same code (about 20 s after the countdown). Before the fix: the load failed ("WORLD_WORKER_NOT_RUNNING", the Worker starts with the first Singleplayer click), and a share right after arriving picked a code for the wrong world (the spawn point, which tells worlds apart, comes in a moment later) |
| Save and Quit | stays closed ("Paused"), sharing and the keep-awake stop |
| The world stops with nobody at the computer (Save and Quit with the input clock wound back) | "the world stopped with nobody at the computer", countdown, loaded and shared again with the same code. Before the fix: the browser sends mouse moves of no distance about twice a second while the mouse is still, so the computer never counted as unattended |
| Countdown: **Not now** / **Open now** | stays closed ("Not this time") / loads and shares at once |
| The relay restarted (like a deploy), with and without a friend in | shared again with the same code; the friend kept playing, then left and joined again with the code |
| The relay frozen (the connection stays open but nothing answers), twice | after 100 s without a `pong` the connection counts as closed; tries again 5 s, 10 s, 20 s, ... apart; shared again with the same code 4-15 s after the relay answered again |
| Friend joins the Always open world | joined in 6 s, connected directly |
| **Stop sharing** | sharing stops and Always open switches off (the setting is removed) |
| The saved world no longer exists | "the world ... is not in this browser any more", nothing is loaded |
| Host page frozen for 40 s (a busy or throttled tab) | the host is not timed out; the world stays open |
| Keep-awake | the page's WebRTC data channel opens (connected); the Screen Wake Lock is refused by the headless test browser (the card then says to set the computer to never sleep) |

Fifth round (Thunder Friends), same setup: two Chromium browsers (A hosting its world with Always
open, B), a third player from a script, and a protocol test of the hub from Node.

| Scenario | Result |
|---|---|
| Hub protocol, from Node (49 checks) | sign-in only with the key that hashes to the id; add by `Name#tag`, by name alone (one online player with it) or from the list; accept, decline (then no new request for 7 days), cancel, remove, block, unblock (the other side is told only when something changed); messages live and to an offline friend (waiting, delivered at sign-in, gone once acknowledged), cleaned and cut to 300 characters; copies to the sender's other tabs; status and invites; hidden players not listed or found by name; only friends can message or invite; rate limits (each refused message, invite or request says which one), flooding, binary and oversized frames close the connection; at most 4 tabs; no `Origin` or another site: 403; one address past 120 connections in 10 minutes: 429 |
| B adds A in the card (typed `Name#tag`, Enter), A clicks **Accept** in the pop-up | friends on both sides, online, with what each is doing; the add box clears |
| B sends a message while A plays in its world | pop-up at the top right in A's game ("Press O to open the chat"); **O** opens the chat on B, typing box ready; A's reply shows at once in B's open chat (no pop-up there) |
| A's world open (Always open) | B's list: "Has a world open", code, **Join** in the chat, on the Multiplayer screen (panel, and a one-line bar in a narrow window): each **Join** puts B in A's world; A then sees "In a friend's world" |
| A (hosting) clicks **Invite** | B gets "... invited you to their world" with **Join** (joined), and a line in the chat |
| B switches Thunder Friends off, A sends two messages, B switches it on | A sees B offline, the messages "sent while they were offline"; B gets "2 messages ... while you were away" and both in the chat |
| On Thunder now | "2 other players on Thunder now", friend marked, **Add** sends the request; A switching off "Show me in On Thunder now" takes A off the others' list |
| **More -> Remove friend** (twice), then re-adding; **Block** on a request (twice), **Unblock** | removed on both sides; friends again; blocked (the request is gone, **Blocked** lists them), unblocked |
| Relay restarted | both reconnect by themselves within seconds and see each other; A's world is shared again (Always open) and B sees it open again |
| Found and fixed on the way | the first sign-in used the game's stand-in name (the profile is read a moment later), so a friend who copied it could not add; "click again" buttons reset when the list refreshed; the chat pane repainted while reading older lines |
| A message sent, then the connection closed at once | "may not have been sent" (B had it); after a reload no message is left "sending" |
| A's keepalives swallowed (a connection that died without closing) | after 30 s without an answer A dropped it and signed in again by itself (35 s in all) |
| The hub never answers A's sign-in | "the friends hub did not answer" after 20 s, signed in on the next try |
| A sends 15 messages at once | the first 12 arrive; the last 3 say "not sent", with one "Slow down a little." line |
| A's connection drops and comes back twice | B's "is online" pop-up shows the first time only (then not for 5 minutes) |
| **O** on B's title screen with 13 unread messages from A | the chat with A opens, typing box ready; the unread count is cleared, in the saved chats too |
| **Copy** in a browser that does not allow the clipboard | says "Not copied" (no error) |
| Page errors in either browser over the whole round | none |

Sixth round (one-click Join or the code, and who is playing), same setup, with a scripted friend
hosting a second world with two players in it:

| Scenario | Result |
|---|---|
| Hub protocol, from Node (now 55 checks) | with "code needed" the status never carries the code (even when sent) and still says who is in the world; an invite carries the code, a bad one is refused; at most 16 names, only valid names (not numbers or markup); a friend in a world says whose, a bad name is dropped |
| A (world open, Always open) clicks the new **Friends join with one click** switch off on the Open to Friends card | the hub gets `{w: host, lock: true}`, no code; B's list: "Has a world open, code needed" |
| B on the Multiplayer screen | "ViggEagler3162_'s world is open" with **Join (code)**, left of the screen title; **Join (code)** opens the chat with A, "Playing: ViggEagler3162_" and the code box ready |
| B types a wrong code | "Could not join ViggEagler3162_'s world: No open world has the code ..." as a pop-up over the menu and under the code box; the typed code stays |
| B types the right code | B is in A's world (the menu closes when it loads); A's status lists B; B sees "Playing: ViggEagler3162_, you"; A sees B "In your world" |
| B leaves, A (code needed) clicks **Invite** in B's chat | B's pop-up **Join** puts B in A's world without the code |
| Scripted friend hosting (Zed and Yan in the world), window 1280x720 | two lines at the top left above the server list: "Delta_W's world: Delta_W, Zed, Yan" **Join** and A's world **Join (code)**; the list: "Has a world open, dddd22, 3 playing" |
| Same at 640x360 | one line, "2 friends' worlds are open" **See** (opens the list) |
| Found and fixed on the way | the one-line bar covered the start of the screen title, and the old panel could cover the top of the list at some window sizes (now sized to the strip left of the title from the screen's own scale); joining from the chat closed the menu at once, so a failed join showed nothing (now it stays open until the world loads, and says why) |
| Page errors in either browser over the whole round | none |

Seventh round (accounts with passwords), same setup: B a player from before accounts (with
friends), C a new browser.

| Scenario | Result |
|---|---|
| Hub protocol, from Node (now 73 checks) | nothing but a name and password before an account is logged in; names 3 to 16 characters, one account per name whatever the capitals; wrong name, wrong password, the right one in any capitals (same account, same id); a device stays logged in; a new password needs the old one and logs out the other devices, which need the new one; log out; a device that left its own account must start with a new key; 8 wrong passwords make the name wait; an account made by a device from before accounts keeps its id (and friends); adding by name alone; at most 4 tabs (the oldest closed) |
| B opens Thunder Friends (O) | "Choose a password for Thunder Friends", its name offered; **Create account**: signed in as the same YeeishYeer3756#6408 with all its friends |
| C (new) tries `yeeishyeer3756` | "yeeishyeer3756 is taken. If it is yours, log in." |
| C makes Charlie_T, adds B by name only, B accepts, C writes | friends, the message arrives |
| Reload both | both still logged in |
| C: **Account -> Log out** (twice) | log-in form, "You logged out of Thunder Friends on this device."; new device key; C's chats gone from that browser |
| C logs in: wrong password, then the right one (name in lower case) | "Wrong password for Charlie_T."; then Charlie_T#7772 with its friend |
| B logs in to Charlie_T too; C changes the password (**Account -> Change password**) | C: "Password changed. Your other devices were logged out."; B: "You were logged out: the password was changed on another device. Log in again."; the old password is refused, the new one works |
| Found and fixed on the way | **Log out** (and the other click-twice buttons) grew wider on the first click, wrapped out from under the mouse and cancelled itself: the second click now counts for 4 seconds instead |
| Page errors in either browser over the whole round | none |

Eighth round (the offline file uses the website): the relay Worker and the site's functions running
locally (`wrangler dev`, `wrangler pages dev` with the `RELAY` binding), and offline files built
with `THUNDER_OFFLINE_SITE=http://127.0.0.1:8765/` (the local site) in two fresh Chromium profiles,
opened from a folder.

| Scenario | Result |
|---|---|
| What a page opened from a folder sends (fetch, WebSocket on the page and in a Worker) | `Origin: null`, no Referer; without `Access-Control-Allow-Origin` the fetch fails, with it the answer can be read |
| Relay protocol from Node (now 27 checks) and hub protocol (now 74) | as before, plus: `Origin: null` let in and its answer readable (`*`), a look-up over WebSocket with `Origin: null` works, `Origin: file://` and other sites refused; a hub connection with `Origin: null` upgrades (101) |
| `/turn` with a stand-in for Cloudflare | logins for the site's pages, for `Origin: null` and without `Origin`; other sites (also `thunderclient.pages.dev.evil.example`) refused with 403 before Cloudflare is asked; every answer readable (`*`) |
| Both files start | Thunder Friends: "make your account, or log in" (the hub answered the file) |
| A makes FileAlpha, B FileBravo; A adds B, B accepts, A writes | friends, both online, the message arrives |
| B logs out, logs in with a wrong password, then the right one | "Wrong password for FileBravo."; then signed in with its friend |
| B: **Connection test** | "Thunder relay: works ... TURN relay: not set up on 127.0.0.1:8765. Friends can join from any network where 127.0.0.1:8765 can be reached" (the test machine has no TURN keys or internet) |
| A makes a world and opens it to friends | a 6-character code from the Thunder relay through the local site |
| B joins with direct connections made impossible (relay-only ICE, no TURN) | "no direct connection", "asking the Thunder relay for a tunnel", "connected to the host through the Thunder relay" in 22 s; B plays in A's world; Thunder Friends shows A's world with its code and B in it |
| A file whose website cannot be reached (built for an address where nothing listens) | Thunder Friends "127.0.0.1:8799 could not be reached", next try after 15 s, then 60 s; opening a world: the site relay fails at once and the world is open on the public relay (a stand-in EaglerSPRelay) in 4 s |
| B (website reachable) joins that 5-character code | the Thunder relay says no world has it, the public relay has it: connected directly in 4.5 s |
| A file built from the previous version (no `thunderSite`) | finds update 2 on a stand-in for GitHub, downloads it, and after **Restart now** runs it, using thunderclient.pages.dev for Thunder Friends ("thunderclient.pages.dev could not be reached" on the test machine, which has no internet) |
| The file opened while the website is down, which then comes back; A presses O | "could not be reached", waiting a minute; opening the card connects at once (46 s were left), still logged in |
| The website goes away while the file is connected | "could not connect", then within 9 s "127.0.0.1:8765 could not be reached" and a 5-minute wait |
| It comes back and the browser says the network is back (`online`) | connected within a second |
| `online` every half second for 30 s while the website is down | 3 tries, 11 s apart |
| The website itself with this build | as before: "Thunder relay: works ... not set up on this site ... where this page loads"; Thunder Friends asks to log in |
| Page errors | none |

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
- Friends already in keep playing if the relay connection drops; new friends can join again once
  the host presses **Reopen** (or at once with Always open), with the same code through the
  Thunder relay.
- Thunder Friends accounts have no email: a forgotten password can only be reset with the
  account's recovery code. Without one the account is lost (its devices that are still logged in
  keep working until they log out, and can make a code). A message
  sent while a friend's connection is silently dying (a laptop closing) can be lost: the hub only
  keeps messages for friends it knows are offline (their game notices within about 30 s and
  connects again).
- Always open needs the computer on, awake and online, with the tab open; the world is only
  there while it runs. After a restart the game needs one key press before it starts (its sound
  needs it), so a computer that restarts on its own waits for someone to press a key.
- The integrated server has no `/kick` (vanilla LAN does not either); use **Remove** in the host's
  Friends panel.
