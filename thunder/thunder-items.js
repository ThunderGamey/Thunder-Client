  /* -------------------------------------------------------------------------------------------
     Part of Thunder Client, created and owned by Jayvardhan Ginni (ThunderGamey).
     Newer items on servers: maces, spears, wind charges, netherite gear and everything else added
     after 1.12. Included into the client scope of thunder-client.js by build.js.

     A newer server (through ViaVersion / ViaBackwards) sends a 1.12 client every item 1.12 does not
     have as an old item. It tells which one in two ways, and either is enough:
     - the name "<version> <Name>", for example "1.21.11 Netherite Spear" or "1.21 Mace" (only when
       the server did not give the item a name of its own; "vb.item.<id>" is read too);
     - the tag "VB|Protocol<newer>To<older>|id" with the item's number in the newer version, which
       thunder-items-data.js (made by thunder/packs/item_ids.py) turns back into the item.
     When the resource packs have the model item/thunder/<English name in lower_case_words> (the
     Thunder 1.21.11 pack has one for every item added since 1.12), that model is drawn instead of
     the old item: in the hotbar and inventories, in the hand, on the ground and on other players.
     While held, <...>_in_hand is used when it exists (the long spear models). Worn netherite, copper
     and turtle armor is drawn with the pack's own armor textures, but only while that pack's models
     are loaded. Everything else, and everything with the setting off, is left to the game.

     Game functions this module replaces (each wrapper falls through to the original):
     @hook EAO net.minecraft.client.renderer.RenderItem.getItemModelWithOverrides
     @hook D$Y net.minecraft.client.renderer.entity.layers.LayerArmorBase.renderArmorLayer
     @hook CVz net.minecraft.client.renderer.entity.layers.LayerArmorBase.getArmorResource

     Game functions, classes and fields it uses:
     @use D8D net.minecraft.client.renderer.block.model.ModelManager.getModel
     @use Ehd net.minecraft.client.renderer.block.model.ModelResourceLocation.<init>
     @use Gp7 net.minecraft.util.ResourceLocation.<init>
     @use FWd net.minecraft.item.ItemStack.hasDisplayName
     @use DaM net.minecraft.nbt.NBTTagCompound.hasKey
     @use DcF net.minecraft.nbt.NBTTagCompound.getInteger
     @class Hr net.minecraft.client.renderer.block.model.ModelResourceLocation
     @class Bb net.minecraft.util.ResourceLocation
     @field u1 net.minecraft.client.Minecraft.getRenderItem Minecraft.renderItem
     @field wb net.minecraft.client.renderer.RenderItem.getItemModelWithOverrides RenderItem.itemModelMesher
     @field M8 net.minecraft.client.renderer.RenderItem.getItemModelWithOverrides ItemModelMesher.modelManager
     @field WL net.minecraft.client.renderer.block.model.ModelManager.getModel ModelManager.defaultModel (the missing model)
     @field dhm net.minecraft.client.renderer.block.model.ModelManager.getModel ModelManager.modelRegistry
     @field bg2 net.minecraft.item.ItemStack.hasTagCompound ItemStack.isEmpty
     @field bU net.minecraft.item.ItemStack.hasTagCompound ItemStack.stackTagCompound
     (ItemStack.getDisplayName EJu, EntityLivingBase.getItemStackFromSlot yE and Minecraft.player v
     are declared in thunder-client.js, the Minecraft instance HEN in thunder-lan.js.)
     ------------------------------------------------------------------------------------------- */
  var NI={reg:null,cache:{},armor:null,res:{},seen:(typeof WeakMap==='function'?new WeakMap():null),jtags:null,last:null};
  var NI_ARMOR={netherite:'netherite',copper:'copper'};
  // "1.21.11 Netherite Spear" -> "netherite_spear" (the same rule as build_packs.py model_key);
  // "vb.item.netherite_spear" -> its model name; null for any other name
  function niKey(name){
    var t=String(name).replace(/\u00a7./g,'').replace(/^\s+|\s+$/g,''),m;
    if((m=/^vb\.item\.([a-z0-9_]+)$/.exec(t)))return NI_KEYS[m[1]]||m[1];
    m=/^\d+\.\d+(?:\.\d+)?\s+(.+)$/.exec(t);
    if(!m)return null;
    return m[1].toLowerCase().replace(/[^a-z0-9]+/g,'_').replace(/^_+|_+$/g,'')||null;
  }
  // the model name from ViaBackwards' id tag, or null
  function niTagKey(tag){
    var i,id,iid;
    if(!NI.jtags){NI.jtags=[];for(i=0;i<NI_TAGS.length;i++)NI.jtags.push($rt_str(NI_TAGS[i][0]));}
    for(i=0;i<NI_TAGS.length;i++){
      if(!DaM(tag,NI.jtags[i]))continue;
      id=DcF(tag,NI.jtags[i]);iid=NI_TAGS[i][1][id];
      if(iid)return NI_KEYS[iid]||iid;
    }
    return null;
  }
  // which newer item a stack with a tag is: {key, how ('name' or 'id'), name} or null. Remembered per
  // tag object, since the answer only changes with the tag.
  function niIdentify(st){
    var tag=st.bU,r=NI.seen?NI.seen.get(tag):undefined;
    if(r!==undefined)return r;
    var name=FWd(st)?$rt_ustr(EJu(st)):null,key=name!==null?niKey(name):null,how='name';
    if(!key){key=niTagKey(tag);how='id';}
    r=key?{key:key,how:how,name:name}:null;
    if(NI.seen)NI.seen.set(tag,r);
    return r;
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
  function niModel(mm,key,hand){
    if(mm.dhm!==NI.reg){NI.reg=mm.dhm;NI.cache={};}          // models were reloaded
    var ck=(hand?'h':'g')+key,r=NI.cache[ck];
    if(r!==undefined)return r;
    r=null;
    if(hand)r=niGet(mm,key+'_in_hand');
    if(!r)r=niGet(mm,key);
    NI.cache[ck]=r;
    return r;
  }
  // a stack worth a look: not empty, with a tag
  function niTagged(st){return st!==null&&!st.bg2&&st.bU!==null;}

  // RenderItem.getItemModelWithOverrides(stack, world, entity): world and entity are both set
  // only when an item is drawn in a hand
  var origEAO=EAO;
  EAO=function(a,b,c,d){
    if(S.newItems&&!$rt_resuming()){
      try{
        var mm=a.wb&&a.wb.M8,hand=c!==null&&d!==null;
        if(mm&&niTagged(b)){
          var it=niIdentify(b),m=it?niModel(mm,it.key,hand):null;
          if(hand&&d===HEN.v)NI.last={name:it?it.name:(FWd(b)?$rt_ustr(EJu(b)):null),key:it&&it.key,how:it&&it.how,ok:!!m};
          if(m)return m;
        }else if(hand&&d===HEN.v)NI.last=null;
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
      if(S.newItems&&b&&j){try{var st=b.yE(j);if(niTagged(st))NI.armor=st;}catch(x){report(x);}}
    }
    origDY(a,b,c,d,e,f,g,h,i,j);
    if(!$rt_suspending())NI.armor=null;
  };
  function niArmorTexture(st,legs){
    var it=niIdentify(st),key=it&&it.key,m=key&&/^([a-z]+)_(helmet|chestplate|leggings|boots)$/.exec(key),mat,mm;
    if(m)mat=NI_ARMOR[m[1]];
    else if(key==='turtle_shell')mat='turtle';
    if(!mat||!(mm=niManager())||!niModel(mm,key,false))return null;   // that pack is not loaded
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

  // what the item in your hand was last seen as, in words (Right Shift > Visual card)
  function niLastText(){
    var l=NI.last;
    if(!S.newItems)return 'The setting is off.';
    if(!HEN||!HEN.v)return 'Join a server, hold the item, then open this again.';
    if(!l)return 'Nothing from a newer version in your hand right now.';
    var what='"'+(l.name||'(no name)')+'"';
    if(!l.key)return 'In your hand: '+what+'. It is not a newer item (no version name or ViaBackwards tag).';
    var via=l.how==='id'?'its ViaBackwards tag':'its name';
    return l.ok?'In your hand: '+what+', shown as '+l.key.replace(/_/g,' ')+' (found by '+via+').':
      'In your hand: '+what+' is '+l.key.replace(/_/g,' ')+' (found by '+via+'), but no pack has its model: switch on Thunder 1.21.11 in Options > Resource Packs.';
  }
  TC.items={key:niKey,last:function(){return NI.last;},lastText:niLastText,
    cached:function(){var o={},k;for(k in NI.cache)o[k]=!!NI.cache[k];return o;}};
  MODULES.push({cat:'visual',id:'newItems',special:'newitems',name:'Newer Items on Servers',
    desc:'Maces, spears, wind charges, netherite gear and other items from newer versions show with their real textures on servers (they arrive as old items named like "1.21.11 Netherite Spear"). Needs the Thunder 1.21.11 pack.'});
  SPECIALS.newitems=function(box){
    var n=el('div','tcm-note',niLastText());
    box.appendChild(n);
    var row=el('div','tcm-actions'),b=el('button','tcm-btn','Check the item in my hand');b.type='button';
    b.addEventListener('click',function(){n.textContent=niLastText();});
    row.appendChild(b);box.appendChild(row);
  };
