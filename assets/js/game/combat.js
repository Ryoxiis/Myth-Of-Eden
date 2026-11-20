/**
 * Système de compétences : endurance, temps de recharge, lancement (animation + effet)
 * et résolution des coups sur les cibles (pour l'instant le mannequin d'entraînement).
 */
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import { EFFECT_COLORS } from './vfx.js';

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
        if (this.stamina < skill.cost) return 'Pas assez d\'endurance.';

        this.stamina -= skill.cost;
        this.cooldowns.set(code, skill.cooldown);
        this.globalCooldown = GLOBAL_COOLDOWN;

        // Le personnage se tourne dans la direction visée par la caméra.
        const aim = this.player.aimDirection();
        if (skill.offensive || skill.effect === 'wind') {
            this.player.visual.rotation.y = Math.atan2(aim.x, aim.z);
        }
        this.player.playAction(skill.animation, Math.min(0.85, this.player.animationLength(skill.animation)));

        const delay = skill.offensive ? 280 : 200;
        setTimeout(() => this.resolve(skill, aim), delay);
        return null;
    }

    damageFor(skill) {
        const variance = 0.85 + Math.random() * 0.3;
        const critical = Math.random() < 0.12;
        const amount = Math.round(skill.power * this.powerBonus * variance * (critical ? 1.6 : 1) * (performance.now() < this.buffs.until ? this.buffs.damage : 1));
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
    resolve(skill, aim) {
        const player = this.player;
        const origin = player.position.add(new Vector3(0, 1.3, 0)).add(aim.scale(0.6));
        const color = EFFECT_COLORS[skill.effect] ?? EFFECT_COLORS.arcane;
        const from = player.position.clone();

        if (skill.offensive && PROJECTILE_EFFECTS.has(skill.effect) && skill.range > 6) {
            const shots = skill.code === 'arrow_volley' ? [-0.18, 0, 0.18] : [0];
            for (const spread of shots) {
                const direction = new Vector3(aim.x * Math.cos(spread) - aim.z * Math.sin(spread), 0, aim.x * Math.sin(spread) + aim.z * Math.cos(spread));
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
