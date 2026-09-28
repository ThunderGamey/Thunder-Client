  /* -------------------------------------------------------------------------------------------
     Part of Thunder Client, created and owned by Jayvardhan Ginni (ThunderGamey).
     Weapons (Right Shift > Combat). Included into the client scope of thunder-client.js by build.js.

     - Spears like 1.21.11. On a 1.21.11 (or newer) server, spears reach this 1.12 client through
       ViaBackwards as swords, and two things of theirs never happen:
       * The jab. A 1.21.11 client does not send a normal hit with a spear; it sends the "stab"
         player action (ServerboundPlayerActionPacket STAB, id 7), and the server finds every
         mob and player in the spear's reach (2 to 4.5 blocks, hitboxes 0.125 bigger) and stabs
         them all. A 1.12 client only sends a hit on what is under its crosshair within 3 blocks,
         so the spear only worked when you aimed right at someone up close. Here a left click with
         a spear sends that same stab action (only when the spear is fully charged, as in 1.21.11,
         whose server refuses anything less), plays the swing, and never breaks blocks.
       * The charge. Holding right-click makes the server charge the spear (it deals the damage
         itself, from your speed), but a 1.12 client never says when you let go, so the server
         kept the first charge running and never started a new one. Here letting go (or changing
         slot, or opening a screen) sends "release use item", like 1.21.11 does, and holding the
         button does not restart the charge. A small meter under the crosshair shows the charge
         stage (engaged, tired, disengaged) and your speed; the spear points forward while charged.
       Only items the server marked as spears (ViaBackwards' version name or id tag) count, and
       only on servers, never in singleplayer or a friend's world, which are 1.12 and would not
       know the stab action.
       The numbers are the 1.21.11 item components: cooldown ticks = 20 / attack speed, and the
       charge delay and stage lengths from minecraft:kinetic_weapon.
     - Crystal Tap. With end crystals in your main hand, a left click on obsidian or bedrock
       places a crystal (what a right click does), and a left click on a crystal breaks it, as
       always. One click, one action. Right-click, eating and everything else are unchanged, and
       holding left-click on obsidian does not start mining it.

     Game functions this module replaces (each wrapper calls the original for everything else):
     @hook Cfp net.minecraft.client.Minecraft.clickMouse
     @hook F$u net.minecraft.client.Minecraft.rightClickMouse
     @hook FhI net.minecraft.client.Minecraft.sendClickBlockToController
     @hook DOi net.minecraft.entity.player.EntityPlayer.getCooledAttackStrength

     Game functions, classes and fields it uses:
     @use W1 net.minecraft.network.play.client.CPacketPlayerDigging.<init>
     @use EKv net.minecraft.network.play.client.CPacketPlayerDigging$Action.<init>
     @use Fsf net.minecraft.client.network.NetHandlerPlayClient.sendPacket
     @use GgR net.minecraft.client.multiplayer.PlayerControllerMP.syncCurrentPlayItem
     @use EQX net.minecraft.entity.player.EntityPlayer.resetCooldown
     @use CDf net.minecraft.entity.EntityLivingBase.swingArm
     @use CZq net.minecraft.world.World.getBlockState
     @use DdD net.minecraft.client.Minecraft.isSingleplayer
     @use Gc7 net.lax1dude.eaglercraft.opengl.GlStateManager.rotate
     @class Q2 net.minecraft.network.play.client.CPacketPlayerDigging
     @class Us net.minecraft.network.play.client.CPacketPlayerDigging$Action
     @class BTN net.minecraft.item.ItemEndCrystal
     @static Lx$ net.minecraft.network.play.client.CPacketPlayerDigging$Action RELEASE_USE_ITEM
     @clinit S1 net.minecraft.network.play.client.CPacketPlayerDigging$Action
     @static HFu net.minecraft.util.EnumFacing DOWN
     @clinit Bw net.minecraft.util.EnumFacing
     @static HFt net.minecraft.util.math.BlockPos ORIGIN
     @static HNT net.minecraft.init.Blocks OBSIDIAN
     @static HNV net.minecraft.init.Blocks BEDROCK
     @clinit Z net.minecraft.init.Blocks
     @set HFl net.minecraft.util.EnumHand (the hands rightClickMouse goes through, EnumHand.values())
     @clinit Hc net.minecraft.util.EnumHand
     @field mh net.minecraft.client.Minecraft.sendClickBlockToController RayTraceResult.blockPos
     @field M7 net.minecraft.client.Minecraft.processKeyBinds GameSettings.keyBindUseItem
     @field jx net.minecraft.client.multiplayer.PlayerControllerMP.processRightClick PlayerControllerMP.connection
     @field gP net.minecraft.client.multiplayer.PlayerControllerMP.syncCurrentPlayItem InventoryPlayer.currentItem
     @field bC8 net.minecraft.entity.player.EntityPlayer.resetCooldown EntityLivingBase.ticksSinceLastSwing
     @field bBM net.minecraft.client.Minecraft.clickMouse EntityPlayerSP.rowingBoat
     (Minecraft fields h3 objectMouseOver, wL leftClickCounter, X world, G gameSettings, dw
     playerController, v player, cm currentScreen; KeyBinding.pressed my; RayTraceResult kD / kr;
     Enum ordinal d; InventoryPlayer bw; getItem C51; getHeldItemMainhand EZ6; EnumHand.MAIN_HAND
     HFj; EntityEnderCrystal Iz; the newer-item helpers niTagged / niIdentify and the Hit Effects
     click hfClick are declared in the other modules.)
     ------------------------------------------------------------------------------------------- */
  // 1.21.11 spear data: cd = full-charge ticks for a jab, delay = ticks before a charge can hit,
  // then the charge can dismount until dm, knock back until kb and deal damage until dg (ticks)
  var SPEARS={
    wooden_spear:{cd:13,delay:15,dm:100,kb:200,dg:300},
    stone_spear:{cd:15,delay:14,dm:90,kb:180,dg:275},
    copper_spear:{cd:17,delay:13,dm:80,kb:165,dg:250},
    iron_spear:{cd:19,delay:12,dm:50,kb:135,dg:225},
    golden_spear:{cd:19,delay:14,dm:70,kb:170,dg:275},
    diamond_spear:{cd:21,delay:10,dm:60,kb:130,dg:200},
    netherite_spear:{cd:23,delay:8,dm:50,kb:110,dg:175}};
  var WP={stab:null,using:false,t0:0,slot:-1,sp:null,stabT:0,stabDur:0,stabs:0,releases:0,taps:0,test:null,lastPacket:null};

  // the spear data of a stack the server marked as a spear, or null
  function wpSpearOf(st){
    if(!niTagged(st))return null;
    var it=niIdentify(st),sp=it&&SPEARS[it.key];
    if(!sp)return null;
    // found by its name: only a name ViaBackwards made ("1.21.11 Netherite Spear", vb.item.*),
    // never a plain "Netherite Spear", which could be any renamed sword on an old server
    if(it.how==='name'&&!/^\s*(\d+\.\d+|vb\.item\.)/.test(String(it.name||'').replace(/\u00a7./g,'')))return null;
    return sp;
  }
  // the spear in your main hand on a server, or null
  function wpSpear(){
    var mc=HEN,p=mc&&mc.v;
    if(!S.spears||!p||!mc.X)return null;
    if(WP.test)return WP.test;                         // (a test hook: pretend to hold one)
    if(DdD(mc))return null;                            // singleplayer: a 1.12 server
    return wpSpearOf(EZ6(p));
  }
  function wpStabAction(){
    if(!WP.stab){S1();WP.stab=new Us();EKv(WP.stab,$rt_str('STAB'),7);}
    return WP.stab;
  }
  // steps that send one player action packet the way PlayerControllerMP.onStoppedUsingItem does:
  // the held slot first, then CPacketPlayerDigging(action, BlockPos.ORIGIN, EnumFacing.DOWN)
  function wpActionSteps(act){
    var mc=HEN,pc=mc&&mc.dw;
    if(!pc||!pc.jx)return [];
    return [
      function(){GgR(pc);},
      function(){Bw();},
      function(){
        var p=new Q2();W1(p,act(),HFt,HFu);
        if(WP.test){WP.lastPacket=p;return;}          // test mode: build it, never send it
        Fsf(pc.jx,p);
      }
    ];
  }

  // ---- left click ------------------------------------------------------------------------------
  // what a left click does instead of the game's own, as steps (one game call each), or null
  function wpClickSteps(mc){
    if(mc.wL>0||!mc.v||mc.v.bBM)return null;
    var sp=wpSpear(),p=mc.v;
    if(sp){
      if(WP.using)return [];                           // charging: clicks do nothing, as in 1.21.11
      if(p.bC8<sp.cd)return [];                        // not fully charged: 1.21.11 does not attack
      if(S.hitEffect>0){try{hfClick(mc);}catch(e){report(e);}}
      return wpActionSteps(wpStabAction).concat([
        function(){CDf(p,HFj);},                         // the swing, only on your screen (the server swings for everyone)
        function(){EQX(p);},
        function(){WP.stabs++;WP.stabT=now();WP.stabDur=sp.cd*50;}
      ]);
    }
    if(S.crystalTap&&wpTapTarget(mc)){
      WP.taps++;
      return [function(){F$u(mc);}];                   // the game's own right click: places the crystal
    }
    return null;
  }
  // Crystal Tap: end crystals in the main hand and the crosshair on obsidian or bedrock
  function wpTapTarget(mc){
    var r=mc.h3,p=mc.v;
    if(!r||!r.kD||r.kD.d!==1||!r.mh||!mc.X)return false;
    var st=EZ6(p);
    if(!st||CCI(st)||!(C51(st) instanceof BTN))return false;
    Z();
    var b=CZq(mc.X,r.mh),blk=b&&b.n;
    return blk===HNT||blk===HNV;
  }
  var origCfp=Cfp;
  Cfp=function(a){
    var mode=0,steps=null,i=0,t;
    if($rt_resuming()){t=$rt_nativeThread();i=t.pop();steps=t.pop();mode=t.pop();}
    else{
      try{steps=wpClickSteps(a);}catch(e){report(e);steps=null;}
      if(steps)mode=2;
      else{mode=1;if(S.hitEffect>0){try{hfClick(a);}catch(e){report(e);}}}
    }
    if(mode===2){
      for(;i<steps.length;i++){
        try{steps[i]();}catch(e){report(e);return;}
        if($rt_suspending()){$rt_nativeThread().push(mode,steps,i);return;}
      }
      return;
    }
    origCfp(a);
    if($rt_suspending())$rt_nativeThread().push(mode,null,0);
  };

  // ---- holding left click: no mining with a spear, or on obsidian / bedrock with Crystal Tap ----
  var origFhI=FhI;
  FhI=function(a,b){
    if(b&&!$rt_resuming()){
      try{if(wpSpear()||(S.crystalTap&&wpTapTarget(a)))b=0;}catch(e){report(e);}
    }
    return origFhI(a,b);
  };

  // ---- right click: the spear charge -----------------------------------------------------------
  // With a spear the game goes through the main hand only: in 1.21.11 the spear always takes the
  // click, so the off-hand item (a shield, a golden apple) is never used by it. rightClickMouse
  // reads the list of hands once, when it starts, so the list is swapped only for that moment.
  var wpMainOnly=null;
  function wpMainHandOnly(){
    Hc();
    if(!wpMainOnly){wpMainOnly=Object.create(Object.getPrototypeOf(HFl));for(var k in HFl)if(Object.prototype.hasOwnProperty.call(HFl,k))wpMainOnly[k]=HFl[k];wpMainOnly.data=[HFj];}
    return wpMainOnly;
  }
  var origFu=F$u;
  F$u=function(a){
    var st=0,t,hands=null;
    if($rt_resuming()){t=$rt_nativeThread();st=t.pop();}
    else{
      if(WP.using)return;                              // held: the charge keeps going, it is not started again
      st=1;
      try{if(wpSpear()){st=2;hands=HFl;HFl=wpMainHandOnly();}}catch(e){report(e);}
    }
    try{origFu(a);}
    finally{if(hands)HFl=hands;}
    if($rt_suspending()){$rt_nativeThread().push(st);return;}
    if(st===2){
      try{
        var sp=wpSpear();
        if(sp&&a.G&&a.G.M7&&a.G.M7.my){WP.using=true;WP.t0=now();WP.slot=a.v.bw.gP;WP.sp=sp;}
      }catch(e){report(e);}
    }
  };
  // letting go of the button (or changing slot, opening a screen, leaving): release use item
  frameTasks.push(function(){
    if(!WP.using)return;
    var mc=HEN,keep=false;
    try{keep=!!(mc&&mc.v&&mc.X&&mc.cm===null&&mc.G.M7.my&&mc.v.bw.gP===WP.slot&&wpSpear());}catch(_){}
    if(keep)return;
    WP.using=false;WP.sp=null;
    if(mc&&mc.v&&mc.X&&mc.dw){WP.releases++;runOnGame(wpActionSteps(function(){S1();return Lx$;}));}
  });

  // ---- the attack indicator and the lowered hand follow the spear's real cooldown ---------------
  var origDOi=DOi;
  DOi=function(a,b){
    if(!$rt_resuming()&&HEN&&a===HEN.v){
      try{var sp=wpSpear();if(sp)return clamp((a.bC8+b)/sp.cd,0,1);}catch(e){report(e);}
    }
    return origDOi(a,b);
  };

  // ---- charge meter under the crosshair --------------------------------------------------------
  function wpStage(){
    var sp=WP.sp,tk=(now()-WP.t0)/50;
    if(!sp)return null;
    if(tk<sp.delay)return {name:'RAISING',col:0x9FB3C2,f:tk/sp.delay};
    if(tk<sp.dm)return {name:'ENGAGED',col:0x4FD1FF,f:1-(tk-sp.delay)/(sp.dm-sp.delay)};
    if(tk<sp.kb)return {name:'TIRED',col:0xFFD84A,f:1-(tk-sp.dm)/(sp.kb-sp.dm)};
    if(tk<sp.dg)return {name:'DISENGAGED',col:0xFF9A3C,f:1-(tk-sp.kb)/(sp.dg-sp.kb)};
    return {name:'SPENT',col:0x7F8A94,f:0};
  }
  function spearHud(ctx){
    if(!WP.using||!S.spearHud)return;
    var gs=ctx.mc.G;
    if(!gs||gs.lu!==0)return;
    var s=wpStage();if(!s)return;
    var w=44,x=ctx.cx-(w/2|0),y=((ctx.h/2)|0)+12,fw=Math.round((w-2)*clamp(s.f,0,1));
    rect(x,y,x+w,y+4,0xB0060B12|0);
    rect(x+1,y+1,x+1+fw,y+3,(0xFF000000|s.col)|0);
    var fast=speed>=4.6,label=s.name+'  '+fmt1(speed)+' b/s';
    opPush();op(DPm,ctx.cx,y+6,0);op(FWK,0.5,0.5,1);
    text(ctx.font,label,-(CC(ctx.font,$rt_str(label))/2|0),0,fast&&s.name!=='SPENT'&&s.name!=='RAISING'?s.col:0xC8D2DA);
    opPop();
  }

  // ---- the spear in first person: pointed forward while charging, a thrust for a jab ------------
  // (read by the renderItemSide wrapper in thunder-client.js for the main hand)
  function wpHandPose(){
    if(!S.spears)return null;
    if(WP.using&&WP.sp)return WP.poseTest||{rx:-60,ry:40,ty:-0.05,tz:0.05};
    if(WP.stabT&&WP.stabDur){
      // the 1.21.11 jab: the spear turns to point at the crosshair, thrusts forward fast, and eases
      // back over the rest of the cooldown
      var k=WP.stabFreeze!=null?WP.stabFreeze:(now()-WP.stabT)/WP.stabDur;
      if(k>=0&&k<1){
        var aim=k<0.1?1-Math.pow(1-k/0.1,2):k<0.45?1:Math.pow(1-(k-0.45)/0.55,2);
        var push=k<0.16?1-Math.pow(1-k/0.16,3):k<0.5?0.5+0.5*Math.cos(Math.PI*(k-0.16)/0.34):0;
        return {rx:-60*aim,ry:40*aim,ty:-0.05*aim,tz:0.05*aim-0.55*push};
      }
    }
    return null;
  }
  // the hand stays up during a jab or a charge (no dip while the long spear cooldown recovers)
  function wpSteady(){return !!(S.spears&&((WP.using&&WP.sp)||(WP.stabT&&WP.stabDur&&now()-WP.stabT<WP.stabDur)));}
  // no sword arc during a jab (the thrust above replaces it)
  function wpNoArc(){return !!(S.spears&&WP.stabT&&WP.stabDur&&now()-WP.stabT<WP.stabDur);}

  TC.weapons={state:function(){return {using:WP.using,stage:WP.using?(wpStage()||{}).name:null,stabs:WP.stabs,releases:WP.releases,taps:WP.taps,
      spear:!!wpSpear()};},
    // test hook: pretend the main hand holds this spear ('netherite_spear'), or null to stop
    test:function(k){WP.test=k&&SPEARS[k]||null;return !!WP.test;},
    lastPacket:function(){return WP.lastPacket;},
    poseTest:function(p){WP.poseTest=p||null;},
    stabFreeze:function(k){WP.stabFreeze=(k==null?null:+k);if(k!=null&&!WP.stabT){WP.stabT=now();WP.stabDur=1150;}}};
  MODULES.push(
    {cat:'combat',id:'spears',name:'Spears like 1.21.11',
      desc:'On 1.21.11 servers: left click jabs with the full spear reach (up to 4.5 blocks, no exact aim needed, every mob or player in line), right-click charges and lets go properly, and spears never mine blocks. Waits for a full charge like 1.21.11.',
      opts:[{id:'spearHud',name:'Charge meter under the crosshair'}]},
    {cat:'combat',id:'crystalTap',name:'Crystal Tap',
      desc:'With end crystals in your hand, left click on obsidian or bedrock places a crystal and left click on a crystal breaks it. One click, one action. Right-click and eating stay the same.'});
