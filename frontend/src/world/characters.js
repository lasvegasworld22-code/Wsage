import * as THREE from 'three';
import { Agent3Assets as A } from './assets3d';

// Retain stored avatar IDs while moving the visual palette toward the desert.
export const colors={mint:'#dbbc96',coral:'#d89780',blue:'#91b9cd',gold:'#e2bd72',violet:'#b8a4c3',white:'#e9e4d9'};
export function createRobot(avatar='mint',player=false){
 const root=new THREE.Group(),body=new THREE.Group();root.add(body);
 const shell=A.mat(colors[avatar]||colors.mint),dark=A.mat('#39373c');
 const eye=new THREE.MeshBasicMaterial({color:player?'#fff0cc':'#e7f1fa'});
 function box(parent,w,h,d,mat,x,y,z){const m=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),mat);m.position.set(x,y,z);parent.add(m);return m;}
 box(body,.82,.75,.56,shell,0,1.13,0);box(body,1.13,.83,.77,shell,0,1.94,0);
 const face=box(body,.93,.5,.035,dark,0,1.96,.402);
 [-1,1].forEach(s=>box(body,.16,.12,.035,eye,s*.23,1.99,.427));box(body,.23,.035,.035,eye,0,1.78,.427);
 box(body,.04,.26,.04,dark,0,2.49,0);box(body,.13,.11,.13,eye,0,2.66,0);box(body,.22,.09,.025,eye,0,1.19,.294);
 const legs=[-1,1].map(s=>{const pivot=new THREE.Group();pivot.position.set(s*.245,.76,0);root.add(pivot);box(pivot,.25,.54,.29,dark,0,-.28,0);const boot=box(pivot,.31,.2,.49,shell,0,-.65,.09);pivot.userData.boot=boot;return pivot;});
 const arms=[-1,1].map(s=>{const pivot=new THREE.Group();pivot.position.set(s*.58,1.5,0);body.add(pivot);box(pivot,.22,.54,.29,shell,0,-.26,0);return pivot;});
 const ring=new THREE.Mesh(new THREE.RingGeometry(.74,.78,36),new THREE.MeshBasicMaterial({color:player?'#f5d6ac':colors[avatar],transparent:true,opacity:player?.45:.24,side:THREE.DoubleSide,depthWrite:false}));ring.rotation.x=-Math.PI/2;ring.position.y=.009;root.add(ring);
 const canvas=document.createElement('canvas');canvas.width=64;canvas.height=64;const ctx=canvas.getContext('2d'),gradient=ctx.createRadialGradient(32,32,4,32,32,31);gradient.addColorStop(0,'rgba(45,32,23,.25)');gradient.addColorStop(1,'rgba(45,32,23,0)');ctx.fillStyle=gradient;ctx.fillRect(0,0,64,64);
 const shadow=new THREE.Mesh(new THREE.PlaneGeometry(1.35,1.1),new THREE.MeshBasicMaterial({map:new THREE.CanvasTexture(canvas),transparent:true,depthWrite:false}));shadow.rotation.x=-Math.PI/2;shadow.position.y=.006;root.add(shadow);
 root.userData={legs,arms,body,face,ring,phase:0,gaitBlend:0};A.withShadow(root);ring.castShadow=false;shadow.castShadow=false;return root;
}

export function animateRobot(root,distance,delta,time,status='ACTIVE'){
 const p=root.userData,moving=distance>.0005;p.phase+=distance/1.12*Math.PI*2;
 p.gaitBlend=THREE.MathUtils.damp(p.gaitBlend,moving?1:0,12,delta);
 p.legs.forEach((leg,i)=>{const phase=p.phase+i*Math.PI,swing=Math.sin(phase),lift=Math.max(0,Math.cos(phase));leg.position.z=swing*.23*p.gaitBlend;leg.position.y=.76+lift*.09*p.gaitBlend;leg.rotation.x=-swing*.12*p.gaitBlend;leg.userData.boot.rotation.x=-leg.rotation.x;});
 p.body.position.y=Math.abs(Math.sin(p.phase*2))*.018*p.gaitBlend;
 p.body.rotation.z=Math.sin(p.phase)*.018*p.gaitBlend;
 p.arms.forEach((arm,i)=>{const target=status==='WORKING'?-.65+Math.sin(time*4+i)*.13:Math.sin(p.phase+i*Math.PI)*.3*p.gaitBlend;arm.rotation.x=THREE.MathUtils.damp(arm.rotation.x,target,10,delta);});
 p.body.rotation.x=THREE.MathUtils.damp(p.body.rotation.x,status==='SLEEPING'?.08:0,3,delta);
 p.ring.material.opacity=status==='WORKING'?.3+Math.sin(time*3)*.14:.24;
}

export function addLamp(scene,x,z){const g=new THREE.Group();g.position.set(x,.4,z);const pole=new THREE.Mesh(new THREE.CylinderGeometry(.065,.10,3.5,8),A.mat('#625d58'));pole.position.y=1.75;g.add(pole);const glass=new THREE.Mesh(new THREE.BoxGeometry(.36,.50,.36),new THREE.MeshBasicMaterial({color:'#fff0b6'}));glass.position.y=3.5;g.add(glass);const cap=new THREE.Mesh(new THREE.ConeGeometry(.35,.25,4),A.mat('#46434a'));cap.position.y=3.87;cap.rotation.y=Math.PI/4;g.add(cap);scene.add(A.withShadow(g));}