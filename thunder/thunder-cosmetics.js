  /* -------------------------------------------------------------------------------------------
     Part of Thunder Client, created and owned by Jayvardhan Ginni (ThunderGamey).
     Thunder Cosmetics (Right Shift > Cosmetics): a Thunder cape and Thunder wings, free, that
     everyone on Thunder Client sees. Included into the client scope of thunder-client.js by
     build.js, after thunder-social.js, whose connection it uses.
     - Your picks go to the Thunder Friends hub with your in-game name (while you are signed in).
       Thunder asks the hub for the cosmetics of the players around you, by in-game name (each
       name again after a few minutes), and draws them. Players on other clients see you as usual.
     - The designs are painted here, pixel by pixel, into game textures (DynamicTexture): a cape's
       outside and inside in a 32x32 texture (this Eaglercraft draws capes with the texture
       stretched twice as wide, ModelPlayer.renderCape, so a cape texture is 32 pixels across),
       and wings on the elytra part of a 64x32 texture (one per wings design, and one per cape in
       its colours).
     - Capes: AbstractClientPlayer.getLocationCape gives the Thunder cape for a player who has one,
       so the game's own cape layer draws it (only when that player shows their cape, like any
       cape, and never on invisible players or over an elytra).
     - Wings: while LayerElytra.doRenderLayer runs for a player with Thunder wings who wears no
       elytra and is not invisible, the elytra model is drawn first with the wing texture; then the
       game's own elytra layer runs as usual. ModelElytra.setRotationAngles, after the game's own
       pose, spreads the wings of a player with Thunder wings out from the back like a bird's,
       slowly beating, and blends back to the game's pose as the player glides with an elytra.
     - A real elytra: AbstractClientPlayer.getLocationElytra (which this Eaglercraft leaves empty)
       gives the player's Thunder wings (and so the spread pose while not gliding), else the
       elytra in their Thunder cape's colours.

     Game classes and functions it uses:
     @hook DQF net.minecraft.client.entity.AbstractClientPlayer.getLocationCape
     @hook Dv7 net.minecraft.client.entity.AbstractClientPlayer.getLocationElytra
     @hook EDX net.minecraft.client.renderer.entity.layers.LayerElytra.doRenderLayer
     @use FTb net.minecraft.client.renderer.entity.Render.bindTexture
     @hook DqG net.minecraft.client.model.ModelElytra.setRotationAngles
     @use Dju net.minecraft.client.model.ModelElytra.render
     @use DfI net.minecraft.entity.Entity.isInvisible
     @class Vh net.minecraft.client.entity.AbstractClientPlayer
     @static HHz net.minecraft.init.Items ELYTRA
     @field BS net.minecraft.entity.player.EntityPlayer.getName EntityPlayer.gameProfile
     @field lN com.mojang.authlib.GameProfile.getName GameProfile.name
     @field bo4 net.minecraft.client.model.ModelElytra.setRotationAngles ModelElytra.leftWing
     @field bFn net.minecraft.client.model.ModelElytra.setRotationAngles ModelElytra.rightWing
     @field cD net.minecraft.client.model.ModelElytra.setRotationAngles ModelRenderer.rotationPointX
     @field A net.minecraft.client.model.ModelElytra.setRotationAngles ModelRenderer.rotateAngleX
     @field bb net.minecraft.client.model.ModelElytra.setRotationAngles ModelRenderer.rotateAngleY
     @field bX net.minecraft.client.model.ModelElytra.setRotationAngles ModelRenderer.rotateAngleZ
     @field ckw net.minecraft.client.renderer.entity.layers.LayerElytra.doRenderLayer LayerElytra.modelElytra
     @field bcC net.minecraft.client.renderer.entity.layers.LayerElytra.doRenderLayer LayerElytra.renderPlayer
     (GlStateManager color CFi, pushMatrix Eu0, popMatrix ECi, translate DPm, scale FWK, ItemStack.getItem C51,
     getItemStackFromSlot yE, EntityEquipmentSlot.CHEST HIj, DynamicTexture YW (its constructor Fl7, data
     a45, updateDynamicTexture Egf), TextureManager.getDynamicTextureLocation EpG,
     Minecraft.renderEngine bH, World.playerEntities e4 and ArrayList EH / Bm are declared elsewhere.)
     ------------------------------------------------------------------------------------------- */
  // the designs: capes (a bolt on a gradient) and wings (feathers or a membrane)
  var COS_CAPES=[
    {id:'thunder',name:'Thunder',bg:[0x0b1f3d,0x123a6b],edge:0x4fd1ff,bolt:0xdff6ff,boltEdge:0x4fd1ff},
    {id:'storm',name:'Storm',bg:[0x1d2633,0x34465e],edge:0x8aa1b3,bolt:0xffe066,boltEdge:0xb38600,extra:'rain'},
    {id:'goldbolt',name:'Gold Bolt',bg:[0x0d0d0d,0x1f1f1f],edge:0xe8b923,bolt:0xffd34d,boltEdge:0x9c6f00},
    {id:'crimson',name:'Crimson',bg:[0x3d0610,0x8b1a2b],edge:0xff5a6e,bolt:0x16060a,boltEdge:0xff5a6e},
    {id:'emerald',name:'Emerald',bg:[0x0b3322,0x1f7a4d],edge:0x5dffa8,bolt:0xf2fff7,boltEdge:0x5dffa8},
    {id:'galaxy',name:'Galaxy',bg:[0x140b33,0x30186b],edge:0xb388ff,bolt:0xffffff,boltEdge:0xb388ff,extra:'stars'},
    {id:'sunset',name:'Sunset',bg:[0xff8a3d,0x7a2a86],edge:0xffd29e,bolt:0x2a0d33,boltEdge:0xffd29e},
    {id:'ice',name:'Ice',bg:[0xeaf8ff,0x8fd3ff],edge:0x2563eb,bolt:0x1d4ed8,boltEdge:0xffffff}
  ];
  var COS_WINGS=[
    {id:'thunder',name:'Thunder',base:[0x1e5fd0,0x4fd1ff],tip:0xeafcff,gap:0x0b3a7a},
    {id:'angel',name:'Angel',base:[0xffffff,0xe1e8f0],tip:0xffffff,gap:0xaab6c4},
    {id:'dragon',name:'Dragon',base:[0x2a0f38,0x5d1f73],tip:0x9b4dca,gap:0x12051a,membrane:true},
    {id:'flame',name:'Flame',base:[0xff3d1f,0xffb238],tip:0xfff27a,gap:0xa3200b}
  ];
  function cosFind(list,id){for(var i=0;i<list.length;i++)if(list[i].id===id)return list[i];return null;}
  // a lightning bolt on the 10x16 face of a cape
  var COS_BOLT=['..........','......##..','.....###..','....###...','...###....','..#######.','.#######..','....###...',
    '...###....','..###.....','..##......','.##.......','.#........','..........','..........','..........'];

  // ---- painting: ARGB pixels in the game's cape (32x32) and elytra (64x32) layouts ----
  function cosMix(a,b,t){
    t=t<0?0:t>1?1:t;
    return (Math.round((a>>16&255)+((b>>16&255)-(a>>16&255))*t)<<16)|(Math.round((a>>8&255)+((b>>8&255)-(a>>8&255))*t)<<8)|
      Math.round((a&255)+((b&255)-(a&255))*t);
  }
  function cosOpaque(c){return (0xff000000|c)|0;}
  function cosHash(x,y){var h=Math.imul(x*374761393+y*668265263,1274126177);return (h^(h>>>13))>>>0;}
  function cosBoltEdge(x,y){
    if(COS_BOLT[y].charAt(x)==='#')return false;
    for(var dy=-1;dy<=1;dy++)for(var dx=-1;dx<=1;dx++){
      var r=COS_BOLT[y+dy];
      if(r&&r.charAt(x+dx)==='#')return true;
    }
    return false;
  }
  // a wing face, 10 across and 20 from the shoulder (row 0) to the tip: null (see-through) past
  // its outline, so the wing has a wing's shape: long feathers along the front edge (column 0)
  // getting shorter towards the back, each feather's tip apart from the next; a dragon wing is
  // a membrane between three bones, scalloped between them
  var COS_FEATHER=[20,18,19,17,17,15,16,14,14,12],COS_MEMBRANE=[20,18,16,17,19,16,14,15,17,13];
  function cosWingPx(w,x,y){
    var len=(w.membrane?COS_MEMBRANE:COS_FEATHER)[x];
    if(y>=len)return null;
    var c=cosMix(w.base[0],w.base[1],y/19);
    if(w.membrane){
      if(x===0||x===4||x===8)c=cosMix(w.gap,w.tip,y/40);           // the bones
      else if(y>=len-2)c=cosMix(c,w.tip,0.6);
    }else{
      if(y>=7&&(x&1)===1)c=cosMix(c,w.gap,0.5);                     // one long feather and the next
      if(y>=len-2)c=w.tip;
      if(y<7&&cosHash(x,y)%4===0)c=cosMix(c,w.tip,0.35);            // small feathers at the shoulder
      if(x===0&&y<len-2)c=cosMix(c,w.tip,0.25);                    // the front edge, lighter
    }
    return c;
  }
  // the elytra part of a texture: each wing's outside (36,2), inside (24,2) and edges. In box
  // terms (ModelBox) the outside face has column 0 at the box's +x edge and the inside face at its
  // -x edge, so the inside is painted mirrored and both have the same outline. With the wings
  // spread, the +x edge is the front edge of the wing (the edge face at 34) and -x the back (22).
  function cosPaintWings(img,w){
    var x,y,c;
    for(y=0;y<20;y++)for(x=0;x<10;x++){
      c=cosWingPx(w,x,y);
      if(c===null)continue;
      img[(2+y)*64+36+x]=cosOpaque(c);
      img[(2+y)*64+24+(9-x)]=cosOpaque(cosMix(c,0,0.25));
    }
    // (the shoulder end is closed; the tip end stays see-through, as the feathers end unevenly)
    for(x=0;x<10;x++)for(y=0;y<2;y++)img[y*64+24+x]=cosOpaque(w.gap);
    for(y=0;y<20;y++)for(x=0;x<2;x++){
      if(cosWingPx(w,0,y)!==null)img[(2+y)*64+34+x]=cosOpaque(w.gap);
      if(cosWingPx(w,9,y)!==null)img[(2+y)*64+22+x]=cosOpaque(w.gap);
    }
  }
  // a cape: outside (1,1) and inside (12,1), 10x16 each, with its edges, 32 pixels across
  var COS_CW=32;
  function cosPaintCape(d){
    var img=new Int32Array(COS_CW*32),x,y,c,W2=COS_CW;
    for(y=0;y<16;y++)for(x=0;x<10;x++){
      c=cosMix(d.bg[0],d.bg[1],y/15);
      if(d.extra==='stars'&&cosHash(x,y)%9===0)c=cosHash(y,x)%2?0xffffff:0xffc8f0;
      if(d.extra==='rain'&&(x*3+y*2)%7===0)c=cosMix(c,0xc8d8e8,0.35);
      if(x===0||x===9||y===15)c=d.edge;
      if(COS_BOLT[y].charAt(x)==='#')c=d.bolt;
      else if(cosBoltEdge(x,y))c=d.boltEdge;
      img[(1+y)*W2+1+x]=cosOpaque(c);                                         // outside
      img[(1+y)*W2+12+x]=cosOpaque(cosMix(cosMix(d.bg[0],d.bg[1],y/15),0,0.35));  // inside
    }
    for(x=0;x<10;x++){img[1+x]=cosOpaque(d.edge);img[11+x]=cosOpaque(d.edge);}
    for(y=0;y<16;y++){img[(1+y)*W2]=cosOpaque(d.edge);img[(1+y)*W2+11]=cosOpaque(d.edge);}
    return img;
  }
  // an elytra in a cape's colours
  function cosPaintCapeEl(d){var img=new Int32Array(64*32);cosPaintWings(img,{base:d.bg,tip:d.edge,gap:cosMix(d.bg[0],0,0.4)});return img;}
  function cosPaintWingTex(w){var img=new Int32Array(64*32);cosPaintWings(img,w);return img;}

  // ---- the game textures, made on the game thread the first time they are drawn ----
  // (a DynamicTexture's ints go to the GPU byte for byte as RGBA, so they hold 0xAABBGGRR)
  function cosABGR(px){
    var o=new Int32Array(px.length),i,c;
    for(i=0;i<px.length;i++){c=px[i];o[i]=(c&0xff00ff00)|((c&255)<<16)|((c>>16)&255);}
    return o;
  }
  var COS_TEX={};
  // kind: cape (32x32), capeel (an elytra in a cape's colours) or wings (64x32)
  function cosTex(kind,id){
    var k=kind+':'+id,t=COS_TEX[k];
    if(t)return t.loc;
    var d=cosFind(kind==='wings'?COS_WINGS:COS_CAPES,id);
    if(!d||!HEN||!HEN.bH)return null;
    var w=kind==='cape'?COS_CW:64;
    t=COS_TEX[k]={loc:null,tex:null,px:kind==='cape'?cosPaintCape(d):kind==='capeel'?cosPaintCapeEl(d):cosPaintWingTex(d)};
    runOnGame([
      function(){if(!t.tex)t.tex=new YW();Fl7(t.tex,w,32);},
      function(){t.tex.a45.data.set(cosABGR(t.px));Egf(t.tex);},
      function(){var l=EpG(HEN.bH,$rt_str('thunder_'+kind+'_'+id),t.tex);if(!$rt_suspending())t.loc=l;}
    ]);
    return null;
  }

  // ---- who has what ----
  var COS={cache:{},asked:{},askAt:0,sent:'',ws:null};
  function cosNameOf(p){
    try{
      var s=p&&p.BS&&p.BS.lN;
      if(!s)return '';
      if(p.$thNs!==s){p.$thNs=s;p.$thN=String($rt_ustr(s));}
      return p.$thN;
    }catch(_){return '';}
  }
  // this player's {cape, wings} (ids, or "none"), or null
  function cosOf(p){
    if(!p||!(p instanceof Vh))return null;
    if(HEN&&p===HEN.v)return {cape:S.cosmCape,wings:S.cosmWings};
    if(!S.cosmOthers)return null;
    var c=COS.cache[cosNameOf(p).toLowerCase()];
    return c&&c.v;
  }
  // the cosmetics of the players around you: asked for names not known (or known for 3 minutes)
  function cosAsk(){
    if(!soReady()||!HEN||!HEN.X)return;
    var list=HEN.X.e4,n=list?EH(list):0,i,p,nm,t=Date.now(),want=[];
    for(i=0;i<n&&want.length<64;i++){
      p=Bm(list,i);
      if(!p||p===HEN.v)continue;
      nm=cosNameOf(p).toLowerCase();
      if(!/^[a-z0-9_]{1,16}$/.test(nm))continue;
      var c=COS.cache[nm];
      if(c&&t-c.at<180000)continue;
      if(COS.asked[nm]&&t-COS.asked[nm]<15000)continue;
      want.push(nm);
    }
    if(!want.length||t-COS.askAt<3000)return;
    COS.askAt=t;
    want.forEach(function(nm){COS.asked[nm]=t;});
    soSend({t:'cosmq',names:want});
  }
  function cosAnswer(m){
    var t=Date.now(),got={};
    (Array.isArray(m.set)?m.set:[]).forEach(function(r){
      if(!Array.isArray(r)||typeof r[0]!=='string')return;
      got[r[0]]={cape:cosFind(COS_CAPES,r[1])?r[1]:'none',wings:cosFind(COS_WINGS,r[2])?r[2]:'none'};
    });
    (Array.isArray(m.asked)?m.asked:[]).forEach(function(nm){
      if(typeof nm!=='string')return;
      COS.cache[nm]={v:got[nm]||null,at:t};delete COS.asked[nm];
    });
  }
  // your picks and in-game name go to the hub (again after each new connection)
  function cosPublish(){
    if(!soReady())return;
    if(SO.ws!==COS.ws){COS.ws=SO.ws;COS.sent='';}
    var name=lanMyName();
    if(!/^[A-Za-z0-9_]{1,16}$/.test(name))return;
    var cape=cosFind(COS_CAPES,S.cosmCape)?S.cosmCape:'none',wings=cosFind(COS_WINGS,S.cosmWings)?S.cosmWings:'none',key=name+'|'+cape+'|'+wings;
    if(key===COS.sent)return;
    if(soSend({t:'cosm',name:name,cape:cape,wings:wings}))COS.sent=key;
  }
  W.setInterval(function(){try{cosPublish();cosAsk();}catch(e){report(e);}},2000);

  // ---- drawing ----
  var origDQF=DQF;
  DQF=function(a){
    if(!$rt_resuming()){
      var c=cosOf(a);
      if(c&&c.cape&&c.cape!=='none'){var l=cosTex('cape',c.cape);if(l)return l;}
    }
    return origDQF(a);
  };
  // a real elytra: drawn with the player's Thunder wings, else in their Thunder cape's colours
  var origDv7=Dv7;
  Dv7=function(a){
    if(!$rt_resuming()){
      var c=cosOf(a),l=null;
      if(c&&c.wings&&c.wings!=='none')l=cosTex('wings',c.wings);
      else if(c&&c.cape&&c.cape!=='none')l=cosTex('capeel',c.cape);
      if(l)return l;
    }
    return origDv7(a);
  };
  // Thunder wings spread up and out from the back like a bird's, slowly beating (t: the player's
  // age in ticks). rotateAngleX A tilts them back, rotateAngleY bb sweeps them back and
  // rotateAngleZ bX opens them out: -pi/2 is straight out to the side, as the game's own pose when
  // gliding, and beyond that they rise. The game's pose (standing: -0.26; gliding: -pi/2) says how
  // far into gliding the player is, and the spread blends into it.
  var COS_POSE={x:0.3,y:0.35,z:-2.0,flap:0.16,speed:0.12,scale:1.3};
  function cosPose(m,p,t){
    var o=cosOf(p);
    if(!o||!o.wings||o.wings==='none')return;
    var L=m.bo4,R=m.bFn,P=COS_POSE,b=Math.sin(t*P.speed)*P.flap;
    var k=Math.max(0,Math.min(1,(-L.bX-0.27)/1.3)),x=P.x,y=P.y+b*0.5,z=P.z-b;
    L.A=x+(L.A-x)*k;L.bb=y+(L.bb-y)*k;L.bX=z+(L.bX-z)*k;L.cD=5;
    R.A=L.A;R.bb=-L.bb;R.bX=-L.bX;R.cD=-5;
  }
  // ModelElytra.setRotationAngles(limbSwing, amount, ageInTicks, headYaw, headPitch, scale,
  // entity): the game's pose first (it may pause the game thread: carried on when it resumes)
  var origDqG=DqG;
  DqG=function(a,b,c,d,e,f,g,h){
    var st=0;
    if($rt_resuming())st=$rt_nativeThread().pop();
    if(st===0){
      origDqG(a,b,c,d,e,f,g,h);
      if($rt_suspending()){$rt_nativeThread().push(0);return;}
    }
    cosPose(a,h,d);
  };
  var origEDX=EDX;
  EDX=function(a,b,c,d,e,f,g,h,i){
    var st,w;
    if($rt_resuming()){st=$rt_nativeThread().pop();w=$rt_nativeThread().pop();}
    else{
      var o=cosOf(b),loc=o&&o.wings&&o.wings!=='none'?cosTex('wings',o.wings):null;
      w=loc?{loc:loc,inv:false,v:null}:null;
      st=w?1:20;
    }
    for(;;){
      switch(st){
        case 1:w.inv=DfI(b);break;                              // invisible: no wings
        case 2:if(w.inv){st=19;break;}w.v=b.yE(HIj);break;
        case 3:if(C51(w.v)===HHz)st=19;break;                   // a real elytra: the game draws it
        case 4:CFi(1.0,1.0,1.0,1.0);break;
        case 5:FTb(a.bcC,w.loc);break;
        case 6:Eu0();break;
        case 7:DPm(0.0,0.0,0.125);break;
        case 8:FWK(COS_POSE.scale,COS_POSE.scale,COS_POSE.scale);break;   // bigger than an elytra
        case 9:DqG(a.ckw,c,d,f,g,h,i,b);break;
        case 10:Dju(a.ckw,b,c,d,f,g,h,i);break;
        case 11:ECi();st=19;break;
        case 20:origEDX(a,b,c,d,e,f,g,h,i);break;
      }
      if($rt_suspending()){$rt_nativeThread().push(w);$rt_nativeThread().push(st);return;}
      if(st>=20)return;
      st++;
    }
  };

  // ---- Right Shift > Cosmetics ----
  // a design drawn big: a cape's outside, or a pair of wings
  function cosPreview(kind,d,scale){
    var cv=D.createElement('canvas'),cape=kind==='cape',w=cape?10:20,h=cape?16:20,ctx;
    cv.width=w*scale;cv.height=h*scale;
    try{ctx=cv.getContext('2d');}catch(_){return cv;}
    if(!ctx)return cv;
    var px=cape?cosPaintCape(d):cosPaintWingTex(d),x,y,c;
    for(y=0;y<h;y++)for(x=0;x<w;x++){
      if(cape)c=px[(1+y)*COS_CW+1+x];
      else c=px[(2+y)*64+36+(x<10?9-x:x-10)];
      if(!(c>>>24))continue;
      ctx.fillStyle='rgb('+(c>>16&255)+','+(c>>8&255)+','+(c&255)+')';
      ctx.fillRect(x*scale,y*scale,scale,scale);
    }
    return cv;
  }
  function cosPicker(kind){
    return function(box){
      var list=kind==='cape'?COS_CAPES:COS_WINGS,key=kind==='cape'?'cosmCape':'cosmWings',grid=el('div','tcm-cos');
      function pick(id){S[key]=id;save();cosPublish();paint();}
      var none=el('button','tcm-cos-b');none.type='button';none.appendChild(el('span','tcm-cos-none','\u2014'));none.appendChild(el('em',null,'None'));
      none.addEventListener('click',function(){pick('none');});
      grid.appendChild(none);
      var btns=[none];none.$id='none';
      list.forEach(function(d){
        var b=el('button','tcm-cos-b');b.type='button';b.title=d.name;b.$id=d.id;
        b.appendChild(cosPreview(kind,d,kind==='cape'?3:2));b.appendChild(el('em',null,d.name));
        b.addEventListener('click',function(){pick(d.id);});
        grid.appendChild(b);btns.push(b);
      });
      box.appendChild(grid);
      var note=el('div','tcm-note');box.appendChild(note);
      function paint(){
        btns.forEach(function(b){b.className='tcm-cos-b'+(b.$id===(S[key]||'none')?' tcm-on':'');});
        note.textContent=soReady()&&SO.me?'Everyone on Thunder sees it on '+(lanMyName()||'you')+' (press F5 to see it yourself).':
          'Sign in to Thunder Friends (Friends tab) so other Thunder players see it. You see it now in third person (F5).';
      }
      paint();addLive(paint);
    };
  }
  SPECIALS.cosmcape=cosPicker('cape');
  SPECIALS.cosmwings=cosPicker('wings');
  ICONS.cosmetics='<path d="M8 3h8l4 4-3 3v11H7V10L4 7z"/><path d="M12 7.5 10 12h3l-2 4.5"/>';
  (function(){var i=-1;for(var j=0;j<CATEGORIES.length;j++)if(CATEGORIES[j].id==='visual')i=j;CATEGORIES.splice(i<0?CATEGORIES.length:i+1,0,{id:'cosmetics',name:'Cosmetics'});})();
  MODULES.push(
    {cat:'cosmetics',id:null,name:'Cape',wide:true,special:'cosmcape',
      desc:'A Thunder cape, free. Everyone on Thunder Client sees it on you; it shows when your cape is on in Options > Skin Customization. A real elytra you wear takes its colours.'},
    {cat:'cosmetics',id:null,name:'Wings',wide:true,special:'cosmwings',
      desc:'Thunder wings, free, slowly beating on your back. Everyone on Thunder Client sees them. They hide while you wear an elytra or are invisible.'},
    {cat:'cosmetics',id:'cosmOthers',name:'Show other players\' cosmetics',
      desc:'Draw the Thunder capes and wings of the other Thunder players around you.'});
  TC.cosmetics={cache:COS.cache,pose:COS_POSE,capes:COS_CAPES.map(function(d){return d.id;}),wings:COS_WINGS.map(function(d){return d.id;}),
    tex:function(k,id){return !!cosTex(k,id);},of:function(p){return cosOf(p);},paintCape:function(id){return cosPaintCape(cosFind(COS_CAPES,id));}};
