'use strict';
// ---------- DEV: dune armour trial ----------
// A generic dune-field mission for trialling the Partition War ground armour.
// Target groups sit at rough locations marked by NAV points (no scanner): the
// marker shows the search area, the pilot finds the armour by eye.
// Heavy walkers shrug off hull hits; their knee joints (yellow) are the weak
// points. Break enough knees and the walker buckles and collapses.

const GA_GROUND_Y=-3.45,GA_CEILING=14,GA_UNIT_SIGHT=150,GA_CELL=6,GA_HORIZON=392,GA_LOD1=150,GA_LOD2=220;
// Automatic speed (no throttle): slow strafing pace once visible armour is in attack
// range ahead, fast cruise the rest of the time — slow in, fast out, turn, return.
const GA_TESLA_RANGE=15,GA_TESLA_CHARGE=.85,GA_SLOT=1.4,GA_BEAM=.6,GA_SHIP_R=.2;
const GA_SPEED_ATTACK=8.5,GA_SPEED_CRUISE=22,GA_ATTACK_RANGE=72,GA_ATTACK_CONE=.7;

// ---- Mesh builder (same construction as the armour audition sheet) ----
// topo=true records edges/faces once; topo=false re-emits vertices only, in the
// identical order, so a posed frame can be copied straight into the live mesh.
function gaBuilder(topo){
  const v=[],e=topo?[]:null,faces=topo?[]:null,es=topo?new Set():null,marks={};
  const m={v,e,faces,T:null};
  const V=p=>{const q=m.T?m.T(p):p;v.push([q[0],q[1],q[2]]);return v.length-1};
  const E=(a,b)=>{if(!topo||a===b)return;const k=a<b?a*65536+b:b*65536+a;if(es.has(k))return;es.add(k);e.push([a,b])};
  const F=ids=>{if(!topo)return;faces.push(ids);for(let i=0;i<ids.length;i++)E(ids[i],ids[(i+1)%ids.length])};
  const loft=(rings,capStart=true,capEnd=true)=>{
    const idx=rings.map(r=>r.map(V));
    for(let k=0;k<idx.length-1;k++){const A=idx[k],B=idx[k+1];for(let i=0;i<A.length;i++){const j=(i+1)%A.length;F([A[i],A[j],B[j],B[i]])}}
    if(capStart)F([...idx[0]].reverse());if(capEnd)F(idx[idx.length-1]);return idx};
  const norm=a=>{const l=Math.hypot(a[0],a[1],a[2])||1;return[a[0]/l,a[1]/l,a[2]/l]};
  const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
  m.beam=(a,b,w,h,taper=1)=>{const d=norm([b[0]-a[0],b[1]-a[1],b[2]-a[2]]);let s=cross(d,[0,1,0]);if(Math.hypot(s[0],s[1],s[2])<1e-3)s=cross(d,[1,0,0]);s=norm(s);const u=norm(cross(s,d));
    const ring=(c,k)=>[[-1,-1],[1,-1],[1,1],[-1,1]].map(([i,j])=>[c[0]+s[0]*i*w*k/2+u[0]*j*h*k/2,c[1]+s[1]*i*w*k/2+u[1]*j*h*k/2,c[2]+s[2]*i*w*k/2+u[2]*j*h*k/2]);
    return loft([ring(a,1),ring(b,taper)])};
  m.box=(c,sz)=>{const[x,y,z]=c,a=sz[0]/2,b=sz[1]/2,d=sz[2]/2;return loft([[[x-a,y-b,z-d],[x+a,y-b,z-d],[x+a,y+b,z-d],[x-a,y+b,z-d]],[[x-a,y-b,z+d],[x+a,y-b,z+d],[x+a,y+b,z+d],[x-a,y+b,z+d]]])};
  m.ringXZ=(cx,y,cz,rx,rz,n,rot=0)=>Array.from({length:n},(_,i)=>{const t=rot+2*Math.PI*i/n;return[cx+Math.cos(t)*rx,y,cz+Math.sin(t)*rz]});
  m.ringXY=(cx,cy,z,r,n,rot=0)=>Array.from({length:n},(_,i)=>{const t=rot+2*Math.PI*i/n;return[cx+Math.cos(t)*r,cy+Math.sin(t)*r,z]});
  m.barrel=(x,y,z0,z1,r,n=6)=>loft([m.ringXY(x,y,z0,r,n),m.ringXY(x,y,z1,r,n)]);
  m.loft=loft;
  m.mark=(label,fn)=>{const a=v.length;fn();marks[label]=[a,v.length]};
  m.marks=marks;
  return m
}
// One leg in already-posed model coordinates.
function gaLeg(m,L,t,i){
  m.beam(L.hip,L.knee,t,t*1.3);
  m.mark('knee'+i,()=>m.box(L.knee,[t*1.6,t*1.6,t*1.6]));
  m.beam(L.knee,L.ankle,t*.8,t*1.1);
  m.box(L.ankle,[t*1.25,t*1.25,t*1.25]);
  const f=L.foot;
  m.loft([m.ringXZ(f[0],f[1],f[2],t*2.1,t*2.4,6),m.ringXZ(f[0],f[1]+t*.55,f[2],t*1.4,t*1.6,6)]);
  m.beam(L.ankle,[f[0],f[1]+t*.5,f[2]],t*.6,t*.6);
}
function gaIK(hip,ankle,L1,L2,pole){
  let dx=ankle[0]-hip[0],dy=ankle[1]-hip[1],dz=ankle[2]-hip[2];
  const raw=Math.hypot(dx,dy,dz)||1e-3;dx/=raw;dy/=raw;dz/=raw;
  const d=clamp(raw,Math.abs(L1-L2)+1e-3,L1+L2-1e-3);
  const a=(L1*L1-L2*L2+d*d)/(2*d),h=Math.sqrt(Math.max(0,L1*L1-a*a));
  const pd=pole[0]*dx+pole[1]*dy+pole[2]*dz;
  let px=pole[0]-dx*pd,py=pole[1]-dy*pd,pz=pole[2]-dz*pd;const pl=Math.hypot(px,py,pz);
  if(pl<1e-4){px=0;py=1;pz=0}else{px/=pl;py/=pl;pz/=pl}
  return[hip[0]+dx*a+px*h,hip[1]+dy*a+py*h,hip[2]+dz*a+pz*h]
}
function gaLegDesign(hip,knee,ankle,foot,t){
  const L1=Math.hypot(knee[0]-hip[0],knee[1]-hip[1],knee[2]-hip[2]),L2=Math.hypot(ankle[0]-knee[0],ankle[1]-knee[1],ankle[2]-knee[2]);
  const mid=[(hip[0]+ankle[0])/2,(hip[1]+ankle[1])/2,(hip[2]+ankle[2])/2];
  return{hip,knee,ankle,foot,t,L1,L2,ankleH:ankle[1]-foot[1],ankleOff:[ankle[0]-foot[0],ankle[2]-foot[2]],pole:[knee[0]-mid[0],knee[1]-mid[1],knee[2]-mid[2]]}
}

// ---- Armour catalogue ----
const GA_KINDS=(()=>{
  const K={};
  { // H1 STRIDER: tripod heavy, slung three-gun pod, knees above the hull
    const H=6.6,legs=[];
    for(let i=0;i<3;i++){const a=-Math.PI/2+i*2*Math.PI/3,c=Math.cos(a),s=Math.sin(a);
      legs.push(gaLegDesign([c*2.9,H-.2,s*2.9],[c*5.3,H+1.4,s*5.3],[c*6.3,1.6,s*6.3],[c*6.4,0,s*6.4],.68))}
    K.strider={label:'STRIDER',heavy:true,s:.9,kneeHp:5,collapseAt:2,speed:1.45,turn:.14,range:78,arc:1.5,fire:[2.0,2.5],volley:4,volleyGap:.4,minRange:24,
      reach:3.6,swing:.3,lift:1.3,offsets:[0,1/3,2/3],bobAmp:.12,pivotY:H,legs,radius:3.4,bodyBottom:H-3.0,top:8.8,
      muzzles:[[-.6,H-2.55,-4.2],[0,H-2.55,-4.2],[.6,H-2.55,-4.2]],spheres:[[0,H+.3,0,3.2],[0,H-2.5,-.2,1.5]],hullHp:30,col:C.m,score:2500,
      body(m){
        m.loft([m.ringXZ(0,H-1.6,0,2.0,2.0,6,Math.PI/6),m.ringXZ(0,H-.9,0,3.4,3.4,6,Math.PI/6),m.ringXZ(0,H+.6,0,3.3,3.3,6,Math.PI/6),m.ringXZ(0,H+1.5,0,2.0,2.0,6,Math.PI/6)]);
        m.loft([m.ringXZ(0,H+1.4,.3,1.1,1.1,6),m.ringXZ(0,H+2.2,.3,.75,.75,6)]);
        m.box([0,H+.1,-3.05],[2.4,.35,.5]);
        m.box([0,H-2.0,0],[.9,1.0,.9]);
        m.loft([[[-1.1,H-2.9,-1.4],[1.1,H-2.9,-1.4],[1.1,H-2.2,-1.6],[-1.1,H-2.2,-1.6]],[[-1.2,H-3.0,1.2],[1.2,H-3.0,1.2],[1.2,H-2.1,1.2],[-1.2,H-2.1,1.2]]]);
        for(const x of[-.6,0,.6])m.barrel(x,H-2.55,-1.4,-4.2,.16);
        for(const L of legs)m.box(L.hip,[1.1,1.1,1.1]);
      }}
  }
  { // H2 CRAB: hexapod carrier, mandible twin cannons, top turret
    const Y=3.4,legs=[];
    for(const sx of[-1,1])for(const [z,spread] of [[-1.8,.6],[0,0],[1.8,-.6]])
      legs.push(gaLegDesign([sx*2.1,Y+.2,z],[sx*3.9,Y+2.2,z+spread*.6],[sx*5.0,.9,z+spread],[sx*5.1,0,z+spread],.32));
    const shell=(y,w,l)=>[[-w,y,-l*.8],[-w*.55,y,-l],[w*.55,y,-l],[w,y,-l*.8],[w*1.05,y,l*.6],[w*.6,y,l],[-w*.6,y,l],[-w*1.05,y,l*.6]];
    K.crab={label:'CRAB',heavy:true,s:.85,kneeHp:3,collapseAt:3,speed:2.1,turn:.2,range:70,arc:1.2,fire:[1.6,2.0],volley:3,volleyGap:.3,minRange:22,
      reach:2.2,swing:.42,lift:.8,offsets:[0,.5,0,.5,0,.5],bobAmp:.07,pivotY:Y,legs,radius:3.0,bodyBottom:Y-.8,top:5.9,
      muzzles:[[-.75,Y-.2,-5.6],[.75,Y-.2,-5.6]],spheres:[[0,Y+.4,0,2.9],[0,Y-.2,-3.6,1.1]],hullHp:22,col:C.m,score:2000,
      body(m){
        m.loft([shell(Y-.8,1.6,2.6),shell(Y,2.4,3.4),shell(Y+.9,2.2,3.1),shell(Y+1.4,1.3,2.2)]);
        m.box([0,Y-.2,-3.4],[2.2,.8,.8]);
        for(const x of[-.75,.75])m.barrel(x,Y-.2,-3.6,-5.6,.2);
        m.loft([m.ringXZ(0,Y+1.35,.2,.9,.9,6),m.ringXZ(0,Y+1.95,.2,.7,.7,6)]);
        m.barrel(0,Y+1.7,-.4,-2.4,.12);
        for(const L of legs)m.box(L.hip,[.6,.6,.6]);
      }}
    // Tripod gait: front+rear on one side with the middle on the other.
    K.crab.offsets=[0,.5,0,.5,0,.5];
  }
  { // L1 HOUND: fast quadruped
    const Y=1.9,legs=[];
    for(const sx of[-1,1])for(const z of[-.9,.8])
      legs.push(gaLegDesign([sx*.55,Y-.1,z],[sx*.8,Y-.5,z+(z<0?-.5:.5)],[sx*.8,.45,z+(z<0?.15:-.1)],[sx*.82,0,z+(z<0?.1:-.1)],.2));
    // Legs are LF, LH, RF, RH. Speed picks walk -> trot -> rotary gallop, blended.
    K.hound={label:'HOUND',s:1.1,hp:4,speed:12.5,turn:2.6,range:50,arc:1.05,fire:[.6,.85],volley:1,
      reach:1.7,minCycle:.32,swing:.45,lift:.35,offsets:[0,.5,.5,0],bobAmp:.05,pivotY:Y,legs,radius:1.3,bodyBottom:0,top:2.5,
      gaits:[
        {v:0,offsets:[.25,0,.75,.5],swing:.25,lift:.28,bobAmp:.03,bobK:2,pitchAmp:0},
        {v:5,offsets:[0,.5,.5,0],swing:.45,lift:.36,bobAmp:.05,bobK:2,pitchAmp:.025},
        {v:9.5,offsets:[.55,0,.45,.1],swing:.62,lift:.46,bobAmp:.14,bobK:1,pitchAmp:.09}],
      muzzles:[[0,Y+.5,-1.7]],spheres:[[0,Y,-.3,1.4]],col:C.m,score:400,
      body(m){
        m.loft([[[-.45,Y-.3,-1.3],[.45,Y-.3,-1.3],[.5,Y+.25,-1.2],[-.5,Y+.25,-1.2]],[[-.55,Y-.35,1.1],[.55,Y-.35,1.1],[.5,Y+.3,1.0],[-.5,Y+.3,1.0]]]);
        m.beam([0,Y+.05,-1.2],[0,Y+.25,-1.8],.35,.3);
        m.loft([[[-.2,Y+.1,-1.6],[.2,Y+.1,-1.6],[.25,Y+.4,-1.6],[-.25,Y+.4,-1.6]],[[-.12,Y+.2,-2.9],[.12,Y+.2,-2.9],[.14,Y+.32,-2.9],[-.14,Y+.32,-2.9]]]);
        m.box([0,Y+.45,.1],[.5,.35,.9]);
        m.barrel(0,Y+.5,-.3,-1.7,.08);
      }}
  }
  { // L2 STILT: tripod scout
    const H=3.1,legs=[];
    for(let i=0;i<3;i++){const a=-Math.PI/2+i*2*Math.PI/3,c=Math.cos(a),s=Math.sin(a);
      legs.push(gaLegDesign([c*.7,H-.15,s*.7],[c*1.6,H+.55,s*1.6],[c*2.05,.5,s*2.05],[c*2.1,0,s*2.1],.17))}
    K.stilt={label:'STILT',s:.85,hp:3,speed:3.4,turn:.9,range:56,arc:1.3,fire:[.85,1.15],volley:2,volleyGap:.3,minRange:16,
      reach:1.8,swing:.3,lift:.5,offsets:[0,1/3,2/3],bobAmp:.05,pivotY:H,legs,radius:1.8,bodyBottom:H-.4,top:3.8,
      muzzles:[[-.3,H-.2,-1.6],[.3,H-.2,-1.6]],spheres:[[0,H,0,1.2]],col:C.m,score:350,
      body(m){
        m.loft([m.ringXZ(0,H-.35,0,.5,.5,6),m.ringXZ(0,H-.1,0,.95,.95,6),m.ringXZ(0,H+.2,0,.9,.9,6),m.ringXZ(0,H+.45,0,.45,.45,6)]);
        m.box([0,H+.05,-.95],[.5,.16,.14]);
        for(const x of[-.3,.3])m.barrel(x,H-.2,-.5,-1.6,.07);
        for(const L of legs)m.box(L.hip,[.3,.3,.3]);
      }}
  }
  { // T1 WEDGE: hover tank
    const hull=(y,w,l,nose)=>[[-w*nose,y,-l],[w*nose,y,-l],[w,y,-l*.35],[w,y,l],[-w,y,l],[-w,y,-l*.35]];
    K.wedge={label:'WEDGE',tank:true,hover:true,s:.9,hp:5,speed:3.2,turn:.7,range:55,shells:true,shellEvery:[2.1,2.9],fire:[1.0,1.3],volley:2,volleyGap:.2,turretZ:.25,
      radius:1.9,bodyBottom:0,top:1.5,muzzles:[[0,1.25,-2.7]],spheres:[[0,.8,0,1.9]],col:C.m,score:500,
      body(m){
        m.loft([hull(.35,1.25,1.9,.45),hull(.6,1.5,2.2,.5),hull(1.05,1.3,2.0,.4)]);
        m.box([-1.45,.45,.2],[.2,.3,3.4]);m.box([1.45,.45,.2],[.2,.3,3.4]);
      },
      turret(m){
        m.loft([[[-.55,1.0,-.45],[.55,1.0,-.45],[.75,1.0,.5],[.75,1.0,.95],[-.75,1.0,.95],[-.75,1.0,.5]],[[-.35,1.5,-.25],[.35,1.5,-.25],[.55,1.5,.45],[.55,1.5,.8],[-.55,1.5,.8],[-.55,1.5,.45]]]);
        m.barrel(0,1.25,-.3,-2.7,.1);
      }}
  }
  { // T2 RAM: tracked tank, twin barrels
    K.ram={label:'RAM',tank:true,s:.9,hp:7,speed:2.2,turn:.5,range:52,shells:true,shellEvery:[2.7,3.5],fire:[1.3,1.6],volley:3,volleyGap:.15,turretZ:.3,
      radius:2.0,bodyBottom:0,top:1.55,muzzles:[[-.22,1.25,-2.2],[.22,1.25,-2.2]],spheres:[[0,.8,0,2.0]],col:C.m,score:650,
      body(m){
        for(const sx of[-1,1])m.loft([[[sx*1.0,.05,-1.9],[sx*1.55,.05,-1.9],[sx*1.55,.75,-2.2],[sx*1.0,.75,-2.2]],[[sx*1.0,.05,1.8],[sx*1.55,.05,1.8],[sx*1.55,.75,2.05],[sx*1.0,.75,2.05]]]);
        m.loft([[[-1.1,.35,-2.0],[1.1,.35,-2.0],[1.1,.95,-1.6],[-1.1,.95,-1.6]],[[-1.1,.35,1.9],[1.1,.35,1.9],[1.1,1.0,1.7],[-1.1,1.0,1.7]]]);
      },
      turret(m){
        m.loft([m.ringXZ(0,.95,.3,.95,.95,6,Math.PI/6),m.ringXZ(0,1.55,.35,.7,.75,6,Math.PI/6)]);
        for(const x of[-.22,.22])m.barrel(x,1.25,-.5,-2.2,.1);
      }}
  }
  return K
})();

