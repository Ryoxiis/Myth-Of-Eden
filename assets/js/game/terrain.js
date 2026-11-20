/**
 * Terrain du monde : zones praticables (village, chemin de la forêt, clairière de la ruine),
 * collines tout autour, et sol texturé par mélange (« splat map ») herbe / terre / roche.
 *
 * Monde ouvert : le joueur suit le relief ; les chemins et le village sont aplanis,
 * des montagnes ferment les bords de la carte.
 */
import { Color3 } from '@babylonjs/core/Maths/math.color';
import { CreateGround } from '@babylonjs/core/Meshes/Builders/groundBuilder';
import { VertexBuffer } from '@babylonjs/core/Buffers/buffer';
import { Texture } from '@babylonjs/core/Materials/Textures/texture';
import { DynamicTexture } from '@babylonjs/core/Materials/Textures/dynamicTexture';
import { TerrainMaterial } from '@babylonjs/materials/terrain/terrainMaterial';
import { fbm, noise2, smoothstep, clamp } from './noise.js';

export const WORLD_SIZE = 360;
export const VILLAGE_RADIUS = 30;
/** Limite praticable : au-delà, les montagnes ferment le monde. */
export const WORLD_LIMIT = 158;
const PATH_HALF_WIDTH = 4.5;
const PATH_START_Z = -20;
export const PATH_END_Z = -150;
const RUIN_RADIUS = 15;

/** Tracé sinueux du chemin de la forêt (x en fonction de z). */
export function pathX(z) {
    const t = -z - 24;
    return 1.5 + Math.sin(t * 0.035) * 9 * clamp(t / 25, 0, 1);
}

/** Centre de la clairière de la ruine, au bout du chemin. */
export const RUIN_CENTER = { x: pathX(PATH_END_Z - 4), z: PATH_END_Z - 4 };

/** Routes secondaires (est, ouest, sud) : polylignes [x, z]. */
const ROADS = [
    [[26, 2], [60, 10], [95, 4], [130, 16], [150, 12]],
    [[-26, -2], [-60, -14], [-95, -6], [-130, -20], [-150, -16]],
    [[2, 26], [-6, 60], [8, 100], [0, 150]],
];

function distanceToSegment(x, z, [ax, az], [bx, bz]) {
    const dx = bx - ax;
    const dz = bz - az;
    const t = clamp(((x - ax) * dx + (z - az) * dz) / (dx * dx + dz * dz), 0, 1);
    return Math.hypot(x - (ax + dx * t), z - (az + dz * t));
}

/**
 * Distance au « terrain dégagé » : village, chemins, routes et clairière de la ruine (négative à l'intérieur).
 * Sert à aplanir le sol et à laisser ces endroits libres d'arbres.
 */
export function walkableDistance(x, z) {
    const village = Math.hypot(x, z) - VILLAGE_RADIUS;
    let path = Infinity;
    if (z <= PATH_START_Z && z >= PATH_END_Z) {
        path = Math.abs(x - pathX(z)) - PATH_HALF_WIDTH;
    }
    const ruin = Math.hypot(x - RUIN_CENTER.x, z - RUIN_CENTER.z) - RUIN_RADIUS;
    let road = Infinity;
    for (const line of ROADS) {
        for (let i = 0; i < line.length - 1; i += 1) {
            road = Math.min(road, distanceToSegment(x, z, line[i], line[i + 1]) - 3);
        }
    }
    return Math.min(village, path, ruin, road);
}

/** Monde ouvert : on peut aller partout, sauf dans les montagnes de la bordure. */
export function isWalkable(x, z, margin = 0.4) {
    return Math.max(Math.abs(x), Math.abs(z)) < WORLD_LIMIT - margin;
}

/** Code de la zone (mêmes codes que les zones Symfony) : sert au niveau des monstres et à la sauvegarde. */
export function zoneAt(x, z) {
    if (Math.hypot(x, z) < VILLAGE_RADIUS + 2) return 'village';
    if (Math.hypot(x - RUIN_CENTER.x, z - RUIN_CENTER.z) < RUIN_RADIUS + 9) return 'ruine';
    if (z < -26 && z > PATH_END_Z + 10 && Math.abs(x - pathX(z)) < 26) return 'chemin';
    if (x > 50) return 'collines';
    if (x < -50) return 'sombrebois';
    return 'lisiere';
}

