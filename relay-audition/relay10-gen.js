'use strict';
// Relay 10 dressing auditions. Station-local coords: Z up, approach from +X,
// data terminal on the +Y wall (keep +Y clear), pad 03 approach from +X/-Y high.
const base=JSON.parse(require('fs').readFileSync('base.json','utf8')).models[0];
function M(name){
  const v=base.v.map(p=>p.slice()),e=base.e.map(x=>x.slice()),faces=(base.faces||[]).map(f=>f.slice()),es=new Set(e.map(([a,b])=>a<b?`${a},${b}`:`${b},${a}`));
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
    if(capEnd&&idx[idx.length-1].length>2)F(idx[idx.length-1]);return idx};
  const plate=pts=>{const ids=pts.map(V);F(ids);return ids};
  const line=(a,b)=>E(V(a),V(b));
  return{name,v,e,faces,V,E,F,loft,plate,line,out(){return{name,v,e,faces}}}
}
const ringZ=(cx,cy,z,r,n,off=0)=>Array.from({length:n},(_,i)=>{const t=off+2*Math.PI*i/n;return[cx+Math.cos(t)*r,cy+Math.sin(t)*r,z]});
const box=(m,x0,x1,y0,y1,z0,z1)=>m.loft([[[x0,y0,z0],[x1,y0,z0],[x1,y1,z0],[x0,y1,z0]],[[x0,y0,z1],[x1,y0,z1],[x1,y1,z1],[x0,y1,z1]]]);
function beam(m,a,b,w=.04){
  const d=a.map((x,i)=>b[i]-x),L=Math.hypot(...d),u=d.map(x=>x/L);
  let r=Math.abs(u[2])<.9?[u[1],-u[0],0]:[1,0,0];const rl=Math.hypot(...r);r=r.map(x=>x/rl);
  const s=[u[1]*r[2]-u[2]*r[1],u[2]*r[0]-u[0]*r[2],u[0]*r[1]-u[1]*r[0]];
  const sq=p=>[[-1,-1],[1,-1],[1,1],[-1,1]].map(([i,j])=>p.map((x,k)=>x+r[k]*i*w+s[k]*j*w));m.loft([sq(a),sq(b)])
}
// Vertical tank: octagonal cylinder with domed ends.
const tank=(m,x,y,z0,z1,r)=>m.loft([[x,y,z0-r*.45],ringZ(x,y,z0,r,8,Math.PI/8),ringZ(x,y,z1,r,8,Math.PI/8),[x,y,z1+r*.45]]);
// Square lattice mast from z0 to z1, legs tapering from w0 to w1, zig-zag bracing.
function lattice(m,x,y,z0,z1,w0,w1,bays){
  const leg=(sx,sy,z)=>{const w=w0+(w1-w0)*(z-z0)/(z1-z0);return[x+sx*w,y+sy*w,z]};
  const corners=[[-1,-1],[1,-1],[1,1],[-1,1]];
  for(const [sx,sy] of corners)beam(m,leg(sx,sy,z0),leg(sx,sy,z1),.025);
  for(let i=0;i<=bays;i++){const z=z0+(z1-z0)*i/bays;for(let k=0;k<4;k++){const a=corners[k],b=corners[(k+1)%4];m.line(leg(a[0],a[1],z),leg(b[0],b[1],z));
    if(i<bays){const z2=z0+(z1-z0)*(i+1)/bays;m.line(leg(a[0],a[1],z),leg(b[0],b[1],z2))}}}
}
// Parabolic-ish dish: shallow octagonal cone facing direction (dx,dy,dz), with a feed horn.
function dish(m,c,dir,r){
  const n=Math.hypot(...dir),d=dir.map(x=>x/n);let u=Math.abs(d[2])<.9?[0,0,1]:[1,0,0];
  let a=[d[1]*u[2]-d[2]*u[1],d[2]*u[0]-d[0]*u[2],d[0]*u[1]-d[1]*u[0]];const al=Math.hypot(...a);a=a.map(x=>x/al);
  const b=[d[1]*a[2]-d[2]*a[1],d[2]*a[0]-d[0]*a[2],d[0]*a[1]-d[1]*a[0]];
  const ring=(rr,off)=>Array.from({length:10},(_,i)=>{const t=2*Math.PI*i/10;return c.map((x,k)=>x+d[k]*off+a[k]*Math.cos(t)*rr+b[k]*Math.sin(t)*rr)});
  m.loft([c.map((x,k)=>x-d[k]*.02),ring(r*.45,r*.12),ring(r,r*.34)],{capEnd:false});
  const tip=c.map((x,k)=>x+d[k]*r*.9);for(const t of[0,2*Math.PI/3,4*Math.PI/3])m.line(c.map((x,k)=>x+d[k]*r*.34+a[k]*Math.cos(t)*r+b[k]*Math.sin(t)*r),tip);
}

