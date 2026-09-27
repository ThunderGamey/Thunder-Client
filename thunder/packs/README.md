# Built-in resource packs

Thunder ships two resource packs in [`packs/`](../../packs) and adds them to the game's pack list
the first time someone opens the client (Options > Resource Packs). **Thunder 1.21.11** is then
switched on once, the same way the Done button of that screen does it; switched off later, it stays
off. **Thunder PvP** is never switched on for the player: to use it, select it so it sits above
Thunder 1.21.11.

| Pack | What it is |
| --- | --- |
| `Thunder-1.21.11.zip` | The textures of Minecraft Java 1.21.11, converted to the names and sheet layouts of 1.12, plus the items added since 1.12 (maces, spears, wind charges, netherite gear, ...) for newer servers. |
| `Thunder-PvP.zip` | A clean PvP look (plain armor, flat swords and tools, calmer blocks, clean crits, small totem, low fire, wireframe crystals, gapped hotbar), made from the 1.21.11 textures to sit on top of Thunder 1.21.11. |

Both use `pack_format` 3 (1.12) and pass the Pack Doctor (`node thunder/pack-doctor-cli.js <zip>`).

## Thunder 1.21.11

- **Blocks and items:** every 1.12 texture that has a 1.21.11 counterpart, renamed back to its 1.12
  name. There are 477 block and 339 item textures, and the name table is in `names.py`. Animated
  textures keep their 1.21 `.mcmeta`. Water is tinted with the post-1.13 default water colour
  (1.21 water textures are grey and tinted per biome).
- **Mobs:** these use the 1.21 skin wherever the 1.12 model still matches it (same sheet shape and
  painted area): zombies, skeletons, creepers, spiders, endermen, the dragon, wither, wolves,
  cats, sheep, chickens, llamas, parrots, rabbits, the iron and snow golems, and more.
- **Kept from 1.12:** mobs whose 1.21 model differs keep their 1.12 skins: cows, pigs,
  mooshrooms, horses, villagers, zombie villagers, zombie pigmen, bats, vexes, magma cubes and
  arrows.
- **Armour, elytra and shields:** from the 1.21 equipment textures. Banner and shield patterns
  are converted to the 1.12 mask format.
- **Chests:** since 1.15 the chest model is drawn the other way up, so the same sheet maps to
  different faces. Every texel is re-mapped through world space onto the 1.12 chest model, and the
  1.21 double-chest halves are joined into the 1.12 double sheet.
- **GUI:** rebuilt from the 1.21 sprites into the 1.12 sheets. This covers the hotbar, buttons,
  hearts, hunger, armour, XP and jump bars, boss bars, ping icons, effect icons, containers
  (inventory, furnace, brewing stand, enchanting table, anvil, beacon, horse, crafting table),
  the book, the recipe book, toasts, and the pack, server and world list buttons.
- **Also converted:** particles, explosion and sweep sheets, the sun, moon phases, clouds,
  rain, snow, map icons, paintings, colormaps and screen overlays.

## Thunder PvP

These are original textures, made by `pvp.py` from the 1.21.11 ones.

- **Plain armor:** worn diamond, iron, gold and netherite armor in one flat colour per piece with
  a darker edge around every face, and matching flat armor icons.
- **Swords and tools:** swords, axes, pickaxes, shovels and hoes (wood to netherite) and the
  spears with one tone per material, a dark outline and a light top-left edge. Snowballs match.
  Netherite and the spears are the newer items of Thunder 1.21.11, so this needs both packs on.
- **Animated items:**
  - the totem of undying glows light blue: the glow pulses and a short light-blue flash goes over
    the totem at its brightest (1.6 s)
  - three small ender pearls go round the ender pearl on a tilted ring, in front of it and behind
    it, with a short flash every 2.4 s
  - a light band sweeps over the golden apple every 2 s
- **Calmer blocks:** grass, dirt, stone, cobblestone, planks, logs, sand, gravel, sandstone,
  wool, bricks, end stone, netherrack, snow and clay with fewer tones and no stray pixels.
