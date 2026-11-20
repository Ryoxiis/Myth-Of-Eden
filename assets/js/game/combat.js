/**
 * Système de combat : attaque de base (clic gauche), compétences (1 à 6), endurance,
 * temps de recharge, visée au réticule et résolution des coups sur les cibles.
 */
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import { EFFECT_COLORS } from './vfx.js';
import { heightAt } from './terrain.js';

/** Caractéristique principale de chaque classe (bonus des compétences). */
const MAIN_STAT = { scout: 'agility', fighter: 'strength', traveler: 'strength', mage: 'magicMastery' };
/** Famille d'arme de prédilection de chaque classe : +15 % de dégâts avec elle. */
const CLASS_WEAPON = { scout: 'ranged', fighter: 'melee', traveler: 'melee', mage: 'magic' };
/** Même multiplicateurs que l'enum PHP Rarity::statMultiplier(). */
const RARITY_POWER = { common: 1, uncommon: 1.25, rare: 1.6, epic: 2.1, legendary: 2.8, cosmic: 3.8, omniversal: 5 };
/** Caractéristique principale et secondaire selon la famille d'arme (miroir de WeaponKind::damageStat()). */
const WEAPON_STATS = { melee: ['strength', 'agility'], ranged: ['agility', 'strength'], magic: ['magicMastery', 'agility'], unarmed: ['strength', 'agility'] };
const WEAPON_LABELS = { melee: 'corps à corps', ranged: 'à distance', magic: 'magie', unarmed: 'mains nues' };

/**
 * Attaque de base selon l'arme réellement tenue (et non selon la classe) :
 * épée, hache, dague → coup au corps à corps ; arc, arbalète → carreau ; bâton, baguette → éclair magique.
 */
const BASIC_ATTACKS = {
    melee: { kind: 'melee', range: 2.7, cooldown: 0.6, color: 'slash', anims: ['1H_Melee_Attack_Slice_Diagonal', '1H_Melee_Attack_Slice_Horizontal', '1H_Melee_Attack_Chop'] },
    meleeHeavy: { kind: 'melee', range: 3.1, cooldown: 0.85, color: 'whirl', anims: ['2H_Melee_Attack_Slice', '2H_Melee_Attack_Chop', '2H_Melee_Attack_Stab'] },
    dagger: { kind: 'melee', range: 2.2, cooldown: 0.42, color: 'slash', anims: ['1H_Melee_Attack_Stab', '1H_Melee_Attack_Slice_Diagonal'] },
    ranged: { kind: 'arrow', range: 28, cooldown: 0.75, speed: 36, color: 'arrow', anims: ['1H_Ranged_Shoot'] },
    rangedHeavy: { kind: 'arrow', range: 32, cooldown: 1.05, speed: 44, color: 'arrow', anims: ['2H_Ranged_Shoot'] },
    magic: { kind: 'arcane', range: 22, cooldown: 0.75, speed: 26, color: 'arcane', anims: ['Spellcast_Shoot'] },
    wand: { kind: 'arcane', range: 20, cooldown: 0.5, speed: 30, color: 'arcane', anims: ['Spellcast_Shoot'] },
    unarmed: { kind: 'melee', range: 2, cooldown: 0.5, color: 'slash', anims: ['Unarmed_Melee_Attack_Punch_A', 'Unarmed_Melee_Attack_Punch_B'] },
};

const GLOBAL_COOLDOWN = 0.45;
const STAMINA_REGEN = 11; // points par seconde
const PROJECTILE_EFFECTS = new Set(['arrow', 'arcane', 'fire', 'frost', 'stone']);

export class SkillSystem {
    constructor({ player, effects, hud, targets = () => [], state, onImpact }) {
        this.player = player;
        this.effects = effects;
        this.hud = hud;
        this.getTargets = targets;
        this.onImpact = onImpact;
        this.cooldowns = new Map();
        this.globalCooldown = 0;
        this.attackCooldown = 0;
        this.combo = 0;
        this.buffs = { damage: 1, until: 0 };
        this.setState(state);
        this.stamina = this.maxStamina;
        this.health = state.character?.currentHealth ?? 100;
    }

    setState(state) {
        this.state = state;
        this.skills = new Map((state.skills ?? []).map((skill) => [skill.code, skill]));
        this.bar = [...(state.skillBar ?? [])];
        this.maxStamina = state.character?.stats?.stamina ?? 100;
        // Caractéristique principale de la classe : elle augmente les dégâts (l'équipement compte !).
        const mainStat = { scout: 'agility', fighter: 'strength', traveler: 'strength', mage: 'magicMastery' }[state.character?.class] ?? 'strength';
        this.powerBonus = 1 + (state.character?.stats?.[mainStat] ?? 1) * 0.05;
        this.basic = basicAttackFor(state);
        this.weapon = equippedWeapon(state);
        this.weaponBonus = weaponPower(this.weapon) * 0.5;
        this.maxHealth = state.character?.maxHealth ?? 100;
        if (typeof state.character?.currentHealth === 'number') this.health = state.character.currentHealth;
    }

