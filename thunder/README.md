# Thunder Client build

Thunder Client is created and owned by Jayvardhan Ginni (ThunderGamey).

`classes.js` is generated. Edit `thunder/thunder-client.js` (and `thunder/thunder-hud.js`,
`thunder/thunder-shaders.js`, `thunder/thunder-world.js`, `thunder/thunder-lan.js`, `thunder/thunder-social.js`,
`thunder/thunder-title.js`, `thunder/thunder-theme.js`, `thunder/thunder-packs.js`,
`thunder/thunder-items.js`, `thunder/thunder-items-data.js`, `thunder/thunder-hitfx.js`,
`thunder/thunder-swim.js` and `thunder/thunder-perf.js`, which it pulls in with `// @include`),
then run:

```
node thunder/build.js
```

This inserts the Thunder block into the clean Eaglercraft 1.12.2 build
(`backups/classes.clean-base.js`, md5 `eb9c9477f8a04f25e4af424c5aaaf6ee`) and writes
`classes.js`. It also stamps `index-js.html` with a cache-busting version of that exact file.

Before writing anything the build refuses to continue unless:

- the base is clean (no Thunder code in it);
- every obfuscated game name used by the Thunder source is listed in its header
  (`@hook`, `@use`, `@virtual`, `@static`, `@staticset`, `@set`, `@clinit`, `@field`, `@runtime`) and
  each one maps to the stated Java method/class in that base. The mapping comes from the base's
  own deobfuscation table (the data Eaglercraft uses to print readable stack traces), so no name
  is guessed. `@staticset` names a static field written by one specific method (for example the
  WebGL context, set by `PlatformOpenGL.setCurrentContext`);
- every game function the Thunder source replaces is declared `@hook`, installed exactly once, and
  defined exactly once in the base; the only other game names it may assign are static fields
  declared `@set` (checked like `@static`: the two cached world shader sources);
- the output is the base plus exactly one inserted block (everything around it byte-identical),
  and it parses.

## Building on a different base

If you have another clean Eaglercraft 1.12 `classes.js` (for example your `classes(3).js`):

```
node thunder/build.js --base "path/to/classes(3).js"
```

If that file is a different compile, the build stops and lists every name that does not match
(and what that base calls the method instead) instead of producing a broken file.

Requirements: Node 18+ and the `acorn` parser (`npm install --no-save acorn`).

## Subsystems

- `index-js.html` (the page) - the Thunder loading screen: a storm (clouds, rain, lightning, a
  thunder with every flash) with the logo and a loading bar, shown the moment the page opens.
  `classes.js` is loaded with `defer`, so the page draws while it downloads. The bar follows the
  real start-up (`window.main` defined, then `TC.boot()`: the game object exists, a menu has been
  on screen for three frames, the built-in packs are no longer busy). Browsers allow sound only
  after the first click or key press, and the game itself waits for one before it starts its
  sound (its own click screen is under the loading screen), so while sound is locked the screen
  says CLICK ANYWHERE TO START and lets clicks through to the game; once the first menu is up,
  clicks stop at the loading screen. Then the THUNDER CLIENT splash strikes three times and the
  storm clears. The loading screen sits on `<html>`, not `<body>`, because the game empties
  `<body>` (its container) when it starts. A crash report, or the tap-to-launch box of mobile
  browsers, is never hidden.
- `thunder-boot.js` - `TC.boot()` for the loading screen, and Quick Start (Right Shift > Utility,
  on): `Minecraft.displayGuiScreen` opens the title screen instead of the Eaglercraft Edit Profile
  screen the game opens at start (Edit Profile stays a button on the title screen), and leaves out
  the default-username reminder.
- `thunder-combat.js` - Totem Counter and Pickup Notifier (HUD boxes, movable in the HUD editor;
  pickups come from the game's own "item collected" message, `SPacketCollectItem.processPacket`,
  so only real pickups show), Target Crosshair (aiming at a player within reach: the crosshair,
  drawn again from the same texture in red, and a lock-on frame; "Mobs too" option) and Shield
  Status (the off-hand shield slot glows in the ready colour, or the disabled colour with a fill
  that drains as the axe cooldown from `CooldownTracker` runs out; colours are swatches).
