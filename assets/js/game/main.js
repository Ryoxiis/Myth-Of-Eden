/**
 * Myth of Eden — prototype 3D (Babylon.js).
 * Point d'entrée : charge la partie via l'API Symfony, construit le monde (chargé par cases
 * autour du joueur), fait apparaître le personnage et gère ramassage, sauvegarde, pause et qualité.
 */
import { Engine } from '@babylonjs/core/Engines/engine';
import { Scene } from '@babylonjs/core/scene';
import { Vector3, Matrix } from '@babylonjs/core/Maths/math.vector';
import { Color3, Color4 } from '@babylonjs/core/Maths/math.color';
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
import { isWalkable, zoneAt, pathX, heightAt, RUIN_CENTER, PATH_END_Z } from './terrain.js';
import { MonsterManager } from './monsters.js';
import { ChestManager } from './chests.js';
import { PlayerGear } from './gear.js';
import { LootWindow } from './ui/loot.js';
import { Shop } from './ui/shop.js';
import { MerchantManager } from './merchant.js';
import { NpcManager } from './npc.js';
import { Effects } from './vfx.js';
import { TrainingDummy } from './dummy.js';
import { SkillSystem } from './combat.js';
import { SkillBar } from './ui/skillbar.js';
import { Grimoire } from './ui/grimoire.js';
import { Inventory } from './ui/inventory.js';
import { WorldMap } from './ui/map.js';
import { HOME } from './layout.js';
import { BOSS_SPOTS } from './monsters.js';

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
    modal: null,
    veilWarnedAt: -100,
    messageAt: -100,
    visitedZones: new Set(),
    timeScale: 1,
    hitStop: 0,
    dead: false,
    killQueue: [],
    openChest: null,
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
    const [state, worldData] = await Promise.all([api.load(), api.world(root.dataset.world)]);
    game.state = state;
    game.worldData = worldData;
    hud.setZoneCatalog(worldData.zones);
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
    player.groundAt = heightAt;
    player.spawn(spawn.position, spawn.rotation);
    game.player = player;
    game.zone = zoneAt(spawn.position.x, spawn.position.z);
    game.visitedZones.add(game.zone);

    const hasPendant = (game.state.inventory ?? []).some((item) => item.code === PENDANT_CODE);
    if (!hasPendant) {
        game.pendant = new Pendant(scene, world.homeDoor.add(new Vector3(0.9, 0, -0.4)), assetsUrl, world.veilMask ?? null);
    }

    // Combat d'entraînement : effets, mannequins et système de compétences.
    game.effects = new Effects(scene, assetsUrl, world.spellLight);
    game.dummies = [
        new TrainingDummy(scene, new Vector3(9.5, 0, -1), world.shadows),
        new TrainingDummy(scene, new Vector3(12, 0, -4.2), world.shadows),
    ];
    game.skills = new SkillSystem({
        player,
        effects: game.effects,
        hud,
        state: game.state,
        targets: () => [...game.dummies, ...game.monsters.targets()],
        onImpact: (target, hit) => onImpact(target, hit),
    });

    // Monstres du monde ouvert (chargés par cases autour du joueur) et coffres de butin.
    game.monsters = new MonsterManager({
        scene,
        assetsUrl,
        shadows: world.shadows,
        effects: game.effects,
        player,
        onKill: (monster) => queueVictory(monster),
        onPlayerHit: (amount, monster) => hurtPlayer(amount, monster),
    });
    game.monsters.init(worldData);
    hud.setLoading(0.82, 'Les créatures de la forêt s\'éveillent…');
    await game.monsters.preload(spawn.position, () => {});
    game.chests = new ChestManager(scene, assetsUrl, world.shadows);
    for (const chest of game.state.chests ?? []) await game.chests.add(chest);
    game.gear = new PlayerGear(scene, player, assetsUrl);
    game.merchants = new MerchantManager(scene, assetsUrl, world.shadows);
    for (const merchant of worldData.merchants ?? []) await game.merchants.spawn(merchant);
    game.npcs = new NpcManager(scene, assetsUrl, world.shadows);
    for (const npc of worldData.npcs ?? []) await game.npcs.spawn(npc);
    createInterface();

    setupRendering(scene, player.camera, quality);
    for (const material of scene.materials) material.maxSimultaneousLights = 10;

    refreshState(game.state);
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
    if (zone === 'forest_path' || zone === 'chemin') {
        return { position: new Vector3(pathX(-40), 0, -40), rotation: 0 };
    }
    if (zone === 'ruin' || zone === 'ruine') {
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
    const realDt = Math.min(0.05, engine.getDeltaTime() / 1000);
    // « Hit-stop » : le temps ralentit une fraction de seconde à l'impact pour donner du poids aux coups.
    if (game.hitStop > 0) game.hitStop -= realDt;
    const dt = game.hitStop > 0 ? realDt * 0.08 : realDt;
    const time = performance.now() / 1000;
    const player = game.player;

    game.world.update(time, player.position);
    game.pendant?.update(time);
    game.effects.update(dt);
    game.chests.update(realDt, time);
    game.merchants.update(realDt, time, player.position);
    game.npcs.update(time);
    game.gear.tick(realDt);
    for (const dummy of game.dummies) dummy.update(dt, time);

    // Streaming : quelques fois par seconde, pas à chaque image.
    game.sinceStream += realDt;
    if (game.sinceStream >= STREAM_EVERY) {
        game.sinceStream = 0;
        game.world.streamTick(player.position);
        game.monsters.tick(player.position);
    }

    if (game.running && !game.paused) {
        if (!game.dead) player.update(dt);
        game.monsters.update(dt, !game.dead);
        game.skills.update(dt);
        if (game.attackHeld) attack();
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
    game.skillBar.update(game.skills);
    hud.setHealth(game.skills.health, game.skills.maxHealth);
    hud.updateOverlays(realDt, project);
    hud.updateNameplates(nearbyMonsters(), project, game.state.character?.level ?? 1);
    updateCrosshair();
    updateCompass();
    if (hud.statsVisible) updateStats();
}

function nearbyMonsters() {
    const list = [];
    const p = game.player.position;
    for (const monster of game.monsters.active) {
        if (monster.alive && Math.abs(monster.position.x - p.x) < 26 && Math.abs(monster.position.z - p.z) < 26
            && Vector3.DistanceSquared(monster.position, p) < 26 * 26) list.push(monster);
    }
    return list;
}

/* ---------------------------------------------------------------------- */
/* Combat : impacts, dégâts subis, mort, victoires et butin                 */
/* ---------------------------------------------------------------------- */

function onImpact(target, { critical, skill, basic }) {
    game.hitStop = Math.max(game.hitStop, critical ? 0.09 : basic ? 0.03 : 0.05);
    const ranged = basic ? game.skills.basic.kind !== 'melee' : skill.offensive && skill.range > 6;
    game.player.shake(critical ? 0.16 : ranged ? 0.04 : basic ? 0.05 : 0.08);
    hud.crosshairHit(critical);
}

function hurtPlayer(amount, monster) {
    if (game.dead || !game.running) return;
    const skills = game.skills;
    skills.health = Math.max(0, skills.health - amount);
    skills.healthDirty = true;
    hud.floatText(game.player.position.add(new Vector3(0, 2.2, 0)), `-${amount}`, 'hurt');
    hud.hurt();
    game.player.shake(0.12);
    if (skills.health <= 0) playerDeath(monster);
}

function playerDeath(monster) {
    game.dead = true;
    game.player.releaseKeys();
    game.player.playAction('Death_A', 99);
    root.querySelector('[data-death]').hidden = false;
    setTimeout(() => {
        const home = game.world.homeDoor.add(new Vector3(4, 0, 0));
        game.player.spawn(home, -Math.PI / 2);
        game.player.actionTime = 0;
        game.player.play('Idle');
        game.skills.health = game.skills.maxHealth;
        game.skills.stamina = game.skills.maxStamina;
        game.dead = false;
        root.querySelector('[data-death]').hidden = true;
        hud.toast('De retour au village', monster ? `Le ${monster.name.toLowerCase()} était trop fort… pour cette fois.` : '');
        save({ silent: true });
    }, 3200);
}

/** Les victoires sont envoyées une par une (le serveur refuse les rafales). */
function queueVictory(monster) {
    game.killQueue.push({ code: monster.type.code, level: monster.level, position: monster.position.clone(), name: monster.name, tier: monster.tier });
    if (!game.killTimer) processVictories();
}

async function processVictories() {
    const kill = game.killQueue.shift();
    if (!kill) {
        game.killTimer = null;
        return;
    }
    game.killTimer = true;
    try {
        const result = await api.victory(kill.code, kill.level, kill.position);
        hud.floatText(kill.position.add(new Vector3(0, 2.6, 0)), `+${result.experience} XP`, 'xp');
        if (result.runes > 0) setTimeout(() => hud.floatText(kill.position.add(new Vector3(0, 2.1, 0)), `+${result.runes} runes`, 'rune'), 250);
        const health = game.skills.health;
        refreshState(result.state);
        if (result.levelsGained > 0) {
            levelUp(result.state.character.level);
        } else {
            game.skills.health = health; // la santé « en direct » du client fait foi entre deux sauvegardes
        }
        if (result.chest) {
            await game.chests.add(result.chest, { fresh: true });
            if (kill.tier === 'boss') hud.toast(`${kill.name} est vaincu !`, 'Son trésor vous attend.', 'magic');
        }
    } catch (error) {
        console.warn('Victoire non enregistrée', error);
    }
    setTimeout(processVictories, 650);
}

function levelUp(level) {
    const player = game.player;
    const gold = new Color3(1, 0.82, 0.3);
    game.effects.ring(player.position, gold, 4, 0.9);
    game.effects.burst(player.position.add(new Vector3(0, 1, 0)), gold, { count: 220, power: 7, gravity: -1, life: [0.5, 1.2] });
    game.effects.aura(player.body, gold, 3);
    player.shake(0.2);
    const unlocked = (game.state.skills ?? []).filter((skill) => skill.requiredLevel === level).map((skill) => skill.name);
    hud.toast(`Niveau ${level} !`, unlocked.length ? `Nouvelle compétence : ${unlocked.join(', ')}. Ouvrez le grimoire (P).` : 'Santé et endurance augmentées, 3 points à répartir.', 'magic');
}

/* ---------------------------------------------------------------------- */
/* Marchands                                                                */
/* ---------------------------------------------------------------------- */

function openShop(merchant) {
    toggleModal('shop');
    game.openMerchant = merchant;
    game.merchants.greet(merchant);
    game.shop.open(merchant.data, game.state);
}

async function buyOffer(offerId) {
    const merchant = game.openMerchant;
    try {
        const health = game.skills.health;
        const result = await api.buy(merchant.data.code, offerId);
        refreshState(result.state);
        game.skills.health = health;
        hud.toast(`${result.bought} acheté`, 'Ajouté à votre sac (B).');
    } catch (error) {
        hud.toast('Achat impossible', error.message);
    }
}

async function sellEntry(entryId, quantity) {
    const merchant = game.openMerchant;
    try {
        const health = game.skills.health;
        const result = await api.sell(merchant.data.code, entryId, quantity);
        refreshState(result.state);
        game.skills.health = health;
        hud.toast(`+${result.earned} runes`, 'Le marchand range l\'objet dans sa charrette.');
    } catch (error) {
        hud.toast('Vente impossible', error.message);
    }
}

/* ---------------------------------------------------------------------- */
/* Coffres                                                                  */
/* ---------------------------------------------------------------------- */

function openChest(chest) {
    toggleModal('loot');
    game.openChest = chest;
    game.chests.open(chest);
    game.loot.open(chest.data);
}

async function takeFromChest(index) {
    const chest = game.openChest;
    if (!chest) return;
    try {
        const result = await api.takeFromChest(chest.id, index);
        const health = game.skills.health;
        refreshState(result.state);
        game.skills.health = health;
        if (result.chest) {
            chest.data = result.chest;
            game.loot.render(result.chest);
        } else {
            game.chests.remove(chest.id);
            game.openChest = null;
            closeModal();
        }
        if (result.taken > 0) hud.toast(result.taken > 1 ? `${result.taken} objets ajoutés au sac` : 'Objet ajouté au sac');
    } catch (error) {
        hud.toast('Impossible de prendre l\'objet', error.message);
    }
}


function updateZone() {
    const { x, z } = game.player.position;
    const zone = zoneAt(x, z);
    if (zone === game.zone) return;
    game.zone = zone;
    hud.setZone(zone);
    const info = hud.zoneInfo(zone);
    if (info && !game.visitedZones.has(zone)) {
        hud.toast(info.safe ? info.name : `${info.name} — niveaux ${info.minLevel} à ${info.maxLevel}`, info.description, 'magic');
    }
    game.visitedZones.add(zone);
}

function nearPendant() {
    const pendant = game.pendant;
    return pendant && !pendant.collected && pendant.distanceTo(game.player.position) < PICKUP_DISTANCE;
}

function updateInteraction(time) {
    if (game.modal) {
        hud.setPrompt(null);
        return;
    }
    const chest = game.dead ? null : game.chests.nearest(game.player.position);
    game.nearChest = chest;
    const npc = game.dead || chest ? null : game.npcs.nearest(game.player.position);
    game.nearNpc = npc;
    const merchant = game.dead || chest || npc ? null : game.merchants.nearest(game.player.position);
    game.nearMerchant = merchant;
    hud.setPrompt(nearPendant() && !game.pickingUp ? 'Ramasser le pendentif gravé'
        : chest ? 'Ouvrir le coffre'
        : npc ? `Parler à ${npc.data.name}`
        : merchant ? `Parler à ${merchant.data.name}` : null);

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
        refreshState(result.state);
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
        monsters: `${game.monsters.stats.alive} actifs / ${game.monsters.stats.total}`,
        zone: game.zone,
    });
}

