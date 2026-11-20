/**
 * Boutique d'un marchand : onglet « Acheter » (équipement de débutant, potions)
 * et onglet « Vendre » (le butin du sac contre des runes).
 * Les objets de rareté épique et au-delà demandent une confirmation avant d'être vendus.
 */
import { itemIcon, runeIcon } from './icons.js';

const STAT_LABELS = {
    health: 'Santé', stamina: 'Endurance', strength: 'Force', agility: 'Agilité', stealth: 'Discrétion', magicMastery: 'Magie', tracking: 'Pistage',
};
const PRECIOUS = new Set(['epic', 'legendary', 'cosmic', 'omniversal']);
const escapeHtml = (text) => String(text ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', '\'': '&#39;' }[c]));

function details(item) {
    const parts = Object.entries(item.bonuses ?? {}).map(([stat, value]) => `+${value} ${STAT_LABELS[stat] ?? stat}`);
    if (item.effects?.heal) parts.push(`Rend ${item.effects.heal} santé`);
    return parts.join(' · ');
}

export class Shop {
    constructor(root, { onBuy, onSell, onClose }) {
        this.root = root;
        this.onBuy = onBuy;
        this.onSell = onSell;
        this.onClose = onClose;
        this.tab = 'buy';
        this.busy = false;
        this.confirming = null;

        root.innerHTML = `
            <div class="shop__panel" role="dialog" aria-modal="true" aria-label="Boutique">
                <header class="shop__head">
                    <div>
                        <p class="shop__kicker">Marchande</p>
                        <h2 data-shop-name></h2>
                        <p class="shop__greeting" data-shop-greeting></p>
                    </div>
                    <div class="shop__purse" title="Vos runes">${runeIcon('rune--lg')}<b data-shop-runes>0</b></div>
                    <button type="button" class="shop__close" data-close aria-label="Fermer la boutique">×</button>
                </header>
                <nav class="shop__tabs">
                    <button type="button" data-tab="buy" class="is-active">Acheter</button>
                    <button type="button" data-tab="sell">Vendre</button>
                </nav>
                <ul class="shop__list" data-shop-list></ul>
                <footer class="shop__foot"><span data-shop-hint></span><span><kbd>E</kbd> ou <kbd>Échap</kbd> pour fermer</span></footer>
            </div>`;
        this.list = root.querySelector('[data-shop-list]');
        this.runesEl = root.querySelector('[data-shop-runes]');
        this.hint = root.querySelector('[data-shop-hint]');
        root.querySelector('[data-close]').addEventListener('click', () => this.onClose());
        root.querySelectorAll('[data-tab]').forEach((button) => button.addEventListener('click', () => {
            this.tab = button.dataset.tab;
            this.confirming = null;
            this.render();
        }));
        this.list.addEventListener('click', (event) => {
            const button = event.target.closest('[data-action]');
            if (!button || button.disabled || this.busy) return;
            const id = Number(button.dataset.id);
            if (button.dataset.action === 'buy') this.run(() => this.onBuy(id));
            else {
                const all = button.dataset.all === '1';
                const precious = button.dataset.precious === '1';
                const key = `${id}:${all}`;
                if (precious && this.confirming !== key) {
                    this.confirming = key;
                    this.render();
                    return;
                }
                this.confirming = null;
                this.run(() => this.onSell(id, all ? Number(button.dataset.quantity) : 1));
            }
        });
    }

    get isOpen() {
        return !this.root.hidden;
    }

    async run(action) {
        this.busy = true;
        this.root.classList.add('is-busy');
        try {
            await action();
        } finally {
            this.busy = false;
            this.root.classList.remove('is-busy');
        }
    }

    open(merchant, state) {
        this.merchant = merchant;
        this.state = state;
        this.tab = 'buy';
        this.confirming = null;
        this.root.querySelector('[data-shop-name]').textContent = merchant.name;
        this.root.querySelector('[data-shop-greeting]').textContent = `« ${merchant.greeting} »`;
        this.render();
        this.root.hidden = false;
    }

    close() {
        this.root.hidden = true;
    }

    update(state) {
        this.state = state;
        if (this.isOpen) this.render();
    }

    render() {
        const runes = this.state?.runes ?? 0;
        this.runesEl.textContent = runes.toLocaleString('fr-FR');
        this.root.querySelectorAll('[data-tab]').forEach((button) => button.classList.toggle('is-active', button.dataset.tab === this.tab));

        if (this.tab === 'buy') {
            this.hint.textContent = 'Équipement de débutant et potions.';
            this.list.innerHTML = this.merchant.offers.map((offer) => {
                const affordable = runes >= offer.price;
                return `
                    <li class="shop-row rarity-${escapeHtml(offer.rarity)}" style="--rarity:${escapeHtml(offer.rarityColor)}">
                        <span class="shop-row__icon">${itemIcon(offer)}</span>
                        <span class="shop-row__text">
                            <strong>${escapeHtml(offer.name)}</strong>
                            <small>${offer.rarity !== 'common' ? `${escapeHtml(offer.rarityLabel)} · ` : ''}${escapeHtml(offer.slotLabel ?? offer.categoryLabel)}</small>
                            <em>${escapeHtml(details(offer))}</em>
                        </span>
                        <span class="shop-row__price ${affordable ? '' : 'is-short'}">${runeIcon()}${offer.price}</span>
                        <button type="button" class="shop-row__btn" data-action="buy" data-id="${offer.id}" ${affordable ? '' : 'disabled'}>Acheter</button>
                    </li>`;
            }).join('');
            return;
        }

        const sellable = (this.state?.inventory ?? []).filter((item) => !item.equippedSlot);
        this.hint.textContent = 'Les objets équipés ne se vendent pas : retirez-les d\'abord (B).';
        this.list.innerHTML = sellable.length === 0
            ? '<li class="shop__empty">Votre sac est vide.</li>'
            : sellable.map((item) => {
                const canSell = item.sellPrice > 0;
                const precious = PRECIOUS.has(item.rarity) ? '1' : '0';
                const confirmOne = this.confirming === `${item.id}:false`;
                const confirmAll = this.confirming === `${item.id}:true`;
                return `
                    <li class="shop-row rarity-${escapeHtml(item.rarity)}" style="--rarity:${escapeHtml(item.rarityColor)}">
                        <span class="shop-row__icon">${itemIcon(item)}${item.quantity > 1 ? `<b>${item.quantity}</b>` : ''}</span>
                        <span class="shop-row__text">
                            <strong>${escapeHtml(item.name)}</strong>
                            <small>${escapeHtml(item.rarityLabel)}${item.slot ? ` · niv. ${item.itemLevel}` : ''}</small>
                            <em>${escapeHtml(details(item))}</em>
                        </span>
                        <span class="shop-row__price">${canSell ? `${runeIcon()}${item.sellPrice}` : '—'}</span>
                        <span class="shop-row__actions">
                            <button type="button" class="shop-row__btn ${confirmOne ? 'is-confirm' : ''}" data-action="sell" data-id="${item.id}" data-precious="${precious}" ${canSell ? '' : 'disabled'}>${confirmOne ? 'Confirmer ?' : 'Vendre'}</button>
                            ${canSell && item.quantity > 1 ? `<button type="button" class="shop-row__btn is-ghost ${confirmAll ? 'is-confirm' : ''}" data-action="sell" data-all="1" data-quantity="${item.quantity}" data-id="${item.id}" data-precious="${precious}">${confirmAll ? 'Confirmer ?' : `Tout (${item.sellPrice * item.quantity})`}</button>` : ''}
                        </span>
                    </li>`;
            }).join('');
    }
}
