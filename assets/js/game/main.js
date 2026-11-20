/**
 * Myth of Eden — prototype 3D (Babylon.js).
 * Point d'entrée : charge la partie via l'API Symfony, construit le monde (chargé par cases
 * autour du joueur), fait apparaître le personnage et gère ramassage, sauvegarde, pause et qualité.
 */
import { Engine } from '@babylonjs/core/Engines/engine';
import { Scene } from '@babylonjs/core/scene';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import { Color4 } from '@babylonjs/core/Maths/math.color';
import { GlowLayer } from '@babylonjs/core/Layers/glowLayer';
import '@babylonjs/core/Layers/effectLayerSceneComponent';
import { DefaultRenderingPipeline } from '@babylonjs/core/PostProcesses/RenderPipeline/Pipelines/defaultRenderingPipeline';
import { SSAO2RenderingPipeline } from '@babylonjs/core/PostProcesses/RenderPipeline/Pipelines/ssao2RenderingPipeline';
import '@babylonjs/core/PostProcesses/RenderPipeline/postProcessRenderPipelineManagerSceneComponent';
import '@babylonjs/core/Rendering/geometryBufferRendererSceneComponent';
import { ImageProcessingConfiguration } from '@babylonjs/core/Materials/imageProcessingConfiguration';
import { SceneInstrumentation } from '@babylonjs/core/Instrumentation/sceneInstrumentation';

import { GameApi } from './api.js';
import { Hud } from './hud.js';
import { World, QUALITY } from './world.js';
import { Player } from './player.js';
import { Pendant, PENDANT_CODE } from './pendant.js';
import { isWalkable, zoneAt, pathX, RUIN_CENTER } from './terrain.js';

const AUTOSAVE_EVERY = 30; // secondes
const STREAM_EVERY = 0.25; // secondes entre deux mises à jour du streaming
const PICKUP_DISTANCE = 2.2;
const QUALITY_KEY = 'myth-of-eden.quality';

const root = document.querySelector('[data-game]');
const canvas = root.querySelector('[data-game-canvas]');
const hud = new Hud(root);
const api = new GameApi(root.dataset.api);
const assetsUrl = root.dataset.assets;

const game = {
    state: null,
    running: false,
    paused: false,
    pickingUp: false,
    unsavedSeconds: 0,
    sinceSave: 0,
    sinceStream: 0,
    zone: 'village',
    veilWarnedAt: -100,
    visitedZones: new Set(),
};

function readQuality() {
    try {
        const stored = localStorage.getItem(QUALITY_KEY);
        if (stored && QUALITY[stored]) return stored;
    } catch {
        // Stockage indisponible (navigation privée…) : qualité par défaut.
    }
    return 'medium';
}

async function boot() {
    if (!Engine.isSupported()) {
        hud.showError('Votre navigateur ne prend pas en charge WebGL. Essayez avec une version récente de Chrome, Firefox ou Edge.');
        return;
    }

    hud.setLoading(0.03, 'Ouverture de la partie…');
    game.state = await api.load();
    game.qualityKey = readQuality();
    const quality = QUALITY[game.qualityKey];

    const engine = new Engine(canvas, true, { stencil: true, adaptToDeviceRatio: true }, true);
    const scene = new Scene(engine);
    scene.collisionsEnabled = true;
    scene.skipPointerMovePicking = true;
    game.engine = engine;
    game.scene = scene;
    applyScaling(quality);

    const world = await new World(scene, assetsUrl, quality).build((progress, status) => hud.setLoading(progress * 0.3, status));
    game.world = world;

    // Point d'apparition d'abord : on ne charge que les environs de ce point.
    const spawn = spawnPoint();
    hud.setLoading(0.3, 'Chargement des environs…');
    await world.preload(spawn.position, (p) => hud.setLoading(0.3 + p * 0.5, 'Chargement des environs…'));

    hud.setLoading(0.85, 'Votre personnage arrive…');
    const classCode = game.state.character?.class ?? root.dataset.class;
    const player = await new Player(scene, canvas).load(`${assetsUrl}characters/${classCode}.glb`, classCode, world.shadows);
    player.canStand = (x, z) => isWalkable(x, z);
    player.spawn(spawn.position, spawn.rotation);
    game.player = player;
    game.zone = zoneAt(spawn.position.x, spawn.position.z);
    game.visitedZones.add(game.zone);

    const hasPendant = (game.state.inventory ?? []).some((item) => item.code === PENDANT_CODE);
    if (!hasPendant) {
        game.pendant = new Pendant(scene, world.homeDoor.add(new Vector3(0.9, 0, -0.4)), assetsUrl, world.veilMask ?? null);
    }

    setupRendering(scene, player.camera, quality);
    for (const material of scene.materials) material.maxSimultaneousLights = 10;

    hud.render(game.state);
    hud.setZone(game.zone);
    hud.setQuality(game.qualityKey, QUALITY);
    hud.setLoading(1, 'Prêt.');

    await scene.whenReadyAsync();
    engine.runRenderLoop(() => frame());
    window.addEventListener('resize', () => engine.resize());

    hud.hideLoading();
    hud.showStart(() => {
        game.running = true;
        player.enabled = true;
        canvas.focus();
        canvas.requestPointerLock?.()?.catch?.(() => {});
        if (!hasPendant) {
            setTimeout(() => hud.toast('Une lueur près de votre porte', 'Approchez-vous de l\'objet qui brille.', 'magic'), 900);
        }
    });

    bindControls();
    exposeForTests();
}

