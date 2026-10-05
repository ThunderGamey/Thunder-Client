  /* -------------------------------------------------------------------------------------------
     Part of Thunder Client, created and owned by Jayvardhan Ginni (ThunderGamey).
     Parties (Right Shift > Friends > Party). Included into the client scope of thunder-client.js
     by build.js, after thunder-social.js, whose connection, pop-ups and joining it uses.
     A party is up to 8 Thunder Friends players who play together:
       - one of them leads: makes the party and invites friends (an invite stays open for 15
         minutes and waits for a friend who is offline; it pops up with Join party / No);
       - when the leader opens their world to friends, joins a friend's world or goes to a server,
         the members' games follow ("Follow the leader", on by default): at once from the menus;
         from inside a world a pop-up says where they went, and the game follows once you leave
         it (Esc > Disconnect, or Save and Quit) within 3 minutes. Party members get the world's
         code like an Invite, even when friends need the code;
       - party chat (with pop-ups), and who is in the party with roughly what they are doing
         (members need not be friends of each other, so no codes or servers are shown, only where
         the leader went, which is for all of them);
       - leaving hands the lead to the member who joined first after the leader; the leader can
         remove players; the last one out ends the party.
     The friends hub keeps the party (thunder-relay/social.js; thunder/NETWORKING.md). The party
     chat is not kept: it shows while this page is open.
  ------------------------------------------------------------------------------------------- */
  var PT_CHAT=60,PT_FOLLOW_MS=180000,PT_INV_MS=15*60000,PT_CODE=/^[a-z0-9]{5,6}$/;
  var PT={aid:'',p:null,lastId:'',names:{},inv:[],chat:[],cver:0,msg:'',msgOk:false,msgAt:0,
    pend:null,menuAt:0,sent:'',cand:'',candAt:0,acc:'',toasted:{},kicked:{},ver:0};
  function ptChanged(){PT.ver++;if(menuOpen)runLive();}
  function ptMe(){return SO.me?SO.me.id:'';}
  function ptLeader(){return !!(PT.p&&SO.me&&PT.p.leader===SO.me.id);}
  function ptMember(id){var l=PT.p?PT.p.members:[];for(var i=0;i<l.length;i++)if(l[i].id===id)return l[i];return null;}
  function ptNote(text,ok){PT.msg=text||'';PT.msgOk=!!ok;PT.msgAt=now();ptChanged();}
  function ptViewing(){return menuOpen&&currentCat==='friends'&&!searchQuery;}
  function ptLine(l){
    PT.chat.push(l);
    if(PT.chat.length>PT_CHAT)PT.chat.splice(0,PT.chat.length-PT_CHAT);
    PT.cver++;
  }
  // a new account here (or none): nothing of the last one's party stays
  function ptWelcome(aid){
    if(aid!==PT.aid){PT.aid=aid;PT.lastId='';PT.names={};PT.chat=[];PT.cver++;PT.toasted={};}
    // (the hub sends the party, if any, and the open invites right after)
    PT.p=null;PT.inv=[];PT.pend=null;PT.sent='';PT.cand='';PT.acc='';
    ptChanged();
  }
  // where a warp goes, as one string (the leader sends a warp only when it changes)
  function ptKey(w){return w?w.w+'|'+(w.code||w.server||''):'menu|';}
  // where you are, for a party to follow: a world you opened (its code), a friend's world you are
  // in (its code), a server (its address); anything else is the menus (nowhere to follow)
  function ptWhere(){
    try{
      if(LJ.active||LJ.state==='joining'||LJ.state==='playing'){
        var jc=String(LJ.code||'').toLowerCase();
        return PT_CODE.test(jc)?{w:'join',code:jc}:{w:'menu'};
      }
      var hc=String(LH.code||'').toLowerCase();
      if(LH.state==='open'&&PT_CODE.test(hc))return {w:'host',code:hc};
      if(HEN&&HEN.X&&!lanWorldRunning()){
        var nm=HEN.v&&HEN.v.d9&&HEN.v.d9.qf,addr=nm&&nm.bR3?String($rt_ustr(nm.bR3)):'';
        if(addr&&addr.indexOf('~!')!==0)return {w:'server',server:addr.replace(/\/+$/,'').slice(0,80)};
      }
    }catch(_){}
    return {w:'menu'};
  }
  function ptPlace(w){
    return w.w==='server'?'is on '+soServerName(w.server):w.w==='host'?'opened their world':'is in a friend\'s world';
  }
  // already where the warp goes (or on the way there)
  function ptThere(w){
    if(w.w==='server'){
      var cur=ptWhere();
      return cur.w==='server'&&soServerName(cur.server).toLowerCase()===soServerName(w.server).toLowerCase();
    }
    var c=String(w.code||'').toLowerCase();
    if(LH.state==='open'&&String(LH.code||'').toLowerCase()===c)return true;
    return !!((LJ.active||['finding','connecting','joining','playing'].indexOf(LJ.state)>=0)&&String(LJ.code||'').toLowerCase()===c);
  }
  // at the menus with nothing on the way: a world or server can be joined from here
  function ptAtMenus(){
    return !!(HEN&&!HEN.X&&BOOT.frames>=3&&!LJ.active&&!(HFB>0)&&!lanHosting()&&!SO.joining&&
      ['finding','connecting','joining','playing'].indexOf(LJ.state)<0&&!(HEN.cm instanceof AHe)&&now()-SV.at>4000);
  }
  // go where the leader went (a world by its code: soJoin; a server: soJoinServer)
  function ptGo(w){
    PT.pend=null;
    if(ptThere(w))return true;
    var who={id:w.from&&w.from.id||'',name:w.from&&w.from.name||''};
    if(w.w==='server')return soJoinServer({online:true,name:who.name||'Your party leader',s:{w:'server',server:w.server}});
    return soJoin(w.code,w.w==='host'?who:null);
  }
  function ptLeaderCard(){return PT.p?ptMember(PT.p.leader):null;}

  // ---- what the hub says (from soOn in thunder-social.js) -------------------------------------
  function ptOn(m){
    var me=ptMe(),i;
    switch(m.t){
      case 'party':{
        if(!m.id){
          var had=!!PT.p||!!PT.lastId;
          PT.p=null;PT.lastId='';PT.names={};PT.pend=null;PT.sent='';PT.cand='';
          if(had){
            PT.chat=[];PT.cver++;
            if(m.why==='removed'){
              ptNote('The party leader removed you from the party.');
              if(S.socialToasts)soToast({kind:'info',title:'Party',text:'The party leader removed you from the party.',quiet:true});
            }else if(m.why==='left')ptNote('You left the party.',true);
          }
          ptChanged();
          return;
        }
        var same=PT.lastId===m.id,was=PT.p,names={};
        if(!same){PT.chat=[];PT.cver++;PT.names={};}
        (m.members||[]).forEach(function(c){names[c.id]=c.name;});
        // who came and went (not the first time this party is seen)
        if(same){
          for(i in names)if(!PT.names[i]&&i!==me)ptLine({w:'sys',text:names[i]+' joined the party.',at:Date.now()});
          for(i in PT.names)if(!names[i]&&i!==me)ptLine({w:'sys',text:PT.names[i]+(PT.kicked[i]?' was removed from the party.':' left the party.'),at:Date.now()});
          PT.kicked={};
        }
        if(same&&was&&was.leader!==m.leader){
          var ln=names[m.leader]||'Someone';
          ptLine({w:'sys',text:m.leader===me?'You lead the party now.':ln+' leads the party now.',at:Date.now()});
          if(m.leader===me&&S.socialToasts)soToast({kind:'info',title:'Party',text:'You lead the party now: where you go, the party follows.',party:true});
        }
        PT.p=m;PT.lastId=m.id;PT.names=names;
        PT.inv=PT.inv.filter(function(x){return x.pid!==m.id;});
        // the leader: what the hub already has is not sent again
        if(m.leader===me&&(!same||!was||was.leader!==me)){PT.sent=ptKey(m.warp);PT.cand='';}
        if(m.leader!==me)PT.sent='';
        // just joined: go where the leader is (from the menus), or say where that is
        if(PT.acc===m.id){
          PT.acc='';
          var lc=ptLeaderCard();
          if(m.warp&&m.warp.w!=='menu'&&lc&&lc.online&&m.leader!==me){
            var w={w:m.warp.w,code:m.warp.code,server:m.warp.server,from:{id:lc.id,name:lc.name}};
            if(!ptThere(w)){
              if(S.partyFollow&&ptAtMenus())ptGo(w);
              else ptNote(lc.name+' '+ptPlace(w)+': Join below to go there.',true);
            }
          }
        }
        ptChanged();
        return;
      }
      case 'pinvited':{
        if(!m.from||(PT.p&&PT.p.id===m.pid))return;
        PT.inv=PT.inv.filter(function(x){return x.pid!==m.pid;});
        PT.inv.push(m);
        var k=m.pid+':'+m.at;
        if(!PT.toasted[k]&&S.socialToasts){
          PT.toasted[k]=1;
          var others=(m.members||[]).filter(function(n){return n!==m.from.name;});
          soToast({kind:'invite',title:m.from.name,text:'invited you to their party'+(others.length?' (with '+others.slice(0,3).join(', ')+(others.length>3?' and '+(others.length-3)+' more':'')+')':''),party:true,
            btns:[{label:'Join party',go:true,fn:function(){ptAccept(m.pid);}},{label:'No',fn:function(){ptDecline(m.pid);}}]});
        }
        ptChanged();
        return;
      }
      case 'pmsg':{
        if(!PT.p||!m.from)return;
        var mine=m.from.id===me;               // (sent from this account's other device)
        ptLine({w:mine?'out':'in',name:m.from.name,text:m.text,at:m.at});
        if(!mine&&!ptViewing()&&S.socialToasts)soToast({kind:'msg',title:m.from.name+' \u2022 party',text:m.text,party:true});
        ptChanged();
        return;
      }
      case 'pwarp':ptWarp(m);return;
    }
  }
  function ptErr(why){
    PT.acc='';
    ptNote(why);
    if(!ptViewing())soToast({kind:'info',title:'Party',text:why,quiet:true});
  }
  // the leader went somewhere: follow (from the menus at once; from a world once you leave it)
  function ptWarp(m){
    if(!PT.p||!m.from||m.from.id===ptMe())return;
    if(m.w==='menu'){PT.pend=null;PT.p.warp=null;ptChanged();return;}
    var w={w:m.w,code:m.code,server:m.server,from:m.from};
    PT.p.warp={w:m.w,code:m.code,server:m.server,at:m.at};
    PT.pend=null;
    ptChanged();
    if(ptThere(w))return;
    var title=m.from.name+' '+ptPlace(w);
    if(!S.partyFollow){
      if(S.socialToasts)soToast({kind:'info',title:title,text:'Your party leader went somewhere new.',party:true,btns:[{label:'Join',go:true,fn:function(){return ptGo(w)!==false;}}]});
      return;
    }
    if(ptAtMenus()){ptGo(w);return;}
    PT.pend=w;PT.pend.at=now();PT.menuAt=0;
    var how=!(HEN&&HEN.X)?'Your game follows them as soon as it is back at the menus.':
      'Leave this '+(lanWorldRunning()&&!LJ.active?'world (Esc \u2192 Save and Quit)':LJ.active?'world (Esc \u2192 Disconnect)':'server (Esc \u2192 Disconnect)')+' and your game follows them.';
    soToast({kind:'info',title:title,text:how+' (Party \u2192 Follow the leader)',party:true});
  }

  // ---- things you do -------------------------------------------------------------------------
  var PT_OFF='Thunder Friends is not connected right now.';
  function ptNew(){PT.msg='';if(!soSend({t:'pnew'}))ptNote(PT_OFF);else ptChanged();}
  function ptInvite(id){
    var f=SO.friends[id];
    if(!f)return;
    if(!soSend({t:'pinv',to:id})){ptNote(PT_OFF);return;}
    ptNote('Invite sent to '+f.name+(f.online?'.':': it waits until they are online (15 minutes).'),true);
  }
  function ptAccept(pid){
    PT.inv=PT.inv.filter(function(x){return x.pid!==pid;});
    PT.acc=pid;PT.msg='';
    if(!soSend({t:'pacc',pid:pid})){PT.acc='';ptNote(PT_OFF);return;}
    ptChanged();
  }
  function ptDecline(pid){
    PT.inv=PT.inv.filter(function(x){return x.pid!==pid;});
    soSend({t:'pdec',pid:pid});
    ptChanged();
  }
  function ptLeave(){if(PT.p&&!soSend({t:'pleave'}))ptNote(PT_OFF);}
  function ptKick(id){
    if(!ptLeader()||!/^[0-9a-f]{24}$/.test(id||''))return;
    if(soSend({t:'pkick',id:id}))PT.kicked[id]=1;else ptNote(PT_OFF);
  }
  function ptSay(text){
    text=String(text||'').replace(/\s+/g,' ').trim().slice(0,300);
    if(!text||!PT.p)return false;
    if(!soSend({t:'pmsg',text:text})){ptNote('Not sent: '+PT_OFF.charAt(0).toLowerCase()+PT_OFF.slice(1));return false;}
    ptLine({w:'out',name:SO.me?SO.me.name:'',text:text,at:Date.now()+(SO.skew||0)});
    ptChanged();
    return true;
  }
  // the Friends tab, scrolled to the party
  function ptShow(){
    currentCat='friends';searchQuery='';
    if(searchInput)searchInput.value='';
    if(menuOpen)render();else showMenu();
    W.setTimeout(function(){
      try{
        var r=D.getElementById('tcp-root'),c=r&&r.closest?r.closest('.tcm-card'):r;
        if(c&&c.scrollIntoView)c.scrollIntoView({block:'start'});
        var i=D.getElementById('tcp-say');
        if(i&&!i.disabled&&i.offsetParent)i.focus();
      }catch(_){}
    },60);
  }

  // every second: the leader tells the party where they went; a member follows a warp they
  // could not follow from inside a world, once back at the menus
  W.setInterval(function(){
    try{
      if(!soReady()||!PT.p)return;
      if(ptLeader()){
        var to=ptWhere(),k=ptKey(to);
        if(k===PT.sent){PT.cand='';return;}
        // (where it has been for a moment: a world that is opening, a server being joined)
        if(PT.cand!==k){PT.cand=k;PT.candAt=now();return;}
        if(now()-PT.candAt<1500)return;
        var o={t:'pwarp',w:to.w};
        if(to.code)o.code=to.code;
        if(to.server)o.server=to.server;
        if(soSend(o)){PT.sent=k;PT.cand='';if(PT.p){PT.p.warp=to.w==='menu'?null:to;ptChanged();}}
        return;
      }
      var w=PT.pend;
      if(!w)return;
      if(!S.partyFollow||now()-w.at>PT_FOLLOW_MS||ptThere(w)){PT.pend=null;return;}
      if(!ptAtMenus()){PT.menuAt=0;return;}
      // (a moment at the menus first: the world or server has only just closed)
      if(!PT.menuAt){PT.menuAt=now();return;}
      if(now()-PT.menuAt<1500)return;
      PT.pend=null;PT.menuAt=0;
      ptGo(w);
    }catch(e){report(e);}
  },1000);

  // ---- Right Shift > Friends > Party ---------------------------------------------------------
  var PT_CSS=[
    '.tcp{display:flex;gap:10px;height:290px;margin-top:2px}',
    '.tcp-side{flex:0 0 262px;display:flex;flex-direction:column;gap:6px;min-width:0}',
    '.tcp-head{display:flex;align-items:center;gap:6px;padding:6px 8px;border-radius:9px;background:rgba(3,7,12,.5);border:1px solid rgba(110,140,160,.18);font-size:12px;color:#dff3ff;min-height:30px}',
    '.tcp-head span{flex:1;min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}',
    '.tcp-head em{font-style:normal;color:#7fdcff}',
    '.tcp-list{flex:1;overflow-y:auto;min-height:0;scrollbar-width:thin;scrollbar-color:#2c4556 transparent;padding-right:2px}',
    '.tcp-lead{color:#ffd166;margin-left:6px;font-size:10.5px;font-weight:700}',
    '.tcp-warp{display:flex;align-items:center;gap:6px;padding:5px 8px;border-radius:8px;background:rgba(125,255,154,.07);border:1px solid rgba(125,255,154,.3);font-size:11.5px;color:#c9ffd6}',
    '.tcp-warp span{flex:1;min-width:0}',
    '.tcp-follow{display:flex;align-items:center;gap:8px;font-size:12px;color:#dff3ff;padding:2px 2px 0}',
    '.tcp-follow span{flex:1}',
    '.tcp-main{height:auto}',
    '.tcp-m b{font-weight:700;color:#9fd8f0;margin-right:5px}.tcs-out.tcp-m b{color:#fff}',
    '.tcp-start{display:flex;flex-direction:column;gap:8px;align-items:flex-start;padding:4px 2px}',
    '@media (max-width:760px){.tcp{flex-direction:column;height:auto}.tcp-side{flex:none}.tcp-main{height:240px}}'
  ].join('');
  function ptCss(){
    if(D.getElementById('thunder-party-style'))return;
    var st=D.createElement('style');st.id='thunder-party-style';st.textContent=PT_CSS;
    (D.head||D.documentElement).appendChild(st);
  }
  function ptDoing(c){
    if(!c.online)return c.seen?'Last online '+soAgo(c.seen):'Offline';
    switch(c.s&&c.s.w){
      case 'host':return 'In their world';
      case 'sp':return 'Playing singleplayer';
      case 'join':return 'In a friend\'s world';
      case 'server':return 'On a server';
      case 'menu':return 'In the menus';
      default:return 'Online';
    }
  }
  SPECIALS.party=function(box){
    soCss();lanCss();ptCss();
    var note=el('div','tcs-note'),root=el('div','tcp'),side=el('div','tcp-side'),main=el('div','tcs-main tcp-main');
    root.id='tcp-root';
    root.appendChild(side);root.appendChild(main);
    box.appendChild(note);box.appendChild(root);
    // the side: the party (or invites and Make a party), the leader's warp, Follow the leader
    var head=el('div','tcp-head'),list=el('div','tcp-list'),warp=el('div','tcp-warp'),say2=el('div','tcs-note');
    var fol=el('div','tcp-follow'),sw=el('button','tcm-switch');
    sw.type='button';sw.setAttribute('aria-label','Follow the leader');
    sw.addEventListener('click',function(e){e.stopPropagation();S.partyFollow=!S.partyFollow;if(!S.partyFollow)PT.pend=null;save();ptChanged();});
    fol.appendChild(el('span',null,'Follow the leader'));fol.appendChild(sw);
    [head,warp,list,say2,fol].forEach(function(n){side.appendChild(n);});
    // the party chat
    var msgs=el('div','tcs-msgs'),send=el('div','tcs-send'),say=el('input'),sayB=soBtn('Send',function(){doSay();},true);
    say.id='tcp-say';say.type='text';say.maxLength=300;say.spellcheck=true;say.autocomplete='off';
    function doSay(){if(ptSay(say.value))say.value='';}
    soKeepKeys(say,doSay);
    send.appendChild(say);send.appendChild(sayB);
    main.appendChild(msgs);main.appendChild(send);
    function row(cls){return el('div','tcs-f'+(cls?' '+cls:''));}
    function memberRow(c,lead){
      var r=row(),me=c.id===ptMe();
      r.style.cursor='default';
      r.appendChild(el('span','tcs-dot'+(c.online?' tcs-on':'')));
      var fn=el('div','tcs-fn'),b=el('b',null,soTagged(c)+(me?' (you)':''));
      if(c.id===PT.p.leader)b.appendChild(el('span','tcp-lead','\u2605 leader'));
      fn.appendChild(b);fn.appendChild(el('i',null,ptDoing(c)));r.appendChild(fn);
      if(lead&&!me)r.appendChild(armBtnP('Remove','Click again',function(){ptKick(c.id);},'pkick:'+c.id));
      return r;
    }
    // (a button that asks for a second click, as in the friends list)
    function armBtnP(label,armed,fn,key){
      var bt=soBtn(label,function(){
        if(!SO.arm[key]){
          var t=SO.arm[key]=now();bt.textContent=armed;
          W.setTimeout(function(){if(SO.arm[key]===t){delete SO.arm[key];bt.textContent=label;}},4000);
          return;
        }
        delete SO.arm[key];fn();
      });
      if(SO.arm[key])bt.textContent=armed;
      return bt;
    }
    function paint(){
      var ready=soReady()&&!!SO.me,p=PT.p,lead=ptLeader(),skew=SO.skew||0;
      note.textContent=ready?'':SO.state==='auth'?'Log in to Thunder Friends (above) to play in a party.':'Thunder Friends is not connected right now.';
      note.style.display=ready?'none':'';
      root.style.display=ready?'':'none';
      while(head.firstChild)head.removeChild(head.firstChild);
      while(list.firstChild)list.removeChild(list.firstChild);
      sw.className='tcm-switch'+(S.partyFollow?' tcm-on':'');
      var showMsg=PT.msg&&now()-PT.msgAt<10000;
      say2.textContent=showMsg?PT.msg:'';say2.style.display=showMsg?'':'none';
      say2.className='tcs-note'+(PT.msgOk?' tcs-ok':' tcs-bad');
      var open=PT.inv.filter(function(x){return Date.now()+skew-x.at<PT_INV_MS;});
      if(!p){
        // not in a party: invites, and Make a party
        head.appendChild(el('span',null,'You are not in a party'));
        head.appendChild(soBtn('Make a party',function(){ptNew();},true));
        warp.style.display='none';fol.style.display='none';
        if(open.length){
          list.appendChild(el('div','tcs-sec','Invites'));
          open.forEach(function(x){
            var r=row('tcs-req'),fn=el('div','tcs-fn');
            fn.appendChild(el('b',null,soTagged(x.from)));
            fn.appendChild(el('i',null,'invited you'+((x.members||[]).length>1?' \u2022 '+x.members.join(', '):'')));
            r.appendChild(fn);
            var act=el('div','tcs-ract');
            act.appendChild(soBtn('Join party',function(){ptAccept(x.pid);},true));
            act.appendChild(soBtn('No',function(){ptDecline(x.pid);}));
            r.appendChild(act);
            list.appendChild(r);
          });
        }
        list.appendChild(el('div','tcs-note','Play together with up to 7 friends. Where the party leader goes (a world they open, a friend\'s world, a server), everyone\'s game follows. Party chat too.'));
        return;
      }
      var ms=p.members||[],on=ms.filter(function(c){return c.online;}).length;
      var hs=el('span');hs.appendChild(D.createTextNode('Party \u2022 '));hs.appendChild(el('em',null,ms.length+'/8'));
      hs.appendChild(D.createTextNode(' \u2022 '+on+' online'));
      head.appendChild(hs);
      head.appendChild(soBtn('Leave',function(){ptLeave();}));
      // where the leader is, with Join (members, when not there yet)
      var lc=ptLeaderCard(),wp=p.warp,ww=wp&&wp.w!=='menu'&&lc?{w:wp.w,code:wp.code,server:wp.server,from:{id:lc.id,name:lc.name}}:null;
      var showWarp=!lead&&ww&&lc.online&&!ptThere(ww);
      warp.style.display=showWarp?'':'none';
      while(warp.firstChild)warp.removeChild(warp.firstChild);
      if(showWarp){
        warp.appendChild(el('span',null,lc.name+' '+ptPlace(ww)+(PT.pend?' \u2022 your game follows when you leave this world':'')));
        warp.appendChild(soBtn('Join',function(){ptGo(ww);},true));
      }
      fol.style.display=lead?'none':'';
      list.appendChild(el('div','tcs-sec','Members'));
      ms.forEach(function(c){list.appendChild(memberRow(c,lead));});
      var invited={};
      (p.invites||[]).forEach(function(x){invited[x.id]=1;});
      // (the leader sees them in Invite friends)
      if(!lead&&(p.invites||[]).length){
        list.appendChild(el('div','tcs-sec','Invited'));
        p.invites.forEach(function(x){
          var r=row(),fn=el('div','tcs-fn');r.style.cursor='default';
          fn.appendChild(el('b',null,soTagged(x)));fn.appendChild(el('i',null,'waiting for them to join'));r.appendChild(fn);
          list.appendChild(r);
        });
      }
      if(lead){
        // invite friends who are not in it
        var ids=soFriendIds().filter(function(id){return !ptMember(id);});
        list.appendChild(el('div','tcs-sec','Invite friends'));
        if(ms.length>=8)list.appendChild(el('div','tcs-note','The party is full (8 players).'));
        else if(!ids.length)list.appendChild(el('div','tcs-note',Object.keys(SO.friends).length?'All your friends are in the party.':'Add friends first (Thunder Friends, above).'));
        else ids.forEach(function(id){
          var f=SO.friends[id],r=row(),fn=el('div','tcs-fn');r.style.cursor='default';
          r.appendChild(el('span','tcs-dot'+(f.online?' tcs-on':'')));
          fn.appendChild(el('b',null,soTagged(f)));fn.appendChild(el('i',null,f.online?'Online':'Offline: the invite waits 15 minutes'));r.appendChild(fn);
          var ib=soBtn(invited[id]?'Invited':'Invite',function(){ptInvite(id);},!invited[id]);
          ib.disabled=!!invited[id];
          r.appendChild(ib);
          list.appendChild(r);
        });
      }
    }
    function paintChat(){
      var atEnd=msgs.scrollHeight-msgs.scrollTop-msgs.clientHeight<30;
      while(msgs.firstChild)msgs.removeChild(msgs.firstChild);
      if(!PT.p)msgs.appendChild(el('div','tcs-empty','Party chat shows here once you are in a party.'));
      else if(!PT.chat.length)msgs.appendChild(el('div','tcs-empty','Say something to your party. Everyone in it sees it.'));
      PT.chat.forEach(function(m){
        var d=el('div','tcs-m tcp-m'+(m.w==='out'?' tcs-out':m.w==='sys'?' tcs-sys':''));
        if(m.w!=='sys')d.appendChild(el('b',null,m.name||''));
        d.appendChild(D.createTextNode(m.text));
        if(m.w!=='sys')d.appendChild(el('small',null,soTime(m.at)));
        msgs.appendChild(d);
      });
      var ok=soReady()&&!!PT.p;
      say.disabled=sayB.disabled=!ok;
      say.placeholder=!PT.p?'':!soReady()?'Not connected':'Message your party (Enter to send)';
      if(atEnd)msgs.scrollTop=msgs.scrollHeight;
    }
    // (rebuilt only when something changed, so clicks and typing are never lost; open invites are
    // looked at again every 30 seconds, as they run out)
    var ver='',cver=-1,ready=null;
    addLive(function(){
      var v=SO.ver+'/'+PT.ver+'/'+SO.state+'/'+(PT.msg&&now()-PT.msgAt<10000)+'/'+(PT.inv.length?Math.floor(Date.now()/30000):0);
      if(v!==ver){ver=v;paint();}
      var rd=soReady()&&!!PT.p;
      if(cver!==PT.cver||ready!==rd){cver=PT.cver;ready=rd;paintChat();}
    });
  };
  var PT_MOD={cat:'friends',id:null,name:'Party',wide:true,special:'party',
    desc:'Play together: a party of up to 8 Thunder Friends players. Where the leader goes (a world they open, a friend\'s world, a server), everyone\'s game follows. Party chat too.'};
  (function(){var i=MODULES.indexOf(SO_MOD_CHAT);if(i<0)MODULES.push(PT_MOD);else MODULES.splice(i+1,0,PT_MOD);})();
  // for tests and the console
  TC.party={state:PT,make:ptNew,invite:ptInvite,accept:ptAccept,decline:ptDecline,leave:ptLeave,kick:ptKick,say:ptSay,show:ptShow,
    where:ptWhere,atMenus:ptAtMenus};
