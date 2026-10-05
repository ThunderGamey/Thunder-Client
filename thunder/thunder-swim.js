/* ---------------------------------------------------------------------------------------------
   Part of Thunder Client, created and owned by Jayvardhan Ginni (ThunderGamey).
   Modern Swimming (Right Shift > Movement): swimming and crawling like 1.21.11. Included at the
   top level of thunder-client.js by build.js, so it runs both in the page and in the
   integrated-server worker (singleplayer and Friends worlds run their server there).

   What 1.21.11 does, done the same way here:
   - Sprinting (the sprint key, R in Eaglercraft, or double-tapping W, which 1.21 also allows
     underwater) with your eyes and feet in water starts swimming. You keep swimming while you
     sprint in water, even on the surface; you stop when you leave the water, or let go of W
     while not on the bottom and not holding sneak. Sprinting cannot start or last on the
     surface unless you are swimming.
   - A swimmer is 0.6 blocks tall with the eyes 0.4 up (the 1.21.11 swimming pose), so you fit
     through one-block gaps. Coming out of the water where you cannot stand up, you stay down
     and crawl at sneaking speed; a player who stops fitting where they stand (a trapdoor closed
     over them) drops to crawling too.
   - Movement (1.21.11 Player.travel and LivingEntity.travelInFluid): you rise and sink toward
     where you look, water slows you less while sprinting (0.9 instead of 0.8), gravity in water
     is 1/16 of the normal 0.08 (none while sprinting; 1.12 used 1/4), and holding sneak in
     water sinks you (0.04 a tick).
   - The animation: the body lies along where you look (flat when crawling), the arms do the
     1.21.11 stroke, the legs kick and the head tilts up. Other players swim as well; a 1.12
     client is never told another player's pose, so it is worked out from their sprinting and
     the water the way 1.21.11 decides it (a 1.21 server's swimming flag counts too).
   - The first-person camera slides to the new eye height over a few ticks instead of jumping.
   The integrated server gets the same swimming state and the same 0.6-tall box for its players,
   so singleplayer and Friends worlds accept one-block gaps. A 1.12 server does not know the
   swimming pose: if a server sets you back twice while you swim or crawl, Modern Swimming turns
   itself off for that server until you leave it (the Right Shift menu says so).

   Game functions this block replaces (each wrapper calls the original for everything else):
   @hook EMu net.minecraft.entity.player.EntityPlayer.updateSize
   @hook CNt net.minecraft.entity.player.EntityPlayer.getEyeHeight
   @hook DT5 net.minecraft.entity.Entity.handleWaterMovement
   @hook Chy net.minecraft.entity.EntityLivingBase.getWaterSlowDown
   @hook Fj1 net.minecraft.entity.player.EntityPlayer.func_191986_a
   @hook F4y net.minecraft.client.entity.EntityPlayerSP.onLivingUpdate
   @hook GuW net.minecraft.client.entity.EntityPlayerSP.setSprinting
   @hook Fvh net.minecraft.client.entity.EntityPlayerSP.isOpenBlockSpace
   @hook Eam net.minecraft.client.renderer.entity.RenderPlayer.rotateCorpse
   @hook DGY net.minecraft.client.model.ModelBiped.setRotationAngles
   @hook FJp net.minecraft.client.renderer.EntityRenderer.orientCamera
   @hook Dyj net.minecraft.network.play.server.SPacketPlayerPosLook.processPacket
   (func_191986_a is travel, rotateCorpse is applyRotations; processPacket holds the inlined
   NetHandlerPlayClient.handlePlayerPosLook. Four of them are also reached through prototype
   slots that hold the original function, so those slots are pointed at the wrappers.)

   Game functions, classes, statics and fields it uses:
   @use FES net.minecraft.entity.Entity.setSize
   @use Gqt net.minecraft.world.World.collidesWithAnyBlock
   @use ED net.minecraft.util.math.AxisAlignedBB.<init>
   @use E9Y net.minecraft.entity.Entity.isRiding
   @use EKy net.minecraft.entity.EntityLivingBase.isElytraFlying
   @use FuG net.minecraft.entity.Entity.hasNoGravity
   @use EuW net.minecraft.entity.Entity.getFlag
   @use F$h net.minecraft.block.state.BlockStateContainer$StateImplementation.isNormalCube
   @use CcN net.minecraft.entity.EntityLivingBase.isPotionActive
   @use EG6 net.minecraft.entity.EntityLivingBase.isHandActive
   @use DC9 net.minecraft.client.model.ModelBiped.getMainHand
   @use AGV net.minecraft.client.model.ModelBase.copyModelAngles
   @class DN net.minecraft.util.math.AxisAlignedBB
   @class Eg net.minecraft.entity.Entity
   @class BpK net.minecraft.client.entity.EntityPlayerSP
   @class A31 net.minecraft.network.play.server.SPacketPlayerPosLook
   @static HGR net.minecraft.block.material.Material LAVA
   @static HIX net.minecraft.init.MobEffects BLINDNESS
   @clinit Ei net.minecraft.init.MobEffects
   @field bI net.minecraft.entity.Entity.setSize Entity.width
   @field bZ net.minecraft.entity.Entity.setSize Entity.height
   @field bd net.minecraft.entity.Entity.setSize Entity.boundingBox
   @field e0 net.minecraft.entity.Entity.handleWaterMovement Entity.inWater
   @field fR net.minecraft.entity.Entity.handleWaterMovement Entity.ridingEntity
   @field kI net.minecraft.entity.player.EntityPlayer.updateSize EntityPlayer.sleeping
   @field ti net.minecraft.entity.player.EntityPlayer.onUpdate Entity.noClip
   @field bC net.minecraft.entity.player.EntityPlayer.func_191986_a EntityPlayer.capabilities
   @field mv net.minecraft.entity.player.EntityPlayer.func_191986_a PlayerCapabilities.isFlying
   @field ER net.minecraft.client.entity.EntityPlayerSP.onLivingUpdate PlayerCapabilities.allowFlying
   @field p net.minecraft.entity.player.EntityPlayer.func_191986_a Entity.motionY
   @field bP net.minecraft.entity.EntityLivingBase.func_191986_a Entity.onGround
   @field a net.minecraft.entity.EntityLivingBase.func_191986_a Entity.world
   @field O1 net.minecraft.entity.EntityLivingBase.setJumping EntityLivingBase.isJumping
   @field ct net.minecraft.util.math.AxisAlignedBB.<init> AxisAlignedBB.minX
   @field bu net.minecraft.util.math.AxisAlignedBB.<init> AxisAlignedBB.minY
   @field cz net.minecraft.util.math.AxisAlignedBB.<init> AxisAlignedBB.minZ
   @field cH net.minecraft.util.math.AxisAlignedBB.<init> AxisAlignedBB.maxX
   @field ck net.minecraft.util.math.AxisAlignedBB.<init> AxisAlignedBB.maxY
   @field cK net.minecraft.util.math.AxisAlignedBB.<init> AxisAlignedBB.maxZ
   @field mK net.minecraft.client.entity.EntityPlayerSP.onLivingUpdate EntityPlayerSP.movementInput
   @field bIV net.minecraft.client.entity.EntityPlayerSP.onLivingUpdate EntityPlayerSP.sprintToggleTimer
   @field gu net.minecraft.client.entity.EntityPlayerSP.onLivingUpdate EntityPlayerSP.mc
   @field bOI net.minecraft.client.entity.EntityPlayerSP.onLivingUpdate GameSettings.keyBindSprint
   @field ccV net.minecraft.util.MovementInputFromOptions.updatePlayerMoveState MovementInputFromOptions.forwardKeyDown
   @field chc net.minecraft.util.MovementInputFromOptions.updatePlayerMoveState MovementInputFromOptions.backKeyDown
   @field cfe net.minecraft.util.MovementInputFromOptions.updatePlayerMoveState MovementInputFromOptions.leftKeyDown
   @field cli net.minecraft.util.MovementInputFromOptions.updatePlayerMoveState MovementInputFromOptions.rightKeyDown
   @field lz net.minecraft.client.model.ModelBiped.setRotationAngles ModelBiped.bipedHead
   @field D$ net.minecraft.client.model.ModelBiped.setRotationAngles ModelBiped.bipedHeadwear
   @field gM net.minecraft.client.model.ModelBiped.setRotationAngles ModelBiped.bipedRightArm
   @field f2 net.minecraft.client.model.ModelBiped.setRotationAngles ModelBiped.bipedLeftArm
   @field mC net.minecraft.client.model.ModelBiped.setRotationAngles ModelBiped.bipedRightLeg
   @field nc net.minecraft.client.model.ModelBiped.setRotationAngles ModelBiped.bipedLeftLeg
   @field bmt net.minecraft.client.model.ModelBiped.setRotationAngles ModelBiped.isSneak
   @field v3 net.minecraft.client.model.ModelBiped.setRotationAngles ModelBase.swingProgress
   @field A net.minecraft.client.model.ModelBiped.setRotationAngles ModelRenderer.rotateAngleX
   @field bb net.minecraft.client.model.ModelBiped.setRotationAngles ModelRenderer.rotateAngleY
   @field bX net.minecraft.client.model.ModelBiped.setRotationAngles ModelRenderer.rotateAngleZ
   (Entity posX b / posY f / posZ c, rotationPitch bc / prevRotationPitch c1, Minecraft.player v,
   .world X, .gameSettings G and .renderViewEntity hI, BlockPos fields m / i / l and its class Ba
   with constructor T0, World.getBlockState CZq, StateImplementation.block n, Block.blockMaterial
   eX, Material.WATER HGM (BF), EntityPlayer Cb, EntityLivingBase Co, EntityLivingBase.isSprinting
   CBg, isInsideOfMaterial DBe, food stats FAU / ZP, EntityPlayerSP.isHandActive A4G,
   Minecraft.isSingleplayer DdD, EnumHandSide.LEFT HJu, GlStateManager rotate Gc7 / translate
   DPm, MovementInput fields s_ / Ps / U4 / td, KeyBinding.pressed my, keyBindForward bC7 and
   the Minecraft instance HEN are declared in the other modules.)
   ------------------------------------------------------------------------------------------- */
