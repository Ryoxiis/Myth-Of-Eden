/**
 * Grimoire de compétences (touche P) : un livre ancien dont on tourne les pages.
 * Page 1 : la classe du personnage ; ensuite deux compétences par page, triées par niveau.
 * Les compétences débloquées se glissent dans la barre (ou bouton « Placer dans la barre »).
 */
import { icon } from './icons.js';

const CLASS_TITLES = {
    scout: ['l\'Éclaireur', 'Voir sans être vu, frapper de loin, ne jamais perdre une piste.'],
    fighter: ['du Combattant', 'La lame et le bouclier. Tenir la ligne quand tout vacille.'],
    traveler: ['du Voyageur', 'Les routes enseignent ce que les livres oublient : endurer, soigner, s\'adapter.'],
    mage: ['du Mage', 'Les runes répondent à qui sait les écouter. Certaines se souviennent du portail.'],
};

const ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII'];
const escapeHtml = (text) => String(text ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', '\'': '&#39;' }[c]));

export class Grimoire {
    constructor(root, { onAssign, onClose, onDragState }) {
        this.root = root;
        this.onAssign = onAssign;
        this.onClose = onClose;
        this.onDragState = onDragState;
        this.spread = 0;
        this.pages = [];
        this.turning = false;

        root.innerHTML = `
            <div class="grimoire__backdrop" data-close></div>
            <div class="grimoire__book" role="dialog" aria-modal="true" aria-label="Grimoire de compétences">
                <div class="grimoire__cover"></div>
                <div class="grimoire__page grimoire__page--left" data-left></div>
                <div class="grimoire__page grimoire__page--right" data-right></div>
                <div class="grimoire__spine" aria-hidden="true"></div>
                <button type="button" class="grimoire__nav grimoire__nav--prev" data-prev aria-label="Page précédente">‹</button>
                <button type="button" class="grimoire__nav grimoire__nav--next" data-next aria-label="Page suivante">›</button>
                <button type="button" class="grimoire__close" data-close aria-label="Fermer le grimoire">×</button>
                <div class="grimoire__ribbon" aria-hidden="true"></div>
            </div>`;
        this.book = root.querySelector('.grimoire__book');
        this.left = root.querySelector('[data-left]');
        this.right = root.querySelector('[data-right]');
        this.prevBtn = root.querySelector('[data-prev]');
        this.nextBtn = root.querySelector('[data-next]');

        root.querySelectorAll('[data-close]').forEach((el) => el.addEventListener('click', () => this.onClose()));
        this.prevBtn.addEventListener('click', () => this.turn(-1));
        this.nextBtn.addEventListener('click', () => this.turn(1));

        // Délégation : boutons « Placer » et glisser-déposer des icônes.
        this.book.addEventListener('click', (event) => {
            const button = event.target.closest('[data-assign]');
            if (button) this.onAssign(button.dataset.assign);
        });
        this.book.addEventListener('dragstart', (event) => {
            const handle = event.target.closest('[data-skill]');
            if (!handle) return;
            event.dataTransfer.setData('text/x-skill', handle.dataset.skill);
            event.dataTransfer.effectAllowed = 'copy';
            this.onDragState?.(true);
        });
        this.book.addEventListener('dragend', () => this.onDragState?.(false));
    }

    get isOpen() {
        return !this.root.hidden;
    }

    open() {
        this.root.hidden = false;
        this.root.classList.remove('is-closing');
        this.book.classList.remove('is-opening');
        void this.book.offsetWidth;
        this.book.classList.add('is-opening');
    }

    close() {
        this.root.hidden = true;
    }