/* ---------------------------------------------------------------------- */
/* Compétences, grimoire et inventaire                                     */
/* ---------------------------------------------------------------------- */

function createInterface() {
    game.skillBar = new SkillBar(root.querySelector('[data-skillbar]'), {
        onCast: (slot) => castSlot(slot),
        onChange: (bar) => changeSkillBar(bar),
    });
    game.grimoire = new Grimoire(root.querySelector('[data-grimoire]'), {
        onAssign: (code) => assignSkill(code),
        onClose: () => closeModal(),
        onDragState: (dragging) => game.skillBar.setDropMode(dragging),
    });
    game.shop = new Shop(root.querySelector('[data-shop]'), {
        onBuy: (offerId) => buyOffer(offerId),
        onSell: (entryId, quantity) => sellEntry(entryId, quantity),
        onClose: () => closeModal(),
    });
    game.loot = new LootWindow(root.querySelector('[data-loot]'), {
        onTake: (index) => takeFromChest(index),
        onTakeAll: () => takeFromChest(null),
        onClose: () => closeModal(),
    });
    game.map = new WorldMap(root.querySelector('[data-map]'), { onClose: () => closeModal() });
    game.inventory = new Inventory(root.querySelector('[data-inventory]'), {
        onUse: (id) => useItem(id),
        onEquip: (id) => equipItem(id),
        onClose: () => closeModal(),
    });
}

