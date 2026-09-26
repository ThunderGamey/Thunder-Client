/* ========================= THUNDER CLIENT NATIVE v6 (HUD + Right Shift menu) =========================
   Built into classes.js by thunder/build.js, which verifies every game name below against the
   base build's own deobfuscation table before writing anything. Do not edit classes.js by hand.

   Game functions this block replaces (each wrapper always falls through to the original):
   @hook Ewc net.minecraft.client.gui.GuiIngame.renderGameOverlay
   @hook C94 net.minecraft.client.renderer.ItemRenderer.renderFireInFirstPerson
   @hook FN3 net.minecraft.client.renderer.EntityRenderer.hurtCameraEffect
   @hook Cyx net.minecraft.client.renderer.EntityRenderer.setupViewBobbing
   @hook Dvp net.minecraft.client.renderer.EntityRenderer.getFOVModifier
   @hook G7V net.minecraft.util.datafix.DataFixesManager.createFixer
   @hook Ckt net.minecraft.client.gui.GuiIngame.renderHotbar
   @hook EjD net.minecraft.entity.EntityLivingBase.getHeldItemOffhand
   @hook DR$ net.minecraft.client.renderer.texture.TextureAtlasSprite.loadSprite
   @hook DkZ net.minecraft.client.renderer.ItemRenderer.renderItemInFirstPerson
   @hook Ch0 net.minecraft.client.renderer.ItemRenderer.renderItemSide
   @hook Gxt net.minecraft.client.renderer.entity.RenderManager.doRenderEntity
   (thunder-shaders.js adds its own hook and names in its header; build.js reads both.)

   Game functions it calls:
   @use Ff$ net.minecraft.init.Bootstrap.register
   @use CBg net.minecraft.entity.Entity.isSprinting
   @use Fch net.minecraft.entity.Entity.isSneaking
   @use FPB net.minecraft.entity.EntityLivingBase.setSprinting
   @use F9v net.minecraft.entity.EntityLivingBase.getActivePotionEffects
   @use EZ6 net.minecraft.entity.EntityLivingBase.getHeldItemMainhand
   @use Ctr net.minecraft.entity.EntityLivingBase.isActiveItemStackBlocking
   @use A4G net.minecraft.client.entity.EntityPlayerSP.isHandActive
   @use FAU net.minecraft.entity.player.EntityPlayer.getFoodStats
   @use ZP net.minecraft.util.FoodStats.getFoodLevel
   @use A1i net.minecraft.util.FoodStats.getSaturationLevel
   @use CCI net.minecraft.item.ItemStack.func_190926_b
   @use CRD net.minecraft.item.ItemStack.func_190916_E
   @use EJu net.minecraft.item.ItemStack.getDisplayName
   @use EjU net.minecraft.item.ItemStack.getMaxDamage
   @use EHa net.minecraft.item.ItemStack.getItemDamage
   @use CSt net.minecraft.potion.PotionEffect.getEffectName
   @use ELx net.minecraft.potion.PotionEffect.getAmplifier
   @use D8_ net.minecraft.potion.PotionEffect.getDuration
   @use Chf net.minecraft.client.gui.GuiIngame.getFontRenderer
   @use CC net.minecraft.client.gui.FontRenderer.getStringWidth
   @use AIz net.minecraft.client.gui.ScaledResolution.getScaledWidth
   @use ASe net.minecraft.client.gui.ScaledResolution.getScaledHeight
   @use D49 net.minecraft.client.gui.Gui.drawRect
   @use CFi net.lax1dude.eaglercraft.opengl.GlStateManager.color
   @use Eu0 net.lax1dude.eaglercraft.opengl.GlStateManager.pushMatrix
   @use ECi net.lax1dude.eaglercraft.opengl.GlStateManager.popMatrix
   @use DPm net.lax1dude.eaglercraft.opengl.GlStateManager.translate
   @use FWK net.lax1dude.eaglercraft.opengl.GlStateManager.scale
   @use Dnz net.minecraft.client.renderer.RenderHelper.disableStandardItemLighting
   @use FKF net.minecraft.client.renderer.RenderHelper.enableGUIStandardItemLighting
   @use FkK net.minecraft.client.renderer.RenderItem.renderItemAndEffectIntoGUI
   @use F8l net.minecraft.client.renderer.RenderItem.renderItemOverlays
   @use CyN net.lax1dude.eaglercraft.opengl.GlStateManager.enableBlend
   @use CTO net.lax1dude.eaglercraft.opengl.GlStateManager.disableBlend
   @use B$o net.lax1dude.eaglercraft.opengl.GlStateManager.tryBlendFuncSeparate
   @use D17 net.minecraft.client.renderer.texture.TextureManager.bindTexture
   @use FYs net.minecraft.client.gui.Gui.drawTexturedModalRect
   @use DlC net.minecraft.entity.player.EntityPlayer.getPrimaryHand
   @use CiU net.minecraft.util.EnumHandSide.opposite
   @use YZ net.minecraft.client.multiplayer.PlayerControllerMP.isSpectator
   @use Bvs net.minecraft.client.multiplayer.PlayerControllerMP.shouldDrawHUD
   @use CqZ net.minecraft.entity.Entity.getRidingEntity
   @use DBe net.minecraft.entity.Entity.isInsideOfMaterial
   @use CAB net.minecraft.client.renderer.texture.TextureAtlasSprite.getIconName
   @use Bq com.google.common.collect.Lists.newArrayList
   @use Y java.util.ArrayList.add
   @use EH java.util.ArrayList.size
   @use Bm java.util.ArrayList.get
   @new Bqh net.minecraft.client.resources.data.AnimationMetadataSection

   Virtual (prototype) methods it calls:
   @virtual eiX net.minecraft.client.gui.FontRenderer drawString
   @virtual yE net.minecraft.entity.player.EntityPlayer getItemStackFromSlot
   @virtual O * iterator
   @virtual B * hasNext
   @virtual z * next

   Static fields (checked against the owning class's static initializer):
   @static HHM net.minecraft.inventory.EntityEquipmentSlot HEAD
   @static HIj net.minecraft.inventory.EntityEquipmentSlot CHEST
   @static HJs net.minecraft.inventory.EntityEquipmentSlot LEGS
   @static HJt net.minecraft.inventory.EntityEquipmentSlot FEET
   @clinit Dt net.minecraft.inventory.EntityEquipmentSlot
   @static HJu net.minecraft.util.EnumHandSide LEFT
   @static Lo2 net.minecraft.client.gui.GuiIngame WIDGETS_TEX_PATH (textures/gui/widgets.png)
   @static HHk net.minecraft.item.ItemStack EMPTY
   @static HGM net.minecraft.block.material.Material WATER (the material getFOVModifier checks)
   @clinit BF net.minecraft.block.material.Material
   @class Co net.minecraft.entity.EntityLivingBase
   @static HFj net.minecraft.util.EnumHand MAIN_HAND
   @static Lkd net.minecraft.client.renderer.block.model.ItemCameraTransforms$TransformType FIRST_PERSON_LEFT_HAND
   @static Lke net.minecraft.client.renderer.block.model.ItemCameraTransforms$TransformType FIRST_PERSON_RIGHT_HAND

   Instance fields (checked against a method that reads them):
   @field dk net.minecraft.client.gui.GuiIngame.renderHotbarItem GuiIngame.mc
   @field nZ net.minecraft.client.gui.GuiIngame.renderGameOverlay Minecraft scaled resolution
   @field v net.minecraft.client.gui.GuiIngame.renderGameOverlay Minecraft.player
   @field G net.minecraft.client.gui.GuiIngame.renderHotbar Minecraft.gameSettings
   @field bCx net.minecraft.client.renderer.EntityRenderer.updateLightmap GameSettings.gammaSetting
   @field US net.minecraft.client.renderer.EntityRenderer.getFOVModifier EntityRenderer.fovModifierHand
   @field cQr net.minecraft.client.renderer.EntityRenderer.getFOVModifier EntityRenderer.fovModifierHandPrev
   @field b net.minecraft.entity.Entity.getPositionVector Entity.posX
   @field f net.minecraft.entity.Entity.getPositionVector Entity.posY
   @field c net.minecraft.entity.Entity.getPositionVector Entity.posZ
   @field C net.minecraft.entity.Entity.getHorizontalFacing Entity.rotationYaw
   @field b0l net.minecraft.client.gui.GuiIngame.renderHotbarItem GuiIngame.itemRenderer
   @field bH net.minecraft.client.gui.GuiIngame.renderHotbar Minecraft.renderEngine
   @field dz net.minecraft.client.gui.GuiIngame.renderHotbar Gui.zLevel
   @field dw net.minecraft.client.gui.GuiIngame.renderGameOverlay Minecraft.playerController
   @field o4 net.minecraft.client.gui.GuiIngame.renderHotbar GameSettings.attackIndicator
   @field jb net.minecraft.client.renderer.texture.TextureAtlasSprite.loadSprite ImageData.width
   @field lS net.minecraft.client.renderer.texture.TextureAtlasSprite.loadSprite ImageData.height
   @field bA2 net.minecraft.client.resources.data.AnimationMetadataSection.getFrameIndex AnimationMetadataSection.animationFrames
   @field cve net.minecraft.client.resources.data.AnimationMetadataSection.getFrameIndex AnimationFrame.frameIndex
   @field emZ net.minecraft.client.resources.data.AnimationMetadataSection.<init> frameWidth
   @field ee8 net.minecraft.client.resources.data.AnimationMetadataSection.<init> frameHeight
   @field bZY net.minecraft.client.resources.data.AnimationMetadataSection.<init> frameTime
   @field bXS net.minecraft.client.resources.data.AnimationMetadataSection.<init> interpolate
   @field ck_ net.minecraft.client.renderer.entity.RenderManager.doRenderEntity RenderManager.debugBoundingBox

   TeaVM runtime:
   @runtime $rt_globals x
   @runtime $rt_str x
   @runtime $rt_ustr x
   @runtime $rt_suspending x
   @runtime $rt_resuming x
   @runtime $rt_nativeThread x

   Suspension safety: compiled functions can suspend the TeaVM thread (texture/image loads,
   IndexedDB, sleep). Every wrapper here saves its own state on the thread stack exactly like
   compiled code does, so a suspended call resumes correctly instead of corrupting the stack.
=================================================================================================== */

