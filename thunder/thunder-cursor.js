  /* -------------------------------------------------------------------------------------------
     Part of Thunder Client, created and owned by Jayvardhan Ginni (ThunderGamey).
     Thunder Cursor (Right Shift > Visual). Included into the client scope of thunder-client.js by
     build.js. Page code only: it does not touch the game.
     - The pointer is a small light-blue diamond with a black rim and a glow. It is the browser's
       own cursor (a CSS cursor image), so it moves with zero delay in every menu, inventory and
       the Right Shift menu.
     - A bigger outlined diamond follows it on a spring. The faster you move, the further it
       falls behind, with a flickering lightning arc between the two and a few sparks; when you
       slow down or stop, it settles right around the pointer.
     In game the mouse is locked and there is no cursor, so nothing is drawn. The follower is a
       small canvas (240 x 240) that moves with the mouse and only animates while it is catching
       up, so it costs nothing in play and next to nothing in menus.
     ------------------------------------------------------------------------------------------- */
  var CUR={style:null,el:null,cv:null,g:null,x:-999,y:-999,fx:-999,fy:-999,raf:0,lt:0,in:false,sparks:[],dpr:1,made:false};
  var CUR_BOX=240,CUR_MID=120,CUR_MAX=92;

  // the pointer image: a diamond (hot spot in the middle) at 1x or 2x
  function curPointer(k){
    var s=24*k,c=D.createElement('canvas');c.width=c.height=s;
    var g=c.getContext('2d'),r=7.2*k;
    g.translate(s/2,s/2);
    g.beginPath();g.moveTo(0,-r);g.lineTo(r,0);g.lineTo(0,r);g.lineTo(-r,0);g.closePath();
    g.shadowColor='rgba(79,209,255,0.95)';g.shadowBlur=4.5*k;
    var gr=g.createLinearGradient(0,-r,0,r);
    gr.addColorStop(0,'#e4f9ff');gr.addColorStop(0.45,'#63d9ff');gr.addColorStop(1,'#1c86cf');
    g.fillStyle=gr;g.fill();
    g.shadowBlur=0;g.lineJoin='miter';g.lineWidth=1.7*k;g.strokeStyle='#02060b';g.stroke();
    g.beginPath();g.moveTo(-r*0.5,-r*0.08);g.lineTo(-r*0.02,-r*0.56);
    g.lineWidth=1.1*k;g.strokeStyle='rgba(255,255,255,0.95)';g.stroke();
    return c.toDataURL('image/png');
  }
  function curStyle(on){
    if(!on){if(CUR.style&&CUR.style.parentNode)CUR.style.parentNode.removeChild(CUR.style);CUR.style=null;return;}
    if(CUR.style)return;
    var a=curPointer(1),b=curPointer(2),st=D.createElement('style');st.id='thunder-cursor-style';
    st.textContent='html,html *{cursor:url('+a+') 12 12,auto!important;'+
      'cursor:-webkit-image-set(url('+a+') 1x,url('+b+') 2x) 12 12,auto!important;'+
      'cursor:image-set(url('+a+') 1x,url('+b+') 2x) 12 12,auto!important}'+
      '#thunder-cursor{position:fixed;left:0;top:0;width:'+CUR_BOX+'px;height:'+CUR_BOX+'px;pointer-events:none;'+
      'z-index:2147483647;display:none;will-change:transform;contain:strict}';
    (D.head||D.documentElement).appendChild(st);
    CUR.style=st;
  }
  function curMake(){
    if(CUR.el)return;
    var cv=D.createElement('canvas');cv.id='thunder-cursor';
    CUR.dpr=Math.min(2,W.devicePixelRatio||1);
    cv.width=cv.height=Math.round(CUR_BOX*CUR.dpr);
    (D.body||D.documentElement).appendChild(cv);
    CUR.el=cv;CUR.g=cv.getContext('2d');
  }
  function curActive(){return !!(S.thunderCursor&&S.cursorTrail&&CUR.in&&!D.pointerLockElement);}
  function curPlace(){CUR.el.style.transform='translate3d('+(CUR.x-CUR_MID)+'px,'+(CUR.y-CUR_MID)+'px,0)';}
  function curDiamond(g,x,y,r){g.beginPath();g.moveTo(x,y-r);g.lineTo(x+r,y);g.lineTo(x,y+r);g.lineTo(x-r,y);g.closePath();}
  // a jagged line between two points (new every frame, so it flickers)
  function curBolt(g,x1,y1,x2,y2,amp,parts){
    var dx=x2-x1,dy=y2-y1,len=Math.sqrt(dx*dx+dy*dy)||1,nx=-dy/len,ny=dx/len,i,pts=[[x1,y1]];
    for(i=1;i<parts;i++){var t=i/parts,j=(Math.random()*2-1)*amp*Math.sin(Math.PI*t);pts.push([x1+dx*t+nx*j,y1+dy*t+ny*j]);}
    pts.push([x2,y2]);
    g.beginPath();g.moveTo(pts[0][0],pts[0][1]);for(i=1;i<pts.length;i++)g.lineTo(pts[i][0],pts[i][1]);
    return pts;
  }
  function curDraw(){
    var g=CUR.g,k=CUR.dpr,m=CUR_MID;
    g.setTransform(k,0,0,k,0,0);
    g.clearRect(0,0,CUR_BOX,CUR_BOX);
    var dx=CUR.fx-CUR.x,dy=CUR.fy-CUR.y,d=Math.sqrt(dx*dx+dy*dy),fx=m+dx,fy=m+dy;
    // the lightning arc while the follower lags behind
    if(d>5){
      var amp=Math.min(7,1.5+d*0.1),parts=Math.max(3,Math.min(8,Math.round(d/10))),pts;
      g.lineCap='round';g.lineJoin='round';
      pts=curBolt(g,fx,fy,m,m,amp,parts);
      g.strokeStyle='rgba(2,6,11,0.85)';g.lineWidth=4.6;g.stroke();          // black edge
      g.shadowColor='rgba(79,209,255,0.95)';g.shadowBlur=9;
      g.strokeStyle='rgba(95,215,255,0.95)';g.lineWidth=2.6;g.stroke();      // light-blue glow
      g.shadowBlur=0;
      g.strokeStyle='rgba(240,252,255,0.95)';g.lineWidth=1.1;g.stroke();     // white-hot core
      if(d>26&&Math.random()<0.45&&pts.length>3){               // a little fork
        var p=pts[1+((Math.random()*(pts.length-2))|0)],a=Math.atan2(dy,dx)+(Math.random()<0.5?1:-1)*(0.6+Math.random()*0.5);
        curBolt(g,p[0],p[1],p[0]+Math.cos(a)*(6+d*0.12),p[1]+Math.sin(a)*(6+d*0.12),2.5,3);
        g.strokeStyle='rgba(2,6,11,0.7)';g.lineWidth=3;g.stroke();
        g.strokeStyle='rgba(150,230,255,0.85)';g.lineWidth=1.2;g.stroke();
      }
    }
    // sparks thrown off the follower when you move fast
    var t=now(),live=[];
    for(var s=0;s<CUR.sparks.length;s++){
      var sp=CUR.sparks[s],age=(t-sp.t)/260;
      if(age>=1)continue;live.push(sp);
      var sx=m+(sp.x-CUR.x),sy=m+(sp.y-CUR.y),l=4*(1-age);
      g.beginPath();g.moveTo(sx,sy);g.lineTo(sx+sp.vx*l,sy+sp.vy*l);
      g.strokeStyle='rgba(180,240,255,'+(0.9*(1-age)).toFixed(3)+')';g.lineWidth=1.2;g.stroke();
      sp.x+=sp.vx*1.4;sp.y+=sp.vy*1.4;
    }
    CUR.sparks=live;
    // the follower: an outlined diamond, black rim outside a light-blue glowing edge
    var r=17;
    curDiamond(g,fx,fy,r);
    g.fillStyle='rgba(6,14,24,0.28)';g.fill();
    g.lineJoin='miter';
    g.lineWidth=4;g.strokeStyle='rgba(2,6,11,0.85)';g.stroke();
    g.shadowColor='rgba(79,209,255,0.95)';g.shadowBlur=7;
    g.lineWidth=1.8;g.strokeStyle='#5fd7ff';g.stroke();
    g.shadowBlur=0;
    return d;
  }
  function curFrame(ts){
    CUR.raf=0;
    if(!curActive()){if(CUR.el)CUR.el.style.display='none';return;}
    var dt=CUR.lt?Math.min(64,ts-CUR.lt):16.7;CUR.lt=ts;
    var a=1-Math.exp(-dt/85);                              // how much of the gap closes this frame
    CUR.fx+=(CUR.x-CUR.fx)*a;CUR.fy+=(CUR.y-CUR.fy)*a;
    var dx=CUR.fx-CUR.x,dy=CUR.fy-CUR.y,d=Math.sqrt(dx*dx+dy*dy);
    if(d>CUR_MAX){CUR.fx=CUR.x+dx/d*CUR_MAX;CUR.fy=CUR.y+dy/d*CUR_MAX;d=CUR_MAX;}
    if(d>34&&CUR.sparks.length<10&&Math.random()<0.5){
      var an=Math.random()*Math.PI*2;CUR.sparks.push({x:CUR.fx,y:CUR.fy,vx:Math.cos(an),vy:Math.sin(an),t:now()});
    }
    curPlace();
    curDraw();
    if(d>0.35||CUR.sparks.length)CUR.raf=W.requestAnimationFrame(curFrame);
    else{CUR.fx=CUR.x;CUR.fy=CUR.y;CUR.lt=0;curDraw();}      // settled around the pointer: stop until the mouse moves
  }
  function curKick(){if(!CUR.raf&&curActive())CUR.raf=W.requestAnimationFrame(curFrame);}
  function curMove(e){
    if(e.pointerType&&e.pointerType!=='mouse')return;
    CUR.x=e.clientX;CUR.y=e.clientY;
    if(!CUR.in){CUR.in=true;CUR.fx=CUR.x;CUR.fy=CUR.y;}
    if(!curActive())return;
    curMake();
    if(CUR.el.style.display!=='block'){CUR.el.style.display='block';CUR.fx=CUR.x;CUR.fy=CUR.y;}
    curPlace();curKick();
  }
  function curApply(){
    curStyle(!!S.thunderCursor);
    if(!curActive()&&CUR.el)CUR.el.style.display='none';
  }
  if(D.addEventListener){
    D.addEventListener('pointermove',curMove,true);
    D.addEventListener('pointerdown',curMove,true);
    D.documentElement.addEventListener('mouseleave',function(){CUR.in=false;if(CUR.el)CUR.el.style.display='none';});
    D.addEventListener('pointerlockchange',function(){
      if(D.pointerLockElement){if(CUR.el)CUR.el.style.display='none';}
      else{CUR.fx=CUR.x;CUR.fy=CUR.y;if(curActive()&&CUR.el){CUR.el.style.display='block';curPlace();curKick();}}
    });
  }
  curApply();
  TC.cursor={state:function(){return {styled:!!CUR.style,shown:!!(CUR.el&&CUR.el.style.display==='block'),animating:!!CUR.raf,gap:Math.round(Math.sqrt((CUR.fx-CUR.x)*(CUR.fx-CUR.x)+(CUR.fy-CUR.y)*(CUR.fy-CUR.y)))};}};
  MODULES.push({cat:'visual',id:'thunderCursor',name:'Thunder Cursor',
    desc:'A light-blue and black diamond cursor in every menu. A bigger diamond follows it with a lightning arc: the faster you move, the further it trails; when you stop it settles around your cursor.',
    opts:[{id:'cursorTrail',name:'Lightning trail',onChange:curApply}],
    onChange:curApply});
