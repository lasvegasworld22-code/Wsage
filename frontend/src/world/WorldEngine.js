import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { Agent3Assets as A } from './assets3d';
import { createRobot, addLamp } from './characters';
import { NavigationGrid, surfaceHeight, movePlayer, moveResidents } from './locomotion';
import { batchScenery } from './optimize';
import { RobotBatcher } from './RobotBatcher';
import { walletAgent } from '../lib/agentIdentity';
import { projectUpdates, exchangeBillboard } from '../lib/projectUpdates';

export class WorldEngine {
  constructor(container, labels, onInteract) {
    this.container=container; this.labels=labels; this.onInteract=onInteract; this.agents=new Map(); this.targets=[]; this.keys={}; this.labelItems=[]; this.clock=new THREE.Clock(); this.frame=0;this.entered=false;this.velocity=new THREE.Vector3();this.cameraTween=null;this.lastTelemetry=0;
    this.scene=new THREE.Scene(); this.scene.background=new THREE.Color('#c4c0bf'); this.scene.fog=new THREE.Fog('#ccc5bd',90,190);
    this.renderer=new THREE.WebGLRenderer({antialias:true, powerPreference:'high-performance',preserveDrawingBuffer:true});
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio,1.25)); this.renderer.shadowMap.enabled=true; this.renderer.shadowMap.type=THREE.PCFShadowMap;
    this.renderer.toneMapping=THREE.ACESFilmicToneMapping;this.renderer.toneMappingExposure=1.32;
    this.renderer.domElement.setAttribute('data-testid','world-canvas'); container.appendChild(this.renderer.domElement);
    this.camera=new THREE.PerspectiveCamera(43,1,.1,260);
    this.controls=new OrbitControls(this.camera,this.renderer.domElement);this.controls.enableDamping=true;this.controls.enablePan=false;this.controls.minDistance=19;this.controls.maxDistance=104;this.controls.minPolarAngle=.25;this.controls.maxPolarAngle=1.34;this.controls.rotateSpeed=.45;
    this.controls.enabled=false;this.home(); this.buildWorld();batchScenery(this.scene,this.player);this.navigation=new NavigationGrid(this.targets.filter(t=>t.userData.route));this.player.position.y=surfaceHeight(this.player.position.x,this.player.position.z);this.robotBatcher=new RobotBatcher(this.scene);this.robotBatcher.sync([this.player]);this.setupEvents(); this.resize();this.animate();
  }
  home(){this.cameraTween=null;this.focusedAgentId=null;this.camera.position.set(27,43,65);this.controls.target.set(0,1,-8);this.controls.update();}
  focusPlayer(){
    if(!this.entered||!this.playerAgent)return false;
    this.keys={};this.velocity.set(0,0,0);this.focusedAgentId=this.playerAgent.id;
    const mobile=window.innerWidth<700,offset=new THREE.Vector3(0,mobile?23:15,mobile?33:23),target=this.player.position.clone().add(new THREE.Vector3(0,1.3,0));
    this.cameraTween={start:this.clock.elapsedTime,duration:window.matchMedia('(prefers-reduced-motion: reduce)').matches?0:1,from:this.camera.position.clone(),fromTarget:this.controls.target.clone(),to:this.player.position.clone().add(offset),target,followPlayer:true,offset};
    return true;
  }
  setEntered(entered){if(this.entered===entered)return;this.entered=entered;this.controls.enabled=entered;this.keys={};this.velocity.set(0,0,0);const mobile=window.innerWidth<700;this.cameraTween={start:this.clock.elapsedTime,from:this.camera.position.clone(),fromTarget:this.controls.target.clone(),to:entered?new THREE.Vector3(mobile?24:23,mobile?42:36,mobile?61:54):new THREE.Vector3(32,46,73),target:new THREE.Vector3(0,1,entered?-5:-8)};}
  buildWorld(){
    this.scene.add(new THREE.AmbientLight('#fff4e3',1.0),new THREE.HemisphereLight('#e3edff','#a68862',2));
    const sun=new THREE.DirectionalLight('#fff0d4',3);sun.position.set(-25,55,35);sun.castShadow=true;sun.shadow.mapSize.set(1024,1024);Object.assign(sun.shadow.camera,{left:-65,right:65,top:55,bottom:-55,near:.1,far:150});sun.shadow.bias=-.0004;sun.shadow.normalBias=.04;this.scene.add(sun);
    const terrain=A.createDesertTerrain(240);this.scene.add(terrain.group,A.createHorizonBand());
    [[0,-10,82,4],[-5,0,4,52]].forEach(([x,z,w,d])=>{const p=new THREE.Mesh(new THREE.PlaneGeometry(w,d),A.mat('#e5cda6'));p.rotation.x=-Math.PI/2;p.position.set(x,.35,z);p.receiveShadow=true;this.scene.add(p);});
    // Original Agent.ws buildings, positions and architecture retained from agentws.fun.
    this.building('AGENT EXCHANGE',0,-2,10,7,4.5,'#c28d69','exchange');
    this.building('LAND OFFICES',31,-17,8.5,6,4,'#bd9a71','create',-.12);
    this.building('SKILLS HALL',-34,-15,7.5,5.5,3.7,'#a4b4bb','skills',.14);
    this.building('RESEARCH LAB',-20,8,8,5.5,4,'#87a6ad','agents');
    this.building('WORK ARCHIVE',21,8,8,5.5,3.9,'#aa9baf','work-feed',-.10);
    const boards=[{x:-18,kind:'news',title:'NEWS FEED',entries:projectUpdates,route:'news'},{x:18,kind:'chapter',title:exchangeBillboard.title,subtitle:exchangeBillboard.description,entries:[exchangeBillboard.tagline],route:'exchange'}];
    boards.forEach(({x,...content})=>{const b=A.createBillboard({...content,width:18,height:9});b.position.set(x,.3,-24);b.userData={route:content.route,billboard:true,width:18,depth:1};this.scene.add(b);this.targets.push(b);this.addLabel(b,content.kind==='news'?'News Feed':'The next chapter','billboard-'+content.kind,()=>this.onInteract({type:'building',id:content.route}),'building-label',15);});
    this.renderer.domElement.dataset.billboards=JSON.stringify({left:{title:'NEWS FEED',releases:projectUpdates},right:exchangeBillboard});
    const pedestal=A.createPedestal();pedestal.scale.set(.58,.45,.58);pedestal.position.set(0,.4,-21);this.scene.add(pedestal);
    // Replace the reference kit's old three.ws lettering with Agent.ws identity.
    const old=pedestal.children[pedestal.children.length-1];pedestal.remove(old);
    const mark=A.createTextSprite('A',{fontSize:80,color:'#fff0d9',bg:'rgba(0,0,0,0)',scale:[3,3,1]});mark.position.set(0,16,.45);pedestal.add(mark);
    const cactus=[[-42,-3,.9],[-32,11,1.1],[39,-5,1],[47,-20,.7],[26,19,.8],[-18,-34,.85],[-13,22,.6],[8,19,.6],[44,18,1],[-42,22,.6]];
    cactus.forEach(([x,z,s])=>{let c=A.createCactus(s);c.position.set(x,.35,z);this.scene.add(c);});
    [[-28,-8],[25,-9],[45,2],[-45,-22],[15,21],[-12,-35],[36,-28],[-26,21],[36,18]].forEach(([x,z])=>{const rock=A.createLowPolyRock(.7);rock.position.set(x,.7,z);this.scene.add(rock);});
    [[-8,-4],[8,-4],[-15,-16],[15,-16],[29,-12],[-31,-11],[-11,9],[12,9],[-5,19]].forEach(([x,z])=>addLamp(this.scene,x,z));
    for(let i=0;i<5;i++){const fence=new THREE.Mesh(new THREE.BoxGeometry(5,.15,.15),A.mat('#a78f70'));fence.position.set(-39+i*5,1.2,-7);this.scene.add(fence);const post=new THREE.Mesh(new THREE.BoxGeometry(.17,1.5,.17),A.mat('#a78f70'));post.position.set(-41+i*5,.8,-7);this.scene.add(post);}
    this.player=createRobot('white',true);this.player.position.set(0,.5,12);this.scene.add(this.player);
    this.playerLabel=this.addLabel(this.player,'YOU','you',()=>{},'player-label',3.1);
    const coords=new Float32Array(160*3);for(let i=0;i<coords.length;i+=3){coords[i]=(Math.random()-.5)*110;coords[i+1]=Math.random()*8+1;coords[i+2]=(Math.random()-.5)*80;}
    const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.BufferAttribute(coords,3));this.dust=new THREE.Points(geo,new THREE.PointsMaterial({color:'#fff9db',size:.055,transparent:true,opacity:.55}));this.scene.add(this.dust);
  }
  building(name,x,z,width,depth,height,color,route,rotation=0){
    const g=A.createWesternBuilding({label:name,color,trim:'#75624e',width,depth,height});g.position.set(x,.45,z);g.rotation.y=rotation;this.scene.add(g);g.userData={route,width,depth};this.targets.push(g);
    this.addLabel(g,name,route,()=>this.onInteract({type:'building',id:route}),'building-label',height+2.8);
  }
  addLabel(object,text,id,click,className,height){
    const b=document.createElement('button');b.className='world-label '+className;b.dataset.testid='world-'+id;b.textContent=text;b.onclick=click;b.setAttribute('aria-label',text);this.labels.appendChild(b);this.labelItems.push({object,element:b,height});return b;
  }
  updatePlayer(agent,wallet){
    const avatar=agent?.avatar||'white',identity=agent?.id||wallet?.id||'guest';
    const changed=this.playerIdentity!==identity||this.playerAvatar!==avatar;
    if(changed){
      const old=this.player,next=createRobot(avatar,true);next.position.copy(old.position);next.rotation.copy(old.rotation);
      this.scene.remove(old);this.targets=this.targets.filter(t=>t!==old);
      this.labelItems.forEach(l=>{if(l.object===old)l.object=next;});
      this.player=next;this.scene.add(next);this.playerIdentity=identity;this.playerAvatar=avatar;
      this.keys={};this.velocity.set(0,0,0);
      old.traverse(o=>{o.geometry?.dispose();if(o.material)(Array.isArray(o.material)?o.material:[o.material]).forEach(m=>{m.map?.dispose();m.dispose();});});
    }
    this.playerAgent=agent||null;
    if(this.focusedAgentId&&this.focusedAgentId!==agent?.id){this.focusedAgentId=null;this.cameraTween=null;}
    this.player.userData.agentId=agent?.id;
    if(agent&&!this.targets.includes(this.player))this.targets.push(this.player);
    const name=agent?agent.name+(agent.status==='WORKING'?' · WORKING':''):wallet?'EXPLORER':'YOU';
    this.playerLabel.textContent=name;this.playerLabel.dataset.testid=agent?'world-'+agent.id:wallet?'world-explorer':'world-you';
    this.playerLabel.dataset.agentId=agent?.id||'';this.playerLabel.dataset.avatar=avatar;this.playerLabel.dataset.status=agent?.status||'EXPLORING';
    this.playerLabel.setAttribute('aria-label',name);this.playerLabel.title=agent?agent.name+' · '+agent.status:wallet?'Create your agent':'Guest explorer';
    this.playerLabel.onclick=()=>{if(agent)this.onInteract({type:'agent',id:agent.id});else if(wallet)this.onInteract({type:'building',id:'create'});};
    return changed;
  }
  updateAgents(agents,wallet){
    const own=walletAgent(agents,wallet),playerChanged=this.updatePlayer(own,wallet);
    const residents=agents.filter(a=>a.id!==own?.id).slice(0,28);
    const previousRoster=[...this.agents.keys()].join(',');
    const visibleIds=new Set(residents.map(a=>a.id));
    this.agents.forEach((item,id)=>{if(!visibleIds.has(id)){this.scene.remove(item.g);this.targets=this.targets.filter(t=>t!==item.g);this.labelItems=this.labelItems.filter(l=>l.object!==item.g);item.el.remove();item.g.traverse(o=>{o.geometry?.dispose();if(o.material&&!Array.isArray(o.material))o.material.dispose();});this.agents.delete(id);}});
    const placements=[[-9,4],[9,3],[-15,14],[12,15],[-24,-6],[27,-6]];
    residents.forEach((a,i)=>{
      let item=this.agents.get(a.id);
      if(!item){const g=createRobot(a.avatar);const pos=placements[i]||[(i%6-2.5)*5,21+Math.floor((i-6)/6)*4];while(this.navigation.blocked(pos[0],pos[1]))pos[1]+=1.25;g.position.set(pos[0],surfaceHeight(pos[0],pos[1]),pos[1]);g.rotation.y=.2;this.scene.add(g);g.userData.agentId=a.id;this.targets.push(g);const el=this.addLabel(g,a.name,a.id,()=>this.onInteract({type:'agent',id:a.id}),'agent-label',3.2);item={g,el,index:i,path:[],waitUntil:this.clock.elapsedTime+i*.35,speed:0,hovered:false};el.onpointerenter=()=>{item.hovered=true;};el.onpointerleave=()=>{item.hovered=false;};this.agents.set(a.id,item);}
      item.status=a.status;item.el.innerHTML='';const dot=document.createElement('i');dot.className=a.status.toLowerCase();item.el.appendChild(dot);item.el.appendChild(document.createTextNode(a.name+(a.status==='WORKING'?' · WORKING':'')));item.el.title=a.name+' · '+a.status;item.el.dataset.status=a.status;
    });
    if(playerChanged||previousRoster!==[...this.agents.keys()].join(','))this.robotBatcher.sync([this.player,...[...this.agents.values()].map(a=>a.g)]);
  }
  setupEvents(){
    this.ray=new THREE.Raycaster();this.pointer=new THREE.Vector2();this.down=null;
    this.onDown=e=>{this.down={x:e.clientX,y:e.clientY};};
    this.onUp=e=>{if(!this.down||Math.hypot(e.clientX-this.down.x,e.clientY-this.down.y)>5)return;this.pointer.set(e.clientX/window.innerWidth*2-1,-e.clientY/window.innerHeight*2+1);this.ray.setFromCamera(this.pointer,this.camera);const hits=this.ray.intersectObjects(this.targets,true);if(hits.length){let ob=hits[0].object;while(ob&&!ob.userData.route&&!ob.userData.agentId)ob=ob.parent;if(ob)this.onInteract({type:ob.userData.agentId?'agent':'building',id:ob.userData.agentId||ob.userData.route});}};
    this.onKey=e=>{
      if(typeof e?.key!=='string')return;
      const key=e.key.toLowerCase();
      if(!['w','a','s','d','arrowup','arrowdown','arrowleft','arrowright'].includes(key))return;
      // Release keys even when focus has moved into a form or dialog.
      if(e.type==='keyup'){this.keys[key]=false;return;}
      if(e.type!=='keydown'||!this.entered||e.isComposing||e.ctrlKey||e.metaKey||e.altKey)return;
      const editing=e.target?.closest?.('input,textarea,select,[contenteditable]:not([contenteditable="false"]),[role="textbox"]');
      if(editing||document.querySelector('[role="dialog"]'))return;
      this.keys[key]=true;
      e.preventDefault?.();
    };
    this.onBlur=()=>{this.keys={};};this.onResize=()=>this.resize();
    this.controls.addEventListener('start',()=>{this.cameraTween=null;this.focusedAgentId=null;});
    this.renderer.domElement.addEventListener('pointerdown',this.onDown);this.renderer.domElement.addEventListener('pointerup',this.onUp);window.addEventListener('keydown',this.onKey);window.addEventListener('keyup',this.onKey);window.addEventListener('blur',this.onBlur);window.addEventListener('resize',this.onResize);
  }
  resize(){const w=window.innerWidth,h=window.innerHeight;this.camera.aspect=w/h;this.camera.updateProjectionMatrix();this.renderer.setSize(w,h);if(this.focusedAgentId)this.focusPlayer();else if(w<640&&this.camera.position.distanceTo(this.controls.target)<60)this.camera.position.set(33,52,80);}
  zoom(direction){const offset=this.camera.position.clone().sub(this.controls.target);offset.multiplyScalar(direction>0?.85:1.17);offset.clampLength(19,104);this.camera.position.copy(this.controls.target).add(offset);}
  animate(){
    this.frame=requestAnimationFrame(()=>this.animate());const delta=Math.min(this.clock.getDelta(),.15);const t=this.clock.elapsedTime;
    movePlayer(this,delta,t);moveResidents(this,delta,t);
    if(this.cameraTween){const tr=this.cameraTween,duration=tr.duration??1.8,p=duration===0?1:Math.min(1,(t-tr.start)/duration),ease=p*p*(3-2*p);if(tr.followPlayer){tr.to.copy(this.player.position).add(tr.offset);tr.target.copy(this.player.position).add(new THREE.Vector3(0,1.3,0));}this.camera.position.lerpVectors(tr.from,tr.to,ease);this.controls.target.lerpVectors(tr.fromTarget,tr.target,ease);if(p===1)this.cameraTween=null;}
    this.renderer.domElement.dataset.cameraState=JSON.stringify({position:this.camera.position.toArray(),target:this.controls.target.toArray(),focusedAgentId:this.focusedAgentId||null,tweening:!!this.cameraTween});
    if(t-this.lastTelemetry>.25){this.lastTelemetry=t;this.renderer.domElement.dataset.worldState=JSON.stringify({entered:this.entered,player:{agentId:this.playerAgent?.id||null,avatar:this.playerAvatar||'white',name:this.playerAgent?.name||null,status:this.playerAgent?.status||'EXPLORING',x:this.player.position.x,y:this.player.position.y,z:this.player.position.z,ground:surfaceHeight(this.player.position.x,this.player.position.z),speed:this.velocity.length()},agents:[...this.agents.entries()].map(([id,a])=>({id,x:a.g.position.x,z:a.g.position.z,y:a.g.position.y,ground:surfaceHeight(a.g.position.x,a.g.position.z),moving:a.moving,status:a.status,blocked:this.navigation.blocked(a.g.position.x,a.g.position.z)}))});}
    this.dust.rotation.y=t*.004;this.controls.update();this.robotBatcher.update();this.renderer.render(this.scene,this.camera);
    const v=new THREE.Vector3();this.labelItems.forEach(({object,element,height})=>{v.copy(object.position);v.y+=height;v.project(this.camera);const visible=v.z<1&&v.x>-.96&&v.x<.96&&v.y>-.87&&v.y<.82;element.style.display=visible?'flex':'none';const half=element.offsetWidth/2+8;const px=Math.max(half,Math.min(window.innerWidth-half,(v.x*.5+.5)*window.innerWidth));element.style.left=px+'px';element.style.top=(-v.y*.5+.5)*window.innerHeight+'px';});
  }
  dispose(){cancelAnimationFrame(this.frame);window.removeEventListener('keydown',this.onKey);window.removeEventListener('keyup',this.onKey);window.removeEventListener('blur',this.onBlur);window.removeEventListener('resize',this.onResize);this.controls.dispose();this.robotBatcher.dispose();this.scene.traverse(o=>{o.geometry?.dispose();if(o.material){(Array.isArray(o.material)?o.material:[o.material]).forEach(m=>{m.map?.dispose();m.dispose();});}});this.renderer.dispose();this.container.replaceChildren();this.labels.replaceChildren();}
}