- `thunder-tweaks.js` - No Enchant Glint (`ItemStack.hasEffect` and
  `LayerArmorBase.renderEnchantedGlint`), No Rain (`EntityRenderer.renderRainSnow` and
  `addRainParticles`: no rain, splashes or rain sounds) and No Pumpkin Blur
  (`GuiIngame.renderPumpkinOverlay`).
- `thunder-zoom.js` - Zoom (Utility): hold C, or the key you pick in its Zoom key control (any
  key, or the middle or a side mouse button; it is saved), or tap it with "Toggle"; the FOV of the world
  (not the hand) is divided in the `getFOVModifier` wrapper, glides in and out, the mouse wheel
  zooms further while zoomed (the event never reaches the game, so the hotbar stays), and mouse
  sensitivity is lowered with the zoom and put back exactly when it ends or a screen opens.
- `thunder-freelook.js` - Freelook (Utility, on, key X): while the key is held (or toggled), the
  view goes to third person and `Entity.turn` (`setAngles`) turns the camera's own yaw and pitch
  instead of the player; while `EntityRenderer.orientCamera` places the camera, the player's
  rotation reads the camera's (the wrapper in `thunder-swim.js` calls it through `SW.fl`), and is
  put back right after, so the player keeps its direction and the server sees nothing. Letting go
  puts the old view back. Tested: X held, a turn of 90 degrees moved only the camera, X let go.
- `thunder-chat.js` - Chat Tools (Utility): every chat line goes through
  `GuiNewChat.printChatMessageWithOptionalDeletion`, whose wrapper reads its text (the game's
  `getUnformattedText`; the wrapper keeps its state on the game thread's stack when that pauses)
  and gives the game a new line: a `TextComponentString` with the time (when on) and the original
  appended (so colours, links and hover texts stay), with a line id of its own. A line that says
  your name (the profile name or your Thunder Friends name; not your own lines like `<You> hi`,
  `[You] ...` from /say or `You joined the game`, unless your name comes again) is kept as a
  mention: while `GuiNewChat.drawChat` runs, its black box (`Gui.drawRect(-2, row * -9 - 9, ...)`)
  is drawn gold instead, and a short chime plays. The same text again within a minute, with
  nothing between, replaces the last line (the game removes the lines with the id it is given)
  and ends with (x2), (x3)... Auto GG (off by default; the text is in `localStorage.thunderAutoGG`):
  on a server or in a friend's world, a line that says a game is over (`won the game`,
  `Winner: ...`, `1st Killer`, `GAME OVER`, `Reward Summary`...) and does not look like a player
  talking (`<Steve> I won the game`, `Steve: winner winner`) sends the text about a second later,
  at most once in 20 seconds. Tested with a friend in a world: a line with your name in gold,
  /say three times merged into "(x3)", the time on each line, Auto GG answering
  `/say Winner: Steve` with gg, the text box saving its text; unit tests for the name rules (15
  lines) and the game-over rules (17 lines).
