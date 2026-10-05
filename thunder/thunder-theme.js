  /* -------------------------------------------------------------------------------------------
     Part of Thunder Client, created and owned by Jayvardhan Ginni (ThunderGamey).
     Thunder menus: every menu in the Thunder style instead of dirt and grey buttons.
     Included into the client scope of thunder-client.js by build.js, after thunder-title.js,
     whose storm (tbStorm) it draws.

     Backgrounds. GuiScreen.drawBackground, the dirt behind menus outside a world, draws the
     storm instead, a little darker than on the title screen.

     Lists (worlds, servers, video settings, resource packs, languages, ...). GuiSlot.drawScreen
     paints the whole screen itself: the list area in dark dirt, then a dirt band above and one
     below that hide rows scrolled under them. When a list binds the dirt texture for its area,
     the storm is drawn under that area (outside a world) and a see-through dark glass texture is
     bound in place of the dirt. The bands (overlayBackground) repaint the storm in their own
     area with a dark tint and a thin cyan edge, so scrolled rows stay hidden. In a world the
     glass and the bands lie over the world instead of the storm.

     Buttons and sliders. While GuiButton.drawButton runs, binding widgets.png binds a Thunder
     copy of its button rows instead: dark glass with a cyan edge, brighter on hover, dim when
     disabled. A second bind inside the same button is a slider drawing its knob, which gets a
     cyan knob. Labels turn white on hover instead of yellow. The language button (a globe)
     gets a Thunder globe button the same way. Buttons that draw other art of their own (lock,
     recipe book, book pages, beacon, trades) keep it, and the hotbar and everything else that
     uses widgets.png are not touched.

     Text boxes: a cyan border (brighter while typing in it) on dark glass instead of grey on
     black; only the two rectangles GuiTextField.drawTextBox draws are recoloured. Edit Profile
     draws its skin preview and skin list with the same grey-on-black rectangles, which get the
     same colours while that screen draws. Credits: its paper panel becomes dark glass, its dark
     grey text light, its scrollbar cyan.

     Right Shift > Visual > Thunder Menus switches the whole thing, the storm and the buttons.

     Game functions this module replaces (each wrapper falls through to the original):
     @hook D17 net.minecraft.client.renderer.texture.TextureManager.bindTexture
     @hook D49 net.minecraft.client.gui.Gui.drawRect
     @hook Ck1 net.minecraft.client.gui.Gui.drawCenteredString
     @hook DPp net.minecraft.client.gui.GuiScreen.drawBackground
     @hook Eco net.minecraft.client.gui.GuiSlot.overlayBackground
     @hook GkZ net.minecraft.client.gui.GuiSlot.bindAmountScrolled
     @hook Dpy net.minecraft.client.gui.GuiTextField.drawTextBox
     @hook EEc net.minecraft.client.gui.GuiButton.func_191745_a (drawButton)
     @class B3 net.minecraft.client.gui.GuiButton
     @class BF$ net.minecraft.client.gui.GuiButtonLanguage
     @hook Efa net.minecraft.client.gui.FontRenderer.drawString
     @class Zj net.lax1dude.eaglercraft.profile.GuiScreenEditProfile
     @class UF net.peyton.eagler.gui.GuiCredits
     @class ID net.minecraft.client.gui.inventory.GuiContainer
     @field iX net.minecraft.util.ResourceLocation.getResourcePath ResourceLocation.resourcePath
     @virtual dK net.lax1dude.eaglercraft.profile.GuiScreenEditProfile drawScreen
     @virtual dK net.peyton.eagler.gui.GuiCredits drawScreen
     @virtual VV net.minecraft.client.gui.GuiButton func_191745_a

     Textures it redirects:
     @static H3m net.minecraft.client.gui.Gui OPTIONS_BACKGROUND (textures/gui/options_background.png)
     @static Ly$ net.minecraft.client.gui.GuiButton BUTTON_TEXTURES (textures/gui/widgets.png)
     @static LGh net.peyton.eagler.gui.GuiCredits (textures/gui/demo_background.png, the credits panel)

     Instance fields:
     @field j net.minecraft.client.gui.GuiScreen.drawBackground GuiScreen.mc
     @field q net.minecraft.client.gui.GuiScreen.drawBackground GuiScreen.width
     @field L net.minecraft.client.gui.GuiScreen.drawBackground GuiScreen.height
     @field JJ net.minecraft.client.gui.GuiTextField.drawTextBox GuiTextField.isFocused
     @field lk net.minecraft.client.gui.GuiSlot.overlayBackground GuiSlot.mc
     @field rr net.minecraft.client.gui.GuiSlot.overlayBackground GuiSlot.left
     @field k8 net.minecraft.client.gui.GuiSlot.overlayBackground GuiSlot.width
     @field LK net.minecraft.client.gui.GuiSlot.drawScreen GuiSlot.right
     @field iS net.minecraft.client.gui.GuiSlot.drawScreen GuiSlot.top
     @field ml net.minecraft.client.gui.GuiSlot.drawScreen GuiSlot.bottom
     @field c0y net.minecraft.client.gui.GuiSlot.drawScreen GuiSlot.height
  ------------------------------------------------------------------------------------------- */

  // ---- textures --------------------------------------------------------------------------------
  // Colours are ARGB. A button is 200x20 texels (one texel = one GUI pixel); the game draws its
  // left half and its right half, so the art must also work cut in the middle.
  var TH_BTN={
    disabled:{border:0x66606C78,top:0x990D131B,bot:0x99090E14,hi:0x14FFFFFF,glow:0},
    normal:{border:0xCC3AA0D8,top:0xB81A2C42,bot:0xB80E1826,hi:0x4DFFFFFF,glow:0},
    hover:{border:0xFF72E0FF,top:0xD0214466,bot:0xD0142C48,hi:0x66FFFFFF,glow:0x9954CCF5}};
  function thMix(a,b,t){
    var r=0,sh;
    for(sh=0;sh<32;sh+=8){
      var x=(a>>>sh)&255,y=(b>>>sh)&255;
      r+=Math.round(x+(y-x)*t)*Math.pow(2,sh);
    }
    return r;
  }
  // one rounded panel of w x h texels at (x0,y0) in a W-wide texture: 1px border (corners left
  // clear), an optional inner glow line, a highlight line under the top edge and a vertical
  // gradient fill
  function thPanel(d,W,x0,y0,w,h,st){
    for(var y=0;y<h;y++)for(var x=0;x<w;x++){
      var ex=x===0||x===w-1,ey=y===0||y===h-1,c;
      if(ex&&ey)continue;
      if(ex||ey)c=st.border;
      else if(st.glow&&(x===1||x===w-2||y===1||y===h-2))c=st.glow;
      else if(y===(st.glow?2:1))c=st.hi;
      else c=thMix(st.top,st.bot,(y-1)/Math.max(1,h-3));
      d[(y0+y)*W+x0+x]=tlABGR(c);
    }
  }
  function thPaintButtons(d){
    for(var i=0;i<d.length;i++)d[i]=0;
    thPanel(d,256,0,46,200,20,TH_BTN.disabled);
    thPanel(d,256,0,66,200,20,TH_BTN.normal);
    thPanel(d,256,0,86,200,20,TH_BTN.hover);
    thGlobe(d,106,TH_BTN.normal,0xFFA8E6FF);           // the language button: 20x20 at (0,106),
    thGlobe(d,126,TH_BTN.hover,0xFFFFFFFF);            // (0,126) while hovered
  }
  // a 20x20 button with a globe: outline, equator, two parallels and a meridian ellipse
  function thGlobe(d,y0,st,ink){
    thPanel(d,256,0,y0,20,20,st);
    for(var y=0;y<20;y++)for(var x=0;x<20;x++){
      var dx=x-9.5,dy=y-9.5,r=Math.sqrt(dx*dx+dy*dy);
      if(r>6.3)continue;
      var e=dx/2.7,f=dy/5.9,m=e*e+f*f;
      if(Math.abs(r-5.8)<0.55||(Math.abs(dy)<0.5)||(Math.abs(Math.abs(dy)-3.0)<0.5&&r<5.4)||
        Math.abs(m-1)<0.22||Math.abs(dx)<0.5)d[(y0+y)*256+x]=tlABGR(ink);
    }
  }
  // slider knob, 8x20: sliders draw its left 4 columns from (0,66) and its right 4 from (196,66)
  function thPaintKnob(d){
    for(var i=0;i<d.length;i++)d[i]=0;
    var k=new Array(8*20),x,y;
    thPanel(k,8,0,0,8,20,{border:0xFF06121C,top:0xFF8FE9FF,bot:0xFF2A9FD8,hi:0xFFE6FBFF,glow:0});
    for(y=0;y<20;y++)for(x=0;x<4;x++){
      if(k[y*8+x])d[(66+y)*256+x]=k[y*8+x];
      if(k[y*8+4+x])d[(66+y)*256+196+x]=k[y*8+4+x];
    }
  }
  // list glass: lists tint this texture with vertex colour 32/255 (the bands use 64), so its
  // colour is kept light and blue for a dark navy result; alpha 0.55 lets the storm through
  function thPaintGlass(d){
    for(var i=0;i<d.length;i++){
      var n=((i*7919)%13)-6;
      d[i]=tlABGR(0x8C000000+(120+n)*65536+(190+n)*256+255);
    }
  }
  // credits panel: the 248x166 part of demo_background.png the credits screen draws
  function thPaintCredits(d){
    for(var i=0;i<d.length;i++)d[i]=0;
    thPanel(d,256,0,0,248,166,{border:0xFF3AA0D8,top:0xE8101C2C,bot:0xE80A121C,hi:0x40FFFFFF,glow:0x5054CCF5});
  }
  var thTex=[{name:'thunder_buttons',w:256,h:256,fill:thPaintButtons,loc:null},
    {name:'thunder_knob',w:256,h:256,fill:thPaintKnob,loc:null},
    {name:'thunder_glass',w:16,h:16,fill:thPaintGlass,loc:null},
    {name:'thunder_credits',w:256,h:256,fill:thPaintCredits,loc:null}];
  var thBtnTex=thTex[0],thKnobTex=thTex[1],thGlassTex=thTex[2],thCreditsTex=thTex[3];
  var thState=0;          // 0 not made, 1 being made, 2 ready
  function thMake(){
    var tm=HEN.bH,steps=[];
    thState=1;
    thTex.forEach(function(T){
      var tex=new YW();
      steps.push(function(){Fl7(tex,T.w,T.h);},function(){T.fill(tex.a45.data);},function(){Egf(tex);},
        function(){var r=EpG(tm,$rt_str(T.name),tex);if(!$rt_suspending())T.loc=r;});
    });
    steps.push(function(){thState=2;});
    runOnGame(steps);
  }

  // ---- state -------------------------------------------------------------------------------------
  var thBtnDepth=0,thBtnBinds=0,thLangDepth=0,thTf=0,thTfFocus=false,thProfile=0,thCredits=0,thSlot=null;
  frameTasks.push(function(){
    thBtnDepth=0;thLangDepth=0;thTf=0;thProfile=0;thCredits=0;   // nothing is being drawn between frames
    if(thState===0&&S.menuTheme&&HEN&&HEN.bH)thMake();
  });
  function thButtonsOn(){return !!(S.menuTheme&&S.menuButtons&&thState===2);}
  // Thunder backgrounds: the storm when it is on and can run here, otherwise a plain dark blue
  function thBgOn(){return !!(S.menuTheme&&thState===2);}
  function thStormOn(){return !!(thBgOn()&&S.menuStorm&&!tbFail&&HEl&&HEv>=300);}
  // the storm over [x0,y0]-[x1,y1] in GUI coordinates of a list whose screen is `hgt` GUI pixels tall
  function thStormRect(mc,hgt,x0,y0,x1,y1){
    if(!thStormOn()){D49(x0,y0,x1,y1,0xFF0A111B|0);return;}
    var fw=mc.gj|0,fh=mc.fU|0,sc=hgt>0?fh/hgt:1;
    var px=Math.max(0,Math.floor(x0*sc)),py=Math.max(0,Math.floor(fh-y1*sc));
    var pw=Math.min(fw,Math.ceil(x1*sc))-px,ph=Math.min(fh,Math.ceil(fh-y0*sc))-py;
    if(pw>0&&ph>0&&!tbStorm(mc,0.8,[px,py,pw,ph]))D49(x0,y0,x1,y1,0xFF0A111B|0);
  }

  // ---- hooks -------------------------------------------------------------------------------------
  // menus outside a world: the storm instead of dirt
  var origDPp=DPp;
  DPp=function(a,b){
    if(!$rt_resuming()&&thBgOn()&&a&&a.j){
      if(!thStormOn()||!tbStorm(a.j,0.8,null))DNB(a,0,0,a.q,a.L,0xFF0C1624|0,0xFF05080E|0);   // plain dark blue
      return;
    }
    return origDPp(a,b);
  };
  // the list about to be drawn (bindAmountScrolled runs right before a list paints its area)
  var origGkZ=GkZ;
  GkZ=function(a){
    if(!$rt_resuming())thSlot=a;
    return origGkZ(a);
  };
  // Dark Containers (Visual): inventories, chests, furnaces and every other container screen
  // draw their background texture darkened (a colour multiplier set right after the texture is
  // bound; the game sets white again before its next drawing), and their grey titles light
  var thDarkTex=(typeof WeakMap==='function')?new WeakMap():null;
  function thContainerTex(b){
    var r=thDarkTex?thDarkTex.get(b):undefined;
    if(r===undefined){
      var p=b.iX,t=p!==null?$rt_ustr(p):'';
      r=t.indexOf('textures/gui/container/')===0||t==='textures/gui/recipe_book.png';
      if(thDarkTex)thDarkTex.set(b,r);
    }
    return r;
  }
  function thDarkOn(){return !!(S.darkContainers&&HEN&&HEN.cm instanceof ID);}
  var origD17=D17;
  D17=function(a,b){
    var dark=!$rt_resuming()&&b!==null&&thDarkOn()&&thContainerTex(b);
    if(dark){var r0=origD17(a,b);if(!$rt_suspending())CFi(0.34,0.38,0.46,1.0);return r0;}
    if(!$rt_resuming()&&b!==null){
      if(b===LGh&&thCredits>0){
        if(thButtonsOn())b=thCreditsTex.loc;
      }else if(b===Ly$&&(thBtnDepth>0||thLangDepth>0)){
        if(thButtonsOn())b=thLangDepth>0||++thBtnBinds<2?thBtnTex.loc:thKnobTex.loc;
      }else if(b===H3m&&thBgOn()){
        // a list area (or another screen's own dirt, like the credits): storm under it, glass on it
        var mc=HEN,s=thSlot;thSlot=null;
        if(mc&&!mc.X){
          if(s&&s.lk)thStormRect(mc,s.c0y,s.rr,s.iS,s.LK,s.ml);
          else if(!thStormOn()||!tbStorm(mc,0.8,null))D49(0,0,4096,4096,0xFF0A111B|0);
        }
        CyN();B$o(770,771,1,0);
        b=thGlassTex.loc;
      }
    }
    return origD17(a,b);
  };
  // list header and footer bands: the storm again, darker, with a cyan edge toward the list
  var origEco=Eco;
  Eco=function(a,b,c,d,e){
    if(!$rt_resuming()&&thBgOn()&&a&&a.lk){
      var mc=a.lk,x0=a.rr,x1=a.rr+a.k8;
      if(!mc.X)thStormRect(mc,a.c0y,x0,b,x1,c);    // the same storm as the rest of the screen
      else D49(x0,b,x1,c,0xF2080C12|0);
      if(b===0)D49(x0,c-1,x1,c,0x6040B8F0);else D49(x0,b,x1,b+1,0x6040B8F0);
      return;
    }
    return origEco(a,b,c,d,e);
  };
  // buttons: the Thunder button art while one draws (see D17). drawButton is reached both as a
  // virtual call (GuiScreen.drawScreen) and as a direct call where the compiler knew the button
  // type (option list rows), so the function itself is wrapped and GuiButton's virtual slot,
  // which kept the original function, now calls the wrapper.
  var origEEc=EEc;
  EEc=function(a,b,c,d,e){
    if(!$rt_resuming()){thBtnDepth++;thBtnBinds=0;}
    var ok=false,r;
    try{r=origEEc(a,b,c,d,e);ok=true;}
    finally{if(!ok||!$rt_suspending())thBtnDepth=Math.max(0,thBtnDepth-1);}
    return r;
  };
  B3.prototype.VV=function(b,c,d,e){return EEc(this,b,c,d,e);};
  var thLangProto=BF$.prototype,thOrigLangVV=thLangProto.VV;
  thLangProto.VV=function(b,c,d,e){
    if(!$rt_resuming())thLangDepth++;
    var ok=false,r;
    try{r=thOrigLangVV.call(this,b,c,d,e);ok=true;}
    finally{if(!ok||!$rt_suspending())thLangDepth=Math.max(0,thLangDepth-1);}
    return r;
  };
  // button labels: light blue-white, white on hover (vanilla yellow), dim grey when disabled
  var origCk1=Ck1;
  Ck1=function(a,b,c,d,e,f){
    if(thBtnDepth>0&&!$rt_resuming()&&thButtonsOn()){
      if(f===14737632)f=0xE8F2FF;else if(f===16777120)f=0xFFFFFF;else if(f===10526880)f=0x6E7C8A;
    }
    return origCk1(a,b,c,d,e,f);
  };
  // text boxes: remember which one is drawing and whether it is focused (see D49)
  // Password Hider (thunder-qol.js): the box draws stars in place of the password; its own text
  // is put back as soon as the drawing is done
  var thPw={field:null,text:null};
  var origDpy=Dpy;
  Dpy=function(a){
    if(!$rt_resuming()){
      thTf++;thTfFocus=!!a.JJ;
      try{var pw=passwordMask(a);if(pw!==null){thPw.field=a;thPw.text=a.cA;a.cA=pw;}}catch(e){report(e);}
    }
    var ok=false,r;
    try{r=origDpy(a);ok=true;}
    finally{
      if(!ok||!$rt_suspending()){
        thTf=Math.max(0,thTf-1);
        if(thPw.field===a){a.cA=thPw.text;thPw.field=null;thPw.text=null;}
      }
    }
    return r;
  };
  // Edit Profile: its own grey-on-black boxes (skin preview, skin list) get the same colours
  var thProfileProto=Zj.prototype,thOrigProfileDraw=thProfileProto.dK;
  thProfileProto.dK=function(b,c,d){
    if(!$rt_resuming())thProfile++;
    var ok=false,r;
    try{r=thOrigProfileDraw.call(this,b,c,d);ok=true;}
    finally{if(!ok||!$rt_suspending())thProfile=Math.max(0,thProfile-1);}
    return r;
  };
  // Credits: dark glass panel (see D17), light text and a cyan scrollbar while it draws
  var thCreditsProto=UF.prototype,thOrigCreditsDraw=thCreditsProto.dK;
  thCreditsProto.dK=function(b,c,d){
    if(!$rt_resuming())thCredits++;
    var ok=false,r;
    try{r=thOrigCreditsDraw.call(this,b,c,d);ok=true;}
    finally{if(!ok||!$rt_suspending())thCredits=Math.max(0,thCredits-1);}
    return r;
  };
  // dark formatting colours (dark blue, red, green, ...) read badly on the dark panel: their
  // bright versions instead
  var TH_BRIGHT={'0':'f','1':'9','2':'a','3':'b','4':'c','5':'d','8':'7'};
  var origEfa=Efa;
  Efa=function(a,b,c,d,e){
    if(e===4210752&&!$rt_resuming()&&thDarkOn())e=0xE2EAF2;   // container titles on the dark background
    if(thCredits>0&&!$rt_resuming()&&thButtonsOn()){
      if(e===4210784)e=0xDCE6F0;
      if(b!==null){
        var t=$rt_ustr(b),u=t.replace(/\u00a7([0-5]|8)/g,function(m,k){return '\u00a7'+TH_BRIGHT[k];});
        if(u!==t)b=$rt_str(u);
      }
    }
    return origEfa(a,b,c,d,e);
  };
  var origD49=D49;
  D49=function(a,b,c,d,e){
    if(!$rt_resuming()){var ce=chatRowColor(a,b,c,d,e);if(ce!==null)return origD49(a,b,c,d,ce);}   // Chat Tools (thunder-chat.js)
    if(clearChatSkips(e)&&!$rt_resuming())return;              // Clear Chat (thunder-qol.js)
    if(thCredits>0&&!$rt_resuming()&&thButtonsOn()){
      if(e===855638048)e=0x33FFFFFF;else if(e===1711276032)e=0xCC40B8F0|0;   // scrollbar track, thumb
    }
    if((thTf>0||thProfile>0)&&!$rt_resuming()&&thButtonsOn()){
      if(e===-6250336)e=thTf>0&&thTfFocus?(0xFF5FD1FF|0):(0xFF2F6384|0);   // grey border
      else if(e===-16777216)e=0xF0070C14|0;                                 // black inside
      else if(e===-16777195)e=0xE0070C14|0;                                 // skin preview
      else if(e===-7829368&&thProfile>0)e=0xFF1E5C80|0;                     // selected skin
    }
    return origD49(a,b,c,d,e);
  };

  // ---- menu ----------------------------------------------------------------------------------------
  MODULES.push({cat:'visual',id:'menuTheme',name:'Thunder Menus',
    desc:'Thunder look for every menu: storm backgrounds, glass lists, Thunder buttons, sliders and text boxes.',opts:[
      {id:'menuStorm',name:'Storm backgrounds (off: plain dark, fastest)'},
      {id:'menuButtons',name:'Thunder buttons'}]});
  MODULES.push({cat:'visual',id:'darkContainers',name:'Dark Inventories',
    desc:'Dark mode for your inventory, chests, furnaces and every other container screen, with light titles. Works with any resource pack.'});
  TC.theme={state:function(){return {made:thState,buttons:thButtonsOn(),bg:thBgOn(),storm:thStormOn(),frame:tbFrameId,
    locs:thTex.map(function(T){return !!T.loc;})};}};
