  /* -------------------------------------------------------------------------------------------
     Part of Thunder Client, created and owned by Jayvardhan Ginni (ThunderGamey).
     Waypoints (Right Shift > Utility). Included into the client scope of thunder-client.js by
     build.js, after thunder-minimap.js (whose maps draw them).
     - Press B (or your own key) in a world to put a waypoint where you stand, or right-click the
       World Map to put one there. Each gets a name and a colour; rename, hide or delete them in
       Right Shift > Utility > Waypoints.
     - They show on the minimap (at its edge when they are further away), on the World Map, and in
       the world itself: a diamond with the name and the distance, so you can walk back to them.
     - When you die, a "Death" waypoint is put where it happened (the last death only).
     Waypoints are kept in this browser (localStorage "thunderWaypoints_v1"), per server address,
     or per singleplayer world (told apart by its spawn point), and per dimension. Nothing is sent
     to the server.

     Game classes and fields it uses:
     @class ASL net.minecraft.client.gui.GuiGameOver
     @field qf net.minecraft.client.network.NetHandlerPlayClient.sendPacket NetHandlerPlayClient.netManager
     @field bR3 net.minecraft.network.NetworkManager.<init> NetworkManager.address
     @field iE net.minecraft.entity.Entity.writeToNBT Entity.dimension
     @field dn net.minecraft.entity.Entity.getPositionEyes Entity.prevPosX
     @field d8 net.minecraft.entity.Entity.getPositionEyes Entity.prevPosY
     @field dv net.minecraft.entity.Entity.getPositionEyes Entity.prevPosZ
     @field bQ net.minecraft.world.World.getSpawnPoint World.worldInfo
     @virtual bwq net.minecraft.world.storage.WorldInfo getSpawnX
     @virtual bvJ net.minecraft.world.storage.WorldInfo getSpawnZ
     (Player position b/f/c, rotation C/bc and prevRotation cy/c1, the connection d9, isSneaking
     Fch, GlStateManager.rotate Gc7 and the minimap's MM / keyLabel are declared elsewhere.)
     ------------------------------------------------------------------------------------------- */
  var WPT={all:null,key:null,dim:0,deadShown:false,toast:null,toastT:0,drawn:0,w:null,p:null,wk:null};
  var WPT_COLORS=[['Cyan',0x4FD1FF],['Yellow',0xFFD84A],['Green',0x55FF7A],['Red',0xFF5555],
    ['Pink',0xFF6FD8],['Orange',0xFFA43C],['White',0xFFFFFF],['Blue',0x5C7CFF]];
  var WPT_STORE='thunderWaypoints_v1';

  function wptLoad(){
    if(WPT.all)return WPT.all;
    WPT.all={};
    try{var o=JSON.parse(W.localStorage.getItem(WPT_STORE)||'{}');if(o&&typeof o==='object')WPT.all=o;}catch(_){}
    return WPT.all;
  }
  function wptSave(){try{W.localStorage.setItem(WPT_STORE,JSON.stringify(WPT.all||{}));}catch(_){}}
  // which world this is: the server address, or a singleplayer world by its spawn point
  function wptWorldKey(){
    var mc=HEN,p=mc&&mc.v,w=mc&&mc.X;
    if(!p||!w)return null;
    var nm=p.d9&&p.d9.qf,addr=nm&&nm.bR3?$rt_ustr(nm.bR3):'';
    if(addr&&addr.indexOf('~!')!==0)return 'mp:'+addr.toLowerCase();
    var wi=w.bQ,sx=0,sz=0;
    try{sx=wi.bwq();sz=wi.bvJ();}catch(_){}
    return 'sp:'+sx+','+sz;
  }
  // the waypoints of this world and dimension (a live array), or null outside a world
  function wptList(){
    var mc=HEN;
    if(!mc||!mc.X||!mc.v)return null;
    if(mc.X!==WPT.w||mc.v!==WPT.p){WPT.w=mc.X;WPT.p=mc.v;WPT.wk=wptWorldKey();}   // worked out once per world
    var k=WPT.wk;
    if(!k)return null;
    var all=wptLoad(),dim=HEN.v.iE|0,full=k+'@'+dim;
    WPT.key=full;WPT.dim=dim;
    return all[full]||(all[full]=[]);
  }
  function wptAdd(name,x,y,z,color,death){
    var list=wptList();if(!list)return null;
    if(death){for(var i=list.length-1;i>=0;i--)if(list[i].death)list.splice(i,1);}
    if(list.length>=200)return null;
    var n=0;for(var j=0;j<list.length;j++)if(!list[j].death)n++;
    var wp={n:name||('Waypoint '+(n+1)),x:Math.floor(x),y:Math.floor(y),z:Math.floor(z),
      c:color!=null?color:(n%WPT_COLORS.length),s:true,death:!!death};
    list.push(wp);wptSave();
    return wp;
  }
  function wptRemove(wp){var list=wptList();if(!list)return;var i=list.indexOf(wp);if(i>=0){list.splice(i,1);wptSave();}}
  function wptCol(wp){var c=WPT_COLORS[wp.c|0]||WPT_COLORS[0];return c[1];}
  function wptCss(wp){return '#'+('00000'+wptCol(wp).toString(16)).slice(-6);}

  // a short notice at the top of the screen ("Waypoint 2 added")
  function wptToast(msg){
    if(!WPT.toast){
      var t=D.createElement('div');t.id='thunder-toast';
      t.style.cssText='position:fixed;left:50%;top:18px;transform:translateX(-50%);z-index:2147483600;pointer-events:none;'+
        'padding:7px 14px;border-radius:9px;background:rgba(7,12,19,.92);border:1px solid rgba(79,209,255,.45);'+
        'color:#dff3ff;font:600 12px "Segoe UI",system-ui,sans-serif;box-shadow:0 0 14px rgba(79,209,255,.25);transition:opacity .4s;opacity:0';
      (D.body||D.documentElement).appendChild(t);WPT.toast=t;
    }
    WPT.toast.textContent=msg;WPT.toast.style.opacity='1';
    if(WPT.toastT)W.clearTimeout(WPT.toastT);
    WPT.toastT=W.setTimeout(function(){WPT.toast.style.opacity='0';},1800);
  }

  // the waypoint key: one where you stand
  if(W.addEventListener)W.addEventListener('keydown',function(e){
    try{
      if(!S.waypoints||e.repeat||e.code!==(S.waypointKey||'KeyB'))return;
      if(!HEN||!HEN.X||!HEN.v||HEN.cm!==null||menuOpen||hudEditing||MM.open)return;
      var p=HEN.v,wp=wptAdd(null,p.b,p.f,p.c);
      if(wp)wptToast(wp.n+' added at '+wp.x+', '+wp.y+', '+wp.z);
    }catch(_){}
  },true);
  // a Death waypoint when you die
  frameTasks.push(function(){
    if(!S.waypoints||!S.deathPoints||!HEN||!HEN.v)return;
    var dead=HEN.cm instanceof ASL;
    if(dead&&!WPT.deadShown){WPT.deadShown=true;try{var p=HEN.v;wptAdd('Death',p.b,p.f,p.c,3,true);}catch(_){}}
    else if(!dead)WPT.deadShown=false;
  });

  // ---- on the maps (called by thunder-minimap.js) ------------------------------------------------
  // mini: the minimap (markers at its edge when further away; round when it is round)
  function wptMapMarkers(ctx,w,h,x,z,scale,mini,dpr){
    if(!S.waypoints)return;
    var list=wptList();if(!list||!list.length)return;
    dpr=dpr||1;
    for(var i=0;i<list.length;i++){
      var wp=list[i];if(!wp.s)continue;
      var px=w/2+(wp.x+0.5-x)*scale,py=h/2+(wp.z+0.5-z)*scale,edge=false,r=(mini?3.2:4.5)*dpr;
      if(mini){
        var m=6*dpr,dx=px-w/2,dy=py-h/2;
        if(S.minimapRound){
          var rad=w/2-m,d=Math.sqrt(dx*dx+dy*dy);
          if(d>rad){px=w/2+dx/d*rad;py=h/2+dy/d*rad;edge=true;}
        }else{
          var k=Math.max(Math.abs(dx)/(w/2-m),Math.abs(dy)/(h/2-m));
          if(k>1){px=w/2+dx/k;py=h/2+dy/k;edge=true;}
        }
        if(edge)r*=0.8;
      }else if(px<-20||py<-20||px>w+20||py>h+20)continue;
      ctx.beginPath();ctx.moveTo(px,py-r);ctx.lineTo(px+r,py);ctx.lineTo(px,py+r);ctx.lineTo(px-r,py);ctx.closePath();
      ctx.fillStyle=wptCss(wp);ctx.strokeStyle='rgba(3,8,14,.95)';ctx.lineWidth=1.5*dpr;ctx.fill();ctx.stroke();
      if(!mini){
        ctx.font='600 '+(11*dpr)+'px "Segoe UI",system-ui,sans-serif';ctx.textAlign='center';ctx.textBaseline='bottom';
        ctx.lineWidth=3*dpr;ctx.strokeStyle='rgba(3,8,14,.9)';ctx.strokeText(wp.n,px,py-r-3*dpr);
        ctx.fillStyle='#eaf6ff';ctx.fillText(wp.n,px,py-r-3*dpr);
      }
    }
  }
  // right-click on the World Map: a waypoint at that spot (at the ground height the map knows)
  function wptAddFromMap(wx,wz){
    if(!S.waypoints||!HEN||!HEN.v)return;
    var y=HEN.v.f,cx=Math.floor(wx/16),cz=Math.floor(wz/16),hs=MM.heights[mmKey(cx,cz)];
    if(hs){var hy=hs[((Math.floor(wz)-cz*16)&15)*16+((Math.floor(wx)-cx*16)&15)];if(hy>=0)y=hy+1;}
    var wp=wptAdd(null,wx,y,wz);
    if(wp)wptToast(wp.n+' added at '+wp.x+', '+wp.y+', '+wp.z);
  }

  // ---- in the world: a diamond, the name and the distance at the waypoint ----------------------
  // Projected with the camera the game draws with this frame (position and angles between ticks,
  // the field of view including zoom); GUI units.
  var hudPartial=1;
  function waypointHud(ctx){
    if(!S.waypoints||!S.waypointsInWorld)return;
    var list=wptList();if(!list||!list.length)return;
    var p=ctx.player,gs=ctx.mc.G,t=clamp(hudPartial,0,1);
    if(!gs||gs.Ph)return;
    var ex=p.dn+(p.b-p.dn)*t,ey=p.d8+(p.f-p.d8)*t+(Fch(p)?1.54:1.62),ez=p.dv+(p.c-p.dv)*t;
    var yaw=(p.cy+(p.C-p.cy)*t)*Math.PI/180,pit=(p.c1+(p.bc-p.c1)*t)*Math.PI/180;
    if(gs.lu===2){yaw+=Math.PI;pit=-pit;}                   // front view (F5 twice): the camera looks back
    var cp=Math.cos(pit),sp=Math.sin(pit),cyw=Math.cos(yaw),syw=Math.sin(yaw);
    var fx=-syw*cp,fy=-sp,fz=cyw*cp,rx=-cyw,rz=-syw;           // forward and right
    var ux=ry0(fx,fy,fz,rx,rz);                                // up = right x forward
    var foc=(ctx.h/2)/Math.tan(clamp(worldFov,10,170)*Math.PI/360),n=0;
    for(var i=0;i<list.length;i++){
      var wp=list[i];if(!wp.s)continue;
      var dx=wp.x+0.5-ex,dy=wp.y+1.3-ey,dz=wp.z+0.5-ez;
      var cz=dx*fx+dy*fy+dz*fz;
      if(cz<0.3)continue;                                     // behind you
      var cx=dx*rx+dz*rz,cyv=dx*ux[0]+dy*ux[1]+dz*ux[2];
      var sx=ctx.w/2+cx/cz*foc,sy=ctx.h/2-cyv/cz*foc;
      if(sx<-40||sy<-20||sx>ctx.w+40||sy>ctx.h+20)continue;
      var dist=Math.sqrt(dx*dx+dy*dy+dz*dz),col=wptCol(wp)|0;
      var label=wp.n,sub=(dist<10?dist.toFixed(1):Math.round(dist))+'m';
      var lw=CC(ctx.font,$rt_str(label)),sw=CC(ctx.font,$rt_str(sub)),bw=Math.max(lw,sw)+6;
      sx=Math.round(sx);sy=Math.round(sy);
      opPush();op(DPm,sx,sy,0);op(Gc7,45.0,0.0,0.0,1.0);
      rect(-4,-4,4,4,0xE0030810|0);rect(-3,-3,3,3,(0xFF000000|col)|0);
      opPop();
      rect(sx-(bw/2|0),sy-26,sx+(bw/2|0)+1,sy-6,0x9A050A12|0);
      text(ctx.font,label,sx-(lw/2|0),sy-25,col);
      text(ctx.font,sub,sx-(sw/2|0),sy-15,0xD8E6F0);
      n++;
    }
    WPT.drawn=n;
  }
  function ry0(fx,fy,fz,rx,rz){return [0*fz-rz*fy,rz*fx-rx*fz,rx*fy-0*fx];}

  // ---- Right Shift > Utility > Waypoints: rename, colour, hide, delete ---------------------------
  SPECIALS.waypoints=function(box){
    var list=el('div','tcm-wpt');box.appendChild(list);
    var act=el('div','tcm-actions'),add=el('button','tcm-btn','Add at my position');add.type='button';
    add.addEventListener('click',function(){
      if(!HEN||!HEN.v||!HEN.X){note.textContent='Join a world first.';return;}
      var p=HEN.v,wp=wptAdd(null,p.b,p.f,p.c);if(wp)paint();
    });
    act.appendChild(add);
    act.appendChild(confirmButton('Delete all here','Click again to delete all',function(){var l=wptList();if(l){l.length=0;wptSave();paint();}}));
    box.appendChild(act);
    var note=el('div','tcm-note','');box.appendChild(note);
    var shownKey=null,shownLen=-1;
    function paint(){
      list.innerHTML='';
      var l=wptList();
      shownKey=WPT.key;shownLen=l?l.length:-1;
      if(!l){note.textContent='Join a world to see its waypoints. Press '+keyLabel(S.waypointKey||'KeyB')+' in a world to add one.';return;}
      note.textContent=l.length?'This world, '+({'-1':'the Nether','0':'the Overworld','1':'the End'}[WPT.dim]||'dimension '+WPT.dim)+'. Press '+keyLabel(S.waypointKey||'KeyB')+' to add one where you stand, or right-click the World Map.':
        'No waypoints here yet. Press '+keyLabel(S.waypointKey||'KeyB')+' to add one where you stand, or right-click the World Map.';
      l.forEach(function(wp){
        var row=el('div','tcm-wpt-row');
        var dot=el('button','tcm-wpt-dot');dot.type='button';dot.title='Colour';dot.style.background=wptCss(wp);
        dot.addEventListener('click',function(){wp.c=((wp.c|0)+1)%WPT_COLORS.length;wptSave();dot.style.background=wptCss(wp);});
        var name=el('input','tcm-wpt-name');name.type='text';name.value=wp.n;name.maxLength=32;
        name.addEventListener('change',function(){wp.n=name.value.replace(/[\u0000-\u001f\u00a7]/g,'').slice(0,32)||wp.n;name.value=wp.n;wptSave();});
        var info=el('span','tcm-wpt-info',wp.x+', '+wp.y+', '+wp.z);
        var eye=el('button','tcm-wpt-btn',wp.s?'Shown':'Hidden');eye.type='button';
        eye.addEventListener('click',function(){wp.s=!wp.s;wptSave();eye.textContent=wp.s?'Shown':'Hidden';});
        var del=el('button','tcm-wpt-btn tcm-wpt-del','\u00d7');del.type='button';del.title='Delete';
        del.addEventListener('click',function(){wptRemove(wp);paint();});
        // Share: pick a Thunder Friends friend; they get it as a message with Add
        var shareB=el('button','tcm-wpt-btn','Share');shareB.type='button';shareB.title='Send it to a friend';
        var pick=el('div','tcm-wpt-share');pick.style.display='none';
        shareB.addEventListener('click',function(){
          if(pick.style.display!=='none'){pick.style.display='none';return;}
          pick.innerHTML='';pick.style.display='';
          var text=wptShareText(wp,WPT.wk,WPT.dim);
          if(!text){pick.appendChild(el('span',null,'This waypoint cannot be shared from here.'));return;}
          if(!soReady()||!SO.me){pick.appendChild(el('span',null,'Sign in to Thunder Friends (Right Shift \u2192 Friends) to share waypoints.'));return;}
          var ids=soFriendIds();
          if(!ids.length){pick.appendChild(el('span',null,'Add friends in Right Shift \u2192 Friends first.'));return;}
          pick.appendChild(el('span',null,'Send to:'));
          ids.slice(0,24).forEach(function(id){
            var f=SO.friends[id],b=el('button','tcm-wpt-btn'+(f.online?' tcm-wpt-on':''),f.name);b.type='button';
            b.title=soTagged(f)+(f.online?' (online)':' (gets it when they come online)');
            b.addEventListener('click',function(){
              if(soMsg(id,text)){pick.innerHTML='';pick.appendChild(el('span',null,'Sent to '+f.name+'.'));W.setTimeout(function(){pick.style.display='none';},2000);}
            });
            pick.appendChild(b);
          });
        });
        row.appendChild(dot);row.appendChild(name);row.appendChild(info);row.appendChild(eye);row.appendChild(shareB);row.appendChild(del);
        list.appendChild(row);list.appendChild(pick);
      });
    }
    paint();
    addLive(function(){                                     // follow worlds changing, or B pressed meanwhile
      var l=wptList();
      if(WPT.key!==shownKey||(l?l.length:-1)!==shownLen){if(!(D.activeElement&&D.activeElement.className==='tcm-wpt-name'))paint();}
    });
  };
  // ---- sharing a waypoint with a Thunder Friends friend ------------------------------------------
  // A shared waypoint is an ordinary chat message that people can read and Thunder can add:
  //   Waypoint: Base | 120, 64, -300 | the Overworld | wss://play.example.net
  // The last part is the server, or "a world (spawn 438, -499)" for a singleplayer or friend's world,
  // told apart by its spawn point like the waypoints themselves (a friend in your world has the
  // same one). Adding it puts it in that world's list, shown whenever you are there.
  var WPT_DIMS={'0':'the Overworld','-1':'the Nether','1':'the End'};
  var WPT_SHARE_RE=/^Waypoint: (.{1,32}) \| (-?\d{1,8}), (-?\d{1,4}), (-?\d{1,8}) \| (the Overworld|the Nether|the End) \| (.{1,140})$/;
  function wptShareText(wp,key,dim){
    var sp=/^sp:(-?\d{1,8}),(-?\d{1,8})$/.exec(key||''),place=null;
    if(sp)place='a world (spawn '+sp[1]+', '+sp[2]+')';
    else if(/^mp:[A-Za-z0-9.:\/_\-]{1,140}$/.test(key||''))place=key.slice(3);
    if(!place||!Object.prototype.hasOwnProperty.call(WPT_DIMS,String(dim)))return null;
    var n=String(wp.n||'').replace(/[|\u0000-\u001f\u00a7]/g,'/').replace(/\s+/g,' ').trim().slice(0,32)||'Waypoint';
    return 'Waypoint: '+n+' | '+wp.x+', '+wp.y+', '+wp.z+' | '+WPT_DIMS[dim]+' | '+place;
  }
  // a chat message that is a shared waypoint: {n, x, y, z, dim, key, place}, else null
  function wptParseShare(text){
    var m=WPT_SHARE_RE.exec(String(text||''));
    if(!m)return null;
    var dim=m[5]==='the Nether'?-1:m[5]==='the End'?1:0,place=m[6],sp=/^a world \(spawn (-?\d{1,8}), (-?\d{1,8})\)$/.exec(place),key;
    if(sp)key='sp:'+sp[1]+','+sp[2];
    else if(/^[A-Za-z0-9.:\/_\-]{1,140}$/.test(place))key='mp:'+place.toLowerCase();
    else return null;
    return {n:m[1].trim()||'Waypoint',x:+m[2],y:+m[3],z:+m[4],dim:dim,key:key,place:sp?'that world':place.replace(/^wss?:\/\//i,'')};
  }
  function wptHasShared(p){
    var l=wptLoad()[p.key+'@'+p.dim]||[];
    for(var i=0;i<l.length;i++)if(l[i].x===p.x&&l[i].y===p.y&&l[i].z===p.z)return true;
    return false;
  }
  // true: added; false: it is there already (or that world has 200)
  function wptAddShared(p){
    var all=wptLoad(),full=p.key+'@'+p.dim,list=all[full]||(all[full]=[]),n=0;
    if(wptHasShared(p)||list.length>=200)return false;
    for(var j=0;j<list.length;j++)if(!list[j].death)n++;
    list.push({n:p.n,x:p.x,y:p.y,z:p.z,c:n%WPT_COLORS.length,s:true,death:false});
    wptSave();
    return true;
  }
  TC.waypoints={list:function(){var l=wptList();return l?JSON.parse(JSON.stringify(l)):null;},key:function(){wptList();return WPT.key;},
    add:function(n,x,y,z){return !!wptAdd(n,x,y,z);},drawn:function(){return WPT.drawn;},
    shareText:wptShareText,parseShare:wptParseShare,addShared:wptAddShared};
  MODULES.push({cat:'utility',id:'waypoints',name:'Waypoints',wide:true,special:'waypoints',
    desc:'Mark places and find them again: press B (or your own key) to add one where you stand, or right-click the World Map. They show on the minimap, the World Map and in the world with the distance. A Death point marks where you last died.',
    opts:[{id:'waypointKey',name:'Waypoint key',key:true,mouse:false},
      {id:'waypointsInWorld',name:'Show them in the world'},
      {id:'deathPoints',name:'Death point when you die'}]});
