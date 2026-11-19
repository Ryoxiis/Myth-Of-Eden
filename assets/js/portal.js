/**
 * Myth of Eden : portail 3D en temps réel pour la bannière d'accueil.
 *
 * Arche de pierres runiques, vortex turquoise (shader), lucioles et étincelles aspirées.
 * La caméra suit la souris et plonge dans le portail quand on fait défiler la page.
 *
 * Source : assets/js/portal.js. Fichier compilé utilisé par le site : public/js/portal.bundle.js
 * Recompiler (facultatif, nécessite Node.js) :
 *   npx esbuild assets/js/portal.js --bundle --minify --format=esm --outfile=public/js/portal.bundle.js
 */
import {
    AdditiveBlending,
    AmbientLight,
    BoxGeometry,
    CanvasTexture,
    Color,
    DirectionalLight,
    DoubleSide,
    Float32BufferAttribute,
    BufferGeometry,
    FogExp2,
    Group,
    Mesh,
    MeshBasicMaterial,
    MeshStandardMaterial,
    PerspectiveCamera,
    PlaneGeometry,
    PointLight,
    Points,
    Scene,
    ShaderMaterial,
    Shape,
    ShapeGeometry,
    SRGBColorSpace,
    ACESFilmicToneMapping,
    Vector2,
    Vector3,
    WebGLRenderer,
    RepeatWrapping,
} from 'three';

const TEAL = new Color('#3fd1c7');
const ARCH_RADIUS = 1.55; // rayon intérieur de l'arche (m)
const PILLAR_HEIGHT = 2.0; // hauteur des montants
const ARCH_CENTER_Y = PILLAR_HEIGHT; // centre du demi-cercle

/* -------------------------------------------------------------------------- */
/* Petits outils                                                              */
/* -------------------------------------------------------------------------- */

/** Générateur pseudo-aléatoire reproductible (la même arche à chaque visite). */
function seededRandom(seed) {
    let s = seed >>> 0;
    return () => {
        s = (s * 1664525 + 1013904223) >>> 0;
        return s / 4294967296;
    };
}

const rand = seededRandom(1789);
const range = (min, max) => min + (max - min) * rand();

/** Bruit de valeur 3D simple, suffisant pour « cabosser » les pierres. */
function hash3(x, y, z) {
    const h = Math.sin(x * 127.1 + y * 311.7 + z * 74.7) * 43758.5453;
    return h - Math.floor(h);
}

function noise3(x, y, z) {
    const xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z);
    const xf = x - xi, yf = y - yi, zf = z - zi;
    const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf), w = zf * zf * (3 - 2 * zf);
    const lerp = (a, b, t) => a + (b - a) * t;
    const c = (dx, dy, dz) => hash3(xi + dx, yi + dy, zi + dz);
    return lerp(
        lerp(lerp(c(0, 0, 0), c(1, 0, 0), u), lerp(c(0, 1, 0), c(1, 1, 0), u), v),
        lerp(lerp(c(0, 0, 1), c(1, 0, 1), u), lerp(c(0, 1, 1), c(1, 1, 1), u), v),
        w,
    );
}

/* -------------------------------------------------------------------------- */
/* Textures dessinées dans un canvas                                          */
/* -------------------------------------------------------------------------- */

function makeStoneTexture() {
    const size = 256;
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = size;
    const ctx = canvas.getContext('2d');
    const image = ctx.createImageData(size, size);

    for (let y = 0; y < size; y++) {
        for (let x = 0; x < size; x++) {
            const n = noise3(x / 22, y / 22, 0.5) * 0.55 + noise3(x / 7, y / 7, 3.1) * 0.3 + noise3(x / 2.5, y / 2.5, 9.7) * 0.15;
            const crack = Math.abs(noise3(x / 40, y / 13, 5.2) - 0.5) < 0.012 ? 0.55 : 1;
            const v = (95 + n * 110) * crack;
            const i = (y * size + x) * 4;
            image.data[i] = v * 0.92;
            image.data[i + 1] = v * 0.98;
            image.data[i + 2] = v;
            image.data[i + 3] = 255;
        }
    }

    ctx.putImageData(image, 0, 0);
    const texture = new CanvasTexture(canvas);
    texture.colorSpace = SRGBColorSpace;
    texture.wrapS = texture.wrapT = RepeatWrapping;

    return texture;
}

