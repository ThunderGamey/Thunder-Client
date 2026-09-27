"""1.12 -> 1.21.11 texture name tables for the Thunder 1.21.11 pack.

block_name(n) / item_name(n) turn a 1.12 texture name (textures/blocks, textures/items) into the
1.21.11 name (textures/block, textures/item). They return None when 1.21.11 has no counterpart.
"""
import re

COLORS = ['white', 'orange', 'magenta', 'light_blue', 'yellow', 'lime', 'pink', 'gray', 'silver',
          'cyan', 'purple', 'blue', 'brown', 'green', 'red', 'black']
_COL = '(' + '|'.join(COLORS) + ')'


def color(c):
    return 'light_gray' if c == 'silver' else c


WOODS = {'oak': 'oak', 'spruce': 'spruce', 'birch': 'birch', 'jungle': 'jungle', 'acacia': 'acacia',
         'big_oak': 'dark_oak', 'dark_oak': 'dark_oak', 'roofed_oak': 'dark_oak', 'wood': 'oak'}
_WOOD = '(' + '|'.join(sorted(WOODS, key=len, reverse=True)) + ')'

BLOCKS = {
    'anvil_base': 'anvil', 'anvil_top_damaged_0': 'anvil_top', 'anvil_top_damaged_1': 'chipped_anvil_top',
    'anvil_top_damaged_2': 'damaged_anvil_top', 'brick': 'bricks', 'cobblestone_mossy': 'mossy_cobblestone',
    'comparator_off': 'comparator', 'repeater_off': 'repeater', 'deadbush': 'dead_bush',
    'dirt_podzol_side': 'podzol_side', 'dirt_podzol_top': 'podzol_top',
    'dispenser_front_horizontal': 'dispenser_front', 'dropper_front_horizontal': 'dropper_front',
    'end_bricks': 'end_stone_bricks', 'endframe_eye': 'end_portal_frame_eye',
    'endframe_side': 'end_portal_frame_side', 'endframe_top': 'end_portal_frame_top',
    'farmland_dry': 'farmland', 'farmland_wet': 'farmland_moist', 'fire_layer_0': 'fire_0',
    'fire_layer_1': 'fire_1', 'furnace_front_off': 'furnace_front', 'grass_path_side': 'dirt_path_side',
    'grass_path_top': 'dirt_path_top', 'grass_side': 'grass_block_side',
    'grass_side_overlay': 'grass_block_side_overlay', 'grass_side_snowed': 'grass_block_snow',
    'grass_top': 'grass_block_top', 'hardened_clay': 'terracotta', 'ice_packed': 'packed_ice',
    'itemframe_background': 'item_frame', 'mob_spawner': 'spawner', 'nether_brick': 'nether_bricks',
    'noteblock': 'note_block', 'observer_back_lit': 'observer_back_on', 'piston_top_normal': 'piston_top',
    'portal': 'nether_portal', 'prismarine_dark': 'dark_prismarine', 'prismarine_rough': 'prismarine',
    'pumpkin_face_off': 'carved_pumpkin', 'pumpkin_face_on': 'jack_o_lantern',
    'red_nether_brick': 'red_nether_bricks', 'redstone_lamp_off': 'redstone_lamp',
    'redstone_torch_on': 'redstone_torch', 'reeds': 'sugar_cane', 'slime': 'slime_block',
    'sponge_wet': 'wet_sponge', 'stone_slab_side': 'smooth_stone_slab_side', 'stone_slab_top': 'smooth_stone',
    'tallgrass': 'short_grass', 'torch_on': 'torch', 'trapdoor': 'oak_trapdoor', 'trip_wire': 'tripwire',
    'trip_wire_source': 'tripwire_hook', 'waterlily': 'lily_pad', 'web': 'cobweb',
    'stonebrick': 'stone_bricks', 'stonebrick_carved': 'chiseled_stone_bricks',
    'stonebrick_cracked': 'cracked_stone_bricks', 'stonebrick_mossy': 'mossy_stone_bricks',
    'quartz_block_chiseled': 'chiseled_quartz_block', 'quartz_block_chiseled_top': 'chiseled_quartz_block_top',
    'quartz_block_lines': 'quartz_pillar', 'quartz_block_lines_top': 'quartz_pillar_top',
    'quartz_ore': 'nether_quartz_ore', 'mushroom_block_skin_stem': 'mushroom_stem',
    'rail_normal': 'rail', 'rail_normal_turned': 'rail_corner',
    'flower_allium': 'allium', 'flower_blue_orchid': 'blue_orchid', 'flower_dandelion': 'dandelion',
    'flower_houstonia': 'azure_bluet', 'flower_oxeye_daisy': 'oxeye_daisy', 'flower_rose': 'poppy',
    'flower_tulip_orange': 'orange_tulip', 'flower_tulip_pink': 'pink_tulip',
    'flower_tulip_red': 'red_tulip', 'flower_tulip_white': 'white_tulip',
    'door_iron_lower': 'iron_door_bottom', 'door_iron_upper': 'iron_door_top',
}

