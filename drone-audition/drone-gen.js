'use strict';
// Trilateral drone audition. Convention: X right, Y up, Z fore/aft, nose at -Z.
// Scale matches the current PDI family (about ±1.4 units).
function M(name){
  const v=[],e=[],faces=[],es=new Set();
  const V=p=>{v.push(p.map(n=>+n.toFixed(4)));return v.length-1};
  const E=(a,b)=>{if(a===b)return;const k=a<b?`${a},${b}`:`${b},${a}`;if(es.has(k))return;es.add(k);e.push([a,b])};
  const F=ids=>{faces.push(ids);for(let i=0;i<ids.length;i++)E(ids[i],ids[(i+1)%ids.length])};
  const loft=(rings,{capStart=true,capEnd=true}={})=>{
    const idx=rings.map(r=>Array.isArray(r[0])?r.map(V):[V(r)]);
    for(let k=0;k<idx.length-1;k++){const A=idx[k],B=idx[k+1];
      if(A.length===1){for(let i=0;i<B.length;i++)F([A[0],B[(i+1)%B.length],B[i]]);continue}
      if(B.length===1){for(let i=0;i<A.length;i++)F([A[i],A[(i+1)%A.length],B[0]]);continue}
      for(let i=0;i<A.length;i++){const j=(i+1)%A.length;F([A[i],A[j],B[j],B[i]])}}
    if(capStart&&idx[0].length>2)F([...idx[0]].reverse());
    if(capEnd&&idx[idx.length-1].length>2)F(idx[idx.length-1]);
    return idx};
  const plate=pts=>{const ids=pts.map(V);F(ids);return ids};
  const line=(a,b)=>E(V(a),V(b));
  return{name,v,e,faces,V,E,F,loft,plate,line,out(){return{name,v,e,faces}}}
}
const rz=([x,y,z],a)=>[x*Math.cos(a)-y*Math.sin(a),x*Math.sin(a)+y*Math.cos(a),z];
// Vane-local frame: radial = +Y, tangent = +X. k-th vane rotated by base+k*120°.
const tri=(base,fn)=>{for(let k=0;k<3;k++){const a=base+k*2*Math.PI/3;fn(p=>rz(p,a),k)}};
const ring=(r,z,n,off=0)=>Array.from({length:n},(_,i)=>{const t=off+2*Math.PI*i/n;return[Math.cos(t)*r,Math.sin(t)*r,z]});
// Small square beam between two points (struts, pylons).
function beam(m,a,b,w=.05){
  const d=[b[0]-a[0],b[1]-a[1],b[2]-a[2]],L=Math.hypot(...d),u=d.map(x=>x/L);
  let r=Math.abs(u[2])<.9?[u[1],-u[0],0]:[1,0,0];const rl=Math.hypot(...r);r=r.map(x=>x/rl);
  const s=[u[1]*r[2]-u[2]*r[1],u[2]*r[0]-u[0]*r[2],u[0]*r[1]-u[1]*r[0]];
  const sq=p=>[[-1,-1],[1,-1],[1,1],[-1,1]].map(([i,j])=>p.map((x,k)=>x+r[k]*i*w+s[k]*j*w));
  m.loft([sq(a),sq(b)])
}
// Hex pod along Z with vertices aligned so three of them sit under the vanes.
function pod(m,{tip=-1.2,r1=.30,z1=-.45,r2=.36,z2=.25,r3=.24,z3=.7,off=Math.PI/2}={}){
  m.loft([[0,0,tip],ring(r1,z1,6,off),ring(r2,z2,6,off),ring(r3,z3,6,off)])
}
const UP=0,DOWN=Math.PI; // vane base: one vane straight up, or straight down (a "Y")

