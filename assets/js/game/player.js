/**
 * Personnage à la troisième personne : modèle de la classe, animations, déplacement
 * relatif à la caméra, collisions et caméra orbitale pilotée à la souris.
 */
import { ArcRotateCamera } from '@babylonjs/core/Cameras/arcRotateCamera';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import { TransformNode } from '@babylonjs/core/Meshes/transformNode';
import { CreateBox } from '@babylonjs/core/Meshes/Builders/boxBuilder';
import { LoadAssetContainerAsync } from '@babylonjs/core/Loading/sceneLoader';
import { Ray } from '@babylonjs/core/Culling/ray';
import '@babylonjs/core/Animations/animatable';
import '@babylonjs/core/Collisions/collisionCoordinator';
import '@babylonjs/loaders/glTF/2.0';

/** Armes visibles selon la classe (les modèles KayKit contiennent tout l'arsenal). */
const VISIBLE_GEAR = {
    scout: ['1H_Crossbow', 'Knife'],
    fighter: ['1H_Sword', 'Round_Shield'],
    traveler: ['1H_Axe'],
    mage: ['2H_Staff'],
};
/** Décalage de la caméra vers la droite du personnage (mètres). */
const SHOULDER_OFFSET = 0.85;
const BODY_PART = /(Arm|Body|Head|Leg|Cape|Hat|Helmet)/;

const WALK_SPEED = 2.4;
const RUN_SPEED = 6;
const TURN_SPEED = 12;
const MODEL_SCALE = 0.72;

const lerpAngle = (from, to, t) => {
    let delta = (to - from) % (Math.PI * 2);
    if (delta > Math.PI) delta -= Math.PI * 2;
    if (delta < -Math.PI) delta += Math.PI * 2;
    return from + delta * Math.min(1, t);
};

export class Player {
    constructor(scene, canvas) {
        this.scene = scene;
        this.canvas = canvas;
        this.keys = new Set();
        this.actionTime = 0;
        this.current = null;
        this.enabled = false;
    }

    async load(modelUrl, classCode, shadows) {
        const scene = this.scene;

        // Corps de collision invisible : c'est lui qui se déplace.
        this.body = CreateBox('playerBody', { size: 0.2 }, scene);
        this.body.isVisible = false;
        this.body.isPickable = false;
        this.body.ellipsoid = new Vector3(0.38, 0.9, 0.38);
        this.body.ellipsoidOffset = new Vector3(0, 0.9, 0);

        // Nœud visuel : il pivote vers la direction de la marche.
        this.visual = new TransformNode('playerVisual', scene);
        this.visual.parent = this.body;

        const container = await LoadAssetContainerAsync(modelUrl, scene);
        container.addAllToScene();
        const root = container.meshes[0];
        root.parent = this.visual;
        this.root = root;
        this.shadows = shadows;
        root.scaling = new Vector3(MODEL_SCALE, MODEL_SCALE, -MODEL_SCALE);

        const gear = VISIBLE_GEAR[classCode] ?? [];
        this.gearMeshes = [];
        this.meshes = [];
        for (const mesh of root.getChildMeshes(false)) {
            const base = mesh.name.replace(/_primitive\d+$/, '');
            const isGear = gear.includes(base);
            const keep = BODY_PART.test(base) || isGear;
            mesh.setEnabled(keep);
            mesh.isPickable = false;
            mesh.receiveShadows = true;
            if (keep) {
                shadows.addShadowCaster(mesh, false);
                this.meshes.push(mesh);
            }
            if (isGear) this.gearMeshes.push(mesh);
        }

        this.animations = {};
        for (const group of container.animationGroups) {
            group.stop();
            group.enableBlending = true;
            group.blendingSpeed = 0.12;
            this.animations[group.name] = group;
        }
        this.play('Idle');

        this.createCamera();
        this.bindInput();
        return this;
    }

    play(name, loop = true) {
        const group = this.animations[name] ?? this.animations.Idle;
        if (!group || this.current === group) return group;
        this.current?.stop();
        group.start(loop, 1, group.from, group.to, false);
        this.current = group;
        return group;
    }

    /** Joue une animation ponctuelle (ramasser…) en bloquant le déplacement. */
    playAction(name, duration) {
        if (this.animations[name] && this.current === this.animations[name]) {
            this.current.stop();
            this.current = null;
        }
        const group = this.play(name, false);
        this.actionTime = duration ?? (group ? (group.to - group.from) / 60 : 1);
        this.current = group;
    }

    /** Affiche ou cache l'arme tenue (selon ce qui est équipé dans l'inventaire). */
    setWeaponVisible(visible) {
        for (const mesh of this.gearMeshes) mesh.setEnabled(visible);
    }

