  /* -------------------------------------------------------------------------------------------
     Part of Thunder Client, created and owned by Jayvardhan Ginni (ThunderGamey).
     Voice Chat (Right Shift > Friends > Voice Chat). Included into the client scope of
     thunder-client.js by build.js, after thunder-party.js.
     The players in a world opened through Thunder's relay (Open to Friends, or a friend's world
     joined by its code) talk to each other. Each pair of games sends its voice straight to the
     other (WebRTC audio, like the world itself: directly, or through this site's TURN server when
     it has one); Thunder's relay only introduces them (/relay?voice=<the world's code>: who is in
     the world's voice chat, and each pair's offer and answer). No voice passes through Thunder.
       - You hear the others as soon as you are in such a world (Voice Chat on, the default).
         Your microphone is used only once you choose it: hold V to talk (push to talk; the first
         press asks the browser for the microphone), or Always on. It sends only while you talk,
         and stops when you leave the world.
       - Proximity (on by default): a player sounds from where they stand (left or right), at full
         volume within 8 blocks, fading out by 40; players you cannot see (another dimension, too
         far away) are not heard. Off: everyone at the same volume.
       - Who is talking shows at the left of the screen; the card lists everyone in the voice chat,
         whether their voice connected, and Mute.
     A computer running an Always open world joins only while someone has used it in the last 5
     minutes, so an empty room never plays voices.
  ------------------------------------------------------------------------------------------- */
  var VC_NEAR=8,VC_FAR=40,VC_MAX=15,VC_TALK=0.02;
  var VC={code:'',ws:null,state:'off',msg:'',me:'',ice:[],peers:{},retry:0,retryAt:0,pinged:0,heard:0,
    mic:null,micBusy:false,micErr:'',micAsked:false,sending:false,myLevel:0,myTalkAt:0,ctx:null,out:null,
    muted:{},input:-1e12,ver:0,hud:null,hudKey:''};
  function vcChanged(){VC.ver++;if(menuOpen)runLive();}
  function vcState(st,msg){if(VC.state===st&&VC.msg===(msg||''))return;VC.state=st;VC.msg=msg||'';vcChanged();}
  // (someone used this computer: keys, clicks; for an Always open world, see vcWorld)
  function vcInput(){VC.input=now();}
  if(W.addEventListener){W.addEventListener('keydown',vcInput,true);W.addEventListener('mousedown',vcInput,true);}

  // the world whose voice chat this game is in: a world opened to friends here, or a friend's world
  // joined, through Thunder's relay (its code); '' otherwise
  function vcWorld(){
    try{
      if(aoWorldUp()&&now()-VC.input>AO_AWAY)return '';
      if(LJ.active&&(LJ.state==='joining'||LJ.state==='playing')&&lanIsSite(LJ.relay))return String(LJ.code||'').toLowerCase();
      if((LH.state==='open'||LH.state==='relaylost')&&LH.site&&LH.code&&HEN&&HEN.X)return String(LH.code).toLowerCase();
    }catch(_){}
    return '';
  }
  // the world's voice chat on this site's relay
  function vcJoin(){
    var base=lanSiteRelay(),ws;
    if(!base||!W.WebSocket){vcState('none','voice chat needs Thunder\'s relay');return;}
    if(!W.RTCPeerConnection){vcState('none','this browser has no WebRTC, which voice chat needs');return;}
    lanTurn();                          // this site's TURN logins, for players who cannot connect directly
    try{ws=new W.WebSocket(base+'?voice='+encodeURIComponent(VC.code));}catch(_){vcRetry();return;}
    VC.ws=ws;VC.pinged=VC.heard=now();
    vcState('connecting','');
    ws.onopen=function(){if(VC.ws===ws){try{ws.send(JSON.stringify({t:'hi',name:lanMyName()}));}catch(_){}}};
    ws.onmessage=function(e){
      if(VC.ws!==ws||typeof e.data!=='string')return;
      VC.heard=now();
      if(e.data==='pong')return;
      var m;try{m=JSON.parse(e.data);}catch(_){return;}
      if(m&&typeof m==='object')vcOn(m);
    };
    ws.onclose=function(){if(VC.ws!==ws)return;VC.ws=null;vcDropAll();vcRetry();};
    ws.onerror=function(){};
  }
  // (again after 3 s, 6 s, ... up to a minute)
  function vcRetry(){
    VC.retry=Math.min(VC.retry+1,6);
    VC.retryAt=now()+Math.min(60000,3000*Math.pow(2,VC.retry-1));
    vcState('retry','');
  }
  function vcLeave(){
    var ws=VC.ws;VC.ws=null;
    if(ws){ws.onclose=null;try{ws.close();}catch(_){}}
    vcDropAll();vcMicOff();
    VC.me='';VC.micAsked=false;
    vcState('off','');
  }
  function vcOn(m){
    var i;
    switch(m.t){
      case 'room':
        VC.me=String(m.you||'');VC.retry=0;
        VC.ice=(Array.isArray(m.ice)?m.ice:[]).filter(function(u){return typeof u==='string'&&/^stuns?:/i.test(u);}).map(function(u){return {urls:u};});
        vcState('on','');
        for(i=0;m.list&&i<m.list.length;i++)vcPeer(m.list[i]);
        // Always on: the microphone starts by itself once this browser has allowed it before
        if(S.voiceOpen)vcMicIfAllowed();
        return;
      case 'join':vcPeer(m);return;
      case 'leave':vcDrop(String(m.id||''));vcChanged();return;
      case 'sig':vcSig(String(m.from||''),m.d);return;
    }
  }

  // ---- one connection per other player ----
  // Of each pair, the one whose id sorts first sends the offer; the audio channel is there from
  // the start (sending nothing until the microphone is on), so nothing is negotiated again later.
  function vcPeer(m){
    var id=String(m&&m.id||'');
    if(!id||id===VC.me||!/^[A-Z0-9]{1,16}$/.test(id))return null;
    if(VC.peers[id])return VC.peers[id];
    var n=0;for(var k in VC.peers)n++;
    if(n>=VC_MAX)return null;
    var P={id:id,name:String(m.name||'Player').replace(/[^A-Za-z0-9_]/g,'').slice(0,16)||'Player',pc:null,tr:null,state:'connecting',
      el:null,src:null,an:null,buf:null,gain:null,pan:null,level:0,talkAt:0,at:now(),tries:0};
    VC.peers[id]=P;
    vcStart(P);
    vcChanged();
    return P;
  }
  function vcStart(P){
    var pc;
    try{pc=new W.RTCPeerConnection({iceServers:lanIceAll(VC.ice)});}catch(_){P.state='failed';return;}
    P.pc=pc;P.state='connecting';
    pc.ontrack=function(e){if(P.pc===pc)vcTrack(P,e);};
    pc.onconnectionstatechange=function(){
      if(P.pc!==pc)return;
      var s=pc.connectionState;
      P.state=s==='connected'?'on':s==='failed'?'failed':s==='disconnected'?'lost':s==='closed'?'closed':'connecting';
      // no path: the one who offers tries once more, a little later
      if(s==='failed'&&VC.me<P.id&&P.tries<1){P.tries++;W.setTimeout(function(){if(VC.peers[P.id]===P&&P.pc===pc){vcClose(P);vcStart(P);}},3000);}
      vcChanged();
    };
    if(VC.me<P.id){
      try{P.tr=pc.addTransceiver('audio',{direction:'sendrecv'});}catch(_){P.state='failed';return;}
      vcSend(P);
      pc.createOffer().then(function(o){return pc.setLocalDescription(o);})
        .then(function(){return vcGathered(pc);})
        .then(function(){if(P.pc===pc&&pc.localDescription)vcSig2(P.id,{type:'offer',sdp:pc.localDescription.sdp});})
        ['catch'](function(){if(P.pc===pc){P.state='failed';vcChanged();}});
    }
  }
  // the description with its candidates in it (gathered for at most 3 s): one message each way
  function vcGathered(pc){
    return new Promise(function(res){
      if(pc.iceGatheringState==='complete'){res();return;}
      var t=W.setTimeout(res,3000);
      pc.addEventListener('icegatheringstatechange',function(){if(pc.iceGatheringState==='complete'){W.clearTimeout(t);res();}});
    });
  }
  function vcSig2(to,d){var ws=VC.ws;if(ws&&ws.readyState===1){try{ws.send(JSON.stringify({t:'sig',to:to,d:d}));}catch(_){}}}
  function vcSig(from,d){
    if(!d||typeof d!=='object'||typeof d.sdp!=='string'||d.sdp.length>12000)return;
    if(d.type==='offer'){
      if(!(VC.me>from))return;                       // (this game offers to that player itself)
      var P=VC.peers[from]||vcPeer({id:from,name:'Player'});
      if(!P)return;
      if(P.pc&&P.pc.remoteDescription){vcClose(P);vcStart(P);}   // a new offer: the old connection failed
      var pc=P.pc;
      if(!pc)return;
      pc.setRemoteDescription({type:'offer',sdp:d.sdp}).then(function(){
        var tr=pc.getTransceivers()[0];
        if(tr){P.tr=tr;try{tr.direction='sendrecv';}catch(_){}vcSend(P);}
        return pc.createAnswer();
      }).then(function(a){return pc.setLocalDescription(a);})
        .then(function(){return vcGathered(pc);})
        .then(function(){if(P.pc===pc&&pc.localDescription)vcSig2(from,{type:'answer',sdp:pc.localDescription.sdp});})
        ['catch'](function(){if(P.pc===pc){P.state='failed';vcChanged();}});
      return;
    }
    if(d.type==='answer'){
      var Q=VC.peers[from];
      if(!Q||!Q.pc||!(VC.me<from)||Q.pc.signalingState!=='have-local-offer')return;
      var qpc=Q.pc;
      qpc.setRemoteDescription({type:'answer',sdp:d.sdp})['catch'](function(){if(Q.pc===qpc){Q.state='failed';vcChanged();}});
    }
  }
  // their voice: through Web Audio (volume, left/right, how loud it is now)
  function vcTrack(P,e){
    var st=e.streams&&e.streams[0]?e.streams[0]:new W.MediaStream([e.track]);
    vcUnhook(P);
    // (Chrome passes a voice from another computer to Web Audio only while a media element plays it too)
    try{var el=new W.Audio();el.muted=true;el.srcObject=st;var pr=el.play();if(pr&&pr['catch'])pr['catch'](function(){});P.el=el;}catch(_){}
    var ctx=vcCtx();
    if(!ctx)return;
    try{
      P.src=ctx.createMediaStreamSource(st);
      P.an=ctx.createAnalyser();P.an.fftSize=512;P.buf=new W.Float32Array(P.an.fftSize);
      P.gain=ctx.createGain();P.gain.gain.value=0;
      P.pan=ctx.createStereoPanner?ctx.createStereoPanner():null;
      P.src.connect(P.an);P.src.connect(P.gain);
      if(P.pan){P.gain.connect(P.pan);P.pan.connect(VC.out);}else P.gain.connect(VC.out);
    }catch(_){}
  }
  function vcUnhook(P){
    [P.src,P.an,P.gain,P.pan].forEach(function(n){if(n){try{n.disconnect();}catch(_){}}});
    P.src=P.an=P.gain=P.pan=null;P.buf=null;
    if(P.el){try{P.el.pause();P.el.srcObject=null;}catch(_){}P.el=null;}
  }
  function vcClose(P){
    var pc=P.pc;P.pc=null;P.tr=null;
    vcUnhook(P);
    if(pc){pc.ontrack=null;pc.onconnectionstatechange=null;try{pc.close();}catch(_){}}
  }
  function vcDrop(id){var P=VC.peers[id];if(!P)return;vcClose(P);delete VC.peers[id];}
  function vcDropAll(){for(var k in VC.peers)vcDrop(k);vcChanged();}
  function vcCtx(){
    if(VC.ctx)return VC.ctx;
    var AC=W.AudioContext||W.webkitAudioContext;
    if(!AC)return null;
    try{VC.ctx=new AC();VC.out=VC.ctx.destination;}catch(_){VC.ctx=null;}
    return VC.ctx;
  }

  // ---- your microphone ----
  function vcSend(P){
    var t=VC.mic?VC.mic.track:null;
    if(P.tr&&P.tr.sender){try{var r=P.tr.sender.replaceTrack(t);if(r&&r['catch'])r['catch'](function(){});}catch(_){}}
  }
  function vcMicOn(){
    if(VC.mic||VC.micBusy||!VC.code)return;
    var md=W.navigator&&W.navigator.mediaDevices;
    if(!md||!md.getUserMedia){VC.micErr='this browser cannot use a microphone on this page';vcChanged();return;}
    VC.micBusy=true;VC.micErr='';VC.micAsked=true;vcChanged();
    md.getUserMedia({audio:{echoCancellation:true,noiseSuppression:true,autoGainControl:true},video:false}).then(function(st){
      VC.micBusy=false;
      var tr=st.getAudioTracks()[0];
      // (gone meanwhile: left the world, or voice chat switched off)
      if(!tr||!VC.code||!S.voice){st.getTracks().forEach(function(t){t.stop();});if(!tr)VC.micErr='no microphone was found';vcChanged();return;}
      tr.enabled=false;
      VC.mic={stream:st,track:tr,an:null,buf:null,src:null};
      tr.addEventListener('ended',function(){if(VC.mic&&VC.mic.track===tr){vcMicOff();VC.micErr='the microphone stopped (unplugged, or turned off in the browser)';vcChanged();}});
      var ctx=vcCtx();
      if(ctx){try{VC.mic.src=ctx.createMediaStreamSource(st);VC.mic.an=ctx.createAnalyser();VC.mic.an.fftSize=512;VC.mic.buf=new W.Float32Array(512);VC.mic.src.connect(VC.mic.an);}catch(_){}}
      for(var k in VC.peers)vcSend(VC.peers[k]);
      vcChanged();
    },function(e){
      VC.micBusy=false;
      var n=e&&e.name;
      VC.micErr=n==='NotAllowedError'||n==='SecurityError'?'the browser did not allow the microphone (allow it in the site settings, at the left of the address bar)':
        n==='NotFoundError'?'no microphone was found':'the microphone could not start';
      soToast({kind:'info',title:'Voice chat',text:VC.micErr.charAt(0).toUpperCase()+VC.micErr.slice(1)+'.',quiet:true,tag:'voice'});
      vcChanged();
    });
  }
  // Always on: start the microphone without asking, if this browser has allowed it already
  function vcMicIfAllowed(){
    try{
      W.navigator.permissions.query({name:'microphone'}).then(function(p){if(p&&p.state==='granted'&&S.voiceOpen)vcMicOn();},function(){});
    }catch(_){}
  }
  function vcMicOff(){
    var m=VC.mic;VC.mic=null;VC.sending=false;
    if(!m)return;
    if(m.src){try{m.src.disconnect();}catch(_){}}
    try{m.stream.getTracks().forEach(function(t){t.stop();});}catch(_){}
    for(var k in VC.peers)vcSend(VC.peers[k]);
  }
  function vcLevel(an,buf){
    if(!an||!buf)return 0;
    try{an.getFloatTimeDomainData(buf);}catch(_){return 0;}
    var s=0;for(var i=0;i<buf.length;i++)s+=buf[i]*buf[i];
    return Math.sqrt(s/buf.length);
  }

  // every 100 ms: push to talk, each voice's volume (proximity) and side, who is talking
  W.setInterval(function(){
    try{
      if(!VC.code)return;
      if(VC.ctx&&VC.ctx.state==='suspended'&&now()-VC.input<1000){try{VC.ctx.resume();}catch(_){}}
      var inGame=!!(HEN&&HEN.X&&HEN.cm===null&&!menuOpen&&!hudEditing);
      var held=inGame&&bindDown(S.voiceKey||'KeyV');
      // the first press asks for the microphone (once a world: a refusal is not asked again)
      if(held&&!VC.mic&&!VC.micBusy&&!VC.micAsked&&!S.voiceOpen)vcMicOn();
      if(S.voiceOpen&&!VC.mic&&!VC.micBusy&&!VC.micAsked&&VC.state==='on'&&now()-VC.input<1000)vcMicOn();
      var send=!!(VC.mic&&(S.voiceOpen||held));
      if(VC.mic&&VC.mic.track.enabled!==send)VC.mic.track.enabled=send;
      if(send!==VC.sending){VC.sending=send;vcChanged();}
      VC.myLevel=send&&VC.mic?vcLevel(VC.mic.an,VC.mic.buf):0;
      if(VC.myLevel>VC_TALK||(send&&!S.voiceOpen))VC.myTalkAt=now();
      vcVolumes();
      vcHud();
    }catch(e){report(e);}
  },100);
  function vcVolumes(){
    var ctx=VC.ctx,me=HEN&&HEN.v,byName={},list,n,i,p,k,P;
    if(!ctx)return;
    if(S.voiceProximity&&HEN&&HEN.X&&me){
      list=HEN.X.e4;n=list?EH(list):0;
      for(i=0;i<n;i++){p=Bm(list,i);if(p&&p!==me)byName[cosNameOf(p).toLowerCase()]=p;}
    }
    var base=Math.max(0,Math.min(2,(S.voiceVolume==null?100:S.voiceVolume)/100));
    for(k in VC.peers){
      P=VC.peers[k];
      if(!P.gain)continue;
      var v=VC.muted[P.name.toLowerCase()]?0:base,pan=0;
      if(v>0&&S.voiceProximity){
        var e=byName[P.name.toLowerCase()];
        if(!e||!me)v=0;
        else{
          var dx=e.b-me.b,dy=e.f-me.f,dz=e.c-me.c,d=Math.sqrt(dx*dx+dy*dy+dz*dz),h=Math.sqrt(dx*dx+dz*dz);
          v*=d<=VC_NEAR?1:d>=VC_FAR?0:1-(d-VC_NEAR)/(VC_FAR-VC_NEAR);
          // left or right of where you look (yaw 0 faces south, +z; your right is then west, -x)
          if(h>0.5){var y=me.C*Math.PI/180;pan=Math.max(-1,Math.min(1,(dx*-Math.cos(y)+dz*-Math.sin(y))/h))*0.75;}
        }
      }
      try{P.gain.gain.setTargetAtTime(v,ctx.currentTime,0.06);if(P.pan)P.pan.pan.setTargetAtTime(pan,ctx.currentTime,0.06);}catch(_){}
      P.vol=v;
      P.level=vcLevel(P.an,P.buf);
      if(P.level>VC_TALK&&v>0.01)P.talkAt=now();
    }
  }

  // ---- who is talking (left of the screen) ----
  var VC_CSS=[
    '#thunder-voice{position:fixed;left:8px;top:42%;z-index:1500;pointer-events:none;display:flex;flex-direction:column;gap:4px;',
      'font:12px/1.2 system-ui,-apple-system,Segoe UI,sans-serif;color:#e8f6ff}',
    '#thunder-voice div{display:flex;align-items:center;gap:6px;padding:3px 9px 3px 6px;border-radius:999px;background:rgba(8,14,22,.78);',
      'border:1px solid rgba(79,209,255,.35);box-shadow:0 0 10px rgba(79,209,255,.18);max-width:180px}',
    '#thunder-voice div.vc-me{border-color:rgba(125,255,154,.5);box-shadow:0 0 10px rgba(125,255,154,.2)}',
    '#thunder-voice span{white-space:nowrap;overflow:hidden;text-overflow:ellipsis}',
    '#thunder-voice svg{flex:0 0 auto}',
    // the card
    '.tvc-row{display:flex;align-items:center;gap:8px;padding:5px 9px;border-radius:8px;background:rgba(3,7,12,.42);color:#dff6ff;font-size:12px}',
    '.tvc-row span{flex:1;min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}',
    '.tvc-row em{font-style:normal;font-size:10.5px;color:#7c95a8}.tvc-row em.tvc-talk{color:#7dff9a}',
    '.tvc-rows{display:flex;flex-direction:column;gap:4px;margin-top:6px;max-height:220px;overflow-y:auto}',
    '.tvc-mic{display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-top:6px}'
  ].join('');
  function vcCss(){
    if(D.getElementById('thunder-voice-style'))return;
    var st=D.createElement('style');st.id='thunder-voice-style';st.textContent=VC_CSS;
    (D.head||D.documentElement).appendChild(st);
  }
  var VC_ICON='<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round">'+
    '<path d="M4 10v4M8 7v10M12 4v16M16 7v10M20 10v4"/></svg>';
  function vcHud(){
    var t=now(),rows=[],k,P;
    if(VC.code&&HEN&&HEN.X){
      if(VC.sending&&t-VC.myTalkAt<600)rows.push({me:true,n:'You'});
      for(k in VC.peers){P=VC.peers[k];if(t-P.talkAt<600)rows.push({n:P.name});}
    }
    var key=rows.map(function(r){return (r.me?'*':'')+r.n;}).join('|');
    if(key===VC.hudKey)return;
    VC.hudKey=key;
    if(!rows.length){if(VC.hud)VC.hud.style.display='none';return;}
    vcCss();
    if(!VC.hud){VC.hud=el('div');VC.hud.id='thunder-voice';}
    if(VC.hud.parentNode!==D.body)D.body.appendChild(VC.hud);
    VC.hud.style.display='';
    while(VC.hud.firstChild)VC.hud.removeChild(VC.hud.firstChild);
    rows.forEach(function(r){
      var d=el('div',r.me?'vc-me':'');d.innerHTML=VC_ICON;d.appendChild(el('span',null,r.n));
      VC.hud.appendChild(d);
    });
  }

  // every second: join the voice chat of the world you are in, leave it when you leave the world
  W.setInterval(function(){
    try{
      var code=S.voice?vcWorld():'';
      if(code!==VC.code){vcLeave();VC.code=code;VC.retry=0;VC.retryAt=0;if(!code){vcHud();return;}}
      if(!code)return;
      if(!VC.ws){if(VC.state!=='none'&&now()>=VC.retryAt)vcJoin();return;}
      // a connection that died without closing: the relay answers every ping
      if(VC.ws.readyState===1){
        if(VC.pinged>VC.heard&&now()-VC.pinged>30000){var dead=VC.ws;VC.ws=null;try{dead.close();}catch(_){}vcDropAll();vcRetry();return;}
        if(now()-VC.pinged>25000&&VC.pinged<=VC.heard){VC.pinged=now();try{VC.ws.send('ping');}catch(_){}}
      }
    }catch(e){report(e);}
  },1000);

  // ---- Right Shift > Friends > Voice Chat ----------------------------------------------------
  function vcStatus(){
    if(!S.voice)return ['','Off','you do not hear anyone, and nobody hears you'];
    if(!VC.code)return ['','Not in a world','open your world to friends, or join a friend\'s world, to talk'];
    var n=0,on=0,k;for(k in VC.peers){n++;if(VC.peers[k].state==='on')on++;}
    switch(VC.state){
      case 'on':return ['tcm-ok',n?'In voice chat with '+n+(n===1?' player':' players'):'In voice chat',
        n?(on<n?on+' connected, '+(n-on)+' connecting':'everyone connected'):'nobody else is in it yet'];
      case 'none':return ['tcm-bad','Not available',VC.msg];
      case 'retry':return ['tcm-warn','Connecting','the relay did not answer; trying again'];
      default:return ['tcm-warn','Connecting',''];
    }
  }
  SPECIALS.voice=function(box){
    soCss();lanCss();vcCss();
    lanStatusRow(box,vcStatus);
    var micRow=el('div','tvc-mic'),micNote=el('div','tcs-note'),micB=lanBtn('',function(){if(VC.mic)vcMicOff();else{VC.micAsked=false;vcMicOn();}vcChanged();});
    micRow.appendChild(micB);micRow.appendChild(micNote);box.appendChild(micRow);
    var rows=el('div','tvc-rows');box.appendChild(rows);
    var ver=-1;
    function paint(){
      var inWorld=!!VC.code&&S.voice;
      micRow.style.display=inWorld?'':'none';
      micB.textContent=VC.micBusy?'Asking for the microphone\u2026':VC.mic?'Turn microphone off':'Use my microphone';
      micB.disabled=!!VC.micBusy;
      micNote.textContent=VC.micErr?VC.micErr.charAt(0).toUpperCase()+VC.micErr.slice(1)+'.':
        VC.mic?(S.voiceOpen?'Your microphone is on: everyone hears you.':'Hold '+keyLabel(S.voiceKey||'KeyV')+' to talk.'):
        'Nobody hears you until you use your microphone ('+(S.voiceOpen?'Always on':'or hold '+keyLabel(S.voiceKey||'KeyV'))+').';
      micNote.className='tcs-note'+(VC.micErr?' tcs-bad':'');
      while(rows.firstChild)rows.removeChild(rows.firstChild);
      for(var k in VC.peers)(function(P){
        var r=el('div','tvc-row'),nm=P.name,mute=!!VC.muted[nm.toLowerCase()];
        r.appendChild(el('span',null,nm));
        var talk=now()-P.talkAt<600;
        r.appendChild(el('em',talk?'tvc-talk':'',mute?'muted':talk?'talking':P.state==='on'?(S.voiceProximity&&!(P.vol>0)?'too far to hear':'connected'):
          P.state==='failed'?'no connection (their network or yours blocks it)':P.state==='lost'?'reconnecting':'connecting'));
        r.appendChild(soBtn(mute?'Unmute':'Mute',function(){if(mute)delete VC.muted[nm.toLowerCase()];else VC.muted[nm.toLowerCase()]=1;vcChanged();}));
        rows.appendChild(r);
      })(VC.peers[k]);
    }
    addLive(function(){
      // (talking and "too far" change all the time: looked at every half second too)
      var v=VC.ver+'/'+Math.floor(now()/500);
      if(v===ver)return;
      ver=v;paint();
    });
  };
  var VC_MOD={cat:'friends',id:'voice',name:'Voice Chat',wide:true,always:true,special:'voice',
    onChange:function(v){if(!v){vcLeave();VC.code='';}},
    desc:'Talk with the players in a world you opened to friends or joined. Voices go straight between your games, never through Thunder. '+
      'Hold V to talk; your microphone is used only once you choose it.',
    opts:[{id:'voiceKey',name:'Push-to-talk key',key:true},
      {id:'voiceOpen',name:'Always on (no push to talk)'},
      {id:'voiceProximity',name:'Proximity: hear players from where they stand (fades out by 40 blocks)'},
      {id:'voiceVolume',name:'Volume',min:0,max:200,step:5,fmt:function(v){return Math.round(v)+'%';}}]};
  (function(){var i=MODULES.indexOf(PT_MOD);if(i<0)MODULES.push(VC_MOD);else MODULES.splice(i+1,0,VC_MOD);})();
  // for tests and the console
  TC.voice={state:VC,world:vcWorld,micOn:vcMicOn,micOff:vcMicOff,leave:vcLeave};