/** Rune originale : un trait vertical et quelques branches, tracés au hasard. */
function makeRuneTexture(seed) {
    const r = seededRandom(seed);
    const size = 128;
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = size;
    const ctx = canvas.getContext('2d');

    ctx.strokeStyle = '#bffff7';
    ctx.lineWidth = 7;
    ctx.lineCap = 'round';
    ctx.shadowColor = '#3fd1c7';
    ctx.shadowBlur = 18;

    const top = 22, bottom = 106, cx = 64;
    ctx.beginPath();
    ctx.moveTo(cx, top);
    ctx.lineTo(cx, bottom);

    const branches = 1 + Math.floor(r() * 3);
    for (let b = 0; b < branches; b++) {
        const y0 = top + 10 + r() * 50;
        const dir = r() < 0.5 ? -1 : 1;
        const len = 22 + r() * 18;
        const dy = (r() < 0.5 ? -1 : 1) * (12 + r() * 18);
        ctx.moveTo(cx, y0);
        ctx.lineTo(cx + dir * len, y0 + dy);
        if (r() < 0.35) {
            ctx.lineTo(cx, y0 + dy * 2);
        }
    }

    ctx.stroke();
    ctx.stroke(); // deuxième passe pour renforcer la lueur

    const texture = new CanvasTexture(canvas);
    texture.colorSpace = SRGBColorSpace;

    return texture;
}

function makeRadialTexture(inner, outer) {
    const size = 256;
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = size;
    const ctx = canvas.getContext('2d');
    const gradient = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
    gradient.addColorStop(0, inner);
    gradient.addColorStop(1, outer);
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, size, size);

    const texture = new CanvasTexture(canvas);
    texture.colorSpace = SRGBColorSpace;

    return texture;
}

/* -------------------------------------------------------------------------- */
/* Pierres                                                                    */
/* -------------------------------------------------------------------------- */

/** Bloc de pierre aux arêtes adoucies et à la surface irrégulière, avec mousse sur le dessus. */
function roughBlock(w, h, d, seed) {
    const geometry = new BoxGeometry(w, h, d, 6, 6, 6);
    const pos = geometry.attributes.position;
    const colors = [];
    const v = new Vector3();
    const hw = w / 2, hh = h / 2, hd = d / 2;
    const bevel = Math.min(w, h, d) * 0.22;

    for (let i = 0; i < pos.count; i++) {
        v.fromBufferAttribute(pos, i);

        // Adoucit les arêtes : rapproche les coins du « noyau » du bloc.
        const inner = new Vector3(
            Math.max(-hw + bevel, Math.min(hw - bevel, v.x)),
            Math.max(-hh + bevel, Math.min(hh - bevel, v.y)),
            Math.max(-hd + bevel, Math.min(hd - bevel, v.z)),
        );
        const offset = v.clone().sub(inner);
        if (offset.length() > 0) {
            offset.setLength(bevel);
        }
        v.copy(inner.add(offset));

        // Surface cabossée.
        const n = noise3(v.x * 3 + seed, v.y * 3, v.z * 3) - 0.5;
        v.multiplyScalar(1 + n * 0.16);
        v.x += (noise3(v.y * 5 + seed, v.z * 5, 1.3) - 0.5) * 0.035;
        pos.setXYZ(i, v.x, v.y, v.z);

        // Mousse sur les faces supérieures et quelques taches.
        const moss = Math.max(0, (v.y / hh) - 0.55) * 1.6 + Math.max(0, noise3(v.x * 4, v.y * 4 + seed, v.z * 4) - 0.62) * 2.2;
        const m = Math.min(1, moss);
        const dirt = 0.82 + noise3(v.x * 6, v.y * 6, v.z * 6 + seed) * 0.3;
        colors.push((0.6 * (1 - m) + 0.24 * m) * dirt, (0.58 * (1 - m) + 0.31 * m) * dirt, (0.54 * (1 - m) + 0.16 * m) * dirt);
    }

    geometry.setAttribute('color', new Float32BufferAttribute(colors, 3));
    geometry.computeVertexNormals();

    return geometry;
}

