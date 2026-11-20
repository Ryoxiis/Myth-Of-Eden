/**
 * Icônes dessinées en SVG (traits, 24 × 24) pour les compétences, les objets et les emplacements.
 * Tout est généré ici : aucune image externe à charger.
 */
const PATHS = {
    // Compétences
    arrow: '<path d="M4 20 18 6"/><path d="M13 5h6v6"/><path d="M4 20l2.5-5.5M4 20l5.5-2.5"/>',
    arrows: '<path d="M3 19 15 7"/><path d="M11 6h5v5"/><path d="M8 21 20 9"/><path d="M16 8h5v5"/><path d="M3 13l9-9"/><path d="M8 3h5v5"/>',
    feather: '<path d="M20 4C11 4 6 9 5 19"/><path d="M20 4c0 8-5 13-13 13"/><path d="M5 19l-2 2"/><path d="M9 14h6"/>',
    eye: '<path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
    wind: '<path d="M3 9h11a3 3 0 1 0-3-3"/><path d="M3 15h15a3 3 0 1 1-3 3"/><path d="M3 12h8"/>',
    thorns: '<path d="M4 20c4-4 4-10 8-14s8-2 8-2"/><path d="M8 13l-3-1M10 10l-1-3M13 7l3 1M6 17l3 1"/>',
    moon: '<path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z"/>',
    sword: '<path d="M14.5 3H21v6.5L9 21.5 2.5 15z"/><path d="M5 12l7 7"/><path d="M2 22l3-3"/>',
    shield: '<path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z"/>',
    shield_bash: '<path d="M10 4l7 2.5V12c0 4-3 6.6-7 7.5C6 18.6 3 16 3 12V6.5z"/><path d="M19 9l3-1M19 13h3M19 17l3 1"/>',
    horn: '<path d="M3 15c6 0 10-3 15-9l2 2c-3 6-7 10-14 12z"/><path d="M5 19l1 3"/>',
    whirl: '<path d="M12 12m-2 0a2 2 0 1 0 4 0 4 4 0 1 0-8 0 6 6 0 1 0 12 0 8 8 0 1 0-16 0"/>',
    heart: '<path d="M12 20s-8-5-8-11a4.5 4.5 0 0 1 8-2.8A4.5 4.5 0 0 1 20 9c0 6-8 11-8 11z"/><path d="M12 9v6M9 12h6"/>',
    bolt: '<path d="M13 2 4 14h7l-1 8 9-12h-7z"/>',
    boot: '<path d="M7 3h5v9l7 3v4H4v-4l3-2z"/><path d="M4 19v2h15v-2"/>',
    stone: '<path d="M5 15l3-7 6-2 5 4 1 6-5 4H9z"/><path d="M9 11l3 2"/>',
    compass: '<circle cx="12" cy="12" r="9"/><path d="M15.5 8.5 13 13l-4.5 2.5L11 11z"/>',
    flame: '<path d="M12 22c4 0 7-3 7-7 0-4-3-6-4-10-2 2-2 4-3 5-1-1-2-2-2-4-3 3-5 6-5 9 0 4 3 7 7 7z"/><path d="M12 22c-2 0-3-1.5-3-3.5S11 15 12 13c1 2 3 3.5 3 5.5S14 22 12 22z"/>',
    mountain: '<path d="M2 20 9 7l4 6 3-4 6 11z"/><path d="M8 9l1.5 1.5L11 9"/>',
    sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
    snowflake: '<path d="M12 2v20M3.3 7l17.4 10M3.3 17 20.7 7"/><path d="M9 4l3 2 3-2M9 20l3-2 3 2M4 10.5l3.4.2L9 8M20 13.5l-3.4-.2L15 16M4 13.5l3.4-.2L9 16M20 10.5l-3.4.2L15 8"/>',
    portal: '<path d="M6 21V10a6 6 0 0 1 12 0v11"/><path d="M4 21h16"/><path d="M12 9v.01M10 13a2 2 0 1 1 4 0v8h-4z"/>',
    star: '<path d="M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9z"/>',
    // Objets
    apple: '<path d="M12 7c-3-2-8-1-8 5 0 5 3 9 5 9 1.2 0 2-.6 3-.6s1.8.6 3 .6c2 0 5-4 5-9 0-6-5-7-8-5z"/><path d="M12 7c0-2 1-4 3-5"/>',
    bandage: '<rect x="2.5" y="8" width="19" height="8" rx="4" transform="rotate(-35 12 12)"/><path d="M10 10.5h.01M12 12h.01M14 13.5h.01M12 9.5h.01M12 14.5h.01"/>',
    bow: '<path d="M6 3c8 2 13 7 15 15"/><path d="M6 3l15 15"/><path d="M3 21l7-7"/><path d="M3 18v3h3"/>',
    staff: '<path d="M5 21 17 9"/><circle cx="18.5" cy="5.5" r="3"/><path d="M14 6l-2-2M18 10l2 2"/>',
    pendant: '<path d="M7 3c0 4 2 6 5 6s5-2 5-6"/><circle cx="12" cy="15" r="5"/><path d="M12 12.5v5M9.5 15h5"/>',
    potion: '<path d="M10 3h4M10.5 3v5L6 15a5 5 0 0 0 4.5 6.5h3A5 5 0 0 0 18 15l-4.5-7V3"/><path d="M7.5 15h9"/>',
    axe: '<path d="M14 3c3 1 6 4 7 7l-4 2-5-5z"/><path d="M12 7 3 21"/>',
    book: '<path d="M4 5c3-1 5-1 8 1 3-2 5-2 8-1v14c-3-1-5-1-8 1-3-2-5-2-8-1z"/><path d="M12 6v14"/>',
    dagger: '<path d="M14 4l6-1-1 6-8 8-5-5z"/><path d="M5 14l5 5M3 21l3-3"/>',
    bag: '<path d="M5 8h14l-1 13H6z"/><path d="M9 8V6a3 3 0 0 1 6 0v2"/>',
    helm: '<path d="M4 15a8 8 0 0 1 16 0v4H4z"/><path d="M12 7v12M8 15h8"/>',
    armor: '<path d="M8 3h8l4 3-2 5v10H6V11L4 6z"/><path d="M8 3c0 2 1.8 3 4 3s4-1 4-3"/>',
    glove: '<path d="M7 21v-7l-2-4 1.5-1L9 12V5a1.5 1.5 0 0 1 3 0v6-7a1.5 1.5 0 0 1 3 0v7-5a1.5 1.5 0 0 1 3 0v10c0 3-2 5-5 5z"/>',
    ring: '<circle cx="12" cy="14" r="6"/><path d="M9 5l3-3 3 3-3 3z"/>',
};