- **Particles:** crit hits are a small clean plus, sharpness hits a small x.
- **Hotbar:** separate dark slots with gaps, a light grey selected slot, and a matching off-hand
  slot.
- **End crystals:** a thin wire cage around a bright pink core.
- **Obsidian:** dark and smooth.
- **Cobweb:** bright white.
- **Glass:** clear, with only the frame.
- **Fire:** low, for fire blocks, burning mobs and the first-person overlay.
- **Totem of undying:** smaller in the hotbar (72%) and in the hand (38% of vanilla), drawn at twice
  the detail for the glow. The pop animation is half size.
- **Shield:** a little lower and smaller in first person.
- **Removed or reduced clutter:**
  - no pumpkin blur, no vignette, and no sweep or damage-heart particles
  - smaller explosions and potion swirls
  - shorter grass and ferns

## Items newer than 1.12

The mace, the spears, the wind charge, netherite gear and the other items added after 1.12 do not
exist in this game version. On a newer server the proxy (ViaVersion / ViaBackwards) sends each of
them to a 1.12 client as an old item with a name in front of it, such as "1.21.11 Netherite Spear"
or "1.21 Mace". When the server gave the item a name of its own (a kit item called "Spear", say),
that name stays, but ViaBackwards still keeps the item's real id in its data, under
`VB|Protocol<newer>To<older>|id`.

- **In the pack:** Thunder 1.21.11 has a model and a texture for every item added since 1.12
  (`models/item/thunder/` and `textures/items/thunder/`), named after the item's English name in
  lower-case words: `mace`, `wind_charge`, `netherite_spear`, `netherite_sword`, ...
- **Spears:** they also get `<name>_in_hand`, the long spear model from 1.21.11, used while one is
  held.
- **Worn armor:** netherite, copper and turtle armor get their 1.21.11 layer textures
  (`textures/models/armor/`).
- **How 1.12 loads them:** 1.12 only loads the models that some item uses, so the models are listed
  as overrides of `models/item/barrier.json` with a predicate that never matches. Barriers look the
  same as before.
- **How they are drawn:** `thunder/thunder-items.js` (Right Shift > Visual > Newer Items on Servers,
  on by default) finds the item from its name ("1.21.11 Netherite Spear", or "vb.item.mace") or,
  failing that, from the ViaBackwards id, and draws the matching model: in the hotbar and
  inventories, in the hand, dropped on the ground and on other players; worn armor gets its
  texture too. `thunder/thunder-items-data.js` turns the ids back into items; it is written by
  `python3 thunder/packs/item_ids.py` from the item lists of each version (PrismarineJS
  minecraft-data). Everything else is left alone, so a real iron sword still looks like an iron
  sword. The card's "Check the item in my hand" button says what the item in your hand was seen
  as, and why.
- **Not covered:** blocks added after 1.12, and thrown wind charges, tridents and other newer
  entities. Only items are re-skinned.

## Rebuilding

```
python3 thunder/packs/build_packs.py            # needs Python 3.8+ and Pillow
```

The builder does three things:

1. Reads the 1.12 layouts from the game's own `assets.epk` (read only).
2. Downloads the 1.21.11 textures (and the English item names and the spear, mace and crossbow
   models it needs) once into `~/.cache/thunder-packs/1.21.11`, from
   github.com/InventivetalentDev/minecraft-assets (branch `1.21.11`).
3. Writes both zips and `packs/packs.json`.

The output is byte-for-byte reproducible. `packs.json` holds a hash of each zip. When it changes,
`thunder/thunder-packs.js` updates the pack in place for players who still have it. A pack a player
deleted stays deleted. Right Shift > Utility > Built-in Resource Packs shows which packs are in
the list and can add them again.

`--check` prints how far each GUI piece moved from the 1.12 sheet it replaced. This is a quick
way to spot a sprite placed at the wrong spot.

The 1.21.11 textures are Mojang's, like the rest of the game's assets in `assets.epk`.
