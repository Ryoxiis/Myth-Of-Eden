/**
 * Plan du monde : la liste de tout ce qui est posé dans la carte (bâtiments, arbres, lanternes…).
 * Ce ne sont que des descriptions : rien n'est chargé ici. Le streamer créera chaque objet
 * seulement quand le joueur s'approchera de sa case.
 */
import { random } from './noise.js';
import { heightAt, walkableDistance, pathX, RUIN_CENTER, WORLD_SIZE, VILLAGE_RADIUS } from './terrain.js';

/** Maison du joueur : sans rotation, ses portes donnent sur ±X, celle de l'est sur la place. */
export const HOME = { x: -13, z: 5, rotation: 0 };
export const HOME_DOOR = { x: HOME.x + 4.4, z: HOME.z };

const P = Math.PI;

/** Objets de petite taille : masqués au-delà de cette distance (LOD « rien »). */
export const SMALL_PROPS = new Set(['barrel', 'crate1', 'crate2', 'crateStack', 'bush1', 'bush2', 'bush3', 'rocks2', 'rocks3', 'rocks4', 'stump', 'stumpAxe', 'cellarDoor', 'fence']);

function item(model, x, z, options = {}) {
    return { type: 'model', model, x, z, y: options.y ?? heightAt(x, z), rotation: 0, scale: 1, collider: 'box', shrink: 0.85, cast: true, ...options };
}