    /** Fraction de recharge restante (0 = prête) pour l'affichage. */
    cooldownRatio(code) {
        const skill = this.skills.get(code);
        const remaining = this.cooldowns.get(code) ?? 0;
        if (!skill || remaining <= 0) return 0;
        return remaining / Math.max(0.01, skill.cooldown);
    }

    cooldownLeft(code) {
        return Math.max(0, this.cooldowns.get(code) ?? 0);
    }

    update(dt) {
        for (const [code, remaining] of this.cooldowns) {
            this.cooldowns.set(code, remaining - dt);
        }
        this.globalCooldown = Math.max(0, this.globalCooldown - dt);
        this.attackCooldown = Math.max(0, this.attackCooldown - dt);
        this.stamina = Math.min(this.maxStamina, this.stamina + STAMINA_REGEN * dt);
    }

    /** Lance la compétence de l'emplacement `slot` (0 à 5). Renvoie un message d'échec ou null. */
    castSlot(slot) {
        const code = this.bar[slot];
        if (!code) return 'Emplacement vide : ouvrez le grimoire (P) pour y placer une compétence.';
        return this.cast(code);
    }

    cast(code) {
        const skill = this.skills.get(code);
        if (!skill) return 'Compétence inconnue.';
        if (!skill.unlocked) return `${skill.name} se débloque au niveau ${skill.requiredLevel}.`;
        if (this.cooldownLeft(code) > 0 || this.globalCooldown > 0 || this.player.actionTime > 0) return 'busy';
        const missing = this.missingWeapon(skill);
        if (missing) return missing;
        if (this.stamina < skill.cost) return 'Pas assez d\'endurance.';

        this.stamina -= skill.cost;
        this.cooldowns.set(code, skill.cooldown);
        this.globalCooldown = GLOBAL_COOLDOWN;

        // Le personnage se tourne vers ce que vise le réticule.
        const sight = this.aimAt(Math.max(skill.range, 3));
        const aim = sight.flat;
        if (skill.offensive || skill.effect === 'wind') {
            this.player.visual.rotation.y = Math.atan2(aim.x, aim.z);
        }
        this.player.playAction(skill.animation, Math.min(0.85, this.player.animationLength(skill.animation)));

        const delay = skill.offensive ? 280 : 200;
        setTimeout(() => this.resolve(skill, aim, sight), delay);
        return null;
    }

    /**
     * Une compétence d'arme a besoin de la bonne arme en main : les tirs demandent un arc ou une
     * arbalète, les coups d'épée une arme de corps à corps. Les sorts, eux, viennent du lanceur.
     */
    missingWeapon(skill) {
        if (!skill.offensive) return null;
        const family = this.weapon?.weaponKind ?? null;
        if ((skill.effect === 'arrow' || skill.code === 'moon_arrow') && family !== 'ranged') {
            return `${skill.name} : il faut un arc ou une arbalète en main.`;
        }
        if (skill.code === 'shield_bash') {
            const shield = (this.state.inventory ?? []).some((entry) => entry.equippedSlot === 'off_hand' && /shield|buckler|bulwark/.test(entry.code));
            return shield ? null : `${skill.name} : il faut un bouclier en main gauche.`;
        }
        if ((skill.effect === 'slash' || skill.effect === 'whirl') && family !== 'melee') {
            return `${skill.name} : il faut une arme de corps à corps en main.`;
        }
        return null;
    }

