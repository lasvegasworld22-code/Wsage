import * as THREE from 'three';

// Draw every moving robot with a small number of instanced batches, rather than
// a separate GPU draw for each finger-sized piece. Original rigs still animate
// and raycast; their transforms drive these visible instances each frame.
export class RobotBatcher{
 constructor(scene){this.scene=scene;this.geometry=new THREE.BoxGeometry(1,1,1);this.batches=[];this.roots=[];this.matrix=new THREE.Matrix4();}
 sync(roots){
  this.batches.forEach(b=>{this.scene.remove(b.mesh);b.mesh.dispose();});this.batches=[];this.roots=roots;
  const groups=new Map();
  roots.forEach(root=>root.traverse(part=>{if(!part.isMesh||part.geometry?.type!=='BoxGeometry')return;const m=part.material,key=m.type+':'+m.color.getHex();if(!groups.has(key))groups.set(key,{material:m,parts:[]});const size=part.geometry.parameters;groups.get(key).parts.push({object:part,size:new THREE.Vector3(size.width,size.height,size.depth)});part.visible=false;}));
  groups.forEach(({material,parts})=>{const mesh=new THREE.InstancedMesh(this.geometry,material,parts.length);mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);mesh.castShadow=true;mesh.receiveShadow=true;mesh.frustumCulled=false;this.scene.add(mesh);this.batches.push({mesh,parts});});
  this.update();
 }
 update(){this.roots.forEach(root=>root.updateMatrixWorld(true));this.batches.forEach(({mesh,parts})=>{parts.forEach((p,i)=>{this.matrix.copy(p.object.matrixWorld).scale(p.size);mesh.setMatrixAt(i,this.matrix);});mesh.instanceMatrix.needsUpdate=true;});}
 dispose(){this.batches.forEach(b=>{this.scene.remove(b.mesh);b.mesh.dispose();});this.geometry.dispose();this.batches=[];}
}