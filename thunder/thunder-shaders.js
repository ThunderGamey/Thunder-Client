  /* -------------------------------------------------------------------------------------------
     Thunder Shaders: optional screen-space post-processing of the world image.
     Included into the client scope of thunder-client.js by build.js. Design, presets, FPS
     safety and limits are described in thunder/SHADERS.md.

     Game function this module replaces (the wrapper always runs the original first):
     @hook Fjk net.minecraft.client.renderer.EntityRenderer.renderWorld

     Static fields written by one method (checked against that method's body):
     @staticset HEl net.lax1dude.eaglercraft.internal.PlatformOpenGL.setCurrentContext (the game's WebGL context)
     @staticset HEv net.lax1dude.eaglercraft.internal.PlatformOpenGL.setCurrentContext (its GLES version: 200 = WebGL 1, 300 = WebGL 2)
     @staticset HEh net.lax1dude.eaglercraft.opengl.GlStateManager.viewport (cached viewport x)
     @staticset HEi net.lax1dude.eaglercraft.opengl.GlStateManager.viewport (cached viewport y)
     @staticset HEj net.lax1dude.eaglercraft.opengl.GlStateManager.viewport (cached viewport width)
     @staticset HEk net.lax1dude.eaglercraft.opengl.GlStateManager.viewport (cached viewport height)
     @staticset KPa net.lax1dude.eaglercraft.opengl.GlStateManager.colorMask (cached color mask bits: r=1 g=2 b=4 a=8)
     In this build those two GlStateManager methods are the only in-game code that sets the GL
     viewport and color mask (the raw calls elsewhere are the early loading screen and the WebGL 1
     presenter), so their caches are exact. Reading them avoids two synchronous GL queries per
     frame; every other value below is answered by the browser's own WebGL bookkeeping.

     Where it runs in a frame (EntityRenderer.updateCameraAndRender in this build):
       renderWorld: sky, terrain, entities, hand, first-person overlays  -> Thunder pass runs right after
       then the HUD (Eaglercraft's cached GameOverlayFramebuffer), crosshair, chat, open screens
       then WebGLBackBuffer.flipBuffer copies the back buffer to the canvas
     So only the 3D world is processed; HUD, menus and text stay untouched.

     Rules this code follows:
       - Shaders OFF: the wrapper calls renderWorld and returns. No GL call, no allocation.
       - Every GL state it changes is read first and put back exactly (framebuffers, viewport,
         program, vertex array, texture units 0-3 and their samplers, enable flags, color mask),
         because Eaglercraft caches GL state (GlStateManager / EaglercraftGPU) and would otherwise
         draw with the wrong state.
       - Any error disables the pipeline for the session, restores state and leaves the game
         rendering normally.
  ------------------------------------------------------------------------------------------- */
  var SH_PRESETS=[                         // bloom at 1/2^res of the frame, then `levels` halvings
    {name:'LOW',res:3,levels:3},
    {name:'MEDIUM',res:2,levels:4},
    {name:'HIGH',res:1,levels:6}
  ];
  var SH_QUALITY=['LOW','MEDIUM','HIGH','CUSTOM'];
  var SH_CAPS=['PERFORMANCE','LOW','MEDIUM','FULL'];   // what auto quality currently allows
  var SH_LEARN_KEY='thunderShaderAuto_v1';
  var SH_SOFTWARE=/swiftshader|llvmpipe|softpipe|lavapipe|software|basic render|mesa offscreen/i;
  // Bloom threshold follows the scene's average brightness (measured on the GPU, eased over
  // adaptMs): dark scenes use thrDark so lights glow at night, bright ones thrBright so a sunny sky
  // does not wash out. knee is the soft-threshold width as a fraction of the headroom above the
  // threshold (soft at night, a sharp cut by day). scatter weights the wider blur levels.
  // Live-tunable from the console (ThunderClient.shaders.tune) while designing new looks.
  var SH_TUNE={thrDark:0.45,thrBright:0.9,knee:0.5,scatter:0.72,adaptMs:600};
  var SH_UNITS=4;

  // Effects, in the order they run inside the one full-screen composite pass. Each adds a GLSL
  // block that is compiled in only while the effect is on, reads its strength (percent) from
  // settings and is scaled by `max` and the master intensity. needs: 'chain' = blurred bloom
  // levels, 'history' = the previous frame. New effects are added here (see SHADERS.md).
  var SH_EFFECTS=[
    {id:'bloom',on:'shBloom',str:'shBloomStr',max:1.2,needs:'chain',u:'u_bloom',
      glsl:'c+=texture(u_bloomTex,v_uv).rgb*u_bloom;'},
    {id:'ambient',on:'shAmbient',str:'shAmbientStr',max:0.6,needs:'chain',u:'u_amb',
      glsl:'{vec4 w=texture(u_wideTex,v_uv);'+
        'c+=w.rgb*vec3(1.0,0.92,0.8)*(1.0-clamp(c,0.0,1.0))*(u_amb*1.5);'+
        'float l=luma(c),dark=1.0-smoothstep(0.03,0.35,w.a);'+
        'c+=vec3(0.86,0.93,1.0)*(u_amb*0.09*dark*smoothstep(0.0,0.2,l)*(1.0-l));}'},
    // grading: warm neutral highlights, cool shadows, then vibrance (dull colors gain the most
    // saturation). The tint is weighted by (1 - chroma), so saturated colors such as the sky keep
    // their hue instead of drifting toward grey.
    {id:'grade',on:'shGrade',str:'shGradeStr',max:1.0,u:'u_grade',
      glsl:'{float l=luma(c),ch=max(c.r,max(c.g,c.b))-min(c.r,min(c.g,c.b));'+
        'vec3 g=c+(vec3(0.05,0.018,-0.045)*smoothstep(0.35,0.95,l)+vec3(-0.02,0.0,0.03)*(1.0-smoothstep(0.0,0.4,l)))*(1.0-ch);'+
        'g=mix(vec3(luma(g)),g,1.0+0.35*(1.0-clamp(ch*1.6,0.0,1.0)));'+
        'c=mix(c,g,u_grade);}'},
    // contrast: S-curve on luminance only, applied by scaling the color (hue and saturation stay),
    // normalized so bright saturated colors cannot clip
    {id:'contrast',on:'shContrast',str:'shContrastStr',max:0.6,u:'u_con',
      glsl:'{vec3 x=clamp(c,0.0,1.0);float l=luma(x);vec3 y=x*(l*(3.0-2.0*l));'+
        'y/=max(1.0,max(y.r,max(y.g,y.b)));c=mix(c,y,u_con);}'},
    {id:'vignette',on:'shVignette',str:'shVignetteStr',max:0.55,u:'u_vig',
      glsl:'{vec2 d=(v_uv-0.5)*vec2(u_aspect,1.0);float r=length(d)/length(vec2(u_aspect,1.0)*0.5);'+
        'c*=1.0-u_vig*smoothstep(0.42,1.1,r);}'},
    {id:'motion',on:'shMotion',str:'shMotionStr',max:0.8,needs:'history',u:'u_mot',
      glsl:'c=mix(c,texture(u_histTex,v_uv).rgb,u_mot);'}
  ];

  // ---- GLSL (WebGL 2 / GLSL ES 3.00). One attribute-less full-screen triangle for every pass.
  var SH_VS='#version 300 es\nout vec2 v_uv;\n'+
    'void main(){vec2 p=vec2(float((gl_VertexID<<1)&2),float(gl_VertexID&2));v_uv=p;gl_Position=vec4(p*2.0-1.0,0.0,1.0);}\n';
  var SH_HEAD='#version 300 es\nprecision highp float;\nin vec2 v_uv;\nout vec4 o_col;\n'+
    'float luma(vec3 c){return dot(c,vec3(0.2126,0.7152,0.0722));}\n';
  // average scene brightness is kept in a 1x1 RGBA8 texture as 16-bit fixed point (r + g/255)
  var SH_EXPO='float expo(sampler2D t){vec4 e=texture(t,vec2(0.5));return e.r+e.g/255.0;}\n';
  // bright pass + first downsample: 4 taps; soft threshold on rgb, plain brightness in alpha
  // (Ambient Glow and the brightness measurement use it). Brightness is perceived luminance, or
  // the red/green peak for warm light (lava, fire, torches); blue alone does not count, so a clear
  // daytime sky does not bloom and wash out.
  var SH_FS_PRE=SH_HEAD+SH_EXPO+
    'uniform sampler2D u_src;uniform sampler2D u_expo;uniform vec2 u_off;uniform vec3 u_thr;\n'+
    'float t,kn;\n'+
    'vec3 knee(vec3 c){float br=max(luma(c),max(c.r,c.g)*0.9);float q=clamp(br-t+kn,0.0,2.0*kn);q=q*q/(4.0*kn);'+
      'return c*(max(q,br-t)/(max(br,1e-5)*max(1.0-t,0.05)));}\n'+   // excess over the threshold, rescaled to 0..1
    'void main(){'+
      'vec3 a=texture(u_src,v_uv-u_off).rgb,b=texture(u_src,v_uv+vec2(u_off.x,-u_off.y)).rgb,'+
      'c=texture(u_src,v_uv+vec2(-u_off.x,u_off.y)).rgb,d=texture(u_src,v_uv+u_off).rgb;'+
      't=mix(u_thr.x,u_thr.y,smoothstep(0.06,0.4,expo(u_expo)));kn=max(0.02,(1.0-t)*u_thr.z);'+   // threshold per tap: textured lights keep their bright texels
      'o_col=vec4((knee(a)+knee(b)+knee(c)+knee(d))*0.25,(luma(a)+luma(b)+luma(c)+luma(d))*0.25);}\n';
  // brightness measurement: average of the smallest bloom level, eased toward the new value
  var SH_FS_ADAPT=SH_HEAD+SH_EXPO+
    'uniform sampler2D u_src;uniform sampler2D u_expo;uniform float u_rate;\n'+
    'void main(){float s=0.0;for(int y=0;y<4;y++)for(int x=0;x<4;x++)s+=texture(u_src,(vec2(x,y)+0.5)*0.25).a;'+
      'float v=clamp(mix(expo(u_expo),s*0.0625,u_rate),0.0,1.0);'+
      'o_col=vec4(floor(v*255.0)/255.0,fract(v*255.0),0.0,1.0);}\n';
  // dual-filter downsample (5 taps) and upsample (8-tap tent) mixed with the matching level
  var SH_FS_DOWN=SH_HEAD+
    'uniform sampler2D u_src;uniform vec2 u_px;\n'+
    'void main(){vec4 s=texture(u_src,v_uv)*4.0;'+
      's+=texture(u_src,v_uv-u_px);s+=texture(u_src,v_uv+u_px);'+
      's+=texture(u_src,v_uv+vec2(u_px.x,-u_px.y));s+=texture(u_src,v_uv-vec2(u_px.x,-u_px.y));'+
      'o_col=s*0.125;}\n';
  var SH_FS_UP=SH_HEAD+
    'uniform sampler2D u_src;uniform sampler2D u_base;uniform vec2 u_px;uniform float u_scatter;\n'+
    'void main(){vec2 h=u_px*0.5;'+
      'vec4 s=texture(u_src,v_uv+vec2(-u_px.x,0.0))+texture(u_src,v_uv+vec2(u_px.x,0.0))'+
      '+texture(u_src,v_uv+vec2(0.0,-u_px.y))+texture(u_src,v_uv+vec2(0.0,u_px.y));'+
      's+=(texture(u_src,v_uv+vec2(-h.x,h.y))+texture(u_src,v_uv+h)'+
      '+texture(u_src,v_uv+vec2(h.x,-h.y))+texture(u_src,v_uv-h))*2.0;'+
      'o_col=mix(texture(u_base,v_uv),s/12.0,u_scatter);}\n';
  var SH_COMP_UNIFORMS=['u_scene','u_bloomTex','u_wideTex','u_histTex','u_aspect'];
  SH_EFFECTS.forEach(function(e){SH_COMP_UNIFORMS.push(e.u);});
  // debug views (console: ThunderClient.shaders.debug = n): 1 bloom, 2 wide glow level, 3 blurred
  // brightness. They replace the image and are never saved.
  var SH_DEBUG=['','c=texture(u_bloomTex,v_uv).rgb*2.0;','c=texture(u_wideTex,v_uv).rgb*2.0;','c=vec3(texture(u_wideTex,v_uv).a);'];
  function shCompositeSource(mask){
    var body='',dbg=mask>>8;
    SH_EFFECTS.forEach(function(e,i){if(mask&(1<<i))body+=e.glsl+'\n';});
    if(dbg)body=SH_DEBUG[dbg]+'\n';
    return SH_HEAD+
      'uniform sampler2D u_scene;uniform sampler2D u_bloomTex;uniform sampler2D u_wideTex;uniform sampler2D u_histTex;\n'+
      'uniform float u_aspect,'+SH_EFFECTS.map(function(e){return e.u;}).join(',')+';\n'+
      'float hash(vec2 p){vec3 q=fract(vec3(p.xyx)*0.1031);q+=dot(q,q.yzx+33.33);return fract((q.x+q.y)*q.z);}\n'+
      'void main(){vec4 src=texture(u_scene,v_uv);vec3 c=src.rgb;\n'+body+
      'c+=(hash(gl_FragCoord.xy)-0.5)*(1.0/255.0);\n'+     // dither: no banding from the grading
      'o_col=vec4(clamp(c,0.0,1.0),src.a);}\n';
  }

  // ---- public status (menu, tests, future modules)
  var SHS={state:'off',reason:'',note:'',fps:0,level:'',passes:0,mpx:0,cpuMs:0,frames:0,renderer:'',size:'',
    effects:SH_EFFECTS,presets:SH_PRESETS,tune:SH_TUNE,debug:0,log:[],fpsLog:[]};
  TC.shaders=SHS;
  var SHR=null;        // GL resources for the current context
  var shFailed=null;   // error that stopped the pipeline (cleared by switching Shaders off and on)
  var shMeasuring=null;   // {left,sum,n,done}: time the next frames' passes (Measure cost)

  // ---- GL resources ------------------------------------------------------------------------
  function shInit(gl){
    var R={gl:gl,vao:gl.createVertexArray(),vs:gl.createShader(gl.VERTEX_SHADER),progs:{},comp:{},
      par:gl.getExtension('KHR_parallel_shader_compile'),key:'',scene:null,down:[],up:[],out:null,hist:null,
      histOk:false,expo:[],expoOk:false};
    gl.shaderSource(R.vs,SH_VS);gl.compileShader(R.vs);
    R.progs.pre=shProgram(R,SH_FS_PRE,['u_src','u_expo','u_off','u_thr'],{u_src:0,u_expo:1});
    R.progs.adapt=shProgram(R,SH_FS_ADAPT,['u_src','u_expo','u_rate'],{u_src:0,u_expo:1});
    R.progs.down=shProgram(R,SH_FS_DOWN,['u_src','u_px'],{u_src:0});
    R.progs.up=shProgram(R,SH_FS_UP,['u_src','u_base','u_px','u_scatter'],{u_src:0,u_base:1});
    return R;
  }
  function shProgram(R,fs,names,samplers){
    var gl=R.gl,f=gl.createShader(gl.FRAGMENT_SHADER),p=gl.createProgram();
    gl.shaderSource(f,fs);gl.compileShader(f);
    gl.attachShader(p,R.vs);gl.attachShader(p,f);gl.linkProgram(p);
    return {p:p,f:f,names:names,samplers:samplers,u:null};
  }
  // true once linked; with KHR_parallel_shader_compile it never blocks a frame waiting for it
  function shReady(R,pr){
    if(pr.u)return true;
    var gl=R.gl;
    if(R.par&&!gl.getProgramParameter(pr.p,R.par.COMPLETION_STATUS_KHR))return false;
    if(!gl.getProgramParameter(pr.p,gl.LINK_STATUS)){
      var log=(gl.getShaderInfoLog(pr.f)||'')+' '+(gl.getShaderInfoLog(R.vs)||'')+' '+(gl.getProgramInfoLog(pr.p)||'');
      throw new Error('shader failed to compile: '+log.replace(/[\s\u0000-\u001f]+/g,' ').trim().slice(0,300));
    }
    var u={},n;
    pr.names.forEach(function(k){u[k]=gl.getUniformLocation(pr.p,k);});
    gl.useProgram(pr.p);
    for(n in pr.samplers)gl.uniform1i(u[n],pr.samplers[n]);
    pr.u=u;
    return true;
  }
  function shTarget(gl,w,h){
    var t=gl.createTexture(),f=gl.createFramebuffer();
    gl.bindTexture(gl.TEXTURE_2D,t);
    gl.texStorage2D(gl.TEXTURE_2D,1,gl.RGBA8,w,h);
    gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);
    gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER,f);
    gl.framebufferTexture2D(gl.DRAW_FRAMEBUFFER,gl.COLOR_ATTACHMENT0,gl.TEXTURE_2D,t,0);
    if(gl.checkFramebufferStatus(gl.DRAW_FRAMEBUFFER)!==gl.FRAMEBUFFER_COMPLETE)throw new Error('post-process framebuffer is incomplete');
    return {t:t,f:f,w:w,h:h};
  }
  function shFreeTargets(R){
    var gl=R.gl,all=[R.scene,R.out,R.hist].concat(R.down,R.up,R.expo);
    all.forEach(function(x){if(x){gl.deleteFramebuffer(x.f);gl.deleteTexture(x.t);}});
    R.scene=R.out=R.hist=null;R.down=[];R.up=[];R.expo=[];R.key='';R.histOk=false;R.expoOk=false;
  }
  // (re)allocate the render targets when the frame size or the pass layout changes
  function shKey(fw,fh,cfg){return fw+'x'+fh+':'+(cfg.chain?cfg.res+'/'+cfg.levels:'-')+':'+(cfg.history?1:0);}
  function shAlloc(R,fw,fh,cfg,key){
    if(R.key===key)return;
    var gl=R.gl,i,w,h;
    shFreeTargets(R);
    gl.activeTexture(gl.TEXTURE0);
    R.scene=shTarget(gl,fw,fh);
    if(cfg.chain){
      w=Math.max(1,Math.ceil(fw/(1<<cfg.res)));h=Math.max(1,Math.ceil(fh/(1<<cfg.res)));
      for(i=0;i<=cfg.levels;i++){
        R.down.push(shTarget(gl,w,h));
        if(i<cfg.levels)R.up.push(shTarget(gl,w,h));
        w=Math.max(1,(w+1)>>1);h=Math.max(1,(h+1)>>1);
      }
      R.expo=[shTarget(gl,1,1),shTarget(gl,1,1)];
    }
    if(cfg.history){R.out=shTarget(gl,fw,fh);R.hist=shTarget(gl,fw,fh);}
    R.key=key;
  }
  // free everything (shaders switched off, context replaced); safe outside a frame because
  // none of these objects is ever left bound
  function shRelease(){
    var R=SHR;SHR=null;
    if(!R)return;
    try{
      var gl=R.gl,k;
      if(gl.isContextLost())return;
      shFreeTargets(R);
      var progs=[R.progs.pre,R.progs.adapt,R.progs.down,R.progs.up];
      for(k in R.comp)progs.push(R.comp[k]);
      progs.forEach(function(pr){gl.deleteProgram(pr.p);gl.deleteShader(pr.f);});
      gl.deleteShader(R.vs);gl.deleteVertexArray(R.vao);
    }catch(e){report(e);}
  }

  // ---- exact GL state save / restore -------------------------------------------------------
  var shState={tex:[],smp:[],caps:[],vp:[0,0,0,0],done:false},shCapList=null;
  function shSave(gl,st){
    if(!shCapList)shCapList=[gl.BLEND,gl.DEPTH_TEST,gl.CULL_FACE,gl.SCISSOR_TEST,gl.STENCIL_TEST,gl.POLYGON_OFFSET_FILL,
      gl.SAMPLE_ALPHA_TO_COVERAGE,gl.SAMPLE_COVERAGE,gl.RASTERIZER_DISCARD];
    st.active=gl.getParameter(gl.ACTIVE_TEXTURE);
    st.draw=gl.getParameter(gl.DRAW_FRAMEBUFFER_BINDING);
    st.read=gl.getParameter(gl.READ_FRAMEBUFFER_BINDING);
    if(HEj>0&&HEk>0){st.vp[0]=HEh;st.vp[1]=HEi;st.vp[2]=HEj;st.vp[3]=HEk;}
    else{var v=gl.getParameter(gl.VIEWPORT);st.vp[0]=v[0];st.vp[1]=v[1];st.vp[2]=v[2];st.vp[3]=v[3];}   // cache not set yet
    st.prog=gl.getParameter(gl.CURRENT_PROGRAM);
    st.vao=gl.getParameter(gl.VERTEX_ARRAY_BINDING);
    st.mask=KPa&15;
    for(var i=0;i<SH_UNITS;i++){
      gl.activeTexture(gl.TEXTURE0+i);
      st.tex[i]=gl.getParameter(gl.TEXTURE_BINDING_2D);
      st.smp[i]=gl.getParameter(gl.SAMPLER_BINDING);
    }
    for(i=0;i<shCapList.length;i++)st.caps[i]=gl.isEnabled(shCapList[i]);
    st.done=true;
  }
  function shNeutral(gl,st){
    for(var i=0;i<shCapList.length;i++)if(st.caps[i])gl.disable(shCapList[i]);
    for(i=0;i<SH_UNITS;i++)if(st.smp[i])gl.bindSampler(i,null);
    if(st.mask!==15)gl.colorMask(true,true,true,true);
  }
  function shRestore(gl,st){
    var i,m=st.mask;
    if(m!==15)gl.colorMask(!!(m&1),!!(m&2),!!(m&4),!!(m&8));
    for(i=0;i<shCapList.length;i++)if(st.caps[i])gl.enable(shCapList[i]);
    for(i=0;i<SH_UNITS;i++){
      gl.activeTexture(gl.TEXTURE0+i);
      gl.bindTexture(gl.TEXTURE_2D,st.tex[i]);
      if(st.smp[i])gl.bindSampler(i,st.smp[i]);
    }
    gl.activeTexture(st.active);
    gl.bindVertexArray(st.vao);
    gl.useProgram(st.prog);
    gl.viewport(st.vp[0],st.vp[1],st.vp[2],st.vp[3]);
    if(st.draw===st.read)gl.bindFramebuffer(gl.FRAMEBUFFER,st.draw);
    else{gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER,st.draw);gl.bindFramebuffer(gl.READ_FRAMEBUFFER,st.read);}
    st.done=false;
  }

  // ---- what to draw this frame -------------------------------------------------------------
  var shCfg={mask:0,amount:[],chain:false,history:false,res:2,levels:4,cap:3,name:''};
  function shConfig(){
    var inten=clamp(Number(S.shIntensity)||0,0,100)/100;
    if(!(inten>0))return null;
    var p=S.shPreset|0,res,levels,i,e,a,mask=0;
    if(p>=0&&p<=2){res=SH_PRESETS[p].res;levels=SH_PRESETS[p].levels;}
    else{p=3;res=clamp(Math.round(S.shBloomRes),1,3);levels=clamp(Math.round(S.shBloomLevels),1,7);}
    var cap=S.shPerf?0:(S.shAuto?shAuto.cap:3),limited=false;
    if(cap===2&&(res<2||levels>4)){res=Math.max(res,2);levels=Math.min(levels,4);limited=true;}
    if(cap===1&&(res<3||levels>3)){res=3;levels=Math.min(levels,3);limited=true;}
    shCfg.chain=false;shCfg.history=false;
    for(i=0;i<SH_EFFECTS.length;i++){
      e=SH_EFFECTS[i];a=0;
      if(S[e.on]&&!(cap===0&&e.needs))a=clamp(Number(S[e.str])||0,0,100)/100*e.max*inten;
      shCfg.amount[i]=a;
      if(a>0){mask|=1<<i;if(e.needs==='chain')shCfg.chain=true;if(e.needs==='history')shCfg.history=true;}
    }
    if(!mask)return null;
    var dbg=SHS.debug|0;
    if(dbg>0&&dbg<SH_DEBUG.length&&cap>0){mask|=dbg<<8;shCfg.chain=true;}
    shCfg.mask=mask;shCfg.res=res;shCfg.levels=levels;shCfg.cap=cap;
    shCfg.name=cap===0?'PERFORMANCE':(limited?SH_PRESETS[cap-1].name+' (auto)':SH_QUALITY[p]);
    return shCfg;
  }

  // ---- the pass ----------------------------------------------------------------------------
  function shDraw(gl,prog,target,t0,t1){
    gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER,target.f);
    gl.viewport(0,0,target.w,target.h);
    gl.useProgram(prog.p);
    gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_2D,t0);
    if(t1){gl.activeTexture(gl.TEXTURE1);gl.bindTexture(gl.TEXTURE_2D,t1);}
  }
  function shRender(R,st,cfg,fw,fh,dt){
    var gl=R.gl,n=0,px=0,i,s,L=cfg.levels,game={f:st.draw,w:fw,h:fh};
    // 1. copy the finished world image out of Eaglercraft's back buffer
    gl.bindFramebuffer(gl.READ_FRAMEBUFFER,st.draw);
    gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER,R.scene.f);
    gl.blitFramebuffer(0,0,fw,fh,0,0,fw,fh,gl.COLOR_BUFFER_BIT,gl.NEAREST);
    n++;px+=fw*fh;
    gl.bindVertexArray(R.vao);
    // 2. bloom chain: bright pass, `levels` downsamples, then back up mixing every level
    if(cfg.chain){
      var pre=R.progs.pre,dn=R.progs.down,up=R.progs.up,ad=R.progs.adapt,off=(1<<cfg.res)/4;
      var e0=R.expo[0],e1=R.expo[1];     // e0: brightness so far, e1: updated this frame
      s=R.down[0];
      shDraw(gl,pre,s,R.scene.t,e0.t);
      gl.uniform2f(pre.u.u_off,off/fw,off/fh);
      gl.uniform3f(pre.u.u_thr,SH_TUNE.thrDark,SH_TUNE.thrBright,SH_TUNE.knee);
      gl.drawArrays(gl.TRIANGLES,0,3);n++;px+=s.w*s.h;
      for(i=1;i<=L;i++){
        s=R.down[i];
        shDraw(gl,dn,s,R.down[i-1].t);
        gl.uniform2f(dn.u.u_px,1/R.down[i-1].w,1/R.down[i-1].h);
        gl.drawArrays(gl.TRIANGLES,0,3);n++;px+=s.w*s.h;
      }
      shDraw(gl,ad,e1,R.down[L].t,e0.t);
      gl.uniform1f(ad.u.u_rate,R.expoOk?1-Math.exp(-(dt>0?Math.min(dt,250):16.7)/Math.max(1,SH_TUNE.adaptMs)):1);
      gl.drawArrays(gl.TRIANGLES,0,3);n++;px++;
      R.expo[0]=e1;R.expo[1]=e0;R.expoOk=true;
      for(i=L-1;i>=0;i--){
        var lower=i===L-1?R.down[L]:R.up[i+1];
        s=R.up[i];
        shDraw(gl,up,s,lower.t,R.down[i].t);
        gl.uniform2f(up.u.u_px,1/lower.w,1/lower.h);
        gl.uniform1f(up.u.u_scatter,SH_TUNE.scatter);
        gl.drawArrays(gl.TRIANGLES,0,3);n++;px+=s.w*s.h;
      }
    }
    // 3. composite every enabled effect in one full-screen pass
    var comp=R.comp[cfg.mask],target=cfg.history?R.out:game;
    shDraw(gl,comp,target,R.scene.t,cfg.chain?R.up[0].t:null);
    if(cfg.chain){
      // Ambient Glow reads the level closest to 1/16 of the frame, whatever the preset
      gl.activeTexture(gl.TEXTURE2);gl.bindTexture(gl.TEXTURE_2D,R.up[clamp(4-cfg.res,0,L-1)].t);
    }
    if(cfg.history){gl.activeTexture(gl.TEXTURE3);gl.bindTexture(gl.TEXTURE_2D,R.hist.t);}
    gl.uniform1f(comp.u.u_aspect,fw/fh);
    for(i=0;i<SH_EFFECTS.length;i++){
      var a=cfg.amount[i];
      if(SH_EFFECTS[i].id==='motion')a=R.histOk?Math.pow(a,dt>0?dt/16.667:1):0;   // same trail at any FPS
      gl.uniform1f(comp.u[SH_EFFECTS[i].u],a);
    }
    gl.drawArrays(gl.TRIANGLES,0,3);n++;px+=fw*fh;
    // 4. motion blur composites off-screen so this frame becomes the next frame's history
    if(cfg.history){
      gl.bindFramebuffer(gl.READ_FRAMEBUFFER,R.out.f);
      gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER,st.draw);
      gl.blitFramebuffer(0,0,fw,fh,0,0,fw,fh,gl.COLOR_BUFFER_BIT,gl.NEAREST);
      n++;px+=fw*fh;
      var t=R.hist;R.hist=R.out;R.out=t;R.histOk=true;
    }else R.histOk=false;
    SHS.passes=n;SHS.mpx=Math.round(px/1e4)/100;
  }

  // ---- auto quality + FPS safety -----------------------------------------------------------
  // Frames are timed in the render hook; every second of world rendering is one FPS sample and
  // decisions use the median of the recent samples, so a single hitch or spike does not count.
  //  - Auto quality on: median of the last 5 samples under the target FPS -> step the allowed
  //    quality down one level (FULL -> MEDIUM -> LOW -> PERFORMANCE) and measure 3 more; if FPS
  //    did not improve by 5% the drop is undone (shaders were not the bottleneck) and not retried
  //    for a minute. Median of 6 at 1.5x the target after 10 s -> step back up, undone if FPS
  //    then falls under the target.
  //  - Last resort (also with Auto quality off): FPS stays very low even at the lightest level
  //    -> skip the effect for 3 seconds; if FPS is 20% better without it, shaders pause (the
  //    menu says so) until a shader setting is changed.
  var shAuto={cap:3,known:false,renderer:'',phase:'steady',warm:2,steadyN:0,prev:3,dir:0,
    before:0,fps:[],accT:0,accN:0,accA:0,lastT:0,probeN:0,blockDown:0,blockUp:0,blockPause:0,paused:false,suspend:false,sig:''};
  // what auto quality / FPS safety decided and why (ThunderClient.shaders.log, newest last)
  function shLog(msg){SHS.log.push(Math.round(now()/100)/10+'s '+msg);if(SHS.log.length>30)SHS.log.shift();}
  function shMedian(n){var a=shAuto.fps.slice(-n).sort(function(x,y){return x-y;});return a.length?a[a.length>>1]:0;}
  function shRestart(){
    var A=shAuto;
    A.phase='steady';A.warm=2;A.steadyN=0;A.suspend=false;A.fps=[];A.accT=A.accN=A.accA=0;A.probeN=0;
  }
  function shProbe(dir,before){
    var A=shAuto;
    A.before=before;A.dir=dir;A.phase='probe';A.probeN=0;A.warm=1;A.fps=[];
  }
  function shLearn(){
    try{
      if(shAuto.cap>=3)W.localStorage.removeItem(SH_LEARN_KEY);
      else W.localStorage.setItem(SH_LEARN_KEY,JSON.stringify({r:shAuto.renderer,cap:shAuto.cap}));
    }catch(_){}
  }
  function shKnowDevice(gl){
    var A=shAuto,r='';
    A.known=true;
    try{
      r=String(gl.getParameter(gl.RENDERER)||'');
      var ext=gl.getExtension('WEBGL_debug_renderer_info');
      if(ext)r=String(gl.getParameter(ext.UNMASKED_RENDERER_WEBGL)||r);
    }catch(_){}
    A.renderer=SHS.renderer=r;
    var learned=null;
    try{learned=JSON.parse(W.localStorage.getItem(SH_LEARN_KEY)||'null');}catch(_){}
    if(learned&&learned.r===r&&learned.cap>=0&&learned.cap<3){A.cap=learned.cap|0;shLog('device seen before: start at '+SH_CAPS[A.cap]);}
    else{A.cap=SH_SOFTWARE.test(r)?1:3;shLog(A.cap<3?'software renderer: start at LOW':'start at FULL');}
  }
  function shControl(fps,t){
    var A=shAuto,target=clamp(Number(S.shTargetFps)||30,15,120),avg;
    if(A.warm>0){A.warm--;A.fps=[];return;}
    if(A.phase==='probe'){
      if(++A.probeN<3)return;
      avg=shMedian(3);
      var r1=Math.round(A.before),r2=Math.round(avg);
      if(A.dir<0){
        if(avg<A.before*1.05){A.cap=A.prev;A.blockDown=t+60000;SHS.note='Lower quality did not raise FPS here, so quality was kept.';
          shLog('undo: '+r1+' -> '+r2+' FPS at lower quality; back to '+SH_CAPS[A.cap]+', no new try for 60 s');}
        else{SHS.note='Quality lowered to '+SH_CAPS[A.cap]+' to keep FPS near '+target+'.';shLog('keep '+SH_CAPS[A.cap]+': '+r1+' -> '+r2+' FPS');}
      }else if(avg<target){A.cap=A.prev;A.blockUp=t+120000;shLog('undo raise: '+r2+' FPS is under '+target+'; back to '+SH_CAPS[A.cap]);}
      else{SHS.note='Quality raised to '+SH_CAPS[A.cap]+'.';shLog('keep '+SH_CAPS[A.cap]+': '+r2+' FPS');}
      A.phase='steady';A.warm=1;A.steadyN=0;A.fps=[];shLearn();
      return;
    }
    if(A.phase==='pauseprobe'){
      if(++A.probeN<3)return;
      avg=shMedian(3);
      A.suspend=false;A.phase='steady';A.warm=1;A.steadyN=0;
      if(avg>=A.before*1.2){A.paused=true;SHS.note='Paused: '+Math.round(A.before)+' FPS with shaders, '+Math.round(avg)+' without.';
        shLog('paused: '+Math.round(A.before)+' FPS with shaders, '+Math.round(avg)+' without');}
      else{A.blockPause=t+120000;shLog('not paused: '+Math.round(avg)+' FPS without shaders is no better');}
      A.fps=[];
      return;
    }
    var auto=!!S.shAuto&&!S.shPerf,n=++A.steadyN,med=shMedian(5);
    if(auto&&n>=5&&med<target&&A.cap>0&&t>=A.blockDown){
      A.prev=A.cap;A.cap--;shLog('lower '+SH_CAPS[A.prev]+' -> '+SH_CAPS[A.cap]+': '+Math.round(med)+' FPS < target '+target);shProbe(-1,med);return;
    }
    avg=shMedian(6);
    if(auto&&n>=10&&avg>=target*1.5&&A.cap<3&&t>=A.blockUp){
      A.prev=A.cap;A.cap++;shLog('raise '+SH_CAPS[A.prev]+' -> '+SH_CAPS[A.cap]+': '+Math.round(avg)+' FPS');shProbe(1,avg);return;
    }
    var floor=auto?Math.max(12,target*0.5):10;
    if(n>=(auto?5:8)&&med<floor&&(!auto||A.cap===0||S.shPerf)&&t>=A.blockPause){
      A.before=med;A.suspend=true;A.phase='pauseprobe';A.probeN=0;A.warm=1;A.fps=[];
      shLog('FPS '+Math.round(med)+' < '+floor+(auto?' at the lightest level':'')+': measuring without shaders');
    }
  }
  // Slow frames are what this watches for, so every frame up to 2 s counts. A longer gap is a
  // pause (hidden tab, world loading, a GC or save hitch) and is skipped; after more than 3 s the
  // measurement starts over (shFrame), keeping the quality auto chose.
  function shClock(t){
    var A=shAuto,dt=A.lastT?t-A.lastT:0;
    A.lastT=t;
    if(!(dt>0&&dt<=2000)||D.hidden)return dt;
    A.accT+=dt;A.accN++;
    if(A.accT>=1000){
      var fps=A.accN*1000/A.accT,drew=A.accA>0;
      A.accT=0;A.accN=0;A.accA=0;SHS.fps=Math.round(fps);
      SHS.fpsLog.push(Math.round(fps*10)/10);if(SHS.fpsLog.length>12)SHS.fpsLog.shift();
      // decide only on seconds the effect was drawn (or while measuring FPS without it)
      if(drew||A.phase==='pauseprobe'){A.fps.push(fps);if(A.fps.length>6)A.fps.shift();shControl(fps,t);}
      else{A.fps=[];A.steadyN=0;}
    }
    return dt;
  }
  function shSignature(){
    var s=S.shIntensity+'|'+S.shPreset+'|'+S.shBloomRes+'|'+S.shBloomLevels+'|'+S.shAuto+'|'+S.shPerf+'|'+S.shTargetFps;
    for(var i=0;i<SH_EFFECTS.length;i++)s+='|'+S[SH_EFFECTS[i].on]+S[SH_EFFECTS[i].str];
    return s;
  }

  var shPixel=new Uint8Array(4);
  function shSync(gl,fb){gl.bindFramebuffer(gl.READ_FRAMEBUFFER,fb);gl.readPixels(0,0,1,1,gl.RGBA,gl.UNSIGNED_BYTE,shPixel);}

  // ---- per frame (called after renderWorld, only while Shaders is on) -----------------------
  function shFrame(){
    var t=now(),A=shAuto,gl=HEl,st=shState;
    if(t-A.lastT>3000){                           // shaders just switched on / world just loaded / long hitch
      if(A.phase!=='steady'&&A.lastT)shLog('measurement interrupted by a '+Math.round((t-A.lastT)/1000)+' s pause; starting over');
      shRestart();
    }
    var dt=shClock(t);
    if(shFailed){SHS.state='failed';return;}
    if(!gl||!(HEv>=300)||typeof gl.blitFramebuffer!=='function'){
      SHS.state='unsupported';SHS.reason=gl?'the game is running on WebGL 1':'no WebGL context';return;
    }
    if(gl.isContextLost()){SHR=null;SHS.state='lost';return;}
    if(!A.known)shKnowDevice(gl);
    var sig=shSignature();
    if(sig!==A.sig){A.sig=sig;if(A.paused)SHS.note='';A.paused=false;shRestart();}
    if(A.paused){SHS.state='paused';return;}
    var cfg=shConfig();
    if(!cfg){SHS.state='idle';return;}
    if(A.suspend){SHS.state='probing';return;}
    try{
      if(!SHR||SHR.gl!==gl)SHR=shInit(gl);
      shSave(gl,st);
      var fw=st.vp[2],fh=st.vp[3];
      if(st.vp[0]!==0||st.vp[1]!==0||fw<16||fh<16){SHS.state='skipped';return;}
      if(fw*fh>3700000&&cfg.chain&&cfg.res<3)cfg.res++;    // 1440p and up: bloom one step smaller
      shNeutral(gl,st);
      var comp=SHR.comp[cfg.mask]||(SHR.comp[cfg.mask]=shProgram(SHR,shCompositeSource(cfg.mask),SH_COMP_UNIFORMS,
        {u_scene:0,u_bloomTex:1,u_wideTex:2,u_histTex:3}));
      var ready=shReady(SHR,comp);
      if(cfg.chain){ready=shReady(SHR,SHR.progs.pre)&&ready;ready=shReady(SHR,SHR.progs.adapt)&&ready;
        ready=shReady(SHR,SHR.progs.down)&&ready;ready=shReady(SHR,SHR.progs.up)&&ready;}
      if(!ready){SHS.state='compiling';return;}
      // new targets: check the first frame drawn with them for GL errors (clearing any the
      // game left first, so only ours are counted). Costs two getError calls per re-layout.
      var key=shKey(fw,fh,cfg),fresh=SHR.key!==key;
      if(fresh){gl.getError();shAlloc(SHR,fw,fh,cfg,key);}
      if(dt>500)SHR.histOk=false;                 // after a hitch the old frame is stale
      // Measure cost: a 1-pixel readPixels waits for the GPU (WebGL's finish() does not in
      // Chrome), once before the pass and once after it, so only this pass's work is timed
      var M=shMeasuring&&!gl.getParameter(gl.PIXEL_PACK_BUFFER_BINDING)?shMeasuring:null,tm=0;
      if(M){shSync(gl,st.draw);tm=now();}
      shRender(SHR,st,cfg,fw,fh,dt);
      if(M){shSync(gl,st.draw);M.sum+=now()-tm;M.n++;if(--M.left<=0){shMeasuring=null;M.done({ms:Math.round(M.sum/M.n*100)/100,frames:M.n,
        level:cfg.name,passes:SHS.passes,mpx:SHS.mpx,size:fw+'x'+fh});}}
      if(fresh){
        var err=gl.getError();
        if(err){SHR.key='';throw new Error('WebGL error 0x'+err.toString(16)+' in the first post-process frame');}
      }
      SHS.state='active';SHS.level=cfg.name;SHS.size=fw+'x'+fh;SHS.frames++;SHS.reason='';A.accA++;
    }catch(e){
      shFailed=e;SHS.state='failed';SHS.reason=String(e&&e.message||e);
      if(W.console&&W.console.warn)W.console.warn('[Thunder] shaders stopped:',e);
    }finally{
      if(st.done)shRestore(gl,st);
      SHS.cpuMs=Math.round((SHS.cpuMs*0.9+(now()-t)*0.1)*100)/100;
    }
    if(shFailed)shRelease();
  }

  // Compile every composite variant (all 2^n effect combinations) plus the bloom programs and
  // report failures. Diagnostics only (TC.shaders.selfTest()); touches no bindings.
  SHS.selfTest=function(){
    var gl=HEl,res={ok:0,failed:[]};
    if(!gl||!(HEv>=300))return {ok:0,failed:['WebGL 2 not available']};
    var vs=gl.createShader(gl.VERTEX_SHADER);gl.shaderSource(vs,SH_VS);gl.compileShader(vs);
    function one(name,fs){
      var f=gl.createShader(gl.FRAGMENT_SHADER),p=gl.createProgram();
      gl.shaderSource(f,fs);gl.compileShader(f);gl.attachShader(p,vs);gl.attachShader(p,f);gl.linkProgram(p);
      if(gl.getProgramParameter(p,gl.LINK_STATUS))res.ok++;
      else res.failed.push(name+': '+((gl.getShaderInfoLog(f)||'')+(gl.getProgramInfoLog(p)||'')).slice(0,200));
      gl.deleteProgram(p);gl.deleteShader(f);
    }
    one('bright pass',SH_FS_PRE);one('brightness',SH_FS_ADAPT);one('downsample',SH_FS_DOWN);one('upsample',SH_FS_UP);
    for(var m=1;m<(1<<SH_EFFECTS.length);m++)one('composite '+m,shCompositeSource(m));
    for(var d=1;d<SH_DEBUG.length;d++)one('debug view '+d,shCompositeSource(1|(d<<8)));
    gl.deleteShader(vs);
    return res;
  };
  SHS.release=shRelease;
  // Average GPU+CPU time of the shader pass alone over the next `frames` frames. Each timed frame
  // waits for the GPU twice, so it is only run on request. After 20 s it settles for the frames it
  // has (at least 3, e.g. on a very slow device); resolves null if shaders drew nothing.
  SHS.measure=function(frames){
    frames=clamp(frames|0||30,5,120);
    return new Promise(function(resolve){
      var M={left:frames,sum:0,n:0,done:function(r){W.clearTimeout(M.timer);SHS.lastMeasure=r;resolve(r);}};
      M.timer=W.setTimeout(function(){
        if(shMeasuring!==M)return;
        shMeasuring=null;
        if(M.n>=3)M.done({ms:Math.round(M.sum/M.n*100)/100,frames:M.n,level:SHS.level,passes:SHS.passes,mpx:SHS.mpx,size:SHS.size});
        else resolve(null);
      },20000);
      shMeasuring=M;
    });
  };

  // ---- hook ----------------------------------------------------------------------------------
  // renderWorld can suspend the TeaVM thread (texture loads). The wrapper keeps no state of its
  // own: if the original suspends it returns at once, and on resume the caller re-enters this
  // wrapper, which re-enters the original to finish; the pass only runs after a normal return.
  var origFjk=Fjk;
  Fjk=function(a,b,c){
    origFjk(a,b,c);
    if($rt_suspending())return;
    if(!S.shaders){if(SHR)shRelease();if(SHS.state!=='off')SHS.state='off';return;}
    try{shFrame();}catch(e){report(e);}
  };

  // ---- menu ----------------------------------------------------------------------------------
  function shPct(v){return Math.round(v)+'%';}
  function shFps(v){return Math.round(v)+' FPS';}
  function shRes(v){return '1/'+(1<<Math.round(v))+' res';}
  function shLevels(v){v=Math.round(v);return v+(v===1?' level':' levels');}
  function shPresetChanged(i){
    if(i<3){S.shBloomRes=SH_PRESETS[i].res;S.shBloomLevels=SH_PRESETS[i].levels;save();repaint('shBloomRes');repaint('shBloomLevels');}
    shAuto.cap=3;shLearn();SHS.note='';                   // an explicit choice overrides what auto learned
  }
  function shToCustom(){
    if(S.shPreset!==3){S.shPreset=3;save();repaint('shPreset');}
    shAuto.cap=3;shLearn();SHS.note='';
  }
  function shResetSettings(){
    for(var id in DEFAULTS)if(/^sh[A-Z]/.test(id))S[id]=DEFAULTS[id];   // everything but the ON/OFF switch
    save();shAuto.cap=3;shLearn();shFailed=null;SHS.note='';
    render();
  }
  function shStatus(){
    var A=shAuto;
    if(!S.shaders)return ['','Off','the game renders exactly like vanilla.'];
    if(now()-A.lastT>3000&&SHS.state!=='unsupported'&&SHS.state!=='failed')return ['','On','waiting for a world (shaders apply in-game).'];
    switch(SHS.state){
      case 'active':return ['tcm-ok','Active',SHS.level+' \u2022 '+(SHS.fps?SHS.fps+' FPS':'measuring FPS')];
      case 'compiling':return ['tcm-warn','Starting','compiling shaders\u2026'];
      case 'idle':return ['tcm-warn','On','nothing to draw: intensity is 0% or every effect is off.'];
      case 'probing':return ['tcm-warn','Checking','measuring FPS without shaders\u2026'];
      case 'paused':return ['tcm-warn','Paused','FPS was too low with shaders on this device. Change any shader setting to try again.'];
      case 'unsupported':return ['tcm-bad','Not available','needs WebGL 2 ('+SHS.reason+'). The game renders normally.'];
      case 'lost':return ['tcm-bad','Stopped','the WebGL context was lost.'];
      case 'failed':return ['tcm-bad','Stopped after an error',SHS.reason+'. Switch Shaders off and on to retry.'];
      default:return ['tcm-warn','On',''];
    }
  }
  function shStatusLine(box){
    var line=el('div','tcm-status'),dot=el('span','tcm-dot'),txt=el('span');
    line.appendChild(dot);line.appendChild(txt);box.appendChild(line);
    addLive(function(){
      var s=shStatus();
      dot.className='tcm-dot'+(s[0]?' '+s[0]:'');
      txt.textContent='';txt.appendChild(el('b',null,s[1]));
      if(s[2])txt.appendChild(D.createTextNode(' \u2022 '+s[2]));
    });
  }
  SPECIALS.shaders=function(box){
    shStatusLine(box);
    box.appendChild(optRow({id:'shIntensity',name:'Intensity',min:0,max:100,step:1,fmt:shPct}));
    box.appendChild(optRow({id:'shPreset',name:'Quality',choices:SH_QUALITY,onChange:shPresetChanged}));
    var act=el('div','tcm-actions');
    act.appendChild(confirmButton('Reset Shader Settings','Click again to reset shaders',shResetSettings));
    box.appendChild(act);
  };
  SPECIALS.shperf=function(box){
    box.appendChild(optRow({id:'shAuto',name:'Auto quality',
      hint:'Steps quality down when FPS stays under the target and back up when there is room.'}));
    box.appendChild(optRow({id:'shTargetFps',name:'Target FPS',min:20,max:60,step:5,fmt:shFps}));
    box.appendChild(optRow({id:'shPerf',name:'Performance Mode',
      hint:'Lightest shaders: color grading, contrast and vignette only (no bloom, glow or motion blur).'}));
    box.appendChild(el('div','tcm-sub','Custom quality'));
    box.appendChild(optRow({id:'shBloomRes',name:'Bloom resolution',min:1,max:3,step:1,fmt:shRes,invert:true,onChange:shToCustom}));
    box.appendChild(optRow({id:'shBloomLevels',name:'Bloom blur levels',min:1,max:7,step:1,fmt:shLevels,onChange:shToCustom}));
    var kv=el('div','tcm-kv');box.appendChild(kv);
    function row(label){kv.appendChild(el('span',null,label));var b=el('b',null,'-');kv.appendChild(b);return b;}
    var rNow=row('Running'),rWork=row('Work per frame'),rCost=row('Measured cost'),rCpu=row('CPU time'),rGpu=row('GPU'),rNote=row('Auto quality');
    var act=el('div','tcm-actions'),mb=el('button','tcm-btn','Measure cost');mb.type='button';
    mb.addEventListener('click',function(){
      if(shMeasuring)return;
      if(!(S.shaders&&SHS.state==='active')){rCost.textContent='switch Shaders on in a world first';return;}
      rCost.textContent='measuring\u2026';
      SHS.measure(30).then(function(r){rCost.textContent=r?r.ms.toFixed(2)+' ms per frame ('+r.level+', '+r.frames+' frames)':'no frames drawn in 20 s';});
    });
    act.appendChild(mb);box.appendChild(act);
    addLive(function(){
      var on=S.shaders&&SHS.state==='active'&&now()-shAuto.lastT<3000;
      rNow.textContent=on?SHS.level+' \u2022 '+SHS.size:(S.shaders?SHS.state:'off');
      rWork.textContent=on?SHS.passes+' passes \u2022 '+SHS.mpx.toFixed(2)+' MPx':'-';
      rCpu.textContent=on?SHS.cpuMs.toFixed(2)+' ms':'-';
      if(!shMeasuring&&rCost.textContent==='-'&&SHS.lastMeasure)rCost.textContent=SHS.lastMeasure.ms.toFixed(2)+' ms per frame ('+SHS.lastMeasure.level+', '+SHS.lastMeasure.frames+' frames)';
      rGpu.textContent=SHS.renderer||'-';rGpu.title=SHS.renderer||'';
      rNote.textContent=!S.shAuto?'off':(SHS.note||('allows '+SH_CAPS[S.shPerf?0:shAuto.cap]));
    });
  };
  ICONS.shaders='<circle cx="12" cy="12" r="3.5"/><path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3M5.3 5.3l2.1 2.1M16.6 16.6l2.1 2.1M5.3 18.7l2.1-2.1M16.6 7.4l2.1-2.1"/>';
  CATEGORIES.splice(4,0,{id:'shaders',name:'Shaders'});
  MODULES.push(
    {cat:'shaders',id:'shaders',name:'Shaders',wide:true,always:true,special:'shaders',
      desc:'Post-processing for the 3D world. The HUD and menus stay sharp. Off means vanilla rendering.',
      onChange:function(on){shFailed=null;shAuto.paused=false;shRestart();SHS.note='';if(!on){shRelease();SHS.state='off';}}},
    {cat:'shaders',id:'shBloom',name:'Bloom',desc:'Soft glow around bright light: torches, lava, glowstone, the sun.',
      opts:[{id:'shBloomStr',name:'Strength',min:0,max:100,step:1,fmt:shPct}]},
    {cat:'shaders',id:'shGrade',name:'Color Grading',desc:'Warm highlights, cool shadows, gently richer colors.',
      opts:[{id:'shGradeStr',name:'Strength',min:0,max:100,step:1,fmt:shPct}]},
    {cat:'shaders',id:'shContrast',name:'Contrast',desc:'Soft S-curve: deeper shadows and brighter highlights without clipping.',
      opts:[{id:'shContrastStr',name:'Strength',min:0,max:100,step:1,fmt:shPct}]},
    {cat:'shaders',id:'shVignette',name:'Vignette',desc:'Slightly darker screen edges to frame the view.',
      opts:[{id:'shVignetteStr',name:'Strength',min:0,max:100,step:1,fmt:shPct}]},
    {cat:'shaders',id:'shAmbient',name:'Ambient Glow',desc:'Light spills softly from bright areas; very dark scenes get a small lift.',
      opts:[{id:'shAmbientStr',name:'Strength',min:0,max:100,step:1,fmt:shPct}]},
    {cat:'shaders',id:'shMotion',name:'Motion Blur',desc:'Blends in the previous frames for smoother motion. Same look at any FPS.',
      opts:[{id:'shMotionStr',name:'Strength',min:0,max:100,step:1,fmt:shPct}]},
    {cat:'shaders',id:null,name:'Performance',wide:true,special:'shperf',
      desc:'How much work shaders may do, and what happens when FPS drops.'}
  );
