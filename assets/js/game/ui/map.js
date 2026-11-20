/**
 * Carte du monde (touche M) : vue de dessus dessinée à partir du terrain (zones, relief, chemins),
 * avec le joueur, l'objectif de quête, les PNJ, la marchande, la maison et les boss.
 * Molette = zoom, glisser = déplacer, survol = nom et niveaux de la zone.
 * Les zones jamais visitées restent dans le brouillard.
 */
import { zoneAt, heightAt, walkableDistance, WORLD_SIZE, WORLD_LIMIT } from '../terrain.js';

const RESOLUTION = 256; // pixels de la carte (≈ 1,4 m par pixel)
const HALF = WORLD_SIZE / 2;
const MIN_ZOOM = 1;
const MAX_ZOOM = 5;

/** Couleur de fond de chaque zone (r, g, b). */
const ZONE_COLORS = {
    village: [150, 128, 82],
    lisiere: [78, 118, 58],
    chemin: [66, 104, 54],
    collines: [138, 124, 90],
    sombrebois: [44, 60, 50],
    ruine: [96, 92, 112],
};
const PATH_COLOR = [176, 146, 98];
const MOUNTAIN_COLOR = [92, 88, 84];

const escapeHtml = (text) => String(text ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', '\'': '&#39;' }[c]));

/** Coordonnées monde → pourcentage de la carte (nord = +Z en haut, est = +X à droite). */
const toPercent = (x, z) => ({ left: ((x + HALF) / WORLD_SIZE) * 100, top: ((HALF - z) / WORLD_SIZE) * 100 });

export class WorldMap {
    constructor(root, { onClose }) {
        this.root = root;
        this.onClose = onClose;
        this.zoom = 1.15;
        this.pan = { x: 0, y: 0 };
        this.base = null; // image du terrain, calculée une seule fois
        this.zones = new Map();

        root.innerHTML = `
            <div class="map__panel" role="dialog" aria-modal="true" aria-label="Carte du monde">
                <header class="map__head">
                    <div>
                        <p class="map__kicker">Carte</p>
                        <h2>Les terres d'Eden</h2>
                    </div>
                    <div class="map__tools">
                        <button type="button" class="map__tool" data-zoom="1" aria-label="Zoomer">+</button>
                        <button type="button" class="map__tool" data-zoom="-1" aria-label="Dézoomer">−</button>
                        <button type="button" class="map__tool map__tool--wide" data-center>Me centrer</button>
                        <button type="button" class="map__close" data-close aria-label="Fermer la carte">×</button>
                    </div>
                </header>
                <div class="map__body">
                    <div class="map__viewport" data-viewport>
                        <div class="map__sheet" data-sheet>
                            <canvas class="map__canvas" data-canvas width="${RESOLUTION}" height="${RESOLUTION}"></canvas>
                            <div class="map__labels" data-labels></div>
                            <div class="map__markers" data-markers></div>
                        </div>
                        <p class="map__hover" data-hover hidden></p>
                    </div>
                    <aside class="map__legend">
                        <p class="map__goal" data-goal></p>
                        <ul>
                            <li><span class="map-pin map-pin--player"></span> Vous</li>
                            <li><span class="map-pin map-pin--quest"></span> Objectif de quête</li>
                            <li><span class="map-pin map-pin--npc"></span> Personnage</li>
                            <li><span class="map-pin map-pin--merchant"></span> Marchande</li>
                            <li><span class="map-pin map-pin--home"></span> Votre maison</li>
                            <li><span class="map-pin map-pin--boss"></span> Boss</li>
                        </ul>
                        <p class="map__help"><kbd>Molette</kbd> zoom · <kbd>Glisser</kbd> déplacer · <kbd>M</kbd> fermer</p>
                    </aside>
                </div>
            </div>`;

        this.viewport = root.querySelector('[data-viewport]');
        this.sheet = root.querySelector('[data-sheet]');
        this.canvas = root.querySelector('[data-canvas]');
        this.labelsEl = root.querySelector('[data-labels]');
        this.markersEl = root.querySelector('[data-markers]');
        this.hoverEl = root.querySelector('[data-hover]');
        this.goalEl = root.querySelector('[data-goal]');

        root.querySelector('[data-close]').addEventListener('click', () => this.onClose());
        root.querySelectorAll('[data-zoom]').forEach((button) => button.addEventListener('click', () => this.zoomBy(Number(button.dataset.zoom) * 0.6)));
        root.querySelector('[data-center]').addEventListener('click', () => this.centerOn(this.player));
        root.addEventListener('click', (event) => {
            if (event.target === root) this.onClose();
        });

        this.viewport.addEventListener('wheel', (event) => {
            event.preventDefault();
            this.zoomBy(event.deltaY < 0 ? 0.35 : -0.35, event);
        }, { passive: false });

        let drag = null;
        this.viewport.addEventListener('pointerdown', (event) => {
            drag = { x: event.clientX, y: event.clientY, pan: { ...this.pan } };
            this.viewport.setPointerCapture(event.pointerId);
            this.viewport.classList.add('is-dragging');
        });
        this.viewport.addEventListener('pointermove', (event) => {
            if (drag) {
                this.pan.x = drag.pan.x + (event.clientX - drag.x);
                this.pan.y = drag.pan.y + (event.clientY - drag.y);
                this.applyTransform();
            }
            this.showHover(event);
        });
        const stop = () => {
            drag = null;
            this.viewport.classList.remove('is-dragging');
        };
        this.viewport.addEventListener('pointerup', stop);
        this.viewport.addEventListener('pointercancel', stop);
        this.viewport.addEventListener('pointerleave', () => { this.hoverEl.hidden = true; });
    }