/* -------------------------------------------------------------------------- */
/* Shaders                                                                    */
/* -------------------------------------------------------------------------- */

const vortexVertex = /* glsl */ `
    varying vec2 vPos;
    void main() {
        vPos = position.xy;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
`;

const vortexFragment = /* glsl */ `
    precision highp float;
    uniform float uTime;
    uniform float uIntensity;
    uniform float uSpin;
    uniform float uRadius;
    uniform float uCenterY;
    varying vec2 vPos;

    float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
    float noise(vec2 p) {
        vec2 i = floor(p), f = fract(p);
        vec2 u = f * f * (3.0 - 2.0 * f);
        return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y);
    }
    float fbm(vec2 p) {
        float v = 0.0, a = 0.5;
        for (int i = 0; i < 5; i++) { v += a * noise(p); p = p * 2.03 + 11.7; a *= 0.5; }
        return v;
    }

    void main() {
        vec2 center = vec2(0.0, uCenterY - 0.25);
        vec2 p = vPos - center;
        float r = length(p);
        float a = atan(p.y, p.x);

        // Tourbillon : l'angle tourne d'autant plus vite qu'on approche du centre.
        float swirl = a + uTime * 0.45 + uSpin + (2.4 + uSpin * 0.4) / (r + 0.35);
        vec2 q = vec2(cos(swirl), sin(swirl)) * r * 1.6;
        float n = fbm(q * 1.8 + vec2(0.0, -uTime * 0.25));
        float n2 = fbm(q * 3.6 - vec2(uTime * 0.3, 0.0));
        float streaks = pow(n, 1.6) * 1.2 + n2 * 0.35;

        // Distance au bord de l'arche (demi-cercle en haut, montants en bas).
        float edge = vPos.y > uCenterY
            ? uRadius - length(vPos - vec2(0.0, uCenterY))
            : uRadius - abs(vPos.x);
        edge = min(edge, vPos.y * 0.9);
        float mask = smoothstep(0.0, 0.45, edge);

        float core = exp(-r * r * 1.8);
        vec3 deep = vec3(0.02, 0.18, 0.24);
        vec3 teal = vec3(0.16, 0.78, 0.76);
        vec3 light = vec3(0.85, 1.0, 0.97);
        vec3 col = mix(deep, teal, streaks);
        col = mix(col, light, core * 0.5 + pow(n2, 3.0) * 0.35);

        float alpha = mask * (0.45 + streaks * 0.6 + core * 0.35) * uIntensity;
        // Liseré lumineux le long du bord intérieur.
        float rim = smoothstep(0.22, 0.0, abs(edge - 0.05)) * 0.9;
        col += vec3(0.4, 1.0, 0.95) * rim * 0.6;
        alpha += rim * 0.5 * uIntensity;

        gl_FragColor = vec4(col * (0.9 + 0.4 * uIntensity), clamp(alpha, 0.0, 1.0));
    }
`;

const particleVertex = /* glsl */ `
    attribute float aSeed;
    attribute float aSize;
    uniform float uTime;
    uniform float uPixelRatio;
    uniform float uMode; // 0 = lucioles, 1 = étincelles aspirées par le vortex
    uniform vec3 uCenter;
    varying float vAlpha;

    void main() {
        vec3 p = position;
        float t = uTime;

        if (uMode < 0.5) {
            // Lucioles : flottent doucement dans le volume.
            p.x += sin(t * 0.3 + aSeed * 12.0) * 0.6;
            p.y += sin(t * 0.45 + aSeed * 7.0) * 0.4;
            p.z += cos(t * 0.25 + aSeed * 9.0) * 0.5;
            vAlpha = 0.35 + 0.65 * pow(0.5 + 0.5 * sin(t * 1.7 + aSeed * 40.0), 3.0);
        } else {
            // Étincelles : spirale vers le centre du portail.
            float life = fract(aSeed * 7.31 + t * (0.06 + aSeed * 0.05));
            float radius = mix(p.x, 0.05, life);
            float angle = p.y + life * 7.0;
            p = uCenter + vec3(cos(angle) * radius, sin(angle) * radius * 1.15, 0.35 - life * 0.9);
            vAlpha = smoothstep(0.0, 0.15, life) * (1.0 - smoothstep(0.75, 1.0, life));
        }

        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        gl_Position = projectionMatrix * mv;
        gl_PointSize = aSize * uPixelRatio * (60.0 / -mv.z);
    }
`;

