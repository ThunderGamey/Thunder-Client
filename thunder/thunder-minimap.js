  /* -------------------------------------------------------------------------------------------
     Part of Thunder Client, created and owned by Jayvardhan Ginni (ThunderGamey).
     Minimap and World Map (Right Shift > Utility), in the spirit of Xaero's. Included into the
     client scope of thunder-client.js by build.js.
     - Minimap: a small map in the corner of the screen, north up, with an arrow for you, dots
       for other players, and your coordinates under it.
     - World Map: press M in a world for a full-screen map of everywhere you have been this
       session. Drag to move it, scroll to zoom, M (or your own key) or Esc to close. The hint at
       the top fades away after a few seconds.
     The map is drawn from the chunks the game already has loaded: for every column the highest
     block that stops light (the game's own heightmap) in that block's map colour, the same
     colours vanilla maps use, shaded lighter or darker by the height of the block to its north
     so hills stand out. Where a roof covers the column near the top of the world (the Nether),
     it looks down from your own height instead. Chunks are read a few per frame, nearest first,
     and read again every 20 seconds so changes show. Nothing is sent to the server; the map is
     kept for this session only.
     Game functions, classes and fields it uses:
     @use Cwu net.minecraft.client.multiplayer.ChunkProviderClient.getLoadedChunk
     @use FUh net.minecraft.world.chunk.Chunk.getHeightValue
     @use FaW net.minecraft.world.chunk.Chunk.getBlockState
     @use GeK net.minecraft.block.state.BlockStateContainer$StateImplementation.getMapColor
     @use T0 net.minecraft.util.math.BlockPos.<init>
     @class Ba net.minecraft.util.math.BlockPos
     @class AB7 net.minecraft.client.gui.GuiChat
     @field Db net.minecraft.world.World.getChunkFromChunkCoordsIfLoaded World.chunkProvider
     @field cAi net.minecraft.block.material.MapColor.<init> MapColor.colorValue
     @field e4 net.minecraft.world.World.getPlayerEntityByName World.playerEntities
     @field m net.minecraft.world.chunk.Chunk.getBlockState Vec3i.x
     @field i net.minecraft.world.chunk.Chunk.getBlockState Vec3i.y
     @field l net.minecraft.world.chunk.Chunk.getBlockState Vec3i.z
     @field yW net.minecraft.client.gui.GuiIngame.renderAttackIndicator GameSettings.hideGUI
     @field HZ net.minecraft.client.Minecraft.runGameLoop Minecraft.toastGui
     @field wH net.minecraft.client.gui.toasts.GuiToast.func_191783_a GuiToast.visible
     (Entity position b/f/c, rotationYaw C, the list helpers EH and Bm, and the rest are declared
     in thunder-client.js and the other modules.)
     ------------------------------------------------------------------------------------------- */
  var MM={tiles:{},count:0,world:null,pos:null,scanned:0,lastRescan:0,box:null,cv:null,cx2:null,coords:null,
    scratch:null,sctx:null,big:null,open:false,view:{x:0,z:0,scale:2},drag:null,heights:{}};
  var MM_RESCAN_MS=20000,MM_MAX_TILES=8000;
  function mmKey(cx,cz){return cx+','+cz;}

  // one chunk's 16x16 map image (ImageData) and its column heights, or null when it is not loaded
  function mmScan(w,cx,cz,py){
    var ch=Cwu(w.Db,cx,cz);
    if(!ch)return null;
    if(!MM.pos){MM.pos=new Ba();T0(MM.pos,0,0,0);}
    var pos=MM.pos,img=new W.ImageData(16,16),d=img.data,hs=new W.Int16Array(256),x,z,y,st,mc,col,i;
    var north=MM.heights[mmKey(cx,cz-1)];
    for(z=0;z<16;z++)for(x=0;x<16;x++){
      i=z*16+x;
      y=FUh(ch,x,z)-1;
      if(y>=120&&py<118){                              // a roof (the Nether): look down from your height
        y=Math.min(py+1,y);
        while(y>0&&!mmSolid(w,ch,x,y,z,cx*16+x,cz*16+z))y--;
      }
      hs[i]=y;
      if(y<0){d[i*4+3]=0;continue;}
      st=FaW(ch,x,y,z);
      pos.m=cx*16+x;pos.i=y;pos.l=cz*16+z;
      mc=st?GeK(st,w,pos):null;
      col=mc?mc.cAi|0:0;
      if(!col){d[i*4+3]=0;continue;}
      var ny=z>0?hs[i-16]:(north?north[240+x]:y),f=y>ny?1.0:y<ny?0.72:0.86;
      d[i*4]=((col>>16)&255)*f;d[i*4+1]=((col>>8)&255)*f;d[i*4+2]=(col&255)*f;d[i*4+3]=255;
    }
    MM.heights[mmKey(cx,cz)]=hs;
    return img;
  }
  // a block with a map colour (not air) at local x, y, z (world column wx, wz)
  function mmSolid(w,ch,x,y,z,wx,wz){
    var st=FaW(ch,x,y,z);
    if(!st)return false;
    var p=MM.pos;p.m=wx;p.i=y;p.l=wz;
    var mc=GeK(st,w,p);
    return !!(mc&&mc.cAi);
  }
  function mmClear(){MM.tiles={};MM.heights={};MM.count=0;}

  // a few chunks per frame: missing ones nearest first, then ones older than 20 s
  function mmUpdate(){
    var w=HEN&&HEN.X,p=HEN&&HEN.v;
    if(w!==MM.world){MM.world=w;mmClear();}
    if(!w||!p||(!S.minimap&&!MM.open))return;
    var pcx=Math.floor(p.b/16),pcz=Math.floor(p.c/16),py=Math.floor(p.f),t=now(),budget=3,r,dx,dz,k,tile;
    for(r=0;r<=10&&budget>0;r++){
      for(dz=-r;dz<=r&&budget>0;dz++)for(dx=-r;dx<=r&&budget>0;dx++){
        if(Math.max(Math.abs(dx),Math.abs(dz))!==r)continue;
        k=mmKey(pcx+dx,pcz+dz);tile=MM.tiles[k];
        if(tile&&t-tile.t<MM_RESCAN_MS+r*1500)continue;
        var img=mmScan(w,pcx+dx,pcz+dz,py);
        if(!img){if(!tile)continue;tile.t=t;continue;}  // not loaded: keep what we saw before
        if(!tile)MM.count++;
        MM.tiles[k]={img:img,t:t,cx:pcx+dx,cz:pcz+dz};
        MM.scanned++;budget--;
      }
    }
    if(MM.count>MM_MAX_TILES){                         // forget the farthest chunks
      var all=[];for(k in MM.tiles)all.push(MM.tiles[k]);
      all.sort(function(a,b){return (Math.abs(b.cx-pcx)+Math.abs(b.cz-pcz))-(Math.abs(a.cx-pcx)+Math.abs(a.cz-pcz));});
      for(var i=0;i<all.length-MM_MAX_TILES*0.8;i++){delete MM.tiles[mmKey(all[i].cx,all[i].cz)];MM.count--;}
    }
  }

  // draws the map around block (x, z) into ctx (w x h pixels) at `scale` pixels per block
  function mmPaint(ctx,w,h,x,z,scale){
    var halfW=w/scale/2,halfH=h/scale/2;
    var c0x=Math.floor((x-halfW)/16),c1x=Math.floor((x+halfW)/16),c0z=Math.floor((z-halfH)/16),c1z=Math.floor((z+halfH)/16);
    var sw=(c1x-c0x+1)*16,sh=(c1z-c0z+1)*16;
    if(!MM.scratch||MM.scratch.width<sw||MM.scratch.height<sh){
      MM.scratch=D.createElement('canvas');MM.scratch.width=Math.max(sw,64);MM.scratch.height=Math.max(sh,64);
      MM.sctx=MM.scratch.getContext('2d');
    }
    var s=MM.sctx,cx,cz,tile;
    s.clearRect(0,0,sw,sh);
    for(cz=c0z;cz<=c1z;cz++)for(cx=c0x;cx<=c1x;cx++){
      tile=MM.tiles[mmKey(cx,cz)];
      if(tile)s.putImageData(tile.img,(cx-c0x)*16,(cz-c0z)*16);
    }
    ctx.imageSmoothingEnabled=false;
    ctx.drawImage(MM.scratch,x-halfW-c0x*16,z-halfH-c0z*16,w/scale,h/scale,0,0,w,h);
  }
  // an arrow pointing where yaw looks (Minecraft yaw: 0 = south, 90 = west)
  function mmArrow(ctx,x,y,yaw,size,fill){
    var a=(yaw+180)*Math.PI/180;
    ctx.save();ctx.translate(x,y);ctx.rotate(a);
    ctx.beginPath();ctx.moveTo(0,-size);ctx.lineTo(size*0.7,size*0.8);ctx.lineTo(0,size*0.4);ctx.lineTo(-size*0.7,size*0.8);ctx.closePath();
    ctx.fillStyle=fill;ctx.strokeStyle='rgba(3,8,14,.9)';ctx.lineWidth=1.5;ctx.fill();ctx.stroke();
    ctx.restore();
  }
  function mmPlayers(ctx,w,h,x,z,scale,self,clip){
    var list=HEN.X&&HEN.X.e4,n=list?EH(list):0,i,e;
    for(i=0;i<n;i++){
      e=Bm(list,i);
      if(!e||e===self)continue;
      var px=w/2+(e.b-x)*scale,py=h/2+(e.c-z)*scale;
      if(clip&&(px<3||py<3||px>w-3||py>h-3))continue;
      ctx.fillStyle='#eaf6ff';ctx.strokeStyle='rgba(3,8,14,.9)';ctx.lineWidth=1.5;
      ctx.beginPath();ctx.arc(px,py,3,0,Math.PI*2);ctx.fill();ctx.stroke();
    }
  }

  // ---- minimap (DOM canvas over the game) ------------------------------------------------------
  var MM_CSS=[
    '#thunder-minimap{position:fixed;z-index:1400;pointer-events:none;display:none;font:11px/1.2 "Segoe UI",system-ui,sans-serif;transition:top .25s}',
    '#thunder-minimap canvas{display:block;border-radius:10px;border:1px solid rgba(79,209,255,.55);',
      'box-shadow:0 0 0 1px rgba(3,8,14,.8),0 0 14px rgba(79,209,255,.25);background:rgba(5,9,15,.85)}',
    '#thunder-minimap.round canvas{border-radius:50%}',
    '#thunder-minimap .tm-xyz{margin-top:4px;text-align:center;color:#cfeeff;text-shadow:0 1px 2px #000,0 0 6px rgba(0,0,0,.8)}',
    '#thunder-worldmap{position:fixed;inset:0;z-index:2147483500;background:#05090f;display:none;cursor:grab;user-select:none}',
    '#thunder-worldmap.drag{cursor:grabbing}',
    '#thunder-worldmap canvas{position:absolute;inset:0}',
    '#thunder-worldmap .tw-bar{position:absolute;left:50%;top:14px;transform:translateX(-50%);padding:8px 14px;border-radius:10px;transition:opacity .8s;',
      'background:rgba(7,12,19,.92);border:1px solid rgba(79,209,255,.35);color:#cfeeff;font:12px "Segoe UI",system-ui,sans-serif;pointer-events:none}',
    '#thunder-worldmap .tw-bar b{color:#f1faff;letter-spacing:.08em;margin-right:10px}'
  ].join('');
  function mmStyle(){
    if(D.getElementById('thunder-minimap-style'))return;
    var st=D.createElement('style');st.id='thunder-minimap-style';st.textContent=MM_CSS;(D.head||D.documentElement).appendChild(st);
  }
  function mmBox(){
    if(MM.box)return MM.box;
    mmStyle();
    var b=D.createElement('div');b.id='thunder-minimap';
    var cv=D.createElement('canvas');b.appendChild(cv);
    var xyz=D.createElement('div');xyz.className='tm-xyz';b.appendChild(xyz);
    (D.body||D.documentElement).appendChild(b);
    MM.box=b;MM.cv=cv;MM.cx2=cv.getContext('2d');MM.coords=xyz;
    return b;
  }
  function mmShown(){
    var mc=HEN,gs=mc&&mc.G;
    return !!(S.minimap&&mc&&mc.X&&mc.v&&gs&&!gs.yW&&!gs.Ph&&!menuOpen&&!hudEditing&&!MM.open&&(mc.cm===null||mc.cm instanceof AB7));
  }
  // Toasts (advancements, new recipes, tutorial hints) slide in at the top right, 32 GUI units
  // a row; a top-right minimap moves down below the rows in use so it never covers one.
  // Returns the CSS pixels to leave above the minimap for them.
  function mmToastPx(){
    if((S.minimapCorner|0)!==0)return 0;
    var tg=HEN&&HEN.HZ,v=tg&&tg.wH,d=v&&v.data,n=0,i;
    if(!d)return 0;
    for(i=0;i<d.length;i++)if(d[i]!==null)n=i+1;
    return n?Math.ceil(n*32*W.innerWidth/Math.max(1,hudScreen.w||W.innerWidth/2)):0;
  }
  // GUI units the minimap takes in a top corner (0 right, 1 left): the HUD boxes of that side
  // start below it
  function mmReserve(guiW,corner){
    if(!mmShown()||(S.minimapCorner|0)!==corner)return 0;
    var px=10+mmToastPx()+clamp(Number(S.minimapSize)||140,80,260)+(S.minimapCoords?18:0)+4;
    return Math.ceil(px*guiW/Math.max(1,W.innerWidth));
  }
  function mmDraw(){
    var show=mmShown(),b=MM.box;
    if(!show){if(b)b.style.display='none';return;}
    b=mmBox();
    var size=Math.round(clamp(Number(S.minimapSize)||140,80,260)),dpr=Math.min(2,W.devicePixelRatio||1);
    if(MM.cv.width!==size*dpr){MM.cv.width=MM.cv.height=size*dpr;MM.cv.style.width=MM.cv.style.height=size+'px';}
    b.className=S.minimapRound?'round':'';
    var corner=S.minimapCorner|0;                      // 0 top right, 1 top left
    b.style.top=(10+mmToastPx())+'px';b.style.right=corner===0?'10px':'';b.style.left=corner===1?'10px':'';
    b.style.display='block';
    var p=HEN.v,ctx=MM.cx2,wpx=size*dpr,scale=clamp(Number(S.minimapZoom)||2,1,6)*dpr;
    ctx.clearRect(0,0,wpx,wpx);
    ctx.save();
    if(S.minimapRound){ctx.beginPath();ctx.arc(wpx/2,wpx/2,wpx/2,0,Math.PI*2);ctx.clip();}
    mmPaint(ctx,wpx,wpx,p.b,p.c,scale);
    mmPlayers(ctx,wpx,wpx,p.b,p.c,scale,p,true);
    ctx.restore();
    wptMapMarkers(ctx,wpx,wpx,p.b,p.c,scale,true,dpr);        // waypoints (thunder-waypoints.js)
    mmArrow(ctx,wpx/2,wpx/2,p.C,6*dpr,'#5fd7ff');
    // N marker
    ctx.fillStyle='#ffd84a';ctx.font='bold '+(10*dpr)+'px sans-serif';ctx.textAlign='center';ctx.textBaseline='top';
    ctx.fillText('N',wpx/2,3*dpr);
    MM.coords.textContent=Math.floor(p.b)+', '+Math.floor(p.f)+', '+Math.floor(p.c);
    MM.coords.style.display=S.minimapCoords?'block':'none';
  }

  // ---- world map (full screen) -----------------------------------------------------------------
  function wmBuild(){
    if(MM.big)return MM.big;
    mmStyle();
    var ov=D.createElement('div');ov.id='thunder-worldmap';
    var cv=D.createElement('canvas');ov.appendChild(cv);
    var bar=D.createElement('div');bar.className='tw-bar';
    bar.innerHTML='<b>WORLD MAP</b><span></span>';
    ov.appendChild(bar);
    ['mousedown','mouseup','click','dblclick','contextmenu','wheel','mousemove'].forEach(function(t){
      ov.addEventListener(t,function(e){e.stopPropagation();if(t!=='mousemove'&&t!=='wheel')e.preventDefault();},false);
    });
    ov.addEventListener('mousedown',function(e){if(e.button!==0)return;MM.drag={x:e.clientX,y:e.clientY,vx:MM.view.x,vz:MM.view.z};ov.className='drag';});
    // right-click: a waypoint at that spot (thunder-waypoints.js)
    ov.addEventListener('contextmenu',function(e){
      wptAddFromMap(MM.view.x+(e.clientX-W.innerWidth/2)/MM.view.scale,MM.view.z+(e.clientY-W.innerHeight/2)/MM.view.scale);
    });
    ov.addEventListener('mousemove',function(e){
      if(!MM.drag)return;
      MM.view.x=MM.drag.vx-(e.clientX-MM.drag.x)/MM.view.scale;MM.view.z=MM.drag.vz-(e.clientY-MM.drag.y)/MM.view.scale;
    });
    var end=function(){MM.drag=null;ov.className='';};
    ov.addEventListener('mouseup',end);ov.addEventListener('mouseleave',end);
    ov.addEventListener('wheel',function(e){
      e.preventDefault();
      MM.view.scale=clamp(MM.view.scale*(e.deltaY<0?1.25:0.8),0.25,12);
    },{passive:false});
    (D.body||D.documentElement).appendChild(ov);
    MM.big={ov:ov,cv:cv,ctx:cv.getContext('2d'),bar:bar,fade:0};
    return MM.big;
  }
  function wmOpen(){
    if(MM.open||!HEN||!HEN.X||!HEN.v||HEN.cm!==null||menuOpen)return;
    var B=wmBuild();
    overlayOpening();
    MM.open=true;MM.view.x=HEN.v.b;MM.view.z=HEN.v.c;
    B.ov.style.display='block';
    // the hint at the top, with the key in use; it fades away after a few seconds
    B.bar.lastChild.textContent='Drag to move \u2022 scroll to zoom \u2022 right-click: waypoint \u2022 '+keyLabel(S.worldMapKey||'KeyM')+' or Esc to close';
    B.bar.style.opacity='1';
    if(B.fade)W.clearTimeout(B.fade);
    B.fade=W.setTimeout(function(){B.bar.style.opacity='0';},3500);
    try{if(D.exitPointerLock&&D.pointerLockElement)D.exitPointerLock();}catch(_){}
  }
  function wmClose(){
    if(!MM.open)return;
    MM.open=false;MM.drag=null;
    if(MM.big)MM.big.ov.style.display='none';
    overlayClosed();
  }
  overlayChecks.push(function(){return MM.open;});
  function wmDraw(){
    if(!MM.open)return;
    if(!HEN||!HEN.X){wmClose();return;}
    var B=MM.big,w=W.innerWidth,h=W.innerHeight,dpr=Math.min(2,W.devicePixelRatio||1);
    if(B.cv.width!==Math.round(w*dpr)||B.cv.height!==Math.round(h*dpr)){
      B.cv.width=Math.round(w*dpr);B.cv.height=Math.round(h*dpr);B.cv.style.width=w+'px';B.cv.style.height=h+'px';
    }
    var ctx=B.ctx,W2=B.cv.width,H2=B.cv.height,sc=MM.view.scale*dpr,p=HEN.v;
    ctx.fillStyle='#05090f';ctx.fillRect(0,0,W2,H2);
    mmPaint(ctx,W2,H2,MM.view.x,MM.view.z,sc);
    mmPlayers(ctx,W2,H2,MM.view.x,MM.view.z,sc,p,false);
    wptMapMarkers(ctx,W2,H2,MM.view.x,MM.view.z,sc,false,dpr);
    mmArrow(ctx,W2/2+(p.b-MM.view.x)*sc,H2/2+(p.c-MM.view.z)*sc,p.C,8*dpr,'#5fd7ff');
    ctx.fillStyle='#cfeeff';ctx.font=(12*dpr)+'px sans-serif';ctx.textAlign='left';ctx.textBaseline='bottom';
    ctx.fillText('You: '+Math.floor(p.b)+', '+Math.floor(p.f)+', '+Math.floor(p.c)+'   \u2022   '+MM.count+' chunks seen',12*dpr,H2-10*dpr);
  }
  // M opens and closes the world map; while it is open, keys stay away from the game
  if(W.addEventListener)W.addEventListener('keydown',function(e){
    try{
      var code=e&&e.code;
      if(MM.open){
        if((code===(S.worldMapKey||'KeyM')||code==='Escape')&&!e.repeat)wmClose();
        if(code!=='F11')kill(e);
        return;
      }
      if(code===(S.worldMapKey||'KeyM')&&!e.repeat&&S.worldMap&&HEN&&HEN.X&&HEN.cm===null&&!menuOpen&&!hudEditing){kill(e);wmOpen();}
    }catch(_){}
  },true);

  frameTasks.push(function(){
    try{mmUpdate();}catch(e){report(e);}
    try{mmDraw();}catch(e){report(e);}
    try{wmDraw();}catch(e){report(e);}
  });
  TC.minimap={state:function(){return {tiles:MM.count,scanned:MM.scanned,open:MM.open,shown:!!(MM.box&&MM.box.style.display==='block')};},
    openWorldMap:wmOpen,closeWorldMap:wmClose};
  MODULES.push(
    {cat:'utility',id:'minimap',name:'Minimap',
      desc:'A small map in the corner: north up, an arrow for you, dots for other players and your coordinates under it. Made from the chunks the game has loaded.',
      opts:[{id:'minimapSize',name:'Size',min:80,max:260,step:10,fmt:function(v){return v+' px';}},
        {id:'minimapZoom',name:'Zoom',min:1,max:6,step:0.5,fmt:function(v){return v+'x';}},
        {id:'minimapCorner',name:'Corner',choices:['Top right','Top left']},
        {id:'minimapRound',name:'Round'},
        {id:'minimapCoords',name:'Coordinates under it'}]},
    {cat:'utility',id:'worldMap',name:'World Map',
      desc:'Press the map key (M) in a world for a full-screen map of everywhere you have been this session. Drag to move, scroll to zoom, the map key or Esc to close.',
      opts:[{id:'worldMapKey',name:'Map key',key:true,mouse:false}]});
