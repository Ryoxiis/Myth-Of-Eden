/**
 * Barre de compétences (bas de l'écran, au centre) : 6 emplacements (touches 1 à 6),
 * recharges animées, jauge d'endurance. On y dépose les compétences depuis le grimoire.
 */
import { icon } from './icons.js';

export const SLOT_KEYS = ['1', '2', '3', '4', '5', '6'];

export class SkillBar {
    constructor(root, { onCast, onChange }) {
        this.root = root;
        this.onCast = onCast;
        this.onChange = onChange;
        this.skills = new Map();
        this.bar = [];

        root.innerHTML = `
            <div class="skillbar__resources">
                <div class="skillbar__gauge skillbar__gauge--health" title="Santé"><span data-health></span><b data-health-label></b></div>
                <div class="skillbar__gauge skillbar__gauge--stamina" title="Endurance"><span data-stamina></span><b data-stamina-label></b></div>
            </div>
            <div class="skillbar__xp" title="Expérience"><span data-xp></span><b data-xp-label></b></div>
            <div class="skillbar__slots" data-slots></div>
            <p class="skillbar__hint">Glissez une compétence depuis le grimoire <kbd>P</kbd> · clic droit pour vider</p>`;
        this.slotsEl = root.querySelector('[data-slots]');
        this.healthEl = root.querySelector('[data-health]');
        this.healthLabel = root.querySelector('[data-health-label]');
        this.staminaEl = root.querySelector('[data-stamina]');
        this.staminaLabel = root.querySelector('[data-stamina-label]');
        this.xpEl = root.querySelector('[data-xp]');
        this.xpLabel = root.querySelector('[data-xp-label]');

        this.slots = SLOT_KEYS.map((key, index) => {
            const slot = document.createElement('button');
            slot.type = 'button';
            slot.className = 'skillslot';
            slot.dataset.slot = String(index);
            slot.innerHTML = `<span class="skillslot__icon"></span><span class="skillslot__cooldown"></span><span class="skillslot__timer"></span><kbd class="skillslot__key">${key}</kbd>`;
            this.bindSlot(slot, index);
            this.slotsEl.append(slot);
            return {
                el: slot,
                icon: slot.querySelector('.skillslot__icon'),
                cooldown: slot.querySelector('.skillslot__cooldown'),
                timer: slot.querySelector('.skillslot__timer'),
            };
        });
    }

    bindSlot(slot, index) {
        slot.addEventListener('click', () => this.onCast(index));
        slot.addEventListener('contextmenu', (event) => {
            event.preventDefault();
            if (!this.bar[index]) return;
            const bar = [...this.bar];
            bar[index] = null;
            this.onChange(bar);
        });
        slot.addEventListener('dragstart', (event) => {
            if (!this.bar[index]) {
                event.preventDefault();
                return;
            }
            event.dataTransfer.setData('text/x-slot', String(index));
            event.dataTransfer.setData('text/x-skill', this.bar[index]);
            event.dataTransfer.effectAllowed = 'move';
        });
        slot.addEventListener('dragover', (event) => {
            event.preventDefault();
            slot.classList.add('is-over');
        });
        slot.addEventListener('dragleave', () => slot.classList.remove('is-over'));
        slot.addEventListener('drop', (event) => {
            event.preventDefault();
            slot.classList.remove('is-over');
            const code = event.dataTransfer.getData('text/x-skill');
            const from = event.dataTransfer.getData('text/x-slot');
            if (!code) return;
            const bar = [...this.bar];
            if (from !== '') {
                // Échange entre deux emplacements.
                [bar[Number(from)], bar[index]] = [bar[index], bar[Number(from)]];
            } else {
                const existing = bar.indexOf(code);
                if (existing !== -1) bar[existing] = bar[index];
                bar[index] = code;
            }
            this.onChange(bar);
        });
    }

    render(skills, bar) {
        this.skills = new Map(skills.map((skill) => [skill.code, skill]));
        this.bar = [...bar];
        this.slots.forEach((slot, index) => {
            const skill = this.skills.get(bar[index]);
            slot.el.classList.toggle('is-empty', !skill);
            slot.el.draggable = Boolean(skill);
            slot.el.dataset.effect = skill?.effect ?? '';
            slot.icon.innerHTML = skill ? icon(skill.icon) : '';
            slot.el.title = skill
                ? `${skill.name} — ${skill.typeLabel}\n${skill.description}\nRecharge ${skill.cooldown} s · Endurance ${skill.cost}`
                : 'Emplacement libre';
        });
    }

    /** Rafraîchit recharges et jauges (appelé à chaque image). */
    update(system) {
        this.slots.forEach((slot, index) => {
            const code = this.bar[index];
            const ratio = code ? system.cooldownRatio(code) : 0;
            slot.cooldown.style.setProperty('--cd', ratio.toFixed(3));
            const left = code ? system.cooldownLeft(code) : 0;
            slot.timer.textContent = left > 0.05 ? (left >= 10 ? Math.ceil(left) : left.toFixed(1)) : '';
            const skill = this.skills.get(code);
            slot.el.classList.toggle('is-starved', Boolean(skill) && system.stamina < skill.cost);
        });
        this.staminaEl.style.width = `${(system.stamina / system.maxStamina) * 100}%`;
        this.staminaLabel.textContent = `${Math.floor(system.stamina)} / ${system.maxStamina}`;
        this.healthEl.style.width = `${(system.health / system.maxHealth) * 100}%`;
        this.healthLabel.textContent = `${Math.round(system.health)} / ${system.maxHealth}`;
    }

    setExperience(character) {
        const previous = character.previousLevelAt ?? 0;
        const next = character.nextLevelAt ?? 100;
        const ratio = Math.max(0, Math.min(1, ((character.experience ?? 0) - previous) / Math.max(1, next - previous)));
        this.xpEl.style.width = `${ratio * 100}%`;
        this.xpLabel.textContent = `Niveau ${character.level ?? 1} · ${character.experience ?? 0} / ${next} XP`;
    }

    flash(index) {
        const el = this.slots[index]?.el;
        if (!el) return;
        el.classList.remove('is-denied');
        void el.offsetWidth;
        el.classList.add('is-denied');
    }

    pressed(index) {
        const el = this.slots[index]?.el;
        if (!el) return;
        el.classList.remove('is-pressed');
        void el.offsetWidth;
        el.classList.add('is-pressed');
    }

    setDropMode(active) {
        this.root.classList.toggle('is-drop-mode', active);
    }
}