// ---- Factory assault additions: tesla Strider and red shield generator ----
(()=>{
  const S=GA_KINDS.strider,H=6.6,y0=H+2.1;
  // Tesla crown: insulator stack and toroid on the dome, overlapping the dome so it
  // is one connected body. The lightning leaves from the top of the toroid.
  const coil=m=>{
    m.loft([m.ringXZ(0,y0-.25,.3,.32,.32,6),m.ringXZ(0,y0+1.3,.3,.32,.32,6)]);
    for(const y of[y0+.35,y0+.75])m.loft([m.ringXZ(0,y,.3,.3,.3,6),m.ringXZ(0,y,.3,.62,.62,6),m.ringXZ(0,y+.1,.3,.62,.62,6),m.ringXZ(0,y+.1,.3,.3,.3,6)]);
    m.loft([m.ringXZ(0,y0+1.3,.3,.3,.3,8),m.ringXZ(0,y0+1.45,.3,1.3,1.3,8),m.ringXZ(0,y0+1.75,.3,1.3,1.3,8),m.ringXZ(0,y0+1.9,.3,.3,.3,8)]);
  };
  GA_KINDS.tesla={...S,label:'TESLA STRIDER',tesla:true,coilTop:[0,y0+1.9,.3],body(m){S.body(m);coil(m)}};
  // Generator A (Dave's pick): plinth, octagonal column, eight full-height radial
  // cooling fins, stepped cap. Fins overlap the column; everything is one piece.
  const fin=(m,a,rIn,rOut,yA,yB,th)=>{const c=Math.cos(a),s=Math.sin(a),tx=-s*th/2,tz=c*th/2;
    const sec=y=>[[c*rIn+tx,y,s*rIn+tz],[c*rOut+tx,y,s*rOut+tz],[c*rOut-tx,y,s*rOut-tz],[c*rIn-tx,y,s*rIn-tz]];m.loft([sec(yA),sec(yB)])};
  GA_KINDS.generator={label:'GENERATOR',static:true,s:.8,hp:20,radius:2.4,bodyBottom:0,top:6.7,muzzles:[],spheres:[[0,3.2,0,2.4]],col:C.r,score:1500,
    body(m){
      m.box([0,.4,0],[4,.8,4]);
      m.loft([m.ringXZ(0,.8,0,1.3,1.3,8),m.ringXZ(0,5.2,0,1.3,1.3,8)]);
      m.loft([m.ringXZ(0,5.2,0,1.55,1.55,8),m.ringXZ(0,5.7,0,1.55,1.55,8),m.ringXZ(0,6.3,0,.9,.9,8),m.ringXZ(0,6.7,0,.4,.4,8)]);
      for(let i=0;i<8;i++)fin(m,i*Math.PI/4+Math.PI/8,1.15,2.1,.8,5.0,.14)
    }};
})();
// Geodesic hemisphere (icosahedron with a vertex up, even frequency => clean equator).
const GA_DOME=(()=>{
  const freq=4,t=(1+Math.sqrt(5))/2,n=v=>{const l=Math.hypot(v[0],v[1],v[2]);return[v[0]/l,v[1]/l,v[2]/l]};
  const raw=[[-1,t,0],[1,t,0],[-1,-t,0],[1,-t,0],[0,-1,t],[0,1,t],[0,-1,-t],[0,1,-t],[t,0,-1],[t,0,1],[-t,0,-1],[-t,0,1]];
  const up=n(raw[0]),ax=n([up[2],0,-up[0]]),ang=Math.acos(up[1]);
  const rot=v=>{const c=Math.cos(ang),s=Math.sin(ang),[x,y,z]=v,[kx,ky,kz]=ax,d=kx*x+ky*y+kz*z;
    return[x*c+(ky*z-kz*y)*s+kx*d*(1-c),y*c+(kz*x-kx*z)*s+ky*d*(1-c),z*c+(kx*y-ky*x)*s+kz*d*(1-c)]};
  const V=raw.map(v=>rot(n(v)));
  const F=[[0,11,5],[0,5,1],[0,1,7],[0,7,10],[0,10,11],[1,5,9],[5,11,4],[11,10,2],[10,7,6],[7,1,8],[3,9,4],[3,4,2],[3,2,6],[3,6,8],[3,8,9],[4,9,5],[2,4,11],[6,2,10],[8,6,7],[9,8,1]];
  const pts=[],key=new Map(),seen=new Set(),E=[];
  const P=v=>{const q=n(v),k=q.map(x=>Math.round(x*1e5)).join(',');if(key.has(k))return key.get(k);pts.push(q);key.set(k,pts.length-1);return pts.length-1};
  const addE=(a,b)=>{if(a===b)return;const k=a<b?a+'_'+b:b+'_'+a;if(seen.has(k))return;seen.add(k);E.push([a,b])};
  for(const [a,b,c] of F){const A=V[a],B=V[b],Cc=V[c],g=[];
    for(let i=0;i<=freq;i++){g[i]=[];for(let j=0;j<=freq-i;j++){const k=freq-i-j;g[i][j]=P([(A[0]*k+B[0]*i+Cc[0]*j)/freq,(A[1]*k+B[1]*i+Cc[1]*j)/freq,(A[2]*k+B[2]*i+Cc[2]*j)/freq])}}
    for(let i=0;i<=freq;i++)for(let j=0;j<=freq-i;j++){if(i<freq-j)addE(g[i][j],g[i+1][j]);if(j<freq-i)addE(g[i][j],g[i][j+1]);if(i>0&&g[i-1][j+1]!==undefined)addE(g[i][j],g[i-1][j+1])}}
  return{pts,edges:E.filter(([a,b])=>pts[a][1]>-1e-3&&pts[b][1]>-1e-3)}
})();
// Lightning: a midpoint-displaced polyline in screen space, re-rolled every frame.
function gaDrawArc(a,b,col,width=1.1,rough=.32){
  const pa=proj(a),pb=proj(b);if(!pa||!pb)return;
  let pts=[[pa.x,pa.y],[pb.x,pb.y]];
  for(let lv=0;lv<4;lv++){const np=[pts[0]];for(let i=1;i<pts.length;i++){const p=pts[i-1],q=pts[i],dx=q[0]-p[0],dy=q[1]-p[1],L=Math.hypot(dx,dy)||1,k=(Math.random()-.5)*L*rough;np.push([(p[0]+q[0])/2-dy/L*k,(p[1]+q[1])/2+dx/L*k],q)}pts=np}
  for(let i=1;i<pts.length;i++){line(pts[i-1][0],pts[i-1][1],pts[i][0],pts[i][1],col,3.4,.3);line(pts[i-1][0],pts[i-1][1],pts[i][0],pts[i][1],C.w,width,.95)}
  if(pts.length>6){const j=2+Math.floor(Math.random()*(pts.length-4)),st=pts[j];line(st[0],st[1],st[0]+(Math.random()-.5)*44,st[1]+(Math.random()-.3)*36,col,1,.7)}
}

// Frame-time readout for the ground test missions (Dave's machine, not ours).
const gaPerf={gap:16.7,js:0,last:0,start:0};
function perfStart(now){if(gaPerf.last)gaPerf.gap=lerp(gaPerf.gap,Math.min(100,now-gaPerf.last),.05);gaPerf.last=now;gaPerf.start=performance.now()}
function perfNote(){gaPerf.js=lerp(gaPerf.js,performance.now()-gaPerf.start,.05)}