/** Position de départ : celle de la sauvegarde si elle est praticable, sinon un point sûr de la zone. */
function spawnPoint() {
    const { position, zone } = game.state;
    const saved = position ?? { x: 0, z: 0, rotationY: 0 };
    const hasSavedSpot = (Math.abs(saved.x) > 0.01 || Math.abs(saved.z) > 0.01) && isWalkable(saved.x, saved.z, 0.8);

    if (hasSavedSpot) {
        return { position: new Vector3(saved.x, 0, saved.z), rotation: (saved.rotationY ?? 0) * Math.PI / 180 };
    }
    if (zone === 'forest_path') {
        return { position: new Vector3(pathX(-40), 0, -40), rotation: 0 };
    }
    if (zone === 'ruin') {
        return { position: new Vector3(RUIN_CENTER.x, 0, RUIN_CENTER.z + 8), rotation: Math.PI };
    }
    // Nouvelle partie : devant la porte, face à la maison.
    return { position: game.world.homeDoor.add(new Vector3(3.6, 0, 1.2)), rotation: -Math.PI / 2 - 0.25 };
}

/* ---------------------------------------------------------------------- */
/* Rendu et qualité graphique                                              */
/* ---------------------------------------------------------------------- */

function applyScaling(quality) {
    const ratio = Math.min(window.devicePixelRatio || 1, 1.5);
    game.engine.setHardwareScalingLevel(quality.scale / ratio);
}

function setupRendering(scene, camera, quality) {
    scene.clearColor = new Color4(0.03, 0.035, 0.05, 1);

    const glow = new GlowLayer('glow', scene, { mainTextureSamples: 2, blurKernelSize: 48 });
    glow.intensity = 0.75;
    // L'herbe et le terrain ne brillent pas : on les exclut du calque de lueur.
    glow.addExcludedMesh(game.world.terrain.mesh);
    game.world.grass.onMesh = (mesh) => glow.addExcludedMesh(mesh);
    game.world.grass.onRemove = (mesh) => glow.removeExcludedMesh(mesh);
    scene.meshes.filter((mesh) => mesh.name === 'grass').forEach((mesh) => glow.addExcludedMesh(mesh));

    const pipeline = new DefaultRenderingPipeline('pipeline', true, scene, [camera]);
    pipeline.samples = 4;
    pipeline.fxaaEnabled = true;
    pipeline.imageProcessingEnabled = true;
    pipeline.imageProcessing.toneMappingEnabled = true;
    pipeline.imageProcessing.toneMappingType = ImageProcessingConfiguration.TONEMAPPING_ACES;
    pipeline.imageProcessing.exposure = 1.3;
    pipeline.imageProcessing.contrast = 1.18;
    pipeline.imageProcessing.vignetteEnabled = true;
    pipeline.imageProcessing.vignetteWeight = 2.2;
    pipeline.imageProcessing.vignetteColor = new Color4(0, 0, 0.02, 0);
    pipeline.bloomThreshold = 0.72;
    pipeline.bloomWeight = 0.38;
    pipeline.bloomKernel = 64;
    pipeline.bloomScale = 0.5;
    pipeline.grainEnabled = true;
    pipeline.grain.intensity = 6;
    pipeline.grain.animated = true;
    game.pipeline = pipeline;

    game.instrumentation = new SceneInstrumentation(scene);
    game.instrumentation.captureFrameTime = true;
    applyQuality(game.qualityKey, { initial: true });
}