- `thunder-sync.js` - Settings Sync (Friends, on): while signed in to Thunder Friends, settings
  follow the account. Each setting is a key and a value: `s.<id>` (Thunder's settings as JSON,
  except `sh*`, `shaders`, `clearLeaves`, `titleQuality`, `socialOn` and `syncSettings`),
  `g.<option>` (the game's options that are about the player: key bindings, sensitivity, FOV,
  sounds, chat, skin layers...; never video options, language or packs), `h.<widget>` (HUD
  layout), `w.mp:<server>@<dim>` (server waypoints), `x.autogg`, `x.servers` (the game's server
  list). Every two seconds the current values are hashed and compared with the last synced ones
  (`thunderSync_v1` keeps per key the time and hash); a change gets the hub's time and is sent once
  changes rest for 1.5 s. Per key the newest wins, here and on the hub (`thunder-relay/social.js`).
  The first sign-in of a browser to an account takes the account's settings. A Thunder setting is
  checked against its default's type (and its slider's or choice's range) and its option's
  `onChange` runs; game options are written into the saved options (`_eaglercraft_1.12.g`) and the
  game reads them again on its own thread (`GameSettings.loadOptions`, which also refreshes the key
  bindings); a HUD box while the HUD editor is open and the server list while the Multiplayer
  screen is open wait until it closes, and are dropped if they were changed there meanwhile (that
  change is newer). Tested with two browsers on one account and a scripted third device:
  a first sign-in took the account's settings (zoom key, zoom level, sensitivity 0.8 in the
  running game, jump key), a change on one browser reached the other in 3.5 s, HUD positions,
  server waypoints and the Auto GG text came through, invalid values were refused and repaired
  from the browsers, a HUD change during editing waited (and lost to a reset made in the editor),
  changes made offline won or lost by time per key, the switch stopped and resumed syncing, a
  server added on one browser showed in the other's Multiplayer list (and a deletion waited while
  that list was open), reloads sent nothing, and signing in to another account brought that
  account's settings back. Hub: 18 protocol checks (newest wins, pushes, privacy between accounts,
  frame and size limits).
