  /* -------------------------------------------------------------------------------------------
     Part of Thunder Client, created and owned by Jayvardhan Ginni (ThunderGamey).
     Combat HUD. Included into the client scope of thunder-client.js by build.js.
     - Totem Counter (HUD): how many totems of undying you carry (inventory, hotbar and off hand):
       a totem and the number, beside the hotbar. Yellow on your last one, red with none. A
       movable HUD box like the other widgets.
     - Pickup Notifier (HUD): "+3 Iron Ingot" for a few seconds for everything you pick up, XP
       too. It reads the game's own "item collected" message, so only real pickups show (not items
       moved around the inventory or crafted). A movable HUD box.
     - Target Crosshair (Combat): aiming at a player within reach turns the crosshair red and puts
       a small lock-on frame around it (mobs too, if you want). First person only, like the
       crosshair itself; the attack cooldown indicator under it is left as it is.
     - Shield Status (Combat): the off-hand shield slot of the Shield HUD glows green while your
       shield is ready and red while an axe has disabled it, filling back up as the cooldown runs
       out. Both colours can be changed.

     Game method this module wraps (the wrapper only reads the message, then calls the original).
     It is virtual, so the class's prototype slot is wrapped:
     @virtual ce net.minecraft.network.play.server.SPacketCollectItem processPacket
     @class AXi net.minecraft.network.play.server.SPacketCollectItem

     Game functions, classes, statics and fields it uses:
     @use EwF net.minecraft.entity.player.InventoryPlayer.getStackInSlot
     @use AGx net.minecraft.entity.player.InventoryPlayer.getSizeInventory
     @use C51 net.minecraft.item.ItemStack.getItem
     @use A6j net.minecraft.world.World.getEntityByID
     @use CwV net.minecraft.entity.item.EntityItem.getEntityItem
     @use EHn net.minecraft.util.CooldownTracker.getCooldown
     @use Cqz net.minecraft.util.CooldownTracker.setCooldown
     @class GC net.minecraft.entity.item.EntityItem
     @class Jn net.minecraft.entity.item.EntityXPOrb
     @class Cb net.minecraft.entity.player.EntityPlayer
     @static HHQ net.minecraft.init.Items TOTEM_OF_UNDYING
     @static HIU net.minecraft.init.Items SHIELD
     @static H3o net.minecraft.client.gui.Gui ICONS (textures/gui/icons.png)
     @field bNf net.minecraft.network.play.server.SPacketCollectItem.processPacket SPacketCollectItem.collectedItemEntityId
     @field b5D net.minecraft.network.play.server.SPacketCollectItem.processPacket SPacketCollectItem.entityId (who picked it up)
     @field cnP net.minecraft.network.play.server.SPacketCollectItem.processPacket SPacketCollectItem.collectedQuantity
     @field bk net.minecraft.network.play.server.SPacketCollectItem.processPacket NetHandlerPlayClient.world
     @field cu net.minecraft.entity.Entity.getEntityId Entity.entityId
     @field TA net.minecraft.entity.item.EntityXPOrb.<init> EntityXPOrb.xpValue
     @field bw net.minecraft.entity.player.EntityPlayer.getItemStackFromSlot EntityPlayer.inventory
     @field w0 net.minecraft.entity.player.EntityPlayer.getCooldownTracker EntityPlayer.cooldownTracker
     @field Ph net.minecraft.client.gui.GuiIngame.renderAttackIndicator GameSettings.showDebugInfo
     (EntityLivingBase Co, ItemStack getCount CRD / isEmpty CCI / getDisplayName EJu, the draw-list helpers and the HUD
     widget list are declared in thunder-client.js and thunder-hud.js.)
     ------------------------------------------------------------------------------------------- */
  // colour choices for Shield Status (names shown in the menu)
  var CB_COLORS=[['Green',0x55FF55],['Lime',0xA8FF3E],['Cyan',0x55E8FF],['Blue',0x4F8BFF],['Purple',0xB06BFF],
    ['Pink',0xFF6BD5],['Red',0xFF4040],['Orange',0xFF9A2E],['Yellow',0xFFE04A],['White',0xFFFFFF]];
  function cbColor(i,def){var c=CB_COLORS[i|0];return c?c[1]:def;}

  // ---- Totem Counter ---------------------------------------------------------------------------
  // every totem in the player's inventory (main, armor and off-hand slots)
  function cbTotems(player){
    var inv=player.bw,n=0,first=null,i,st,size;
    if(!inv||!HHQ)return {n:0,stack:null};
    size=AGx(inv);
    for(i=0;i<size;i++){
      st=EwF(inv,i);
      if(st===null||CCI(st)||C51(st)!==HHQ)continue;
      n+=CRD(st);
      if(!first)first=st;
    }
    return {n:n,stack:first};
  }
  hudExtra({id:'totemCount',name:'Totem Counter',col:3,
    content:function(ctx){
      var t=cbTotems(ctx.player);
      if(!t.n&&!hudEditing&&!S.totemShowZero)return null;
      return {n:t.n,stack:t.stack};
    },
    size:function(ctx,c,themed){
      var tw=textWidth(ctx.font,c.stack?String(c.n):'Totems '+c.n);
      return themed?{w:(c.stack?20:4)+tw+4,h:18}:{w:(c.stack?18:0)+tw,h:16};
    },
    draw:function(ctx,c,themed,sz){
      if(themed)hudBox(0,0,sz.w,sz.h);
      var o=themed?1:0,col=c.n>1?0xFFFFFF:c.n===1?0xFFE04A:0xFF5555;
      if(c.stack){itemsBegin();op(FkK,ctx.ri,ctx.player,c.stack,o+1,o);itemsEnd();}
      text(ctx.font,c.stack?String(c.n):'Totems '+c.n,(c.stack?18:0)+(themed?2+o:0),themed?5:4,col);
    }});

  // ---- Pickup Notifier -------------------------------------------------------------------------
  var CB_PICK={rows:[],seen:0};
  var CB_PICK_MS=3500,CB_PICK_MAX=5;
  // SPacketCollectItem.processPacket(handler): read who picked up what before the game removes it
  // (the fields below are read in its compiled body, D$u)
  function cbCollect(pk,h){
    var p=HEN&&HEN.v,w=h&&h.bk;
    if(!p||!w||pk.b5D!==p.cu)return;
    var e=A6j(w,pk.bNf),t=now(),row=null,last=CB_PICK.rows[CB_PICK.rows.length-1];
    if(e instanceof GC){
      var st=CwV(e);
      if(st===null||CCI(st))return;
      var name=$rt_ustr(EJu(st)),n=pk.cnP|0;
      if(n<=0)n=CRD(st);
      if(last&&last.name===name&&last.xp===false&&t-last.t<1500){last.n+=n;last.t=t;return;}
      row={stack:st,name:name,n:n,xp:false,t:t};
    }else if(e instanceof Jn){
      var v=e.TA|0;
      if(v<=0)return;
      if(last&&last.xp&&t-last.t<1500){last.n+=v;last.t=t;return;}
      row={stack:null,name:'XP',n:v,xp:true,t:t};
    }
    if(!row)return;
    CB_PICK.seen++;
    CB_PICK.rows.push(row);
    if(CB_PICK.rows.length>CB_PICK_MAX)CB_PICK.rows.shift();
  }
  var cbCollectProto=AXi.prototype,cbOrigProcess=cbCollectProto.ce;
  cbCollectProto.ce=function(b){
    if(S.pickups&&!$rt_resuming()){try{cbCollect(this,b);}catch(e){report(e);}}
    return cbOrigProcess.call(this,b);
  };
  function cbPickLine(r){return '+'+r.n+' '+(r.xp?'XP':r.name);}
  hudExtra({id:'pickups',name:'Pickup Notifier',col:4,
    content:function(ctx){
      var t=now(),rows=[],i,r;
      CB_PICK.rows=CB_PICK.rows.filter(function(x){return t-x.t<CB_PICK_MS;});
      for(i=0;i<CB_PICK.rows.length;i++){
        r=CB_PICK.rows[i];
        var left=CB_PICK_MS-(t-r.t),a=left<700?Math.max(0.1,left/700):1;
        rows.push({stack:r.stack,text:cbPickLine(r),color:r.xp?0x7FFF3E:0xFFFFFF,a:a});
      }
      if(!rows.length&&hudEditing)rows.push({stack:null,text:'+3 Iron Ingot',color:0xFFFFFF,a:1});
      return rows.length?{rows:rows}:null;
    },
    size:function(ctx,c,themed){
      var w=0,i;
      for(i=0;i<c.rows.length;i++)w=Math.max(w,18+textWidth(ctx.font,c.rows[i].text));
      return {w:w+(themed?6:0),h:c.rows.length*17+(themed?3:0)};
    },
    draw:function(ctx,c,themed,sz){
      if(themed)hudBox(0,0,sz.w,sz.h);
      var o=themed?2:0,i,r,any=false;
      for(i=0;i<c.rows.length;i++)if(c.rows[i].stack)any=true;
      if(any){
        itemsBegin();
        for(i=0;i<c.rows.length;i++){r=c.rows[i];if(r.stack)op(FkK,ctx.ri,ctx.player,r.stack,o+1,o+1+i*17);}
        itemsEnd();
      }
      for(i=0;i<c.rows.length;i++){
        r=c.rows[i];
        var al=Math.max(8,Math.round(255*r.a));
        text(ctx.font,r.text,o+19,o+5+i*17,(al<<24)|(r.color&0xFFFFFF));
      }
    }});
  TC.pickups={rows:function(){return CB_PICK.rows.map(function(r){return cbPickLine(r);});},count:function(){return CB_PICK.seen;}};

  // ---- Target Crosshair ------------------------------------------------------------------------
  // what the crosshair is on: a player (or, with the option, any mob) within reach
  function cbTarget(mc){
    var r=mc.h3,e=r&&r.kD&&r.kD.d===2?r.kr:null;
    if(!e)return null;
    if(e instanceof Cb)return e;
    return S.crossMobs&&e instanceof Co?e:null;
  }
  var CB_CROSS={shown:0};
  function crossHud(ctx){
    var mc=ctx.mc,gs=mc.G;
    if(!gs||gs.lu!==0||gs.Ph||YZ(mc.dw))return;                 // where the game draws no crosshair either
    if(!cbTarget(mc))return;
    CB_CROSS.shown++;
    var cx=ctx.cx,cy=(ctx.h/2)|0,red=0xFF3B3B;
    // the crosshair itself, from the same texture and spot the game uses, drawn over it in red
    op(D17,ctx.tm,H3o);
    op(CyN);op(B$o,770,771,1,0);
    op(CFi,1.0,0.23,0.23,1.0);
    blit(ctx,cx-7,cy-7,0,0,16,16);
    blit(ctx,cx-7,cy-7,0,0,16,16);                     // twice: soft texture edges cover fully
    op(CFi,1.0,1.0,1.0,1.0);
    // lock-on frame: four corners 11 px out from the centre
    var d=11,l=4,c=0xE0000000|red,i,sx,sy;
    for(i=0;i<4;i++){
      sx=i&1?1:-1;sy=i&2?1:-1;
      var x=cx+sx*d,y=cy+sy*d;
      rect(Math.min(x,x-sx*l),y,Math.max(x,x-sx*l)+1,y+1,c);
      rect(x,Math.min(y,y-sy*l),x+1,Math.max(y,y-sy*l)+1,c);
    }
  }

  // ---- Shield Status ---------------------------------------------------------------------------
  // 0..1 of the axe cooldown still to go on the shield in the off hand, or -1 when it is not a shield
  function cbShieldCooldown(p,st){
    if(!HIU||C51(st)!==HIU)return -1;
    var tr=p.w0;
    return tr?EHn(tr,HIU,0.0):0;
  }
  TC.combat={totems:function(){var p=HEN&&HEN.v;return p?cbTotems(p).n:-1;},crosshair:function(){return CB_CROSS.shown;},
    // for checking Shield Status: the shield cooldown an axe would give (ticks, 100 = 5 s)
    shieldCooldown:function(ticks){var p=HEN&&HEN.v;if(!p||!p.w0||!HIU)return false;runOnGame([function(){Cqz(p.w0,HIU,ticks|0);}]);return true;}};

  MODULES.push(
    {cat:'hud',id:'totemCount',name:'Totem Counter',
      desc:'How many totems of undying you carry, beside the hotbar. Yellow on your last totem, red with none. Move it in Edit HUD Layout.',
      opts:[{id:'totemShowZero',name:'Show with no totems'}]},
    {cat:'hud',id:'pickups',name:'Pickup Notifier',
      desc:'Shows "+3 Iron Ingot" for a few seconds for everything you pick up, and the XP you collect. Only real pickups count. Move it in Edit HUD Layout.'},
    {cat:'combat',id:'crossTarget',name:'Target Crosshair',
      desc:'Aiming at a player within reach turns your crosshair red and puts a small lock-on frame around it.',
      opts:[{id:'crossMobs',name:'Mobs too'}]},
    {cat:'combat',id:'shieldStatus',name:'Shield Status',
      desc:'The off-hand shield slot glows while your shield is ready and turns the other colour while an axe has disabled it, filling back up as the cooldown runs out. Needs the Shield HUD.',
      opts:[{id:'shieldReadyColor',name:'Ready colour',colors:CB_COLORS},
        {id:'shieldDownColor',name:'Disabled colour',colors:CB_COLORS}]});