    /**
     * Ce que vise le réticule (centre de l'écran) : une cible sous le réticule à portée,
     * sinon le point du sol ou du ciel dans l'axe de la caméra.
     * Renvoie { target, point, flat } — `flat` est la direction horizontale depuis le joueur.
     */
    aimAt(range) {
        const camera = this.player.camera;
        const origin = camera.position;
        const direction = camera.target.subtract(origin).normalize();
        const player = this.player.position;

        let target = null;
        let nearest = Infinity;
        for (const candidate of this.targets) {
            const toCenter = candidate.center.subtract(origin);
            const along = Vector3.Dot(toCenter, direction);
            if (along <= 0) continue;
            const radius = candidate.radius + 0.35; // un peu de tolérance : viser doit rester agréable
            const missSquared = toCenter.lengthSquared() - along * along;
            if (missSquared > radius * radius) continue;
            const reach = Vector3.Distance(candidate.position, player) - candidate.radius;
            if (reach > range) continue;
            if (along < nearest) {
                nearest = along;
                target = candidate;
            }
        }

        let point;
        if (target) {
            point = target.center.clone();
        } else {
            // Pas de cible : on avance le long du rayon jusqu'au sol (ou jusqu'à la portée).
            const start = Vector3.Distance(origin, camera.target);
            const end = start + range;
            point = origin.add(direction.scale(end));
            for (let t = start; t <= end; t += 0.75) {
                const p = origin.add(direction.scale(t));
                if (p.y <= heightAt(p.x, p.z) + 0.05) {
                    point = p;
                    break;
                }
            }
        }

        const flat = new Vector3(point.x - player.x, 0, point.z - player.z);
        if (flat.lengthSquared() < 0.01) flat.copyFrom(this.player.aimDirection());
        flat.normalize();
        return { target, point, flat };
    }

    /** Prêt à frapper (clic gauche) ? */
    get attackReady() {
        return this.attackCooldown <= 0 && this.player.actionTime <= 0;
    }

    /**
     * Attaque de base (clic gauche) : sans coût d'endurance, dégâts tirés des caractéristiques
     * (avec les bonus d'équipement) et de l'arme tenue. Renvoie true si l'attaque part.
     */
    basicAttack() {
        if (!this.attackReady || this.globalCooldown > 0) return false;
        const attack = this.basic;
        this.attackCooldown = attack.cooldown;

        const sight = this.aimAt(attack.range);
        const aim = sight.flat;
        this.player.visual.rotation.y = Math.atan2(aim.x, aim.z);
        const animation = attack.anims[this.combo % attack.anims.length];
        this.combo += 1;
        this.player.playAction(animation, Math.min(attack.cooldown * 0.8, this.player.animationLength(animation)));

        setTimeout(() => this.resolveBasic(attack, sight), attack.kind === 'melee' ? 190 : 240);
        return true;
    }

    resolveBasic(attack, sight) {
        const player = this.player;
        const color = EFFECT_COLORS[attack.color] ?? EFFECT_COLORS.arcane;
        const from = player.position.clone();
        const aim = sight.flat;

        if (attack.kind === 'melee') {
            this.effects.slash(player.position, Math.atan2(aim.x, aim.z), color, 1.2);
            let touched = 0;
            for (const target of this.targets) {
                const toTarget = target.position.subtract(player.position);
                toTarget.y = 0;
                if (toTarget.length() > attack.range + target.radius) continue;
                if (Vector3.Dot(toTarget.normalize(), aim) < 0.3) continue; // hors de l'arc de frappe
                this.strike(target, attack, from);
                touched += 1;
                if (touched >= 3) break; // un coup d'épée ne fauche pas une armée entière
            }
            return;
        }

        // Tir : du haut du personnage vers le point visé (la flèche peut monter ou descendre).
        const origin = player.position.add(new Vector3(0, 1.35, 0)).add(aim.scale(0.6));
        const direction = sight.point.subtract(origin);
        if (direction.lengthSquared() < 0.01) direction.copyFrom(aim);
        direction.normalize();
        this.effects.projectile(origin, direction, {
            color,
            speed: attack.speed,
            range: attack.range + 2,
            size: attack.kind === 'arcane' ? 0.2 : 0.22,
            elongated: attack.kind === 'arrow',
            trail: attack.kind === 'arcane',
            onStep: (position) => {
                for (const target of this.targets) {
                    if (Vector3.Distance(position, target.center) < target.radius + 0.25) {
                        this.strike(target, attack, from);
                        return target;
                    }
                }
                return null;
            },
            onEnd: (position, hit) => {
                if (hit) this.effects.burst(position, color, { count: 24, power: 2.5 });
            },
        });
    }

    /** Dégâts d'une attaque de base. */
    strike(target, attack, from) {
        const critical = Math.random() < attack.critChance;
        const roll = attack.min + Math.random() * (attack.max - attack.min);
        const buff = performance.now() < this.buffs.until ? this.buffs.damage : 1;
        const amount = Math.max(1, Math.round(roll * (critical ? 1.6 : 1) * buff));
        target.hit(amount, from);
        this.onImpact?.(target, { amount, critical, basic: true });
        this.hud.floatText(target.center.add(new Vector3(0, 0.6, 0)), critical ? `${amount} !` : `${amount}`, critical ? 'crit' : 'damage');
        this.hud.showTarget(target);
    }