class GroundAssaultController{
  constructor(){this.reset()}
  reset(){
    this.active=false;this.units=[];this.groups=[];this.nextId=1;this.state='idle';this.t=0;this.clearT=0;this.leadIn=null;this.reactorDown=false;this.fin=null;this.pounceWarn=0;
    this.devExitPending=false;this.lockId=0;this.lockAcquireId=0;this.lockAcquireT=0;this.armourHintT=0;this.navPulse=0;
    this.startTotal=0;this.spd=GA_SPEED_CRUISE;this.strafing=false;this.trees=[];this.hCache=new Map();this.tSeed=[0,0,0];this.alt=1.9;this.terrainCD=0;this.lastTravel=0;
    this.variant='dunes';this.groundCol=C.gd;this.flats=[];this.domes=[];this.bunker=null;this.bunkerUnlocked=false;this.shieldHintT=0;this.arcWarn=0
  }
  // ---------- setup ----------
  begin(opts={}){
    this.reset();this.active=true;this.state='hunt';
    mode='play';phase='surface';phaseT=modeT=0;travel=0;score=0;
    fighters.length=0;asteroids.length=0;groundTargets.length=0;bolts.length=0;hazards.length=0;shots.length=0;playerMissiles.length=0;
    inputX=inputY=aimX=aimY=viewYaw=viewPitch=viewRoll=shipX=0;shipY=-1.55;surfaceVX=surfaceVY=0;surfaceDistance=0;
    surfaceNeutralYaw=surfaceNeutralPitch=0;surfacePylonVoicePlayed=true;surfaceSpawn=999;
    surfaceBunkerActive=false;entryBunkerWorldZ=Infinity;entryBunkerX=0;tunnelOriginX=0;tunnelStartWorld=Infinity;
    reactorBoundaryWorld=escapeBoundaryWorld=exitDoorWorld=Infinity;
    resetPlanetBearing();resetSpaceMotion();resetSpaceDogfightDirector();spaceOrientationReady=false;
    // Four groups at rough locations. The first is roughly ahead so the trial
    // opens with something to fly at; the rest are spread around the compass.
    const plan=[
      {name:'ALPHA',units:['wedge','wedge','ram','ram'],dist:125},
      {name:'BRAVO',units:['hound','hound','hound','stilt','stilt'],dist:165},
      {name:'CHARLIE',units:['strider','stilt','stilt'],dist:205},
      {name:'DELTA',units:['crab','wedge','wedge'],dist:245}
    ];
    const base=(Math.random()-.5)*.6;
    if(!opts.noGroups)plan.forEach((g,i)=>{
      const a=base+[0,1.75,-1.85,3.2][i]+(i?(Math.random()-.5)*.45:0);
      const cx=Math.sin(a)*g.dist,cwz=Math.cos(a)*g.dist;
      // The nav point is deliberately imprecise: up to ~20 units off the group.
      const na=Math.random()*Math.PI*2,nr=8+Math.random()*12;
      const grp={name:g.name,letter:g.name[0],cx,cwz,navX:cx+Math.sin(na)*nr,navWZ:cwz+Math.cos(na)*nr,radius:32,cleared:false,ids:[]};
      g.units.forEach((k,j)=>{
        const ua=j*2.4+Math.random(),ur=j?7+Math.random()*9:0;
        const u=this.spawn(k,cx+Math.sin(ua)*ur,cwz+Math.cos(ua)*ur,Math.random()*Math.PI*2,grp);
        grp.ids.push(u.id)
      });
      this.groups.push(grp)
    });
    if(opts.noGroups)return;
    this.seedTerrain();this.lastTravel=travel;this.alt=1.9;
    for(const u of this.units)this.seat(u,1,true);
    this.startTotal=this.units.length;
    audio.resetMissionVoices?.();audio.music.setMode('combat');
    say('DUNE TRIAL · FOLLOW THE NAV POINTS',1.4)
  }
  // ---------- DEV: factory assault test (reactor template, surface reworked) ----------
  // Red shield generators replace the pylons. Some are guarded by armour; some sit
  // under a blue geodesic shield powered by a tesla Strider that walks close by.
  // Kill the Strider and its dome falls. Every generator down drops the bunker
  // dome; the normal bunker entry, tunnel, reactor, escape and launch follow.
  beginFactory(opts={}){
    // From a story descent keep the landing attitude and height: no camera snap on touchdown.
    const keep=opts.keepView?{yaw:viewYaw,pitch:viewPitch,roll:viewRoll,y:shipY}:null;
    this.begin({silent:true,noGroups:true});
    if(keep){viewYaw=keep.yaw;viewPitch=keep.pitch;viewRoll=keep.roll;shipY=keep.y}this.variant='factory';this.groundCol=C.o;
    const B={x:(Math.random()-.5)*40,wz:480};
    const plan=[
      // Sites ~130–240 apart: each is its own fight, and fewer walkers are on screen at once.
      {name:'ALPHA',x:-105,z:135,units:['wedge','wedge','ram','ram']},
      {name:'BRAVO',x:112,z:165,units:['hound','hound','hound','stilt','stilt']},
      {name:'CHARLIE',x:-180,z:262,units:['tesla','stilt','stilt'],dome:true},
      {name:'DELTA',x:60,z:285,units:['wedge','wedge','ram','ram']},
      {name:'ECHO',x:-172,z:412,units:['hound','hound','stilt','stilt','stilt']},
      {name:'FOXTROT',x:180,z:382,units:['tesla','stilt','stilt','hound'],dome:true}
    ];
    // Flat ground under the bunker, along its approach, and where the tunnel surfaces.
    this.flats=[{x:B.x,z:B.wz,r0:30,r1:60},{x:B.x,z:B.wz-60,r0:18,r1:40},{x:B.x,z:B.wz+392,r0:30,r1:60}];
    for(const g of plan){
      const cx=g.x+(Math.random()-.5)*16,cwz=g.z+(Math.random()-.5)*16,na=Math.random()*Math.PI*2,nr=6+Math.random()*10;
      const grp={name:g.name,letter:g.name[0],cx,cwz,navX:cx+Math.sin(na)*nr,navWZ:cwz+Math.cos(na)*nr,radius:32,cleared:false,ids:[]};
      const gen=this.spawn('generator',cx,cwz,Math.random()*6.28,grp);grp.ids.push(gen.id);grp.genId=gen.id;
      g.units.forEach((k,j)=>{
        const ua=j*2.1+Math.random(),ur=k==='tesla'?15+Math.random()*4:9+Math.random()*8;
        const u=this.spawn(k,cx+Math.sin(ua)*ur,cwz+Math.cos(ua)*ur,Math.random()*6.28,grp);grp.ids.push(u.id);
        if(k==='tesla'){u.leash=24;u.wanderR=16;u.minWander=12;u.charge=0;u.strikeCD=0;u.strikeT=0}
      });
      if(g.dome){const t=this.units.find(u=>grp.ids.includes(u.id)&&u.K.tesla);this.domes.push({x:cx,wz:cwz,r:7.6,up:1,hitT:0,genId:gen.id,teslaId:t?.id||0})}
      this.groups.push(grp)
    }
    // The bunker guard: not an objective, just in the way.
    const bg={name:'BUNKER',letter:'B',cx:B.x,cwz:B.wz-40,navX:B.x,navWZ:B.wz-45,radius:30,cleared:true,ids:[],guard:true};
    // Flanking the approach, never on the door line (the entry autopilot flies that line).
    for(const [k,dx,dz] of [['crab',-34,-40],['wedge',30,-50],['wedge',38,-30]]){const u=this.spawn(k,B.x+dx,B.wz+dz,Math.PI,bg);u.leash=30;bg.ids.push(u.id)}
    this.groups.push(bg);
    // Bunker: the reactor template's own fortress, entry and tunnel.
    this.bunker=B;surfaceBunkerActive=true;entryBunkerX=B.x;entryBunkerWorldZ=B.wz;tunnelOriginX=B.x;tunnelStartWorld=B.wz+.65;
    bunkerDoorHp=0;bunkerDoorOpen=true;doorFlash=0; // Dave: the bunker has no door at all
    doorBreachAt=-1;doorBreachPending=0;doorPylonsDestroyed=0;reactorAnnounced=false;
    let rh=10,hy=6;if(typeof bunkerFortress03Mesh!=='undefined')for(const v of bunkerFortress03Mesh.v){rh=Math.max(rh,Math.hypot(v[0],v[2])*1.25);hy=Math.max(hy,v[1]*1.25)}
    this.domes.push({x:B.x,wz:B.wz+5.7*1.25,r:Math.max(rh,hy)*1.12,up:1,hitT:0,bunker:true});
    B.ctr=5.7*1.25;B.rh=rh*.85;B.hy=hy;
    this.seedTerrain();this.lastTravel=travel;this.alt=1.9;
    for(const u of this.units)this.seat(u,1,true);
    this.startTotal=this.units.length;
    audio.resetMissionVoices?.();audio.music.setMode('violent');
    say('FACTORY TEST · DESTROY THE GENERATORS',1.4)
  }
  factoryTunnel(){return this.active&&this.variant==='factory'&&(phase==='trench'||phase==='reactor'||phase==='escape'||mode==='exitDoor')}
  // Much longer run before the reactor (Dave): push the reactor and everything after it out.
  onBeginTrench(){
    if(!(this.active&&this.variant==='factory'))return;
    const extra=1250;this.tunnelStartWZ=travel;this.tSpawnWZ=null;this.tSpawnPhase='';reactorBoundaryWorld+=extra;escapeBoundaryWorld+=extra;exitDoorWorld+=extra;
    for(const g of groundTargets)if(g.type==='reactor'){g.worldZ+=extra;g.z=g.worldZ-travel;g.factoryReactor=true;g.hp=8;g.mesh=this.reactorMesh(0);g.mx=g.my=g.mz=1;g.s=1}
    this.flats.push({x:tunnelOriginX,z:exitDoorWorld,r0:30,r1:60});this.hCache.clear();
    say('TUNNEL RUN · HOLD ON',.8)
  }
  // ---------- factory tunnel: alternating gun and girder sections ----------
  // Sections ~140 u long alternate: mostly tracking wall guns, or mostly girders.
  // Girders are solid slabs across the bore: single horizontal/vertical beams at the
  // learnable heights, crosses, and pairs that leave one narrow slot. Every slot is
  // at least GA_SLOT wide edge to edge and placed inside the drone's reach.
  tunnelSpawner(limitWZ,escape){
    const ph=escape?'escape':'trench';
    if(this.tSpawnPhase!==ph){this.tSpawnPhase=ph;this.tSpawnWZ=travel+(escape?30:40);if(escape){this.tunnelStartWZ=travel;if(this.reactorDown)say('CONTAINMENT FAILING · GET OUT',1.3)}}
    // Track the drone's sideways motion in the bore so the wall guns can lead it.
    const fdt=Math.max(1e-3,time-(this.tvT??time-1/60));this.tvT=time;
    this.tvx=lerp(this.tvx||0,(shipX-(this.tvLX??shipX))/fdt,.35);this.tvy=lerp(this.tvy||0,(shipY-(this.tvLY??shipY))/fdt,.35);this.tvLX=shipX;this.tvLY=shipY;
    let guard=0;
    while(this.tSpawnWZ<travel+70&&this.tSpawnWZ<limitWZ&&guard++<8){
      const d=this.tSpawnWZ-(this.tunnelStartWZ||travel),guns=!escape&&Math.floor(d/150)%2===1;
      if(escape){ // escape: girders with guns among them, never a gun in a girder's slot
        const r=Math.random(),kind=r<.3?'h1':r<.6?'v1':r<.8?'hh':'vv';
        this.spawnBar(this.tSpawnWZ,kind);
        if(Math.random()<.45)this.spawnTunnelGun(Math.random()<.5?-1:1,this.tSpawnWZ+6);
        this.tSpawnWZ+=(kind==='hh'||kind==='vv'?14:12)+Math.random()*4;continue
      }
      if(guns){
        this.spawnTunnelGun(Math.random()<.5?-1:1,this.tSpawnWZ);
        if(Math.random()<.1)this.spawnTunnelGun(Math.random()<.5?-1:1,this.tSpawnWZ+2.5);
        if(Math.random()<.45)this.spawnBar(this.tSpawnWZ+5,Math.random()<.5?'h1':'v1');
        this.tSpawnWZ+=12+Math.random()*6
      }else{
        // Dave (v46): horizontal + vertical beams together (cross, window) were too hard;
        // a girder is now all-horizontal or all-vertical.
        const r=Math.random(),kind=r<.25?'h1':r<.5?'v1':r<.75?'hh':'vv';
        this.spawnBar(this.tSpawnWZ,kind);
        if(Math.random()<.06)this.spawnTunnelGun(Math.random()<.5?-1:1,this.tSpawnWZ+5);
        // ~0.5-0.7 s apart at tunnel speed: enough to cross the bore, no time to relax.
        this.tSpawnWZ+=(kind==='hh'||kind==='vv'?13:11)+Math.random()*3.5
      }
    }
  }
  // Every girder is the SAME standard beam (Dave: consistent size): thickness GA_BEAM,
  // spanning the whole bore. Patterns are built only from these beams; paired beams
  // leave a GA_SLOT gap (edge to edge) whose centre is always inside the drone's reach.
  spawnBar(wz,kind){
    const W2=trenchWall()*1.04,H2=tunnelHalfH()*1.04,reachX=trenchWall()-.56,reachY=tunnelHalfH()-.28,T=GA_BEAM,S=GA_SLOT;
    const rects=[],col=C.c,pick=a=>a[(Math.random()*a.length)|0],rnd=(lo,hi)=>lo+Math.random()*(hi-lo);
    const hBeam=y=>rects.push([-W2,W2,y-T/2,y+T/2]),vBeam=x=>rects.push([x-T/2,x+T/2,-H2,H2]);
    const maxHY=H2-T/2,maxVX=W2-T/2;
    if(kind==='h1')hBeam(pick([-.75,-.25,.25,.75]));
    else if(kind==='v1')vBeam(pick([-.9,-.35,.35,.9])*reachX/1.2);
    else if(kind==='x2'){hBeam(pick([-.55,0,.55]));vBeam(pick([-.7,0,.7])*reachX/1.2)}
    else if(kind==='hh'){const g=rnd(-1,1)*Math.min(reachY-.2,maxHY-S/2-T/2);hBeam(g+S/2+T/2);hBeam(g-S/2-T/2)}
    else if(kind==='vv'){const g=rnd(-1,1)*Math.min(reachX-.2,maxVX-S/2-T/2);vBeam(g+S/2+T/2);vBeam(g-S/2-T/2)}
    else if(kind==='win'){ // one window: two horizontal + two vertical standard beams
      const gy=rnd(-1,1)*Math.min(reachY-.2,maxHY-S/2-T/2),gx=rnd(-1,1)*Math.min(reachX-.2,maxVX-S/2-T/2);
      hBeam(gy+S/2+T/2);hBeam(gy-S/2-T/2);vBeam(gx+S/2+T/2);vBeam(gx-S/2-T/2)}
    // Clip beams to the bore so an off-centre pair never pokes through the wall.
    for(const q of rects){q[0]=Math.max(q[0],-W2);q[1]=Math.min(q[1],W2);q[2]=Math.max(q[2],-H2);q[3]=Math.min(q[3],H2)}
    hazards.push({factoryBar:true,kind,worldZ:wz,z:wz-travel,rects,col,hitFx:0,dead:false,passed:false})
  }
  updateBar(h){
    if(!h.passed&&h.z<1.45){
      const c=tunnelCenter(h.z),dx=shipX-c.x,dy=shipY-c.y,r=GA_SHIP_R;
      const hit=h.rects.some(q=>dx>q[0]-r&&dx<q[1]+r&&dy>q[2]-r&&dy<q[3]+r);
      if(hit)damage('GIRDER');else score+=120;h.passed=true
    }
    if(h.z<.22)h.dead=true
  }
  drawBar(h){
    const c=tunnelCenter(h.z),col=hitFxColor(h.hitFx,h.col||C.c);
    for(const q of h.rects)drawMesh({type:'factoryBar',x:c.x+(q[0]+q[1])/2,y:c.y+(q[2]+q[3])/2,z:h.z+.43,s:.5,mx:q[1]-q[0],my:q[3]-q[2],mz:.86,rot:[0,0,0]},courierFixtureBoxMesh,col,.96)
  }
  // Reactor B (Dave's pick): a core column through the bore, three heat rings (yellow)
  // sliding up and down it, and four conduits braced into the wall/ceiling corners.
  reactorMesh(t){
    const m=gaBuilder(true),HH=tunnelHalfH(),W=trenchWall();
    m.loft([m.ringXZ(0,-HH,0,.42,.42,8),m.ringXZ(0,HH,0,.42,.42,8)]);
    m.mark('rings',()=>{for(let i=0;i<3;i++){const y=-.8+i*.8+Math.sin(t*2+i*2.1)*.22;
      m.loft([m.ringXZ(0,y-.1,0,.42,.42,10),m.ringXZ(0,y-.1,0,1.0,1.0,10),m.ringXZ(0,y+.1,0,1.0,1.0,10),m.ringXZ(0,y+.1,0,.42,.42,10)])}});
    for(const [x,y] of[[-1,1],[1,1],[-1,-1],[1,-1]])m.beam([x*.3,y*.9,0],[x*(W-.05),y*(HH-.1),0],.18,.18);
    const r=m.marks.rings,mesh={v:m.v,e:m.e,faces:m.faces};
    mesh.edgeColors=m.e.map(e=>e[0]>=r[0]&&e[0]<r[1]&&e[1]>=r[0]&&e[1]<r[1]?C.y:null);
    return mesh
  }
  drawReactor(g){
    const c=tunnelCenter(g.z),mesh=this.reactorMesh(time);
    if((g.hitFx||0)>0)mesh.edgeColors=null;
    g.mesh=mesh;g.mx=g.my=g.mz=1;g.s=1;
    drawMesh({x:c.x,y:c.y,z:g.z,s:1,rot:[0,0,0],hitFx:g.hitFx||0},mesh,objectHitColor(g,C.r))
  }
  // The bunker mission's tracking wall guns, planted on the straight reactor trench walls.
  spawnTunnelGun(side,wz){
    const wg=bunkerRaid.content?.bunker?.wallGuns;if(!wg)return;
    const z=wz-travel,c=tunnelCenter(z),yOff=(Math.random()-.5)*1.3;
    groundTargets.push({type:'landgun',landGunTest:true,wallMount:true,factoryTunnel:true,mountSide:side,worldZ:wz,
      x:c.x+side*(trenchWall()-wg.mountInset),yOff,y:c.y+yOff,z,s:wg.scaleBase+Math.random()*.08,hp:2,hitFx:0,yaw:0,pitch:0,rot:[0,0,0],
      col:C.r,mesh:landGunDevPlinthMesh,fireCD:.45+Math.random()*.8,dead:false,shot:false,passed:false})
  }
  updateTunnelGun(g,dt){
    const wg=bunkerRaid.content.bunker.wallGuns,c=tunnelCenter(g.z);
    g.x=c.x+g.mountSide*(trenchWall()-wg.mountInset);g.y=c.y+(g.yOff||0);
    if(g.z<.12){g.dead=true;return}
    const pivot=bunkerRaid.pivotWorld(g),dv=bunkerRaid.unmountVector(g,[shipX-pivot[0],shipY-pivot[1],-pivot[2]]);
    const h=Math.max(.001,Math.hypot(dv[0],dv[2])),ty=Math.atan2(dv[0],dv[2]),tp=clamp(-Math.atan2(dv[1],h),wg.pitchMin,wg.pitchMax);
    const ye=wrapAngle(ty-(g.yaw||0)),pe=tp-(g.pitch||0);
    g.yaw=wrapAngle((g.yaw||0)+clamp(ye,-dt*wg.yawRate*1.3,dt*wg.yawRate*1.3));g.pitch=moveToward(g.pitch||0,tp,dt*wg.pitchRate*1.3);
    g.fireCD-=dt;
    // Dave: tunnel gun projectiles had no speed or aim. Hostile bolts live in the
    // drone's frame (it sits at z=0), so the drone's own forward speed must be part
    // of the closing speed, and the lead must use its sideways motion in the bore.
    if(g.z>9&&g.z<46&&Math.abs(ye)<wg.yawTolerance*1.6&&g.fireCD<=0){
      const live=bolts.reduce((n,b)=>n+(!b.dead&&b.factoryShot?1:0),0);
      if(live<2){this.tunnelShot(g);g.fireCD=1.6+Math.random()*.7}else g.fireCD=.25+Math.random()*.2
    }
  }
  tunnelShot(g){
    const m=bunkerRaid.muzzleWorld(g),close=forwardSpeed()+18,dist=Math.max(1,Math.hypot(shipX-m[0],shipY-m[1],m[2]));
    const T=Math.max(.42,m[2]/close),aimed=Math.random()<.5,lead=clamp(T,0,.7);
    let tx=shipX+(this.tvx||0)*lead,ty=shipY+(this.tvy||0)*lead;
    if(!aimed){const a=Math.random()*6.28,miss=.55+Math.random()*.5;tx+=Math.cos(a)*miss;ty+=Math.sin(a)*miss*.7}
    const c=tunnelCenter(.5),rx=trenchWall()-.3,ry=tunnelHalfH()-.2;tx=clamp(tx,c.x-rx,c.x+rx);ty=clamp(ty,c.y-ry,c.y+ry);
    bolts.push({x:m[0],y:m[1],z:m[2],spawnDistance:dist,targetX:tx,targetY:ty,targetZ:0,hitIntent:aimed,
      vx:(tx-m[0])/T,vy:(ty-m[1])/T,vz:-m[2]/T,homing:0,swampSpit:true,factoryShot:true,
      rot:Math.random()*6.28,dead:false,visibleFor:0,visibleNow:false,age:0,maxLife:T+.6,damageLabel:'GUN HIT'});
    const p=proj(m);if(p)spark(p.x,p.y,C.r,5)
  }
  inBunkerCone(){
    const B=this.bunker;if(!B)return false;const ahead=B.wz-travel,dx=Math.abs(shipX-B.x),yaw=Math.abs(wrapAngle(viewYaw));
    // Far out: a generous cone. Close in (Dave flew straight at the door): a tighter
    // one, still gentle enough for the entry spline to curve in without a snap.
    if(ahead>45)return dx<ahead*.45&&yaw<.8;
    return ahead>16&&dx<ahead*.3+1&&yaw<.45
  }
  // Bunker lead-in autopilot (v46). v45 chased waypoints and wandered (Dave: "really
  // convoluted"). Now it plans ONE shortest constant-radius path (Dubins: turn,
  // straight, turn) from the drone's exact position and heading onto the door axis,
  // checks it clears the fortress, and flies it. Starts on the current heading, one
  // steady turn rate, no dithering; the entry autopilot takes over at the end.
  dubins(p0,t0,p1,t1,R){
    // Frame: u = world z, v = world x, heading theta = viewYaw (so dir = (cos,sin)).
    const mod=a=>((a%(2*Math.PI))+2*Math.PI)%(2*Math.PI);
    const du=(p1[0]-p0[0])/R,dv=(p1[1]-p0[1])/R,d=Math.hypot(du,dv),ph=Math.atan2(dv,du),al=mod(t0-ph),be=mod(t1-ph);
    const sa=Math.sin(al),sb=Math.sin(be),ca=Math.cos(al),cb=Math.cos(be),out=[];
    {const p2=2+d*d-2*Math.cos(al-be)+2*d*(sa-sb);if(p2>=0){const tmp=Math.atan2(cb-ca,d+sa-sb);out.push(['L',mod(-al+tmp),Math.sqrt(p2),'L',mod(be-tmp)])}}
    {const p2=2+d*d-2*Math.cos(al-be)+2*d*(sb-sa);if(p2>=0){const tmp=Math.atan2(ca-cb,d-sa+sb);out.push(['R',mod(al-tmp),Math.sqrt(p2),'R',mod(-be+tmp)])}}
    {const p2=-2+d*d+2*Math.cos(al-be)+2*d*(sa+sb);if(p2>=0){const q=Math.sqrt(p2),tmp=Math.atan2(-ca-cb,d+sa+sb)-Math.atan2(-2,q);out.push(['L',mod(-al+tmp),q,'R',mod(-be+tmp)])}}
    {const p2=d*d-2+2*Math.cos(al-be)-2*d*(sa+sb);if(p2>=0){const q=Math.sqrt(p2),tmp=Math.atan2(ca+cb,d-sa-sb)-Math.atan2(2,q);out.push(['R',mod(al-tmp),q,'L',mod(be-tmp)])}}
    return out.map(w=>({segs:[[w[0],w[1]*R],['S',w[2]*R],[w[3],w[4]*R]],len:(w[1]+w[2]+w[4])*R,R,p0,t0}))
  }
  // Pose along a planned path at arc length s -> [u(z), v(x), theta, turn(-1,0,1)].
  pathPose(P,s){
    let u=P.p0[0],v=P.p0[1],th=P.t0,turn=0;
    for(const [k,L] of P.segs){
      const l=Math.min(L,Math.max(0,s));s-=L;
      if(k==='S'){u+=Math.cos(th)*l;v+=Math.sin(th)*l;turn=0}
      else{const sg=k==='L'?1:-1,dth=sg*l/P.R;u+=P.R*sg*(Math.sin(th+dth)-Math.sin(th));v+=P.R*sg*(-Math.cos(th+dth)+Math.cos(th));th+=dth;turn=sg}
      if(s<=0)return[u,v,th,l>0||k==='S'?turn:0]
    }
    return[u+Math.cos(th)*s,v+Math.sin(th)*s,th,0]
  }
  planLeadIn(){
    const B=this.bunker,R=15,cz=B.wz+B.ctr,clear=B.rh+5,p0=[travel,shipX],t0=viewYaw;let best=null;
    for(const A of[30,42,58,80,110]){
      for(const P of this.dubins(p0,t0,[B.wz-A,B.x],0,R)){
        if(best&&P.len>=best.len)continue;
        let ok=true;for(let s=0;s<=P.len;s+=1.5){const q=this.pathPose(P,s);if(Math.hypot(q[1]-B.x,q[0]-cz)<clear){ok=false;break}}
        if(ok)best=P
      }
    }
    return best
  }
  leadInFly(dt){
    const L=this.leadIn;this.spd=lerp(this.spd,GA_SPEED_CRUISE*.85,1-Math.exp(-dt*1.6));
    L.s+=this.spd*dt;const q=this.pathPose(L.path,L.s),ox=shipX;
    travel=q[0];shipX=q[1];viewYaw=wrapAngle(q[2]);surfaceVX=(shipX-ox)/Math.max(dt,1e-4);surfaceDistance+=this.spd*dt;
    viewRoll=lerp(viewRoll,q[3]*-.42,clamp(dt*3,0,1));
    return clamp((this.alt-6.5)*.35,-.8,.8)
  }
  // The nav always marks the bunker itself (v50). The old approach gate 110 u out read
  // as 'miles from the bunker'; the lead-in autopilot now handles lining up.
  bunkerNavPoint(){const B=this.bunker;return{x:B.x,wz:B.wz,gate:false}}
  genCount(){const g=this.groups.filter(g=>g.genId);return{down:g.filter(x=>x.cleared).length,total:g.length}}
  domeCentre(d){return[d.x,GA_GROUND_Y+this.groundH(d.x,d.wz),d.wz]}
  shieldingDome(x,y,wz){for(const d of this.domes){if(d.up<.5)continue;const c=this.domeCentre(d);if(Math.hypot(x-c[0],y-c[1],wz-c[2])<d.r)return d}return null}
  shielded(u){return this.variant==='factory'&&!!this.shieldingDome(u.x,this.ug(u)+1,u.wz)}
  spawn(kind,x,wz,h,grp){
    const K=GA_KINDS[kind];
    const u={id:this.nextId++,groundUnit:true,kind,K,group:grp,x,wz,h,speed:0,s:K.s,y:GA_GROUND_Y+K.top*K.s*.5,z:wz-travel,
      hp:K.hp||0,hitFx:0,dead:false,dying:false,state:'alive',fireCD:1.5+Math.random()*2,volleyLeft:0,volleyT:0,muzzleI:0,
      phi:Math.random(),bob:0,tiltX:0,tiltZ:0,drop:0,turretYaw:0,collapseT:0,hitCD:0,wanderT:0,goalX:x,goalWZ:wz,aggro:false,
      knees:null,legs:null,mesh:null,poseSerial:-1};
    if(K.legs){
      u.legs=K.legs.map(L=>{const w=this.toWorld(u,L.foot[0],L.foot[2]);return{wx:w[0],wz:w[1],cx:w[0],cz:w[1],lift:0,swinging:false,fx:w[0],fz:w[1],broken:false}});
      if(K.heavy){u.knees=K.legs.map(()=>({hp:K.kneeHp,hitFx:0,broken:false}));u.hull=K.hullHp||24}
    }
    // Build topology once from the rest pose.
    const b=gaBuilder(true);this.emit(b,u);
    u.mesh={v:b.v,e:b.e,faces:b.faces};
    if(u.knees){
      const inRange=(r,e)=>e[0]>=r[0]&&e[0]<r[1]&&e[1]>=r[0]&&e[1]<r[1];
      u.kneeEdges=u.knees.map((_,i)=>{const r=b.marks['knee'+i];return b.e.map((e,ei)=>inRange(r,e)?ei:-1).filter(i=>i>=0)});
      u.kneeRanges=u.knees.map((_,i)=>b.marks['knee'+i]);
      u.mesh.edgeColors=new Array(b.e.length).fill(null)
    }
    this.units.push(u);return u
  }
  toWorld(u,lx,lz){const r=u.h+Math.PI,c=Math.cos(r),s=Math.sin(r),X=lx*u.s,Z=lz*u.s;return[u.x+c*X+s*Z,u.wz-s*X+c*Z]}
  toLocal(u,wx,wz){const r=u.h+Math.PI,c=Math.cos(r),s=Math.sin(r),dx=wx-u.x,dz=wz-u.wz;return[(c*dx-s*dz)/u.s,(s*dx+c*dz)/u.s]}
  // World-space (camera-relative z) point for a model-space point.
  worldPoint(u,p){const w=this.toWorld(u,p[0],p[2]);return[w[0],this.ug(u)+p[1]*u.s,w[1]-travel]}
  bodyTransform(u){
    const K=u.K,piv=K.pivotY||1,tX=u.tiltX+(u.slX||0),tZ=u.tiltZ+(u.slZ||0),cx=Math.cos(tX),sx=Math.sin(tX),cz=Math.cos(tZ),sz=Math.sin(tZ),dy=u.bob-u.drop;
    return p=>{let x=p[0],y=p[1]-piv,z=p[2];
      const y1=y*cx-z*sx,z1=y*sx+z*cx;y=y1;z=z1; // pitch about X
      const x2=x*cz-y*sz,y2=x*sz+y*cz;x=x2;y=y2;  // roll about Z
      return[x,y+piv+dy,z]}
  }
  // Emit every vertex of the unit's current pose (same order each call).
  emit(m,u){
    const K=u.K,B=this.bodyTransform(u);
    m.T=B;K.body(m);
    if(K.turret){const tz=K.turretZ||0,c=Math.cos(u.turretYaw),s=Math.sin(u.turretYaw);m.T=p=>{const x=p[0],z=p[2]-tz;return B([c*x+s*z,p[1],-s*x+c*z+tz])};K.turret(m)}
    m.T=null;
    if(K.legs){
      u.poseKnees=[];
      K.legs.forEach((L,i)=>{
        const hip=B(L.hip),st=u.legs[i],loc=this.toLocal(u,st.cx,st.cz),lift=st.lift+(this.hCache?(this.groundH(st.cx,st.cz)-(u.gh||0))/u.s:0);
        const foot=[loc[0],lift,loc[1]];
        const ankle=[loc[0]+L.ankleOff[0],lift+L.ankleH,loc[1]+L.ankleOff[1]];
        const knee=gaIK(hip,ankle,L.L1,L.L2,L.pole);
        u.poseKnees[i]=knee;
        gaLeg(m,{hip,knee,ankle,foot},L.t,i)
      })
    }
  }
  pose(u){
    if(u.poseSerial===sceneRenderSerial)return;
    // Distant walkers re-pose every third frame; at that size nobody can tell.
    if(u.poseSerial>=0&&(sceneRenderSerial+u.id)%3&&Math.hypot(u.x-shipX,u.wz-travel)>70)return;
    u.poseSerial=sceneRenderSerial;
    const b=gaBuilder(false);this.emit(b,u);
    const V=u.mesh.v;for(let i=0;i<V.length;i++){const a=V[i],q=b.v[i];a[0]=q[0];a[1]=q[1];a[2]=q[2]}
  }
  // ---------- terrain: dunes (Dave's pick from the landscape audition) ----------
  // The ground itself is the landscape: a heightfield of long dune crests drawn as
  // a hidden-line grid through the shared painter list, so a crest hides the
  // armour and trees behind it. Heights are cached per grid vertex and read back
  // bilinearly, so anything standing on the dunes sits exactly on the drawn grid.
  seedTerrain(){
    this.tSeed=[Math.random()*500,Math.random()*500,Math.random()*6.28];this.hCache=new Map();
    this.seedTrees()
  }
  gaNoise(x,z){const i=Math.floor(x),j=Math.floor(z),fx=x-i,fz=z-j,sx=fx*fx*(3-2*fx),sz=fz*fz*(3-2*fz);
    const H=(a,b)=>{let h=(a*374761393+b*668265263)|0;h=Math.imul(h^(h>>>13),1274126177);return((h^(h>>>16))>>>0)/4294967295};
    const a=H(i,j),b=H(i+1,j),c=H(i,j+1),d=H(i+1,j+1);return a+(b-a)*sx+(c-a)*sz+(a-b-c+d)*sx*sz}
  gaFbm(x,z,o){let s=0,amp=1,t=0;for(let k=0;k<o;k++){s+=this.gaNoise(x,z)*amp;t+=amp;amp*=.5;x*=2.03;z*=2.03}return s/t}
  rawDune(x,z){
    const S=this.tSeed,sm=(a,b,v)=>{const t=clamp((v-a)/(b-a),0,1);return t*t*(3-2*t)};
    const warp=this.gaFbm(x/70+S[0],z/70+S[1],3)*6,c=.5+.5*Math.sin((x*.8+z*.6)/11+warp+S[2]);
    let h=5*c*c*c+3*sm(.45,.85,this.gaFbm(x/120+S[1],z/120+S[0],2));
    // Flat pans at the start and at each group's heart; dunes come right up round them.
    let m=sm(22,48,Math.hypot(x,z));
    for(const g of this.groups)m=Math.min(m,sm(9,30,Math.hypot(x-g.cx,z-g.cwz)));
    for(const f of this.flats)m=Math.min(m,sm(f.r0,f.r1,Math.hypot(x-f.x,z-f.z)));
    return h*m
  }
  vertH(i,j){const k=i*65536+j;let h=this.hCache.get(k);if(h===undefined){h=this.rawDune(i*GA_CELL,j*GA_CELL);this.hCache.set(k,h)}return h}
  groundH(x,z){
    const fx=x/GA_CELL,fz=z/GA_CELL,i=Math.floor(fx),j=Math.floor(fz),tx=fx-i,tz=fz-j;
    const a=this.vertH(i,j),b=this.vertH(i+1,j),c=this.vertH(i,j+1),d=this.vertH(i+1,j+1);
    return a+(b-a)*tx+(c-a)*tz+(a-b-c+d)*tx*tz
  }
  ug(u){return GA_GROUND_Y+(u.gh||0)+(u.leapY||0)}
  // Factory moon (the OSD delivery look): orange asteroid-style boulders, half
  // buried, ringing each site as cover plus a few loose clumps in the troughs.
  seedBoulders(){
    this.trees=[];const mesh=asteroidMesh;let lo=1e9;for(const v of mesh.v)lo=Math.min(lo,v[1]);
    const add=(x,wz,s)=>{
      if(this.flats.some(f=>Math.hypot(x-f.x,wz-f.z)<f.r0+4)||Math.hypot(x,wz)<30)return;
      if(this.trees.some(t=>Math.hypot(x-t.x,wz-t.wz)<(t.r+s*1.6)))return;
      const mx=1.05+Math.random()*1.25,my=.45+Math.random()*.62,mz=.95+Math.random()*1.1,bury=.12+Math.random()*.18;
      this.trees.push({kind:'rock',mesh,x,wz,s,mx,my,mz,bury,base:lo,rot:[(Math.random()-.5)*.28,Math.random()*6.28,(Math.random()-.5)*.24],
        r:s*Math.max(mx,mz)*.85,top:s*my*(1-bury)*.9})
    };
    for(const g of this.groups){
      const n=g.guard?4:6+Math.floor(Math.random()*3),a0=Math.random()*6.28;
      for(let i=0;i<n;i++){const a=a0+i*6.28/n+(Math.random()-.5)*.5,d=20+Math.random()*10;add(g.cx+Math.sin(a)*d,g.cwz+Math.cos(a)*d,1.2+Math.random()*.9)}
    }
    for(let c=0,tries=0;c<16&&tries<300;tries++){
      const a=Math.random()*6.28,d=40+Math.random()*420,cx=Math.sin(a)*d,cz=240+Math.cos(a)*d*.9;
      if(this.rawDune(cx,cz)>1.8||this.groups.some(g=>Math.hypot(cx-g.cx,cz-g.cwz)<34))continue;c++;
      const n=2+Math.floor(Math.random()*3);for(let k=0;k<n;k++)add(cx+(Math.random()-.5)*12,cz+(Math.random()-.5)*12,1.0+Math.random()*.8)
    }
  }
  seedTrees(){
    if(this.variant==='factory'){this.seedBoulders();return}
    const reg=globalThis.AgentXForestScenery,ids=['pineTall','pineBroad','pineYoung','pineDeadSparse'];
    const meshFor=id=>{const base=reg?.get?.(id)||(typeof forestSceneryMesh==='function'?forestSceneryMesh(id):null);if(!base)return null;
      const mesh=typeof forestShortTrunkMesh==='function'?forestShortTrunkMesh(base,id):base;let lo=1e9,hi=-1e9;for(const v of base.v){lo=Math.min(lo,v[1]);hi=Math.max(hi,v[1])}return{mesh,base:lo,top:hi-lo}};
    const cache={};this.trees=[];
    // A few clumps in the dune troughs: cover and landmarks, not a forest.
    for(let c=0,tries=0;c<11&&tries<200;tries++){
      const a=Math.random()*6.28,d=40+Math.random()*250,cx=Math.sin(a)*d,cz=Math.cos(a)*d;
      if(this.rawDune(cx,cz)>1.6)continue;
      if(this.groups.some(g=>Math.hypot(cx-g.cx,cz-g.cwz)<22)||this.flats.some(f=>Math.hypot(cx-f.x,cz-f.z)<f.r1))continue;
      c++;
      const n=3+Math.floor(Math.random()*4);
      for(let k=0;k<n;k++){
        const id=ids[Math.floor(Math.random()*ids.length)],m=cache[id]||(cache[id]=meshFor(id));if(!m)continue;
        const x=cx+(Math.random()-.5)*11,z=cz+(Math.random()-.5)*11,s=.9+Math.random()*.35;
        this.trees.push({assetId:id,mesh:m.mesh,base:m.base,top:m.top*s,r:.7*s,x,wz:z,s,rot:[0,Math.random()*6.28,0]})
      }
    }
  }
  // Ground LOD: three levels (6, 12, 24-unit cells) out to the mountain horizon.
  // Each coarse cell is either drawn whole or replaced by its four children, so the
  // levels tile the ground exactly with no overlap (no depth-order fighting). Fine
  // vertices morph onto the coarser surface before the hand-over and the extra fine
  // lines fade out, so nothing pops or flickers as the boundary moves with you.
  lodDist(mul,i,j){const c=GA_CELL*mul;return Math.hypot((i+.5)*c-shipX,(j+.5)*c-travel)}
  lodDrawn(level,i,j){
    if(level===0)return this.lodDist(2,i>>1,j>>1)<GA_LOD1;
    if(level===1)return this.lodDist(2,i,j)>=GA_LOD1&&this.lodDist(4,i>>1,j>>1)<GA_LOD2;
    const d=this.lodDist(4,i,j);return d>=GA_LOD2&&d<GA_HORIZON
  }
  appendGround(scene){
    // Morph windows end where every vertex that can touch the coarser level is fully
    // morphed; the in-between lines only fade over the short last stretch, where
    // the grid is already dim, so there is no band of alternating bright/dim lines.
    this.appendGroundLevel(scene,0,1,0,GA_LOD1+GA_CELL*2,GA_LOD1-55,GA_LOD1-GA_CELL*1.5-1,GA_LOD1-35);
    this.appendGroundLevel(scene,1,2,GA_LOD1-GA_CELL*2,GA_LOD2+GA_CELL*4,GA_LOD2-60,GA_LOD2-GA_CELL*3-1,GA_LOD2-45);
    this.appendGroundLevel(scene,2,4,GA_LOD2-GA_CELL*4,GA_HORIZON+GA_CELL*4,1e9,1e9+1,1e9)
  }
  appendGroundLevel(scene,level,mul,rMin,rMax,m0,m1,f0){
    const CELL=GA_CELL*mul,NEAR=.25,gcol=this.groundCol||C.gd;
    const x0=Math.floor((shipX-rMax)/CELL),x1=Math.ceil((shipX+rMax)/CELL),z0=Math.floor((travel-rMax)/CELL),z1=Math.ceil((travel+rMax)/CELL),nx=x1-x0+2;
    const Q=new Array(nx*(z1-z0+2)),T=new Array(Q.length),FD=new Array(Q.length);
    const H=(i,j)=>this.vertH(i*mul,j*mul);
    const vq=(i,j)=>{const k=(j-z0)*nx+(i-x0);if(Q[k])return Q[k];
      const wx=i*CELL,wz=j*CELL,dv=Math.hypot(wx-shipX,wz-travel),t=clamp((dv-m0)/(m1-m0),0,1);let h=H(i,j);
      // The last stretch before the mountains settles flat, so the ground's far edge
      // lies on the horizon base and can't ripple as cells step in and out.
      if(level===2)h*=1-clamp((dv-GA_HORIZON+72)/56,0,1);
      if(t>0){const oi=i&1,oj=j&1;let hc=h;
        if(oi&&oj)hc=(H(i-1,j-1)+H(i+1,j-1)+H(i-1,j+1)+H(i+1,j+1))/4;else if(oi)hc=(H(i-1,j)+H(i+1,j))/2;else if(oj)hc=(H(i,j-1)+H(i,j+1))/2;
        h=lerp(h,hc,t)}
      T[k]=t;FD[k]=clamp((dv-f0)/Math.max(1,m1-f0),0,1);return Q[k]=camPoint([wx,GA_GROUND_Y+h,wz-travel])};
    const tAt=(i,j)=>{vq(i,j);return FD[(j-z0)*nx+(i-x0)]};
    const clipPoly=pts=>{const out=[];for(let n=0;n<pts.length;n++){const A=pts[n],B=pts[(n+1)%pts.length],ia=A[2]>=NEAR,ib=B[2]>=NEAR;
        if(ia)out.push(A);if(ia!==ib){const t=(NEAR-A[2])/(B[2]-A[2]);out.push([A[0]+(B[0]-A[0])*t,A[1]+(B[1]-A[1])*t,NEAR])}}return out};
    const seg=(A,B,al)=>{if(al<=.01||(A[2]<NEAR&&B[2]<NEAR))return;let a=A,b=B;
        if(a[2]<NEAR){const t=(NEAR-a[2])/(b[2]-a[2]);a=[a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t,NEAR]}
        if(b[2]<NEAR){const t=(NEAR-b[2])/(a[2]-b[2]);b=[b[0]+(a[0]-b[0])*t,b[1]+(a[1]-b[1])*t,NEAR]}
        const pa=projectCam(a),pb=projectCam(b);if(pa&&pb)line(pa.x,pa.y,pb.x,pb.y,gcol,.8,al)};
    const alphaAt=d=>d<120?lerp(.85,.6,d/120):lerp(.6,.22,clamp((d-120)/(GA_HORIZON-160),0,1))*(1-clamp((d-GA_HORIZON+70)/50,0,1));
    for(let j=z0;j<z1;j++)for(let i=x0;i<x1;i++){
      if(!this.lodDrawn(level,i,j))continue;
      const cx=(i+.5)*CELL,cz=(j+.5)*CELL,dist=Math.hypot(cx-shipX,cz-travel);
      const qc=camPoint([cx,GA_GROUND_Y,cz-travel]);if(qc[2]<-CELL||Math.abs(qc[0])>qc[2]*1.05+CELL*1.5)continue;
      const a=vq(i,j),b=vq(i+1,j),c=vq(i+1,j+1),d=vq(i,j+1);
      if(a[2]<NEAR&&b[2]<NEAR&&c[2]<NEAR&&d[2]<NEAR)continue;
      const zc=(a[2]+b[2]+c[2]+d[2])/4,al=alphaAt(dist);
      // Lines that won't exist on the coarser level fade out as their vertices morph.
      const fadeJ=(j&1)&&level<2?1-tAt(i,j):1,fadeI=(i&1)&&level<2?1-tAt(i,j):1;
      // Every cell strokes only its near and left edges. Where levels meet, the
      // neighbouring cell's own edge already covers the shared line, so nothing is
      // drawn twice (doubled lines read as brighter bands sliding with you).
      scene.push({z:Math.max(.19,zc+CELL*.5),draw:()=>{
        const poly=clipPoly([a,b,c,d]).map(q=>projectCam(q)).filter(Boolean);if(poly.length>2)fillScreenPoly(poly.map(p=>[p.x,p.y]));
        // Anti-moire: when parallel grid lines crowd to a few pixels apart in the
        // distance, fade them rather than letting them beat into shimmering bands.
        let crowdAB=1,crowdAD=1;
        if(a[2]>=NEAR&&b[2]>=NEAR&&d[2]>=NEAR){const pa=projectCam(a),pb=projectCam(b),pd=projectCam(d);
          if(pa&&pb&&pd){crowdAB=clamp((Math.hypot(pd.x-pa.x,pd.y-pa.y)-2.5)/7,0,1);crowdAD=clamp((Math.hypot(pb.x-pa.x,pb.y-pa.y)-2.5)/7,0,1)}}
        seg(a,b,al*fadeJ*crowdAB);seg(a,d,al*fadeI*crowdAD)}})
    }
  }
  appendTrees(scene){
    for(const t of this.trees){
      const dist=Math.hypot(t.x-shipX,t.wz-travel);if(dist>GA_UNIT_SIGHT)continue;
      const gy=GA_GROUND_Y+this.groundH(t.x,t.wz),q=camPoint([t.x,gy+t.top*.4,t.wz-travel]);if(q[2]<.3-t.r||Math.abs(q[0])>Math.max(0,q[2])*1.1+Math.max(t.top,t.r))continue;
      const haze=clamp((GA_UNIT_SIGHT-dist)/40,0,1);
      if(t.kind==='rock'){
        const y=gy-(t.base+t.bury)*t.s*t.my;
        scene.push({z:Math.max(.2,q[2]),draw:()=>drawMesh({type:'duneRock',x:t.x,y,z:t.wz-travel,s:t.s,mx:t.mx,my:t.my,mz:t.mz,rot:t.rot,fadeZ:Math.max(0,q[2])*.7},t.mesh,C.o,clamp(1.02-q[2]/220,.28,.84)*haze)});
        continue
      }
      const y=gy-t.base*t.s-.12;
      scene.push({z:q[2],draw:()=>drawLayeredForestTree({type:'duneTree',assetId:t.assetId,x:t.x,y,z:t.wz-travel,s:t.s,rot:t.rot,fadeZ:q[2]*.7},t.mesh,t.assetId,.88*haze)})
    }
  }
  // ---------- player flight: terrain-following climb ----------
  updateLeadInSteering(dt){
    const m=this.leadInFly(dt);
    surfaceVY=moveToward(surfaceVY,-m*7.0,dt*16);this.alt=clamp(this.alt+surfaceVY*dt,.6,GA_CEILING);
    viewPitch=lerp(viewPitch,clamp((this.alt-3)*.018,0,.19),clamp(dt*4,0,1));
    const fx=Math.sin(viewYaw),fz=Math.cos(viewYaw),g0=this.groundH(shipX,travel),under=Math.max(g0,this.groundH(shipX+fx*5,travel+fz*5),this.groundH(shipX+fx*10,travel+fz*10)*.9);
    shipY=lerp(shipY,GA_GROUND_Y+under+this.alt,1-Math.exp(-dt*5));shipY=Math.max(shipY,GA_GROUND_Y+g0+.45);this.strafing=false
  }
  updateSteering(dt,magX,magY){
    if(this.leadIn&&mode==='play')return this.updateLeadInSteering(dt);
    viewYaw=wrapAngle(viewYaw+magX*dt*1.34);
    const m=Math.abs(magY)<.08?0:magY;
    // Hold up to climb, down to descend; let go and the drone holds its height
    // above the dunes. The view tips down a little with height.
    surfaceVY=moveToward(surfaceVY,-m*7.0,dt*16);this.alt=clamp(this.alt+surfaceVY*dt,.6,GA_CEILING);
    if(this.alt<=.6||this.alt>=GA_CEILING)surfaceVY=0;
    const look=clamp((this.alt-3)*.018,0,.19);
    viewPitch=lerp(viewPitch,magY*.30+look,clamp(dt*4.0,0,1));
    viewRoll=lerp(viewRoll,-magX*.48,clamp(dt*4.6,0,1));
    const fx=Math.sin(viewYaw),fz=Math.cos(viewYaw);
    // Strafing: any live armour within attack range, inside the nose cone and in
    // line of sight. Armour hidden behind a crest never slows you (no free scanner).
    let strafe=false;
    for(const u of this.units){
      if(u.state!=='alive')continue;const d=this.planarToShip(u);if(d>GA_ATTACK_RANGE)continue;
      if(Math.abs(wrapAngle(Math.atan2(u.x-shipX,u.wz-travel)-viewYaw))>GA_ATTACK_CONE)continue;
      if(!this.canSee(u,[u.x,this.ug(u)+u.K.top*u.s*.5,u.wz-travel]))continue;
      strafe=true;break
    }
    this.strafing=strafe;
    const want=strafe?GA_SPEED_ATTACK:GA_SPEED_CRUISE;
    // Brake a little quicker than we accelerate, so the run starts inside range.
    this.spd=lerp(this.spd,want,1-Math.exp(-dt*(strafe?2.6:1.6)));
    const sp=this.spd;
    surfaceVX=fx*sp;shipX+=fx*sp*dt;travel+=fz*sp*dt;surfaceDistance+=sp*dt;
    // Look ahead so the drone lifts before a crest rather than ploughing into it.
    const g0=this.groundH(shipX,travel),under=Math.max(g0,this.groundH(shipX+fx*5,travel+fz*5),this.groundH(shipX+fx*10,travel+fz*10)*.9);
    shipY=lerp(shipY,GA_GROUND_Y+under+this.alt,1-Math.exp(-dt*5));
    shipY=Math.max(shipY,GA_GROUND_Y+g0+.45);
    // Shield domes are solid: you are shoved back off the surface.
    for(const d of this.domes){
      if(d.up<.5)continue;const c=this.domeCentre(d),dx=shipX-c[0],dy=shipY-c[1],dz=travel-c[2],dd=Math.hypot(dx,dy,dz);
      if(dd<d.r+.6){const k=(d.r+.7)/Math.max(dd,.01);shipX=c[0]+dx*k;travel=c[2]+dz*k;shipY=Math.max(shipY,c[1]+dy*k);d.hitT=.25;
        if(this.terrainCD<=0){damage('SHIELD');this.terrainCD=1.0}}
    }
    // The bunker fortress itself is solid (the dome used to keep you off it).
    if(this.bunker&&this.bunkerUnlocked&&mode==='play'){
      const B=this.bunker,cz=B.wz+B.ctr,dx=shipX-B.x,dz=travel-cz,d=Math.hypot(dx,dz);
      if(d<B.rh&&shipY-GA_GROUND_Y<B.hy){const k=(B.rh+.4)/Math.max(d,.01);shipX=B.x+dx*k;travel=cz+dz*k;if(this.terrainCD<=0){damage('BUNKER');this.terrainCD=1.0}}
    }
    // Trees are solid.
    const a=shipY-GA_GROUND_Y;
    for(const t of this.trees){
      if(Math.abs(t.x-shipX)>4||Math.abs(t.wz-travel)>4)continue;
      if(Math.hypot(t.x-shipX,t.wz-travel)<(t.kind==='rock'?t.r:.8*t.s)&&a<this.groundH(t.x,t.wz)+t.top*.92&&this.terrainCD<=0){damage(t.kind==='rock'?'ROCK':'TREE');this.terrainCD=1.0}
    }
  }
  drawAltitude(){
    const x=W-30,y0=viewH*.64,y1=viewH*.30,ay=a=>lerp(y0,y1,a/GA_CEILING),alt=clamp(this.alt,0,GA_CEILING);
    line(x,y0,x,y1,C.g,1,.8);
    for(let a=0;a<=GA_CEILING;a+=2)line(x-4,ay(a),x,ay(a),C.g,1,.75);
    const y=ay(alt);line(x-12,y-5,x-4,y,C.c,1.2,.95);line(x-12,y+5,x-4,y,C.c,1.2,.95);line(x-12,y-5,x-12,y+5,C.c,1.2,.95);
    ctx.font='400 8px Consolas,monospace';ctx.textAlign='center';ctx.strokeStyle=C.g;ctx.strokeText('ALT',x,y1-14);
    ctx.textAlign='left'
  }
  // ---------- update ----------
  planarToShip(u){return Math.hypot(u.x-shipX,u.wz-travel)}
  update(dt){
    if(!this.active)return;
    this.t+=dt;this.navPulse+=dt;this.armourHintT=Math.max(0,this.armourHintT-dt);this.shieldHintT=Math.max(0,this.shieldHintT-dt);this.arcWarn=0;this.pounceWarn=0;this.terrainCD=Math.max(0,this.terrainCD-dt);
    // Lobbed shells live in the world: keep them fixed as the drone travels, and
    // burst on the dunes if they miss.
    const dTravel=travel-this.lastTravel;this.lastTravel=travel;
    for(const b of bolts){
      if(!b.gaShell||b.dead)continue;b.z-=dTravel;
      const gy=GA_GROUND_Y+this.groundH(b.x,b.z+travel);
      if(b.y<gy+.05&&b.vy<0){b.dead=true;const p=proj([b.x,gy,b.z]);if(p)spark(p.x,p.y,C.o,10)}
    }

    for(const u of this.units){
      if(u.dead)continue;
      u.z=u.wz-travel;u.hitFx=Math.max(0,u.hitFx-dt);u.hitCD=Math.max(0,u.hitCD-dt);
      if(u.knees)for(const k of u.knees)k.hitFx=Math.max(0,k.hitFx-dt);
      if(u.state==='collapsing'){this.updateCollapse(u,dt);continue}
      if(u.state==='wreck')continue;
      if(u.K.static){this.collide(u);continue}
      // EMP stalls armour exactly as it stalls fighters: no drive, no guns.
      if(u.stunT>0){if(u.leap){u.leap=null;u.leapY=0;u.drop=0}u.stunT-=dt;u.speed=moveToward(u.speed,0,dt*4);u.volleyLeft=0;this.move(u,dt);this.gait(u,dt);this.collide(u);continue}
      if(u.kind==='hound'&&this.updateLeap(u,dt))continue;
      this.think(u,dt);this.move(u,dt);this.gait(u,dt);this.fire(u,dt);this.collide(u);
      if(u.K.tesla)this.updateTesla(u,dt)
    }
    this.updateLock(dt);
    for(const g of this.groups){
      if(g.cleared)continue;
      const gone=id=>{const u=this.units.find(x=>x.id===id);return!u||u.state!=='alive'};
      if(g.genId?gone(g.genId):g.ids.every(gone)){
        g.cleared=true;score+=1000;
        if(g.genId){const c=this.genCount();say(`GENERATOR DOWN · ${c.down}/${c.total}`,.9)}else say(`NAV ${g.name} CLEAR`,.9);
        SoundFX.objectiveComplete?.()
      }
    }
    if(this.variant==='factory'){this.updateFactory(dt);if(mode!=='play')return}
    else if(this.state==='hunt'&&this.groups.every(g=>g.cleared)){this.state='clear';this.clearT=0;say('DUNES CLEAR',1.2)}
    if(this.state==='clear'){
      this.clearT+=dt;
      if(this.clearT>2.6&&mode==='play'){this.state='departing';this.devExitPending=true;beginSurfaceExit({scene:'dunes'})}
    }
    // Keep collapsed hulks tidy: drop anything far behind the play area.
    for(const u of this.units)if(u.state==='gone')u.dead=true;
  }
  think(u,dt){
    const K=u.K,d=this.planarToShip(u),g=u.group,hound=u.kind==='hound';
    u.aggro=d<(K.shells?165:(K.heavy?110:(hound?120:95)));
    let tx,tz;
    const fx=Math.sin(viewYaw),fz=Math.cos(viewYaw);
    if(u.aggro){
      const ang=Math.atan2(shipX-u.x,travel-u.wz);
      if(hound){
        // Pack hunter: run to cut the player off ahead, then break across the nose
        // and come round again. They are slower than the drone in a straight line
        // but corner far tighter, so turning your back on them costs you.
        const ahead=d>26?18:6;tx=shipX+fx*ahead;tz=travel+fz*ahead;
        if(d<9){const side=(u.id%2?1:-1);tx=u.x+Math.sin(ang+side*1.9)*14;tz=u.wz+Math.cos(ang+side*1.9)*14}
      }else{
        const stand=K.heavy?30:(K.tank?26:18);
        if(d>stand){tx=shipX;tz=travel}else{const side=(u.id%2?1:-1);tx=u.x+Math.sin(ang+side*1.6)*10;tz=u.wz+Math.cos(ang+side*1.6)*10}
      }
      // Stay roughly on station: the nav area remains the fight's centre.
      const home=Math.hypot(tx-g.cx,tz-g.cwz),leash=u.leash||(hound?170:55);
      if(home>leash){const s=leash/home;tx=g.cx+(tx-g.cx)*s;tz=g.cwz+(tz-g.cwz)*s}
    }else{
      u.wanderT-=dt;
      if(u.wanderT<=0||Math.hypot(u.goalX-u.x,u.goalWZ-u.wz)<3){const a=Math.random()*Math.PI*2,r=(u.minWander||0)+Math.random()*((u.wanderR||18)-(u.minWander||0));u.goalX=g.cx+Math.sin(a)*r;u.goalWZ=g.cwz+Math.cos(a)*r;u.wanderT=6+Math.random()*8}
      tx=u.goalX;tz=u.goalWZ
    }
    const want=Math.atan2(tx-u.x,tz-u.wz),dist=Math.hypot(tx-u.x,tz-u.wz);
    const diff=wrapAngle(want-u.h),turn=K.turn*(u.aggro?1:.6);
    u.h=wrapAngle(u.h+clamp(diff,-turn*dt,turn*dt));
    let sp=K.speed*(u.aggro?1:(hound?.22:.55))*(Math.abs(diff)>1.2?(hound?.55:.35):1)*(dist<2.5?0:1);
    if(u.knees){const broken=u.knees.filter(k=>k.broken).length;if(broken)sp*=.35}
    u.speed=moveToward(u.speed,sp,dt*(K.heavy?.8:(hound?9:3.5)));
    // Tank turrets track the player independently of the hull.
    if(K.turret){const loc=this.toLocal(u,shipX,travel),desired=Math.atan2(-loc[0],-loc[1]);u.turretYaw+=clamp(wrapAngle(desired-u.turretYaw),-dt*1.4,dt*1.4)}
  }
  move(u,dt){
    u.x+=Math.sin(u.h)*u.speed*dt;u.wz+=Math.cos(u.h)*u.speed*dt;
    // Separation so a group never interpenetrates.
    for(const o of this.units){
      if(o===u||o.dead||o.state!=='alive')continue;
      const dx=u.x-o.x,dz=u.wz-o.wz,d=Math.hypot(dx,dz),min=(u.K.radius*u.s+o.K.radius*o.s)*.9;
      if(d<min&&d>1e-3){const push=(min-d)*.5*(o.K.heavy&&!u.K.heavy?1.6:1);u.x+=dx/d*push*Math.min(1,dt*6);u.wz+=dz/d*push*Math.min(1,dt*6)}
    }
    // Trees are solid for armour: slide round the trunks.
    for(const t of this.trees){const dx=u.x-t.x,dz=u.wz-t.wz,d=Math.hypot(dx,dz),min=(t.r||.7*t.s)+u.K.radius*u.s*.6;if(d<min&&d>1e-3){u.x=t.x+dx/d*min;u.wz=t.wz+dz/d*min}}
    u.z=u.wz-travel;
    this.seat(u,dt);
    if(u.K.hover)u.bob=Math.sin(this.t*2.1+u.id)*.08;
  }
  // Stand a unit on the dunes. Tanks lie on the slope; walkers keep their hull
  // nearly level and let each foot find the ground.
  seat(u,dt,snap=false){
    const K=u.K,r=Math.max(1,K.radius*u.s*.8),fx=Math.sin(u.h),fz=Math.cos(u.h),rx=Math.cos(u.h),rz=-Math.sin(u.h);
    let gh=this.groundH(u.x,u.wz);
    if(K.legs){let s=gh,n=1;for(const L of K.legs){const w=this.toWorld(u,L.foot[0],L.foot[2]);s+=this.groundH(w[0],w[1]);n++}gh=s/n}
    const dF=(this.groundH(u.x+fx*r,u.wz+fz*r)-this.groundH(u.x-fx*r,u.wz-fz*r))/(2*r);
    const dR=(this.groundH(u.x+rx*r,u.wz+rz*r)-this.groundH(u.x-rx*r,u.wz-rz*r))/(2*r);
    const k=K.legs?.3:1,slX=Math.atan(dF)*k,slZ=Math.atan(dR)*k,t=snap?1:1-Math.exp(-dt*(K.hover?4:8));
    u.gh=snap?gh:lerp(u.gh??gh,gh,t);u.slX=lerp(u.slX||0,slX,t);u.slZ=lerp(u.slZ||0,slZ,t)
  }
  updateFactory(dt){
    if(this.bunker&&!bunkerDoorOpen){bunkerDoorOpen=true;bunkerDoorHp=0} // no door at all (Dave)
    for(const d of this.domes){
      d.hitT=Math.max(0,d.hitT-dt);
      const powered=d.bunker?!this.bunkerUnlocked:!!this.units.find(u=>u.id===d.teslaId&&u.state==='alive');
      if(!powered&&d.up>0){if(d.up===1&&!d.bunker)say('SHIELD DOWN',.8);d.up=Math.max(0,d.up-dt/1.2)}
    }
    const c=this.genCount();
    if(!this.bunkerUnlocked&&c.down>=c.total){
      this.bunkerUnlocked=true;bunkerDoorHp=Math.max(5,BUNKER_DOOR_BASE_HP-10);
      say('BUNKER SHIELD DOWN · HEAD FOR BUNKER',1.3);audio.playVoice?.('bunkerShieldWeakened',{once:true,priority:true})
    }
    if(this.bunkerUnlocked&&mode==='play'){
      // Same hand-over as the reactor template: close, in front of the door, lined up.
      const B=this.bunker,dist=Math.hypot(B.x-shipX,B.wz-travel),bz=entryBunkerZ(),q=camPoint([B.x,-2.2,bz]),bp=q[2]>.18?projectCam(q):null;
      const lined=bp&&bp.x>W*.18&&bp.x<W*.82&&bp.y>viewH*.12&&bp.y<viewH*.88;
      // The entry autopilot is built for a run-in from in front of the door. Only hand
      // over inside that approach cone and roughly facing the door; otherwise the nav
      // leads to the approach gate first (a side-on hand-over flew into the wall).
      if(dist<148&&q[2]>12&&lined&&this.inBunkerCone()){this.leadIn=null;this.devExitPending=true;beginTrenchEntry();return}
      if(!this.leadIn&&Math.hypot(B.x-shipX,B.wz+B.ctr-travel)<80){const path=this.planLeadIn();if(path){this.leadIn={path,s:0};say('AUTOPILOT · BUNKER APPROACH',1.4)}}
    }
  }
  // Hound pounce (Dave: dogs leap up and melee). Telegraphed: the hound must be on
  // screen and facing you, it stops dead, squats and flashes white for 0.55 s, then
  // springs at where you will be. Shoot it (one hit kills in the air), climb out of
  // reach (above ~6.5) or break sideways. One pounce at a time.
  updateLeap(u,dt){
    const g=-30,L=u.leap,K=u.K,bearing=Math.atan2(shipX-u.x,travel-u.wz);
    u.leapCD=Math.max(0,(u.leapCD??(2+Math.random()*2))-dt);
    if(!L){
      if(u.leapCD>0||mode!=='play'||!u.aggro)return false;
      if(this.units.some(o=>o!==u&&o.leap&&o.state==='alive'))return false;
      const d=this.planarToShip(u),alt=shipY-this.ug(u);
      if(d<6||d>18||alt>6.5||Math.abs(wrapAngle(bearing-u.h))>.7)return false;
      const c=[u.x,this.ug(u)+1.2*u.s,u.z],q=camPoint(c);if(q[2]<5)return false;
      const sp=projectCam(q);if(!sp||sp.x<W*.06||sp.x>W*.94||sp.y<viewH*.06||sp.y>viewH*.94)return false;
      if(!this.canSee(u,c))return false;
      u.leap={phase:'crouch',t:0};SoundFX.terminalRed?.();return true
    }
    L.t+=dt;u.z=u.wz-travel;
    if(L.phase==='crouch'){
      this.pounceWarn=1;
      u.speed=moveToward(u.speed,0,dt*30);u.x+=Math.sin(u.h)*u.speed*dt;u.wz+=Math.cos(u.h)*u.speed*dt;u.z=u.wz-travel;
      u.h=wrapAngle(u.h+clamp(wrapAngle(bearing-u.h),-3*dt,3*dt));
      u.drop=.45*ease(clamp(L.t/.3,0,1));u.tiltX=lerp(u.tiltX||0,-.12,1-Math.exp(-dt*8));
      this.seat(u,dt);this.gait(u,dt);
      if(L.t>=.55){
        // Spring at the drone's predicted position; the body centre aims just under it.
        const TA=.62,fx=Math.sin(viewYaw),fz=Math.cos(viewYaw),px=shipX+fx*this.spd*TA,pz=travel+fz*this.spd*TA;
        const y0=this.ug(u),yT=shipY-1.9*u.s-.2;
        Object.assign(L,{phase:'air',t:0,y:y0,vx:(px-u.x)/TA,vz:(pz-u.wz)/TA,vy:(yT-y0-.5*g*TA*TA)/TA});
        u.h=Math.atan2(px-u.x,pz-u.wz);u.speed=0;
        const p=proj([u.x,y0,u.z]);if(p)spark(p.x,p.y,C.o,10)
      }
      return true
    }
    if(L.phase==='air'){
      this.pounceWarn=1;
      u.x+=L.vx*dt;u.wz+=L.vz*dt;L.vy+=g*dt;L.y+=L.vy*dt;u.z=u.wz-travel;
      u.gh=this.groundH(u.x,u.wz);u.leapY=L.y-(GA_GROUND_Y+u.gh);
      u.drop=lerp(u.drop||0,0,1-Math.exp(-dt*10));u.tiltX=clamp(-L.vy*.035,-.45,.45);u.slX=0;u.slZ=0;
      // Legs tuck under the body in flight.
      K.legs.forEach((Lg,i)=>{const st=u.legs[i],r=this.toWorld(u,Lg.foot[0],Lg.foot[2]);st.wx=st.cx=r[0];st.wz=st.cz=r[1];st.lift=.45;st.swinging=false});
      if(!L.bit){
        const cy=this.ug(u)+1.9*u.s,dd=Math.hypot(u.x-shipX,cy-shipY,u.wz-travel);
        if(dd<2.0){L.bit=true;damage('HOUND BITE');shake=Math.max(shake||0,5);L.vx*=-.25;L.vz*=-.25;L.vy=Math.min(L.vy,2)}
      }
      if(L.vy<0&&u.leapY<=0){
        u.leapY=0;L.phase='land';L.t=0;u.drop=.35;
        K.legs.forEach((Lg,i)=>{u.legs[i].lift=0});
        const p=proj([u.x,this.ug(u),u.z]);if(p)spark(p.x,p.y,C.o,8)
      }
      return true
    }
    // Landing: absorb, then back to the hunt.
    u.drop=lerp(u.drop,0,1-Math.exp(-dt*6));u.tiltX=lerp(u.tiltX,0,1-Math.exp(-dt*6));this.seat(u,dt);this.gait(u,dt);
    if(L.t>.5){u.leap=null;u.drop=0;u.leapCD=3.5+Math.random()*2.5}
    return true
  }
  // Tesla Strider: close in and it charges (visible crackle, ~0.85 s), then strikes.
  updateTesla(u,dt){
    u.strikeCD=Math.max(0,(u.strikeCD||0)-dt);u.strikeT=Math.max(0,(u.strikeT||0)-dt);
    const top=this.worldPoint(u,this.bodyTransform(u)(u.K.coilTop)),d=Math.hypot(top[0]-shipX,top[1]-shipY,top[2]);
    const armed=d<GA_TESLA_RANGE&&u.strikeCD<=0&&this.canSee(u,top);
    u.charge=armed?(u.charge||0)+dt:Math.max(0,(u.charge||0)-dt*2);
    if(u.charge>0)this.arcWarn=Math.max(this.arcWarn,u.charge/GA_TESLA_CHARGE);
    if(u.charge>=GA_TESLA_CHARGE){u.charge=0;u.strikeCD=1.6;u.strikeT=.3;damage('LIGHTNING');shake=Math.max(shake||0,4)}
  }
  // Blend a kind's gait table by current speed (smoothed so gait changes never snap).
  gaitParams(u,dt){
    const K=u.K;
    if(!K.gaits)return K;
    const v=u.speed,G=K.gaits;let a=G[0],b=G[0],t=0;
    for(let i=0;i<G.length-1;i++){if(v>=G[i].v){a=G[i];b=G[i+1];t=clamp((v-G[i].v)/(G[i+1].v-G[i].v),0,1)}}
    if(v>=G[G.length-1].v){a=b=G[G.length-1];t=0}
    t=ease(t);
    const want={offsets:a.offsets.map((o,i)=>lerp(o,b.offsets[i],t)),swing:lerp(a.swing,b.swing,t),lift:lerp(a.lift,b.lift,t),bobAmp:lerp(a.bobAmp,b.bobAmp,t),pitchAmp:lerp(a.pitchAmp,b.pitchAmp,t),bobK:t<.5?a.bobK:b.bobK};
    if(!u.gp)u.gp=JSON.parse(JSON.stringify(want));
    const k=1-Math.exp(-dt*3.2),g=u.gp;
    g.offsets=g.offsets.map((o,i)=>lerp(o,want.offsets[i],k));g.swing=lerp(g.swing,want.swing,k);g.lift=lerp(g.lift,want.lift,k);
    g.bobAmp=lerp(g.bobAmp,want.bobAmp,k);g.pitchAmp=lerp(g.pitchAmp,want.pitchAmp,k);g.bobK=want.bobK;
    return g
  }
  gait(u,dt){
    const K=u.K;if(!K.legs)return;
    const P=this.gaitParams(u,dt),swingFrac=P.swing;
    const speedModel=u.speed/u.s,moving=speedModel>.05;
    // Stride is set by leg reach: a planted foot may travel at most `reach`
    // under the body during stance, so faster means a quicker cycle, never skating.
    const stanceT=moving?K.reach/speedModel:1;
    const cycleT=moving?clamp(stanceT/(1-swingFrac),K.minCycle||.4,K.maxCycle||3.4):1.2;
    let settle=false;
    if(!moving){K.legs.forEach((L,i)=>{const st=u.legs[i],r=this.toWorld(u,L.foot[0],L.foot[2]);if(!st.broken&&Math.hypot(st.wx-r[0],st.wz-r[1])>.45*u.s)settle=true})}
    const anySwing=u.legs.some(l=>l.swinging);
    if(moving||settle||anySwing)u.phi=(u.phi+dt/cycleT)%1;
    const vx=Math.sin(u.h)*u.speed,vz=Math.cos(u.h)*u.speed,lead=cycleT*(1-swingFrac)*.5;
    K.legs.forEach((L,i)=>{
      const st=u.legs[i],rest=this.toWorld(u,L.foot[0],L.foot[2]);
      if(st.broken){ // dragged, never lifted
        st.wx=lerp(st.wx,rest[0],1-Math.exp(-dt*2));st.wz=lerp(st.wz,rest[1],1-Math.exp(-dt*2));st.cx=st.wx;st.cz=st.wz;st.lift=0;st.swinging=false;return
      }
      const p=((u.phi+P.offsets[i])%1+1)%1,swing=(moving||settle||st.swinging)&&p<swingFrac;
      if(swing){
        if(!st.swinging){st.swinging=true;st.fx=st.wx;st.fz=st.wz}
        const s=p/swingFrac,e=ease(s),tx=rest[0]+vx*lead,tz=rest[1]+vz*lead;
        st.cx=lerp(st.fx,tx,e);st.cz=lerp(st.fz,tz,e);st.lift=P.lift*Math.sin(Math.PI*s)
      }else{
        if(st.swinging){st.swinging=false;st.wx=st.cx;st.wz=st.cz;if(K.heavy&&this.planarToShip(u)<60)shake=Math.max(shake||0,1.2)}
        st.cx=st.wx;st.cz=st.wz;st.lift=0
      }
    });
    const bobK=P.bobK||K.legs.length;
    u.bob=moving?Math.sin(u.phi*Math.PI*2*bobK)*P.bobAmp:0;
    if(P.pitchAmp&&!u.knees)u.tiltX=moving?Math.sin((u.phi+.25)*Math.PI*2)*P.pitchAmp:lerp(u.tiltX,0,1-Math.exp(-dt*4));
    // A broken knee drops that corner of the hull.
    if(u.knees){
      let tx=0,tz=0;K.legs.forEach((L,i)=>{if(u.legs[i].broken){const r=Math.hypot(L.hip[0],L.hip[2])||1;tz+=L.hip[0]/r*.16;tx+=-L.hip[2]/r*.16}});
      u.tiltZ=lerp(u.tiltZ,-tz,1-Math.exp(-dt*2.5));u.tiltX=lerp(u.tiltX,tx,1-Math.exp(-dt*2.5))
    }
  }
  // Knees are armoured plates until the leg lifts, or while the guns vent after a volley.
  // Knees are always open (Dave: no switching). Hull hits chip the hull as well.
  kneeOpen(u,i){return !!(u.knees&&!u.knees[i].broken)}
  canSee(u,muzzle){
    // Line of sight from a gun to the drone; a dune crest in between blocks it.
    const ax=muzzle[0],ay=muzzle[1],az=muzzle[2]+travel;
    for(let k=1;k<12;k++){const t=k/12,x=lerp(ax,shipX,t),z=lerp(az,travel,t);if(GA_GROUND_Y+this.groundH(x,z)>lerp(ay,shipY,t)+.2)return false}
    return true
  }
  fire(u,dt){
    const K=u.K;u.ventT=Math.max(0,(u.ventT||0)-dt);
    if(u.volleyLeft>0){u.volleyT-=dt;if(u.volleyT<=0){if(this.planarToShip(u)<(K.minRange||12)*.8){u.volleyLeft=0;if(u.knees)u.ventT=1.9;return}this.shoot(u);u.volleyLeft--;u.volleyT=K.volleyGap||.15;if(u.volleyLeft<=0&&u.knees)u.ventT=1.9}return}
    if(!u.aggro)return;
    const d=this.planarToShip(u);
    // Tanks reach further with a fanned salvo (Dave: the old lobbed shells were lame).
    const salvo=K.shells&&d>K.range&&d<125;
    if(!salvo&&(d>K.range||d<(K.minRange||12)))return;
    // Direct fire needs the gun roughly facing the drone (turrets always do) and the
    // shooter on screen, so every projectile can be seen coming and shot down.
    // Dune crests block line of sight.
    if(!K.turret){const bearing=Math.atan2(shipX-u.x,travel-u.wz);if(Math.abs(wrapAngle(bearing-u.h))>(K.arc||1.2))return}
    const c=[u.x,this.ug(u)+K.top*u.s*.55,u.z],q=camPoint(c);
    if(q[2]<4)return;
    const sp=projectCam(q);if(!sp||sp.x<-W*.08||sp.x>W*1.08||sp.y<-viewH*.08||sp.y>viewH*1.05)return;
    if(salvo){
      u.shellCD=(u.shellCD??(1+Math.random()*2))-dt;
      if(u.shellCD<=0){if(!this.canSee(u,c)){u.shellCD=.4;return}u.shellCD=K.shellEvery[0]+Math.random()*(K.shellEvery[1]-K.shellEvery[0]);this.fanSalvo(u)}
      return
    }
    u.fireCD-=dt;
    if(u.fireCD<=0){
      if(!this.canSee(u,c)){u.fireCD=.4;return}
      u.volleyLeft=K.volley||1;u.volleyT=0;u.fireCD=K.fire[0]+Math.random()*(K.fire[1]-K.fire[0])
    }
  }
  muzzleWorld(u){
    const K=u.K,m=K.muzzles[u.muzzleI++%K.muzzles.length];let p=m;
    if(K.turret){const tz=K.turretZ||0,c=Math.cos(u.turretYaw),s=Math.sin(u.turretYaw),x=m[0],z=m[2]-tz;p=[c*x+s*z,m[1],-s*x+c*z+tz]}
    return this.worldPoint(u,this.bodyTransform(u)(p))
  }
  shoot(u){
    const K=u.K,w=this.muzzleWorld(u),before=bolts.length;
    if(!spawnBolt(w[0],w[1],w[2],K.heavy?.7:.9,K.heavy?1.5:2.0,K.heavy?.16:.2)||bolts.length===before)return;
    // Ground fire is quicker than space plasma: less time to admire it, still time to answer.
    const b=bolts[bolts.length-1],k=K.heavy?1.55:1.75;b.vx*=k;b.vy*=k;b.vz*=k;b.maxLife=b.maxLife/k+.8
  }
  // Tank salvo: a flat fan of three heavy yellow slugs from the turret. The middle
  // one is aimed at you; the outer two box you in, so a jink the wrong way still
  // costs you. Shoot the middle one or break across the fan.
  fanSalvo(u){
    const live=bolts.filter(b=>!b.dead).length;if(live>=18)return;
    const w=this.muzzleWorld(u),dx=shipX-w[0],dy=shipY-w[1],dz=-w[2],dist=Math.max(1,Math.hypot(dx,dy,dz));
    const speed=15,T=Math.max(.5,dist/speed),bearing=Math.atan2(w[0]-shipX,w[2]),sx=Math.cos(bearing),sz=-Math.sin(bearing);
    const p=proj(w);if(p)spark(p.x,p.y,C.y,8);
    const spread=2.4+Math.random()*.6,centreOn=Math.random()<.55;
    for(const side of[-1,0,1]){
      const off=side*spread+(side===0&&!centreOn?(Math.random()<.5?-1:1)*1.3:0),tx=shipX+sx*off,ty=shipY+(Math.random()-.5)*.5,tz=sz*off;
      bolts.push({x:w[0],y:w[1],z:w[2],spawnDistance:dist,targetX:tx,targetY:ty,targetZ:tz,hitIntent:side===0&&centreOn,
        vx:(tx-w[0])/T,vy:(ty-w[1])/T,vz:(tz-w[2])/T,homing:0,swampSpit:true,gaSlug:true,col:C.y,accentCol:C.w,visualScale:1.25,damageLabel:'SLUG HIT',
        rot:Math.random()*6.28,dead:false,visibleFor:0,visibleNow:false,age:0,maxLife:T+1.2,maxCullRange:200})
    }
  }
  collide(u){
    if(u.hitCD>0)return;
    const K=u.K,alt=shipY-this.ug(u),d=this.planarToShip(u);
    let hit=false;
    if(K.heavy){
      // Fly under the hull if you dare; the legs and the hull itself are solid.
      if(d<K.radius*u.s&&alt>K.bodyBottom*u.s-.35&&alt<K.top*u.s+.3)hit=true;
      else if(u.legs&&alt<K.top*u.s)for(const st of u.legs)if(Math.hypot(st.cx-shipX,st.cz-travel)<.95*u.s){hit=true;break}
    }else if(d<K.radius*u.s*.85&&alt<K.top*u.s+.3)hit=true;
    if(hit){damage('COLLISION');u.hitCD=1.2}
  }
  updateCollapse(u,dt){
    u.collapseT+=dt;const t=clamp(u.collapseT/1.9,0,1),e=t*t;
    u.drop=e*(u.K.bodyBottom-.4);u.tiltZ=lerp(u.collapseTilt[0],u.collapseTilt[0]*2.4,e);u.tiltX=lerp(u.collapseTilt[1],u.collapseTilt[1]*2.4,e);
    if(u.collapseT>=1.9&&!u.collapsed){
      u.collapsed=true;u.state='wreck';
      const p=proj([u.x,this.ug(u)+1,u.z]);
      if(p){for(let i=0;i<3;i++)spark(p.x+(Math.random()-.5)*60,p.y+(Math.random()-.5)*30,i?C.o:C.y,24)}
      SoundFX.explosion();shake=Math.max(shake||0,6);score+=u.K.score;
      say(`${u.K.label} DOWN`,.8)
    }
  }
  // ---------- damage ----------
  shotCandidate(a,bd){
    let best=null;
    const factory=this.variant==='factory';
    for(const u of this.units){
      if(u.dead||u.state!=='alive')continue;
      if(Math.hypot(u.x-shipX,u.wz-travel)>160)continue;
      if(factory&&this.shielded(u))continue;
      if(u.knees){
        this.pose(u);
        u.knees.forEach((k,i)=>{
          if(k.broken)return;const kp=u.poseKnees[i],p=proj(this.worldPoint(u,kp));if(!p)return;
          const r=clamp(u.K.legs[i].t*1.25*u.s*p.k,12,70),d=Math.hypot(a.x-p.x,a.y-p.y);
          // Knees win ties against the hull behind them.
          if(d<r&&d*.5<(best?best.score:bd)){best={target:u,point:p,distance:d*.5,score:d*.5,part:'knee',knee:i}}
        })
      }
      for(const s of u.K.spheres){
        const p=proj(this.worldPoint(u,this.bodyTransform(u)([s[0],s[1],s[2]])));if(!p)continue;
        const r=clamp(s[3]*u.s*p.k,13,160),d=Math.hypot(a.x-p.x,a.y-p.y);
        if(d<r&&d<(best?best.score:bd)){best={target:u,point:p,distance:d,score:d,part:u.K.heavy?'armour':'body'}}
      }
    }
    // A shield dome stops shots aimed through it (unless you are somehow inside).
    if(factory)for(const dm of this.domes){
      if(dm.up<.5)continue;const c=this.domeCentre(dm);
      if(Math.hypot(shipX-c[0],shipY-c[1],travel-c[2])<dm.r)continue;
      const p=proj([c[0],c[1]+dm.r*.35,c[2]-travel]);if(!p)continue;
      const R=dm.r*p.k,dd=Math.hypot(a.x-p.x,a.y-p.y);
      if(dd<R){const sc=dd/R*40;if(sc<(best?best.score:bd))best={target:dm,point:{x:a.x,y:a.y},distance:sc,score:sc,part:'dome'}}
    }
    return best
  }
  hit(c,bp,damageAmount=1,force=false){
    if(c.part==='dome'){
      const dm=c.target;dm.hitT=.25;spark(bp.x,bp.y,C.u,6);SoundFX.hit();
      if(this.shieldHintT<=0){say(dm.bunker?'BUNKER SHIELDED · DESTROY THE GENERATORS':'SHIELDED · KILL THE TESLA STRIDER',.9);this.shieldHintT=6}
      return
    }
    const u=c.target;if(!u||u.state!=='alive')return;
    if(c.part==='knee'&&!force&&!this.kneeOpen(u,c.knee))c={...c,part:'armour'};
    if(c.part==='armour'){
      // Every hit counts: hull hits wear the walker down slowly; knees break legs fast.
      u.hull=(u.hull??24)-damageAmount;u.hitFx=HIT_FX_TOTAL;spark(bp.x,bp.y,C.m,4);
      if(u.hull<=0&&u.state==='alive'){score+=300;this.beginCollapse(u)}else SoundFX.hit();
      return
    }
    if(c.part==='knee'){
      const k=u.knees[c.knee];k.hp-=damageAmount;k.hitFx=HIT_FX_TOTAL;u.hitFx=HIT_FX_TOTAL*.5;spark(bp.x,bp.y,C.y,6);
      if(k.hp<=0&&!k.broken){
        k.broken=true;u.legs[c.knee].broken=true;campaign.bumpStat?.('kills.knees');SoundFX.explosion();spark(bp.x,bp.y,C.o,18);score+=300;
        const broken=u.knees.filter(x=>x.broken).length;
        if(broken>=u.K.collapseAt)this.beginCollapse(u);else say(`KNEE DOWN · ${u.K.collapseAt-broken} TO GO`,.6)
      }else SoundFX.hit();
      return
    }
    if(u.leap&&u.leap.phase!=='land')damageAmount=Math.max(damageAmount,u.hp); // a pouncing hound is all exposed belly
    u.hp-=damageAmount;u.hitFx=HIT_FX_TOTAL;spark(bp.x,bp.y,C.c,4);
    if(u.hp<=0)this.destroy(u,bp);else SoundFX.hit()
  }
  beginCollapse(u){
    campaign.bumpStat?.(`kills.armour.${u.kind}`);
    u.state='collapsing';u.collapseT=0;u.speed=0;u.collapseTilt=[u.tiltZ||(Math.random()<.5?-.12:.12),u.tiltX||.08];
    if(this.lockId===u.id)this.lockId=0;
    say(`${u.K.label} BUCKLING`,.7)
  }
  destroy(u,bp){
    u.state='gone';this.pose(u);
    explodeMesh({x:u.x,y:this.ug(u),z:u.z,s:u.s,rot:[0,u.h+Math.PI,0]},u.mesh,bp||proj([u.x,u.y,u.z])||{x:W*.5,y:viewH*.5},u.K.col);
    score+=u.K.score;u.dead=true;if(this.lockId===u.id)this.lockId=0;
    campaign.bumpStat?.(u.kind==='generator'?'kills.generators':`kills.armour.${u.kind}`)
  }
  // ---------- lock-on and missiles ----------
  aimCandidate(a,cone){
    let best=null,bs=1e9;
    for(const u of this.units){
      if(u.dead||u.state!=='alive'||this.shielded(u))continue;
      const q=camPoint([u.x,this.ug(u)+u.K.top*u.s*.5,u.z]);if(q[2]<=3||q[2]>150)continue;
      const p=projectCam(q);if(!p||p.x<0||p.x>W||p.y<0||p.y>viewH)continue;
      const d=Math.hypot(a.x-p.x,a.y-p.y),r=clamp(u.K.radius*u.s*p.k,15,120),limit=cone+r*.45;
      if(d>limit)continue;const sc=d/limit+q[2]/420;if(sc<bs){bs=sc;best=u}
    }
    return best
  }
  updateLock(dt){
    let locked=this.units.find(u=>u.id===this.lockId&&u.state==='alive');
    if(this.lockId&&(!locked||this.planarToShip(locked)>210)){this.lockId=0;locked=null}
    if(!spaceLockHeld||mode!=='play'){this.lockAcquireId=0;this.lockAcquireT=Math.max(0,this.lockAcquireT-dt*3.5);return}
    const c=this.aimCandidate(aimScreen(),Math.max(52,Math.min(W,viewH)*.065));
    if(!c){this.lockAcquireId=0;this.lockAcquireT=Math.max(0,this.lockAcquireT-dt*3.6);return}
    if(c.id===this.lockId)return;
    if(this.lockAcquireId!==c.id){this.lockAcquireId=c.id;this.lockAcquireT=0}
    this.lockAcquireT+=dt;
    if(this.lockAcquireT>=.48*(campaign.lockTimeMultiplier?.()||1)){
      this.lockId=c.id;this.lockAcquireId=0;this.lockAcquireT=0;say('TARGET LOCKED',.32);
      audio.cancelQueuedVoice?.('targetLocked');audio.playVoice?.('targetLocked',{once:false,priority:false})
    }
  }
  missileTarget(){
    const locked=this.units.find(u=>u.id===this.lockId&&u.state==='alive'&&!this.shielded(u));
    if(locked)return locked;
    return this.aimCandidate(aimScreen(),Math.max(90,Math.min(W,viewH)*.14))
  }
  inView(max=4){
    return this.units.filter(u=>!u.dead&&u.state==='alive'&&!this.shielded(u)).map(u=>({u,q:camPoint([u.x,this.ug(u)+u.K.top*u.s*.5,u.z])}))
      .filter(o=>{if(o.q[2]<=1||o.q[2]>150)return false;const p=projectCam(o.q);return p&&p.x>-40&&p.x<W+40&&p.y>-40&&p.y<viewH+40})
      .sort((a,b)=>a.q[2]-b.q[2]).slice(0,max).map(o=>o.u)
  }
  // Missiles in the dunes fly in world coordinates so ground travel never drags them.
  missileAimPoint(u,m){
    if(u.knees){
      this.pose(u);
      let ki=m.knee;
      if(ki==null||u.knees[ki]?.broken){ // pick the nearest intact knee
        let bd=1e9;u.knees.forEach((k,i)=>{if(k.broken)return;const w=this.worldPoint(u,u.poseKnees[i]),d=Math.hypot(w[0]-m.x,w[2]+travel-m.wz);if(d<bd){bd=d;ki=i}});m.knee=ki
      }
      if(ki!=null&&!u.knees[ki].broken){const w=this.worldPoint(u,u.poseKnees[ki]);return[w[0],w[1],w[2]+travel]}
    }
    return[u.x,this.ug(u)+u.K.top*u.s*.5,u.wz]
  }
  updateMissile(m,dt){
    const u=this.units.find(x=>x.id===m.targetId&&x.state==='alive');
    if(!u)return true;
    const t=this.missileAimPoint(u,m),dx=t[0]-m.x,dy=t[1]-m.y,dz=t[2]-m.wz,d=Math.hypot(dx,dy,dz)||.001,sp=m.speed;
    const steer=1-Math.exp(-8.5*dt);
    m.vx=lerp(m.vx,dx/d*sp,steer);m.vy=lerp(m.vy,dy/d*sp,steer);m.vz=lerp(m.vz,dz/d*sp,steer);
    const n=Math.hypot(m.vx,m.vy,m.vz)||1;m.vx=m.vx/n*sp;m.vy=m.vy/n*sp;m.vz=m.vz/n*sp;
    m.x+=m.vx*dt;m.y+=m.vy*dt;m.wz+=m.vz*dt;m.z=m.wz-travel;
    if(Math.hypot(t[0]-m.x,t[1]-m.y,t[2]-m.wz)<Math.max(1.6,u.K.heavy?1.2:u.K.radius*u.s*.8)){
      const p=proj([t[0],t[1],t[2]-travel])||proj([m.x,m.y,m.z])||{x:W*.5,y:viewH*.5};
      spark(p.x,p.y,C.y,18);
      if(u.knees&&m.knee!=null&&!u.knees[m.knee].broken)this.hit({target:u,part:'knee',knee:m.knee},p,m.damage,true);
      else if(u.knees){spark(p.x,p.y,C.w,8);SoundFX.hit()}
      else this.hit({target:u,part:'body'},p,m.damage);
      say(u.state==='alive'&&!u.knees?`MISSILE HIT · ${Math.max(0,Math.ceil(u.hp))} HP`:'MISSILE HIT',.45);
      return true
    }
    return false
  }
  // ---------- drawing ----------
  // The dune grid seen through the open exit door (Dave: the grid only appeared once
  // you were out). Same ground/rocks as the surface, drawn inside the door clip.
  drawGroundThrough(){
    if(!this.active)return;const scene=[];this.appendGround(scene);this.appendTrees(scene);
    scene.sort((a,b)=>b.z-a.z);for(const it of scene)it.draw()
  }
  appendScene(scene){
    if(!this.active||phase!=='surface')return;
    for(const d of this.domes){
      if(d.up<=0)continue;const c=this.domeCentre(d),cz=camPoint([c[0],c[1]+d.r*.3,c[2]-travel])[2];if(cz<-d.r)continue;
      scene.push({z:cz+d.r*.6,draw:()=>this.drawDome(d,true)});
      scene.push({z:Math.max(.2,cz-d.r*.6),draw:()=>this.drawDome(d,false)})
    }
    if(mode==='trenchEntry'&&this.bunker){const q=camPoint([entryBunkerX,-2.2,entryBunkerZ()]);scene.push({z:Math.max(.2,q[2]),draw:()=>drawTrenchEntry(false)})}
    this.appendGround(scene);this.appendTrees(scene);
    for(const u of this.units){
      if(u.dead)continue;
      if(Math.hypot(u.x-shipX,u.wz-travel)>GA_UNIT_SIGHT)continue;
      u.z=u.wz-travel;
      const q=camPoint([u.x,this.ug(u)+u.K.top*u.s*.5,u.z]),R=Math.max(u.K.radius,u.K.top*.6)*u.s*1.3;if(q[2]<=.18-R)continue;
      // Off to either side of the view: skip the whole draw.
      if(Math.abs(q[0])>Math.max(0,q[2])*1.1+R)continue;
      scene.push({z:Math.max(.19,q[2]),draw:()=>this.drawUnit(u)})
    }
  }
  drawDome(d,back){
    const c=this.domeCentre(d),g=GA_DOME,cz=camPoint([c[0],c[1]+d.r*.3,c[2]-travel])[2];
    const pulse=.88+.12*Math.sin(this.t*4.4+d.x),al=.75*d.up*pulse*(d.hitT>0?1.35:1),col=d.hitT>0?C.w:C.u;
    const sink=(1-d.up)*d.r*.25;
    const P=g.pts.map(p=>[c[0]+p[0]*d.r,c[1]+p[1]*d.r-sink,c[2]-travel+p[2]*d.r]);
    const Z=P.map(p=>camPoint(p)[2]),S=P.map(p=>proj(p));
    for(const [a,b] of g.edges){const pa=S[a],pb=S[b];if(!pa||!pb)continue;const isBack=(Z[a]+Z[b])/2>cz;if(isBack!==back)continue;line(pa.x,pa.y,pb.x,pb.y,col,1,Math.min(1,al*(back?.55:1)))}
  }
  drawTesla(){
    for(const d of this.domes){
      if(!d.teslaId||d.up<.5)continue;const t=this.units.find(u=>u.id===d.teslaId&&u.state==='alive');if(!t)continue;
      const top=this.worldPoint(t,this.bodyTransform(t)(t.K.coilTop)),c=this.domeCentre(d),dx=top[0]-c[0],dz=top[2]+travel-c[2],L=Math.hypot(dx,dz)||1,e=.8;
      gaDrawArc(top,[c[0]+dx/L*d.r*Math.cos(e),c[1]+d.r*Math.sin(e),c[2]-travel+dz/L*d.r*Math.cos(e)],C.u)
    }
    for(const u of this.units){
      if(!u.K.tesla||u.state!=='alive')continue;
      const top=this.worldPoint(u,this.bodyTransform(u)(u.K.coilTop));
      if(u.charge>0){const n=1+Math.floor(u.charge/GA_TESLA_CHARGE*5);for(let i=0;i<n;i++){const a=Math.random()*6.28,r=1+Math.random()*1.8*u.s;gaDrawArc(top,[top[0]+Math.cos(a)*r,top[1]+(Math.random()-.3)*r,top[2]+Math.sin(a)*r],C.u,1,.5)}}
      if(u.strikeT>0){const f=cameraVectorToWorld([.35,-.55,1.8]);gaDrawArc(top,[shipX+f[0],shipY+f[1],f[2]],C.u,1.6,.28)}
    }
  }
  drawUnit(u){
    this.pose(u);
    const wreck=u.state==='wreck';
    if(u.mesh.edgeColors){
      const ec=u.mesh.edgeColors;
      u.knees.forEach((k,i)=>{const c=wreck?null:(k.broken?C.x:(k.hitFx>HIT_FX_WHITE_END?C.w:(this.kneeOpen(u,i)?C.y:null)));for(const ei of u.kneeEdges[i])ec[ei]=c})
    }
    const col=wreck?C.x:(u.leap&&u.leap.phase==='crouch'&&Math.sin(u.leap.t*40)>0?C.w:objectHitColor(u,u.K.col));
    const dist=this.planarToShip(u),haze=clamp((GA_UNIT_SIGHT-dist)/40,0,1),depth=camPoint([u.x,this.ug(u),u.wz-travel])[2];
    drawMesh({x:u.x,y:this.ug(u),z:u.wz-travel,s:u.s,rot:[0,u.h+Math.PI,0],fadeZ:Math.max(0,depth)*.8},u.mesh,col,(wreck?.55:1)*haze)
  }
  navDistance(g){return Math.hypot(g.navX-shipX,g.navWZ-travel)}
  activeGroup(){let best=null,bd=1e9;for(const g of this.groups){if(g.cleared)continue;const d=this.navDistance(g);if(d<bd){bd=d;best=g}}return best}
  drawMarker(){
    if(!this.active||mode!=='play'||phase!=='surface')return;
    this.drawAltitude();
    ctx.font='400 8px Consolas,monospace';ctx.textAlign='left';ctx.strokeStyle=C.g;ctx.strokeText(`FPS ${Math.round(1000/Math.max(1,gaPerf.gap))} · FRAME ${gaPerf.gap.toFixed(1)} MS · JS ${gaPerf.js.toFixed(1)} MS`,12,26);
    if(this.pounceWarn>0&&Math.sin(this.t*18)>-.3){ctx.font='400 12px Consolas,monospace';ctx.textAlign='center';ctx.strokeStyle=C.m;ctx.strokeText('POUNCE',W*.5,viewH*.2+(this.arcWarn>0?16:0));ctx.textAlign='left'}
    if(this.variant==='factory'){
      this.drawTesla();
      if(this.arcWarn>0&&Math.sin(this.t*18)>-.3){ctx.font='400 12px Consolas,monospace';ctx.textAlign='center';ctx.strokeStyle=C.u;ctx.strokeText('ARC',W*.5,viewH*.2);ctx.textAlign='left'}
      // Bunker nav: always shown; yellow once the shield is down.
      const B=this.bunkerNavPoint(),gh=GA_GROUND_Y,q=camPoint([B.x,gh+9,B.wz-travel]),p=q[2]>.2?projectCam(q):null,on=!!(p&&p.x>=0&&p.x<=W&&p.y>=0&&p.y<=viewH);
      const col=this.bunkerUnlocked?C.y:C.g,dist=Math.round(Math.hypot(B.x-shipX,B.wz-travel));
      ctx.font='400 8px Consolas,monospace';
      if(on){const r=this.bunkerUnlocked?10+Math.sin(this.navPulse*4.2)*1.5:7;line(p.x,p.y-r,p.x+r,p.y,col,1.15,.9);line(p.x+r,p.y,p.x,p.y+r,col,1.15,.9);line(p.x,p.y+r,p.x-r,p.y,col,1.15,.9);line(p.x-r,p.y,p.x,p.y-r,col,1.15,.9);
        ctx.textAlign='center';ctx.strokeStyle=col;ctx.strokeText(this.bunkerUnlocked?(B.gate?'BUNKER APPROACH':'BUNKER'):'BUNKER · SHIELDED',p.x,p.y-r-16);ctx.strokeText(String(dist),p.x,p.y-r-7);ctx.textAlign='left'}
      else if(this.bunkerUnlocked){const edge=hudEdgeCue(q,0),x=edge.x,y=edge.y,dx=edge.dx,dy=edge.dy,tx=-dy,ty=dx,bx=x-dx*8;line(bx+tx*6,y-dy*8+ty*6,x,y,col,1.3,.88);line(x,y,bx-tx*6,y-dy*8-ty*6,col,1.3,.88)}
    }
    const act=this.activeGroup();
    ctx.font='400 8px Consolas,monospace';
    for(const g of this.groups){
      if(g.cleared)continue;
      const isAct=g===act,col=isAct?C.y:C.g,dist=Math.round(this.navDistance(g));
      const gh=GA_GROUND_Y+this.groundH(g.navX,g.navWZ),q=camPoint([g.navX,gh+7.5,g.navWZ-travel]);
      const p=q[2]>.2?projectCam(q):null,on=!!(p&&p.x>=0&&p.x<=W&&p.y>=0&&p.y<=viewH);
      if(on){
        const pulse=isAct?1.5+Math.sin(this.navPulse*4.2)*1.5:0,r=(isAct?9:7)+pulse,al=isAct?.92:.6;
        // Dashed beacon down to the ground so the point reads as a place, not a sky marker.
        const gq=camPoint([g.navX,gh,g.navWZ-travel]),gp=gq[2]>.2?projectCam(gq):null;
        if(gp){const n=Math.max(2,Math.floor((gp.y-p.y-r)/9));for(let i=0;i<n;i+=2){const y0=p.y+r+(gp.y-p.y-r)*i/n,y1=p.y+r+(gp.y-p.y-r)*(i+1)/n;line(lerp(p.x,gp.x,i/n),y0,lerp(p.x,gp.x,(i+1)/n),y1,col,1,al*.6)}}
        line(p.x,p.y-r,p.x+r,p.y,col,1.15,al);line(p.x+r,p.y,p.x,p.y+r,col,1.15,al);
        line(p.x,p.y+r,p.x-r,p.y,col,1.15,al);line(p.x-r,p.y,p.x,p.y-r,col,1.15,al);
        ctx.textAlign='center';ctx.strokeStyle=col;ctx.strokeText(`NAV ${g.name}`,p.x,p.y-r-16);ctx.strokeText(String(dist),p.x,p.y-r-7);ctx.textAlign='left'
      }else{
        const edge=hudEdgeCue(q,0),x=edge.x,y=edge.y,dx=edge.dx,dy=edge.dy,tx=-dy,ty=dx,depth=8,width=12,bx=x-dx*depth;
        line(bx+tx*width*.5,y-dy*depth+ty*width*.5,x,y,col,1.3,isAct?.88:.5);line(x,y,bx-tx*width*.5,y-dy*depth-ty*width*.5,col,1.3,isAct?.88:.5);
        ctx.textAlign='center';ctx.strokeStyle=col;ctx.strokeText(`${g.letter} ${dist}`,x-dx*24,y-dy*24+(dy>0?-4:4));ctx.textAlign='left'
      }
    }
    // Lock brackets.
    const drawBrackets=(u,colr,frac)=>{
      const q=camPoint([u.x,this.ug(u)+u.K.top*u.s*.5,u.z]);if(q[2]<=.5)return;const p=projectCam(q);if(!p)return;
      const r=clamp(u.K.radius*u.s*p.k*1.1,14,150),k=r*.35;
      for(const[sx,sy]of[[-1,-1],[1,-1],[1,1],[-1,1]]){line(p.x+sx*r,p.y+sy*r,p.x+sx*(r-k),p.y+sy*r,colr,1.2,.9);line(p.x+sx*r,p.y+sy*r,p.x+sx*r,p.y+sy*(r-k),colr,1.2,.9)}
      if(frac<1){line(p.x-r,p.y+r+6,p.x-r+2*r*frac,p.y+r+6,colr,1.2,.8)}
    };
    const locked=this.units.find(u=>u.id===this.lockId&&u.state==='alive');
    if(locked)drawBrackets(locked,C.y,1);
    const acq=this.lockAcquireId&&this.units.find(u=>u.id===this.lockAcquireId&&u.state==='alive');
    if(acq)drawBrackets(acq,C.g,clamp(this.lockAcquireT/(.48*(campaign.lockTimeMultiplier?.()||1)),0,1));
  }
  hudLeft(){return this.active&&phase==='surface'?(this.variant==='factory'?'FACTORY ASSAULT':'DUNE ASSAULT'):''}
  hudRight(){
    if(!this.active||phase!=='surface')return'';
    if(this.variant==='factory'){
      const c=this.genCount(),g=this.activeGroup();
      if(this.bunkerUnlocked){const n=this.bunkerNavPoint();return`${n.gate?'BUNKER APPROACH':'BUNKER'} ${Math.round(Math.hypot(n.x-shipX,n.wz-travel))}`}
      return`GENERATORS ${c.down}/${c.total}${g?` · NAV ${g.name} ${Math.round(this.navDistance(g))}`:''}`
    }
    const left=this.units.filter(u=>u.state==='alive').length,g=this.activeGroup();
    return g?`NAV ${g.name} ${Math.round(this.navDistance(g))} · ARMOUR ${left}`:(this.state==='clear'||this.state==='departing'?'DUNES CLEAR':`ARMOUR ${left}`)
  }
  onBeginEscape(success){
    if(!(this.active&&this.variant==='factory'))return;
    if(success)this.reactorDown=true;
    // Dave: the way out must still be able to kill you. A short (~20 s) escape run with
    // girders AND guns, not the old 100-unit sprint with nothing in it.
    const old=exitDoorWorld;exitDoorWorld=travel+430;escapeBoundaryWorld=Math.min(escapeBoundaryWorld,travel+30);
    const f=this.flats.find(q=>q.z===old);if(f)f.z=exitDoorWorld;else this.flats.push({x:tunnelOriginX,z:exitDoorWorld,r0:30,r1:60});this.hCache.clear();
    this.tSpawnPhase='';
  }
  finish(success=true,opts={}){
    const f=this.variant==='factory',lost=!!opts.droneLost;this.reset();
    surfaceBunkerActive=false;entryBunkerWorldZ=Infinity;
    fighters.length=0;asteroids.length=0;groundTargets.length=0;bolts.length=0;hazards.length=0;shots.length=0;playerMissiles.length=0;
    mode='idle';phase='space';inputX=inputY=aimX=aimY=0;viewYaw=viewPitch=viewRoll=0;
    // As a story mission: reactor down counts as success even if the drone died on the
    // way out, but the loss still goes through the insurance claims (Dave).
    const m=campaign.currentMission;
    if(m?.devGroundTest){campaign.finishDevGroundTest(success,lost);return}
    if(m&&!m.devTest&&!m.devTemplateTest){if(success)campaign.completeCurrentMission({droneLost:lost});else campaign.failCurrentMission(lost?'Drone destroyed':'Mission failed');return}
    campaign.showHub('options');
    say(f?(success?(lost?'FACTORY TEST COMPLETE · REACTOR DOWN · DRONE LOST (INSURANCE CLAIM)':'FACTORY TEST COMPLETE'):'FACTORY TEST ENDED'):(success?'DUNE TRIAL COMPLETE':'DUNE TRIAL ENDED'),1.2)
  }
  // ---------- finale: out into space, turn round, watch the moon go ----------
  moonMesh(R){
    const m=gaBuilder(true),rings=[],N=14,S=22;
    for(let i=0;i<=N;i++){const t=Math.PI*i/N,r=Math.max(.02*R,Math.sin(t)*R);rings.push(m.ringXZ(0,Math.cos(t)*R,0,r,r,S))}
    m.loft(rings);return{v:m.v,e:m.e,faces:m.faces}
  }
  beginFinale(){
    mode='moonFinale';phase='space';modeT=0;bolts.length=0;hazards.length=0;groundTargets.length=0;shots.length=0;playerMissiles.length=0;inputX=inputY=0;
    const R=30,M=[shipX,shipY-230,-135]; // well clear: the moon is small in the view (Dave: too close)
    this.fin={t:0,R,M,mesh:this.moonMesh(R),y0:viewYaw,p0:viewPitch,boom:false,debris:[],ring:0};
    // Solve the view that frames the moon (whatever the camera's sign conventions).
    const sy=viewYaw,sp=viewPitch,sr=viewRoll;let best=[Math.PI,1],bd=1e9;viewRoll=0;
    for(let yi=0;yi<=36;yi++)for(let pi=0;pi<=30;pi++){viewYaw=-Math.PI+yi*Math.PI/18;viewPitch=-1.45+pi*2.9/30;const q=camPoint(M);if(q[2]<=0)continue;const d=Math.hypot(q[0]/q[2],q[1]/q[2]);if(d<bd){bd=d;best=[viewYaw,viewPitch]}}
    for(let k=0;k<2;k++){const [by,bp]=best,st=k?.02:.09;for(let yi=-6;yi<=6;yi++)for(let pi=-6;pi<=6;pi++){viewYaw=by+yi*st;viewPitch=clamp(bp+pi*st,-1.5,1.5);const q=camPoint(M);if(q[2]<=0)continue;const d=Math.hypot(q[0]/q[2],q[1]/q[2]);if(d<bd){bd=d;best=[viewYaw,viewPitch]}}}
    viewYaw=sy;viewPitch=sp;viewRoll=sr;
    // Turn the long way round (a real about-turn), never more than half a circle.
    let dy=wrapAngle(best[0]-sy);this.fin.y1=sy+dy;this.fin.p1=best[1];
    say('CLEAR OF THE MOON',1.0)
  }
  updateFinale(dt){
    const F=this.fin;if(!F){this.finish(true);return}
    F.t+=dt;const TURN=3.0,BOOM=5.2,END=BOOM+4.4,e=F.t-BOOM;
    const u=ease(clamp(F.t/TURN,0,1));viewYaw=lerp(F.y0,F.y1,u);viewPitch=lerp(F.p0,F.p1,u);viewRoll=Math.sin(u*Math.PI)*.25;
    if(e>-1.5&&e<0)shake=Math.max(shake||0,lerp(0,6,(e+1.5)/1.5));
    if(e>-1.5&&!F.rumble){F.rumble=true;say('ANTIMATTER CONTAINMENT FAILURE',1.3)}
    if(e>=0&&!F.boom){F.boom=true;shake=10;SoundFX.explosion();campaign.bumpStat?.('kills.moons')}
    if(e>=.45&&!F.shock){F.shock=true;shake=14;SoundFX.explosion();setTimeout(()=>SoundFX.explosion(),220)}
    if(e>=1.4&&!F.said){F.said=true;say('FACTORY MOON DESTROYED',2.2)}
    if(F.t>=END)this.finish(true)
  }
  drawFinale(){const F=this.fin;if(F)gaMoonFx.draw(F,F.t-5.2)}
}
// ---------- Moon explosion: audition C "TECTONIC" (Dave's pick, v52) ----------
// Pure functions of t (seconds from the blast; negative = rumble). Lines and points only.
const gaMoonFx=(()=>{
const rng=seed=>()=>{seed|=0;seed=seed+0x6D2B79F5|0;let t=Math.imul(seed^seed>>>15,1|seed);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296};
const unit=r=>{const z=r()*2-1,a=r()*6.2832,s=Math.sqrt(1-z*z);return[s*Math.cos(a),z,s*Math.sin(a)]};
const add=(a,b,k=1)=>[a[0]+b[0]*k,a[1]+b[1]*k,a[2]+b[2]*k];
const PAL=[C.w,C.y,C.o,C.r,C.m,C.c];
const hot=(t,i)=>t<.5?PAL[(i+Math.floor(t*16))%6]:(t<1.4?[C.w,C.y,C.o][(i+Math.floor(t*6))%3]:[C.o,C.r][(i)%2]);
const dot=(p,c,a)=>{const q=proj(p);if(q)line(q.x-.8,q.y,q.x+.8,q.y+.4,c,1,a)};
const seg=(a,b,c,al)=>{const p=proj(a),q=proj(b);if(p&&q)line(p.x,p.y,q.x,q.y,c,1,al)};
const rotAx=(v,ax,ang)=>{const c=Math.cos(ang),s=Math.sin(ang),d=v[0]*ax[0]+v[1]*ax[1]+v[2]*ax[2],cr=[ax[1]*v[2]-ax[2]*v[1],ax[2]*v[0]-ax[0]*v[2],ax[0]*v[1]-ax[1]*v[0]];
  return[v[0]*c+cr[0]*s+ax[0]*d*(1-c),v[1]*c+cr[1]*s+ax[1]*d*(1-c),v[2]*c+cr[2]*s+ax[2]*d*(1-c)]};
const TILT=[.95,0,.35];
const moonPt=(F,lat,lon,k=1)=>{let p=[Math.sin(lat)*Math.cos(lon)*F.R*k,Math.cos(lat)*F.R*k,Math.sin(lat)*Math.sin(lon)*F.R*k];p=rotate(p,TILT);return add(F.M,p)};
const facing=(F,p)=>camPoint(p)[2]<camPoint(F.M)[2]+F.R*.15;

// Shared rumble: intact wireframe, flicker, fault lines racing over the near side.
function rumble(F,t,spin=0){
  const pre=t>-1.5,fl=pre&&Math.sin((t+3)*(24+(t+1.5)*10))>.25,col=fl?(Math.sin(t*97)>0?C.y:C.w):C.o;
  drawMesh({x:F.M[0],y:F.M[1],z:F.M[2],s:1,rot:[TILT[0],spin,TILT[2]],fadeZ:0},F.mesh,col,1);
  if(!pre)return;const n=Math.floor((t+1.5)*16),r=rng(7);
  for(let i=0;i<n;i++){const la=r()*3.1,lo=r()*6.28,dl=(r()-.5)*.5,dn=(r()-.5)*.7,a=moonPt(F,la,lo,1.01),b=moonPt(F,la+dl,lo+dn,1.01);if(facing(F,a))seg(a,b,i%3?C.y:C.w,.95)}
}
const gaMoonTectonic=(F,t)=>{
  if(t<0){rumble(F,t);return}
  const plates=[],LA=5,LO=8,r=rng(31),fade=Math.max(0,1-t/4);
  for(let i=0;i<LA;i++)for(let j=0;j<LO;j++){const la0=Math.PI*i/LA,la1=Math.PI*(i+1)/LA,lo0=6.283*j/LO,lo1=6.283*(j+1)/LO;
    const mid=moonPt({M:[0,0,0],R:1},(la0+la1)/2,(lo0+lo1)/2),sp=4+r()*10,ax=unit(r),tw=(r()-.5)*1.6;
    const outline=[];for(let k=0;k<=3;k++)outline.push([la0,lo0+(lo1-lo0)*k/3]);for(let k=0;k<=3;k++)outline.push([la0+(la1-la0)*k/3,lo1]);for(let k=0;k<=3;k++)outline.push([la1,lo1-(lo1-lo0)*k/3]);for(let k=0;k<=3;k++)outline.push([la1-(la1-la0)*k/3,lo0]);
    const off=add([0,0,0],mid,sp*t+ (t>.45?(t-.45)*(t-.45)*40:0)),ctr=moonPt(F,(la0+la1)/2,(lo0+lo1)/2);
    let prev=null;for(const [la,lo] of outline){let p=moonPt(F,la,lo);let v=[p[0]-ctr[0],p[1]-ctr[1],p[2]-ctr[2]];v=rotAx(v,ax,tw*t);p=add(add(ctr,v),off);if(prev)seg(prev,p,t<.45?C.o:hot(t,i+j),fade);prev=p}}
  if(t<.6){const g=1-t/.6;for(let i=0;i<50;i++){const q=unit(r);dot(add(F.M,q,F.R*.9),C.y,g)}}
  if(t>.45){const u=t-.45,rad=F.R*1.1+u*75,a=Math.max(0,1-u/2.6);for(let i=0;i<260;i++){const q=unit(r);dot(add(F.M,q,rad),u<.4?C.w:(i%3?C.o:C.y),a)}
    for(let i=0;i<48;i++){const q=unit(r),l0=F.R+u*(60+r()*60);seg(add(F.M,q,l0),add(F.M,q,l0+10+u*25),i%2?C.y:C.w,a)}}
};
return{draw:gaMoonTectonic}
})();
const groundAssault=new GroundAssaultController();
