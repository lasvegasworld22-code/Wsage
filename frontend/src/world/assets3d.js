/**
 * Procedural 3D asset kit for the Agent.ws desert world.
 * All models are made from Three.js primitives so they stay lightweight.
 */

import * as THREE from 'three';

export class Agent3Assets {
    static mat(color, options = {}) {
        return new THREE.MeshStandardMaterial({
            color,
            roughness: options.roughness ?? 0.82,
            metalness: options.metalness ?? 0.05,
            flatShading: options.flatShading ?? true,
            transparent: options.transparent ?? false,
            opacity: options.opacity ?? 1,
            emissive: options.emissive ?? 0x000000,
            emissiveIntensity: options.emissiveIntensity ?? 0
        });
    }

    static withShadow(object) {
        object.traverse(child => {
            if (child.isMesh) {
                child.castShadow = true;
                child.receiveShadow = true;
            }
        });
        return object;
    }

    static createDesertTerrain(size = 180) {
        const group = new THREE.Group();
        const groundGeo = new THREE.PlaneGeometry(size, size, 96, 96);
        const pos = groundGeo.attributes.position;

        for (let i = 0; i < pos.count; i++) {
            const x = pos.getX(i);
            const y = pos.getY(i);
            const dune =
                Math.sin(x * 0.035) * Math.cos(y * 0.025) * 1.1 +
                Math.sin((x + y) * 0.045) * 0.45 +
                Math.cos(y * 0.08) * 0.22;
            pos.setZ(i, dune);
        }
        groundGeo.computeVertexNormals();

        const ground = new THREE.Mesh(
            groundGeo,
            this.mat(0xd9b783, { roughness: 0.95, flatShading: false })
        );
        ground.rotation.x = -Math.PI / 2;
        ground.receiveShadow = true;
        group.add(ground);

        const plaza = new THREE.Mesh(
            new THREE.CircleGeometry(10, 48),
            this.mat(0xe9c99a, { roughness: 0.9, metalness: 0 })
        );
        plaza.rotation.x = -Math.PI / 2;
        plaza.position.y = 0.55;
        plaza.receiveShadow = true;
        group.add(plaza);

        const ring = new THREE.Mesh(
            new THREE.RingGeometry(5.8, 7.2, 48),
            new THREE.MeshBasicMaterial({ color: 0xf0c48a, transparent: true, opacity: 0.26, side: THREE.DoubleSide })
        );
        ring.rotation.x = -Math.PI / 2;
        ring.position.y = 0.58;
        group.add(ring);

        const grid = new THREE.GridHelper(size, 36, 0xc7a67f, 0xc7a67f);
        grid.position.y = 0.2;
        grid.material.transparent = true;
        grid.material.opacity = 0.22;
        group.add(grid);

        return { group, ground };
    }

    static createHorizonBand() {
        const group = new THREE.Group();
        const backMat = this.mat(0xd7975d, { roughness: 1, flatShading: false });
        const farMat = this.mat(0xc77738, { roughness: 1, flatShading: false });

        [-75, -35, 35, 75].forEach((x, index) => {
            const mound = new THREE.Mesh(new THREE.BoxGeometry(34, 3 + index % 2, 8), backMat);
            mound.position.set(x, 1.2, -58 - Math.abs(index - 1.5) * 2);
            mound.rotation.y = (index - 1.5) * 0.08;
            mound.scale.x = 1 + index * 0.08;
            group.add(mound);
        });

        [-48, 2, 54].forEach((x, index) => {
            const dune = new THREE.Mesh(new THREE.ConeGeometry(16, 5, 5), farMat);
            dune.position.set(x, 1.6, -72);
            dune.rotation.y = Math.PI / 4 + index * 0.25;
            dune.scale.y = 0.45;
            group.add(dune);
        });

        return this.withShadow(group);
    }