/* ---------------------------------------------------------------------------------------------
   Integrated-server worker fix. In this build the worker's serverMain() creates the DataFixer
   before Bootstrap.register(); the fixer touches EntityChicken -> Items, and Items refuses to load
   before Bootstrap ("Accessed Items before Bootstrap!"), so every singleplayer world crashed on
   start. Vanilla registers Bootstrap first; this does the same. register() is idempotent, so it
   is harmless on builds that already do it. Runs only in the worker (no document there).
--------------------------------------------------------------------------------------------- */
(function(){
  var G=$rt_globals;
  if(!G||G.document)return;
  var origCreateFixer=G7V;
  G7V=function(){
    var st=1;
    if($rt_resuming())st=$rt_nativeThread().pop();
    if(st===1){
      Ff$();
      if($rt_suspending()){$rt_nativeThread().push(1);return null;}
    }
    var r=origCreateFixer();
    if($rt_suspending()){$rt_nativeThread().push(2);return null;}
    return r;
  };
})();

/* ---------------------------------------------------------------------------------------------
   Client
--------------------------------------------------------------------------------------------- */
(function(){
  var G=$rt_globals;
  var W=G.window||G;
  var D=W&&W.document;
  if(!W||!D)return;

  // ------------------------------------------------------------------
  // Settings
  // ------------------------------------------------------------------
  var KEY='thunderClientSettings_v6';
  var OLD_KEY='thunderClientSettings_v3';    // v4/v5 settings: on/off choices are imported once
  var GAMMA_KEY='thunderSavedGamma_v1';
  var DEFAULTS={
    armor:true,heldItem:true,coords:true,direction:true,speed:false,hunger:true,saturation:true,
    effects:true,sprintStatus:true,shield:true,clock:false,memory:false,
    fps:false,cps:false,keystrokes:false,
    noHurtCam:false,noFov:false,
    toggleSprint:false,noBob:false,
    blockF3:true,
    fullbright:false,
    fireOffset:0,
    shieldY:0,
    heldScale:1.0,heldText:true,heldX:0,heldY:0,
    armorX:0,armorY:0,armorWarn:true,
    shieldX:0,shieldGlow:true,
    // Hand Item Size: the real first-person items. 1.0 / 0 = vanilla.
    handItems:true,mainScale:1.0,mainY:0,offScale:1.0,offY:0,
    hitboxes:false,
    // Shaders (thunder-shaders.js). Off by default; strengths and intensity are percentages.
    // shPreset: 0 LOW, 1 MEDIUM, 2 HIGH, 3 CUSTOM. shBloomRes n = bloom at 1/2^n of the frame.
    shaders:false,shIntensity:80,shPreset:1,shAuto:true,shTargetFps:30,shPerf:false,
    shBloomRes:2,shBloomLevels:4,
    shBloom:true,shBloomStr:60,shGrade:true,shGradeStr:75,shContrast:true,shContrastStr:35,
    shVignette:true,shVignetteStr:40,shAmbient:true,shAmbientStr:50,shMotion:false,shMotionStr:35,
    shRays:true,shRaysStr:65,shAtmos:true,shAtmosStr:60
  };
  var S={},k;
  for(k in DEFAULTS)S[k]=DEFAULTS[k];
  function applySaved(saved,numbersToo){
    for(var id in saved){
      if(!Object.prototype.hasOwnProperty.call(DEFAULTS,id))continue;
      if(typeof DEFAULTS[id]==='number'){
        if(!numbersToo)continue;
        var nv=Number(saved[id]);
        if(isFinite(nv))S[id]=nv;
      }else if(typeof DEFAULTS[id]==='boolean')S[id]=!!saved[id];
    }
  }
  try{
    var saved=W.localStorage.getItem(KEY);
    if(saved)applySaved(JSON.parse(saved),true);
    else{
      // first run of v6: keep the old module on/off choices, but start every slider at its new
      // default (v4 silently saved Fire Height -0.35 and its sliders had different meanings)
      var old=W.localStorage.getItem(OLD_KEY);
      if(old)applySaved(JSON.parse(old),false);
    }
  }catch(_){}
  // only values that differ from the defaults are stored, so settings you never touched follow
  // future default changes
  function save(){
    var out={};
    for(var id in DEFAULTS)if(S[id]!==DEFAULTS[id])out[id]=S[id];
    try{W.localStorage.setItem(KEY,JSON.stringify(out));}catch(_){}
  }

  // Menu layout. A module with an id has an on/off switch; opts are its settings (a number
  // setting becomes a slider, a boolean one a switch). Every entry maps to a setting that the
  // HUD/hooks below actually read.
  function fmtPx(v){v=Math.round(v);return v===0?'default':(v>0?'+':'')+v+' px';}
  function fmtUp(v){v=Math.round(v);return v===0?'default':(-v)+' px up';}
  function fmtScale(v){return v.toFixed(2)+'x';}
  function fmtHand(v){return Math.abs(v-1)<0.001?'vanilla':Math.round(v*100)+'%';}
  function fmtLift(v){return Math.abs(v)<0.001?'vanilla':(v>0?'+':'')+v.toFixed(2);}
  function fmtFire(v){return Math.abs(v)<0.001?'vanilla':(v>0?'+':'')+v.toFixed(2);}
  var CATEGORIES=[
    {id:'hud',name:'HUD'},
    {id:'combat',name:'Combat'},
    {id:'movement',name:'Movement'},
    {id:'visual',name:'Visual'},
    {id:'utility',name:'Utility'}
  ];
  var MODULES=[
    {cat:'hud',id:'armor',name:'Armor HUD',desc:'Worn armor as item icons with vanilla durability bars, beside the off-hand slot.',opts:[
      {id:'armorWarn',name:'Low durability pulse'},
      {id:'armorX',name:'Horizontal position',min:-120,max:120,step:1,fmt:fmtPx},
      {id:'armorY',name:'Height',min:-120,max:0,step:1,fmt:fmtUp,invert:true}]},
    {cat:'hud',id:'shield',name:'Shield Slot',desc:'Off-hand / shield slot icon you can move. Glows while you block. (In-hand shield size: Visual > Hand Item Size.)',opts:[
      {id:'shieldGlow',name:'Blocking glow'},
      {id:'shieldY',name:'Height',min:-100,max:0,step:1,fmt:fmtUp,invert:true},
      {id:'shieldX',name:'Horizontal position',min:-150,max:150,step:1,fmt:fmtPx}]},
    {cat:'hud',id:'heldItem',name:'Held Item',desc:'Held item icon with its durability bar, beside the hotbar. (In-hand sword size: Visual > Hand Item Size.)',opts:[
      {id:'heldScale',name:'Icon size',min:0.5,max:2,step:0.05,fmt:fmtScale},
      {id:'heldText',name:'Name and durability'},
      {id:'heldX',name:'Horizontal position',min:-150,max:150,step:1,fmt:fmtPx},
      {id:'heldY',name:'Height',min:-120,max:0,step:1,fmt:fmtUp,invert:true}]},
    {cat:'hud',id:'saturation',name:'Saturation',desc:'Gold saturation bar just above the hunger icons.'},
    {cat:'hud',id:'effects',name:'Potion Effects',desc:'Active effects and time left, top right.'},
    {cat:'hud',id:'coords',name:'Coordinates',desc:'Your XYZ position.'},
    {cat:'hud',id:'direction',name:'Direction',desc:'Facing direction and axis.'},
    {cat:'hud',id:'speed',name:'Speed',desc:'Horizontal speed in blocks per second.'},
    {cat:'hud',id:'hunger',name:'Food Level',desc:'Food points as text.'},
    {cat:'hud',id:'sprintStatus',name:'Sprint Status',desc:'Shows whether you are sprinting.'},
    {cat:'hud',id:'fps',name:'FPS',desc:'Frames per second.'},
    {cat:'hud',id:'cps',name:'CPS',desc:'Left clicks per second.'},
    {cat:'hud',id:'keystrokes',name:'Keystrokes',desc:'WASD and mouse buttons.'},
    {cat:'hud',id:'clock',name:'Clock',desc:'Real-world time.'},
    {cat:'hud',id:'memory',name:'Memory',desc:'JavaScript memory in use.'},
    {cat:'combat',id:'noHurtCam',name:'No Hurt Camera',desc:'Removes the camera shake when you take damage.'},
    {cat:'combat',id:'noFov',name:'No FOV Change',desc:'Keeps FOV fixed while sprinting, with Speed or a bow.'},
    {cat:'movement',id:'toggleSprint',name:'Toggle Sprint',desc:'Sprints automatically while moving forward.'},
    {cat:'movement',id:'noBob',name:'No View Bobbing',desc:'Removes the walking camera bob.'},
    {cat:'visual',id:'handItems',name:'Hand Item Size',desc:'Resizes the real sword, tools, blocks and shield you hold in first person. 100% is vanilla.',opts:[
      {id:'mainScale',name:'Main hand (sword) size',min:0.3,max:1.5,step:0.05,fmt:fmtHand},
      {id:'mainY',name:'Main hand height',min:-0.5,max:0.3,step:0.02,fmt:fmtLift},
      {id:'offScale',name:'Off hand (shield) size',min:0.3,max:1.5,step:0.05,fmt:fmtHand},
      {id:'offY',name:'Off hand (shield) height',min:-0.5,max:0.3,step:0.02,fmt:fmtLift}]},
    {cat:'visual',id:'hitboxes',name:'Hitboxes',desc:'Shows entity hitboxes like F3+B: white box, red eye line, blue look direction.'},
    {cat:'visual',id:null,name:'Fire Height',desc:'Moves the first-person fire overlay. 0 is vanilla, negative is lower.',opts:[
      {id:'fireOffset',name:'Offset',min:-0.55,max:0.45,step:0.05,fmt:fmtFire}]},
    {cat:'visual',id:'fullbright',name:'Fullbright',desc:'Maximum brightness everywhere.'},
    {cat:'utility',id:'blockF3',name:'Block F3 Screen',desc:'Stops the built-in F3 debug screen from opening.'},
    {cat:'utility',id:null,special:'packs',name:'Resource Pack Check',desc:'Animated textures this session had to repair because a pack was missing or had broken .mcmeta files.'}
  ];

  // ------------------------------------------------------------------
  // Input tracking
  // ------------------------------------------------------------------
  var keyState={};
  var mouseState={};
  var clicks=[];
  var menuOpen=false;
  var seenLock=false;
  var TC={settings:S,defaults:DEFAULTS,lastError:null,
    isMenuOpen:function(){return menuOpen;}};
  W.ThunderClient=TC;

  function now(){return W.performance?W.performance.now():Date.now();}
  function locked(){return !seenLock||!!D.pointerLockElement;}
  function kill(e){e.preventDefault();e.stopImmediatePropagation();}

  function onKeyDown(e){
    try{
      var code=e&&e.code;
      if(code)keyState[code]=true;
      if(S.blockF3&&(code==='F3'||e.key==='F3')){kill(e);return;}
      if(code==='ShiftRight'||(e.key==='Shift'&&e.location===2)){
        kill(e);
        if(!e.repeat)toggleMenu();
        return;
      }
      if(menuOpen){
        if(code==='Escape'){kill(e);hideMenu();return;}
        var tg=e&&e.target,tn=tg&&tg.tagName;
        if(tn==='INPUT'||tn==='TEXTAREA'||tn==='SELECT')return;
        if(!e.ctrlKey&&!e.metaKey&&!e.altKey&&!/^F\d+$/.test(code||''))kill(e);
      }
    }catch(_){}
  }
  function onKeyUp(e){
    try{
      var code=e&&e.code;
      if(code)keyState[code]=false;
      if(S.blockF3&&(code==='F3'||e.key==='F3')){kill(e);return;}
      if(code==='ShiftRight'||(e.key==='Shift'&&e.location===2))kill(e);
    }catch(_){}
  }
  function isGameTarget(e){var t=e&&e.target;return !!t&&t.tagName==='CANVAS';}
  if(W.addEventListener){
    W.addEventListener('keydown',onKeyDown,true);
    W.addEventListener('keyup',onKeyUp,true);
    W.addEventListener('blur',function(){keyState={};mouseState={};},true);
    W.addEventListener('mousedown',function(e){
      if(menuOpen||!isGameTarget(e))return;
      mouseState[e.button]=true;
      if(e.button===0)clicks.push(Date.now());
    },true);
    W.addEventListener('mouseup',function(e){mouseState[e.button]=false;},true);
  }
  if(D.addEventListener){
    D.addEventListener('pointerlockchange',function(){if(D.pointerLockElement)seenLock=true;});
  }

  // FPS counter
  var fpsFrames=0,fpsValue=0,fpsLast=now();
  function markFrame(){
    fpsFrames++;
    var t=now();
    if(t-fpsLast>=500){fpsValue=Math.round(fpsFrames*1000/(t-fpsLast));fpsFrames=0;fpsLast=t;}
  }
  if(W.requestAnimationFrame){
    var tick=function(){markFrame();W.requestAnimationFrame(tick);};
    W.requestAnimationFrame(tick);
  }
  function trimClicks(){
    var t=Date.now();
    while(clicks.length&&t-clicks[0]>1000)clicks.shift();
  }

  // ------------------------------------------------------------------
  // Menu (Right Shift): compact dark panel, category sidebar, module cards with switches,
  // expandable settings and sliders. Plain DOM + one stylesheet; nothing here touches the game.
  // ------------------------------------------------------------------
  var ICONS={
    bolt:'<path d="M13 2 4.5 13.5H11L10 22l8.5-11.5H12z" fill="currentColor" stroke="none"/>',
    hud:'<rect x="3" y="4" width="18" height="16" rx="2.5"/><path d="M3 15h18M9 15v5"/>',
    combat:'<path d="M20 4v5L9.5 19.5l-5-5L15 4z"/><path d="M6.5 13.5l4 4M4.5 19.5 3 21"/>',
    movement:'<path d="M4 12h13M12 6l6 6-6 6"/><path d="M4 7h4M4 17h4"/>',
    visual:'<path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
    utility:'<path d="M14.7 6.3a4 4 0 0 0-5.4 5.4L3 18l3 3 6.3-6.3a4 4 0 0 0 5.4-5.4l-2.6 2.6-2.4-.6-.6-2.4z"/>',
    search:'<circle cx="11" cy="11" r="7"/><path d="M20 20l-3.6-3.6"/>',
    chevron:'<path d="M6 9l6 6 6-6"/>',
    reset:'<path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5"/>'
  };
  function svg(name,size){
    return '<svg viewBox="0 0 24 24" width="'+(size||16)+'" height="'+(size||16)+'" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'+ICONS[name]+'</svg>';
  }
  var CSS=[
    '#thunder-client-menu{position:fixed;inset:0;z-index:2147483646;display:none;align-items:center;justify-content:center;',
      'background:radial-gradient(ellipse at 50% 40%,rgba(6,14,24,.55),rgba(1,4,9,.82));font:13px/1.4 system-ui,-apple-system,"Segoe UI",Roboto,Arial,sans-serif;',
      'color:#e4f3ff;user-select:none;-webkit-user-select:none;opacity:0;transition:opacity .12s ease}',
    '#thunder-client-menu.tcm-open{opacity:1}',
    '#thunder-client-menu *{box-sizing:border-box}',
    '.tcm-panel{display:flex;width:min(780px,calc(100vw - 24px));height:min(500px,calc(100vh - 24px));border-radius:14px;overflow:hidden;',
      'background:linear-gradient(180deg,rgba(14,21,32,.97),rgba(9,14,22,.98));border:1px solid rgba(79,209,255,.28);',
      'box-shadow:0 20px 70px rgba(0,0,0,.7),0 0 0 1px rgba(0,0,0,.4),0 0 40px rgba(79,209,255,.10);transform:scale(.985);transition:transform .12s ease}',
    '#thunder-client-menu.tcm-open .tcm-panel{transform:none}',
    '.tcm-side{flex:0 0 176px;display:flex;flex-direction:column;background:rgba(5,9,15,.55);border-right:1px solid rgba(79,209,255,.10);padding:16px 10px}',
    '.tcm-brand{display:flex;align-items:center;gap:9px;padding:2px 8px 16px}',
    '.tcm-logo{width:30px;height:30px;border-radius:9px;display:grid;place-items:center;color:#061019;',
      'background:linear-gradient(135deg,#8cecff,#3fb6ff 55%,#2a6cff);box-shadow:0 0 18px rgba(79,209,255,.45)}',
    '.tcm-brand b{display:block;font-size:13px;letter-spacing:.2em;color:#f1faff}',
    '.tcm-brand small{display:block;font-size:10px;letter-spacing:.24em;color:#5fb9e6}',
    '.tcm-tab{display:flex;align-items:center;gap:10px;width:100%;padding:9px 10px;margin:2px 0;border:0;border-radius:9px;background:transparent;',
      'color:#90a8bb;font:inherit;font-weight:600;cursor:pointer;text-align:left;position:relative;transition:background .12s,color .12s}',
    '.tcm-tab:hover{background:rgba(79,209,255,.07);color:#d9f2ff}',
    '.tcm-tab.tcm-on{background:linear-gradient(90deg,rgba(79,209,255,.16),rgba(79,209,255,.03));color:#f0fbff}',
    '.tcm-tab.tcm-on:before{content:"";position:absolute;left:0;top:8px;bottom:8px;width:3px;border-radius:3px;background:#4fd1ff;box-shadow:0 0 10px #4fd1ff}',
    '.tcm-tab .tcm-count{margin-left:auto;font-size:10px;color:#5d7487;font-weight:600}',
    '.tcm-tab.tcm-on .tcm-count{color:#7fdcff}',
    '.tcm-side-foot{margin-top:auto;padding:10px 8px 0;font-size:10.5px;color:#5d7487;line-height:1.6}',
    '.tcm-kbd{display:inline-block;padding:1px 6px;border-radius:5px;border:1px solid rgba(127,151,170,.35);color:#a9c2d4;font-size:10px;margin-right:4px}',
    '.tcm-main{flex:1;display:flex;flex-direction:column;min-width:0}',
    '.tcm-head{display:flex;align-items:center;gap:12px;padding:16px 18px 12px}',
    '.tcm-head h2{margin:0;font-size:17px;font-weight:700;letter-spacing:.02em;color:#f3fbff;white-space:nowrap}',
    '.tcm-search{margin-left:auto;display:flex;align-items:center;gap:7px;width:min(240px,48%);height:32px;padding:0 10px;border-radius:9px;',
      'background:rgba(3,7,12,.6);border:1px solid rgba(110,140,160,.28);color:#6f889b;transition:border-color .12s,box-shadow .12s}',
    '.tcm-search:focus-within{border-color:rgba(79,209,255,.65);box-shadow:0 0 0 3px rgba(79,209,255,.12)}',
    '.tcm-search input{flex:1;min-width:0;border:0;outline:0;background:transparent;color:#e8f6ff;font:inherit}',
    '.tcm-search input::placeholder{color:#5c7385}',
    '.tcm-list{flex:1;overflow-y:auto;padding:2px 18px 16px;display:grid;grid-template-columns:repeat(auto-fill,minmax(240px,1fr));gap:10px;align-content:start;align-items:start;',
      'scrollbar-width:thin;scrollbar-color:#2c4556 transparent}',
    '.tcm-list::-webkit-scrollbar{width:8px}.tcm-list::-webkit-scrollbar-thumb{background:#2c4556;border-radius:8px}',
    '.tcm-card{border-radius:11px;background:rgba(19,28,41,.9);border:1px solid rgba(120,150,175,.13);transition:border-color .12s,background .12s,box-shadow .12s}',
    '.tcm-card:hover{background:rgba(23,34,49,.95);border-color:rgba(79,209,255,.28)}',
    '.tcm-card.tcm-active{border-color:rgba(79,209,255,.42);box-shadow:inset 0 0 0 1px rgba(79,209,255,.06),0 0 16px rgba(79,209,255,.07)}',
    '.tcm-card-top{display:flex;align-items:center;gap:10px;padding:11px 12px;cursor:pointer}',
    '.tcm-card-top.tcm-static{cursor:default}',
    '.tcm-card-text{flex:1;min-width:0}',
    '.tcm-card-name{font-weight:650;font-size:13px;color:#eef8ff;display:flex;align-items:center;gap:6px}',
    '.tcm-cat{font-size:9.5px;font-weight:700;letter-spacing:.08em;color:#5fb9e6;text-transform:uppercase}',
    '.tcm-card-desc{font-size:11px;color:#7c95a8;margin-top:2px}',
    '.tcm-more{width:26px;height:26px;display:grid;place-items:center;border:0;border-radius:7px;background:transparent;color:#7c95a8;cursor:pointer;transition:background .12s,color .12s,transform .15s}',
    '.tcm-more:hover{background:rgba(79,209,255,.1);color:#bfeaff}',
    '.tcm-card.tcm-open-opts .tcm-more{transform:rotate(180deg);color:#7fdcff}',
    '.tcm-switch{position:relative;flex:0 0 34px;width:34px;height:19px;border-radius:19px;border:0;padding:0;cursor:pointer;',
      'background:#233142;box-shadow:inset 0 0 0 1px rgba(255,255,255,.04);transition:background .15s,box-shadow .15s}',
    '.tcm-switch:after{content:"";position:absolute;top:2px;left:2px;width:15px;height:15px;border-radius:50%;background:#8aa1b3;transition:transform .15s,background .15s}',
    '.tcm-switch.tcm-on{background:linear-gradient(90deg,#2fa9ff,#4fd1ff);box-shadow:0 0 12px rgba(79,209,255,.45)}',
    '.tcm-switch.tcm-on:after{transform:translateX(15px);background:#fff}',
    '.tcm-opts{display:none;padding:2px 12px 12px;border-top:1px solid rgba(120,150,175,.10)}',
    '.tcm-card.tcm-open-opts .tcm-opts,.tcm-card.tcm-always .tcm-opts{display:block}',
    '.tcm-card.tcm-always .tcm-opts{border-top:0;padding-top:0}',
    '.tcm-row{display:flex;align-items:center;gap:10px;margin-top:10px;font-size:12px;color:#b7cad8}',
    '.tcm-row span{flex:1}',
    '.tcm-row em{font-style:normal;font-size:11px;font-weight:700;color:#7fdcff;min-width:62px;text-align:right}',
    '.tcm-slider{display:block;width:100%;margin-top:6px}',
    '.tcm-range{-webkit-appearance:none;appearance:none;width:100%;height:4px;border-radius:4px;outline:0;cursor:pointer;',
      'background:linear-gradient(90deg,#4fd1ff var(--p,0%),#243345 var(--p,0%))}',
    '.tcm-range::-webkit-slider-thumb{-webkit-appearance:none;width:14px;height:14px;border-radius:50%;background:#eaf9ff;border:2px solid #4fd1ff;box-shadow:0 0 10px rgba(79,209,255,.6)}',
    '.tcm-range::-moz-range-thumb{width:12px;height:12px;border-radius:50%;background:#eaf9ff;border:2px solid #4fd1ff;box-shadow:0 0 10px rgba(79,209,255,.6)}',
    '.tcm-reset-one{border:0;background:transparent;color:#5d7487;cursor:pointer;padding:2px;display:grid;place-items:center;border-radius:5px}',
    '.tcm-reset-one:hover{color:#bfeaff;background:rgba(79,209,255,.1)}',
    '.tcm-foot{display:flex;align-items:center;gap:10px;padding:10px 18px 12px;border-top:1px solid rgba(79,209,255,.08);font-size:11px;color:#6c8497}',
    '.tcm-btn{margin-left:auto;display:flex;align-items:center;gap:6px;border:1px solid rgba(120,150,175,.28);background:rgba(14,22,33,.9);color:#cfe6f5;',
      'font:inherit;font-weight:600;padding:6px 11px;border-radius:8px;cursor:pointer;transition:border-color .12s,background .12s}',
    '.tcm-btn:hover{border-color:rgba(79,209,255,.5);background:rgba(20,32,46,.95)}',
    '.tcm-btn.tcm-danger{border-color:rgba(255,120,120,.5);color:#ffb3b3}',
    '.tcm-empty{grid-column:1/-1;text-align:center;color:#61798c;padding:40px 0}',
    '.tcm-note{font-size:11.5px;color:#9db4c6;margin-top:8px;line-height:1.5}',
    '.tcm-note code{color:#bfe9ff;font-size:11px}',
    '.tcm-note a{color:#7fdcff}',
    '.tcm-card.tcm-wide{grid-column:1/-1}',
    '.tcm-btn:active,.tcm-seg button:active,.tcm-tab:active,.tcm-more:active{transform:translateY(1px)}',
    '.tcm-switch:active:after{width:18px}.tcm-switch.tcm-on:active:after{transform:translateX(12px)}',
    '.tcm-seg{display:flex;gap:3px;margin-top:7px;padding:3px;border-radius:9px;background:rgba(3,7,12,.6);border:1px solid rgba(110,140,160,.22)}',
    '.tcm-seg button{flex:1;min-width:0;border:0;border-radius:6px;padding:6px 0;background:transparent;color:#8ea6b9;font:inherit;font-size:10.5px;',
      'font-weight:700;letter-spacing:.07em;cursor:pointer;transition:background .12s,color .12s,box-shadow .12s}',
    '.tcm-seg button:hover{color:#e1f5ff;background:rgba(79,209,255,.09)}',
    '.tcm-seg button.tcm-on{color:#f3fbff;background:linear-gradient(180deg,rgba(79,209,255,.30),rgba(47,140,255,.16));',
      'box-shadow:inset 0 0 0 1px rgba(79,209,255,.5),0 0 12px rgba(79,209,255,.22)}',
    '.tcm-status{display:flex;align-items:center;gap:8px;margin-top:10px;padding:7px 10px;border-radius:8px;background:rgba(3,7,12,.5);',
      'border:1px solid rgba(110,140,160,.14);font-size:11.5px;color:#a9c0d2;min-height:32px}',
    '.tcm-status b{color:#e9f7ff;font-weight:650}',
    '.tcm-dot{flex:0 0 8px;width:8px;height:8px;border-radius:50%;background:#4a5a68}',
    '.tcm-dot.tcm-ok{background:#4fd1ff;box-shadow:0 0 8px #4fd1ff}',
    '.tcm-dot.tcm-warn{background:#ffc35c;box-shadow:0 0 8px rgba(255,195,92,.7)}',
    '.tcm-dot.tcm-bad{background:#ff6b6b;box-shadow:0 0 8px rgba(255,107,107,.6)}',
    '.tcm-actions{display:flex;justify-content:flex-end;gap:8px;margin-top:12px}',
    '.tcm-actions .tcm-btn{margin-left:0}',
    '.tcm-kv{display:grid;grid-template-columns:auto 1fr;gap:3px 12px;margin-top:10px;font-size:11px;color:#7f98ab}',
    '.tcm-kv b{color:#cfe8f8;font-weight:600;text-align:right;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
    '.tcm-sub{margin-top:12px;font-size:10px;font-weight:700;letter-spacing:.12em;color:#5fb9e6;text-transform:uppercase}',
    '@media (max-width:640px){.tcm-side{flex-basis:58px;padding:14px 7px}.tcm-brand{justify-content:center;padding:2px 0 14px}',
      '.tcm-brand>div:not(.tcm-logo),.tcm-tab .tcm-label,.tcm-tab .tcm-count,.tcm-side-foot{display:none}.tcm-tab{justify-content:center;padding:10px 0}',
      '.tcm-head{flex-wrap:wrap}.tcm-search{width:100%}}',
    '@media (prefers-reduced-motion:reduce){#thunder-client-menu,#thunder-client-menu *{transition:none!important}}'
  ].join('');

  var backdrop=null,listEl=null,titleEl=null,searchInput=null,footInfo=null,resetBtn=null;
  var currentCat='hud',searchQuery='',openOpts={},resetArmed=0;
  // liveFns refresh status text while the menu is open; painters[id] redraw the controls of
  // setting id after it changes elsewhere (a preset button moving the custom sliders)
  var liveFns=[],painters={},liveTimer=0;
  function addLive(fn){liveFns.push(fn);try{fn();}catch(_){}}
  function addPainter(id,fn){(painters[id]||(painters[id]=[])).push(fn);}
  function repaint(id){(painters[id]||[]).forEach(function(fn){try{fn();}catch(_){}});}
  function runLive(){for(var i=0;i<liveFns.length;i++){try{liveFns[i]();}catch(_){}}}

  function toggleMenu(){if(menuOpen)hideMenu();else showMenu();}
  function hideMenu(){
    menuOpen=false;
    if(liveTimer){W.clearInterval(liveTimer);liveTimer=0;}
    if(!backdrop)return;
    backdrop.classList.remove('tcm-open');
    W.setTimeout(function(){if(!menuOpen)backdrop.style.display='none';},130);
  }
  function showMenu(){
    if(!backdrop)buildMenu();
    menuOpen=true;
    resetArmed=0;
    render();
    backdrop.style.display='flex';
    if(!liveTimer)liveTimer=W.setInterval(runLive,400);
    W.requestAnimationFrame(function(){if(menuOpen)backdrop.classList.add('tcm-open');});
    try{if(D.exitPointerLock&&D.pointerLockElement)D.exitPointerLock();}catch(_){}
  }
  function el(tag,cls,text){
    var n=D.createElement(tag);
    if(cls)n.className=cls;
    if(text!==undefined)n.textContent=text;
    return n;
  }
  function iconEl(tag,cls,name,size){var n=el(tag,cls);n.innerHTML=svg(name,size);return n;}

  function buildMenu(){
    if(!D.getElementById('thunder-client-menu-style')){
      var st=D.createElement('style');st.id='thunder-client-menu-style';st.textContent=CSS;
      (D.head||D.documentElement).appendChild(st);
    }
    backdrop=el('div');backdrop.id='thunder-client-menu';
    backdrop.addEventListener('mousedown',function(e){if(e.target===backdrop)hideMenu();});
    backdrop.addEventListener('contextmenu',function(e){e.preventDefault();});
    var panel=el('div','tcm-panel');

    var side=el('aside','tcm-side');
    var brand=el('div','tcm-brand');
    brand.appendChild(iconEl('div','tcm-logo','bolt',18));
    var bt=el('div');bt.appendChild(el('b',null,'THUNDER'));bt.appendChild(el('small',null,'CLIENT'));
    brand.appendChild(bt);
    side.appendChild(brand);
    var tabs=el('nav');tabs.id='tcm-tabs';
    CATEGORIES.forEach(function(c){
      var b=el('button','tcm-tab');b.type='button';b.setAttribute('data-cat',c.id);
      b.innerHTML=svg(c.id,16);
      b.appendChild(el('span','tcm-label',c.name));
      b.appendChild(el('span','tcm-count',''));
      b.addEventListener('click',function(){currentCat=c.id;searchQuery='';searchInput.value='';render();});
      tabs.appendChild(b);
    });
    side.appendChild(tabs);
    var sf=el('div','tcm-side-foot');
    sf.appendChild(el('span','tcm-kbd','R-Shift'));sf.appendChild(D.createTextNode('open / close'));
    sf.appendChild(el('br'));
    sf.appendChild(el('span','tcm-kbd','Esc'));sf.appendChild(D.createTextNode('close'));
    side.appendChild(sf);
    panel.appendChild(side);

    var main=el('section','tcm-main');
    var head=el('div','tcm-head');
    titleEl=el('h2',null,'HUD');
    head.appendChild(titleEl);
    var search=iconEl('label','tcm-search','search',14);
    searchInput=el('input');searchInput.type='text';searchInput.placeholder='Search modules';searchInput.spellcheck=false;
    searchInput.addEventListener('input',function(){searchQuery=String(searchInput.value||'').trim().toLowerCase();render();});
    search.appendChild(searchInput);
    head.appendChild(search);
    main.appendChild(head);
    listEl=el('div','tcm-list');
    main.appendChild(listEl);
    var foot=el('div','tcm-foot');
    footInfo=el('span');
    foot.appendChild(footInfo);
    resetBtn=el('button','tcm-btn');resetBtn.type='button';
    resetBtn.addEventListener('click',function(){
      if(!resetArmed){resetArmed=1;paintReset();return;}
      resetArmed=0;
      for(var id in DEFAULTS)S[id]=DEFAULTS[id];
      save();render();
    });
    foot.appendChild(resetBtn);
    main.appendChild(foot);
    panel.appendChild(main);
    backdrop.appendChild(panel);
    (D.body||D.documentElement).appendChild(backdrop);
  }
  function paintReset(){
    resetBtn.className='tcm-btn'+(resetArmed?' tcm-danger':'');
    resetBtn.innerHTML=svg('reset',13);
    resetBtn.appendChild(D.createTextNode(resetArmed?'Click again to reset everything':'Reset all'));
  }
  function moduleMatches(m,q){
    if(!q)return true;
    var hay=(m.name+' '+m.desc+' '+(m.opts||[]).map(function(o){return o.name;}).join(' ')).toLowerCase();
    return hay.indexOf(q)>=0;
  }
  function render(){
    if(!backdrop)return;
    var q=searchQuery,shown=MODULES.filter(function(m){return q?moduleMatches(m,q):m.cat===currentCat;});
    var cat=CATEGORIES.filter(function(c){return c.id===currentCat;})[0];
    titleEl.textContent=q?'Search':cat.name;
    var tabs=D.getElementById('tcm-tabs').children;
    for(var i=0;i<tabs.length;i++){
      var id=tabs[i].getAttribute('data-cat');
      tabs[i].className='tcm-tab'+(!q&&id===currentCat?' tcm-on':'');
      var on=0,all=0;
      MODULES.forEach(function(m){if(m.cat===id&&m.id){all++;if(S[m.id])on++;}});
      tabs[i].lastChild.textContent=all?on+'/'+all:'';
    }
    while(listEl.firstChild)listEl.removeChild(listEl.firstChild);
    liveFns=[];painters={};
    shown.forEach(function(m){listEl.appendChild(card(m,!!q));});
    if(!shown.length)listEl.appendChild(el('div','tcm-empty','No module matches "'+searchQuery+'".'));
    var total=0,enabled=0;
    MODULES.forEach(function(m){if(m.id){total++;if(S[m.id])enabled++;}});
    footInfo.textContent=enabled+' of '+total+' modules on \u2022 changes save instantly';
    paintReset();
  }
  function card(m,showCat){
    var c=el('div','tcm-card'+(m.wide?' tcm-wide':''));
    var key=m.id||m.name;
    var hasOpts=!!(m.opts&&m.opts.length)||!!m.special;
    if(!m.id||m.always)c.className+=' tcm-always';
    else if(openOpts[key])c.className+=' tcm-open-opts';
    if(m.id&&S[m.id])c.className+=' tcm-active';
    var top=el('div','tcm-card-top'+(m.id?'':' tcm-static'));
    var txt=el('div','tcm-card-text');
    var nm=el('div','tcm-card-name',m.name);
    if(showCat)nm.appendChild(el('span','tcm-cat',m.cat));
    txt.appendChild(nm);
    txt.appendChild(el('div','tcm-card-desc',m.desc));
    top.appendChild(txt);
    if(m.id&&hasOpts&&!m.always){
      var more=iconEl('button','tcm-more','chevron',15);more.type='button';more.title='Settings';
      more.addEventListener('click',function(e){
        e.stopPropagation();
        openOpts[key]=!openOpts[key];
        c.className=c.className.replace(/ ?tcm-open-opts/g,'')+(openOpts[key]?' tcm-open-opts':'');
      });
      top.appendChild(more);
    }
    if(m.id){
      var sw=el('button','tcm-switch'+(S[m.id]?' tcm-on':''));sw.type='button';sw.setAttribute('aria-label',m.name);
      top.appendChild(sw);
      top.addEventListener('click',function(){
        S[m.id]=!S[m.id];save();
        sw.className='tcm-switch'+(S[m.id]?' tcm-on':'');
        c.className=c.className.replace(/ ?tcm-active/g,'')+(S[m.id]?' tcm-active':'');
        if(m.onChange)m.onChange(S[m.id]);
        render();
      });
    }
    c.appendChild(top);
    if(hasOpts){
      var box=el('div','tcm-opts');
      if(m.special&&SPECIALS[m.special])SPECIALS[m.special](box,m);
      (m.opts||[]).forEach(function(o){box.appendChild(optRow(o));});
      c.appendChild(box);
    }
    return c;
  }
  // one settings row: choices -> segmented buttons, number -> slider, boolean -> switch
  function optRow(o){
    if(o.choices)return segRow(o);
    return typeof DEFAULTS[o.id]==='number'?sliderRow(o):switchRow(o);
  }
  function segRow(o){
    var wrap=el('div');
    var r=el('div','tcm-row');
    r.appendChild(el('span',null,o.name));
    wrap.appendChild(r);
    var seg=el('div','tcm-seg'),btns=[];
    o.choices.forEach(function(label,i){
      var b=el('button',null,label);b.type='button';
      b.addEventListener('click',function(){S[o.id]=i;save();paint();if(o.onChange)o.onChange(i);});
      seg.appendChild(b);btns.push(b);
    });
    function paint(){var v=S[o.id]|0;for(var i=0;i<btns.length;i++)btns[i].className=i===v?'tcm-on':'';}
    paint();addPainter(o.id,paint);
    wrap.appendChild(seg);
    return wrap;
  }
  // a button that asks for a second click before it acts (used for resets)
  function confirmButton(label,armedLabel,action){
    var armed=0,b=el('button','tcm-btn');b.type='button';
    function paint(){b.className='tcm-btn'+(armed?' tcm-danger':'');b.innerHTML=svg('reset',13);b.appendChild(D.createTextNode(armed?armedLabel:label));}
    b.addEventListener('click',function(){if(!armed){armed=1;paint();return;}armed=0;paint();action();});
    b.addEventListener('mouseleave',function(){if(armed){armed=0;paint();}});
    paint();
    return b;
  }
  function switchRow(o){
    var r=el('div','tcm-row');
    r.appendChild(el('span',null,o.name));
    var sw=el('button','tcm-switch'+(S[o.id]?' tcm-on':''));sw.type='button';sw.setAttribute('aria-label',o.name);
    function paint(){sw.className='tcm-switch'+(S[o.id]?' tcm-on':'');}
    sw.addEventListener('click',function(){S[o.id]=!S[o.id];save();paint();if(o.onChange)o.onChange(S[o.id]);});
    addPainter(o.id,paint);
    r.appendChild(sw);
    if(o.hint){var w=el('div');w.appendChild(r);w.appendChild(el('div','tcm-card-desc',o.hint));return w;}
    return r;
  }
  function sliderRow(o){
    var wrap=el('div');
    var r=el('div','tcm-row');
    r.appendChild(el('span',null,o.name));
    var val=el('em',null,'');
    r.appendChild(val);
    var rs=iconEl('button','tcm-reset-one','reset',12);rs.type='button';rs.title='Reset to default';
    r.appendChild(rs);
    wrap.appendChild(r);
    var lab=el('label','tcm-slider');
    // invert: the slider shows -value, so dragging right moves an element up (Height sliders)
    var sign=o.invert?-1:1,lo=o.invert?-o.max:o.min,hi=o.invert?-o.min:o.max;
    var range=el('input','tcm-range');range.type='range';
    range.min=String(lo);range.max=String(hi);range.step=String(o.step);
    lab.appendChild(range);
    wrap.appendChild(lab);
    function paint(v){
      val.textContent=o.fmt(v);
      range.value=String(sign*v);
      range.style.setProperty('--p',((sign*v-lo)*100/(hi-lo)).toFixed(1)+'%');
    }
    paint(clamp(Number(S[o.id]),o.min,o.max));
    addPainter(o.id,function(){paint(clamp(Number(S[o.id]),o.min,o.max));});
    range.addEventListener('input',function(){var v=sign*parseFloat(range.value);S[o.id]=v;paint(v);save();if(o.onChange)o.onChange(v);});
    rs.addEventListener('click',function(){S[o.id]=DEFAULTS[o.id];paint(DEFAULTS[o.id]);save();if(o.onChange)o.onChange(S[o.id]);});
    return wrap;
  }
  function packsNote(box){
    var fixes=TC.textureFixes||[];
    var n=el('div','tcm-note');
    if(!fixes.length){
      n.textContent='No broken animated textures were found in your active resource packs this session.';
    }else{
      n.appendChild(D.createTextNode('Repaired while loading ('+fixes.length+'): '));
      fixes.slice(0,6).forEach(function(f,i){
        if(i)n.appendChild(D.createTextNode(', '));
        n.appendChild(el('code',null,String(f).split(':')[0].replace(/^minecraft:/,'')));
      });
      if(fixes.length>6)n.appendChild(D.createTextNode(' and '+(fixes.length-6)+' more'));
      n.appendChild(D.createTextNode('. They render correctly in Thunder; to fix the pack itself for other clients, run it through the '));
      var a=el('a',null,'Pack Doctor');a.href='thunder-pack-doctor.html';a.target='_blank';a.rel='noopener';
      n.appendChild(a);
      n.appendChild(D.createTextNode('.'));
    }
    box.appendChild(n);
  }
  var SPECIALS={packs:packsNote};   // m.special -> function(box,m) that fills a card body
  TC.openMenu=showMenu;TC.closeMenu=hideMenu;TC.toggleMenu=toggleMenu;
  TC.reset=function(){for(var id in DEFAULTS)S[id]=DEFAULTS[id];save();if(menuOpen)render();};

  // ------------------------------------------------------------------
  // Suspension-safe draw list
  // ------------------------------------------------------------------
  // The HUD is collected as a list of operations first; each operation is exactly one call into
  // the game. runOps executes them. If a call suspends the TeaVM thread, runOps reports the index
  // so the hook can save (list, index) on the thread stack; on resume that same call is re-entered
  // (it restores itself from the stack) and nothing before it runs twice.
  var ops=null;          // list being built for this frame
  var opDepth=0;         // matrices pushed by operations that have completed
  function op(fn){
    var a=[];
    for(var i=1;i<arguments.length;i++)a.push(arguments[i]);
    ops.push([fn,a,0]);
  }
  function opPush(){ops.push([Eu0,[],1]);}
  function opPop(){ops.push([ECi,[],-1]);}
  function runOps(list,i){
    for(;i<list.length;i++){
      var o=list[i];
      o[0].apply(null,o[1]);
      if($rt_suspending())return i;
      opDepth+=o[2];
    }
    return -1;
  }
  function unwindOps(){
    while(opDepth>0){opDepth--;try{ECi();}catch(_){}}
    opDepth=0;
    try{Dnz();}catch(_){}
    try{CFi(1.0,1.0,1.0,1.0);}catch(_){}
  }

  // ------------------------------------------------------------------
  // HUD helpers (they only queue operations)
  // ------------------------------------------------------------------
  function drawStringOp(font,s,x,y,color){return font.eiX(s,x,y,color,1);}
  function text(font,str,x,y,color){op(drawStringOp,font,$rt_str(String(str)),x|0,y|0,color|0);}
  function rect(x1,y1,x2,y2,color){op(D49,x1|0,y1|0,x2|0,y2|0,color|0);}
  function textWidth(font,str){return CC(font,$rt_str(String(str)));}

  // Items: same GL setup as vanilla GuiIngame.renderHotbar around renderHotbarItem.
  function itemsBegin(){op(CyN);op(B$o,770,771,1,0);op(FKF);}
  function itemsEnd(){op(Dnz);op(CTO);op(CFi,1.0,1.0,1.0,1.0);}
  function itemIcon(ctx,stack,x,y){
    op(FkK,ctx.ri,ctx.player,stack,x|0,y|0);        // icon + enchantment glint
    op(F8l,ctx.ri,ctx.font,stack,x|0,y|0);          // vanilla count + durability bar
  }
  function setZ(gui,z){gui.dz=z;}
  // widgets.png blits at the hotbar's z-level (-90), exactly like vanilla draws the hotbar frame
  function widgetsBegin(ctx){op(D17,ctx.tm,Lo2);op(CFi,1.0,1.0,1.0,1.0);op(setZ,ctx.gui,-90.0);}
  function widgetsEnd(ctx){op(setZ,ctx.gui,ctx.z0);}
  function blit(ctx,x,y,u,v,w,h){op(FYs,ctx.gui,x|0,y|0,u,v,w,h);}
  // n-slot strip cut from the hotbar texture: left border + n slots + right border (20px pitch)
  function slotStrip(ctx,x,y,n){
    blit(ctx,x,y,0,0,1+20*n,22);
    blit(ctx,x+1+20*n,y,181,0,1,22);
  }
  function clamp(v,a,b){return v<a?a:(v>b?b:v);}

  // ------------------------------------------------------------------
  // Armor HUD: worn armor as real item icons in a hotbar-style strip next to the off-hand slot.
  // Durability is the vanilla item durability bar (plus an optional red pulse under 10%).
  // ------------------------------------------------------------------
  function armorHud(ctx){
    var p=ctx.player,i,st;
    Dt();
    var pieces=[p.yE(HHM),p.yE(HIj),p.yE(HJs),p.yE(HJt)];      // helmet, chest, legs, boots
    var worn=0;
    for(i=0;i<4;i++){
      st=pieces[i];
      if(st&&!CCI(st))worn++;else pieces[i]=null;
    }
    if(!worn)return;
    // default: one row of 4 just outside the (reserved) off-hand slot; 2x2 when the screen is narrow
    var cols=4,rows=1,w=82,h=22;
    var gap=4,off=29;
    var x=ctx.offLeft?ctx.cx-91-off-gap-w:ctx.cx+91+off+gap;
    if(x<2||x+w>ctx.w-2){
      cols=2;rows=2;w=42;h=44;
      x=ctx.offLeft?ctx.cx-91-off-gap-w:ctx.cx+91+off+gap;
    }
    var y=ctx.h-h;
    x=clamp(Math.round(x+(Number(S.armorX)||0)),0,ctx.w-w);
    y=clamp(Math.round(y+(Number(S.armorY)||0)),0,ctx.h-h);

    widgetsBegin(ctx);
    for(i=0;i<rows;i++)slotStrip(ctx,x,y+i*22,cols);
    widgetsEnd(ctx);

    if(S.armorWarn){
      var pulse=0.5+0.5*Math.sin(now()/140);
      for(i=0;i<4;i++){
        st=pieces[i];
        if(!st)continue;
        var max=EjU(st);
        if(max<=0||(max-EHa(st))/max>=0.10)continue;
        var sx=x+3+(i%cols)*20,sy=y+3+((i/cols)|0)*22;
        rect(sx-1,sy-1,sx+17,sy+17,((0x30+Math.round(0x50*pulse))<<24)|0xFF2A2A);
      }
    }

    itemsBegin();
    for(i=0;i<4;i++){
      if(pieces[i])itemIcon(ctx,pieces[i],x+3+(i%cols)*20,y+3+((i/cols)|0)*22);
    }
    itemsEnd();
  }

  // ------------------------------------------------------------------
  // Shield / off-hand slot. Thunder draws the off-hand slot itself (vanilla frame, icon and
  // durability bar) so Shield Height / Shield X really move it; vanilla's copy is hidden only
  // while renderHotbar runs (see the Ckt/EjD hooks). While blocking the slot glows cyan.
  // ------------------------------------------------------------------
  function ring(x1,y1,x2,y2,color){
    rect(x1,y1,x2,y1+1,color);rect(x1,y2-1,x2,y2,color);
    rect(x1,y1+1,x1+1,y2-1,color);rect(x2-1,y1+1,x2,y2-1,color);
  }
  function shieldHud(ctx){
    var p=ctx.player,st=null,blocking=false;
    st=origEjD(p);
    if(!st||CCI(st))return;
    try{blocking=!!Ctr(p);}catch(_){}
    // vanilla: 29x24 region of widgets.png at (cx-91-29, h-23) [left] or (cx+91, h-23) [right]
    var left=ctx.offLeft;
    var fx=left?ctx.cx-91-29:ctx.cx+91,fy=ctx.h-23;
    fx=clamp(Math.round(fx+(Number(S.shieldX)||0)),0,ctx.w-29);
    fy=clamp(Math.round(fy+(Number(S.shieldY)||0)),0,ctx.h-24);
    var bx=fx+(left?0:7),by=fy+1;                     // the visible 22x22 frame inside the region

    widgetsBegin(ctx);
    blit(ctx,fx,fy,left?24:53,22,29,24);
    widgetsEnd(ctx);
    if(blocking&&S.shieldGlow){
      var pulse=0.75+0.25*Math.sin(now()/120);
      ring(bx-3,by-3,bx+25,by+25,(Math.round(0x22*pulse)<<24)|0x55E8FF);
      ring(bx-2,by-2,bx+24,by+24,(Math.round(0x55*pulse)<<24)|0x55E8FF);
      ring(bx-1,by-1,bx+23,by+23,(Math.round(0xBB*pulse)<<24)|0x7FF0FF);
      ring(bx,by,bx+22,by+22,0xFFB8F8FF);
    }
    itemsBegin();
    itemIcon(ctx,st,left?fx+3:fx+10,fy+4);
    itemsEnd();
  }

  // ------------------------------------------------------------------
  // Saturation: a slim gold bar split into 10 segments, one directly above each hunger icon
  // (vanilla draws food icons right-to-left from cx+91 at h-39, 8px apart). Each segment is two
  // saturation points and fills from the right like the hunger bar. Underwater it moves above
  // the air bubbles (h-49). Shown only where vanilla shows the hunger bar.
  // ------------------------------------------------------------------
  function saturationHud(ctx){
    var p=ctx.player,mc=ctx.mc;
    if(!Bvs(mc.dw))return;                            // creative / spectator: no hunger bar
    var mount=CqZ(p);
    if(mount!==null&&mount instanceof Co)return;       // riding a mob: mount health replaces food
    var sat=clamp(A1i(FAU(p)),0,20);
    BF();
    var y=ctx.h-43;
    if(DBe(p,HGM))y=ctx.h-53;                          // air bubbles occupy h-49..h-41
    var right=ctx.cx+91;
    for(var k=0;k<10;k++){
      var x0=right-9-8*k+1,x1=x0+7;                   // 7px under hunger icon k (k=0 rightmost)
      rect(x0,y,x1,y+3,0x90000000);
      var f=clamp(sat/2-k,0,1);
      if(f<=0)continue;
      var fx=x1-Math.max(1,Math.round(7*f));          // partial segments fill from the right
      rect(fx,y,x1,y+1,0xFFFFE27A);
      rect(fx,y+1,x1,y+2,0xFFF0AE1C);
    }
  }

  // ------------------------------------------------------------------
  // Held item: the main-hand item as a real icon in a vanilla slot frame on the free side of the
  // hotbar (opposite the off-hand). Held Item Size scales frame, icon and durability bar through
  // the GL matrix, anchored at the bottom corner nearest the hotbar. The label stays unscaled.
  // ------------------------------------------------------------------
  function heldHud(ctx){
    var p=ctx.player,st=EZ6(p);
    if(!st||CCI(st))return;
    var sc=clamp(Number(S.heldScale)||1,0.5,2.0);
    var right=ctx.offLeft;                             // held item goes where the off-hand is not
    var indicator=false;
    try{indicator=ctx.mc.G.o4===2;}catch(_){}          // attack indicator drawn beside the hotbar
    var size=Math.round(22*sc);
    var ax=right?ctx.cx+91+6+(indicator?24:0):ctx.cx-91-6-(indicator?24:0);
    ax=Math.round(ax+(Number(S.heldX)||0));
    ax=right?clamp(ax,0,ctx.w-size):clamp(ax,size,ctx.w);
    var ay=clamp(Math.round(ctx.h+(Number(S.heldY)||0)),size,ctx.h);
    var ox=right?0:-22;                                // frame origin relative to the anchor

    opPush();op(DPm,ax,ay,0.0);op(FWK,sc,sc,1.0);
    widgetsBegin(ctx);
    blit(ctx,ox,-22,24,23,22,22);                     // single slot frame from widgets.png
    widgetsEnd(ctx);
    itemsBegin();
    itemIcon(ctx,st,ox+3,-19);
    itemsEnd();
    opPop();

    if(!S.heldText)return;
    var name=$rt_ustr(EJu(st)),suffix='',col=0xFFFFFF;
    var cnt=CRD(st);
    if(cnt>1)suffix=' x'+cnt;
    var mx=EjU(st);
    if(mx>0){
      var pct=Math.round((mx-EHa(st))*100/mx);
      suffix=' '+pct+'%';
      col=pct<=10?0xFF5555:(pct<=25?0xFFAA00:(pct<=50?0xFFFF55:0x55FF55));
    }
    var ty=ay-Math.round(size/2)-4;
    var room=right?ctx.w-(ax+size+4)-2:(ax-size-4)-2;
    var sw=textWidth(ctx.font,suffix);
    if(textWidth(ctx.font,name)+sw>room){
      while(name.length>1&&textWidth(ctx.font,name+'...')+sw>room)name=name.slice(0,-1);
      name+='...';
    }
    var full=textWidth(ctx.font,name)+sw;
    if(full>room+2)return;                             // no room at all: icon only
    var tx=right?ax+size+4:ax-size-4-full;
    text(ctx.font,name,tx,ty,0xFFFFFF);
    if(suffix)text(ctx.font,suffix,tx+textWidth(ctx.font,name),ty,col);
  }
  function fmt1(n){return (Math.round(n*10)/10).toFixed(1);}
  function pad2(n){return n<10?'0'+n:''+n;}

  var EFFECT_NAMES={
    moveSpeed:'Speed',moveSlowdown:'Slowness',digSpeed:'Haste',digSlowDown:'Mining Fatigue',
    damageBoost:'Strength',heal:'Instant Health',harm:'Instant Damage',jump:'Jump Boost',
    confusion:'Nausea',regeneration:'Regeneration',resistance:'Resistance',fireResistance:'Fire Resistance',
    waterBreathing:'Water Breathing',invisibility:'Invisibility',blindness:'Blindness',nightVision:'Night Vision',
    hunger:'Hunger',weakness:'Weakness',poison:'Poison',wither:'Wither',healthBoost:'Health Boost',
    absorption:'Absorption',saturation:'Saturation',glowing:'Glowing',levitation:'Levitation',luck:'Luck',unluck:'Bad Luck'
  };
  var ROMAN=['I','II','III','IV','V','VI','VII','VIII','IX','X'];
  function effectLine(ef){
    var key=$rt_ustr(CSt(ef));
    key=String(key||'').replace(/^effect\./,'');
    var name=EFFECT_NAMES[key]||(key.charAt(0).toUpperCase()+key.slice(1));
    var amp=ELx(ef);
    var lvl=amp>=0&&amp<ROMAN.length?ROMAN[amp]:String(amp+1);
    var ticks=D8_(ef);
    var t;
    if(ticks>=32767)t='**';
    else{var s=Math.ceil(ticks/20);t=Math.floor(s/60)+':'+pad2(s%60);}
    return name+' '+lvl+' '+t;
  }

  // speed tracking
  var lastX=null,lastZ=null,lastT=0,speed=0;
  function updateSpeed(px,pz){
    var t=now();
    if(lastX!==null){
      var dt=(t-lastT)/1000;
      if(dt>0&&dt<0.5){
        var v=Math.sqrt((px-lastX)*(px-lastX)+(pz-lastZ)*(pz-lastZ))/dt;
        if(v<100)speed=speed*0.85+v*0.15;
      }
    }
    lastX=px;lastZ=pz;lastT=t;
  }

  // fullbright (gamma) handling
  var savedGamma=null;
  function readStoredGamma(){
    try{var v=W.localStorage.getItem(GAMMA_KEY);if(v!==null){v=parseFloat(v);if(isFinite(v))return v;}}catch(_){}
    return null;
  }
  function writeStoredGamma(v){try{if(v===null)W.localStorage.removeItem(GAMMA_KEY);else W.localStorage.setItem(GAMMA_KEY,String(v));}catch(_){}}
  function fullbrightTick(mc){
    var gs=mc&&mc.G;
    if(!gs||typeof gs.bCx!=='number')return;
    if(S.fullbright){
      if(savedGamma===null){
        var st=readStoredGamma();
        savedGamma=gs.bCx<100?gs.bCx:(st!==null?st:1.0);
        writeStoredGamma(savedGamma);
      }
      if(gs.bCx!==1000)gs.bCx=1000.0;
    }else if(savedGamma!==null){
      gs.bCx=savedGamma;savedGamma=null;writeStoredGamma(null);
    }else if(gs.bCx>=100){
      var st2=readStoredGamma();
      gs.bCx=st2!==null?st2:1.0;
      writeStoredGamma(null);
    }
  }

  // toggle sprint
  function sprintTick(player){
    var forward=!!(keyState.KeyW||keyState.ArrowUp);
    var want=forward&&!menuOpen&&locked()&&!Fch(player)&&!A4G(player)&&!Ctr(player)&&ZP(FAU(player))>6;
    var cur=!!CBg(player);
    if(want&&!cur)op(FPB,player,1);
    else if(!want&&cur&&!forward)op(FPB,player,0);
  }

  // ------------------------------------------------------------------
  // HUD (queues operations; nothing here calls into rendering directly)
  // ------------------------------------------------------------------
  function buildHud(gui){
    var mc=gui&&gui.dk;
    if(!mc)return;
    fullbrightTick(mc);
    var player=mc.v;
    if(!player)return;
    if(S.toggleSprint)sprintTick(player);

    var scaled=mc.nZ;
    var width=AIz(scaled),height=ASe(scaled);
    var font=Chf(gui);
    if(!font)return;
    trimClicks();

    var left=[],right=[];
    var px=player.b,py=player.f,pz=player.c;
    var havePos=typeof px==='number'&&typeof py==='number'&&typeof pz==='number';
    if(havePos)updateSpeed(px,pz);

    var ctx={gui:gui,mc:mc,player:player,font:font,ri:gui.b0l,tm:mc.bH,z0:gui.dz,
      w:width,h:height,cx:(width/2)|0,offLeft:true};
    try{ctx.offLeft=CiU(DlC(player))===HJu;}catch(_){}
    var itemHud=!YZ(mc.dw)&&!!ctx.ri&&!!ctx.tm;     // no hotbar (so no item HUD) in spectator
    if(S.fps)left.push(['FPS '+fpsValue,0xFFFFFF]);
    if(S.cps)left.push(['CPS '+clicks.length,0xFFFFFF]);
    if(S.coords&&havePos)left.push(['XYZ '+fmt1(px)+' / '+fmt1(py)+' / '+fmt1(pz),0xFFFFFF]);
    if(S.direction&&typeof player.C==='number'){
      var f=Math.floor(player.C*4/360+0.5)&3;
      var dirs=['South (+Z)','West (-X)','North (-Z)','East (+X)'];
      left.push(['Facing '+dirs[f],0xFFFFFF]);
    }
    if(S.speed)left.push(['Speed '+fmt1(speed)+' b/s',0xFFFFFF]);
    if(S.hunger){
      try{left.push(['Food '+ZP(FAU(player)),0xFFAA00]);}catch(_){}
    }
    if(S.sprintStatus){
      var sp=!!CBg(player);
      left.push(['Sprint '+(sp?'ON':'OFF'),sp?0x55FF55:0xAAAAAA]);
    }
    if(S.clock){
      var d=new Date();
      right.push([pad2(d.getHours())+':'+pad2(d.getMinutes())+':'+pad2(d.getSeconds()),0xFFFFFF]);
    }
    if(S.memory){
      try{
        var pm=W.performance&&W.performance.memory;
        if(pm&&pm.usedJSHeapSize)right.push(['Mem '+Math.round(pm.usedJSHeapSize/1048576)+' MB',0xFFFFFF]);
      }catch(_){}
    }
    if(S.effects){
      try{
        var it=F9v(player).O(),n=0;
        while(it.B()&&n<24){
          right.push([effectLine(it.z()),0xFFFFFF]);
          n++;
        }
      }catch(_){}
    }

    var x=5,y=5,dy=10,j;
    for(j=0;j<left.length;j++){text(font,left[j][0],x,y,left[j][1]);y+=dy;}
    y=5;
    for(j=0;j<right.length;j++){
      text(font,right[j][0],width-textWidth(font,right[j][0])-5,y,right[j][1]);
      y+=dy;
    }
    if(S.armor&&itemHud)armorHud(ctx);
    if(S.shield&&itemHud)shieldHud(ctx);
    if(S.heldItem&&itemHud)heldHud(ctx);
    if(S.saturation&&itemHud)saturationHud(ctx);
    if(S.keystrokes){
      var ky=height-46,kx=width-51;
      var keys=[
        ['W',keyState.KeyW||keyState.ArrowUp,kx+16,ky],
        ['A',keyState.KeyA||keyState.ArrowLeft,kx,ky+12],
        ['S',keyState.KeyS||keyState.ArrowDown,kx+16,ky+12],
        ['D',keyState.KeyD||keyState.ArrowRight,kx+32,ky+12],
        ['LMB',mouseState[0],kx-2,ky+24],
        ['RMB',mouseState[2],kx+26,ky+24]
      ];
      for(var q=0;q<keys.length;q++)text(font,keys[q][0],keys[q][2],keys[q][3],keys[q][1]?0x55FF55:0xFFFFFF);
    }
    // the font renderer leaves the GL color tinted; put it back so later GUI drawing is unaffected
    op(CFi,1.0,1.0,1.0,1.0);
  }
  TC.buildHud=buildHud;

  // ------------------------------------------------------------------
  // Hooks
  // ------------------------------------------------------------------
  var errCount=0;
  function report(e){
    TC.lastError=e;
    if(errCount++<5&&W.console&&W.console.warn)W.console.warn('[Thunder] HUD error',e);
  }

  // renderGameOverlay: vanilla first, then the Thunder HUD list (TeaVM-resumable).
  var origEwc=Ewc;
  Ewc=function(a,b){
    var st=0,list=null,i=0,t;
    if($rt_resuming()){t=$rt_nativeThread();i=t.pop();list=t.pop();st=t.pop();b=t.pop();a=t.pop();}
    if(st===0){
      origEwc(a,b);
      if($rt_suspending()){$rt_nativeThread().push(a,b,0,null,0);return;}
      ops=[];opDepth=0;
      try{buildHud(a);list=ops;}catch(e){report(e);list=null;}
      ops=null;i=0;
    }
    if(list){
      try{i=runOps(list,i);}
      catch(e){report(e);i=-1;unwindOps();}
      if(i>=0){$rt_nativeThread().push(a,b,1,list,i);return;}
    }
  };

  // ------------------------------------------------------------------
  // Resource-pack animation safety net (TextureAtlasSprite.loadSprite).
  // 1.12 only accepts a non-square atlas texture as an animation when <name>.png.mcmeta comes
  // from the same pack (or one above it), and every frame index it lists must exist in the
  // strip. Otherwise loadSprite throws ("broken aspect ratio and not an animation" /
  // "invalid frameindex N"), TextureMap logs "Unable to parse metadata from ..." and the sprite
  // becomes the purple/black missing texture - on fire blocks, burning entities and the
  // first-person fire overlay alike. Packs converted without their .mcmeta files hit this for
  // fire_layer_0/1, lava, portal, magma, sea lantern and prismarine.
  // For vertical frame strips only, supply what the pack forgot: the metadata vanilla uses for
  // {"animation":{}} when the file is missing, or just the frames that exist when indices point
  // past the strip. Square textures and valid animations are passed through untouched.
  // ------------------------------------------------------------------
  var animNoted={};
  TC.textureFixes=[];
  function animNote(sprite,msg){
    var name='?';
    try{name=$rt_ustr(CAB(sprite));}catch(_){}
    if(animNoted[name+'|'+msg])return;
    animNoted[name+'|'+msg]=1;
    TC.textureFixes.push(name+': '+msg);
    if(W.console&&W.console.warn)W.console.warn('[Thunder] texture '+name+': '+msg);
  }
  function fixSpriteAnimation(sprite,images,meta){
    var arr=images&&images.data,img=arr&&arr[0];
    if(!img)return meta;
    var w=img.jb,h=img.lS;
    if(!(w>0&&h>=2*w))return meta;                   // not a vertical frame strip
    var frames=(h/w)|0,i,fr;
    if(meta===null){
      animNote(sprite,'no .png.mcmeta for a '+frames+'-frame strip; animating it (add the .mcmeta to the pack to fix it there)');
      return Bqh(Bq(),-1,-1,1,0);                     // == {"animation":{}}
    }
    var list=meta.bA2,n=list?EH(list):0,bad=0;
    for(i=0;i<n;i++)if(Bm(list,i).cve>=frames)bad++;
    if(!bad)return meta;
    var kept=Bq();
    for(i=0;i<n;i++){fr=Bm(list,i);if(fr.cve<frames)Y(kept,fr);}
    animNote(sprite,bad+' frame index(es) past the end of the '+frames+'-frame strip were ignored (fix the .mcmeta)');
    return Bqh(kept,meta.emZ,meta.ee8,meta.bZY,meta.bXS);   // empty list => all frames in order
  }
  var origLoadSprite=DR$;
  DR$=function(a,b,c){
    if(!$rt_resuming()){
      try{c=fixSpriteAnimation(a,b,c);}catch(e){report(e);}
    }
    return origLoadSprite(a,b,c);
  };

  // renderHotbar: while it runs (and the Thunder shield slot is on), getHeldItemOffhand reports
  // an empty hand so vanilla skips its own off-hand frame/icon; Thunder draws it instead.
  // Both wrappers are stateless, so a suspended renderHotbar simply resumes through them.
  var hideVanillaOffhand=false;
  var origCkt=Ckt;
  Ckt=function(a,b,c){
    hideVanillaOffhand=!!S.shield;
    try{return origCkt(a,b,c);}
    finally{hideVanillaOffhand=false;}
  };
  var origEjD=EjD;
  EjD=function(a){
    if(hideVanillaOffhand&&!$rt_resuming()&&HHk)return HHk;
    return origEjD(a);
  };

  // Fire overlay: 0.00 is vanilla, negative moves the first-person fire down, positive up.
  var origC94=C94;
  C94=function(a){
    var st=0,t;
    if($rt_resuming()){t=$rt_nativeThread();st=t.pop();a=t.pop();}
    else{
      var off=(typeof S.fireOffset==='number'&&isFinite(S.fireOffset))?S.fireOffset:0;
      if(Math.abs(off)>=0.001){Eu0();DPm(0.0,off,0.0);st=1;}
    }
    try{origC94(a);}
    finally{
      if($rt_suspending())$rt_nativeThread().push(a,st);
      else if(st===1)ECi();
    }
  };

  // ------------------------------------------------------------------
  // Hand Item Size: resizes (and raises/lowers) the real 3D item held in first person - sword,
  // tools, blocks and the shield. renderItemInFirstPerson (DkZ) runs once per hand after placing
  // that hand's swing/equip transforms; while it runs we remember which hand it is. It draws the
  // item through renderItemSide (Ch0) with a FIRST_PERSON transform, and that call is wrapped in
  // push / translate / scale / pop. The scale pivots on the hand anchor, so a smaller item stays
  // in the hand. Third-person, GUI, dropped and item-frame rendering use other transform types
  // and are untouched. Both wrappers keep their state on the thread stack across a suspension.
  // ------------------------------------------------------------------
  var fpHand=0;                              // 1 main hand, 2 off hand, while DkZ runs
  var origDkZ=DkZ;
  DkZ=function(a,b,c,d,e,f,g,h){
    var prev=fpHand,mine,t;
    if($rt_resuming()){t=$rt_nativeThread();mine=t.pop();prev=t.pop();}
    else mine=e===HFj?1:2;
    fpHand=mine;
    try{origDkZ(a,b,c,d,e,f,g,h);}
    finally{
      if($rt_suspending())$rt_nativeThread().push(prev,mine);
      fpHand=prev;
    }
  };
  function handNum(v,def,lo,hi){v=Number(v);return isFinite(v)?clamp(v,lo,hi):def;}
  var origCh0=Ch0;
  Ch0=function(a,b,c,d,e){
    var st=0;
    if($rt_resuming())st=$rt_nativeThread().pop();
    else if(fpHand&&S.handItems&&(d===Lke||d===Lkd)){
      var main=fpHand===1;
      var sc=handNum(main?S.mainScale:S.offScale,1,0.3,1.5);
      var dy=handNum(main?S.mainY:S.offY,0,-0.5,0.3);
      if(Math.abs(sc-1)>=0.001||Math.abs(dy)>=0.001){
        Eu0();
        if(Math.abs(dy)>=0.001)DPm(0.0,dy,0.0);
        if(Math.abs(sc-1)>=0.001)FWK(sc,sc,sc);
        st=1;
      }
    }
    try{origCh0(a,b,c,d,e);}
    finally{
      if($rt_suspending())$rt_nativeThread().push(st);
      else if(st===1)ECi();
    }
  };

  // Hitboxes: RenderManager.debugBoundingBox is what F3+B toggles. The setting is written to it
  // before each entity is drawn; if the game flips it (F3+B with Block F3 Screen off), the
  // setting follows so the menu and the game never disagree.
  var hbApplied=null;
  var origGxt=Gxt;
  Gxt=function(a,b,c,d,e,f,g,h){
    if(!$rt_resuming()&&a){
      try{
        var cur=!!a.ck_;
        if(hbApplied!==null&&cur!==hbApplied){S.hitboxes=cur;save();if(menuOpen)render();}
        else if(cur!==!!S.hitboxes)a.ck_=S.hitboxes?1:0;
        hbApplied=!!S.hitboxes;
      }catch(_){}
    }
    return origGxt(a,b,c,d,e,f,g,h);
  };

  var origFN3=FN3;
  FN3=function(a,b){
    if(S.noHurtCam&&!$rt_resuming())return;
    return origFN3(a,b);
  };

  var origCyx=Cyx;
  Cyx=function(a,b){
    if(S.noBob&&!$rt_resuming())return;
    return origCyx(a,b);
  };

  // FOV: with No FOV Change the hand FOV modifier is pinned to 1.0 for the duration of the call.
  // The world camera's final FOV (c = use the FOV setting) is remembered for the shaders, which
  // project the sun onto the screen with it.
  var worldFov=70;
  var origDvp=Dvp;
  Dvp=function(a,b,c){
    var o1=0,o2=0,pinned=0,t,r;
    if($rt_resuming()){t=$rt_nativeThread();pinned=t.pop();o2=t.pop();o1=t.pop();}
    else if(S.noFov&&c&&a&&typeof a.US==='number'&&typeof a.cQr==='number'){
      o1=a.US;o2=a.cQr;a.US=1.0;a.cQr=1.0;pinned=1;
    }
    try{r=origDvp(a,b,c);}
    finally{
      if($rt_suspending())$rt_nativeThread().push(o1,o2,pinned);
      else if(pinned){a.US=o1;a.cQr=o2;}
    }
    if(c&&typeof r==='number'&&r>1&&r<179)worldFov=r;
    return r;
  };

  // Shaders: optional post-processing of the world image (off by default)
  // @include thunder-shaders.js
})();