/** Répercute un nouvel état serveur sur toute l'interface et le personnage. */
function refreshState(state) {
    game.state = state;
    hud.render(state);
    game.skills.setState(state);
    game.skillBar.render(state.skills ?? [], state.skillBar ?? []);
    game.grimoire.render(state, state.skillBar ?? []);
    game.inventory.render(state);
    game.skillBar.setExperience(state.character ?? {});
    hud.setRunes(state.runes ?? 0);
    game.shop?.update(state);
    game.gear?.update(state.inventory ?? []);
    game.npcs?.setQuestStep(mainQuestStep()?.code ?? null);
}

function mainQuestStep() {
    const quest = (game.state.quests ?? []).find((q) => q.main) ?? game.state.quests?.[0];
    return quest?.status === 'completed' ? null : quest?.currentStep ?? null;
}

function castSlot(slot) {
    if (!game.running || game.paused || game.modal) return;
    const error = game.skills.castSlot(slot);
    if (!error) {
        game.skillBar.pressed(slot);
        return;
    }
    game.skillBar.flash(slot);
    const now = performance.now() / 1000;
    if (error !== 'busy' && now - game.messageAt > 1.5) {
        game.messageAt = now;
        hud.toast(error);
    }
}

let skillBarTimer = null;
function changeSkillBar(bar) {
    const previous = game.state.skillBar;
    game.state = { ...game.state, skillBar: bar };
    game.skills.setState(game.state);
    game.skillBar.render(game.state.skills ?? [], bar);
    game.grimoire.render(game.state, bar);

    clearTimeout(skillBarTimer);
    skillBarTimer = setTimeout(async () => {
        try {
            await api.saveSkillBar(bar);
        } catch (error) {
            hud.toast('Barre non enregistrée', error.message);
            changeSkillBarLocally(previous);
        }
    }, 350);
}