/** Altitude du sol : vallons doux partout, plat sur les chemins, montagnes à la bordure. */
export function heightAt(x, z) {
    const d = walkableDistance(x, z);
    const flatten = smoothstep(1, 16, d);
    const hillsAmplitude = x > 50 ? 13 : x < -50 ? 6 : 7;
    const rolling = (fbm(x * 0.012 + 7, z * 0.012 - 3) - 0.42) * hillsAmplitude + (noise2(x * 0.06, z * 0.06) - 0.5) * 1.2;
    const edge = Math.max(Math.abs(x), Math.abs(z));
    const mountains = smoothstep(WORLD_LIMIT - 8, WORLD_SIZE / 2 - 2, edge) * (16 + fbm(x * 0.03, z * 0.03) * 16);
    return Math.max(-1.5, rolling * flatten) + mountains;
}

/** Chemins de terre : polylignes [x, z] et largeur. Partagé avec la génération de la carte. */
export function dirtPaths() {
    const forest = [];
    for (let z = -6; z >= PATH_END_Z - 6; z -= 2) forest.push([pathX(z), z]);
    return [
        { points: [[0, 0], [-8.4, 5]], width: 2.8 },
        { points: [[0, 0], [6, 6], [10, 9.5]], width: 2.8 },
        { points: [[0, 0], [-6, -6], [-12, -12]], width: 2.4 },
        { points: [[0, 0], [4, -6], [7, -10.5]], width: 2.4 },
        { points: forest, width: 3.4 },
        ...ROADS.map((points) => ({ points: [[0, 0], ...points], width: 3 })),
    ];
}

export class Terrain {
    constructor(scene, assetsUrl) {
        this.scene = scene;
        this.assetsUrl = assetsUrl;
    }

    build() {
        const scene = this.scene;
        const size = WORLD_SIZE;
        const subdivisions = 180;
        const ground = CreateGround('terrain', { width: size, height: size, subdivisions, updatable: true }, scene);

        // Relief + couleurs de sommets (variations douces qui cassent la répétition des textures).
        const positions = ground.getVerticesData(VertexBuffer.PositionKind);
        const colors = new Float32Array((positions.length / 3) * 4);
        for (let i = 0, c = 0; i < positions.length; i += 3, c += 4) {
            const x = positions[i];
            const z = positions[i + 2];
            const h = heightAt(x, z);
            positions[i + 1] = h;
            const macro = 0.78 + fbm(x * 0.05 + 11, z * 0.05 + 5, 3) * 0.38;
            const hillShade = 1 - smoothstep(0, 14, h) * 0.25;
            const tone = macro * hillShade;
            // Teinte des régions : Sombrebois froid et sombre à l'ouest, collines sèches à l'est.
            const west = smoothstep(-40, -70, x);
            const east = smoothstep(40, 70, x);
            colors[c] = tone * (0.98 - west * 0.35 + east * 0.08);
            colors[c + 1] = tone * (1 - west * 0.25 - east * 0.02);
            colors[c + 2] = tone * (0.94 - west * 0.12 - east * 0.18);
            colors[c + 3] = 1;
        }
        ground.updateVerticesData(VertexBuffer.PositionKind, positions);
        ground.setVerticesData(VertexBuffer.ColorKind, colors);
        ground.createNormals(true);

        const material = new TerrainMaterial('terrainMaterial', scene);
        material.mixTexture = this.createSplatMap();
        const tex = (file, scale) => {
            const texture = new Texture(`${this.assetsUrl}textures/${file}`, scene);
            texture.uScale = scale;
            texture.vScale = scale;
            texture.anisotropicFilteringLevel = 8;
            return texture;
        };
        const tiles = size / 4; // une répétition tous les 4 m
        material.diffuseTexture1 = tex('grass_color.jpg', tiles);
        material.diffuseTexture2 = tex('dirt_color.jpg', size / 3.5);
        material.diffuseTexture3 = tex('rock_color.jpg', size / 5);
        material.bumpTexture1 = tex('grass_normal.jpg', tiles);
        material.bumpTexture2 = tex('dirt_normal.jpg', size / 3.5);
        material.bumpTexture3 = tex('rock_normal.jpg', size / 5);
        material.specularColor = new Color3(0.05, 0.05, 0.06);
        material.specularPower = 32;
        material.diffuseColor = new Color3(0.72, 0.76, 0.7);
        material.maxSimultaneousLights = 10;

        ground.material = material;
        ground.receiveShadows = true;
        ground.isPickable = false;
        ground.useVertexColors = true;
        ground.freezeWorldMatrix();
        this.mesh = ground;
        return ground;
    }

