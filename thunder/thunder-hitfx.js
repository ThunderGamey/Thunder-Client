  /* -------------------------------------------------------------------------------------------
     Part of Thunder Client, created and owned by Jayvardhan Ginni (ThunderGamey).
     Hit Effects (Right Shift > Visual): an effect on the mob or player you hit. Included into the
     client scope of thunder-client.js by build.js.
     - Thunder shock: a small electric bolt comes down onto them and crackles around their body,
       with a zap sound.
     - Lightning strike: a real lightning bolt hits them (the game's own lightning, "effect only").
     - Crit, Magic, Flame, Hearts, End rod, Totem: a burst of those particles.

     Everything happens only in your own game, so nobody else sees or hears it, and it cannot burn
     or hurt anything (the server never hears of it). What you hit is read when
     Minecraft.clickMouse runs (its wrapper is in thunder-weapons.js and calls hfClick); the
     effect is made between frames through runOnGame, one game call per step.

     Game functions, classes and fields it uses:
     @use D$s net.minecraft.client.particle.ParticleManager.emitParticleAtEntity
     @use GlU net.minecraft.client.particle.ParticleManager.spawnEffectParticle
     @use D2a net.minecraft.util.EnumParticleTypes.getParticleFromId
     @use GCA net.minecraft.entity.effect.EntityLightningBolt.<init>
     @use Bkv net.minecraft.world.World.addWeatherEffect
     @use D2I net.minecraft.client.multiplayer.WorldClient.playSound
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
     @field it net.minecraft.client.entity.EntityPlayerSP.onCriticalHit Minecraft.effectRenderer
     @runtime $rt_createIntArray x
     @field bgi net.minecraft.entity.effect.EntityLightningBolt.<init> EntityLightningBolt.boltLivingTime
     (Entity.posX/posY/posZ b/f/c, Minecraft.player v and the Minecraft instance HEN are declared
     in thunder-client.js and thunder-lan.js.)
     ------------------------------------------------------------------------------------------- */
  // choices: Off, Thunder shock, Lightning strike, then particle bursts (EnumParticleTypes ids)
  var HF_CHOICES=['Off','Thunder shock','Lightning strike','Crit','Magic','Flame','Hearts','End rod','Totem'];
  var HF_PARTS=[-1,-1,-1,9,10,26,34,43,47];
  var HF_CRIT_MAGIC=10,HF_END_ROD=43;             // particle ids for the shock
  var HF={types:{},clicks:0,parts:0,shocks:0,bolts:0,kind:-1,last:0};

  function hfClick(mc){
    if(mc.wL>0||!mc.h3||!mc.X||!mc.v)return;               // the game ignores this click too
    var r=mc.h3,kind=r.kD?r.kD.d:0,ent=kind===2?r.kr:null,fx=S.hitEffect|0;
    HF.clicks++;HF.kind=kind;
    if(!ent||fx<=0)return;
    var t=Date.now();
    if(fx===1){if(t-HF.last<120)return;HF.last=t;hfShock(mc.X,ent);}
    else if(fx===2){if(t-HF.last<400)return;HF.last=t;hfBolt(mc.X,ent.b,ent.f,ent.c);}
    else if(HF_PARTS[fx]>=0)hfParticles(ent,HF_PARTS[fx],S.hitEffectAmt|0);
  }

  // particle types are looked up once (EnumParticleTypes.getParticleFromId)
  function hfType(id){
    return function(){
      if(HF.types[id])return;
      var t=D2a(id);
      if(!$rt_suspending()&&t)HF.types[id]=t;
    };
  }

  function hfParticles(ent,id,times){
    var steps=[hfType(id)];
    for(var i=0;i<Math.max(1,Math.min(3,times));i++)steps.push(function(){
      var pm=HEN&&HEN.it,t=HF.types[id];
      if($rt_resuming()||(pm&&t&&HEN.X)){D$s(pm,ent,t);HF.parts++;}
    });
    runOnGame(steps);
  }

  // Thunder shock: a jagged little bolt from above the head down into the body, made of the blue
  // enchanted-hit particles (they only live a few ticks, so it flickers like a spark), a crackle
  // of sparks around the body, and a zap.
  function hfShock(w,ent){
    var x=ent.b,y=ent.f,z=ent.c,pts=[],i,j,n=7;
    var top=[x+(Math.random()-0.5)*0.6,y+3.0,z+(Math.random()-0.5)*0.6],bot=[x,y+1.0,z];
    for(i=0;i<=n;i++){
      var k=i/n,jit=i===0||i===n?0:0.28;
      pts.push([top[0]+(bot[0]-top[0])*k+(Math.random()-0.5)*jit,top[1]+(bot[1]-top[1])*k,
        top[2]+(bot[2]-top[2])*k+(Math.random()-0.5)*jit]);
    }
    var spawns=[];
    for(i=0;i<n;i++){
      var a=pts[i],b=pts[i+1],len=Math.sqrt((b[0]-a[0])*(b[0]-a[0])+(b[1]-a[1])*(b[1]-a[1])+(b[2]-a[2])*(b[2]-a[2]));
      var m=Math.max(2,Math.ceil(len/0.11));
      for(j=0;j<m;j++){var q=j/m;spawns.push([HF_CRIT_MAGIC,a[0]+(b[0]-a[0])*q,a[1]+(b[1]-a[1])*q,a[2]+(b[2]-a[2])*q,0,0,0]);}
    }
    for(i=0;i<10;i++){                                  // sparks jumping off the body
      var an=Math.random()*6.283,up=Math.random()*1.6;
      spawns.push([i<3?HF_END_ROD:HF_CRIT_MAGIC,x+Math.cos(an)*0.35,y+0.3+up,z+Math.sin(an)*0.35,
        Math.cos(an)*0.25,0.05+Math.random()*0.1,Math.sin(an)*0.25]);
    }
    var steps=[],none=null;
    spawns.forEach(function(s){
      steps.push(function(){
        var pm=HEN&&HEN.it;
        if(!$rt_resuming()&&(!pm||HEN.X!==w))return;
        if(!none)none=$rt_createIntArray(0);
        GlU(pm,s[0],s[1],s[2],s[3],s[4],s[5],s[6],none);
      });
    });
    steps.push(function(){HF.shocks++;});
    runOnGame(steps);
    hfZap();
  }

  // the game's lightning, effect only, in this client's world, on the one you hit; plus a quieter
  // crack and rumble. It flickers a few times, like a real strike.
  function hfBolt(w,x,y,z){
    var bolt=null,loud=LeM!==null&&LnM!==null;
    runOnGame([
      function(){
        if(!$rt_resuming()){if(!HEN||HEN.X!==w)return;bolt=new Ya();}
        if($rt_resuming()||bolt)GCA(bolt,w,x,y,z,1);
      },
      function(){
        if(!bolt)return;
        bolt.bgi=Math.max(bolt.bgi,2);
        Bkv(w,bolt);HF.bolts++;
      },
      function(){if($rt_resuming()||(bolt&&loud))D2I(w,x,y,z,LeM,LnM,0.8,0.9+Math.random()*0.2,0);},
      function(){if($rt_resuming()||(bolt&&loud&&LeN!==null))D2I(w,x,y,z,LeN,LnM,0.25,1.2,0);}
    ]);
  }

  // zap: a short electric buzz made in the browser (Web Audio), only you hear it
  var hfAudio=null;
  function hfZap(){
    if(!S.hitEffectSound)return;
    try{
      var AC=W.AudioContext||W.webkitAudioContext;if(!AC)return;
      if(!hfAudio)hfAudio=new AC();
      var c=hfAudio;if(c.state==='suspended')c.resume();
      var t=c.currentTime,len=Math.floor(c.sampleRate*0.18),buf=c.createBuffer(1,len,c.sampleRate),d=buf.getChannelData(0),i;
      for(i=0;i<len;i++){var k=i/len;d[i]=(Math.random()*2-1)*(Math.random()<0.35?1:0.25)*Math.pow(1-k,2);}
      var src=c.createBufferSource();src.buffer=buf;
      var bp=c.createBiquadFilter();bp.type='bandpass';bp.frequency.setValueAtTime(2600,t);bp.frequency.exponentialRampToValueAtTime(900,t+0.18);bp.Q.value=0.8;
      var g=c.createGain();g.gain.setValueAtTime(0.22,t);g.gain.exponentialRampToValueAtTime(0.001,t+0.2);
      src.connect(bp);bp.connect(g);g.connect(c.destination);src.start(t);src.stop(t+0.21);
      var o=c.createOscillator();o.type='sawtooth';o.frequency.setValueAtTime(180,t);o.frequency.exponentialRampToValueAtTime(60,t+0.15);
      var og=c.createGain();og.gain.setValueAtTime(0.06,t);og.gain.exponentialRampToValueAtTime(0.001,t+0.15);
      o.connect(og);og.connect(c.destination);o.start(t);o.stop(t+0.16);
    }catch(_){}
  }

  TC.hitfx={counts:function(){return {clicks:HF.clicks,particles:HF.parts,shocks:HF.shocks,bolts:HF.bolts,lastKind:HF.kind};},
    // the effect on whatever is under the crosshair (for checking it without clicking)
    test:function(){var mc=HEN,r=mc&&mc.h3;if(!r||!r.kr||!mc.X)return false;var f=S.hitEffect|0;
      if(f===1)hfShock(mc.X,r.kr);else if(f===2)hfBolt(mc.X,r.kr.b,r.kr.f,r.kr.c);else if(HF_PARTS[f]>=0)hfParticles(r.kr,HF_PARTS[f],3);return true;}};

  MODULES.push({cat:'visual',id:null,name:'Hit Effects',
    desc:'An effect on every player or mob you hit. Thunder shock: a small electric bolt zaps them. Lightning strike: real lightning hits them. Or a burst of particles. Only you see and hear it.',
    opts:[{id:'hitEffect',name:'Effect',choices:HF_CHOICES},
      {id:'hitEffectSound',name:'Zap sound (Thunder shock)'},
      {id:'hitEffectAmt',name:'Particle amount',min:1,max:3,step:1,fmt:function(v){return 'x'+v;}}]});