function changeSkillBarLocally(bar) {
    game.state = { ...game.state, skillBar: bar };
    game.skills.setState(game.state);
    game.skillBar.render(game.state.skills ?? [], bar);
    game.grimoire.render(game.state, bar);
}

function assignSkill(code) {
    const bar = [...(game.state.skillBar ?? [])];
    if (bar.includes(code)) return;
    const free = bar.indexOf(null);
    if (free === -1) {
        hud.toast('Barre pleine', 'Glissez le symbole sur un emplacement pour remplacer une compétence.');
        return;
    }
    bar[free] = code;
    changeSkillBar(bar);
}

async function useItem(id) {
    try {
        if (game.skills.healthDirty) await save({ silent: true });
        const result = await api.useItem(id);
        refreshState(result.state);
        hud.floatText(game.player.position.add(new Vector3(0, 2.4, 0)), result.healed > 0 ? `+${result.healed}` : 'Utilisé', 'heal');
    } catch (error) {
        hud.toast('Impossible d\'utiliser l\'objet', error.message);
    }
}

async function equipItem(id) {
    try {
        const result = await api.equipItem(id);
        refreshState(result.state);
        const item = result.state.inventory.find((entry) => entry.id === id);
        hud.toast(result.equipped ? `${item?.name ?? 'Objet'} équipé` : `${item?.name ?? 'Objet'} rangé dans le sac`);
    } catch (error) {
        hud.toast('Impossible d\'équiper l\'objet', error.message);
    }
}

