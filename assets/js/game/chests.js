/**
 * Coffres de butin : ils apparaissent là où un monstre est tombé, scintillent de la couleur
 * de leur plus bel objet (avec un rayon de lumière pour les objets rares et mieux),
 * s'ouvrent avec E et restent tant qu'il reste quelque chose dedans.
 */
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import { Color3, Color4 } from '@babylonjs/core/Maths/math.color';
import { TransformNode } from '@babylonjs/core/Meshes/transformNode';
import { CreateCylinder } from '@babylonjs/core/Meshes/Builders/cylinderBuilder';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import { DynamicTexture } from '@babylonjs/core/Materials/Textures/dynamicTexture';
import { Texture } from '@babylonjs/core/Materials/Textures/texture';
import { ParticleSystem } from '@babylonjs/core/Particles/particleSystem';
import { LoadAssetContainerAsync } from '@babylonjs/core/Loading/sceneLoader';
import '@babylonjs/loaders/glTF/2.0';

import { heightAt } from './terrain.js';

const RANK = { common: 0, uncommon: 1, rare: 2, epic: 3, legendary: 4, cosmic: 5, omniversal: 6 };
export const OPEN_DISTANCE = 2.6;

export class ChestManager {
    constructor(scene, assetsUrl, shadows) {
        this.scene = scene;
        this.assetsUrl = assetsUrl;
        this.shadows = shadows;
        this.chests = new Map();
        this.containers = new Map();
        this.texture = new Texture(`${assetsUrl}textures/flare2.png`, scene);
    }

    container(name) {
        if (!this.containers.has(name)) {
            this.containers.set(name, LoadAssetContainerAsync(`${this.assetsUrl}equipment/${name}.glb`, this.scene));
        }
        return this.containers.get(name);
    }

    beamTexture() {
        this.beamMask ??= (() => {
            const texture = new DynamicTexture('beamMask', { width: 64, height: 256 }, this.scene, false);
            const ctx = texture.getContext();
            const gradient = ctx.createLinearGradient(0, 0, 0, 256);
            gradient.addColorStop(0, 'rgba(255,255,255,0)');
            gradient.addColorStop(0.7, 'rgba(255,255,255,0.55)');
            gradient.addColorStop(1, 'rgba(255,255,255,0.9)');
            ctx.fillStyle = gradient;
            ctx.fillRect(0, 0, 64, 256);
            texture.hasAlpha = true;
            texture.update();
            return texture;
        })();
        return this.beamMask;
    }

