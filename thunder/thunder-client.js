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
    shieldX:0,shieldGlow:true
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
  function save(){try{W.localStorage.setItem(KEY,JSON.stringify(S));}catch(_){}}
  save();

  // Menu layout: [category, [[id, label, description], ...]]
  var CATS=[
    ['HUD',[
      ['armor','Armor HUD','Worn armor as item icons with vanilla durability bars, next to the off-hand slot'],
      ['armorWarn','Low Armor Warning','Pulses a slot red when that piece is below 10% durability'],
      ['heldItem','Held Item','Held item icon (with durability bar) beside the hotbar'],
      ['heldText','Held Item Name','Item name and durability next to the held-item icon'],
      ['coords','Coordinates','XYZ position'],
      ['direction','Direction','Facing and axis'],
      ['speed','Speed','Horizontal speed in blocks/second'],
      ['hunger','Hunger','Food level'],
      ['saturation','Saturation','Saturation indicator above the hunger bar'],
      ['effects','Potion Effects','Active effects with time left'],
      ['sprintStatus','Sprint Status','Shows whether you are sprinting'],
      ['shield','Shield / Off-hand Slot','Draws the off-hand (shield) slot so it can be moved'],
      ['shieldGlow','Blocking Glow','Cyan glow around the shield slot while you block'],
      ['clock','Clock','Real-world time'],
      ['memory','Memory','JS memory in use'],
      ['fps','FPS','Frames per second'],
      ['cps','CPS','Left clicks per second'],
      ['keystrokes','Keystrokes','WASD and mouse buttons']
    ]],
    ['PVP',[
      ['noHurtCam','No Hurt Camera','Removes camera shake when damaged'],
      ['noFov','No FOV Change','Keeps FOV fixed during sprint/speed/bow']
    ]],
    ['MOVEMENT',[
      ['toggleSprint','Toggle Sprint','Sprints while moving forward'],
      ['noBob','No View Bobbing','Removes walking camera bob']
    ]],
    ['UTILITY',[
      ['blockF3','Block F3 Screen','Stops the built-in F3 screen']
    ]],
    ['VISUAL',[
      ['fullbright','Fullbright','Maximum brightness everywhere'],
      ['fireOffset','Fire Height','Moves the first-person fire overlay down (-) or up (+); 0 = vanilla'],
      ['shieldY','Shield Height','Moves the shield / off-hand slot up (0 = vanilla position)'],
      ['shieldX','Shield X','Moves the shield / off-hand slot left/right'],
      ['heldScale','Held Item Size','Scales the held-item icon, frame and durability bar'],
      ['heldX','Held Item X','Moves the held-item icon left/right'],
      ['heldY','Held Item Y','Moves the held-item icon up/down'],
      ['armorX','Armor HUD X','Moves the armor slots left/right'],
      ['armorY','Armor HUD Y','Moves the armor slots up/down']
    ]]
  ];
  var NUMERIC_RANGES={
    fireOffset:{min:-0.55,max:0.45,step:0.05,format:function(v){return Math.abs(v)<0.001?'vanilla':(v>0?'+':'')+v.toFixed(2);}},
    shieldY:{min:-100,max:0,step:1,format:function(v){return v===0?'vanilla':Math.round(-v)+' px up';}},
    shieldX:{min:-150,max:150,step:1,format:function(v){return (v>0?'+':'')+Math.round(v)+' px';}},
    heldScale:{min:0.50,max:2.00,step:0.05,format:function(v){return v.toFixed(2)+'x';}},
    heldX:{min:-150,max:150,step:1,format:function(v){return (v>0?'+':'')+Math.round(v)+' px';}},
    heldY:{min:-120,max:0,step:1,format:function(v){return v===0?'hotbar':Math.round(-v)+' px up';}},
    armorX:{min:-120,max:120,step:1,format:function(v){return (v>0?'+':'')+Math.round(v)+' px';}},
    armorY:{min:-120,max:0,step:1,format:function(v){return (v>0?'+':'')+Math.round(v)+' px';}}
  };

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
  // Menu (Right Shift)
  // ------------------------------------------------------------------
  var backdrop=null,panel=null,tabsEl=null,listEl=null,currentTab=0,searchInput=null,searchQuery='';

  function toggleMenu(){if(menuOpen)hideMenu();else showMenu();}
  function hideMenu(){
    menuOpen=false;
    if(backdrop)backdrop.style.display='none';
  }
  function showMenu(){
    if(!backdrop)buildMenu();
    menuOpen=true;
    renderTabs();
    renderList();
    backdrop.style.display='flex';
    try{if(D.exitPointerLock&&D.pointerLockElement)D.exitPointerLock();}catch(_){}
  }
  function el(tag,css,text){
    var n=D.createElement(tag);
    if(css)n.style.cssText=css;
    if(text!==undefined)n.textContent=text;
    return n;
  }
  function buildMenu(){
    backdrop=el('div','position:fixed;inset:0;z-index:2147483646;background:radial-gradient(circle at 50% 35%,rgba(20,34,50,.34),rgba(2,6,12,.84) 68%);backdrop-filter:blur(7px);display:none;align-items:center;justify-content:center;font-family:Arial,sans-serif;overflow:hidden;');
    backdrop.id='thunder-client-menu';
    backdrop.addEventListener('mousedown',function(e){if(e.target===backdrop)hideMenu();});

    panel=el('div','position:relative;z-index:2;width:820px;max-width:94vw;height:78vh;max-height:720px;display:flex;flex-direction:column;background:linear-gradient(180deg,rgba(18,23,34,.965),rgba(9,13,21,.985));border:1px solid rgba(79,209,255,.62);border-radius:14px;box-shadow:0 24px 90px rgba(0,0,0,.82),0 0 36px rgba(79,209,255,.10);color:#ecf7ff;user-select:none;overflow:hidden;');

    var head=el('div','padding:18px 20px 10px;display:flex;align-items:flex-start;justify-content:space-between;gap:16px;');
    var titleWrap=el('div','min-width:0;');
    titleWrap.appendChild(el('div','font-weight:800;font-size:21px;letter-spacing:.13em;color:#f4fbff;','THUNDER CLIENT'));
    titleWrap.appendChild(el('div','font-size:11px;color:#8ca8ba;margin-top:5px;','Right Shift opens \u2022 Esc closes \u2022 changes save instantly'));
    head.appendChild(titleWrap);
    panel.appendChild(head);

    tabsEl=el('div','display:flex;gap:7px;padding:0 20px 10px;flex-wrap:wrap;');
    panel.appendChild(tabsEl);

    var searchWrap=el('div','padding:0 20px 12px;');
    searchInput=el('input','box-sizing:border-box;width:100%;height:38px;border:1px solid rgba(106,136,157,.42);border-radius:8px;background:rgba(4,8,14,.68);color:#eef8ff;padding:0 12px;font:12px Arial;outline:none;');
    searchInput.type='text';
    searchInput.placeholder='Search modules or settings\u2026';
    searchInput.value=searchQuery;
    searchInput.addEventListener('input',function(){searchQuery=String(searchInput.value||'').toLowerCase();renderList();});
    searchWrap.appendChild(searchInput);
    panel.appendChild(searchWrap);

    listEl=el('div','overflow-y:auto;padding:0 20px 14px;flex:1 1 auto;display:grid;grid-template-columns:repeat(3,minmax(0,1fr));grid-auto-rows:min-content;gap:9px;align-content:start;');
    panel.appendChild(listEl);

    var foot=el('div','display:flex;justify-content:flex-end;align-items:center;gap:12px;padding:9px 20px 14px;border-top:1px solid rgba(79,209,255,.14);');
    var reset=el('button','border:1px solid #46677a;background:#101c27;color:#eaf6ff;padding:7px 11px;border-radius:7px;font:11px Arial;cursor:pointer;','Reset all');
    reset.type='button';
    reset.onclick=function(){for(var id in DEFAULTS)S[id]=DEFAULTS[id];save();renderList();};
    foot.appendChild(reset);
    panel.appendChild(foot);
    backdrop.appendChild(panel);
    (D.body||D.documentElement).appendChild(backdrop);
  }
  function renderTabs(){
    while(tabsEl.firstChild)tabsEl.removeChild(tabsEl.firstChild);
    CATS.forEach(function(cat,i){
      var on=i===currentTab;
      var b=el('button','border:1px solid '+(on?'#4fd1ff':'rgba(91,119,138,.45)')+';background:'+(on?'rgba(79,209,255,.16)':'rgba(8,14,22,.82)')+';color:'+(on?'#eaffff':'#9bb3c3')+';padding:7px 14px;border-radius:7px;font:bold 11px Arial;letter-spacing:.06em;cursor:pointer;',cat[0]);
      b.type='button';
      b.onclick=function(){currentTab=i;searchQuery='';if(searchInput)searchInput.value='';renderTabs();renderList();};
      tabsEl.appendChild(b);
    });
  }
  function renderList(){
    while(listEl.firstChild)listEl.removeChild(listEl.firstChild);
    var q=searchQuery;
    var mods=CATS[currentTab][1].filter(function(m){return !q||String(m[1]).toLowerCase().indexOf(q)>=0||String(m[2]).toLowerCase().indexOf(q)>=0;});
    mods.forEach(function(m){
      var id=m[0];
      var card=el('div','min-height:82px;padding:11px 12px;background:linear-gradient(180deg,rgba(23,29,41,.94),rgba(15,20,29,.94));border:1px solid rgba(101,129,148,.22);border-radius:9px;display:flex;flex-direction:column;justify-content:space-between;gap:9px;');
      var top=el('div','display:flex;justify-content:space-between;gap:8px;align-items:flex-start;');
      var txt=el('div','min-width:0;');
      txt.appendChild(el('div','font-size:12px;font-weight:700;color:#f2f7fb;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;',m[1]));
      txt.appendChild(el('div','font-size:9px;line-height:1.3;color:#7690a0;margin-top:3px;',m[2]));
      top.appendChild(txt);
      if(Object.prototype.hasOwnProperty.call(NUMERIC_RANGES,id)){
        var info=NUMERIC_RANGES[id];
        var val=Number(S[id]);
        var valLabel=el('span','font-size:10px;font-weight:700;color:#ffd95c;',info.format(val));
        top.appendChild(valLabel);
        card.appendChild(top);
        var range=D.createElement('input');
        range.type='range';range.min=String(info.min);range.max=String(info.max);range.step=String(info.step);range.value=String(val);
        range.style.cssText='width:100%;accent-color:#4fd1ff;cursor:pointer;';
        range.addEventListener('input',(function(id,info,valLabel,range){return function(){var nv=parseFloat(range.value);S[id]=nv;valLabel.textContent=info.format(nv);save();};})(id,info,valLabel,range));
        card.appendChild(range);
      }else{
        var btn=el('button','');btn.type='button';
        var paint=(function(btn,id){return function(){
          var on=!!S[id];
          btn.textContent=on?'ON':'OFF';
          btn.style.cssText='min-width:48px;height:24px;border:1px solid '+(on?'#59db71':'#465765')+';border-radius:999px;background:'+(on?'rgba(70,208,96,.15)':'rgba(80,96,108,.12)')+';color:'+(on?'#a8ffb7':'#8da0ac')+';padding:0 8px;font:bold 10px Arial;cursor:pointer;flex:0 0 auto;';
        };})(btn,id);
        paint();
        btn.onclick=(function(id,paint){return function(){S[id]=!S[id];save();paint();};})(id,paint);
        top.appendChild(btn);
        card.appendChild(top);
      }
      listEl.appendChild(card);
    });
    if(!mods.length)listEl.appendChild(el('div','grid-column:1/-1;padding:30px;text-align:center;color:#718b9c;font-size:12px;','No matching modules.'));
  }
  TC.openMenu=showMenu;TC.closeMenu=hideMenu;TC.toggleMenu=toggleMenu;
  TC.reset=function(){for(var id in DEFAULTS)S[id]=DEFAULTS[id];save();if(menuOpen)renderList();};

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
    var saturationValue=0;
    if(S.hunger||S.saturation){
      try{
        var fs=FAU(player);
        saturationValue=A1i(fs);
        if(S.hunger)left.push(['Food '+ZP(fs),0xFFAA00]);
      }catch(_){}
    }
    if(S.saturation){
      var satUnits=Math.max(0,Math.min(20,saturationValue))/2.0;
      var satX=Math.round(width/2+46),satY=height-31;
      for(var spip=0;spip<10;spip++){
        var fill=Math.max(0,Math.min(1,satUnits-spip));
        var px0=satX+spip*8;
        rect(px0,satY,px0+6,satY+3,0xFF3A3A3A);
        if(fill>0)rect(px0,satY,px0+Math.max(2,Math.round(6*fill)),satY+3,0xFFFFC928);
      }
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
    return r;
  };
})();
