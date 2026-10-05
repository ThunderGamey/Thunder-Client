  /* -------------------------------------------------------------------------------------------
     Part of Thunder Client, created and owned by Jayvardhan Ginni (ThunderGamey).
     Owner tools (Right Shift > Friends > Owner), for the reserved account ThunderGamey_ only.
     Included into the client scope of thunder-client.js by build.js, after thunder-social.js.
       - A badge shows by the owner's name everywhere (friends list, chat, parties, voice, On
         Thunder now). Everyone sees it; the hub marks the name (thunder-relay/social.js).
       - Owner powers need the owner key each session: the key is a private phrase the site owner
         set as the OWNER_KEY secret of the thunder-relay Worker. It is turned into a proof in this
         browser (SHA-256), so the key itself never leaves it, and is never stored. With powers the
         owner can ban a player (and their devices) from Thunder Friends with a reason, and unban;
         can wear the owner-only cosmetic; and can message any player, not only friends.
     The reserved name cannot be taken by anyone else even without the key: the hub refuses to
     register it unless the key is proven.
     (soSend, soReady, SO, soToast, soTagged, soCss, soBtn, soKeepKeys, armBtn-style buttons,
     el, now, keyLabel, MODULES, SPECIALS, runLive, menuOpen, currentCat and the menu helpers are
     declared in thunder-social.js / thunder-client.js.)
     ------------------------------------------------------------------------------------------- */
  var OW_NAME='thundergamey_';
  var OW={powers:false,bans:[],busy:false,msg:'',ok:false,banId:'',banName:'',banMsg:'',ver:0};
  function owChanged(){OW.ver++;if(menuOpen)runLive();}
  // signed in as the reserved owner account (the badge shows; powers may still be off)
  function owIsOwnerAcct(){return !!(SO.me&&String(SO.me.name||'').toLowerCase()===OW_NAME);}
  function owHasPowers(){return !!OW.powers&&owIsOwnerAcct();}
  // the owner badge by any name the hub marked, or the owner's own name
  function soIsOwner(p){return !!(p&&(p.owner||(p.name&&String(p.name).toLowerCase()===OW_NAME)));}
  function owBadge(){
    var b=el('span','tcs-owner');b.title='Thunder owner';b.innerHTML='<svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor"><path d="M13 2 4 14h6l-1 8 9-12h-6z"/></svg>';
    return b;
  }

  // the hub reset this account's owner state at sign-in (welcome): powers follow m.me.owner
  function owWelcome(me){
    OW.powers=!!(me&&me.owner);OW.busy=false;OW.msg='';OW.ok=false;OW.bans=[];OW.banId='';OW.banName='';OW.banMsg='';
    owChanged();
  }
  function owOn(m){
    switch(m.t){
      case 'owned':
        OW.busy=false;OW.powers=!!m.ok;OW.ok=!!m.ok;
        OW.msg=m.ok?'Owner tools are on.':'That owner key is wrong.';
        if(m.ok&&S.socialToasts)soToast({kind:'info',title:'Owner',text:'Owner tools are on for this session.',quiet:true});
        owChanged();return;
      case 'banlist':OW.bans=Array.isArray(m.bans)?m.bans:[];owChanged();return;
    }
  }
  // the owner key becomes a proof here (never stored); the hub checks it against its secret
  function owEnable(key){
    key=String(key||'');
    if(!key){OW.msg='Type your owner key.';owChanged();return;}
    if(!soReady()){OW.msg='Thunder Friends is not connected right now.';owChanged();return;}
    var cs=W.crypto&&W.crypto.subtle;
    if(!cs||!W.TextEncoder){OW.msg='This browser cannot use the owner key here.';owChanged();return;}
    OW.busy=true;OW.msg='';owChanged();
    cs.digest('SHA-256',new W.TextEncoder().encode('thunder-owner:'+key)).then(function(buf){
      var proof=Array.prototype.map.call(new Uint8Array(buf),function(x){return ('0'+x.toString(16)).slice(-2);}).join('');
      if(!soSend({t:'owner',proof:proof})){OW.busy=false;OW.msg='Thunder Friends is not connected right now.';owChanged();}
    },function(){OW.busy=false;OW.msg='This browser could not use that key.';owChanged();});
  }
  function owBan(id,reason){
    if(!owHasPowers())return;
    if(!/^[0-9a-f]{24}$/.test(id||'')){OW.banMsg='Pick a player to ban (from your friends or On Thunder now).';owChanged();return;}
    reason=String(reason||'').replace(/\s+/g,' ').trim().slice(0,200);
    soSend({t:'ban',id:id,reason:reason||'No reason given'});
    OW.banId='';OW.banName='';OW.banMsg='Banned.';owChanged();
  }
  function owUnban(id){if(owHasPowers()&&/^[0-9a-f]{24}$/.test(id||''))soSend({t:'unban',id:id});}
  // a Ban button elsewhere (a friend's chat, On Thunder now) brings the player here
  function owBanStart(id,name){
    if(!owHasPowers()||!/^[0-9a-f]{24}$/.test(id||''))return;
    OW.banId=id;OW.banName=name||'';OW.banMsg='';
    currentCat='friends';searchQuery='';
    if(searchInput)searchInput.value='';
    if(menuOpen)render();else showMenu();
    W.setTimeout(function(){try{var i=D.getElementById('tow-reason');if(i)i.focus();}catch(_){}},60);
  }

  // ---- Right Shift > Friends > Owner -----------------------------------------------------------
  var OW_CSS=[
    '.tcs-owner{display:inline-flex;align-items:center;justify-content:center;width:15px;height:15px;margin-left:5px;border-radius:4px;vertical-align:-2px;',
      'color:#061019;background:linear-gradient(135deg,#ffd84a,#ffb020);box-shadow:0 0 6px rgba(255,208,74,.5)}',
    '.tow-key{display:flex;gap:6px;flex-wrap:wrap;align-items:center;margin-top:6px}',
    '.tow-key input{flex:1;min-width:120px;height:30px;padding:0 10px;border-radius:8px;border:1px solid rgba(255,208,74,.4);background:rgba(3,7,12,.55);color:#eafaff;font:600 12px system-ui,sans-serif;outline:0}',
    '.tow-key input:focus{border-color:rgba(255,208,74,.8);box-shadow:0 0 0 3px rgba(255,208,74,.14)}',
    '.tow-ban{display:flex;gap:6px;flex-wrap:wrap;align-items:center;margin-top:8px}',
    '.tow-ban input{flex:1;min-width:120px;height:28px;padding:0 9px;border-radius:7px;border:1px solid rgba(120,150,175,.28);background:rgba(3,7,12,.55);color:#eafaff;font:600 12px system-ui,sans-serif;outline:0}',
    '.tow-rows{display:flex;flex-direction:column;gap:4px;margin-top:8px;max-height:200px;overflow-y:auto}',
    '.tow-row{display:flex;align-items:center;gap:8px;padding:5px 9px;border-radius:8px;background:rgba(3,7,12,.42);color:#dff6ff;font-size:12px}',
    '.tow-row span{flex:1;min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}',
    '.tow-row em{font-style:normal;font-size:10.5px;color:#9db4c6}'
  ].join('');
  function owCss(){
    if(D.getElementById('thunder-owner-style'))return;
    var st=D.createElement('style');st.id='thunder-owner-style';st.textContent=OW_CSS;
    (D.head||D.documentElement).appendChild(st);
  }
  SPECIALS.ownertools=function(box){
    soCss();owCss();
    var note=el('div','tcs-note'),body=el('div');
    box.appendChild(note);box.appendChild(body);
    // not signed in: the key box; signed in: the ban form and the ban list
    var keyWrap=el('div','tow-key'),keyIn=el('input'),keyB=soBtn('',function(){owEnable(keyIn.value);},true);
    keyIn.type='password';keyIn.maxLength=200;keyIn.placeholder='Owner key';keyIn.autocomplete='off';
    soKeepKeys(keyIn,function(){owEnable(keyIn.value);});
    keyWrap.appendChild(keyIn);keyWrap.appendChild(keyB);
    var keyMsg=el('div','tcs-note');
    var banWrap=el('div','tow-ban'),banWho=el('span','tcs-note'),reason=el('input'),banB=soBtn('Ban',function(){owBan(OW.banId,reason.value);reason.value='';},true),banX=soBtn('Clear',function(){OW.banId='';OW.banName='';OW.banMsg='';owChanged();});
    reason.id='tow-reason';reason.type='text';reason.maxLength=200;reason.placeholder='Reason (they see it)';reason.autocomplete='off';
    soKeepKeys(reason,function(){owBan(OW.banId,reason.value);reason.value='';});
    banWrap.appendChild(banWho);banWrap.appendChild(reason);banWrap.appendChild(banB);banWrap.appendChild(banX);
    var banMsg=el('div','tcs-note'),rows=el('div','tow-rows');
    [keyWrap,keyMsg,banWrap,banMsg,rows].forEach(function(n){body.appendChild(n);});
    var ver=-1;
    function paint(){
      var owner=owIsOwnerAcct();
      // hide the whole card for everyone who is not signed in as the owner account
      var card=box.closest?box.closest('.tcm-card'):null;
      if(card)card.style.display=owner?'':'none';
      if(!owner)return;
      var powers=owHasPowers();
      note.textContent=powers?'Owner tools are on for this session.':
        'You are signed in as the owner. Type your owner key to turn on owner tools (ban players, the owner cosmetic). The key is never stored.';
      keyWrap.style.display=powers?'none':'';
      keyB.textContent=OW.busy?'Checking\u2026':'Turn on owner tools';
      keyB.disabled=keyIn.disabled=!!OW.busy;
      keyMsg.textContent=OW.msg;keyMsg.style.display=OW.msg?'':'none';
      keyMsg.className='tcs-note'+(OW.msg?(OW.ok?' tcs-ok':' tcs-bad'):'');
      banWrap.style.display=powers?'':'none';banMsg.style.display=powers&&(OW.banMsg||!OW.banId)?'':'none';
      banWho.textContent=OW.banId?'Ban '+(OW.banName||'this player')+':':'';
      banWho.style.display=OW.banId?'':'none';
      reason.style.display=banB.style.display=banX.style.display=OW.banId?'':'none';
      banMsg.textContent=OW.banMsg||(powers?'To ban someone, press Ban on their chat or in On Thunder now, then give a reason here.':'');
      while(rows.firstChild)rows.removeChild(rows.firstChild);
      if(powers){
        rows.appendChild(el('div','tcs-sec','Banned'+(OW.bans.length?' \u2022 '+OW.bans.length:'')));
        if(!OW.bans.length)rows.appendChild(el('div','tcs-note','Nobody is banned.'));
        OW.bans.forEach(function(b){
          var r=el('div','tow-row');
          var t=el('span',null,(b.name||'Player')+'#'+String(b.id||'').slice(0,4));t.title=b.reason||'';
          r.appendChild(t);
          r.appendChild(el('em',null,b.reason||''));
          r.appendChild(soBtn('Unban',function(){owUnban(b.id);}));
          rows.appendChild(r);
        });
      }
    }
    addLive(function(){
      var v=OW.ver+'/'+SO.state+'/'+(SO.me?SO.me.name:'');
      if(v===ver)return;ver=v;paint();
    });
  };
  var OW_MOD={cat:'friends',id:null,name:'Owner',wide:true,special:'ownertools',
    desc:'Owner tools for the ThunderGamey_ account: turn them on with your owner key, then ban players from Thunder Friends and wear the owner cosmetic.'};
  (function(){var i=MODULES.indexOf(SY_MOD);if(i<0)MODULES.push(OW_MOD);else MODULES.splice(i+1,0,OW_MOD);})();

  // for tests and the console
  TC.owner={state:OW,enable:owEnable,ban:owBan,unban:owUnban,hasPowers:owHasPowers,isOwner:owIsOwnerAcct};
