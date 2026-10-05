  /* -------------------------------------------------------------------------------------------
     Part of Thunder Client, created and owned by Jayvardhan Ginni (ThunderGamey).
     Settings Sync (Right Shift > Friends > Thunder Friends settings > "Settings follow my
     account"). Included into the client scope of thunder-client.js by build.js, after
     thunder-social.js, whose connection it uses.
     While you are signed in to Thunder Friends, your settings are kept with your account, so
     they are the same on every computer you sign in on:
       - Thunder's settings (every module, its options and keys), except what depends on how fast
         the computer is: shaders, See-through Leaves, the title screen quality (and whether
         Thunder Friends itself is on);
       - the HUD layout, the Auto GG text, and waypoints on servers;
       - the game's options that are about you, not the computer: key bindings, mouse
         sensitivity, FOV, sounds, chat, skin layers, main hand, auto-jump...; never render
         distance, graphics, VSync, GUI scale, language or resource packs;
       - the multiplayer server list.
     Each setting is a key ("s.zoomKey", "g.key_key.jump", "h.fps", "w.mp:<server>@0",
     "x.servers") with a value and when it was changed (on the hub's clock); per key the newest
     wins. The first time a computer signs in to an account, the account's settings replace the
     ones here, and what the account does not have yet is added to it. Changes here are noticed
     every two seconds and sent once they rest; changes from another open computer come in at
     once. Game options are written into the game's saved options, which the game then reads
     again (GameSettings.loadOptions, which also refreshes the key bindings). A server list or
     HUD box that is open for editing is changed once it is closed. This browser keeps only, per
     key, when it last changed and a short hash ("thunderSync_v1"), never the values.

     Game functions it uses:
     @use DBv net.minecraft.client.settings.GameSettings.loadOptions
     (Minecraft.gameSettings G and GuiMultiplayer OG are declared in thunder-client.js and
     thunder-social.js.)
     ------------------------------------------------------------------------------------------- */
  var SY_STORE='thunderSync_v1',SY_GAMEKEY='_eaglercraft_1.12.g',SY_SERVERS='_eaglercraft_1.12.s';
  // Thunder settings that stay on each computer (they depend on how fast it is)
  var SY_LOCAL=/^(?:sh[A-Z].*|shaders|clearLeaves|titleQuality|socialOn|syncSettings)$/;
  // the game's options that are about the player, not the computer
  var SY_GAME=/^(?:key_.+|soundCategory_.+|modelPart_.+|invertYMouse|mouseSensitivity|fov|bobView|difficulty|chat(?:Visibility|Colors|Links|LinksPrompt|Opacity|HeightFocused|HeightUnfocused|Scale|Width)|advancedItemTooltips|heldItemTooltips|mainHand|attackIndicator|showSubtitles|autoJump|hideServerAddress|reducedDebugInfo|pauseOnLostFocus)$/;
  var SY_KEY=/^[a-z]\.[A-Za-z0-9_.:@,\/\-]{1,160}$/;   // what the hub takes as a key
  var SY={aid:'',at:{},h:{},skew:0,dirty:{},ready:false,first:false,changeAt:0,saveT:0,lastIn:0,lastOut:0,msg:'',
    pendGame:null,gameFlight:null,loadNow:false,pendHud:null,pendSrv:null,changedS:false,changedHud:false};

  function syLs(k){try{return W.localStorage.getItem(k);}catch(_){return null;}}
  (function(){
    try{
      var o=JSON.parse(syLs(SY_STORE)||'null');
      if(o&&typeof o==='object'&&typeof o.aid==='string'){
        SY.aid=o.aid;SY.at=o.at&&typeof o.at==='object'?o.at:{};SY.h=o.h&&typeof o.h==='object'?o.h:{};SY.skew=Number(o.skew)||0;
      }
    }catch(_){}
  })();
  function sySave(){
    if(SY.saveT){W.clearTimeout(SY.saveT);SY.saveT=0;}
    try{W.localStorage.setItem(SY_STORE,JSON.stringify({aid:SY.aid,at:SY.at,h:SY.h,skew:SY.skew}));}catch(_){}
  }
  function sySaveSoon(){if(!SY.saveT)SY.saveT=W.setTimeout(sySave,3000);}
  function syNow(){return Date.now()+(SY.skew||0);}
  // a short hash of a value (FNV-1a and the length): enough to tell whether it changed
  function syHash(s){var h=0x811c9dc5,i;for(i=0;i<s.length;i++){h^=s.charCodeAt(i);h=Math.imul(h,0x01000193);}return (h>>>0).toString(36)+'.'+s.length;}

  // ---- the settings on this computer, as keys and values ----
  function syGameText(){var b=syLs(SY_GAMEKEY);if(!b)return null;try{return W.atob(b);}catch(_){return null;}}
  function syGameOpts(t){var o={};if(t)t.split('\n').forEach(function(l){var i=l.indexOf(':');if(i>0)o[l.slice(0,i)]=l.slice(i+1);});return o;}
  function syLocal(){
    var L={},id,k,o;
    for(id in DEFAULTS)if(!SY_LOCAL.test(id))L['s.'+id]=JSON.stringify(S[id]);
    o=syGameOpts(syGameText());
    for(k in o)if(SY_GAME.test(k))L['g.'+k]=o[k];
    HUD_WIDGETS.forEach(function(w){L['h.'+w.id]=JSON.stringify(hudLayout[w.id]||null);});
    o=wptLoad();
    for(k in o)if(k.indexOf('mp:')===0&&Array.isArray(o[k])&&SY_KEY.test('w.'+k))L['w.'+k]=JSON.stringify(o[k]);
    L['x.autogg']=syLs(CT_GG_KEY)||'';
    L['x.servers']=syLs(SY_SERVERS)||'';
    return L;
  }
  // a value from the account that is waiting to be used here (it is not a change made here)
  function syPending(k){
    var t=k.charAt(0),id=k.slice(2);
    if(t==='g')return !!((SY.pendGame&&Object.prototype.hasOwnProperty.call(SY.pendGame,id))||(SY.gameFlight&&Object.prototype.hasOwnProperty.call(SY.gameFlight,id)));
    if(t==='h')return !!(SY.pendHud&&Object.prototype.hasOwnProperty.call(SY.pendHud,id));
    return k==='x.servers'&&SY.pendSrv!==null;
  }

  // ---- using a value from the account here ----
  function syOpt(id){
    for(var i=0;i<MODULES.length;i++){
      var m=MODULES[i];
      if(m.id===id)return m;
      if(m.opts)for(var j=0;j<m.opts.length;j++)if(m.opts[j].id===id)return m.opts[j];
    }
    return null;
  }
  function syApplyS(id,v){
    if(!Object.prototype.hasOwnProperty.call(DEFAULTS,id)||SY_LOCAL.test(id))return false;
    var x,d=DEFAULTS[id],o=syOpt(id);
    try{x=JSON.parse(v);}catch(_){return false;}
    if(typeof d==='number'){
      if(typeof x!=='number'||!isFinite(x))return false;
      if(o&&(o.choices||o.colors))x=clamp(Math.round(x),0,(o.choices||o.colors).length-1);
      else if(o&&o.min!=null&&o.max!=null)x=clamp(x,o.min,o.max);
    }else if(typeof d==='boolean'){if(typeof x!=='boolean')return false;}
    else if(typeof d==='string'){if(typeof x!=='string'||!/^[A-Za-z0-9]{1,24}$/.test(x))return false;}
    else return false;
    if(S[id]===x)return true;
    S[id]=x;SY.changedS=true;
    if(o&&o.onChange){try{o.onChange(x);}catch(e){report(e);}}
    return true;
  }
  function syApplyG(id,v){
    if(!SY_GAME.test(id)||!/^[A-Za-z0-9_.\-]{0,40}$/.test(v))return false;
    (SY.pendGame||(SY.pendGame={}))[id]=v;
    return true;
  }
  // the game's saved options get the account's values, and the game reads them again (on its
  // own thread; its key bindings are refreshed by that too)
  function syFlushGame(){
    if(!SY.pendGame||SY.gameFlight||!HEN||!HEN.G||syLs(SY_GAMEKEY)===null)return;
    var pend=SY.pendGame;SY.pendGame=null;SY.gameFlight=pend;
    runOnGame([function(){
      var t=syGameText();
      SY.loadNow=false;
      if(t===null)return;
      var lines=t.split('\n'),seen={},i,c,k;
      for(i=0;i<lines.length;i++){
        c=lines[i].indexOf(':');
        if(c>0){k=lines[i].slice(0,c);if(Object.prototype.hasOwnProperty.call(pend,k)){lines[i]=k+':'+pend[k];seen[k]=1;}}
      }
      for(k in pend)if(!seen[k])lines.splice(lines[lines.length-1]===''?lines.length-1:lines.length,0,k+':'+pend[k]);
      try{W.localStorage.setItem(SY_GAMEKEY,W.btoa(lines.join('\n')));SY.loadNow=true;}catch(_){}
    },function(){if(SY.loadNow)DBv(HEN.G);},function(){
      if(!SY.loadNow){var p=SY.pendGame||{},k2;for(k2 in pend)if(!Object.prototype.hasOwnProperty.call(p,k2))p[k2]=pend[k2];SY.pendGame=p;}
      SY.loadNow=false;SY.gameFlight=null;
    }]);
  }
  function syHudOk(x){
    return x===null||(!!x&&typeof x==='object'&&!Array.isArray(x)&&typeof x.ax==='number'&&typeof x.ay==='number'&&x.ax>=0&&x.ax<=1&&x.ay>=0&&x.ay<=1&&
      (x.s==null||(typeof x.s==='number'&&x.s>=0.5&&x.s<=3)));
  }
  function syApplyH(id,v){
    var x;
    if(!HUD_WIDGETS.some(function(w){return w.id===id;}))return false;
    try{x=JSON.parse(v);}catch(_){return false;}
    if(!syHudOk(x))return false;
    // (the HUD editor is open: used once it closes, unless that box was moved meanwhile)
    if(hudEditing){
      var ph=SY.pendHud||(SY.pendHud={});
      ph[id]={x:x,was:ph[id]?ph[id].was:JSON.stringify(hudLayout[id]||null)};
      return true;
    }
    if(x===null)delete hudLayout[id];else hudLayout[id]=x;
    SY.changedHud=true;
    return true;
  }
  function syApplyW(key,v){
    var x;
    if(key.indexOf('mp:')!==0)return false;
    try{x=JSON.parse(v);}catch(_){return false;}
    if(!Array.isArray(x)||x.length>200)return false;
    for(var i=0;i<x.length;i++){
      var w=x[i];
      if(!w||typeof w!=='object'||typeof w.n!=='string'||w.n.length>64||!isFinite(w.x)||!isFinite(w.y)||!isFinite(w.z))return false;
    }
    var all=wptLoad();all[key]=x;wptSave();
    return true;
  }
  function syPutServers(v){try{if(v)W.localStorage.setItem(SY_SERVERS,v);else W.localStorage.removeItem(SY_SERVERS);}catch(_){}}
  function syApply(k,v){
    var t=k.charAt(0),id=k.slice(2);
    if(t==='s')return syApplyS(id,v);
    if(t==='g')return syApplyG(id,v);
    if(t==='h')return syApplyH(id,v);
    if(t==='w')return syApplyW(id,v);
    if(k==='x.autogg'){
      if(v.length>100)return false;
      try{if(v)W.localStorage.setItem(CT_GG_KEY,v);else W.localStorage.removeItem(CT_GG_KEY);}catch(_){}
      return true;
    }
    if(k==='x.servers'){
      if(v&&!/^[A-Za-z0-9+\/=]{1,12000}$/.test(v))return false;
      // (the Multiplayer screen reads the list when it opens and saves it on changes)
      // (used once the screen closes, unless the list was changed there meanwhile)
      if(HEN&&HEN.cm instanceof OG)SY.pendSrv={v:v,was:SY.pendSrv?SY.pendSrv.was:syLs(SY_SERVERS)||''};else syPutServers(v);
      return true;
    }
    return false;
  }
  // what waited for a screen to close, and what changed Thunder's settings or the HUD
  function syAfter(){
    // (something changed here while it waited is newer, and the next look sends it instead)
    if(SY.pendSrv!==null&&!(HEN&&HEN.cm instanceof OG)){
      var ps=SY.pendSrv;SY.pendSrv=null;
      if((syLs(SY_SERVERS)||'')===ps.was)syPutServers(ps.v);
    }
    if(SY.pendHud&&!hudEditing){
      var p=SY.pendHud,id;SY.pendHud=null;
      for(id in p){
        if(JSON.stringify(hudLayout[id]||null)!==p[id].was)continue;
        if(p[id].x===null)delete hudLayout[id];else hudLayout[id]=p[id].x;
        SY.changedHud=true;
      }
    }
    if(SY.changedHud){SY.changedHud=false;hudSave();}
    if(SY.changedS){SY.changedS=false;save();if(menuOpen)render();}
    syFlushGame();
  }
  // one key from the account: newest wins. Returns true when it changed something here.
  function syTake(k,v,at,L){
    if(typeof k!=='string'||typeof v!=='string'||!isFinite(at)||!SY_KEY.test(k))return false;
    var hv=syHash(v),known=SY.h[k]!==undefined;
    if(known&&at<SY.at[k]){if(hv!==SY.h[k])SY.dirty[k]=1;return false;}     // the one here is newer: it goes up
    if(known&&at===SY.at[k]&&hv===SY.h[k])return false;
    SY.at[k]=at;SY.h[k]=hv;delete SY.dirty[k];
    if(L&&L[k]===v)return false;
    return syApply(k,v);
  }

  // ---- noticing changes made here, and sending them ----
  function syScan(){
    var L=syLocal(),k,h,t=syNow(),n=0,ns=0;
    for(k in L){
      if(syPending(k))continue;
      h=syHash(L[k]);
      if(SY.h[k]===h)continue;
      if(SY.h[k]===undefined&&!SY.ready)continue;     // (never synced here: signing in decides)
      SY.h[k]=h;SY.at[k]=t;SY.dirty[k]=1;n++;
      if(k.charAt(0)==='s')ns++;
    }
    if(ns)save();      // (what is sent is also what this browser keeps)
    if(n){SY.changeAt=now();sySaveSoon();}
    return L;
  }
  function syPush(force){
    if(!soReady()||!SY.ready||!S.syncSettings)return;
    var keys=Object.keys(SY.dirty);
    if(!keys.length||(!force&&now()-SY.changeAt<1500))return;     // (a slider being dragged: once it rests)
    var L=syLocal(),frames=[],cur=[],size=24;
    keys.forEach(function(k){
      var v=L[k];
      delete SY.dirty[k];
      if(v===undefined||syPending(k)||!SY_KEY.test(k)||v.length>12000)return;   // (too big to follow the account)
      var it=[k,v,SY.at[k]||syNow()],len=JSON.stringify(it).length+1;
      if(len>15000)return;
      if(cur.length&&(size+len>15500||cur.length>=250)){frames.push(cur);cur=[];size=24;}
      cur.push(it);size+=len;
    });
    if(cur.length)frames.push(cur);
    for(var i=0;i<frames.length;i++){
      if(!soSend({t:'sync',set:frames[i]})){
        for(;i<frames.length;i++)frames[i].forEach(function(it){SY.dirty[it[0]]=1;});
        return;
      }
    }
    if(frames.length){SY.lastOut=Date.now();sySaveSoon();}
  }

  // ---- what the hub says ----
  // signed in (welcome) or asked again (syncall): the account's settings and this computer's
  // are put together
  function syWelcome(list){
    SY.ready=false;
    if(!S.syncSettings||!SO.me)return;
    if(SY.aid!==SO.me.id){SY.aid=SO.me.id;SY.at={};SY.h={};SY.dirty={};SY.first=true;}
    SY.skew=SO.skew||0;
    syScan();        // (changes made here while away get their time first)
    var L=syLocal(),seen={},n=0,k;
    (Array.isArray(list)?list:[]).forEach(function(it){
      if(!Array.isArray(it)||it.length!==3)return;
      seen[it[0]]=1;
      if(syTake(it[0],it[1],Number(it[2]),L))n++;
    });
    for(k in L)if(!seen[k]&&!syPending(k)){
      if(SY.h[k]===undefined){SY.h[k]=syHash(L[k]);SY.at[k]=syNow();}
      SY.dirty[k]=1;
    }
    syAfter();
    SY.ready=true;SY.lastIn=Date.now();SY.msg='';
    sySave();
    syPush(true);
    if(SY.first&&n&&S.socialToasts)soToast({kind:'info',title:'Settings',quiet:true,text:'Your settings came from your Thunder Friends account. Changes you make now follow you to every computer you sign in on.'});
    SY.first=false;
    if(n)soLog('settings from the account: '+n);
  }
  function syRemote(set){
    if(!S.syncSettings||!SY.ready||!Array.isArray(set))return;
    var L=syLocal(),n=0;
    set.forEach(function(it){if(Array.isArray(it)&&it.length===3&&syTake(it[0],it[1],Number(it[2]),L))n++;});
    syAfter();
    SY.lastIn=Date.now();
    sySaveSoon();
  }
  function syStop(){SY.ready=false;}
  W.setInterval(function(){
    try{
      if(!S.syncSettings||!SY.aid)return;
      syAfter();
      syScan();
      syPush(false);
    }catch(e){report(e);}
  },2000);

  // the switch: on again, the account is asked for its settings
  function sySwitched(on){
    if(on&&soReady()){SY.ready=false;soSend({t:'syncget'});}
    else if(!on)syStop();
    soChanged();
  }
  function syStatus(){
    if(!S.syncSettings)return ['','Off','your settings stay on this computer'];
    if(!soReady()||!SO.me)return ['tcm-warn','Waiting','your settings follow your account once you are signed in to Thunder Friends'];
    if(SY.msg)return ['tcm-bad','Account full',SY.msg];
    if(!SY.ready)return ['tcm-warn','Syncing',''];
    var last=Math.max(SY.lastIn,SY.lastOut),wait=Object.keys(SY.dirty).length;
    return ['tcm-ok','Synced with '+soTagged(SO.me),(wait?wait+' change'+(wait===1?'':'s')+' about to be sent':'up to date')+
      (last?' \u2022 last change '+new Date(last).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'}):'')];
  }
  SPECIALS.socialsync=function(box){lanStatusRow(box,syStatus);};
  var SY_MOD={cat:'friends',id:'syncSettings',name:'Settings Sync',wide:true,always:true,special:'socialsync',onChange:sySwitched,
    desc:'Your settings follow your Thunder Friends account: sign in on another computer and your Thunder settings, HUD layout, '+
      'key bindings, mouse, sound and chat options, server list and server waypoints are the same there, and a change on one '+
      'computer reaches the others in a few seconds. Shaders and video settings (render distance, graphics, VSync, GUI scale) '+
      'stay per computer.'};
  (function(){var i=MODULES.indexOf(SO_MOD_SET);if(i<0)MODULES.push(SY_MOD);else MODULES.splice(i+1,0,SY_MOD);})();
  TC.sync={state:function(){return {aid:SY.aid,ready:SY.ready,dirty:Object.keys(SY.dirty),lastIn:SY.lastIn,lastOut:SY.lastOut,msg:SY.msg,
    pend:{game:SY.pendGame,flight:SY.gameFlight,hud:SY.pendHud,srv:SY.pendSrv}};},local:syLocal,scan:syScan,push:syPush};
