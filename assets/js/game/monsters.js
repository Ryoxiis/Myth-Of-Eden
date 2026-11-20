/**
 * Monstres du monde ouvert : placement par zone (nombre et niveaux venus de Symfony),
 * chargement par cases autour du joueur (streaming), intelligence simple
 * (errance, poursuite, attaque, retour au point d'apparition), mort et réapparition.
 */
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import { Color3 } from '@babylonjs/core/Maths/math.color';
import { TransformNode } from '@babylonjs/core/Meshes/transformNode';
import { LoadAssetContainerAsync } from '@babylonjs/core/Loading/sceneLoader';
import '@babylonjs/loaders/glTF/2.0';

import { random } from './noise.js';
import { heightAt, isWalkable, zoneAt, walkableDistance, RUIN_CENTER } from './terrain.js';
import { Streamer } from './streamer.js';

const MODEL_SCALE = 0.72;
const AGGRO = { normal: 11, elite: 14, boss: 20 };
const RESPAWN = { normal: 45, elite: 90, boss: 240 };
const LEASH = 34;
const ACTIVE_DISTANCE = 40; // au-delà, le monstre est figé (pas d'IA ni d'animation)
const SHADOW_DISTANCE = 22; // seuls les monstres proches projettent une ombre (coût de rendu)

/** Emplacements fixes des boss. */
const BOSS_SPOTS = {
    brannoc: { x: 122, z: -42 },
    ruin_warden: { x: RUIN_CENTER.x, z: RUIN_CENTER.z - 3 },
};

const lerpAngle = (from, to, t) => {
    let delta = (to - from) % (Math.PI * 2);
    if (delta > Math.PI) delta -= Math.PI * 2;
    if (delta < -Math.PI) delta += Math.PI * 2;
    return from + delta * Math.min(1, t);
};

/* -------------------------------------------------------------------------- */
/* Un monstre                                                                 */
/* -------------------------------------------------------------------------- */

class Monster {
    constructor(manager, spawn, type, instance) {
        this.manager = manager;
        this.spawn = spawn;
        this.type = type;
        this.level = spawn.level;
        this.name = type.name;
        this.tier = type.tier;
        this.maxHp = Math.round(type.health * (1 + 0.3 * (this.level - 1)));
        this.hp = this.maxHp;
        this.damage = Math.round(type.damage * (1 + 0.22 * (this.level - 1)));
        this.ranged = type.attackRange > 4;
        this.state = 'idle';
        this.stateTime = Math.random() * 3;
        this.attackCooldown = 0;
        this.hitTime = 0;
        this.root = instance.holder;
        this.meshes = instance.meshes;
        this.animations = instance.animations;
        this.dispose = instance.dispose;
        this.current = null;
        this.wanderTarget = null;
        this.frozen = false;
        this.root.position.set(spawn.x, heightAt(spawn.x, spawn.z), spawn.z);
        this.root.rotation.y = Math.random() * Math.PI * 2;
        this.play('Idle');
    }

    get alive() {
        return this.hp > 0;
    }

    get position() {
        return this.root.position;
    }

    get center() {
        return this.root.position.add(new Vector3(0, 1.1 * this.type.scale, 0));
    }

    /** Point au-dessus de la tête (barre de vie). */
    get top() {
        return this.root.position.add(new Vector3(0, 2.25 * this.type.scale, 0));
    }

    get radius() {
        return 0.55 * this.type.scale;
    }

    play(name, loop = true, speed = 1) {
        const group = this.animations[name] ?? this.animations.Idle;
        if (!group) return null;
        if (this.current === group && loop) return group;
        this.current?.stop();
        group.start(loop, speed, group.from, group.to, false);
        this.current = group;
        return group;
    }

    /** Reçoit un coup du joueur. */
    hit(amount, from) {
        if (!this.alive) return 0;
        this.hp = Math.max(0, this.hp - amount);
        this.flash = 0.12;
        for (const mesh of this.meshes) {
            mesh.renderOverlay = true;
            mesh.overlayColor = Color3.White();
            mesh.overlayAlpha = 0.55;
        }
        if (!this.alive) {
            this.die();
            return amount;
        }
        if (this.state !== 'attack' && this.tier === 'normal') {
            this.play('Hit_A', false);
            this.hitTime = 0.35;
            // Petit recul dans le sens du coup.
            if (from) {
                const push = this.position.subtract(from);
                push.y = 0;
                if (push.lengthSquared() > 0.01) this.position.addInPlace(push.normalize().scale(0.25));
            }
        }
        this.aggro();
        return amount;
    }

    aggro() {
        if (this.state === 'idle' || this.state === 'wander') this.setState('chase');
    }

    setState(state) {
        this.state = state;
        this.stateTime = 0;
    }

