  /* -------------------------------------------------------------------------------------------
     Part of Thunder Client, created and owned by Jayvardhan Ginni (ThunderGamey).
     Newer items on servers: maces, spears, wind charges, netherite gear and everything else added
     after 1.12. Included into the client scope of thunder-client.js by build.js.

     A newer server (through ViaVersion / ViaBackwards) sends a 1.12 client every item 1.12 does not
     have as an old item renamed "<version> <Name>", for example "1.21.11 Netherite Spear" or
     "1.21 Mace". When an item has such a name and the resource packs have the model
     item/thunder/<name in lower_case_words> (the Thunder 1.21.11 pack has one for every item added
     since 1.12), that model is drawn instead of the old item: in the hotbar and inventories, in
     the hand, on the ground and on other players. While held, <...>_in_hand is used when it
     exists (the long spear models). Worn netherite, copper and turtle armor named that way is
     drawn with the pack's own armor textures, but only while that pack's models are loaded.
     Items without such a name, and everything with the setting off, are left to the game.

     Game functions this module replaces (each wrapper falls through to the original):
     @hook EAO net.minecraft.client.renderer.RenderItem.getItemModelWithOverrides
     @hook D$Y net.minecraft.client.renderer.entity.layers.LayerArmorBase.renderArmorLayer
     @hook CVz net.minecraft.client.renderer.entity.layers.LayerArmorBase.getArmorResource

     Game functions, classes and fields it uses:
     @use D8D net.minecraft.client.renderer.block.model.ModelManager.getModel
     @use Ehd net.minecraft.client.renderer.block.model.ModelResourceLocation.<init>
     @use Gp7 net.minecraft.util.ResourceLocation.<init>
     @use FWd net.minecraft.item.ItemStack.hasDisplayName
     @class Hr net.minecraft.client.renderer.block.model.ModelResourceLocation
     @class Bb net.minecraft.util.ResourceLocation
     @field u1 net.minecraft.client.Minecraft.getRenderItem Minecraft.renderItem
     @field wb net.minecraft.client.renderer.RenderItem.getItemModelWithOverrides RenderItem.itemModelMesher
     @field M8 net.minecraft.client.renderer.RenderItem.getItemModelWithOverrides ItemModelMesher.modelManager
     @field WL net.minecraft.client.renderer.block.model.ModelManager.getModel ModelManager.defaultModel (the missing model)
     @field dhm net.minecraft.client.renderer.block.model.ModelManager.getModel ModelManager.modelRegistry
     @field bg2 net.minecraft.item.ItemStack.hasTagCompound ItemStack.isEmpty
     @field bU net.minecraft.item.ItemStack.hasTagCompound ItemStack.stackTagCompound
     (ItemStack.getDisplayName EJu and EntityLivingBase.getItemStackFromSlot yE are declared in
     thunder-client.js, the Minecraft instance HEN in thunder-lan.js.)
     ------------------------------------------------------------------------------------------- */
  var NI={reg:null,cache:{},armor:null,res:{}};
  var NI_ARMOR={netherite:'netherite',copper:'copper'};
  // "1.21.11 Netherite Spear" -> "netherite_spear" (the same rule as build_packs.py model_key);
  // null for a name without a version in front
  function niKey(name){
    var t=String(name).replace(/\u00a7./g,'').replace(/^\s+|\s+$/g,'');
    var m=/^\d+\.\d+(?:\.\d+)?\s+(.+)$/.exec(t);
    if(!m)return null;
    return m[1].toLowerCase().replace(/[^a-z0-9]+/g,'_').replace(/^_+|_+$/g,'')||null;
  }
  // the game's ModelManager (Minecraft.renderItem -> itemModelMesher -> modelManager)
  function niManager(){var r=HEN&&HEN.u1,w=r&&r.wb;return w&&w.M8||null;}
  // a baked model from the loaded packs, or null when no pack has it
  function niGet(mm,key){
    var loc=new Hr();
    Ehd(loc,$rt_str('minecraft:item/thunder/'+key),$rt_str('inventory'));
    var m=D8D(mm,loc);
    return m!==null&&m!==mm.WL?m:null;
  }
  function niModel(mm,name,hand){
    if(mm.dhm!==NI.reg){NI.reg=mm.dhm;NI.cache={};}          // models were reloaded
    var ck=(hand?'h':'g')+name,r=NI.cache[ck];
    if(r!==undefined)return r;
    r=null;
    var key=niKey(name);
    if(key){
      if(hand)r=niGet(mm,key+'_in_hand');
      if(!r)r=niGet(mm,key);
    }
    NI.cache[ck]=r;
    return r;
  }
  // a stack worth a look: not empty, with a tag and a custom name
  function niNamed(st){return st!==null&&!st.bg2&&st.bU!==null&&!!FWd(st);}

  // RenderItem.getItemModelWithOverrides(stack, world, entity): world and entity are both set
  // only when an item is drawn in a hand
  var origEAO=EAO;
  EAO=function(a,b,c,d){
    if(S.newItems&&!$rt_resuming()){
      try{
        var mm=a.wb&&a.wb.M8;
        if(mm&&niNamed(b)){
          var m=niModel(mm,$rt_ustr(EJu(b)),c!==null&&d!==null);
          if(m)return m;
        }
      }catch(e){report(e);}
    }
    return origEAO(a,b,c,d);
  };

  // Worn armor: renderArmorLayer looks up the piece in the slot, then asks getArmorResource for
  // its texture; the piece is remembered in between.
  var origDY=D$Y;
  D$Y=function(a,b,c,d,e,f,g,h,i,j){
    if(!$rt_resuming()){
      NI.armor=null;
      if(S.newItems&&b&&j){try{var st=b.yE(j);if(niNamed(st))NI.armor=st;}catch(x){report(x);}}
    }
    origDY(a,b,c,d,e,f,g,h,i,j);
    if(!$rt_suspending())NI.armor=null;
  };
  function niArmorTexture(st,legs){
    var name=$rt_ustr(EJu(st)),key=niKey(name),m=key&&/^([a-z]+)_(helmet|chestplate|leggings|boots)$/.exec(key),mat,mm;
    if(m)mat=NI_ARMOR[m[1]];
    else if(key==='turtle_shell')mat='turtle';
    if(!mat||!(mm=niManager())||!niModel(mm,name,false))return null;   // that pack is not loaded
    var path='textures/models/armor/'+mat+'_layer_'+(legs?2:1)+'.png',r=NI.res[path];
    if(!r){r=new Bb();Gp7(r,$rt_str(path));NI.res[path]=r;}
    return r;
  }
  var origCVz=CVz;
  CVz=function(a,b,c,d){
    if(NI.armor!==null&&d===null&&!$rt_resuming()){
      try{var r=niArmorTexture(NI.armor,!!c);if(r)return r;}catch(e){report(e);}
    }
    return origCVz(a,b,c,d);
  };

  TC.items={key:niKey,cached:function(){var o={},k;for(k in NI.cache)o[k]=!!NI.cache[k];return o;}};
  MODULES.push({cat:'visual',id:'newItems',name:'Newer Items on Servers',
    desc:'Maces, spears, wind charges, netherite gear and other items from newer versions show with their real textures on servers that send them renamed (such as "1.21.11 Netherite Spear"). Needs the Thunder 1.21.11 pack.'});