// A · TRISTAR — standard interceptor. Radial hex panels on short beams: a Y head-on.
function tristar(){
  const m=M('A · Tristar — standard (radial panels, Y head-on)');
  pod(m,{off:-Math.PI/2});
  tri(DOWN,R=>{
    beam(m,R([0,.33,.05]),R([0,.66,.05]),.045);
    const P=[[0,.66,-.52],[0,1.02,-.78],[0,1.42,-.40],[0,1.42,.40],[0,1.02,.66],[0,.66,.46]].map(R);
    const ids=m.plate(P);m.E(ids[1],ids[4]);
  });
  return m.out()
}
// B · PINWHEEL — standard alt. Tristar panels twisted 40° about their struts, so
// head-on you see three faces in a triskelion, and it reads as spinning when it rolls.
function pinwheel(){
  const m=M('B · Pinwheel — standard (twisted panels, triskelion head-on)');
  pod(m,{off:-Math.PI/2});
  const tw=40*Math.PI/180,T=([x,y,z])=>[x*Math.cos(tw)+z*Math.sin(tw),y,-x*Math.sin(tw)+z*Math.cos(tw)];
  tri(DOWN,R=>{
    beam(m,R([0,.33,.05]),R([0,.66,.05]),.045);
    const P=[[0,.66,-.52],[0,1.02,-.78],[0,1.42,-.40],[0,1.42,.40],[0,1.02,.66],[0,.66,.46]].map(p=>R(T(p)));
    const ids=m.plate(P);m.E(ids[1],ids[4]);
  });
  return m.out()
}
// C · DART — fast. Needle hull, three swept tail flights plus three small canards.
function dart(){
  const m=M('C · Dart — fast (needle, swept tri-flights)');
  m.loft([[0,0,-1.85],ring(.16,-.9,6,Math.PI/2),ring(.24,-.1,6,Math.PI/2),ring(.26,.55,6,Math.PI/2),ring(.16,.92,6,Math.PI/2)]);
  tri(DOWN,R=>{
    m.plate([[0,.22,.05],[0,.98,.52],[0,1.05,.96],[0,.25,.82]].map(R));
    m.plate([[0,.20,-.70],[0,.46,-.52],[0,.46,-.34],[0,.22,-.36]].map(R));
  });
  return m.out()
}
// D · CLAW — strike. Three panels hinged behind the nose, canted forward and out.
function claw(){
  const m=M('D · Claw — strike (forward-canted petals)');
  pod(m,{tip:-.95,r1:.30,z1:-.35,r2:.36,z2:.30,r3:.26,z3:.72,off:-Math.PI/2});
  tri(DOWN,R=>{
    const P=[[-.22,.34,-.05],[.22,.34,-.05],[.52,1.05,-.72],[.30,1.24,-1.18],[-.30,1.24,-1.18],[-.52,1.05,-.72]].map(R);
    const ids=m.plate(P);m.E(ids[0],ids[3]);
    beam(m,R([0,.36,.35]),R([0,.95,-.62]),.04);
  });
  return m.out()
}
// E · HALO — security / checkpoint. Y struts to a triangular frame, small panels at its corners.
function halo(){
  const m=M('T5 · Halo — security (triangle frame, corner panels)');
  pod(m,{tip:-1.0,r1:.30,r2:.36,r3:.26,z3:.66});
  const R0=1.25,corner=k=>rz([0,R0,.05],k*2*Math.PI/3);
  tri(UP,(R,k)=>{
    beam(m,R([0,.36,.05]),R([0,R0-.08,.05]),.035);
    beam(m,corner(k),corner(k+1),.04);
    const c=R([0,R0,.05]);
    m.plate([[-.28,R0+.02,-.42],[.28,R0+.02,-.42],[.38,R0+.02,.10],[.18,R0+.02,.48],[-.18,R0+.02,.48],[-.38,R0+.02,.10]].map(R));
  });
  return m.out()
}
// F · WAR PATTERN — Partition-war heavy. Three armoured gun pods on thick pylons.
function war(){
  const m=M('F · War Pattern — rogue heavy (three gun pods)');
  m.loft([[0,0,-.9],ring(.34,-.45,3,Math.PI/2+Math.PI/3),ring(.46,.25,3,Math.PI/2+Math.PI/3),ring(.30,.72,3,Math.PI/2+Math.PI/3)]);
  tri(UP,R=>{
    // pylon plate
    m.plate([[0,.30,-.30],[0,.86,-.10],[0,.86,.40],[0,.34,.55]].map(R));
    // gun pod: square section box with a stepped nose and a barrel
    const sq=(z,s)=>[[-s,.86-s,z],[s,.86-s,z],[s,.86+s,z],[-s,.86+s,z]].map(R);
    m.loft([sq(-.55,.10),sq(-.35,.17),sq(.50,.17),sq(.62,.11)]);
    beam(m,R([0,.86,-.55]),R([0,.86,-1.15]),.03);
  });
  return m.out()
}