    /** Os d'attache des mains (r = droite, l = gauche) pour y fixer armes et boucliers. */
    handslot(side) {
        return this.root.getDescendants(false, (node) => node.name === `handslot.${side}`)[0] ?? null;
    }

    /** Tremblement de caméra (intensité en mètres), amorti rapidement. */
    shake(intensity) {
        this.shakeAmount = Math.max(this.shakeAmount ?? 0, intensity);
    }

    /** Durée d'une animation en secondes. */
    animationLength(name) {
        const group = this.animations[name];
        return group ? (group.to - group.from) / 60 : 1;
    }

    /** Direction visée : l'avant de la caméra, à plat. */
    aimDirection() {
        const alpha = this.camera.alpha;
        return new Vector3(-Math.cos(alpha), 0, -Math.sin(alpha)).normalize();
    }

    /** Bond rapide dans une direction (roulade, charge), en respectant les collisions. */
    dash(direction, distance, duration = 0.28) {
        this.dashState = { direction: direction.clone().normalize(), speed: distance / duration, time: duration };
    }

    /** Discrétion : le personnage devient à demi transparent pendant `seconds`. */
    setStealth(seconds) {
        this.stealthUntil = performance.now() + seconds * 1000;
        for (const mesh of this.meshes) mesh.visibility = 0.45;
    }

    /** Pose le personnage sur le relief (groundAt est fourni par le terrain). */
    stickToGround() {
        const p = this.body.position;
        p.y = this.groundAt ? this.groundAt(p.x, p.z) : 0;
    }

    spawn(position, rotationY) {
        this.body.position.set(position.x, 0, position.z);
        this.stickToGround();
        this.visual.rotation.y = rotationY;
        // Caméra placée derrière le personnage.
        this.camera.alpha = Math.atan2(-Math.cos(rotationY), -Math.sin(rotationY));
        this.camera.target.copyFrom(this.cameraFocus());
    }

    get position() {
        return this.body.position;
    }

    /** Point regardé par la caméra : au-dessus et à droite du personnage (vue « par-dessus l'épaule »). */
    cameraFocus() {
        const alpha = this.camera.alpha;
        // Droite de la caméra = perpendiculaire à sa direction, au sol.
        const right = new Vector3(-Math.sin(alpha), 0, Math.cos(alpha));
        return this.body.position.add(new Vector3(0, 1.75, 0)).add(right.scale(SHOULDER_OFFSET));
    }

    get rotationY() {
        return this.visual.rotation.y;
    }

    createCamera() {
        const camera = new ArcRotateCamera('camera', -Math.PI / 2, 1.22, 6.2, new Vector3(0, 1.45, 0), this.scene);
        camera.inputs.clear();
        camera.attachControl(this.canvas, true);
        camera.lowerRadiusLimit = 2.6;
        camera.upperRadiusLimit = 10;
        camera.lowerBetaLimit = 0.5;
        camera.upperBetaLimit = 1.48;
        camera.minZ = 0.1;
        camera.maxZ = 900;
        camera.fov = 0.9;
        this.camera = camera;
        // Distance voulue (molette) ; la distance réelle se raccourcit si un mur s'interpose.
        this.desiredRadius = camera.radius;
        this.cameraRay = new Ray(Vector3.Zero(), Vector3.Forward(), 10);
        this.canvas.addEventListener('wheel', (event) => {
            if (!this.enabled) return;
            event.preventDefault();
            this.desiredRadius = Math.min(camera.upperRadiusLimit, Math.max(camera.lowerRadiusLimit, this.desiredRadius + Math.sign(event.deltaY) * 0.6));
        }, { passive: false });
    }

