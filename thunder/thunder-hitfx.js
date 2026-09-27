  /* -------------------------------------------------------------------------------------------
     Part of Thunder Client, created and owned by Jayvardhan Ginni (ThunderGamey).
     Hit effects (Right Shift > Visual): a lightning bolt where you left-click, and extra particles
     on the mob or player you hit. Included into the client scope of thunder-client.js by build.js.

     Everything happens only in your own game: the bolt is the game's own lightning entity, made
     as "effect only" in your client's world (it cannot set fires or hurt anything, and the server
     never hears of it), so nobody else sees it. The clicked spot is read when Minecraft.clickMouse
     runs; the bolt, its sound and the particles are made between frames through runOnGame.

     Game function this module replaces (the wrapper only reads, then calls the original):
     @hook Cfp net.minecraft.client.Minecraft.clickMouse

     Game functions, classes and fields it uses:
     @use GCA net.minecraft.entity.effect.EntityLightningBolt.<init>
     @use Bkv net.minecraft.world.World.addWeatherEffect
     @use D2I net.minecraft.client.multiplayer.WorldClient.playSound
     @use D$s net.minecraft.client.particle.ParticleManager.emitParticleAtEntity
     @use D2a net.minecraft.util.EnumParticleTypes.getParticleFromId
     @class Ya net.minecraft.entity.effect.EntityLightningBolt
     @static LeN net.minecraft.init.SoundEvents ENTITY_LIGHTNING_THUNDER
     @static LeM net.minecraft.init.SoundEvents ENTITY_LIGHTNING_IMPACT
     @static LnM net.minecraft.util.SoundCategory WEATHER
     @field wL net.minecraft.client.Minecraft.clickMouse Minecraft.leftClickCounter
     @field h3 net.minecraft.client.Minecraft.clickMouse Minecraft.objectMouseOver
     @field kD net.minecraft.client.Minecraft.clickMouse RayTraceResult.typeOfHit
     @field d net.minecraft.client.Minecraft.clickMouse Enum.ordinal (MISS 0, BLOCK 1, ENTITY 2)
     @field X net.minecraft.client.Minecraft.clickMouse Minecraft.world
     @field kr net.minecraft.util.math.RayTraceResult.<init> RayTraceResult.entityHit
     @field pN net.minecraft.util.math.RayTraceResult.<init> RayTraceResult.hitVec
     @field bh net.minecraft.util.math.Vec3d.<init> Vec3d.x
     @field bq net.minecraft.util.math.Vec3d.<init> Vec3d.y
     @field bi net.minecraft.util.math.Vec3d.<init> Vec3d.z
     @field it net.minecraft.client.entity.EntityPlayerSP.onCriticalHit Minecraft.effectRenderer
     @field bgi net.minecraft.entity.effect.EntityLightningBolt.<init> EntityLightningBolt.boltLivingTime
     (Entity.posX/posY/posZ b/f/c, Minecraft.player v and the Minecraft instance HEN are declared
     in thunder-client.js and thunder-lan.js.)
     ------------------------------------------------------------------------------------------- */
  // particle choices: Off, then EnumParticleTypes ids
  var HF_PARTS=[-1,9,10,26,34,21,43,47],HF={last:0,types:{},clicks:0,bolts:0,parts:0,kind:-1};

  function hfClick(mc){
    if(mc.wL>0||!mc.h3||!mc.X||!mc.v)return;               // the game ignores this click too
    var r=mc.h3,kind=r.kD?r.kD.d:0,ent=kind===2?r.kr:null,x,y,z;
    HF.clicks++;HF.kind=kind;
    if(kind===0||(kind===2&&!ent))return;                  // clicked at the air
    if(S.hitFx&&(ent||S.hitFxBlocks)){
      var now=Date.now();
      if(now-HF.last>=S.hitFxGap*1000){
        HF.last=now;
        if(ent){x=ent.b;y=ent.f;z=ent.c;}
        else{x=r.pN.bh;y=r.pN.bq;z=r.pN.bi;}
        HF.pos=[x,y,z];
        hfBolt(mc.X,x,y,z);
      }
    }
    if(ent&&S.hitParts>0&&HF_PARTS[S.hitParts]>=0)hfParticles(ent,HF_PARTS[S.hitParts],S.hitPartsAmt|0);
  }

  // the game's lightning, effect only, in this client's world; plus a quieter crack and rumble
  function hfBolt(w,x,y,z,flashes){
    var bolt=null,loud=S.hitFxSound&&LeM!==null&&LnM!==null;
    runOnGame([
      function(){
        if(!$rt_resuming()){if(!HEN||HEN.X!==w)return;bolt=new Ya();}
        if($rt_resuming()||bolt)GCA(bolt,w,x,y,z,1);
      },
      function(){
        if(!bolt)return;
        bolt.bgi=Math.max(bolt.bgi,flashes||3);       // flickers a few times, like a real strike
        Bkv(w,bolt);HF.bolts++;
      },
      function(){if($rt_resuming()||(bolt&&loud))D2I(w,x,y,z,LeM,LnM,1.0,0.9+Math.random()*0.2,0);},
      function(){if($rt_resuming()||(bolt&&loud&&LeN!==null))D2I(w,x,y,z,LeN,LnM,0.3,1.2,0);}
    ]);
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

  TC.hitfx={counts:function(){return {clicks:HF.clicks,bolts:HF.bolts,particles:HF.parts,lastKind:HF.kind};},
    // a bolt a few blocks in front of you (for checking the effect without hitting anything)
    test:function(flashes){var p=HEN&&HEN.v;if(!p||!HEN.X)return false;HF.pos=[p.b+3,p.f,p.c];hfBolt(HEN.X,p.b+3,p.f,p.c,flashes);return HF.pos;},
    pos:function(){return HF.pos||null;}};

  var origCfp=Cfp;
  Cfp=function(a){
    if(!$rt_resuming()&&(S.hitFx||S.hitParts>0)){try{hfClick(a);}catch(e){report(e);}}
    return origCfp(a);
  };

  function fmtSec(v){return (+v).toFixed(1)+' s';}
  MODULES.push(
    {cat:'visual',id:'hitFx',name:'Thunder Hits',
      desc:'A lightning bolt strikes where you left-click a player or mob (and blocks, if you like). Only you see it: it cannot burn or hurt anything. The sky flashes with each bolt.',
      opts:[{id:'hitFxBlocks',name:'Also when you click blocks'},
        {id:'hitFxSound',name:'Thunder sound'},
        {id:'hitFxGap',name:'Time between bolts',min:0.2,max:3,step:0.1,fmt:fmtSec}]},
    {cat:'visual',id:null,name:'Hit Particles',
      desc:'Extra particles on every player or mob you hit. Only you see them.',
      opts:[{id:'hitParts',name:'Particles',choices:['Off','Crit','Magic','Flame','Hearts','Sparkles','End rod','Totem']},
        {id:'hitPartsAmt',name:'Amount',min:1,max:3,step:1,fmt:function(v){return 'x'+v;}}]}
  );
