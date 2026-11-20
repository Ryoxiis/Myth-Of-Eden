/**
 * Le pendentif gravé : objet de quête posé devant la porte du joueur.
 * Modèle procédural (anneau doré + pierre turquoise) avec halo et étincelles.
 */
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import { Color3, Color4 } from '@babylonjs/core/Maths/math.color';
import { TransformNode } from '@babylonjs/core/Meshes/transformNode';
import { CreateTorus } from '@babylonjs/core/Meshes/Builders/torusBuilder';
import { CreateSphere } from '@babylonjs/core/Meshes/Builders/sphereBuilder';
import { CreateDisc } from '@babylonjs/core/Meshes/Builders/discBuilder';
import { PBRMaterial } from '@babylonjs/core/Materials/PBR/pbrMaterial';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import { Texture } from '@babylonjs/core/Materials/Textures/texture';
import { DynamicTexture } from '@babylonjs/core/Materials/Textures/dynamicTexture';
import { PointLight } from '@babylonjs/core/Lights/pointLight';
import { Light } from '@babylonjs/core/Lights/light';
import { ParticleSystem } from '@babylonjs/core/Particles/particleSystem';

export const PENDANT_CODE = 'engraved_pendant';

export class Pendant {
    constructor(scene, position, assetsUrl, groundMask) {
        this.scene = scene;
        this.base = position.clone();
        this.collected = false;

        const root = new TransformNode('pendant', scene);
        root.position.copyFrom(position);
        this.root = root;

        const gold = new PBRMaterial('pendantGold', scene);
        gold.albedoColor = new Color3(1, 0.76, 0.36);
        gold.metallic = 1;
        gold.roughness = 0.28;
        gold.emissiveColor = new Color3(0.25, 0.16, 0.04);

        const ring = CreateTorus('pendantRing', { diameter: 0.5, thickness: 0.07, tessellation: 32 }, scene);
        ring.material = gold;
        ring.rotation.x = Math.PI / 2;
        ring.parent = root;

        const gem = CreateSphere('pendantGem', { diameter: 0.2, segments: 16 }, scene);
        const gemMaterial = new StandardMaterial('pendantGem', scene);
        gemMaterial.emissiveColor = new Color3(0.3, 0.95, 1);
        gemMaterial.disableLighting = true;
        gem.material = gemMaterial;
        gem.parent = root;

        // Halo au sol pour qu'on le repère de loin.
        const halo = CreateDisc('pendantHalo', { radius: 0.9, tessellation: 32 }, scene);
        const haloMaterial = new StandardMaterial('pendantHalo', scene);
        haloMaterial.emissiveColor = new Color3(0.2, 0.75, 0.85);
        haloMaterial.opacityTexture = groundMask ?? Pendant.radialMask(scene);
        haloMaterial.disableLighting = true;
        haloMaterial.alpha = 0.55;
        halo.material = haloMaterial;
        halo.rotation.x = Math.PI / 2;
        halo.position.set(position.x, 0.04, position.z);
        this.halo = halo;
        this.haloMaterial = haloMaterial;

        this.light = new PointLight('pendantLight', position.add(new Vector3(0, 0.6, 0)), scene);
        this.light.diffuse = new Color3(0.3, 0.9, 1);
        this.light.specular = new Color3(0.3, 0.9, 1);
        this.light.falloffType = Light.FALLOFF_STANDARD;
        this.light.intensity = 1;
        this.light.range = 6;

        const sparkles = new ParticleSystem('pendantSparkles', 60, scene);
        sparkles.particleTexture = new Texture(`${assetsUrl}textures/flare2.png`, scene);
        sparkles.emitter = position.add(new Vector3(0, 0.3, 0));
        sparkles.minEmitBox = new Vector3(-0.3, 0, -0.3);
        sparkles.maxEmitBox = new Vector3(0.3, 0.4, 0.3);
        sparkles.color1 = new Color4(0.5, 1, 1, 1);
        sparkles.color2 = new Color4(1, 0.85, 0.5, 1);
        sparkles.colorDead = new Color4(0, 0.3, 0.4, 0);
        sparkles.minSize = 0.03;
        sparkles.maxSize = 0.08;
        sparkles.minLifeTime = 0.8;
        sparkles.maxLifeTime = 1.6;
        sparkles.emitRate = 22;
        sparkles.direction1 = new Vector3(-0.1, 0.5, -0.1);
        sparkles.direction2 = new Vector3(0.1, 1, 0.1);
        sparkles.minEmitPower = 0.2;
        sparkles.maxEmitPower = 0.5;
        sparkles.blendMode = ParticleSystem.BLENDMODE_ADD;
        sparkles.start();
        this.sparkles = sparkles;

        this.meshes = [ring, gem];
    }

    static radialMask(scene) {
        const mask = new DynamicTexture('pendantMask', 128, scene, false);
        const ctx = mask.getContext();
        const radial = ctx.createRadialGradient(64, 64, 4, 64, 64, 64);
        radial.addColorStop(0, 'rgba(255,255,255,1)');
        radial.addColorStop(1, 'rgba(255,255,255,0)');
        ctx.fillStyle = radial;
        ctx.fillRect(0, 0, 128, 128);
        mask.hasAlpha = true;
        mask.update();
        return mask;
    }

    distanceTo(position) {
        return Math.hypot(position.x - this.base.x, position.z - this.base.z);
    }

    update(time) {
        if (this.collected) return;
        this.root.position.y = this.base.y + 0.8 + Math.sin(time * 2) * 0.1;
        this.root.rotation.y = time * 1.2;
        this.light.intensity = 1 + Math.sin(time * 3) * 0.25;
        this.haloMaterial.alpha = 0.4 + Math.sin(time * 2) * 0.15;
    }

    /** Animation de ramassage : l'objet monte et s'efface. */
    collect() {
        this.collected = true;
        this.sparkles.stop();
        const start = performance.now();
        const startY = this.root.position.y;
        const observer = this.scene.onBeforeRenderObservable.add(() => {
            const t = Math.min(1, (performance.now() - start) / 700);
            this.root.position.y = startY + t * 0.9;
            this.root.scaling.setAll(1 - t);
            this.light.intensity = 1 - t;
            this.haloMaterial.alpha = 0.5 * (1 - t);
            if (t >= 1) {
                this.scene.onBeforeRenderObservable.remove(observer);
                this.dispose();
            }
        });
    }

    dispose() {
        this.collected = true;
        this.sparkles.dispose();
        this.light.dispose();
        this.halo.dispose();
        this.root.dispose();
    }
}