const particleFragment = /* glsl */ `
    precision highp float;
    uniform vec3 uColor;
    varying float vAlpha;
    void main() {
        float d = length(gl_PointCoord - 0.5);
        float glow = smoothstep(0.5, 0.0, d);
        gl_FragColor = vec4(uColor, glow * glow * vAlpha);
    }
`;

/* -------------------------------------------------------------------------- */
/* Construction de la scène                                                   */
/* -------------------------------------------------------------------------- */

function buildArch(stoneTexture) {
    const group = new Group();
    const stoneMaterial = new MeshStandardMaterial({
        map: stoneTexture,
        vertexColors: true,
        roughness: 0.95,
        metalness: 0.0,
        color: new Color('#8e8a82'),
    });

    const runeMeshes = [];
    const depth = 0.62;
    const thickness = 0.58;
    let seed = 1;

    const addRune = (block, w, h) => {
        const rune = new Mesh(
            new PlaneGeometry(Math.min(w, h) * 0.62, Math.min(w, h) * 0.62),
            new MeshBasicMaterial({
                map: makeRuneTexture(seed * 97),
                transparent: true,
                blending: AdditiveBlending,
                depthWrite: false,
                color: TEAL.clone(),
            }),
        );
        rune.position.z = depth / 2 + 0.03;
        rune.userData.phase = rand() * Math.PI * 2;
        block.add(rune);
        runeMeshes.push(rune);
    };

    // Montants : blocs empilés de chaque côté.
    for (const side of [-1, 1]) {
        let y = 0;
        const heights = [0.56, 0.48, 0.52, 0.44];
        heights.forEach((h, i) => {
            const w = thickness + range(-0.05, 0.08);
            const block = new Mesh(roughBlock(w, h - 0.03, depth + range(-0.04, 0.06), seed++), stoneMaterial);
            block.position.set(side * (ARCH_RADIUS + thickness / 2) + range(-0.03, 0.03), y + h / 2, range(-0.03, 0.03));
            block.rotation.set(range(-0.03, 0.03), range(-0.06, 0.06), range(-0.03, 0.03));
            group.add(block);
            if (i === 2) {
                addRune(block, w, h);
            }
            y += h;
        });
    }

    // Voussoirs le long du demi-cercle.
    const count = 11;
    const midRadius = ARCH_RADIUS + thickness / 2;
    const arcLength = (Math.PI * midRadius) / count;

    for (let i = 0; i < count; i++) {
        const angle = Math.PI - (i + 0.5) * (Math.PI / count);
        const isKey = i === Math.floor(count / 2);
        const w = thickness * (isKey ? 1.25 : 1) + range(-0.03, 0.05);
        const h = arcLength - 0.035;
        const block = new Mesh(roughBlock(w, h, depth + (isKey ? 0.12 : range(-0.04, 0.05)), seed++), stoneMaterial);
        block.position.set(Math.cos(angle) * (midRadius + (isKey ? 0.06 : 0)), ARCH_CENTER_Y + Math.sin(angle) * (midRadius + (isKey ? 0.06 : 0)), range(-0.03, 0.03));
        block.rotation.z = angle;
        block.rotation.x = range(-0.03, 0.03);
        group.add(block);
        addRune(block, w, h);
    }

    // Pierres tombées au pied de l'arche.
    [[-2.6, 0.18, 0.7, 0.42], [2.35, 0.14, 1.1, 0.34], [-1.25, 0.1, 1.35, 0.24], [3.3, 0.22, -0.4, 0.5]].forEach(([x, y, z, s]) => {
        const block = new Mesh(roughBlock(s * 1.3, s, s * 1.1, seed++), stoneMaterial);
        block.position.set(x, y, z);
        block.rotation.set(range(-0.4, 0.4), range(0, Math.PI), range(-0.3, 0.3));
        group.add(block);
    });

    return { group, runeMeshes };
}

