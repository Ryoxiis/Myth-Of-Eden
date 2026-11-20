/**
 * Marchands du monde : un PNJ animé par marchand (données Symfony : position, nom, offres),
 * avec son étal (caisses, tonneau, lanterne) et une petite pièce de rune qui tourne au-dessus,
 * pour qu'on le repère de loin.
 */
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import { Color3 } from '@babylonjs/core/Maths/math.color';
import { TransformNode } from '@babylonjs/core/Meshes/transformNode';
import { CreateCylinder } from '@babylonjs/core/Meshes/Builders/cylinderBuilder';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import { LoadAssetContainerAsync } from '@babylonjs/core/Loading/sceneLoader';
import '@babylonjs/loaders/glTF/2.0';

import { heightAt } from './terrain.js';

export const TALK_DISTANCE = 3.2;
const BODY_PART = /(Arm|Body|Head|Leg|Cape|Hat|Helmet)/;

export class MerchantManager {
    constructor(scene, assetsUrl, shadows) {
        this.scene = scene;
        this.assetsUrl = assetsUrl;
        this.shadows = shadows;
        this.merchants = [];
    }

    async spawn(data) {
        const container = await LoadAssetContainerAsync(`${this.assetsUrl}monsters/bandit_rogue.glb`, this.scene);
        const entries = container.instantiateModelsToScene((name) => name, false, { doNotInstantiate: true });
        const holder = new TransformNode(`merchant-${data.code}`, this.scene);
        const y = heightAt(data.x, data.z);
        holder.position.set(data.x, y, data.z);
        holder.rotation.y = Math.atan2(-data.x, -data.z); // tourné vers la place du village
        const root = entries.rootNodes[0];
        root.parent = holder;
        root.scaling = new Vector3(0.72, 0.72, -0.72);

        for (const mesh of holder.getChildMeshes(false)) {
            const base = mesh.name.replace(/_primitive\d+$/, '');
            const keep = BODY_PART.test(base) || base === 'Mug';
            mesh.setEnabled(keep);
            mesh.isPickable = false;
            mesh.receiveShadows = true;
            if (keep) {
                this.shadows.addShadowCaster(mesh, false);
                mesh.material.maxSimultaneousLights = 10;
            }
        }

        const animations = Object.fromEntries(entries.animationGroups.map((group) => [group.name, group]));
        for (const group of entries.animationGroups) group.stop();
        animations.Idle?.start(true);

        // Pièce de rune qui tourne au-dessus de la tête.
        const coin = CreateCylinder('merchantCoin', { height: 0.06, diameter: 0.5, tessellation: 24 }, this.scene);
        const material = new StandardMaterial('merchantCoin', this.scene);
        material.emissiveColor = new Color3(0.95, 0.72, 0.3);
        material.diffuseColor = new Color3(0.4, 0.28, 0.1);
        coin.material = material;
        coin.rotation.x = Math.PI / 2;
        coin.position.set(data.x, y + 2.7, data.z);
        coin.isPickable = false;

        const merchant = { data, holder, coin, animations, position: new Vector3(data.x, y, data.z), cheerTimer: 6 };
        this.merchants.push(merchant);
        return merchant;
    }

    nearest(position) {
        let best = null;
        for (const merchant of this.merchants) {
            const distance = Math.hypot(merchant.position.x - position.x, merchant.position.z - position.z);
            if (distance < TALK_DISTANCE) best = merchant;
        }
        return best;
    }

    /** Le marchand salue de temps en temps (et quand on ouvre sa boutique). */
    greet(merchant) {
        const { Idle, Cheer, Interact } = merchant.animations;
        const wave = Cheer ?? Interact;
        if (!wave) return;
        Idle?.stop();
        wave.start(false, 1, wave.from, wave.to, false);
        wave.onAnimationGroupEndObservable.addOnce(() => Idle?.start(true));
    }

    update(dt, time, playerPosition) {
        for (const merchant of this.merchants) {
            merchant.coin.rotation.y = time * 2;
            merchant.coin.position.y = merchant.position.y + 2.7 + Math.sin(time * 2) * 0.08;
            merchant.cheerTimer -= dt;
            const near = Math.hypot(merchant.position.x - playerPosition.x, merchant.position.z - playerPosition.z) < 8;
            if (near && merchant.cheerTimer <= 0) {
                merchant.cheerTimer = 14;
                this.greet(merchant);
            }
        }
    }
}