- Waypoint sharing (`thunder-waypoints.js` and `thunder-social.js`): **Share** on a waypoint in
  Right Shift > Utility > Waypoints lists your Thunder Friends friends (online ones first) and sends
  it as an ordinary chat message that reads well on its own:
  `Waypoint: Base | 120, 64, -300 | the Overworld | wss://play.example.net` (the last part is the
  server, or `a world (spawn 8, 8)` for a singleplayer or friend's world, which waypoints tell apart
  by the spawn point, so a friend in your world has the same one). The friend gets a pop-up with
  **Add** (12 s) and an **Add waypoint** button under the message in the chat ("In your
  waypoints" once it is there); a friend who is offline gets it with their messages. No change to
  the hub. Tested: shared from the Waypoints card in a world, added from the pop-up and from the
  chat (a Nether one into the Nether list), and the friend who then joined the world saw it there
  (same world key); 12 checks of the text format (names with `|`, other dimensions, bad places).
- `thunder-backup.js` - World Backup (Utility). Save backup reads every world in the game's
  `worlds_list.txt` straight from its IndexedDB store (`..._PlatformFilesystem_1_12_2_`, records
  `{path, data}` keyed by `[path]`) and downloads one `.thunderbackup` file: gzip of
  `THUNDERBKP1\n`, a JSON header (worlds, settings) and every file as length-prefixed path and data.
  The settings are the game's options, profile and server list (`_eaglercraft_1.12.g/p/s`) and
  Thunder's own keys; never the server cookies (`.c`), the Thunder Friends key and chats, the
  worlds' code keys, Always open, relay/TURN lists, shader auto quality or the built-in packs, so a
  file can be given to a friend. Load backup checks the whole file first (magic, format, no path
  outside `eaglercraft/worlds/<folder>/`, no `.`/`..`, not cut off), then Restore writes each world
  to a folder nobody uses (`World (2)`, `World (3)`...), 400 files per transaction, adds it to
  `worlds_list.txt` in one read-and-write transaction, adds the waypoints to the ones here, puts
  the server list back only if there is none, and reloads the page. Only at the menus; if a world
  starts meanwhile, or the browser refuses to save, what was written is removed again. World
  rescue: a world without `level.dat` (the tab closed between the game's two renames while saving)
  gets it back from `level.dat_new`, else `level.dat_old`, when the game reaches its menus and
  when the Singleplayer screen opens, with a pop-up. Tested: save (821 files, 52 KB) and restore
  as `New World (2)`, which opened at the same spot; settings in the file checked (no cookie, no
  Friends key); waypoints merged; five broken or tampered files refused through the file picker;
  a restore stopped halfway cleaned up; both rescue paths repaired a world that then opened.
- `thunder-qol.js` - Toggle Sneak (`MovementInputFromOptions.updatePlayerMoveState`), Clear Chat
  (black boxes left out while `GuiNewChat.drawChat` runs), Password Hider (the chat box draws
  `/login ****`; the text itself is unchanged), Show Own Name Tag (the `canRenderName` prototype
  slot of `RenderLivingBase`, third person), Crystal Optimizer (an end crystal you hit is removed
  on your screen at once after `PlayerControllerMP.attackEntity`), XP Orb Clumping (only the first
  orb in each half-block cell is drawn per frame), Fast XP (no right-click delay with a bottle o'
  enchanting in hand; off by default) and Menu Sounds (the Right Shift menu opens with a near
  thunder strike and a short roll and closes with a soft distant roll: `ThunderAmbient.menuThunder`,
  which also plays in a world).
- `thunder-swim.js` - Modern Swimming (Movement, on): swimming and crawling like 1.21.11. It is
  included at the top level, not in the client scope, because the integrated-server worker
  (singleplayer and Friends worlds) needs half of it too. Sprinting with your eyes and feet in
  water starts swimming (1.21.11 `Player.updateSwimming`, double-tapping W also works
  underwater); a swimmer is 0.6 x 0.6 with the eyes 0.4 up (`EntityPlayer.updateSize` and
  `getEyeHeight`), so one-block gaps fit, and where you cannot stand up you keep crawling at
  sneaking speed (also when a trapdoor closes over you). In water: you rise and sink toward where
  you look (8.5% or 6% of the gap a tick, `EntityPlayer.travel`), drag 0.9 while sprinting instead
  of 0.8 (`getWaterSlowDown`), gravity 0.005 instead of 0.02 and none while sprinting, holding
  sneak sinks you by 0.04 a tick, a swimmer keeps sprinting against walls and off the bottom, and
  no sprint starts or lasts on the surface unless you swim (`EntityPlayerSP.onLivingUpdate` and
  `setSprinting`, and the movement input in `thunder-qol.js`). 1.12 finds water in a box shrunk
  by 0.4 at both ends, which leaves nothing of a 0.6-tall box, so `handleWaterMovement` gets a
  box that shrinks back to the player's own; `isOpenBlockSpace` only checks the blocks a small
  box takes, so you are not pushed out of a gap. Drawing: the body turns along where you look
  (`RenderPlayer.applyRotations`), the 1.21.11 arm stroke, leg kick and head tilt
  (`ModelBiped.setRotationAngles`), for other players too (worked out from their sprinting and
  the water, or a 1.21 server's swimming flag), and the first-person camera slides to the new eye
  height (`EntityRenderer.orientCamera`). The worker gives its players the same state and box,
  so the server accepts gaps. A server that sets you back twice in 10 s while you swim or crawl
  (`SPacketPlayerPosLook.processPacket`) gets 1.12 swimming until you leave it. Four of the
  wrapped functions are also reached through prototype slots holding the original, which are
  pointed at the wrappers.
- `thunder-minimap.js` - Minimap (top corner, north up, players as dots, coordinates) and World
  Map (M or your own key: full screen, drag and scroll; the hint at the top fades away). Both are drawn from the chunks the game has loaded:
  the heightmap top block of every column in its map colour (`getMapColor`), shaded by the height
  of the block to its north; under a roof near the top of the world (the Nether) it looks down
  from your own height. A few chunks are read per frame, nearest first, again every 20 s; the map
  is kept for the session only. The HUD boxes on the minimap's side start below it, and in the top
  right it moves down while the game shows toasts (advancements, recipes, tutorial hints). The
  minimap is off by default (it reads chunks every frame); the World Map works either way.
- `thunder-waypoints.js` - Waypoints (Utility, on): B (or your own key) adds one where you stand,
  right-click on the World Map adds one there, and dying adds a "Death" point. They show on the
  minimap (at its edge when further away), on the World Map, and in the world as a diamond with the
  name and distance, projected with the camera of that frame (position and angles between ticks,
  the field of view with zoom). Right Shift > Utility > Waypoints renames, recolours, hides and
  deletes them. Kept in `localStorage["thunderWaypoints_v1"]` per server address (or singleplayer
  world, told apart by its spawn point) and dimension.
- `thunder-weapons.js` - Spears like 1.21.11 (Combat, on): on a 1.21.11 or newer server
  ViaBackwards turns spears into swords for a 1.12 client, and never sends the spear's own
  actions. A left click with a spear now sends the 1.21.11 "stab" player action
  (`CPacketPlayerDigging` with action id 7, `BlockPos.ORIGIN`, `DOWN`), only at full charge
  (cooldown 13-23 ticks by tier, as the 1.21.11 item components say), so the server's own spear
  attack runs: reach 2-4.5 blocks, hitboxes 0.125 bigger, every mob and player in line. A
  right-click charge is sent once and ended with "release use item" when you let go (1.12 never
  said), the off-hand is left alone (the spear always takes the click), spears never mine, the
  attack indicator follows the spear's real cooldown, a meter under the crosshair shows the charge
  stage and your speed, and the spear points forward while charging. Only items ViaBackwards
  marked as spears count, and never in singleplayer or a friend's world (1.12 servers). Crystal
  Tap (Combat, off): with end crystals in the main hand, a left click on obsidian or bedrock
  places a crystal; holding the button does not mine it. Offhand Swap (Combat, on): the 1.16+
  inventory move, with the inventory open, F (or your own key) over a slot sends that item to the off
  hand (`handleMouseClick` with SWAP and button 40, what 1.21 clients send; in singleplayer, a 1.12
  server, three normal clicks). Only with the inventory open and the slot you point at. Hooks `Minecraft.clickMouse`,
  `rightClickMouse`, `sendClickBlockToController` and `EntityPlayer.getCooledAttackStrength`.
- `thunder-cursor.js` - Thunder Cursor (Visual, on): the pointer is a small filled light-blue
  diamond with a black rim (a CSS cursor image, so it never lags), and a bigger outlined diamond
  follows it on a spring with a light-blue and black lightning arc between them; the faster you
  move, the further it trails, and it settles around the pointer when you stop. The follower is a
  240 x 240 canvas that moves with the mouse and only animates while catching up; nothing is drawn
  while the mouse is locked in game.
- `thunder-extras.js` - Shulker Preview (a 9 x 3 panel with the box's items and counts under its
  tooltip, read with the game's own `ItemStackHelper`; `GuiScreen.renderToolTip` is wrapped and
  its prototype slot pointed at the wrapper, since the creative inventory calls it by name) and
  Boat View 360 (`EntityBoat.applyYawToEntity` keeps turning your body with the boat but no longer
  clamps your view to 105 degrees).
- `thunder-hud.js` - the HUD widgets (FPS, CPS, coordinates, direction, speed, food, sprint,
  clock, memory, potion effects, keystrokes). With HUD Style on each is a Thunder box (dark glass,
  cyan edge; keys light up cyan while held), drawn by the game's own GUI code. Right Shift > HUD >
  HUD Style & Layout > Edit HUD Layout opens the HUD editor over the game: drag a box to move it
  (it snaps to the edges and the centre lines), scroll over it to resize it (50-300 %), right-click
  it to put it back, Esc or Done to finish. Positions are stored as a fraction of the free space
  on each axis (`localStorage["thunderHudLayout_v1"]`), so a box against an edge stays there in any
  window size. The pause menu, which opens when the mouse is released, is not drawn while editing.
  The Right Shift menu, the HUD editor and the world map all release the mouse, and the game
  answers by opening its pause menu; when one of them was opened during play, closing the last one
  closes that pause menu again (`displayGuiScreen(null)` on the game thread), so you are straight
  back in the game. A pause menu or inventory you opened yourself stays open.
- `thunder-client.js` - HUD, Right Shift menu, settings, the hooks listed in its header. Fullscreen
  covers the whole page (Eaglercraft asked for its canvas only, which hid the Right Shift menu,
  maps and HUD editor in fullscreen). Among them: Hand Item Size (scales the real first-person sword/shield through
  `ItemRenderer.renderItemInFirstPerson` + `renderItemSide`, first-person transforms only),
  Hitboxes (`RenderManager.debugBoundingBox`, kept in sync with F3+B), and a fix for a data-loss
  bug in the base runtime: deleting a world or resource pack also deleted every other world or
  pack whose folder name starts the same way (deleting "New World" wiped "New World-" and
  "New World 2"). Folder listings now end at the folder's "/"
  (`Filesystem$FilesystemHandleWrapper.eaglerIterate`, in the page and in the world Worker).
  And a fix for the End, which crashed the integrated server the moment a player arrived
  ("Exception ticking world", `NibbleArray.get` from the Alfheim lighting engine). A world
  provider has two flags, "is the Nether" and "has sky light"; chunks are built, saved and sent
  with sky light arrays by the second, but this build's lighting code (`Chunk.relightBlock`,
  `checkLight`, `setLightFor`, `getLightSubtracted` and the Alfheim engine) asks the first where
  1.12 asks `hasSkyLight()`. The Overworld and the Nether agree either way; the End has neither,
  so it was taken for a world with sky light and its missing sky light arrays were read. While
  those seven functions run for a world without sky light, the Nether flag reads set (what 1.12
  means there); everything else that reads it (lava speed, maps, flowers, world height) is
  unchanged, and the Overworld and the Nether go straight through. In the page and the Worker,
  so the End also works on servers.
- `thunder-title.js` - the title screen: the owner line "Thunder Client by ThunderGamey" above
  the version text, Thunder splash texts (most of the time; Visual >
  Thunder Title Screen > Thunder splash texts), and an animated storm drawn where the game draws its
  panorama (`GuiMainMenu.renderSkybox`): sky glow, two layers of clouds, lightning with branches,
  sparks, far hills and a blocky Minecraft skyline with trees, each layer moving by its own amount
  with the mouse. Two WebGL 2 passes (clouds at reduced resolution, then one full-resolution
  pass) with the same GL state save/restore as the shaders; Auto quality steps down on slow
  machines; any error falls back to the vanilla panorama. The logo textures
  (`minecraft.png`/`edition.png`) are swapped for THUNDER / CLIENT pixel art; turning the logo
  off restores the game's own. Left-clicking the storm (on the title screen, or behind any menu
  that shows it) sends a bolt down to exactly where you clicked, with a thunder crack. Right
  Shift > Visual > Thunder Title Screen: on/off, logo, lightning, lightning where you click,
  storm sounds, parallax strength, quality. The storm is made once per frame into its own texture
  (at half size on Low, and only every other frame while Low is still slow) and copied wherever
  it is shown.
- `thunder_ambient.js` (next to `index-js.html`, not in `classes.js`) - every sound the page
  makes outside the game, made in the browser (Web Audio, no sound files): `thunder(big, far)`,
  one lightning strike (a zap and crackle, a distorted crack, then a rolling rumble with sub-bass,
  through a compressor), used by the loading screen and by every strike on the title screen (the
  ones you click are heavier; lightning inside the clouds is only a far rumble); the loading
  screen's rain; and the menu ambience (wind, low air, a distant rumble now and then). Nothing is
  scheduled before the browser allows sound, so nothing piles up to play at once later.
  `thunder-title.js` blocks it all while a world or server is open, so none of it plays in game,
  and turns it on or off with Right Shift > Visual > Thunder Title Screen > Storm sounds. The
  build stamps its URL with its own hash like `classes.js`.
- `thunder-theme.js` - Dark Inventories (Visual, on): container screens (inventory, chests,
  furnaces, ...) draw their background texture with a dark colour multiplier set right after it
  is bound, and their grey titles light, with any resource pack. Thunder Menus: every menu in the Thunder style. The dirt behind menus
  (`GuiScreen.drawBackground`) becomes the storm; lists (worlds, servers, options, packs, ...)
  get the storm under a see-through glass area and repaint it in their header and footer
  (`GuiSlot.overlayBackground`); buttons and sliders draw from a Thunder copy of the button rows
  of `widgets.png` while `GuiButton.drawButton` runs (the hotbar keeps the real one), with white
  labels; text boxes, the Edit Profile boxes and the Credits panel are recoloured. Right Shift >
  Visual > Thunder Menus: on/off, storm or plain dark backgrounds (fastest), Thunder buttons.
- `thunder-packs.js` - the built-in resource packs (Thunder 1.21.11 and Thunder PvP, in
  `packs/`). On first start they are written into the game's own resource pack storage and
  `resourcepacks/manifest.json`, exactly as the game's own import would write them, so they
  appear in Options > Resource Packs.
  - Writing the packs uses no game code, and only opens the storage after the game has created it.
  - Thunder 1.21.11 is then switched on once per browser, the way Options > Resource Packs > Done
    does it (`ResourcePackRepository.setRepositories`, `GameSettings.resourcePacks`, saved to
    options.txt, resources reloaded), below any packs already on. Switched off later, it stays
    off (`localStorage["thunderPack121On"]`). Thunder PvP is never switched on for the player.
  - A pack the player deletes stays deleted.
  - A pack whose zip changed (hash in `packs/packs.json`) is updated in place; when that pack is
    switched on, the resources are reloaded once so the new version shows straight away.
  - Right Shift > Utility > Built-in Resource Packs shows the status and can add them again.

  The packs themselves are built by `thunder/packs/build_packs.py`; see
  [packs/README.md](packs/README.md).
- `thunder-items.js` - Newer Items on Servers (Right Shift > Visual, on by default). A newer server
  sends every item 1.12 does not have (mace, spears, wind charge, netherite gear, ...) as an old
  item named like "1.21.11 Netherite Spear", and keeps the real id in the item's data
  (`VB|Protocol<newer>To<older>|id`, read with `NBTTagCompound.hasKey` / `getInteger` and turned
  back into the item by `thunder-items-data.js`, made by `thunder/packs/item_ids.py`). For such an
  item, the model
  `item/thunder/<name in lower_case_words>` from the resource packs is drawn instead
  (`RenderItem.getItemModelWithOverrides`): in the GUI, in the hand (`<name>_in_hand` first, the
  long spears), on the ground and on other players. Worn netherite, copper and turtle armor named
  that way gets the pack's armor texture (`LayerArmorBase.renderArmorLayer` +
  `getArmorResource`). Items without such a name, or when no loaded pack has the model, are left
  to the game. The models are in Thunder 1.21.11 (see [packs/README.md](packs/README.md)). The
  card's "Check the item in my hand" says what the held item was seen as.