function tricage(){
  const m=M('T7 · Tricage — heavy (tangent panels only, no frame)');
  pod(m,{tip:-1.05,r1:.34,r2:.40,r3:.28,z3:.66});
  tri(UP,R=>{
    beam(m,R([0,.38,.0]),R([0,1.0,.0]),.05);
    const d=1.0,P=[[-.40,d,-.72],[.40,d,-.72],[.70,d,-.20],[.70,d,.40],[.40,d,.70],[-.40,d,.70],[-.70,d,.40],[-.70,d,-.20]].map(R);
    const ids=m.plate(P);m.E(ids[0],ids[4]);m.E(ids[1],ids[5]);
  });
  return m.out()
}
// ===== Triangle-cage family variants =====
const C3=(R,z,k,base=0)=>rz([0,R,z],base+k*2*Math.PI/3);
function frame(m,R,z,base=0,w=.04){for(let k=0;k<3;k++)beam(m,C3(R,z,k,base),C3(R,z,k+1,base),w)}
// T1 · WARDEN-T — standard. Triangle frame with an armour panel on each side.
function cageStandard(){
  const m=M('T1 · Cage Warden — standard (frame + side panels)');
  pod(m,{tip:-1.05,r1:.30,r2:.36,r3:.26,z3:.66,off:-Math.PI/2});
  const R=1.25;frame(m,R,.05,Math.PI);
  tri(UP,(Rr,k)=>{
    beam(m,Rr([0,-.36,.05]),Rr([0,-R+.06,.05]),.035);
    // panel on the frame side opposite the strut: tangent plate at inradius R/2
    const d=R*.5+.03;m.plate([[-.46,d,-.42],[.46,d,-.42],[.62,d,.0],[.46,d,.46],[-.46,d,.46],[-.62,d,0]].map(Rr));
  });
  return m.out()
}
// T2 · PRISM — heavy. A true cage: fore and aft triangles joined by rails, part-armoured.
function cagePrism(){
  const m=M('T2 · Prism — heavy (triangular prism cage)');
  pod(m,{tip:-.95,r1:.32,r2:.38,r3:.28,z3:.62});
  const R=1.15;frame(m,R,-.70,0);frame(m,R,.70,0);
  for(let k=0;k<3;k++)beam(m,C3(R,-.70,k),C3(R,.70,k),.04);
  tri(Math.PI,Rr=>{
    beam(m,Rr([0,.36,0]),Rr([0,R*.5,0]),.04);
    const d=R*.5+.02;m.plate([[-.55,d,-.55],[.55,d,-.55],[.55,d,.30],[-.55,d,.30]].map(Rr));
  });
  return m.out()
}
// T3 · SPIKE — fast. Long needle, small aft triangle, rails from the nose to its corners.
function cageSpike(){
  const m=M('T3 · Spike — fast (tetrahedral spear)');
  m.loft([[0,0,-1.9],ring(.14,-.9,6,Math.PI/2),ring(.22,.1,6,Math.PI/2),ring(.24,.6,6,Math.PI/2),ring(.15,.9,6,Math.PI/2)]);
  const R=.95;frame(m,R,.78,Math.PI,.035);
  for(let k=0;k<3;k++){beam(m,[0,0,-1.5],C3(R,.78,k,Math.PI),.03);beam(m,C3(.22,.55,k,Math.PI),C3(R,.78,k,Math.PI),.03)}
  tri(0,Rr=>{const d=R*.5+.02;m.plate([[-.30,d,.48],[.30,d,.48],[.42,d,.95],[-.42,d,.95]].map(Rr))});
  return m.out()
}
// T4 · TALON — strike. Inverted frame; forward blade panels at the corners.
function cageTalon(){
  const m=M('T4 · Talon — strike (frame + forward corner blades)');
  pod(m,{tip:-1.0,r1:.30,r2:.36,r3:.26,z3:.66});
  const R=1.2;frame(m,R,.10,Math.PI);
  tri(Math.PI,Rr=>{
    beam(m,Rr([0,.36,.1]),Rr([0,R-.05,.1]),.035);
    m.plate([[0,R-.10,.30],[.10,R+.12,.05],[0,R+.02,-1.05],[-.10,R+.12,.05]].map(Rr));
  });
  return m.out()
}
// T5 · SENTRY — security (the Halo, kept as the family's plain reference).
// T6 · WARFRONT — rogue heavy. Frame with armoured gun pods on the corners.
function cageWar(){
  const m=M('T6 · Warfront — rogue heavy (frame + corner gun pods)');
  m.loft([[0,0,-.9],ring(.32,-.45,3,Math.PI/2),ring(.44,.25,3,Math.PI/2),ring(.28,.70,3,Math.PI/2)]);
  const R=1.2;frame(m,R,.05,Math.PI,.05);
  tri(Math.PI,Rr=>{
    beam(m,Rr([0,.30,.05]),Rr([0,R-.12,.05]),.05);
    const sq=(z,s)=>[[-s,R-s,z],[s,R-s,z],[s,R+s,z],[-s,R+s,z]].map(Rr);
    m.loft([sq(-.50,.09),sq(-.32,.15),sq(.42,.15),sq(.54,.10)]);
    beam(m,Rr([0,R,-.50]),Rr([0,R,-1.05]),.028);
  });
  return m.out()
}

