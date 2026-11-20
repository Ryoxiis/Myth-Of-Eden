/**
 * Le monde : ambiance de nuit (ciel, lune, ombres, éclairage d'environnement), terrain,
 * et création à la demande des objets décrits dans layout.js, case par case (streaming).
 */
import { DirectionalLight } from '@babylonjs/core/Lights/directionalLight';
import { HemisphericLight } from '@babylonjs/core/Lights/hemisphericLight';
import { PointLight } from '@babylonjs/core/Lights/pointLight';
import { Light } from '@babylonjs/core/Lights/light';
import { ShadowGenerator } from '@babylonjs/core/Lights/Shadows/shadowGenerator';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import { Color3, Color4 } from '@babylonjs/core/Maths/math.color';
import { TransformNode } from '@babylonjs/core/Meshes/transformNode';
import { CreateBox } from '@babylonjs/core/Meshes/Builders/boxBuilder';
import { CreateSphere } from '@babylonjs/core/Meshes/Builders/sphereBuilder';
import { CreateDisc } from '@babylonjs/core/Meshes/Builders/discBuilder';
import { CreatePlane } from '@babylonjs/core/Meshes/Builders/planeBuilder';
import { CreateCylinder } from '@babylonjs/core/Meshes/Builders/cylinderBuilder';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import { Texture } from '@babylonjs/core/Materials/Textures/texture';
import { CubeTexture } from '@babylonjs/core/Materials/Textures/cubeTexture';
import { DynamicTexture } from '@babylonjs/core/Materials/Textures/dynamicTexture';
import { ParticleSystem } from '@babylonjs/core/Particles/particleSystem';
import '@babylonjs/core/Particles/particleSystemComponent';
import { LoadAssetContainerAsync } from '@babylonjs/core/Loading/sceneLoader';
import '@babylonjs/loaders/glTF/2.0';

import { random } from './noise.js';
import { Terrain } from './terrain.js';
import { buildLayout, HOME, HOME_DOOR, SMALL_PROPS } from './layout.js';
import { Streamer } from './streamer.js';
import { GrassField } from './grass.js';

/** Nombre de lampes réellement allumées : on les déplace vers les lanternes les plus proches. */
const LIGHT_POOL = 6;

export const QUALITY = {
    low: { label: 'Basse', shadowSize: 1024, grass: 0.35, ssao: false, bloom: false, scale: 1.25, loadRadius: 60 },
    medium: { label: 'Moyenne', shadowSize: 2048, grass: 0.7, ssao: false, bloom: true, scale: 1, loadRadius: 75 },
    high: { label: 'Haute', shadowSize: 4096, grass: 1, ssao: true, bloom: true, scale: 1, loadRadius: 90 },
};

export class World {
    constructor(scene, assetsUrl, quality = QUALITY.medium) {
        this.scene = scene;
        this.assetsUrl = assetsUrl;
        this.quality = quality;
        this.containers = new Map();
        this.lanterns = new Set();
        this.animated = [];
        this.veils = new Set();
        this.home = HOME;
    }

    async build(onProgress = () => {}) {
        this.createAtmosphere();
        onProgress(0.1, 'Le soleil se couche sur le village…');

        this.terrain = new Terrain(this.scene, this.assetsUrl);
        this.terrain.build();
        onProgress(0.2, 'Le relief se dessine…');

        // Plan de la carte → cases du streamer (rien n'est encore chargé).
        this.objects = new Streamer((item) => this.spawn(item), {
            cellSize: 24,
            loadRadius: this.quality.loadRadius,
            unloadRadius: this.quality.loadRadius + 20,
            budget: 2,
        });
        for (const item of buildLayout()) this.objects.add(item);

        const buildings = [
            { x: HOME.x, z: HOME.z, r: 5.5 }, { x: 7, z: -14, r: 5 }, { x: 15, z: 13, r: 9.5 },
            { x: -17, z: -15, r: 6.5 }, { x: 0, z: 0, r: 2.5 },
        ];
        this.grass = new GrassField(this.scene, this.assetsUrl, this.terrain, { density: this.quality.grass, avoid: buildings });
        this.grassCells = new Streamer((item) => Promise.resolve(this.grass.spawn(item)), {
            cellSize: 16, loadRadius: 34, unloadRadius: 44, budget: 3,
        });
        for (const item of this.grass.items(16)) this.grassCells.add(item);

        this.createLightPool();
        this.createFireflies();
        return this;
    }

