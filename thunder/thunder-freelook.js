  /* -------------------------------------------------------------------------------------------
     Part of Thunder Client, created and owned by Jayvardhan Ginni (ThunderGamey).
     Freelook (Right Shift > Utility), like Lunar's Perspective mod. Included into the client
     scope of thunder-client.js by build.js.
     Hold X (or tap it, with "Toggle") in a world: the view goes to third person and the mouse
     turns the camera around your player, while the player keeps facing (and walking, bridging,
     aiming) the way it was. Let go and the view is back where it was. Your player's real
     direction never changes, so the server sees nothing; some servers still do not allow it,
     which is what the switch is for.
     The mouse turns the player with Entity.turn: while freelook is on, that turns the camera's
     own yaw and pitch instead (same speed and limits). EntityRenderer.orientCamera places the
     camera from the player's rotation: while it runs, the player's rotation reads the camera's
     (the orientCamera wrapper in thunder-swim.js calls flSwap and flUnswap here, through SW.fl).

     Game functions this module replaces:
     @hook DCq net.minecraft.entity.Entity.setAngles
     (Entity.rotationYaw C, prevRotationYaw cy, rotationPitch bc and prevRotationPitch c1, and
     GameSettings.thirdPersonView lu are declared in thunder-client.js and thunder-shaders.js.)
  ------------------------------------------------------------------------------------------- */
  var FL={on:false,yaw:0,pitch:0,view:0,toggled:false,keyWas:false,uses:0,saved:null};
  // freelook wanted this frame: in a world, no screen or Thunder menu open
  function flWanted(){
    if(!S.freelook||!HEN||!HEN.X||!HEN.v||HEN.cm!==null||menuOpen||hudEditing){FL.toggled=false;return false;}
    var down=bindDown(S.freelookKey||'KeyX');
    if(S.freelookToggle){
      if(down&&!FL.keyWas)FL.toggled=!FL.toggled;
      FL.keyWas=down;
      return FL.toggled;
    }
    return down;
  }
  frameTasks.push(function(){
    var want=flWanted(),p=HEN&&HEN.v,gs=HEN&&HEN.G;
    if(want&&!FL.on&&p&&gs){
      FL.on=true;FL.uses++;
      FL.yaw=p.C;FL.pitch=p.bc;
      FL.view=gs.lu;
      if(!gs.lu)gs.lu=1;                     // first person: the view behind the player
    }else if(!want&&FL.on){
      FL.on=false;
      if(gs)gs.lu=FL.view;
    }
  });
  // the mouse while freelook is on: the camera turns, the player does not
  var origDCq=DCq;
  DCq=function(a,b,c){
    if(FL.on&&!$rt_resuming()&&HEN&&a===HEN.v){
      FL.yaw+=b*0.15;
      FL.pitch=clamp(FL.pitch-c*0.15,-90,90);
      return;
    }
    return origDCq(a,b,c);
  };
  // while the camera is placed: the player's rotation reads the camera's
  function flSwap(e){
    FL.saved={e:e,y:e.C,py:e.cy,p:e.bc,pp:e.c1};
    e.C=e.cy=FL.yaw;e.bc=e.c1=FL.pitch;
  }
  function flUnswap(){
    var s=FL.saved;
    if(!s)return;
    FL.saved=null;
    s.e.C=s.y;s.e.cy=s.py;s.e.bc=s.p;s.e.c1=s.pp;
  }
  // (the orientCamera wrapper lives in thunder-swim.js, outside this scope: it finds these there)
  FL.swap=flSwap;FL.unswap=flUnswap;if(SWIM)SWIM.fl=FL;
  TC.freelook={state:function(){return {on:FL.on,yaw:FL.yaw,pitch:FL.pitch,uses:FL.uses,view:FL.view};}};
  MODULES.push({cat:'utility',id:'freelook',name:'Freelook',
    desc:'Hold the freelook key (X) in a world to look around your player in third person while you keep going the way you face (great for bridging). Your real direction does not change. Some servers do not allow it: switch it off there.',
    opts:[{id:'freelookKey',name:'Freelook key',key:true},
      {id:'freelookToggle',name:'Tap the key to toggle (instead of hold)'}]});
