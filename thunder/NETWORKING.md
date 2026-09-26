# Playing together: what this Eaglercraft 1.12 build can and cannot do

Checked against the compiled client (`backups/classes.clean-base.js`) using its own
deobfuscation table (see `thunder/build.js`). Every statement below comes from the code, not
from how EaglercraftX 1.8 or vanilla behave.

## What is in the build

| Piece | Present? | Evidence |
|---|---|---|
| Multiplayer over WebSocket (`wss://`) | Yes | `TeaVMWebSocketClient`, `WebSocketNetworkManager`, EaglercraftX protocol V3/V4 packets (`socket.protocol.*`) |
| Integrated server in a Web Worker | Yes | `EaglerIntegratedServerWorker`, `EaglerMinecraftServer` |
| Server-side support for extra player channels | Yes (unused) | worker has `IntegratedServerPlayerNetworkManager`, `IPCPacket0CPlayerChannel`, `IPCPacket17ConfigureLAN` |
| Client-side "Open to LAN" / Shared World | **No** | no `LANServerController`/`LANClientNetworkManager`/relay client classes; **0** references to `RTCPeerConnection` (WebRTC) in the whole file |
| LAN relay servers from `index-js.html` (`relays:`) | Parsed only | `RelayEntry` objects are created by the config loader and never used by anything else |
| "Open to LAN" button in the pause menu | Always disabled | `GuiIngameMenu.initGui` sets the button's `enabled = false`; the only code that re-enables that slot is `PauseMenuCustomizeState.loadPacket`, which lets a *server* turn it into a custom (e.g. Discord) button |
| `IPCPacket17ConfigureLAN` | Never sent | its constructor has no callers; the player-channel packet is only used for your own local connection |

So the half of EaglercraftX's LAN system that lives in the integrated server survived, but the
browser half (WebRTC data channels + relay signalling + the LAN screens) was not compiled into
this build.

## Options, from realistic to not realistic

1. **Hosted server - works today, no client change.** Run a Minecraft server that accepts this
   client over `wss://` (the servers already in your list are examples). Friends join from
   Multiplayer, or through a link: the launcher already supports
   `index-js.html?server=wss://your.server`. Private worlds = whitelist on that server.
   Cost: a small VPS or a tunnel from a home PC. I have not set up or tested a server stack for
   this specific 1.12 client, so confirm your server software supports it before paying for
   anything.

2. **Join codes (Education-style) on top of option 1 - realistic, small.** A code such as
   `THNDR-4821` can be looked up in a JSON file served next to the launcher
   (`{"THNDR-4821": "wss://..."}`) and turned into the `?server=` link above. That gives the
   join-code experience; it still needs a real server behind each code.

3. **Browser-hosted worlds (true "Open to LAN" / Shared World) - not realistic by patching.**
   It needs the missing client stack: relay protocol client, WebRTC peer connections per
   friend, forwarding between those and the worker's player channels, plus the host/join
   screens. EaglercraftX 1.8 has all of that in Java; this 1.12 build would need it ported and
   recompiled with TeaVM from source. Writing it by hand into the compiled `classes.js` would
   be thousands of lines against obfuscated internals with no way to keep it maintainable, so
   I do not recommend it. With a source build it becomes plausible, and relay-based worlds would
   get short join codes for free.