    die() {
        this.setState('dead');
        this.play(this.animations.Death_C_Skeletons ? 'Death_C_Skeletons' : 'Death_A', false);
        this.manager.onKill(this);
    }

    faceTowards(target, dt, speed = 10) {
        const angle = Math.atan2(target.x - this.position.x, target.z - this.position.z);
        this.root.rotation.y = lerpAngle(this.root.rotation.y, angle, dt * speed);
    }

    moveTowards(target, speed, dt) {
        const direction = target.subtract(this.position);
        direction.y = 0;
        const distance = direction.length();
        if (distance < 0.05) return distance;
        const step = Math.min(distance, speed * dt);
        const next = this.position.add(direction.scale(step / distance));
        if (!isWalkable(next.x, next.z, 1)) return distance;
        next.y = heightAt(next.x, next.z);
        this.position.copyFrom(next);
        this.faceTowards(target, dt);
        return distance - step;
    }

    update(dt, player, playerAlive) {
        if (this.flash > 0) {
            this.flash -= dt;
            if (this.flash <= 0) for (const mesh of this.meshes) mesh.renderOverlay = false;
        }

        if (this.state === 'dead') {
            this.stateTime += dt;
            // Le corps s'enfonce dans le sol puis disparaît.
            if (this.stateTime > 2.5) this.position.y -= dt * 0.6;
            if (this.stateTime > 4.5) this.root.setEnabled(false);
            return;
        }

        const toPlayer = player.position.subtract(this.position);
        toPlayer.y = 0;
        const distance = toPlayer.length();
        this.manager.setShadow(this, distance < SHADOW_DISTANCE);

        // Économie : loin du joueur, le monstre est figé.
        const frozen = distance > ACTIVE_DISTANCE;
        if (frozen !== this.frozen) {
            this.frozen = frozen;
            if (frozen) this.current?.pause();
            else this.current?.play(true);
        }
        if (frozen) return;

        this.stateTime += dt;
        this.attackCooldown = Math.max(0, this.attackCooldown - dt);
        if (this.hitTime > 0) {
            this.hitTime -= dt;
            return;
        }

        const home = new Vector3(this.spawn.x, 0, this.spawn.z);
        const fromHome = Math.hypot(this.position.x - home.x, this.position.z - home.z);
        const aggroRadius = AGGRO[this.tier] ?? 11;
        const safe = this.manager.isSafe(player.position);

        switch (this.state) {
            case 'idle':
                this.play('Idle');
                if (playerAlive && !safe && distance < aggroRadius) {
                    this.setState('chase');
                    this.manager.onAggro(this);
                } else if (this.stateTime > 3 + (this.spawn.id % 5)) {
                    const angle = Math.random() * Math.PI * 2;
                    const r = 2 + Math.random() * 6;
                    this.wanderTarget = new Vector3(home.x + Math.cos(angle) * r, 0, home.z + Math.sin(angle) * r);
                    this.setState('wander');
                }
                break;
            case 'wander':
                this.play(this.animations.Walking_D_Skeletons ? 'Walking_D_Skeletons' : 'Walking_A');
                if (playerAlive && !safe && distance < aggroRadius) {
                    this.setState('chase');
                    this.manager.onAggro(this);
                } else if (this.moveTowards(this.wanderTarget, this.type.speed * 0.45, dt) < 0.2 || this.stateTime > 8) {
                    this.setState('idle');
                }
                break;
            case 'chase': {
                if (!playerAlive || safe || fromHome > LEASH) {
                    this.setState('return');
                    break;
                }
                const reach = this.type.attackRange + (this.ranged ? 0 : this.radius);
                if (distance <= reach) {
                    this.faceTowards(player.position, dt, 14);
                    if (this.attackCooldown <= 0) this.startAttack();
                    else this.play(this.animations.Idle_Combat ? 'Idle_Combat' : 'Idle');
                } else {
                    this.play('Running_A');
                    this.moveTowards(player.position, this.type.speed * 1.2, dt);
                }
                break;
            }
            case 'attack':
                this.faceTowards(player.position, dt, 8);
                if (!this.attackDone && this.stateTime >= this.windup) {
                    this.attackDone = true;
                    this.manager.resolveAttack(this, distance);
                }
                if (this.stateTime >= this.windup + 0.45) this.setState('chase');
                break;
            case 'return':
                this.play('Running_A');
                this.hp = Math.min(this.maxHp, this.hp + this.maxHp * dt * 0.4);
                if (this.moveTowards(home, this.type.speed * 1.3, dt) < 0.5) {
                    this.hp = this.maxHp;
                    this.setState('idle');
                }
                break;
            default:
                break;
        }
    }

