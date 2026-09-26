/**
 * Agent.ws — AI Agent System
 * Low-poly agents with navigation, state machine, autonomous behavior
 */

class AgentSystem {
    constructor(world) {
        this.world = world;
        this.agents = [];
        this.initializing = true;
        this.agentNames = [
            'AlphaBot','BetaMind','GammaFlow','DeltaCore','EpsilonX',
            'ZetaWave','EtaPulse','ThetaMind','IotaSpark','KappaNet',
            'LambdaCore','MuStream','NuSignal','XiCluster','OmicronNode',
            'PiChain','RhoField','SigmaGrid','TauLink','UpsilonNet'
        ];
        this.colors = [
            0x6366f1,0xec4899,0x10b981,0xf59e0b,0x3b82f6,
            0x8b5cf6,0xef4444,0x06b6d4,0x84cc16,0xf97316
        ];
        this.locations = [
            { name:'Agent Exchange', pos:new THREE.Vector3(0,0,0), type:'exchange' },
            { name:'Land Office', pos:new THREE.Vector3(-18,0,-12), type:'office' },
            { name:'Market Plaza', pos:new THREE.Vector3(18,0,-10), type:'market' },
            { name:'Skill Academy', pos:new THREE.Vector3(-12,0,16), type:'academy' },
            { name:'The Lake', pos:new THREE.Vector3(20,0,20), type:'lake' },
            { name:'The Forest', pos:new THREE.Vector3(-20,0,15), type:'forest' },
            { name:'Mining Cave', pos:new THREE.Vector3(15,0,-20), type:'cave' },
            { name:'Town Square', pos:new THREE.Vector3(0,0,0), type:'plaza' }
        ];
        this.skills = ['Fishing','Cooking','Woodcutting','Mining','Combat'];
        this.skillEmojis = {'Fishing':'🎣','Cooking':'🍳','Woodcutting':'🪵','Mining':'⛏️','Combat':'⚔️'};
        this.input = { w: false, a: false, s: false, d: false };
        this.playerAgent = null;
        this.remoteAgents = new Map();
        this.sessionId = this.getSessionId();
        this.playerName = this.getPlayerName();
        this.playerColor = 0x4fc3f7;
        this.init();
    }

    init() {
        this.setupInput();
        this.spawnPlayerAgent();
        setTimeout(() => { this.initializing = false; }, 500);
        setInterval(() => this.updateAgents(), 100);
        this.startOnlineSync();
    }

    getSessionId() {
        let id = localStorage.getItem('agent3_session_id');
        if (!id) {
            id = 'agent_' + Math.random().toString(36).slice(2) + Date.now().toString(36);
            localStorage.setItem('agent3_session_id', id);
        }
        return id;
    }

    getPlayerName() {
        const suffix = this.sessionId.slice(-4).toUpperCase();
        return localStorage.getItem('agent3_name') || `Guest-${suffix}`;
    }

    setupInput() {
        const isTyping = () => {
            const tag = document.activeElement?.tagName;
            return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || document.activeElement?.isContentEditable;
        };

        window.addEventListener('keydown', (e) => {
            if (isTyping()) return;
            const key = e.key.toLowerCase();
            if (key in this.input) {
                this.input[key] = true;
                e.preventDefault();
            }
        });
        window.addEventListener('keyup', (e) => {
            if (isTyping()) return;
            const key = e.key.toLowerCase();
            if (key in this.input) {
                this.input[key] = false;
                e.preventDefault();
            }
        });

        document.querySelectorAll('[data-move-key]').forEach((button) => {
            const key = button.dataset.moveKey;
            const release = () => {
                this.input[key] = false;
                button.classList.remove('pressed');
            };

            button.addEventListener('pointerdown', (e) => {
                e.preventDefault();
                button.setPointerCapture?.(e.pointerId);
                this.input[key] = true;
                button.classList.add('pressed');
            });
            button.addEventListener('pointerup', release);
            button.addEventListener('pointercancel', release);
            button.addEventListener('lostpointercapture', release);
            button.addEventListener('contextmenu', (e) => e.preventDefault());
        });

        window.addEventListener('blur', () => {
            Object.keys(this.input).forEach((key) => { this.input[key] = false; });
        });
    }

    spawnPlayerAgent() {
        const position = new THREE.Vector3(0, this.world.getGroundPosition(0, 0), 6);
        this.playerAgent = new Agent(1000, this.playerName, this.playerColor, position, this.world, this, { isPlayer: true });
        this.agents.push(this.playerAgent);
    }