    /** Charge les environs du point d'apparition avant de lancer la partie. */
    async preload(position, onProgress = () => {}) {
        await this.objects.preload(position.x, position.z, (p) => onProgress(p * 0.85));
        await this.grassCells.preload(position.x, position.z, (p) => onProgress(0.85 + p * 0.15));
        this.updateLightPool(position);
    }

    /* ------------------------------------------------------------------ */
    /* Ciel, brouillard, lumières                                          */
    /* ------------------------------------------------------------------ */

    createAtmosphere() {
        const scene = this.scene;
        scene.clearColor = new Color4(0.03, 0.035, 0.05, 1);
        scene.ambientColor = new Color3(0.1, 0.1, 0.13);
        scene.fogMode = 2; // EXP2
        scene.fogDensity = 0.019;
        scene.fogColor = new Color3(0.05, 0.06, 0.085);

        // Éclairage d'environnement (IBL) : reflets doux et réalistes sur les matériaux PBR.
        const env = CubeTexture.CreateFromPrefilteredData(`${this.assetsUrl}textures/night.env`, scene);
        scene.environmentTexture = env;
        scene.environmentIntensity = 0.32;

        const moonDirection = new Vector3(0.45, -0.75, 0.5).normalize();
        const moon = new DirectionalLight('moon', moonDirection, scene);
        moon.intensity = 1.15;
        moon.diffuse = new Color3(0.62, 0.72, 1);
        moon.specular = new Color3(0.3, 0.35, 0.5);
        moon.autoUpdateExtends = false;
        moon.shadowMinZ = 1;
        moon.shadowMaxZ = 160;
        const extent = 36;
        moon.orthoLeft = -extent;
        moon.orthoRight = extent;
        moon.orthoTop = extent;
        moon.orthoBottom = -extent;
        this.moon = moon;
        this.moonDirection = moonDirection;

        const sky = new HemisphericLight('skyFill', new Vector3(0, 1, 0), scene);
        sky.intensity = 0.4;
        sky.diffuse = new Color3(0.42, 0.5, 0.75);
        sky.groundColor = new Color3(0.12, 0.09, 0.06);
        sky.specular = Color3.Black();

        // Les ombres suivent le joueur : seuls les objets proches (déjà chargés) en projettent.
        const shadows = new ShadowGenerator(this.quality.shadowSize, moon);
        shadows.usePercentageCloserFiltering = true;
        shadows.filteringQuality = ShadowGenerator.QUALITY_MEDIUM;
        shadows.bias = 0.0012;
        shadows.normalBias = 0.02;
        shadows.darkness = 0.22;
        this.shadows = shadows;

        this.createSky(moonDirection);
    }

    createSky(moonDirection) {
        const scene = this.scene;
        const texture = new DynamicTexture('skyTexture', { width: 2048, height: 1024 }, scene, false);
        const ctx = texture.getContext();
        const gradient = ctx.createLinearGradient(0, 0, 0, 1024);
        gradient.addColorStop(0, '#02030a');
        gradient.addColorStop(0.32, '#060a17');
        gradient.addColorStop(0.45, '#141c2b');
        gradient.addColorStop(0.5, '#262833');
        gradient.addColorStop(0.53, '#0b0c0e');
        gradient.addColorStop(1, '#050505');
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, 2048, 1024);

