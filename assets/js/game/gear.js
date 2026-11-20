/**
 * Équipement visible sur le personnage : l'arme et le bouclier équipés sont fixés aux mains
 * (os handslot.r / handslot.l) et prennent l'apparence de leur rareté :
 * taille, couleur, lueur, particules… jusqu'à la matière « galaxie » de l'omniversel.
 * Les pièces d'armure (sans modèle) donnent une aura colorée aux pieds du personnage.
 */
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import { Color3, Color4 } from '@babylonjs/core/Maths/math.color';
import { TransformNode } from '@babylonjs/core/Meshes/transformNode';
import { CreateTorus } from '@babylonjs/core/Meshes/Builders/torusBuilder';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import { DynamicTexture } from '@babylonjs/core/Materials/Textures/dynamicTexture';
import { Texture } from '@babylonjs/core/Materials/Textures/texture';
import { ParticleSystem } from '@babylonjs/core/Particles/particleSystem';
import { LoadAssetContainerAsync } from '@babylonjs/core/Loading/sceneLoader';
import '@babylonjs/loaders/glTF/2.0';

import { random } from './noise.js';

export const RARITY_LOOK = {
    common: { scale: 1, glow: 0, particles: 0 },
    uncommon: { scale: 1.06, glow: 0.14, particles: 0 },
    rare: { scale: 1.12, glow: 0.32, particles: 18 },
    epic: { scale: 1.2, glow: 0.55, particles: 40 },
    legendary: { scale: 1.3, glow: 0.8, particles: 70 },
    cosmic: { scale: 1.36, glow: 0.6, particles: 80 },
    omniversal: { scale: 1.45, glow: 1, particles: 110 },
};
const RANK = { common: 0, uncommon: 1, rare: 2, epic: 3, legendary: 4, cosmic: 5, omniversal: 6 };
const ARMOR_SLOTS = ['head', 'body', 'hands', 'feet', 'accessory'];

export class PlayerGear {
    constructor(scene, player, assetsUrl) {
        this.scene = scene;
        this.player = player;
        this.assetsUrl = assetsUrl;
        this.containers = new Map();
        this.materials = new Map();
        this.attached = [];
        this.signature = '';
        this.texture = new Texture(`${assetsUrl}textures/flare2.png`, scene);
        this.time = 0;
    }

    container(path) {
        if (!this.containers.has(path)) {
            this.containers.set(path, LoadAssetContainerAsync(`${this.assetsUrl.replace(/models\/$/, '')}${path}`, this.scene));
        }
        return this.containers.get(path);
    }

    /** Texture « galaxie » animée (nébuleuses + étoiles) pour la rareté omniverselle. */
    galaxyTexture() {
        this.galaxy ??= (() => {
            const texture = new DynamicTexture('galaxy', 512, this.scene, true);
            const ctx = texture.getContext();
            ctx.fillStyle = '#05010f';
            ctx.fillRect(0, 0, 512, 512);
            const rand = random(1987);
            const colors = ['#ff3fd0', '#5b3cff', '#22d3ee', '#a855f7', '#f472b6', '#38bdf8'];
            for (let i = 0; i < 26; i += 1) {
                const x = rand() * 512;
                const y = rand() * 512;
                const r = 50 + rand() * 120;
                const glow = ctx.createRadialGradient(x, y, 0, x, y, r);
                glow.addColorStop(0, `${colors[i % colors.length]}aa`);
                glow.addColorStop(1, 'rgba(0,0,0,0)');
                ctx.fillStyle = glow;
                ctx.fillRect(x - r, y - r, r * 2, r * 2);
            }
            for (let i = 0; i < 700; i += 1) {
                ctx.fillStyle = rand() < 0.2 ? '#ffe9ff' : '#ffffff';
                ctx.globalAlpha = 0.4 + rand() * 0.6;
                ctx.fillRect(rand() * 512, rand() * 512, rand() < 0.9 ? 1 : 2, rand() < 0.9 ? 1 : 2);
            }
            ctx.globalAlpha = 1;
            texture.update();
            texture.wrapU = Texture.WRAP_ADDRESSMODE;
            texture.wrapV = Texture.WRAP_ADDRESSMODE;
            return texture;
        })();
        return this.galaxy;
    }

    /** Matériau d'une rareté, dérivé du matériau d'origine (mis en cache). */
    rarityMaterial(material, rarity, color) {
        if (!material || rarity === 'common') return material;
        const key = `${material.uniqueId}:${rarity}`;
        if (!this.materials.has(key)) {
            const clone = material.clone(`${material.name}-${rarity}`);
            const look = RARITY_LOOK[rarity];
            if (rarity === 'cosmic') {
                clone.albedoColor = new Color3(0.06, 0.04, 0.09);
                clone.emissiveColor = new Color3(0.35, 0.1, 0.65);
                clone.metallic = 1;
                clone.roughness = 0.25;
            } else if (rarity === 'omniversal') {
                clone.albedoColor = new Color3(0.2, 0.1, 0.35);
                clone.emissiveTexture = this.galaxyTexture();
                clone.emissiveColor = new Color3(1, 1, 1);
                clone.metallic = 0.6;
                clone.roughness = 0.2;
            } else {
                clone.albedoColor = Color3.Lerp(Color3.White(), color, 0.35 + look.glow * 0.3);
                clone.emissiveColor = color.scale(look.glow);
                if (RANK[rarity] >= 3) {
                    clone.metallic = 0.8;
                    clone.roughness = 0.3;
                }
            }
            this.materials.set(key, clone);
        }
        return this.materials.get(key);
    }