- `thunder-hitfx.js` - Right Shift > Visual > Hit Effects (off by default).
  `Minecraft.clickMouse` is wrapped to read what you left-clicked; between frames (runOnGame) the
  effect is made on the player or mob you hit: Thunder shock (a jagged little bolt of blue
  enchanted-hit particles from above their head into the body, sparks, and a zap sound), Lightning
  strike (the game's own lightning bolt, effect only, with its crack and rumble), or a burst of
  crit, magic, flame, heart, end rod or totem particles. Only you see and hear it.
- `thunder-perf.js` - Max FPS (Right Shift > Utility): one click applies the fastest settings.
  - Game settings: render distance 6 or less, Fast graphics, smooth lighting, clouds and entity
    shadows off, minimal particles and unlimited framerate. These go through the game's own
    setters and are saved to options.txt.
  - Thunder settings: shaders off, plain menu backgrounds, Low title quality.
  - In a world it counts frames with VSync on and off for a few seconds each and keeps the faster
    one. VSync off helps a strong GPU but can flood a weak one: on a software GPU it went from
    60 to about 10 FPS.
  - Undo restores the previous settings.

  The FPS HUD module now shows the game's own frame count (what F3 shows) instead of the
  browser's animation-frame rate.
- `thunder-shaders.js` - optional shader/post-processing system (Right Shift > Shaders). How it
  hooks the renderer, the pipeline, presets, FPS safety and limits: [SHADERS.md](SHADERS.md).
- `thunder-world.js` - world shader effects that follow the Shaders switch: Waving Plants (grass,
  flowers, crops, leaves, vines) and Water (waves, sky reflections, sun glints), added to
  Eaglercraft's own terrain shader; and See-through Leaves (Visual tab). How: [SHADERS.md](SHADERS.md).
- `thunder-lan.js` - Friends: open a singleplayer world to friends with a join code and join a
  friend's world (EaglerSPRelay signalling + WebRTC, bridged to the integrated server's player
  channels), with Thunder's own relay (`thunder-relay/`, a Cloudflare Worker reached at `/relay`
  through `functions/relay.js`) that gives codes and carries the game when players cannot connect
  directly, the site's TURN relay (`functions/turn.js`), a Connection test, and Always open (a
  computer left on loads and shares one world by itself, and shares it again when the connection
  drops). How to use it, how to switch the relays on, how it works, what was tested and the
  limits: [NETWORKING.md](NETWORKING.md).
