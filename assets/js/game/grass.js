/**
 * Herbe haute : touffes en « thin instances » (une seule géométrie, des centaines de copies
 * envoyées au GPU en un appel). Générée par cases autour du joueur, comme le reste du monde,
 * avec un léger balancement dans le vent et un fondu en taille au bord de la zone visible.
 */
import { Mesh } from '@babylonjs/core/Meshes/mesh';
import { VertexData } from '@babylonjs/core/Meshes/mesh.vertexData';
import { Matrix, Quaternion, Vector3 } from '@babylonjs/core/Maths/math.vector';
import { Color3 } from '@babylonjs/core/Maths/math.color';
import { Texture } from '@babylonjs/core/Materials/Textures/texture';
import { CustomMaterial } from '@babylonjs/materials/custom/customMaterial';
import { random } from './noise.js';
import { heightAt, walkableDistance, WORLD_LIMIT } from './terrain.js';

const CLUMP_HEIGHT = 0.6;

function clumpGeometry() {
    // Trois plans croisés à 60° ; normales vers le haut pour un éclairage aussi doux que le sol.
    const positions = [];
    const normals = [];
    const uvs = [];
    const indices = [];
    const w = 0.45;
    for (let i = 0; i < 3; i += 1) {
        const a = (i * Math.PI) / 3;
        const dx = Math.cos(a) * w;
        const dz = Math.sin(a) * w;
        const base = positions.length / 3;
        positions.push(-dx, 0, -dz, dx, 0, dz, dx, CLUMP_HEIGHT, dz, -dx, CLUMP_HEIGHT, -dz);
        normals.push(0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0);
        uvs.push(0, 0, 1, 0, 1, 1, 0, 1);
        indices.push(base, base + 1, base + 2, base, base + 2, base + 3);
    }
    const data = new VertexData();
    data.positions = positions;
    data.normals = normals;
    data.uvs = uvs;
    data.indices = indices;
    return data;
}

export class GrassField {
    constructor(scene, assetsUrl, terrain, { density = 1, avoid = [] } = {}) {
        this.scene = scene;
        this.terrain = terrain;
        this.density = density;
        this.avoid = avoid; // [{x, z, r}] : emprises des bâtiments
        this.geometry = clumpGeometry();
        this.time = 0;
        this.player = { x: 0, z: 0 };
        this.fadeDistance = 34;

        const texture = new Texture(`${assetsUrl}textures/grass_card.png`, scene);
        texture.hasAlpha = true;
        texture.wrapU = Texture.CLAMP_ADDRESSMODE;
        texture.wrapV = Texture.CLAMP_ADDRESSMODE;

        const material = new CustomMaterial('grassMaterial', scene);
        material.diffuseTexture = texture;
        material.diffuseColor = new Color3(0.72, 0.95, 0.58);
        material.specularColor = Color3.Black();
        material.backFaceCulling = false;
        material.maxSimultaneousLights = 10;
        material.AddUniform('uTime', 'float', 0);
        material.AddUniform('uPlayer', 'vec2', null);
        material.AddUniform('uFade', 'float', 0);
        material.Vertex_Before_PositionUpdated(`
            float grassH = clamp(position.y / ${CLUMP_HEIGHT.toFixed(2)}, 0.0, 1.0);
            vec2 grassBase = vec2(0.0);
            #ifdef INSTANCES
            grassBase = world3.xz;
            #endif
            float grassSway = sin(uTime * 1.6 + grassBase.x * 0.35 + grassBase.y * 0.27) + 0.45 * sin(uTime * 3.3 + grassBase.x * 1.1);
            positionUpdated.x += grassSway * 0.07 * grassH;
            positionUpdated.z += grassSway * 0.045 * grassH;
            positionUpdated *= smoothstep(uFade, uFade - 9.0, distance(grassBase, uPlayer));
        `);
        material.onBindObservable.add(() => {
            const effect = material.getEffect();
            effect.setFloat('uTime', this.time);
            effect.setFloat2('uPlayer', this.player.x, this.player.z);
            effect.setFloat('uFade', this.fadeDistance);
        });
        this.material = material;
    }

    /** Une entrée par case de la grille : le streamer appellera spawn() quand le joueur sera proche. */
    items(cellSize) {
        const list = [];
        const half = WORLD_LIMIT + cellSize;
        for (let x = -half; x < half; x += cellSize) {
            for (let z = -half; z < half; z += cellSize) {
                list.push({ type: 'grass', x: x + cellSize / 2, z: z + cellSize / 2, size: cellSize });
            }
        }
        return list;
    }

    spawn(item) {
        const rand = random(Math.floor(item.x * 73856093) ^ Math.floor(item.z * 19349663));
        const count = Math.floor(item.size * item.size * 1.3 * this.density);
        const matrices = new Float32Array(count * 16);
        const matrix = new Matrix();
        const rotation = new Quaternion();
        const scale = new Vector3();
        const position = new Vector3();
        let n = 0;

        for (let i = 0; i < count; i += 1) {
            const x = item.x + (rand() - 0.5) * item.size;
            const z = item.z + (rand() - 0.5) * item.size;
            const edge = walkableDistance(x, z);
            if (this.terrain.dirtAt(x, z) > 0.2 || Math.max(Math.abs(x), Math.abs(z)) > WORLD_LIMIT) continue;
            // Moins d'herbe sous la forêt dense de Sombrebois et sur les collines sèches.
            if ((x < -50 || x > 50) && rand() < 0.45) continue;
            if (this.avoid.some((zone) => Math.hypot(x - zone.x, z - zone.z) < zone.r)) continue;
            // Plus clairsemée au milieu du village (piétiné), plus drue en lisière.
            if (edge < -6 && Math.hypot(x, z) < 26 && rand() < 0.55) continue;

            const s = 0.7 + rand() * 0.7;
            scale.set(s, s * (0.8 + rand() * 0.5), s);
            Quaternion.FromEulerAnglesToRef(0, rand() * Math.PI, 0, rotation);
            position.set(x, heightAt(x, z) - 0.03, z);
            Matrix.ComposeToRef(scale, rotation, position, matrix);
            matrix.copyToArray(matrices, n * 16);
            n += 1;
        }
        if (n === 0) return null;

        const mesh = new Mesh('grass', this.scene);
        this.geometry.applyToMesh(mesh);
        mesh.material = this.material;
        mesh.isPickable = false;
        mesh.receiveShadows = true;
        mesh.thinInstanceSetBuffer('matrix', matrices.subarray(0, n * 16), 16, true);
        mesh.thinInstanceRefreshBoundingInfo(false);
        mesh.freezeWorldMatrix();
        this.onMesh?.(mesh);
        return () => {
            this.onRemove?.(mesh);
            mesh.dispose();
        };
    }

    update(time, x, z) {
        this.time = time;
        this.player.x = x;
        this.player.z = z;
    }
}
