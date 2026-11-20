/**
 * Mannequin d'entraînement : une cible pour essayer les compétences en attendant les vrais ennemis.
 * Il encaisse les coups, vacille, affiche ses points de vie et se répare tout seul.
 */
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import { Color3 } from '@babylonjs/core/Maths/math.color';
import { TransformNode } from '@babylonjs/core/Meshes/transformNode';
import { CreateCylinder } from '@babylonjs/core/Meshes/Builders/cylinderBuilder';
import { CreateSphere } from '@babylonjs/core/Meshes/Builders/sphereBuilder';
import { CreateBox } from '@babylonjs/core/Meshes/Builders/boxBuilder';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';

const MAX_HP = 600;

export class TrainingDummy {
    constructor(scene, position, shadows, { name = 'Mannequin d\'entraînement' } = {}) {
        this.scene = scene;
        this.name = name;
        this.position = position.clone();
        this.hp = MAX_HP;
        this.maxHp = MAX_HP;
        this.sinceHit = 99;
        this.wobble = 0;

        const root = new TransformNode('dummy', scene);
        root.position.copyFrom(position);
        this.root = root;
        const pivot = new TransformNode('dummyPivot', scene);
        pivot.parent = root;
        this.pivot = pivot;

        const wood = new StandardMaterial('dummyWood', scene);
        wood.diffuseColor = new Color3(0.36, 0.24, 0.14);
        wood.specularColor = new Color3(0.05, 0.04, 0.03);
        const straw = new StandardMaterial('dummyStraw', scene);
        straw.diffuseColor = new Color3(0.72, 0.6, 0.34);
        straw.specularColor = Color3.Black();
        const cloth = new StandardMaterial('dummyCloth', scene);
        cloth.diffuseColor = new Color3(0.45, 0.16, 0.12);
        cloth.specularColor = Color3.Black();
        this.materials = [wood, straw, cloth];
        this.flashMaterial = straw;

        const parts = [];
        const post = CreateCylinder('dummyPost', { height: 1.9, diameter: 0.14, tessellation: 10 }, scene);
        post.position.y = 0.95;
        post.material = wood;
        post.parent = root;
        parts.push(post);

        const body = CreateCylinder('dummyBody', { height: 1, diameterTop: 0.55, diameterBottom: 0.68, tessellation: 14 }, scene);
        body.position.y = 1.35;
        body.material = straw;
        body.parent = pivot;
        const belt = CreateCylinder('dummyBelt', { height: 0.14, diameter: 0.7, tessellation: 14 }, scene);
        belt.position.y = 1.0;
        belt.material = cloth;
        belt.parent = pivot;
        const head = CreateSphere('dummyHead', { diameter: 0.46, segments: 12 }, scene);
        head.position.y = 2.08;
        head.material = straw;
        head.parent = pivot;
        const arms = CreateBox('dummyArms', { width: 1.5, height: 0.12, depth: 0.12 }, scene);
        arms.position.y = 1.62;
        arms.material = wood;
        arms.parent = pivot;
        const target = CreateCylinder('dummyTarget', { height: 0.04, diameter: 0.34, tessellation: 20 }, scene);
        target.rotation.x = Math.PI / 2;
        target.position.set(0, 1.4, 0.33);
        target.material = cloth;
        target.parent = pivot;
        parts.push(body, belt, head, arms, target);
        pivot.position.y = 0;

        for (const mesh of parts) {
            mesh.receiveShadows = true;
            mesh.isPickable = false;
            shadows?.addShadowCaster(mesh, false);
        }
        this.meshes = parts;

        // Collision : on ne traverse pas le mannequin.
        const collider = CreateCylinder('collider', { height: 2.2, diameter: 0.9, tessellation: 8 }, scene);
        collider.position.set(position.x, 1.1, position.z);
        collider.isVisible = false;
        collider.isPickable = false;
        collider.checkCollisions = true;
        this.collider = collider;
    }

    /** Point visé (centre du torse). */
    get center() {
        return this.position.add(new Vector3(0, 1.35, 0));
    }

    get radius() {
        return 0.55;
    }

    /** Reçoit des dégâts venant de `from` : renvoie les dégâts réellement encaissés. */
    hit(amount, from) {
        this.sinceHit = 0;
        this.hp = Math.max(0, this.hp - amount);
        this.wobble = 1;
        this.wobbleDirection = from ? Math.atan2(this.position.x - from.x, this.position.z - from.z) : 0;
        this.flashTime = 0.15;
        if (this.hp === 0) this.hp = this.maxHp; // simple mannequin : il se reconstitue aussitôt
        return amount;
    }

    update(dt, time) {
        this.sinceHit += dt;
        if (this.sinceHit > 4 && this.hp < this.maxHp) {
            this.hp = Math.min(this.maxHp, this.hp + this.maxHp * dt * 0.5);
        }
        if (this.wobble > 0) {
            this.wobble = Math.max(0, this.wobble - dt * 1.6);
            const swing = Math.sin(time * 22) * 0.22 * this.wobble;
            this.pivot.rotation.x = Math.cos(this.wobbleDirection ?? 0) * swing;
            this.pivot.rotation.z = -Math.sin(this.wobbleDirection ?? 0) * swing;
        }
        if (this.flashTime > 0) {
            this.flashTime -= dt;
            this.flashMaterial.emissiveColor.set(0.6, 0.35, 0.1);
            if (this.flashTime <= 0) this.flashMaterial.emissiveColor.set(0, 0, 0);
        }
    }
}