        const rand = random(42);
        for (let i = 0; i < 1800; i += 1) {
            const x = rand() * 2048;
            const y = Math.pow(rand(), 1.3) * 480;
            const size = rand() < 0.94 ? 0.6 + rand() * 0.8 : 1.5 + rand() * 1.2;
            ctx.globalAlpha = 0.3 + rand() * 0.7;
            ctx.fillStyle = rand() < 0.15 ? '#ffe9c4' : '#dfe8ff';
            ctx.beginPath();
            ctx.arc(x, y, size, 0, Math.PI * 2);
            ctx.fill();
        }
        ctx.globalAlpha = 0.07;
        for (let i = 0; i < 260; i += 1) {
            const x = rand() * 2048;
            const y = 170 + Math.sin(x / 2048 * Math.PI * 2) * 120 + (rand() - 0.5) * 90;
            const glow = ctx.createRadialGradient(x, y, 0, x, y, 42);
            glow.addColorStop(0, '#9fb2ff');
            glow.addColorStop(1, 'rgba(159,178,255,0)');
            ctx.fillStyle = glow;
            ctx.fillRect(x - 42, y - 42, 84, 84);
        }
        ctx.globalAlpha = 1;
        texture.update(true);

        const material = new StandardMaterial('skyMaterial', scene);
        material.emissiveTexture = texture;
        material.disableLighting = true;
        material.backFaceCulling = false;
        material.fogEnabled = false;
        const dome = CreateSphere('sky', { diameter: 800, segments: 24 }, scene);
        dome.material = material;
        dome.infiniteDistance = true;
        dome.isPickable = false;
        dome.applyFog = false;

