/**
 * Agent.ws — 3D World Engine
 * Three.js based world with terrain, buildings, props, lighting
 * Enhanced animations: wind, pulsing lights, water effects
 */

class World3D {
    constructor(containerId) {
        this.container = document.getElementById(containerId);
        this.scene = null; this.camera = null; this.renderer = null;
        this.clock = new THREE.Clock();
        this.raycaster = new THREE.Raycaster();
        this.mouse = new THREE.Vector2();
        this.interactables = [];
        this.buildings = [];
        this.trees = [];
        this.lamps = [];
        this.particles = null;
        this.water = null;
        this.groundPlane = null;
        
        this.cameraState = {
            theta: Math.PI / 4, phi: Math.PI / 3, radius: 40,
            target: new THREE.Vector3(0, 0, 0),
            isDragging: false, lastMouseX: 0, lastMouseY: 0
        };

        this.init();
    }

    init() {
        this.setupRenderer();
        this.setupCamera();
        this.setupScene();
        this.setupLights();
        this.createTerrain();
        this.createHeroSetPieces();
        this.loadGigaModel();
        this.createBuildings();
        this.createProps();
        this.createParticles();
        this.setupEvents();
        this.animate();
    }

    setupRenderer() {
        this.renderer = new THREE.WebGLRenderer({
            antialias: true, alpha: false, powerPreference: 'high-performance'
        });
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        this.renderer.outputEncoding = THREE.sRGBEncoding;
        this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
        this.renderer.toneMappingExposure = 1.1;
        this.renderer.setClearColor(0x91a0c4);
        this.container.appendChild(this.renderer.domElement);
    }

    setupCamera() {
        const aspect = window.innerWidth / window.innerHeight;
        this.camera = new THREE.PerspectiveCamera(45, aspect, 0.1, 500);
        this.updateCameraPosition();
    }

    updateCameraPosition() {
        const { theta, phi, radius, target } = this.cameraState;
        this.camera.position.x = target.x + radius * Math.sin(phi) * Math.cos(theta);
        this.camera.position.y = target.y + radius * Math.cos(phi);
        this.camera.position.z = target.z + radius * Math.sin(phi) * Math.sin(theta);
        this.camera.lookAt(target);
    }