    startAttack() {
        this.setState('attack');
        this.attackDone = false;
        this.windup = this.ranged ? 0.55 : 0.42;
        this.attackCooldown = this.tier === 'boss' ? 1.5 : this.ranged ? 2.4 : 1.8;
        const animation = this.ranged
            ? (this.type.model.includes('mage') ? 'Spellcast_Shoot' : '1H_Ranged_Shoot')
            : (this.type.scale > 1.3 ? '2H_Melee_Attack_Chop' : '1H_Melee_Attack_Chop');
        this.play(animation, false, 1.1);
    }
}

/* -------------------------------------------------------------------------- */
/* Gestionnaire                                                                */
/* -------------------------------------------------------------------------- */

export class MonsterManager {
    /**
     * @param {object} options
     * @param {(monster) => void} options.onKill    victoire (le serveur tire le butin)
     * @param {(amount, monster) => void} options.onPlayerHit
     */
    constructor({ scene, assetsUrl, shadows, effects, player, onKill, onPlayerHit, onAggro }) {
        this.scene = scene;
        this.assetsUrl = assetsUrl;
        this.shadows = shadows;
        this.effects = effects;
        this.player = player;
        this.onKillCallback = onKill;
        this.onPlayerHit = onPlayerHit;
        this.onAggroCallback = onAggro;
        this.containers = new Map();
        this.tintedMaterials = new Map();
        this.active = new Set();
        this.spawns = [];
        this.zones = new Map();
    }

    /** Prépare tous les points d'apparition à partir du catalogue /api/monde. */
    init(world) {
        let id = 0;
        for (const zone of world.zones) {
            this.zones.set(zone.code, zone);
            const rand = random(zone.code.split('').reduce((sum, c) => sum + c.charCodeAt(0) * 31, 7));
            for (const type of zone.monsters) {
                for (let n = 0; n < type.population; n += 1) {
                    let spot = BOSS_SPOTS[type.code] ?? null;
                    for (let attempt = 0; !spot && attempt < 60; attempt += 1) {
                        const x = (rand() * 2 - 1) * 150;
                        const z = (rand() * 2 - 1) * 150;
                        if (zoneAt(x, z) !== zone.code || !isWalkable(x, z, 6) || Math.hypot(x, z) < 42) continue;
                        if (walkableDistance(x, z) < -1 && rand() < 0.6) continue; // un peu moins sur les routes
                        spot = { x, z };
                    }
                    if (!spot) continue;
                    const level = type.tier === 'boss'
                        ? type.maxLevel
                        : Math.min(type.maxLevel, type.minLevel + Math.floor(rand() * (zone.maxLevel - zone.minLevel + 1)));
                    this.spawns.push({ id: id += 1, type, zone: zone.code, x: spot.x, z: spot.z, level, deadUntil: 0 });
                }
            }
        }

        this.streamer = new Streamer((spawn) => this.spawnMonster(spawn), { cellSize: 24, loadRadius: 46, unloadRadius: 62, budget: 2 });
        for (const spawn of this.spawns) this.streamer.add(spawn);
    }

    isSafe(position) {
        return this.zones.get(zoneAt(position.x, position.z))?.safe ?? false;
    }

    container(model) {
        if (!this.containers.has(model)) {
            this.containers.set(model, LoadAssetContainerAsync(`${this.assetsUrl}monsters/${model}.glb`, this.scene).then((container) => {
                for (const material of container.materials) material.maxSimultaneousLights = 10;
                return container;
            }));
        }
        return this.containers.get(model);
    }

    equipment(model) {
        const key = `eq:${model}`;
        if (!this.containers.has(key)) {
            this.containers.set(key, LoadAssetContainerAsync(`${this.assetsUrl}equipment/${model}.glb`, this.scene));
        }
        return this.containers.get(key);
    }

    /** Matériau teinté partagé par tous les monstres du même type. */
    tinted(material, tint) {
        if (!tint || !material) return material;
        const key = `${material.uniqueId}:${tint}`;
        if (!this.tintedMaterials.has(key)) {
            const clone = material.clone(`${material.name}-${tint}`);
            const color = Color3.FromHexString(tint);
            clone.albedoColor = Color3.Lerp(Color3.White(), color, 0.65);
            clone.emissiveColor = color.scale(0.12);
            this.tintedMaterials.set(key, clone);
        }
        return this.tintedMaterials.get(key);
    }