    startOnlineSync() {
        this.sendHeartbeat();
        this.fetchOnlineAgents();
        setInterval(() => this.sendHeartbeat(), 1000);
        setInterval(() => this.fetchOnlineAgents(), 1500);
    }

    async sendHeartbeat() {
        if (!this.playerAgent) return;
        try {
            await fetch('/api/online-agents/heartbeat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    sessionId: this.sessionId,
                    name: this.playerName,
                    color: this.playerColor,
                    x: this.playerAgent.position.x,
                    y: this.playerAgent.position.y,
                    z: this.playerAgent.position.z,
                    rotationY: this.playerAgent.mesh.rotation.y,
                    state: this.playerAgent.isMoving ? 'walk' : 'online'
                })
            });
        } catch (err) {
            console.warn('Online heartbeat failed', err);
        }
    }

    async fetchOnlineAgents() {
        try {
            const res = await fetch('/api/online-agents?sessionId=' + encodeURIComponent(this.sessionId));
            if (!res.ok) throw new Error('Failed to fetch online agents');
            const data = await res.json();
            this.applyRemoteAgents(data.agents || []);
        } catch (err) {
            console.warn('Online agents sync failed', err);
        }
    }

    applyRemoteAgents(records) {
        const seen = new Set();
        records.forEach(record => {
            if (record.sessionId === this.sessionId) return;
            seen.add(record.sessionId);
            let agent = this.remoteAgents.get(record.sessionId);
            const position = new THREE.Vector3(record.x, record.y, record.z);
            if (!agent) {
                agent = new Agent(record.sessionId, record.name, record.color || 0xec4899, position, this.world, this, { isRemote: true });
                this.remoteAgents.set(record.sessionId, agent);
                this.agents.push(agent);
            }
            agent.applyRemoteState(record);
        });

        this.remoteAgents.forEach((agent, sessionId) => {
            if (seen.has(sessionId)) return;
            this.world.getScene().remove(agent.mesh);
            this.remoteAgents.delete(sessionId);
            this.agents = this.agents.filter(a => a !== agent);
        });
    }

    spawnAgent() {
        const id = this.agents.length;
        const name = this.agentNames[id % this.agentNames.length] + (id >= this.agentNames.length ? `-${Math.floor(id/this.agentNames.length)+1}` : '');
        const color = this.colors[id % this.colors.length];
        const position = this.world.getRandomGroundPosition();
        const agent = new Agent(id, name, color, position, this.world, this);
        this.agents.push(agent);
        if (!this.initializing) {
            window.dispatchEvent(new CustomEvent('agent-spawned', { detail: { agent: agent.getData() } }));
        }
        return agent;
    }

    updateAgents() { this.agents.forEach(agent => agent.update(0.1)); }
    getAgentById(id) { return this.agents.find(a => a.id === id); }
    getAllAgents() { return this.agents.map(a => a.getData()); }
    getRandomLocation() { return this.locations[Math.floor(Math.random() * this.locations.length)]; }
    getRandomSkill() { return this.skills[Math.floor(Math.random() * this.skills.length)]; }
}

class Agent {
    constructor(id, name, color, position, world, system, options = {}) {
        this.id = id; this.name = name; this.color = color;
        this.world = world; this.system = system;
        this.isPlayer = Boolean(options.isPlayer);
        this.isRemote = Boolean(options.isRemote);
        this.state = 'idle'; this.stateTimer = 0;
        this.remoteTarget = null;
        this.targetPosition = null; this.targetLocation = null;
        this.walkSpeed = this.isPlayer ? 5 : 1.5 + Math.random() * 1.5;
        this.skills = {};
        this.system.skills.forEach(skill => {
            this.skills[skill] = { level: 1, xp: Math.floor(Math.random() * 50), maxXp: 100 };
        });
        this.wallet = { address: this.generateWalletAddress(), balance: Math.floor(Math.random() * 10000) };
        this.tradeHistory = []; this.isTrading = false;
        this.mesh = this.createModel();
        this.world.addToScene(this.mesh);
        this.position = position.clone();
        this.mesh.position.copy(this.position);
        this.animTime = Math.random() * 100;
        this.bobOffset = Math.random() * Math.PI * 2;
        if (this.isPlayer) this.setState('player');
        if (this.isRemote) this.state = 'remote';
    }

    generateWalletAddress() {
        const chars = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
        let addr = '';
        for (let i = 0; i < 32; i++) addr += chars.charAt(Math.floor(Math.random() * chars.length));
        return addr;
    }