// ===== Tricage family: three tangent panels on struts, no frame =====
const OCT=[[-.40,-.72],[.40,-.72],[.70,-.20],[.70,.40],[.40,.70],[-.40,.70],[-.70,.40],[-.70,-.20]]; // (tangent,z)
function tc(name,{d=1.0,shape=OCT,zc=0,tilt=0,thick=0,base=UP,strutW=.05,strutZ=0,diag=true,podOpts={tip:-1.05,r1:.34,r2:.40,r3:.28,z3:.66},extra=null,core=null}={}){
  const m=M(name);
  if(core)core(m);else pod(m,podOpts);
  const a=tilt*Math.PI/180;
  const P=(t,z,dy=0)=>{const dz=z-zc;return[t,d+dz*Math.sin(a)+dy*Math.cos(a),zc+dz*Math.cos(a)-dy*Math.sin(a)]};
  tri(base,(R,k)=>{
    beam(m,R([0,.34,strutZ]),R(P(0,strutZ)),strutW);
    if(thick>0){
      const outer=shape.map(([t,z])=>R(P(t,z,thick*.5))),inner=shape.map(([t,z])=>R(P(t*.92,z*.92,-thick*.5)));
      m.loft([inner,outer]);
    }else{
      const ids=m.plate(shape.map(([t,z])=>R(P(t,z))));
      if(diag&&shape.length===8){m.E(ids[0],ids[4]);m.E(ids[1],ids[5])}
    }
    if(extra)extra(m,R,P,k);
  });
  return m.out()
}
const cageModels=[
  tc('V1 · Tricage — standard (as drawn)'),
  tc('V2 · Tricage Bulwark — heavy (thick armour panels, closer in)',{d:.86,thick:.10,strutW:.07,podOpts:{tip:-.9,r1:.36,r2:.44,r3:.32,z3:.6},
     shape:[[-.46,-.66],[.46,-.66],[.72,-.16],[.72,.36],[.46,.66],[-.46,.66],[-.72,.36],[-.72,-.16]]}),
  tc('V3 · Tricage Lance — fast (long narrow panels, needle)',{d:.78,zc:.25,strutZ:.2,
     shape:[[-.20,-.95],[.20,-.95],[.34,-.55],[.34,.90],[.20,1.15],[-.20,1.15],[-.34,.90],[-.34,-.55]],
     core:m=>m.loft([[0,0,-1.9],ring(.16,-.9,6,Math.PI/2),ring(.26,-.1,6,Math.PI/2),ring(.26,.7,6,Math.PI/2),ring(.16,1.0,6,Math.PI/2)])}),
  tc('V4 · Tricage Maw — strike (panels canted in at the front)',{tilt:24}),
  tc('V5 · Tricage Scanner — security (panels flared out at the front)',{tilt:-26,
     shape:[[-.45,-.62],[.45,-.62],[.66,-.30],[.66,.30],[.45,.62],[-.45,.62],[-.66,.30],[-.66,-.30]]}),
  tc('V6 · Tricage Gunship — rogue heavy (point down, panel-mounted guns)',{base:DOWN,strutW:.06,
     extra:(m,R,P)=>{beam(m,R(P(0,-.2,.10)),R(P(0,-1.25,.10)),.035);beam(m,R(P(0,.45,.10)),R(P(0,-.2,.10)),.06)}}),
  tc('V7 · Tricage Split — scout (twin panels per strut)',{diag:false,
     shape:[[-.62,-.72],[.62,-.72],[.62,-.08],[-.62,-.08]],
     extra:(m,R,P)=>{m.plate([[-.62,.12],[.62,.12],[.62,.62],[-.62,.62]].map(([t,z])=>R(P(t,z))))}}),
];