DOUBLE_PLANTS = {'fern': 'large_fern', 'grass': 'tall_grass', 'paeonia': 'peony', 'rose': 'rose_bush',
                 'sunflower': 'sunflower', 'syringa': 'lilac'}

_BLOCK_RULES = [
    (r'wool_colored_' + _COL, lambda m: color(m[1]) + '_wool'),
    (r'hardened_clay_stained_' + _COL, lambda m: color(m[1]) + '_terracotta'),
    (r'glazed_terracotta_' + _COL, lambda m: color(m[1]) + '_glazed_terracotta'),
    (r'concrete_powder_' + _COL, lambda m: color(m[1]) + '_concrete_powder'),
    (r'concrete_' + _COL, lambda m: color(m[1]) + '_concrete'),
    (r'glass_pane_top_' + _COL, lambda m: color(m[1]) + '_stained_glass_pane_top'),
    (r'glass_' + _COL, lambda m: color(m[1]) + '_stained_glass'),
    (r'shulker_top_' + _COL, lambda m: color(m[1]) + '_shulker_box'),
    (r'log_' + _WOOD + r'(_top)?', lambda m: WOODS[m[1]] + '_log' + (m[2] or '')),
    (r'planks_' + _WOOD, lambda m: WOODS[m[1]] + '_planks'),
    (r'leaves_' + _WOOD, lambda m: WOODS[m[1]] + '_leaves'),
    (r'sapling_' + _WOOD, lambda m: WOODS[m[1]] + '_sapling'),
    (r'door_' + _WOOD + r'_(lower|upper)', lambda m: WOODS[m[1]] + '_door_' + ('bottom' if m[2] == 'lower' else 'top')),
    (r'(beetroots|carrots|cocoa|nether_wart|potatoes|wheat)_stage_(\d)', lambda m: m[1] + '_stage' + m[2]),
    (r'double_plant_(fern|grass|paeonia|rose|sunflower|syringa)_(bottom|top|front|back)',
     lambda m: DOUBLE_PLANTS[m[1]] + '_' + m[2]),
    (r'(melon|pumpkin)_stem_connected', lambda m: 'attached_' + m[1] + '_stem'),
    (r'(melon|pumpkin)_stem_disconnected', lambda m: m[1] + '_stem'),
    (r'rail_(golden|detector|activator)(_powered)?',
     lambda m: {'golden': 'powered_rail', 'detector': 'detector_rail', 'activator': 'activator_rail'}[m[1]]
     + ('_on' if m[2] else '')),
    (r'mushroom_block_skin_(brown|red)', lambda m: m[1] + '_mushroom_block'),
    (r'mushroom_(brown|red)', lambda m: m[1] + '_mushroom'),
    (r'stone_(granite|diorite|andesite)', lambda m: m[1]),
    (r'stone_(granite|diorite|andesite)_smooth', lambda m: 'polished_' + m[1]),
    (r'(red_)?sandstone_normal', lambda m: (m[1] or '') + 'sandstone'),
    (r'(red_)?sandstone_carved', lambda m: 'chiseled_' + (m[1] or '') + 'sandstone'),
    (r'(red_)?sandstone_smooth', lambda m: 'cut_' + (m[1] or '') + 'sandstone'),
]