    /**
     * context : { player: {x, z, heading}, visited: Set, zones: Map(code → zone), markers: [{kind, x, z, label}], goal }
     */
    open(context) {
        this.root.hidden = false;
        this.context = context;
        this.player = context.player;
        this.zones = context.zones;
        if (!this.base) this.buildBase();
        this.paint(context.visited);
        this.renderLabels(context.visited);
        this.renderMarkers(context);
        this.goalEl.innerHTML = context.goal
            ? `<b>Objectif</b> ${escapeHtml(context.goal.label)} <span>${Math.round(context.goal.distance)} m</span>`
            : '<b>Objectif</b> Explorez librement.';
        this.centerOn(this.player);
    }

    close() {
        this.root.hidden = true;
        this.hoverEl.hidden = true;
    }

    /** Relief et couleurs calculés une fois (≈ 65 000 points), puis gardés en mémoire. */
    buildBase() {
        const size = RESOLUTION;
        const step = WORLD_SIZE / size;
        const zones = new Array(size * size);
        const colors = new Uint8ClampedArray(size * size * 4);
        const heights = new Float32Array((size + 1) * (size + 1));
        for (let j = 0; j <= size; j += 1) {
            for (let i = 0; i <= size; i += 1) heights[j * (size + 1) + i] = heightAt(-HALF + i * step, HALF - j * step);
        }

        for (let j = 0; j < size; j += 1) {
            for (let i = 0; i < size; i += 1) {
                const x = -HALF + (i + 0.5) * step;
                const z = HALF - (j + 0.5) * step;
                const index = j * size + i;
                const outside = Math.max(Math.abs(x), Math.abs(z)) > WORLD_LIMIT;
                const zone = outside ? null : zoneAt(x, z);
                zones[index] = zone;

                let color = outside ? MOUNTAIN_COLOR : ZONE_COLORS[zone] ?? ZONE_COLORS.lisiere;
                if (!outside && walkableDistance(x, z) < 0.5 && zone !== 'village') color = PATH_COLOR;
                if (!outside && zone === 'village' && walkableDistance(x, z) < -6) color = [164, 140, 92];

                // Ombrage du relief (lumière venant du nord-ouest).
                const h = heights[j * (size + 1) + i];
                const slope = (h - heights[(j + 1) * (size + 1) + i + 1]) * 0.9;
                const light = Math.max(0.55, Math.min(1.35, 1 + slope * 0.35 + h * 0.012));
                colors[index * 4] = color[0] * light;
                colors[index * 4 + 1] = color[1] * light;
                colors[index * 4 + 2] = color[2] * light;
                colors[index * 4 + 3] = 255;
            }
        }
        this.base = { zones, colors };

        // Centre de chaque zone, pour placer son nom.
        const sums = new Map();
        zones.forEach((zone, index) => {
            if (!zone) return;
            const entry = sums.get(zone) ?? { i: 0, j: 0, n: 0 };
            entry.i += index % size;
            entry.j += Math.floor(index / size);
            entry.n += 1;
            sums.set(zone, entry);
        });
        this.centroids = [...sums].map(([zone, { i, j, n }]) => ({ zone, left: (i / n / size) * 100, top: (j / n / size) * 100 }));
    }