    damageFor(skill) {
        const variance = 0.85 + Math.random() * 0.3;
        const critical = Math.random() < 0.12;
        const amount = Math.round((skill.power + this.weaponBonus) * this.powerBonus * variance * (critical ? 1.6 : 1) * (performance.now() < this.buffs.until ? this.buffs.damage : 1));
        return { amount: Math.max(1, amount), critical };
    }

    get targets() {
        return this.getTargets();
    }

    hitTarget(target, skill, from) {
        const { amount, critical } = this.damageFor(skill);
        target.hit(amount, from);
        this.onImpact?.(target, { amount, critical, skill });
        this.hud.floatText(target.center.add(new Vector3(0, 0.6, 0)), critical ? `${amount} !` : `${amount}`, critical ? 'crit' : 'damage');
        this.hud.showTarget(target);
    }

    /** Applique l'effet de la compétence une fois l'animation lancée. */
    resolve(skill, aim, sight = null) {
        const player = this.player;
        const origin = player.position.add(new Vector3(0, 1.3, 0)).add(aim.scale(0.6));
        // Inclinaison vers le point visé : les sorts suivent le réticule, même en hauteur.
        const toPoint = sight ? sight.point.subtract(origin) : aim.clone();
        const pitch = Math.atan2(toPoint.y, Math.hypot(toPoint.x, toPoint.z) || 1);
        const color = EFFECT_COLORS[skill.effect] ?? EFFECT_COLORS.arcane;
        const from = player.position.clone();

        if (skill.offensive && PROJECTILE_EFFECTS.has(skill.effect) && skill.range > 6) {
            const shots = skill.code === 'arrow_volley' ? [-0.18, 0, 0.18] : [0];
            for (const spread of shots) {
                const flat = new Vector3(aim.x * Math.cos(spread) - aim.z * Math.sin(spread), 0, aim.x * Math.sin(spread) + aim.z * Math.cos(spread));
                const direction = flat.scale(Math.cos(pitch)).add(new Vector3(0, Math.sin(pitch), 0)).normalize();
                const pierce = skill.code === 'moon_arrow';
                const touched = new Set();
                this.effects.projectile(origin.clone(), direction, {
                    color,
                    speed: skill.effect === 'arrow' ? 32 : 20,
                    range: skill.range,
                    size: skill.effect === 'fire' ? 0.42 : 0.24,
                    elongated: skill.effect === 'arrow',
                    onStep: (position) => {
                        for (const target of this.targets) {
                            if (touched.has(target)) continue;
                            if (Vector3.Distance(position, target.center) < target.radius + 0.3) {
                                touched.add(target);
                                this.hitTarget(target, skill, from);
                                if (!pierce) return target;
                            }
                        }
                        return null;
                    },
                    onEnd: (position, hit) => {
                        if (skill.effect === 'fire') {
                            this.effects.burst(position, color, { count: 140, power: 6 });
                            this.effects.ring(position, color, 2.5, 0.4, 0.3);
                            for (const target of this.targets) {
                                if (target !== hit && Vector3.Distance(position, target.center) < 2.5) this.hitTarget(target, skill, position);
                            }
                        } else if (hit) {
                            this.effects.burst(position, color, { count: 40, power: 3 });
                        }
                    },
                });
            }
            return;
        }

        if (skill.offensive) {
            // Attaque au corps à corps (arc devant soi) ou zone autour de soi.
            const aroundSelf = skill.effect === 'whirl' || skill.effect === 'frost' || skill.effect === 'arcane' || skill.effect === 'leaf';
            if (skill.code === 'heroic_charge') player.dash(aim, 5);
            const center = skill.effect === 'leaf' ? player.position.add(aim.scale(4)) : player.position.clone();
            const radius = skill.effect === 'leaf' ? 2.2 : Math.max(2.4, skill.range);

            if (aroundSelf) {
                this.effects.ring(center, color, radius, 0.55);
                this.effects.burst(center.add(new Vector3(0, 0.8, 0)), color, { count: 120, power: 5, gravity: 0 });
            } else {
                this.effects.slash(player.position, Math.atan2(aim.x, aim.z), color, 1.6);
            }
            for (const target of this.targets) {
                const toTarget = target.position.subtract(center);
                toTarget.y = 0;
                const distance = toTarget.length();
                if (distance > radius + target.radius) continue;
                if (!aroundSelf) {
                    const facing = Vector3.Dot(toTarget.normalize(), aim);
                    if (facing < 0.35) continue; // hors de l'arc de frappe
                }
                this.hitTarget(target, skill, center);
            }
            return;
        }

        // Compétences de soutien.
        switch (skill.effect) {
            case 'heal':
                this.effects.aura(player.body, color, 2);
                this.heal(skill.power);
                break;
            case 'fire': // feu de camp
                this.effects.campfire(player.position.add(aim.scale(1.4)), 10, () => this.heal(Math.round(skill.power / 10)));
                break;
            case 'shield':
                this.effects.aura(player.body, color, 6, { bubble: true, rising: false });
                this.hud.toast(skill.name, 'Les prochains coups seront absorbés.', 'magic');
                break;
            case 'light':
                this.effects.lightOrb(player.body, 25);
                break;
            case 'wind':
                if (skill.code === 'dodge_roll') {
                    player.dash(aim, 3.2);
                } else {
                    this.stamina = Math.min(this.maxStamina, this.stamina + skill.power);
                    this.hud.floatText(player.position.add(new Vector3(0, 2.4, 0)), `+${skill.power} endurance`, 'stamina');
                }
                this.effects.aura(player.body, color, 1);
                break;
            case 'smoke':
                this.effects.aura(player.body, color, 6, { rising: false });
                player.setStealth(6);
                break;
            case 'sense':
                this.effects.ring(player.position, color, Math.max(6, skill.range), 1.1);
                this.hud.toast(skill.name, 'Vos sens s\'aiguisent… rien d\'inhabituel ici pour l\'instant.');
                break;
            default: // renforcements (cri de guerre…)
                this.effects.aura(player.body, color, 8);
                this.buffs = { damage: 1.25, until: performance.now() + 8000 };
                this.hud.toast(skill.name, 'Vos coups sont plus puissants pendant 8 secondes.');
        }
        this.effects.flash(player.position.add(new Vector3(0, 1.5, 0)), color, 1.6, 0.5);
    }