ITEMS = {
    'apple_golden': 'golden_apple', 'beef_cooked': 'cooked_beef', 'beef_raw': 'beef',
    'book_enchanted': 'enchanted_book', 'book_normal': 'book', 'book_writable': 'writable_book',
    'book_written': 'written_book', 'bow_standby': 'bow', 'broken_elytra': 'elytra_broken',
    'bucket_empty': 'bucket', 'bucket_lava': 'lava_bucket', 'bucket_milk': 'milk_bucket',
    'bucket_water': 'water_bucket', 'carrot_golden': 'golden_carrot', 'chicken_cooked': 'cooked_chicken',
    'chicken_raw': 'chicken', 'chorus_fruit_popped': 'popped_chorus_fruit', 'door_iron': 'iron_door',
    'dye_powder_black': 'ink_sac', 'dye_powder_blue': 'lapis_lazuli', 'dye_powder_brown': 'cocoa_beans',
    'dye_powder_white': 'bone_meal', 'fireball': 'fire_charge', 'fireworks': 'firework_rocket',
    'fireworks_charge': 'firework_star', 'fireworks_charge_overlay': 'firework_star_overlay',
    'fish_clownfish_raw': 'tropical_fish', 'fish_cod_cooked': 'cooked_cod', 'fish_cod_raw': 'cod',
    'fish_pufferfish_raw': 'pufferfish', 'fish_salmon_cooked': 'cooked_salmon', 'fish_salmon_raw': 'salmon',
    'fishing_rod_uncast': 'fishing_rod', 'map_empty': 'map', 'map_filled': 'filled_map',
    'map_filled_markings': 'filled_map_markings', 'melon': 'melon_slice',
    'melon_speckled': 'glistering_melon_slice', 'minecart_chest': 'chest_minecart',
    'minecart_command_block': 'command_block_minecart', 'minecart_furnace': 'furnace_minecart',
    'minecart_hopper': 'hopper_minecart', 'minecart_normal': 'minecart', 'minecart_tnt': 'tnt_minecart',
    'mutton_cooked': 'cooked_mutton', 'mutton_raw': 'mutton', 'netherbrick': 'nether_brick',
    'porkchop_cooked': 'cooked_porkchop', 'porkchop_raw': 'porkchop', 'potato_baked': 'baked_potato',
    'potato_poisonous': 'poisonous_potato', 'potion_bottle_drinkable': 'potion',
    'potion_bottle_empty': 'glass_bottle', 'potion_bottle_lingering': 'lingering_potion',
    'potion_bottle_splash': 'splash_potion', 'rabbit_cooked': 'cooked_rabbit', 'rabbit_raw': 'rabbit',
    'redstone_dust': 'redstone', 'reeds': 'sugar_cane', 'seeds_melon': 'melon_seeds',
    'seeds_pumpkin': 'pumpkin_seeds', 'seeds_wheat': 'wheat_seeds', 'seeds_beetroot': 'beetroot_seeds',
    'sign': 'oak_sign', 'slimeball': 'slime_ball', 'spider_eye_fermented': 'fermented_spider_eye',
    'totem': 'totem_of_undying', 'wooden_armorstand': 'armor_stand', 'gold_horse_armor': 'golden_horse_armor',
}

_ITEM_RULES = [
    (r'dye_powder_' + _COL, lambda m: color(m[1]) + '_dye'),
    (r'door_' + _WOOD, lambda m: WOODS[m[1]] + '_door'),
    (r'record_(\w+)', lambda m: 'music_disc_' + m[1]),
    (r'gold_(axe|boots|chestplate|helmet|hoe|leggings|pickaxe|shovel|sword)', lambda m: 'golden_' + m[1]),
    (r'wood_(axe|hoe|pickaxe|shovel|sword)', lambda m: 'wooden_' + m[1]),
]


def _apply(name, table, rules):
    if name in table:
        return table[name]
    for pat, fn in rules:
        m = re.fullmatch(pat, name)
        if m:
            return fn(m)
    return name


def block_name(n):
    return _apply(n, BLOCKS, _BLOCK_RULES)


def item_name(n):
    return _apply(n, ITEMS, _ITEM_RULES)
