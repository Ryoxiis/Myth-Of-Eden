/**
 * Inventaire (touche B) : équipement porté, statistiques, sac en grille et fiche de l'objet choisi
 * avec les actions Utiliser / Équiper / Retirer (envoyées à l'API Symfony).
 */
import { itemIcon, slotIcon, runeIcon } from './icons.js';
import { basicAttackFor } from '../combat.js';

const BAG_SIZE = 24;
const SLOTS = [
    ['main_hand', 'Main principale'], ['off_hand', 'Main secondaire'], ['head', 'Tête'], ['body', 'Torse'],
    ['hands', 'Mains'], ['feet', 'Pieds'], ['accessory', 'Accessoire'],
];
const STAT_LABELS = {
    health: 'Santé', stamina: 'Endurance', strength: 'Force', agility: 'Agilité', stealth: 'Discrétion', magicMastery: 'Magie', tracking: 'Pistage',
};
const escapeHtml = (text) => String(text ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', '\'': '&#39;' }[c]));

export class Inventory {
    constructor(root, { onUse, onEquip, onClose }) {
        this.root = root;
        this.onUse = onUse;
        this.onEquip = onEquip;
        this.onClose = onClose;
        this.selectedId = null;
        this.busy = false;

        root.innerHTML = `
            <div class="inventory__backdrop" data-close></div>
            <div class="inventory__panel" role="dialog" aria-modal="true" aria-label="Inventaire">
                <header class="inventory__head">
                    <h2>Inventaire</h2>
                    <span class="inventory__hint"><kbd>B</kbd> pour fermer</span>
                    <button type="button" class="inventory__close" data-close aria-label="Fermer l'inventaire">×</button>
                </header>
                <div class="inventory__body">
                    <section class="inventory__gear">
                        <h3>Équipement</h3>
                        <ul class="gear-slots" data-gear></ul>
                        <h3>Caractéristiques</h3>
                        <dl class="inventory__stats" data-stats></dl>
                    </section>
                    <section class="inventory__bag">
                        <h3>Sac <small data-bag-count></small></h3>
                        <ul class="bag-grid" data-grid></ul>
                        <article class="item-detail" data-detail></article>
                    </section>
                </div>
            </div>`;
        this.gearEl = root.querySelector('[data-gear]');
        this.statsEl = root.querySelector('[data-stats]');
        this.gridEl = root.querySelector('[data-grid]');
        this.detailEl = root.querySelector('[data-detail]');
        this.countEl = root.querySelector('[data-bag-count]');

        root.querySelectorAll('[data-close]').forEach((el) => el.addEventListener('click', () => this.onClose()));
        root.addEventListener('click', (event) => {
            const cell = event.target.closest('[data-entry]');
            if (cell) {
                this.selectedId = Number(cell.dataset.entry);
                this.render(this.state);
            }
            const action = event.target.closest('[data-action]');
            if (action && !this.busy) this.act(action.dataset.action, Number(action.dataset.id));
        });
        root.addEventListener('dblclick', (event) => {
            const cell = event.target.closest('[data-entry]');
            if (!cell || this.busy) return;
            const item = this.items.find((entry) => entry.id === Number(cell.dataset.entry));
            if (item?.category === 'consumable') this.act('use', item.id);
            else if (item?.slot) this.act('equip', item.id);
        });
    }

    get isOpen() {
        return !this.root.hidden;
    }

    open() {
        this.root.hidden = false;
    }

    close() {
        this.root.hidden = true;
    }

    async act(action, id) {
        this.busy = true;
        this.root.classList.add('is-busy');
        try {
            if (action === 'use') await this.onUse(id);
            else await this.onEquip(id);
        } finally {
            this.busy = false;
            this.root.classList.remove('is-busy');
        }
    }