// A · TRUCK-STOP PYLON — a roadside sign on a tall pylon facing the approach,
// a tank farm behind the hub, and a beacon on top. Reads as "fuel · freight · food".
function pylon(){
  const m=M('A · Truck-stop pylon — sign facing the approach, tank farm aft');
  beam(m,[-.55,0,1.1],[-.55,0,4.0],.09);
  // Sign board: double-faced box facing ±X, framed.
  box(m,-.66,-.44,-1.25,1.25,3.3,4.55);
  m.plate([[-.43,-1.1,3.45],[-.43,1.1,3.45],[-.43,1.1,4.4],[-.43,-1.1,4.4]]);
  m.line([-.43,-1.1,3.78],[-.43,1.1,3.78]);
  // Beacon on top.
  m.loft([[-.55,0,4.55],ringZ(-.55,0,4.72,.1,6),[-.55,0,4.95]]);
  // Tank farm on -X, joined by a manifold pipe.
  for(const [x,y] of [[-2.7,-.75],[-2.7,.75],[-3.55,-.75],[-3.55,.75]])tank(m,x,y,-.35,1.0,.36);
  beam(m,[-1.9,0,.1],[-3.9,0,.1],.05);for(const [x,y] of [[-2.7,-.75],[-2.7,.75],[-3.55,-.75],[-3.55,.75]])beam(m,[x,0,.1],[x,y*.55,.1],.03);
  // Service mast below.
  beam(m,[0,0,-.62],[0,0,-1.9],.05);m.loft([[0,0,-1.9],ringZ(0,0,-2.05,.12,6),[0,0,-2.3]]);
  return m.out()
}
// B · COMMS RELAY — a tall lattice mast with two dishes and a long antenna spike
// below: the "relay" in Relay 10. Solar wing aft for bulk.
function relay(){
  const m=M('B · Comms relay — lattice mast, dishes, solar wing aft');
  lattice(m,-.45,0,1.1,5.4,.34,.12,7);
  dish(m,[-.45,.36,3.0],[1,.6,.15],.62);dish(m,[-.45,-.36,4.1],[1,-.5,.2],.48);
  m.loft([[-.45,0,5.4],ringZ(-.45,0,5.55,.09,6),[-.45,0,5.85]]);
  beam(m,[0,0,-.62],[0,0,-3.2],.035);for(const z of[-1.4,-2.2])m.loft([ringZ(0,0,z,.18,6),ringZ(0,0,z-.08,.18,6)]);
  // Solar wing: truss out to -X with two panel arrays.
  beam(m,[-1.9,0,.3],[-6.2,0,.3],.05);
  for(const [x0,x1] of [[-2.4,-4.1],[-4.4,-6.1]])for(const s of[-1,1]){
    const P=[[x0,s*.15,.3],[x1,s*.15,.3],[x1,s*1.35,.3],[x0,s*1.35,.3]];const ids=m.plate(P);
    for(let k=1;k<4;k++){const x=x0+(x1-x0)*k/4;m.line([x,s*.15,.301],[x,s*1.35,.301])}
  }
  return m.out()
}
// C · FREIGHT YARD — a long spine aft carrying container stacks and a gantry crane,
// with a short sign pylon. Busy, industrial, reads as a working truck stop.
function yard(){
  const m=M('C · Freight yard — container spine aft, gantry, sign pylon');
  beam(m,[-1.9,-.3,.0],[-6.6,-.3,.0],.06);beam(m,[-1.9,.3,.0],[-6.6,.3,.0],.06);
  for(let x=-2.2;x>=-6.4;x-=.7)beam(m,[x,-.3,0],[x,.3,0],.035);
  let k=0;for(let x=-2.4;x>=-6.0;x-=.9){for(const s of[-1,1]){const h=(k++%3===0)?2:1;for(let j=0;j<h;j++)box(m,x-.38,x+.38,s*.34,s*.34+s*.62,-.2+j*.46,.24+j*.46)}}
  // Gantry crane spanning the spine.
  for(const s of[-1,1])beam(m,[-4.6,s*1.2,-.3],[-4.6,s*1.2,1.5],.05);beam(m,[-4.6,-1.25,1.5],[-4.6,1.25,1.5],.06);box(m,-4.72,-4.48,-.2,.2,1.25,1.45);
  // Sign pylon.
  beam(m,[-.55,0,1.1],[-.55,0,3.1],.08);box(m,-.64,-.46,-.95,.95,2.6,3.5);m.plate([[-.45,-.82,2.72],[-.45,.82,2.72],[-.45,.82,3.38],[-.45,-.82,3.38]]);
  return m.out()
}
const models=[base,pylon(),relay(),yard()].map((m,i)=>i?m:{...m,name:'Current · Relay 10 as built'});
// Convert station-local (Z up, approach from +X) to viewer coords (Y up, camera on -Z).
const conv=p=>[-p[1],p[2],-p[0]];
require('fs').writeFileSync('audition.json',JSON.stringify({models:models.map(m=>({name:m.name,v:m.v.map(conv),e:m.e,faces:m.faces}))}));
for(const m of models)console.log(m.name,'e',m.e.length);
