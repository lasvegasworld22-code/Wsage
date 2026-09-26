import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

// Bake fixed scenery by material. Keep invisible original meshes for raycast interactions.
export function batchScenery(scene,player){
 scene.updateMatrixWorld(true);const groups=new Map();
 scene.traverse(object=>{
  if(!object.isMesh||Array.isArray(object.material)||object.material.map||object.material.transparent)return;
  let parent=object;while(parent){if(parent===player)return;parent=parent.parent;}
  const material=object.material,key=[material.type,material.color?.getHex(),material.roughness,material.metalness,material.emissive?.getHex(),material.side].join(':');
  if(!groups.has(key))groups.set(key,{material,objects:[],geometries:[]});
  const geometry=object.geometry.index?object.geometry.toNonIndexed():object.geometry.clone();geometry.applyMatrix4(object.matrixWorld);
  groups.get(key).objects.push(object);groups.get(key).geometries.push(geometry);
 });
 groups.forEach(({material,objects,geometries})=>{if(objects.length<2){geometries.forEach(g=>g.dispose());return;}const geometry=mergeGeometries(geometries,false);if(geometry){const mesh=new THREE.Mesh(geometry,material);mesh.castShadow=objects.some(o=>o.castShadow);mesh.receiveShadow=true;mesh.matrixAutoUpdate=false;mesh.updateMatrix();scene.add(mesh);objects.forEach(o=>{o.visible=false;});}geometries.forEach(g=>g.dispose());});
}