export function buildLayout() {
    const items = [];
    const add = (...entries) => items.push(...entries);

    /* --- Village --------------------------------------------------- */
    add(
        item('cottage', HOME.x, HOME.z, { rotation: HOME.rotation, shrink: 0.95 }),
        item('cellarDoor', HOME.x - 1.5, HOME.z - 5.6, { rotation: P / 2, collider: null }),
        item('cottage', 7, -14, { rotation: P, shrink: 0.8 }),
        item('inn', 15, 13, { rotation: -P / 2 - 0.25, shrink: 0.82 }),
        item('sawMill', -17, -15, { rotation: P / 4, shrink: 0.7 }),
        item('waterwell', 0, 0, { rotation: 0.4, shrink: 0.75 }),
        item('wagon', 5.5, 6.5, { rotation: -0.7 }),
        item('barrel', 8.2, 7.6), item('barrel', 9.1, 7), item('barrel', 8.7, 8.6, { rotation: 1 }),
        item('crateStack', 10.2, 4.5, { rotation: 0.3 }),
        item('crate2', -9.5, 9.5, { rotation: 0.5 }), item('crate1', -8.6, 10.4, { rotation: 1.2 }),
        item('barrel', -9.8, 1), item('crate2', 3.6, -12.2, { rotation: 0.2 }),
        item('logSaw', -11, -20, { rotation: P / 4 }),
        item('stumpAxe', -9.5, -10.5, { rotation: 2 }),
        item('hollowLog', -21, -6, { rotation: 0.9 }),
        item('stump', 14, -8, { rotation: 0.7 }),
    );
    for (let i = 0; i < 4; i += 1) add(item('fence', -19, 2 + i * 3.4, { shrink: 1 }));
    for (let i = 0; i < 3; i += 1) add(item('fence', -17.3 + i * 3.4, 14.8, { rotation: P / 2, shrink: 1 }));
    for (let i = 0; i < 4; i += 1) add(item('fence', 22, -2 + i * 3.4, { shrink: 1 }));

    // Lanternes (leur lumière vient d'un petit groupe de lampes partagées, voir World).
    const lantern = (model, x, z, rotation) => ({ ...item(model, x, z, { rotation, collider: 'trunk' }), lantern: true });
    add(
        lantern('lightPost1', -6, 9.5, P / 2),
        lantern('lightPost2', 5.5, -4.5, -P / 2),
        lantern('lightPost1', 6.5, 12, P),
        lantern('lightPost2', -3, -13, 0),
        lantern('lightPost3', -4.5, -24, P / 2),
    );
    // Lanternes le long du chemin : de plus en plus rares en s'enfonçant dans la forêt.
    for (const z of [-48, -78, -112]) {
        const side = z % 2 === 0 ? 1 : -1;
        add(lantern('lightPost2', pathX(z) + side * 3.6, z, side > 0 ? P : 0));
    }

    // Arbres isolés dans le village.
    const rand = random(7);
    for (const [x, z] of [[-6, 15], [17, -9], [-22, 10], [20, 3], [-4, -21], [11, 21]]) {
        add(item(`tree${1 + Math.floor(rand() * 4)}`, x, z, { rotation: rand() * 6.28, scale: 0.85 + rand() * 0.3, collider: 'trunk' }));
    }

    /* --- Forêt sur tout le terrain ---------------------------------- */
    const half = WORLD_SIZE / 2 - 8;
    const forest = random(1234);
    for (let i = 0; i < 2200; i += 1) {
        const x = (forest() * 2 - 1) * half;
        const z = (forest() * 2 - 1) * half;
        const d = walkableDistance(x, z);
        const inVillage = Math.hypot(x, z) < VILLAGE_RADIUS - 3;
        if (d < 3 || inVillage) continue;
        // Plus dense près des zones praticables (lisière), plus clairsemé au loin.
        const keep = d < 30 ? 0.7 : 0.4;
        if (forest() > keep) continue;
        add(item(`tree${1 + Math.floor(forest() * 4)}`, x, z, {
            y: heightAt(x, z) - 0.25,
            rotation: forest() * P * 2,
            scale: 0.9 + forest() * 0.7,
            collider: d < 6 ? 'trunk' : null,
        }));
    }

    // Buissons et rochers en lisière et dans le village.
    const scatter = random(99);
    for (let i = 0; i < 900; i += 1) {
        const x = (scatter() * 2 - 1) * half;
        const z = (scatter() * 2 - 1) * half;
        const d = walkableDistance(x, z);
        if (d > 18 || Math.hypot(x - HOME.x, z - HOME.z) < 7 || Math.hypot(x - 15, z - 13) < 11 || Math.hypot(x, z) < 11) continue;
        const inVillage = Math.hypot(x, z) < VILLAGE_RADIUS;
        if (d < 0.8 && !inVillage) continue; // chemin et clairière dégagés
        if (d < -1 && inVillage && scatter() > 0.35) continue;
        const isRock = scatter() < 0.28;
        add(item(isRock ? `rocks${2 + Math.floor(scatter() * 3)}` : `bush${1 + Math.floor(scatter() * 3)}`, x, z, {
            y: heightAt(x, z) - 0.05,
            rotation: scatter() * 6.28,
            scale: 0.8 + scatter() * 0.6,
            collider: isRock && d < 1 ? 'box' : null,
        }));
    }
    for (let i = 0; i < 40; i += 1) {
        const x = (scatter() * 2 - 1) * half;
        const z = (scatter() * 2 - 1) * half;
        const d = walkableDistance(x, z);
        if (d < 4) continue;
        add(item('rocks1', x, z, { y: heightAt(x, z) - 0.4, rotation: scatter() * 6.28, scale: 0.8 + scatter() * 0.9, collider: null }));
    }

    /* --- Ruine au bout du chemin ------------------------------------- */
    const rx = RUIN_CENTER.x;
    const rz = RUIN_CENTER.z - 8;
    add(
        item('wallArch', rx, rz, { collider: null }),
        item('wall', rx - 6, rz + 0.6, { rotation: 0.15 }),
        item('wall', rx + 6.5, rz + 0.8, { rotation: -0.2 }),
        item('wallCorner', rx + 11, rz + 3, { rotation: P }),
        item('wallCorner', rx - 11, rz + 3, { rotation: -P / 2 }),
        item('rocks1', rx - 9, rz + 7, { rotation: 1.4 }),
        item('rocks2', rx + 7, rz + 9),
        item('rocks3', rx + 3, rz + 11),
        item('hollowLog', rx - 6, rz + 13, { rotation: 0.4 }),
        { type: 'ruinVeil', x: rx, z: rz, y: 0 },
    );

    return items;
}