        const moonMaterial = new StandardMaterial('moonDisc', scene);
        moonMaterial.emissiveColor = new Color3(0.95, 0.97, 1);
        moonMaterial.disableLighting = true;
        moonMaterial.fogEnabled = false;
        const disc = CreateDisc('moonDisc', { radius: 9, tessellation: 48 }, scene);
        disc.material = moonMaterial;
        disc.position = moonDirection.scale(-330);
        disc.billboardMode = 7;
        disc.infiniteDistance = true;
        disc.applyFog = false;
    }

    /** Petit groupe de lampes partagé par toutes les lanternes : pas de recompilation de shaders. */
    createLightPool() {
        this.lightPool = [];
        for (let i = 0; i < LIGHT_POOL; i += 1) {
            const light = new PointLight(`lamp${i}`, new Vector3(0, -50, 0), this.scene);
            light.diffuse = new Color3(1, 0.62, 0.3);
            light.specular = new Color3(0.6, 0.4, 0.2);
            light.range = 14;
            light.intensity = 0;
            // Atténuation linéaire jusqu'à la portée : même rendu sur le terrain et sur les modèles PBR.
            light.falloffType = Light.FALLOFF_STANDARD;
            this.lightPool.push({ light, source: null, seed: i * 17.3 });
        }
    }

    updateLightPool(position) {
        const sources = [...this.lanterns]
            .map((source) => [Math.hypot(source.position.x - position.x, source.position.z - position.z), source])
            .filter(([distance]) => distance < 55)
            .sort((a, b) => a[0] - b[0])
            .slice(0, LIGHT_POOL);
        this.lightPool.forEach((slot, i) => {
            const entry = sources[i];
            slot.source = entry ? entry[1] : null;
            if (slot.source) {
                slot.light.position.copyFrom(slot.source.position);
                slot.light.diffuse.copyFrom(slot.source.color);
                slot.light.range = slot.source.range;
            } else {
                slot.light.intensity = 0;
            }
        });
    }

    /* ------------------------------------------------------------------ */
    /* Création des objets (appelée par le streamer)                       */
    /* ------------------------------------------------------------------ */

    container(name) {
        if (!this.containers.has(name)) {
            this.containers.set(name, LoadAssetContainerAsync(`${this.assetsUrl}village/${name}.glb`, this.scene).then((container) => {
                for (const material of container.materials) material.maxSimultaneousLights = 10;
                for (const mesh of container.meshes) {
                    mesh.receiveShadows = true;
                    mesh.isPickable = false;
                    // LOD : les petits objets disparaissent au loin (le brouillard masque la transition).
                    if (mesh.getTotalVertices() > 0) {
                        if (SMALL_PROPS.has(name)) mesh.addLODLevel(42, null);
                        else if (name.startsWith('tree')) mesh.addLODLevel(110, null);
                    }
                }
                return container;
            }));
        }
        return this.containers.get(name);
    }

    async spawn(item) {
        if (item.type === 'ruinVeil') return this.spawnVeil(item);
        if (item.type !== 'model') return null;

        const container = await this.container(item.model);
        const holder = new TransformNode(item.model, this.scene);
        holder.position.set(item.x, item.y, item.z);
        holder.rotation.y = item.rotation;
        holder.scaling.setAll(item.scale);

        // Instances : la géométrie est partagée, le GPU dessine toutes les copies d'un coup.
        const entries = container.instantiateModelsToScene((n) => n, false, { doNotInstantiate: false });
        for (const node of entries.rootNodes) node.parent = holder;

        const meshes = holder.getChildMeshes(false);
        holder.computeWorldMatrix(true);
        for (const mesh of meshes) {
            mesh.computeWorldMatrix(true);
            mesh.isPickable = false;
            if (item.cast) this.shadows.addShadowCaster(mesh, false);
        }

        const disposables = [holder];
        if (item.collider || item.lantern) {
            const { min, max } = holder.getHierarchyBoundingVectors(true);
            if (item.collider === 'box') disposables.push(this.boxCollider(min, max, item.shrink));
            else if (item.collider === 'trunk') disposables.push(this.trunkCollider(item.x, item.z, 0.5 * item.scale));
            if (item.lantern) disposables.push(...this.addLantern(item, min, max));
        }
        for (const mesh of meshes) mesh.freezeWorldMatrix();

        return () => {
            for (const mesh of holder.getChildMeshes(false)) this.shadows.removeShadowCaster(mesh, false);
            for (const object of disposables) object.dispose();
            for (const group of entries.animationGroups) group.dispose();
        };
    }

    boxCollider(min, max, shrink) {
        const size = max.subtract(min);
        const height = Math.max(2, size.y);
        const box = CreateBox('collider', { width: Math.max(0.3, size.x * shrink), depth: Math.max(0.3, size.z * shrink), height }, this.scene);
        box.position.set((min.x + max.x) / 2, min.y + height / 2, (min.z + max.z) / 2);
        return this.finishCollider(box);
    }

    trunkCollider(x, z, radius) {
        const trunk = CreateCylinder('collider', { diameter: radius * 2, height: 4, tessellation: 8 }, this.scene);
        trunk.position.set(x, 2, z);
        return this.finishCollider(trunk);
    }

    finishCollider(mesh) {
        mesh.isVisible = false;
        mesh.isPickable = false;
        mesh.checkCollisions = true;
        mesh.freezeWorldMatrix();
        return mesh;
    }

    addLantern(item, min, max) {
        const top = max.y - 1.0;
        const alongX = max.x - min.x > max.z - min.z;
        const heads = [];
        if (item.model === 'lightPost3') {
            heads.push(alongX ? new Vector3(min.x + 0.25, top, item.z) : new Vector3(item.x, top, min.z + 0.25));
            heads.push(alongX ? new Vector3(max.x - 0.25, top, item.z) : new Vector3(item.x, top, max.z - 0.25));
        } else {
            const farX = Math.abs(max.x - item.x) > Math.abs(min.x - item.x) ? max.x - 0.2 : min.x + 0.2;
            const farZ = Math.abs(max.z - item.z) > Math.abs(min.z - item.z) ? max.z - 0.2 : min.z + 0.2;
            heads.push(alongX ? new Vector3(farX, top, item.z) : new Vector3(item.x, top, farZ));
        }

        this.lanternMaterial ??= (() => {
            const material = new StandardMaterial('lanternGlow', this.scene);
            material.emissiveColor = new Color3(1, 0.62, 0.25);
            material.disableLighting = true;
            return material;
        })();

        const disposables = [];
        for (const head of heads) {
            const bulb = CreateSphere('lanternBulb', { diameter: 0.2, segments: 8 }, this.scene);
            bulb.material = this.lanternMaterial;
            bulb.position.copyFrom(head);
            bulb.isPickable = false;
            const source = { position: head.add(new Vector3(0, -0.2, 0)), color: new Color3(1, 0.62, 0.3), intensity: 1.7, range: 13 };
            this.lanterns.add(source);
            disposables.push({ dispose: () => { this.lanterns.delete(source); bulb.dispose(); } });
        }
        return disposables;
    }

    /** Voile turquoise sous l'arche de la ruine : il repousse le joueur (pour l'instant). */
    spawnVeil(item) {
        const scene = this.scene;
        this.veilMask ??= (() => {
            const mask = new DynamicTexture('veilMask', 256, scene, false);
            const ctx = mask.getContext();
            const radial = ctx.createRadialGradient(128, 128, 10, 128, 128, 128);
            radial.addColorStop(0, 'rgba(255,255,255,1)');
            radial.addColorStop(0.6, 'rgba(255,255,255,0.7)');
            radial.addColorStop(1, 'rgba(255,255,255,0)');
            ctx.fillStyle = radial;
            ctx.fillRect(0, 0, 256, 256);
            mask.hasAlpha = true;
            mask.update();
            return mask;
        })();

        const material = new StandardMaterial('ruinVeil', scene);
        material.emissiveColor = new Color3(0.2, 0.85, 0.95);
        material.diffuseColor = Color3.Black();
        material.opacityTexture = this.veilMask;
        material.disableLighting = true;
        material.backFaceCulling = false;
        material.alpha = 0.75;
        const plane = CreatePlane('ruinVeil', { width: 4.6, height: 4 }, scene);
        plane.material = material;
        plane.position.set(item.x - 0.2, 1.9, item.z);
        plane.isPickable = false;
        const pulse = { type: 'pulse', material };
        this.animated.push(pulse);

        const barrier = this.boxCollider(new Vector3(item.x - 2.6, 0, item.z - 0.4), new Vector3(item.x + 2.4, 4, item.z + 0.4), 1);

        const source = { position: new Vector3(item.x, 2.2, item.z + 2), color: new Color3(0.25, 0.85, 1), intensity: 2.6, range: 20 };
        this.lanterns.add(source);
        const veil = { x: item.x, z: item.z };
        this.veils.add(veil);

        const sparks = new ParticleSystem('ruinSparks', 160, scene);
        sparks.particleTexture = new Texture(`${this.assetsUrl}textures/flare2.png`, scene);
        sparks.emitter = new Vector3(item.x, 0.4, item.z);
        sparks.minEmitBox = new Vector3(-2.4, 0, -0.6);
        sparks.maxEmitBox = new Vector3(2.4, 3, 0.6);
        sparks.color1 = new Color4(0.4, 0.95, 1, 1);
        sparks.color2 = new Color4(0.15, 0.6, 0.9, 1);
        sparks.colorDead = new Color4(0, 0.2, 0.3, 0);
        sparks.minSize = 0.05;
        sparks.maxSize = 0.16;
        sparks.minLifeTime = 1.5;
        sparks.maxLifeTime = 3.5;
        sparks.emitRate = 40;
        sparks.direction1 = new Vector3(-0.2, 0.6, -0.2);
        sparks.direction2 = new Vector3(0.2, 1.2, 0.2);
        sparks.minEmitPower = 0.3;
        sparks.maxEmitPower = 0.8;
        sparks.blendMode = ParticleSystem.BLENDMODE_ADD;
        sparks.start();

        return () => {
            this.animated.splice(this.animated.indexOf(pulse), 1);
            this.lanterns.delete(source);
            this.veils.delete(veil);
            sparks.dispose();
            plane.dispose();
            material.dispose();
            barrier.dispose();
        };
    }

    createFireflies() {
        const fireflies = new ParticleSystem('fireflies', 260, this.scene);
        fireflies.particleTexture = new Texture(`${this.assetsUrl}textures/flare2.png`, this.scene);
        fireflies.emitter = new Vector3(0, 0, 0);
        fireflies.minEmitBox = new Vector3(-26, 0.3, -26);
        fireflies.maxEmitBox = new Vector3(26, 3.4, 26);
        fireflies.color1 = new Color4(1, 0.85, 0.4, 1);
        fireflies.color2 = new Color4(0.75, 1, 0.45, 1);
        fireflies.colorDead = new Color4(0.4, 0.5, 0.1, 0);
        fireflies.minSize = 0.05;
        fireflies.maxSize = 0.11;
        fireflies.minLifeTime = 3;
        fireflies.maxLifeTime = 7;
        fireflies.emitRate = 34;
        fireflies.direction1 = new Vector3(-0.3, -0.1, -0.3);
        fireflies.direction2 = new Vector3(0.3, 0.2, 0.3);
        fireflies.minEmitPower = 0.1;
        fireflies.maxEmitPower = 0.35;
        fireflies.updateSpeed = 0.01;
        fireflies.blendMode = ParticleSystem.BLENDMODE_ADD;
        fireflies.preWarmCycles = 300;
        fireflies.start();
        this.fireflies = fireflies;
    }

    get homeDoor() {
        return new Vector3(HOME_DOOR.x, 0, HOME_DOOR.z);
    }

    /** Distance au voile le plus proche (pour afficher un message quand le joueur s'en approche). */
    nearestVeil(position) {
        let best = Infinity;
        for (const veil of this.veils) best = Math.min(best, Math.hypot(veil.x - position.x, veil.z - position.z));
        return best;
    }

    /**
     * À chaque image : animations d'ambiance, ombres et lucioles centrées sur le joueur.
     * Le streaming (plus coûteux) est cadencé par streamTick().
     */
    update(time, position) {
        for (const slot of this.lightPool) {
            if (!slot.source) continue;
            const s = slot.seed;
            const noise = Math.sin(time * 7.3 + s) * 0.5 + Math.sin(time * 13.1 + s * 2) * 0.3 + Math.sin(time * 2.1 + s) * 0.2;
            slot.light.intensity = slot.source.intensity * (1 + noise * 0.12);
        }
        for (const item of this.animated) {
            if (item.type === 'pulse') item.material.alpha = 0.55 + Math.sin(time * 1.6) * 0.2;
        }
        if (position) {
            // Boîte d'ombre recentrée sur le joueur (alignée sur une grille pour éviter le scintillement).
            const snap = 2;
            const cx = Math.round(position.x / snap) * snap;
            const cz = Math.round(position.z / snap) * snap;
            this.moon.position.set(cx - this.moonDirection.x * 80, -this.moonDirection.y * 80, cz - this.moonDirection.z * 80);
            this.fireflies.emitter.set(position.x, 0, position.z);
            this.grass.update(time, position.x, position.z);
        }
    }

    /** Charge / décharge les cases autour du joueur (appelé quelques fois par seconde). */
    async streamTick(position) {
        if (this.streaming) return;
        this.streaming = true;
        try {
            await Promise.all([
                this.objects.update(position.x, position.z),
                this.grassCells.update(position.x, position.z),
            ]);
            this.updateLightPool(position);
        } finally {
            this.streaming = false;
        }
    }

    setGrassDensity(density) {
        this.grass.density = density;
        for (const cell of this.grassCells.cells.values()) {
            if (cell.state === 'loaded') this.grassCells.unload(cell);
        }
    }

    get stats() {
        return { objects: this.objects.stats, grass: this.grassCells.stats, lights: this.lightPool.filter((slot) => slot.source).length };
    }
}