(function(){
  var G=$rt_globals;
  if(!G)return;
  var PAGE=!!G.document;
  // the game's float constants (1.12 compares sizes exactly)
  var H06=0.6000000238418579,H165=1.649999976158142,H18=1.7999999523162842,EYE=0.4000000059604645;
  var PI=Math.PI,TAU=PI*2,HALF_PI=PI/2;
  // shared with the Thunder menu (thunder-qol.js) through the global object: .setting is the
  // menu switch; .off is set for one server that sets swimmers back (until you leave it)
  var SW=G.__thunderSwim={setting:true,off:false,offWhy:'',world:null,backs:[],lastSwim:0,
    f4y:null,keep:0,noStart:0,under:0,wasFwd:0,wasSneak:0,
    cam:null,camEye:0,camFor:null,eye:0,eyeO:0,camSm:0,rEnt:null,rAmt:0,
    stats:{swims:0,crawls:0,setbacks:0,errors:0},err:null};
  function on(){return SW.setting&&!SW.off;}
  function fail(e){SW.stats.errors++;SW.err=e;}

  // ---- blocks ------------------------------------------------------------------------------
  var POS=null;
  function stateAt(w,x,y,z){
    if(!POS){POS=new Ba();T0(POS,0,0,0);}
    POS.m=Math.floor(x);POS.i=Math.floor(y);POS.l=Math.floor(z);
    return CZq(w,POS);
  }
  function matAt(w,x,y,z){var st=stateAt(w,x,y,z),b=st&&st.n;return b?b.eX:null;}
  function liquidAt(w,x,y,z){BF();var m=matAt(w,x,y,z);return m===HGM||m===HGR;}
  // would this player fit standing h tall where it is (the box updateSize checks)
  function fits(a,h){
    var e=a.bd,b=new DN();
    ED(b,e.ct,e.bu,e.cz,e.ct+H06,e.bu+h,e.cz+H06);
    return !Gqt(a.a,b);
  }

  // ---- swimming state: 1.21.11 Player.updateSwimming ---------------------------------------
  function canSwim(a){return !a.kI&&!(a.bC&&a.bC.mv)&&!E9Y(a)&&!EKy(a);}
  function updateSwimming(a,other){
    if(!canSwim(a)){a.thSw=0;return;}
    BF();
    var spr=CBg(a),inW=a.e0;
    // another player on a 1.21 server: the server's own swimming flag (bit 4)
    if(other&&inW&&EuW(a,4)){a.thSw=1;return;}
    if(a.thSw===1)a.thSw=spr&&inW?1:0;
    else a.thSw=spr&&inW&&DBe(a,HGM)&&matAt(a.a,a.b,a.f,a.c)===HGM?1:0;
  }
  // ---- pose and size: 1.21.11 Player.updatePlayerPose, at the end of every player tick ----
  // 1 = it set the size itself, 0 = the game's own updateSize runs
  function pose(a,other){
    if(a.kI||EKy(a)){a.thSp=0;return 0;}                        // sleeping, elytra: the game's
    var small=a.bZ===H06;
    if(a.thSw===1){
      if(!small){FES(a,H06,H06);SW.stats.swims++;}
      a.thSp=1;return 1;
    }
    if(a.thSp===1&&small){
      // out of the swim: stand up (or sneak) where that fits, otherwise keep crawling
      if(fits(a,a.q1()?H165:H18)){a.thSp=0;return 0;}
      return 1;
    }
    a.thSp=0;
    // a standing player who stops fitting (a trapdoor closed over them) drops to crawling;
    // not for other players, whose place is only a smoothed copy of the server's
    if(!other&&a.bZ>1&&!a.ti&&!(a.bC&&a.bC.mv)&&!E9Y(a)&&!fits(a,a.bZ)&&fits(a,H06)){
      FES(a,H06,H06);a.thSp=1;SW.stats.crawls++;return 1;
    }
    return 0;
  }
  // the swimming animation's amount, 0..1 (1.21.11 LivingEntity.updateSwimAmount)
  function amount(a){
    var v=a.thSa||0;a.thSo=v;
    a.thSa=a.thSp===1?Math.min(1,v+0.09):Math.max(0,v-0.09);
  }

  var origEMu=EMu;
  EMu=function(a){
    if(!$rt_resuming()){
      var mine=PAGE&&!!HEN&&a===HEN.v,other=PAGE&&!mine,done=0;
      try{
        if(on()){updateSwimming(a,other);done=pose(a,other);}
        else{a.thSw=0;a.thSp=0;}
        if(PAGE){amount(a);if(mine)tickMine(a);}
      }catch(e){fail(e);done=0;}
      if(done)return;
    }
    return origEMu(a);
  };

  // eyes 0.4 up in the swimming pose, also while holding sneak (1.12 gave a sneaking swimmer
  // 1.54); the first-person camera gets its smoothed height while the camera is set up
  var origCNt=CNt;
  CNt=function(a){
    if(!$rt_resuming()){
      if(SW.cam===a)return SW.camEye;
      if(a.thSp===1&&a.bZ===H06&&!a.kI)return EYE;
    }
    return origCNt(a);
  };
  Cb.prototype.hw=function(){return CNt(this);};

  // Water around a 0.6-tall player. 1.12 looks for water in the box shrunk by 0.4 at the top
  // and at the bottom, which leaves nothing of a 0.6-tall box (it missed the water at some
  // heights, so a swimmer fell out of the water physics); 1.21.11 uses the whole box. The game
  // gets a box 0.4 taller at both ends for the call, so the shrunk one is the player's own.
  var origDT5=DT5;
  DT5=function(a){
    var sv=null,r;
    if($rt_resuming())sv=$rt_nativeThread().pop();
    else if(a.thSp===1&&a.bZ===H06&&a.bd){
      sv=a.bd;var b=new DN();
      ED(b,sv.ct,sv.bu-0.4000000059604645,sv.cz,sv.cH,sv.ck+0.4000000059604645,sv.cK);
      a.bd=b;
    }
    try{r=origDT5(a);}
    finally{
      if($rt_suspending())$rt_nativeThread().push(sv);
      else if(sv)a.bd=sv;
    }
    return r;
  };
  Eg.prototype.dKX=function(){return DT5(this);};

  if(!PAGE)return;                                   // the rest is the player's own game

  // ---- the local player, once a tick ----------------------------------------------------------
  function tickMine(a){
    var w=HEN.X;
    if(w!==SW.world){SW.world=w;SW.off=false;SW.offWhy='';SW.backs=[];SW.camFor=null;}
    if(a.thSw===1||a.thSp===1)SW.lastSwim=Date.now();
    camTick(a);
  }
  // 1.21.11 Camera.tick: the eye height halves its way to the player's, each tick. Only pose
  // changes are smoothed (swimming, crawling, standing up); sneaking stays instant as in 1.12.
  function camTick(a){
    var t=CNt(a);
    if(SW.camFor!==a){SW.camFor=a;SW.eye=SW.eyeO=t;SW.camSm=0;return;}
    SW.eyeO=SW.eye;
    if(!SW.camSm&&Math.abs(t-SW.eye)>0.2)SW.camSm=1;
    if(SW.camSm){
      SW.eye+=(t-SW.eye)*0.5;
      if(Math.abs(t-SW.eye)<0.002&&Math.abs(t-SW.eyeO)<0.002){SW.eye=t;SW.camSm=0;}
    }else SW.eye=t;
  }
  function foodOk(p){return ZP(FAU(p))>6||!!(p.bC&&p.bC.ER);}
  function blind(p){Ei();return !!CcN(p,HIX);}

  // ---- input (called by the movement-input wrapper in thunder-qol.js, inside onLivingUpdate,
  // right after the keys are read and before sprinting is decided and the player moves) ----
  SW.input=function(mi,f0,s0){
    var mc=HEN,p=mc&&mc.v;
    SW.keep=0;SW.noStart=0;SW.under=0;
    SW.wasFwd=f0>=0.800000011920929?1:0;SW.wasSneak=s0?1:0;
    if(!on()||!p||SW.f4y!==p||p.mK!==mi)return;
    BF();
    var inW=!!p.e0,fly=!!(p.bC&&p.bC.mv),under=inW&&DBe(p,HGM)?1:0,swim=p.thSw===1;
    SW.under=under;
    // holding sneak in water sinks you (1.21.11 LocalPlayer.goDownInWater), not while flying
    if(inW&&mi.U4&&!fly)p.p=p.p-0.03999999910593033;
    if(swim&&inW){
      // a swimmer is not crouched, so holding sneak does not slow the stroke
      if(mi.U4){mi.s_=(mi.ccV?1:0)-(mi.chc?1:0);mi.Ps=(mi.cfe?1:0)-(mi.cli?1:0);}
      // and keeps sprinting unless it leaves the water or lets go of W off the bottom
      SW.keep=foodOk(p)&&!blind(p)&&(mi.ccV&&!mi.chc||p.bP||mi.U4)?1:0;
    }else if(p.thSp===1&&!inW&&!mi.U4){
      // crawling on land: sneaking speed, and no sprinting
      mi.s_=mi.s_*0.3;mi.Ps=mi.Ps*0.3;
    }
    // on the surface (in water, eyes above it) sprinting stops and cannot start unless swimming
    SW.noStart=inW&&!under&&!swim&&!fly?1:0;
    if(SW.noStart&&CBg(p))origGuW(p,0);
  };
  // Toggle Sprint asks this before it sprints for you
  SW.sprintOk=function(p){
    if(!on()||!p)return true;
    BF();
    return !(p.e0&&p.thSw!==1&&!(p.bC&&p.bC.mv)&&!DBe(p,HGM));
  };

  // onLivingUpdate: marks the sprint decisions below as its own, then starts a sprint with a
  // double tap of W underwater (1.21.11 allows it on the ground or underwater; 1.12 on the ground)
  var origF4y=F4y;
  F4y=function(a){
    var st=0,r,ok=false;
    if($rt_resuming())st=$rt_nativeThread().pop();
    else if(on()&&HEN&&a===HEN.v){st=1;SW.f4y=a;}
    try{r=origF4y(a);ok=true;}
    finally{
      if($rt_suspending())$rt_nativeThread().push(st);
      else if(st===1){
        SW.f4y=null;
        if(ok){try{doubleTap(a);}catch(e){fail(e);}}
        SW.keep=0;SW.noStart=0;
      }
    }
    return r;
  };
  BpK.prototype.nP=function(){return F4y(this);};
  function doubleTap(a){
    var mi=a.mK,gs=HEN&&HEN.G;
    if(!mi||a.bP||!SW.under||SW.wasSneak||SW.wasFwd||!(mi.s_>=0.800000011920929))return;
    if(CBg(a)||!foodOk(a)||A4G(a)||blind(a))return;
    if(a.bIV>0)origGuW(a,1);
    else if(!(gs&&gs.bOI&&gs.bOI.my))a.bIV=7;
  }
  // the sprint decisions inside onLivingUpdate: a swimmer keeps sprinting (1.12 would stop it
  // for touching a wall or for letting go of W on the bottom), and no sprint starts on the surface
  var origGuW=GuW;
  GuW=function(a,b){
    if(!$rt_resuming()&&SW.f4y===a){
      if(b){if(SW.noStart)return;}
      else if(SW.keep)return;
    }
    return origGuW(a,b);
  };

  // ---- movement: 1.21.11 Player.travel and LivingEntity.travelInFluid -----------------------
  var origChy=Chy;
  Chy=function(a){
    if(!$rt_resuming()&&on()&&HEN&&a===HEN.v&&CBg(a))return 0.8999999761581421;
    return origChy(a);
  };
  Co.prototype.efw=function(){return Chy(this);};

  var origFj1=Fj1;
  Fj1=function(a,b,c,d){
    var st=0,r;
    if($rt_resuming())st=$rt_nativeThread().pop();
    else if(on()&&HEN&&a===HEN.v&&!E9Y(a)){
      try{
        // a swimmer rises or sinks toward where it looks
        if(a.thSw===1){
          var ly=-Math.sin(a.bc*0.01745329238474369),k=ly<-0.2?0.085:0.06;
          if(ly<=0||a.O1||liquidAt(a.a,a.b,a.f+0.9,a.c))a.p=a.p+(ly-a.p)*k;
        }
        st=a.e0&&!(a.bC&&a.bC.mv)?2:1;              // 2: the game takes its water branch
      }catch(e){fail(e);st=1;}
    }
    try{r=origFj1(a,b,c,d);}
    finally{if($rt_suspending())$rt_nativeThread().push(st);}
    if($rt_suspending())return r;
    // 1.12 took 0.02 off for gravity in water; 1.21.11 takes 1/16 of 0.08, and none while
    // sprinting (0.3 is the climb onto a block, which comes after and stays as it is)
    if(st===2&&!FuG(a)&&a.p!==0.30000001192092896){
      a.p=a.p+0.02;
      if(!CBg(a))a.p=a.p-0.005;
    }
    return r;
  };
  Cb.prototype.bmQ=function(b,c,d){return Fj1(this,b,c,d);};

  // pushOutOfBlocks: 1.12 wants two free blocks above your feet; 1.21.11 only the space your box
  // takes, so a swimmer or crawler is not pushed out of a one-block gap
  var origFvh=Fvh;
  Fvh=function(a,b){
    if(!$rt_resuming()&&a.thSp===1&&a.bZ===H06&&a.bd&&b){
      var y0=Math.floor(a.bd.bu+1e-7),y1=Math.floor(a.bd.ck-1e-7),st;
      st=stateAt(a.a,b.m,y0,b.l);if(st&&F$h(st))return 0;
      if(y1!==y0){st=stateAt(a.a,b.m,y1,b.l);if(st&&F$h(st))return 0;}
      return 1;
    }
    return origFvh(a,b);
  };

  // ---- a server that does not accept it ---------------------------------------------------------
  // Two set-backs (the server moving you back) within 10 seconds while you swim or crawl, or
  // just after, on a server that is not this game's own: that server gets 1.12 swimming.
  var origDyj=Dyj;
  Dyj=function(a,b){
    if(!$rt_resuming()){try{setback();}catch(e){fail(e);}}
    return origDyj(a,b);
  };
  A31.prototype.ce=function(b){return Dyj(this,b);};
  function setback(){
    var mc=HEN,p=mc&&mc.v,t=Date.now(),i;
    if(!on()||!p||!mc.X||DdD(mc))return;
    if(p.thSw!==1&&p.thSp!==1&&t-SW.lastSwim>1500)return;
    SW.stats.setbacks++;
    SW.backs.push(t);
    for(i=SW.backs.length-1;i>=0;i--)if(t-SW.backs[i]>10000)SW.backs.splice(i,1);
    if(SW.backs.length>=2){
      SW.off=true;SW.offWhy='This server set you back while swimming, so it gets 1.12 swimming until you leave it.';
    }
  }

  // ---- drawing ---------------------------------------------------------------------------------
  // the body turns along where the player looks (flat when crawling), as 1.21.11
  // PlayerRenderer.setupRotations does after the usual turn
  var origEam=Eam;
  Eam=function(a,b,c,d,e){
    var r=origEam(a,b,c,d,e);
    if(!$rt_suspending()){try{turnBody(b,e);}catch(x){fail(x);}}
    return r;
  };
  function turnBody(p,pt){
    var s=0;
    if(on()&&p.thSa){var o=p.thSo||0;s=o+(p.thSa-o)*pt;}
    SW.rEnt=p;SW.rAmt=s;
    if(s<=0||p.kI||EKy(p))return;
    var pitch=p.c1+(p.bc-p.c1)*pt;
    Gc7((p.e0?-90-pitch:-90)*s,1,0,0);
    if(p.thSp===1){
      DPm(0,-1,0.3);
      // the model and its layers lower themselves 0.2 for a sneaking player; a swimmer is not
      // crouched (0.2 in model units is 0.1875 here, before the player's 0.9375 scale)
      if(p.q1())DPm(0,0.1875,0);
    }
  }
  // arms, legs and head: the end of 1.21.11 HumanoidModel.setupAnim
  var origDGY=DGY;
  DGY=function(a,b,c,d,e,f,g,h){
    var sw=!$rt_resuming()&&h!==null&&h===SW.rEnt&&SW.rAmt>0&&!EKy(h);
    if(sw&&h.thSp===1)a.bmt=0;                       // not crouched while swimming
    var r=origDGY(a,b,c,d,e,f,g,h);
    if(sw&&!$rt_suspending()){try{strokes(a,b,h,SW.rAmt);}catch(x){fail(x);}}
    return r;
  };
  function rotLerp(t,a,b){
    var f=(b-a)%TAU;
    if(f<-PI)f+=TAU;
    if(f>=PI)f-=TAU;
    return a+t*f;
  }
  function lerp(t,a,b){return a+t*(b-a);}
  function quad(x){return -65*x+x*x;}
  function strokes(m,ls,h,s){
    var hd=m.lz,R=m.gM,L=m.f2;
    hd.A=rotLerp(s,hd.A,-PI/4);
    var att=m.v3>0,left=DC9(m,h)===HJu;
    var fr=!left&&att?0:s,fl=left&&att?0:s,c=ls%26,t;
    if(!EG6(h)){
      if(c<14){
        t=1.8707964*quad(c)/quad(14);
        L.A=rotLerp(fl,L.A,0);R.A=lerp(fr,R.A,0);
        L.bb=rotLerp(fl,L.bb,PI);R.bb=lerp(fr,R.bb,PI);
        L.bX=rotLerp(fl,L.bX,PI+t);R.bX=lerp(fr,R.bX,PI-t);
      }else if(c<22){
        t=(c-14)/8;
        L.A=rotLerp(fl,L.A,HALF_PI*t);R.A=lerp(fr,R.A,HALF_PI*t);
        L.bb=rotLerp(fl,L.bb,PI);R.bb=lerp(fr,R.bb,PI);
        L.bX=rotLerp(fl,L.bX,5.012389-1.8707964*t);R.bX=lerp(fr,R.bX,1.2707963+1.8707964*t);
      }else{
        t=(c-22)/4;
        L.A=rotLerp(fl,L.A,HALF_PI-HALF_PI*t);R.A=lerp(fr,R.A,HALF_PI-HALF_PI*t);
        L.bb=rotLerp(fl,L.bb,PI);R.bb=lerp(fr,R.bb,PI);
        L.bX=rotLerp(fl,L.bX,PI);R.bX=lerp(fr,R.bX,PI);
      }
    }
    m.nc.A=lerp(s,m.nc.A,0.3*Math.cos(ls*0.33333334+PI));
    m.mC.A=lerp(s,m.mC.A,0.3*Math.cos(ls*0.33333334));
    AGV(hd,m.D$);                                     // the hat layer follows the head
  }

  // ---- camera: the eye height slides (camTick), and a new frame starts with no player drawn --
  // (Freelook, thunder-freelook.js, which puts itself in SW.fl: while the camera is placed, the
  // player's rotation reads the camera's; st bit 2)
  var origFJp=FJp;
  FJp=function(a,b){
    var st=0,r;
    if($rt_resuming())st=$rt_nativeThread().pop();
    else{
      SW.rEnt=null;
      var ve=HEN&&HEN.hI;
      if(on()&&SW.camSm&&ve&&ve===SW.camFor){SW.cam=ve;SW.camEye=SW.eyeO+(SW.eye-SW.eyeO)*b;st=1;}
      var fl=SW.fl;
      if(fl&&fl.on&&ve&&ve===HEN.v){fl.swap(ve);st|=2;}
    }
    try{r=origFJp(a,b);}
    finally{
      if($rt_suspending())$rt_nativeThread().push(st);
      else{SW.cam=null;if((st&2)&&SW.fl)SW.fl.unswap();}
    }
    return r;
  };
})();