    async spawnMonster(spawn) {
        const type = spawn.type;
        const container = await this.container(type.model);
        const entries = container.instantiateModelsToScene((name) => name, false, { doNotInstantiate: true });
        const holder = new TransformNode(`monster-${spawn.id}`, this.scene);
        const root = entries.rootNodes[0];
        root.parent = holder;
        const s = MODEL_SCALE * type.scale;
        root.scaling = new Vector3(s, s, -s);

        const meshes = holder.getChildMeshes(false);
        for (const mesh of meshes) {
            mesh.isPickable = false;
            mesh.receiveShadows = true;
            mesh.material = this.tinted(mesh.material, type.tint);
        }

        // Arme tenue dans la main droite.
        if (type.weapon) {
            const hand = root.getDescendants(false, (node) => node.name === 'handslot.r')[0];
            if (hand) {
                const weapon = (await this.equipment(type.weapon)).instantiateModelsToScene((name) => name, false, { doNotInstantiate: true });
                for (const node of weapon.rootNodes) {
                    for (const child of node.getChildren()) child.parent = hand;
                    node.dispose();
                }
                for (const mesh of hand.getChildMeshes(false)) {
                    mesh.isPickable = false;
                    meshes.push(mesh);
                }
            }
        }

        const animations = {};
        for (const group of entries.animationGroups) {
            group.stop();
            group.enableBlending = true;
            group.blendingSpeed = 0.15;
            animations[group.name] = group;
        }

        const instance = {
            holder,
            meshes,
            animations,
            dispose: () => {
                for (const mesh of holder.getChildMeshes(false)) this.shadows.removeShadowCaster(mesh, false);
                for (const group of entries.animationGroups) group.dispose();
                for (const skeleton of entries.skeletons) skeleton.dispose();
                holder.dispose();
            },
        };

        const monster = new Monster(this, spawn, type, instance);
        spawn.monster = monster;
        if (spawn.deadUntil > performance.now()) {
            monster.hp = 0;
            monster.state = 'dead';
            monster.stateTime = 10;
            holder.setEnabled(false);
        }
        this.active.add(monster);

        return () => {
            this.active.delete(monster);
            spawn.monster = null;
            instance.dispose();
        };
    }

    setShadow(monster, cast) {
        if (monster.castsShadow === cast) return;
        monster.castsShadow = cast;
        for (const mesh of monster.meshes) {
            if (cast) this.shadows.addShadowCaster(mesh, false);
            else this.shadows.removeShadowCaster(mesh, false);
        }
    }

    onKill(monster) {
        monster.spawn.deadUntil = performance.now() + (RESPAWN[monster.tier] ?? 45) * 1000;
        this.onKillCallback?.(monster);
    }

    onAggro(monster) {
        this.onAggroCallback?.(monster);
        // Les monstres proches viennent en renfort.
        for (const other of this.active) {
            if (other !== monster && other.alive && Vector3.Distance(other.position, monster.position) < 7) other.aggro();
        }
    }

    /** Le coup part : corps à corps immédiat, ou projectile pour les tireurs et les mages. */
    resolveAttack(monster, distance) {
        const player = this.player;
        if (!monster.ranged) {
            if (distance <= monster.type.attackRange + monster.radius + 0.6) this.onPlayerHit(monster.damage, monster);
            return;
        }
        const origin = monster.position.add(new Vector3(0, 1.3 * monster.type.scale, 0));
        const target = player.position.add(new Vector3(0, 1.1, 0));
        const direction = target.subtract(origin).normalize();
        const magic = monster.type.model.includes('mage');
        this.effects.projectile(origin, direction, {
            color: magic ? new Color3(0.55, 1, 0.45) : new Color3(1, 0.55, 0.35),
            speed: magic ? 14 : 22,
            range: monster.type.attackRange + 4,
            size: magic ? 0.32 : 0.2,
            elongated: !magic,
            onStep: (position) => (Vector3.Distance(position, player.position.add(new Vector3(0, 1.1, 0))) < 0.75 ? player : null),
            onEnd: (position, hit) => {
                if (hit) {
                    this.onPlayerHit(monster.damage, monster);
                    this.effects.burst(position, magic ? new Color3(0.55, 1, 0.45) : new Color3(1, 0.6, 0.3), { count: 30, power: 3 });
                }
            },
        });
    }

    /** Monstres vivants (cibles des compétences). */
    targets() {
        const list = [];
        for (const monster of this.active) if (monster.alive && !monster.frozen) list.push(monster);
        return list;
    }

    update(dt, playerAlive) {
        const now = performance.now();
        for (const monster of this.active) {
            // Réapparition : uniquement quand le joueur est assez loin.
            if (!monster.alive && now > monster.spawn.deadUntil && Vector3.Distance(monster.position, this.player.position) > 26) {
                const spawn = monster.spawn;
                monster.hp = monster.maxHp;
                monster.root.setEnabled(true);
                monster.root.position.set(spawn.x, heightAt(spawn.x, spawn.z), spawn.z);
                monster.setState('idle');
                monster.play('Idle');
                continue;
            }
            monster.update(dt, this.player, playerAlive);
        }
    }

    tick(position) {
        return this.streamer.update(position.x, position.z);
    }

    preload(position, onProgress) {
        return this.streamer.preload(position.x, position.z, onProgress);
    }

    get stats() {
        return { ...this.streamer.stats, alive: this.targets().length, total: this.spawns.length };
    }
}
