'use strict';
class Camera {
  rx(p,a){const c=Math.cos(a),s=Math.sin(a);return[p[0],p[1]*c-p[2]*s,p[1]*s+p[2]*c]}
  ry(p,a){const c=Math.cos(a),s=Math.sin(a);return[p[0]*c+p[2]*s,p[1],-p[0]*s+p[2]*c]}
  rz(p,a){const c=Math.cos(a),s=Math.sin(a);return[p[0]*c-p[1]*s,p[0]*s+p[1]*c,p[2]]}
  rotate(p,r){p=rx(p,r[0]);p=ry(p,r[1]);return rz(p,r[2])}
  // v308: the world→camera transform is a 3×3 matrix that only changes when the
  // view does. It is cached and re-derived when any input differs, so camPoint is
  // one small allocation and nine multiply-adds instead of 3–4 arrays + 6 trig calls.
  camMatrix(){
    const free=spaceFreeOrientationActive(),k=this._key||(this._key=new Float64Array(13)),m=this._m||(this._m=new Float64Array(9));
    const R=spaceRight,U=spaceUp,Fw=spaceForward;
    if(this._ok&&k[0]===(free?1:0)&&k[1]===viewRoll&&(free
      ?(k[2]===R[0]&&k[3]===R[1]&&k[4]===R[2]&&k[5]===U[0]&&k[6]===U[1]&&k[7]===U[2]&&k[8]===Fw[0]&&k[9]===Fw[1]&&k[10]===Fw[2])
      :(k[11]===viewYaw&&k[12]===viewPitch)))return m;
    const cr=Math.cos(-viewRoll),sr=Math.sin(-viewRoll);
    let b00,b01,b02,b10,b11,b12,b20,b21,b22;
    if(free){
      b00=R[0];b01=R[1];b02=R[2];b10=U[0];b11=U[1];b12=U[2];b20=Fw[0];b21=Fw[1];b22=Fw[2];
      k[2]=R[0];k[3]=R[1];k[4]=R[2];k[5]=U[0];k[6]=U[1];k[7]=U[2];k[8]=Fw[0];k[9]=Fw[1];k[10]=Fw[2];
    }else{
      // rx(-pitch)·ry(-yaw)
      const cy=Math.cos(-viewYaw),sy=Math.sin(-viewYaw),cp=Math.cos(-viewPitch),sp=Math.sin(-viewPitch);
      b00=cy;b01=0;b02=sy;
      b10=sp*sy;b11=cp;b12=-sp*cy;
      b20=-cp*sy;b21=sp;b22=cp*cy;
      k[11]=viewYaw;k[12]=viewPitch;
    }
    // then rz(-roll)
    m[0]=cr*b00-sr*b10;m[1]=cr*b01-sr*b11;m[2]=cr*b02-sr*b12;
    m[3]=sr*b00+cr*b10;m[4]=sr*b01+cr*b11;m[5]=sr*b02+cr*b12;
    m[6]=b20;m[7]=b21;m[8]=b22;
    k[0]=free?1:0;k[1]=viewRoll;this._ok=true;return m
  }
  camPoint(p){
    const m=this.camMatrix(),dx=p[0]-shipX,dy=p[1]-shipY,dz=p[2];
    return[m[0]*dx+m[1]*dy+m[2]*dz,m[3]*dx+m[4]*dy+m[5]*dz,m[6]*dx+m[7]*dy+m[8]*dz]
  }
  camPointOld(p){
    const d=[p[0]-shipX,p[1]-shipY,p[2]];
    if(spaceFreeOrientationActive()){
      let q=[v3dot(d,spaceRight),v3dot(d,spaceUp),v3dot(d,spaceForward)];
      q=rz(q,-viewRoll);
      return q
    }
    let q=d;
    q=ry(q,-viewYaw);
    q=rx(q,-viewPitch);
    q=rz(q,-viewRoll);
    return q
  }
  proj(p){const q=camPoint(p);if(q[2]<=.18)return null;const f=Math.min(W,viewH)*1.09;return{x:W*.5+q[0]*f/q[2],y:viewH*.48-q[1]*f/q[2],z:q[2],k:f/q[2]}}
  projectCam(q){if(q[2]<=.18)return null;const f=Math.min(W,viewH)*1.09;return{x:W*.5+q[0]*f/q[2],y:viewH*.48-q[1]*f/q[2],z:q[2],k:f/q[2]}}
  clipWorldPolyNear(worldPts,near=.42){
 // Sutherland-Hodgman clip in camera space. This is used for large fixed
 // architectural faces that can legitimately straddle the camera near plane.
 // Projecting first and merely dropping null corners produces huge skewed polygons.
 let q=worldPts.map(camPoint),out=[];
 for(let i=0;i<q.length;i++){
   const a=q[i],b=q[(i+1)%q.length],ain=a[2]>near,bin=b[2]>near;
   if(ain)out.push(a);
   if(ain!==bin){
     const t=(near-a[2])/(b[2]-a[2]);
     out.push([lerp(a[0],b[0],t),lerp(a[1],b[1],t),near]);
   }
 }
 return out.map(projectCam).filter(Boolean)
}
}