/** Applique un niveau de qualité en direct (sans recharger la page). */
function applyQuality(key, { initial = false } = {}) {
    const quality = QUALITY[key];
    if (!quality) return;
    game.qualityKey = key;
    try {
        localStorage.setItem(QUALITY_KEY, key);
    } catch {
        // pas de stockage : le choix vaut pour cette session seulement
    }

    const { scene, world, pipeline } = game;
    pipeline.bloomEnabled = quality.bloom;
    applyScaling(quality);
    world.shadows.getShadowMap().resize(quality.shadowSize);
    world.objects.loadRadius = quality.loadRadius;
    world.objects.unloadRadius = quality.loadRadius + 20;
    if (!initial) world.setGrassDensity(quality.grass);

    if (quality.ssao && !game.ssao) {
        const ssao = new SSAO2RenderingPipeline('ssao', scene, { ssaoRatio: 0.5, blurRatio: 1 }, [game.player.camera]);
        ssao.radius = 1.6;
        ssao.totalStrength = 1.1;
        ssao.samples = 16;
        ssao.maxZ = 60;
        game.ssao = ssao;
    } else if (!quality.ssao && game.ssao) {
        game.ssao.dispose();
        game.ssao = null;
    }
}

/* ---------------------------------------------------------------------- */
/* Boucle de jeu                                                           */
/* ---------------------------------------------------------------------- */

function frame() {
    const engine = game.engine;
    const dt = Math.min(0.05, engine.getDeltaTime() / 1000);
    const time = performance.now() / 1000;
    const player = game.player;

    game.world.update(time, player.position);
    game.pendant?.update(time);

    // Streaming : quelques fois par seconde, pas à chaque image.
    game.sinceStream += dt;
    if (game.sinceStream >= STREAM_EVERY) {
        game.sinceStream = 0;
        game.world.streamTick(player.position);
    }

    if (game.running && !game.paused) {
        player.update(dt);
        updateZone();
        updateInteraction(time);

        if (!document.hidden) {
            game.unsavedSeconds += dt;
            game.sinceSave += dt;
        }
        if (game.sinceSave >= AUTOSAVE_EVERY) save({ silent: true });
    } else {
        player.update(0);
    }

    game.scene.render();
    if (hud.statsVisible) updateStats();
}

const ZONE_INTROS = {
    forest_path: ['Le chemin de la forêt', 'Les lanternes se font rares… La lumière turquoise brille plus loin.'],
    ruin: ['La ruine oubliée', 'Une arche couverte de symboles. Ce sont les mêmes que sur le pendentif.'],
};

function updateZone() {
    const { x, z } = game.player.position;
    const zone = zoneAt(x, z);
    if (zone === game.zone) return;
    game.zone = zone;
    hud.setZone(zone);
    if (!game.visitedZones.has(zone) && ZONE_INTROS[zone]) {
        hud.toast(...ZONE_INTROS[zone], 'magic');
    }
    game.visitedZones.add(zone);
}

function nearPendant() {
    const pendant = game.pendant;
    return pendant && !pendant.collected && pendant.distanceTo(game.player.position) < PICKUP_DISTANCE;
}

function updateInteraction(time) {
    hud.setPrompt(nearPendant() && !game.pickingUp ? 'Ramasser le pendentif gravé' : null);

    if (game.world.nearestVeil(game.player.position) < 3.4 && time - game.veilWarnedAt > 8) {
        game.veilWarnedAt = time;
        hud.toast('Une force vous repousse', 'Le voile ne s\'ouvre pas encore. Il faut d\'abord en apprendre plus au village.', 'magic');
    }
}

async function pickUpPendant() {
    if (!nearPendant() || game.pickingUp) return;
    game.pickingUp = true;
    hud.setPrompt(null);

    const player = game.player;
    const pendant = game.pendant;
    player.visual.rotation.y = Math.atan2(pendant.base.x - player.position.x, pendant.base.z - player.position.z);
    player.playAction('PickUp', 1.3);
    setTimeout(() => pendant.collect(), 550);

    try {
        const result = await api.pickUp(PENDANT_CODE);
        hud.newItemCode = PENDANT_CODE;
        game.state = result.state;
        hud.render(game.state);
        hud.toast(`${result.item.name} ajouté au sac`, 'Des symboles anciens sont gravés sur le métal.');
        if (result.clue) {
            setTimeout(() => hud.toast('Nouvel indice', hud.clueText(result.clue), 'magic'), 1400);
        }
        if (result.questAdvanced) {
            setTimeout(() => {
                hud.flashQuest();
                hud.toast('Quête mise à jour', game.state.quests?.find((q) => q.main)?.currentStep?.objective ?? '');
            }, 2800);
        }
        save({ silent: true });
    } catch (error) {
        hud.toast('Impossible de ramasser l\'objet', error.message);
    } finally {
        game.pickingUp = false;
    }
}

