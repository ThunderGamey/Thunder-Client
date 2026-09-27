  /* -------------------------------------------------------------------------------------------
     Thunder title screen: an animated storm behind the title screen and the Thunder logo.
     Included into the client scope of thunder-client.js by build.js.

     Background. GuiMainMenu.renderSkybox draws the rotating panorama before anything else on the
     title screen; with "Thunder Title Screen" on, this module draws the storm there instead, so
     the logo, splash text and buttons are still drawn on top of it by the game. Two passes with
     the same exact GL state save/restore as the shaders module: clouds at a fraction of the
     resolution (the expensive part), then one full-resolution pass for stars, the lightning
     bolt, sparks, the far hills and a blocky skyline with trees. Every layer moves by its own
     amount with the mouse (parallax). WebGL 2 only; anything else, or any error, falls back to
     the vanilla panorama for the rest of the session.

     Logo. The title screen draws textures/gui/title/minecraft.png (two 155x44 halves) and
     edition.png (98x14). With "Thunder logo" on, both resource locations are pointed at Thunder
     DynamicTextures (TextureManager.loadTexture), so the game draws THUNDER / CLIENT pixel art in
     their place with its own code; switching it off removes them from the texture manager and
     the game loads its own images again.

     Game functions this module replaces (each wrapper falls through to the original):
     @hook Dit net.minecraft.client.gui.GuiMainMenu.renderSkybox
     @hook DNB net.minecraft.client.gui.Gui.drawGradientRect

     Game functions and classes it uses:
     @use GCZ net.minecraft.client.renderer.texture.TextureManager.loadTexture
     @use Cq8 net.minecraft.client.renderer.texture.TextureManager.deleteTexture
     @use FGe java.util.HashMap.remove
     @class Hj net.minecraft.client.gui.GuiMainMenu
     @static LpF net.minecraft.client.gui.GuiMainMenu MINECRAFT_TITLE_TEXTURES (textures/gui/title/minecraft.png)
     @static LpG net.minecraft.client.gui.GuiMainMenu field_194400_H (textures/gui/title/edition.png)

     Instance fields:
     @field cEl net.minecraft.client.gui.GuiMainMenu.drawScreen GuiMainMenu.minceraftRoll
     @field gj net.minecraft.client.gui.GuiMainMenu.renderSkybox Minecraft.displayWidth
     @field fU net.minecraft.client.gui.GuiMainMenu.renderSkybox Minecraft.displayHeight
     @field bH net.minecraft.client.gui.GuiMainMenu.renderSkybox Minecraft.renderEngine
     @field blz net.minecraft.client.renderer.texture.TextureManager.bindTexture TextureManager.mapTextureObjects
     @field a3j net.minecraft.client.renderer.texture.TextureManager.bindTexture ResourceLocation.cachedPointerType
     @field Ra net.minecraft.client.renderer.texture.TextureManager.bindTexture ResourceLocation.cachedPointer
  ------------------------------------------------------------------------------------------- */

  // ---- shaders --------------------------------------------------------------------------------
  // p = centred coordinates in screen heights: x in [-aspect/2, aspect/2], y in [-0.5, 0.5]
  var TB_COMMON=
    'float hash(vec2 p){p=fract(p*vec2(123.34,456.21));p+=dot(p,p+45.32);return fract(p.x*p.y);}\n'+
    'float hash1(float x){return fract(sin(x*127.1)*43758.5453);}\n'+
    'float noise(vec2 p){vec2 i=floor(p),f=fract(p);vec2 u=f*f*(3.0-2.0*f);\n'+
    '  return mix(mix(hash(i),hash(i+vec2(1,0)),u.x),mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),u.x),u.y);}\n';
  // clouds: sky gradient with a glow behind the logo, far and near storm clouds (domain-warped
  // fbm) whose thin edges catch the glow, all lit by the lightning flash
  var TB_FS_CLOUDS=
    'precision highp float;\nin vec2 v_uv;\nout vec4 o_col;\n'+
    'uniform float u_aspect,u_time;uniform vec2 u_par;uniform vec4 u_flash;\n'+TB_COMMON+
    'const mat2 M=mat2(1.6,1.2,-1.2,1.6);\n'+
    'float fbm(vec2 p){float s=0.0,a=0.5;for(int i=0;i<OCT;i++){s+=a*noise(p);p=M*p;a*=0.5;}return s;}\n'+
    'void main(){\n'+
    '  vec2 p=vec2((v_uv.x-0.5)*u_aspect,v_uv.y-0.5);float y=v_uv.y+u_par.y*0.004;\n'+
    '  vec3 hor=vec3(0.080,0.165,0.225),mid=vec3(0.032,0.070,0.120),top=vec3(0.010,0.020,0.042);\n'+
    '  vec3 sky=mix(hor,mid,smoothstep(0.14,0.55,y));sky=mix(sky,top,smoothstep(0.55,1.0,y));\n'+
    '  vec2 g=(p-vec2(0.0,0.26))*vec2(0.80,1.70);float glow=exp(-dot(g,g)*2.4);\n'+
    '  sky+=vec3(0.05,0.19,0.30)*glow*0.60;\n'+
    '  float fl=u_flash.z*exp(-length(p-u_flash.xy)/u_flash.w);\n'+
    '  vec2 q=p*1.5+vec2(u_time*0.012,0.0)+u_par*0.03;\n'+
    '  float w=fbm(q*0.7+vec2(0.0,u_time*0.005));float far=fbm(q+vec2(w*1.5,w*0.7));\n'+
    '  float cF=smoothstep(0.24,0.60,far)*smoothstep(0.02,0.32,y);float rF=cF*(1.0-cF)*4.0;\n'+
    '  vec3 farCol=mix(vec3(0.060,0.095,0.140),vec3(0.150,0.215,0.290),smoothstep(0.50,0.90,far));\n'+
    '  farCol+=vec3(0.10,0.26,0.36)*rF*(0.30+0.9*glow)+vec3(0.60,0.80,1.00)*fl*(0.55+far);\n'+
    '  vec2 r=p*2.1+vec2(u_time*0.024,0.0)+u_par*0.06;\n'+
    '  float w2=fbm(r*0.6-vec2(u_time*0.007,0.0));float nr=fbm(r+vec2(w2*1.8,-w2));\n'+
    '  float cN=smoothstep(0.42,0.72,nr)*smoothstep(0.38,0.78,y);float rN=cN*(1.0-cN)*4.0;\n'+
    '  vec3 nearCol=vec3(0.018,0.030,0.050)+vec3(0.10,0.28,0.40)*rN*(0.30+0.9*glow);\n'+
    '  nearCol+=vec3(0.50,0.70,1.00)*fl*0.85*(0.30+nr);\n'+
    '  sky+=vec3(0.30,0.46,0.66)*fl*0.50;\n'+
    '  vec3 col=mix(sky,farCol,cF);col=mix(col,nearCol,cN);\n'+
    '  o_col=vec4(col,max(cF,cN));\n'+
    '}\n';
  // the bolt: a main channel and up to two branches in one point list; a point with x > 50
  // separates them (no segment is drawn across it)
  var TB_BOLT_N=30;
  var TB_FS_SCENE=
    'precision highp float;\nin vec2 v_uv;\nout vec4 o_col;\n'+
    'uniform sampler2D u_clouds;uniform float u_aspect,u_time,u_boltN,u_boltA,u_spark,u_dim;uniform vec2 u_par,u_px;\n'+
    'uniform vec4 u_flash,u_boltBox;uniform vec2 u_bolt['+TB_BOLT_N+'];\n'+TB_COMMON+
    'float n1(float x){float i=floor(x),f=fract(x);return mix(hash1(i),hash1(i+1.0),f*f*(3.0-2.0*f));}\n'+
    'float fbm1(float x){float s=0.0,a=0.5;for(int i=0;i<4;i++){s+=a*n1(x);x*=2.03;a*=0.5;}return s;}\n'+
    // near ground: one height per block column, in whole blocks; some columns grow a tree
    'float colH(float i,float bs){return floor((-0.37+0.15*fbm1(i*bs*2.6+11.7))/bs)*bs;}\n'+
    'bool tree1(float i){return hash1(i*1.37+5.1)>0.89;}\n'+
    'bool tree(float i){return tree1(i)&&!tree1(i-1.0)&&!tree1(i-2.0)&&!tree1(i-3.0);}\n'+
    'void main(){\n'+
    '  vec2 uv=v_uv;vec2 p=vec2((uv.x-0.5)*u_aspect,uv.y-0.5);float px=u_px.y;\n'+
    '  vec4 cl=texture(u_clouds,uv);vec3 col=cl.rgb;\n'+
    // stars, only in clear sky
    '  vec2 sp=(p+u_par*0.01)*60.0;vec2 id=floor(sp),f=fract(sp)-0.5;float h=hash(id);\n'+
    '  if(h>0.93){vec2 o=vec2(hash(id+3.1),hash(id+7.7))-0.5;float d=length(f-o*0.7);\n'+
    '    float tw=0.6+0.4*sin(u_time*(1.0+h*3.0)+h*40.0);\n'+
    '    col+=vec3(0.75,0.90,1.0)*smoothstep(0.09,0.0,d)*tw*(1.0-cl.a)*smoothstep(0.35,0.70,uv.y)*0.8;}\n'+
    // lightning: distance to the polylines, only inside their bounding box
    '  if(u_boltN>1.5&&p.x>u_boltBox.x&&p.x<u_boltBox.z&&p.y>u_boltBox.y&&p.y<u_boltBox.w){\n'+
    '    float d=1e3;\n'+
    '    for(int i=0;i<'+(TB_BOLT_N-1)+';i++){if(float(i)>=u_boltN-1.0)break;\n'+
    '      vec2 a=u_bolt[i],b=u_bolt[i+1];if(a.x>50.0||b.x>50.0)continue;\n'+
    '      vec2 ba=b-a,pa=p-a;float t=clamp(dot(pa,ba)/max(dot(ba,ba),1e-6),0.0,1.0);d=min(d,length(pa-ba*t));}\n'+
    '    float core=smoothstep(1.8*px,0.4*px,d);float glow=exp(-d/(12.0*px))*0.55+exp(-d/(42.0*px))*0.25;\n'+
    '    col+=(vec3(0.85,0.97,1.0)*core+vec3(0.35,0.75,1.0)*glow)*u_boltA*(1.0-0.45*cl.a);}\n'+
    // sparks: cyan motes drifting upward, at most one per cell and never near its edge, so one
    // cell lookup per pixel finds it
    '  if(u_spark>0.5){vec2 s=(p+u_par*0.07)*9.0;s.y-=u_time*0.12;vec2 c=floor(s);float k=hash(c);\n'+
    '    if(k>0.55){vec2 m=c+0.25+0.5*vec2(hash(c+1.7),hash(c+9.3))+vec2(0.10*sin(u_time*0.7+k*20.0),0.0);\n'+
    '      float d=length(s-m)/9.0;float tw=0.5+0.5*sin(u_time*(2.0+k*3.0)+k*50.0);\n'+
    '      col+=vec3(0.35,0.85,1.0)*exp(-d/(2.2*px))*0.55*tw*smoothstep(0.02,0.25,uv.y);}}\n'+
    // far ridge: smooth hills in the haze, with a cyan rim that lights up with the flash
    '  float h1=-0.25+0.10*fbm1((p.x+u_par.x*0.05)*1.55+3.1)+u_par.y*0.012;\n'+
    '  float e1=smoothstep(0.0,1.5*px,h1-p.y);\n'+
    '  col=mix(col,vec3(0.030,0.058,0.086)+vec3(0.10,0.25,0.35)*u_flash.z*0.25,e1*0.92);\n'+
    '  col+=vec3(0.10,0.45,0.60)*exp(-abs(p.y-h1)/(2.0*px))*(0.15+0.8*u_flash.z)*0.5*step(p.y,h1+3.0*px);\n'+
    // near ground: blocky terrain and trees in silhouette, the top faces rim-lit
    '  float bs=1.0/54.0,x2=p.x+u_par.x*0.10,yy=p.y-u_par.y*0.022,ci=floor(x2/bs);\n'+
    '  float top=colH(ci,bs),solid=step(yy,top),sky2=top;\n'+
    // oak: trunk 3-4 blocks, two rows of leaves 5 wide around its top, one row 3 wide above
    '  for(int j=-2;j<=2;j++){float tj=ci+float(j);if(!tree(tj))continue;\n'+
    '    float hb=colH(tj,bs)+bs,th=(3.0+step(0.5,hash1(tj*7.3)))*bs,dj=abs(float(j));\n'+
    '    if(j==0&&yy<hb+th)solid=1.0;\n'+
    '    if(yy>=hb+th-2.0*bs&&yy<hb+th)solid=1.0;\n'+
    '    float ct=dj<1.5?hb+th+bs:hb+th;if(dj<1.5&&yy>=hb+th&&yy<ct)solid=1.0;sky2=max(sky2,ct);}\n'+
    '  col=mix(col,vec3(0.008,0.015,0.024),solid);\n'+
    '  col+=vec3(0.12,0.50,0.66)*step(sky2-2.0*px,yy)*step(yy,sky2)*solid*(0.30+0.9*u_flash.z)*0.55;\n'+
    '  float v=smoothstep(1.25,0.35,length(p*vec2(0.85,1.25)));col*=mix(0.55,1.0,v);\n'+
    '  col+=vec3(0.30,0.45,0.60)*u_flash.z*0.06;\n'+
    '  o_col=vec4(col*u_dim,1.0);\n'+
    '}\n';
  var TB_VS='#version 300 es\nout vec2 v_uv;\n'+
    'void main(){vec2 p=vec2(float((gl_VertexID<<1)&2),float(gl_VertexID&2));v_uv=p;gl_Position=vec4(p*2.0-1.0,0.0,1.0);}\n';
  // copies the finished storm (drawn once per frame into its own texture) to the screen
  var TB_FS_COPY='precision highp float;\nin vec2 v_uv;\nout vec4 o_col;\nuniform sampler2D u_src;uniform float u_dim;\n'+
    'void main(){o_col=vec4(texture(u_src,v_uv).rgb*u_dim,1.0);}\n';
  // quality: 1 low, 2 medium, 3 high -> cloud resolution divisor, fbm octaves and the storm's own
  // resolution divisor (Low draws it at half size: a quarter of the pixels)
  var TB_Q={1:{div:4,oct:3,spark:1,sdiv:2},2:{div:3,oct:4,spark:1,sdiv:1},3:{div:2,oct:5,spark:1,sdiv:1}};

  // ---- GL resources ---------------------------------------------------------------------------
  var TB=null,tbFail=null,tbDrawn=false,tbFrames=0,tbHold=0,tbSt={tex:[],smp:[],caps:[],vp:[0,0,0,0],done:false};
  function tbProgram(gl,vs,fsBody,names,samplers){
    var f=gl.createShader(gl.FRAGMENT_SHADER),p=gl.createProgram();
    gl.shaderSource(f,'#version 300 es\n'+fsBody);gl.compileShader(f);
    gl.attachShader(p,vs);gl.attachShader(p,f);gl.linkProgram(p);
    return {p:p,f:f,names:names,samplers:samplers,u:null};
  }
  function tbInit(gl){
    var vs=gl.createShader(gl.VERTEX_SHADER);
    gl.shaderSource(vs,TB_VS);gl.compileShader(vs);
    var R={gl:gl,vs:vs,vao:gl.createVertexArray(),par:gl.getExtension('KHR_parallel_shader_compile'),clouds:{},
      scene:null,copy:null,tc:null,ts:null,t0:now(),last:0,dtAvg:16,slow:0,auto:2,fid:-1,fw:0,fh:0,q:0,lv:[0,0],sb:null,skipN:0};
    R.scene=tbProgram(gl,vs,TB_FS_SCENE,['u_clouds','u_aspect','u_time','u_boltN','u_boltA','u_spark','u_dim','u_par','u_px',
      'u_flash','u_boltBox','u_bolt'],{u_clouds:0});
    R.copy=tbProgram(gl,vs,TB_FS_COPY,['u_src','u_dim'],{u_src:0});
    return R;
  }
  function tbCloudProg(R,q){
    var c=R.clouds[q];
    if(!c)c=R.clouds[q]=tbProgram(R.gl,R.vs,'#define OCT '+TB_Q[q].oct+'\n'+TB_FS_CLOUDS,['u_aspect','u_time','u_par','u_flash'],{});
    return c;
  }
  // true once linked (never blocks a frame when KHR_parallel_shader_compile is there)
  function tbReady(R,pr){
    if(pr.u)return true;
    var gl=R.gl;
    if(R.par&&!gl.getProgramParameter(pr.p,R.par.COMPLETION_STATUS_KHR))return false;
    if(!gl.getProgramParameter(pr.p,gl.LINK_STATUS)){
      var log=(gl.getShaderInfoLog(pr.f)||'')+' '+(gl.getProgramInfoLog(pr.p)||'');
      throw new Error('title background shader failed: '+log.replace(/\s+/g,' ').trim().slice(0,300));
    }
    var u={};
    pr.names.forEach(function(k){u[k]=gl.getUniformLocation(pr.p,k);});
    gl.useProgram(pr.p);
    for(var n in pr.samplers)gl.uniform1i(u[n],pr.samplers[n]);
    pr.u=u;
    return true;
  }
  // an RGBA8 render target (t: previous one, reused while the size is the same)
  function tbTarget(gl,t,w,h,filter){
    if(t&&t.w===w&&t.h===h)return t;
    if(t){gl.deleteFramebuffer(t.fbo);gl.deleteTexture(t.tex);}
    t={tex:gl.createTexture(),fbo:gl.createFramebuffer(),w:w,h:h};
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D,t.tex);
    gl.texStorage2D(gl.TEXTURE_2D,1,gl.RGBA8,w,h);
    gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,filter);
    gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,filter);
    gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);
    gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER,t.fbo);
    gl.framebufferTexture2D(gl.DRAW_FRAMEBUFFER,gl.COLOR_ATTACHMENT0,gl.TEXTURE_2D,t.tex,0);
    if(gl.checkFramebufferStatus(gl.DRAW_FRAMEBUFFER)!==gl.FRAMEBUFFER_COMPLETE)throw new Error('title background framebuffer is incomplete');
    return t;
  }

  // ---- mouse parallax -------------------------------------------------------------------------
  var tbMouse={tx:0,ty:0,x:0,y:0};
  // capture phase: the game stops mouse events on its canvas, so they never bubble up to window
  W.addEventListener('mousemove',function(e){
    var w=W.innerWidth||1,h=W.innerHeight||1;
    tbMouse.tx=clamp(e.clientX/w*2-1,-1,1);tbMouse.ty=clamp(1-e.clientY/h*2,-1,1);
  },{capture:true,passive:true});
  W.addEventListener('mouseout',function(e){if(!e.relatedTarget){tbMouse.tx=0;tbMouse.ty=0;}},{capture:true,passive:true});

  // ---- lightning --------------------------------------------------------------------------------
  // A strike: a jagged bolt from above the screen down to the far hills (midpoint displacement)
  // with one or two branches, and a quick double flicker; sometimes only a flash inside the clouds.
  var tbBolt={pts:new Float32Array(TB_BOLT_N*2),n:0,box:[0,0,0,0],start:-1,sheet:false,cx:0,cy:0.3,rad:0.55,next:0};
  function tbPath(x0,y0,x1,y1,rough,max){
    var pts=[[x0,y0],[x1,y1]];
    while(pts.length*2-1<=max){
      var out=[pts[0]];
      for(var i=1;i<pts.length;i++){
        var a=pts[i-1],b=pts[i];
        out.push([(a[0]+b[0])/2+(Math.random()-0.5)*rough,(a[1]+b[1])/2+(Math.random()-0.5)*rough*0.25]);
        out.push(b);
      }
      pts=out;rough*=0.55;
    }
    return pts;
  }
  function tbStrike(t,aspect){
    var B=tbBolt,half=aspect/2,i;
    B.start=t;B.sheet=Math.random()<0.3;
    B.next=t+3.5+Math.random()*5.5;
    var x0=(Math.random()*1.4-0.7)*half,x1=x0+(Math.random()-0.5)*0.35;
    var main=tbPath(x0,0.58,x1,-0.22+Math.random()*0.06,0.16,17),all=main.slice();
    for(var k=0;k<2;k++){
      if(k&&Math.random()<0.5)break;
      var st=main[4+Math.floor(Math.random()*7)],dir=Math.random()<0.5?-1:1;
      var br=tbPath(st[0],st[1],st[0]+dir*(0.08+Math.random()*0.16),st[1]-0.10-Math.random()*0.16,0.07,5);
      all.push([99,0]);all=all.concat(br);
    }
    var n=Math.min(all.length,TB_BOLT_N),mnx=1e9,mny=1e9,mxx=-1e9,mxy=-1e9;
    for(i=0;i<n;i++){
      B.pts[i*2]=all[i][0];B.pts[i*2+1]=all[i][1];
      if(all[i][0]>50)continue;
      mnx=Math.min(mnx,all[i][0]);mxx=Math.max(mxx,all[i][0]);mny=Math.min(mny,all[i][1]);mxy=Math.max(mxy,all[i][1]);
    }
    B.n=B.sheet?0:n;
    B.box=[mnx-0.12,mny-0.12,mxx+0.12,mxy+0.12];
    B.cx=B.sheet?(Math.random()*1.4-0.7)*half:x0*0.8;B.cy=B.sheet?0.12+Math.random()*0.3:0.30;
    B.rad=B.sheet?0.75:0.55;
  }
  // flash and bolt brightness over the strike: flicker, dip, second stroke, afterglow
  function tbStrikeLevel(dt){
    if(dt<0)return [0,0];
    var f=0,b=0;
    if(dt<0.05)f=dt/0.05;else if(dt<0.09)f=1-(dt-0.05)/0.04*0.7;else if(dt<0.13)f=0.3+(dt-0.09)/0.04*0.6;
    else f=0.9*Math.exp(-(dt-0.13)*5.5);
    b=dt<0.32?(dt<0.09||dt>0.13?1:0.35)*(dt<0.25?1:1-(dt-0.25)/0.07):0;
    return [f,b];
  }

  // ---- drawing ----------------------------------------------------------------------------------
  function tbQuality(R){
    var q=S.titleQuality|0;
    return q>=1&&q<=3?q:R.auto;
  }
  // Auto quality: step down (never up) when the title screen stays slower than ~30 FPS
  function tbAutoTune(R,dtMs){
    R.dtAvg+=(Math.min(dtMs,250)-R.dtAvg)*0.05;
    if((S.titleQuality|0)!==0||R.auto<=1)return;
    if(R.dtAvg>34)R.slow+=dtMs;else R.slow=Math.max(0,R.slow-dtMs);
    if(R.slow>4000){R.auto--;R.slow=0;R.dtAvg=16;}
  }
  // Draws the storm into the game's framebuffer. dim: 1 on the title screen, lower behind other
  // menus so their text stays easy to read. clip: null, or [x,y,w,h] in framebuffer pixels
  // (origin bottom left) to paint only that region (list headers and footers repaint the storm
  // over rows scrolled under them). The storm itself (timing, auto quality, parallax, lightning,
  // the low-resolution cloud pass and the scene pass into its own texture) is made once per
  // frame; every call then only copies that texture, so a menu that shows it several times
  // (background, list area, list header and footer) pays for it once.
  var tbFrameId=0;
  frameTasks.push(function(){tbFrameId++;});
  function tbStorm(mc,dim,clip){
    tbDrawn=false;
    if(tbFail)return false;
    var gl=HEl;
    if(!gl||HEv<300||typeof gl.createVertexArray!=='function'||!mc)return false;
    var fw=mc.gj|0,fh=mc.fU|0;
    if(fw<2||fh<2)return false;
    try{
      if(!TB||TB.gl!==gl)TB=tbInit(gl);
      var R=TB,q=tbQuality(R),Q=TB_Q[q],cp=tbCloudProg(R,q);
      shSave(gl,tbSt);                                            // tbReady may switch programs
      if(!tbReady(R,R.scene)||!tbReady(R,cp)||!tbReady(R,R.copy)){shRestore(gl,tbSt);return false;}   // still compiling: vanilla this frame
      var tn=now(),t=(tn-R.t0)/1000,aspect=fw/fh,B=tbBolt;
      shNeutral(gl,tbSt);
      gl.bindVertexArray(R.vao);
      var fresh=R.fid!==tbFrameId;
      if(fresh){                        // once per frame: timing, auto quality, parallax, lightning
        R.fid=tbFrameId;R.skipN++;
        var dtMs=R.last?tn-R.last:16;R.last=tn;
        if(dtMs>1000)dtMs=16;          // back on a storm screen after a while: not a slow frame
        tbAutoTune(R,dtMs);
        var k=1-Math.exp(-Math.min(dtMs,100)/1000*3.2),ps=clamp(Number(S.titleParallax)||0,0,100)/100;
        tbMouse.x+=(tbMouse.tx*ps-tbMouse.x)*k;tbMouse.y+=(tbMouse.ty*ps-tbMouse.y)*k;
        if(S.titleLightning){if(!B.next)B.next=t+1.5;if(t>=B.next)tbStrike(t,aspect);}
        else B.start=-1;
        R.lv=tbStrikeLevel(B.start<0?-1:(tbHold>tn?0.03:t-B.start));
      }
      // redrawn every frame, or every other frame on Low while frames are still slow (the copy
      // below still runs every frame); at once after a size or quality change
      if(!R.ts||R.fw!==fw||R.fh!==fh||R.q!==q||(fresh&&R.skipN>=(q===1&&R.dtAvg>30?2:1))){
        R.fw=fw;R.fh=fh;R.q=q;R.skipN=0;
        var cw=Math.max(8,Math.ceil(fw/Q.div)),ch=Math.max(8,Math.ceil(fh/Q.div));
        var sw=Math.max(8,Math.ceil(fw/Q.sdiv)),sh=Math.max(8,Math.ceil(fh/Q.sdiv));
        R.tc=tbTarget(gl,R.tc,cw,ch,gl.LINEAR);
        R.ts=tbTarget(gl,R.ts,sw,sh,gl.NEAREST);
        // pass 1: clouds at low resolution
        gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER,R.tc.fbo);gl.viewport(0,0,cw,ch);
        gl.useProgram(cp.p);
        gl.uniform1f(cp.u.u_aspect,aspect);gl.uniform1f(cp.u.u_time,t);
        gl.uniform2f(cp.u.u_par,tbMouse.x,tbMouse.y);gl.uniform4f(cp.u.u_flash,B.cx,B.cy,R.lv[0],B.rad);
        gl.drawArrays(gl.TRIANGLES,0,3);
        // pass 2: the storm (stars, lightning, sparks, hills, skyline) into its own texture
        var flash=R.lv[0],bolt=B.n?R.lv[1]:0;
        gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER,R.ts.fbo);gl.viewport(0,0,sw,sh);
        var sp=R.scene;gl.useProgram(sp.p);
        gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_2D,R.tc.tex);
        gl.uniform1f(sp.u.u_aspect,aspect);gl.uniform1f(sp.u.u_time,t);gl.uniform1f(sp.u.u_dim,1.0);
        gl.uniform1f(sp.u.u_boltN,bolt>0.001?B.n:0);gl.uniform1f(sp.u.u_boltA,bolt);gl.uniform1f(sp.u.u_spark,Q.spark);
        gl.uniform2f(sp.u.u_par,tbMouse.x,tbMouse.y);gl.uniform2f(sp.u.u_px,1/sw,1/sh);
        gl.uniform4f(sp.u.u_flash,B.cx,B.cy,flash,B.rad);
        gl.uniform4f(sp.u.u_boltBox,B.box[0],B.box[1],B.box[2],B.box[3]);
        gl.uniform2fv(sp.u.u_bolt,B.pts);
        gl.drawArrays(gl.TRIANGLES,0,3);
      }
      // copy to the game's framebuffer
      gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER,tbSt.draw);gl.viewport(0,0,fw,fh);
      if(clip){R.sb=gl.getParameter(gl.SCISSOR_BOX);gl.enable(gl.SCISSOR_TEST);gl.scissor(clip[0],clip[1],clip[2],clip[3]);}
      var co=R.copy;gl.useProgram(co.p);
      gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_2D,R.ts.tex);
      gl.uniform1f(co.u.u_dim,dim);
      gl.drawArrays(gl.TRIANGLES,0,3);
      if(clip){gl.disable(gl.SCISSOR_TEST);gl.scissor(R.sb[0],R.sb[1],R.sb[2],R.sb[3]);}
      shRestore(gl,tbSt);
      tbDrawn=true;
      return true;
    }catch(e){
      tbFail=e;
      try{if(tbSt.done)shRestore(gl,tbSt);}catch(_){}
      report(e);
      return false;
    }
  }

  var origDit=Dit;
  Dit=function(a,b,c,d){
    if(!$rt_resuming()){
      tbFrames++;
      if(S.titleLogo&&a)a.cEl=1.0;                    // no "Minceraft" roll: it cuts up the logo texture
      if(S.titleBg&&tbStorm(a.j,1.0,null))return;
      tbDrawn=false;
    }
    return origDit(a,b,c,d);
  };
  // the title screen lays a 50% white haze over the top of the panorama; over the dark storm it
  // would turn the sky grey, so it is left out while the storm is drawn
  var origDNB=DNB;
  DNB=function(a,b,c,d,e,f,g){
    if(tbDrawn&&f===-2130706433&&g===16777215&&!$rt_resuming()&&a instanceof Hj)return;
    return origDNB(a,b,c,d,e,f,g);
  };

  // ---- Thunder logo ---------------------------------------------------------------------------
  // 5x7 pixel font for THUNDER (5 texels per font pixel) and a small 3x5 / 4x5 one for CLIENT
  var TL_BIG={T:['11111','00100','00100','00100','00100','00100','00100'],
    H:['10001','10001','10001','11111','10001','10001','10001'],U:['10001','10001','10001','10001','10001','10001','01110'],
    N:['10001','11001','10101','10011','10001','10001','10001'],D:['11110','10001','10001','10001','10001','10001','11110'],
    E:['11111','10000','10000','11110','10000','10000','11111'],R:['11110','10001','10001','11110','10010','10001','10001']};
  var TL_SMALL={C:['111','100','100','100','111'],L:['100','100','100','100','111'],I:['111','010','010','010','111'],
    E:['111','100','110','100','111'],N:['1001','1101','1011','1001','1001'],T:['111','010','010','010','010']};
  function tlRGB(r,g,b){return 0xFF000000|(Math.round(r*255)<<16)|(Math.round(g*255)<<8)|Math.round(b*255);}
  // this build's DynamicTexture uploads its int[] as ABGR (bytes R,G,B,A); colours here are ARGB
  function tlABGR(c){return (c&0xFF00FF00)|((c>>>16)&0xFF)|((c&0xFF)<<16);}
  // THUNDER on a 310x44 canvas (face with a cyan-to-blue gradient and lit top edges, a 4-texel
  // extrusion, 1-texel outline), centred in the 274 texels the title screen shows, then split
  // into the two 155x44 halves the game draws: (0,0) and (0,45) of a 256x256 texture.
  function tlFillLogo(d){
    var LW=310,LH=44,S5=5,word='THUNDER',i,x,y,gx,gy,k;
    var face=new Uint8Array(LW*LH),ext=new Uint8Array(LW*LH),out=new W.Uint32Array(LW*LH);
    var gw=word.length*5+(word.length-1),ox=Math.round((274-gw*S5)/2),oy=1;
    for(k=0;k<word.length;k++){
      var glyph=TL_BIG[word.charAt(k)],bx=ox+k*6*S5;
      for(gy=0;gy<7;gy++)for(gx=0;gx<5;gx++){
        if(glyph[gy].charAt(gx)!=='1')continue;
        for(y=0;y<S5;y++)for(x=0;x<S5;x++)face[(oy+gy*S5+y)*LW+bx+gx*S5+x]=1;
      }
    }
    for(y=0;y<LH;y++)for(x=0;x<LW;x++){
      if(face[y*LW+x])continue;
      for(k=1;k<=4;k++)if(y-k>=0&&face[(y-k)*LW+x]){ext[y*LW+x]=k;break;}
    }
    var top=oy,bottom=oy+7*S5;
    for(y=0;y<LH;y++)for(x=0;x<LW;x++){
      var idx=y*LW+x,c=0;
      if(face[idx]){
        var tt=clamp((y-top)/(bottom-top),0,1);
        var r=0.62+(0.10-0.62)*tt,g=0.95+(0.42-0.95)*tt,b=1.0+(0.86-1.0)*tt;
        if(y===0||!face[idx-LW]){r=0.90;g=1.0;b=1.0;}                          // lit top edge
        else if((x+y)%7===0){r*=0.93;g*=0.95;b*=0.97;}                          // faint texture
        c=tlRGB(r,g,b);
      }else if(ext[idx]){
        var e=ext[idx];c=tlRGB(0.04+0.02*(4-e),0.14+0.03*(4-e),0.32+0.05*(4-e));
      }else{
        for(k=0;k<8&&!c;k++){
          var nx=x+[-1,0,1,-1,1,-1,0,1][k],ny=y+[-1,-1,-1,0,0,1,1,1][k];
          if(nx>=0&&ny>=0&&nx<LW&&ny<LH&&(face[ny*LW+nx]||ext[ny*LW+nx]))c=tlRGB(0.02,0.05,0.10);
        }
      }
      out[idx]=c;
    }
    for(i=0;i<d.length;i++)d[i]=0;
    for(y=0;y<LH;y++)for(x=0;x<LW;x++){
      c=out[y*LW+x];if(!c)continue;
      if(x<155)d[y*256+x]=tlABGR(c);else d[(y+45)*256+x-155]=tlABGR(c);
    }
  }
  // CLIENT, spaced out, cyan with a dark drop shadow, centred in the 98x14 part of a 128x16 texture
  function tlFillEdition(d){
    var word='CLIENT',S2=2,gap=2,i,k,x,y,gx,gy,w=0;
    for(k=0;k<word.length;k++)w+=TL_SMALL[word.charAt(k)][0].length+(k?gap:0);
    var ox=Math.round((98-w*S2)/2),oy=3,bx=ox;
    for(i=0;i<d.length;i++)d[i]=0;
    var shadow=tlABGR(tlRGB(0.02,0.06,0.13)),face=tlABGR(tlRGB(0.62,0.92,1.0));
    for(k=0;k<word.length;k++){
      var glyph=TL_SMALL[word.charAt(k)],gw=glyph[0].length;
      for(gy=0;gy<5;gy++)for(gx=0;gx<gw;gx++){
        if(glyph[gy].charAt(gx)!=='1')continue;
        for(y=0;y<S2;y++)for(x=0;x<S2;x++){
          var px=bx+gx*S2+x,py=oy+gy*S2+y;
          if(!d[(py+1)*128+px+1])d[(py+1)*128+px+1]=shadow;
          d[py*128+px]=face;
        }
      }
      bx+=(gw+gap)*S2;
    }
  }
  // install / remove on the game thread; the texture manager keeps them across resource reloads
  // (a DynamicTexture has nothing to reload)
  var tlState=0;          // 0 vanilla logo, 1 changing, 2 Thunder logo
  // Steps that make the texture manager forget a texture completely. deleteTexture only frees the
  // GL texture (1.12 leaves the map entry), and this build also caches the texture on the
  // ResourceLocation itself; without the other two steps the title screen keeps binding the
  // freed texture and draws black boxes. The next bindTexture then loads the game's own image.
  function tlForget(tm,loc){
    return [function(){Cq8(tm,loc);},function(){FGe(tm.blz,loc);},function(){loc.a3j=0;loc.Ra=null;}];
  }
  function tlInstall(){
    var tm=HEN.bH,L=new YW(),E=new YW();
    tlState=1;
    runOnGame(tlForget(tm,LpF).concat(tlForget(tm,LpG),[
      function(){Fl7(L,256,256);},function(){tlFillLogo(L.a45.data);},function(){Egf(L);},function(){GCZ(tm,LpF,L);},
      function(){Fl7(E,128,16);},function(){tlFillEdition(E.a45.data);},function(){Egf(E);},function(){GCZ(tm,LpG,E);},
      function(){tlState=2;}
    ]));
  }
  function tlRemove(){
    var tm=HEN.bH;
    tlState=1;
    runOnGame(tlForget(tm,LpF).concat(tlForget(tm,LpG),[function(){tlState=0;}]));
  }
  frameTasks.push(function(){
    if(tlState===1||!HEN||!HEN.bH||!LpF||!LpG)return;
    if(S.titleLogo&&tlState===0)tlInstall();
    else if(!S.titleLogo&&tlState===2)tlRemove();
  });

  // ---- menu -------------------------------------------------------------------------------------
  MODULES.push({cat:'visual',id:'titleBg',name:'Thunder Title Screen',
    desc:'Animated storm behind the title screen: clouds, lightning, sparks and a blocky skyline that shift with the mouse.',opts:[
      {id:'titleLogo',name:'Thunder logo'},
      {id:'titleLightning',name:'Lightning'},
      {id:'titleParallax',name:'Mouse parallax',min:0,max:100,step:5,fmt:shPct},
      {id:'titleQuality',name:'Quality',choices:['Auto','Low','Medium','High']}]});
  // for testing: strike on the next title frame, optionally holding the bolt for holdMs
  TC.title={strike:function(holdMs){tbBolt.next=-1;tbHold=holdMs>0?now()+holdMs:0;},
    state:function(){return {drawn:tbDrawn,failed:tbFail?String(tbFail.message||tbFail):null,logo:tlState,
    quality:TB?tbQuality(TB):0,auto:TB?TB.auto:0,frameMs:TB?Math.round(TB.dtAvg*10)/10:0,
    cloudRes:TB&&TB.tc?TB.tc.w+'x'+TB.tc.h:'-',stormRes:TB&&TB.ts?TB.ts.w+'x'+TB.ts.h:'-',
    frames:tbFrames,parallax:[Math.round(tbMouse.x*100)/100,Math.round(tbMouse.y*100)/100],bolt:tbBolt.sheet?'sheet':tbBolt.n};}};