    /** Carte de mélange : rouge = herbe, vert = terre (chemins), bleu = roche (pentes). */
    createSplatMap() {
        const N = 1024;
        const scale = WORLD_SIZE / N;
        const toPx = (x, z) => [(x + WORLD_SIZE / 2) / scale, (WORLD_SIZE / 2 - z) / scale];

        // 1. Chemins dessinés dans un canvas puis floutés pour des bords naturels.
        const paths = document.createElement('canvas');
        paths.width = N;
        paths.height = N;
        const pctx = paths.getContext('2d', { willReadFrequently: true });
        pctx.filter = 'blur(3px)';
        pctx.strokeStyle = '#fff';
        pctx.fillStyle = '#fff';
        pctx.lineCap = 'round';
        pctx.lineJoin = 'round';
        // Place du village et clairière de la ruine.
        for (const [x, z, r] of [[0, 0, 7], [RUIN_CENTER.x, RUIN_CENTER.z, 7]]) {
            const [px, py] = toPx(x, z);
            pctx.beginPath();
            pctx.arc(px, py, r / scale, 0, Math.PI * 2);
            pctx.fill();
        }
        for (const path of dirtPaths()) {
            pctx.lineWidth = path.width / scale;
            pctx.beginPath();
            path.points.forEach(([x, z], i) => {
                const [px, py] = toPx(x, z);
                if (i === 0) pctx.moveTo(px, py);
                else pctx.lineTo(px, py);
            });
            pctx.stroke();
        }
        const dirt = pctx.getImageData(0, 0, N, N).data;

        // 2. Mélange final pixel par pixel.
        const texture = new DynamicTexture('splatMap', N, this.scene, true);
        const ctx = texture.getContext();
        const image = ctx.createImageData(N, N);
        const out = image.data;
        for (let py = 0; py < N; py += 1) {
            const z = WORLD_SIZE / 2 - (py + 0.5) * scale;
            for (let px = 0; px < N; px += 1) {
                const x = (px + 0.5) * scale - WORLD_SIZE / 2;
                const i = (py * N + px) * 4;
                // Terre : chemins + bords usés avec un peu de bruit.
                const grain = noise2(x * 0.6, z * 0.6);
                let d = dirt[i] / 255;
                d = clamp(d * (0.75 + grain * 0.6), 0, 1);
                // Roche : collines et quelques plaques au sol.
                const h = heightAt(x, z);
                const slope = smoothstep(4, 12, h) * (0.35 + fbm(x * 0.07, z * 0.07, 3) * 0.9) + (x > 50 ? smoothstep(2, 6, h) * 0.45 : 0);
                const patches = smoothstep(0.68, 0.8, fbm(x * 0.045 + 40, z * 0.045, 3)) * 0.6;
                let r = clamp(Math.max(slope, patches), 0, 1) * (1 - d);
                const g = d;
                const grass = clamp(1 - g - r, 0, 1);
                const sum = grass + g + r || 1;
                out[i] = (grass / sum) * 255;
                out[i + 1] = (g / sum) * 255;
                out[i + 2] = (r / sum) * 255;
                out[i + 3] = 255;
            }
        }
        ctx.putImageData(image, 0, 0);
        texture.update(true);
        texture.wrapU = Texture.CLAMP_ADDRESSMODE;
        texture.wrapV = Texture.CLAMP_ADDRESSMODE;
        this.dirtMask = dirt;
        this.dirtMaskSize = N;
        return texture;
    }

    /** Quantité de terre (0 à 1) en un point : sert à ne pas planter d'herbe sur les chemins. */
    dirtAt(x, z) {
        const N = this.dirtMaskSize;
        const px = Math.floor((x + WORLD_SIZE / 2) / WORLD_SIZE * N);
        const py = Math.floor((WORLD_SIZE / 2 - z) / WORLD_SIZE * N);
        if (px < 0 || py < 0 || px >= N || py >= N) return 0;
        return this.dirtMask[(py * N + px) * 4] / 255;
    }
}