// ===== Round 2: shaped and folded Tricage panels =====
// Outline polygon in (u = across the panel, z = along it); fold(u) gives the inward
// offset toward the core, piecewise linear with breaks. The outline is clipped into
// planar strips at each break so every strip is a true flat plate (fold lines show).
function clipU(poly,lo,hi){
  const clip=(pts,keep,cut)=>{const out=[];for(let i=0;i<pts.length;i++){const a=pts[i],b=pts[(i+1)%pts.length],ia=keep(a),ib=keep(b);if(ia)out.push(a);if(ia!==ib){const t=(cut-a[0])/(b[0]-a[0]);out.push([cut,a[1]+(b[1]-a[1])*t])}}return out};
  let p=poly;if(lo>-1e8)p=clip(p,q=>q[0]>=lo,lo);if(hi<1e8)p=clip(p,q=>q[0]<=hi,hi);return p
}
function foldedPanel(m,R,{d=1.0,outline,breaks=[],fold=()=>0,zc=0}){
  const edges=[-1e9,...breaks,1e9];
  for(let i=0;i<edges.length-1;i++){
    const strip=clipU(outline,edges[i],edges[i+1]);if(strip.length<3)continue;
    m.plate(strip.map(([u,z])=>R([u,d-fold(u),z])))
  }
}
const pw=(pts)=>u=>{ // piecewise-linear fold from [[u,offset],...] (symmetric in |u|)
  const x=Math.abs(u);for(let i=0;i<pts.length-1;i++){const [a,fa]=pts[i],[b,fb]=pts[i+1];if(x<=b)return fa+(fb-fa)*(x-a)/(b-a)}return pts[pts.length-1][1]};
function tc2(name,panel,{base=UP,strutW=.05,strutZ=0,d=1.0,podOpts={tip:-1.05,r1:.34,r2:.40,r3:.28,z3:.66}}={}){
  const m=M(name);pod(m,podOpts);
  const k=panel.uScale??.8,f0=panel.fold||(()=>0);
  const P={...panel,outline:panel.outline.map(([u,z])=>[u*k,z]),breaks:(panel.breaks||[]).map(b=>b*k),fold:u=>f0(u/k)*(panel.foldGain??1.15)};
  tri(base,R=>{beam(m,R([0,.34,strutZ]),R([0,d-P.fold(0)-.03,strutZ]),strutW);foldedPanel(m,R,{d,...P})});
  return m.out()
}
const WIDE_OCT=[[-.45,-.75],[.45,-.75],[.80,-.25],[.80,.40],[.45,.72],[-.45,.72],[-.80,.40],[-.80,-.25]];
const round2=[
  tc2('N1 · Vader — outer thirds folded in (bat-wing head-on)',{outline:WIDE_OCT,breaks:[-.36,.36],fold:pw([[0,0],[.36,0],[.80,.34]])}),
  tc2('N2 · Arc — curved panels, a broken ring head-on',{outline:[[-.78,-.62],[.78,-.62],[.86,-.30],[.86,.50],[.78,.72],[-.78,.72],[-.86,.50],[-.86,-.30]],
       breaks:[-.58,-.24,.24,.58],fold:pw([[0,0],[.24,.03],[.58,.18],[.86,.42]])}),
  tc2('N3 · Arrow — arrowhead panel, notched tail, raised spine',{outline:[[0,-1.0],[.46,-.36],[.74,.62],[.32,.40],[0,.72],[-.32,.40],[-.74,.62],[-.46,-.36]],
       breaks:[0],fold:pw([[0,0],[.74,.24]])}),
  tc2('N4 · Bowtie — waisted at the strut, flared ends folded in',{outline:[[-.80,-.78],[.80,-.78],[.42,-.12],[.42,.12],[.80,.78],[-.80,.78],[-.42,.12],[-.42,-.12]],
       breaks:[-.42,.42],fold:pw([[0,0],[.42,0],[.80,.30]])}),
  tc2('N5 · Swallowtail — swept panel with forked trailing tips',{outline:[[-.30,-.85],[.30,-.85],[.76,.15],[.80,.95],[.46,.58],[-.46,.58],[-.80,.95],[-.76,.15]],
       breaks:[-.40,.40],fold:pw([[0,0],[.40,0],[.80,.22]])}),
  tc2('N6 · Crown — curved and tapered: narrow nose, wide flared tail',{outline:[[-.40,-.85],[.40,-.85],[.70,-.10],[.90,.62],[.60,.78],[-.60,.78],[-.90,.62],[-.70,-.10]],
       breaks:[-.55,-.20,.20,.55],fold:pw([[0,0],[.20,.02],[.55,.14],[.90,.40]])}),
];
const keepers=cageModels.filter(m=>/^V1|^V3/.test(m.name)).map(m=>({...m,name:m.name.replace('V1 · Tricage — standard (as drawn)','KEEP V1 · Tricage — standard').replace('V3 · Tricage Lance','KEEP V3 · Tricage Lance')}));
const models=[...keepers,...round2];
require('fs').writeFileSync('audition.json',JSON.stringify({models}));
for(const m of models)console.log(m.name,'e',m.e.length);
