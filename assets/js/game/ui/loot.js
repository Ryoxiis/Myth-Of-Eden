/**
 * Fenêtre d'un coffre ouvert : liste des objets (couleur de rareté, niveau, bonus),
 * on prend ce qu'on veut, un par un, ou tout d'un coup.
 */
import { itemIcon } from './icons.js';

const STAT_LABELS = {
    health: 'Santé', stamina: 'Endurance', strength: 'Force', agility: 'Agilité', stealth: 'Discrétion', magicMastery: 'Magie', tracking: 'Pistage',
};
const escapeHtml = (text) => String(text ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', '\'': '&#39;' }[c]));

export class LootWindow {
    constructor(root, { onTake, onTakeAll, onClose }) {
        this.root = root;
        this.onTake = onTake;
        this.onTakeAll = onTakeAll;
        this.onClose = onClose;
        this.busy = false;
        root.innerHTML = `
            <div class="loot__panel" role="dialog" aria-modal="true" aria-label="Coffre">
                <header class="loot__head">
                    <div>
                        <p class="loot__kicker" data-loot-source></p>
                        <h2>Coffre</h2>
                    </div>
                    <button type="button" class="loot__close" data-close aria-label="Fermer">×</button>
                </header>
                <ul class="loot__list" data-loot-list></ul>
                <footer class="loot__foot">
                    <button type="button" class="loot__all" data-take-all>Tout prendre</button>
                    <span><kbd>E</kbd> ou <kbd>Échap</kbd> pour fermer</span>
                </footer>
            </div>`;
        this.list = root.querySelector('[data-loot-list]');
        this.source = root.querySelector('[data-loot-source]');
        root.querySelector('[data-close]').addEventListener('click', () => this.onClose());
        root.querySelector('[data-take-all]').addEventListener('click', () => this.run(() => this.onTakeAll()));
        this.list.addEventListener('click', (event) => {
            const button = event.target.closest('[data-take]');
            if (button) this.run(() => this.onTake(Number(button.dataset.take)));
        });
    }

    get isOpen() {
        return !this.root.hidden;
    }

    async run(action) {
        if (this.busy) return;
        this.busy = true;
        this.root.classList.add('is-busy');
        try {
            await action();
        } finally {
            this.busy = false;
            this.root.classList.remove('is-busy');
        }
    }

    open(chest) {
        this.render(chest);
        this.root.hidden = false;
    }

    close() {
        this.root.hidden = true;
    }

    render(chest) {
        this.chest = chest;
        this.source.textContent = chest.monster ? `${chest.monster} · niveau ${chest.level}` : 'Trouvaille';
        this.list.innerHTML = chest.contents.map((item) => {
            const bonuses = Object.entries(item.bonuses ?? {}).map(([stat, value]) => `+${value} ${STAT_LABELS[stat] ?? stat}`);
            if (item.effects?.heal) bonuses.push(`Rend ${item.effects.heal} santé`);
            return `
                <li class="loot-item rarity-${escapeHtml(item.rarity)}" style="--rarity:${escapeHtml(item.rarityColor)}">
                    <span class="loot-item__icon">${itemIcon(item)}${item.quantity > 1 ? `<b>${item.quantity}</b>` : ''}</span>
                    <span class="loot-item__text">
                        <strong>${escapeHtml(item.name)}</strong>
                        <small>${escapeHtml(item.rarityLabel)}${item.slotLabel ? ` · ${escapeHtml(item.slotLabel)}` : ''}${item.slot ? ` · niv. ${item.itemLevel}` : ''}</small>
                        ${bonuses.length ? `<em>${escapeHtml(bonuses.join(' · '))}</em>` : ''}
                    </span>
                    <button type="button" class="loot-item__take" data-take="${item.index}">Prendre</button>
                </li>`;
        }).join('');
    }
}
