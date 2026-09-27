  /* -------------------------------------------------------------------------------------------
     Max FPS: one click sets the fastest settings for this browser, one click puts them back.
     Game settings go through the game's own setters (the same calls the Video Settings buttons
     make, so chunks are rebuilt where the game rebuilds them) and are saved to options.txt;
     Thunder's own heavy extras are switched to their fastest choice.
     VSync is measured, not assumed: with VSync off the game draws without waiting for the
     browser's frame, which is faster on a strong GPU but can flood a weak one (on a software GPU
     it dropped from 60 to about 10 FPS). In a world, Max FPS counts frames with VSync on and off
     for a few seconds each and keeps the faster one.

     Game functions it calls:
     @use FXC net.minecraft.client.settings.GameSettings.setOptionValue
     @use E4g net.minecraft.client.settings.GameSettings.setOptionFloatValue
     @use DrK net.minecraft.client.settings.GameSettings.getOptionOrdinalValue
     @use DuB net.minecraft.client.settings.GameSettings.saveOptions
     @static HFp net.minecraft.client.settings.GameSettings$Options RENDER_DISTANCE
     @static HFa net.minecraft.client.settings.GameSettings$Options FRAMERATE_LIMIT
     @static LmR net.minecraft.client.settings.GameSettings$Options GRAPHICS
     @static LmS net.minecraft.client.settings.GameSettings$Options AMBIENT_OCCLUSION
     @static LmN net.minecraft.client.settings.GameSettings$Options RENDER_CLOUDS
     @static LmL net.minecraft.client.settings.GameSettings$Options PARTICLES
     @static Lm1 net.minecraft.client.settings.GameSettings$Options ENTITY_SHADOWS
     @static LmZ net.minecraft.client.settings.GameSettings$Options ENABLE_VSYNC
     @field ni net.minecraft.client.settings.GameSettings.getOptionFloatValue GameSettings.renderDistanceChunks
     @field a3l net.minecraft.client.settings.GameSettings.getOptionFloatValue GameSettings.limitFramerate
     @field u5 net.minecraft.client.settings.GameSettings.getKeyBinding GameSettings.fancyGraphics
     @field vF net.minecraft.client.settings.GameSettings.getKeyBinding GameSettings.ambientOcclusion
     @field Hw net.minecraft.client.settings.GameSettings.getKeyBinding GameSettings.clouds
     @field QN net.minecraft.client.settings.GameSettings.getKeyBinding GameSettings.particleSetting
     ------------------------------------------------------------------------------------------- */
  var FPS_UNDO='thunderMaxFpsUndo';
  var FPS_RD=6;                                   // chunks; lower is kept
  var FPS_THUNDER={shaders:false,menuStorm:false,titleQuality:1};   // title quality 1 = Low
  var fpsBusy=false,fpsNote='';

  function fpsSettings(gs){
    return {rd:gs.ni|0,limit:gs.a3l|0,fancy:!!gs.u5,ao:gs.vF|0,clouds:gs.Hw|0,particles:gs.QN|0,
      shadows:!!DrK(gs,Lm1),vsync:!!DrK(gs,LmZ)};
  }
  // Steps that move each game setting to the wanted value. Each step makes at most one game call;
  // if that call suspends, the runner calls the step again with $rt_resuming() set, and the step
  // must then make the same call again (without re-checking) so the game resumes it.
  function fpsSteps(gs,want){
    var st=[];
    function step(need,call){st.push(function(){if($rt_resuming()||need())call();});}
    function cycle(opt,field,val){
      for(var i=0;i<2;i++)step(function(){return (gs[field]|0)!==val;},function(){FXC(gs,opt,1);});
    }
    function flag(opt,val){step(function(){return !!DrK(gs,opt)!==val;},function(){FXC(gs,opt,1);});}
    step(function(){return (gs.ni|0)!==want.rd;},function(){E4g(gs,HFp,want.rd);});
    step(function(){return (gs.a3l|0)!==want.limit;},function(){E4g(gs,HFa,want.limit);});
    step(function(){return !!gs.u5!==want.fancy;},function(){FXC(gs,LmR,1);});
    cycle(LmS,'vF',want.ao);
    cycle(LmN,'Hw',want.clouds);
    cycle(LmL,'QN',want.particles);
    flag(Lm1,want.shadows);
    flag(LmZ,want.vsync);
    step(function(){return true;},function(){DuB(gs);});
    return st;
  }
  function fpsThunder(values){
    for(var id in values){
      if(S[id]===values[id])continue;
      S[id]=values[id];
      MODULES.forEach(function(m){if(m.id===id&&m.onChange){try{m.onChange(S[id]);}catch(e){report(e);}}});
    }
    save();
    if(menuOpen)render();
  }
  // frames drawn, counted once per game loop (the runner's hook runs once per frame)
  var perfFrames=0;
  frameTasks.push(function(){perfFrames++;});
  function fpsWait(ms){return new Promise(function(ok){W.setTimeout(ok,ms);});}
  function fpsMeasure(ms){
    var f0=perfFrames,t0=now();
    return fpsWait(ms).then(function(){return (perfFrames-f0)*1000/Math.max(1,now()-t0);});
  }
  function fpsRun(steps){return new Promise(function(ok){runOnGame(steps.concat([function(){ok();}]));});}
  function fpsApply(){
    var mc=HEN,gs=mc&&mc.G;
    if(!gs||fpsBusy)return false;
    var cur=fpsSettings(gs),th={},id;
    for(id in FPS_THUNDER)th[id]=S[id];
    try{if(!W.localStorage.getItem(FPS_UNDO))W.localStorage.setItem(FPS_UNDO,JSON.stringify({game:cur,thunder:th}));}catch(_){}
    var want={rd:Math.min(cur.rd,FPS_RD),limit:260,fancy:false,ao:0,clouds:0,particles:2,shadows:false,vsync:cur.vsync};
    fpsBusy=true;fpsNote='Applying...';
    fpsThunder(FPS_THUNDER);
    var a=0,b=0,inWorld=!!mc.v;
    fpsRun(fpsSteps(gs,want)).then(function(){
      if(!inWorld)return null;
      fpsNote='Testing VSync '+(cur.vsync?'on':'off')+'...';
      return fpsWait(1500).then(function(){return fpsMeasure(3000);}).then(function(f){
        a=f;fpsNote='Testing VSync '+(cur.vsync?'off':'on')+'...';
        want.vsync=!cur.vsync;
        return fpsRun(fpsSteps(gs,want));
      }).then(function(){return fpsWait(1500);}).then(function(){return fpsMeasure(3000);}).then(function(f){
        b=f;
        // switch only for a clear win; otherwise keep the player's VSync choice
        if(b>a*1.15)return null;
        want.vsync=cur.vsync;
        return fpsRun(fpsSteps(gs,want));
      });
    }).then(function(){
      fpsBusy=false;
      function onoff(v){return v?'on':'off';}
      if(!inWorld)fpsNote='Max FPS is on. Press it again in a world to also test VSync.';
      else if(want.vsync!==cur.vsync)fpsNote='Max FPS is on. VSync '+onoff(want.vsync)+': '+Math.round(b)+' FPS vs '+Math.round(a)+' with it '+onoff(cur.vsync)+'.';
      else fpsNote='Max FPS is on. Kept VSync '+onoff(cur.vsync)+': '+Math.round(a)+' FPS vs '+Math.round(b)+' with it '+onoff(!cur.vsync)+'.';
    },function(e){fpsBusy=false;fpsNote='Something went wrong: '+(e&&e.message||e);report(e);});
    return true;
  }
  function fpsUndo(){
    var mc=HEN,gs=mc&&mc.G,u=null;
    try{u=JSON.parse(W.localStorage.getItem(FPS_UNDO)||'null');}catch(_){}
    if(!gs||!u||fpsBusy)return false;
    fpsBusy=true;fpsNote='Restoring...';
    runOnGame(fpsSteps(gs,u.game).concat([function(){
      fpsBusy=false;fpsNote='Your previous settings are back.';
      try{W.localStorage.removeItem(FPS_UNDO);}catch(_){}
    }]));
    fpsThunder(u.thunder||{});
    return true;
  }

  TC.perf={
    fps:gameFps,
    settings:function(){var gs=HEN&&HEN.G;return gs?fpsSettings(gs):null;},
    maxFps:fpsApply,
    undo:fpsUndo,
    busy:function(){return fpsBusy;},
    note:function(){return fpsNote;}
  };

  MODULES.push({cat:'utility',id:null,special:'maxfps',name:'Max FPS',wide:true,
    desc:'One click for the fastest settings: render distance 6 or less, Fast graphics, smooth lighting, clouds and entity shadows off, minimal particles, unlimited framerate, shaders off and plain menu backgrounds. In a world it also tests VSync on and off and keeps whichever is faster on this device. Undo puts everything back.'});
  SPECIALS.maxfps=function(box){
    var kv=el('div','tcm-kv');box.appendChild(kv);
    function row(label){kv.appendChild(el('span',null,label));var b=el('b',null,'-');kv.appendChild(b);return b;}
    var rFps=row('FPS now'),rSet=row('Settings'),rNote=row('Status');
    var act=el('div','tcm-actions');
    var go=el('button','tcm-btn','Max FPS');go.type='button';
    go.addEventListener('click',function(){if(!fpsApply())fpsNote=fpsBusy?'Busy...':'Start the game first.';});
    act.appendChild(go);
    act.appendChild(confirmButton('Undo','Click again to undo',function(){
      if(!fpsUndo())fpsNote=fpsBusy?'Busy...':'Nothing to undo.';
    }));
    box.appendChild(act);
    addLive(function(){
      var gs=HEN&&HEN.G,s=gs?fpsSettings(gs):null;
      rFps.textContent=String(gameFps());
      rSet.textContent=s?s.rd+' chunks, '+(s.fancy?'Fancy':'Fast')+', '+(s.limit>=260?'unlimited':s.limit+' fps cap')+
        ', VSync '+(s.vsync?'on':'off')+', clouds '+(['off','fast','fancy'][s.clouds]||s.clouds):'-';
      var undo=false;try{undo=!!W.localStorage.getItem(FPS_UNDO);}catch(_){}
      rNote.textContent=fpsNote||(undo?'Max FPS is on.':'Your own settings.');
    });
  };