    setupScene() {
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0x91a0c4);
        this.scene.fog = new THREE.Fog(0x91a0c4, 62, 150);
    }

    setupLights() {
        const ambient = new THREE.AmbientLight(0xffd9b0, 0.55);
        this.scene.add(ambient);

        const hemi = new THREE.HemisphereLight(0xc3cff8, 0xa45f22, 0.8);
        this.scene.add(hemi);

        const moon = new THREE.DirectionalLight(0xffdfb3, 1.55);
        moon.position.set(32, 52, 26);
        moon.castShadow = true;
        moon.shadow.mapSize.width = 2048;
        moon.shadow.mapSize.height = 2048;
        moon.shadow.camera.near = 0.5;
        moon.shadow.camera.far = 150;
        moon.shadow.camera.left = -50;
        moon.shadow.camera.right = 50;
        moon.shadow.camera.top = 50;
        moon.shadow.camera.bottom = -50;
        moon.shadow.bias = -0.001;
        this.scene.add(moon);

        const colors = [0x6366f1, 0xec4899, 0x10b981, 0xf59e0b];
        const positions = [[15, 5, 15], [-15, 5, 15], [-15, 5, -15], [15, 5, -15]];
        this.buildingLights = [];
        positions.forEach((pos, i) => {
            const light = new THREE.PointLight(colors[i % colors.length], 0.6, 25);
            light.position.set(...pos);
            this.scene.add(light);
            this.buildingLights.push({ light, baseIntensity: 0.6, phase: i * Math.PI / 2 });
        });
    }

    createTerrain() {
        if (window.Agent3Assets) {
            const desert = Agent3Assets.createDesertTerrain(180);
            this.groundPlane = desert.ground;
            this.scene.add(desert.group);
            this.scene.add(Agent3Assets.createHorizonBand());
            this.createPathway(0, -10, 74, 4.5, 0x9a5a24);
            this.createPathway(-5, 0, 4.5, 46, 0x9a5a24);
            return;
        }

        const geometry = new THREE.PlaneGeometry(120, 120, 64, 64);
        const posAttribute = geometry.attributes.position;
        for (let i = 0; i < posAttribute.count; i++) {
            const x = posAttribute.getX(i);
            const y = posAttribute.getY(i);
            const z = Math.sin(x * 0.05) * Math.cos(y * 0.05) * 0.5 +
                      Math.sin(x * 0.15 + 1) * Math.cos(y * 0.1 + 2) * 0.2;
            posAttribute.setZ(i, z);
        }
        geometry.computeVertexNormals();

        const material = new THREE.MeshStandardMaterial({
            color: 0x1a1a2e, roughness: 0.9, metalness: 0.1,
        });

        this.groundPlane = new THREE.Mesh(geometry, material);
        this.groundPlane.rotation.x = -Math.PI / 2;
        this.groundPlane.receiveShadow = true;
        this.scene.add(this.groundPlane);

        const gridHelper = new THREE.GridHelper(120, 60, 0x2a2a40, 0x1a1a30);
        gridHelper.position.y = 0.02;
        this.scene.add(gridHelper);

        this.createPathway(0, 0, 20, 3, 0x2a2a45);
        this.createPathway(0, 0, 3, 20, 0x2a2a45);
    }

    createPathway(x, z, width, depth, color) {
        const geometry = new THREE.PlaneGeometry(width, depth);
        const material = new THREE.MeshStandardMaterial({ color, roughness: 0.8, metalness: 0.05 });
        const path = new THREE.Mesh(geometry, material);
        path.rotation.x = -Math.PI / 2;
        path.position.set(x, 0.03, z);
        path.receiveShadow = true;
        this.scene.add(path);
    }

    createWater() {
        // Small lake/pond area
        const geometry = new THREE.CircleGeometry(6, 32);
        const material = new THREE.MeshStandardMaterial({
            color: 0x1a3a5c, roughness: 0.1, metalness: 0.8,
            transparent: true, opacity: 0.8
        });
        this.water = new THREE.Mesh(geometry, material);
        this.water.rotation.x = -Math.PI / 2;
        this.water.position.set(20, 0.15, 20);
        this.scene.add(this.water);

        // Water edge glow
        const edgeGeo = new THREE.RingGeometry(5.8, 6.2, 32);
        const edgeMat = new THREE.MeshBasicMaterial({
            color: 0x4fc3f7, transparent: true, opacity: 0.3
        });
        const edge = new THREE.Mesh(edgeGeo, edgeMat);
        edge.rotation.x = -Math.PI / 2;
        edge.position.set(20, 0.16, 20);
        this.scene.add(edge);
    }

    createHeroSetPieces() {
        if (!window.Agent3Assets) {
            this.createWater();
            return;
        }

        const marketBoard = Agent3Assets.createBillboard({
            title: '$THREE MARKET',
            subtitle: 'market cap / volume / token supply',
            width: 23,
            height: 13,
            chart: true
        });
        marketBoard.position.set(-18, 0, -24);
        marketBoard.rotation.y = 0.08;
        this.scene.add(marketBoard);

        const exchangeBoard = Agent3Assets.createBillboard({
            title: 'AGENT EXCHANGE',
            subtitle: 'live session - prices from on-chain swaps',
            width: 27,
            height: 14,
            chart: false
        });
        exchangeBoard.position.set(18, 0, -24);
        exchangeBoard.rotation.y = -0.06;
        this.scene.add(exchangeBoard);

        const pedestal = Agent3Assets.createPedestal();
        pedestal.position.set(0, 0, -21);
        this.scene.add(pedestal);
    }

    loadGigaModel() {
        if (!THREE.GLTFLoader) return;

        const loader = new THREE.GLTFLoader();
        loader.load(
            'giga.glb',
            (gltf) => {
                const model = gltf.scene;
                const box = new THREE.Box3().setFromObject(model);
                const size = new THREE.Vector3();
                box.getSize(size);
                const maxAxis = Math.max(size.x, size.y, size.z) || 1;
                const scale = 8 / maxAxis;

                model.scale.setScalar(scale);
                model.position.set(0, 0.25, -11);
                model.rotation.y = Math.PI;
                model.traverse(child => {
                    if (child.isMesh) {
                        child.castShadow = true;
                        child.receiveShadow = true;
                    }
                });
                this.scene.add(model);
                this.gigaModel = model;
            },
            undefined,
            (err) => console.warn('Failed to load giga.glb', err)
        );
    }

    createBuildings() {
        if (window.Agent3Assets) {
            const exchange = Agent3Assets.createWesternBuilding({ label: 'AGENT EXCHANGE', color: 0x6b3014, width: 10, depth: 7, height: 4.5 });
            exchange.position.set(0, 0, -2);
            this.scene.add(exchange);
            this.buildings.push({ group: exchange, name: 'Agent Exchange', type: 'exchange', position: new THREE.Vector3(0, 0, -2) });

            const landOffice = Agent3Assets.createWesternBuilding({ label: 'LAND OFFICES', color: 0x8f3f16, width: 8.5, depth: 6, height: 4 });
            landOffice.position.set(31, 0, -17);
            landOffice.rotation.y = -0.12;
            this.scene.add(landOffice);
            this.buildings.push({ group: landOffice, name: 'Land Offices', type: 'office', position: new THREE.Vector3(31, 0, -17) });

            const skills = Agent3Assets.createWesternBuilding({ label: 'SKILLS', color: 0x2d5d43, width: 7.5, depth: 5.5, height: 3.7 });
            skills.position.set(-34, 0, -15);
            skills.rotation.y = 0.14;
            this.scene.add(skills);
            this.buildings.push({ group: skills, name: 'Skills Hall', type: 'academy', position: new THREE.Vector3(-34, 0, -15) });

            [exchange, landOffice, skills].forEach(group => {
                group.traverse(child => {
                    if (child.isMesh && child.geometry?.type === 'BoxGeometry') {
                        child.userData = { type: 'building', name: group === exchange ? 'Agent Exchange' : group === landOffice ? 'Land Offices' : 'Skills Hall' };
                        this.interactables.push(child);
                    }
                });
            });
            return;
        }

        this.createBuilding({ x: 0, z: 0, width: 10, height: 8, depth: 10, color: 0x6366f1, name: 'Agent Exchange', type: 'exchange' });
        this.createBuilding({ x: -18, z: -12, width: 8, height: 5, depth: 6, color: 0xec4899, name: 'Land Office', type: 'office' });
        this.createBuilding({ x: 18, z: -10, width: 12, height: 4, depth: 8, color: 0x10b981, name: 'Market Plaza', type: 'market' });
        this.createBuilding({ x: -12, z: 16, width: 9, height: 6, depth: 7, color: 0xf59e0b, name: 'Skill Academy', type: 'academy' });

        const residences = [
            { x: 8, z: 18, color: 0x3b82f6 }, { x: 16, z: 12, color: 0x8b5cf6 },
            { x: -8, z: -20, color: 0xef4444 }, { x: -20, z: 8, color: 0x06b6d4 }
        ];
        residences.forEach((r, i) => {
            this.createBuilding({ x: r.x, z: r.z, width: 5, height: 4 + Math.random() * 3, depth: 5, color: r.color, name: `Residence ${i + 1}`, type: 'residence' });
        });
    }

    createBuilding({ x, z, width, height, depth, color, name, type }) {
        const group = new THREE.Group();
        group.position.set(x, 0, z);

        const geometry = new THREE.BoxGeometry(width, height, depth);
        const material = new THREE.MeshStandardMaterial({ color, roughness: 0.7, metalness: 0.15 });
        const mesh = new THREE.Mesh(geometry, material);
        mesh.position.y = height / 2;
        mesh.castShadow = true; mesh.receiveShadow = true;
        group.add(mesh);

        // Roof
        const roofGeo = type === 'exchange'
            ? new THREE.ConeGeometry(width * 0.8, 3, 4)
            : new THREE.BoxGeometry(width + 0.5, 0.5, depth + 0.5);
        const roofMat = new THREE.MeshStandardMaterial({
            color: new THREE.Color(color).multiplyScalar(0.7), roughness: 0.5, metalness: 0.3
        });
        const roof = new THREE.Mesh(roofGeo, roofMat);
        if (type === 'exchange') { roof.position.y = height + 1.5; roof.rotation.y = Math.PI / 4; }
        else { roof.position.y = height + 0.25; }
        roof.castShadow = true; group.add(roof);

        // Windows with individual light meshes for pulsing
        const windowGeo = new THREE.PlaneGeometry(0.8, 1);
        const sides = [
            { pos: [0, height * 0.6, depth / 2 + 0.01], rot: [0, 0, 0] },
            { pos: [0, height * 0.6, -depth / 2 - 0.01], rot: [0, Math.PI, 0] },
            { pos: [width / 2 + 0.01, height * 0.6, 0], rot: [0, Math.PI / 2, 0] },
            { pos: [-width / 2 - 0.01, height * 0.6, 0], rot: [0, -Math.PI / 2, 0] }
        ];

        this.windows = this.windows || [];
        sides.forEach(side => {
            const cols = Math.floor(width / 2.5);
            const rows = Math.floor(height / 3);
            for (let r = 0; r < rows; r++) {
                for (let c = 0; c < cols; c++) {
                    const winMat = new THREE.MeshBasicMaterial({
                        color: 0xffeecc, transparent: true, opacity: 0.5 + Math.random() * 0.3
                    });
                    const win = new THREE.Mesh(windowGeo, winMat);
                    win.position.set(
                        side.pos[0] + (side.rot[1] === 0 ? (c - cols/2 + 0.5) * 2 : 0),
                        side.pos[1] + (r - rows/2 + 0.5) * 2.5,
                        side.pos[2] + (side.rot[1] !== 0 ? (c - cols/2 + 0.5) * 2 : 0)
                    );
                    win.rotation.set(...side.rot);
                    group.add(win);
                    this.windows.push({ mesh: win, baseOpacity: winMat.opacity, phase: Math.random() * Math.PI * 2, speed: 0.5 + Math.random() * 1.5 });
                }
            }
        });

        // Door glow
        const doorGeo = new THREE.PlaneGeometry(2, 2.5);
        const doorMat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.5 });
        const door = new THREE.Mesh(doorGeo, doorMat);
        door.position.set(0, 1.25, depth / 2 + 0.02);
        group.add(door);
        this.windows.push({ mesh: door, baseOpacity: 0.5, phase: 0, speed: 1 });

        // Architectural depth: plinth, columns, side fins, and rooftop signal mast.
        const trimMat = new THREE.MeshStandardMaterial({
            color: new THREE.Color(color).multiplyScalar(1.25),
            roughness: 0.45,
            metalness: 0.35
        });
        const base = new THREE.Mesh(new THREE.BoxGeometry(width + 1.2, 0.35, depth + 1.2), trimMat);
        base.position.y = 0.2;
        base.castShadow = true;
        base.receiveShadow = true;
        group.add(base);

        const columnGeo = new THREE.CylinderGeometry(0.16, 0.2, height * 0.82, 8);
        [-1, 1].forEach(side => {
            const column = new THREE.Mesh(columnGeo, trimMat);
            column.position.set(side * (width / 2 - 0.55), height * 0.42, depth / 2 + 0.18);
            column.castShadow = true;
            group.add(column);
        });

        const finGeo = new THREE.BoxGeometry(0.18, height * 0.72, depth + 0.4);
        [-1, 1].forEach(side => {
            const fin = new THREE.Mesh(finGeo, trimMat);
            fin.position.set(side * (width / 2 + 0.18), height * 0.55, 0);
            fin.castShadow = true;
            group.add(fin);
        });

        const mast = new THREE.Mesh(
            new THREE.CylinderGeometry(0.06, 0.08, 2.2, 8),
            new THREE.MeshStandardMaterial({ color: 0xd7e0ff, roughness: 0.35, metalness: 0.7 })
        );
        mast.position.y = height + (type === 'exchange' ? 3.2 : 1.6);
        mast.castShadow = true;
        group.add(mast);

        const beacon = new THREE.Mesh(
            new THREE.SphereGeometry(0.22, 12, 12),
            new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.85 })
        );
        beacon.position.y = mast.position.y + 1.15;
        group.add(beacon);
        this.windows.push({ mesh: beacon, baseOpacity: 0.85, phase: Math.random() * Math.PI * 2, speed: 2 });

        // Label
        const label = this.createTextSprite(name, { r: 1, g: 1, b: 1 });
        label.position.set(0, height + 3, 0);
        group.add(label);

        this.scene.add(group);
        this.buildings.push({ group, name, type, position: new THREE.Vector3(x, 0, z) });
        this.interactables.push(mesh);
        mesh.userData = { type: 'building', name, buildingType: type };
    }

    createTextSprite(text, color) {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        canvas.width = 512; canvas.height = 128;
        this.roundRect(ctx, 20, 20, canvas.width - 40, canvas.height - 40, 16);
        ctx.fillStyle = 'rgba(0,0,0,0.5)';
        ctx.fill();
        ctx.font = 'bold 44px Inter, sans-serif';
        ctx.fillStyle = `rgb(${color.r * 255}, ${color.g * 255}, ${color.b * 255})`;
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText(text, canvas.width / 2, canvas.height / 2);
        const texture = new THREE.CanvasTexture(canvas);
        const material = new THREE.SpriteMaterial({ map: texture, transparent: true });
        const sprite = new THREE.Sprite(material);
        sprite.scale.set(10, 2.5, 1);
        return sprite;
    }

    roundRect(ctx, x, y, w, h, r) {
        ctx.beginPath();
        ctx.moveTo(x + r, y);
        ctx.lineTo(x + w - r, y);
        ctx.quadraticCurveTo(x + w, y, x + w, y + r);
        ctx.lineTo(x + w, y + h - r);
        ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
        ctx.lineTo(x + r, y + h);
        ctx.quadraticCurveTo(x, y + h, x, y + h - r);
        ctx.lineTo(x, y + r);
        ctx.quadraticCurveTo(x, y, x + r, y);
        ctx.closePath();
    }

    createProps() {
        if (window.Agent3Assets) {
            const cactusPositions = [[-42, -3, 0.85], [-32, 11, 1.15], [39, -5, 0.95], [47, -20, 0.72], [26, 14, 0.7], [-18, -31, 0.8]];
            cactusPositions.forEach(([x, z, s]) => {
                const cactus = Agent3Assets.createCactus(s);
                cactus.position.set(x, this.getGroundPosition(x, z), z);
                cactus.rotation.y = Math.random() * Math.PI;
                this.scene.add(cactus);
            });

            const rockPositions = [[-28, -8], [25, -9], [45, 2], [-45, -22], [15, 14], [-12, -35], [36, -28]];
            rockPositions.forEach(([x, z]) => {
                const rock = Agent3Assets.createLowPolyRock(0.55 + Math.random() * 0.65);
                rock.position.set(x, this.getGroundPosition(x, z) + 0.22, z);
                this.scene.add(rock);
            });

            const lampPositions = [[-8, -4], [8, -4], [-15, -16], [15, -16], [29, -12], [-31, -11]];
            lampPositions.forEach(([x, z]) => this.createStreetLamp(x, z));
            return;
        }

        const treePositions = [
            [5, 5], [8, -3], [-5, 8], [-8, -5], [12, 5],
            [-12, -8], [3, 12], [-3, -12], [15, -15], [-15, 15],
            [22, 0], [-22, 0], [0, 22], [0, -22], [25, 10]
        ];
        treePositions.forEach(([x, z]) => this.createTree(x, z));

        const rockPositions = [[7, 7], [-7, -7], [14, -5], [-14, 5], [20, 15]];
        rockPositions.forEach(([x, z]) => this.createRock(x, z));

        const lampPositions = [[5, 0], [-5, 0], [0, 5], [0, -5], [10, 10], [-10, -10], [10, -10], [-10, 10]];
        lampPositions.forEach(([x, z]) => this.createStreetLamp(x, z));
    }

    createTree(x, z) {
        const group = new THREE.Group();
        group.position.set(x, 0, z);

        const trunkGeo = new THREE.CylinderGeometry(0.2, 0.3, 2, 6);
        const trunkMat = new THREE.MeshStandardMaterial({ color: 0x4a3728, roughness: 0.9 });
        const trunk = new THREE.Mesh(trunkGeo, trunkMat);
        trunk.position.y = 1; trunk.castShadow = true;
        group.add(trunk);

        const branchGeo = new THREE.CylinderGeometry(0.06, 0.1, 1.1, 6);
        for (let i = 0; i < 4; i++) {
            const branch = new THREE.Mesh(branchGeo, trunkMat);
            const angle = (Math.PI * 2 / 4) * i + Math.random() * 0.25;
            branch.position.set(Math.cos(angle) * 0.35, 1.75 + Math.random() * 0.35, Math.sin(angle) * 0.35);
            branch.rotation.z = Math.PI / 2.8;
            branch.rotation.y = -angle;
            branch.castShadow = true;
            group.add(branch);
        }

        const rootGeo = new THREE.CylinderGeometry(0.04, 0.08, 0.9, 5);
        for (let i = 0; i < 5; i++) {
            const root = new THREE.Mesh(rootGeo, trunkMat);
            const angle = (Math.PI * 2 / 5) * i;
            root.position.set(Math.cos(angle) * 0.32, 0.18, Math.sin(angle) * 0.32);
            root.rotation.z = Math.PI / 2.2;
            root.rotation.y = -angle;
            root.castShadow = true;
            group.add(root);
        }

        const foliageColors = [0x2d6a4f, 0x40916c, 0x52b788, 0x1b4332];
        const color = foliageColors[Math.floor(Math.random() * foliageColors.length)];
        const foliageGeo = new THREE.IcosahedronGeometry(1.2 + Math.random() * 0.5, 0);
        const foliageMat = new THREE.MeshStandardMaterial({
            color, roughness: 0.8, flatShading: true
        });
        const foliage = new THREE.Mesh(foliageGeo, foliageMat);
        foliage.position.y = 2.5 + Math.random() * 0.5;
        foliage.rotation.y = Math.random() * Math.PI;
        foliage.castShadow = true;
        group.add(foliage);

        // Second foliage layer
        const foliage2Geo = new THREE.IcosahedronGeometry(0.8 + Math.random() * 0.3, 0);
        const foliage2 = new THREE.Mesh(foliage2Geo, foliageMat);
        foliage2.position.y = 3.5 + Math.random() * 0.3;
        foliage2.rotation.y = Math.random() * Math.PI;
        foliage2.castShadow = true;
        group.add(foliage2);

        const crownGeo = new THREE.ConeGeometry(1.05 + Math.random() * 0.35, 1.5, 7);
        const crown = new THREE.Mesh(crownGeo, foliageMat);
        crown.position.y = 4.1 + Math.random() * 0.2;
        crown.rotation.y = Math.random() * Math.PI;
        crown.castShadow = true;
        group.add(crown);

        this.scene.add(group);
        this.trees.push({
            group, foliage, foliage2, crown,
            baseRotation: foliage.rotation.y,
            swaySpeed: 0.5 + Math.random() * 1,
            swayAmount: 0.02 + Math.random() * 0.03
        });
    }

    createRock(x, z) {
        const geometry = new THREE.DodecahedronGeometry(0.5 + Math.random() * 0.8, 0);
        const material = new THREE.MeshStandardMaterial({ color: 0x555566, roughness: 0.95, flatShading: true });
        const rock = new THREE.Mesh(geometry, material);
        rock.position.set(x, 0.3, z);
        rock.rotation.set(Math.random(), Math.random(), Math.random());
        rock.scale.y = 0.6;
        rock.castShadow = true; rock.receiveShadow = true;
        this.scene.add(rock);
    }

    createStreetLamp(x, z) {
        const group = new THREE.Group();
        group.position.set(x, 0, z);

        const poleGeo = new THREE.CylinderGeometry(0.1, 0.15, 4, 6);
        const poleMat = new THREE.MeshStandardMaterial({ color: 0x333344, roughness: 0.4, metalness: 0.6 });
        const pole = new THREE.Mesh(poleGeo, poleMat);
        pole.position.y = 2; pole.castShadow = true;
        group.add(pole);

        const bulbGeo = new THREE.SphereGeometry(0.3, 8, 8);
        const bulbMat = new THREE.MeshBasicMaterial({ color: 0xffeeaa });
        const bulb = new THREE.Mesh(bulbGeo, bulbMat);
        bulb.position.y = 4;
        group.add(bulb);

        const light = new THREE.PointLight(0xffeeaa, 0.4, 10);
        light.position.y = 4;
        light.castShadow = true; light.shadow.bias = -0.001;
        group.add(light);

        this.scene.add(group);
        this.lamps.push({ bulb, light, baseIntensity: 0.4, flickerPhase: Math.random() * 100 });
    }

    createParticles() {
        const particleCount = 300;
        const geometry = new THREE.BufferGeometry();
        const positions = new Float32Array(particleCount * 3);
        const colors = new Float32Array(particleCount * 3);
        const sizes = new Float32Array(particleCount);

        const colorPalette = [
            new THREE.Color(0x6366f1), new THREE.Color(0xec4899),
            new THREE.Color(0x10b981), new THREE.Color(0xf59e0b),
            new THREE.Color(0x4fc3f7)
        ];

        for (let i = 0; i < particleCount; i++) {
            positions[i * 3] = (Math.random() - 0.5) * 80;
            positions[i * 3 + 1] = Math.random() * 20 + 2;
            positions[i * 3 + 2] = (Math.random() - 0.5) * 80;
            const color = colorPalette[Math.floor(Math.random() * colorPalette.length)];
            colors[i * 3] = color.r; colors[i * 3 + 1] = color.g; colors[i * 3 + 2] = color.b;
            sizes[i] = 0.1 + Math.random() * 0.2;
        }

        geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
        geometry.setAttribute('size', new THREE.BufferAttribute(sizes, 1));

        const material = new THREE.PointsMaterial({
            size: 0.15, vertexColors: true, transparent: true,
            opacity: 0.6, blending: THREE.AdditiveBlending, sizeAttenuation: true
        });

        this.particles = new THREE.Points(geometry, material);
        this.scene.add(this.particles);
    }

    setupEvents() {
        window.addEventListener('resize', () => this.onResize());
        const canvas = this.renderer.domElement;

        // Mouse events
        canvas.addEventListener('mousedown', (e) => this.onMouseDown(e));
        canvas.addEventListener('mousemove', (e) => this.onMouseMove(e));
        canvas.addEventListener('mouseup', () => this.onMouseUp());
        canvas.addEventListener('wheel', (e) => this.onWheel(e), { passive: false });
        canvas.addEventListener('click', (e) => this.onClick(e));

        // Touch events (mobile)
        let touchStartDist = 0;
        canvas.addEventListener('touchstart', (e) => {
            if (e.touches.length === 1) {
                const t = e.touches[0];
                this.cameraState.isDragging = true;
                this.cameraState.lastMouseX = t.clientX;
                this.cameraState.lastMouseY = t.clientY;
            } else if (e.touches.length === 2) {
                const dx = e.touches[0].clientX - e.touches[1].clientX;
                const dy = e.touches[0].clientY - e.touches[1].clientY;
                touchStartDist = Math.sqrt(dx * dx + dy * dy);
            }
        }, { passive: true });

        canvas.addEventListener('touchmove', (e) => {
            e.preventDefault();
            if (e.touches.length === 1 && this.cameraState.isDragging) {
                const t = e.touches[0];
                const deltaX = t.clientX - this.cameraState.lastMouseX;
                const deltaY = t.clientY - this.cameraState.lastMouseY;
                this.cameraState.theta -= deltaX * 0.008;
                this.cameraState.phi = Math.max(0.2, Math.min(Math.PI / 2 - 0.1, this.cameraState.phi - deltaY * 0.008));
                this.cameraState.lastMouseX = t.clientX;
                this.cameraState.lastMouseY = t.clientY;
                this.updateCameraPosition();
            } else if (e.touches.length === 2) {
                const dx = e.touches[0].clientX - e.touches[1].clientX;
                const dy = e.touches[0].clientY - e.touches[1].clientY;
                const dist = Math.sqrt(dx * dx + dy * dy);
                const delta = touchStartDist - dist;
                this.cameraState.radius = Math.max(10, Math.min(80, this.cameraState.radius + delta * 0.05));
                touchStartDist = dist;
                this.updateCameraPosition();
            }
        }, { passive: false });

        canvas.addEventListener('touchend', () => {
            this.cameraState.isDragging = false;
        }, { passive: true });
    }

    onResize() {
        this.camera.aspect = window.innerWidth / window.innerHeight;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(window.innerWidth, window.innerHeight);
    }

    onMouseDown(e) {
        this.cameraState.isDragging = true;
        this.cameraState.lastMouseX = e.clientX;
        this.cameraState.lastMouseY = e.clientY;
    }

    onMouseMove(e) {
        if (!this.cameraState.isDragging) return;
        const deltaX = e.clientX - this.cameraState.lastMouseX;
        const deltaY = e.clientY - this.cameraState.lastMouseY;
        this.cameraState.theta -= deltaX * 0.005;
        this.cameraState.phi = Math.max(0.2, Math.min(Math.PI / 2 - 0.1, this.cameraState.phi - deltaY * 0.005));
        this.cameraState.lastMouseX = e.clientX;
        this.cameraState.lastMouseY = e.clientY;
        this.updateCameraPosition();
    }

    onMouseUp() { this.cameraState.isDragging = false; }

    onWheel(e) {
        e.preventDefault();
        this.cameraState.radius = Math.max(10, Math.min(80, this.cameraState.radius + e.deltaY * 0.02));
        this.updateCameraPosition();
    }

    onClick(e) {
        if (this.cameraState.isDragging) return;
        this.mouse.x = (e.clientX / window.innerWidth) * 2 - 1;
        this.mouse.y = -(e.clientY / window.innerHeight) * 2 + 1;
        this.raycaster.setFromCamera(this.mouse, this.camera);
        const intersects = this.raycaster.intersectObjects(this.interactables);
        if (intersects.length > 0) {
            const obj = intersects[0].object;
            if (obj.userData.type === 'building') {
                window.dispatchEvent(new CustomEvent('building-clicked', { detail: obj.userData }));
            }
        }
    }

    getGroundPosition(x, z) {
        return Math.sin(x * 0.05) * Math.cos(z * 0.05) * 0.5 +
               Math.sin(x * 0.15 + 1) * Math.cos(z * 0.1 + 2) * 0.2;
    }

    getRandomGroundPosition() {
        const x = (Math.random() - 0.5) * 50;
        const z = (Math.random() - 0.5) * 50;
        return new THREE.Vector3(x, this.getGroundPosition(x, z), z);
    }

    animate() {
        requestAnimationFrame(() => this.animate());
        const delta = this.clock.getDelta();
        const time = this.clock.getElapsedTime();

        // Animate particles
        if (this.particles) {
            const positions = this.particles.geometry.attributes.position.array;
            for (let i = 0; i < positions.length; i += 3) {
                positions[i + 1] += Math.sin(time * 0.5 + positions[i] * 0.1) * 0.008;
                if (positions[i + 1] > 22) positions[i + 1] = 2;
                if (positions[i + 1] < 2) positions[i + 1] = 22;
            }
            this.particles.geometry.attributes.position.needsUpdate = true;
            this.particles.rotation.y = time * 0.01;
        }

        // Animate water
        if (this.water) {
            this.water.position.y = 0.15 + Math.sin(time * 0.8) * 0.03;
            this.water.rotation.z = Math.sin(time * 0.3) * 0.02;
        }

        // Tree swaying (wind effect)
        this.trees.forEach(tree => {
            const sway = Math.sin(time * tree.swaySpeed) * tree.swayAmount;
            const sway2 = Math.cos(time * tree.swaySpeed * 0.7) * tree.swayAmount * 0.5;
            tree.foliage.rotation.z = sway;
            tree.foliage.rotation.x = sway2;
            tree.foliage2.rotation.z = sway * 0.8;
            tree.foliage2.rotation.x = sway2 * 0.8;
            if (tree.crown) {
                tree.crown.rotation.z = sway * 1.2;
                tree.crown.rotation.x = sway2;
            }
        });

        // Lamp flickering
        this.lamps.forEach(lamp => {
            const flicker = Math.sin(time * 8 + lamp.flickerPhase) * 0.05 +
                          Math.sin(time * 13 + lamp.flickerPhase) * 0.03;
            lamp.light.intensity = lamp.baseIntensity + flicker;
            lamp.bulb.material.opacity = 0.8 + flicker * 0.5;
        });

        // Building light pulsing
        if (this.windows) {
            this.windows.forEach(win => {
                const pulse = Math.sin(time * win.speed + win.phase) * 0.15;
                win.mesh.material.opacity = Math.max(0.1, Math.min(1, win.baseOpacity + pulse));
            });
        }

        // Building lights pulsing
        if (this.buildingLights) {
            this.buildingLights.forEach(bl => {
                const pulse = Math.sin(time * 0.5 + bl.phase) * 0.15;
                bl.light.intensity = bl.baseIntensity + pulse;
            });
        }

        this.renderer.render(this.scene, this.camera);
    }

    addToScene(object) { this.scene.add(object); }
    getScene() { return this.scene; }
    getCamera() { return this.camera; }
}

let world3D;
window.addEventListener('DOMContentLoaded', () => {
    world3D = new World3D('canvas-container');
});
