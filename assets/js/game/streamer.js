/**
 * Streaming du monde par cases (« chunks »).
 *
 * La carte est découpée en une grille. Chaque case garde la liste des objets qui s'y trouvent ;
 * ils ne sont créés que lorsque le joueur s'approche (rayon de chargement), et détruits quand il
 * s'éloigne assez (rayon de déchargement, plus grand pour éviter les allers-retours incessants).
 * Les modèles 3D eux-mêmes ne sont téléchargés que la première fois qu'une case en a besoin.
 */
export class Streamer {
    /**
     * @param {(item: object) => Promise<() => void>} spawn crée un objet et renvoie sa fonction de destruction
     */
    constructor(spawn, { cellSize = 24, loadRadius = 75, unloadRadius = 95, budget = 3 } = {}) {
        this.spawn = spawn;
        this.cellSize = cellSize;
        this.loadRadius = loadRadius;
        this.unloadRadius = unloadRadius;
        this.budget = budget;
        this.cells = new Map();
        this.loading = 0;
    }

    key(cx, cz) {
        return `${cx},${cz}`;
    }

    add(item) {
        const cx = Math.floor(item.x / this.cellSize);
        const cz = Math.floor(item.z / this.cellSize);
        const key = this.key(cx, cz);
        if (!this.cells.has(key)) {
            this.cells.set(key, { key, cx, cz, items: [], state: 'idle', disposers: [] });
        }
        this.cells.get(key).items.push(item);
    }

    /** Distance du joueur au point le plus proche de la case (0 s'il est dedans). */
    distanceTo(cell, x, z) {
        const s = this.cellSize;
        const dx = Math.max(cell.cx * s - x, 0, x - (cell.cx + 1) * s);
        const dz = Math.max(cell.cz * s - z, 0, z - (cell.cz + 1) * s);
        return Math.hypot(dx, dz);
    }

    /**
     * Met à jour les cases autour du joueur. budget = nombre maximal de cases chargées par appel,
     * pour étaler le travail sur plusieurs images au lieu de figer le jeu.
     */
    async update(x, z, budget = this.budget) {
        const toLoad = [];
        for (const cell of this.cells.values()) {
            const distance = this.distanceTo(cell, x, z);
            if (cell.state === 'idle' && distance <= this.loadRadius) {
                toLoad.push([distance, cell]);
            } else if (cell.state === 'loaded' && distance > this.unloadRadius) {
                this.unload(cell);
            }
        }
        toLoad.sort((a, b) => a[0] - b[0]);
        const batch = toLoad.slice(0, budget).map(([, cell]) => this.load(cell));
        await Promise.all(batch);
        return toLoad.length - batch.length; // cases encore en attente
    }

    /** Charge tout ce qui est dans le rayon (utilisé à l'écran de chargement). */
    async preload(x, z, onProgress = () => {}) {
        const total = [...this.cells.values()].filter((cell) => this.distanceTo(cell, x, z) <= this.loadRadius).length || 1;
        let remaining = total;
        while (remaining > 0) {
            remaining = await this.update(x, z, 4);
            onProgress(1 - remaining / total);
        }
    }

    async load(cell) {
        cell.state = 'loading';
        this.loading += 1;
        try {
            const disposers = await Promise.all(cell.items.map((item) => this.spawn(item)));
            cell.disposers = disposers.filter(Boolean);
            cell.state = 'loaded';
        } catch (error) {
            console.error(`Case ${cell.key} : chargement impossible`, error);
            cell.state = 'idle';
        } finally {
            this.loading -= 1;
        }
    }

    unload(cell) {
        for (const dispose of cell.disposers) dispose();
        cell.disposers = [];
        cell.state = 'idle';
    }

    get stats() {
        let loaded = 0;
        let objects = 0;
        for (const cell of this.cells.values()) {
            if (cell.state === 'loaded') {
                loaded += 1;
                objects += cell.items.length;
            }
        }
        return { cells: this.cells.size, loaded, objects };
    }
}
