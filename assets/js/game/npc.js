/**
 * Personnages non joueurs (données Symfony : /api/monde → npcs).
 * Chaque PNJ est un modèle KayKit teinté (pour ne pas ressembler aux personnages joueurs),
 * avec un losange doré qui flotte au-dessus de lui quand il a quelque chose à dire pour la quête.
 */
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import { Color3 } from '@babylonjs/core/Maths/math.color';
import { TransformNode } from '@babylonjs/core/Meshes/transformNode';
import { CreatePolyhedron } from '@babylonjs/core/Meshes/Builders/polyhedronBuilder';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import { LoadAssetContainerAsync } from '@babylonjs/core/Loading/sceneLoader';
import '@babylonjs/loaders/glTF/2.0';

import { heightAt } from './terrain.js';

export const NPC_TALK_DISTANCE = 3.2;
/** Parties du modèle à garder : le corps, la cape, le chapeau et le bâton (canne de l'ermite). */
const KEEP = /(Arm|Body|Head|Leg|Cape|2H_Staff)/; // sans chapeau : on ne le confond pas avec un mage joueur

export class NpcManager {
    constructor(scene, assetsUrl, shadows) {
        this.scene = scene;
        this.assetsUrl = assetsUrl;
        this.shadows = shadows;
        this.npcs = [];
    }

    async spawn(data) {
        const container = await LoadAssetContainerAsync(`${this.assetsUrl}characters/${data.model}.glb`, this.scene);
        const entries = container.instantiateModelsToScene((name) => `${data.code}-${name}`, true, { doNotInstantiate: true });
        const holder = new TransformNode(`npc-${data.code}`, this.scene);
        const y = heightAt(data.x, data.z);
        holder.position.set(data.x, y, data.z);
        holder.rotation.y = (data.rotation ?? 0) * Math.PI / 180;
        const root = entries.rootNodes[0];
        root.parent = holder;
        // Même taille que les personnages joueurs : le modèle d'origine fait ~2,4 m.
        root.scaling = new Vector3(0.7, 0.7, -0.7);

        const tint = data.tint ? Color3.FromHexString(data.tint) : null;
        const tinted = new Map();
        for (const mesh of holder.getChildMeshes(false)) {
            const base = mesh.name.replace(`${data.code}-`, '').replace(/_primitive\d+$/, '');
            if (base === '__root__') continue; // parent de tout le modèle : il doit rester actif
            const keep = KEEP.test(base);
            mesh.setEnabled(keep);
            mesh.isPickable = false;
            mesh.receiveShadows = true;
            mesh.alwaysSelectAsActiveMesh = true; // jamais escamoté par erreur (le losange reste au-dessus)
            if (!keep) continue;
            this.shadows.addShadowCaster(mesh, false);
            // Teinte : une copie du matériau, pour ne pas recolorer le personnage du joueur.
            if (tint && mesh.material) {
                if (!tinted.has(mesh.material)) {
                    const copy = mesh.material.clone(`${mesh.material.name}-${data.code}`);
                    if ('albedoColor' in copy) copy.albedoColor = tint;
                    else if ('diffuseColor' in copy) copy.diffuseColor = tint;
                    tinted.set(mesh.material, copy);
                }
                mesh.material = tinted.get(mesh.material);
            }
            mesh.material.maxSimultaneousLights = 10;
        }

        const animations = Object.fromEntries(entries.animationGroups.map((group) => [group.name, group]));
        for (const group of entries.animationGroups) group.stop();
        animations.Idle?.start(true);

        // Losange de quête (doré) au-dessus de la tête.
        const marker = CreatePolyhedron(`npcMarker-${data.code}`, { type: 1, size: 0.18 }, this.scene);
        const material = new StandardMaterial(`npcMarker-${data.code}`, this.scene);
        material.emissiveColor = new Color3(1, 0.78, 0.25);
        material.diffuseColor = new Color3(0.4, 0.3, 0.05);
        material.disableLighting = true;
        marker.material = material;
        marker.scaling.y = 1.6;
        marker.isPickable = false;
        marker.position.set(data.x, y + 2.55, data.z);
        marker.setEnabled(false);

        const npc = { data, holder, marker, animations, position: new Vector3(data.x, y, data.z), baseRotation: holder.rotation.y };
        this.npcs.push(npc);
        return npc;
    }

    /** PNJ assez proche pour lui parler. */
    nearest(position) {
        let best = null;
        let bestDistance = NPC_TALK_DISTANCE;
        for (const npc of this.npcs) {
            const distance = Math.hypot(npc.position.x - position.x, npc.position.z - position.z);
            if (distance < bestDistance) {
                best = npc;
                bestDistance = distance;
            }
        }
        return best;
    }

    byCode(code) {
        return this.npcs.find((npc) => npc.data.code === code) ?? null;
    }

    /** Affiche le losange au-dessus des PNJ qui font avancer l'étape de quête en cours. */
    setQuestStep(stepCode) {
        for (const npc of this.npcs) npc.marker.setEnabled(Boolean(stepCode) && npc.data.questStep === stepCode);
    }

    /** Le PNJ se tourne vers le joueur et fait un geste en parlant. */
    talkTo(npc, playerPosition) {
        npc.holder.rotation.y = Math.atan2(playerPosition.x - npc.position.x, playerPosition.z - npc.position.z);
        const { Idle, Interact } = npc.animations;
        if (!Interact) return;
        Idle?.stop();
        Interact.start(false, 1, Interact.from, Interact.to, false);
        Interact.onAnimationGroupEndObservable.addOnce(() => Idle?.start(true));
    }

    update(time) {
        for (const npc of this.npcs) {
            if (!npc.marker.isEnabled()) continue;
            npc.marker.rotation.y = time * 1.8;
            npc.marker.position.y = npc.position.y + 2.55 + Math.sin(time * 2.4) * 0.09;
        }
    }
}
