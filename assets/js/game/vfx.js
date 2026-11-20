/**
 * Effets visuels des compétences : projectiles, explosions, anneaux, auras, orbe de lumière.
 * Tout est construit à la volée avec des particules et des formes simples émissives
 * (le calque de lueur les fait briller).
 */
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import { Color3, Color4 } from '@babylonjs/core/Maths/math.color';
import { CreateSphere } from '@babylonjs/core/Meshes/Builders/sphereBuilder';
import { CreateTorus } from '@babylonjs/core/Meshes/Builders/torusBuilder';
import { CreateCylinder } from '@babylonjs/core/Meshes/Builders/cylinderBuilder';
import { TrailMesh } from '@babylonjs/core/Meshes/trailMesh';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import { heightAt } from './terrain.js';
import { Texture } from '@babylonjs/core/Materials/Textures/texture';
import { ParticleSystem } from '@babylonjs/core/Particles/particleSystem';

/** Couleur principale de chaque effet. */
export const EFFECT_COLORS = {
    arrow: new Color3(1, 0.85, 0.55),
    arcane: new Color3(0.55, 0.45, 1),
    fire: new Color3(1, 0.45, 0.12),
    frost: new Color3(0.55, 0.85, 1),
    slash: new Color3(1, 0.92, 0.75),
    whirl: new Color3(1, 0.8, 0.45),
    stone: new Color3(0.75, 0.7, 0.62),
    shield: new Color3(0.35, 0.8, 1),
    heal: new Color3(0.45, 1, 0.55),
    wind: new Color3(0.8, 0.95, 1),
    smoke: new Color3(0.55, 0.55, 0.6),
    sense: new Color3(1, 0.85, 0.35),
    light: new Color3(1, 0.93, 0.7),
    leaf: new Color3(0.45, 0.85, 0.3),
};

export class Effects {
    constructor(scene, assetsUrl, spellLight) {
        this.scene = scene;
        this.texture = new Texture(`${assetsUrl}textures/flare2.png`, scene);
        this.spellLight = spellLight;
        this.active = [];
        this.materials = new Map();
        this.lightTimer = 0;
    }

    material(color, alpha = 1) {
        const key = `${color.toHexString()}-${alpha}`;
        if (!this.materials.has(key)) {
            const material = new StandardMaterial(`fx${key}`, this.scene);
            material.emissiveColor = color.clone();
            material.diffuseColor = Color3.Black();
            material.specularColor = Color3.Black();
            material.disableLighting = true;
            material.alpha = alpha;
            material.backFaceCulling = false;
            this.materials.set(key, material);
        }
        return this.materials.get(key);
    }

    particles(name, color, { capacity = 120, emitter, size = [0.08, 0.2], life = [0.3, 0.8], rate = 0, power = [0.5, 2], gravity = 0, box = 0.15, spread = 1 } = {}) {
        const system = new ParticleSystem(name, capacity, this.scene);
        system.particleTexture = this.texture;
        system.emitter = emitter;
        system.minEmitBox = new Vector3(-box, -box, -box);
        system.maxEmitBox = new Vector3(box, box, box);
        system.color1 = new Color4(color.r, color.g, color.b, 1);
        system.color2 = new Color4(Math.min(1, color.r * 1.2), Math.min(1, color.g * 1.2), Math.min(1, color.b * 1.2), 1);
        system.colorDead = new Color4(color.r * 0.3, color.g * 0.3, color.b * 0.3, 0);
        system.minSize = size[0];
        system.maxSize = size[1];
        system.minLifeTime = life[0];
        system.maxLifeTime = life[1];
        system.emitRate = rate;
        system.minEmitPower = power[0];
        system.maxEmitPower = power[1];
        system.direction1 = new Vector3(-spread, -spread, -spread);
        system.direction2 = new Vector3(spread, spread, spread);
        system.gravity = new Vector3(0, gravity, 0);
        system.blendMode = ParticleSystem.BLENDMODE_ADD;
        return system;
    }

    /** Flash de la lumière réservée aux sorts. */
    flash(position, color, intensity = 2.5, duration = 0.35, range = 10) {
        const light = this.spellLight;
        if (this.orbUntil && performance.now() < this.orbUntil) return; // l'orbe de lumière a la priorité
        light.position.copyFrom(position);
        light.diffuse.copyFrom(color);
        light.range = range;
        light.intensity = intensity;
        this.lightTimer = duration;
        this.lightFull = intensity;
        this.lightDuration = duration;
    }

    /** Gerbe de particules ponctuelle (impact, explosion). */
    burst(position, color, { count = 80, power = 4, size = [0.08, 0.25], life = [0.25, 0.7], gravity = -2 } = {}) {
        const system = this.particles('burst', color, { capacity: count, emitter: position.clone(), size, life, power: [power * 0.4, power], gravity });
        system.manualEmitCount = count;
        system.disposeOnStop = true;
        system.targetStopDuration = 0.2;
        system.start();
        this.flash(position, color, 2.4, 0.35);
    }

