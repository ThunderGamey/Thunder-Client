  /* -------------------------------------------------------------------------------------------
     Part of Thunder Client, created and owned by Jayvardhan Ginni (ThunderGamey).
     Thunder LAN: open a singleplayer world to friends, and join a friend's world with a code.
     Always open keeps one world open on a computer that is left on for it.
     Included into the client scope of thunder-client.js by build.js. How it works, what was
     tested and the limits: thunder/NETWORKING.md.

     The host half of Eaglercraft's shared-world system is already in this 1.12.2 build: the
     integrated server accepts extra player channels (IPC packet 0x0C) and speaks EaglercraftX's
     LAN framing on them. What the build lacks is the browser half, which this module adds:
       - the relay protocol (EaglerSPRelay, protocol version 1): the host registers and gets a join
         code, a friend looks the code up, and the relay passes the WebRTC offer/answer and ICE
         candidates between them (it never sees game traffic);
       - WebRTC data channels ("lan", reliable and ordered) between the two browsers, with
         reliable STUN servers and this site's own TURN relay when it has one (/turn,
         functions/turn.js) for computers that cannot reach each other directly;
       - this site's own relay when it has one (/relay: the thunder-relay Worker): tried first,
         since it can be reached wherever the game loads, and when two players cannot connect
         at all it carries the game itself (a tunnel of two WebSockets);
       - host: each friend's data channel is bridged to a player channel on the host's server
         worker, bytes passed through unchanged in both directions;
       - friend: the game's own singleplayer connecting screen and login run as usual, with the
         local player's channel carried over the data channel instead of to a local worker.

     Game functions this module replaces (each wrapper falls through to the original):
     @hook EBA net.lax1dude.eaglercraft.sp.internal.ClientPlatformSingleplayer.sendPacket
     @hook E9$ net.lax1dude.eaglercraft.sp.SingleplayerServerController.setPaused
     @hook CnZ net.lax1dude.eaglercraft.sp.SingleplayerServerController.killWorker
     @hook FtB net.lax1dude.eaglercraft.notifications.ServerNotificationManager.runTick
     @hook Eh1 net.minecraft.client.Minecraft.launchIntegratedServer

     Game functions and classes it uses:
     @use DeG net.lax1dude.eaglercraft.sp.internal.ClientPlatformSingleplayer$WorkerBinaryPacketHandlerImpl.onMessage$exported$0
     @use BGl net.minecraft.client.gui.GuiScreen.<init>
     (Minecraft.displayGuiScreen GGs is declared as a hook in thunder-boot.js, GuiMainMenu Hj as a
     class in thunder-title.js.)
     @use EE6 net.lax1dude.eaglercraft.profile.EaglerProfile.getName
     @use F3B net.lax1dude.eaglercraft.profile.EaglerProfile.setName
     @use Gh8 net.lax1dude.eaglercraft.sp.SingleplayerServerController.startIntegratedServerWorker
     @class BoL net.lax1dude.eaglercraft.sp.gui.GuiScreenSingleplayerConnecting
     @class CO net.minecraft.client.gui.GuiScreen
     @virtual TZ net.minecraft.client.gui.GuiScreen doesGuiPauseGame
     @class Bxj net.minecraft.client.gui.GuiIngameMenu
     @virtual ec net.minecraft.client.gui.GuiIngameMenu initGui
     @virtual ey net.minecraft.client.gui.GuiIngameMenu actionPerformed

     Static fields:
     @staticset HAY net.lax1dude.eaglercraft.sp.internal.ClientPlatformSingleplayer.startIntegratedServer (the integrated server's Worker)
     @static H5m net.lax1dude.eaglercraft.sp.internal.ClientPlatformSingleplayer (1 = no Worker: server on the main thread)
     @static HFB net.lax1dude.eaglercraft.sp.SingleplayerServerController (server state; 2, 3, 9 and 11 = a world is running,
       0 = ready for one, -1 = its Worker is starting, -2 = no Worker yet)
     @static H5i net.lax1dude.eaglercraft.sp.SingleplayerServerController (the local player's SingleplayerNetworkManager)
     @staticset HEN net.minecraft.client.Minecraft.<init> (the Minecraft instance)

     Instance fields:
     @field bd2 net.lax1dude.eaglercraft.sp.internal.ClientPlatformSingleplayer.sendPacket IPCPacketData.channel
     @field bd_ net.lax1dude.eaglercraft.sp.internal.ClientPlatformSingleplayer.sendPacket IPCPacketData.contents
     @field a9M net.minecraft.network.SingleplayerNetworkManager.checkDisconnected SingleplayerNetworkManager open flag
     @field cp net.minecraft.client.Minecraft.runTick Minecraft.isGamePaused
     @field cm net.minecraft.client.Minecraft.runGameLoop Minecraft.currentScreen
     @field X net.minecraft.client.renderer.EntityRenderer.updateLightmap Minecraft.world
     @field blC net.minecraft.client.Minecraft.launchIntegratedServer GuiScreenSingleplayerConnecting.networkManager
     @field cxf net.minecraft.client.Minecraft.launchIntegratedServer GuiScreenSingleplayerConnecting.ticks
     @field cGJ net.minecraft.client.Minecraft.launchIntegratedServer GuiScreenSingleplayerConnecting.loginSent
     @field b$T net.minecraft.client.Minecraft.launchIntegratedServer GuiScreenSingleplayerConnecting.parent
     @field cTm net.minecraft.client.Minecraft.launchIntegratedServer GuiScreenSingleplayerConnecting.message
     @field be net.minecraft.client.gui.GuiIngameMenu.initGui GuiScreen.buttonList
     @field bW net.minecraft.client.gui.GuiIngameMenu.initGui GuiButton.enabled
     @field ds net.minecraft.client.gui.GuiIngameMenu.initGui GuiButton.displayString
     @field bE net.minecraft.client.gui.GuiIngameMenu.actionPerformed GuiButton.id
     @field Jo net.lax1dude.eaglercraft.notifications.ServerNotificationManager.runTick its notification map (null once destroyed)
     (ArrayList size/get: EH and Bm, declared in thunder-client.js)
  ------------------------------------------------------------------------------------------- */
  var LAN_RELAYS=['wss://relay.deev.is/','wss://relay.lax1dude.net/','wss://relay.shhnowisnottheti.me/'];
  var LAN_LOCAL='~!LOCAL_PLAYER',LAN_IPC='~!IPC';
  var LAN_FRAG=0xFF00;            // largest data channel message, as EaglercraftX sends it
  var LAN_RELAY_TIMEOUT=8000;     // per relay: connect + handshake
  var LAN_RTC_TIMEOUT=20000;      // offer -> open data channel
  var LAN_CAND_WAIT=3000;         // ICE candidates are batched this long after the first one
  var LAN_TUN_AFTER=10000;        // on this site's relay: no direct connection this long after the offer -> tunnel
  var LAN_TUN_BATCH=20;           // tunnel messages sent within this many ms travel together
  var LAN_TUN_MAX=262144;         // ...up to this many bytes

  function lanStatus(o,state,msg){o.state=state;o.msg=msg||'';o.at=now();if(menuOpen)runLive();}
  function lanLog(msg){if(W.console&&W.console.log)W.console.log('[Thunder LAN] '+msg);}

  // Where this site's own services are (/relay, /turn, and /social for Thunder Friends): next to
  // the page. The offline file (thunder/offline.js, a page opened from a folder) has no site of
  // its own, so it uses the website's: window.thunderSite (set by its loader), else
  // thunderclient.pages.dev (a file from before thunderSite, running a newer Thunder it
  // downloaded). They work wherever that website can be reached; it lets the file in (a page
  // opened from a folder sends Origin "null").
  var SITE_HOME='https://thunderclient.pages.dev/';
  function siteFile(){return !/^https?:/i.test(String(W.location.href));}
  // a website address you set by hand (Right Shift > Friends > Connection test): Thunder uses its
  // relay, TURN and Friends. For when the built-in one moved or is not set up, above all in the
  // offline file. Must be https://host/ .
  function siteOverride(){
    try{var o=String(W.localStorage.getItem('thunderSiteOverride')||'');return /^https:\/\/[^\/]+\/?$/.test(o)?o.replace(/\/?$/,'/'):'';}catch(_){return '';}
  }
  function siteBase(){
    var ov=siteOverride();
    if(ov)return ov;
    if(!siteFile())return String(W.location.href);
    if(W.thunderSite)return String(W.thunderSite);
    return W.__thunderOffline?SITE_HOME:'';
  }
  // Thunder's own relay and Friends hub are the thunder-relay Worker itself. The game talks to it
  // directly - /relay and /social on RELAY_HOME - so Friends works without the Pages service
  // binding: the offline file (Origin "null") is always let in, and the website is let in once its
  // origin is in the Worker's SITES variable (see thunder/NETWORKING.md). Everything else (/turn)
  // stays on the site. A website set by hand (siteOverride) routes all of it through that site.
  var RELAY_HOME='https://thunder-relay.thundergamey.workers.dev/';
  function siteUrl(p){
    try{
      var b=(!siteOverride()&&(p==='relay'||p==='social'))?RELAY_HOME:siteBase();
      var u=b?new W.URL(p,b):null;
      return u&&/^https?:$/.test(u.protocol)?u:null;
    }catch(_){return null;}
  }
  // what messages call it: "this site", or the website's name in the offline file
  function siteName(){var u=siteFile()?siteUrl(''):null;return u?u.host:'this site';}

  // relays: localStorage "thunderLanRelays" (JSON list, for self-hosted relays and tests), else
  // the relays in the launcher's eaglercraftXOpts, else the three public ones
  // This site's own relay (the thunder-relay Worker, reached at /relay on the site; see
  // thunder/NETWORKING.md) comes first: wherever the game loads it can be reached, and only it can
  // carry the game when two players cannot connect directly. Left out once the site says it has
  // none, or with localStorage "thunderLanSiteRelay" = "off".
  function lanSiteRelay(){
    try{
      if(W.localStorage.getItem('thunderLanSiteRelay')==='off')return '';
      var u=siteUrl('relay');
      if(!u)return '';
      u.protocol=u.protocol==='https:'?'wss:':'ws:';u.search='';u.hash='';
      return u.href;
    }catch(_){return '';}
  }
  function lanIsSite(url){var s=lanSiteRelay();return !!s&&String(url||'').split('?')[0]===s;}
  function lanRelays(){
    var out=[],seen={},list=null,i,a,site=lanSiteRelay();
    if(site&&LAN_SITE.state!=='none'){out.push(site);seen[site]=1;}
    try{var o=W.localStorage.getItem('thunderLanRelays');if(o)list=JSON.parse(o);}catch(_){}
    if(!list||!list.length){try{list=W.eaglercraftXOpts&&W.eaglercraftXOpts.relays;}catch(_){list=null;}}
    if(!list||!list.length)list=LAN_RELAYS;
    for(i=0;i<list.length;i++){
      a=list[i];a=typeof a==='string'?a:(a&&(a.addr||a.address));
      if(typeof a==='string'&&/^wss?:\/\//i.test(a)&&!seen[a]){seen[a]=1;out.push(a);}
    }
    return out.length?out:LAN_RELAYS.slice();
  }
  function lanRelayName(url){return lanIsSite(url)?'the Thunder relay':String(url).split('?')[0].replace(/^wss?:\/\//i,'').replace(/\/+$/,'');}
  // a world opened or joined on a public relay instead of Thunder's own: it hands out shorter
  // codes and does not work on networks that block the public relays. This says so, when Thunder's
  // relay should have been there (a site is set) but was not reached.
  function lanOnPublic(relay){return !!(relay&&lanSiteRelay()&&!lanIsSite(relay));}
  function lanPublicWarn(){
    if(!lanSiteRelay())return '';
    return 'Thunder\'s own relay could not be reached (' + (LAN_SITE.state==='none' ? 'it is not set up on ' + siteName() : siteName() + ' did not answer') +
      '), so this uses a public relay with a shorter code that may not work on all networks. Fix it, or set another site, in the Connection test.';
  }

  // ---- relay packets (EaglerSPRelay protocol 1): 1 byte id, then fields; strings are 8-bit
  // characters with a 1-byte (ASCII8) or 2-byte big-endian (ASCII16) length
  function lanA8(b,s){s=String(s||'');if(s.length>255)s=s.slice(0,255);b.push(s.length);for(var i=0;i<s.length;i++)b.push(s.charCodeAt(i)&255);}
  function lanA16(b,s){s=String(s||'');if(s.length>65535)s=s.slice(0,65535);b.push((s.length>>8)&255,s.length&255);for(var i=0;i<s.length;i++)b.push(s.charCodeAt(i)&255);}
  function lanPkt(id,fn){var b=[id];if(fn)fn(b);return new Uint8Array(b).buffer;}
  function lanHandshakePkt(type,code){return lanPkt(0x00,function(b){b.push(type,1);lanA8(b,code);});}
  function lanPeerPkt(id,peer,text){return lanPkt(id,function(b){lanA8(b,peer);lanA16(b,text);});}
  function lanIdPkt(id,peer){return lanPkt(id,function(b){lanA8(b,peer);});}
  function lanRead(buf){
    var d=new Uint8Array(buf),i=0;
    function u8(){if(i>=d.length)throw new Error('relay packet too short');return d[i++];}
    function str(n){var s='';for(var k=0;k<n;k++)s+=String.fromCharCode(u8());return s;}
    function s8(){return str(u8());}
    function s16(){var n=u8()<<8;n|=u8();return str(n);}
    var p={id:u8()},n,k;
    switch(p.id){
      case 0x00:p.type=u8();p.ver=u8();p.code=s8();break;
      case 0x01:n=u8()<<8;n|=u8();p.servers=[];
        for(k=0;k<n;k++)p.servers.push({type:String.fromCharCode(u8()),url:s16(),user:s8(),pass:s8()});
        break;
      case 0x02:case 0x05:case 0x06:p.peer=s8();break;
      case 0x03:case 0x04:case 0x20:case 0x22:p.peer=s8();p.text=s16();break;   // 0x20/0x22: Thunder relay tunnel
      case 0xFE:p.peer=s8();p.code=u8();p.text=s16();break;
      case 0xFF:p.code=u8();p.text=s16();break;
      default:p.other=true;       // 0x07 local worlds, 0x69 pong, 0x70 updates: not used here
    }
    return p;
  }
  // STUN/TURN list from packet 0x01 in RTCPeerConnection form
  function lanIce(servers){
    var out=[],i,s,e;
    for(i=0;i<(servers||[]).length;i++){
      s=servers[i];if(!s.url)continue;
      e={urls:s.url};if(s.user){e.username=s.user;e.credential=s.pass||'';}
      out.push(e);
    }
    return out;
  }
  // Connection servers. Two computers that cannot reach each other directly (school Wi-Fi, Wi-Fi
  // that keeps devices apart, a router without "NAT loopback") need a TURN relay in between; one
  // computer never does, which is why two tabs always worked. The public relays only hand out
  // Google STUN and an old free TURN login (openrelay.metered.ca) that no longer works, so Thunder
  // adds reliable STUN servers and, when this site has them, its own TURN logins: /turn
  // (functions/turn.js, Cloudflare's TURN service) or a list in localStorage "thunderLanIce".
  var LAN_STUN=[{urls:['stun:stun.l.google.com:19302','stun:stun1.l.google.com:19302']},{urls:'stun:stun.cloudflare.com:3478'}];
  var LAN_TURN={servers:[],at:0,state:'',promise:null};
  // TURN logins from this site. They last a day; a new set is asked for after an hour (after 30 s
  // when the last try failed). Resolves within 2.5 s either way, keeping the last good set.
  function lanTurn(){
    var t=now(),keep=LAN_TURN.state==='ok'||LAN_TURN.state==='none'?3600000:30000;
    if(LAN_TURN.promise&&t-LAN_TURN.at<keep)return LAN_TURN.promise;
    LAN_TURN.at=t;
    var url=siteUrl('turn');
    if(!url||!W.fetch){LAN_TURN.state='none';LAN_TURN.promise=Promise.resolve(LAN_TURN.servers);return LAN_TURN.promise;}
    var ctl=W.AbortController?new W.AbortController():null,timer=0;
    var got=W.fetch(url.href,{cache:'no-store',credentials:'same-origin',signal:ctl?ctl.signal:undefined})
      .then(function(r){
        if(r.status===404){LAN_TURN.state='none';LAN_TURN.servers=[];return null;}
        if(!r.ok){LAN_TURN.state='error '+r.status;return null;}
        return r.text();
      })
      .then(function(t){
        if(t==null)return LAN_TURN.servers;
        var j=null;
        try{j=JSON.parse(t);}catch(_){}
        // not Thunder's /turn: a static host (a site deployed without functions/, a copy of the
        // game elsewhere) answers an unknown address with its start page
        if(!j||typeof j!=='object'){LAN_TURN.state='none';LAN_TURN.servers=[];return LAN_TURN.servers;}
        var list=Array.isArray(j.iceServers)?j.iceServers.filter(function(s){return s&&s.urls;}):[];
        LAN_TURN.servers=list;LAN_TURN.state=list.some(lanIsTurn)?'ok':'none';
        return LAN_TURN.servers;
      })['catch'](function(){LAN_TURN.state='error';return LAN_TURN.servers;});
    var late=new Promise(function(ok){timer=W.setTimeout(function(){if(ctl)try{ctl.abort();}catch(_){}ok(LAN_TURN.servers);},2500);});
    LAN_TURN.promise=Promise.race([got,late]).then(function(v){W.clearTimeout(timer);return v;});
    return LAN_TURN.promise;
  }
  function lanIsTurn(s){var u=[].concat(s&&s.urls||[]);for(var i=0;i<u.length;i++)if(/^turns?:/i.test(u[i]))return true;return false;}
  function lanCustomIce(){try{var o=JSON.parse(W.localStorage.getItem('thunderLanIce')||'null');return Array.isArray(o)?o.filter(function(s){return s&&s.urls;}):[];}catch(_){return [];}}
  // everything a connection uses: Thunder's STUN servers, two of the relay's STUN servers and its
  // TURN servers (only while this site has none of its own), then custom and site TURN. Each
  // address is used once; port 53 is left out (browsers block it, so it only slows the search).
  function lanIceAll(relayIce){
    var out=[],seen={},stun=0,site=LAN_TURN.servers.some(lanIsTurn);
    function add(s){
      var urls=[].concat(s.urls).filter(function(u){
        u=String(u);
        var k=/^turns?:/i.test(u)?u+'|'+(s.username||''):u;
        if(seen[k]||/^(stuns?|turns?):[^?]*:53(\?|$)/i.test(u))return false;
        seen[k]=1;return true;
      });
      if(!urls.length)return;
      var e={urls:urls};
      if(s.username!=null){e.username=s.username;e.credential=s.credential||'';}
      out.push(e);
    }
    LAN_STUN.forEach(add);
    (relayIce||[]).forEach(function(s){if(lanIsTurn(s)){if(!site)add(s);}else if(stun++<2)add(s);});
    lanCustomIce().forEach(add);
    LAN_TURN.servers.forEach(add);
    return out;
  }
  // the kind of path an ICE candidate offers: host (the same network), srflx/prflx (through the
  // router, found with STUN), relay (a TURN server)
  function lanCandKind(c){var m=/ typ (host|srflx|prflx|relay)/.exec(String(c||''));return m?m[1]:'';}
  function lanCount(kinds,c){var k=lanCandKind(c);if(k&&kinds)kinds[k]=(kinds[k]||0)+1;}
  function lanKinds(o){var a=[];if(o.host)a.push('host');if(o.srflx||o.prflx)a.push('stun');if(o.relay)a.push('turn');return a.join('+')||'none';}
  // why a connection probably failed, from the candidates each side offered
  function lanNetHint(mine,theirs){
    if(!mine.relay&&!theirs.relay){
      if(LAN_TURN.state==='ok')return ' The TURN relay could not be reached from either network, so a firewall (often school or work Wi-Fi) is blocking it.';
      return ' Two computers on different networks, or on Wi-Fi that keeps devices apart, often need a TURN relay, and '+
        (LAN_TURN.state&&LAN_TURN.state!=='none'?siteName()+'\'s TURN relay did not answer ('+LAN_TURN.state+').':siteName()+' has none set up yet (Right Shift \u2192 Friends \u2192 Connection test).');
    }
    return ' Networks such as school or work Wi-Fi can block these connections.';
  }
  // how a connection ended up going: 'relay' (through a TURN server) or 'direct'; '' when the
  // browser does not say
  var LAN_PATHS={direct:'directly',relay:'through the TURN relay',tunnel:'through the Thunder relay'};
  function lanPath(pc,done){
    var st;
    try{st=pc.getStats();}catch(_){done('');return;}
    st.then(function(r){
      var pair=null,a,b;
      r.forEach(function(x){if(!pair&&x.type==='transport'&&x.selectedCandidatePairId)pair=r.get(x.selectedCandidatePairId);});
      r.forEach(function(x){if(!pair&&x.type==='candidate-pair'&&(x.selected||x.nominated&&x.state==='succeeded'))pair=x;});
      a=pair&&r.get(pair.localCandidateId);b=pair&&r.get(pair.remoteCandidateId);
      if(!a||!b){done('');return;}
      done(a.candidateType==='relay'||b.candidateType==='relay'?'relay':'direct');
    },function(){done('');});
  }
  // Connection test (Right Shift > Friends): whether the relays answer, and which kinds of paths
  // this device can offer with the same servers a real connection uses
  var LAN_TEST={state:'',text:''};
  function lanSelfTest(){
    if(LAN_TEST.state==='running')return;
    function finish(text){LAN_TEST.state='done';LAN_TEST.text=text;if(menuOpen)runLive();}
    if(!lanSupported()){finish('This browser cannot open connections to the relays (no WebSocket), so it cannot play with friends.');return;}
    LAN_TEST.state='running';LAN_TEST.text='Testing, about 8 seconds...';
    var kinds={},relays=lanRelays().filter(function(u){return !lanIsSite(u);}),relaysOk=0,site=null,rtc=!!W.RTCPeerConnection,left=2;
    relays.forEach(function(url){
      var ws=null;
      try{ws=new W.WebSocket(url);}catch(_){return;}
      var t=W.setTimeout(function(){try{ws.close();}catch(_){}},5000);
      ws.onopen=function(){relaysOk++;W.clearTimeout(t);try{ws.close();}catch(_){}};
      ws.onerror=function(){};
    });
    // this site's relay: asked whether it is there, then a real look-up through it
    lanSiteCheck().then(function(st){
      if(st==='none'){site='none';done();return;}
      lanSiteProbe(function(ok){site=ok?'ok':'error';done();});
    });
    lanTurn().then(function(){
      var pc=null;
      if(rtc){try{pc=new W.RTCPeerConnection({iceServers:lanIceAll([])});}catch(e){rtc=false;}}
      if(!pc){W.setTimeout(done,5000);return;}
      pc.onicecandidate=function(e){if(e.candidate)lanCount(kinds,e.candidate.candidate);};
      try{pc.createDataChannel('test');}catch(_){}
      pc.createOffer().then(function(o){return pc.setLocalDescription(o);})['catch'](function(){});
      W.setTimeout(function(){try{pc.close();}catch(_){}done();},5000);
    });
    function done(){
      if(--left>0)return;
      var turn=LAN_TURN.state==='ok'?(kinds.relay?'works':'set up, but this network blocks it'):
        LAN_TURN.state==='none'?'not set up on '+siteName():siteName()+' did not give a login ('+LAN_TURN.state+')';
      var thunder=site==='ok'?'works':site==='none'?'not set up on '+siteName():'did not answer';
      var sum;
      if(site==='ok')sum='Friends can join from any network where '+(siteFile()?siteName()+' can be reached':'this page loads')+': when no direct connection works, the game goes through the Thunder relay.';
      else if(!relaysOk)sum='No relay answered, so this network (or an extension) blocks them: codes cannot work here unless the site owner switches on the Thunder relay.';
      else if(!rtc)sum='This browser has no WebRTC, so it can only play with friends through the Thunder relay.';
      else if(kinds.relay)sum='Friends should be able to connect from other networks too.';
      else if(!kinds.srflx&&!kinds.prflx)sum='This network blocks browser-to-browser connections; only the TURN relay or the Thunder relay could get through.';
      else sum='Friends on the same computer, or on home networks that allow it, can connect. Other networks and school Wi-Fi need the TURN relay or the Thunder relay.';
      finish('Thunder relay: '+thunder+'. Public relays: '+relaysOk+' of '+relays.length+' answered. '+
        (rtc?'Internet (STUN): '+(kinds.srflx||kinds.prflx?'yes':'no')+'. TURN relay: '+turn+'. ':'WebRTC: not in this browser. ')+sum);
    }
  }
  // Whether this site has its relay: GET /relay answers {relay:true} (functions/relay.js with the
  // RELAY binding); cached like the TURN logins. '' = not asked yet (the relay is tried anyway).
  var LAN_SITE={state:'',at:0,promise:null};
  function lanSiteCheck(){
    var t=now(),keep=LAN_SITE.state==='ok'||LAN_SITE.state==='none'?3600000:30000;
    if(LAN_SITE.promise&&t-LAN_SITE.at<keep)return LAN_SITE.promise;
    LAN_SITE.at=t;
    var url=siteUrl('relay');
    if(!lanSiteRelay()||!url||!W.fetch){LAN_SITE.state='none';LAN_SITE.promise=Promise.resolve('none');return LAN_SITE.promise;}
    LAN_SITE.promise=W.fetch(url.href,{cache:'no-store',credentials:'same-origin'})
      .then(function(r){return r.text().then(function(t){var j=null;try{j=JSON.parse(t);}catch(_){}return {status:r.status,j:j};});})
      .then(function(x){
        // a start page (a site deployed without functions/) or a 404 means there is no relay here
        LAN_SITE.state=x.j&&x.j.relay===true?'ok':(x.status===404||!x.j||typeof x.j!=='object')?'none':'error '+x.status;
        return LAN_SITE.state;
      })['catch'](function(){LAN_SITE.state='error';return LAN_SITE.state;});
    return LAN_SITE.promise;
  }
  // a real round trip to this site's relay (the Connection test): a look-up of a code no world has
  // must come back as "no world with that code"
  function lanSiteProbe(done){
    var base=lanSiteRelay(),fin=false,s=base?lanSocket(base+'?join=zzzzzz',lanHandshakePkt(2,'zzzzzz')):null;
    if(!s){done(false);return;}
    var t=W.setTimeout(function(){end(false);},6000);
    function end(ok){if(fin)return;fin=true;W.clearTimeout(t);s.close();done(ok);}
    s.onPacket=function(p){end(p.id===0xFF&&p.code===5);};
    s.onClose=function(){end(false);};
  }
  // A tunnel through this site's relay for one friend, looking like a data channel to the rest of
  // this module (send, close, readyState, bufferedAmount, onopen/onmessage/onclose). Both ends say
  // "hello" when connected and the relay answers "ready" once both have. Messages sent within
  // LAN_TUN_BATCH ms travel as one ([u32 length][bytes]...), which keeps the relay's message count
  // (what Cloudflare counts) low; the other end splits them again, in order.
  function lanTunnel(code,peer,token,side){
    var base=lanSiteRelay(),ws;
    if(!base)return null;
    try{ws=new W.WebSocket(base+'?tunnel='+encodeURIComponent(code)+'&peer='+encodeURIComponent(peer)+'&token='+encodeURIComponent(token)+'&side='+side);}catch(_){return null;}
    ws.binaryType='arraybuffer';
    var q=[],qn=0,qt=0;
    var ch={readyState:'connecting',onopen:null,onmessage:null,onclose:null,
      send:function(b){
        if(ch.readyState!=='open')return;
        var u=b instanceof ArrayBuffer?new Uint8Array(b):new Uint8Array(b.buffer,b.byteOffset,b.byteLength);
        q.push(u);qn+=u.length+4;
        if(qn>=LAN_TUN_MAX)flush();else if(!qt)qt=W.setTimeout(flush,LAN_TUN_BATCH);
      },
      close:function(){if(ch.readyState==='closed')return;flush();ch.readyState='closed';try{ws.close();}catch(_){}}};
    try{Object.defineProperty(ch,'bufferedAmount',{get:function(){return (ws.bufferedAmount||0)+qn;}});}catch(_){ch.bufferedAmount=0;}
    function flush(){
      if(qt){W.clearTimeout(qt);qt=0;}
      if(!q.length)return;
      var out=new Uint8Array(qn),o=0,i,u,n;
      for(i=0;i<q.length;i++){
        u=q[i];n=u.length;
        out[o]=n>>>24;out[o+1]=(n>>>16)&255;out[o+2]=(n>>>8)&255;out[o+3]=n&255;
        out.set(u,o+4);o+=4+n;
      }
      q=[];qn=0;
      if(ws.readyState===1){try{ws.send(out.buffer);}catch(_){}}
    }
    ws.onopen=function(){try{ws.send('hello');}catch(_){}};
    ws.onmessage=function(e){
      if(typeof e.data==='string'){
        if(e.data==='ready'&&ch.readyState==='connecting'){ch.readyState='open';if(ch.onopen)ch.onopen();}
        return;
      }
      var d=new Uint8Array(e.data),o=0,n;
      while(o+4<=d.length&&ch.readyState==='open'&&ch.onmessage){
        n=((d[o]<<24)|(d[o+1]<<16)|(d[o+2]<<8)|d[o+3])>>>0;o+=4;
        if(o+n>d.length)break;
        ch.onmessage({data:e.data.slice(o,o+n)});
        o+=n;
      }
    };
    ws.onclose=function(){
      if(qt){W.clearTimeout(qt);qt=0;}
      q=[];qn=0;
      var was=ch.readyState;ch.readyState='closed';
      if(was!=='closed'&&ch.onclose)ch.onclose();
    };
    ws.onerror=function(){};
    return ch;
  }
  var LAN_ERRORS={0:'relay internal error',1:'protocol version not supported',2:'invalid packet',3:'illegal operation',
    4:'wrong code length',5:'no world with that code',6:'the world was closed',7:'unknown client'};

  // Connect to the relays in order until one completes the handshake. type 1 = host (code is the
  // world name, the relay answers with the join code), 2 = friend (code is the join code).
  // done(sock, handshake) or fail(message, lastErrorCode). Later packets go to sock.onPacket.
  // A relay drops a connection whose handshake arrives more than 500 ms after it opened; the
  // socket's Worker sends it at once (see lanSocket), and a relay that still closes right after
  // opening (a page without Workers during a busy game frame) is tried again (up to 3 times)
  // before moving on.
  function lanHandshake(type,code,progress,done,fail){
    var relays=lanRelays(),idx=-1,tries=0,lastErr='',lastCode=-1,cancelled=false;
    function next(again){
      if(cancelled)return;
      if(idx>=0&&lastErr)lanLog(lastErr);                  // why the last relay did not work
      if(again&&tries<3)tries++;
      else{tries=1;if(++idx>=relays.length){fail(lastErr||'no relay could be reached',lastCode);return;}}
      // this site's relay picks the world by its address: ?host (a new code) or ?join=code
      var url=relays[idx],to=lanIsSite(url)?url+(type===1?'?host'+lanKeepQuery():'?join='+encodeURIComponent(code)):url;
      var sock=lanSocket(to,lanHandshakePkt(type,code)),openedAt=0;
      if(progress)progress(url);
      if(!sock){lastErr='could not open '+lanRelayName(url);next();return;}
      var settled=false,t=W.setTimeout(function(){if(!settled){settled=true;lastErr=lanRelayName(url)+' did not answer';sock.close();next();}},LAN_RELAY_TIMEOUT);
      sock.onOpen=function(){openedAt=now();};          // the handshake went out as the socket opened
      sock.onPacket=function(p){
        if(settled)return;
        settled=true;W.clearTimeout(t);
        if(p.id===0x00){sock.onPacket=null;done(sock,p);return;}
        if(p.id===0xFF){lastCode=p.code;lastErr=(LAN_ERRORS[p.code]||('error '+p.code))+(p.text?' ('+p.text+')':'');}
        else lastErr=lanRelayName(url)+' sent an unexpected reply';
        sock.close();next();
      };
      sock.onClose=function(){
        if(settled)return;
        settled=true;W.clearTimeout(t);
        lastErr=lanRelayName(url)+' closed the connection';
        next(openedAt>0&&now()-openedAt<3000);
      };
    }
    next();
    return {cancel:function(){cancelled=true;}};
  }
  // The relay drops a connection whose handshake comes more than 500 ms after it opened, and a
  // heavy game frame (a slow computer loading chunks just after entering a world) can hold the
  // page that long. So the socket runs in a small Worker that sends the handshake (first) the
  // moment the connection opens, and passes packets to and from the page unchanged. Where a
  // Worker cannot start, the socket runs on the page as before.
  var LAN_WS_SRC='var ws=null;onmessage=function(e){var m=e.data;'+
    'if(m.t==="open"){try{ws=new WebSocket(m.url);}catch(_){postMessage({t:"close"});return;}ws.binaryType="arraybuffer";'+
      'ws.onopen=function(){if(m.first){try{ws.send(m.first);}catch(_){}}postMessage({t:"open"});};'+
      'ws.onmessage=function(ev){if(typeof ev.data!=="string")postMessage({t:"msg",d:ev.data},[ev.data]);else postMessage({t:"txt",d:ev.data});};'+
      'ws.onclose=function(){ws=null;postMessage({t:"close"});};ws.onerror=function(){};}'+
    'else if(m.t==="send"){if(ws&&ws.readyState===1){try{ws.send(m.d);}catch(_){}}}'+
    'else if(m.t==="close"){if(ws){try{ws.close();}catch(_){}}else postMessage({t:"close"});}};';
  var lanWsUrl=null;
  function lanWsWorker(){
    try{
      if(!W.Worker||!W.Blob||!W.URL||!W.URL.createObjectURL)return null;
      if(!lanWsUrl)lanWsUrl=W.URL.createObjectURL(new W.Blob([LAN_WS_SRC],{type:'text/javascript'}));
      return new W.Worker(lanWsUrl);
    }catch(_){return null;}
  }
  function lanSocket(url,first){
    var S2={url:url,open:false,closed:false,worker:false,onOpen:null,onPacket:null,onText:null,onClose:null,send:null,close:null};
    function opened(){if(S2.open||S2.closed)return;S2.open=true;if(S2.onOpen)S2.onOpen();}
    function text(t){if(!S2.closed&&S2.onText)S2.onText(String(t));}      // this site's relay: "pong"
    function packet(data){
      if(S2.closed||typeof data==='string')return;
      var p;
      try{p=lanRead(data);}catch(err){S2.close();if(S2.onClose)S2.onClose('bad packet');return;}
      if(p.other)return;
      if(S2.onPacket)S2.onPacket(p);
    }
    function ended(){var was=S2.closed;S2.closed=true;S2.open=false;if(!was&&S2.onClose)S2.onClose('closed');}
    function direct(){
      var ws;
      try{ws=new W.WebSocket(url);}catch(e){return false;}
      ws.binaryType='arraybuffer';
      S2.worker=false;
      S2.send=function(buf){if(S2.open&&!S2.closed){try{ws.send(buf);}catch(_){}}};
      S2.close=function(){if(!S2.closed){S2.closed=true;S2.open=false;try{ws.close();}catch(_){}}};
      ws.onopen=function(){if(S2.closed){try{ws.close();}catch(_){}return;}if(first){try{ws.send(first);}catch(_){}}opened();};
      ws.onmessage=function(e){if(typeof e.data==='string')text(e.data);else packet(e.data);};
      ws.onclose=ended;
      ws.onerror=function(){};
      return true;
    }
    var wk=lanWsWorker();
    if(wk){
      var stop=function(){try{wk.terminate();}catch(_){}};
      S2.worker=true;
      wk.onmessage=function(e){var m=e.data||{};if(m.t==='open')opened();else if(m.t==='msg')packet(m.d);else if(m.t==='txt')text(m.d);else if(m.t==='close'){stop();ended();}};
      wk.onerror=function(ev){
        try{if(ev&&ev.preventDefault)ev.preventDefault();}catch(_){}
        stop();
        if(!S2.open&&!S2.closed&&direct())return;       // the Worker could not start: run on the page
        ended();
      };
      S2.send=function(buf){if(S2.open&&!S2.closed)wk.postMessage({t:'send',d:buf});};
      S2.close=function(){if(!S2.closed){S2.closed=true;S2.open=false;wk.postMessage({t:'close'});W.setTimeout(stop,2000);}};
      wk.postMessage({t:'open',url:url,first:first||null});
      return S2;
    }
    return direct()?S2:null;
  }

  // ICE candidates as EaglercraftX sends them: collected for LAN_CAND_WAIT after the first one
  // (or until gathering ends), then one JSON list of {sdpMLineIndex, candidate}
  // (kinds, if given, counts what kinds of paths the sent list offers)
  function lanCollect(pc,ready,kinds){
    var list=[],timer=0,idle=0,sent=false;
    function flush(){if(sent)return;sent=true;if(timer)W.clearTimeout(timer);if(idle)W.clearTimeout(idle);ready(JSON.stringify(list));}
    // no candidate at all (a browser or school policy that allows only TURN, and none answers):
    // the empty list still goes out, so the other side is not left waiting until the relay gives up
    pc.onicegatheringstatechange=function(){if(pc.iceGatheringState==='gathering'&&!idle&&!timer&&!sent)idle=W.setTimeout(flush,LAN_CAND_WAIT+1000);};
    pc.onicecandidate=function(e){
      if(sent)return;
      if(!e.candidate){flush();return;}           // gathering finished
      lanCount(kinds,e.candidate.candidate);
      list.push({sdpMLineIndex:''+e.candidate.sdpMLineIndex,candidate:e.candidate.candidate});
      if(!timer){timer=W.setTimeout(flush,LAN_CAND_WAIT);if(idle)W.clearTimeout(idle);}
    };
    return flush;
  }
  function lanAddCandidates(pc,text,kinds){
    var list;
    try{list=JSON.parse(text);}catch(_){return 0;}
    var n=0;
    for(var i=0;list&&i<list.length;i++){
      lanCount(kinds,list[i]&&list[i].candidate);
      try{pc.addIceCandidate(new W.RTCIceCandidate({candidate:list[i].candidate,sdpMLineIndex:+list[i].sdpMLineIndex||0}))['catch'](function(){});n++;}catch(_){}
    }
    return n;
  }
  function lanSupported(){return !!W.WebSocket;}     // WebRTC too, except through this site's relay

  // Java DataOutputStream.writeUTF (modified UTF-8) for IPC packets
  function lanUTF(b,s){
    var bytes=[],i,c;
    for(i=0;i<s.length;i++){
      c=s.charCodeAt(i);
      if(c>=1&&c<=0x7F)bytes.push(c);
      else if(c<=0x7FF)bytes.push(0xC0|(c>>6),0x80|(c&63));
      else bytes.push(0xE0|(c>>12),0x80|((c>>6)&63),0x80|(c&63));
    }
    b.push((bytes.length>>8)&255,bytes.length&255);
    for(i=0;i<bytes.length;i++)b.push(bytes[i]);
  }
  function lanReadUTF(d,i){
    var n=(d[i]<<8)|d[i+1],s='',end=i+2+n,c;
    for(i+=2;i<end;){
      c=d[i++];
      if(c<0x80)s+=String.fromCharCode(c);
      else if((c&0xE0)===0xC0)s+=String.fromCharCode(((c&31)<<6)|(d[i++]&63));
      else{s+=String.fromCharCode(((c&15)<<12)|((d[i]&63)<<6)|(d[i+1]&63));i+=2;}
    }
    return {s:s,end:end};
  }
  // IPC 0x0C PlayerChannel: [0x0C][UTF channel][boolean open]
  function lanIpcChannel(ch,open){var b=[0x0C];lanUTF(b,ch);b.push(open?1:0);return new Uint8Array(b).buffer;}

  // Minecraft packets this module writes itself: a Disconnect with a chat reason, which makes the
  // friend's game show its usual "Failed to connect" / "Connection Lost" screen with that text.
  // 1.12.2 ids: LOGIN Disconnect 0x00, PLAY Disconnect 0x1A. play = the connection is past login.
  function lanVarInt(b,n){do{var v=n&127;n>>>=7;b.push(n?v|128:v);}while(n);}
  function lanUtf8(s){
    var out=[],i,c;
    for(i=0;i<s.length;i++){
      c=s.charCodeAt(i);
      if(c>=0xD800&&c<=0xDBFF&&i+1<s.length){var d=s.charCodeAt(i+1);if(d>=0xDC00&&d<=0xDFFF){c=0x10000+((c-0xD800)<<10)+(d-0xDC00);i++;}}
      if(c<0x80)out.push(c);
      else if(c<0x800)out.push(0xC0|(c>>6),0x80|(c&63));
      else if(c<0x10000)out.push(0xE0|(c>>12),0x80|((c>>6)&63),0x80|(c&63));
      else out.push(0xF0|(c>>18),0x80|((c>>12)&63),0x80|((c>>6)&63),0x80|(c&63));
    }
    return out;
  }
  function lanDisconnectPkt(play,text){
    var b=[],json=lanUtf8(JSON.stringify({text:String(text)}));
    lanVarInt(b,play?0x1A:0x00);lanVarInt(b,json.length);
    return b.concat(json);
  }
  // [0 = whole packet][VarInt id] of the first packet in a frame, -1 if it is not a whole packet
  function lanFrameId(d){return d.length>1&&d[0]===0&&d[1]<128?d[1]:-1;}

  function lanWorldRunning(){return HFB===2||HFB===3||HFB===9||HFB===11;}
  function lanMyName(){try{return String($rt_ustr(EE6())||'');}catch(_){return '';}}

  // =====================================================================================
  // Host: share the running singleplayer world
  // =====================================================================================
  var LH={state:'off',msg:'',code:'',relay:'',sock:null,ice:[],peers:{},worker:null,watch:0,at:0,pending:null,closing:0};
  function lanHosting(){return LH.state==='open'||LH.state==='relaylost'||lanPeerCount()>0;}
  function lanPeerCount(){var n=0;for(var k in LH.peers)if(LH.peers[k].channel)n++;return n;}
  function lanHostBlocker(){
    if(!lanSupported())return 'this browser cannot open connections to the relays, which sharing needs';
    if(!HEN||!HEN.X||!lanWorldRunning())return 'open a singleplayer world first';
    if(H5m||!HAY)return 'this browser runs the world without a background Worker, which sharing needs';
    return '';
  }
  // ---- a world keeps its code ----------------------------------------------------------------
  // Each world gets its own code and secret key the first time it is opened, kept in this browser
  // (localStorage, per world as the waypoints tell worlds apart). Thunder's relay reserves the code
  // for that key, so the world opens with the same code every time; "New code" rolls a new one.
  // The public relays hand out their own codes, so this only works through Thunder's relay.
  var LAN_KEEP_STORE='thunderWorldCodes_v1',LAN_CODE_CHARS='abcdefghijkmnpqrstuvwxyz23456789';
  function lanKeepLoad(){try{var o=JSON.parse(W.localStorage.getItem(LAN_KEEP_STORE)||'{}');return o&&typeof o==='object'?o:{};}catch(_){return {};}}
  function lanKeepSave(o){try{W.localStorage.setItem(LAN_KEEP_STORE,JSON.stringify(o));}catch(_){}}
  function lanRandom(chars,n){
    var b=new W.Uint8Array(n),out='',i;
    try{W.crypto.getRandomValues(b);}catch(_){for(i=0;i<n;i++)b[i]=Math.floor(Math.random()*256);}
    for(i=0;i<n;i++)out+=chars.charAt(b[i]%chars.length);
    return out;
  }
  function lanNewKept(){return {code:lanRandom(LAN_CODE_CHARS,6),key:lanRandom('0123456789abcdef',32)};}
  // this world's kept code and key (made the first time), or null outside a singleplayer world
  function lanKept(){
    var wk=wptWorldKey();
    if(!wk||wk.indexOf('sp:')!==0)return null;
    var all=lanKeepLoad(),e=all[wk];
    if(!e||!/^[a-z0-9]{6}$/.test(e.code||'')||!/^[0-9a-f]{32}$/.test(e.key||'')){e=lanNewKept();all[wk]=e;lanKeepSave(all);}
    e.wk=wk;
    return e;
  }
  function lanKeepQuery(){var k=LH.want;return k?'='+k.code+'&key='+k.key:'';}
  // the relay gave another code (someone else's world has this one): it becomes this world's code
  function lanKeepGot(code){
    var k=LH.want;
    if(!k||!code||code===k.code||!/^[a-z0-9]{6}$/.test(code))return;
    var all=lanKeepLoad();all[k.wk]={code:code,key:k.key};lanKeepSave(all);k.code=code;
  }
  function lanReroll(){
    var wk=wptWorldKey();
    if(!wk||wk.indexOf('sp:')!==0)return;
    var all=lanKeepLoad();all[wk]=lanNewKept();lanKeepSave(all);
    if(LH.state==='open'||LH.state==='connecting'){
      lanHostStop('');
      W.setTimeout(function(){if(LH.state!=='connecting'&&LH.state!=='open')lanHostStart();},1500);
    }
  }
  function lanHostStart(){
    if(LH.state==='connecting'||LH.state==='open')return;
    if(LH.closing){lanStatus(LH,'error','the last world is still closing; try again in a few seconds');return;}
    var why=lanHostBlocker();
    if(why){lanStatus(LH,'error',why);return;}
    LH.code='';LH.relay='';LH.ice=[];LH.site=false;
    try{LH.want=lanKept();}catch(_){LH.want=null;}
    lanTurn();                         // this site's TURN logins, ready before a friend arrives
    lanSiteCheck();
    lanStatus(LH,'connecting','connecting to a relay');
    LH.pending=lanHandshake(1,'Thunder world;0',function(url){lanStatus(LH,'connecting','connecting to '+lanRelayName(url));},
      function(sock,hs){
        LH.pending=null;
        if(LH.state!=='connecting'){sock.close();return;}
        LH.sock=sock;LH.code=hs.code;LH.relay=sock.url;LH.site=lanIsSite(sock.url);LH.pinged=now();LH.ponged=0;
        if(LH.site)lanKeepGot(String(hs.code||'').toLowerCase());
        sock.onText=function(t){if(t==='pong'&&LH.sock===sock)LH.ponged=now();};
        var t=W.setTimeout(function(){if(LH.sock===sock&&!LH.ice.length&&LH.state==='connecting'){lanHostStop('the relay did not send its connection servers');}},5000);
        sock.onPacket=function(p){
          if(p.id===0x01&&LH.state==='connecting'){
            W.clearTimeout(t);
            LH.ice=lanIce(p.servers);
            // without WebRTC, friends can only come in through this site's relay
            if(!W.RTCPeerConnection&&!LH.site){lanHostStop('this browser has no WebRTC, which friends need to connect through this relay');return;}
            lanHostAttach();
            lanStatus(LH,'open','');
            lanLog('world open on '+lanRelayName(sock.url)+', code '+LH.code);
            return;
          }
          lanHostPacket(p);
        };
        sock.onClose=function(){
          if(LH.sock!==sock)return;
          LH.sock=null;
          if(LH.state==='open')lanStatus(LH,'relaylost','the relay connection closed; friends already in can keep playing');
        };
      },
      function(err){LH.pending=null;if(LH.state==='connecting')lanStatus(LH,'error','could not open the world: '+err);});
  }
  // Stop sharing. Friends in the world are shown kickText (their game's "Connection Lost" screen)
  // and removed from it; the host keeps playing.
  function lanHostStop(reason,kickText){
    if(LH.pending){LH.pending.cancel();LH.pending=null;}
    if(LH.sock){LH.sock.close();LH.sock=null;}
    LH.code='';
    var left=0;
    for(var k in LH.peers){left++;lanHostKick(LH.peers[k],kickText||'The host stopped sharing the world.','host stopped sharing');}
    if(!left)lanHostDetach();          // otherwise lanHostDrop detaches when the last friend is gone
    lanStatus(LH,reason?'error':'off',reason||'');
  }
  // The world is closing (Save and Quit): the server itself tells everyone "Server closed" and
  // closes their channels; forwarding stays on until it has, or for at most 10 seconds.
  function lanHostWorldClosed(){
    if(LH.closing)return;
    if(LH.pending){LH.pending.cancel();LH.pending=null;}
    if(LH.sock){LH.sock.close();LH.sock=null;}
    LH.code='';
    lanStatus(LH,'off','');
    if(!lanPeerTotal()){lanHostDetach();return;}
    LH.closing=W.setTimeout(function(){
      for(var k in LH.peers)lanHostKick(LH.peers[k],'The host closed the world.','world closed');
    },10000);
  }
  function lanPeerTotal(){var n=0;for(var k in LH.peers)n++;return n;}
  // worker messages: this module forwards the friends' channels (the game drops channels it does
  // not know) and watches for the server closing one of them (kick, quit)
  function lanOnWorker(e){
    var d=e&&e.data;if(!d)return;
    var P=LH.peers[d.ch];
    if(P){
      if(P.kicked||!d.dat)return;
      if(!P.play&&lanFrameId(new Uint8Array(d.dat))===0x02)P.play=true;     // LOGIN Success
      if(P.dc&&P.dc.readyState==='open'){try{P.dc.send(d.dat);}catch(_){lanHostDrop(P,'send failed');}}
      return;
    }
    if(d.ch===LAN_IPC&&d.dat){
      try{
        var b=new Uint8Array(d.dat);
        if(b[0]===0x0C){var r=lanReadUTF(b,1),Q=LH.peers[r.s];if(Q&&Q.channel&&!b[r.end]){Q.channel=false;lanHostDrop(Q,'left the world');}}
      }catch(_){}
    }
  }
  function lanHostAttach(){
    if(LH.worker===HAY&&LH.worker)return;
    lanHostDetach();
    LH.worker=HAY;
    try{LH.worker.addEventListener('message',lanOnWorker);}catch(_){}
    if(!LH.watch)LH.watch=W.setInterval(function(){
      if(HAY!==LH.worker){for(var k in LH.peers)lanHostDrop(LH.peers[k],'the world stopped');lanHostWorldClosed();}
      else if(!lanWorldRunning()||!HEN||!HEN.X)lanHostWorldClosed();
      if(LH.state==='open')lanTurn();  // keeps the TURN logins fresh (asks again once an hour)
      // this site's relay: a keepalive now and then (answered by Cloudflare without waking the relay)
      if(LH.site&&LH.sock&&LH.sock.open&&now()-(LH.pinged||0)>25000){LH.pinged=now();LH.sock.send('ping');}
      // ...and a connection that stopped answering it (the network went away without closing it)
      // counts as closed, as if the relay had closed it. Only once it has answered at all.
      if(LH.site&&LH.sock&&LH.ponged&&LH.state==='open'&&now()-LH.ponged>100000){
        var dead=LH.sock;LH.sock=null;dead.close();
        lanLog('the Thunder relay stopped answering');
        lanStatus(LH,'relaylost','the relay connection stopped answering; friends already in can keep playing');
      }
      if(menuOpen)runLive();
    },1000);
  }
  function lanHostDetach(){
    if(LH.worker){try{LH.worker.removeEventListener('message',lanOnWorker);}catch(_){}}
    LH.worker=null;
    if(LH.watch){W.clearInterval(LH.watch);LH.watch=0;}
    if(LH.closing){W.clearTimeout(LH.closing);LH.closing=0;}
  }
  function lanHostPacket(p){
    var P=p.peer!=null?LH.peers[p.peer]:null;
    if(p.id===0x02){lanHostNewPeer(p.peer);return;}
    if(p.id===0x20){lanHostTunnel(p.peer,p.text);return;}
    if(p.id===0xFF){if(p.code!==7)lanLog('relay error '+p.code+': '+p.text);return;}   // 7: a friend it already finished with
    if(!P)return;
    if(p.id===0x04){if(P.pc)lanHostOffer(P,p.text);}
    else if(p.id===0x03){if(P.pc){lanAddCandidates(P.pc,p.text,P.theirs);P.gotCands=true;lanHostSendCands(P);}}
    else if(p.id===0x05)P.relayOk=true;
    else if(p.id===0xFE){
      // the relay is done with this friend. If it gave up before this host even answered (a busy
      // host), the friend has given up too and tries again as a new friend; otherwise the direct
      // connection may still complete without the relay, and P.timer decides.
      P.relayOk=true;
      if(p.code!==0&&!P.channel&&!P.answered&&!P.tun)lanHostDrop(P,'did not connect in time');
    }
    else if(p.id===0x06)lanHostDrop(P,'could not connect');
  }
  function lanHostNewPeer(id){
    if(!id||LH.peers[id])return;
    var P={id:id,pc:null,dc:null,channel:false,dead:false,gotCands:false,myCands:null,candsSent:false,answered:false,name:'',first:true,play:false,kicked:false,
      mine:{},theirs:{},path:'',
      timer:W.setTimeout(function(){if(!P.channel)lanHostDrop(P,'timed out ('+lanKinds(P.mine)+' / '+lanKinds(P.theirs)+')');},LAN_RTC_TIMEOUT+10000)};
    LH.peers[id]=P;
    try{P.pc=new W.RTCPeerConnection({iceServers:lanIceAll(LH.ice)});}
    catch(e){
      P.pc=null;
      // no WebRTC here: through this site's relay the friend can still come in (the tunnel)
      if(LH.site&&LH.sock){LH.sock.send(lanPeerPkt(0x22,id,''));lanLog('friend '+id+' is connecting (no WebRTC here: through the Thunder relay)');}
      else lanHostDrop(P,'WebRTC failed');
      return;
    }
    lanCollect(P.pc,function(json){P.myCands=json;lanHostSendCands(P);},P.mine);
    P.pc.ondatachannel=function(e){
      var dc=e.channel;P.dc=dc;dc.binaryType='arraybuffer';
      dc.onmessage=function(ev){lanHostFromPeer(P,ev.data);};
      dc.onclose=function(){lanHostDrop(P,'disconnected');};
      if(dc.readyState==='open')lanHostOpenChannel(P);else dc.onopen=function(){lanHostOpenChannel(P);};
    };
    P.pc.onconnectionstatechange=function(){
      var s=P.pc.connectionState;
      if(s==='failed'||s==='closed')lanHostDrop(P,'connection '+s+(P.channel?'':' ('+lanKinds(P.mine)+' / '+lanKinds(P.theirs)+')'));
    };
    lanLog('friend '+id+' is connecting');
    if(menuOpen)runLive();
  }
  // A friend who cannot connect directly asked this site's relay for the tunnel: the relay sent
  // their id and a one-time token, and this end of the tunnel stands in for the data channel.
  function lanHostTunnel(id,token){
    if(!LH.site||!id||!token)return;
    var P=LH.peers[id];
    if(P&&(P.channel||P.tun||P.dead))return;
    if(!P){
      if(LH.state!=='open')return;
      P={id:id,pc:null,dc:null,channel:false,dead:false,gotCands:false,myCands:null,candsSent:false,answered:false,name:'',first:true,play:false,kicked:false,
        mine:{},theirs:{},path:'',timer:0};
      LH.peers[id]=P;
    }
    // the direct attempt is over
    if(P.dc){P.dc.onopen=P.dc.onclose=P.dc.onmessage=null;try{P.dc.close();}catch(_){}P.dc=null;}
    if(P.pc){var pc=P.pc;P.pc=null;pc.ondatachannel=null;pc.onconnectionstatechange=null;pc.onicecandidate=null;pc.onicegatheringstatechange=null;try{pc.close();}catch(_){}}
    P.tun=true;P.path='tunnel';
    W.clearTimeout(P.timer);
    P.timer=W.setTimeout(function(){if(!P.channel)lanHostDrop(P,'the tunnel did not open');},LAN_RTC_TIMEOUT);
    var ch=lanTunnel(LH.code,id,token,'h');
    if(!ch){lanHostDrop(P,'could not open the tunnel');return;}
    P.dc=ch;
    ch.onmessage=function(ev){lanHostFromPeer(P,ev.data);};
    ch.onclose=function(){lanHostDrop(P,'disconnected');};
    ch.onopen=function(){lanHostOpenChannel(P);};
    lanLog('friend '+id+' is connecting through the Thunder relay');
    if(menuOpen)runLive();
  }
  function lanHostOffer(P,text){
    var pc=P.pc,desc;
    try{desc=JSON.parse(text);}catch(_){lanHostDrop(P,'bad offer');return;}
    pc.setRemoteDescription(desc).then(function(){return pc.createAnswer();})
      .then(function(a){return pc.setLocalDescription(a);})
      .then(function(){if(LH.sock&&!P.dead&&P.pc===pc){LH.sock.send(lanPeerPkt(0x04,P.id,JSON.stringify(pc.localDescription)));P.answered=true;}})
      // (a friend who moved to the tunnel meanwhile closed this connection: nothing to answer)
      ['catch'](function(e){if(P.pc===pc)lanHostDrop(P,'could not answer ('+(e&&e.message||e)+')');});
  }
  // the host's candidates go out once it has the friend's (EaglercraftX's order)
  function lanHostSendCands(P){
    if(P.candsSent||!P.gotCands||P.myCands==null||P.dead||P.relayOk||P.tun||!LH.sock)return;
    P.candsSent=true;LH.sock.send(lanPeerPkt(0x03,P.id,P.myCands));
  }
  function lanHostOpenChannel(P){
    if(P.channel||P.dead||!LH.worker)return;
    P.channel=true;
    W.clearTimeout(P.timer);
    LH.worker.postMessage({ch:LAN_IPC,dat:lanIpcChannel(P.id,true)});
    lanLog('friend '+P.id+' connected');
    if(!P.tun)lanPath(P.pc,function(k){P.path=k;if(k)lanLog('friend '+P.id+' is connected '+LAN_PATHS[k]);if(menuOpen)runLive();});
    if(menuOpen)runLive();
  }
  // friend -> host server. The first packet is the login: two players with one name would replace
  // each other in the world (the host included), so such a login is refused with a message.
  function lanHostFromPeer(P,buf){
    if(P.dead||P.kicked)return;
    if(!P.channel)lanHostOpenChannel(P);
    if(P.first){
      P.first=false;
      var name=lanLoginName(buf),me=lanMyName(),low=name.toLowerCase(),k;
      if(name){
        P.name=name;
        if(me&&low===me.toLowerCase()){
          lanHostKick(P,'The host of this world is also called '+me+'. Change your name in Edit Profile on the title screen, then join again.','same name as the host');
          return;
        }
        for(k in LH.peers){
          var Q=LH.peers[k];
          if(Q!==P&&!Q.dead&&!Q.kicked&&Q.name&&Q.name.toLowerCase()===low){
            lanHostKick(P,'Someone called '+name+' is already in this world. Change your name in Edit Profile on the title screen, then join again.','name already in the world');
            return;
          }
        }
      }
    }
    if(LH.worker)LH.worker.postMessage({ch:P.id,dat:buf});
  }
  // [0 = whole packet][varint id 0 = LoginStart][varint length][UTF-8 name]
  function lanLoginName(buf){
    try{
      var d=new Uint8Array(buf);
      if(d.length<4||d[0]!==0||d[1]!==0)return '';
      var n=d[2],i=3;if(n>127)return '';
      var s='';for(var k=0;k<n&&i<d.length;k++)s+=String.fromCharCode(d[i++]);
      return s;
    }catch(_){return '';}
  }
  // Show a friend a reason, then remove them: their game gets a Disconnect packet (it closes its
  // side and shows the text), the server closes their player a moment later.
  function lanHostKick(P,text,why){
    if(!P||P.dead||P.kicked)return;
    P.kicked=true;
    try{if(P.dc&&P.dc.readyState==='open')P.dc.send(new Uint8Array([0].concat(lanDisconnectPkt(P.play,text))).buffer);}catch(_){}
    W.setTimeout(function(){lanHostDrop(P,why);},1500);
  }
  function lanHostDrop(P,why){
    if(!P||P.dead)return;
    P.dead=true;W.clearTimeout(P.timer);
    if(P.channel&&LH.worker){try{LH.worker.postMessage({ch:LAN_IPC,dat:lanIpcChannel(P.id,false)});}catch(_){}}
    P.channel=false;
    if(P.dc){P.dc.onclose=null;P.dc.onmessage=null;}
    var dc=P.dc,pc=P.pc;
    // let data already queued (a Disconnect packet) go out before the connection is torn down
    W.setTimeout(function(){try{if(dc)dc.close();}catch(_){}try{if(pc)pc.close();}catch(_){}},dc&&dc.bufferedAmount?1000:0);
    delete LH.peers[P.id];
    lanLog('friend '+(P.name||P.id)+': '+why);
    // not sharing any more and the last friend is gone: stop listening to the server
    if(LH.state!=='open'&&LH.state!=='relaylost'&&LH.state!=='connecting'&&!lanPeerTotal())lanHostDetach();
    if(menuOpen)runLive();
  }

  // While the world is open to friends it must not pause: the server would stop for everyone
  // and the host's client would stop reading packets. Vanilla LAN does the same.
  var lanGsProto=CO.prototype,lanOrigPause=lanGsProto.TZ;
  lanGsProto.TZ=function(){return lanHosting()?0:lanOrigPause.call(this);};
  var origE9$=E9$;
  E9$=function(b){
    if(!$rt_resuming()&&b&&lanHosting())b=0;
    return origE9$(b);
  };

  // =====================================================================================
  // Friend: join a world by code
  // =====================================================================================
  var LJ={state:'off',msg:'',code:'',relay:'',sock:null,pc:null,dc:null,active:false,opened:false,frags:[],chain:null,
    pending:null,watch:0,at:0,peer:'',play:false,lost:'',lostTimer:0,scr:null,reason:'',path:''};
  function lanJoinBlocker(){
    if(!lanSupported())return 'this browser cannot open connections to the relays, which joining needs';
    // the host's world arrives compressed, and the browser unpacks it (Chrome 80+, Safari 16.4+, Firefox 113+)
    if(!W.DecompressionStream)return 'this browser is too old to join worlds; update it, or use a recent Chrome, Edge, Firefox or Safari';
    if((HEN&&HEN.X)||lanWorldRunning())return 'leave the world you are in first (Save and Quit), then join';
    if(lanHosting())return 'stop sharing your own world first';
    return '';
  }
  function lanJoin(code){
    code=String(code||'').replace(/\s+/g,'');
    if(!code){lanStatus(LJ,'error','type the code your friend sees in Right Shift > Friends');return;}
    if(LJ.state==='finding'||LJ.state==='connecting'||LJ.state==='joining'||LJ.active)return;
    var why=lanJoinBlocker();
    if(why){lanStatus(LJ,'error',why);return;}
    LJ.code=code;LJ.relay='';LJ.path='';
    lanTurn();                         // this site's TURN logins, usually in before the relay answers
    lanSiteCheck();
    lanStatus(LJ,'finding','looking for the world');
    var tryCode=code,tries=0;
    // A relay gives a friend 10 seconds to connect; a host whose game is very busy can answer too
    // late. Then the whole connection is tried again, up to twice.
    function retry(){
      if(LJ.state!=='connecting'||++tries>2)return false;
      lanStatus(LJ,'finding','your friend\'s game is slow to answer, trying again');
      lanLog('join attempt '+tries+' timed out at the relay, trying again');
      attempt();
      return true;
    }
    function attempt(){
      LJ.pending=lanHandshake(2,tryCode,function(url){lanStatus(LJ,'finding','looking on '+lanRelayName(url));},
        function(sock,hs){LJ.pending=null;lanJoinConnect(sock,hs,retry);},
        function(err,code5){
          LJ.pending=null;
          if(LJ.state!=='finding')return;
          if(code5===5&&tryCode!==tryCode.toLowerCase()){tryCode=tryCode.toLowerCase();attempt();return;}   // codes are usually lower case
          lanStatus(LJ,'error',code5===5?'no open world has the code "'+code+'". Check it, and that your friend still has the world open.':'could not reach the relays: '+err);
        });
    }
    attempt();
  }
  function lanJoinConnect(sock,hs,retry){
    if(LJ.state!=='finding'){sock.close();return;}
    LJ.sock=sock;LJ.relay=sock.url;LJ.peer='';
    lanStatus(LJ,'connecting','connecting to your friend');
    var pc=null,dc=null,cands=null,gotAnswer=false,candsSent=false,gotCands=false,finished=false,failTimer,starting=false,mine={},theirs={};
    // on this site's relay the game can also go through the relay (the tunnel) when no direct
    // path works; tunnelling = the direct attempt is over, tun = this end of the tunnel
    var site=lanIsSite(sock.url),tunnelling=false,tun=null,tunTimer=0;
    // the relay accepts "connected" (0x05) only after it has passed on the host's candidates; the
    // data channel can open before that (fast networks), and then the 0x05 waits for them
    function finishRelay(){
      if(finished||!gotCands)return;
      finished=true;
      sock.send(lanIdPkt(0x05,LJ.peer||''));
      W.setTimeout(function(){sock.close();if(LJ.sock===sock)LJ.sock=null;},500);
    }
    function dropRtc(){
      W.clearTimeout(tunTimer);
      if(dc){dc.onopen=dc.onclose=dc.onmessage=null;}
      if(pc){pc.onconnectionstatechange=null;try{pc.close();}catch(_){}}
      if(LJ.pc===pc)LJ.pc=null;
      if(LJ.dc===dc)LJ.dc=null;
    }
    function fail(msg,canRetry){
      W.clearTimeout(failTimer);
      if(LJ.sock===sock){sock.close();LJ.sock=null;}
      dropRtc();
      if(tun&&LJ.dc!==tun){tun.onopen=tun.onclose=tun.onmessage=null;tun.close();}
      if(LJ.state!=='connecting')return;
      if(canRetry&&retry&&retry())return;
      lanStatus(LJ,'error',msg);
    }
    // no direct path: through this site's relay if possible, else say why
    function noPath(){
      lanLog('no direct connection to the host (this side '+lanKinds(mine)+', host '+lanKinds(theirs)+', site TURN '+(LAN_TURN.state||'unknown')+')');
      if(tunnel())return;
      if(LJ.peer!=null)sock.send(lanIdPkt(0x06,LJ.peer));
      fail('could not connect to your friend\'s game.'+lanNetHint(mine,theirs));
    }
    function tunnel(){
      if(!site||tunnelling||LJ.state!=='connecting'||sock.closed)return false;
      tunnelling=true;
      dropRtc();
      W.clearTimeout(failTimer);
      failTimer=W.setTimeout(function(){
        if(LJ.state==='connecting')fail('could not connect to your friend\'s game, not even through the Thunder relay. Try again in a moment.');
        else if(tun&&LJ.dc!==tun){tun.onopen=tun.onclose=tun.onmessage=null;tun.close();}   // cancelled meanwhile
      },LAN_RTC_TIMEOUT);
      lanStatus(LJ,'connecting','connecting through the Thunder relay');
      lanLog('asking the Thunder relay for a tunnel');
      sock.send(lanPeerPkt(0x20,'',''));
      return true;
    }
    failTimer=W.setTimeout(function(){if(LJ.state==='connecting')noPath();},LAN_RTC_TIMEOUT);
    function sendCands(){if(!candsSent&&!tunnelling&&gotAnswer&&cands!=null){candsSent=true;sock.send(lanPeerPkt(0x03,'',cands));}}
    // the offer goes out once this site's TURN logins are in (asked for when Join was pressed, so
    // normally already there; never more than 2.5 s)
    function start(relayIce){
      if(pc||tunnelling||LJ.sock!==sock||LJ.state!=='connecting')return;      // cancelled or failed meanwhile
      if(!W.RTCPeerConnection){if(!tunnel())fail('this browser has no WebRTC, which joining needs on this relay');return;}
      try{pc=new W.RTCPeerConnection({iceServers:lanIceAll(relayIce)});}catch(e){pc=null;if(!tunnel())fail('WebRTC is not available');return;}
      LJ.pc=pc;
      lanCollect(pc,function(json){cands=json;sendCands();},mine);
      dc=pc.createDataChannel('lan');dc.binaryType='arraybuffer';LJ.dc=dc;
      dc.onopen=function(){
        W.clearTimeout(failTimer);W.clearTimeout(tunTimer);
        if(LJ.state!=='connecting'||tunnelling)return;
        finishRelay();
        lanJoinStart();
        lanPath(pc,function(k){if(LJ.pc!==pc)return;LJ.path=k;if(k)lanLog('connected to the host '+LAN_PATHS[k]);if(menuOpen)runLive();});
      };
      dc.onmessage=function(e){lanJoinRx(e.data);};
      dc.onclose=function(){lanJoinLost('your friend\'s game closed the connection');};
      pc.onconnectionstatechange=function(){
        var s=pc.connectionState;
        // no path at all: say so now instead of when failTimer runs out
        if(s==='failed'&&LJ.state==='connecting'&&LJ.pc===pc&&dc.readyState!=='open'){W.clearTimeout(failTimer);noPath();return;}
        if((s==='failed'||s==='closed')&&LJ.dc===dc)lanJoinLost('the connection to your friend failed');
      };
      pc.createOffer().then(function(o){return pc.setLocalDescription(o);})
        .then(function(){
          if(tunnelling)return;
          sock.send(lanPeerPkt(0x04,'',JSON.stringify(pc.localDescription)));
          // on this site's relay a direct connection gets LAN_TUN_AFTER, then the tunnel takes over
          if(site)tunTimer=W.setTimeout(function(){if(LJ.state==='connecting'&&!tunnelling&&!(dc&&dc.readyState==='open'))noPath();},LAN_TUN_AFTER);
        })
        ['catch'](function(e){if(!tunnelling&&!tunnel())fail('could not start WebRTC ('+(e&&e.message||e)+')');});
    }
    // this end of the tunnel, once the relay has sent this friend's id and the one-time token
    function openTunnel(id,token){
      if(tun||LJ.state!=='connecting')return;
      LJ.peer=id;
      var ch=tun=lanTunnel(hs.code,id,token,'f');
      if(!ch){tun=null;fail('could not open the tunnel through the Thunder relay');return;}
      ch.onopen=function(){
        if(LJ.state!=='connecting'||tun!==ch){ch.onclose=null;ch.close();return;}
        W.clearTimeout(failTimer);
        LJ.dc=ch;LJ.pc=null;LJ.path='tunnel';
        W.setTimeout(function(){sock.close();if(LJ.sock===sock)LJ.sock=null;},500);
        lanLog('connected to the host through the Thunder relay');
        lanJoinStart();
      };
      ch.onmessage=function(e){lanJoinRx(e.data);};
      ch.onclose=function(){
        if(LJ.dc===ch)lanJoinLost('your friend\'s game closed the connection');
        else if(tun===ch&&LJ.state==='connecting')fail('the tunnel through the Thunder relay closed');
      };
    }
    sock.onPacket=function(p){
      if(p.id===0x01&&!pc&&!starting){
        starting=true;
        var relayIce=lanIce(p.servers);
        lanTurn().then(function(){start(relayIce);},function(){start(relayIce);});
        return;
      }
      if(p.id===0x04&&pc&&!tunnelling){
        var desc;try{desc=JSON.parse(p.text);}catch(_){fail('bad answer from the host');return;}
        pc.setRemoteDescription(desc).then(function(){gotAnswer=true;sendCands();})['catch'](function(e){if(!tunnelling)fail('bad answer from the host');});
        return;
      }
      if(p.id===0x03&&pc&&!tunnelling){
        LJ.peer=p.peer;lanAddCandidates(pc,p.text,theirs);gotCands=true;
        if(dc&&dc.readyState==='open')finishRelay();
        return;
      }
      if(p.id===0x20&&site&&tunnelling){openTunnel(p.peer,p.text);return;}
      if(p.id===0x22&&site){tunnel();return;}                   // the host has no WebRTC: straight to the tunnel
      if(p.id===0xFF){fail('the relay refused: '+(LAN_ERRORS[p.code]||p.code)+(p.text?' ('+p.text+')':''));return;}
    };
    // the relay ends a friend's connection after 10 seconds; once the offer, answer and candidates
    // have been exchanged it is no longer needed, and the connection keeps going (failTimer decides).
    // A tunnel needs the relay connection only until the relay has answered with the token.
    sock.onClose=function(){
      if(LJ.sock===sock)LJ.sock=null;
      if(LJ.state!=='connecting'||(LJ.dc&&LJ.dc.readyState==='open'))return;
      if(tunnelling){if(!tun)fail('the Thunder relay closed the connection. Try again in a moment.');return;}
      if(!(gotAnswer&&candsSent&&gotCands))fail('your friend\'s game did not answer in time. Try again in a moment.',true);
    };
  }
  // data channel open: from here the game's own singleplayer connecting screen does the login
  function lanJoinStart(){
    LJ.active=true;LJ.opened=false;LJ.frags=[];LJ.chain=Promise.resolve();LJ.play=false;LJ.lost='';LJ.reason='';
    lanStatus(LJ,'joining','logging in');
    runOnGame([
      // the login carries the game session's name, which is only copied from the profile on
      // Edit Profile's Done or when a world closes; Quick Start skips the start-up Edit Profile,
      // so a friend joining first thing would log in with the random start-up name
      function(){F3B(EE6());},
      function(){if(!LJ.scr)LJ.scr=new BoL();BGl(LJ.scr);},
      function(){var s=LJ.scr;s.blC=null;s.cxf=0;s.cGJ=0;s.b$T=HEN.cm;s.cTm=$rt_str('Joining '+LJ.code+'...');},
      function(){GGs(HEN,LJ.scr);},
      function(){LJ.scr=null;}
    ]);
    if(menuOpen)hideMenu();
    if(!LJ.watch)LJ.watch=W.setInterval(lanJoinWatch,500);
  }
  function lanJoinWatch(){
    if(!LJ.active)return;
    var open=!!(H5i&&H5i.a9M);
    if(open)LJ.opened=true;
    else if(LJ.opened){lanJoinEnd(LJ.reason||LJ.lost);return;}    // the game closed the connection (Disconnect, kicked, lost)
    if(LJ.state==='joining'&&HEN&&HEN.X){lanStatus(LJ,'playing','');}
  }
  // friend -> host: [0][packet], or fragments [1][...]...[0][...] for packets over 64 KB
  function lanJoinSend(i8){
    var dc=LJ.dc;
    if(LJ.lost)return;
    LJ.opened=true;
    if(!dc||dc.readyState!=='open'){lanJoinLost('the connection to your friend closed');return;}
    var len=i8.length,max=LAN_FRAG-1,src=new Uint8Array(i8.buffer,i8.byteOffset,len),off=0,f;
    try{
      if(len<=max){f=new Uint8Array(len+1);f.set(src,1);dc.send(f.buffer);return;}
      while(off<len){var n=Math.min(max,len-off);f=new Uint8Array(n+1);f.set(src.subarray(off,off+n),1);off+=n;f[0]=off>=len?0:1;dc.send(f.buffer);}
    }catch(_){lanJoinLost('the connection to your friend closed');}
  }
  // host -> friend: [0][packet], [2][u32 size][zlib data] for packets over 1 KB, fragments [1]
  // until the last one; handed to the game in order, exactly as the local Worker would
  function lanJoinRx(buf){
    if(!LJ.active)return;
    var d=new Uint8Array(buf);if(!d.length)return;
    var t=d[0],full;
    if(t===1){LJ.frags.push(d);return;}
    if(t!==0&&t!==2){lanLog('unknown frame type '+t);return;}
    if(LJ.frags.length){LJ.frags.push(d);full=lanJoin1(LJ.frags);LJ.frags=[];}else full=d.slice(1);
    if(t===0&&!LJ.play&&full[0]===0x02)LJ.play=true;       // LOGIN Success: now in the PLAY state
    else if(t===0&&full[0]===(LJ.play?0x1A:0x00))LJ.reason=lanReason(full);
    var work=t===2?lanInflate(full):Promise.resolve(full);
    LJ.chain=LJ.chain.then(function(){return work;}).then(function(pkt){
      if(!LJ.active)return;
      try{DeG(null,LAN_LOCAL,pkt.buffer);}catch(e){report(e);}
    })['catch'](function(e){lanLog('bad packet from the host: '+(e&&e.message||e));lanJoinLost('bad data from your friend\'s game');});
  }
  // the text of a Disconnect packet's chat reason ([id][VarInt length][UTF-8 JSON])
  var LAN_REASONS={'multiplayer.disconnect.server_shutdown':'The host closed the world.',
    'multiplayer.disconnect.kicked':'You were kicked from the world.','disconnect.timeout':'The connection timed out.'};
  function lanReason(pkt){
    try{
      var i=1,n=0,sh=0,b;
      do{b=pkt[i++];n|=(b&127)<<sh;sh+=7;}while(b&128&&sh<35);
      var json=new W.TextDecoder('utf-8').decode(pkt.subarray(i,i+n));
      var o=JSON.parse(json);
      if(typeof o==='string')return o;
      var t=(o.text||'')+(o.extra||[]).map(function(e){return typeof e==='string'?e:(e.text||'');}).join('');
      return t||LAN_REASONS[o.translate]||o.translate||'Disconnected.';
    }catch(_){return 'Disconnected.';}
  }
  function lanJoin1(parts){
    var n=0,i,o=0;for(i=0;i<parts.length;i++)n+=parts[i].length-1;
    var r=new Uint8Array(n);for(i=0;i<parts.length;i++){r.set(parts[i].subarray(1),o);o+=parts[i].length-1;}
    return r;
  }
  function lanInflate(full){
    if(full.length<4||!W.DecompressionStream||!W.Response||!W.Blob)return Promise.reject(new Error('cannot decompress in this browser'));
    var size=((full[0]<<24)|(full[1]<<16)|(full[2]<<8)|full[3])>>>0,body=full.subarray(4);
    var zlib=body.length>1&&(body[0]&15)===8&&(((body[0]<<8)|body[1])%31)===0;
    var stream=new W.Blob([body]).stream().pipeThrough(new W.DecompressionStream(zlib?'deflate':'deflate-raw'));
    return new W.Response(stream).arrayBuffer().then(function(ab){
      if(ab.byteLength!==size)lanLog('packet size '+ab.byteLength+' differs from '+size);
      return new Uint8Array(ab);
    });
  }
  // The connection to the host is gone (or the friend cancelled): the game is handed a Disconnect
  // packet with the reason, after the packets still in flight, so it leaves the world or the
  // connecting screen the usual way and shows why. If it cannot take it (still before the login
  // handler exists), the channel is closed directly after 3 seconds.
  function lanJoinLost(why){
    if(!LJ.active){try{if(LJ.pc)LJ.pc.close();}catch(_){}return;}
    if(LJ.lost)return;
    LJ.lost=why||'Disconnected.';
    var dc=LJ.dc;LJ.dc=null;
    try{if(dc){dc.onclose=null;dc.onmessage=null;dc.close();}}catch(_){}
    if(LJ.reason){            // the host already sent a Disconnect; the game is showing it
      LJ.lostTimer=W.setTimeout(function(){if(LJ.active){if(H5i)H5i.a9M=0;lanJoinEnd(LJ.reason);}},3000);
      return;
    }
    var msg=LJ.lost.charAt(0).toUpperCase()+LJ.lost.slice(1)+(/[.!?]$/.test(LJ.lost)?'':'.');
    var pkt=new Uint8Array(lanDisconnectPkt(LJ.play,msg)).buffer;
    LJ.chain=LJ.chain.then(function(){if(LJ.active){try{DeG(null,LAN_LOCAL,pkt);}catch(e){report(e);}}});
    LJ.lostTimer=W.setTimeout(function(){if(LJ.active){if(H5i)H5i.a9M=0;lanJoinEnd(LJ.lost);}},3000);
  }
  function lanJoinEnd(why){
    LJ.active=false;LJ.opened=false;LJ.frags=[];LJ.lost='';LJ.reason='';
    if(LJ.lostTimer){W.clearTimeout(LJ.lostTimer);LJ.lostTimer=0;}
    var dc=LJ.dc,pc=LJ.pc;LJ.dc=LJ.pc=null;
    try{if(dc){dc.onclose=null;dc.onmessage=null;dc.close();}}catch(_){}
    try{if(pc)pc.close();}catch(_){}
    if(LJ.sock){LJ.sock.close();LJ.sock=null;}
    if(LJ.watch){W.clearInterval(LJ.watch);LJ.watch=0;}
    lanStatus(LJ,why?'error':'off',why||'');
  }
  function lanJoinCancel(){
    if(LJ.pending){LJ.pending.cancel();LJ.pending=null;}
    if(LJ.active){lanJoinLost('you cancelled joining');return;}
    if(LJ.sock){LJ.sock.close();LJ.sock=null;}
    try{if(LJ.pc)LJ.pc.close();}catch(_){}
    LJ.pc=LJ.dc=null;
    lanStatus(LJ,'off','');
  }
  // The connecting screen's own Cancel button kills the local world Worker; while joining a
  // friend that Worker is not involved, so Cancel just ends the join instead.
  var origCnZ=CnZ;
  CnZ=function(){
    if(LJ.active&&!$rt_resuming()){
      if(H5i)H5i.a9M=0;
      lanJoinEnd('');
      return;
    }
    return origCnZ();
  };

  // A friend leaving the world (the host stopped sharing, removed them or closed the world) is
  // handled inside the game's own tick: the Disconnect packet comes through the singleplayer
  // connection, whose closeChannel runs onDisconnect -> loadWorld(null) on the spot, and that
  // destroys the connection's server notification manager. The same tick then calls runTick on
  // it, which crashed the friend's game whenever its 2.5 s timer was due. A destroyed manager has
  // nothing left to do, so runTick returns.
  var origFtB=FtB;
  FtB=function(a){
    if(a&&a.Jo===null&&!$rt_resuming())return;
    return origFtB(a);
  };

  // The friend's game sends the local player's packets through this; while joined they go to the
  // friend's host instead of a local server, and IPC to the (absent) local server is dropped.
  var origEBA=EBA;
  EBA=function(b){
    if(LJ.active&&b&&!$rt_resuming()){
      var ch=$rt_ustr(b.bd2);
      if(ch===LAN_LOCAL){lanJoinSend(b.bd_.data);return;}
      if(ch===LAN_IPC)return;
    }
    return origEBA(b);
  };

  // a screen that pauses on its own (statistics, end credits) must not stop the host's client;
  // runs once per frame on the game thread, right after runGameLoop decided the pause flag
  frameTasks.push(function(){if(HEN&&HEN.cp&&lanHosting())HEN.cp=0;});

  // =====================================================================================
  // Menu: Right Shift > Friends
  // =====================================================================================
  var LAN_CSS=[
    '.tcm-warn-note{color:#ffd99a;background:rgba(255,195,92,.08);border:1px solid rgba(255,195,92,.35);border-radius:8px;padding:6px 9px;margin-top:8px}',
    '.tcl-code{display:flex;align-items:center;gap:12px;margin-top:10px;padding:12px 14px;border-radius:10px;',
      'background:linear-gradient(135deg,rgba(79,209,255,.12),rgba(79,209,255,.03));border:1px solid rgba(79,209,255,.35)}',
    '.tcl-code b{font:700 26px/1 ui-monospace,Menlo,Consolas,monospace;letter-spacing:.14em;color:#eafaff;text-shadow:0 0 12px rgba(79,209,255,.5)}',
    '.tcl-code span{font-size:11px;color:#8fb3c9}',
    '.tcl-code .tcm-btn{margin-left:auto}',
    '.tcl-row{display:flex;gap:8px;margin-top:10px}',
    '.tcl-row input{flex:1;min-width:0;height:34px;padding:0 12px;border-radius:9px;border:1px solid rgba(120,150,175,.28);',
      'background:rgba(3,7,12,.55);color:#eafaff;font:600 15px ui-monospace,Menlo,Consolas,monospace;letter-spacing:.1em;outline:0}',
    '.tcl-row input:focus{border-color:rgba(79,209,255,.65);box-shadow:0 0 0 3px rgba(79,209,255,.12)}',
    '.tcl-row .tcm-btn{margin-left:0}',
    '.tcl-list{margin-top:8px;font-size:11px;color:#8fb3c9}',
    '.tcl-peer{display:flex;align-items:center;gap:8px;margin-top:6px;padding:5px 10px;border-radius:8px;background:rgba(3,7,12,.45);color:#dff6ff;font-size:12px}',
    '.tcl-peer .tcm-btn{margin-left:auto;padding:3px 10px;font-size:11px}',
    '.tcl-steps{margin:8px 0 0;padding-left:18px;font-size:11px;line-height:1.6;color:#8fb3c9}',
    '#thunder-lan-badge{position:fixed;top:6px;left:50%;transform:translateX(-50%);z-index:2147483000;padding:4px 10px;border-radius:999px;',
      'background:rgba(6,12,20,.72);border:1px solid rgba(79,209,255,.4);color:#dff6ff;font:600 12px system-ui,sans-serif;pointer-events:none;white-space:nowrap;',
      'box-shadow:0 0 12px rgba(79,209,255,.25)}',
    '#thunder-lan-badge b{font-family:ui-monospace,Menlo,Consolas,monospace;letter-spacing:.1em;color:#fff}',
    '#thunder-ao-banner{position:fixed;top:6px;left:50%;transform:translateX(-50%);z-index:2147483001;display:flex;align-items:center;gap:8px;',
      'padding:4px 5px 4px 12px;border-radius:999px;background:rgba(6,12,20,.88);border:1px solid rgba(79,209,255,.5);color:#dff6ff;',
      'font:600 12px system-ui,sans-serif;white-space:nowrap;box-shadow:0 0 14px rgba(79,209,255,.3)}',
    '#thunder-ao-banner button{border:1px solid rgba(120,150,175,.4);background:rgba(14,22,33,.95);color:#cfe6f5;font:600 11px system-ui,sans-serif;',
      'padding:3px 10px;border-radius:999px;cursor:pointer}',
    '#thunder-ao-banner button:hover{border-color:rgba(79,209,255,.7);color:#fff}'
  ].join('');
  function lanCss(){
    if(D.getElementById('thunder-lan-style'))return;
    var st=D.createElement('style');st.id='thunder-lan-style';st.textContent=LAN_CSS;
    (D.head||D.documentElement).appendChild(st);
  }
  function lanBtn(label,fn){var b=el('button','tcm-btn',label);b.type='button';b.addEventListener('click',function(e){e.stopPropagation();fn();});return b;}
  function lanStatusRow(box,get){
    var line=el('div','tcm-status'),dot=el('span','tcm-dot'),txt=el('span');
    line.appendChild(dot);line.appendChild(txt);box.appendChild(line);
    addLive(function(){
      var s=get();
      dot.className='tcm-dot'+(s[0]?' '+s[0]:'');
      txt.textContent='';txt.appendChild(el('b',null,s[1]));
      if(s[2])txt.appendChild(D.createTextNode(' \u2022 '+s[2]));
    });
  }
  function lanHostStatus(){
    var n=lanPeerCount(),friends=n?(n+(n===1?' friend':' friends')+' playing'):'no friends in yet';
    switch(LH.state){
      case 'connecting':return ['tcm-warn','Opening',LH.msg];
      case 'open':return ['tcm-ok','Open',friends+' \u2022 via '+lanRelayName(LH.relay)];
      case 'relaylost':return ['tcm-warn','Open to friends already in',LH.msg];
      case 'error':return ['tcm-bad','Not open',LH.msg];
      default:var why=lanHostBlocker();return why?['','Closed',why]:['','Closed','ready to open'];
    }
  }
  function lanJoinStatus(){
    switch(LJ.state){
      case 'finding':case 'connecting':return ['tcm-warn','Joining',LJ.msg];
      case 'joining':return ['tcm-warn','Joining','logging in to '+LJ.code];
      case 'playing':return ['tcm-ok','Playing','in your friend\'s world ('+LJ.code+')'+(LJ.path?', connected '+LAN_PATHS[LJ.path]:'')];
      case 'error':return ['tcm-bad','Could not join',LJ.msg];
      default:
        var why=lanJoinBlocker(),me=lanMyName();
        return why?['','Not now',why]:['','Ready','type your friend\'s code'+(me?' (you play as '+me+')':'')];
    }
  }
  // a world on a public relay (not Thunder's) gives shorter codes and fails on some networks: warn
  function lanWarnRow(box,active){
    var w=el('div','tcm-note tcm-warn-note');w.style.display='none';box.appendChild(w);
    addLive(function(){
      var show=active()&&lanOnPublic(active()===true?LH.relay:LJ.relay);
      w.textContent=show?lanPublicWarn():'';
      w.style.display=show?'':'none';
    });
  }
  SPECIALS.lanhost=function(box){
    lanCss();
    lanTurn();lanSiteCheck();
    lanStatusRow(box,lanHostStatus);
    lanWarnRow(box,function(){return (LH.state==='open'||LH.state==='relaylost')?true:false;});
    var codeBox=el('div','tcl-code'),codeText=el('b'),codeHint=el('span','','Friends type this code in Right Shift \u2192 Friends \u2192 Join');
    var copy=lanBtn('Copy',function(){try{W.navigator.clipboard.writeText(LH.code);copy.textContent='Copied';W.setTimeout(function(){copy.textContent='Copy';},1200);}catch(_){}});
    codeBox.appendChild(codeText);codeBox.appendChild(codeHint);codeBox.appendChild(copy);
    box.appendChild(codeBox);
    // friends in the world, each with a Remove button (the integrated server has no /kick)
    var list=el('div','tcl-list'),listKey=null;box.appendChild(list);
    function peerRow(P){
      var row=el('div','tcl-peer');
      row.appendChild(el('span',null,(P.name||'Someone')+(P.kicked?' (leaving)':!P.channel?' (connecting)':P.path==='relay'||P.path==='tunnel'?' ('+LAN_PATHS[P.path]+')':'')));
      if(!P.kicked)row.appendChild(lanBtn('Remove',function(){lanHostKick(P,'The host removed you from the world.','removed by the host');}));
      return row;
    }
    var act=el('div','tcm-actions');
    // Stop sharing also switches Always open off for this world (it would share it again)
    var openB=lanBtn('Open to Friends',lanHostStart),stopB=lanBtn('Stop sharing',function(){var ao=aoWorldUp();lanHostStop('');if(ao)aoTurnOff();});
    var rerollB=lanBtn('New code',function(){lanReroll();});
    rerollB.title='Give this world a new code (the old one stops working)';
    act.appendChild(openB);act.appendChild(stopB);act.appendChild(rerollB);box.appendChild(act);
    var keepNote=el('div','tcm-note','This world keeps the same code every time you open it. New code gives it a fresh one.');
    box.appendChild(keepNote);
    // Always open: in a singleplayer world to switch it on; elsewhere while it is on
    var aoBox=el('div'),aoRow=el('div','tcm-row'),aoName=el('span'),aoSw=el('button','tcm-switch');
    aoSw.type='button';aoSw.setAttribute('aria-label','Always open');
    aoSw.addEventListener('click',function(e){
      e.stopPropagation();
      var c=AO.cfg;
      if(aoInOwnWorld()&&(!c||c.folder!==lanWorld.folder))aoTurnOnHere();else aoTurnOff();
      runLive();
    });
    aoRow.appendChild(aoName);aoRow.appendChild(aoSw);aoBox.appendChild(aoRow);
    var aoStat=el('div');lanStatusRow(aoStat,aoStatus);aoBox.appendChild(aoStat);
    var aoNote=el('div','tcm-note');aoBox.appendChild(aoNote);
    var aoTips=el('ol','tcl-steps');
    ['Keep this tab open and on screen (its own window is best): Thunder keeps the screen on while it is.',
     'Plug the computer in. If the tab may get hidden or minimized, also set the computer to never sleep while plugged in.',
     'Chrome or Edge: Settings \u2192 Performance \u2192 add this site to the sites that are always kept active.',
     'After the computer restarts, open this site (the browser can open it when it starts) and press any key once, which the game needs for its sound; the world then opens by itself.'
    ].forEach(function(t){aoTips.appendChild(el('li',null,t));});
    aoBox.appendChild(aoTips);
    var aoAct=el('div','tcm-actions'),aoNowB=lanBtn('Open now',aoOpenNow);
    aoAct.appendChild(aoNowB);aoBox.appendChild(aoAct);
    box.appendChild(aoBox);
    addLive(function(){
      var c=AO.cfg,here=aoInOwnWorld(),mine=!!(c&&here&&c.folder===lanWorld.folder);
      aoBox.style.display=here||c?'':'none';
      aoName.textContent=here?'Always open this world':'Always open';
      aoSw.className='tcm-switch'+((here?mine:!!c)?' tcm-on':'');
      aoStat.style.display=c?'':'none';
      aoTips.style.display=c?'':'none';
      var note;
      if(!c)note='For a computer you leave on: whenever Thunder starts on it, this world opens for friends by itself with the same code, and it is shared again if the connection drops.';
      else if(here&&!mine)note='Always open is set for "'+c.name+'". Switch it on to use this world instead.';
      else note='Stop sharing switches Always open off.'+
        (AO.awake==='unsupported'?' This browser cannot keep the screen on: set the computer to never sleep.':
         AO.awake==='denied'?' The browser did not let Thunder keep the screen on: set the computer to never sleep.':'');
      aoNote.textContent=note;
      aoNowB.style.display=c&&!aoWorldUp()&&!aoBusy()&&AO.phase!=='checking'&&AO.phase!=='starting'&&AO.phase!=='loading'?'':'none';
    });
    addLive(function(){
      var live=LH.state==='open'||LH.state==='relaylost';
      codeBox.style.display=LH.state==='open'&&LH.code?'':'none';
      codeText.textContent=LH.code;
      var key='',k,P;
      for(k in LH.peers){P=LH.peers[k];key+=k+'/'+P.name+'/'+(P.channel?1:0)+(P.kicked?1:0)+P.path+'|';}
      if(key!==listKey){              // rebuilt only on change, so a Remove click is never lost
        listKey=key;
        while(list.firstChild)list.removeChild(list.firstChild);
        if(key)list.appendChild(el('div',null,'In this world through the code:'));
        for(k in LH.peers)list.appendChild(peerRow(LH.peers[k]));
      }
      openB.style.display=live||LH.state==='connecting'||lanHostBlocker()?'none':'';
      openB.textContent=LH.state==='relaylost'?'Reopen':'Open to Friends';
      if(LH.state==='relaylost')openB.style.display='';
      stopB.style.display=live||LH.state==='connecting'?'':'none';
      var inSp=!!(HEN&&HEN.X&&lanWorldRunning());
      rerollB.style.display=inSp?'':'none';keepNote.style.display=inSp?'':'none';
    });
  };
  SPECIALS.lanjoin=function(box){
    lanCss();
    lanSiteCheck();
    lanTurn();lanSiteCheck();
    lanStatusRow(box,lanJoinStatus);
    lanWarnRow(box,function(){return (LJ.active||LJ.state==='playing'||LJ.state==='joining')?'join':false;});
    var row=el('div','tcl-row'),input=el('input');
    input.type='text';input.placeholder='Join code';input.maxLength=32;input.spellcheck=false;input.autocomplete='off';
    input.value=LJ.code||'';
    var joinB=lanBtn('Join',function(){lanJoin(input.value);}),cancelB=lanBtn('Cancel',lanJoinCancel);
    // typing here must not reach the game (it listens on the window)
    input.addEventListener('keydown',function(e){e.stopPropagation();if(e.key==='Enter'){e.preventDefault();lanJoin(input.value);}});
    input.addEventListener('keyup',function(e){e.stopPropagation();});
    // the last code stays in the box for rejoining; clicking in selects it so a new code replaces it
    input.addEventListener('focus',function(){W.setTimeout(function(){try{input.select();}catch(_){}},0);});
    input.addEventListener('keypress',function(e){e.stopPropagation();});
    row.appendChild(input);row.appendChild(joinB);row.appendChild(cancelB);box.appendChild(row);
    addLive(function(){
      var busy=LJ.state==='finding'||LJ.state==='connecting'||LJ.state==='joining';
      joinB.style.display=busy||LJ.active?'none':'';
      cancelB.style.display=busy?'':'none';
      input.disabled=busy||LJ.active;
    });
  };
  SPECIALS.lanhow=function(box){
    var ol=el('ol','tcl-steps');
    ['Host: in a singleplayer world, press Esc and click Open to Friends (or Right Shift \u2192 Friends \u2192 Open to Friends).',
     'Tell your friends the code that appears.',
     'Friends (on Thunder Client, at the title screen): Right Shift \u2192 Friends, type the code, Join.',
     'Friends appear in your world and in chat. Everyone needs a different name (Edit Profile).',
     'The world stays open while you play; it closes when you Save and Quit or click Stop sharing.'
    ].forEach(function(t){ol.appendChild(el('li',null,t));});
    box.appendChild(ol);
  };
  SPECIALS.lantest=function(box){
    lanCss();
    var info=el('div','tcl-list'),act=el('div','tcm-actions');
    var go=lanBtn('Test connection',function(){lanSelfTest();runLive();});
    box.appendChild(info);act.appendChild(go);box.appendChild(act);
    // the website Thunder uses for its relay, TURN and Friends: set another if the built-in one
    // moved or is not set up (mainly for the offline file). Blank = the built-in one.
    var siteRow=el('div','tcm-row'),siteIn=el('input'),siteSave=lanBtn('Use this site',function(){
      var v=String(siteIn.value||'').trim();
      if(v&&!/^https:\/\//i.test(v))v='https://'+v;
      if(v&&!/\/$/.test(v))v+='/';
      try{if(v)W.localStorage.setItem('thunderSiteOverride',v);else W.localStorage.removeItem('thunderSiteOverride');}catch(_){}
      LAN_SITE.state='';LAN_SITE.promise=null;LAN_TURN.state='';LAN_TURN.promise=null;
      lanSiteCheck().then(function(){if(menuOpen)runLive();});lanTurn().then(function(){if(menuOpen)runLive();});
      runLive();
    });
    var siteClear=lanBtn('Default',function(){siteIn.value='';try{W.localStorage.removeItem('thunderSiteOverride');}catch(_){}LAN_SITE.state='';LAN_SITE.promise=null;lanSiteCheck().then(function(){if(menuOpen)runLive();});runLive();});
    siteIn.type='text';siteIn.placeholder='https://your-site.pages.dev/';siteIn.spellcheck=false;siteIn.autocomplete='off';siteIn.value=siteOverride();
    siteIn.style.cssText='flex:1;min-width:120px;height:28px;padding:0 9px;border-radius:8px;border:1px solid rgba(120,150,175,.28);background:rgba(3,7,12,.55);color:#eafaff;font:600 12px system-ui,sans-serif;outline:0';
    ['keydown','keypress','keyup'].forEach(function(t){siteIn.addEventListener(t,function(e){e.stopPropagation();if(t==='keydown'&&e.key==='Enter')siteSave.click();});});
    var siteLab=el('span',null,'Site');siteLab.style.cssText='min-width:30px';
    siteRow.appendChild(siteLab);siteRow.appendChild(siteIn);siteRow.appendChild(siteSave);siteRow.appendChild(siteClear);
    var siteNote=el('div','tcm-note');box.appendChild(siteRow);box.appendChild(siteNote);
    lanTurn().then(function(){if(menuOpen)runLive();});
    lanSiteCheck().then(function(){if(menuOpen)runLive();});
    addLive(function(){
      function said(x,on){return x.state==='ok'?on:x.state==='none'?'not set up':x.state?'did not answer ('+x.state+')':'checking';}
      info.textContent=LAN_TEST.text||('On '+siteName()+': Thunder relay '+said(LAN_SITE,'on')+', TURN relay '+said(LAN_TURN,'set up')+
        '. The test shows what this network lets through (about 8 seconds).');
      go.style.display=LAN_TEST.state==='running'?'none':'';
      go.textContent=LAN_TEST.state==='done'?'Test again':'Test connection';
      siteNote.textContent=siteOverride()?'Using the site you set. Clear it with Default to use the built-in one.':
        'If friends can only get a short code that will not connect, Thunder\'s relay is not reachable here: set your working site address above (for example your own https://name.pages.dev/).';
    });
  };
  ICONS.friends='<circle cx="9" cy="8" r="3.2"/><path d="M3.5 19c.6-3.2 2.8-5 5.5-5s4.9 1.8 5.5 5"/><circle cx="17" cy="9" r="2.6"/><path d="M15.4 13.6c2.6-.4 4.7 1 5.1 4.4"/>';
  CATEGORIES.splice(1,0,{id:'friends',name:'Friends'});
  var LAN_MOD_OPEN={cat:'friends',id:null,name:'Open to Friends',wide:true,special:'lanhost',
      desc:'Let friends join this singleplayer world with a code, like LAN but over the internet. You stay the host; the world runs in your browser. Always open keeps it open on a computer you leave on.'},
    LAN_MOD_JOIN={cat:'friends',id:null,name:'Join a Friend',wide:true,special:'lanjoin',
      desc:'Join a world a friend opened with Open to Friends. Use it from the title screen.'};
  MODULES.push(LAN_MOD_OPEN,LAN_MOD_JOIN,
    {cat:'friends',id:null,name:'How it works',wide:true,special:'lanhow',
      desc:'Codes come from the Thunder relay on this site (or Eaglercraft\'s public relays when it is off). The game runs over a direct browser-to-browser connection, or through the Thunder relay when that is impossible.'},
    {cat:'friends',id:null,name:'Connection test',wide:true,special:'lantest',
      desc:'Checks what this network lets through: the Thunder relay, the public relays, direct connections and the TURN relay.'}
  );

  // The game's pause menu has an "Open to LAN" button (id 7) that this build leaves greyed out.
  // In a singleplayer world it opens the Friends panel instead and starts sharing right away.
  function lanShowFriends(){
    currentCat='friends';searchQuery='';
    if(searchInput)searchInput.value='';
    if(menuOpen)render();else showMenu();
  }
  function lanPauseButton(scr){
    try{
      var list=scr&&scr.be,i,n,b;
      if(!list)return;
      for(i=0,n=EH(list);i<n;i++){
        b=Bm(list,i);
        if(b&&b.bE===7){
          if(lanHosting()||!lanHostBlocker()){b.bW=1;b.ds=$rt_str(LH.code?'Friends: '+LH.code:'Open to Friends');}
          return;
        }
      }
    }catch(e){report(e);}
  }
  // initGui and actionPerformed are virtual: the game calls them through the class prototype
  var lanIgm=Bxj.prototype,lanIgmInit=lanIgm.ec,lanIgmAction=lanIgm.ey;
  lanIgm.ec=function(){
    var r=lanIgmInit.call(this);
    if(!$rt_suspending())lanPauseButton(this);
    return r;
  };
  lanIgm.ey=function(b){
    if(!$rt_resuming()&&b&&b.bE===7&&b.bW){
      if(!lanHosting()&&LH.state!=='connecting')lanHostStart();
      lanShowFriends();
      return;
    }
    if(!$rt_resuming()&&b&&b.bE===1&&aoWorldUp())AO.quit=true;    // Save and Quit: Always open leaves it closed
    return lanIgmAction.call(this,b);
  };

  // =====================================================================================
  // Always open: a computer left on as the world's home. Switched on in a singleplayer world
  // (Right Shift > Friends), that world then
  //   - is loaded by itself when Thunder starts on this computer (after a 10 second countdown
  //     with Not now), and shared with its kept code. (A freshly started browser shows the
  //     game's own "press any key to enable sound" first; the game starts after that key.)
  //   - is shared again whenever the relay connection drops (5 s, then up to a minute apart);
  //   - is loaded again when it stops with nobody at the computer (the server crashed or the
  //     game timed out), at most 3 times in 30 minutes;
  //   - stays closed when the player leaves it (Save and Quit) or plays something else, until
  //     nobody has touched the computer for 5 minutes, or Thunder starts again.
  // While it is open the screen is kept on (Screen Wake Lock), and a WebRTC data channel inside
  // this page stays open: Chrome slows the timers of a tab that has been hidden for 5 minutes to
  // one wake-up a minute, which would stop the host's own game from answering the server's
  // keepalives, unless the page is using WebRTC. Kept in this browser (localStorage
  // "thunderAlwaysOpen_v1": the world's folder and name).
  // =====================================================================================
  var AO_STORE='thunderAlwaysOpen_v1';
  var AO_COUNT=10000;             // countdown before the world is loaded
  var AO_IDLE=15000;              // no key, click or mouse move this long: nobody at the computer
  var AO_AWAY=5*60000;            // ...this long: the player has gone
  var AO_MAX_LOADS=3,AO_LOAD_SPAN=30*60000;
  var AO={cfg:null,phase:'start',msg:'',until:0,wait:5000,openSince:0,loads:[],up:false,quit:false,input:now(),inAt:0,
    menuAt:0,startAt:0,lock:null,locking:false,lockTry:0,awake:'',keeper:null,noRtc:false,banner:null,bannerText:null};
  // the singleplayer world the game is running now, as launchIntegratedServer was given it
  var lanWorld=null;
  // Minecraft.launchIntegratedServer(folder, name, settings) starts every singleplayer world:
  // Play Selected World, Create New World, and Always open
  var origEh1=Eh1;
  Eh1=function(a,b,c,d){
    if(!$rt_resuming()){
      try{lanWorld={folder:b===null?'':String($rt_ustr(b)),name:c===null?'':String($rt_ustr(c))};}catch(_){lanWorld=null;}
    }
    return origEh1(a,b,c,d);
  };
  function aoLoad(){
    try{
      var o=JSON.parse(W.localStorage.getItem(AO_STORE)||'null');
      if(o&&typeof o.folder==='string'&&o.folder)return {folder:o.folder,name:typeof o.name==='string'&&o.name?o.name:o.folder};
    }catch(_){}
    return null;
  }
  function aoSave(){try{if(AO.cfg)W.localStorage.setItem(AO_STORE,JSON.stringify(AO.cfg));else W.localStorage.removeItem(AO_STORE);}catch(_){}}
  AO.cfg=aoLoad();
  function aoSet(phase,msg){
    if(AO.phase===phase&&AO.msg===(msg||''))return;
    AO.phase=phase;AO.msg=msg||'';
    if(menuOpen)runLive();
  }
  // this computer runs the Always open world (its server; the player may still be joining)
  function aoWorldUp(){return !!(AO.cfg&&lanWorld&&lanWorld.folder===AO.cfg.folder&&lanWorldRunning()&&!LJ.active);}
  // a singleplayer world of this computer is running and the player is in it
  function aoInOwnWorld(){return !!(lanWorld&&lanWorld.folder&&lanWorldRunning()&&HEN&&HEN.X&&!LJ.active);}
  // anything else going on: another world, a server, a friend's world
  function aoBusy(){return !!((HEN&&HEN.X)||lanWorldRunning()||LJ.active||LJ.state==='finding'||LJ.state==='connecting'||LJ.state==='joining');}
  // the game has started: its first menu is up and the built-in packs are ready (or a minute has
  // passed since the menu came up)
  function aoReady(){
    if(!HEN||HEN.cm===null&&!HEN.X)return false;
    var b=null;try{b=TC.boot?TC.boot():null;}catch(_){b=null;}
    if(!b)return true;
    if(!b.menu)return false;
    if(!AO.menuAt)AO.menuAt=now();
    return !b.packsBusy||now()-AO.menuAt>60000;
  }
  // whether the world's folder is still in the game's storage: true, false, or null (cannot tell)
  function aoWorldExists(folder){
    return new Promise(function(done){
      var req,fresh=false;
      W.setTimeout(function(){done(null);},5000);
      try{req=W.indexedDB.open('_net_lax1dude_eaglercraft_v1_8_internal_PlatformFilesystem_1_12_2_');}catch(_){done(null);return;}
      req.onupgradeneeded=function(){fresh=true;try{req.transaction.abort();}catch(_){}};   // no storage at all: no worlds
      req.onerror=function(ev){if(ev&&ev.preventDefault)ev.preventDefault();done(fresh?false:null);};
      req.onblocked=function(){done(null);};
      req.onsuccess=function(){
        var db=req.result;
        try{
          if(!db.objectStoreNames.contains('filesystem')){db.close();done(null);return;}
          var g=db.transaction('filesystem','readonly').objectStore('filesystem').get(['eaglercraft/worlds/'+folder+'/level.dat']);
          g.onsuccess=function(){db.close();done(!!g.result);};
          g.onerror=function(){db.close();done(null);};
        }catch(_){try{db.close();}catch(__){}done(null);}
      };
    });
  }
  function aoCount(){
    AO.until=now()+AO_COUNT;
    aoSet('count','');
  }
  function aoLoadWorld(){
    var c=AO.cfg,t=now();
    if(!c)return;
    AO.loads=AO.loads.filter(function(x){return t-x<AO_LOAD_SPAN;});
    if(AO.loads.length>=AO_MAX_LOADS){
      aoSet('failed','the world stopped '+AO_MAX_LOADS+' times within half an hour, so Always open stopped loading it. Load it yourself to see what happens, or click Open now.');
      return;
    }
    AO.loads.push(t);
    aoSet('checking','');
    aoWorldExists(c.folder).then(function(yes){
      if(AO.phase!=='checking'||AO.cfg!==c)return;       // turned off or changed meanwhile
      if(yes===false){aoSet('failed','the world "'+c.name+'" is not in this browser any more (deleted or renamed). Switch Always open on again in the world you want.');return;}
      if(aoBusy()){aoSet('paused','');return;}           // someone started something meanwhile
      AO.until=now()+60000;                              // the world must be running within a minute
      AO.startAt=0;
      aoSet('starting','');                              // aoTick goes on once the game's server is ready
    });
  }
  // The game's server Worker starts with the first Singleplayer click (its "Starting integrated
  // server" screen calls startIntegratedServerWorker, which does nothing once it runs); a world
  // can be launched once the server is ready for one.
  function aoStartServer(){
    if(HFB!==-2||now()-(AO.startAt||-1e9)<10000)return;
    AO.startAt=now();
    runOnGame([function(){Gh8(0);}]);
  }
  function aoLaunch(c){
    lanLog('Always open: loading "'+c.name+'"');
    runOnGame([function(){
      if(!$rt_resuming()&&(aoBusy()||AO.cfg!==c||HFB!==0))return;
      Eh1(HEN,$rt_str(c.folder),$rt_str(c.name),null);
    }]);
  }
  // switched on in the world the player is in (it is shared at once)
  function aoTurnOnHere(){
    if(!aoInOwnWorld())return;
    AO.cfg={folder:lanWorld.folder,name:lanWorld.name||lanWorld.folder};aoSave();
    AO.loads=[];AO.wait=5000;AO.quit=false;AO.until=0;
    if(!AO.inAt)AO.inAt=now()-5000;                       // the player has been in this world a while
    aoSet('hosting','');
    aoTick();
  }
  function aoTurnOff(){
    AO.cfg=null;aoSave();
    AO.quit=false;AO.until=0;
    aoSet('start','');
    aoTick();
  }
  // Open now (card or countdown): the world is loaded (or shared) right away
  function aoOpenNow(){
    if(!AO.cfg)return;
    AO.wait=5000;AO.until=0;
    if(aoWorldUp()){aoSet('hosting','');aoTick();return;}
    if(aoBusy())return;
    AO.loads=[];
    aoLoadWorld();
  }
  function aoNotNow(){if(AO.phase==='count')aoSet('skipped','');aoBanner();}
  function aoTick(){
    var t=now(),c=AO.cfg,up=aoWorldUp();
    // the Always open world stopped: by the player (Save and Quit, or someone at the computer),
    // or by itself (then it is loaded again)
    if(AO.up&&!up&&AO.phase!=='failed'){
      AO.openSince=0;AO.until=0;
      if(AO.quit||t-AO.input<AO_IDLE)aoSet('paused','');
      else{aoSet('again','');lanLog('Always open: the world stopped with nobody at the computer');}
    }
    if(!up){AO.quit=false;AO.inAt=0;}
    AO.up=up;
    if(!c){if(AO.phase!=='start')aoSet('start','');}
    else if(up&&AO.phase!=='failed'){
      if(AO.phase!=='hosting'){AO.until=0;AO.wait=5000;AO.openSince=0;aoSet('hosting','');}
      if(!HEN||!HEN.X||!HEN.v)AO.inAt=0;                  // still loading
      // the player has just arrived: the world's spawn point (which tells worlds apart, so it
      // picks the world's code) comes in a moment later
      else if(!AO.inAt||t-AO.inAt<5000){if(!AO.inAt)AO.inAt=t;}
      else if(LH.state==='open'){
        if(!AO.openSince)AO.openSince=t;
        else if(t-AO.openSince>120000)AO.wait=5000;       // open for a while: the next drop is retried quickly again
        AO.until=0;
      }else{
        AO.openSince=0;
        var why=lanHostBlocker();
        if(why)aoSet('failed',why);
        else if(LH.state!=='connecting'&&!LH.closing){
          if(!AO.until)AO.until=LH.state==='off'?t:t+AO.wait;   // not shared yet: at once
          if(t>=AO.until){
            AO.until=0;AO.wait=Math.min(AO.wait*2,60000);
            lanLog('Always open: sharing the world'+(LH.state==='off'?'':' again ('+LH.state+(LH.msg?': '+LH.msg:'')+')'));
            lanHostStart();
          }
        }
      }
    }
    else if(up){}                                          // stopped (failed): left as it is
    else if(aoBusy()){
      // another world, a server or a friend's world: left alone; afterwards it counts as the
      // player having left the Always open world
      if(AO.phase!=='failed')aoSet('paused','');
    }
    else{
      var idle=t-AO.input,title=!!(HEN&&HEN.cm instanceof Hj),ready=aoReady();
      switch(AO.phase){
        case 'start':if(ready&&(title||idle>=AO_AWAY))aoCount();break;
        case 'again':if(ready&&(title||idle>=AO_IDLE))aoCount();break;
        case 'hosting':aoSet('again','');break;
        case 'paused':case 'skipped':if(ready&&idle>=AO_AWAY)aoCount();break;
        case 'count':if(t>=AO.until)aoLoadWorld();break;
        case 'starting':
          if(HFB===0){AO.until=t+60000;aoSet('loading','');aoLaunch(c);}
          else if(t>=AO.until)aoSet('again','');
          else aoStartServer();
          break;
        case 'loading':if(t>=AO.until)aoSet('again','');break;
      }
    }
    aoAwake(!!c&&(AO.phase==='count'||AO.phase==='checking'||AO.phase==='starting'||AO.phase==='loading'||AO.phase==='hosting'));
    aoBanner();
  }
  // Screen Wake Lock (asked for again whenever the tab is visible again) and the WebRTC channel
  function aoAwake(on){
    var nav=W.navigator,k=AO.keeper;
    if(!on){
      if(AO.lock){var l=AO.lock;AO.lock=null;try{l.release();}catch(_){}}
      if(k){AO.keeper=null;aoKeeperClose(k);}
      AO.awake='';
      return;
    }
    if(!nav||!nav.wakeLock||typeof nav.wakeLock.request!=='function')AO.awake='unsupported';
    else if(AO.lock&&!AO.lock.released)AO.awake='on';
    else if(D.visibilityState!=='visible')AO.awake='hidden';
    else if(!AO.locking&&now()-(AO.lockTry||-1e9)>60000){   // refused: asked again a minute later
      AO.locking=true;AO.lockTry=now();
      nav.wakeLock.request('screen').then(function(l){
        AO.locking=false;AO.lockTry=0;
        if(!AO.cfg){try{l.release();}catch(_){}return;}
        AO.lock=l;AO.awake='on';
      },function(e){AO.locking=false;AO.awake='denied';lanLog('Always open: the screen cannot be kept on ('+(e&&e.message||e)+')');});
    }
    if(k&&(k.dc.readyState==='open'||now()-k.at<30000))return;   // open, or still connecting
    if(k){AO.keeper=null;aoKeeperClose(k);}
    if(!W.RTCPeerConnection||AO.noRtc)return;
    var a,b;
    try{a=new W.RTCPeerConnection();b=new W.RTCPeerConnection();}
    catch(_){AO.noRtc=true;try{if(a)a.close();}catch(__){}return;}
    k={a:a,b:b,dc:null,at:now()};AO.keeper=k;
    a.onicecandidate=function(e){if(e.candidate&&AO.keeper===k)b.addIceCandidate(e.candidate)['catch'](function(){});};
    b.onicecandidate=function(e){if(e.candidate&&AO.keeper===k)a.addIceCandidate(e.candidate)['catch'](function(){});};
    k.dc=a.createDataChannel('thunder-awake');
    a.createOffer().then(function(o){return a.setLocalDescription(o);})
      .then(function(){return b.setRemoteDescription(a.localDescription);})
      .then(function(){return b.createAnswer();})
      .then(function(o){return b.setLocalDescription(o);})
      .then(function(){return a.setRemoteDescription(b.localDescription);})
      ['catch'](function(){});
  }
  function aoKeeperClose(k){try{k.dc.close();}catch(_){}try{k.a.close();}catch(_){}try{k.b.close();}catch(_){}}
  // the countdown, on top of everything (also over the loading screen)
  function aoBanner(){
    var show=AO.phase==='count'&&!!AO.cfg;
    if(!show){if(AO.banner)AO.banner.style.display='none';return;}
    if(!AO.banner){
      lanCss();
      var b=el('div'),go=el('button',null,'Open now'),no=el('button',null,'Not now');
      b.id='thunder-ao-banner';go.type=no.type='button';
      go.addEventListener('click',function(e){e.stopPropagation();aoOpenNow();aoBanner();});
      no.addEventListener('click',function(e){e.stopPropagation();aoNotNow();});
      AO.bannerText=el('span');
      b.appendChild(AO.bannerText);b.appendChild(go);b.appendChild(no);
      D.body.appendChild(b);AO.banner=b;
    }
    AO.banner.style.display='';
    var s=Math.max(0,Math.ceil((AO.until-now())/1000));
    AO.bannerText.textContent='Always open: opening "'+AO.cfg.name+'" for friends in '+s+' s';
  }
  function aoStatus(){
    var c=AO.cfg;
    if(!c)return ['','Off',''];
    var nm='"'+c.name+'"',s;
    switch(AO.phase){
      case 'start':return ['tcm-warn','Waiting','opens '+nm+' once the title screen is up'];
      case 'count':s=Math.max(0,Math.ceil((AO.until-now())/1000));return ['tcm-warn','Opening soon','loads '+nm+' in '+s+' s'];
      case 'checking':case 'starting':case 'loading':return ['tcm-warn','Loading',nm];
      case 'hosting':
        if(!HEN||!HEN.X)return ['tcm-warn','Loading',nm];
        if(LH.state==='open')return ['tcm-ok','On',nm+' is open'+(LH.code?' with code '+LH.code:'')];
        if(LH.state==='connecting'||LH.state==='off')return ['tcm-warn','Opening',nm];
        s=AO.until?Math.max(0,Math.ceil((AO.until-now())/1000)):0;
        return ['tcm-warn','Sharing again'+(s?' in '+s+' s':''),LH.msg||'the relay connection closed'];
      case 'again':return ['tcm-warn','Loading again','the world stopped with nobody at the computer'];
      case 'paused':return ['','Paused','you left '+nm+'; it opens again when Thunder next starts here, or after 5 minutes with nobody at the computer'];
      case 'skipped':return ['','Not this time','opens after 5 minutes with nobody at the computer, or when Thunder next starts here'];
      case 'failed':return ['tcm-bad','Stopped',AO.msg];
    }
    return ['','',''];
  }
  W.addEventListener('keydown',aoInput,true);
  W.addEventListener('mousedown',aoInput,true);
  W.addEventListener('mousemove',aoInput,true);
  W.addEventListener('wheel',aoInput,{capture:true,passive:true});
  W.addEventListener('touchstart',aoInput,{capture:true,passive:true});
  // (the browser also sends mouse moves of no distance when the page changes under a still mouse)
  function aoInput(e){if(e&&e.type==='mousemove'&&!e.movementX&&!e.movementY)return;AO.input=now();}
  W.setInterval(function(){try{aoTick();}catch(e){report(e);}},1000);

  // small badge while the world is open, so the code is visible without the menu. The same timer
  // puts the card that fits first: Open to Friends in a world, Join a Friend elsewhere (only
  // while the menu is closed, so an open menu never re-renders under the mouse).
  var lanBadge=null;
  W.setInterval(function(){
    if(!menuOpen){
      var iO=MODULES.indexOf(LAN_MOD_OPEN),iJ=MODULES.indexOf(LAN_MOD_JOIN),inWorld=!!(HEN&&HEN.X);
      if(iO>=0&&iJ>=0&&(inWorld?iO>iJ:iJ>iO)){MODULES[iO]=LAN_MOD_JOIN;MODULES[iJ]=LAN_MOD_OPEN;}
    }
    var show=LH.state==='open'&&!!LH.code;
    if(show&&!lanBadge){lanCss();lanBadge=el('div');lanBadge.id='thunder-lan-badge';D.body.appendChild(lanBadge);}
    if(!lanBadge)return;
    lanBadge.style.display=show?'':'none';
    if(show){
      var n=lanPeerCount(),txt='Friends can join with code ';
      if(lanBadge.dataset.k!==LH.code+'|'+n){
        lanBadge.dataset.k=LH.code+'|'+n;
        lanBadge.textContent=txt;lanBadge.appendChild(el('b',null,LH.code));
        if(n)lanBadge.appendChild(D.createTextNode(' \u2022 '+n+(n===1?' friend':' friends')+' in'));
      }
    }
  },700);

  TC.lan={host:LH,join:LJ,relays:lanRelays,name:lanMyName,open:lanHostStart,stop:lanHostStop,joinCode:lanJoin,cancel:lanJoinCancel,reroll:lanReroll,
    site:LAN_SITE,siteCheck:lanSiteCheck,
    turn:LAN_TURN,fetchTurn:lanTurn,test:LAN_TEST,selfTest:lanSelfTest,ice:lanIceAll,
    always:AO,alwaysHere:aoTurnOnHere,alwaysOff:aoTurnOff,alwaysNow:aoOpenNow,alwaysStatus:aoStatus,world:function(){return lanWorld;}};