    render(state, bar) {
        const character = state.character ?? {};
        const [title, motto] = CLASS_TITLES[character.class] ?? ['de l\'Aventurier', ''];
        const skills = state.skills ?? [];
        const unlocked = skills.filter((skill) => skill.unlocked).length;
        this.bar = bar;

        const intro = `
            <div class="gpage gpage--intro">
                <p class="gpage__kicker">Grimoire</p>
                <h2 class="gpage__title">Les arts ${escapeHtml(title)}</h2>
                <div class="gpage__emblem">${icon('star')}</div>
                <p class="gpage__motto">${escapeHtml(motto)}</p>
                <p class="gpage__level">${escapeHtml(character.name)} · niveau ${character.level ?? 1}</p>
                <p class="gpage__count">${unlocked} compétence${unlocked > 1 ? 's' : ''} sur ${skills.length} déchiffrée${unlocked > 1 ? 's' : ''}</p>
                <p class="gpage__help">Faites glisser un symbole vers la barre de compétences, ou utilisez « Placer dans la barre ». Les pages scellées s'ouvriront avec l'expérience.</p>
            </div>`;

        const pages = [intro];
        for (let i = 0; i < skills.length; i += 2) {
            pages.push(`<div class="gpage">${skills.slice(i, i + 2).map((skill) => this.skillEntry(skill)).join('<hr class="gpage__divider">')}</div>`);
        }
        if (pages.length % 2 === 1) {
            pages.push(`<div class="gpage gpage--blank"><p>Les pages suivantes sont encore blanches…<br>D'autres secrets s'y écriront avec le temps.</p></div>`);
        }
        this.pages = pages.map((html, index) => `${html}<footer class="gpage__number">${ROMAN[index] ?? index + 1}</footer>`);
        this.spread = Math.min(this.spread, this.spreadCount - 1);
        this.show();
    }

    skillEntry(skill) {
        const inBar = this.bar.includes(skill.code);
        const stats = [
            skill.power > 0 ? [skill.type === 'heal' ? 'Soin' : 'Puissance', skill.power] : null,
            ['Recharge', `${skill.cooldown} s`],
            ['Endurance', skill.cost],
            skill.range > 0 ? ['Portée', `${skill.range} m`] : null,
        ].filter(Boolean);

        return `
            <article class="gskill ${skill.unlocked ? '' : 'is-locked'} ${inBar ? 'is-in-bar' : ''}">
                <div class="gskill__sigil" ${skill.unlocked ? `draggable="true" data-skill="${escapeHtml(skill.code)}" title="Glisser vers la barre"` : ''} data-effect="${escapeHtml(skill.effect)}">
                    ${icon(skill.icon)}
                    ${skill.unlocked ? '' : `<span class="gskill__seal">Niv. ${skill.requiredLevel}</span>`}
                </div>
                <div class="gskill__body">
                    <h3 class="gskill__name">${escapeHtml(skill.name)}</h3>
                    <p class="gskill__meta">${escapeHtml(skill.typeLabel)} · niveau ${skill.requiredLevel}</p>
                    <p class="gskill__text">${escapeHtml(skill.description)}</p>
                    <dl class="gskill__stats">${stats.map(([label, value]) => `<div><dt>${label}</dt><dd>${escapeHtml(value)}</dd></div>`).join('')}</dl>
                    ${skill.unlocked
                        ? (inBar ? '<p class="gskill__state">✦ Dans la barre</p>' : `<button type="button" class="gskill__assign" data-assign="${escapeHtml(skill.code)}">Placer dans la barre</button>`)
                        : `<p class="gskill__state gskill__state--locked">Page scellée jusqu'au niveau ${skill.requiredLevel}</p>`}
                </div>
            </article>`;
    }

    get spreadCount() {
        return Math.max(1, Math.ceil(this.pages.length / 2));
    }

    show() {
        this.left.innerHTML = this.pages[this.spread * 2] ?? '';
        this.right.innerHTML = this.pages[this.spread * 2 + 1] ?? '';
        this.prevBtn.disabled = this.spread === 0;
        this.nextBtn.disabled = this.spread >= this.spreadCount - 1;
    }

    /** Tourne une page avec une animation 3D (feuille qui pivote autour de la reliure). */
    turn(step) {
        const target = this.spread + step;
        if (this.turning || target < 0 || target >= this.spreadCount) return;
        this.turning = true;

        const leaf = document.createElement('div');
        leaf.className = `grimoire__leaf grimoire__leaf--${step > 0 ? 'next' : 'prev'}`;
        const front = step > 0 ? this.pages[this.spread * 2 + 1] : this.pages[this.spread * 2];
        const back = step > 0 ? this.pages[target * 2] : this.pages[target * 2 + 1];
        leaf.innerHTML = `<div class="grimoire__leaf-face grimoire__leaf-face--front grimoire__page">${front ?? ''}</div>
            <div class="grimoire__leaf-face grimoire__leaf-face--back grimoire__page">${back ?? ''}</div>`;

        // Sous la feuille qui tourne, on découvre déjà la page suivante.
        if (step > 0) this.right.innerHTML = this.pages[target * 2 + 1] ?? '';
        else this.left.innerHTML = this.pages[target * 2] ?? '';
        this.book.append(leaf);

        leaf.addEventListener('animationend', () => {
            this.spread = target;
            this.show();
            leaf.remove();
            this.turning = false;
        }, { once: true });
    }
}