    render(state) {
        if (!state) return;
        this.state = state;
        const items = state.inventory ?? [];
        this.items = items;
        const equipped = new Map(items.filter((item) => item.equippedSlot).map((item) => [item.equippedSlot, item]));
        const bag = items.filter((item) => !item.equippedSlot);
        if (!items.some((item) => item.id === this.selectedId)) this.selectedId = (bag[0] ?? items[0])?.id ?? null;

        this.gearEl.innerHTML = SLOTS.map(([slot, label]) => {
            const item = equipped.get(slot);
            return `<li class="gear-slot ${item ? `is-filled rarity-${item.rarity}` : ''} ${item && item.id === this.selectedId ? 'is-selected' : ''}" ${item ? `data-entry="${item.id}" style="--rarity:${item.rarityColor}"` : ''}>
                <span class="gear-slot__icon">${item ? itemIcon(item) : slotIcon(slot)}</span>
                <span class="gear-slot__text"><small>${label}</small><b>${item ? escapeHtml(item.name) : '—'}</b></span>
            </li>`;
        }).join('');

        const stats = state.character?.stats ?? {};
        const attack = basicAttackFor(state);
        this.statsEl.innerHTML = Object.entries(STAT_LABELS)
            .map(([code, label]) => `<div><dt>${label}</dt><dd>${stats[code] ?? '—'}</dd></div>`).join('')
            + `<div class="is-attack" title="Attaque de base (clic gauche) : dépend de l'arme tenue et de vos caractéristiques"><dt>Attaque (${escapeHtml(attack.familyLabel)})</dt><dd>${attack.min}–${attack.max}</dd></div>`
            + `<div><dt>Coup critique</dt><dd>${Math.round(attack.critChance * 100)} %</dd></div>`;

        const cells = [];
        for (let i = 0; i < BAG_SIZE; i += 1) {
            const item = bag[i];
            cells.push(item
                ? `<li class="bag-cell is-filled rarity-${item.rarity} ${item.category === 'quest' ? 'is-quest' : ''} ${item.id === this.selectedId ? 'is-selected' : ''}" data-entry="${item.id}" style="--rarity:${item.rarityColor}" title="${escapeHtml(item.name)} (${escapeHtml(item.rarityLabel)})">
                        ${itemIcon(item)}${item.quantity > 1 ? `<span class="bag-cell__qty">${item.quantity}</span>` : ''}
                   </li>`
                : '<li class="bag-cell"></li>');
        }
        this.gridEl.innerHTML = cells.join('');
        this.countEl.textContent = `${bag.length} / ${BAG_SIZE}`;
        this.renderDetail(items.find((item) => item.id === this.selectedId));
    }

    renderDetail(item) {
        if (!item) {
            this.detailEl.innerHTML = '<p class="item-detail__empty">Sélectionnez un objet pour voir sa description.</p>';
            return;
        }
        const lines = [];
        if (item.weaponKindLabel) lines.push(`${item.weaponKindLabel}${item.twoHanded ? ' · deux mains' : ''}`);
        for (const [stat, value] of Object.entries(item.bonuses ?? {})) lines.push(`+${value} ${STAT_LABELS[stat] ?? stat}`);
        if (item.effects?.heal) lines.push(`Rend ${item.effects.heal} points de santé`);
        const value = item.sellPrice > 0 ? `<p class="item-detail__value">Revente : ${runeIcon()} ${item.sellPrice}${item.quantity > 1 ? ' l\'unité' : ''}</p>` : '';
        const actions = [];
        if (item.category === 'consumable') actions.push(`<button type="button" class="item-detail__btn" data-action="use" data-id="${item.id}">Utiliser</button>`);
        if (item.slot) {
            actions.push(`<button type="button" class="item-detail__btn ${item.equippedSlot ? 'is-ghost' : ''}" data-action="equip" data-id="${item.id}">${item.equippedSlot ? 'Retirer' : 'Équiper'}</button>`);
        }

        this.detailEl.innerHTML = `
            <div class="item-detail__icon rarity-${item.rarity}" style="--rarity:${item.rarityColor}">${itemIcon(item)}</div>
            <div class="item-detail__body">
                <h4 style="color:${item.rarity === 'common' ? 'inherit' : item.rarity === 'cosmic' ? '#a78bfa' : item.rarityColor}" class="rarity-text-${item.rarity}">${escapeHtml(item.name)}</h4>
                <p class="item-detail__meta">${item.slot ? `${escapeHtml(item.rarityLabel)} · niveau ${item.itemLevel} · ` : ''}${escapeHtml(item.categoryLabel ?? '')}${item.slotLabel ? ` · ${escapeHtml(item.slotLabel)}` : ''}${item.quantity > 1 ? ` · ×${item.quantity}` : ''}</p>
                <p class="item-detail__text">${escapeHtml(item.description ?? '')}</p>
                ${lines.length ? `<ul class="item-detail__bonuses">${lines.map((line) => `<li>${escapeHtml(line)}</li>`).join('')}</ul>` : ''}
                ${value}
                <div class="item-detail__actions">${actions.join('')}</div>
            </div>`;
    }
}
