  /* -------------------------------------------------------------------------------------------
     Part of Thunder Client, created and owned by Jayvardhan Ginni (ThunderGamey).
     Quality of life. Included into the client scope of thunder-client.js by build.js.
     - Toggle Sneak (Movement): press sneak once to keep sneaking, press it again to stop.
     - Clear Chat (Visual): chat without the black box behind the lines (the text keeps its
       shadow, so it stays readable).
     - Password Hider (Utility): while you type /login, /register and the like in chat, the
       password shows as stars (only on your screen; what is sent is unchanged).
     - Show Own Name Tag (Visual): your own name above your head in third person.
     - Crystal Optimizer (Combat): an end crystal you hit disappears on your screen at once instead
       of when the server answers, so the next one can go down sooner.
     - XP Orb Clumping (Visual): orbs lying in the same spot are drawn once, so piles of XP do
       not slow the game down (like the Clumps mod, but only for drawing; nothing is merged).
     - Fast XP (Combat): bottles o' enchanting thrown every tick while you hold use.
     - Menu Sounds (Utility): a short electric sound when the Thunder menu opens and closes.

     Game functions this module replaces:
     @hook D8g net.minecraft.util.MovementInputFromOptions.updatePlayerMoveState
     @hook DYN net.minecraft.client.gui.GuiNewChat.drawChat
     @hook DzX net.minecraft.client.multiplayer.PlayerControllerMP.attackEntity
     @hook FoC net.minecraft.client.renderer.entity.RenderXPOrb.doRender
     @virtual dfg net.minecraft.client.renderer.entity.RenderLivingBase canRenderName

     Game functions, classes, statics and fields it uses:
     @use DPF net.minecraft.entity.Entity.setDead
     @use Gm9 net.minecraft.entity.player.InventoryPlayer.getCurrentItem
     @class Y4 net.minecraft.client.renderer.entity.RenderLivingBase
     @class Iz net.minecraft.entity.item.EntityEnderCrystal
     @static HUf net.minecraft.init.Items EXPERIENCE_BOTTLE
     @field dfw net.minecraft.util.MovementInputFromOptions.updatePlayerMoveState MovementInputFromOptions.gameSettings
     @field b23 net.minecraft.util.MovementInputFromOptions.updatePlayerMoveState GameSettings.keyBindSneak
     @field my net.minecraft.util.MovementInputFromOptions.updatePlayerMoveState KeyBinding.pressed
     @field U4 net.minecraft.util.MovementInputFromOptions.updatePlayerMoveState MovementInput.sneak
     @field Ps net.minecraft.util.MovementInputFromOptions.updatePlayerMoveState MovementInput.moveStrafe
     @field s_ net.minecraft.util.MovementInputFromOptions.updatePlayerMoveState MovementInput.moveForward
     @field bS8 net.minecraft.client.Minecraft.rightClickMouse Minecraft.rightClickDelayTimer
     @field cA net.minecraft.client.gui.GuiTextField.getText GuiTextField.text
     (EntityPlayer.inventory bw, ItemStack.getItem C51, getHeldItemOffhand EjD and Minecraft.player v
     are declared in thunder-client.js and thunder-combat.js.)
     ------------------------------------------------------------------------------------------- */
  // ---- Toggle Sneak ------------------------------------------------------------------------------
  var QL={sneak:false,sneakWas:false,world:null,chat:0,xpFrame:-1,xpCells:{},xpSkipped:0,crystals:0,masked:0};
  var origD8g=D8g;
  D8g=function(a){
    origD8g(a);
    if($rt_suspending())return;
    if(!S.toggleSneak){QL.sneak=false;return;}
    var gs=a.dfw,down=!!(gs&&gs.b23&&gs.b23.my);
    if(down&&!QL.sneakWas)QL.sneak=!QL.sneak;          // each press of the sneak key flips it
    QL.sneakWas=down;
    if(QL.sneak&&!a.U4){a.U4=1;a.Ps*=0.3;a.s_*=0.3;}
  };
  frameTasks.push(function(){
    var w=HEN&&HEN.X;
    if(w!==QL.world){QL.world=w;QL.sneak=false;}      // a new world or server starts standing
  });
  function sneakToggled(){return !!(S.toggleSneak&&QL.sneak);}

  // ---- Clear Chat: GuiNewChat.drawChat draws a black box behind every line with Gui.drawRect;
  // while it runs, the drawRect wrapper in thunder-theme.js leaves out pure black boxes ----------
  var origDYN=DYN;
  DYN=function(a,b){
    if(!$rt_resuming())QL.chat=S.clearChat?1:0;
    var ok=false,r;
    try{r=origDYN(a,b);ok=true;}
    finally{if(!ok||!$rt_suspending())QL.chat=0;}
    return r;
  };
  function clearChatSkips(color){return QL.chat===1&&(color&0xFFFFFF)===0;}

  // ---- Password Hider: the chat box draws "/login ******" while you type a password ----------
  var QL_PASS=/^(\/(?:login|l|log|register|reg|changepassword|changepass|cp|changepw|unregister|premium|2fa|email)\s)([\s\S]*)$/i;
  // the text a GuiTextField should show, or null to show its own (thunder-theme.js Dpy wrapper)
  function passwordMask(tf){
    if(!S.hidePasswords)return null;
    var t=tf.cA;
    if(t===null)return null;
    var s=$rt_ustr(t),m=QL_PASS.exec(s);
    if(!m||!m[2])return null;
    QL.masked++;
    return $rt_str(m[1]+m[2].replace(/\S/g,'*'));
  }

  // ---- Show Own Name Tag: RenderLivingBase.canRenderName says no for yourself when the camera is
  // your own eyes' entity (third person too); it is a virtual method, so its prototype slot is wrapped
  var qlNameProto=Y4.prototype,qlOrigCanRender=qlNameProto.dfg;
  qlNameProto.dfg=function(b){
    if(!$rt_resuming()&&S.ownName&&HEN&&b===HEN.v&&HEN.G&&HEN.G.lu!==0&&HEN.cm===null)return 1;
    return qlOrigCanRender.call(this,b);
  };

  // ---- Crystal Optimizer: PlayerControllerMP.attackEntity(player, target) sends the hit; an end
  // crystal is then removed on this screen straight away ------------------------------------------
  var origDzX=DzX;
  DzX=function(a,b,c){
    var r=origDzX(a,b,c);
    if(!$rt_suspending()&&S.crystalOpt&&c instanceof Iz){
      try{DPF(c);QL.crystals++;}catch(e){report(e);}
    }
    return r;
  };

  // ---- XP Orb Clumping: RenderXPOrb.doRender(renderer, orb, x, y, z, yaw, partialTicks) draws
  // only the first orb in each half-block cell per frame --------------------------------------------
  var qlFrame=0;
  frameTasks.push(function(){qlFrame++;});
  var origFoC=FoC;
  FoC=function(a,b,c,d,e,f,g){
    if(S.xpClumps&&!$rt_resuming()&&b){
      if(QL.xpFrame!==qlFrame){QL.xpFrame=qlFrame;QL.xpCells={};}
      var key=Math.floor(b.b*2)+','+Math.floor(b.f*2)+','+Math.floor(b.c*2);
      if(QL.xpCells[key]){QL.xpSkipped++;return;}
      QL.xpCells[key]=1;
    }
    return origFoC(a,b,c,d,e,f,g);
  };

  // ---- Fast XP: no right-click delay while a bottle o' enchanting is in either hand -------------
  frameTasks.push(function(){
    if(!S.fastXp||!HEN||!HEN.v||HEN.cm!==null||!HUf||HEN.bS8<=0)return;
    var p=HEN.v,main=p.bw?Gm9(p.bw):null,off=origEjD(p);
    if((main&&!CCI(main)&&C51(main)===HUf)||(off&&!CCI(off)&&C51(off)===HUf))HEN.bS8=0;
  });

  // ---- Menu Sounds: a short rising (open) or falling (close) electric sound -------------------
  var qlAudio=null;
  function menuSound(open){
    if(!S.menuSfx)return;
    var A=W.ThunderAmbient;
    if(A&&A.menuThunder){try{A.menuThunder(!!open);}catch(_){}return;}   // thunder, like the loading screen
    try{
      var AC=W.AudioContext||W.webkitAudioContext;if(!AC)return;
      if(!qlAudio)qlAudio=new AC();
      var c=qlAudio;
      if(c.state!=='running'){c.resume().catch(function(){});if(c.state!=='running')return;}
      var t=c.currentTime,o=c.createOscillator(),g=c.createGain(),bp=c.createBiquadFilter();
      o.type='sawtooth';
      o.frequency.setValueAtTime(open?320:760,t);o.frequency.exponentialRampToValueAtTime(open?900:260,t+0.12);
      bp.type='bandpass';bp.frequency.value=open?1400:900;bp.Q.value=1.2;
      g.gain.setValueAtTime(0.0001,t);g.gain.exponentialRampToValueAtTime(0.09,t+0.015);g.gain.exponentialRampToValueAtTime(0.0001,t+0.16);
      o.connect(bp);bp.connect(g);g.connect(c.destination);o.start(t);o.stop(t+0.17);
      // a crackle of noise on top, like a small spark
      var len=Math.floor(c.sampleRate*0.07),buf=c.createBuffer(1,len,c.sampleRate),d=buf.getChannelData(0);
      for(var i=0;i<len;i++)d[i]=(Math.random()*2-1)*(Math.random()<0.3?1:0.2)*(1-i/len);
      var n=c.createBufferSource(),hp=c.createBiquadFilter(),ng=c.createGain();
      n.buffer=buf;hp.type='highpass';hp.frequency.value=3000;ng.gain.value=0.05;
      n.connect(hp);hp.connect(ng);ng.connect(c.destination);n.start(t+(open?0.08:0));
    }catch(_){}
  }

  TC.qol={state:function(){return {sneak:QL.sneak,xpSkipped:QL.xpSkipped,crystals:QL.crystals,masked:QL.masked};}};
  MODULES.push(
    {cat:'movement',id:'toggleSneak',name:'Toggle Sneak',
      desc:'Press sneak once to keep sneaking, press it again to stop. The Sprint box shows when it is on.'},
    {cat:'visual',id:'clearChat',name:'Clear Chat',
      desc:'Removes the black box behind chat, so it sits right on the game. The text keeps its shadow and stays readable.'},
    {cat:'utility',id:'hidePasswords',name:'Password Hider',
      desc:'While you type /login, /register or /changepassword in chat, your password shows as stars on your screen. What you send is not changed.'},
    {cat:'visual',id:'ownName',name:'Show Own Name Tag',
      desc:'Your own name above your head in third person (F5), the way other players see it.'},
    {cat:'combat',id:'crystalOpt',name:'Crystal Optimizer',
      desc:'An end crystal you hit disappears on your screen straight away instead of waiting for the server, so you can place the next one sooner.'},
    {cat:'visual',id:'xpClumps',name:'XP Orb Clumping',
      desc:'XP orbs lying in the same spot are drawn once, so big piles of XP do not lower your FPS. Only the drawing changes; you still get all the XP.'},
    {cat:'combat',id:'fastXp',name:'Fast XP',
      desc:'Holding use with a bottle o\u2019 enchanting throws one every tick instead of every 4 ticks. Some servers may not like it.'},
    {cat:'utility',id:'menuSfx',name:'Menu Sounds',
      desc:'Thunder when the Right Shift menu opens (a near strike with a short roll) and a soft distant roll when it closes.'});
