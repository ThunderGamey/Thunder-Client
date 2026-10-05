# ABOUT

This project is a version of eaglercraftX based on Minecraft 1.12, specifically optimized for performance. It is legally licensed under the MIT License.

## Key Features

* **Version 1.12:** Built upon the core features of Minecraft version 1.12.
* **Performance Focused:** Engineered for enhanced performance and efficiency.

## Owner

Thunder Client is created and owned by **Jayvardhan Ginni (ThunderGamey)**. All Thunder Client
code, textures and designs in this repository (everything under `thunder/`, the Thunder packs in
`packs/` and the Thunder parts of `classes.js`) are by ThunderGamey. Eaglercraft is by lax1dude and
Minecraft and its assets are by Mojang; those parts are not ThunderGamey's.

In the client, the title screen and the Right Shift menu say "ThunderGamey"; the full credit is
in Right Shift > Utility > Readme.

## Thunder Client

- **`index-js.html`** - Thunder Client on the Eaglercraft 1.12 JavaScript runtime. The Thunder
  loading screen (a storm with thunder, the logo and a loading bar that follows the real start-up)
  shows the moment the page opens, and the game starts straight on the title screen (no Edit
  Profile screen every time). A Thunder-style
  HUD you can rearrange (drag boxes to move them, scroll to resize them), Right Shift menu (HUD,
  combat, movement, visual options including Hand Item Size, Hitboxes, See-through Leaves and
  Hit Effects (a thunder shock or lightning on what you hit), and a one-click Max FPS that also
  tests whether VSync on or off is faster on your device); Totem Counter, Pickup Notifier, Target
  Crosshair, Shield Status colours, Zoom (hold C or your own key, scroll to zoom further), Freelook
  (hold X to look around your player in third person while you keep going straight), Chat Tools
  (lines that say your name in gold with a soft ding, repeated messages merged into one line with
  (x2), the time before each line, Auto GG), World Backup (one file with all your singleplayer
  worlds and settings, to keep or move to another computer; Load backup brings them back, and a
  world whose save was cut off by a closed tab is repaired by itself), Minimap and World Map
  (M), Waypoints (B, or right-click the World Map; shown in the world with the distance; Share sends
  one to a Thunder Friends friend, who adds it with one click), Shulker Preview, Toggle Sneak, Clear Chat, Password Hider, Show Own Name Tag, Crystal
  Optimizer, Crystal Tap, Modern Swimming (swim and crawl like 1.21.11: sprint underwater to swim
  where you look, through one-block gaps, in singleplayer, Friends worlds and on servers), Offhand Swap (F over a totem in your inventory puts it in your off hand, like
  1.16+), Spears like 1.21.11 (the jab with its full reach and the charge work on
  1.21.11 servers), XP Orb Clumping, Fast XP, Boat View 360, No Enchant Glint, No Rain, No Pumpkin Blur,
  Dark Inventories, the Thunder Cursor (a light-blue diamond with a lightning trail) and Thunder
  menu sounds,
  optional shaders (LOW / MEDIUM / HIGH looks, glowing lava and torches, underwater rays, waving
  plants and leaves, reflective waves on water), an animated Thunder title screen (storm clouds,
  lightning, sparks and a blocky skyline that shift with the mouse, lightning that strikes where
  you click, wind and thunder sounds on the menus only, the THUNDER CLIENT logo and ThunderGamey
  splash texts), Thunder menus
  everywhere (storm backgrounds, glass lists, Thunder buttons, sliders and text boxes), and **Friends**:
  open your singleplayer world to friends with a join code (Esc > Open to Friends) and join a
  friend's world from Right Shift > Friends. With Thunder's own relay switched on
  (`thunder-relay/`, set up once in Cloudflare: see NETWORKING.md), codes and games work from any
  network where the page loads: when two players cannot connect directly, the game goes through
  the relay. The optional TURN relay (`functions/turn.js`) makes those connections faster, and
  Right Shift > Friends > Connection test shows what a network lets through. **Always open**
  (Open to Friends card) turns a computer that is left on into the world's home: the world opens
  by itself whenever Thunder starts there and is shared again whenever the connection drops.
  **Thunder Friends** (with an account: a name only you can use and a password, like the logins of
  Eaglercraft servers): add friends by name, see who is on Thunder and what your friends are
  playing (and when offline friends were last online), chat with them (O in a world, with pop-ups
  while you play), join the worlds they open (and see who is playing in them) and the servers they
  are on, from the list, an invite or the Singleplayer / Multiplayer screens; the host picks
  one-click Join or friends needing the code. A recovery code (made once in Account) resets a
  forgotten password. With **Settings Sync** your settings follow your
  account: Thunder's settings, HUD layout, key bindings, mouse, sound and chat options, server list
  and server waypoints are the same on every computer you sign in on (shaders and video settings
  stay per computer).
  Source and build: [`thunder/`](thunder/README.md), shaders:
  [`thunder/SHADERS.md`](thunder/SHADERS.md), Friends: [`thunder/NETWORKING.md`](thunder/NETWORKING.md).
- **`thunder-offline.html`** ([download](https://github.com/ThunderGamey/Thunder-Client/releases/download/offline/thunder-offline.html))
  - the whole client in one file, for when the website is blocked: keep it in a folder
  (Downloads is fine) and open it in Chrome or Edge. It updates itself: whenever it can reach
  GitHub (raw.githubusercontent.com, or cdn.jsdelivr.net) it downloads the newest Thunder for the
  next start, and otherwise it runs the version inside it. Worlds and settings in the file are
  kept apart from the website's (move a world with Edit > Export and Load EPK File). Wherever
  thunderclient.pages.dev can be reached (at home, say), the file uses its Thunder relay, TURN
  relay and Thunder Friends just like the website (log in to your Thunder Friends account once in
  the file); where it is blocked, joining friends' worlds by code still works through the public
  Eaglercraft relays. Made by `thunder/offline.js` on every update (GitHub Action
  `thunder-offline.yml`).
- **`index.html`** - the original WASM-GC launcher (unchanged).
- **`packs/`** - Thunder's two built-in resource packs, which appear in Options > Resource Packs
  the first time the client is opened:
  - **Thunder 1.21.11** (switched on for you): Minecraft 1.21.11 textures converted for 1.12. On
    servers it also shows maces, spears, wind charges, netherite gear and the other items added
    since 1.12 with their real textures (they arrive renamed, like "1.21.11 Netherite Spear").
  - **Thunder PvP** (off until you pick it): plain armor and flat swords and tools (netherite
    too), a glowing light-blue totem, small pearls circling the ender pearl, a shining golden
    apple, calmer blocks, clean crit particles, low fire, wireframe crystals and a clean hotbar.
    Put it above Thunder 1.21.11.

  What is in them and how they are built: [`thunder/packs/README.md`](thunder/packs/README.md).
- **`Thunder-Updated-Textures-FIXED.zip`** - the older Thunder resource pack (newer-style
  textures for 1.12), checked with the Pack Doctor (`thunder-pack-doctor.html`).

## License

This project is licensed under the [MIT License](https://opensource.org/licenses/MIT).
