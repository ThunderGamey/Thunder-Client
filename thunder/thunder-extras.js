  /* -------------------------------------------------------------------------------------------
     Part of Thunder Client, created and owned by Jayvardhan Ginni (ThunderGamey).
     Extras. Included into the client scope of thunder-client.js by build.js.
     - Shulker Preview (Utility): hovering a shulker box in any inventory shows its 27 slots, with
       the real items and counts, in a Thunder panel under its tooltip; no need to place and open it.
     - Boat View 360 (Movement): in a boat you can look all the way around; the game normally
       stops your view 105 degrees to either side of the boat.

     Game functions this module replaces:
     @hook FUA net.minecraft.entity.item.EntityBoat.applyYawToEntity
     @hook EZV net.minecraft.client.gui.GuiScreen.renderToolTip
     @virtual dIm net.minecraft.client.gui.GuiScreen renderToolTip

     Game functions, classes and fields it uses:
     @use FUK net.minecraft.client.gui.GuiScreen.func_191927_a (getItemToolTip)
     @use GJz net.minecraft.inventory.ItemStackHelper.func_191283_b
     @use GZ2 net.minecraft.util.NonNullList.func_191197_a
     @use DA net.minecraft.util.NonNullList.get
     @use E$k net.minecraft.nbt.NBTTagCompound.getCompoundTag
     @class NR net.minecraft.item.ItemShulkerBox
     @field hr net.minecraft.client.gui.GuiScreen.drawHoveringText GuiScreen.itemRender
     @field q net.minecraft.client.gui.GuiScreen.drawHoveringText GuiScreen.width
     @field L net.minecraft.client.gui.GuiScreen.drawHoveringText GuiScreen.height
     (GuiScreen CO and fontRenderer J, ItemStack.EMPTY HHk, getItem C51, isEmpty CCI, the list
     helpers EH / Bm and FontRenderer.getStringWidth CC are declared in the other modules.)
     ------------------------------------------------------------------------------------------- */
  // ---- Boat View 360 ---------------------------------------------------------------------------
  // EntityBoat.applyYawToEntity(boat, rider) turns the rider's body with the boat and clamps the
  // rider's view to 105 degrees either side; for you, only the body part is kept
  var origFUA=FUA;
  FUA=function(a,b){
    if(S.boat360&&!$rt_resuming()&&HEN&&b===HEN.v){
      try{b.cnp(a.C);}catch(e){report(e);}
      return;
    }
    return origFUA(a,b);
  };

  // ---- Shulker Preview -------------------------------------------------------------------------
  var SP={cache:(typeof WeakMap==='function'?new WeakMap():null),shown:0};
  // the 27 stacks inside a shulker box item (read with the game's own ItemStackHelper, like the
  // block does when it is placed), or null for anything else. Remembered per item tag.
  function spItems(st){
    if(st===null||CCI(st)||!(C51(st) instanceof NR))return null;
    var tag=st.bU;
    if(tag===null)return [];
    var hit=SP.cache?SP.cache.get(tag):undefined;
    if(hit!==undefined)return hit;
    var list=GZ2(27,HHk),out=[];
    GJz(E$k(tag,$rt_str('BlockEntityTag')),list);
    for(var i=0;i<27;i++){var s=DA(list,i);out.push(s!==null&&!CCI(s)?s:null);}
    if(SP.cache)SP.cache.set(tag,out);
    return out;
  }
  // queues the panel under the tooltip GuiScreen.drawHoveringText just drew (same size rules)
  function spOps(gui,st,mx,my){
    var items=spItems(st);
    if(!items)return false;
    var font=gui.J,lines=FUK(gui,st),n=lines?EH(lines):0,w=0,i;
    for(i=0;i<n;i++)w=Math.max(w,CC(font,Bm(lines,i)));
    var tx=mx+12,ty=my-12,th=8+(n>1?2+(n-1)*10:0);
    if(tx+w>gui.q)tx=tx-28-w;
    if(ty+th+6>gui.L)ty=gui.L-th-6;
    var pw=9*18+6,ph=3*18+6,px=Math.max(2,Math.min(tx-3,gui.q-pw-2)),py=ty+th+7;
    if(py+ph>gui.L-2)py=Math.max(2,ty-4-3-ph);
    SP.shown++;
    opPush();op(DPm,0.0,0.0,400.0);
    rect(px,py,px+pw,py+ph,0xF0080E16|0);
    rect(px,py,px+pw,py+1,0xFF3A8BB8|0);rect(px,py+ph-1,px+pw,py+ph,0xFF3A8BB8|0);
    rect(px,py+1,px+1,py+ph-1,0xFF3A8BB8|0);rect(px+pw-1,py+1,px+pw,py+ph-1,0xFF3A8BB8|0);
    for(i=0;i<27;i++){
      var sx=px+3+(i%9)*18,sy=py+3+((i/9)|0)*18;
      rect(sx,sy,sx+18,sy+18,0x33000000|0);
      rect(sx+1,sy+1,sx+17,sy+17,0x2A4FD1FF|0);
    }
    itemsBegin();
    for(i=0;i<27;i++){
      if(!items[i])continue;
      var ix=px+4+(i%9)*18,iy=py+4+((i/9)|0)*18;
      op(FkK,gui.hr,HEN.v,items[i],ix,iy);
      op(F8l,gui.hr,font,items[i],ix,iy);
    }
    itemsEnd();
    opPop();
    return true;
  }
  // GuiScreen.renderToolTip(gui, stack, x, y). Most screens call it through the class's
  // prototype slot (which holds the original), the creative inventory calls it by name, so the
  // function is wrapped and the prototype slot pointed at the wrapper. The vanilla tooltip draws
  // first; the panel's draw list then runs like the HUD's (TeaVM-resumable).
  var origEZV=EZV;
  EZV=function(a,b,c,d){
    var st=0,list=null,i=0,t;
    if($rt_resuming()){t=$rt_nativeThread();i=t.pop();list=t.pop();st=t.pop();}
    if(st===0){
      origEZV(a,b,c,d);
      if($rt_suspending()){$rt_nativeThread().push(0,null,0);return;}
      list=null;
      if(S.shulkerPreview&&HEN&&HEN.v){
        ops=[];opDepth=0;
        try{if(spOps(a,b,c,d))list=ops;}catch(e){report(e);list=null;}
        ops=null;
      }
      i=0;
    }
    if(list){
      try{i=runOps(list,i);}
      catch(e){report(e);i=-1;unwindOps();}
      if(i>=0){$rt_nativeThread().push(1,list,i);return;}
    }
  };
  CO.prototype.dIm=function(b,c,d){return EZV(this,b,c,d);};
  TC.extras={shulker:function(){return SP.shown;}};
  MODULES.push(
    {cat:'utility',id:'shulkerPreview',name:'Shulker Preview',
      desc:'Hover a shulker box in any inventory to see all 27 slots, with the real items and counts, under its tooltip. No need to place it and open it.'},
    {cat:'movement',id:'boat360',name:'Boat View 360',
      desc:'In a boat you can look all the way around. Normally the game stops your view 105 degrees to either side.'});