    /** Ajoute (ou met à jour) un coffre venant de l'API. */
    async add(data, { fresh = false } = {}) {
        if (this.chests.has(data.id)) {
            this.chests.get(data.id).data = data;
            return this.chests.get(data.id);
        }
        const rank = RANK[data.bestRarity] ?? 0;
        const model = data.boss || rank >= 3 ? 'chest_gold' : 'chest';
        const container = await this.container(model);
        const entries = container.instantiateModelsToScene((name) => name, false, { doNotInstantiate: true });

        const holder = new TransformNode(`chest-${data.id}`, this.scene);
        const y = heightAt(data.x, data.z);
        holder.position.set(data.x, y, data.z);
        holder.rotation.y = (data.id * 2.4) % (Math.PI * 2);
        holder.scaling.setAll(0.75);
        for (const node of entries.rootNodes) node.parent = holder;
        const meshes = holder.getChildMeshes(false);
        for (const mesh of meshes) {
            mesh.isPickable = false;
            mesh.receiveShadows = true;
            this.shadows.addShadowCaster(mesh, false);
        }
        const lid = holder.getDescendants(false, (node) => node.name.startsWith('chest_lid'))[0] ?? null;

        const color = Color3.FromHexString(data.bestRarity === 'cosmic' ? '#7a3cff' : data.bestColor ?? '#ffffff');
        const sparkles = new ParticleSystem('chestSparkles', 120, this.scene);
        sparkles.particleTexture = this.texture;
        sparkles.emitter = new Vector3(data.x, y + 0.6, data.z);
        sparkles.minEmitBox = new Vector3(-0.6, 0, -0.5);
        sparkles.maxEmitBox = new Vector3(0.6, 0.6, 0.5);
        sparkles.color1 = new Color4(color.r, color.g, color.b, 1);
        sparkles.color2 = new Color4(1, 0.95, 0.75, 1);
        sparkles.colorDead = new Color4(color.r, color.g, color.b, 0);
        sparkles.minSize = 0.04;
        sparkles.maxSize = 0.12 + rank * 0.02;
        sparkles.minLifeTime = 0.6;
        sparkles.maxLifeTime = 1.4;
        sparkles.emitRate = 25 + rank * 12;
        sparkles.direction1 = new Vector3(-0.2, 0.6, -0.2);
        sparkles.direction2 = new Vector3(0.2, 1.4, 0.2);
        sparkles.minEmitPower = 0.3;
        sparkles.maxEmitPower = 0.8;
        sparkles.blendMode = ParticleSystem.BLENDMODE_ADD;
        sparkles.start();

        // Rayon de lumière vertical, visible de loin, pour les objets rares et au-delà.
        let beam = null;
        if (rank >= 2) {
            beam = CreateCylinder('lootBeam', { height: 9 + rank * 2, diameterTop: 0.15, diameterBottom: 0.5 + rank * 0.08, tessellation: 16 }, this.scene);
            const material = new StandardMaterial('lootBeam', this.scene);
            material.emissiveColor = color.scale(1.4);
            material.disableLighting = true;
            material.opacityTexture = this.beamTexture();
            material.backFaceCulling = false;
            material.fogEnabled = false;
            beam.material = material;
            beam.isPickable = false;
            beam.position.set(data.x, y + (9 + rank * 2) / 2, data.z);
        }

        const chest = {
            id: data.id,
            data,
            holder,
            lid,
            position: new Vector3(data.x, y, data.z),
            opened: false,
            appear: fresh ? 0 : 1,
            dispose: () => {
                for (const mesh of holder.getChildMeshes(false)) this.shadows.removeShadowCaster(mesh, false);
                sparkles.dispose();
                beam?.material?.dispose();
                beam?.dispose();
                holder.dispose();
            },
        };
        if (fresh) holder.scaling.setAll(0.01);
        this.chests.set(data.id, chest);
        return chest;
    }

    open(chest) {
        chest.opened = true;
        chest.lidTarget = -1.9;
    }

    close(chest) {
        if (chest) chest.lidTarget = 0;
    }

    remove(id) {
        const chest = this.chests.get(id);
        if (!chest) return;
        chest.closing = 0;
        chest.lidTarget = 0;
    }

    nearest(position) {
        let best = null;
        let bestDistance = OPEN_DISTANCE;
        for (const chest of this.chests.values()) {
            if (chest.closing !== undefined) continue;
            const distance = Math.hypot(chest.position.x - position.x, chest.position.z - position.z);
            if (distance < bestDistance) {
                best = chest;
                bestDistance = distance;
            }
        }
        return best;
    }

    update(dt, time) {
        for (const chest of [...this.chests.values()]) {
            if (chest.appear < 1) {
                // Apparition : le coffre surgit avec un petit rebond.
                chest.appear = Math.min(1, chest.appear + dt * 2.2);
                const t = chest.appear;
                const bounce = 1 + Math.sin(t * Math.PI) * 0.25;
                chest.holder.scaling.setAll(0.75 * t * bounce);
            }
            if (chest.lid && chest.lidTarget !== undefined) {
                chest.lid.rotation.x += (chest.lidTarget - chest.lid.rotation.x) * Math.min(1, dt * 8);
                if (chest.lid.rotationQuaternion) chest.lid.rotationQuaternion = null;
            }
            if (!chest.opened) chest.holder.position.y = chest.position.y + Math.max(0, Math.sin(time * 2.4 + chest.id)) * 0.04;
            if (chest.closing !== undefined) {
                chest.closing += dt;
                chest.holder.scaling.setAll(Math.max(0.001, 0.75 * (1 - chest.closing / 0.6)));
                if (chest.closing >= 0.6) {
                    chest.dispose();
                    this.chests.delete(chest.id);
                }
            }
        }
    }
}
