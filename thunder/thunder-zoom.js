  /* -------------------------------------------------------------------------------------------
     Part of Thunder Client, created and owned by Jayvardhan Ginni (ThunderGamey).
     Zoom (Right Shift > Utility), in the style of Zoomify. Included into the client scope of
     thunder-client.js by build.js.
     Hold C (or tap it, with "Toggle") in a world to zoom in. The view glides in and out instead of
     jumping, the mouse wheel zooms further in or out while zoomed (the hotbar does not scroll
     then), and mouse sensitivity drops with the zoom so aiming stays steady.
     The zoom divides the field of view the game asks for (EntityRenderer.getFOVModifier, wrapped
     in thunder-client.js) for the world only, so the hand keeps its normal size. Sensitivity is
     the game's own setting, lowered while zoomed and put back as soon as the zoom ends or any
     screen opens, so the value in Options is never changed.

     Game fields it uses:
     @field bdY net.minecraft.client.renderer.EntityRenderer.updateCameraAndRender GameSettings.mouseSensitivity
     (Minecraft.world X, Minecraft.currentScreen cm and GameSettings G are declared elsewhere.)
     ------------------------------------------------------------------------------------------- */
  var ZM={f:1,target:1,level:0,last:0,sens:null,toggled:false,keyWas:false};
  function zoomLevelDefault(){return clamp(Number(S.zoomLevel)||4,1.5,20);}
  // zoom wanted this frame: in a world, no screen or Thunder menu open, not typing
  function zoomWanted(){
    if(!S.zoom||!HEN||!HEN.X||HEN.cm!==null||menuOpen||hudEditing){ZM.toggled=false;return false;}
    var down=!!keyState.KeyC;
    if(S.zoomToggle){
      if(down&&!ZM.keyWas)ZM.toggled=!ZM.toggled;
      ZM.keyWas=down;
      return ZM.toggled;
    }
    return down;
  }
  // the game's turn speed goes with (sensitivity * 0.6 + 0.2)^3: scale it by 1 / zoom
  function zoomSens(){
    var gs=HEN&&HEN.G;
    if(!gs)return;
    if(ZM.f>1.001&&S.zoomSens&&HEN.cm===null){
      if(ZM.sens===null)ZM.sens=gs.bdY;
      var base=ZM.sens*0.6+0.2;
      gs.bdY=Math.max(-0.33,(base*Math.pow(1/ZM.f,1/3)-0.2)/0.6);
    }else if(ZM.sens!==null){gs.bdY=ZM.sens;ZM.sens=null;}
  }
  frameTasks.push(function(){
    var t=now(),dt=ZM.last?Math.min(100,t-ZM.last):16;
    ZM.last=t;
    var want=zoomWanted();
    if(!want)ZM.level=0;                                   // next zoom starts at the set level again
    else if(!ZM.level)ZM.level=zoomLevelDefault();
    ZM.target=want?ZM.level:1;
    var k=S.zoomSmooth?1-Math.exp(-dt/75):1;
    ZM.f+=(ZM.target-ZM.f)*k;
    if(Math.abs(ZM.f-ZM.target)<0.002)ZM.f=ZM.target;
    zoomSens();
  });
  // the world's field of view, zoomed (called from the getFOVModifier wrapper)
  function zoomFov(fov){return ZM.f>1.0001?fov/ZM.f:fov;}
  // mouse wheel while zoomed: zoom further in or out; the game never sees it (no hotbar scroll)
  if(W.addEventListener)W.addEventListener('wheel',function(e){
    if(!S.zoom||!S.zoomScroll||ZM.target<=1||!ZM.level)return;
    ZM.level=clamp(ZM.level*(e.deltaY<0?1.25:0.8),1.2,50);
    e.stopImmediatePropagation();
    if(e.cancelable)e.preventDefault();
  },{capture:true,passive:false});
  TC.zoom={state:function(){return {f:Math.round(ZM.f*100)/100,target:ZM.target,level:ZM.level,sens:ZM.sens};}};
  MODULES.push({cat:'utility',id:'zoom',name:'Zoom',
    desc:'Hold C in a world to zoom in. The view glides in and out, the mouse wheel zooms further while zoomed, and aiming stays steady.',
    opts:[{id:'zoomLevel',name:'Zoom',min:2,max:10,step:0.5,fmt:function(v){return v+'x';}},
      {id:'zoomSmooth',name:'Smooth zoom'},
      {id:'zoomScroll',name:'Scroll to zoom'},
      {id:'zoomSens',name:'Lower sensitivity while zoomed'},
      {id:'zoomToggle',name:'Tap C to toggle (instead of hold)'}]});
