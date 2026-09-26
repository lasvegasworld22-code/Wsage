import * as THREE from 'three';
import PF from 'pathfinding';
import { animateRobot } from './characters';

export function surfaceHeight(x,z){
 let height=Math.sin(x*.035)*Math.cos(z*.025)*1.1+Math.sin((x-z)*.045)*.45+Math.cos(z*.08)*.22;
 if(x*x+z*z<100)height=Math.max(height,.55);
 if(Math.abs(x)<=41&&Math.abs(z+10)<=2||Math.abs(x+5)<=2&&Math.abs(z)<=26)height=Math.max(height,.35);
 return height+.008;
}
export class NavigationGrid{
 constructor(buildings){this.buildings=buildings;this.cell=1.25;this.x0=-50;this.z0=-32;this.width=81;this.height=63;this.grid=new PF.Grid(this.width,this.height);for(let z=0;z<this.height;z++)for(let x=0;x<this.width;x++)this.grid.setWalkableAt(x,z,!this.blocked(this.x0+x*this.cell,this.z0+z*this.cell));this.finder=new PF.AStarFinder({allowDiagonal:true,dontCrossCorners:true});}
 blocked(x,z){if(Math.abs(x)>49||z<-31||z>44)return true;if(Math.hypot(x,z+21)<2)return true;return this.buildings.some(g=>{const dx=x-g.position.x,dz=z-g.position.z,c=Math.cos(g.rotation.y),s=Math.sin(g.rotation.y),lx=dx*c-dz*s,lz=dx*s+dz*c;return Math.abs(lx)<g.userData.width/2+.85&&lz>-g.userData.depth/2-.85&&lz<g.userData.depth/2+3.15;});}
 cellAt(p){return [THREE.MathUtils.clamp(Math.round((p.x-this.x0)/this.cell),0,this.width-1),THREE.MathUtils.clamp(Math.round((p.z-this.z0)/this.cell),0,this.height-1)];}
 path(start,end){const [sx,sz]=this.cellAt(start),[ex,ez]=this.cellAt(end);if(!this.grid.isWalkableAt(sx,sz)||!this.grid.isWalkableAt(ex,ez))return [];return PF.Util.compressPath(this.finder.findPath(sx,sz,ex,ez,this.grid.clone())).slice(1).map(([x,z])=>new THREE.Vector3(this.x0+x*this.cell,0,this.z0+z*this.cell));}
 wander(start){for(let i=0;i<14;i++){const angle=Math.random()*Math.PI*2,radius=6+Math.random()*10;const goal=new THREE.Vector3(THREE.MathUtils.clamp(start.x+Math.cos(angle)*radius,-37,38),0,THREE.MathUtils.clamp(start.z+Math.sin(angle)*radius,-16,30));const path=this.path(start,goal);if(path.length)return path;}return [];}
}
function turn(root,direction,delta){if(direction.lengthSq()<.000001)return;const angle=Math.atan2(direction.x,direction.z),diff=Math.atan2(Math.sin(angle-root.rotation.y),Math.cos(angle-root.rotation.y));root.rotation.y+=diff*(1-Math.exp(-9*delta));}
export function movePlayer(engine,delta,time){
 const blockedUI=!engine.entered||!!document.querySelector('[role="dialog"]');
 const x=(engine.keys.d||engine.keys.arrowright?1:0)-(engine.keys.a||engine.keys.arrowleft?1:0),z=(engine.keys.s||engine.keys.arrowdown?1:0)-(engine.keys.w||engine.keys.arrowup?1:0);
 const direction=new THREE.Vector3();if(!blockedUI&&(x||z)){const f=new THREE.Vector3();engine.camera.getWorldDirection(f);f.y=0;f.normalize();direction.set(-f.z,0,f.x).multiplyScalar(x).add(f.multiplyScalar(-z)).normalize().multiplyScalar(3.0);}
 engine.velocity.lerp(direction,1-Math.exp(-11*delta));const step=engine.velocity.clone().multiplyScalar(delta),old=engine.player.position.clone();
 if(!engine.navigation.blocked(old.x+step.x,old.z))engine.player.position.x+=step.x;
 if(!engine.navigation.blocked(engine.player.position.x,old.z+step.z))engine.player.position.z+=step.z;
 engine.player.position.y=surfaceHeight(engine.player.position.x,engine.player.position.z);
 const actual=engine.player.position.clone().sub(old);actual.y=0;turn(engine.player,actual,delta);animateRobot(engine.player,actual.length(),delta,time,engine.playerAgent?.status||'ACTIVE');
 if(engine.entered&&!engine.cameraTween){engine.camera.position.add(actual);engine.controls.target.add(actual);}
}
export function moveResidents(engine,delta,time){
 engine.agents.forEach(a=>{
  let distance=0;if(a.status==='ACTIVE'&&!a.hovered){
   if(!a.path?.length&&time>=a.waitUntil){a.path=engine.navigation.wander(a.g.position);a.waitUntil=time+2+Math.random()*3;}
   if(a.path?.length){const goal=a.path[0],dir=new THREE.Vector3(goal.x-a.g.position.x,0,goal.z-a.g.position.z),remaining=dir.length();a.speed=THREE.MathUtils.damp(a.speed||0,1.1+(a.index%3)*.12,5,delta);const amount=Math.min(a.speed*delta,remaining);dir.normalize();const next=a.g.position.clone().addScaledVector(dir,amount);if(engine.navigation.blocked(next.x,next.z)){a.path=[];a.waitUntil=time+.6;a.speed=0;}else{a.g.position.x=next.x;a.g.position.z=next.z;distance=amount;turn(a.g,dir,delta);if(remaining<.08){a.path.shift();if(!a.path.length){a.waitUntil=time+1.4+Math.random()*3;a.speed=0;}}}}
  }else{a.speed=0;if(a.status!=='ACTIVE')a.path=[];}
  a.g.position.y=surfaceHeight(a.g.position.x,a.g.position.z);animateRobot(a.g,distance,delta,time,a.status);a.moving=distance>.0005;
 });
}