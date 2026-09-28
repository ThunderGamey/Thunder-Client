  /* -------------------------------------------------------------------------------------------
     Part of Thunder Client, created and owned by Jayvardhan Ginni (ThunderGamey).
     Hit Particles (Right Shift > Visual): extra particles on the mob or player you hit. Included
     into the client scope of thunder-client.js by build.js. (Lightning where you click lives on
     the title screen now: see thunder-title.js.)

     Everything happens only in your own game, so nobody else sees it. What you hit is read when
     Minecraft.clickMouse runs; the particles are made between frames through runOnGame, with the
     game's own emitter (the one it uses for critical hits).

     Game function this module replaces (the wrapper only reads, then calls the original):
     @hook Cfp net.minecraft.client.Minecraft.clickMouse

     Game functions and fields it uses:
     @use D$s net.minecraft.client.particle.ParticleManager.emitParticleAtEntity
     @use D2a net.minecraft.util.EnumParticleTypes.getParticleFromId
     @field wL net.minecraft.client.Minecraft.clickMouse Minecraft.leftClickCounter
     @field h3 net.minecraft.client.Minecraft.clickMouse Minecraft.objectMouseOver
     @field kD net.minecraft.client.Minecraft.clickMouse RayTraceResult.typeOfHit
     @field d net.minecraft.client.Minecraft.clickMouse Enum.ordinal (MISS 0, BLOCK 1, ENTITY 2)
     @field X net.minecraft.client.Minecraft.clickMouse Minecraft.world
     @field kr net.minecraft.util.math.RayTraceResult.<init> RayTraceResult.entityHit
     @field it net.minecraft.client.entity.EntityPlayerSP.onCriticalHit Minecraft.effectRenderer
     (Minecraft.player v and the Minecraft instance HEN are declared in thunder-client.js and
     thunder-lan.js.)
     ------------------------------------------------------------------------------------------- */
  // particle choices: Off, then EnumParticleTypes ids
  var HF_PARTS=[-1,9,10,26,34,21,43,47],HF={types:{},clicks:0,parts:0,kind:-1};

  function hfClick(mc){
    if(mc.wL>0||!mc.h3||!mc.X||!mc.v)return;               // the game ignores this click too
    var r=mc.h3,kind=r.kD?r.kD.d:0,ent=kind===2?r.kr:null;
    HF.clicks++;HF.kind=kind;
    if(ent&&S.hitParts>0&&HF_PARTS[S.hitParts]>=0)hfParticles(ent,HF_PARTS[S.hitParts],S.hitPartsAmt|0);
  }

  function hfParticles(ent,id,times){
    var steps=[function(){
      if(HF.types[id])return;
      var t=D2a(id);
      if(!$rt_suspending()&&t)HF.types[id]=t;
    }];
    for(var i=0;i<Math.max(1,Math.min(3,times));i++)steps.push(function(){
      var pm=HEN&&HEN.it,t=HF.types[id];
      if($rt_resuming()||(pm&&t&&HEN.X)){D$s(pm,ent,t);HF.parts++;}
    });
    runOnGame(steps);
  }

  TC.hitfx={counts:function(){return {clicks:HF.clicks,particles:HF.parts,lastKind:HF.kind};}};

  var origCfp=Cfp;
  Cfp=function(a){
    if(!$rt_resuming()&&S.hitParts>0){try{hfClick(a);}catch(e){report(e);}}
    return origCfp(a);
  };

  MODULES.push({cat:'visual',id:null,name:'Hit Particles',
    desc:'Extra particles on every player or mob you hit. Only you see them.',
    opts:[{id:'hitParts',name:'Particles',choices:['Off','Crit','Magic','Flame','Hearts','Sparkles','End rod','Totem']},
      {id:'hitPartsAmt',name:'Amount',min:1,max:3,step:1,fmt:function(v){return 'x'+v;}}]});