function updateStats() {
    const stats = game.world.stats;
    const engine = game.engine;
    hud.renderStats({
        fps: Math.round(engine.getFps()),
        frame: game.instrumentation.frameTimeCounter.lastSecAverage.toFixed(1),
        drawCalls: game.instrumentation.drawCallsCounter.current,
        meshes: game.scene.getActiveMeshes().length,
        cells: `${stats.objects.loaded} / ${stats.objects.cells}`,
        objects: stats.objects.objects,
        grass: `${stats.grass.loaded} / ${stats.grass.cells}`,
        lights: stats.lights,
        zone: game.zone,
    });
}

/* ---------------------------------------------------------------------- */
/* Sauvegarde                                                              */
/* ---------------------------------------------------------------------- */

function savePayload() {
    const { x, z } = game.player.position;
    let degrees = (game.player.rotationY * 180 / Math.PI) % 360;
    if (degrees < 0) degrees += 360;
    const playedSeconds = Math.min(3600, Math.floor(game.unsavedSeconds));
    return {
        zone: game.zone,
        position: { x: +x.toFixed(2), y: 0, z: +z.toFixed(2), rotationY: +degrees.toFixed(1) },
        playedSeconds,
    };
}

async function save({ silent = false, keepalive = false } = {}) {
    game.sinceSave = 0;
    const payload = savePayload();
    try {
        await api.save(payload, { keepalive });
        game.unsavedSeconds -= payload.playedSeconds;
        if (!silent) hud.setPauseStatus('Partie sauvegardée.');
        hud.showSaved();
        return true;
    } catch (error) {
        if (!silent) hud.setPauseStatus(`Échec de la sauvegarde : ${error.message}`);
        else hud.showSaved('Sauvegarde impossible');
        return false;
    }
}

/* ---------------------------------------------------------------------- */
/* Pause, sac, raccourcis                                                  */
/* ---------------------------------------------------------------------- */

function setPaused(paused) {
    if (!game.running || game.paused === paused) return;
    game.paused = paused;
    game.player.enabled = !paused;
    game.player.releaseKeys();
    hud.setPaused(paused);
    hud.toggleBag(false);
    if (paused) {
        if (document.pointerLockElement) document.exitPointerLock();
        save({ silent: true });
    } else {
        canvas.focus();
        canvas.requestPointerLock?.()?.catch?.(() => {});
    }
}

function bindControls() {
    window.addEventListener('keydown', (event) => {
        if (!game.running) return;
        if (event.code === 'Escape') {
            event.preventDefault();
            if (hud.bagOpen) hud.toggleBag(false);
            else setPaused(!game.paused);
            return;
        }
        if (event.code === 'F3') {
            event.preventDefault();
            hud.toggleStats();
            return;
        }
        if (game.paused || event.repeat) return;
        if (event.code === 'KeyE') pickUpPendant();
        if (event.code === 'KeyI' || event.code === 'Tab') {
            event.preventDefault();
            const open = hud.toggleBag();
            if (open && document.pointerLockElement) document.exitPointerLock();
        }
    });

    document.addEventListener('pointerlockchange', () => {
        if (!document.pointerLockElement && game.running && !game.paused && !hud.bagOpen) {
            setPaused(true);
        }
    });

    hud.el.bagClose.addEventListener('click', () => hud.toggleBag(false));
    hud.el.resume.addEventListener('click', () => setPaused(false));
    hud.el.quality.addEventListener('change', (event) => {
        applyQuality(event.target.value);
        hud.setPauseStatus(`Qualité graphique : ${QUALITY[event.target.value].label}.`);
    });
    hud.el.save.addEventListener('click', async () => {
        hud.el.save.disabled = true;
        hud.setPauseStatus('Sauvegarde…');
        await save();
        hud.el.save.disabled = false;
    });
    hud.el.quit.addEventListener('click', async () => {
        hud.el.quit.disabled = true;
        hud.setPauseStatus('Sauvegarde…');
        await save();
        window.location.href = root.dataset.exit;
    });

    window.addEventListener('pagehide', () => {
        if (game.running) save({ silent: true, keepalive: true });
    });
    document.addEventListener('visibilitychange', () => {
        if (document.hidden && game.running && !game.paused) setPaused(true);
    });
}

/** Accès de débogage (tests automatisés) : ?debug dans l'URL. */
function exposeForTests() {
    if (!new URLSearchParams(window.location.search).has('debug')) return;
    window.__game = game;
    hud.toggleStats(true);
}

boot().catch((error) => {
    console.error(error);
    if (error.status === 401 || error.status === 403) {
        hud.showError('Votre session a expiré. Reconnectez-vous puis relancez la partie.');
    } else {
        hud.showError(`Le monde n'a pas pu être chargé (${error.message}).`);
    }
});