    bindInput() {
        const onKey = (event, down) => {
            if (!this.enabled) return;
            const movementKeys = ['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'ShiftLeft', 'ShiftRight'];
            if (movementKeys.includes(event.code)) {
                event.preventDefault();
                if (down) this.keys.add(event.code);
                else this.keys.delete(event.code);
            }
        };
        window.addEventListener('keydown', (event) => onKey(event, true));
        window.addEventListener('keyup', (event) => onKey(event, false));
        window.addEventListener('blur', () => this.keys.clear());

        // Rotation de la caméra : souris capturée (pointer lock) ou glisser-déposer en secours.
        let dragging = false;
        this.canvas.addEventListener('pointerdown', (event) => {
            if (!this.enabled) return;
            dragging = true;
            if (document.pointerLockElement !== this.canvas && event.pointerType === 'mouse') {
                this.canvas.requestPointerLock?.()?.catch?.(() => {});
            }
        });
        window.addEventListener('pointerup', () => { dragging = false; });
        window.addEventListener('pointermove', (event) => {
            if (!this.enabled) return;
            if (document.pointerLockElement === this.canvas || dragging) {
                this.rotateCamera(event.movementX, event.movementY);
            }
        });
    }

    rotateCamera(dx, dy) {
        const camera = this.camera;
        camera.alpha -= dx * 0.0032;
        camera.beta = Math.min(camera.upperBetaLimit, Math.max(camera.lowerBetaLimit, camera.beta - dy * 0.0026));
    }

    releaseKeys() {
        this.keys.clear();
    }

    /** Avance d'une image. Renvoie true si le personnage s'est déplacé. */
    update(dt) {
        const camera = this.camera;
        let moved = false;

        if (this.dashState && this.dashState.time > 0) {
            const step = Math.min(dt, this.dashState.time);
            this.dashState.time -= step;
            const before = this.body.position.clone();
            this.body.moveWithCollisions(this.dashState.direction.scale(this.dashState.speed * step));
            this.keepOnWalkableGround(before);
            this.stickToGround();
        }
        if (this.stealthUntil && performance.now() > this.stealthUntil) {
            this.stealthUntil = 0;
            for (const mesh of this.meshes) mesh.visibility = 1;
        }

        if (this.actionTime > 0) {
            this.actionTime -= dt;
            if (this.actionTime <= 0) this.play('Idle');
        } else {
            const k = this.keys;
            const forward = (k.has('KeyW') || k.has('ArrowUp') ? 1 : 0) - (k.has('KeyS') || k.has('ArrowDown') ? 1 : 0);
            const strafe = (k.has('KeyD') || k.has('ArrowRight') ? 1 : 0) - (k.has('KeyA') || k.has('ArrowLeft') ? 1 : 0);
            const running = k.has('ShiftLeft') || k.has('ShiftRight');

            if (forward !== 0 || strafe !== 0) {
                // Avant = direction de la caméra projetée au sol ; droite = perpendiculaire.
                const ahead = new Vector3(-Math.cos(camera.alpha), 0, -Math.sin(camera.alpha));
                const right = Vector3.Cross(Vector3.Up(), ahead);
                const direction = ahead.scale(forward).add(right.scale(strafe)).normalize();
                const speed = running ? RUN_SPEED : WALK_SPEED;

                const before = this.body.position.clone();
                this.body.moveWithCollisions(direction.scale(speed * dt));
                this.keepOnWalkableGround(before);
                this.stickToGround();
                this.visual.rotation.y = lerpAngle(this.visual.rotation.y, Math.atan2(direction.x, direction.z), TURN_SPEED * dt);
                this.play(running ? 'Running_A' : 'Walking_A');
                moved = true;
            } else {
                this.play('Idle');
            }
        }

        // La caméra suit en douceur, au-dessus de l'épaule droite : le centre de l'écran
        // (le réticule) vise devant le personnage au lieu de tomber sur sa tête.
        const target = this.cameraFocus();
        Vector3.LerpToRef(camera.target, target, Math.min(1, dt * 10), camera.target);
        if (this.shakeAmount > 0.002) {
            const a = this.shakeAmount;
            camera.target.addInPlaceFromFloats((Math.random() - 0.5) * a, (Math.random() - 0.5) * a, (Math.random() - 0.5) * a);
            this.shakeAmount *= Math.pow(0.0015, dt);
        }
        this.updateCameraArm(dt);
        return moved;
    }

    /**
     * « Bras de caméra » : un rayon part des épaules vers la caméra ; s'il touche un mur ou un tronc,
     * la caméra se rapproche (tout de suite), puis repart en douceur quand la vue se dégage.
     */
    updateCameraArm(dt) {
        const camera = this.camera;
        const sinBeta = Math.sin(camera.beta);
        const direction = this.cameraRay.direction;
        direction.set(Math.cos(camera.alpha) * sinBeta, Math.cos(camera.beta), Math.sin(camera.alpha) * sinBeta);
        this.cameraRay.origin.copyFrom(camera.target);
        this.cameraRay.length = this.desiredRadius;
        const hit = this.scene.pickWithRay(this.cameraRay, (mesh) => mesh.checkCollisions && mesh.isEnabled(), true);
        const wanted = hit?.hit ? Math.max(1.2, hit.distance - 0.4) : this.desiredRadius;
        camera.radius = wanted < camera.radius ? wanted : camera.radius + (wanted - camera.radius) * Math.min(1, dt * 3);
    }

    /**
     * Si le pas mène hors des zones praticables (collines, forêt dense), on annule l'axe fautif :
     * le personnage glisse le long de la lisière au lieu de s'arrêter net.
     */
    keepOnWalkableGround(before) {
        const position = this.body.position;
        if (!this.canStand || this.canStand(position.x, position.z)) {
            this.blocked = false;
            return;
        }
        this.blocked = true;
        if (this.canStand(position.x, before.z)) position.z = before.z;
        else if (this.canStand(before.x, position.z)) position.x = before.x;
        else position.copyFrom(before);
    }
}