    heal(amount) {
        const before = this.health;
        this.health = Math.min(this.maxHealth, this.health + amount);
        const gained = Math.round(this.health - before);
        this.hud.floatText(this.player.position.add(new Vector3(0, 2.4, 0)), gained > 0 ? `+${gained}` : 'Santé au maximum', 'heal');
        this.healthDirty = gained > 0 || this.healthDirty;
    }
}

/** Arme tenue en main principale (ligne d'inventaire équipée), ou null. */
export function equippedWeapon(state) {
    return (state.inventory ?? []).find((entry) => entry.equippedSlot === 'main_hand') ?? null;
}

/** Puissance apportée par l'arme : son niveau et sa rareté (même logique que les bonus côté Symfony). */
function weaponPower(weapon) {
    if (!weapon) return 0;
    return (2 + (weapon.itemLevel ?? 1)) * (RARITY_POWER[weapon.rarity] ?? 1) * (weapon.twoHanded ? 1.35 : 1);
}

/**
 * Profil de l'attaque de base : il dépend de l'arme tenue (famille, deux mains, niveau, rareté)
 * et des caractéristiques du personnage (déjà augmentées par l'équipement côté Symfony).
 */
export function basicAttackFor(state) {
    const character = state.character ?? {};
    const stats = character.stats ?? {};
    const weapon = equippedWeapon(state);
    const family = weapon?.weaponKind ?? 'unarmed';

    let profile = BASIC_ATTACKS.unarmed;
    if (family === 'melee') profile = weapon.code === 'dagger' ? BASIC_ATTACKS.dagger : weapon.twoHanded ? BASIC_ATTACKS.meleeHeavy : BASIC_ATTACKS.melee;
    else if (family === 'ranged') profile = weapon.twoHanded ? BASIC_ATTACKS.rangedHeavy : BASIC_ATTACKS.ranged;
    else if (family === 'magic') profile = weapon.code === 'wand' ? BASIC_ATTACKS.wand : BASIC_ATTACKS.magic;

    const [mainStat, secondStat] = WEAPON_STATS[family];
    const mastery = CLASS_WEAPON[character.class] === family ? 1.15 : 1; // l'archer tire mieux qu'il ne frappe
    // Dégâts par seconde à peu près constants : une arme lente frappe plus fort à chaque coup.
    const pace = profile.cooldown / 0.6;
    const base = (2 + (stats[mainStat] ?? 0) * 0.9 + (stats[secondStat] ?? 0) * 0.2 + weaponPower(weapon)) * mastery * pace * (family === 'unarmed' ? 0.6 : 1);

    return {
        ...profile,
        family,
        familyLabel: WEAPON_LABELS[family],
        min: Math.max(1, Math.round(base * 0.85)),
        max: Math.max(2, Math.round(base * 1.15)),
        critChance: Math.min(0.4, 0.05 + (stats.agility ?? 0) * 0.004),
        weapon: weapon?.name ?? null,
        mastery: mastery > 1,
    };
}
