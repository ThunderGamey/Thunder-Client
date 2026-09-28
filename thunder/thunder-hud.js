  /* -------------------------------------------------------------------------------------------
     Part of Thunder Client, created and owned by Jayvardhan Ginni (ThunderGamey).
     HUD widgets and the HUD editor. Included into the client scope of thunder-client.js.

     Every HUD module (FPS, CPS, coordinates, direction, speed, food, sprint, clock, memory,
     potion effects, keystrokes) is a widget: with Thunder style on, a dark glass box with a thin
     cyan edge (keys light up cyan while held), drawn by the game's own GUI code like the rest of
     the HUD. Each widget can be moved and resized in the HUD editor (Right Shift > HUD >
     HUD Style & Layout > Edit HUD Layout): drag a box to move it, scroll over it to resize it,
     right-click it to put it back. A position is kept as a fraction of the free space on each
     axis, so a box against an edge stays against that edge in any window size. Widgets that were
     never moved stack in their default column (left, right, or keystrokes at the bottom right).

     @virtual dK net.minecraft.client.gui.GuiIngameMenu drawScreen
     (GuiIngameMenu Bxj is declared in thunder-lan.js.)
     Ping (the latency the server reports for you in the tab list):
     @use E3T net.minecraft.client.network.NetHandlerPlayClient.getPlayerInfo
     @use DNH net.minecraft.entity.Entity.getUniqueID
     @field d9 net.minecraft.client.Minecraft.getConnection EntityPlayerSP.connection
     @field bzP net.minecraft.client.gui.GuiPlayerTabOverlay.drawPing NetworkPlayerInfo.responseTime
     ------------------------------------------------------------------------------------------- */
  var HUD_KEY='thunderHudLayout_v1';
  var hudLayout={};
  try{var hl0=JSON.parse(W.localStorage.getItem(HUD_KEY)||'{}');if(hl0&&typeof hl0==='object')hudLayout=hl0;}catch(_){}
  function hudSave(){try{W.localStorage.setItem(HUD_KEY,JSON.stringify(hudLayout));}catch(_){}}
  var hudRects={},hudScreen={w:0,h:0},hudEditing=false;
  var HB_BG=0x6605070D|0,HB_EDGE=0x734FD1FF|0,HB_TEXT=0xCFEEFF,HB_LABEL=0x5FD7FF,
    HB_KEY=0x990A0E18|0,HB_KEY_ON=0xC04FD1FF|0,HB_GLOW=0x404FD1FF|0,HB_KEY_TEXT_ON=0x061019;
  // default column: 0 left stack, 1 right stack, 2 bottom right, 3 beside the hotbar just above
  // the held-item / off-hand slot there, 4 right side a little above the middle
  var HUD_WIDGETS=[
    {id:'fps',name:'FPS',col:0},{id:'ping',name:'Ping',col:0},{id:'cps',name:'CPS',col:0},{id:'coords',name:'Coordinates',col:0},
    {id:'direction',name:'Direction',col:0},{id:'speed',name:'Speed',col:0},{id:'hunger',name:'Food',col:0},
    {id:'sprintStatus',name:'Sprint',col:0},{id:'clock',name:'Clock',col:1},{id:'memory',name:'Memory',col:1},
    {id:'effects',name:'Potion Effects',col:1},{id:'keystrokes',name:'Keystrokes',col:2}
  ];
  // widgets other modules add: {id (its setting), name, col, content(ctx) -> data or null,
  // size(ctx,data,themed) -> {w,h}, draw(ctx,data,themed)}; see hudExtra
  var HUD_EXTRA=[];
  function hudExtra(e){HUD_EXTRA.push(e);HUD_WIDGETS.push({id:e.id,name:e.name,col:e.col});}

  function hudEdge(x,y,w,h,c){rect(x,y,x+w,y+1,c);rect(x,y+h-1,x+w,y+h,c);rect(x,y+1,x+1,y+h-1,c);rect(x+w-1,y+1,x+w,y+h-1,c);}
  function hudBox(x,y,w,h){rect(x,y,x+w,y+h,HB_BG);hudEdge(x,y,w,h,HB_EDGE);}

  // what each enabled widget shows this frame: {lines:[[label,value,color]]} or {keys:true}
  function hudContent(ctx){
    var player=ctx.player,out={},px=player.b,py=player.f,pz=player.c;
    var havePos=typeof px==='number'&&typeof py==='number'&&typeof pz==='number';
    function one(id,label,value,color){out[id]={lines:[[label,value,color==null?0xFFFFFF:color]]};}
    if(S.fps)one('fps','FPS',String(gameFps()));
    if(S.ping){
      try{
        var conn=player.d9,info=conn?E3T(conn,DNH(player)):null,ms=info?info.bzP|0:-1;
        one('ping','Ping',ms>=0?ms+' ms':'-',ms<0?0xAAAAAA:ms<100?0x55FF55:ms<250?0xFFE070:0xFF6060);
      }catch(_){}
    }
    if(S.cps)one('cps','CPS',String(clicks.length));
    if(S.coords&&havePos)one('coords','XYZ',fmt1(px)+' / '+fmt1(py)+' / '+fmt1(pz));
    if(S.direction&&typeof player.C==='number'){
      var f=Math.floor(player.C*4/360+0.5)&3;
      one('direction','Facing',['South (+Z)','West (-X)','North (-Z)','East (+X)'][f]);
    }
    if(S.speed)one('speed','Speed',fmt1(speed)+' b/s');
    if(S.hunger){try{one('hunger','Food',String(ZP(FAU(player))),0xFFAA00);}catch(_){}}
    if(S.sprintStatus){
      var sp=!!CBg(player);one('sprintStatus','Sprint',sp?'ON':'OFF',sp?0x55FF55:0xAAAAAA);
      if(sneakToggled())out.sprintStatus.lines.push(['Sneak','TOGGLED',0xFFE04A]);   // Toggle Sneak (thunder-qol.js)
    }
    if(S.clock){var d=new Date();one('clock','',pad2(d.getHours())+':'+pad2(d.getMinutes())+':'+pad2(d.getSeconds()));}
    if(S.memory){
      try{var pm=W.performance&&W.performance.memory;if(pm&&pm.usedJSHeapSize)one('memory','Mem',Math.round(pm.usedJSHeapSize/1048576)+' MB');}catch(_){}
    }
    if(S.effects){
      var lines=[];
      try{var it=F9v(player).O(),n=0;while(it.B()&&n<24){lines.push(['',effectLine(it.z()),0xFFFFFF]);n++;}}catch(_){}
      if(!lines.length&&hudEditing)lines.push(['','Speed II 1:30',0xFFFFFF]);   // something to place
      if(lines.length)out.effects={lines:lines};
    }
    if(S.keystrokes)out.keystrokes={keys:true};
    for(var x=0;x<HUD_EXTRA.length;x++){
      var e=HUD_EXTRA[x];
      if(!S[e.id])continue;
      try{var c=e.content(ctx);if(c){c.custom=e;out[e.id]=c;}}catch(err){report(err);}
    }
    return out;
  }
  function hudLineText(l){return l[0]?l[0]+' '+l[1]:l[1];}
  function hudSize(ctx,c,themed){
    if(c.custom)return c.custom.size(ctx,c,themed);
    if(c.keys)return themed?{w:46,h:54}:{w:46,h:34};
    var w=0;
    for(var i=0;i<c.lines.length;i++)w=Math.max(w,textWidth(ctx.font,hudLineText(c.lines[i])));
    return themed?{w:w+8,h:c.lines.length*10+3}:{w:w,h:c.lines.length*10-1};
  }
  function hudDrawLines(ctx,c,themed){
    var x0=themed?4:0,y=themed?2:0,i,l;
    for(i=0;i<c.lines.length;i++,y+=10){
      l=c.lines[i];
      if(l[0]){
        text(ctx.font,l[0],x0,y,themed?HB_LABEL:0xFFFFFF);
        text(ctx.font,l[1],x0+textWidth(ctx.font,l[0]+' '),y,l[2]);
      }else text(ctx.font,l[1],x0,y,l[2]);
    }
  }
  function hudKey(ctx,label,down,x,y,w,h,themed){
    if(themed){
      if(down)rect(x-1,y-1,x+w+1,y+h+1,HB_GLOW);
      rect(x,y,x+w,y+h,down?HB_KEY_ON:HB_KEY);
      hudEdge(x,y,w,h,HB_EDGE);
    }
    if(label)text(ctx.font,label,x+((w-textWidth(ctx.font,label))>>1),y+((h-8)>>1)+(themed?1:0),down?(themed?HB_KEY_TEXT_ON:0x55FF55):(themed?HB_TEXT:0xFFFFFF));
  }
  function hudDrawKeys(ctx,themed){
    var up=keyState.KeyW||keyState.ArrowUp,lf=keyState.KeyA||keyState.ArrowLeft,
      dn=keyState.KeyS||keyState.ArrowDown,rt=keyState.KeyD||keyState.ArrowRight;
    if(themed){
      hudKey(ctx,'W',up,16,0,14,14,1);
      hudKey(ctx,'A',lf,0,16,14,14,1);hudKey(ctx,'S',dn,16,16,14,14,1);hudKey(ctx,'D',rt,32,16,14,14,1);
      hudKey(ctx,'LMB',mouseState[0],0,32,22,12,1);hudKey(ctx,'RMB',mouseState[2],24,32,22,12,1);
      hudKey(ctx,'',keyState.Space,0,46,46,8,1);
    }else{
      hudKey(ctx,'W',up,16,0,14,10,0);
      hudKey(ctx,'A',lf,0,12,14,10,0);hudKey(ctx,'S',dn,16,12,14,10,0);hudKey(ctx,'D',rt,32,12,14,10,0);
      hudKey(ctx,'LMB',mouseState[0],0,24,22,10,0);hudKey(ctx,'RMB',mouseState[2],24,24,22,10,0);
    }
  }
  // lay out and draw every enabled widget
  function hudWidgets(ctx){
    var themed=!!S.hudTheme,content=hudContent(ctx),W0=ctx.w,H0=ctx.h,cur=[5+mmReserve(W0,1),5+mmReserve(W0,0)],rects={};
    hudScreen.w=W0;hudScreen.h=H0;
    for(var i=0;i<HUD_WIDGETS.length;i++){
      var wd=HUD_WIDGETS[i],c=content[wd.id];
      if(!c)continue;
      var sz=hudSize(ctx,c,themed),L=hudLayout[wd.id],s=L&&L.s>0?clamp(L.s,0.5,3):1;
      var w=sz.w*s,h=sz.h*s,x,y;
      if(L&&typeof L.ax==='number'){x=clamp(L.ax,0,1)*Math.max(0,W0-w);y=clamp(L.ay,0,1)*Math.max(0,H0-h);}
      else if(wd.col===2){x=W0-w-5;y=H0-h-26;}                 // above the hotbar row
      else if(wd.col===3){x=clamp(ctx.cx+91+6,0,Math.max(0,W0-w));y=H0-h-25;}
      else if(wd.col===4){x=W0-w-5;y=Math.max(5,Math.round(H0*0.42-h/2));}
      else{x=wd.col?W0-w-5:5;y=cur[wd.col];cur[wd.col]+=h+(themed?2:1);}
      rects[wd.id]={x:x,y:y,w:w,h:h,s:s,name:wd.name};
      opPush();op(DPm,x,y,0);if(s!==1)op(FWK,s,s,1);
      if(c.keys)hudDrawKeys(ctx,themed);
      else if(c.custom)c.custom.draw(ctx,c,themed,sz);
      else{if(themed)hudBox(0,0,sz.w,sz.h);hudDrawLines(ctx,c,themed);}
      opPop();
    }
    hudRects=rects;
  }

  // ---- editor (DOM overlay over the game) --------------------------------------------------------
  var HUD_CSS=[
    '#thunder-hud-editor{position:fixed;inset:0;z-index:2147483600;cursor:default;font:12px/1.3 "Segoe UI",system-ui,sans-serif;',
      'background:repeating-linear-gradient(0deg,rgba(79,209,255,.05) 0 1px,transparent 1px 16px),',
      'repeating-linear-gradient(90deg,rgba(79,209,255,.05) 0 1px,transparent 1px 16px);user-select:none}',
    '#thunder-hud-editor .the-bar{position:absolute;left:50%;top:14px;transform:translateX(-50%);display:flex;align-items:center;gap:12px;',
      'padding:9px 12px 9px 16px;border-radius:12px;background:rgba(7,12,19,.92);border:1px solid rgba(79,209,255,.35);',
      'box-shadow:0 8px 30px rgba(0,0,0,.45),0 0 22px rgba(79,209,255,.18);color:#cfeeff;white-space:nowrap;',
      'pointer-events:none;z-index:1;opacity:.93}',
    '#thunder-hud-editor .the-bar button{pointer-events:auto}',
    '#thunder-hud-editor .the-bar b{color:#f1faff;letter-spacing:.08em}',
    '#thunder-hud-editor .the-bar span{color:#7f9bb0}',
    '#thunder-hud-editor button{font:inherit;font-weight:700;border:1px solid rgba(79,209,255,.4);border-radius:8px;padding:6px 12px;',
      'background:rgba(79,209,255,.12);color:#e6f8ff;cursor:pointer}',
    '#thunder-hud-editor button:hover{background:rgba(79,209,255,.25)}',
    '#thunder-hud-editor button.the-done{background:linear-gradient(135deg,#8cecff,#3fb6ff);color:#061019;border-color:transparent}',
    '#thunder-hud-editor .the-box{position:absolute;box-sizing:border-box;border:1px dashed rgba(79,209,255,.85);border-radius:3px;',
      'background:rgba(79,209,255,.08);cursor:move}',
    '#thunder-hud-editor .the-box:hover,#thunder-hud-editor .the-box.the-drag{background:rgba(79,209,255,.2);border-style:solid;',
      'box-shadow:0 0 14px rgba(79,209,255,.5)}',
    '#thunder-hud-editor .the-tag{position:absolute;left:0;bottom:100%;margin-bottom:3px;padding:1px 6px;border-radius:5px;',
      'background:rgba(7,12,19,.9);color:#8cecff;font-size:10.5px;white-space:nowrap;pointer-events:none;opacity:0;transition:opacity .12s}',
    '#thunder-hud-editor .the-box:hover .the-tag,#thunder-hud-editor .the-box.the-drag .the-tag{opacity:1}',
    '#thunder-hud-editor .the-guide{position:absolute;background:rgba(255,216,74,.8);pointer-events:none;display:none}',
    '#thunder-hud-editor .the-empty{position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);padding:14px 18px;border-radius:12px;',
      'background:rgba(7,12,19,.9);border:1px solid rgba(79,209,255,.3);color:#cfeeff;display:none}'
  ].join('');
  var HE=null;
  function hudCanvas(){
    var cs=D.querySelectorAll('#game_frame canvas'),best=null,a=0;
    for(var i=0;i<cs.length;i++){var r=cs[i].getBoundingClientRect(),s=r.width*r.height;if(s>a){a=s;best=r;}}
    return best;
  }
  function hudEditOpen(){
    if(HE)return;
    if(menuOpen)hideMenu();
    if(!D.getElementById('thunder-hud-editor-style')){
      var st=D.createElement('style');st.id='thunder-hud-editor-style';st.textContent=HUD_CSS;(D.head||D.documentElement).appendChild(st);
    }
    var ov=el('div');ov.id='thunder-hud-editor';
    var bar=el('div','the-bar');
    bar.appendChild(el('b',null,'HUD EDITOR'));
    bar.appendChild(el('span',null,'Drag to move \u2022 scroll to resize \u2022 right-click to reset'));
    var rs=el('button',null,'Reset all');rs.type='button';
    rs.addEventListener('click',function(e){e.stopPropagation();hudLayout={};hudSave();});
    var dn=el('button','the-done','Done');dn.type='button';
    dn.addEventListener('click',function(e){e.stopPropagation();hudEditClose();});
    bar.appendChild(rs);bar.appendChild(dn);
    ov.appendChild(bar);
    var gx=el('div','the-guide'),gy=el('div','the-guide'),empty=el('div','the-empty','Join a world and turn on a HUD module to place it here.');
    ov.appendChild(gx);ov.appendChild(gy);ov.appendChild(empty);
    HE={ov:ov,boxes:{},drag:null,raf:0,gx:gx,gy:gy,empty:empty};
    ['mousedown','mouseup','click','dblclick','contextmenu','wheel','mousemove'].forEach(function(t){
      ov.addEventListener(t,function(e){e.stopPropagation();if(t!=='mousemove')e.preventDefault();},false);
    });
    ov.addEventListener('mousemove',hudEditMove);
    ov.addEventListener('mouseup',function(){hudEditDrop();});
    ov.addEventListener('mouseleave',function(){hudEditDrop();});
    (D.body||D.documentElement).appendChild(ov);
    overlayOpening();
    hudEditing=true;
    try{if(D.exitPointerLock&&D.pointerLockElement)D.exitPointerLock();}catch(_){}
    hudEditTick();
  }
  function hudEditClose(){
    if(!HE)return;
    W.cancelAnimationFrame(HE.raf);
    if(HE.ov.parentNode)HE.ov.parentNode.removeChild(HE.ov);
    HE=null;hudEditing=false;hudSave();
    overlayClosed();
  }
  overlayChecks.push(function(){return hudEditing;});
  function hudEditBox(id){
    var b=el('div','the-box');b.appendChild(el('div','the-tag',''));
    b.addEventListener('mousedown',function(e){
      if(e.button!==0)return;
      var r=b.getBoundingClientRect();
      HE.drag={id:id,dx:e.clientX-r.left,dy:e.clientY-r.top};b.className='the-box the-drag';
    });
    b.addEventListener('contextmenu',function(){delete hudLayout[id];hudSave();});
    b.addEventListener('wheel',function(e){
      var R=hudRects[id];if(!R)return;
      var L=hudLayout[id]||hudPlace(id,R.x,R.y,R.w,R.h,R.s);
      var s=clamp(Math.round((L.s+(e.deltaY<0?0.1:-0.1))*10)/10,0.5,3),k=s/R.s;
      var w=R.w*k,h=R.h*k;
      hudLayout[id]=hudPlace(id,R.x+(R.w-w)/2,R.y+(R.h-h)/2,w,h,s);
      hudSave();
    });
    HE.ov.appendChild(b);
    return b;
  }
  // a layout entry for a box of size w x h (GUI units) with its top-left at x, y
  function hudPlace(id,x,y,w,h,s){
    var fw=Math.max(0,hudScreen.w-w),fh=Math.max(0,hudScreen.h-h);
    return {ax:fw>0?clamp(x,0,fw)/fw:0,ay:fh>0?clamp(y,0,fh)/fh:0,s:s};
  }
  function hudEditMove(e){
    var G=HE&&HE.drag,R=G&&hudRects[G.id],cr=hudCanvas();
    if(!R||!cr||!hudScreen.w)return;
    var fx=cr.width/hudScreen.w,fy=cr.height/hudScreen.h;
    var x=(e.clientX-G.dx-cr.left)/fx,y=(e.clientY-G.dy-cr.top)/fy,snapX=-1,snapY=-1,m=4;
    x=clamp(x,0,hudScreen.w-R.w);y=clamp(y,0,hudScreen.h-R.h);
    if(x<m)x=0;else if(x>hudScreen.w-R.w-m)x=hudScreen.w-R.w;                          // edges
    if(y<m)y=0;else if(y>hudScreen.h-R.h-m)y=hudScreen.h-R.h;
    if(Math.abs(x+R.w/2-hudScreen.w/2)<m){x=hudScreen.w/2-R.w/2;snapX=hudScreen.w/2;}   // centre lines
    if(Math.abs(y+R.h/2-hudScreen.h/2)<m){y=hudScreen.h/2-R.h/2;snapY=hudScreen.h/2;}
    hudLayout[G.id]=hudPlace(G.id,x,y,R.w,R.h,R.s);
    R.x=x;R.y=y;
    HE.gx.style.display=snapX>=0?'block':'none';HE.gy.style.display=snapY>=0?'block':'none';
    if(snapX>=0){HE.gx.style.left=(cr.left+snapX*fx)+'px';HE.gx.style.top=cr.top+'px';HE.gx.style.width='1px';HE.gx.style.height=cr.height+'px';}
    if(snapY>=0){HE.gy.style.top=(cr.top+snapY*fy)+'px';HE.gy.style.left=cr.left+'px';HE.gy.style.height='1px';HE.gy.style.width=cr.width+'px';}
  }
  function hudEditDrop(){
    if(!HE||!HE.drag)return;
    var b=HE.boxes[HE.drag.id];if(b)b.className='the-box';
    HE.drag=null;HE.gx.style.display=HE.gy.style.display='none';
    hudSave();
  }
  // follow the boxes the HUD drew in its last frame
  function hudEditTick(){
    if(!HE)return;
    var cr=hudCanvas(),seen={},id,any=false;
    if(cr&&hudScreen.w){
      var fx=cr.width/hudScreen.w,fy=cr.height/hudScreen.h;
      for(id in hudRects){
        var R=hudRects[id],b=HE.boxes[id]||(HE.boxes[id]=hudEditBox(id));
        seen[id]=1;any=true;
        b.style.left=(cr.left+R.x*fx)+'px';b.style.top=(cr.top+R.y*fy)+'px';
        b.style.width=Math.max(6,R.w*fx)+'px';b.style.height=Math.max(6,R.h*fy)+'px';
        b.firstChild.textContent=R.name+'  '+Math.round(R.s*100)+'%';
      }
    }
    for(id in HE.boxes)if(!seen[id]){HE.ov.removeChild(HE.boxes[id]);delete HE.boxes[id];}
    HE.empty.style.display=any?'none':'block';
    HE.raf=W.requestAnimationFrame(hudEditTick);
  }
  // keys while editing: Esc or Right Shift finish, everything else stays away from the game
  function hudEditKey(e,code){
    if(!hudEditing)return false;
    if(code==='Escape'||code==='ShiftRight'||code==='Enter'){if(!e.repeat)hudEditClose();}
    kill(e);
    return true;
  }

  // Releasing the mouse opens the pause menu; while editing it is not drawn, so the HUD shows the
  // way it does in play (drawScreen is virtual, so the class's prototype slot is wrapped).
  var hudPauseProto=Bxj.prototype,hudPauseDraw=hudPauseProto.dK;
  hudPauseProto.dK=function(b,c,d){if(hudEditing&&!$rt_resuming())return;return hudPauseDraw.call(this,b,c,d);};

  TC.hud={layout:function(){return JSON.parse(JSON.stringify(hudLayout));},rects:function(){return hudRects;},
    edit:hudEditOpen,done:hudEditClose,reset:function(){hudLayout={};hudSave();}};

  SPECIALS.hudedit=function(box){
    var act=el('div','tcm-actions');
    var ed=el('button','tcm-btn','Edit HUD Layout');ed.type='button';
    ed.addEventListener('click',function(){hudEditOpen();});
    act.appendChild(ed);
    act.appendChild(confirmButton('Reset Layout','Click again to reset positions',function(){hudLayout={};hudSave();}));
    box.appendChild(act);
  };
  MODULES.unshift({cat:'hud',id:'hudTheme',name:'HUD Style & Layout',special:'hudedit',wide:true,always:true,
    desc:'On: every HUD module in a Thunder box (dark glass, cyan edge; keys light up while held). Off: plain text. Edit HUD Layout: drag boxes to move them, scroll over a box to resize it, right-click to reset it.'});