    /**
     * Projectile qui file en ligne droite. onStep(position) renvoie true s'il touche quelque chose.
     */
    projectile(origin, direction, { color, speed = 20, range = 25, size = 0.22, elongated = false, trail = true, onStep, onEnd }) {
        const mesh = elongated
            ? CreateCylinder('projectile', { height: 0.9, diameterTop: 0.03, diameterBottom: 0.06, tessellation: 6 }, this.scene)
            : CreateSphere('projectile', { diameter: size, segments: 8 }, this.scene);
        mesh.material = this.material(color);
        mesh.isPickable = false;
        mesh.position.copyFrom(origin);
        if (elongated) {
            mesh.rotation.x = Math.PI / 2;
            mesh.rotation.y = Math.atan2(direction.x, direction.z);
        }

        mesh.computeWorldMatrix(true);
        // Traînée lumineuse : rend la trajectoire lisible (technique « trail » des jeux d'action).
        const ribbon = new TrailMesh('ribbon', mesh, this.scene, { diameter: elongated ? 0.06 : size * 0.7, length: elongated ? 18 : 26, autoStart: true });
        const ribbonMaterial = this.material(color, 0.55).clone('ribbonMaterial');
        ribbon.material = ribbonMaterial;
        ribbon.isPickable = false;

        let tail = null;
        if (trail) {
            tail = this.particles('trail', color, { capacity: 160, emitter: mesh, size: [size * 0.3, size * 0.8], life: [0.15, 0.4], rate: 140, power: [0, 0.3], box: 0.04 });
            tail.start();
        }

        let travelled = 0;
        let finished = false;
        const finish = () => {
            if (finished) return;
            finished = true;
            tail?.stop();
            if (tail) setTimeout(() => tail.dispose(), 500);
            ribbon.stop();
            setTimeout(() => {
                ribbon.dispose();
                ribbonMaterial.dispose();
            }, 250);
            mesh.isVisible = false;
            setTimeout(() => mesh.dispose(), 260);
        };
        this.active.push({
            update: (dt) => {
                const step = speed * dt;
                mesh.position.addInPlace(direction.scale(step));
                travelled += step;
                const hit = onStep?.(mesh.position);
                if (hit || travelled >= range || !Number.isFinite(mesh.position.y)) {
                    // Le projectile est nettoyé même si la suite (dégâts, victoire…) échoue.
                    try {
                        onEnd?.(mesh.position.clone(), hit);
                        if (hit) this.ring(mesh.position, color, 1.2, 0.3, mesh.position.y);
                    } finally {
                        finish();
                    }
                    return false;
                }
                return true;
            },
            dispose: finish,
        });
    }

    /** Anneau qui s'élargit au sol (onde de choc, givre, tourbillon). */
    ring(center, color, radius, duration = 0.5, height = null) {
        const ring = CreateTorus('ring', { diameter: 1, thickness: 0.08, tessellation: 48 }, this.scene);
        const material = this.material(color, 0.9).clone('ringMaterial');
        ring.material = material;
        ring.isPickable = false;
        // Par défaut, juste au-dessus du sol à cet endroit (le terrain n'est pas plat).
        ring.position.set(center.x, height ?? heightAt(center.x, center.z) + 0.15, center.z);
        let t = 0;
        this.active.push({
            update: (dt) => {
                t += dt / duration;
                const s = 0.3 + t * radius * 2;
                ring.scaling.set(s, 1, s);
                material.alpha = Math.max(0, 0.9 * (1 - t));
                if (t >= 1) {
                    ring.dispose();
                    material.dispose();
                    return false;
                }
                return true;
            },
            dispose: () => {
                ring.dispose();
                material.dispose();
            },
        });
    }

    /** Arc de lame devant le personnage. */
    slash(position, angle, color, radius = 2) {
        const arc = CreateTorus('slash', { diameter: radius * 2, thickness: 0.06, tessellation: 32, arc: 0.35 }, this.scene);
        const material = this.material(color, 0.95).clone('slashMaterial');
        arc.material = material;
        arc.isPickable = false;
        arc.position.set(position.x, 1.1, position.z);
        arc.rotation.set(0.25, angle + Math.PI * 0.85, 0);
        let t = 0;
        this.active.push({
            update: (dt) => {
                t += dt / 0.28;
                arc.rotation.y -= dt * 7;
                material.alpha = Math.max(0, 0.95 * (1 - t));
                if (t >= 1) {
                    arc.dispose();
                    material.dispose();
                    return false;
                }
                return true;
            },
            dispose: () => {
                arc.dispose();
                material.dispose();
            },
        });
    }

