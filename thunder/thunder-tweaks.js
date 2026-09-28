  /* -------------------------------------------------------------------------------------------
     Part of Thunder Client, created and owned by Jayvardhan Ginni (ThunderGamey).
     Visual tweaks (Right Shift > Visual). Included into the client scope of thunder-client.js by
     build.js. Each one only skips something the game would draw, in your own game:
     - No Enchant Glint: no shimmer on enchanted items and armor (ItemStack.hasEffect answers no;
       the game uses it only to decide whether to draw the glint on items; worn armor and elytra
       draw theirs with LayerArmorBase.renderEnchantedGlint, which is skipped).
     - No Rain: no rain or snow falling on the screen, no splashes and no rain sounds. The sky
       still darkens in a storm, and the weather itself (on a server) is unchanged.
     - No Pumpkin Blur: wearing a carved pumpkin no longer covers the screen.

     Game functions this module replaces (each wrapper either skips the call or calls the original):
     @hook EZy net.minecraft.item.ItemStack.hasEffect
     @hook Fzr net.minecraft.client.renderer.entity.layers.LayerArmorBase.renderEnchantedGlint
     @hook DKJ net.minecraft.client.renderer.EntityRenderer.renderRainSnow
     @hook DtJ net.minecraft.client.renderer.EntityRenderer.addRainParticles
     @hook DEG net.minecraft.client.gui.GuiIngame.renderPumpkinOverlay
     ------------------------------------------------------------------------------------------- */
  var TW={glintSkips:0,rainSkips:0,pumpkinSkips:0};
  var origEZy=EZy;
  EZy=function(a){
    if(S.noGlint&&!$rt_resuming()){TW.glintSkips++;return 0;}
    return origEZy(a);
  };
  var origFzr=Fzr;
  Fzr=function(b,c,d,e,f,g,h,i,j,k){
    if(S.noGlint&&!$rt_resuming()){TW.glintSkips++;return;}
    return origFzr(b,c,d,e,f,g,h,i,j,k);
  };
  var origDKJ=DKJ;
  DKJ=function(a,b){
    if(S.noRain&&!$rt_resuming()){TW.rainSkips++;return;}
    return origDKJ(a,b);
  };
  var origDtJ=DtJ;
  DtJ=function(a){
    if(S.noRain&&!$rt_resuming())return;
    return origDtJ(a);
  };
  var origDEG=DEG;
  DEG=function(a,b){
    if(S.noPumpkin&&!$rt_resuming()){TW.pumpkinSkips++;return;}
    return origDEG(a,b);
  };
  TC.tweaks={counts:function(){return {glint:TW.glintSkips,rain:TW.rainSkips,pumpkin:TW.pumpkinSkips};}};
  MODULES.push(
    {cat:'visual',id:'noGlint',name:'No Enchant Glint',
      desc:'Removes the purple shimmer from enchanted items and armor, so textures stay clean and easy to read.'},
    {cat:'visual',id:'noRain',name:'No Rain',
      desc:'No rain or snow on your screen, no splashes and no rain sounds. The sky still gets dark in a storm.'},
    {cat:'visual',id:'noPumpkin',name:'No Pumpkin Blur',
      desc:'Wearing a carved pumpkin no longer covers your screen with the pumpkin overlay.'});
