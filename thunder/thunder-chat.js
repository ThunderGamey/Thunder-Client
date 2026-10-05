  /* -------------------------------------------------------------------------------------------
     Part of Thunder Client, created and owned by Jayvardhan Ginni (ThunderGamey).
     Chat Tools (Utility). Included into the client scope of thunder-client.js by build.js.
       - Highlight: a chat line that says your name (the game's profile name, or your Thunder
         Friends name) gets a gold background, and a soft ding plays. In a line that starts with
         you ("<You> hi", "[Rank] You: hi", "You joined the game") only a second mention counts.
       - Merge repeats: the same message again (within a minute, nothing else in between)
         replaces the last line, with (x2), (x3)... at its end. This uses the game's own line ids:
         a line given an id replaces the lines that have it.
       - Time: [15:04] before each line (off unless switched on).
       - Auto GG (off unless switched on): on a server or in a friend's world, when the chat says
         a game is over ("won the game", "Winner: ...", "1st Killer", "GAME OVER"...), says gg
         (or your own text) about a second later; at most once in 20 seconds, and never for
         lines that look like a player talking ("<Steve> I won the game", "Steve: gg").
     Every chat line goes through GuiNewChat.printChatMessageWithOptionalDeletion. The wrapper
     reads the line's text, then gives the game a new line: a TextComponentString with the time
     and the original appended to it (so its colours, links and hover texts stay), and an id.

     Game functions this module replaces:
     @hook CAy net.minecraft.client.gui.GuiNewChat.printChatMessageWithOptionalDeletion
     Game functions, classes and fields it uses:
     @use DQt net.minecraft.util.text.TextComponentBase.getUnformattedText
     @use CAm net.minecraft.util.text.TextComponentBase.appendSibling
     @use G$ net.minecraft.util.text.TextComponentString.<init>
     @class FP net.minecraft.util.text.TextComponentString
     @use Cn9 net.minecraft.client.entity.EntityPlayerSP.sendChatMessage
     @field BM net.minecraft.client.gui.GuiNewChat.setChatLine GuiNewChat.drawnChatLines
     @field EB net.minecraft.client.gui.GuiNewChat.setChatLine GuiNewChat.scrollPos
     @field cfA net.minecraft.client.gui.GuiNewChat.setChatLine ChatLine.chatLineID
     (GuiNewChat.drawChat DYN is wrapped in thunder-qol.js and Gui.drawRect D49 in
     thunder-theme.js; they tell this module which chat is drawing and ask chatRowColor for the
     colour of each line's background box.)
  ------------------------------------------------------------------------------------------- */
  var CT_ID0=0x54480000;              // Thunder's line ids ("TH" + a counter)
  var CT={id:0,last:null,mention:{},mentionIds:[],chat:null,gg:0,ding:0,lines:0,merged:0,mentions:0,ggs:0,
    h12:(function(){try{return new Date(2020,0,1,13).toLocaleTimeString().indexOf('13')<0;}catch(_){return false;}})()};
  var CT_GG_KEY='thunderAutoGG';
  function chatOn(){return !!S.chatTools&&!!(S.chatTime||S.chatMention||S.chatMerge||S.autoGG);}
  function chatNewId(){CT.id=(CT.id%65535)+1;return CT_ID0+CT.id;}
  function chatClock(){
    var d=new Date(),h=d.getHours(),m=('0'+d.getMinutes()).slice(-2);
    return CT.h12?((h%12)||12)+':'+m:('0'+h).slice(-2)+':'+m;
  }
  // the names that count as you: the game's profile name and your Thunder Friends name
  function chatNames(){
    var out=[],n=lanMyName(),f=SO.me&&SO.me.name;
    if(/^[A-Za-z0-9_]{3,16}$/.test(n))out.push(n);
    if(f&&/^[A-Za-z0-9_]{3,16}$/.test(f)&&out.indexOf(f)<0)out.push(f);
    return out;
  }
  // (a name is letters, digits and _ only, so it is safe inside a RegExp as it is)
  function chatMentions(t){
    var names=chatNames(),i,rx,own,m;
    for(i=0;i<names.length;i++){
      rx=new RegExp('(^|[^A-Za-z0-9_])'+names[i]+'(?![A-Za-z0-9_])','i');
      if(!rx.test(t))continue;
      // a line that starts with you: your own ("<You> ...", "[You] ..." from /say, "* You ..." from
      // /me, "[Rank] You: ...") or about you ("You joined the game", "You was slain by ...")
      own=new RegExp('^\\s*(?:\\[[^\\]]{0,30}\\]\\s*)*(?:<\\s*'+names[i]+'\\s*>|\\[\\s*'+names[i]+'\\s*\\]|\\*\\s*'+names[i]+'(?![A-Za-z0-9_])|'+names[i]+'(?![A-Za-z0-9_]))','i');
      m=own.exec(t);
      if(m&&!rx.test(t.slice(m[0].length)))continue;     // your own line, and nobody else's name
      return true;
    }
    return false;
  }
  // a short two-note chime (at most one every 1.5 s)
  var ctAudio=null;
  function chatDing(){
    if(!S.chatMentionSound||now()-CT.ding<1500)return;
    CT.ding=now();
    try{
      var AC=W.AudioContext||W.webkitAudioContext;if(!AC)return;
      if(!ctAudio)ctAudio=new AC();
      var c=ctAudio;
      if(c.state!=='running'){c.resume().catch(function(){});if(c.state!=='running')return;}
      [[1318.5,0],[1760,0.09]].forEach(function(n){
        var t=c.currentTime+n[1],o=c.createOscillator(),g=c.createGain();
        o.type='sine';o.frequency.value=n[0];
        g.gain.setValueAtTime(0.0001,t);g.gain.exponentialRampToValueAtTime(0.07,t+0.012);g.gain.exponentialRampToValueAtTime(0.0001,t+0.32);
        o.connect(g);g.connect(c.destination);o.start(t);o.stop(t+0.34);
      });
    }catch(_){}
  }
  // Auto GG: lines that say a game is over (and do not look like a player talking)
  var CT_GG=[/\b(?:won|wins|win) the (?:game|match|duel|round|fight|battle)\b/i,/\bwinners?\s*(?:[:!\-]|is\b|are\b)/i,/\b1st killer\b/i,
    /\bgame (?:over|ended|has ended)\b/i,/\bmatch (?:over|ended|has ended|complete)\b/i,/^\s*(?:victory|defeat)\b/i,
    /\byou (?:won|lost)\b/i,/\breward summary\b/i];
  var CT_SAYS=/^\s*(?:<[^>]{1,40}>|(?:\[[^\]]{0,30}\]\s*)*([A-Za-z0-9_*~.]{2,20})\s*(?::|\u00bb|>>|->)\s)/;
  var CT_NOT_NAMES=/^(?:winners?|game|match|victory|defeat|reward|killer|1st|2nd|3rd|top|team|you)$/i;
  function chatGGText(){
    var t='';
    try{t=String(W.localStorage.getItem(CT_GG_KEY)||'');}catch(_){}
    t=t.replace(/[\u0000-\u001f\u007f\u00a7]/g,'').trim().slice(0,100);
    return t||'gg';
  }
  function chatGG(t){
    if(!S.autoGG||!HEN||!HEN.X||lanWorldRunning())return;      // a server, or a friend's world
    var m=CT_SAYS.exec(t),i,hit=false;
    if(m&&!(m[1]&&CT_NOT_NAMES.test(m[1])))return;               // a player talking
    for(i=0;i<CT_GG.length;i++)if(CT_GG[i].test(t)){hit=true;break;}
    if(!hit||now()-CT.gg<20000)return;
    CT.gg=now();
    var msg=chatGGText();
    W.setTimeout(function(){
      if(!S.autoGG||!HEN||!HEN.X||!HEN.v)return;
      var go=false;
      // (decided in its own step: the step that sends may pause and be called again)
      runOnGame([function(){go=!!(HEN&&HEN.X&&HEN.v);},function(){if(go)Cn9(HEN.v,$rt_str(msg));},function(){if(go)CT.ggs++;}]);
    },900+Math.floor(Math.random()*700));
  }
  // what to do with one line: x.c is the id the game gave it (0 for nearly every line)
  function chatPlan(a,x,plain){
    var t=plain.replace(/\u00a7./g,''),mention=!!S.chatMention&&chatMentions(t),id=x.c,L=CT.last,pre='',suf='';
    CT.lines++;
    if(id===0){
      // the same text as the last line, within a minute, and that line is still in the chat
      if(S.chatMerge&&L&&L.text===t&&t.trim()&&now()-L.at<60000&&chatHasLine(a,L.id)){L.n++;L.at=now();id=L.id;suf=' \u00a77(x'+L.n+')';CT.merged++;}
      else{id=chatNewId();CT.last={text:t,id:id,n:1,at:now()};}
    }
    if(mention&&id>CT_ID0&&id<=CT_ID0+65535){
      if(!CT.mention[id]){CT.mention[id]=1;CT.mentionIds.push(id);if(CT.mentionIds.length>200)delete CT.mention[CT.mentionIds.shift()];}
      CT.mentions++;
      chatDing();
    }
    if(S.chatTime)pre=(mention?'\u00a76':'\u00a77')+'['+chatClock()+']\u00a7r ';
    x.id=id;
    if(pre||suf){
      x.p=new FP();G$(x.p,$rt_str(pre));
      if(suf){x.suf=new FP();G$(x.suf,$rt_str(suf));}
    }
    if(x.c===0)chatGG(t);
  }
  function chatHasLine(a,id){
    var l=a&&a.BM,n=l?EH(l):0,i,ln;
    for(i=0;i<n;i++){ln=Bm(l,i);if(ln&&ln.cfA===id)return true;}
    return false;
  }
  // GuiNewChat.printChatMessageWithOptionalDeletion(line, id): read the line's text (it may
  // pause: then the state is kept on the game thread's stack), then the game's own code with
  // the new line and id
  var origCAy=CAy;
  CAy=function(a,b,c){
    var T=$rt_nativeThread(),st=0,x,t;
    if($rt_resuming()){st=T.pop();x=T.pop();}
    else x={b:b,c:c,id:c,p:null,suf:null,on:chatOn()&&b!==null};
    if(st===0){
      if(x.on){
        t=DQt(x.b);
        if($rt_suspending()){T.push(x);T.push(0);return;}
        try{chatPlan(a,x,t===null?'':String($rt_ustr(t)));}catch(e){report(e);x.p=x.suf=null;x.id=x.c;}
      }
      st=1;
    }
    if(st===1){
      if(x.p){CAm(x.p,x.b);if($rt_suspending()){T.push(x);T.push(1);return;}}
      st=2;
    }
    if(st===2){
      if(x.p&&x.suf){CAm(x.p,x.suf);if($rt_suspending()){T.push(x);T.push(2);return;}}
      st=3;
    }
    origCAy(a,x.p||x.b,x.id);
    if($rt_suspending()){T.push(x);T.push(3);return;}
  };
  // the background box of a chat line (Gui.drawRect(-2, top, right, top + 9, black) in
  // GuiNewChat.drawChat, row = -bottom / 9 from the newest): gold for a line that says your name
  function chatRowColor(l,t,r,b,col){
    var g=CT.chat;
    if(!g||l!==-2||b-t!==9||(col&0xFFFFFF)!==0||!S.chatTools||!S.chatMention)return null;
    var lines=g.BM,i=Math.round(-b/9)+(g.EB|0);
    if(!lines||i<0||i>=EH(lines))return null;
    var ln=Bm(lines,i);
    if(!ln||!CT.mention[ln.cfA])return null;
    var al=Math.min(210,Math.round(((col>>>24)&255)*1.5));      // a little stronger than the black box
    return ((al<<24)|0xC8961E)|0;
  }

  TC.chat={state:function(){return {lines:CT.lines,merged:CT.merged,mentions:CT.mentions,ggs:CT.ggs,names:chatNames(),gg:chatGGText()};},
    mentions:chatMentions,gg:chatGG};
  MODULES.push({cat:'utility',id:'chatTools',name:'Chat Tools',
    desc:'Highlights chat lines that say your name in gold (with a soft ding), merges the same message sent again into one line with (x2), and can put the time before each line and say gg when a game ends.',
    opts:[{id:'chatMention',name:'Highlight lines that say my name'},{id:'chatMentionSound',name:'Ding when someone says my name'},
      {id:'chatMerge',name:'Merge repeated messages into one line (x2)'},{id:'chatTime',name:'Time before each line'},
      {id:'autoGG',name:'Auto GG: say it when a game ends (servers and friends\' worlds)'},
      {text:true,name:'Auto GG says',max:100,placeholder:'gg',
        get:function(){return chatGGText();},
        set:function(v){try{W.localStorage.setItem(CT_GG_KEY,String(v||'').slice(0,100));}catch(_){}}}]});