    /** Dessine la carte ; les zones jamais visitées sont dans le brouillard. */
    paint(visited) {
        const { zones, colors } = this.base;
        const image = new ImageData(new Uint8ClampedArray(colors), RESOLUTION, RESOLUTION);
        const data = image.data;
        for (let index = 0; index < zones.length; index += 1) {
            if (!zones[index] || visited.has(zones[index])) continue;
            const grey = (data[index * 4] + data[index * 4 + 1] + data[index * 4 + 2]) / 3;
            // Brouillard : on devine le relief et les chemins, sans les couleurs.
            data[index * 4] = grey * 0.55 + 14;
            data[index * 4 + 1] = grey * 0.55 + 14;
            data[index * 4 + 2] = grey * 0.6 + 22;
        }
        this.canvas.getContext('2d').putImageData(image, 0, 0);
    }

    renderLabels(visited) {
        this.labelsEl.innerHTML = this.centroids.map(({ zone, left, top }) => {
            const info = this.zones.get(zone);
            const known = visited.has(zone);
            const name = info?.name ?? zone;
            const levels = !known ? 'inexploré' : info && !info.safe ? `niv. ${info.minLevel}–${info.maxLevel}` : info?.safe ? 'zone sûre' : '';
            return `<p class="map-label${known ? '' : ' is-fog'}" style="left:${left}%;top:${top}%"><b>${escapeHtml(name)}</b>${levels ? `<span>${escapeHtml(levels)}</span>` : ''}</p>`;
        }).join('');
    }

    renderMarkers({ player, markers }) {
        const pins = markers.map((marker) => {
            const { left, top } = toPercent(marker.x, marker.z);
            return `<span class="map-pin map-pin--${marker.kind}" style="left:${left}%;top:${top}%" title="${escapeHtml(marker.label ?? '')}"></span>`;
        });
        const { left, top } = toPercent(player.x, player.z);
        pins.push(`<span class="map-pin map-pin--player" style="left:${left}%;top:${top}%;--heading:${player.heading}deg" title="Vous"></span>`);
        this.markersEl.innerHTML = pins.join('');
    }

    /** Survol : nom et niveaux de la zone sous la souris. */
    showHover(event) {
        const rect = this.sheet.getBoundingClientRect();
        const u = (event.clientX - rect.left) / rect.width;
        const v = (event.clientY - rect.top) / rect.height;
        if (u < 0 || u > 1 || v < 0 || v > 1) {
            this.hoverEl.hidden = true;
            return;
        }
        const x = -HALF + u * WORLD_SIZE;
        const z = HALF - v * WORLD_SIZE;
        const outside = Math.max(Math.abs(x), Math.abs(z)) > WORLD_LIMIT;
        const zone = outside ? null : zoneAt(x, z);
        const info = zone ? this.zones.get(zone) : null;
        const known = zone && this.context.visited.has(zone);
        let text = outside ? 'Montagnes infranchissables' : `${info?.name ?? zone}${known ? '' : ' (inexploré)'}`;
        if (info) text += info.safe ? ' · zone sûre' : ` · niveaux ${info.minLevel} à ${info.maxLevel}`;
        const distance = Math.round(Math.hypot(x - this.player.x, z - this.player.z));
        this.hoverEl.textContent = `${text} · à ${distance} m`;
        const box = this.viewport.getBoundingClientRect();
        this.hoverEl.style.left = `${event.clientX - box.left + 14}px`;
        this.hoverEl.style.top = `${event.clientY - box.top + 14}px`;
        this.hoverEl.hidden = false;
    }

    zoomBy(delta, event = null) {
        const previous = this.zoom;
        this.zoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, this.zoom + delta));
        if (event) {
            // Zoom vers le point sous la souris.
            const box = this.viewport.getBoundingClientRect();
            const cx = event.clientX - box.left - box.width / 2;
            const cy = event.clientY - box.top - box.height / 2;
            const ratio = this.zoom / previous;
            this.pan.x = cx - (cx - this.pan.x) * ratio;
            this.pan.y = cy - (cy - this.pan.y) * ratio;
        }
        this.applyTransform();
    }

    centerOn(point) {
        if (!point) return;
        const size = this.viewport.clientHeight || 520;
        const { left, top } = toPercent(point.x, point.z);
        this.pan.x = -((left - 50) / 100) * size * this.zoom;
        this.pan.y = -((top - 50) / 100) * size * this.zoom;
        this.applyTransform();
    }

    applyTransform() {
        this.sheet.style.transform = `translate(-50%, -50%) translate(${this.pan.x}px, ${this.pan.y}px) scale(${this.zoom})`;
        this.sheet.style.setProperty('--pin-scale', String(1 / this.zoom));
    }
}