function toggleModal(name) {
    if (game.modal === name) {
        closeModal();
        return;
    }
    closeModal({ relock: false });
    game.modal = name;
    root.classList.add('has-modal', `has-${name}`);
    game.player.enabled = false;
    game.player.releaseKeys();
    if (document.pointerLockElement) document.exitPointerLock();
    if (name === 'grimoire') game.grimoire.open();
    else if (name === 'inventory') game.inventory.open();
    else if (name === 'map') game.map.open(mapContext());
}

/** Tout ce que la carte affiche : position du joueur, objectif, PNJ, marchands, maison, boss connus. */
function mapContext() {
    const p = game.player.position;
    const camera = game.player.camera;
    const heading = ((Math.atan2(-Math.cos(camera.alpha), -Math.sin(camera.alpha)) * 180) / Math.PI + 360) % 360;
    const markers = [{ kind: 'home', x: HOME.x, z: HOME.z, label: 'Votre maison' }];
    for (const npc of game.npcs.npcs) markers.push({ kind: 'npc', x: npc.position.x, z: npc.position.z, label: `${npc.data.name} — ${npc.data.title}` });
    for (const merchant of game.merchants.merchants) markers.push({ kind: 'merchant', x: merchant.position.x, z: merchant.position.z, label: merchant.data.name });
    const bosses = (game.worldData?.zones ?? []).flatMap((zone) => zone.monsters.filter((m) => m.tier === 'boss').map((m) => ({ ...m, zone: zone.code })));
    for (const boss of bosses) {
        const spot = BOSS_SPOTS[boss.code];
        if (spot && game.visitedZones.has(boss.zone)) markers.push({ kind: 'boss', x: spot.x, z: spot.z, label: `${boss.name} (boss)` });
    }
    const objective = questObjective();
    let goal = null;
    if (objective) {
        goal = { ...objective, distance: Math.hypot(objective.x - p.x, objective.z - p.z) };
        markers.push({ kind: 'quest', x: objective.x, z: objective.z, label: objective.label });
    }
    return { player: { x: p.x, z: p.z, heading }, visited: game.visitedZones, zones: hud.zones, markers, goal };
}