- `thunder-social.js` - Thunder Friends: accounts (a name only you can use and a password; create,
  log in, change password, log out, and a recovery code for a forgotten password: 20 letters and
  digits without I, L, O, 0 or 1, made in the browser and shown once with Copy and Save as file;
  the hub gets only SHA-256 of `thunder-recovery:<name>:<code>` and keeps a salted hash of that;
  using it sets a new password, logs out every other device and uses the code up. Tested in two
  browsers: made, saved as a file, used from the other browser with lowercase and spaces, which
  logged out the first; a used or mistyped code, and the old password, were refused; 17 hub
  checks), a friends list across Thunder Client (add by name),
  who is on Thunder now, chat (O opens it), pop-ups for messages, requests, invites and friends
  coming online, and friends' open worlds with who is playing and Join (in the list, the chat and
  on the Singleplayer / Multiplayer screens), with the host's choice of one-click Join or the code
  (a switch it adds to the Open to Friends card). It talks to the friends hub in the relay Worker
  (`thunder-relay/social.js`, one Durable Object for everyone) at `/social`
  (`functions/social.js`). Details: [NETWORKING.md](NETWORKING.md).

- `offline.js` and `offline-loader.js` - the offline file, `thunder-offline.html`: the site in one
  HTML file that runs from a folder (`node thunder/offline.js`; the GitHub Action
  `thunder-offline.yml` puts it on the "offline" release on every update). The big files are
  base64 blocks at the end of the page; the loader serves them to the game (a page opened from a
  folder cannot read the files next to it), runs the game code as an inline script with
  `eaglercraftXClientScriptElement` (so singleplayer gets its worker), and updates the file:
  `thunder-version.json` (written by `build.js`: a number that goes up with every classes.js, its
  size and SHA-256, and the packs list's hash) is read from GitHub 30 s after the game starts; a
  higher number downloads that classes.js (checked) and the packs into IndexedDB for the next
  start. An update that does not load, or does not reach the first menu twice, is skipped and the
  copy in the file runs. Tested: the file from a folder in Chromium (title screen, packs,
  singleplayer world with its worker); an update from a stand-in server (downloaded, checked,
  "Restart now", running with its packs); a broken update (skipped, the copy in the file ran).
  The loader also tells the game the website's address (`window.thunderSite`;
  `THUNDER_OFFLINE_SITE` changes it for tests), which the game uses for the Thunder relay, the
  TURN logins and Thunder Friends (`siteUrl` in `thunder-lan.js`; a file from before falls back to
  thunderclient.pages.dev). The website lets a page opened from a folder in (`Origin: null`); see
  "The offline file" in [NETWORKING.md](NETWORKING.md).

## Backups

- `backups/classes.clean-base.js` - clean Eaglercraft 1.12.2 (u0) JS build, the build input.
- `backups/classes.thunder-v4-working.js` - the Thunder build that was live before v6.
