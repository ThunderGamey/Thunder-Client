  /* -------------------------------------------------------------------------------------------
     Part of Thunder Client, created and owned by Jayvardhan Ginni (ThunderGamey).
     Thunder Friends: a friends list across Thunder Client, who is on Thunder right now, friend
     requests, chat and world invites, through this site's friends hub (/social: the ThunderSocial
     object of the thunder-relay Worker, thunder-relay/social.js). Included into the client scope
     of thunder-client.js by build.js, after thunder-lan.js (it opens and joins worlds with it).
       - Right Shift > Friends: your name and tag, adding friends by Name#tag, requests, the friends
         list (what each one is playing, with Join for a world they opened and Invite to yours),
         the chat, and everyone else on Thunder right now.
       - O (Right Shift > Friends > Thunder Friends settings) opens the chat from a world or the
         title screen.
       - Pop-ups at the top right: messages, friend requests, invites, friends coming online.
       - The Singleplayer and Multiplayer screens list worlds friends have opened, with Join.
     Who you are: a secret key made in this browser the first time (localStorage
     "thunderSocial_v1"); the hub knows you by a hash of it. Chats are kept in this browser
     ("thunderSocialChats_v1"). How it works and what was tested: thunder/NETWORKING.md.

     Classes it uses (which screen is open):
     @class A_3 net.minecraft.client.gui.GuiWorldSelection
     @class OG net.minecraft.client.gui.GuiMultiplayer
     (GuiMainMenu Hj is declared as a class in thunder-title.js.)
  ------------------------------------------------------------------------------------------- */
  var SO_STORE='thunderSocial_v1',SO_CHATS='thunderSocialChats_v1';
  var SO_KEEP=60,SO_CONVOS=40;          // messages kept per friend, friends with a chat kept
  var SO={state:'off',msg:'',ws:null,id:'',key:'',me:null,friends:{},reqIn:[],reqOut:[],blocked:[],
    online:null,onlineAt:0,chats:{},unread:{},sel:'',retry:0,retryAt:0,connAt:0,pinged:0,heard:0,seq:Date.now(),lastS:'',lastName:'',
    lastListed:null,lastShare:null,addMsg:'',addOk:false,ver:0,cver:0,over:0,saveT:0,probe:null,fatal:'',connecting:false,arm:{},onToast:{}};
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
  function soName(){var n=lanMyName();return /^[A-Za-z0-9_]{1,16}$/.test(n)?n:'Player';}
  // the game has read the saved profile (it uses a stand-in name until then): its first menu is up
  function soGameUp(){return !!(HEN&&BOOT.frames>=3&&lanMyName());}
  function soTagged(p){return p?(p.name||'Player')+'#'+(p.tag||'0000'):'';}

  // ---- chats kept in this browser ------------------------------------------------------------
  function soLoadChats(){
    try{
      var o=JSON.parse(W.localStorage.getItem(SO_CHATS)||'{}');
      if(o&&typeof o==='object'){SO.chats=o.c&&typeof o.c==='object'?o.c:{};SO.unread=o.u&&typeof o.u==='object'?o.u:{};}
    }catch(_){SO.chats={};SO.unread={};}
    soUnsure();                         // the page closed before the hub answered
  }
  // messages the hub never answered (the connection closed first): they may or may not have arrived
  function soUnsure(){
    var id,l,i,n=0;
    for(id in SO.chats){l=SO.chats[id];if(!l||!l.length)continue;for(i=0;i<l.length;i++)if(l[i]&&l[i].w==='out'&&l[i].st==='sending'){l[i].st='unsure';n++;}}
    if(n){SO.cver++;soSaveChats();}
  }
  function soSaveChats(){
    if(SO.saveT)return;
    SO.saveT=W.setTimeout(function(){
      SO.saveT=0;
      // only the friends talked to most recently
      var ids=Object.keys(SO.chats).sort(function(a,b){return soLastAt(b)-soLastAt(a);});
      for(var i=SO_CONVOS;i<ids.length;i++){delete SO.chats[ids[i]];delete SO.unread[ids[i]];}
      try{W.localStorage.setItem(SO_CHATS,JSON.stringify({c:SO.chats,u:SO.unread}));}catch(_){}
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
  function soUrl(){
    try{
      var u=new W.URL('social',W.location.href);
      if(!/^https?:$/.test(u.protocol))return '';
      u.protocol=u.protocol==='https:'?'wss:':'ws:';u.search='?id='+SO.id;u.hash='';
      return u.href;
    }catch(_){return '';}
  }
  // Does this site have the hub? (/social answers {"social":true}; a site without it answers 404)
  function soProbe(){
    if(SO.probe)return SO.probe;
    SO.probe=new Promise(function(done){
      var u;
      try{u=new W.URL('social',W.location.href);}catch(_){done('none');return;}
      if(!/^https?:$/.test(u.protocol)||!W.fetch){done('none');return;}
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
    SO.connecting=true;
    soIdentity().then(function(){return soProbe();}).then(function(r){
      SO.connecting=false;
      if(!S.socialOn||SO.ws)return;
      if(r==='none'){soSet('none','this site has no Thunder Friends hub');return;}
      if(r==='error'){soRetry('the site could not be reached');return;}
      var url=soUrl(),ws;
      if(!url){soSet('none','this page is not on a website');return;}
      try{ws=new W.WebSocket(url);}catch(e){soRetry('could not connect');return;}
      SO.ws=ws;SO.connAt=now();soSet('connecting','');
      ws.onopen=function(){
        if(SO.ws!==ws)return;
        var s=soActivity();
        SO.lastS=JSON.stringify(s);SO.lastName=soName();SO.lastListed=!!S.socialListed;SO.lastShare=!!S.socialShare;
        soSend({t:'hello',key:SO.key,name:SO.lastName,hide:!S.socialListed,share:!!S.socialShare,s:s});
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
        if(SO.fatal){soSet('error',SO.fatal);return;}
        if(!S.socialOn){soSet('off','');return;}
        soRetry(SO.state==='on'?'the connection closed':'could not connect');
      };
      ws.onerror=function(){};
    },function(e){SO.connecting=false;SO.fatal=String(e&&e.message||e);soSet('error',SO.fatal);});
  }
  function soRetry(why){
    var waits=[2000,5000,10000,20000,40000,60000];
    SO.retryAt=now()+waits[Math.min(SO.retry,waits.length-1)];
    SO.retry++;
    soSet('retry',why);
  }
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
  function soActivity(){
    try{
      if(LJ.active||LJ.state==='joining'||LJ.state==='playing')return {w:'join'};
      if(LH.state==='open'&&LH.code)return {w:'host',code:LH.code};
      if(HEN&&HEN.X){
        if(lanWorldRunning())return {w:'sp'};
        var nm=HEN.v&&HEN.v.d9&&HEN.v.d9.qf,addr=nm&&nm.bR3?String($rt_ustr(nm.bR3)):'';
        if(addr&&addr.indexOf('~!')!==0)return {w:'server',server:addr.replace(/^wss?:\/\//i,'').replace(/\/+$/,'').slice(0,80)};
        return {w:'server'};
      }
    }catch(_){}
    return {w:'menu'};
  }
  function soDoing(f){
    if(!f||!f.online)return 'Offline';
    var s=f.s;
    if(!s)return 'Online';
    switch(s.w){
      case 'host':return 'Has a world open'+(s.code?' \u2022 '+s.code:'');
      case 'sp':return 'Playing singleplayer';
      case 'join':return 'In a friend\'s world';
      case 'server':return s.server?'On '+s.server:'On a server';
      default:return 'In the menus';
    }
  }
  function soHosting(f){return !!(f&&f.online&&f.s&&f.s.w==='host'&&f.s.code);}

  // ---- what the hub says ---------------------------------------------------------------------
  function soDrop(list,id){for(var i=list.length-1;i>=0;i--)if(list[i].id===id)list.splice(i,1);}
  function soOn(m){
    switch(m.t){
      case 'welcome':{
        SO.me=m.me;SO.friends={};SO.retry=0;
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
        f.online=!!m.online;f.s=m.s||null;f.name=m.name;f.tag=m.tag;
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
          if(m.why==='wrong key'||m.why==='bad key')SO.fatal='this browser\'s Thunder Friends key was refused';
          else if(m.why==='opened in another tab')SO.fatal='Thunder Friends is open in other tabs; reload this one to use it here';
          return;
        }
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
    if(!who){SO.addMsg='Type their name and tag, like Steve#1234.';SO.addOk=false;soChanged();return;}
    if(!soSend({t:'add',who:who})){SO.addMsg='Thunder Friends is not connected right now.';SO.addOk=false;soChanged();return;}
    SO.addMsg='';soChanged();
  }
  function soAct(t,id){if(/^[0-9a-f]{24}$/.test(id||''))soSend({t:t,id:id});}
  function soInvite(id){
    if(!(LH.state==='open'&&LH.code)){soSys(id,'Open your world to friends first (Esc \u2192 Open to Friends).');return;}
    // the hub needs to know the world is open before it passes the invite on
    soStatusNow();
    soSend({t:'invite',to:id});
  }
  function soJoin(code){
    var why=lanJoinBlocker();
    if(why){soToast({kind:'info',title:'Cannot join yet',text:why.charAt(0).toUpperCase()+why.slice(1)+'.',quiet:true});return false;}
    if(menuOpen)hideMenu();
    lanJoin(code);
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
      if(!soReady())return;
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
      var nm=soName();
      if(nm!==SO.lastName){SO.lastName=nm;soSend({t:'name',name:nm});if(SO.me){SO.me.name=nm;soChanged();}}
      if(!!S.socialListed!==SO.lastListed){SO.lastListed=!!S.socialListed;soSend({t:'hide',v:!S.socialListed});}
      if(!!S.socialShare!==SO.lastShare){SO.lastShare=!!S.socialShare;soSend({t:'share',v:!!S.socialShare});}
      soStatusNow();
      soWorlds();
    }catch(e){report(e);}
  },1000);

  // ---- pop-ups (top right) -------------------------------------------------------------------
  var SO_CSS=[
    '#thunder-toasts{position:fixed;top:38px;right:10px;z-index:2147483100;display:flex;flex-direction:column;gap:8px;width:290px;max-width:calc(100vw - 20px);pointer-events:none}',
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
    '.tcs-more{display:flex;gap:6px;flex-wrap:wrap;padding:6px 9px;border-bottom:1px solid rgba(110,140,160,.14)}',
    '.tcs-rows{display:flex;flex-direction:column;gap:4px;margin-top:6px;max-height:260px;overflow-y:auto}',
    '.tcs-row{display:flex;align-items:center;gap:8px;padding:5px 9px;border-radius:8px;background:rgba(3,7,12,.42);color:#dff6ff;font-size:12px}',
    '.tcs-row span{flex:1;min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}',
    '.tcs-row em{font-style:normal;font-size:10.5px;color:#7c95a8}',
    // friends' worlds on the Singleplayer / Multiplayer screens
    '#thunder-fworlds{position:fixed;top:10px;left:10px;z-index:2147483000;width:250px;max-width:calc(100vw - 20px);padding:9px 10px;border-radius:12px;',
      'background:rgba(8,14,22,.9);border:1px solid rgba(79,209,255,.42);color:#e8f6ff;font:12px/1.4 system-ui,-apple-system,Segoe UI,sans-serif;',
      'box-shadow:0 6px 24px rgba(0,0,0,.45),0 0 14px rgba(79,209,255,.16)}',
    '#thunder-fworlds h4{margin:0 0 6px;font-size:10px;letter-spacing:.12em;text-transform:uppercase;color:#7fdcff}',
    '#thunder-fworlds .tcs-row{background:rgba(3,7,12,.5)}',
    '#thunder-fworlds.tcs-bar{top:5px;left:6px;width:auto;max-width:44vw;display:flex;align-items:center;gap:8px;padding:3px 4px 3px 10px;border-radius:999px;font-size:11px}',
    '#thunder-fworlds.tcs-bar span{white-space:nowrap;overflow:hidden;text-overflow:ellipsis}',
    '#thunder-fworlds.tcs-bar .tcs-btn{padding:2px 9px}'
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
  // o: {kind, title, text, id (a friend: click opens the chat), code (an invite: Join), req (a
  // request: Accept / Decline), quiet (shorter)}
  function soToast(o){
    if(!D.body)return;
    soCss();
    if(!soToastBox){soToastBox=el('div');soToastBox.id='thunder-toasts';D.body.appendChild(soToastBox);}
    while(soToastBox.children.length>=4)soToastBox.removeChild(soToastBox.firstChild);
    var t=el('div','tct'+(o.id?' tct-click':''));
    t.appendChild(el('b',null,o.title||''));
    if(o.text)t.appendChild(el('p',null,o.text));
    var act=null;
    if(o.code){act=el('div','tct-act');act.appendChild(soBtn('Join',function(){if(soJoin(o.code))gone();},true));}
    if(o.req){
      act=el('div','tct-act');
      act.appendChild(soBtn('Accept',function(){soAct('accept',o.req);gone();},true));
      act.appendChild(soBtn('Decline',function(){soAct('decline',o.req);gone();}));
    }
    if(act)t.appendChild(act);
    // in a world the mouse belongs to the game: say which key opens the chat
    if(HEN&&HEN.X&&HEN.cm===null&&!menuOpen&&o.kind!=='info'&&S.socialOn)t.appendChild(el('i',null,'Press '+keyLabel(S.socialKey||'KeyO')+' to open the chat'));
    if(o.id)t.addEventListener('click',function(){soShowChat(o.id);gone();});
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
        var inp=D.getElementById('tcs-say');
        if(inp&&!inp.disabled)inp.focus();
      }catch(_){}
    },50);
  }
  function soStatusLine(){
    switch(SO.state){
      case 'on':return ['tcm-ok','Online',soTagged(SO.me)+(S.socialListed?'':' \u2022 hidden from On Thunder now')];
      case 'connecting':return ['tcm-warn','Connecting',''];
      case 'retry':return ['tcm-warn','Offline',(SO.msg?SO.msg+'; ':'')+'trying again in '+Math.max(1,Math.ceil((SO.retryAt-now())/1000))+' s'];
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
      return (fb.online-fa.online)||((SO.unread[b]|0)-(SO.unread[a]|0))||String(fa.name).localeCompare(String(fb.name));
    });
  }
  // the chat card: you, add a friend, requests, friends (left); the chat with one friend (right)
  SPECIALS.socialchat=function(box){
    soCss();lanCss();
    var wrap=el('div','tcs-chat'),side=el('div','tcs-side'),main=el('div','tcs-main');
    wrap.appendChild(side);wrap.appendChild(main);box.appendChild(wrap);
    // you, and whether Thunder Friends is connected
    var me=el('div','tcs-me'),meDot=el('span','tcm-dot'),meTxt=el('span','tcs-me-t');
    me.appendChild(meDot);
    var copy=soBtn('Copy',function(){
      function said(t){copy.textContent=t;W.setTimeout(function(){copy.textContent='Copy';},1200);}
      try{W.navigator.clipboard.writeText(soTagged(SO.me)).then(function(){said('Copied');},function(){said('Not copied');});}catch(_){said('Not copied');}
    });
    me.appendChild(meTxt);me.appendChild(copy);side.appendChild(me);
    // add a friend
    var addRow=el('div','tcs-in'),addIn=el('input'),addB=soBtn('Add',function(){soAddFriend(addIn.value);},true);
    addIn.type='text';addIn.placeholder='Friend\'s Name#1234';addIn.maxLength=40;addIn.spellcheck=false;addIn.autocomplete='off';
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
      copy.style.display=SO.state==='on'&&SO.me?'':'none';
      if(SO.addClear){SO.addClear=false;addIn.value='';}
      addIn.disabled=addB.disabled=!soReady();
      addNote.textContent=SO.addMsg||(SO.me?'Friends add you with '+soTagged(SO.me)+'.':'');
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
    var say=el('input'),sayB=soBtn('Send',function(){doSend();},true);
    say.id='tcs-say';say.type='text';say.maxLength=300;say.spellcheck=true;say.autocomplete='off';
    function doSend(){if(SO.sel&&soMsg(SO.sel,say.value))say.value='';}
    soKeepKeys(say,doSend);
    send.appendChild(say);send.appendChild(sayB);
    main.appendChild(head);main.appendChild(more);main.appendChild(msgs);main.appendChild(send);
    var moreOpen=false,chatVer=-1,chatSel=null,chatReady=null;
    function paintHead(){
      while(head.firstChild)head.removeChild(head.firstChild);
      while(more.firstChild)more.removeChild(more.firstChild);
      var f=SO.friends[SO.sel];
      more.style.display=f&&moreOpen?'':'none';
      if(!f){head.appendChild(el('div','tcs-note','Chats'));return;}
      head.appendChild(el('span','tcs-dot'+(soHosting(f)?' tcs-host':f.online?' tcs-on':'')));
      var fn=el('div','tcs-fn');fn.appendChild(el('b',null,soTagged(f)));fn.appendChild(el('i',null,soDoing(f)));head.appendChild(fn);
      if(soHosting(f))head.appendChild(soBtn('Join',function(){soJoin(f.s.code);},true));
      if(LH.state==='open'&&LH.code&&f.online)head.appendChild(soBtn('Invite',function(){soInvite(f.id);}));
      head.appendChild(soBtn(moreOpen?'Less':'More',function(){moreOpen=!moreOpen;paintHead();}));
      more.appendChild(armBtn('Remove friend','Click again to remove',function(){soAct('remove',f.id);},'remove:'+f.id));
      more.appendChild(armBtn('Block','Click again to block',function(){soAct('block',f.id);},'block:'+f.id));
    }
    function ids0(){return Object.keys(SO.friends).length>0;}
    // a button that asks for a second click
    // (the list is rebuilt when anything changes: the armed state is kept by key meanwhile)
    function armBtn(label,armed,fn,key){
      var b=soBtn(label,function(){if(!SO.arm[key]){SO.arm[key]=1;b.textContent=armed;return;}delete SO.arm[key];fn();});
      if(SO.arm[key])b.textContent=armed;
      b.addEventListener('mouseleave',function(){delete SO.arm[key];b.textContent=label;});
      return b;
    }
    function msgEl(m){
      var d=el('div','tcs-m'+(m.w==='out'?' tcs-out':m.w==='sys'?' tcs-sys':''));
      d.appendChild(D.createTextNode(m.text));
      if(m.w==='sys'&&m.code){
        var jb=soBtn('Join',function(){soJoin(m.code);},true);
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
      // rebuilt only when something changed, so clicks and typing are never lost
      if(listVer!==SO.ver||listSel!==SO.sel||SO.state==='retry'){listVer=SO.ver;listSel=SO.sel;paintSide();paintHead();}
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
      if(!soReady()){info.textContent='Thunder Friends is not connected.';return;}
      if(!o){info.textContent='Looking\u2026';return;}
      var hidden=o.total-o.list.length;
      info.textContent=o.total?o.total+(o.total===1?' other player':' other players')+' on Thunder now'+(hidden>0?' ('+hidden+' not shown: hidden or blocked)':'')+'.':'Nobody else is on Thunder right now.';
      o.list.forEach(function(p){rows.appendChild(row(p));});
    });
  };

  // ---- the friends' worlds panel (Singleplayer and Multiplayer screens) ------------------------
  var soWorldsBox=null,soWorldsKey='';
  function soWorlds(){
    var scr=HEN&&HEN.cm,show=!!(scr&&(scr instanceof A_3||scr instanceof OG))&&!menuOpen&&soReady(),list=[];
    if(show){for(var id in SO.friends)if(soHosting(SO.friends[id]))list.push(SO.friends[id]);}
    if(!list.length)show=false;
    if(!show){if(soWorldsBox)soWorldsBox.style.display='none';soWorldsKey='';return;}
    soCss();
    if(!soWorldsBox){soWorldsBox=el('div');soWorldsBox.id='thunder-fworlds';D.body.appendChild(soWorldsBox);}
    soWorldsBox.style.display='';
    // a narrow window: the screen's list fills its width, so a one-line bar in the empty top strip
    var bar=W.innerWidth<900;
    var key=(bar?'b':'p')+list.map(function(f){return f.id+f.s.code+f.name;}).join('|');
    if(key===soWorldsKey)return;
    soWorldsKey=key;
    while(soWorldsBox.firstChild)soWorldsBox.removeChild(soWorldsBox.firstChild);
    soWorldsBox.className=bar?'tcs-bar':'';
    if(bar){
      var one=list.length===1;
      soWorldsBox.appendChild(el('span',null,one?list[0].name+'\'s world is open':list.length+' friends\' worlds are open'));
      soWorldsBox.appendChild(one?soBtn('Join',function(){soJoin(list[0].s.code);},true):soBtn('See',function(){soShowChat('');},true));
      return;
    }
    soWorldsBox.appendChild(el('h4',null,'Friends\' worlds'));
    list.sort(function(a,b){return String(a.name).localeCompare(String(b.name));}).forEach(function(f){
      var r=el('div','tcs-row');r.style.marginTop='4px';
      r.appendChild(el('span',null,f.name+'\'s world'));
      r.appendChild(soBtn('Join',function(){soJoin(f.s.code);},true));
      soWorldsBox.appendChild(r);
    });
  }
  frameTasks.push(function(){if(soWorldsBox||soReady())soWorlds();});

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
      desc:'Add friends by name and tag, chat, see what they are playing and join worlds they open. The chat key (O) opens this in a world.'},
    SO_MOD_ONLINE={cat:'friends',id:null,name:'On Thunder now',wide:true,special:'socialonline',
      desc:'Everyone on Thunder Client right now who shows in this list. Add them as friends.'},
    SO_MOD_SET={cat:'friends',id:'socialOn',name:'Thunder Friends settings',wide:true,always:true,
      desc:'Connects to this site\'s friends hub. Who you are is a secret key kept in this browser, and your chats stay in it too.',
      onChange:function(v){if(v){SO.fatal='';SO.retry=0;soSet('off','');soConnect();}else soDisconnect();},
      opts:[{id:'socialListed',name:'Show me in On Thunder now'},
        {id:'socialShare',name:'Show friends what I am playing (and the code of a world I open)'},
        {id:'socialToasts',name:'Pop-ups for messages, requests and invites'},
        {id:'socialOnlineToasts',name:'Pop-up when a friend comes online'},
        {id:'socialKey',name:'Chat key',key:true,mouse:false}]};
  (function(){
    var i=MODULES.indexOf(LAN_MOD_OPEN),j=MODULES.indexOf(LAN_MOD_JOIN);
    if(i<0||j<0){MODULES.push(SO_MOD_CHAT,SO_MOD_ONLINE,SO_MOD_SET);return;}
    MODULES.splice(Math.max(i,j)+1,0,SO_MOD_ONLINE,SO_MOD_SET);
    MODULES.splice(Math.min(i,j),0,SO_MOD_CHAT);
  })();

  soLoadChats();
  // for tests and the console
  TC.social={state:SO,connect:soConnect,disconnect:soDisconnect,add:soAddFriend,msg:soMsg,act:soAct,invite:soInvite,
    join:soJoin,online:soAskOnline,show:soShowChat,toast:soToast,activity:soActivity};