    static createWesternBuilding({ label = 'LAND OFFICES', color = 0x8f3f16, trim = 0x2a1208, width = 8, depth = 6, height = 4 } = {}) {
        const group = new THREE.Group();
        const wallMat = this.mat(color, { roughness: 0.72 });
        const trimMat = this.mat(trim, { roughness: 0.65 });
        const signMat = this.mat(0x100806, { roughness: 0.5 });

        const body = new THREE.Mesh(new THREE.BoxGeometry(width, height, depth), wallMat);
        body.position.y = height / 2;
        group.add(body);

        const falseFront = new THREE.Mesh(new THREE.BoxGeometry(width + 1.2, height * 0.45, 0.55), wallMat);
        falseFront.position.set(0, height + height * 0.2, depth / 2 + 0.18);
        group.add(falseFront);

        const roof = new THREE.Mesh(new THREE.BoxGeometry(width + 0.8, 0.45, depth + 0.8), trimMat);
        roof.position.y = height + 0.25;
        group.add(roof);

        const porch = new THREE.Mesh(new THREE.BoxGeometry(width + 1.6, 0.35, 2.8), trimMat);
        porch.position.set(0, 0.35, depth / 2 + 1.1);
        group.add(porch);

        const door = new THREE.Mesh(new THREE.BoxGeometry(1.15, 2.2, 0.18), this.mat(0x170a05));
        door.position.set(0, 1.1, depth / 2 + 0.12);
        group.add(door);

        [-1, 1].forEach(side => {
            const post = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.16, 3.2, 6), trimMat);
            post.position.set(side * (width / 2 - 0.65), 1.75, depth / 2 + 1.1);
            group.add(post);

            const windowFrame = new THREE.Mesh(new THREE.BoxGeometry(1.2, 1.05, 0.14), trimMat);
            windowFrame.position.set(side * 2.3, 2.35, depth / 2 + 0.1);
            group.add(windowFrame);

            const glass = new THREE.Mesh(
                new THREE.PlaneGeometry(0.82, 0.68),
                new THREE.MeshBasicMaterial({ color: 0xf0d2a2, transparent: true, opacity: 0.48 })
            );
            glass.position.set(side * 2.3, 2.35, depth / 2 + 0.18);
            group.add(glass);
        });

        const sign = new THREE.Mesh(new THREE.BoxGeometry(width * 0.72, 1, 0.2), signMat);
        sign.position.set(0, height + height * 0.22, depth / 2 + 0.5);
        group.add(sign);

        const signText = this.createTextSprite(label, { fontSize: 40, bg: 'rgba(0,0,0,0)', color: '#f6d4a0', width: 512, height: 96, scale: [5.6, 1.05, 1] });
        signText.position.set(0, height + height * 0.22, depth / 2 + 0.64);
        group.add(signText);

        return this.withShadow(group);
    }

    static createBillboard({ title = 'MARKET', subtitle = 'live signals', width = 22, height = 13, chart = true } = {}) {
        const group = new THREE.Group();
        const frameMat = this.mat(0x020204, { roughness: 0.55, metalness: 0.2 });
        const screenTex = this.createScreenTexture({ title, subtitle, chart });
        const screenMat = new THREE.MeshBasicMaterial({ map: screenTex, toneMapped: false });

        const screen = new THREE.Mesh(new THREE.PlaneGeometry(width, height), screenMat);
        screen.position.y = height / 2 + 4;
        group.add(screen);

        const frameTop = new THREE.Mesh(new THREE.BoxGeometry(width + 1.1, 0.55, 0.55), frameMat);
        frameTop.position.set(0, height + 4.3, -0.12);
        group.add(frameTop);
        const frameBottom = frameTop.clone();
        frameBottom.position.y = 3.7;
        group.add(frameBottom);
        [-1, 1].forEach(side => {
            const frame = new THREE.Mesh(new THREE.BoxGeometry(0.55, height + 1.1, 0.55), frameMat);
            frame.position.set(side * (width / 2 + 0.28), height / 2 + 4, -0.12);
            group.add(frame);

            const leg = new THREE.Mesh(new THREE.BoxGeometry(0.7, 4.4, 0.75), frameMat);
            leg.position.set(side * (width / 2 - 1.2), 1.9, -0.28);
            group.add(leg);
        });

        return this.withShadow(group);
    }

    static createPedestal() {
        const group = new THREE.Group();
        const column = new THREE.Mesh(new THREE.CylinderGeometry(1.9, 2.3, 15, 32), this.mat(0x070b18, { roughness: 0.52, metalness: 0.12, flatShading: false }));
        column.position.y = 7.5;
        group.add(column);

        const coin = new THREE.Mesh(new THREE.CylinderGeometry(2.4, 2.4, 0.45, 32), this.mat(0xe2a032, { roughness: 0.35, metalness: 0.45, flatShading: false }));
        coin.position.y = 16;
        coin.rotation.z = Math.PI / 2;
        group.add(coin);

        const logo = this.createTextSprite('three.ws', { fontSize: 40, bg: 'rgba(0,0,0,0)', color: '#ffffff', width: 256, height: 128, scale: [3.8, 1.8, 1] });
        logo.position.set(0, 16, 0.35);
        group.add(logo);

        return this.withShadow(group);
    }

    static createCactus(scale = 1) {
        const group = new THREE.Group();
        const mat = this.mat(0x386326, { roughness: 0.9 });
        const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.42 * scale, 0.5 * scale, 3.2 * scale, 7), mat);
        trunk.position.y = 1.6 * scale;
        group.add(trunk);

        [-1, 1].forEach(side => {
            const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.22 * scale, 0.25 * scale, 1.6 * scale, 7), mat);
            arm.position.set(side * 0.7 * scale, 1.85 * scale, 0);
            arm.rotation.z = side * Math.PI / 2.2;
            group.add(arm);
            const tip = new THREE.Mesh(new THREE.CylinderGeometry(0.2 * scale, 0.22 * scale, 1.1 * scale, 7), mat);
            tip.position.set(side * 1.25 * scale, 2.4 * scale, 0);
            group.add(tip);
        });

        return this.withShadow(group);
    }

    static createLowPolyRock(scale = 1) {
        const rock = new THREE.Mesh(
            new THREE.DodecahedronGeometry(scale, 0),
            this.mat(0x6b563f, { roughness: 1 })
        );
        rock.scale.set(1.35, 0.62, 0.9);
        rock.rotation.set(Math.random() * 0.5, Math.random() * Math.PI, Math.random() * 0.4);
        return this.withShadow(rock);
    }

    static createHumanoid(color = 0xf05a36, options = {}) {
        const group = new THREE.Group();
        const skin = this.mat(options.skin ?? 0x2b1714, { roughness: 0.78 });
        const shirt = this.mat(color, { roughness: 0.7 });
        const dark = this.mat(0x111015, { roughness: 0.8 });
        const accent = this.mat(options.accent ?? 0xff8a3d, { roughness: 0.7 });

        const hips = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.35, 0.55), dark);
        hips.position.y = 0.85;
        group.add(hips);

        const torso = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.42, 0.9, 6), shirt);
        torso.position.y = 1.32;
        group.add(torso);

        const head = new THREE.Mesh(new THREE.IcosahedronGeometry(0.28, 1), skin);
        head.position.y = 2.05;
        group.add(head);

        const hair = new THREE.Mesh(new THREE.ConeGeometry(0.32, 0.38, 6), dark);
        hair.position.y = 2.28;
        group.add(hair);

        const limbMat = options.isPlayer ? accent : dark;
        const armGeo = new THREE.CylinderGeometry(0.075, 0.095, 0.78, 5);
        const legGeo = new THREE.CylinderGeometry(0.095, 0.12, 0.82, 5);
        const bootGeo = new THREE.BoxGeometry(0.22, 0.12, 0.34);

        const leftArm = new THREE.Mesh(armGeo, limbMat);
        leftArm.position.set(-0.48, 1.32, 0);
        group.add(leftArm);
        const rightArm = new THREE.Mesh(armGeo, limbMat);
        rightArm.position.set(0.48, 1.32, 0);
        group.add(rightArm);

        const leftLeg = new THREE.Mesh(legGeo, accent);
        leftLeg.position.set(-0.18, 0.45, 0);
        group.add(leftLeg);
        const rightLeg = new THREE.Mesh(legGeo, accent);
        rightLeg.position.set(0.18, 0.45, 0);
        group.add(rightLeg);

        const leftBoot = new THREE.Mesh(bootGeo, dark);
        leftBoot.position.set(-0.18, 0.06, 0.08);
        group.add(leftBoot);
        const rightBoot = leftBoot.clone();
        rightBoot.position.x = 0.18;
        group.add(rightBoot);

        const ring = new THREE.Mesh(
            new THREE.RingGeometry(0.52, 0.68, 32),
            new THREE.MeshBasicMaterial({ color: options.ring ?? 0xf5d2a2, transparent: true, opacity: options.isPlayer ? 0.45 : 0.18, side: THREE.DoubleSide })
        );
        ring.rotation.x = -Math.PI / 2;
        ring.position.y = 0.04;
        group.add(ring);

        group.userData.parts = { leftArm, rightArm, leftLeg, rightLeg, ring };
        return this.withShadow(group);
    }

    static createTextSprite(text, options = {}) {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        const width = options.width ?? 512;
        const height = options.height ?? 128;
        canvas.width = width;
        canvas.height = height;

        if (options.bg !== 'rgba(0,0,0,0)') {
            ctx.fillStyle = options.bg ?? 'rgba(0,0,0,0.62)';
            this.roundRect(ctx, 8, 8, width - 16, height - 16, options.radius ?? 12);
            ctx.fill();
        }

        ctx.font = `700 ${options.fontSize ?? 44}px 'Space Grotesk', sans-serif`;
        ctx.fillStyle = options.color ?? '#ffffff';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(text, width / 2, height / 2);

        const texture = new THREE.CanvasTexture(canvas);
        const material = new THREE.SpriteMaterial({ map: texture, transparent: true, depthTest: false });
        const sprite = new THREE.Sprite(material);
        const scale = options.scale ?? [8, 2, 1];
        sprite.scale.set(...scale);
        return sprite;
    }

    static createScreenTexture({ title, subtitle, chart }) {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        canvas.width = 1024;
        canvas.height = 512;
        ctx.fillStyle = '#302b31';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        ctx.fillStyle = '#ffffff';
        ctx.font = '700 42px Space Grotesk, sans-serif';
        ctx.fillText(title, 46, 70);
        ctx.fillStyle = '#e4bd98';
        ctx.font = '700 30px JetBrains Mono, monospace';
        ctx.fillText(chart ? 'A PLACE TO EXIST.' : 'ECONOMY · NEXT CHAPTER', 46, 135);

        if (chart) {
            ctx.fillStyle = '#edceb0';
            ctx.font = '700 76px Space Grotesk, sans-serif';
            ctx.fillText('BUILD. WORK.', 46, 270);
            ctx.fillText('DISCOVER.', 46, 358);
        } else {
            ctx.fillStyle = '#98a69d';
            ctx.font = '700 100px Space Grotesk, sans-serif';
            ctx.fillText('LOCKED', 46, 300);
            ctx.font = '400 32px Space Grotesk, sans-serif';
            ctx.fillText('Agent-to-agent interactions', 46, 368);
        }

        ctx.fillStyle = '#9aa0aa';
        ctx.font = '600 22px Inter, Arial, sans-serif';
        ctx.fillText(subtitle, 46, 470);
        return new THREE.CanvasTexture(canvas);
    }

    static roundRect(ctx, x, y, w, h, r) {
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
}