function buildVortex() {
    // Ouverture de l'arche : rectangle entre les montants surmonté d'un demi-cercle.
    const shape = new Shape();
    shape.moveTo(-ARCH_RADIUS, 0);
    shape.lineTo(ARCH_RADIUS, 0);
    shape.lineTo(ARCH_RADIUS, ARCH_CENTER_Y);
    shape.absarc(0, ARCH_CENTER_Y, ARCH_RADIUS, 0, Math.PI, false);
    shape.lineTo(-ARCH_RADIUS, 0);

    const material = new ShaderMaterial({
        vertexShader: vortexVertex,
        fragmentShader: vortexFragment,
        transparent: true,
        depthWrite: false,
        blending: AdditiveBlending,
        side: DoubleSide,
        uniforms: {
            uTime: { value: 0 },
            uIntensity: { value: 1 },
            uSpin: { value: 0 },
            uRadius: { value: ARCH_RADIUS },
            uCenterY: { value: ARCH_CENTER_Y },
        },
    });

    const mesh = new Mesh(new ShapeGeometry(shape, 48), material);
    mesh.position.z = -0.02;
    mesh.renderOrder = 2;

    return mesh;
}

function buildParticles(mode, count, pixelRatio) {
    const positions = new Float32Array(count * 3);
    const seeds = new Float32Array(count);
    const sizes = new Float32Array(count);

    for (let i = 0; i < count; i++) {
        if (mode === 0) {
            positions.set([range(-7, 7), range(0.2, 5.5), range(-3.5, 3.5)], i * 3);
            sizes[i] = range(1.8, 4.2);
        } else {
            // x = rayon de départ, y = angle de départ (interprétés par le shader).
            positions.set([range(1.2, 3.2), range(0, Math.PI * 2), 0], i * 3);
            sizes[i] = range(1.5, 3.5);
        }
        seeds[i] = rand();
    }

    const geometry = new BufferGeometry();
    geometry.setAttribute('position', new Float32BufferAttribute(positions, 3));
    geometry.setAttribute('aSeed', new Float32BufferAttribute(seeds, 1));
    geometry.setAttribute('aSize', new Float32BufferAttribute(sizes, 1));

    const material = new ShaderMaterial({
        vertexShader: particleVertex,
        fragmentShader: particleFragment,
        transparent: true,
        depthWrite: false,
        blending: AdditiveBlending,
        uniforms: {
            uTime: { value: 0 },
            uPixelRatio: { value: pixelRatio },
            uMode: { value: mode },
            uCenter: { value: new Vector3(0, ARCH_CENTER_Y - 0.25, 0) },
            uColor: { value: mode === 0 ? new Color('#c8ffb0') : new Color('#9ff7ee') },
        },
    });

    const points = new Points(geometry, material);
    points.frustumCulled = false;
    points.renderOrder = 3;

    return points;
}

/* -------------------------------------------------------------------------- */
/* Démarrage                                                                  */
/* -------------------------------------------------------------------------- */