    /** Aura qui suit un nœud (bouclier, cri de guerre, soin…). */
    aura(node, color, duration, { bubble = false, rising = true } = {}) {
        const emitter = node;
        const system = this.particles('aura', color, {
            capacity: 200, emitter, size: [0.06, 0.16], life: [0.6, 1.2], rate: 70, power: rising ? [0.4, 1] : [0.1, 0.3], box: 0.6, spread: 0.3,
        });
        system.direction1 = new Vector3(-0.2, rising ? 1 : -0.2, -0.2);
        system.direction2 = new Vector3(0.2, rising ? 1.6 : 0.2, 0.2);
        system.minEmitBox = new Vector3(-0.6, 0, -0.6);
        system.maxEmitBox = new Vector3(0.6, 1.8, 0.6);
        system.start();

        let sphere = null;
        let material = null;
        if (bubble) {
            sphere = CreateSphere('bubble', { diameter: 2.4, segments: 24 }, this.scene);
            material = this.material(color, 0.18).clone('bubbleMaterial');
            sphere.material = material;
            sphere.isPickable = false;
            sphere.parent = node;
            sphere.position.y = 1;
        }

        let t = 0;
        this.active.push({
            update: (dt) => {
                t += dt;
                if (material) material.alpha = 0.12 + Math.sin(t * 5) * 0.05;
                if (t >= duration) {
                    system.stop();
                    setTimeout(() => system.dispose(), 1300);
                    sphere?.dispose();
                    material?.dispose();
                    return false;
                }
                return true;
            },
            dispose: () => {
                system.dispose();
                sphere?.dispose();
                material?.dispose();
            },
        });
    }

    /** Orbe de lumière qui flotte au-dessus de l'épaule pendant `duration` secondes. */
    lightOrb(node, duration) {
        const orb = CreateSphere('lightOrb', { diameter: 0.28, segments: 12 }, this.scene);
        orb.material = this.material(EFFECT_COLORS.light);
        orb.isPickable = false;
        const sparkles = this.particles('orb', EFFECT_COLORS.light, { capacity: 60, emitter: orb, size: [0.03, 0.08], life: [0.4, 0.9], rate: 30, power: [0.1, 0.3], box: 0.05 });
        sparkles.start();
        this.orbUntil = performance.now() + duration * 1000;
        const light = this.spellLight;
        light.diffuse.copyFrom(EFFECT_COLORS.light);
        light.range = 16;
        let t = 0;
        this.active.push({
            update: (dt) => {
                t += dt;
                orb.position.set(node.position.x + Math.cos(t * 1.4) * 0.7, 2.4 + Math.sin(t * 2.2) * 0.15, node.position.z + Math.sin(t * 1.4) * 0.7);
                light.position.copyFrom(orb.position);
                const fade = Math.min(1, (duration - t) / 1.5);
                light.intensity = 2.2 * Math.max(0, fade);
                if (t >= duration) {
                    sparkles.stop();
                    setTimeout(() => sparkles.dispose(), 1000);
                    orb.dispose();
                    this.orbUntil = 0;
                    light.intensity = 0;
                    return false;
                }
                return true;
            },
            dispose: () => {
                sparkles.dispose();
                orb.dispose();
                this.orbUntil = 0;
                light.intensity = 0;
            },
        });
    }

    /** Feu de camp temporaire (particules + lueur), appel de onTick chaque seconde. */
    campfire(position, duration, onTick) {
        const fire = this.particles('campfire', EFFECT_COLORS.fire, {
            capacity: 300, emitter: position.clone(), size: [0.15, 0.45], life: [0.4, 0.9], rate: 160, power: [0.6, 1.4], box: 0.25, spread: 0.2,
        });
        fire.direction1 = new Vector3(-0.2, 1, -0.2);
        fire.direction2 = new Vector3(0.2, 2, 0.2);
        fire.start();
        let t = 0;
        let tick = 0;
        this.active.push({
            update: (dt) => {
                t += dt;
                tick += dt;
                if (!this.orbUntil || performance.now() > this.orbUntil) {
                    this.spellLight.position.set(position.x, 1, position.z);
                    this.spellLight.diffuse.copyFrom(EFFECT_COLORS.fire);
                    this.spellLight.range = 12;
                    this.spellLight.intensity = 1.8 + Math.sin(t * 13) * 0.25;
                }
                if (tick >= 1) {
                    tick = 0;
                    onTick?.();
                }
                if (t >= duration) {
                    fire.stop();
                    setTimeout(() => fire.dispose(), 1000);
                    this.spellLight.intensity = 0;
                    return false;
                }
                return true;
            },
            dispose: () => {
                fire.dispose();
                this.spellLight.intensity = 0;
            },
        });
    }

    update(dt) {
        // Un effet qui plante est retiré (et nettoyé) sans bloquer les autres : sinon tous les
        // anneaux, halos et projectiles en cours resteraient figés à l'écran.
        this.active = this.active.filter((effect) => {
            try {
                return effect.update(dt);
            } catch (error) {
                console.error('[effets]', error);
                try {
                    effect.dispose?.();
                } catch {
                    // rien de plus à nettoyer
                }
                return false;
            }
        });
        if (this.lightTimer > 0) {
            this.lightTimer -= dt;
            this.spellLight.intensity = this.lightFull * Math.max(0, this.lightTimer / this.lightDuration);
        }
    }
}