function closeModal({ relock = true } = {}) {
    if (!game.modal) return;
    root.classList.remove('has-modal', `has-${game.modal}`);
    game.grimoire.close();
    game.inventory.close();
    game.loot.close();
    game.shop.close();
    game.map.close();
    dialogueEl.hidden = true;
    game.dialogue = null;
    if (game.openChest) {
        game.chests.close(game.openChest);
        game.openChest = null;
    }
    game.skillBar.setDropMode(false);
    game.modal = null;
    if (!game.paused) {
        game.player.enabled = true;
        if (relock) canvas.requestPointerLock?.()?.catch?.(() => {});
    }
}

/** Coordonnées écran (pixels CSS) d'un point 3D, pour les textes flottants. */
const projectMatrix = Matrix.Identity();
function project(position) {
    const { engine, scene, player } = game;
    const width = engine.getRenderWidth();
    const height = engine.getRenderHeight();
    const p = Vector3.Project(position, projectMatrix, scene.getTransformMatrix(), player.camera.viewport.toGlobal(width, height));
    const scale = canvas.clientWidth / width;
    return { x: p.x * scale, y: p.y * scale, visible: p.z > 0 && p.z < 1 };
}

/* ---------------------------------------------------------------------- */
/* Sauvegarde                                                              */
/* ---------------------------------------------------------------------- */

function savePayload() {
    const { x, z } = game.player.position;
    let degrees = (game.player.rotationY * 180 / Math.PI) % 360;
    if (degrees < 0) degrees += 360;
    const playedSeconds = Math.max(0, Math.min(3600, Math.floor(game.unsavedSeconds)));
    return {
        zone: game.zone,
        position: { x: +x.toFixed(2), y: 0, z: +z.toFixed(2), rotationY: +degrees.toFixed(1) },
        playedSeconds,
        health: Math.round(game.skills.health),
    };
}

let saveChain = Promise.resolve(true);

/**
 * Sauvegarde la partie. Les appels sont mis en file : deux sauvegardes simultanées
 * (pause puis « Sauvegarder et quitter ») enverraient sinon le même temps de jeu deux fois.
 */
function save(options = {}) {
    if (options.keepalive) return saveNow(options); // fermeture de page : pas le temps d'attendre la file
    saveChain = saveChain.then(() => saveNow(options), () => saveNow(options));
    return saveChain;
}

async function saveNow({ silent = false, keepalive = false } = {}) {
    game.sinceSave = 0;
    const payload = savePayload();
    try {
        await api.save(payload, { keepalive });
        game.unsavedSeconds = Math.max(0, game.unsavedSeconds - payload.playedSeconds);
        game.skills.healthDirty = false;
        if (!silent) hud.setPauseStatus('Partie sauvegardée.');
        hud.showSaved();
        return true;
    } catch (error) {
        console.error('[sauvegarde]', error.status ?? '', error.message, payload);
        if (!silent) hud.setPauseStatus(`Échec de la sauvegarde : ${error.message}`);
        else hud.showSaved('Sauvegarde impossible');
        return false;
    }
}

/* ---------------------------------------------------------------------- */
/* Attaque au clic, réticule et boussole                                   */
/* ---------------------------------------------------------------------- */

/** Clic gauche (souris capturée) : attaque de base ; on peut garder le bouton enfoncé. */
function attack() {
    if (!game.running || game.paused || game.modal || game.dead || !document.pointerLockElement) {
        game.attackHeld = false;
        return;
    }
    game.skills.basicAttack();
}

/** Réticule : rouge sur une créature à portée, grisé quand rien n'est à portée. */
function updateCrosshair() {
    const hidden = !game.running || game.paused || Boolean(game.modal) || game.dead;
    if (hidden) {
        hud.setCrosshair('', { hidden: true });
        return;
    }
    const sight = game.skills.aimAt(game.skills.basic.range);
    if (sight.target) hud.showTarget(sight.target);
    const inReach = sight.target || Vector3.Distance(sight.point, game.player.position) <= game.skills.basic.range + 0.5;
    hud.setCrosshair(sight.target ? 'enemy' : inReach ? '' : 'far', { cooldown: !game.skills.attackReady });
}