export function initPortal(canvas) {
    const host = canvas.closest('[data-portal-host]') ?? canvas.parentElement;
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    let renderer;
    try {
        renderer = new WebGLRenderer({ canvas, alpha: true, antialias: true, powerPreference: 'high-performance' });
    } catch (error) {
        // Pas de WebGL : l'image de fond suffit.
        host.classList.add('portal--unsupported');
        return null;
    }

    // Options lues sur le canvas :
    //   data-portal-dive="0"     désactive la plongée au défilement
    //   data-portal-end="-1.5"   distance finale de la caméra (négative = traverse le portail)
    //   data-portal-offset="2.2" décalage du portail vers la droite sur écran large
    const diveEnabled = canvas.dataset.portalDive !== '0';
    const diveEnd = Number(canvas.dataset.portalEnd ?? 1.2);

    const pixelRatio = Math.min(window.devicePixelRatio || 1, 1.75);
    renderer.setPixelRatio(pixelRatio);
    renderer.outputColorSpace = SRGBColorSpace;
    renderer.toneMapping = ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.15;
    renderer.setClearColor(0x000000, 0);

    const scene = new Scene();
    scene.fog = new FogExp2(new Color('#0d0c0a'), 0.032);

    const camera = new PerspectiveCamera(34, 1, 0.1, 60);
    const lookTarget = new Vector3(0, 2.05, 0);

    // Lumières : lune froide + lueur du portail.
    scene.add(new AmbientLight(new Color('#a39a8c'), 0.5));
    const moon = new DirectionalLight(new Color('#e8dcc4'), 1.0);
    moon.position.set(4, 7, 5);
    scene.add(moon);
    const portalLight = new PointLight(TEAL, 16, 8, 1.7);
    portalLight.position.set(0, 1.8, 0.9);
    scene.add(portalLight);
    const backLight = new PointLight(new Color('#5fe3d4'), 5, 6, 1.8);
    backLight.position.set(0, 2.2, -1.2);
    scene.add(backLight);

    const portal = new Group();
    scene.add(portal);

    const { group: arch, runeMeshes } = buildArch(makeStoneTexture());
    portal.add(arch);

    const vortex = buildVortex();
    portal.add(vortex);

    // Halo derrière l'arche et flaque de lumière au sol.
    const halo = new Mesh(
        new PlaneGeometry(9, 9),
        new MeshBasicMaterial({
            map: makeRadialTexture('rgba(63,209,199,0.55)', 'rgba(63,209,199,0)'),
            transparent: true,
            depthWrite: false,
            blending: AdditiveBlending,
        }),
    );
    halo.position.set(0, ARCH_CENTER_Y - 0.2, -0.6);
    halo.renderOrder = 1;
    portal.add(halo);

    const pool = new Mesh(
        new PlaneGeometry(7, 4),
        new MeshBasicMaterial({
            map: makeRadialTexture('rgba(110,240,225,0.28)', 'rgba(110,240,225,0)'),
            transparent: true,
            depthWrite: false,
            blending: AdditiveBlending,
        }),
    );
    pool.rotation.x = -Math.PI / 2;
    pool.position.set(0, 0.02, 0.9);
    pool.renderOrder = -1;
    portal.add(pool);

    // Sol sombre qui se fond dans la nuit.
    const ground = new Mesh(
        new PlaneGeometry(30, 30),
        new MeshBasicMaterial({
            map: makeRadialTexture('rgba(11,10,8,0.92)', 'rgba(11,10,8,0)'),
            transparent: true,
            depthWrite: false,
        }),
    );
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -0.01;
    ground.renderOrder = -2;
    scene.add(ground);

    const fireflies = buildParticles(0, 110, pixelRatio);
    const sparks = buildParticles(1, 260, pixelRatio);
    scene.add(fireflies, sparks);

    /* ---------- Taille et cadrage ---------- */

    let baseDistance = 12;
    let offsetX = 0; // décalage latéral : portail à droite sur écran large, centré sur mobile
    let lookOffsetY = 0; // sur écran vertical, le portail est remonté pour laisser la place au texte
    const resize = () => {
        const width = canvas.clientWidth || host.clientWidth;
        const height = canvas.clientHeight || host.clientHeight;
        renderer.setSize(width, height, false);
        camera.aspect = width / height;

        // Garde l'arche entière visible, même sur un écran étroit (portrait).
        const vFov = (camera.fov * Math.PI) / 180;
        const hFov = 2 * Math.atan(Math.tan(vFov / 2) * camera.aspect);
        const needForWidth = 7.4 / (2 * Math.tan(hFov / 2));
        baseDistance = Math.max(12, needForWidth);
        offsetX = camera.aspect > 1.15 ? -Number(canvas.dataset.portalOffset ?? 2.2) : 0;
        lookOffsetY = camera.aspect < 0.85 ? -1.6 : 0;
        camera.updateProjectionMatrix();
    };
    resize();
    window.addEventListener('resize', resize);

    /* ---------- Souris et défilement ---------- */

    const pointer = new Vector2(0, 0);
    const smoothPointer = new Vector2(0, 0);
    window.addEventListener('pointermove', (event) => {
        pointer.set((event.clientX / window.innerWidth) * 2 - 1, (event.clientY / window.innerHeight) * 2 - 1);
    }, { passive: true });

    let scroll = 0;
    let smoothScroll = 0;
    const updateScroll = () => {
        // La bannière est plus haute que l'écran (partie « collante ») : la plongée se fait sur la hauteur en trop.
        const rect = host.getBoundingClientRect();
        const span = rect.height > window.innerHeight * 1.2 ? rect.height - window.innerHeight : rect.height;
        scroll = Math.min(1, Math.max(0, -rect.top / Math.max(1, span)));
    };
    updateScroll();
    window.addEventListener('scroll', updateScroll, { passive: true });

    /* ---------- Boucle de rendu ---------- */

    let visible = true;
    let frame = null;
    let started = performance.now();
    let readySent = false;
    let spin = 0;

    const render = (now) => {
        frame = null;
        const t = reducedMotion ? 4.0 : (now - started) / 1000;

        smoothPointer.lerp(pointer, 0.045);
        smoothScroll += (scroll - smoothScroll) * 0.08;
        if (Math.abs(scroll - smoothScroll) < 0.0005) smoothScroll = scroll;

        // Caméra : suit légèrement la souris et avance dans le portail au défilement.
        const dive = reducedMotion || !diveEnabled ? 0 : smoothScroll;
        // Accélère vers la fin : on se rapproche « de plus en plus vite ».
        const eased = Math.pow(dive, 1.7);
        const distance = baseDistance - eased * (baseDistance - diveEnd);
        const shift = offsetX * (1 - Math.min(1, dive * 1.6));
        camera.position.set(shift + smoothPointer.x * 0.9, 1.75 - smoothPointer.y * 0.45 + dive * 0.35, distance);
        // La cible reste toujours devant la caméra, même après avoir traversé le portail.
        lookTarget.set(shift + smoothPointer.x * 0.25, 2.05 + dive * 0.1 + lookOffsetY * (1 - Math.min(1, dive * 1.6)), Math.min(0, distance - 10));
        camera.lookAt(lookTarget);

        portal.rotation.y = smoothPointer.x * -0.06;

        const intensity = 1 + eased * 0.55;
        spin += (0.004 + eased * 0.05) * (reducedMotion ? 0 : 1);
        vortex.material.uniforms.uSpin.value = spin;
        vortex.material.uniforms.uTime.value = t;
        vortex.material.uniforms.uIntensity.value = intensity;
        fireflies.material.uniforms.uTime.value = t;
        sparks.material.uniforms.uTime.value = t;

        portalLight.intensity = (15 + Math.sin(t * 2.3) * 2.5 + Math.sin(t * 7.1) * 1.2) * (1 + eased * 0.6);
        halo.material.opacity = 0.85 + Math.sin(t * 1.3) * 0.15;
        halo.scale.setScalar(1 + dive * 0.6);

        for (const rune of runeMeshes) {
            rune.material.opacity = 0.55 + 0.45 * Math.sin(t * 1.4 + rune.userData.phase);
        }

        renderer.render(scene, camera);
        host.style.setProperty('--dive', smoothScroll.toFixed(4));

        if (!readySent) {
            readySent = true;
            window.dispatchEvent(new CustomEvent('portal:ready'));
        }

        if (!reducedMotion && visible) {
            frame = requestAnimationFrame(render);
        }
    };

    // Met la boucle en pause quand la bannière n'est plus visible ou l'onglet caché.
    const start = () => {
        if (frame === null && visible && !document.hidden) {
            frame = requestAnimationFrame(render);
        }
    };
    const stop = () => {
        if (frame !== null) {
            cancelAnimationFrame(frame);
            frame = null;
        }
    };

    new IntersectionObserver(([entry]) => {
        visible = entry.isIntersecting;
        visible ? start() : stop();
    }).observe(host);
    document.addEventListener('visibilitychange', () => (document.hidden ? stop() : start()));

    if (reducedMotion) {
        render(performance.now());
        window.addEventListener('resize', () => render(performance.now()));
    } else {
        start();
    }

    host.classList.add('portal--ready');

    return { renderer, scene, camera };
}

const canvas = document.querySelector('[data-portal-canvas]');
if (canvas) {
    initPortal(canvas);
}