    createModel() {
        if (window.Agent3Assets) {
            const group = Agent3Assets.createHumanoid(this.color, {
                isPlayer: this.isPlayer,
                accent: this.isPlayer ? 0xf05a36 : this.color,
                ring: this.isPlayer ? 0xf2cf9b : this.color
            });
            const parts = group.userData.parts || {};
            this.leftArm = parts.leftArm;
            this.rightArm = parts.rightArm;
            this.leftLeg = parts.leftLeg;
            this.rightLeg = parts.rightLeg;
            this.glowRing = parts.ring;
            this.labelSprite = this.createLabelSprite(this.name);
            this.labelSprite.position.y = 2.65;
            group.add(this.labelSprite);
            return group;
        }

        const group = new THREE.Group();
        const color = new THREE.Color(this.color);
        const darkColor = color.clone().multiplyScalar(0.6);

        // Body
        const bodyGeo = new THREE.CylinderGeometry(0.3, 0.25, 0.8, 6);
        const bodyMat = new THREE.MeshStandardMaterial({ color, roughness: 0.6, flatShading: true });
        const body = new THREE.Mesh(bodyGeo, bodyMat);
        body.position.y = 1.1; body.castShadow = true;
        group.add(body);

        // Head
        const headGeo = new THREE.IcosahedronGeometry(0.28, 1);
        const headMat = new THREE.MeshStandardMaterial({
            color: color.clone().offsetHSL(0, -0.1, 0.25), roughness: 0.5,
            flatShading: true, emissive: color, emissiveIntensity: 0.1
        });
        const head = new THREE.Mesh(headGeo, headMat);
        head.position.y = 1.75; head.castShadow = true;
        group.add(head);

        // Eyes
        const eyeGeo = new THREE.SphereGeometry(0.04, 4, 4);
        const eyeMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
        const leftEye = new THREE.Mesh(eyeGeo, eyeMat);
        leftEye.position.set(-0.08, 1.72, 0.2); group.add(leftEye);
        const rightEye = new THREE.Mesh(eyeGeo, eyeMat);
        rightEye.position.set(0.08, 1.72, 0.2); group.add(rightEye);

        // Arms
        const armGeo = new THREE.CylinderGeometry(0.08, 0.06, 0.6, 4);
        const armMat = new THREE.MeshStandardMaterial({ color: darkColor, roughness: 0.7, flatShading: true });
        this.leftArm = new THREE.Mesh(armGeo, armMat);
        this.leftArm.position.set(-0.45, 1.2, 0); this.leftArm.castShadow = true;
        group.add(this.leftArm);
        this.rightArm = new THREE.Mesh(armGeo, armMat);
        this.rightArm.position.set(0.45, 1.2, 0); this.rightArm.castShadow = true;
        group.add(this.rightArm);

        // Legs
        const legGeo = new THREE.CylinderGeometry(0.1, 0.08, 0.7, 4);
        const legMat = new THREE.MeshStandardMaterial({ color: darkColor.clone().multiplyScalar(0.8), roughness: 0.8, flatShading: true });
        this.leftLeg = new THREE.Mesh(legGeo, legMat);
        this.leftLeg.position.set(-0.15, 0.35, 0); this.leftLeg.castShadow = true;
        group.add(this.leftLeg);
        this.rightLeg = new THREE.Mesh(legGeo, legMat);
        this.rightLeg.position.set(0.15, 0.35, 0); this.rightLeg.castShadow = true;
        group.add(this.rightLeg);

        // Glow ring
        const ringGeo = new THREE.RingGeometry(0.3, 0.4, 16);
        const ringMat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.3, side: THREE.DoubleSide });
        this.glowRing = new THREE.Mesh(ringGeo, ringMat);
        this.glowRing.rotation.x = -Math.PI / 2; this.glowRing.position.y = 0.05;
        group.add(this.glowRing);

        // Label
        this.labelSprite = this.createLabelSprite(this.name);
        this.labelSprite.position.y = 2.3;
        group.add(this.labelSprite);

        return group;
    }

    createLabelSprite(text) {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        canvas.width = 256; canvas.height = 64;
        ctx.fillStyle = 'rgba(0,0,0,0.6)';
        ctx.beginPath(); ctx.roundRect(4, 4, canvas.width - 8, canvas.height - 8, 8); ctx.fill();
        ctx.font = 'bold 28px Inter, sans-serif';
        ctx.fillStyle = '#ffffff'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText(text, canvas.width / 2, canvas.height / 2);
        const texture = new THREE.CanvasTexture(canvas);
        const material = new THREE.SpriteMaterial({ map: texture, transparent: true });
        const sprite = new THREE.Sprite(material);
        sprite.scale.set(3, 0.75, 1);
        return sprite;
    }

    update(delta) {
        this.animTime += delta; this.stateTimer += delta;
        switch (this.state) {
            case 'player': this.updatePlayer(delta); break;
            case 'remote': this.updateRemote(delta); break;
            case 'idle': this.updateIdle(delta); break;
            case 'walk': this.updateWalk(delta); break;
            case 'interact': this.updateInteract(delta); break;
            case 'trade': this.updateTrade(delta); break;
            case 'gather': this.updateGather(delta); break;
        }
        this.animate(delta);
    }

    applyRemoteState(record) {
        this.name = record.name || this.name;
        this.remoteTarget = new THREE.Vector3(record.x, record.y, record.z);
        this.remoteRotationY = record.rotationY || 0;
        this.remoteState = record.state || 'online';
        this.isMoving = this.position.distanceTo(this.remoteTarget) > 0.08 || this.remoteState === 'walk';
    }

    updateRemote(delta) {
        if (this.remoteTarget) {
            this.position.lerp(this.remoteTarget, Math.min(1, delta * 8));
            this.position.y = this.world.getGroundPosition(this.position.x, this.position.z);
            this.mesh.position.copy(this.position);
        }
        if (typeof this.remoteRotationY === 'number') {
            this.mesh.rotation.y += (this.remoteRotationY - this.mesh.rotation.y) * Math.min(1, delta * 8);
        }
    }

    updatePlayer(delta) {
        const input = this.system.input;
        const move = new THREE.Vector3(
            (input.d ? 1 : 0) - (input.a ? 1 : 0),
            0,
            (input.s ? 1 : 0) - (input.w ? 1 : 0)
        );

        if (move.lengthSq() > 0) {
            move.normalize();
            const theta = this.world.cameraState?.theta || 0;
            const forward = new THREE.Vector3(-Math.cos(theta), 0, -Math.sin(theta));
            const right = new THREE.Vector3(Math.sin(theta), 0, -Math.cos(theta));
            const direction = forward.multiplyScalar(-move.z).add(right.multiplyScalar(move.x)).normalize();
            this.position.add(direction.multiplyScalar(this.walkSpeed * delta));
            this.position.x = Math.max(-52, Math.min(52, this.position.x));
            this.position.z = Math.max(-52, Math.min(52, this.position.z));
            this.position.y = this.world.getGroundPosition(this.position.x, this.position.z);
            this.mesh.rotation.y = Math.atan2(direction.x, direction.z);
            this.mesh.position.copy(this.position);
            this.isMoving = true;
        } else {
            this.isMoving = false;
            this.mesh.position.copy(this.position);
        }

        if (this.world.cameraState?.target) {
            this.world.cameraState.target.lerp(this.position, 0.08);
            this.world.updateCameraPosition();
        }
    }

    updateIdle(delta) {
        if (this.stateTimer > 2 + Math.random() * 3) {
            const roll = Math.random();
            if (roll < 0.4) {
                const location = this.system.getRandomLocation();
                this.setTarget(location.pos, 'walk');
                this.targetLocation = location;
            } else if (roll < 0.6) { this.setState('trade'); }
            else if (roll < 0.8) { this.setState('gather'); }
            else {
                const randomPos = this.world.getRandomGroundPosition();
                this.setTarget(randomPos, 'walk');
            }
        }
    }

    updateWalk(delta) {
        if (!this.targetPosition) { this.setState('idle'); return; }
        const direction = new THREE.Vector3().subVectors(this.targetPosition, this.position).normalize();
        const distance = this.position.distanceTo(this.targetPosition);
        if (distance < 0.5) {
            if (this.targetLocation) this.setState('interact');
            else this.setState('idle');
            return;
        }
        const moveDistance = this.walkSpeed * delta;
        this.position.add(direction.multiplyScalar(moveDistance));
        this.position.y = this.world.getGroundPosition(this.position.x, this.position.z);
        const angle = Math.atan2(direction.x, direction.z);
        this.mesh.rotation.y = angle;
        this.mesh.position.copy(this.position);
    }

    updateInteract(delta) {
        if (this.stateTimer > 3 + Math.random() * 4) {
            if (this.targetLocation) this.gainSkillXp();
            this.targetLocation = null; this.setState('idle');
        }
    }

    updateTrade(delta) {
        if (this.stateTimer > 2 + Math.random() * 3) {
            this.simulateTrade(); this.setState('idle');
        }
    }

    updateGather(delta) {
        if (this.stateTimer > 3 + Math.random() * 3) {
            const skill = this.system.getRandomSkill();
            this.addXp(skill, 10 + Math.floor(Math.random() * 20));
            this.setState('idle');
        }
    }

    setTarget(position, state) {
        this.targetPosition = position.clone();
        this.targetPosition.y = this.world.getGroundPosition(position.x, position.z);
        this.setState(state);
    }

    setState(newState) {
        this.state = newState; this.stateTimer = 0;
        window.dispatchEvent(new CustomEvent('agent-state-change', {
            detail: { agent: this.getData(), state: newState, location: this.targetLocation?.name || null }
        }));
    }

    gainSkillXp() {
        const map = { 'lake':'Fishing','forest':'Woodcutting','cave':'Mining','market':'Cooking','academy':'Combat','exchange':null };
        const skill = map[this.targetLocation?.type];
        if (skill) this.addXp(skill, 5 + Math.floor(Math.random() * 15));
    }

    addXp(skill, amount) {
        if (!this.skills[skill]) return;
        const s = this.skills[skill]; s.xp += amount;
        if (s.xp >= s.maxXp) {
            s.level++; s.xp = s.xp - s.maxXp; s.maxXp = Math.floor(s.maxXp * 1.5);
            window.dispatchEvent(new CustomEvent('agent-level-up', { detail: { agent: this.getData(), skill, level: s.level } }));
        }
    }

    simulateTrade() {
        const isBuy = Math.random() > 0.5;
        const amount = Math.floor(Math.random() * 500) + 50;
        const price = 0.00423 + (Math.random() - 0.5) * 0.001;
        const trade = { type: isBuy ? 'buy' : 'sell', amount, price, total: amount * price, timestamp: Date.now() };
        this.tradeHistory.push(trade);
        if (this.tradeHistory.length > 10) this.tradeHistory.shift();
        window.dispatchEvent(new CustomEvent('agent-trade', { detail: { agent: this.getData(), trade } }));
    }

    animate(delta) {
        const t = this.animTime;
        if (this.state === 'walk' || (this.state === 'player' && this.isMoving) || (this.state === 'remote' && this.isMoving)) {
            const walkCycle = t * 8;
            this.leftLeg.rotation.x = Math.sin(walkCycle) * 0.5;
            this.rightLeg.rotation.x = Math.sin(walkCycle + Math.PI) * 0.5;
            this.leftArm.rotation.x = Math.sin(walkCycle + Math.PI) * 0.4;
            this.rightArm.rotation.x = Math.sin(walkCycle) * 0.4;
            this.mesh.position.y = this.position.y + Math.abs(Math.sin(walkCycle * 2)) * 0.1;
        } else if (this.state === 'idle' || this.state === 'player' || this.state === 'remote') {
            const breath = Math.sin(t * 2 + this.bobOffset) * 0.05;
            this.mesh.position.y = this.position.y + breath;
            this.leftArm.rotation.x = Math.sin(t * 1.5 + this.bobOffset) * 0.1;
            this.rightArm.rotation.x = Math.sin(t * 1.5 + this.bobOffset + Math.PI) * 0.1;
            this.leftLeg.rotation.x = 0; this.rightLeg.rotation.x = 0;
        } else if (this.state === 'interact' || this.state === 'gather') {
            const workCycle = t * 6;
            this.leftArm.rotation.x = -0.5 + Math.sin(workCycle) * 0.3;
            this.rightArm.rotation.x = -0.5 + Math.sin(workCycle + Math.PI) * 0.3;
        } else if (this.state === 'trade') {
            const tradeCycle = t * 10;
            this.leftArm.rotation.z = Math.sin(tradeCycle) * 0.3;
            this.rightArm.rotation.z = Math.sin(tradeCycle + Math.PI) * 0.3;
        }
        const pulse = 0.3 + Math.sin(t * 3 + this.bobOffset) * 0.15;
        this.glowRing.material.opacity = pulse;
        this.glowRing.scale.setScalar(1 + Math.sin(t * 2) * 0.1);
        if (this.labelSprite) this.labelSprite.lookAt(this.world.getCamera().position);
    }

    getData() {
        return {
            id: this.id, name: this.name, color: this.color, state: this.state,
            skills: this.skills, wallet: this.wallet, position: this.position,
            targetLocation: this.targetLocation?.name || null
        };
    }
}

let agentSystem;
window.addEventListener('world-ready', () => {
    if (typeof world3D !== 'undefined' && !agentSystem) {
        agentSystem = new AgentSystem(world3D);
        window.agentSystem = agentSystem;
    }
});
setTimeout(() => {
    if (typeof world3D !== 'undefined' && !agentSystem) {
        agentSystem = new AgentSystem(world3D);
        window.agentSystem = agentSystem;
    }
}, 2000);