/** Où se trouve l'objectif de la quête en cours (point du monde), selon l'étape. */
function questObjective() {
    const step = mainQuestStep();
    if (!step) return null;
    switch (step.code) {
        case 'examine_door_object': {
            const p = game.pendant && !game.pendant.collected ? game.pendant.base : game.world.homeDoor;
            return { x: p.x, z: p.z, label: 'Le pendentif devant votre porte' };
        }
        case 'ask_villagers': {
            const npc = game.npcs.npcs.find((n) => n.data.questStep === step.code);
            return npc ? { x: npc.position.x, z: npc.position.z, label: `Parler à ${npc.data.name}` } : null;
        }
        case 'follow_forest_path': {
            // Le bout du chemin de la forêt, ou le prochain tronçon si l'on est déjà dessus.
            const z = Math.max(PATH_END_Z, Math.min(-30, game.player.position.z - 40));
            return { x: pathX(z), z, label: 'Suivre le chemin de la forêt' };
        }
        case 'enter_ruin':
        case 'activate_mechanism':
            return { x: RUIN_CENTER.x, z: RUIN_CENTER.z, label: step.objective };
        default:
            return null;
    }
}

/** Boussole : nord = +Z, est = +X. Affiche l'objectif de quête et la marchande proche. */
function updateCompass() {
    const camera = game.player.camera;
    const toDegrees = (x, z) => ((Math.atan2(x, z) * 180) / Math.PI + 360) % 360;
    const heading = toDegrees(-Math.cos(camera.alpha), -Math.sin(camera.alpha));
    const p = game.player.position;
    const markers = [];

    const goal = questObjective();
    if (goal) {
        const distance = Math.hypot(goal.x - p.x, goal.z - p.z);
        markers.push({ id: 'quest', kind: 'quest', bearing: toDegrees(goal.x - p.x, goal.z - p.z), distance, label: goal.label });
    }
    for (const merchant of game.merchants.merchants) {
        const distance = Math.hypot(merchant.position.x - p.x, merchant.position.z - p.z);
        if (distance < 60) {
            markers.push({ id: `merchant-${merchant.data.code}`, kind: 'merchant', bearing: toDegrees(merchant.position.x - p.x, merchant.position.z - p.z), distance });
        }
    }
    hud.updateCompass(heading, markers);
}

/* ---------------------------------------------------------------------- */
/* Dialogues avec les PNJ                                                  */
/* ---------------------------------------------------------------------- */

const dialogueEl = root.querySelector('[data-dialogue]');

async function talkTo(npc) {
    if (game.talking) return;
    game.talking = true;
    const p = game.player.position;
    game.player.visual.rotation.y = Math.atan2(npc.position.x - p.x, npc.position.z - p.z);
    game.npcs.talkTo(npc, p);
    try {
        const result = await api.talk(npc.data.code, p);
        const health = game.skills.health;
        refreshState(result.state);
        game.skills.health = health;
        openDialogue(result, npc);
    } catch (error) {
        hud.toast(`${npc.data.name} ne répond pas`, error.message);
    } finally {
        game.talking = false;
    }
}

function openDialogue(result, npc) {
    toggleModal('dialogue');
    game.dialogue = { result, npc, index: 0 };
    dialogueEl.querySelector('[data-dialogue-name]').textContent = result.npc.name;
    dialogueEl.querySelector('[data-dialogue-title]').textContent = result.npc.title;
    dialogueEl.hidden = false;
    showDialogueLine();
}

function showDialogueLine() {
    const { result, index } = game.dialogue;
    const lines = result.lines.length ? result.lines : ['…'];
    dialogueEl.querySelector('[data-dialogue-line]').textContent = lines[index];
    dialogueEl.querySelector('[data-dialogue-progress]').textContent = lines.length > 1 ? `${index + 1} / ${lines.length}` : '';
    const last = index >= lines.length - 1;
    dialogueEl.querySelector('[data-dialogue-next]').innerHTML = `${last ? 'Au revoir' : 'Continuer'} <kbd>E</kbd>`;
}

function nextDialogueLine() {
    if (!game.dialogue) return;
    const { result } = game.dialogue;
    game.dialogue.index += 1;
    if (game.dialogue.index < result.lines.length) {
        showDialogueLine();
        return;
    }
    closeModal();
    if (result.questAdvanced) {
        hud.flashQuest();
        hud.toast('Quête mise à jour', mainQuestStep()?.objective ?? '', 'magic');
    }
    if (result.clue) setTimeout(() => hud.toast('Nouvel indice', hud.clueText(result.clue), 'magic'), 1200);
}