const ITEM_ICONS = {
    apple: 'apple', bandage: 'bandage', short_sword: 'sword', hunting_bow: 'bow', oak_staff: 'staff', engraved_pendant: 'pendant',
    small_health_potion: 'potion', health_potion: 'potion', long_sword: 'sword', runed_greatsword: 'sword', bone_blade: 'sword',
    hand_axe: 'axe', war_axe: 'axe', bone_axe: 'axe', dagger: 'dagger', heavy_crossbow: 'bow', bone_crossbow: 'bow',
    bone_staff: 'staff', wand: 'staff', arcane_tome: 'book', hunter_quiver: 'arrows',
};
const SLOT_ICONS = {
    main_hand: 'sword', off_hand: 'shield', head: 'helm', body: 'armor', hands: 'glove', feet: 'boot', accessory: 'ring',
};

export function icon(name, className = '') {
    const paths = PATHS[name] ?? PATHS.star;
    return `<svg class="icon ${className}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths}</svg>`;
}

export const itemIcon = (item) => icon(ITEM_ICONS[item.code] ?? SLOT_ICONS[item.slot] ?? (item.category === 'consumable' ? 'potion' : 'bag'));
export const slotIcon = (slot) => icon(SLOT_ICONS[slot] ?? 'bag');

/**
 * Rune (monnaie) : orbe doré et sombre parcouru de filaments, avec le glyphe de l'arbre au centre.
 * Dessin original du projet, généré en SVG.
 */
let runeCount = 0;
export function runeIcon(className = '') {
    runeCount += 1;
    const id = `rune-${runeCount}`;
    const rays = Array.from({ length: 22 }, (_, i) => {
        const a = (i / 22) * Math.PI * 2;
        const r1 = 6.5 + (i % 3);
        const r2 = 15 + (i % 4) * 1.4;
        const bend = (i % 2 ? 0.35 : -0.35);
        const x1 = 20 + Math.cos(a) * r1;
        const y1 = 20 + Math.sin(a) * r1;
        const cx = 20 + Math.cos(a + bend) * (r1 + r2) / 2;
        const cy = 20 + Math.sin(a + bend) * (r1 + r2) / 2;
        const x2 = 20 + Math.cos(a) * r2;
        const y2 = 20 + Math.sin(a) * r2;
        return `<path d="M${x1.toFixed(1)} ${y1.toFixed(1)}Q${cx.toFixed(1)} ${cy.toFixed(1)} ${x2.toFixed(1)} ${y2.toFixed(1)}"/>`;
    }).join('');
    return `<svg class="rune ${className}" viewBox="0 0 40 40" aria-hidden="true">
        <defs>
            <radialGradient id="${id}-g" cx="50%" cy="45%" r="55%">
                <stop offset="0" stop-color="#fff1c2"/>
                <stop offset="0.25" stop-color="#e3b55a"/>
                <stop offset="0.7" stop-color="#5a3f1c"/>
                <stop offset="1" stop-color="#1e140a"/>
            </radialGradient>
            <radialGradient id="${id}-h" cx="50%" cy="50%" r="50%">
                <stop offset="0.6" stop-color="#e8c06a" stop-opacity="0.55"/>
                <stop offset="1" stop-color="#e8c06a" stop-opacity="0"/>
            </radialGradient>
        </defs>
        <circle cx="20" cy="20" r="19.5" fill="url(#${id}-h)"/>
        <circle cx="20" cy="20" r="16.5" fill="url(#${id}-g)" stroke="#2a1c0c" stroke-width="0.8"/>
        <g fill="none" stroke="#f6d98c" stroke-width="0.7" stroke-linecap="round" opacity="0.85">${rays}</g>
        <circle cx="20" cy="20" r="6.2" fill="#2a1c0c" stroke="#f6d98c" stroke-width="0.9"/>
        <path d="M20 15.5v9M20 18.5l-3-2.4M20 18.5l3-2.4M20 21.5l-2.6 2.4M20 21.5l2.6 2.4" stroke="#ffe7a6" stroke-width="1.1" stroke-linecap="round" fill="none"/>
    </svg>`;
}
