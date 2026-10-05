  /* -------------------------------------------------------------------------------------------
     Part of Thunder Client, created and owned by Jayvardhan Ginni (ThunderGamey).
     Thunder Friends: a friends list across Thunder Client, who is on Thunder right now, friend
     requests, chat and world invites, through this site's friends hub (/social: the ThunderSocial
     object of the thunder-relay Worker, thunder-relay/social.js). Included into the client scope
     of thunder-client.js by build.js, after thunder-lan.js (it opens and joins worlds with it).
       - Right Shift > Friends: your name and tag, adding friends by Name#tag, requests, the friends
         list (what each one is playing, who is in a world they opened, with Join for it and
         Invite to yours), the chat, and everyone else on Thunder right now.
       - Open to Friends card: whether friends join your world with one click, or need its code.
       - O (Right Shift > Friends > Thunder Friends settings) opens the chat from a world or the
         title screen.
       - Pop-ups at the top right: messages, friend requests, invites, friends coming online.
       - The Singleplayer and Multiplayer screens list worlds friends have opened, with Join.
     Who you are: a Thunder Friends account, a name and a password (Right Shift > Friends asks
     for one: create it, or log in to it on another device). The password never leaves this
     browser: it is turned into a key first (PBKDF2), and the hub keeps a salted hash of that.
     This browser is a device with a secret key (localStorage "thunderSocial_v1"; the hub knows it
     by a hash) that stays signed in until it logs out. Chats are kept in this browser, per
     account ("thunderSocialChats_v1:<account>"). How it works and what was tested:
     thunder/NETWORKING.md.

     Classes it uses (which screen is open):
     @class A_3 net.minecraft.client.gui.GuiWorldSelection
     @class OG net.minecraft.client.gui.GuiMultiplayer
     @class AHe net.minecraft.client.multiplayer.GuiConnecting
     (GuiMainMenu Hj is declared as a class in thunder-title.js.)
     Instance fields (the size of those screens, for the friends' worlds list at the top):
     @field q net.minecraft.client.gui.GuiScreen.drawBackground GuiScreen.width
     Joining a friend's server: the Multiplayer screen's own connect, as if it were picked from
     its list (a server entry, the Multiplayer screen when another screen is open, then connect):
     @class US net.minecraft.client.multiplayer.ServerData
     @use B5M net.minecraft.client.multiplayer.ServerData.<init>
     @use BGO net.minecraft.client.gui.GuiMultiplayer.<init>
     @use E_Y net.minecraft.client.gui.GuiMultiplayer.connectToServer
  ------------------------------------------------------------------------------------------- */
  var SO_STORE='thunderSocial_v1',SO_CHATS='thunderSocialChats_v1';
  var SO_KEEP=60,SO_CONVOS=40;          // messages kept per friend, friends with a chat kept
  var SO={state:'off',msg:'',ws:null,id:'',key:'',me:null,friends:{},reqIn:[],reqOut:[],blocked:[],
    online:null,onlineAt:0,chats:{},unread:{},sel:'',retry:0,retryAt:0,connAt:0,pinged:0,heard:0,seq:Date.now(),lastS:'',chatKey:'',
    lastListed:null,lastShare:null,addMsg:'',addOk:false,ver:0,cver:0,over:0,saveT:0,probe:null,fatal:'',connecting:false,arm:{},onToast:{},ask:'',askErr:'',via:null,joining:null,
    auth:null,authMode:'',authMsg:'',authOk:false,authBusy:false,authToast:false,reset:'',
    acctOpen:false,acctPw:false,acctMsg:'',acctOk:false,acctBusy:false};
  function soLog(m){lanLog('Thunder Friends: '+m);}
  function soChanged(){SO.ver++;if(menuOpen)runLive();soWorlds();}
  function soSet(state,msg){SO.state=state;SO.msg=msg||'';soChanged();}

  // ---- who you are ---------------------------------------------------------------------------
  function soIdentity(){
    if(SO.id)return Promise.resolve(SO.id);
    var o=null;
    try{o=JSON.parse(W.localStorage.getItem(SO_STORE)||'null');}catch(_){o=null;}
    if(!o||!/^[0-9a-f]{64}$/.test(o.key||'')){
      o={key:lanRandom('0123456789abcdef',64)};
      try{W.localStorage.setItem(SO_STORE,JSON.stringify(o));}catch(_){}
    }
    var cs=W.crypto&&W.crypto.subtle;
    if(!cs||!W.TextEncoder)return Promise.reject(new Error('this page is not on a secure (https) address, which Thunder Friends needs'));
    return cs.digest('SHA-256',new W.TextEncoder().encode('thunder-social:'+o.key)).then(function(b){
      var a=new Uint8Array(b),s='',i;
      for(i=0;i<12;i++)s+=('0'+a[i].toString(16)).slice(-2);
      SO.key=o.key;SO.id=s;
      return s;
    });
  }
  // a new device key (this device was signed out): the next connection is a new device
  function soNewKey(){
    var old=SO.key,o=null;
    try{o=JSON.parse(W.localStorage.getItem(SO_STORE)||'null');}catch(_){o=null;}
    // (another tab of this browser may have made the new one already)
    if(!(o&&/^[0-9a-f]{64}$/.test(o.key||'')&&o.key!==old)){
      o={key:lanRandom('0123456789abcdef',64)};
      try{W.localStorage.setItem(SO_STORE,JSON.stringify(o));}catch(_){}
    }
    SO.id='';SO.key='';
  }
  // what a password becomes before it leaves this browser: PBKDF2-SHA256, 100000 rounds, salted
  // with the account's name (the hub never sees the password itself)
  function soPwKey(name,pw){
    var cs=W.crypto&&W.crypto.subtle,te=new W.TextEncoder();
    pw=String(pw);
    try{pw=pw.normalize('NFC');}catch(_){}
    return cs.importKey('raw',te.encode(pw),'PBKDF2',false,['deriveBits']).then(function(k){
      return cs.deriveBits({name:'PBKDF2',salt:te.encode('thunder-friends:'+String(name).toLowerCase()),iterations:100000,hash:'SHA-256'},k,256);
    }).then(function(b){
      var a=new Uint8Array(b),s='',i;
      for(i=0;i<a.length;i++)s+=('0'+a[i].toString(16)).slice(-2);
      return s;
    });
  }
  function soName(){var n=lanMyName();return /^[A-Za-z0-9_]{1,16}$/.test(n)?n:'Player';}
  // the game has read the saved profile (it uses a stand-in name until then): its first menu is up
  function soGameUp(){return !!(HEN&&BOOT.frames>=3&&lanMyName());}
  function soTagged(p){return p?(p.name||'Player')+'#'+(p.tag||'0000'):'';}

  // ---- chats kept in this browser (each account's own) ------------------------------------------
  function soUseChats(aid){
    var k=SO_CHATS+':'+aid,raw=null;
    if(SO.saveT){W.clearTimeout(SO.saveT);SO.saveT=0;}
    SO.chats={};SO.unread={};SO.chatKey=k;
    try{
      raw=W.localStorage.getItem(k);
      // chats from before accounts belong to the account this device made (it has the device's id)
      if(raw==null&&aid===SO.id){raw=W.localStorage.getItem(SO_CHATS);if(raw!=null){W.localStorage.setItem(k,raw);W.localStorage.removeItem(SO_CHATS);}}
      var o=JSON.parse(raw||'{}');
      if(o&&typeof o==='object'){SO.chats=o.c&&typeof o.c==='object'?o.c:{};SO.unread=o.u&&typeof o.u==='object'?o.u:{};}
    }catch(_){SO.chats={};SO.unread={};}
    SO.cver++;
    soUnsure();                         // the page closed before the hub answered
  }
  // logging out removes this account's chats from this browser
  function soDropChats(){
    if(SO.saveT){W.clearTimeout(SO.saveT);SO.saveT=0;}
    try{if(SO.chatKey)W.localStorage.removeItem(SO.chatKey);}catch(_){}
    SO.chats={};SO.unread={};SO.chatKey='';SO.cver++;
  }
  // messages the hub never answered (the connection closed first): they may or may not have arrived
  function soUnsure(){
    var id,l,i,n=0;
    for(id in SO.chats){l=SO.chats[id];if(!l||!l.length)continue;for(i=0;i<l.length;i++)if(l[i]&&l[i].w==='out'&&l[i].st==='sending'){l[i].st='unsure';n++;}}
    if(n){SO.cver++;soSaveChats();}
  }
  function soSaveChats(){
    if(SO.saveT||!SO.chatKey)return;
    var key=SO.chatKey;
    SO.saveT=W.setTimeout(function(){
      SO.saveT=0;
      if(key!==SO.chatKey)return;
      // only the friends talked to most recently
      var ids=Object.keys(SO.chats).sort(function(a,b){return soLastAt(b)-soLastAt(a);});
      for(var i=SO_CONVOS;i<ids.length;i++){delete SO.chats[ids[i]];delete SO.unread[ids[i]];}
      try{W.localStorage.setItem(key,JSON.stringify({c:SO.chats,u:SO.unread}));}catch(_){}
    },800);
  }
  function soLastAt(id){var l=SO.chats[id];return l&&l.length?l[l.length-1].at||0:0;}
  // w: 'in' (from them), 'out' (from you), 'sys' (a line from Thunder)
  function soAdd(id,m){
    if(!/^[0-9a-f]{24}$/.test(id))return m;
    var l=SO.chats[id]||(SO.chats[id]=[]);
    l.push(m);
    if(l.length>SO_KEEP)l.splice(0,l.length-SO_KEEP);
    if(m.w==='in'&&!(menuOpen&&currentCat==='friends'&&SO.sel===id))SO.unread[id]=(SO.unread[id]||0)+1;
    soSaveChats();
    SO.cver++;
    soChanged();
    return m;
  }

  // a line from Thunder in a chat (the same line again within a minute is not added twice)
  function soSys(id,text){
    var l=SO.chats[id],last=l&&l[l.length-1];
    if(last&&last.w==='sys'&&!last.code&&last.text===text&&Date.now()-(last.at||0)<60000)return last;
    return soAdd(id,{w:'sys',text:text,at:Date.now()});
  }

  // ---- the connection ------------------------------------------------------------------------
  // (/social on this site; the offline file uses the website's, see siteUrl in thunder-lan.js)
  function soUrl(){
    try{
      var u=siteUrl('social');
      if(!u)return '';
      u.protocol=u.protocol==='https:'?'wss:':'ws:';u.search='?id='+SO.id;u.hash='';
      return u.href;
    }catch(_){return '';}
  }
  // Does this site have the hub? (/social answers {"social":true}; a site without it answers 404)
  function soProbe(){
    if(SO.probe)return SO.probe;
    SO.probe=new Promise(function(done){
      var u=siteUrl('social');
      if(!u||!W.fetch){done('none');return;}
      W.fetch(u.href,{cache:'no-store'}).then(function(r){
        if(r.status===404)return {social:false};
        return r.json();
      }).then(function(o){done(o&&o.social===true?'ok':'none');},function(){done('error');});
    });
    SO.probe.then(function(r){if(r==='error')SO.probe=null;});   // asked again next time
    return SO.probe;
  }
  function soConnect(){
    if(SO.ws||!S.socialOn||SO.fatal||SO.connecting)return;
    // (a page opened from a folder that is not Thunder's offline file has no website to use)
    if(!siteUrl('social')){if(SO.state!=='none')soSet('none','Thunder Friends works on thunderclient.pages.dev and in its offline file');return;}
    SO.connecting=true;SO.tryAt=now();
    soIdentity().then(function(){return soProbe();}).then(function(r){
      SO.connecting=false;
      if(!S.socialOn||SO.ws)return;
      if(r==='none'){soSet('none','this site has no Thunder Friends hub');return;}
      // (the offline file where the website is blocked: asked again less often)
      if(r==='error'){soRetry(siteFile()?siteName()+' could not be reached':'the site could not be reached',siteFile());return;}
      var url=soUrl(),ws;
      if(!url){soSet('none','this page is not on a website');return;}
      try{ws=new W.WebSocket(url);}catch(e){soRetry('could not connect');return;}
      SO.ws=ws;SO.connAt=now();soSet('connecting','');
      var opened=false;
      ws.onopen=function(){
        if(SO.ws!==ws)return;
        opened=true;
        var s=soActivity();
        SO.lastS=JSON.stringify(s);SO.lastListed=!!S.socialListed;SO.lastShare=!!S.socialShare;
        // (the name is what a new account is offered: the profile name)
        soSend({t:'hello',key:SO.key,name:soName(),hide:!S.socialListed,share:!!S.socialShare,s:s});
        SO.pinged=SO.heard=now();
      };
      ws.onmessage=function(e){
        if(SO.ws!==ws)return;
        SO.heard=now();
        if(typeof e.data!=='string'||e.data==='pong')return;
        var m;try{m=JSON.parse(e.data);}catch(_){return;}
        try{soOn(m);}catch(x){report(x);}
      };
      ws.onclose=function(){
        if(SO.ws!==ws)return;
        SO.ws=null;
        soUnsure();
        SO.authBusy=SO.acctBusy=false;
        if(SO.reset){
          // signed out (logged out here, or a new password on another device): this browser
          // starts again as a new device, and the account's name and password sign it in
          var why=SO.reset;SO.reset='';
          soNewKey();
          if(SO.saveT){W.clearTimeout(SO.saveT);SO.saveT=0;}
          SO.me=null;SO.friends={};SO.reqIn=[];SO.reqOut=[];SO.blocked=[];SO.online=null;SO.sel='';
          SO.chats={};SO.unread={};SO.chatKey='';SO.acctOpen=false;SO.acctPw=false;
          SO.authMode='login';SO.authOk=why==='logged out';
          SO.authMsg=why==='logged out'?'You logged out of Thunder Friends on this device.':'You were logged out: the password was changed on another device. Log in again.';
          SO.retry=0;SO.retryAt=now();soSet('retry','');
          soLog(why);
          return;
        }
        if(SO.fatal){soSet('error',SO.fatal);return;}
        if(!S.socialOn){soSet('off','');return;}
        if(!opened)SO.probe=null;      // (the site is asked again: it may be out of reach now)
        soRetry(SO.state==='on'?'the connection closed':'could not connect');
      };
      ws.onerror=function(){};
    },function(e){SO.connecting=false;SO.fatal=String(e&&e.message||e);soSet('error',SO.fatal);});
  }
  function soRetry(why,far){
    var waits=far?[15000,60000,300000,600000]:[2000,5000,10000,20000,40000,60000];
    SO.retryAt=now()+waits[Math.min(SO.retry,waits.length-1)];
    SO.retry++;
    soSet('retry',why);
  }
  // the network came back, or the Thunder Friends card was opened: a try that is still far off
  // comes now (never twice within 10 s)
  function soSoon(){if(SO.state==='retry'&&SO.retryAt-now()>5000&&now()-(SO.tryAt||0)>10000)SO.retryAt=now();}
  if(W.addEventListener)W.addEventListener('online',function(){try{soSoon();}catch(_){}});
  function soDisconnect(){
    var ws=SO.ws;SO.ws=null;
    if(ws){try{ws.close(1000,'off');}catch(_){}soUnsure();}
    soSet(S.socialOn?'retry':'off','');
  }
  function soSend(o){
    var ws=SO.ws;
    if(!ws||ws.readyState!==1)return false;
    try{ws.send(JSON.stringify(o));return true;}catch(_){return false;}
  }
  function soReady(){return SO.state==='on'&&!!SO.ws;}

  // what friends see you doing (only while "Show friends what I am playing" is on)
  // (a world you opened: its code only with one-click Join on, and who is in it)
  function soActivity(){
    try{
      if(LJ.active||LJ.state==='joining'||LJ.state==='playing'){
        var v=SO.via;
        return v&&v.code===LJ.code?{w:'join',host:v.name}:{w:'join'};     // whose world, when joined here
      }
      if(LH.state==='open'&&LH.code){
        var o={w:'host'},p=soPlayers();
        if(S.socialQuickJoin)o.code=LH.code;else o.lock=true;
        if(p.length)o.players=p;
        return o;
      }
      if(HEN&&HEN.X){
        if(lanWorldRunning())return {w:'sp'};
        var nm=HEN.v&&HEN.v.d9&&HEN.v.d9.qf,addr=nm&&nm.bR3?String($rt_ustr(nm.bR3)):'';
        // (with ws:// or wss://, so friends can join it; shown without)
        if(addr&&addr.indexOf('~!')!==0)return {w:'server',server:addr.replace(/\/+$/,'').slice(0,80)};
        return {w:'server'};
      }
    }catch(_){}
    return {w:'menu'};
  }
  // friends in the world you opened (their game has logged in to it)
  function soPlayers(){
    var a=[],k,P;
    for(k in LH.peers){P=LH.peers[k];if(P&&P.play&&!P.kicked&&!P.dead&&/^[A-Za-z0-9_]{1,16}$/.test(P.name||''))a.push(P.name);}
    return a.sort().slice(0,16);
  }
  function soDoing(f){
    if(!f||!f.online)return f&&f.seen?'Last online '+soAgo(f.seen):'Offline';
    var s=f.s;
    if(!s)return 'Online';
    switch(s.w){
      case 'host':
        var n=s.players?s.players.length:0;
        return 'Has a world open'+(s.code?' \u2022 '+s.code:s.lock?' \u2022 code needed':'')+(n?' \u2022 '+(n+1)+' playing':'');
      case 'sp':return 'Playing singleplayer';
      case 'join':return !s.host?'In a friend\'s world':SO.me&&s.host===SO.me.name?'In your world':'In '+s.host+'\'s world';
      case 'server':return s.server?'On '+soServerName(s.server):'On a server';
      default:return 'In the menus';
    }
  }
  function soHosting(f){return !!(f&&f.online&&f.s&&f.s.w==='host'&&(f.s.code||f.s.lock));}
  // how long ago a time on the hub's clock was (the hub said its time at sign-in: this computer's
  // clock may be off)
  function soAgo(at){
    var m=Math.floor((Date.now()+(SO.skew||0)-at)/60000),h=Math.floor(m/60),d=Math.floor(h/24);
    function n(x,u){return x+' '+u+(x===1?'':'s')+' ago';}
    return m<1?'just now':m<60?n(m,'minute'):h<24?n(h,'hour'):d<2?'yesterday':d<30?n(d,'day'):d<365?n(Math.floor(d/30)||1,'month'):'over a year ago';
  }
  // who is playing in a friend's open world: the friend, then everyone who joined ("you" for you)
  function soWho(f){
    if(!soHosting(f))return '';
    var me=SO.me&&SO.me.name;
    return [f.name].concat(f.s.players||[]).map(function(n){return me&&n===me?'you':n;}).join(', ');
  }
  // the server a friend is on, as the game connects to it (an address without ws:// or wss:// is
  // wss://: Thunder sent it like that before)
  function soServerAddr(f){
    var a=f&&f.online&&f.s&&f.s.w==='server'?String(f.s.server||''):'';
    if(!a||a.indexOf('~!')===0||!/^(wss?:\/\/)?[A-Za-z0-9.\-_]+(:\d{1,5})?(\/[A-Za-z0-9.:_\-\/]*)?$/i.test(a))return '';
    return /^wss?:\/\//i.test(a)?a:'wss://'+a;
  }
  function soServerName(a){return String(a||'').replace(/^wss?:\/\//i,'').replace(/\/+$/,'');}

  // ---- what the hub says ---------------------------------------------------------------------
  function soDrop(list,id){for(var i=list.length-1;i>=0;i--)if(list[i].id===id)list.splice(i,1);}
  function soOn(m){
    switch(m.t){
      case 'auth':
        // not signed in on this device: make an account, or log in to one
        SO.auth={name:m.name||'',taken:!!m.taken,old:!!m.old};SO.retry=0;SO.authBusy=false;
        // (a device from before accounts makes its account: another name if its own is taken)
        if(!SO.authMode)SO.authMode=m.taken&&!m.old?'login':'register';
        soSet('auth','');
        // (once, and not when the forms are on screen or it just logged out)
        if(!SO.authToast&&S.socialToasts&&!SO.authMsg&&!(menuOpen&&currentCat==='friends')){
          SO.authToast=true;
          soToast({kind:'info',title:'Thunder Friends',open:true,text:m.old?'Choose a password to keep your account and friends: Right Shift \u2192 Friends.':'Make your account (a name and a password), or log in: Right Shift \u2192 Friends.'});
        }
        return;
      case 'pwok':
        SO.acctBusy=false;SO.acctPw=false;SO.acctOk=true;SO.acctMsg='Password changed. Your other devices were logged out.';
        soChanged();return;
      case 'welcome':{
        soUseChats(m.me.id);
        SO.auth=null;SO.authMode='';SO.authMsg='';SO.authBusy=false;
        SO.me=m.me;SO.friends={};SO.retry=0;
        SO.skew=typeof m.now==='number'?m.now-Date.now():0;
        (m.friends||[]).forEach(function(f){SO.friends[f.id]=f;});
        SO.reqIn=m.reqIn||[];SO.reqOut=m.reqOut||[];SO.blocked=m.blocked||[];
        var mail=m.mail||[],last=0,who={};
        mail.forEach(function(x){
          soAdd(x.from.id,{w:'in',text:x.text,at:x.at,name:x.from.name});
          last=Math.max(last,x.n);who[x.from.name]=1;
        });
        if(last)soSend({t:'ack',n:last});
        soSet('on','');
        soLog('signed in as '+soTagged(SO.me));
        if(mail.length&&S.socialToasts)soToast({kind:'msg',title:mail.length===1?mail[0].from.name:mail.length+' messages',
          text:mail.length===1?mail[0].text:'from '+Object.keys(who).join(', ')+' while you were away',id:mail.length===1?mail[0].from.id:''});
        if(SO.reqIn.length&&S.socialToasts)soToast({kind:'req',title:'Friend requests',text:SO.reqIn.length+' waiting in Right Shift \u2192 Friends'});
        return;
      }
      case 'presence':{
        var f=SO.friends[m.id];
        if(!f)return;
        var was=f.online;
        f.online=!!m.online;f.s=m.s||null;f.name=m.name;f.tag=m.tag;f.seen=m.seen||f.seen;
        // (once in 5 minutes per friend: a friend whose connection drops and comes back is not news)
        if(!was&&f.online&&S.socialOnlineToasts&&!(now()-(SO.onToast[f.id]||-1e9)<300000)){
          SO.onToast[f.id]=now();
          soToast({kind:'on',title:f.name,text:'is online',id:f.id,quiet:true});
        }
        soChanged();
        return;
      }
      case 'request':
        soDrop(SO.reqIn,m.from.id);SO.reqIn.push(m.from);
        if(S.socialToasts)soToast({kind:'req',title:soTagged(m.from),text:'wants to be your friend',req:m.from.id});
        soChanged();return;
      case 'added':
        soDrop(SO.reqOut,m.to.id);SO.reqOut.push(m.to);
        SO.addMsg='Request sent to '+soTagged(m.to)+'.';SO.addOk=true;SO.addClear=true;
        soChanged();return;
      case 'friend':
        SO.friends[m.f.id]=m.f;soDrop(SO.reqIn,m.f.id);soDrop(SO.reqOut,m.f.id);
        if(S.socialToasts)soToast({kind:'friend',title:soTagged(m.f),text:'is now your friend',id:m.f.id});
        soChanged();return;
      case 'unfriend':
        delete SO.friends[m.id];
        if(SO.sel===m.id)SO.sel='';
        soChanged();return;
      case 'reqgone':soDrop(SO.reqIn,m.id);soDrop(SO.reqOut,m.id);soChanged();return;
      case 'blocked':
        soDrop(SO.blocked,m.who.id);
        if(m.on)SO.blocked.push(m.who);
        soChanged();return;
      case 'online':SO.online={list:m.list||[],total:m.total|0};SO.onlineAt=now();SO.over++;if(menuOpen)runLive();return;
      case 'msg':{
        var f2=SO.friends[m.from.id];
        if(f2){f2.name=m.from.name;f2.tag=m.from.tag;}
        soAdd(m.from.id,{w:'in',text:m.text,at:m.at,name:m.from.name});
        if(S.socialToasts&&!(menuOpen&&currentCat==='friends'&&SO.sel===m.from.id))soToast({kind:'msg',title:m.from.name,text:m.text,id:m.from.id});
        return;
      }
      case 'msgout':soAdd(m.to,{w:'out',text:m.text,at:m.at,st:'sent'});return;
      case 'sent':{
        if(m.invite){soAdd(m.to,{w:'sys',text:'You invited them to your world.',at:m.at});return;}
        var l=SO.chats[m.to]||[],i;
        for(i=l.length-1;i>=0;i--)if(l[i].id===m.id&&l[i].w==='out'){l[i].st=m.stored?'waiting':'sent';break;}
        SO.cver++;soSaveChats();soChanged();return;
      }
      case 'invite':
        soAdd(m.from.id,{w:'sys',text:m.from.name+' invited you to their world.',at:m.at,code:m.code});
        if(S.socialToasts)soToast({kind:'invite',title:m.from.name,text:'invited you to their world',code:m.code,id:m.from.id});
        return;
      case 'err':
        if(m.fatal){
          if(m.why==='signed out'||m.why==='logged out'){SO.reset=m.why;return;}
          if(m.why==='wrong key'||m.why==='bad key')SO.fatal='this browser\'s Thunder Friends key was refused';
          else if(m.why==='opened in another tab')SO.fatal='Thunder Friends is open in other tabs; reload this one to use it here';
          return;
        }
        if(m.op==='auth'){SO.authBusy=false;SO.authMsg=m.why;SO.authOk=false;soChanged();return;}
        if(m.op==='passwd'){SO.acctBusy=false;SO.acctMsg=m.why;SO.acctOk=false;soChanged();return;}
        if(m.op==='add'){SO.addMsg=m.why;SO.addOk=false;soChanged();return;}
        if((m.op==='msg'||m.op==='invite')&&m.to){
          // the message it is about (by its id; else the newest one still sending)
          if(m.op==='msg'){var l2=SO.chats[m.to]||[];for(var j=l2.length-1;j>=0;j--)if(l2[j].w==='out'&&l2[j].st==='sending'&&(m.id==null||l2[j].id===m.id)){l2[j].st='failed';SO.cver++;break;}}
          soSys(m.to,m.why);return;
        }
        soToast({kind:'info',title:'Thunder Friends',text:m.why,quiet:true});
        return;
    }
  }

  // ---- things you do -------------------------------------------------------------------------
  function soMsg(id,text){
    text=String(text||'').replace(/\s+/g,' ').trim().slice(0,300);
    if(!text||!SO.friends[id])return false;
    var mid=++SO.seq,m={w:'out',text:text,at:Date.now(),id:mid,st:'sending'};
    if(!soSend({t:'msg',to:id,text:text,id:mid}))m.st='failed';
    soAdd(id,m);
    if(m.st==='failed')soSys(id,'Not sent: Thunder Friends is not connected right now.');
    return true;
  }
  function soAddFriend(who){
    who=String(who||'').trim();
    if(!who){SO.addMsg='Type their Thunder Friends name.';SO.addOk=false;soChanged();return;}
    if(!soSend({t:'add',who:who})){SO.addMsg='Thunder Friends is not connected right now.';SO.addOk=false;soChanged();return;}
    SO.addMsg='';soChanged();
  }
  function soAct(t,id){if(/^[0-9a-f]{24}$/.test(id||''))soSend({t:t,id:id});}

  // ---- your account --------------------------------------------------------------------------
  var SO_NAME_RE=/^[A-Za-z0-9_]{3,16}$/;
  function soPwProblem(pw,pw2){
    pw=String(pw||'');
    return pw.length<6?'Use a password of at least 6 characters.':pw.length>64?'That password is too long (64 characters at most).':
      pw2!==undefined&&pw!==pw2?'The two passwords are different.':'';
  }
  function soAuthFail(why){SO.authBusy=false;SO.authMsg=why;SO.authOk=false;soChanged();}
  function soAuthSend(t,name,pw){
    if(SO.state!=='auth'||!SO.ws){soAuthFail('Thunder Friends is not connected right now. Try again in a moment.');return;}
    SO.authBusy=true;SO.authMsg='';soChanged();
    soPwKey(name,pw).then(function(k){
      if(!soSend({t:t,name:name,pw:k}))soAuthFail('Thunder Friends is not connected right now. Try again in a moment.');
    },function(){soAuthFail('This browser could not use that password.');});
  }
  // a new account: this name (one account per name) and a password
  function soRegister(name,pw,pw2){
    name=String(name||'').trim();
    var why=!SO_NAME_RE.test(name)?'A name is 3 to 16 letters, numbers or _.':soPwProblem(pw,pw2);
    if(why){soAuthFail(why);return;}
    soAuthSend('register',name,pw);
  }
  function soLogin(name,pw){
    name=String(name||'').trim();
    if(!SO_NAME_RE.test(name)||!pw){soAuthFail('Type your account\'s name and password.');return;}
    soAuthSend('login',name,pw);
  }
  function soAcctFail(why){SO.acctBusy=false;SO.acctMsg=why;SO.acctOk=false;soChanged();}
  // a new password (the old one is needed); the account's other devices are logged out
  function soPasswd(old,pw,pw2){
    var why=!old?'Type your old password.':soPwProblem(pw,pw2);
    if(why){soAcctFail(why);return;}
    if(!soReady()||!SO.me){soAcctFail('Thunder Friends is not connected right now.');return;}
    SO.acctBusy=true;SO.acctMsg='';soChanged();
    var n=SO.me.name;
    Promise.all([soPwKey(n,old),soPwKey(n,pw)]).then(function(k){
      if(!soSend({t:'passwd',old:k[0],pw:k[1]}))soAcctFail('Thunder Friends is not connected right now.');
    },function(){soAcctFail('This browser could not use that password.');});
  }
  // this device logs out (and this account's chats leave this browser)
  function soLogout(){
    if(!soReady())return;
    soDropChats();
    soSend({t:'logout'});
  }
  // an invite carries the code (so an invited friend joins with one click, even when others need it)
  function soInvite(id){
    if(!(LH.state==='open'&&LH.code)){soSys(id,'Open your world to friends first (Esc \u2192 Open to Friends).');return;}
    // the hub needs to know the world is open before it passes the invite on
    soStatusNow();
    soSend({t:'invite',to:id,code:LH.code});
  }
  // f: the friend whose world it is (friends then see whose world you are in)
  function soJoin(code,f){
    var why=lanJoinBlocker();
    if(why){soToast({kind:'info',title:'Cannot join yet',text:why.charAt(0).toUpperCase()+why.slice(1)+'.',quiet:true,tag:'join'});return false;}
    code=String(code||'').replace(/\s+/g,'');
    if(!code)return false;
    SO.via=f&&f.name?{code:code,name:f.name}:null;
    SO.joining={code:code,name:f&&f.name||'',id:f&&f.id||'',st:''};SO.askErr='';
    // (the menu stays open while it connects, and closes by itself when the world starts loading)
    lanJoin(code);
    soJoinWatch();
    if(SO.joining)soToast({kind:'info',title:'Joining'+(f&&f.name?' '+f.name+'\'s world':''),text:'Connecting\u2026',quiet:true,tag:'join'});
    return !!SO.joining;
  }
  // a join started here: how it goes (the Join card that shows it may not be on screen)
  function soJoinWatch(){
    var j=SO.joining;
    if(!j)return;
    if(LJ.code!==j.code||LJ.state==='off'){SO.joining=null;return;}
    if(LJ.state==='error'){
      SO.joining=null;
      var why=String(LJ.msg||'it did not work');why=why.charAt(0).toUpperCase()+why.slice(1);
      if(j.id&&SO.ask===j.id)SO.askErr=why;
      soToast({kind:'info',title:'Could not join'+(j.name?' '+j.name+'\'s world':''),text:why,tag:'join'});
      soChanged();
      return;
    }
    if(LJ.state==='joining'||LJ.state==='playing'){
      SO.joining=null;
      if(j.id&&SO.ask===j.id){SO.ask='';SO.askErr='';}
      soChanged();
      return;
    }
    if(j.st!==LJ.state){j.st=LJ.state;soChanged();}
  }
  // Join on a friend's open world: at once, or (when they want friends to need the code) the chat
  // with that friend opens with a box for the code
  function soJoinFriend(f){
    if(!soHosting(f))return false;
    if(f.s.code)return soJoin(f.s.code,f);
    SO.ask=f.id;
    soShowChat(f.id);
    return false;
  }
  // Join on a friend's server: the Multiplayer screen connects to it as if it were picked from its
  // list (it opens first when another screen is up). From the menus only: a world is left first.
  // Each step runs on the game's thread; a step that waits is called again to carry on, so what
  // it decides is decided once, in the step before.
  var SV={sd:null,gm:null,from:null,show:false,at:0};
  function soJoinServer(f){
    var addr=soServerAddr(f),why='';
    if(!addr)return false;
    if(!HEN||(!HEN.X&&!HEN.cm))why='the game is still starting';
    else if(HEN.X||LJ.active)why='leave the world you are in first (Esc \u2192 Disconnect, or Save and Quit), then press Join again';
    else if(HEN.cm instanceof AHe||now()-SV.at<4000)why='it is already connecting to a server';
    if(why){soToast({kind:'info',title:'Cannot join yet',text:why.charAt(0).toUpperCase()+why.slice(1)+'.',quiet:true,tag:'join'});return false;}
    SV.at=now();SV.sd=SV.gm=SV.from=null;
    var name=String(f.name||'A friend')+'\'s server';
    runOnGame([
      function(){SV.from=HEN.cm;SV.show=!(SV.from instanceof OG);if(!SV.show)SV.gm=SV.from;},
      function(){if(!SV.sd)SV.sd=new US();B5M(SV.sd,$rt_str(name),$rt_str(addr),0);},
      function(){if(SV.show){if(!SV.gm)SV.gm=new OG();BGO(SV.gm,SV.from);}},
      function(){if(SV.show)GGs(HEN,SV.gm);},
      function(){E_Y(SV.gm,SV.sd);},
      function(){SV.sd=SV.gm=SV.from=null;SV.at=0;}
    ]);
    soLog('joining '+(f.name||'a friend')+' on '+addr);
    if(menuOpen)hideMenu();
    soToast({kind:'info',title:'Joining '+soServerName(addr),text:(f.name?f.name+'\'s server. ':'')+'Connecting\u2026',quiet:true,tag:'join'});
    return true;
  }
  function soStatusNow(){
    if(!soReady())return;
    var s=soActivity(),js=JSON.stringify(s);
    if(js!==SO.lastS){SO.lastS=js;soSend({t:'status',s:s});}
  }
  function soAskOnline(){if(soReady()&&now()-SO.onlineAt>3000){SO.onlineAt=now();soSend({t:'online'});}}

  // every second: connect when due, keepalive, and tell the hub about changes
  W.setInterval(function(){
    try{
      if(SO.joining)soJoinWatch();
      if(!S.socialOn){if(SO.ws||SO.state!=='off')soDisconnect();return;}
      // (first once the game has read the profile, so friends never see a stand-in name)
      if(!SO.ws&&!SO.connecting&&!SO.fatal&&(SO.state==='off'||(SO.state==='retry'&&now()>=SO.retryAt))&&soGameUp())soConnect();
      // no welcome 20 s after connecting (the hub never answered): try again later
      if(SO.ws&&SO.state==='connecting'&&now()-SO.connAt>20000){
        var slow=SO.ws;SO.ws=null;
        try{slow.close();}catch(_){}
        soRetry('the friends hub did not answer');
        return;
      }
      if(!SO.ws||(SO.state!=='on'&&SO.state!=='auth'))return;
      // a connection that died without closing (a network change, a sleeping laptop): the hub
      // answers every ping, so a ping left unanswered for 30 s means it is gone
      if(SO.pinged>SO.heard&&now()-SO.pinged>30000){
        var dead=SO.ws;SO.ws=null;
        try{dead.close(4000,'no answer');}catch(_){}
        soUnsure();soLog('the friends hub stopped answering');
        soRetry('the connection stopped answering');
        return;
      }
      if(SO.pinged<=SO.heard&&now()-SO.pinged>25000){SO.pinged=now();try{SO.ws.send('ping');}catch(_){}}
      if(!soReady())return;
      // ("Last online 5 minutes ago" keeps up while the friends list is on screen)
      if(menuOpen&&currentCat==='friends'&&now()-(SO.agoAt||0)>60000){SO.agoAt=now();soChanged();}
      if(!!S.socialListed!==SO.lastListed){SO.lastListed=!!S.socialListed;soSend({t:'hide',v:!S.socialListed});}
      if(!!S.socialShare!==SO.lastShare){SO.lastShare=!!S.socialShare;soSend({t:'share',v:!!S.socialShare});}
      soStatusNow();
      soWorlds();
    }catch(e){report(e);}
  },1000);

  // ---- pop-ups (top right) -------------------------------------------------------------------
  var SO_CSS=[
    '#thunder-toasts{position:fixed;top:38px;right:10px;z-index:2147483646;display:flex;flex-direction:column;gap:8px;width:290px;max-width:calc(100vw - 20px);pointer-events:none}',
    '.tct{pointer-events:auto;padding:9px 11px;border-radius:11px;background:rgba(8,14,22,.92);border:1px solid rgba(79,209,255,.38);color:#e8f6ff;',
      'font:12px/1.4 system-ui,-apple-system,Segoe UI,sans-serif;box-shadow:0 6px 24px rgba(0,0,0,.45),0 0 14px rgba(79,209,255,.16);animation:tct-in .18s ease-out;cursor:default}',
    '.tct.tct-click{cursor:pointer}',
    '.tct b{display:block;font-weight:700;color:#fff;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}',
    '.tct p{margin:2px 0 0;color:#cfe3f0;word-wrap:break-word;overflow-wrap:anywhere;max-height:5.6em;overflow:hidden}',
    '.tct i{display:block;font-style:normal;font-size:10.5px;color:#7fa9c2;margin-top:4px}',
    '.tct-act{display:flex;gap:6px;margin-top:7px}',
    '.tct button,.tcs-btn{border:1px solid rgba(120,150,175,.4);background:rgba(14,22,33,.95);color:#cfe6f5;font:600 11px system-ui,sans-serif;padding:3px 10px;border-radius:7px;cursor:pointer}',
    '.tct button:hover,.tcs-btn:hover{border-color:rgba(79,209,255,.7);color:#fff}',
    '.tct button.tcs-go,.tcs-btn.tcs-go{border-color:rgba(79,209,255,.6);background:linear-gradient(180deg,rgba(47,169,255,.45),rgba(47,140,255,.25));color:#fff}',
    '@keyframes tct-in{from{opacity:0;transform:translateX(14px)}to{opacity:1;transform:none}}',
    // the chat (Right Shift > Friends)
    '.tcs-chat{display:flex;gap:10px;height:310px;margin-top:2px}',
    '.tcs-side{flex:0 0 232px;display:flex;flex-direction:column;gap:7px;min-width:0}',
    '.tcs-me{display:flex;align-items:center;gap:6px;padding:6px 8px;border-radius:9px;background:rgba(3,7,12,.5);border:1px solid rgba(110,140,160,.18);font-size:12px;color:#dff3ff;min-height:30px}',
    '.tcs-me .tcs-me-t{flex:1;min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}',
    '.tcs-me em{font-style:normal;color:#7fdcff;font-family:ui-monospace,Menlo,Consolas,monospace}',
    '.tcs-in{display:flex;gap:6px}',
    '.tcs-in input,.tcs-send input{flex:1;min-width:0;height:28px;padding:0 9px;border-radius:8px;border:1px solid rgba(120,150,175,.28);background:rgba(3,7,12,.55);color:#eafaff;font:600 12px system-ui,sans-serif;outline:0}',
    '.tcs-in input:focus,.tcs-send input:focus{border-color:rgba(79,209,255,.65);box-shadow:0 0 0 3px rgba(79,209,255,.12)}',
    '.tcs-note{font-size:11px;color:#8fb3c9;line-height:1.4}.tcs-note.tcs-bad{color:#ff9d9d}.tcs-note.tcs-ok{color:#8fe3a4}',
    '.tcs-list{flex:1;overflow-y:auto;min-height:0;scrollbar-width:thin;scrollbar-color:#2c4556 transparent;padding-right:2px}',
    '.tcs-sec{font-size:9.5px;font-weight:700;letter-spacing:.1em;color:#5fb9e6;text-transform:uppercase;margin:7px 2px 3px}',
    '.tcs-f{display:flex;align-items:center;gap:7px;padding:5px 7px;border-radius:8px;cursor:pointer;color:#dff3ff;font-size:12px}',
    '.tcs-f:hover{background:rgba(79,209,255,.08)}.tcs-f.tcs-sel{background:rgba(79,209,255,.15);box-shadow:inset 0 0 0 1px rgba(79,209,255,.32)}',
    '.tcs-dot{flex:0 0 8px;width:8px;height:8px;border-radius:50%;background:#4a5a68}',
    '.tcs-dot.tcs-on{background:#4fd1ff;box-shadow:0 0 6px #4fd1ff}.tcs-dot.tcs-host{background:#7dff9a;box-shadow:0 0 6px #7dff9a}',
    '.tcs-fn{flex:1;min-width:0}',
    '.tcs-fn b{display:block;font-weight:650;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}',
    '.tcs-fn i{display:block;font-style:normal;font-size:10.5px;color:#7c95a8;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}',
    '.tcs-badge{min-width:16px;height:16px;padding:0 4px;border-radius:8px;background:#ff5d6c;color:#fff;font-size:10px;font-weight:700;display:grid;place-items:center}',
    '.tcs-f .tcs-btn{padding:2px 7px;font-size:10.5px}',
    '.tcs-f.tcs-req{flex-wrap:wrap;cursor:default}.tcs-ract{display:flex;gap:5px;width:100%}',
    '.tcs-main{flex:1;display:flex;flex-direction:column;min-width:0;border-radius:10px;background:rgba(3,7,12,.42);border:1px solid rgba(110,140,160,.16)}',
    '.tcs-head{display:flex;align-items:center;gap:7px;padding:7px 9px;border-bottom:1px solid rgba(110,140,160,.14);min-height:40px}',
    '.tcs-head .tcs-fn b{font-size:13px}',
    '.tcs-msgs{flex:1;overflow-y:auto;min-height:0;padding:9px;display:flex;flex-direction:column;gap:5px;scrollbar-width:thin;scrollbar-color:#2c4556 transparent}',
    '.tcs-m{max-width:80%;padding:6px 9px;border-radius:10px;font-size:12px;line-height:1.35;color:#eaf6ff;background:rgba(40,56,74,.85);align-self:flex-start;overflow-wrap:anywhere;white-space:pre-wrap}',
    '.tcs-m.tcs-out{align-self:flex-end;background:linear-gradient(135deg,rgba(47,169,255,.5),rgba(79,209,255,.3))}',
    '.tcs-m.tcs-sys{align-self:center;background:transparent;color:#8fb3c9;font-size:11px;text-align:center;max-width:95%}',
    '.tcs-m small{display:block;font-size:9.5px;color:rgba(234,246,255,.55);margin-top:2px}',
    '.tcs-m.tcs-sys .tcs-btn{margin-top:4px}',
    '.tcs-send{display:flex;gap:6px;padding:7px;border-top:1px solid rgba(110,140,160,.14)}',
    '.tcs-empty{margin:auto;text-align:center;color:#7c95a8;font-size:12px;line-height:1.6;padding:18px}',
    // making an account / logging in, and the account page
    '.tcs-auth{max-width:380px;margin:6px auto 2px;display:flex;flex-direction:column;gap:7px;padding:12px 14px;border-radius:12px;background:rgba(3,7,12,.45);border:1px solid rgba(110,140,160,.18)}',
    '.tcs-auth-t{font-size:13px;color:#fff}',
    '.tcs-auth input,.tcs-acct input{height:30px;padding:0 10px;border-radius:8px;border:1px solid rgba(120,150,175,.28);background:rgba(3,7,12,.55);color:#eafaff;font:600 12px system-ui,sans-serif;outline:0}',
    '.tcs-auth input:focus,.tcs-acct input:focus{border-color:rgba(79,209,255,.65);box-shadow:0 0 0 3px rgba(79,209,255,.12)}',
    '.tcs-auth .tcs-btn.tcs-go{height:30px}.tcs-auth .tcs-btn:disabled,.tcs-acct .tcs-btn:disabled{opacity:.55;cursor:default}',
    '.tcs-auth-sw .tcs-btn{margin-left:4px;padding:1px 8px}.tcs-auth-fine{font-size:10.5px;color:#7c95a8}',
    '.tcs-acct{flex:1;display:flex;flex-direction:column;gap:8px;padding:12px;overflow-y:auto;min-height:0}',
    '.tcs-acct-row{display:flex;gap:6px;flex-wrap:wrap}.tcs-acct-pw{display:flex;flex-direction:column;gap:6px;max-width:300px}',
    '.tcs-main-acct>*:not(.tcs-acct){display:none!important}',
    '.tcs-more{display:flex;gap:6px;flex-wrap:wrap;padding:6px 9px;border-bottom:1px solid rgba(110,140,160,.14)}',
    '.tcs-who{padding:4px 9px;font-size:11px;color:#9fd8f0;border-bottom:1px solid rgba(110,140,160,.14);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}',
    '.tcs-ask{align-items:center}.tcs-ask .tcs-note{flex:1 0 100%}.tcs-ask .tcs-btn:disabled{opacity:.5;cursor:default}',
    '.tcs-ask input{flex:1;min-width:60px;height:26px;padding:0 8px;border-radius:7px;border:1px solid rgba(120,150,175,.28);background:rgba(3,7,12,.55);color:#eafaff;font:600 12px ui-monospace,Menlo,Consolas,monospace;outline:0}',
    '.tcs-ask input:focus{border-color:rgba(79,209,255,.65);box-shadow:0 0 0 3px rgba(79,209,255,.12)}',
    '.tcs-rows{display:flex;flex-direction:column;gap:4px;margin-top:6px;max-height:260px;overflow-y:auto}',
    '.tcs-row{display:flex;align-items:center;gap:8px;padding:5px 9px;border-radius:8px;background:rgba(3,7,12,.42);color:#dff6ff;font-size:12px}',
    '.tcs-row span{flex:1;min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}',
    '.tcs-row em{font-style:normal;font-size:10.5px;color:#7c95a8}',
    // friends' worlds on the Singleplayer / Multiplayer screens
    '#thunder-fworlds{position:fixed;top:5px;left:6px;z-index:2147483000;display:flex;flex-direction:column;align-items:flex-start;gap:4px;',
      'color:#e8f6ff;font:11px/1.3 system-ui,-apple-system,Segoe UI,sans-serif}',
    '.tcs-wl{display:flex;align-items:center;gap:8px;max-width:100%;box-sizing:border-box;padding:3px 4px 3px 10px;border-radius:999px;',
      'background:rgba(8,14,22,.9);border:1px solid rgba(79,209,255,.42);box-shadow:0 4px 16px rgba(0,0,0,.4),0 0 12px rgba(79,209,255,.14)}',
    '.tcs-wl span{min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}',
    '.tcs-wl .tcs-btn{flex:0 0 auto;padding:2px 9px}'
  ].join('');
  function soCss(){
    if(D.getElementById('thunder-social-style'))return;
    var st=D.createElement('style');st.id='thunder-social-style';st.textContent=SO_CSS;
    (D.head||D.documentElement).appendChild(st);
  }
  function soBtn(label,fn,go){
    var b=el('button','tcs-btn'+(go?' tcs-go':''),label);b.type='button';
    b.addEventListener('click',function(e){e.stopPropagation();fn(e);});
    return b;
  }
  var soToastBox=null;
  // o: {kind, title, text, id (a friend: click opens the chat; open: the card), code (an invite: Join), req (a
  // request: Accept / Decline), quiet (shorter), tag (replaces an earlier pop-up with that tag)}
  function soToast(o){
    if(!D.body)return;
    soCss();
    if(!soToastBox){soToastBox=el('div');soToastBox.id='thunder-toasts';}
    if(soToastBox.nextSibling||soToastBox.parentNode!==D.body)D.body.appendChild(soToastBox);   // last, so above the menu
    if(o.tag)[].slice.call(soToastBox.children).forEach(function(c){if(c.getAttribute('data-tag')===o.tag)soToastBox.removeChild(c);});
    while(soToastBox.children.length>=4)soToastBox.removeChild(soToastBox.firstChild);
    var t=el('div','tct'+(o.id||o.open?' tct-click':''));
    if(o.tag)t.setAttribute('data-tag',o.tag);
    t.appendChild(el('b',null,o.title||''));
    if(o.text)t.appendChild(el('p',null,o.text));
    var act=null;
    if(o.code){act=el('div','tct-act');act.appendChild(soBtn('Join',function(){if(soJoin(o.code,SO.friends[o.id]))gone();},true));}
    if(o.req){
      act=el('div','tct-act');
      act.appendChild(soBtn('Accept',function(){soAct('accept',o.req);gone();},true));
      act.appendChild(soBtn('Decline',function(){soAct('decline',o.req);gone();}));
    }
    if(act)t.appendChild(act);
    // in a world the mouse belongs to the game: say which key opens the chat
    if(HEN&&HEN.X&&HEN.cm===null&&!menuOpen&&o.kind!=='info'&&S.socialOn)t.appendChild(el('i',null,'Press '+keyLabel(S.socialKey||'KeyO')+' to open the chat'));
    if(o.id||o.open)t.addEventListener('click',function(){soShowChat(o.id||'');gone();});
    soToastBox.appendChild(t);
    var left=o.quiet?4500:(o.code||o.req?12000:7000),timer=0,start=now();
    function gone(){W.clearTimeout(timer);if(t.parentNode)t.parentNode.removeChild(t);}
    function arm(ms){timer=W.setTimeout(gone,ms);start=now();left=ms;}
    t.addEventListener('mouseenter',function(){W.clearTimeout(timer);left=Math.max(1500,left-(now()-start));});
    t.addEventListener('mouseleave',function(){arm(left);});
    arm(left);
  }

  // ---- Right Shift > Friends -----------------------------------------------------------------
  function soShowChat(id){
    if(id&&SO.friends[id])SO.sel=id;
    // nobody picked yet: the friend whose unread message is newest
    if(!SO.sel){
      var best='',at=-1;
      for(var k in SO.unread)if(SO.unread[k]&&SO.friends[k]&&soLastAt(k)>at){at=soLastAt(k);best=k;}
      if(best)SO.sel=best;
    }
    if(SO.sel&&SO.unread[SO.sel]){delete SO.unread[SO.sel];soSaveChats();}
    currentCat='friends';searchQuery='';
    if(searchInput)searchInput.value='';
    if(menuOpen)render();else showMenu();
    // the chat is the first card: shown at the top, the typing box ready
    W.setTimeout(function(){
      try{
        if(listEl)listEl.scrollTop=0;
        var inp=D.getElementById(SO.ask&&SO.ask===SO.sel?'tcs-code':'tcs-say');
        if(inp&&!inp.disabled&&inp.offsetParent)inp.focus();
      }catch(_){}
    },50);
  }
  function soStatusLine(){
    switch(SO.state){
      case 'on':return ['tcm-ok','Online',soTagged(SO.me)+(S.socialListed?'':' \u2022 hidden from On Thunder now')];
      case 'auth':return ['tcm-warn','Log in',SO.auth&&SO.auth.old?'choose a password to keep your account':'make your account, or log in'];
      case 'connecting':return ['tcm-warn','Connecting',''];
      case 'retry':var sec=Math.max(1,Math.ceil((SO.retryAt-now())/1000));
        return ['tcm-warn','Offline',(SO.msg?SO.msg+'; ':'')+'trying again in '+(sec>90?Math.ceil(sec/60)+' min':sec+' s')];
      case 'none':return ['','Not on this site',SO.msg||''];
      case 'error':return ['tcm-bad','Stopped',SO.msg];
      default:return S.socialOn?['tcm-warn','Connecting','']:['','Off','switch Thunder Friends on in its settings below'];
    }
  }
  function soTime(at){
    var d=new Date(at),n=new Date(),hm=('0'+d.getHours()).slice(-2)+':'+('0'+d.getMinutes()).slice(-2);
    return d.toDateString()===n.toDateString()?hm:(d.getMonth()+1)+'/'+d.getDate()+' '+hm;
  }
  function soFriendIds(){
    return Object.keys(SO.friends).sort(function(a,b){
      var fa=SO.friends[a],fb=SO.friends[b];
      return (fb.online-fa.online)||((SO.unread[b]|0)-(SO.unread[a]|0))||(!fa.online&&((fb.seen||0)-(fa.seen||0)))||String(fa.name).localeCompare(String(fb.name));
    });
  }
  // the chat card: you, add a friend, requests, friends (left); the chat with one friend (right)
  SPECIALS.socialchat=function(box){
    soCss();lanCss();soSoon();
    var wrap=el('div','tcs-chat'),side=el('div','tcs-side'),main=el('div','tcs-main');
    wrap.appendChild(side);wrap.appendChild(main);box.appendChild(wrap);
    // not signed in on this device: make an account, or log in (the rest of the card waits)
    var auth=el('div','tcs-auth'),aTitle=el('b','tcs-auth-t'),aIntro=el('div','tcs-note');
    var aName=el('input'),aPw=el('input'),aPw2=el('input'),aMsg=el('div','tcs-note'),aSwitch=el('div','tcs-note tcs-auth-sw');
    aName.type='text';aName.maxLength=16;aName.spellcheck=false;aName.autocomplete='username';aName.placeholder='Name';
    aPw.type='password';aPw.maxLength=64;aPw.placeholder='Password';
    aPw2.type='password';aPw2.maxLength=64;aPw2.placeholder='Password again';aPw2.autocomplete='new-password';
    var aGo=soBtn('',function(){doAuth();},true),aFilled='',aAuto='';
    var aSwB=soBtn('',function(){
      SO.authMode=SO.authMode==='login'?'register':'login';SO.authMsg='';aPw.value=aPw2.value='';aFilled='';paintAuth();
      W.setTimeout(function(){try{(aName.value?aPw:aName).focus();}catch(_){}},0);
    });
    var aFine=el('div','tcs-note tcs-auth-fine','A forgotten password cannot be reset (Thunder has no email for you), so keep it safe, and do not use a password from another site.');
    function doAuth(){if(SO.authBusy)return;if(SO.authMode==='login')soLogin(aName.value,aPw.value);else soRegister(aName.value,aPw.value,aPw2.value);}
    [aName,aPw,aPw2].forEach(function(i){
      soKeepKeys(i,doAuth);
      i.addEventListener('input',function(){if(SO.authMsg&&!SO.authOk){SO.authMsg='';paintAuth();}});
    });
    [aTitle,aIntro,aName,aPw,aPw2,aGo,aMsg,aSwitch,aFine].forEach(function(n){auth.appendChild(n);});
    box.insertBefore(auth,wrap);
    function paintAuth(){
      var a=SO.auth||{},reg=SO.authMode!=='login';
      aTitle.textContent=reg?(a.old?'Choose a password for Thunder Friends':'Make your Thunder Friends account'):'Log in to Thunder Friends';
      aIntro.textContent=reg?(a.old?'Thunder Friends now has accounts, so nobody else can use your name. Pick your name and a password: your friends stay.':
        'A name that is only yours, and a password. Log in with them on your other devices too.'):'Your account\'s name and password.';
      // the name offered: the profile name (unless someone else has it); what was typed stays
      var key=SO.authMode+'|'+(a.name||'')+'|'+a.taken;
      if(aFilled!==key){
        aFilled=key;
        if(!aName.value||aName.value===aAuto){aName.value=reg?(a.taken?'':a.name||''):(a.taken?a.name||'':'');aAuto=aName.value;}
      }
      aPw.autocomplete=reg?'new-password':'current-password';
      aPw2.style.display=reg?'':'none';
      aGo.textContent=SO.authBusy?(reg?'Making your account\u2026':'Logging in\u2026'):(reg?'Create account':'Log in');
      aGo.disabled=aName.disabled=aPw.disabled=aPw2.disabled=!!SO.authBusy;
      var note=SO.authMsg||(reg&&a.taken&&a.name?a.name+' already has an account. If it is yours, log in; if not, pick another name.':'');
      aMsg.textContent=note;aMsg.style.display=note?'':'none';
      aMsg.className='tcs-note'+(SO.authMsg?(SO.authOk?' tcs-ok':' tcs-bad'):'');
      while(aSwitch.firstChild)aSwitch.removeChild(aSwitch.firstChild);
      aSwitch.appendChild(D.createTextNode(reg?'Already have an account?':'New to Thunder Friends?'));
      aSwB.textContent=reg?'Log in':'Make an account';aSwitch.appendChild(aSwB);
      aFine.style.display=reg?'':'none';
    }
    // you, and whether Thunder Friends is connected
    var me=el('div','tcs-me'),meDot=el('span','tcm-dot'),meTxt=el('span','tcs-me-t');
    me.appendChild(meDot);
    var copy=soBtn('Copy',function(){
      function said(t){copy.textContent=t;W.setTimeout(function(){copy.textContent='Copy';},1200);}
      try{W.navigator.clipboard.writeText(soTagged(SO.me)).then(function(){said('Copied');},function(){said('Not copied');});}catch(_){said('Not copied');}
    });
    var acctB=soBtn('Account',function(){SO.acctOpen=!SO.acctOpen;SO.acctMsg='';SO.acctPw=false;soChanged();});
    me.appendChild(meTxt);me.appendChild(copy);me.appendChild(acctB);side.appendChild(me);
    // add a friend
    var addRow=el('div','tcs-in'),addIn=el('input'),addB=soBtn('Add',function(){soAddFriend(addIn.value);},true);
    addIn.type='text';addIn.placeholder='Friend\'s name';addIn.maxLength=40;addIn.spellcheck=false;addIn.autocomplete='off';
    soKeepKeys(addIn,function(){soAddFriend(addIn.value);});
    addRow.appendChild(addIn);addRow.appendChild(addB);side.appendChild(addRow);
    var addNote=el('div','tcs-note');side.appendChild(addNote);
    var list=el('div','tcs-list');side.appendChild(list);
    var listVer=-1,listSel=null;
    function friendRow(f){
      var r=el('div','tcs-f'+(SO.sel===f.id?' tcs-sel':''));
      r.appendChild(el('span','tcs-dot'+(soHosting(f)?' tcs-host':f.online?' tcs-on':'')));
      var fn=el('div','tcs-fn');fn.appendChild(el('b',null,soTagged(f)));fn.appendChild(el('i',null,soDoing(f)));r.appendChild(fn);
      if(SO.unread[f.id])r.appendChild(el('span','tcs-badge',String(Math.min(99,SO.unread[f.id]))));
      r.addEventListener('click',function(){SO.sel=f.id;delete SO.unread[f.id];soSaveChats();soChanged();W.setTimeout(function(){var i=D.getElementById('tcs-say');if(i)i.focus();},0);});
      return r;
    }
    function reqRow(p,incoming){
      var r=el('div','tcs-f'+(incoming?' tcs-req':''));
      var fn=el('div','tcs-fn');fn.appendChild(el('b',null,soTagged(p)));fn.appendChild(el('i',null,incoming?'wants to be your friend':'asked, waiting'));r.appendChild(fn);
      if(incoming){
        var act=el('div','tcs-ract');
        act.appendChild(soBtn('Accept',function(){soAct('accept',p.id);},true));
        act.appendChild(soBtn('No',function(){soAct('decline',p.id);}));
        act.appendChild(armBtn('Block','Click again to block',function(){soAct('block',p.id);},'block:'+p.id));
        r.appendChild(act);
      }
      else r.appendChild(soBtn('Cancel',function(){soAct('cancel',p.id);}));
      return r;
    }
    function paintSide(){
      var st=soStatusLine();
      meDot.className='tcm-dot'+(st[0]?' '+st[0]:'');
      meTxt.textContent='';
      if(SO.state==='on'&&SO.me){meTxt.appendChild(D.createTextNode('You are '));meTxt.appendChild(el('em',null,soTagged(SO.me)));}
      else meTxt.textContent=st[1]+(st[2]?' \u2022 '+st[2]:'');
      meTxt.title=meTxt.textContent;
      copy.style.display=acctB.style.display=SO.state==='on'&&SO.me?'':'none';
      acctB.textContent=SO.acctOpen?'Chats':'Account';
      if(SO.addClear){SO.addClear=false;addIn.value='';}
      addIn.disabled=addB.disabled=!soReady();
      addNote.textContent=SO.addMsg||(SO.me?'Friends add you by your name, '+SO.me.name+'.':'');
      addNote.className='tcs-note'+(SO.addMsg?(SO.addOk?' tcs-ok':' tcs-bad'):'');
      while(list.firstChild)list.removeChild(list.firstChild);
      if(SO.reqIn.length){list.appendChild(el('div','tcs-sec','Requests'));SO.reqIn.forEach(function(p){list.appendChild(reqRow(p,true));});}
      var ids=soFriendIds(),on=0;
      ids.forEach(function(id){if(SO.friends[id].online)on++;});
      list.appendChild(el('div','tcs-sec','Friends'+(ids.length?' \u2022 '+on+' online':'')));
      if(!ids.length)list.appendChild(el('div','tcs-note',SO.me?'No friends yet. Add one above with their name and tag, or from On Thunder now below.':''));
      ids.forEach(function(id){list.appendChild(friendRow(SO.friends[id]));});
      if(SO.reqOut.length){list.appendChild(el('div','tcs-sec','Asked'));SO.reqOut.forEach(function(p){list.appendChild(reqRow(p,false));});}
      if(SO.blocked.length){
        list.appendChild(el('div','tcs-sec','Blocked'));
        SO.blocked.forEach(function(p){
          var r=el('div','tcs-f'),fn=el('div','tcs-fn');
          fn.appendChild(el('b',null,soTagged(p)));fn.appendChild(el('i',null,'cannot ask or see you'));r.appendChild(fn);
          r.appendChild(soBtn('Unblock',function(){soAct('unblock',p.id);}));
          list.appendChild(r);
        });
      }
    }
    // the chat
    var head=el('div','tcs-head'),more=el('div','tcs-more'),msgs=el('div','tcs-msgs'),send=el('div','tcs-send');
    // who is playing in the friend's open world, and the box for its code when it needs one
    var who=el('div','tcs-who'),ask=el('div','tcs-more tcs-ask'),askTxt=el('span','tcs-note'),askIn=el('input'),askSay=el('span','tcs-note');
    var askB=soBtn('Join',function(){doAsk();},true),askX=soBtn('Cancel',function(){SO.ask='';paintHead();});
    askIn.id='tcs-code';askIn.type='text';askIn.placeholder='Code';askIn.maxLength=12;askIn.spellcheck=false;askIn.autocomplete='off';
    function doAsk(){
      var f=SO.friends[SO.sel],c=askIn.value.replace(/\s+/g,'');
      if(!f||!c)return;
      soJoin(c,f);
      paintHead();
    }
    soKeepKeys(askIn,doAsk);
    askIn.addEventListener('input',function(){if(SO.askErr){SO.askErr='';paintHead();}});
    ask.appendChild(askTxt);ask.appendChild(askIn);ask.appendChild(askB);ask.appendChild(askX);ask.appendChild(askSay);
    var say=el('input'),sayB=soBtn('Send',function(){doSend();},true);
    say.id='tcs-say';say.type='text';say.maxLength=300;say.spellcheck=true;say.autocomplete='off';
    function doSend(){if(SO.sel&&soMsg(SO.sel,say.value))say.value='';}
    soKeepKeys(say,doSend);
    send.appendChild(say);send.appendChild(sayB);
    main.appendChild(head);main.appendChild(who);main.appendChild(ask);main.appendChild(more);main.appendChild(msgs);main.appendChild(send);
    // your account (the Account button): a new password, or log out
    var acct=el('div','tcs-acct'),acTitle=el('b','tcs-auth-t'),acInfo=el('div','tcs-note'),acMsg=el('div','tcs-note');
    var acOld=el('input'),acNew=el('input'),acNew2=el('input'),acPwBox=el('div','tcs-acct-pw'),acRow=el('div','tcs-acct-row');
    var acSave=soBtn('Save new password',function(){doPw();},true);
    [acOld,acNew,acNew2].forEach(function(i,n){
      i.type='password';i.maxLength=64;i.autocomplete=n?'new-password':'current-password';
      i.placeholder=['Old password','New password','New password again'][n];
      soKeepKeys(i,doPw);
      acPwBox.appendChild(i);
    });
    acPwBox.appendChild(acSave);
    function doPw(){if(!SO.acctBusy)soPasswd(acOld.value,acNew.value,acNew2.value);}
    acRow.appendChild(soBtn('Change password',function(){SO.acctPw=!SO.acctPw;SO.acctMsg='';paintAcct();}));
    acRow.appendChild(armBtn('Log out','Click again to log out',function(){soLogout();},'logout'));
    acRow.appendChild(soBtn('Back to chats',function(){SO.acctOpen=false;soChanged();}));
    [acTitle,acInfo,acRow,acPwBox,acMsg].forEach(function(n){acct.appendChild(n);});
    main.appendChild(acct);
    function paintAcct(){
      acTitle.textContent='Your account: '+soTagged(SO.me);
      acInfo.textContent='Log in with your name and password on any device. A new password logs out your other devices. Logging out removes this account\'s chats from this browser.';
      acPwBox.style.display=SO.acctPw?'':'none';
      if(!SO.acctPw)acOld.value=acNew.value=acNew2.value='';
      acSave.textContent=SO.acctBusy?'Saving\u2026':'Save new password';
      acSave.disabled=acOld.disabled=acNew.disabled=acNew2.disabled=!!SO.acctBusy;
      acMsg.textContent=SO.acctMsg;acMsg.style.display=SO.acctMsg?'':'none';
      acMsg.className='tcs-note'+(SO.acctMsg?(SO.acctOk?' tcs-ok':' tcs-bad'):'');
    }
    var moreOpen=false,chatVer=-1,chatSel=null,chatReady=null;
    function paintHead(){
      while(head.firstChild)head.removeChild(head.firstChild);
      while(more.firstChild)more.removeChild(more.firstChild);
      var f=SO.friends[SO.sel],w=soWho(f),asking=!!(f&&SO.ask===f.id&&soHosting(f)&&!f.s.code);
      more.style.display=f&&moreOpen?'':'none';
      who.style.display=w?'':'none';
      who.textContent=w?'Playing: '+w:'';
      ask.style.display=asking?'':'none';
      askTxt.textContent=asking?f.name+'\'s world needs its code:':'';
      if(!asking)askIn.value='';
      var busy=asking&&SO.joining&&SO.joining.id===f.id;
      askSay.textContent=busy?'Connecting\u2026':asking&&SO.askErr?SO.askErr:'';
      askSay.className='tcs-note'+(SO.askErr&&!busy?' tcs-bad':'');
      askSay.style.display=askSay.textContent?'':'none';
      askB.disabled=askIn.disabled=!!busy;
      if(!f){head.appendChild(el('div','tcs-note','Chats'));return;}
      head.appendChild(el('span','tcs-dot'+(soHosting(f)?' tcs-host':f.online?' tcs-on':'')));
      var fn=el('div','tcs-fn');fn.appendChild(el('b',null,soTagged(f)));fn.appendChild(el('i',null,soDoing(f)));head.appendChild(fn);
      if(soHosting(f)&&!asking)head.appendChild(soBtn('Join',function(){if(!soJoinFriend(f))paintHead();W.setTimeout(function(){var i=D.getElementById('tcs-code');if(i&&i.offsetParent)i.focus();},0);},true));
      if(soServerAddr(f))head.appendChild(soBtn('Join',function(){soJoinServer(f);},true));
      if(LH.state==='open'&&LH.code&&f.online)head.appendChild(soBtn('Invite',function(){soInvite(f.id);}));
      head.appendChild(soBtn(moreOpen?'Less':'More',function(){moreOpen=!moreOpen;paintHead();}));
      more.appendChild(armBtn('Remove friend','Click again to remove',function(){soAct('remove',f.id);},'remove:'+f.id));
      more.appendChild(armBtn('Block','Click again to block',function(){soAct('block',f.id);},'block:'+f.id));
    }
    function ids0(){return Object.keys(SO.friends).length>0;}
    // a button that asks for a second click
    // (the list is rebuilt when anything changes: the armed state is kept by key meanwhile)
    // (the second click counts for 4 seconds; not reset when the mouse leaves, because the wider
    // "Click again" text can move the button out from under the mouse)
    function armBtn(label,armed,fn,key){
      var b=soBtn(label,function(){
        if(!SO.arm[key]){
          var t=SO.arm[key]=now();b.textContent=armed;
          W.setTimeout(function(){if(SO.arm[key]===t){delete SO.arm[key];b.textContent=label;soChanged();}},4000);
          return;
        }
        delete SO.arm[key];fn();
      });
      if(SO.arm[key])b.textContent=armed;
      return b;
    }
    function msgEl(m){
      var d=el('div','tcs-m'+(m.w==='out'?' tcs-out':m.w==='sys'?' tcs-sys':''));
      d.appendChild(D.createTextNode(m.text));
      if(m.w==='sys'&&m.code){
        var jb=soBtn('Join',function(){soJoin(m.code,SO.friends[SO.sel]);},true);
        d.appendChild(el('br'));d.appendChild(jb);
      }
      if(m.w!=='sys'){
        var st=m.w==='out'?(m.st==='sending'?' \u2022 sending':m.st==='waiting'?' \u2022 sent while they were offline':m.st==='failed'?' \u2022 not sent':m.st==='unsure'?' \u2022 may not have been sent':''):'';
        d.appendChild(el('small',null,soTime(m.at)+st));
      }
      return d;
    }
    function paintChat(){
      var f=SO.friends[SO.sel],l=SO.sel?(SO.chats[SO.sel]||[]):[];
      var atEnd=msgs.scrollHeight-msgs.scrollTop-msgs.clientHeight<30;
      while(msgs.firstChild)msgs.removeChild(msgs.firstChild);
      if(!f){
        msgs.appendChild(el('div','tcs-empty',SO.me?(ids0()?'Pick a friend on the left to chat.':'Add friends with their name and tag. Chats, and worlds they open, show here.'):'Thunder Friends is not connected.'));
      }else{
        if(!l.length)msgs.appendChild(el('div','tcs-empty','Say hi to '+f.name+'!'));
        l.forEach(function(m){msgs.appendChild(msgEl(m));});
      }
      say.disabled=sayB.disabled=!f||!soReady();
      say.placeholder=!f?'':!soReady()?'Not connected':'Message '+f.name+' (Enter to send)';
      if(atEnd||chatSel!==SO.sel)msgs.scrollTop=msgs.scrollHeight;
    }
    addLive(function(){
      if(SO.sel&&!SO.friends[SO.sel])SO.sel='';
      if(SO.sel&&SO.unread[SO.sel]){delete SO.unread[SO.sel];soSaveChats();}
      // not signed in: only the account forms; the account page instead of the chat
      var authing=SO.state==='auth',acctOn=SO.acctOpen&&soReady()&&!!SO.me;
      auth.style.display=authing?'':'none';wrap.style.display=authing?'none':'';
      acct.style.display=acctOn?'':'none';main.className='tcs-main'+(acctOn?' tcs-main-acct':'');
      // rebuilt only when something changed, so clicks and typing are never lost
      if(listVer!==SO.ver||listSel!==SO.sel||SO.state==='retry'){listVer=SO.ver;listSel=SO.sel;paintSide();paintHead();paintAuth();paintAcct();}
      // the chat itself only when its lines changed (so reading older lines never jumps)
      var rd=soReady()&&!!SO.friends[SO.sel];
      if(chatVer!==SO.cver||chatSel!==SO.sel||chatReady!==rd){paintChat();chatVer=SO.cver;chatSel=SO.sel;chatReady=rd;}
    });
    if(soGameUp())soConnect();
  };
  // typing in a Thunder Friends box stays there (the game listens to keys on the window)
  function soKeepKeys(inp,enter){
    inp.addEventListener('keydown',function(e){e.stopPropagation();if(e.key==='Enter'){e.preventDefault();enter();}});
    inp.addEventListener('keyup',function(e){e.stopPropagation();});
    inp.addEventListener('keypress',function(e){e.stopPropagation();});
  }
  // everyone on Thunder now (who shows in the list)
  SPECIALS.socialonline=function(box){
    soCss();lanCss();
    var info=el('div','tcs-note'),rows=el('div','tcs-rows'),act=el('div','tcm-actions');
    var again=lanBtn('Refresh',function(){SO.onlineAt=0;soAskOnline();});
    box.appendChild(info);box.appendChild(rows);act.appendChild(again);box.appendChild(act);
    var ver=-1;
    function row(p){
      var r=el('div','tcs-row');
      r.appendChild(el('span',null,soTagged(p)));
      if(p.friend||SO.friends[p.id])r.appendChild(el('em',null,'friend'));
      else if(SO.reqOut.some(function(x){return x.id===p.id;}))r.appendChild(el('em',null,'asked'));
      else if(SO.reqIn.some(function(x){return x.id===p.id;}))r.appendChild(soBtn('Accept',function(){soAct('accept',p.id);},true));
      else r.appendChild(soBtn('Add',function(){soSend({t:'add',who:p.id});},true));
      return r;
    }
    addLive(function(){
      if(soReady()&&now()-SO.onlineAt>20000)soAskOnline();     // fresh while the card is on screen
      var v=SO.ver+'/'+SO.over;
      if(ver===v)return;
      ver=v;
      while(rows.firstChild)rows.removeChild(rows.firstChild);
      var o=SO.online;
      if(!soReady()){info.textContent=SO.state==='auth'?'Log in to Thunder Friends (above) to see who is on Thunder.':'Thunder Friends is not connected.';return;}
      if(!o){info.textContent='Looking\u2026';return;}
      var hidden=o.total-o.list.length;
      info.textContent=o.total?o.total+(o.total===1?' other player':' other players')+' on Thunder now'+(hidden>0?' ('+hidden+' not shown: hidden or blocked)':'')+'.':'Nobody else is on Thunder right now.';
      o.list.forEach(function(p){rows.appendChild(row(p));});
    });
  };

  // ---- friends' worlds on the Singleplayer and Multiplayer screens -----------------------------
  // In the empty strip above the screen's list and left of its title (so it never covers either):
  // one line per open world with who is playing and Join, two lines at most (then "... more").
  var soWorldsBox=null,soWorldsKey='';
  // (the Multiplayer screen also lists the servers friends are on: friends on the same one share a line)
  function soWorlds(){
    var scr=HEN&&HEN.cm,mp=scr instanceof OG,show=!!(scr&&(scr instanceof A_3||mp))&&!menuOpen&&soReady(),list=[],by={};
    if(show){
      for(var id in SO.friends){
        var f=SO.friends[id],a;
        if(soHosting(f))list.push({f:f,n:String(f.name)});
        else if(mp&&(a=soServerAddr(f))){
          var k=soServerName(a).toLowerCase();
          if(by[k])by[k].fs.push(f);else list.push(by[k]={addr:a,fs:[f],n:String(f.name)});
        }
      }
    }
    if(!list.length)show=false;
    if(!show){if(soWorldsBox)soWorldsBox.style.display='none';soWorldsKey='';return;}
    soCss();
    if(!soWorldsBox){soWorldsBox=el('div');soWorldsBox.id='thunder-fworlds';D.body.appendChild(soWorldsBox);}
    soWorldsBox.style.display='';
    // the screen's width in its own units (GuiScreen.width) and one unit on the page: its title is
    // centred at the top and its list starts 32 units down
    var gw=scr.q|0,px=gw>0?W.innerWidth/gw:2,room=Math.max(120,Math.floor((gw/2-56)*px)-6),lines=32*px>=62?2:1;
    list.forEach(function(e){if(e.fs)e.fs.sort(function(x,y){return String(x.name).localeCompare(String(y.name));});});
    list.sort(function(x,y){return (!!x.fs-!!y.fs)||x.n.localeCompare(y.n);});
    var key=room+'/'+lines+'/'+list.map(function(e){
      if(e.fs)return 's'+e.addr+':'+e.fs.map(function(f){return f.id+f.name;}).join(',');
      var f=e.f;return f.id+(f.s.code||'-')+f.name+(f.s.players||[]).join(',');
    }).join('|');
    if(key===soWorldsKey)return;
    soWorldsKey=key;
    while(soWorldsBox.firstChild)soWorldsBox.removeChild(soWorldsBox.firstChild);
    soWorldsBox.style.maxWidth=room+'px';
    var shown=list.length>lines?lines-1:list.length;
    list.slice(0,shown).forEach(function(e){
      var r=el('div','tcs-wl'),t;
      if(e.fs){
        var names=e.fs.map(function(f){return f.name;}),srv=soServerName(e.addr);
        t=el('span',null,(names.length>2?names[0]+' and '+(names.length-1)+' more':names.join(' and '))+' on '+srv);
        t.title=names.join(', ')+' '+(names.length>1?'are':'is')+' on '+srv;
        r.appendChild(t);
        r.appendChild(soBtn('Join',function(){soJoinServer(e.fs[0]);},true));
      }else{
        var f=e.f,w=soWho(f);
        t=el('span',null,f.name+'\'s world'+(w.indexOf(',')>0?': '+w:' is open'));
        t.title=w?'Playing: '+w:'';
        r.appendChild(t);
        r.appendChild(soBtn(f.s.code?'Join':'Join (code)',function(){soJoinFriend(f);},true));
      }
      soWorldsBox.appendChild(r);
    });
    if(shown<list.length){
      var rest=list.length-shown,r2=el('div','tcs-wl'),srvs=list.slice(shown).filter(function(e){return !!e.fs;}).length;
      r2.appendChild(el('span',null,shown?rest+' more':srvs===rest?rest+' friends\' servers':srvs?rest+' friends\' worlds and servers':rest+' friends\' worlds are open'));
      r2.appendChild(soBtn('See',function(){soShowChat('');},true));
      soWorldsBox.appendChild(r2);
    }
  }
  frameTasks.push(function(){if(soWorldsBox||soReady())soWorlds();});

  // ---- Open to Friends card: how friends on Thunder Friends join the world ------------------------
  // (the same setting as in Thunder Friends settings; placed before the card's last part, Always open)
  var soLanHost=SPECIALS.lanhost;
  SPECIALS.lanhost=function(box,m){
    soLanHost(box,m);
    var part=el('div'),row=el('div','tcm-row'),sw=el('button','tcm-switch'),note=el('div','tcm-note');
    sw.type='button';sw.setAttribute('aria-label','Friends join with one click');
    row.appendChild(el('span',null,'Friends join with one click'));row.appendChild(sw);
    part.appendChild(row);part.appendChild(note);
    sw.addEventListener('click',function(e){e.stopPropagation();S.socialQuickJoin=!S.socialQuickJoin;save();soStatusNow();runLive();});
    box.insertBefore(part,box.lastChild);
    addLive(function(){
      part.style.display=S.socialOn&&SO.state!=='none'?'':'none';
      sw.className='tcm-switch'+(S.socialQuickJoin?' tcm-on':'');
      note.textContent=S.socialQuickJoin?'Thunder Friends: your friends see this world and join it with one click.':
        'Thunder Friends: your friends see this world is open, but need the code you give them. An Invite still lets that friend in with one click.';
    });
  };

  // ---- the chat key --------------------------------------------------------------------------
  if(W.addEventListener)W.addEventListener('keydown',function(e){
    try{
      var code=e&&e.code;
      if(!code||e.repeat||code!==(S.socialKey||'KeyO')||!S.socialOn||menuOpen||hudEditing||!HEN)return;
      // from a world with no screen open, or from the title screen (it has no typing boxes)
      if((HEN.X&&HEN.cm===null)||HEN.cm instanceof Hj){kill(e);soShowChat(SO.sel);}
    }catch(_){}
  },true);

  // ---- the cards -----------------------------------------------------------------------------
  var SO_MOD_CHAT={cat:'friends',id:null,name:'Thunder Friends',wide:true,special:'socialchat',
      desc:'Add friends by name, chat, see what they are playing and join worlds they open. The chat key (O) opens this in a world.'},
    SO_MOD_ONLINE={cat:'friends',id:null,name:'On Thunder now',wide:true,special:'socialonline',
      desc:'Everyone on Thunder Client right now who shows in this list. Add them as friends.'},
    SO_MOD_SET={cat:'friends',id:'socialOn',name:'Thunder Friends settings',wide:true,always:true,
      desc:'Connects to this site\'s friends hub with your Thunder Friends account (a name and a password). Your chats stay in this browser.',
      onChange:function(v){if(v){SO.fatal='';SO.retry=0;soSet('off','');soConnect();}else soDisconnect();},
      opts:[{id:'socialListed',name:'Show me in On Thunder now'},
        {id:'socialShare',name:'Show friends what I am playing (and the code of a world I open)'},
        {id:'socialToasts',name:'Pop-ups for messages, requests and invites'},
        {id:'socialOnlineToasts',name:'Pop-up when a friend comes online'},
        {id:'socialQuickJoin',name:'Friends join my world with one click (off: they need its code; an Invite still lets that friend in)'},
        {id:'socialKey',name:'Chat key',key:true,mouse:false}]};
  (function(){
    var i=MODULES.indexOf(LAN_MOD_OPEN),j=MODULES.indexOf(LAN_MOD_JOIN);
    if(i<0||j<0){MODULES.push(SO_MOD_CHAT,SO_MOD_ONLINE,SO_MOD_SET);return;}
    MODULES.splice(Math.max(i,j)+1,0,SO_MOD_ONLINE,SO_MOD_SET);
    MODULES.splice(Math.min(i,j),0,SO_MOD_CHAT);
  })();

  // for tests and the console
  TC.social={state:SO,connect:soConnect,disconnect:soDisconnect,add:soAddFriend,msg:soMsg,act:soAct,invite:soInvite,
    join:soJoin,joinFriend:soJoinFriend,online:soAskOnline,show:soShowChat,toast:soToast,activity:soActivity,who:soWho,
    register:soRegister,login:soLogin,passwd:soPasswd,logout:soLogout};