/* ---------------------------------------------------------------------- */
/* Pause, sac, raccourcis                                                  */
/* ---------------------------------------------------------------------- */

function setPaused(paused) {
    if (!game.running || game.paused === paused) return;
    game.paused = paused;
    game.player.enabled = !paused;
    game.player.releaseKeys();
    closeModal({ relock: false });
    hud.setPaused(paused);
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
            if (game.modal) closeModal();
            else setPaused(!game.paused);
            return;
        }
        if (event.code === 'F3') {
            event.preventDefault();
            hud.toggleStats();
            return;
        }
        if (game.paused || event.repeat) return;
        if (event.code === 'KeyP') {
            event.preventDefault();
            toggleModal('grimoire');
            return;
        }
        if (event.code === 'KeyB') {
            event.preventDefault();
            toggleModal('inventory');
            return;
        }
        if (event.key?.toLowerCase() === 'm' && (!game.modal || game.modal === 'map')) { // touche M en AZERTY comme en QWERTY
            event.preventDefault();
            toggleModal('map');
            return;
        }
        if (game.modal === 'dialogue' && (event.code === 'KeyE' || event.code === 'Space' || event.code === 'Enter')) {
            event.preventDefault();
            nextDialogueLine();
            return;
        }
        if ((game.modal === 'loot' || game.modal === 'shop') && event.code === 'KeyE') {
            closeModal();
            return;
        }
        if (game.modal === 'grimoire' && (event.code === 'ArrowRight' || event.code === 'ArrowLeft')) {
            game.grimoire.turn(event.code === 'ArrowRight' ? 1 : -1);
            return;
        }
        if (game.modal) return;
        if (event.code === 'KeyE') {
            if (nearPendant()) pickUpPendant();
            else if (game.nearChest) openChest(game.nearChest);
            else if (game.nearNpc) talkTo(game.nearNpc);
            else if (game.nearMerchant) openShop(game.nearMerchant);
        }
        const slot = /^(Digit|Numpad)([1-6])$/.exec(event.code);
        if (slot) castSlot(Number(slot[2]) - 1);
    });

    // Clic gauche = attaque (seulement quand la souris est capturée : le premier clic sert à la capturer).
    canvas.addEventListener('mousedown', (event) => {
        if (event.button !== 0 || document.pointerLockElement !== canvas) return;
        game.attackHeld = true;
        attack();
    });
    window.addEventListener('mouseup', (event) => {
        if (event.button === 0) game.attackHeld = false;
    });
    window.addEventListener('blur', () => { game.attackHeld = false; });
    dialogueEl.querySelector('[data-dialogue-next]').addEventListener('click', () => nextDialogueLine());

    document.addEventListener('pointerlockchange', () => {
        if (!document.pointerLockElement) game.attackHeld = false;
        if (!document.pointerLockElement && game.running && !game.paused && !game.modal) {
            setPaused(true);
        }
    });

    hud.el.resume.addEventListener('click', () => setPaused(false));
    hud.el.quality.addEventListener('change', (event) => {
        applyQuality(event.target.value);
        hud.setPauseStatus(`Qualité graphique : ${QUALITY[event.target.value].label}.`);
    });
    let quitWithoutSaving = false;
    hud.el.save.addEventListener('click', async () => {
        hud.el.save.disabled = true;
        hud.setPauseStatus('Sauvegarde…');
        if (await save() && quitWithoutSaving) {
            quitWithoutSaving = false;
            hud.el.quit.textContent = 'Sauvegarder et quitter';
        }
        hud.el.save.disabled = false;
    });
    hud.el.quit.addEventListener('click', async () => {
        if (quitWithoutSaving) {
            leaveGame();
            return;
        }
        hud.el.quit.disabled = true;
        hud.setPauseStatus('Sauvegarde…');
        const saved = await save();
        hud.el.quit.disabled = false;
        if (saved) {
            leaveGame();
            return;
        }
        // On ne quitte pas en silence : le joueur choisit de réessayer ou de partir quand même.
        quitWithoutSaving = true;
        hud.el.quit.textContent = 'Quitter sans sauvegarder';
    });

    function leaveGame() {
        game.running = false; // pas de seconde sauvegarde au déchargement de la page
        window.location.href = root.dataset.exit;
    }

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
    game.frame = frame;
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