    particles(emitter, rarity, color, rate) {
        const system = new ParticleSystem(`gear-${rarity}`, Math.max(40, rate * 2), this.scene);
        system.particleTexture = this.texture;
        system.emitter = emitter;
        system.minEmitBox = new Vector3(-0.08, -0.1, -0.08);
        system.maxEmitBox = new Vector3(0.08, 0.6, 0.08);
        if (rarity === 'omniversal') {
            system.color1 = new Color4(1, 0.35, 0.85, 1);
            system.color2 = new Color4(0.25, 0.85, 1, 1);
        } else if (rarity === 'cosmic') {
            system.color1 = new Color4(0.5, 0.2, 1, 1);
            system.color2 = new Color4(0.05, 0.02, 0.1, 1);
        } else {
            system.color1 = new Color4(color.r, color.g, color.b, 1);
            system.color2 = new Color4(1, 1, 1, 1);
        }
        system.colorDead = new Color4(0, 0, 0, 0);
        system.minSize = 0.02;
        system.maxSize = 0.07 + RANK[rarity] * 0.012;
        system.minLifeTime = 0.3;
        system.maxLifeTime = 0.9;
        system.emitRate = rate;
        system.direction1 = new Vector3(-0.1, 0.3, -0.1);
        system.direction2 = new Vector3(0.1, 0.8, 0.1);
        system.minEmitPower = 0.1;
        system.maxEmitPower = 0.4;
        system.blendMode = ParticleSystem.BLENDMODE_ADD;
        system.start();
        return system;
    }

    /** Met à jour l'équipement visible d'après l'inventaire (ne refait rien si rien n'a changé). */
    async update(inventory) {
        const equipped = (inventory ?? []).filter((item) => item.equippedSlot);
        const signature = equipped.map((item) => `${item.id}:${item.rarity}`).join('|');
        if (signature === this.signature) return;
        this.signature = signature;

        for (const dispose of this.attached) dispose();
        this.attached = [];
        this.player.setWeaponVisible(false);

        for (const item of equipped) {
            if (!item.model || !['main_hand', 'off_hand'].includes(item.equippedSlot)) continue;
            const hand = this.player.handslot(item.equippedSlot === 'main_hand' ? 'r' : 'l');
            if (!hand) continue;
            try {
                await this.attach(item, hand);
            } catch (error) {
                console.warn('Équipement non affiché', item.code, error);
            }
        }

        // Aura d'armure : couleur de la plus belle pièce portée (à partir de « rare »).
        const armor = equipped.filter((item) => ARMOR_SLOTS.includes(item.equippedSlot)).sort((a, b) => RANK[b.rarity] - RANK[a.rarity])[0];
        if (armor && RANK[armor.rarity] >= 2) this.addAura(armor);
    }

    async attach(item, hand) {
        const container = await this.container(item.model);
        const entries = container.instantiateModelsToScene((name) => name, false, { doNotInstantiate: true });
        const holder = new TransformNode(`gear-${item.code}`, this.scene);
        holder.parent = hand;
        const look = RARITY_LOOK[item.rarity] ?? RARITY_LOOK.common;
        holder.scaling.setAll(look.scale);
        // Les nœuds sous la racine glTF sont déjà dans l'espace des os : on saute la racine (conversion de repère).
        for (const node of entries.rootNodes) {
            for (const child of node.getChildren()) child.parent = holder;
            node.dispose();
        }
        const color = Color3.FromHexString(item.rarityColor ?? '#ffffff');
        const meshes = holder.getChildMeshes(false);
        for (const mesh of meshes) {
            mesh.isPickable = false;
            mesh.material = this.rarityMaterial(mesh.material, item.rarity, color);
            this.player.shadows?.addShadowCaster(mesh, false);
        }
        const systems = [];
        if (look.particles > 0 && meshes[0]) systems.push(this.particles(meshes[0], item.rarity, color, look.particles));
        this.attached.push(() => {
            systems.forEach((system) => system.dispose());
            for (const mesh of meshes) this.player.shadows?.removeShadowCaster(mesh, false);
            holder.dispose();
        });
    }

    addAura(item) {
        const color = Color3.FromHexString(item.rarity === 'cosmic' ? '#7a3cff' : item.rarityColor ?? '#ffffff');
        const ring = CreateTorus('armorAura', { diameter: 1.3, thickness: 0.03, tessellation: 48 }, this.scene);
        const material = new StandardMaterial('armorAura', this.scene);
        material.emissiveColor = color;
        material.disableLighting = true;
        material.alpha = 0.7;
        ring.material = material;
        ring.isPickable = false;
        ring.parent = this.player.body;
        ring.position.y = 0.06;
        const system = this.particles(ring, item.rarity, color, 10 + RANK[item.rarity] * 8);
        system.minEmitBox = new Vector3(-0.6, 0, -0.6);
        system.maxEmitBox = new Vector3(0.6, 0.2, 0.6);
        this.aura = { ring, material };
        this.attached.push(() => {
            system.dispose();
            material.dispose();
            ring.dispose();
            this.aura = null;
        });
    }

    tick(dt) {
        this.time += dt;
        if (this.galaxy) {
            this.galaxy.uOffset = this.time * 0.05;
            this.galaxy.vOffset = this.time * 0.03;
        }
        if (this.aura) {
            this.aura.ring.rotation.y += dt * 0.8;
            this.aura.material.alpha = 0.45 + Math.sin(this.time * 2.5) * 0.2;
        }
    }
}
